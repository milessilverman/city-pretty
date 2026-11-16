#!/usr/bin/env python3
"""Crash counts per Los Angeles County block group, rebuilt from CHP's crash database with a stated boundary rule.

Why: most crashes are geocoded onto street centerlines, and streets are usually block-group boundaries. A check on
16 Nov 2026 found, in one block group, 14 crashes clearly inside and 46 within 10 m of its edge (half on each side),
so a count that assigns each boundary crash to one side by tie-break swings by half. The previous file
(w5/tools/la_crash_counts.py, inputs not in the repo) did exactly that.

Rule here: a crash counts for a block group if it is inside it OR within 10 m of its boundary. A crash on a boundary
street therefore counts for each block group that street borders. Totals across block groups are not crash totals.

Sources (public, no key):
  CHP California Crash Reporting System (CCRS) on data.ca.gov, Crashes_2023/2024/2025 (County Code 19 = Los Angeles)
  CCRS InjuredWitnessPassengers_2023/2024/2025: a crash is "killed or seriously injured" if any person's
    ExtentOfInjuryCode is Fatal, SuspectSerious or SevereInactive, or NumberKilled > 0
  Census TIGERweb block groups (2020) for Los Angeles County

Output: app/data/la-crash-counts.json  { "<block group GEOID>": [pedestrian_or_bicycle, killed_or_seriously_injured, all], "_meta": {...} }
Needs: pip install shapely
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "la-crash-counts.json")
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
CRASHES = {2023: "436642c0-cd04-4a4c-b45e-564b66437476", 2024: "f775df59-b89b-4f82-bd3d-8807fa3a22a0", 2025: "9f4fc839-122d-4595-a146-43bc4ed16f46"}
INJURED = {2023: "1dfc36fa-a5dd-4616-b9b0-ff55699e299a", 2024: "a36a0078-d7e1-4244-8337-0a59433c9b84", 2025: "10184ea3-7411-42d8-87a6-17039b58f04b"}
SQL = "https://data.ca.gov/api/3/action/datastore_search_sql?"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query?"
BOUNDARY_M = 10.0
PAGE = 20000

# Local metric projection for LA County (equirectangular at 34.05 N; < 1% scale error across the county).
KX, KY = 111320 * math.cos(math.radians(34.05)), 110540
to_m = lambda x, y, z=None: (x * KX, y * KY)


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def sql(q):
    d = get(SQL + urllib.parse.urlencode({"sql": q}))
    if not d.get("success"):
        raise RuntimeError(str(d)[:300])
    return d["result"]["records"]


def block_groups():
    polys, offset = {}, 0
    while True:
        q = urllib.parse.urlencode({"where": "STATE='06' AND COUNTY='037'", "outFields": "GEOID", "returnGeometry": "true",
                                    "outSR": "4326", "f": "json", "orderByFields": "GEOID", "resultOffset": offset, "resultRecordCount": 500})
        feats = get(TIGER + q).get("features", [])
        for f in feats:
            rings = f["geometry"]["rings"]
            # ArcGIS rings: outer rings clockwise, holes counter-clockwise; shapely handles even-odd via orientation.
            parts, holes = [], []
            for r in rings:
                area = sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r)))
                (parts if area < 0 else holes).append(r)
            geom = MultiPolygon([Polygon(p, [h for h in holes if Polygon(p).contains(Point(h[0]))]) for p in parts]) if parts else None
            if geom is not None:
                polys[f["attributes"]["GEOID"]] = transform(to_m, geom).buffer(0)
        if len(feats) < 500:
            return polys
        offset += len(feats)


def main():
    today = date.today().isoformat()
    bgs = block_groups()
    gids = list(bgs)
    print(f"{len(gids)} block groups", file=sys.stderr)
    inner = STRtree([bgs[g] for g in gids])
    buffered = [bgs[g].buffer(BOUNDARY_M) for g in gids]
    outer = STRtree(buffered)

    ksi_ids = set()
    for y, rid in INJURED.items():
        rows = sql(f'SELECT DISTINCT "CollisionId" FROM "{rid}" WHERE "ExtentOfInjuryCode" IN (\'Fatal\',\'SuspectSerious\',\'SevereInactive\')')
        ksi_ids |= {int(r["CollisionId"]) for r in rows if r["CollisionId"] is not None}
    print(f"{len(ksi_ids)} statewide crashes with a killed or seriously injured person", file=sys.stderr)

    out = {g: [0, 0, 0] for g in gids}
    stats = {"crashes": 0, "with_coordinates": 0, "matched": 0, "on_boundary": 0, "latest_crash": None}
    for y, rid in CRASHES.items():
        last = 0
        while True:
            rows = sql(f'SELECT "_id","Collision Id","Latitude","Longitude","MotorVehicleInvolvedWithDesc","NumberKilled","Crash Date Time" '
                       f'FROM "{rid}" WHERE "County Code"=19 AND "_id">{last} ORDER BY "_id" LIMIT {PAGE}')
            if not rows:
                break
            last = rows[-1]["_id"]
            for r in rows:
                stats["crashes"] += 1
                try:
                    lat, lon = float(r["Latitude"]), float(r["Longitude"])
                except (TypeError, ValueError):
                    continue
                if not (32.7 < lat < 35.0 and -119.0 < lon < -117.5):
                    continue
                stats["with_coordinates"] += 1
                if r["Crash Date Time"] and (stats["latest_crash"] is None or r["Crash Date Time"] > stats["latest_crash"]):
                    stats["latest_crash"] = r["Crash Date Time"]
                p = Point(*to_m(lon, lat))
                hits = [int(i) for i in outer.query(p, predicate="intersects")]
                if not hits:
                    continue
                stats["matched"] += 1
                if len(hits) > 1:
                    stats["on_boundary"] += 1
                w = (r["MotorVehicleInvolvedWithDesc"] or "").upper()
                ped = "PEDESTRIAN" in w or "BICYCLE" in w
                ksi = (r["NumberKilled"] or 0) > 0 or int(r["Collision Id"]) in ksi_ids
                for i in hits:
                    c = out[gids[i]]
                    c[2] += 1
                    c[0] += ped
                    c[1] += ksi
            print(f"  {y}: through _id {last}, {stats['crashes']} LA crashes so far", file=sys.stderr)

    out["_meta"] = {
        "source": "CHP California Crash Reporting System (CCRS), data.ca.gov: Crashes and InjuredWitnessPassengers 2023-2025, County Code 19",
        "geography": "Census TIGERweb 2020 block groups, Los Angeles County",
        "rule": f"A crash counts for a block group if it is inside it or within {BOUNDARY_M:g} m of its boundary; crashes on boundary streets count for each bordering block group.",
        "fields": ["pedestrian or bicycle crashes", "killed or seriously injured crashes (any person Fatal, SuspectSerious or SevereInactive, or NumberKilled > 0)", "all crashes"],
        "built": today,
        "script": "scripts/build_la_crash_counts.py",
        **stats,
        "note": "2025 may be incomplete in CCRS at build time; see latest_crash.",
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(json.dumps(out["_meta"], indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
