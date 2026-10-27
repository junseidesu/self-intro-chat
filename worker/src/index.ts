import Anthropic from "@anthropic-ai/sdk";
import { askClaude } from "./claude";
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
  async fetch(request: Request, env: Env): Promise<Response> {
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

    try {
      const text = await askClaude(env.ANTHROPIC_API_KEY, result.messages);
      return json({ text }, 200, cors);
    } catch (err) {
      // 詳細は Worker のログにだけ残し、ブラウザには種類だけ返す
      console.error(err instanceof Anthropic.APIError ? `Claude API ${err.status}: ${err.message}` : err);
      return json({ error: "upstream_error" }, 502, cors);
    }
  },
};
