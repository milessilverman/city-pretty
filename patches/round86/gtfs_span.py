"""print a GTFS zip's agencies, route types and service span (calendar + calendar_dates), read in memory. usage: gtfs_span.py <zip>..."""
import sys, zipfile, csv, io, collections
for p in sys.argv[1:]:
    try:
        z = zipfile.ZipFile(p)
    except Exception as e:
        print(p, "unreadable", repr(e)[:80]); continue
    names = {n.rsplit("/", 1)[-1].lower(): n for n in z.namelist()}
    rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(names[n]), encoding="utf-8-sig"))) if n in names else []
    ag = [a.get("agency_name") for a in rd("agency.txt")]
    rt = collections.Counter((r.get("route_type") or "").strip() for r in rd("routes.txt"))
    d = [c.get("end_date") for c in rd("calendar.txt") if (c.get("end_date") or "").isdigit()] + [c.get("date") for c in rd("calendar_dates.txt") if (c.get("date") or "").isdigit()]
    s = [c.get("start_date") for c in rd("calendar.txt") if (c.get("start_date") or "").isdigit()] + [c.get("date") for c in rd("calendar_dates.txt") if (c.get("date") or "").isdigit()]
    print(p.split("/")[-2], "|", ag[:2], "| route types", dict(rt), "| service", min(s) if s else None, "->", max(d) if d else None)
