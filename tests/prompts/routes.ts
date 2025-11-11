// app/api/chat/route.ts
import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // If you are using Vercel AI Gateway:
  // baseURL: process.env.OPENAI_BASE_URL,
  // apiKey: process.env.AI_GATEWAY_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await client.responses.stream({
    model: "gpt-4o-mini",
    prompt_id: process.env.OPENAI_PROMPT_ID!, // <--- your saved prompt
    input: messages,
  });

  return new Response(stream.toReadableStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
