// Live check of the advisor Worker against the real Claude API. Not part of `npm test`.
// Run: npm run serve (in another shell), then
//   ANTHROPIC_API_KEY=... NODE_USE_ENV_PROXY=1 npx vitest run tests/live --testTimeout 600000
// Costs real money (a few cents per question). Skipped when no key is set.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import worker, { type Env } from "../../workers/api-proxy";
import { buildDecisionBrief, rankNeighborhoods } from "../../src/engines/investmentDecisionEngine";

const KEY = process.env.ANTHROPIC_API_KEY;
const root = path.resolve(__dirname, "../..");
const FIPS = process.env.LIVE_FIPS || "48453";
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const QUESTIONS = (process.env.LIVE_QUESTIONS || [
  "Which neighborhood here should I look at first, and how far should I trust that ranking?",
  "What is the fair market rent for a two-bedroom in this county, and what state housing laws could let me add units to a single-family lot here? Say which are confirmed.",
  "Should light rail be built in this county? What would it cost per mile and what happens to home values near stations?",
].join("|")).split("|");

describe.skipIf(!KEY)("advisor, live", () => {
  it("answers real questions with grounded figures", async () => {
    const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `counties/bundle_${FIPS}.json.gz`))).toString("utf8"));
    const backtest = read("app/data/neighborhood_score_backtest.json");
    const ranked: any = rankNeighborhoods(bundle, { backtest, limit: 5 } as any);
    const first = (ranked.neighborhoods || ranked.ranked || ranked)[0];
    const brief = buildDecisionBrief(bundle, { blockGroupId: first?.id, top: 5 } as any, { backtest, underusedSites: read("app/data/underused_sites.json") } as any);
    const env: Env = {
      ANTHROPIC_API_KEY: KEY,
      SITE_DATA_BASE: process.env.SITE_DATA_BASE || "http://127.0.0.1:8080/city-pretty/app/data/",
      ADVISOR_MODEL: process.env.ADVISOR_MODEL,
      ADVISOR_EFFORT: process.env.ADVISOR_EFFORT,
    } as Env;
    const out: any[] = [];
    for (const question of QUESTIONS) {
      const t0 = Date.now();
      const res = await worker.fetch(new Request("https://worker.local/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://milessilverman.github.io" },
        body: JSON.stringify({ question, context: { county: { fips: FIPS }, decision_brief: brief }, history: [] }),
      }), env, {} as any);
      const body: any = await res.json();
      out.push({ question, status: res.status, seconds: Math.round((Date.now() - t0) / 1000), ...body });
    }
    fs.writeFileSync(process.env.LIVE_OUT || path.join(root, "tests/live/last-run.json"), JSON.stringify(out, null, 2));
    for (const r of out) expect(r.status, JSON.stringify(r).slice(0, 400)).toBe(200);
  });
});
