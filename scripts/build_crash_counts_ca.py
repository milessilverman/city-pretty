#!/usr/bin/env python3
"""Crash counts per block group for every California county, rebuilt from CHP's crash database with a stated boundary rule.

Why: most crashes are geocoded onto street centerlines, and streets are usually block-group boundaries. A check on
16 Nov 2026 found, in one block group, 14 crashes clearly inside and 46 within 10 m of its edge (half on each side),
so a count that assigns each boundary crash to one side by tie-break swings by half. The previous file
(w5/tools/la_crash_counts.py, inputs not in the repo) did exactly that.

Rule here: a crash counts for a block group if it is inside it OR within 10 m of its boundary. A crash on a boundary
street therefore counts for each block group that street borders. Totals across block groups are not crash totals.

Sources (public, no key):
  CHP California Crash Reporting System (CCRS) on data.ca.gov, Crashes_2023/2024/2025, all counties. CCRS County Code
    is the alphabetical county number (1 Alameda ... 19 Los Angeles ... 58 Yuba), so county FIPS = 2 * code - 1.
  CCRS InjuredWitnessPassengers_2023/2024/2025: a crash is "killed or seriously injured" if any person's
    ExtentOfInjuryCode is Fatal, SuspectSerious or SevereInactive, or NumberKilled > 0
  Census TIGERweb block groups (2020), California

Output: app/data/crash_counts/<county FIPS>.json  { "<block group GEOID>": [pedestrian_or_bicycle, killed_or_seriously_injured, all], "_meta": {...} }
Usage: python3 scripts/build_crash_counts_ca.py [county FIPS ...]   (default: every California county)
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
OUT_DIR = os.path.join(ROOT, "app", "data", "crash_counts")
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
CRASHES = {2023: "436642c0-cd04-4a4c-b45e-564b66437476", 2024: "f775df59-b89b-4f82-bd3d-8807fa3a22a0", 2025: "9f4fc839-122d-4595-a146-43bc4ed16f46"}
INJURED = {2023: "1dfc36fa-a5dd-4616-b9b0-ff55699e299a", 2024: "a36a0078-d7e1-4244-8337-0a59433c9b84", 2025: "10184ea3-7411-42d8-87a6-17039b58f04b"}
PARTIES = {2023: "84376be5-548b-44e3-8ebc-73e8a2ca9945", 2024: "93892d36-017b-4a2a-bc0b-f1f385060b96", 2025: "07701a08-4f29-418f-9066-34f19d913ca7"}
SQL = "https://data.ca.gov/api/3/action/datastore_search_sql?"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query?"
BOUNDARY_M = 10.0
PAGE = 20000

# Local metric projection per county (equirectangular at the county's mean latitude; < 1% scale error within a county).
def projector(lat0):
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    return lambda x, y, z=None: (x * kx, y * ky)


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


def block_groups(county3):
    raw, offset = {}, 0
    while True:
        q = urllib.parse.urlencode({"where": f"STATE='06' AND COUNTY='{county3}'", "outFields": "GEOID", "returnGeometry": "true",
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
                raw[f["attributes"]["GEOID"]] = geom
        if len(feats) < 500:
            break
        offset += len(feats)
    if not raw:
        return {}, None
    lat0 = sum(g.centroid.y for g in raw.values()) / len(raw)
    to_m = projector(lat0)
    return {g: transform(to_m, p).buffer(0) for g, p in raw.items()}, to_m


def pedbike_collisions():
    """Crashes with a pedestrian or bicyclist party (Parties table) or a pedestrian/bicyclist injured person.
    The crash table's MotorVehicleInvolvedWithDesc names only the first thing struck, so it misses crashes where a
    pedestrian or cyclist was involved later in the sequence (round 4, 16 Nov 2026)."""
    ids = set()
    for y in CRASHES:
        for rid, col, field in ((PARTIES[y], "CollisionId", "PartyType"), (INJURED[y], "CollisionId", "InjuredPersonType")):
            rows = sql(f'SELECT DISTINCT "{col}" FROM "{rid}" WHERE "{field}" IN (\'Pedestrian\',\'Bicyclist\')')
            ids |= {int(r[col]) for r in rows if r[col] is not None}
    return ids


def ksi_collisions():
    ids = set()
    for y, rid in INJURED.items():
        rows = sql(f'SELECT DISTINCT "CollisionId" FROM "{rid}" WHERE "ExtentOfInjuryCode" IN (\'Fatal\',\'SuspectSerious\',\'SevereInactive\')')
        ids |= {int(r["CollisionId"]) for r in rows if r["CollisionId"] is not None}
    return ids


def county_crashes(code):
    for y, rid in CRASHES.items():
        last = 0
        while True:
            rows = sql(f'SELECT "_id","Collision Id","Latitude","Longitude","MotorVehicleInvolvedWithDesc","NumberKilled","Crash Date Time" '
                       f'FROM "{rid}" WHERE "County Code"={code} AND "_id">{last} ORDER BY "_id" LIMIT {PAGE}')
            if not rows:
                break
            last = rows[-1]["_id"]
            yield from rows


def build_county(code, ksi_ids, today, pb_ids=frozenset()):
    fips = "06" + str(2 * code - 1).zfill(3)
    bgs, to_m = block_groups(fips[2:])
    if not bgs:
        print(f"{fips}: no block groups", file=sys.stderr)
        return
    gids = list(bgs)
    outer = STRtree([bgs[g].buffer(BOUNDARY_M) for g in gids])
    out = {g: [0, 0, 0] for g in gids}
    stats = {"crashes": 0, "with_coordinates": 0, "matched": 0, "on_boundary": 0, "latest_crash": None}
    for r in county_crashes(code):
        stats["crashes"] += 1
        try:
            lat, lon = float(r["Latitude"]), float(r["Longitude"])
        except (TypeError, ValueError):
            continue
        if not (32.4 < lat < 42.1 and -124.6 < lon < -114.0):
            continue
        stats["with_coordinates"] += 1
        if r["Crash Date Time"] and (stats["latest_crash"] is None or r["Crash Date Time"] > stats["latest_crash"]):
            stats["latest_crash"] = r["Crash Date Time"]
        hits = [int(i) for i in outer.query(Point(*to_m(lon, lat)), predicate="intersects")]
        if not hits:
            continue
        stats["matched"] += 1
        if len(hits) > 1:
            stats["on_boundary"] += 1
        w = (r["MotorVehicleInvolvedWithDesc"] or "").upper()
        ped = "PEDESTRIAN" in w or "BICYCLE" in w or int(r["Collision Id"]) in pb_ids
        ksi =(r["NumberKilled"] or 0) > 0 or int(r["Collision Id"]) in ksi_ids
        k = len(hits)
        w_ped = (1.0 / k) if ped else 0.0
        w_ksi = (1.0 / k) if ksi else 0.0
        w_all = 1.0 / k
        for i in hits:
            c = out[gids[i]]
            c[2] = round(c[2] + w_all, 3)
            c[0] = round(c[0] + w_ped, 3)
            c[1] = round(c[1] + w_ksi, 3)
    out["_meta"] = {
        "county_fips": fips,
        "source": f"CHP California Crash Reporting System (CCRS), data.ca.gov: Crashes and InjuredWitnessPassengers 2023-2025, County Code {code}",
        "geography": "Census TIGERweb 2020 block groups",
        "rule": f"A crash counts for a block group if it is inside it or within {BOUNDARY_M:g} m of its boundary; crashes touching k boundary block groups are weighted 1/k.",
        "years": [2023, 2025],
        "pedbike_rule": "first object struck is a pedestrian or bicycle, or any party (Parties table) or injured person is a Pedestrian or Bicyclist",
        "fields": ["pedestrian or bicycle crashes", "killed or seriously injured crashes (any person Fatal, SuspectSerious or SevereInactive, or NumberKilled > 0)", "all crashes"],
        "built": today,
        "script": "scripts/build_crash_counts_ca.py",
        **stats,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, f"{fips}.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    pct = round(100 * stats["matched"] / stats["crashes"]) if stats["crashes"] else 0
    print(f"{fips}: {len(gids)} block groups, {stats['crashes']} crashes, {pct}% placed", file=sys.stderr)


def main():
    today = date.today().isoformat()
    want = {a for a in sys.argv[1:] if a.isdigit()}
    ksi_ids = ksi_collisions()
    print(f"{len(ksi_ids)} statewide crashes with a killed or seriously injured person", file=sys.stderr)
    pb_ids = pedbike_collisions()
    print(f"{len(pb_ids)} statewide crashes with a pedestrian or bicyclist party or injured person", file=sys.stderr)
    for code in range(1, 59):
        fips = "06" + str(2 * code - 1).zfill(3)
        if want and fips not in want:
            continue
        if fips == "06075":  # San Francisco: only 34% of its CCRS crashes are geocoded; kept on DataSF (see audit doc)
            continue
        build_county(code, ksi_ids, today, pb_ids)


if __name__ == "__main__":
    main()
