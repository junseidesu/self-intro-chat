import { describe, expect, it } from "vitest";
import { LIMITS, validateChatRequest } from "../src/validate";

const user = (content: string) => ({ role: "user", content });
const assistant = (content: string) => ({ role: "assistant", content });

describe("validateChatRequest", () => {
  it("user 1件だけの要求を受け付ける", () => {
    const r = validateChatRequest({ messages: [user("趣味は？")] });
    expect(r).toEqual({ ok: true, messages: [user("趣味は？")] });
  });

  it("user と assistant が交互で、最後が user なら受け付ける", () => {
    const r = validateChatRequest({ messages: [user("a"), assistant("b"), user("c")] });
    expect(r.ok).toBe(true);
  });

  it.each([
    ["messages がない", {}],
    ["null", null],
    ["空配列", { messages: [] }],
    ["先頭が assistant", { messages: [assistant("a")] }],
    ["user が連続", { messages: [user("a"), user("b")] }],
    ["最後が assistant", { messages: [user("a"), assistant("b")] }],
    ["content が空白だけ", { messages: [user("  ")] }],
    ["content が文字列でない", { messages: [{ role: "user", content: 1 }] }],
    ["role が system", { messages: [{ role: "system", content: "a" }] }],
  ])("%s は弾く", (_, body) => {
    expect(validateChatRequest(body).ok).toBe(false);
  });

  it("user の文字数上限ちょうどは通し、超えたら弾く", () => {
    const max = LIMITS.maxUserChars;
    expect(validateChatRequest({ messages: [user("あ".repeat(max))] }).ok).toBe(true);
    expect(validateChatRequest({ messages: [user("あ".repeat(max + 1))] }).ok).toBe(false);
  });

  it("assistant の文字数上限を超えたら弾く", () => {
    const long = "あ".repeat(LIMITS.maxAssistantChars + 1);
    expect(validateChatRequest({ messages: [user("a"), assistant(long), user("c")] }).ok).toBe(false);
  });

  it("件数上限を超えたら弾く", () => {
    const messages = Array.from({ length: LIMITS.maxMessages + 1 }, (_, i) =>
      i % 2 === 0 ? user("q") : assistant("a"),
    );
    expect(validateChatRequest({ messages }).ok).toBe(false);
  });
});
