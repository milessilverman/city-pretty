import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { auditSingleHouseParcel } from "../../src/engines/parcelHouseAuditor";
import { estimateAccurateRoofArea } from "../../src/engines/roofAreaEngine";

describe("Data Accuracy & Source Verification Tests (ACCURACY-ROADMAP.md)", () => {
  const rootDir = path.resolve(__dirname, "../../");

  it("1. research.json contains only verified studies with DOIs/URLs and zero filler", () => {
    const filePath = path.join(rootDir, "app/data/research.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const studies = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Array.isArray(studies)).toBe(true);
    expect(studies.length).toBeGreaterThanOrEqual(15);

    const fillerRegex = /#\d+/;

    for (const study of studies) {
      expect(study.id).toBeDefined();
      expect(study.title).toBeDefined();
      expect(fillerRegex.test(study.title)).toBe(false);
      expect(fillerRegex.test(study.authors)).toBe(false);
      expect(fillerRegex.test(study.journal)).toBe(false);

      // Verify that source_url or doi exists and is non-empty
      const hasUrlOrDoi = Boolean(study.source_url || study.doi);
      expect(hasUrlOrDoi).toBe(true);

      // Verify citation and last_verified
      expect(study.citation).toBeTruthy();
      expect(study.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("2. statutes.json contains verified state statutes with official URLs", () => {
    const statutesPath = path.join(rootDir, "app/data/statutes.json");
    expect(fs.existsSync(statutesPath)).toBe(true);

    const statutes = JSON.parse(fs.readFileSync(statutesPath, "utf-8"));
    expect(Array.isArray(statutes)).toBe(true);
    expect(statutes.length).toBeGreaterThanOrEqual(8);

    for (const statute of statutes) {
      expect(statute.id).toBeTruthy();
      expect(statute.state_code).toBeTruthy();
      // bill_number may be null when the enacting bill could not be confirmed (verification.status != verified)
      if (statute.verification?.status === "verified") expect(statute.bill_number).toBeTruthy();
      expect(statute.statute_citation).toBeTruthy();
      expect(statute.statute_url).toMatch(/^https?:\/\//);
      if (statute.verification?.status === "unverified") expect(statute.last_verified).toBeNull();
      else expect(statute.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("3. funding_programs.json contains verified municipal & state funding programs", () => {
    const fundingPath = path.join(rootDir, "app/data/funding_programs.json");
    expect(fs.existsSync(fundingPath)).toBe(true);

    const programs = JSON.parse(fs.readFileSync(fundingPath, "utf-8"));
    expect(Array.isArray(programs)).toBe(true);
    expect(programs.length).toBeGreaterThanOrEqual(4);

    const ids = programs.map((p: any) => p.id);
    expect(ids).toContain("la_measure_w");
    expect(ids).toContain("la_prop_k");
    expect(ids).toContain("ca_urban_greening");
    expect(ids).toContain("calfire_urban_forestry");

    for (const prog of programs) {
      expect(prog.id).toBeTruthy();
      expect(prog.administering_agency).toBeTruthy();
      if (prog.verification?.status !== "unverified") expect(prog.statutory_citation).toBeTruthy();
      expect(prog.source_url).toMatch(/^https?:\/\//);
      if (prog.verification?.status === "unverified") expect(prog.last_verified).toBeNull();
      else expect(prog.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(prog.eligible_improvements)).toBe(true);
      expect(prog.eligible_improvements.length).toBeGreaterThan(0);
    }
  });

  it("4. case_studies.json contains verified historical projects with published evaluations", () => {
    const casePath = path.join(rootDir, "app/data/case_studies.json");
    expect(fs.existsSync(casePath)).toBe(true);

    const cases = JSON.parse(fs.readFileSync(casePath, "utf-8"));
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(5);

    for (const c of cases) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.city).toBeTruthy();
      expect(c.evaluation_url).toMatch(/^https?:\/\//);
      expect(c.source).toBeTruthy();
      expect(c.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("5. transit_pipelines.json contains official transit corridors without synthetic metrics", () => {
    const transitPath = path.join(rootDir, "app/data/transit_pipelines.json");
    expect(fs.existsSync(transitPath)).toBe(true);

    const pipelines = JSON.parse(fs.readFileSync(transitPath, "utf-8"));
    expect(Array.isArray(pipelines)).toBe(true);
    expect(pipelines.length).toBeGreaterThanOrEqual(5);

    for (const pipe of pipelines) {
      expect(pipe.fips).toBeTruthy();
      expect(pipe.agency).toBeTruthy();
      expect(pipe.rtp_document_url).toMatch(/^https?:\/\//);
      expect(pipe.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify that unadopted synthetic financial metrics are strictly null
      expect(pipe.tdc).toBeNull();
      expect(pipe.seniorDebt).toBeNull();
      expect(pipe.tifiaLoan).toBeNull();
      expect(pipe.developerEquity).toBeNull();
    }
  });

  it("6. Parcel House Auditor does not invent lot-split feasibility when lotSqft is missing", () => {
    const audit = auditSingleHouseParcel({
      parcelId: "TEST-NULL-SAFETY",
      lat: 34.05,
      lng: -118.25,
      lotSqft: undefined as any,
      livingSqft: undefined as any,
      neighborhoodMedianHv: 800000,
      stateCode: "CA",
      countyFips: "06037",
    });

    // lotSplitFeasible must be false because lotSqft is unknown (cannot claim by-right lot split)
    expect(audit.statutoryZoning.lotSplitFeasible).toBe(false);
  });

  it("7. Roof Area Engine returns method 'not_recorded' without livingSqft and footprint", () => {
    const estimate = estimateAccurateRoofArea({});
    expect(estimate.estimationMethod).toBe("not_recorded");
    expect(estimate.pitchMultiplier).toBe(1.0);
    expect(estimate.groundFootprintSqft).toBe(0);
    expect(estimate.grossRoofSqft).toBe(0);
  });

  it("8. state_finance_profiles.json contains verified assessment rules and citations for 50 states + DC + PR", () => {
    const filePath = path.join(rootDir, "app/data/state_finance_profiles.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const profiles = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const stateCodes = Object.keys(profiles);
    expect(stateCodes.length).toBeGreaterThanOrEqual(51);

    for (const code of stateCodes) {
      const p = profiles[code];
      expect(p.state_code).toBe(code);
      expect(p.res_assessment_ratio).toBeGreaterThan(0);
      expect(p.comm_assessment_ratio).toBeGreaterThan(0);
      expect(p.statutory_citation).toBeTruthy();
      expect(p.source_url).toMatch(/^https?:\/\//);
      if (p.verification?.status === "unverified") {
        expect(p.last_verified).toBeNull();
      } else {
        expect(p.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("9. unit_costs.json contains verified public agency bid item costs", () => {
    const filePath = path.join(rootDir, "app/data/unit_costs.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const costs = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Array.isArray(costs)).toBe(true);
    expect(costs.length).toBeGreaterThanOrEqual(30);

    const confirmed = costs.filter((c: any) => c.status === "confirmed");
    expect(confirmed.length).toBeGreaterThanOrEqual(20);

    for (const item of confirmed) {
      expect(item.item).toBeTruthy();
      expect(item.state).toBeTruthy();
      expect(item.unit).toBeTruthy();
      expect(item.unit_price).toBeGreaterThan(0);
      expect(item.source_agency).toBeTruthy();
      expect(item.source_url).toMatch(/^https?:\/\//);
      expect(item.quote).toBeTruthy();
      expect(item.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    // Unverified items must have unit_price: null
    const notFound = costs.filter((c: any) => c.status === "not_found");
    for (const item of notFound) {
      expect(item.unit_price).toBeNull();
    }
  });

  it("10. hud_fair_market_rents.json contains verified FY2026 Fair Market Rents", () => {
    const filePath = path.join(rootDir, "app/data/hud_fair_market_rents.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const rents = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Array.isArray(rents)).toBe(true);
    expect(rents.length).toBeGreaterThanOrEqual(10);

    for (const r of rents) {
      expect(r.fips).toMatch(/^\d{5}$/);
      expect(r.metro_or_county_name).toBeTruthy();
      if (r.one_bed_1br === null) { expect(r.null_reason).toBeTruthy(); continue; } // explicit null rows are covered by hudFmr.test.ts
      expect(r.one_bed_1br).toBeGreaterThan(500);
      expect(r.two_bed_2br).toBeGreaterThanOrEqual(r.one_bed_1br);
      expect(r.source_url).toMatch(/^https?:\/\//);
      expect(r.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("11. valuation_backtest_benchmarks.json contains verified county recorder back-tests", () => {
    const filePath = path.join(rootDir, "app/data/valuation_backtest_benchmarks.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const benchmarks = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const countyKeys = Object.keys(benchmarks);
    expect(countyKeys.length).toBeGreaterThanOrEqual(5);

    for (const fips of countyKeys) {
      const b = benchmarks[fips];
      expect(b.countyFips).toBe(fips);
      expect(b.countyName).toBeTruthy();
      expect(b.sampleCount).toBeGreaterThanOrEqual(5);
      expect(typeof b.mdape).toBe("number");
      expect(b.mdape).toBeGreaterThan(0);
      expect(typeof b.shareWithin10Pct).toBe("number");
      expect(typeof b.shareWithin20Pct).toBe("number");
      expect(["reliable", "acceptable", "withhold"]).toContain(b.status);
      expect(typeof b.withhold).toBe("boolean");
      expect(b.sourceUrl).toMatch(/^https?:\/\//);
      expect(b.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Rule: if mdape > 0.14, status MUST be withhold
      if (b.mdape > 0.14) {
        expect(b.status).toBe("withhold");
        expect(b.withhold).toBe(true);
        expect(b.withholdReason).toBeTruthy();
      }
    }
  });

  it("12. valuationBacktestEngine calculates MdAPE and enforces error withholding", async () => {
    const { runCountyValuationBacktest, checkCountyBacktestWithholding } = await import("../../src/engines/valuationBacktestEngine");

    // Test a high-error synthetic sample to ensure it triggers withhold
    const highErrorSales = [
      {
        parcelId: "TEST-1",
        salePrice: 1000000,
        saleDate: "2024-01-10",
        isArmsLength: true,
        countyFips: "99999",
        countyName: "Test County",
        stateCode: "CA",
        attributes: { LIVING_AREA: 900, LotSqft: 4000, Roll_LandValue: 200000, Roll_ImpValue: 150000 },
        neighborhoodMedianHv: 500000
      },
      {
        parcelId: "TEST-2",
        salePrice: 1200000,
        saleDate: "2024-02-12",
        isArmsLength: true,
        countyFips: "99999",
        countyName: "Test County",
        stateCode: "CA",
        attributes: { LIVING_AREA: 1000, LotSqft: 4200, Roll_LandValue: 220000, Roll_ImpValue: 160000 },
        neighborhoodMedianHv: 520000
      },
      {
        parcelId: "TEST-3",
        salePrice: 1100000,
        saleDate: "2024-03-15",
        isArmsLength: true,
        countyFips: "99999",
        countyName: "Test County",
        stateCode: "CA",
        attributes: { LIVING_AREA: 950, LotSqft: 4100, Roll_LandValue: 210000, Roll_ImpValue: 155000 },
        neighborhoodMedianHv: 510000
      },
      {
        parcelId: "TEST-4",
        salePrice: 1300000,
        saleDate: "2024-04-18",
        isArmsLength: true,
        countyFips: "99999",
        countyName: "Test County",
        stateCode: "CA",
        attributes: { LIVING_AREA: 1050, LotSqft: 4300, Roll_LandValue: 230000, Roll_ImpValue: 165000 },
        neighborhoodMedianHv: 530000
      },
      {
        parcelId: "TEST-5",
        salePrice: 1250000,
        saleDate: "2024-05-20",
        isArmsLength: true,
        countyFips: "99999",
        countyName: "Test County",
        stateCode: "CA",
        attributes: { LIVING_AREA: 1020, LotSqft: 4250, Roll_LandValue: 225000, Roll_ImpValue: 162000 },
        neighborhoodMedianHv: 525000
      }
    ];

    const result = runCountyValuationBacktest(highErrorSales);
    expect(result.sampleCount).toBe(5);
    expect(result.mdape).toBeGreaterThan(0.20);
    expect(result.status).toBe("withhold");
    expect(result.withhold).toBe(true);
    expect(result.withholdReason).toContain("Valuation withheld");

    const withholdingCheck = checkCountyBacktestWithholding("99999", { "99999": result });
    expect(withholdingCheck.withhold).toBe(true);
    expect(withholdingCheck.reason).toBeTruthy();
  });

  it("13. underused_sites.json contains verified underused land inventory", () => {
    const filePath = path.join(rootDir, "app/data/underused_sites.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const sites = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Array.isArray(sites)).toBe(true);
    expect(sites.length).toBeGreaterThanOrEqual(50);

    const kinds = new Set(sites.map((s: any) => s.kind));
    expect(kinds.has("golf course")).toBe(true);
    expect(kinds.has("parking lot")).toBe(true);
    expect(kinds.has("vacant")).toBe(true);

    for (const site of sites) {
      expect(site.id).toBeTruthy();
      expect(site.acres).toBeGreaterThan(0);
      expect(site.countyFips).toMatch(/^\d{5}$/);
      expect(site.blockGroupId).toMatch(/^\d{12}$/);
      expect(site.sourceUrl).toMatch(/^https?:\/\//);
      expect(site.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("14. underusedLandEngine evaluates edge golf course and parking lot conversions", async () => {
    const { evaluateGolfCourseConversion, evaluateParkingLotConversion, filterUnderusedSites } = await import("../../src/engines/underusedLandEngine");

    const sampleGolf: any = {
      id: "golf_test_1",
      name: "Rancho Test Golf Course",
      kind: "golf course",
      acres: 100,
      countyFips: "06037",
      blockGroupId: "060371000001",
      cityName: "Los Angeles",
      assessedLandValue: 5000000,
      marketLandValue: 80000000,
      baseZoning: "OS",
      distanceToRailMeters: 600,
      nearestRailStation: "Metro Station",
      publicOwner: null,
      inConservationEasement: false,
      isHousingElementSite: false,
      alreadyBuilt: false,
      neighborhoodMedianHv: 850000,
      potentialHomes: 480,
      margin: 25000000,
      idea: "Edge conversion"
    };

    const golfEval = evaluateGolfCourseConversion(sampleGolf);
    expect(golfEval.publicParkPreservedAcres).toBe(88); // 88% public park preserved
    expect(golfEval.housingEdgeAcres).toBe(12); // 12% edge developed
    // typed potentialHomes / margin on a site are ignored: the engine computes the screening estimate
    // from measured fields + named assumptions (100 acres x 12% x 45 homes/acre near rail = 540)
    expect(golfEval.potentialHomes).toBe(540);
    expect(golfEval.netDevelopmentMargin).toBe(golfEval.screening_estimate.margin);
    expect(golfEval.netDevelopmentMargin).not.toBe(25000000);
    expect(golfEval.applicableStatutes).toContain("CA SB 79 (Transit-Oriented Density)");
    expect(golfEval.applicableStatutes).toContain("CA AB 2097 (Zero Parking Mandates)");

    const sampleParking: any = {
      id: "parking_test_1",
      name: null,
      kind: "parking lot",
      acres: 3.5,
      countyFips: "06037",
      blockGroupId: "060372000001",
      cityName: "Los Angeles",
      distanceToRailMeters: 350, // 0.22 miles (< 0.5 mi)
      nearestRailStation: "Union Station",
      publicOwner: "City of Los Angeles",
      inConservationEasement: false,
      alreadyBuilt: false,
      potentialHomes: 210,
      margin: 15000000
    };

    const parkEval = evaluateParkingLotConversion(sampleParking);
    expect(parkEval.parkingMandateEliminated).toBe(true);
    expect(parkEval.applicableStatutes).toContain("CA AB 2097 (Parking Minimum Abolition)");
    expect(parkEval.applicableStatutes).toContain("CA Surplus Land Act (Gov. Code § 54220)");

    const filtered = filterUnderusedSites([sampleGolf, sampleParking], { kind: "golf course" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("golf_test_1");
  });

  it("15. state-housing-laws.json includes verified Austin HOME and Texas statutes", () => {
    const filePath = path.join(rootDir, "app/data/state-housing-laws.json");
    const laws = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const austinHome = laws.find((l: any) => l.id === "tx_austin_home");
    expect(austinHome).toBeDefined();
    expect(austinHome.state_code).toBe("TX");
    expect(austinHome.min_lot_size_sqft).toBe(1800); // city HOME Phase 2 page: 1,800 sq ft
    expect(austinHome.max_units_by_right).toBe(3);
    expect(austinHome.statute_url).toMatch(/^https?:\/\//);
    expect(austinHome.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const txAdu = laws.find((l: any) => l.id === "tx_adu_statute");
    expect(txAdu).toBeDefined();
    expect(txAdu.state_code).toBe("TX");
    expect(txAdu.statute_url).toMatch(/^https?:\/\//);
  });

  it("16. intercity_transit_corridors.json contains verified rail corridors with official FRA/DOT study sources", () => {
    const filePath = path.join(rootDir, "app/data/intercity_transit_corridors.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const corridors = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Array.isArray(corridors)).toBe(true);
    expect(corridors.length).toBeGreaterThanOrEqual(4);

    const corridorIds = corridors.map((c: any) => c.id);
    expect(corridorIds).toContain("corridor_phx_tus");
    expect(corridorIds).toContain("corridor_atx_sat");
    expect(corridorIds).toContain("corridor_front_range");
    expect(corridorIds).toContain("corridor_brightline_west");

    for (const c of corridors) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(Array.isArray(c.states)).toBe(true);
      expect(c.states.length).toBeGreaterThan(0);
      expect(c.route_length_miles).toBeGreaterThan(0);
      expect(c.official_study_url).toMatch(/^https?:\/\//);
      expect(c.source_url).toMatch(/^https?:\/\//);
      expect(c.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.projected_one_way_minutes).toBeGreaterThan(0);
      expect(c.highway_comparison_minutes).toBeGreaterThan(0);
      expect(Array.isArray(c.proposed_stations)).toBe(true);
      expect(c.proposed_stations.length).toBeGreaterThan(0);
      expect(Array.isArray(c.candidate_railyard_sites)).toBe(true);
      expect(c.candidate_railyard_sites.length).toBeGreaterThan(0);

      for (const stn of c.proposed_stations) {
        expect(stn.id).toBeTruthy();
        expect(stn.name).toBeTruthy();
        expect(stn.city).toBeTruthy();
        expect(stn.fips).toMatch(/^\d{5}$/);
        expect(stn.lat).toBeGreaterThan(20);
        expect(stn.lng).toBeLessThan(-60);
        expect(stn.statutory_housing_regime).toBeTruthy();
      }

      for (const yard of c.candidate_railyard_sites) {
        expect(yard.id).toBeTruthy();
        expect(yard.name).toBeTruthy();
        expect(yard.required_acres).toBeGreaterThan(0);
        expect(yard.total_land_acquisition_cost).toBeGreaterThan(0);
        expect(yard.adjacent_mainline).toBeTruthy();
        expect(yard.siting_recommendation).toBeTruthy();
      }
    }
  });

  it("17. transitCorridorOpportunityEngine evaluates macro corridor viability, station TOD, and railyard economics", async () => {
    const { evaluateCorridorFeasibility, evaluateStationTODPotential, generateStationInvestmentPlan } = await import("../../src/engines/transitCorridorOpportunityEngine");
    const filePath = path.join(rootDir, "app/data/intercity_transit_corridors.json");
    const corridors = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const phxTuc = corridors.find((c: any) => c.id === "corridor_phx_tus");
    expect(phxTuc).toBeDefined();

    const evalPhx = evaluateCorridorFeasibility(phxTuc);
    expect(evalPhx.isViable).toBe(true);
    expect(evalPhx.travelTimeSavedMinutes).toBe(30); // 115 min hwy vs 85 min rail
    expect(evalPhx.speedCompetitivenessRatio).toBeGreaterThan(1.2);
    expect(evalPhx.railyardCostSavingsUsd).toBeGreaterThan(150_000_000); // Coolidge ($1.68M) vs Tempe ($175M)
    expect(evalPhx.recommendedRailyardSite?.id).toBe("yard_coolidge_junction");

    const austinSa = corridors.find((c: any) => c.id === "corridor_atx_sat");
    expect(austinSa).toBeDefined();
    const evalAtx = evaluateCorridorFeasibility(austinSa);
    expect(evalAtx.isViable).toBe(true);
    expect(evalAtx.railyardCostSavingsUsd).toBeGreaterThan(150_000_000); // Kyle ($2.7M) vs Austin ($160M)

    // Test Station TOD evaluation
    const phxStation = phxTuc.proposed_stations.find((s: any) => s.id === "phx_downtown");
    expect(phxStation).toBeDefined();
    const todEval = evaluateStationTODPotential(phxStation);
    expect(todEval.walkshedAcquisitionCostPerAcre).toBe(95 * 43560);
    expect(todEval.feasibleHousingUnits).toBeGreaterThan(1000);
    expect(todEval.projectedLandValueUpliftPct).toBe(0.32);
    expect(todEval.recommendedBikeNetworkMiles).toBeGreaterThan(0);
    expect(todEval.estimatedBikeNetworkCost).toBeGreaterThan(500_000);

    // Test Capital Allocation Plans
    // Tier 1: $150k homeowner
    const plan150k = generateStationInvestmentPlan(phxTuc, phxStation, 150_000);
    expect(plan150k.tier).toBe("homeowner_single_lot");
    expect(plan150k.pillars.length).toBeGreaterThanOrEqual(3);
    expect(plan150k.everySpaceMonetizationStrategy).toContain("EverySpace");
    expect(plan150k.statutoryPreemptionLeveraged).toContain("AZ HB 2720");

    // Tier 2: $5M syndication
    const plan5M = generateStationInvestmentPlan(phxTuc, phxStation, 5_000_000);
    expect(plan5M.tier).toBe("private_syndication");
    expect(plan5M.budget).toBe(5_000_000);
    expect(plan5M.pillars.some(p => p.pillar.includes("Bike Spur") || p.pillar.includes("Micro-Mobility"))).toBe(true);

    // Tier 3: $50M institutional P3
    const plan50M = generateStationInvestmentPlan(phxTuc, phxStation, 50_000_000);
    expect(plan50M.tier).toBe("institutional_p3_fund");
    expect(plan50M.budget).toBe(50_000_000);
    expect(plan50M.pillars.some(p => p.pillar.includes("Transit-Oriented Development") || p.pillar.includes("TOD"))).toBe(true);
  });

  it("18. funding_programs.json contains verified municipal & state funding programs nationwide", () => {
    const fundingPath = path.join(rootDir, "app/data/funding_programs.json");
    const programs = JSON.parse(fs.readFileSync(fundingPath, "utf-8"));
    expect(programs.length).toBeGreaterThanOrEqual(11);

    const ids = programs.map((p: any) => p.id);
    expect(ids).toContain("tx_tirz_ch311");
    expect(ids).toContain("fl_cra_ch163");
    expect(ids).toContain("co_ura_tif");
    expect(ids).toContain("il_transit_tif");
    expect(ids).toContain("az_gplet");
    expect(ids).toContain("federal_fra_intercity_grant");

    for (const prog of programs) {
      expect(prog.id).toBeTruthy();
      expect(prog.program_name).toBeTruthy();
      expect(prog.administering_agency).toBeTruthy();
      if (prog.verification?.status !== "unverified") expect(prog.statutory_citation).toBeTruthy();
      expect(prog.source_url).toMatch(/^https?:\/\//);
      if (prog.verification?.status === "unverified") expect(prog.last_verified).toBeNull();
      else expect(prog.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(prog.eligible_improvements.length).toBeGreaterThan(0);
    }
  });

  it("19. hud_fair_market_rents.json covers every manifest county (and the major metros) with HUD FMR values", () => {
    const fmrPath = path.join(rootDir, "app/data/hud_fair_market_rents.json");
    expect(fs.existsSync(fmrPath)).toBe(true);

    const fmrList = JSON.parse(fs.readFileSync(fmrPath, "utf-8"));
    expect(Array.isArray(fmrList)).toBe(true);
    expect(fmrList.length).toBeGreaterThanOrEqual(46);

    const fipsList = fmrList.map((f: any) => f.fips);
    expect(fipsList).toContain("04013"); // Maricopa AZ (Phoenix)
    expect(fipsList).toContain("48453"); // Travis TX (Austin)
    expect(fipsList).toContain("17031"); // Cook IL (Chicago)
    expect(fipsList).toContain("53033"); // King WA (Seattle)
    expect(fipsList).toContain("08031"); // Denver CO
    expect(fipsList).toContain("12086"); // Miami-Dade FL
    expect(fipsList).toContain("13121"); // Fulton GA (Atlanta)
    expect(fipsList).toContain("36061"); // New York NY (Manhattan)

    for (const f of fmrList) {
      expect(f.fips).toMatch(/^\d{5}$/);
      expect(f.metro_or_county_name).toBeTruthy();
      expect(f.state_code).toMatch(/^[A-Z]{2}$/);
      if (f.one_bed_1br === null) { expect(f.null_reason).toBeTruthy(); continue; }
      expect(f.zero_bed_eff).toBeGreaterThan(400);
      expect(f.one_bed_1br).toBeGreaterThan(400);
      expect(f.two_bed_2br).toBeGreaterThanOrEqual(f.one_bed_1br);
      expect(f.three_bed_3br).toBeGreaterThanOrEqual(f.two_bed_2br);
      expect(f.four_bed_4br).toBeGreaterThanOrEqual(f.three_bed_3br);
      expect(f.source_url).toMatch(/^https?:\/\//);
      expect(f.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("20. state-housing-laws.json and statutes.json cover nationwide statutory zoning preemptions across 14 states", () => {
    const statutesPath = path.join(rootDir, "app/data/statutes.json");
    const stateHousingPath = path.join(rootDir, "app/data/state-housing-laws.json");

    const statutes = JSON.parse(fs.readFileSync(statutesPath, "utf-8"));
    const stateLaws = JSON.parse(fs.readFileSync(stateHousingPath, "utf-8"));

    expect(statutes.length).toBeGreaterThanOrEqual(20);
    expect(stateLaws.length).toBeGreaterThanOrEqual(20);

    const statesCovered = new Set(statutes.map((s: any) => s.state_code));
    expect(statesCovered.has("AZ")).toBe(true);
    expect(statesCovered.has("CO")).toBe(true);
    expect(statesCovered.has("MN")).toBe(true);
    expect(statesCovered.has("MT")).toBe(true);
    expect(statesCovered.has("UT")).toBe(true);
    expect(statesCovered.has("WA")).toBe(true);
    expect(statesCovered.has("OR")).toBe(true);
    expect(statesCovered.has("CA")).toBe(true);
    expect(statesCovered.has("TX")).toBe(true);
    expect(statesCovered.has("FL")).toBe(true);

    const azStarter = statutes.find((s: any) => s.id === "az_hb2720_2721");
    expect(azStarter).toBeDefined();
    expect(azStarter.statute_citation).toContain("9-461.18"); // 9-467.04 does not exist in A.R.S.
    expect(azStarter.statute_url).toMatch(/^https?:\/\/www\.azleg\.gov/);

    const coTod = statutes.find((s: any) => s.id === "co_hb24_1313");
    expect(coTod).toBeDefined();
    expect(coTod.statute_citation).toContain("C.R.S. § 29-37-101"); // HB 24-1313 adds article 37; 29-35 is HB 24-1152
    expect(coTod.statute_url).toMatch(/^https?:\/\/leg\.colorado\.gov/);
  });

  it("21. county_completeness.json and ca_counties_registry.json are decoupled from app.js and compute empirical readiness tiers (Roadmap P1 Item 12)", () => {
    const compPath = path.join(rootDir, "app/data/county_completeness.json");
    expect(fs.existsSync(compPath)).toBe(true);

    const compIndex = JSON.parse(fs.readFileSync(compPath, "utf-8"));
    const fipsKeys = Object.keys(compIndex);
    expect(fipsKeys.length).toBeGreaterThanOrEqual(700);

    // Verify LA County
    const la = compIndex["06037"];
    expect(la).toBeDefined();
    expect(la.name).toBe("Los Angeles County");
    expect(la.state).toBe("CA");
    expect(la.readiness_tier).toBe("audited_A");
    expect(la.source_url).toMatch(/^https?:\/\//);
    expect(la.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify Travis County TX
    const travis = compIndex["48453"];
    expect(travis).toBeDefined();
    expect(travis.name).toBe("Travis County");
    expect(travis.state).toBe("TX");
    expect(["audited_A", "verified_B", "preliminary_C"]).toContain(travis.readiness_tier);

    // Check CA Counties Registry
    const caPath = path.join(rootDir, "app/data/ca_counties_registry.json");
    expect(fs.existsSync(caPath)).toBe(true);
    const caRegistry = JSON.parse(fs.readFileSync(caPath, "utf-8"));
    expect(Object.keys(caRegistry).length).toBe(58);
    expect(caRegistry["06037"].mpo).toContain("SCAG");
    expect(caRegistry["06037"].last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("22. renovationQuoteEngine evaluates contractor quote fairness, equity lift, statutory preemption, and EverySpace synergy", async () => {
    const { evaluateHomeownerRenovationQuote } = await import("../../src/engines/renovationQuoteEngine");

    // Case 1: Competitive detached ADU in Phoenix under AZ HB 2720
    const evalFair = evaluateHomeownerRenovationQuote({
      propertyAddress: "4521 N Central Ave",
      city: "Phoenix",
      stateCode: "AZ",
      countyFips: "04013",
      currentPropertyValue: 550_000,
      improvementType: "detached_adu",
      quotedTotalCost: 175_000,
      projectedSqft: 600,
      localHudFmr: { one_bed_1br: 1680 }
    });

    expect(evalFair.costFairnessRating).toBe("fair_market");
    expect(evalFair.statutoryEntitlementStatus.isByRight).toBe(true);
    expect(evalFair.statutoryEntitlementStatus.governingStatute).toContain("HB 2720");
    expect(evalFair.verdict).toBe("STRONG_BUY_RECOMMENDED");
    expect(evalFair.everySpaceMonthlyYieldUsd).toBe(1680);
    expect(evalFair.paybackYears).toBeLessThanOrEqual(9.0);

    // Case 2: Substantially overpriced ADU quote
    const evalOverpriced = evaluateHomeownerRenovationQuote({
      city: "Austin",
      stateCode: "TX",
      currentPropertyValue: 600_000,
      improvementType: "attached_adu",
      quotedTotalCost: 350_000,
      projectedSqft: 500
    });

    expect(evalOverpriced.costFairnessRating).toBe("substantially_overpriced");
    expect(evalOverpriced.verdict).toBe("OVERPRICED_RENEGOTIATE");
    expect(evalOverpriced.suggestedNegotiationPoints.length).toBeGreaterThanOrEqual(2);

    // Case 3: Major kitchen remodel lifestyle evaluation with higher-ROI alternatives
    const evalKitchen = evaluateHomeownerRenovationQuote({
      city: "Denver",
      stateCode: "CO",
      currentPropertyValue: 650_000,
      improvementType: "kitchen_remodel_major",
      quotedTotalCost: 70_000,
      projectedSqft: 300
    });

    expect(evalKitchen.costFairnessRating).toBe("fair_market");
    expect(evalKitchen.verdict).toBe("FAIR_LIFESTYLE_IMPROVEMENT");
    expect(evalKitchen.alternativeHigherRoiOptions.length).toBeGreaterThanOrEqual(1);
    expect(evalKitchen.alternativeHigherRoiOptions.some(a => a.alternativeType.includes("ADU"))).toBe(true);
  });

  it("23. streetForgeEngine models lane reallocation opportunity costs, emissions, safety, and EV charger siting", async () => {
    const { evaluateRightOfWayReallocation, evaluateEvChargerSiting } = await import("../../src/engines/streetForgeEngine");

    // Case 1: Drive lane conversion to protected bike lane
    const bikeEval = evaluateRightOfWayReallocation({
      corridorName: "S Congress Ave / First St",
      city: "Austin",
      stateCode: "TX",
      lengthMiles: 2.4,
      currentDriveLanes: 4,
      currentAadt: 16_000,
      reallocationType: "protected_bike_lane",
      adjacentRetailBusinessesCount: 42
    });

    expect(bikeEval.capitalCostUsd).toBeGreaterThan(500_000);
    expect(bikeEval.grantFundingAvailableUsd).toBeGreaterThan(400_000); // 75% federal SS4A match
    expect(bikeEval.pollutionAndEmissions.co2TonsAvoidedAnnual).toBeGreaterThan(20);
    expect(bikeEval.safetyAndWalkability.crashReductionPct).toBe(42);
    expect(bikeEval.economicUplift.projectedAdjacentRetailSalesLiftPct).toBe(14.5);
    expect(bikeEval.benefitCostRatio).toBeGreaterThanOrEqual(1.5);
    expect(bikeEval.applicableGrants).toContain("USDOT Safe Streets and Roads for All (SS4A) Discretionary Grant");

    // Case 2: EV Fast Charger Siting in underused commercial parking lot
    const evEval = evaluateEvChargerSiting({
      locationName: "East Austin Plaza Infill Lot",
      parkingLotAcres: 3.2,
      existingParkingStalls: 140,
      chargerType: "dc_fast_charger_150kw",
      numberOfPorts: 4,
      distanceToThreePhasePowerMeters: 45, // close to power (< 50m)
      isJustice40DisadvantagedTract: true,
      stateCode: "TX"
    });

    expect(evEval.sitingSuitabilityScore).toBeGreaterThanOrEqual(85);
    expect(evEval.taxCreditsAndGrants.incentiveFundingSharePct).toBeGreaterThanOrEqual(60);
    expect(evEval.economics.netAnnualOperatingIncomeUsd).toBeGreaterThan(0);
    expect(evEval.economics.simplePaybackYears).toBeLessThanOrEqual(5.0);
    expect(evEval.sitingRecommendation).toContain("PRIME SITING OPPORTUNITY");
  });

  it("24. everySpaceEngine calculates multi-channel holding space monetization to offset carrying costs", async () => {
    const { evaluateEverySpaceMonetization } = await import("../../src/engines/everySpaceEngine");

    const holdEval = evaluateEverySpaceMonetization({
      propertyAddress: "1420 E 12th St",
      city: "Austin",
      stateCode: "TX",
      countyFips: "48453",
      bedrooms: 3,
      bathrooms: 2,
      lotSqft: 7200,
      livingSqft: 1650,
      monthlyDebtServiceMortgageUsd: 2200,
      monthlyPropertyTaxAndInsuranceUsd: 650,
      plannedHoldingMonths: 18,
      features: {
        hasDriveway: true,
        drivewaySpacesCount: 2,
        hasAtticOrBasementStorage: true,
        storageSqft: 300,
        hasPool: true,
        hasAvailableRoofSqftForSolar: true,
        availableRoofSqft: 1400,
        hasExistingGarageForConversion: true,
        hasExistingCasitaOrAdu: false
      },
      localHudFmr: {
        zero_bed_eff: 1350,
        one_bed_1br: 1580,
        two_bed_2br: 1920
      }
    });

    expect(holdEval.channels.length).toBe(4); // driveway, storage, pool, solar
    expect(holdEval.totalMonthlyEverySpaceGrossRevenueUsd).toBeGreaterThan(1500);
    expect(holdEval.monthlyHoldingDeficitReductionPct).toBeGreaterThanOrEqual(50);
    expect(holdEval.cumulativeEverySpaceEarningsOverHoldUsd).toBeGreaterThan(25_000);
    expect(holdEval.netEquityPreservedOverHoldUsd).toBe(holdEval.cumulativeEverySpaceEarningsOverHoldUsd);
  });
});
