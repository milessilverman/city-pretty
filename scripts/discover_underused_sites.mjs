/**
 * PROTOTYPE: discover candidate golf courses (leisure=golf_course) and large surface parking lots
 * (amenity=parking, parking=surface, area > 1 acre) inside a bounding box from OpenStreetMap.
 *
 *   node scripts/discover_underused_sites.mjs --bbox=south,west,north,east [--min-acres=1] [--out=file.json]
 *
 * Tries Overpass mirrors first (full, systematic). If none answers it falls back to Nominatim tile
 * searches, which are rate-limited (1 request/second), capped at 40 results per tile and so are NOT
 * exhaustive; the output says which method was used. Output rows are seeds for
 * scripts/underused_site_seeds.json (county FIPS must be added by hand or via the Census geocoder);
 * nothing here is written to app/data.
 */
import fs from "fs";

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split("=")[1] : d; };
const bbox = (arg("bbox", "") || "").split(",").map(Number);
if (bbox.length !== 4 || bbox.some(Number.isNaN)) { console.error("usage: --bbox=south,west,north,east"); process.exit(2); }
const [S, W, N, E] = bbox;
const MIN_ACRES = Number(arg("min-acres", "1"));
const out = arg("out", null);
const UA = { "User-Agent": "citypretty-sites-discovery/1.0 (open-data prototype)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

function ringAreaM2(r) {
  const lat0 = r.reduce((a, b) => a + b[1], 0) / r.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * kx * (q[1] * ky) - q[0] * kx * (p[1] * ky); }
  return Math.abs(a / 2);
}
function acresOfGeo(g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  let m2 = 0; for (const p of polys) { m2 += ringAreaM2(p[0]); for (const h of p.slice(1)) m2 -= ringAreaM2(h); }
  return m2 / 4046.856;
}

async function viaOverpass() {
  const q = `[out:json][timeout:60];(way["leisure"="golf_course"](${S},${W},${N},${E});relation["leisure"="golf_course"](${S},${W},${N},${E});way["amenity"="parking"]["parking"="surface"](${S},${W},${N},${E}););out geom tags;`;
  for (const m of MIRRORS) {
    try {
      const r = await fetch(m, { method: "POST", body: new URLSearchParams({ data: q }), headers: UA, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return j.elements.map(e => {
        const ring = (e.geometry || []).map(p => [p.lon, p.lat]);
        const acres = ring.length > 2 ? ringAreaM2(ring) / 4046.856 : null;
        const golf = e.tags && e.tags.leisure === "golf_course";
        return { osm: (e.type[0] + e.id).toUpperCase(), kind: golf ? "golf course" : "parking lot", name: (e.tags && e.tags.name) || null, acres: acres && Math.round(acres * 100) / 100, tags: e.tags };
      }).filter(x => x.acres == null || x.kind === "golf course" || x.acres >= MIN_ACRES).map(x => ({ ...x, method: "overpass:" + m }));
    } catch (e) { console.error("overpass mirror failed:", m, String(e.message || e)); }
  }
  return null;
}

async function viaNominatim() {
  const step = 0.05, found = new Map();
  let tiles = 0;
  for (let s = S; s < N; s += step) for (let w = W; w < E; w += step) {
    for (const term of ["golf course", "parking"]) {
      const vb = `${w},${Math.min(s + step, N)},${Math.min(w + step, E)},${s}`;
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&extratags=1&q=${encodeURIComponent(term)}&viewbox=${vb}&bounded=1`;
      try {
        const j = await (await fetch(url, { headers: UA })).json();
        tiles++;
        for (const x of j) {
          const t = x.extratags || {};
          if (x.type === "golf_course" || (x.type === "parking" && t.parking === "surface")) found.set(x.osm_type[0].toUpperCase() + x.osm_id, { osm: x.osm_type[0].toUpperCase() + x.osm_id, kind: x.type === "golf_course" ? "golf course" : "parking lot", name: x.name || null, tags: t, lat: +x.lat, lng: +x.lon, capped: j.length >= 40 });
        }
      } catch (e) { console.error("nominatim tile failed", String(e.message || e)); }
      await sleep(1100);
    }
  }
  // areas need a second (batched) call with polygon_geojson
  const ids = [...found.keys()], res = [];
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    try {
      const j = await (await fetch(`https://nominatim.openstreetmap.org/lookup?format=jsonv2&polygon_geojson=1&osm_ids=${batch.join(",")}`, { headers: UA })).json();
      for (const x of j) { const k = x.osm_type[0].toUpperCase() + x.osm_id, f = found.get(k); res.push({ ...f, acres: Math.round(acresOfGeo(x.geojson) * 100) / 100 }); }
    } catch (e) { console.error("lookup failed", String(e.message || e)); }
    await sleep(1100);
  }
  return res.filter(x => x.kind === "golf course" || x.acres >= MIN_ACRES).map(x => ({ ...x, method: `nominatim-tiles(${tiles} requests; capped tiles are incomplete)` }));
}

let rows = await viaOverpass();
if (!rows) { console.error("no Overpass mirror answered; falling back to Nominatim tiles (not exhaustive)"); rows = await viaNominatim(); }
rows.sort((a, b) => (b.acres || 0) - (a.acres || 0));
console.log(JSON.stringify(rows, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1) + "\n");
console.error(`${rows.length} candidates (${rows.filter(r => r.kind === "golf course").length} golf, ${rows.filter(r => r.kind === "parking lot").length} parking >= ${MIN_ACRES} ac) via ${rows[0] ? rows[0].method : "n/a"}`);
