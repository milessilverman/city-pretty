"""print sources_table rows of one county with the build_oc in this folder (reads only)   usage: CP_FIPS=.. CP_DATA=.. python3 sources_harness.py <pipeline dir>"""
import sys, os, json
sys.path.insert(0, sys.argv[1]); sys.argv = ["x", "/home/user/page/dec"]
import build_oc
M = json.load(open(os.path.join(build_oc.DATA, "metrics.json")))
for r in build_oc.sources_table(M):
    print(("OK " if r[3] else "-- ") + r[0][:60], "|", r[2][:260])
    if r[0].startswith(("GTFS feeds", "ACS", "OpenStreetMap", "Census TIGERweb places", "NCES", "Tree Equity", "Esri")): print("      used for:", r[1][-330:])
