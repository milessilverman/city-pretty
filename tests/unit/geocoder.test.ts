// Unit tests for geocoder state-name resolution (P0-3).
// Ensures ArcGIS World Geocoder full state names ("Maryland", "North Carolina", etc.)
// map to 2-letter codes and strictly match, preventing substring collisions (e.g. "maryland" matching "AR").
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const appJs = fs.readFileSync(path.join(root, "app/app.js"), "utf8");

const sandbox: any = {};
const fnCode = appJs.slice(
  appJs.indexOf("const STATE_NAME_TO_ABBR ="),
  appJs.indexOf("async function geocodeUS(text)")
);
new Function("window", fnCode)(sandbox);
const { resolveCountyFipsFromArcGisAttrs, STATE_NAME_TO_ABBR } = sandbox;

// Load real counties from index.html
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const bundleMatches = [...indexHtml.matchAll(/<script type="application\/json" class="county-bundle"[^>]*data-fips="([^"]+)"[^>]*data-name="([^"]+)"[^>]*data-st="([^"]+)"/g)];
const realCounties = bundleMatches.map(m => ({
  dataset: { fips: m[1], name: m[2], st: m[3] }
}));

describe("geocoder state matching (P0-3)", () => {
  it("STATE_NAME_TO_ABBR maps state names correctly", () => {
    expect(STATE_NAME_TO_ABBR["maryland"]).toBe("MD");
    expect(STATE_NAME_TO_ABBR["north carolina"]).toBe("NC");
    expect(STATE_NAME_TO_ABBR["georgia"]).toBe("GA");
    expect(STATE_NAME_TO_ABBR["mississippi"]).toBe("MS");
    expect(STATE_NAME_TO_ABBR["missouri"]).toBe("MO");
    expect(STATE_NAME_TO_ABBR["rhode island"]).toBe("RI");
    expect(STATE_NAME_TO_ABBR["washington"]).toBe("WA");
  });

  it("1. Washington MD resolves to Washington MD (24043), not Washington AR (05143)", () => {
    const candidates = [
      { dataset: { fips: "05143", name: "Washington County", st: "AR" } },
      { dataset: { fips: "24043", name: "Washington County", st: "MD" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Washington County", Region: "Maryland" }, candidates);
    expect(fips).toBe("24043");
    expect(fips).not.toBe("05143");
  });

  it("2. Orange NC resolves to Orange NC (37135), not Orange CA (06059)", () => {
    const candidates = [
      { dataset: { fips: "06059", name: "Orange County", st: "CA" } },
      { dataset: { fips: "37135", name: "Orange County", st: "NC" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Orange County", Region: "North Carolina" }, candidates);
    expect(fips).toBe("37135");
    expect(fips).not.toBe("06059");
  });

  it("3. Douglas GA resolves to Douglas GA (13097), not Douglas OR (41019)", () => {
    const candidates = [
      { dataset: { fips: "41019", name: "Douglas County", st: "OR" } },
      { dataset: { fips: "13097", name: "Douglas County", st: "GA" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Douglas County", Region: "Georgia" }, candidates);
    expect(fips).toBe("13097");
    expect(fips).not.toBe("41019");
  });

  it("4. Jackson MS resolves to Jackson MS (28059), not Jackson MI (26075)", () => {
    const candidates = [
      { dataset: { fips: "26075", name: "Jackson County", st: "MI" } },
      { dataset: { fips: "28059", name: "Jackson County", st: "MS" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Jackson County", Region: "Mississippi" }, candidates);
    expect(fips).toBe("28059");
    expect(fips).not.toBe("26075");
  });

  it("5. Jackson MO resolves to Jackson MO (29095), not Jackson MI (26075)", () => {
    const candidates = [
      { dataset: { fips: "26075", name: "Jackson County", st: "MI" } },
      { dataset: { fips: "29095", name: "Jackson County", st: "MO" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Jackson County", Region: "Missouri" }, candidates);
    expect(fips).toBe("29095");
    expect(fips).not.toBe("26075");
  });

  it("6. Kent RI resolves to Kent RI (44003), not Kent DE (10001)", () => {
    const candidates = [
      { dataset: { fips: "10001", name: "Kent County", st: "DE" } },
      { dataset: { fips: "44003", name: "Kent County", st: "RI" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Kent County", Region: "Rhode Island" }, candidates);
    expect(fips).toBe("44003");
    expect(fips).not.toBe("10001");
  });

  it("7. Clark WA resolves to Clark WA (53011), not Clark IN (18019)", () => {
    const candidates = [
      { dataset: { fips: "18019", name: "Clark County", st: "IN" } },
      { dataset: { fips: "53011", name: "Clark County", st: "WA" } },
    ];
    const fips = resolveCountyFipsFromArcGisAttrs({ Subregion: "Clark County", Region: "Washington" }, candidates);
    expect(fips).toBe("53011");
    expect(fips).not.toBe("18019");
  });

  it("resolves accurately against the full live county bundle list", () => {
    expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Orange County", Region: "North Carolina" }, realCounties)).toBe("37135");
    expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Orange County", Region: "California" }, realCounties)).toBe("06059");
    expect(resolveCountyFipsFromArcGisAttrs({ Subregion: "Jackson County", Region: "Missouri" }, realCounties)).toBe("29095");
  });
});
