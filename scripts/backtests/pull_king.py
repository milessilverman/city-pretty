#!/usr/bin/env python3
"""King County (WA) single-family sales for the home-value back-test (FIPS 53033).

Sources (public, no key):
  King County Assessor bulk files, https://aqua.kingcounty.gov/extranet/assessor/ (downloaded 16 Nov 2026,
  files dated 14 Nov 2026): Real Property Sales (EXTR_RPSale), Residential Building (EXTR_ResBldg), Parcel
  (EXTR_Parcel), Value History (EXTR_ValueHistory_V), Lookup (EXTR_LookUp: code meanings).
  Parcel centroids: Washington State Current Parcels (WaTech), the page's own parcel layer for King County.
  2020 block groups: Census TIGERweb, Tracts_Blocks/MapServer/11 (Census 2020 block groups).

Sale screen (code meanings from the Assessor's own EXTR_LookUp table):
  * PrincipalUse 6 = RESIDENTIAL (LUType 2); PropertyClass 8 = Res-Improved property (LUType 4);
    PropertyType 11 = Household, single family units (LUType 1)
  * SaleInstrument 2 = Warranty Deed or 3 = Statutory Warranty Deed (LUType 6)
  * SaleReason 1 = None (LUType 5; every other reason, e.g. 4 Foreclosure, 8 Estate Settlement, 18 Other, excluded)
  * no SaleWarning at all (LUType 7: the Assessor's flags, e.g. 15 NO MARKET EXPOSURE, 26 IMP. CHARACTERISTICS
    CHANGED SINCE SALE, 45 MULTI-PARCEL SALE, 46 NON-REPRESENTATIVE SALE, 51 RELATED PARTY, FRIEND, OR NEIGHBOR)
  * price >= $25,000; the excise affidavit covers this one parcel only; document date 2023 or later
Building: exactly one residential building on the parcel, 1 living unit, living area >= 400 sq ft, year built not
after the sale, bedroom and full-bath counts present. baths = full + 3/4 + 0.5 x half.
Assessor value: ApprLandVal + ApprImpsVal for the tax year the page's parcel layer holds (tax year 2026: on 16 Nov,
410 of 413 value records sampled from the layer matched King's tax-year-2026 values, no other year more than 3).
av_date = ChangeDate of the parcel's latest record for that tax year.

Usage: python3 -I scripts/backtests/pull_king.py <raw dir with the zips> <tax year, e.g. 2026>
Output: data/backtests/sales_53033_<date>.json.gz (shared schema; scripts/lib/countyValuationModels.mjs)
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
import zipfile
from collections import Counter, defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WA = "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0/query"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/11/query"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def rows(raw, zipname, member):
    zf = zipfile.ZipFile(os.path.join(raw, zipname))
    return csv.DictReader(io.TextIOWrapper(zf.open(member), encoding="latin-1", newline=""))


def pin(r):
    return r["Major"].strip().zfill(6) + r["Minor"].strip().zfill(4)


def post(url, params, tries=5):
    data = urllib.parse.urlencode(params).encode()
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=300) as r:
                d = json.load(r)
            if "error" not in d:
                return d
            last = d["error"]
        except Exception as e:
            last = e
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"query failed: {last}")


def centroids(pins):
    out, pins = {}, sorted(pins)
    for i in range(0, len(pins), 400):
        chunk = ",".join(f"'{p}'" for p in pins[i:i + 400])
        d = post(WA, {"where": f"FIPS_NR='033' AND ORIG_PARCEL_ID IN ({chunk})", "outFields": "ORIG_PARCEL_ID",
                      "returnGeometry": "false", "returnCentroid": "true", "outSR": "4326", "f": "json"})
        for f in d.get("features", []):
            c = f.get("centroid")
            if c:
                out.setdefault(f["attributes"]["ORIG_PARCEL_ID"], []).append((c["x"], c["y"]))
        if i % 8000 == 0:
            print(f"  centroids: {min(i + 400, len(pins))}/{len(pins)}", file=sys.stderr)
    return out


def block_groups():
    d = post(TIGER, {"where": "STATE='53' AND COUNTY='033'", "outFields": "GEOID", "returnGeometry": "true",
                     "outSR": "4326", "f": "geojson"})
    polys = []
    for f in d["features"]:
        g = f["geometry"]
        parts = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for rings in parts:
            xs = [p[0] for p in rings[0]]
            ys = [p[1] for p in rings[0]]
            polys.append((f["properties"]["GEOID"], (min(xs), min(ys), max(xs), max(ys)), rings))
    return polys


def inside(x, y, ring):
    c, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def bg_of(x, y, polys):
    for geoid, (x0, y0, x1, y1), rings in polys:
        if x0 <= x <= x1 and y0 <= y <= y1 and inside(x, y, rings[0]) and not any(inside(x, y, h) for h in rings[1:]):
            return geoid
    return None


def main():
    raw, tax_year = sys.argv[1], sys.argv[2]
    today = date.today().isoformat()
    drop, sales, excise = Counter(), [], Counter()
    for r in rows(raw, "sales.zip", "EXTR_RPSale.csv"):
        d = r["DocumentDate"].strip()  # MM/DD/YYYY
        if len(d) != 10 or d[-4:] < "2023":
            continue
        drop["_sales_2023_on"] += 1
        excise[r["ExciseTaxNbr"].strip()] += 1
        price = int(float(r["SalePrice"] or 0))
        if (r["PrincipalUse"].strip(), r["PropertyClass"].strip(), r["PropertyType"].strip()) != ("6", "8", "11"):
            drop["not a residential improved single-family sale (use 6, class 8, type 11)"] += 1
            continue
        if r["SaleInstrument"].strip() not in ("2", "3"):
            drop["instrument not a warranty / statutory warranty deed"] += 1
            continue
        if r["SaleReason"].strip() != "1":
            drop["sale reason other than None"] += 1
            continue
        if r["SaleWarning"].strip():
            drop["has an Assessor sale warning"] += 1
            continue
        if price < 25000:
            drop["price under $25,000"] += 1
            continue
        sales.append({"pin": pin(r), "price": price, "date": f"{d[-4:]}-{d[:2]}-{d[3:5]}", "excise": r["ExciseTaxNbr"].strip()})
    kept = []
    for s in sales:
        if excise[s["excise"]] > 1:
            drop["excise affidavit covers more than one parcel"] += 1
        else:
            kept.append(s)
    sales = kept
    pins = {s["pin"] for s in sales}

    bld = defaultdict(list)
    for r in rows(raw, "resbldg.zip", "EXTR_ResBldg.csv"):
        p = pin(r)
        if p in pins:
            bld[p].append(r)
    lot = {}
    for r in rows(raw, "parcel.zip", "EXTR_Parcel.csv"):
        p = pin(r)
        if p in pins:
            lot[p] = float(r["SqFtLot"] or 0)
    av = {}  # pin -> (ChangeDate, value) of the latest record for the tax year the page's layer holds
    for r in rows(raw, "valhist.zip", "EXTR_ValueHistory_V.csv"):
        p = pin(r)
        if p in pins and r["TaxYr"].strip() == tax_year:
            cd = r["ChangeDate"].strip()[:10]
            v = float(r["ApprLandVal"] or 0) + float(r["ApprImpsVal"] or 0)
            if p not in av or cd > av[p][0]:
                av[p] = (cd, v)
    print(f"  {len(sales)} screened sales on {len(pins)} parcels; fetching centroids", file=sys.stderr)
    cen = centroids(pins)
    polys = block_groups()
    print(f"  {len(polys)} block-group polygons", file=sys.stderr)

    out_rows, num = [], (lambda v: float(v) if str(v).strip() not in ("",) else None)
    for s in sales:
        b = bld.get(s["pin"]) or []
        if len(b) != 1:
            drop["not exactly one residential building"] += 1
            continue
        b = b[0]
        sq, yb, units = num(b["SqFtTotLiving"]), num(b["YrBuilt"]), num(b["NbrLivingUnits"])
        if units != 1:
            drop["not one living unit"] += 1
            continue
        lt = lot.get(s["pin"])
        if not (sq and sq >= 400) or not (lt and lt > 0) or not (yb and 1700 < yb <= int(s["date"][:4])):
            drop["characteristics missing or built after the sale"] += 1
            continue
        beds, fb = num(b["Bedrooms"]), num(b["BathFullCount"])
        if beds is None or fb is None:
            drop["bedroom or full-bath count missing"] += 1
            continue
        baths = fb + 0.75 * (num(b["Bath3qtrCount"]) or 0) + 0.5 * (num(b["BathHalfCount"]) or 0)
        c = cen.get(s["pin"]) or []
        if len(c) != 1:
            drop["no single parcel centroid in the state parcel layer"] += 1
            continue
        g = bg_of(c[0][0], c[0][1], polys)
        if not g:
            drop["centroid outside every King County block group"] += 1
            continue
        a = av.get(s["pin"])
        value = a[1] if a and a[1] > 0 and len(a[0]) == 10 else None
        out_rows.append({"id": s["pin"], "price": s["price"], "date": s["date"], "bg": g, "tract": g[:11], "sqft": sq, "lot": lt,
                         "yb": int(yb), "eff": None, "beds": beds, "baths": baths, "units": 1,
                         "av": value, "av_date": a[0] if value else None})

    sales_n = drop.pop("_sales_2023_on")
    out = {"county_fips": "53033", "county_name": "King County", "pulled": today,
           "sources": ["https://aqua.kingcounty.gov/extranet/assessor/ (Real Property Sales, Residential Building, Parcel, Real Property Account, Lookup; files dated 14 Nov 2026)",
                       WA.replace("/query", "") + " (Washington State Current Parcels: parcel centroids)",
                       TIGER.replace("/query", "") + " (Census 2020 block groups)"],
           "filters": ["PrincipalUse 6 RESIDENTIAL, PropertyClass 8 Res-Improved property, PropertyType 11 Household, single family units",
                       "SaleInstrument 2 Warranty Deed or 3 Statutory Warranty Deed", "SaleReason 1 None", "no Assessor SaleWarning",
                       "price >= $25,000", "excise affidavit for one parcel only",
                       "one residential building, 1 living unit, living area >= 400 sq ft, year built not after the sale, bedroom and full-bath counts present"],
           "assessor_value": {"field": "ApprLandVal + ApprImpsVal (EXTR_ValueHistory_V)", "tax_year": tax_year,
                              "av_date": "ChangeDate of the parcel's latest record for that tax year (a value changed after a sale is not used for it)"},
           "counts": {"sales_2023_on": sales_n, "dropped": dict(drop), "kept": len(out_rows)},
           "rows": sorted(out_rows, key=lambda r: (r["date"], r["id"]))}
    with gzip.open(os.path.join(ROOT, "data", "backtests", f"sales_53033_{today}.json.gz"), "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(json.dumps(out["counts"], indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
