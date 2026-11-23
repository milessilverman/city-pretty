#!/usr/bin/env python3
"""Per-tract signal facts for the page (no forecast): price trend, jobs trend, county permits trend.

Reads the signal tables already in the repository (data/signals/, see docs/audit/prediction-signals-2026-11-22.md):
  fhfa_tract_annual.csv.gz   FHFA tract house price index (developmental, not seasonally adjusted), 1975-2025
  lodes_wac_tract_*.csv.gz   LEHD LODES8 workplace jobs by 2020 tract, 2010-2024
  bps_county_annual.csv.gz   Census Building Permits Survey, county annual, 2010-2025
Writes app/data/neighborhood_signals/<state fips>.json:
  {"tracts": {tract: [price_5y_pct, price_1y_pct, jobs_2024, jobs_2y_pct]}, "counties": {county: [units 2021..2025]}, "_source": ...}
  price_5y_pct = 100 x (HPI 2025 / HPI 2020 - 1); price_1y_pct = 100 x (HPI 2025 / HPI 2024 - 1);
  jobs_2y_pct = 100 x (jobs 2024 / jobs 2022 - 1) (null when 2022 jobs < 50, too small to read as a trend);
  null = not published for that tract or year (FHFA omits thin tracts; LODES has no Alaska 2017-2024 or Michigan 2022-2024 file).
Usage: python3 scripts/predict2/build_page_signals.py
"""
import csv
import gzip
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIG = os.path.join(ROOT, "data", "signals")
OUT = os.path.join(ROOT, "app", "data", "neighborhood_signals")
PERMIT_YEARS = list(range(2021, 2026))
RETRIEVED = "2026-11-23"
SOURCE = {
    "note": "Facts only, not a forecast. A model built from these signals was tested on metros it had never seen and did not beat simple baselines; see docs/audit/prediction-2026-11-23.md.",
    "columns": {"tracts": ["price_5y_pct (2020 to 2025)", "price_1y_pct (2024 to 2025)", "jobs_2024", "jobs_2y_pct (2022 to 2024)"],
                "counties": [f"housing units authorised {y}" for y in PERMIT_YEARS]},
    "sources": [
        {"name": "FHFA House Price Index, census tracts, annual", "url": "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv",
         "page": "https://www.fhfa.gov/data/hpi/datasets", "data_years": "1975-2025 (2025 is the latest year in the file)", "retrieved": RETRIEVED,
         "quote": "Census Tracts (Developmental Index; Not Seasonally Adjusted) [CSV]",
         "quote2": "The FHFA HPI® is a comprehensive collection of publicly available house price indexes that measure changes in single-family home values",
         "caution": "FHFA labels the tract series a developmental index. Where FHFA publishes no value for a tract and year, the change is not shown."},
        {"name": "LEHD Origin-Destination Employment Statistics (LODES8), workplace area characteristics, all jobs",
         "url": "https://lehd.ces.census.gov/data/lodes/LODES8/", "page": "https://lehd.ces.census.gov/data/", "data_years": "2010-2024; 2024 files posted 14 Oct 2026 (Last-Modified header of tx_wac_S000_JT00_2024.csv.gz)",
         "retrieved": RETRIEVED,
         "quote": "U.S. Census Bureau, \"{File Name},\" LEHD Origin-Destination Employment Statistics, {Vintage}, https://lehd.ces.census.gov/data/lodes , accessed on {Date}.",
         "caution": "Jobs located in the tract (where people work), not residents' jobs."},
        {"name": "Census Building Permits Survey, county annual files", "url": "https://www2.census.gov/econ/bps/County/", "page": "https://www.census.gov/construction/bps/index.html",
         "data_years": "2021-2025; 2025 file Last-Modified 14 May 2026", "retrieved": RETRIEVED,
         "quote": "housing units authorized to be built by a building or zoning permit",
         "caution": "Permits are not completions. Totals include the Bureau's estimates for places that did not report."},
    ],
}


def rows(p):
    with gzip.open(p, "rt", newline="") as f:
        yield from csv.DictReader(f)


def r1(x):
    return None if x is None else round(x, 1)


def main():
    hp = {}
    for r in rows(os.path.join(SIG, "fhfa_tract_annual.csv.gz")):
        y = int(r["year"])
        d = hp.setdefault(r["tract"], {})  # every tract in FHFA's file gets a row, with or without values in these years
        if y in (2020, 2024, 2025) and r["hpi"] not in ("", "."):
            d[y] = float(r["hpi"])
    cov = json.load(open(os.path.join(SIG, "lodes_coverage.json")))
    missing_st = {"ak": "02", "mi": "26"}
    nf = {(missing_st[s[:2]], int(s[2:])) for s in cov["not_found"]}
    jobs = {}
    for part in ("01_29", "30_47", "48_72"):
        for r in rows(os.path.join(SIG, f"lodes_wac_tract_{part}.csv.gz")):
            y = int(r["year"])
            d = jobs.setdefault(r["tract"], {})
            if y in (2022, 2024):
                d[y] = float(r["jobs"])
    permits = {}
    for r in rows(os.path.join(SIG, "bps_county_annual.csv.gz")):
        y = int(r["year"])
        if y in PERMIT_YEARS:
            permits.setdefault(r["state"] + r["county"], {})[y] = int(sum(float(r[k] or 0) for k in ("u1", "u2", "u34", "u5p")))
    by_state = {}
    for t in sorted(set(hp) | set(jobs)):
        st = t[:2]
        h = hp.get(t, {})
        p5 = 100 * (h[2025] / h[2020] - 1) if 2025 in h and 2020 in h else None
        p1 = 100 * (h[2025] / h[2024] - 1) if 2025 in h and 2024 in h else None
        if (st, 2024) in nf:
            j24 = j2 = None
        else:
            j = jobs.get(t, {})
            j24 = j.get(2024, 0.0)
            j22 = None if (st, 2022) in nf else j.get(2022, 0.0)
            j2 = 100 * (j24 / j22 - 1) if j22 is not None and j22 >= 50 else None
        by_state.setdefault(st, {})[t] = [r1(p5), r1(p1), None if j24 is None else int(j24), r1(j2)]
    os.makedirs(OUT, exist_ok=True)
    sizes = {}
    for st, tr in sorted(by_state.items()):
        cnty = {c: [permits[c].get(y) for y in PERMIT_YEARS] for c in sorted(permits) if c[:2] == st}
        doc = {"_source": SOURCE, "state": st, "tracts": tr, "counties": cnty,
               "lodes_not_published": sorted(y for (s2, y) in nf if s2 == st and y in (2022, 2024))}
        p = os.path.join(OUT, f"{st}.json")
        with open(p, "w") as f:
            json.dump(doc, f, separators=(",", ":"))
        sizes[st] = os.path.getsize(p)
    print(json.dumps({"files": len(sizes), "bytes_total": sum(sizes.values()), "largest": max(sizes.items(), key=lambda kv: kv[1])}))


if __name__ == "__main__":
    main()
