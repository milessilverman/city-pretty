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
  // Stage 5 review regressions (docs/audit/stage5-review.md)
  const land = (a: string, b: string, lim = 10) => makeInteraction({ a, b, type: "land_limit", sign: "negative", resource: "land", magnitude: q(lim, "acres"), basis: "fixture" });
  const three = ["A", "B", "C"].map((id) => ({ id, valueStreams: {}, cost: q(1), demand: { land: 4 } }));
  it("review #5: a land limit is checked over the whole set, not only pairwise", () => {
    // every pair is 4 + 4 = 8 <= 10, but all three draw on one pool: 4 + 4 + 4 = 12 > 10
    const r = applyInteractions(three, [land("A", "B"), land("A", "C"), land("B", "C")]);
    expect(r.feasible).toBe(false);
    expect(r.infeasible).toEqual([{ scope: "set", items: ["A", "B", "C"], type: "land_limit", resource: "land", demand: 12, limit: 10 }]);
    // the tightest supplied limit applies: 12 <= 13 is within, 12 > 11 is not
    expect(applyInteractions(three, [land("A", "B", 13), land("B", "C", 13)]).feasible).toBe(true);
    expect(applyInteractions(three, [land("A", "B", 13), land("B", "C", 11)]).feasible).toBe(false);
  });
  it("review #6: unknown demand makes feasibility unknown (null), not true", () => {
    const r = applyInteractions([three[0], { id: "B", valueStreams: {}, demand: {} }], [land("A", "B")]);
    expect(r.feasible).toBeNull();
    expect(r.hardUnknown).toHaveLength(1);
  });
  it("review #7: a pair with only hard-limit records is still not assessed for value streams", () => {
    const r = applyInteractions(three.slice(0, 2), [land("A", "B")]);
    expect(r.notAssessed).toHaveLength(1);
    expect(r.notAssessed[0].status).toMatch(/only hard-limit/);
  });
  it("review #8: a capped_sum guard in another unit is refused, not applied", () => {
    const pos = makeInteraction({ a: "A", b: "B", type: "demand", sign: "positive", effectOn: "propertyAppreciation", magnitude: ratio(0.1), basis: "fixture" });
    // before the fix the USD stream (100 + 60 + 16 = 176) was silently capped to 5 by a cap in acres
    expect(() => applyInteractions(items.slice(0, 2), [pos], { guard: { propertyAppreciation: { rule: "capped_sum", cap: q(5, "acres") } } })).toThrow(/unit/);
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
  it("review #9: street work in the period after the build (finish is exclusive) is not coordinated", () => {
    const cs = [{ itemId: "s", segmentId: "seg1", standaloneCost: q(100), coordinatedCost: q(80) }];
    // start 0, duration 2: build periods 0 and 1, finish 2; street work in period 2 is outside the window
    const r = sequence({ items: [mk("s")], horizon: 5, streetWork: [{ segmentId: "seg1", scheduledPeriod: 2, source: SRC }], coordinationSavings: cs });
    expect(r.schedule.s.phasing.map((p: any) => p.period)).toEqual([0, 1]);
    expect(r.streetCoordination[0].status).toBe("not_aligned");
  });
  it("review #10: any sourced street-work entry inside the window counts, not only the first", () => {
    const cs = [{ itemId: "s", segmentId: "seg1", standaloneCost: q(100), coordinatedCost: q(80) }];
    const sw = [{ segmentId: "seg1", scheduledPeriod: 8, source: SRC }, { segmentId: "seg1", scheduledPeriod: 1, source: SRC }];
    const r = sequence({ items: [mk("s")], horizon: 9, streetWork: sw, coordinationSavings: cs }).streetCoordination[0] as any;
    expect(r.status).toBe("coordinated");
    expect(r.streetWorkPeriod).toBe(1);
    expect(r.saving.value).toBe(20); // 100 - 80
  });
  it("review #11: a non-positive low absorption bound gives no slowest case instead of the point value", () => {
    // 20 units at 10 (low 0, high 20) per period: point ceil(20/10) = 2, fastest ceil(20/20) = 1, slowest never
    const r = sequence({ items: [mk("u", { units: 20, absorptionPerPeriod: makeQuantity({ value: 10, unit: "units/period", low: 0, high: 20, status: "verified", source: SRC, jurisdiction: "Fixtureland", effectiveDate: "2000-01-01" }) })], horizon: 9 });
    expect(r.schedule.u.absorption).toMatchObject({ absorptionPeriods: 2, fastestPeriods: 1, slowestPeriods: null });
  });
  it("review #12: a missing duration or start is refused, not scheduled as NaN", () => {
    expect(() => sequence({ items: [mk("u", { durationPeriods: undefined })], horizon: 9 })).toThrow(/durationPeriods/);
    expect(() => sequence({ items: [mk("u", { earliestStart: null })], horizon: 9 })).toThrow(/earliestStart/);
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
  const one = (id: string, c: number, o: number, x: any = {}) => ({ id, cost: q(c), objectiveValue: q(o), irr: null, publicOutcome: {}, startPeriod: 0, endPeriod: 1, excludes: [], requires: [], ...x });
  const none = { minReturn: null, horizon: null, minPublicOutcomes: null };
  it("review #1: no assessed candidate gives the empty portfolio instead of a crash", () => {
    // the only candidate ends in period 9, after the horizon of 3; before the fix: TypeError reading 'cost'
    const r: any = optimizePortfolio({ candidates: [one("a", 5, 5, { endPeriod: 9 })], constraints: { budget: q(10), ...none, horizon: 3 }, objective: "maximize" });
    expect(r.feasible).toBe(true);
    expect(r.chosen).toEqual([]);
    expect(r.excludedByHorizon).toEqual(["a"]);
    expect(r.totals.objective.value).toBe(0);
  });
  it("review #2: two interaction records on one pair are both carried into the objective Quantity", () => {
    // {a,b}: 10 + 10 + 3 + 2 = 25; next best a alone = 10; opportunity cost 25 - 10 = 15 (was 22 and 12)
    const r: any = optimizePortfolio({ candidates: [one("a", 1, 10), one("b", 1, 10)], constraints: { budget: q(10), ...none },
      interactions: [{ a: "a", b: "b", adjustment: q(3) }, { a: "b", b: "a", adjustment: q(2) }], objective: "maximize" });
    expect(r.totals.objectiveValue).toBe(25);
    expect(r.totals.objective.value).toBe(25);
    expect(r.opportunityCost.value).toBe(15);
  });
  it("review #3: conservative mode tests the high cost against the low budget", () => {
    // budget 100 (80..120), cost 90: 90 > 80, so nothing fits when conservative; 90 <= 100 fits otherwise
    const cands = [one("a", 90, 10)];
    const cons: any = optimizePortfolio({ candidates: cands, constraints: { budget: q(100, "USD", 20), ...none }, objective: "maximize", conservative: true });
    expect(cons.chosen).toEqual([]);
    expect(cons.budgetLimitApplied).toBe(80);
    expect(cons.slack.budget).toBe(80); // 80 - 0
    const point: any = optimizePortfolio({ candidates: cands, constraints: { budget: q(100, "USD", 20), ...none }, objective: "maximize" });
    expect(point.chosen).toEqual(["a"]);
  });
  it("review #4: a missing public-outcome value is listed and the constraint says it counted it as zero", () => {
    const r: any = optimizePortfolio({ candidates: [one("a", 1, 10, { publicOutcome: { homes: 5 } }), one("b", 1, 10), one("c", 1, 1, { publicOutcome: { homes: NaN } })],
      constraints: { budget: q(10), ...none, minPublicOutcomes: { homes: 5 } }, objective: "maximize" });
    expect(r.unknownPublicOutcome).toEqual([{ id: "b", outcomes: ["homes"] }, { id: "c", outcomes: ["homes"] }]);
    expect(r.unknownPublicOutcomeNote).toMatch(/counted as zero/);
    expect(r.totals.outcomes.homes).toBe(5); // 5 + 0 + 0, never NaN
    // a NaN outcome no longer satisfies a minimum: c alone counts 0 < 5
    const nan: any = optimizePortfolio({ candidates: [one("c", 1, 1, { publicOutcome: { homes: NaN } })], constraints: { budget: q(10), ...none, minPublicOutcomes: { homes: 5 } }, objective: "maximize" });
    expect(nan.feasible).toBe(false);
  });
  it("review #13: an unknown end period is not assessed when a horizon is set", () => {
    const r: any = optimizePortfolio({ candidates: [one("a", 1, 10, { endPeriod: null })], constraints: { budget: q(10), ...none, horizon: 3 }, objective: "maximize" });
    expect(r.chosen).toEqual([]);
    expect(r.notOptimised[0]).toMatchObject({ id: "a", reason: expect.stringMatching(/end period unknown/) });
  });
  it("review #14: candidates with no return are listed when a minimum return is set", () => {
    const r: any = optimizePortfolio({ candidates: [one("a", 5, 5), one("b", 5, 5, { irr: 0.1 })], constraints: { budget: q(10), ...none, minReturn: 0.05 }, objective: "maximize" });
    expect(r.chosen).toEqual(["b"]);
    expect(r.unknownReturn).toEqual(["a"]);
  });
  it("review fuzz: 300 fixed-seed cases match brute force (budget range, conservative, interactions incl. duplicates and negatives)", () => {
    let s = 12345;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const r3 = (v: number, lo: number, hi: number) => makeQuantity({ value: v, unit: "USD", low: lo, high: hi, status: "verified", source: SRC, jurisdiction: "Fixtureland", effectiveDate: "2000-01-01" });
    for (let k = 0; k < 300; k++) {
      const n = ri(1, 8);
      const cands: any[] = [];
      for (let i = 0; i < n; i++) {
        const c = ri(0, 30), sp = ri(0, 5), o = ri(-10, 40), po: any = {};
        if (rnd() < 0.8) po.homes = ri(0, 10);
        cands.push({ id: `k${i}`, cost: r3(c, Math.max(0, c - sp), c + sp), objectiveValue: r3(o, o - 1, o + 1), irr: rnd() < 0.15 ? null : ri(-5, 15) / 100,
          publicOutcome: po, startPeriod: 0, endPeriod: ri(1, 10), excludes: [], requires: [] });
      }
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.2) { const j = ri(0, n - 1); if (j !== i) cands[i].excludes.push(`k${j}`); }
        if (rnd() < 0.2) { const j = ri(0, n - 1); if (j !== i) cands[i].requires.push(`k${j}`); }
      }
      const inter: any[] = [];
      for (let t2 = ri(0, 4); t2 > 0 && n > 1; t2--) { const a = ri(0, n - 1), b = ri(0, n - 1); if (a !== b) inter.push({ a: `k${a}`, b: `k${b}`, adjustment: q(ri(-15, 15)) }); }
      const bv = ri(10, 120), bsp = ri(0, 15);
      const con: any = { budget: r3(bv, bv - bsp, bv + bsp), minReturn: rnd() < 0.4 ? ri(0, 8) / 100 : null, horizon: rnd() < 0.5 ? ri(3, 10) : null,
        minPublicOutcomes: rnd() < 0.5 ? { homes: ri(0, 20) } : null };
      const conservative = rnd() < 0.4;
      const B = conservative ? con.budget.low : con.budget.value;
      const objs: number[] = [];
      for (let m = 0; m < 1 << n; m++) {
        const S = cands.filter((_, i) => m & (1 << i)), ids = new Set(S.map((c) => c.id));
        const cost = S.reduce((x, c) => x + (conservative ? c.cost.high : c.cost.value), 0);
        if (cost > B) continue;
        if (S.some((c) => c.excludes.some((e: string) => ids.has(e)) || c.requires.some((r: string) => !ids.has(r)))) continue;
        if (con.horizon !== null && S.some((c) => c.endPeriod > con.horizon)) continue;
        if (con.minReturn !== null && cost > 0 && (S.some((c) => c.irr === null)
          || S.reduce((x, c) => x + (conservative ? c.cost.high : c.cost.value) * c.irr, 0) / cost < con.minReturn)) continue;
        if (con.minPublicOutcomes && S.reduce((x, c) => x + (c.publicOutcome.homes ?? 0), 0) < con.minPublicOutcomes.homes) continue;
        objs.push(S.reduce((x, c) => x + c.objectiveValue.value, 0) + inter.reduce((x, it) => x + (ids.has(it.a) && ids.has(it.b) ? it.adjustment.value : 0), 0));
      }
      objs.sort((x, y) => y - x);
      const r: any = optimizePortfolio({ candidates: cands, constraints: con, interactions: inter, objective: "maximize", conservative });
      expect(r.feasible, `case ${k}`).toBe(objs.length > 0);
      if (!objs.length) continue;
      expect(r.totals.objectiveValue, `case ${k}`).toBe(objs[0]);
      expect(r.totals.objective.value, `case ${k}`).toBe(objs[0]);
      expect(r.nextBest ? r.nextBest.objectiveValue : null, `case ${k}`).toBe(objs.length > 1 ? objs[1] : null);
      if (objs.length > 1) expect(r.opportunityCost.value, `case ${k}`).toBe(objs[0] - objs[1]);
    }
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
