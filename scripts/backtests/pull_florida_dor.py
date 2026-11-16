#!/usr/bin/env python3
"""Florida single-family sales for the home-value back-test, from the Department of Revenue's own tax-roll files.

Replaces scripts/backtests/pull_florida.py, whose statewide map service rejected queries after ~26,000 rows.

Sources (Florida Department of Revenue, Property Tax Oversight data portal; public, no key):
  SDF (sale data file), 2026 Final roll:  every sale recorded on the roll with the property appraiser's
      qualification code (QUAL_CD), sale year/month and price. It covers sales in 2025 and 2026.
  NAL (name-address-legal), 2026 Final roll: characteristics and values as of 1 January 2026: DOR_UC, JV (just
      value), TOT_LVG_AREA, LND_SQFOOT, ACT_YR_BLT, NO_RES_UNT, CENSUS_BK (the 2010 block group; see pull_florida.py).
  Code meanings: DOR's 2026 NAL/SDF/NAP User's Guide, Field 55 (QUAL_CD):
      "01 Transfers qualified as arm's length because of examination of the deed or other instrument transferring
       ownership of real property"
      "02 Transfers qualified as arm's length because of documented evidence"
      Both are "Real property transfers qualified and included in sales ratio analysis."

Filters, stated and applied here:
  * QUAL_CD 01 or 02; MULTI_PAR_SAL blank (not a multi-parcel sale); SALE_PRC >= $25,000
  * NAL: DOR use code 001 (single family), one residential unit, living area >= 400 sq ft, year built not after the
    sale year
  * the sale's own month is the 1st of the month (SDF gives year and month only); a sale is dated YYYY-MM-01 for
    windowing, so a window boundary falls between months.
Assessor value: JV, Florida's just value as of 1 January 2026 (s. 192.042, F.S.), av_date 2026-01-01. It predates
every 2026 sale, so it may be used for sales in the test window. (Caveat recorded with the results: values are set
as of 1 January but certified later in the year.)

Usage: python3 scripts/backtests/pull_florida_dor.py <county number> <county fips> "<DOR file name>" ["<display name>"]
       e.g. 39 12057 "Hillsborough"
Output: data/backtests/sales_<fips>_<date>.json.gz (shared schema; scripts/lib/countyValuationModels.mjs)
"""
import csv
import gzip
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = "https://floridarevenue.com/property/dataportal/Documents/PTO Data Portal/Tax Roll Data Files"
UA = {"User-Agent": "Mozilla/5.0 (city-pretty-data-pipeline/1.0)"}
csv.field_size_limit(10_000_000)


def fetch_zip(kind, name):
    url = urllib.parse.quote(f"{BASE}/{kind}/2026F/{name} {kind} 2026.zip", safe=":/")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    member = [m for m in z.namelist() if m.lower().endswith(".csv")][0]
    return url, list(csv.DictReader(io.TextIOWrapper(z.open(member), encoding="latin-1")))


def main():
    co, fips, cname = sys.argv[1], sys.argv[2], sys.argv[3]
    display = sys.argv[4] if len(sys.argv) > 4 else cname   # DOR files Miami-Dade as "Dade"
    today = date.today().isoformat()
    label = f"{cname} {co} Final"
    sdf_url, sdf = fetch_zip("SDF", label)
    nal_url, nal = fetch_zip("NAL", label)
    print(f"{cname}: {len(sdf)} SDF rows, {len(nal)} NAL rows", file=sys.stderr)
    num = lambda v: float(v) if v not in (None, "") else None
    parcels = {r["PARCEL_ID"]: r for r in nal}

    drop, rows = Counter(), []
    for s in sdf:
        if s.get("QUAL_CD") not in ("01", "02"):
            drop["not qualified (QUAL_CD not 01/02)"] += 1
            continue
        if (s.get("MULTI_PAR_SAL") or "").strip():
            drop["multi-parcel sale"] += 1
            continue
        price = num(s.get("SALE_PRC"))
        if not price or price < 25000:
            drop["price under $25,000"] += 1
            continue
        p = parcels.get(s["PARCEL_ID"])
        if not p:
            drop["parcel not on the 2026 NAL roll"] += 1
            continue
        yr, mo = int(s["SALE_YR"]), int(s["SALE_MO"])
        # bulk NAL field names (the map service truncates them: NO_RES_UNTS -> NO_RES_UNT, TOT_LVG_AREA -> TOT_LVG_AR)
        sq, lot, yb, units, jv = num(p.get("TOT_LVG_AREA")), num(p.get("LND_SQFOOT")), num(p.get("ACT_YR_BLT")), num(p.get("NO_RES_UNTS")), num(p.get("JV"))
        if str(p.get("DOR_UC") or "").zfill(3) != "001" or units != 1:
            drop["not a one-unit single-family parcel (DOR use code 001)"] += 1
            continue
        if not (sq and sq >= 400) or not (lot and lot > 0) or not (yb and 1700 < yb <= yr):
            drop["characteristics missing or built after the sale"] += 1
            continue
        bg = str(p.get("CENSUS_BK") or "")
        if len(bg) < 12 or not bg.startswith(fips):
            drop["no block group on the roll"] += 1
            continue
        bg = bg[:12]
        rows.append({"id": s["PARCEL_ID"], "price": price, "date": f"{yr}-{mo:02d}-01", "bg": bg, "tract": bg[:11],
                     "sqft": sq, "lot": lot, "yb": int(yb), "eff": None, "beds": None, "baths": None, "units": 1,
                     "av": jv, "av_date": "2026-01-01"})

    out = {"county_fips": fips, "county_name": f"{display} County", "pulled": today,
           "sources": [f"{sdf_url} (Florida DOR SDF, 2026 Final roll: sales 2025-2026, QUAL_CD)", f"{nal_url} (Florida DOR NAL, 2026 Final roll: characteristics and just value as of 1 Jan 2026)",
                       "https://floridarevenue.com/property/dataportal/Documents/PTO Data Portal/User Guides/2026 Users guide and quick reference/2026_NAL_SDF_NAP_Users_Guide.pdf (QUAL_CD definitions)"],
           "filters": ["QUAL_CD 01 or 02 (DOR: qualified as arm's length, included in sales ratio analysis)", "not a multi-parcel sale", "price >= $25,000",
                       "DOR use code 001, one residential unit, living area >= 400 sq ft, year built not after the sale year", "sale dated to the 1st of its month (SDF has year and month only)"],
           "counts": {"sdf_rows": len(sdf), "dropped": dict(drop), "kept": len(rows)},
           "rows": sorted(rows, key=lambda r: (r["date"], r["id"]))}
    with gzip.open(os.path.join(ROOT, "data", "backtests", f"sales_{fips}_{today}.json.gz"), "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(json.dumps(out["counts"], indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
