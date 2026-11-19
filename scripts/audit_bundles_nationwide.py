#!/usr/bin/env python3
"""Sample audit of the public-data values inside the non-LA county bundles (counties/bundle_*.json.gz).

Part 1 (this file, `acs`): Census ACS fields. For a seeded, state-stratified sample of block groups, re-read the same
values from the Census Bureau's own 2020-2024 ACS 5-year table-based summary files on www2.census.gov (no API key),
re-derive each bundle field with the pipeline's own rules (pipeline/metrics_oc.py lines ~500-592: tract fallback for
missing block-group home value / rent, $2,000,001 top code, rounded percentages) and compare exactly.

Usage: python3 scripts/audit_bundles_nationwide.py acs [--seed 20261116] [--per-state 3] [--per-county 10]
Writes docs/audit/bundles-nationwide-audit.json (section "acs") and prints a summary.
"""
import gzip
import json
import os
import random
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "audit", "bundles-nationwide-audit.json")
ACS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData"
UA = {"User-Agent": "city-pretty-audit/1.0"}
# Same variables as pipeline/fetch_oc.py ACS_VARS (only those behind fields the bundle stores)
VARS = {"pop": "B01003_E001", "units": "B25001_E001", "occ": "B25003_E001", "owner": "B25003_E002", "hv": "B25077_E001",
        "rent": "B25064_E001", "inc": "B19013_E001", "yb": "B25035_E001", "units_all": "B25024_E001", "sf_det": "B25024_E002",
        "sf_att": "B25024_E003", "hh": "B25044_E001", "nocar_own": "B25044_E003", "nocar_rent": "B25044_E010"}


def arg(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def load_bundle(p):
    return json.loads(gzip.decompress(open(p, "rb").read()))


def sample(seed, per_state, per_county):
    files = sorted(f for f in os.listdir(os.path.join(ROOT, "counties")) if f.startswith("bundle_"))
    by_state = defaultdict(list)
    for f in files:
        by_state[f[7:9]].append(f)
    rng = random.Random(seed)
    picks = []
    for st in sorted(by_state):
        for f in sorted(rng.sample(by_state[st], min(per_state, len(by_state[st])))):
            d = load_bundle(os.path.join(ROOT, "counties", f))
            det = d["details"]
            gids = sorted(g for g in det if (det[g].get("m") or {}).get("homes") is not None or (det[g].get("m") or {}).get("pop") is not None)
            for g in sorted(rng.sample(gids, min(per_county, len(gids)))):
                picks.append({"file": f, "county": d["meta"].get("county"), "built": d["meta"].get("built"), "acs": d["meta"].get("acs"), "gid": g, "m": det[g]["m"]})
    return picks


def stream_table(table, wanted):
    """Read one ACS table file line by line, keep only rows for wanted GEO_IDs."""
    url = f"{ACS_BASE}/acsdt5y2024-{table}.dat"
    rows = {}
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=1800) as r:
        hdr = r.readline().decode("utf-8").rstrip("\n").split("|")
        for raw in r:
            line = raw.decode("utf-8", "replace")
            gid = line[:line.index("|")]
            if gid in wanted:
                rows[gid] = dict(zip(hdr, line.rstrip("\n").split("|")))
    return url, rows


def num(v):  # identical to pipeline/fetch_oc.py: Census jam values (<= -222222222) become None
    try:
        x = float(v)
    except Exception:
        return None
    return None if x <= -222222222 else x


def derive(a, tract):
    """Re-derive the bundle fields exactly as pipeline/metrics_oc.py does."""
    units = a.get("units") or 0; occ = a.get("occ") or 0; owner = a.get("owner") or 0
    sf = (((a.get("sf_det") or 0) + (a.get("sf_att") or 0)) / a["units_all"] * 100) if a.get("units_all") else None
    hv = a.get("hv"); hv_src = "bg" if hv else None
    if not hv and tract.get("hv") and units:
        hv = tract["hv"]; hv_src = "tract"
    if hv and hv >= 2000001:
        hv = 2000001
    rent = a.get("rent"); rent_src = "bg" if rent else None
    if not rent and tract.get("rent") and units:
        rent = tract["rent"]; rent_src = "tract"
    nocar = (a.get("nocar_own") or 0) + (a.get("nocar_rent") or 0) if a.get("hh") is not None else None
    return {
        "hv": hv, "homes": units, "own": round(owner / occ * 100) if occ else None, "pop": a.get("pop"), "inc": a.get("inc"),
        "rent": rent, "yb": a.get("yb"), "sf": round(sf) if sf is not None else None,
        "nocar": round((nocar or 0) / a["hh"] * 100) if a.get("hh") else None,
    }, hv_src, rent_src


def acs():
    seed, per_state, per_county = arg("--seed", 20261116), arg("--per-state", 3), arg("--per-county", 10)
    picks = sample(seed, per_state, per_county)
    print(f"sample: {len(picks)} block groups in {len({p['file'] for p in picks})} counties, {len({p['file'][7:9] for p in picks})} states", file=sys.stderr)
    wanted = {"1500000US" + p["gid"] for p in picks} | {"1400000US" + p["gid"][:11] for p in picks}
    tables = sorted({v.split("_")[0].lower() for v in VARS.values()})
    raw, urls = defaultdict(dict), {}
    for t in tables:
        urls[t], rows = stream_table(t, wanted)
        for g, d in rows.items():
            raw[g].update(d)
        print(f"  {t}: {len(rows)} rows", file=sys.stderr)

    fields = ["hv", "homes", "own", "pop", "inc", "rent", "yb", "sf", "nocar"]
    stats = {f: {"compared": 0, "exact": 0, "mismatch": 0, "bundle_null_census_has": 0, "bundle_has_census_null": 0} for f in fields}
    examples, label_checks = defaultdict(list), {"hv_tract_fallback": 0, "hv_tract_label_ok": 0, "hv_bg": 0, "hv_bg_label_ok": 0, "hv_none": 0, "hv_none_label_ok": 0}
    missing_geo = 0
    for p in picks:
        bg = raw.get("1500000US" + p["gid"])
        if not bg:
            missing_geo += 1
            continue
        a = {k: num(bg.get(v)) for k, v in VARS.items()}
        tr = raw.get("1400000US" + p["gid"][:11]) or {}
        tract = {k: num(tr.get(VARS[k])) for k in ("hv", "rent")}
        exp, hv_src, _ = derive(a, tract)
        m = p["m"]
        for f in fields:
            b, c = m.get(f), exp[f]
            s = stats[f]
            if b is None and c is None:
                continue
            s["compared"] += 1
            if b is None:
                s["bundle_null_census_has"] += 1; ok = False
            elif c is None:
                s["bundle_has_census_null"] += 1; ok = False
            else:
                ok = abs(float(b) - float(c)) < 0.5
            if ok:
                s["exact"] += 1
            else:
                s["mismatch"] += 1
                if len(examples[f]) < 8:
                    examples[f].append({"gid": p["gid"], "county": p["county"], "bundle": b, "census": c})
        hvs = m.get("hvs") or ""
        if hv_src == "tract":
            label_checks["hv_tract_fallback"] += 1; label_checks["hv_tract_label_ok"] += "tract" in hvs
        elif hv_src == "bg":
            label_checks["hv_bg"] += 1; label_checks["hv_bg_label_ok"] += "this block group" in hvs
        else:
            label_checks["hv_none"] += 1; label_checks["hv_none_label_ok"] += (m.get("hv") is None)
    vintages = sorted({p["acs"] for p in picks if p["acs"]})
    result = {
        "seed": seed, "per_state": per_state, "per_county": per_county, "n_block_groups": len(picks),
        "counties": sorted({p["file"] for p in picks}), "bundle_acs_vintages": vintages, "source_files": urls,
        "block_groups_not_in_census_file": missing_geo, "fields": stats, "examples": examples, "home_value_labels": label_checks,
        "sample": [{"file": p["file"], "gid": p["gid"]} for p in picks],
    }
    doc = json.load(open(OUT)) if os.path.exists(OUT) else {}
    doc["acs"] = result
    json.dump(doc, open(OUT, "w"), indent=1)
    print(json.dumps({k: result[k] for k in ("n_block_groups", "bundle_acs_vintages", "block_groups_not_in_census_file", "fields", "home_value_labels")}, indent=1))
    for f, ex in examples.items():
        print(f, ex[:3])


def fallback():
    """Full scan (all bundles, all block groups): where a block group has homes but no home value or rent, did the bundle
    apply the tract fallback that pipeline/metrics_oc.py specifies? Census tract values come from the same table files."""
    files = sorted(f for f in os.listdir(os.path.join(ROOT, "counties")) if f.startswith("bundle_"))
    nulls = []
    for f in files:
        d = load_bundle(os.path.join(ROOT, "counties", f))
        for g, v in d["details"].items():
            m = v.get("m") or {}
            if m.get("homes"):
                for fld in ("hv", "rent"):
                    if m.get(fld) is None:
                        nulls.append((f, d["meta"].get("county"), g, fld))
    wanted = {"1400000US" + g[:11] for _, _, g, _ in nulls}
    tract = {}
    for t, var, fld in (("b25077", "B25077_E001", "hv"), ("b25064", "B25064_E001", "rent")):
        _, rows = stream_table(t, wanted)
        for gid, row in rows.items():
            tract[(gid[9:], fld)] = num(row.get(var))
    missed = [(f, c, g, fld, tract.get((g[:11], fld))) for f, c, g, fld in nulls if tract.get((g[:11], fld))]
    by_county = defaultdict(lambda: {"hv": 0, "rent": 0})
    for f, c, g, fld, _ in missed:
        by_county[f"{f[7:12]} {c}"][fld] += 1
    result = {"block_groups_with_homes_and_null_value": len(nulls), "tract_value_available_but_not_applied": len(missed),
              "by_county": dict(sorted(by_county.items())), "examples": [dict(zip(("file", "county", "gid", "field", "tract_value"), x)) for x in missed[:20]]}
    # Correction file: the tract value the pipeline's own rule would have used, labelled the way the pipeline labels it.
    corr = {"_source": {
        "why": "The California county bundles outside LA and Orange County did not apply the tract fallback for block groups with homes "
               "but no block-group value (pipeline/metrics_oc.py ~504-512). Found by scripts/audit_bundles_nationwide.py fallback.",
        "values_from": {"hv": f"{ACS_BASE}/acsdt5y2024-b25077.dat (B25077_E001, tract rows)", "rent": f"{ACS_BASE}/acsdt5y2024-b25064.dat (B25064_E001, tract rows)"},
        "vintage": "2020-2024 ACS 5-year", "rule": "hv capped at 2000001 as in the pipeline",
        "built": __import__("datetime").date.today().isoformat()},
        "block_groups": {}}
    for f, c, g, fld, val in missed:
        e = corr["block_groups"].setdefault(g, {})
        if fld == "hv":
            e["hv"] = min(val, 2000001)
            e["hvs"] = "Census ACS 2020-24 median value for the surrounding Census tract (no block-group value published)"
        else:
            e["rent"] = val
            e["rent_s"] = "tract median"
    json.dump(corr, open(os.path.join(ROOT, "app", "data", "bundle_corrections.json"), "w"), separators=(",", ":"))
    doc = json.load(open(OUT)) if os.path.exists(OUT) else {}
    doc["tract_fallback_scan"] = result
    json.dump(doc, open(OUT, "w"), indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != "examples"}, indent=1))


GTFS_COUNTIES = [("bundle_01101.json.gz", "338"), ("bundle_16001.json.gz", "142"), ("bundle_18003.json.gz", "2266"),
                 ("bundle_31055.json.gz", "2261"), ("bundle_39113.json.gz", "403"), ("bundle_51810.json.gz", "473")]


def bg_centroids(state, county, gids):
    """Census TIGERweb block-group polygons -> centroid in a local metric projection (pipeline uses the land-clipped centroid)."""
    import math
    from shapely.geometry import Polygon
    out = {}
    for i in range(0, len(gids), 50):
        chunk = gids[i:i + 50]
        q = urllib.parse.urlencode({"where": "GEOID IN (" + ",".join(f"'{g}'" for g in chunk) + ")", "outFields": "GEOID",
                                    "returnGeometry": "true", "outSR": "4326", "f": "json"})
        url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query?" + q
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            for f in json.load(r)["features"]:
                rings = f["geometry"]["rings"]
                lat0 = rings[0][0][1]
                kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
                outer = max(rings, key=lambda rr: abs(Polygon(rr).area))
                c = Polygon([(x * kx, y * ky) for x, y in outer]).centroid
                out[f["attributes"]["GEOID"]] = (c.x / kx, c.y / ky)
    return out


def gtfs_stop_rates(zip_bytes, day):
    """Bus departures 07:00-09:00 on `day` per stop location, summed over routes, / 2 = buses per hour (pipeline rule;
    untimed stop_times are skipped here, interpolated in the pipeline)."""
    import csv, io, zipfile, datetime
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(n), "utf-8-sig"))) if n in z.namelist() else []
    bus = {r["route_id"] for r in rd("routes.txt") if (r.get("route_type") or "").strip() in ("3",) or (r.get("route_type") or "").strip().startswith("7")}
    ds, wd = day.strftime("%Y%m%d"), day.strftime("%A").lower()
    on = {c["service_id"] for c in rd("calendar.txt") if c.get(wd) == "1" and c["start_date"] <= ds <= c["end_date"]}
    for c in rd("calendar_dates.txt"):
        if c.get("date") == ds:
            (on.add if c.get("exception_type") == "1" else on.discard)(c["service_id"])
    trips = {t["trip_id"] for t in rd("trips.txt") if t.get("route_id") in bus and t.get("service_id") in on}
    stops = {s["stop_id"]: (float(s["stop_lon"]), float(s["stop_lat"])) for s in rd("stops.txt") if s.get("stop_lat") and s.get("stop_lon")}
    per = defaultdict(float)
    with z.open("stop_times.txt") as fh:
        for st in csv.DictReader(io.TextIOWrapper(fh, "utf-8-sig")):
            if st["trip_id"] not in trips:
                continue
            t = (st.get("departure_time") or st.get("arrival_time") or "").strip()
            if not t:
                continue
            h, m, s = (int(x) for x in t.split(":"))
            sec = h * 3600 + m * 60 + s
            if 25200 <= sec < 32400 and st["stop_id"] in stops:
                lon, lat = stops[st["stop_id"]]
                per[(round(lon, 5), round(lat, 5))] += 0.5
    return per, len(on), len(trips)


def gtfs():
    import datetime, math, re
    rows = []
    sample_bg = defaultdict(list)
    for s in json.load(open(OUT))["acs"]["sample"]:
        sample_bg[s["file"]].append(s["gid"])
    for f, fid in GTFS_COUNTIES:
        d = load_bundle(os.path.join(ROOT, "counties", f))
        src = next(s for s in d["meta"]["sources"] if s[0].startswith("GTFS feeds"))
        day = datetime.date.fromisoformat(re.search(r"\(MobilityData [\w-]+, (\d{4}-\d\d-\d\d)\)", src[1]).group(1))
        url = f"https://files.mobilitydatabase.org/mdb-{fid}/latest.zip"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
            zb, modified = r.read(), r.headers.get("Last-Modified")
        per, n_svc, n_trips = gtfs_stop_rates(zb, day)
        day_used = day
        if not n_trips:   # the measured Wednesday is no longer in the current feed's calendar: use the next Wednesday
            today = datetime.date(2026, 11, 16)
            day_used = today + datetime.timedelta(days=(2 - today.weekday()) % 7)
            per, n_svc, n_trips = gtfs_stop_rates(zb, day_used)
        gids = sample_bg[f]
        cents = bg_centroids(f[7:9], f[9:12], gids)
        for g in gids:
            if g not in cents:
                continue
            lon, lat = cents[g]
            kx, ky = 111320 * math.cos(math.radians(lat)), 110540
            near = [v for (x, y), v in per.items() if math.hypot((x - lon) * kx, (y - lat) * ky) <= 400]
            now = max(near) if near else 0.0
            b = d["details"][g]["m"].get("bt")
            rows.append({"file": f, "county": d["meta"]["county"], "feed": fid, "feed_last_modified": modified, "bundle_weekday": day.isoformat(),
                         "recheck_weekday": day_used.isoformat(), "gid": g, "bundle_bt": b, "recheck_bt": now})
        print(f"  {f} {d['meta']['county']}: feed {fid} modified {modified}; weekday {day_used} ({n_trips} bus trips)", file=sys.stderr)
    comp = [r for r in rows if r["bundle_bt"] is not None]
    within1 = sum(1 for r in comp if abs(r["bundle_bt"] - r["recheck_bt"]) <= 1)
    exact = sum(1 for r in comp if abs(r["bundle_bt"] - r["recheck_bt"]) < 0.05)
    result = {"counties": [c for c, _ in GTFS_COUNTIES], "block_groups": len(rows), "compared": len(comp), "exact": exact, "within_1_bus_per_hour": within1,
              "bundle_unknown_bt": len(rows) - len(comp),
              "method_note": "Re-check applies the pipeline's rule to the current MobilityData feed; untimed stop times are skipped (the pipeline interpolates them) and the stop centre is the Census polygon centroid (the pipeline uses the land-clipped centroid), so small differences mix schedule drift with method.",
              "rows": rows}
    doc = json.load(open(OUT))
    doc["gtfs"] = result
    json.dump(doc, open(OUT, "w"), indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, indent=1))
    for r in comp:
        if abs(r["bundle_bt"] - r["recheck_bt"]) > 1:
            print("   differs:", r["county"], r["gid"], r["bundle_bt"], "->", r["recheck_bt"])


FAC_COUNTIES = ["bundle_01101.json.gz", "bundle_04019.json.gz", "bundle_13121.json.gz", "bundle_17031.json.gz", "bundle_26163.json.gz",
                "bundle_31055.json.gz", "bundle_36061.json.gz", "bundle_39113.json.gz", "bundle_41051.json.gz", "bundle_48453.json.gz",
                "bundle_51810.json.gz", "bundle_53033.json.gz"]
NCES = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0/query?"
AFDC = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/Alternative_Fueling_Stations/FeatureServer/0/query?"


def haversine(lon1, lat1, lon2, lat2):
    import math
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(a))


def nearest(url, where_extra, fields, lon, lat, lonf, latf, box=0.15):
    w = f"{latf}>{lat - box} AND {latf}<{lat + box} AND {lonf}>{lon - box} AND {lonf}<{lon + box}" + (f" AND {where_extra}" if where_extra else "")
    q = urllib.parse.urlencode({"where": w, "outFields": fields, "returnGeometry": "false", "f": "json", "resultRecordCount": 2000})
    with urllib.request.urlopen(urllib.request.Request(url + q, headers=UA), timeout=120) as r:
        feats = json.load(r).get("features", [])
    ds = [(haversine(lon, lat, f["attributes"][lonf], f["attributes"][latf]), f["attributes"]) for f in feats if f["attributes"].get(latf) is not None]
    return min(ds, key=lambda x: x[0]) if ds else (None, None)


def facilities():
    """Distance from each sampled block group's representative point (pipeline rule) to the nearest public school (NCES EDGE,
    current) and the nearest public DC fast charger (AFDC copy on the USDOT/BTS service), compared with the bundle."""
    from shapely.geometry import Polygon
    import time
    sample_bg = defaultdict(list)
    for s in json.load(open(OUT))["acs"]["sample"]:
        sample_bg[s["file"]].append(s["gid"])
    rows = []
    for f in FAC_COUNTIES:
        gids = sample_bg.get(f)
        if not gids:
            d = load_bundle(os.path.join(ROOT, "counties", f))
            gids = sorted(random.Random(7).sample(sorted(d["details"]), 10))
        d = load_bundle(os.path.join(ROOT, "counties", f))
        q = urllib.parse.urlencode({"where": "GEOID IN (" + ",".join(f"'{g}'" for g in gids) + ")", "outFields": "GEOID", "returnGeometry": "true", "outSR": "4326", "f": "json"})
        with urllib.request.urlopen(urllib.request.Request("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query?" + q, headers=UA), timeout=120) as r:
            polys = {x["attributes"]["GEOID"]: x["geometry"]["rings"] for x in json.load(r)["features"]}
        for g in gids:
            if g not in polys:
                continue
            outer = max(polys[g], key=lambda rr: abs(Polygon(rr).area))
            p = Polygon(outer).representative_point()
            m = d["details"][g]["m"]
            sd, srec = nearest(NCES, None, "NAME,LAT,LON", p.x, p.y, "LON", "LAT")
            time.sleep(0.5)
            ed, erec = nearest(AFDC, "fuel_type_code='ELEC' AND access_code='public' AND status_code='E' AND ev_dc_fast_num>0", "station_name,latitude,longitude", p.x, p.y, "longitude", "latitude", box=0.3)
            time.sleep(0.5)
            rows.append({"file": f, "county": d["meta"]["county"], "gid": g,
                         "school_bundle_m": (m.get("fc") or {}).get("school"), "school_now_m": round(sd, 1) if sd is not None else None, "school_now": (srec or {}).get("NAME"),
                         "ev_bundle_m": m.get("ev"), "ev_now_m": round(ed) if ed is not None else None, "ev_now": (erec or {}).get("station_name")})
        print(f"  {f} {d['meta']['county']}: {len(gids)} block groups", file=sys.stderr)

    def score(key_b, key_n):
        comp = [r for r in rows if r[key_b] is not None and r[key_n] is not None]
        return {"compared": len(comp), "within_25m": sum(abs(r[key_b] - r[key_n]) <= 25 for r in comp),
                "within_100m": sum(abs(r[key_b] - r[key_n]) <= 100 for r in comp),
                "bundle_farther_by_100m_plus": sum(r[key_b] - r[key_n] > 100 for r in comp), "bundle_nearer_by_100m_plus": sum(r[key_n] - r[key_b] > 100 for r in comp),
                "bundle_null": sum(1 for r in rows if r[key_b] is None), "now_null": sum(1 for r in rows if r[key_n] is None)}
    result = {"counties": FAC_COUNTIES, "block_groups": len(rows), "school": score("school_bundle_m", "school_now_m"), "ev_dc_fast": score("ev_bundle_m", "ev_now_m"),
              "note": "Reference point is the Census polygon's representative point (the pipeline's rule, without its water clipping). A charger opened since the build makes the bundle farther; one closed or delisted makes it nearer.",
              "rows": rows}
    doc = json.load(open(OUT))
    doc["facilities"] = result
    json.dump(doc, open(OUT, "w"), indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, indent=1))
    for r in rows:
        for kb, kn, nm in (("school_bundle_m", "school_now_m", "school_now"), ("ev_bundle_m", "ev_now_m", "ev_now")):
            if r[kb] is not None and r[kn] is not None and abs(r[kb] - r[kn]) > 100:
                print("   differs:", r["county"], r["gid"], kb, r[kb], "->", r[kn], r[nm])


if __name__ == "__main__":
    {"acs": acs, "fallback": fallback, "gtfs": gtfs, "facilities": facilities}[sys.argv[1]]()
