#!/usr/bin/env python3
"""Cook County, Illinois single-family sales for the home-value back-test (county FIPS 17031).

Sources (Cook County Assessor's Office open data, Socrata, https://datacatalog.cookcountyil.gov; public, no key):
  wvhk-k5uv  Assessor - Parcel Sales
  x54s-btds  Assessor - Single and Multi-Family Improvement Characteristics (living area, lot, year built, beds, baths)
  pabr-t5kh  Assessor - Parcel Universe (Current): census_block_group_geoid for each PIN

Arm's-length filter, stated and applied here (the Assessor's own sale screens, as documented in wvhk-k5uv):
  * sale_filter_same_sale_within_365 = false  ("Remove sale with the same value (for the same PIN) within 365 days")
  * sale_filter_less_than_10k = false         ("Indicator for whether sale is less than $10K FMW")
  * sale_filter_deed_type = false             ("Indicator for quit claim, executor, beneficiary and missing deed types")
  * is_multisale = false                      (sold on its own, not as part of a group of PINs)
  * sale_price >= $25,000
  * the PIN's improvement record says char_use = 'Single-Family' (the Assessor's own use field)
Characteristics: the record for the sale year, or the latest earlier year on file.
Assessor values are NOT used for Cook (a reassessment's market value may postdate and reflect the sale).

Output: data/backtests/sales_17031_<date>.json.gz (shared schema; see scripts/lib/countyValuationModels.mjs).
"""
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = "https://datacatalog.cookcountyil.gov/resource"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def get(ds, params, tries=6):
    url = f"{API}/{ds}.json?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(3 * (i + 1))
    raise last


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main():
    since = sys.argv[1] if len(sys.argv) > 1 else "2023-01-01"
    where = (f"sale_date >= '{since}' AND sale_price >= 25000 AND sale_filter_same_sale_within_365 = false AND "
             "sale_filter_less_than_10k = false AND sale_filter_deed_type = false AND is_multisale = false")
    sales, off = [], 0
    while True:
        page = get("wvhk-k5uv", {"$where": where, "$select": "pin,sale_date,sale_price,class,deed_type", "$order": "row_id", "$limit": 50000, "$offset": off})
        sales += page
        print(f"  {len(sales)} sales", file=sys.stderr)
        if len(page) < 50000:
            break
        off += len(page)
    # keep residential classes only before the characteristics lookup (class 2xx); single-family is decided by char_use
    sales = [s for s in sales if str(s.get("class", "")).startswith("2") and s.get("class") != "299"]
    pins = sorted({s["pin"] for s in sales})
    print(f"{len(sales)} class-2 sales on {len(pins)} PINs", file=sys.stderr)

    chars, geo = {}, {}
    for i in range(0, len(pins), 300):
        chunk = ",".join(f"'{p}'" for p in pins[i:i + 300])
        for r in get("x54s-btds", {"$where": f"pin in ({chunk})", "$select": "pin,year,char_use,char_bldg_sf,char_land_sf,char_yrblt,char_beds,char_fbath,char_hbath", "$limit": 50000}):
            chars.setdefault(r["pin"], []).append(r)
        for r in get("pabr-t5kh", {"$where": f"pin in ({chunk})", "$select": "pin,census_block_group_geoid", "$limit": 50000}):
            if r.get("census_block_group_geoid"):
                geo[r["pin"]] = r["census_block_group_geoid"]
        if i % 6000 == 0:
            print(f"  characteristics for {min(i + 300, len(pins))} PINs", file=sys.stderr)

    rows, drop = [], {}
    def no(k):
        drop[k] = drop.get(k, 0) + 1
    for s in sales:
        yr = int(s["sale_date"][:4])
        recs = sorted((c for c in chars.get(s["pin"], []) if int(float(c["year"])) <= yr), key=lambda c: float(c["year"]))
        if not recs:
            no("no improvement record for the sale year"); continue
        c = recs[-1]
        if c.get("char_use") != "Single-Family":
            no("not single-family (char_use)"); continue
        bg = geo.get(s["pin"])
        if not bg or len(bg) < 12:
            no("no block group"); continue
        sqft = num(c.get("char_bldg_sf"))
        if not (sqft and sqft >= 400):
            no("living area missing or under 400 sq ft"); continue
        yb = num(c.get("char_yrblt"))
        fb, hb = num(c.get("char_fbath")), num(c.get("char_hbath"))
        rows.append({
            "id": s["pin"], "price": float(s["sale_price"]), "date": s["sale_date"][:10], "bg": bg[:12], "tract": bg[:11],
            "sqft": sqft, "lot": num(c.get("char_land_sf")), "yb": int(yb) if yb and yb > 1700 else None, "eff": None,
            "beds": num(c.get("char_beds")), "baths": (fb or 0) + 0.5 * (hb or 0) if fb is not None else None,
            "av": None, "av_date": None,
        })
    out = {
        "county_fips": "17031", "county_name": "Cook County", "pulled": date.today().isoformat(),
        "sources": {k: f"{API}/{k}.json" for k in ("wvhk-k5uv", "x54s-btds", "pabr-t5kh")},
        "filters": __doc__.split("Arm's-length filter, stated and applied here (the Assessor's own sale screens, as documented in wvhk-k5uv):")[1].split("Output:")[0].strip(),
        "dropped": drop, "rows": rows,
    }
    path = os.path.join(ROOT, "data", "backtests", f"sales_17031_{date.today().isoformat()}.json.gz")
    with gzip.open(path, "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {path}: {len(rows)} sales; dropped {drop}", file=sys.stderr)


if __name__ == "__main__":
    main()
