#!/usr/bin/env python3
"""Round 2 of the state finance profile audit (16 Nov 2026). Applies field-level evidence fetched from statute text
or the state revenue department, and removes four fields that had no source in any state.

Every value set here was read in the quoted source during this audit. Fields not listed for a state stay unconfirmed.
Re-running is safe (idempotent). Evidence and method: docs/audit/laws-finance-audit.md, "Round 2".
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "app", "data", "state_finance_profiles.json")
TODAY = "2026-11-16"
UNSOURCED = ["non_pledgeable_share", "rsmeans_cost_multiplier", "tree_capital_cost_usd", "climate_energy_regime"]
# Fields the tax-increment calculator reads (src/engines/municipalFinanceEngine.ts).
CALC_FIELDS = ["res_assessment_ratio", "annual_assessment_cap", "uncaps_on_sale", "reassessment_cycle_years", "homestead_exemption_rule"]

# state -> {field: (value_to_store, source_url, quote, note)}; value "KEEP" keeps the stored value after confirming it.
EVIDENCE = {
    "MO": {
        "res_assessment_ratio": ("KEEP", "https://revisor.mo.gov/main/OneSection.aspx?section=137.115",
                                 "assessed at the following percentages of true value: (a) For real property in subclass (1), nineteen percent", ""),
        "reassessment_cycle_years": ("KEEP", "https://revisor.mo.gov/main/OneSection.aspx?section=137.115",
                                     "new assessed values shall be determined as of January first of each odd-numbered year", ""),
    },
    "MI": {
        "res_assessment_ratio": ("KEEP", "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-27a",
                                 "property shall be assessed at 50%", ""),
        "annual_assessment_cap": ("KEEP", "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-27a",
                                  "multiplied by the lesser of 1.05 or the inflation rate",
                                  "0.05 is the ceiling; the actual cap is the lesser of 5% and inflation."),
        "uncaps_on_sale": ("KEEP", "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-27a",
                           "Upon a transfer of ownership of property after 1994, the property's taxable value for the calendar year following the year of the transfer is the property's state equalized valuation", ""),
    },
    "KS": {
        "res_assessment_ratio": ("KEEP", "https://ksrevisor.gov/statutes/chapters/ch79/079_014_0039.html",
                                 "real property used for residential purposes ... at 11.5%", ""),
    },
    "WV": {
        "res_assessment_ratio": ("KEEP", "https://code.wvlegislature.gov/11-3-1/",
                                 "shall be assessed annually as of July 1 at sixty percent of its true and actual value", ""),
    },
    "SC": {
        "res_assessment_ratio": ("KEEP", "https://www.scstatehouse.gov/code/t12c043.php",
                                 "taxed on an assessment equal to four percent of the fair market value of the property",
                                 "4% applies to an owner-occupied legal residence; other residential property is assessed at a higher ratio (not stored)."),
        "reassessment_cycle_years": ("KEEP", "https://www.scstatehouse.gov/code/t12c043.php",
                                     "once every fifth year each county or the State shall appraise and equalize those properties", ""),
        "annual_assessment_cap": (None, "https://www.scstatehouse.gov/code/t12c037.php",
                                  "The fifteen percent cap in Section 12-37-3140",
                                  "South Carolina's cap is 15% per five-year reassessment, not a yearly cap; stored as reassessment_increase_cap."),
    },
    "VA": {
        "res_assessment_ratio": ("KEEP", "https://law.lis.virginia.gov/vacode/title58.1/chapter32/section58.1-3201/",
                                 "shall be made at 100 percent fair market value", ""),
    },
    "OH": {
        "res_assessment_ratio": ("KEEP", "https://codes.ohio.gov/ohio-revised-code/section-5715.01",
                                 "that per cent of true value in money ... the commissioner by rule establishes, but it shall not exceed thirty-five per cent",
                                 "35% is the statutory maximum; the rule that sets it was not read."),
        "reassessment_cycle_years": (6, "https://codes.ohio.gov/ohio-revised-code/section-5713.01",
                                     "at least once in each six-year period",
                                     "Corrected from 3. Interim (triennial) updates under R.C. 5715.33 were not confirmed."),
    },
    "NV": {
        "res_assessment_ratio": ("KEEP", "https://www.leg.state.nv.us/NRS/NRS-361.html",
                                 "NRS 361.225 Rate of assessment. All property subject to taxation must be assessed at 35 percent of its taxable value.", ""),
        "annual_assessment_cap": (None, "https://www.leg.state.nv.us/NRS/NRS-361.html",
                                  "an increase in the tax bill of the owner of a home by more than 3 percent over the tax bill of that homeowner for the previous year constitutes a severe economic hardship",
                                  "Corrected from 0.03: NRS 361.4723 limits growth in the tax bill of an owner-occupied single-family home, not the assessed value; stored as tax_bill_growth_cap."),
    },
    "MA": {
        "res_assessment_ratio": ("KEEP", "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section2A",
                                 "the assessments on the real property that they propose to make are at full and fair cash valuation as required by section thirty-eight", ""),
    },
    "MD": {
        "reassessment_cycle_years": ("KEEP", "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=8-103",
                                     "for the 1st, 2nd, or 3rd year of a 3-year cycle", ""),
        "annual_assessment_cap": (0.10, "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=9-105",
                                  "for the State property tax ... 110% ... The homestead credit percentage for any county or municipal corporation property tax: (i) may not be less than 100% or exceed 110%",
                                  "Corrected from null: the homestead credit limits taxable assessment growth on owner-occupied homes to 10% a year for the State tax; counties may set 0-10%."),
        "homestead_exemption_rule": ({"type": "none", "amount_or_pct": 0}, "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=9-105",
                                     "the property tax credit under this section is calculated by: (i) multiplying the prior year's taxable assessment by the homestead credit percentage",
                                     "Corrected: Maryland's homestead relief is the assessment-growth credit above, not a 5% exemption of market value."),
    },
    "IA": {
        "res_assessment_ratio": (None, "https://www.legis.iowa.gov/docs/code/441.21.pdf",
                                 "the percentage of actual value at which agricultural and residential property shall be assessed shall be calculated in accordance with the methods provided",
                                 "Corrected from 0.5: Iowa's residential assessment percentage is recalculated each year by formula; no single number is correct."),
    },
    "ID": {
        "res_assessment_ratio": ("KEEP", "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH2/SECT63-205/",
                                 "must be assessed annually at market value for assessment purposes", ""),
        "reassessment_cycle_years": ("KEEP", "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH2/SECT63-205/",
                                     "must be assessed annually at market value", ""),
        "homestead_exemption_rule": ("KEEP", "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH6/SECT63-602G/",
                                     "the first one hundred twenty-five thousand dollars ($125,000) of the market value ... or fifty percent (50%) of the market value ... whichever is the lesser, shall be exempt",
                                     "The 50%-of-value limit is not modeled; the exemption is the lesser of $125,000 and half the home's value."),
    },
    "WY": {
        "res_assessment_ratio": ("KEEP", "https://wyoleg.gov/statutes/compress/title39.pdf",
                                 "All other property, real and personal ... nine and one-half percent (9.5%)", ""),
    },
    "ND": {
        "res_assessment_ratio": ("KEEP", "https://www.ndlegis.gov/cencode/t57c02.pdf",
                                 "All primary residential property and nonprimary residential property to be valued at nine percent of assessed value ... \"Assessed valuation\" means fifty percent of the true and full value of property",
                                 "0.045 = 9% of 50%."),
    },
    "RI": {
        "reassessment_cycle_years": ("KEEP", "https://webserver.rilegislature.gov/Statutes/TITLE44/44-5/44-5-11.6.htm",
                                     "shall conduct a revaluation within nine (9) years of the date of the prior revaluation and shall conduct an update of real property every three (3) years",
                                     "3 = statistical update interval; full revaluation every 9 years."),
    },
    "MN": {
        "res_assessment_ratio": (None, "https://www.revisor.mn.gov/statutes/cite/273.13",
                                 "The first $500,000 of market value of class 1a property has a net classification rate of one percent of its market value; and the market value of class 1a property that exceeds $500,000 has a classification rate of 1.25 percent",
                                 "Corrected from 1: Minnesota taxes net tax capacity (class rates of 1% and 1.25% for homesteads), so an assessment ratio comparable with other states does not exist."),
    },
    "GA": {
        "res_assessment_ratio": ("KEEP", "https://dor.georgia.gov/property-tax-valuation",
                                 "In Georgia property is required to be assessed at 40% of the fair market value unless otherwise specified by law. (O.C.G.A. 48-5-7)",
                                 "Source is the Georgia Department of Revenue page quoting the statute (the legislature's site was not reachable)."),
    },
    "NE": {
        "res_assessment_ratio": ("KEEP", "https://nebraskalegislature.gov/laws/statutes.php?statute=77-201",
                                 "all real property in this state, not expressly exempt therefrom, shall be subject to taxation and shall be valued at its actual value", ""),
    },
    "MT": {
        "reassessment_cycle_years": ("KEEP", "https://leg.mt.gov/bills/mca/title_0150/chapter_0070/part_0010/section_0110/0150-0070-0010-0110.html",
                                     "all real property and all property within class three, class four, and class ten must be revalued every 2 years", ""),
    },
    "UT": {
        "res_assessment_ratio": (1, "https://le.utah.gov/xcode/Title59/Chapter2/C59-2-S103_2024050120240501.pdf",
                                 "the fair market value of residential property located within the state is allowed a residential exemption equal to a 45% reduction in the value of the property",
                                 "Corrected from 0.55: the record also carried the 45% exemption, so the calculator applied it twice. Ratio is fair market value; the 45% is the exemption."),
        "homestead_exemption_rule": ("KEEP", "https://le.utah.gov/xcode/Title59/Chapter2/C59-2-S103_2024050120240501.pdf",
                                     "allowed a residential exemption equal to a 45% reduction in the value of the property", ""),
    },
    "SD": {
        "res_assessment_ratio": ("KEEP", "https://dor.sd.gov/individuals/taxes/property-tax/",
                                 "All property is to be assessed at full and true value. Then the property is equalized to 85% for property tax purposes.",
                                 "Source is the South Dakota Department of Revenue (the statute page renders without text here)."),
    },
}
EXTRA = {  # new, sourced fields that the old schema could not express
    "SC": {"reassessment_increase_cap": 0.15},
    "NV": {"tax_bill_growth_cap": 0.03},
}


def main():
    d = json.load(open(P))
    changed = []
    for st, r in d.items():
        for f in UNSOURCED:
            r.pop(f, None)
        v = r.setdefault("verification", {})
        uf = [u for u in v.get("unverified_fields", []) if str(u).split(" ")[0] not in UNSOURCED]
        fe = r.get("field_evidence", {})
        for field, (val, url, quote, note) in EVIDENCE.get(st, {}).items():
            if val != "KEEP" and r.get(field) != val:
                changed.append(f"{st}.{field}: {json.dumps(r.get(field))} -> {json.dumps(val)}")
                r[field] = val
            fe[field] = {"status": "confirmed" if val == "KEEP" else "corrected", "source_url": url, "quote": quote, "checked_on": TODAY, "note": note}
        r.update(EXTRA.get(st, {}))
        if fe:
            r["field_evidence"] = fe
        # Recompute what is unconfirmed among the calculator's fields (other fields keep their earlier notes).
        def mentions(u, f):
            u = str(u)
            return u.startswith(f) or (f == "res_assessment_ratio" and u.startswith("res/"))
        # Round 1 (laws track) checked the featured states field by field: a calculator field it did not list as
        # unverified was confirmed then. Unverified / could-not-check states had nothing confirmed.
        earlier_ok = set()
        if v.get("status") in ("verified", "partially_verified") and "all statutory fields" not in uf:
            earlier_ok = {f for f in CALC_FIELDS if not any(mentions(u, f) for u in uf)}
        # A field corrected to null is "confirmed not applicable" for display, but the calculator can't use it.
        confirmed = {f for f, x in fe.items() if r.get(f) is not None} | earlier_ok
        calc_unconfirmed = [f for f in CALC_FIELDS if f not in confirmed]
        keep = [u for u in uf if not any(mentions(u, f) for f in CALC_FIELDS) and u != "all statutory fields"]
        v["unverified_fields"] = calc_unconfirmed + keep
        if fe and v.get("status") in ("unverified", "could_not_check"):
            v["status"] = "partially_verified"
            v["method"] = "Round 2 (16 Nov 2026): statute text or state revenue department page fetched; per-field evidence in field_evidence."
            v["evidence"] = "; ".join(f"{k}: '{x['quote'][:90]}'" for k, x in fe.items())
        if calc_unconfirmed and v.get("status") == "verified":
            v["status"] = "partially_verified"
        if not v["unverified_fields"] and v.get("status") == "partially_verified":
            v["status"] = "verified"
        v["checked_on"] = TODAY
        notes = v.get("notes") or ""
        if fe:  # the round-1 blanket warning no longer describes this record
            notes = notes.replace("Only the 10 featured states were checked against statute text. Treat every number in this profile as unverified.",
                                  "Round 2 checked the fields listed in field_evidence; every other number in this profile is unverified.")
        v["notes"] = notes
        if "Round 2:" not in notes:
            v["notes"] = (notes + " " if notes else "") + "Round 2: removed non_pledgeable_share, rsmeans_cost_multiplier, tree_capital_cost_usd, climate_energy_regime (no source in any state)."
    json.dump(d, open(P, "w"), indent=2)
    open(P, "a").write("\n")
    print("\n".join(changed))
    from collections import Counter
    print(Counter(r["verification"]["status"] for r in d.values()))


if __name__ == "__main__":
    main()
