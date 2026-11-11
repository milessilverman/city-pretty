"""Round 8.6: transit sources-row text for build_oc.py (patches the file given as argv[1] in place; text only, no scoring change).
1. A feed read from a copy other than MobilityData's hosted one names that copy; one whose newest readable copy has ended (selection 20's
   schedule_ended) says so, and the status cell counts such feeds.
2. The method names selection 20's departure rule (a trip's last stop and pickup_type 1 stop times are not departures).
3. 'Not included' leaves out skipped copies of feeds that are counted from another copy (18 counties listed a feed as both included and
   not included: Gold Coast Transit's hosted copy ended over a year ago and its legacy mirror is read)."""
import sys, py_compile, os
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f"{s.count(a)} matches: {a[:70]!r}")
    s = s.replace(a, b)
OLD_FEEDS = '''"; ".join(f"{', '.join(f['agencies']) if f.get('agencies') else f['provider']} (MobilityData {f['id']}, {f['weekday']})" for f in (tr.get("feeds") or [])) + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider']} (MobilityData {x['id']}: {x['why']})" for x in tr.get("skipped"))) if tr.get("skipped") else "")'''
NEW_FEEDS = '''"; ".join(_feed_label(f) for f in (tr.get("feeds") or [])) + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider']} (MobilityData {x['id']}: {x['why']})" for x in _not_counted(tr))) if _not_counted(tr) else "")'''
rep(OLD_FEEDS, NEW_FEEDS)
rep('''["GTFS feeds (MobilityData copies of each operator's feed)", ''', '''["GTFS feeds (each operator's feed: MobilityData's copies, the operator's own URL or, in California, the State's Cal-ITP tables)", ''')
rep("stops listed without a time interpolated between the trip's timed stops: ",
    "stops listed without a time interpolated between the trip's timed stops, a trip's last stop and drop-off-only stop times not counted as departures: ")
anchor = "\ndef "
i = s.index(anchor)   # the helpers go before the module's first function
HELP = '''
COPY_TEXT = {"legacy mirror": "MobilityData's legacy mirror", "producer URL": "the operator's own URL", "TransitFeeds archive": "the TransitFeeds archive",
             "Cal-ITP statewide tables": "the State of California's Cal-ITP tables"}


def _feed_label(f):
    """one feed in the transit sources row: its agencies, MobilityData id, the copy read when it is not MobilityData's hosted one, the
    weekday measured and, when the newest copy that could be read has ended (fetch_oc selection 20), the end of its bus schedule"""
    cp = COPY_TEXT.get(f.get("copy"))
    if cp and f.get("calitp"):
        cp += f" ({f['calitp'].get('name')}, snapshot of {f['calitp'].get('snapshot')})"
    return (f"{', '.join(f['agencies']) if f.get('agencies') else f['provider']} (MobilityData {f['id']}" + (f", read from {cp}" if cp else "")
            + f", {f['weekday']}" + (f"; the newest copy that could be read ends on {f['schedule_ended']}" if f.get("schedule_ended") else "") + ")")


def _not_counted(tr):
    """skipped feeds, less the copies of a feed that is counted from another copy or read with no stop here (Gold Coast Transit 32: its
    hosted copy ended over a year ago and its legacy mirror is read)"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    return [x for x in (tr.get("skipped") or []) if x["id"] not in counted]


def _ended_note(tr):
    """the status cell's count of feeds measured on a schedule that has ended (fetch_oc selection 20 records schedule_ended)"""
    n = sum(1 for f in (tr.get("feeds") or []) if f.get("schedule_ended"))
    return f"; {n} {'feed' if n == 1 else 'feeds'} measured on the newest schedule that could be read, which has ended" if n else ""

'''
s = s[:i] + "\n" + HELP.rstrip("\n") + "\n" + s[i:]
rep("""{tr.get('stops', 0):,} stops" + (f"; bus frequency left unknown""", """{tr.get('stops', 0):,} stops" + _ended_note(tr) + (f"; bus frequency left unknown""")
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("sources-row text written to", p)
