import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "./validate";

export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 1024;

// TODO(S2): profile.md と prompt.md から組み立てる
const SYSTEM_PROMPT = "あなたは自己紹介サイトのアシスタントです。日本語で簡潔に答えてください。";

export async function askClaude(apiKey: string, messages: Message[]): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // 短い Q&A なので考える量を抑えて速く・安くする
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages,
  });

  if (response.stop_reason === "refusal") {
    return "すみません、その質問にはお答えできません。";
  }
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
