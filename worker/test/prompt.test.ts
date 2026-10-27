import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/prompt";

describe("buildSystemPrompt", () => {
  it("指示文のあとにプロフィールを <profile> で囲んで置く", () => {
    const result = buildSystemPrompt("指示です\n", "\n趣味は合唱\n");
    expect(result).toBe("指示です\n\n<profile>\n趣味は合唱\n</profile>");
  });

  it("プロフィール内の HTML コメントは取り除く", () => {
    const result = buildSystemPrompt("指示", "<!--\n書く人向けのメモ\n-->\n# 名前\n<!-- 一行メモ -->趣味");
    expect(result).not.toContain("メモ");
    expect(result).toContain("# 名前\n趣味");
  });
});
