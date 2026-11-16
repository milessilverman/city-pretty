import { describe, expect, it } from "vitest";
import { errorMetrics, groupedMetrics, passesGate, priceBand } from "../../scripts/lib/backtestMetrics.mjs";

describe("back-test error metrics", () => {
  it("computes median and mean absolute error, signed bias and hit shares", () => {
    const m = errorMetrics([
      { est: 90, target: 100 },  // -10%
      { est: 120, target: 100 }, // +20%
      { est: 100, target: 100 }, // 0%
      { est: 105, target: 100 }, // +5%
    ]);
    expect(m.n).toBe(4);
    expect(m.mdape).toBeCloseTo(0.075, 6);
    expect(m.mape).toBeCloseTo(0.0875, 6);
    expect(m.median_signed_error).toBeCloseTo(0.025, 6);
    expect(m.share_within_10pct).toBe(0.75);
    expect(m.share_within_20pct).toBe(1);
  });

  it("excludes missing estimates instead of counting them as zero", () => {
    const m = errorMetrics([{ est: null as any, target: 100 }, { est: 0, target: 100 }, { est: 110, target: 100 }]);
    expect(m.n).toBe(1);
    expect(m.excluded).toBe(2);
    expect(m.mdape).toBeCloseTo(0.1, 6);
  });

  it("groups and drops small groups", () => {
    const rows = [...Array(40)].map((_, i) => ({ k: i < 35 ? "a" : "b", est: 100, target: 100 }));
    const g = groupedMetrics(rows, (r: any) => r.k, (r: any) => r, 30);
    expect(Object.keys(g.groups)).toEqual(["a"]);
    expect(g.rows_in_small_groups).toBe(5);
  });

  it("price bands", () => {
    expect(priceBand(499999)).toBe("under $500k");
    expect(priceBand(1500000)).toBe("$1M-$2M");
    expect(priceBand(0)).toBeNull();
  });

  it("gate: must have 200+ tests, stay under the cap, and beat the baseline", () => {
    const base = { mdape: 0.15 } as any;
    expect(passesGate({ n: 100, mdape: 0.05 } as any, base).pass).toBe(false);
    expect(passesGate({ n: 1000, mdape: 0.188 } as any, base).pass).toBe(false);
    expect(passesGate({ n: 1000, mdape: 0.14 } as any, { mdape: 0.12 } as any).pass).toBe(false);
    expect(passesGate({ n: 1000, mdape: 0.1 } as any, base).pass).toBe(true);
  });
});
