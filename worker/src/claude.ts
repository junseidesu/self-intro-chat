import Anthropic from "@anthropic-ai/sdk";
import profile from "../profile.md";
import instructions from "../prompt.md";
import { buildSystemPrompt } from "./prompt";
import type { Message } from "./validate";

export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = buildSystemPrompt(instructions, profile);

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
