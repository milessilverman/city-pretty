"""metrics_oc data fixes, round 8.6 (numbers lens of the round-8.6 bundle review, each point checked against the code and the data).
Applied after metrics86_text.py. These change numbers, on purpose:
  1. canopy: both Tree Equity Score readers already return points (sources_oc.tes_by_bg and tes_latest multiply tc_gap by 100); the
     old 'if tg <= 1: tg *= 100' scaled gaps of 0.1-1.0 point a second time, to 10-100 points (2,116 block groups in 423 counties
     showed gaps above 48.5 points, which no TES 2021 block group has).
  2. sheriff: the sheriff's DOJ row covers every unincorporated area, census-designated places included (contract cities that report
     their own rows are not in it), but its crimes were divided only by residents of block groups outside every city and every CDP
     (Sacramento: 2,825 violent crimes over 44,841 residents). Now: residents of the block groups whose place is not incorporated, plus
     the contract cities in DOJ_SHERIFF_CONTRACT that have no row of their own; those block groups get the sheriff's rate.
No engine formula changes.   usage: fix86_metrics.py <metrics_oc.py> <contract_cities.json>"""
import sys, json
p = sys.argv[1]; s = open(p).read()
contract = json.load(open(sys.argv[2]))   # {"County Name": {"cities": [...], "evidence": {city: "url | quote"}}}


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


# ---- 1. canopy gap: no second scaling
rep('''        ht = num("temp_diff", "heat_disparity", "ht", "temp_diff_f"); tg = num("tc_gap", "canopy_gap", "tg", "tree_canopy_gap")
        if tg is not None and tg <= 1:
            tg *= 100
''', '''        ht = num("temp_diff", "heat_disparity", "ht", "temp_diff_f"); tg = num("tc_gap", "canopy_gap", "tg", "tree_canopy_gap")
        # round 8.6: tg is already in points (both TES readers multiply tc_gap by 100); the old 'if tg <= 1: tg *= 100' scaled gaps of
        # 0.1-1.0 point a second time, to 10-100 points
''')

# ---- 2. sheriff's rate: everywhere the sheriff polices
rep('''    city_polys = [(g, nm) for g, nm, inc in sources_oc.city_polys()]
''', '''    _cpi = sources_oc.city_polys()
    city_polys = [(g, nm) for g, nm, inc in _cpi]
    city_inc = {nm: inc for g, nm, inc in _cpi}   # round 8.6: incorporated or not (the sheriff's crime rate covers the places that are not)
''')
rep('''    crime = {}
    dojp = ''', '''    crime = {}; sheriff_cities = []
    dojp = ''')
rep('''        # unincorporated population = ACS block-group population of the block groups whose centroid is outside every city
        uninc_pop = sum((acs.get(g) or {}).get("pop") or 0 for g, c in cent.items() if not any(city_polys[int(i)][0].contains(c) and city_polys[int(i)][1] != region.UNINC for i in city_tree.query(geo.proj(c))))
''', '''        # round 8.6: the sheriff's row covers everywhere the sheriff polices: the unincorporated county, census-designated places included
        # (they used to be left out of the population), and the contract cities in DOJ_SHERIFF_CONTRACT that have no row of their own
        # this year. Its population is the ACS population of the block groups whose place (the polygon holding the centroid, as below) is
        # one of those; the same block groups get the sheriff's rate.
        own_rows = {DOJ_ALIAS.get(r["NCICCode"].strip(), r["NCICCode"].strip()) for r in rows if r["Year"] == str(yr)}
        sheriff_cities = [c for c in DOJ_SHERIFF_CONTRACT.get(region.NAME, []) if c not in own_rows]
        uninc_pop = sum((acs.get(g) or {}).get("pop") or 0 for g, c in cent.items()
                        if _sheriff_area(next((city_polys[int(i)][1] for i in city_tree.query(geo.proj(c)) if city_polys[int(i)][0].contains(c)), None) or region.UNINC, city_inc, sheriff_cities))
''')
rep('''            if p_:
                crime[city] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000, "ag": ag, "yr": yr}
''', '''            if p_:
                crime[city] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000, "ag": ag, "yr": yr}
                if city == region.UNINC:
                    crime[city]["sheriff"] = list(sheriff_cities)
''')
rep('''        print("DOJ crime", yr, "agencies matched", len(crime), "unincorporated pop", round(uninc_pop))
''', '''        print("DOJ crime", yr, "agencies matched", len(crime), "population the sheriff polices", round(uninc_pop), "contract cities without a row:", sheriff_cities or "none")
''')
rep('''        cr = crime.get(city)
''', '''        cr = crime.get(city) or (crime.get(region.UNINC) if _sheriff_area(city, city_inc, sheriff_cities) else None)   # round 8.6: CDPs and contract cities
''')
rep('''"ag": ((f"{cr['ag']} (one rate shared by " + (", ".join(cr["shared"][:-1]) + " and " + cr["shared"][-1] if len(cr["shared"]) > 1 else cr["shared"][0]) + f"; CA DOJ Crimes & Clearances {cr['yr']})")
                    if cr.get("shared") else f"{cr['ag']} (city-level rate, CA DOJ Crimes & Clearances {cr['yr']})") if cr else None,''',
    '''"ag": _ag_text(cr) if cr else None,''')

# ---- the contract-city list and the two helpers, next to DOJ_SHARED
lines = []
for county, v in sorted(contract.items()):
    for c in v["cities"]:
        lines.append(f"#   {c} ({county}): {v['evidence'][c]}")
rep('''DOJ_SHARED = {"Central Marin": ["Larkspur", "Corte Madera", "San Anselmo"]}
''', '''DOJ_SHARED = {"Central Marin": ["Larkspur", "Corte Madera", "San Anselmo"]}
# Round 8.6: cities policed by the county sheriff under contract that have no row of their own in the DOJ file, so their crimes are in the
# sheriff's row (checked in the file: where a city's row ended, the sheriff's counts rose by about the city's earlier counts). A contract
# city that does report its own row (e.g. Orange County's Mission Viejo, Sacramento's Rancho Cordova) keeps its own rate; a listed city is
# skipped in a year where it has a row. Evidence (URL | quote):
''' + "\n".join(lines) + '''
DOJ_SHERIFF_CONTRACT = ''' + json.dumps({k: v["cities"] for k, v in sorted(contract.items())}, ensure_ascii=False) + '''


def _sheriff_area(city, city_inc, sheriff_cities):
    """round 8.6: a block group's place is policed by the sheriff when it is not incorporated (the county's unincorporated area or a
    census-designated place) or is a contract city without its own DOJ row"""
    return (not city_inc.get(city, False)) or city in sheriff_cities


def _ag_text(cr):
    """the crime tile's source line: the agency, the area its rate covers, and the DOJ year"""
    src = f"CA DOJ Crimes & Clearances {cr['yr']}"
    if cr.get("shared"):
        sh = cr["shared"]
        return f"{cr['ag']} (one rate shared by " + (", ".join(sh[:-1]) + " and " + sh[-1] if len(sh) > 1 else sh[0]) + f"; {src})"
    if "sheriff" in cr:   # round 8.6
        cs = cr["sheriff"]
        area = f"unincorporated {region.NAME}" + ((", " + ", ".join(cs[:-1]) + " and " + cs[-1]) if len(cs) > 1 else (" and " + cs[0]) if cs else "")
        return f"{cr['ag']} (one rate for everywhere the sheriff polices: {area}; {src})"
    return f"{cr['ag']} (city-level rate, {src})"
''')
open(p, "w").write(s)
print("metrics_oc data fixes applied:", p, "| contract cities:", sum(len(v["cities"]) for v in contract.values()))
