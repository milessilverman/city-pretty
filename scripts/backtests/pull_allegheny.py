#!/usr/bin/env python3
"""Allegheny County (PA) single-family sales for the home-value back-test (FIPS 42003).

Sources (Allegheny County via the Western Pennsylvania Regional Data Center, WPRDC; public, no key):
  Property Sale Transactions  5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1  every recorded transfer with the county's
                              sale-validity code (SALECODE / SALEDESC)
  Property Assessments        65855e14-549e-4992-b5be-d629afc676fa  characteristics: FINISHEDLIVINGAREA, LOTAREA,
                              YEARBLT, BEDROOMS, FULLBATHS, HALFBATHS, CLASS, USEDESC, CARDNUMBER
  Parcel Centroids (Mar 2025) 3fab7152-3f11-4788-8372-4c33f86ea813  each parcel's 2020 tract and block group

Filters, stated and applied here:
  * SALECODE '0' = SALEDESC 'VALID SALE' (the county's own validity determination; every other code, e.g.
    'LOVE AND AFFECTION SALE', 'MULTI-PARCEL SALE', 'SHERIFF SALE', 'TIME ON MARKET (INSUFF/EXCESS)', is excluded)
  * instrument type DEED; price >= $25,000
  * assessment record: CLASS 'R', USEDESC 'SINGLE FAMILY', living area >= 400 sq ft, year built not after the sale
Assessed values are NOT used: Allegheny's values date from the 2013 base year but are changed by appeals, which
often use a recent purchase price, so a value cannot be shown to predate a given sale.
The page cannot run a model here yet: its Allegheny parcel layer has only the parcel ID and acreage, and WPRDC's API
sends no cross-origin header, so the browser cannot fetch the characteristics at parcel open.

Output: data/backtests/sales_42003_<date>.json.gz (shared schema; scripts/lib/countyValuationModels.mjs)
"""
import csv
import gzip
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "https://data.wprdc.org/api/3/action/datastore_search_sql"
SALES, ASSESS, CENTROIDS = "5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1", "65855e14-549e-4992-b5be-d629afc676fa", "3fab7152-3f11-4788-8372-4c33f86ea813"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def sql(q, tries=6):
    url = API + "?" + urllib.parse.urlencode({"sql": q})
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                d = json.load(r)
            if d.get("success"):
                return d["result"]["records"]
            last = d.get("error")
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 403:  # WPRDC's firewall rate-limits bursts; it clears after a minute or two
                time.sleep(45 * (i + 1))
                continue
        except Exception as e:
            last = e
        time.sleep(4 * (i + 1))
    raise RuntimeError(f"query failed: {last}")


def by_pins(resource, cols, pins, key):
    # One streamed CSV dump of the whole table (WPRDC's firewall blocks bursts of IN-list queries with HTTP 403).
    want = [c.strip('"') for c in cols.split(",")]
    url = f"https://data.wprdc.org/datastore/dump/{resource}"
    out, seen = {}, 0
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        for rec in csv.DictReader(io.TextIOWrapper(r, encoding="utf-8", newline="")):
            seen += 1
            if rec.get(key) in pins:
                out.setdefault(rec[key], []).append({c: (rec.get(c) if rec.get(c) != "" else None) for c in want})
    print(f"  {resource[:8]}: {seen} rows read, {len(out)} of {len(pins)} pins found", file=sys.stderr)
    return out


def main():
    today = date.today().isoformat()
    sales, last = [], 0
    while True:
        rows = sql(f'SELECT "_id","PARID","SALEDATE","PRICE","SALECODE","SALEDESC","INSTRTYP" FROM "{SALES}" '
                   f'WHERE "SALEDATE" >= \'2023-01-01\' AND "SALECODE" = \'0\' AND "INSTRTYP" = \'DE\' AND "_id" > {last} ORDER BY "_id" LIMIT 20000')
        if not rows:
            break
        sales += rows
        last = rows[-1]["_id"]
        print(f"  sales: {len(sales)}", file=sys.stderr)
    pins = {s["PARID"] for s in sales}
    ass = by_pins(ASSESS, '"PARID","CLASS","USEDESC","FINISHEDLIVINGAREA","LOTAREA","YEARBLT","BEDROOMS","FULLBATHS","HALFBATHS","CARDNUMBER"', pins, "PARID")
    cen = by_pins(CENTROIDS, '"PIN","GEOID","FIPS_BLOCKGROUP"', pins, "PIN")

    num = lambda v: float(v) if v not in (None, "") else None
    drop, rows = Counter(), []
    for s in sales:
        price, d = num(s["PRICE"]), str(s["SALEDATE"])[:10]
        if not price or price < 25000:
            drop["price under $25,000"] += 1
            continue
        a = ass.get(s["PARID"]) or []
        if len(a) != 1:
            drop["no single assessment record (missing or several cards)"] += 1
            continue
        a = a[0]
        if a.get("CLASS") != "R" or str(a.get("USEDESC") or "").strip() != "SINGLE FAMILY":
            drop["not a single-family residential parcel"] += 1
            continue
        sq, lot, yb = num(a.get("FINISHEDLIVINGAREA")), num(a.get("LOTAREA")), num(a.get("YEARBLT"))
        if not (sq and sq >= 400) or not (lot and lot > 0) or not (yb and 1700 < yb <= int(d[:4])):
            drop["characteristics missing or built after the sale"] += 1
            continue
        c = (cen.get(s["PARID"]) or [None])[0]
        if not c or not c.get("GEOID") or c.get("FIPS_BLOCKGROUP") in (None, ""):
            drop["no parcel centroid block group"] += 1
            continue
        tract = str(int(c["GEOID"])).zfill(11)
        beds, fb, hb = num(a.get("BEDROOMS")), num(a.get("FULLBATHS")), num(a.get("HALFBATHS"))
        if beds is None or fb is None:  # the shared model code would read a missing count as 0 (null >= 0 in JS)
            drop["bedroom or full-bath count missing"] += 1
            continue
        rows.append({"id": s["PARID"], "price": price, "date": d, "bg": tract + str(int(c["FIPS_BLOCKGROUP"])), "tract": tract,
                     "sqft": sq, "lot": lot, "yb": int(yb), "eff": None, "beds": beds,
                     "baths": (fb + 0.5 * (hb or 0)) if fb is not None else None, "av": None, "av_date": None})

    out = {"county_fips": "42003", "county_name": "Allegheny County", "pulled": today,
           "sources": [f"WPRDC {SALES} (Property Sale Transactions)", f"WPRDC {ASSESS} (Property Assessments)", f"WPRDC {CENTROIDS} (Parcel Centroids March 2025)"],
           "filters": ["SALECODE '0' = 'VALID SALE' (county validity code)", "instrument DEED", "price >= $25,000",
                       "assessment: CLASS R, USEDESC SINGLE FAMILY, one card, living area >= 400 sq ft, year built not after the sale, bedroom and full-bath counts present"],
           "counts": {"valid_deed_sales_2023_on": len(sales), "dropped": dict(drop), "kept": len(rows)},
           "rows": sorted(rows, key=lambda r: (r["date"], r["id"]))}
    with gzip.open(os.path.join(ROOT, "data", "backtests", f"sales_42003_{today}.json.gz"), "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(json.dumps(out["counts"], indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
