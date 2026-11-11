"""engine.py display text, round 8.6 (from the language review of the round-8.6 bundles, each point checked against the code): the
rationale strings beside each project only. No threshold, formula, cost, value or score changes; every edit replaces a string literal or
an f-string with one that prints different words for the same numbers.   usage: engine86_text.py <engine.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''def run(m, pools, county="Orange County", state="CA"):''', '''def _buses(bt):
    """display text only: buses an hour (7-9 am departures / 2, so halves occur): '12 buses', '10.5 buses', '1 bus', 'under 1 bus'"""
    b = round(float(bt or 0) * 2) / 2
    return "under 1 bus" if b < 1 else (f"{b:g} bus" if b == 1 else f"{b:g} buses")


def _warmer(ht):
    """display text only: '+2.9°F hotter than average', or 'average summer heat' where it rounds to 0.0"""
    return f"+{ht:.1f}°F hotter than average" if round(ht, 1) > 0 else "average summer heat"


def _away(d):
    """display text only: '350 m away', or '4.6 mi away' from 1,000 m up"""
    return "in this block group" if d < 1 else f"{int(d)} m away" if d < 1000 else f"{d / 1609:.1f} mi away"


def _dining(n):
    """display text only: the dining count is restaurants plus cafés within 400 m"""
    return "1 restaurant or café" if int(n) == 1 else f"{int(n)} restaurants and cafés"


def run(m, pools, county="Orange County", state="CA"):''')

# buses an hour: halves kept, no '0 buses an hour' (microtransit is the one project that can see 0 or 0.5)
rep('''f"{int(nocar)}% without a car and only {int(bt)} {'bus' if int(bt) == 1 else 'buses'} an hour nearby"''',
    '''f"{int(nocar)}% without a car and " + ("no bus stop with 7-9 am departures within 400 m" if not bt else f"only {_buses(bt)} an hour at the busiest stop nearby")''')
rep('''{int(bt)} {'bus' if int(bt) == 1 else 'buses'} an hour''', '''{_buses(bt)} an hour''', 6)
# heat: no '+-0.0°F'
rep('''an hour and +{ht:.1f}°F hotter than average"''', '''an hour and {_warmer(ht)}"''')
rep('''f"+{ht:.1f}°F hotter; cooling center during outages"''', '''f"{_warmer(ht)}; cooling center during outages"''')
# shares over 100% and under 1%
rep('''f"this area's {share:.0f}% share of a ~$16.5M park stormwater project"''',
    '''(f"this area's {share:.0f}% share of a ~$16.5M park stormwater project" if share < 99.5 else f"a park stormwater basin scaled to this area (~${165000 * share / 1e6:.1f}M; the reference project cost ~$16.5M)")''')
rep('''f"modernize the nearby school (this area's {share:.0f}% share of ~$40M)"''',
    '''(f"modernize the nearby school (this area's {share:.0f}% share of ~$40M)" if share >= 0.5 else "modernize the nearby school (this area's share of ~$40M is under 1%)")''')
# '0 m away', bare metre counts over 1,000, modelling shorthand
rep('''f"park {int(pn)} m away; renovations capitalize within ~400 m (uses +0.5%)"''',
    '''(f"park {int(pn)} m away" if pn >= 1 else "a park lies in this block group") + "; renovations raise home values within ~400 m (+0.5% assumed)"''')
rep('''f"high-voltage line corridor {int(x['power_m'])} m away (rail and creek corridors need right-of-way data not loaded yet)"''',
    '''(f"high-voltage line corridor {_away(x['power_m'])}" if x['power_m'] >= 1 else "a high-voltage line corridor crosses this block group") + " (rail and creek corridors need right-of-way data not loaded yet)"''')
rep('''f"no pickleball within 2 km; tennis courts {int(ten)} m away"''', '''f"no pickleball within 2 km; tennis courts {_away(ten)}"''')
rep('''f"nearest public tennis court {int(ten)} m away"''', '''f"nearest public tennis court {_away(ten)}"''')
rep('''f"nearest public basketball court {int(x['bask_m'])} m away"''', '''f"nearest public basketball court {_away(x['bask_m'])}"''')
rep('''"; uses 1% (the study's +3.3% is likely partly where chargers get built)"''', '''"; 1% assumed (the study's +3.3% is likely partly where chargers get built)"''')
rep('''"no market mapped within 2 km; uses +0.25% within 500 m (studies find an inverted-U: too close can hurt)"''',
    '''"no market mapped within 2 km; +0.25% assumed within 500 m (studies find an inverted-U: too close can hurt)"''')
rep('''f"{local_km:.0f} km of local streets;''', '''f"{local_km:.1f} km of local streets;''')
# LA-specific or internal wording outside LA
rep('''"assumes 10% of walks need repair, the LA build's rule (LA's sidewalks are ~40% damaged citywide); no " + county + " sidewalk survey loaded"''',
    '''"assumes 10% of sidewalks need repair (the rule used for Los Angeles, where about 40% are damaged citywide); no sidewalk survey is available for " + county''')
rep('''("" if county == "la" else "; SCE lines not mapped" if state == "CA" else "; local utility lines not mapped")''',
    '''("" if county == "la" else "; none is loaded for this county")''')
rep('''OSM maps only a few dozen LA walls, so check ''', '''OpenStreetMap misses many walls (it maps only a few dozen in Los Angeles), so check ''')
rep('''f"~{L} m of freeway within 150 m''', '''f"~{L:,} m of freeway within 150 m''')
rep('''add("noise_wall", f"{L} m of sound wall",''', '''add("noise_wall", f"{L:,} m of sound wall",''')
rep('''Cost is LAUSD's bundled package, so it overstates greening alone''', '''Cost is the Los Angeles Unified School District's bundled package, so it overstates greening alone''')
# crime ratio is to LA County's median city rate (LA_MED), not the county's own
rep('''x the county median; lighting''', '''x LA County's median; lighting''')
rep('''x county median;''', '''x LA County's median;''', 2)
rep('''f"violent crime {vc / LA_MED['vc']:.1f}x county median"''', '''f"violent crime {vc / LA_MED['vc']:.1f}x LA County's median"''')
# dining: restaurants and cafés (the count is both), within 400 m
rep('''f"{int(din)} restaurants/cafes within 400 m''', '''f"{_dining(din)} within 400 m''', 3)
rep('''f"{int(din)} {'café' if int(din) == 1 else 'cafés'} within 400 m and the nearest grocery''', '''f"{_dining(din)} within 400 m and the nearest grocery''')
# street trees: the estimate is from block-group size (0.1128 x acres + 68, halved where the canopy gap is under 10)
rep('''f"~{ts} open sites estimated from the canopy gap (no city tree survey here)"''', '''f"~{ts} open sites estimated from block-group size (no city tree survey here)"''')
rep('''f"; each tree lifts ~{hpt} homes within 50 m by 0.24% (local sales estimate, low end)"''', '''f"; each tree raises the value of ~{hpt} homes within 50 m by 0.24% (local sales estimate, low end)"''')
open(p, "w").write(s)
print("engine display text patched:", p)
