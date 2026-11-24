import { describe, expect, it } from "vitest";
import { makeGeoRef, makeQuantity } from "../../../src/platform/schema/index.js";
import {
  CONTRACT_VERSION, OBSERVED_CAPABILITIES, createMockStreetForge, describeCapabilities, validateRequest, validateResponse,
} from "../../../src/platform/streetforge/index.js";

// FIXTURE: not real data
const SRC = { title: "FIXTURE", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const seg = (kind: any = "street_segment") =>
  makeGeoRef({ kind, id: "fx-1", jurisdiction: { state: "XX", countyFips: "00000" },
    geometry: kind === "street_segment" ? { type: "LineString", coordinates: [[0, 0], [0, 1]] } : { type: "Point", coordinates: [0, 0] } });
const req = (over: any = {}) => ({ contractVersion: CONTRACT_VERSION, segment: seg(), proposedChange: { categoryId: "bike_lane", parameters: {} }, asOf: "2000-01-01", ...over });
const fxCost = () => makeQuantity({ value: 1, unit: "fx", low: 1, high: 2, status: "verified", source: SRC, jurisdiction: "XX", effectiveDate: "2000-01-01" });

describe("validateRequest", () => {
  it("accepts a street change on a street segment", () => expect(validateRequest(req()).valid).toBe(true));
  it("rejects non-street categories, wrong kinds and bad versions", () => {
    expect(validateRequest(req({ proposedChange: { categoryId: "park", parameters: {} } })).valid).toBe(false);
    expect(validateRequest(req({ proposedChange: { categoryId: "nope", parameters: {} } })).valid).toBe(false);
    expect(validateRequest(req({ segment: seg("point") })).valid).toBe(false);
    expect(validateRequest(req({ contractVersion: "0" })).valid).toBe(false);
    expect(validateRequest(req({ asOf: "" })).valid).toBe(false);
    expect(validateRequest(null).valid).toBe(false);
  });
});

describe("mock adapter", () => {
  it("returns a design and unavailable cost and quantities", () => {
    const r = createMockStreetForge().respond(req());
    expect(r.mock).toBe(true);
    expect(r.fixture).toBeUndefined();
    expect(r.design.format).toBe("streetforge-project");
    expect(r.cost.value).toBeNull();
    expect(r.cost.status).toBe("unavailable");
    expect(r.cost.method).toMatch(/no cost output/);
    expect(r.quantities.every((q: any) => q.value === null)).toBe(true);
    expect(r.capabilities).toEqual([...OBSERVED_CAPABILITIES]);
    expect(validateResponse(r).valid).toBe(true);
  });
  it("refuses an invalid request", () => {
    expect(() => createMockStreetForge().respond(req({ asOf: "x" }))).toThrow();
  });
  it("refuses fixture cost without an explicit capabilities override", () => {
    expect(() => createMockStreetForge({ fixtures: { cost: fxCost() } })).toThrow();
    expect(() => createMockStreetForge({ fixtures: { cost: fxCost(), capabilities: [...OBSERVED_CAPABILITIES] } })).toThrow();
  });
  it("allows fixture cost with an override and flags it", () => {
    const r = createMockStreetForge({ fixtures: { cost: fxCost(), capabilities: [...OBSERVED_CAPABILITIES, "cost_estimate"] } }).respond(req());
    expect(r.fixture).toBe(true);
    expect(r.cost.value).toBe(1);
    expect(validateResponse(r).valid).toBe(true);
  });
});

describe("validateResponse", () => {
  const base = () => createMockStreetForge().respond(req());
  it("rejects a cost value without the cost_estimate capability", () => {
    const v = validateResponse({ ...base(), cost: fxCost() });
    expect(v.valid).toBe(false);
    expect(v.errors.join()).toMatch(/cost_estimate/);
  });
  it("rejects quantity values without the quantities capability", () => {
    const v = validateResponse({ ...base(), quantities: [fxCost()] });
    expect(v.valid).toBe(false);
    expect(v.errors.join()).toMatch(/quantities/);
  });
  it("rejects malformed designs and non-Quantity cost", () => {
    expect(validateResponse({ ...base(), design: { format: "other" } }).valid).toBe(false);
    expect(validateResponse({ ...base(), cost: 5 }).valid).toBe(false);
    expect(validateResponse({ ...base(), design: null }).valid).toBe(true);
  });
});

describe("describeCapabilities", () => {
  it("never claims cost, API or funding as a capability", () => {
    const text = describeCapabilities().join(" ");
    expect(text).toMatch(/PNG/);
    expect(text).toMatch(/does not provide a cost estimate/);
    expect(text).not.toMatch(/\bAPI\b|postMessage/);
  });
});
