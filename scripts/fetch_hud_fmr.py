#!/usr/bin/env python3
"""Fetch HUD Fair Market Rents for every U.S. county from HUD's own published data.

Why this exists
---------------
The previous app/data/hud_fair_market_rents.json was hand-typed (46 metros, numbers
written from memory, area names HUD retired in 2023). It was labeled "official FY2026"
and was not. This script replaces it with values pulled directly from HUD.

Sources (both official, both public, no key needed)
---------------------------------------------------
1. County list + interior points: U.S. Census Bureau TIGERweb, State_County MapServer,
   layer 1 (Counties). Fields GEOID, NAME, INTPTLAT, INTPTLON.
2. Rents: HUD's "Fair Market Rents" ArcGIS feature service, published by the HUD
   Office of Policy Development & Research (ArcGIS item 12d2516901f947b5bb4da4e780e35f07).
   The item page states "Date of Coverage: FY2026: Oct. 1 - Sept. 30".

Each county is matched to the HUD FMR area whose polygon contains the county's
Census interior point. In New England (CT, ME, MA, NH, RI, VT) HUD defines FMR areas
by town, so a county can span more than one FMR area; those records are flagged.

Known caveat, recorded rather than hidden: the service's *layer* description still says
"FY2024" while the *item* description says "FY2026". The item was last modified
2026-04-20. We record both strings in the output so anyone can check.

Usage:  python3 scripts/fetch_hud_fmr.py            (writes app/data/hud_fair_market_rents.json)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "hud_fair_market_rents.json")

TIGER_COUNTIES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
HUD_ITEM = "https://www.arcgis.com/sharing/rest/content/items/12d2516901f947b5bb4da4e780e35f07?f=json"
HUD_LAYER = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Fair_Market_Rents/FeatureServer/0"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
NEW_ENGLAND = {"09", "23", "25", "33", "44", "50"}
STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}


def get_json(url, params=None, tries=5):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                d = json.load(r)
            if isinstance(d, dict) and "error" in d:
                raise RuntimeError(str(d["error"]))
            return d
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def fetch_counties():
    out, offset = [], 0
    while True:
        d = get_json(TIGER_COUNTIES, {
            "where": "1=1", "outFields": "GEOID,NAME,STATE,INTPTLAT,INTPTLON",
            "returnGeometry": "false", "f": "json", "orderByFields": "GEOID",
            "resultOffset": offset, "resultRecordCount": 1000,
        })
        feats = d.get("features", [])
        out += [f["attributes"] for f in feats]
        if not d.get("exceededTransferLimit") and len(feats) < 1000:
            break
        offset += len(feats)
    return [c for c in out if c["STATE"] in STATE_ABBR]


def fmr_for_point(lat, lon, envelope=None):
    params = {
        "geometry": envelope or f"{lon},{lat}",
        "geometryType": "esriGeometryEnvelope" if envelope else "esriGeometryPoint",
        "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FMR_CODE,FMR_AREANAME,FMR_0BDR,FMR_1BDR,FMR_2BDR,FMR_3BDR,FMR_4BDR",
        "returnGeometry": "false", "f": "json",
    }
    return [f["attributes"] for f in get_json(HUD_LAYER + "/query", params).get("features", [])]


def main():
    today = date.today().isoformat()
    item = get_json(HUD_ITEM)
    layer = get_json(HUD_LAYER, {"f": "json"})
    item_cov = item.get("description", "").split("Date of Coverage:")[-1][:80] if "Date of Coverage" in item.get("description", "") else None
    layer_cov = layer.get("description", "").split("Date of Coverage:")[-1][:80] if "Date of Coverage" in layer.get("description", "") else None
    import re
    clean = lambda s: " ".join(re.sub(r"<[^>]+>", " ", s).replace("&nbsp;", " ").split()) if s else s

    counties = fetch_counties()
    print(f"{len(counties)} counties from TIGERweb", file=sys.stderr)

    def one(c):
        lat, lon = float(c["INTPTLAT"]), float(c["INTPTLON"])
        try:
            hits = fmr_for_point(lat, lon)
            used_envelope = False
            if not hits:  # interior point fell in water / outside every polygon: search a ~5 km box
                hits = fmr_for_point(lat, lon, envelope=f"{lon-0.05},{lat-0.05},{lon+0.05},{lat+0.05}")
                used_envelope = bool(hits)
        except Exception as e:  # recorded, never filled in
            return {"fips": c["GEOID"], "error": str(e)[:200]}
        rec = {
            "fips": c["GEOID"],
            "county_name": c["NAME"],
            "state_code": STATE_ABBR[c["STATE"]],
            "fmr_area_code": hits[0]["FMR_CODE"] if hits else None,
            "metro_or_county_name": hits[0]["FMR_AREANAME"] if hits else None,
            "fiscal_year": 2026,
            "zero_bed_eff": hits[0]["FMR_0BDR"] if hits else None,
            "one_bed_1br": hits[0]["FMR_1BDR"] if hits else None,
            "two_bed_2br": hits[0]["FMR_2BDR"] if hits else None,
            "three_bed_3br": hits[0]["FMR_3BDR"] if hits else None,
            "four_bed_4br": hits[0]["FMR_4BDR"] if hits else None,
        }
        notes = []
        if not hits:
            notes.append("No HUD FMR polygon contains this county's Census interior point; rents left empty.")
        if used_envelope:
            notes.append("Interior point matched no FMR polygon; matched by a 0.05-degree box around it instead.")
        if len(hits) > 1:
            notes.append(f"Interior point touches {len(hits)} FMR areas; first returned is used.")
        if c["STATE"] in NEW_ENGLAND:
            notes.append("New England FMR areas are defined by town; this county may span several FMR areas. Value is for the area containing the county's interior point.")
        # Shared method/date live in the file header (_source.verification_method); per-county only what differs.
        rec["verification"] = {"status": "verified" if hits else "could_not_check"}
        if notes:
            rec["verification"]["notes"] = " ".join(notes)
        return rec

    with ThreadPoolExecutor(max_workers=8) as ex:
        recs = list(ex.map(one, counties))

    errors = [r for r in recs if "error" in r]
    for r in errors:  # retry failures once, serially
        c = next(c for c in counties if c["GEOID"] == r["fips"])
        recs[recs.index(r)] = one(c)
    errors = [r for r in recs if "error" in r]
    if errors:
        print(f"{len(errors)} counties failed to fetch; refusing to write a partial file: {[e['fips'] for e in errors][:20]}", file=sys.stderr)
        sys.exit(1)

    payload = {
        "_source": {
            "dataset": "HUD Fair Market Rents (county-matched)",
            "publisher": "U.S. Department of Housing and Urban Development",
            "service": HUD_LAYER,
            "item": HUD_ITEM,
            "item_modified": item.get("modified"),
            "item_date_of_coverage": clean(item_cov),
            "layer_date_of_coverage": clean(layer_cov),
            "coverage_caveat": "HUD's item page says FY2026; the layer's own description still says FY2024. Treat fiscal_year=2026 as HUD's item-level statement, not independently confirmed against huduser.gov (which blocks automated download from our build environment).",
            "retrieved": today,
            "script": "scripts/fetch_hud_fmr.py",
            "verification_method": "Machine pull: each county's Census TIGERweb interior point matched point-in-polygon against HUD's published Fair Market Rents feature service. Values are copied, never edited.",
            "source_agency": "U.S. Department of Housing and Urban Development (HUD), Office of Policy Development and Research",
        },
        "records": sorted(recs, key=lambda r: r["fips"]),
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    ok = sum(1 for r in recs if r["verification"]["status"] == "verified")
    print(f"wrote {OUT}: {len(recs)} counties, {ok} matched to a HUD FMR area", file=sys.stderr)


if __name__ == "__main__":
    main()
