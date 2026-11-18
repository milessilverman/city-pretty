import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import * as tsEngine from "../../src/engines/statutoryZoningEngine";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf-8");
const laws = JSON.parse(read("app/data/statutes.json"));
const funding = JSON.parse(read("app/data/funding_programs.json"));
const finance = JSON.parse(read("app/data/state_finance_profiles.json"));
const jsEngine = createRequire(import.meta.url)("../../src/engines/statutoryZoningEngine.js");

const STATUS = ["verified", "partly", "unverified"];
const noEx = {
  historic_district_hpoz: false,
  coastal_commission_or_sma: false,
  fema_100yr_floodway: false,
  calfire_or_state_vhfhsz: false,
  airport_noise_or_runway_zone: false,
  williamson_or_ag_preserve: false,
  public_or_tribal_land: false,
  everglades_or_wekiva_or_trpa: false,
  population_threshold_ineligible: false,
};
const ctx = (o: any) => ({
  parcel_id: "t",
  state_code: "CA",
  county_fips: "06037",
  municipality_pop: 500000,
  county_pop: 5000000,
  base_zoning_code: "R-1",
  is_commercial_or_mixed_use: false,
  is_single_family_residential: true,
  dist_to_heavy_rail_mi: null,
  dist_to_frequent_bus_or_brt_mi: null,
  exclusions: { ...noEx },
  ...o,
});

function checkBlock(rec: any, label: string) {
  const v = rec.verification;
  expect(v, `${label} has verification`).toBeDefined();
  expect(STATUS).toContain(v.status);
  expect(v.checked).toBe("2026-11-18");
  expect(Array.isArray(v.fields_unconfirmed)).toBe(true);
  if (v.status !== "unverified") {
    expect(v.evidence_url, `${label} evidence_url`).toMatch(/^https?:\/\//);
    expect(v.evidence_quote, `${label} evidence_quote`).toBeTruthy();
  }
}

describe("laws verification data", () => {
  it("every housing law record has a verification block", () => {
    for (const l of laws) checkBlock(l, l.id);
  });
  it("every funding program has a verification block", () => {
    for (const p of funding) checkBlock(p, p.id);
  });
  it("every state finance profile has a verification block", () => {
    expect(Object.keys(finance).length).toBeGreaterThanOrEqual(51);
    for (const [c, p] of Object.entries<any>(finance)) checkBlock(p, c);
  });
  it("statutes.json is the only law table (state-housing-laws.json, its old duplicate, is gone)", () => {
    expect(fs.existsSync(path.join(root, "app/data/state-housing-laws.json"))).toBe(false);
    expect(read("app/app.js")).toContain('"statutes": "statutes.json"');
  });
  it("both copies of state_finance_profiles.json are identical", () => {
    expect(read("src/data/state_finance_profiles.json")).toBe(read("app/data/state_finance_profiles.json"));
  });
  it("corrected facts hold", () => {
    const by = Object.fromEntries(laws.map((l: any) => [l.id, l]));
    expect(by.tx_sb840.effective_date).toBe("2025-09-01");
    expect(by.tx_sb840.statute_citation).toContain("218");
    expect(by.tx_adu_statute.enacted).toBe(false);
    expect(by.ca_sb79_tier1.max_units_by_right).toBeNull();
    expect(by.ca_sb79_tier1.density_floor_du_per_acre).toBe(120);
    expect(by.tx_austin_home.min_lot_size_sqft).toBe(1800);
    expect(by.or_hb2001.statute_citation).toContain("197A.420");
  });
  it("engine status table mirrors the JSON", () => {
    const expected = Object.fromEntries(laws.map((l: any) => [l.id, l.verification.status]));
    for (const [id, s] of Object.entries(expected)) {
      expect((tsEngine as any).LAW_VERIFICATION_STATUS[id]).toBe(s);
      expect(jsEngine.LAW_VERIFICATION_STATUS[id]).toBe(s);
    }
  });
});

describe("engine never reports an unverified law as allowed", () => {
  for (const [name, engine] of [["ts", tsEngine as any], ["js", jsEngine]] as const) {
    it(`${name}: SB 79 area is not determined, not allowed`, () => {
      const r = engine.evaluateByRightHousing(ctx({ dist_to_heavy_rail_mi: 0.1, is_single_family_residential: false }));
      expect(r.applicable_statutes.some((s: any) => /SB 79/.test(s.citation))).toBe(false);
      expect(r.not_determined_statutes.some((s: any) => /SB 79/.test(s.citation))).toBe(true);
      expect(r.net_by_right_feasible).toBe(false);
    });
    it(`${name}: TX SB 840 and FL Live Local are not determined`, () => {
      const tx = engine.evaluateByRightHousing(ctx({ state_code: "TX", county_fips: "48113", is_commercial_or_mixed_use: true, is_single_family_residential: false }));
      expect(tx.applicable_statutes).toEqual([]);
      expect(tx.not_determined_statutes.map((s: any) => s.id)).toContain("tx_sb840");
      const fl = engine.evaluateByRightHousing(ctx({ state_code: "FL", is_commercial_or_mixed_use: true, is_single_family_residential: false }));
      expect(fl.applicable_statutes).toEqual([]);
      expect(fl.not_determined_statutes.map((s: any) => s.id)).toContain("fl_live_local");
    });
    it(`${name}: AZ is not determined`, () => {
      const az = engine.evaluateByRightHousing(ctx({ state_code: "AZ", municipality_pop: 200000 }));
      expect(az.applicable_statutes).toEqual([]);
      expect(az.not_determined_statutes.map((s: any) => s.id)).toContain("az_hb2720_2721");
    });
    it(`${name}: SB 9 (verified) is allowed with no state height limit`, () => {
      const r = engine.evaluateByRightHousing(ctx({}));
      const sb9 = r.applicable_statutes.find((s: any) => /SB 9/.test(s.citation));
      expect(sb9.max_units_by_right).toBe(4);
      expect(sb9.max_height_ft).toBeNull();
    });
    it(`${name}: WA thresholds follow RCW 36.70A.635`, () => {
      const units = (pop: number, near = false) => {
        const r = engine.evaluateByRightHousing(ctx({ state_code: "WA", municipality_pop: pop, dist_to_heavy_rail_mi: near ? 0.1 : null }));
        return r.applicable_statutes[0]?.max_units_by_right ?? null;
      };
      expect(units(80000)).toBe(4);
      expect(units(80000, true)).toBe(6);
      expect(units(30000)).toBe(2);
      expect(units(30000, true)).toBe(4);
      expect(units(10000)).toBeNull(); // under 25,000: depends on UGA condition, not determined
      const small = engine.evaluateByRightHousing(ctx({ state_code: "WA", municipality_pop: 10000 }));
      expect(small.not_determined_statutes.map((s: any) => s.id)).toContain("wa_hb1110");
    });
    it(`${name}: OR thresholds follow ORS 197A.420`, () => {
      const units = (pop: number) => engine.evaluateByRightHousing(ctx({ state_code: "OR", municipality_pop: pop })).applicable_statutes[0]?.max_units_by_right ?? null;
      expect(units(25000)).toBe(4);
      expect(units(24999)).toBe(2);
      expect(units(2500)).toBe(2);
      expect(units(2000)).toBeNull();
    });
    it(`${name}: missing zoning never allows anything`, () => {
      const r = engine.evaluateByRightHousing(ctx({ base_zoning_code: null }));
      expect(r.applicable_statutes).toEqual([]);
      expect(r.net_by_right_feasible).toBe(false);
    });
  }
  it("ts and js twins agree on a grid of inputs", () => {
    const states = ["CA", "TX", "FL", "WA", "OR", "AZ", "NY"];
    for (const st of states) for (const pop of [1000, 3000, 30000, 100000, 500000]) for (const d of [null, 0.1, 0.4]) for (const sf of [true, false]) {
      const c = ctx({ state_code: st, municipality_pop: pop, dist_to_heavy_rail_mi: d, is_single_family_residential: sf, is_commercial_or_mixed_use: !sf });
      expect(JSON.stringify(jsEngine.evaluateByRightHousing(c))).toBe(JSON.stringify((tsEngine as any).evaluateByRightHousing(c)));
    }
  });
});
