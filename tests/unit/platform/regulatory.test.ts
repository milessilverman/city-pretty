import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { makeGeoRef, IMPROVEMENT_CATEGORIES } from "../../../src/platform/schema/index.js";
import {
  TOPICS, makeConclusion, makeJurisdictionModule, createRegistry, makeRegulatoryCheck, CATEGORY_TOPICS,
  buildCaliforniaModule, buildLosAngelesCityModule,
} from "../../../src/platform/regulatory/index.js";

const poly = { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] } as any;
const parcel = (state: string, countyFips: string, place: string | null, attributes: Record<string, any> = {}) =>
  ({ ref: makeGeoRef({ kind: "parcel", id: `p-${state}-${place}`, jurisdiction: { country: "US", state, countyFips, place }, geometry: poly }), attributes });

describe("framework (FIXTURE: not real data)", () => {
  // FIXTURE: not real data
  const SRC = { citation: "fixture cite", url: "https://example.invalid/x", quote: "fixture quote", retrieved: "2000-01-01" };
  const UNC = { level: "low", reasons: ["fixture"] };
  const J = { level: "state", state: "XX" };
  const ok = (over: any = {}) => makeConclusion({ topic: "zoning", jurisdiction: J, finding: "allowed", source: SRC, effectiveDate: "2000-01-01", uncertainty: UNC, ...over });

  it("refuses findings without source, effectiveDate or uncertainty; allows requires_investigation bare", () => {
    expect(() => makeConclusion({ topic: "zoning", jurisdiction: J, finding: "allowed" })).toThrow(/source/);
    expect(() => ok({ source: null })).toThrow(/source/);
    expect(() => ok({ effectiveDate: null })).toThrow(/effectiveDate/);
    expect(() => ok({ uncertainty: null })).toThrow(/uncertainty/);
    expect(() => ok({ uncertainty: { level: "low", reasons: [] } })).toThrow(/uncertainty/);
    expect(() => ok({ topic: "nope" })).toThrow(/topic/);
    expect(makeConclusion({ topic: "zoning", jurisdiction: J, finding: "requires_investigation" }).finding).toBe("requires_investigation");
    expect(ok().finding).toBe("allowed");
    expect(TOPICS.length).toBe(13);
  });

  const xxModule = (fn: any) => makeJurisdictionModule({ jurisdiction: J, topics: { zoning: fn } });

  it("registry picks containing modules, city modules need place match, missing topic is requires_investigation", () => {
    const reg = createRegistry();
    reg.register(xxModule(() => [ok()]));
    reg.register(makeJurisdictionModule({ jurisdiction: { level: "city", state: "XX", place: "Town" }, topics: { zoning: () => [ok({ finding: "not_allowed" })] } }));
    expect(reg.evaluate(parcel("XX", "00001", "Other"), "zoning", "2001-01-01").map((c) => c.finding)).toEqual(["allowed"]);
    expect(reg.evaluate(parcel("XX", "00001", "Town"), "zoning", "2001-01-01").map((c) => c.finding)).toEqual(["allowed", "not_allowed"]);
    const none = reg.evaluate(parcel("XX", "00001", "Town"), "height", "2001-01-01");
    expect(none).toHaveLength(1);
    expect(none[0].finding).toBe("requires_investigation");
    expect(none[0].note).toMatch(/height/);
    expect(reg.evaluate(parcel("YY", "00001", null), "zoning", "2001-01-01")[0].finding).toBe("requires_investigation");
  });

  it("module throws outside its jurisdiction; asOf is required", () => {
    const m = xxModule(() => [ok()]);
    expect(() => m.evaluate(parcel("YY", "00001", null), "zoning", "2001-01-01")).toThrow(/cannot be applied/);
    expect(() => m.evaluate(parcel("XX", "00001", null), "zoning", undefined as any)).toThrow(/asOf/);
  });

  it("a rule effective after asOf is reported not_yet_in_effect and not applied", () => {
    const m = xxModule(() => [ok({ effectiveDate: "2010-01-01" })]);
    const c = m.evaluate(parcel("XX", "00001", null), "zoning", "2005-01-01")[0];
    expect(c.status).toBe("not_yet_in_effect");
    expect(c.finding).toBe("requires_investigation");
    expect(m.evaluate(parcel("XX", "00001", null), "zoning", "2010-01-01")[0].finding).toBe("allowed");
  });

  it("check collapses: not_allowed fails with citation, unknown lists missing, allowed passes with conditions", () => {
    const run = (cs: any[]) => {
      const reg = createRegistry();
      reg.register(xxModule(() => cs));
      return makeRegulatoryCheck(reg, { vacant_land: ["zoning"] }, "2001-01-01")(parcel("XX", "00001", null), "vacant_land") as any;
    };
    const f = run([ok({ finding: "not_allowed" })]);
    expect(f.result).toBe("fail");
    expect(f.reason).toContain(SRC.url);
    const u = run([ok(), makeConclusion({ topic: "zoning", jurisdiction: J, finding: "requires_investigation", missing: ["attr_a"] })]);
    expect(u).toEqual({ result: "unknown", missing: ["attr_a"] });
    const p = run([ok({ finding: "conditional", conditions: ["cond one"] })]);
    expect(p.result).toBe("pass");
    expect(p.conditions).toEqual(["cond one"]);
    const reg = createRegistry();
    expect(makeRegulatoryCheck(reg, {}, "2001-01-01")(parcel("XX", "00001", null), "vacant_land").result).toBe("unknown");
  });

  it("category table covers the 17 parcel categories with valid topics", () => {
    const ids = IMPROVEMENT_CATEGORIES.filter((c) => c.family === "parcel_development").map((c) => c.id);
    expect(ids).toHaveLength(17);
    for (const id of ids) {
      const t = (CATEGORY_TOPICS as any)[id];
      expect(t?.length).toBeGreaterThan(0);
      for (const x of t) expect(TOPICS).toContain(x);
    }
  });
});

const statutes: any[] = JSON.parse(readFileSync("app/data/statutes.json", "utf8"));
const finance = JSON.parse(readFileSync("app/data/state_finance_profiles.json", "utf8"));
const bundle = JSON.parse(gunzipSync(Buffer.from(readFileSync("app/data/bundle-la.b64.txt", "utf8").trim(), "base64")).toString("utf8"));
const caRecords = statutes.filter((r) => r.state_code === "CA");
const ASOF = "2099-01-01";
const ca = () => buildCaliforniaModule(statutes, finance.CA);
const allTopics = (m: any, p: any, asOf = ASOF) => TOPICS.filter((t) => m.covers(t)).flatMap((t) => m.evaluate(p, t, asOf));

describe("California module on real records", () => {
  it("has 8 CA records and a conclusion for each, plus Prop 13", () => {
    expect(caRecords).toHaveLength(8);
    const cs = allTopics(ca(), parcel("CA", "06037", "Los Angeles"));
    const ids = new Set(cs.map((c: any) => c.ruleId));
    for (const r of caRecords) expect(ids.has(r.id)).toBe(true);
    expect(ids.has("ca_prop13")).toBe(true);
    for (const c of cs) expect(c.jurisdiction.state).toBe("CA");
  });

  it("every numeric value equals the record's own field and cites the record", () => {
    const p = parcel("CA", "06037", "Los Angeles", {
      distance_to_transit_mi: 0.2, transit_mode: "heavy_rail_or_very_high_frequency_commuter_rail_72_trains_per_day", city_population: 4e6,
      calfire_or_state_vhfhsz: false, rent_controlled_housing_site: false, mobilehome_or_rv_park_site: false,
      single_family_zone: true, historic_district_hpoz: false, fema_100yr_floodway: false, prime_farmland: false,
      distance_to_public_transit_mi: 0.1, zoning_class: "commercial", ab2011_site_criteria_met: true,
    });
    const cs = allTopics(ca(), p).filter((c: any) => c.value);
    expect(cs.length).toBeGreaterThan(4);
    const fieldOf: Record<string, string> = { "mi": "distance_to_transit_max_mi", "ft": "max_height_ft", "du/acre": "min_allowed_density_du_per_acre", "ratio": "max_far", "sqft": "min_new_parcel_sqft", "spaces/unit": "min_parking_spaces_per_unit", "years": "affordability_term_years" };
    for (const c of cs as any[]) {
      const rec = caRecords.find((r) => r.id === c.ruleId)!;
      const field = c.value.unit === "units" ? (c.ruleId === "ca_sb9_lot_split" ? "max_units_by_right" : "adus_by_right") : c.value.unit === "percent" ? "affordability_mandate_pct" : fieldOf[c.value.unit];
      expect(c.value.value).toBe(rec[field]);
      expect(c.source.url).toBe(rec.statute_url);
      expect(c.source.quote).toBe(rec.verification.evidence);
      expect(c.effectiveDate).toBe(rec.effective_date);
      expect(c.value.source.url).toBe(rec.statute_url);
    }
    expect((cs as any[]).some((c) => c.ruleId === "ca_sb79_tier1")).toBe(true);
  });

  it("partially_verified records carry high uncertainty with reasons; ADU without effective date is requires_investigation", () => {
    const cs = allTopics(ca(), parcel("CA", "06037", "Los Angeles", { single_family_zone: true, historic_district_hpoz: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false, prime_farmland: false })) as any[];
    for (const id of ["ca_sb9_lot_split", "ca_adu_66323"]) {
      const mine = cs.filter((c) => c.ruleId === id);
      expect(mine.length).toBeGreaterThan(0);
      for (const c of mine) { expect(c.uncertainty.level).toBe("high"); expect(c.uncertainty.reasons.length).toBeGreaterThan(0); }
    }
    for (const c of cs.filter((c) => c.ruleId === "ca_adu_66323")) { expect(c.finding).toBe("requires_investigation"); expect(c.unverifiedHint).toBeTruthy(); }
  });

  it("unsupplied exclusion attributes give requires_investigation, never a pass", () => {
    const p = parcel("CA", "06037", "Los Angeles", { distance_to_transit_mi: 0.2, transit_mode: "heavy_rail_or_very_high_frequency_commuter_rail_72_trains_per_day" });
    const c = ca().evaluate(p, "tod_law", ASOF).filter((x: any) => x.ruleId === "ca_sb79_tier1");
    expect(c).toHaveLength(1);
    expect(c[0].finding).toBe("requires_investigation");
    expect(c[0].missing).toContain("calfire_or_state_vhfhsz");
  });

  it("SB 79 is not applied before its effective date", () => {
    const sb = caRecords.find((r) => r.id === "ca_sb79_tier1")!;
    const p = parcel("CA", "06037", "Los Angeles", { distance_to_transit_mi: 0.2, transit_mode: sb.transit_mode, calfire_or_state_vhfhsz: false, rent_controlled_housing_site: false, mobilehome_or_rv_park_site: false });
    const after = ca().evaluate(p, "height", sb.effective_date).filter((c: any) => c.ruleId === "ca_sb79_tier1");
    expect(after[0].finding).toBe("conditional");
    const before = ca().evaluate(p, "height", "2000-01-01").filter((c: any) => c.ruleId === "ca_sb79_tier1");
    expect(before[0].status).toBe("not_yet_in_effect");
    expect(before[0].finding).toBe("requires_investigation");
    expect(before[0].value).toBeNull();
  });

  it("a Texas parcel gets requires_investigation from the registry and a throw from the module", () => {
    const tx = parcel("TX", "48201", "Houston", { distance_to_transit_mi: 0.1 });
    const reg = createRegistry();
    reg.register(ca());
    for (const t of TOPICS) {
      const r = reg.evaluate(tx, t, ASOF);
      expect(r.every((c) => c.finding === "requires_investigation")).toBe(true);
    }
    expect(() => ca().evaluate(tx, "tod_law", ASOF)).toThrow(/cannot be applied/);
  });

  it("end to end: discovery check on an LA parcel with no attributes is unknown, not fail", () => {
    const reg = createRegistry();
    reg.register(ca());
    reg.register(buildLosAngelesCityModule(bundle.zone_rules));
    const chk = makeRegulatoryCheck(reg, CATEGORY_TOPICS as any, ASOF);
    const r = chk(parcel("CA", "06037", "Los Angeles"), "densification") as any;
    expect(r.result).toBe("unknown");
    expect(r.missing.length).toBeGreaterThan(0);
  });
});

describe("Los Angeles city module", () => {
  const rows: any[] = bundle.zone_rules;
  it("rows carry no source object, so every conclusion is requires_investigation with the unverified row attached", () => {
    expect(rows).toHaveLength(14);
    expect(rows.some((r) => r.source || r.url || r.quote)).toBe(false);
    const m = buildLosAngelesCityModule(rows);
    const p = parcel("CA", "06037", "Los Angeles", { zoning_district: "R1" });
    for (const t of ["zoning", "density", "height", "setbacks"]) {
      const cs = m.evaluate(p, t, ASOF);
      expect(cs.length).toBeGreaterThan(0);
      for (const c of cs as any[]) {
        expect(c.finding).toBe("requires_investigation");
        expect(c.unverifiedHint.row.zone_prefix).toBe("R1");
        expect(c.unverifiedHint.row.jurisdiction).toBe("Los Angeles");
        expect(c.note).toMatch(/may not be shown as a legal standard/);
        expect(c.value).toBeNull();
        expect(c.source).toBeNull();
      }
    }
  });
  it("needs zoning_district; rejects non-LA parcels; ignores other cities' rows", () => {
    const m = buildLosAngelesCityModule(rows);
    expect(m.evaluate(parcel("CA", "06037", "Los Angeles"), "height", ASOF)[0].missing).toEqual(["zoning_district"]);
    expect(() => m.evaluate(parcel("CA", "06037", "Pasadena", { zoning_district: "R1" }), "height", ASOF)).toThrow(/cannot be applied/);
  });
  it("a sourced row (FIXTURE: not real data) yields a conditional conclusion with its own number", () => {
    // FIXTURE: not real data
    const fx = [{ jurisdiction: "Los Angeles", zone_prefix: "ZZ", max_height_ft: "10", effective_date: "2000-01-01", source: { citation: "fixture", url: "https://example.invalid/z", quote: "fixture quote", retrieved: "2000-01-02" } }];
    const c = buildLosAngelesCityModule(fx).evaluate(parcel("CA", "06037", "Los Angeles", { zoning_district: "ZZ-1" }), "height", ASOF)[0] as any;
    expect(c.finding).toBe("conditional");
    expect(c.value.value).toBe(10);
  });
});
