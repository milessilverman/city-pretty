// Provenance rules for every sourced data file in app/data.
//
// 1. Every record carries verification.status, one of STATUSES.
// 2. A record may say "verified" only with a method and evidence (what was fetched and what it showed).
// 3. Hand-typed datasets that were found fabricated must not come back.
// See docs/DATA-AUDIT-AND-TRANSPARENCY.md and docs/audit/ for the evidence behind each file.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(__dirname, "../..");
const load = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const STATUSES = ["verified", "partially_verified", "could_not_check", "unverified"];

// Files whose records each describe a sourced real-world fact.
const RECORD_FILES: Record<string, (d: any) => any[]> = {
  "app/data/research.json": (d) => d,
  "app/data/case_studies.json": (d) => d,
  "app/data/unit_costs.json": (d) => d,
  "app/data/transit_pipelines.json": (d) => d,
  "app/data/intercity_transit_corridors.json": (d) => d,
  "app/data/underused_sites.json": (d) => d,
  "app/data/statutes.json": (d) => d,
  "app/data/funding_programs.json": (d) => d,
  "app/data/state_finance_profiles.json": (d) => Object.values(d).filter((v) => v && typeof v === "object"),
  "app/data/hud_fair_market_rents.json": (d) => d.records,
  "app/data/county_completeness.json": (d) => Object.values(d),
  "app/data/ca_counties_registry.json": (d) => Object.values(d),
};

describe("provenance: every record says how it was checked", () => {
  for (const [file, recordsOf] of Object.entries(RECORD_FILES)) {
    it(`${file}: every record has a valid verification status`, () => {
      const recs = recordsOf(load(file));
      expect(Array.isArray(recs) && recs.length > 0).toBe(true);
      const bad = recs.filter((r: any) => !r?.verification || !STATUSES.includes(r.verification.status));
      expect(bad.map((r: any) => r?.id ?? r?.fips ?? r?.state ?? "?")).toEqual([]);
    });

    it(`${file}: "verified" records state their method and evidence`, () => {
      const data = load(file);
      const fileMethod = data?._source?.verification_method; // machine pulls state the method once per file
      const recs = recordsOf(data);
      const bad = recs.filter((r: any) => {
        const v = r.verification;
        if (v.status !== "verified") return false;
        const method = v.method || fileMethod;
        const evidence = v.evidence || (fileMethod && (r.fmr_area_code || r.fips)); // HUD: evidence is HUD's own area code
        return !method || !evidence || String(method).length < 10;
      });
      expect(bad.map((r: any) => r?.id ?? r?.fips ?? "?")).toEqual([]);
    });
  }

  it("statutes.json and state-housing-laws.json stay identical (the app reads both names)", () => {
    expect(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf8")).toBe(fs.readFileSync(path.join(root, "app/data/state-housing-laws.json"), "utf8"));
  });
});

describe("HUD Fair Market Rents come from HUD's service, by script", () => {
  const d = load("app/data/hud_fair_market_rents.json");

  it("is the scripted pull, with its source and coverage caveat recorded", () => {
    expect(d._source.script).toBe("scripts/fetch_hud_fmr.py");
    expect(d._source.service).toContain("services.arcgis.com/VTyQ9soqVukalItT");
    expect(d._source.coverage_caveat).toMatch(/FY2024/);
  });

  it("covers every county once", () => {
    const fips = d.records.map((r: any) => r.fips);
    expect(fips.length).toBeGreaterThanOrEqual(3200);
    expect(new Set(fips).size).toBe(fips.length);
    expect(fips.every((f: string) => /^\d{5}$/.test(f))).toBe(true);
  });

  it("spot checks against HUD values observed on 2026-11-16", () => {
    const by = Object.fromEntries(d.records.map((r: any) => [r.fips, r]));
    // Values read from HUD's service while writing this test (also in tests/fixtures/sources/hud_fmr_austin.json).
    expect(by["48453"].metro_or_county_name).toBe("Austin-Round Rock-San Marcos, TX MSA");
    expect(by["48453"].two_bed_2br).toBe(1852);
    expect(by["06037"].two_bed_2br).toBe(2601);
    expect(by["04013"].metro_or_county_name).toBe("Phoenix-Mesa-Chandler, AZ MSA");
  });
});

describe("county readiness is computed from evidence", () => {
  const d = load("app/data/county_completeness.json");
  it("tiers come only from the computed set and no county claims an assessor roll it doesn't have", () => {
    for (const r of Object.values(d) as any[]) {
      expect(["A", "B", "C", "D", "none"]).toContain(r.readiness_tier);
      expect(r.assessor_roll_vintage).toBeNull();
      expect(r.source).toMatch(/build_county_completeness\.py/);
    }
  });
  it("Travis County is not rated top tier (its data file says no assessor parcels or sales are loaded)", () => {
    expect(d["48453"].readiness_tier).not.toBe("A");
    expect(d["48453"].parcel_source).not.toBe("live_service_with_values");
  });
});

describe("crash counts are rebuilt per county with a stated boundary rule", () => {
  const dir = path.join(root, "app/data/crash_counts");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{5}\.json$/.test(f)) : [];
  it("every California county has a file, LA included, except San Francisco", () => {
    // San Francisco: only 34% of its CCRS crashes have coordinates; its data file uses DataSF's injury-crash records
    // instead, which this rebuild does not cover yet (docs/DATA-AUDIT-AND-TRANSPARENCY.md).
    expect(files).toContain("06037.json");
    expect(files).not.toContain("06075.json");
    expect(files.filter((f) => f.startsWith("06")).length).toBe(57);
  });
  it("each file records its source, rule, script and coordinate coverage; subsets never exceed the total", () => {
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const fips = f.slice(0, 5);
      expect(d._meta.rule).toMatch(/within 10 m of its boundary/);
      expect(d._meta.script).toMatch(/^scripts\/build_(crash_counts_ca|state_crash_counts)\.py$/);
      expect(d._meta.with_coordinates).toBeLessThanOrEqual(d._meta.crashes);
      for (const [g, v] of Object.entries(d)) {
        if (g === "_meta") continue;
        expect(g.startsWith(fips)).toBe(true);
        const [ped, ksi, all] = v as number[];
        expect(ped).toBeLessThanOrEqual(all);
        expect(ksi).toBeLessThanOrEqual(all);
      }
    }
  });
  it("the old LA-only file is gone (one source of crash counts)", () => {
    expect(fs.existsSync(path.join(root, "app/data/la-crash-counts.json"))).toBe(false);
  });
});

describe("fabricated content that was removed stays removed", () => {
  it("valuation back-tests: only counties with a reproducible run are listed; everything else is 'no_backtest_run'", () => {
    const d = load("app/data/valuation_backtest_benchmarks.json");
    expect(d._status).toBe("no_backtest_run"); // default for every county not listed
    expect(Object.keys(d.counties)).toContain("06037");
    // Every other listed county is a recorded-sales back-test with a committed sales file and result file, and its
    // publish decision follows the same rule (tests/unit/countyValuation.test.ts re-runs each one).
    for (const [fips, c] of Object.entries(d.counties) as [string, any][]) {
      if (fips === "06037") continue;
      expect(c._status).toBe("backtest_run");
      expect(c.model_name).toMatch(/^county_sales_/);
      for (const f of [c.sample_file, c.result_file]) expect(fs.existsSync(path.join(root, f))).toBe(true);
      expect(c.leakage.test_homes_in_their_own_statistics).toBe(0);
      const ok = c.model.n >= 200 && c.model.mdape <= 0.15 && c.model.mdape < c.baseline_neighborhood_median.mdape;
      expect(c.gate.pass).toBe(ok);
    }
    expect(fs.existsSync(path.join(root, "scripts/run_valuation_backtests.mjs"))).toBe(false); // the fake-sales script

    const la = d.counties["06037"];
    expect(la._status).toBe("backtest_run");
    expect(la.model_name).toBe("la_assessor_resets_regression");
    for (const f of [la.sample_file, la.training_file, la.result_file]) expect(fs.existsSync(path.join(root, f))).toBe(true);
    // The one final test: no test home in the training data or in its own neighborhood statistics.
    const result = JSON.parse(fs.readFileSync(path.join(root, la.result_file), "utf8"));
    expect(result.mode).toBe("final");
    expect(result.test_ains_also_in_training).toBe(0);
    expect(result.leakage_test_homes_in_their_own_statistics).toBe(0);
    expect(la.model).toEqual(result.candidates.find((c: any) => c.label === "regression").overall);
    // The sample behind the numbers is the public layer's.
    const sample = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, la.sample_file))).toString("utf8"));
    expect(sample.source).toContain("public.gis.lacounty.gov");
    // The publish/withhold decision follows the stated rule.
    const shouldPass = la.model.n >= 200 && la.model.mdape <= la.gate.mdape_cap && la.model.mdape < la.baseline_neighborhood_median.mdape;
    expect(la.gate.pass).toBe(shouldPass);
    expect(la.caveats.join(" ")).toMatch(/proxy/i);
    // The earlier generic estimate's failed test is kept as history, not deleted.
    expect(la.previous_page_model.script).toBe("scripts/backtest_la_valuation.mjs");
    expect(la.previous_page_model.gate.pass).toBe(false);
    // The page ships exactly the tested coefficients.
    const nv = JSON.parse(fs.readFileSync(path.join(root, "app/data/la_neighborhood_values.json"), "utf8"));
    expect(nv.model.coef).toEqual(result.regression.coef);
  });

  it("the nine hand-typed nationwide 'underused sites' are gone", () => {
    const ids = load("app/data/underused_sites.json").map((s: any) => s.id);
    for (const gone of ["site_phx_golf_1", "site_phx_lot_2", "site_atx_golf_1", "site_atx_lot_2", "site_sea_lot_1", "site_den_golf_1", "site_chi_lot_1", "site_det_vacant_1", "site_tpa_lot_1"]) {
      expect(ids).not.toContain(gone);
    }
  });

  it("underused-site model outputs are listed as unverified", () => {
    for (const s of load("app/data/underused_sites.json")) {
      expect(s.verification.unverified_fields).toEqual(expect.arrayContaining(["marketLandValue", "potentialHomes", "margin"]));
    }
  });

  it("intercity corridors carry no railyard 'recommendations' (they were built on invented land costs)", () => {
    for (const c of load("app/data/intercity_transit_corridors.json")) {
      expect(JSON.stringify(c)).not.toMatch(/"RECOMMENDED"|"NOT RECOMMENDED"/);
    }
  });

  it("research studies carry no '$ per $1' return figures (no source stated them)", () => {
    for (const s of load("app/data/research.json")) expect(s.vpd ?? null).toBeNull();
  });

  it("the scripts that typed data in by hand are gone", () => {
    for (const f of ["scripts/expand_hud_fmr_nationwide.mjs", "scripts/expand_underused_sites_nationwide.mjs", "scripts/add_nationwide_housing_laws.mjs", "scripts/expand_funding_programs_nationwide.mjs", "scripts/build_verified_data.py", "scripts/build_verified_data.mjs", "scripts/build_underused_sites.mjs"]) {
      expect(fs.existsSync(path.join(root, f))).toBe(false);
    }
  });
});
