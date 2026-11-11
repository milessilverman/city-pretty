const { chromium } = require('playwright');
(async () => { const [url, want] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
  await p.goto(url); await p.waitForFunction(w => typeof selected !== 'undefined' && selected === w, want, { timeout: 90000 }).catch(() => {});
  const r = await p.evaluate(() => ({ selected, fips: D_OC && D_OC.meta && D_OC.meta.fips, ac: activeCounty, eb: document.querySelector('.eyebrow').textContent, title: document.querySelector('#panel h2, #panel .bg-name, #panel h1') ? document.querySelector('#panel h2, #panel .bg-name, #panel h1').textContent : '' }));
  console.log(JSON.stringify(r), 'errors', errs.length); await b.close(); })();
