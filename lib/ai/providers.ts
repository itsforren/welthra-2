import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";

import {
  getModelConfig,
  mapResponsesUsageToLanguageModelUsage,
} from "../openai";

const trailingSlashRegex = /\/$/;
const carriageReturnRegex = /\r/g;

import { buildResponsesRequest } from "./provider/buildResponseRequest";
import { extractTextFromResponse } from "./provider/extractTextFromResponse";

type ModelId =
  | "chat-model"
  | "chat-model-reasoning"
  | "title-model"
  | "artifact-model";

const productionModels: Record<ModelId, LanguageModel> = {
  "chat-model": createOpenAiLanguageModel("chat-model"),
  "chat-model-reasoning": createOpenAiLanguageModel("chat-model-reasoning"),
  "title-model": createOpenAiLanguageModel("title-model"),
  "artifact-model": createOpenAiLanguageModel("artifact-model"),
};

const PROVIDER_STREAM_MODE = "provider-stream";
const PROVIDER_GENERATE_MODE = "provider-generate";

export const myProvider = {
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

      const response = await fetch(getChatApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: PROVIDER_GENERATE_MODE,
          request,
        }),
        signal: options.abortSignal,
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw await createApiError(response);
      }

      const data = (await response.json()) as ProviderGenerateResponse;
      const text = extractTextFromResponse(data.response);

      return {
        content: text ? [{ type: "text", text }] : [],
        finishReason: "stop",
        usage: mapResponsesUsageToLanguageModelUsage(
          (data.response as any)?.usage
        ),
        warnings: [],
      };
    },
    async doStream(options: Parameters<LanguageModelV2["doStream"]>[0]) {
      const request = buildResponsesRequest({ options, model });

      const response = await fetch(getChatApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: PROVIDER_STREAM_MODE,
          request,
        }),
        signal: options.abortSignal,
        cache: "no-store",
        credentials: "include",
      });

      const body = response.body;

      if (!response.ok || !body) {
        throw await createApiError(response);
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of parseEventStream(body)) {
              controller.enqueue(event);
              if (event?.type === "finish" || event?.type === "error") {
                break;
              }
            }
          } catch (error) {
            controller.enqueue({ type: "error", error });
          } finally {
            controller.close();
          }
        },
        cancel() {
          body?.cancel();
        },
      });

      return { stream };
    },
  };
}

type ProviderGenerateResponse = {
  response: unknown;
};

function getChatApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/chat";
  }

  const configuredBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  const baseUrl = configuredBase ?? "http://localhost:3000";

  return `${baseUrl.replace(trailingSlashRegex, "")}/api/chat`;
}

async function createApiError(response: Response) {
  let message = `Chat API request failed with status ${response.status}`;

  try {
    const data = await response.clone().json();
    if (typeof data?.error === "string") {
      message = data.error;
    } else if (typeof data?.message === "string") {
      message = data.message;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) {
        message = text;
      }
    } catch {
      // ignore
    }
  }

  const error = new Error(message);
  // Attach status for upstream handlers if needed
  (error as any).status = response.status;
  return error;
}

async function* parseEventStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separatorIndex = buffer.indexOf("\n\n");
        if (separatorIndex === -1) {
          break;
        }

        const chunk = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const data = extractEventData(chunk);
        if (!data) {
          continue;
        }

        try {
          yield JSON.parse(data);
        } catch {
          console.error("Malformed event", data);
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining.length > 0) {
      const data = extractEventData(remaining);
      if (data) {
        try {
          yield JSON.parse(data);
        } catch {
          console.error("Malformed trailing event", remaining);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function extractEventData(chunk: string) {
  const normalized = chunk.replace(carriageReturnRegex, "");
  const dataLines = normalized
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n");
}
