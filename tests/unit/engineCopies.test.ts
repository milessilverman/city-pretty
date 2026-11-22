import { describe, expect, it } from "vitest";
// @ts-ignore plain ES module script
import { compareEngineCopies, grabFunction, grabConst } from "../../scripts/check_engine_copies.mjs";
// @ts-ignore plain CommonJS module
import * as srcEngine from "../../src/engines/statutoryZoningEngine";
import * as fs from "fs";
import * as path from "path";

// The page runs its own inlined copies of the engines in app/app.js; the unit tests import src/engines/*.js and
// src/adapters/*.js. Every function and constant the two share must be the same text, so what the tests check is what
// the page runs. Found 17 Nov 2026: the roof engine's page copy still invented a 1975 build year and a 1,600 sq ft house
// that a 14 Nov fix had removed from the tested copy only (docs/audit/engine-copies.md).
// The only allowed differences are the environment bindings that load another engine (require in Node, a page global
// in the browser).
const BINDINGS = new Set(["_estVal", "_valVintage", "_evalHousing"]);

describe("engine copies: the page's code is the tested code", () => {
  const rows = compareEngineCopies();
  it("finds the shared engines", () => {
    expect(rows.filter((r: any) => r.in_app).length).toBeGreaterThan(20);
  });
  it("the exclusion check and the law evaluator are compared, and the page runs the same text as the tests", () => {
    for (const name of ["statuteExclusionCheck", "evaluateByRightHousing", "statuteAppliesTo"]) {
      const row = rows.find((r: any) => r.name === name);
      expect(row && row.in_app, name).toBe(true);
      expect(row.identical, name).toBe(true);
    }
  });
  it("every shared function and constant is identical", () => {
    const diff = rows.filter((r: any) => r.in_app && !r.identical && !BINDINGS.has(r.name)).map((r: any) => `${r.file} ${r.kind} ${r.name}`);
    expect(diff).toEqual([]);
  });
});

// Behaviour, not only text (22 Nov 2026, after the two branches' per-law exclusion designs were merged): the page's copy
// of the law engine, taken out of app/app.js and run on its own, gives the same answer as the tested copy for every
// state's lots with the page's three flags (flood, fire, historic) each present, absent and not checked, in each zone class, with
// every other listed exclusion absent and then present.
describe("engine copies: the page's law engine gives the same answers as the tested one", () => {
  const root = path.join(__dirname, "../..");
  const app = fs.readFileSync(path.join(root, "app/app.js"), "utf8");
  const LAWS = JSON.parse(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf8"));
  const parts = ["STATUTE_USABLE_STATUSES", "STATUTE_NOT_PARCEL_LEVEL"].map((n) => grabConst(app, n))
    .concat(["statuteFieldUnconfirmed", "statuteField", "statuteAppliesTo", "statuteExclusionCheck", "evaluateByRightHousing"].map((n) => grabFunction(app, n)));
  // eslint-disable-next-line no-new-func
  const pageEval = new Function(parts.join("\n") + "\nreturn evaluateByRightHousing;")();
  const zones = [
    { base_zoning_code: "R-1", is_single_family_residential: true, is_multifamily_residential: false, is_commercial_or_mixed_use: false },
    { base_zoning_code: "R-3", is_single_family_residential: false, is_multifamily_residential: true, is_commercial_or_mixed_use: false },
    { base_zoning_code: "C-2", is_single_family_residential: false, is_multifamily_residential: false, is_commercial_or_mixed_use: true },
  ];
  const vals = [true, false, null];
  it("same output on every combination, and the combinations reach every outcome", () => {
    const states = [...new Set(LAWS.map((r: any) => r.state_code))];
    const seen = { applied: 0, excluded: 0, conditional: 0, notChecked: 0 };
    let n = 0;
    for (const st of states) for (const z of zones) for (const other of [false, true]) for (const f of vals) for (const fire of vals) for (const h of vals) {
      // every other exclusion the state's laws list is set to "checked, absent" (or, in the second pass, "present")
      const clear: any = {};
      for (const r of LAWS) if (r.state_code === st) for (const e of r.exclusion_sources || []) clear[e.key] = other;
      const p = { parcel_id: "t", state_code: st, county_fips: "06037", municipality_pop: 500000, county_pop: 2000000, lot_sqft: 8000,
        dist_to_heavy_rail_mi: 0.2, dist_to_frequent_bus_or_brt_mi: 0.1, dist_to_light_rail_mi: 0.2, ...z,
        exclusions: { ...clear, fema_100yr_floodway: f, calfire_or_state_vhfhsz: fire, historic_district_hpoz: h } };
      const a = srcEngine.evaluateByRightHousing(p, LAWS), b = pageEval(p, LAWS);
      expect(b, st + " " + z.base_zoning_code + " " + [f, fire, h].join("/")).toEqual(a);
      seen.applied += a.applicable_statutes.length;
      seen.excluded += a.excluded_by_statute.length;
      seen.conditional += a.not_confirmed.filter((x: any) => /which the law's text excludes only/.test(x.reason)).length;
      seen.notChecked += a.not_confirmed.filter((x: any) => /the page has not checked/.test(x.reason)).length;
      n++;
    }
    expect(n).toBeGreaterThan(300);
    for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(0);
  });
});
