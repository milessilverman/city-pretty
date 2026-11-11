"""Write a build queue for queue_worker.sh: counties not built yet, largest first (ACS 2020-2024 population, cache/acs_b01003.dat).
usage: python3 make_queue.py <out file> [--states PA,OH] [--top N] [--min-pop P]
Counties with no OpenStreetMap file (Alaska, Hawaii) are left out; counties whose state is not cut yet are kept (queue_worker.sh waits).
Then: ./queue_worker.sh <log name> <out file>   (start it twice to build two counties at a time; the workers share county locks)"""
import os, sys, json
H = os.path.dirname(os.path.abspath(__file__)); W5 = "/home/user/w5"
args = sys.argv[1:]; out = args[0]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
states = set(opt("--states", "").split(",")) - {""}; top = int(opt("--top", "0")); min_pop = int(opt("--min-pop", "0"))
C = json.load(open(f"{H}/data/counties.json"))
pop = {}
for l in open(f"{H}/cache/acs_b01003.dat"):
    if l.startswith("0500000US"):
        g, e, _ = l.strip().split("|"); pop[g[9:]] = int(e)


def built(f):
    return f in ("06037", "06059") or any(os.path.exists(p) for p in (f"{W5}/county_sites/sites_{f}.json", f"{W5}/sd_data/sites_{f}.json"))


q = sorted((f for f, c in C.items() if (not states or c["state"] in states) and c["osm"].get("url") and not built(f) and pop.get(f, 0) >= min_pop),
           key=lambda f: -pop.get(f, 0))
q = q[:top] if top else q
open(out, "w").write("".join(f + "\n" for f in q))
print(len(q), "counties ->", out, "| first:", ", ".join(f"{C[f]['name']} {C[f]['state']} ({pop.get(f, 0):,})" for f in q[:5]))
