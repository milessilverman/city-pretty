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
});
