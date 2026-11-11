"""Round 8.6 (leaks review, finding 0, confirmed and simulated by its checker on CT 09110, PA 42001, NJ 34023, MA 25001, NY 36103, ME 23019):
in the states where all land lies in an incorporated city, borough, village, town or township (CT, MA, RI, NJ, NY, PA, NH, VT, ME), land outside
a Census place was labelled 'Unincorporated <County>' and every census-designated place '<Name> (unincorporated)' (Connecticut has no county
government and no unincorporated land, yet 314 Capitol Planning Region block groups read 'Unincorporated Capitol Planning Region'). Census keeps
towns and townships as county subdivisions, not places: fetch them (cousub.geojson), label land outside a place with its town or township,
show a CDP as '<community> (<town>)', and keep a neutral '<County> (outside any Census place)' for land in no governing town. Other states are
unchanged.   usage: towns86.py <pipeline dir>   (patches region.py, fetch_oc.py and sources_oc.py there)"""
import sys, os
D = sys.argv[1]


def patch(name, pairs):
    p = os.path.join(D, name); s = open(p).read()
    for old, new in pairs:
        c = s.count(old)
        assert c == 1, (name, c, old[:90])
        s = s.replace(old, new)
    open(p, "w").write(s); print("patched", p)


patch("region.py", [(
    '''UNINC = NAME if STATE == "PR" else f"Unincorporated {NAME}"   # Puerto Rico: the municipio is the local government (no unincorporated land)''',
    '''# States where every acre, bar a few unorganized townships, gores and reservations in northern New England and New York, lies in a city,
# borough, village, town or township with its own government. Census keeps towns and townships as county subdivisions, not places (round 8.6).
TOWN_STATES = {"CT", "MA", "RI", "NJ", "NY", "PA", "NH", "VT", "ME"}
UNINC = (NAME if STATE == "PR" else   # Puerto Rico: the municipio is the local government (no unincorporated land)
         f"{NAME} (outside any Census place)" if STATE in TOWN_STATES else f"Unincorporated {NAME}")''')])

patch("fetch_oc.py", [(
    '''            manifest("places.geojson", base, len(feats), "Census incorporated places + CDPs in the county box")
        fetch_arcgis_geojson("usa_parks.geojson",''',
    '''            manifest("places.geojson", base, len(feats), "Census incorporated places + CDPs in the county box")
        if region.STATE in region.TOWN_STATES and not have("cousub.geojson"):
            # round 8.6: the towns and townships (Census county subdivisions) of a state with no unincorporated county land
            layers = json.loads(get(base, {"f": "json"}))["layers"]
            lid = next(l["id"] for l in layers if l["name"] == "County Subdivisions")
            got = arcgis_query(f"{base}/{lid}", where=f"STATE='{region.STATE_FIPS}' AND COUNTY='{region.COUNTY_FIPS}'", fields="GEOID,NAME,BASENAME,LSADC,FUNCSTAT")
            save("cousub.geojson", json.dumps({"type": "FeatureCollection", "features": got}))
            manifest("cousub.geojson", base, len(got), "Census county subdivisions (towns, townships) of the county")
        fetch_arcgis_geojson("usa_parks.geojson",''')])

patch("sources_oc.py", [
    ('''def census_places():''',
     '''TOWNS, CDPS = set(), set()   # round 8.6: display names that are towns or townships, and census-designated places in a town state


def census_places():'''),
    ('''    census-designated places are unincorporated communities, shown as '<Name> (unincorporated)'; everything else is the county."""''',
     '''    census-designated places are unincorporated communities, shown as '<Name> (unincorporated)'; everything else is the county. In
    region.TOWN_STATES (round 8.6) the rest of the county is a town or township (cousub.geojson) and a CDP is shown as '<Name> (<Town>)'."""'''),
    ('''    bg_pts = [b.representative_point() for b in bgs]
''',
     '''    bg_pts = [b.representative_point() for b in bgs]
    # round 8.6: towns and townships (Census county subdivisions with a functioning government: FUNCSTAT A, or C where coextensive with
    # a city) for the states with no unincorporated county land; unorganized territories and reservations stay with the county
    towns = []
    for f in ((ld("cousub.geojson") or {}).get("features", []) if region.STATE in region.TOWN_STATES else []):
        p = f["properties"]; base = (p.get("BASENAME") or "").strip()
        if p.get("FUNCSTAT") in ("A", "C") and base and f.get("geometry"):
            g = shape(f["geometry"]).buffer(0)
            if county is not None:
                g = g.intersection(county)
                if g.geom_type == "GeometryCollection":
                    g = unary_union([q for q in g.geoms if q.geom_type in ("Polygon", "MultiPolygon")])
            if not g.is_empty:   # 'Town of Glastonbury', 'Cumberland Township', 'Hersey Plantation'
                towns.append((g, base, f"Town of {base}" if p.get("LSADC") == "43" else f'{base} {(p.get("NAME") or "")[len(base):].strip().title()}'.strip()))
'''),
    ('''        out.append((g, nm if inc else f"{nm} (unincorporated)", inc))       # places are the municipio's own town centre (zona urbana) and communities
    return out''',
     '''        if inc or region.STATE not in region.TOWN_STATES:                  # places are the municipio's own town centre (zona urbana) and communities
            out.append((g, nm if inc else f"{nm} (unincorporated)", inc))
            continue
        # round 8.6: in a town or township state a census-designated place is a village of its town or township, or the whole town
        rp = g.representative_point(); t = next((t for t in towns if t[0].contains(rp)), None)
        if t and t[1] == nm:
            continue                                       # the town itself (Connecticut's West Hartford, Manchester ...): the town's own shape follows
        label = f"{nm} ({t[2]})" if t else f"{nm} (Census-designated place)"
        out.append((g, label, True)); CDPS.add(label)
    taken = unary_union([g for g, _, _ in out]) if out and towns else None
    for g, base, label in towns:   # minus the places (lookups take any polygon that holds the point), so a city, borough, village or CDP keeps its own
        g = g.difference(taken) if taken is not None else g
        if g.geom_type == "GeometryCollection":
            g = unary_union([q for q in g.geoms if q.geom_type in ("Polygon", "MultiPolygon")])
        if not g.is_empty:
            out.append((g, label, True)); TOWNS.add(label)
    return out'''),
])
