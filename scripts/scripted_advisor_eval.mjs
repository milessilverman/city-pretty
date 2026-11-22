// Offline eval of the advisor's script-first layer (app/advisor-scripts.js). No model, no network.
//   1. tests/eval/advisor_scripted_cases.json: each case must be answered with the expected intent (and contain the
//      expected facts, resolved from the raw data files) or must hand off. A budget answer may list only plays whose
//      cost on file is at or under the budget.
//   2. tests/eval/advisor_questions.json (the model eval): the share of those questions the layer would answer itself
//      on a loaded county, and whether each such answer contains that question's expected facts.
// Run: npm run eval:advisor -- --scripted
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { nodeSnapshot, FIXTURE_LOTS, bundle } from "./lib/advisor_snapshot.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = require(path.join(root, "app/advisor-scripts.js"));
const E = require(path.join(root, "src/engines/investmentDecisionEngine.js"));
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

export const SNAPSHOTS = {
  travis: () => nodeSnapshot({ fips: "48453", bg: "default" }),
  travis_nohood: () => nodeSnapshot({ fips: "48453", bg: null }),
  travis_lot: () => nodeSnapshot({ fips: "48453", bg: "default", lot: FIXTURE_LOTS.travis_sf }),
  travis_nozone: () => nodeSnapshot({ fips: "48453", bg: "default", lot: FIXTURE_LOTS.nozone }),
  sutter_lot: () => nodeSnapshot({ fips: "06101", bg: "default", lot: FIXTURE_LOTS.sutter_sf }),
  la: () => nodeSnapshot({ fips: "06037" }),
};

// Expected facts read straight from the data files, not from the snapshot the layer answers from
const money = v => "$" + Math.round(v).toLocaleString("en-US");
export function resolveToken(text) { return String(text).replace(/\{\w+:[^}]*\}/g, resolveOne); }
function resolveOne(tok) {
  const m = tok.match(/^\{(\w+):([^}]*)\}$/);
  if (!m) return tok;
  const [kind, rest] = [m[1], m[2].split(":")];
  const mul = x => { const k = String(x).split("*"); return { key: k[0], n: k[1] ? +k[1] : 1 }; };
  if (kind === "bg" || kind === "bgraw") {
    const B = bundle(rest[0]), { key, n } = mul(rest[1]);
    const v = B.details[B.meta.default_bg].m[key] * n;
    return kind === "bg" ? money(v) : (Number.isInteger(v) ? v.toLocaleString("en-US") : String(v));
  }
  if (kind === "hud") {
    const r = json("app/data/hud_fair_market_rents.json").records.find(x => x.fips === rest[0]);
    const { key, n } = mul(rest[1]);
    return money(r[["zero_bed_eff", "one_bed_1br", "two_bed_2br", "three_bed_3br", "four_bed_4br"][+key]] * n);
  }
  if (kind === "sites") return String(json("app/data/underused_sites.json").filter(s => s.countyFips === rest[0]).length);
  if (kind === "top1") {
    const rk = E.rankNeighborhoods(bundle(rest[0]), { backtest: json("app/data/neighborhood_score_backtest.json") });
    return rk.ranked.filter(r => !r.dataFlags.length)[0].name;
  }
  throw new Error("unknown token " + tok);
}

export async function runScriptedEval({ quiet = false } = {}) {
  const snaps = {};
  const snap = k => snaps[k] || (snaps[k] = SNAPSHOTS[k]());
  const log = (...a) => { if (!quiet) console.log(...a); };
  let wrong = 0, pass = 0;
  const cases = json("tests/eval/advisor_scripted_cases.json").cases;
  const byIntent = {};
  for (const c of cases) {
    const r = S.route(c.question, snap(c.snapshot));
    const problems = [];
    if (c.expect === "handoff") { if (r.answered) problems.push(`answered (${r.intent}) but must hand off`); }
    else {
      if (!r.answered) problems.push(`handed off (${r.reason})`);
      else {
        if (r.intent !== c.expect) problems.push(`intent ${r.intent}, expected ${c.expect}`);
        for (const t of c.must_include || []) { const want = resolveToken(t); if (!r.text.includes(want)) problems.push(`missing "${want}"`); }
        for (const t of c.must_not_include || []) if (r.text.includes(t)) problems.push(`contains "${t}"`);
        if (!r.text.includes(S.NO_AI_LINE)) problems.push("no 'answered without the AI' line");
        if (r.intent === "budget") { const b = S.parseBudget(c.question); for (const x of r.matched || []) if (!(x.cost <= b)) problems.push(`lists ${x.name} at ${x.cost}, over the budget`); }
      }
    }
    const ok = !problems.length;
    if (ok) pass++; else if (r.answered) wrong++;
    (byIntent[c.expect] = byIntent[c.expect] || [0, 0])[ok ? 0 : 1]++;
    log(`${ok ? "PASS" : "FAIL"}  ${c.id}  ${r.answered ? "answered " + r.intent : "handoff: " + r.reason}${ok ? "" : "  <- " + problems.join("; ")}`);
  }
  log(`\nScripted cases: ${pass}/${cases.length} passed; wrong scripted answers (answered when it should not, or answered wrongly): ${wrong}`);
  log("By expected outcome: " + Object.entries(byIntent).map(([k, [p, f]]) => `${k} ${p}/${p + f}`).join(", "));

  // the model eval's questions, on a loaded county with and without an open lot
  const qs = json("tests/eval/advisor_questions.json").questions;
  let answered = 0, factOk = 0, factBad = 0;
  for (const q of qs) {
    const rs = ["travis", "travis_lot"].map(k => S.route(q.question, snap(k)));
    const hit = rs.find(r => r.answered);
    if (!hit) continue;
    answered++;
    const low = hit.text.toLowerCase(), hits = q.must_include.filter(x => low.includes(String(x).toLowerCase()));
    const ok = q.match === "all" ? hits.length === q.must_include.length : hits.length > 0;
    if (ok) factOk++; else factBad++;
    log(`  model-eval question answered by the page: ${q.id} (${hit.intent}) ${ok ? "matches" : "DOES NOT match"} its expected facts`);
  }
  log(`Model eval questions answered without the model: ${answered}/${qs.length} (${(100 * answered / qs.length).toFixed(1)}%); of those, ${factOk} match the expected facts and ${factBad} do not.`);
  return wrong === 0 && factBad === 0 && pass === cases.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(await runScriptedEval());
