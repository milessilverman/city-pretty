"""Round 8.6: metrics_oc v10 (patches the file given as argv[1] in place). A county where no feed that is read has a listed bus stop
(one with 07:00-09:00 departures) inside the county, while OpenStreetMap maps 3 or more bus stops in it, has an operator missing from the
feeds: its bus frequency is unknown in every block group, not 0. Before, such a county showed 0 buses an hour wherever no stop was near,
because its search box held a neighbour's stops (Green Bay, Kenosha, Rockford, Spartanburg and Volusia showed 0 everywhere)."""
import sys, py_compile, os
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f"{s.count(a)} matches: {a[:70]!r}")
    s = s.replace(a, b)
rep('''    bt_unknown = 0
''', '''    bt_unknown = 0
    # v10 (round 8.6): no listed stop inside the county while OpenStreetMap maps 3+ bus stops in it: an operator is missing from the feeds,
    # so bus frequency is unknown in every block group, not 0 (a neighbour's stops in the search box made it 0 wherever none was near)
    county_unserved = None
    if mdb:
        from shapely.prepared import prep
        cty = prep(unary_union([geo.proj(g) for g in polys.values()]))
        if not any(cty.contains(g) for g in stop_idx.geoms):
            n_osm_cty = sum(1 for g in osm_bus_idx.geoms if cty.contains(g)) if osm_bus_idx is not None else 0
            county_unserved = {"listed_stops_in_county": 0, "osm_bus_stops_in_county": n_osm_cty, "unknown": n_osm_cty >= 3}
''')
rep('''            if region.STATE == "PR" and n_gtfs == 0:''', '''            if county_unserved and county_unserved["unknown"]:
                bt = None; bt_unknown += 1
            elif region.STATE == "PR" and n_gtfs == 0:''')
rep('''        coverage["transit"]["bt_unknown"] = bt_unknown; coverage["transit"]["osm_bus_stops"] = len(osm_bus); coverage["transit"]["gap_stops_used"] = len(gap_stops)''',
    '''        coverage["transit"]["bt_unknown"] = bt_unknown; coverage["transit"]["osm_bus_stops"] = len(osm_bus); coverage["transit"]["gap_stops_used"] = len(gap_stops)
        if county_unserved:
            coverage["transit"]["county_unserved"] = county_unserved   # v10''')
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("metrics_oc v10 written to", p)
