"""fetch_oc selection 21 (round 8.6, text only): skipped feeds record their stops in the county box, unlocated feeds that could not be
downloaded are flagged, the full 'counted from other feeds' list is kept. No measurement changes."""
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, old[:80])
    s = s.replace(old, new)

rep('''GTFS_SELECTION = 20   # 20 (round 8.6): an ended copy''',
    '''GTFS_SELECTION = 21   # 21 (round 8.6, text only, measurements unchanged): a skipped feed records how many of its stops lie in the county's
#   box (stops_in_county: the page lists it only where it has one), a feed tried only because the catalog gives it no area and of which
#   no copy could be downloaded is flagged (unlocated), and the full list of routes counted from other feeds is kept.
#   20 (round 8.6): an ended copy''')

rep('''NO_BUS_NEAR_TODAY = "no bus service on the Wednesdays within three weeks of today"
''', '''NO_BUS_NEAR_TODAY = "no bus service on the Wednesdays within three weeks of today"


def _stops_in_box(rd, W, S, E, N):
    """selection 21: how many of a feed's stops (of any kind) lie in the county's box, for a skipped feed: the page lists a skipped feed
    only where it has one (Fresno State University's feed, which the catalog gives no area, was listed in all 56 California counties)"""
    n = 0
    for x in rd("stops.txt"):
        try:
            n += W <= float(x["stop_lon"]) <= E and S <= float(x["stop_lat"]) <= N
        except (KeyError, TypeError, ValueError):
            continue
    return n
''')

rep('''        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "why": "no bus routes" if not bus_routes else "no service dates"})''',
    '''        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "why": "no bus routes" if not bus_routes else "no service dates",
                        "stops_in_county": _stops_in_box(rd, W, S, E, N)})''')

rep('''        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "copy": r.get("_copy"), "calendar_end": hi.isoformat(), "why": "schedule ended over a year ago"})''',
    '''        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "copy": r.get("_copy"), "calendar_end": hi.isoformat(), "why": "schedule ended over a year ago",
                        "stops_in_county": _stops_in_box(rd, W, S, E, N)})''')

rep('''                        "why": NO_BUS_NEAR_TODAY, "calendar_end": hi.isoformat()})''',
    '''                        "why": NO_BUS_NEAR_TODAY, "calendar_end": hi.isoformat(), "stops_in_county": _stops_in_box(rd, W, S, E, N)})''')

rep('''                                    + f"its Cal-ITP copy places only {n_fix} of {n_all} stops exactly (the State's tables round positions to about 100 m)"})''',
    '''                                    + f"its Cal-ITP copy places only {n_fix} of {n_all} stops exactly (the State's tables round positions to about 100 m)",
                                    "stops_in_county": _stops_in_box(rd, W, S, E, N)})''')

rep('''                skipped.append({"id": fid, "provider": r["provider"], "why": "no copy could be downloaded (" + "; ".join(errs)[:160] + ")"})''',
    '''                skipped.append({"id": fid, "provider": r["provider"], "why": "no copy could be downloaded (" + "; ".join(errs)[:160] + ")",
                                **({"unlocated": True} if r.get("_unlocated") else {})})''')

rep('''            if not (sub == STATE_NAMES.get(region.STATE) or (not sub and mun and (mun in PLACE_NAMES or mun == region.SHORT.lower()))):
                continue
''', '''            if not (sub == STATE_NAMES.get(region.STATE) or (not sub and mun and (mun in PLACE_NAMES or mun == region.SHORT.lower()))):
                continue
            if sub == STATE_NAMES.get(region.STATE):
                r["_unlocated"] = True   # selection 21: tried in every county of its state; if no copy can be read, the page names it apart
''')

rep('''            skipped.append({"id": fid, "provider": r["provider"], "why": "its routes are counted from other feeds: " + "; ".join(other)[:240]})''',
    '''            skipped.append({"id": fid, "provider": r["provider"], "why": "its routes are counted from other feeds: " + "; ".join(other)})''')

open(p, "w").write(s)
print("sel21 fetch patch applied to", p)
