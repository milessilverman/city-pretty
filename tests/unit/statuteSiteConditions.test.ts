import { describe, expect, it } from "vitest";
import { evaluateByRightHousing } from "../../src/engines/statutoryZoningEngine";

// Site conditions (flood area, fire zone, agricultural preserve, public land) are decided law by law from each
// record. Before 20 Nov 2026 the engine screened no law at all on such a lot, in every state, which no record said.
// These records are made up for the test (state "ZZ"); the rule, not any real law, is what is tested.
//
// 22 Nov 2026: the two branches' per-law designs were merged onto one schema (rec.exclusion_sources with
// rec.exclusions_review; tests/unit/exclusionsPerStatute.test.ts). The other branch's records here used
// site_conditions; they are written in the merged schema, and each scenario is kept. Two expectations changed to the
// merged (safer) rule, both listed in docs/audit/merge-2026-11-22.md: a law whose text was never checked for site
// exclusions is "not determined" even on a lot with no hazard (it used to apply), and a conditional exclusion the page
// never checks (null) holds the law back too (it used to be ignored for farmland and land ownership).
const law = (id: string, extra: any = {}) => ({ id, state_code: "ZZ", short_name: id, statute_citation: "test", verification: { status: "verified" }, ...extra });
const confirmed = (exclusion_sources: any[]) => ({ exclusion_sources, exclusions_review: { status: "confirmed", checked_on: "2026-11-22", note: "test record" } });
const ex = (key: string, extra: any = {}) => ({ key, label: key === "fema_100yr_floodway" ? "a FEMA special flood hazard area" : key === "calfire_or_state_vhfhsz" ? "a very high fire hazard severity zone" : key, citation: "Test Code 1(" + key + ")", wording: "the text's words for " + key, url: "https://example.org/test", checked_on: "2026-11-22", ...extra });
const LAWS = [
  law("unchecked"),
  law("checked_no_exclusion", confirmed([])),
  law("text_excludes_fire", confirmed([ex("calfire_or_state_vhfhsz")])),
  law("lists_flood", confirmed([ex("fema_100yr_floodway")])),
];
const parcel = (exclusions: any) => ({ parcel_id: "p", state_code: "ZZ", base_zoning_code: "R-1", is_single_family_residential: true, is_commercial_or_mixed_use: false, exclusions } as any);
const run = (exclusions: any) => {
  const r: any = evaluateByRightHousing(parcel(exclusions), LAWS as any);
  const ids = (l: any[]) => l.map(x => x.id).sort();
  return { applies: ids(r.applicable_statutes), notConfirmed: ids(r.not_confirmed), ruledOut: ids(r.excluded_by_statute), r };
};

describe("statute engine: site conditions are decided law by law", () => {
  it("no hazard on the lot: every law whose text was checked applies; one never checked is not determined", () => {
    const o = run({ fema_100yr_floodway: false, calfire_or_state_vhfhsz: false });
    expect(o.applies).toEqual(["checked_no_exclusion", "lists_flood", "text_excludes_fire"]);
    expect(o.notConfirmed).toEqual(["unchecked"]);
    expect(o.r.not_confirmed[0].reason).toBe("Not determined: the list of sites this law excludes has not been confirmed against the statute text.");
    expect(o.ruledOut).toEqual([]);
  });

  it("very high fire zone: ruled out only where the text says so; applied where the text was checked; not determined where it was not", () => {
    const o = run({ fema_100yr_floodway: false, calfire_or_state_vhfhsz: true });
    expect(o.applies).toEqual(["checked_no_exclusion", "lists_flood"]);
    expect(o.ruledOut).toEqual(["text_excludes_fire"]);
    expect(o.notConfirmed).toEqual(["unchecked"]);
    expect(o.r.excluded_by_statute[0].reason).toBe("Excluded by the law's own text: \"the text's words for calfire_or_state_vhfhsz\" (Test Code 1(calfire_or_state_vhfhsz)).");
    // A law whose text was never checked is not determined, not applied as if the answer were "no" (and not ruled out).
    expect(o.r.not_confirmed[0].reason).toBe("Not determined: the list of sites this law excludes has not been confirmed against the statute text.");
  });

  it("flood area: a listed exclusion rules the law out; an unchecked law is not determined", () => {
    const o = run({ fema_100yr_floodway: true, calfire_or_state_vhfhsz: false });
    expect(o.applies).toEqual(["checked_no_exclusion", "text_excludes_fire"]);
    expect(o.ruledOut).toEqual(["lists_flood"]);
    expect(o.notConfirmed).toEqual(["unchecked"]);
    expect(o.r.excluded_by_statute[0].reason).toContain("The page's flood flag is FEMA's special flood hazard area");
  });

  it("a check that was asked and not answered (null) leaves a law that names it not determined; it never counts as 'no'", () => {
    const o = run({ fema_100yr_floodway: null, calfire_or_state_vhfhsz: null });
    expect(o.applies).toEqual(["checked_no_exclusion"]);
    expect(o.notConfirmed).toEqual(["lists_flood", "text_excludes_fire", "unchecked"]);
    expect(o.r.not_confirmed.find((n: any) => n.id === "lists_flood").reason).toBe("Not determined: the law excludes a FEMA special flood hazard area (Test Code 1(fema_100yr_floodway)), and the page has not checked this for this parcel.");
  });

  it("an exclusion on terms the page cannot see leaves the law not determined, with those terms; an exception is shown with a ruling-out", () => {
    const laws = [
      law("local_option", confirmed([ex("fema_100yr_floodway", { effect: "conditional", condition: "only where the municipality has exempted the lot by ordinance" })])),
      law("with_exception", confirmed([ex("fema_100yr_floodway", { exception: "a map revision" })])),
    ];
    const r: any = evaluateByRightHousing(parcel({ fema_100yr_floodway: true }), laws as any);
    expect(r.applicable_statutes).toEqual([]);
    expect(r.not_confirmed.map((n: any) => n.id)).toEqual(["local_option"]);
    expect(r.not_confirmed[0].reason).toBe("Not determined: the lot is in a FEMA special flood hazard area, which the law's text excludes only where the municipality has exempted the lot by ordinance: \"the text's words for fema_100yr_floodway\" (Test Code 1(fema_100yr_floodway)). The page's flood flag is FEMA's special flood hazard area (the 100-year floodplain). The page cannot see whether that applies to this lot.");
    expect(r.excluded_by_statute.map((n: any) => n.id)).toEqual(["with_exception"]);
    expect(r.excluded_by_statute[0].reason).toContain(". The text's exception: \"a map revision\"");
    // Checked and absent: a conditional exclusion has no effect.
    const clear: any = evaluateByRightHousing(parcel({ fema_100yr_floodway: false }), laws as any);
    expect(clear.applicable_statutes.map((x: any) => x.id).sort()).toEqual(["local_option", "with_exception"]);
    // Farmland and land ownership are never checked by the page (null). A conditional exclusion on them holds the law back:
    // the page cannot tell whether the lot is such land (changed 22 Nov 2026; the other branch ignored it).
    const ag: any = evaluateByRightHousing(parcel({ williamson_or_ag_preserve: null }), [law("ag_conditional", confirmed([ex("williamson_or_ag_preserve", { effect: "conditional", condition: "only by zoning" })]))] as any);
    expect(ag.applicable_statutes).toEqual([]);
    expect(ag.not_confirmed.map((x: any) => x.id)).toEqual(["ag_conditional"]);
  });

  it("a law the zone does not reach is not listed at all, whatever the site", () => {
    const r: any = evaluateByRightHousing({ ...parcel({ calfire_or_state_vhfhsz: true }), base_zoning_code: "M-1", is_single_family_residential: false }, [law("commercial_only", { applies_to_zone: "commercial", ...confirmed([ex("calfire_or_state_vhfhsz")]) })] as any);
    expect(r.applicable_statutes).toEqual([]);
    expect(r.not_confirmed).toEqual([]);
    expect(r.excluded_by_statute).toEqual([]);
  });
});
