// usage: node bus_tile_check.js <page.html> <fips> <bg id> [<bg id> ...]: opens the county and each block group, prints the Bus service tile
const { chromium } = require('playwright');
const [file, FIPS, ...ids] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.D && D.catalog && D.details && document.querySelector('#panel'), null, { timeout: 180000 });
  await page.selectOption('#county-more', FIPS);
  await page.waitForFunction(f => activeCounty === 'oc' && D_OC && D_OC.meta && D_OC.meta.fips === f, FIPS, { timeout: 120000 });
  await page.waitForTimeout(1500);
  for (const id of ids) {
    await page.evaluate(id => select(id, false), id); await page.waitForTimeout(800);
    const t = await page.evaluate(() => { const el = [...document.querySelectorAll('#panel *')].find(e => e.children.length === 0 && /^Bus service$/.test(e.textContent.trim()));
      return el ? el.parentElement.textContent.replace(/\s+/g, ' ').trim() : '(no Bus service tile)'; });
    console.log(id, '->', t.slice(0, 120));
  }
  console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
})();
