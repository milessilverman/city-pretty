import { describe, expect, it } from "vitest";
import {
  auditSingleHouseParcel,
  getHighValueSaturationMultiplier,
  calculatePermitCapitalization,
  calculateCalibratedTreeEconomics,
  HouseParcelAuditInput,
} from "../src/engines/parcelHouseAuditor";

describe("Parcel House Auditor Unit Tests", () => {
  it("1. Capitalizes permitted additions/remodels at +85%", () => {
    const permits = [
      {
        issue_date: "2024-05-10",
        permit_type: "remodel" as const,
        valuation_usd: 80000,
        description: "Permitted master suite remodel and kitchen expansion",
      },
      {
        issue_date: "2024-09-15",
        permit_type: "seismic" as const,
        valuation_usd: 9500,
        description: "Seismic foundation bolting",
      },
    ];
    const cap = calculatePermitCapitalization(permits);
    // 80,000 * 0.85 = 68,000 + 9,500 = 77,500
    expect(cap).toBe(77500);

    const audit = auditSingleHouseParcel({
      parcelId: "06037-12345",
      address: "1234 Maple St, Pasadena, CA",
      lat: 34.1478,
      lng: -118.1445,
      lotSqft: 6500,
      livingSqft: 1800,
      yearBuilt: 1965,
      bedrooms: 3,
      bathrooms: 2,
      stories: 1,
      neighborhoodMedianHv: 950000,
      stateCode: "CA",
      countyFips: "06037",
      recentPermits: permits,
    });

    expect(audit.valuation.permitCapitalizationAdded).toBe(77500);
    expect(audit.valuation.estimatedValue).toBeGreaterThan(900000);
  });

  it("2. Applies high-value saturation dampening on $2.5M+ luxury parcels", () => {
    expect(getHighValueSaturationMultiplier(1800000)).toBe(1.0);
    expect(getHighValueSaturationMultiplier(2500000)).toBe(1.0);

    const mult5M = getHighValueSaturationMultiplier(5000000);
    expect(mult5M).toBeLessThan(1.0);
    expect(mult5M).toBeGreaterThan(0.70);

    const auditLuxury = auditSingleHouseParcel({
      parcelId: "06037-BEVERLY",
      address: "700 Foothill Rd, Beverly Hills, CA",
      lat: 34.08,
      lng: -118.40,
      lotSqft: 18000,
      livingSqft: 4800,
      yearBuilt: 1998,
      neighborhoodMedianHv: 3800000,
      stateCode: "CA",
      countyFips: "06037",
    });

    expect(auditLuxury.valuation.luxuryDampeningApplied).toBe(true);
    expect(auditLuxury.valuation.luxurySaturationMultiplier).toBeLessThan(1.0);
  });

  it("3. Validates LiDAR & Street View vintage against post-construction permits", () => {
    const auditStale = auditSingleHouseParcel({
      parcelId: "06037-STALE",
      lat: 34.05,
      lng: -118.25,
      lotSqft: 6000,
      neighborhoodMedianHv: 750000,
      stateCode: "CA",
      countyFips: "06037",
      imageryInfo: {
        lidarYear: 2020,
        streetViewDate: "2021-06",
        hasStreetView: true,
      },
      recentPermits: [
        {
          issue_date: "2024-03-12",
          permit_type: "addition",
          valuation_usd: 120000,
          description: "Second story addition",
        },
      ],
    });

    expect(auditStale.imagery.confidenceBadge).toBe("stale_imagery_permit_override");
    expect(auditStale.imagery.warningMessage).toContain("Building permit (2024-03");

    // Missing Street View handling (rural/gated/flag lot)
    const auditRural = auditSingleHouseParcel({
      parcelId: "06003-ALPINE",
      lat: 38.6,
      lng: -119.8,
      lotSqft: 25000,
      neighborhoodMedianHv: 550000,
      stateCode: "CA",
      countyFips: "06003",
      imageryInfo: {
        lidarYear: 2021,
        streetViewDate: null,
        hasStreetView: false,
      },
    });

    expect(auditRural.imagery.confidenceBadge).toBe("no_street_view_fallback");
    expect(auditRural.imagery.warningMessage).toContain("Google Street View coverage is unavailable");
  });

  it("4. Enforces deterministic legal exclusion mask and middle-housing enactments", () => {
    const auditHpoz = auditSingleHouseParcel({
      parcelId: "06037-HPOZ",
      lat: 34.04,
      lng: -118.31,
      lotSqft: 7500,
      neighborhoodMedianHv: 1100000,
      stateCode: "CA",
      countyFips: "06037",
      exclusions: {
        historic_district_hpoz: true,
      },
    });

    expect(auditHpoz.statutoryZoning.statutory_exclusions.historic_district_hpoz).toBe(true);
    expect(auditHpoz.statutoryZoning.lotSplitFeasible).toBe(false);

    // Private covenants disclaimer present
    expect(auditHpoz.statutoryZoning.privateCovenantsDisclaimer).toContain("NOTICE ON PRIVATE COVENANTS");
  });

  it("5. Complies with 2026 Solar ITC expiration (0% § 25D) & CA NEM 3.0 paired battery", () => {
    const auditSolarCa = auditSingleHouseParcel({
      parcelId: "06037-SOLAR",
      lat: 34.05,
      lng: -118.25,
      lotSqft: 6000,
      livingSqft: 2000,
      stories: 1,
      neighborhoodMedianHv: 850000,
      stateCode: "CA",
      countyFips: "06037",
    });

    expect(auditSolarCa.solarMicrogrid.tax_year).toBe(2026);
    expect(auditSolarCa.solarMicrogrid.federal_itc_pct).toBe(0.0); // 0% cash under expired § 25D
    expect(auditSolarCa.solarMicrogrid.net_metering_tariff).toBe("ca_nem_3_avoided_cost");
    expect(auditSolarCa.solarMicrogrid.battery_storage_required_for_roi).toBe(true);
  });

  it("6. Calibrates street tree economics across diverse climate regimes", () => {
    // Heating-dominant (Minnesota)
    const mnTree = calculateCalibratedTreeEconomics("MN", 350000, 1.05);
    expect(mnTree.climateRegime).toBe("heating_dominant");
    expect(mnTree.annualIrrigationCostUsd).toBe(0);
    expect(mnTree.utilityBenefitDescription).toContain("windbreak");

    // Arid / Desert (Arizona)
    const azTree = calculateCalibratedTreeEconomics("AZ", 450000, 1.02);
    expect(azTree.climateRegime).toBe("arid_irrigation_limited");
    expect(azTree.annualUtilitySavingsUsd).toBe(220);
    expect(azTree.annualIrrigationCostUsd).toBe(45);
    expect(azTree.netAnnualSavingsUsd).toBe(175);
  });
});
