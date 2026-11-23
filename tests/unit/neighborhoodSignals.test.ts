// Neighbourhood signals (facts, no forecast) and the hold-out prediction verdict: src/engines/neighborhoodSignals.js,
// app/data/neighborhood_signals/<state>.json, app/data/neighborhood_prediction_holdout.json (docs/audit/prediction-2026-11-23.md).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const root = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const NS = require("../../src/engines/neighborhoodSignals.js");
const load = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));

function gzCsvRows(p: string, keep: (cols: string[]) => boolean): string[][] {
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(root, p))).toString("utf-8");
  const out: string[][] = [];
  for (const line of txt.split("\n").slice(1)) { if (!line) continue; const c = line.split(","); if (keep(c)) out.push(c); }
  return out;
}

describe("signal file arithmetic matches the source tables", () => {
  const tx = load("app/data/neighborhood_signals/48.json");
  const tract = "48453000101"; // a Travis County tract with FHFA 2020, 2024, 2025 values
  it("price change 2020-2025 and 2024-2025 from the FHFA tract rows", () => {
    const rows = gzCsvRows("data/signals/fhfa_tract_annual.csv.gz", c => c[0] === tract);
    const hpi: Record<string, number> = {};
    for (const c of rows) if (c[3] !== "") hpi[c[1]] = Number(c[3]);
    const row = tx.tracts[tract];
    expect(row).toBeTruthy();
    expect(row[0]).toBeCloseTo(Math.round(1000 * (hpi["2025"] / hpi["2020"] - 1)) / 10, 5);
    expect(row[1]).toBeCloseTo(Math.round(1000 * (hpi["2025"] / hpi["2024"] - 1)) / 10, 5);
  });
  it("jobs from the LODES tract rows", () => {
    const rows = gzCsvRows("data/signals/lodes_wac_tract_48_72.csv.gz", c => c[0] === tract);
    const j: Record<string, number> = {};
    for (const c of rows) j[c[1]] = Number(c[2]);
    expect(tx.tracts[tract][2]).toBe(j["2024"]);
  });
  it("county permits from the BPS county rows", () => {
    const rows = gzCsvRows("data/signals/bps_county_annual.csv.gz", c => c[1] === "48" && c[2] === "453" && Number(c[0]) >= 2021);
    const byYear: Record<string, number> = {};
    for (const c of rows) byYear[c[0]] = [3, 4, 5, 6].reduce((s, i) => s + Number(c[i] || 0), 0);
    expect(tx.counties["48453"]).toEqual([2021, 2022, 2023, 2024, 2025].map(y => byYear[String(y)]));
  });
  it("every state file carries its sources with URLs and quotes", () => {
    const dir = path.join(root, "app/data/neighborhood_signals");
    const files = fs.readdirSync(dir);
    expect(files.length).toBeGreaterThanOrEqual(50);
    let total = 0;
    for (const f of files) {
      total += fs.statSync(path.join(dir, f)).size;
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      expect(d._source.sources.length).toBe(3);
      for (const s of d._source.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.quote.length).toBeGreaterThan(20); }
    }
    expect(total).toBeLessThan(5_000_000);
  });
  it("states with LODES years that were never published say so (Michigan 2022 and 2024)", () => {
    const mi = load("app/data/neighborhood_signals/26.json");
    expect(mi.lodes_not_published).toEqual([2022, 2024]);
    expect(Object.values(mi.tracts).every((r: any) => r[2] === null && r[3] === null)).toBe(true);
    expect(load("app/data/neighborhood_signals/48.json").lodes_not_published).toEqual([]);
  });
});

describe("signalsForArea", () => {
  const doc = {
    _source: { columns: { counties: ["housing units authorised 2021", "housing units authorised 2022", "housing units authorised 2023", "housing units authorised 2024", "housing units authorised 2025"] },
      sources: [{ name: "FHFA House Price Index" }, { name: "LEHD ... (LODES8)" }, { name: "Census Building Permits Survey" }] },
    tracts: { "01001020100": [12.5, 3.1, 755, -4.2], "26163000100": [5, 1, null, null], "01001020200": [null, null, 30, null] },
    counties: { "01001": [100, 120, 90, 80, 150] },
  };
  it("reads a block group's tract and the county permits", () => {
    const s = NS.signalsForArea(doc, "010010201001", "01001");
    expect(s.ok).toBe(true);
    expect(s.forecast).toBe(false);
    expect(s.price5y.value).toBe(12.5);
    expect(s.jobs2y.value).toBe(-4.2);
    expect(s.permits.series.map((x: any) => x.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(s.permits.change.value).toBe(50);
  });
  it("gives a reason, never a number, when a value is missing", () => {
    const a = NS.signalsForArea(Object.assign({}, doc, { lodes_not_published: [2022, 2024] }), "261630001001", "26163");
    expect(a.jobs2024.value).toBeNull();
    expect(a.jobs2024.why).toMatch(/not published a LODES file for this state for 2024/);
    expect(a.jobs2y.why).toMatch(/2022 and 2024/);
    expect(a.permits.change.value).toBeNull();
    const b = NS.signalsForArea(doc, "010010202001", "01001");
    expect(b.price5y.value).toBeNull();
    expect(b.price5y.why).toMatch(/no 2020 or 2025/);
    expect(b.jobs2y.why).toMatch(/fewer than 50/);
    const c = NS.signalsForArea(doc, "019990000001", "01999");
    expect(c.price5y.why).toMatch(/not in FHFA/);
    expect(NS.signalsForArea(null, "010010201001").ok).toBe(false);
    expect(NS.signalsForArea(doc, "abc").ok).toBe(false);
  });
});

describe("predictionVerdict and the shipped test summary", () => {
  it("shows no prediction unless the summary says the pre-written rule was passed", () => {
    expect(NS.predictionVerdict(null).shown).toBe(false);
    expect(NS.predictionVerdict({ decision: { pass: false, failed_conditions: ["x"] }, results: {} }).shown).toBe(false);
    expect(NS.predictionVerdict({ decision: { pass: true }, results: {} }).shown).toBe(true);
  });
  it("the shipped summary agrees with the stored back-test output", () => {
    const s = load("app/data/neighborhood_prediction_holdout.json");
    const full = load(s.backtest_file);
    expect(s.decision.pass).toBe(full.decision.pass);
    const v = NS.predictionVerdict(s);
    expect(v.shown).toBe(full.decision.pass);
    for (const h of ["3", "5"]) {
      for (const m of s.results[h].methods) {
        const f = full.results[h].holdout.methods[m.key];
        expect(m.top_decile).toBeCloseTo(f.top_decile, 6);
        expect(m.top_decile_ci95[0]).toBeCloseTo(f.top_decile_ci95[0], 6);
        expect(m.spearman).toBeCloseTo(f.spearman, 6);
      }
    }
  });
});
