"""National coverage summary for the report: counties built (bundle + site suggestions) by state, which states have an OpenStreetMap
file and injury-crash records, and how many counties can be built now.  usage: python3 national_status.py"""
import json, os, re, collections
H = os.path.dirname(os.path.abspath(__file__)); W5 = "/home/user/w5"
C = json.load(open(f"{H}/data/counties.json"))
src = open(f"{H}/pipeline/region.py").read()
CRASH_STATES = sorted(set(re.findall(r'^\s+"([A-Z]{2})": \{"crashes"', src, re.M)) | {"CA"})
CRASH_COUNTIES = {"08031": "Denver police", "06075": "DataSF"}


def built(f):
    if f in ("06037", "06059"):   # LA and Orange County ship inside every page (their own bundles)
        return True
    b = os.path.exists(f"{H}/pipeline/{'data' if f == '06059' else 'data_' + f}/bundle-oc.b64")
    s = any(os.path.exists(p) for p in (f"{W5}/county_sites/sites_{f}.json", f"{W5}/sd_data/sites_{f}.json"))
    return b and s


by_state = collections.defaultdict(lambda: [0, 0])
osm_ok = 0
for f, c in C.items():
    by_state[c["state"]][1] += 1
    if built(f):
        by_state[c["state"]][0] += 1
    if c["osm"].get("url") and not (c["osm"]["url"].rsplit("/", 2)[1] == "north-america" and not c["osm"].get("split")):
        osm_ok += 1
n_built = sum(v[0] for v in by_state.values())
print(f"counties built (bundle + site suggestions): {n_built} of {len(C)} in {sum(1 for v in by_state.values() if v[0])} states")
print(f"counties with an OpenStreetMap file the pipeline can read: {osm_ok} of {len(C)} (missing: Alaska, Hawaii"
      + ("" if osm_ok + sum(1 for c in C.values() if c['state'] in ('AK', 'HI')) == len(C) else ", and regions not yet cut by state") + ")")
print("states with injury-crash records:", ", ".join(CRASH_STATES), "plus", ", ".join(f"{C[f]['name']} ({s})" for f, s in CRASH_COUNTIES.items()))
print("built by state:", ", ".join(f"{st} {v[0]}" for st, v in sorted(by_state.items(), key=lambda t: -t[1][0]) if v[0]))
