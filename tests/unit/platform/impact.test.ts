import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { IMPROVEMENT_CATEGORIES, haversineM, makeGeoRef, makeQuantity } from "../../../src/platform/schema/index.js";
import {
  apportionDemographics, applyBarriers, areaOverlapWeights, buildGraph, combineImpacts, computeImpactArea, dijkstra,
  keyImpactByBlockGroup, makeModelRegistry, nearestNode, validateImpactModel, valueEffect,
} from "../../../src/platform/impact/index.js";
import { modelsFromTransitValueEffects } from "../../../src/platform/pilot/impactModels.js";

// FIXTURE: not real data
const J = { state: "XX", countyFips: "00000" };
const SRC = { title: "Fixture study", url: "https://example.invalid/study", retrieved: "2026-01-01", quote: "fixture" };
const q = (value: number, unit: string, low = value, high = value) =>
  makeQuantity({ value, low, high, unit, status: "verified", source: SRC, jurisdiction: "XX", effectiveDate: "2026-01-01" });
const layer = (id: string, over: any = {}) => ({
  id, target: "fixture_target", sign: 1, decay: { form: "bands", parameters: {} }, reach: q(1000, "m"), magnitude: q(10, "percent", 5, 15),
  distanceBasis: "network", source: SRC, ...over,
});
const model = (id: string, categoryIds: string[], over: any = {}) => ({ ...layer(id), categoryIds, transferability: "fixture only", negativeEffects: [], ...over });

const STEP = 0.001; // degrees
const line = (a: [number, number], b: [number, number], props: any = {}) => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: [a, b] } });
const gridFeatures = (cols: number, rows: number, extra?: (c: number, r: number, dir: "h" | "v") => any) => {
  const f: any[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (c + 1 < cols) f.push(line([c * STEP, r * STEP], [(c + 1) * STEP, r * STEP], extra?.(c, r, "h")));
    if (r + 1 < rows) f.push(line([c * STEP, r * STEP], [c * STEP, (r + 1) * STEP], extra?.(c, r, "v")));
  }
  return f;
};
const pt = (id: string, c: number, r: number) => makeGeoRef({ kind: "point", id, jurisdiction: J, geometry: { type: "Point", coordinates: [c * STEP, r * STEP] } });
const parcelAt = (id: string, c: number, r: number) => {
  const x = c * STEP, y = r * STEP, e = STEP / 20;
  return makeGeoRef({ kind: "parcel", id, jurisdiction: J, geometry: { type: "Polygon", coordinates: [[[x - e, y - e], [x - e, y + e], [x + e, y + e], [x + e, y - e], [x - e, y - e]]] } as any });
};
const improvementAt = (id: string, categoryId: string, c: number, r: number) => ({ id, categoryId, location: pt(`loc-${id}`, c, r) });
const H = haversineM([0, 0], [STEP, 0]), V = haversineM([0, 0], [0, STEP]);

describe("graph and dijkstra", () => {
  const g = buildGraph(gridFeatures(5, 5), { snapToleranceM: 1 });
  const id = (c: number, r: number) => nearestNode(g, [c * STEP, r * STEP])!.node;
  it("builds 25 nodes and 40 edges and requires an explicit snap tolerance", () => {
    expect(g.nodes.length).toBe(25);
    expect(g.edges.length).toBe(40);
    expect(() => buildGraph([], {} as any)).toThrow(/snapToleranceM/);
  });
  it("matches grid known answers", () => {
    const d = dijkstra(g, [id(0, 0)], Infinity);
    expect(d[id(0, 0)]).toBe(0);
    expect(d[id(4, 0)]).toBeCloseTo(4 * H, 1);
    expect(d[id(4, 4)]).toBeCloseTo(4 * H + 4 * V, 1);
    expect(d[id(2, 3)]).toBeCloseTo(2 * H + 3 * V, 1);
  });
  it("respects the cut-off and source offsets", () => {
    const d = dijkstra(g, [id(0, 0)], 2.5 * H);
    expect(d[id(2, 0)]).toBeCloseTo(2 * H, 1);
    expect(d[id(3, 0)]).toBe(Infinity);
    const o = dijkstra(g, [{ node: id(0, 0), offsetM: 7 }], Infinity);
    expect(o[id(1, 0)]).toBeCloseTo(7 + H, 1);
  });
  it("snaps vertices within tolerance into one node", () => {
    const sg = buildGraph([line([0, 0], [STEP, 0]), line([STEP + 0.000001, 0], [2 * STEP, 0])], { snapToleranceM: 5 });
    expect(sg.nodes.length).toBe(3);
    const ng = buildGraph([line([0, 0], [STEP, 0]), line([STEP + 0.000001, 0], [2 * STEP, 0])], { snapToleranceM: 0 });
    expect(ng.nodes.length).toBe(4);
  });
});

describe("barriers", () => {
  // 5 columns x 3 rows; a wall between column 2 and 3 covering rows 0 and 1 only
  const wall = { type: "Feature", properties: { id: "wall" }, geometry: { type: "LineString", coordinates: [[2.5 * STEP, -0.5 * STEP], [2.5 * STEP, 1.5 * STEP]] } };
  const g = buildGraph(gridFeatures(5, 3), { snapToleranceM: 1 });
  it("cuts crossing edges and forces a detour longer than straight line", () => {
    const { graph, cutEdges } = applyBarriers(g, [wall]);
    expect(cutEdges.length).toBe(2);
    const a = nearestNode(graph, [0, 0])!.node, b = nearestNode(graph, [4 * STEP, 0])!.node;
    const net = dijkstra(graph, [a], Infinity)[b];
    expect(net).toBeCloseTo(4 * H + 4 * V, 1);
    expect(net).toBeGreaterThan(haversineM([0, 0], [4 * STEP, 0]) + 1);
  });
  it("keeps edges flagged as crossings or with a supplied crossing point nearby", () => {
    const flagged = buildGraph(gridFeatures(5, 3, (c, r, d) => (d === "h" && c === 2 && r === 0 ? { bridge: true } : {})), { snapToleranceM: 1 });
    expect(applyBarriers(flagged, [wall]).cutEdges.length).toBe(1);
    const viaPoint = applyBarriers(g, [wall], [{ position: [2.5 * STEP, 0], toleranceM: 5 }]);
    expect(viaPoint.cutEdges.length).toBe(1);
  });
  it("excludes a receptor when the barrier removes it from reach and reports it, but not without barriers", () => {
    const m = model("m.fix", ["fix"], { reach: q(4.5 * H, "m") });
    const improvement = improvementAt("i1", "fix", 0, 0);
    const receptors = [pt("near", 1, 0), pt("far", 4, 0)];
    const open = computeImpactArea({ improvement, model: m as any, graph: g, receptors, barriers: null, asOf: "2026-01-01" });
    expect(open.cells.map((c: any) => c.ref.id).sort()).toEqual(["far", "near"]);
    const cut = computeImpactArea({ improvement, model: m as any, graph: g, receptors, barriers: { features: [wall] }, asOf: "2026-01-01" });
    expect(cut.cells.map((c: any) => c.ref.id)).toEqual(["near"]);
    expect(cut.excludedByBarrier.map((e: any) => e.ref.id)).toEqual(["far"]);
    expect(open.excludedByBarrier).toEqual([]);
    const full = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[2.5 * STEP, -0.5 * STEP], [2.5 * STEP, 2.5 * STEP]] } };
    const sealed = computeImpactArea({ improvement, model: { ...m, reach: q(100 * H, "m") } as any, graph: g, receptors, barriers: { features: [full] }, asOf: "2026-01-01" });
    expect(sealed.cells.map((c: any) => c.ref.id)).toEqual(["near"]);
    expect(sealed.excludedByBarrier.map((e: any) => e.ref.id)).toEqual(["far"]);
    const withCrossing = computeImpactArea({ improvement, model: { ...m, reach: q(100 * H, "m") } as any, graph: g, receptors, barriers: { features: [full], crossings: [{ position: [2.5 * STEP, 0], toleranceM: 5 }] }, asOf: "2026-01-01" });
    expect(withCrossing.cells.length).toBe(2);
  });
});

describe("models and registry", () => {
  const cats = IMPROVEMENT_CATEGORIES.map((c) => ({ id: c.id, family: c.family }));
  const five = ["ev_charger", "park", "grocery", "rail_station", "traffic_calming"];
  it("refuses one model for an EV charger, park, grocery, rail station and speed hump", () => {
    expect(() => makeModelRegistry({ categories: cats, models: [model("m.all", five, { sharedCategoryJustification: "same" }) as any] })).toThrow(/different kinds/);
    expect(() => makeModelRegistry({ models: [model("m.all", five) as any] })).toThrow(/sharedCategoryJustification/);
  });
  it("lets each of the five have its own model and returns null for categories with none", () => {
    const reg = makeModelRegistry({ categories: cats, models: five.map((c) => model(`m.${c}`, [c]) as any) });
    for (const c of five) expect(reg.forCategory(c)!.id).toBe(`m.${c}`);
    expect(reg.forCategory("clinic")).toBeNull();
    expect(reg.forCategory("pocket_park")).toBeNull();
    const same = makeModelRegistry({ categories: cats, models: [model("m.parks", ["park", "pocket_park"], { sharedCategoryJustification: "fixture: same kind" }) as any] });
    expect(same.forCategory("pocket_park")!.id).toBe("m.parks");
    expect(same.forCategory("grocery")).toBeNull();
  });
  it("refuses models whose numbers are not sourced Quantities", () => {
    expect(validateImpactModel(model("bad", ["x"], { magnitude: 10 })).valid).toBe(false);
    expect(validateImpactModel(model("bad", ["x"], { reach: { ...q(5, "m"), source: null } })).valid).toBe(false);
    expect(validateImpactModel(model("bad", ["x"], { decay: { form: "exponential", parameters: {} } })).errors.join()).toMatch(/lengthScale/);
    expect(validateImpactModel(model("bad", ["x"], { decay: { form: "exponential", parameters: { lengthScale: 3 } } })).valid).toBe(false);
    expect(validateImpactModel(model("ok", ["x"])).valid).toBe(true);
    expect(() => makeModelRegistry({ models: [model("bad", ["x"], { magnitude: 10 }) as any] })).toThrow(/refused/);
  });
});

describe("computeImpactArea", () => {
  const g = buildGraph(gridFeatures(5, 3), { snapToleranceM: 1 });
  const imp = improvementAt("i1", "fix", 0, 0);
  it("returns requires_investigation, not a default radius, when there is no model", () => {
    const r = computeImpactArea({ improvement: { ...imp, impactModelId: "model.fix" }, model: null, graph: g, receptors: [pt("a", 1, 0)], barriers: null, asOf: "2026-01-01" });
    expect(r.status).toBe("requires_investigation");
    expect(r.missingModelId).toBe("model.fix");
    expect(r.cells).toEqual([]);
    const wrong = computeImpactArea({ improvement: imp, model: model("m.other", ["other"]) as any, graph: g, receptors: [pt("a", 1, 0)], barriers: null, asOf: "2026-01-01" });
    expect(wrong.status).toBe("requires_investigation");
  });
  it("applies decay forms to network distance", () => {
    const rec = [pt("r1", 1, 0), pt("r2", 2, 0)];
    const run = (decay: any, reach = 2.5 * H) =>
      computeImpactArea({ improvement: imp, model: model("m", ["fix"], { decay, reach: q(reach, "m") }) as any, graph: g, receptors: rec, barriers: null, asOf: "2026-01-01" });
    expect(run({ form: "bands", parameters: {} }).cells.map((c: any) => c.weight)).toEqual([1, 1]);
    const lin = run({ form: "linear", parameters: {} }).cells;
    expect(lin[0].weight).toBeCloseTo(1 - H / (2.5 * H), 6);
    const ex = run({ form: "exponential", parameters: { lengthScale: q(H, "m") } }).cells;
    expect(ex[1].weight).toBeCloseTo(Math.exp(-2), 6);
    expect(ex[0].distanceKind).toBe("network");
    expect(run({ form: "bands", parameters: {}, bands: [{ outer: q(1.5 * H, "m"), weight: q(0.5, "ratio") }] }).cells.length).toBe(1);
  });
  it("keeps negative effects as separate signed layers", () => {
    const m = model("m.park", ["fix"], { negativeEffects: [layer("m.park.noise", { target: "noise", sign: -1, reach: q(1.5 * H, "m"), magnitude: q(3, "dB") })] });
    const r = computeImpactArea({ improvement: imp, model: m as any, graph: g, receptors: [pt("r1", 1, 0), pt("r2", 2, 0)], barriers: null, asOf: "2026-01-01" });
    expect(r.cells.length).toBe(2);
    expect(r.cells.every((c: any) => c.sign === 1)).toBe(true);
    expect(r.negativeLayers.length).toBe(1);
    expect(r.negativeLayers[0].cells.map((c: any) => [c.ref.id, c.sign])).toEqual([["r1", -1]]);
    const v = valueEffect(r, { r1: q(1000, "USD"), r2: q(1000, "USD") });
    expect(v.perReceptor.filter((x) => x.receptorId === "r1").map((x) => x.sign).sort()).toEqual([1]);
    expect(v.notValued[0].layerId).toBe("m.park.noise");
  });
  it("sets resolution from receptor kinds", () => {
    const m = model("m", ["fix"]) as any;
    const res = (receptors: any[]) => computeImpactArea({ improvement: imp, model: m, graph: g, receptors, barriers: null, asOf: "2026-01-01" }).resolution;
    expect(res([parcelAt("p1", 1, 0), parcelAt("p2", 2, 0)])).toBe("parcel");
    expect(res([parcelAt("p1", 1, 0), pt("x", 2, 0)])).toBe("area");
    const seg = (id: string, c: number) => makeGeoRef({ kind: "street_segment", id, jurisdiction: J, geometry: { type: "LineString", coordinates: [[c * STEP, 0], [(c + 1) * STEP, 0]] } });
    expect(res([seg("s1", 0), seg("s2", 1)])).toBe("street_segment");
    expect(res([])).toBe("area");
  });
  it("falls back to straight line with lower confidence and a note when there is no graph", () => {
    const m = model("m", ["fix"]) as any;
    const withG = computeImpactArea({ improvement: imp, model: m, graph: g, receptors: [pt("r1", 1, 0)], barriers: null, asOf: "2026-01-01" });
    const noG = computeImpactArea({ improvement: imp, model: m, graph: null, receptors: [pt("r1", 1, 0)], barriers: { features: [] }, asOf: "2026-01-01" });
    expect(noG.cells[0].distanceKind).toBe("straight_line_fallback");
    expect(noG.cells[0].distanceM).toBeCloseTo(H, 1);
    expect(noG.notes.join()).toMatch(/straight-line fallback/);
    expect(withG.confidence).toBe("high");
    expect(noG.confidence).toBe("medium");
  });
});

describe("overlap guard and value effect", () => {
  const g = buildGraph(gridFeatures(5, 3), { snapToleranceM: 1 });
  const rec = [pt("p1", 1, 1), pt("p2", 4, 1)];
  const area = (id: string, c: number, magnitude: any) =>
    computeImpactArea({ improvement: improvementAt(id, "fix", c, 1), model: model(`m.${id}`, ["fix"], { magnitude, target: "residential_property_value" }) as any, graph: g, receptors: rec, barriers: null, asOf: "2026-01-01" });
  const base = { p1: q(1000, "USD", 900, 1100) };
  const a = valueEffect(area("a", 0, q(10, "percent", 5, 15)), base);
  const b = valueEffect(area("b", 2, q(20, "percent", 10, 30)), base);
  it("propagates ranges and keeps unknown base values unknown", () => {
    const v = a.perReceptor.find((x) => x.receptorId === "p1")!.value;
    expect(v.value).toBeCloseTo(100, 6);
    expect(v.low).toBeCloseTo(45, 6);
    expect(v.high).toBeCloseTo(165, 6);
    expect(a.unknownBase).toEqual(expect.arrayContaining(["p2"]));
    expect(a.perReceptor.some((x) => x.receptorId === "p2")).toBe(false);
  });
  it("does not sum overlapping improvements without a guard", () => {
    const r = combineImpacts([a, b], null);
    expect(r.flags).toContain("overlap_not_combined");
    expect(r.combined).toEqual([]);
    expect(r.uncombined[0].perImprovement.length).toBe(2);
  });
  it("counts a receptor once under max, capped_sum and not_assessed", () => {
    const mx = combineImpacts([a, b], { rule: "max" });
    expect(mx.combined.length).toBe(1);
    expect(mx.combined[0].value.value).toBeCloseTo(200, 6);
    const cap = q(250, "USD");
    const cs = combineImpacts([a, b], { rule: "capped_sum", cap });
    expect(cs.combined.length).toBe(1);
    expect(cs.combined[0].capped).toBe(true);
    expect(cs.combined[0].value.value).toBe(250);
    const big = combineImpacts([a, b], { rule: "capped_sum", cap: q(5000, "USD") });
    expect(big.combined[0].value.value).toBeCloseTo(300, 6);
    expect(() => combineImpacts([a, b], { rule: "capped_sum", cap: { ...cap, source: null } } as any)).toThrow(/cap/);
    const na = combineImpacts([a, b], { rule: "not_assessed" });
    expect(na.combined[0].value.value).toBeNull();
    expect(na.flags).toContain("overlap_not_assessed");
  });
  it("passes a single contribution through unchanged", () => {
    const r = combineImpacts([a], null);
    expect(r.combined.length).toBe(1);
    expect(r.flags).toEqual([]);
  });
});

describe("block groups are demographic inputs only", () => {
  const sq = (id: string, x0: number, y0: number, x1: number, y1: number, kind: any) =>
    makeGeoRef({ kind, id, jurisdiction: J, geometry: { type: "Polygon", coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]] } as any });
  it("refuses block groups as receptors and as an impact key", () => {
    const g = buildGraph(gridFeatures(3, 3), { snapToleranceM: 1 });
    expect(() => computeImpactArea({ improvement: improvementAt("i", "fix", 0, 0), model: model("m", ["fix"]) as any, graph: g, receptors: [sq("bg", 0, 0, STEP, STEP, "block_group")], barriers: null, asOf: "2026-01-01" })).toThrow(/block group/);
    expect(() => keyImpactByBlockGroup({})).toThrow(/block group/);
  });
  it("apportions by area overlap and tags the output as a demographic input", () => {
    const E = 0.002, h = E / 2;
    const bg = sq("bg1", 0, 0, E, E, "block_group");
    const cells = [sq("c1", 0, 0, h, h, "area"), sq("c2", h, 0, E, h, "area"), sq("c3", 0, h, h, E, "area"), sq("c4", h, h, E, E, "area")];
    const w = areaOverlapWeights([bg], cells);
    expect(w.length).toBe(4);
    for (const x of w) expect(x.weight).toBeCloseTo(0.25, 6);
    const out = apportionDemographics([{ id: "bg1", attributes: { households: 100, income: 50 } }], w, { households: "extensive", income: "intensive" });
    expect(out.every((o) => o.tag === "demographic_input")).toBe(true);
    expect(out[0].attributes.households).toBeCloseTo(25, 6);
    expect(out[0].attributes.income).toBeCloseTo(50, 6);
    const unk = apportionDemographics([{ id: "bg1", attributes: { households: null } }], w, { households: "extensive" });
    expect(unk[0].attributes.households).toBeNull();
    expect(() => apportionDemographics([{ id: "bg1", attributes: { households: 1 } }], w, {})).toThrow(/kind/);
  });
});

describe("benchmark", () => {
  it("5,000-node graph, 20 improvements within 3 s", () => {
    const t0 = performance.now();
    const n = 71; // 5,041 nodes
    const g = buildGraph(gridFeatures(n, n), { snapToleranceM: 1 });
    expect(g.nodes.length).toBeGreaterThanOrEqual(5000);
    const wall = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[35.5 * STEP, -STEP], [35.5 * STEP, 40 * STEP]] } };
    const receptors = Array.from({ length: 500 }, (_, i) => parcelAt(`p${i}`, (i * 7) % n, (i * 13) % n));
    const m = model("m.bench", ["fix"], { reach: q(20 * H, "m"), decay: { form: "linear", parameters: {} } }) as any;
    let cells = 0;
    for (let i = 0; i < 20; i++) {
      const r = computeImpactArea({ improvement: improvementAt(`i${i}`, "fix", (i * 5) % n, (i * 11) % n), model: m, graph: g, receptors, barriers: { features: [wall] }, asOf: "2026-01-01" });
      cells += r.cells.length;
    }
    expect(cells).toBeGreaterThan(0);
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});

describe("pilot adapter: transit value effects", () => {
  const json = JSON.parse(readFileSync("app/data/transit_value_effects.json", "utf8"));
  const { models, skipped } = modelsFromTransitValueEffects(json);
  it("maps rows that carry band, effect, range, quote and source, and skips the rest with a reason", () => {
    expect(models.length).toBeGreaterThan(0);
    expect(models.length + skipped.length).toBe(json.rows.length);
    expect(skipped.every((s) => s.reason.length > 0)).toBe(true);
    expect(skipped.find((s) => s.id.includes("bus_rapid_transit"))).toBeTruthy();
    expect(skipped.find((s) => s.id.startsWith("portland"))).toBeTruthy();
    expect(models.every((m) => m.categoryIds.length === 1 && m.categoryIds[0] === "rail_station")).toBe(true);
    expect(makeModelRegistry({ models }).candidates("rail_station").length).toBe(models.length);
  });
  it("every produced number equals a number in the source row", () => {
    for (const m of models) {
      const row = json.rows.find((r: any) => m.id.endsWith(r.id));
      expect(m.magnitude.value).toBe(row.effect_pct);
      expect(m.magnitude.low).toBe(row.range_low_pct);
      expect(m.magnitude.high).toBe(row.range_high_pct);
      expect(m.reach.value).toBe(1 / 4); // "within 1/4 mile" in distance_band
      expect(row.distance_band).toContain("1/4 mile");
      expect(m.source.url).toBe(row.source_url);
      expect(m.source.quote).toBe(row.quote);
      expect(m.verification.status).toBe(row.verification.status);
      expect(m.transferability).toContain(row.caveat);
      expect(m.studyArea).toBe(row.city);
      expect(m.magnitude.status).toBe("verified");
    }
  });
});

describe("stage-gate review fixes (impact)", () => {
  const json = JSON.parse(readFileSync("app/data/transit_value_effects.json", "utf8"));
  const { models } = modelsFromTransitValueEffects(json);
  const target = "property_value_residential_and_commercial";
  const g = buildGraph(gridFeatures(5, 3), { snapToleranceM: 1 });
  const rec = [pt("p1", 1, 1)];
  const areaFor = (m: any) => computeImpactArea({ improvement: improvementAt("I1", "rail_station", 0, 1), model: m, graph: g, receptors: rec, barriers: null, asOf: "2026-01-01" });

  it("review #8: one station is valued under ONE model (selectModel), and two models for it are refused", () => {
    const reg = makeModelRegistry({ models });
    const light = reg.selectModel("rail_station", target, { mode: "light rail" });
    expect(light.reason).toBeNull();
    expect(light.model!.variant).toBe("light rail"); // most specific beats 'all rail station types'
    expect(reg.selectModel("rail_station", target, { mode: "commuter rail" }).model!.variant).toBe("commuter rail");
    expect(reg.selectModel("rail_station", target, { mode: "tram" }).model!.variant).toBe("all rail station types"); // general model only
    expect(reg.selectModel("rail_station", "no_such_target", {}).reason).toBe("no_match");
    const all = reg.selectModel("rail_station", target, {}).model!;
    expect(all.variant).toBe("all rail station types");
    // The reviewer's case: I1 valued with both models gave 38,000 + 44,500 = 82,500. Now refused; the single model gives its own value only.
    const base = { p1: q(500000, "USD") };
    const eAll = valueEffect(areaFor(all), base), eLight = valueEffect(areaFor(light.model), base);
    expect(() => combineImpacts([eAll, eLight], { rule: "capped_sum", cap: q(1e9, "USD") })).toThrow(/two models/);
    const one = combineImpacts([eLight], { rule: "capped_sum", cap: q(1e9, "USD") });
    expect(one.combined.length).toBe(1);
    expect(one.combined[0].contributors).toEqual(["I1"]);
    // the same effect passed twice is de-duplicated, not doubled: value = magnitude% x 500,000 (single contribution)
    const twice = combineImpacts([eLight, eLight], { rule: "capped_sum", cap: q(1e9, "USD") });
    expect(twice.combined[0].value.value).toBeCloseTo(one.combined[0].value.value as number, 6);
    expect(twice.combined[0].contributors).toEqual(["I1"]);
  });

  it("review #8: registry refuses overlapping models unless variant + specificity or alternativeTo is given", () => {
    const a = model("m.a", ["x"], { variant: "all" }), b = model("m.b", ["x"], { variant: "sub" });
    expect(() => makeModelRegistry({ models: [a, b] as any })).toThrow(/overlaps/);
    expect(() => makeModelRegistry({ models: [{ ...a, specificity: 0 }, { ...b, specificity: 0 }] as any })).toThrow(/overlaps/);
    expect(() => makeModelRegistry({ models: [{ ...a, specificity: 0 }, { ...b, specificity: 1 }] as any })).not.toThrow();
    const alt = makeModelRegistry({ models: [a, { ...b, alternativeTo: ["m.a"] }] as any });
    const r = alt.selectModel("x", "fixture_target", {});
    expect(r.model).toBeNull();
    expect(r.reason).toBe("ambiguous"); // both match and neither is more specific
    expect(r.candidates.sort()).toEqual(["m.a", "m.b"]);
  });

  it("review #11: capped_sum caps low, value and high and refuses a cap in another unit", () => {
    const mk = (id: string) => ({ improvementId: id, unknownBase: [], notValued: [], perReceptor: [{ receptorId: "r", target: "t", sign: 1 as const, layerId: `L${id}`, improvementId: id, value: q(38000, "USD", -36000, 184000) }] });
    // sum: value 76,000, low -72,000, high 368,000; cap 300,000 -> high 300,000, value and low unchanged
    const r = combineImpacts([mk("A"), mk("B")] as any, { rule: "capped_sum", cap: q(300000, "USD") });
    const v = r.combined[0].value;
    expect([v.low, v.value, v.high]).toEqual([-72000, 76000, 300000]);
    expect(r.combined[0].capped).toBe(true);
    expect(() => combineImpacts([mk("A"), mk("B")] as any, { rule: "capped_sum", cap: q(300000, "km") })).toThrow(/unit/);
  });

  it("review #17: annulus bands are parsed to inner/outer only when both numbers are present, else skipped", async () => {
    const { parseBandMiles } = await import("../../../src/platform/pilot/impactModels.js");
    expect(parseBandMiles("within 1/2 mile to 1 mile")).toEqual({ miles: 1, innerM: 0.5 * 1609.344, outerM: 1609.344 }); // 0.5 mi = 804.672 m
    expect(parseBandMiles("between 1/4 and 1/2 mile of the station")).toEqual({ miles: 0.5, innerM: 0.25 * 1609.344, outerM: 0.5 * 1609.344 });
    expect(parseBandMiles("within 1/4 mile of the station")).toEqual({ miles: 0.25 });
    expect(parseBandMiles("within 1/4 mile and beyond")).toBeNull();
    expect(parseBandMiles("beyond 1/2 mile")).toBeNull();
    expect(parseBandMiles("between 1/2 mile and the station")).toBeNull();
    // a model with an inner radius weights 0 inside it (receptor ~ 111 m from the station, inner 500 m, reach 1000 m)
    const ann = model("m.ann", ["rail_station"], { innerRadius: q(500, "m"), reach: q(1000, "m") });
    const near = computeImpactArea({ improvement: improvementAt("I2", "rail_station", 0, 1), model: ann as any, graph: g, receptors: [pt("n", 1, 1), pt("f", 4, 1)], barriers: null, asOf: "2026-01-01" });
    const w = Object.fromEntries(near.cells.map((c: any) => [c.ref.id, c.weight]));
    expect(w.n).toBe(0); // ~111 m < 500 m inner radius
  });
});
