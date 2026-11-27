import { describe, expect, it } from "vitest";
import { aggregateRecommendations, pointInPolygon, polygonAreaSqM, selectBlockGroups, sitesInPolygon } from "../../../src/platform/boundary/index.js";

// FIXTURE: not real data
const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const feat = (id: string, ring: [number, number][]) => ({ type: "Feature", properties: { id }, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } });
// concave "U" shape: the notch (x 4..6, y 3..10) is outside
const U: [number, number][] = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 3], [4, 3], [4, 10], [0, 10]];

describe("pointInPolygon", () => {
  it("handles a concave polygon, with or without the closing point", () => {
    expect(pointInPolygon([2, 5], U)).toBe(true);
    expect(pointInPolygon([5, 5], U)).toBe(false);   // in the notch
    expect(pointInPolygon([5, 1], U)).toBe(true);    // under the notch
    expect(pointInPolygon([5, 5], [...U, U[0]])).toBe(false);
    expect(pointInPolygon([11, 5], U)).toBe(false);
  });
  it("counts a point on an edge or corner as inside", () => {
    expect(pointInPolygon([5, 0], U)).toBe(true);
    expect(pointInPolygon([0, 0], U)).toBe(true);
    expect(pointInPolygon([4, 5], U)).toBe(true);
  });
});

describe("polygonAreaSqM", () => {
  it("is zero for fewer than three corners and independent of the closing point and winding", () => {
    expect(polygonAreaSqM([[0, 0], [1, 1]])).toBe(0);
    const a = polygonAreaSqM(sq(0, 0, 0.01, 0.01));
    expect(polygonAreaSqM([...sq(0, 0, 0.01, 0.01), [0, 0]])).toBeCloseTo(a, 3);
    expect(polygonAreaSqM(sq(0, 0, 0.01, 0.01).reverse())).toBeCloseTo(a, 3);
  });
  it("matches a hand-computed square near the equator (dLon = dLat = 0.01 degrees, R = 6371008.8 m)", () => {
    const side = (6371008.8 * 0.01 * Math.PI) / 180;
    expect(polygonAreaSqM(sq(0, 0, 0.01, 0.01)) / (side * side)).toBeCloseTo(1, 2);
  });
});

describe("selectBlockGroups", () => {
  const area = sq(0, 0, 10, 10);
  const bgs = [feat("in", sq(2, 2, 4, 4)), feat("half", sq(8, 2, 11, 4)), feat("out", sq(20, 20, 22, 22)), feat("edge", sq(9.5, 9.5, 20, 20))];
  const r = Object.fromEntries(selectBlockGroups(area, bgs).map(x => [x.id, x]));
  it("classifies by centroid and estimates the share", () => {
    expect(r.in).toMatchObject({ inside: "centroid_inside", shareInside: 1 });
    expect(r.out).toMatchObject({ inside: "outside", shareInside: 0 });
  });
  it("a block group straddling the edge keeps its centre inside but has a share below 1 (true share 2/3)", () => {
    expect(r.half.inside).toBe("centroid_inside");
    expect(r.half.shareInside).toBeGreaterThan(0.6);
    expect(r.half.shareInside).toBeLessThan(0.73);
  });
  it("a block group whose centroid is outside but which overlaps is partly inside", () => {
    expect(r.edge.inside).toBe("partly");
    expect(r.edge.shareInside).toBeGreaterThan(0);
    expect(r.edge.shareInside).toBeLessThan(0.1);
  });
  it("is deterministic", () => {
    expect(selectBlockGroups(area, bgs)).toEqual(selectBlockGroups(area, bgs));
  });
});

describe("sitesInPolygon", () => {
  const poly = sq(0, 0, 10, 10);
  it("keeps points inside, drops points outside, counts clipped line vertices", () => {
    const r = sitesInPolygon([
      { id: "p1", pt: [5, 5] as [number, number] }, { id: "p2", pt: [15, 5] as [number, number] },
      { id: "l1", lines: [[[8, 5], [12, 5], [16, 5]] as [number, number][]] }, { id: "l2", lines: [[[11, 5], [12, 5]] as [number, number][]] },
    ], poly);
    expect(r.map(x => x.site.id)).toEqual(["p1", "l1"]);
    expect(r[1]).toMatchObject({ geometry: "line", insideVertices: 1, totalVertices: 3 });
  });
});

describe("aggregateRecommendations", () => {
  const tv = (value: number | null, unit = "USD") => ({ value, unit, source: "fixture", basis: value == null ? null : "modelled" });
  const idea = (id: string, cost: number | null, value: number | null, vpd: number | null, tier = "borrowed study") => ({
    id, name: "Name " + id, kind: "value", cost: tv(cost), valueAdded: tv(value), valuePerDollar: tv(vpd, "USD per USD"), evidence: { tier, grade: "B", verification: "verified" },
  });
  const rec = (ideas: any[], withheld: any[] = []) => ({ id: "x", ideas, withheld });
  const per = [
    { id: "a", inside: "centroid_inside", shareInside: 1, rec: rec([idea("park", 100, 300, 3), idea("trees", 10, 20, 2)], [{ id: "wall", name: "Wall", reason: "not sourced" }]) },
    { id: "b", inside: "centroid_inside", shareInside: 1, rec: rec([idea("trees", null, null, null), idea("park", 50, 40, 0.8)], [{ id: "wall", name: "Wall", reason: "not sourced" }]) },
    { id: "c", inside: "partly", shareInside: 0.3, rec: rec([idea("park", 1000, 5000, 5)]) },
  ];
  const out = aggregateRecommendations(per);
  const by = Object.fromEntries(out.improvements.map(x => [x.key, x]));
  it("adds only engine numbers, from block groups whose centre is inside", () => {
    expect(by.park.cost.value).toBe(150);
    expect(by.park.valueAdded.value).toBe(340);
    expect(by.park.cost.basis).toBe("sum of engine figures for block groups whose centre is inside the area");
    expect(by.park.blockGroups).toBe(3);
    expect(by.park.paysIn).toBe(2);
  });
  it("marks totals partial when a contributing area is only partly inside", () => {
    expect(by.park.cost.partial).toBe(true);
    expect(by.wall.cost.partial).toBe(false);
  });
  it("keeps unknowns unknown: a missing figure is counted, never filled", () => {
    expect(by.trees.cost.value).toBe(10);
    expect(by.trees.noFigureIn).toEqual({ cost: 1, valueAdded: 1 });
    expect(by.trees.paysIn).toBe(1);
  });
  it("an idea withheld everywhere has no totals and the engine's reason", () => {
    expect(by.wall.blockGroups).toBe(0);
    expect(by.wall.cost.value).toBeNull();
    expect(by.wall.withheldIn).toMatchObject({ count: 2, reasons: [{ reason: "not sourced", blockGroups: 2 }] });
  });
  it("ranks by block groups where the engine put the idea first, then pays; withheld-only last", () => {
    expect(out.improvements.map(x => x.key)).toEqual(["park", "trees", "wall"]);
  });
  it("a block group with no recommendation is listed, not guessed", () => {
    const o = aggregateRecommendations([{ id: "z", shareInside: 1, rec: { ideas: [], missing: ["blockGroup.m"] } }, { id: "y", shareInside: 1, rec: null }]);
    expect(o.improvements).toEqual([]);
    expect(o.withoutRecommendation.map(x => x.id)).toEqual(["y"]);
  });
});
