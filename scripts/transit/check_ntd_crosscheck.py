#!/usr/bin/env python3
"""Cross-check data/transit/ntd_agency_mode_annual.csv against NTD's own "Metrics" tables on data.transportation.gov:
  ekg5-frzt  (report years 2022-2025) and vaik-frhy (report year 2021).
Compares operating expenses, fare revenues, unlinked trips, vehicle revenue hours and miles for rows that match on
(ntd_id, mode, type of service, report year), skipping keys that are not unique in either table.
Prints counts of matches, exact agreements and the largest differences. Usage: python3 scripts/transit/check_ntd_crosscheck.py [--cache DIR]
"""
import argparse, collections, csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _socrata as s

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PAIRS = [("opex", "total_operating_expenses"), ("fares", "fare_revenues_earned"), ("upt", "unlinked_passenger_trips"),
         ("vrh", "vehicle_revenue_hours"), ("vrm", "vehicle_revenue_miles")]


def load(ds, where, cache):
    p = os.path.join(cache, f"{ds}_check.json") if cache else None
    if p and os.path.exists(p):
        return json.load(open(p))
    rows = s.fetch_all(ds, where=where)
    if p:
        os.makedirs(cache, exist_ok=True); json.dump(rows, open(p, "w"))
    return rows


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--cache"); a = ap.parse_args()
    mine = collections.defaultdict(list)
    for r in csv.DictReader(open(os.path.join(ROOT, "data/transit/ntd_agency_mode_annual.csv"))):
        mine[(r["ntd_id"], r["mode"], r["tos"], r["report_year"])].append(r)
    ref = collections.defaultdict(list)
    for r in load("ekg5-frzt", "report_year>='2022'", a.cache):
        ref[(r["ntd_id"], r["mode"], r["type_of_service"], r["report_year"])].append(r)
    for r in load("vaik-frhy", None, a.cache):
        ref[(r["ntd_id"], r["mode"], r["tos"], "2021")].append(r)
    by_year = collections.defaultdict(lambda: collections.Counter())
    worst = []
    for k, rr in ref.items():
        mm = mine.get(k)
        if not mm or len(mm) != 1 or len(rr) != 1:
            by_year[k[3]]["skipped_not_unique_or_missing"] += 1
            continue
        for mc, rc in PAIRS:
            x, y = f(mm[0][mc]), f(rr[0].get(rc))
            if x is None or y is None:
                by_year[k[3]][f"{mc}_one_side_blank"] += 1
                continue
            by_year[k[3]][f"{mc}_compared"] += 1
            if abs(x - y) <= 0.5:
                by_year[k[3]][f"{mc}_equal"] += 1
            else:
                worst.append((abs(x - y) / max(abs(y), 1), k, mc, x, y))
    for y in sorted(by_year):
        print(y, dict(by_year[y]))
    worst.sort(reverse=True)
    print("differences:", len(worst))
    for w in worst[:15]:
        print(w)


if __name__ == "__main__":
    main()
