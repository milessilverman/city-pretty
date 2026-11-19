import { describe, expect, it } from "vitest";
import { statuteAppliesTo, ParcelContext } from "../../src/engines/statutoryZoningEngine";
import * as fs from "fs";
import * as path from "path";

// A city ordinance in the law table (local_jurisdiction) applies only inside that city. Before 17 Nov 2026 Raleigh's
// and Minneapolis's ordinances fell through to the generic state-wide rule and were applied to residential lots
// anywhere in North Carolina and Minnesota.
const LAWS = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/statutes.json"), "utf-8"));
const rec = (id: string) => LAWS.find((r: any) => r.id === id);
const lot = (st: string, city: string | null): ParcelContext => ({
  parcel_id: "x", state_code: st, county_fips: "00000", municipality_name: city, municipality_pop: 500000, county_pop: 1000000,
  base_zoning_code: "R", is_commercial_or_mixed_use: false, is_single_family_residential: true, lot_sqft: 8000,
  exclusions: {} as any,
} as any);

describe("city ordinances apply only in their city", () => {
  it("the three city ordinances are tagged with their city", () => {
    for (const id of ["tx_austin_home", "nc_raleigh_missing_middle", "mn_minneapolis_2040"]) expect(rec(id).local_jurisdiction?.match).toBeTruthy();
  });
  it("Raleigh's ordinance does not apply in Charlotte, and needs a city name", () => {
    expect(statuteAppliesTo(rec("nc_raleigh_missing_middle"), lot("NC", "Charlotte")).applies).toBe(false);
    const none = statuteAppliesTo(rec("nc_raleigh_missing_middle"), lot("NC", null));
    expect(none.applies).toBe(false);
    expect(none.missing).toContain("city name");
  });
  it("Minneapolis's ordinance does not apply in Duluth; Austin's not in Houston", () => {
    expect(statuteAppliesTo(rec("mn_minneapolis_2040"), lot("MN", "Duluth")).applies).toBe(false);
    expect(statuteAppliesTo(rec("tx_austin_home"), lot("TX", "Houston")).applies).toBe(false);
  });
  it("statutes.json and state-housing-laws.json stay identical", () => {
    expect(fs.readFileSync(path.join(__dirname, "../../app/data/state-housing-laws.json"), "utf-8"))
      .toBe(fs.readFileSync(path.join(__dirname, "../../app/data/statutes.json"), "utf-8"));
  });
});

// The page runs its own copy of statuteAppliesTo (app/app.js); these unit tests run src/engines/statutoryZoningEngine.js.
// Keep the two identical so a fix tested here is the fix the page runs.
describe("the page's law engine and the tested engine are the same code", () => {
  it("statuteAppliesTo in app/app.js matches src/engines/statutoryZoningEngine.js", () => {
    const grab = (f: string, re: RegExp) => { const t = fs.readFileSync(path.join(__dirname, "../..", f), "utf-8"); const m = t.match(re); return m ? m[0] : ""; };
    const re = /function statuteAppliesTo\(rec, parcel\) \{[\s\S]*?\n\}\n/;
    const a = grab("app/app.js", re), b = grab("src/engines/statutoryZoningEngine.js", re);
    expect(a.length).toBeGreaterThan(1000);
    expect(a).toBe(b);
  });
});
