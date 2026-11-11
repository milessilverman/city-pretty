"""Variant for measurement (NEXT_ROUND item 7): a departure is a stop time where a rider can board: not the trip's last stop, not a
stop time with pickup_type 1. Patches the selection-20 fetch_oc.py given as argv[1] (scratch only until adopted)."""
import sys, py_compile, os
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f"{s.count(a)} matches: {a[:70]!r}")
    s = s.replace(a, b)
rep('''    for st in rows:
        sec = secs.get(id(st))
        if sec is None:
            continue   # untimed before a trip's first or after its last timed stop: nothing to interpolate from
''', '''    last_of = {id(sts[-1]) for sts in by_trip.values()}   # a trip's last stop: the bus arrives and the trip ends there
    for st in rows:
        sec = secs.get(id(st))
        if sec is None:
            continue   # untimed before a trip's first or after its last timed stop: nothing to interpolate from
        if id(st) in last_of or (st.get("pickup_type") or "").strip() == "1":
            continue   # no boarding: the trip's last stop, or a stop time with pickup_type 1 (drop-off only)
''')
tmp = p + ".tmp"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("pickup variant written to", p)
