"""fetch_oc data fix, round 8.6 (numbers lens): acs_place.json, the California place populations behind the DOJ crime rates, was keyed
by the name without ' city/town/CDP, California', and the row read last won where a city or town and a census-designated place share a
name (Burbank, El Cerrito, Fairfax, Greenfield, Live Oak, Mountain View, Paradise, Rolling Hills): Paradise town (Butte) got the 241
residents of Paradise CDP (Mono), El Cerrito (Contra Costa) the 5,325 of El Cerrito CDP (Riverside). The incorporated place now wins
(the DOJ rows are city and town police departments). A file written before this rule (no "_rule" key) is rewritten on the next run,
from acs_b01003.dat and acs_geos.txt only; acs_bg.json is not touched.   usage: fix86_fetch.py <fetch_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''def fetch_acs():
    if have("acs_bg.json") and have("acs_place.json"):
        return
''', '''def place_pop(rows_place=None):
    """acs_place.json: California place name (without ' city/town/CDP, California') -> ACS 2020-2024 population, for the CA DOJ crime
    rates. Round 8.6: where a city or town and a census-designated place share a name, the incorporated place wins (it used to be the
    row read last). rows_place: the place rows already read by fetch_acs; otherwise only table B01003 is read."""
    def num(v):
        try:
            x = float(v)
        except Exception:
            return None
        return None if x <= -222222222 else x
    if rows_place is None:
        rows_place = {}
        if not have("acs_b01003.dat"):
            save("acs_b01003.dat", get(f"{ACS_BASE}/data/5YRData/acsdt5y2024-b01003.dat", timeout=1800))
        with open(os.path.join(DATA, "acs_b01003.dat"), encoding="utf-8") as fh:
            hdr = fh.readline().rstrip("\\n").split("|")
            for line in fh:
                if line.startswith("1600000US" + region.STATE_FIPS):
                    d = dict(zip(hdr, line.rstrip("\\n").split("|"))); rows_place.setdefault(d["GEO_ID"], {}).update(d)
    if not have("acs_geos.txt"):
        save("acs_geos.txt", get(f"{ACS_BASE}/documentation/Geos20245YR.txt", timeout=1800))
    names = {}
    with open(os.path.join(DATA, "acs_geos.txt"), encoding="utf-8", errors="replace") as fh:
        hdr = fh.readline().rstrip("\\n").split("|")
        for line in fh:
            if "|160|" in line[:20] and "|06|" in line:
                d = dict(zip(hdr, line.rstrip("\\n").split("|")))
                if d.get("SUMLEVEL") == "160" and d.get("STATE") == "06":
                    names[d["GEO_ID"]] = d["NAME"]
    place, inc = {}, {}
    for g, d in rows_place.items():
        n = names.get(g)
        if n and num(d.get("B01003_E001")) is not None:
            k = n.replace(" city, California", "").replace(" CDP, California", "").replace(" town, California", "")
            i = not n.endswith(" CDP, California")
            if k in place and inc[k] and not i:
                continue   # a CDP never replaces the city or town of the same name
            place[k] = num(d["B01003_E001"]); inc[k] = i
    place["_rule"] = "incorporated place first where a city or town and a CDP share a name (round 8.6)"
    save("acs_place.json", json.dumps(place))


def fetch_acs():
    if have("acs_bg.json") and have("acs_place.json"):
        if region.STATE == "CA" and "_rule" not in json.load(open(os.path.join(DATA, "acs_place.json"))):
            place_pop()   # round 8.6: rewrite a file written before the incorporated-first rule (this file only)
        return
''')
rep('''    # place names + population (for crime rates per 100k)
    if not have("acs_geos.txt"):
        save("acs_geos.txt", get(f"{ACS_BASE}/documentation/Geos20245YR.txt", timeout=1800))
    names = {}
    with open(os.path.join(DATA, "acs_geos.txt"), encoding="utf-8", errors="replace") as fh:
        hdr = fh.readline().rstrip("\\n").split("|")
        for line in fh:
            if "|160|" in line[:20] and "|06|" in line:
                d = dict(zip(hdr, line.rstrip("\\n").split("|")))
                if d.get("SUMLEVEL") == "160" and d.get("STATE") == "06":
                    names[d["GEO_ID"]] = d["NAME"]
    place = {}
    for g, d in rows_place.items():
        n = names.get(g)
        if n and num(d.get("B01003_E001")) is not None:
            place[n.replace(" city, California", "").replace(" CDP, California", "").replace(" town, California", "")] = num(d["B01003_E001"])
    save("acs_place.json", json.dumps(place))
''', '''    # place names + population (for the crime rates per 1,000 residents)
    place_pop(rows_place)
''')
open(p, "w").write(s)
print("fetch_oc place-population fix applied:", p)
