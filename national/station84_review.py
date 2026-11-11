"""Round 8.4 review of the rail-station decisions (metrics_oc.confirm_rail_stations writes data_<fips>/rail_confirm.json during each build).
For every county re-bundled or built since round 8.4 was installed: how many OpenStreetMap stations a GTFS rail stop confirms, how many are
kept by type (subway / light rail / monorail) or by operator, which are dropped (with the tags that decided it) and which GTFS stations are
added. Writes logs/station84_review.json and logs/station84_review.md (dropped and added stations listed per county, to be read for false
drops before round84_finish.sh may build pages: it waits for logs/station84_reviewed).
usage: station84_review.py [<re-bundle or build log> ...]   (default: logs/rebundle84.log and the batch-5 build logs)"""
import json, os, sys, glob
N = "/home/user/national"
C = json.load(open(f"{N}/data/counties.json"))
LOGS = sys.argv[1:] or ["logs/rebundle84.log"]
done = []
for lg in LOGS:
    if os.path.exists(f"{N}/{lg}"):
        for l in open(f"{N}/{lg}"):
            p = l.split()
            if len(p) >= 4 and p[2] == "EXIT" and p[3] == "0":
                done.append(p[1])
# batch-5 counties: their build log ends with "DONE <fips>"
for b in sorted(glob.glob(f"{N}/logs/build_*.log")):
    f = os.path.basename(b)[6:-4]
    if f.isdigit() and os.path.exists(f"{N}/pipeline/data_{f}/rail_confirm.json") and f not in done:
        if "DONE " + f in open(b, errors="replace").read()[-400:]:
            done.append(f)
rows, md = [], []
for f in sorted(set(done)):
    p = f"{N}/pipeline/data_{f}/rail_confirm.json"
    if not os.path.exists(p):
        continue
    R = json.load(open(p))
    c = C.get(f, {})
    rows.append({"fips": f, "county": c.get("name"), "st": c.get("state"), **{"n_" + k: len(R.get(k, [])) for k in ("gtfs", "mode", "agency", "dropped", "added")},
                 "dropped": R.get("dropped", []), "mode_kept": R.get("mode", []), "agency_kept": R.get("agency", []), "added": R.get("added", [])})
json.dump(rows, open(f"{N}/logs/station84_review.json", "w"), indent=1)
md.append("| County | Confirmed by a GTFS stop | Kept by type | Kept by operator | Dropped | Added from GTFS |")
md.append("|---|---|---|---|---|---|")
for r in sorted(rows, key=lambda r: -(r["n_dropped"] + r["n_added"])):
    md.append(f"| {r['county']}, {r['st']} ({r['fips']}) | {r['n_gtfs']} | {r['n_mode']} | {r['n_agency']} | {r['n_dropped']} | {r['n_added']} |")
md.append("")
for r in sorted(rows, key=lambda r: r["fips"]):
    if not (r["dropped"] or r["added"] or r["mode_kept"] or r["agency_kept"]):
        continue
    md.append(f"### {r['county']}, {r['st']} ({r['fips']})")
    for lon, lat, nm, d, tags in r["dropped"]:
        t = ", ".join(f"{k}={v}" for k, v in tags.items() if k in ("operator", "network", "station", "train", "light_rail", "subway", "monorail", "usage"))
        md.append(f"- dropped: {nm or '(unnamed)'}{' (stop position)' if tags.get('stop_position') else ''}{' (area)' if tags.get('from_area') else ''}"
                  f" | nearest GTFS rail stop {('%d m' % d) if d is not None else 'none'} | {t} | {lat:.5f}, {lon:.5f}")
    for k in ("mode_kept", "agency_kept"):
        for lon, lat, nm, d, tags in r[k]:
            t = ", ".join(f"{a}={v}" for a, v in tags.items() if a in ("operator", "network", "station", "light_rail", "subway", "monorail"))
            md.append(f"- kept ({'type' if k == 'mode_kept' else 'operator'}): {nm} | nearest GTFS rail stop {('%d m' % d) if d is not None else 'none'} | {t}")
    for lon, lat, nm, fid, ty, ag in r["added"]:
        md.append(f"- added: {nm} | MobilityData {fid}, route type {ty}, {ag} | {lat:.5f}, {lon:.5f}")
    md.append("")
open(f"{N}/logs/station84_review.md", "w").write("\n".join(md) + "\n")
tot = {k: sum(r["n_" + k] for r in rows) for k in ("gtfs", "mode", "agency", "dropped", "added")}
print(len(rows), "counties;", tot)
