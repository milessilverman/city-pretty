"""w5/tools/patch6.py changes from the round-8.6 leaks review (findings 1, 5, 6, 7; each confirmed by an independent checker):
  7. county bundles list their own facility distances (m.fc, the values the gap list quotes) instead of 'Not yet mapped ... (the LA County
     facilities layer stops at the county line)'; '<0.1 mi', not '0.0 mi'; source line from the county's own loaded sources
  6. outside California the plan step's NEVI label no longer names the California Energy Commission ('NEVI / CEC charger programs')
  1. 'County area' (LA County's Countywide Statistical Area) is not shown for pipeline-built block groups (bundles built before the
     metrics fix carry '<city> - <name>' there)
  5. the similarity note lists children only where the peer match uses them (LA mode); county bundles' match has no children variable
usage: page86_leaks.py <patch6.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new):
    global s
    c = s.count(old)
    assert c == 1, (c, old[:90])
    s = s.replace(old, new)


rep("""rep('''<h3>Public facilities nearby</h3><p class="small muted">Not yet mapped for Orange County (the LA County facilities layer stops at the county line).</p>''',
    '''<h3>Public facilities nearby</h3><p class="small muted">Not yet mapped for ${esc(countyOf(m))} (the LA County facilities layer stops at the county line).</p>''',
    "facilities note names the county")""",
"""rep('''  if (isOCArea(m)) return `<div class="section"><h3>Public facilities nearby</h3><p class="small muted">Not yet mapped for Orange County (the LA County facilities layer stops at the county line).</p></div>`;''',
    '''  if (isOCArea(m) && !m.fc) return `<div class="section"><h3>Public facilities nearby</h3><p class="small muted">No facility distances for this block group in ${esc(countyOf(m))}.</p></div>`;''',
    "facilities: county bundles list their own distances (m.fc, the values the gap list quotes); no LA County layer note outside LA")
rep('''<span>${(m.fc[k] / 1609).toFixed(1)} mi</span>''',
    '''<span>${m.fc[k] < 80.45 ? "&lt;0.1" : (m.fc[k] / 1609).toFixed(1)} mi</span>''',
    "facility distances: '<0.1 mi', not '0.0 mi'")
rep('''<p class="small muted">Distance from the middle of this block group to the nearest one. LA County Location Management System, filled in with OpenStreetMap.</p>''',
    '''<p class="small muted">Distance from the middle of this block group to the nearest one. ${isOCArea(m) ? (s => `OpenStreetMap${s ? "; schools from the " + esc(s[0]) : ""}.`)((((COUNTY_BUNDLES[m.__fips] || D_OC || {}).meta || {}).sources || []).find(r => r && r[3] && /^(CDE School Directory|NCES EDGE)/.test(r[0]))) : "LA County Location Management System, filled in with OpenStreetMap."}</p>''',
    "facilities source line outside LA County: OpenStreetMap, schools from the county's loaded school source")""")

rep('''rep("""  if (!st.funding || !D.funding[st.funding]) return "";""",
    """  if (!st.funding || !D.funding[st.funding]) return "";
  if (!isCAActive() && (CA_ONLY_FUNDING.has(st.funding) || LA_ONLY_FUNDING.has(st.funding))) return "";""",
    "plan steps: no California programmes outside California")''',
'''rep("""  if (!st.funding || !D.funding[st.funding]) return "";""",
    """  if (!st.funding || !D.funding[st.funding]) return "";
  if (!isCAActive() && (CA_ONLY_FUNDING.has(st.funding) || LA_ONLY_FUNDING.has(st.funding))) return "";
  if (!isCAActive() && st.funding === "NEVI") return `; could be paid for by NEVI (${esc(D.funding.NEVI[1])})`;   // LA's label 'NEVI / CEC charger programs' names California Energy Commission programmes""",
    "plan steps: no California programmes outside California; NEVI without the California Energy Commission")''')

anchor = '''open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w")'''
assert s.count(anchor) == 1
section = r"""
# ---- 23. round 8.6, leaks review: 'County area' is LA County's Countywide Statistical Area; pipeline-built block groups (they carry m.county)
#          had '<city> - <name>' there, often doubled ('Chico - Chico'); the similarity note lists children only in LA mode (the county
#          bundles' peer match has no children variable)
rep('''<p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n ? " · County area: " + esc(m.csa) : ""}</p>''',
    '''<p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n && !m.county ? " · County area: " + esc(m.csa) : ""}</p>''',
    "'County area' only for LA County's own block groups")
rep('''most like this one in income, density, home values, housing age, children, car ownership and single-family share.</p>`;''',
    '''most like this one in income, density, home values, housing age, ${typeof activeCounty !== "undefined" && activeCounty === "oc" ? "" : "children, "}car ownership and single-family share.</p>`;''',
    "similarity note: children only in LA mode")
"""
s = s.replace(anchor, section + "\n" + anchor)
open(p, "w").write(s)
print("patch6: leaks fixes 1, 5, 6, 7 added")
