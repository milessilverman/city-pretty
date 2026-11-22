import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import {
  LIMITS, MILE_M, ACRE_M2, signedArea, clipConvex, convexParts, isSimple, intersectionArea, pointInRing, ringCentroid, distanceMeters, circleRing,
  normalizeShape, encodeArea, decodeArea, blockGroupShares, countFigure, medianFigure, rateFigure, rangeFigure, pointsInside, areaFigures,
  whatToBuild, describeCandidate, summarizeArea, plainSummary, advisorSummary,
} from "../../src/engines/areaAggregationEngine.js";
import * as decisionEngine from "../../src/engines/investmentDecisionEngine.js";

const root = path.resolve(__dirname, "../..");
const statutes = JSON.parse(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf8"));
const bundle = (fips: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `counties/bundle_${fips}.json.gz`))).toString("utf8"));

type Pt = [number, number];
const sq = (x: number, y: number, w: number, h = w): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// An independent area estimate: count grid cell centres (even-odd point-in-polygon), no clipping involved.
function gridOverlap(a: Pt[], b: Pt[], n = 400) {
  const xs = a.map(p => p[0]), ys = a.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let inA = 0, both = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p: Pt = [x0 + (i + 0.5) / n * (x1 - x0), y0 + (j + 0.5) / n * (y1 - y0)];
    if (pointInRing(p, a)) { inA++; if (pointInRing(p, b)) both++; }
  }
  return { inA, both, share: inA ? both / inA : 0, cell: (x1 - x0) * (y1 - y0) / (n * n) };
}

describe("clipping, against shapes whose overlap is known by hand", () => {
  it("two squares offset by half: overlap is a quarter of each", () => {
    expect(intersectionArea(sq(0, 0, 2), sq(1, 1, 2))).toBeCloseTo(1, 12);
  });
  it("orientation does not matter", () => {
    expect(intersectionArea(sq(0, 0, 2).reverse(), sq(1, 1, 2))).toBeCloseTo(1, 12);
    expect(intersectionArea(sq(0, 0, 2), sq(1, 1, 2).reverse())).toBeCloseTo(1, 12);
  });
  it("a closed ring (first corner repeated) gives the same answer", () => {
    const a = sq(0, 0, 2), b = sq(1, 1, 2);
    expect(intersectionArea([...a, a[0]], [...b, b[0]])).toBeCloseTo(1, 12);
  });
  it("disjoint shapes overlap by 0; a shape inside another overlaps by its own area", () => {
    expect(intersectionArea(sq(0, 0, 1), sq(5, 5, 1))).toBe(0);
    expect(intersectionArea(sq(1, 1, 1), sq(0, 0, 4))).toBeCloseTo(1, 12);
    expect(intersectionArea(sq(0, 0, 4), sq(1, 1, 1))).toBeCloseTo(1, 12);
  });
  it("squares that only share an edge overlap by 0", () => {
    expect(intersectionArea(sq(0, 0, 1), sq(1, 0, 1))).toBe(0);
  });
  // L-shape: a 3x3 square with its top-right 2x2 removed; area 5
  const L: Pt[] = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
  it("a concave subject clipped by a convex shape", () => {
    expect(Math.abs(signedArea(L))).toBe(5);
    // the square [0.5, 2.5]^2 holds 0.5x2 of the upright arm and 1.5x0.5 of the foot beyond it
    expect(intersectionArea(L, sq(0.5, 0.5, 2))).toBeCloseTo(0.5 * 2 + 1.5 * 0.5, 12);
  });
  it("a convex subject clipped by a concave shape (the drawn shape may be concave)", () => {
    expect(intersectionArea(sq(0.5, 0.5, 2), L)).toBeCloseTo(0.5 * 2 + 1.5 * 0.5, 12);
  });
  it("two concave shapes: a U and an L, where the subject splits into two pieces", () => {
    // U: 4 wide, 3 tall, with a 2x2 notch cut from the top middle; area 12 - 4 = 8
    const U: Pt[] = [[0, 0], [4, 0], [4, 3], [3, 3], [3, 1], [1, 1], [1, 3], [0, 3]];
    expect(Math.abs(signedArea(U))).toBe(8);
    // band y in [2, 3], x in [-1, 5], is convex: it cuts the two arms of the U apart (1x1 each)
    expect(intersectionArea(U, [[-1, 2], [5, 2], [5, 3], [-1, 3]])).toBeCloseTo(2, 12);
    // U ∩ L: foot of L (y 0..1, x 0..3) meets the base of U (y 0..1, x 0..4) -> 3; left arm of L (x 0..1, y 1..3) meets left arm of U -> 2
    expect(intersectionArea(U, L)).toBeCloseTo(5, 12);
    expect(intersectionArea(L, U)).toBeCloseTo(5, 12);
    const g = gridOverlap(U, L);
    expect(g.both * g.cell).toBeCloseTo(5, 1);
  });
  it("a triangle against a square", () => {
    // right triangle (0,0) (4,0) (0,4) and the unit-2 square at the origin: the square lies wholly under x + y = 4
    expect(intersectionArea([[0, 0], [4, 0], [0, 4]], sq(0, 0, 2))).toBeCloseTo(4, 12);
    // square [1,3]^2: the part with x + y <= 4 is the square minus the triangle above the line (area 2)
    expect(intersectionArea([[0, 0], [4, 0], [0, 4]], sq(1, 1, 2))).toBeCloseTo(2, 12);
  });
  it("the convex parts of a concave shape add up to its area and never overlap it twice", () => {
    const star: Pt[] = [[0, 3], [1, 1], [3, 0], [1, -1], [0, -3], [-1, -1], [-3, 0], [-1, 1]];
    const parts = convexParts(star);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.reduce((s: number, p: Pt[]) => s + signedArea(p), 0)).toBeCloseTo(Math.abs(signedArea(star)), 12);
    for (const p of parts) expect(signedArea(p)).toBeGreaterThan(0);
    expect(convexParts(sq(0, 0, 1))).toHaveLength(1);
  });
  it("a convex clip leaves a polygon inside it unchanged", () => {
    expect(Math.abs(signedArea(clipConvex(L, sq(-1, -1, 10))))).toBeCloseTo(5, 12);
  });
  it("tells a simple shape from one whose lines cross", () => {
    expect(isSimple(sq(0, 0, 1))).toBe(true);
    expect(isSimple([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(false);
  });
});

describe("the drawn shape", () => {
  it("rejects a bow-tie, too few corners and bad positions with a plain reason", () => {
    expect(normalizeShape({ type: "polygon", ring: [[-97.75, 30.26], [-97.74, 30.27], [-97.74, 30.26], [-97.75, 30.27]] }).error).toMatch(/cross/);
    expect(normalizeShape({ type: "polygon", ring: [[-97.75, 30.26], [-97.74, 30.27]] }).error).toMatch(/3 corners/);
    expect(normalizeShape({ type: "polygon", ring: [[-97.75, 30.26], [-97.74, 30.27], [NaN, 1]] }).ok).toBe(false);
    expect(normalizeShape({ type: "circle", center: [-97.75, 30.26], radiusMiles: 3 }).ok).toBe(false);
  });
  it("a circle is drawn as a many-sided shape with its corners on the circle", () => {
    const c: Pt = [-97.7431, 30.2672], r = 0.5 * MILE_M;
    const ring = circleRing(c, r);
    expect(ring).toHaveLength(LIMITS.circleSides);
    for (const p of ring) expect(Math.abs(distanceMeters(c, p) - r)).toBeLessThan(1);   // within a metre of half a mile
    const s = normalizeShape({ type: "circle", center: c, radiusMiles: 0.5 });
    const n = LIMITS.circleSides, exact = Math.PI * r * r / ACRE_M2;
    // area of a regular n-gon inscribed in the circle: (n / 2) r^2 sin(2 pi / n)
    expect(s.acres).toBeCloseTo(exact * (n / (2 * Math.PI)) * Math.sin(2 * Math.PI / n), 0);
    expect(s.acres / exact).toBeGreaterThan(0.998);
    expect(s.acres / exact).toBeLessThan(1);
  });
  it("one degree of latitude is about 69 miles in the projection used", () => {
    expect(distanceMeters([0, 0], [0, 1]) / MILE_M).toBeCloseTo(69.09, 1);
  });
  it("round-trips through the URL form, which uses only characters a URL hash keeps as they are", () => {
    const poly = { type: "polygon", ring: [[-97.75012, 30.26001], [-97.74, 30.26], [-97.745, 30.27]] };
    const circ = { type: "circle", center: [-118.25, 34.05], radiusMiles: 0.25 };
    for (const spec of [poly, circ]) {
      const text = encodeArea(spec);
      expect(text).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(new URLSearchParams({ area: text }).toString()).toBe("area=" + text);
      expect(decodeArea(text)).toEqual(spec);
    }
    expect(decodeArea("p_1_2_3")).toBeNull();
    expect(decodeArea("c_34_-118_7")).toBeNull();
    expect(decodeArea("x")).toBeNull();
    expect(decodeArea("p_abc_1_2_3_4_5")).toBeNull();
  });
  it("finds the centre of a shape", () => {
    expect(ringCentroid(sq(0, 0, 2))).toEqual([1, 1]);
  });
});

// ---------------------------------------------------------------- a hand-made county: four square block groups in a row
// Each is 0.01 degrees on a side at about 30 N. A, B, C, D from west to east.
const X0 = -97.80, Y0 = 30.00, W = 0.01;
const feat = (id: string, i: number, props: Record<string, any> = {}) => ({ type: "Feature", properties: { id, n: "Hood " + id.slice(-1), c: "Town", ...props }, geometry: { type: "Polygon", coordinates: [[[X0 + i * W, Y0], [X0 + (i + 1) * W, Y0], [X0 + (i + 1) * W, Y0 + W], [X0 + i * W, Y0 + W], [X0 + i * W, Y0]]] } });
const features = [feat("990010000011", 0), feat("990010000012", 1), feat("990010000013", 2), feat("990010000014", 3)];
const [A, B, C, D] = features.map(f => f.properties.id);
const details: Record<string, any> = {
  [A]: { m: { n: "Alder", c: "Town", acres: 200, pop: 1000, homes: 400, hv: 300000, rent: 1500, inc: 60000, yb: 1960, sf: 80, own: 70, nocar: 5, ht: 1.5, bt: 4, hvs: "Census ACS median value for this block group" }, r: [] },
  [B]: { m: { n: "Birch", c: "Town", acres: 240, pop: 3000, homes: 1200, hv: 500000, rent: 2100, inc: 90000, yb: 1985, sf: 40, own: 45, nocar: 12, ht: 3.0, bt: 10, hvs: "Census ACS median value for the surrounding Census tract (no block-group value published)" }, r: [] },
  [C]: { m: { n: "Cedar", c: "Town", acres: 220, pop: 500, homes: 100, hv: null, rent: null, inc: 150000, yb: 2005, sf: null, own: 90, nocar: null, ht: null, bt: null }, r: [] },
  [D]: { m: { n: "Dogwood", c: "Town", acres: 210, pop: null, homes: null, hv: 900000, rent: 2600, inc: null, yb: null, sf: 95, own: null, nocar: 2, ht: -0.5, bt: 0 }, r: [] },
};
const rectOver = (i0: number, i1: number, pad = 0) => ({ type: "polygon", ring: [[X0 + i0 * W - pad, Y0 - pad], [X0 + i1 * W + pad, Y0 - pad], [X0 + i1 * W + pad, Y0 + W + pad], [X0 + i0 * W - pad, Y0 + W + pad]] });
const run = (shape: any, extra: Record<string, any> = {}) => summarizeArea({ shape, features, details, fips: "99001", countyName: "Test County", stateCode: "CA", acs: "2020-2024 ACS 5-year", decisionEngine, ...extra });

describe("block-group shares", () => {
  it("a shape that is exactly one block group touches that block group alone, with share 1", () => {
    const s = blockGroupShares({ type: "polygon", ring: features[0].geometry.coordinates[0] }, features);
    expect(s.map((x: any) => [x.id, x.share])).toEqual([[A, 1]]);
  });
  it("a shape over the east half of A and the west half of B gives each a share of one half", () => {
    const s = blockGroupShares(rectOver(0.5, 1.5), features);
    expect(s.map((x: any) => x.id).sort()).toEqual([A, B]);
    for (const x of s) expect(x.share).toBeCloseTo(0.5, 9);
  });
  it("a hole in a block group is not part of it", () => {
    const holed = JSON.parse(JSON.stringify(features[0]));
    // remove the east half as a "hole" (a lake): the block group's own area halves
    holed.geometry.coordinates.push([[X0 + 0.5 * W, Y0 + 0.001], [X0 + W - 0.0001, Y0 + 0.001], [X0 + W - 0.0001, Y0 + W - 0.001], [X0 + 0.5 * W, Y0 + W - 0.001], [X0 + 0.5 * W, Y0 + 0.001]]);
    const s = blockGroupShares(rectOver(0, 0.5), [holed]);   // the west half, which has no hole
    const landShare = (0.5 * W * W) / (W * W - (0.5 * W - 0.0001) * (W - 0.002));
    expect(s[0].share).toBeCloseTo(landShare, 6);
  });
  it("a block group in two pieces is measured over both pieces", () => {
    const multi = { type: "Feature", properties: { id: "990010000019" }, geometry: { type: "MultiPolygon", coordinates: [features[0].geometry.coordinates, features[3].geometry.coordinates] } };
    const s = blockGroupShares(rectOver(0, 1), [multi]);
    expect(s[0].share).toBeCloseTo(0.5, 9);
  });
  it("matches an independent grid count on real block groups (Travis County, a half-mile circle downtown)", () => {
    const T = bundle("48453");
    const shape = normalizeShape({ type: "circle", center: [-97.7431, 30.2672], radiusMiles: 0.5 });
    const shares = blockGroupShares(shape, T.features);
    expect(shares.length).toBeGreaterThan(5);
    for (const s of shares) {
      const f = T.features.find((x: any) => x.properties.id === s.id);
      expect(f.geometry.type).toBe("Polygon");
      expect(f.geometry.coordinates).toHaveLength(1);
      const g = gridOverlap(f.geometry.coordinates[0], shape.ring, 250);
      expect(Math.abs(g.share - s.share)).toBeLessThan(0.002);
    }
  });
  it("on real block groups, drawing a block group's own outline gives that block group alone", () => {
    const T = bundle("48453");
    let tried = 0;
    for (const f of T.features.slice(0, 400)) {
      if (f.geometry.type !== "Polygon" || f.geometry.coordinates.length !== 1) continue;
      const ring = f.geometry.coordinates[0];
      if (ring.length - 1 > LIMITS.maxCorners || !normalizeShape({ type: "polygon", ring }).ok) continue;
      const s = blockGroupShares({ type: "polygon", ring }, T.features);
      expect(s[0]).toMatchObject({ id: f.properties.id, share: 1 });
      // neighbours' outlines are simplified separately, so a sliver of one may overlap; never more than 2% of it
      for (const x of s.slice(1)) expect(x.share).toBeLessThan(0.02);
      if (++tried >= 60) break;
    }
    expect(tried).toBe(60);
  });
});

describe("aggregation rules, with figures worked by hand", () => {
  it("a shape covering exactly one block group reproduces that block group's own figures, tagged measured", () => {
    const a = run({ type: "polygon", ring: features[1].geometry.coordinates[0] });
    expect(a.status).toBe("ok");
    expect(a.blockGroups).toEqual([{ id: B, name: "Birch", city: "Town", share: 1, acresInside: 240 }]);
    const m = details[B].m, f = a.figures;
    for (const [k, v] of [["pop", m.pop], ["homes", m.homes], ["landAcres", m.acres], ["hv", m.hv], ["rent", m.rent], ["inc", m.inc], ["yb", m.yb], ["sf", m.sf], ["own", m.own], ["nocar", m.nocar], ["ht", m.ht], ["bt", m.bt]] as [string, number][]) {
      expect(f[k].value, k).toBe(v);
      expect(f[k].basis, k).toBe("measured");
      expect(f[k].from, k).toEqual([{ id: B, share: 1, value: v }]);
    }
    expect(f.homesPerAcre.value).toBe(1200 / 240);
    expect(f.homesPerAcre.basis).toBe("modelled");
    expect(f.hv.how).toMatch(/median of the surrounding Census tract/);
    expect(plainSummary(a)).toMatch(/It holds 3,000 people and 1,200 homes\. The typical \(median\) home value is \$500,000\./);
    expect(plainSummary(a)).toMatch(/exact sums/);
  });

  it("two half block groups: counts are apportioned by area and say so", () => {
    const a = run(rectOver(0.5, 1.5));
    const f = a.figures;
    expect(f.pop.value).toBeCloseTo(0.5 * 1000 + 0.5 * 3000, 6);          // 2,000
    expect(f.homes.value).toBeCloseTo(0.5 * 400 + 0.5 * 1200, 6);         // 800
    expect(f.landAcres.value).toBeCloseTo(0.5 * 200 + 0.5 * 240, 6);      // 220
    expect(f.pop.basis).toBe("apportioned");
    expect(f.pop.tag).toBe("estimated from 2 block groups by area");
    expect(f.pop.largestPartialShare).toBe(0.5);
    expect(f.pop.how).toMatch(/largest part of a cut block group that is inside is 50%/);
    expect(f.pop.how).toMatch(/spread evenly/);
    expect(f.pop.from).toEqual([{ id: A, share: 0.5, value: 1000 }, { id: B, share: 0.5, value: 3000 }]);
    expect(f.homesPerAcre.value).toBeCloseTo(800 / 220, 9);
    expect(f.popPerSqMi.value).toBeCloseTo(2000 / (220 / 640), 6);
    expect(plainSummary(a)).toMatch(/about 2,000 people and about 800 homes/);
    expect(plainSummary(a)).toMatch(/2 of the 2 block groups are cut by the shape/);
  });

  it("one whole block group plus half of another: the largest partial share is stated", () => {
    const a = run(rectOver(0, 1.5));
    expect(a.figures.pop.value).toBeCloseTo(1000 + 0.5 * 3000, 6);
    expect(a.figures.pop.largestPartialShare).toBe(0.5);
    expect(a.figures.pop.how).toMatch(/1 of 2 block groups are cut/);
  });

  it("whole block groups add up exactly and are tagged measured", () => {
    const a = run(rectOver(0, 2));
    expect(a.figures.pop.value).toBe(4000);
    expect(a.figures.pop.basis).toBe("measured");
    expect(a.figures.pop.tag).toBe("sum of 2 whole block groups");
  });

  it("a median is a range plus a homes-weighted average of medians, never a single 'median of the area'", () => {
    const a = run(rectOver(0.5, 1.5));
    const hv = a.figures.hv;
    expect(hv.value).toBeNull();
    expect(hv.basis).toBe("range");
    expect(hv.range).toEqual([300000, 500000]);
    // weights: homes inside = 0.5 x 400 = 200 and 0.5 x 1,200 = 600 -> (200 x 300,000 + 600 x 500,000) / 800 = 450,000
    expect(hv.weightedAverage.value).toBeCloseTo(450000, 6);
    expect(hv.weightedAverage.label).toBe("homes-weighted average of block-group medians");
    expect(hv.how).toMatch(/Neither is the median of the drawn area/);
    expect(hv.how).toMatch(/1 of these 2 values is the median of the surrounding Census tract/);
    expect(a.figures.rent.range).toEqual([1500, 2100]);
    expect(a.figures.rent.weightedAverage.value).toBeCloseTo((200 * 1500 + 600 * 2100) / 800, 6);   // 1,950
    expect(plainSummary(a)).toMatch(/Typical home values \(block-group medians\) run from \$300,000 to \$500,000; the median for the area itself cannot be worked out/);
  });

  it("a withheld value stays withheld, and the figure says how many block groups had none", () => {
    const a = run(rectOver(1, 4));   // B, C, D whole
    const f = a.figures;
    // C has no home value: the range is over B and D only
    expect(f.hv.range).toEqual([500000, 900000]);
    expect(f.hv.noValue).toBe(1);
    expect(f.hv.blockGroups).toBe(3);
    expect(f.hv.how).toMatch(/1 of 3 block groups have no value on file/);
    expect(f.hv.from.find((x: any) => x.id === C).value).toBeNull();
    // D has no homes on file, so the homes-weighted average cannot be formed and is not guessed
    expect(f.hv.weightedAverage).toBeNull();
    expect(f.hv.weightedAverageMissing).toMatch(/homes are not on file/);
    // D has no population: the count covers B and C and says the real figure is higher
    expect(f.pop.value).toBe(3500);
    expect(f.pop.noValue).toBe(1);
    expect(f.pop.how).toMatch(/1 of 3 block groups have no value on file and add nothing, so the real figure is higher/);
    // income: B and C have it, both have homes -> average weighted 1,200 and 100
    expect(f.inc.weightedAverage.value).toBeCloseTo((1200 * 90000 + 100 * 150000) / 1300, 6);
    // a figure nobody has
    const none = run({ type: "polygon", ring: features[2].geometry.coordinates[0] });
    expect(none.figures.hv).toMatchObject({ value: null, basis: null, noValue: 1 });
    expect(none.figures.hv.range).toBeUndefined();
    expect(plainSummary(none)).toMatch(/No home value is on file/);
  });

  it("a share with its denominator on file is recomputed from apportioned numerator and denominator", () => {
    const a = run(rectOver(0.5, 1.5));
    const sf = a.figures.sf;
    // single-unit homes: 80% of 400 = 320 and 40% of 1,200 = 480; halves inside: 160 + 240 = 400 of 200 + 600 = 800 homes -> 50%
    expect(sf.value).toBeCloseTo(50, 9);
    expect(sf.basis).toBe("apportioned");
    expect(sf.how).toMatch(/Recomputed, not averaged/);
    // not the plain average of 80 and 40
    expect(sf.value).not.toBeCloseTo(60, 3);
    const whole = run(rectOver(0, 2));
    expect(whole.figures.sf.value).toBeCloseTo((320 + 480) / 1600 * 100, 9);
    expect(whole.figures.sf.basis).toBe("measured");
  });

  it("a block group without the share is left out of both the top and the bottom of the fraction", () => {
    const a = run(rectOver(1, 4));   // B (sf 40, 1,200 homes), C (sf null), D (sf 95, homes null)
    // D has a share but no homes: the denominator is not on file for every block group, so the result is a range
    expect(a.figures.sf.basis).toBe("range");
    expect(a.figures.sf.range).toEqual([40, 95]);
    expect(a.figures.sf.noValue).toBe(1);
    const bc = run(rectOver(1, 3));
    expect(bc.figures.sf.value).toBeCloseTo(40, 9);   // only B contributes
    expect(bc.figures.sf.noValue).toBe(1);
  });

  it("a share whose denominator is not on file is a range", () => {
    const a = run(rectOver(0.5, 1.5));
    expect(a.figures.own).toMatchObject({ value: null, basis: "range", range: [45, 70] });
    expect(a.figures.own.how).toMatch(/number of occupied homes per block group is not on file/);
    expect(a.figures.nocar).toMatchObject({ basis: "range", range: [5, 12] });
    expect(a.figures.bt).toMatchObject({ basis: "range", range: [4, 10] });
    expect(a.figures.ht).toMatchObject({ basis: "range", range: [1.5, 3] });
  });

  it("a rate per 1,000 residents is recomputed with residents as the denominator", () => {
    const f = rateFigure({ key: "vc", label: "Violent crime", unit: "per 1,000", denominator: "residents" }, [{ id: "a", share: 0.5, v: 10, d: 1000 }, { id: "b", share: 1, v: 2, d: 3000 }]);
    // crimes: 10 per 1,000 x 1,000 = 10, half inside = 5; 2 per 1,000 x 3,000 = 6; residents 500 + 3,000 -> 11 / 3,500 x 1,000
    expect(f.value).toBeCloseTo(11 / 3500 * 1000, 9);
    expect(f.basis).toBe("apportioned");
  });

  it("crash counts are apportioned like other counts, with their years", () => {
    const crashCounts = { _meta: { source: "Test crash records", years: [2023, 2025], fields: ["pedestrian or bicycle crashes", "killed or seriously injured crashes", "all crashes"] }, [A]: [2, 1, 40], [B]: [4, 3, 100] };
    const a = run(rectOver(0.5, 1.5), { crashCounts });
    expect(a.figures.crashAll.value).toBeCloseTo(70, 9);
    expect(a.figures.crashKsi.value).toBeCloseTo(2, 9);
    expect(a.figures.crashPedBike.value).toBeCloseTo(3, 9);
    expect(a.figures.crashAll.source).toMatch(/Test crash records, 2023-2025/);
    expect(a.figures.crashAll.how).toMatch(/boundary streets/);
    expect(run(rectOver(0.5, 1.5)).figures.crashAll).toBeUndefined();
  });

  it("the single-figure helpers give null, not zero, when nothing is on file", () => {
    expect(countFigure({ key: "x", label: "X", unit: "u" }, [{ id: "a", share: 1, v: null }])).toMatchObject({ value: null, basis: null, noValue: 1 });
    expect(medianFigure({ key: "x", label: "X", unit: "u" }, [{ id: "a", share: 1, v: 0 }])).toMatchObject({ value: null, basis: null });
    expect(rangeFigure({ key: "x", label: "X", unit: "u" }, [{ id: "a", share: 0.4, v: 3 }])).toMatchObject({ value: null, basis: "range", range: [3, 3], tag: "the one block group touched" });
    expect(countFigure({ key: "x", label: "X", unit: "u" }, [{ id: "a", share: 0.25, v: 0 }])).toMatchObject({ value: 0, basis: "apportioned" });
  });

  it("a Census top code is named, not treated as a real median", () => {
    const f = medianFigure({ key: "hv", label: "Median home value", unit: "USD", topCode: [2000000, 2000001], topCodeText: "$2,000,000 or more" }, [{ id: "a", share: 1, v: 2000001, w: 10 }, { id: "b", share: 1, v: 800000, w: 10 }]);
    expect(f.topCoded).toBe(1);
    expect(f.how).toMatch(/top code/);
  });

  it("every figure carries value, unit, basis, from and source", () => {
    const a = run(rectOver(0.5, 1.5));
    for (const f of Object.values(a.figures) as any[]) {
      expect(Object.keys(f)).toEqual(expect.arrayContaining(["value", "unit", "basis", "from", "source"]));
      expect([null, "measured", "apportioned", "range", "modelled"]).toContain(f.basis);
      expect(typeof f.how).toBe("string");
    }
  });
});

describe("point data is exact", () => {
  const pt = (i: number, extra: Record<string, any> = {}) => ({ lon: X0 + (i + 0.5) * W, lat: Y0 + 0.5 * W, ...extra });
  it("a point is in or out by its own position, never apportioned", () => {
    const shape = rectOver(0.5, 1.5);
    expect(pointsInside(shape, [pt(-0.2), pt(0.1), pt(0.6), pt(1.2), { lon: null, lat: 1 }])).toHaveLength(2);   // centres at 0.3, 0.6, 1.1, 1.7; the shape runs 0.5 to 1.5
    const a = run(shape, { points: { stations: [pt(0.2, { name: "East Alder" }), pt(3, { name: "Dogwood" })], stops: [pt(-0.3), pt(0.1), pt(0.3)], planned: [pt(0.4, { name: "Future stop", status: "under construction" })], plannedUnplaced: 2,
      sites: [pt(0.3, { id: 1, kind: "parking lot", acres: 2 }), pt(0.35, { id: 2, kind: "vacant", acres: 5, status: "built" }), pt(2, { id: 3, kind: "golf course", acres: 90 })] } });
    expect(a.points.stations.value).toBe(1);
    expect(a.points.stations.basis).toBe("measured");
    expect(a.points.stations.items).toEqual([{ name: "East Alder" }]);
    expect(a.points.stops.value).toBe(2);
    expect(a.points.plannedStations.items).toEqual([{ name: "Future stop", status: "under construction" }]);
    expect(a.points.plannedStations.unplaced).toBe(2);
    expect(a.points.sites.value).toBe(1);
    expect(a.land.candidates.map((c: any) => c.id)).toEqual([1]);
    expect(a.land.alreadyUnderWay).toEqual([{ id: 2, kind: "vacant", acres: 5, status: "built" }]);
  });
});

describe("limits", () => {
  it("a shape covering under a quarter of every block group it touches shows only the exact point data", () => {
    const tiny = { type: "polygon", ring: [[X0 + 0.9 * W, Y0 + 0.4 * W], [X0 + 1.1 * W, Y0 + 0.4 * W], [X0 + 1.1 * W, Y0 + 0.6 * W], [X0 + 0.9 * W, Y0 + 0.6 * W]] };
    const a = run(tiny, { points: { stops: [{ lon: X0 + W, lat: Y0 + 0.5 * W }] } });
    expect(a.status).toBe("too_coarse");
    expect(a.largestShare).toBeCloseTo(0.02, 6);
    expect(a.message).toMatch(/at most 2% of any block group it touches \(under 25%\)/);
    expect(a.figures).toBeUndefined();
    expect(a.build).toBeUndefined();
    expect(a.transit).toBeUndefined();
    expect(a.points.stops.value).toBe(1);
    expect(plainSummary(a)).toMatch(/too coarse to trust/);
    expect(LIMITS.minLargestShare).toBe(0.25);
  });
  it("just over a quarter of one block group is enough", () => {
    expect(run(rectOver(0, 0.26)).status).toBe("ok");
    expect(run(rectOver(0, 0.24)).status).toBe("too_coarse");
  });
  it("more block groups than the cap gives a message and no figures", () => {
    const many: any[] = [], det: Record<string, any> = {};
    for (let i = 0; i < LIMITS.maxBlockGroups + 1; i++) { const id = "99002" + String(1000000 + i); many.push(feat(id, i)); det[id] = { m: { pop: 10, homes: 4, acres: 1 }, r: [] }; }
    const a = summarizeArea({ shape: rectOver(0, LIMITS.maxBlockGroups + 1), features: many, details: det, fips: "99002", decisionEngine });
    expect(a.status).toBe("too_large");
    expect(a.message).toMatch(new RegExp(`touches ${LIMITS.maxBlockGroups + 1} block groups. This tool stops at ${LIMITS.maxBlockGroups}`));
    expect(a.figures).toBeUndefined();
    const ok = summarizeArea({ shape: rectOver(0, LIMITS.maxBlockGroups), features: many, details: det, fips: "99002", decisionEngine });
    expect(ok.status).toBe("ok");
    expect(ok.figures.pop.value).toBe(10 * LIMITS.maxBlockGroups);
  });
  it("a shape outside the county says so", () => {
    const a = run({ type: "circle", center: [-90, 40], radiusMiles: 0.5 });
    expect(a.status).toBe("empty");
    expect(plainSummary(a)).toMatch(/does not overlap any block group/);
  });
  it("an invalid shape gives a reason and nothing else", () => {
    expect(run({ type: "polygon", ring: [[0, 0], [1, 1], [1, 0], [0, 1]] })).toMatchObject({ status: "invalid" });
  });
});

describe("what to build: the decision engine's rules, kept per block group", () => {
  // bundle row: [id, project, homes, cost, capex, land, om, value, vpd, pct, why, qol]
  const row = (id: string, cost: number, value: number, pct = 1) => [id, "a project", 100, cost, cost, 0, 0, value, value / cost, pct, "why", 0.5];
  const catalog = { trees: { name: "Street trees", kind: "value", grade: "B", sources: ["s1"] }, plaza: { name: "Plaza", kind: "value", grade: "C", sources: [] }, clinic: { name: "Clinic", kind: "value", grade: "B", sources: [] } };
  const verification = { trees: { status: "verified" }, plaza: { status: "unverified" }, clinic: { status: "verified", applies_if: { median_household_income_below: 70000 } } };
  const det2 = JSON.parse(JSON.stringify(details));
  det2[A].r = [row("trees", 100000, 300000), row("plaza", 50000, 500000), row("clinic", 1000000, 1500000)];   // A: income 60,000 -> clinic applies
  det2[B].r = [row("trees", 200000, 200000), row("plaza", 50000, 500000), row("clinic", 1000000, 4000000)];   // B: income 90,000 -> clinic withheld
  const rows = (shares: [string, number][]) => shares.map(([id, share]) => ({ id, share, m: det2[id].m, r: det2[id].r }));

  it("weights each block group's estimate by its share inside the shape", () => {
    const w = whatToBuild(rows([[A, 1], [B, 0.5]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    const trees = w.ideas.find((x: any) => x.id === "trees");
    // value per dollar: A 3.0 (share 1), B 1.0 (share 0.5) -> (1 x 3 + 0.5 x 1) / 1.5
    expect(trees.valuePerDollar.range).toEqual([1, 3]);
    expect(trees.valuePerDollar.weightedAverage.value).toBeCloseTo(3.5 / 1.5, 9);
    expect(trees.valuePerDollar.basis).toBe("range");
    expect(trees.valuePerDollar.value).toBeNull();
    expect(trees.appliesIn).toBe(2);
    expect(trees.coverage).toBeCloseTo(1, 9);
    expect(trees.cost.range).toEqual([100000, 200000]);
  });
  it("an idea withheld in a block group contributes no figure from it", () => {
    const w = whatToBuild(rows([[A, 1], [B, 0.5]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    const clinic = w.ideas.find((x: any) => x.id === "clinic");
    // B's 4.0 is withheld there (the study applies only below $70,000 income), so only A's 1.5 counts
    expect(clinic.valuePerDollar.range).toEqual([1.5, 1.5]);
    expect(clinic.valuePerDollar.weightedAverage.value).toBeCloseTo(1.5, 9);
    expect(clinic.appliesIn).toBe(1);
    expect(clinic.blockGroups).toBe(2);
    expect(clinic.coverage).toBeCloseTo(1 / 1.5, 9);
    expect(w.withheld.find((x: any) => x.id === "clinic")).toMatchObject({ blockGroups: 1 });
  });
  it("an idea that failed the data audit is listed by name only", () => {
    const w = whatToBuild(rows([[A, 1], [B, 0.5]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    expect(w.ideas.find((x: any) => x.id === "plaza")).toBeUndefined();
    expect(w.withheld.find((x: any) => x.id === "plaza")).toMatchObject({ name: "Plaza", blockGroups: 2 });
    expect(JSON.stringify(w.withheld)).not.toMatch(/500000|10\b/);
  });
  it("ranks by the share-weighted value per dollar, and nothing is summed across block groups", () => {
    const w = whatToBuild(rows([[A, 1], [B, 0.5]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    expect(w.ideas.map((x: any) => x.id)).toEqual(["trees", "clinic"]);   // 2.33 before 1.5
    expect(w.caveats.join(" ")).toMatch(/not added up across block groups/);
    const flipped = whatToBuild(rows([[A, 0.1], [B, 1]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    expect(flipped.ideas.map((x: any) => x.id)).toEqual(["clinic", "trees"]);   // trees (0.3 + 1) / 1.1 = 1.18 < clinic 1.5
  });
  it("housing plays keep the engine's 'not determined' answers", () => {
    const w = whatToBuild(rows([[A, 1], [B, 0.5]]), { decisionEngine, catalog, verification, countyFips: "99001" });
    expect(w.housingPlays.map((p: any) => p.play)).toEqual(["adu", "lot_split", "small_multifamily", "underused_site_conversion"]);
    const split = w.housingPlays.find((p: any) => p.play === "lot_split");
    expect(split.legal).toMatch(/not determined/);
    expect(split.valuePerDollar.value).toBeNull();
    expect(split.valuePerDollar.basis).toBeNull();
  });
  it("without the verification table no idea carries a figure", () => {
    const w = whatToBuild(rows([[A, 1]]), { decisionEngine, catalog, countyFips: "99001" });
    expect(w.ideas).toEqual([]);
    expect(w.withheld.length).toBe(3);
    expect(w.missing.join(" ")).toMatch(/intervention_verification/);
  });
});

describe("land to redevelop: what the record can and cannot say", () => {
  const stations = [{ name: "Central", lon: -118.25, lat: 34.05 }];
  const near = { lon: -118.25, lat: 34.05 + 400 / 111195 };    // about 400 m north
  const far = { lon: -118.25, lat: 34.05 + 3000 / 111195 };
  it("no parcel record: zoning, state law and owner are not determined, and no recommendation is made", () => {
    const c = describeCandidate({ id: "x1", kind: "parking lot", acres: 1.2, parcelRecord: false, ...near }, { stations, decisionEngine, laws: statutes, stateCode: "TX", countyFips: "48453" });
    expect(c.zoning.status).toBe("not determined");
    expect(c.stateLaw).toMatchObject({ status: "not determined", why: "no parcel record on file for this site" });
    expect(c.blockers.map((b: any) => b.fact)).toEqual(["zoning", "owner", "cost", "overlays"]);
    expect(c.recommendation).toBeNull();
    expect(c.recommendationWhy).toBe("No recommendation: zoning, owner, cost not on file.");
    expect(c.station.existing).toMatchObject({ name: "Central", within: true });
    expect(c.station.existing.meters).toBeGreaterThan(390);
    expect(c.station.existing.meters).toBeLessThan(410);
    expect(c.station.answer).toBe("within walk distance of an existing station");
    expect(c.verification).toBe("not individually checked");
  });
  it("walk distance is half a mile in a straight line", () => {
    expect(LIMITS.walkMeters).toBeCloseTo(804.672, 3);
    const c = describeCandidate({ id: "x2", kind: "vacant", acres: 3, parcelRecord: false, ...far }, { stations, planned: [{ name: "New Stop", status: "under construction", lon: far.lon, lat: far.lat + 0.001 }] });
    expect(c.station.existing.within).toBe(false);
    expect(c.station.planned).toMatchObject({ name: "New Stop", within: true, status: "under construction" });
    expect(c.station.answer).toBe("within walk distance of a station under construction or planned");
    expect(describeCandidate({ id: "x3", acres: 1, ...far }, {}).station.answer).toBe("no station on file for this county");
  });
  it("a parcel record with zoning is passed to the statute engine, and the answer is the engine's", () => {
    const site = { id: "la1", kind: "parking lot", acres: 1.03, parcelRecord: true, zoningCode: "C2-1", zoningCategory: "commercial / mixed use", assessedLandValue: 5000000, assessedBaseYear: 2021, ...near,
      verification: { status: "partially_verified", unverified_fields: ["marketLandValue", "potentialHomes", "margin", "idea"] } };
    const c = describeCandidate(site, { stations, decisionEngine, laws: statutes, stateCode: "CA", countyFips: "06037" });
    expect(c.zoning).toEqual({ code: "C2-1", category: "commercial / mixed use", status: "on file" });
    const direct = decisionEngine.recommendForParcel({ parcel_id: "la1", state_code: "CA", county_fips: "06037", base_zoning_code: "C2-1", municipality_pop: null, county_pop: null, is_commercial_or_mixed_use: true, is_single_family_residential: false,
      dist_to_heavy_rail_mi: c.station.existing.meters / MILE_M, dist_to_frequent_bus_or_brt_mi: null, exclusions: { historic_district_hpoz: null, fema_100yr_floodway: null, calfire_or_state_vhfhsz: null }, lot_sqft: 1.03 * 43560 }, { laws: statutes }).zoning;
    expect(c.stateLaw.statutes).toEqual(direct.statutes);
    expect(c.stateLaw.status).toBe(direct.statutes.length ? "a state law on file applies" : "not determined");
    expect(c.blockers.map((b: any) => b.fact)).toEqual(["owner", "cost", "overlays"]);
    expect(c.blockers.find((b: any) => b.fact === "cost").why).toMatch(/assessed land value is a tax-roll figure, not a price/);
    expect(c.verification).toBe("partially_verified");
    expect(c.withheldFields).toEqual(["marketLandValue", "potentialHomes", "margin", "idea"]);
    // model outputs never appear in the description
    expect(Object.keys(c)).not.toEqual(expect.arrayContaining(["potentialHomes", "margin", "marketLandValue"]));
    // without the law table the answer is not determined
    expect(describeCandidate(site, { stations, decisionEngine, stateCode: "CA" }).stateLaw).toMatchObject({ status: "not determined", why: "state law table (app/data/statutes.json) not loaded" });
  });
  it("gives no redevelopment recipe, and lists the data that would be needed", () => {
    const a = run(rectOver(0, 2));
    expect(a.land.noRecipe.text).toMatch(/not on file/);
    expect(a.land.noRecipe.dataNeeded.length).toBeGreaterThanOrEqual(4);
  });
});

describe("transit for the area", () => {
  it("passes the area's apportioned density to the decision engine's evaluateTransit", () => {
    const a = run(rectOver(0.5, 1.5));
    const direct = decisionEngine.evaluateTransit({ householdsPerGrossAcre: 800 / 220 }, {});
    expect(a.transit.verdict).toBe(direct.verdict);
    expect(a.transit.scale).toBe(direct.scale);
    expect(a.transit.density.homesPerNetAcre.value).toBeCloseTo(800 / 220 * 1.5, 2);
    expect(a.transit.density.homesPerNetAcre.basis).toBe("modelled");
    expect(a.transit.name).toMatch(/^Drawn area \(Alder, Birch\)/);
  });
  it("no homes on file means not enough data, never a guessed density", () => {
    const a = run({ type: "polygon", ring: features[3].geometry.coordinates[0] });
    expect(a.figures.homesPerAcre.value).toBeNull();
    expect(a.transit.verdict).toBe("not_enough_data");
  });
});

describe("the advisor summary and the plain paragraph", () => {
  const T = bundle("48453");
  const verification = JSON.parse(fs.readFileSync(path.join(root, "app/data/intervention_verification.json"), "utf8"));
  const real = (shape: any) => summarizeArea({ shape, features: T.features, details: T.details, fips: "48453", countyName: "Travis County", stateCode: "TX", acs: T.meta.acs, decisionEngine, verification, laws: statutes,
    points: { stations: T.layers.stations.features.map((f: any) => ({ name: f.properties.n, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })), stops: T.layers.stops.features.map((f: any) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })) } });
  it("stays under the size cap on a real one-mile circle and never cuts a value in the middle", () => {
    const a = real({ type: "circle", center: [-97.7431, 30.2672], radiusMiles: 1 });
    expect(a.status).toBe("ok");
    const s = advisorSummary(a, 6000);
    const text = JSON.stringify(s);
    expect(text.length).toBeLessThanOrEqual(6000);
    expect(JSON.parse(text)).toEqual(s);
    expect(s.figures.people.basis).toBe("apportioned");
    expect(s.figures.medianHomeValue.basis).toBe("range");
    expect(s.figures.medianHomeValue.value).toBeUndefined();
    expect(s.howToRead).toMatch(/Never call a range/);
    expect(advisorSummary(a, 1500)).toBeTruthy();
    expect(JSON.stringify(advisorSummary(a, 1500)).length).toBeLessThanOrEqual(1500);
  });
  it("the real area's people and homes equal a separate sum over the shares", () => {
    const a = real({ type: "circle", center: [-97.7431, 30.2672], radiusMiles: 0.5 });
    let pop = 0, homes = 0;
    for (const b of blockGroupShares({ type: "circle", center: [-97.7431, 30.2672], radiusMiles: 0.5 }, T.features)) { pop += b.share * T.details[b.id].m.pop; homes += b.share * T.details[b.id].m.homes; }
    expect(a.figures.pop.value).toBeCloseTo(pop, 6);
    expect(a.figures.homes.value).toBeCloseTo(homes, 6);
    expect(a.points.stations.items.map((s: any) => s.name)).toContain("Downtown");
  });
  it("no 'null', 'NaN' or 'undefined' in any text a reader sees", () => {
    const shapes = [{ type: "circle", center: [-97.7431, 30.2672], radiusMiles: 0.25 }, { type: "circle", center: [-97.7431, 30.2672], radiusMiles: 1 }, { type: "circle", center: [-97.95, 30.45], radiusMiles: 0.25 }, { type: "circle", center: [-90, 40], radiusMiles: 0.5 }];
    for (const sh of shapes) {
      const a = real(sh);
      const texts = [plainSummary(a), a.message || ""];
      if (a.figures) for (const f of Object.values(a.figures) as any[]) texts.push(f.how, f.tag || "", f.label, f.source || "");
      if (a.build) texts.push(a.build.ordering, ...a.build.caveats);
      for (const t of texts) expect(t).not.toMatch(/\bnull\b|\bNaN\b|\bundefined\b/);
    }
  });
});
