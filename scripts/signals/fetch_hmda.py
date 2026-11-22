#!/usr/bin/env python3
"""Source (b): CFPB/FFIEC HMDA public loan-level data, current format (2018 onward), home-purchase loans, by census tract and year.

URL pattern (checked 22 Nov 2026; the first reply is a 301 to a files.ffiec.cfpb.gov CSV, curl -L follows it):
  https://ffiec.cfpb.gov/v2/data-browser-api/view/csv?counties=<5-digit FIPS>&years=<YYYY>&loan_purposes=1
  https://ffiec.cfpb.gov/v2/data-browser-api/view/csv?states=<USPS>&years=<YYYY>&loan_purposes=1     (--scope states)
Documentation: https://ffiec.cfpb.gov/documentation/   Data publication: https://ffiec.cfpb.gov/data-publication/
Years served: 2018-2025 (the API's own message for other years says "2018-2023"; 2024 and 2025 were nevertheless returned).

Each (county|state, year) CSV is downloaded to scratch, reduced and DELETED before the next one. Only rows with
total_units 1-4 are used (multifamily excluded). Columns written per tract-year (data/signals/hmda_tract_year_50counties.csv.gz):
  tract (as published; 2010 tract codes for activity_year <= 2021, 2020 tract codes for >= 2022: see tract_vintage),
  year, tract_vintage, apps (action 1-5), orig (1), denied (3), withdrawn (4), incomplete (5), approved_not_accepted (2),
  denial_rate = denied/(orig+approved_not_accepted+denied), orig_owner_occ / orig_second_home / orig_investor (occupancy_type 1/2/3),
  median_loan (originations, dollars), median_income_k (originations, $000, numeric only), median_property_value (originations, numeric only),
  median_ltv (originations), orig_conventional (loan_type 1), n_income (rows with numeric income, so the modeller can see support)
Cells are NOT suppressed by the publisher; tract-years with fewer than 5 applications are kept with their counts (the modeller decides).

Usage: python3 scripts/signals/fetch_hmda.py [--scope counties|states] [--years 2018-2025] [--workers 3] [--only 17031,36047]
Resumable: finished (area, year) pieces are cached as small JSON in SCRATCH/hmda_pieces and skipped on re-run.
"""
import argparse
import csv
import gzip
import json
import os
import statistics
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, SCRATCH, backtest_counties, curl_file, write_gz_csv  # noqa: E402

API = "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv"
PIECES = os.path.join(SCRATCH, "hmda_pieces")
os.makedirs(PIECES, exist_ok=True)
FIELDS = ["tract", "year", "tract_vintage", "apps", "orig", "denied", "withdrawn", "incomplete", "approved_not_accepted",
          "denial_rate", "orig_owner_occ", "orig_second_home", "orig_investor", "orig_conventional",
          "median_loan", "median_income_k", "n_income", "median_property_value", "median_ltv"]


def fnum(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def med(xs):
    return round(statistics.median(xs), 1) if xs else ""


def reduce_csv(path, year):
    g = {}
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            if r["total_units"] not in ("1", "2", "3", "4"):
                continue
            t = r["census_tract"].strip()
            if len(t) != 11 or not t.isdigit():
                continue
            a = r["action_taken"]
            d = g.setdefault(t, {"ap": 0, "o": 0, "dn": 0, "wd": 0, "inc": 0, "ana": 0, "own": 0, "sec": 0, "inv": 0, "conv": 0,
                                 "loan": [], "inc_k": [], "pv": [], "ltv": []})
            if a in "12345" and len(a) == 1:
                d["ap"] += 1
            if a == "1":
                d["o"] += 1
                oc = r["occupancy_type"]
                d["own"] += oc == "1"
                d["sec"] += oc == "2"
                d["inv"] += oc == "3"
                d["conv"] += r["loan_type"] == "1"
                for key, col in (("loan", "loan_amount"), ("inc_k", "income"), ("pv", "property_value"), ("ltv", "loan_to_value_ratio")):
                    v = fnum(r[col])
                    if v is not None and v > 0:
                        d[key].append(v)
            elif a == "2":
                d["ana"] += 1
            elif a == "3":
                d["dn"] += 1
            elif a == "4":
                d["wd"] += 1
            elif a == "5":
                d["inc"] += 1
    out = []
    vint = "2010" if year <= 2021 else "2020"
    for t, d in sorted(g.items()):
        den = d["o"] + d["ana"] + d["dn"]
        out.append([t, year, vint, d["ap"], d["o"], d["dn"], d["wd"], d["inc"], d["ana"], round(d["dn"] / den, 4) if den else "",
                    d["own"], d["sec"], d["inv"], d["conv"], med(d["loan"]), med(d["inc_k"]), len(d["inc_k"]), med(d["pv"]), med(d["ltv"])])
    return out


def piece(scope, area, year, lock):
    pf = os.path.join(PIECES, f"{scope}_{area}_{year}.json")
    if os.path.exists(pf):
        return json.load(open(pf))
    key = "counties" if scope == "counties" else "states"
    dest = os.path.join(SCRATCH, f"hmda_{scope}_{area}_{year}.csv")
    curl_file(f"{API}?{key}={area}&years={year}&loan_purposes=1", dest)
    rows = reduce_csv(dest, year)
    os.remove(dest)
    json.dump(rows, open(pf, "w"))
    with lock:
        print(f"{scope} {area} {year}: {len(rows)} tract rows", flush=True)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", default="counties", choices=["counties", "states"])
    ap.add_argument("--years", default="2018-2025")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    y0, y1 = map(int, a.years.split("-"))
    if a.scope == "counties":
        areas = a.only.split(",") if a.only else backtest_counties()
    else:
        areas = a.only.split(",") if a.only else (
            "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
    lock = threading.Lock()
    jobs = [(a.scope, ar, y) for ar in areas for y in range(y0, y1 + 1)]
    with ThreadPoolExecutor(a.workers) as ex:
        results = list(ex.map(lambda j: piece(*j, lock), jobs))
    rows = [r for res in results for r in res]
    rows.sort(key=lambda r: (r[0], r[1]))
    name = "hmda_tract_year_50counties.csv.gz" if a.scope == "counties" else "hmda_tract_year_national.csv.gz"
    dest = os.path.join(OUT if a.scope == "counties" else SCRATCH, name)
    n = write_gz_csv(dest, FIELDS, rows)
    print("rows", len(rows), "bytes", n, "->", dest)
    if a.scope == "states" and n < 20 * 1024 * 1024:
        os.replace(dest, os.path.join(OUT, name))
        print("national table small enough: moved into", OUT)


if __name__ == "__main__":
    main()
