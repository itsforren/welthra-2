import type { Message } from "openai/resources/beta/threads/messages.mjs";
import type { ResponseInput } from "openai/resources/responses/responses.mjs";

export function convertPromptToResponsesInput(
  prompt: Message[]
): ResponseInput {
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
