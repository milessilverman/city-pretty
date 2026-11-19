// Live check (not CI): every parcel service the page uses (app/data/parcel_services.json) must be a polygon layer that
// has the fields the page asks it for. Two county entries were zoning layers without parcel fields (King, Miami-Dade),
// which made every house click there fail (found 16 Nov 2026).
// Usage: NODE_USE_ENV_PROXY=1 node scripts/check_parcel_registry.mjs  -> data/backtests/parcel_registry_check_<date>.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reg = JSON.parse(fs.readFileSync(path.join(root, "app/data/parcel_services.json"), "utf8"));
const services = Array.isArray(reg) ? reg : reg.services || Object.values(reg).find(Array.isArray) || [];

async function meta(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url + "?f=json", { signal: ctl.signal });
    if (!r.ok) return { error: "HTTP " + r.status };
    return await r.json();
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

const out = [];
const queue = services.slice();
async function worker() {
  while (queue.length) {
    const s = queue.shift();
    const m = await meta(s.url);
    const rec = { url: s.url, name: s.name, counties: s.counties, states: s.states };
    if (m.error) { rec.status = "unreachable"; rec.detail = typeof m.error === "string" ? m.error : JSON.stringify(m.error).slice(0, 160); }
    else {
      const have = new Set((m.fields || []).map((f) => f.name.toUpperCase()));
      // A field spec can join several fields ("ST_NUM + ST_NAME"); joined MapServer layers name fields "TABLE.FIELD".
      const want = (s.fields || []).flatMap((f) => String(f[0]).split(/\s*\+\s*/)).filter((f) => f && !/\(\)$/.test(f));
      const hasField = (f) => { const u = f.toUpperCase(); return have.has(u) || [...have].some((h) => h.endsWith("." + u) || u.endsWith("." + h)); };
      const missing = want.filter((f) => !hasField(f));
      rec.layer_name = m.name;
      rec.geometry = m.geometryType;
      rec.missing_fields = missing;
      rec.status = m.geometryType !== "esriGeometryPolygon" ? "not a polygon layer" : missing.length ? "fields missing" : "ok";
    }
    out.push(rec);
    if (rec.status !== "ok") console.error(`${rec.status}: ${s.name} ${s.url}${rec.missing_fields && rec.missing_fields.length ? " missing " + rec.missing_fields.join(",") : ""}${rec.detail ? " " + rec.detail : ""}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
out.sort((a, b) => a.url.localeCompare(b.url));
const counts = out.reduce((c, r) => ((c[r.status] = (c[r.status] || 0) + 1), c), {});
const date = new Date().toISOString().slice(0, 10);
const file = path.join(root, `data/backtests/parcel_registry_check_${date}.json`);
fs.writeFileSync(file, JSON.stringify({ ran_on: new Date().toISOString(), script: "scripts/check_parcel_registry.mjs", counts, services: out }, null, 1) + "\n");
console.error(JSON.stringify(counts));
console.error("wrote " + file);
