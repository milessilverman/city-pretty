#!/usr/bin/env python3
"""Census tract and ZIP Code Tabulation Area of every station-area site, and HUD's QCT / DDA lists for those places.

Writes
  app/data/hud_qct_dda.json                   HUD's 2026 and 2027 qualified census tracts (by tract) for the counties with
                                              a site file, the metropolitan Small DDA flags (by ZCTA) for those counties'
                                              HUD metro areas, and the nonmetropolitan DDA counties; every list with its
                                              source URL, designation year, fetch date and file hash.
  app/data/station_site_places/<fips>.json    for each site id: the 2020 census tract (11-digit GEOID) and the 2020 ZCTA
                                              that contain the site's interior point, and how far that point is from the
                                              tract's and ZCTA's edge.

Inputs (downloaded by hand into <dl>, see docs/audit/site-cards-2026-11-22.md for URLs; nothing is fetched here):
  QCT2026CSV.zip, QCT2027CSV.zip, 2026-DDAs-Data-Used-to-Designate.xlsx, 2027-DDAs-Data-Used-to-Designate.xlsx (HUD User)
  tracts/tl_2023_<state>_tract.zip (Census TIGER/Line 2023 tracts: 2020 tract boundaries)
  cb_2020_us_zcta520_500k.zip (Census cartographic boundary ZCTAs, 2020, 1:500,000: generalised)
Usage: python3 -I pipeline/site_places_build.py <dl>
"""
import csv
import glob
import hashlib
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import date

import openpyxl
import shapefile
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = os.path.join(ROOT, "app", "data", "station_sites")
OUT_DIR = os.path.join(ROOT, "app", "data", "station_site_places")
OUT_QCT = os.path.join(ROOT, "app", "data", "hud_qct_dda.json")
HUD = "https://www.huduser.gov/portal/datasets/qct/"
HUD_DDA = "https://www.huduser.gov/portal/datasets/qct/{y}-DDAs-Data-Used-to-Designate.xlsx"
TRACT_URL = "https://www2.census.gov/geo/tiger/TIGER2023/TRACT/tl_2023_{s}_tract.zip"
ZCTA_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"
# Census TIGERweb, layer "2020 Census ZIP Code Tabulation Areas" (full-resolution outlines), asked only where the
# generalised outline leaves two ZCTAs with different DDA flags within ZCTA_EDGE_M of the point.
TIGERWEB_ZCTA = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/7/query"
ZCTA_EDGE_M = 150   # metres: the 1:500,000 outlines are generalised; a point this close to an edge may lie in the neighbour
TRACT_EDGE_M = 30   # metres: a point this close to a tract edge is flagged (a lot can straddle the edge)


def tigerweb_zcta(lat, lng, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    cp = os.path.join(cache_dir, f"{lat:.6f}_{lng:.6f}.json")
    if os.path.exists(cp):
        return json.load(open(cp))
    q = urllib.parse.urlencode({"geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
                                "outFields": "ZCTA5", "returnGeometry": "false", "f": "json"})
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(TIGERWEB_ZCTA + "?" + q, headers={"User-Agent": "city-pretty-data-pipeline/1.0"}), timeout=60) as r:
                d = json.load(r)
            out = sorted({f["attributes"]["ZCTA5"] for f in d.get("features", [])})
            json.dump(out, open(cp, "w"))
            time.sleep(0.3)
            return out
        except Exception:
            time.sleep(3 * (i + 1))
    return None


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def read_shp(zpath):
    z = zipfile.ZipFile(zpath)
    names = z.namelist()
    base = [n for n in names if n.endswith(".shp")][0][:-4]
    r = shapefile.Reader(shp=io.BytesIO(z.read(base + ".shp")), dbf=io.BytesIO(z.read(base + ".dbf")), shx=io.BytesIO(z.read(base + ".shx")))
    fields = [f[0] for f in r.fields[1:]]
    geoms, recs = [], []
    for sr in r.iterShapeRecords():
        geoms.append(shape(sr.shape.__geo_interface__))
        recs.append(dict(zip(fields, sr.record)))
    return geoms, recs


def edge_m(geom, pt):
    """Distance in metres from the point to the polygon's boundary (local equirectangular scale; fine at these distances)."""
    d = geom.boundary.distance(pt)  # degrees, mixed
    # convert using the latitude scale: one degree of latitude is about 111,320 m; of longitude, that times cos(lat)
    near = geom.boundary.interpolate(geom.boundary.project(pt))
    dy = (near.y - pt.y) * 111320.0
    dx = (near.x - pt.x) * 111320.0 * math.cos(math.radians(pt.y))
    return round(math.hypot(dx, dy)) if d else 0


def main():
    dl = sys.argv[1]
    today = date.today().isoformat()
    files = sorted(glob.glob(os.path.join(SITES, "[0-9][0-9][0-9][0-9][0-9].json")))
    docs = [json.load(open(f)) for f in files]
    counties = sorted(d["fips"] for d in docs)
    states = sorted({c[:2] for c in counties})

    # ---- HUD lists
    qct = {}
    qct_src = {}
    for y in ("2026", "2027"):
        zp = os.path.join(dl, f"QCT{y}CSV.zip")
        z = zipfile.ZipFile(zp)
        rows = list(csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode("latin-1"))))
        qct[y] = {r["fips"].strip() for r in rows}
        qct_src[y] = {"url": HUD + f"QCT{y}CSV.zip", "file": z.namelist()[0], "sha256": sha(zp), "rows_national": len(rows),
                      "columns": list(rows[0].keys()), "fetched": today}
    sdda, nmdda, cbsa_of_zcta, dda_src = {}, {}, {}, {}
    for y in ("2026", "2027"):
        xp = os.path.join(dl, f"{y}-DDAs-Data-Used-to-Designate.xlsx")
        wb = openpyxl.load_workbook(xp, read_only=True)
        m = wb[f"{y} MDDA"]
        it = m.iter_rows(values_only=True)
        hdr = next(it)
        flag_col = [i for i, h in enumerate(hdr) if h and str(h).strip().startswith(f"{y} SDDA")][0]
        rent_col = [i for i, h in enumerate(hdr) if h and str(h).startswith("LIHTC Maximum Rent")][0]
        zz = {}
        for r in it:
            if r[0] is None:
                continue
            zc = str(r[0]).zfill(5)
            zz[zc] = {"flag": int(r[flag_col] or 0), "area": r[1], "area_name": r[2], "lihtc_max_rent": r[rent_col]}
        n = wb[f"{y} NMDDA"]
        it = n.iter_rows(values_only=True)
        nh = next(it)
        nflag = [i for i, h in enumerate(nh) if h and str(h).strip().startswith(f"{y} NMDDA")][0]
        nm = {str(r[0]).zfill(5): int(r[nflag] or 0) for r in it if r[0] is not None}
        sdda[y], nmdda[y] = zz, nm
        dda_src[y] = {"url": HUD_DDA.format(y=y), "sha256": sha(xp), "fetched": today, "metro_sheet": f"{y} MDDA", "metro_header": [str(h) for h in hdr],
                      "nonmetro_sheet": f"{y} NMDDA", "nonmetro_header": [str(h) for h in nh], "metro_rows": len(zz), "nonmetro_rows": len(nm)}

    # ---- geography
    tree_t, rec_t, geo_t = {}, {}, {}
    for s in states:
        g, r = read_shp(os.path.join(dl, "tracts", f"tl_2023_{s}_tract.zip"))
        tree_t[s], rec_t[s], geo_t[s] = STRtree(g), r, g
    gz, rz = read_shp(os.path.join(dl, "cb_2020_us_zcta520_500k.zip"))
    tree_z = STRtree(gz)
    zfield = "ZCTA5CE20"

    places = {}
    used_areas = set()
    stats = {"sites": 0, "tract_found": 0, "zcta_found": 0, "tract_county_differs": 0, "tract_edge_lt_30m": 0, "zcta_edge_lt_150m": 0}
    for d in docs:
        fips = d["fips"]
        out = {}
        for s in d["sites"]:
            stats["sites"] += 1
            lat, lng = s["pt"]
            p = Point(lng, lat)
            tr = te = zc = ze = None
            for i in tree_t[fips[:2]].query(p, predicate="intersects"):
                tr = rec_t[fips[:2]][i]["GEOID"]
                te = edge_m(geo_t[fips[:2]][i], p)
                break
            for i in tree_z.query(p, predicate="intersects"):
                zc = rz[i][zfield]
                ze = edge_m(gz[i], p)
                break
            zsrc = "c"
            if zc and ze < ZCTA_EDGE_M:
                # every ZCTA whose generalised outline is within ZCTA_EDGE_M of the point
                r_deg = ZCTA_EDGE_M / 111320.0 / max(0.2, math.cos(math.radians(lat)))
                cands = sorted({rz[i][zfield] for i in tree_z.query(p.buffer(r_deg))})
                flags = {(y, sdda[y].get(c, {}).get("flag")) for y in sdda for c in cands}
                if len({f for (y, f) in flags if y == "2027"}) > 1 or len({f for (y, f) in flags if y == "2026"}) > 1:
                    tw = tigerweb_zcta(lat, lng, os.path.join(dl, "tigerweb_zcta_cache"))
                    stats["zcta_asked_tigerweb"] = stats.get("zcta_asked_tigerweb", 0) + 1
                    if tw and len(tw) == 1:
                        if tw[0] != zc:
                            stats["zcta_changed_by_tigerweb"] = stats.get("zcta_changed_by_tigerweb", 0) + 1
                        zc, zsrc = tw[0], "t"
                    else:
                        zc, zsrc = None, "u"
                        stats["zcta_undetermined"] = stats.get("zcta_undetermined", 0) + 1
                else:
                    zsrc = "s"
            if tr:
                stats["tract_found"] += 1
                if tr[:5] != fips:
                    stats["tract_county_differs"] += 1
                if te < 30:
                    stats["tract_edge_lt_30m"] += 1
            if zc:
                stats["zcta_found"] += 1
                if ze < 150:
                    stats["zcta_edge_lt_150m"] += 1
                for y in sdda:
                    if zc in sdda[y]:
                        used_areas.add(sdda[y][zc]["area"])
            out[s["id"]] = [tr, te, zc, ze, zsrc]
        places[fips] = out

    os.makedirs(OUT_DIR, exist_ok=True)
    cols = ["2020 census tract GEOID (11 digits) containing the site's interior point", "metres from that point to the tract's edge",
            "2020 ZCTA containing the point", "metres from that point to the ZCTA's edge (generalised 1:500,000 outline)",
            "how the ZCTA was read: c = generalised outline, point more than %d m inside it; s = generalised outline, and every ZCTA within %d m has the same DDA flags; t = Census TIGERweb full outline (asked because ZCTAs within %d m have different DDA flags); u = not determined" % (ZCTA_EDGE_M, ZCTA_EDGE_M, ZCTA_EDGE_M)]
    for fips, out in places.items():
        json.dump({"fips": fips, "built": today, "builder": "pipeline/site_places_build.py", "columns": cols,
                   "tracts": {"url": TRACT_URL.format(s=fips[:2]), "vintage": "TIGER/Line 2023 (2020 census tracts)", "sha256": sha(os.path.join(dl, "tracts", f"tl_2023_{fips[:2]}_tract.zip"))},
                   "zcta": {"url": ZCTA_URL, "vintage": "2020 ZCTAs, cartographic boundary 1:500,000 (generalised)", "sha256": sha(os.path.join(dl, "cb_2020_us_zcta520_500k.zip")), "exact_outline_service": TIGERWEB_ZCTA},
                   "sites": out}, open(os.path.join(OUT_DIR, f"{fips}.json"), "w"), separators=(",", ":"))

    site_tracts = sorted({v[0] for out in places.values() for v in out.values() if v[0]})
    site_zctas = sorted({v[2] for out in places.values() for v in out.values() if v[2]})
    site_counties = sorted({t[:5] for t in site_tracts} | set(counties))
    tracts_out = {t: [1 if t in qct["2026"] else 0, 1 if t in qct["2027"] else 0] for t in site_tracts}
    zctas_out = {z: [sdda["2026"][z]["flag"] if z in sdda["2026"] else None, sdda["2027"][z]["flag"] if z in sdda["2027"] else None,
                     sdda["2027"][z]["lihtc_max_rent"] if z in sdda["2027"] else None, sdda["2027"][z]["area_name"] if z in sdda["2027"] else None] for z in site_zctas}
    nm_out = {c: [nmdda["2026"].get(c), nmdda["2027"].get(c)] for c in site_counties if c in nmdda["2026"] or c in nmdda["2027"]}
    payload = {"_source": {
        "dataset": "HUD Qualified Census Tracts (QCTs) and Difficult Development Areas (DDAs) for the Low-Income Housing Tax Credit, 26 U.S.C. 42(d)(5)(B)",
        "publisher": "U.S. Department of Housing and Urban Development, Office of Policy Development and Research (HUD User)",
        "download_page": "https://www.huduser.gov/portal/datasets/qct.html",
        "designation_years": ["2026", "2027"],
        "effective": {"2027": {"quote": "The 2027 lists of QCTs and DDAs are effective: (1) for allocations of credit after December 31, 2026", "url": "https://www.govinfo.gov/content/pkg/FR-2026-10-06/pdf/2026-20390.pdf",
                               "note": "the same quote is the designation_effective_date row in housing_funding_rules.json"},
                      "2026": {"notice": "https://www.federalregister.gov/documents/2025/09/30/2025-19007/statutorily-mandated-designation-of-difficult-development-areas-and-qualified-census-tracts-for-2026"}},
        "built": today, "builder": "pipeline/site_places_build.py",
        "scope": "Every 2020 census tract and ZCTA that holds a station-area site's point (app/data/station_site_places). %d sites lie over a county line from the county file that lists them; their own county is used." % stats["tract_county_differs"],
        "qct_files": qct_src, "dda_files": dda_src,
        "tracts_columns": ["on HUD's 2026 QCT list (1/0)", "on HUD's 2027 QCT list (1/0)"],
        "zctas_columns": ["2026 metropolitan Small DDA flag from HUD's sheet (1/0; null = ZCTA not on HUD's metro sheet)", "2027 flag (same)",
                          "HUD's own 2027-sheet column 'LIHTC Maximum Rent (1/12 of 30% of 120% of VLIL)' (USD per month; from the 2026 4-person VLIL), kept as a check of the rent formula", "HUD metro area name"],
        "nonmetro_columns": ["2026 nonmetropolitan DDA flag (1/0)", "2027 flag"],
        "how_to_read": "QCT lists name tracts; a tract absent from HUD's list is not a QCT. A tract is in this table only if a site's point lies in it. A metropolitan site is in a DDA when its ZCTA's flag is 1. A ZCTA not on HUD's metro sheet (null) is not determined.",
        "geography_stats": stats},
        "tracts": tracts_out, "zctas": zctas_out, "nonmetro_counties": nm_out}
    json.dump(payload, open(OUT_QCT, "w"), separators=(",", ":"))
    print(json.dumps(stats), file=sys.stderr)
    print("tracts", len(tracts_out), "qct27", sum(v[1] for v in tracts_out.values()), "zctas", len(zctas_out), "sdda27", sum(1 for v in zctas_out.values() if v[1] == 1), "nonmetro", nm_out, file=sys.stderr)


if __name__ == "__main__":
    main()
