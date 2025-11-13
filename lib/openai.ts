import type { LanguageModelUsage } from "ai";
import type { Tool } from "openai/resources/responses/responses";
import type { ChatModel } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";

type ModelConfig = {
  model: string;
};

const MODEL_CONFIG: Record<
  ChatModel["id"] | "title-model" | "artifact-model",
  ModelConfig
> = {
  "chat-model": {
    model: "gpt-4o-mini",
  },
  "chat-model-reasoning": {
    model: "gpt-4o",
  },
  "title-model": {
    model: "gpt-4o-mini",
  },
  "artifact-model": {
    model: "gpt-4o-mini",
  },
};

export function getModelConfig(
  modelId: keyof typeof MODEL_CONFIG
): ModelConfig {
  const config = MODEL_CONFIG[modelId];
  if (!config) {
    throw new Error(`Unsupported model id: ${modelId}`);
  }
  return config;
}

export function buildResponsesInput({
  messages,
  systemPrompt,
}: {
  messages: ChatMessage[];
  systemPrompt: string;
}): string {
  const lines: string[] = [];

  if (systemPrompt.trim().length > 0) {
    lines.push(`System: ${systemPrompt}`);
  }

  for (const message of messages) {
    const textParts = message.parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text.trim())
      .filter((text) => text.length > 0);

    if (textParts.length === 0) {
      continue;
    }

    const roleLabel =
      message.role === "assistant"
        ? "Assistant"
        : message.role.charAt(0).toUpperCase() + message.role.slice(1);

    lines.push(`${roleLabel}: ${textParts.join("\n\n")}`);
  }

  return lines.join("\n\n");
}

const ARTIFACT_TOOL_KINDS = ["text", "code", "sheet"] as const;

export const openAiToolDefinitions: Tool[] = [
  {
    type: "function",
    name: "getWeather",
    description:
      "Get the current weather given a city name or latitude/longitude coordinates.",
    parameters: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude in decimal degrees.",
        },
        longitude: {
          type: "number",
          description: "Longitude in decimal degrees.",
        },
        city: {
          type: "string",
          description:
            "City name to lookup (e.g., 'San Francisco', 'Madrid', 'CDMX').",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "createDocument",
    description:
      "Create an artifact (text, code, sheet) rendered in the Welthra UI.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title to display for the document.",
        },
        kind: {
          type: "string",
          enum: ARTIFACT_TOOL_KINDS as unknown as string[],
          description: "Type of artifact to create (text, code, sheet).",
        },
      },
      required: ["title", "kind"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "updateDocument",
    description: "Update an existing artifact with new instructions.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Document ID to update.",
        },
        description: {
          type: "string",
          description: "Detailed description of the requested edits.",
        },
      },
      required: ["id", "description"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "requestSuggestions",
    description:
      "Generate editorial suggestions for a document and surface them in the UI.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The document ID that should receive suggestions.",
        },
      },
      required: ["documentId"],
      additionalProperties: false,
    },
  },
];

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

export function mapResponsesUsageToLanguageModelUsage(
  usage?: OpenAIUsage | null
): LanguageModelUsage {
  const input =
    usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.total_tokens ?? 0;
  const output =
    usage?.output_tokens ??
    usage?.completion_tokens ??
    (usage?.total_tokens ? Math.max(usage.total_tokens - input, 0) : 0);
  const total =
    usage?.total_tokens ??
    (usage?.input_tokens ?? usage?.prompt_tokens ?? 0) +
      (usage?.output_tokens ?? usage?.completion_tokens ?? 0);

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
  };
}
