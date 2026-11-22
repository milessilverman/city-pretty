#!/usr/bin/env python3
"""Add Census Building Permits Survey rows to app/data/building_costs.json: the declared construction value per new home
in buildings with 5 or more units, by county and year (permits issued that year, "Reported Data" columns).

Value per home = 5+ units reported valuation / 5+ units reported units, from the Census county annual file. Census
defines the valuation as "the estimated value of the residential structure as shown on the building permit" (the
definitions page, quoted in each row); it is not a development cost (no land, fees, financing or site work).

Idempotent: rows with source_key "census_bps_county" are replaced on every run, other rows are kept. Run it after
scripts/costs/build_building_costs.py, which rewrites the file without these rows.

Counties: those with a station-area site file and those that hold a site's point (app/data/hud_qct_dda.json).
Inputs: co<YYYY>a.txt files downloaded from https://www2.census.gov/econ/bps/County/ and the definitions page
https://www.census.gov/construction/bps/definitions.html saved as definitions.html, in <dl>.
Usage: python3 -I scripts/costs/add_bps_permit_values.py <dl> [years...]   (default years 2023 2024 2025)
"""
import csv
import hashlib
import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "app", "data", "building_costs.json")
BPS = "https://www2.census.gov/econ/bps/County/co{y}a.txt"
DEF_URL = "https://www.census.gov/construction/bps/definitions.html"
DEF_QUOTE = "Valuation - The valuation is the estimated value of the residential structure as shown on the building permit. If no value is listed on the permit, we accept estimates from the permit official."
REP_QUOTE = "Data labeled as \"Reported Data\" include the data reported from the respondent or from the Census Bureau's Survey of Construction (SOC) but exclude imputed data."
STATE = {"04": "AZ", "06": "CA", "08": "CO", "11": "DC", "12": "FL", "13": "GA", "17": "IL", "18": "IN", "22": "LA", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "29": "MO",
         "32": "NV", "34": "NJ", "36": "NY", "37": "NC", "39": "OH", "41": "OR", "42": "PA", "47": "TN", "48": "TX", "53": "WA", "55": "WI"}


def norm(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


def main():
    dl = sys.argv[1]
    years = [a for a in sys.argv[2:]] or ["2023", "2024", "2025"]
    today = date.today().isoformat()
    defs = norm(open(os.path.join(dl, "definitions.html"), encoding="utf-8", errors="replace").read())
    for q in (DEF_QUOTE, REP_QUOTE):
        if q not in defs:
            sys.exit("quote not found in the definitions page: " + q[:60])
    def_sha = hashlib.sha256(open(os.path.join(dl, "definitions.html"), "rb").read()).hexdigest()
    counties = set(json.load(open(os.path.join(ROOT, "app", "data", "station_sites", "index.json")))["counties"].keys())
    qd = os.path.join(ROOT, "app", "data", "hud_qct_dda.json")
    if os.path.exists(qd):
        counties |= {t[:5] for t in json.load(open(qd))["tracts"]}
    rows, missing = [], []
    for y in years:
        p = os.path.join(dl, f"co{y}a.txt")
        raw = open(p, encoding="latin-1").read()
        sh = hashlib.sha256(raw.encode("latin-1")).hexdigest()
        lines = raw.splitlines()
        if not lines[0].startswith("Survey,FIPS,FIPS") or "5+units rep" not in lines[0].replace(" 5+units rep", "5+units rep"):
            sys.exit(f"unexpected header in {p}")
        found = set()
        for line in lines[2:]:
            f = next(csv.reader([line]))
            if len(f) < 30 or not f[1].strip().isdigit():
                continue
            fips = f[1].strip().zfill(2) + f[2].strip().zfill(3)
            if fips not in counties:
                continue
            found.add(fips)
            name = f[5].strip()
            b5, u5, v5 = int(f[27]), int(f[28]), int(f[29])   # 5+ units, Reported Data: buildings, units, value
            if u5 <= 0 or v5 <= 0:
                missing.append({"fips": fips, "year": y, "reason": f"no 5+ unit homes with a reported valuation in {y} (reported buildings {b5}, units {u5}, value {v5})"})
                continue
            st = STATE.get(fips[:2], "")
            rows.append({"item": f"Census Building Permits Survey: declared construction value per new home, buildings with 5 or more units, {name}, {st} ({y})",
                         "building_type": "multifamily (buildings with 5 or more units)", "construction_method": "not stated on the permit (site-built and prefabricated are not separated)",
                         "measure": "cost_per_unit", "value": round(v5 / u5), "unit": "USD per home, declared permit valuation of the structure (no land, fees, financing or site work)",
                         "year": int(y), "place": f"{name}, {st} (county FIPS {fips}); permits issued in {y}", "county_fips": fips,
                         "homes": u5, "buildings": b5, "valuation_total": v5,
                         "source_url": BPS.format(y=y), "publisher": "U.S. Census Bureau, Building Permits Survey (county annual file)",
                         "edition": f"co{y}a.txt, columns '5+units rep' (Reported Data: Bldgs, Units, Value)",
                         "quote": line.strip(), "quote_note": "the county's line of the file, verbatim; 5+ units Reported Data are the last three numbers (buildings, units, value)",
                         "definition_url": DEF_URL, "definition_quote": DEF_QUOTE, "reported_data_quote": REP_QUOTE,
                         "verification": {"status": "re-read_from_file", "method": "scripts/costs/add_bps_permit_values.py parses the line and divides value by units; the definitions page quotes are matched in the fetched page",
                                          "checked_on": today, "source_file_sha256": sh, "definition_page_sha256": def_sha},
                         "display_allowed": True, "display_terms": "U.S. Census Bureau statistical release (federal government work); no reuse restriction appears in the fetched file or page. Separate licence text not fetched.",
                         "source_key": "census_bps_county"})
        for c in sorted(counties - found):
            missing.append({"fips": c, "year": y, "reason": "county not in the file"})
    d = json.load(open(OUT))
    d["rows"] = [r for r in d["rows"] if r.get("source_key") != "census_bps_county"] + rows
    d["_source"]["census_bps_county"] = {"added_by": "scripts/costs/add_bps_permit_values.py (run after build_building_costs.py)", "added": today, "years": years,
                                         "counties": len(counties), "rows": len(rows), "not_added": missing,
                                         "what_it_is": "declared construction value of the structure on building permits, per new home, buildings with 5 or more units; not a development cost"}
    rc = d["_source"].get("row_counts", {})
    rc["total"] = len(d["rows"])
    rc["census_bps_county"] = len(rows)
    d["_source"]["row_counts"] = rc
    json.dump(d, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(rows)} rows; {len(missing)} county-years without a row", file=sys.stderr)


if __name__ == "__main__":
    main()
