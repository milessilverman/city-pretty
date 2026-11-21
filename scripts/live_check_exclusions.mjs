// Live check of the housing-law exclusion rule on the real page (real network, NOT part of CI).
//
// Opens real parcels through the page's own click path (houseAt) and records what the house panel says about state housing
// laws, plus the engine's own result for that parcel (activeHouse.audit.statutoryZoning): laws applied, laws not determined
// with the reason, laws excluded with the statute's wording. Run it on two checkouts (before and after a change) by pointing
// SITE_ROOT at the checkout to serve, and compare the printed text.
//
// Usage: NODE_USE_ENV_PROXY=1 LIVE_PORT=9051 [SITE_ROOT=/path/to/checkout] node scripts/live_check_exclusions.mjs "LABEL|fips|lat|lng" ...
//   e.g. "Los Angeles CA|06037|34.0577|-118.3015"
// Writes JSON to data/backtests/live_check_exclusions_<label>.json when OUT is set (path), otherwise prints only.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = process.env.SITE_ROOT || here;
const PORT = Number(process.env.LIVE_PORT || 8897);

// "LABEL|fips|lat|lng", or "LABEL|fips|FIND|R1-1" (Los Angeles: a point inside a zoning polygon of that zone), or
// "LABEL|ENGINE:VT|lat|lng" (see below; OLD_PAGE=1 builds the exclusion flags the way the 19 Nov 2026 base page did)
const points = process.argv.slice(2).map((a) => { const [label, fips, lat, lng] = a.split("|"); return lat === "FIND" ? { label, fips, find: lng } : fips.startsWith("ENGINE:") ? { label, fips: "00000", engine: fips.slice(7), lat: +lat, lng: +lng } : { label, fips, lat: +lat, lng: +lng }; });
if (!points.length) { console.error('usage: live_check_exclusions.mjs "LABEL|fips|lat|lng" ...'); process.exit(2); }

const busy = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
if (busy) throw new Error(`port ${PORT} is already in use; set LIVE_PORT to a free port`);
const srv = spawn(process.execPath, [path.join(siteRoot, "scripts/serve.mjs"), String(PORT)], { cwd: siteRoot, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const result = [];
try {
  for (const P of points) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    if (P.fips !== "06037" && !P.engine) {
      await page.evaluate((f) => (0, eval)("openCounty")(f), P.fips);
      await page.waitForFunction((f) => (window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f) || false, P.fips, { timeout: 180000 }).catch(() => {});
    }
    await page.waitForFunction(() => { try { return (0, eval)("STATE_HOUSING_LAWS_DATA").length > 0; } catch { return false; } }, null, { timeout: 30000 }).catch(() => {});
    if (P.find) {
      // Los Angeles only: the centre of a real zoning polygon of that zone from the page's own zoning layer
      const f = await page.evaluate((zone) => {
        const ev = (s) => (0, eval)(s), Z = ev("D").layers.zoning, zCell = ev("zCell"), zoneAt = ev("zoneAt");
        for (const k of Object.keys(Z.cells)) for (const z of zCell(k)) {
          if (z.zone !== zone || !z.rings || !z.rings[0]) continue;
          const r = z.rings[0], c = { lat: r.reduce((s, q) => s + q[0], 0) / r.length, lng: r.reduce((s, q) => s + q[1], 0) / r.length };
          const hit = zoneAt(c);
          if (hit && hit.zone === zone && c.lat > 33.9 && c.lat < 34.2 && c.lng > -118.5 && c.lng < -118.2) return c;
        }
        return null;
      }, P.find);
      if (f) { P.lat = f.lat; P.lng = f.lng; }
    }
    if (P.engine) {
      // States where the page has no zoning source for the lot: the page's own flood and fire checks run on the real point
      // (lotChecks, live FEMA and CAL FIRE services), a single-family zoning code is supplied by this script, and the page's own
      // evaluateByRightHousing screens it. The exclusion flags are built exactly as the page builds them for its checkout.
      const e = await page.evaluate(async ({ lat, lng, state, stepdown }) => {
        const ev = (x) => (0, eval)(x);
        const R = await ev("lotChecks")({ lat, lng }, {});
        const hist = (R && R.hpoz && R.hpoz.ok) ? false : null;
        const ex = { historic_district_hpoz: hist, coastal_commission_or_sma: stepdown, fema_100yr_floodway: (R && R.fema) ? !!R.fema.sfha : null,
          calfire_or_state_vhfhsz: (R && R.fire) ? !!R.fire.vh : null, airport_noise_or_runway_zone: stepdown, working_waterfront_or_port: stepdown,
          wekiva_or_everglades_protection_area: stepdown, williamson_or_ag_preserve: stepdown, public_or_tribal_land: stepdown,
          has_active_single_family_stepdown: stepdown, population_threshold_ineligible: stepdown };
        const res = ev("evaluateByRightHousing")({ parcel_id: "check", state_code: state, county_fips: null, municipality_pop: null, county_pop: null, base_zoning_code: "R-1",
          is_commercial_or_mixed_use: false, is_single_family_residential: true, dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: ex });
        return { fema: R && R.fema ? R.fema.label : "not answered", flood_flag: ex.fema_100yr_floodway, fire_flag: ex.calfire_or_state_vhfhsz,
          applied: res.applicable_statutes.map((x) => x.id), not_confirmed: res.not_confirmed.map((n) => n.id + ": " + n.reason),
          excluded_by_statute: (res.excluded_by_statute || []).map((n) => n.id + ": " + n.reason) };
      }, { lat: P.lat, lng: P.lng, state: P.engine, stepdown: process.env.OLD_PAGE ? false : null });
      result.push({ ...P, mode: "engine on the real point; zoning R-1 supplied by the script", ...e });
      await page.close();
      continue;
    }
    await page.evaluate((ll) => (0, eval)("houseAt")(ll), { lat: P.lat, lng: P.lng });
    await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const box = document.querySelector("#house");
      return box && !box.querySelector(".house-loading") && ah && ah.audit; }, null, { timeout: 60000 }).catch(() => {});
    const out = await page.evaluate(() => {
      const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null");
      const sz = ah && ah.audit && ah.audit.statutoryZoning;
      const b = document.querySelector("#house");
      const text = b ? b.textContent.replace(/\s+/g, " ") : "";
      const lines = b ? [...b.querySelectorAll("li, p, div")].filter((e) => !e.querySelector("li, p, div")).map((e) => e.textContent.replace(/\s+/g, " ").trim())
        .filter((t) => t && /state law|statute|Live Local|SB \d|HB \d|by.right|lot split|ADU|accessory dwelling|housing law|not determined|Excluded by/i.test(t)) : [];
      return {
        zoning: (b && (b.textContent.match(/Zoning[^A-Za-z0-9]{0,6}([A-Za-z0-9()\-\[\]\/ ]{1,24})/) || [])[1]) || null,
        has_house_panel: !!b && !/No parcel found|No public parcel service/i.test(text),
        flags: sz ? sz.statutory_exclusions : null,
        applied: sz ? (sz.applicable_statutes || []).map((s) => s.id) : null,
        not_confirmed: sz ? (sz.not_confirmed || []).map((n) => n.id + ": " + n.reason) : null,
        excluded_by_statute: sz ? (sz.excluded_by_statute || []).map((n) => n.id + ": " + n.reason) : null,
        notes: sz ? sz.statutoryNotes || null : null,
        panel_lines: lines.slice(0, 40),
      };
    });
    result.push({ ...P, errors, ...out });
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
console.log(JSON.stringify(result, null, 2));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(result, null, 2));
