"""adds section 22 (national address search) to w5/tools/patch6.py, before its final write   usage: addr_patch6.py <patch6.py>"""
import sys
p = sys.argv[1]; s = open(p).read()
anchor = '''open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w")'''
assert s.count(anchor) == 1
section = r"""
# ---- 22. round 8.6: address search for every county. The search box asked only LA County's assessor parcels (SitusFullAddress), so an
#          address anywhere else found nothing. LA keeps its parcel search (exact lot) while LA is open; on Enter, anywhere else or when
#          LA's parcels have no match, the U.S. Census Bureau geocoder (JSONP: it sends no CORS header) gives the coordinates and the 2020
#          block group, then OpenStreetMap's Nominatim (CORS; one request per search, never while typing, as its usage policy asks) with
#          the Census coordinates service for the block group. The county opens as a #bg= link would, and a pin marks the address.
rep('''  let d;
  try { d = await arcQuery(PARCEL_URL.replace(/\/query$/, ""), { where: `SitusFullAddress LIKE '${t.replace(/'/g, "")}%'`, outFields: "AIN,SitusFullAddress", returnGeometry: true, outSR: 4326, resultRecordCount: 8 }); }
  catch (e) { return; }
  const feats = (d.features || []).filter(f => f.attributes.SitusFullAddress);
  if (go && feats.length) return goToParcel(feats[0]);''',
    '''  let d = { features: [] };
  if (activeFips() === "06037") {   // LA County's assessor parcels give the exact lot, only while LA is open
    try { d = await arcQuery(PARCEL_URL.replace(/\/query$/, ""), { where: `SitusFullAddress LIKE '${t.replace(/'/g, "")}%'`, outFields: "AIN,SitusFullAddress", returnGeometry: true, outSR: 4326, resultRecordCount: 8 }); }
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
  showToast("Looking up the address…");
  const h = await geocodeUS(text);
  if (!h) { showToast("Address not found. Try the street address with city and state, e.g. 222 W Hargett St, Raleigh, NC"); return; }
  const fips = h.bg ? h.bg.slice(0, 5) : null;
  if (h.bg && !byId.has(h.bg) && countyBundleEls().some(e => e.dataset.fips === fips)) {
    try { await openCounty(fips); } catch (e) { console.warn("could not open county " + fips, e); }
  }
  if (!h.bg || !byId.has(h.bg)) { showToast(`Found ${h.label}, but ${h.bg ? "its county (" + fips + ") is not on this page" : "not its block group"}.`); return; }
  select(h.bg, false);
  map.setView([h.lat, h.lon], Math.max(map.getZoom(), 17), { animate: false });
  if (addrPin) map.removeLayer(addrPin);
  addrPin = L.marker([h.lat, h.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: '<div class="you" title="searched address"></div>' }) }).addTo(map);
  showToast(`Found ${h.label} (${h.src})`);
}
async function addressSearch(text, go) {''', "address search: national geocoders (Census JSONP, then Nominatim) and a pin")
"""
s = s.replace(anchor, section + "\n" + anchor)
open(p, "w").write(s)
print("section 22 added to", p)
