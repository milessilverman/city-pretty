// State housing laws added in the 16 Nov 2026 50-state review (scripts/add_state_laws_50.py, docs/audit/state-laws-50.json).
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { evaluateByRightHousing, ParcelContext } from "../../src/engines/statutoryZoningEngine";

const root = path.join(__dirname, "../..");
const LAWS = JSON.parse(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf-8"));
const AUDIT = JSON.parse(fs.readFileSync(path.join(root, "docs/audit/state-laws-50.json"), "utf-8"));
const NEW_IDS = Object.values(AUDIT.states).flatMap((s: any) => s.added_records) as string[];
const byId = Object.fromEntries(LAWS.map((r: any) => [r.id, r]));

const EX: ParcelContext["exclusions"] = {
  historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false,
  airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false, public_or_tribal_land: false, everglades_or_wekiva_or_trpa: false,
  population_threshold_ineligible: false,
};
const sfr = (o: Partial<ParcelContext>): ParcelContext => ({
  parcel_id: "t", state_code: "XX", county_fips: "00000", municipality_pop: 100000, county_pop: 500000, lot_sqft: 6000,
  base_zoning_code: "R-1", is_commercial_or_mixed_use: false, is_single_family_residential: true,
  dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: { ...EX }, ...o,
});
const commercial = (o: Partial<ParcelContext>): ParcelContext => sfr({ base_zoning_code: "C-2", is_commercial_or_mixed_use: true, is_single_family_residential: false, ...o });
const ids = (r: any) => r.applicable_statutes.map((s: any) => s.id);
const pending = (r: any) => r.not_confirmed.map((s: any) => s.id);

describe("50-state review: provenance", () => {
  it("covers all 50 states and DC with a status", () => {
    expect(Object.keys(AUDIT.states)).toHaveLength(51);
    for (const s of Object.values(AUDIT.states) as any[]) {
      expect(["laws_on_file", "none_found", "could_not_check", "passed_not_yet_in_effect", "not_checked"]).toContain(s.status);
      if (s.status === "none_found") expect(s.notes).toMatch(/no qualifying statewide law found as of 2026-11-16/);
    }
  });

  it("every added record exists in both statute files, with a URL, an effective date (or says it's unconfirmed) and a quote", () => {
    expect(NEW_IDS.length).toBeGreaterThanOrEqual(13);
    expect(fs.readFileSync(path.join(root, "app/data/statutes.json"))).toEqual(fs.readFileSync(path.join(root, "app/data/state-housing-laws.json")));
    for (const id of NEW_IDS) {
      const r = byId[id];
      expect(r, id).toBeDefined();
      expect(r.statute_url).toMatch(/^https:\/\//);
      const uf: string[] = r.verification.unverified_fields || [];
      if (!r.effective_date) expect(uf.some((u) => u.startsWith("effective_date")), id).toBe(true);
      else expect(r.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["verified", "partially_verified"]).toContain(r.verification.status);
      expect(r.verification.evidence.length, id).toBeGreaterThan(80);
    }
  });

  it("no record exists for a law that is passed but not yet in effect (Hawaii SB 3202)", () => {
    expect(LAWS.some((r: any) => r.state_code === "HI")).toBe(false);
    expect(AUDIT.states.HI.status).toBe("passed_not_yet_in_effect");
  });
});

describe("50-state review: the engine applies the new laws only where every condition is known", () => {
  it("Rhode Island: ADU by right on lots of 20,000 sq ft+, not on smaller lots; the footprint path is reported as unchecked", () => {
    expect(ids(evaluateByRightHousing(sfr({ state_code: "RI", lot_sqft: 25000 }), LAWS))).toContain("ri_adu_large_lot");
    const small = evaluateByRightHousing(sfr({ state_code: "RI", lot_sqft: 8000 }), LAWS);
    expect(ids(small)).not.toContain("ri_adu_large_lot");
    expect(pending(small)).toContain("ri_adu_existing_footprint");
  });

  it("Massachusetts: one ADU in single-family zones, not on commercial land", () => {
    expect(ids(evaluateByRightHousing(sfr({ state_code: "MA" }), LAWS))).toContain("ma_adu_40a3");
    expect(ids(evaluateByRightHousing(commercial({ state_code: "MA" }), LAWS))).not.toContain("ma_adu_40a3");
  });

  it("Montana: ADU on single-family lots; the commercial-zone multifamily rule needs water/sewer letters, so it is reported, not assumed", () => {
    expect(ids(evaluateByRightHousing(sfr({ state_code: "MT" }), LAWS))).toContain("mt_adu_76_2_345");
    const c = evaluateByRightHousing(commercial({ state_code: "MT", municipality_pop: 40000 }), LAWS);
    expect(ids(c)).not.toContain("mt_commercial_76_2_304_4");
    expect(pending(c)).toContain("mt_commercial_76_2_304_4");
    // a commercial-land law never applies to a single-family lot
    expect(pending(evaluateByRightHousing(sfr({ state_code: "MT" }), LAWS))).not.toContain("mt_commercial_76_2_304_4");
  });

  it("California: ADU + junior ADU ministerially on single-family lots, not on commercial land", () => {
    expect(ids(evaluateByRightHousing(sfr({ state_code: "CA", county_fips: "06037" }), LAWS))).toContain("ca_adu_66323");
    expect(ids(evaluateByRightHousing(commercial({ state_code: "CA", county_fips: "06037" }), LAWS))).not.toContain("ca_adu_66323");
  });

  it("Texas SB 15: only large cities, and only with the unplatted-tract condition, which is reported as unchecked", () => {
    const big = evaluateByRightHousing(sfr({ state_code: "TX", municipality_pop: 900000 }), LAWS);
    expect(ids(big)).not.toContain("tx_sb15_small_lots");
    expect(pending(big)).toContain("tx_sb15_small_lots");
    expect(pending(evaluateByRightHousing(sfr({ state_code: "TX", municipality_pop: 90000 }), LAWS))).not.toContain("tx_sb15_small_lots");
  });

  it("Washington: the 2025 parking caps are jurisdiction-wide, never a parcel right", () => {
    const r = evaluateByRightHousing(sfr({ state_code: "WA", municipality_pop: 700000 }), LAWS);
    expect(ids(r)).not.toContain("wa_sb5184_parking");
    expect(pending(r)).not.toContain("wa_sb5184_parking");
    expect(pending(r)).toContain("wa_hb1337_adu"); // urban growth area condition not on the parcel record
  });

  it("Oregon: affordable housing on commercial-only land is reported with its covenant condition, not assumed", () => {
    const r = evaluateByRightHousing(commercial({ state_code: "OR", municipality_pop: 60000 }), LAWS);
    expect(ids(r)).not.toContain("or_commercial_197a460");
    expect(pending(r)).toContain("or_commercial_197a460");
  });
});

describe("round 2 (16 Nov): laws found by searching state code text", () => {
  it("Idaho: ADUs as of right in cities over 10,000, not in smaller ones; starter-home subdivisions are never a single-lot right", () => {
    const big = evaluateByRightHousing(sfr({ state_code: "ID", municipality_pop: 50000 }), LAWS);
    expect(ids(big)).toContain("id_adu_67_6541");
    expect(ids(big)).not.toContain("id_starter_home_67_6542");
    expect(ids(evaluateByRightHousing(sfr({ state_code: "ID", municipality_pop: 10000 }), LAWS))).not.toContain("id_adu_67_6541");
  });

  it("Nevada: the ADU-ordinance mandate is reported as unconfirmed for a parcel, never as by-right", () => {
    const r = evaluateByRightHousing(sfr({ state_code: "NV", municipality_pop: 300000 }), LAWS);
    expect(ids(r)).not.toContain("nv_adu_ordinance_278_257");
    expect(pending(r)).toContain("nv_adu_ordinance_278_257");
  });

  it("Colorado HB 24-1152 needs its MPO coverage condition and no longer applies to every Colorado parcel", () => {
    const r = evaluateByRightHousing(sfr({ state_code: "CO", municipality_pop: 800 }), LAWS);
    expect(ids(r)).not.toContain("co_hb24_1152");
    expect(byId["co_hb24_1152"].statute_citation).toMatch(/29-35-103/);
    expect(byId["co_hb24_1152"].verification.status).toBe("verified");
  });

  it("California AB 2011: commercial sites only, with its affordability and site conditions reported, not assumed", () => {
    const c = evaluateByRightHousing(commercial({ state_code: "CA" }), LAWS);
    expect(ids(c)).not.toContain("ca_ab2011_affordable");
    expect(pending(c)).toContain("ca_ab2011_affordable");
    expect(pending(evaluateByRightHousing(sfr({ state_code: "CA" }), LAWS))).not.toContain("ca_ab2011_affordable");
    expect(byId["ca_ab2011_affordable"].verification.evidence).toMatch(/use by right/);
  });

  it("every 'none found' state says what was actually searched in round 2", () => {
    for (const [st, s] of Object.entries(AUDIT.states) as [string, any][]) {
      if (s.status !== "none_found") continue;
      expect(s.round2_search, st).toBeDefined();
      expect(s.notes, st).toMatch(/Round 2 (full-text searched|could not full-text search)/);
    }
    expect(AUDIT.states.NC.notes).toMatch(/Effective January 1, 2027/);
  });
});
