import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { Message } from "openai/resources/beta/threads/messages.mjs";
import type { ResponseInput } from "openai/resources/responses/responses.mjs";

import { convertPromptToResponsesInput } from "./convertPromptToResponseInput";

export function buildResponsesRequest({
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
