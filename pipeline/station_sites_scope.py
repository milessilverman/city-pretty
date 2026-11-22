"""Which places the station-site inventory covers (docs/audit/station-sites-2026-11-22.md).

Writes <out>/anchors.json: one anchor per station or stop-city point, with its search radius.
  (a) pipeline_station: every station with a point in app/data/transit_pipelines.json, 0.5 mile
  (b) corridor_stop_city: stop cities of app/data/intercity_transit_corridors.json that lie in a county with a parcel
      service on file (county service or its state's statewide service, as the page's parcelSvc() chooses), the 40
      largest by 2020 Census population (TIGERweb POP100, fetched), 1 mile. A stop city point is the Census internal
      point of the place, not a station site.
  (c) existing_station: every station in the county data file (layers.stations) of the 15 largest counties on file
      (2020 Census POP100 of the county), 0.5 mile.
Usage: python3 pipeline/station_sites_scope.py <out dir>   (needs the network: TIGERweb, counted figures are fetched)
"""
import base64, glob, gzip, json, os, re, sys, time, urllib.parse, urllib.request, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/tigerWMS_Census2020/MapServer"
MILE = 1609.344
FIPS_TO_STATE = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}


def tiger(layer, where, fields, offset=0):
    u = f"{TIGER}/{layer}/query?" + urllib.parse.urlencode({"where": where, "outFields": fields, "returnGeometry": "false", "f": "json", "resultOffset": offset, "resultRecordCount": 1000})
    for _ in range(4):
        try:
            return json.loads(urllib.request.urlopen(u, timeout=90).read())
        except Exception:
            time.sleep(3)
    raise RuntimeError("TIGERweb failed: " + u)


def county_pop():
    out, off = {}, 0
    while True:
        d = tiger(82, "1=1", "GEOID,NAME,POP100", off)
        fs = d["features"]
        for f in fs:
            out[f["attributes"]["GEOID"]] = f["attributes"]["POP100"]
        if len(fs) < 1000 and not d.get("exceededTransferLimit"):
            return out
        off += len(fs)


def parcel_service_for(fips, services):
    """the page's parcelSvc(): the county's own service, else its state's statewide service; LA and Orange have their own lookups"""
    if fips in ("06037", "06059"):
        return {"name": "own lookup (" + ("LA County GIS" if fips == "06037" else "OC Public Works parcels") + ")", "own": True}
    for s in services:
        if fips in (s.get("counties") or []):
            return s
    st = fips[:2]; sc = FIPS_TO_STATE.get(st)
    for s in services:
        if not s.get("counties") and (st in s["states"] or sc in s["states"]):
            return s
    return None


def b64json(fn):
    raw = base64.b64decode(open(fn).read())
    try:
        return json.loads(gzip.decompress(raw))
    except Exception:
        return json.loads(zlib.decompress(raw))


def bundle_stations(fips):
    if fips == "06037":
        b = b64json(os.path.join(ROOT, "app/data/bundle-la.b64.txt"))
    elif fips == "06059":
        b = b64json(os.path.join(ROOT, "app/data/bundle-oc.b64.txt"))
    else:
        b = json.load(gzip.open(os.path.join(ROOT, f"counties/bundle_{fips}.json.gz")))
    st = [[x["properties"].get("n"), x["geometry"]["coordinates"][0], x["geometry"]["coordinates"][1]] for x in (b["layers"].get("stations") or {}).get("features", []) if x["geometry"]["type"] == "Point"]
    return st, (b.get("meta") or {}), b


def county_name_pop_on_file():
    out = {}
    for f in glob.glob(os.path.join(ROOT, "counties/bundle_*.json.gz")):
        out[os.path.basename(f)[7:12]] = f
    out["06037"] = "la"; out["06059"] = "oc"
    return out


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    services = json.load(open(os.path.join(ROOT, "app/data/parcel_services.json")))["services"]
    cpop = county_pop()
    anchors, notes = [], {}
    # (a) pipelines
    for p in json.load(open(os.path.join(ROOT, "app/data/transit_pipelines.json"))):
        for i, s in enumerate(p["stations"]):
            if s.get("lat") is None or s.get("lng") is None:
                continue
            anchors.append({"id": f"pl:{p['fips']}:{i}", "cls": "pipeline_station", "name": s["name"], "line": p["title"], "lat": s["lat"], "lng": s["lng"], "radius_m": MILE / 2, "fips": p["fips"],
                            "locationVerified": bool(s.get("verified")), "locationNote": s.get("desc")})
    # (b) corridor stop cities
    corr = json.load(open(os.path.join(ROOT, "app/data/intercity_transit_corridors.json")))
    stops = []
    for c in corr:
        for s in c.get("proposed_stations") or []:
            m = re.search(r"GEOID (\d{7})", s.get("coordinate_basis") or "")
            stops.append({"corridor": c["name"], "corridorId": c["id"], "city": s.get("city") or s.get("name"), "state": s.get("state"), "fips": s.get("fips"), "lat": s.get("lat"), "lng": s.get("lng"), "geoid": m.group(1) if m else None})
    notes["stops_total"] = len(stops)
    geoids = sorted({s["geoid"] for s in stops if s["geoid"]})
    pop = {}
    for i in range(0, len(geoids), 40):
        w = "GEOID IN (" + ",".join("'%s'" % g for g in geoids[i:i + 40]) + ")"
        for layer in (26, 28):   # incorporated places, census designated places
            for f in tiger(layer, w, "GEOID,NAME,POP100")["features"]:
                pop[f["attributes"]["GEOID"]] = (f["attributes"]["NAME"], f["attributes"]["POP100"])
    uniq = {}
    for s in stops:
        uniq.setdefault(s["geoid"] or (s["city"], s["state"]), []).append(s)
    notes["stop_cities_unique"] = len(uniq)
    cands, nosvc, nopop = [], [], []
    for k, L in uniq.items():
        s = L[0]
        svc = parcel_service_for(s["fips"], services) if s["fips"] else None
        pp = pop.get(s["geoid"]) if s["geoid"] else None
        if not svc:
            nosvc.append(f"{s['city']}, {s['state']}"); continue
        if not pp:
            nopop.append(f"{s['city']}, {s['state']}"); continue
        cands.append((pp[1], pp[0], k, L))
    cands.sort(key=lambda x: -x[0])
    notes["stop_cities_with_parcel_service_and_population"] = len(cands)
    notes["stop_cities_without_parcel_service"] = len(nosvc)
    notes["stop_cities_without_population_or_place_id"] = nopop
    for rank, (pp_, nm, k, L) in enumerate(cands[:40], 1):
        s = L[0]
        anchors.append({"id": f"sc:{s['geoid']}", "cls": "corridor_stop_city", "name": s["city"] + " stop city centre", "line": "; ".join(sorted({x["corridor"] for x in L})), "lat": s["lat"], "lng": s["lng"],
                        "radius_m": MILE, "fips": s["fips"], "cityPop2020": pp_, "popRank": rank, "placeGeoid": s["geoid"],
                        "locationVerified": False, "locationNote": "stop city centre (Census internal point of the place), not a station site"})
    notes["stop_cities_covered"] = min(40, len(cands))
    # (c) existing stations, 15 largest counties on file
    onfile = county_name_pop_on_file()
    ranked = sorted(((cpop.get(f, 0), f) for f in onfile), reverse=True)[:15]
    notes["top15_counties"] = []
    for p_, f in ranked:
        st, meta, _ = bundle_stations(f)
        notes["top15_counties"].append({"fips": f, "name": meta.get("county"), "pop2020": p_, "stations": len(st)})
        seen = set()
        for i, (n, lng, lat) in enumerate(st):
            key = (n, round(lng, 4), round(lat, 4))
            if key in seen:
                continue
            seen.add(key)
            anchors.append({"id": f"ex:{f}:{i}", "cls": "existing_station", "name": n or "unnamed station", "line": None, "lat": lat, "lng": lng, "radius_m": MILE / 2, "fips": f,
                            "locationVerified": True, "locationNote": "rail station point from the county data file (OpenStreetMap, matched to a service)"})
    for a in anchors:
        a["state"] = FIPS_TO_STATE.get(a["fips"][:2]) if a.get("fips") else None
        svc = parcel_service_for(a["fips"], services) if a.get("fips") else None
        a["parcelService"] = svc["name"] if svc else None
    json.dump({"anchors": anchors, "notes": notes, "made": time.strftime("%Y-%m-%d")}, open(os.path.join(outdir, "anchors.json"), "w"), indent=0)
    from collections import Counter
    print(Counter(a["cls"] for a in anchors)); print(json.dumps(notes, indent=1)[:3000])


if __name__ == "__main__":
    main(sys.argv[1])
