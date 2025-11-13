import type { LanguageModelV2 } from "@ai-sdk/provider";
import { customProvider, type LanguageModel } from "ai";
import type { Message } from "openai/resources/beta/threads/messages.mjs";
import type { ResponseInput } from "openai/resources/responses/responses.mjs";
import { openai } from "@/lib/server/openai";

import { isTestEnvironment } from "../constants";
import {
  getModelConfig,
  mapResponsesUsageToLanguageModelUsage,
} from "../openai";

type ModelId =
  | "chat-model"
  | "chat-model-reasoning"
  | "title-model"
  | "artifact-model";

const testProvider = (() => {
  if (!isTestEnvironment) {
    return null;
  }

  const {
    artifactModel,
    chatModel,
    reasoningModel,
    titleModel,
  } = require("./models.mock");
  return customProvider({
    languageModels: {
      "chat-model": chatModel,
      "chat-model-reasoning": reasoningModel,
      "title-model": titleModel,
      "artifact-model": artifactModel,
    },
  });
})();

const productionModels: Record<ModelId, LanguageModel> = {
  "chat-model": createOpenAiLanguageModel("chat-model"),
  "chat-model-reasoning": createOpenAiLanguageModel("chat-model-reasoning"),
  "title-model": createOpenAiLanguageModel("title-model"),
  "artifact-model": createOpenAiLanguageModel("artifact-model"),
};

export const myProvider = testProvider ?? {
  languageModel(modelId: ModelId): LanguageModel {
    const model = productionModels[modelId];
    if (!model) {
      throw new Error(`Unsupported model id: ${modelId}`);
    }
    return model;
  },
};

function createOpenAiLanguageModel(modelId: ModelId): LanguageModelV2 {
  const { model } = getModelConfig(modelId);

  return {
    specificationVersion: "v2",
    provider: "openai",
    modelId: model,
    supportedUrls: {},
    async doGenerate(options) {
      const request = buildResponsesRequest({ options, model });

      const response = await openai.responses.create(request, {
        signal: options.abortSignal,
      });

      const text = extractTextFromResponse(response);

      return {
        content: text ? [{ type: "text", text }] : [],
        finishReason: "stop",
        usage: mapResponsesUsageToLanguageModelUsage(response.usage),
        warnings: [],
      };
    },
    async doStream(options: Parameters<LanguageModelV2["doStream"]>[0]) {
      const request = buildResponsesRequest({ options, model });

      const responsesStream = await openai.responses.stream(request, {
        signal: options.abortSignal,
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });

          const textTracker = createStreamDeltaEmitter("text", controller);
          const reasoningTracker = createStreamDeltaEmitter(
            "reasoning",
            controller
          );

          responsesStream.on("response.output_text.delta", (event) => {
            const id = (event as any).item_id ?? `text-${event.output_index}`;
            if (event.delta) {
              textTracker.writeDelta(id, event.delta);
            }
          });

          responsesStream.on("response.output_text.done", (event) => {
            const id = (event as any).item_id ?? `text-${event.output_index}`;
            textTracker.finish(id);
          });

          responsesStream.on("response.reasoning_text.delta", (event) => {
            const id =
              (event as any).item_id ?? `reasoning-${event.output_index}`;
            if (event.delta) {
              reasoningTracker.writeDelta(id, event.delta);
            }
          });

          responsesStream.on("response.reasoning_text.done", (event) => {
            const id =
              (event as any).item_id ?? `reasoning-${event.output_index}`;
            reasoningTracker.finish(id);
          });

          responsesStream.on("event", (event: any) => {
            if (event.type === "response.error") {
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

      return { stream };
    },
  };
}

function buildResponsesRequest({
  options,
  model,
}: {
  options: Parameters<LanguageModelV2["doGenerate"]>[0];
  model: string;
}) {
  const input = convertPromptToResponsesInput(
    options.prompt as unknown as Message[]
  );

  const request: {
    model: string;
    input: ResponseInput;
    temperature?: number;
    max_output_tokens?: number;
    stop?: string[];
    response_format?: Record<string, unknown>;
    prompt_id?: string;
  } = {
    model,
    input,
    temperature: options.temperature,
    max_output_tokens: options.maxOutputTokens,
    stop: options.stopSequences,
  };

  if (options.responseFormat?.type === "json") {
    request.response_format = options.responseFormat.schema
      ? {
          type: "json_schema",
          json_schema: {
            name: options.responseFormat.name ?? "response",
            schema: options.responseFormat.schema,
          },
        }
      : { type: "json_object" };
  }

  return request;
}

function convertPromptToResponsesInput(prompt: Message[]): ResponseInput {
  return prompt
    .map((message: { role: string; content: any }) => {
      if (message.role === "system") {
        const systemText = Array.isArray(message.content)
          ? message.content
              .filter(
                (part: { type?: string }) =>
                  part.type === "text" && typeof (part as any).text === "string"
              )
              .map((part: any) => part.text as string)
              .join("\n\n")
          : String(message.content ?? "");

        if (!systemText) {
          return null;
        }

        return {
          role: "system",
          content: [{ type: "input_text", text: systemText }],
        };
      }

      const textParts =
        Array.isArray(message.content) && message.content.length > 0
          ? message.content
              .filter(
                (part: { type?: string }) =>
                  part.type === "text" && typeof (part as any).text === "string"
              )
              .map((part: any) => ({
                type: "input_text" as const,
                text: part.text as string,
              }))
          : [];

      if (!textParts.length) {
        return null;
      }

      return {
        role: message.role,
        content: textParts,
      };
    })
    .filter(Boolean) as ResponseInput;
}

function extractTextFromResponse(response: any) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (
          content?.type === "output_text" &&
          typeof content.text === "string"
        ) {
          chunks.push(content.text);
        }
      }
    }
  }

  return chunks.join("");
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
