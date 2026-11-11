"""metrics_oc text, round 8.6 (language review): a shared police-authority crime rate says so once, and the source of a block group's name
says which kind of boundary it came from. Text only.   usage: metrics86_text.py <metrics_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:80]); s = s.replace(old, new)
rep('''"ag": f"{ag} (shared rate for {', '.join(cities)})", "yr": yr}''', '''"ag": ag.strip(), "shared": list(cities), "yr": yr}''')
rep('''"ag": (f"{cr['ag']} (city-level rate, CA DOJ Crimes & Clearances {cr['yr']})") if cr else None,''',
    '''"ag": ((f"{cr['ag']} (one rate shared by " + (", ".join(cr["shared"][:-1]) + " and " + cr["shared"][-1] if len(cr["shared"]) > 1 else cr["shared"][0]) + f"; CA DOJ Crimes & Clearances {cr['yr']})")
                    if cr.get("shared") else f"{cr['ag']} (city-level rate, CA DOJ Crimes & Clearances {cr['yr']})") if cr else None,''')
rep('''        ns = "nearest neighborhood label (OpenStreetMap)" if n != city else "City boundary (no neighborhood map)"''',
    '''        ns = ("nearest neighborhood label (OpenStreetMap)" if n != city else   # round 8.6: which boundary the name came from
              "the county's unincorporated area (no neighborhood map)" if city == region.UNINC and region.STATE != "PR" else
              "the place boundary (no neighborhood map)" if region.STATE == "PR" else
              "a census-designated place boundary (no neighborhood map)" if city.endswith("(unincorporated)") else "the city boundary (no neighborhood map)")''')
open(p, "w").write(s); print("metrics_oc text patched:", p)
