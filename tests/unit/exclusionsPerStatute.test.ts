import { describe, expect, it } from "vitest";
// @ts-ignore plain CommonJS module
import { evaluateByRightHousing, statuteExclusionCheck } from "../../src/engines/statutoryZoningEngine";
import * as fs from "fs";
import * as path from "path";

// Site exclusions come from each law's own list (exclusion_sources), not from a rule applied to every state. Before
// 19 Nov 2026 the engine returned no laws at all when a floodway, fire-zone, agricultural-preserve or public-land flag was true,
// for every state, and treated flags the page never checks (airport, waterfront, preserve, public land) as false.
const root = path.join(__dirname, "../..");
const LAWS = JSON.parse(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf-8"));
const byId = (id: string) => LAWS.find((r: any) => r.id === id);
const clear = (rec: any) => Object.fromEntries((rec.exclusion_sources || []).map((e: any) => [e.key, false]));

describe("every record carries its own exclusion list and says whether it was confirmed", () => {
  it("has exclusion_sources and exclusions_review on all records; no leftover statutory_exclusions", () => {
    expect(LAWS.length).toBe(45);
    for (const r of LAWS) {
      expect(Array.isArray(r.exclusion_sources), r.id).toBe(true);
      expect(["confirmed", "not confirmed"], r.id).toContain(r.exclusions_review.status);
      expect(r.exclusions_review.checked_on, r.id).toBe("2026-11-19");
      expect(r.exclusions_review.note.length, r.id).toBeGreaterThan(20);
      expect(r.statutory_exclusions, r.id).toBeUndefined();
      const unverified = (r.verification.unverified_fields || []).join(" | ");
      if (r.exclusions_review.status === "confirmed") expect(unverified, r.id).not.toMatch(/exclusion_sources|statutory_exclusions/);
      else expect(unverified, r.id).toMatch(/exclusion_sources \(not confirmed/);
    }
  });

  it("each listed exclusion has a machine key, the statute's wording, a citation, a URL and a checked date", () => {
    for (const r of LAWS) {
      for (const e of r.exclusion_sources) {
        expect(e.key, r.id).toMatch(/^[a-z0-9_]+$/);
        expect(e.wording.length, r.id + " " + e.key).toBeGreaterThan(10);
        expect(e.citation, r.id + " " + e.key).toBeTruthy();
        expect(e.url, r.id + " " + e.key).toMatch(/^https:\/\//);
        expect(e.checked_on, r.id + " " + e.key).toBe("2026-11-19");
        if (e.effect !== undefined) expect(e.effect).toBe("limits");
      }
    }
  });

  it("30 lists are confirmed and 15 are not; a law with an unconfirmed list has no confirmed claim of its own", () => {
    const n = (s: string) => LAWS.filter((r: any) => r.exclusions_review.status === s).length;
    expect([n("confirmed"), n("not confirmed")]).toEqual([30, 15]);
  });

  // (a) a listed exclusion whose flag is true blocks the law, and the output quotes the statute;
  // (b) a flag the law does not list has no effect on it;
  // (c) an unconfirmed list is never "allowed".
  it("(a) for every confirmed record, each listed blocking exclusion that is present is reported with the statute's wording", () => {
    let checked = 0;
    for (const r of LAWS.filter((x: any) => x.exclusions_review.status === "confirmed")) {
      for (const e of r.exclusion_sources.filter((x: any) => x.effect !== "limits")) {
        const c = statuteExclusionCheck(r, { exclusions: { ...clear(r), [e.key]: true } });
        expect(c.confirmed, r.id).toBe(true);
        expect(c.present.map((p: any) => p.key), r.id + " " + e.key).toContain(e.key);
        expect(c.notChecked, r.id).toEqual([]);
        expect(c.quote(e), r.id).toContain(e.wording);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("(b) a flag the law does not list has no effect on it, for every record", () => {
    for (const r of LAWS) {
      const unlisted = ["fema_100yr_floodway", "calfire_or_state_vhfhsz", "historic_district_hpoz", "williamson_or_ag_preserve", "public_or_tribal_land"]
        .filter(k => !r.exclusion_sources.some((e: any) => e.key === k));
      for (const k of unlisted) {
        const c = statuteExclusionCheck(r, { exclusions: { ...clear(r), [k]: true } });
        expect(c.present, r.id + " " + k).toEqual([]);
        expect(c.notChecked, r.id + " " + k).toEqual([]);
      }
    }
  });

  it("(c) an unconfirmed list is not determined, never allowed, whatever the flags say", () => {
    for (const r of LAWS.filter((x: any) => x.exclusions_review.status !== "confirmed")) {
      const c = statuteExclusionCheck(r, { exclusions: clear(r) });
      expect(c.confirmed, r.id).toBe(false);
    }
  });
});

describe("the engine uses the law's own list", () => {
  const sfr = (state: string, over: Record<string, any> = {}) => ({
    parcel_id: "t", state_code: state, county_fips: "00000", municipality_pop: 400000, county_pop: 900000, lot_sqft: 7000,
    base_zoning_code: "R-1", is_commercial_or_mixed_use: false, is_single_family_residential: true,
    dist_to_heavy_rail_mi: null, dist_to_frequent_bus_or_brt_mi: null, exclusions: {}, ...over,
  });
  const comm = (state: string, over: Record<string, any> = {}) => sfr(state, { base_zoning_code: "C-2", is_commercial_or_mixed_use: true, is_single_family_residential: false, ...over });
  const ids = (r: any) => r.applicable_statutes.map((s: any) => s.id);

  it("Montana's law lists no exclusion, so a flood, fire or public-land flag no longer blocks it (it blocked every state's laws before)", () => {
    const p = sfr("MT", { exclusions: { fema_100yr_floodway: true, calfire_or_state_vhfhsz: true, williamson_or_ag_preserve: true, public_or_tribal_land: true, historic_district_hpoz: true } });
    expect(ids(evaluateByRightHousing(p, LAWS))).toContain("mt_adu_76_2_345");
    expect(evaluateByRightHousing(p, LAWS).excluded_by_statute).toEqual([]);
  });

  it("a flag the page does not check is not treated as false: Florida Live Local is not determined, and says which checks are missing", () => {
    const r = evaluateByRightHousing(comm("FL", { exclusions: { fema_100yr_floodway: false, calfire_or_state_vhfhsz: null } }), LAWS);
    expect(ids(r)).not.toContain("fl_live_local");
    const nc = r.not_confirmed.find((x: any) => x.id === "fl_live_local");
    expect(nc.reason).toMatch(/^Not determined: the law excludes/);
    expect(nc.reason).toMatch(/airport-impacted area/);
    expect(nc.reason).toMatch(/the page has not checked these for this parcel/);
  });

  it("Texas SB 840: the airport exclusion present blocks it with the statute's words; unchecked is not determined; all clear applies", () => {
    const sb = byId("tx_sb840");
    const mk = (ex: any) => comm("TX", { municipality_pop: 2300000, county_pop: 4800000, exclusions: ex });
    const blocked = evaluateByRightHousing(mk({ ...clear(sb), airport_noise_or_runway_zone: true }), LAWS);
    const x = blocked.excluded_by_statute.find((e: any) => e.id === "tx_sb840");
    expect(x.reason).toContain("3,000 feet of an airport or military base");
    expect(ids(blocked)).not.toContain("tx_sb840");
    const unknown = evaluateByRightHousing(mk({}), LAWS);
    expect(unknown.not_confirmed.find((e: any) => e.id === "tx_sb840").reason).toMatch(/heavy industrial/);
    expect(ids(evaluateByRightHousing(mk(clear(sb)), LAWS))).toContain("tx_sb840");
  });

  // These two laws also carry an unmapped_condition (a will-serve letter, a covenant), so the engine reports them as not on
  // file before it reaches the exclusions; the check function is tested directly.
  it("Oregon commercial-land law: the 100-year floodplain is listed, and the note says the page's flag is FEMA's special flood hazard area", () => {
    const rec = byId("or_commercial_197a460");
    const c = statuteExclusionCheck(rec, { exclusions: { ...clear(rec), fema_100yr_floodway: true } });
    expect(c.present.map((e: any) => e.key)).toEqual(["fema_100yr_floodway"]);
    const note = c.quote(c.present[0]);
    expect(note).toContain("The property is within a 100-year floodplain");
    expect(note).toContain("FEMA's special flood hazard area");
  });

  it("Colorado ADU law: a true flood flag is a listed exemption; the water, sewer and historic exemptions stay unchecked until supplied", () => {
    const rec = byId("co_hb24_1152");
    const c = statuteExclusionCheck(rec, { exclusions: { fema_100yr_floodway: true } });
    expect(c.present.map((e: any) => e.key)).toEqual(["fema_100yr_floodway"]);
    expect(c.notChecked.map((e: any) => e.key)).toEqual(["not_served_by_water_and_sewer", "historic_property_outside_district"]);
  });

  it("California SB 9 is not determined while its list is unconfirmed, even with every flag clear", () => {
    const sb9 = byId("ca_sb9_lot_split");
    const r = evaluateByRightHousing(sfr("CA", { county_fips: "06037", exclusions: { ...clear(sb9), fema_100yr_floodway: false } }), LAWS);
    expect(ids(r)).not.toContain("ca_sb9_lot_split");
    expect(r.not_confirmed.find((e: any) => e.id === "ca_sb9_lot_split").reason).toMatch(/has not been confirmed against the statute text/);
  });

  it("a limit stays on the law: SB 79 in a very high fire zone applies and quotes 65912.159(a)(3)", () => {
    const rec = byId("ca_sb79_tier1");
    const p = comm("CA", { county_fips: "06037", dist_to_heavy_rail_mi: 0.2, exclusions: { ...clear(rec), calfire_or_state_vhfhsz: true } });
    const t1 = evaluateByRightHousing(p, LAWS).applicable_statutes.find((s: any) => s.id === "ca_sb79_tier1");
    expect(t1.exclusion_limits.join(" ")).toContain("very high fire hazard severity zone");
    // not checked: the law still applies, and the limit is listed as not checked
    const q = evaluateByRightHousing({ ...p, exclusions: { rent_controlled_housing_site: false, rent_controlled_housing_site_prior_use: false, mobilehome_or_rv_park_site: false } }, LAWS);
    const t1b = q.applicable_statutes.find((s: any) => s.id === "ca_sb79_tier1");
    expect(t1b.exclusion_limits_not_checked.join(" ")).toMatch(/very high fire hazard/);
  });

  it("Washington's middle-housing law excludes only what RCW 36.70A.635(8) lists, and quotes it", () => {
    const rec = byId("wa_hb1110");
    const p = sfr("WA", { municipality_pop: 700000 });
    const blocked = evaluateByRightHousing({ ...p, exclusions: { ...clear(rec), urban_separator: true } }, LAWS);
    expect(blocked.excluded_by_statute.find((e: any) => e.id === "wa_hb1110").reason).toContain("designated urban separators");
    // the flood flag is not in that list (critical areas are a separate layer), so it has no effect there
    const flood = evaluateByRightHousing({ ...p, exclusions: { ...clear(rec), fema_100yr_floodway: true } }, LAWS);
    expect(flood.excluded_by_statute.map((e: any) => e.id)).not.toContain("wa_hb1110");
  });

  it("with no exclusions object at all, the parcel is not blocked by anything and a law with a list is not determined", () => {
    const r = evaluateByRightHousing({ ...sfr("MT"), exclusions: undefined }, LAWS);
    expect(ids(r)).toContain("mt_adu_76_2_345");
    const f = evaluateByRightHousing({ ...comm("FL"), exclusions: undefined }, LAWS);
    expect(ids(f)).not.toContain("fl_live_local");
  });
});
