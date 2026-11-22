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
import { allBundleFips } from "../r2Only";

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
  "app/data/zoning_standards.json": (d) => d.jurisdictions,
  "app/data/parcel_use_codes.json": (d) => d.systems,
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
        const evidence = v.evidence;
        return !method || !evidence || String(method).length < 10;
      });
      expect(bad.map((r: any) => r?.id ?? r?.fips ?? "?")).toEqual([]);
    });
  }

  it("statutes.json and state-housing-laws.json stay identical (the app reads both names)", () => {
    expect(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf8")).toBe(fs.readFileSync(path.join(root, "app/data/state-housing-laws.json"), "utf8"));
  });
});

describe("HUD Fair Market Rents: current fiscal year, from HUD's FMR API, by script", () => {
  const d = load("app/data/hud_fair_market_rents.json");
  const by: Record<string, any> = Object.fromEntries(d.records.map((r: any) => [r.fips, r]));

  it("is the scripted API pull, FY2027, with the Federal Register sanity check recorded", () => {
    expect(d._source.script).toBe("scripts/fetch_hud_fmr_api.py");
    expect(d._source.fiscal_year).toBe(2027);
    expect(d._source.federal_register).toMatch(/2026-17891/);
    expect(d._source.sanity_check).toMatch(/\$2,903/);
    expect(d.records.every((r: any) => r.fiscal_year === 2027)).toBe(true);
    expect(fs.existsSync(path.join(root, "scripts/fetch_hud_fmr.py"))).toBe(false); // the stale map-service pull is gone
  });

  it("covers exactly the Census county set, once each, with no pseudo-counties", () => {
    const fips = d.records.map((r: any) => r.fips);
    const census = Object.keys(load("app/data/county_completeness.json"));
    expect(fips.length).toBe(3222);
    expect(new Set(fips).size).toBe(fips.length);
    expect(fips).not.toContain("29056"); // HUD's "Sullivan city part of Crawford County", attached to Crawford (29055)
    for (const f of census) expect(by[f]).toBeDefined();
  });

  it("spot checks against HUD's API on 2026-11-16", () => {
    expect(by["06037"].two_bed_2br).toBe(2964);
    expect(by["48453"].two_bed_2br).toBe(1817);
    expect(by["29055"].sub_areas[0].fmr_area).toMatch(/St\. Louis/);
  });

  it("every record carries its HUD API URL as evidence", () => {
    for (const r of d.records) {
      expect(r.verification?.evidence).toMatch(/^https:\/\/www\.huduser\.gov\/hudapi\/public\/fmr\/statedata\//);
    }
  });

  it("every HUD record has an uppercase 2-letter state code", () => {
    expect(d.records.every((r: any) => typeof r.state_code === "string" && r.state_code === r.state_code.toUpperCase())).toBe(true);
  });

  it("New England counties carry town values and no invented county figure", () => {
    const ne = d.records.filter((r: any) => ["CT", "ME", "MA", "NH", "RI", "VT"].includes(r.state_code));
    expect(ne.length).toBeGreaterThan(0);
    for (const r of ne) {
      expect(r.two_bed_2br).toBeNull();
      expect(Array.isArray(r.towns) && r.towns.length > 0).toBe(true);
      expect(r.two_bed_range[0]).toBeLessThanOrEqual(r.two_bed_range[1]);
    }
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
  it("every California county has a file; San Francisco's comes from DataSF, the rest from CCRS", () => {
    // San Francisco: only 34% of its CCRS crashes have coordinates, so it uses DataSF's injury-crash records (95.6% placed).
    expect(files).toContain("06037.json");
    expect(files.filter((f) => f.startsWith("06")).length).toBe(58);
    const sf = JSON.parse(fs.readFileSync(path.join(dir, "06075.json"), "utf8"))._meta;
    expect(sf.source).toBe("San Francisco injury crashes (DataSF)");
    expect(sf.fields[2]).toBe("injury or fatal crashes");
    expect(sf.pedbike_lower_bound).toBe(true);
    expect(sf.located_share).toBeGreaterThan(0.9);
    expect(sf.field_descriptions.mviw).toBe("motor vehicle involved with");
    const gaps = JSON.parse(fs.readFileSync(path.join(root, "app/data/crash_gaps/06075.json"), "utf8"))._meta;
    expect(gaps.peers).toMatch(/within this county/); // not pooled with LA's CCRS counts
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

describe("Tree Equity Score current release (2020 block groups), per county", () => {
  const dir = path.join(root, "app/data/tree_equity_2025");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{5}\.json$/.test(f)) : [];
  it("covers every county with a data file, from American Forests' published state files", () => {
    // one file per county data file (counties/bundle_<fips>.json.gz) plus LA and Orange, whose data files are embedded
    // R2-only county files (counties/.r2-only.txt) count as data files whether or not a copy is on disk here
    const bundles = allBundleFips();
    expect(files.length).toBe(bundles.length + 2);
    for (const f of [...bundles, "06037", "06059"]) expect(files).toContain(`${f}.json`);
    for (const f of files) {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))._meta;
      expect(m.url).toMatch(/^https:\/\/tes-app-data-share\.s3\.amazonaws\.com\/[a-z]{2}\/[a-z]{2}_csv\.zip$/);
      expect(m.zip_member_date).toMatch(/^20(25|26)-\d{2}-\d{2}$/);
      expect(m.script).toBe("scripts/build_tree_equity_2025.py");
      expect(m.not_used).toMatch(/temp_diff/); // heat is a different measure and is not swapped
    }
  });
  it("values are percentages in range, canopy gap = goal minus canopy (to rounding)", () => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, "48453.json"), "utf8"));
    for (const [g, v] of Object.entries(d)) {
      if (g === "_meta") continue;
      const [gap, canopy, goal] = v as (number | null)[];
      if (gap == null || canopy == null || goal == null) continue;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(Math.abs(gap - Math.max(0, goal - canopy))).toBeLessThanOrEqual(0.15);
    }
  });

  it("all Connecticut county files have > 0 block groups (crosswalked to planning regions)", () => {
    const ctFiles = files.filter((f) => f.startsWith("09"));
    expect(ctFiles.length).toBe(9); // all 9 planning regions (Northeastern CT, 09150, added 21 Nov 2026)
    for (const f of ctFiles) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const bgCount = Object.keys(d).filter((k) => k !== "_meta").length;
      expect(bgCount, `Connecticut file ${f} has 0 block groups`).toBeGreaterThan(0);
    }
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

describe("provenance: operational registries and model files have provenance", () => {
  it("app/data/parcel_services.json states its source and every service has a valid url and terms", () => {
    const d = load("app/data/parcel_services.json");
    expect(d._source.generated_from).toBeDefined();
    expect(Array.isArray(d.services) && d.services.length > 0).toBe(true);
    for (const s of d.services) {
      expect(s.url).toMatch(/^https?:\/\//);
      expect(s.name).toBeTruthy();
    }
  });

  it("app/data/county_valuation_models.json documents its source and every county has a passing model", () => {
    const d = load("app/data/county_valuation_models.json");
    expect(d._source).toContain("publish_benchmarks");
    for (const [fips, c] of Object.entries(d.counties) as [string, any][]) {
      expect(c.model).toBeDefined();
      expect(c.tested.mdape).toBeLessThanOrEqual(0.15);
    }
  });

  it("app/data/intervention_verification.json documents its audit provenance and statuses", () => {
    const d = load("app/data/intervention_verification.json");
    expect(d._about.audit).toMatch(/bundle-catalog-audit/);
    const keys = Object.keys(d).filter((k) => !k.startsWith("_"));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(STATUSES).toContain(d[k].status);
    }
  });

  it("app/data/upgrade_verification.json documents its audit provenance and row statuses", () => {
    const d = load("app/data/upgrade_verification.json");
    expect(d._about).toMatch(/catalog-coverage-round2/);
    const keys = Object.keys(d.rows);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(STATUSES).toContain(d.rows[k].status);
    }
  });

  it("app/data/la_neighborhood_values.json states its legal basis, assessor service, and reset method", () => {
    const d = load("app/data/la_neighborhood_values.json");
    expect(d._source.legal_basis.text).toContain("Cal. Rev. & Tax. Code §110.1");
    expect(d._source.service).toMatch(/LACounty_Parcel/);
    expect(d._source.script).toBe("scripts/build_la_neighborhood_values.mjs");
    expect(d._source.rows_used).toBeGreaterThan(100000);
  });
});
