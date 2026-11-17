// Live check of the "what fits on this lot" zoning rows (real network, NOT part of CI).
//
// For real one- and two-family lots in New York City (sampled from MapPLUTO, the page's own parcel service), this opens
// the page, clicks each lot through the page's own click path (houseAt) and checks what the house panel says against
// what is fetched here independently:
//   zoning district, lot area, frontage, floor area -> MapPLUTO, queried directly for the same point
//   housing types, minimum lot, FAR, height, ADU     -> the Zoning Resolution section pages, re-fetched now: each rule's
//                                                       quote (or table row) must still appear in its section's text
//   parcel use                                       -> "One & Two Family Buildings" (PLUTO LandUse 01)
// Outside NYC it opens one lot per listed county and checks the panel says the standards are not on file, with the reason.
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_lot_fit.mjs   (writes data/backtests/live_check_lot_fit_<date>.json)
// Env: LIVE_PORT (default 8899).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8899);
const UA = { "User-Agent": "city-pretty-live-check/1.0" };
const PLUTO = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0";
const ZS = JSON.parse(fs.readFileSync(path.join(root, "app/data/zoning_standards.json"), "utf8"));
const NYC = ZS.jurisdictions.find((j) => j.id === "nyc");
const fmtN = (v) => Math.round(v).toLocaleString("en-US");

// Small boxes in low-density neighborhoods of each borough (2 lots each, different districts where the box has them).
const BOXES = [
  { fips: "36081", name: "Queens (Hollis Hills / Bayside)", box: [-73.77, 40.73, -73.75, 40.745] },
  { fips: "36085", name: "Staten Island (Westerleigh / Todt Hill)", box: [-74.14, 40.60, -74.10, 40.62] },
  { fips: "36047", name: "Brooklyn (Marine Park / Midwood)", box: [-73.95, 40.605, -73.92, 40.625] },
  { fips: "36005", name: "Bronx (Riverdale / Throggs Neck)", box: [-73.915, 40.885, -73.895, 40.90] },
];
// R6-R10 (added 17 Nov 2026): boxes in four boroughs with mid- and high-density residence districts. One- and
// two-family houses and apartment buildings (PLUTO LandUse 01-03) are both sampled; apartment buildings get the
// district's floor area but no house-only rows.
const HIGH_BOXES = [
  { fips: "36047", name: "Brooklyn (Park Slope / Prospect Heights)", box: [-73.985, 40.665, -73.965, 40.68] },
  { fips: "36061", name: "Manhattan (Upper West Side)", box: [-73.985, 40.78, -73.965, 40.795] },
  { fips: "36081", name: "Queens (Jackson Heights / Elmhurst)", box: [-73.895, 40.745, -73.875, 40.76] },
  { fips: "36005", name: "Bronx (Grand Concourse)", box: [-73.925, 40.825, -73.91, 40.84] },
];
const isHigh = (z) => !!(NYC.districts[z] && NYC.districts[z].tier === "R6-R12" && !NYC.districts[z].commercial);
// Commercial districts (added 17 Nov 2026): residential lots (PLUTO LandUse 01-03) mapped in C districts, in boxes in
// four boroughs, plus the only R11 / R12 equivalents mapped (C6-11, C6-12; MapPLUTO has no R11, R11A or R12 lots), and
// lots with a C1 or C2 overlay on a residence district (MapPLUTO Overlay1).
const COMM_BOXES = [
  { fips: "36047", name: "Brooklyn (Flatbush / Fulton St)", box: [-73.965, 40.64, -73.945, 40.69] },
  { fips: "36081", name: "Queens (Jamaica / Flushing)", box: [-73.84, 40.69, -73.79, 40.77] },
  { fips: "36005", name: "Bronx (Fordham / Grand Concourse)", box: [-73.91, 40.84, -73.88, 40.87] },
  { fips: "36085", name: "Staten Island (St. George / Port Richmond)", box: [-74.16, 40.60, -74.06, 40.65] },
  { fips: "36061", name: "Manhattan (Upper West Side)", box: [-73.99, 40.77, -73.96, 40.80] },
];
const OVERLAY_BOXES = [
  { fips: "36081", name: "Queens (Bayside / Fresh Meadows)", box: [-73.80, 40.72, -73.75, 40.77] },
  { fips: "36085", name: "Staten Island (New Dorp / Great Kills)", box: [-74.16, 40.54, -74.10, 40.59] },
];
const isComm = (z) => !!(NYC.districts[z] && NYC.districts[z].commercial);
const OTHER = [
  { fips: "48453", name: "Travis TX, 809 Park Blvd (Austin: code on Municode, withheld)", lat: 30.301426, lng: -97.722411 },
  { fips: "01073", name: "Jefferson AL (no standards read)", lat: 33.4877, lng: -86.7697 },
];

// Washington, DC: the zone is read from DC's zoning map at the point, the lot area and use from OTR's parcel layer,
// the house's gross floor area from OTR's residential CAMA. Boxes in neighborhoods with R-1A, R-1B, R-2, R-3 and a
// geographically modified zone (R-3/GT in Burleith), single-family use codes only.
const DC = ZS.jurisdictions.find((j) => j.id === "dc");
const DC_PARCELS = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40";
const DC_CAMA = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/25";
const DC_BOXES = [
  { name: "Chevy Chase DC", box: [-77.08, 38.96, -77.06, 38.97] },
  { name: "Spring Valley", box: [-77.10, 38.935, -77.09, 38.942] },
  { name: "Burleith", box: [-77.078, 38.912, -77.070, 38.916] },
  { name: "Chevy Chase DC, Connecticut Ave row houses", box: [-77.0745, 38.9600, -77.0725, 38.9615] },
];
// Nashville: the use is the Assessor's LUDesc; no local standards are read (Municode 403), so the reason is shown.
const NASH = "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0";
const USES = JSON.parse(fs.readFileSync(path.join(root, "app/data/parcel_use_codes.json"), "utf8"));

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.json(); } catch {}
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}
async function getText(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (city-pretty live check)" }, signal: AbortSignal.timeout(90000) }); if (r.ok) return await r.text(); } catch {}
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  return null;
}
const flat = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&ldquo;|&#8220;/g, "“").replace(/&rdquo;|&#8221;/g, "”").replace(/&#8211;|&ndash;/g, "–").replace(/\s+/g, " ").replace(/ ([,.;:)])/g, "$1");

const LOW_WHERE = "LandUse='01' AND (ZoneDist1 LIKE 'R1%' OR ZoneDist1 LIKE 'R2%' OR ZoneDist1 LIKE 'R3%' OR ZoneDist1 LIKE 'R4%' OR ZoneDist1 LIKE 'R5%')";
const HIGH_WHERE = "LandUse IN ('01','02','03') AND (ZoneDist1 LIKE 'R6%' OR ZoneDist1 LIKE 'R7%' OR ZoneDist1 LIKE 'R8%' OR ZoneDist1 LIKE 'R9%' OR ZoneDist1 LIKE 'R10%')";
async function sampleLots(b, where = LOW_WHERE, per = 2) {
  const q = new URLSearchParams({ where,
    geometry: b.box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "BBL,Address,ZoneDist1,LotArea,LotFront,BldgArea,UnitsRes,LandUse", returnGeometry: "true", outSR: "4326", resultRecordCount: "400", f: "json" });
  const d = await getJson(`${PLUTO}/query?${q}`);
  const feats = (d && d.features || []).filter((f) => f.geometry && f.geometry.rings && NYC.districts[f.attributes.ZoneDist1]);
  const byDist = {};
  for (const f of feats) (byDist[f.attributes.ZoneDist1] ||= []).push(f);
  const picks = Object.values(byDist).map((fs_) => fs_[Math.floor(fs_.length / 2)]).slice(0, per);
  return picks.map((f) => {
    const r = f.geometry.rings[0], n = r.length - 1;
    return { lat: r.slice(0, n).reduce((s, p) => s + p[1], 0) / n, lng: r.slice(0, n).reduce((s, p) => s + p[0], 0) / n, pluto_sample: f.attributes };
  });
}
async function plutoAt(lat, lng) {
  const d = await getJson(`${PLUTO}/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "BBL,Address,LandUse,ZoneDist1,LotArea,LotFront,BldgArea,UnitsRes", returnGeometry: "false", f: "json" }));
  return d && d.features && d.features[0] ? d.features[0].attributes : null;
}

// Re-fetch every section the NYC rules cite and confirm each quote / table row is still in the code's text.
async function verifyQuotes() {
  const pages = {}, out = [];
  const need = (url, what, text) => out.push({ url, what, text });
  const D = NYC.districts;
  for (const [dd, r] of Object.entries(D)) {
    if (r.tier === "R6-R12" || r.commercial) continue;   // verifyHighRows(), verifyCommercial()
    if (r.housing_types.limited_to) need(r.housing_types.url, `${dd} housing types`, r.housing_types.quote);
    need(r.min_lot.url, `${dd} min lot`, r.min_lot.row.split(" | ")[0]);
    need(r.far.url, `${dd} FAR`, r.far.row.split(" | ")[0]);
    need(r.height.url, `${dd} height`, r.height.quote);
  }
  need(NYC.adu.url, "ADU definition", NYC.adu.quote);
  need(NYC.qualifying_residential_site.url, "qualifying residential site", NYC.qualifying_residential_site.quote);
  const seen = new Map();
  for (const o of out) {
    const key = `${o.url}||${o.text}`;
    if (seen.has(key)) continue;
    if (!(o.url in pages)) { const h = await getText(o.url); pages[o.url] = h ? flat(h) : null; }
    const t = pages[o.url];
    // " … " joins sentences that are not adjacent in the code; each part must be there.
    seen.set(key, { url: o.url, what: o.what, found: t == null ? null : o.text.split(" … ").every((part) => t.includes(part)) });
  }
  return [...seen.values()];
}

// The same superscript-aware cell text as scripts/build_zoning_standards.py (sup_text): "R6<sup>1</sup>" -> "R6^1".
const supText = (h) => h.replace(/<sup[^>]*>(?:\s|<[^>]+>)*(\d)(?:\s|<[^>]+>)*<\/sup>/g, "^$1").replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0/g, " ")
  .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().replace(/\s*\^/g, "^").replace(/(R\d+)\s+-\s*(\d)/g, "$1-$2");
const liveRows = (h) => (h.match(/<tr[\s\S]*?<\/tr>/g) || []).map((tr) => (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).map((c) => supText(c.replace(/^<t[dh][^>]*>|<\/t[dh]>$/g, ""))));
// R6-R12: re-fetch 22-121, 23-12, 23-22 and 23-432 and confirm every row the data was parsed from is still a row of the
// live table, and that 22-121 still marks every residence type "●" in the R6-R12 columns.
async function verifyHighRows() {
  const out = [], pages = {};
  const rowsOf = async (url) => (url in pages ? pages[url] : (pages[url] = await getText(url).then((h) => h ? liveRows(h).map((r) => r.join(" | ")) : null)));
  const want = new Map();
  for (const [dd, r] of Object.entries(NYC.districts)) {
    if (r.tier !== "R6-R12" || r.commercial) continue;
    for (const x of [r.min_lot, r.min_lot_other_residences]) want.set(`${x.url}||${x.row}`, { url: x.url, what: `${dd} min lot`, row: x.row });
    for (const o of [...r.far.options.standard, ...r.far.options.qualifying]) want.set(`${r.far.url}||${o.row}`, { url: r.far.url, what: `${dd} FAR`, row: o.row });
    for (const o of [...r.height.options.standard, ...r.height.options.qualifying]) want.set(`${r.height.url}||${o.row}`, { url: r.height.url, what: `${dd} height`, row: o.row });
  }
  for (const w of want.values()) {
    const rows = await rowsOf(w.url);
    out.push({ url: w.url, what: w.what, row: w.row, found: rows == null ? null : rows.includes(w.row) });
  }
  const u = "https://zr.planning.nyc.gov/article-ii/chapter-2/22-121", h = await getText(u);
  if (h) {
    const rows = liveRows(h), head = rows.find((r) => r[0] === "Uses" && r[1] === "R1");
    const res = rows.filter((r) => r.length >= 13 && r.slice(-12).every((c) => /^[●♦○–SP ]+$/.test(c)));
    out.push({ url: u, what: "22-121: every residence type ● in R6-R12", found: !!head && res.length === 5 && res.every((r) => r.slice(-12).slice(5, 12).every((c) => c === "●")) });
  } else out.push({ url: u, what: "22-121", found: null });
  return out;
}

// Commercial districts: re-fetch 32-121, 32-122, 32-123, 34-01, 34-03, 34-111, 34-112, 34-221, 35-62 and 35-632 and confirm
// every quote is still in the section's text and every 34-112 row used is still a row of the live table.
const norm = (t) => t.replace(/non- /g, "non-").replace(/\s+/g, " ");
async function verifyCommercial() {
  const pages = {}, out = [];
  const textOf = async (u) => (u in pages ? pages[u] : (pages[u] = await getText(u).then((h) => h ? { flat: norm(flat(h)), rows: liveRows(h).map((r) => r.join(" | ")) } : null)));
  const want = new Map();
  const q = (url, what, text) => want.set(`${url}||${text}`, { url, what, text });
  for (const [z, r] of Object.entries(NYC.districts)) {
    if (!r.commercial) continue;
    const C = r.commercial;
    if (C.how.section.startsWith("34-112")) {
      const row = C.how.quote.split("table: ")[1].split(" (")[0];
      want.set(`${C.how.url}||row||${row}`, { url: C.how.url, what: `${z} residential equivalent row`, row });
      q(C.how.url, "34-112 sentence", C.how.quote.split(" table: ")[0] + " table:");
    } else q(C.how.url, `${z} ${C.how.section}`, C.how.quote);
    q(C.residential_only.url, "34-01", C.residential_only.quote);
    q(C.bonus.url, "34-221", C.bonus.quote);
    if (r.housing_types.section !== "32-121") q(r.housing_types.url, `${z} housing types`, r.housing_types.quote);
    if (r.housing_types.condition) q(r.housing_types.url.replace("32-121", "32-123"), `${z} 32-123`, r.housing_types.condition);
    if (r.height.withheld) q(r.height.url, `${z} 35-62`, r.height.quote);
    if (r.height.commercial_note) q(r.height.commercial_note.url, `${z} ${r.height.commercial_note.section}`, r.height.commercial_note.quote);
  }
  const O = NYC.commercial_overlay;
  q(O.url, "34-111", O.quote);
  q(O.height_url, "35-62", O.height_quote);
  for (const w of want.values()) {
    const t = await textOf(w.url);
    out.push({ url: w.url, what: w.what, found: t == null ? null : w.row ? t.rows.includes(w.row) : t.flat.includes(norm(w.text)) });
  }
  // 32-121: residence types by commercial district, as the data says (C1, C2, C5, C6 all ●; C4 ● P; C3 ●/♦; C7, C8 –).
  const u = "https://zr.planning.nyc.gov/article-iii/chapter-2/32-121", h = await textOf(u);
  if (h) {
    const res = h.rows.map((r) => r.split(" | ")).filter((r) => r.length >= 9 && r.slice(-8).every((c) => /^[●♦○–SPU ]+$/.test(c))).map((r) => r.slice(-8));
    const col = (i) => res.map((r) => r[i]);
    out.push({ url: u, what: "32-121 residence types by commercial district", found: res.length === 5 && [0, 1, 4, 5].every((i) => col(i).every((c) => c === "●")) &&
      col(3).every((c) => c === "● P") && col(6).concat(col(7)).every((c) => c === "–") && col(2).join(",") === "●,♦,●,♦,♦" });
  } else out.push({ url: u, what: "32-121", found: null });
  return out;
}
async function sampleComm(b, per = 3) {
  const q = new URLSearchParams({ where: "LandUse IN ('01','02','03') AND ZoneDist1 LIKE 'C%'",
    geometry: b.box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "BBL,ZoneDist1", returnGeometry: "false", returnCentroid: "true", outSR: "4326", resultRecordCount: "1000", f: "json" });
  const d = await getJson(`${PLUTO}/query?${q}`);
  const feats = (d && d.features || []).filter((f) => f.centroid && isComm(f.attributes.ZoneDist1));
  const byDist = {};
  for (const f of feats) (byDist[f.attributes.ZoneDist1] ||= []).push(f);
  // prefer one R1-R5-equivalent district (C3, C3A, C4-1) when the box has one, then the others
  const keys = Object.keys(byDist).sort((a, b_) => (NYC.districts[a].tier === "R6-R12") - (NYC.districts[b_].tier === "R6-R12"));
  return keys.slice(0, per).map((k) => { const f = byDist[k][Math.floor(byDist[k].length / 2)]; return { lat: f.centroid.y, lng: f.centroid.x }; });
}
async function sampleWhere(where, per, box) {
  const q = new URLSearchParams({ where, outFields: "BBL,ZoneDist1,Overlay1", returnGeometry: "false", returnCentroid: "true", outSR: "4326", resultRecordCount: "200", f: "json",
    ...(box ? { geometry: box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}) });
  const d = await getJson(`${PLUTO}/query?${q}`);
  const feats = (d && d.features || []).filter((f) => f.centroid);
  const byDist = {};
  for (const f of feats) (byDist[`${f.attributes.ZoneDist1}/${f.attributes.Overlay1 || ""}`] ||= []).push(f);
  return Object.values(byDist).slice(0, per).map((fs_) => { const f = fs_[Math.floor(fs_.length / 2)]; return { lat: f.centroid.y, lng: f.centroid.x }; });
}
async function plutoFull(lat, lng) {
  const d = await getJson(`${PLUTO}/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "BBL,Address,LandUse,ZoneDist1,Overlay1,Overlay2,SPDist1,SPDist2,LotArea,LotFront,BldgArea,UnitsRes", returnGeometry: "false", f: "json" }));
  return d && d.features && d.features.length === 1 ? d.features[0].attributes : null;
}
function expectedNycComm(lot) {
  const z = lot.ZoneDist1, r = NYC.districts[z], C = r.commercial;
  const exp = [`Zoning district ${z} (New York City Zoning Resolution)`, `Commercial district ${z}`, `${z} takes the residential rules of ${C.equivalent}`,
    "a mixed residential and commercial building isn't checked here"];
  if (C.how.section.startsWith("34-112")) exp.push(C.how.quote.split("table: ")[1].split(" (")[0]);
  if (r.tier === "R6-R12") {
    exp.push(...expectedNycHigh(lot).filter((e) => !/^Zoning district|every type of residence|^Second home|an apartment building/.test(e)));
    exp.push(`every type of residence is permitted in ${z} (ZR 32-121)`);
  } else {
    exp.push(`${fmtN(r.min_lot.area_sqft)} sq ft and ${r.min_lot.width_ft} ft wide (ZR 23-11)`);
    exp.push(r.height.withheld ? "Height: not shown. ZR 35-62 modifies" : `Height: up to ${r.height.max_height_ft} ft`);
    if (lot.LotArea > 0) exp.push(`Up to ${fmtN(r.far.standard * lot.LotArea)} sq ft of floor area on this ${fmtN(lot.LotArea)} sq ft lot (FAR ${r.far.standard.toFixed(2)}, ZR 23-21)`);
  }
  if (lot.SPDist1) exp.push(`MapPLUTO records special purpose district ${lot.SPDist1}`);
  return exp;
}
function expectedOverlay(lot) {
  const z = lot.ZoneDist1, w = NYC.commercial_overlay.within[z], ov = lot.Overlay1;
  const exp = [`Commercial overlay ${ov}${lot.Overlay2 ? ", " + lot.Overlay2 : ""}`, `MapPLUTO records a ${ov}`];
  exp.push(w.bulk_from !== z ? `within the overlay this ${z} lot takes ${w.bulk_from}'s floor area, lot and height rules`
    : w.height_from_non_qrs ? `on a lot that isn't a qualifying residential site the height rules are ${w.height_from_non_qrs}'s` : `So within the overlay the ${z} rules shown here stand`);
  return exp;
}

const USE_NYC = () => USES.systems.find((s) => s.id === "nyc_pluto_landuse");
function expectedNycHigh(lot) {
  const z = lot.ZoneDist1, r = NYC.districts[z], so = r.far.options.standard, qo = r.far.options.qualifying, hs = r.height.options.standard, hq = r.height.options.qualifying;
  const cond = (o, opts) => o.condition ? o.condition.replace(/^For /, "for ").replace(/^Outside /, "outside ") : (opts.some((x) => x.condition) ? "for other lots" : "");
  const farTxt = (opts) => opts.map((o) => `${o.far.toFixed(2)}${cond(o, opts) ? ` ${cond(o, opts)}` : ""}`).join("; ");
  const htTxt = (opts) => opts.map((o) => `base ${o.min_base_ft}–${o.max_base_ft} ft, building up to ${o.max_height_ft} ft${cond(o, opts) ? ` ${cond(o, opts)}` : ""}`).join("; ");
  const use = USE_NYC().codes[lot.LandUse];
  const exp = [`Zoning district ${z} (New York City Zoning Resolution)`, use.label, `every type of residence is permitted in ${z} (ZR 22-121)`,
    `Minimum lot: ${fmtN(r.min_lot.area_sqft)} sq ft and ${r.min_lot.width_ft} ft wide for a detached or zero-lot-line one- or two-family home`,
    `Height, standard residences: ${htTxt(hs)}; qualifying affordable or senior housing: ${htTxt(hq)} (ZR 23-432)`,
    `Floor area ratio, standard residences: ${farTxt(so)}; qualifying affordable or senior housing: ${farTxt(qo)} (ZR 23-22)`];
  if (lot.LotArea > 0) {
    const fl = Math.min(...so.map((o) => o.far));
    exp.push(`For standard residences, up to ${fmtN(fl * lot.LotArea)} sq ft of floor area on this ${fmtN(lot.LotArea)} sq ft lot (FAR ${fl.toFixed(2)}`);
  }
  if (use.form === "multi-family") exp.push("an apartment building");
  else exp.push(`Second home (two-family or more)`);
  return exp;
}

function expectedNyc(P, lot) {
  const r = NYC.districts[lot.ZoneDist1];
  const exp = [`Zoning district ${lot.ZoneDist1} (New York City Zoning Resolution)`, "One & Two Family Buildings",
    `${fmtN(r.min_lot.area_sqft)} sq ft and ${r.min_lot.width_ft} ft wide (ZR 23-11)`,
    `Height: up to ${r.height.max_height_ft} ft`,
    r.housing_types.limited_to ? `limited to ${r.housing_types.limited_to} (ZR 22-122)` : "no limit on the type of residence",
    `Ancillary dwelling unit (ADU, up to 800 sq ft)`];
  if (lot.LotArea > 0) exp.push(`Up to ${fmtN(r.far.standard * lot.LotArea)} sq ft of floor area on this ${fmtN(lot.LotArea)} sq ft lot (FAR ${r.far.standard.toFixed(2)}, ZR 23-21)`);
  return exp;
}

const centroid = (f) => { const r = f.geometry.rings[0], n = r.length - 1; return { lat: r.slice(0, n).reduce((s, p) => s + p[1], 0) / n, lng: r.slice(0, n).reduce((s, p) => s + p[0], 0) / n }; };
async function dcZoneAt(lat, lng) {
  const d = await getJson(`${DC.zone_source.url}/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "ZONING", returnGeometry: "false", f: "json" }));
  return d && d.features && d.features[0] ? d.features[0].attributes.ZONING : null;
}
async function dcSample(b, seen) {
  const d = await getJson(`${DC_PARCELS}/query?` + new URLSearchParams({ where: "USECODE IN ('011','012','013')", geometry: b.box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "SSL,PREMISEADD,USECODE,LANDAREA", returnGeometry: "true", outSR: "4326", resultRecordCount: "40", f: "json" }));
  const out = [];
  for (const f of (d && d.features) || []) {
    if (out.length >= 2) break;
    const c = centroid(f), zone = await dcZoneAt(c.lat, c.lng);
    if (!zone || seen.has(zone)) continue;
    const base = zone.split("/")[0];
    if (!DC.districts[base]) continue;
    seen.add(zone);
    out.push({ ...c, zone, parcel: f.attributes });
  }
  return out;
}
async function dcParcelAt(lat, lng) {
  const d = await getJson(`${DC_PARCELS}/query?` + new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "SSL,PREMISEADD,USECODE,LANDAREA", returnGeometry: "false", f: "json" }));
  const p = d && d.features && d.features[0] ? d.features[0].attributes : null;
  if (!p) return null;
  const c = await getJson(`${DC_CAMA}/query?` + new URLSearchParams({ where: `SSL='${p.SSL.replace(/'/g, "''")}' AND BLDG_NUM=1`, outFields: "GBA", returnGeometry: "false", f: "json" }));
  p.GBA = c && c.features && c.features[0] ? c.features[0].attributes.GBA : null;
  return p;
}
function expectedDc(zone, p) {
  const sys = USES.systems.find((s) => s.id === "dc_otr_usecode"), use = sys.codes[p.USECODE];
  if (zone.includes("/")) return [`a geographically modified version of ${zone.split("/")[0]}`, use.label];
  const r = DC.districts[zone], exp = [`Zoning district ${zone} (${DC.code})`, use.label, r.purpose.quote,
    `Height: up to ${r.height.max_height_ft} ft and ${r.height.max_stories} stories`,
    "One principal dwelling unit and one accessory apartment are allowed per lot of record",
    ...r.min_lot.map((m) => `${fmtN(m.area_sqft)} sq ft and ${m.width_ft} ft wide`), "Accessory apartment (ADU)"];
  const rowHouse = /\bRow\b/.test(use.label);
  const occ = (rowHouse && r.lot_occupancy.find((x) => /Row Building/.test(x.structure))) || r.lot_occupancy.find((x) => /All Other/.test(x.structure));
  if (p.LANDAREA > 0) exp.push(`Up to ${occ.max_pct}% lot occupancy`, `about ${fmtN(occ.max_pct / 100 * p.LANDAREA)} sq ft of building footprint on this ${fmtN(p.LANDAREA)} sq ft lot`);
  const g = DC.accessory_apartment.min_gfa[zone];
  if (g && p.GBA > 0) exp.push(`${fmtN(g.sqft)} sq ft of gross floor area`, `OTR records ${fmtN(p.GBA)} sq ft`);
  return exp;
}

// DC sections are Word files: re-download each cited file and confirm each quote / table row is still in it.
async function verifyDcQuotes() {
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  const files = {}, out = [];
  const textOf = async (url) => {
    if (url in files) return files[url];
    let t = null;
    for (let i = 0; i < 3 && t == null; i++) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (city-pretty live check)" }, signal: AbortSignal.timeout(90000) });
        if (!r.ok) continue;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcmr-")), p = path.join(dir, "s.doc");
        fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
        execFileSync("soffice", ["--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", dir, p], { stdio: "ignore", timeout: 240000 });
        t = fs.readFileSync(path.join(dir, "s.txt"), "utf8").replace(/^﻿/, "").replace(/\s+/g, " ");
        fs.rmSync(dir, { recursive: true, force: true });
      } catch { await new Promise((res) => setTimeout(res, 2000)); }
    }
    return (files[url] = t);
  };
  const need = (x, what, text) => out.push({ file: x.text_file, section: x.section, what, text });
  for (const [z, r] of Object.entries(DC.districts)) {
    need(r.purpose, `${z} purpose`, r.purpose.quote);
    need(r.dwelling_units, `${z} dwelling units`, r.dwelling_units.quote);
    // a table row's zone cell can sit on an earlier line (rows that share it), so the structure and numbers are checked
    for (const m of r.min_lot) need(m, `${z} min lot`, `${m.structure} ${m.width_ft} ${fmtN(m.area_sqft)}`);
    need(r.height, `${z} height`, `${r.height.row.split(" | ").slice(-3).join(" ")}`);
    for (const o of r.lot_occupancy) need(o, `${z} lot occupancy`, `${o.structure} ${o.max_pct}`);
  }
  for (const [k, q] of Object.entries(DC.accessory_apartment.quotes)) need(DC.accessory_apartment, `accessory apartment ${k}`, q);
  for (const [z, g] of Object.entries(DC.accessory_apartment.min_gfa)) need(DC.accessory_apartment, `accessory apartment min GFA ${z}`, g.row.replace(" | ", " "));
  need(DC.overlay_rule, "overlay rule", DC.overlay_rule.quote);
  const seen = new Map();
  for (const o of out) {
    const key = `${o.file}||${o.text}`;
    if (seen.has(key)) continue;
    const t = await textOf(o.file);
    seen.set(key, { section: o.section, what: o.what, found: t == null ? null : t.includes(o.text.replace(/\s+/g, " ")) });
  }
  return [...seen.values()];
}

function serve() { return spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" }); }

async function openHouse(page, fips, ll) {
  await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
  await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, fips, { timeout: 180000 }).catch(() => {});
  await page.waitForFunction(() => { try { return !!(0, eval)("ZONING_STANDARDS") && !!(0, eval)("PARCEL_USE_CODES"); } catch { return false; } }, null, { timeout: 30000 });
  await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
  await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && /Zoning district|Local zoning standards|Home upgrades|did not answer|Couldn.t get this lot|Right-of-Way/.test(b.innerText); }, null, { timeout: 90000 }).catch(() => {});
  return page.evaluate(() => { const b = document.querySelector("#house"); return b ? b.innerText : ""; });
}

async function main() {
  const srv = serve();
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const results = { ran_on: new Date().toISOString(), script: "scripts/live_check_lot_fit.mjs", nyc: [], other: [], quotes: null };
  try {
    results.quotes = await verifyQuotes();
    results.high_rows = await verifyHighRows();
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    for (const b of process.env.LIVE_ONLY_OTHER === "1" ? [] : BOXES) {
      for (const P of await sampleLots(b)) {
        const lot = await plutoAt(P.lat, P.lng);
        const row = { county: b.fips, area: b.name, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), pluto: lot };
        if (!lot || !NYC.districts[lot.ZoneDist1]) { row.skipped = "point not inside an R1-R5 one/two-family lot when re-queried"; results.nyc.push(row); continue; }
        const text = await openHouse(page, b.fips, { lat: P.lat, lng: P.lng });
        const exp = expectedNyc(P, lot);
        row.missing = exp.filter((e) => !text.includes(e));
        row.ok = row.missing.length === 0;
        row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Floor area|Second home|Split into two|Ancillary|Height limit|One & Two/.test(l)).join("\n").slice(0, 1500);
        results.nyc.push(row);
        console.log(b.fips, lot.ZoneDist1, lot.Address, row.ok ? "OK" : "MISSING " + JSON.stringify(row.missing));
      }
    }
    results.nyc_high = [];
    for (const b of process.env.LIVE_ONLY_OTHER === "1" ? [] : HIGH_BOXES) {
      for (const P of await sampleLots(b, HIGH_WHERE, 3)) {
        const lot = await plutoAt(P.lat, P.lng);
        const row = { county: b.fips, area: b.name, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), pluto: lot };
        if (!lot || !isHigh(lot.ZoneDist1) || !["01", "02", "03"].includes(lot.LandUse)) { row.skipped = "point not inside an R6-R10 residential lot when re-queried"; results.nyc_high.push(row); continue; }
        const text = await openHouse(page, b.fips, { lat: P.lat, lng: P.lng });
        const exp = expectedNycHigh(lot);
        row.missing = exp.filter((e) => !text.includes(e));
        const mf = USE_NYC().codes[lot.LandUse].form === "multi-family";
        row.house_rows_on_apartment_building = mf && /Second home \(two-family or more\)|Swimming pool|Detached ADU/.test(text);
        row.null_height = /null ft|NaN/.test(text);
        row.ok = row.missing.length === 0 && !row.house_rows_on_apartment_building && !row.null_height;
        row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Floor area|Second home|Split into two|Height limit|apartment building|Family/.test(l)).join("\n").slice(0, 2000);
        results.nyc_high.push(row);
        console.log(b.fips, lot.ZoneDist1, lot.LandUse, lot.Address, row.ok ? "OK" : "MISSING " + JSON.stringify({ missing: row.missing, house_rows: row.house_rows_on_apartment_building, null_height: row.null_height }));
      }
    }
    results.commercial_quotes = await verifyCommercial();
    results.nyc_commercial = [];
    const commPoints = [];
    for (const b of process.env.LIVE_ONLY_OTHER === "1" ? [] : COMM_BOXES) for (const P of await sampleComm(b)) commPoints.push({ ...P, fips: b.fips, area: b.name });
    for (const P of await sampleWhere("ZoneDist1 IN ('C6-11','C6-12','C4-11','C4-11A','C4-12')", 3)) commPoints.push({ ...P, fips: "36061", area: "R11 / R12 equivalents (citywide)" });
    for (const P of commPoints) {
      const lot = await plutoFull(P.lat, P.lng);
      const row = { county: P.fips, area: P.area, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), pluto: lot };
      if (!lot || !isComm(lot.ZoneDist1)) { row.skipped = "point not inside a mapped commercial lot when re-queried"; results.nyc_commercial.push(row); continue; }
      const fips = { 1: "36061", 2: "36005", 3: "36047", 4: "36081", 5: "36085" }[String(lot.BBL)[0]];
      row.county = fips;
      const text = await openHouse(page, fips, { lat: P.lat, lng: P.lng });
      const res = ["01", "02", "03"].includes(lot.LandUse);
      const exp = res ? expectedNycComm(lot) : [];
      row.missing = exp.filter((e) => !text.includes(e));
      row.null_value = /null ft|NaN|undefined/.test(text);
      row.ok = res && row.missing.length === 0 && !row.null_value;
      if (!res) row.skipped = `LandUse ${lot.LandUse} (not residential), so the home checks don't run`;
      row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Commercial district|Floor area|Height|Second home|Special purpose|Commercial overlay|ADU/.test(l)).join("\n").slice(0, 2500);
      results.nyc_commercial.push(row);
      console.log(fips, lot.ZoneDist1, "->", NYC.districts[lot.ZoneDist1].commercial.equivalent, lot.LandUse, lot.Address, row.skipped ? "SKIP " + row.skipped : row.ok ? "OK" : "MISSING " + JSON.stringify({ missing: row.missing, null_value: row.null_value }));
    }
    results.nyc_overlay = [];
    for (const b of process.env.LIVE_ONLY_OTHER === "1" ? [] : OVERLAY_BOXES) {
      for (const P of await sampleWhere("LandUse='01' AND Overlay1 LIKE 'C%' AND (ZoneDist1 LIKE 'R2%' OR ZoneDist1 LIKE 'R3%' OR ZoneDist1 LIKE 'R4%' OR ZoneDist1 LIKE 'R5%' OR ZoneDist1 LIKE 'R6%')", 3, b.box)) {
        const lot = await plutoFull(P.lat, P.lng);
        const row = { county: b.fips, area: b.name, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), pluto: lot };
        if (!lot || !lot.Overlay1 || !NYC.commercial_overlay.within[lot.ZoneDist1]) { row.skipped = "point not inside an overlay lot of a covered district when re-queried"; results.nyc_overlay.push(row); continue; }
        const text = await openHouse(page, b.fips, { lat: P.lat, lng: P.lng });
        const exp = [...expectedOverlay(lot), `Zoning district ${lot.ZoneDist1} (New York City Zoning Resolution)`];
        row.missing = exp.filter((e) => !text.includes(e));
        row.ok = row.missing.length === 0;
        row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Commercial overlay|Special purpose/.test(l)).join("\n").slice(0, 2000);
        results.nyc_overlay.push(row);
        console.log(b.fips, lot.ZoneDist1, "+", lot.Overlay1, lot.Address, row.ok ? "OK" : "MISSING " + JSON.stringify(row.missing));
      }
    }
    results.dc_quotes = await verifyDcQuotes();
    results.dc = [];
    const seenZ = new Set();
    for (const b of DC_BOXES) {
      for (const P of await dcSample(b, seenZ)) {
        const zone = await dcZoneAt(P.lat, P.lng), p = await dcParcelAt(P.lat, P.lng);
        const row = { county: "11001", area: b.name, lat: +P.lat.toFixed(6), lng: +P.lng.toFixed(6), zone, parcel: p };
        if (!zone || !p) { row.skipped = "zone or parcel not found when re-queried"; results.dc.push(row); continue; }
        const text = await openHouse(page, "11001", { lat: P.lat, lng: P.lng });
        const exp = expectedDc(zone, p);
        row.missing = exp.filter((e) => !text.includes(e));
        row.ok = row.missing.length === 0;
        row.panel_excerpt = text.split("\n").filter((l) => /Zoning district|Lot coverage|Second home|Split into two|Accessory apartment|Height limit|Residential-|geographically modified|Local zoning/.test(l)).join("\n").slice(0, 1800);
        results.dc.push(row);
        console.log("11001", zone, p.PREMISEADD, row.ok ? "OK" : "MISSING " + JSON.stringify(row.missing));
      }
    }
    // Nashville: a single-family lot from Metro's own layer.
    results.nashville = [];
    {
      const d = await getJson(`${NASH}/query?` + new URLSearchParams({ where: "LUDesc='SINGLE FAMILY'", geometry: "-86.80,36.12,-86.78,36.14", geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "ParID,PropAddr,LUDesc,Zoning", returnGeometry: "true", outSR: "4326", resultRecordCount: "5", f: "json" }));
      for (const f of ((d && d.features) || []).slice(0, 2)) {
        const c = centroid(f), text = await openHouse(page, "47037", c);
        const row = { county: "47037", lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), parcel: f.attributes };
        row.use_decoded = text.includes("SINGLE FAMILY (Metro Nashville Parcels");
        row.shows_reason = /Nashville \/ Davidson County: Metro Nashville's Zoning Code \(Title 17\) is published on Municode/.test(text);
        row.home_checks_run = !/doesn't record this lot's use/.test(text) && /Detached ADU|Interior accessory suite|Swimming pool/.test(text);
        row.ok = row.use_decoded && row.shows_reason && row.home_checks_run;
        row.excerpt = text.split("\n").filter((l) => /Local zoning|Not on file|SINGLE FAMILY|Home upgrades/.test(l)).join("\n").slice(0, 800);
        results.nashville.push(row);
        console.log("47037", f.attributes.PropAddr, row.ok ? "OK" : JSON.stringify({ use: row.use_decoded, reason: row.shows_reason, checks: row.home_checks_run }));
      }
    }
    for (const o of OTHER) {
      const text = await openHouse(page, o.fips, { lat: o.lat, lng: o.lng });
      const row = { county: o.fips, area: o.name, lat: o.lat, lng: o.lng };
      row.shows_not_on_file = /Local zoning standards\s*Not on file/.test(text) || text.includes("Not on file: ");
      row.unknown_use = /doesn't record this lot's use/.test(text);
      row.excerpt = text.split("\n").filter((l) => /Local zoning|Not on file|Home upgrades|doesn't record/.test(l)).join("\n").slice(0, 800);
      if (!row.excerpt) row.panel_start = text.slice(0, 600);
      results.other.push(row);
      console.log(o.fips, row.shows_not_on_file ? "not-on-file shown" : row.unknown_use ? "use unknown (checks not run)" : "NOT SHOWN");
    }
    results.page_errors = errors;
  } finally {
    await browser.close();
    srv.kill();
  }
  const day = new Date().toISOString().slice(0, 10);
  const out = path.join(root, `data/backtests/live_check_lot_fit_${day}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  const q = results.quotes;
  const hr = results.high_rows || [], nh = results.nyc_high || [], cq = results.commercial_quotes || [], nc = results.nyc_commercial || [], no = results.nyc_overlay || [];
  console.log(`quotes found ${q.filter((x) => x.found).length}/${q.length}; nyc ok ${results.nyc.filter((r) => r.ok).length}/${results.nyc.filter((r) => !r.skipped).length}; ` +
    `R6-R12 rows found ${hr.filter((x) => x.found).length}/${hr.length}; R6-R12 lots ok ${nh.filter((r) => r.ok).length}/${nh.filter((r) => !r.skipped).length} in ${new Set(nh.filter((r) => !r.skipped).map((r) => r.county)).size} boroughs; ` +
    `commercial quotes ${cq.filter((x) => x.found).length}/${cq.length}; commercial lots ok ${nc.filter((r) => r.ok).length}/${nc.filter((r) => !r.skipped).length} in ${new Set(nc.filter((r) => !r.skipped).map((r) => r.county)).size} boroughs; ` +
    `overlay lots ok ${no.filter((r) => r.ok).length}/${no.filter((r) => !r.skipped).length}; ` +
    `dc quotes ${results.dc_quotes.filter((x) => x.found).length}/${results.dc_quotes.length}; dc ok ${results.dc.filter((r) => r.ok).length}/${results.dc.filter((r) => !r.skipped).length}; ` +
    `nashville ok ${results.nashville.filter((r) => r.ok).length}/${results.nashville.length}; wrote ${out}`);
}
main();
