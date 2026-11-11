"""Readers for the non-OSM Orange County sources (used by metrics_oc.py and layers_oc.py):
county park boundaries (OCGIS), Esri USA Parks, city boundaries (OCGIS), Tree Equity Score 2021 (American Forests), CCRS crashes."""
import os, json, re, collections
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import transform
import geo

import region
DATA = region.DATA
ld = lambda n: json.load(open(os.path.join(DATA, n), encoding="utf-8")) if os.path.exists(os.path.join(DATA, n)) else None


def _el_from_geom(g, tags, eid):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    members = [{"role": "outer", "geometry": [{"lon": x, "lat": y} for x, y in p.exterior.coords]} for p in polys]
    c = g.representative_point()
    return {"type": "relation", "id": eid, "tags": tags, "members": members, "center": {"lon": c.x, "lat": c.y}}


LAST_ADDED = {}   # counts from the latest merged_parks() call (written to layers.json for the sources table)


def merged_parks(osm_parks):
    """osm_parks: [(tags, geom, el)] from load_osm('parks'). Adds Esri USA Parks and OCGIS county parks whose footprint is not
    already covered (>50%) by an OSM park, so city parks missing from OSM still appear. Returns the same triple list."""
    out = list(osm_parks)
    osm_polys = [g for t, g, _ in osm_parks if g.geom_type in ("Polygon", "MultiPolygon")]
    tree = STRtree(osm_polys) if osm_polys else None

    def covered(g):
        if tree is None:
            return False
        for i in tree.query(g):
            inter = osm_polys[int(i)].intersection(g).area
            if g.area and inter / g.area > 0.5:
                return True
        return False
    n_added = collections.Counter()
    usa = ld("usa_parks.geojson")
    if usa:
        for i, f in enumerate(usa["features"]):
            pr = f["properties"]
            if pr.get("FEATTYPE") not in ("Local park", "Regional park", "County park", "State park or forest", "National park or forest"):
                continue
            try:
                g = shape(f["geometry"]).buffer(0)
            except Exception:
                continue
            if g.is_empty or covered(g):
                continue
            kind = "park" if pr["FEATTYPE"] in ("Local park", "Regional park", "County park") else "open space"
            tags = {"leisure": "park" if kind == "park" else "nature_reserve", "name": pr.get("NAME"), "source": "Esri USA Parks"}
            out.append((tags, g, _el_from_geom(g, tags, 9_000_000 + i))); n_added["usa"] += 1
    ocp = ld("oc_county_parks.geojson")
    if ocp:
        for i, f in enumerate(ocp["features"]):
            pr = f["properties"]
            if (pr.get("Status") or "Existing") != "Existing":
                continue
            try:
                g = shape(f["geometry"]).buffer(0)
            except Exception:
                continue
            if g.is_empty or covered(g):
                continue
            ty = pr.get("Type") or ""
            tags = {"natural": "beach"} if ty == "Beach" else {"leisure": "nature_reserve"} if ty in ("Wilderness", "Preserve") else {"leisure": "park"}
            tags.update({"name": pr.get("NAME"), "source": "OC Parks (OCGIS Park_Boundaries)"})
            out.append((tags, g, _el_from_geom(g, tags, 9_500_000 + i))); n_added["county"] += 1
    print("parks: OSM", len(osm_parks), "added", dict(n_added))
    LAST_ADDED.clear(); LAST_ADDED.update(n_added)
    return out


def census_places():
    """[(geom, display name, incorporated)] from Census TIGERweb places (fetch_oc.py places): incorporated places are cities;
    census-designated places are unincorporated communities, shown as '<Name> (unincorporated)'; everything else is the county."""
    j = ld("places.geojson"); out = []
    if not j:
        return out
    from shapely.ops import unary_union
    bgj = ld("bg.geojson")
    bgs = [shape(f["geometry"]).buffer(0) for f in bgj["features"]] if bgj else []
    county = unary_union(bgs).buffer(0) if bgs else None
    bg_pts = [b.representative_point() for b in bgs]
    for f in j["features"]:
        p = f["properties"]; nm = (p.get("BASENAME") or p.get("NAME") or "").strip()
        if not nm or not f.get("geometry"):
            continue
        g = shape(f["geometry"]).buffer(0)
        if county is not None:   # the download is a box: keep only the part inside the county, drop places barely inside it
            gi = g.intersection(county)
            if gi.geom_type == "GeometryCollection":
                gi = unary_union([q for q in gi.geoms if q.geom_type in ("Polygon", "MultiPolygon")])
            if gi.is_empty or (gi.area < 0.05 * g.area and not any(gi.contains(q) for q in bg_pts)):
                continue                                   # barely inside and holds no block group of this county
            g = gi
        inc = (p.get("_kind") == "incorporated")
        out.append((g, nm if inc else f"{nm} (unincorporated)", inc))
    return out


def county_park_amenities():
    """Amenity points implied by the OC Parks flags, at the park's representative point: kind -> [(lon, lat, name)]."""
    out = collections.defaultdict(list)
    ocp = ld("oc_county_parks.geojson")
    if not ocp:
        return out
    flags = {"toilets": ("Restroom",), "playground": ("Playground", "PlaygroundTotLot"), "tennis": ("TennisCourts",), "bask": ("BasketballCourts",), "field": ("SoccerField", "BallFields")}
    for f in ocp["features"]:
        pr = f["properties"]
        if (pr.get("Status") or "Existing") != "Existing":
            continue
        try:
            c = shape(f["geometry"]).representative_point()
        except Exception:
            continue
        for k, cols in flags.items():
            if any((pr.get(col) or 0) == 1 for col in cols):
                out[k].append((c.x, c.y, pr.get("NAME")))
    return out


def city_polys():
    """[(geom, display name, incorporated)] from OCGIS City_Boundaries_Public. Numbered codes (e.g. '4-OR-1') are county
    islands; they and 'UNINCORPORATED' map to the county. Named unincorporated communities keep their name."""
    j = ld("oc_cities.geojson"); out = []
    if not j:
        return census_places()
    for f in j["features"]:
        nm = (f["properties"].get("CITY") or "").strip()
        if not nm:
            continue
        g = shape(f["geometry"])
        if re.match(r"^\d-", nm) or nm.upper() == "UNINCORPORATED":
            out.append((g, "Unincorporated Orange County", False))
        elif nm.isupper():
            out.append((g, nm.title().replace("Of ", "of "), True))
        else:
            out.append((g, f"{nm} (unincorporated)", False))
    return out


def tes_by_bg(bg_polys):
    """Tree Equity Score 2021 (2010 block groups, Albers) -> area-weighted values on the 2020 block groups.
    temp_diff is derived: block-group avg_temp minus the mean avg_temp of this county's block groups in the same urbanized area."""
    import shapefile, pyproj
    st = region.STATE.lower(); p = os.path.join(DATA, "tes", f"{st}.shp")
    if not os.path.exists(p):
        return {}
    tr = pyproj.Transformer.from_crs(pyproj.CRS.from_wkt(open(os.path.join(DATA, "tes", f"{st}.prj")).read()), "EPSG:4326", always_xy=True)
    r = shapefile.Reader(os.path.join(DATA, "tes", st))
    names = [f[0] for f in r.fields[1:]]
    recs = []
    # The urbanized-area mean uses this county's block groups only. Checked 7 Nov 2026: LA's heat values are centred the same way (mean -0.5,
    # sd 3.0; Orange County this way: mean 0.0, sd 2.9) and the engine's heat thresholds were set on them; a statewide urbanized-area mean
    # would shift Orange County by -1.17 F and drop heat projects in 677 block groups against those thresholds, so it is not used.
    ua_mean = collections.defaultdict(list)
    # TES's 2010 GEOIDs carry the county codes of 2010. Where a county's code has changed since (Connecticut's 2022 planning regions
    # 09110-09190 replaced its eight counties 09001-09015; Oglala Lakota SD was Shannon County 46113), the county's TES block groups are
    # picked by location instead (a point inside this county's block groups): always in Connecticut, elsewhere when the code matches none
    def select(by_location):
        from shapely.ops import unary_union as _union
        area = _union([p.buffer(0) for p in bg_polys.values()]) if by_location else None
        out_recs, ua = [], collections.defaultdict(list)
        for sr in r.iterShapeRecords():
            d = dict(zip(names, sr.record))
            if not by_location and not str(d["geoid"]).zfill(12).startswith(region.FIPS) and not str(d["geoid"]).startswith(region.FIPS.lstrip("0")):
                continue
            g = shape(sr.shape.__geo_interface__)
            g = transform(lambda x, y, z=None: tr.transform(x, y), g).buffer(0)
            if by_location and (g.is_empty or not area.contains(g.representative_point())):
                continue
            if d.get("avg_temp") not in (None, "", -1):
                ua[d.get("ua_name")].append(float(d["avg_temp"]))
            out_recs.append((d, g))
        return out_recs, ua
    recs, ua_mean = select(region.STATE_FIPS == "09")
    if not recs and bg_polys:
        recs, ua_mean = select(True)
        print("TES: no block group carries this county's code (boundary changed since 2010): selected by location instead")
    ua_mean = {k: sum(v) / len(v) for k, v in ua_mean.items() if v}
    tes_tree = STRtree([g for _, g in recs])
    out = {}
    for gid, poly in bg_polys.items():
        w_t = w_g = w_s = tot_t = tot_g = tot_s = 0.0
        for i in tes_tree.query(poly):
            d, g = recs[int(i)]
            a = g.intersection(poly).area
            if a <= 0:
                continue
            if d.get("avg_temp") not in (None, "", -1) and d.get("ua_name") in ua_mean:
                w_t += a; tot_t += a * (float(d["avg_temp"]) - ua_mean[d["ua_name"]])
            if d.get("tc_gap") not in (None, ""):   # tc_gap is populated for every source, incl. "ED" (EarthDefine canopy)
                w_g += a; tot_g += a * float(d["tc_gap"])
            if d.get("tes") not in (None, ""):
                w_s += a; tot_s += a * float(d["tes"])
        if w_t or w_g:
            out[gid] = {"temp_diff": round(tot_t / w_t, 2) if w_t else None, "tc_gap": round(tot_g / w_g * 100, 1) if w_g else None, "tes": round(tot_s / w_s, 1) if w_s else None}
    print("TES 2021: 2010 block groups", len(recs), "-> 2020 block groups with values", len(out))
    return out


def crash_box():
    """Coordinate sanity box for CCRS points (west, south, east, north): Orange County keeps its original box; other counties
    use their block-group extent plus 0.1 degree. Block-group assignment later drops anything outside the county anyway."""
    if region.FIPS == "06059":
        return -118.2, 33.3, -117.3, 34.0
    xs, ys = [], []
    for f in (ld("bg.geojson") or {}).get("features", []):
        def walk(c):
            if isinstance(c[0], (int, float)):
                xs.append(c[0]); ys.append(c[1])
            else:
                for q in c: walk(q)
        walk(f["geometry"]["coordinates"])
    return min(xs) - .1, min(ys) - .1, max(xs) + .1, max(ys) + .1


def crash_points():
    """CCRS crashes with coordinates, this county, 2016-2025 -> [(lon, lat, {'pb': ped/bike, 'ksi': killed or serious})], years, counts"""
    pts, years, n_all, n_coord = [], [], 0, 0
    W, S, E, N = crash_box()
    loc = ld("crashes_local.json") if region.OV.get("crashes") else None   # a county's own crash source wins (Denver; SF: CCRS geocodes ~30%)
    if loc:   # county police reports (e.g. Denver): pb = pedestrian or bicycle involved; ksi = killed or seriously injured
        for row in loc["rows"]:
            _id, lat, lon, k, si, ped, bike, d = row[:8]   # state DOT rows carry a 9th field (persons injured)
            n_all += 1
            if lat is None or lon is None or not (S <= lat <= N and W <= lon <= E):
                continue
            n_coord += 1; pts.append((lon, lat, {"pb": bool(ped or bike), "ksi": (k or 0) > 0 or (si or 0) > 0}))
        years = sorted({int(r[7][:4]) for r in loc["rows"] if r[7]})
        print("local crashes", loc.get("name"), n_all, "with coordinates", n_coord, "years", years[:1] + years[-1:])
        return pts, years, n_all, n_coord
    for yr in [str(y) for y in range(2016, 2026)]:
        rows = ld(f"ccrs_{yr}.json")
        if not rows:
            continue
        years.append(int(yr))
        sev = set()
        s = ld(f"ccrs_severe_{yr}.json")
        if s:
            sev = {r["CollisionId"] for r in s["result"]["records"]}
        pbx = (ld(f"ccrs_pedbike_{yr}.json") or {}).get("collisions", {})   # an injured or killed pedestrian or cyclist (CCRS injured persons)
        for r in rows:
            n_all += 1
            try:
                lat = float(r.get("Latitude")); lon = float(r.get("Longitude"))
            except Exception:
                continue
            if not (S <= lat <= N and W <= lon <= E):
                continue
            n_coord += 1
            pb = (r.get("MotorVehicleInvolvedWithDesc") or "") in ("PEDESTRIAN", "BICYCLE") or str(r.get("Collision Id") or r.get("CollisionId") or "") in pbx
            ksi = (r.get("NumberKilled") or 0) > 0 or r.get("Collision Id") in sev
            pts.append((lon, lat, {"pb": pb, "ksi": ksi}))
    print("CCRS crashes", n_all, "with coordinates", n_coord, "years", years)
    return pts, years, n_all, n_coord
