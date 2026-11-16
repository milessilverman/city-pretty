// The LA home-value model: the page must compute exactly what was tested, and the test must have no leakage.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
// @ts-ignore plain ES modules
import { leakageCount, neighborhoodStats, regressionPredictor } from "../../scripts/lib/laValuationModels.mjs";
// @ts-ignore
import { loadLA } from "../../scripts/lib/laParcels.mjs";
// @ts-ignore
import { rowsFrom, TEST } from "../../scripts/la_valuation_models.mjs";

const root = path.resolve(__dirname, "../..");
const NV = JSON.parse(fs.readFileSync(path.join(root, "app/data/la_neighborhood_values.json"), "utf8"));

// Pull named top-level functions out of app/app.js verbatim and run them in a sandbox.
function appFunctions(names: string[]) {
  const js = fs.readFileSync(path.join(root, "app/app.js"), "utf8");
  const src = names.map((n) => {
    const at = js.indexOf(`function ${n}(`);
    if (at < 0) throw new Error(`${n} not found in app/app.js`);
    let i = js.indexOf("{", at), depth = 0;
    for (; i < js.length; i++) { if (js[i] === "{") depth++; else if (js[i] === "}" && --depth === 0) break; }
    return js.slice(at, i + 1);
  }).join("\n");
  const ctx: any = { LA_NEIGHBORHOOD_VALUES: NV };
  vm.createContext(ctx);
  vm.runInContext(`var LA_NEIGHBORHOOD_VALUES = this.LA_NEIGHBORHOOD_VALUES;\n${src}\n${names.map((n) => `this.${n} = ${n};`).join("\n")}`, ctx);
  return ctx;
}

// The same statistics the page uses, in the library's shape.
function statsFromFile() {
  const toMap = (o: Record<string, number[]>) => new Map(Object.entries(o).map(([k, v]) => [k, { n: v[0], median: v[1], ppsf: v[2], y0: v[3], y1: v[4], ains: new Set() }]));
  return { bg: toMap(NV.bg), tract: toMap(NV.tract) };
}

describe("LA home-value model", () => {
  const page = appFunctions(["laNeighborhoodValue", "laParseQuality", "laModelEstimate"]);
  const LA = loadLA(root);
  const sample = rowsFrom(LA, TEST, [2025, 2026], () => 2024).rows.filter((_: any, i: number) => i % 97 === 0); // ~520 real records
  const raw = new Map<string, any>();
  for (const r of JSON.parse(require("zlib").gunzipSync(fs.readFileSync(TEST)).toString()).records) raw.set(r.AIN, r);

  it("the page's estimate equals the tested library model on real Assessor records", () => {
    const lib = regressionPredictor(statsFromFile(), { coef: NV.model.coef });
    let compared = 0;
    for (const r of sample) {
      const a = raw.get(r.ain);
      const want = lib(r);
      const got = page.laModelEstimate(a, null, r.bg);
      if (want == null) { expect(got.value).toBeNull(); continue; }
      expect(Math.abs(got.value - want)).toBeLessThanOrEqual(500); // the page rounds to the nearest $1,000
      compared++;
    }
    expect(compared).toBeGreaterThan(400);
  });

  it("missing inputs withhold the estimate with a reason instead of guessing", () => {
    const r = sample[0];
    const a = { ...raw.get(r.ain), SQFTmain1: null };
    const e = page.laModelEstimate(a, null, r.bg);
    expect(e.value).toBeNull();
    expect(e.reason).toMatch(/living area/);
    expect(page.laModelEstimate(raw.get(r.ain), null, "000000000000").value).toBeNull();
  });

  it("leakage check catches a test home inside its own statistics", () => {
    const rows = [{ ain: "1", bg: "060370000001", tract: "06037000000", year: 2024, value: 500000, sqft: 1000 }];
    expect(leakageCount(neighborhoodStats(rows), rows)).toBe(1);
    expect(leakageCount(neighborhoodStats(rows), [{ ...rows[0], ain: "2" }])).toBe(0);
  });

  it("shipped coefficients and test result agree, and the gate rule holds", () => {
    const t = NV.model.tested;
    expect(t.overall.mdape).toBeLessThanOrEqual(0.15);
    expect(t.overall.mdape).toBeLessThan(t.baseline_neighborhood_median.mdape);
    expect(t.gate.pass).toBe(true);
    expect(NV.model.features.length).toBe(NV.model.coef.length);
  });
});
