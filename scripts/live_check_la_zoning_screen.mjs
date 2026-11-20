// Live check that a Los Angeles lot inside a mapped zone reaches the state-law screen WITH its zoning code
// (real network, NOT part of CI).
//
// Why: found 19 Nov 2026 at 2107 Duxbury Cir. The house panel's Zoning row showed the mapped zone, but the owner
// playbook said "Zoning is not on file for this parcel" and the Invest view's "This house" said "Not determined:
// zoning code unknown" for every addition, because both read a `zone` field that LA's zone_rules rows do not have.
//
// For each address this geocodes it now (US Census geocoder), opens the lot through the page's own click path
// (houseAt), and checks on the real page that:
//   the Zoning row in the house panel shows the code zoneAt gives at the lot
//   the owner playbook's law card names that same code as the parcel's zoning (when a law card is shown)
//   the owner playbook does not say "Zoning is not on file"
//   the Invest view's "This house" does not say "zoning code unknown"
//   for a lot the zoning map classes as single-family: the playbook and "This house" name the state ADU law and SB 9
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/live_check_la_zoning_screen.mjs ["address" ...]
//        (writes data/backtests/live_check_la_zoning_screen_<date>.json)
// Env: LIVE_PORT (default 8893).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LIVE_PORT || 8893);
const GEOCODER = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const DEFAULT = ["2107 Duxbury Cir, Los Angeles, CA"];

async function geocode(address) {
  const url = `${GEOCODER}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "city-pretty-live-check/1.0" }, signal: AbortSignal.timeout(40000) });
      const j = await r.json();
      const m = j.result && j.result.addressMatches && j.result.addressMatches[0];
      if (!m) return { url, error: "no address match" };
      return { url, matched: m.matchedAddress, lat: m.coordinates.y, lng: m.coordinates.x };
    } catch (e) { if (i === 3) return { url, error: String(e.message || e) }; await new Promise((res) => setTimeout(res, 2000)); }
  }
}

async function main() {
  const addresses = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
  const busy = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${PORT} is already in use; set LIVE_PORT to a free port`);
  const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const out = { checked_at: new Date().toISOString(), port: PORT, lots: [] };
  let failed = 0;
  try {
    for (const address of addresses) {
      const rec = { address, geocode: await geocode(address), checks: {}, errors: [] };
      out.lots.push(rec);
      if (rec.geocode.error) { rec.errors.push("geocode: " + rec.geocode.error); failed++; continue; }
      const page = await browser.newPage();
      page.on("pageerror", (e) => rec.errors.push("pageerror: " + e.message.slice(0, 200)));
      try {
        await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
        await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
        // The geocoder interpolates along the street, so the point can fall in the roadway: try it, then small steps
        // to either side, and keep the first lot whose situs address has the same house number and street word.
        const [num, street] = address.toUpperCase().split(/[ ,]+/);
        const steps = [[0, 0]];
        for (const d of [0.00015, 0.0003]) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) steps.push([a * d, b * d]);
        let got = null;
        for (const [dy, dx] of steps) {
          const ll = { lat: rec.geocode.lat + dy, lng: rec.geocode.lng + dx };
          await page.evaluate((p) => (0, eval)("houseAt")(p), ll);
          await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && (!!b.querySelector("[data-live-facts]") || /Right-of-Way|did not answer|Couldn.t get this lot/i.test(b.textContent)); }, null, { timeout: 60000 }).catch(() => {});
          const situs = await page.evaluate(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); return ah && ah.a ? String(ah.a.SitusFullAddress || "") : ""; });
          if (situs.toUpperCase().includes(num) && situs.toUpperCase().includes(street)) { got = { ll, situs }; break; }
        }
        if (!got) { rec.errors.push("the lot for this address did not open near the geocoded point"); failed++; continue; }
        rec.opened = got;
        await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const box = document.querySelector("#house");
          return box && !box.querySelector(".house-loading") && (!ah || (ah.st && ah.st.rDone && ah.st.osmDone)); }, null, { timeout: 60000 }).catch(() => {});
        const panel = await page.evaluate(() => {
          const ah = (0, eval)("activeHouse"), z = (0, eval)("zoneAt")(ah.ll);
          const b = document.querySelector("#house"), pb = b.querySelector(".owner-playbook-card");
          return { mapped_zone: z ? z.zone : null, cat: z ? z.cat : null, use: ah.a.UseDescription || null, house: b.textContent.replace(/\s+/g, " "), playbook: pb ? pb.textContent.replace(/\s+/g, " ").trim() : null };
        });
        await page.click("#view-switch [data-view=invest]");
        await page.waitForFunction(() => { const s = document.querySelector("#iv-house"); return !!s && !/Open a lot on the map/.test(s.textContent) && s.textContent.length > 80; }, null, { timeout: 90000 }).catch(() => {});
        const invest = await page.evaluate(() => {
          const s = document.querySelector("#iv-house");
          return { this_house: s ? s.textContent.replace(/\s+/g, " ").trim() : null };
        });
        rec.mapped_zone = panel.mapped_zone; rec.use_description = panel.use; rec.zone_category = panel.cat;
        rec.screen_code = ((panel.playbook || "").match(/recorded zoning \(([^)]*)\)/) || [])[1] || null;
        rec.playbook_text = panel.playbook; rec.this_house_text = invest.this_house;
        const sfr = panel.cat === "single-family";
        const C = rec.checks;
        C.lot_is_in_a_mapped_zone = !!panel.mapped_zone;
        C.zoning_row_shows_mapped_zone = !!panel.mapped_zone && panel.house.includes(panel.mapped_zone);
        if (rec.screen_code != null || sfr) C.screen_uses_mapped_zone = !!panel.mapped_zone && rec.screen_code === panel.mapped_zone;
        C.playbook_has_zoning = !!panel.playbook && !/Zoning is not on file/i.test(panel.playbook);
        C.this_house_has_zoning = !!invest.this_house && !/zoning code unknown/i.test(invest.this_house);
        if (sfr) {
          C.playbook_names_adu_and_sb9 = /ADU/i.test(panel.playbook || "") && /SB 9/i.test(panel.playbook || "");
          C.this_house_names_adu_and_sb9 = /ADU/i.test(invest.this_house || "") && /SB 9/i.test(invest.this_house || "");
        }
        if (Object.values(C).some((v) => v !== true) || rec.errors.length) failed++;
      } catch (e) { rec.errors.push(String(e.message || e).slice(0, 300)); failed++; } finally { await page.close(); }
    }
  } finally { await browser.close(); srv.kill(); }
  out.failed = failed;
  const file = path.join(root, `data/backtests/live_check_la_zoning_screen_${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  for (const r of out.lots) console.log(r.address, "| zone", r.mapped_zone, "| screen", r.screen_code, "|", JSON.stringify(r.checks), r.errors.length ? "| errors: " + r.errors.join("; ") : "");
  console.log(failed ? `FAILED: ${failed} of ${out.lots.length} lots` : `ok: ${out.lots.length} lots`, "->", path.relative(root, file));
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
