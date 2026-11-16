#!/usr/bin/env python3
"""District of Columbia single-family sales for the home-value back-test (FIPS 11001).

Sources (DC GIS, Office of Tax and Revenue data; public, no key):
  RESIDENTIAL (CAMA)  .../DCGIS_DATA/Property_and_Land_WebMercator/MapServer/25  latest sale (SALEDATE, PRICE, QUALIFIED)
                      and characteristics (GBA, LANDAREA, AYB, EYB, BEDRM, BATHRM, HF_BATHRM, NUM_UNITS, BLDG_NUM)
  Owner Polygons      .../MapServer/40  parcel shape per SSL (centroid -> 2020 Census block group via TIGERweb)

Filters, stated and applied here:
  * QUALIFIED = 'Q' (the District's sale-qualification flag; its definition is not given in the layer metadata, so
    the screens below are applied as well)
  * NUM_UNITS = 1 and BLDG_NUM = 1 (one dwelling on the lot)
  * PRICE >= $25,000 and GBA (gross building area) >= 400 sq ft
Assessed values are NOT used: the owner layer's "Proposed Total Value" has no effective tax year recorded, so it
cannot be shown to predate a sale.

Output: data/backtests/sales_11001_<date>.json.gz (shared schema; see scripts/lib/countyValuationModels.mjs).
"""
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

from shapely.geometry import Point, Polygon, shape
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SVC = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def get(url, params, tries=6):
    data = urllib.parse.urlencode(params).encode()
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=180) as r:
                d = json.load(r)
            if "error" not in d:
                return d
            last = d["error"]
        except Exception as e:
            last = e
        time.sleep(3 * (i + 1))
    raise RuntimeError(f"query failed: {last}")


def main():
    since = sys.argv[1] if len(sys.argv) > 1 else "2023-01-01"
    where = f"SALEDATE >= DATE '{since}' AND QUALIFIED = 'Q' AND NUM_UNITS = 1 AND BLDG_NUM = 1 AND PRICE >= 25000 AND GBA >= 400"
    recs, last = [], 0
    while True:
        d = get(f"{SVC}/25/query", {"where": f"{where} AND OBJECTID > {last}", "outFields": "OBJECTID,SSL,SALEDATE,PRICE,QUALIFIED,GBA,LANDAREA,AYB,EYB,BEDRM,BATHRM,HF_BATHRM,USECODE",
                                    "orderByFields": "OBJECTID", "resultRecordCount": 2000, "returnGeometry": "false", "f": "json"})
        f = [x["attributes"] for x in d.get("features", [])]
        if not f:
            break
        recs += f
        last = f[-1]["OBJECTID"]
        if len(f) < 2000 and not d.get("exceededTransferLimit"):
            break
    print(f"{len(recs)} qualified single-dwelling sales since {since}", file=sys.stderr)

    ssls = sorted({r["SSL"] for r in recs})
    cent = {}
    for i in range(0, len(ssls), 150):
        chunk = ",".join("'" + s.replace("'", "''") + "'" for s in ssls[i:i + 150])
        d = get(f"{SVC}/40/query", {"where": f"SSL IN ({chunk})", "outFields": "SSL", "returnGeometry": "true", "outSR": "4326", "f": "json"})
        for ft in d.get("features", []):
            g = ft.get("geometry") or {}
            if g.get("rings"):
                try:
                    cent[ft["attributes"]["SSL"]] = Polygon(g["rings"][0]).centroid
                except Exception:
                    pass
    print(f"locations for {len(cent)} of {len(ssls)} SSLs", file=sys.stderr)

    q = urllib.parse.urlencode({"where": "STATE='11' AND COUNTY='001'", "outFields": "GEOID", "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultRecordCount": 1000})
    with urllib.request.urlopen(urllib.request.Request(f"{TIGER}?{q}", headers=UA), timeout=180) as r:
        bgs = [(f["properties"]["GEOID"], shape(f["geometry"])) for f in json.load(r)["features"]]
    tree = STRtree([g for _, g in bgs])

    rows, drop = [], {}
    def no(k):
        drop[k] = drop.get(k, 0) + 1
    for r in recs:
        c = cent.get(r["SSL"])
        if c is None:
            no("no parcel location"); continue
        hit = [int(i) for i in tree.query(c, predicate="within")]
        if not hit:
            no("location not in a block group"); continue
        gid = bgs[hit[0]][0]
        sd = datetime.fromtimestamp(r["SALEDATE"] / 1000, tz=timezone.utc).date()
        yb = r["AYB"] or 0
        rows.append({
            "id": r["SSL"], "price": float(r["PRICE"]), "date": sd.isoformat(), "bg": gid, "tract": gid[:11],
            "sqft": float(r["GBA"]), "lot": float(r["LANDAREA"]) if r["LANDAREA"] else None, "yb": int(yb) if yb > 1700 else None,
            "eff": r["EYB"] or None, "beds": r["BEDRM"], "baths": (r["BATHRM"] or 0) + 0.5 * (r["HF_BATHRM"] or 0) if r["BATHRM"] is not None else None,
            "av": None, "av_date": None,
        })
    out = {
        "county_fips": "11001", "county_name": "District of Columbia", "pulled": date.today().isoformat(),
        "sources": {"residential_cama": f"{SVC}/25", "owner_polygons": f"{SVC}/40", "block_groups": TIGER},
        "filters": __doc__.split("Filters, stated and applied here:")[1].split("Output:")[0].strip(), "dropped": drop, "rows": rows,
    }
    path = os.path.join(ROOT, "data", "backtests", f"sales_11001_{date.today().isoformat()}.json.gz")
    with gzip.open(path, "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {path}: {len(rows)} sales; dropped {drop}", file=sys.stderr)


if __name__ == "__main__":
    main()
