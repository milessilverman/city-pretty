import { describe, expect, it } from "vitest";
import {
  CHECK_RESULTS, GEO_KINDS, IMPROVEMENT_CATEGORIES, QUANTITY_STATUSES, VALUE_STREAM_KEYS,
  addQ, bboxOf, categoriesFor, centroidOf, deriveStatus, getCategory, haversineM, isQuantity,
  makeGeoRef, makeOpportunity, makeQuantity, makeUseOption, makeValueStreams, mulQ, scaleQ, subQ,
  sumValueStreams, unknownQuantity, validateGeoRef, weakestStatus,
} from "../../../src/platform/schema/index.js";

// FIXTURE: not real data
const SRC = { title: "FIXTURE", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const q = (value: number, low: number, high: number, over: any = {}) =>
  makeQuantity({ value, unit: "u", low, high, status: "verified", source: SRC, jurisdiction: "XX", effectiveDate: "2000-01-01", ...over });
const assumed = (value: number, low: number, high: number, over: any = {}) =>
  makeQuantity({ value, unit: "u", low, high, status: "assumed", assumptions: ["fixture scenario"], jurisdiction: "XX", effectiveDate: "2000-01-01", ...over });

describe("quantity", () => {
  it("builds a valid quantity and freezes it", () => {
    const x = q(5, 4, 6);
    expect(isQuantity(x)).toBe(true);
    expect(Object.isFrozen(x)).toBe(true);
  });
  it.each([
    ["unit", { unit: "" }], ["jurisdiction", { jurisdiction: "" }], ["effectiveDate", { effectiveDate: "" }],
    ["low", { low: undefined }], ["high", { high: undefined }], ["value outside range", { low: 6, high: 7 }],
    ["source and assumptions", { source: null }], ["source missing url", { source: { title: "t", retrieved: "2000-01-01" } }],
    ["assumptions without assumed status", { source: null, assumptions: ["a"], status: "estimated" }],
  ])("refuses a number lacking %s", (_n, over) => {
    expect(() => q(5, 4, 6, over)).toThrow();
  });
  it("accepts assumptions with status assumed in place of a source", () => {
    expect(assumed(5, 4, 6).status).toBe("assumed");
    expect(() => assumed(5, 4, 6, { assumptions: [] })).toThrow();
  });
  it("unknownQuantity gives a null form with a reason", () => {
    const u = unknownQuantity("u", "no dataset ingested", { status: "unavailable" });
    expect(u).toMatchObject({ value: null, low: null, high: null, status: "unavailable", method: "no dataset ingested" });
    expect(isQuantity(u)).toBe(true);
    expect(unknownQuantity("u", "r").status).toBe("requires_investigation");
    expect(() => unknownQuantity("u", "")).toThrow();
  });
  it("interval arithmetic known answers", () => {
    const a = q(5, 4, 6), b = q(2, 1, 3);
    expect(addQ(a, b)).toMatchObject({ value: 7, low: 5, high: 9 });
    expect(subQ(a, b)).toMatchObject({ value: 3, low: 1, high: 5 });
    expect(mulQ(a, b)).toMatchObject({ value: 10, low: 4, high: 18 });
    expect(scaleQ(a, 2)).toMatchObject({ value: 10, low: 8, high: 12 });
    expect(scaleQ(a, -2)).toMatchObject({ value: -10, low: -12, high: -8 });
  });
  it("mulQ handles negative bounds", () => {
    const a = q(1, -2, 3), b = q(-1, -4, 2);
    // corners: 8, -4, -12, 6
    expect(mulQ(a, b)).toMatchObject({ value: -1, low: -12, high: 8 });
    const c = q(-3, -5, -2), d = q(-2, -3, -1);
    expect(mulQ(c, d)).toMatchObject({ value: 6, low: 2, high: 15 });
  });
  it("unions inputs and assumptions, earliest date, common jurisdiction or mixed", () => {
    const a = q(1, 1, 1, { label: "A", effectiveDate: "2001-05-05" });
    const b = assumed(1, 1, 1, { label: "B", jurisdiction: "YY", effectiveDate: "2000-02-02" });
    const r = addQ(a, b);
    expect([...r.inputs].sort()).toEqual(["A", "B"]);
    expect(r.assumptions).toEqual(["fixture scenario"]);
    expect(r.effectiveDate).toBe("2000-02-02");
    expect(r.jurisdiction).toBe("mixed");
    expect(addQ(a, q(1, 1, 1)).jurisdiction).toBe("XX");
  });
  it("status downgrades to the weakest operand", () => {
    const v = q(1, 1, 1), a = assumed(1, 1, 1);
    expect(addQ(v, a).status).toBe("assumed");
    expect(addQ(v, v).status).toBe("estimated");
    expect(weakestStatus(["verified", "assumed", "estimated"])).toBe("assumed");
    expect(weakestStatus(["verified", "requires_investigation"])).toBe("requires_investigation");
    expect(QUANTITY_STATUSES[0]).toBe("verified");
  });
  it("a null operand gives a null result carrying the reason", () => {
    const u = unknownQuantity("u", "cost not ingested");
    for (const r of [addQ(q(1, 1, 1), u), subQ(u, q(1, 1, 1)), mulQ(q(1, 1, 1), u), scaleQ(u, 3)]) {
      expect(r.value).toBeNull();
      expect(r.low).toBeNull();
      expect(r.status).toBe("requires_investigation");
      expect(r.method).toContain("cost not ingested");
    }
  });
  it("add and sub refuse incompatible units", () => {
    expect(() => addQ(q(1, 1, 1), q(1, 1, 1, { unit: "other" }))).toThrow(/incompatible/);
    expect(() => subQ(q(1, 1, 1), q(1, 1, 1, { unit: "other" }))).toThrow(/incompatible/);
  });
});

// FIXTURE: not real data
const J = { state: "XX", countyFips: "00000" };
const sq = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];
describe("geo", () => {
  it("validates every kind with its geometry", () => {
    const ok: Record<string, any> = {
      point: { type: "Point", coordinates: [0, 0] },
      parcel: { type: "Polygon", coordinates: [sq] },
      street_segment: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
      asset: { type: "Point", coordinates: [0, 0] },
      block_group: { type: "Polygon", coordinates: [sq] },
      area: { type: "Polygon", coordinates: [sq] },
    };
    expect(Object.keys(ok).sort()).toEqual([...GEO_KINDS].sort());
    for (const k of GEO_KINDS) {
      const r = makeGeoRef({ kind: k, id: "f1", jurisdiction: J, geometry: ok[k] });
      expect(r.crs).toBe("EPSG:4326");
      expect(r.jurisdiction).toEqual({ country: "US", state: "XX", countyFips: "00000", place: null });
    }
    expect(validateGeoRef({ kind: "parcel", id: "x", crs: "EPSG:4326", jurisdiction: { country: "US", ...J, place: null }, geometry: ok.point }).valid).toBe(false);
    expect(() => makeGeoRef({ kind: "nope" as any, id: "f", jurisdiction: J, geometry: ok.point })).toThrow();
  });
  it("rejects coordinates outside WGS84 bounds and malformed geometry", () => {
    const mk = (geometry: any) => () => makeGeoRef({ kind: "point", id: "f", jurisdiction: J, geometry });
    expect(mk({ type: "Point", coordinates: [181, 0] })).toThrow(/longitude/);
    expect(mk({ type: "Point", coordinates: [0, 91] })).toThrow(/latitude/);
    expect(mk({ type: "Point", coordinates: [0, NaN] })).toThrow();
    expect(() => makeGeoRef({ kind: "parcel", id: "f", jurisdiction: J, geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0]]] } as any })).toThrow();
  });
  it("haversine known answers", () => {
    expect(haversineM([0, 0], [0, 0])).toBe(0);
    // quarter of the equator is a quarter circumference: pi/2 * R
    expect(haversineM([0, 0], [90, 0])).toBeCloseTo((Math.PI / 2) * 6371008.8, 3);
    expect(haversineM([0, 0], [0, 90])).toBeCloseTo((Math.PI / 2) * 6371008.8, 3);
    expect(haversineM([10, 20], [30, 40])).toBeCloseTo(haversineM([30, 40], [10, 20]), 6);
    expect(() => haversineM([0, 0], [0, 100])).toThrow();
  });
  it("bbox and centroid helpers", () => {
    expect(bboxOf({ type: "Polygon", coordinates: [sq] } as any)).toEqual([0, 0, 1, 1]);
    expect(centroidOf({ type: "Polygon", coordinates: [sq] } as any)).toEqual([0.5, 0.5]);
    expect(centroidOf({ type: "LineString", coordinates: [[0, 0], [2, 0]] } as any)).toEqual([1, 0]);
    expect(centroidOf({ type: "Point", coordinates: [3, 4] } as any)).toEqual([3, 4]);
  });
});

const parcelRef = makeGeoRef({ kind: "parcel", id: "p1", jurisdiction: J, geometry: { type: "Polygon", coordinates: [sq] } as any });
describe("categories", () => {
  const PARCEL_IDS = ["underused_land", "surface_parking", "vacant_land", "ageing_retail", "brownfield", "assembly", "lot_split", "adu",
    "densification", "office_to_residential", "mixed_use", "air_rights", "shared_parking", "p3_mixed_use", "park_with_development",
    "industrial_revitalisation", "commercial_revitalisation"];
  it("lists all 17 parcel categories with requiredInputs", () => {
    const parcel = IMPROVEMENT_CATEGORIES.filter((c) => c.family === "parcel_development");
    expect(parcel.map((c) => c.id).sort()).toEqual([...PARCEL_IDS].sort());
    for (const c of IMPROVEMENT_CATEGORIES) expect(c.requiredInputs.length).toBeGreaterThan(0);
  });
  it("covers street, open space, transit, utility and facility, and is frozen with unique ids", () => {
    for (const f of ["street", "open_space", "transit", "utility_energy", "facility"]) {
      expect(IMPROVEMENT_CATEGORIES.some((c) => c.family === f)).toBe(true);
    }
    for (const id of ["bike_lane", "bus_lane", "traffic_calming", "crosswalk", "street_trees", "sidewalk", "street_lighting", "road_diet",
      "park", "pocket_park", "rail_station", "brt", "bus_shelter", "ev_charger", "solar_microgrid", "undergrounding", "grocery", "clinic", "library", "school_upgrade"]) {
      expect(getCategory(id)).not.toBeNull();
    }
    expect(new Set(IMPROVEMENT_CATEGORIES.map((c) => c.id)).size).toBe(IMPROVEMENT_CATEGORIES.length);
    expect(Object.isFrozen(IMPROVEMENT_CATEGORIES)).toBe(true);
    expect(getCategory("nope")).toBeNull();
    expect(categoriesFor("street_segment").every((c) => c.appliesTo.includes("street_segment"))).toBe(true);
    expect(categoriesFor("parcel").length).toBeGreaterThanOrEqual(17);
  });
  it("distinct impact model ids for non-parcel categories (no shared model)", () => {
    const ids = IMPROVEMENT_CATEGORIES.map((c) => c.impactModelId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("opportunity", () => {
  const pass = { result: "pass" } as const;
  const unk = { result: "unknown", missing: ["cost"] } as const;
  const fail = { result: "fail", reason: "exceeds height limit", basis: "regulatory" } as const;
  it("viable is impossible unless all three checks pass", () => {
    expect(deriveStatus({ financial: pass, regulatory: pass, engineering: pass })).toBe("viable");
    expect(deriveStatus({ financial: pass, regulatory: pass })).toBe("candidate");
    expect(deriveStatus({})).toBe("candidate");
    expect(() => makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "exhaustive",
      checks: { financial: pass, regulatory: pass }, status: "viable" })).toThrow(/contradicts/);
    expect(makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "ai_exploration" }).status).toBe("candidate");
  });
  it("any unknown check gives needs_info and lists missing inputs", () => {
    const o = makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "exhaustive",
      checks: { financial: unk, regulatory: pass, engineering: pass } });
    expect(o.status).toBe("needs_info");
    expect(o.missingInputs).toEqual(["cost"]);
    expect(() => deriveStatus({ financial: { result: "maybe" } as any })).toThrow();
    expect(() => makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "exhaustive",
      checks: { financial: { result: "unknown" } } })).toThrow(/missing/);
    expect(CHECK_RESULTS).toEqual(["pass", "fail", "unknown"]);
  });
  it("a fail rejects and needs a reason", () => {
    const o = makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "exhaustive",
      checks: { financial: unk, regulatory: fail, engineering: pass } });
    expect(o.status).toBe("rejected");
    expect(o.rejectionReasons).toEqual([{ check: "regulatory", basis: "regulatory", reason: "exceeds height limit" }]);
    expect(() => makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "exhaustive",
      checks: { financial: { result: "fail" } } })).toThrow(/reason/);
  });
  it("validates category, applicability and discoveredBy", () => {
    expect(() => makeOpportunity({ id: "o", categoryId: "bike_lane", location: parcelRef, discoveredBy: "exhaustive" })).toThrow(/does not apply/);
    expect(() => makeOpportunity({ id: "o", categoryId: "zzz", location: parcelRef, discoveredBy: "exhaustive" })).toThrow(/unknown category/);
    expect(() => makeOpportunity({ id: "o", categoryId: "adu", location: parcelRef, discoveredBy: "guess" })).toThrow();
  });
  it("use options are evaluated separately", () => {
    const u = makeUseOption({ use: "preserve", checks: { financial: pass, regulatory: pass, engineering: pass } });
    expect(u.status).toBe("viable");
    expect(makeUseOption({ use: "develop" }).status).toBe("candidate");
    expect(() => makeUseOption({ use: "demolish" })).toThrow();
  });
  const stream = (n: number) => ({ amount: q(n, n, n), capturedBy: "fixture party", mechanism: "none_identified" });
  const all = () => Object.fromEntries(VALUE_STREAM_KEYS.map((k, i) => [k, stream(i)]));
  it("ValueStreams has exactly seven keys, no total, and refuses to be summed", () => {
    expect(VALUE_STREAM_KEYS).toEqual(["propertyAppreciation", "developmentProfit", "municipalTaxRevenue", "publicEconomicBenefit",
      "investorCashFlow", "operatingRevenue", "capturableLandValue"]);
    const vs = makeValueStreams(all());
    expect(Object.keys(vs)).toHaveLength(7);
    expect("total" in vs).toBe(false);
    expect(() => makeValueStreams({ ...all(), total: stream(1) })).toThrow(/total/);
    const { propertyAppreciation: _p, ...rest } = all();
    expect(() => makeValueStreams(rest)).toThrow(/missing/);
    expect(() => makeValueStreams({ ...all(), operatingRevenue: { ...stream(1), mechanism: "" } })).toThrow();
    expect(() => sumValueStreams(vs)).toThrow(/different parties/);
    expect(() => sumValueStreams()).toThrow();
  });
});
