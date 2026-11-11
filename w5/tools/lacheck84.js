const { chromium } = require('playwright');
const file = process.argv[2];
const cases = [
  ['060375550021', ['Norwalk, 5.6 mi'], ['Calico']],
  ['060372653061', ['Expo/Sepulveda, 2.3 mi', 'nearest rail 2.3 mi'], ['Upper Tram', 'nearest rail 1.7 mi']],
  ["060372622003", ["rail 3.9 mi"], ["Tram Station", "rail 0.4 mi", "single-family lots near rail", "within ½ mile of rail"]],
  ['060372623021', ['rail 3.3 mi'], ['Tram Station', 'single-family lots near rail']],
];
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  let pass = 0, total = 0;
  for (const [id, want, notWant] of cases) {
    await page.goto('file://' + file + '#bg=' + id, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(i => { const p = document.querySelector('#panel'); return p && p.innerText.includes(i); }, id, { timeout: 120000 });
    await page.evaluate(() => document.querySelectorAll('#panel details').forEach(d => d.open = true));
    const t = await page.evaluate(() => document.querySelector('#panel').innerText);
    for (const w of want) { total++; const ok = t.includes(w); pass += ok; console.log((ok ? 'ok  ' : 'FAIL') + ' ' + id + ' shows "' + w + '"'); }
    for (const w of notWant) { total++; const ok = !t.includes(w); pass += ok; console.log((ok ? 'ok  ' : 'FAIL') + ' ' + id + ' does not show "' + w + '"'); }
  }
  const n = await page.evaluate(() => (D.layers.stations.features || []).filter(f => /Tram Station|Calico|Camp Snoopy|Fantasyland|Tomorrowland/.test(f.properties.n || '')).length);
  total++; pass += n === 0; console.log((n === 0 ? 'ok  ' : 'FAIL') + ' LA stations layer has no park / tram stations (' + n + ')');
  console.log(`${pass}/${total} checks passed; ${errors.length} page errors`); await browser.close();
})();
