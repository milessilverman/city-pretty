#!/usr/bin/env python3
"""California ADU record: say which zones the law reaches, from the statute's own words.

Until 20 Nov 2026 the record was named "... on single-family lots" and the engine applied it to single-family lots
only. Gov. Code § 66323(a) applies "within a residential or mixed-use zone" and § 66323(a)(3)-(4) covers lots with a
multifamily dwelling (quotes below, from the Legislature's bulk database; see docs/audit/site_exclusions/ca_notes.md,
section B1). This sets applies_to_zone to "residential" (single-family or multifamily zoning; the engine does not
apply it to commercial / mixed-use zoning, which the text also names, because the page cannot tell whether such a lot
has a dwelling), renames the record, and adds the quotes to its evidence. Unit counts for multifamily lots are not
modeled and stay listed as unverified. Run: python3 scripts/apply_ca_adu_zone_scope.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
NOTES = os.path.join(ROOT, "docs/audit/site_exclusions/ca_notes.md")
SOURCE = "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip"
Q_OPEN = ("(a) Notwithstanding Sections 66314 to 66322, inclusive, a local agency shall ministerially approve an application "
          "for a building permit within a residential or mixed-use zone to create any of the following units, or any "
          "combination of the following units:")
Q_MULTI = ("(B) A local agency shall allow at least one accessory dwelling unit within an existing multifamily dwelling and "
           "shall allow up to 25 percent of the existing multifamily dwelling units.")


def main():
    notes = " ".join(open(NOTES, encoding="utf-8").read().replace(">", " ").split())
    for q in (Q_OPEN, Q_MULTI):
        assert " ".join(q.split()) in notes, "quote not found in the evidence notes: " + q[:60]
    assert SOURCE in open(NOTES, encoding="utf-8").read()
    laws = json.load(open(TARGETS[0], encoding="utf-8"))
    r = next(x for x in laws if x["id"] == "ca_adu_66323")
    r["short_name"] = "CA: ADUs approved ministerially on lots with a dwelling in residential zones"
    r["applies_to_zone"] = "residential"
    r["summary"] = ("A local agency must ministerially approve, in residential or mixed-use zones, one ADU and one junior ADU per lot "
                    "with a proposed or existing single-family dwelling, and ADUs on lots with an existing or proposed multifamily "
                    "dwelling (other combinations and the unit counts are in § 66323); ADU permit applications are approved "
                    "ministerially without discretionary review or a hearing (§ 66317).")
    v = r["verification"]
    if Q_MULTI not in v["evidence"]:
        v["evidence"] += " || Official bulk database (" + SOURCE + ", read 2026-11-20), § 66323(a): " + Q_OPEN + " || § 66323(a)(3)(B): " + Q_MULTI
    note = "applies_to_zone (the engine applies this record to single-family and multifamily zoning; the text also names mixed-use zones, which are not applied because the page cannot tell whether such a lot has a dwelling)"
    if note not in v["unverified_fields"]:
        v["unverified_fields"].append(note)
    multi = "adus_by_right on a lot with a multifamily dwelling (§ 66323(a)(3)-(4) sets different counts; not modeled)"
    if multi not in v["unverified_fields"]:
        v["unverified_fields"].append(multi)
    out = json.dumps(laws, indent=2, ensure_ascii=False) + "\n"
    for t in TARGETS:
        open(t, "w", encoding="utf-8").write(out)
    print("ca_adu_66323 updated:", r["short_name"])


if __name__ == "__main__":
    main()
