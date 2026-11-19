#!/usr/bin/env python3
"""New York City one- and two-family sales for the home-value back-test, one file per borough (county).

Sources (NYC Department of Finance and Department of City Planning, NYC Open Data; public, no key):
  Annualized Calendar Sales (w2pb-icbu)  recorded sales by calendar year, 2016-2025
  Rolling Sales (usep-8jbt)              recorded sales over the prior twelve months (here Oct 2025 - Sep 2026)
  PLUTO 26v2 (64uk-42ks)                 lot and building characteristics and the 2020 Census block, by BBL.
      PLUTO is also the parcel layer the page reads at parcel open (NYC MapPLUTO), so the model's inputs
      (building area, lot area, year built, residential units) are the same fields the page has.

Filters, stated and applied here:
  * building class category 01 ONE FAMILY DWELLINGS or 02 TWO FAMILY DWELLINGS at the time of sale
  * sale price >= $25,000. DOF's glossary: "A $0 sale indicates that there was a transfer of ownership without a cash
    consideration. There can be a number of reasons for a $0 sale including transfers of ownership from parents to
    children." Nominal prices ($1-$24,999) are dropped for the same reason.
  * multi-lot transactions dropped: the same sale date and price recorded on more than one lot in the same borough
    tax block (a package price, not one home's)
  * PLUTO: residential units 1 or 2; building area >= 400 sq ft; year built after 1700 and not after the sale year
    (PLUTO describes the lot today; a building built after the sale is not what was sold)
No assessor value is used (NYC market values are set each January; the back-test does not need them).

Output: data/backtests/sales_<county fips>_<date>.json.gz per borough (shared schema; scripts/lib/countyValuationModels.mjs)
"""
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOC = "https://data.cityofnewyork.us/resource"
ANNUAL, ROLLING, PLUTO = "w2pb-icbu", "usep-8jbt", "64uk-42ks"
BORO = {"1": ("36061", "New York County (Manhattan)"), "2": ("36005", "Bronx County"), "3": ("36047", "Kings County (Brooklyn)"),
        "4": ("36081", "Queens County"), "5": ("36085", "Richmond County (Staten Island)")}
PLUTO_BORO = {"MN": "1", "BX": "2", "BK": "3", "QN": "4", "SI": "5"}
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
PAGE = 50000


def get(dataset, params, tries=6):
    url = f"{SOC}/{dataset}.json?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"{dataset}: {last}")


def pull(dataset, where, select):
    out, off = [], 0
    while True:
        rows = get(dataset, {"$where": where, "$select": select, "$order": ":id", "$limit": PAGE, "$offset": off})
        out += rows
        print(f"  {dataset}: {len(out)}", file=sys.stderr)
        if len(rows) < PAGE:
            return out
        off += PAGE


def num(v):
    try:
        return float(str(v).replace(",", "").replace("$", "").strip())
    except (TypeError, ValueError):
        return None


def main():
    today = date.today().isoformat()
    cat = "(starts_with(building_class_category, '01') OR starts_with(building_class_category, '02'))"
    sel = "borough,block,lot,building_class_category,sale_price,sale_date"
    sales = pull(ANNUAL, f"sale_date >= '2023-01-01' AND {cat}", sel) + pull(ROLLING, f"sale_date >= '2026-01-01' AND {cat}", sel)
    raw_n = len(sales)

    def bbl(s):
        return f"{int(s['borough'])}{int(s['block']):05d}{int(s['lot']):04d}"

    seen, uniq = set(), []
    for s in sales:  # the rolling file overlaps the annualized one; keep each (BBL, date, price) once
        k = (bbl(s), s["sale_date"][:10], s["sale_price"])
        if k not in seen:
            seen.add(k)
            uniq.append(s)
    pkg = Counter((s["sale_date"][:10], num(s["sale_price"]), s["borough"], int(s["block"])) for s in uniq)

    pl = pull(PLUTO, "unitsres in ('1','2')", "bbl,borough,bctcb2020,bldgarea,lotarea,yearbuilt,unitsres")
    pluto = {}
    for p in pl:
        try:
            pluto[str(int(float(p["bbl"])))] = p
        except (TypeError, ValueError, KeyError):
            pass

    drop = Counter()
    per = {f: [] for f, _ in BORO.values()}
    for s in uniq:
        price, d = num(s["sale_price"]), s["sale_date"][:10]
        if not price or price < 25000:
            drop["price under $25,000 (DOF: $0 = no cash consideration)"] += 1
            continue
        if pkg[(d, price, s["borough"], int(s["block"]))] > 1:
            drop["same date and price on more than one lot in the same tax block (package sale)"] += 1
            continue
        b = bbl(s)
        p = pluto.get(b)
        if not p:
            drop["no PLUTO lot with 1-2 residential units for this BBL"] += 1
            continue
        sq, lot, yb, units = num(p.get("bldgarea")), num(p.get("lotarea")), num(p.get("yearbuilt")), num(p.get("unitsres"))
        if not (sq and sq >= 400) or not (lot and lot > 0) or not (yb and 1700 < yb <= int(d[:4])) or units not in (1, 2):
            drop["PLUTO characteristics missing or built after the sale"] += 1
            continue
        cb = str(p.get("bctcb2020") or "")
        if len(cb) != 11:
            drop["no 2020 Census block in PLUTO"] += 1
            continue
        fips = BORO[cb[0]][0]
        tract = fips + cb[1:7]
        per[fips].append({"id": b, "price": price, "date": d, "bg": tract + cb[7], "tract": tract, "sqft": sq, "lot": lot, "yb": int(yb),
                          "eff": None, "beds": None, "baths": None, "units": int(units), "av": None, "av_date": None})

    sources = [f"{SOC}/{ANNUAL} (NYC DOF Annualized Calendar Sales, 2023-2025)", f"{SOC}/{ROLLING} (NYC DOF Rolling Sales, 2026)",
               f"{SOC}/{PLUTO} (NYC DCP PLUTO 26v2: bldgarea, lotarea, yearbuilt, unitsres, bctcb2020)"]
    filters = ["building class category 01 or 02 at sale", "sale price >= $25,000 (DOF glossary: a $0 sale is a transfer without cash consideration)",
               "same date and price on more than one lot in the same tax block dropped (package sales)", "PLUTO: 1-2 residential units, building area >= 400 sq ft, year built not after the sale year"]
    for code, (fips, name) in BORO.items():
        out = {"county_fips": fips, "county_name": name, "pulled": today, "sources": sources, "filters": filters,
               "counts": {"sales_rows_pulled_all_boroughs": raw_n, "unique_all_boroughs": len(uniq), "dropped_all_boroughs": dict(drop), "kept": len(per[fips])},
               "rows": sorted(per[fips], key=lambda r: (r["date"], r["id"]))}
        with gzip.open(os.path.join(ROOT, "data", "backtests", f"sales_{fips}_{today}.json.gz"), "wt") as f:
            json.dump(out, f, separators=(",", ":"))
        print(f"{fips} {name}: {len(per[fips])} sales", file=sys.stderr)
    print(json.dumps(dict(drop), indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
