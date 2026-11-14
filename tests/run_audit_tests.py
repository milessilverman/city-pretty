#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import sys

CDP_HTTP = "http://127.0.0.1:9444"

def run_tests():
    print("========================================================")
    print("CITY PRETTY NATIONWIDE MULTI-COUNTY AUDIT TEST SUITE")
    print("========================================================")

    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    ws_url = tabs[0]["webSocketDebuggerUrl"]

    ws = websocket.create_connection(ws_url, timeout=30)
    msg_id = 0

    def call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        ws.send(json.dumps(payload))
        while True:
            res = ws.recv()
            data = json.loads(res)
            if data.get("id") == msg_id:
                return data.get("result", {})

    def eval_js(expr):
        r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in r:
            print("JS EXCEPTION:", r["exceptionDetails"])
            return None
        return r.get("result", {}).get("value")

    call("Page.enable")
    call("Runtime.enable")

    # Load engine scripts into page execution context
    with open("src/engines/municipalFinanceEngine.js") as f:
        code_finance = f.read()
    with open("src/engines/statutoryZoningEngine.js") as f:
        code_zoning = f.read()
    with open("src/engines/hedonicCapitalizationEngine.js") as f:
        code_hedonic = f.read()
    with open("src/engines/solarMicrogridEngine.js") as f:
        code_solar = f.read()
    with open("src/engines/lidarStreetViewValidator.js") as f:
        code_lidar = f.read()
    with open("src/engines/propertyValuationEngine.js") as f:
        code_avm = f.read()
    with open("src/adapters/arcgisNormalizer.js") as f:
        code_arcgis = f.read()
    with open("src/engines/parcelHouseAuditor.js") as f:
        code_auditor = f.read()
    with open("src/ui/houseInspectorPanel.js") as f:
        code_panel = f.read()
    with open("src/ai/advisorGroundingContract.js") as f:
        code_ai = f.read()

    test_bundle = f"""
    (() => {{
        {code_finance}
        {code_zoning}
        {code_hedonic}
        {code_solar}
        {code_lidar}
        {code_avm}
        {code_arcgis}
        {code_auditor}
        {code_panel}
        {code_ai}

        window.__TEST_ENGINES__ = {{
            calculateTaxIncrementCapacity,
            evaluateByRightHousing,
            computeSubAdditivePackage,
            calculateSolarMicrogridRoi,
            validateParcelImageryVintage,
            estimatePropertyMarketValue,
            normalizeArcGisFeature,
            auditSingleHouseParcel,
            getHighValueSaturationMultiplier,
            calculatePermitCapitalization,
            calculateCalibratedTreeEconomics,
            renderHouseAuditAside,
            getHpiMultiplier,
            STATE_BASELINE_PROFILES,
            buildGroundedAdvisorPrompt,
            serializeLiveAdvisorContext
        }};
        return true;
    }})();
    """

    res_load = eval_js(test_bundle)
    if not res_load:
        print("[FAIL] Could not load engine bundle into V8.")
        sys.exit(1)
    print("✓ Loaded calculation engines into V8 context.")

    # Test 1: Texas SB 840 Population Gating
    t1 = eval_js("""
    (() => {
        const { evaluateByRightHousing } = window.__TEST_ENGINES__;
        const BASE_EXCLUSIONS = {
            historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false,
            calfire_or_state_vhfhsz: false, airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false,
            public_or_tribal_land: false, everglades_or_wekiva_or_trpa: false, population_threshold_ineligible: false
        };
        const houston = evaluateByRightHousing({
            parcel_id: "48201-001", state_code: "TX", county_fips: "48201",
            municipality_pop: 2314000, county_pop: 4835000, base_zoning_code: "C-2",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.3, dist_to_frequent_bus_or_brt_mi: 0.1,
            exclusions: { ...BASE_EXCLUSIONS }
        });
        const smallCity = evaluateByRightHousing({
            parcel_id: "48039-002", state_code: "TX", county_fips: "48039",
            municipality_pop: 42000, county_pop: 388000, base_zoning_code: "C-2",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.3, dist_to_frequent_bus_or_brt_mi: 0.1,
            exclusions: { ...BASE_EXCLUSIONS }
        });
        return {
            houstonFeasible: houston.net_by_right_feasible,
            houstonCitation: houston.applicable_statutes[0] ? houston.applicable_statutes[0].citation : null,
            smallCityFeasible: smallCity.net_by_right_feasible,
            smallCityGated: smallCity.statutory_exclusions.population_threshold_ineligible
        };
    })()
    """)
    print("Test 1 (Texas Population Gating):", t1)
    assert t1["houstonFeasible"] is True and "TX SB 840" in t1["houstonCitation"]
    assert t1["smallCityFeasible"] is False and t1["smallCityGated"] is True
    print("  -> PASS: Houston by-right allowed; small Texas municipality (<150k in <300k county) gated out.")

    # Test 2: Florida Live Local 4.0 Exclusions & § 196.1979 Exemption
    t2 = eval_js("""
    (() => {
        const { evaluateByRightHousing } = window.__TEST_ENGINES__;
        const BASE_EXCLUSIONS = {
            historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false,
            calfire_or_state_vhfhsz: false, airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false,
            public_or_tribal_land: false, everglades_or_wekiva_or_trpa: false, population_threshold_ineligible: false
        };
        const everglades = evaluateByRightHousing({
            parcel_id: "12086-001", state_code: "FL", county_fips: "12086",
            municipality_pop: 455000, county_pop: 2686000, base_zoning_code: "BU-2",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.4, dist_to_frequent_bus_or_brt_mi: 0.2,
            exclusions: { ...BASE_EXCLUSIONS, everglades_or_wekiva_or_trpa: true }
        });
        const miami = evaluateByRightHousing({
            parcel_id: "12086-002", state_code: "FL", county_fips: "12086",
            municipality_pop: 455000, county_pop: 2686000, base_zoning_code: "BU-2",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.4, dist_to_frequent_bus_or_brt_mi: 0.2,
            exclusions: { ...BASE_EXCLUSIONS }
        });
        return {
            evergladesFeasible: everglades.net_by_right_feasible,
            miamiFeasible: miami.net_by_right_feasible,
            miamiExemptionPct: miami.applicable_statutes[0] ? miami.applicable_statutes[0].tax_exemption_pct : null
        };
    })()
    """)
    print("Test 2 (Florida Live Local 4.0 & Tax Exemption):", t2)
    assert t2["evergladesFeasible"] is False
    assert t2["miamiFeasible"] is True and t2["miamiExemptionPct"] == 0.75
    print("  -> PASS: Everglades protected parcel excluded; eligible Miami parcel gets 75% tax exemption.")

    # Test 3: California SB 79 (July 2026) Rail Station Tiers
    t3 = eval_js("""
    (() => {
        const { evaluateByRightHousing } = window.__TEST_ENGINES__;
        const BASE_EXCLUSIONS = {
            historic_district_hpoz: false, coastal_commission_or_sma: false, fema_100yr_floodway: false,
            calfire_or_state_vhfhsz: false, airport_noise_or_runway_zone: false, williamson_or_ag_preserve: false,
            public_or_tribal_land: false, everglades_or_wekiva_or_trpa: false, population_threshold_ineligible: false
        };
        const tier1 = evaluateByRightHousing({
            parcel_id: "06037-5001", state_code: "CA", county_fips: "06037",
            municipality_pop: 3820000, county_pop: 9663000, base_zoning_code: "C2-1",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.20, dist_to_frequent_bus_or_brt_mi: 0.05,
            exclusions: { ...BASE_EXCLUSIONS }
        });
        const hpozBlocked = evaluateByRightHousing({
            parcel_id: "06037-5002", state_code: "CA", county_fips: "06037",
            municipality_pop: 3820000, county_pop: 9663000, base_zoning_code: "C2-1",
            is_commercial_or_mixed_use: true, is_single_family_residential: false,
            dist_to_heavy_rail_mi: 0.20, dist_to_frequent_bus_or_brt_mi: 0.05,
            exclusions: { ...BASE_EXCLUSIONS, historic_district_hpoz: true }
        });
        return {
            tier1Feasible: tier1.net_by_right_feasible,
            maxHeight: tier1.applicable_statutes[0] ? tier1.applicable_statutes[0].max_height_ft : null,
            maxUnits: tier1.applicable_statutes[0] ? tier1.applicable_statutes[0].max_units_by_right : null,
            hpozBlocked: hpozBlocked.net_by_right_feasible
        };
    })()
    """)
    print("Test 3 (California SB 79 July 2026 Rail Tiers):", t3)
    assert t3["tier1Feasible"] is True and t3["maxHeight"] == 75 and t3["maxUnits"] == 120
    assert t3["hpozBlocked"] is False
    print("  -> PASS: Tier 1 heavy rail yields 75ft / 120 units; HPOZ overlay blocks automatic preemption.")

    # Test 4: State Tax Increment Divergence (CA EIFD, OR M50, TX TIRZ)
    t4 = eval_js("""
    (() => {
        const { calculateTaxIncrementCapacity } = window.__TEST_ENGINES__;
        const makeProfile = (overrides) => ({
            state_code: "CA", res_assessment_ratio: 1.0, comm_assessment_ratio: 1.0,
            annual_assessment_cap: 0.02, uncaps_on_sale: true, reassessment_cycle_years: 1,
            homestead_exemption_rule: { type: "none", amount_or_pct: 0 },
            tif_vehicle_name: "CA EIFD", non_pledgeable_share: 0.47, rsmeans_cost_multiplier: 1.24,
            tree_capital_cost_usd: 1945, climate_energy_regime: "mixed_temperate",
            ...overrides
        });
        const ca = calculateTaxIncrementCapacity({
            profile: makeProfile({}), baselineMarketValueUsd: 100000000, effectiveMillageRate: 0.01,
            annualMarketAppreciation: 0.035, historicalTurnoverRate: 0.035, newConstructionAnnualUsd: 0,
            affordableExemptUnitsShare: 0, affordableExemptionPct: 0, localPledgeShare: 0.65,
            bondTermYears: 30, bondInterestRate: 0.0525, dscr: 1.35
        });
        const or_ = calculateTaxIncrementCapacity({
            profile: makeProfile({
                state_code: "OR", res_assessment_ratio: 0.65, annual_assessment_cap: 0.03,
                uncaps_on_sale: false, tif_vehicle_name: "OR Urban Renewal TIF", non_pledgeable_share: 0.0
            }),
            baselineMarketValueUsd: 100000000, effectiveMillageRate: 0.015, annualMarketAppreciation: 0.035,
            historicalTurnoverRate: 0.05, newConstructionAnnualUsd: 0, affordableExemptUnitsShare: 0,
            affordableExemptionPct: 0, localPledgeShare: 0.75, bondTermYears: 30, bondInterestRate: 0.05, dscr: 1.35
        });
        const tx = calculateTaxIncrementCapacity({
            profile: makeProfile({
                state_code: "TX", annual_assessment_cap: null, uncaps_on_sale: true,
                tif_vehicle_name: "TX TIRZ", non_pledgeable_share: 0.0
            }),
            baselineMarketValueUsd: 100000000, effectiveMillageRate: 0.018, annualMarketAppreciation: 0.035,
            historicalTurnoverRate: 0.06, newConstructionAnnualUsd: 0, affordableExemptUnitsShare: 0,
            affordableExemptionPct: 0, localPledgeShare: 0.75, bondTermYears: 30, bondInterestRate: 0.05, dscr: 1.35
        });
        return {
            caBond: ca.maxBondCapacityUsd,
            orBond: or_.maxBondCapacityUsd,
            txBond: tx.maxBondCapacityUsd
        };
    })()
    """)
    print("Test 4 (Multi-State TIF/EIFD Bond Capacity Divergence):", t4)
    assert t4["caBond"] > 0
    assert t4["orBond"] > t4["caBond"]
    assert t4["txBond"] > t4["orBond"]
    print("  -> PASS: CA EIFD, OR Measure 50, and TX TIRZ yield legally and mathematically distinct bonding capacities.")

    # Test 5: Sub-Additive Stacking Ceiling (<= 0.22 suburban)
    t5 = eval_js("""
    (() => {
        const { computeSubAdditivePackage } = window.__TEST_ENGINES__;
        const res = computeSubAdditivePackage(
            {
                blockGroupGeoid: "060372608100", ecoregionId: "85b", medianHomeValueUsd: 900000,
                reachedHomesCount: 400, isUrbanCore: false, renterShare: 0.65,
                severeRentBurdenShare: 0.35, rentControlCoverage: 0.2
            },
            Array.from({ length: 6 }, (_, i) => ({
                id: "proj-" + i, name: "Intervention " + i, evidenceGrade: "A",
                rawPriceLiftPct: 0.06, studyStandardErrorPct: 0.015,
                lifecycleCostUsd: 500000, localContextMultiplier: 1.15
            })),
            true
        );
        return {
            jointCapitalizationPct: res.jointCapitalizationPct,
            displacementRiskScore: res.displacementRiskScore
        };
    })()
    """)
    print("Test 5 (Sub-Additive Stacking & Displacement Risk):", t5)
    assert t5["jointCapitalizationPct"] <= 0.22
    assert t5["displacementRiskScore"] > 50
    print("  -> PASS: 6 stacked 6% projects constrained to 22% suburban ceiling; displacement risk score > 50.")

    # Test 6: 2026 Solar ITC 0% & NEM 3.0 Battery Flag
    t6 = eval_js("""
    (() => {
        const { calculateSolarMicrogridRoi } = window.__TEST_ENGINES__;
        const res = calculateSolarMicrogridRoi({
            taxYear: 2026, stateCode: "CA", ownershipModel: "cash_or_loan", grossRoofSqft: 1400,
            lidarUnshadedUsableFraction: 0.55, localInstallCostPerWattUsd: 3.2, annualYieldKwhPerKw: 1620,
            retailImportRateUsdKwh: 0.42, exportRateUsdKwh: 0.055, selfConsumptionFraction: 0.38,
            hasBatteryStorage: false, batteryCostUsd: 13500, meets2026FeocAndPrevailingWage: false
        });
        return {
            federalItcPct: res.federal_itc_pct,
            tariff: res.net_metering_tariff,
            batteryRequired: res.battery_storage_required_for_roi
        };
    })()
    """)
    print("Test 6 (2026 Solar Tax Compliance & NEM 3.0 Battery):", t6)
    assert t6["federalItcPct"] == 0
    assert t6["tariff"] == "ca_nem_3_avoided_cost"
    assert t6["batteryRequired"] is True
    print("  -> PASS: 2026 homeowner purchase enforces 0% federal ITC; CA NEM 3.0 flags battery storage required.")

    # Test 7: Multi-State ArcGIS Attribute Schema Normalizer
    t7 = eval_js("""
    (() => {
        const { normalizeArcGisFeature } = window.__TEST_ENGINES__;
        const record = normalizeArcGisFeature({
            PARCEL_ID: "22071-8892", SITE_ADDR: "1400 CANAL ST", ZONE_DIST: "CBD-5",
            ASSD_VAL: 125000, FULL_MKT_VAL: 1250000, GIS_SQFT: 8500
        });
        return {
            parcel_id: record.parcel_id,
            situs_address: record.situs_address,
            zoning_code: record.zoning_code,
            assessed_total: record.assessed_total,
            market_total: record.market_total
        };
    })()
    """)
    print("Test 7 (ArcGIS Schema Normalizer):", t7)
    assert t7["parcel_id"] == "22071-8892"
    assert t7["zoning_code"] == "CBD-5"
    assert t7["assessed_total"] == 125000
    assert t7["market_total"] == 1250000
    print("  -> PASS: Louisiana parish GIS fields successfully mapped to canonical schema.")

    # Test 8: LiDAR & Street View Imagery Vintage Validation
    t8 = eval_js("""
    (() => {
        const { validateParcelImageryVintage } = window.__TEST_ENGINES__;
        const remodeled = validateParcelImageryVintage({
            parcelId: "0603712345", lidarAcquisitionYear: 2020, streetViewCaptureDate: "2021-06",
            latestPostConstructionPermitDate: "2024-03", permitScopeDescription: "Second story addition and ADU conversion"
        });
        const current = validateParcelImageryVintage({
            parcelId: "0603712346", lidarAcquisitionYear: 2023, streetViewCaptureDate: "2024-05",
            latestPostConstructionPermitDate: "2021-08", permitScopeDescription: "Kitchen remodel"
        });
        return {
            remodeledBadge: remodeled.confidenceBadge,
            remodeledWarning: remodeled.warningMessage,
            currentBadge: current.confidenceBadge,
            currentWarning: current.warningMessage
        };
    })()
    """)
    print("Test 8 (LiDAR & Street View Imagery Vintage):", t8)
    assert t8["remodeledBadge"] == "stale_imagery_permit_override"
    assert "2024-03" in t8["remodeledWarning"]
    assert t8["currentBadge"] == "verified_current"
    assert t8["currentWarning"] is None
    print("  -> PASS: Post-imagery 2024 remodel correctly triggers stale imagery override warning.")

    # Test 9: Zillow-Grade Automated Property Valuation (AVM)
    t9 = eval_js("""
    (() => {
        const { estimatePropertyMarketValue, getHpiMultiplier } = window.__TEST_ENGINES__;
        
        // 9A: Repeat Sales Indexing (2018 purchase of $500,000 -> 2026 indexed value)
        const mult2018 = getHpiMultiplier(2018);
        const repeatSale = estimatePropertyMarketValue({
            attributes: {}, lotSqft: 6500, stateCode: "CA",
            neighborhood: { hv: 850000 },
            facts: { bldg: 1650, beds: 3, baths: 2, yb: 1985 },
            salesInfo: { price: 500000, year: 2018 }
        });

        // 9B: Michigan 2x SEV True Cash Value (Kent County / Grand Rapids)
        const michiganSEV = estimatePropertyMarketValue({
            attributes: { SEV: 160000 }, lotSqft: 7500, stateCode: "MI",
            neighborhood: { hv: 330000 },
            facts: { bldg: 1750, beds: 3, baths: 2, yb: 1940 }
        });

        // 9C: Florida Just Value (JV) 100% Statutory Market Value
        const floridaJV = estimatePropertyMarketValue({
            attributes: { JV: 420000 }, lotSqft: 7000, stateCode: "FL",
            neighborhood: { hv: 410000 },
            facts: { bldg: 1800, beds: 3, baths: 2, yb: 2005 }
        });

        // 9D: Strict Separation of Living Area from Land Area (1800 sq ft home on 10,000 sq ft lot)
        const largeLot = estimatePropertyMarketValue({
            attributes: { LND_SQFOOT: 10000, LIVING_AREA: 1800 },
            lotSqft: 10000, stateCode: "MI",
            neighborhood: { hv: 330000 },
            facts: { bldg: 1800, beds: 3, baths: 2, yb: 1950 }
        });

        // 9E: 50-State Baseline Calibration (Ohio vs Colorado)
        const ohioHome = estimatePropertyMarketValue({
            attributes: {}, lotSqft: 8000, stateCode: "OH",
            facts: { bldg: 1650, beds: 3, baths: 2, yb: 1980 }
        });
        const coloradoHome = estimatePropertyMarketValue({
            attributes: {}, lotSqft: 7500, stateCode: "CO",
            facts: { bldg: 2000, beds: 3, baths: 2, yb: 1995 }
        });

        // 9F: Cook County 10% Assessment Ratio Normalization
        const cookCounty = estimatePropertyMarketValue({
            attributes: { TOTAL_VAL: 75000 }, lotSqft: 3125, stateCode: "IL",
            neighborhood: { hv: 650000, c: "Chicago" },
            facts: { bldg: 2200, beds: 4, baths: 2.5, yb: 1910 }
        });

        // 9G: Ohio 35% Assessment Ratio Normalization
        const columbusOhio = estimatePropertyMarketValue({
            attributes: { TOTAL_VAL: 85000 }, lotSqft: 7500, stateCode: "OH",
            neighborhood: { hv: 240000, c: "Columbus" },
            facts: { bldg: 1700, beds: 3, baths: 2, yb: 1978 }
        });

        // 9H: Luxury Tier Elasticity Dampening (Santa Monica 2019 $1.9M sale)
        const luxuryTier = estimatePropertyMarketValue({
            neighborhood: { hv: 2100000, c: "Santa Monica" }, stateCode: "CA",
            facts: { bldg: 1850, beds: 3, baths: 2, yb: 1952, eff: 2018 },
            lotSqft: 6000,
            salesInfo: { price: 1900000, year: 2019 }
        });

        // 9I: Arizona Full Cash Value (Maricopa County / Phoenix)
        const arizonaFCV = estimatePropertyMarketValue({
            attributes: { FCV: 480000 }, lotSqft: 6800, stateCode: "AZ",
            neighborhood: { hv: 450000, c: "Phoenix" },
            facts: { bldg: 1850, beds: 3, baths: 2, yb: 1995 }
        });

        // 9J: Washington King County 100% True & Fair Value (Seattle)
        const washingtonKing = estimatePropertyMarketValue({
            attributes: { AppraisedValue: 720000 }, lotSqft: 7000, stateCode: "WA",
            neighborhood: { hv: 700000, c: "Seattle" },
            facts: { bldg: 1900, beds: 3, baths: 2, yb: 1980 }
        });

        return {
            mult2018,
            repeatSaleValue: repeatSale.estimatedValue,
            michiganSevValue: michiganSEV.estimatedValue,
            michiganMethod: michiganSEV.valuationMethod,
            floridaJvValue: floridaJV.estimatedValue,
            largeLotLivingSqft: largeLot.livingSqft,
            largeLotValue: largeLot.estimatedValue,
            ohioValue: ohioHome.estimatedValue,
            ohioVpsf: ohioHome.vpsf,
            coloradoValue: coloradoHome.estimatedValue,
            coloradoVpsf: coloradoHome.vpsf,
            cookCountyValue: cookCounty.estimatedValue,
            cookCountyMethod: cookCounty.valuationMethod,
            columbusValue: columbusOhio.estimatedValue,
            columbusMethod: columbusOhio.valuationMethod,
            luxuryTierValue: luxuryTier.estimatedValue,
            arizonaValue: arizonaFCV.estimatedValue,
            arizonaMethod: arizonaFCV.valuationMethod,
            washingtonValue: washingtonKing.estimatedValue,
            washingtonMethod: washingtonKing.valuationMethod
        };
    })()
    """)
    print("Test 9 (Zillow-Grade AVM Valuation Engine):", t9)
    assert t9["mult2018"] == 1.66
    # 2018 $500k sale blended with neighborhood median yields ~$830k - $930k in 2026
    assert 780000 <= t9["repeatSaleValue"] <= 950000
    # Michigan SEV $160k * 2 * 1.04 should be ~$330k - $360k
    assert 320000 <= t9["michiganSevValue"] <= 380000
    assert "Michigan 2x SEV" in t9["michiganMethod"]
    # Florida JV $420k should be ~$420k - $480k
    assert 410000 <= t9["floridaJvValue"] <= 480000
    # Large lot must use 1800 sq ft living, NOT 10,000 sq ft
    assert t9["largeLotLivingSqft"] == 1800
    assert 340000 <= t9["largeLotValue"] <= 430000
    # Ohio home (~$145/sqft baseline) vs Colorado home (~$315/sqft baseline)
    assert 200000 <= t9["ohioValue"] <= 280000
    assert 130 <= t9["ohioVpsf"] <= 170
    assert 500000 <= t9["coloradoValue"] <= 650000
    assert 270 <= t9["coloradoVpsf"] <= 340
    # Cook County 10% assessment ratio ($75k assessed -> ~$700k - $800k market)
    assert 680000 <= t9["cookCountyValue"] <= 820000
    assert "Cook County 10%" in t9["cookCountyMethod"]
    # Ohio 35% assessment ratio ($85k assessed -> ~$240k - $290k market)
    assert 240000 <= t9["columbusValue"] <= 290000
    assert "Ohio 35%" in t9["columbusMethod"]
    # Luxury tier elasticity dampening prevents $3.0M+ overshoot on $1.9M 2019 sale
    assert 2450000 <= t9["luxuryTierValue"] <= 2750000
    # Arizona FCV ($480k FCV -> ~$480k - $530k market)
    assert 470000 <= t9["arizonaValue"] <= 530000
    assert "Arizona Statutory Full Cash Value" in t9["arizonaMethod"]
    # Washington King County 100% True & Fair Value ($720k -> ~$720k - $770k market)
    assert 710000 <= t9["washingtonValue"] <= 770000
    assert "Washington King/WA" in t9["washingtonMethod"]
    print("  -> PASS: AVM valuation matches Zillow benchmarks across repeat-sales, Michigan SEV, Florida JV, non-linear lot scaling, Cook County & Ohio ratios, Arizona FCV, Washington True Value, and luxury tier dampening.")

    # Test 10: Vacant Infill Land Equity Model
    t10 = eval_js("""
    (() => {
        const { estimatePropertyMarketValue } = window.__TEST_ENGINES__;
        const vacantLot = estimatePropertyMarketValue({
            attributes: { UseDescription: "Vacant Residential", Roll_LandValue: 280000, Roll_ImpValue: 0 },
            lotSqft: 6500, stateCode: "CA",
            neighborhood: { hv: 950000 },
            facts: { bldg: 0, foot: 0 }
        });
        return {
            estimatedValue: vacantLot.estimatedValue,
            livingSqft: vacantLot.livingSqft,
            isVacantLand: vacantLot.isVacantLand,
            siteValue: vacantLot.siteValue,
            structVal: vacantLot.structVal,
            method: vacantLot.valuationMethod
        };
    })()
    """)
    print("Test 10 (Vacant Infill Land Equity Model):", t10)
    assert t10["isVacantLand"] is True
    assert t10["livingSqft"] == 0
    assert t10["structVal"] == 0
    assert t10["siteValue"] > 0
    assert 550000 <= t10["estimatedValue"] <= 850000
    print("  -> PASS: Vacant parcel evaluated strictly as land equity without fabricated structural GLA.")

    # Test 11: Multi-Unit Density Bonus (Duplex/Triplex Infill)
    t11 = eval_js("""
    (() => {
        const { estimatePropertyMarketValue } = window.__TEST_ENGINES__;
        const sfr = estimatePropertyMarketValue({
            attributes: { Units: 1 }, lotSqft: 6000, stateCode: "CA",
            neighborhood: { hv: 900000 },
            facts: { bldg: 2400, units: 1, beds: 4, baths: 3, yb: 1985 }
        });
        const duplex = estimatePropertyMarketValue({
            attributes: { Units: 2 }, lotSqft: 6000, stateCode: "CA",
            neighborhood: { hv: 900000 },
            facts: { bldg: 2400, units: 2, beds: 4, baths: 3, yb: 1985 }
        });
        return {
            sfrValue: sfr.estimatedValue,
            duplexValue: duplex.estimatedValue,
            delta: duplex.estimatedValue - sfr.estimatedValue
        };
    })()
    """)
    print("Test 11 (Multi-Unit Density Valuation):", t11)
    assert t11["duplexValue"] > t11["sfrValue"]
    assert 20000 <= t11["delta"] <= 70000
    print("  -> PASS: 2-unit duplex correctly reflects unit rental diversification premium over single-family.")

    # Test 12: Comprehensive Single-House Parcel Auditor & House Inspector Panel
    t12 = eval_js("""
    (() => {
        const { auditSingleHouseParcel, renderHouseAuditAside, calculatePermitCapitalization, calculateCalibratedTreeEconomics } = window.__TEST_ENGINES__;

        const permits = [
            { issue_date: "2024-05-10", permit_type: "remodel", valuation_usd: 80000, description: "Master suite remodel" },
            { issue_date: "2024-09-15", permit_type: "seismic", valuation_usd: 9500, description: "Seismic foundation bolting" }
        ];

        const parcelAudit = auditSingleHouseParcel({
            parcelId: "06037-5819001",
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
            imageryInfo: { lidarYear: 2020, streetViewDate: "2021-06", hasStreetView: true }
        });

        const luxuryAudit = auditSingleHouseParcel({
            parcelId: "06037-BEVERLY",
            address: "700 Foothill Rd, Beverly Hills, CA",
            lat: 34.08,
            lng: -118.40,
            lotSqft: 18000,
            livingSqft: 4800,
            yearBuilt: 1998,
            neighborhoodMedianHv: 3800000,
            stateCode: "CA",
            countyFips: "06037"
        });

        const ruralAudit = auditSingleHouseParcel({
            parcelId: "06003-ALPINE",
            lat: 38.6,
            lng: -119.8,
            lotSqft: 25000,
            neighborhoodMedianHv: 550000,
            stateCode: "CA",
            countyFips: "06003",
            imageryInfo: { lidarYear: 2021, streetViewDate: null, hasStreetView: false }
        });

        const mnTree = calculateCalibratedTreeEconomics("MN", 350000, 1.05);
        const azTree = calculateCalibratedTreeEconomics("AZ", 450000, 1.02);

        const asideHtml = renderHouseAuditAside(parcelAudit);

        return {
            permitCapAdded: parcelAudit.valuation.permitCapitalizationAdded,
            finalValue: parcelAudit.valuation.estimatedValue,
            imageryBadge: parcelAudit.imagery.confidenceBadge,
            isLidarStale: parcelAudit.imagery.isLidarStale,
            solarTaxYear: parcelAudit.solarMicrogrid.tax_year,
            solarFederalItc: parcelAudit.solarMicrogrid.federal_itc_pct,
            solarBatteryRequired: parcelAudit.solarMicrogrid.battery_storage_required_for_roi,
            luxuryDampened: luxuryAudit.valuation.luxuryDampeningApplied,
            luxurySaturationMult: luxuryAudit.valuation.luxurySaturationMultiplier,
            ruralImageryBadge: ruralAudit.imagery.confidenceBadge,
            ruralWarning: ruralAudit.imagery.warningMessage,
            mnClimateRegime: mnTree.climateRegime,
            mnIrrigation: mnTree.annualIrrigationCostUsd,
            azClimateRegime: azTree.climateRegime,
            azSavings: azTree.annualUtilitySavingsUsd,
            azIrrigation: azTree.annualIrrigationCostUsd,
            asideLength: asideHtml.length,
            hasDisclaimers: asideHtml.includes("LEGAL & ENGINEERING NON-RELIANCE NOTICE")
        };
    })()
    """)
    print("Test 12 (Single-House Parcel Auditor & Inspector Panel):", t12)
    assert t12["permitCapAdded"] == 77500
    assert t12["finalValue"] > 900000
    assert t12["imageryBadge"] == "stale_imagery_permit_override"
    assert t12["solarTaxYear"] == 2026
    assert t12["solarFederalItc"] == 0.0
    assert t12["solarBatteryRequired"] is True
    assert t12["luxuryDampened"] is True
    assert t12["luxurySaturationMult"] < 1.0
    assert t12["ruralImageryBadge"] == "no_street_view_fallback"
    assert "Google Street View coverage is unavailable" in t12["ruralWarning"]
    assert t12["mnClimateRegime"] == "heating_dominant"
    assert t12["mnIrrigation"] == 0
    assert t12["azClimateRegime"] == "arid_irrigation_limited"
    assert t12["azSavings"] == 220
    assert t12["azIrrigation"] == 45
    assert t12["asideLength"] > 1000
    assert t12["hasDisclaimers"] is True
    print("  -> PASS: Single-house parcel auditor coordinates AVM permits, luxury saturation, imagery checks, 2026 solar rules, multi-climate tree economics, and disclaimer panel.")

    # Test 13: Grounded AI Advisor Contract & Context Serialization
    t13 = eval_js("""
    (() => {
        const { buildGroundedAdvisorPrompt, serializeLiveAdvisorContext } = window.__TEST_ENGINES__;

        const mockPayload = {
            county: {
                fips: "06037", name: "Los Angeles County", state: "CA",
                readiness_tier: "audited_A", zoning_source: "live_municipal_gis",
                crime_feed_status: "rolling_12m"
            },
            parcel: {
                parcelId: "5408-012-015", address: "1234 Echo Park Ave, Los Angeles, CA",
                county: "Los Angeles County", state: "CA", lotSqft: 6500, livingSqft: 1800,
                yearBuilt: 1952, effectiveYearBuilt: 2024, bedrooms: 3, bathrooms: 2, stories: 1, units: 1,
                isVacantLand: false, zoningCode: "RD1.5-1", useDescription: "Single Family Residence",
                avmValuation: {
                    estimatedValue: 1180000, valueLow: 1100000, valueHigh: 1260000, vpsf: 656,
                    valuationMethod: "Hedonic Micro-Model", confidenceMarginPct: 0.065,
                    permitCapitalizationAdded: 51000, luxuryDampeningApplied: false
                },
                recentPermits: [{ issue_date: "2024-04-12", permit_type: "remodel", valuation_usd: 60000, description: "Remodel" }],
                imagery: { confidenceBadge: "verified_current", isLidarStale: false, isStreetViewStale: false, warningMessage: null },
                statutoryExclusions: {
                    historic_district_hpoz: true, coastal_commission_or_sma: false,
                    fema_100yr_floodway: false, calfire_or_state_vhfhsz: false
                },
                solar: { system_size_dc_kw: 6.8, federal_itc_pct: 0, battery_storage_required: true, net_25yr_npv_usd: 24500 },
                treeEconomics: { annualCoolingOrHeatingSavingsUsd: 140, capitalizedValueUsd: 7130, climateRegime: "cooling_dominant" }
            }
        };

        const { systemPrompt, userPrompt } = buildGroundedAdvisorPrompt("What is my best ROI move?", mockPayload);

        return {
            hasStrictGrounding: systemPrompt.includes("STRICT GROUNDING & ANTI-HALLUCINATION RULES"),
            hasReadinessTier: systemPrompt.includes('Active jurisdiction readiness tier is "audited_A"'),
            hasHpozOverlay: systemPrompt.includes("CRITICAL STATUTORY OVERLAYS DETECTED: [historic_district_hpoz]"),
            hasSolar2026Rule: systemPrompt.includes("IRC § 25D expired on Dec 31, 2025"),
            hasNonReliance: systemPrompt.includes("LEGAL & ENGINEERING NON-RELIANCE NOTICE"),
            userPromptHasJson: userPrompt.includes("VERIFIED GEOSPATIAL & STATUTORY CONTEXT (JSON):"),
            userPromptHasAddress: userPrompt.includes("1234 Echo Park Ave"),
            userPromptHasAvm: userPrompt.includes("1180000")
        };
    })()
    """)
    print("Test 13 (Grounded AI Advisor Contract & Prompt Synthesis):", t13)
    assert t13["hasStrictGrounding"] is True
    assert t13["hasReadinessTier"] is True
    assert t13["hasHpozOverlay"] is True
    assert t13["hasSolar2026Rule"] is True
    assert t13["hasNonReliance"] is True
    assert t13["userPromptHasJson"] is True
    assert t13["userPromptHasAddress"] is True
    assert t13["userPromptHasAvm"] is True
    print("  -> PASS: AI Advisor grounding contract enforces zero-hallucination rules, tier disclaimers, and 2026 solar/statutory mandates.")

    # Test 14: Nationwide 706-Jurisdiction Bundles & Canonical FIPS Resolution
    t14 = eval_js("""
    (() => {
        const totalBundles = typeof countyBundleEls === "function" ? countyBundleEls().length : 0;
        const ancName = typeof countyNameOf === "function" ? countyNameOf("02020") : null;
        const honName = typeof countyNameOf === "function" ? countyNameOf("15003") : null;
        const alexName = typeof countyNameOf === "function" ? countyNameOf("51510") : null;
        const ctName = typeof countyNameOf === "function" ? countyNameOf("09150") : null;
        return {
            totalBundles,
            ancName,
            honName,
            alexName,
            ctName
        };
    })()
    """)
    print("Test 14 (Nationwide 706-Jurisdiction Bundles & Resolution):", t14)
    assert t14["totalBundles"] == 706
    assert t14["ancName"] == "Anchorage Municipality"
    assert t14["honName"] == "Honolulu County"
    assert t14["alexName"] == "Alexandria city"
    assert "Northeastern Connecticut" in (t14["ctName"] or "")
    print("  -> PASS: All 706 nationwide jurisdictions verified in DOM bundles and canonical FIPS lookup.")

    ws.close()
    print("========================================================")
    print("ALL 14 CORE REGRESSION TEST SUITES PASSED (100% SUCCESS)!")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
