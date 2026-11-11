"""Share of bus stop_times with neither arrival nor departure time (untimed stops between timepoints) in every feed the counties use.
usage: python3 -I untimed_scan.py <out.json> [workers]"""
import sys, json, glob, io, csv, zipfile, urllib.request, time, collections
from multiprocessing import Pool
BUS = {3, 11} | set(range(700, 800))
def get(u):
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}), timeout=900) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(5 * (i + 1))
    raise last
def one(url):
    try:
        z = zipfile.ZipFile(io.BytesIO(get(url)))
    except Exception as e:
        return url, {"error": repr(e)[:80]}
    names = set(z.namelist()); alias = {}
    for nm in sorted(names):
        base, dot, ext = nm.rsplit("/", 1)[-1].rpartition(".")
        if dot and base and ext.lower() in ("txt", "csv"): alias.setdefault(base.lower() + ".txt", nm)
    def rd(n):
        m = n if n in names else alias.get(n.lower())
        return [] if not m else ({(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()} for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
    try:
        br = {x["route_id"] for x in rd("routes.txt") if (x.get("route_type") or "").strip().isdigit() and int(x["route_type"]) in BUS and x.get("route_id")}
        bt = {t["trip_id"] for t in rd("trips.txt") if t.get("route_id") in br and t.get("trip_id")}
        c = collections.Counter(); stops_untimed = set(); stops_timed = set()
        for st in rd("stop_times.txt"):
            if st.get("trip_id") in bt:
                c["all"] += 1
                if not ((st.get("departure_time") or "").strip() or (st.get("arrival_time") or "").strip()):
                    c["untimed"] += 1; stops_untimed.add(st.get("stop_id"))
                else:
                    stops_timed.add(st.get("stop_id"))
        only_untimed = len(stops_untimed - stops_timed)
        return url, {"stop_times": c["all"], "untimed": c["untimed"], "stops_only_untimed": only_untimed, "stops": len(stops_untimed | stops_timed)}
    except Exception as e:
        return url, {"error": "unreadable " + repr(e)[:80]}
urls = collections.defaultdict(set)
for p in glob.glob("/home/user/national/pipeline/data_*/transit_stops_7_9.meta.json"):
    F = p.split("data_")[1][:5]
    for f in json.load(open(p)).get("feeds", []):
        if f.get("url"): urls[f["url"]].add(F)
W = int(sys.argv[2]) if len(sys.argv) > 2 else 2
out = {}
with Pool(W) as pool:
    for i, (u, r) in enumerate(pool.imap_unordered(one, sorted(urls)), 1):
        r["counties"] = sorted(urls[u]); out[u] = r
        if i % 50 == 0: print(time.strftime("%H:%M:%S"), i, "/", len(urls), flush=True)
json.dump(out, open(sys.argv[1], "w"), indent=1)
bad = sorted(((u, r) for u, r in out.items() if r.get("untimed")), key=lambda x: -x[1]["untimed"])
print(len(out), "feeds;", len(bad), "with untimed bus stop_times;", sum(1 for u, r in bad if r["untimed"] / max(r["stop_times"], 1) >= 0.1), "with 10% or more")
for u, r in bad[:40]:
    print(f"  {u.split('/')[-2] if 'mobilitydata' in u else u[:50]}: {r['untimed']:,} of {r['stop_times']:,} ({100 * r['untimed'] / max(r['stop_times'], 1):.0f}%), stops only untimed {r['stops_only_untimed']} of {r['stops']}, counties {r['counties'][:6]}")
