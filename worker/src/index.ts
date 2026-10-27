import Anthropic from "@anthropic-ai/sdk";
import { RefusalError, streamClaude } from "./claude";
import { validateChatRequest } from "./validate";

export interface Env {
  ALLOWED_ORIGINS: string;
  // ローカルは .dev.vars、本番は `wrangler secret put` で設定する
  ANTHROPIC_API_KEY: string;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/chat") {
      return json({ error: "not_found" }, 404, {});
    }

    const origin = request.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    if (!allowed.includes(origin)) {
      return json({ error: "forbidden_origin" }, 403, {});
    }
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_request" }, 400, cors);
    }
    const result = validateChatRequest(body);
    if (!result.ok) {
      return json({ error: "invalid_request", reason: result.reason }, 400, cors);
    }

    // 回答は SSE で少しずつ返す。途中で失敗したら error イベントを送って閉じる
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (data: unknown) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

    ctx.waitUntil(
      (async () => {
        try {
          for await (const text of streamClaude(env.ANTHROPIC_API_KEY, result.messages)) {
            await send({ text });
          }
          await send({ done: true });
        } catch (err) {
          if (err instanceof RefusalError) {
            await send({ error: "refusal" });
          } else {
            // 詳細は Worker のログにだけ残し、ブラウザには種類だけ返す
            console.error(err instanceof Anthropic.APIError ? `Claude API ${err.status}: ${err.message}` : err);
            await send({ error: "upstream_error" });
          }
        } finally {
          await writer.close();
        }
      })(),
    );

    return new Response(readable, {
      headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  },
};
