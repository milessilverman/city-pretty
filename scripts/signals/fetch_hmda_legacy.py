#!/usr/bin/env python3
"""Source (b), older format: CFPB 'HMDA historic loan data' 2012-2017 (the pre-2018 layout), home-purchase loans by tract and year.

URL pattern (checked 22 Nov 2026; each is one zip holding one CSV, streamed through curl | funzip, never stored):
  https://files.consumerfinance.gov/hmda-historic-loan-data/hmda_<YYYY>_nationwide_all-records_codes.zip     (all lenders, all loan types; 182-435 MB each)
  Index page: https://www.consumerfinance.gov/data-research/hmda/historic-data/
  (The 'first-lien-owner-occupied-1-4-family-records' files linked on that page for the same years are narrower, so they are NOT used;
   the page's own link for 2012 'first-lien...labels.zip' answers 404. The 'all-records' files exist for 2007-2017.)
Layout (comma-separated, codes not labels): as_of_year,respondent_id,agency_code,loan_type,property_type,loan_purpose,owner_occupancy,loan_amount_000s,
  preapproval,action_taken,msamd,state_code,county_code,census_tract_number('0028.12'),...,applicant_income_000s,...
Filters: property_type == 1 (one-to-four-family, not manufactured housing) and loan_purpose == 1 (home purchase).
Occupancy in this layout is 1 owner-occupied, 2 NOT owner-occupied (investor and second home cannot be separated), 3 not applicable.
Columns per tract-year match fetch_hmda.py except: orig_nonowner replaces orig_second_home/orig_investor; no property value or LTV.
Outputs (written to data/signals/):
  hmda_legacy_tract_year_50counties.csv.gz   only the 50 back-test counties
  hmda_legacy_tract_year_national.csv.gz     every tract (omitted from the repo if it would exceed 20 MB; then written to SCRATCH)
Usage: python3 scripts/signals/fetch_hmda_legacy.py [--years 2012-2017]
"""
import argparse
import csv
import os
import statistics
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, SCRATCH, backtest_counties, write_gz_csv  # noqa: E402

BASE = "https://files.consumerfinance.gov/hmda-historic-loan-data/hmda_%d_nationwide_all-records_codes.zip"
FIELDS = ["tract", "year", "tract_vintage", "apps", "orig", "denied", "withdrawn", "incomplete", "approved_not_accepted", "denial_rate",
          "orig_owner_occ", "orig_nonowner", "orig_conventional", "median_loan", "median_income_k", "n_income"]


def fnum(s):
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    return v if v > 0 else None


def med(xs):
    return round(statistics.median(xs), 1) if xs else ""


def one_year(year):
    cmd = f"curl -sSL --fail --retry 3 '{BASE % year}' | funzip"
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, text=True, encoding="latin1")
    rd = csv.reader(p.stdout)
    h = {k: i for i, k in enumerate(next(rd))}
    need = ["property_type", "loan_purpose", "action_taken", "owner_occupancy", "loan_amount_000s", "state_code", "county_code", "census_tract_number", "applicant_income_000s", "loan_type"]
    ix = [h[k] for k in need]
    g, seen, kept = {}, 0, 0
    for r in rd:
        seen += 1
        pt, lp, a, oc, amt, st, co, tr, inc, lt = (r[i].strip() for i in ix)
        if pt != "1" or lp != "1":
            continue
        t = tr.replace(".", "")
        if len(t) != 6 or not t.isdigit() or not st.isdigit() or not co.isdigit():
            continue
        t = st.zfill(2) + co.zfill(3) + t
        kept += 1
        d = g.setdefault(t, [0, 0, 0, 0, 0, 0, 0, 0, 0, [], []])
        if a in ("1", "2", "3", "4", "5"):
            d[0] += 1
        if a == "1":
            d[1] += 1
            d[6] += oc == "1"
            d[7] += oc == "2"
            d[8] += lt == "1"
            v = fnum(amt)
            if v:
                d[9].append(v * 1000)
            v = fnum(inc)
            if v:
                d[10].append(v)
        elif a == "2":
            d[5] += 1
        elif a == "3":
            d[2] += 1
        elif a == "4":
            d[3] += 1
        elif a == "5":
            d[4] += 1
    p.stdout.close()
    p.wait()
    if kept == 0:
        raise RuntimeError(f"no rows for {year} (download failed?)")
    print(year, "rows read", seen, "home-purchase 1-4 family kept", kept, "tracts", len(g), flush=True)
    out = []
    for t, d in sorted(g.items()):
        den = d[1] + d[5] + d[2]
        out.append([t, year, "2010", d[0], d[1], d[2], d[3], d[4], d[5], round(d[2] / den, 4) if den else "", d[6], d[7], d[8], med(d[9]), med(d[10]), len(d[10])])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="2012-2017")
    a = ap.parse_args()
    y0, y1 = map(int, a.years.split("-"))
    rows = []
    for y in range(y0, y1 + 1):
        rows += one_year(y)
    cs = set(backtest_counties())
    sub = [r for r in rows if r[0][:5] in cs]
    print("50-county rows", len(sub), write_gz_csv(os.path.join(OUT, "hmda_legacy_tract_year_50counties.csv.gz"), FIELDS, sub))
    tmp = os.path.join(SCRATCH, "hmda_legacy_tract_year_national.csv.gz")
    n = write_gz_csv(tmp, FIELDS, rows)
    print("national rows", len(rows), "bytes", n)
    if n < 20 * 1024 * 1024:
        os.replace(tmp, os.path.join(OUT, "hmda_legacy_tract_year_national.csv.gz"))
        print("national table kept in the repository")
    else:
        print("national table too large for the repository; left in", tmp)


if __name__ == "__main__":
    main()
