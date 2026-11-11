"""build_oc display text, round 8.6, second part (numbers lens of the round-8.6 bundle review, each point checked against the code).
Applied after build86_language.py and fix86_build.py. Text only:
  - heat: each value is relative to its own county's urban-area mean (sources_oc.tes_by_bg), so the sentence gives both, not their
    difference as if it were a temperature gap
  - crashes: the count spans every loaded crash year (metrics.json crash.years), so the sentence names the period; 'involving a
    pedestrian or cyclist' as the sources row defines it; the peer median keeps its .5
  - EV: where the federal fast-charger list has no station here, the distance is to any OpenStreetMap charging station; say so
  - distances under 0.05 mi print as '<0.1 mi', not '0.0 mi'
  - the rail-station row says 'None' (flag false) when no station was confirmed, dropped or added, as the bus-feed row does
usage: build86_text2.py <build_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''        return f"{v / 1609:.1f} mi"''', '''        return "<0.1 mi" if v < 80.45 else f"{v / 1609:.1f} mi"   # round 8.6: not '0.0 mi\'''')
rep('''def _canopy_why(x, p):''', '''CRASH_SPAN = ""   # round 8.6: set in main() from metrics.json crash.years
EV_WHAT = "The nearest EV fast charger"   # round 8.6: set in main() from afdc_dcfc.json


def _deg(v):
    """a heat value against its own urban-area average: '+2.9°F', '-0.6°F', '0.0°F'"""
    v = 0.0 if abs(v) < 0.05 else v
    return "0.0°F" if v == 0 else f"{v:+.1f}°F"


def _canopy_why(x, p):''')
rep('''WHY = {"heat": lambda x, p: f"Summers run {x - p:.1f}°F hotter than in similar neighborhoods.",''',
    '''WHY = {"heat": lambda x, p: f"Summer heat here is {_deg(x)} against this county's urban-area average; similar neighborhoods are about {_deg(p)} against theirs.",''')
rep('''"pedbike": lambda x, p: f"{int(x)} {'crash' if int(x) == 1 else 'crashes'} injured people walking or biking here (similar neighborhoods: {int(p)}).",''',
    '''"pedbike": lambda x, p: f"{int(x)} {'crash' if int(x) == 1 else 'crashes'} involving a pedestrian or cyclist here{CRASH_SPAN} (similar neighborhoods: {p:g}).",''')
rep('''"ev": lambda x, p: _near("The nearest EV fast charger", x, p),''', '''"ev": lambda x, p: _near(EV_WHAT, x, p),''')
rep('''    M = json.load(open(os.path.join(DATA, "metrics.json"))); metrics = M["metrics"]
''', '''    M = json.load(open(os.path.join(DATA, "metrics.json"))); metrics = M["metrics"]
    global CRASH_SPAN, EV_WHAT   # round 8.6: the crash period for the crash gap sentence; which charger list the EV distance comes from
    _ys = (M.get("crash") or {}).get("years") or []
    CRASH_SPAN = f" in {min(_ys)}–{max(_ys)}" if _ys else ""
    _af = os.path.join(DATA, "afdc_dcfc.json")
    if not (os.path.exists(_af) and any(st.get("ev_dc_fast_num") for st in (json.load(open(_af)).get("fuel_stations") or []))):
        EV_WHAT = "The nearest public charging station mapped in OpenStreetMap (no fast-charger list here)"
''')
rep('''f"Loaded ({_count(len(RC['gtfs']), 'station')} confirmed by a stop, {len(RC['mode']) + len(RC['agency']):,} by type or operator, {len(RC['dropped']):,} left out, {len(RC['added']):,} added)", True] if RC else None)''',
    '''*((f"Loaded ({_count(len(RC['gtfs']), 'station')} confirmed by a stop, {len(RC['mode']) + len(RC['agency']):,} by type or operator, {len(RC['dropped']):,} left out, {len(RC['added']):,} added)", True)
                        if (RC['gtfs'] or RC['mode'] or RC['agency'] or RC['dropped'] or RC['added']) else (f"None: no rail station found in or near {NM} (OpenStreetMap and the feeds read)", False))] if RC else None)''')
open(p, "w").write(s)
print("build_oc display text (part 2) patched:", p)
