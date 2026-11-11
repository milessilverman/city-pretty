"""Round 8.6: transit_day_audit.py for selection 20 (patches the file in place after backing it up as transit_day_audit_sel19.py).
CUR = 20 (the day is chosen as in 18); a feed read from Cal-ITP's tables is audited from its cached copy (cache/calitp); --all also audits
counties built at the newest selection (the round-8.6 re-run: does each recorded day reproduce?)."""
import sys, py_compile, os, shutil
p = "/home/user/national/transit_day_audit.py"; s = open(p).read()
def rep(a, b):
    global s
    if s.count(a) != 1: sys.exit(f"{s.count(a)} matches: {a[:70]!r}")
    s = s.replace(a, b)
rep('''CUR = 19   # the newest transit selection (pipeline/fetch_oc.py GTFS_SELECTION); 19 chooses the day as 18 does (it adds catalog rows marked 'future')''',
    '''CUR = 20   # the newest transit selection (pipeline/fetch_oc.py GTFS_SELECTION); 19 and 20 choose the day as 18 does (19 adds catalog rows
#            marked 'future'; 20 reads further copies when one has ended, Cal-ITP's tables in California, and counts boarding departures)
ALL = "--all" in sys.argv   # also audit the counties built at CUR (does each recorded day reproduce from its copy?)
sys.argv = [a for a in sys.argv if a != "--all"]''')
rep('''def feed_counts(url):
    """per Wednesday of the feed's calendar: 07:00-09:00 bus departures, bus trips, number of active services and a digest of them"""
    try:
        z = zipfile.ZipFile(io.BytesIO(get(url)))''',
    '''def src_of(fd):
    """the copy a county read: its URL, or for a copy built from Cal-ITP's tables (selection 20) the cached file of that snapshot"""
    c = fd.get("calitp")
    if c and c.get("key") and c.get("snapshot"):
        return f"{N}/cache/calitp/{hashlib.sha1(c['key'].encode()).hexdigest()[:16]}-{c['snapshot']}.zip"
    return fd.get("url")


def feed_counts(url):
    """per Wednesday of the feed's calendar: 07:00-09:00 bus departures, bus trips, number of active services and a digest of them"""
    try:
        z = zipfile.ZipFile(io.BytesIO(open(url, "rb").read() if url.startswith(N + "/cache/calitp/") else get(url)))''')
rep('''    urls = sorted({fd["url"] for m in metas.values() if m.get("selection", 0) < CUR for fd in feeds_of(m) if fd.get("url")})''',
    '''    urls = sorted({src_of(fd) for m in metas.values() if m.get("selection", 0) < CUR or ALL for fd in feeds_of(m) if src_of(fd)})''')
rep('''        if sel >= CUR:
            continue''', '''        if sel >= CUR and not ALL:
            continue''')
rep('''            r = res.get(fd.get("url"), {"error": "no url"});''', '''            r = res.get(src_of(fd), {"error": "no url"});''')
rep("through selection 19 in round 8.5: the selection-18 run of 17:01 used CUR = 18).",
    "through selection 19 in round 8.5: the selection-18 run of 17:01 used CUR = 18; through selection 20 in round 8.6, where --all also\naudits the counties built at the newest selection, and copies built from Cal-ITP's tables are read from cache/calitp).")
rep("selection-17-or-later build read with no stop in the county", "build from selection 18 on (the list was added at 15:53, after the selection-17 builds) read with no stop in the county")
rep("(since selection 17's meta)", "(since selection 18's meta: the list was added at 15:53, after the selection-17 builds)")
shutil.copy(p, "/home/user/national/transit_day_audit_sel19.py")
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("transit_day_audit.py at selection 20")
