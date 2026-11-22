#!/usr/bin/env python3
"""Fetch NTD annual agency / mode / type-of-service data (report years 2020 to latest) from data.transportation.gov
and write the compact table data/transit/ntd_agency_mode_annual.csv plus data/transit/ntd_sources.json.

Source: dataset npsm-38gk "<year> NTD Annual Data - Service Data and Operating Expenses by Mode (Time Series 2.1)",
FTA, licence "Public Domain U.S. Government". Cross-checked against ekg5-frzt ("2022 - 2025 NTD Annual Data - Metrics")
for the latest year: see scripts/transit/check_ntd_crosscheck.py output recorded in the audit file.

Derived columns (computed here, formulas recorded in FORMULAS below and in the audit file):
  opex_per_vrh   = operating expenses / vehicle revenue hours
  opex_per_vrm   = operating expenses / vehicle revenue miles
  opex_per_upt   = operating expenses / unlinked passenger trips
  fare_per_upt   = fare revenues / unlinked passenger trips
  farebox_recovery = fare revenues / operating expenses
  avg_trip_miles = passenger miles traveled / unlinked passenger trips
  vrh_per_route_mile = vehicle revenue hours / directional route miles
A derived value is left blank when its numerator is missing or its denominator is missing or not above zero.

Usage: python3 scripts/transit/fetch_ntd_annual.py [--cache DIR] [--from-year 2020]
Re-runnable. With --cache the raw download is kept in DIR (outside the repo) and reused; delete it afterwards.
"""
import argparse, csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _socrata as s

HOST = s.HOST
DATASET = "npsm-38gk"
CHECK_DATASET = "ekg5-frzt"
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT_CSV = os.path.join(ROOT, "data", "transit", "ntd_agency_mode_annual.csv")
OUT_META = os.path.join(ROOT, "data", "transit", "ntd_sources.json")

FIELDS = {
    "Fares": "fares",
    "Operating Expenses": "opex",
    "Operating Expenses - Vehicle Operations": "opex_vehicle_operations",
    "Operating Expenses - Vehicle Maintenance": "opex_vehicle_maintenance",
    "Operating Expenses - Facility Maintenance": "opex_facility_maintenance",
    "Operating Expenses - General Administration": "opex_general_admin",
    "Vehicle Revenue Hours": "vrh",
    "Vehicle Revenue Miles": "vrm",
    "Unlinked Passenger Trips": "upt",
    "Passenger Miles Traveled": "pmt",
    "Vehicles Operated in Maximum Service": "voms",
    "Directional Route Miles": "drm",
}
MODE_NAMES = {  # names as given by ekg5-frzt (mode_name) and the 8bui-9xvu description
    "AR": "Alaska Railroad", "CB": "Commuter Bus", "CC": "Cable Car", "CR": "Commuter Rail", "DR": "Demand Response",
    "FB": "Ferryboat", "HR": "Heavy Rail", "IP": "Inclined Plane", "JT": "Jitney", "LR": "Light Rail", "MB": "Bus",
    "MG": "Monorail/Automated Guideway", "PB": "Publico", "RB": "Bus Rapid Transit", "SR": "Streetcar Rail",
    "TB": "Trolleybus", "TR": "Aerial Tramway", "VP": "Vanpool", "YR": "Hybrid Rail",
}
FORMULAS = {
    "opex_per_vrh": "opex / vrh", "opex_per_vrm": "opex / vrm", "opex_per_upt": "opex / upt",
    "fare_per_upt": "fares / upt", "farebox_recovery": "fares / opex", "avg_trip_miles": "pmt / upt",
    "vrh_per_route_mile": "vrh / drm",
}
DERIVED = [
    ("opex_per_vrh", "opex", "vrh"), ("opex_per_vrm", "opex", "vrm"), ("opex_per_upt", "opex", "upt"),
    ("fare_per_upt", "fares", "upt"), ("farebox_recovery", "fares", "opex"), ("avg_trip_miles", "pmt", "upt"),
    ("vrh_per_route_mile", "vrh", "drm"),
]
ID_COLS = ["report_year", "ntd_id", "state_ntd_id", "agency_name", "city", "state", "reporter_type", "uace_code", "uza_name", "uza_population", "mode", "mode_name", "tos", "mode_status"]
VAL_COLS = list(FIELDS.values())
COLS = ID_COLS + VAL_COLS + [d[0] for d in DERIVED] + ["source_dataset", "source_url"]


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def fmt(x, nd=None):
    if x is None:
        return ""
    if nd is not None:
        x = round(x, nd)
    return str(int(x)) if x == int(x) and abs(x) < 1e15 else repr(x)


def pivot(rows):
    out = {}
    for r in rows:
        key = (r["report_year"], r.get("state_ntd_id", ""), r["ntd_id"], r["mode"], r["type_of_service"])
        rec = out.get(key)
        if rec is None:
            rec = out[key] = {
                "report_year": r["report_year"], "ntd_id": r["ntd_id"], "state_ntd_id": r.get("state_ntd_id", ""),
                "agency_name": r.get("agency_name", ""), "city": r.get("city", ""), "state": r.get("state", ""),
                "reporter_type": r.get("reporter_type", ""), "uace_code": r.get("uace_code", ""),
                "uza_name": r.get("primary_uza_name", ""), "uza_population": r.get("uza_population", ""),
                "mode": r["mode"], "mode_name": MODE_NAMES.get(r["mode"], ""), "tos": r["type_of_service"],
                "mode_status": r.get("mode_status", ""),
            }
        if r.get("mode_status") == "Operating":
            rec["mode_status"] = "Operating"
        col = FIELDS.get(r["field"])
        if col and "value" in r:
            rec[col] = num(r["value"])
    return out


def derive(rec):
    for name, a, b in DERIVED:
        x, y = rec.get(a), rec.get(b)
        rec[name] = (x / y) if (x is not None and y is not None and y > 0) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=None)
    ap.add_argument("--from-year", type=int, default=2020)
    a = ap.parse_args()
    cache = os.path.join(a.cache, f"{DATASET}_{a.from_year}.json") if a.cache else None
    if cache and os.path.exists(cache):
        rows = json.load(open(cache))
    else:
        rows = s.fetch_all(DATASET, where=f"report_year>='{a.from_year}'")
        if cache:
            os.makedirs(a.cache, exist_ok=True)
            json.dump(rows, open(cache, "w"))
    recs = pivot(rows)
    url = f"{HOST}/d/{DATASET}"
    n_out = 0
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        for key in sorted(recs, key=lambda k: (k[0], k[2], k[1], k[3], k[4])):
            rec = recs[key]
            derive(rec)
            # keep rows that carry any measured value
            if all(rec.get(c) is None for c in VAL_COLS):
                continue
            row = [rec.get(c, "") if c in ID_COLS else fmt(rec.get(c), 6 if c in [d[0] for d in DERIVED] else None) for c in ID_COLS + VAL_COLS + [d[0] for d in DERIVED]]
            w.writerow(row + [DATASET, url])
            n_out += 1
    years = sorted({k[0] for k in recs})
    meta = {
        "generated_by": "scripts/transit/fetch_ntd_annual.py",
        "primary": s.view_meta(HOST, DATASET), "cross_check": s.view_meta(HOST, CHECK_DATASET),
        "report_years": years, "rows_written": n_out, "raw_long_rows": len(rows), "formulas": FORMULAS,
        "mode_names": MODE_NAMES,
    }
    json.dump(meta, open(OUT_META, "w"), indent=1)
    print(f"wrote {n_out} agency-mode-type-of-service-year rows for report years {years} to {OUT_CSV}")


if __name__ == "__main__":
    main()
