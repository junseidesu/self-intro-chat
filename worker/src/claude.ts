import Anthropic from "@anthropic-ai/sdk";
import profile from "../profile.md";
import instructions from "../prompt.md";
import { buildSystemPrompt } from "./prompt";
import type { Message } from "./validate";

export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = buildSystemPrompt(instructions, profile);

// 安全上の理由で回答が止められたとき
export class RefusalError extends Error {}

// 回答の文字を届いた順に返す
export async function* streamClaude(apiKey: string, messages: Message[]): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // 短い Q&A なので考える量を抑えて速く・安くする
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    } else if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
      throw new RefusalError();
    }
  }
}
