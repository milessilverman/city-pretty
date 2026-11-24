import { describe, expect, it } from "vitest";
import { makeQuantity, unknownQuantity } from "../../../src/platform/schema/index.js";
import { SYNERGY_TYPES, makeInteraction, applyInteractions, sequence, runScenarios, optimizePortfolio } from "../../../src/platform/portfolio/index.js";

// FIXTURE: not real data. Every number below is synthetic.
const SRC = { title: "FIXTURE", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const q = (value: number, unit = "USD", spread = 0, extra: any = {}) =>
  makeQuantity({ value, unit, low: value - spread, high: value + spread, status: "verified", source: SRC, jurisdiction: "Fixtureland", effectiveDate: "2000-01-01", ...extra });
const ratio = (v: number) => q(v, "ratio");
const unk = (unit = "USD") => unknownQuantity(unit, "fixture: unknown");

describe("synergy", () => {
  const items = [
    { id: "A", categoryId: "park", valueStreams: { propertyAppreciation: q(100), municipalTaxRevenue: q(10) }, cost: q(50), demand: { cap: 6 } },
    { id: "B", categoryId: "housing", valueStreams: { propertyAppreciation: q(60), municipalTaxRevenue: q(20) }, cost: q(40), demand: { cap: 5 } },
    { id: "C", categoryId: "rail", valueStreams: { propertyAppreciation: q(30) }, cost: q(20), demand: { cap: 1 } },
  ];
  it("lists the type vocabulary", () => {
    expect(SYNERGY_TYPES.positive).toHaveLength(7);
    expect(SYNERGY_TYPES.negative).toHaveLength(5);
  });
  it("refuses an interaction without a sourced magnitude", () => {
    const base = { a: "A", b: "B", type: "demand", sign: "positive" as const, effectOn: "propertyAppreciation", basis: "fixture" };
    expect(() => makeInteraction({ ...base, magnitude: q(0.1, "ratio", 0, { source: null, assumptions: ["x"], status: "assumed" }) })).toThrow(/source/);
    expect(() => makeInteraction({ ...base, magnitude: unk("ratio") })).toThrow(/known/);
    expect(() => makeInteraction({ ...base, magnitude: ratio(0.1), basis: "" })).toThrow(/basis/);
    expect(() => makeInteraction({ ...base, sign: "negative", magnitude: ratio(0.1) })).toThrow(/positive/);
    expect(() => makeInteraction({ ...base, effectOn: "everything", magnitude: ratio(0.1) })).toThrow(/effectOn/);
  });
  it("applies a positive and a negative interaction per stream and lists unrecorded pairs as not assessed", () => {
    const pos = makeInteraction({ a: "A", b: "B", type: "demand", sign: "positive", effectOn: "propertyAppreciation", magnitude: ratio(0.1), basis: "fixture" });
    const neg = makeInteraction({ a: "park", b: "rail", type: "overlap", sign: "negative", effectOn: "propertyAppreciation", magnitude: q(5), basis: "fixture" });
    const r = applyInteractions(items, [pos, neg]);
    const ab = r.pairs.find((p) => p.a === "A" && p.b === "B")!;
    expect(ab.adjustments[0].adjustment!.value).toBeCloseTo(16); // 0.1 * (100 + 60)
    const ac = r.pairs.find((p) => p.a === "A" && p.b === "C")!;
    expect(ac.adjustments[0].adjustment!.value).toBe(-5);
    expect(r.notAssessed.map((p) => `${p.a}|${p.b}`)).toEqual(["B|C"]);
    expect(r.byStream.propertyAppreciation.adjustment.value).toBeCloseTo(11);
    expect(r.byStream.propertyAppreciation.combined.value).toBeCloseTo(201); // 190 + 11
    expect(r.byStream.municipalTaxRevenue.combined.value).toBe(30); // untouched, never merged with another stream
  });
  it("does not treat a missing record as zero synergy", () => {
    const r = applyInteractions(items, []);
    expect(r.notAssessed).toHaveLength(3);
    expect(r.pairs).toHaveLength(0);
  });
  it("double-counting guard caps the combined value", () => {
    const pos = makeInteraction({ a: "A", b: "B", type: "demand", sign: "positive", effectOn: "propertyAppreciation", magnitude: ratio(0.5), basis: "fixture" });
    const capped = applyInteractions(items.slice(0, 2), [pos], { guard: { propertyAppreciation: { rule: "capped_sum", cap: q(170) } } });
    expect(capped.byStream.propertyAppreciation.beforeGuard.value).toBe(240);
    expect(capped.byStream.propertyAppreciation.combined.value).toBe(170);
    expect(capped.byStream.propertyAppreciation.guard.applied).toBe(true);
    const mx = applyInteractions(items.slice(0, 2), [pos], { guard: { propertyAppreciation: { rule: "max" } } });
    expect(mx.byStream.propertyAppreciation.combined.value).toBe(100);
    expect(() => applyInteractions(items, [], { guard: { propertyAppreciation: { rule: "capped_sum" } } })).toThrow(/cap/);
  });
  it("an unknown stream amount gives an unknown adjustment, not zero", () => {
    const x = makeInteraction({ a: "A", b: "B", type: "network", sign: "positive", effectOn: "propertyAppreciation", magnitude: ratio(0.1), basis: "fixture" });
    const withUnknown = [{ ...items[0], valueStreams: { propertyAppreciation: unk() } }, items[1]];
    const r = applyInteractions(withUnknown, [x]);
    expect(r.pairs[0].adjustments[0].adjustment).toBeNull();
    expect(r.byStream.propertyAppreciation.combined).toBe("unknown");
  });
  it("shared-capacity limit marks the combination infeasible", () => {
    const cap = makeInteraction({ a: "A", b: "B", type: "capacity_limit", sign: "negative", resource: "cap", magnitude: q(10, "units"), basis: "fixture" });
    const r = applyInteractions(items, [cap]);
    expect(r.feasible).toBe(false);
    expect(r.infeasible[0]).toMatchObject({ a: "A", b: "B", demand: 11, limit: 10 });
    expect(applyInteractions([items[1], items[2]], [makeInteraction({ a: "B", b: "C", type: "land_limit", sign: "negative", resource: "cap", magnitude: q(10, "units"), basis: "f" })]).feasible).toBe(true);
  });
  it("cost interactions reduce cost when positive", () => {
    const x = makeInteraction({ a: "A", b: "B", type: "construction", sign: "positive", effectOn: "cost", magnitude: q(7), basis: "fixture" });
    expect(applyInteractions(items.slice(0, 2), [x]).byStream.cost.combined.value).toBe(83);
  });
});

describe("sequencing", () => {
  const mk = (id: string, o: any = {}) => ({ id, durationPeriods: 2, earliestStart: 0, dependsOn: [], acquisitionBy: null, absorptionPerPeriod: null, regulatoryGate: null, financingWindow: null, ...o });
  it("orders by dependency", () => {
    const r = sequence({ items: [mk("c", { dependsOn: ["b"] }), mk("b", { dependsOn: ["a"] }), mk("a")], horizon: 10 });
    expect(r.order).toEqual(["a", "b", "c"]);
    expect(r.schedule.c.start).toBe(4);
    expect(r.flagged).toEqual([]);
  });
  it("throws naming the cycle", () => {
    expect(() => sequence({ items: [mk("a", { dependsOn: ["b"] }), mk("b", { dependsOn: ["a"] })], horizon: 10 })).toThrow(/a -> b -> a|b -> a -> b/);
    expect(() => sequence({ items: [mk("a", { dependsOn: ["zz"] })], horizon: 10 })).toThrow(/unknown/);
  });
  it("a regulatory gate, acquisition and financing window delay the start; late items are flagged not dropped", () => {
    const r = sequence({ items: [mk("g", { regulatoryGate: { availableFrom: 5 } }), mk("q", { acquisitionBy: 3 }), mk("f", { financingWindow: { from: 2, to: 2 }, dependsOn: ["g"] })], horizon: 8 });
    expect(r.schedule.g.start).toBe(5);
    expect(r.schedule.g.bindingConstraints).toContain("regulatory gate");
    expect(r.schedule.q.start).toBe(3);
    expect(r.schedule.f.flags).toEqual(expect.arrayContaining(["exceeds_horizon", "financing_window_missed"]));
    expect(r.order).toContain("f");
  });
  it("absorption is capped by a supplied Quantity, else not assessed", () => {
    const r = sequence({ items: [mk("u", { units: 25, absorptionPerPeriod: q(10, "units/period", 5) }), mk("n")], horizon: 4 });
    expect(r.schedule.n.absorption.status).toBe("absorption not assessed");
    expect(r.schedule.u.absorption).toMatchObject({ status: "assessed", absorptionPeriods: 3, completeBy: 5, slowestPeriods: 5, fastestPeriods: 2 });
    expect(r.schedule.u.phasing.filter((p: any) => p.activity === "release").map((p: any) => p.units)).toEqual([10, 10, 5]);
    expect(r.schedule.u.flags).toContain("absorption_exceeds_horizon");
  });
  it("reports no_schedule_data, or standalone vs coordinated cost when schedule and sourced costs exist", () => {
    const cs = [{ itemId: "s", segmentId: "seg1", standaloneCost: q(100), coordinatedCost: q(80) }];
    expect(sequence({ items: [mk("s")], horizon: 5, streetWork: null, coordinationSavings: cs }).streetCoordination[0].status).toBe("no_schedule_data");
    const sw = [{ segmentId: "seg1", scheduledPeriod: 1, source: SRC }];
    const ok = sequence({ items: [mk("s")], horizon: 5, streetWork: sw, coordinationSavings: cs }).streetCoordination[0] as any;
    expect(ok.status).toBe("coordinated");
    expect(ok.saving.value).toBe(20);
    const noCost = sequence({ items: [mk("s")], horizon: 5, streetWork: sw, coordinationSavings: [{ ...cs[0], coordinatedCost: unk() }] }).streetCoordination[0];
    expect(noCost.status).toBe("no_schedule_data");
    const off = sequence({ items: [mk("s")], horizon: 9, streetWork: [{ ...sw[0], scheduledPeriod: 8 }], coordinationSavings: cs }).streetCoordination[0];
    expect(off.status).toBe("not_aligned");
  });
});

describe("scenarios", () => {
  const evaluate = (inp: any, h: number) => ({
    streams: { propertyAppreciation: inp.unknown ? unk() : q(inp.v * h, "USD", inp.spread ?? 0), municipalTaxRevenue: q(inp.t, "USD", 1) },
    phasing: { periods: h },
  });
  const baseline = { v: 10, t: 5, spread: 1 };
  it("computes per-horizon differences with ranges by interval arithmetic", () => {
    const r = runScenarios({ baseline, hypotheticals: [{ name: "more", changes: { v: 12, spread: 2 } }], evaluate, horizons: [2, 5] });
    const d = r.scenarios[0].results[1].differenceVsBaseline;
    expect(d.propertyAppreciation.value).toBe(10); // 60 - 50
    expect(d.propertyAppreciation.low).toBe(7);
    expect(d.propertyAppreciation.high).toBe(13);
    expect(d.municipalTaxRevenue.value).toBe(0);
    expect(r.scenarios[0].results[0].phasing).toEqual({ periods: 2 });
    expect(r.scenarios[0].results).toHaveLength(2);
  });
  it("unknown evaluation outputs give unknown differences, never zero", () => {
    const r = runScenarios({ baseline, hypotheticals: [{ name: "u", changes: { unknown: true } }], evaluate, horizons: [3] });
    const d = r.scenarios[0].results[0].differenceVsBaseline;
    expect(d.propertyAppreciation.value).toBeNull();
    expect(d.municipalTaxRevenue.value).toBe(0);
  });
});

describe("optimizer", () => {
  // deterministic pseudo-random fixture generator
  function gen(seed: number, n: number) {
    let s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const cands = [];
    for (let i = 0; i < n; i++) {
      const c = 10 + Math.floor(rnd() * 40);
      cands.push({ id: `c${i}`, cost: q(c, "USD", 2), objectiveValue: q(Math.round((c * (0.5 + rnd()) + rnd()) * 1000) / 1000, "USD"), irr: 0.02 + Math.floor(rnd() * 12) / 100,
        publicOutcome: { homes: Math.floor(rnd() * 20) }, startPeriod: 0, endPeriod: 1 + Math.floor(rnd() * 8), excludes: [] as string[], requires: [] as string[] });
    }
    cands[1].excludes.push("c4"); cands[2].excludes.push("c7"); cands[5].requires.push("c3"); cands[9].requires.push("c6");
    return cands;
  }
  function brute(cands: any[], con: any, conservative: boolean, inter: any[] = []) {
    const n = cands.length;
    const res: { obj: number; mask: number }[] = [];
    for (let m = 0; m < 1 << n; m++) {
      const s = cands.filter((_, i) => m & (1 << i));
      const ids = new Set(s.map((c) => c.id));
      const cost = s.reduce((a, c) => a + (conservative ? c.cost.high : c.cost.value), 0);
      if (cost > con.budget.value) continue;
      if (s.some((c) => c.excludes.some((e: string) => ids.has(e)) || c.requires.some((r: string) => !ids.has(r)))) continue;
      if (con.horizon !== null && s.some((c) => c.endPeriod > con.horizon)) continue;
      if (con.minReturn !== null && cost > 0 && s.reduce((a, c) => a + (conservative ? c.cost.high : c.cost.value) * c.irr, 0) / cost < con.minReturn) continue;
      if (Object.entries(con.minPublicOutcomes || {}).some(([k, v]) => s.reduce((a, c) => a + (c.publicOutcome[k] || 0), 0) < (v as number))) continue;
      let obj = s.reduce((a, c) => a + c.objectiveValue.value, 0);
      for (const it of inter) if (ids.has(it.a) && ids.has(it.b)) obj += it.adjustment.value;
      res.push({ obj, mask: m });
    }
    res.sort((x, y) => y.obj - x.obj);
    return res;
  }
  const cases = [
    { seed: 7, n: 10, budget: 120, minReturn: 0.05, horizon: null, outcomes: { homes: 25 }, conservative: false },
    { seed: 99, n: 12, budget: 200, minReturn: null, horizon: 6, outcomes: { homes: 40 }, conservative: true },
    { seed: 2024, n: 14, budget: 150, minReturn: 0.06, horizon: 8, outcomes: { homes: 30 }, conservative: false },
  ];
  for (const f of cases) {
    it(`matches brute force on fixture seed ${f.seed} (n=${f.n}) and reports opportunity cost`, () => {
      const cands = gen(f.seed, f.n);
      const con = { budget: q(f.budget), minReturn: f.minReturn, horizon: f.horizon, minPublicOutcomes: f.outcomes };
      const inter = [{ a: "c0", b: "c8", adjustment: q(6) }, { a: "c3", b: "c5", adjustment: q(-4) }];
      for (const useInter of [false, true]) {
        const r: any = optimizePortfolio({ candidates: cands, constraints: con, interactions: useInter ? inter : null, objective: "maximize", conservative: f.conservative });
        const bf = brute(cands, con, f.conservative, useInter ? inter : []);
        expect(r.method).toBe("exact (branch and bound)");
        expect(r.feasible).toBe(true);
        expect(r.totals.objectiveValue).toBeCloseTo(bf[0].obj, 6);
        expect(r.totals.objective.value).toBeCloseTo(bf[0].obj, 6);
        expect(r.nextBest.objectiveValue).toBeCloseTo(bf[1].obj, 6);
        expect(r.opportunityCost.value).toBeCloseTo(bf[0].obj - bf[1].obj, 6);
        expect(r.slack.budget).toBeGreaterThanOrEqual(0);
        expect(r.slack.minPublicOutcomes.homes).toBeGreaterThanOrEqual(0);
        const ids = new Set(r.chosen);
        expect(cands.filter((_, i) => bf[0].mask & (1 << i)).every((c) => ids.has(c.id)) || Math.abs(bf[0].obj - bf[1].obj) < 1e-9).toBe(true);
      }
    });
  }
  it("lists unknown candidates under notOptimised instead of dropping them, and says optimality is partial", () => {
    const cands = gen(5, 10);
    cands[0] = { ...cands[0], cost: unk() };
    cands[3] = { ...cands[3], objectiveValue: unk() };
    const r: any = optimizePortfolio({ candidates: cands, constraints: { budget: q(300), minReturn: null, horizon: null, minPublicOutcomes: null }, objective: "maximize" });
    const ids = r.notOptimised.map((x: any) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["c0", "c3", "c5"])); // c5 requires c3
    expect(r.notOptimised.find((x: any) => x.id === "c5").reason).toMatch(/requires c3/);
    expect(r.optimalAmong).toMatch(/fully assessed/);
    expect(r.chosen).not.toContain("c0");
  });
  it("reports the marginal candidate excluded by the budget", () => {
    const mk = (id: string, c: number, o: number) => ({ id, cost: q(c), objectiveValue: q(o), irr: null, publicOutcome: {}, startPeriod: 0, endPeriod: 1, excludes: [], requires: [] });
    const r: any = optimizePortfolio({ candidates: [mk("a", 6, 10), mk("b", 5, 7), mk("c", 5, 6)], constraints: { budget: q(10), minReturn: null, horizon: null, minPublicOutcomes: null }, objective: "maximize" });
    expect([...r.chosen].sort()).toEqual(["b", "c"]);
    expect(r.marginalExcludedByBudget.id).toBe("a");
    expect(r.marginalExcludedByBudget.shortBy).toBe(6);
    expect(r.opportunityCost.value).toBe(3); // 13 vs a alone (10)
  });
  it("refuses a minimum return when IRR is unknown for a selected candidate", () => {
    const mk = (id: string, irr: number | null) => ({ id, cost: q(5), objectiveValue: q(5), irr, publicOutcome: {}, startPeriod: 0, endPeriod: 1, excludes: [], requires: [] });
    const r: any = optimizePortfolio({ candidates: [mk("a", null), mk("b", 0.1)], constraints: { budget: q(10), minReturn: 0.05, horizon: null, minPublicOutcomes: null }, objective: "maximize" });
    expect(r.chosen).toEqual(["b"]);
  });
  it("benchmark: 200 candidates within 5 s on the heuristic path, labelled", () => {
    const cands = gen(31337, 200);
    const t0 = performance.now();
    const r: any = optimizePortfolio({ candidates: cands, constraints: { budget: q(1500), minReturn: 0.04, horizon: null, minPublicOutcomes: { homes: 100 } }, objective: "maximize" });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(5000);
    expect(r.method).toBe("heuristic, not proven optimal");
    expect(r.proven).toBe(false);
    expect(r.feasible).toBe(true);
    expect(r.slack.budget).toBeGreaterThanOrEqual(0);
    expect(r.slack.minPublicOutcomes.homes).toBeGreaterThanOrEqual(0);
  });
});
