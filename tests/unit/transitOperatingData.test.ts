import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(__dirname, "../..");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const head = rows[0];
  return rows.slice(1).filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const csv = (p: string) => parseCsv(fs.readFileSync(path.join(root, p), "utf-8"));
const num = (x: string) => (x === "" ? null : Number(x));
// inclusive quartile (linear interpolation between order statistics), written independently of the Python builder
function quant(sorted: number[], p: number) { const h = (sorted.length - 1) * p, lo = Math.floor(h); return sorted[lo] + (h - lo) * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]); }

const annual = csv("data/transit/ntd_agency_mode_annual.csv");
const bench = JSON.parse(fs.readFileSync(path.join(root, "app/data/transit_operating_benchmarks.json"), "utf-8"));

describe("NTD annual agency-mode table", () => {
  it("covers report years 2020 to 2025 and every row names its dataset, URL and year", () => {
    const years = [...new Set(annual.map(r => r.report_year))].sort();
    expect(years).toEqual(["2020", "2021", "2022", "2023", "2024", "2025"]);
    expect(annual.length).toBeGreaterThan(20000);
    for (const r of annual) {
      expect(r.source_dataset).toBe("npsm-38gk");
      expect(r.source_url).toBe("https://data.transportation.gov/d/npsm-38gk");
      expect(r.report_year).toMatch(/^20\d\d$/);
    }
  });

  it("BART heavy rail 2025 matches the raw values seen in the source and its derived ratios recompute by hand", () => {
    const r = annual.find(x => x.ntd_id === "90003" && x.mode === "HR" && x.tos === "DO" && x.report_year === "2025")!;
    expect(num(r.opex)).toBe(885628745);
    expect(num(r.vrh)).toBe(2166352);
    expect(num(r.fares)).toBe(236627027);
    expect(num(r.upt)).toBe(56592868);
    expect(num(r.pmt)).toBe(793272603);
    // the same figures as NTD's own Metrics table (ekg5-frzt): cost_per_hour 408.8111, fare per trip 4.1812, cost per passenger mile 1.1164
    expect(885628745 / 2166352).toBeCloseTo(408.8111, 3);
    expect(num(r.opex_per_vrh)).toBeCloseTo(885628745 / 2166352, 4);
    expect(num(r.fare_per_upt)).toBeCloseTo(236627027 / 56592868, 4);
    expect(num(r.fare_per_upt)).toBeCloseTo(4.1812, 3);
    expect(num(r.farebox_recovery)).toBeCloseTo(236627027 / 885628745, 4);
    expect(num(r.avg_trip_miles)).toBeCloseTo(793272603 / 56592868, 4);
    expect(num(r.opex_per_upt)).toBeCloseTo(885628745 / 56592868, 4);
    expect(num(r.vrh_per_route_mile)).toBeCloseTo(2166352 / 233.8, 3);
  });

  it("MTA New York City Transit subway 2021 matches NTD's 2021 Metrics table (cost per hour 274.30, fare per trip 1.35)", () => {
    const r = annual.find(x => x.ntd_id === "20008" && x.mode === "HR" && x.tos === "DO" && x.report_year === "2021")!;
    expect(num(r.opex)).toBe(5027256304);
    expect(num(r.vrh)).toBe(18327790);
    expect(Math.round((5027256304 / 18327790) * 100) / 100).toBe(274.3);
    expect(Math.round((1773543424 / 1311224575) * 100) / 100).toBe(1.35);
    expect(num(r.fares)).toBe(1773543424);
  });

  it("a derived value is blank when its denominator is missing or not above zero", () => {
    for (const r of annual) {
      const vrh = num(r.vrh), opex = num(r.opex);
      if (vrh == null || vrh <= 0 || opex == null) expect(r.opex_per_vrh).toBe("");
    }
  });
});

describe("transit_operating_benchmarks.json", () => {
  it("states years, formulas and the row rules", () => {
    expect(bench.meta.report_years).toEqual(["2020", "2021", "2022", "2023", "2024", "2025"]);
    expect(bench.meta.latest_report_year).toBe("2025");
    expect(bench.meta.metric_definitions.opex_per_vrh.formula).toMatch(/operating expenses/);
    expect(bench.meta.source_dataset.dataset_id).toBe("npsm-38gk");
    expect(bench.meta.source_dataset.licence).toBe("Public Domain U.S. Government");
  });

  it("light rail 2025 median cost per vehicle revenue hour equals a median recomputed from the agency rows", () => {
    const vals = annual.filter(r => r.mode === "LR" && r.report_year === "2025" && r.mode_status === "Operating" && num(r.opex)! > 0 && num(r.vrh)! > 0)
      .map(r => num(r.opex)! / num(r.vrh)!).sort((a, b) => a - b);
    const blk = bench.by_mode.LR.years["2025"].cuts.all.opex_per_vrh;
    expect(blk.n).toBe(vals.length);
    expect(blk.median).toBeCloseTo(quant(vals, 0.5), 3);
    expect(blk.p25).toBeCloseTo(quant(vals, 0.25), 3);
    expect(blk.p75).toBeCloseTo(quant(vals, 0.75), 3);
    expect(blk.pooled).toBeCloseTo(vals.length ? annual.filter(r => r.mode === "LR" && r.report_year === "2025" && r.mode_status === "Operating" && num(r.opex)! > 0 && num(r.vrh)! > 0).reduce((s, r) => s + num(r.opex)!, 0) / annual.filter(r => r.mode === "LR" && r.report_year === "2025" && r.mode_status === "Operating" && num(r.opex)! > 0 && num(r.vrh)! > 0).reduce((s, r) => s + num(r.vrh)!, 0) : 0, 3);
  });

  it("heavy rail 2025 farebox recovery: n and median recompute from the rows", () => {
    const vals = annual.filter(r => r.mode === "HR" && r.report_year === "2025" && r.mode_status === "Operating" && num(r.fares)! > 0 && num(r.opex)! > 0)
      .map(r => num(r.fares)! / num(r.opex)!).sort((a, b) => a - b);
    const blk = bench.by_mode.HR.years["2025"].cuts.all.farebox_recovery;
    expect(blk.n).toBe(vals.length);
    expect(blk.median).toBeCloseTo(quant(vals, 0.5), 4);
  });

  it("every agency row carried in the file has a source URL and the latest report year", () => {
    expect(bench.agency_rows_rail_brt_latest_year.length).toBeGreaterThan(80);
    for (const r of bench.agency_rows_rail_brt_latest_year) {
      expect(r.source_url).toMatch(/^https:\/\/data\.transportation\.gov\//);
      expect(r.report_year).toBe("2025");
    }
  });

  it("documents the loader arguments without the engine reading them", () => {
    expect(bench.meta.evaluate_transit_loader_arguments.shape.operatingBenchmarks).toBeTruthy();
    expect(bench.meta.evaluate_transit_loader_arguments.how_to_derive).toMatch(/null/);
  });
});

describe("NTD monthly ridership table", () => {
  it("matches raw rows seen in the source", () => {
    const series = csv("data/transit/ntd_monthly_series.csv");
    const monthly = parseCsv(zlib.gunzipSync(fs.readFileSync(path.join(root, "data/transit/ntd_monthly_ridership.csv.gz"))).toString("utf-8"));
    const nyct = series.find(s => s.ntd_id === "20008" && s.mode === "HR" && s.status === "Active")!;
    const jan19 = monthly.find(m => m.series_id === nyct.series_id && m.month === "2019-01")!;
    expect(Number(jan19.upt)).toBe(200106107);
    expect(Number(jan19.vrh)).toBe(1663211);
    expect(monthly.find(m => m.series_id === nyct.series_id && m.month === "2025-09")!.upt).toBe("202495480");
    expect(monthly.map(m => m.month).sort()[0]).toBe("2019-01");
    for (const s of series) expect(s.source_url).toBe("https://data.transportation.gov/d/8bui-9xvu");
  });
});

describe("station boardings validation table", () => {
  const st = csv("data/transit/station_boardings.csv");
  it("has the systems and counts the audit file reports, each row sourced and located", () => {
    const by: Record<string, number> = {};
    for (const r of st) by[r.system] = (by[r.system] || 0) + 1;
    expect(Object.keys(by).length).toBe(7);
    expect(by["MTA New York City Transit"]).toBeGreaterThan(400);
    expect(by["Chicago Transit Authority"]).toBe(144);
    expect(by["San Francisco Bay Area Rapid Transit District"]).toBe(50);
    expect(st.length).toBeGreaterThan(900);
    for (const r of st) {
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(num(r.avg_boardings_per_day)).not.toBeNull();
      expect(["weekday", "all days"]).toContain(r.day_basis);
      if (r.lat !== "") { expect(Math.abs(Number(r.lat))).toBeLessThan(90); expect(Number(r.lon)).toBeLessThan(0); }
    }
  });
  it("BART entries sum to a plausible system weekday total and name Embarcadero as busiest", () => {
    const b = st.filter(r => r.agency_ntd_id === "90003");
    const tot = b.reduce((s, r) => s + Number(r.avg_boardings_per_day), 0);
    expect(tot).toBeGreaterThan(150000); expect(tot).toBeLessThan(260000);
    expect(b.sort((x, y) => Number(y.avg_boardings_per_day) - Number(x.avg_boardings_per_day))[0].station_name).toBe("Embarcadero");
  });
});

describe("Amtrak route ridership FY25", () => {
  it("route rows add up to the sheet's published total", () => {
    const a = csv("data/transit/amtrak_route_ridership_fy25.csv");
    expect(a.length).toBe(50);
    expect(a.reduce((s, r) => s + (num(r.fy25_ridership) || 0), 0)).toBe(34467598);
    expect(num(a.find(r => r.route === "Acela")!.fy25_ridership)).toBe(3153621);
    for (const r of a) expect(r.source_url).toBe("https://media.amtrak.com/wp-content/uploads/2025/11/FY25-Year-End-Ridership-Fact-Sheet.pdf");
  });
});
