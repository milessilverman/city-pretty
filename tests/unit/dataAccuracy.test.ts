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
    expect(studies.length).toBeGreaterThanOrEqual(50);

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
      expect(statute.bill_number).toBeTruthy();
      expect(statute.statute_citation).toBeTruthy();
      expect(statute.statute_url).toMatch(/^https?:\/\//);
      expect(statute.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
      expect(prog.statutory_citation).toBeTruthy();
      expect(prog.source_url).toMatch(/^https?:\/\//);
      expect(prog.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(prog.eligible_improvements)).toBe(true);
      expect(prog.eligible_improvements.length).toBeGreaterThan(0);
    }
  });

  it("4. case_studies.json contains verified historical projects with published evaluations", () => {
    const casePath = path.join(rootDir, "app/data/case_studies.json");
    expect(fs.existsSync(casePath)).toBe(true);

    const cases = JSON.parse(fs.readFileSync(casePath, "utf-8"));
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(8);

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
      expect(p.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
      expect(r.one_bed_1br).toBeGreaterThan(500);
      expect(r.two_bed_2br).toBeGreaterThan(r.one_bed_1br);
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
    expect(golfEval.potentialHomes).toBe(480);
    expect(golfEval.netDevelopmentMargin).toBe(25000000);
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
    expect(austinHome.min_lot_size_sqft).toBe(1500);
    expect(austinHome.max_units_by_right).toBe(3);
    expect(austinHome.statute_url).toMatch(/^https?:\/\//);
    expect(austinHome.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const txAdu = laws.find((l: any) => l.id === "tx_adu_statute");
    expect(txAdu).toBeDefined();
    expect(txAdu.state_code).toBe("TX");
    expect(txAdu.statute_url).toMatch(/^https?:\/\//);
  });
});
