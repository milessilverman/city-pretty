#!/usr/bin/env python3
"""Step 1 of the site zoning work (docs/audit/site-zoning-2026-11-23.md): which government zones each station-area site,
and whether the site's parcel record carries a zoning code.

For each of the sites in app/data/station_sites/<fips>.json, the site's interior point (`pt`) is placed in the Census
TIGER/Line 2024 place outlines of its state. A place with FUNCSTAT "A" (an active government: an incorporated city,
town or village) zones the site; a point in a census-designated place (FUNCSTAT "S", no government) or in no place is
unincorporated land, which is the county's (the county from the site's census tract in app/data/station_site_places,
else the county file it is listed in). Whether that county zones its unincorporated land at all is not decided here.

Writes
  data/backtests/site_zoning_by_city_2026-11-23.json and .md   the table by jurisdiction (sites, sites whose parcel record
                                                               carries a zoning code, distinct codes with counts)
  <work>/site_juris.json                                       per site: fips, osm id, point, jurisdiction id and name
Inputs: <work>/tiger/tl_2024_<state>_place.zip (https://www2.census.gov/geo/tiger/TIGER2024/PLACE/), downloaded by hand.
Usage: python3 -I pipeline/site_zoning_measure.py <work>
"""
import collections
import glob
import hashlib
import io
import json
import os
import sys
import zipfile

import shapefile
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = os.path.join(ROOT, "app", "data", "station_sites")
PLACES = os.path.join(ROOT, "app", "data", "station_site_places")
URL = "https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_{s}_place.zip"
# The zoning services the page already registers (ZONING_SERVICES in app/app.js, and the point layers named in
# app/data/zoning_standards.json); read from the files so the table states what is on file, not a typed list.


def registered_services():
    src = open(os.path.join(ROOT, "app", "app.js"), encoding="utf8").read()
    i = src.index("const ZONING_SERVICES = {")
    j = src.index("\n};", i)
    out = {}
    for line in src[i:j].splitlines()[1:]:
        line = line.strip()
        if not line.startswith('"'):
            continue
        fips = line[1:6]
        url = line.split('url: "')[1].split('"')[0]
        juris = line.split('juris: "')[1].split('"')[0] if 'juris: "' in line else None
        out.setdefault(fips, []).append({"url": url, "juris": juris, "from": "app/app.js ZONING_SERVICES"})
    zs = json.load(open(os.path.join(ROOT, "app", "data", "zoning_standards.json")))
    for j in zs["jurisdictions"]:
        z = j.get("zone_source") or {}
        if z.get("kind") == "point_layer":
            for f in j["counties"]:
                out.setdefault(f, []).append({"url": z["url"], "juris": j["name"], "from": "app/data/zoning_standards.json " + j["id"]})
    return out


def load_places(work, state):
    p = os.path.join(work, "tiger", f"tl_2024_{state}_place.zip")
    raw = open(p, "rb").read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    base = [n for n in z.namelist() if n.endswith(".shp")][0][:-4]
    r = shapefile.Reader(shp=io.BytesIO(z.read(base + ".shp")), dbf=io.BytesIO(z.read(base + ".dbf")), shx=io.BytesIO(z.read(base + ".shx")))
    fields = [f[0] for f in r.fields[1:]]
    geoms, recs = [], []
    for sr in r.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        geoms.append(shape(sr.shape.__geo_interface__))
        recs.append({"geoid": rec["GEOID"], "name": rec["NAMELSAD"], "short": rec["NAME"], "funcstat": rec["FUNCSTAT"], "lsad": rec["LSAD"]})
    return STRtree(geoms), geoms, recs, hashlib.sha256(raw).hexdigest()


def main(work):
    files = sorted(glob.glob(os.path.join(SITES, "[0-9]" * 5 + ".json")))
    docs = [json.load(open(f)) for f in files]
    states = sorted({d["fips"][:2] for d in docs})
    # a site's point can lie in another state's file only if a station is across a state line; the tract says which
    trees, hashes = {}, {}
    county_names = {d["fips"]: d["county"] for d in docs}
    per_site, J = [], {}
    for d in docs:
        places = json.load(open(os.path.join(PLACES, d["fips"] + ".json"))) if os.path.exists(os.path.join(PLACES, d["fips"] + ".json")) else {"sites": {}}
        for s in d["sites"]:
            pr = places["sites"].get(s["id"])
            pcounty = pr[0][:5] if pr and pr[0] else d["fips"]
            st = pcounty[:2]
            if st not in trees:
                tr, gs, rs, h = load_places(work, st)
                trees[st] = (tr, gs, rs)
                hashes[st] = h
            tr, gs, rs = trees[st]
            lat, lng = s["pt"]
            pt = Point(lng, lat)
            hit = None
            for k in tr.query(pt):
                if gs[k].contains(pt):
                    hit = rs[k]
                    break
            if hit and hit["funcstat"] in ("A", "F"):
                # F: the balance of a consolidated city-county (Nashville-Davidson, Indianapolis), which the consolidated
                # government zones; TIGER codes it "fictitious" because the consolidated government is the county too
                jid, jname, jkind = "place:" + hit["geoid"], hit["name"], "incorporated place" if hit["funcstat"] == "A" else "consolidated city-county (balance)"
            elif st == "11":
                jid, jname, jkind = "county:11001", "District of Columbia", "the District (one government; no counties or cities inside it)"
            else:
                jid = "county:" + pcounty
                jname = (county_names.get(pcounty) or ("county " + pcounty)) + " (unincorporated)"
                jkind = "unincorporated" + ("; in " + hit["name"] + ", a census-designated place with no government" if hit else "")
            p = s.get("p") or {}
            zn = p.get("zn") or None
            per_site.append({"fips": d["fips"], "id": s["id"], "pt": s["pt"], "ac": s["ac"], "county": pcounty, "juris": jid, "jname": jname, "jkind": jkind, "zn": zn, "parcel": bool(s.get("p")), "pa": p.get("pa"), "mm": bool(p.get("mm"))})
            e = J.setdefault(jid, {"id": jid, "name": jname, "kind": jkind.split(";")[0], "county": pcounty, "files": collections.Counter(), "sites": 0, "with_parcel": 0, "with_code": 0, "codes": collections.Counter()})
            e["sites"] += 1
            e["files"][d["fips"]] += 1
            e["with_parcel"] += 1 if s.get("p") else 0
            if zn:
                e["with_code"] += 1
                e["codes"][zn] += 1
    svc = registered_services()
    rows = sorted(J.values(), key=lambda e: -e["sites"])
    out = {"built": "2026-11-23", "script": "pipeline/site_zoning_measure.py", "sites": len(per_site),
           "method": "site interior point in Census TIGER/Line 2024 place outlines; FUNCSTAT A (active government) zones the site, otherwise the county (unincorporated land)",
           "place_files": {st: {"url": URL.format(s=st), "sha256": h} for st, h in sorted(hashes.items())},
           "registered_zoning_services": svc,
           "jurisdictions": [{"id": e["id"], "name": e["name"], "kind": e["kind"], "county": e["county"], "listed_in": dict(e["files"]), "sites": e["sites"], "with_parcel": e["with_parcel"], "with_code": e["with_code"],
                              "distinct_codes": len(e["codes"]), "codes": e["codes"].most_common()} for e in rows]}
    os.makedirs(os.path.join(ROOT, "data", "backtests"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "data", "backtests", "site_zoning_by_city_2026-11-23.json"), "w"), indent=1)
    json.dump(per_site, open(os.path.join(work, "site_juris.json"), "w"))
    md = ["# Station-area sites by the government that zones them (2026-11-23)", "",
          f"{len(per_site)} sites (app/data/station_sites). Jurisdiction: the site's interior point in the Census TIGER/Line 2024 place outlines; an incorporated place (FUNCSTAT A) zones the site, otherwise it is the county's unincorporated land. `Code on record` = the county parcel service returned a zoning field for the matched parcel (station_sites `p.zn`). `Registered zoning service` = a point-queryable zoning layer already on file for the county (app/app.js `ZONING_SERVICES`, app/data/zoning_standards.json point layers); whether it covers this city is in the audit.", "",
          "| # | Jurisdiction | County | Sites | Parcel matched | Code on record | Distinct codes | Most common codes (sites) | Registered zoning service for the county |", "|---|---|---|---|---|---|---|---|---|"]
    for i, e in enumerate(out["jurisdictions"], 1):
        top = ", ".join(f"{c} ({n})" for c, n in e["codes"][:8]) + (" ..." if len(e["codes"]) > 8 else "")
        sv = "; ".join(sorted({x["url"] for x in svc.get(e["county"], [])})) or "none on file"
        md.append(f"| {i} | {e['name']} | {e['county']} | {e['sites']} | {e['with_parcel']} | {e['with_code']} | {e['distinct_codes']} | {top or '-'} | {sv} |")
    open(os.path.join(ROOT, "data", "backtests", "site_zoning_by_city_2026-11-23.md"), "w").write("\n".join(md) + "\n")
    print("\n".join(md[:60]))


if __name__ == "__main__":
    main(sys.argv[1])
