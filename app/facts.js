// Live public records for a point, shown in the parcel panel with a link to each exact query.
//
// Same rule as workers/sources.ts: a value comes from the named public service in this request, or the row says
// it's not available and why. Nothing is filled in. When a Worker is configured (app/config.js workerUrl) the page
// asks its /api/facts route; otherwise it calls the services directly (each allows cross-origin requests:
// FEMA NFHL, USGS EPQS and Census TIGERweb). HUD rents come from the page's FY2027 county file.
//
// Remote values are inserted as text, never as HTML.

const TIMEOUT_MS = 15000;

// HUD rents come from the page's own FY2027 county file (app/data/hud_fair_market_rents.json, pulled from HUD's FMR API
// by scripts/fetch_hud_fmr_api.py), looked up by the county TIGERweb returns. HUD's map service, used earlier, still
// holds FY2026 as first published.
export const HUD_FMR_INFO_URL = "https://www.huduser.gov/portal/datasets/fmr.html";
const FEMA = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const USGS = "https://epqs.nationalmap.gov/v1/json";
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";

const pointQuery = (lat, lng, outFields) =>
  new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "false", f: "json" });

// One retry, after a short pause, when a request fails at the network level (no HTTP answer at all). FEMA's NFHL drops
// some connections when several queries arrive together (seen in the live panel check, 16 Nov 2026), which the browser
// reports as "Failed to fetch"; a second try usually answers. Timeouts and HTTP or service errors are not retried.
const RETRY_PAUSE_MS = 900;
async function getJson(url, fetcher) {
  try {
    return await getJsonOnce(url, fetcher);
  } catch (e) {
    if (!(e && e.name === "TypeError")) throw e;
    await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
    return getJsonOnce(url, fetcher);
  }
}

async function getJsonOnce(url, fetcher) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
  try {
    const r = await fetcher(url, ctl ? { signal: ctl.signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let d;
    try {
      d = await r.json();
    } catch {
      throw new Error(`non-JSON reply from service (HTTP ${r.status})`);
    }
    if (d && d.error) throw new Error(d.error.message || "service error");
    return d;
  } finally {
    if (t) clearTimeout(t);
  }
}

const ok = (label, value, source, url, note) => ({ ok: true, label, value, source, url, note: note || null, at: new Date().toISOString() });
const no = (label, reason, source, url) => ({ ok: false, label, value: null, reason, source, url, at: new Date().toISOString() });
const money = (n) => (typeof n === "number" && isFinite(n) ? "$" + n.toLocaleString("en-US") : null);

function formatFemaZone(fldZone, zoneSubty, sfhaTf) {
  const zoneRaw = String(fldZone || "").trim().toUpperCase();
  const sfha = sfhaTf === "T" || sfhaTf === true;
  let zoneDesc = `Zone ${fldZone}`;
  let note = sfha ? "Federally backed mortgages here require flood insurance." : null;
  if (zoneRaw === "AREA NOT INCLUDED") {
    zoneDesc = "Area not included in flood survey";
    note = "Not included in FEMA's National Flood Hazard Layer survey.";
  } else if (zoneRaw === "OPEN WATER") {
    zoneDesc = "Open water";
    note = "Mapped as open water.";
  } else if (zoneRaw === "D") {
    zoneDesc = "Zone D (undetermined flood hazard)";
    note = "Possible but undetermined flood hazard; no flood analysis conducted.";
  } else if (zoneSubty) {
    zoneDesc += ` (${String(zoneSubty).toLowerCase()})`;
  }
  if (sfha && !zoneDesc.includes("special flood hazard area")) {
    zoneDesc += " · special flood hazard area";
  }
  return { zoneDesc, note };
}

export async function liveSiteFacts(lat, lng, opts = {}) {
  const fetcher = opts.fetcher || ((u, i) => fetch(u, i));
  if (!(isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return [no("Location", "No valid coordinates for this parcel", "", "")];
  const rows = [];

  const geoUrl = `${TIGER}/10/query?${pointQuery(lat, lng, "GEOID")}`;
  const cntyUrl = `${TIGER}/82/query?${pointQuery(lat, lng, "GEOID,NAME")}`;
  const femaUrl = `${FEMA}?${pointQuery(lat, lng, "FLD_ZONE,ZONE_SUBTY,SFHA_TF")}`;
  const usgsUrl = `${USGS}?${new URLSearchParams({ x: String(lng), y: String(lat), units: "Feet", wkid: "4326" })}`;

  const femaKey = `${(+lat).toFixed(4)},${(+lng).toFixed(4)}`;
  const sharedFema = (typeof window !== "undefined" && window._femaQueryCache && window._femaQueryCache.get(femaKey));
  const femaPromise = sharedFema
    ? sharedFema.then(res => ({ features: (res.v || []).map(attrs => ({ attributes: attrs })) }))
    : getJson(femaUrl, fetcher);

  const [bg, cnty, fema, usgs] = await Promise.allSettled([
    getJson(geoUrl, fetcher),
    getJson(cntyUrl, fetcher),
    femaPromise,
    getJson(usgsUrl, fetcher),
  ]);
  const hudLookup = opts.hudLookup || ((f, z) => (typeof window !== "undefined" && typeof window.getHudFmr === "function" ? window.getHudFmr(f, z) : null));
  const err = (s) => (s.reason && s.reason.message) || "request failed";

  // Census area
  if (cnty.status === "fulfilled" && cnty.value.features && cnty.value.features[0]) {
    const c = cnty.value.features[0].attributes;
    const g = bg.status === "fulfilled" && bg.value.features && bg.value.features[0] ? bg.value.features[0].attributes.GEOID : null;
    rows.push(ok("Census area", `${c.NAME}${g ? " · block group " + g : ""}`, "U.S. Census Bureau TIGERweb", g ? geoUrl : cntyUrl));
  } else rows.push(no("Census area", cnty.status === "rejected" ? err(cnty) : "Not inside a U.S. county", "U.S. Census Bureau TIGERweb", cntyUrl));

  // HUD Fair Market Rent, by county (or Small Area FMR by ZIP when available)
  const countyFips = cnty.status === "fulfilled" && cnty.value.features && cnty.value.features[0] ? cnty.value.features[0].attributes.GEOID : null;
  const parcelZip = opts.zip ? String(opts.zip).trim().padStart(5, "0").slice(0, 5) : null;
  if (countyFips) rows.push(hudRow(hudLookup(countyFips, parcelZip)));
  else rows.push(no("HUD Fair Market Rent", cnty.status === "rejected" ? err(cnty) : "County unknown", "U.S. Department of Housing and Urban Development", HUD_FMR_INFO_URL));

  // FEMA flood zone
  if (fema.status === "fulfilled" && fema.value.features && fema.value.features[0]) {
    const f = fema.value.features[0].attributes;
    const { zoneDesc, note } = formatFemaZone(f.FLD_ZONE, f.ZONE_SUBTY, f.SFHA_TF);
    rows.push(ok("FEMA flood zone", zoneDesc, "FEMA National Flood Hazard Layer", femaUrl, note));
  } else rows.push(no("FEMA flood zone", fema.status === "rejected" ? err(fema) : "No effective FEMA flood map here (unmapped, not 'no risk')", "FEMA National Flood Hazard Layer", femaUrl));

  // USGS ground elevation
  const rawEv = (usgs.status === "fulfilled" && usgs.value) ? usgs.value.value : null;
  const ev = (rawEv !== null && rawEv !== undefined && rawEv !== "" && !isNaN(Number(rawEv))) ? Number(rawEv) : NaN;
  if (isFinite(ev) && ev > -100000) rows.push(ok("Ground elevation", `${Math.round(ev).toLocaleString("en-US")} ft`, "U.S. Geological Survey 3DEP", usgsUrl));
  else rows.push(no("Ground elevation", usgs.status === "rejected" ? err(usgs) : "No elevation data at this point", "U.S. Geological Survey 3DEP", usgsUrl));

  return rows;
}

// One display row from a HUD county record (page file) or null.
export function hudRow(h) {
  if (!h) return no("HUD Fair Market Rent", "No HUD rent on file for this county", "U.S. Department of Housing and Urban Development", HUD_FMR_INFO_URL);
  const fy = h.fiscal_year || "";
  const isSafmr = !!(h.is_safmr && h.zip_code);
  const title = isSafmr ? `HUD Small Area FMR (FY${fy}, ZIP ${h.zip_code})` : `HUD Fair Market Rent (FY${fy})`;
  const notes = [isSafmr ? "HUD voucher benchmark for this ZIP code (rent plus utilities), not a market asking rent." : "HUD's voucher benchmark (rent plus utilities), not a market asking rent."];
  if (h.verification && h.verification.notes) notes.push(h.verification.notes);
  if (Array.isArray(h.two_bed_range) && h.two_bed_2br == null) {
    const [lo, hi] = h.two_bed_range;
    return ok(title, lo === hi ? `2 bed ${money(lo)}/mo` : `varies by town: 2 bed ${money(lo)}–${money(hi)}/mo`, "U.S. Department of Housing and Urban Development", HUD_FMR_INFO_URL, notes.join(" "));
  }
  const parts = [["1 bed", h.one_bed_1br], ["2 bed", h.two_bed_2br], ["3 bed", h.three_bed_3br]].filter(([, v]) => money(v)).map(([k, v]) => `${k} ${money(v)}`);
  return ok(title, parts.join(" · ") + "/mo", "U.S. Department of Housing and Urban Development", HUD_FMR_INFO_URL,
    (h.metro_or_county_name ? h.metro_or_county_name + ". " : "") + notes.join(" "));
}

// Renders rows into a container using text nodes only.
export function renderFacts(container, rows, doc = document) {
  const wrap = doc.createElement("div");
  wrap.className = "live-facts";
  wrap.setAttribute("data-live-facts", "");
  wrap.style.cssText = "margin-top:12px;padding-top:10px;border-top:1px solid rgba(127,127,127,.25)";
  const h = doc.createElement("div");
  h.style.cssText = "font-weight:700;margin-bottom:4px";
  h.textContent = "Live public records for this spot";
  wrap.appendChild(h);
  const sub = doc.createElement("div");
  sub.style.cssText = "font-size:11px;opacity:.75;margin-bottom:6px";
  sub.textContent = "Fetched just now from each agency. Open a link to see the exact query.";
  wrap.appendChild(sub);
  for (const r of rows) {
    const row = doc.createElement("div");
    row.style.cssText = "font-size:12px;margin:4px 0";
    const b = doc.createElement("b");
    b.textContent = r.label + ": ";
    row.appendChild(b);
    row.appendChild(doc.createTextNode(r.ok ? r.value : "Not available (" + r.reason + ")"));
    if (r.note) {
      const n = doc.createElement("div");
      n.style.cssText = "font-size:11px;opacity:.75";
      n.textContent = r.note;
      row.appendChild(n);
    }
    if (r.url) {
      const a = doc.createElement("a");
      a.href = r.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.cssText = "font-size:11px;margin-left:4px";
      a.textContent = r.source ? `(${r.source})` : "(source)";
      row.appendChild(a);
    }
    wrap.appendChild(row);
  }
  container.appendChild(wrap);
  return wrap;
}

// Called by the parcel panel, which re-renders as its own data loads. Results are cached per location so the
// agencies are queried once; a stale result for a different parcel is never drawn.
const cache = new Map();
let current = null;
export async function attachLiveFacts(container, lat, lng, opts = {}) {
  if (!container) return;
  const zip = opts.zip ? String(opts.zip).trim().padStart(5, "0").slice(0, 5) : "";
  const key = `${(+lat).toFixed(6)},${(+lng).toFixed(6)}${zip ? `:${zip}` : ""}`;
  current = key;
  const old = container.querySelector("[data-live-facts]");
  if (old) old.remove();
  if (!cache.has(key)) cache.set(key, loadRows(lat, lng, opts));
  const rows = await cache.get(key);
  if (rows && rows.some(r => !r.ok)) {
    cache.delete(key);
  }
  if (current !== key || !container.isConnected || container.querySelector("[data-live-facts]")) return;
  renderFacts(container, rows);
}

async function loadRows(lat, lng, opts = {}) {
  const cfg = (typeof window !== "undefined" && window.CITY_PRETTY_CONFIG) || {};
  if (cfg.workerUrl) {
    try {
      const d = await getJson(`${cfg.workerUrl}/api/facts?lat=${lat}&lng=${lng}`, (u, i) => fetch(u, i));
      const rows = d && d.ok ? fromWorker(d.facts) : null;
      if (rows) return rows;
    } catch { /* fall through to direct calls */ }
  }
  return liveSiteFacts(lat, lng, opts);
}

// Maps the Worker's /api/facts payload (workers/sources.ts siteFacts) to display rows.
export function fromWorker(f) {
  if (!f) return null;
  const rows = [];
  const g = f.geographies, h = f.hud_fair_market_rent, fl = f.flood_zone, e = f.elevation;
  rows.push(g && g.ok ? ok("Census area", `${g.value.county_name}${g.value.block_group_geoid ? " · block group " + g.value.block_group_geoid : ""}`, g.source.publisher, g.source.url) : no("Census area", (g && g.error) || "unavailable", "U.S. Census Bureau", g && g.source ? g.source.url : ""));
  const safmrMatch = h && h.ok && h.value && h.value.fmr_area_name ? h.value.fmr_area_name.match(/ZIP\s+(\d{5})/i) : null;
  rows.push(h && h.ok ? hudRow({
    fiscal_year: h.value.fiscal_year,
    metro_or_county_name: h.value.fmr_area_name,
    one_bed_1br: h.value.rent_1br,
    two_bed_2br: h.value.rent_2br,
    three_bed_3br: h.value.rent_3br,
    two_bed_range: h.value.rent_2br_range_by_town,
    is_safmr: !!safmrMatch || (h.notes || []).some(n => /SAFMR|Small Area/i.test(n)),
    zip_code: safmrMatch ? safmrMatch[1] : null,
    verification: { notes: (h.notes || []).slice(1).join(" ") }
  }) : no("HUD Fair Market Rent", (h && h.error) || "unavailable", "HUD", HUD_FMR_INFO_URL));
  if (fl && fl.ok) {
    const { zoneDesc, note } = formatFemaZone(fl.value.zone, fl.value.zone_subtype, fl.value.special_flood_hazard_area);
    rows.push(ok("FEMA flood zone", zoneDesc, fl.source.publisher, fl.source.url, note));
  } else {
    rows.push(no("FEMA flood zone", (fl && fl.error) || "unavailable", "FEMA", fl && fl.source ? fl.source.url : ""));
  }
  rows.push(e && e.ok ? ok("Ground elevation", `${Math.round(e.value.elevation_ft).toLocaleString("en-US")} ft`, e.source.publisher, e.source.url) : no("Ground elevation", (e && e.error) || "unavailable", "USGS", e && e.source ? e.source.url : ""));
  return rows;
}

if (typeof window !== "undefined") window.CityPrettyFacts = { liveSiteFacts, renderFacts, attachLiveFacts, fromWorker, hudRow };
