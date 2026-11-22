#!/usr/bin/env python3
"""Source (e): Zillow Research public CSVs, ZHVI and ZORI by ZIP, monthly.

URLs (checked 22 Nov 2026; both served from files.zillowstatic.com, last-modified 16 Nov 2026):
  ZHVI  https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_month.csv         (152 MB; raw, NOT smoothed / seasonally adjusted)
  ZHVI  https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv   (125 MB; smoothed + seasonally adjusted; not used here)
  ZORI  https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv                  (10 MB; smoothed; the only ZIP ZORI file found)
Columns: RegionID,SizeRank,RegionName(ZIP),RegionType,StateName,State,City,Metro,CountyName, then one column per month-end.
TERMS: not confirmed. zillow.com/research/data and the Zillow terms pages answer HTTP 403 (bot block) from this machine on 22 Nov 2026.
  => use for internal testing only, do not display.

Outputs:
  data/signals/zillow_zhvi_zip_monthly_50counties.csv.gz   wide: zip,state,county_name,metro,<YYYY-MM>...   ZIPs with >= 50 % of their land in the 50 back-test counties
  data/signals/zillow_zori_zip_monthly_50counties.csv.gz   same layout
  data/signals/zillow_zhvi_zip_annual_national.csv.gz      wide, December value of each year (and latest month as 'latest')
  data/signals/zillow_zori_zip_annual_national.csv.gz
  <scratch>/zillow_*_zip_monthly_national.csv.gz           full monthly national tables (too large for the repo; rebuilt by this script)
ZIP-to-county for the subset uses the Census ZCTA-tract relationship (data/signals/xwalk_zcta20_tract20.csv.gz), so run fetch_crosswalks.py first.
Blank = Zillow reports no value for that ZIP-month (not zero).
Usage: python3 scripts/signals/fetch_zillow.py
"""
import collections
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, SCRATCH, backtest_counties, curl_file, read_gz_csv, write_gz_csv  # noqa: E402

BASE = "https://files.zillowstatic.com/research/public_csvs/"
FILES = {
    "zhvi": BASE + "zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_month.csv",
    "zori": BASE + "zori/Zip_zori_uc_sfrcondomfr_sm_month.csv",
}


def zip_share_in_counties():
    cs = set(backtest_counties())
    tot, inn = collections.Counter(), collections.Counter()
    for r in read_gz_csv(os.path.join(OUT, "xwalk_zcta20_tract20.csv.gz")):
        a = int(r["area_part"])
        tot[r["zcta"]] += a
        if r["tract20"][:5] in cs:
            inn[r["zcta"]] += a
    return {z: inn[z] / tot[z] for z in tot if tot[z] and inn[z] / tot[z] >= 0.5}


def process(kind, keep):
    dest = curl_file(FILES[kind], os.path.join(SCRATCH, f"zillow_{kind}.csv"))
    with open(dest, newline="") as f:
        rd = csv.reader(f)
        hdr = next(rd)
        months = [h[:7] for h in hdr[9:]]
        dec = [i for i, m in enumerate(months) if m.endswith("-12")]
        sub, nat_m, nat_a = [], [], []
        for r in rd:
            z = r[2].zfill(5)
            vals = [("" if v == "" else str(round(float(v), 2)).rstrip("0").rstrip(".")) for v in r[9:]]
            meta = [z, r[5], r[8], r[7]]
            nat_m.append(meta + vals)
            nat_a.append(meta + [vals[i] for i in dec] + [vals[-1]])
            if z in keep:
                sub.append(meta + vals)
    os.remove(dest)
    first_year = [months[i][:4] for i in dec]
    h_a = ["zip", "state", "county_name", "metro"] + ["dec_" + y for y in first_year] + ["latest_" + months[-1]]
    h_m = ["zip", "state", "county_name", "metro"] + months
    print(kind, "months", months[0], "..", months[-1], "zips", len(nat_m), "subset", len(sub))
    print(" subset bytes", write_gz_csv(os.path.join(OUT, f"zillow_{kind}_zip_monthly_50counties.csv.gz"), h_m, sub))
    print(" annual bytes", write_gz_csv(os.path.join(OUT, f"zillow_{kind}_zip_annual_national.csv.gz"), h_a, nat_a))
    print(" scratch monthly bytes", write_gz_csv(os.path.join(SCRATCH, f"zillow_{kind}_zip_monthly_national.csv.gz"), h_m, nat_m))


def main():
    keep = zip_share_in_counties()
    print("ZCTAs with >=50% land in the 50 counties:", len(keep))
    for k in FILES:
        process(k, keep)


if __name__ == "__main__":
    main()
