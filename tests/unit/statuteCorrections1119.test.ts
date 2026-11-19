import { describe, expect, it } from "vitest";
import { evaluateByRightHousing, ParcelContext } from "../../src/engines/statutoryZoningEngine";
import * as fs from "fs";
import * as path from "path";

// Corrections of 19 Nov 2026 (docs/audit/branch-evidence-comparison-2026-11-19.md): each condition below was checked
// against the official text on that date.
const LAWS = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/statutes.json"), "utf-8"));

const BASE_EXCLUSIONS: ParcelContext["exclusions"] = {
  historic_district_hpoz: false,
  coastal_commission_or_sma: false,
  fema_100yr_floodway: false,
  calfire_or_state_vhfhsz: false,
  airport_noise_or_runway_zone: false,
  williamson_or_ag_preserve: false,
  public_or_tribal_land: false,
  wekiva_or_everglades_protection_area: false,
  population_threshold_ineligible: false,
};

describe("19 Nov 2026 statute corrections", () => {
  const flParcel = (over: Record<string, any> = {}): ParcelContext => ({
    parcel_id: "12086-100", state_code: "FL", county_fips: "12086", municipality_pop: 455000, county_pop: 2686000,
    base_zoning_code: "RS-1", is_commercial_or_mixed_use: false, is_single_family_residential: true,
    dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: { ...BASE_EXCLUSIONS }, ...over,
  } as ParcelContext);

  it("Florida Live Local also reaches county, city and school-district land and large religious-institution land whatever the zoning", () => {
    const fl = LAWS.find((r: any) => r.id === "fl_live_local");
    expect(fl.commercial_or_industrial_only).toBeUndefined();
    // zoning alone (a residential lot) is not enough, and the page says what it cannot tell
    const plain = evaluateByRightHousing(flParcel(), LAWS);
    expect(plain.applicable_statutes.map(s => s.id)).not.toContain("fl_live_local");
    expect(plain.not_confirmed.find(n => n.id === "fl_live_local")!.reason).toMatch(/who owns the parcel/);
    // a parcel known to be public or religious-institution land qualifies
    const pub = evaluateByRightHousing(flParcel({ is_public_or_religious_land: true }), LAWS);
    expect(pub.applicable_statutes.map(s => s.id)).toContain("fl_live_local");
    // known not to be: no notice
    const priv = evaluateByRightHousing(flParcel({ is_public_or_religious_land: false }), LAWS);
    expect(priv.not_confirmed.map(n => n.id)).not.toContain("fl_live_local");
    // commercial, industrial or mixed-use zoning still applies
    const comm = evaluateByRightHousing(flParcel({ is_commercial_or_mixed_use: true, is_single_family_residential: false }), LAWS);
    expect(comm.applicable_statutes.map(s => s.id)).toContain("fl_live_local");
  });

  it("Florida Live Local exclusions are the ones in s. 166.04151(7)(o), with no TRPA; the Wekiva / Everglades flag excludes", () => {
    const fl = LAWS.find((r: any) => r.id === "fl_live_local");
    const keys = fl.statutory_exclusions.map((e: string) => e.split(/[\s(]/)[0]);
    expect(keys).toEqual(expect.arrayContaining(["airport_noise_or_runway_zone", "working_waterfront_in_industrial_zone", "wekiva_or_everglades_protection_area", "open_character_district", "area_of_critical_state_concern", "recorded_conservation_easement"]));
    expect(JSON.stringify(fl.statutory_exclusions)).not.toMatch(/trpa/i);
    expect(fl.verification.unverified_fields.join(" ")).toMatch(/statutory_exclusions/);
    const comm = flParcel({ is_commercial_or_mixed_use: true, is_single_family_residential: false });
    const excluded = evaluateByRightHousing({ ...comm, exclusions: { ...BASE_EXCLUSIONS, wekiva_or_everglades_protection_area: true } }, LAWS);
    expect(excluded.applicable_statutes.map(s => s.id)).not.toContain("fl_live_local");
  });

  it("SB 79: a county missing from the list on file is reported as not confirmed, not ruled out; SB 722 is cited", () => {
    const parcel = (county: string): ParcelContext => ({
      parcel_id: county + "-1", state_code: "CA", county_fips: county, municipality_pop: 120000, county_pop: 1000000,
      base_zoning_code: "C2", is_commercial_or_mixed_use: true, is_single_family_residential: false,
      dist_to_heavy_rail_mi: 0.2, dist_to_frequent_bus_or_brt_mi: null, exclusions: { ...BASE_EXCLUSIONS },
    });
    const outside = evaluateByRightHousing(parcel("06013"), LAWS);
    expect(outside.applicable_statutes.map(s => s.id)).not.toContain("ca_sb79_tier1");
    expect(outside.not_confirmed.find(n => n.id === "ca_sb79_tier1")!.reason).toMatch(/urban transit county/);
    const far = evaluateByRightHousing({ ...parcel("06013"), dist_to_heavy_rail_mi: 0.9 }, LAWS);
    expect(far.not_confirmed.map(n => n.id)).not.toContain("ca_sb79_tier1");
    const inList = evaluateByRightHousing(parcel("06037"), LAWS);
    expect(inList.applicable_statutes.map(s => s.id)).toContain("ca_sb79_tier1");
    const t1 = LAWS.find((r: any) => r.id === "ca_sb79_tier1");
    expect(t1.statute_citation).toMatch(/SB 722/);
    expect(t1.statutory_exclusions.join(" ")).toMatch(/mobilehome_or_rv_park_site/);
    expect(JSON.stringify(t1.statutory_exclusions)).not.toMatch(/sea_level_rise|local_historic_register/);
  });

  it("Vermont, Arizona and Oregon: unit counts and dates shown only where the official text fixes them", () => {
    const vt = LAWS.find((r: any) => r.id === "vt_act47");
    expect(vt.max_units_by_right).toBeNull();
    expect([vt.max_units_two_unit_districts, vt.max_units_sewer_water_districts]).toEqual([2, 4]);
    const az = LAWS.find((r: any) => r.id === "az_hb2720_2721");
    expect(az.max_units_by_right).toBeNull();
    expect(az.max_units_adu_path).toBe(3);
    const or = LAWS.find((r: any) => r.id === "or_hb2001");
    expect(or.effective_date).toBeNull();
    const tx = LAWS.find((r: any) => r.id === "tx_sb840");
    expect(tx.statutory_exclusions.join(" ")).toMatch(/1,000 feet|within_1000_ft_of_heavy_industrial_use/);
  });

  it("statutes.json and state-housing-laws.json stay identical", () => {
    const other = fs.readFileSync(path.join(__dirname, "../../app/data/state-housing-laws.json"), "utf-8");
    expect(other).toBe(fs.readFileSync(path.join(__dirname, "../../app/data/statutes.json"), "utf-8"));
  });
});
