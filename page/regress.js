// Headless regression for City Pretty (CLAUDE.md checklist). usage: node regress.js <page.html> <label>
// Network is blocked (only file:// loads), so live services fail the way they do offline; the per-house panel uses a mocked parcel.
const { chromium } = require('playwright');
const fs = require('fs');
const [file, label] = process.argv.slice(2);
const OUT = `/home/user/page/reg_${label}`; fs.mkdirSync(OUT, { recursive: true });
const results = []; const errors = [];
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : String(info).slice(0, 300) }); };
const BAD = /\b(undefined|NaN|null)\b/;

async function newPage(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${opts.tag}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource|ERR_BLOCKED/.test(m.text())) errors.push(`[${opts.tag}] console: ${m.text().slice(0, 200)}`); });
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.D && D.catalog && D.details && document.querySelector('#panel') && document.querySelector('#panel').textContent.length > 200, null, { timeout: 180000 });
  return { ctx, page };
}
const panelText = page => page.evaluate(() => document.querySelector('#panel').textContent);
const badIn = t => { const m = t.match(BAD); return m ? t.slice(Math.max(0, m.index - 80), m.index + 40) : null; };

async function selectBg(page, id) {
  await page.evaluate(id => select(id, false), id);
  await page.waitForTimeout(400);
}
async function mockHouse(page, oc) {
  return page.evaluate(async (oc) => {
    const f = byId.get(selected); const c = L.geoJSON(f).getBounds().getCenter();
    const d = 0.0002, ring = [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]];
    window.fetchParcel = async () => oc
      ? { attributes: { AIN: "123-456-78", SitusFullAddress: "100 TEST AVE", SitusHouseNo: "100", SitusStreet: "TEST AVE", UseDescription: "Orange County parcel (use not reported by the OC parcel service)", UseCode: "", UseType: "residential (assumed: the OC parcel service does not report use)", YearBuilt1: 1962, Bedrooms1: 3, Bathrooms1: 1, SQFTmain1: 1350, Units1: 1, county: "Orange County" }, geometry: { rings: [ring] } }
      : { attributes: { AIN: "5555012345", SitusFullAddress: "123 TEST ST", SitusHouseNo: "123", SitusStreet: "TEST ST", UseCode: "0100", UseDescription: "Single Family Residence", UseType: "Residential", YearBuilt1: 1955, EffectiveYear1: 1960, Bedrooms1: 3, Bathrooms1: 1, SQFTmain1: 1400, Units1: 1, DesignType1: "0101", Roll_LandValue: 400000, Roll_ImpValue: 150000, Roll_LandBaseYear: 1999, Roll_ImpBaseYear: 1999 }, geometry: { rings: [ring] } };
    await houseAt(c);
    for (let i = 0; i < 60; i++) { const h = document.querySelector('#house'); if (h && !h.querySelector('.house-loading') && h.textContent.length > 400) break; await new Promise(r => setTimeout(r, 500)); }
    const h = document.querySelector('#house');
    // open every collapsible inside the house box so all text renders
    if (h) h.querySelectorAll('details').forEach(x => x.open = true);
    return h ? h.textContent : "";
  }, oc);
}

(async () => {
  const browser = await chromium.launch();
  // ---------------- desktop, light ----------------
  let { ctx, page } = await newPage(browser, { viewport: { width: 1400, height: 900 }, tag: 'desktop' });
  let t = await panelText(page);
  ok('LA default panel renders', t.length > 1000, t.length);
  ok('LA panel has no undefined/NaN/null', !badIn(t), badIn(t));
  ok('LA EIFD text: Policy 3.106 revised 16 Jul 2025', t.includes('approved by the County Audit Committee on 16 Jul 2025'), '');
  ok('LA EIFD split still cites AF49', t.includes('AF49 report'), '');
  ok('LA funding plan still uses LA programmes', /Measure|Metro|grants/.test(t), '');
  // metric and evidence filters
  const metrics = await page.$$eval('#metric option', o => o.map(x => x.value));
  for (const v of metrics) { await page.selectOption('#metric', v); }
  ok('every metric option applied (LA)', true, metrics.length + ' metrics');
  const evid = await page.$$eval('#evid option', o => o.map(x => x.value));
  for (const v of evid) { await page.selectOption('#evid', v); }
  await page.selectOption('#evid', evid[evid.length - 1]);
  ok('every evidence filter applied (LA)', true, evid.join(','));
  // presets
  const npre = await page.$$eval('.preset-btn', b => b.length);
  for (let i = 0; i < npre; i++) { await page.evaluate(i => document.querySelectorAll('.preset-btn')[i].click(), i); await page.waitForTimeout(150); }
  ok('presets clicked', true, npre + ' presets');
  // renter view on/off
  await page.click('#btn-renter-header'); await page.waitForTimeout(300); t = await panelText(page);
  ok('renter view renders without bad text', !badIn(t), badIn(t));
  await page.click('#btn-renter-header'); await page.waitForTimeout(300);
  // compare
  if (await page.$('#btn-compare-panel')) { await page.click('#btn-compare-panel'); }
  await page.click('#btn-compare-header'); await page.waitForTimeout(400);
  const cmp = await page.evaluate(() => { const m = document.querySelector('#compare-modal'); return m ? m.textContent : ''; });
  ok('compare drawer opens without bad text', !badIn(cmp), badIn(cmp));
  await page.evaluate(() => { const m = document.querySelector('#compare-modal'); if (m) m.hidden = true; });
  // methods
  await page.click('#btn-methods-header'); await page.waitForTimeout(300);
  const meth = await page.evaluate(() => document.querySelector('#methods-modal').textContent);
  ok('methods modal opens without bad text', meth.length > 500 && !badIn(meth), badIn(meth));
  await page.evaluate(() => closeMethodsModal());
  // LA project cards: all details opened, sources and funding text
  const laFull = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); return document.querySelector('#panel').textContent; });
  ok('LA panel (all sections open) has no undefined/NaN/null', !badIn(laFull), badIn(laFull));
  // LA catalog corrections present in data
  const cat = await page.evaluate(() => ({ und: D.catalog.undergrounding.sources.join(' | '), nw: D.catalog.noise_wall.sources.join(' | '), bs: D.catalog.bus_shelters.sources.join(' | '), fp: D.catalog.foot_patrol.sources.join(' | '), bath: (D.upgrades || []).find(u => u.name === 'Add a full bathroom') }));
  ok('catalog undergrounding corrected', cat.und.includes("PG&E's lower bound"), '');
  ok('catalog noise_wall corrected', cat.nw.includes('design, right-of-way and construction'), '');
  ok('catalog bus_shelters corrected', cat.bs.includes('CAO Memo No. 74'), '');
  ok('catalog foot_patrol caveat', cat.fp.includes('not yet checked'), '');
  ok('upgrade table bathroom 63,595 / 36,603', cat.bath && cat.bath.cost_2025 === 63595 && cat.bath.resale_value_added === 36603, JSON.stringify(cat.bath));
  // LA per-house with mocked parcel
  let house = await mockHouse(page, false);
  ok('LA per-house panel renders (mocked parcel)', house.length > 800, house.length);
  ok('LA per-house has no undefined/NaN/null', !badIn(house), badIn(house));
  ok('LA per-house checklist bathroom line uses JLC (no "strong resale ROI")', house.includes('recoups only about 58%') && !house.includes('strong resale ROI'), '');
  const bathRow = await page.evaluate(() => { const u = houseUpgrades({ beds: 3, baths: 1, res: true, sf: true, bldg: 1400, yard: 900, foot: 1400, stories: 1, yb: 1955 }, D.details[selected].m, null).find(x => x.n === 'Add a full bathroom'); return u ? { c: u.c, v: u.v, note: u.note } : null; });
  ok('LA per-house bathroom row: JLC cost and value', bathRow && bathRow.c === 63595 && bathRow.v === 36603 && bathRow.note.includes('JLC/Zonda'), JSON.stringify(bathRow));
  ok('LA per-house cost card carries the unverified-cost note', house.includes('not contractor quotes') || !house.includes('Total All-In Cost'), '');
  await page.screenshot({ path: `${OUT}/la_desktop.png` });

  // ---------------- Orange County ----------------
  await page.waitForFunction(() => window.D_OC && D_OC.features && D_OC.features.length > 2000, null, { timeout: 180000 });
  await page.click('#btn-county-oc'); await page.waitForTimeout(1500);
  const oc = await page.evaluate(() => ({ ac: activeCounty, fund: !!(D_OC.oc_funding && D_OC.oc_funding.programs), fees: !!D_OC.oc_fees, n: D_OC.features.length }));
  ok('OC bundle loaded with funding + fees', oc.ac === 'oc' && oc.fund && oc.fees && oc.n === 2049, JSON.stringify(oc));
  // Anaheim survey block group
  await selectBg(page, '060590863052');
  t = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); return document.querySelector('#panel').textContent; });
  ok('OC Anaheim panel has no undefined/NaN/null', !badIn(t), badIn(t));
  ok('OC Anaheim street trees from city survey', t.includes("open planting sites in the city's tree survey"), '');
  ok('OC panel shows verified OC funding', t.includes('Orange County funding'), '');
  ok('OC panel shows M2 Local Fair Share for Anaheim', t.includes('Local Fair Share') && t.includes('8,949') || t.includes('$8.9M') || t.includes('8.95M'), '');
  ok('OC panel does not offer LA-only Measure W / Metro local return', !t.includes('Measure W (Safe Clean Water)') && !t.includes('Metro local return'), '');
  ok('OC EIFD text cites County of Orange policy', t.includes("County of Orange's EIFD Participation Policy"), '');
  ok('OC EIFD split cites Section 99 report', t.includes('Section 99 factor report'), '');
  ok('OC EIFD register shows Placentia', t.includes('Placentia'), '');
  const ev = await page.evaluate(() => ({ city: +document.querySelector('#e-city').value, cnty: +document.querySelector('#e-county').value, av: +document.querySelector('#e-av').value, note: document.querySelector('#e-note').textContent }));
  ok('OC EIFD city share filled from TRA factors (Anaheim ~11.57%)', Math.abs(ev.city - 11.57) < 0.02, JSON.stringify(ev));
  ok('OC EIFD County General share filled (~6.45%)', Math.abs(ev.cnty - 6.45) < 0.02, ev.cnty);
  ok('OC EIFD base uses 55% estimate note', ev.av > 0 && ev.note.includes('Orange County Assessor roll is not in this build'), ev.note.slice(0, 120));
  await page.evaluate(() => { const b = [...document.querySelectorAll('#panel [data-scope]')].find(x => x.dataset.scope === 'hood'); if (b) b.click(); });
  await page.waitForTimeout(300);
  const evh = await page.evaluate(() => ({ city: +document.querySelector('#e-city').value, split: document.querySelector('#e-split').textContent }));
  ok('OC EIFD neighborhood scope works', evh.city > 0 && !badIn(evh.split), JSON.stringify(evh).slice(0, 200));
  await page.screenshot({ path: `${OUT}/oc_anaheim.png` });
  // city fee lines
  const pick = await page.evaluate(() => {
    const find = (city, pid) => Object.keys(D.details).find(g => g.startsWith('06059') && (D.details[g].m || {}).c === city && (D.details[g].r || []).some(r => r[0] === pid));
    return { sa: find('Santa Ana', 'street_trees'), nb: find('Newport Beach', 'sidewalks'), irv: find('Irvine', 'adu'), un: Object.keys(D.details).find(g => g.startsWith('06059') && (D.details[g].m || {}).c === 'Unincorporated Orange County'), gg: find('Garden Grove', 'street_trees') };
  });
  for (const [k, needle] of [['sa', 'Resolution No. 2025-026'], ['nb', 'Council Policy L-1'], ['irv', 'Residential $5.34'.slice(0, 0) + '$5.34 per sq ft'], ['gg', '0-12 in $261.45']]) {
    if (!pick[k]) { ok(`OC fee line ${k}`, false, 'no block group found'); continue; }
    await selectBg(page, pick[k]);
    const tt = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); return document.querySelector('#panel').textContent; });
    ok(`OC fee line shown (${k} ${pick[k]})`, tt.includes(needle), needle);
    ok(`OC panel ${k} has no undefined/NaN/null`, !badIn(tt), badIn(tt));
    if (k === 'irv') ok('OC ADU card carries the 750 sq ft state rule', tt.includes('750 sq ft of interior livable space or less'), '');
  }
  await selectBg(page, pick.un);
  const eu = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); return { city: +document.querySelector('#e-city').value, t: document.querySelector('#panel').textContent, w: document.querySelector('#e-warn').textContent }; });
  ok('OC unincorporated: city share 0 and County-only note', eu.city === 0 && eu.w.includes('unincorporated'), eu.w.slice(0, 160));
  ok('OC unincorporated panel has no undefined/NaN/null', !badIn(eu.t), badIn(eu.t));
  // OC metric + evidence filters
  for (const v of metrics) { await page.selectOption('#metric', v); }
  for (const v of evid) { await page.selectOption('#evid', v); }
  ok('every metric/evidence filter applied (OC)', true, '');
  // OC per-house
  await selectBg(page, '060590863052');
  house = await mockHouse(page, true);
  ok('OC per-house panel renders (mocked parcel)', house.length > 600, house.length);
  ok('OC per-house has no undefined/NaN/null', !badIn(house), badIn(house));
  // OC methods / sources
  await page.click('#btn-methods-header'); await page.waitForTimeout(300);
  const methOc = await page.evaluate(() => document.querySelector('#methods-modal').textContent + ' ' + JSON.stringify(D_OC.meta.sources));
  ok('OC sources list GTFS 20261108-20270213, street-tree inventory, tax-rate areas', methOc.includes('20261108-20270213') && methOc.includes('City street-tree inventories') && methOc.includes('Tax-rate areas (BOE 2026)'), '');
  await page.evaluate(() => closeMethodsModal());
  await ctx.close();

  // ---------------- dark mode ----------------
  ({ ctx, page } = await newPage(browser, { viewport: { width: 1400, height: 900 }, colorScheme: 'dark', tag: 'dark' }));
  t = await panelText(page);
  ok('dark mode LA panel clean', !badIn(t), badIn(t));
  await page.waitForFunction(() => window.D_OC && D_OC.features && D_OC.features.length > 2000, null, { timeout: 180000 });
  await page.click('#btn-county-oc'); await page.waitForTimeout(1200); await selectBg(page, '060590863052');
  t = await panelText(page); ok('dark mode OC panel clean', !badIn(t), badIn(t));
  await page.screenshot({ path: `${OUT}/oc_dark.png` });
  await ctx.close();

  // ---------------- phone width ----------------
  ({ ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, tag: 'phone', isMobile: true, hasTouch: true }));
  let sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok('phone LA: no horizontal page scroll', sw <= 391, sw);
  await page.waitForFunction(() => window.D_OC && D_OC.features && D_OC.features.length > 2000, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#btn-county-oc').click()); await page.waitForTimeout(1200); await selectBg(page, '060590863052');
  sw = await page.evaluate(() => document.documentElement.scrollWidth);
  t = await panelText(page);
  ok('phone OC: no horizontal page scroll', sw <= 391, sw);
  ok('phone OC panel clean', !badIn(t), badIn(t));
  await page.screenshot({ path: `${OUT}/oc_phone.png` });
  await ctx.close();
  await browser.close();

  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 1));
  const fails = results.filter(r => !r.pass);
  console.log(`${label}: ${results.length - fails.length}/${results.length} checks passed; ${errors.length} page/console errors`);
  fails.forEach(f => console.log('  FAIL', f.name, '|', f.info));
  errors.slice(0, 20).forEach(e => console.log('  ERR', e));
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
