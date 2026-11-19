// Debug helper (not CI): open a county on the served page and report what the page's own fetchParcel returns for a point.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/debug_parcel_lookup.mjs <fips> <lat> <lng> [port]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [fips, lat, lng, port = "8835"] = process.argv.slice(2);
const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), port], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch();
try {
  const p = await b.newPage();
  p.on("requestfinished", async (r) => { if (/query\?/.test(r.url()) && !/tigerweb/.test(r.url())) { const res = await r.response(); let body = ""; try { body = (await res.text()).slice(0, 160); } catch (e) {} console.log("req:", res && res.status(), r.url().slice(0, 400), "\n   body:", body); } });
  const t0 = new Map();
  p.on("request", (r) => t0.set(r, Date.now()));
  p.on("requestfailed", (r) => { if (/query/.test(r.url())) console.log("FAILED after", Date.now() - (t0.get(r) || Date.now()), "ms:", r.failure() && r.failure().errorText, r.url().slice(0, 4000)); });
  await p.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
  await p.goto(`http://127.0.0.1:${port}/city-pretty/`);
  await p.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 90000 });
  if (fips !== "06037") {
    await p.evaluate((f) => (0, eval)("openCounty")(f), fips);
    await p.waitForFunction((f) => window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f, fips, { timeout: 120000 });
  }
  const ll = { lat: +lat, lng: +lng };
  const r = await p.evaluate(async (ll) => {
    const ev = (s) => (0, eval)(s);
    const svc = ev("parcelSvc")(ev("activeFips")());
    let f = null, err = null;
    try { f = await ev("fetchParcel")(ll); } catch (e) { err = String(e); }
    const feats = ev("allFeatures")();
    const g0 = feats.length ? feats[feats.length - 1].geometry : null;
    const hit = feats.find((f2) => { try { return ev("pointInFeature")(f2, ll.lng, ll.lat); } catch (e) { return false; } });
    const bgInfo = { nFeatures: feats.length, geomType: g0 && g0.type, coordSample: g0 && JSON.stringify(g0.coordinates).slice(0, 120), hit: hit ? hit.properties.id : null, selected: ev("selected") };
    return { bgInfo, fips: ev("activeFips")(), svc: svc && svc.url, err, has: !!f, attrs: f && f.attributes ? Object.keys(f.attributes).slice(0, 14) : null,
      ring0: f && f.geometry && f.geometry.rings ? f.geometry.rings[0].slice(0, 2) : null, contains: f && f.geometry && f.geometry.rings ? ev("ringsContain")(f.geometry.rings, ll) : null };
  }, ll);
  console.log(JSON.stringify(r));
} finally {
  await b.close();
  srv.kill();
}
