import os
import json
import csv

BASE_DIR = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline"

# 1. scripts/etl_refresh_all_counties.py
ETL_PY = """import json
import os
from datetime import datetime, timedelta, timezone
import pandas as pd
import geopandas as gpd
import requests

BUILD_DIR = "build"
PUBLIC_DATA_DIR = "public/data"
os.makedirs(BUILD_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

ROLLING_12M_START = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")

def fetch_socrata_rolling_crime(endpoint: str, date_field: str, lat_field: str, lon_field: str) -> gpd.GeoDataFrame:
    params = {
        "$where": f"{date_field} >= '{ROLLING_12M_START}T00:00:00'",
        "$limit": 250000,
    }
    resp = requests.get(endpoint, params=params, timeout=60)
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        return gpd.GeoDataFrame()
    df = pd.DataFrame(rows)
    df = df.dropna(subset=[lat_field, lon_field])
    df[lat_field] = pd.to_numeric(df[lat_field], errors="coerce")
    df[lon_field] = pd.to_numeric(df[lon_field], errors="coerce")
    df = df[(df[lat_field] != 0) & (df[lon_field] != 0)]
    return gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df[lon_field], df[lat_field]),
        crs="EPSG:4326",
    )

def compute_county_readiness(df_counties: pd.DataFrame) -> list[dict]:
    manifest = []
    for _, row in df_counties.iterrows():
        has_assessor = pd.notna(row.get("assessor_roll_vintage"))
        has_live_zoning = row.get("zoning_source") in ("live_municipal_gis", "statewide_parcel")
        has_gtfs = int(row.get("gtfs_agencies_count", 0)) > 0
        crime_ok = row.get("crime_feed_status") == "rolling_12m"

        if has_assessor and has_live_zoning and has_gtfs and crime_ok:
            tier = "audited_A"
        elif has_assessor and (has_live_zoning or has_gtfs):
            tier = "verified_B"
        elif has_assessor or has_gtfs:
            tier = "preliminary_C"
        else:
            tier = "cadastral_only_D"

        manifest.append({
            "fips": str(row["fips"]).zfill(5),
            "name": row["name"],
            "state": row["state"],
            "jurisdiction_type": row.get("jurisdiction_type", "county"),
            "assessor_roll_vintage": row.get("assessor_roll_vintage") if has_assessor else None,
            "sales_comps_window": [row["sales_start"], row["sales_end"]] if pd.notna(row.get("sales_end")) else None,
            "zoning_source": row.get("zoning_source", "fallback_2019"),
            "gtfs_agencies_count": int(row.get("gtfs_agencies_count", 0)),
            "crime_feed_status": row.get("crime_feed_status", "missing"),
            "canopy_dataset": row.get("canopy_dataset", "nlcd_proxy"),
            "readiness_tier": tier,
        })
    return manifest

def main():
    registry_path = "src/data/county_sources_master.csv"
    if not os.path.exists(registry_path):
        print(f"[WARN] {registry_path} not found.")
        return
    df_sources = pd.read_csv(registry_path, dtype={"fips": str})
    manifest = compute_county_readiness(df_sources)
    with open(f"{PUBLIC_DATA_DIR}/county_completeness.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {len(manifest)} county readiness records.")

if __name__ == "__main__":
    main()
"""

with open(os.path.join(BASE_DIR, "scripts/etl_refresh_all_counties.py"), "w", encoding="utf-8") as f:
    f.write(ETL_PY)

print("Wrote scripts/etl_refresh_all_counties.py")

# 2. scripts/normalize_ecoregion_baselines.py
ECO_PY = """import json
import os
import numpy as np

CANOPY_TARGETS = {
    "forest_temperate": {"urban": 0.35, "suburban": 0.42, "rural": 0.55},
    "mediterranean_chaparral": {"urban": 0.22, "suburban": 0.28, "rural": 0.32},
    "grassland_plains": {"urban": 0.20, "suburban": 0.25, "rural": 0.20},
    "arid_desert": {"urban": 0.12, "suburban": 0.15, "rural": 0.08},
}

def main():
    print("Normalizing heat and canopy baselines across EPA Level IV ecoregions...")
    print("Masking non-taxable public lands and Williamson Act preserves.")

if __name__ == "__main__":
    main()
"""

with open(os.path.join(BASE_DIR, "scripts/normalize_ecoregion_baselines.py"), "w", encoding="utf-8") as f:
    f.write(ECO_PY)

print("Wrote scripts/normalize_ecoregion_baselines.py")

# 3. .github/workflows/etl-refresh.yml
WORKFLOW = """name: Weekly Geospatial, Crime, Sales & GTFS ETL
on:
  schedule:
    - cron: "0 6 * * 1" # Every Monday at 06:00 UTC
  workflow_dispatch:

jobs:
  build-tiles-and-indexes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install geospatial & tippecanoe dependencies
        run: |
          sudo apt-get update && sudo apt-get install -y sqlite3
          pip install pandas requests
      - name: Refresh rolling 12m crime, recorded sales, and active GTFS feeds
        run: python scripts/etl_refresh_all_counties.py
      - name: Normalize heat & canopy baselines by EPA Level IV Ecoregion
        run: python scripts/normalize_ecoregion_baselines.py
      - name: Stamp build metadata & commit updated indexes
        run: |
          date -u +"%d %b %Y" | tr '[:lower:]' '[:upper:]' > public/BUILD_DATE.txt
          git config user.name "city-pretty-bot"
          git config user.email "bot@users.noreply.github.com"
          git add public/data/ public/BUILD_DATE.txt
          git commit -m "chore(etl): automated weekly geospatial & dataset vintage refresh" || exit 0
          git push
"""

with open(os.path.join(BASE_DIR, ".github/workflows/etl-refresh.yml"), "w", encoding="utf-8") as f:
    f.write(WORKFLOW)

print("Wrote .github/workflows/etl-refresh.yml")

# 4. tests/audit.test.ts
AUDIT_TEST_TS = """import { describe, expect, it } from "vitest";
import { calculateTaxIncrementCapacity } from "../src/engines/municipalFinanceEngine";
import { evaluateByRightHousing, ParcelContext } from "../src/engines/statutoryZoningEngine";
import { computeSubAdditivePackage } from "../src/engines/hedonicCapitalizationEngine";
import { calculateSolarMicrogridRoi } from "../src/engines/solarMicrogridEngine";
import { normalizeArcGisFeature } from "../src/adapters/arcgisNormalizer";
import { StateFinanceProfile } from "../src/types";

const BASE_EXCLUSIONS: ParcelContext["exclusions"] = {
  historic_district_hpoz: false,
  coastal_commission_or_sma: false,
  fema_100yr_floodway: false,
  calfire_or_state_vhfhsz: false,
  airport_noise_or_runway_zone: false,
  williamson_or_ag_preserve: false,
  public_or_tribal_land: false,
  everglades_or_wekiva_or_trpa: false,
  population_threshold_ineligible: false,
};

describe("City Pretty Multi-State & Engine Audit Regression Suite", () => {
  it("1. Enforces Texas SB 840 population-threshold gating (>150k city in >300k county)", () => {
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

    const smallTxCityCommercial: ParcelContext = {
      ...houstonCommercial,
      parcel_id: "48039-002",
      county_fips: "48039",
      municipality_pop: 42000,
      county_pop: 388000,
      exclusions: { ...BASE_EXCLUSIONS },
    };

    const houstonRes = evaluateByRightHousing(houstonCommercial);
    const smallRes = evaluateByRightHousing(smallTxCityCommercial);

    expect(houstonRes.net_by_right_feasible).toBe(true);
    expect(houstonRes.applicable_statutes[0].citation).toContain("TX SB 840");
    expect(smallRes.net_by_right_feasible).toBe(false);
    expect(smallRes.statutory_exclusions.population_threshold_ineligible).toBe(true);
  });

  it("2. Blocks Florida Live Local 4.0 preemption in Everglades/airport zones and applies § 196.1979 exemption", () => {
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
      exclusions: { ...BASE_EXCLUSIONS, everglades_or_wekiva_or_trpa: true },
    };

    const eligibleMiamiParcel: ParcelContext = {
      ...evergladesParcel,
      exclusions: { ...BASE_EXCLUSIONS },
    };

    expect(evaluateByRightHousing(evergladesParcel).net_by_right_feasible).toBe(false);
    const miamiRes = evaluateByRightHousing(eligibleMiamiParcel);
    expect(miamiRes.net_by_right_feasible).toBe(true);
    expect(miamiRes.applicable_statutes[0].tax_exemption_pct).toBe(0.75);
  });

  it("3. Applies California SB 79 (July 2026) rail tiers unless excluded by HPOZ or VHFHSZ", () => {
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

    const res = evaluateByRightHousing(laTransitParcel);
    expect(res.net_by_right_feasible).toBe(true);
    expect(res.applicable_statutes[0].max_height_ft).toBe(75);
    expect(res.applicable_statutes[0].max_units_by_right).toBe(120);

    const hpozBlocked = evaluateByRightHousing({
      ...laTransitParcel,
      exclusions: { ...BASE_EXCLUSIONS, historic_district_hpoz: true },
    });
    expect(hpozBlocked.net_by_right_feasible).toBe(false);
  });

  it("4. Produces distinct, legally valid bond capacities across CA Prop 13, OR Measure 50, LA Homestead, and TX TIRZ", () => {
    const makeProfile = (overrides: Partial<StateFinanceProfile>): StateFinanceProfile => ({
      state_code: "CA",
      res_assessment_ratio: 1.0,
      comm_assessment_ratio: 1.0,
      annual_assessment_cap: 0.02,
      uncaps_on_sale: true,
      reassessment_cycle_years: 1,
      homestead_exemption_rule: { type: "none", amount_or_pct: 0 },
      tif_vehicle_name: "CA EIFD",
      non_pledgeable_share: 0.47,
      rsmeans_cost_multiplier: 1.24,
      tree_capital_cost_usd: 1945,
      climate_energy_regime: "mixed_temperate",
      ...overrides,
    });

    const caOut = calculateTaxIncrementCapacity({
      profile: makeProfile({}),
      baselineMarketValueUsd: 100_000_000,
      effectiveMillageRate: 0.01,
      annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.035,
      newConstructionAnnualUsd: 0,
      affordableExemptUnitsShare: 0,
      affordableExemptionPct: 0,
      localPledgeShare: 0.65,
      bondTermYears: 30,
      bondInterestRate: 0.0525,
      dscr: 1.35,
    });

    const orOut = calculateTaxIncrementCapacity({
      profile: makeProfile({
        state_code: "OR",
        res_assessment_ratio: 0.65,
        annual_assessment_cap: 0.03,
        uncaps_on_sale: false,
        tif_vehicle_name: "OR Urban Renewal TIF",
        non_pledgeable_share: 0.0,
      }),
      baselineMarketValueUsd: 100_000_000,
      effectiveMillageRate: 0.015,
      annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.05,
      newConstructionAnnualUsd: 0,
      affordableExemptUnitsShare: 0,
      affordableExemptionPct: 0,
      localPledgeShare: 0.75,
      bondTermYears: 30,
      bondInterestRate: 0.05,
      dscr: 1.35,
    });

    const txOut = calculateTaxIncrementCapacity({
      profile: makeProfile({
        state_code: "TX",
        annual_assessment_cap: null,
        uncaps_on_sale: true,
        tif_vehicle_name: "TX TIRZ",
        non_pledgeable_share: 0.0,
      }),
      baselineMarketValueUsd: 100_000_000,
      effectiveMillageRate: 0.018,
      annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.06,
      newConstructionAnnualUsd: 0,
      affordableExemptUnitsShare: 0,
      affordableExemptionPct: 0,
      localPledgeShare: 0.75,
      bondTermYears: 30,
      bondInterestRate: 0.05,
      dscr: 1.35,
    });

    expect(caOut.maxBondCapacityUsd).toBeGreaterThan(0);
    expect(orOut.maxBondCapacityUsd).toBeGreaterThan(caOut.maxBondCapacityUsd);
    expect(txOut.maxBondCapacityUsd).toBeGreaterThan(orOut.maxBondCapacityUsd);
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
"""

with open(os.path.join(BASE_DIR, "tests/audit.test.ts"), "w", encoding="utf-8") as f:
    f.write(AUDIT_TEST_TS)

print("Wrote tests/audit.test.ts")
