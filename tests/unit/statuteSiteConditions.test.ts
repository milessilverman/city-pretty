import { describe, expect, it } from "vitest";
import { evaluateByRightHousing } from "../../src/engines/statutoryZoningEngine";

// Site conditions (flood area, fire zone, agricultural preserve, public land) are decided law by law from each
// record. Before 20 Nov 2026 the engine screened no law at all on such a lot, in every state, which no record said.
// These records are made up for the test (state "ZZ"); the rule, not any real law, is what is tested.
const law = (id: string, extra: any = {}) => ({ id, state_code: "ZZ", short_name: id, statute_citation: "test", verification: { status: "verified" }, ...extra });
const LAWS = [
  law("unchecked"),
  law("checked_no_exclusion", { site_conditions: { fema_100yr_floodway: { excluded: false, url: "u" }, calfire_or_state_vhfhsz: { excluded: false, url: "u" } } }),
  law("text_excludes_fire", { site_conditions: { calfire_or_state_vhfhsz: { excluded: true, quote: "q", url: "u" }, fema_100yr_floodway: { excluded: false, url: "u" } } }),
  law("lists_flood", { statutory_exclusions: ["fema_100yr_floodway (test)"], site_conditions: { calfire_or_state_vhfhsz: { excluded: false, url: "u" } } }),
];
const parcel = (exclusions: any) => ({ parcel_id: "p", state_code: "ZZ", base_zoning_code: "R-1", is_single_family_residential: true, is_commercial_or_mixed_use: false, exclusions } as any);
const run = (exclusions: any) => {
  const r: any = evaluateByRightHousing(parcel(exclusions), LAWS as any);
  const ids = (l: any[]) => l.map(x => x.id).sort();
  return { applies: ids(r.applicable_statutes), notConfirmed: ids(r.not_confirmed), ruledOut: ids(r.excluded_by_site), r };
};

describe("statute engine: site conditions are decided law by law", () => {
  it("no hazard on the lot: every law applies", () => {
    const o = run({ fema_100yr_floodway: false, calfire_or_state_vhfhsz: false });
    expect(o.applies).toEqual(["checked_no_exclusion", "lists_flood", "text_excludes_fire", "unchecked"]);
    expect(o.notConfirmed).toEqual([]);
    expect(o.ruledOut).toEqual([]);
  });

  it("very high fire zone: ruled out only where the text says so; applied where the text was checked; not confirmed where it was not", () => {
    const o = run({ fema_100yr_floodway: false, calfire_or_state_vhfhsz: true });
    expect(o.applies).toEqual(["checked_no_exclusion", "lists_flood"]);
    expect(o.ruledOut).toEqual(["text_excludes_fire"]);
    expect(o.notConfirmed).toEqual(["unchecked"]);
    expect(o.r.excluded_by_site[0].reason).toBe("Does not apply: the lot is in a very high fire hazard severity zone, which this law's text excludes.");
    expect(o.r.not_confirmed[0].reason).toContain("whether this law reaches a lot in a very high fire hazard severity zone (this lot is in one, and the law's text has not been checked for it)");
  });

  it("flood area: a listed exclusion rules the law out; an unchecked law is not confirmed", () => {
    const o = run({ fema_100yr_floodway: true, calfire_or_state_vhfhsz: false });
    expect(o.applies).toEqual(["checked_no_exclusion", "text_excludes_fire"]);
    expect(o.ruledOut).toEqual(["lists_flood"]);
    expect(o.notConfirmed).toEqual(["unchecked"]);
  });

  it("a check that was asked and not answered (null) leaves a law that names it not confirmed; it never counts as 'no'", () => {
    const o = run({ fema_100yr_floodway: null, calfire_or_state_vhfhsz: null });
    expect(o.applies).toEqual(["checked_no_exclusion", "unchecked"]);
    expect(o.notConfirmed).toEqual(["lists_flood", "text_excludes_fire"]);
    expect(o.r.not_confirmed.find((n: any) => n.id === "lists_flood").reason).toContain("whether the lot is in a FEMA special flood hazard area");
  });

  it("an exclusion on terms the page cannot see leaves the law not confirmed, with those terms; an exception is shown with a ruling-out", () => {
    const laws = [
      law("local_option", { site_conditions: { fema_100yr_floodway: { excluded: "conditional", condition: "only where the municipality has exempted the lot by ordinance", quote: "q", url: "u" } } }),
      law("with_exception", { statutory_exclusions: ["fema_100yr_floodway"], site_conditions: { fema_100yr_floodway: { excluded: true, exception: "a map revision", quote: "q", url: "u" } } }),
    ];
    const r: any = evaluateByRightHousing(parcel({ fema_100yr_floodway: true }), laws as any);
    expect(r.applicable_statutes).toEqual([]);
    expect(r.not_confirmed.map((n: any) => n.id)).toEqual(["local_option"]);
    expect(r.not_confirmed[0].reason).toBe("Not on file for this parcel: whether this law reaches this lot (it is in a FEMA special flood hazard area, which the law's text excludes only where the municipality has exempted the lot by ordinance).");
    expect(r.excluded_by_site[0].reason).toBe("Does not apply: the lot is in a FEMA special flood hazard area, which this law's text excludes. The text has exceptions: a map revision.");
    // Farmland and land ownership are never asked by the page, so an unanswered (null) one does not hold a law back.
    const ag: any = evaluateByRightHousing(parcel({ williamson_or_ag_preserve: null }), [law("ag_conditional", { site_conditions: { williamson_or_ag_preserve: { excluded: "conditional", condition: "only by zoning", quote: "q", url: "u" } } })] as any);
    expect(ag.applicable_statutes.map((x: any) => x.id)).toEqual(["ag_conditional"]);
  });

  it("a law the zone does not reach is not listed at all, whatever the site", () => {
    const r: any = evaluateByRightHousing({ ...parcel({ calfire_or_state_vhfhsz: true }), base_zoning_code: "M-1", is_single_family_residential: false }, [law("commercial_only", { applies_to_zone: "commercial" })] as any);
    expect(r.applicable_statutes).toEqual([]);
    expect(r.not_confirmed).toEqual([]);
    expect(r.excluded_by_site).toEqual([]);
  });
});
