// City Pretty's server side: a Cloudflare Worker the page calls for the AI advisor and Street View photos, so that
// API keys never reach the browser. Deploy with `wrangler deploy` (see wrangler.toml), then put the Worker's URL in
// app/config.js (workerUrl).
//
//   GET  /api/health      what is configured (the page shows "Connected" only when ai_advisor_ready is true)
//   POST /api/ai          { question, context, history } -> { ok: true, text, grounding, sources, tools_used, model, usage }
//                         or { ok: false, error }. grounding is { ok, unverified_figures[] }; sources are URLs of the data rows used.
//   GET  /api/streetview  ?lat=&lng=&heading= -> a Street View photo
//
// Safety: only the site's own origins may call it, every route is rate limited, the model and the instructions are
// fixed here (a caller sends a question and page data, never a prompt or a model name), and input sizes are capped.

import { ADVISOR_SYSTEM_PROMPT, buildAdvisorUserMessage, sanitizeAdvisorContext } from "../src/ai/advisorGroundingContract";
import { TOOL_DEFINITIONS, checkGrounding, newToolContext, runTool, type Grounding } from "./advisorTools";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ANTHROPIC_API_KEY?: string; // `wrangler secret put ANTHROPIC_API_KEY`
  GOOGLE_MAPS_KEY?: string; // `wrangler secret put GOOGLE_MAPS_KEY`
  AI_RATE_LIMITER?: RateLimiter; // [[ratelimits]] in wrangler.toml
  STREETVIEW_RATE_LIMITER?: RateLimiter;
  ADVISOR_MODEL?: string; // [vars] in wrangler.toml; default claude-opus-5-5
  ADVISOR_EFFORT?: string; // low | medium | high | xhigh | max; default medium
  ADVISOR_FALLBACKS?: string; // "off" stops sending the server-side refusal fallback
  SITE_DATA_BASE?: string; // where the advisor's tools read the site's data tables
}

// ---------------------------------------------------------------------------------------------------------------
// The model call: the Claude Messages API over plain fetch (no SDK, no dependency).
//
//   system:   ADVISOR_SYSTEM_PROMPT, sent as a cached system block. The caller never supplies it.
//   messages: [{ role: "user" | "assistant", content: string }, ...], ending with the user's question plus the page data
//             (buildAdvisorUserMessage). The caller never supplies a model name either.
//   tools:    read-only lookups into the site's own data tables (workers/advisorTools.ts). The Worker runs the tool
//             loop itself, at most MAX_TOOL_ROUNDS rounds, then makes the model answer without tools.
//   result:   the reply text, a grounding check on its figures, and the source URLs of the rows it was shown.
// ---------------------------------------------------------------------------------------------------------------
const MODEL_CALL_IMPLEMENTED = true;
const DEFAULT_ADVISOR_MODEL = "claude-opus-5-5"; // override with the ADVISOR_MODEL var in wrangler.toml
const DEFAULT_EFFORT = "medium"; // override with ADVISOR_EFFORT (low | medium | high | xhigh | max)
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2026-10-21";
const MAX_OUTPUT_TOKENS = 4096; // thinking tokens count toward this; the page asks for short answers
const MAX_TOOL_ROUNDS = 6;
const CALL_TIMEOUT_MS = 60_000; // one request to the API
const TOTAL_BUDGET_MS = 110_000; // the whole question, tool rounds and the grounding retry included

type ChatMessage = { role: "user" | "assistant"; content: string };
type ApiBlock = { type: string; [key: string]: unknown };
type ApiMessage = { role: "user" | "assistant"; content: string | ApiBlock[] };
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number };
type ModelOk = { ok: true; text: string; grounding: Grounding; sources: string[]; tools_used: string[]; model: string; usage: Usage };
type ModelFail = { ok: false; status: number; error: string };
type ModelResult = ModelOk | ModelFail;

const fail = (status: number, error: string): ModelFail => ({ ok: false, status, error });

/** Turns an API failure into a plain message the page can show. Details go to the Worker log, not the visitor. */
export function mapApiError(status: number, body: unknown): ModelFail {
  const type = (body as { error?: { type?: string } } | null)?.error?.type ?? "";
  if (status === 401 || status === 403 || type === "authentication_error" || type === "permission_error") return fail(502, "The AI advisor could not sign in to the AI service. The site owner needs to check its API key.");
  if (status === 429 || type === "rate_limit_error") return fail(429, "The AI service is busy right now. Try again in a minute.");
  if (status === 529 || type === "overloaded_error" || status >= 500) return fail(503, "The AI service is overloaded right now. Try again shortly.");
  return fail(502, "The AI service could not take that question.");
}

const supportsFallbacks = (model: string) => /^claude-(opus-5-5|fable-|mythos-|sonnet-5-5)/.test(model);

async function callMessagesApi(env: Env, system: string, messages: ApiMessage[], noTools: boolean, deadline: number): Promise<{ ok: true; data: Record<string, unknown> } | ModelFail> {
  const model = env.ADVISOR_MODEL || DEFAULT_ADVISOR_MODEL;
  const remaining = deadline - Date.now();
  if (remaining < 1_000) return fail(504, "The AI advisor took too long. Try a shorter question.");
  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: { type: noTools ? "none" : "auto" },
    output_config: { effort: env.ADVISOR_EFFORT || DEFAULT_EFFORT },
  };
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY ?? "",
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (supportsFallbacks(model) && env.ADVISOR_FALLBACKS !== "off") {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.min(CALL_TIMEOUT_MS, remaining));
  try {
    const res = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      console.error("anthropic error", res.status, JSON.stringify(data).slice(0, 500));
      return mapApiError(res.status, data);
    }
    if (!data || typeof data !== "object") return fail(502, "The AI service returned an unreadable answer.");
    return { ok: true, data: data as Record<string, unknown> };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return fail(504, "The AI advisor took too long. Try a shorter question.");
    console.error("anthropic fetch failed", err);
    return fail(502, "The AI advisor could not reach the AI service.");
  } finally {
    clearTimeout(timer);
  }
}

async function askAdvisorModel(env: Env, system: string, messages: ChatMessage[]): Promise<ModelResult> {
  const model = env.ADVISOR_MODEL || DEFAULT_ADVISOR_MODEL;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const ctx = newToolContext(env);
  const convo: ApiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const supplied = messages.filter((m) => m.role === "user").map((m) => m.content); // page data + the visitor's own words
  const usage: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let rounds = 0;

  // One model turn sequence: call, run any tools, call again, until the model answers in text.
  const converse = async (): Promise<{ ok: true; text: string } | ModelFail> => {
    for (;;) {
      const noTools = rounds >= MAX_TOOL_ROUNDS;
      const r = await callMessagesApi(env, system, convo, noTools, deadline);
      if (!r.ok) return r;
      const data = r.data;
      const u = (data.usage ?? {}) as Partial<Usage>;
      for (const k of Object.keys(usage) as Array<keyof Usage>) usage[k] += Number(u[k]) || 0;
      const content = Array.isArray(data.content) ? (data.content as ApiBlock[]) : [];
      convo.push({ role: "assistant", content });

      if (data.stop_reason === "refusal") return fail(502, "The AI service declined to answer that question.");
      if (data.stop_reason === "tool_use") {
        if (noTools) return fail(502, "The AI advisor could not finish that question. Try asking it more simply.");
        const uses = content.filter((b) => b.type === "tool_use");
        if (!uses.length) return fail(502, "The AI service returned an unreadable answer.");
        rounds++;
        const results = await Promise.all(uses.map(async (u2) => {
          const out = await runTool(String(u2.name), u2.input, ctx);
          return { type: "tool_result", tool_use_id: u2.id, content: out.content, ...(out.isError ? { is_error: true } : {}) } as ApiBlock;
        }));
        convo.push({ role: "user", content: results });
        continue;
      }
      const text = content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("").trim();
      if (!text) return fail(502, "The AI service returned an empty answer.");
      return { ok: true, text };
    }
  };

  const first = await converse();
  if (!first.ok) return first;
  let text = first.text;
  let grounding = checkGrounding(text, [...supplied, ...ctx.corpus]);

  if (!grounding.ok) {
    convo.push({
      role: "user",
      content:
        `These figures in your reply were not found in the page data or in any tool result: ${grounding.unverified_figures.join(", ")}. ` +
        "Rewrite the answer without them, or look them up with a tool, or show the arithmetic using figures that are in the data. Do not add new figures.",
    });
    const second = await converse();
    if (second.ok) {
      text = second.text;
      grounding = checkGrounding(text, [...supplied, ...ctx.corpus]);
    } else {
      grounding = checkGrounding(text, [...supplied, ...ctx.corpus]); // keep the first reply, with its warning
    }
  }
  return { ok: true, text, grounding, sources: [...ctx.sources], tools_used: ctx.used, model, usage };
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
  return json({ ok: true, text: result.text, grounding: result.grounding, sources: result.sources, tools_used: result.tools_used, model: result.model, usage: result.usage }, 200, origin);
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
