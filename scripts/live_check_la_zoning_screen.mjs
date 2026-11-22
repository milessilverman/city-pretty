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
//
// Sample mode (20 Nov 2026): the address mode proved the fix on one lot. `--sample` picks points from the page's own LA
// zoning layer across zone groups (plain R1, R1 variation, R1 rear-mass, RS, RE, RA, A, R2, RD, R3, R4, C2, M, and one
// lot per other jurisdiction the layer carries), opens each through houseAt against the real parcel service, and
// records what the page shows. A point with no parcel (a street, an alley) or an unanswered parcel service is recorded
// as skipped and another polygon of the group is tried (up to 5 polygons).
//        NODE_USE_ENV_PROXY=1 node scripts/live_check_la_zoning_screen.mjs --sample [--groups R1,R1V,...] [--seed N]
//        (writes data/backtests/live_check_la_zoning_screen_<date>_sample.json; a --groups run replaces only its own
//         groups in that day's file, so shards run one after another add up to the full sample)
// Env: LIVE_PORT (default 8893).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
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


// ---- sample mode ----
// [group, lots wanted, jurisdiction in the layer, zone-code test (source), layer categories the group may carry or null]
const SAMPLE_GROUPS = [
  ["R1", 2, "Los Angeles", "^R1-1$"],
  ["R1V", 2, "Los Angeles", "^R1[VFH]\\d"],
  ["R1R", 2, "Los Angeles", "^R1R\\d"],
  ["RS", 2, "Los Angeles", "^RS-"],
  ["RE", 2, "Los Angeles", "^RE\\d"],
  ["RA", 2, "Los Angeles", "^RA-"],
  ["A", 2, "Los Angeles", "^A[12]-"],
  ["R2", 2, "Los Angeles", "^R2-"],
  ["RD", 2, "Los Angeles", "^RD\\d"],
  ["R3", 2, "Los Angeles", "^R3-"],
  ["R4", 2, "Los Angeles", "^R4-"],
  ["C2", 2, "Los Angeles", "^C2-"],
  ["M", 2, "Los Angeles", "^M[12]-"],
  ["UNINC", 1, "Unincorporated LA County", "^R-1$"],
  ["UNINC-R2", 1, "Unincorporated LA County", "^R-2$"],
  ["UNINC-A2", 1, "Unincorporated LA County", "^A-2-"],
  ["UNINC-C", 1, "Unincorporated LA County", "^C-[23]$"],
  ["LONGBEACH", 1, "Long Beach", "."],
  ["GLENDALE", 1, "Glendale", "."],
  ["PASADENA", 1, "Pasadena", "."],
  ["TORRANCE", 1, "Torrance", "."],
  ["BURBANK", 1, "Burbank", "."],
  ["SANTACLARITA", 1, "Santa Clarita", "^UR[12]$"],
];
const MAX_POLYGONS = 5, POINTS_PER_POLYGON = 3;
const SF_LAW = /SB\s*9|lot split|duplex/i;

async function openApp(browser, rec) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => rec.errors.push("pageerror: " + e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") rec.console_errors.push(m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
  await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
  return page;
}

// Polygons of one group from the page's own zoning layer, in a seeded shuffle, each with points zoneAt places in that zone.
function pickCandidates(page, juris, zoneRe, seed, want) {
  return page.evaluate(({ juris, zoneRe, seed, want }) => {
    const ev = (s) => (0, eval)(s), Z = ev("D").layers.zoning, zCell = ev("zCell"), zoneAt = ev("zoneAt"), re = new RegExp(zoneRe);
    const all = [];
    for (const k of Object.keys(Z.cells)) for (const z of zCell(k)) if (z.juris === juris && re.test(z.zone) && z.rings && z.rings[0] && z.rings[0].length > 2) all.push(z);
    let t = seed >>> 0;
    const rnd = () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const out = [];
    for (const z of all) {
      const r = z.rings[0], c = { lat: r.reduce((s, q) => s + q[0], 0) / r.length, lng: r.reduce((s, q) => s + q[1], 0) / r.length };
      // The centroid of a block-sized zone polygon is often the alley; ~25 m steps to each side are tried after it.
      const pts = [c, { lat: c.lat + 0.00022, lng: c.lng }, { lat: c.lat - 0.00022, lng: c.lng }, { lat: c.lat, lng: c.lng + 0.00027 }, { lat: c.lat, lng: c.lng - 0.00027 }]
        .filter((p) => { const h = zoneAt(p); return h && h.zone === z.zone && h.juris === z.juris; });
      if (pts.length) out.push({ zone: z.zone, cat: z.cat, juris: z.juris, points: pts });
      if (out.length >= want) break;
    }
    return { polygons_in_group: all.length, picks: out };
  }, { juris, zoneRe, seed, want });
}

// Opens the lot at ll on the page. Returns { ok } or { skip: reason }.
async function openLot(page, ll) {
  await page.evaluate((p) => { (0, eval)("houseAt")(p); }, ll);
  await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && !b.querySelector(".house-loading") && (!!b.querySelector("[data-live-facts]") || /No parcel found at this point|No public parcel service|Couldn.t get this lot/i.test(b.textContent)); }, null, { timeout: 60000 }).catch(() => {});
  const s = await page.evaluate(() => { const b = document.querySelector("#house"), ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null");
    return { text: b ? b.textContent.replace(/\s+/g, " ").trim().slice(0, 400) : "", open: !!(b && b.querySelector("[data-live-facts]") && ah && ah.a) }; });
  if (s.open) return { ok: true };
  if (/No parcel found at this point/i.test(s.text)) return { skip: "no parcel at this point (street, alley, water or a gap): " + s.text };
  if (/Couldn.t get this lot/i.test(s.text)) return { skip: "parcel service did not answer: " + s.text };
  return { skip: "the lot did not open within 60 s: " + s.text };
}

async function readLot(page) {
  const done = await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const box = document.querySelector("#house");
    return !!box && !box.querySelector(".house-loading") && !!ah && !!ah.st && !!ah.st.rDone && !!ah.st.osmDone; }, null, { timeout: 90000 }).then(() => true, () => false);
  const panel = await page.evaluate(() => {
    const ah = (0, eval)("activeHouse"), z = (0, eval)("zoneAt")(ah.ll), t = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
    const b = document.querySelector("#house"), pb = b.querySelector(".owner-playbook-card");
    const row = [...b.querySelectorAll("tr")].find((tr) => tr.children[0] && tr.children[0].textContent.trim() === "Zoning");
    const R = (ah.st && ah.st.R) || {}, hz = {};
    for (const k of Object.keys(R)) { const v = R[k]; hz[k] = v == null ? null : typeof v !== "object" ? v : Object.fromEntries(Object.entries(v).filter(([, x]) => x == null || typeof x !== "object").slice(0, 6).concat(Array.isArray(v.v) ? [["v_count", v.v.length]] : [])); }
    return { ll: { lat: ah.ll.lat, lng: ah.ll.lng }, zone: z ? z.zone : null, cat: z ? z.cat : null, juris: z ? z.juris : null, ain: ah.a.AIN || null, situs: ah.a.SitusFullAddress || null,
      use: ah.a.UseDescription || null, use_code: ah.a.UseCode || null, zoning_row: row ? t(row.children[1]) : null, playbook: t(pb), house_len: b.textContent.length,
      not_confirmed: [...b.querySelectorAll("*")].filter((e) => !e.children.length && /Not confirmed/i.test(e.textContent)).map(t).slice(0, 6), hazards: hz,
      page_class: (() => { try { const f = (0, eval)("typeof bundleZoneClass === 'function' ? bundleZoneClass : null"); return f ? f(z) : undefined; } catch (e) { return "error: " + e.message; } })(),
      st: { rDone: !!ah.st.rDone, osmDone: !!ah.st.osmDone } };
  });
  await page.click("#view-switch [data-view=invest]");
  await page.waitForFunction(() => { const s = document.querySelector("#iv-house"); return !!s && !/Open a lot on the map/.test(s.textContent) && s.textContent.length > 80; }, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const thisHouse = await page.evaluate(() => { const s = document.querySelector("#iv-house"); return s ? s.textContent.replace(/\s+/g, " ").trim() : null; });
  return { done, panel, thisHouse };
}

function checkLot(rec, pick) {
  const pb = rec.playbook_text || "", ih = rec.this_house_text || "", C = rec.checks, cat = String(rec.zone_category || "");
  C.checks_finished = rec.checks_finished === true;
  C.lot_zone_is_the_picked_zone = rec.mapped_zone === pick.zone && rec.jurisdiction === pick.juris;
  C.zoning_row_shows_mapped_zone = !!rec.mapped_zone && !!rec.zoning_row_text && rec.zoning_row_text.startsWith(rec.mapped_zone) && rec.zoning_row_text.includes(`(${rec.jurisdiction})`);
  C.a_playbook_has_zoning = !!pb && !/Zoning is not on file/i.test(pb);
  C.b_this_house_has_zoning = !!ih && !/zoning code unknown/i.test(ih);
  if (rec.screen_code != null) C.c_law_card_code_is_mapped_zone = rec.screen_code === rec.mapped_zone;
  if (cat === "single-family" && rec.page_zone_class === "none") {
    // The layer calls the zone single-family but it is not on the jurisdiction's published SB 9 list (e.g. County A-2):
    // the page must screen no single-family law for it, and say the zoning is why.
    C.d_off_list_zone_gets_no_single_family_law = !/(Backyard home \(ADU\)|Split the lot) Allowed by state law/i.test(ih) && !/recorded zoning \([^)]*\)/.test(pb);
    C.d_off_list_zone_says_why = /zoning is not classed here as single-family or multifamily residential/i.test(ih);
  } else if (cat === "single-family") {
    C.d_single_family_shows_sb9_and_adu_or_not_confirmed = (/SB\s*9/i.test(pb) && /ADU/i.test(pb)) || /Not confirmed/i.test(pb);
    C.d_this_house_not_called_non_single_family = !/not (recorded|classed here) as single-family/i.test(ih);
  } else if (/^(multifamily|commercial)/.test(cat)) {
    C.d_no_sb9_in_playbook = !SF_LAW.test(pb);
    C.d_this_house_no_state_lot_split = !/Split the lot Allowed by state law/i.test(ih) && !/apply to this lot:[^.]*SB\s*9/i.test(ih);
  } else {
    C.d_no_single_family_law_in_playbook = !SF_LAW.test(pb) && !/\bADU\b/i.test(pb);
    C.d_this_house_no_single_family_law = !/(Split the lot|Backyard home \(ADU\)) Allowed by state law/i.test(ih) && !/apply to this lot:[^.]*SB\s*9/i.test(ih);
  }
}

async function sampleMain(args) {
  const gi = args.indexOf("--groups"), si = args.indexOf("--seed");
  const only = gi >= 0 && args[gi + 1] ? args[gi + 1].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
  const seed = si >= 0 ? Number(args[si + 1]) || 1 : 20261120;
  const groups = SAMPLE_GROUPS.filter((g) => !only || only.includes(g[0]));
  if (only) for (const o of only) if (!SAMPLE_GROUPS.some((g) => g[0] === o)) throw new Error(`unknown group ${o}; groups: ${SAMPLE_GROUPS.map((g) => g[0]).join(",")}`);
  const busy = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${PORT} is already in use; set LIVE_PORT to a free port`);
  const srv = spawn(process.execPath, [path.join(root, "scripts/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex").slice(0, 16);
  // The page under test is the working tree as served; its files are fingerprinted because they may be mid-edit.
  const run = { checked_at: new Date().toISOString(), port: PORT, seed, app_files_sha256_16: { "app/app.js": sha("app/app.js"), "app/invest.js": sha("app/invest.js") }, groups: {} };
  try {
    for (const [name, want, juris, zoneRe] of groups) {
      const G = run.groups[name] = { group: name, app_files_sha256_16: { "app/app.js": sha("app/app.js"), "app/invest.js": sha("app/invest.js") }, jurisdiction: juris, zone_test: zoneRe, wanted: want, checked_at: new Date().toISOString(), layer_jurisdictions: null, polygons_in_group: 0, lots: [], skipped: [], errors: [] };
      const shell = { errors: G.errors, console_errors: [] };
      let page = null, picks = [];
      try {
        page = await openApp(browser, shell);
        G.layer_jurisdictions = await page.evaluate(() => (0, eval)("D").layers.zoning.jur || []);
        const c = await pickCandidates(page, juris, zoneRe, seed, MAX_POLYGONS + want - 1);
        G.polygons_in_group = c.polygons_in_group; picks = c.picks;
      } catch (e) { G.errors.push(String(e.message || e).slice(0, 300)); }
      if (!G.polygons_in_group) { G.not_in_layer = true; console.log(`${name} | no polygons in the page's zoning layer for jurisdiction "${juris}" matching ${zoneRe}`); if (page) await page.close(); continue; }
      let tried = 0;
      for (const pick of picks) {
        if (G.lots.length >= want || tried >= MAX_POLYGONS + G.lots.length) break;
        tried++;
        const rec = { group: name, picked: { zone: pick.zone, category: pick.cat, jurisdiction: pick.juris }, checks: {}, errors: [], console_errors: [] };
        try {
          if (!page) page = await openApp(browser, rec);
          let opened = null;
          for (const ll of pick.points.slice(0, POINTS_PER_POLYGON)) {
            const r = await openLot(page, ll);
            if (r.ok) { opened = ll; break; }
            G.skipped.push({ lat: ll.lat, lng: ll.lng, zone: pick.zone, reason: r.skip });
          }
          if (!opened) continue;
          const { done, panel, thisHouse } = await readLot(page);
          Object.assign(rec, { lat: panel.ll.lat, lng: panel.ll.lng, mapped_zone: panel.zone, zone_category: panel.cat, jurisdiction: panel.juris, ain: panel.ain, situs_address: panel.situs,
            use_description: panel.use, use_code: panel.use_code, zoning_row_text: panel.zoning_row, screen_code: ((panel.playbook || "").match(/recorded zoning \(([^)]*)\)/) || [])[1] || null,
            page_zone_class: panel.page_class === undefined ? "bundleZoneClass not on the page" : panel.page_class,
            checks_finished: done, checks_state: panel.st, hazard_answers: panel.hazards,
            // Site conditions the page's own checks returned that the statute screen treats as exclusions, and those not answered.
            exclusions_on_record: [panel.hazards.fire && panel.hazards.fire.vh ? "very high fire hazard severity zone" : null, panel.hazards.fema && panel.hazards.fema.sfha ? "FEMA special flood hazard area" : null,
              ["hpoz", "hcm"].some((k) => panel.hazards[k] && panel.hazards[k].v_count > 0) ? "historic (HPOZ / monument)" : null].filter(Boolean),
            hazards_unanswered: ["hpoz", "hcm", "hc", "fema", "fire"].filter((k) => panel.hazards[k] == null || panel.hazards[k].ok === false), not_confirmed_notes: panel.not_confirmed, playbook_text: panel.playbook, this_house_text: thisHouse });
          checkLot(rec, pick);
          G.lots.push(rec);
          rec.failed = Object.entries(rec.checks).filter(([, v]) => v !== true).map(([k]) => k).concat(rec.errors.map((e) => "error: " + e));
          console.log(`${name} | ${rec.lat.toFixed(6)},${rec.lng.toFixed(6)} | ${rec.mapped_zone} | ${rec.zone_category} | ${rec.jurisdiction} | AIN ${rec.ain} | ${rec.situs_address} | use ${rec.use_description} | page class ${rec.page_zone_class} | screen ${rec.screen_code} | ${rec.failed.length ? "FAIL " + rec.failed.join(", ") + (rec.exclusions_on_record.length ? " (on record: " + rec.exclusions_on_record.join("; ") + ")" : "") : "ok"}${rec.hazards_unanswered.length ? " | unanswered: " + rec.hazards_unanswered.join(",") : ""}`);
        } catch (e) {
          G.skipped.push({ zone: pick.zone, point: pick.points[0], reason: "error while reading the lot: " + String(e.message || e).slice(0, 300) });
        } finally { if (page) { await page.close().catch(() => {}); page = null; } }   // every lot starts on a fresh page
      }
      if (page) await page.close().catch(() => {});
      for (const s of G.skipped) console.log(`${name} | skipped ${s.lat != null ? s.lat.toFixed(6) + "," + s.lng.toFixed(6) : ""} | ${s.zone} | ${s.reason.slice(0, 110)}`);
      if (G.lots.length < want) console.log(`${name} | only ${G.lots.length} of ${want} lots opened after ${tried} polygons`);
    }
  } finally { await browser.close(); srv.kill(); }
  // A --groups run replaces only its own groups in the day's file.
  const file = path.join(root, `data/backtests/live_check_la_zoning_screen_${new Date().toISOString().slice(0, 10)}_sample.json`);
  let out = { what: "Live sample of LA County lots across zone groups, opened on the real page (scripts/live_check_la_zoning_screen.mjs --sample)", runs: [], groups: {} };
  if (only && fs.existsSync(file)) { try { const prev = JSON.parse(fs.readFileSync(file, "utf8")); if (prev && prev.groups) out = prev; } catch { /* start over */ } }
  out.runs = (out.runs || []).concat([{ checked_at: run.checked_at, port: PORT, seed, app_files_sha256_16: run.app_files_sha256_16, groups: groups.map((g) => g[0]) }]);
  Object.assign(out.groups, run.groups);
  const lots = Object.values(out.groups).flatMap((g) => g.lots);
  out.summary = { groups: Object.keys(out.groups).length, groups_not_in_layer: Object.values(out.groups).filter((g) => g.not_in_layer).map((g) => g.group),
    groups_short_of_wanted: Object.values(out.groups).filter((g) => !g.not_in_layer && g.lots.length < g.wanted).map((g) => g.group),
    lots_checked: lots.length, lots_failed: lots.filter((l) => l.failed.length).length, points_skipped: Object.values(out.groups).reduce((n, g) => n + g.skipped.length, 0) };
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  const mine = Object.values(run.groups), myLots = mine.flatMap((g) => g.lots), bad = myLots.filter((l) => l.failed.length).length;
  console.log(`${bad ? "FAILED: " + bad + " of " : "ok: "}${myLots.length} lots in this run (${mine.filter((g) => g.not_in_layer).length} groups not in the layer, ${mine.reduce((n, g) => n + g.skipped.length, 0)} points skipped); file total ${JSON.stringify(out.summary)} -> ${path.relative(root, file)}`);
  process.exit(bad ? 1 : 0);
}

async function main() {
  if (process.argv.includes("--sample")) return sampleMain(process.argv.slice(2));
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
          await page.waitForFunction(() => { const b = document.querySelector("#house"); return !!b && (!!b.querySelector("[data-live-facts]") || /Right-of-Way|No parcel found at this point|did not answer|Couldn.t get this lot/i.test(b.textContent)); }, null, { timeout: 60000 }).catch(() => {});
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
