#!/usr/bin/env python3
"""Build app/data/transit_operating_benchmarks.json from data/transit/ntd_agency_mode_annual.csv.

For every report year in the table, every mode (and mode + type of service), computes across agency rows:
n, 25th percentile, median, 75th percentile, min, max of the derived ratios, plus the pooled ratio (sum of numerator /
sum of denominator over the same rows). Quartiles use linear interpolation between order statistics (the "inclusive"
method, the same as numpy's default and spreadsheet QUARTILE.INC).

Row rules (stated so they can be checked): a row counts toward a ratio only when the mode_status is "Operating", both
inputs are present, the denominator is above zero and the numerator is above zero (a zero fare or zero expense is a
reporting gap in this table, not a measured zero). No outlier trimming. Two cuts are published:
  all           every qualifying agency row
  top50_upt     the 50 qualifying rows with the most unlinked passenger trips in that mode and year
Usage: python3 scripts/transit/build_operating_benchmarks.py
"""
import csv, json, os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "data", "transit", "ntd_agency_mode_annual.csv")
META = os.path.join(ROOT, "data", "transit", "ntd_sources.json")
OUT = os.path.join(ROOT, "app", "data", "transit_operating_benchmarks.json")

METRICS = {  # name: (numerator, denominator, unit, formula)
    "opex_per_vrh": ("opex", "vrh", "USD per vehicle revenue hour", "operating expenses / vehicle revenue hours"),
    "opex_per_vrm": ("opex", "vrm", "USD per vehicle revenue mile", "operating expenses / vehicle revenue miles"),
    "opex_per_upt": ("opex", "upt", "USD per unlinked passenger trip", "operating expenses / unlinked passenger trips"),
    "fare_per_upt": ("fares", "upt", "USD per unlinked passenger trip", "fare revenues / unlinked passenger trips"),
    "farebox_recovery": ("fares", "opex", "ratio (0 to 1+)", "fare revenues / operating expenses"),
    "avg_trip_miles": ("pmt", "upt", "miles per unlinked passenger trip", "passenger miles traveled / unlinked passenger trips"),
    "vrh_per_route_mile": ("vrh", "drm", "vehicle revenue hours per directional route mile", "vehicle revenue hours / directional route miles"),
}
RAIL_BRT = ["HR", "LR", "SR", "CR", "YR", "MG", "RB"]


def num(x):
    try:
        return float(x) if x != "" else None
    except ValueError:
        return None


def quart(vals):
    v = sorted(vals)
    if len(v) == 1:
        return v[0], v[0], v[0]
    q = statistics.quantiles(v, n=4, method="inclusive")
    return q[0], q[1], q[2]


def r(x, nd=4):
    return None if x is None else round(x, nd)


def stat_block(rows, metric):
    a, b = METRICS[metric][0], METRICS[metric][1]
    use = [x for x in rows if x["mode_status"] == "Operating" and x[a] is not None and x[b] is not None and x[a] > 0 and x[b] > 0]
    if not use:
        return None
    vals = [x[a] / x[b] for x in use]
    p25, med, p75 = quart(vals)
    return {"n": len(use), "p25": r(p25), "median": r(med), "p75": r(p75), "min": r(min(vals)), "max": r(max(vals)),
            "pooled": r(sum(x[a] for x in use) / sum(x[b] for x in use))}


def cut_block(rows):
    out = {}
    for m in METRICS:
        s = stat_block(rows, m)
        if s:
            out[m] = s
    return out


def top50(rows):
    ok = [x for x in rows if x["mode_status"] == "Operating" and x["upt"] is not None and x["upt"] > 0]
    ok.sort(key=lambda x: -x["upt"])
    return ok[:50]


def main():
    meta = json.load(open(META))
    rows = []
    for d in csv.DictReader(open(SRC)):
        for k in ("fares", "opex", "vrh", "vrm", "upt", "pmt", "voms", "drm"):
            d[k] = num(d[k])
        rows.append(d)
    years = sorted({d["report_year"] for d in rows})
    latest = years[-1]
    by_mode = {}
    for key_fn, label in ((lambda d: d["mode"], "mode"), (lambda d: d["mode"] + "|" + d["tos"], "mode_tos")):
        groups = {}
        for d in rows:
            groups.setdefault((key_fn(d), d["report_year"]), []).append(d)
        for (k, y), g in groups.items():
            ent = by_mode.setdefault(k, {"mode": k.split("|")[0], "mode_name": g[0]["mode_name"], "tos": k.split("|")[1] if "|" in k else "all", "years": {}})
            blk = {"all": cut_block(g)}
            t = top50(g)
            if len(t) >= 5:
                blk["top50_upt"] = cut_block(t)
            ent["years"][y] = {"cuts": blk}
    # agency rows behind the rail / BRT medians for the latest year (full table is the CSV)
    agency_rows = []
    for d in rows:
        if d["report_year"] == latest and d["mode"] in RAIL_BRT and d["mode_status"] == "Operating":
            e = {k: d[k] for k in ("ntd_id", "agency_name", "state", "uza_name", "mode", "mode_name", "tos", "report_year")}
            for k in ("opex", "fares", "vrh", "vrm", "upt", "pmt", "voms", "drm"):
                e[k] = d[k]
            for m, (a, b, _u, _f) in METRICS.items():
                e[m] = r(d[a] / d[b]) if d[a] is not None and d[b] and d[b] > 0 and d[a] > 0 else None
            e["source_url"] = d["source_url"]
            agency_rows.append(e)
    agency_rows.sort(key=lambda e: (e["mode"], -(e["upt"] or 0)))
    out = {
        "meta": {
            "generated_by": "scripts/transit/build_operating_benchmarks.py",
            "source": "FTA National Transit Database, annual agency / mode / type-of-service data, via data.transportation.gov",
            "source_dataset": meta["primary"],
            "cross_check_dataset": meta["cross_check"],
            "report_years": years, "latest_report_year": latest,
            "agency_rows_file": "data/transit/ntd_agency_mode_annual.csv (every row carries source_dataset, source_url, report_year)",
            "dollars": "nominal US dollars of the report year (not inflation-adjusted); NTD report year is the agency fiscal year",
            "vehicle_unit_note": "for rail modes the NTD counts revenue hours and miles per railcar (vehicle), not per train",
            "metric_definitions": {m: {"unit": v[2], "formula": v[3]} for m, v in METRICS.items()},
            "quartile_method": "linear interpolation between order statistics (inclusive method, as numpy default)",
            "row_rules": "agency-mode-type-of-service rows with mode_status Operating, numerator and denominator both above zero, no trimming of outliers",
            "cuts": {"all": "every qualifying agency row", "top50_upt": "the 50 qualifying rows with most unlinked passenger trips in that mode and year (only where at least 5)"},
            "caveats": [
                "Report years 2020 and 2021 are pandemic years; use 2023 to latest for planning.",
                "Fare revenue for purchased-transportation (PT) rows is allocated differently in some agencies; this table and NTD's Metrics table disagree on fares for a small share of rows (see the audit file).",
                "Medians describe existing agencies, not a new line; a new line's cost can differ from the median of established systems.",
            ],
            "evaluate_transit_loader_arguments": {
                "note": "documentation only; evaluateTransit does not read these yet. Suggested injected argument ctx.operatingBenchmarks.",
                "shape": {
                    "operatingBenchmarks": {"<mode code e.g. LR>": {"year": "report year", "cut": "all | top50_upt",
                        "<metric e.g. opex_per_vrh>": {"n": "rows", "p25": "number", "median": "number", "p75": "number", "unit": "from meta.metric_definitions", "source_url": "meta.source_dataset.landing_url"}}},
                    "ridershipValidation": "rows of data/transit/station_boardings.csv: {system, station, lat, lon, avg_weekday_boardings, year, mode, source_url}",
                },
                "how_to_derive": "operating cost per year = vehicle revenue hours (service plan) x opex_per_vrh; fare revenue = trips x fare_per_upt; gap = operating cost - fare revenue; return null if any input is missing",
            },
        },
        "by_mode": by_mode,
        "agency_rows_rail_brt_latest_year": agency_rows,
    }
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes;", len(by_mode), "mode keys;", len(agency_rows), "agency rows")


if __name__ == "__main__":
    main()
