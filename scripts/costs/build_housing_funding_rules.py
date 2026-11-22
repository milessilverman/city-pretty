#!/usr/bin/env python3
"""Build app/data/housing_funding_rules.json (displayable rows) + data/internal/housing_funding_rules_internal.json (display_allowed: false rows): public-money rules and cost limits for affordable housing, from fetched sources.

Parts: LIHTC statute (26 U.S.C. 42), IRS monthly percentages and the 2026 state ceiling, the 2027 DDA/QCT designation
notice, HUD's 2026 statutory mortgage limits and high cost percentages, HOME per-unit subsidy limits, one state agency's
hard-cost-per-unit factors (Florida Housing) and cost-rule percentages (Pennsylvania), and one dated equity-price survey.
Every quote is checked against the fetched text before it is written (costlib.Source.check).

Usage: python3 scripts/costs/build_housing_funding_rules.py [--cache DIR]
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from costlib import ROOT, TODAY, Source, dump, dump_split, fetch, html_text, norm, pdf_text, sha256  # noqa: E402

CACHE = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else "/tmp/city-pretty-costs"
FED = "U.S. federal government publication; no reuse restriction appears in the fetched document. Separate licence text not fetched."
ROWS = []


def pdf(name, url, publisher, edition, allowed=True, terms=FED, layout=True):
    p = fetch(url, os.path.join(CACHE, name))
    return Source(name, url, p, pdf_text(p, layout), publisher, edition, allowed, terms)


def add(src, programme, jurisdiction, what, measure, value, unit, year, quote, extra=None, section=None, url=None):
    r = {"section": section, "programme": programme, "jurisdiction": jurisdiction, "what_it_funds_or_limits": what, "measure": measure, "value": value, "unit": unit, "year": year,
         "source_url": url or src.url, "publisher": src.publisher, "edition": src.edition, "quote": src.check(quote), "verification": src.verification(),
         "display_allowed": src.display_allowed, "display_terms": src.display_terms}
    if extra:
        r.update(extra)
    ROWS.append(r)


def grab(src, pattern):
    m = re.search(pattern, src.ntext)
    if not m:
        raise ValueError(f"pattern not found in {src.name}: {pattern}")
    return m.group(0)


def main():
    # ---------------- e. LIHTC: statute ----------------
    usc_url = "https://www.law.cornell.edu/uscode/text/26/42"
    up = fetch(usc_url, os.path.join(CACHE, "usc42.html"))
    usc = Source("usc42.html", usc_url, up, html_text(up), "U.S. Code, Title 26 section 42 (text as shown by Cornell Legal Information Institute; includes Pub. L. 119-21 amendments)",
                 "26 U.S.C. 42 as fetched " + TODAY, True, "Federal statute. Page copy is Cornell LII's; LII's own reuse terms were not fetched.")
    L = "Low-Income Housing Tax Credit (federal)"
    US = "United States"
    add(usc, L, US, "Credit amount each year = applicable percentage x qualified basis, over the credit period", "rule", "annual credit = applicable percentage x qualified basis of each qualified low-income building", "text", "current",
        "the amount of the low-income housing credit determined under this section for any taxable year in the credit period shall be an amount equal to— (1) the applicable percentage of (2) the qualified basis of each qualified low-income building", section="lihtc_law")
    add(usc, L, US, "Present-value targets behind the monthly percentages (10-year credit stream)", "rule", {"new_not_federally_subsidized": 0.70, "other": 0.30}, "share of qualified basis, as present value over 10 years", "current",
        "(i) 70 percent of the qualified basis of a new building which is not federally subsidized for the taxable year, and (ii) 30 percent of the qualified basis of a building not described in clause (i).", section="lihtc_law")
    add(usc, L, US, "9 percent credit floor: new building, not federally subsidized", "applicable_percentage_floor", 0.09, "fraction of qualified basis per year", "current",
        "(B) which is not federally subsidized for the taxable year, the applicable percentage shall not be less than 9 percent.", section="lihtc_law")
    add(usc, L, US, "4 percent credit floor: other buildings placed in service after 31 Dec 2020", "applicable_percentage_floor", 0.04, "fraction of qualified basis per year", "current",
        "which is placed in service by the taxpayer after December 31, 2020 , the applicable percentage shall not be less than 4 percent.", section="lihtc_law")
    add(usc, L, US, "Basis boost: 130 percent of eligible basis in a qualified census tract or difficult development area (new building)", "eligible_basis_multiplier", 1.30, "x eligible basis", "current",
        "the eligible basis of such building shall be 130 percent of such basis determined without regard to this subparagraph", section="lihtc_basis_boost")
    add(usc, L, US, "Definition of difficult development area", "rule", "area designated by HUD with high construction, land and utility costs relative to area median gross income; designated portions limited to 20 percent of metro population", "text", "current",
        "any area designated by the Secretary of Housing and Urban Development as an area which has high construction, land, and utility costs relative to area median gross income", section="lihtc_basis_boost")
    add(usc, L, US, "Definition of qualified census tract", "rule", "tract where 50 percent or more of households are under 60 percent of area median income, or poverty rate is at least 25 percent", "text", "current",
        "either in which 50 percent or more of the households have an income which is less than 60 percent of the area median gross income for such year or which has a poverty rate of at least 25 percent", section="lihtc_basis_boost")
    add(usc, L, US, "Set-aside: 20 percent of units at 50 percent of area median income", "min_set_aside", {"share_of_units": 0.20, "income_limit_pct_ami": 50}, "fraction of units; % of area median gross income", "current",
        "20 percent or more of the residential units in such project are both rent-restricted and occupied by individuals whose income is 50 percent or less of area median gross income.", section="lihtc_set_aside")
    add(usc, L, US, "Set-aside: 40 percent of units at 60 percent of area median income", "min_set_aside", {"share_of_units": 0.40, "income_limit_pct_ami": 60}, "fraction of units; % of area median gross income", "current",
        "40 percent or more of the residential units in such project are both rent-restricted and occupied by individuals whose income is 60 percent or less of area median gross income.", section="lihtc_set_aside")
    add(usc, L, US, "Set-aside: average income test (average of designated limits at most 60 percent; limits in 10-point steps from 20 to 80)", "min_set_aside", {"average_ami_max_pct": 60, "allowed_limits_pct_ami": [20, 30, 40, 50, 60, 70, 80]}, "% of area median gross income", "current",
        "The average of the imputed income limitations designated under subclause (I) shall not exceed 60 percent of area median gross income.", section="lihtc_set_aside",
        extra={"second_quote": usc.check("shall be 20 percent, 30 percent, 40 percent, 50 percent, 60 percent, 70 percent, or 80 percent of area median gross income")})
    add(usc, L, US, "Maximum rent: gross rent at most 30 percent of the imputed income limitation", "max_rent_share", 0.30, "fraction of the income limitation (monthly = annual x 0.30 / 12)", "current",
        "a residential unit is rent-restricted if the gross rent with respect to such unit does not exceed 30 percent of the imputed income limitation applicable to such unit.", section="lihtc_set_aside")
    add(usc, L, US, "State credit ceiling formula: greater of $1.75 per resident or $2,000,000 (inflation-indexed; see IRS row)", "state_ceiling_formula", {"per_capita_statutory_base": 1.75, "small_state_minimum_statutory_base": 2000000}, "USD per resident; USD", "statutory base",
        "(ii) the greater of— (I) $1.75 multiplied by the State population, or (II) $2,000,000,", section="lihtc_state_ceiling")
    add(usc, L, US, "Tax-exempt bond (4 percent) test: volume-cap bonds must finance 50 percent of basis, or 25 percent for issues after 31 Dec 2025", "bond_financing_test", {"basis_share_old": 0.50, "basis_share_new": 0.25},
        "share of aggregate basis of building and land financed by volume-cap obligations", "current",
        "(i) 50 percent or more of the aggregate basis of such building and the land on which the building is located is financed by 1 or more obligations described in subparagraph (A)", section="lihtc_bonds",
        extra={"second_quote": usc.check("(ii) (I) 25 percent or more of the aggregate basis of such building and the land on which the building is located is financed by 1 or more obligations described in subparagraph (A), and (II) 1 or more of such obligations— (aa) are part of an issue the issue date of which is after December 31, 2025")})

    # ---------------- e. IRS: 2026 state ceiling, monthly percentages ----------------
    rp = pdf("rp-25-32.pdf", "https://www.eitc.irs.gov/pub/irs-drop/rp-25-32.pdf", "Internal Revenue Service, Rev. Proc. 2025-32", "Rev. Proc. 2025-32 (as fetched; shows $3.416, i.e. after the October 2025 correction)")
    add(rp, L, US, "State housing credit ceiling for calendar year 2026: per resident amount", "state_ceiling_per_capita", 3.416, "USD per State resident", 2026,
        "For calendar year 2026, the amount used under § 42(h)(3)(C)(ii) to calculate the State housing credit ceiling for the low-income housing credit is the greater of (1) $3.416 multiplied by the State population, or (2) $3,953,600.", section="lihtc_state_ceiling")
    add(rp, L, US, "State housing credit ceiling for calendar year 2026: small-state minimum", "state_ceiling_minimum", 3953600, "USD per State", 2026,
        "the greater of (1) $3.416 multiplied by the State population, or (2) $3,953,600.", section="lihtc_state_ceiling")
    for n, month in (("21", "November 2026"), ("24", "December 2026")):
        rr = pdf(f"rr-26-{n}.pdf", f"https://www.irs.gov/pub/irs-drop/rr-26-{n}.pdf", f"Internal Revenue Service, Rev. Rul. 2026-{n}", f"Rev. Rul. 2026-{n} (percentages for buildings placed in service in {month})")
        p70 = float(re.search(r"70% present value low-income housing credit (\d\.\d\d)%", rr.ntext).group(1))
        p30 = float(re.search(r"30% present value low-income housing credit (\d\.\d\d)%", rr.ntext).group(1))
        add(rr, L, US, f"Appropriate percentage, 70% present value credit, {month} (the 9% floor applies to new buildings not federally subsidized)", "appropriate_percentage", p70, "percent per year", month,
            f"Appropriate percentage for the 70% present value low-income housing credit {p70:.2f}%", section="lihtc_monthly_rates")
        add(rr, L, US, f"Appropriate percentage, 30% present value credit, {month} (the 4% floor applies)", "appropriate_percentage", p30, "percent per year", month,
            f"Appropriate percentage for the 30% present value low-income housing credit {p30:.2f}%", section="lihtc_monthly_rates")
    # DDA / QCT
    dda = pdf("fr_2026_20390.pdf", "https://www.govinfo.gov/content/pkg/FR-2026-10-06/pdf/2026-20390.pdf", "HUD, Federal Register 2026-20390 (6 Oct 2026)", "Statutorily Mandated Designation of Difficult Development Areas and Qualified Census Tracts for 2027", layout=False)
    add(dda, L, US, "2027 DDA and QCT lists: effective for allocations of credit after 31 Dec 2026", "designation_effective_date", "2027-01-01 (allocations after 31 Dec 2026)", "date", 2027,
        "The 2027 lists of QCTs and DDAs are effective: (1) for allocations of credit after December 31, 2026", section="lihtc_basis_boost",
        extra={"download_page": "https://www.huduser.gov/portal/datasets/qct.html", "download_page_note": "HUD's list download page returned an empty body to this machine (HTTP 202), so file names could not be read; a search result named qct_data_2027.xlsx, not confirmed by fetch"})

    # ---------------- c. HUD FHA statutory limits (6 May 2026 notice) ----------------
    fr = pdf("fr_2026_08795.pdf", "https://www.govinfo.gov/content/pkg/FR-2026-05-06/pdf/2026-08795.pdf", "HUD, Federal Register 2026-08795 (6 May 2026)",
             "Annual Indexing of Basic Statutory Mortgage Limits for Multifamily Housing Programs, Calendar Year 2026, effective 1 Jan 2026", layout=False)
    fr.check("The adjustments are effective January 1, 2026.")
    blocks = [
        ("Section 207 / 223(f) / 220 (urban renewal)", ["$68,733 76,138", "90,947 112,100 126,909"], ["$80,170 88,832", "108,925 136,424 154,259"], "SECTION 220—HOUSING IN URBAN RENEWAL AREAS"),
        ("Section 213 cooperatives", ["$74,487 85,886 103,582 132,587 147,711"], ["$79,314 89,860 109,270 141,362 155,175"], "SECTION 213—COOPERATIVES"),
        ("Section 234 condominium", ["$76,007 87,640 105,696 135,295 150,725"], ["$79,989 91,695 111,504 144,251 158,341"], "SECTION 234—CONDOMINIUM HOUSING"),
        ("Section 221(d)(4) moderate income", ["$68,401 77,649 93,859 117,808 133,121"], ["$73,889 84,706 103,004 133,252 146,274"], "SECTION 221(D)(4)—MODERATE INCOME HOUSING"),
        ("Section 231 elderly", ["$65,032 72,702 86,818 104,483 122,838"], ["$73,889 84,706 103,004 133,252 146,274"], "SECTION 231—HOUSING FOR THE ELDERLY"),
    ]
    beds = ["0", "1", "2", "3", "4+"]
    fha_limits = {}
    for name, nonel, elev, hdr in blocks:
        fr.check(hdr)
        for kind, runs in (("non-elevator", nonel), ("elevator", elev)):
            vals = [int(v.replace("$", "").replace(",", "")) for run in runs for v in run.split()]
            assert len(vals) == 5, (name, kind, vals)
            for b, v, in zip(beds, vals):
                run = next(r for r in runs if f"{v:,}" in r.replace("$", ""))
                add(fr, "FHA multifamily mortgage insurance", US, f"Basic statutory per-unit mortgage limit, {name}, {kind}, {b} bedroom(s); high cost percentage (below) multiplies it in high-cost areas", "basic_statutory_mortgage_limit", v,
                    "USD per unit", 2026, run, extra={"bedrooms": b, "building_type": kind, "program_section": name, "table_header_in_notice": hdr}, section="hud_fha_statutory_limits")
                fha_limits.setdefault(name, {}).setdefault(kind, {})[b] = v
    add(fr, "FHA multifamily mortgage insurance", US, "Section 207 manufactured home parks, per space", "basic_statutory_mortgage_limit", 31553, "USD per space", 2026,
        grab(fr, r"Per Space \.+ \$31,553"), section="hud_fha_statutory_limits")
    # high cost percentages (Mortgagee Letter 2026-05)
    hcp = pdf("ml_2026_05.pdf", "https://www.hud.gov/sites/default/files/hudclips/documents/2026-05hsgml.pdf", "HUD Office of Housing, Mortgagee Letter 2026-05 (20 May 2026)",
              "Annual Revisions to Base City High Cost Percentage and High Cost Areas, effective 1 Jan 2026 (Table 1)")
    hcp.check("The designated Annual Base City High Cost Percentages and High Cost Areas are effective January 1, 2026")
    hcp_instruction = hcp.check("If only one geographic area is named in a given state, that area’s HCP is to be used for all localities within the state.")
    n_hcp = 0
    for line in hcp.text.splitlines():
        m = re.match(r"^\s*(.+?)\s{2,}(\d{3})%\s+(Yes|n/a – Special Limit)", line)
        if m:
            area = norm(m.group(1))
            add(hcp, "FHA multifamily mortgage insurance", area, "Base city high cost percentage: multiplies the basic statutory limit in this area", "high_cost_percentage", int(m.group(2)) / 100, "multiplier on the basic statutory per-unit limit", 2026,
                norm(line), extra={"waiver_to_315_pct_eligible": m.group(3) == "Yes", "special_limit_area": m.group(3) != "Yes"}, section="hud_high_cost_percentages")
            n_hcp += 1
    add(hcp, "FHA multifamily mortgage insurance", "Dallas / Ft. Worth TX", "Base city high cost percentage (name wraps onto two lines in the table)", "high_cost_percentage", 2.70, "multiplier", 2026,
        "Dallas / Ft. Worth TX – Southwest Regional", extra={"quote_part_2": hcp.check("Center 270%")}, section="hud_high_cost_percentages")
    n_hcp += 1

    # ---------------- c. HOME per-unit subsidy limits ----------------
    home = pdf("fr_2026_06926.pdf", "https://www.govinfo.gov/content/pkg/FR-2026-04-10/pdf/2026-06926.pdf", "HUD CPD, Federal Register 2026-06926 (10 Apr 2026)",
               "HOME Investment Partnerships Program: Maximum Per-Unit Subsidy Limit Methodology and Amount; Notice for Comment (limits are headed '2025' in the notice; comment period closed 11 May 2026)", layout=False)
    method = home.check("HUD is establishing the maximum per-unit subsidy limit for the HOME program as 240 percent of the basic mortgage limitations for section 234 of the National Housing Act’s condominium housing limit for elevator-type projects.")
    lim = [187658, 215122, 261595, 338419, 371477]
    for b, v in zip(["0", "1", "2", "3", "4"], lim):
        add(home, "HOME Investment Partnerships", US, f"Maximum HOME subsidy per unit, {b}{'+' if b == '4' else ''} bedroom(s) (= 240% of the Section 234 elevator limit)", "max_per_unit_subsidy", v, "USD per unit", "notice headed 2025; published 2026-04-10",
            "$187,658 215,122 261,595 338,419 371,477", extra={"bedrooms": b, "methodology": method}, section="home_per_unit_limits")

    # ---------------- c. state agency cost data ----------------
    fl_url = "https://www.floridahousing.org/docs/default-source/programs/developers-multifamily-programs/competitive/total-development-cost-per-unit-limitation-template-effective-september-30-2026-for-all-rfa-s-starting-july-2023.xlsx"
    flp = fetch(fl_url + "?Status=Master&sfvrsn=e66bcf7b_19", os.path.join(CACHE, "fl_tdc_template.xlsx"))
    import openpyxl
    import warnings
    warnings.simplefilter("ignore")
    ws = openpyxl.load_workbook(flp, data_only=True)["Data"]
    fl_src = Source("fl_tdc_template.xlsx", fl_url, flp, "", "Florida Housing Finance Corporation", "TDC Limitation Test Template, version 09-30-2026 (sheet 'Data', block 'Hard Cost Per Unit Factor')", False,
                    "Florida state agency publication on its public site; reuse terms not fetched, so not marked displayable.")
    assert ws["EG6"].value == "Hard Cost Per Unit Factor:"
    from openpyxl.utils import column_index_from_string as CI
    for r in range(9, 16):
        btype = ws.cell(r, CI("EG")).value
        for c in range(CI("EH"), CI("EO") + 1):
            cycle, bmp, v = ws.cell(7, c).value, ws.cell(8, c).value, ws.cell(r, c).value
            ROWS.append({"section": "state_hard_cost_per_unit", "programme": "Florida Housing competitive RFAs (9% credits, SAIL): total development cost limit input", "jurisdiction": "Florida",
                         "what_it_funds_or_limits": f"Hard cost per unit factor used to build the TDC limit: {btype}, {bmp}, RFA cycle {cycle}", "measure": "cost_per_unit", "value": v, "unit": "USD per unit (hard cost factor, new construction unless '(Rehab)')",
                         "year": cycle, "source_url": fl_url, "publisher": fl_src.publisher, "edition": fl_src.edition, "quote": f"{btype} | {cycle} | {bmp} | {v}",
                         "verification": {"status": "re-read_from_workbook", "method": "cells EG9:EO15 with headers rows 7-8 of sheet Data", "checked_on": TODAY, "source_file_sha256": sha256(flp)},
                         "display_allowed": False, "display_terms": fl_src.display_terms,
                         "note": "'BMP' is the template's own column label; its meaning is not defined in the cells read. The full limit also applies geographic multipliers, add-ons and a soft cost factor (see the workbook)."})
    ph = pdf("phfa_dev_cost_limits.pdf", "https://www.phfa.org/forms/multifamily_application_guidelines/application/2025-2026-mai-07.pdf", "Pennsylvania Housing Finance Agency", "2025 Underwriting Application, Development Cost Limits (revised 1-17-25)", False,
             "Pennsylvania state agency publication on its public site; reuse terms not fetched, so not marked displayable.")
    for what, pat, v in (("General requirements cap, share of hard construction cost", r"General Requirements will be limited to 6% of hard construction costs", 0.06),
                         ("Builder's overhead cap, share of hard cost (excluding general requirements)", r"is limited to 2% of the hard construction costs", 0.02),
                         ("Builder's profit cap, share of hard cost (excluding general requirements)", r"Builder's Profit is limited to 6% of the hard construction costs", 0.06),
                         ("Construction contingency, new construction (share of improvement cost)", r"5% of improvement cost for new construction developments", 0.05),
                         ("Construction contingency, rehabilitation (share of improvement cost)", r"10% of improvement cost for rehabilitation and preservation developments", 0.10)):
        add(ph, "PHFA tax credit and agency-financed developments", "Pennsylvania", what, "factor", v, "fraction", 2025, grab(ph, pat), section="state_cost_rules")

    # ---------------- e. equity pricing (a dated named survey) ----------------
    tca = pdf("tca_nov2026.pdf", "https://www.taxcreditadvisor.com/wp-content/uploads/2026/11/TCA-Housing-Tax-Credit-Monitor_November_2026_final.pdf", "CohnReznick / Tax Credit Advisor, TCA Housing Tax Credit Monitor",
              "November 2026 issue; survey period August-September 2026", False, "Trade-press PDF from a private firm; reuse terms not fetched, so not marked displayable.", layout=False)
    add(tca, L, US, "Median housing credit net equity price, surveyed deals, Aug-Sep 2026 (investor price per $1 of credit; the report does not split 9% from 4% in the text read)", "equity_price", 0.827, "USD per $1 of credit (net equity price)", "August-September 2026",
        "The median housing credit net equity price remains depressed at $0.827 for the August-September 2026 period.", section="lihtc_equity_price")

    src_info = {
        "built": TODAY, "builder": "scripts/costs/build_housing_funding_rules.py",
        "scope": "LIHTC law and published guidance; HUD FHA multifamily statutory limits and high cost percentages (2026); HOME per-unit subsidy limits; Florida Housing hard-cost factors; PHFA cost-rule percentages; one dated equity-price survey.",
        "high_cost_percentage_instruction": hcp_instruction,
        "hcp_note": "HUD's notice says HOME limits must not be self-computed from HCPs: HUD tells participating jurisdictions to ask their CPD field office (HUD web page not fetchable from here; statement seen only in a search result, so not quoted).",
        "not_obtained": [
            "State housing finance agency total-development-cost limits per unit for most of the 15 most populous states: California (CTCAC memo URL from search returned HTTP 404), Texas, New York, Illinois (cost limits sit in an Underwriting Standards Guide whose URL returned 404), Ohio, Georgia (QAP points to a Cost Limits Workbook not fetched), North Carolina, Michigan, New Jersey, Virginia (Code says limits are set annually by the authority; no table in the Code), Washington, Arizona, Massachusetts.",
            "4 percent credit equity price: no dated figure found in a primary or named survey.",
            "State housing tax credits, trust funds and property-tax exemptions for the 15 states (research prompt 6): not attempted here.",
        ],
        "row_counts": {},
    }
    counts = {}
    for r in ROWS:
        counts[r["section"]] = counts.get(r["section"], 0) + 1
    src_info["row_counts"] = {**counts, "total": len(ROWS)}
    dump_split("housing_funding_rules", {"_source": src_info, "rows": ROWS})


if __name__ == "__main__":
    main()
