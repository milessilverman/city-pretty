// Script-first answers for the AI advisor chat: questions that are plainly one of a fixed set are answered from the
// data already on the page (no network, no model, no cost). Everything else goes to the Worker as before, with what
// this layer found attached as context.scripted_findings (docs/ADVISOR-ROUTING.md).
//
// The matcher is deliberately narrow: plain keyword and pattern rules, and a hand-off whenever a question asks why,
// compares, asks "should I", names another place or an address, has a time horizon or a strategy, or quotes a
// document. A wrong scripted answer is worse than a hand-off.
//
// Two parts:
//   - the core (route, matchIntent, answerIntent, parseBudget): pure functions over a "snapshot" of page data, so the
//     unit tests and the offline eval (npm run eval:advisor -- --scripted) run it in Node;
//   - the page glue (pageSnapshot, tryScripted): reads app.js's globals and the Invest view's inputs
//     (cpInvest.advisorInputs in app/invest.js) and the decision engine (src/engines/investmentDecisionEngine.js).
// Every figure keeps the basis tag the panels use (measured / modelled / assumed) and its source; a figure the page
// does not have is "Not on file" with the reason, exactly as the panels withhold it.
(function () {
"use strict";

const NO_AI_LINE = "Answered from this page's data without the AI.";
const MAX_FINDINGS_CHARS = 4000;   // must stay within SCRIPTED_FINDINGS_MAX_CHARS in src/ai/advisorGroundingContract.ts

// ---------------------------------------------------------------- formatting
const isNum = v => typeof v === "number" && isFinite(v);
const money = v => (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
const tag = b => b ? ` [${b}]` : "";
const BASIS_NOTE = "Tags: [measured] read from a cited table or record; [modelled] computed from measured inputs; [assumed] no evidence behind it.";
function fmtTV(t) {
  const v = t.value, u = String(t.unit || "");
  if (/per USD spent|USD per USD/.test(u)) return "$" + v.toFixed(2) + " back per $1";
  if (/^USD per mile/.test(u)) return money(v) + " per mile";
  if (/^USD per trip/.test(u)) return "$" + v.toFixed(2) + " per trip";
  if (/^USD/.test(u)) return money(v);
  if (/^%/.test(u)) return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
  if (/^homes$/.test(u)) return Math.round(v).toLocaleString("en-US") + " homes";
  if (/^acres$/.test(u)) return v.toFixed(1) + " acres";
  if (/dwelling units per net acre/.test(u)) return v.toFixed(1) + " homes per net acre";
  return String(Math.round(v * 1000) / 1000) + (u ? " " + u : "");
}
// { value, unit, source, basis } -> "figure [basis]"; null -> Not on file (reason)
const fig = (t, why) => (t && isNum(t.value)) ? fmtTV(t) + tag(t.basis) : "Not on file" + (why ? ` (${why})` : "");
const urlIn = s => { const m = String(s || "").match(/https?:\/\/[^\s;,)"]+/); return m ? m[0] : null; };
function addSource(list, name, url) {
  if (!name && !url) return;
  const key = url || name;
  if (!list.some(s => (s.url || s.name) === key)) list.push({ name: name || url, url: url || null });
}
const VERDICT_TXT = { build: "Build", do_not_build: "Do not build at this scale", screen_only: "Screen only, no build decision", not_enough_data: "Not enough data to say" };
const SCALE_TXT = { bus_frequency: "more frequent buses", brt: "bus rapid transit (BRT)", light_rail: "light rail", heavy_rail: "heavy rail or metro", commuter_rail: "commuter or regional rail", hsr: "high-speed rail" };

// ---------------------------------------------------------------- parsing
const WORDNUM = { zero: 0, studio: 0, efficiency: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// "$50k", "$1.5 million", "$250,000", "300 thousand dollars", "2m dollars". Returns null unless the text clearly names
// an amount of money (a "$" sign, or the word dollars).
function parseBudget(q) {
  const s = String(q || "").toLowerCase().replace(/,(?=\d{3}\b)/g, "");
  const mult = u => !u ? 1 : /^(k|thousand)$/.test(u) ? 1e3 : /^(m|mm|mil|million)$/.test(u) ? 1e6 : /^(b|bn|billion)$/.test(u) ? 1e9 : null;
  let m = s.match(/\$\s?(\d+(?:\.\d+)?)\s*(k|thousand|mm|mil|million|m|bn|billion|b)?\b/);
  if (!m) m = s.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|mm|mil|million|m|bn|billion|b)?\s*(?:usd|dollars)\b/);
  if (!m) return null;
  const k = mult(m[2]);
  const v = parseFloat(m[1]) * (k == null ? NaN : k);
  return isNum(v) && v > 0 ? v : null;
}
// all money amounts and plain numbers in the text (to refuse questions with more than one amount)
const countAmounts = q => (String(q || "").replace(/,(?=\d{3}\b)/g, "").match(/\$\s?\d+(?:\.\d+)?/g) || []).length;

const STATES = ["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming", "district of columbia"];
const STATE_RE = new RegExp("\\b(" + STATES.join("|") + ")\\b", "i");
const STREET_RE = /\b\d{1,6}\s+(?:[nsew]\.?\s+)?[a-z0-9.']+(?:\s+[a-z0-9.']+){0,3}\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|pl|place|ct|court|cir|circle|trl|trail|pkwy|parkway|hwy|highway|ter|terrace)\b/i;

// Why a question must go to the model (null when none of the hand-off rules fires)
function handoffReason(raw) {
  const q = String(raw || "").trim();
  const s = q.toLowerCase();
  if (!q) return "empty question";
  if (q.length > 220) return "long question or quoted text";
  if ((q.match(/\?/g) || []).length > 1) return "more than one question";
  if (/["“”«»]|```|\b(attached|attachment|upload(ed)?|pasted|this (document|pdf|listing|report|file|email|letter|contract|appraisal))\b|:\s*\S.{40,}/i.test(q)) return "quotes or refers to a document";
  if (/\bwhy\b|\bhow come\b/.test(s)) return "asks why";
  if (/\bcompar|\bversus\b|\bvs\.?\b|better than|worse than|cheaper than|difference between|\brather than\b|\binstead of\b/.test(s)) return "asks for a comparison";
  if (/\b(in|over|within|next|after|for)\s+(the\s+)?(next\s+)?(\d+|a|one|two|three|four|five|ten|few|several|coming)\s+(years?|months?|decades?)\b|\b(by|in|until|before)\s+20\d\d\b|\bforecast|\bpredict|\bprojection|\bfuture\b|\blong[- ]term|\bshort[- ]term|\bwill (it|they|the|prices?|values?|rents?|this|that)\b|\bgoing to\b|\bappreciat|\bgrowth\b|\btrend/.test(s)) return "has a time horizon";
  if (/\bstrateg|\bplan\b|\bportfolio|\bmaximi[sz]|\boptimi[sz]|\broi\b|\breturns?\b|\byield|\bcash ?flow|\bprofit|\bfinanc|\bmortgage|\bloan|\btax(es)?\b|\bflip|\bexit\b|\bbest\b|\bworth it\b|\bgood (idea|deal|investment)|(?<!flood )\brisk(y|s)?\b|\bpayback|\bbreak[- ]even|\bwhat if\b|\bassum|\bif i\b|\bshould (i|we) (buy|sell|rent|wait|hold)/.test(s)) return "asks about a strategy or a judgment";
  if (/\bshould (i|we)\b/.test(s) && !SHOULD_I_OK.some(re => re.test(s))) return "asks \"should I\"";
  if (/\b(sb|ab|hb|ls|lb)\s?-?\d+\b|\bstatute|\bordinance|\bsection\s+\d|§|\bact\b|\bcode\s+\d|\bby[- ]right\b|\bministerial|\bpermit|\bparking|\bsetback|\bheight\b|\bvariance|\bhoa\b|\bcovenant/.test(s)) return "names a law or a rule the page does not test";
  if (STREET_RE.test(q) || /\b\d{5}(-\d{4})?\b/.test(q)) return "names an address";
  if (STATE_RE.test(q) || /,\s*[A-Z]{2}\b/.test(q)) return "names another place";
  if (/\b(in|at|near|around|for|of|from|to|between)\s+(?!(?:this|the|my|our|here|a|an|each|every|all|any|these|those|it|its|them|me|you|which|what|that|budget|money|cash|total|order|units?)\b)[A-Z][a-z]+/.test(q)) return "names a place";
  if (/\b(and|or)\s+(?:the\s+)?(?:next|other|another|neighbou?ring|nearby)\b|\bneighbou?ring (county|counties|areas?)\b|\bother (counties|cities|neighbou?rhoods|areas)\b|\b(each|every|all) (neighbou?rhood|area|block group)s?\b/.test(s)) return "asks about several places";
  return null;
}
// "should I" phrasings that are one of the fixed intents
const SHOULD_I_OK = [
  /^(so,?\s+)?where should (i|we) (invest|look|buy|put (my|our) money)\b[^?]*\??$/,
  /^(so,?\s+)?which (neighbou?rhoods?|areas?|places?|block groups?) should (i|we) (look at|consider|invest in|buy in|focus on)\b[^?]*\??$/,
  /^(so,?\s+)?what should (i|we) build( here| on this lot| in this (neighbou?rhood|area))?\s*\??$/,
];

// ---------------------------------------------------------------- intents
const FIELD_RES = [
  ["fmr", /\bfair market rents?\b|\bfmrs?\b|\bhud rents?\b|\bhud'?s? (fair market )?rent/],
  ["home_value", /\b(median |typical |average )?(home|house|property) (values?|prices?)\b|\bhome value\b|\bwhat (are|do) (homes|houses) (worth|cost)\b/],
  ["rent", /\b(median |typical |average )?rents?\b(?! (x|×|\*|times))/],
  ["income", /\b(median |household |typical |average )*incomes?\b/],
  ["population", /\bpopulation\b|\bhow many (people|residents)\b/],
  ["crashes", /\bcrash(es)?\b|\bcollisions?\b|\btraffic (deaths|injuries)\b/],
  ["canopy", /\b(tree )?canopy\b|\btree cover\b|\bstreet trees\b/],
  ["flood", /\bflood\b|\bfloodplain\b|\bfema\b/],
  ["zoning", /\bzon(ing|ed)\b/],
];
const LOOKUP_LEAD = /^(so,?\s+|and\s+|ok,?\s+)?(what('?s| is| are| was)|how (much|many|high|big)|tell me|show me|give me|list|is (this|the) (lot|house|property|parcel)|which flood zone|which zone|what flood zone|what zone|is it|is this)\b/;
function bedroomsIn(s) {
  if (/\b(studio|efficiency|0[- ]?(bed|br|bedroom))\b/.test(s)) return 0;
  const m = s.match(/\b(\d|one|two|three|four)[- ]?(bed(room)?s?|br)\b/);
  if (!m) return null;
  const n = /\d/.test(m[1]) ? +m[1] : WORDNUM[m[1]];
  return n >= 0 && n <= 4 ? n : -1;
}
const ARITH_OP = /\s(x|×|\*|times|multiplied by)\s+(\d+(?:\.\d+)?)\b|\s(\/|divided by)\s+(\d+(?:\.\d+)?)\b/;

// The intent a question is, or null. Runs only on questions that passed the hand-off rules.
function matchIntent(raw) {
  const q = String(raw || "").trim();
  const s = q.toLowerCase().replace(/\s+/g, " ").replace(/[!.]+$/, "");
  const words = s.split(" ").length;
  if (words > 24) return null;

  // budget: "I have $X", "my budget is $X", "what can I do with $X"
  const budget = parseBudget(s);
  if (budget != null) {
    if (countAmounts(s) > 1) return null;
    if (/\b(i have|i've got|i have got|i got|my budget is|budget (is|of)|i can spend|i could spend|i can afford|with a budget|what can i (do|build|afford)( here)? with|what could i (do|build)( here)? with|what is possible with|what's possible with)\b/.test(s)
      && !/\b(per (month|year)|a month|a year|monthly|annual|income|salary|rent)\b/.test(s)) return { intent: "budget", params: { budget } };
    return null;
  }
  if (/\$\s?\d/.test(s)) return null;

  // arithmetic on a named figure: "rent x 12", "annual rent", "sale price per square foot"
  const op = s.match(ARITH_OP);
  if (op) {
    const lhs = s.slice(0, op.index);
    const fields = FIELD_RES.filter(([k]) => ["fmr", "home_value", "rent", "income", "population"].includes(k)).filter(([, re]) => re.test(lhs)).map(([k]) => k);
    const f = fields.includes("fmr") ? "fmr" : fields.length === 1 ? fields[0] : null;
    if (!f || /\b(county|countywide)\b/.test(s) && f !== "fmr") return null;
    const n = parseFloat(op[2] || op[4]);
    if (!isNum(n) || n === 0) return null;
    return { intent: "arith", params: { field: f, op: op[2] ? "x" : "/", n, bedrooms: f === "fmr" ? bedroomsIn(s) : null } };
  }
  if (/\b(annual|yearly) (median )?rent\b|\b(median )?rent (per|a|each) year\b/.test(s) && !/\b(fmr|fair market|hud)\b/.test(s)) return { intent: "arith", params: { field: "rent", op: "x", n: 12, bedrooms: null } };
  const psf = s.match(/\b(last )?(sale|sold|assessed|assessor'?s?) (price|value)? ?per (square foot|sq\.? ?ft|sqft|sf)\b|\bprice per (square foot|sq\.? ?ft|sqft)\b/);
  if (psf) return { intent: "arith", params: { field: /assess/.test(psf[0]) ? "assessed_psf" : "sale_psf" } };

  // where to look
  if (/^(so,?\s+)?(where|which (neighbou?rhoods?|areas?|places?|block groups?))\b/.test(s) && /\b(invest|look( at)?|buy|put (my |our )?money|consider|focus on|start)\b/.test(s)
    && words <= 14 && !/\bbuild\b|\btransit\b|\bsites?\b|\bproperties\b/.test(s)) return { intent: "where", params: {} };

  // what to build in the selected neighborhood
  if (/^(so,?\s+)?what (should|could|can|would) (i|we|one|someone) build( here| in this (neighbou?rhood|area)| in this block group)?\s*\??$/.test(s)
    || /^what (is|are) (worth|good) (to )?build(ing)? here\s*\??$/.test(s) || /^what to build here\s*\??$/.test(s)) return { intent: "build", params: {} };

  // the open lot: ADU, lot split, N units
  if (/\b(can|could|may) (i|we) (add|build|put|have) (an? |another )?(adu|accessory dwelling( unit)?|backyard (home|house|cottage|unit)|granny flat|casita|in-law unit)\b/.test(s)
    && /^(so,?\s+)?(can|could|may)\b/.test(s) && words <= 14) return { intent: "lot_adu", params: {} };
  if (/^(so,?\s+)?(can|could|may) (i|we) (split|subdivide|divide) (this|the|my) (lot|parcel|property)( in(to)? (two|2)( lots| parcels)?)?( here)?\s*\??$/.test(s)) return { intent: "lot_split", params: {} };
  const units = s.match(/^(so,?\s+)?(can|could|may) (i|we) build (\d+|two|three|four|five|six|seven|eight|nine|ten) (units|homes|houses|apartments|dwellings|dwelling units)( on (this|the|my) (lot|parcel|property)| here)?\s*\??$/);
  if (units) { const n = /\d/.test(units[4]) ? +units[4] : WORDNUM[units[4]]; return { intent: "lot_units", params: { units: n } }; }

  // redevelopment sites in the county
  if ((/^(so,?\s+)?(what|which|are there( any)?|list|show me)\b/.test(s) && /\b(properties|sites|parcels|lots|land|places)\b/.test(s) && /\b(redevelop\w*|underused|under-used|underutili[sz]ed|vacant|could be built on|to build on)\b/.test(s))
    || /^(so,?\s+)?(underused|vacant) (sites|land|properties|lots)( here| in this county)?\s*\??$/.test(s)) return { intent: "sites", params: {} };

  // transit: should it be built, what kind
  if (/^(so,?\s+)?(should|would|could) (transit|more transit|a (bus|train|rail|light rail|brt|subway|metro|streetcar)( line| route| service)?|rail|light rail|brt|better buses|more buses|bus rapid transit) be (built|added)( here| in this (area|neighbou?rhood))?\s*\??$/.test(s)
    || /^(so,?\s+)?what (kind|type|sort|scale) of transit\b[^?]*\??$/.test(s)
    || /^(so,?\s+)?(does|can) (this|the) (area|neighbou?rhood|block group) (support|justify|warrant) (transit|rail|light rail|brt|bus rapid transit|more buses|a train)\s*\??$/.test(s)) return { intent: "transit", params: {} };

  // figure lookup
  const hits = FIELD_RES.filter(([, re]) => re.test(s)).map(([k]) => k);
  const fieldSet = hits.includes("fmr") ? hits.filter(k => k !== "rent") : hits;
  if (fieldSet.length === 1 && (LOOKUP_LEAD.test(s) || words <= 5)) {
    const field = fieldSet[0];
    if (/\b(buy|sell|build|add|split|improve|lower|raise|reduce|increase|change|rezone|fix|insure|insurance|cost to)\b/.test(s)) return null;
    const scope = /\b(county|countywide|county-wide)\b/.test(s) ? "county" : (/\b(lot|parcel|house|property|this home|my home)\b/.test(s) ? "lot" : "hood");
    if (scope === "county" && field !== "fmr") return null;
    if ((field === "flood" || field === "zoning") && scope === "hood" && !/\b(here|this)\b/.test(s) && words > 5) return null;
    const br = field === "fmr" ? bedroomsIn(s) : null;
    if (br === -1) return null;
    return { intent: "figure", params: { field, scope, bedrooms: br } };
  }
  return null;
}

// ---------------------------------------------------------------- answers
// Each returns { text, sources, findings, matched? }. text uses only **bold**, "- " bullets and line breaks, which the
// chat renders after escaping (aiTextToHtml in app/app.js).
const placeName = (name, city) => `${name || "the selected area"}${city && city !== name ? ", " + city : ""}`;
function hoodLabel(h) { return h ? placeName(h.name, h.city) : "the selected area"; }
const NEED_HOOD = "No neighborhood is selected. Click an area on the map (or search for one) and ask again.";
const NEED_LOT = "No lot is open. Open a lot on the map (search an address, or click a lot) and ask again.";

function answerFigure(p, snap) {
  const out = { text: "", sources: [], findings: [] };
  const h = snap.hood, c = snap.county || {};
  const acs = snap.acsLabel || "Census ACS 5-year";
  const line = (label, value, basis, src, note) => {
    const t = value == null ? `**${label}:** Not on file${note ? ` (${note})` : ""}` : `**${label}:** ${value}${tag(basis)}${note ? ` (${note})` : ""}${src ? `. Source: ${src}` : ""}`;
    out.findings.push(t.replace(/\*\*/g, ""));
    return t;
  };
  const f = p.field;
  if (f === "fmr") {
    const r = snap.hud;
    if (!r) { out.text = line(`HUD Fair Market Rent, ${c.name || "this county"}`, null, null, null, "no verified HUD record for this county is loaded on the page"); return out; }
    const labels = ["Studio (0 bedrooms)", "1 bedroom", "2 bedrooms", "3 bedrooms", "4 bedrooms"];
    const area = `${r.area || c.name || "this county"}${r.zip ? `, ZIP ${r.zip} (Small Area FMR)` : ""}`;
    addSource(out.sources, r.source || "HUD Fair Market Rents", r.url);
    const rows = (p.bedrooms != null ? [p.bedrooms] : [0, 1, 2, 3, 4]).map(i => {
      const v = r.br[i];
      return isNum(v) ? `- ${labels[i]}: ${money(v)} a month [measured]` : `- ${labels[i]}: Not on file (HUD record has no value)`;
    });
    out.findings.push(`HUD Fair Market Rent for ${area}: ` + rows.map(x => x.slice(2)).join("; ") + `. Source: ${r.source || "HUD"}`);
    out.text = `**HUD Fair Market Rent for ${area}**\n${rows.join("\n")}\nSource: ${r.source || "HUD Fair Market Rents"}. HUD sets these as the 40th-percentile gross rent (rent plus utilities) for housing vouchers; they are not asking rents.`;
    return out;
  }
  if (f === "flood" || f === "zoning") {
    const L = snap.lot;
    if (!L) { out.text = NEED_LOT; out.findings.push(`${f === "flood" ? "Flood zone" : "Zoning"}: no lot is open`); return out; }
    const addr = L.address || "the open lot";
    if (f === "flood") {
      if (L.flood && L.flood.label) {
        addSource(out.sources, "FEMA National Flood Hazard Layer (NFHL), layer 28", L.flood.url || null);
        out.text = line(`FEMA flood zone at ${addr}`, L.flood.label, "measured", "FEMA National Flood Hazard Layer");
      } else if (L.floodChecked) {
        out.text = line(`FEMA flood zone at ${addr}`, null, null, null, "the FEMA map returned no zone for this point, or the lookup did not finish. An unmapped area means there is no flood map here, not that there is no flood risk");
      } else { out.text = line(`FEMA flood zone at ${addr}`, null, null, null, "the lot's hazard checks have not finished loading; ask again in a moment"); }
      return out;
    }
    out.text = L.zoning
      ? line(`Zoning code at ${addr}`, L.zoning, "measured", L.zoningSource || "the county parcel record", "as recorded; not re-checked with the city or county, which decides what it allows")
      : line(`Zoning code at ${addr}`, null, null, null, "the parcel record has no zoning code");
    return out;
  }
  if (!h) { out.text = NEED_HOOD; out.findings.push("no neighborhood selected"); return out; }
  const where = hoodLabel(h);
  const pre = h.preliminary ? "neighborhood estimate (preliminary)" : null;
  if (f === "home_value") out.text = line(`Typical home value, ${where}`, isNum(h.hv) ? money(h.hv) : null, pre ? "modelled" : "measured", pre || h.hvSource || acs, isNum(h.hv) ? h.hvNote : "no home value on file for this block group");
  else if (f === "rent") out.text = line(`Median rent, ${where}`, isNum(h.rent) ? money(h.rent) + " a month" : null, pre ? "modelled" : "measured", pre || acs, isNum(h.rent) ? h.rentNote : "no rent on file for this block group");
  else if (f === "income") out.text = line(`Median household income, ${where}`, isNum(h.inc) ? money(h.inc) + " a year" : null, pre ? "modelled" : "measured", pre || acs, isNum(h.inc) ? null : "no income on file for this block group");
  else if (f === "population") out.text = line(`Population, ${where}`, isNum(h.pop) ? Math.round(h.pop).toLocaleString("en-US") : null, pre ? "modelled" : "measured", pre || acs, isNum(h.pop) ? null : "no population on file for this block group");
  else if (f === "canopy") {
    const cn = h.canopy;
    out.text = cn && isNum(cn.gap) ? line(`Tree canopy gap, ${where}`, cn.gapText + (isNum(cn.now) ? ` (canopy now ${cn.now}%)` : ""), "measured", cn.src) : line(`Tree canopy gap, ${where}`, null, null, null, "no Tree Equity Score figure on file for this block group");
  } else if (f === "crashes") {
    const cr = h.crash;
    if (cr && cr.loading) return null;   // the county's crash file is still loading: hand off rather than say "not on file"
    if (cr && cr.text) { out.text = `**Crashes, ${where}:** ${cr.text} [measured]`; out.findings.push(`Crashes, ${where}: ${cr.text} [measured]`); if (cr.url) addSource(out.sources, cr.sourceName || "crash records", cr.url); }
    else if (cr && isNum(cr.older)) out.text = line(`Fatal or severe crashes recorded, ${where}`, Math.round(cr.older).toLocaleString("en-US"), "measured", "the county data file", "older count that gave each boundary-street crash to one side only");
    else out.text = line(`Crashes, ${where}`, null, null, null, "no located crash records for this county are on file");
  }
  const present = isNum({ home_value: h.hv, rent: h.rent, income: h.inc, population: h.pop }[f]);
  if (!present) {}
  else if (!h.preliminary && /home_value|rent|income/.test(f)) out.text += `\nCensus estimates have a margin of error; the page shows the published median.`;
  else if (!h.preliminary && f === "population") out.text += `\nCensus estimates have a margin of error.`;
  return out;
}

function answerArith(p, snap) {
  const out = { text: "", sources: [], findings: [] };
  if (p.field === "sale_psf" || p.field === "assessed_psf") {
    const L = snap.lot;
    if (!L) { out.text = NEED_LOT; return out; }
    const addr = L.address || "the open lot";
    const top = p.field === "sale_psf" ? (L.lastSale && isNum(L.lastSale.price) ? { v: L.lastSale.price, label: `last recorded sale price${L.lastSale.date ? " (" + L.lastSale.date + ")" : ""}` } : null)
      : (isNum(L.assessorValue) ? { v: L.assessorValue, label: "assessed value on the roll" } : null);
    const sq = isNum(L.livingSqft) ? L.livingSqft : null;
    if (!top || !sq) { out.text = `**${p.field === "sale_psf" ? "Sale price" : "Assessed value"} per square foot, ${addr}:** Not on file (${!top ? (p.field === "sale_psf" ? "no sale price is on file for this lot" : "no assessed value is on file for this lot") : "no living area is on file for this lot"}).`; out.findings.push(out.text.replace(/\*\*/g, "")); return out; }
    const r = top.v / sq;
    out.text = `**${p.field === "sale_psf" ? "Sale price" : "Assessed value"} per square foot, ${addr}:** ${money(top.v)} (${top.label}) / ${Math.round(sq).toLocaleString("en-US")} sq ft (living area on the parcel record) = $${r.toFixed(2)} per sq ft [modelled]. Both inputs are from the county parcel record shown on the page.`;
    out.findings.push(out.text.replace(/\*\*/g, ""));
    return out;
  }
  const base = answerFigure({ field: p.field, scope: p.field === "fmr" ? "county" : "hood", bedrooms: p.field === "fmr" ? (p.bedrooms == null ? 2 : p.bedrooms) : null }, snap);
  let v = null, label = "";
  const h = snap.hood;
  if (p.field === "fmr") { const br = p.bedrooms == null ? null : p.bedrooms; if (br == null) { out.text = "Which bedroom size? HUD's Fair Market Rent differs by bedrooms; ask, for example, \"2-bedroom FMR x 12\"."; return out; } v = snap.hud ? snap.hud.br[br] : null; label = `HUD Fair Market Rent, ${br === 0 ? "studio" : br + " bedroom" + (br > 1 ? "s" : "")}`; addSource(out.sources, snap.hud && snap.hud.source, snap.hud && snap.hud.url); }
  else if (!h) { out.text = NEED_HOOD; return out; }
  else { v = { home_value: h.hv, rent: h.rent, income: h.inc, population: h.pop }[p.field]; label = { home_value: "typical home value", rent: "median rent", income: "median household income", population: "population" }[p.field] + ", " + hoodLabel(h); }
  if (!isNum(v)) { out.text = base.text; out.findings = base.findings; return out; }
  const r = p.op === "x" ? v * p.n : v / p.n;
  const isMoney = p.field !== "population";
  const f = x => isMoney ? money(x) : Math.round(x).toLocaleString("en-US");
  const yr = p.op === "x" && p.n === 12 && (p.field === "rent" || p.field === "fmr") ? " (12 months of the monthly figure; nothing else is added)" : "";
  out.text = `**${label[0].toUpperCase() + label.slice(1)} ${p.op === "x" ? "x" : "/"} ${p.n}:** ${f(v)} ${p.op === "x" ? "x" : "/"} ${p.n} = ${isMoney && Math.abs(r) < 100 ? "$" + r.toFixed(2) : f(r)} [modelled]${yr}.\nInput: ${base.findings[0] || label}`;
  out.findings.push(out.text.replace(/\*\*/g, "").replace(/\n/g, " "));
  out.sources = out.sources.concat(base.sources);
  return out;
}

function answerWhere(snap) {
  const out = { text: "", sources: [], findings: [] };
  const b = snap.brief, c = snap.county || {};
  if (!b) { out.text = "The ranking for this county has not loaded yet; ask again in a moment."; return null; }
  const top = (b.topNeighborhoods || []).slice(0, 5);
  if (!top.length) { out.text = `No area in ${c.name || "this county"} could be ranked${(b.missing || []).length ? ": " + b.missing.join("; ") : ""}.`; out.findings.push(out.text); return out; }
  const rows = top.map(r => `- ${r.rank}. **${r.name || "Unnamed area"}**${r.city && r.city !== r.name ? ", " + r.city : ""} (confidence ${r.confidence})${r.reason ? ": " + r.reason : ""}`);
  const hl = snap.honest ? snap.honest.text : "How well this ranking has worked here is not known.";
  out.text = `**Areas in ${c.name || "this county"} that look cheapest for what they have** (Census block groups; a relative-value screen, not a price forecast):\n${rows.join("\n")}\n${hl}\nThe score is [modelled] from measured Census figures with weights fitted on FHFA price history; the Invest view shows each area's reasons and back-test.`;
  out.findings.push(`Ranked list (brief.topNeighborhoods, first 5): ${top.map(r => `${r.rank}. ${r.name || "Unnamed"} (${r.confidence})`).join("; ")}. Honesty line: ${hl}`);
  (b.sources || []).slice(0, 4).forEach(s => addSource(out.sources, s.name, s.url));
  return out;
}

function playFig(x) { return x.cost && isNum(x.cost.value) ? `cost ${fig(x.cost)}` : `cost Not on file${(x.missing || []).length ? ` (${x.missing.join("; ")})` : ""}`; }
function answerBuild(snap) {
  const out = { text: "", sources: [], findings: [] };
  const b = snap.brief;
  if (!b) return null;
  const n = b.neighborhood;
  if (!n) { out.text = NEED_HOOD; out.findings.push("no neighborhood selected"); return out; }
  const where = hoodLabel(snap.hood) || (n.ranking && n.ranking.name);
  const ideas = (n.build || []).map(x => `- **${x.name}**: ${x.cost && isNum(x.cost.value) ? "cost " + fig(x.cost) : "cost Not on file"}; ${x.valuePerDollar && isNum(x.valuePerDollar.value) ? fig(x.valuePerDollar) + " of nearby home value" : "value per $1 Not on file"} (evidence: ${x.evidence && x.evidence.tier || "assumed"}${x.evidence && x.evidence.verification ? ", " + String(x.evidence.verification).replace(/_/g, " ") : ""})`);
  const plays = (n.housingPlays || []).map(h => `- **${h.label}**: ${playFig(h)}. Legal: ${h.legal}.`);
  const held = n.withheld || [];
  out.text = `**What to build in ${where}** (the Invest view's list, strongest evidence first):\n${ideas.length ? ideas.join("\n") : "- No public improvement passed the verification audit here, so none carries a figure."}\n**Housing plays**\n${plays.join("\n")}` +
    (held.length ? `\n${held.length} more ${held.length === 1 ? "idea has" : "ideas have"} no figures because the effect or cost could not be confirmed against a source: ${held.slice(0, 6).map(w => w.name).join(", ")}${held.length > 6 ? ", ..." : ""}.` : "") +
    `\nCosts and values are the pipeline's [modelled] estimates; effect sizes come from studies elsewhere, and value gains are for nearby homes in total, not cash to whoever pays.`;
  out.findings.push(`Build list for ${where}: ` + (n.build || []).map(x => `${x.name} (${x.cost && isNum(x.cost.value) ? money(x.cost.value) : "cost not on file"})`).join("; ") + `. Housing plays: ` + (n.housingPlays || []).map(h => `${h.label} (${h.cost && isNum(h.cost.value) ? money(h.cost.value) : "cost not on file"}; legal: ${h.legal})`).join("; ") + `. Withheld: ${held.length}`);
  addSource(out.sources, "Intervention verification table (app/data/intervention_verification.json)", null);
  return out;
}

function legalLine(l) {
  if (!l) return "Not determined (the statute engine gave no answer)";
  if (/^allowed/.test(l.status)) {
    const st = l.verification_status ? String(l.verification_status).replace(/_/g, " ") : "status not on file";
    return `Allowed by ${l.citation || "state law"} (law text ${st}${l.checked ? `, checked ${l.checked}` : ", check date not on file"})${(l.unconfirmed_fields || []).length ? `; not confirmed in the law's text: ${l.unconfirmed_fields.join("; ")}` : ""}. This is a screen, not a permit: the city or county decides.`;
  }
  return `Not determined: ${l.why || "no rule loaded"}`;
}
function answerLot(intent, p, snap) {
  const out = { text: "", sources: [], findings: [] };
  if (!snap.lot) { out.text = NEED_LOT; out.findings.push("no lot open"); return out; }
  const b = snap.brief;
  if (!b || !b.parcel) return null;
  const addr = snap.lot.address || "the open lot";
  const z = b.parcel.zoning;
  if (intent === "lot_units") {
    if (z && (z.statutes || []).length) return null;   // a law applies: how many homes it allows is for the model to read from the law
    const why = !z ? ((b.parcel.missing || []).includes("base_zoning_code") ? (snap.lot.zoning ? `the Zoning row shows ${snap.lot.zoning}, but the legal screen did not receive that code, so no state law was applied` : "the parcel record has no zoning code, so no state law was applied") : "the statute engine did not run") : ((z.not_confirmed || []).length ? z.not_confirmed.join(" ") : "no state housing law on file applies to this lot");
    out.text = `**${p.units} homes at ${addr}:** Not determined. No state law on file was confirmed for this lot (${why}). Local zoning (density, height, lot size) decides; the page has no local rule table for it. Ask the city or county planning office.`;
    out.findings.push(out.text.replace(/\*\*/g, ""));
    return out;
  }
  const want = intent === "lot_adu" ? "adu" : "lot_split";
  const e = (b.parcel.expansions || []).find(x => x.expansion === want);
  if (!e) return null;
  const label = intent === "lot_adu" ? "A backyard home (ADU)" : "Splitting the lot";
  // The house panel's Zoning row can show a code that the legal screen did not receive (docs/DATA-AUDIT-AND-TRANSPARENCY.md, 19 Nov 2026)
  const gap = e.legal && /zoning code unknown/.test(e.legal.why || "") && snap.lot.zoning
    ? `\nThe lot's Zoning row shows ${snap.lot.zoning} (${snap.lot.zoningSource || "parcel record"}), but the page's legal screen did not receive that code, so no state law was tested here.` : "";
  out.text = `**${label} at ${addr}:** ${legalLine(e.legal)}` + gap +
    (z ? `\nState laws the statute engine applied to this lot: ${(z.statutes || []).length ? z.statutes.join("; ") : "none confirmed"}.` : "") +
    (z && (z.not_confirmed || []).length ? `\nLaws on file that could not be applied here:\n${z.not_confirmed.slice(0, 5).map(x => "- " + x).join("\n")}` : "") +
    `\nCost and value of this addition: Not on file (no sourced construction cost or value of an addition is on file).`;
  if (e.legal && e.legal.statute_url) addSource(out.sources, e.legal.citation || "law text", e.legal.statute_url);
  addSource(out.sources, "State housing laws table (app/data/statutes.json)", null);
  out.findings.push(`${label} at ${addr}: ${legalLine(e.legal)}`);
  return out;
}

function answerSites(snap) {
  const out = { text: "", sources: [], findings: [] };
  const list = snap.sites || [], c = snap.county || {};
  if (!list.length) { out.text = `No underused sites have been measured for ${c.name || "this county"} yet, so none are listed. Only sites whose size was measured from a parcel or map record are shown; none are inferred.`; out.findings.push(out.text); return out; }
  const withSize = list.filter(s => isNum(s.acres));
  const rows = withSize.slice(0, 6).map(s => {
    const v = s.verification || {}, uf = (v.unverified_fields || []).map(u => String(u).split(/[\s(]/)[0]);
    if (s.sourceUrl) addSource(out.sources, s.displayName, s.sourceUrl);
    return `- **${s.displayName}**${s.cityName ? ", " + s.cityName : ""}: ${s.acres.toFixed(1)} acres [measured]${s.kind ? `, ${s.kind}` : ""}; facts ${String(v.status || "not verified").replace(/_/g, " ")}${uf.includes("potentialHomes") ? "; homes it could hold: Not on file (model estimate listed as unverified in the record)" : ""}`;
  });
  out.text = `**Sites to redevelop in ${c.name || "this county"}** (${list.length} measured, largest first):\n${rows.join("\n")}${withSize.length > 6 ? `\n${withSize.length - 6} more are listed in the Invest view.` : ""}${list.length > withSize.length ? `\n${list.length - withSize.length} more have no measured size.` : ""}\nThe records' model estimates (homes a site could hold, margin, land value) are listed as unverified, so no figure is given for them.`;
  out.findings.push(`Sites in ${c.name || "this county"}: ${list.length} measured; largest: ` + withSize.slice(0, 6).map(s => `${s.displayName} ${s.acres.toFixed(1)} acres`).join("; "));
  return out;
}

function answerTransit(snap) {
  const out = { text: "", sources: [], findings: [] };
  const b = snap.brief, T = snap.thresholds;
  if (!b) return null;
  if (!b.neighborhood) { out.text = NEED_HOOD; out.findings.push("no neighborhood selected"); return out; }
  const t = b.transit || {};
  const d = t.density && t.density.homesPerNetAcre;
  const where = hoodLabel(snap.hood);
  const rows = T && T.tcqsm_density ? T.tcqsm_density.rows.map(r => `- ${r.label}: ${Array.isArray(r.du_per_net_acre) ? r.du_per_net_acre.join("-") : r.du_per_net_acre} homes per net acre${r.cbd_million_sqft ? `, downtown ${r.cbd_million_sqft.join("-")}M sq ft` : r.cbd_million_sqft_min ? `, downtown over ${r.cbd_million_sqft_min}M sq ft` : ""}`) : [];
  out.text = `**Transit for ${where}: ${VERDICT_TXT[t.verdict] || "Not enough data to say"}**${t.scale ? `; the density supports ${SCALE_TXT[t.scale] || t.scale}` : "; no scale suggested"}.` +
    (t.verdictMeaning ? ` (${t.verdictMeaning}.)` : "") +
    `\nDensity: ${fig(d, "needs homes and land area for the area")}` +
    ((t.reasons || []).length ? `\n${t.reasons.map(x => "- " + x).join("\n")}` : "") +
    ((t.missing || []).length ? `\nMissing for a firmer answer: ${t.missing.join("; ")}.` : "") +
    (rows.length ? `\n**Thresholds used** (TCRP Report 165, Exhibit 3-8; bundle densities are per gross acre, multiplied by ${T.tcqsm_density.gross_to_net_factor} to compare):\n${rows.join("\n")}` : "") +
    `\nThese are planning rules of thumb, not a ridership forecast.`;
  if (T) { addSource(out.sources, T.tcqsm_density.source.title, T.tcqsm_density.source.url); addSource(out.sources, T.fta_cig.source.title, T.fta_cig.source.url); }
  out.findings.push(`Transit for ${where}: ${t.verdict || "not_enough_data"}${t.scale ? ", scale " + t.scale : ""}; density ${d && isNum(d.value) ? d.value + " homes per net acre (" + d.basis + ")" : "not on file"}; reasons: ${(t.reasons || []).join(" ")}`);
  return out;
}

function answerBudget(p, snap) {
  const out = { text: "", sources: [], findings: [], matched: [] };
  const b = snap.brief;
  if (!b) return null;
  const n = b.neighborhood;
  if (!n) { out.text = NEED_HOOD + " The budget is matched against the plays listed for one neighborhood."; out.findings.push("no neighborhood selected"); return out; }
  const where = hoodLabel(snap.hood);
  // the Build card's order: housing plays as the brief lists them, then the improvements in the brief's ranked order
  // (the ADU housing play carries the ADU improvement's own figures, so that improvement is not counted twice)
  const aduPlay = (n.housingPlays || []).find(h => h.play === "adu" && h.cost && isNum(h.cost.value));
  const all = (n.housingPlays || []).map(h => ({ name: h.label, kind: "housing play", cost: h.cost }))
    .concat((n.build || []).filter(x => !(aduPlay && x.id === "adu")).map(x => ({ name: x.name, kind: "improvement", cost: x.cost })));
  const priced = all.filter(x => x.cost && isNum(x.cost.value));
  const fits = priced.filter(x => x.cost.value <= p.budget);
  const over = priced.length - fits.length, unpriced = all.length - priced.length;
  out.matched = fits.map(x => ({ name: x.name, cost: x.cost.value }));
  out.text = `**With ${money(p.budget)} in ${where}:** ${fits.length} of the ${all.length} plays listed here have a cost on file at or under it.` +
    (fits.length ? `\n${fits.map(x => `- **${x.name}** (${x.kind}): cost ${fig(x.cost)}`).join("\n")}` : "") +
    (over ? `\n${over} ${over === 1 ? "play costs" : "plays cost"} more than ${money(p.budget)}.` : "") +
    (unpriced ? `\n${unpriced} ${unpriced === 1 ? "play has" : "plays have"} no cost on file, so ${unpriced === 1 ? "it" : "they"} cannot be matched to a budget: ${all.filter(x => !(x.cost && isNum(x.cost.value))).map(x => x.name).join(", ")}.` : "") +
    `\nThis only compares your budget with the costs on file (the pipeline's [modelled] estimates, which include 10 years of upkeep for public improvements); it does no other financial maths.`;
  out.findings.push(`Budget ${money(p.budget)} in ${where}: within budget: ${fits.map(x => `${x.name} (${money(x.cost.value)})`).join("; ") || "none"}; over budget: ${over}; no cost on file: ${unpriced}`);
  // courses of action (project cards, src/engines/projectCardEngine.js fitToBudget): a course fits when the top of its cost range is at or under the budget
  const PCE = typeof window !== "undefined" && window.ProjectCardEngine ? window.ProjectCardEngine : (typeof require !== "undefined" ? require("../src/engines/projectCardEngine.js") : null);
  if (PCE && Array.isArray(snap.projectCards) && snap.projectCards.length) {
    const f = PCE.fitToBudget(snap.projectCards, p.budget);
    const rng = c => `${money(c.cost.low.value)}${c.cost.high.value !== c.cost.low.value ? " to " + money(c.cost.high.value) : ""} [${c.cost.basis}]${c.costLabel ? ", " + c.costLabel : ""}`;
    out.text += `\n\n**Courses of action:** ${f.within.length} ${f.within.length === 1 ? "course costs" : "courses cost"} at most ${money(p.budget)} (the top of the cost range), ${f.straddle.length} could (the range straddles it), ${f.over.length} cost more; ${f.uncosted} have no cost on file and ${f.notAssessed} could not be assessed.` +
      f.within.concat(f.straddle).slice(0, 6).map(c => `\n- **${c.label}** (${c.subject}): ${rng(c)}${f.straddle.includes(c) ? " (could fit)" : ""}`).join("") +
      `\nListed by the strength of the evidence, not by return.`;
    for (const c of f.within) out.matched.push({ name: c.label + " (" + c.subject + ")", cost: c.cost.high.value });
    out.findings.push(`Courses of action at ${money(p.budget)}: fit: ${f.within.map(c => `${c.label} for ${c.subject} (${rng(c)})`).join("; ") || "none"}; could fit: ${f.straddle.length}; over: ${f.over.length}; no cost on file: ${f.uncosted}; not assessed: ${f.notAssessed}`);
  }
  return out;
}

function answerIntent(m, snap) {
  if (!m || !snap) return null;
  switch (m.intent) {
    case "figure": return answerFigure(m.params, snap);
    case "arith": return answerArith(m.params, snap);
    case "where": return answerWhere(snap);
    case "build": return answerBuild(snap);
    case "lot_adu": case "lot_split": case "lot_units": return answerLot(m.intent, m.params, snap);
    case "sites": return answerSites(snap);
    case "transit": return answerTransit(snap);
    case "budget": return answerBudget(m.params, snap);
    default: return null;
  }
}

// A lenient read used only for hand-offs: which intent the question touches, so its findings can go to the model.
function looseIntent(q) {
  const s = String(q || "").toLowerCase();
  const b = parseBudget(s);
  if (b != null && countAmounts(s) <= 1) return { intent: "budget", params: { budget: b } };
  if (/\badu\b|accessory dwelling|granny flat/.test(s)) return { intent: "lot_adu", params: {} };
  if (/\bsplit\b.*\blot\b/.test(s)) return { intent: "lot_split", params: {} };
  if (/\btransit|light rail|\bbrt\b|\bbus(es)?\b|\btrain\b/.test(s)) return { intent: "transit", params: {} };
  if (/\bredevelop|underused|vacant (land|lot)/.test(s)) return { intent: "sites", params: {} };
  if (/\bbuild\b/.test(s)) return { intent: "build", params: {} };
  if (/\binvest|neighbou?rhoods? to|where (to|should)/.test(s)) return { intent: "where", params: {} };
  const hits = FIELD_RES.filter(([, re]) => re.test(s)).map(([k]) => k);
  if (hits.length === 1) return { intent: "figure", params: { field: hits[0], scope: "hood", bedrooms: hits[0] === "fmr" ? bedroomsIn(s) : null } };
  return null;
}
function capFindings(list) {
  const out = []; let n = 0;
  for (const f of list || []) { const t = String(f).slice(0, 900); if (n + t.length > MAX_FINDINGS_CHARS - 200) break; out.push(t); n += t.length; }
  return out;
}

// The router: { answered: true, intent, text, sources, findings, matched? } or { answered: false, reason, findings }
function route(q, snap) {
  const why = handoffReason(q);
  const m = why ? null : matchIntent(q);
  if (m && snap) {
    const a = answerIntent(m, snap);
    if (a && a.text) return { answered: true, intent: m.intent, text: a.text + "\n" + (/\[(measured|modelled|assumed)\]/.test(a.text) ? BASIS_NOTE + "\n" : "") + NO_AI_LINE, sources: a.sources || [], findings: capFindings(a.findings), matched: a.matched || null };
  }
  // hand off, with what the page already has for the part of the question this layer recognises
  const lm = m || looseIntent(q);
  let findings = [];
  if (lm && snap && lm.intent !== "lot_units") { try { const a = answerIntent(lm, snap); findings = a ? a.findings || [] : []; } catch (e) { findings = []; } }
  return { answered: false, reason: why || (m ? "the page data for this question is still loading or the answer needs reading a law" : "not one of the questions the page answers itself"), intent: lm ? lm.intent : null, findings: capFindings(findings) };
}

const core = { route, matchIntent, answerIntent, handoffReason, parseBudget, NO_AI_LINE, MAX_FINDINGS_CHARS };

// ---------------------------------------------------------------- page glue (browser only)
// Reads what the panels show, with the panels' own helpers (acsNote, hvSourceText, canopyHeatFacts, crashTextFor,
// getHudFmr) so the withholding rules are the same.
function pageSnapshot() {
  const G = typeof window !== "undefined" ? window : {};
  const fips = typeof activeFips === "function" ? String(activeFips()) : null;
  if (!fips) return Promise.resolve(null);
  const E = G.InvestmentDecisionEngine;
  const inv = G.cpInvest && G.cpInvest.advisorInputs ? G.cpInvest.advisorInputs() : Promise.resolve(null);
  return inv.then(I => {
    const snap = { county: { fips, name: (I && I.countyName) || (typeof countyOf === "function" ? countyOf() : null), state: typeof activeState === "function" ? activeState() : null }, thresholds: E ? E.TRANSIT_THRESHOLDS : null, hood: null, lot: null, hud: null, brief: null, honest: I && I.honest || null, sites: I && I.countySites || [], projectCards: I && I.projectCards || null };
    const oc = typeof D_OC !== "undefined" && D_OC && D_OC.meta && D_OC.meta.fips === fips ? D_OC : null;
    snap.acsLabel = oc && oc.meta.acs ? (/\bACS\b/.test(oc.meta.acs) ? `Census ${oc.meta.acs}` : `Census ACS ${oc.meta.acs}`) : "Census ACS 5-year";
    const sel = typeof selected !== "undefined" ? selected : null;
    const B = (typeof activeBundle === "function" && activeBundle()) || (typeof D !== "undefined" ? D : null);
    const feat = sel && typeof byId !== "undefined" && byId.get(sel) ? byId.get(sel).properties || {} : null;
    if (sel && feat) {
      const m = ((B && B.details && B.details[sel]) || {}).m || {};
      const num = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
      const pre = typeof activeCounty !== "undefined" && activeCounty === "oc" && !(oc && oc.meta && oc.meta.schema >= 2);
      const hvSrc0 = (typeof hvSourceText === "function" ? hvSourceText(m.hvs) : m.hvs) || "";
      const hvNote = typeof acsNote === "function" && !/tract/.test(hvSrc0) ? acsNote(sel, "hv", m) : "";   // as the panel's home-value tile
      const rentNote = typeof acsNote === "function" ? acsNote(sel, "rent") : "";
      const cc = typeof crashCountsFor === "function" ? crashCountsFor(fips) : null;
      const ct = typeof crashTextFor === "function" ? crashTextFor(fips, sel) : null;
      const canopy = typeof canopyHeatFacts === "function" ? canopyHeatFacts(feat, m) : null;
      snap.hood = { id: sel, name: feat.n || m.n || null, city: feat.c || m.c || null, preliminary: pre,
        hv: num(m.hv != null ? m.hv : feat.hv), hvNote: hvNote || null, hvSource: hvSrc0 || null,
        rent: num(m.rent), rentNote: rentNote || null, inc: num(m.inc), pop: num(m.pop),
        canopy: canopy && canopy.gap != null ? { gap: canopy.gap, gapText: canopy.gapText, now: canopy.now, src: canopy.src } : null,
        crash: ct ? { text: ct } : (cc === undefined ? { loading: true } : (m.ksi != null && !isNaN(+m.ksi) ? { older: +m.ksi } : null)) };
    }
    const ah = typeof activeHouse !== "undefined" ? activeHouse : null;
    const zip = ah && ah.a ? (ah.a.ZIP || ah.a.Zip || ah.a.zip || ah.a.ZIPCODE || ah.a.ZIP_CODE || ah.a.SitusZip || ah.a.PHY_ZIP || ah.a.PARCEL_ZIP || ah.a.SITEZIP || ah.a.SitusZipCode || null) : null;
    const h = typeof getHudFmr === "function" ? getHudFmr(fips, zip) : null;
    if (h) snap.hud = { area: h.metro_or_county_name || h.county_name || null, zip: h.is_safmr ? h.zip_code : null, br: [h.efficiency_0br, h.one_bed_1br, h.two_bed_2br, h.three_bed_3br, h.four_bed_4br], source: h.source || null, url: urlIn(h.verification && h.verification.evidence) };
    if (ah && ah.a) {
      const a = ah.a, F = ah.F || {}, R = ah.st && ah.st.R;
      const pf = I && I.pf ? I.pf.facts : null;
      // the zoning code as the house panel's Zoning row shows it: LA's parcel zoning layer at the lot, else the parcel record
      let zl = null; try { zl = ah.ll && typeof zoneAt === "function" ? zoneAt(ah.ll) : null; } catch (e) { zl = null; }
      const recZone = (a.ZoneCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(a.ZoneCode).trim())) ? String(a.ZoneCode).trim() : null;
      snap.lot = { address: a.SitusFullAddress || (a.AIN ? "parcel " + a.AIN : null),
        zoning: (zl && zl.zone) || (pf && pf.base_zoning_code) || recZone,
        zoningSource: zl && zl.zone ? `the parcel zoning layer${zl.juris ? " (" + zl.juris + ")" : ""}` : "the county parcel record",
        flood: R && R.fema ? { zone: R.fema.zone, label: R.fema.label, sfha: R.fema.sfha, url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query" } : null,
        floodChecked: !!R,
        lastSale: ah.sale ? { price: isNum(+ah.sale.price) && +ah.sale.price > 0 ? +ah.sale.price : null, date: ah.sale.date || null } : null,
        livingSqft: isNum(+F.bldg) && +F.bldg > 0 ? +F.bldg : null,
        assessorValue: (() => { const v = ((+a.Roll_LandValue || 0) + (+a.Roll_ImpValue || 0)) || +a.Roll_TotalValue; return isNum(v) && v > 0 ? v : null; })() };
    }
    if (I && I.state === "ok" && E) {
      try { snap.brief = E.buildDecisionBrief(I.B, { blockGroupId: sel && I.B.details && I.B.details[sel] ? sel : null, parcel: I.pf ? I.pf.facts : null, top: 10 }, I.ctx); } catch (e) { snap.brief = null; }
    }
    return snap;
  });
}
function tryScripted(q) {
  return pageSnapshot().then(snap => {
    const r = route(q, snap);
    if (typeof window !== "undefined") window.__cpAdvisorLast = r;
    return r;
  }, () => ({ answered: false, reason: "page data could not be read", findings: [] }));
}

if (typeof module !== "undefined" && module.exports) module.exports = core;
if (typeof window !== "undefined") window.AdvisorScripts = Object.assign({}, core, { pageSnapshot, tryScripted });
})();
