"""Download every public source the Orange County build needs into ./data (idempotent; re-run to fill gaps).
Sources (all public; every file is saved raw so the build is auditable):
  Census TIGERweb        block groups (done earlier), roads (primary/secondary/local incl. alleys), railroads, hydrography
  Census ACS 2020-2024   table-based summary files on www2.census.gov (no API key needed)
  OpenStreetMap          Overpass mirrors: parks, amenities, place names, noise walls, power lines, rail stations
  OC Public Works (OCGIS) county park boundaries with amenity flags, city boundaries
  Esri Living Atlas      USA Parks (local/county/state parks; used where OSM is unavailable and to cross-check)
  OCTA                   GTFS stop frequencies 7-9 am
  CDE                    public school directory (sd.cde.ca.gov)
  CHP / CCRS             crashes 2023-2025 via data.ca.gov datastore (County Code 30)
  CAL FIRE               Fire Hazard Severity Zones (SRA 2023, LRA 2025)
  American Forests       Tree Equity Score, California block groups (2021 release on the public share bucket)
Optional: NREL_API_KEY for DC fast chargers (AFDC); otherwise OSM charging stations are used.
"""
import os, sys, json, time, zipfile, io, csv, urllib.request, urllib.parse, collections

import region
DATA = region.DATA
os.makedirs(DATA, exist_ok=True)
BBOX = region.OV.get("bbox")   # west, south, east, north; other counties: computed from their block groups after fetch_blockgroups()
UA = {"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}
LOG = open(os.path.join(DATA, "fetch.log"), "a")


def log(*a):
    s = time.strftime("%H:%M:%S") + " " + " ".join(str(x) for x in a)
    print(s, flush=True); LOG.write(s + "\n"); LOG.flush()


def get(url, params=None, binary=False, retries=3, timeout=600, data=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA, data=data)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read()
            return b if binary else b.decode("utf-8", "replace")
        except Exception as e:
            last = e; log("  retry", i + 1, url[:120], str(e)[:120])
            if getattr(e, "code", None) in (403, 404) and "storage.googleapis.com/" in url:   # not in the bucket (public GCS answers 403)
                break
            time.sleep(5 * (i + 1))
    raise last


def save(name, text, binary=False):
    p = os.path.join(DATA, name)
    with open(p, "wb" if binary else "w", **({} if binary else {"encoding": "utf-8"})) as f:
        f.write(text)
    log("saved", name, f"{os.path.getsize(p) / 1e6:.1f} MB")


SHARED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache")   # national / statewide raw files shared by all counties
SHARED_FILES = ("acs_b", "acs_geos.txt", "tes_ca.zip", "cde_schools.txt")
def link_shared():
    """reuse national/statewide downloads (ACS tables, TES state file, CDE directory, DOJ CSV) across counties via the shared cache"""
    os.makedirs(SHARED, exist_ok=True)
    for f in os.listdir(SHARED):
        if f in ("osm", "osm_split", "osm_states", "tes_states", "tes_unzipped"):   # per-state caches, linked file by file by their own fetch steps
            continue
        if region.STATE != "CA" and (f in ("tes_ca.zip", "cde_schools.txt", "doj") or f.startswith("tes_ca")):
            continue                                   # California-only files: never linked into another state's county
        dst = os.path.join(DATA, f)
        if not os.path.exists(dst):
            os.symlink(os.path.abspath(os.path.join(SHARED, f)), dst)


def have(name):
    p = os.path.join(DATA, name)
    return os.path.exists(p) and os.path.getsize(p) > 100


def manifest(name, url, rows, note=""):
    """Round 3: one record per raw file (URL, download date, row count) in data/sources_round3.json."""
    p = os.path.join(DATA, "sources_round3.json")
    m = json.load(open(p)) if os.path.exists(p) else {}
    m[name] = {"url": url, "downloaded": time.strftime("%Y-%m-%d"), "rows": rows, "note": note}
    json.dump(m, open(p, "w"), indent=1)
    log("  manifest", name, rows, "rows", url)


def county_bbox():
    """west, south, east, north of the county's block groups (plus 0.01 degree); Orange County keeps its original box"""
    global BBOX
    if BBOX:
        return BBOX
    j = json.load(open(os.path.join(DATA, "bg.geojson")))
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
        else: [walk(x) for x in c]
    for f in j["features"]: walk(f["geometry"]["coordinates"])
    BBOX = (round(min(xs) - .01, 4), round(min(ys) - .01, 4), round(max(xs) + .01, 4), round(max(ys) + .01, 4))
    return BBOX


def arcgis_query(url, where="1=1", fields="*", bbox=None, page=2000, extra=None, use_bbox=True):
    """Page through an ArcGIS REST layer as GeoJSON features."""
    feats, offset = [], 0
    if use_bbox and bbox is None:
        bbox = county_bbox()
    while True:
        p = {"where": where, "outFields": fields, "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultOffset": offset, "resultRecordCount": page}
        if use_bbox:
            p.update({"geometry": ",".join(str(v) for v in bbox), "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects"})
        if extra:
            p.update(extra)
        j = json.loads(get(f"{url}/query", p, timeout=900))
        if "error" in j:
            raise RuntimeError(f"{url}: {j['error']}")
        got = j.get("features", [])
        feats += got
        log("   ", url.split("/services/")[-1][:60], "offset", offset, "got", len(got))
        if len(got) < page and not j.get("exceededTransferLimit"):
            break
        offset += len(got)
        if not got:
            break
    return feats


def fetch_arcgis_geojson(name, url, **kw):
    if have(name):
        return
    save(name, json.dumps({"type": "FeatureCollection", "features": arcgis_query(url, **kw)}))


# ---------------- 1. Census block groups (TIGERweb) ----------------
def fetch_blockgroups():
    if have("bg.geojson"):
        return
    base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer"
    layers = json.loads(get(base, {"f": "json"}))["layers"]
    lid = next(l["id"] for l in layers if "Block Group" in l["name"])
    feats = arcgis_query(f"{base}/{lid}", where=f"STATE='{region.STATE_FIPS}' AND COUNTY='{region.COUNTY_FIPS}'", fields="GEOID,STATE,COUNTY,TRACT,BLKGRP,AREALAND,CENTLAT,CENTLON", use_bbox=False, page=1000)
    save("bg.geojson", json.dumps({"type": "FeatureCollection", "features": feats}))


# ---------------- 2. ACS 2020-2024 5-year, table-based summary files ----------------
ACS_VARS = {"pop": "B01003_E001", "units": "B25001_E001", "occ": "B25003_E001", "owner": "B25003_E002", "hv": "B25077_E001", "rent": "B25064_E001",
            "inc": "B19013_E001", "yb": "B25035_E001", "units_all": "B25024_E001", "sf_det": "B25024_E002", "sf_att": "B25024_E003",
            "hh": "B25044_E001", "nocar_own": "B25044_E003", "nocar_rent": "B25044_E010", "vacant": "B25004_E001", "other_vacant": "B25004_E008",
            "m5_9": "B01001_E004", "m10_14": "B01001_E005", "m15_17": "B01001_E006", "m_u5": "B01001_E003", "f_u5": "B01001_E027", "f5_9": "B01001_E028", "f10_14": "B01001_E029", "f15_17": "B01001_E030"}
# B08201 (vehicles by household size) and B09001 (population under 18) are not published for block groups; B25044 and B01001 are.
ACS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF"


def fetch_acs():
    if have("acs_bg.json") and have("acs_place.json"):
        return
    tables = sorted({v.split("_")[0].lower() for v in ACS_VARS.values()})
    rows_bg, rows_place, rows_tract = {}, {}, {}
    for t in tables:
        name = f"acs_{t}.dat"
        if not have(name):
            save(name, get(f"{ACS_BASE}/data/5YRData/acsdt5y2024-{t}.dat", timeout=1800))
        with open(os.path.join(DATA, name), encoding="utf-8") as fh:
            hdr = fh.readline().rstrip("\n").split("|")
            for line in fh:
                if line.startswith("1500000US" + region.FIPS):
                    d = dict(zip(hdr, line.rstrip("\n").split("|"))); rows_bg.setdefault(d["GEO_ID"][9:], {}).update(d)
                elif line.startswith("1400000US" + region.FIPS):
                    d = dict(zip(hdr, line.rstrip("\n").split("|"))); rows_tract.setdefault(d["GEO_ID"][9:], {}).update(d)
                elif line.startswith("1600000US" + region.STATE_FIPS):
                    d = dict(zip(hdr, line.rstrip("\n").split("|"))); rows_place.setdefault(d["GEO_ID"], {}).update(d)
        log("  table", t, "bg rows", len(rows_bg))

    def num(v):
        try:
            x = float(v)
        except Exception:
            return None
        return None if x <= -222222222 else x
    out = {g: {k: num(d.get(v)) for k, v in ACS_VARS.items()} for g, d in rows_bg.items()}
    for g, o in out.items():
        o["nocar"] = (o.pop("nocar_own") or 0) + (o.pop("nocar_rent") or 0) if o.get("hh") is not None else None
        ages = [o.pop(k) for k in ("m_u5", "m5_9", "m10_14", "m15_17", "f_u5", "f5_9", "f10_14", "f15_17")]
        o["kids"] = sum(a or 0 for a in ages) if any(a is not None for a in ages) else None
    out["_vintage"] = "2020-2024 ACS 5-year"
    save("acs_bg.json", json.dumps(out))
    save("acs_tract.json", json.dumps({t: {k: num(d.get(v)) for k, v in ACS_VARS.items() if k in ("hv", "rent", "inc", "yb")} for t, d in rows_tract.items()}))
    # place names + population (for crime rates per 100k)
    if not have("acs_geos.txt"):
        save("acs_geos.txt", get(f"{ACS_BASE}/documentation/Geos20245YR.txt", timeout=1800))
    names = {}
    with open(os.path.join(DATA, "acs_geos.txt"), encoding="utf-8", errors="replace") as fh:
        hdr = fh.readline().rstrip("\n").split("|")
        for line in fh:
            if "|160|" in line[:20] and "|06|" in line:
                d = dict(zip(hdr, line.rstrip("\n").split("|")))
                if d.get("SUMLEVEL") == "160" and d.get("STATE") == "06":
                    names[d["GEO_ID"]] = d["NAME"]
    place = {}
    for g, d in rows_place.items():
        n = names.get(g)
        if n and num(d.get("B01003_E001")) is not None:
            place[n.replace(" city, California", "").replace(" CDP, California", "").replace(" town, California", "")] = num(d["B01003_E001"])
    save("acs_place.json", json.dumps(place))


# ---------------- 3. TIGERweb roads, railroads, hydrography ----------------
TIGER_T = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer"
TIGER_H = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer"


def fetch_tiger_lines():
    fetch_arcgis_geojson("tiger_primary.geojson", f"{TIGER_T}/2", fields="MTFCC,NAME,BASENAME,RTTYP,PREDIRABRV,PRETYPEABRV,SUFTYPEABRV,SUFDIRABRV")
    fetch_arcgis_geojson("tiger_secondary.geojson", f"{TIGER_T}/6", fields="MTFCC,NAME,BASENAME,RTTYP,PREDIRABRV,PRETYPEABRV,SUFTYPEABRV,SUFDIRABRV")
    fetch_arcgis_geojson("tiger_local.geojson", f"{TIGER_T}/8", fields="MTFCC,NAME,BASENAME,RTTYP,PREDIRABRV,PRETYPEABRV,SUFTYPEABRV,SUFDIRABRV", page=5000)
    fetch_arcgis_geojson("tiger_rail.geojson", f"{TIGER_T}/9", fields="MTFCC,NAME")
    fetch_arcgis_geojson("tiger_hydro_line.geojson", f"{TIGER_H}/0", fields="MTFCC,NAME")
    fetch_arcgis_geojson("tiger_hydro_area.geojson", f"{TIGER_H}/1", fields="MTFCC,NAME")


# ---------------- 4. OpenStreetMap (Overpass), tiled ----------------
OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]
THEMES = {
    "places": '(node["place"~"^(neighbourhood|suburb|quarter|village|hamlet|town|city)$"]({bbox}););out tags;',
    "rail": '(node["railway"~"^(station|halt)$"]({bbox});node["public_transport"="station"]["train"="yes"]({bbox}););out tags;',
    "parks": '(way["leisure"~"^(park|garden|nature_reserve|dog_park|playground|recreation_ground)$"]({bbox});relation["leisure"~"^(park|nature_reserve)$"]({bbox});way["landuse"~"^(recreation_ground|allotments|cemetery)$"]({bbox});way["natural"~"^(beach)$"]({bbox});way["boundary"="protected_area"]({bbox});relation["boundary"="protected_area"]({bbox}););out tags geom;',
    "amenities": '(nwr["leisure"="pitch"]({bbox});nwr["leisure"~"^(playground|dog_park|swimming_pool|sports_centre|fitness_station)$"]({bbox});nwr["amenity"~"^(library|community_centre|townhall|fire_station|police|post_office|hospital|clinic|doctors|courthouse|school|college|university|kindergarten|marketplace|charging_station|social_facility)$"]({bbox});nwr["tourism"="museum"]({bbox});nwr["sport"~"pickleball|tennis|basketball|soccer|baseball|skateboard"]({bbox});nwr["shop"~"^(supermarket|greengrocer|grocery)$"]({bbox});nwr["amenity"~"^(restaurant|cafe|fast_food)$"]({bbox});nwr["amenity"="toilets"]({bbox});nwr["leisure"="garden"]["garden:type"="community"]({bbox});nwr["landuse"="allotments"]({bbox}););out tags center;',
    "infra": '(way["barrier"="wall"]["wall"~"noise"]({bbox});way["noise_barrier"]({bbox});way["power"="line"]({bbox}););out tags geom;',
    "roads": '(way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|secondary|tertiary|residential|living_street|unclassified)$"]({bbox}););out tags geom;',
}


def tiles(n):
    w, s, e, nn = BBOX
    for i in range(n):
        for j in range(n):
            yield (s + (nn - s) * j / n, w + (e - w) * i / n, s + (nn - s) * (j + 1) / n, w + (e - w) * (i + 1) / n)   # south, west, north, east


def fetch_osm(themes=None):
    for theme, q in THEMES.items():
        if themes and theme not in themes:
            continue
        name = f"osm_{theme}.json"
        if have(name):
            continue
        elems, seen, failed = [], set(), 0
        for t in tiles({"amenities": 3, "parks": 2, "roads": 4}.get(theme, 1)):
            bbox = ",".join(f"{v:.4f}" for v in t)
            body = "[out:json][timeout:600];" + q.replace("{bbox}", bbox)
            ok = False
            for url in OVERPASS:
                try:
                    j = json.loads(get(url, data=("data=" + urllib.parse.quote(body)).encode(), timeout=700, retries=1))
                    for el in j.get("elements", []):
                        k = (el["type"], el["id"])
                        if k not in seen:
                            seen.add(k); elems.append(el)
                    ok = True; log("  overpass ok", theme, bbox, url.split("/")[2], len(j.get("elements", []))); break
                except Exception as e:
                    log("  overpass fail", theme, bbox, url.split("/")[2], str(e)[:100]); time.sleep(5)
            if not ok:
                failed += 1; log("FAILED tile", theme, bbox)
            time.sleep(2)
        if failed:
            log("!! theme incomplete, not saved:", theme, failed, "tiles failed")
        else:
            save(name, json.dumps({"elements": elems}))


# ---------------- 5. OCGIS parks and cities, Esri USA Parks ----------------
def fetch_parks_cities():
    if region.OV.get("cities") != "ocgis":
        # Census places: incorporated places (layer "Incorporated Places") and census-designated places, clipped to the county box
        base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer"
        if not have("places.geojson"):
            layers = json.loads(get(base, {"f": "json"}))["layers"]
            feats = []
            for kind, nm in (("incorporated", "Incorporated Places"), ("cdp", "Census Designated Places")):
                lid = next(l["id"] for l in layers if l["name"] == nm)
                got = arcgis_query(f"{base}/{lid}", where=f"STATE='{region.STATE_FIPS}'", fields="GEOID,NAME,BASENAME,LSADC,FUNCSTAT")
                for f in got: f["properties"]["_kind"] = kind
                feats += got
            save("places.geojson", json.dumps({"type": "FeatureCollection", "features": feats}))
            manifest("places.geojson", base, len(feats), "Census incorporated places + CDPs in the county box")
        fetch_arcgis_geojson("usa_parks.geojson", "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Parks/FeatureServer/0", fields="NAME,FCC,SQMI,FEATTYPE")
        return
    fetch_arcgis_geojson("oc_county_parks.geojson", "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Park_Boundaries/MapServer/0", page=1000, use_bbox=False,
                         fields="NAME,Acres,Type,Status,Use_,Playground,PlaygroundTotLot,Restroom,TennisCourts,BasketballCourts,SoccerField,BallFields,DogsAllowed,Swimming,HikingTrails,PicnicAreas,VolleyballCourts,FitnessCourse,EquestrianTrails,NatureCenter")
    fetch_arcgis_geojson("oc_cities.geojson", "https://www.ocgis.com/arcpub/rest/services/Map_Layers/City_Boundaries_Public/MapServer/0", page=1000, use_bbox=False, fields="CITY,Label,LTT_STATUS,Acres")
    fetch_arcgis_geojson("usa_parks.geojson", "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Parks/FeatureServer/0", fields="NAME,FCC,SQMI,FEATTYPE")


# ---------------- 6. OCTA GTFS (bus frequency) ----------------
# Round 3: OCTA publishes the next service period as a dated file before google_transit.zip switches over. The feed checked on
# 5 Nov 2026 at google_transit.zip ends 20261107; Google_Transit_20261108.zip runs 20261108-20270213. Override with OCTA_GTFS_URL.
GTFS_URL = os.environ.get("OCTA_GTFS_URL", (region.GTFS or [None])[0])


MDB_CSV = "https://storage.googleapis.com/mdb-csv/sources.csv"   # MobilityData's GTFS catalog; feeds mirrored at storage.googleapis.com/mdb-latest
MDB_HOSTED = "https://storage.googleapis.com/mobilitydata-datasets-prod"   # MobilityData's current hosted copies (files.mobilitydatabase.org): <id>/latest.zip
GTFS_SELECTION = 19   # 19 (round 8.5): catalog rows MobilityData marks 'future' are candidates; the feed's own calendar decides
BUS_TYPES = {3, 11} | set(range(700, 800))                         # bus, trolleybus, extended bus types (the metric is bus frequency)
RAIL_TYPES = {0, 1, 2, 5, 7, 12} | set(range(100, 118)) | set(range(400, 406)) | set(range(900, 907)) | {1400}   # tram / light rail, subway,
#   rail, cable tram, funicular, monorail and their extended types: their stops confirm OpenStreetMap's rail stations (round 8.4)
AMTRAK_ID = "11"   # Amtrak's national feed: too wide for the bus selection, read for its stations


def _nid(s):
    """MobilityData writes the same feed as '75' and as 'mdb-75' (in redirects): one id per feed, so a feed is never counted twice"""
    s = (s or "").strip()
    return s[4:] if s.startswith("mdb-") and s[4:].isdigit() else s


def _agency_key(name):
    """'Community Transit (CT)' and 'Community Transit' are one agency"""
    import re
    n = re.sub(r"\s*\([^)]*\)\s*$", "", (name or "").strip())
    return " ".join(re.sub(r"[^a-z0-9]+", " ", n.lower()).split())


def _overlap(A, B):
    """share of the smaller of two stop sets ({key: [lon, lat, ...]}) that lies within about 60-110 m of a stop of the other set: two copies
    of one service stop at the same places, two services that merely share a name do not"""
    import math
    if len(A) > len(B):
        A, B = B, A
    if not A:
        return 0.0
    cell = lambda v: (int(math.floor(v[0] / 0.0007)), int(math.floor(v[1] / 0.0005)))
    grid = {cell(v) for v in B.values()}
    hit = sum(1 for v in A.values() if any((c[0] + i, c[1] + j) in grid for c in (cell(v),) for i in (-1, 0, 1) for j in (-1, 0, 1)))
    return hit / len(A)


def _rail_stops(r, rd, W, S, E, N, rail):
    """stops of a feed's rail routes inside the county box, whatever the feed's age: evidence that a rail station is served (or was, for
    a stale feed such as SacRT's). [lon, lat, name, feed id, route type, agency, parent station id] (the lowest-numbered non-tram type when
    routes of several types stop there: 0 / 900-906 is tram or light rail, which only confirms an OSM station; the agency of the route
    that set the type). Selection 15: a platform or track listed under a parent station (GTFS parent_station) is named after the station
    and carries its id, so that metrics_oc groups a station's platforms (WMATA's "Ballston, Orange/Silver Line Track 2 Platform" is
    Ballston-MU; VRE's tracks "1" to "4" and "Lead" are Spotsylvania, L Enfant, Broad Run, Union Station); a stop where no rail trip lets
    passengers on or off (pickup_type and drop_off_type 1 on every visit: Metro-North's Springdale MW Facility, LIRR's Hillside Facility,
    crew relief points) or named for employees only (SEPTA's "Employee Platform - Employees Only" at 69th Street) is left out."""
    import re
    agencies = {(a.get("agency_id") or "").strip(): (a.get("agency_name") or "").strip() for a in rd("agency.txt")}
    one = next(iter(agencies.values())) if len(agencies) == 1 else None
    rt, ra = {}, {}
    for x in rd("routes.txt"):
        v = (x.get("route_type") or "").strip()
        if v.isdigit() and int(v) in RAIL_TYPES and x.get("route_id"):
            rt[x["route_id"]] = int(v)
            ra[x["route_id"]] = agencies.get((x.get("agency_id") or "").strip()) or one or r.get("provider") or ""
    if not rt:
        return
    trips = {t["trip_id"]: t["route_id"] for t in rd("trips.txt") if t.get("route_id") in rt and t.get("trip_id")}
    tram = lambda q: q == 0 or 900 <= q <= 906
    stype, sag, board = {}, {}, set()
    for st in rd("stop_times.txt"):
        rid = trips.get(st.get("trip_id"))
        if rid is not None:
            ty = rt[rid]; sid = st.get("stop_id"); cur = stype.get(sid)
            if cur is None or (tram(cur) and not tram(ty)):
                stype[sid] = ty; sag[sid] = ra[rid]
            if not ((st.get("pickup_type") or "0").strip() == "1" and (st.get("drop_off_type") or "0").strip() == "1"):
                board.add(sid)
    stops = {x.get("stop_id"): x for x in rd("stops.txt")}
    for sid, x in stops.items():
        if sid in stype and sid in board and x.get("stop_lat") and x.get("stop_lon"):
            pid = (x.get("parent_station") or "").strip(); par = stops.get(pid) if pid else None
            nm = (x.get("stop_name") or "").strip(); pnm = ((par or {}).get("stop_name") or "").strip()
            if re.search(r"employees? only", nm + " " + pnm, re.I) or re.fullmatch(r"canadian border", nm, re.I):
                continue   # selection 17: Amtrak's feed lists its border timing point "Canadian Border" as a stop
            lon, lat = float(x["stop_lon"]), float(x["stop_lat"])
            if W <= lon <= E and S <= lat <= N:
                rail.append([lon, lat, pnm or nm, _nid(r["mdb_source_id"]), stype[sid], sag[sid], pid if pnm else ""])


FIXED_HOLIDAYS = ((1, 1), (6, 19), (7, 4), (11, 11), (12, 24), (12, 25), (12, 31))   # month, day
NO_BUS_NEAR_TODAY = "no bus service on the Wednesdays within three weeks of today"


def _choose_wednesday(weds, ntrips, today):
    """The representative weekday of one feed (transit selections 14, 16 and 17). ntrips(d) is the feed's count of bus departures
    07:00-09:00 on Wednesday d (timed stops, and since selection 18 the departures of headway trips in frequencies.txt). Candidates: the feed's Wednesdays within three weeks of today that are not a fixed-date
    holiday (1 Jan, 19 Jun, 4 Jul, 11 Nov, 24, 25 and 31 Dec; the other federal holidays fall on Mondays or Thursdays). A feed with no
    such Wednesday (its calendar ended or starts later) is judged on the non-holiday Wednesdays within three weeks of its own non-holiday
    Wednesday nearest today that has departures, or nearest today if none has (selection 16). Full weekday service is the highest
    positive count that at least two candidates reach within 10% (90% to 1/0.9 of it), or the highest count when no positive count is
    shared (selection 17: Wednesdays with no departures, such as those before a feed's first trips, are not a level); the day is the
    candidate nearest today within 10% of it, the earlier of two equally near. A schedule that lapses with nothing published after it
    is thereby measured on its last full Wednesday while at least two full Wednesdays are within three weeks of the build (Dutchess
    County on 8 Nov: 28 Oct, 1,717 departures; from 12 Nov the 216 level of 4 Nov on is measured).
    Returns (day, {candidate: departures}) for the seven candidates nearest today, in date order.
    Why: on Veterans Day many operators run a Saturday schedule, or their weekday one without school trips (Riverside Transit Agency:
    2.5 -> 2 buses an hour at Hemet stops); and the single busiest Wednesday can be a feed error: SRTA's feed runs Fall River's alternate
    weekday services on 25 Nov 2026 on top of its regular ones, the exception that removes them on other weekdays being missing (5,980
    departures against 4,426 on the other Wednesdays and 2,436 on Veterans Day, a Saturday schedule), Middletown Area
    Transit's overlaps its old and new schedules from 3 to 9 Nov (2,741 departures on 4 Nov, against 1,417 before and 1,324 after),
    Valley Regional Transit's adds a one-day 11 Nov schedule to its regular one.
    History: selection 9 took the nearest Wednesday with service (11 Nov 2026 from 8 Nov on); 10 the nearest with 90% of the busiest
    candidate's whole-day trips; 11 the same by 07:00-09:00 departures (Rochester's RTS drops its school and peak trips on 11 Nov but
    runs 91% of its day's trips); 12 left out the fixed-date holidays; 13 took the second-highest count as full service, which fails with
    two candidates (Greater Portland Metro's feed starts 7 Nov: 3,066 departures on 18 Nov, a school day, and 2,744 on 25 Nov, no school)
    and judged a feed whose schedule had ended on its whole calendar (Placer County Transit: its spring schedule instead of its last);
    14 judged such a feed on the three weeks around its last Wednesday, which may have no morning trips (selection 16: around the
    nearest Wednesday that has some); 16 let two Wednesdays with no departures form the level when the busy ones differ by more than 10%."""
    hol = lambda d: (d.month, d.day) in FIXED_HOLIDAYS
    near = lambda d: (abs((d - today).days), d)
    nh = [d for d in weds if not hol(d)]
    if not nh:
        cand = list(weds)
    else:
        cand = [d for d in nh if abs((d - today).days) <= 21]
        if not cand:   # selection 16: around the feed's own Wednesday nearest today that has departures 07:00-09:00 (a copy whose last
            #            weeks list services without morning trips would otherwise measure no buses)
            a = min([d for d in nh if ntrips(d) > 0] or nh, key=near); cand = [d for d in nh if abs((d - a).days) <= 21]
    n = {d: ntrips(d) for d in cand}
    within = lambda x, ref: 0.9 * ref <= x <= ref / 0.9
    shared = [n[d] for d in cand if n[d] > 0 and sum(1 for e in cand if within(n[e], n[d])) >= 2]   # selection 17: zero is no level
    ref = max(shared) if shared else max(n.values())
    day = min([d for d in cand if within(n[d], ref)] or cand, key=near)
    shown = sorted(sorted(cand, key=near)[:7])
    return day, {d.isoformat(): n[d] for d in shown}


def _gtfs_feed(r, rd, W, S, E, N, today, skipped, gap):
    """one GTFS feed. Returns a dict (its bus departures 07:00-09:00 per route and stop on the chosen weekday) for a copy whose bus
    schedule ended less than a year ago and that runs buses on its Wednesdays near today, or that has no Wednesday near today at all (an
    ended or not-yet-started copy, measured on its own Wednesdays nearest today); None for a stale copy or one with no bus
    service on its Wednesdays near today (both recorded in skipped: the provider's next copy is tried, fetch_gtfs_mdb), and for a feed
    with no bus routes, service dates or Wednesdays (the provider's next candidate is tried). A route is (agency, route_short_name), or the long name when a feed has no short names. Rows with a blank
    service_id or a malformed date are ignored (Georgia's Xpress 2426 ends calendar_dates.txt with a blank row)."""
    import datetime
    ok8 = lambda v: isinstance(v, str) and len(v) == 8 and v.isdigit()
    agencies = {(a.get("agency_id") or "").strip(): (a.get("agency_name") or "").strip() for a in rd("agency.txt")}
    one = next(iter(agencies.values())) if len(agencies) == 1 else None
    route = {}   # bus route_id -> (agency name, route key)
    for x in rd("routes.txt"):
        rt = (x.get("route_type") or "").strip()
        if rt.isdigit() and int(rt) in BUS_TYPES and x.get("route_id"):
            ag = agencies.get((x.get("agency_id") or "").strip()) or one or r["provider"]
            rk = " ".join(((x.get("route_short_name") or "").strip() or (x.get("route_long_name") or "").strip() or x["route_id"]).lower().split())
            route[x["route_id"]] = (ag, rk)
    bus_routes = set(route)
    cal = {c["service_id"]: c for c in rd("calendar.txt") if (c.get("service_id") or "").strip()}
    exc = collections.defaultdict(dict)
    for c in rd("calendar_dates.txt"):
        if ok8(c.get("date")) and (c.get("service_id") or "").strip():
            exc[c["date"]][c["service_id"]] = c.get("exception_type")
    dates = [c[k] for c in cal.values() for k in ("start_date", "end_date") if ok8(c.get(k))] + list(exc)
    if not dates or not bus_routes:
        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "why": "no bus routes" if not bus_routes else "no service dates"})
        return None
    lo = datetime.datetime.strptime(min(dates), "%Y%m%d").date(); hi = datetime.datetime.strptime(max(dates), "%Y%m%d").date()
    T = [(t.get("trip_id"), t.get("route_id"), t.get("service_id")) for t in rd("trips.txt") if t.get("route_id") in bus_routes and t.get("trip_id")]
    # selection 16: a schedule's end is the last date a service with bus trips runs, not the calendar's last date (Cherriots' copy has bus
    # trips to 3 May 2025 and a service without trips to 2 Jan 2026, and was measured on 30 Apr 2025 as if current)
    bus_sids = {sid for _, _, sid in T}
    # selection 18: a holiday swap (one bus service removed and another added on that date) extends nothing: Tri-Rail's copy 333 lists
    # holiday swaps to 25 Nov 2027, but its whole timetable ended on 12 Aug 2025
    last = [cal[x]["end_date"] for x in bus_sids if x in cal and ok8(cal[x].get("end_date"))] + [d for d, m in exc.items() if any(t == "1" and x in bus_sids for x, t in m.items())
            and not any(t == "2" and x in bus_sids for x, t in m.items())]
    hi_bus = datetime.datetime.strptime(max(last), "%Y%m%d").date() if last else lo
    if hi_bus < today - datetime.timedelta(days=365):   # the mirrored schedule ended over a year ago: too stale to describe service today
        hi = hi_bus
        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "copy": r.get("_copy"), "calendar_end": hi.isoformat(), "why": "schedule ended over a year ago"})
        bus_trips = {t["trip_id"]: route[t["route_id"]][0] for t in rd("trips.txt") if t.get("route_id") in bus_routes and t.get("trip_id")}
        stop_ags = collections.defaultdict(set)
        for st in rd("stop_times.txt"):
            a = bus_trips.get(st.get("trip_id"))
            if a: stop_ags[st.get("stop_id")].add(_agency_key(a))
        for x in rd("stops.txt"):   # where this operator's buses stop: evidence of service the current feeds may be missing
            if x.get("stop_id") in stop_ags and x.get("stop_lat") and x.get("stop_lon") and W <= float(x["stop_lon"]) <= E and S <= float(x["stop_lat"]) <= N:
                gap.append([float(x["stop_lon"]), float(x["stop_lat"]), r["provider"], frozenset(stop_ags[x["stop_id"]])])
        log("   gtfs stale, skipped", r["mdb_source_id"], r["provider"][:50], "calendar ends", hi); return None
    weds = [lo + datetime.timedelta(days=i) for i in range((hi - lo).days + 1) if (lo + datetime.timedelta(days=i)).weekday() == 2]
    if not weds:
        return None
    def active(d):
        ds = d.strftime("%Y%m%d")
        on = {sid for sid, c in cal.items() if c.get("wednesday") == "1" and (c.get("start_date") or "0") <= ds <= (c.get("end_date") or "99999999")}
        for sid, t in exc.get(ds, {}).items():
            if t == "1": on.add(sid)
            elif t == "2": on.discard(sid)
        return on
    # bus departures 07:00-09:00 per service, the quantity measured: they choose the representative Wednesday (_choose_wednesday)
    sid_of = {tid: sid for tid, _, sid in T}
    # selection 18: trips defined by headways (frequencies.txt) are expanded as in the measurement below, so that headway-based feeds
    # (Clovis Transit, Jump Around Carson, Georgia Tech's Stinger) record their real departures instead of 0 on every Wednesday
    hs_ = lambda v: sum(int(x_) * m_ for x_, m_ in zip(v.split(":"), (3600, 60, 1)))
    fq = collections.defaultdict(list)
    for f_ in rd("frequencies.txt"):
        try:
            if f_.get("trip_id") in sid_of and f_.get("start_time") and f_.get("end_time") and int(f_.get("headway_secs") or 0) > 0:
                fq[f_["trip_id"]].append((hs_(f_["start_time"]), hs_(f_["end_time"]), int(f_["headway_secs"])))
        except ValueError:
            continue
    per_sid = collections.Counter(); t0 = {}; ftimes = []
    for st in rd("stop_times.txt"):
        tid = st.get("trip_id"); x = sid_of.get(tid); tm = (st.get("departure_time") or st.get("arrival_time") or "").strip()
        if x is None or not tm:
            continue
        try:
            sec = hs_(tm)
        except ValueError:
            continue
        if tid in fq:
            ftimes.append((tid, x, sec)); t0[tid] = min(t0.get(tid, sec), sec)
        elif 25200 <= sec < 32400:
            per_sid[x] += 1
    for tid, x, sec in ftimes:
        for a_, b_, h_ in fq[tid]:
            per_sid[x] += sum(1 for k in range(int((b_ - a_) / h_) + 1) if a_ + k * h_ < b_ and 25200 <= a_ + sec - t0[tid] + k * h_ < 32400)
    ntrips = lambda d: sum(per_sid.get(x, 0) for x in active(d))
    day, wed_counts = _choose_wednesday(weds, ntrips, today); svc = active(day)
    bus_day = lambda s_: bool(s_ & bus_sids)   # selection 17: bus services, not those of the feed's trains or ferries
    if not bus_day(svc) and not any(abs((d - today).days) <= 21 for d in weds):   # a stale or future copy with no bus service that day:
        day = max(weds, key=ntrips); svc = active(day)                              # its busiest Wednesday
    elif not bus_day(svc):   # selection 16: the chosen Wednesday has no active bus service while some Wednesday of the calendar is within
        #                      three weeks of today: no buses now (it used to be measured on its busiest Wednesday ever: Tri-Rail's shuttle buses on 14 Aug 2024);
        #                      selection 17: the feed's other copies are then tried (fetch_gtfs_mdb), as for a stale copy
        skipped.append({"id": _nid(r["mdb_source_id"]), "provider": r["provider"], "copy": r.get("_copy"),
                        "why": NO_BUS_NEAR_TODAY, "calendar_end": hi.isoformat()})
        log("   gtfs no bus service near today", r["mdb_source_id"], r["provider"][:50]); return None
    trips = {tid: route[rid] for tid, rid, sid in T if sid in svc}   # trip -> (agency, route key) on the chosen weekday
    sids = collections.defaultdict(set)   # each route's and each agency's own service span (a combined feed's calendar is its widest agency's)
    for tid, rid, sid in T:
        sids[route[rid]].add(sid); sids[route[rid][0]].add(sid)
    span = {}
    for k, ss in sids.items():
        ds = [cal[s][f] for s in ss if s in cal for f in ("start_date", "end_date") if ok8(cal[s].get(f))]
        ds += [d for d, m in exc.items() if any(t == "1" and s in ss for s, t in m.items())]
        if ds:
            span[k] = (datetime.datetime.strptime(min(ds), "%Y%m%d").date(), datetime.datetime.strptime(max(ds), "%Y%m%d").date())
    rt_trips = collections.Counter(trips.values())
    freq = collections.defaultdict(list)
    for f in rd("frequencies.txt"):
        if f.get("trip_id") in trips:
            hs = lambda v: sum(int(x) * m for x, m in zip(v.split(":"), (3600, 60, 1)))
            freq[f["trip_id"]].append((hs(f["start_time"]), hs(f["end_time"]), int(f["headway_secs"] or 0)))
    stops = {x["stop_id"]: (float(x["stop_lon"]), float(x["stop_lat"]), x.get("stop_name", "")) for x in rd("stops.txt") if x.get("stop_lat") and x.get("stop_lon")}
    first = {}; per = collections.defaultdict(collections.Counter)   # (agency, route key) -> stop_id -> departures 07:00-09:00
    rows = [st for st in rd("stop_times.txt") if st.get("trip_id") in trips]
    # selection 17: a stop listed without a time (a non-timepoint between two timed stops, which GTFS leaves blank for the consumer to
    # interpolate) gets a time interpolated along its trip, by shape_dist_traveled where every stop of the trip has one, else by its
    # place in the stop sequence. On 8 Nov 2026, 126 of the 594 feeds the counties read left such stops blank (LYNX: 90% of its bus stop
    # times, so 568 of Orange County FL's 673 block groups showed no buses), and they counted no departures before.
    def tsec(t):
        try:
            return sum(int(x) * m for x, m in zip(t.split(":"), (3600, 60, 1))) if t else None
        except ValueError:
            return None
    def num(v, d=None):
        try:
            return float(v) if (v or "").strip() else d
        except ValueError:
            return d
    by_trip = collections.defaultdict(list)
    for st in rows:
        by_trip[st["trip_id"]].append(st)
    secs, n_interp = {}, 0
    for tid, sts in by_trip.items():
        sts.sort(key=lambda st: num(st.get("stop_sequence"), 0.0))
        tv = [tsec(st.get("departure_time") or st.get("arrival_time") or "") for st in sts]
        dist = [num(st.get("shape_dist_traveled")) for st in sts]
        use_d = all(d is not None for d in dist)
        timed = [i for i, v in enumerate(tv) if v is not None]
        for a, b in zip(timed, timed[1:]):
            for k in range(a + 1, b):
                f = (dist[k] - dist[a]) / (dist[b] - dist[a]) if use_d and dist[b] > dist[a] else (k - a) / (b - a)
                tv[k] = tv[a] + min(max(f, 0.0), 1.0) * (tv[b] - tv[a]); n_interp += 1
        for st, v in zip(sts, tv):
            if v is not None:
                secs[id(st)] = v
    for st in rows:
        sec = secs.get(id(st))
        if sec is not None and (st["trip_id"] not in first or sec < first[st["trip_id"]]): first[st["trip_id"]] = sec
    for st in rows:
        sec = secs.get(id(st))
        if sec is None:
            continue   # untimed before a trip's first or after its last timed stop: nothing to interpolate from
        rr = trips[st["trip_id"]]
        if st["trip_id"] in freq:   # frequency-based trip: departures = window start + offset + k * headway
            off = sec - first[st["trip_id"]]
            for a, b_, h in freq[st["trip_id"]]:
                if h > 0:
                    per[rr][st["stop_id"]] += sum(1 for k in range(int((b_ - a) / h) + 1) if a + k * h < b_ and 25200 <= a + off + k * h < 32400)
        elif 25200 <= sec < 32400:
            per[rr][st["stop_id"]] += 1
    pts = {}   # (agency, route key) -> {(lon, lat) rounded: [lon, lat, buses per hour, stop name]} for stops inside the county box
    for rr, cnt in per.items():
        for sid, n in cnt.items():
            if sid in stops:
                x, y, nm = stops[sid]
                if W <= x <= E and S <= y <= N:
                    d = pts.setdefault(rr, {}); k = (round(x, 5), round(y, 5)); prev = d.get(k)
                    d[k] = [x, y, round((prev[2] if prev else 0) + n / 2.0, 1), nm or (prev[3] if prev else "")]
    log("   gtfs", r["mdb_source_id"], r["provider"][:50], "weekday", day, "untimed stop times interpolated", n_interp, "bus stops served 7-9am in county", len({k for d in pts.values() for k in d}),
        "routes", len(pts), "agencies", sorted({a for a, _ in pts})[:6])
    return {"r": r, "weekday": day, "wednesdays": wed_counts, "interpolated": n_interp, "lo": lo, "hi": hi, "pts": pts, "span": span, "rt_trips": rt_trips, "n_agencies": len({a for a, _ in route.values()}),
            "agencies": {_agency_key(a) for (a, _), n in rt_trips.items() if n}}   # this provider is covered; deprecated fallbacks are not needed

STATE_NAMES = dict(zip("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(),
    ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii",
     "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
     "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
     "Oregon", "Pennsylvania", "Puerto Rico", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
     "West Virginia", "Wisconsin", "Wyoming"]))


def ld_json(name):
    p = os.path.join(DATA, name)
    return json.load(open(p)) if os.path.exists(p) else None


def mdb_index():
    """feed id -> object name in the mdb-latest bucket (the catalog's urls.latest is sometimes out of date: e.g. SFMTA 2886), cached daily"""
    import re
    p = os.path.join(SHARED, "mdb", "latest_index.json")
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < 86400:
        return json.load(open(p))
    idx, tok = {}, None
    while True:
        q = {"maxResults": "1000", "fields": "nextPageToken,items(name,updated)"}
        if tok: q["pageToken"] = tok
        d = json.loads(get("https://storage.googleapis.com/storage/v1/b/mdb-latest/o", q, timeout=300))
        for it in d.get("items", []):
            m = re.search(r"-gtfs-(\d+)\.zip$", it["name"])
            if m: idx[m.group(1)] = {"name": it["name"], "updated": (it.get("updated") or "")[:10]}
        tok = d.get("nextPageToken")
        if not tok: break
    os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(idx, open(p, "w"))
    return idx


MDB_CSV2 = "https://storage.googleapis.com/mobilitydata-datasets-prod/feeds_v2.csv"   # MobilityData's current catalog export (files.mobilitydatabase.org/feeds_v2.csv)


def mdb_catalog_rows(cat_p):
    """US GTFS rows of MobilityData's legacy catalog (mdb-csv/sources.csv) merged with its current export (feeds_v2.csv, refreshed daily).
    Ids are normalised ("mdb-75" is "75"). A row in both keeps its legacy status, so feeds the legacy catalog marked inactive stay out, and
    takes the current export's bounding box, redirect and download URL where that has one. Rows only in the current export are added
    unless they are inactive or in development (selection 19: 'future' rows too, since that status dates from MobilityData's last
    processing: CamTran's tld-4671, current since 6 Nov 2026). Example: York's rabbittransit, current only as tld-223."""
    p2 = os.path.join(SHARED, "mdb", "feeds_v2.csv")
    if not os.path.exists(p2) or time.time() - os.path.getmtime(p2) > 86400:
        try:
            b = get(MDB_CSV2, binary=True, timeout=600)
            if b.lstrip(b"\xef\xbb\xbf").startswith(b"id,"):
                tmp = f"{p2}.{os.getpid()}.tmp"; open(tmp, "wb").write(b); os.replace(tmp, p2)
        except Exception as e:
            log("  feeds_v2.csv not refreshed:", repr(e)[:120])
    us = lambda r: r.get("data_type") == "gtfs" and r.get("location.country_code") == "US"
    rows = collections.OrderedDict()
    for r in csv.DictReader(open(cat_p, encoding="utf-8")):
        if us(r):
            r["mdb_source_id"] = _nid(r["mdb_source_id"]); r["_catalog"] = "legacy"; rows[r["mdb_source_id"]] = r
    if os.path.exists(p2):
        BOX = [f"location.bounding_box.{k}" for k in ("minimum_longitude", "minimum_latitude", "maximum_longitude", "maximum_latitude")]
        for r in csv.DictReader(open(p2, encoding="utf-8-sig")):
            if not us(r):
                continue
            fid = _nid(r.get("id"))
            if fid in rows:
                old = rows[fid]
                if all((r.get(k) or "").strip() for k in BOX):
                    for k in BOX:
                        old[k] = r[k]
                for k in ("redirect.id", "urls.direct_download"):
                    if (r.get(k) or "").strip():
                        old[k] = r[k]
                old["_catalog"] = "legacy+v2"
            elif r.get("status") not in ("inactive", "development"):   # selection 19: 'future' is MobilityData's status when it last
                #   processed the feed (CamTran's tld-4671 is 'future', but its calendar began on 6 Nov 2026); the transit step reads the calendar
                r = dict(r); r["mdb_source_id"] = fid; r.pop("id", None); r["_catalog"] = "v2"; rows[fid] = r
    return list(rows.values())


def feed_box(fid):
    """west, south, east, north of a feed's stops, read from MobilityData's hosted copy, for catalog rows that carry no bounding box (e.g.
    Winston-Salem Transit 3479, Galveston Island Transit 2861). Cached in cache/mdb/feed_boxes.json: 30 days, 1 day when the copy could not
    be read."""
    p = os.path.join(SHARED, "mdb", "feed_boxes.json")
    c = json.load(open(p)) if os.path.exists(p) else {}
    e = c.get(fid)
    if e and time.time() - e.get("t", 0) < (30 if e.get("box") else 1) * 86400:
        return e.get("box")
    box, why = None, ""
    try:
        z = zipfile.ZipFile(io.BytesIO(get(f"{MDB_HOSTED}/{'mdb-' + fid if fid.isdigit() else fid}/latest.zip", binary=True, timeout=900, retries=2)))
        nm = next((n for n in sorted(z.namelist()) if n.rsplit("/", 1)[-1].lower() in ("stops.txt", "stops.csv")), None)
        xs, ys = [], []
        for row in (csv.DictReader(io.TextIOWrapper(z.open(nm), encoding="utf-8-sig")) if nm else []):
            row = {(k or "").strip(): v for k, v in row.items()}
            try:
                x, y = float((row.get("stop_lon") or "").strip()), float((row.get("stop_lat") or "").strip())
            except (ValueError, AttributeError):
                continue
            if -180 <= x <= 180 and -90 <= y <= 90 and (x, y) != (0.0, 0.0):
                xs.append(x); ys.append(y)
        if xs:
            box = [min(xs), min(ys), max(xs), max(ys)]
        else:
            why = "no stops"
    except Exception as ex:
        why = repr(ex)[:80]
    c = json.load(open(p)) if os.path.exists(p) else {}   # read again: another county's build may have added entries meanwhile
    c[fid] = {"box": box, "t": time.time(), **({"why": why} if why else {})}
    os.makedirs(os.path.dirname(p), exist_ok=True); tmp = f"{p}.{os.getpid()}.tmp"; json.dump(c, open(tmp, "w")); os.replace(tmp, p)
    log("   feed box", fid, box or why)
    return box


def fetch_gtfs_mdb():
    """Every county without its own feed: GTFS feeds from the MobilityData catalog whose bounding box overlaps the county (active, or
    marked 'future' since selection 19; deprecated or redirected copies only as fallbacks; not demand-response 'Flex', not a
    demonstration feed, not multi-state), one per provider; a catalog row
    without a box is placed by its own stops. Bus departures 07:00-09:00 per stop on one representative weekday per feed, chosen by
    _choose_wednesday (a Wednesday within three weeks of today, fixed-date holidays excluded, at full weekday service; for a copy with
    none, the Wednesdays around its own nearest Wednesday with departures), with
    calendar_dates exceptions, headway trips (frequencies.txt) and untimed stops interpolated. A feed is counted once (MobilityData writes some
    ids two ways, '75' and 'mdb-75'), and so is each bus route: when two feeds carry the same route, its buses come from one of them (see
    the merge below). Output transit_stops_7_9.json: [lon, lat, buses per hour, stop name] for stops inside the county box
    (+0.02 degree)."""
    import datetime, re
    meta_p = os.path.join(DATA, "transit_stops_7_9.meta.json")
    if have("transit_stops_7_9.json") and os.path.exists(meta_p) and json.load(open(meta_p)).get("selection") == GTFS_SELECTION:
        return
    cat_p = os.path.join(SHARED, "mdb", "sources.csv")
    if not os.path.exists(cat_p):
        os.makedirs(os.path.dirname(cat_p), exist_ok=True); open(cat_p, "wb").write(get(MDB_CSV, binary=True, timeout=600))
    W, S, E, N = county_bbox(); W -= .02; S -= .02; E += .02; N += .02
    IDX = mdb_index()
    PLACE_NAMES = {(f["properties"].get("BASENAME") or f["properties"].get("NAME") or "").strip().lower() for f in ((ld_json("places.geojson") or {}).get("features") or [])}
    by_provider = collections.OrderedDict()   # provider -> candidate feeds: active ones first, then deprecated mirrors as a fallback
    ROWS = mdb_catalog_rows(cat_p)   # legacy catalog + MobilityData's current export (selection 8)
    CAT = {r["mdb_source_id"]: r for r in ROWS}
    for r in [dict(x) for x in ROWS]:
        if (r.get("status") in ("inactive", "development")   # selection 19: 'future' rows are read, their calendars judged as any feed's
                or "flex" in (r.get("name") or "").lower()
                or re.search(r"\bdemo\b", f"{r.get('provider') or ''} {r.get('name') or ''}".lower())):   # e.g. Sunny Valley Transit (Demo) 3473
            continue
        try:
            b = [float(r[f"location.bounding_box.{k}"]) for k in ("minimum_longitude", "minimum_latitude", "maximum_longitude", "maximum_latitude")]
        except (KeyError, ValueError):   # no bounding box in the catalog: the box of the feed's own stops
            b = feed_box(r["mdb_source_id"])
        if b is not None:
            if b[2] < W or b[0] > E or b[3] < S or b[1] > N or (b[2] - b[0]) * (b[3] - b[1]) > 20:   # no overlap, or multi-state (Amtrak, intercity coaches)
                continue
        else:   # no box at all (no hosted copy to read, e.g. SFMTA 2886): same state, or no state and a municipality in this county
            sub = (r.get("location.subdivision_name") or "").strip()
            mun = re.sub(r"^(city|town|village|borough|county) of ", "", (r.get("location.municipality") or "").strip().lower())
            if not (sub == STATE_NAMES.get(region.STATE) or (not sub and mun and (mun in PLACE_NAMES or mun == region.SHORT.lower()))):
                continue
        r["_dep"] = r.get("status") == "deprecated" or bool((r.get("redirect.id") or "").strip())
        # one feed per provider AND feed name: agencies such as MTA publish several feeds under one provider (Brooklyn Bus, Queens Bus, ...)
        cands = by_provider.setdefault((r["provider"].strip().lower(), (r.get("name") or "").strip().lower()), [])
        for red in [_nid(x) for x in re.split(r"[|,;\s]+", r.get("redirect.id") or "") if x.strip()]:
            if not any(c["mdb_source_id"] == red for c in cands):
                # the feed has moved to another id in MobilityData's current catalog: try that first. Examples: JTA 346 -> tld-764, Butte's
                # B-Line 241 -> ntd-90208, County Connection 1243 -> 2421 (whose own catalog row is filed under Tennessee, so the box test misses it)
                cands.append({**r, "mdb_source_id": red, "_dep": False, "_tld": True, "redirect.id": ""})
        cands.append(r)
    feeds = [sorted(c, key=lambda r: (r["_dep"], not r.get("_tld"), -int(r["mdb_source_id"]) if r["mdb_source_id"].isdigit() else 0)) for c in by_provider.values()]
    today = datetime.date.today(); used, skipped, gap, results, tried, rail = [], [], [], [], {}, []; no_stops_here = []
    for cands in feeds:
      for r in cands:
        fid = r["mdb_source_id"]
        if fid in tried:   # the same feed under another catalog entry: read once, counted once
            if tried[fid]:
                break
            continue
        tried[fid] = False
        # MobilityData's current hosted copy first (mdb-<id> or the tld-<id> a deprecated feed redirects to), then the legacy mirror, then,
        # when both are stale or missing, the operator's own download URL from the catalog where this environment can reach it (e.g.
        # Westchester's Bee-Line on NYSDOT's 511NY bucket, s3.amazonaws.com/datatools-511ny: current while both MobilityData copies ended
        # in 2025)
        srcs = [("hosted", f"{MDB_HOSTED}/{'mdb-' + fid if fid.isdigit() else fid}/latest.zip")]
        if fid in IDX:
            srcs.append(("legacy mirror", f"https://storage.googleapis.com/storage/v1/b/mdb-latest/o/{IDX[fid]['name']}?alt=media"))
        arch = (CAT.get(fid, {}).get("urls.latest") or "").strip()
        if fid.startswith("tfs-") and arch.startswith("https://openmobilitydata-data.s3"):
            srcs.append(("TransitFeeds archive", arch))
        prod = (CAT.get(fid, {}).get("urls.direct_download") or "").strip()
        if prod.startswith(("http://", "https://")):
            srcs.append(("producer URL", prod))
        res = None; errs = []; read_any = False
        for kind, url in srcs:
            try:
                z = zipfile.ZipFile(io.BytesIO(get(url, binary=True, timeout=900, retries=1 if kind == "producer URL" else 3)))
            except Exception as e:
                errs.append(f"{kind}: {repr(e)[:50]}"); continue
            read_any = True; r["urls.latest"] = url; r["_copy"] = kind
            names = set(z.namelist())
            alias = {}   # some agencies zip their tables in a subfolder or as .csv (BJCTA 3434: google_transit_Working.zip/routes.csv)
            for nm in sorted(names):
                base, dot, ext = nm.rsplit("/", 1)[-1].rpartition(".")
                if dot and base and ext.lower() in ("txt", "csv"):
                    alias.setdefault(base.lower() + ".txt", nm)
            def rd(n, z=z, names=names, alias=alias):   # header names stripped (some feeds pad them with spaces)
                m = n if n in names else alias.get(n.lower())
                if not m:
                    return []
                return ({(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
                        for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
            n_sk = len(skipped)
            try:
                _rail_stops(r, rd, W, S, E, N, rail)
            except Exception as e:
                log("   rail stops unreadable", fid, repr(e)[:80])
            try:
                res = _gtfs_feed(r, rd, W, S, E, N, today, skipped, gap)
            except Exception as e:
                skipped.append({"id": fid, "provider": r["provider"], "copy": kind, "why": "feed could not be read (" + repr(e)[:60] + ")"})
                log("   gtfs feed unreadable", fid, kind, r["provider"][:40], repr(e)[:80]); continue
            if res is not None:
                break
            if not (len(skipped) > n_sk and skipped[-1].get("why") in ("schedule ended over a year ago", NO_BUS_NEAR_TODAY)):
                break   # no bus routes or no dates: a property of the feed, not of this copy
        if not read_any:
            skipped.append({"id": fid, "provider": r["provider"], "why": "no copy could be downloaded (" + "; ".join(errs)[:160] + ")"})
            log("   gtfs no copy", fid, r["provider"][:40]); continue
        if res is not None:
            tried[fid] = True; results.append(res)
            break   # this provider is covered; deprecated fallbacks are not needed

    # each bus route once. Two feeds can carry the same buses: King County Metro's own feed under two ids (267, 1330) and again in the Puget
    # Sound consolidated feed (1080); RABA's December-May schedule and its current one (2852, 3031); Trinity Metro as 885 and 2890. Other
    # feeds share only an agency's name: Sound Transit's express routes appear in the feeds of King County Metro, Pierce Transit and
    # Community Transit, each with the routes it operates. So:
    #  1. a schedule of an agency that no longer (or not yet) runs today is dropped when another feed has that agency's current schedule;
    #  2. each route (agency + route number) is counted from one feed: the one whose service for that route includes today, then the most
    #     specific (fewest agencies: an agency's own feed before a regional aggregate), then the newer schedule (later start), then the later
    #     end of its service, then more trips.
    # Either way the two copies must stop at the same places (20% of stops within about 100 m); otherwise both are kept.
    covers = lambda sp: sp is not None and sp[0] <= today <= sp[1]
    def rank(res, rr):   # covers today; most specific; the newer schedule (later start: Brockton's own BAT feed 422, issued 27 Feb 2026,
        # before NTD's copy ntd-10004 whose calendar runs 2021-2027); then the later end; then more trips
        sp = res["span"].get(rr)
        return (covers(sp), -res["n_agencies"], sp[0] if sp else res["lo"], sp[1] if sp else res["hi"], res["rt_trips"].get(rr, 0))
    def stops_of(res, ag):
        d = {}
        for (a, rk), v in res["pts"].items():
            if a == ag: d.update(v)
        return d
    by_ag = collections.defaultdict(list)   # agency key -> [(result, (agency, route key))]
    for res in results:
        for rr in res["pts"]:
            by_ag[_agency_key(rr[0])].append((res, rr))
    drop = {}   # (feed id, (agency, route key)) -> (why, feed id it is counted from)
    for a, lst in by_ag.items():
        fe = collections.OrderedDict()
        for res, rr in lst:
            fe.setdefault(res["r"]["mdb_source_id"], (res, rr[0]))
        if len(fe) < 2:
            continue
        cur = [fid for fid, (res, ag) in fe.items() if covers(res["span"].get(ag))]
        if cur:   # 1. superseded schedules
            cur_stops = {}
            for fid in cur:
                cur_stops.update(stops_of(*fe[fid]))
            for fid, (res, ag) in fe.items():
                if fid not in cur and _overlap(stops_of(res, ag), cur_stops) >= 0.2:
                    for rr in res["pts"]:
                        if rr[0] == ag: drop[(fid, rr)] = ("superseded", cur[0])
    # 2. each route once, across agency names too: the same route number at the same stops under two names is one route (Lower Hudson
    #    Transit Link's routes H01-H07X appear as agency "LHTL" in feed 915 and as "Hudson Link" in feed 2312). The same agency needs 20%
    #    of stops in common, two names 80%.
    by_rk = collections.defaultdict(list)
    for res in results:
        for rr in res["pts"]:
            if (res["r"]["mdb_source_id"], rr) not in drop:
                by_rk[rr[1]].append((res, rr))
    for rk, l2 in by_rk.items():
        if len(l2) < 2:
            continue
        l2.sort(key=lambda t: rank(*t), reverse=True); kept = [l2[0]]
        for res, rr in l2[1:]:
            k = next((k for k in kept if k[0] is not res and _overlap(res["pts"][rr], k[0]["pts"][k[1]]) >= (0.2 if _agency_key(k[1][0]) == _agency_key(rr[0]) else 0.8)), None)
            if k is None:
                kept.append((res, rr))
            else:
                drop[(res["r"]["mdb_source_id"], rr)] = ("route", k[0]["r"]["mdb_source_id"])
    # audit, not a rule: one route number under two agency names sharing 50-80% of its stops is flagged in the metadata for review; both kept
    flags = []
    by_rk_all = collections.defaultdict(list)
    for res in results:
        for rr in res["pts"]:
            if (res["r"]["mdb_source_id"], rr) not in drop:
                by_rk_all[rr[1]].append((res, rr))
    for rk, l in by_rk_all.items():
        for i in range(len(l)):
            for j in range(i + 1, len(l)):
                (r1, a1), (r2, a2) = l[i], l[j]
                if r1 is not r2 and _agency_key(a1[0]) != _agency_key(a2[0]) and _overlap(r1["pts"][a1], r2["pts"][a2]) >= 0.5:
                    flags.append([r1["r"]["mdb_source_id"], a1[0], r2["r"]["mdb_source_id"], a2[0], rk])
    out = {}
    for res in results:
        r = res["r"]; fid = r["mdb_source_id"]; keys = set(); mine = set(); notes = collections.Counter()
        for rr, d in sorted(res["pts"].items()):
            if (fid, rr) in drop:
                why, src = drop[(fid, rr)]; notes[(rr[0], why, src)] += 1; continue
            mine.add(rr[0])
            for k, (x, y, n, nm) in d.items():
                prev = out.get(k)
                out[k] = [x, y, round((prev[2] if prev else 0) + n, 1), nm or (prev[3] if prev else "")]; keys.add(k)
        other = [f"{ag}: " + (f"schedule superseded by the current one in feed {src}" if why == "superseded" else f"{c} route{'s' if c > 1 else ''} counted from feed {src}")
                 for (ag, why, src), c in sorted(notes.items())]
        if keys:
            used.append({"id": fid, "provider": r["provider"], "url": r["urls.latest"], "copy": r.get("_copy"), "weekday": res["weekday"].isoformat(),
                         "wednesdays_7_9am_departures": res.get("wednesdays"), "untimed_stop_times_interpolated": res.get("interpolated"), "calendar": [res["lo"].isoformat(), res["hi"].isoformat()], "stops": len(keys), "agencies": sorted(mine),
                         **({"counted_from_another_feed": other} if other else {}), **({"deprecated_in_catalog": True} if r["_dep"] else {})})
        elif other:
            skipped.append({"id": fid, "provider": r["provider"], "why": "its routes are counted from other feeds: " + "; ".join(other)[:240]})
        else:   # read, with service, but no stop of its bus routes in this county that day: recorded so that audits see the feed
            no_stops_here.append({"id": fid, "provider": r["provider"], "url": r["urls.latest"], "copy": r.get("_copy"), "weekday": res["weekday"].isoformat(),
                                  "wednesdays_7_9am_departures": res.get("wednesdays"), "calendar": [res["lo"].isoformat(), res["hi"].isoformat()]})
    # a stale feed's stops are no gap where a current feed of the same agency is read (even one with no stops left in this county)
    running = {a for res in results for a in res["agencies"]}
    gap = list({(round(g[0], 6), round(g[1], 6), g[2]): g[:3] for g in gap if not (g[3] and g[3] <= running)}.values())

    try:   # Amtrak's stations (its national feed is left out of the bus selection as multi-state)
        z = zipfile.ZipFile(io.BytesIO(get(f"{MDB_HOSTED}/mdb-{AMTRAK_ID}/latest.zip", binary=True, timeout=600, retries=2)))
        nm = {n.rsplit("/", 1)[-1].lower(): n for n in z.namelist()}
        rda = lambda n: ({(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()} for row in csv.DictReader(io.TextIOWrapper(z.open(nm[n]), encoding="utf-8-sig"))) if n in nm else iter(())
        _rail_stops({"mdb_source_id": AMTRAK_ID}, rda, W, S, E, N, rail)
    except Exception as e:
        log("   Amtrak stations not read:", repr(e)[:100])
    rail = list({(round(p[0], 5), round(p[1], 5)): p for p in rail}.values())
    save("transit_rail_stops.json", json.dumps(rail))   # stops of rail routes (current and stale feeds, Amtrak): confirm OSM rail stations
    save("transit_stops_7_9.json", json.dumps(list(out.values())))
    save("transit_gap_stops.json", json.dumps(gap))   # bus stops of operators whose usable schedule is missing (stale or no mirror)
    json.dump({"source": "MobilityData catalogs " + MDB_CSV + " and " + MDB_CSV2 + "; feeds from MobilityData's hosted copies (" + MDB_HOSTED + ") or its legacy mirror, or the operator's own URL from the catalog when both are stale", "downloaded": time.strftime("%Y-%m-%d"), "feeds": used, "skipped": skipped, "read_no_stops_here": no_stops_here, "gap_stops": len(gap), "selection": GTFS_SELECTION, "stops": len(out),
               "possible_duplicate_routes": len(flags), "possible_duplicate_route_examples": flags[:40],
               "method": "bus departures 07:00-09:00 per stop on one representative weekday per feed, divided by 2 (buses per hour); each feed and each bus route counted once"}, open(meta_p, "w"))
    log("  transit (MobilityData):", len(used), "feeds,", len(out), "stops"); manifest("transit_stops_7_9.json", MDB_CSV, len(out), "; ".join(u["provider"] for u in used)[:300])

def fetch_gtfs():
    if not GTFS_URL:
        return fetch_gtfs_mdb()
    meta_p = os.path.join(DATA, "octa_stops_7_9.meta.json")
    if have("octa_stops_7_9.json") and os.path.exists(meta_p) and json.load(open(meta_p)).get("url") == GTFS_URL:
        return
    b = get(GTFS_URL, binary=True)
    save("octa_gtfs.zip", b, binary=True)
    z = zipfile.ZipFile(io.BytesIO(b))
    rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8-sig")))
    stops = {s["stop_id"]: (float(s["stop_lon"]), float(s["stop_lat"]), s.get("stop_name", "")) for s in rd("stops.txt")}
    cal = {c["service_id"]: c for c in rd("calendar.txt")} if "calendar.txt" in z.namelist() else {}
    weekday = {sid for sid, c in cal.items() if c.get("wednesday") == "1"} or set(cal)
    trips = {t["trip_id"]: t for t in rd("trips.txt") if not weekday or t["service_id"] in weekday}
    per_stop = {}
    for st in rd("stop_times.txt"):
        if st["trip_id"] not in trips:
            continue
        hh = st.get("departure_time") or st.get("arrival_time") or ""
        try:
            h = int(hh.split(":")[0])
        except Exception:
            continue
        if 7 <= h < 9:
            per_stop[st["stop_id"]] = per_stop.get(st["stop_id"], 0) + 1
    out = [[stops[s][0], stops[s][1], round(n / 2.0, 1), stops[s][2]] for s, n in per_stop.items() if s in stops]   # buses per hour over the 2-hour window
    dates = sorted({c.get("start_date") for c in cal.values()} | {c.get("end_date") for c in cal.values()})
    save("octa_stops_7_9.json", json.dumps(out)); log("  GTFS calendar range", dates[:1], dates[-1:], "stops with 7-9am service", len(out))
    json.dump({"url": GTFS_URL, "downloaded": time.strftime("%Y-%m-%d"), "calendar_start": dates[0] if dates else None, "calendar_end": dates[-1] if dates else None, "stops": len(out)}, open(meta_p, "w"))
    manifest("octa_gtfs.zip", GTFS_URL, len(out), f"GTFS calendar {dates[0] if dates else '?'}-{dates[-1] if dates else '?'}; rows = stops with weekday 7-9 am departures")


# ---------------- 7. Schools (CDE), fire zones (CAL FIRE), EV chargers (AFDC) ----------------
def fetch_schools():
    if region.STATE != "CA":   # NCES EDGE public school locations (current school year), this county only
        if have("nces_schools.geojson"):
            return
        url = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0"
        feats = arcgis_query(url, where=f"CNTY='{region.FIPS}'", fields="NCESSCH,NAME,CITY,STATE,CNTY,LAT,LON,SCHOOLYEAR", use_bbox=False)
        json.dump({"type": "FeatureCollection", "features": feats, "source": url, "downloaded": time.strftime("%Y-%m-%d")}, open(os.path.join(DATA, "nces_schools.geojson"), "w"))
        log("saved nces_schools.geojson", len(feats)); manifest("nces_schools.geojson", url, len(feats), "NCES EDGE public school locations (current)")
        return
    if have("cde_schools.txt"):
        return
    save("cde_schools.txt", get("https://www.cde.ca.gov/SchoolDirectory/report?rid=dl1&tp=txt", timeout=900))


def fetch_fire_ev():
    if region.STATE == "CA":   # CAL FIRE hazard zones exist only for California; elsewhere fire stays absent (no national share layer yet)
        fetch_arcgis_geojson("fire_sra.geojson", "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0")
        fetch_arcgis_geojson("fire_lra.geojson", "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0")
    # Round 5: the USDOT/BTS National Transportation Atlas copy of the AFDC station list (updated daily, unrestricted public use) needs
    # no API key. Public, available stations with DC fast ports, saved in the AFDC API's shape so metrics_oc.py reads it unchanged.
    if not have("afdc_dcfc.json"):
        u = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/Alternative_Fueling_Stations/FeatureServer/0"
        w_, s_, e_, n_ = county_bbox()
        where = f"fuel_type_code='ELEC' AND access_code='public' AND status_code='E' AND ev_dc_fast_num>0 AND latitude>{s_ - .1} AND latitude<{n_ + .1} AND longitude>{w_ - .1} AND longitude<{e_ + .1}"
        rows, off = [], 0
        while True:
            j = json.loads(get(f"{u}/query", {"where": where, "outFields": "id,station_name,street_address,city,ev_dc_fast_num,ev_level2_evse_num,latitude,longitude,date_last_confirmed", "returnGeometry": "false", "f": "json", "resultOffset": off, "resultRecordCount": 2000, "orderByFields": "OBJECTID"}))
            got = [f["attributes"] for f in j.get("features", [])]; rows += got; off += len(got)
            if len(got) < 2000: break
        meta = json.loads(get(u, {"f": "json"}))
        save("afdc_dcfc.json", json.dumps({"source": u, "downloaded": time.strftime("%Y-%m-%d"), "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate"), "fuel_stations": rows}))
        manifest("afdc_dcfc.json", u, len(rows), "public, available DC fast-charging stations (AFDC via USDOT/BTS NTAD)")
    key = os.environ.get("NREL_API_KEY")
    if key and not have("afdc_dcfc.json"):
        save("afdc_dcfc.json", get("https://developer.nrel.gov/api/alt-fuel-stations/v1.json", {"fuel_type": "ELEC", "state": "CA", "ev_charging_level": "dc_fast", "status": "E", "access": "public", "limit": "all", "api_key": key}))


# ---------------- 8. CCRS crashes (CHP via data.ca.gov datastore) ----------------
CCRS = {"2025": "9f4fc839-122d-4595-a146-43bc4ed16f46", "2024": "f775df59-b89b-4f82-bd3d-8807fa3a22a0", "2023": "436642c0-cd04-4a4c-b45e-564b66437476",
        "2022": "7828780b-117b-455e-9275-986ad3ffde50", "2021": "d08692e2-6d36-487e-bca0-28cd127a626f", "2020": "a2e0605d-0695-4bce-806d-4d0dda7ace68",
        "2019": "2b4c7d03-e684-435e-80da-17935de9499f", "2018": "a4b57216-5110-43d3-884c-d95366b19158", "2017": "4784664d-b7cf-4427-af25-7c7307bad56c", "2016": "3d5f2586-cf68-4213-aa1c-60df37399d10"}
CCRS_IWP = {"2025": "10184ea3-7411-42d8-87a6-17039b58f04b", "2024": "a36a0078-d7e1-4244-8337-0a59433c9b84", "2023": "1dfc36fa-a5dd-4616-b9b0-ff55699e299a",
            "2022": "2d9e8bef-d5a2-402e-82eb-6386ad4d09f7", "2021": "616a9850-27cb-4012-b6e7-90a2e495900a", "2020": "459a4ce9-2a2a-4c50-a3fc-cfd6d4cbfa6e",
            "2019": "8ad780b4-0a05-4258-a461-57254888eb1a", "2018": "ca547c12-f64d-4b6a-8f25-7075f6d6ec0b", "2017": "fcb4f72e-db37-4379-8b78-25aad557d6cb", "2016": "ea0bb73d-c41c-4d15-8a88-0c2a51fcd33a"}
CCRS_COLS = '"Collision Id","Latitude","Longitude","NumberKilled","NumberInjured","MotorVehicleInvolvedWithDesc","PedestrianActionDesc","City Name","Crash Date Time"'


FARS = {2023: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Fatality_Analysis_Reporting_System_FinalRelease_Accidents/FeatureServer/0",
        2024: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Fatality_Analysis_Reporting_System_InitialRelease_Accidents/FeatureServer/0"}


def fetch_fars():
    """NHTSA FARS fatal crashes via the USDOT/BTS NTAD copies (2023 final release, 2024 initial release), this county only.
    Fatal crashes only: not a substitute for state injury-crash records (California uses CCRS)."""
    fields = "ST_CASE,STATE,COUNTY,YEAR,MONTH,DAY,HOUR,PEDS,PERSONS,FATALS,LATITUDE,LONGITUD,HARM_EV,HARM_EVNAME,TWAY_ID,TWAY_ID2,RUR_URBNAME,FUNC_SYSNAME,TYP_INTNAME"
    for yr, url in FARS.items():
        name = f"fars_{yr}.json"
        if have(name):
            continue
        if region.STATE_FIPS == "09":   # FARS still codes Connecticut's old counties; the planning regions (2022) are selected by location
            from shapely.geometry import shape as _shape, Point as _Pt
            from shapely.ops import unary_union as _union
            area = _union([_shape(f["geometry"]).buffer(0) for f in json.load(open(os.path.join(DATA, "bg.geojson")))["features"]])
            feats = [f for f in arcgis_query(url, where="STATE=9", fields=fields, use_bbox=True)
                     if f.get("geometry") and area.contains(_Pt(*f["geometry"]["coordinates"][:2]))]
        else:
            feats = arcgis_query(url, where=f"STATE={int(region.STATE_FIPS)} AND COUNTY={int(region.COUNTY_FIPS)}", fields=fields, use_bbox=False)
        meta = json.loads(get(url, {"f": "json"}))
        json.dump({"source": url, "release": "final" if "FinalRelease" in url else "initial", "downloaded": time.strftime("%Y-%m-%d"),
                   "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate"), "rows": [f["properties"] for f in feats]},
                  open(os.path.join(DATA, name), "w"))
        log("saved", name, len(feats), "fatal crashes"); manifest(name, url, len(feats), f"NHTSA FARS {yr} fatal crashes (USDOT/BTS NTAD)")


def fetch_local_crashes():
    """County-specific crash reports where a county publishes them (region.COUNTY_OVERRIDES[...]['crashes']); 2016-2025 to match CCRS.
    Saved compact: rows [id, lat, lon, killed, seriously_injured, pedestrian(0/1), bicycle(0/1), 'YYYY-MM-DD']."""
    c = region.OV.get("crashes")
    if not c or have("crashes_local.json"):
        return
    if c["kind"] == "sf_datasf":
        return fetch_local_crashes_sf(c)
    if c["kind"] in ("il_idot", "va_vdot"):
        return fetch_state_crashes(c)
    if c["kind"] == "arcgis_map":
        return fetch_state_crashes_map(c)
    if c["kind"] != "denver_dpd":
        log("  local crashes: no reader for", c["kind"]); return
    rows, off = [], 0
    where = "first_occurrence_date >= DATE '2016-01-01' AND first_occurrence_date < DATE '2026-01-01'"
    n = json.loads(get(f"{c['url']}/query", {"where": where, "returnCountOnly": "true", "f": "json"}))["count"]
    while off < n:
        j = json.loads(get(f"{c['url']}/query", {"where": where, "outFields": "object_id,first_occurrence_date,geo_lat,geo_lon,pedestrian_ind,bicycle_ind,SERIOUSLY_INJURED,FATALITIES",
                                                 "returnGeometry": "false", "f": "json", "resultOffset": off, "resultRecordCount": 2000, "orderByFields": "object_id"}, timeout=900))
        got = [f["attributes"] for f in j.get("features", [])]
        if not got:
            break
        for a in got:
            d = time.strftime("%Y-%m-%d", time.gmtime((a.get("first_occurrence_date") or 0) / 1000))
            rows.append([a["object_id"], a.get("geo_lat"), a.get("geo_lon"), int(a.get("FATALITIES") or 0), int(a.get("SERIOUSLY_INJURED") or 0),
                         1 if (a.get("pedestrian_ind") or 0) > 0 else 0, 1 if (a.get("bicycle_ind") or 0) > 0 else 0, d])
        off += len(got)
        if off % 20000 < 2000: log("   local crashes", off, "of", n)
    assert len(rows) == n, (len(rows), n)
    meta = json.loads(get(c["url"], {"f": "json"}))
    json.dump({"kind": c["kind"], "name": c["name"], "source": c["url"], "downloaded": time.strftime("%Y-%m-%d"),
               "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate"), "rows": rows}, open(os.path.join(DATA, "crashes_local.json"), "w"))
    log("saved crashes_local.json", len(rows)); manifest("crashes_local.json", c["url"], len(rows), c["name"] + " 2016-2025")


def fetch_state_crashes(c):
    """State DOT crash records (all reportable crashes) inside the county box, 2016-2025 where published. Rows:
    [id, lat, lon, killed, serious ('A') injuries, pedestrian(0/1), bicycle(0/1), 'YYYY-MM-DD', persons injured] - the 9th field lets
    the site screens keep injury and fatal crashes the way they do with CCRS."""
    W, S, E, N = county_bbox()
    geo = {"geometry": f"{W},{S},{E},{N}", "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects"}
    jobs = ([(y, u, "1=1") for y, u in sorted(c["layers"].items())] if c["kind"] == "il_idot"
            else [(None, c["url"], f"CRASH_YEAR >= '{c['years'][0]}' AND CRASH_YEAR <= '{c['years'][1]}'")])
    rows = []
    for yr, url, where in jobs:
        if c["kind"] == "il_idot":
            fields = "OBJECTID,CrashID,CrashDate,TotalFatals,AInjuries,TotalInjured,TypeOfFirstCrash,TSCrashLatitude,TSCrashLongitude"
        else:
            fields = "OBJECTID,DOCUMENT_NBR,CRASH_DT,K_PEOPLE,A_PEOPLE,PERSONS_INJURED,PED_NONPED,BIKE_NONBIKE,LAT,LON"
        n = json.loads(get(f"{url}/query", {"where": where, "returnCountOnly": "true", "f": "json", **geo}))["count"]
        off, got_n = 0, 0
        while off < n:
            j = json.loads(get(f"{url}/query", {"where": where, "outFields": fields, "returnGeometry": "false", "f": "json", "resultOffset": off,
                                                "resultRecordCount": 2000, "orderByFields": "OBJECTID", **geo}, timeout=900))
            got = [f["attributes"] for f in j.get("features", [])]
            if not got:
                break
            for a in got:
                if c["kind"] == "il_idot":
                    t = (a.get("TypeOfFirstCrash") or "").strip(); d = a.get("CrashDate")
                    lon = a.get("TSCrashLongitude")
                    lon = -abs(lon) if isinstance(lon, (int, float)) and lon else lon   # IDOT's 2016-2018 extracts store longitude without its sign
                    rows.append([a.get("CrashID"), a.get("TSCrashLatitude"), lon, int(a.get("TotalFatals") or 0), int(a.get("AInjuries") or 0),
                                 1 if t == "Pedestrian" else 0, 1 if t == "Pedalcyclist" else 0,
                                 time.strftime("%Y-%m-%d", time.gmtime(d / 1000)) if isinstance(d, (int, float)) else f"{yr}-01-01", int(a.get("TotalInjured") or 0)])
                else:
                    d = a.get("CRASH_DT")
                    rows.append([a.get("DOCUMENT_NBR"), a.get("LAT"), a.get("LON"), int(a.get("K_PEOPLE") or 0), int(a.get("A_PEOPLE") or 0),
                                 1 if str(a.get("PED_NONPED")) == "1" else 0, 1 if str(a.get("BIKE_NONBIKE")) == "1" else 0,
                                 time.strftime("%Y-%m-%d", time.gmtime(d / 1000)) if isinstance(d, (int, float)) else "", int(a.get("PERSONS_INJURED") or 0)])
            off += len(got); got_n += len(got)
        assert got_n == n, (url, got_n, n)
        log("   state crashes", yr or c["years"], n)
    meta = json.loads(get(c["url"], {"f": "json"}))
    json.dump({"kind": c["kind"], "name": c["name"], "source": c["url"], "downloaded": time.strftime("%Y-%m-%d"), "fields9": "persons injured",
               "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate"), "rows": rows}, open(os.path.join(DATA, "crashes_local.json"), "w"))
    log("saved crashes_local.json", len(rows)); manifest("crashes_local.json", c["url"], len(rows), c["name"])


def fetch_state_crashes_map(c):
    """state crash layers read through a field map (state_crashes.py; region.STATE_DEFAULTS): the same 9-field rows as fetch_state_crashes"""
    import state_crashes
    W, S, E, N = county_bbox()
    geo = {"geometry": f"{W},{S},{E},{N}", "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects"}
    rows, edits = [], {}
    for job in c["jobs"]:
        r, e = state_crashes.fetch_job(job, get, geo, log); rows += r; edits[job["url"]] = e
    json.dump({"kind": c["kind"], "name": c["name"], "source": c["url"], "downloaded": time.strftime("%Y-%m-%d"), "fields9": "persons injured",
               "date_precision": c.get("date_precision", "day"), **({"all_injury": True} if c.get("all_injury") else {}),
               "jobs": [j["url"] for j in c["jobs"]], "dataLastEditDate": edits, "rows": rows}, open(os.path.join(DATA, "crashes_local.json"), "w"))
    log("saved crashes_local.json", len(rows)); manifest("crashes_local.json", c["url"], len(rows), c["name"])


def fetch_local_crashes_sf(c):
    """DataSF 'Traffic Crashes Resulting in Injury' (every row is an injury or fatal crash), 2016-2025, same compact rows as Denver:
    [id, lat, lon, killed, severe(0/1), pedestrian(0/1), bicycle(0/1), 'YYYY-MM-DD']"""
    where = "accident_year >= '2016' AND accident_year <= '2025'"
    n = json.loads(get(f"{c['url']}/query", {"where": where, "returnCountOnly": "true", "f": "json"}))["count"]
    rows, off = [], 0
    while off < n:
        j = json.loads(get(f"{c['url']}/query", {"where": where, "outFields": "ObjectId,unique_id,collision_date,tb_latitude,tb_longitude,number_killed,collision_severity,mviw,dph_col_grp_description",
                                                 "returnGeometry": "false", "f": "json", "resultOffset": off, "resultRecordCount": 2000, "orderByFields": "ObjectId"}, timeout=900))
        got = [f["attributes"] for f in j.get("features", [])]
        if not got:
            break
        for a in got:
            grp = (a.get("dph_col_grp_description") or ""); mv = (a.get("mviw") or "")
            ped = 1 if ("Pedestrian" in grp or mv == "Pedestrian") else 0; bike = 1 if ("Bicycle" in grp or mv == "Bicycle") else 0
            sev = 1 if (a.get("collision_severity") or "") == "Injury (Severe)" else 0
            d = a.get("collision_date"); d = time.strftime("%Y-%m-%d", time.gmtime(d / 1000)) if isinstance(d, (int, float)) else str(d or "")[:10]
            rows.append([a.get("unique_id") or a["ObjectId"], a.get("tb_latitude"), a.get("tb_longitude"), int(a.get("number_killed") or 0), sev, ped, bike, d])
        off += len(got)
    assert len(rows) == n, (len(rows), n)
    meta = json.loads(get(c["url"], {"f": "json"}))
    json.dump({"kind": c["kind"], "name": c["name"], "source": c["url"], "all_injury": True, "downloaded": time.strftime("%Y-%m-%d"),
               "dataLastEditDate": (meta.get("editingInfo") or {}).get("dataLastEditDate"), "rows": rows}, open(os.path.join(DATA, "crashes_local.json"), "w"))
    log("saved crashes_local.json", len(rows)); manifest("crashes_local.json", c["url"], len(rows), c["name"] + " 2016-2025")


def fetch_ccrs():
    if region.STATE != "CA":
        log("  crashes: CCRS is California-only; FARS fatal crashes fetched instead (fetch_fars)"); return
    for yr, rid in CCRS.items():
        name = f"ccrs_{yr}.json"
        if have(name):
            continue
        rows, off = [], 0
        while True:
            cols = "*" if int(yr) >= 2023 else CCRS_COLS
            sql = f'SELECT {cols} FROM "{rid}" WHERE "County Code"=\'{region.CHP_CODE}\' ORDER BY "_id" LIMIT 10000 OFFSET {off}'
            j = json.loads(get("https://data.ca.gov/api/3/action/datastore_search_sql", {"sql": sql}, timeout=900))
            got = j["result"]["records"]; rows += got; off += len(got)
            log("   ccrs", yr, "rows", len(rows))
            if len(got) < 10000:
                break
        save(name, json.dumps(rows))
    for yr, rid in CCRS_IWP.items():
        name = f"ccrs_severe_{yr}.json"
        if have(name):
            continue
        sql = f'SELECT "CollisionId", "ExtentOfInjuryCode" FROM "{rid}" WHERE "ExtentOfInjuryCode" IN (\'Fatal\',\'SuspectSerious\',\'SevereInactive\')'
        save(name, get("https://data.ca.gov/api/3/action/datastore_search_sql", {"sql": sql}, timeout=900))
    for yr, rid in CCRS_IWP.items():   # crashes where an injured or killed person was a pedestrian (P) or cyclist (B): CCRS's "motor vehicle
        name = f"ccrs_pedbike_{yr}.json"   # involved with" field names only the first object struck and misses ~9.5% of them (2024 statewide)
        if have(name):
            continue
        m, off = {}, 0
        while True:
            sql = (f'SELECT "CollisionId", "InjuredPersonType" FROM "{rid}" WHERE "InjuredPersonType" IN (\'Pedestrian\',\'Bicyclist\') '
                   f'ORDER BY "_id" LIMIT 20000 OFFSET {off}')
            got = json.loads(get("https://data.ca.gov/api/3/action/datastore_search_sql", {"sql": sql}, timeout=900))["result"]["records"]
            for r in got:
                k = str(r["CollisionId"]); t = "P" if r["InjuredPersonType"] == "Pedestrian" else "B"
                m[k] = t if m.get(k, t) == t else "PB"
            off += len(got)
            if len(got) < 20000:
                break
        save(name, json.dumps({"source": f"CCRS InjuredWitnessPassengers {yr} (data.ca.gov resource {rid})", "rule": "InjuredPersonType Pedestrian (P) or Bicyclist (B)", "collisions": m}))
        log("   ccrs pedestrian/cyclist injury collisions", yr, len(m))


# ---------------- 9. Tree Equity Score (American Forests, public share bucket) ----------------
def fetch_tes():
    """Tree Equity Score 2021 state file: downloaded and unpacked once per state into the shared cache; each county links to it"""
    st = region.STATE.lower()
    zc = os.path.join(SHARED, "tes_ca.zip") if st == "ca" else os.path.join(SHARED, "tes_states", f"tes_{st}.zip")
    if not (os.path.exists(zc) and os.path.getsize(zc) > 100):
        os.makedirs(os.path.dirname(zc), exist_ok=True)
        b = get(f"https://national-tes-data-share.s3.amazonaws.com/national_tes_share/{st}.zip.zip", binary=True, timeout=1800)
        open(zc + ".part", "wb").write(b); os.replace(zc + ".part", zc)
        log("  TES zip members:", zipfile.ZipFile(io.BytesIO(b)).namelist()[:20])
    ud = os.path.join(SHARED, "tes_unzipped", st)
    if not os.path.exists(os.path.join(ud, f"{st}.shp")):
        z = zipfile.ZipFile(zc)
        safe = [n for n in z.namelist() if "/" not in n and ".." not in n]
        os.makedirs(ud, exist_ok=True); z.extractall(ud, members=safe)
        log("  TES 2021 unpacked to the shared cache:", safe)
    td = os.path.join(DATA, "tes")
    if not os.path.exists(os.path.join(td, f"{st}.shp")):
        if os.path.islink(td) or (os.path.isdir(td) and not os.listdir(td)):
            os.remove(td) if os.path.islink(td) else os.rmdir(td)
        if not os.path.exists(td):
            os.symlink(os.path.abspath(ud), td)   # sources_oc.tes_by_bg reads data/tes/<st>.shp


# ---------------- 10. Round 3: city street-tree inventories (ArcGIS REST, public) ----------------
# Anaheim: every record is an inventory site; COMMONNAME 'VACANT SITE' marks an open planting site (23,985 of 124,051 on 5 Nov 2026).
# Irvine: City Trees layer; TRG_STAT_CD 1 Active / 999 Removed / 951 Out of Service; only 82 records name a vacant site, so it is
#         saved for audit but NOT used for open planting sites (it is not a planting-site survey).
# Costa Mesa: i-Tree benefits table hosted by a contractor org (no vacant sites, municipal endorsement unverified): saved for audit only.
TREE_LAYERS = {
    "trees_anaheim.geojson": ("https://gis.anaheim.net/map/rest/services/AnaheimTrees/MapServer/0", "OBJECTID,INVENTORYI,ADDRESS,STREET,COMMONNAME,BOTANICALN,DBH,PARKWAY,PARKWAYTYP,TREECONDIT,DATEMODIFI,DEPARTMENT"),
    "trees_irvine.geojson": ("https://gis.cityofirvine.org/arcgis/rest/services/City_Landscape/MapServer/0", "OBJECTID,TRG_ID,TRG_COMMON,TRG_STAT_CD,SITETYPE,CITYMAINTAINED,REMOVED,DBH,LASTMODDATE,PLANNINGAREA"),
    "trees_costamesa.geojson": ("https://services2.arcgis.com/yrktbS5Xw87hJQvs/arcgis/rest/services/Costa_Mesa_Tree_benefits/FeatureServer/0", "OBJECTID,Tree_ID,InventoryID,CommonName,BotanicalName,DBH,Address,Street"),
}


def fetch_trees():
    if region.OV.get("trees") != "anaheim":
        return
    for name, (url, fields) in TREE_LAYERS.items():
        if have(name):
            continue
        n_expected = json.loads(get(f"{url}/query", {"where": "1=1", "returnCountOnly": "true", "f": "json"})).get("count")
        feats = arcgis_query(url, fields=fields, use_bbox=False, page=2000, extra={"orderByFields": "OBJECTID"})
        if n_expected is not None and len(feats) != n_expected:
            log("!! incomplete, not saved:", name, len(feats), "of", n_expected)
            continue
        save(name, json.dumps({"type": "FeatureCollection", "features": feats, "source": url, "downloaded": time.strftime("%Y-%m-%d")}))
        manifest(name, url, len(feats), "street-tree inventory")


# ---------------- 11. Round 3: 311-type requests ----------------
# Checked 5 Nov 2026; no Orange County city publishes an open 311 export with dumping/graffiti/litter/encampment requests:
#  - Santa Ana "Homeless_Services" (services1.arcgis.com/u3G8zpmDyNtG4F4e): unlisted dashboard export, licenceInfo "For use by CDA",
#    carries ReportedBy/ReporterEmail/NotesHistory (personal data), Jan-Mar 2026 only. Not downloaded.
#  - Irvine "Code_Enforcement_Cases": code cases, not service requests; 0 topics matching graffiti/dump/trash/litter/debris/encampment.
#  - Anaheim 311, Huntington Beach, Garden Grove, Costa Mesa, OC Public Works: no public export found.
# So graf/dump/e stay absent for every Orange County block group. Add a downloader here only when a city publishes one.
def fetch_311():
    log("  no open Orange County 311 dataset; nothing fetched (see comment in fetch_oc.py)")


# ---------------- 12. Round 3: Tree Equity Score current California release (2020 block groups) ----------------
def fetch_tes_latest():
    """current Tree Equity Score state CSV: one shared copy per state, linked into each county as tes_<st>_latest_csv.zip"""
    st = region.STATE.lower(); zname = f"tes_{st}_latest_csv.zip"
    if have(zname):
        return
    zc = os.path.join(SHARED, "tes_states", zname); url = f"https://tes-app-data-share.s3.amazonaws.com/{st}/{st}_csv.zip"
    if not (os.path.exists(zc) and os.path.getsize(zc) > 100):
        os.makedirs(os.path.dirname(zc), exist_ok=True)
        b = get(url, binary=True, timeout=1800); open(zc + ".part", "wb").write(b); os.replace(zc + ".part", zc)
    dst = os.path.join(DATA, zname)
    if os.path.lexists(dst): os.remove(dst)
    os.symlink(os.path.abspath(zc), dst)
    z = zipfile.ZipFile(zc)
    rows = sum(1 for _ in io.TextIOWrapper(z.open(f"{st}_tes.csv"), encoding="utf-8-sig")) - 1
    manifest(zname, url, rows, "release date not published; zip members dated " + ",".join(sorted({f"{i.date_time[0]}-{i.date_time[1]:02d}-{i.date_time[2]:02d}" for i in z.infolist()})))


# ---------------- 13. Round 4: tax-rate areas (BOE polygons) + County Auditor Section 99 factors (FY 2026-27) ----------------
# BOE_TRA_2026_co30 (California State Board of Equalization, Orange 2026 roll year): 4,742 TRA polygons, field TRA = six-digit id.
# Auditor-Controller "SECTION 99 FACTOR RPT BY TRA 2026-2027" (printed 08/28/26): per-TRA share of the 1% levy increment by fund;
# trailing '-' marks a negative factor. Every parsed TRA must sum to its printed TOTAL (checked), else nothing is saved.
TRA_LAYER = "https://services7.arcgis.com/iwxhJVOFEKDxO7gk/arcgis/rest/services/Orange_2026_Roll_Year/FeatureServer/1"
TRA_FACTORS = "https://ocauditor.gov/wp-content/uploads/2026/10/AT68AH71-Section-99-Factor-Report-by-TRA-8-28-2026.pdf"


def fetch_tra():
    import re, subprocess
    if region.OV.get("tra") != "oc":
        log("  tax-rate areas: only the Orange County Auditor report is parsed so far"); return
    if not have("tra_oc_2026.geojson"):
        n_expected = json.loads(get(f"{TRA_LAYER}/query", {"where": "1=1", "returnCountOnly": "true", "f": "json"}))["count"]
        feats = arcgis_query(TRA_LAYER, fields="TRA", use_bbox=False, page=1000, extra={"orderByFields": "OBJECTID"})
        if len(feats) != n_expected:
            log("!! TRA polygons incomplete, not saved:", len(feats), "of", n_expected); return
        save("tra_oc_2026.geojson", json.dumps({"type": "FeatureCollection", "features": feats, "source": TRA_LAYER, "downloaded": time.strftime("%Y-%m-%d")}))
        manifest("tra_oc_2026.geojson", TRA_LAYER, len(feats), "BOE tax-rate-area polygons, Orange County 2026 roll year")
    if have("tra_factors_2026_27.json"):
        return
    if not have("tra_section99_2026_27.pdf"):
        save("tra_section99_2026_27.pdf", get(TRA_FACTORS, binary=True, timeout=900), binary=True)
    txt = subprocess.run(["pdftotext", "-layout", os.path.join(DATA, "tra_section99_2026_27.pdf"), "-"], capture_output=True, text=True, check=True).stdout   # needs poppler-utils
    num = lambda v: -float(v[:-1]) if v.endswith("-") else float(v)
    row = re.compile(r"^\s*(?:\S+\s+)?(\d{2}-\d{3})\s+(.+?)\s+(\d{3}[A-Z])\s+(.+?)\s+(\d?\.\d{11}-?)\s+(\d?\.\d{11}-?)\s*$")
    tot = re.compile(r"^\s*(\d{2}-\d{3})\s+TOTAL\s+(\d?\.\d+-?)\s+(\d?\.\d+-?)")
    tras, totals = {}, {}
    for line in txt.splitlines():
        m = row.match(line)
        if m:
            tras.setdefault(m.group(1).replace("-", "").zfill(6), []).append([m.group(4).strip(), num(m.group(6))]); continue
        t = tot.match(line)
        if t:
            totals[t.group(1).replace("-", "").zfill(6)] = num(t.group(3))
    bad = [k for k in tras if abs(sum(f for _, f in tras[k]) - totals.get(k, -9)) > 1e-6]
    if bad or len(tras) != len(totals):
        log("!! TRA factor parse failed, not saved:", len(bad), "TRAs off total;", len(tras), "parsed vs", len(totals), "totals", bad[:5]); return
    save("tra_factors_2026_27.json", json.dumps({"source": TRA_FACTORS, "report": "SECTION 99 FACTOR RPT BY TRA 2026-2027, printed 08/28/26", "tras": tras}))
    manifest("tra_factors_2026_27.json", TRA_FACTORS, len(tras), "every TRA's factors sum to its printed TOTAL")


# ---------------- 14. National pipeline: CA DOJ crime file and the county OpenStreetMap extract ----------------
DOJ_URL = "https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Crimes_and_Clearances_with_Arson-1985-2025.csv"
def fetch_doj():
    if region.STATE != "CA":
        log("  crime: CA DOJ only; FBI CDE needs an API key"); return
    p = os.path.join(DATA, "doj", "Crimes_and_Clearances_with_Arson-1985-2025.csv")
    if os.path.exists(p) and os.path.getsize(p) > 1000: return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(get(DOJ_URL, binary=True, timeout=900)); manifest("doj/Crimes_and_Clearances_with_Arson-1985-2025.csv", DOJ_URL, None, "CA DOJ agency-year crime")
def fetch_osm_extract():
    url = region.OSM["url"]; name = region.OSM_FILE; p = os.path.join(DATA, "osm", name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if not have(os.path.join("osm", name)) and region.OSM.get("split"):
        # a state cut once from the regional file by osm_split.py (cache/osm_states); shared by every county in the state
        sp = os.path.join(SHARED, "osm_states", region.OSM["split"].replace("/", "__"))
        if not os.path.exists(sp + "-latest.osm.pbf"):
            raise RuntimeError(f"{sp}-latest.osm.pbf is missing: run osm_split.py {region.OSM['split'].split('/')[0]}")
        os.link(sp + "-latest.osm.pbf", p); os.link(sp + ".state.txt", p.replace("-latest.osm.pbf", ".state.txt")); log("linked state file", sp)
    elif not have(os.path.join("osm", name)):
        shared = region.OSM.get("clip")   # a state / sub-region file serves several counties: keep one copy in the cache (same day) and link it
        cp = os.path.join(SHARED, "osm", url.split("north-america/")[-1].replace("/", "__")) if shared else None
        if cp and os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 86400:
            os.link(cp, p); os.link(cp.replace("-latest.osm.pbf", ".state.txt"), p.replace("-latest.osm.pbf", ".state.txt")); log("linked cached", cp)
        else:
            open(p, "wb").write(get(url, binary=True, timeout=3600)); log("saved", p, f"{os.path.getsize(p) / 1e6:.0f} MB")
            st = url.replace("-latest.osm.pbf", ".state.txt"); open(p.replace("-latest.osm.pbf", ".state.txt"), "w").write(get(st))
            if cp:
                os.makedirs(os.path.dirname(cp), exist_ok=True)
                for q in (cp, cp.replace("-latest.osm.pbf", ".state.txt")):
                    if os.path.exists(q): os.remove(q)
                os.link(p, cp); os.link(p.replace("-latest.osm.pbf", ".state.txt"), cp.replace("-latest.osm.pbf", ".state.txt"))
    if region.OSM.get("clip"):
        log("  NOTE: regional/state extract; osm_extract.py keeps only features inside the county box", county_bbox())


if __name__ == "__main__":
    steps = [fetch_blockgroups, fetch_acs, fetch_tiger_lines, fetch_parks_cities, fetch_gtfs, fetch_schools, fetch_fire_ev, fetch_ccrs, fetch_local_crashes, fetch_fars, fetch_doj, fetch_tes, fetch_tes_latest, fetch_trees, fetch_311, fetch_tra, fetch_osm_extract]
    only = sys.argv[1:]
    link_shared()
    for f in steps:
        if only and f.__name__.replace("fetch_", "") not in only:
            continue
        log("==", f.__name__)
        try:
            f()
        except Exception as e:
            log("!! failed:", f.__name__, repr(e)[:300])
    log("done; files:", sorted(os.listdir(DATA)))
