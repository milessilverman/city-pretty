// Read-only data tools for the AI advisor, and the grounding check on its replies.
//
// The Worker runs the tool loop itself (workers/api-proxy.ts). Every tool reads one of the site's own checked data
// tables from its public origin (static JSON under app/data/ on GitHub Pages; base URL = env.SITE_DATA_BASE) and
// returns rows as they are in the file, plus the row's `verification` block and a `source_url`. Nothing here writes
// anything, and the file names are fixed (a caller or the model cannot make the Worker fetch an arbitrary URL).

export interface ToolEnv {
  SITE_DATA_BASE?: string;
}

export const DEFAULT_SITE_DATA_BASE = "https://milessilverman.github.io/city-pretty/app/data/";

export interface ToolContext {
  env: ToolEnv;
  sources: Set<string>; // source URLs of rows returned to the model in this request
  used: string[]; // names of tools called, in order
  corpus: string[]; // text of every tool result (the grounding check reads it)
}

export function newToolContext(env: ToolEnv): ToolContext {
  return { env, sources: new Set(), used: [], corpus: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Fetching the data files (memory cache + Cache API when the runtime has it)
// ---------------------------------------------------------------------------------------------------------------
const MEMORY_TTL_MS = 60 * 60 * 1000;
const memory = new Map<string, { at: number; value: unknown }>();

const DATA_FILES = new Set([
  "statutes.json",
  "funding_programs.json",
  "hud_fair_market_rents.json",
  "unit_costs.json",
  "underused_sites.json",
  "transit_cost_benchmarks.json",
  "transit_value_effects.json",
  "research.json",
  "valuation_backtest_benchmarks.json",
  "neighborhood_score_backtest.json",
]);

function dataUrl(env: ToolEnv, file: string): string {
  if (!DATA_FILES.has(file) && !/^hud_safmr\/\d{5}\.json$/.test(file)) throw new Error("unknown data file");
  const base = (env.SITE_DATA_BASE || DEFAULT_SITE_DATA_BASE).replace(/\/*$/, "/");
  return base + file;
}

/** Returns parsed JSON, or null when the file does not exist (404). Throws on other failures. */
export async function fetchDataFile(env: ToolEnv, file: string): Promise<unknown> {
  const url = dataUrl(env, file);
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < MEMORY_TTL_MS) return hit.value;

  const edge = typeof caches !== "undefined" ? ((caches as unknown as { default?: Cache }).default ?? null) : null;
  if (edge) {
    try {
      const cached = await edge.match(url);
      if (cached) {
        const value = await cached.json();
        memory.set(url, { at: Date.now(), value });
        return value;
      }
    } catch { /* cache is an optimisation only */ }
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) { memory.set(url, { at: Date.now(), value: null }); return null; }
  if (!res.ok) throw new Error(`data file ${file} returned HTTP ${res.status}`);
  const text = await res.text();
  const value = JSON.parse(text);
  memory.set(url, { at: Date.now(), value });
  if (edge) {
    try { await edge.put(url, new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } })); } catch { /* ignore */ }
  }
  return value;
}

export function clearToolCache(): void { memory.clear(); }

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------
type Row = Record<string, unknown>;
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const rowsOf = (data: unknown): Row[] => {
  if (Array.isArray(data)) return data.filter(isObj);
  if (isObj(data) && Array.isArray(data.rows)) return (data.rows as unknown[]).filter(isObj);
  return [];
};
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const fipsOf = (v: unknown): string => { const x = s(v); return /^\d{5}$/.test(x) ? x : ""; };
const stateOf = (v: unknown): string => { const x = s(v).toUpperCase(); return /^[A-Z]{2}$/.test(x) ? x : ""; };

const URL_KEYS = ["source_url", "sourceUrl", "statute_url", "reference_url", "dataset_landing_url"];
function sourceUrlOf(row: Row): string | null {
  for (const k of URL_KEYS) { const v = s(row[k]); if (/^https?:\/\//.test(v)) return v; }
  const doi = s(row.doi) || s(row.study_doi);
  if (doi) return /^https?:\/\//.test(doi) ? doi : "https://doi.org/" + doi.replace(/^doi:\s*/i, "");
  const ver = row.verification;
  if (isObj(ver)) { const v = s(ver.evidence_url) || s(ver.url_fetched); if (/^https?:\/\//.test(v)) return v; }
  return null;
}

const MAX_ROWS = 20;
const MAX_RESULT_CHARS = 24_000;

interface ToolOutput { rows: Row[]; total: number; note?: string; extra?: Record<string, unknown> }

function finish(name: string, out: ToolOutput, ctx: ToolContext): string {
  let rows = out.rows.map((r) => {
    const o: Row = { ...r };
    if (!("verification" in o)) o.verification = null;
    const url = sourceUrlOf(r);
    o.source_url = url;
    return o;
  });
  let shown = Math.min(rows.length, MAX_ROWS);
  let body = "";
  for (;;) {
    rows = rows.slice(0, shown);
    body = JSON.stringify({ tool: name, total_matching_rows: out.total, rows_returned: rows.length, note: out.note ?? null, ...(out.extra ?? {}), rows });
    if (body.length <= MAX_RESULT_CHARS || shown <= 1) break;
    shown = Math.max(1, Math.floor(shown / 2));
  }
  for (const r of rows) { const u = r.source_url; if (typeof u === "string") ctx.sources.add(u); }
  ctx.corpus.push(body);
  return body;
}

const VERIFICATION_NOTE =
  "Each row carries a `verification` block. status partly/unverified (or unreachable) means the row was NOT confirmed against its source: say so and do not state its values as fact. Rows with `screening_estimate` set are model outputs, not measurements.";

// ---------------------------------------------------------------------------------------------------------------
// Tool definitions (what the model sees)
// ---------------------------------------------------------------------------------------------------------------
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
}

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolDefinition => ({
  name,
  description: `${description} ${VERIFICATION_NOTE}`,
  input_schema: { type: "object", properties, required, additionalProperties: false },
});
const FIPS = { type: "string", description: "5-digit county FIPS code, e.g. \"06037\"" };
const STATE = { type: "string", description: "2-letter state code, e.g. \"CA\"" };

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  tool("get_housing_laws", "State housing statutes the site has on file (by-right units, parking, height, transit-distance rules, citations) for one state.", { state: STATE }, ["state"]),
  tool("get_funding_programs", "Public funding programs that can pay for neighborhood improvements. Give a county FIPS and/or a state; federal programs are included with a state.", { fips: FIPS, state: STATE }, []),
  tool("get_fair_market_rent", "HUD Fair Market Rent rows for a county (0-4 bedroom, with fiscal year and source). With a zip code and a small-area county, also the zip-level figure.", { fips: FIPS, zip: { type: "string", description: "5-digit ZIP code (optional)" } }, ["fips"]),
  tool("get_unit_costs", "Public-agency unit prices for street and neighborhood improvements (sidewalk, street_tree, curb_ramp, protected_bike_lane and so on). Filter by item and/or state; many rows have a null price because the source could not be read.", { item: { type: "string", description: "item name such as street_tree or sidewalk (optional)" }, state: STATE }, []),
  tool("get_underused_sites", "Underused public or large-lot sites screened for housing in a county (acres, zoning, rail distance, potential homes). Potential homes and margin are screening estimates.", { fips: FIPS }, ["fips"]),
  tool("get_transit_cost_benchmarks", "Built and planned transit projects with cost per mile, from a fetched cost dataset. Filter by mode.", { mode: { type: "string", enum: ["brt", "commuter_rail", "heavy_rail", "light_rail", "regional_rail", "streetcar", "urban_rail", "any"] } }, ["mode"]),
  tool("get_transit_value_effects", "Published estimates of how stations change nearby property values, by mode and distance band. Filter by mode text such as \"light rail\" or \"bus rapid transit\", or \"any\".", { mode: { type: "string" } }, ["mode"]),
  tool("get_studies", "Peer-reviewed studies behind the site's improvement estimates (street trees, parks, bike lanes, transit, lighting, schools, solar). Search by topic words.", { topic: { type: "string", description: "words such as \"street trees\" or \"bike\"" } }, ["topic"]),
  tool("get_valuation_backtest", "How well the site's home-value estimate matched recorded sales in a county (sample size, error, whether estimates are withheld).", { fips: FIPS }, ["fips"]),
  tool("get_neighborhood_backtest", "Back-test of the neighborhood score against later tract price changes for a county, plus the study's headline and limitations.", { fips: FIPS }, ["fips"]),
];

// ---------------------------------------------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------------------------------------------
type Input = Record<string, unknown>;

async function getHousingLaws(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const state = stateOf(i.state);
  if (!state) throw new Error("state must be a 2-letter code");
  const rows = rowsOf(await fetchDataFile(ctx.env, "statutes.json")).filter((r) => s(r.state_code).toUpperCase() === state);
  return { rows, total: rows.length, note: rows.length ? undefined : `No statute rows on file for ${state}. Do not guess; say the site has none.` };
}

async function getFundingPrograms(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const fips = fipsOf(i.fips);
  const state = stateOf(i.state);
  if (!fips && !state) throw new Error("give fips or state");
  const all = rowsOf(await fetchDataFile(ctx.env, "funding_programs.json"));
  const rows = all.filter((r) => {
    const j = s(r.jurisdiction_fips);
    if (fips && j === fips) return true;
    const id = s(r.id).toLowerCase();
    if (state && (id.startsWith(state.toLowerCase() + "_") || (j && j.startsWith(stateFipsPrefix(state))))) return true;
    if (state && id.startsWith("federal_")) return true;
    return false;
  });
  return { rows, total: rows.length, note: rows.length ? undefined : "No funding programs on file for that place." };
}

const STATE_FIPS: Record<string, string> = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" };
const stateFipsPrefix = (st: string) => STATE_FIPS[st] ?? "??";

async function getFairMarketRent(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const fips = fipsOf(i.fips);
  if (!fips) throw new Error("fips must be 5 digits");
  const rows = rowsOf(await fetchDataFile(ctx.env, "hud_fair_market_rents.json")).filter((r) => s(r.fips) === fips);
  const zip = s(i.zip);
  const extra: Record<string, unknown> = {};
  if (zip) {
    if (!/^\d{5}$/.test(zip)) throw new Error("zip must be 5 digits");
    const saf = await fetchDataFile(ctx.env, `hud_safmr/${fips}.json`);
    const entry = isObj(saf) ? saf[zip] : undefined;
    if (Array.isArray(entry)) {
      extra.zip_fmr = {
        zip,
        bedrooms_0_to_4: entry,
        order: ["0br", "1br", "2br", "3br", "4br"],
        fiscal_year: rows[0]?.fiscal_year ?? null,
        source_url: s(rows[0]?.source_url) || null,
        verification: "not recorded in the file; treat as unconfirmed",
      };
    } else {
      extra.zip_fmr = null;
      extra.zip_note = saf === null ? "No zip-level file for this county." : `ZIP ${zip} is not in this county's zip-level file.`;
    }
  }
  return { rows, total: rows.length, extra, note: rows.length ? undefined : "No Fair Market Rent row on file for that county." };
}

async function getUnitCosts(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const item = s(i.item).toLowerCase();
  const state = stateOf(i.state);
  const rows = rowsOf(await fetchDataFile(ctx.env, "unit_costs.json")).filter((r) => (!item || s(r.item).toLowerCase() === item) && (!state || s(r.state).toUpperCase() === state));
  return { rows, total: rows.length, note: rows.length ? "A null unit_price means no price was confirmed from the source." : "No unit-cost rows match." };
}

async function getUnderusedSites(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const fips = fipsOf(i.fips);
  if (!fips) throw new Error("fips must be 5 digits");
  const rows = rowsOf(await fetchDataFile(ctx.env, "underused_sites.json"))
    .filter((r) => s(r.countyFips) === fips)
    .sort((a, b) => (Number(b.acres) || 0) - (Number(a.acres) || 0));
  return { rows, total: rows.length, note: rows.length ? "Largest sites first. potentialHomes and margin are screening estimates." : "No sites on file for that county." };
}

const matchText = (hay: unknown, needle: string) => s(hay).toLowerCase().includes(needle);

async function getTransitCostBenchmarks(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const mode = s(i.mode).toLowerCase();
  const rows = rowsOf(await fetchDataFile(ctx.env, "transit_cost_benchmarks.json")).filter((r) => !mode || mode === "any" || s(r.mode).toLowerCase() === mode);
  return { rows, total: rows.length };
}

async function getTransitValueEffects(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const mode = s(i.mode).toLowerCase();
  const rows = rowsOf(await fetchDataFile(ctx.env, "transit_value_effects.json")).filter((r) => !mode || mode === "any" || matchText(r.mode, mode) || mode.split(/\s+/).every((w) => matchText(r.mode, w)));
  return { rows, total: rows.length, note: rows.length ? "effect_pct is the published estimate for that setting, not a forecast for another place." : "No rows for that mode." };
}

async function getStudies(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const words = s(i.topic).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) throw new Error("give a topic");
  const scored = rowsOf(await fetchDataFile(ctx.env, "research.json"))
    .map((r) => {
      const hay = [r.category, r.title, r.impact, r.takeaway, r.geography].map(s).join(" ").toLowerCase();
      return { r, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return { rows: scored.map((x) => x.r), total: scored.length };
}

async function getValuationBacktest(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const fips = fipsOf(i.fips);
  if (!fips) throw new Error("fips must be 5 digits");
  const data = await fetchDataFile(ctx.env, "valuation_backtest_benchmarks.json");
  let rows: Row[] = [];
  if (Array.isArray(data)) rows = data.filter(isObj).filter((r) => s(r.countyFips) === fips);
  else if (isObj(data)) {
    const hit = data[fips];
    if (isObj(hit)) rows = [hit];
    else rows = rowsOf(data).filter((r) => s(r.countyFips) === fips);
  }
  return { rows, total: rows.length, note: rows.length ? "A small sampleCount means the error figures are weak evidence. If withhold is true the page gives no home-value estimate for that county." : "No valuation back-test for that county; the site has not tested its estimate there." };
}

async function getNeighborhoodBacktest(i: Input, ctx: ToolContext): Promise<ToolOutput> {
  const fips = fipsOf(i.fips);
  if (!fips) throw new Error("fips must be 5 digits");
  const data = await fetchDataFile(ctx.env, "neighborhood_score_backtest.json");
  if (!isObj(data)) return { rows: [], total: 0, note: "Back-test file unavailable." };
  const perMetro = Array.isArray(data.per_metro) ? (data.per_metro as unknown[]).filter(isObj) : [];
  const rows = perMetro.filter((r) => s(r.fips) === fips).map((r) => ({ ...r, source_url: sourceFromSources(data) }));
  return {
    rows,
    total: rows.length,
    note: rows.length ? undefined : "That county is not in the back-test sample.",
    extra: { question: data.question ?? null, headline: data.headline ?? null, limitations: data.limitations ?? null, verdict: data.verdict ?? null },
  };
}

function sourceFromSources(data: Row): string | null {
  const src = data.sources;
  const first = Array.isArray(src) ? src[0] : src;
  if (typeof first === "string" && /^https?:\/\//.test(first)) return first;
  if (isObj(first)) return sourceUrlOf(first) || (/^https?:\/\//.test(s(first.url)) ? s(first.url) : null);
  return null;
}

const IMPLEMENTATIONS: Record<string, (i: Input, ctx: ToolContext) => Promise<ToolOutput>> = {
  get_housing_laws: getHousingLaws,
  get_funding_programs: getFundingPrograms,
  get_fair_market_rent: getFairMarketRent,
  get_unit_costs: getUnitCosts,
  get_underused_sites: getUnderusedSites,
  get_transit_cost_benchmarks: getTransitCostBenchmarks,
  get_transit_value_effects: getTransitValueEffects,
  get_studies: getStudies,
  get_valuation_backtest: getValuationBacktest,
  get_neighborhood_backtest: getNeighborhoodBacktest,
};

/** Runs one tool call. Never throws: failures come back as an error result the model can read. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<{ content: string; isError: boolean }> {
  const impl = IMPLEMENTATIONS[name];
  if (!impl) return { content: `Unknown tool ${name}`, isError: true };
  ctx.used.push(name);
  try {
    const out = await impl(isObj(input) ? input : {}, ctx);
    return { content: finish(name, out, ctx), isError: false };
  } catch (err) {
    return { content: `Tool ${name} failed: ${err instanceof Error ? err.message : "error"}. Say the data could not be read; do not guess.`, isError: true };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Grounding check
//
// Every dollar amount, percentage and number with a unit in the reply must appear in the supplied text (page data,
// the user's own words) or a tool result of this request, after allowing for rounding and simple scaling, or be the
// result of arithmetic written out in the reply ("$1,200 + $300 = $1,500"). Small whole numbers with a unit (10 or
// fewer, "3 units") and 0% / 100% are not checked: they are usually counts or figures of speech.
// ---------------------------------------------------------------------------------------------------------------
export interface Figure { raw: string; value: number; kind: "usd" | "pct" | "unit"; half: number }
export interface Grounding { ok: boolean; unverified_figures: string[] }

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const SCALE_WORDS = String.raw`thousand|million|billion|bn|k|m|b`;
const UNIT_WORDS = String.raw`miles?|mi|acres?|minutes?|mins?|years?|yrs?|days?|months?|units|homes|households|parcels|sq\.?\s?ft|square\s+feet|sqft|feet|ft|tons|bedrooms?|stories|spaces|lots|sites|stations|residents|people|jobs`;
const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

function numberWithHalf(numText: string, scaleWord: string | undefined): { value: number; half: number } {
  const clean = numText.replace(/,/g, "");
  const mult = scaleWord ? SCALE[scaleWord.toLowerCase()] ?? 1 : 1;
  const dot = clean.indexOf(".");
  const decimals = dot < 0 ? 0 : clean.length - dot - 1;
  const base = parseFloat(clean);
  let half = 0.5 * Math.pow(10, -decimals) * mult;
  if (!scaleWord && decimals === 0 && base >= 1000) {
    const zeros = (clean.match(/0+$/) || [""])[0].length;
    half = 0.5 * Math.pow(10, zeros);
  }
  return { value: base * mult, half };
}

function prepare(text: string): string {
  return text.replace(/https?:\/\/\S+/g, " ").replace(/\*\*/g, "").replace(/[−–]/g, "-");
}

export function extractFigures(replyText: string): Figure[] {
  const text = prepare(replyText);
  const taken: Array<[number, number]> = [];
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x);
  const out: Figure[] = [];
  const add = (m: RegExpExecArray, kind: Figure["kind"], numText: string, scale?: string) => {
    const a = m.index, b = a + m[0].length;
    if (!free(a, b)) return;
    taken.push([a, b]);
    const { value, half } = numberWithHalf(numText, scale);
    out.push({ raw: m[0].trim(), value, kind, half });
  };
  const usd = new RegExp(String.raw`\$\s?(${NUM})(?:\s?(${SCALE_WORDS})\b)?`, "gi");
  for (let m; (m = usd.exec(text)); ) add(m, "usd", m[1], m[2]);
  const pct = new RegExp(String.raw`(${NUM})\s?(?:%|percent\b)`, "gi");
  for (let m; (m = pct.exec(text)); ) { const v = parseFloat(m[1].replace(/,/g, "")); if (v === 0 || v === 100) { taken.push([m.index, m.index + m[0].length]); continue; } add(m, "pct", m[1]); }
  const unit = new RegExp(String.raw`(?<![\w$.])(${NUM})(?:\s?(thousand|million|billion))?\s?(?:${UNIT_WORDS})\b`, "gi");
  for (let m; (m = unit.exec(text)); ) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isInteger(v) && v <= 10 && !m[2]) continue;
    add(m, "unit", m[1], m[2]);
  }
  return out;
}

function numbersIn(texts: string[]): number[] {
  const nums: number[] = [];
  const re = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
  for (const t of texts) for (let m; (m = re.exec(t)); ) { const v = parseFloat(m[0].replace(/,/g, "")); if (Number.isFinite(v)) nums.push(v); }
  return nums;
}

const OPERAND = String.raw`\$?\s?(?:${NUM})(?:\s?%|\s?(?:${SCALE_WORDS})\b)?`;
const ARITH = new RegExp(String.raw`(${OPERAND}(?:\s*[+*x×/÷-]\s*${OPERAND})+)\s*(?:=|equals)\s*(${OPERAND})`, "gi");

function operandValue(t: string): { value: number; half: number } {
  const m = t.match(new RegExp(String.raw`(${NUM})(?:\s?%|\s?(${SCALE_WORDS})\b)?`, "i"));
  return m ? numberWithHalf(m[1], m[2]) : { value: NaN, half: 0 };
}

/** Figures the reply shows being computed: "a + b = c" (sums, products, or any two-term operation). */
function derivedFigures(replyText: string): Array<{ value: number; half: number }> {
  const text = prepare(replyText);
  const out: Array<{ value: number; half: number }> = [];
  for (let m; (m = ARITH.exec(text)); ) {
    const ops = (m[1].match(/(?<=[\d%\s])\s*[+*x×/÷-]\s*(?=\$?\s?\d)/gi) || []).map((o) => o.trim().toLowerCase());
    const vals = m[1].split(/\s*[+*x×/÷]\s*|\s+-\s+|(?<=\d)-(?=\$?\d)/i).map((p) => operandValue(p).value);
    if (!ops.length || vals.length !== ops.length + 1 || vals.some((v) => !Number.isFinite(v))) continue;
    let result: number | null = null;
    if (ops.every((o) => o === "+")) result = vals.reduce((a, b) => a + b, 0);
    else if (ops.every((o) => o === "*" || o === "x" || o === "×")) result = vals.reduce((a, b) => a * b, 1);
    else if (ops.length === 1) {
      const [a, b] = vals;
      result = ops[0] === "-" ? a - b : ops[0] === "/" || ops[0] === "÷" ? (b ? a / b : null) : null;
    }
    const target = operandValue(m[2]);
    if (result === null || !Number.isFinite(target.value)) continue;
    if (Math.abs(result - target.value) <= target.half + Math.abs(result) * 1e-9) out.push(target);
  }
  return out;
}

export function checkGrounding(replyText: string, suppliedTexts: string[]): Grounding {
  const figures = extractFigures(replyText);
  if (!figures.length) return { ok: true, unverified_figures: [] };
  const nums = numbersIn(suppliedTexts);
  const derived = derivedFigures(replyText);
  const eps = 1e-9;
  const near = (a: number, b: number, half: number) => Math.abs(a - b) <= half + eps;

  const bad: string[] = [];
  for (const f of figures) {
    let ok = nums.some((c) => near(c, f.value, f.half));
    if (!ok && f.kind === "pct") ok = nums.some((c) => near(c * 100, f.value, f.half));
    if (!ok && f.kind === "usd") ok = nums.some((c) => [1e3, 1e6, 1e9].some((k) => near(c * k, f.value, f.half)));
    if (!ok) ok = derived.some((d) => near(d.value, f.value, Math.max(f.half, d.half)));
    if (!ok && !bad.includes(f.raw)) bad.push(f.raw);
  }
  return { ok: bad.length === 0, unverified_figures: bad };
}
