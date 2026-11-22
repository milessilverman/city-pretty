// Live check of the script-first advisor (app/advisor-scripts.js) on the real page: real county files, real parcel and
// FEMA services; the Worker is stubbed, so any model request is counted and never sent. Two counties: Los Angeles with
// a lot opened through the page's click path (houseAt), and Travis County, TX without one. Checks the HUD rent, the
// Travis rent, the lot's zoning (against the house panel's Zoning row) and flood zone, that answered questions sent
// nothing, and that a "why" question was sent with the page's findings.
// Usage: LIVE_PORT=<port> NODE_USE_ENV_PROXY=1 node scripts/live_check_advisor.mjs   (writes data/backtests/live_check_advisor_<date>.json)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") + "/";
const require = createRequire(W + "package.json");
const { chromium } = require("playwright");
const PORT = Number(process.env.LIVE_PORT || 9031);
const srv = spawn(process.execPath, [W + "scripts/serve.mjs", String(PORT)], { cwd: W, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const hud = JSON.parse(fs.readFileSync(W + "app/data/hud_fair_market_rents.json", "utf8")).records;
const out = { date: new Date().toISOString(), counties: {} };
const browser = await chromium.launch();
try {
  for (const [fips, withLot] of [["06037", true], ["48453", false]]) {
    const page = await browser.newPage();
    const errors = [], ai = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/app/config.js", r => r.fulfill({ contentType: "text/javascript", body: 'window.CITY_PRETTY_CONFIG = { workerUrl: "https://worker.test" };' }));
    await page.route("https://worker.test/api/health", r => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"status":"ok","ai_advisor_ready":true}' }));
    await page.route("https://worker.test/api/ai", r => { ai.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"ok":true,"text":"stub"}' }); });
    await page.addInitScript(() => { try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}/city-pretty/`);
    await page.waitForFunction(() => document.querySelector("#loading")?.hidden === true, null, { timeout: 120000 });
    if (fips !== "06037") {
      await page.evaluate(f => (0, eval)("openCounty")(f), fips);
      await page.waitForFunction(f => window.D_OC && window.D_OC.meta && window.D_OC.meta.fips === f, fips, { timeout: 180000 });
      const bg = await page.evaluate(() => window.D_OC.meta.default_bg);
      await page.evaluate(id => (0, eval)("select")(id, false), bg);
    }
    await page.waitForFunction(() => window.cpInvest.advisorInputs().then(x => !!(x && x.state === "ok")), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const rec = { questions: [], checks: {} };
    if (withLot) {
      // a lot near the selected block group's centre, opened through the page's own click path
      const ll = await page.evaluate(() => { const f = (0, eval)("byId").get((0, eval)("selected")); const b = L.geoJSON(f).getBounds().getCenter(); return { lat: b.lat, lng: b.lng }; });
      // try points around the centre until one falls inside a lot (the centre can be a street)
      for (const [dy, dx] of [[0, 0], [0.0004, 0.0004], [-0.0004, 0.0004], [0.0004, -0.0004], [-0.0004, -0.0004], [0.0008, 0], [0, 0.0008], [-0.0008, 0], [0, -0.0008]]) {
        await page.evaluate(p => (0, eval)("houseAt")(p), { lat: ll.lat + dy, lng: ll.lng + dx });
        const got = await page.waitForFunction(() => { const ah = (0, eval)("typeof activeHouse !== 'undefined' ? activeHouse : null"); const t = (document.querySelector("#house") || {}).textContent || ""; return (ah && ah.a && ah.st && ah.st.rDone) ? "lot" : /No parcel found/.test(t) ? "none" : false; }, null, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => "timeout");
        if (got === "lot") { await page.waitForTimeout(3000); break; }
      }
      rec.lot = await page.evaluate(() => { const ah = (0, eval)("activeHouse"); return ah && ah.a ? { address: ah.a.SitusFullAddress, zone: ah.a.ZoneCode, fema: ah.st && ah.st.R && ah.st.R.fema ? ah.st.R.fema.label : null, sale: ah.sale || null, bldg: ah.F && ah.F.bldg, panelZone: ((((document.querySelector("#house") || {}).textContent || "").replace(/\s+/g, " ").match(/Zoning([A-Z0-9][A-Z0-9\-\[\]().]*)/) || [])[1] || null) } : null; });
    }
    await page.click("#btn-ai-header");
    const qs = ["What is the median rent here?", "What is the 2-bedroom fair market rent?", "Where should I invest?", "What should I build here?", "What properties could be redeveloped?", "Should transit be built here?", "I have $500,000", "rent x 12", "What is the zoning of this lot?", "Is this lot in a flood zone?", "Can I add an ADU?", "Can I split this lot?", "Why is the rent so high here?"];
    for (const q of qs) {
      const before = ai.length;
      const n0 = await page.locator("#ai-chat-history > div").count();
      await page.fill("#ai-user-input", q); await page.press("#ai-user-input", "Enter");
      await page.waitForFunction(n => document.querySelectorAll("#ai-chat-history > div").length >= n + 2 && !document.getElementById("ai-typing-indicator"), n0, { timeout: 30000 }).catch(() => {});
      const last = await page.evaluate(() => { const els = document.querySelectorAll("#ai-chat-history > div"); return els[els.length - 1].innerText; });
      const r = await page.evaluate(() => window.__cpAdvisorLast);
      rec.questions.push({ q, answered: !!(r && r.answered), intent: r && r.intent, reason: r && r.reason, sent_to_worker: ai.length > before, text: last.slice(0, 1500), findings_sent: ai.length > before ? (ai[ai.length - 1].context.scripted_findings || null) : undefined });
    }
    // independent checks
    const H = hud.find(x => x.fips === fips);
    const fmrQ = rec.questions[1];
    rec.checks.fmr = { pass: fmrQ.answered && !fmrQ.sent_to_worker && fmrQ.text.includes("$" + H.two_bed_2br.toLocaleString("en-US")), expected: H.two_bed_2br };
    if (fips === "48453") {
      const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(W + "counties/bundle_48453.json.gz")));
      const m = B.details[B.meta.default_bg].m;
      rec.checks.rent = { pass: rec.questions[0].text.includes("$" + Math.round(m.rent).toLocaleString("en-US")), expected: m.rent };
    }
    if (rec.lot) {
      const zq = rec.questions[8], fq = rec.questions[9];
      rec.checks.zoning = { pass: zq.answered && (rec.lot.panelZone ? zq.text.includes(rec.lot.panelZone) : /Not on file/.test(zq.text)), house_panel_zoning_row: rec.lot.panelZone };
      rec.checks.flood = { pass: fq.answered && (rec.lot.fema ? fq.text.includes(rec.lot.fema) : /Not on file/.test(fq.text)), page_fema: rec.lot.fema };
    }
    rec.checks.why_handed_off = { pass: !rec.questions[12].answered && rec.questions[12].sent_to_worker };
    rec.checks.answered_without_request = { pass: rec.questions.filter(x => x.answered).every(x => !x.sent_to_worker), answered: rec.questions.filter(x => x.answered).length, of: rec.questions.length };
    rec.page_errors = errors;
    out.counties[fips] = rec;
    await page.close();
  }
} finally { await browser.close(); srv.kill(); }
const f = W + `data/backtests/live_check_advisor_${out.date.slice(0, 10)}.json`;
fs.writeFileSync(f, JSON.stringify(out, null, 1));
for (const [k, r] of Object.entries(out.counties)) { console.log(k, JSON.stringify(r.checks), "errors:", r.page_errors.length, "lot:", JSON.stringify(r.lot || null)); for (const q of r.questions) console.log("  ", q.answered ? "ANS " + q.intent : "HAND " + q.reason, q.sent_to_worker ? "[sent]" : "", "|", q.q); }
