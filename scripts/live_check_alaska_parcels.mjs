// Live check: clicking a point in an Alaska borough with a county data file shows the parcel that the borough's parcel service
// returns for that point (queried separately here), through the page's own click path (houseAt). Also lists every request the page
// made that failed, so a missing overlay file is seen.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_alaska_parcels.mjs   (writes data/backtests/live_check_alaska_parcels_<date>.json)
// Env: LIVE_PORT (default 8867).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8867);
const REG = JSON.parse(fs.readFileSync(path.join(root, "app/data/parcel_services.json"), "utf8")).services;
// real addresses (from the layer itself, 16-17 Nov 2026): downtown, Midtown, Eagle River
const POINTS = { "02020": [{ lat: 61.21574, lng: -149.89388 }, { lat: 61.139344, lng: -149.899613 }, { lat: 61.188369, lng: -149.741337 }] };

async function serviceRecord(svc, ll) {
  const u = `${svc.url}/query?` + new URLSearchParams({ geometry: `${ll.lng},${ll.lat}`, geometryType: "esriGeometryPoint", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: svc.fields.map((f) => f[0]).join(","), returnGeometry: "false", f: "json" });
  const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
  const d = await r.json();
  return (d.features && d.features[0] && d.features[0].attributes) || null;
}

async function main() {
  const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const out = { ran_on: new Date().toISOString(), script: "scripts/live_check_alaska_parcels.mjs", results: {} };
  try {
    for (const [fips, pts] of Object.entries(POINTS)) {
      const svc = REG.find((s) => (s.counties || []).includes(fips));
      const rec = { service: svc && svc.name, points: [], failed_requests: [] };
      out.results[fips] = rec;
      const page = await browser.newPage();
      page.on("response", (r) => { if (r.status() >= 400) rec.failed_requests.push(`${r.status()} ${r.url().slice(0, 160)}`); });
      page.on("pageerror", (e) => rec.failed_requests.push("pageerror " + e.message.slice(0, 160)));
      await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
      await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
      await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
      await page.evaluate((f) => (0, eval)("openCounty")(f), fips);
      await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, fips, { timeout: 180000 });
      rec.bundle = await page.evaluate(() => ({ fips: window.D_OC.meta.fips, block_groups: window.D_OC.features.length, load_failed: !!window.D_OC.meta.load_failed }));
      for (const ll of pts) {
        const want = await serviceRecord(svc, ll);
        await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
        await page.waitForFunction(() => /Parcel|parcel/.test(document.querySelector("#panel")?.textContent || ""), null, { timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(4000);
        const txt = await page.evaluate(() => document.querySelector("#panel")?.textContent || "");
        const id = want && want.Parcel_ID, addr = want && want.Parcel_Address;
        rec.points.push({ ...ll, service_parcel_id: id, service_address: addr, panel_has_id: !!id && txt.includes(id),
          panel_has_address: !!addr && txt.toUpperCase().includes(String(addr).toUpperCase()), pass: !!id && txt.includes(id) });
        console.log(fips, ll.lat, ll.lng, id, addr, txt.includes(id) ? "OK" : "MISSING");
      }
      await page.close();
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  const day = new Date().toISOString().slice(0, 10);
  const p = path.join(root, `data/backtests/live_check_alaska_parcels_${day}.json`);
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log("failed requests:", JSON.stringify(Object.values(out.results).map((r) => r.failed_requests)));
  console.log("wrote", p);
}
main().catch((e) => { console.error(e); process.exit(1); });
