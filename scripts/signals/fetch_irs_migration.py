#!/usr/bin/env python3
"""Source (g): IRS Statistics of Income, US population migration data, county inflows and outflows.

URLs (checked 22 Nov 2026), one inflow and one outflow CSV per year pair 2011-2012 ... 2023-2024:
  https://www.irs.gov/pub/irs-soi/countyinflow<YYYY>.csv      YYYY = '1112' ... '2324'  (y2 = destination county, y1 = origin)
  https://www.irs.gov/pub/irs-soi/countyoutflow<YYYY>.csv     (y1 = origin county, y2 = destination)
  Landing pages https://www.irs.gov/statistics/soi-tax-stats-migration-data-<Y1>-<Y2>   Documentation: https://www.irs.gov/pub/irs-soi/<YYYY>inpublicmigdoc.pdf
  Columns: y2_statefips,y2_countyfips,y1_statefips,y1_countyfips,y1_state,y1_countyname,n1 (returns),n2 (exemptions ~ people),agi ($ thousands)
Summary rows used (y1_statefips,y1_countyfips): 96,0 = US and foreign; 97,0 = US; 97,3 = different state; 98,0 = foreign; same county = non-migrants.
A pair '2122' is built from returns filed with the IRS in calendar years 2021 and 2022 (IRS user guide: "based on the population of Forms 1040 that
were filed and processed by the IRS during calendar years 2021 and 2022"; mostly tax years 2020 and 2021); it is labelled year_end=2022 here.
Cells with fewer than 20 returns are not shown in the county-to-county rows (shown as -1 / folded into 'Other flows').
Output (national, one row per county and year pair):
  data/signals/irs_migration_county.csv.gz
    county,year_end,nonmig_returns,in_returns,in_exempt,in_agi_k,in_diffstate_returns,in_foreign_returns,
    out_returns,out_exempt,out_agi_k,out_diffstate_returns,out_foreign_returns,net_returns
  net_returns = in_returns - out_returns for US moves (summary row 97,0 in both files).
Cells under the IRS disclosure threshold are not in the pair rows; the summary totals include them. Blank = row not present.
Usage: python3 scripts/signals/fetch_irs_migration.py
"""
import csv
import io
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, curl_stream, write_gz_csv  # noqa: E402

BASE = "https://www.irs.gov/pub/irs-soi/"
PAIRS = [f"{a % 100:02d}{a % 100 + 1:02d}" for a in range(2011, 2024)]  # 1112 .. 2324


def pad(s, n):
    return str(s).strip().zfill(n)


def read(kind, pair):
    p = curl_stream(f"{BASE}county{kind}{pair}.csv")
    txt = io.TextIOWrapper(p.stdout, encoding="utf-8-sig", errors="replace", newline="")
    rd = csv.DictReader(txt)
    d = {}
    for r in rd:
        a, b = (r["y2_statefips"], r["y2_countyfips"]) if kind == "inflow" else (r["y1_statefips"], r["y1_countyfips"])
        c = pad(a, 2) + pad(b, 3)
        if c[2:] == "000":  # state total rows
            continue
        o = (pad(r["y1_statefips"] if kind == "inflow" else r["y2_statefips"], 2), pad(r["y1_countyfips"] if kind == "inflow" else r["y2_countyfips"], 3))
        key = None
        if o == ("96", "000"):
            key = "all"
        elif o == ("97", "000"):
            key = "us"
        elif o == ("97", "003"):
            key = "diff"
        elif o == ("98", "000"):
            key = "foreign"
        elif kind == "inflow" and o == (pad(a, 2), pad(b, 3)):
            key = "nonmig"
        if key:
            d[(c, key)] = (r["n1"], r["n2"], r["agi"])
    p.wait()
    if p.returncode != 0:
        raise RuntimeError(f"download failed {kind} {pair}")
    return d


def one(pair):
    return pair, read("inflow", pair), read("outflow", pair)


def main():
    rows = []
    with ThreadPoolExecutor(4) as ex:
        for pair, fin, fout in ex.map(one, PAIRS):
            year_end = 2000 + int(pair[2:])
            counties = sorted({k[0] for k in fin} | {k[0] for k in fout})
            for c in counties:
                g = lambda d, k, i: (d.get((c, k), ("",) * 3)[i])  # noqa: E731
                inr, outr = g(fin, "us", 0), g(fout, "us", 0)
                net = int(inr) - int(outr) if inr != "" and outr != "" and inr.lstrip("-").isdigit() and outr.lstrip("-").isdigit() else ""
                rows.append([c, year_end, g(fin, "nonmig", 0), inr, g(fin, "us", 1), g(fin, "us", 2), g(fin, "diff", 0), g(fin, "foreign", 0),
                             outr, g(fout, "us", 1), g(fout, "us", 2), g(fout, "diff", 0), g(fout, "foreign", 0), net])
            print(pair, len(counties), "counties", flush=True)
    rows.sort()
    hdr = ["county", "year_end", "nonmig_returns", "in_returns", "in_exempt", "in_agi_k", "in_diffstate_returns", "in_foreign_returns",
           "out_returns", "out_exempt", "out_agi_k", "out_diffstate_returns", "out_foreign_returns", "net_returns"]
    print("rows", len(rows), "bytes", write_gz_csv(os.path.join(OUT, "irs_migration_county.csv.gz"), hdr, rows))


if __name__ == "__main__":
    main()
