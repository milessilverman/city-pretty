#!/usr/bin/env python3
"""Batch fetcher and parser for the FHFA Annual Tract-Level House Price Index (All-Transactions).

Data Source:
  Federal Housing Finance Agency (FHFA)
  URL: https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv
  Licence: not confirmed; no FHFA licence text found on 19 Nov 2026 (an "FAQ Q32" cited here earlier could not be found)
  Citation: "Source: FHFA HPI (Annual, All-Transactions)"
  Status Label: "developmental" (fhfa.gov/data/hpi/datasets lists the file as "Census Tracts (Developmental Index; Not Seasonally Adjusted)")

File Format:
  Long-form CSV: one row per tract per year.
  Columns typically: tract, state, year, annual_change, hpi, hpi1990, hpi2000
  Missing / blank HPI values are treated as null/None, NEVER zeroed.

Usage:
  python3 scripts/fetch_fhfa_hpi_tract.py [--county FIPS] [--input CSV_PATH] [--output JSON_PATH]
"""

import argparse
import csv
import io
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_URL = "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv"
DEFAULT_OUT_DIR = os.path.join(ROOT, "app", "data", "fhfa_hpi")
CITATION = "Source: FHFA HPI (Annual, All-Transactions)"
STATUS_LABEL = "developmental"
USER_AGENT = "city-pretty-data-pipeline/1.0"


def parse_num(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "null", ".", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_fhfa_tract_stream(reader, target_county_fips=None):
    """Parses rows from a CSV reader into structured tract time series.

    target_county_fips: optional 5-digit string (e.g. '06037'). If provided, filters to tracts starting with this FIPS.
    """
    tracts = {}

    header = None
    for row in reader:
        if not row:
            continue
        if header is None:
            # Clean header keys
            header = [col.strip().lower().replace('"', "") for col in row]
            col_map = {col: idx for idx, col in enumerate(header)}
            tract_idx = col_map.get("tract") or col_map.get("tract_fips") or 0
            year_idx = col_map.get("year") or 2
            hpi_idx = col_map.get("hpi") or 4
            chg_idx = col_map.get("annual_change") or col_map.get("annual_change_pct") or 3
            state_idx = col_map.get("state") or col_map.get("state_abbr") or 1
            continue

        raw_tract = row[tract_idx].strip().replace('"', "")
        clean_fips = "".join(c for c in raw_tract if c.isdigit())
        if len(clean_fips) < 11:
            # Pad or skip invalid
            if len(clean_fips) == 10:
                clean_fips = "0" + clean_fips
            else:
                continue

        if target_county_fips and not clean_fips.startswith(target_county_fips):
            continue

        raw_year = row[year_idx].strip().replace('"', "")
        if not raw_year.isdigit():
            continue
        year = int(raw_year)

        raw_hpi = row[hpi_idx] if hpi_idx < len(row) else None
        hpi_val = parse_num(raw_hpi)

        raw_chg = row[chg_idx] if chg_idx < len(row) else None
        chg_val = parse_num(raw_chg)

        st_abbr = row[state_idx].strip().replace('"', "") if state_idx < len(row) else ""

        if clean_fips not in tracts:
            tracts[clean_fips] = {
                "tract_fips": clean_fips,
                "state_abbr": st_abbr,
                "history": {},
            }

        tracts[clean_fips]["history"][year] = {
            "hpi": hpi_val,
            "annual_change_pct": chg_val,
        }

    # Post-process summaries per tract
    results = {}
    for fips, data in tracts.items():
        hist = data["history"]
        years = sorted(hist.keys())
        if not years:
            continue

        # Find latest non-null HPI year
        latest_year = None
        latest_hpi = None
        for y in reversed(years):
            if hist[y]["hpi"] is not None:
                latest_year = y
                latest_hpi = hist[y]["hpi"]
                break

        if latest_hpi is None or latest_year is None:
            continue

        annual_change_pct = hist[latest_year]["annual_change_pct"]

        # 5-year CAGR
        five_yr_cagr_pct = None
        target_5y = latest_year - 5
        past_5y_hpi = hist.get(target_5y, {}).get("hpi")
        if past_5y_hpi is not None and past_5y_hpi > 0 and latest_hpi > 0:
            five_yr_cagr_pct = round(((latest_hpi / past_5y_hpi) ** (1.0 / 5.0) - 1.0) * 100.0, 2)

        # 10-year total appreciation
        ten_yr_apprec_pct = None
        target_10y = latest_year - 10
        past_10y_hpi = hist.get(target_10y, {}).get("hpi")
        if past_10y_hpi is not None and past_10y_hpi > 0:
            ten_yr_apprec_pct = round(((latest_hpi - past_10y_hpi) / past_10y_hpi) * 100.0, 2)

        results[fips] = {
            "tract_fips": fips,
            "state_abbr": data["state_abbr"],
            "latest_year": latest_year,
            "latest_hpi": latest_hpi,
            "annual_change_pct": annual_change_pct,
            "five_year_cagr_pct": five_yr_cagr_pct,
            "ten_year_appreciation_pct": ten_yr_apprec_pct,
            "series_count": len([y for y in years if hist[y]["hpi"] is not None]),
        }

    return results


def fetch_fhfa_tract_hpi(csv_path_or_url=None, target_county_fips=None):
    source_url = csv_path_or_url or DEFAULT_URL
    if source_url.startswith("http://") or source_url.startswith("https://"):
        req = urllib.request.Request(source_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            reader = csv.reader(io.StringIO(text))
            data = parse_fhfa_tract_stream(reader, target_county_fips)
    else:
        with open(source_url, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            data = parse_fhfa_tract_stream(reader, target_county_fips)

    payload = {
        "_meta": {
            "source": CITATION,
            "url": source_url if source_url.startswith("http") else DEFAULT_URL,
            "status_label": STATUS_LABEL,
            "licence": "Not confirmed: no FHFA licence text found (19 Nov 2026); the FAQ Q32 cited earlier could not be found",
            "retrieved_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "target_county_fips": target_county_fips,
            "tracts_count": len(data),
            "citation": CITATION,
            "note": "FHFA lists tract indexes as 'Census Tracts (Developmental Index; Not Seasonally Adjusted)' (fhfa.gov/data/hpi/datasets, read 19 Nov 2026). Missing years are null, not zeroed.",
        },
        "tracts": data,
    }
    return payload


def main():
    parser = argparse.ArgumentParser(description="Fetch and parse FHFA tract annual HPI CSV.")
    parser.add_argument("--county", help="5-digit county FIPS filter (e.g. 06037 for Los Angeles)")
    parser.add_argument("--input", help="Local CSV file path to parse instead of downloading from FHFA")
    parser.add_argument("--output", help="Output JSON path")
    args = parser.parse_args()

    out_dir = DEFAULT_OUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    out_path = args.output
    if not out_path:
        filename = f"{args.county}.json" if args.county else "fhfa_tract_hpi_national.json"
        out_path = os.path.join(out_dir, filename)

    print(f"Fetching / parsing FHFA tract HPI (county={args.county}, input={args.input})...")
    payload = fetch_fhfa_tract_hpi(args.input, args.county)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Successfully wrote {payload['_meta']['tracts_count']} tracts to {out_path}")


if __name__ == "__main__":
    main()
