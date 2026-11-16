// Shared code for LA County parcel pulls (public Assessor layer), block-group assignment and the filters used by
// scripts/backtest_la_valuation.mjs and scripts/build_la_neighborhood_values.mjs.
//
// Legal basis for using base-year resets as a sale-price proxy: Cal. Rev. & Tax. Code §110.1(a)-(b) (base year value
// = fair market value at purchase or change in ownership) and §110(b) (on a purchase, full cash value is the price
// paid, rebuttably presumed for an arm's-length transaction). Some resets are not sales (e.g. Prop 19 family
// transfers, reassessed at the Assessor's appraisal), so this is a proxy, not a recorded sale.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const LAYER = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0";
export const FIELDS = ["OBJECTID", "AIN", "UseCode", "UseType", "UseDescription", "Roll_Year", "Roll_LandValue", "Roll_ImpValue",
  "Roll_LandBaseYear", "Roll_ImpBaseYear", "YearBuilt1", "EffectiveYear1", "SQFTmain1", "Units1", "Bedrooms1",
  "Bathrooms1", "QualityClass1", "SitusCity", "CENTER_LAT", "CENTER_LON", "Shape.STArea()"];
export const LEGAL_BASIS = {
  text: "Cal. Rev. & Tax. Code §110.1(a)-(b): the base year value is the fair market value on the date a purchase or change in ownership occurs (or new construction is completed). §110(b): on a purchase, full cash value is the purchase price paid, rebuttably presumed so for an arm's-length transaction.",
  sources: ["https://california.public.law/codes/revenue_and_taxation_code_section_110.1", "https://california.public.law/codes/revenue_and_taxation_code_section_110"],
  checked_on: "2026-11-16",
  note: "Read from california.public.law (a reproduction of the code); leginfo.legislature.ca.gov blocked automated access.",
};

export async function getJson(url, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "city-pretty-backtest/1.0" }, signal: AbortSignal.timeout(60000) });
      const d = await r.json();
      if (d.error) throw new Error(JSON.stringify(d.error));
      return d;
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
    }
  }
}

// Pull every single-family (use code 0100) parcel whose land and improvement base years both equal each year given.
export async function pullResets(years) {
  const queries = [];
  const records = [];
  for (const y of years) {
    const where = `Roll_LandBaseYear='${y}' AND Roll_ImpBaseYear='${y}' AND UseCode='0100'`;
    const { count } = await getJson(`${LAYER}/query?` + new URLSearchParams({ where, returnCountOnly: "true", f: "json" }));
    for (let off = 0; off < count; off += 1000) {
      const url = `${LAYER}/query?` + new URLSearchParams({
        where, outFields: FIELDS.join(","), orderByFields: "OBJECTID", resultOffset: String(off),
        resultRecordCount: "1000", returnGeometry: "false", f: "json",
      });
      const d = await getJson(url);
      for (const f of d.features) records.push(f.attributes);
      process.stderr.write(`\rbase year ${y}: ${Math.min(off + 1000, count)}/${count}`);
    }
    process.stderr.write("\n");
    queries.push({ base_year: String(y), where, count, url_pattern: `${LAYER}/query?where=${encodeURIComponent(where)}&outFields=...&orderByFields=OBJECTID&resultOffset=<0,1000,...>&resultRecordCount=1000&f=json` });
  }
  return { source: LAYER, publisher: "Los Angeles County Assessor (public parcel layer)", pulled: new Date().toISOString(), queries, fields: FIELDS, records };
}

export function readGz(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); }
export function writeGz(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(obj))); }

// Exclusion rules. `years` = the base years accepted; `newBuildYear` = homes built/rebuilt in or after it are excluded
// (their base year may come from new construction, not a sale).
export function filterReason(a, years, newBuildYear) {
  const y = +a.Roll_LandBaseYear;
  const land = +a.Roll_LandValue || 0, imp = +a.Roll_ImpValue || 0;
  const yb = +a.YearBuilt1 || 0, eff = +a.EffectiveYear1 || 0;
  if (a.Roll_Year !== "2026") return "roll year is not 2026";
  if (+a.Units1 !== 1) return "not exactly one unit";
  if (!yb || yb >= newBuildYear) return `built ${newBuildYear} or later, or year built missing (could be new construction)`;
  if (eff >= newBuildYear) return `effective year ${newBuildYear} or later (major remodel or rebuild)`;
  if (land < 50000 || imp < 20000) return "land under $50k or improvements under $20k (odd or partial value)";
  if (!(+a.SQFTmain1 >= 400)) return "living area missing or under 400 sq ft";
  if (!(a.CENTER_LAT && a.CENTER_LON)) return "no coordinates";
  if (land + imp > 20e6) return "value over $20M";
  if (!years.includes(y)) return "base year outside target";
  return null;
}

// "D55B" -> { cls: "D", quality: 5.5, shape: "B" } (Assessor quality class: construction type, quality, shape).
export function parseQuality(q) {
  const m = String(q || "").trim().match(/^([A-Z])(\d)(\d)?([A-Z])?/);
  if (!m) return { cls: null, quality: null, shape: null };
  return { cls: m[1], quality: m[3] ? +`${m[2]}.${m[3]}` : +m[2], shape: m[4] || null };
}

// LA bundle: block-group polygons (2020 GEOIDs) and the old details m records.
export function loadLA(root) {
  const bundle = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(root, "app/data/bundle-la.b64.txt"), "utf8").trim(), "base64")));
  const det = JSON.parse(fs.readFileSync(path.join(root, "app/data/details-la.json"), "utf8"));
  const m = new Map();
  for (const b64 of Object.values(det.chunks)) {
    const chunk = JSON.parse(zlib.gunzipSync(Buffer.from(b64, "base64")));
    for (const [bg, rec] of Object.entries(chunk)) m.set(bg, rec.m || {});
  }
  const G = 0.02, grid = new Map();
  for (const f of bundle.bgs.features) {
    const g = f.geometry;
    const rings = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of rings) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const p = { id: f.properties.id, poly, box: [x0, y0, x1, y1] };
      for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++)
        for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) {
          const k = gx + ":" + gy;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(p);
        }
    }
  }
  const inRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const bgAt = (lng, lat) => {
    for (const p of grid.get(Math.floor(lng / G) + ":" + Math.floor(lat / G)) || []) {
      const [x0, y0, x1, y1] = p.box;
      if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
      if (inRing(lng, lat, p.poly[0]) && !p.poly.slice(1).some((h) => inRing(lng, lat, h))) return p.id;
    }
    return null;
  };
  return { m, bgAt, bgIds: bundle.bgs.features.map((f) => f.properties.id) };
}

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
