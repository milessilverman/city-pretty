"""engine.py display text, round 8.6, second part (numbers lens of the round-8.6 bundle review, each point checked against the code).
Applied after engine86_text.py. Reason strings only: no threshold, formula, cost, value or score changes.
  - 'below-median income' is below Los Angeles County's median ($93,240, LA_MED['inc']); say so, and say when income is not published
    (the engine then uses the above-median branch: below_med_inc is False for a missing value)
  - a home value at the ACS top code (2,000,001) is '$2M or more'; values under $1M are printed in dollars, not '$0.45M'
  - street-tree counts get thousands separators; the size-based estimate states its basis and, from 3,000 sites (the most the
    Los Angeles rows ever plant in one block group), that it means little for a block group that large
  - the undergrounding reason no longer names LADWP outside Los Angeles; comma before 'so'
  - a stormwater share under 0.5% no longer prints as '0% share'
  - the corner-store reason says 'supermarket', as the gap sentence does; the food-hall reason prints buses an hour like the others
usage: engine86_text2.py <engine.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''def run(m, pools, county="Orange County", state="CA"):''', '''def _inc_cut(inc):
    """display text only: the income test compares with Los Angeles County's median household income (LA_MED['inc'])"""
    cut = f"${LA_MED['inc']:,.0f}"
    if inc is None:
        return f"household income not published here (treated as at or above {cut}, Los Angeles County's median)"
    return (f"household income below {cut} (Los Angeles County's median, the cut-off used here)" if inc < LA_MED["inc"]
            else f"household income of {cut} or more (Los Angeles County's median, the cut-off used here)")


def _money(v):
    """display text only: '$2M or more' at the ACS top code (2,000,001), '$1.25M' from $1M, '$450,000' below"""
    return "$2M or more (the Census top code)" if v >= 2000000 else f"${v / 1e6:.2f}M" if v >= 1e6 else f"${round(v, -3):,.0f}"


def run(m, pools, county="Orange County", state="CA"):''')

# income wording (4 rows)
rep('''f"no community garden within 800 m; {'below' if below_med_inc else 'above'}-median income (effect is larger in poorer areas)",''',
    '''f"no community garden within 800 m; {_inc_cut(inc)} (the effect is larger in poorer areas)",''')
rep('''"below-median income area: new affordable housing raised nearby prices 6.5% within 0.1 mi"''',
    '''_inc_cut(inc) + ": new affordable housing raised nearby prices 6.5% within 0.1 mi"''')
rep('''"no clinic mapped within 2.5 km; below-median income"''', '''"no clinic mapped within 2.5 km; " + _inc_cut(inc)''')
rep('''f"busy bus corridor ({int(bt)}/hr) and below-median income"''', '''f"busy bus corridor ({_buses(bt)} an hour) and {_inc_cut(inc)}"''')
# home value
rep('''f"single-family area; typical home ${hv / 1e6:.2f}M"''', '''f"single-family area; typical home {_money(hv)}"''')
# street trees
rep('''        why = (f"{ts} open planting sites in the city's tree survey" if survey else
               f"~{ts} open sites estimated from block-group size (no city tree survey here)")
        add("street_trees", f"{ts} street trees",''', '''        why = (f"{ts:,} open planting sites in the city's tree survey" if survey else
               f"~{ts:,} open sites estimated from block-group size (about 68 plus 0.11 per acre, the fit used for Los Angeles County; no city tree survey here"
               + (f"; this block group covers {int(m.get('acres') or 0):,} acres, far more than the fit was made on, so the estimate means little here" if ts >= 3000 else "") + ")")
        add("street_trees", f"{ts:,} street trees",''')
# undergrounding
rep('''f"homes built ~{int(yb)} so overhead lines are likely (no utility line map outside LADWP's area" + ("" if county == "la" else "; none is loaded for this county") + "); $3.4M per circuit-mile in 2024 dollars"''',
    '''f"homes built ~{int(yb)}, so overhead lines are likely " + ("(no utility line map outside LADWP's area)" if county == "la" else "(no utility line map is loaded for this county)") + "; $3.4M per circuit-mile in 2024 dollars"''')
# stormwater share under 0.5%
rep('''(f"this area's {share:.0f}% share of a ~$16.5M park stormwater project" if share < 99.5 else''',
    '''("this area's share (under 1%) of a ~$16.5M park stormwater project" if share < 0.5 else f"this area's {share:.0f}% share of a ~$16.5M park stormwater project" if share < 99.5 else''')
# supermarket
rep('''f"{_dining(din)} within 400 m and the nearest grocery {gro / 1609:.1f} mi away"''', '''f"{_dining(din)} within 400 m and the nearest supermarket {gro / 1609:.1f} mi away"''')
open(p, "w").write(s)
print("engine display text (part 2) patched:", p)
