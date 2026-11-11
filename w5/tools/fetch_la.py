"""Round 5 downloads for the site suggestions (both counties). Raw files into ../la_data or ../oc_data; log to fetch.log."""
import os, sys, json, time, urllib.request, urllib.parse
sys.path.insert(0, "/home/user/handoff/pipe/oc_pipeline")
OUT = "/home/user/w5/la_data"; os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "fetch.log"), "a")
def log(*a):
    s = time.strftime("%H:%M:%S ") + " ".join(map(str, a)); print(s, flush=True); LOG.write(s + "\n"); LOG.flush()
def get(url, params=None, timeout=900, retries=4):
    if params: url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "CityPretty-build/1.0"}), timeout=timeout) as r: return r.read().decode("utf-8", "replace")
        except Exception as e:
            log("  retry", i + 1, url[:100], str(e)[:100]); time.sleep(5 * (i + 1))
    raise RuntimeError("failed " + url[:120])
CCRS = {"2025": "9f4fc839-122d-4595-a146-43bc4ed16f46", "2024": "f775df59-b89b-4f82-bd3d-8807fa3a22a0", "2023": "436642c0-cd04-4a4c-b45e-564b66437476",
        "2022": "7828780b-117b-455e-9275-986ad3ffde50", "2021": "d08692e2-6d36-487e-bca0-28cd127a626f", "2020": "a2e0605d-0695-4bce-806d-4d0dda7ace68",
        "2019": "2b4c7d03-e684-435e-80da-17935de9499f", "2018": "a4b57216-5110-43d3-884c-d95366b19158", "2017": "4784664d-b7cf-4427-af25-7c7307bad56c", "2016": "3d5f2586-cf68-4213-aa1c-60df37399d10"}
COLS = '"Collision Id","Latitude","Longitude","NumberKilled","NumberInjured","MotorVehicleInvolvedWithDesc","Crash Date Time"'
def crashes(county_code, tag):
    for yr, rid in CCRS.items():
        name = os.path.join(OUT, f"ccrs_{tag}_{yr}.json")
        if os.path.exists(name) and os.path.getsize(name) > 100: continue
        rows, off = [], 0
        while True:
            sql = f'SELECT {COLS} FROM "{rid}" WHERE "County Code"=\'{county_code}\' ORDER BY "_id" LIMIT 32000 OFFSET {off}'
            j = json.loads(get("https://data.ca.gov/api/3/action/datastore_search_sql", {"sql": sql}))
            got = j["result"]["records"]; rows += [[r["Collision Id"], r["Latitude"], r["Longitude"], r["NumberKilled"], r["NumberInjured"], r["MotorVehicleInvolvedWithDesc"], r["Crash Date Time"]] for r in got]; off += len(got)
            if len(got) < 32000: break
        json.dump({"source": f"https://data.ca.gov/dataset/ccrs resource {rid}", "county_code": county_code, "year": yr, "cols": ["id", "lat", "lon", "killed", "injured", "with", "time"], "rows": rows}, open(name, "w"))
        log("saved", name, len(rows), "rows")
def arcgis(name, url, fields="*", where="1=1"):
    path = os.path.join(OUT, name)
    if os.path.exists(path) and os.path.getsize(path) > 100: return
    oid = json.loads(get(url, {"f": "json"})).get("objectIdField") or "OBJECTID"
    n = json.loads(get(f"{url}/query", {"where": where, "returnCountOnly": "true", "f": "json"}))["count"]
    feats, off = [], 0
    while off < n:
        j = json.loads(get(f"{url}/query", {"where": where, "outFields": fields, "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultOffset": off, "resultRecordCount": 1000, "orderByFields": oid}))
        got = j.get("features", []); feats += got; off += len(got)
        if not got: break
    assert len(feats) == n, (name, len(feats), n)
    json.dump({"type": "FeatureCollection", "features": feats, "source": url, "downloaded": time.strftime("%Y-%m-%d")}, open(path, "w")); log("saved", name, len(feats))
AFDC = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/Alternative_Fueling_Stations/FeatureServer/0"
def chargers():
    # USDOT/BTS NTAD copy of the AFDC station list (updated daily from AFDC); EV stations in a box around LA + Orange counties
    path = os.path.join(OUT, "afdc_ev_la_oc.geojson")
    if os.path.exists(path) and os.path.getsize(path) > 100: return
    where = "fuel_type_code='ELEC' AND state='CA' AND latitude>33.2 AND latitude<34.85 AND longitude>-118.95 AND longitude<-117.4"
    fields = "OBJECTID,id,station_name,street_address,city,zip,access_code,access_detail_code,status_code,facility_type,owner_type_code,ev_level2_evse_num,ev_dc_fast_num,ev_network,date_last_confirmed,open_date,updated_at,latitude,longitude,restricted_access"
    n = json.loads(get(f"{AFDC}/query", {"where": where, "returnCountOnly": "true", "f": "json"}))["count"]
    feats, off = [], 0
    while off < n:
        j = json.loads(get(f"{AFDC}/query", {"where": where, "outFields": fields, "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultOffset": off, "resultRecordCount": 2000, "orderByFields": "OBJECTID"}))
        got = j.get("features", []); feats += got; off += len(got)
        if not got: break
    assert len(feats) == n, (len(feats), n)
    meta = json.loads(get(AFDC, {"f": "json"}))
    json.dump({"type": "FeatureCollection", "features": feats, "source": AFDC, "downloaded": time.strftime("%Y-%m-%d"), "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate")}, open(path, "w")); log("saved", path, len(feats))
def chargers_county(fips):
    """Same AFDC copy for any county: EV stations in its block-group box (+0.05 degree) -> national/pipeline/data_<fips>/afdc_ev.geojson"""
    nd = f"/home/user/national/pipeline/data_{fips}"; path = os.path.join(nd, "afdc_ev.geojson")
    xs, ys = [], []
    for f in json.load(open(os.path.join(nd, "bg.geojson")))["features"]:
        def walk(c):
            if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
            else: [walk(q) for q in c]
        walk(f["geometry"]["coordinates"])
    st = json.load(open("/home/user/national/data/counties.json"))[fips]["state"]
    where = (f"fuel_type_code='ELEC' AND state='{st}' AND latitude>{min(ys) - .05:.4f} AND latitude<{max(ys) + .05:.4f} "
             f"AND longitude>{min(xs) - .05:.4f} AND longitude<{max(xs) + .05:.4f}")
    fields = "OBJECTID,id,station_name,street_address,city,zip,access_code,access_detail_code,status_code,facility_type,owner_type_code,ev_level2_evse_num,ev_dc_fast_num,ev_network,date_last_confirmed,open_date,updated_at,latitude,longitude,restricted_access"
    def count():   # the service sometimes answers with an error object instead of a count (Cowlitz WA, 8 Nov 2026): retry
        for i in range(4):
            j = json.loads(get(f"{AFDC}/query", {"where": where, "returnCountOnly": "true", "f": "json"}))
            if "count" in j:
                return j["count"]
            log("  AFDC count answer without a count, retry", i + 1, str(j)[:160]); time.sleep(10 * (i + 1))
        raise RuntimeError("AFDC count query failed: " + str(j)[:200])
    def fetch(n):
        feats, off = [], 0
        while off < n:
            j = json.loads(get(f"{AFDC}/query", {"where": where, "outFields": fields, "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultOffset": off, "resultRecordCount": 2000, "orderByFields": "OBJECTID"}))
            got = j.get("features", []); feats += got; off += len(got)
            if not got: break
        return feats
    n = count(); feats = fetch(n)
    for i in range(2):   # the live list can change between the count and the pages (Delaware County IN: 3 counted, 4 returned): count again
        if len(feats) == n:
            break
        n2 = count(); log("  AFDC count", n, "but", len(feats), "stations returned; count now", n2)
        if len(feats) == n2:
            n = n2; break
        n = n2; feats = fetch(n)
    assert len(feats) == n, (len(feats), n)
    meta = json.loads(get(AFDC, {"f": "json"}))
    json.dump({"type": "FeatureCollection", "features": feats, "source": AFDC, "where": where, "downloaded": time.strftime("%Y-%m-%d"), "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate")}, open(path, "w")); log("saved", path, len(feats))


if __name__ == "__main__":
    if "chargers" in sys.argv[1:]: chargers()
    if sys.argv[1:2] == ["chargers_county"]:
        chargers_county(sys.argv[2]); sys.exit(0)
    what = sys.argv[1:]
    if not what or "humps" in what:
        arcgis("la_speed_humps.geojson", "https://services1.arcgis.com/tp9wqSVX1AitKgjd/arcgis/rest/services/Speed_Humps/FeatureServer/0")
    if not what or "channels" in what:
        arcgis("la_open_channels.geojson", "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Open_Channels/FeatureServer/3")
    if not what or "crashes" in what:
        crashes("19", "la")
