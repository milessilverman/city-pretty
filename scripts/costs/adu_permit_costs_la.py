#!/usr/bin/env python3
"""Accessory dwelling unit (ADU) permit valuations from City of Los Angeles open data, medians by issue year.

Source: "Building and Safety - Building Permits Issued from 2020 to Present (N)", Socrata dataset pi9x-tg5x,
https://data.lacity.org/resource/pi9x-tg5x.json . Each row is one permit with the applicant's declared valuation
("Estimated value of work to be done") and square footage ("Square footage"). Declared valuation is a permit
valuation, not a contractor bid or a final cost; it often leaves out land, fees, utility connections and site work.

Selection (kept verbatim in the output file so the query can be rerun):
  new_detached_or_attached_adu : permit_type = 'Bldg-New', permit_sub_type = '1 or 2 Family Dwelling', work_desc names an ADU
  conversion_adu               : permit_type in ('Bldg-Alter/Repair','Bldg-Addition'), junior_adu not 1, work_desc names an ADU
  junior_adu_conversion        : junior_adu = '1' (HCD "JADU": inside the existing home, 500 sq ft max by state law)
and valuation present (> 0 applied after download), 150 <= square_footage <= 1200, issue_date not null. Medians use the raw rows; nothing is edited.

Usage: python3 scripts/costs/adu_permit_costs_la.py [raw_dir]   -> writes app/data/adu_permit_costs_la.json
"""
import csv
import json
import os
import statistics
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "app", "data", "adu_permit_costs_la.json")
BASE = "https://data.lacity.org/resource/pi9x-tg5x.json"
ADU_WHERE = "(upper(work_desc) like '%ADU%' OR upper(work_desc) like '%ACCESSORY DWELLING%')"
COMMON = "valuation IS NOT NULL AND issue_date IS NOT NULL AND square_footage IS NOT NULL"
GROUPS = {
    "new_detached_or_attached_adu": f"permit_type = 'Bldg-New' AND permit_sub_type = '1 or 2 Family Dwelling' AND {ADU_WHERE} AND {COMMON}",
    "conversion_adu": f"permit_type in ('Bldg-Alter/Repair','Bldg-Addition') AND (junior_adu IS NULL OR junior_adu != '1') AND {ADU_WHERE} AND {COMMON}",
    "junior_adu_conversion": f"junior_adu = '1' AND {COMMON}",
}
FIELDS = "permit_nbr,permit_type,permit_sub_type,issue_date,square_footage,valuation,junior_adu,work_desc,construction"


def fetch(where):
    rows, offset = [], 0
    while True:
        q = urllib.parse.urlencode({"$select": FIELDS, "$where": where, "$order": "permit_nbr", "$limit": 50000, "$offset": offset})
        req = urllib.request.Request(f"{BASE}?{q}", headers={"User-Agent": "city-pretty-data-pipeline/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            chunk = json.load(r)
        rows += chunk
        if len(chunk) < 50000:
            return rows
        offset += 50000


def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else None
    out_groups = {}
    for name, where in GROUPS.items():
        rows = fetch(where)
        usable = []
        for r in rows:
            try:
                sf, val = float(r["square_footage"]), float(r["valuation"])
            except (KeyError, ValueError):
                continue
            if 150 <= sf <= 1200 and val > 0:
                usable.append({"permit_nbr": r["permit_nbr"], "year": int(r["issue_date"][:4]), "sqft": sf, "valuation": val, "work_desc": r.get("work_desc", "")[:200]})
        if raw_dir:
            os.makedirs(raw_dir, exist_ok=True)
            with open(os.path.join(raw_dir, f"{name}.csv"), "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=["permit_nbr", "year", "sqft", "valuation", "work_desc"])
                w.writeheader()
                w.writerows(usable)
        by_year = defaultdict(list)
        for u in usable:
            by_year[u["year"]].append(u)
        years = []
        for y in sorted(by_year):
            rs = by_year[y]
            ppsf = sorted(r["valuation"] / r["sqft"] for r in rs)
            vals = sorted(r["valuation"] for r in rs)
            sfs = sorted(r["sqft"] for r in rs)
            years.append({
                "issue_year": y, "permits": len(rs),
                "median_valuation": round(statistics.median(vals)), "median_sqft": round(statistics.median(sfs)),
                "median_valuation_per_sqft": round(statistics.median(ppsf), 2),
                "p25_valuation_per_sqft": round(pct(ppsf, 0.25), 2), "p75_valuation_per_sqft": round(pct(ppsf, 0.75), 2),
            })
        out_groups[name] = {"soql_where": where, "rows_returned": len(rows), "rows_used": len(usable), "by_issue_year": years}
        print(name, len(rows), len(usable), file=sys.stderr)
    payload = {
        "_source": {
            "dataset": "Building and Safety - Building Permits Issued from 2020 to Present (N), City of Los Angeles (Socrata pi9x-tg5x)",
            "url": "https://data.lacity.org/resource/pi9x-tg5x.json", "retrieved": date.today().isoformat(),
            "select_fields": FIELDS, "square_footage_filter": "150 to 1200", "measure": "declared permit valuation, not a bid or final cost",
            "computed_by": "scripts/costs/adu_permit_costs_la.py (medians of valuation / square_footage per permit, by calendar year of issue_date)",
        },
        "groups": out_groups,
    }
    json.dump(payload, open(OUT, "w"), indent=1)


if __name__ == "__main__":
    main()
