// Any embedded county through the multi-county loader, then back to Orange County and LA (state swaps cleanly).
// usage: node countytest.js <page.html> <label> <fips> "<County Name>" <block groups>
const { chromium } = require('playwright'); const fs = require('fs');
const [file, label, FIPS, CNAME, NBG] = process.argv.slice(2); const SHORTN = CNAME.replace(/ County$/, ''); const CA = FIPS.startsWith('06'); const HASCR = CA || FIPS === '08031' || ['17', '51', '49', '42', '47', '23'].some(s => FIPS.startsWith(s));   // injury-crash sources: CCRS (CA), Denver police, IDOT (IL), VDOT (VA), UDOT (UT), PennDOT (PA), TITAN (TN), MaineDOT (ME)
const OUT = `/home/user/w5/reg_${label}`; fs.mkdirSync(OUT, { recursive: true });
const results = [], errors = [];
const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info == null ? '' : String(info).slice(0, 300) }); };
const BAD = /\b(undefined|NaN|null)\b/;
const badIn = t => { const m = t.match(BAD); return m ? t.slice(Math.max(0, m.index - 80), m.index + 40) : null; };
// claims that belong to other counties and must not appear in a San Diego panel
const FOREIGN0 = FIPS !== '06059' && /^Orange County$/.test(CNAME)   // Orange County, FL: its own name is not another county's claim
  ? /(OCTA|Measure M2|Anaheim Public Utilities|Placentia|Section 99|OCGIS|OC Flood|LA Metro|Metro (?:Board|Bike Share|Micro|Rail)\b|Measure [A-Z]{1,2}\b(?! )|LA County Public Works|Los Angeles County Assessor|AF49|Policy 3\.106)/
  : /(Orange County|OCTA|Measure M2|Anaheim Public Utilities|Placentia|County of Orange|Section 99|OCGIS|OC Flood|LA Metro|Metro (?:Board|Bike Share|Micro|Rail)\b|Measure [A-Z]{1,2}\b(?! )|LA County Public Works|Los Angeles County Assessor|AF49|Policy 3\.106)/;
const stripEx = t => t.replace(/weekday 7-9 am bus departures per stop on one weekday per feed:.{0,3000}?Loaded \(/gs, '').replace(/LADWP overhead\/underground line maps \(NavigateLA\); CAL FIRE hazard zones/g, '').replace(/Real example \(LA County\):.{0,400}?%\)\./gs, '');
const FOREIGN = CA ? FOREIGN0 : new RegExp(FOREIGN0.source.slice(0, -1) + '|CEQA|Caltrans|CAL FIRE|Prop 13|CalHFA|SGIP|EIFD Tax-Increment|CHP crash)');
const foreignIn = t0 => { const t = stripEx(t0).replace(/LA County Measure A: [^$]{0,120}\$[\d,]+/g, '').replace(/OC Loop Segment A rail-to-trail[^)]*\(~\$14\.8M\/mi, OCTA 2024 RTIP\)/g, '').replace(/bus departures per stop on one weekday per feed[\s\S]{0,6000}?Loaded \(/g, ''); /* labelled cost examples from the catalog; the sources table's list of transit feeds names neighbouring operators (OCTA's buses reach San Diego's box) */ const m = t.match(FOREIGN); return m ? t.slice(Math.max(0, m.index - 100), m.index + 60) : null; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());   // hosted-mode tests fetch county files from a local server
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource|ERR_BLOCKED/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
  await page.goto(/^https?:/.test(file) ? file : 'file://' + file, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.D && D.catalog && D.details && document.querySelector('#panel') && document.querySelector('#panel').textContent.length > 200, null, { timeout: 180000 });
  const opts = await page.evaluate(() => [...document.querySelectorAll('#county-more option')].map(o => o.value + ':' + o.textContent));
  ok(`county picker lists ${CNAME}`, opts.some(o => o === FIPS + ':' + SHORTN || o.startsWith(FIPS + ':' + SHORTN + ', ')), JSON.stringify(opts));   // outside California the picker adds ", ST"
  // open San Diego from the picker
  await page.selectOption('#county-more', FIPS);
  await page.waitForFunction(f => activeCounty === 'oc' && D_OC && D_OC.meta && D_OC.meta.fips === f, FIPS, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ eb: (document.querySelector('.eyebrow') || {}).textContent || '', n: D_OC.features.length, ocBtn: document.querySelector('#btn-county-oc').classList.contains('active'), sel: selected }));
  ok(`${CNAME} bundle active (${NBG} block groups)`, st.n === +NBG, JSON.stringify(st));
  ok(`eyebrow names ${CNAME}`, st.eb.includes(CNAME.toUpperCase()), st.eb);
  ok('Orange County button not lit', !st.ocBtn, '');
  await page.screenshot({ path: `${OUT}/sd_overview.png` });
  // round 8.6: a block group whose bus frequency is unknown says "unknown" on its Bus service tile (busUnknown matched only the sources
  // row's round-8.5 wording, so the round-8.6 re-runs showed a bare dash); counties with no unknown block group skip the check
  const unk = await page.evaluate(() => { const d = (D_OC && D_OC.details) || D.details || {};
    const ids = D_OC.features.map(f => f.properties.id); return ids.find(id => { const r = d[id] || D.details[id]; return r && r.m && r.m.bt == null; }) || null; });
  if (unk) {
    await page.evaluate(id => select(id, false), unk); await page.waitForTimeout(800);
    const tile = await page.evaluate(() => { const el = [...document.querySelectorAll('#panel *')].find(e => e.children.length === 0 && /^Bus service$/.test(e.textContent.trim()));
      return el ? el.parentElement.textContent.replace(/\s+/g, ' ').trim() : '(no tile)'; });
    ok('unknown bus frequency is shown as "unknown"', /^Bus service ?unknown/.test(tile), `${unk}: ${tile.slice(0, 80)}`);
  }
  // sample block groups: San Diego city, Chula Vista, unincorporated, Escondido, and ones with each site type
  const picks = await page.evaluate(() => {
    const F = D_OC.features.map(f => f.properties), by = c => (F.find(p => p.c === c) || {}).id;
    const cnt = {}; F.forEach(p => cnt[p.c] = (cnt[p.c] || 0) + 1); const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const nodata = (D_OC.features.find(f => { const m = (D_OC.details[f.properties.id] || {}).m || {}; return m.pop == null && !m.homes; }) || {}).properties;
    const out = { city1: by(top[0]), city2: by(top[1]), city3: by(top[2]), uninc: (F.find(p => /^Unincorporated/.test(p.c)) || {}).id, cdp: (F.find(p => /\(unincorporated\)/.test(p.c)) || {}).id, nodata: nodata && nodata.id };   // nodata: a block group without ACS data (e.g. 39 in Suffolk County)
    return out;
  });
  await page.evaluate(() => loadSites());
  const sitePicks = await page.evaluate((FIPS) => { const out = {}; for (const [g, L] of Object.entries(SITES.sites)) if (g.startsWith(FIPS)) for (const s of L) if (!out['sd_' + s.t]) out['sd_' + s.t] = g; return out; }, FIPS);
  ok(`${CNAME} sites: expected types present`, (+NBG >= 300 ? (HASCR ? ['sd_xing', 'sd_calm', 'sd_ev'] : ['sd_ev']) : [])   /* creeks optional (San Francisco has none); small rural counties need not have crossings or chargers to suggest */.every(k => sitePicks[k]) && Object.keys(sitePicks).length > 0 && (HASCR || (!sitePicks.sd_calm && !sitePicks.sd_xing)), JSON.stringify(sitePicks));
  const all = { ...picks, ...sitePicks };
  for (const [k, g] of Object.entries(all)) {
    if (!g) { if (k === 'city1' || k.startsWith('sd_') && CA) ok(`sample ${k} exists`, false, ''); continue; }   // consolidated city-counties have no 2nd city / unincorporated area
    await page.evaluate(id => select(id, false), g); await page.waitForTimeout(900);
    if (k.startsWith('sd_')) await page.waitForFunction(g => selected === g && document.querySelector('#sites-sec') && !document.querySelector('#sites-sec').textContent.includes('Loading'), g, { timeout: 60000 });
    const t = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); const c = document.querySelector('#panel').cloneNode(true); c.querySelectorAll('.src').forEach(e => e.remove()); return c.textContent; });   // labelled LA evidence lists (.src) excluded
    ok(`SD panel clean (${k} ${g})`, !badIn(t), badIn(t));
    ok(`SD panel has no other county's claims (${k})`, !foreignIn(t), foreignIn(t));
    if (k === 'city1') {
      ok(`panel names ${CNAME}`, t.includes(CNAME), '');
      ok('SD funding: honest unverified note, no LA programmes', t.includes('have not been verified yet') && !/Measure W|Measure A\b|Metro Active Transport/.test(stripEx(t).replace(/LA County Measure A: [^$]{0,120}\$[\d,]+/g, '')), JSON.stringify({ note: t.includes('have not been verified yet'), la: (stripEx(t).replace(/LA County Measure A: [^$]{0,120}\$[\d,]+/g, '').match(/Measure W|Measure A\b|Metro Active Transport/) || [''])[0] }));
      await page.screenshot({ path: `${OUT}/sd_panel.png` });
    }
    if (k.startsWith('sd_')) {
      const r = await page.evaluate(() => ({ cards: document.querySelectorAll('#sites-sec [data-sx]').length, layer: !!(_sitesLayer && map.hasLayer(_sitesLayer)), txt: document.querySelector('#sites-sec').textContent }));
      ok(`SD specific places render (${k})`, r.cards > 0 && r.layer, JSON.stringify({ cards: r.cards, layer: r.layer }));
      if (k === 'sd_calm') ok('calming card: LADOT shown for reference only', /Local rules in .* differ|City of LA, used here for reference/.test(r.txt), r.txt.slice(0, 300));
      if (!CA && !HASCR) ok('no-crash note shown outside California', /not screened in/.test(r.txt), r.txt.slice(0, 200));
      if (k === 'sd_creek') { await page.evaluate(() => { const b = document.querySelector('#sites-sec'); b.closest('details').open = true; b.scrollIntoView(); }); await page.waitForTimeout(400); const el = await page.$('#sites-sec'); await el.screenshot({ path: `${OUT}/sd_sites.png` }); }
    }
  }
  // EIFD panel for San Diego: no Orange/LA policy claims
  const eifd = await page.evaluate(() => { const b = [...document.querySelectorAll('#panel *')].find(e => /Infrastructure financing district|EIFD/.test(e.textContent || '') && e.tagName === 'DETAILS'); return b ? b.textContent : document.querySelector('#panel').textContent; });
  ok('SD EIFD text: no County of Orange policy', !/County of Orange's EIFD Participation Policy/.test(eifd), '');
  // per-house: parcel lookup gives a clear not-connected message
  const ph = await page.evaluate(async () => { try { const f = byId.get(selected); const c = L.geoJSON(f).getBounds().getCenter(); await fetchParcel(c); return 'no error'; } catch (e) { return e.message; } });
  ok('per-house: parcel lookup not connected message', ph.includes('not connected for ' + CNAME), ph);
  // search finds a San Diego neighborhood
  const srch = await page.evaluate(() => Object.keys((D_OC.search || {})).length);
  const nNames = await page.evaluate(() => new Set((D_OC.features || []).map(f => (f.properties.n || '') + '|' + (f.properties.c || ''))).size);
  ok('search index has this county', srch >= Math.min(10, nNames), `${srch} names indexed; the county has ${nNames}`);   // at least 10 names, or all of them
  // (round 8.4: was "one per 20 block groups", which a county without OpenStreetMap neighborhood labels cannot meet: Hinds, MS has 5 names)
  // back to Orange County: its bundle and OC-only features return
  await page.click('#btn-county-oc'); await page.waitForTimeout(4000);
  const oc = await page.evaluate(() => ({ fips: D_OC.meta.fips, n: D_OC.features.length, lit: document.querySelector('#btn-county-oc').classList.contains('active'), eb: (document.querySelector('.eyebrow') || {}).textContent }));
  ok('switch back to Orange County', oc.fips === '06059' && oc.n === 2049 && oc.lit && /ORANGE COUNTY/.test(oc.eb), JSON.stringify(oc));
  const ocId = await page.evaluate(() => D_OC.features.find(f => f.properties.c === 'Anaheim').properties.id);
  await page.evaluate(id => select(id, false), ocId); await page.waitForTimeout(900);
  const tOC = await page.evaluate(() => { document.querySelectorAll('#panel details').forEach(x => x.open = true); return document.querySelector('#panel').textContent; });
  ok(`Orange County keeps OC funding and EIFD policy after a ${CNAME} visit`, tOC.includes('Orange County funding') && tOC.includes("County of Orange's EIFD Participation Policy"), '');
  // and LA
  await page.click('#btn-county-la'); await page.waitForTimeout(2500);
  const la = await page.evaluate(() => ({ ac: activeCounty, eb: (document.querySelector('.eyebrow') || {}).textContent }));
  ok('switch back to LA County', la.ac === 'la' && /LOS ANGELES/.test(la.eb), JSON.stringify(la));
  // SD again from the picker (second visit uses the cached bundle)
  await page.selectOption('#county-more', FIPS); await page.waitForTimeout(3000);
  const sd2 = await page.evaluate(() => ({ fips: D_OC.meta.fips, ac: activeCounty }));
  ok(`${CNAME} reopens from the picker`, sd2.fips === FIPS && sd2.ac === 'oc', JSON.stringify(sd2));
  // a shared link into this county opens it directly (fresh page)
  { const id = await page.evaluate(() => selected); const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx2.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort()); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push(`[link] pageerror: ${e.message}`));
    await p2.goto((/^https?:/.test(file) ? file : 'file://' + file) + '#bg=' + id, { waitUntil: 'load', timeout: 180000 });
    await p2.waitForFunction(w => typeof selected !== 'undefined' && selected === w, id, { timeout: 120000 }).catch(() => {});
    const r2 = await p2.evaluate(() => ({ selected, fips: D_OC && D_OC.meta && D_OC.meta.fips }));
    ok('shared #bg= link opens this county and block group', r2.selected === id && r2.fips === FIPS, JSON.stringify(r2)); await ctx2.close(); }
  // phone layout in San Diego
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(`phone: no horizontal overflow in ${CNAME}`, ov <= 1, ov);
  await page.screenshot({ path: `${OUT}/sd_phone.png` });
  await browser.close();
  const passed = results.filter(r => r.pass).length;
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 1));
  console.log(`${label}: ${passed}/${results.length} checks passed; ${errors.length} page/console errors`);
  results.filter(r => !r.pass).forEach(r => console.log('  FAIL', r.name, '|', r.info));
  errors.slice(0, 10).forEach(e => console.log('  ERR', e));
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
