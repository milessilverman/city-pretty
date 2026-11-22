#!/usr/bin/env python3
"""Source (d): Census LEHD LODES8 workplace area characteristics (WAC), all jobs (JT00), all segments (S000), 2010 onward.

URL (checked 22 Nov 2026):  https://lehd.ces.census.gov/data/lodes/LODES8/<st>/wac/<st>_wac_S000_JT00_<YYYY>.csv.gz
  st = lower-case USPS state code; one gzip CSV per state-year, one row per 2020 census block (w_geocode, 15 digits).
  LODES8 allocates every year to 2020 blocks, so tract codes are 2020 tract codes for ALL years (no 2010/2020 split).
  Technical documentation: https://lehd.ces.census.gov/data/lodes/LODES8/LODESTechDoc8.1.pdf  (and LODESTechDoc8.x.pdf; see audit page)
Each state-year file is streamed through curl+gzip and reduced on the fly; nothing is written to disk.

Outputs:
  data/signals/lodes_wac_tract_<part>.csv.gz   national tracts, split by state FIPS so each file is < 20 MB
      tract,year,jobs,earn_low,earn_mid,earn_high,s_goods,s_trade_transport,s_prof_finance,s_edu_health,s_leisure_other,s_public
  data/signals/lodes_wac_bg_50counties.csv.gz  block group,year,jobs,earn_low,earn_mid,earn_high for the 50 back-test counties
  data/signals/lodes_coverage.json             which state-years were found / not found
Earnings bands (monthly pay): earn_low = CE01 <= $1,250; earn_mid = CE02 $1,251-$3,333; earn_high = CE03 > $3,333.
Broad sectors from the 20 NAICS-sector counts: goods = CNS01-05 (agriculture, mining, utilities, construction, manufacturing);
  trade_transport = CNS06-08; prof_finance = CNS09-14 (information, finance, real estate, professional, management, admin);
  edu_health = CNS15-16; leisure_other = CNS17-19; public = CNS20.
Usage: python3 scripts/signals/fetch_lodes.py [--years 2010-2024] [--workers 4]
"""
import argparse
import csv
import gzip
import io
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, backtest_counties, curl_stream, write_gz_csv  # noqa: E402

BASE = "https://lehd.ces.census.gov/data/lodes/LODES8/"
ST = {"01": "al", "02": "ak", "04": "az", "05": "ar", "06": "ca", "08": "co", "09": "ct", "10": "de", "11": "dc", "12": "fl", "13": "ga", "15": "hi",
      "16": "id", "17": "il", "18": "in", "19": "ia", "20": "ks", "21": "ky", "22": "la", "23": "me", "24": "md", "25": "ma", "26": "mi", "27": "mn",
      "28": "ms", "29": "mo", "30": "mt", "31": "ne", "32": "nv", "33": "nh", "34": "nj", "35": "nm", "36": "ny", "37": "nc", "38": "nd", "39": "oh",
      "40": "ok", "41": "or", "42": "pa", "44": "ri", "45": "sc", "46": "sd", "47": "tn", "48": "tx", "49": "ut", "50": "vt", "51": "va", "53": "wa",
      "54": "wv", "55": "wi", "56": "wy"}
SECT = {"goods": range(1, 6), "trade": range(6, 9), "prof": range(9, 15), "edu": range(15, 17), "leis": range(17, 20), "pub": range(20, 21)}
COUNTIES = set(backtest_counties())
EMPTY = {"found": False}


def one(job):
    fips, usps, year = job
    p = curl_stream(f"{BASE}{usps}/wac/{usps}_wac_S000_JT00_{year}.csv.gz")
    tr, bg = {}, {}
    try:
        with gzip.open(p.stdout, "rt", newline="") as f:
            rd = csv.reader(f)
            hdr = next(rd)
            ix = {k: i for i, k in enumerate(hdr)}
            cns = {n: [ix["CNS%02d" % k] for k in rng] for n, rng in SECT.items()}
            ce = [ix["CE01"], ix["CE02"], ix["CE03"]]
            ci = ix["C000"]
            for r in rd:
                g = r[0]
                t = g[:11]
                v = tr.setdefault(t, [0] * 10)
                v[0] += int(r[ci])
                for k in range(3):
                    v[1 + k] += int(r[ce[k]])
                for k, n in enumerate(SECT):
                    v[4 + k] += sum(int(r[i]) for i in cns[n])
                if g[:5] in COUNTIES:
                    b = bg.setdefault(g[:12], [0] * 4)
                    b[0] += int(r[ci])
                    for k in range(3):
                        b[1 + k] += int(r[ce[k]])
    except Exception as e:  # missing year for this state (curl --fail -> empty stream)
        p.wait()
        return job, None, None
    p.wait()
    if p.returncode != 0 or not tr:
        return job, None, None
    return job, tr, bg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="2010-2024")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    y0, y1 = map(int, a.years.split("-"))
    jobs = [(f, u, y) for f, u in ST.items() for y in range(y0, y1 + 1)]
    cov = {"found": [], "not_found": []}
    trows, brows = [], []
    with ThreadPoolExecutor(a.workers) as ex:
        for job, tr, bg in ex.map(one, jobs):
            tag = f"{ST[job[0]]}{job[2]}"
            if tr is None:
                cov["not_found"].append(tag)
                continue
            cov["found"].append(tag)
            for t, v in tr.items():
                trows.append([t, job[2]] + v)
            for b, v in bg.items():
                brows.append([b, job[2]] + v)
    trows.sort()
    brows.sort()
    hdr = ["tract", "year", "jobs", "earn_low", "earn_mid", "earn_high", "s_goods", "s_trade_transport", "s_prof_finance", "s_edu_health", "s_leisure_other", "s_public"]
    cuts = [("01_29", "00", "30"), ("30_47", "30", "48"), ("48_72", "48", "99")]
    for name, lo, hi in cuts:
        part = [r for r in trows if lo <= r[0][:2] < hi]
        n = write_gz_csv(os.path.join(OUT, f"lodes_wac_tract_{name}.csv.gz"), hdr, part)
        print(name, len(part), "rows", n, "bytes")
    n = write_gz_csv(os.path.join(OUT, "lodes_wac_bg_50counties.csv.gz"), ["block_group", "year", "jobs", "earn_low", "earn_mid", "earn_high"], brows)
    print("bg", len(brows), n)
    json.dump({"found": len(cov["found"]), "not_found": cov["not_found"]}, open(os.path.join(OUT, "lodes_coverage.json"), "w"), indent=1)
    print("not found:", cov["not_found"])


if __name__ == "__main__":
    main()
