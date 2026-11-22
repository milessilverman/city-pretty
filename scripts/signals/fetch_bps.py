#!/usr/bin/env python3
"""Source (c): Census Building Permits Survey, units authorised by structure size, county and place, 2010 onward.

URLs (checked 22 Nov 2026; plain comma-separated text, two header rows, one blank row):
  County annual   https://www2.census.gov/econ/bps/County/co<YYYY>a.txt            2010..2025
  County monthly  https://www2.census.gov/econ/bps/County/co<YYMM>c.txt            'c' = that month only; 2010-01..2026-09
  Place annual    https://www2.census.gov/econ/bps/Place/<Region>%20Region/<xx><YYYY>a.txt   xx = mw ne so we
  Place monthly   https://www2.census.gov/econ/bps/Place/<Region>%20Region/<xx><YYMM>c.txt
  Documentation   https://www2.census.gov/econ/bps/Documentation/   (the 'y' files are year-to-date, not used)
Each file has, per structure class (1 unit, 2 units, 3-4 units, 5+ units): buildings, units, value ($);
a second block ('rep') holds reported-only figures (the first block includes the Bureau's imputation for non-reporters).

Outputs:
  data/signals/bps_county_annual.csv.gz     year,state,county,u1,u2,u34,u5p,r1,r2,r34,r5p,value_total   (national)
  data/signals/bps_county_monthly.csv.gz    year,month,state,county,u1,u2,u34,u5p,r1,r2,r34,r5p,value_total  (national)
  data/signals/bps_place_annual.csv.gz      year,state,county,bps_id,fips_place,name,months_rep,u1,u2,u34,u5p,r1,r2,r34,r5p,value_total (national)
  data/signals/bps_place_monthly_50counties.csv.gz  same layout (month filled), only places whose county is one of the 50 back-test counties
u* = units incl. imputation, r* = units from actual reports only. Months/years not published are simply absent.
Usage: python3 scripts/signals/fetch_bps.py
"""
import csv
import io
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, backtest_counties, write_gz_csv  # noqa: E402

BASE = "https://www2.census.gov/econ/bps/"
REGIONS = {"mw": "Midwest", "ne": "Northeast", "so": "South", "we": "West"}
LAST_MONTH = (2026, 9)


def get(url):
    for _ in range(4):  # retry anything but a clean 200/404 (the first run lost 6 files to transient errors)
        r = subprocess.run(["curl", "-sSL", "--retry", "3", "-w", "\n%{http_code}", url], capture_output=True)
        body, _, code = r.stdout.rpartition(b"\n")
        if code == b"200":
            return body.decode("latin1")
        if code == b"404":
            return None
    return None


def ints(p, i):
    out = []
    for k in range(i, i + 12, 3):
        out.append(int(p[k + 1] or 0))
    return out


def vals(p, i):
    return sum(int(p[k + 2] or 0) for k in range(i, i + 12, 3))


def county_rows(text, year, month):
    rows = []
    for p in csv.reader(io.StringIO(text)):
        if len(p) < 30 or not p[0].strip()[:4].isdigit() or not p[1].strip().isdigit():
            continue
        u = ints(p, 6)
        r = ints(p, 18)
        rows.append([year, month, p[1], p[2]] + u + r + [vals(p, 6)])
    return rows


def place_rows(text, year, month, keep_counties=None):
    rows = []
    for p in csv.reader(io.StringIO(text)):
        if len(p) < 29 or not p[0].strip()[:4].isdigit() or not p[1].strip().isdigit():
            continue
        if keep_counties is not None and (p[1] + p[3]) not in keep_counties:
            continue
        u = ints(p, 17)
        r = ints(p, 29) if len(p) >= 41 else [""] * 4
        rows.append([year, month, p[1], p[3], p[2].strip(), p[5].strip(), p[16].strip(), p[15].strip()] + u + r + [vals(p, 17)])
    return rows


def months():
    for y in range(2010, LAST_MONTH[0] + 1):
        for m in range(1, 13):
            if (y, m) <= LAST_MONTH:
                yield y, m


def main():
    keep = set(backtest_counties())
    with ThreadPoolExecutor(8) as ex:
        # county annual
        res = list(ex.map(lambda y: (y, get(f"{BASE}County/co{y}a.txt")), range(2010, 2026)))
        ca = [r[:1] + r[2:] for y, t in res if t for r in county_rows(t, y, 0)]
        print("county annual rows", len(ca), "years", sorted({y for y, t in res if t}))
        n = write_gz_csv(os.path.join(OUT, "bps_county_annual.csv.gz"),
                         ["year", "state", "county", "u1", "u2", "u34", "u5p", "r1", "r2", "r34", "r5p", "value_total"], ca)
        print("bytes", n)
        # county monthly
        ml = list(months())
        res = list(ex.map(lambda ym: (ym, get(f"{BASE}County/co{ym[0] % 100:02d}{ym[1]:02d}c.txt")), ml))
        cm = [r for ym, t in res if t for r in county_rows(t, ym[0], ym[1])]
        print("county monthly rows", len(cm), "months found", sum(1 for ym, t in res if t), "of", len(ml))
        n = write_gz_csv(os.path.join(OUT, "bps_county_monthly.csv.gz"),
                         ["year", "month", "state", "county", "u1", "u2", "u34", "u5p", "r1", "r2", "r34", "r5p", "value_total"], cm)
        print("bytes", n)
        # place annual
        jobs = [(y, k) for y in range(2010, 2026) for k in REGIONS]
        res = list(ex.map(lambda j: (j, get(f"{BASE}Place/{REGIONS[j[1]]}%20Region/{j[1]}{j[0]}a.txt")), jobs))
        pa = [r[:1] + r[2:] for j, t in res if t for r in place_rows(t, j[0], 0)]
        print("place annual rows", len(pa), "files", sum(1 for j, t in res if t), "of", len(jobs))
        hdr = ["year", "state", "county", "bps_id", "fips_place", "name", "months_rep", "u1", "u2", "u34", "u5p", "r1", "r2", "r34", "r5p", "value_total"]
        n = write_gz_csv(os.path.join(OUT, "bps_place_annual.csv.gz"), hdr, pa)
        print("bytes", n)
        # place monthly, 50 counties only
        jobs = [(ym, k) for ym in ml for k in REGIONS]
        res = list(ex.map(lambda j: (j, get(f"{BASE}Place/{REGIONS[j[1]]}%20Region/{j[1]}{j[0][0] % 100:02d}{j[0][1]:02d}c.txt")), jobs))
        pm = [r for j, t in res if t for r in place_rows(t, j[0][0], j[0][1], keep)]
        print("place monthly (50 counties) rows", len(pm), "files", sum(1 for j, t in res if t), "of", len(jobs))
        print("place monthly files not found:", [(j[0], j[1]) for j, t in res if not t])
        n = write_gz_csv(os.path.join(OUT, "bps_place_monthly_50counties.csv.gz"), ["year", "month"] + hdr[1:], pm)
        print("bytes", n)


if __name__ == "__main__":
    main()
