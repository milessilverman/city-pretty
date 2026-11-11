"""Effect of round 8.3's rail-station fix on the re-bundled counties. Old: the county's bundle on the round-8.2 national site (site82);
new: its current bundle. Per county: block groups whose distance to the nearest rail station (rm) became known, got shorter or longer, the
median change where it shortened, and block groups whose rail-dependent projects changed (engine.py: bus lanes need no rail within 800 m, BRT
none within 1 mile, a rail-station share none within 2.4 km, bike share rail within 813 m). Writes logs/station_effect.json; prints a table.
usage: station_effect.py [<baseline site, default site82>] [<re-bundle log> ...]   (default: logs/station_rebundle.log)"""
import gzip, json, base64, os, statistics, sys
N = "/home/user/national"
ARGS = sys.argv[1:]
BASE = ARGS.pop(0) if ARGS and ARGS[0].startswith("site") else "site82"   # the baseline national site (round 8.4: site83)
LOGS = ARGS or ["logs/station_rebundle.log"]
C = json.load(open(f"{N}/data/counties.json"))
RAIL_PROJECTS = {"bus_lane", "brt", "rail_station", "bike_share"}
done = {}
for lg in LOGS:
    if os.path.exists(f"{N}/{lg}"):
        for l in open(f"{N}/{lg}"):
            p = l.split()
            if len(p) >= 4 and p[2] == "EXIT":
                done[p[1]] = p[3] == "0"
rows = []
for F in sorted(f for f, ok in done.items() if ok):
    op, np_ = f"{N}/{BASE}/counties/bundle_{F}.json.gz", f"{N}/pipeline/data_{F}/bundle-oc.b64"
    if not (os.path.exists(op) and os.path.exists(np_)):
        continue
    O = json.loads(gzip.decompress(open(op, "rb").read())); B = json.loads(gzip.decompress(base64.b64decode(open(np_).read())))
    known = shorter = longer = lost = proj = 0; d = []
    for g, x in B["details"].items():
        o = O["details"].get(g)
        if not o:
            continue
        a, b = o["m"].get("rm"), x["m"].get("rm")
        if a is None and b is not None: known += 1
        elif a is not None and b is None: lost += 1
        elif a is not None and b is not None and abs(a - b) > 1:
            if b < a: shorter += 1; d.append(a - b)
            else: longer += 1
        po = {r[0] for r in (o.get("r") or []) if r and r[0] in RAIL_PROJECTS}; pn = {r[0] for r in (x.get("r") or []) if r and r[0] in RAIL_PROJECTS}
        proj += po != pn
    ol = O.get("layers", {}).get("stations"); nl = B.get("layers", {}).get("stations")
    rows.append({"fips": F, "county": C[F]["name"], "st": C[F]["state"], "bgs": len(B["details"]), "rail_known": known, "rail_shorter": shorter,
                 "rail_longer": longer, "rail_lost": lost, "median_shorter_m": round(statistics.median(d)) if d else None, "rail_projects_changed": proj,
                 "stations_old": len(ol.get("features", [])) if isinstance(ol, dict) else None, "stations_new": len(nl.get("features", [])) if isinstance(nl, dict) else None})
json.dump(rows, open(f"{N}/logs/station_effect.json" if BASE == "site82" else f"{N}/logs/station_effect_{BASE}.json", "w"), indent=1)
print("| County | Block groups | Stations on the map, before → after | Rail distance newly known | Shorter (median, m) | Longer | Rail-dependent projects changed |")
print("|---|---|---|---|---|---|---|")
for r in sorted(rows, key=lambda r: -(r["rail_known"] + r["rail_shorter"] + r["rail_longer"])):
    if r["rail_known"] + r["rail_shorter"] + r["rail_longer"] + r["rail_lost"] == 0:
        continue
    print(f"| {r['county']}, {r['st']} | {r['bgs']:,} | {r['stations_old']} → {r['stations_new']} | {r['rail_known']:,} | {r['rail_shorter']:,} ({r['median_shorter_m'] or '–'}) | {r['rail_longer']:,} | {r['rail_projects_changed']:,} |")
print(f"\n{len(rows)} re-bundled counties compared; {sum(1 for r in rows if r['rail_known'] + r['rail_shorter'] + r['rail_longer'] + r['rail_lost'] == 0)} with no rail-distance change.")
