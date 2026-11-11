const { chromium } = require('playwright');
const URL = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message.slice(0, 200)));
  await p.goto(URL, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => typeof map !== 'undefined' && map && map._loaded && typeof byId !== 'undefined' && byId.size > 1000, null, { timeout: 300000 });
  const state = () => p.evaluate(() => ({ selected: typeof selected !== 'undefined' ? selected : null, fips: activeFips(), toast: ((document.getElementById('toast') || {}).textContent || '').slice(0, 160), pin: typeof addrPin !== 'undefined' && !!addrPin, zoom: map.getZoom() }));
  async function search(text, waitFor, ms) {
    await p.fill('#q', text); await p.dispatchEvent('#q', 'change');
    if (waitFor) await p.waitForFunction(id => typeof selected !== 'undefined' && selected === id, waitFor, { timeout: ms || 90000 }).catch(() => {});
    else await p.waitForTimeout(ms || 20000);
    return state();
  }
  console.log('start', JSON.stringify(await state()));
  console.log('T1 Wake address with LA open', JSON.stringify(await search('222 W Hargett St, Raleigh, NC 27601', '371830501003')));
  console.log('T2 LA address with Wake open', JSON.stringify(await search('200 N Spring St, Los Angeles, CA 90012', null, 25000)));
  console.log('T3 address in a county not on the page', JSON.stringify(await search('1600 Pennsylvania Ave NW, Washington, DC 20500', null, 25000)));
  console.log('T4 nonsense', JSON.stringify(await search('99999 Nowhere Imaginary Rd, Zzyzx, ZZ', null, 30000)));
  console.log('console:', JSON.stringify(logs.slice(0, 12)));
  await b.close();
})().catch(e => { console.error('TEST ERROR', e.message); process.exit(1); });
