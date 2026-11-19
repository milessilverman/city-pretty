#!/usr/bin/env python3
"""Philadelphia single-family sales for the home-value back-test (county FIPS 42101).

Sources (public, no key; City of Philadelphia CARTO SQL API, https://phl.carto.com/api/v2/sql):
  opa_properties_public  Office of Property Assessment: one row per property with its most recent sale
                         (sale_price, sale_date), characteristics and the current certified market_value.
  rtt_summary            Department of Records real estate transfer tax records: document_type, property_count,
                         consideration. Used to keep only arm's-length sales (below).

Arm's-length filter, stated and applied here:
  * OPA category_code '1' (single family)
  * a matching transfer-tax record: same OPA account, document_type exactly 'DEED' (excludes SHERIFF'S DEED,
    MISCELLANEOUS DEED and others), property_count = 1, recorded within 45 days of the OPA sale date, and total
    consideration within 1% of the OPA sale price
  * sale price >= $25,000 and living area >= 400 sq ft
  * grantor and grantee lists share no surname (a common family-transfer screen)

Block group: each property's point (the_geom) is matched to its 2020 Census block group (TIGERweb).
Output: data/backtests/sales_42101_<date>.json.gz in the shared schema used by scripts/county_valuation_models.mjs.
"""
import gzip
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CARTO = "https://phl.carto.com/api/v2/sql"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def get(url, data=None, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(3 * (i + 1))
    raise last


def sql(q):
    return get(CARTO, data=urllib.parse.urlencode({"q": q}).encode())["rows"]


def block_groups():
    out, off = [], 0
    while True:
        q = urllib.parse.urlencode({"where": "STATE='42' AND COUNTY='101'", "outFields": "GEOID", "returnGeometry": "true",
                                    "outSR": "4326", "f": "geojson", "resultOffset": off, "resultRecordCount": 500})
        feats = get(f"{TIGER}?{q}")["features"]
        out += [(f["properties"]["GEOID"], shape(f["geometry"])) for f in feats]
        if len(feats) < 500:
            return out
        off += len(feats)


def surnames(s):
    return {w for w in re.findall(r"[A-Z]{3,}", (s or "").upper()) if w not in {"LLC", "INC", "THE", "AND", "TRUST", "BANK", "COMPANY", "ASSOCIATION", "ESTATE"}}


def main():
    since = sys.argv[1] if len(sys.argv) > 1 else "2023-01-01"
    opa = sql(f"""SELECT parcel_number, sale_price, sale_date, market_value, assessment_date, total_livable_area, total_area,
                 year_built, number_of_bedrooms, number_of_bathrooms, number_stories, census_tract, ST_Y(the_geom) lat, ST_X(the_geom) lng
                 FROM opa_properties_public WHERE category_code = '1' AND sale_date >= '{since}' AND sale_price >= 25000""")
    print(f"{len(opa)} OPA single-family properties with a sale since {since}", file=sys.stderr)
    rtt = sql(f"""SELECT opa_account_num, document_type, property_count, total_consideration, recording_date, document_date, grantors, grantees
                 FROM rtt_summary WHERE document_type = 'DEED' AND recording_date >= '{since}' AND opa_account_num IS NOT NULL""")
    by = {}
    for r in rtt:
        by.setdefault(str(r["opa_account_num"]).strip(), []).append(r)
    print(f"{len(rtt)} DEED transfer records", file=sys.stderr)

    bgs = block_groups()
    tree = STRtree([g for _, g in bgs])
    rows, drop = [], {}
    def no(k):
        drop[k] = drop.get(k, 0) + 1
    for o in opa:
        pid = str(o["parcel_number"]).strip()
        sd = datetime.fromisoformat(o["sale_date"].replace("Z", "+00:00")).date()
        cand = [r for r in by.get(pid, []) if r["recording_date"]]
        match = None
        for r in cand:
            rd = datetime.fromisoformat(r["recording_date"].replace("Z", "+00:00")).date()
            tc = r["total_consideration"] or 0
            if abs((rd - sd).days) <= 45 and tc and abs(tc - o["sale_price"]) <= 0.01 * o["sale_price"]:
                match = r
                break
        if not match:
            no("no matching DEED transfer record"); continue
        if (match["property_count"] or 0) != 1:
            no("transfer covered more than one property"); continue
        if surnames(match["grantors"]) & surnames(match["grantees"]):
            no("grantor and grantee share a surname"); continue
        if not (o["total_livable_area"] or 0) >= 400:
            no("living area missing or under 400 sq ft"); continue
        if o["lat"] is None:
            no("no location"); continue
        p = Point(o["lng"], o["lat"])
        hit = [int(i) for i in tree.query(p, predicate="within")]
        if not hit:
            no("point not in a block group"); continue
        gid = bgs[hit[0]][0]
        yb = int(o["year_built"]) if str(o["year_built"] or "").isdigit() else None
        rows.append({
            "id": pid, "price": float(o["sale_price"]), "date": sd.isoformat(), "bg": gid, "tract": gid[:11],
            "sqft": float(o["total_livable_area"]), "lot": float(o["total_area"]) if o["total_area"] else None,
            "yb": yb if yb and yb > 1700 else None, "eff": None,
            "beds": o["number_of_bedrooms"], "baths": o["number_of_bathrooms"],
            "av": float(o["market_value"]) if o["market_value"] else None,
            "av_date": (o["assessment_date"] or "")[:10] or None,
        })
    out = {
        "county_fips": "42101", "county_name": "Philadelphia County", "pulled": date.today().isoformat(),
        "sources": {"opa_properties_public": CARTO + " (table opa_properties_public)", "rtt_summary": CARTO + " (table rtt_summary)", "block_groups": TIGER},
        "filters": __doc__.split("Arm's-length filter, stated and applied here:")[1].split("Block group:")[0].strip(),
        "dropped": drop, "rows": rows,
    }
    os.makedirs(os.path.join(ROOT, "data", "backtests"), exist_ok=True)
    path = os.path.join(ROOT, "data", "backtests", f"sales_42101_{date.today().isoformat()}.json.gz")
    with gzip.open(path, "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {path}: {len(rows)} arm's-length sales; dropped {drop}", file=sys.stderr)


if __name__ == "__main__":
    main()
