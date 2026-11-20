import { describe, expect, it } from "vitest";
import {
  auditSingleHouseParcel,
  calculatePermitCapitalization,
  calculateCalibratedTreeEconomics,
} from "../../src/engines/parcelHouseAuditor";
import { estimatePropertyMarketValue } from "../../src/engines/propertyValuationEngine";

// These tests pin the honest behavior adopted on 2026-11-16: values come only from records on file, invented
// constants are gone, and anything that cannot be sourced is null with a reason.

const ANSWERED_NO = { historic_district_hpoz: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false };
const BASE = {
  lat: 34.05,
  lng: -118.25,
  stateCode: "CA",
  countyFips: "06037",
};

describe("Parcel house auditor", () => {
  it("1. Reports recorded permit valuations but never adds them to the value estimate", () => {
    const permits = [
      { issue_date: "2024-05-10", permit_type: "remodel" as const, valuation_usd: 80000, description: "Kitchen remodel" },
      { issue_date: "2024-09-15", permit_type: "seismic" as const, valuation_usd: 9500, description: "Seismic bolting" },
    ];
    expect(calculatePermitCapitalization(permits)).toBe(89500);

    const withPermits = auditSingleHouseParcel({ ...BASE, parcelId: "p1", lotSqft: 6500, livingSqft: 1800, neighborhoodMedianHv: 950000, recentPermits: permits });
    const without = auditSingleHouseParcel({ ...BASE, parcelId: "p1", lotSqft: 6500, livingSqft: 1800, neighborhoodMedianHv: 950000 });
    expect(withPermits.valuation.permitValuationTotal).toBe(89500);
    expect(withPermits.valuation.permitCapitalizationAdded).toBe(0);
    expect(withPermits.valuation.estimatedValue).toBe(without.valuation.estimatedValue);
  });

  it("2. Gives no accuracy range and labels the estimate unvalidated (a county without a back-test)", () => {
    const a = auditSingleHouseParcel({ ...BASE, countyFips: "06059", parcelId: "p2", lotSqft: 6000, livingSqft: 1600, neighborhoodMedianHv: 800000 });
    expect(a.valuation.estimatedValue).toBeGreaterThan(0);
    expect(a.valuation.valueLow).toBeNull();
    expect(a.valuation.valueHigh).toBeNull();
    expect(a.valuation.confidenceMarginPct).toBeNull();
    expect(a.valuation.confidenceRating).toMatch(/Unvalidated/);
    expect(a.valuation.confidenceRating).not.toMatch(/precision|institutional|high confidence/i);
  });

  // The page withholds the generic estimate through publishValuation (LA shows only its tested model; e2e covers it).
  // This engine is the page's code (tests/unit/engineCopies.test.ts) and calls that gate whenever the page defines it.
  // Before 17 Nov 2026 this test checked an LA early return that existed only in the tested copy, not on the page.
  it("2b. The auditor passes its value through the page's publishValuation gate when one is defined", () => {
    const g = globalThis as any;
    g.publishValuation = (v: any, fips: string) => (fips === "06037" ? { ...v, estimatedValue: null, withheldReason: "failed its back-test (test gate)" } : v);
    try {
      const a = auditSingleHouseParcel({ ...BASE, parcelId: "p2b", lotSqft: 6000, livingSqft: 1600, neighborhoodMedianHv: 800000 });
      expect(a.valuation.estimatedValue).toBeNull();
      expect(a.valuation.withheldReason).toMatch(/failed its back-test/);
    } finally {
      delete g.publishValuation;
    }
  });

  it("3. Withholds the value when nothing usable is on file instead of using a state default", () => {
    const a = auditSingleHouseParcel({ ...BASE, parcelId: "p3", lotSqft: 6000, livingSqft: 1600, neighborhoodMedianHv: null });
    expect(a.valuation.estimatedValue).toBeNull();
    expect(a.valuation.withheldReason).toBeTruthy();
  });

  it("4. Does not index old sales or old Prop 13 base years without a price index", () => {
    const oldSale = estimatePropertyMarketValue({ attributes: {}, lotSqft: 6000, neighborhood: {}, stateCode: "CA", facts: { bldg: 1500 }, salesInfo: { price: 400000, year: 2012 } });
    expect(oldSale.saleCompEst).toBeNull();
    expect(oldSale.estimatedValue).toBeNull();

    const recentSale = estimatePropertyMarketValue({ attributes: {}, lotSqft: 6000, neighborhood: {}, stateCode: "CA", facts: { bldg: 1500 }, salesInfo: { price: 910000, year: 2026 } });
    expect(recentSale.saleCompEst).toBe(910000);
    expect(recentSale.estimatedValue).toBe(910000);

    const oldBase = estimatePropertyMarketValue({ attributes: { Roll_LandValue: 300000, Roll_ImpValue: 100000, Roll_LandBaseYear: 2005 }, lotSqft: 6000, neighborhood: {}, stateCode: "CA", facts: { bldg: 1500 } });
    expect(oldBase.assessorMarketEst).toBeNull();
  });

  it("5. Does not anchor on a top-coded ACS median", () => {
    const r = estimatePropertyMarketValue({ attributes: {}, lotSqft: 9000, neighborhood: { hv: 2000001, c: "beverly hills" }, stateCode: "CA", facts: { bldg: 3000 } });
    expect(r.hedonicEst).toBeNull();
    expect(r.estimatedValue).toBeNull();
    expect(r.notes.join(" ")).toMatch(/top-coded/);
  });

  it("6. Only checks imagery against real capture dates", () => {
    const stale = auditSingleHouseParcel({
      ...BASE, parcelId: "p6", lotSqft: 6000, neighborhoodMedianHv: 750000,
      imageryInfo: { lidarYear: 2020, streetViewDate: "2021-06", hasStreetView: true },
      recentPermits: [{ issue_date: "2024-03-12", permit_type: "addition", valuation_usd: 120000, description: "Second story addition" }],
    });
    expect(stale.imagery.confidenceBadge).toBe("stale_imagery_permit_override");

    const unknown = auditSingleHouseParcel({ ...BASE, parcelId: "p6b", lotSqft: 6000, neighborhoodMedianHv: 750000 });
    expect(unknown.imagery.confidenceBadge).toBe("imagery_dates_unknown");
    expect(unknown.imagery.lidarAcquisitionYear).toBeNull();
    expect(unknown.imagery.streetViewCaptureDate).toBeNull();
  });

  it("7. Never infers housing rights or lot splits from missing zoning", () => {
    const a = auditSingleHouseParcel({ ...BASE, parcelId: "p7", lotSqft: 7500, livingSqft: 1800, neighborhoodMedianHv: 850000 });
    expect(a.statutoryZoning.base_zoning_code).toBeNull();
    expect(a.statutoryZoning.applicable_statutes).toEqual([]);
    expect(a.statutoryZoning.lotSplitFeasible).toBe(false);
    expect(a.statutoryZoning.statutoryNotes).toContain("Zoning is not on file");
  });

  it("8. Flags a California lot split only from the SB 9 record, and never in an HPOZ", () => {
    // The site checks SB 9 names (historic, flood, fire) answered "no". Before 20 Nov 2026 a check that was never answered counted as "no".
    const ok = auditSingleHouseParcel({ ...BASE, parcelId: "p8", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000, exclusions: ANSWERED_NO });
    expect(ok.statutoryZoning.applicable_statutes.map((s: any) => s.id)).toContain("ca_sb9_lot_split");
    expect(ok.statutoryZoning.lotSplitFeasible).toBe(true);

    const hpoz = auditSingleHouseParcel({ ...BASE, parcelId: "p8b", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000, exclusions: { historic_district_hpoz: true } });
    expect(hpoz.statutoryZoning.lotSplitFeasible).toBe(false);

    // A site check that was not answered (FEMA did not reply): SB 9 is not confirmed, with the reason. It is not applied.
    const noFema: any = auditSingleHouseParcel({ ...BASE, parcelId: "p8n", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000, exclusions: { historic_district_hpoz: false, calfire_or_state_vhfhsz: false } });
    expect(noFema.statutoryZoning.applicable_statutes.map((s: any) => s.id)).not.toContain("ca_sb9_lot_split");
    expect(noFema.statutoryZoning.lotSplitFeasible).toBe(false);
    expect(noFema.statutoryZoning.not_confirmed.find((n: any) => n.id === "ca_sb9_lot_split").reason).toContain("whether the lot is in a FEMA special flood hazard area");
    // On a site the engine stops at (very high fire zone), every law is listed as not screened, with that reason.
    const fire: any = auditSingleHouseParcel({ ...BASE, parcelId: "p8v", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000, exclusions: { ...ANSWERED_NO, calfire_or_state_vhfhsz: true } });
    expect(fire.statutoryZoning.applicable_statutes).toEqual([]);
    expect(fire.statutoryZoning.not_confirmed.find((n: any) => n.id === "ca_adu_66323").reason).toContain("Not screened: the lot is in a very high fire hazard severity zone");
    expect(fire.statutoryZoning.statutoryNotes).toContain("very high fire hazard severity zone");
  });

  it("8b. The zoning map's own category decides where the caller has one (LA R1 variation zones)", () => {
    const ids = (x: any) => x.statutoryZoning.applicable_statutes.map((s: any) => s.id);
    const base = { ...BASE, lotSqft: 7500, livingSqft: 1800, neighborhoodMedianHv: 850000, useDescription: "Single", exclusions: ANSWERED_NO };
    // Without a category the text tests misread both codes (found 20 Nov 2026 at 2107 Duxbury Cir and on R1R3 lots).
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8c", zoningCode: "R1V2-O" }))).not.toContain("ca_sb9_lot_split");
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8d", zoningCode: "R1R3-RG" }))).not.toContain("ca_sb9_lot_split");
    for (const zoningCode of ["R1V2-O", "R1R3-RG"]) {
      const a: any = auditSingleHouseParcel({ ...base, parcelId: "p8e", zoningCode, zoningCategory: "single-family" } as any);
      expect(ids(a)).toContain("ca_sb9_lot_split");
      expect(a.statutoryZoning.base_zoning_code).toBe(zoningCode);
    }
    // A multifamily or commercial category is never single-family, whatever the code looks like; other categories fall back to the text tests.
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8f", zoningCode: "R-1", zoningCategory: "multifamily" } as any))).not.toContain("ca_sb9_lot_split");
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8g", zoningCode: "R-1", zoningCategory: "commercial / mixed use" } as any))).not.toContain("ca_sb9_lot_split");
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8h", zoningCode: "R-1", zoningCategory: "other" } as any))).toContain("ca_sb9_lot_split");
    // "none": the caller knows the zone is on no single-family list (e.g. an LA County A-1 lot), so no text test rescues it.
    expect(ids(auditSingleHouseParcel({ ...base, parcelId: "p8i", zoningCode: "R-1", zoningCategory: "none" } as any))).not.toContain("ca_sb9_lot_split");
  });

  it("9. Shows no solar size, cost, savings or payback (none is sourced)", () => {
    const a = auditSingleHouseParcel({ ...BASE, parcelId: "p9", lotSqft: 6000, livingSqft: 2000, stories: 1, neighborhoodMedianHv: 850000 });
    expect(a.solarMicrogrid.federal_itc_pct_owner).toBe(0); // IRC § 25D ended after 2025
    expect(a.solarMicrogrid.dcKwCapacity).toBeNull(); // orientation and shading are not on file
    expect(a.solarMicrogrid.grossSystemCostUsd).toBeNull();
    expect(a.solarMicrogrid.paybackYearsCash).toBeNull();
    expect(a.solarMicrogrid.dollarStatus).toMatch(/Not modeled yet/);
  });

  it("10. Tree economics report the climate regime without invented dollar figures", () => {
    const mn = calculateCalibratedTreeEconomics("MN");
    expect(mn.climateRegime).toBe("heating_dominant");
    expect(mn.capitalizedValueLiftUsd).toBeNull();
    expect(mn.netAnnualSavingsUsd).toBeNull();
    const az = calculateCalibratedTreeEconomics("AZ");
    expect(az.climateRegime).toBe("arid_irrigation_limited");
    expect(az.annualUtilitySavingsUsd).toBeNull();
  });

  it("11. No longer produces EverySpace or renovation-quote outputs (engines removed: invented numbers)", () => {
    const a: any = auditSingleHouseParcel({ ...BASE, parcelId: "p11", lotSqft: 8500, livingSqft: 1950, zoningCode: "R-1", neighborhoodMedianHv: 620000, stateCode: "AZ", countyFips: "04013" });
    expect(a.everySpace).toBeUndefined();
    expect(a.renovationOptions).toBeUndefined();
  });

  it("12. Does not classify R-3, R-4, or RES-MF as single-family residential", () => {
    const r3 = auditSingleHouseParcel({ ...BASE, parcelId: "p12_r3", lotSqft: 6500, livingSqft: 1800, zoningCode: "R-3", neighborhoodMedianHv: 850000 });
    expect(r3.statutoryZoning.applicable_statutes.map((s: any) => s.id)).not.toContain("ca_sb9_lot_split");
    expect(r3.statutoryZoning.lotSplitFeasible).toBe(false);

    const r4 = auditSingleHouseParcel({ ...BASE, parcelId: "p12_r4", lotSqft: 6500, livingSqft: 1800, zoningCode: "R-4", neighborhoodMedianHv: 850000 });
    expect(r4.statutoryZoning.applicable_statutes.map((s: any) => s.id)).not.toContain("ca_sb9_lot_split");
    expect(r4.statutoryZoning.lotSplitFeasible).toBe(false);

    const resMf = auditSingleHouseParcel({ ...BASE, parcelId: "p12_mf", lotSqft: 6500, livingSqft: 1800, zoningCode: "RES-MF", neighborhoodMedianHv: 850000 });
    expect(resMf.statutoryZoning.applicable_statutes.map((s: any) => s.id)).not.toContain("ca_sb9_lot_split");
    expect(resMf.statutoryZoning.lotSplitFeasible).toBe(false);
  });
});
