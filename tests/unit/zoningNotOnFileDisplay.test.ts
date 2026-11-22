import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore plain ES module script
import { grabFunction } from "../../scripts/check_engine_copies.mjs";
import { auditSingleHouseParcel } from "../../src/engines/parcelHouseAuditor";

// Two display bugs found in the ease-of-use audit (docs/audit/usability-2026-11-20.md), corrected 22 Nov 2026.
const APP = fs.readFileSync(path.resolve(__dirname, "../../app/app.js"), "utf8");

// zoningSection and getActiveZoningSummary run in the page; they are lifted out of app/app.js and run against stubs.
function zoningSectionWith(viewZones: unknown[], m: Record<string, unknown>) {
  const src = `${grabFunction(APP, "getActiveZoningSummary")}\n${grabFunction(APP, "zoningSection")}\nreturn zoningSection;`;
  const make = new Function("_dynZoneFeats", "countyOf", "activeState", "statuteBulletsForState", "esc", "ZCOL", "zoneSentence", src);
  return make(viewZones, () => "Kent County", () => "MD", () => [] as string[], (x: unknown) => String(x), {}, () => "")(m) as string;
}

describe("neighborhood Zoning section: only the selected area's zoning", () => {
  const leftOver = [{ cat: "single-family", zone: "SF-3-NP" }, { cat: "single-family", zone: "SF-3-NP" }];
  it("does not call the zones loaded for the map view the area's zoning", () => {
    const html = zoningSectionWith(leftOver, { c: "Rock Hall" });
    expect(html).not.toContain("SF-3-NP");
    expect(html).not.toContain("Predominant zoning");
    expect(html).toContain("Zoning for this area is not on file");
    expect(html).toContain("no zoning shares for this area");
  });
  it("still shows the area's own zoning shares when the county file has them", () => {
    const html = zoningSectionWith(leftOver, { c: "Rock Hall", z: { sh: { "single-family": 1 }, top: "R-1 100%", j: "Rock Hall" } });
    expect(html).toContain("Predominant zoning in");
    expect(html).toContain("R-1 100%");
    expect(html).not.toContain("not on file");
  });
  it("switching county clears the zones left from the other county's map view", () => {
    expect(grabFunction(APP, "switchCounty")).toMatch(/_dynZoneFeats = \[\]/);
  });
});

describe("a lot whose zone is on file is never reported as having no zoning", () => {
  const BASE = { lat: 34.0779, lng: -118.4744, stateCode: "CA", countyFips: "06037", parcelId: "4429037025", lotSqft: 4913217 };
  it("the audit says the zone is on file, and which one", () => {
    const z = auditSingleHouseParcel({ ...BASE, zoningCode: "A1-1-H" }).statutoryZoning;
    expect(z.zoningOnFile).toBe(true);
    expect(z.baseZoningCode).toBe("A1-1-H");
    expect(z.statutoryNotes).not.toMatch(/not on file for this parcel/);
  });
  it("with no zone the audit says so", () => {
    const z = auditSingleHouseParcel({ ...BASE, zoningCode: null }).statutoryZoning;
    expect(z.zoningOnFile).toBe(false);
    expect(z.baseZoningCode).toBeNull();
    expect(z.statutoryNotes).toMatch(/not on file for this parcel/);
  });
  it("the page's ADU line separates 'zoning not on file' from 'zone on file but not screened'", () => {
    expect(APP).not.toContain("zoning not on file or historic district");
    expect(APP).toContain("is on file, but it is not a single-family or commercial zone the screen covers");
  });
  it("a lot whose zone is on file but whose rules are not says exactly that", () => {
    expect(APP).toContain("is on file; its rules are not on file");
  });
  it("the playbook falls back to the open lot's point when a caller passes none", () => {
    expect(grabFunction(APP, "computePropertyPlaybook")).toMatch(/if \(!ll && typeof activeHouse/);
  });
});
