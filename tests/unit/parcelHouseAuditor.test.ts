import { describe, expect, it } from "vitest";
import {
  auditSingleHouseParcel,
  calculatePermitCapitalization,
  calculateCalibratedTreeEconomics,
} from "../../src/engines/parcelHouseAuditor";
import { estimatePropertyMarketValue } from "../../src/engines/propertyValuationEngine";

// These tests pin the honest behavior adopted on 2026-11-16: values come only from records on file, invented
// constants are gone, and anything that cannot be sourced is null with a reason.

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

  it("2b. LA: the generic estimate failed its back-test, so this engine withholds it and says why", () => {
    const a = auditSingleHouseParcel({ ...BASE, parcelId: "p2b", lotSqft: 6000, livingSqft: 1600, neighborhoodMedianHv: 800000 });
    expect(a.valuation.estimatedValue).toBeNull();
    expect(a.valuation.withheldReason).toMatch(/failed its back-test/);
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
    const ok = auditSingleHouseParcel({ ...BASE, parcelId: "p8", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000 });
    expect(ok.statutoryZoning.applicable_statutes.map((s: any) => s.id)).toContain("ca_sb9_lot_split");
    expect(ok.statutoryZoning.lotSplitFeasible).toBe(true);

    const hpoz = auditSingleHouseParcel({ ...BASE, parcelId: "p8b", lotSqft: 7500, livingSqft: 1800, zoningCode: "R-1", neighborhoodMedianHv: 850000, exclusions: { historic_district_hpoz: true } });
    expect(hpoz.statutoryZoning.lotSplitFeasible).toBe(false);
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
});
