"""Parcel facts for the station-site candidates (docs/audit/station-sites-2026-11-22.md).

For each candidate (pipeline/station_sites_osm.py output) the county's parcel service from app/data/parcel_services.json (the page's
registry; its own lookup for Los Angeles and Orange County) is asked for the parcel that contains the polygon's interior point, the
same point query the page makes (app.js fetchParcel). At most 2 requests a second per service, retries with a pause, answers cached
in <work>/parcel_cache.jsonl. Only what the service returns is recorded:
  parcel id, owner (a public agency or company name; a private person's name is never stored), land use code and text,
  assessed land value, total value, zoning code, the parcel's own area (from its returned outline), service URL, retrieved date.
The parcel area is compared with the OSM polygon's. When the parcel is more than 2x or under 0.5x the OSM area the value
belongs to the whole parcel, so land and total value are withheld (as the Los Angeles audit did).

Usage: python3 pipeline/station_sites_parcels.py <work dir>   (reads cands/*.json, writes parcels.json)
"""
import json, math, os, re, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "city-pretty-station-sites (research; 2 requests/second per service)"}
MIN_GAP = 0.5   # seconds between requests to one service
RATIO_LO, RATIO_HI = 0.5, 2.0
OC_URL = "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0"   # app.js fetchParcel, Orange County

# ordered field-name patterns (case-insensitive, whole name) per fact; the first one the service has is used
PAT = {
    "apn": ["apn", "assessment_no", "ain", "parcelid", "parcel_id", "pin", "pin14", "pin10", "bbl", "parno", "propid", "hcad_num", "stanpar", "maptaxlot", "pams_pin", "gis_pin", "county_pin", "state_pin", "stateid", "taxparcelid",
            "localparcelid", "parid", "map_par_id", "loc_id", "taxpin", "gis_acct", "acct", "account", "parcelno", "geopin", "ssl", "parcel", "major", "name", "key_pin"],
    "owner": ["ownername", "owner_name", "owner_name_1", "ownname", "ownernme1", "owner", "owner1", "owner_1", "taxpaname1", "taxpayer_1", "own_name", "ownernm", "owner1nm", "owner_nm"],
    "land": ["roll_landvalue", "landvalue", "land_value", "landval", "lnd_val", "land_val", "amt_land_value", "assessland", "rolland", "emv_land", "landappr", "asr_land", "lndvalue", "newland", "val_land", "lpv_land"],
    "ownertype": ["ownertype", "owntype", "owner_type"],
    "total": ["assesstot", "totval", "totalvalue", "total_value", "total_valu", "total_val", "totlappr", "total_appraised_val", "total_market_val", "jv", "apprvaltot", "emv_total", "net_value", "parval", "asr_total", "amt_assessed_value", "newtotal", "roll_totalvalue"],
    "usecode": ["usecode", "usecd", "dor_uc", "lucode", "landusecde", "luc", "parusecode", "landuse", "puc", "land_use", "prop_class", "propclass", "state_cd", "stateluc", "dlgf_prop_class_code", "use_code", "typeuse", "useclass1",
                "bldgclass", "classcd", "sptbcode", "prop_cl", "state_class", "asr_landuse", "prop_code", "cuse"],
    "usetext": ["usedescription", "use_desc", "usedesc", "ludesc", "parusedesc", "prprtydscrp", "landusedsc", "desclu", "classdscrp", "property_class_description", "bldg_desc", "propuse", "land_desc", "descciuse", "prop_use", "propclassdesc"],
    "zoning": ["zoning", "zonedist1", "zoningcode", "zoning_district", "city_zoning", "zoneclass", "asr_zone", "zone", "zonecode", "zoningdesc"],
}
SKIP_ACRES = ["acres", "gisacres", "acreage", "landacres", "calc_acres", "assr_acres", "total_acreage", "acres_poly", "sizeacres", "lglacres", "assdacres"]


def local_area(rings):
    """(area in m2, centre latitude) of an esri polygon: rings are (lon, lat); outer rings run clockwise, holes counter-clockwise,
    so the signed shoelace areas (metres, local equirectangular) add up to minus the polygon's area"""
    rings = [r for r in rings if len(r) >= 4]
    if not rings:
        return None, None
    lat0 = sum(c[1] for r in rings for c in r) / sum(len(r) for r in rings)
    lon0 = rings[0][0][0]
    kx = 111320.0 * math.cos(math.radians(lat0))
    tot = 0.0
    for r in rings:
        pts = [((x - lon0) * kx, (y - lat0) * 110540.0) for x, y in r]
        tot += sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1)) / 2.0
    return abs(tot), lat0


class Limiter:
    def __init__(self):
        self.lock = {}; self.last = {}; self.g = threading.Lock()

    def wait(self, key):
        with self.g:
            lk = self.lock.setdefault(key, threading.Lock())
        with lk:
            dt = time.time() - self.last.get(key, 0)
            if dt < MIN_GAP:
                time.sleep(MIN_GAP - dt)
            self.last[key] = time.time()


LIM = Limiter()


def get_json(url, params=None, key=None, tries=4, timeout=60):
    last = None
    for i in range(tries):
        LIM.wait(key or url)
        try:
            u = url + ("?" + urllib.parse.urlencode(params) if params else "")
            return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=timeout).read())
        except Exception as e:
            last = str(e)[:120]; time.sleep(3 * (i + 1))
    raise RuntimeError(last)


_meta = {}


def meta(url):
    if url not in _meta:
        try:
            _meta[url] = get_json(url, {"f": "json"}, key=url)
        except Exception as e:
            _meta[url] = {"error": str(e)}
    return _meta[url]


def pick(fields, pats, extra=None):
    low = {f.lower(): f for f in fields}
    for p in ([extra.lower()] if extra else []) + pats:
        if p in low:
            return low[p]
    return None


# --- owner: a public agency or company name is kept; a private person's name never is
AGENCY = re.compile(r"\b(CITY OF|COUNTY OF|STATE OF|TOWN OF|VILLAGE OF|BOROUGH OF|CITY AND COUNTY|PORT OF|UNITED STATES|U S A|US GOVT|GOVERNMENT|GOVT|FEDERAL|DEPT|DEPARTMENT|SCHOOL DIST|SCHOOL BOARD|UNIFIED|"
                    r"DISTRICT|AUTHORITY|HOUSING AUTH|TRANSIT|TRANSPORTATION|METROPOLITAN|MUNICIPAL|REDEVELOPMENT|COMMISSION|BOARD OF|PUBLIC|UNIVERSITY|COLLEGE|NYC|NEW YORK CITY|COUNTY|COMMONWEALTH|REGENTS|LAND BANK|PARK DIST|FOREST PRESERVE)\b", re.I)
COMPANY = re.compile(r"\b(LLC|L L C|LLP|LP|L P|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PARTNERS|PARTNERSHIP|ASSOC|ASSOCIATES|ASSOCIATION|HOLDINGS?|PROPERTIES|PROPERTY|REALTY|INVESTMENTS?|VENTURES?|DEVELOPMENT|"
                     r"DEVELOPERS|GROUP|ENTERPRISES?|BANK|CHURCH|MINISTRIES|FOUNDATION|FUND|REIT|SERVICES|MANAGEMENT|CAPITAL|EQUITIES|HOMES|APARTMENTS|PARKING|GOLF|CLUB|CENTER|CENTRE|PLAZA|MALL|STORES?|MARKET|SHOPPING|INDUSTRIAL|COMMERCIAL|BUILDERS?|"
                     r"CONSTRUCTION|OPERATING|OPERATIONS|TRUSTEES?|CEMETERY|HOSPITAL|HOTEL|MOTEL|INN|LODGING|TOWERS?|PARTNERS?|FINANCIAL|INSURANCE|ENERGY|ELECTRIC|GAS|UTILITY|UTILITIES|TELEPHONE|COMMUNICATIONS|WATER|RAILROAD|RAILWAY|RAIL|AIRLINES|USA)\b", re.I)
STRONG = re.compile(r"\b(LLC|L L C|LLP|LP|INC|CORP|CORPORATION|LTD|CO|COMPANY|BANK|CHURCH|ASSOC|ASSOCIATION|CITY OF|COUNTY OF|STATE OF|SCHOOL|DISTRICT|AUTHORITY|DEPT|DEPARTMENT|UNIVERSITY|UNITED STATES)\b", re.I)
TRUSTISH = re.compile(r"\b(TRUST|TR|TRS|ESTATE|EST|FAMILY|LIVING|REVOCABLE|IRREVOCABLE|ET AL|ETAL|ET UX|ETUX|HEIRS|JT|JTWROS|LIFE ESTATE|& )\b|&", re.I)


def classify_owner(name):
    """-> (ownerType, ownerNameOrNone). Individuals, trusts and estates: the name is not stored."""
    if not name or not str(name).strip():
        return None, None
    n = re.sub(r"\s+", " ", str(name)).strip()
    if re.match(r"^[A-Za-z'.-]+,\s*[A-Za-z]", n) and not STRONG.search(n):   # "LASTNAME, FIRSTNAME": a person unless it names a legal entity
        return "private individual", None
    if AGENCY.search(n):
        return "public agency", n
    if COMPANY.search(n) and not re.search(r"\b(TRUST|ESTATE|HEIRS)\b", n, re.I):
        return "company or organisation", n
    if TRUSTISH.search(n):
        return "trust, estate or co-owners (name not stored)", None
    return "private individual", None


def rings_of(feat):
    g = feat.get("geometry") or {}
    return g.get("rings") or []


def esri_contains(rings, lng, lat):
    """point in an esri polygon (outer rings clockwise, holes counter-clockwise), by even-odd over all rings"""
    n = False
    for r in rings:
        j = len(r) - 1
        for i in range(len(r)):
            xi, yi = r[i]; xj, yj = r[j]
            if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-300) + xi:
                n = not n
            j = i
    return n


def service_for(fips, A):
    if fips == "06037":
        return next(s for s in A if "lacounty" in s["url"])
    if fips == "06059":
        return {"url": OC_URL, "name": "Orange County parcels (OC Public Works / ocgis.com)", "fields": [], "own": True}
    return None


def lookup(svc, lat, lng):
    """-> dict with parcel facts, or {'error': ...}"""
    url = svc["url"].rstrip("/")
    q = url + "/query"
    params = {"geometry": f"{lng:.7f},{lat:.7f}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "returnGeometry": "true", "outSR": "4326", "f": "json"}
    try:
        d = get_json(q, params, key=url)
    except Exception as e:
        return {"error": "service did not answer: " + str(e)}
    if d.get("error"):
        # some services refuse outFields=*: ask for the registry's own fields
        fl = ",".join(f[0] for f in svc.get("fields", []) if not str(f[0]).endswith("()")) or None
        if fl:
            params["outFields"] = fl
            try:
                d = get_json(q, params, key=url)
            except Exception as e:
                return {"error": "service did not answer: " + str(e)}
        if d.get("error"):
            return {"error": "service error: " + json.dumps(d["error"])[:120]}
    feats = [f for f in d.get("features") or [] if esri_contains(rings_of(f), lng, lat)]
    if not feats:
        return {"none": True}
    f = feats[0]
    a = f.get("attributes") or {}
    return {"attrs": a, "rings": rings_of(f), "n": len(feats)}


def facts(svc, res, osm_m2, today):
    a = res["attrs"]
    fields = list(a.keys())
    m = meta(svc["url"].rstrip("/"))
    out = {"service": svc["name"], "serviceUrl": svc["url"], "retrieved": today}
    f = {k: pick(fields, PAT[k], svc.get("apn") if k == "apn" else None) for k in PAT}
    # NYC: the borough-block-lot number is the parcel id
    if "BBL" in a and a.get("BBL") not in (None, ""):
        f["apn"] = "BBL"
    val = lambda k: (a.get(f[k]) if f[k] else None)
    num = lambda x: (float(x) if x not in (None, "") and re.fullmatch(r"-?\d+(\.\d+)?", str(x).strip()) else None)
    pid = val("apn")
    out["parcelId"] = str(pid).strip() if pid not in (None, "") else None
    out["parcelIdField"] = f["apn"]
    otype, oname = classify_owner(val("owner"))
    out["ownerType"], out["owner"] = otype, oname
    out["ownerField"] = f["owner"]
    # the service's own public/private code, if it has one: shown as its coded-value name when the layer's metadata gives the domain, else the raw code
    oc = val("ownertype")
    if oc not in (None, "", " "):
        dom = next((fd.get("domain") for fd in (m.get("fields") or []) if fd.get("name") == f["ownertype"]), None)
        lab = next((cv["name"] for cv in (dom or {}).get("codedValues", []) if str(cv["code"]) == str(oc)), None)
        out["ownerTypeCode"] = (str(lab) if lab else str(oc)); out["ownerTypeCodeField"] = f["ownertype"]
    else:
        out["ownerTypeCode"] = None; out["ownerTypeCodeField"] = None
    out["useCode"] = str(val("usecode")).strip() if val("usecode") not in (None, "") else None
    out["useCodeField"] = f["usecode"] if out["useCode"] is not None else None
    out["useText"] = str(val("usetext")).strip() if val("usetext") not in (None, "") else None
    out["useTextField"] = f["usetext"] if out["useText"] is not None else None
    out["zoning"] = str(val("zoning")).strip() if val("zoning") not in (None, "", " ") else None
    out["zoningField"] = f["zoning"] if out["zoning"] is not None else None
    out["landValue"] = num(val("land")); out["landValueField"] = f["land"] if out["landValue"] is not None else None
    out["totalValue"] = num(val("total")); out["totalValueField"] = f["total"] if out["totalValue"] is not None else None
    area, _ = local_area(res["rings"])
    out["parcelM2"] = round(area) if area else None
    ratio = (area / osm_m2) if area and osm_m2 else None
    out["areaRatio"] = round(ratio, 2) if ratio else None
    out["mismatch"] = bool(ratio is not None and (ratio > RATIO_HI or ratio < RATIO_LO))
    if out["mismatch"]:
        out["valuesWithheld"] = f"parcel is {ratio:.1f} times the OpenStreetMap polygon's area, so its value is for the whole parcel, not this polygon"
        out["landValue"] = out["totalValue"] = None
    out["ownerNote"] = None if otype else ("service has no owner field" if not f["owner"] else "owner blank")
    if not (out["landValue"] is not None or out["totalValue"] is not None) and not out["mismatch"]:
        out["valueNote"] = "this service gives no assessed value field" if not (f["land"] or f["total"]) else "value blank"
    return out


def main():
    work = sys.argv[1]
    today = time.strftime("%Y-%m-%d")
    A = json.load(open(os.path.join(work, "anchors.json")))["anchors"]
    reg = json.load(open(os.path.join(ROOT, "app/data/parcel_services.json")))["services"]
    byname = {s["name"]: s for s in reg}
    FIPS_ST = {}
    cache_fn = os.path.join(work, "parcel_cache.jsonl")
    cache = {}
    if os.path.exists(cache_fn):
        for line in open(cache_fn):
            try:
                j = json.loads(line); cache[j["k"]] = j["v"]
            except Exception:
                pass
    wl = threading.Lock()
    cf = open(cache_fn, "a")
    anch = {a["id"]: a for a in A}
    jobs = []
    for fn in sorted(f for f in os.listdir(os.path.join(work, "cands")) if f.endswith(".json")):
        d = json.load(open(os.path.join(work, "cands", fn)))
        for r in d["records"]:
            a = anch[r["near"]["id"]]
            svc = byname.get(a["parcelService"]) or (service_for(a["fips"], reg) if a["fips"] in ("06037", "06059") else None)
            if a["fips"] == "06037":
                svc = service_for("06037", reg)
            jobs.append((r, svc, d["info"]))
    # a county file holds at most about CAP sites (300 KB), largest first: the parcel service is asked only for those
    CAP = int(os.environ.get("STATION_SITES_CAP", "800"))
    byf = {}
    for j in jobs:
        byf.setdefault(j[0]["near"]["fips"], []).append(j)
    jobs, counts = [], {}
    for f, L in byf.items():
        L.sort(key=lambda j: -j[0]["acres"])
        counts[f] = {"found": len(L), "queried": min(len(L), CAP)}
        jobs += L[:CAP]
    json.dump(counts, open(os.path.join(work, "cap_counts.json"), "w"))
    print("candidates found", sum(c["found"] for c in counts.values()), "queried", len(jobs), "without a service", sum(1 for j in jobs if not j[1]))

    def work_one(job):
        r, svc, info = job
        if not svc:
            r["parcel"] = None; r["parcelWhy"] = "no parcel service on file for this county"; return
        key = f"{svc['url']}|{r['pt'][0]:.6f},{r['pt'][1]:.6f}"
        with wl:
            res = cache.get(key)
        if res is None:
            res = lookup(svc, r["pt"][0], r["pt"][1])
            if "attrs" in res or res.get("none"):
                slim = dict(res)
                with wl:
                    cache[key] = slim; cf.write(json.dumps({"k": key, "v": slim}) + "\n"); cf.flush()
        if res.get("error"):
            r["parcel"] = None; r["parcelWhy"] = res["error"]; return
        if res.get("none"):
            r["parcel"] = None; r["parcelWhy"] = "the service has no parcel at the polygon's interior point (road, water, or outside the service's area)"; return
        r["parcel"] = facts(svc, res, r["areaM2"], today)

    with ThreadPoolExecutor(12) as ex:
        list(ex.map(work_one, jobs))
    fmap = {}
    for r, svc, info in jobs:
        pc = r.get("parcel")
        if pc:
            m = fmap.setdefault(r["near"]["fips"], {})
            for k, fk in (("id", "parcelIdField"), ("own", "ownerField"), ("oc", "ownerTypeCodeField"), ("uc", "useCodeField"), ("ut", "useTextField"), ("zn", "zoningField"), ("lv", "landValueField"), ("tv", "totalValueField")):
                if pc.get(fk):
                    m[k] = pc[fk]
    json.dump(fmap, open(os.path.join(work, "field_map.json"), "w"))
    allrecs = [{"rec": j[0], "info": {k: j[2].get(k) for k in ("source", "url", "data_timestamp", "backend", "group")}} for j in jobs]
    json.dump(allrecs, open(os.path.join(work, "parcels.json"), "w"))
    from collections import Counter
    print(Counter("parcel" if j[0].get("parcel") else (j[0].get("parcelWhy") or "none")[:50] for j in jobs))


if __name__ == "__main__":
    main()
