// City Pretty's server side: a Cloudflare Worker the page calls for the AI advisor and Street View photos, so that
// API keys never reach the browser. Deploy with `wrangler deploy` (see wrangler.toml), then put the Worker's URL in
// app/config.js (workerUrl).
//
//   GET  /api/health      what is configured (the page shows "Connected" only when ai_advisor_ready is true)
//   POST /api/ai          { question, context, history } -> { ok: true, text } or { ok: false, error }
//   GET  /api/streetview  ?lat=&lng=&heading= -> a Street View photo
//
// Safety: only the site's own origins may call it, every route is rate limited, the model and the instructions are
// fixed here (a caller sends a question and page data, never a prompt or a model name), and input sizes are capped.

import { ADVISOR_SYSTEM_PROMPT, buildAdvisorUserMessage, sanitizeAdvisorContext } from "../src/ai/advisorGroundingContract";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ANTHROPIC_API_KEY?: string; // `wrangler secret put ANTHROPIC_API_KEY`
  GOOGLE_MAPS_KEY?: string; // `wrangler secret put GOOGLE_MAPS_KEY`
  AI_RATE_LIMITER?: RateLimiter; // [[ratelimits]] in wrangler.toml
  STREETVIEW_RATE_LIMITER?: RateLimiter;
}

// ---------------------------------------------------------------------------------------------------------------
// The model call. This is the one place to finish when the advisor is wired to Claude: send `system` and `messages`
// to the Claude Messages API with env.ANTHROPIC_API_KEY, return the reply's text, then set MODEL_CALL_IMPLEMENTED to
// true so /api/health reports the advisor as ready and the page shows "Connected".
//
//   system:   ADVISOR_SYSTEM_PROMPT (stable text, suitable for prompt caching)
//   messages: [{ role: "user" | "assistant", content: string }, ...], starting with "user" and ending with the
//             user's question plus the page data (buildAdvisorUserMessage)
// ---------------------------------------------------------------------------------------------------------------
const MODEL_CALL_IMPLEMENTED = false;
const ADVISOR_MODEL = "claude-opus-5-5";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ModelResult = { ok: true; text: string } | { ok: false; status: number; error: string };

async function askAdvisorModel(env: Env, system: string, messages: ChatMessage[]): Promise<ModelResult> {
  void env; void system; void messages; void ADVISOR_MODEL;
  return { ok: false, status: 501, error: "The AI advisor is not connected to a model yet" };
}

// ---------------------------------------------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  /^https:\/\/milessilverman\.github\.io$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/localhost:\d+$/,
];
const MAX_BODY_BYTES = 64_000;
const MAX_QUESTION_CHARS = 1_500;
const MAX_HISTORY_TURNS = 8;
const MAX_TURN_CHARS = 4_000;

const isAllowedOrigin = (origin: string | null) => !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin));

function originOf(request: Request): string | null {
  // fetch() sends Origin; an <img> load sends only Referer
  const origin = request.headers.get("Origin");
  if (origin) return origin;
  const referer = request.headers.get("Referer");
  try { return referer ? new URL(referer).origin : null; } catch { return null; }
}

function cors(origin: string | null): Record<string, string> {
  return isAllowedOrigin(origin)
    ? { "Access-Control-Allow-Origin": origin!, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" }
    : { Vary: "Origin" };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}

async function rateLimited(limiter: RateLimiter | undefined, request: Request): Promise<boolean> {
  if (!limiter) return false; // no binding configured (local dev)
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await limiter.limit({ key: ip });
  return !success;
}

function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .slice(-MAX_HISTORY_TURNS)
    .filter((m): m is { role: string; content: string } => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && !!m.content.trim())
    .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content.slice(0, MAX_TURN_CHARS) }));
  while (turns.length && turns[0].role !== "user") turns.shift(); // a conversation starts with the user
  return turns;
}

async function handleAdvisor(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405, origin);
  if (await rateLimited(env.AI_RATE_LIMITER, request)) return json({ ok: false, error: "Too many questions; try again in a minute" }, 429, origin);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "Request too large" }, 413, origin);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "Request is not JSON" }, 400, origin); }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : "";
  if (!question) return json({ ok: false, error: "No question" }, 400, origin);

  if (!env.ANTHROPIC_API_KEY || !MODEL_CALL_IMPLEMENTED) return json({ ok: false, error: "The AI advisor is not connected to a model yet" }, 503, origin);

  const context = sanitizeAdvisorContext(body.context);
  const messages: ChatMessage[] = [...cleanHistory(body.history), { role: "user", content: buildAdvisorUserMessage(question, context) }];
  const result = await askAdvisorModel(env, ADVISOR_SYSTEM_PROMPT, messages);
  if (!result.ok) return json({ ok: false, error: result.error }, result.status, origin);
  return json({ ok: true, text: result.text }, 200, origin);
}

async function handleStreetView(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (await rateLimited(env.STREETVIEW_RATE_LIMITER, request)) return json({ ok: false, error: "Too many requests" }, 429, origin);
  if (!env.GOOGLE_MAPS_KEY) return json({ ok: false, error: "Street View is not configured" }, 503, origin);
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const heading = Math.round(Number(url.searchParams.get("heading") ?? 0)) % 360;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(heading)) {
    return json({ ok: false, error: "lat, lng and heading must be numbers" }, 400, origin);
  }
  const upstream = new URL("https://maps.googleapis.com/maps/api/streetview");
  upstream.search = new URLSearchParams({ size: "640x400", location: `${lat.toFixed(6)},${lng.toFixed(6)}`, heading: String(heading), pitch: "5", key: env.GOOGLE_MAPS_KEY }).toString();
  const res = await fetch(upstream.toString());
  if (!res.ok) return json({ ok: false, error: `Street View returned ${res.status}` }, 502, origin);
  return new Response(res.body, { headers: { "Content-Type": res.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=604800", ...cors(origin) } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = originOf(request);
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: isAllowedOrigin(origin) ? 204 : 403, headers: cors(origin) });

    if (pathname === "/api/health") {
      return json({
        status: "ok",
        ai_advisor_ready: Boolean(env.ANTHROPIC_API_KEY) && MODEL_CALL_IMPLEMENTED,
        streetview_ready: Boolean(env.GOOGLE_MAPS_KEY),
        rate_limited: Boolean(env.AI_RATE_LIMITER && env.STREETVIEW_RATE_LIMITER),
      }, 200, origin);
    }

    // Everything else only for the site's own pages
    if (!isAllowedOrigin(origin)) return json({ ok: false, error: "Forbidden origin" }, 403, origin);

    try {
      if (pathname === "/api/ai") return await handleAdvisor(request, env, origin);
      if (pathname === "/api/streetview") return await handleStreetView(request, env, origin);
    } catch (err) {
      console.error("worker error", err);
      return json({ ok: false, error: "Server error" }, 500, origin);
    }
    return json({ ok: false, error: "Not found" }, 404, origin);
  },
};
