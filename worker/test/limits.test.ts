import { describe, expect, it } from "vitest";
import { consumeDailyQuota, dailyKey } from "../src/limits";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as Pick<KVNamespace, "get" | "put"> & { store: Map<string, string> };
}

describe("dailyKey", () => {
  it("日本時間の日付を使う（UTC 15:00 で翌日に切り替わる）", () => {
    expect(dailyKey(new Date("2026-10-27T14:59:59Z"))).toBe("usage:2026-10-27");
    expect(dailyKey(new Date("2026-10-27T15:00:00Z"))).toBe("usage:2026-10-28");
  });
});

describe("consumeDailyQuota", () => {
  const now = new Date("2026-10-27T03:00:00Z");

  it("上限までは通し、上限に達したら弾く", async () => {
    const kv = fakeKv();
    expect(await consumeDailyQuota(kv, 2, now)).toBe(true);
    expect(await consumeDailyQuota(kv, 2, now)).toBe(true);
    expect(await consumeDailyQuota(kv, 2, now)).toBe(false);
    expect(kv.store.get("usage:2026-10-27")).toBe("2");
  });

  it("日付が変わると数え直す", async () => {
    const kv = fakeKv();
    await consumeDailyQuota(kv, 1, now);
    expect(await consumeDailyQuota(kv, 1, now)).toBe(false);
    expect(await consumeDailyQuota(kv, 1, new Date("2026-10-28T03:00:00Z"))).toBe(true);
  });
});
