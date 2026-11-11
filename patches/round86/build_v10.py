"""Round 8.6: build_oc.py text for metrics_oc v10 (text only): the transit status cell names the reason when a whole county is unknown."""
import sys, py_compile, os
p = sys.argv[1]; s = open(p).read()
a = '''(f"; bus frequency left unknown in {tr['bt_unknown']:,} block groups" + (" where no feed that is read has a stop within 400 m, or" if region.STATE == "PR" else "") + " where the feeds miss OpenStreetMap's bus stops" if tr.get("bt_unknown") else "")'''
if s.count(a) != 1: sys.exit(f"{s.count(a)} matches for the status text")
b = '''((f"; bus frequency left unknown in all {tr['bt_unknown']:,} block groups: OpenStreetMap maps {tr['county_unserved']['osm_bus_stops_in_county']:,} bus stops in the county, but no feed that is read has a stop with 7-9 am departures in it" if (tr.get("county_unserved") or {}).get("unknown") else
      f"; bus frequency left unknown in {tr['bt_unknown']:,} block groups" + (" where no feed that is read has a stop within 400 m, or" if region.STATE == "PR" else "") + " where the feeds miss OpenStreetMap's bus stops") if tr.get("bt_unknown") else "")'''
s = s.replace(a, b)
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("build_oc v10 text written to", p)
