"""Round 8.4: remove the site suggestions whose anchor destination is a "rail station" that the county's rail-station check dropped
(pipeline data_<fips>/rail_confirm.json): EV hubs "at the parking lot of <station> (rail station)" and lots "next to <station> (rail
station)", e.g. Hennepin's Blake Road and Golden Triangle (Green Line Extension, not open), Queens' AirTrain stop Lefferts Boulevard.
sites.py now leaves such stations out of its destinations; this applies the same to county site files built before. A name that the
check also kept elsewhere in the county is left alone. Updates meta.counts; prints and logs what it removed.
usage: python3 sites_drop_stations.py [<fips> ...]   (default: every county with both files)"""
import json, os, sys, glob, time
W5 = "/home/user/w5"; P = "/home/user/national/pipeline"
fs = sys.argv[1:] or sorted(os.path.basename(p)[6:-5] for p in glob.glob(f"{W5}/county_sites/sites_*.json"))
log = open("/home/user/national/logs/sites_drop_stations.log", "a")
total = 0
for f in fs:
    rc, sp = f"{P}/data_{f}/rail_confirm.json", f"{W5}/county_sites/sites_{f}.json"
    if not (os.path.exists(rc) and os.path.exists(sp)):
        continue
    R = json.load(open(rc))
    gone = {e[2] for e in R.get("dropped", []) if e[2]} - {e[2] for k in ("gtfs", "mode", "agency") for e in R.get(k, [])}
    if not gone:
        continue
    d = json.load(open(sp)); removed = []
    for g in list(d["sites"]):
        keep = []
        for s in d["sites"][g]:
            nx = s.get("next")
            if (s.get("dk") == "rail station" and s.get("dest") in gone) or (nx and nx[1] == "rail station" and nx[0] in gone):
                removed.append((g, s["t"], s.get("dest") or nx[0]))
            else:
                keep.append(s)
        if keep:
            d["sites"][g] = keep
        else:
            del d["sites"][g]
    if removed:
        c = d.get("meta", {}).get("counts")
        if isinstance(c, dict):
            for g, t, n in removed:
                c[t] = c.get(t, 0) - 1
        json.dump(d, open(sp + ".new", "w"), separators=(",", ":"), ensure_ascii=False); os.replace(sp + ".new", sp)
        for r in removed:
            line = f"{time.strftime('%H:%M:%S')} {f} removed {r[1]} site in {r[0]} anchored on dropped station {r[2]!r}"
            print(line); log.write(line + "\n")
        total += len(removed)
print(total, "site suggestions removed")
