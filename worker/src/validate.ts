export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export const LIMITS = {
  maxMessages: 10,
  maxUserChars: 500,
  // AI の回答も送り返されてくるので上限を設ける（回答は最大800トークン程度）
  maxAssistantChars: 3000,
} as const;

export type ValidationResult =
  | { ok: true; messages: Message[] }
  | { ok: false; reason: string };

// ブラウザから届いた要求を検証する。通ったものだけが Claude API に渡る
export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || !("messages" in body)) {
    return { ok: false, reason: "messages がありません" };
  }
  const raw = (body as { messages: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "messages は1件以上の配列にしてください" };
  }
  if (raw.length > LIMITS.maxMessages) {
    return { ok: false, reason: `messages は${LIMITS.maxMessages}件までです` };
  }

  const messages: Message[] = [];
  for (const [i, m] of raw.entries()) {
    if (typeof m !== "object" || m === null) {
      return { ok: false, reason: `${i}件目の形が不正です` };
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    // user → assistant → user … と交互に並び、先頭は user
    const expected: Role = i % 2 === 0 ? "user" : "assistant";
    if (role !== expected) {
      return { ok: false, reason: `${i}件目の role は ${expected} である必要があります` };
    }
    if (typeof content !== "string" || content.trim() === "") {
      return { ok: false, reason: `${i}件目の content が空です` };
    }
    const max = role === "user" ? LIMITS.maxUserChars : LIMITS.maxAssistantChars;
    if (content.length > max) {
      return { ok: false, reason: `${i}件目が長すぎます（${max}文字まで）` };
    }
    messages.push({ role: expected, content });
  }

  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, reason: "最後のメッセージは user である必要があります" };
  }
  return { ok: true, messages };
}
