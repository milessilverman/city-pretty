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

// Stands in for "every exclusion any law lists was checked and found absent". The page itself checks only three flags
// (flood, California fire zone, Los Angeles historic); tests/unit/exclusionsPerStatute.test.ts covers unchecked and present flags.
const EX: ParcelContext["exclusions"] = Object.fromEntries([
  ...LAWS.flatMap((r: any) => (r.exclusion_sources || []).map((e: any) => [e.key, false])),
  ["population_threshold_ineligible", false],
]);
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
      expect(s.round2_search || s.round3_search, st).toBeDefined();
      expect(s.notes, st).toMatch(/Round [23] (\(2026-11-16\) )?(full-text searched|could not full-text search)/);
    }
    expect(AUDIT.states.NC.notes).toMatch(/Effective January 1, 2027/);
  });
});

describe("round 3 (16 Nov): the 23 blocked states plus NH, CT, DC and Maryland HB 538", () => {
  const ROUND3 = "AL AK AR DE GA IL IN KS KY LA MS MO NE NJ NM NY OK PA SD TN VA WV WI NH CT DC MD".split(" ");
  const R3_IDS = ["va_parking_2209_4", "va_small_lot_2286_2", "dc_adu_accessory_apartment_u253", "ct_adu_8_2o", "ct_parking_8_3n", "ct_middle_housing_8_2s"];

  it("every one of the 27 jurisdictions has a round-3 log: the route that worked, or the routes tried and what would unblock it", () => {
    for (const st of ROUND3) {
      const r = AUDIT.states[st].round3_search;
      expect(r, st).toBeDefined();
      expect(r.date).toBe("2026-11-16");
      expect(r.terms).toEqual(["adu", "middle_housing", "lot_split", "parking", "commercial_residential"]);
      if (r.route_worked) expect(r.outcome, st).toBeTruthy();
      else {
        expect(r.routes.length, st).toBeGreaterThan(0);
        expect(r.unblock, st).toBeTruthy();
        expect(AUDIT.states[st].notes, st).toMatch(/Round 3 \(2026-11-16\) could not full-text search/);
      }
    }
    expect(AUDIT.states.NY.round3_search.unblock).toMatch(/API key/);
    expect(AUDIT.states.MD.status).toBe("none_found");
    expect(AUDIT.states.NH.status).toBe("could_not_check");
  });

  it("the six new records are listed in the audit, quote their official text, and say what is unconfirmed", () => {
    for (const id of R3_IDS) {
      const r = byId[id];
      expect(r, id).toBeDefined();
      expect(AUDIT.states[r.state_code].added_records, id).toContain(id);
      expect(AUDIT.states[r.state_code].status).toBe("laws_on_file");
    }
    expect(byId.va_parking_2209_4.verification.evidence).toMatch(/One-half of one parking space per dwelling unit/);
    expect(byId.va_small_lot_2286_2.verification.evidence).toMatch(/minimum lot area not exceeding 3,000 square feet/);
    expect(byId.dc_adu_accessory_apartment_u253.verification.evidence).toMatch(/as a matter of right in the R zones, except the R-1B\/GT or R 3\/GT zone/);
    expect(byId.ct_adu_8_2o.verification.evidence).toMatch(/at least one accessory dwelling unit shall be allowed as of right on each lot that contains a single-family dwelling/);
    expect(byId.ct_parking_8_3n.verification.evidence).toMatch(/Require a minimum number of off-street motor vehicle parking spaces for any residential development except as provided in section 8-3n/);
    expect(byId.ct_middle_housing_8_2s.verification.evidence).toMatch(/On and after July 1, 2026/);
    // Virginia's July 2027 ADU law is passed but not in effect, so it has no record.
    expect(LAWS.some((r: any) => /2292\.4/.test(r.statute_citation || ""))).toBe(false);
    expect(AUDIT.states.VA.notes).toMatch(/2292\.4.*not yet in effect/);
  });

  it("Connecticut: ADU is reported with its opt-out condition, never assumed; the parking limit is jurisdiction-wide", () => {
    const r = evaluateByRightHousing(sfr({ state_code: "CT" }), LAWS);
    expect(ids(r)).not.toContain("ct_adu_8_2o");
    expect(pending(r)).toContain("ct_adu_8_2o");
    expect(r.not_confirmed.find((x: any) => x.id === "ct_adu_8_2o").reason).toMatch(/opt-out/);
    expect(pending(r)).not.toContain("ct_parking_8_3n");
    expect(ids(r)).not.toContain("ct_parking_8_3n");
    expect(pending(r)).not.toContain("ct_middle_housing_8_2s"); // commercial-land law, single-family lot
  });

  it("Connecticut § 8-2s: commercial lots only, with the definition condition reported", () => {
    const c = evaluateByRightHousing(commercial({ state_code: "CT" }), LAWS);
    expect(ids(c)).not.toContain("ct_middle_housing_8_2s");
    expect(pending(c)).toContain("ct_middle_housing_8_2s");
    expect(pending(c)).not.toContain("ct_adu_8_2o");
  });

  it("DC: accessory apartment is reported with its zone and owner-occupancy conditions; not on commercial land", () => {
    const r = evaluateByRightHousing(sfr({ state_code: "DC" }), LAWS);
    expect(ids(r)).not.toContain("dc_adu_accessory_apartment_u253");
    expect(r.not_confirmed.find((x: any) => x.id === "dc_adu_accessory_apartment_u253").reason).toMatch(/R-1B\/GT.*owner-occupied/);
    expect(pending(evaluateByRightHousing(commercial({ state_code: "DC" }), LAWS))).not.toContain("dc_adu_accessory_apartment_u253");
  });

  it("Virginia: both laws are jurisdiction-wide and never show up as a parcel right or a pending one", () => {
    for (const pop of [30000, 500000]) {
      const r = evaluateByRightHousing(sfr({ state_code: "VA", municipality_pop: pop, dist_to_frequent_bus_or_brt_mi: 0.1 }), LAWS);
      expect(ids(r)).toEqual([]);
      expect(pending(r)).toEqual([]);
    }
    expect(byId.va_parking_2209_4.parcel_level).toBe(false);
    expect(byId.va_small_lot_2286_2.municipality_pop_min).toBe(50000);
    // the effective date is presumed (1 July), so the engine must not show it as fact
    expect(byId.va_parking_2209_4.verification.unverified_fields[0]).toMatch(/^effective_date/);
  });
});
