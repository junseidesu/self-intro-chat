import { validateChatRequest } from "./validate";

export interface Env {
  ALLOWED_ORIGINS: string;
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

    // TODO(S1): ここで Claude API を呼ぶ。S0 では受け取った文をそのまま返す
    const last = result.messages[result.messages.length - 1];
    return json({ text: `受け取りました: ${last.content}` }, 200, cors);
  },
};
