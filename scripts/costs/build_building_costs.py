#!/usr/bin/env python3
"""Build app/data/building_costs.json (displayable rows) + data/internal/building_costs_internal.json (display_allowed: false rows) and app/data/area_cost_factors.json from fetched official sources.

Sources (all fetched by this script into --cache, default /tmp/city-pretty-costs):
  * ICC Building Valuation Data, February 2026 edition, from two city copies (Albuquerque names the edition; Hermiston's
    table is identical, cell for cell). iccsafe.org itself now shows the table to ICC members only.
  * DoD Unified Facilities Supplement 3-701-01 (6 June 2026) data tables workbook: Table 4-1 area cost factors, Table 2 unit costs.
  * Terner Center (UC Berkeley) reports with stated cost and schedule figures for conventional and modular building.
  * LA ADU permit medians computed by scripts/costs/adu_permit_costs_la.py (run it first).

Every row's quote is checked against the fetched text before it is written (costlib.Source.check).
Usage: python3 scripts/costs/build_building_costs.py [--cache DIR]
"""
import json
import os
import re
import statistics
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from costlib import ROOT, TODAY, Source, dump, dump_split, fetch, html_text, norm, pdf_text  # noqa: E402

CACHE = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else "/tmp/city-pretty-costs"
DATA = os.path.join(ROOT, "app", "data")
TYPES = ["IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IV", "VA", "VB"]
FED_TERMS = "U.S. federal government publication; no reuse restriction appears in the fetched document. Separate licence text not fetched."


def src_pdf(name, url, publisher, edition, allowed, terms, layout=True):
    p = fetch(url, os.path.join(CACHE, name))
    return Source(name, url, p, pdf_text(p, layout), publisher, edition, allowed, terms)


def row(src, item, building_type, method, measure, value, unit, year, place, quote, extra=None, url=None, value_range=None):
    r = {"item": item, "building_type": building_type, "construction_method": method, "measure": measure, "value": value}
    if value_range:
        r["range"] = value_range
    r.update({"unit": unit, "year": year, "place": place, "source_url": url or src.url, "publisher": src.publisher, "edition": src.edition,
              "quote": src.check(quote), "verification": src.verification(), "display_allowed": src.display_allowed, "display_terms": src.display_terms})
    if extra:
        r.update(extra)
    return r


def main():
    rows = []
    # ---------------- a. ICC Building Valuation Data (February 2026) ----------------
    icc_terms = ("Internal use only: not displayed. ICC's Terms of Use say: 'no portion of the Services may be reprinted, republished, modified, publicly displayed, "
                 "publicly performed, or distributed in any form without Our express written permission', and the ICC page says 'This is an ICC member-exclusive benefit'. "
                 "These rows are cities' republished copies; ICC permission to display was not obtained.")
    cabq_url = "https://www.cabq.gov/mra/documents/appendix-b_building-valuation-2026.pdf"
    herm_url = "https://www.hermiston.gov/sites/default/files/fileattachments/community_development/page/2531/valuationdatatable2026.pdf"
    cabq = src_pdf("cabq_bvd_2026.pdf", cabq_url, "International Code Council (table republished by City of Albuquerque Metropolitan Redevelopment Agency, Appendix B)",
                   "ICC Building Valuation Data, February 2026 (named in the copy: 'Source: International Code Council, Building Valuation Data, February 2026')", False, icc_terms)
    herm = src_pdf("hermiston_bvd_2026.pdf", herm_url, "International Code Council (table republished by City of Hermiston, Oregon, 'Valuation table effective 4/1/2026')",
                   "ICC Building Valuation Data (copy dated 'effective 4/1/2026'; edition name not stated in this copy; numbers identical to the Albuquerque copy)", False, icc_terms)
    # parse Hermiston rows (one line per occupancy), cross-check every cell with Albuquerque
    herm_rows = {}
    for line in herm.text.splitlines():
        m = re.match(r"^\s*([A-Z]-?\d?\w*)\s+(.+?)\s{2,}((?:\S+\s+){8}\S+)\s*$", line)
        if m and re.match(r"^[\d.]+$", m.group(3).split()[0]):
            herm_rows[(m.group(1) + " " + m.group(2)).strip()] = m.group(3).split()
    cabq_nums = re.findall(r"((?:(?:\d{2,3}\.\d\d|N\.P\.)\s+){8}(?:\d{2,3}\.\d\d|N\.P\.))", cabq.text)
    herm_nums = [" ".join("N.P." if v == "0.00" else v for v in vals) for vals in herm_rows.values()]
    cabq_nums = [norm(x) for x in cabq_nums]
    assert len(herm_rows) == 27, len(herm_rows)
    assert herm_nums == cabq_nums[:27], "Hermiston and Albuquerque ICC tables differ"
    icc_cells = 0
    for label, vals in herm_rows.items():
        qline = norm(next(l for l in herm.text.splitlines() if l.strip().startswith(label.split()[0]) and vals[0] in l))
        for t, v in zip(TYPES, vals):
            if v == "0.00":
                continue  # ICC prints N.P. (not permitted) for this occupancy / construction type
            rows.append(row(herm, label, f"{label} / ICC construction type {t}", "conventional (ICC table is by code construction type, not by method)", "cost_per_sqft",
                            float(v), "USD per sq ft of gross floor area (national average)", 2026, "United States (national average; no regional adjustment)", qline,
                            {"icc_occupancy_group": label.split()[0], "icc_construction_type": t, "edition": cabq.edition, "same_values_in": cabq_url, "edition_named_in": cabq_url}))
            icc_cells += 1
    # the quote is the Hermiston one-line table row (it contains all nine values); edition proof is the Albuquerque note
    # ICC's own statements (member-only BSJ article text of the August 2020 edition; the 2026 edition's own text was not obtainable)
    bsj_url = "https://www.iccsafe.org/building-safety-journal/bsj-technical/building-valuation-data/"
    bsj_path = fetch(bsj_url, os.path.join(CACHE, "icc_bsj_bvd.html"))
    bsj = Source("icc_bsj_bvd.html", bsj_url, bsj_path, html_text(bsj_path), "International Code Council", "Building Valuation Data: August 2020 (article text on the ICC page)", False, icc_terms)
    stmts = [bsj.check(q) for q in (
        "The average costs include foundation work, structural and nonstructural building components, electrical, plumbing, mechanical and interior finish material.",
        "The data is a national average and does not take into account any regional cost differences.",
        "This data table is not intended to be used as an estimating guide because the data only reflects average costs and is not representative of specific construction.",
        "The BVD will be updated at six-month intervals")]
    terms_url = "https://www.iccsafe.org/terms-of-use/"
    tp = fetch(terms_url, os.path.join(CACHE, "icc_terms.html"))
    terms = Source("icc_terms.html", terms_url, tp, html_text(tp), "International Code Council", "Terms of Use (fetched " + TODAY + ")", False, icc_terms)
    bvdp = fetch("https://www.iccsafe.org/products-and-services/i-codes/code-development/building-valuation-data/", os.path.join(CACHE, "icc_bvd_page.html"))
    bvd = Source("icc_bvd_page.html", "https://www.iccsafe.org/products-and-services/i-codes/code-development/building-valuation-data/", bvdp, html_text(bvdp), "International Code Council", "BVD page (fetched " + TODAY + ")", False, icc_terms)
    icc_source = {
        "table": "ICC Building Valuation Data, February 2026: 27 occupancy groups x 9 construction types; 'N.P.' (not permitted) cells omitted",
        "primary_copy": cabq_url, "second_copy": herm_url, "copies_agree": "all 243 table cells identical (checked by this script)",
        "header_discrepancy": "The Albuquerque copy heads the table 'Group (2024 International Building Code)'; the Hermiston copy 'Group (2021 International Building Code)'. The numbers are identical.",
        "footnotes_in_copy": [cabq.check("b. For shell only buildings deduct 20 percent"), cabq.check("a. Private Garages use Utility, miscellaneous"), cabq.check("d. Unfinished basements (Group R-3) = $31.50 per sq. ft.")],
        "edition_statement": cabq.check("Source: International Code Council, Building Valuation Data, February 2026"),
        "latest_edition_note": "ICC updates the table every six months; an August 2026 edition may exist but no copy of it could be found (Irvine's 'effective August 15, 2026' page carries a REV 06/24 table). February 2026 is the latest obtained.",
        "icc_statements": stmts, "icc_statements_source": bsj_url,
        "icc_statements_caveat": "These statements are from ICC's August 2020 edition article; ICC's pages for the 2026 edition are members-only and could not be read.",
        "access": bvd.check("This is an ICC member-exclusive benefit"), "access_url": bvd.url,
        "reuse_terms_quote": terms.check("no portion of the Services may be reprinted, republished, modified, publicly displayed, publicly performed, or distributed in any form without Our express written permission"),
        "reuse_terms_url": terms_url,
        "display_decision": "internal use only: not displayed",
    }

    # ---------------- b. DoD area cost factors (UFS 3-701-01, 6 June 2026) ----------------
    ufs_url = "https://legacy.wbdg.org/FFC/DOD/UFC/ufs_3_701_01_06_2026.pdf"
    ufs = src_pdf("ufs_3_701_01_06_2026.pdf", ufs_url, "U.S. Department of Defense, Unified Facilities Supplement 3-701-01 'DoD Facilities Pricing Guide'",
                  "UFS 3-701-01, 6 June 2026 (survey conducted 2025; data tables dated Oct 2025 dollars)", True, "Document is marked 'APPROVED FOR PUBLIC RELEASE; DISTRIBUTION UNLIMITED'. " + FED_TERMS)
    ufs.check("APPROVED FOR PUBLIC RELEASE; DISTRIBUTION UNLIMITED")
    xl_url = "https://www.wbdg.org/FFC/DOD/UFC/ufs_3_701_01_2026_Data_Tables.xlsx"
    xl_path = fetch(xl_url, os.path.join(CACHE, "ufs_3_701_01_2026_Data_Tables.xlsx"))
    import openpyxl
    wb = openpyxl.load_workbook(xl_path, data_only=True)
    acf_sheet = list(wb["Table 4-1 CONUS"].iter_rows(min_row=2, values_only=True))
    acf_src = Source("ufs_data_tables.xlsx", xl_url, xl_path, "", ufs.publisher, "UFS 3-701-01 2026 Data Tables workbook, Table 4-1 CONUS (list dated 06-06-2026 on the WBDG page)", True, ufs.display_terms)
    locs = {}
    for r in acf_sheet:
        if r[12] is None:
            continue
        d = locs.setdefault((r[8], r[9], r[10]), {"state": r[8], "county": r[9], "city": r[10], "acf": set(), "sacf": set(), "sites": 0})
        d["acf"].add(r[12]); d["sacf"].add(r[13]); d["sites"] += 1
    loc_list = []
    for k in sorted(locs, key=lambda k: tuple(x or "" for x in k)):
        d = locs[k]
        loc_list.append({"state": d["state"], "county": d["county"], "city": d["city"], "area_cost_factor": min(d["acf"]) if len(d["acf"]) == 1 else sorted(d["acf"]),
                         "sustainment_acf": min(d["sacf"]) if len(d["sacf"]) == 1 else sorted(d["sacf"]), "sites": d["sites"]})
    dump(os.path.join(DATA, "area_cost_factors.json"), {
        "_source": {"dataset": "DoD Area Cost Factors, CONUS (UFS 3-701-01 Table 4-1)", "url": xl_url, "edition": acf_src.edition, "retrieved": TODAY,
                    "how_to_apply": ufs.check("Table 4-1 provides area cost factors (ACFs) to be used for adjusting “bare” unit costs to location-specific costs for the most common locations."),
                    "scaling": ufs.check("a final ACF that reflects the relative relationship of construction costs between that location and the 96-Base-City average as 1.00"), "application_limit": ufs.check("Do not use the MILCON ACFs to modify detailed quantity take-offs, unit price book (UPB) line items, commercial cost data, or user-generated unit costs."),
                    "data_source_statement": ufs.check("CONUS survey covered 213 locations that included 96 Base Cities (two per state in the continental U.S.)"),
                    "source_pdf": ufs_url, "source_pdf_sha256": ufs.sha256, "source_xlsx_sha256": acf_src.sha256,
                    "units": "area_cost_factor and sustainment_acf are multipliers; the 96-Base-City average = 1.00", "display_allowed": True, "display_terms": ufs.display_terms,
                    "place_count": len(loc_list), "raw_rows": len(acf_sheet)},
        "locations": loc_list}, compact=True)
    by_state = defaultdict(list)
    for r in acf_sheet:
        if r[12] is not None:
            by_state[r[8]].append(r)
    for st in sorted(by_state):
        rs = sorted(by_state[st], key=lambda r: r[12])
        lo, hi = rs[0], rs[-1]
        med = statistics.median(r[12] for r in rs)
        cell = lambda r: f"{r[8]} | {r[9]} | {r[10]} | {r[4]} | AREA COST FACTOR {r[12]}"
        rows.append({"item": f"DoD MILCON area cost factor, {st}", "building_type": "all facility types (bare unit cost multiplier)", "construction_method": "not method-specific", "measure": "factor",
                     "value": round(med, 3), "range": [lo[12], hi[12]], "unit": "multiplier on a national 'bare' cost; 96-Base-City average = 1.00", "year": 2026, "place": f"{st}: median of {len(rs)} DoD sites (range = lowest to highest site)",
                     "source_url": xl_url, "publisher": ufs.publisher, "edition": acf_src.edition,
                     "quote": f"LOWEST {cell(lo)} ; HIGHEST {cell(hi)}", "verification": {"status": "re-read_from_workbook", "method": "build script computed median/min/max from Table 4-1 CONUS rows; see app/data/area_cost_factors.json for every site",
                                                                                         "checked_on": TODAY, "source_file_sha256": acf_src.sha256},
                     "display_allowed": True, "display_terms": ufs.display_terms, "applies_with": "ICC / unit costs only as a rough scaler; the publisher says not to apply it to commercial cost data (see area_cost_factors.json _source.application_limit)"})
    t2 = {r[0]: r for r in wb["Table 2"].iter_rows(values_only=True) if r[0]}
    for key, label in (("BARRACKS / DORMITORY (does not include kitchenette equipment)", "DoD barracks / dormitory"), ("BARRACKS - STUDENT DORMS, ADVANCE TRAINING", "DoD student dorm")):
        r = t2[key]
        rows.append({"item": label, "building_type": "military unaccompanied personnel housing (not market housing)", "construction_method": "conventional (MILCON)", "measure": "cost_per_sqft",
                     "value": round(r[4], 2), "unit": "USD per gross sq ft, before area cost factor", "year": 2025, "place": "United States (DoD national average; apply Table 4-1 factor)",
                     "source_url": xl_url, "publisher": ufs.publisher, "edition": "UFS 3-701-01 2026 Data Tables, Table 2 ('Oct 2025 unit cost')",
                     "quote": f"{key} | reference size {r[3]} gross SF | ${r[4]:.2f}/SF | {r[7]} projects", "verification": {"status": "re-read_from_workbook", "method": "cell values copied from Table 2", "checked_on": TODAY, "source_file_sha256": acf_src.sha256},
                     "display_allowed": True, "display_terms": ufs.display_terms})

    # ---------------- f. Terner Center: conventional and modular ----------------
    terner_terms = "Reuse terms of the Terner Center site not fetched; hold for display until checked. Short attributed quotations only."
    def terner(name, url, edition):
        p = fetch(url, os.path.join(CACHE, name))
        return Source(name, url, p, pdf_text(p, layout=False), "Terner Center for Housing Innovation, UC Berkeley", edition, False, terner_terms)
    hard = terner("terner_hard_costs.pdf", "https://ternercenter.berkeley.edu/wp-content/uploads/2020/08/Hard_Construction_Costs_March_2020.pdf", "The Hard Costs of Construction, March 2020")
    modu = terner("terner_modular.pdf", "https://ternercenter.berkeley.edu/wp-content/uploads/pdfs/A.Stein_PR_Disruptive_Development_-_Modular_Manufacturing_in_Multifamily_Housing.pdf",
                  "Stein, Disruptive Development: Modular Manufacturing in Multifamily Housing (UC Berkeley master's professional report, 2016; interviews Feb-Apr 2016)")
    soca = terner("terner_socal.pdf", "https://ternercenter.berkeley.edu/wp-content/uploads/2022/01/Southern-California-Off-Site-Construction-February-2022.pdf", "Scaling Up Off-Site Construction in Southern California, February 2022")
    CA = "California (240 multifamily projects built 2009-2018, Terner dataset)"
    rows += [
        row(hard, "Multifamily hard construction cost, California average, 2008-2009", "multifamily (all types)", "conventional", "cost_per_sqft", 177, "USD per sq ft, 2018 dollars", 2009, CA,
            "In 2008-2009, hard costs averaged $177 per square foot. By 2018 that average had risen to $222 per square foot"),
        row(hard, "Multifamily hard construction cost, California average, 2018", "multifamily (all types)", "conventional", "cost_per_sqft", 222, "USD per sq ft, 2018 dollars", 2018, CA,
            "By 2018 that average had risen to $222 per square foot"),
        row(hard, "Multifamily hard construction cost, Bay Area, 2018", "multifamily (all types)", "conventional", "cost_per_sqft", 380, "USD per sq ft, 2018 dollars (report says 'more than $380')", 2018, "San Francisco Bay Area",
            "reaching more than $380 per square foot in 2018", {"value_is_lower_bound": True}),
        row(hard, "Los Angeles-region hard cost premium over the rest of California", "multifamily (all types)", "conventional", "cost_per_sqft", 35, "USD per sq ft more than rest of state (regression, controlling for project characteristics)", 2018, "Los Angeles region",
            "$35 more expensive per square foot in the Los Angeles region"),
        row(hard, "Bay Area hard cost premium over the rest of California", "multifamily (all types)", "conventional", "cost_per_sqft", 81, "USD per sq ft more than rest of state (regression, controlling for project characteristics)", 2018, "San Francisco Bay Area",
            "$81 more expensive per square foot in the Bay Area"),
        row(modu, "Total cost per SF, conventional vs modular: conventional", "multifamily", "conventional", "cost_per_sqft", None, "USD per sq ft ('Total Module Cost Per SF' row of the report's labor and material comparison)", 2016, "San Francisco Bay Area (contractor interview, Feb 2016)",
            "Total Module Cost Per SF $250-$275 $80-$100", {"note": "In the report's table the first range ($250-$275) is the Conventional Construction column and the second ($80-$100) the Modular Construction column; the modular figure is the cost of the module itself, not a finished building"}, value_range=[250, 275]),
        row(modu, "Total cost per SF, conventional vs modular: modular (module cost only)", "multifamily", "modular", "cost_per_sqft", None, "USD per sq ft of module (factory cost; excludes site work, foundations, transport, crane)", 2016, "San Francisco Bay Area (manufacturer interview, Apr 2016)",
            "Total Module Cost Per SF $250-$275 $80-$100", {"note": "interview-based; see conventional row"}, value_range=[80, 100]),
        row(modu, "Modular construction duration (Modular Building Institute study cited)", "multifamily", "modular", "months", 9.29, "months to build (average)", 2016, "United States (MBI study cited in the report)",
            "a modular project took an average of 9.29 months to build"),
        row(modu, "Conventional construction duration (same MBI study)", "multifamily", "conventional", "months", 16.86, "months to build (average, similar size and scale)", 2016, "United States (MBI study cited in the report)",
            "would take 16.86 months for conventional construction"),
        row(modu, "5830 Third Street, San Leandro/San Francisco: estimated stick-frame duration", "multifamily", "conventional", "months", 20, "months (developer estimate)", 2016, "5830 Third Street (project named in report)",
            "5830 Third Street 20 months 13 months", {"note": "paired with modular row"}),
        row(modu, "5830 Third Street: modular duration", "multifamily", "modular", "months", 13, "months (actual)", 2016, "5830 Third Street (project named in report)",
            "5830 Third Street 20 months 13 months"),
        row(modu, "Marea Alta: estimated stick-frame duration", "multifamily", "conventional", "months", 19, "months (estimate)", 2016, "Marea Alta, San Leandro",
            "Marea Alta 19 months 16 months"),
        row(modu, "Marea Alta: modular duration", "multifamily", "modular", "months", 16, "months (actual; includes a 3-month delay from late module delivery per the report's footnote)", 2016, "Marea Alta, San Leandro",
            "Marea Alta 19 months 16 months"),
        row(modu, "Anecdotal modular hard-cost saving claimed in the report's introduction", "multifamily", "modular", "factor", None, "percent saving on hard costs ('anecdotal claims')", 2016, "United States",
            "Anecdotal claims suggest that modular construction can save between 10-20% on hard costs", value_range=[0.10, 0.20]),
        row(soca, "Modular/off-site: expected reduction in construction schedule, Southern California affordable projects", "affordable and supportive multifamily", "modular / off-site", "factor", None,
            "fraction of schedule saved, breaking ground to occupancy (projects' expectations)", 2022, "Southern California", "The majority of projects expect 10-30 percent reduction in construction schedule", value_range=[0.10, 0.30]),
        row(soca, "Modular/off-site: cost compared with traditional construction, as estimated by interviewed stakeholders", "affordable and supportive multifamily", "modular / off-site", "factor", None,
            "fraction saved ('relative parity' for most respondents; 10-20 percent for others)", 2022, "Southern California",
            "Most respondents estimated relative parity in the costs of off-site methods and site-built approaches, with others estimating savings in the range of 10-20 percent", value_range=[0.0, 0.20]),
    ]

    # ---------------- f. LA ADU permit medians ----------------
    adu = json.load(open(os.path.join(DATA, "adu_permit_costs_la.json")))
    la_terms = "City of Los Angeles Open Data Portal terms (May 2014): 'Public data sets made available on the Site are provided for informational purposes'; no ban on display found. Valuations are applicants' declared values."
    la_url = "https://data.lacity.org/resource/pi9x-tg5x.json"
    labels = {"new_detached_or_attached_adu": "New-construction ADU (Bldg-New permit naming an ADU)", "conversion_adu": "ADU created by conversion or addition (Bldg-Alter/Repair or Bldg-Addition naming an ADU)",
              "junior_adu_conversion": "Junior ADU inside an existing home (junior_adu = 1)"}
    for g, v in adu["groups"].items():
        import urllib.parse
        q = la_url + "?" + urllib.parse.urlencode({"$select": adu["_source"]["select_fields"], "$where": v["soql_where"]})
        for y in v["by_issue_year"]:
            base = {"publisher": "City of Los Angeles, Department of Building and Safety (open data)", "edition": "dataset refreshed " + adu["_source"]["retrieved"] + "; permits issued in calendar year " + str(y["issue_year"]),
                    "source_url": q, "display_allowed": True, "display_terms": la_terms,
                    "verification": {"status": "computed_from_raw_permits", "method": f"scripts/costs/adu_permit_costs_la.py: median over {y['permits']} permits after square_footage 150-1200 and valuation > 0 filters ({v['rows_returned']} rows returned by the query for all years)", "checked_on": TODAY}}
            q1 = f"median valuation / square_footage over {y['permits']} permits issued in {y['issue_year']} (declared 'Estimated value of work to be done' / 'Square footage'); query kept in source_url"
            rows.append({"item": labels[g] + ": median declared cost per sq ft", "building_type": "accessory dwelling unit", "construction_method": "conventional (site-built; permit data does not say)", "measure": "cost_per_sqft",
                         "value": y["median_valuation_per_sqft"], "range": [y["p25_valuation_per_sqft"], y["p75_valuation_per_sqft"]], "unit": "USD per sq ft, declared permit valuation (25th-75th percentile range); not a bid or final cost", "year": y["issue_year"],
                         "place": "Los Angeles, CA (city)", "quote": q1, **base})
            rows.append({"item": labels[g] + ": median declared cost per unit", "building_type": "accessory dwelling unit", "construction_method": "conventional (site-built; permit data does not say)", "measure": "cost_per_unit",
                         "value": y["median_valuation"], "unit": f"USD per ADU, declared permit valuation (median size {y['median_sqft']} sq ft)", "year": y["issue_year"], "place": "Los Angeles, CA (city)",
                         "quote": f"median of declared valuation over {y['permits']} permits issued in {y['issue_year']}; query kept in source_url", **base})

    out = {"_source": {"purpose": "Free, citable construction cost figures for pricing courses of action (ADU, small multifamily, station-area building, conventional vs prefabricated). Data only; not wired into the engine or page.",
                       "built": TODAY, "builder": "scripts/costs/build_building_costs.py", "icc": icc_source,
                       "schema": "item, building_type, construction_method, measure (cost_per_sqft | cost_per_unit | factor | months), value or range, unit, year, place, source_url, quote, verification, display_allowed (+display_terms)",
                       "display_rule": "Rows with display_allowed=false are internal use only: not displayed.",
                       "row_counts": {"icc_bvd": icc_cells}},
           "rows": rows}
    out["_source"]["row_counts"]["total"] = len(rows)
    dump_split("building_costs", out)


if __name__ == "__main__":
    main()
