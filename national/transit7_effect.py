"""Effect of transit selections 6 and 7 on the re-bundled counties. Old: the county's bundle in the round-8.1 national site (site81);
new: its current bundle. Per county: block groups whose bus frequency (bt, buses per hour within 400 m, 7-9 am) changed, became unknown
or known, the median new/old ratio where both are known, and block groups whose top-ranked project changed (that can also come from the
re-downloaded OpenStreetMap extract). Writes logs/transit7_effect.json and prints a Markdown table."""
import gzip, json, base64, os, statistics, sys
N = "/home/user/national"
# usage: transit7_effect.py [<baseline site dir, default site81> [<re-bundle log> ...]] (round 8.3: site82 logs/transit8_rebundle.log)
BASE = sys.argv[1] if len(sys.argv) > 1 else "site81"
LOGS = sys.argv[2:] or ["logs/transit6_rebundle.log", "logs/transit7_rebundle.log"]
C = json.load(open(f"{N}/data/counties.json"))
# projects whose eligibility depends on bus frequency (engine.py): signal priority, shelters, shade canopies, bus lanes, BRT, a rail station
# share, protected bike lanes on a bus street, microtransit (low frequency) and a food hall on a busy bus corridor
BUS_PROJECTS = {"transit_priority", "bus_shelters", "transit_shade", "bus_lane", "brt", "rail_station", "protected_bike", "microtransit", "food_hall"}
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
    O = json.loads(gzip.decompress(open(op, "rb").read()))
    B = json.loads(gzip.decompress(base64.b64decode(open(np_).read())))
    tot = ch = unk_new = unk_gone = top = tier_any = bus_proj = 0; ratio = []; up = down = 0
    of = {f["properties"]["id"]: f["properties"] for f in O.get("features", [])}; nf = {f["properties"]["id"]: f["properties"] for f in B.get("features", [])}
    for g, d in B["details"].items():
        o = O["details"].get(g)
        if not o:
            continue
        tot += 1
        a, b = o["m"].get("bt"), d["m"].get("bt")
        if a is None and b is not None:
            unk_gone += 1
        elif a is not None and b is None:
            unk_new += 1
        elif a is not None and b is not None and abs(a - b) > 0.05:
            ch += 1; up += b > a; down += b < a
        if a and b:
            ratio.append(b / a)
        # the page's top project: the best paying project of evidence tier D, shown on the map (feature property "t"; build_oc "tp"
        # holds the best per tier A-U). Until round 8.5 this compared the first row of the block group's list, which is not ranked.
        po_, pn_ = of.get(g) or {}, nf.get(g) or {}
        top += po_.get("t") != pn_.get("t")
        tpo, tpn = po_.get("tp") or [], pn_.get("tp") or []
        tier_any += any(((tpo[i] if i < len(tpo) else None) or [None])[0] != ((tpn[i] if i < len(tpn) else None) or [None])[0] for i in range(5))
        po = {x[0] for x in (o.get("r") or []) if x and x[0] in BUS_PROJECTS}; pn = {x[0] for x in (d.get("r") or []) if x and x[0] in BUS_PROJECTS}
        bus_proj += po != pn
    rows.append({"fips": F, "county": C[F]["name"], "st": C[F].get("state") or C[F].get("st"), "bgs": tot, "bt_changed": ch, "bt_up": up, "bt_down": down,
                 "became_unknown": unk_new, "became_known": unk_gone, "median_ratio": round(statistics.median(ratio), 3) if ratio else None, "top_project_changed": top, "top_any_tier_changed": tier_any, "bus_projects_changed": bus_proj})
json.dump(rows, open(f"{N}/logs/transit7_effect.json" if BASE == "site81" else f"{N}/logs/transit_effect_{BASE}.json", "w"), indent=1)
print("| County | Block groups | Bus frequency changed (up / down) | Became unknown | Became known | Median new/old | Bus-dependent projects changed | Top project changed |")
print("|---|---|---|---|---|---|---|---|")
for r in sorted(rows, key=lambda r: -(r["bt_changed"] + r["became_unknown"] + r["became_known"])):
    if r["bt_changed"] + r["became_unknown"] + r["became_known"] == 0:
        continue
    print(f"| {r['county']}, {r['st']} | {r['bgs']:,} | {r['bt_changed']:,} ({r['bt_up']:,} / {r['bt_down']:,}) | {r['became_unknown']:,} | {r['became_known']:,} | "
          f"{r['median_ratio'] if r['median_ratio'] is not None else '–'} | {r['bus_projects_changed']:,} | {r['top_project_changed']:,} |")
print(f"\n{len(rows)} re-bundled counties compared; {sum(1 for r in rows if r['bt_changed'] + r['became_unknown'] + r['became_known'] == 0)} with no bus-frequency change.")
