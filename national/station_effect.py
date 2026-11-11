"""Effect of round 8.3's rail-station fix on the re-bundled counties. Old: the county's bundle on the round-8.2 national site (site82);
new: its current bundle. Per county: block groups whose distance to the nearest rail station (rm) became known, got shorter or longer, the
median change where it shortened, and block groups whose rail-dependent projects changed (engine.py: bus lanes need no rail within 796 m, BRT
none within 1 mile, a rail-station share none within 2.4 km, bike share rail within 813 m), counted apart from transit upzoning (single-family
lots with rail within 810 m), and block groups whose top-ranked project changed: the page's map project (feature property "t", the best
paying project of evidence tier D) and the best project of any tier ("tp"). Round 8.5 added the upzoning and top-project columns (audit of
round 8.4: neither was counted). Writes logs/station_effect.json (or _<baseline>.json); prints a table.
usage: station_effect.py [<baseline site, default site82>] [<re-bundle log> ...]   (default: logs/station_rebundle.log)"""
import gzip, json, base64, os, statistics, sys
N = "/home/user/national"
ARGS = sys.argv[1:]
BASE = ARGS.pop(0) if ARGS and ARGS[0].startswith("site") else "site82"   # the baseline national site (round 8.4: site83)
LOGS = ARGS or ["logs/station_rebundle.log"]
C = json.load(open(f"{N}/data/counties.json"))
RAIL_PROJECTS = {"bus_lane", "brt", "rail_station", "bike_share"}
UPZONE = "upzone_transit"
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
    known = shorter = longer = lost = proj = upz = upz_add = upz_del = top = tier_any = 0; d = []; dl = []
    of = {f["properties"]["id"]: f["properties"] for f in O.get("features", [])}; nf = {f["properties"]["id"]: f["properties"] for f in B.get("features", [])}
    for g, x in B["details"].items():
        o = O["details"].get(g)
        if not o:
            continue
        a, b = o["m"].get("rm"), x["m"].get("rm")
        if a is None and b is not None: known += 1
        elif a is not None and b is None: lost += 1
        elif a is not None and b is not None and abs(a - b) > 1:
            if b < a: shorter += 1; d.append(a - b)
            else: longer += 1; dl.append(b - a)
        po = {r[0] for r in (o.get("r") or []) if r and r[0] in RAIL_PROJECTS}; pn = {r[0] for r in (x.get("r") or []) if r and r[0] in RAIL_PROJECTS}
        proj += po != pn
        uo = any(r and r[0] == UPZONE for r in (o.get("r") or [])); un = any(r and r[0] == UPZONE for r in (x.get("r") or []))
        upz += uo != un; upz_add += un and not uo; upz_del += uo and not un
        po_, pn_ = of.get(g) or {}, nf.get(g) or {}
        top += po_.get("t") != pn_.get("t")
        tpo, tpn = po_.get("tp") or [], pn_.get("tp") or []
        tier_any += any(((tpo[i] if i < len(tpo) else None) or [None])[0] != ((tpn[i] if i < len(tpn) else None) or [None])[0] for i in range(5))
    ol = O.get("layers", {}).get("stations"); nl = B.get("layers", {}).get("stations")
    rows.append({"fips": F, "county": C[F]["name"], "st": C[F]["state"], "bgs": len(B["details"]), "rail_known": known, "rail_shorter": shorter,
                 "rail_longer": longer, "rail_lost": lost, "median_shorter_m": round(statistics.median(d)) if d else None, "median_longer_m": round(statistics.median(dl)) if dl else None,
                 "max_longer_m": round(max(dl)) if dl else None, "rail_projects_changed": proj,
                 "upzoning_changed": upz, "upzoning_added": upz_add, "upzoning_removed": upz_del, "top_project_changed": top, "top_any_tier_changed": tier_any,
                 "stations_old": len(ol.get("features", [])) if isinstance(ol, dict) else None, "stations_new": len(nl.get("features", [])) if isinstance(nl, dict) else None})
json.dump(rows, open(f"{N}/logs/station_effect.json" if BASE == "site82" else f"{N}/logs/station_effect_{BASE}.json", "w"), indent=1)
print("| County | Block groups | Stations on the map, before → after | Rail distance newly known | Shorter (median, m) | Longer (median, largest, m) | Bus lane, BRT, station share or bike share changed | Transit upzoning changed (added / removed) | Top project changed (map / any tier) |")
print("|---|---|---|---|---|---|---|---|---|")
for r in sorted(rows, key=lambda r: -(r["rail_known"] + r["rail_shorter"] + r["rail_longer"])):
    if r["rail_known"] + r["rail_shorter"] + r["rail_longer"] + r["rail_lost"] == 0:
        continue
    print(f"| {r['county']}, {r['st']} | {r['bgs']:,} | {r['stations_old']} → {r['stations_new']} | {r['rail_known']:,} | {r['rail_shorter']:,} ({r['median_shorter_m'] or '–'}) | {r['rail_longer']:,} ({r['median_longer_m'] or '–'}, {r['max_longer_m'] or '–'}) | {r['rail_projects_changed']:,} | {r['upzoning_changed']:,} ({r['upzoning_added']:,} / {r['upzoning_removed']:,}) | {r['top_project_changed']:,} / {r['top_any_tier_changed']:,} |")
print(f"\n{len(rows)} re-bundled counties compared; {sum(1 for r in rows if r['rail_known'] + r['rail_shorter'] + r['rail_longer'] + r['rail_lost'] == 0)} with no rail-distance change.")
