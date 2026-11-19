import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const load = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));
const isUrl = (s: any) => typeof s === "string" && /^https?:\/\//.test(s);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("transit data: every row is sourced and carries a verification block", () => {
  // transit_pipelines.json, intercity_transit_corridors.json and unit_costs.json are this base's tables (the smaller
  // branch's versions were not carried over on 19 Nov 2026). tests/unit/provenance.test.ts already checks every record's
  // verification status and the corridors' removed railyard claims; these tests check what the Invest view relies on.
  it("transit_pipelines.json: no length or cost fields, no finance figures, and p3Type only as an unconfirmed field", () => {
    const pipes = load("app/data/transit_pipelines.json");
    expect(pipes.length).toBeGreaterThanOrEqual(5);
    for (const p of pipes) {
      expect(p.fips).toMatch(/^\d{5}$/);
      expect(p.agency).toBeTruthy();
      expect(isUrl(p.rtp_document_url)).toBe(true);
      expect(p.last_verified).toMatch(DATE);
      expect(p.verification.checked_on).toMatch(DATE);
      expect(p.verification.evidence.length).toBeGreaterThan(20);
      // the Invest view lists every project without a length or cost because the table has none
      expect(p.length_miles).toBeUndefined();
      expect(p.total_capital_cost_musd).toBeUndefined();
      for (const k of ["tdc", "seniorDebt", "tifiaLoan", "developerEquity", "units", "affordPct", "retailSqft", "baseIRR", "baseGroundLease", "baseHomeLiftPct"]) expect(p[k]).toBeNull();
      if (p.p3Type != null) expect(p.verification.unverified_fields).toContain("p3Type");
      for (const st of p.stations) { expect(Number.isFinite(st.lat)).toBe(true); expect(Number.isFinite(st.lng)).toBe(true); }
    }
  });

  it("intercity_transit_corridors.json: a number the record does not list as unverified is quoted in its own evidence", () => {
    const cs = load("app/data/intercity_transit_corridors.json");
    const numericFields = ["route_length_miles", "max_speed_mph", "projected_one_way_minutes", "highway_comparison_minutes", "estimated_capital_cost_billions"];
    for (const c of cs) {
      expect(isUrl(c.source_url)).toBe(true);
      expect(c.verification.checked_on).toMatch(DATE);
      const unv = (c.verification.unverified_fields || []).map((u: string) => String(u).split(/[\s(]/)[0]);
      for (const f of numericFields) {
        if (c[f] == null || unv.includes(f)) continue;
        // used as a fact by the Invest view: the record must be checked and its text must carry the figure
        expect(["verified", "partially_verified"]).toContain(c.verification.status);
        expect(`${c.verification.evidence} ${c.verification.notes || ""}`).toContain(String(c[f]));
      }
      for (const st of c.proposed_stations) {
        for (const f of ["median_home_value_walkshed", "avg_land_cost_per_sqft", "available_underused_acres_walkshed"]) expect(st[f]).toBeNull();
      }
    }
    // Austin-San Antonio: the record could not be checked, so its route length is not a fact
    const atx = cs.find((c: any) => c.id === "corridor_atx_sat");
    expect(atx.verification.status).toBe("unverified");
    expect(atx.verification.unverified_fields.join(" ")).toMatch(/route_length_miles/);
  });

  it("unit_costs.json: confirmed prices are checked rows with source and quote; no row prices a house addition", () => {
    const rows = load("app/data/unit_costs.json");
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) {
      expect(r.verification.checked_on).toMatch(DATE);
      if (r.status === "confirmed") {
        expect(["verified", "partially_verified"]).toContain(r.verification.status);
        expect(r.unit_price).toBeGreaterThan(0);
        expect(isUrl(r.source_url)).toBe(true);
        expect(r.quote).toBeTruthy();
        expect(r.unit).toBeTruthy();
      }
      if (r.verification.status === "could_not_check" && r.unit_price != null) expect(r.status).not.toBe("confirmed");
      // the decision engine's house additions find no cost here (docs/DECISION-ENGINE.md)
      expect(["adu", "added_bedroom", "added_bathroom", "second_storey", "lot_split"]).not.toContain(r.item);
    }
    const ga = rows.find((r: any) => r.state === "GA" && r.item === "sidewalk");
    expect(ga.unit_price).toBe(45);
  });

  it("transit_cost_benchmarks.json: at least 40 US rows, each with source_url, quote and verification; cost/mile is cost / length", () => {
    const b = load("app/data/transit_cost_benchmarks.json");
    expect(b.rows.length).toBeGreaterThanOrEqual(40);
    const modes = new Set(["urban_rail", "regional_rail", "light_rail", "heavy_rail", "commuter_rail", "streetcar", "brt", "hsr"]);
    const ids = new Set<string>();
    for (const r of b.rows) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
      expect(isUrl(r.source_url)).toBe(true);
      expect(r.quote).toBeTruthy();
      expect(r.verification.status).toMatch(/^verified/);
      expect(r.verification.checked_on).toMatch(DATE);
      expect(modes.has(r.mode)).toBe(true);
      expect(r.length_miles).toBeGreaterThan(0);
      expect(r.cost_usd_millions).toBeGreaterThan(0);
      expect(r.cost_basis).toBeTruthy();
      expect(Math.abs(r.cost_per_mile_usd_millions - r.cost_usd_millions / r.length_miles) / r.cost_per_mile_usd_millions).toBeLessThan(0.01);
    }
    const brt = b.rows.filter((r: any) => r.mode === "brt").length;
    expect(brt).toBeGreaterThanOrEqual(10);
    const rle = b.rows.find((r: any) => r.id === "fta_chicago_red_line_extension");
    expect(rle.cost_usd_millions).toBe(5750);
  });

  it("transit_value_effects.json: every number comes with a quote, DOI/URL and a verification block", () => {
    const v = load("app/data/transit_value_effects.json");
    expect(v.rows.length).toBeGreaterThanOrEqual(10);
    for (const r of v.rows) {
      expect(isUrl(r.source_url)).toBe(true);
      expect(r.study_doi).toMatch(/^10\./);
      expect(r.quote.length).toBeGreaterThan(20);
      expect(r.verification.checked_on).toMatch(DATE);
      expect(r.mode).toBeTruthy();
      expect(r.distance_band).toBeTruthy();
      expect(r.property_type).toBeTruthy();
      if (r.effect_pct !== null) {
        expect(r.verification.status).toBe("verified_in_fetched_text");
        if (r.range_low_pct !== null) {
          expect(r.range_low_pct).toBeLessThanOrEqual(r.effect_pct);
          expect(r.range_high_pct).toBeGreaterThanOrEqual(r.effect_pct);
        }
      } else {
        expect(r.range_low_pct).toBeNull();
      }
    }
  });

  it("research/transit_verification.csv exists and covers every data file", () => {
    const csv = fs.readFileSync(path.join(root, "research/transit_verification.csv"), "utf-8");
    for (const f of ["transit_pipelines.json", "intercity_transit_corridors.json", "unit_costs.json", "transit_cost_benchmarks.json", "transit_value_effects.json"]) {
      expect(csv).toContain(f);
    }
  });

  // The smaller branch's transitCorridorOpportunityEngine test was removed on 19 Nov 2026: this base has no such
  // engine (corridor facts reach the page and the advisor as the record's own fields, gated by its verification), and
  // the Invest view's transit verdicts come from investmentDecisionEngine.evaluateTransit, tested in
  // tests/unit/investmentDecisionEngine.test.ts.
});
