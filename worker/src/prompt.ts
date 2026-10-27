// AI への指示文を組み立てる。プロフィールは <profile> で囲み、指示と区別できるようにする
export function buildSystemPrompt(instructions: string, profile: string): string {
  // profile.md の <!-- --> は書く人向けの注意書きなので AI には渡さない
  const body = profile.replace(/<!--[\s\S]*?-->/g, "").trim();
  return `${instructions.trim()}\n\n<profile>\n${body}\n</profile>`;
}
