// Runs the advisor against tests/eval/advisor_questions.json and scores it.
// Needs a real key: ANTHROPIC_API_KEY=... npm run eval:advisor   (optional CENSUS_API_KEY)
// Each question costs real API money (a few cents with Claude Opus 5.5); the full set is ~22 questions.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { runAdvisor } from "../workers/advisorAgent.ts";

const SYSTEM = "You are City Pretty's property and city-development advisor. Answer the user's question using your tools.";
const set = JSON.parse(fs.readFileSync(new URL("../tests/eval/advisor_questions.json", import.meta.url), "utf8"));
if (!process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY to run the eval."); process.exit(2); }
const client = new Anthropic();
let pass = 0;
const rows: string[] = [];
for (const q of set.questions) {
  const r = await runAdvisor(client, SYSTEM, [{ role: "user", content: q.question }], { censusApiKey: process.env.CENSUS_API_KEY });
  const text = r.ok ? r.text : `ERROR ${r.error}`;
  const low = text.toLowerCase();
  const hits = q.must_include.filter((s: string) => low.includes(s.toLowerCase()));
  let ok = q.match === "all" ? hits.length === q.must_include.length : hits.length > 0;
  if (q.must_cite) ok = ok && r.ok && r.sources.some((s) => (s.publisher + " " + s.name).includes(q.must_cite));
  if (q.must_not_include_unsourced_numbers) ok = ok && !/\$\s?\d/.test(text);
  if (ok) pass++;
  rows.push(`${ok ? "PASS" : "FAIL"}  ${q.id}  (${r.ok ? r.tool_rounds + " tool rounds, " + r.sources.length + " sources" : "error"})`);
  if (!ok) rows.push("      " + text.replace(/\s+/g, " ").slice(0, 300));
}
console.log(rows.join("\n"));
console.log(`\n${pass}/${set.questions.length} passed`);
process.exit(pass === set.questions.length ? 0 : 1);
