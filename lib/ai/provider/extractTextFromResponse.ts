export function extractTextFromResponse(response: any) {
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
