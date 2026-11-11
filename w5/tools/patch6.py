"""Round 6 page patch: any number of county bundles (national-ready), tested with San Diego County.
usage: python3 patch6.py <in.html> <out.html> [<fips>=<bundle.b64> ...]
- Extra counties ship as <script type="application/octet-stream" class="county-bundle" data-fips data-name> (embedded) and are loaded on
  demand; the same loader accepts a data-src URL for hosted per-county files (what a national site would use).
- Orange County keeps every OC-only feature (OCTA funding, city fees, tax shares, OCGIS parcels, OC EIFD policy). Other counties get
  generic, honest wording where a county-specific source does not exist yet. LA County is unchanged.
Every edit is an exact-string replacement that must match once."""
import sys, re, json, gzip, base64, os
src, out = sys.argv[1:3]
extra = [a.split("=", 1) for a in sys.argv[3:]]
s = open(src, encoding="utf-8").read(); CH = []

def rep(old, new, why, count=1):
    global s
    n = s.count(old); assert n == count, f"{why}: expected {count}, found {n}\n{old[:200]}"
    s = s.replace(old, new); CH.append(why)

# ---- 1. embed extra county bundles (before the LA bundle block)
anchor = '<script type="application/octet-stream" id="bundle">'
assert s.count(anchor) == 1
blocks = ""
REG = json.load(open("/home/user/national/data/counties.json"))
for fips, path in extra:
    if path.startswith("@"):   # hosted: "<fips>=@<base url>" -> <base>/bundle_<fips>.json and <base>/sites_<fips>.json, fetched on demand;
        # "<fips>=@gz:<base url>" -> the .json.gz files export_county.py --gz writes (the page unpacks them, so any static host works)
        base = path[1:].rstrip("/"); ext = ".json"; nm = REG[fips]["name"]
        if base.startswith("gz:"):
            base, ext = base[3:], ".json.gz"
        blocks += (f'<script type="application/json" class="county-bundle" data-fips="{fips}" data-name="{nm}" data-st="{REG[fips]["state"]}" '
                   f'data-src="{base}/bundle_{fips}{ext}" data-sites="{base}/sites_{fips}{ext}"></script>\n')
        CH.append(f"hosted county bundle {fips} {nm} ({base}/bundle_{fips}{ext})")
        continue
    b = open(path).read().strip(); B = json.loads(gzip.decompress(base64.b64decode(b)))
    blocks += f'<script type="application/octet-stream" class="county-bundle" data-fips="{fips}" data-name="{B["meta"]["county"]}" data-st="{REG[fips]["state"]}">{b}</script>\n'
    CH.append(f"embedded county bundle {fips} {B['meta']['county']} ({len(B['features'])} block groups, {len(b) / 1e6:.1f} MB)")
LAC = "/home/user/w5/la_data/la_crash_counts.json"
if os.path.exists(LAC):   # LA crash counts (text-only correction of the LA rows, see section 7)
    blocks += '<script type="application/json" id="la-crash-counts">' + json.dumps(json.load(open(LAC))["bg"], separators=(",", ":")) + '</script>\n'
    CH.append("LA crash counts table (CCRS 2023-2025 pedestrian/bicycle and killed-or-seriously-injured per block group)")
s = s.replace(anchor, blocks + anchor)

# ---- 2. county helpers + generic loader (after the OC module globals)
rep('''var D_OC = null;
var ocLayer = null;
var activeCounty = "la"; // "la" or "oc"''',
    '''var D_OC = null;
var ocLayer = null;
var activeCounty = "la"; // "la" or "oc" ("oc" = any non-LA county bundle; which one is D_OC.meta.fips)
// ---------------- Multi-county support (round 6): any county bundle built by the national pipeline
var COUNTY_BUNDLES = {};          // fips -> unpacked bundle (Orange County is stored here too once unpacked)
const ORANGE_FIPS = "06059";
function activeFips() { return activeCounty === "oc" && D_OC ? ((D_OC.meta && D_OC.meta.fips) || ORANGE_FIPS) : "06037"; }
function isOrangeActive() { return activeCounty === "oc" && activeFips() === ORANGE_FIPS; }
function countyOf(m) { return (m && m.county) || (activeCounty === "oc" && D_OC && D_OC.meta && D_OC.meta.county) || "Los Angeles County"; }
function countyBundleEls() { return [...document.querySelectorAll("script.county-bundle")]; }
async function fetchJSON(url) {   // hosted county file: JSON, or gzip-compressed JSON (.json.gz) that the server sent as it is
  const r = await fetch(url); if (!r.ok) throw new Error(url + ": HTTP " + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  return JSON.parse(new TextDecoder().decode(buf));
}
async function loadCountyBundle(fips) {
  if (COUNTY_BUNDLES[fips]) return COUNTY_BUNDLES[fips];
  const el = countyBundleEls().find(e => e.dataset.fips === fips); if (!el) throw new Error("no bundle for " + fips);
  const B = el.dataset.src ? await fetchJSON(el.dataset.src) : await unpackGzipB64(el.textContent.trim());
  if (el.dataset.sites) {   // hosted counties carry their own site-suggestion file; merge it into SITES
    try { const S = await fetchJSON(el.dataset.sites); await loadSites();
      if (SITES && S && S.sites) { SITES.meta = SITES.meta || {}; SITES.meta[fips] = S.meta; SITES.sites = SITES.sites || {}; Object.assign(SITES.sites, S.sites); } }
    catch (e) { console.warn("sites for " + fips + " not loaded", e); }
  }
  if (!B.meta.fips) B.meta.fips = fips;
  // same merge as the Orange County loader: plans, map layers, block-group details
  if (B.plans && D.plans) Object.assign(D.plans, B.plans);
  if (B.profit && D.under) { if (!D.under.profit) D.under.profit = {}; Object.assign(D.under.profit, B.profit); }
  const bl = B.layers || {};
  ["freeways", "arterials", "parks", "water", "rail", "stations", "walls", "amenities", "stops", "facilities", "projects"].forEach(k => {
    if (bl[k] && bl[k].features && D.layers[k] && D.layers[k].features) D.layers[k].features.push(...bl[k].features); else if (bl[k] && !D.layers[k]) D.layers[k] = bl[k]; });
  if (bl.streets && D.layers.streets) {
    const names = D.layers.streets.names || (D.layers.streets.names = []), idx = new Map(names.map((n, i) => [n, i])), map_ = new Map();
    (bl.streets.names || []).forEach((n, i) => { let j = idx.get(n); if (j === undefined) { j = names.length; names.push(n); idx.set(n, j); } map_.set(i, j); });
    if (bl.streets.fwy && D.layers.streets.fwy) D.layers.streets.fwy.push(...bl.streets.fwy.map(([c, n, e]) => [c, map_.get(n) ?? n, e]));
    if (bl.streets.cells) { if (!D.layers.streets.cells) D.layers.streets.cells = {};
      for (const [k, lines] of Object.entries(bl.streets.cells)) { const L2 = lines.map(([c, n, p]) => [c, map_.get(n) ?? n, p]); if (D.layers.streets.cells[k]) D.layers.streets.cells[k].push(...L2); else D.layers.streets.cells[k] = L2; } }
  }
  if (B.cities && B.cities.features && D.cities) D.cities.features.push(...B.cities.features);
  if (B.city_labels && D.city_labels) D.city_labels.push(...B.city_labels);
  if (B.hoods && B.hoods.features && D.hoods) D.hoods.features.push(...B.hoods.features);
  if (B.hood_labels && D.hood_labels) D.hood_labels.push(...B.hood_labels);
  if (bl.park_labels && D.layers.park_labels) { D.layers.park_labels.push(...bl.park_labels); D.layers.park_labels.sort((a, b) => b[3] - a[3]); }
  if (bl.fac_areas && D.layers.fac_areas && D.layers.fac_areas.cells) Object.assign(D.layers.fac_areas.cells, bl.fac_areas.cells || {});
  if (typeof _ctxGeom !== "undefined") _ctxGeom.clear();
  (B.features || []).forEach(f => { byId.set(f.properties.id, f); if (!D.details[f.properties.id]) D.details[f.properties.id] = B.details[f.properties.id]; });
  COUNTY_BUNDLES[fips] = B;
  return B;
}
async function openCounty(fips) {
  if (fips === "06037") return switchCounty("la");
  let B = COUNTY_BUNDLES[fips];
  if (!B && fips === ORANGE_FIPS) B = D_OC;                  // Orange County is unpacked by initOrangeCounty()
  if (!B) { if (typeof showToast === "function") showToast("Loading county…"); B = await loadCountyBundle(fips); }
  if (D_OC !== B) {                                            // swap the active non-LA county: rebuild its map layer
    if (ocLayer && typeof map !== "undefined" && map && map.hasLayer(ocLayer)) map.removeLayer(ocLayer);
    ocLayer = null; D_OC = B; if (typeof window !== "undefined") window.D_OC = D_OC;
  }
  switchCounty("oc");
}''',
    "multi-county loader (COUNTY_BUNDLES, loadCountyBundle, openCounty) and county helpers")
rep('''    D_OC = await unpackGzipB64(b64Text);
    if (typeof window !== "undefined") window.D_OC = D_OC;''',
    '''    D_OC = await unpackGzipB64(b64Text);
    if (D_OC.meta && !D_OC.meta.fips) D_OC.meta.fips = ORANGE_FIPS;
    COUNTY_BUNDLES[ORANGE_FIPS] = D_OC;
    if (typeof window !== "undefined") window.D_OC = D_OC;''',
    "Orange County bundle registered in COUNTY_BUNDLES")

# ---- 3. county switch: names, map extent, default selection
rep('''    if (eb) eb.textContent = "CITY PRETTY · ORANGE COUNTY" + (D_OC && D_OC.meta && D_OC.meta.schema >= 2 ? "" : " (PRELIMINARY)") + " · " + (buildStamp(D_OC && D_OC.meta && D_OC.meta.built) || buildStamp());''',
    '''    if (eb) eb.textContent = "CITY PRETTY · " + countyOf().toUpperCase() + (D_OC && D_OC.meta && D_OC.meta.schema >= 2 ? "" : " (PRELIMINARY)") + " · " + (buildStamp(D_OC && D_OC.meta && D_OC.meta.built) || buildStamp());''',
    "eyebrow names the active county")
rep('''    if (typeof map !== "undefined" && map && map.flyTo) map.flyTo([33.71, -117.83], 11);''',
    '''    if (typeof map !== "undefined" && map && map.flyTo) { if (isOrangeActive()) map.flyTo([33.71, -117.83], 11); else map.flyToBounds(L.geoJSON(D_OC).getBounds(), { maxZoom: 11 }); }''',
    "county switch flies to the active county")
rep('''    if (typeof showToast === "function") showToast(real ? `Orange County: ${fmtN(nT)} block groups in ${nC} cities and communities` : `Orange County: ${fmtN(nT)} census tracts in ${nC} cities and communities (preliminary data)`);''',
    '''    if (typeof showToast === "function") showToast(real ? `${countyOf()}: ${fmtN(nT)} block groups in ${nC} ${nC === 1 ? "city" : "cities and communities"}` : `${countyOf()}: ${fmtN(nT)} census tracts in ${nC} ${nC === 1 ? "city" : "cities and communities"} (preliminary data)`);
    const sel = $("#county-more"); if (sel) sel.value = isOrangeActive() ? "" : activeFips();''',
    "county toast names the active county")
rep('''  if (btnOc) btnOc.classList.toggle("active", c === "oc");''',
    '''  if (btnOc) btnOc.classList.toggle("active", c === "oc" && (!D_OC || !D_OC.meta || !D_OC.meta.fips || D_OC.meta.fips === ORANGE_FIPS));
  { const selM = document.getElementById("county-more"); if (selM) { const other = c === "oc" && !!(D_OC && D_OC.meta && D_OC.meta.fips && D_OC.meta.fips !== ORANGE_FIPS); selM.classList.toggle("active", other); if (!other) selM.value = ""; } }''',
    "Orange County button lit only for Orange County")
rep('''id="btn-county-oc" onclick="switchCounty('oc')" title="Expand to Orange County">🍊 Orange County</button>''',
    '''id="btn-county-oc" onclick="openCounty('06059')" title="Expand to Orange County">🍊 Orange County</button>
      <select id="county-more" class="county-btn" aria-label="More counties" title="More counties" onchange="this.value && openCounty(this.value)" style="border-left:1px solid var(--rule);font-family:inherit;max-width:10.5em;min-width:0"><option value="">More counties…</option></select>''',
    "county picker: 'More counties' list next to the LA / Orange County buttons")
# fill the picker from the embedded bundles at init
rep('''  drawContext(); performance.mark("init:context");''',
    '''  drawContext(); performance.mark("init:context");
  { const sel = $("#county-more"); if (sel) { const els = countyBundleEls(); if (!els.length) sel.hidden = true;
      els.forEach(e => { const o = document.createElement("option"); o.value = e.dataset.fips; o.textContent = e.dataset.name.replace(/ County$/, ""); o.title = e.dataset.name; sel.appendChild(o); });
      const h1 = document.querySelector(".brand h1"), more = els.map(e => e.dataset.name.replace(/ County$/, ""));
      if (h1 && more.length === 1) h1.textContent = `Which improvements make LA, Orange and ${els[0].dataset.name} neighborhoods better, and worth more, per dollar`;   // the full name: "San Juan Municipio", "Orleans Parish"
      else if (h1 && more.length > 1) h1.textContent = `Which improvements make neighborhoods better, and worth more, per dollar (LA, Orange and ${more.length} more counties)`; } }''',
    "init: list the embedded counties in the picker")

# ---- 4. non-LA areas: generic behaviour, Orange-only features kept for Orange County
rep('''const isOCArea = m => !!(m && m.county === "Orange County");''',
    '''const isOCArea = m => !!(m && m.county && m.county !== "Los Angeles County");   // any non-LA county bundle
const isOrangeArea = m => !!(m && m.county === "Orange County");''',
    "isOCArea means 'outside LA County'; isOrangeArea for Orange County-only data")
rep('''function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to); return t; }''',
    '''function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to);
  if (!isOrangeArea(m)) t = t.replace(/the city's OCTA Measure M2 Local Fair Share allocation/g, "the city's local transportation funds").replace(/\\bOCTA\\b/g, "the county transportation agency"); return t; }''',
    "agency names: OCTA-specific wording only in Orange County")
rep('''${isOCArea(m) ? ' <span class="muted">(Orange County equivalents of the LA County catalog; verify with the city)</span>' : ""}''',
    '''${isOCArea(m) ? ` <span class="muted">(${esc(countyOf(m))} equivalents of the LA County catalog; verify with the city)</span>` : ""}''',
    "agency note names the county")
rep('''  if (isOCArea(m)) return `<div class="section"><h3>Public facilities nearby</h3><p class="small muted">Not yet mapped for Orange County (the LA County facilities layer stops at the county line).</p></div>`;''',
    '''  if (isOCArea(m) && !m.fc) return `<div class="section"><h3>Public facilities nearby</h3><p class="small muted">No facility distances for this block group in ${esc(countyOf(m))}.</p></div>`;''',
    "facilities: county bundles list their own distances (m.fc, the values the gap list quotes); no LA County layer note outside LA")
rep('''<span>${(m.fc[k] / 1609).toFixed(1)} mi</span>''',
    '''<span>${m.fc[k] < 80.45 ? "&lt;0.1" : (m.fc[k] / 1609).toFixed(1)} mi</span>''',
    "facility distances: '<0.1 mi', not '0.0 mi'")
rep('''<p class="small muted">Distance from the middle of this block group to the nearest one. LA County Location Management System, filled in with OpenStreetMap.</p>''',
    '''<p class="small muted">Distance from the middle of this block group to the nearest one. ${isOCArea(m) ? (s => `OpenStreetMap${s ? "; schools from the " + esc(s[0]) : ""}.`)((((COUNTY_BUNDLES[m.__fips] || D_OC || {}).meta || {}).sources || []).find(r => r && r[3] && /^(CDE School Directory|NCES EDGE)/.test(r[0]))) : "LA County Location Management System, filled in with OpenStreetMap."}</p>''',
    "facilities source line outside LA County: OpenStreetMap, schools from the county's loaded school source")
rep('''  const ocF = isOCArea(m) ? ocFunding(r.id) : null;''',
    '''  const ocF = isOCArea(m) ? (ocFunding(r.id) || { funding: [], none: true }) : null;   // no LA County programmes outside LA''',
    "funding plan: no LA County programmes offered outside LA County")
rep('''function ocFundingHtml(id, m) {
  const F = ocFunding(id); if (!F) return "";''',
    '''function ocFundingHtml(id, m) {
  const F = ocFunding(id); if (!F) return isOrangeArea(m) ? "" : `<p class="small muted">Funding programmes for ${esc(countyOf(m))} have not been verified yet, so none are listed (LA County's programmes don't apply here).</p>`;''',
    "project card: honest note where a county's funding programmes are not verified yet")
# EIFD text: three cases (LA policy, Orange policy, other counties)
rep('''${activeCounty === "oc" ? "the County of Orange's EIFD Participation Policy''',
    '''${activeCounty === "oc" && !isOrangeActive() ? `${esc(countyOf())}'s participation rules (not verified for this county yet) apply when the County joins` : activeCounty === "oc" ? "the County of Orange's EIFD Participation Policy''',
    "EIFD text: non-Orange counties do not get Orange County's policy")
rep('''${fld("e-kp", "County pledge (%)", 49, 1, activeCounty === "oc" ? "Artesia 49%; OC policy cap 50%" : "Artesia 49%; range 11–50%")}''',
    '''${fld("e-kp", "County pledge (%)", 49, 1, isOrangeActive() ? "Artesia 49%; OC policy cap 50%" : "Artesia 49%; range 11–50%")}''',
    "EIFD pledge note: Orange County cap only in Orange County")
rep('''<p class="small" id="e-warn"></p>${activeCounty === "oc" ? ocEifdNote() : ""}${eifdRegister()}</div>`;''',
    '''<p class="small" id="e-warn"></p>${isOrangeActive() ? ocEifdNote() : ""}${eifdRegister()}</div>`;''',
    "EIFD: Placentia / OC policy note only in Orange County")
rep('''      ${activeCounty === "oc" ? `<p class="small muted">Where each $1 of growth in the 1% tax goes here:''',
    '''      ${isOrangeActive() ? `<p class="small muted">Where each $1 of growth in the 1% tax goes here:''',
    "EIFD split source text: Orange County only (others have no shares yet)")
rep('''      : `${activeCounty === "oc" ? "The Orange County Assessor roll is not in this build (the Assessor sells roll data in person only), so the base" : "No Assessor roll value matched this area, so the base"}''',
    '''      : `${isOrangeActive() ? "The Orange County Assessor roll is not in this build (the Assessor sells roll data in person only), so the base" : "No Assessor roll value matched this area, so the base"}''',
    "EIFD base note: Orange County wording only there")
rep('''    if (activeCounty === "oc") {
      if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city''',
    '''    if (activeCounty === "oc" && !isOrangeActive()) {
      w.push(`${countyOf()}'s rules for joining a district have not been verified yet, so no County policy check is shown.`);
    } else if (activeCounty === "oc") {
      if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city''',
    "EIFD policy checks: none claimed for counties whose policy is unverified")
# per-house: parcels only where a parcel service is connected; pool premium by metro (Redfin 2019 table)
rep('''async function fetchParcel(ll) {
  const isOC = (activeCounty === "oc") || (ll.lat >= 33.35 && ll.lat <= 33.95 && ll.lng >= -118.15 && ll.lng <= -117.40);''',
    '''async function fetchParcel(ll) {
  if (activeCounty === "oc" && !isOrangeActive()) throw new Error(`per-house parcel lookups are not connected for ${countyOf()} yet`);
  const isOC = (activeCounty === "oc") || (ll.lat >= 33.35 && ll.lat <= 33.95 && ll.lng >= -118.15 && ll.lng <= -117.40);''',
    "per-house: clear message where no parcel service is connected")
rep('''      const isOC = (activeCounty === "oc" || (h.a && h.a.county === "Orange County"));
      v = isOC ? 56000 : ((m.ht || 0) > 0 ? 95000 : 20000);''',
    '''      const isOC = (isOrangeActive() || (h.a && h.a.county === "Orange County")), isSD = activeCounty === "oc" && activeFips() === "06073";
      v = isSD ? 20000 : isOC ? 56000 : ((m.ht || 0) > 0 ? 95000 : 20000);''',
    "pool premium: San Diego uses Redfin's San Diego estimate ($20,001)")
rep('''      note = isOC ? "modeled ~$56k resale premium''',
    '''      note = isSD ? "modeled ~$20k resale premium (Redfin 2019 San Diego estimate: $20,001; not verified on local sales)" : isOC ? "modeled ~$56k resale premium''',
    "pool premium note for San Diego")
rep('''  const _cRec = (typeof activeCounty !== "undefined" && activeCounty === "oc") ? "Orange County" : "LA County";''',
    '''  const _cRec = (typeof activeCounty !== "undefined" && activeCounty === "oc") ? countyOf() : "LA County";''',
    "per-house loading text names the county")
# technical appendix
rep('''<p class="small">Orange County was built on ${esc(D_OC.meta.built || "")}''',
    '''<p class="small">${esc(countyOf())} was built on ${esc(D_OC.meta.built || "")}''',
    "technical appendix names the county")

# ---- 5. found by the San Diego test: LA / Orange wording that reached other counties (and two pre-existing Orange County leaks)
rep("""  if (!isOrangeArea(m)) t = t.replace(/the city's OCTA Measure M2 Local Fair Share allocation/g, "the city's local transportation funds").replace(/\\bOCTA\\b/g, "the county transportation agency"); return t; }""",
    """  if (!isOrangeArea(m)) t = t.replace(/the city's OCTA Measure M2 Local Fair Share allocation/g, "the city's local transportation funds").replace(/\\bOCTA\\b/g, "the county transportation agency")
    .replace(/ \\(or OC Parks\\)/g, " (or the county parks department)").replace(/OC Housing & Community Development/g, "the county housing agency")
    .replace(/SCE or the city utility \\(for example Anaheim Public Utilities\\)/g, "the local electric utility").replace(/OC Public Works \\(OC Flood Control District\\)/g, "the county flood control district"); return t; }""",
    "agency names outside Orange County: no OC Parks / OC Housing / Anaheim utility / OC Flood Control wording")
rep("""${st.funding && D.funding[st.funding] ? `; could be paid for by ${esc(D.funding[st.funding][0])}` : ""}""",
    """${stepFunding(st, m)}""",
    "neighborhood plan steps: LA-only funding (Measure W, A, M/R, ULA) not offered outside LA County; Orange County gets OCTA Measure M2")
rep("""function gapSection(p, m) {""",
    """const LA_ONLY_FUNDING = new Set(["W", "A", "M", "ULA"]);   // LA County / City of LA programmes
function stepFunding(st, m) {
  if (!st.funding || !D.funding[st.funding]) return "";
  if (isOCArea(m) && LA_ONLY_FUNDING.has(st.funding)) return isOrangeArea(m) && st.funding === "M" ? "; could be paid for by OCTA Measure M2 (Orange County transportation sales tax)" : "";
  return `; could be paid for by ${esc(D.funding[st.funding][0])}`;
}
function gapSection(p, m) {""",
    "stepFunding helper")
rep("""distances and counts computed from OpenStreetMap (5 Nov 2026 extract), OCTA GTFS, CDE, CHP CCRS 2016–2025, CA DOJ and OC Parks data.</p>' : ""}""",
    """distances and counts computed from ' + (isOrangeActive() ? "OpenStreetMap (5 Nov 2026 extract), OCTA GTFS, CDE, CHP CCRS 2016–2025, CA DOJ and OC Parks data" : esc(((D_OC && D_OC.meta && D_OC.meta.sources) || []).filter(r => r && r[3] && !/^ACS|^TIGERweb Tracts/.test(r[0])).map(r => r[0]).join(", "))) + '.</p>' : ""}""",
    "area profile source line lists the active county's own loaded sources")
rep("""function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to);
""",
    """// Caltrans district by county (LA County is District 7): majority district of each county, from Caltrans' District Boundaries layer
// (services1.arcgis.com/8CpMUd3fdw6aXef7 .../Caltrans_District_Boundaries, last edit 19 Jul 2024) intersected with TIGERweb counties, 7 Nov 2026
const CALTRANS_DISTRICT = { "06001": 4, "06003": 10, "06005": 10, "06007": 3, "06009": 10, "06011": 3, "06013": 4, "06015": 1, "06017": 3, "06019": 6, "06021": 3, "06023": 1, "06025": 11, "06027": 9, "06029": "6 (District 9 in eastern Kern)", "06031": 6, "06033": 1, "06035": 2, "06039": 6, "06041": 4, "06043": 10, "06045": 1, "06047": 10, "06049": 2, "06051": 9, "06053": 5, "06055": 4, "06057": 3, "06059": 12, "06061": 3, "06063": 2, "06065": 8, "06067": 3, "06069": 5, "06071": 8, "06073": 11, "06075": 4, "06077": 10, "06079": 5, "06081": 4, "06083": 5, "06085": 4, "06087": 5, "06089": 2, "06091": 3, "06093": 2, "06095": 4, "06097": 4, "06099": 10, "06101": 3, "06103": 2, "06105": 2, "06107": 6, "06109": 10, "06111": 7, "06113": 3, "06115": 3 };
function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to);
  { const d = CALTRANS_DISTRICT[activeFips()]; t = t.replace(/Caltrans District 7/g, d ? "Caltrans District " + d : "the local Caltrans district").replace(/Caltrans\\/Metro/g, "Caltrans/OCTA").replace(/\\bMetro Board\\b/g, "OCTA Board");
    t = t.replace(/grant match \\(Measure W, Prop 4\\)/g, isCAActive() ? "grant match (local stormwater funds, Prop 4)" : "grant match (local and state grants)").replace(/\\bMeasure W\\b/g, "local stormwater funds");
    if (!isCAActive()) t = t.replace(/the local Caltrans district|Caltrans/g, "the state DOT"); }
""",
    "Caltrans district and Metro board wording outside LA County (Orange: District 12 / OCTA; San Diego: District 11)")
rep("""<td>${esc(u.rebates_nov_2026)}</td>""", """<td>${esc(rebateFor(u.rebates_nov_2026))}</td>""",
    "upgrade table: LA-only rebates (LADWP, City Plants, Measure W) reworded outside LA County")
rep("""function gapSection(p, m) {""", """function rebateFor(t) {   // the upgrade table's rebate notes name LA programmes; outside LA County say what to check instead
  if (typeof activeCounty === "undefined" || activeCounty !== "oc" || !t) return t;
  return String(t).replace("Turf rebate (MWD base, plus LADWP adder): check current $/sq ft", "Turf rebate: check your water agency's current $/sq ft")
    .replace("City Plants: free street and yard trees (LA City)", "Free-tree programs: check your city")
    .replace("Check Measure W stormwater credit", "Check local stormwater credits")
    .replace("LADWP or SCE charger rebate: check current amount", "Utility charger rebate: check current amount");
}
function gapSection(p, m) {""", "rebateFor helper")
# ---- 6. outside California (national counties): California-only law, programmes and rebates are not offered
rep("""function fundPlan(r, gid) {
  const c = D.catalog[r.id]; if (!c || c.kind === "owner" || c.kind === "policy") return null;""",
    """function isCAActive() { return typeof activeCounty === "undefined" || activeCounty !== "oc" || String(activeFips()).startsWith("06"); }
function activeStateName() { const f = String(activeFips()).slice(0, 2); return ({ "08": "Colorado", "17": "Illinois", "36": "New York", "48": "Texas", "12": "Florida", "13": "Georgia", "37": "North Carolina", "51": "Virginia", "26": "Michigan" })[f] || "this state"; }
function fundPlan(r, gid) {
  const c = D.catalog[r.id]; if (!c || c.kind === "owner" || c.kind === "policy") return null;
  if (!isCAActive()) return null;   // the plan is built on a California EIFD; not modelled for other states""",
    "funding plan (EIFD-based) not shown outside California")
rep("""function eifdSection(p, m) {""",
    """function eifdSection(p, m) {
  if (!isCAActive()) return `<div class="section"><h3>Tax-increment financing</h3><p class="small muted">The EIFD calculator models California's Enhanced Infrastructure Financing Districts, which exist only under California law. ${esc(activeStateName())} has its own tax-increment rules; they are not modelled here, so no district figures are shown for ${esc(countyOf(m))}.</p></div>`;""",
    "EIFD calculator replaced by a note outside California")
rep("""const LA_ONLY_FUNDING = new Set(["W", "A", "M", "ULA"]);   // LA County / City of LA programmes""",
    """const LA_ONLY_FUNDING = new Set(["W", "A", "M", "ULA"]);   // LA County / City of LA programmes
const CA_ONLY_FUNDING = new Set(["ATP", "TCC", "AHSC", "UCF", "P4", "R20", "QUIMBY", "EIFD"]);   // California state programmes and law""",
    "California-only funding codes")
rep("""  if (!st.funding || !D.funding[st.funding]) return "";""",
    """  if (!st.funding || !D.funding[st.funding]) return "";
  if (!isCAActive() && (CA_ONLY_FUNDING.has(st.funding) || LA_ONLY_FUNDING.has(st.funding))) return "";
  if (!isCAActive() && st.funding === "NEVI") return `; could be paid for by NEVI (${esc(D.funding.NEVI[1])})`;   // LA's label 'NEVI / CEC charger programs' names California Energy Commission programmes""",
    "plan steps: no California programmes outside California; NEVI without the California Energy Commission")
rep("""    .replace("LADWP or SCE charger rebate: check current amount", "Utility charger rebate: check current amount");""",
    """    .replace("LADWP or SCE charger rebate: check current amount", "Utility charger rebate: check current amount")
    .replace(/^(CalHFA ADU program: check whether funding is open|SGIP: check remaining funds|TECH Clean California.*|Earthquake Brace \\+ Bolt grant up to \\$3,000)$/, m => isCAActive() ? m : "California program; check local programs");""",
    "upgrade table: California-only rebates marked outside California")
rep("""<td>${esc(u.property_tax)}</td>""", """<td>${esc(isCAActive() ? u.property_tax : "Check local assessment rules")}</td>""",
    "upgrade table: Prop 13 reassessment notes only in California")
rep("""${c.caveat ? " " + esc(c.caveat) : ""}</p>` : c.caveat ? `<p class="small">${esc(c.caveat)}</p>` : ""}""",
    """${c.caveat ? " " + esc(agencyFor(c.caveat, m)) : ""}</p>` : c.caveat ? `<p class="small">${esc(agencyFor(c.caveat, m))}</p>` : ""}""",
    "project caveats use the county's agency names (e.g. Caltrans outside California)")
rep("""<summary><b>EIFD Tax-Increment Financing Calculator</b></summary>""",
    """<summary><b>${isCAActive() ? "EIFD Tax-Increment Financing Calculator" : "Tax-Increment Financing"}</b></summary>""",
    "panel section title: EIFD only in California")
# ---- 7. LA accuracy: the LA build's rows say "0 fatal/severe and N pedestrian/bike crashes": the fatal/severe count was never filled
# (m.ksi = 0 in all 6,587 LA block groups) and N is every crash in the block group, not only pedestrian/bike (text only)
rep("""<p class="small"><b>Why:</b> ${esc(r.why)}</p>""", """<p class="small"><b>Why:</b> ${esc(whyFix(r.why))}</p>""",
    "LA rows: crash counts labelled as all crashes (not pedestrian/bike), fatal/severe shown as missing, not 0")
rep("""function gapSection(p, m) {""", """function whyFix(t) {
  if (!t || !String(typeof selected !== "undefined" && selected || "").startsWith("06037")) return t;
  // checked 7 Nov 2026 against CCRS: across 400 LA block groups this count correlates 0.995 with ALL crashes inside the block group
  // (2023-2026) and 0.32 with pedestrian/bicycle crashes, so it is labelled as what it is
  // real counts for this block group (CCRS 2023-2025, la_crash_counts.py): [pedestrian/bicycle, killed or seriously injured, all]
  if (window.__LAC === undefined) { try { window.__LAC = JSON.parse((document.getElementById("la-crash-counts") || {}).textContent || "null"); } catch (e) { window.__LAC = null; } }
  const c = window.__LAC && window.__LAC[selected];
  const real = c ? `; CCRS 2023–2025 for this block group: ${c[0]} involving a pedestrian or cyclist, ${c[1]} killed or seriously injured` : "";
  return String(t).replace(/\\b0 fatal\\/severe and (\\d+) pedestrian\\/bike crashes recorded/g, `$1 crashes of all kinds recorded here (CCRS 2023–2026; the LA build counted every crash, not only pedestrian/bike ones${real || ", and has no fatal/severe count"})`)
    .replace(/\\b(\\d+) pedestrian or bike crashes recorded/g, `$1 crashes of all kinds recorded (CCRS 2023–2026${c ? `; ${c[0]} of the 2023–2025 crashes involved a pedestrian or cyclist` : "; not only pedestrian/bike"})`)
    .replace(/\\b(\\d+) pedestrian\\/bike crashes\\b(?! recorded)/g, `$1 crashes of all kinds (CCRS 2023–2026${c ? `; ${c[0]} pedestrian/bike in 2023–2025` : ""})`);
}
function gapSection(p, m) {""", "whyFix helper")
# ---- 8. shareable links into any county: #bg=<block group> opens that block group's county first
rep("""function checkHash() {
  const m = window.location.hash.match(/#bg=([0-9]+)/);
  if (m && byId.has(m[1]) && m[1] !== selected) {
    select(m[1], true);
  }
}""", """function checkHash() {
  const m = window.location.hash.match(/#bg=([0-9]+)/);
  if (!m || m[1] === selected) return;
  if (byId.has(m[1])) { select(m[1], true); return; }
  const fips = m[1].slice(0, 5);
  if (countyBundleEls().some(e => e.dataset.fips === fips)) openCounty(fips).then(() => { if (byId.has(m[1])) select(m[1], true); }).catch(e => console.warn("could not open county " + fips, e));
}""", "links: #bg= opens the block group's county (any embedded or hosted county)")
rep("""  const initHash = window.location.hash.match(/#bg=([0-9]+)/);""",
    """  const initHash = window.location.hash.match(/#bg=([0-9]+)/);
  window.__linkBg = initHash ? initHash[1] : null;   // select() below rewrites the hash, so keep the link the page was opened with""",
    "init: remember the #bg= link before the first selection overwrites it")
rep("""      const mh = window.location.hash.match(/#bg=([0-9]+)/);""",
    """      const mh = window.__linkBg ? [null, window.__linkBg] : window.location.hash.match(/#bg=([0-9]+)/);""",
    "Orange County links: use the remembered link (pre-existing bug: the first selection had already replaced it)")
rep("""    }).catch(e => console.warn("Orange County bundle failed to unpack", e)); }""",
    """    }).catch(e => console.warn("Orange County bundle failed to unpack", e)); }
  if (window.ocReady) window.ocReady.then(() => { const id = window.__linkBg;   // a link into another county opens it once the page is ready
    if (id && id !== selected && !byId.has(id)) { history.replaceState(null, null, "#bg=" + id); checkHash(); } });""",
    "init: follow a #bg= link into another county")
# ---- 9. bus frequency left unknown by the coverage check (MobilityData counties): say so instead of a bare dash
rep("""${tile("Bus service", m.bt != null ? Math.round(m.bt) + "/hr" : "–",""",
    """${tile("Bus service", m.bt != null ? Math.round(m.bt) + "/hr" : busUnknown(m) ? "unknown" : "–",""",
    "Bus service tile: 'unknown' where an operator is missing from the open feeds")
rep("""function gapSection(p, m) {""", """function busUnknown(m) {   // a county on MobilityData feeds: bt is empty only where the OSM/gap-stop check found a missing operator (or no feed is counted)
  if (!isOCArea(m) || isOrangeArea(m) || !D_OC || !D_OC.meta) return false;
  return (D_OC.meta.sources || []).some(r => r && /^GTFS feeds\\b/.test(r[0]));   // round 8.6: any wording of the row, loaded or not (a county with no counted feed has unknown bus frequency everywhere)
}
function gapSection(p, m) {""", "busUnknown helper")
# ---- 10. remaining LA / California references in the agency and process texts (found by simulating agencyFor on all 162 texts)
rep("""      .replace(/\\bMetro Board\\b/g, "OCTA Board"); }""" if False else """.replace(/\\bMetro Board\\b/g, "OCTA Board");""",
    """.replace(/\\bMetro Board\\b/g, "OCTA Board")
      .replace(/partners such as Los Angeles Neighborhood Land Trust and Trust for Public Land/g, "partners such as a local land trust and Trust for Public Land")
      .replace(/the LA Community Garden Council/g, "a local community-garden network")
      .replace(/\\(LA County Department of Parks and Recreation\\)/g, isOrangeArea(m) ? "(OC Parks)" : "(the county parks department)")
      .replace(/Measure A or Quimby funding/g, "Quimby fees or local park funds")
      .replace(/Metro Bike Share/g, "the regional bike-share system").replace(/Metro Micro/g, "on-demand microtransit")
      .replace(/Measure M local return/g, isOrangeArea(m) ? "OCTA Measure M2 Local Fair Share" : "local transportation sales-tax funds")
      .replace(/\\bMetro\\b/g, "OCTA")
      .replace(/Los Angeles Public Library or LA County Library \\(or the city's library department\\)/g, isOrangeArea(m) ? "the city's library or OC Public Libraries" : "the city's library or the county library")
      .replace(/Mayor's Office \\(Inside Safe\\) & Los Angeles Homeless Services Authority \\(LAHSA\\); County Homeless Initiative outside the city/g, "the city's homelessness office & the county's homeless services agency (Continuum of Care)");
    if (!isCAActive()) t = t.replace(/\\bQuimby fees?\\b|\\bQuimby\\b/g, "park impact fees").replace(/CEQA\\/NEPA/g, "NEPA").replace(/CEQA environmental review/g, "state environmental review")
      .replace(/\\/CVC\\b/g, "/state vehicle code").replace(/CARB Clean Mobility/g, "state clean-mobility grants").replace(/\\bLCTOP\\b/g, "state transit operations funding");""",
    "agency texts: LA land trust / garden council / LA County Parks, Metro, Measure M and A, and California-only law outside California")
# ---- 11. cost / effect evidence citations come mostly from LA County projects: say so outside LA County
rep("""      <p class="src muted">${c.sources.map(esc).join("<br>")}</p>""",
    """      <p class="src muted">${isOCArea(m) ? `<b>Evidence and cost examples (mostly from LA County projects, used here for scale):</b><br>` : ""}${c.sources.map(esc).join("<br>")}</p>""",
    "evidence lists labelled as LA County examples outside LA County")
# ---- 12. parcel lines and map credits follow the active county: parcel services exist for LA and Orange County only (outside them the
#          page requested Orange County's parcel tiles), and the credit line named LA agencies whichever county was shown
rep('''  const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
  const m = (typeof map !== "undefined" && map) ? map : (typeof window !== "undefined" && window.map ? window.map : null);
''',
    '''  const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
  const noParcels = isOc && typeof isOrangeActive === "function" && !isOrangeActive();   // parcel lines: LA and Orange County only
  const m = (typeof map !== "undefined" && map) ? map : (typeof window !== "undefined" && window.map ? window.map : null);
  if (noParcels && lots) { if (m && m.hasLayer && m.hasLayer(lots)) m.removeLayer(lots); lots = null; if (typeof window !== "undefined") window.lots = null; }
''', "no parcel layer outside LA and Orange County")
rep('''  if (want && !lots && m && m.addLayer) {
    if (isOc) {''', '''  if (want && !noParcels && !lots && m && m.addLayer) {
    if (isOc) {''', "parcel layer added only where a parcel service exists")
rep('''<input type="checkbox" id="l-lots" checked> Property lines (zoom 15+, online)</label>''',
    '''<input type="checkbox" id="l-lots" checked> Property lines (LA and Orange County, zoom 15+, online)</label>''', "property-lines label says where they exist")
LA_ATTR = "© OpenStreetMap contributors · US Census · LA County Assessor, Auditor-Controller and Parks · LAPD · LASD · MyLA311 · CHP · LA Metro · city tree surveys · Tree Equity Score"
assert s.count(LA_ATTR) == 1, "LA credit line"
rep('''  if (typeof syncLots === "function") syncLots();
  if (typeof numLayer !== "undefined" && numLayer && typeof map !== "undefined" && map) {''',
    '''  if (typeof syncLots === "function") syncLots();
  if (typeof syncAttribution === "function") syncAttribution();
  if (typeof numLayer !== "undefined" && numLayer && typeof map !== "undefined" && map) {''', "map credits updated on every county switch")
rep('''async function openCounty(fips) {''', '''var ATTR_NOW = null;
function countyAttribution() {   // the credit line names the active county's main sources (every source is listed under Methods & Vintages)
  const f = activeFips();
  if (f === "06037") return "''' + LA_ATTR + '''";
  if (f === ORANGE_FIPS) return "© OpenStreetMap contributors · US Census · OCGIS / OC Public Works · CA DOJ · CHP · OCTA · Anaheim street trees · CAL FIRE · Tree Equity Score";
  if (f.startsWith("06")) return "© OpenStreetMap contributors · US Census · CA DOJ · CHP · CAL FIRE · CDE · MobilityData GTFS · Tree Equity Score · all sources: Methods & Vintages";
  return "© OpenStreetMap contributors · US Census · NCES · MobilityData GTFS · Tree Equity Score · all sources: Methods & Vintages";
}
function syncAttribution() {
  if (typeof map === "undefined" || !map || !map.attributionControl) return;
  const now = ATTR_NOW || "''' + LA_ATTR + '''", t = countyAttribution(); if (t === now) return;
  map.attributionControl.removeAttribution(now).addAttribution(t); ATTR_NOW = t;
}
async function openCounty(fips) {''', "county-aware map credit line")

# ---- 13. outside California the agency texts said "the state DOT" where LA's name Caltrans: name the state's department of transportation
rep('''    if (!isCAActive()) t = t.replace(/the local Caltrans district|Caltrans/g, "the state DOT"); }''',
    '''    if (!isCAActive()) t = t.replace(/the local Caltrans district|Caltrans/g, stateDot()); }''', "state DOT named outside California")
rep('''function agencyFor(text, m) {''', '''// each state's department of transportation (by state FIPS code), as the agencies name themselves
const STATE_DOT = { "01": "ALDOT", "02": "Alaska DOT&PF", "04": "ADOT", "05": "ARDOT", "08": "CDOT", "09": "CTDOT", "10": "DelDOT", "11": "DDOT", "12": "FDOT",
  "13": "GDOT", "15": "HDOT", "16": "ITD", "17": "IDOT", "18": "INDOT", "19": "Iowa DOT", "20": "KDOT", "21": "the Kentucky Transportation Cabinet", "22": "Louisiana DOTD",
  "23": "MaineDOT", "24": "MDOT SHA", "25": "MassDOT", "26": "MDOT", "27": "MnDOT", "28": "Mississippi DOT", "29": "MoDOT", "30": "MDT", "31": "Nebraska DOT",
  "32": "NDOT", "33": "NHDOT", "34": "NJDOT", "35": "NMDOT", "36": "NYSDOT", "37": "NCDOT", "38": "NDDOT", "39": "ODOT", "40": "Oklahoma DOT", "41": "Oregon DOT",
  "42": "PennDOT", "44": "RIDOT", "45": "SCDOT", "46": "SDDOT", "47": "TDOT", "48": "TxDOT", "49": "UDOT", "50": "VTrans", "51": "VDOT", "53": "WSDOT",
  "54": "WVDOH", "55": "WisDOT", "56": "WYDOT", "72": "DTOP" };
function stateDot() {
  const f = activeFips(), d = STATE_DOT[f.slice(0, 2)];
  if (!d) return "the state DOT";
  return f.startsWith("11") ? d + " (the District's DOT)" : f.startsWith("72") ? d + " (Puerto Rico's transportation department)" : d + " (the state DOT)";
}
function agencyFor(text, m) {''', "state DOT names by state")

# ---- 14. "CEQA review" (transit-oriented development texts, shown near rail stations) survived the round-8 rules: any remaining CEQA
#          reference outside California becomes "environmental review"
rep('''.replace(/CEQA environmental review/g, "state environmental review")''',
    '''.replace(/CEQA environmental review/g, "state environmental review").replace(/\\bCEQA review\\b/g, "environmental review").replace(/\\bCEQA\\b/g, "environmental review")''',
    "no CEQA reference outside California")

# ---- 15. engine texts that were true for LA's and Orange County's builds but not for the national ones:
#   - the EV hub's reason says OpenStreetMap chargers were used because "the federal AFDC list needs an API key"; national builds load
#     AFDC's DC fast chargers (USDOT/BTS copy, see the county's sources), so say that where the county's sources show it loaded;
#   - "N fatal/severe and M pedestrian/bike crashes recorded" gets the county's crash years (they differ by state);
#   - the crime tile's caption "independent police" is LA's (cities with their own police); elsewhere say why there is no number
rep("""function whyFix(t) {
  if (!t || !String(typeof selected !== "undefined" && selected || "").startsWith("06037")) return t;""",
    """function whyFix(t) {
  if (t && typeof activeCounty !== "undefined" && activeCounty === "oc" && D_OC && D_OC.meta) {
    const afdcRow = (D_OC.meta.sources || []).find(r => r && /^AFDC EV stations/.test(r[0] || ""));
    if (afdcRow && afdcRow[3])
      t = String(t).replace("no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list needs an API key and was not loaded)", "no public DC fast charger within 800 m (federal AFDC station list, USDOT/BTS copy)");
    else if (afdcRow)   // round 8.6: the AFDC copy was read but lists no station near this county, so OpenStreetMap's are used
      t = String(t).replace("no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list needs an API key and was not loaded)", "no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list has no station near this county)");
    const cy = ((((typeof SITES !== "undefined" && SITES) || {}).meta || {})[activeFips()] || {}).crash_years;
    // round 8.6: the fatal/severe count covers crashes of every kind (metrics_oc: ksi over all crash points), the second count only
    // pedestrian/bike ones; both get the county's crash years where known
    t = String(t).replace(/\\b(\\d+) fatal\\/severe and (\\d+) pedestrian\\/bike (crash(?:es)?) recorded\\b/g, (_, a, b, c) => `${a} fatal or severe-injury ${a === "1" ? "crash" : "crashes"} of any kind and ${b} pedestrian/bike ${c} recorded` + (cy && cy.length === 2 ? ` ${cy[0]}–${cy[1]}` : ""));
  }
  if (!t || !String(typeof selected !== "undefined" && selected || "").startsWith("06037")) return t;""",
    "national builds: EV reason names AFDC where it was loaded; crash counts carry the county's years")
rep("""m.vc != null ? `12 mo · ${esc(m.ag || "")}` : "independent police")}""",
    """m.vc != null ? `12 mo · ${esc(m.ag || "")}` : (activeFips() === "06037" ? "independent police" : isCAActive() ? "agency not in CA DOJ data" : "no crime source outside California"))}""",
    "crime tile caption says why there is no number")

# ---- 16. the zoning block listed California housing law (ADU law, SB 9, SB 79, AB 2097) for every county, and pointed every county to
#          SCAG's SB 79 map (SCAG covers only LA, Orange, Riverside, San Bernardino, Ventura and Imperial counties); the undergrounding
#          reason mentioned LADWP's area outside LA
rep('''  h += `<ul class="small" style="margin:6px 0 0 18px;padding:0">${L_.map(x => `<li>${x}</li>`).join("")}</ul>''',
    '''  if (!isCAActive()) { L_.length = 0; L_.push("<b>State housing laws:</b> rules for accessory dwellings, lot splits and parking near transit differ by state; California's (its ADU law, SB 9, SB 79, AB 2097) do not apply here. Check the state's and the city's current rules."); }
  else if (!["06037", "06059", "06065", "06071", "06111", "06025"].includes(activeFips())) for (let i = 0; i < L_.length; i++) L_[i] = L_[i].replace("Check SCAG's official SB 79 map.", "Check the regional planning agency's official SB 79 map.");
  h += `<ul class="small" style="margin:6px 0 0 18px;padding:0">${L_.map(x => `<li>${x}</li>`).join("")}</ul>''', "zoning block: California housing law only in California; SB 79 map agency outside SCAG")
rep('''No zoning map is loaded for this city yet (${esc(m.city || "")}). State laws below still apply.</p>`;''',
    '''No zoning map is loaded for this city yet (${esc(m.city || "")}). ${isCAActive() ? "State laws below still apply." : "See the note on state housing laws below."}</p>`;''', "no-zoning-map note outside California")
rep('''  if (t && typeof activeCounty !== "undefined" && activeCounty === "oc" && D_OC && D_OC.meta) {
''', '''  if (t && typeof activeCounty !== "undefined" && activeCounty === "oc" && D_OC && D_OC.meta) {
    t = String(t).replace("no utility line map outside LADWP's area; local utility lines not mapped", "local utility lines are not mapped");
''', "undergrounding reason without LADWP outside LA")

# ---- 17. outside California: the transit-upzoning policy is titled "(SB 79 / TOC zoning)" (California law / LA's programme), and the
#          sources table describes the tax-rate-area row as feeding the EIFD calculator, which is California-only
rep('''<span class="nm">${esc(c.name)}</span>''',
    '''<span class="nm">${esc(isCAActive() ? c.name : String(c.name).replace(" (SB 79 / TOC zoning)", " (transit-oriented zoning)"))}</span>''',
    "policy title without California law outside California")
rep('''      <tbody>${D_OC.meta.sources.map(r => row(r[0], r[1], r[2], r[3])).join("")}</tbody>''',
    '''      <tbody>${D_OC.meta.sources.map(r => !isCAActive() && /^Tax-rate areas/.test(r[0] || "") ? row(r[0], "County and city share of property-tax increment", "Not used outside California (the tax-increment calculator models California's EIFDs)", false) : row(r[0], r[1], r[2], r[3])).join("")}</tbody>''',
    "sources table: tax-rate areas row outside California")

# ---- 18. many counties share a name across states (Kings CA / NY, Orange CA / FL, Middlesex MA / NJ, Jefferson AL / KY): the picker groups
#          counties by state and names the state outside California, and the heading names the active county's state
rep('''      els.forEach(e => { const o = document.createElement("option"); o.value = e.dataset.fips; o.textContent = e.dataset.name.replace(/ County$/, ""); o.title = e.dataset.name; sel.appendChild(o); });''',
    '''      const byst = {}; els.forEach(e => { const st = e.dataset.st || "CA"; (byst[st] = byst[st] || []).push(e); });
      Object.keys(byst).sort((a, b) => a === "CA" ? -1 : b === "CA" ? 1 : (STATE_FULL[a] || a).localeCompare(STATE_FULL[b] || b)).forEach(st => {
        const g = document.createElement("optgroup"); g.label = STATE_FULL[st] || st;
        byst[st].sort((a, b) => a.dataset.name.localeCompare(b.dataset.name)).forEach(e => { const o = document.createElement("option"); o.value = e.dataset.fips;
          o.textContent = e.dataset.name.replace(/ County$/, "") + (st === "CA" ? "" : ", " + st); o.title = e.dataset.name + (st === "CA" ? "" : ", " + STATE_FULL[st]); g.appendChild(o); });
        sel.appendChild(g); });''', "county picker grouped by state, state named outside California")
rep('''function countyOf(m) {''', '''const STATE_FULL = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", PR: "Puerto Rico" };
function activeState() { const f = activeFips(); if (f.startsWith("06")) return "CA"; const el = countyBundleEls().find(e => e.dataset.fips === f); return (el && el.dataset.st) || "CA"; }
function countyOf(m) {''', "state names and the active county's state")
rep('''    if (eb) eb.textContent = "CITY PRETTY · " + countyOf().toUpperCase() + (D_OC''',
    '''    if (eb) eb.textContent = "CITY PRETTY · " + countyOf().toUpperCase() + (activeState() !== "CA" ? ", " + activeState() : "") + (D_OC''', "heading names the state outside California")

# ---- 19. Orange County, CA features (OCTA, OC funding, OC parks) were switched on by the county NAME, so Orange County, FL (and the
#          Orange counties of NY, NC, TX, VA, IN, VT) would get them: metrics now carry their county's FIPS when a county bundle loads
rep('''  (B.features || []).forEach(f => { byId.set(f.properties.id, f); if (!D.details[f.properties.id]) D.details[f.properties.id] = B.details[f.properties.id]; });''',
    '''  (B.features || []).forEach(f => { byId.set(f.properties.id, f); const dd = (B.details || {})[f.properties.id]; if (dd && dd.m) dd.m.__fips = fips;
    if (!D.details[f.properties.id]) D.details[f.properties.id] = dd; });''', "county bundle metrics carry their FIPS")
rep('''const isOrangeArea = m => !!(m && m.county === "Orange County");''',
    '''const isOrangeArea = m => !!(m && m.county === "Orange County" && (!m.__fips || m.__fips === ORANGE_FIPS));   // Orange County, CA only''',
    "Orange County features only for Orange County, CA")

# ---- 20. the homeowner-upgrade table (LA-metro averages) listed "Seismic bolting and cripple-wall bracing" for every pre-1980 home, with
#          California's Earthquake Brace + Bolt grant and California costs and savings: outside California it is not shown (no hazard
#          layer here to say where it would apply). Its note told users to "click a home", but house-level numbers exist only where parcel
#          lines do (LA and Orange County).
rep('''  const U = (D.upgrades || []).filter(u => !(u.applies_if === "pre1975" && m.yb >= 1975) && !(u.applies_if === "pre1980" && m.yb >= 1980) && !(u.applies_if === "fire" && !fire));''',
    '''  const U = (D.upgrades || []).filter(u => !(u.applies_if === "pre1975" && m.yb >= 1975) && !(u.applies_if === "pre1980" && m.yb >= 1980) && !(u.applies_if === "fire" && !fire)
    && !(!isCAActive() && /^Seismic bolting/.test(u.name || "")));''', "upgrade table: no California seismic retrofit outside California")
rep('''These are LA-wide averages: zoom in and click a home for numbers sized to that house and its yard.''',
    '''${(typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof isOrangeActive === "function" && !isOrangeActive()) ? "These are LA-wide averages, not adjusted to this county: costs and resale values here can differ." : "These are LA-wide averages: zoom in and click a home for numbers sized to that house and its yard."}''',
    "upgrade note: house-level numbers only where parcel lines exist")

# ---- 21. station tooltips add " station" to the name: names that already end with it ("Lodi, CA Amtrak Station", from a GTFS feed since
#          round 8.4, or OpenStreetMap's "Sahara Las Vegas Monorail Station") read "... Station station"
rep('''      onEachFeature: (f, l) => f.properties.n && l.bindTooltip(esc(f.properties.n) + " station") }).addTo(map);''',
    '''      onEachFeature: (f, l) => f.properties.n && l.bindTooltip(esc(f.properties.n) + (/\\bstation$/i.test(f.properties.n) ? "" : " station")) }).addTo(map);''',
    "station tooltip: no second \"station\" after a name that ends with it")


# ---- 22. round 8.6: address search for every county. The search box asked only LA County's assessor parcels (SitusFullAddress), so an
#          address anywhere else found nothing. LA keeps its parcel search (exact lot) while LA is open; on Enter, anywhere else or when
#          LA's parcels have no match, the U.S. Census Bureau geocoder (JSONP: it sends no CORS header) gives the coordinates and the 2020
#          block group, then OpenStreetMap's Nominatim (CORS; one request per search, never while typing, as its usage policy asks) with
#          the Census coordinates service for the block group. The county opens as a #bg= link would, and a pin marks the address.
rep('''  let d;
  try { d = await arcQuery(PARCEL_URL.replace(/\\/query$/, ""), { where: `SitusFullAddress LIKE '${t.replace(/'/g, "")}%'`, outFields: "AIN,SitusFullAddress", returnGeometry: true, outSR: 4326, resultRecordCount: 8 }); }
  catch (e) { return; }
  const feats = (d.features || []).filter(f => f.attributes.SitusFullAddress);
  if (go && feats.length) return goToParcel(feats[0]);''',
    '''  let d = { features: [] };
  if (activeFips() === "06037") {   // LA County's assessor parcels give the exact lot, only while LA is open
    try { d = await arcQuery(PARCEL_URL.replace(/\\/query$/, ""), { where: `SitusFullAddress LIKE '${t.replace(/'/g, "")}%'`, outFields: "AIN,SitusFullAddress", returnGeometry: true, outSR: 4326, resultRecordCount: 8 }); }
    catch (e) { d = { features: [] }; }
  }
  const feats = (d.features || []).filter(f => f.attributes.SitusFullAddress);
  if (go && feats.length) return goToParcel(feats[0]);
  if (go) return addressSearchUS(text);   // any US address: Census Bureau geocoder, then OpenStreetMap''', "address search: LA parcels only while LA is open; Enter falls back to the national geocoders")
rep('''async function addressSearch(text, go) {''', '''let addrPin = null;
function jsonpGet(url, ms = 15000) {   // the Census Bureau geocoder answers JSONP (format=jsonp&callback=), not CORS
  return new Promise((resolve, reject) => {
    const cb = "__cpgeo" + Date.now().toString(36) + Math.floor(Math.random() * 1e6);
    const sc = document.createElement("script");
    let timer = null;
    const done = (v, err) => { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } sc.remove(); if (err) reject(err); else resolve(v); };
    timer = setTimeout(() => done(null, new Error("timeout")), ms);
    window[cb] = v => done(v);
    sc.onerror = () => done(null, new Error("geocoder did not answer"));
    sc.src = url + "&format=jsonp&callback=" + cb;
    document.head.appendChild(sc);
  });
}
const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/";
async function geocodeUS(text) {
  const q = encodeURIComponent(String(text).trim().slice(0, 200));
  const bgOf = r => { const g = (((r || {}).geographies || {})["Census Block Groups"] || [])[0]; return g && g.GEOID ? String(g.GEOID) : null; };
  try {
    const d = await jsonpGet(`${CENSUS_GEOCODER}onelineaddress?address=${q}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10`);
    const m = ((d && d.result && d.result.addressMatches) || [])[0];
    if (m && m.coordinates) return { lat: +m.coordinates.y, lon: +m.coordinates.x, bg: bgOf(m), label: m.matchedAddress, src: "U.S. Census Bureau geocoder" };
  } catch (e) { console.warn("Census geocoder:", e); }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=jsonv2&limit=1&countrycodes=us`);
    const a = r.ok ? (await r.json())[0] : null;
    if (a) {
      const lat = +a.lat, lon = +a.lon; let bg = null;
      try { const d = await jsonpGet(`${CENSUS_GEOCODER}coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10`); bg = bgOf(d && d.result); } catch (e) { console.warn("Census coordinates:", e); }
      return { lat, lon, bg, label: a.display_name, src: "OpenStreetMap Nominatim" };
    }
  } catch (e) { console.warn("Nominatim:", e); }
  return null;
}
async function addressSearchUS(text) {
  hideAddr();
  if (addrPin) { map.removeLayer(addrPin); addrPin = null; }   // a new search clears the last pin
  showToast("Looking up the address…");
  const h = await geocodeUS(text);
  if (!h) { showToast("Address not found. Try the street address with city and state, e.g. 222 W Hargett St, Raleigh, NC"); return; }
  const fips = h.bg ? h.bg.slice(0, 5) : null;
  const onPage = !!fips && (fips === "06037" || fips === ORANGE_FIPS || countyBundleEls().some(e => e.dataset.fips === fips));
  if (onPage && fips !== activeFips()) {   // open the address's county first, as the county picker would (LA, Orange or a hosted county)
    try { await openCounty(fips); } catch (e) { console.warn("could not open county " + fips, e); }
  }
  if (!onPage || !byId.has(h.bg)) { showToast(`Found ${h.label}, but ${h.bg ? "its county (" + fips + ") is not on this page" : "not its block group"}.`); return; }
  select(h.bg, false);
  if (map.stop) map.stop();   // the county switch may still be flying to the county
  map.setView([h.lat, h.lon], Math.max(map.getZoom(), 17), { animate: false });
  addrPin = L.marker([h.lat, h.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: '<div class="you" title="searched address"></div>' }) }).addTo(map);
  showToast(`Found ${h.label} (${h.src})`);
}
async function addressSearch(text, go) {''', "address search: national geocoders (Census JSONP, then Nominatim) and a pin")


# ---- 23. round 8.6, leaks review: 'County area' is LA County's Countywide Statistical Area; pipeline-built block groups (they carry m.county)
#          had '<city> - <name>' there, often doubled ('Chico - Chico'); the similarity note lists children only in LA mode (the county
#          bundles' peer match has no children variable)
rep('''<p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n ? " · County area: " + esc(m.csa) : ""}</p>''',
    '''<p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n && !m.county ? " · County area: " + esc(m.csa) : ""}</p>''',
    "'County area' only for LA County's own block groups")
rep('''most like this one in income, density, home values, housing age, children, car ownership and single-family share.</p>`;''',
    '''most like this one in income, density, home values, housing age, ${typeof activeCounty !== "undefined" && activeCounty === "oc" ? "" : "children, "}car ownership and single-family share.</p>`;''',
    "similarity note: children only in LA mode")


# ---- 24. round 8.7: lot lines and lot records outside Los Angeles and Orange County, from the state's or county's own open parcel service
#          (w5/round87/parcels87.json: 35 services, each queried live on 10 Nov with shapes returned; fields are an allow-list per service,
#          never owner names or mailing addresses; labels are each service's own field aliases). Lot lines draw from zoom 17 when "Property
#          lines" is on; a click opens the lot's record; an address search highlights the lot under the address. In county mode the
#          checkbox used to load Orange County's lot tiles for every county.
_reg = [{"url": e["url"], "states": e.get("states", []), "counties": e.get("counties", []), "name": e["name"], "terms": e.get("terms") or "", "addr": e.get("addr") or "",
         "max": e.get("max") or 1000, "fields": [[f, " ".join(str(a).split())] for f, a in e["fields"]]}
        for e in json.load(open("/home/user/w5/round87/parcels87.json"))]
rep("""function syncLots() {
  const cb = $("#l-lots");
  const want = cb ? cb.checked : false;
  const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");""",
"""const PARCELS87 = """ + json.dumps(_reg, ensure_ascii=False, separators=(",", ":")) + """;
function parcelSvc(fips) {   // round 8.7: the open parcel service for a county (a county's own service first, then its state's)
  if (!fips || fips === "06037" || fips === "06059") return null;
  return PARCELS87.find(s => s.counties.includes(fips)) || PARCELS87.find(s => s.states.includes(fips.slice(0, 2))) || null;
}
let natLots = null, natLotTimer = null, natLotSeq = 0;
function lotPopup(svc, a) {
  const fmt = (k, v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") { if (/date|_dt$|dt$/i.test(k) && v > 1e11) return new Date(v).toISOString().slice(0, 10); return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : String(+v.toFixed(3)); }
    return String(v).trim();
  };
  const rows = svc.fields.map(([k, lab]) => [lab, fmt(k, a[k])]).filter(r => r[1] != null && r[1] !== "");
  return `<div class="small"><b>Lot record</b><table style="border-collapse:collapse">${rows.map(([l, v]) => `<tr><td class="muted" style="padding:0 8px 0 0;vertical-align:top">${esc(l)}</td><td>${/^https?:\\/\\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">open the record</a>` : esc(v)}</td></tr>`).join("")}</table>`
    + `<p class="muted" style="margin:6px 0 0">From ${esc(svc.name)}, as published (assessed or appraised values are not sale prices).${svc.terms ? ` <a href="${esc(svc.terms)}" target="_blank" rel="noopener">Source</a>` : ""}</p></div>`;
}
function lotQuery(svc, w, s_, e_, n) {
  return svc.url + "/query?" + new URLSearchParams({ geometry: [w, s_, e_, n].map(v => (+v).toFixed(6)).join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: svc.fields.map(f => f[0]).join(","), returnGeometry: "true", outSR: "4326", geometryPrecision: "6",
    resultRecordCount: String(Math.min(svc.max || 1000, 1000)), f: "json" });
}
const lotLatLngs = f => f.geometry.rings.map(r => r.map(([x, y]) => [y, x]));
async function drawNatLots() {
  const cb = $("#l-lots"), svc = typeof activeFips === "function" ? parcelSvc(activeFips()) : null;
  if (!svc || (cb && !cb.checked) || map.getZoom() < 17) { if (natLots) { map.removeLayer(natLots); natLots = null; if (typeof window !== "undefined") window.natLots = null; } return; }
  const b = map.getBounds(), seq = ++natLotSeq;
  let d; try { d = await (await fetch(lotQuery(svc, b.getWest(), b.getSouth(), b.getEast(), b.getNorth()))).json(); } catch (e) { return; }
  if (seq !== natLotSeq) return;
  if (natLots) map.removeLayer(natLots);
  natLots = L.layerGroup((d.features || []).filter(f => f.geometry && f.geometry.rings).map(f =>
    L.polygon(lotLatLngs(f), { color: "#7a5c2e", weight: 1, opacity: 0.85, fillOpacity: 0.02 }).bindPopup(() => lotPopup(svc, f.attributes || {}), { maxWidth: 360 }))).addTo(map);
  natLots._count = (d.features || []).length; if (typeof window !== "undefined") window.natLots = natLots;
}
function scheduleNatLots() { clearTimeout(natLotTimer); natLotTimer = setTimeout(drawNatLots, 350); }
let lotHit = null;
function ringsHold(rings, x, y) {   // even-odd rule over all rings (holes included)
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
async function lotAt(lat, lon, text) {   // the lot of a searched address: the lot whose site address matches, else the lot under the point, else the nearest
  const svc = typeof activeFips === "function" ? parcelSvc(activeFips()) : null; if (!svc) return null;
  try {
    // the Census geocoder puts an address on the street centre line, outside every lot: look about 40 m around it
    const d = await (await fetch(lotQuery(svc, lon - 0.0004, lat - 0.0004, lon + 0.0004, lat + 0.0004))).json();
    const fs = (d.features || []).filter(f => f.geometry && f.geometry.rings); if (!fs.length) return null;
    const norm = t => String(t || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\\s+/g, " ").trim();
    const want = norm(String(text || "").split(",")[0]); const num = (want.match(/^\\d+/) || [""])[0];
    const word = (want.replace(/^\\d+\\s*/, "").split(" ").find(w => w.length > 2 && !["NORTH", "SOUTH", "EAST", "WEST"].includes(w)) || "");
    let byAddr = svc.addr && num && word ? fs.find(f => { const a = norm((f.attributes || {})[svc.addr]); return a.startsWith(num + " ") && a.includes(word); }) : null;
    if (!byAddr && svc.addr && num && word) {   // address points can sit tens of metres off: ask the service for the address itself, within ~300 m
      try {   // num is digits and word letters and digits only (norm), so the where clause carries no quotes
        const q2 = svc.url + "/query?" + new URLSearchParams({ where: `UPPER(${svc.addr}) LIKE '${num} %${word}%'`, geometry: [lon - 0.003, lat - 0.003, lon + 0.003, lat + 0.003].map(v => v.toFixed(6)).join(","),
          geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: svc.fields.map(f => f[0]).join(","), returnGeometry: "true", outSR: "4326",
          geometryPrecision: "6", resultRecordCount: "5", f: "json" });
        const d2 = await (await fetch(q2)).json(); byAddr = (d2.features || []).find(g => g.geometry && g.geometry.rings) || null;
      } catch (e) { byAddr = null; }
    }
    const under = fs.find(f => ringsHold(f.geometry.rings, lon, lat));
    const dist = f => { const r = f.geometry.rings[0]; let sx = 0, sy = 0; r.forEach(([x, y]) => { sx += x; sy += y; }); return Math.hypot(sx / r.length - lon, (sy / r.length - lat) * 0.8); };
    const f = byAddr || under || fs.slice().sort((a, b) => dist(a) - dist(b))[0];
    if (lotHit) map.removeLayer(lotHit);
    lotHit = L.polygon(lotLatLngs(f), { color: "#c2410c", weight: 3, fillOpacity: 0.08 }).addTo(map);
    lotHit._how = byAddr ? "address" : under ? "point" : "nearest";
    lotHit.bindPopup(lotPopup(svc, f.attributes || {}) + (byAddr ? "" : `<p class="small muted" style="margin:4px 0 0">${under ? "The lot under the geocoded point" : "The lot nearest the geocoded point"}: check that it is the address you searched.</p>`), { maxWidth: 360 }).openPopup();
    if (typeof window !== "undefined") window.lotHit = lotHit;
    return lotHit;
  } catch (e) { return null; }
}
function syncLots() {
  const cb = $("#l-lots");
  const want = cb ? cb.checked : false;
  const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
  if (isOc && typeof activeFips === "function" && activeFips() !== ORANGE_FIPS) {   // round 8.7: another county: its own parcel service, not Orange's tiles
    const m0 = (typeof map !== "undefined" && map) ? map : null;
    if (lots && m0 && m0.hasLayer && m0.hasLayer(lots)) m0.removeLayer(lots);
    lots = null; if (typeof window !== "undefined") window.lots = null;
    scheduleNatLots(); return;
  }""", "lots: each county's open parcel service (lot lines from zoom 17, lot records), not Orange's tiles elsewhere")
rep("""  window.addEventListener("hashchange", checkHash);""",
    """  window.addEventListener("hashchange", checkHash);
  map.on("moveend", () => { if (typeof scheduleNatLots === "function") scheduleNatLots(); });   // round 8.7: lot lines outside LA and Orange
  { const cbl = $("#l-lots"); if (cbl) cbl.addEventListener("change", () => { if (typeof scheduleNatLots === "function") scheduleNatLots(); }); }""",
    "lots: redraw on map moves and the Property lines checkbox")
rep("""  showToast(`Found ${h.label} (${h.src})`);""", """  lotAt(h.lat, h.lon, text);   // round 8.7: the lot of the address, where the county's parcel service has it
  showToast(`Found ${h.label} (${h.src})`);""", "address search: outline the lot under the address")

open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w").write("\n".join(f"{i + 1}. {c}" for i, c in enumerate(CH)) + "\n")
print(len(CH), "changes ->", out)
