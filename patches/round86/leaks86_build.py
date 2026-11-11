"""build_oc fixes from the round-8.6 leaks review (each confirmed by an independent checker). Applied after build86_language.py,
fix86_build.py and build86_text2.py, with towns86.py's region.py in place.
  0. places sources row in region.TOWN_STATES: towns and townships (county subdivisions) and '<community> (<town>)'
  4. plan steps: the page's footnote (shared with the LA build) says each step describes the most affected part of the neighborhood and the
     steps after the quick win are ordered by return; the code picked the part where the fix is cheapest (else the first part read) and
     ordered by how many parts share the gap. Now: the most affected part that has a costed project (a costed row first, then the highest
     worse-than share, then the widest gap, then the lower cost), and order by return, then by share (the LA build's rules)
  9. state crash sources: the status cited one REST layer URL from the configuration (Utah: a layer that was not read; Illinois,
     Pennsylvania, Tennessee: one of several); it now lists the layers read, with their years
usage: leaks86_build.py <build_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''         ["Census TIGERweb places", "city limits (incorporated places) and named unincorporated communities (census-designated places)", "Loaded", True]),''',
    '''         ["Census TIGERweb places and county subdivisions", "city, borough and village limits (incorporated places), the towns and townships around them (county subdivisions with their own government) and named communities inside a town or township (census-designated places, shown as '<community> (<town>)')", "Loaded", True]
         if region.STATE in region.TOWN_STATES and ex("cousub.geojson") else
         ["Census TIGERweb places", "city, borough and village limits (incorporated places) and census-designated places; town and township boundaries not loaded, so land outside a place is shown under the county's name", "Loaded", True]
         if region.STATE in region.TOWN_STATES else
         ["Census TIGERweb places", "city limits (incorporated places) and named unincorporated communities (census-designated places)", "Loaded", True]),''')

rep('''"Loaded (" + LOC.get("source", "") + ")", True] if LOC else''', '''"Loaded (" + _crash_layers(LOC) + ")", True] if LOC else''')
rep('''def sources_table(M):''', '''def _crash_layers(LOC):
    """the layers the crash rows were read from (crashes_local.json 'jobs', or Illinois's yearly layers in region.OV), each with its
    years; numbered layers of one service are listed once. LOC['source'] is only the config's reference URL (round 8.6: for Utah a layer
    that was not read)"""
    cfg = region.OV.get("crashes") or {}
    lab = {j["url"]: j.get("label", "") for j in cfg.get("jobs") or []}
    lab.update({u: str(y) for y, u in (cfg.get("layers") or {}).items()})
    urls = LOC.get("jobs") or ([u for _, u in sorted(cfg["layers"].items())] if LOC.get("kind") == "il_idot" and cfg.get("layers") else [])
    if not urls:
        return LOC.get("source", "")
    by_root = {}
    for u in urls:
        root, _, n = u.rpartition("/")
        by_root.setdefault(root, []).append((n, lab.get(u, "")))
    return "; ".join(f"{root}/{ls[0][0]}" + (f" ({ls[0][1]})" if ls[0][1] else "") if len(ls) == 1 else
                     f"{root}, layers " + ", ".join(f"{n} ({l})" if l else n for n, l in ls) for root, ls in by_root.items())


def sources_table(M):''')

rep('''        for g in G:
            P["gaps"][g[0]] += 1
            if g[0] not in P["best"] or (g[6] or 9e18) < (P["best"][g[0]][1] or 9e18):
                P["best"][g[0]] = (gid, g[6], g[5], g[4])''', '''        for g in G:
            P["gaps"][g[0]] += 1
            # round 8.6: the most affected part that has a sized project (the LA build's rule, as the page says): a costed row first, then the
            # highest worse-than share, then the widest gap, then the lower cost (was: the lowest cost, else the first part read)
            mk, hi = GAP_METRIC[g[0]]; xv = gap_value(m, mk)
            rank = (g[6] is not None, g[3], xv if hi else -xv, -(g[6] or 0))
            if g[0] not in P["best"] or rank > P["best"][g[0]][4]:
                P["best"][g[0]] = (gid, g[6], g[5], g[4], rank)''')
rep('''            gid, cost, why, fix = P["best"][gk]; rows = details[gid]["r"];''', '''            gid, cost, why, fix, _ = P["best"][gk]; rows = details[gid]["r"];''')
rep('''        steps.sort(key=lambda s: (-(s["share"]), -(s["vpd"] or 0)))''',
    '''        steps.sort(key=lambda s: (-(s["vpd"] or 0), -(s["share"])))   # round 8.6: by return, then by how many parts share the gap (the LA build's order, as the page says)''')
open(p, "w").write(s)
print("build_oc leaks fixes applied:", p)
