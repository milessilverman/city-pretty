// Check rows of a data table against their primary source, using Claude to read the source and this script to
// check Claude's work. For each row that is not yet "verified", Claude fetches the official page (Anthropic's
// servers do the fetching, so sites that refuse this machine can still be read), and reports, per field, whether the
// source supports the value, with a verbatim quote. The script then confirms each quote really appears in the text
// that was fetched. A field counts as confirmed only when both agree. Nothing in app/data is changed: results go to
// research/ai_verification/ for review (see --apply in the summary it prints).
//
//   ANTHROPIC_API_KEY=... node scripts/ai_verify_sources.mjs statutes --limit 3
//   ... funding_programs | state_finance_profiles      --ids id1,id2      --all (include verified rows)
// Costs real money: roughly 10 to 60 cents a row, printed at the end from the API's own token counts.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

// Node's fetch ignores HTTPS_PROXY unless told; re-run once with the flag when a proxy is set.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status ?? 1);
}
const { default: Anthropic } = await import("@anthropic-ai/sdk");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const table = args.find((a) => !a.startsWith("--")) || "statutes";
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const limit = Number(opt("--limit") || 0);
const ids = (opt("--ids") || "").split(",").filter(Boolean);
const MODEL = process.env.VERIFY_MODEL || "claude-opus-5-5";
const PRICES = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] }; // USD per million tokens, in / out

const file = path.join(root, "app/data", `${table}.json`);
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = Array.isArray(raw) ? raw : raw.rows || Object.values(raw);
const idOf = (r, i) => String(r.id || r.state_code || r.fips || r.bill_number || i);
let todo = rows.map((r, i) => ({ r, id: idOf(r, i) }))
  .filter(({ r, id }) => (ids.length ? ids.includes(id) : args.includes("--all") || r.verification?.status !== "verified"));
if (limit) todo = todo.slice(0, limit);
if (!todo.length) { console.log("Nothing to check."); process.exit(0); }

const SYSTEM = [
  "You check one record of a real-estate data table against its primary source. People will act on this record, so be strict.",
  "Use the web_fetch tool to read the record's own source URL. If that page fails or does not contain the text of the law or programme, use web_search to find the official page (the legislature's or agency's own site, or the official code publisher) and fetch that. Do not rely on news articles, law-firm summaries or Wikipedia as evidence; they may only point you to the official page.",
  "Check every field that states a fact about the world: citation, enactment status, dates, thresholds, amounts, shares, eligibility conditions, exclusions. Skip bookkeeping fields (id, verification, retrieved, last_verified).",
  "For each field give: the record's value, what the source says, and whether the source supports it. Quote the source verbatim, at most 300 characters, copied exactly from the fetched page with no ellipses and no edits, and give the URL it came from. If you cannot find it on an official page, say unknown. Never answer from memory.",
  "Finish with one JSON object in a ```json fence, and nothing after it: {\"source_reached\": true|false, \"official_url\": string|null, \"fields\": [{\"field\": string, \"record_value\": any, \"source_value\": any, \"supported\": \"yes\"|\"no\"|\"unknown\", \"quote\": string|null, \"quote_url\": string|null, \"note\": string|null}], \"summary\": string}",
].join("\n");

const client = new Anthropic();
const norm = (s) => String(s || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
const collectText = (node, out) => {
  if (node == null) return;
  if (typeof node === "string") { out.push(node); return; }
  if (Array.isArray(node)) { for (const n of node) collectText(n, out); return; }
  if (typeof node === "object") for (const v of Object.values(node)) collectText(v, out);
};

const outDir = path.join(root, "research/ai_verification");
fs.mkdirSync(outDir, { recursive: true });
const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
const summary = [];

for (const { r, id } of todo) {
  process.stdout.write(`${table}/${id} ... `);
  const messages = [{ role: "user", content: `Table: ${table}\nRecord:\n${JSON.stringify(r, null, 1)}` }];
  let final = null; const fetched = [];
  try {
    for (let turn = 0; turn < 4; turn++) {
      const msg = await client.messages.stream({
        model: MODEL, max_tokens: 16000,
        output_config: { effort: process.env.VERIFY_EFFORT || "medium" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 }, { type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages,
      }).finalMessage();
      usage.in += msg.usage.input_tokens; usage.out += msg.usage.output_tokens;
      usage.cacheRead += msg.usage.cache_read_input_tokens || 0; usage.cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      for (const b of msg.content) if (b.type !== "text" && b.type !== "thinking" && b.type !== "server_tool_use") collectText(b, fetched);
      final = msg;
      if (msg.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: msg.content });
    }
  } catch (e) {
    console.log("failed: " + (e?.message || e)); summary.push({ id, error: String(e?.message || e) }); continue;
  }
  const text = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const m = text.match(/```json\s*([\s\S]*?)```\s*$/) || text.match(/```json\s*([\s\S]*?)```/);
  let result = null;
  try { result = m ? JSON.parse(m[1]) : null; } catch { result = null; }
  if (!result) { console.log(`no usable answer (stop_reason ${final.stop_reason})`); summary.push({ id, error: "no JSON answer" }); fs.writeFileSync(path.join(outDir, `${table}-${id}.raw.txt`), text); continue; }
  const haystack = norm(fetched.join("\n"));
  for (const f of result.fields || []) {
    // The script's own check: the quote must literally appear in what was fetched.
    f.quote_found_in_fetched_text = !!f.quote && haystack.includes(norm(f.quote));
    f.confirmed = f.supported === "yes" && f.quote_found_in_fetched_text;
    f.contradicted = f.supported === "no" && f.quote_found_in_fetched_text;
  }
  const n = (k) => (result.fields || []).filter((f) => f[k]).length;
  const row = { id, source_reached: !!result.source_reached, official_url: result.official_url || null, fields: (result.fields || []).length, confirmed: n("confirmed"), contradicted: n("contradicted"), quote_not_matched: (result.fields || []).filter((f) => f.quote && !f.quote_found_in_fetched_text).length };
  summary.push(row);
  fs.writeFileSync(path.join(outDir, `${table}-${id}.json`), JSON.stringify({ table, id, checked: new Date().toISOString().slice(0, 10), model: final.model, record_before: r, ...result }, null, 2));
  console.log(`${row.confirmed} confirmed, ${row.contradicted} contradicted, ${row.fields - row.confirmed - row.contradicted} unknown (of ${row.fields})`);
}

const [pin, pout] = PRICES[MODEL] || [null, null];
const cost = pin == null ? null : (usage.in * pin + usage.cacheWrite * pin * 1.25 + usage.cacheRead * pin * 0.1 + usage.out * pout) / 1e6;
fs.writeFileSync(path.join(outDir, `${table}-summary.json`), JSON.stringify({ table, model: MODEL, rows: summary, usage, estimated_cost_usd: cost }, null, 2));
console.log(`\n${summary.length} rows. Tokens: ${usage.in} in, ${usage.out} out, ${usage.cacheRead} cached.` + (cost == null ? "" : ` About $${cost.toFixed(2)} (${(cost / summary.length).toFixed(2)} a row) at list prices; web searches are billed separately.`));
console.log(`Results: research/ai_verification/${table}-*.json. Nothing in app/data was changed.`);
