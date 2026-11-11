"""Round 8.6: transit selection 20 for fetch_oc.py (patches the file given as argv[1] in place; the install wrapper backs it up first).
1. A copy whose bus schedule has ended is no longer final: the feed's other copies, then the provider's other candidates, are read and
   the first current one is used, else the ended one whose bus schedule ends last; the meta records schedule_ended and copies_read.
2. A headway trip lists a stop only when it departs there 07:00-09:00 (35 stops were listed with 0 buses an hour).
3. California: the State's Cal-ITP GTFS tables (data.ca.gov) are a copy source when no other copy is current.
4. A departure is a stop time where a rider can board: a trip's last stop and pickup_type 1 stop times are not counted (NEXT_ROUND
   item 7); the weekday comparison (_choose_wednesday's counts) is unchanged."""
import sys, py_compile, os, hashlib
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f"{s.count(a)} matches: {a[:70]!r}")
    s = s.replace(a, b)
rep("GTFS_SELECTION = 19   # 19 (round 8.5):",
    "GTFS_SELECTION = 20   # 20 (round 8.6): an ended copy is not final: the provider's other copies (and in California the State's Cal-ITP\n"
    "#   tables) are read and the newest used; a departure is a stop time where a rider can board (not a trip's last stop, not pickup_type 1);\n"
    "#   a headway trip lists a stop only when it departs there 07:00-09:00. 19 (round 8.5):")
rep('''                if h > 0:
                    per[rr][st["stop_id"]] += sum(1 for k in range(int((b_ - a) / h) + 1) if a + k * h < b_ and 25200 <= a + off + k * h < 32400)''',
'''                if h > 0:
                    c = sum(1 for k in range(int((b_ - a) / h) + 1) if a + k * h < b_ and 25200 <= a + off + k * h < 32400)
                    if c:   # selection 20: a stop with no departure 07:00-09:00 is not listed (35 such 0-bus stops before)
                        per[rr][st["stop_id"]] += c''')
rep('''"interpolated": n_interp, "lo": lo, "hi": hi, "pts": pts,''', '''"interpolated": n_interp, "lo": lo, "hi": hi, "hi_bus": hi_bus, "pts": pts,''')
rep('''    ended or not-yet-started copy, measured on its own Wednesdays nearest today); None for a stale copy''',
    '''    ended or not-yet-started copy, measured on its own Wednesdays nearest today; hi_bus is the last date its bus services run, and since
    selection 20 fetch_gtfs_mdb reads the feed's other copies when that is before today); None for a stale copy''')
rep('''    marked 'future' since selection 19; deprecated or redirected copies only as fallbacks;''',
    '''    marked 'future' since selection 19; deprecated or redirected copies only as fallbacks, or, since selection 20, when the copies read
    have ended (and then, in California, the State's Cal-ITP tables): the first current copy is used, else the ended one whose bus
    schedule ends last;''')
a = s.index('    for cands in feeds:\n      for r in cands:\n'); b = s.index('\n    # each bus route once.')
old = s[a:b]
if hashlib.sha256(old.encode()).hexdigest()[:16] != "af1c38923b0fda9b": sys.exit("feed loop changed since the patch was written")
s = s[:a] + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "new_loop.txt")).read().rstrip("\n") + s[b:]
HERE = os.path.dirname(os.path.abspath(__file__))
rep("\ndef fetch_gtfs_mdb():\n", "\n" + open(os.path.join(HERE, "calitp_helpers.txt")).read() + "def fetch_gtfs_mdb():\n")
rep('''                         **({"counted_from_another_feed": other} if other else {}), **({"deprecated_in_catalog": True} if r["_dep"] else {})})''',
'''                         **({"counted_from_another_feed": other} if other else {}), **({"deprecated_in_catalog": True} if r["_dep"] else {}),
                         **({"schedule_ended": res["hi_bus"].isoformat(), "copies_read": res.get("copies_read")} if res["hi_bus"] < today else {}),
                         **({"calitp": r["_calitp"]} if r.get("_calitp") else {})})''')
rep('''                                  "wednesdays_7_9am_departures": res.get("wednesdays"), "calendar": [res["lo"].isoformat(), res["hi"].isoformat()]})''',
'''                                  "wednesdays_7_9am_departures": res.get("wednesdays"), "calendar": [res["lo"].isoformat(), res["hi"].isoformat()],
                                  **({"schedule_ended": res["hi_bus"].isoformat(), "copies_read": res.get("copies_read")} if res["hi_bus"] < today else {}),
                                  **({"calitp": r["_calitp"]} if r.get("_calitp") else {})})''')
rep('''    for st in rows:
        sec = secs.get(id(st))
        if sec is None:
            continue   # untimed before a trip's first or after its last timed stop: nothing to interpolate from
''', '''    last_of = {id(sts[-1]) for sts in by_trip.values()}   # selection 20: a trip's last stop, where the bus arrives and the trip ends
    for st in rows:
        sec = secs.get(id(st))
        if sec is None:
            continue   # untimed before a trip's first or after its last timed stop: nothing to interpolate from
        if id(st) in last_of or (st.get("pickup_type") or "").strip() == "1":
            continue   # selection 20: no boarding here (the trip's last stop, or pickup_type 1: drop-off only); counted before, which doubled
            #            a terminal's buses (Oxnard Transit Center 27.5 buses an hour, 14 departing)
''')
rep('''"method": "bus departures 07:00-09:00 per stop on one representative weekday per feed, divided by 2 (buses per hour); each feed and each bus route counted once"''',
    '''"method": "bus departures 07:00-09:00 per stop on one representative weekday per feed, divided by 2 (buses per hour); a departure is a stop time where a rider can board (not a trip's last stop, not pickup_type 1; selection 20); each feed and each bus route counted once"''')
rep('''    stops = {x["stop_id"]: (float(x["stop_lon"]), float(x["stop_lat"]), x.get("stop_name", "")) for x in rd("stops.txt") if x.get("stop_lat") and x.get("stop_lon")}''',
    '''    stops = {x["stop_id"]: (float(x["stop_lon"]), float(x["stop_lat"]), x.get("stop_name", ""), x.get("_rounded") == "1") for x in rd("stops.txt") if x.get("stop_lat") and x.get("stop_lon")}''')
rep('''                x, y, nm = stops[sid]
                if W <= x <= E and S <= y <= N:
                    d = pts.setdefault(rr, {}); k = (round(x, 5), round(y, 5)); prev = d.get(k)''',
    '''                x, y, nm, rnd = stops[sid]
                if W <= x <= E and S <= y <= N:   # selection 20: a stop at a rounded position (Cal-ITP) is kept apart from its neighbours
                    d = pts.setdefault(rr, {}); k = (round(x, 5), round(y, 5)) + ((sid,) if rnd else ()); prev = d.get(k)''')
rep("catalog rows MobilityData marks 'future' are candidates; the feed's own calendar decides",
    "catalog rows MobilityData marks 'future' are candidates; a copy that has not started is measured on its own first Wednesdays, as if running")
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("selection 20 written to", p)
