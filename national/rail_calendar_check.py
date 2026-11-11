"""Last date with rail trips in each rail-only feed (calendar end dates of services that have rail trips, and calendar_dates additions).
usage: python3 -I rail_calendar.py <ids json>"""
import sys, json, io, csv, zipfile, urllib.request, datetime
from multiprocessing import Pool
RAIL = {0, 1, 2, 5, 7, 12} | set(range(100, 118)) | set(range(400, 406)) | set(range(900, 907)) | {1400}
def one(fid):
    url = f"https://storage.googleapis.com/mobilitydata-datasets-prod/{'mdb-' + fid if fid.isdigit() else fid}/latest.zip"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}), timeout=600) as r:
            z = zipfile.ZipFile(io.BytesIO(r.read()))
    except Exception as e:
        return fid, {"error": repr(e)[:80]}
    names = set(z.namelist())
    def rd(n):
        m = n if n in names else next((x for x in names if x.lower().endswith(n)), None)
        return [] if not m else ({(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
    rr = {x["route_id"] for x in rd("routes.txt") if (x.get("route_type") or "").isdigit() and int(x["route_type"]) in RAIL}
    sids = {t.get("service_id") for t in rd("trips.txt") if t.get("route_id") in rr}
    ends = [c["end_date"] for c in rd("calendar.txt") if c.get("service_id") in sids and len(c.get("end_date") or "") == 8]
    adds = [c["date"] for c in rd("calendar_dates.txt") if c.get("service_id") in sids and c.get("exception_type") == "1" and len(c.get("date") or "") == 8]
    last = max(ends + adds) if (ends or adds) else None
    return fid, {"last_rail_date": last, "rail_routes": len(rr)}
ids = json.load(open(sys.argv[1]))
with Pool(3) as p:
    for fid, r in sorted(p.map(one, ids)):
        flag = ""
        if r.get("last_rail_date") and r["last_rail_date"] < "20251108": flag = "  <-- STALE (over a year)"
        elif r.get("last_rail_date") and r["last_rail_date"] < "20261108": flag = "  <-- ended before today"
        print(fid, r, flag)
