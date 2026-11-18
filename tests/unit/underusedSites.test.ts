import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { computeScreeningEstimate, SCREENING_ASSUMPTIONS, evaluateGolfCourseConversion, evaluateParkingLotConversion } from "../../src/engines/underusedLandEngine";

const rootDir = path.resolve(__dirname, "../..");
const sites: any[] = JSON.parse(fs.readFileSync(path.join(rootDir, "app/data/underused_sites.json"), "utf-8"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsEngine = require(path.join(rootDir, "src/engines/underusedLandEngine.js"));

describe("underused_sites.json provenance", () => {
  it("has sites, and every record carries a verification block", () => {
    expect(sites.length).toBeGreaterThan(0);
    for (const s of sites) {
      const v = s.verification;
      expect(v, s.id).toBeTruthy();
      expect(typeof v.status).toBe("string");
      expect(v.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.evidence_url).toMatch(/^https?:\/\//);
      expect(Array.isArray(v.fields_measured)).toBe(true);
      expect(v.fields_measured.length).toBeGreaterThan(0);
      expect(Array.isArray(v.fields_null)).toBe(true);
      // a field cannot be both measured and null
      for (const f of v.fields_null) expect(v.fields_measured, `${s.id}.${f}`).not.toContain(f);
      // every field listed as null really is null
      for (const f of v.fields_null) expect(s[f] ?? null, `${s.id}.${f}`).toBeNull();
    }
  });

  it("does not store model outputs as facts at the top level", () => {
    for (const s of sites) {
      expect(s.potentialHomes).toBeNull();
      expect(s.margin).toBeNull();
      expect(s.marketLandValue).toBeNull();
      expect(s.idea).toBeNull();
    }
  });

  it("every screening_estimate is reproducible by the engine from the record's own measured fields", () => {
    for (const s of sites) {
      const e = s.screening_estimate;
      expect(e, s.id).toBeTruthy();
      expect(e.model).toBe("underused-screening-v1");
      const again = computeScreeningEstimate(s);
      expect(again, s.id).toEqual(e);
      // the stored inputs are the record's measured values, not separate typed numbers
      expect(e.inputs.acres.value).toBe(s.acres);
      expect(e.inputs.medianHomeValue.value).toBe(s.neighborhoodMedianHv);
      expect(e.inputs.assessedLandValue.value).toBe(s.assessedLandValue);
      // JS twin gives the same answer
      expect(jsEngine.computeScreeningEstimate(s)).toEqual(e);
    }
  });

  it("every assumption used is flagged assumed or carries a source", () => {
    for (const s of sites) {
      for (const k of ["shareDeveloped", "homesPerAcre", "finishedValueRatio", "costPerHome"]) {
        const p = s.screening_estimate.inputs[k];
        expect(p.assumed || typeof p.source === "string", `${s.id}.${k}`).toBe(true);
      }
    }
  });

  it("homes and margin are null whenever an input is missing", () => {
    for (const s of sites) {
      const e = s.screening_estimate;
      if (s.neighborhoodMedianHv == null) { expect(e.margin).toBeNull(); expect(e.finishedValuePerHome).toBeNull(); }
      if (s.assessedLandValue == null) expect(e.margin).toBeNull();
      if (e.margin != null) expect(e.potentialHomes).not.toBeNull();
    }
  });
});

describe("underusedLandEngine screening estimate", () => {
  const base: any = { kind: "parking lot", acres: 2, distanceToRailMeters: 300, assessedLandValue: 1_000_000, neighborhoodMedianHv: 500_000 };

  it("returns null homes and margin when inputs are missing", () => {
    expect(computeScreeningEstimate({ ...base, acres: null }).potentialHomes).toBeNull();
    expect(computeScreeningEstimate({ ...base, neighborhoodMedianHv: null }).margin).toBeNull();
    expect(computeScreeningEstimate({ ...base, assessedLandValue: null }).margin).toBeNull();
    expect(computeScreeningEstimate({ ...base, assessedLandValue: null }).potentialHomes).not.toBeNull();
    const e = computeScreeningEstimate({ ...base, neighborhoodMedianHv: null, assessedLandValue: null });
    expect(e.missing_inputs).toEqual(expect.arrayContaining(["medianHomeValue", "assessedLandValue"]));
  });

  it("is reproducible by hand from the named assumptions", () => {
    const A = SCREENING_ASSUMPTIONS;
    const e = computeScreeningEstimate(base);
    const homes = Math.round(2 * A.shareDeveloped["parking lot"].value * A.homesPerAcre["parking lot"].nearRail.value);
    const fv = Math.round(500_000 * A.finishedValueRatio.value);
    expect(e.potentialHomes).toBe(homes);
    expect(e.margin).toBe(homes * (fv - A.costPerHome.value) - Math.round(1_000_000 * A.shareDeveloped["parking lot"].value));
    expect(e.marketLandValue).toBeNull();
  });

  it("ignores typed legacy potentialHomes / margin on a site", () => {
    const g = evaluateGolfCourseConversion({ ...base, kind: "golf course", id: "x", name: null, countyFips: "06037", potentialHomes: 9999, margin: 123, idea: "typed" } as any);
    expect(g.potentialHomes).not.toBe(9999);
    expect(g.netDevelopmentMargin).not.toBe(123);
    const p = evaluateParkingLotConversion({ ...base, id: "y", name: null, countyFips: "48453", potentialHomes: 9999 } as any);
    expect(p.applicableStatutes).toEqual([]); // California statutes are not attached to Texas sites
  });
});
