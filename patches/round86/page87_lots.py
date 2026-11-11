"""adds section 24 (national lot lines and lot records) to w5/tools/patch6.py, before its final write   usage: page87_lots.py <patch6.py>"""
import sys
p = sys.argv[1]; s = open(p).read()
anchor = '''open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w")'''
assert s.count(anchor) == 1
section = r'''
# ---- 24. round 8.7: lot lines and lot records outside Los Angeles and Orange County, from the state's or county's own open parcel service
#          (w5/round87/parcels87.json: 35 services, each queried live on 10 Nov with shapes returned; fields are an allow-list per service,
#          never owner names or mailing addresses; labels are each service's own field aliases). Lot lines draw from zoom 17 when "Property
#          lines" is on; a click opens the lot's record; an address search highlights the lot under the address. In county mode the
#          checkbox used to load Orange County's lot tiles for every county.
_reg = [{"url": e["url"], "states": e.get("states", []), "counties": e.get("counties", []), "name": e["name"], "terms": e.get("terms") or "",
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
  if (!svc || (cb && !cb.checked) || map.getZoom() < 17) { if (natLots) { map.removeLayer(natLots); natLots = null; } return; }
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
async function lotAt(lat, lon) {   // the lot under a searched address, outlined, with its record open
  const svc = typeof activeFips === "function" ? parcelSvc(activeFips()) : null; if (!svc) return null;
  try {
    const d = await (await fetch(lotQuery(svc, lon - 0.00002, lat - 0.00002, lon + 0.00002, lat + 0.00002))).json();
    const f = (d.features || []).find(f => f.geometry && f.geometry.rings); if (!f) return null;
    if (lotHit) map.removeLayer(lotHit);
    lotHit = L.polygon(lotLatLngs(f), { color: "#c2410c", weight: 3, fillOpacity: 0.08 }).addTo(map);
    lotHit.bindPopup(lotPopup(svc, f.attributes || {}), { maxWidth: 360 }).openPopup();
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
rep("""  showToast(`Found ${h.label} (${h.src})`);""", """  lotAt(h.lat, h.lon);   // round 8.7: the lot under the address, where the county's parcel service has it
  showToast(`Found ${h.label} (${h.src})`);""", "address search: outline the lot under the address")
'''
s = s.replace(anchor, section + "\n" + anchor)
open(p, "w").write(s)
print("section 24 added")
