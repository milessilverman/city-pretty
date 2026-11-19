#!/usr/bin/env python3
"""Round 3 of the state-finance-profile audit (16 Nov 2026): field-level evidence for the five fields the
tax-increment model needs, in TX, FL, AZ, WA, CA and CO. Every quote below was copied from the fetched page.

Idempotent: re-running sets the same values and evidence. See docs/audit/laws-finance-audit.md (round 3).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "app", "data", "state_finance_profiles.json")
DAY = "2026-11-16"


def ev(url, quote, status="confirmed", note=""):
    return {"status": status, "source_url": url, "quote": quote, "checked_on": DAY, "note": note}


UPDATES = {
    "TX": {
        "values": {"reassessment_cycle_years": 3, "homestead_exemption_rule": {"type": "flat_market", "amount_or_pct": 140000, "applies_to": "school district taxes"}},
        "evidence": {
            "uncaps_on_sale": ev("https://texas.public.law/statutes/tex._tax_code_section_23.23",
                                 "The limitation expires on January 1 of the first tax year that neither the owner of the property when the limitation took effect nor the owner's spouse or surviving spouse qualifies for an exemption under Section 11.13",
                                 note="The 10% homestead cap ends when the owner changes, so a sale returns the home to appraised value."),
            "reassessment_cycle_years": ev("https://texas.public.law/statutes/tex._tax_code_section_25.18",
                                           "The plan shall provide for the following reappraisal activities for all real and personal property in the district at least once every three years",
                                           status="corrected", note="Corrected from 1: the statute requires reappraisal at least every three years; a district may reappraise more often."),
            "homestead_exemption_rule": ev("https://comptroller.texas.gov/taxes/property-tax/exemptions/",
                                           "Tax Code Section 11.13(b) requires school districts to provide a $140,000 exemption on a residence homestead",
                                           status="corrected",
                                           note="Corrected from $100,000 (the texas.public.law mirror still shows the pre-2025 amount; the Comptroller, the state agency, states $140,000). Applies to school district taxes only; counties with farm-to-market or flood-control taxes must give $3,000 (11.13(a)) and any unit may add up to 20% (11.13(n))."),
        },
    },
    "FL": {
        "values": {},
        "evidence": {
            "uncaps_on_sale": ev("https://www.flsenate.gov/Laws/Statutes/2026/193.155",
                                 "property assessed under this section shall be assessed at just value as of January 1 of the year following a change of ownership"),
            "reassessment_cycle_years": ev("https://www.flsenate.gov/Laws/Statutes/2026/192.042",
                                           "All property shall be assessed according to its just value as follows: (1) Real property, on January 1 of each year."),
        },
    },
    "AZ": {
        "values": {},
        "evidence": {
            "uncaps_on_sale": ev("https://www.azleg.gov/ars/42/13302.htm",
                                 "In the following circumstances the limited property value shall be established at a level or percentage of full cash value that is comparable to that of other properties ... A change in the occupant or classification of a single-family residence is not a change in use, in and of itself.",
                                 note="The listed circumstances (omitted property, change in use, modification of 15% or more, splits) do not include a sale, so the 5% limited-value cap carries over to a buyer."),
            "homestead_exemption_rule": ev("https://www.azleg.gov/ars/15/00972.htm",
                                           "there shall be additional state aid for education computed for school districts",
                                           note="Arizona's owner-occupied relief (A.R.S. 15-972) is state aid that reduces school primary taxes, not an exemption of assessed value, so the taxable base has no homestead deduction."),
        },
    },
    "WA": {
        "values": {},
        "evidence": {
            "reassessment_cycle_years": ev("https://app.leg.wa.gov/rcw/default.aspx?cite=84.41.030",
                                           "All taxable real property within a county must be revalued annually"),
            "homestead_exemption_rule": ev("https://dor.wa.gov/taxes-rates/property-tax/property-tax-exemptions-and-deferrals",
                                           "Property tax assistance program for widows or widowers of veterans ... Property tax deferral program for homeowners with limited income Available To: Homeowners with combined disposable income of $57,000 or less",
                                           note="The Department of Revenue lists only targeted programs (veterans' widows, seniors and people with disabilities, limited-income deferral); there is no general homestead exemption."),
        },
    },
    "CA": {
        "values": {},
        "evidence": {
            "uncaps_on_sale": ev("https://california.public.law/codes/revenue_and_taxation_code_section_110.1",
                                 "For property which is purchased, is newly constructed, or changes ownership after the 1975 lien date, either of the following: (A) The date on which a purchase or change in ownership occurs."),
            "reassessment_cycle_years": ev("https://california.public.law/codes/revenue_and_taxation_code_section_401.3",
                                           "The assessor shall assess all property subject to general property taxation on the lien date",
                                           note="With R&T 2192: 'all tax liens attach annually as of 12:01 a.m. on the first day of January'."),
        },
    },
    "CO": {
        "values": {"homestead_exemption_rule": None},
        "evidence": {
            "reassessment_cycle_years": ev("https://colorado.public.law/statutes/crs_39-1-104",
                                           "During the two years of each reassessment cycle, in preparation for implementation in the succeeding reassessment cycle, the respective assessors shall conduct revaluations of all taxable real property"),
            "uncaps_on_sale": ev("https://colorado.public.law/statutes/crs_39-1-104",
                                 "the respective assessors shall conduct revaluations of all taxable real property",
                                 note="Colorado has no assessed-value cap; every property is revalued each two-year cycle whether or not it sold, so there is no cap for a sale to lift. The model only uses this field when a cap exists."),
            "res_assessment_ratio": ev("https://leg.colorado.gov/sites/default/files/documents/2024B/bills/2024b_1001_enr.pdf",
                                       "FOR PROPERTY TAX YEARS COMMENCING ON OR AFTER JANUARY 1, 2026, IF THE STATE BOARD OF EQUALIZATION DETERMINES THAT THE STATEWIDE ACTUAL VALUE GROWTH IS GREATER THAN FIVE PERCENT ... 6.7 PERCENT OF THE AMOUNT EQUAL TO THE ACTUAL VALUE OF THE PROPERTY MINUS THE LESSER OF TEN PERCENT OF THE ACTUAL VALUE OF THE PROPERTY, SEVENTY THOUSAND DOLLARS AS INCREASED FOR INFLATION",
                                       status="not_confirmed",
                                       note="The 2026 rate depends on the State Board of Equalization's certification of statewide value growth, which was not fetched; under the >5% branch the rate is 6.7% for local levies and 6.95% for school levies after a per-home reduction."),
            "homestead_exemption_rule": ev("https://leg.colorado.gov/sites/default/files/documents/2024B/bills/2024b_1001_enr.pdf",
                                           "MINUS THE LESSER OF TEN PERCENT OF THE ACTUAL VALUE OF THE PROPERTY, SEVENTY THOUSAND DOLLARS AS INCREASED FOR INFLATION",
                                           status="corrected_to_unknown",
                                           note="The previous value 'none' was wrong under the >5% branch, which deducts the lesser of 10% or $70,000 (inflation-adjusted) from each home's value. Set to null until the applicable branch is confirmed; the model also cannot apply a per-home deduction to an area total."),
        },
    },
}


def main():
    d = json.load(open(P))
    for st, u in UPDATES.items():
        r = d[st]
        r.update(u["values"])
        fe = r.setdefault("field_evidence", {})
        fe.update(u["evidence"])
        v = r["verification"]
        confirmed = {k for k, e in fe.items() if e["status"] in ("confirmed", "corrected")}
        v["unverified_fields"] = [f for f in v.get("unverified_fields", []) if f.split()[0] not in confirmed]
        for k, e in u["evidence"].items():
            if e["status"] not in ("confirmed", "corrected") and k not in v["unverified_fields"]:
                v["unverified_fields"].append(k)
        calc = ["res_assessment_ratio", "annual_assessment_cap", "uncaps_on_sale", "reassessment_cycle_years", "homestead_exemption_rule"]
        missing = [f for f in calc if f in v["unverified_fields"]]
        v["status"] = "partially_verified" if v["unverified_fields"] else "verified"
        v["notes"] = (v.get("notes", "") + f" Round 3 ({DAY}): field_evidence added for {', '.join(sorted(u['evidence']))}."
                      + (f" Calculator fields still unconfirmed: {', '.join(missing)}." if missing else " All five tax-increment fields confirmed.")).strip()
        v["checked_on"] = DAY
        r["last_verified"] = DAY if not missing else r.get("last_verified")
    json.dump(d, open(P, "w"), indent=2)
    for st in UPDATES:
        v = d[st]["verification"]
        print(st, v["status"], "unverified:", v["unverified_fields"])


if __name__ == "__main__":
    main()
