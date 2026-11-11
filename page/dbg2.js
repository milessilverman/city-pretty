const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + file); await p.waitForFunction(() => window.D && D.details && document.querySelector('#panel').textContent.length > 200, null, { timeout: 180000 });
  const r = await p.evaluate(async () => {
    const f = byId.get(selected); const c = L.geoJSON(f).getBounds().getCenter(); const d = 0.0002, ring = [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]];
    window.fetchParcel = async () => ({ attributes: { AIN: "5555012345", SitusFullAddress: "123 TEST ST", SitusHouseNo: "123", SitusStreet: "TEST ST", UseCode: "0100", UseDescription: "Single Family Residence", UseType: "Residential", YearBuilt1: 1955, EffectiveYear1: 1960, Bedrooms1: 3, Bathrooms1: 1, SQFTmain1: 1400, Units1: 1, DesignType1: "0101", Roll_LandValue: 400000, Roll_ImpValue: 150000 }, geometry: { rings: [ring] } });
    await houseAt(c); for (let i = 0; i < 60; i++) { const h = document.querySelector('#house'); if (h && !h.querySelector('.house-loading') && h.textContent.length > 400) break; await new Promise(r => setTimeout(r, 500)); }
    const rows = [...document.querySelectorAll('#house table tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 90));
    const ups = houseUpgrades({ beds: 3, baths: 1, res: true, sf: true, bldg: 1400, yard: 900, foot: 1400, stories: 1, yb: 1955 }, D.details[selected].m, null).map(u => [u.n, u.c, u.v]);
    return { ups, applies: (D.upgrades||[]).filter(u=>/bath/i.test(u.name)) };
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
