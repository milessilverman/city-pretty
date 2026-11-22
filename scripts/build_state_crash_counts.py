#!/usr/bin/env python3
"""Crash counts per block group for counties outside California whose data files loaded state or city crash records.

Same rule as scripts/build_la_crash_counts.py: a crash counts for a block group if it is inside it OR within 10 m of its
boundary, so a crash geocoded onto a boundary street counts for each block group the street borders. The pipeline's
earlier counts (pipeline/metrics_oc.py) kept only points strictly `within` a block group, so a crash on a boundary
centerline landed on one side or the other by geocoding accident.

Counties: every counties/bundle_<fips>.json.gz whose meta.sources has a loaded state/city crash row (not CCRS, not FARS).
Window: the latest three full years each source publishes (recorded per county in _meta.years); the bundles used longer
windows (recorded in _meta.old_bundle_window), so old and new counts are compared as per-year rates.

Output: app/data/crash_counts/<fips>.json
  {"<block group GEOID>": [pedestrian_or_bicycle, killed_or_seriously_injured, all], "_meta": {...}}
Needs: pip install shapely.   Usage: python3 scripts/build_state_crash_counts.py [fips ...]
"""
import glob
import gzip
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from shapely import transform as shp_transform
from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "app", "data", "crash_counts")
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer"
BOUNDARY_M = 10.0
RULE = f"A crash counts for a block group if it is inside it or within {BOUNDARY_M:g} m of its boundary; crashes touching k boundary block groups are weighted 1/k."

IDOT = "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services"
UDOT = "https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer"
TITAN = "https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes"
G = "geometry"

# Field map per job: id, lat/lon ("geometry" = point geometry in WGS84), killed, serious, ped, bike.
# A spec is a field name (number), ("gt0", F), ("eq", F, [values]) or ("epoch_year", F) for filtering.
SOURCES = {
    "Illinois DOT crash records": {
        "years": [2023, 2025],
        "jobs": [{"url": f"{IDOT}/{n}/FeatureServer/0", "where": "1=1",
                  "map": {"id": "CrashID", "lat": G, "lon": G, "killed": "TotalFatals", "serious": "AInjuries",
                          "ped": ("eq", "TypeOfFirstCrash", ["Pedestrian"]), "bike": ("eq", "TypeOfFirstCrash", ["Pedalcyclist"])}}
                 for n in ("CRASHES_2023", "CRASHES__2024", "CRASHES___2025")],
        "notes": "One layer per year. Pedestrian/bicycle is taken from TypeOfFirstCrash (the first harmful event), so crashes where a pedestrian or cyclist was struck later in the sequence are not counted as pedestrian/bicycle. 'Serious' = AInjuries (KABCO A, incapacitating).",
    },
    "Virginia DOT crash records": {
        "years": [2023, 2025],
        "jobs": [{"url": "https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/Full_Crash/FeatureServer/0",
                  "where": "CRASH_YEAR >= '2023' AND CRASH_YEAR <= '2025'",
                  "map": {"id": "DOCUMENT_NBR", "lat": "LAT", "lon": "LON", "killed": "K_PEOPLE", "serious": "A_PEOPLE",
                          "ped": ("eq", "PED_NONPED", ["1", 1]), "bike": ("eq", "BIKE_NONBIKE", ["1", 1])}}],
        "notes": "'Serious' = A_PEOPLE (KABCO A).",
    },
    "Pennsylvania DOT crash records (PennShare)": {
        "years": [2021, 2023],
        "jobs": [{"url": "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8",
                  "where": "CRASH_YEAR >= 2021 AND CRASH_YEAR <= 2023",
                  "map": {"id": "CRN", "lat": "DEC_LAT", "lon": "DEC_LONG", "lon_negative": True, "killed": "FATAL_COUNT",
                          "serious": "SUSP_SERIOUS_INJ_COUNT", "ped": ("gt0", "PED_COUNT"), "bike": ("gt0", "BICYCLE_COUNT")}}],
        "notes": "PennShare's public table ends at 2023. Longitudes are stored unsigned and are made negative.",
    },
    "MaineDOT crash records": {
        "years": [2023, 2025],
        "jobs": [{"url": "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44",
                  "where": "ACCIDENT_YEAR >= 2023 AND ACCIDENT_YEAR <= 2025",
                  "map": {"id": "CRASH_ID", "lat": G, "lon": G, "killed": "NO_OF_K_INJ", "serious": "NO_OF_A_INJ",
                          "ped": ("eq", "PED_YN", ["Y"]), "bike": ("eq", "BICYCLE_YN", ["Y"])}}],
        "notes": "'Serious' = NO_OF_A_INJ (KABCO A).",
    },
    "Utah DOT crash records": {
        "years": [2023, 2025],
        "jobs": [{"url": f"{UDOT}/{2026 - y}", "where": "1=1",
                  "map": {"id": "crash_id", "lat": G, "lon": G, "killed": "number_fatalities", "serious": "number_four_injuries",
                          "ped": ("eq", "pedestrian_involved", ["Y"]), "bike": ("eq", "bicyclist_involved", ["Y"])}}
                 for y in (2023, 2024, 2025)],
        "notes": "One layer per year (layer 2026 - year). 'Serious' = number_four_injuries (UDOT severity 4, suspected serious). Each year layer misses about one day at its edges (pipeline/region.py note).",
    },
    "Tennessee TITAN injury crash records": {
        "years": [2022, 2024],
        "jobs": [{"url": f"{TITAN}__07_18_23_WFL1/FeatureServer/17", "where": "Collision_Year = 2022",
                  "map": {"id": "MRN", "lat": G, "lon": G, "killed": "Fatality", "serious": ("eq", "Crash_Type", ["Suspected Serious Injury"]),
                          "ped": ("eq", "Pedestrian", ["Pedestrian"]), "bike": ("eq", "Pedalcyclist", ["Pedalcyclist"])}},
                 {"url": f"{TITAN}__12_03_25_WFL1/FeatureServer/17", "where": "Collision_Year >= 2023 AND Collision_Year <= 2024",
                  "map": {"id": "MRN", "lat": G, "lon": G, "killed": "Fatality", "serious": ("eq", "Crash_Type", ["Suspected Serious Injury"]),
                          "ped": ("eq", "Pedestrian", ["Pedestrian"]), "bike": ("eq", "Pedalcyclist", ["Pedalcyclist"])}}],
        "all_injury": True,
        "notes": "TITAN's public dashboard layers hold injury and fatal crashes only, so 'all' here means all injury or fatal crashes. 2025 is left out because the newest snapshot ends 2 Dec 2025. 2022 comes from the July 2023 snapshot, 2023-2024 from the Dec 2025 snapshot.",
    },
    "San Francisco injury crashes (DataSF)": {
        "years": [2023, 2025],
        "jobs": [{"url": "https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Traffic_Crashes_Resulting_in_Injury_from_DataSF_pulled_monthly_/FeatureServer/0",
                  "where": "accident_year >= 2023 AND accident_year <= 2025",
                  "map": {"id": "case_id_pkey", "lat": G, "lon": G, "killed": "number_killed", "serious": ("eq", "collision_severity", ["Injury (Severe)"]),
                          "ped": ("eq", "mviw", ["Pedestrian"]), "bike": ("eq", "mviw", ["Bicycle"])}}],
        "all_injury": True,
        "pedbike_lower_bound": True,
        "field_descriptions": {
            "collision_severity": "the injury level severity of the crash (highest level of injury in crash)",
            "mviw": "motor vehicle involved with",
            "number_killed": "counts victims in the crash with degree of injury of fatal",
            "case_id_pkey": "unique crash report number",
            "_source": "DataSF dataset ubvf-ztfx 'Traffic Crashes Resulting in Injury' (SFDPH/SFPD), column descriptions from https://data.sfgov.org/api/views/ubvf-ztfx.json; license ODC Public Domain Dedication and License",
        },
        "notes": "DataSF's dataset holds injury and fatal crashes only, so 'all' here means all injury or fatal crashes. 'Serious' = collision_severity 'Injury (Severe)'. Pedestrian/bicycle comes from mviw ('motor vehicle involved with'), one value per crash, so a crash where a pedestrian or cyclist was hurt but is not the recorded mviw is not counted: the pedestrian/cyclist count is a lower bound. Used instead of CCRS because only 34% of San Francisco's CCRS crashes have coordinates.",
    },
    "Denver Police traffic accidents": {
        "years": [2023, 2025],
        "jobs": [{"url": "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325",
                  "where": "first_occurrence_date >= DATE '2023-01-01' AND first_occurrence_date < DATE '2026-01-01'",
                  "map": {"id": "object_id", "lat": "geo_lat", "lon": "geo_lon", "killed": "FATALITIES", "serious": "SERIOUSLY_INJURED",
                          "ped": ("gt0", "pedestrian_ind"), "bike": ("gt0", "bicycle_ind")}}],
        "notes": "Denver Police reports; minor injuries are not recorded (pipeline/region.py note).",
    },
}


def get(url, params, tries=6, timeout=180):
    q = url + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=timeout) as r:
                d = json.load(r)
            if isinstance(d, dict) and "error" in d:
                raise RuntimeError(str(d["error"])[:200])
            return d
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def num(v):
    try:
        return int(float(v)) if v not in (None, "") else 0
    except (TypeError, ValueError):
        return 0


def spec_val(s, a):
    if s is None:
        return 0
    if isinstance(s, str):
        return num(a.get(s))
    kind = s[0]
    if kind == "gt0":
        return 1 if num(a.get(s[1])) > 0 else 0
    if kind == "eq":
        v = a.get(s[1]); v = v.strip() if isinstance(v, str) else v
        return 1 if v in s[2] else 0
    raise ValueError(s)


def spec_fields(m):
    out = set()
    for k, s in m.items():
        if k in ("lat", "lon") and s == G or k == "lon_negative":
            continue
        if isinstance(s, str):
            out.add(s)
        elif isinstance(s, tuple):
            out.add(s[1])
    return sorted(out)


def county_extent(fips):
    d = get(f"{TIGER}/82/query", {"where": f"GEOID='{fips}'", "returnExtentOnly": "true", "outSR": "4326", "f": "json"})
    e = d["extent"]
    return round(e["xmin"] - 0.002, 5), round(e["ymin"] - 0.002, 5), round(e["xmax"] + 0.002, 5), round(e["ymax"] + 0.002, 5)


def block_groups(fips, to_m):
    polys, off = {}, 0
    while True:
        feats = get(f"{TIGER}/10/query", {"where": f"STATE='{fips[:2]}' AND COUNTY='{fips[2:]}'", "outFields": "GEOID", "returnGeometry": "true",
                                           "outSR": "4326", "f": "json", "orderByFields": "GEOID", "resultOffset": off, "resultRecordCount": 500}).get("features", [])
        for f in feats:
            rings = f["geometry"]["rings"]
            outers, holes = [], []
            for r in rings:
                a = sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r)))
                (outers if a < 0 else holes).append(r)
            if not outers:
                continue
            geom = MultiPolygon([Polygon(o, [h for h in holes if Polygon(o).contains(Point(h[0]))]) for o in outers])
            polys[f["attributes"]["GEOID"]] = shp_transform(geom, to_m).buffer(0)
        if len(feats) < 500:
            return polys
        off += len(feats)


def fetch_rows(job, env):
    meta = get(job["url"], {"f": "json"})
    oid = meta.get("objectIdField") or next((f["name"] for f in meta.get("fields", []) if f.get("type") == "esriFieldTypeOID"), "OBJECTID")
    page = min(2000, meta.get("maxRecordCount") or 2000)
    m = job["map"]; geom = m["lat"] == G
    q = {"where": job["where"], "geometry": ",".join(map(str, env)), "geometryType": "esriGeometryEnvelope", "inSR": "4326",
         "spatialRel": "esriSpatialRelIntersects"}
    n = get(job["url"] + "/query", {**q, "returnCountOnly": "true", "f": "json"})["count"]
    rows, off = [], 0
    while off < n:
        d = get(job["url"] + "/query", {**q, "outFields": ",".join(spec_fields(m) + [oid]), "returnGeometry": "true" if geom else "false",
                                         **({"outSR": "4326"} if geom else {}), "f": "json", "resultOffset": off, "resultRecordCount": page,
                                         "orderByFields": oid})
        feats = d.get("features", [])
        if not feats:
            break
        for f in feats:
            a = f["attributes"]; g = f.get("geometry") or {}
            if geom:
                lat, lon = g.get("y"), g.get("x")
            else:
                lat, lon = a.get(m["lat"]), a.get(m["lon"])
            try:
                lat = float(lat) if lat not in (None, "") else None; lon = float(lon) if lon not in (None, "") else None
            except (TypeError, ValueError):
                lat = lon = None
            if not lat or not lon:
                lat = lon = None
            elif m.get("lon_negative"):
                lon = -abs(lon)
            rows.append((a.get(m["id"]), lat, lon, spec_val(m.get("killed"), a), spec_val(m.get("serious"), a), spec_val(m.get("ped"), a), spec_val(m.get("bike"), a)))
        off += len(feats)
    if off != n:
        raise RuntimeError(f"{job['url']}: read {off} of {n}")
    aliases = {f["name"]: {"alias": f.get("alias"), **({"description": f["description"]} if f.get("description") else {})}
               for f in meta.get("fields", []) if f["name"] in spec_fields(m)}
    return rows, aliases, (meta.get("editingInfo") or {}).get("dataLastEditDate")


def bundle_crash_sources(wanted=None):
    """fips -> (source name as in SOURCES, old window string) for every bundle that loaded a state/city crash row.
    With `wanted` (FIPS codes named on the command line) only those bundles are read, and each must be on disk."""
    out = {}
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import r2_only
    if wanted:
        miss = [f for f in wanted if not os.path.exists(os.path.join(ROOT, "counties", f"bundle_{f}.json.gz"))]
        if miss:
            raise SystemExit(f"build_state_crash_counts.py: county files not in counties/ here: {miss[:5]}")
        paths = [os.path.join(ROOT, "counties", f"bundle_{f}.json.gz") for f in sorted(set(wanted))]
    else:
        r2_only.require_local("build_state_crash_counts.py")   # R2-only county files must be on disk, or they would be dropped
        paths = sorted(glob.glob(os.path.join(ROOT, "counties", "bundle_*.json.gz")))
    for p in paths:
        d = json.loads(gzip.decompress(open(p, "rb").read())); m = d["meta"]
        for s in m.get("sources", []):
            if len(s) > 3 and s[3] is True:
                for name in SOURCES:
                    if s[0].startswith(name):
                        w = re.search(r"(\d{4})-(\d{4})", s[0])
                        out[m["fips"]] = (name, w.group(0) if w else None, os.path.relpath(p, ROOT))
    return out


def build(fips, name, old_window, bundle_path):
    src = SOURCES[name]
    env = county_extent(fips)
    lat0 = (env[1] + env[3]) / 2
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    to_m = lambda c: c * [kx, ky]
    bgs = block_groups(fips, to_m)
    gids = list(bgs)
    tree = STRtree([bgs[g].buffer(BOUNDARY_M) for g in gids])
    strict = STRtree([bgs[g] for g in gids])

    rows, aliases, edits, seen = [], {}, {}, set()
    for job in src["jobs"]:
        r, al, ed = fetch_rows(job, env)
        aliases.update(al); edits[job["url"]] = ed
        for x in r:
            if x[0] is not None:   # one row per crash id across this source's layers
                if x[0] in seen:
                    continue
                seen.add(x[0])
            rows.append(x)

    out = {g: [0, 0, 0] for g in gids}
    strict_out = {g: [0, 0, 0] for g in gids}
    st = {"crashes": len(rows), "with_coordinates": 0, "matched": 0, "on_boundary": 0}
    for _id, lat, lon, k, s, ped, bike in rows:
        if lat is None or not (env[1] <= lat <= env[3] and env[0] <= lon <= env[2]):
            continue
        st["with_coordinates"] += 1
        p = Point(lon * kx, lat * ky)
        hits = [int(i) for i in tree.query(p, predicate="intersects")]
        if not hits:
            continue
        st["matched"] += 1
        if len(hits) > 1:
            st["on_boundary"] += 1
        pb, ksi = (1 if (ped or bike) else 0), (1 if (k > 0 or s > 0) else 0)
        num_hits = len(hits)
        w_all = 1.0 / num_hits
        w_pb = (1.0 / num_hits) if pb else 0.0
        w_ksi = (1.0 / num_hits) if ksi else 0.0
        for i in hits:
            c = out[gids[i]]
            c[0] += w_pb
            c[1] += w_ksi
            c[2] += w_all
        for i in strict.query(p, predicate="within"):
            c = strict_out[gids[int(i)]]; c[0] += pb; c[1] += ksi; c[2] += 1
            break
    out = {g: [round(v, 4) for v in c] for g, c in out.items()}   # sum unrounded, round once (1/k parts must add up)
    # with_coordinates above counts crashes inside the county's padded envelope; crashes outside it belong to neighbours

    y0, y1 = src["years"]
    out["_meta"] = {
        "source": name,
        "service_url": [j["url"] for j in src["jobs"]],
        "where": [j["where"] for j in src["jobs"]],
        "years": [y0, y1],
        "rule": RULE,
        "weighting": "1/k",
        "block_group_sums": [round(sum(v[i] for v in out.values()), 3) for i in range(3)],
        "fields": ["pedestrian or bicycle crashes", "killed or seriously injured crashes", "injury or fatal crashes" if src.get("all_injury") else "all crashes"],
        "field_map": {k: (list(v) if isinstance(v, tuple) else v) for k, v in src["jobs"][0]["map"].items()},
        "field_aliases": aliases,
        "notes": src["notes"],
        "all_injury_only": bool(src.get("all_injury")),
        **({"pedbike_lower_bound": True} if src.get("pedbike_lower_bound") else {}),
        **({"field_descriptions": src["field_descriptions"]} if src.get("field_descriptions") else {}),
        "geography": "Census TIGERweb 2020 block groups",
        "old_bundle_window": old_window,
        "bundle": bundle_path,
        "data_last_edit": edits,
        **st,
        "counting_note": "crashes = records the source returned for the county's bounding box (neighbouring counties included); with_coordinates = those with a location inside the box; matched = counted for at least one of this county's block groups; on_boundary = matched crashes counted for more than one block group. Crashes the source stores without a location are not returned by a map query, so their share is unknown here.",
        "strict_within_totals": [sum(v[i] for v in strict_out.values()) for i in range(3)],
        "built": date.today().isoformat(),
        "script": "scripts/build_state_crash_counts.py",
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, f"{fips}.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return fips, st, len(gids)


def main():
    todo = bundle_crash_sources(sys.argv[1:])
    if sys.argv[1:]:
        todo = {f: v for f, v in todo.items() if f in sys.argv[1:]}
    print(f"{len(todo)} counties", file=sys.stderr)
    fails = []

    def one(item):
        fips, (name, w, bp) = item
        try:
            r = build(fips, name, w, bp)
            print(f"  {fips} {name}: {r[1]} over {r[2]} block groups", file=sys.stderr, flush=True)
        except Exception as e:
            fails.append((fips, str(e)[:200]))
            print(f"  {fips} FAILED: {e}", file=sys.stderr, flush=True)

    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(one, sorted(todo.items())))
    if fails:
        print("FAILED:", fails, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
