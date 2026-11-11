"""Real pedestrian/bicycle and killed-or-seriously-injured crash counts per LA block group (CHP CCRS 2023-2025), for the LA rows whose
text reported every crash as 'pedestrian/bike crashes' and '0 fatal/severe' (see la_crash_count_check.md). Text-only use on the page.
Inputs: la_data/ccrs_la_{2023,2024,2025}.json (round 5 download, compact rows [id, lat, lon, killed, injured, with, time]) and the
statewide CCRS serious-injury lists ccrs_severe_{yr}.json (CollisionId of every Fatal / SuspectSerious / SevereInactive injury).
Output: la_data/la_crash_counts.json {"meta": {...}, "bg": {gid: [pedbike, ksi, all]}}"""
import json
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
W5 = "/home/user/w5"; SEV = "/home/user/national/oc_regress"
B = json.load(open(f"{W5}/bundle_in.json"))
gids = [f["properties"]["id"] for f in B["bgs"]["features"]]; polys = [shape(f["geometry"]) for f in B["bgs"]["features"]]
T = STRtree(polys)
sev = set()
for y in (2023, 2024, 2025):
    sev |= {r["CollisionId"] for r in json.load(open(f"{SEV}/ccrs_severe_{y}.json"))["result"]["records"]}
out = {g: [0, 0, 0] for g in gids}; n = n_xy = 0
for y in (2023, 2024, 2025):
    j = json.load(open(f"{W5}/la_data/ccrs_la_{y}.json")); rows = j["rows"] if isinstance(j, dict) else j
    for cid, lat, lon, killed, injured, w, t in rows:
        n += 1
        try:
            p = Point(float(lon), float(lat))
        except (TypeError, ValueError):
            continue
        n_xy += 1
        hit = [int(i) for i in T.query(p, predicate="within")] or [int(i) for i in T.query(p, predicate="intersects")]
        if not hit:
            continue
        c = out[gids[hit[0]]]; wd = (w or "").upper()
        c[2] += 1
        if "PEDESTRIAN" in wd or "BICYCLE" in wd: c[0] += 1
        if (killed or 0) > 0 or cid in sev: c[1] += 1
json.dump({"meta": {"source": "CHP CCRS 2023-2025 (data.ca.gov), LA County rows from round 5; serious injuries from the statewide CCRS injured-persons lists",
                    "years": [2023, 2025], "crashes": n, "with_coordinates": n_xy, "fields": ["pedestrian or bicycle crashes", "killed or seriously injured crashes", "all crashes"]},
           "bg": out}, open(f"{W5}/la_data/la_crash_counts.json", "w"), separators=(",", ":"))
tot = [sum(v[i] for v in out.values()) for i in range(3)]
print("crashes", n, "with coordinates", n_xy, "| totals: ped/bike", tot[0], "KSI", tot[1], "all", tot[2])
