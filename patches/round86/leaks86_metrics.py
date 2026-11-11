"""metrics_oc fixes from the round-8.6 leaks review (each confirmed by an independent checker against the patched code and the bundles).
Applied after metrics86_text.py and fix86_metrics.py (and with towns86.py's region.py/sources_oc.py in place).
  0. name source: the town or township boundary, a CDP inside a town, and '<County> (outside any Census place)' in region.TOWN_STATES
  1. 'County area' (csa) is LA County's Countywide Statistical Area; the pipeline filled it with '<city> - <name>' (often 'Chico - Chico'),
     shown under every block-group title: no such geography outside LA, so it is left empty
  2. a census-designated place with its own police district and DOJ row (Broadmoor, Kensington, Lake Shastina, Bear Valley Springs) keeps
     its own rate and is left out of the sheriff's area and population (it got the sheriff's rate and label)
  8. a block group takes an OpenStreetMap neighbourhood label only from its own city or place (East Palo Alto was named after Menlo Park's
     'The Willows', South San Francisco after San Bruno's 'Tanforan'); a label outside the county is not used
usage: leaks86_metrics.py <metrics_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


# ---- 8. neighbourhood labels from the block group's own city or place
rep('''    # places (neighborhood labels)
    place_pts = [(g.x, g.y, t.get("name")) for t, g, _ in places if t.get("name") and t.get("place") in ("neighbourhood", "suburb", "quarter")]
    place_idx = geo.PointIndex(place_pts)
''', '''    # places (neighborhood labels), filed under the city or place that holds each label (the rule used for a block group's own city
    # below), so a block group takes a label from its own city only (round 8.6): East Palo Alto is not named after Menlo Park's "The
    # Willows", nor South San Francisco after San Bruno's "Tanforan". A label outside the county (San Francisco's "Crocker-Amazon") is not used.
    bg_list = list(polys.values()); bg_tree = geo.GeomIndex(bg_list)
    place_by_city = collections.defaultdict(list)
    for t, g, _ in places:
        if not (t.get("name") and t.get("place") in ("neighbourhood", "suburb", "quarter")):
            continue
        lc = next((city_polys[int(i)][1] for i in city_tree.query(geo.proj(g)) if city_polys[int(i)][0].contains(g)), None)
        if lc is None and any(bg_list[int(i)].contains(g) for i in bg_tree.query(geo.proj(g))):
            lc = region.UNINC
        if lc is not None:
            place_by_city[lc].append((g.x, g.y, t.get("name")))
    place_idx = {k: geo.PointIndex(v) for k, v in place_by_city.items()}
''')
rep('''        d_place, pname = place_idx.nearest(lon, lat)''',
    '''        d_place, pname = place_idx[city].nearest(lon, lat) if city in place_idx else (None, None)   # a label in the block group's own city or place''')

# ---- 0. name source wording
rep('''        ns = ("nearest neighborhood label (OpenStreetMap)" if n != city else   # round 8.6: which boundary the name came from
              "the county's unincorporated area (no neighborhood map)" if city == region.UNINC and region.STATE != "PR" else
              "the place boundary (no neighborhood map)" if region.STATE == "PR" else
              "a census-designated place boundary (no neighborhood map)" if city.endswith("(unincorporated)") else "the city boundary (no neighborhood map)")''',
    '''        ns = ("nearest neighborhood label in this city or place (OpenStreetMap)" if n != city else   # round 8.6: which boundary the name came from
              "the place boundary (no neighborhood map)" if region.STATE == "PR" else
              "the town or township boundary (no neighborhood map)" if city in sources_oc.TOWNS else
              "a census-designated place boundary (no neighborhood map)" if city in sources_oc.CDPS or city.endswith("(unincorporated)") else
              "the county outside any Census place (no neighborhood map)" if city == region.UNINC and region.STATE in region.TOWN_STATES else
              "the county's unincorporated area (no neighborhood map)" if city == region.UNINC else
              "the city, borough or village boundary (no neighborhood map)" if region.STATE in region.TOWN_STATES else "the city boundary (no neighborhood map)")''')

# ---- 1. no 'County area' outside LA
rep('''"ns": ns, "csa": f"{city} - {n}",''', '''"ns": ns, "csa": None,   # round 8.6: 'County area' is LA County's Countywide Statistical Area; none elsewhere''')

# ---- 2. police districts of census-designated places
rep('''    crime = {}; sheriff_cities = []''', '''    crime = {}; sheriff_cities = []; own_cdps = set()''')
rep('''        sheriff_cities = [c for c in DOJ_SHERIFF_CONTRACT.get(region.NAME, []) if c not in own_rows]
''', '''        sheriff_cities = [c for c in DOJ_SHERIFF_CONTRACT.get(region.NAME, []) if c not in own_rows]
        # census-designated places with their own police district and DOJ row (Broadmoor, Kensington, Lake Shastina, Bear Valley Springs)
        # keep their own rate and are left out of the sheriff's area and population
        own_cdps = {f"{a} (unincorporated)" for a in own_rows if f"{a} (unincorporated)" in city_inc}
''')
rep('''or region.UNINC, city_inc, sheriff_cities))''', '''or region.UNINC, city_inc, sheriff_cities, own_cdps))''')
rep('''            p_ = uninc_pop if city == region.UNINC else pop.get(city)
''', '''            p_ = uninc_pop if city == region.UNINC else pop.get(city)
            key = f"{city} (unincorporated)" if f"{city} (unincorporated)" in own_cdps else city   # a police district's CDP, by its display name
''')
rep('''                crime[city] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000, "ag": ag, "yr": yr}
''', '''                crime[key] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000, "ag": ag, "yr": yr}
                if key != city:
                    crime[key]["district"] = True
''')
rep('''_sheriff_area(city, city_inc, sheriff_cities) else None)''', '''_sheriff_area(city, city_inc, sheriff_cities, own_cdps) else None)''')
rep('''def _sheriff_area(city, city_inc, sheriff_cities):''', '''def _sheriff_area(city, city_inc, sheriff_cities, own_cdps=()):''')
rep('''    return (not city_inc.get(city, False)) or city in sheriff_cities''',
    '''    return ((not city_inc.get(city, False)) and city not in own_cdps) or city in sheriff_cities   # a CDP with its own police district's row is not''')
rep('''    return f"{cr['ag']} (city-level rate, {src})"''', '''    if cr.get("district"):
        return f"{cr['ag']} (the community's own police district rate, not the sheriff's; {src})"
    return f"{cr['ag']} (city-level rate, {src})"''')
rep('''"La Canada-Flintridge": "La Cañada Flintridge"}''', '''"La Canada-Flintridge": "La Cañada Flintridge",
             "Bear Valley": "Bear Valley Springs"}   # Kern: Bear Valley police (Bear Valley Community Services District); the Census CDP is Bear Valley Springs''')
open(p, "w").write(s)
print("metrics_oc leaks fixes applied:", p)
