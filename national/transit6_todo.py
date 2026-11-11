"""Built counties whose transit files are older than selection 6 and that no batch worker is building now (one FIPS per line)."""
import json, glob, os
N = "/home/user/national"
for d in sorted(glob.glob(f"{N}/pipeline/data_*")):
    f = d.rsplit("_", 1)[-1]
    p = f"{d}/transit_stops_7_9.meta.json"
    if not os.path.exists(f"{d}/metrics.json") or not os.path.exists(p):
        continue
    try:
        if json.load(open(p)).get("selection") == 6:
            continue
    except ValueError:
        continue
    lg = f"{N}/logs/build_{f}.log"
    if os.path.isdir(f"{N}/logs/build_locks/{f}") and not (os.path.exists(lg) and f"DONE {f}" in open(lg, errors="replace").read()):
        continue   # a batch worker is building it
    if not (os.path.exists(f"/home/user/w5/county_sites/sites_{f}.json") or os.path.exists(f"/home/user/w5/sd_data/sites_{f}.json")):
        continue   # site suggestions not built yet
    print(f)
