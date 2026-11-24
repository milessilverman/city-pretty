import { describe, expect, it } from "vitest";
import { IMPROVEMENT_CATEGORIES, makeGeoRef } from "../../../src/platform/schema/index.js";
import {
  LeakageError, SurvivorshipError, confusionCounts, createLedger, f1, finalizeLedger, precision, recall,
  reconstructYear, recordFound, recordMissingData, recordNeedsInfo, recordNotEvaluated, recordRejected,
  recordStaleData, runBacktest, summarizeLedgers,
} from "../../../src/platform/coverage/index.js";

// FIXTURE: not real data
const J = { state: "XX", countyFips: "00000" };
const sq = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];
const parcel = (id: string) => makeGeoRef({ kind: "parcel", id, jurisdiction: J, geometry: { type: "Polygon", coordinates: [sq] } as any });
const cats = [
  { id: "c1", appliesTo: ["parcel"] }, { id: "c2", appliesTo: ["parcel"] }, { id: "c3", appliesTo: ["parcel"] },
  { id: "c4", appliesTo: ["parcel"] }, { id: "s1", appliesTo: ["street_segment"] },
];

describe("ledger", () => {
  const full = () => {
    const l = createLedger(parcel("p"), "2000-01-01", cats);
    recordFound(l, "c1", "opp-1");
    recordRejected(l, "c2", { basis: "regulatory", reason: "height limit below minimum viable building" });
    recordNeedsInfo(l, "c3", ["assessed value"]);
    recordNotEvaluated(l, "c4", "rule set not yet written");
    return l;
  };
  it("each applicable category ends in exactly one outcome; inapplicable ones are notEvaluated with a reason", () => {
    const f = finalizeLedger(full());
    expect(f.found).toEqual([{ categoryId: "c1", opportunityId: "opp-1" }]);
    expect(f.rejected[0]).toMatchObject({ categoryId: "c2", basis: "regulatory" });
    expect(f.needsInfo).toEqual([{ categoryId: "c3", missing: ["assessed value"] }]);
    expect(f.notEvaluated.map((n) => n.categoryId).sort()).toEqual(["c4", "s1"]);
    expect(f.evaluated).toEqual(["c1", "c2"]);
    expect(f.confidence).toBe("low");
    expect(Object.isFrozen(f)).toBe(true);
  });
  it("finalize fails if an applicable category is unaccounted for", () => {
    const l = createLedger(parcel("p"), "2000-01-01", cats);
    recordFound(l, "c1");
    expect(() => finalizeLedger(l)).toThrow(/c2, c3, c4/);
  });
  it("refuses a second outcome, unknown or inapplicable categories", () => {
    const l = createLedger(parcel("p"), "2000-01-01", cats);
    recordFound(l, "c1");
    expect(() => recordNeedsInfo(l, "c1", ["x"])).toThrow(/exactly one/);
    expect(() => recordFound(l, "zzz")).toThrow();
    expect(() => recordFound(l, "s1")).toThrow();
  });
  it("missing data never yields rejected", () => {
    const l = createLedger(parcel("p"), "2000-01-01", cats);
    expect(() => recordRejected(l, "c1", { basis: "financial", reason: "missing cost data" })).toThrow(/missing data/);
    expect(() => recordRejected(l, "c1", { basis: "financial", reason: "no data available" })).toThrow();
    expect(() => recordRejected(l, "c1", { basis: "financial", reason: "" })).toThrow();
    expect(() => recordRejected(l, "c1", { basis: "unknown" as any, reason: "too costly" })).toThrow(/basis/);
    expect(() => recordNeedsInfo(l, "c1", [])).toThrow();
    expect(() => recordNotEvaluated(l, "c1", " ")).toThrow();
    recordNeedsInfo(l, "c1", ["cost"]); // the legitimate route
  });
  it("confidence reflects stale and missing data; summarizeLedgers totals", () => {
    const l = createLedger(parcel("p"), "2000-01-01", cats);
    for (const c of ["c1", "c2", "c3", "c4"]) recordFound(l, c);
    expect(finalizeLedger(l).confidence).toBe("high");
    const l2 = createLedger(parcel("q"), "2000-01-01", cats);
    for (const c of ["c1", "c2", "c3", "c4"]) recordFound(l2, c);
    recordStaleData(l2, "zoning", "older than as-of");
    recordMissingData(l2, "permits");
    const f2 = finalizeLedger(l2);
    expect(f2.confidence).toBe("medium");
    const s = summarizeLedgers([finalizeLedger(full()), f2]);
    expect(s.locations).toBe(2);
    expect(s.totals).toEqual({ found: 5, rejected: 1, needsInfo: 1, notEvaluated: 3 });
    expect(s.byCategory.c1).toEqual({ found: 2, rejected: 0, needsInfo: 0, notEvaluated: 0 });
    expect(() => summarizeLedgers([{} as any])).toThrow();
  });
  it("benchmark: 10,000 locations x 30 categories within 2 s", () => {
    const catalogue = IMPROVEMENT_CATEGORIES.slice(0, 30);
    const ref = parcel("bench");
    const t0 = performance.now();
    const ledgers = [];
    for (let i = 0; i < 10000; i++) {
      const l = createLedger(ref, "2000-01-01", catalogue);
      for (const c of catalogue) {
        if (!c.appliesTo.includes("parcel")) continue;
        const k = (i + c.id.length) % 4;
        if (k === 0) recordFound(l, c.id);
        else if (k === 1) recordRejected(l, c.id, { basis: "physical", reason: "fixture site too small" });
        else if (k === 2) recordNeedsInfo(l, c.id, ["fixture input"]);
        else recordNotEvaluated(l, c.id, "fixture skip");
      }
      ledgers.push(finalizeLedger(l));
    }
    const s = summarizeLedgers(ledgers);
    const elapsed = performance.now() - t0;
    expect(s.locations).toBe(10000);
    const t = s.totals;
    expect(t.found + t.rejected + t.needsInfo + t.notEvaluated).toBe(10000 * 30);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("metrics", () => {
  it("known answers", () => {
    const c = confusionCounts(["a", "b", "c", "d"], ["a", "b", "e"]);
    expect(c).toEqual({ tp: 2, fp: 2, fn: 1 });
    expect(recall(c)).toBeCloseTo(2 / 3, 12);
    expect(precision(c)).toBe(0.5);
    expect(f1(c)).toBeCloseTo(4 / 7, 12);
  });
  it("duplicates collapse; perfect and zero-overlap cases", () => {
    expect(confusionCounts(["a", "a"], ["a"])).toEqual({ tp: 1, fp: 0, fn: 0 });
    expect(f1({ tp: 3, fp: 0, fn: 0 })).toBe(1);
    expect(recall({ tp: 0, fp: 2, fn: 3 })).toBe(0);
    expect(precision({ tp: 0, fp: 2, fn: 3 })).toBe(0);
  });
  it("undefined (null), not 0, when the denominator is 0", () => {
    expect(recall({ tp: 0, fp: 4, fn: 0 })).toBeNull();
    expect(precision({ tp: 0, fp: 0, fn: 4 })).toBeNull();
    expect(f1({ tp: 0, fp: 0, fn: 0 })).toBeNull();
  });
});

describe("backtest", () => {
  const inputs = [{ id: "i1", date: "1999-06-01" }, { id: "i2", date: "2000-01-01" }];
  const truth = [
    { id: "t1", category: "c1", outcome: "built" },
    { id: "t2", category: "c1", outcome: "alternative" },
    { id: "t3", category: "c2", outcome: "failed" },
    { id: "t4", category: "c2", outcome: "built" },
  ];
  const run = (over: any = {}) => runBacktest({ cutoff: "2000-01-01", inputs, truth, discover: () => [], ...over });
  it("throws LeakageError for a record dated after the cut-off or undated", () => {
    expect(() => run({ inputs: [...inputs, { id: "x", date: "2000-01-02" }] })).toThrow(LeakageError);
    expect(() => run({ inputs: [...inputs, { id: "y" }] })).toThrow(LeakageError);
    expect(() => run({ inputs: [{ id: "z", date: "not a date" }] })).toThrow(LeakageError);
    expect(() => run()).not.toThrow();
  });
  it("throws SurvivorshipError unless truth has failed/cancelled AND an alternative", () => {
    const onlyBuilt = truth.filter((t) => t.outcome === "built");
    expect(() => run({ truth: onlyBuilt })).toThrow(SurvivorshipError);
    expect(() => run({ truth: truth.filter((t) => t.outcome !== "failed") })).toThrow(SurvivorshipError);
    expect(() => run({ truth: truth.filter((t) => t.outcome !== "alternative") })).toThrow(SurvivorshipError);
    expect(() => run({ truth: [...truth.filter((t) => t.outcome !== "failed"), { id: "t5", category: "c2", outcome: "cancelled" }] })).not.toThrow();
  });
  it("scores per category and overall; matches to failed projects are false positives", () => {
    const seen: any[] = [];
    const r = run({
      discover: (inp: any) => { seen.push(inp); return [
        { id: "t1", category: "c1" }, { id: "t3", category: "c2" }, { id: "t4", category: "c2" }, { id: "nope", category: "c1" },
      ]; },
    });
    expect(seen[0]).toHaveLength(2);
    // "nope" matches nothing in the truth set: the truth set is never complete, so it is unjudged, not a false positive
    expect(r.overall).toMatchObject({ tp: 2, fp: 1, fn: 1 });
    expect(r.overall.recall).toBeCloseTo(2 / 3, 12);
    expect(r.overall.precision).toBeCloseTo(2 / 3, 12); // judged predictions only: 2 right, 1 matched a failed project
    expect(r.precisionStrict).toBe(0.5); // lower bound: 2 right of 4 predictions
    expect(r.recallBuilt).toBe(1); // both built projects found; the missed one was the alternative
    expect(r.byCategory.c1).toMatchObject({ tp: 1, fp: 0, fn: 1 });
    expect(r.byCategory.c2).toMatchObject({ tp: 1, fp: 1, fn: 0 });
    expect(r.counts).toMatchObject({ inputs: 2, truth: 4, predictions: 4, positives: 3, negatives: 1, falsePositivesOnFailed: 1, duplicates: 0, unjudged: 1 });
  });
  it("a duplicate prediction of one positive counts once; custom match; no predictions gives null precision", () => {
    const r = run({ discover: () => [{ id: "t1", category: "c1" }, { id: "t1", category: "c1" }] });
    expect(r.overall).toMatchObject({ tp: 1, fp: 1 });
    const m = run({ discover: () => [{ id: "z", category: "c1" }], match: (p: any, t: any) => t.id === "t2" && p.id === "z" });
    expect(m.byCategory.c1.tp).toBe(1);
    expect(run().overall.precision).toBeNull();
    expect(run().overall.recall).toBe(0);
  });
  it("reconstructYear keeps only dated records on or before the cut-off", () => {
    const recs = [{ id: "a", date: "1999-12-31" }, { id: "b", date: "2000-12-31" }, { id: "c", date: "2001-01-01" }, { id: "d" }];
    expect(reconstructYear(recs, 2000).map((r) => r.id)).toEqual(["a", "b"]);
    expect(reconstructYear(recs, "1999-12-31").map((r) => r.id)).toEqual(["a"]);
    expect(() => reconstructYear(recs, "bad")).toThrow();
  });
});
