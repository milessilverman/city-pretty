import { describe, it, expect } from "vitest";
import {
  buildGroundedAdvisorPrompt,
  serializeLiveAdvisorContext,
  AdvisorContextPayload,
} from "../src/ai/advisorGroundingContract";

describe("City Pretty AI Advisor Grounding Contract", () => {
  it("builds anti-hallucination system prompt with verified parcel context", () => {
    const mockPayload: AdvisorContextPayload = {
      county: {
        fips: "06037",
        name: "Los Angeles County",
        state: "CA",
        jurisdiction_type: "county",
        assessor_roll_vintage: "2026-09-17",
        sales_comps_window: ["2022-08-01", "2026-10-31"],
        zoning_source: "live_municipal_gis",
        gtfs_agencies_count: 19,
        crime_feed_status: "rolling_12m",
        canopy_dataset: "tree_equity_2025",
        readiness_tier: "audited_A",
      },
      parcel: {
        parcelId: "5408-012-015",
        address: "1234 Echo Park Ave, Los Angeles, CA",
        county: "Los Angeles County",
        state: "CA",
        lotSqft: 6500,
        livingSqft: 1800,
        yearBuilt: 1952,
        effectiveYearBuilt: 2024,
        bedrooms: 3,
        bathrooms: 2,
        stories: 1,
        units: 1,
        isVacantLand: false,
        zoningCode: "RD1.5-1",
        useDescription: "Single Family Residence",
        avmValuation: {
          estimatedValue: 1180000,
          valueLow: 1100000,
          valueHigh: 1260000,
          vpsf: 656,
          valuationMethod: "Multi-Model Hedonic + Assessor Calibration",
          confidenceMarginPct: 0.065,
          permitCapitalizationAdded: 51000,
          luxuryDampeningApplied: false,
        },
        recentPermits: [
          {
            issue_date: "2024-04-12",
            permit_type: "remodel",
            valuation_usd: 60000,
            description: "Permitted kitchen and bathroom remodel",
          },
        ],
        imagery: {
          confidenceBadge: "stale_imagery_permit_override",
          isLidarStale: true,
          isStreetViewStale: true,
          warningMessage: "Building permit post-dates remote imagery",
        },
        statutoryExclusions: {
          historic_district_hpoz: true,
          coastal_commission_or_sma: false,
          fema_100yr_floodway: false,
          calfire_or_state_vhfhsz: false,
        },
        solar: {
          system_size_dc_kw: 6.8,
          federal_itc_pct: 0,
          battery_storage_required: true,
          net_25yr_npv_usd: 24500,
        },
        treeEconomics: {
          annualCoolingOrHeatingSavingsUsd: 140,
          capitalizedValueUsd: 7130,
          climateRegime: "cooling_dominant",
        },
        playbookRecommendation: {
          strategyTitle: "Detached 2-Bedroom Infill ADU",
          badge: "Highest Net Equity Strategy",
          netEquityLift: 285000,
          roiPerDollar: 2.15,
          statutoryPathway: "California Gov. Code § 66314 (AB 2097 zero-parking)",
          annualCashflow: 32400,
          paybackYears: 4.8,
        },
      },
    };

    const { systemPrompt, userPrompt } = buildGroundedAdvisorPrompt(
      "Can I split this lot and build an ADU without parking?",
      mockPayload
    );

    // 1. Anti-hallucination directive
    expect(systemPrompt).toContain("STRICT GROUNDING & ANTI-HALLUCINATION RULES");
    expect(systemPrompt).toContain("Cite ONLY numbers, property attributes, valuations");

    // 2. Readiness tier & statutory exclusions warning
    expect(systemPrompt).toContain('Active jurisdiction readiness tier is "audited_A"');
    expect(systemPrompt).toContain("CRITICAL STATUTORY OVERLAYS DETECTED: [historic_district_hpoz]");

    // 3. 2026 Solar rule enforcement
    expect(systemPrompt).toContain("IRC § 25D expired on Dec 31, 2025");
    expect(systemPrompt).toContain("NEM 3.0 avoided-cost export tariffs require paired battery storage");

    // 4. Mandatory institutional closing notice
    expect(systemPrompt).toContain("LEGAL & ENGINEERING NON-RELIANCE NOTICE");

    // 5. User prompt contains structured JSON context
    expect(userPrompt).toContain("VERIFIED GEOSPATIAL & STATUTORY CONTEXT (JSON):");
    expect(userPrompt).toContain("1234 Echo Park Ave");
    expect(userPrompt).toContain("1180000");
    expect(userPrompt).toContain("USER QUESTION: Can I split this lot and build an ADU without parking?");
  });

  it("serializes live browser context into complete AdvisorContextPayload", () => {
    const mockEnv = {
      activeFips: () => "06037",
      activeState: () => "CA",
      countyOf: () => "Los Angeles County",
      getRoiMode: () => "adj",
      COUNTY_COMPLETENESS_INDEX: {
        "06037": {
          fips: "06037",
          name: "Los Angeles County",
          state: "CA",
          jurisdiction_type: "county",
          assessor_roll_vintage: "2026 Secured Roll",
          sales_comps_window: ["2022-08-01", "2026-10-31"],
          zoning_source: "live_municipal_gis",
          gtfs_agencies_count: 19,
          crime_feed_status: "rolling_12m",
          canopy_dataset: "tree_equity_2025",
          readiness_tier: "audited_A",
        },
      },
      selected: "060372044201",
      byId: {
        get: (id: string) => ({
          properties: {
            n: "Boyle Heights",
            c: "Los Angeles",
            hv: 650000,
            rent: 2200,
            rent_risk: 78,
          },
        }),
      },
      activeHouse: {
        a: {
          AIN: "5408012015",
          APN: "5408-012-015",
          SitusFullAddress: "1234 ECHO PARK AVE",
          county: "Los Angeles",
          ZoneCode: "RD1.5-1",
          UseDescription: "Single Family Residence",
        },
        lot: 6500,
        ll: { lat: 34.078, lng: -118.26 },
        F: {
          bldg: 1800,
          yb: 1952,
          eff: 2024,
          beds: 3,
          baths: 2,
          stories: 1,
          units: 1,
        },
        valuation: {
          estimatedValue: 1180000,
          valueLow: 1100000,
          valueHigh: 1260000,
          vpsf: 656,
          valuationMethod: "Hedonic Micro-Model",
          confidenceMarginPct: 0.065,
          permitCapitalizationAdded: 51000,
          luxuryDampeningApplied: false,
        },
        audit: {
          imagery: {
            confidenceBadge: "verified_current",
            isLidarStale: false,
            isStreetViewStale: false,
            warningMessage: null,
          },
          statutoryZoning: {
            statutory_exclusions: {
              historic_district_hpoz: false,
              coastal_commission_or_sma: false,
              fema_100yr_floodway: false,
              calfire_or_state_vhfhsz: false,
            },
          },
          solarMicrogrid: {
            system_size_dc_kw: 6.8,
            federal_itc_pct: 0,
            battery_storage_required_for_roi: true,
            net_25yr_npv_usd: 24500,
          },
          treeEconomics: {
            annualCoolingOrHeatingSavingsUsd: 140,
            capitalizedValueUsd: 7130,
            climateRegime: "cooling_dominant",
          },
        },
        recentPermits: [
          {
            issue_date: "2024-04-12",
            permit_type: "remodel",
            valuation_usd: 60000,
            description: "Permitted kitchen and bathroom remodel",
          },
        ],
      },
      findNearestTransitStation: (lat: number, lng: number) => ({
        name: "Echo Park / Sunset Metro Hub",
        distMi: 0.32,
      }),
    };

    const payload = serializeLiveAdvisorContext(mockEnv);

    expect(payload.county.fips).toBe("06037");
    expect(payload.blockGroupGeoid).toBe("060372044201");
    expect(payload.neighborhoodName).toBe("Boyle Heights");
    expect(payload.displacementRiskScore).toBe(78);
    expect(payload.parcel).toBeDefined();
    expect(payload.parcel!.parcelId).toBe("5408012015");
    expect(payload.parcel!.avmValuation.estimatedValue).toBe(1180000);
    expect(payload.parcel!.avmValuation.permitCapitalizationAdded).toBe(51000);
    expect(payload.nearestTransit).toBeDefined();
    expect(payload.nearestTransit!.inWalkshed).toBe(true);
    expect(payload.nearestTransit!.ab2097ParkingExempt).toBe(true);
  });
});
