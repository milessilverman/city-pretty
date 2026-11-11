// ---------------- Specific places (round 5): where a creek path, a parking-lot park, EV chargers and traffic calming could go.
// Data: the sites-data script block (gzip+base64), built by sites.py from OpenStreetMap, CHP CCRS crashes 2016-2025, the AFDC station
// list (USDOT/BTS NTAD), LADOT speed humps and LA County channels, plus the page's own Assessor parking-lot inventory (LA).
let SITES = null, _sitesLoading = null, _sitesLayer = null;
function loadSites() {
  if (SITES || _sitesLoading) return _sitesLoading || Promise.resolve(SITES);
  const el = document.getElementById("sites-data");
  if (!el || !el.textContent.trim()) { SITES = { meta: {}, sites: {} }; return Promise.resolve(SITES); }
  _sitesLoading = unpackGzipB64(el.textContent.trim()).then(d => { SITES = d; return d; }).catch(() => { SITES = { meta: {}, sites: {} }; return SITES; });
  return _sitesLoading;
}
const SITE_P = { creek: "corridor_trail", lot_park: "pocket_park", ev: "ev_hub", calm: "traffic_calming", xing: "crosswalks" };
const siteMi = m => m >= 400 ? (m / 1609.34).toFixed(2) + " mi" : Math.round(m / 10) * 10 + " m";
function siteSrc(key) { const v = ((SITES || {}).meta || {}).verified || {}; return v[key] || null; }
function siteLink(key, text) { const v = siteSrc(key); return v ? `<a href="${esc(v.source)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text); }
function siteCounty(gid) { return String(gid).startsWith("06059") ? "oc" : "la"; }
function siteHeadline(s) {
  if (s.t === "creek") return `Walking and biking path along ${esc(s.nm)}`;
  if (s.t === "lot_park") return `Parking lot to pocket park${s.ad ? ": " + esc(s.ad) : s.nmlot ? ": " + esc(s.nmlot) : s.next ? " next to " + esc(s.next[0]) : s.st ? " on " + esc(s.st) : ""}`;
  if (s.t === "ev") return `EV chargers at ${esc(s.dest)}${s.st ? " (" + esc(s.st) + ")" : ""}`;
  if (s.t === "calm") return `${s.elig ? "Speed humps" : "Traffic calming"} on ${esc(s.street)}${s.from && s.to ? ` from ${esc(s.from)} to ${esc(s.to)}` : ""}`;
  if (s.t === "xing") return `Safer crossing at ${s.at.map(esc).join(" & ")}`;
  return "";
}
function siteShort(s) {      // one line for the project card
  if (s.t === "creek") return `along ${esc(s.nm)}: ~${siteMi(s.free)} with no path beside it`;
  if (s.t === "lot_park") return `${s.ac.toFixed(2)}-acre parking lot${s.ad ? " at " + esc(s.ad) : s.next ? " next to " + esc(s.next[0]) : s.st ? " on " + esc(s.st) : ""}`;
  if (s.t === "ev") return `the parking lot at ${esc(s.dest)} (nearest public charger ${siteMi(Math.min(s.dl2, s.ddc))} away)`;
  if (s.t === "calm") return `${esc(s.street)}${s.from && s.to ? ` (${esc(s.from)} to ${esc(s.to)})` : ""}: ${s.n} injury crashes 2016–2025`;
  if (s.t === "xing") return `${s.at.map(esc).join(" & ")}: ${s.ped + s.bike} people walking or biking hurt 2016–2025`;
  return "";
}
function siteBody(s, gid) {
  const oc = siteCounty(gid) === "oc", meta = ((SITES || {}).meta || {})[siteCounty(gid)] || {};
  const yrs = (meta.crash_years || [2016, 2025]).join("–");
  if (s.t === "creek") {
    const lo = s.cost[0], hi = s.cost[1];
    return `About ${siteMi(s.len)} of ${esc(s.nm)} (${esc(s.kind === "drain" || s.kind === "channel" ? "flood channel" : s.kind)}) runs ${s.d > 0 ? "within " + siteMi(Math.max(s.d, 10)) + " of" : "through"} this block group; ${siteMi(s.free)} of it has no mapped path alongside${s.covered > 0 ? ` (${siteMi(s.covered)} already does)` : ""}.
      ${s.mb ? ` LA County Public Works lists it as maintained by ${s.mb === "LACFCD" ? "the LA County Flood Control District" : esc(s.mb)}, whose permission a path on its banks would need.` : ""}
      ${s.mr ? ` OC Flood Control District maintenance roads beside it: ${[s.mr[2] ? siteMi(s.mr[2]) + " at least 10 ft wide (the District's minimum)" : "", s.mr[1] ? siteMi(s.mr[1]) + " narrower than 10 ft" : "", s.mr[0] ? siteMi(s.mr[0]) + " with no maintenance road" : ""].filter(Boolean).join(", ")}${s.mr[3] ? " (" + esc(s.mr[3]) + ")" : ""}; a path would need the District's permission (OCGIS OCFCD maintenance-road layer).` : oc ? " No OC Flood Control District maintenance-road record matched this stretch, so it may be a city or natural channel; check who owns the banks." : ""}
      <br><b>Cost for scale:</b> about ${fmt$(lo)}–${fmt$(hi)} for this stretch, from planned channel paths: ${siteLink("channel_trail_puente", "Puente Creek Bikeway")} (1.86 mi, $3.7M programmed, ~$2.0M/mi; withdrawn in 2025) and ${siteLink("channel_trail_coyote", "Coyote Creek / OC Loop P–Q")} (1.6 mi, $5.7M state grant, ~$3.6M/mi). Rail-corridor paths cost far more (${siteLink("rail_trail_ocloop_a", "OC Loop Segment A")}: ~$14.8M/mi).`;
  }
  if (s.t === "lot_park") {
    const need = s.pn != null && s.pn > 805 ? `the nearest park is ${siteMi(s.pn)} away` : `only ${(+s.pa).toFixed(1)} acres of park lie within half a mile`;
    const what = s.src === "assessor"
      ? `County Assessor: ${esc(s.use || "parking lot")}, ${s.ac.toFixed(2)} acres${s.z ? ", zoned " + esc(s.z) : ""}${s.lav != null ? `, assessed land value ${fmt$(s.lav)}` : ""}${s.st ? `, on ${esc(s.st)}` : ""}${s.next ? `, next to ${esc(s.next[0])}` : ""}. Owner not shown; check the Assessor before planning.`
      : `A ${s.ac.toFixed(2)}-acre surface lot${s.nmlot ? ` (${esc(s.nmlot)})` : ""}${s.st ? ` on ${esc(s.st)}` : ""}${s.next ? `, next to ${esc(s.next[0])} (${esc(s.next[1])})` : ""}${s.op ? `, run by ${esc(s.op)}` : ""} (OpenStreetMap). Ownership isn't recorded in OpenStreetMap; check the Assessor before planning.`;
    return `${what} Park need here: ${need}.
      <br><b>Cost for scale:</b> ${siteLink("pocket_park_walnut", "LA County's Walnut Park pocket park")} (0.5 acre on vacant land, with playground, splash pad and restroom) was budgeted at $4.62M including $3.33M construction, plus land, and about $385k a year to run (2022). A plainer lawn-and-trees park costs less.`;
  }
  if (s.t === "ev") {
    const l2 = s.n_l2 * 9575, dc = s.n_dc * 103238;
    return `${esc(s.dest)} (${esc(s.dk)}) has a ${s.ac.toFixed(2)}-acre surface lot${s.op ? " run by " + esc(s.op) : ""}. The nearest public charger is ${siteMi(Math.min(s.dl2, s.ddc))} away (nearest Level 2 ${siteMi(s.dl2)}, nearest DC fast ${siteMi(s.ddc)}; ${siteLink("afdc_stations", "AFDC station list")}, Nov 2026).
      <br><b>Suggested:</b> ${s.n_l2} Level 2 ports${s.n_dc ? ` and ${s.n_dc} DC fast chargers` : ""}, about ${fmt$(l2 + dc)} at ${siteLink("ev_l2", "CARB's reported costs")} ($9,575 per Level 2 connector${s.n_dc ? ", $103,238 per DC fast charger" : ""}; projects through 2021). The lot owner (or the city, at a public site) would host them.`;
  }
  if (s.t === "calm") {
    const facts = `${s.n} injury crash${s.n > 1 ? "es" : ""} on this ${siteMi(s.len)} stretch, ${yrs}${s.ped || s.bike ? ` (${[s.ped ? s.ped + " involving a pedestrian" : "", s.bike ? s.bike + " a bicycle" : ""].filter(Boolean).join(", ")})` : ""}${s.killed ? `, ${s.killed} fatal` : ""}; crashes at the junctions with bigger roads are not counted.${s.school ? ` ${esc(s.school[0])} is within 250 m.` : ""}`;
    const rule = siteLink("hump_eligibility", "LADOT's criteria");
    const elig = s.elig
      ? `Passes the map checks in ${rule} (one lane each way, posted 30 mph or less${s.humps ? "" : ", no humps there yet"}); LADOT also requires at least 1,000 vehicles a day, speeds 5 mph over the limit and signatures from two-thirds of the neighbors${oc ? ". Orange County cities set their own rules; LADOT's are shown for reference" : ""}. ${siteLink("speed_hump", "$5,958 per hump")} (LADOT, 2025).`
      : `Not a speed-hump street under ${rule}: ${[s.humps ? s.humps + " speed hump" + (s.humps > 1 ? "s are" : " is") + " already mapped here" : "", s.lanes && s.lanes > 2 ? "more than one lane each way" : "", s.speed && parseInt(s.speed) > 30 ? "posted above 30 mph" : ""].filter(Boolean).join("; ") || "it fails the screen"}. A speed-feedback sign (${siteLink("crossing_units_la", "$14,221 in LA City prices")}), narrower lanes or a road-safety review of the crashes fits better.`;
    return `${facts}<br>${elig}`;
  }
  if (s.t === "xing") {
    return `${s.n} injury crash${s.n > 1 ? "es" : ""} within 30 m of this intersection involved someone walking (${s.ped}) or biking (${s.bike}), ${yrs}${s.killed ? `; ${s.killed} fatal` : ""}.${s.school ? ` ${esc(s.school[0])} is within 250 m.` : ""} Options, with ${siteLink("crossing_units_la", "LA City unit prices")} (2022, incl. contingency): high-visibility crosswalk $3,950; leading pedestrian interval $34,034; flashing beacon $118,512; curb extension $158,016–260,726 per corner.`;
  }
  return "";
}
function siteGeomLayers(s) {
  const out = [], col = { creek: css("--water-line", "#2b7bb9"), lot_park: css("--park", "#3a8f4f"), ev: "#7b3fbf", calm: "#d9480f", xing: "#d9480f" }[s.t];
  (s.g || []).forEach(e => { const ll = decodeLine(e); if (ll.length < 2) return;
    out.push(s.t === "lot_park" || s.t === "ev" ? L.polygon(ll, { color: col, weight: 2.5, fillOpacity: .25, interactive: false }) : L.polyline(ll, { color: col, weight: s.t === "creek" ? 5 : 6, opacity: .85, interactive: false })); });
  if (s.pt && (s.t === "xing" || !out.length)) out.push(L.circleMarker([s.pt[1], s.pt[0]], { radius: 8, color: "#fff", weight: 2, fillColor: col, fillOpacity: 1, interactive: false }));
  return out;
}
function drawSites(gid) {
  if (_sitesLayer && typeof map !== "undefined" && map) { map.removeLayer(_sitesLayer); _sitesLayer = null; }
  const S = ((SITES || {}).sites || {})[gid] || []; if (!S.length || typeof map === "undefined" || !map) return;
  _sitesLayer = L.layerGroup(S.flatMap(s => siteGeomLayers(s).map(l => l.bindTooltip ? l.bindTooltip(siteHeadline(s).replace(/<[^>]+>/g, "")) : l))).addTo(map);
}
function sitesHtml(gid) {
  const S = ((SITES || {}).sites || {})[gid] || [], meta = ((SITES || {}).meta || {})[siteCounty(gid)] || {};
  const head = `<p class="small muted">Specific candidates in and next to this block group, found by screening map and crash data. They are starting points for a city or neighborhood to check (ownership, engineering, community support), not plans. Click one to see it on the map.</p>`;
  if (!S.length) return head + `<p class="small">No candidate passed the screens here: no unpathed creek or channel nearby, no publicly run or civic parking lot in a park-poor area, public chargers already within 800 m of every destination lot, and no residential street or intersection with a cluster of injury crashes.</p>`;
  const order = ["calm", "xing", "creek", "lot_park", "ev"];
  const cards = S.slice().sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t)).map((s, i) => `<div class="rec qolrec" style="cursor:pointer" data-sx="${S.indexOf(s)}"><div class="cat">${esc((D.catalog[s.p] || {}).name || s.p)}</div><div class="small"><b>${siteHeadline(s)}</b><br>${siteBody(s, gid)}</div></div>`).join("");
  const src = `<p class="small muted">Sources: OpenStreetMap (${esc(String(meta.osm || "").slice(0, 10))} extract) for creeks, channels, paths, parking lots, destinations and street names${siteCounty(gid) === "la" ? ", LA County Public Works open channels, the County Assessor's parking-lot parcels" : ""}; CHP crash records ${esc((meta.crash_years || []).join("–"))} (CCRS, injury and fatal crashes with coordinates); public, open EV stations from the AFDC list (USDOT/BTS copy, ${esc(String(meta.ev_source || "").replace(/^.*downloaded /, ""))}); existing paths from ${esc(meta.paths_source || "OpenStreetMap")}; existing humps from ${esc(meta.humps_source || "OpenStreetMap")}. Map data can be incomplete: a path, hump or charger missing from these sources would make a candidate look better than it is.</p>`;
  return head + `<div class="recs">${cards}</div>` + src;
}
async function fillSites(p) {
  const box = document.getElementById("sites-sec"); if (!box) return;
  await loadSites();
  if (selected !== p.id) return;
  box.innerHTML = sitesHtml(p.id);
  const S = ((SITES || {}).sites || {})[p.id] || [];
  box.querySelectorAll("[data-sx]").forEach(el => el.onclick = () => { const s = S[+el.dataset.sx]; const ls = siteGeomLayers(s); if (!ls.length) return;
    const b = L.featureGroup(ls).getBounds(); if (b.isValid()) map.fitBounds(b, { maxZoom: 17, padding: [80, 80] }); });
  document.querySelectorAll("#panel [data-where]").forEach(el => { const s = S.find(x => x.p === el.dataset.where);
    el.innerHTML = s ? `<b>Specific candidate:</b> ${siteShort(s)} · <a href="#" data-goto-sites="1">details</a>` : ""; el.hidden = !s; });
  document.querySelectorAll("#panel [data-goto-sites]").forEach(a => a.onclick = e => { e.preventDefault(); const d = box.closest("details"); if (d) d.open = true; box.scrollIntoView({ behavior: "smooth", block: "start" }); });
  drawSites(p.id);
}
