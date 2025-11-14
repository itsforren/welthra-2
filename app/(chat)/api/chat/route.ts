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
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  updateChatOpenAIThreadId,
} from "@/lib/db/queries";
import { extractTextFromDocument } from "@/lib/documents";
import { ChatSDKError } from "@/lib/errors";
import { mapResponsesUsageToLanguageModelUsage } from "@/lib/openai";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

type TextContentPart = {
  type: "text";
  text: string;
};

type ImageURLContentPart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

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
  console.log("🔥 CHAT API CALLED");
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
    const { id, message, selectedVisibilityType } = requestBody;

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

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({ message });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

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

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        try {
          console.log("🔥 CHAT EXECUTE CALLED");
          writer.write({ type: "start" });

          let threadId: string;

          if (chat?.openaiThreadId) {
            threadId = chat.openaiThreadId;
          } else {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            await updateChatOpenAIThreadId({ chatId: id, threadId });
          }

          const textParts = message.parts.filter(
            (
              part
            ): part is {
              type: "text";
              text: string;
            } => part.type === "text"
          );

          const fileParts = message.parts.filter(
            (part) => part.type === "file"
          ) as {
            type: "file";
            url: string;
            name: string;
            mediaType: string;
          }[];

          const imageFileParts = fileParts.filter((part) =>
            part.mediaType.startsWith("image/")
          );

          const documentFileParts = fileParts.filter(
            (part) => !part.mediaType.startsWith("image/")
          );

          const content: (TextContentPart | ImageURLContentPart)[] = [];

          let baseText =
            textParts.length > 0
              ? textParts.map((part) => part.text).join("\n")
              : "";

          if (documentFileParts.length > 0) {
            const docsTextChunks = await Promise.all(
              documentFileParts.map((doc) =>
                extractTextFromDocument({
                  url: doc.url,
                  mediaType: doc.mediaType,
                  name: doc.name,
                })
              )
            );

            const docsText = docsTextChunks
              .map((chunk) => chunk.trim())
              .filter((chunk) => chunk.length > 0)
              .join("\n\n");

            if (docsText.length > 0) {
              baseText = baseText
                ? `${baseText}\n\n[Attached documents]\n${docsText}`
                : `[Attached documents]\n${docsText}`;
            }
          }

          if (baseText.trim().length > 0) {
            content.push({
              type: "text",
              text: baseText,
            });
          }

          for (const imagePart of imageFileParts) {
            content.push({
              type: "image_url",
              image_url: {
                url: imagePart.url,
                detail: "auto",
              },
            });
          }

          await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content,
          });

          // STREAM DEL ASSISTANT
          const responseSummary = await streamOpenAIResponse({
            threadId,
            assistantId: process.env.OPENAI_ASSISTANT_ID as string,
            writer,
          });

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
      onFinish: async ({ messages }) => {
        const assistantMessages = messages.filter(
          (chatMessage) => chatMessage.role === "assistant"
        );

        if (assistantMessages.length > 0) {
          await saveMessages({
            messages: assistantMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
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

async function streamOpenAIResponse({
  threadId,
  assistantId,
  writer,
}: {
  threadId: string;
  assistantId: string;
  writer: UIMessageStreamWriter<ChatMessage>;
}) {
  const runStream = await openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
    stream: true,
  });

  const messageStates = new Map<
    string,
    { started: boolean; accumulated: string }
  >();
  let lastMessageId: string | null = null;

  const ensureState = (id: string) => {
    let state = messageStates.get(id);
    if (!state) {
      state = { started: false, accumulated: "" };
      messageStates.set(id, state);
    }
    return state;
  };

  const startMessageIfNeeded = (id: string) => {
    const state = ensureState(id);
    if (!state.started) {
      writer.write({ type: "text-start", id });
      state.started = true;
    }
    return state;
  };

  try {
    for await (const event of runStream as any as AsyncIterable<any>) {
      switch (event?.event) {
        case "thread.message.delta": {
          const messageId = event.data?.id ?? "assistant";
          lastMessageId = messageId;
          const state = startMessageIfNeeded(messageId);
          const deltas: any[] = event.data?.delta?.content ?? [];

          for (const content of deltas) {
            const textValue =
              typeof content?.text?.value === "string"
                ? content.text.value
                : undefined;

            if (!textValue) {
              continue;
            }

            writer.write({
              type: "text-delta",
              id: messageId,
              delta: textValue,
            });
            state.accumulated += textValue;
          }
          break;
        }
        case "thread.message.completed": {
          const messageId = event.data?.id ?? "assistant";
          const state = messageStates.get(messageId);
          if (state?.started) {
            writer.write({ type: "text-end", id: messageId });
            state.started = false;
          }
          break;
        }
        case "thread.run.completed": {
          // handled after loop via finalRun call
          break;
        }
        case "thread.run.failed":
        case "thread.run.cancelled":
        case "thread.run.expired": {
          writer.write({
            type: "error",
            errorText:
              event?.data?.last_error?.message ??
              "Assistant run failed unexpectedly",
          });
          throw new Error(
            event?.data?.last_error?.message ??
              `Assistant run ended with status: ${event.event}`
          );
        }
        default: {
          // Ignore other events (tool calls, etc.) for now
          break;
        }
      }
    }

    const unfinishedState =
      lastMessageId && messageStates.get(lastMessageId)?.started
        ? messageStates.get(lastMessageId)
        : null;

    if (unfinishedState && lastMessageId) {
      writer.write({ type: "text-end", id: lastMessageId });
      unfinishedState.started = false;
    }

    const finalRun = await (runStream as any).finalRun();
    const finalState = lastMessageId
      ? messageStates.get(lastMessageId)
      : messageStates.values().next().value;

    return {
      text: finalState?.accumulated ?? "",
      modelId: finalRun?.model,
      usage: finalRun?.usage,
    };
  } catch (error) {
    if (error instanceof Error) {
      writer.write({ type: "error", errorText: error.message });
    } else {
      writer.write({
        type: "error",
        errorText: "Unknown assistant stream error",
      });
    }
    throw error;
  }
}

type ProviderProxyRequest = {
  mode: "provider-stream" | "provider-generate";
  request?: Record<string, unknown>;
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
    return streamProviderResponse(payload.request as Record<string, unknown>);
  }

  return generateProviderResponse(payload.request as Record<string, unknown>);
}

async function streamProviderResponse(requestPayload: Record<string, unknown>) {
  try {
    const responsesStream = await openai.responses.stream({
      ...(requestPayload as any),
      prompt_id: process.env.OPENAI_PROMPT_ID,
    });

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
