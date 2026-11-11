"""Transit selection check (current GTFS_SELECTION in pipeline/fetch_oc.py) for one built county: run the transit step alone into a scratch copy, compare with the county's current
transit files, and either adopt the new files (identical stops: only the metadata changes, no re-bundle needed) or queue the county for a
re-bundle (logs/transit8_rebundle.txt). One line per county in logs/transit8_check.log; details in logs/transit8/<FIPS>.json.
usage: python3 transit8_check.py <FIPS>"""
import json, os, shutil, subprocess, sys, time, collections

F = sys.argv[1]
import re
SEL = int(re.search(r"^GTFS_SELECTION = (\d+)", open("/home/user/national/pipeline/fetch_oc.py").read(), re.M).group(1))
N = "/home/user/national"; P = f"{N}/pipeline"; D = f"{P}/data_{F}"
SCR = f"/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/t8/data_{F}"
os.makedirs(f"{N}/logs/transit8", exist_ok=True)
shutil.rmtree(SCR, ignore_errors=True); os.makedirs(SCR)
for f in ("bg.geojson", "places.geojson"):
    if os.path.exists(f"{D}/{f}"):
        shutil.copy(f"{D}/{f}", SCR)
env = dict(os.environ, CP_FIPS=F, CP_DATA=SCR)
t0 = time.time()
r = subprocess.run(["python3", "fetch_oc.py", "gtfs"], cwd=P, env=env, capture_output=True, text=True, timeout=5400)
new_meta_p = f"{SCR}/transit_stops_7_9.meta.json"
if r.returncode != 0 or not os.path.exists(new_meta_p) or json.load(open(new_meta_p)).get("selection") != SEL:
    line = f"{time.strftime('%H:%M:%S')} {F} FAILED exit {r.returncode} {(r.stdout + r.stderr)[-300:]!r}"
    open(f"{N}/logs/transit8_check.log", "a").write(line + "\n"); print(line); sys.exit(1)


def load(p):
    return json.load(open(p)) if os.path.exists(p) else []


old_s, new_s = load(f"{D}/transit_stops_7_9.json"), load(f"{SCR}/transit_stops_7_9.json")
old_g, new_g = load(f"{D}/transit_gap_stops.json"), load(f"{SCR}/transit_gap_stops.json")
key = lambda v: (round(v[0], 5), round(v[1], 5))
o = {key(v): v[2] for v in old_s}; n = {key(v): v[2] for v in new_s}
changed = [k for k in set(o) | set(n) if abs(o.get(k, -1) - n.get(k, -1)) > 1e-6]
# metrics only asks whether a gap stop lies within 400 m, so the set of places matters (selection 5 listed some stale feeds twice)
gap_o = {(round(g[0], 5), round(g[1], 5)) for g in old_g}; gap_n = {(round(g[0], 5), round(g[1], 5)) for g in new_g}
gap_changed = gap_o != gap_n
om = json.load(open(f"{D}/transit_stops_7_9.meta.json")) if os.path.exists(f"{D}/transit_stops_7_9.meta.json") else {}
nm = json.load(open(new_meta_p))
detail = {"fips": F, "seconds": round(time.time() - t0), "stops_old": len(o), "stops_new": len(n), "stops_changed": len(changed),
          "buses_old": round(sum(o.values()), 1), "buses_new": round(sum(n.values()), 1),
          "only_old": sum(1 for k in o if k not in n), "only_new": sum(1 for k in n if k not in o),
          "gap_old": len(gap_o), "gap_new": len(gap_n),
          "feeds_old": [(x["id"], x["provider"], x.get("stops")) for x in om.get("feeds", [])],
          "feeds_new": [(x["id"], x["provider"], x.get("stops"), x.get("agencies"), x.get("counted_from_another_feed")) for x in nm.get("feeds", [])],
          "skipped_new": nm.get("skipped", [])}
json.dump(detail, open(f"{N}/logs/transit8/{F}.json", "w"), indent=1)
same = not changed and not gap_changed
gap_only_skip = False
if not changed and gap_changed:
    # only the stale-feed stops changed. metrics turns a block group "unknown" when a stale-feed stop lies within 400 m of its point and no
    # current stop does, so a block group can change only if it is unknown now and lost a nearby stale stop, or is 0 now and gained one.
    # Block-group centroids (TIGER CENTLON/CENTLAT and the shape centroid) with a 2 km margin stand in for the point; if no block group
    # qualifies, the bundle cannot change and no re-bundle is needed.
    import math
    from shapely.geometry import shape
    mt = json.load(open(f"{D}/metrics.json"))["metrics"]
    removed, added = gap_o - gap_n, gap_n - gap_o
    def near(x, y, pts, R=2000.0):
        cl = math.cos(math.radians(y))
        return any(((px - x) * cl * 111320) ** 2 + ((py - y) * 110540) ** 2 <= R * R for px, py in pts)
    hits = []
    for f in json.load(open(f"{D}/bg.geojson"))["features"]:
        g = f["properties"]["GEOID"]; b = (mt.get(g) or {}).get("bt", "-")
        if b is None or b == 0:
            c = shape(f["geometry"]).centroid
            pts = [(c.x, c.y)] + ([(float(f["properties"]["CENTLON"]), float(f["properties"]["CENTLAT"]))] if f["properties"].get("CENTLON") else [])
            if any(near(x, y, removed if b is None else added) for x, y in pts):
                hits.append(g)
    detail["gap_only_bgs_that_could_change"] = len(hits)
    json.dump(detail, open(f"{N}/logs/transit8/{F}.json", "w"), indent=1)
    gap_only_skip = not hits
for f in ("transit_stops_7_9.json", "transit_gap_stops.json", "transit_stops_7_9.meta.json"):
    if os.path.exists(f"{D}/{f}") and not os.path.exists(f"{D}/{f}.sel5"):
        shutil.copy(f"{D}/{f}", f"{D}/{f}.sel5")   # the files before this check (the previous selection), kept for the audit
    shutil.copy(f"{SCR}/{f}", f"{D}/{f}.t6")
for f in ("transit_stops_7_9.json", "transit_gap_stops.json", "transit_stops_7_9.meta.json"):
    os.replace(f"{D}/{f}.t6", f"{D}/{f}")   # the selection-6 files replace the old ones either way (identical stops when same)
if not same and not gap_only_skip:
    open(f"{N}/logs/transit8_rebundle.txt", "a").write(F + "\n")
line = (f"{time.strftime('%H:%M:%S')} {F} {'same' if same else ('gap-only, no block group can change' if gap_only_skip else 'CHANGED')} stops {len(o)}->{len(n)} (changed {len(changed)}), "
        f"buses/h {detail['buses_old']}->{detail['buses_new']}, gap {detail['gap_old']}->{detail['gap_new']}, feeds {len(om.get('feeds', []))}->{len(nm.get('feeds', []))}")
open(f"{N}/logs/transit8_check.log", "a").write(line + "\n"); print(line)
shutil.rmtree(SCR, ignore_errors=True)
