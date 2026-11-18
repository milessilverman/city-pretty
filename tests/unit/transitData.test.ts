import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const load = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));
const isUrl = (s: any) => typeof s === "string" && /^https?:\/\//.test(s);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("transit data: every row is sourced and carries a verification block", () => {
  it("transit_pipelines.json: sourced facts only, no invented metrics or station blurbs", () => {
    const pipes = load("app/data/transit_pipelines.json");
    expect(pipes.length).toBeGreaterThanOrEqual(5);
    for (const p of pipes) {
      expect(p.fips).toMatch(/^\d{5}$/);
      expect(p.agency).toBeTruthy();
      expect(isUrl(p.rtp_document_url)).toBe(true);
      expect(p.last_verified).toMatch(DATE);
      expect(p.verification.checked_on).toMatch(DATE);
      expect(p.verification.sources.length).toBeGreaterThan(0);
      p.verification.sources.forEach((s: string) => expect(isUrl(s)).toBe(true));
      expect(p.verification.evidence.length).toBeGreaterThan(0);
      for (const k of ["tdc", "seniorDebt", "tifiaLoan", "developerEquity", "units", "affordPct", "retailSqft", "p3Type", "baseIRR", "baseGroundLease", "baseHomeLiftPct"]) {
        expect(p[k]).toBeNull();
      }
      for (const s of p.stations) {
        expect(typeof s.lat).toBe("number");
        expect(typeof s.lng).toBe("number");
        expect(Number.isNaN(s.lat) || Number.isNaN(s.lng)).toBe(false);
        expect(s.coordinate_source).toBeTruthy();
        expect(s.desc).toBeNull(); // no unsourced station descriptions
      }
      expect(JSON.stringify({ d: p.corridorDesc, s: p.stations })).not.toMatch(/EV stalls|fast EV|cycleway|solar canopy|health center/i);
    }
    const chi = pipes.find((p: any) => p.fips === "17031");
    expect(chi.total_capital_cost_musd).toBe(5750);
    expect(chi.length_miles).toBe(5.5);
  });

  it("intercity_transit_corridors.json: only FRA-document facts; every other number is null", () => {
    const cs = load("app/data/intercity_transit_corridors.json");
    const numericFields = ["route_length_miles", "max_speed_mph", "projected_one_way_minutes", "highway_comparison_minutes", "estimated_capital_cost_billions"];
    for (const c of cs) {
      expect(isUrl(c.source_url)).toBe(true);
      expect(c.verification).toBeTruthy();
      expect(c.verification.checked_on).toMatch(DATE);
      for (const f of numericFields) expect(c[f]).toBeNull();
      expect(c.candidate_railyard_sites).toEqual([]);
      if (c.verification.status !== "verified_in_fetched_document") {
        // an unconfirmed corridor must not carry a CID selection or any number
        expect(c.cid_selection).toBeNull();
      } else {
        expect(c.cid_selection.quote.length).toBeGreaterThan(20);
      }
      for (const s of c.proposed_stations) {
        expect(s.station_basis).toBe("illustrative_city_center");
        expect(s.coordinate_source).toBeTruthy();
        for (const f of ["median_home_value_walkshed", "avg_land_cost_per_sqft", "available_underused_acres_walkshed", "statutory_housing_regime", "recommended_redevelopment_focus"]) {
          expect(s[f]).toBeNull();
        }
      }
    }
    expect(cs.find((c: any) => c.id === "corridor_atx_sat").verification.status).toBe("corridor_not_confirmed");
  });

  it("unit_costs.json: a price exists only on a confirmed row with source, quote, period and region", () => {
    const rows = load("app/data/unit_costs.json");
    expect(rows.length).toBe(32);
    for (const r of rows) {
      expect(r.verification).toBeTruthy();
      expect(r.verification.checked_on).toMatch(DATE);
      if (r.unit_price !== null) {
        expect(r.status).toBe("confirmed");
        expect(r.unit_price).toBeGreaterThan(0);
        expect(isUrl(r.source_url)).toBe(true);
        expect(r.quote).toBeTruthy();
        expect(r.period).toBeTruthy();
        expect(r.region).toBeTruthy();
        expect(r.price_basis).toBeTruthy();
        expect(r.unit).toBeTruthy();
        expect(r.verification.status).toBe("verified_in_fetched_document");
      } else {
        expect(r.status).not.toBe("confirmed");
      }
    }
    // corrections made on 2026-11-18
    const ga = rows.find((r: any) => r.state === "GA" && r.item === "sidewalk");
    expect(ga.unit_price).toBe(45);
    const tx = rows.filter((r: any) => r.state === "TX");
    tx.forEach((r: any) => expect(r.unit_price).toBeNull());
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

  it("transitCorridorOpportunityEngine returns null, never NaN, on null/missing inputs (ts and js twins)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twins = [await import("../../src/engines/transitCorridorOpportunityEngine"), await import("../../src/engines/transitCorridorOpportunityEngine.js")];
    for (const m of twins as any[]) {
      const E = m.default && m.default.evaluateCorridorFeasibility ? m.default : m;
      const station: any = { id: "s", name: "X", city: "Y", fips: "00000", station_type: "city_center", lat: 40, lng: -100, median_home_value_walkshed: null, avg_land_cost_per_sqft: null, available_underused_acres_walkshed: null, statutory_housing_regime: null, recommended_redevelopment_focus: null };
      const corridor: any = { id: "c", name: "C", states: ["XX"], proposed_stations: [station], candidate_railyard_sites: [], projected_one_way_minutes: null, highway_comparison_minutes: null };
      const ev = E.evaluateCorridorFeasibility(corridor);
      expect(ev.isViable).toBeNull();
      expect(ev.speedCompetitivenessRatio).toBeNull();
      expect(ev.totalFeasibleHousingUnits).toBeNull();
      const tod = E.evaluateStationTODPotential(station);
      for (const val of Object.values(tod)) if (typeof val === "number") expect(Number.isNaN(val)).toBe(false);
      expect(tod.feasibleHousingUnits).toBeNull();
      expect(tod.estimatedFinishedDevelopmentValue).toBeNull();
      // partial data: only acres known -> units computed, value still null
      const partial = E.evaluateStationTODPotential({ ...station, available_underused_acres_walkshed: 10 });
      expect(partial.feasibleHousingUnits).toBe(350);
      expect(partial.estimatedFinishedDevelopmentValue).toBeNull();
      // string undefined inputs also safe
      const undef = E.evaluateCorridorFeasibility({ ...corridor, projected_one_way_minutes: undefined, highway_comparison_minutes: undefined });
      expect(undef.travelTimeSavedMinutes).toBeNull();
      for (const budget of [100000, 5000000, 50000000]) {
        expect(JSON.stringify(E.generateStationInvestmentPlan(corridor, station, budget))).not.toMatch(/NaN|undefined/);
      }
    }
  });
});
