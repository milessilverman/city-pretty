"""Round 8.6: where bus data is missing or old, from every built county's transit meta (pipeline/data_<fips>/transit_stops_7_9.meta.json).
- counties with no counted feed (bus frequency unknown or 0 everywhere), with population (ACS in metrics.json) and the operators skipped;
- feeds measured on an ended schedule (selection 20: the newest copy that could be read has ended);
- feeds skipped with stops in the county: schedule ended over a year ago, no copy could be downloaded, no bus service near today;
- the hosts of those feeds' own download URLs (MobilityData catalog urls.direct_download) and whether this machine reaches them
  (HEAD request through the proxy; 000 = refused), ranked by counties with no counted feed, then counties affected.
Writes logs/r86_transit_gaps.json and logs/r86_transit_gaps.md.  usage: python3 -I r86_transit_gaps.py [--no-probe]"""
import json, glob, os, csv, collections, subprocess, sys
from urllib.parse import urlparse
N = "/home/user/national"
C = json.load(open(f"{N}/data/counties.json"))
probe = "--no-probe" not in sys.argv
cat = {}
for fn in ("sources.csv", "feeds_v2.csv"):
    for r in csv.DictReader(open(f"{N}/cache/mdb/{fn}", encoding="utf-8-sig")):
        i = (r.get("mdb_source_id") or r.get("id") or "").replace("mdb-", "")
        if (r.get("urls.direct_download") or "").startswith("http"):
            cat.setdefault(i, r["urls.direct_download"].strip())
zero, ended, stale = [], [], []
H = collections.defaultdict(lambda: {"feeds": {}, "counties": set(), "zero": set()})
for p in sorted(glob.glob(f"{N}/pipeline/data_*/transit_stops_7_9.meta.json")):
    F = p.split("data_")[1][:5]
    if F not in C or not os.path.exists(f"{N}/pipeline/data_{F}/bundle-oc.b64"):
        continue
    m = json.load(open(p))
    pop = 0
    try:
        pop = int(round(sum((b.get("pop") or 0) for b in json.load(open(f"{N}/pipeline/data_{F}/metrics.json"))["metrics"].values())))
    except Exception:
        pass
    here = lambda s: s.get("stops_in_county", 1) > 0
    bad = [(s["id"], s["provider"], s["why"][:60]) for s in m.get("skipped", []) if here(s) and s["why"].startswith(("schedule ended", "no copy could be downloaded", "no bus service"))]
    for f in m.get("feeds", []):
        if f.get("schedule_ended"):
            ended.append({"fips": F, "id": f["id"], "provider": f["provider"], "ends": f["schedule_ended"]})
            bad.append((f["id"], f["provider"], "measured on an ended schedule"))
    stale += [{"fips": F, "id": i, "provider": pv, "why": w} for i, pv, w in bad if w != "measured on an ended schedule"]
    if not m.get("feeds"):
        zero.append({"fips": F, "name": C[F]["name"], "st": C[F]["state"], "pop": pop, "selection": m.get("selection"),
                     "skipped": sorted({f"{pv.strip()} ({i}: {w})" for i, pv, w in bad})})
    for i, pv, w in bad:
        u = cat.get(i)
        if not u:
            continue
        h = urlparse(u).hostname
        H[h]["feeds"][i] = [pv.strip(), u]; H[h]["counties"].add(F)
        if not m.get("feeds"):
            H[h]["zero"].add(F)
hosts = []
for h, d in H.items():
    code = ""
    if probe:
        code = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "12", "-I", f"https://{h}/"], capture_output=True, text=True).stdout.strip()
    hosts.append({"host": h, "reach": code, "feeds": d["feeds"], "counties": sorted(d["counties"]), "zero": sorted(d["zero"])})
hosts.sort(key=lambda x: (-len(x["zero"]), -len(x["counties"]), x["host"]))
zero.sort(key=lambda z: -z["pop"])
json.dump({"zero_feed_counties": zero, "ended_feeds": ended, "stale_or_unreadable": stale, "hosts": hosts}, open(f"{N}/logs/r86_transit_gaps.json", "w"), indent=1)
L = [f"# Where bus data is missing or old (round 8.6)\n", f"{len(zero)} counties with no counted feed ({sum(z['pop'] for z in zero):,} people); "
     f"{len(ended)} feeds measured on an ended schedule; {len(stale)} skipped feeds with stops in their county.\n",
     "| County | People | Operators skipped |", "|---|---:|---|"]
L += [f"| {z['name']}, {z['st']} | {z['pop']:,} | {'; '.join(z['skipped'])[:200] or 'none listed in the catalog'} |" for z in zero]
L += ["", "| Host | Reached | Counties with no feed | Counties | Feeds |", "|---|---|---:|---:|---|"]
L += [f"| {h['host']} | {'yes' if h['reach'] not in ('000', '') else ('no' if h['reach'] == '000' else '?')} | {len(h['zero'])} | {len(h['counties'])} | "
      f"{'; '.join(sorted({v[0][:30] for v in h['feeds'].values()}))[:120]} |" for h in hosts]
open(f"{N}/logs/r86_transit_gaps.md", "w").write("\n".join(L) + "\n")
print(f"{len(zero)} zero-feed counties, {len(ended)} ended feeds, {len(stale)} stale/unreadable, {len(hosts)} hosts "
      f"({sum(1 for h in hosts if h['reach'] == '000')} refused)")
