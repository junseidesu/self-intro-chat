// サイト全体の1日の利用回数を KV で数える。
// KV は読んで書くまでの間に他の要求が割り込めるので、上限は「だいたい」守られる。
// 少し超えても月額上限（Anthropic Console）が最後の歯止めになる。

type Counter = Pick<KVNamespace, "get" | "put">;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 日本時間の日付ごとにキーを分ける（例: usage:2026-10-27）
export function dailyKey(now: Date): string {
  return `usage:${new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)}`;
}

// 上限内なら1回分を数えて true、上限に達していたら数えずに false
export async function consumeDailyQuota(kv: Counter, limit: number, now: Date): Promise<boolean> {
  const key = dailyKey(now);
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= limit) return false;
  // 古いキーは2日で自動的に消える
  await kv.put(key, String(count + 1), { expirationTtl: 2 * 24 * 60 * 60 });
  return true;
}
