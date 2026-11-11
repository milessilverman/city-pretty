"""Share of 07:00-09:00 bus stop_times with pickup_type 1 (no boarding) in a feed. usage: python3 -I pickup_share.py <id> ..."""
import sys, io, csv, zipfile, urllib.request, collections
BUS = {3, 11} | set(range(700, 800))
for fid in sys.argv[1:]:
    url = f"https://storage.googleapis.com/mobilitydata-datasets-prod/{'mdb-' + fid if fid.isdigit() else fid}/latest.zip"
    try:
        z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}), timeout=600).read()))
    except Exception as e:
        print(fid, "error", repr(e)[:60]); continue
    names = set(z.namelist())
    def rd(n):
        m = n if n in names else next((x for x in names if x.lower().endswith(n)), None)
        return [] if not m else ({(k or "").strip(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
    br = {r["route_id"] for r in rd("routes.txt") if (r.get("route_type") or "").isdigit() and int(r["route_type"]) in BUS}
    bt = {t["trip_id"] for t in rd("trips.txt") if t.get("route_id") in br}
    c = collections.Counter()
    for st in rd("stop_times.txt"):
        if st.get("trip_id") in bt and "07:00:00" <= (st.get("departure_time") or st.get("arrival_time") or "").zfill(8) < "09:00:00":
            c["all"] += 1; c["no pickup"] += (st.get("pickup_type") or "0") == "1"
    print(fid, dict(c), f"{100 * c['no pickup'] / max(c['all'], 1):.1f}%")
