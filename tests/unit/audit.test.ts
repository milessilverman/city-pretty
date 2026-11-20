import { describe, expect, it } from "vitest";
import { calculateTaxIncrementCapacity, financeProfileGate } from "../../src/engines/municipalFinanceEngine";
import { evaluateByRightHousing, ParcelContext } from "../../src/engines/statutoryZoningEngine";
import { computeSubAdditivePackage } from "../../src/engines/hedonicCapitalizationEngine";
import { calculateSolarMicrogridRoi } from "../../src/engines/solarMicrogridEngine";
import { normalizeArcGisFeature } from "../../src/adapters/arcgisNormalizer";
import { StateFinanceProfile } from "../../src/types";
import * as fs from "fs";
import * as path from "path";

// The statute engine reads app/data/statutes.json; these tests run it against the real file.
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

describe("City Pretty Multi-State & Engine Audit Regression Suite", () => {
  it("1. Texas SB 840 (2025) needs both population thresholds on file and commercial zoning", () => {
    const houstonCommercial: ParcelContext = {
      parcel_id: "48201-001",
      state_code: "TX",
      county_fips: "48201",
      municipality_pop: 2314000,
      county_pop: 4835000,
      base_zoning_code: "C-2",
      is_commercial_or_mixed_use: true,
      is_single_family_residential: false,
      dist_to_heavy_rail_mi: 0.3,
      dist_to_frequent_bus_or_brt_mi: 0.1,
      exclusions: { ...BASE_EXCLUSIONS },
    };
    const houstonRes = evaluateByRightHousing(houstonCommercial, LAWS);
    expect(houstonRes.net_by_right_feasible).toBe(true);
    const sb840 = houstonRes.applicable_statutes.find(s => s.id === "tx_sb840")!;
    expect(sb840.citation).toContain("SB 840");
    // The law caps parking at 1 space per unit; it does not set a 1-space minimum.
    expect(sb840.min_parking_spaces_per_unit).toBeNull();
    expect(sb840.max_parking_requirement_per_unit).toBe(1);

    const smallRes = evaluateByRightHousing({ ...houstonCommercial, parcel_id: "48039-002", county_fips: "48039", municipality_pop: 42000, county_pop: 388000 }, LAWS);
    expect(smallRes.net_by_right_feasible).toBe(false);
    expect(smallRes.statutory_exclusions.population_threshold_ineligible).toBe(true);

    // Unknown population: not applied, and the reason is reported instead of assumed.
    const unknownPop = evaluateByRightHousing({ ...houstonCommercial, municipality_pop: null, county_pop: null }, LAWS);
    expect(unknownPop.applicable_statutes).toEqual([]);
    expect(unknownPop.not_confirmed.map(n => n.id)).toContain("tx_sb840");
  });

  it("2. Florida Live Local: excluded in Everglades/Wekiva areas; 75% exemption read from the verified record", () => {
    const evergladesParcel: ParcelContext = {
      parcel_id: "12086-001",
      state_code: "FL",
      county_fips: "12086",
      municipality_pop: 455000,
      county_pop: 2686000,
      base_zoning_code: "BU-2",
      is_commercial_or_mixed_use: true,
      is_single_family_residential: false,
      dist_to_heavy_rail_mi: 0.4,
      dist_to_frequent_bus_or_brt_mi: 0.2,
      exclusions: { ...BASE_EXCLUSIONS, wekiva_or_everglades_protection_area: true },
    };
    expect(evaluateByRightHousing(evergladesParcel, LAWS).net_by_right_feasible).toBe(false);
    const miamiRes = evaluateByRightHousing({ ...evergladesParcel, exclusions: { ...BASE_EXCLUSIONS } }, LAWS);
    expect(miamiRes.net_by_right_feasible).toBe(true);
    const ll = miamiRes.applicable_statutes.find(s => s.id === "fl_live_local")!;
    expect(ll.tax_exemption_pct).toBe(0.75);
    // No parking minimum is stated in the statute.
    expect(ll.min_parking_spaces_per_unit).toBeNull();
  });

  it("3. California SB 79: 75 ft is a floor on local height limits, not a unit cap; HPOZ-free parcels only via the record's exclusions", () => {
    const laTransitParcel: ParcelContext = {
      parcel_id: "06037-5001",
      state_code: "CA",
      county_fips: "06037",
      municipality_pop: 3820000,
      county_pop: 9663000,
      base_zoning_code: "C2-1",
      is_commercial_or_mixed_use: true,
      is_single_family_residential: false,
      dist_to_heavy_rail_mi: 0.2,
      dist_to_frequent_bus_or_brt_mi: 0.05,
      exclusions: { ...BASE_EXCLUSIONS },
    };
    const res = evaluateByRightHousing(laTransitParcel, LAWS);
    const t1 = res.applicable_statutes.find(s => s.id === "ca_sb79_tier1")!;
    expect(t1).toBeTruthy();
    expect(t1.max_height_ft).toBe(75);
    expect(t1.min_allowed_density_du_per_acre).toBe(120);
    expect(t1.max_units_by_right).toBeNull(); // the old "120 units" cap was wrong
    // County eligibility list is from a secondary source: reported as not confirmed.
    expect(t1.unconfirmed_fields.join(" ")).toMatch(/eligible_counties/);

    const fire = evaluateByRightHousing({ ...laTransitParcel, exclusions: { ...BASE_EXCLUSIONS, calfire_or_state_vhfhsz: true } }, LAWS);
    // Very high fire zone, decided law by law from the text (docs/audit/site_exclusions/ca.json, 20 Nov 2026). Before
    // that date the engine dropped every law here. SB 79's standards section has no fire exclusion: the bar is on the
    // optional streamlined approval, and a city may exclude such sites by ordinance, so SB 79 is not confirmed (not
    // applied, not ruled out). AB 2097 was read in full and has no site exclusion, so it still applies.
    expect(fire.applicable_statutes.map(s => s.id)).not.toContain("ca_sb79_tier1");
    const nc = (fire as any).not_confirmed.find((n: any) => n.id === "ca_sb79_tier1");
    expect(nc.reason).toContain("it is in a very high fire hazard severity zone, which the law's text excludes only from the optional streamlined ministerial approval");
    expect(fire.applicable_statutes.map(s => s.id)).toContain("ca_ab2097");
    expect((fire as any).excluded_by_site).toEqual([]);
  });

  it("3b. Laws whose text could not be checked never apply; missing zoning never implies residential", () => {
    const raleigh: ParcelContext = {
      parcel_id: "37183-1", state_code: "NC", county_fips: "37183", municipality_pop: 480000, county_pop: 1200000,
      base_zoning_code: "R-4", is_commercial_or_mixed_use: false, is_single_family_residential: true,
      dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: { ...BASE_EXCLUSIONS },
    };
    const r = evaluateByRightHousing(raleigh, LAWS);
    expect(r.applicable_statutes).toEqual([]);
    expect(r.not_confirmed.map(n => n.id)).toContain("nc_raleigh_missing_middle");

    const noZoning = evaluateByRightHousing({ ...raleigh, state_code: "CA", county_fips: "06037", base_zoning_code: null }, LAWS);
    expect(noZoning.base_zoning_code).toBeNull();
    expect(noZoning.applicable_statutes).toEqual([]);
  });

  it("4. Tax-increment model refuses to compute on unconfirmed state rules, and applies confirmed ones", () => {
    const PROFILES = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/state_finance_profiles.json"), "utf-8"));
    const base = {
      baselineMarketValueUsd: 100_000_000, effectiveMillageRate: 0.01, annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.035, newConstructionAnnualUsd: 0, affordableExemptUnitsShare: 0, affordableExemptionPct: 0,
      localPledgeShare: 0.65, nonPledgeableShare: 0.47, bondTermYears: 30, bondInterestRate: 0.0525, dscr: 1.35,
    };
    // Real file: Utah's ratio was corrected, but its cap / sale rule / cycle are not confirmed, so nothing is computed.
    const ut = calculateTaxIncrementCapacity({ ...base, profile: PROFILES.UT });
    expect(ut.computed).toBe(false);
    expect(ut.maxBondCapacityUsd).toBeNull();
    expect(ut.missingFields).toEqual(expect.arrayContaining(["annual_assessment_cap", "uncaps_on_sale", "reassessment_cycle_years"]));
    expect(financeProfileGate(PROFILES.NY)).toHaveLength(5);

    // A profile whose rules are all confirmed computes; a 2% cap yields less capacity than an uncapped annual market.
    const confirmed = (o: Partial<StateFinanceProfile>): StateFinanceProfile => ({
      state_code: "XX", res_assessment_ratio: 1, comm_assessment_ratio: 1, annual_assessment_cap: null, uncaps_on_sale: true,
      reassessment_cycle_years: 1, homestead_exemption_rule: { type: "none", amount_or_pct: 0 }, tif_vehicle_name: "test",
      verification: { status: "verified", unverified_fields: [] }, ...o,
    });
    const capped = calculateTaxIncrementCapacity({ ...base, profile: confirmed({ annual_assessment_cap: 0.02 }) });
    const open = calculateTaxIncrementCapacity({ ...base, profile: confirmed({}) });
    expect(capped.computed && open.computed).toBe(true);
    expect(open.maxBondCapacityUsd).toBeGreaterThan(capped.maxBondCapacityUsd);
    // The non-pledgeable share is a caller input now (it had no source as a state-wide profile field).
    const allPledgeable = calculateTaxIncrementCapacity({ ...base, nonPledgeableShare: 0, profile: confirmed({}) });
    expect(allPledgeable.maxBondCapacityUsd).toBeGreaterThan(open.maxBondCapacityUsd);
  });

  it("5. Prevents linear stacking double-counting via the 22% suburban capitalization ceiling", () => {
    const result = computeSubAdditivePackage(
      {
        blockGroupGeoid: "060372608100",
        ecoregionId: "85b",
        medianHomeValueUsd: 900_000,
        reachedHomesCount: 400,
        isUrbanCore: false,
        renterShare: 0.65,
        severeRentBurdenShare: 0.35,
        rentControlCoverage: 0.2,
      },
      Array.from({ length: 6 }, (_, i) => ({
        id: `proj-${i}`,
        name: `Intervention ${i}`,
        evidenceGrade: "A" as const,
        rawPriceLiftPct: 0.06,
        studyStandardErrorPct: 0.015,
        lifecycleCostUsd: 500_000,
        localContextMultiplier: 1.15,
      })),
      true
    );

    expect(result.jointCapitalizationPct).toBeLessThanOrEqual(0.22);
    expect(result.displacementRiskScore).toBeGreaterThan(50);
  });

  it("6. Enforces 0% residential cash/loan federal solar ITC in 2026+ and flags NEM 3.0 battery need", () => {
    const solar2026 = calculateSolarMicrogridRoi({
      taxYear: 2026,
      stateCode: "CA",
      ownershipModel: "cash_or_loan",
      grossRoofSqft: 1400,
      lidarUnshadedUsableFraction: 0.55,
      localInstallCostPerWattUsd: 3.2,
      annualYieldKwhPerKw: 1620,
      retailImportRateUsdKwh: 0.42,
      exportRateUsdKwh: 0.055,
      selfConsumptionFraction: 0.38,
      hasBatteryStorage: false,
      batteryCostUsd: 13500,
      meets2026FeocAndPrevailingWage: false,
    });

    expect(solar2026.federal_itc_pct).toBe(0);
    expect(solar2026.net_metering_tariff).toBe("ca_nem_3_avoided_cost");
    expect(solar2026.battery_storage_required_for_roi).toBe(true);
  });

  it("7. Normalizes diverse county/parish/independent-city ArcGIS attribute schemas", () => {
    const louisianaParishRecord = normalizeArcGisFeature({
      PARCEL_ID: "22071-8892",
      SITE_ADDR: "1400 CANAL ST",
      ZONE_DIST: "CBD-5",
      ASSD_VAL: 125000,
      FULL_MKT_VAL: 1250000,
      GIS_SQFT: 8500,
    });

    expect(louisianaParishRecord.parcel_id).toBe("22071-8892");
    expect(louisianaParishRecord.assessed_total).toBe(125000);
    expect(louisianaParishRecord.market_total).toBe(1250000);
    expect(louisianaParishRecord.zoning_code).toBe("CBD-5");
  });
});
