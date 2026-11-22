#!/usr/bin/env python3
"""Fetch NTD "Complete Monthly Ridership (with Adjustments and Estimates)" (data.transportation.gov dataset 8bui-9xvu)
for January 2019 to the latest month, and write two compact tables:
  data/transit/ntd_monthly_series.csv        one row per agency / mode / type of service / status series
  data/transit/ntd_monthly_ridership.csv.gz  long table: series_id, month (YYYY-MM), upt, vrm, vrh, voms
Every series row carries source_dataset and source_url; the monthly file is keyed by series_id and the whole file comes
from that one dataset. Blank means the agency's month is not reported in the source (not zero).
Usage: python3 scripts/transit/fetch_ntd_monthly.py [--cache DIR] [--from 2019-01-01]
"""
import argparse, csv, gzip, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _socrata as s

DATASET = "8bui-9xvu"
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT_SERIES = os.path.join(ROOT, "data", "transit", "ntd_monthly_series.csv")
OUT_MONTHLY = os.path.join(ROOT, "data", "transit", "ntd_monthly_ridership.csv.gz")
OUT_META = os.path.join(ROOT, "data", "transit", "ntd_monthly_source.json")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--cache"); ap.add_argument("--from", dest="frm", default="2019-01-01")
    a = ap.parse_args()
    cache = os.path.join(a.cache, f"{DATASET}_{a.frm}.json") if a.cache else None
    if cache and os.path.exists(cache):
        rows = json.load(open(cache))
    else:
        rows = s.fetch_all(DATASET, where=f"date>='{a.frm}T00:00:00'")
        if cache:
            os.makedirs(a.cache, exist_ok=True); json.dump(rows, open(cache, "w"))
    series, ids = {}, {}
    for r in rows:
        k = (r.get("ntd_id", ""), r.get("mode", ""), r.get("tos", ""), r.get("mode_type_of_service_status", ""), r.get("reporter_type", ""))
        if k not in series:
            ids[k] = len(series) + 1
            series[k] = r
    url = f"{s.HOST}/d/{DATASET}"
    os.makedirs(os.path.dirname(OUT_SERIES), exist_ok=True)
    with open(OUT_SERIES, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["series_id", "ntd_id", "agency", "mode", "tos", "status", "reporter_type", "uace_code", "uza_name", "state", "fta_region", "source_dataset", "source_url"])
        for k, r in series.items():
            w.writerow([ids[k], k[0], r.get("agency", ""), k[1], k[2], k[3], k[4], r.get("uace_cd", ""), r.get("uza_name", ""), r.get("state", ""), r.get("fta_region", ""), DATASET, url])
    months = set()
    body = []
    for r in rows:
        k = (r.get("ntd_id", ""), r.get("mode", ""), r.get("tos", ""), r.get("mode_type_of_service_status", ""), r.get("reporter_type", ""))
        ym = r["date"][:7]
        months.add(ym)
        def g(x):
            v = r.get(x)
            return "" if v in (None, "") else str(int(float(v))) if float(v) == int(float(v)) else v
        body.append((ids[k], ym, g("upt"), g("vrm"), g("vrh"), g("voms")))
    body.sort()
    with gzip.open(OUT_MONTHLY, "wt", newline="", compresslevel=9) as f:
        w = csv.writer(f)
        w.writerow(["series_id", "month", "upt", "vrm", "vrh", "voms"])
        w.writerows(body)
    meta = {"generated_by": "scripts/transit/fetch_ntd_monthly.py", "dataset": s.view_meta(s.HOST, DATASET),
            "first_month": min(months), "last_month": max(months), "series": len(series), "monthly_rows": len(body)}
    json.dump(meta, open(OUT_META, "w"), indent=1)
    print(f"{len(series)} series, {len(body)} monthly rows, {min(months)} to {max(months)}")


if __name__ == "__main__":
    main()
