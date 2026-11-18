// The page (app/app.js) runs inline copies of two engines because it does not import src/. These tests cut each
// inline block out of app.js by its BEGIN/END markers, run it, and check it behaves exactly like the src engine.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(__dirname, "../..");
const appJs = readFileSync(resolve(root, "app/app.js"), "utf8");
const statutes = JSON.parse(readFileSync(resolve(root, "app/data/statutes.json"), "utf8"));

function block(begin: string, end: string): string {
  const a = appJs.indexOf(begin);
  const b = appJs.indexOf(end);
  expect(a, `${begin} marker in app.js`).toBeGreaterThan(-1);
  expect(b, `${end} marker in app.js`).toBeGreaterThan(a);
  return appJs.slice(a, b);
}

const srcZoning = require("../../src/engines/statutoryZoningEngine.js");
const srcValuation = require("../../src/engines/propertyValuationEngine.js");

function inlineZoning(lawData: unknown[]) {
  const code = block("// BEGIN INLINE STATUTORY ENGINE", "// END INLINE STATUTORY ENGINE");
  // eslint-disable-next-line no-new-func
  return new Function("STATE_HOUSING_LAWS_DATA", `${code}\nreturn { evaluateByRightHousing, statuteStatus };`)(lawData) as {
    evaluateByRightHousing: (p: unknown) => any;
    statuteStatus: (id: string) => string;
  };
}

const EX = {
  historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false,
  airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false, public_or_tribal_land: false,
  everglades_or_wekiva_or_trpa: false, population_threshold_ineligible: false,
};

function parcels() {
  const out: any[] = [];
  const states = ["CA", "TX", "FL", "WA", "OR", "AZ", "NY"];
  const pops = [null, 1500, 5000, 30000, 80000, 200000, 2_300_000];
  const zones = [null, "unknown", "R1-1", "C2-1"];
  const rails = [null, 0.2, 0.4, 2];
  const exs = [{}, { historic_district_hpoz: true }, { fema_100yr_floodway: true }, { everglades_or_wekiva_or_trpa: true }];
  let i = 0;
  for (const st of states) for (const pop of pops) for (const z of zones) for (const r of rails) for (const e of exs) {
    const comm = z === "C2-1";
    out.push({
      parcel_id: `p${i++}`, state_code: st, county_fips: "00000", municipality_pop: pop, county_pop: pop == null ? null : pop * 3,
      base_zoning_code: z, is_commercial_or_mixed_use: comm, is_single_family_residential: !!z && !comm && z !== "unknown",
      dist_to_heavy_rail_mi: r, dist_to_frequent_bus_or_brt_mi: r == null ? null : r / 2, exclusions: { ...EX, ...e },
    });
  }
  return out;
}

describe("inline statutory engine in app.js", () => {
  it("reads each law's status from statutes.json and matches the src table", () => {
    const eng = inlineZoning(statutes);
    for (const r of statutes) expect(eng.statuteStatus(r.id)).toBe(srcZoning.LAW_VERIFICATION_STATUS[r.id]);
    expect(eng.statuteStatus("no_such_law")).toBe("unverified");
  });

  it("gives the same result as src/engines/statutoryZoningEngine.js on every test parcel", () => {
    const eng = inlineZoning(statutes);
    const list = parcels();
    expect(list.length).toBeGreaterThan(1000);
    for (const p of list) expect(eng.evaluateByRightHousing(p)).toEqual(srcZoning.evaluateByRightHousing(p));
  });

  it("never treats a law as allowed before statutes.json has loaded", () => {
    const eng = inlineZoning([]);
    const sfr = { ...parcels().find((p) => p.state_code === "CA" && p.base_zoning_code === "R1-1" && p.dist_to_heavy_rail_mi === 2 && !p.exclusions.historic_district_hpoz && !p.exclusions.fema_100yr_floodway) };
    const res = eng.evaluateByRightHousing(sfr);
    expect(res.applicable_statutes).toEqual([]);
    expect(res.net_by_right_feasible).toBe(false);
    expect(res.not_determined_statutes.map((s: any) => s.id)).toContain("ca_sb9_lot_split");
  });
});

describe("inline valuation engine in app.js", () => {
  const code = block("// BEGIN INLINE VALUATION ENGINE", "// END INLINE VALUATION ENGINE");
  // eslint-disable-next-line no-new-func
  const inline = new Function(`${code}\nreturn { estimatePropertyMarketValue };`)() as { estimatePropertyMarketValue: (p: unknown) => any };

  const cases: any[] = [
    { attributes: { Roll_LandValue: 400000, Roll_ImpValue: 300000, Roll_LandBaseYear: 2015 }, lotSqft: 6000, neighborhood: { hv: 900000 }, stateCode: "CA", facts: { bldg: 1600, beds: 3, baths: 2, yb: 1955 } },
    { attributes: { CERTIFIED_TOT: 45000 }, lotSqft: 3500, neighborhood: { hv: 320000 }, stateCode: "IL", facts: { bldg: 1200 } },
    { attributes: { market_value: 310000 }, lotSqft: 1200, neighborhood: { hv: 250000 }, stateCode: "PA", facts: { bldg: 1100 } },
    { attributes: { AppraisedValue: 850000 }, lotSqft: 5000, neighborhood: { hv: 800000 }, stateCode: "WA", facts: { bldg: 1800 },
      salesInfo: { price: 600000, year: 2018, hpiRatio: 1.4 }, calibration: { assessorRatio: 1.13, hedonicScale: 0.94, weights: { assessor: 0.5, priorSale: 0.3, hedonic: 0.2 } } },
    { attributes: {}, neighborhood: {}, stateCode: "TX", facts: {} },
  ];

  it("gives the same result as src/engines/propertyValuationEngine.js", () => {
    for (const c of cases) expect(inline.estimatePropertyMarketValue(c)).toEqual(srcValuation.estimatePropertyMarketValue(c));
  });

  it("reads Philadelphia's lowercase market_value", () => {
    const withField = srcValuation.estimatePropertyMarketValue(cases[2]);
    const without = srcValuation.estimatePropertyMarketValue({ ...cases[2], attributes: {} });
    expect(withField.estimatedValue).not.toBe(without.estimatedValue);
  });
});

describe("page wiring of the checked data", () => {
  it("no longer loads state-housing-laws.json (statutes.json is the one law table)", () => {
    expect(appJs).not.toContain("state-housing-laws.json");
  });

  it("passes the county back-test to valuationCheck and the calibration to the engine", () => {
    expect(appJs).toMatch(/valuationCheck\(a, lot, houseHv, \{ enforceCountyBacktest: true/);
    expect(appJs).toContain("engine_calibrated.calibration");
  });

  it("has no invented research fallback or hard-coded P3 tiles left", () => {
    expect(appJs).not.toContain("x.vpd || 1.8");
    expect(appJs).not.toMatch(/id="p3-irr"[^>]*>15\.6%/);
    expect(appJs).not.toContain("CA_SB79_ELIGIBLE_COUNTIES");
  });
});
