// Sourced-effect overrides in app/data/intervention_verification.json (docs/audit/catalog-coverage-round3.md):
// an override may exist only with fetched evidence, and the engine must use the same number on a rebuild.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const iv = JSON.parse(fs.readFileSync(path.join(root, "app/data/intervention_verification.json"), "utf8"));
const research = JSON.parse(fs.readFileSync(path.join(root, "app/data/research.json"), "utf8"));
const engine = fs.readFileSync(path.join(root, "pipeline/engine.py"), "utf8");
const overrides = Object.entries(iv).filter(([, r]: any) => r.sourced_effect) as [string, any][];

describe("sourced-effect overrides", () => {
  it("exist for street lighting, ADUs, vacant-lot greening (round 3), EV hubs and school bonds (round 4)", () => {
    expect(overrides.map(([k]) => k).sort()).toEqual(["adu", "ev_hub", "school_bond", "street_lighting", "vacant_lot_green"]);
  });

  it("each one has an effect marked checked, a positive pct or value per $1, and quoted, linked citations", () => {
    for (const [id, r] of overrides) {
      expect(["verified", "partially_verified"]).toContain(r.status);
      expect(r.effect).toBe("checked");
      const o = r.sourced_effect;
      expect((o.pct || 0) > 0 || (o.value_per_dollar || 0) > 0, id).toBe(true);
      expect(o.replaces_pct).toBeGreaterThan(0);
      expect(o.basis.length).toBeGreaterThan(20);
      expect(o.citations.length).toBeGreaterThan(0);
      for (const c of o.citations) {
        expect(c.quote.length, id).toBeGreaterThan(30);
        expect(c.url).toMatch(/^https:\/\//);
        // every cited study (a DOI) is in the research library as verified; cost documents have no DOI
        const doi = (c.cite.match(/doi:(\S+)/) || [])[1];
        if (!doi) continue;
        const rec = research.find((x: any) => (x.doi || "").toLowerCase() === String(doi).toLowerCase());
        expect(rec && rec.verification.status, `${id}: ${doi}`).toBe("verified");
      }
    }
  });

  it("a sourced construction cost is only set together with its cost document, and marks the cost checked", () => {
    for (const [id, r] of overrides) {
      const o = r.sourced_effect;
      if (!o.capex) continue;
      expect(o.replaces_capex, id).toBeGreaterThan(0);
      expect(r.cost, id).toBe("checked");
      expect(o.citations.some((c: any) => c.quote.includes(o.capex.toLocaleString("en-US"))), id).toBe(true);
    }
  });

  it("round 4 quotes carry the numbers used (EV +3.3% within 1 km; $1,777,000 for 8 ports; $1.50 per $1)", () => {
    expect(iv.ev_hub.sourced_effect.pct).toBe(3.3);
    expect(iv.ev_hub.sourced_effect.citations[0].quote).toMatch(/within 1 km is about 3\.3%/);
    expect(iv.ev_hub.sourced_effect.capex).toBe(1777000);
    expect(iv.school_bond.sourced_effect.value_per_dollar).toBe(1.5);
    expect(iv.school_bond.sourced_effect.citations[0].quote).toMatch(/\$1\.50 or more for each \$1/);
  });

  it("the arithmetic stated for street lighting matches its sources (4% x 0.15 = 0.6)", () => {
    const o = iv.street_lighting.sourced_effect;
    expect(o.citations[0].quote).toMatch(/overall index crimes by approximately 4 percent/);
    expect(o.citations[1].quote).toMatch(/-0\.15 to -0\.35/);
    expect(o.pct).toBeCloseTo(4 * 0.15, 6);
  });

  it("the engine uses the same numbers on a rebuild", () => {
    expect(engine).toMatch(/add\("street_lighting"[^\n]*, 0\.6,/);
    expect(engine).toMatch(/add\("adu"[^\n]*7\.0,[^\n]*hv \* 0\.07\)/);
    expect(engine).toMatch(/add\("ev_hub", "8-port fast-charging hub", H15, 1777000, 0, 20000, 3\.3,/);
    expect(engine).toMatch(/value=sig\(1\.5 \* 10000 \* H\)\)/);
  });
});
