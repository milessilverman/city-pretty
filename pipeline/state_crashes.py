"""Config-driven reader for statewide crash layers published on ArcGIS (region.STATE_DEFAULTS[<st>]["crashes"], kind "arcgis_map").
Each job is one layer (or one year's layer) with its own field map; every record becomes the pipeline's compact crash row
    [id, lat, lon, killed, serious (A) injuries, pedestrian 0/1, bicycle 0/1, 'YYYY-MM-DD', persons injured]
(the same rows the Illinois and Virginia readers write, so sources_oc.py and sites.py read them unchanged).

Field specs in a job's "map":
  "FIELD"                    the field's number (strings such as "2" are read as numbers; empty = 0)
  {"sum": [F, ...]}          sum of several count fields
  {"gt0": F}                 1 if the field's number is above 0
  {"eq": [F, [values]]}      1 if the field (trimmed) is one of the values
  {"any": [spec, ...]}       1 if any spec is non-zero
  date: {"epoch": F} (ArcGIS date, ms) | {"text": F} ('YYYY-MM-DD...' or a yyyymmdd number) | {"ym": [YEAR, MONTH]} ('YYYY-MM-01')
  lat / lon: field names, or "geometry" (point geometry, requested in WGS84); "lon_negative": true fixes longitudes stored unsigned
A job may set "dedupe": true when its layer repeats identical rows per crash (the first row per id is kept)."""
import json, time


def num(v):
    if v is None or v == "":
        return 0
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def val(spec, a):
    if spec is None:
        return 0
    if isinstance(spec, str):
        return num(a.get(spec))
    if "sum" in spec:
        return sum(num(a.get(f)) for f in spec["sum"])
    if "gt0" in spec:
        return 1 if num(a.get(spec["gt0"])) > 0 else 0
    if "eq" in spec:
        f, vals = spec["eq"]; v = a.get(f)
        v = v.strip() if isinstance(v, str) else v
        return 1 if v in vals else 0
    if "any" in spec:
        return 1 if any(val(s, a) for s in spec["any"]) else 0
    raise ValueError(f"unknown field spec {spec}")


def date_of(spec, a):
    if "epoch" in spec:
        d = a.get(spec["epoch"])
        return time.strftime("%Y-%m-%d", time.gmtime(d / 1000)) if isinstance(d, (int, float)) else ""
    if "text" in spec:
        d = a.get(spec["text"])
        if isinstance(d, (int, float)):
            d = str(int(d))
        d = (d or "").strip()
        if len(d) >= 8 and d[:8].isdigit():
            return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        return d[:10]
    if "ym" in spec:
        y, m = num(a.get(spec["ym"][0])), num(a.get(spec["ym"][1]))
        return f"{y:04d}-{m:02d}-01" if y and 1 <= m <= 12 else (f"{y:04d}-01-01" if y else "")
    raise ValueError(f"unknown date spec {spec}")


def fields_of(m):
    out = set()

    def walk(s):
        if isinstance(s, str):
            out.add(s)
        elif isinstance(s, dict):
            for k, v in s.items():
                if k == "eq":
                    out.add(v[0])
                elif isinstance(v, list):
                    for x in v:
                        walk(x)
                else:
                    walk(v)
        elif isinstance(s, list):
            for x in s:
                walk(x)
    for k, s in m.items():
        if k in ("lat", "lon") and s == "geometry" or k == "lon_negative":
            continue
        walk(s)
    return sorted(out)


def to_row(m, a, g):
    if m.get("lat") == "geometry":
        lat, lon = (g or {}).get("y"), (g or {}).get("x")
    else:
        lat, lon = a.get(m["lat"]), a.get(m["lon"])
    try:
        lat = float(lat) if lat not in (None, "") else None; lon = float(lon) if lon not in (None, "") else None
    except (TypeError, ValueError):
        lat = lon = None
    if not lat or not lon:   # a 0 coordinate means none
        lat = lon = None
    elif m.get("lon_negative"):
        lon = -abs(lon)
    rid = a.get(m["id"]) if m.get("id") else None
    if isinstance(rid, float) and rid.is_integer():
        rid = int(rid)
    return [rid, lat, lon, val(m.get("killed"), a), val(m.get("serious"), a), val(m.get("ped"), a), val(m.get("bike"), a),
            date_of(m["date"], a), val(m.get("injured"), a)]


def fetch_job(job, get, geo, log, page=2000):
    """all records of one job inside the county envelope (geo: ArcGIS envelope query params) -> rows, layer metadata"""
    meta = json.loads(get(job["url"], {"f": "json"}))
    oid = meta.get("objectIdField") or next((f["name"] for f in meta.get("fields", []) if f.get("type") == "esriFieldTypeOID"), "OBJECTID")
    m = job["map"]; geom = m.get("lat") == "geometry"
    q = {"where": job.get("where", "1=1"), **geo}
    n = json.loads(get(f"{job['url']}/query", {**q, "returnCountOnly": "true", "f": "json"}))["count"]
    rows, off, seen, dup = [], 0, set(), 0
    while off < n:
        j = json.loads(get(f"{job['url']}/query", {**q, "outFields": ",".join(fields_of(m) + [oid]), "returnGeometry": "true" if geom else "false",
                                                                 **({"outSR": "4326"} if geom else {}), "f": "json", "resultOffset": off,
                                                                 "resultRecordCount": min(page, meta.get("maxRecordCount") or page), "orderByFields": oid}, timeout=900))
        feats = j.get("features", [])
        if not feats:
            break
        for f in feats:
            r = to_row(m, f["attributes"], f.get("geometry"))
            if job.get("dedupe"):
                if r[0] in seen:
                    dup += 1; continue
                seen.add(r[0])
            rows.append(r)
        off += len(feats)
    assert off == n, (job["url"], off, n)
    log("   state crashes", job.get("label", ""), n, "records", f"({dup} repeated rows dropped)" if dup else "")
    return rows, (meta.get("editingInfo") or {}).get("dataLastEditDate")
