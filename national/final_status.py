"""Which built counties are final (transit selection 3 with the OSM coverage check, county-internal heat baseline, site suggestions)?"""
import json, os, glob, sys
regions = json.load(open("/home/user/w5/regions.json"))
def final(f):
    p = f"/home/user/national/pipeline/data_{f}/metrics.json"
    if not os.path.exists(p): return "not built"
    cv = json.load(open(p)).get("coverage", {}); t = cv.get("transit") or {}
    if not ((t.get("selection") or 0) >= 3 and ("osm_bus_stops" in t or t.get("stops") == 0)): return "transit pending"
    if not (cv.get("tree_equity") or {}).get("heat_baseline", "").startswith("urbanized-area mean over this county"): return "heat marker pending"
    if not any(os.path.exists(x) for x in (f"/home/user/w5/county_sites/sites_{f}.json", f"/home/user/w5/sd_data/sites_{f}.json")): return "no sites"
    return "final"
for name, fl in regions.items():
    st = {f: final(f) for f in fl}
    print(f"{name:18} {sum(v == 'final' for v in st.values())}/{len(fl)} final", {f: v for f, v in st.items() if v != "final"})
