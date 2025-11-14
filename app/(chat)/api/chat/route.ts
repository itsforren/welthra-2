import { geolocation } from "@vercel/functions";
import {
  createUIMessageStream,
  JsonToSseTransformStream,
  type UIMessageStreamWriter,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import OpenAI from "openai";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import {
  buildResponsesInput,
  getModelConfig,
  mapResponsesUsageToLanguageModelUsage,
} from "@/lib/openai";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let globalStreamContext: ResumableStreamContext | null = null;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return;
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 }
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({ waitUntil: after });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(" > Resumable streams disabled: missing REDIS_URL");
      } else {
        console.error(error);
      }
    }
  }
  return globalStreamContext;
}

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  if (isProviderProxyRequest(parsedBody)) {
    return handleProviderProxyRequest(parsedBody);
  }

  let requestBody: PostRequestBody;

  try {
    requestBody = postRequestBodySchema.parse(parsedBody);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      const title = await generateTitleFromUserMessage({ message });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const { model } = getModelConfig(selectedChatModel);

    const responsesInput = buildResponsesInput({
      messages: uiMessages,
      systemPrompt: systemPrompt({
        selectedChatModel,
        requestHints,
      }),
    });

    let finalMergedUsage: AppUsage | undefined;
    let streamedAssistantMessage: ChatMessage | null = null;

    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        try {
          writer.write({ type: "start" });

          const responseSummary = await streamOpenAIResponse({
            model,
            input: responsesInput,
            metadata: {
              chatId: id,
              userId: session.user.id,
            },
            writer,
          });

          const assistantText = responseSummary.text;
          if (assistantText?.length) {
            streamedAssistantMessage = {
              id: generateUUID(),
              role: "assistant",
              parts: [{ type: "text", text: assistantText }],
            };

            writer.write({
              type: "data-appendMessage",
              data: JSON.stringify(streamedAssistantMessage),
              transient: true,
            });
          }

          const usageForFinish = mapResponsesUsageToLanguageModelUsage(
            responseSummary.usage
          );

          try {
            const providers = await getTokenlensCatalog();

            if (responseSummary.modelId) {
              const totalTokens = usageForFinish.totalTokens ?? 0;
              const summary =
                providers && totalTokens > 0
                  ? getUsage({
                      modelId: responseSummary.modelId,
                      usage: usageForFinish,
                      providers,
                    })
                  : undefined;

              finalMergedUsage = summary
                ? ({
                    ...usageForFinish,
                    ...summary,
                    modelId: responseSummary.modelId,
                  } as AppUsage)
                : ({
                    ...usageForFinish,
                    modelId: responseSummary.modelId,
                  } as AppUsage);
            } else {
              finalMergedUsage = usageForFinish as AppUsage;
            }

            if (finalMergedUsage) {
              writer.write({ type: "data-usage", data: finalMergedUsage });
            }
          } catch (err) {
            console.warn("TokenLens enrichment failed", err);
          }

          writer.write({
            type: "finish",
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown stream error";
          writer.write({ type: "error", errorText: errorMessage });
          throw error;
        }
      },
      generateId: generateUUID,
      onFinish: async () => {
        if (streamedAssistantMessage) {
          await saveMessages({
            messages: [
              {
                id: streamedAssistantMessage.id,
                role: "assistant",
                parts: streamedAssistantMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              },
            ],
          });
        }

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    const streamContext = await getStreamContext();

    if (streamContext) {
      const resumable = await streamContext.resumableStream(streamId, () =>
        stream.pipeThrough(new JsonToSseTransformStream())
      );

      if (resumable) {
        return new Response(resumable, {
          headers: SSE_HEADERS,
        });
      }
    }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
      headers: SSE_HEADERS,
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes("prompt_id") &&
      error.message?.includes("not found")
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

type StreamOpenAIResponseArgs = {
  model: string;
  input: string;
  metadata: Record<string, string>;
  writer: UIMessageStreamWriter<ChatMessage>;
};

type StreamOpenAIResponseResult = {
  text: string;
  usage: Parameters<typeof mapResponsesUsageToLanguageModelUsage>[0];
  modelId?: string;
};

async function streamOpenAIResponse({
  model,
  input,
  metadata,
  writer,
}: StreamOpenAIResponseArgs): Promise<StreamOpenAIResponseResult> {
  const responsesStream = await openai.responses.stream({
    model,
    input,
    metadata,
  });

  const textTracker = createDeltaTracker("text", writer);
  const reasoningTracker = createDeltaTracker("reasoning", writer);
  let accumulatedText = "";

  responsesStream.on("response.output_text.delta", (event: any) => {
    const id = event.item_id ?? `text-${event.output_index}`;
    if (typeof event.delta === "string" && event.delta.length > 0) {
      textTracker.writeDelta(id, event.delta);
      accumulatedText += event.delta;
    }
  });

  responsesStream.on("response.output_text.done", (event: any) => {
    const id = event.item_id ?? `text-${event.output_index}`;
    textTracker.finish(id);
  });

  responsesStream.on("response.reasoning_text.delta", (event: any) => {
    const id = event.item_id ?? `reasoning-${event.output_index}`;
    if (typeof event.delta === "string" && event.delta.length > 0) {
      reasoningTracker.writeDelta(id, event.delta);
    }
  });

  responsesStream.on("response.reasoning_text.done", (event: any) => {
    const id = event.item_id ?? `reasoning-${event.output_index}`;
    reasoningTracker.finish(id);
  });

  responsesStream.on("event", (event: any) => {
    if (
      typeof event === "object" &&
      event !== null &&
      "type" in event &&
      event.type === "response.error"
    ) {
      const message =
        "error" in event && typeof event.error === "string"
          ? event.error
          : "OpenAI stream error";
      writer.write({ type: "error", errorText: message });
    }
  });

  const finalResponse = await responsesStream.finalResponse();

  textTracker.finishAll();
  reasoningTracker.finishAll();

  return {
    text: accumulatedText,
    usage: (finalResponse as any)?.usage ?? null,
    modelId: (finalResponse as any)?.model,
  };
}

function createDeltaTracker(
  kind: "text" | "reasoning",
  writer: UIMessageStreamWriter<ChatMessage>
) {
  const states = new Map<string, { started: boolean; finished: boolean }>();

  const ensureState = (id: string) => {
    let state = states.get(id);
    if (!state) {
      state = { started: false, finished: false };
      states.set(id, state);
    }
    return state;
  };

  return {
    writeDelta: (id: string, delta: string) => {
      const state = ensureState(id);
      if (!state.started) {
        if (kind === "text") {
          writer.write({ type: "text-start", id });
        } else {
          writer.write({ type: "reasoning-start", id });
        }
        state.started = true;
      }

      if (kind === "text") {
        writer.write({ type: "text-delta", id, delta });
      } else {
        writer.write({ type: "reasoning-delta", id, delta });
      }
    },
    finish: (id: string) => {
      const state = states.get(id);
      if (state?.started && !state.finished) {
        if (kind === "text") {
          writer.write({ type: "text-end", id });
        } else {
          writer.write({ type: "reasoning-end", id });
        }
        state.finished = true;
      }
    },
    finishAll: () => {
      for (const [id, state] of states) {
        if (state.started && !state.finished) {
          if (kind === "text") {
            writer.write({ type: "text-end", id });
          } else {
            writer.write({ type: "reasoning-end", id });
          }
          state.finished = true;
        }
      }
    },
  };
}

type ProviderProxyRequest = {
  mode: "provider-stream" | "provider-generate";
  request: Record<string, unknown>;
};

function isProviderProxyRequest(
  payload: unknown
): payload is ProviderProxyRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const maybePayload = payload as Record<string, unknown>;
  const mode = maybePayload.mode;

  if (mode === "provider-stream" || mode === "provider-generate") {
    const request = maybePayload.request;
    return typeof request === "object" && request !== null;
  }

  return false;
}

function handleProviderProxyRequest(payload: ProviderProxyRequest) {
  if (payload.mode === "provider-stream") {
    return streamProviderResponse(payload.request);
  }

  return generateProviderResponse(payload.request);
}

async function streamProviderResponse(requestPayload: Record<string, unknown>) {
  try {
    const responsesStream = await openai.responses.stream(
      requestPayload as any
    );

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });

        const textTracker = createStreamDeltaEmitter("text", controller);
        const reasoningTracker = createStreamDeltaEmitter(
          "reasoning",
          controller
        );

        responsesStream.on("response.output_text.delta", (event: any) => {
          const id = event.item_id ?? `text-${event.output_index}`;
          if (event.delta) {
            textTracker.writeDelta(id, event.delta);
          }
        });

        responsesStream.on("response.output_text.done", (event: any) => {
          const id = event.item_id ?? `text-${event.output_index}`;
          textTracker.finish(id);
        });

        responsesStream.on("response.reasoning_text.delta", (event: any) => {
          const id = event.item_id ?? `reasoning-${event.output_index}`;
          if (event.delta) {
            reasoningTracker.writeDelta(id, event.delta);
          }
        });

        responsesStream.on("response.reasoning_text.done", (event: any) => {
          const id = event.item_id ?? `reasoning-${event.output_index}`;
          reasoningTracker.finish(id);
        });

        responsesStream.on("event", (event: any) => {
          if (event?.type === "response.error") {
            controller.enqueue({ type: "error", error: event.error });
          }
          controller.close();
        });

        responsesStream
          .finalResponse()
          .then((response) => {
            textTracker.finishAll();
            reasoningTracker.finishAll();
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: mapResponsesUsageToLanguageModelUsage(response.usage),
            });
            controller.close();
          })
          .catch((error) => {
            controller.enqueue({ type: "error", error });
            controller.close();
          });
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
      headers: SSE_HEADERS,
    });
  } catch (error) {
    console.error("Provider stream proxy failed", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}

async function generateProviderResponse(
  requestPayload: Record<string, unknown>
) {
  try {
    const response = await openai.responses.create(requestPayload as any);
    return Response.json({ response }, { status: 200 });
  } catch (error) {
    console.error("Provider generate proxy failed", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}

function createStreamDeltaEmitter(
  kind: "text" | "reasoning",
  controller: ReadableStreamDefaultController
) {
  const state = new Map<string, { started: boolean; finished: boolean }>();

  const ensureState = (id: string) => {
    let entry = state.get(id);
    if (!entry) {
      entry = { started: false, finished: false };
      state.set(id, entry);
    }
    return entry;
  };

  const startType = kind === "text" ? "text-start" : "reasoning-start";
  const deltaType = kind === "text" ? "text-delta" : "reasoning-delta";
  const endType = kind === "text" ? "text-end" : "reasoning-end";

  return {
    writeDelta(id: string, delta: string) {
      if (!delta) {
        return;
      }
      const entry = ensureState(id);
      if (!entry.started) {
        controller.enqueue({ type: startType, id });
        entry.started = true;
      }
      controller.enqueue({ type: deltaType, id, delta });
    },
    finish(id: string) {
      const entry = state.get(id);
      if (entry?.started && !entry.finished) {
        controller.enqueue({ type: endType, id });
        entry.finished = true;
      }
    },
    finishAll() {
      for (const [id, entry] of state.entries()) {
        if (entry.started && !entry.finished) {
          controller.enqueue({ type: endType, id });
          entry.finished = true;
        }
      }
    },
  };
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
