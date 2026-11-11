const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/user/page/new.html'); await p.waitForFunction(() => window.D_OC && D_OC.features && D_OC.features.length > 2000, null, { timeout: 180000 });
  await p.click('#btn-county-oc'); await p.waitForTimeout(1200);
  await p.evaluate(() => select('060590863052', false)); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll('#panel details').forEach(d => d.open = true)); await p.waitForTimeout(300);
  const fund = p.locator('#panel .fund').filter({ visible: true }).first();
  await fund.scrollIntoViewIfNeeded(); await fund.screenshot({ path: 'reg_new/oc_fund.png' });
  console.log('FUND:', (await fund.textContent()).replace(/\s+/g, ' '));
  const oc = p.locator('#panel p.small', { hasText: 'Orange County funding' }).filter({ visible: true }).first();
  console.log('OCFUND:', (await oc.textContent()).replace(/\s+/g, ' '));
  const sec = p.locator('#panel .section', { has: p.locator('#e-out') });
  await sec.scrollIntoViewIfNeeded(); await sec.screenshot({ path: 'reg_new/oc_eifd.png' });
  console.log('EIFD:', (await sec.textContent()).replace(/\s+/g, ' ').slice(0, 2200));
  await b.close();
})();
