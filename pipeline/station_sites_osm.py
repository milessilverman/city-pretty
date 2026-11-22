"""Candidate redevelopment land near stations, from OpenStreetMap geometry (docs/audit/station-sites-2026-11-22.md).

What counts (OSM tags, recorded on each record):
  surface_parking       amenity=parking with parking=surface, or no parking tag; no building tag; 0.5 acre or more
  vacant_or_brownfield  landuse=brownfield | landuse=greenfield | vacant=yes; 0.5 acre or more
  golf_course           leisure=golf_course; 0.5 acre or more
Large single-storey retail with big parking is NOT built: OSM has no tag that says "single-storey store with a big lot"
without joining two objects and guessing which lot belongs to which store.
Area is computed from the polygon (local equal-area projection). A candidate is dropped when OSM building polygons cover
more than BUILT_SHARE of it (building=roof|carport|canopy do not count: a roof over parking is still a parking lot).

Two sources, same rules: an openstreetmap.fr extract cut with osmium (backend "extract"), or the maps.mail.ru Overpass
mirror (backend "overpass"; overpass-api.de and Geofabrik refuse this machine). The record keeps the source and its date.

Usage: python3 pipeline/station_sites_osm.py <work dir (holds anchors.json)> <group key> [--keep]   (see GROUPS below)
"""
import json, math, os, subprocess, sys, time, urllib.parse, urllib.request
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSMFR = "https://download.openstreetmap.fr/extracts/north-america/"
OVERPASS = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
MIN_ACRES = 0.5
ACRE = 4046.8564224
BUILT_SHARE = 0.20
NOT_BUILT = {"roof", "carport", "canopy", "no", "ruins", "construction_site"}


def classify(t):
    """-> (kind, matched tag text) or None. t: the element's tags."""
    if t.get("building") and t.get("building") not in NOT_BUILT:
        return None
    if t.get("amenity") == "parking":
        p = t.get("parking")
        if p in (None, "surface"):
            return "surface_parking", "amenity=parking" + (", parking=surface" if p else " (no parking tag)")
        return None
    if t.get("leisure") == "golf_course":
        return "golf_course", "leisure=golf_course"
    if t.get("landuse") in ("brownfield", "greenfield"):
        return "vacant_or_brownfield", "landuse=" + t["landuse"]
    if t.get("vacant") == "yes":
        return "vacant_or_brownfield", "vacant=yes"
    return None


def is_building(t):
    b = t.get("building")
    return bool(b) and b not in NOT_BUILT


def xy_fn(lat0, lon0):
    kx = 111320.0 * math.cos(math.radians(lat0))
    return lambda lon, lat: ((lon - lon0) * kx, (lat - lat0) * 110540.0)


def to_local(g, lat0, lon0):
    f = xy_fn(lat0, lon0)
    if g.geom_type == "Polygon":
        return Polygon([f(*c) for c in g.exterior.coords], [[f(*c) for c in r.coords] for r in g.interiors])
    parts = [to_local(p, lat0, lon0) for p in getattr(g, "geoms", []) if p.geom_type in ("Polygon", "MultiPolygon")]
    return MultiPolygon([q for p in parts for q in (p.geoms if p.geom_type == "MultiPolygon" else [p])])


def poly_from_overpass(el):
    """a shapely (lon, lat) polygon from an Overpass element with `geometry` (way) or members (relation); None if open or empty"""
    try:
        if el["type"] == "way":
            g = el.get("geometry") or []
            if len(g) < 4 or (g[0]["lat"], g[0]["lon"]) != (g[-1]["lat"], g[-1]["lon"]):
                return None
            p = Polygon([(c["lon"], c["lat"]) for c in g])
            return p if p.is_valid and not p.is_empty else p.buffer(0)
        outers, inners = [], []
        for m in el.get("members") or []:
            if m.get("type") != "way" or not m.get("geometry"):
                continue
            ls = LineString([(c["lon"], c["lat"]) for c in m["geometry"]])
            (inners if m.get("role") == "inner" else outers).append(ls)
        if not outers:
            return None
        polys = list(polygonize(unary_union(outers)))
        if not polys:
            return None
        res = unary_union(polys)
        if inners:
            holes = list(polygonize(unary_union(inners)))
            if holes:
                res = res.difference(unary_union(holes))
        return res if not res.is_empty else None
    except Exception:
        return None


# ------------------------------------------------------------------ source: extract
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(" ".join(cmd) + "\n" + r.stderr[-600:])
    return r.stdout


def download(url, dest):
    for i in range(5):
        r = subprocess.run(["curl", "-sS", "-L", "--fail", "-m", "1500", "-o", dest, url], capture_output=True, text=True)
        if r.returncode == 0:
            return
        print("download retry", i + 1, r.stderr[-200:], file=sys.stderr); time.sleep(20 * (i + 1))
    raise RuntimeError("download failed " + url)


def elements_from_extract(url, anchors, work):
    """-> (candidates, buildings, info). candidates: [(osmType, id, tags, kind, tagtext, shapely polygon lon/lat)]; buildings: [polygon]"""
    import osmium
    from osmium.geom import GeoJSONFactory
    import osmium.filter as F
    pbf = os.path.join(work, "extract.osm.pbf")
    small = os.path.join(work, "small.osm.pbf"); filt = os.path.join(work, "filtered.osm.pbf")
    for f in (pbf, small, filt):
        if os.path.exists(f): os.remove(f)
    download(url, pbf)
    ts = run(["osmium", "fileinfo", "-g", "header.option.osmosis_replication_timestamp", pbf]).strip() or run(["osmium", "fileinfo", "-g", "header.option.timestamp", pbf]).strip()
    mx = 0.012  # degrees margin beyond the radius (about 1.3 km)
    dlat = lambda a: a["radius_m"] / 110540.0
    dlon = lambda a: a["radius_m"] / (111320.0 * math.cos(math.radians(a["lat"])))
    w = min(a["lng"] - dlon(a) for a in anchors) - mx; e = max(a["lng"] + dlon(a) for a in anchors) + mx
    s = min(a["lat"] - dlat(a) for a in anchors) - mx; n = max(a["lat"] + dlat(a) for a in anchors) + mx
    run(["osmium", "extract", "-b", f"{w:.5f},{s:.5f},{e:.5f},{n:.5f}", "--strategy", "smart", "-o", small, pbf])
    os.remove(pbf)
    run(["osmium", "tags-filter", small, "wr/amenity=parking", "wr/leisure=golf_course", "wr/landuse=brownfield,greenfield", "wr/vacant=yes", "wr/building", "-o", filt])
    os.remove(small)
    gj = GeoJSONFactory()
    cands, blds = [], []
    fp = osmium.FileProcessor(filt).with_locations().with_areas().with_filter(F.EmptyTagFilter())
    for o in fp:
        if not o.is_area():
            continue
        t = dict(o.tags)
        c = classify(t)
        if not c and not is_building(t):
            continue
        try:
            g = shape(json.loads(gj.create_multipolygon(o)))
        except Exception:
            continue
        if g.is_empty:
            continue
        if c:
            cands.append(("way" if o.from_way() else "relation", o.orig_id(), t, c[0], c[1], g))
        elif is_building(t):
            blds.append(g)
    os.remove(filt)
    return cands, blds, {"source": "openstreetmap.fr extract", "url": url, "data_timestamp": ts, "backend": "extract"}


# ------------------------------------------------------------------ source: overpass
def overpass(q, tries=8):
    last = None
    for i in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(OVERPASS, data=("data=" + urllib.parse.quote(q)).encode(), headers={"User-Agent": "city-pretty-station-sites"}), timeout=420)
            return json.loads(r.read())
        except Exception as ex:
            last = str(ex)[:100]
            print("overpass try", i + 1, last, file=sys.stderr); time.sleep(min(20 * (i + 1), 120))
    raise RuntimeError("overpass failed: " + str(last))


def clusters(anchors, max_deg=0.12):
    """greedy clusters of anchors whose padded boxes fit in max_deg x max_deg"""
    boxes = []
    for a in anchors:
        dy = a["radius_m"] / 110540.0 + 0.002; dx = a["radius_m"] / (111320.0 * math.cos(math.radians(a["lat"]))) + 0.002
        b = [a["lng"] - dx, a["lat"] - dy, a["lng"] + dx, a["lat"] + dy]
        for c in boxes:
            nw, ns, ne, nn = min(c["b"][0], b[0]), min(c["b"][1], b[1]), max(c["b"][2], b[2]), max(c["b"][3], b[3])
            if ne - nw <= max_deg and nn - ns <= max_deg and (b[0] <= c["b"][2] + 0.01 and b[2] >= c["b"][0] - 0.01 and b[1] <= c["b"][3] + 0.01 and b[3] >= c["b"][1] - 0.01):
                c["b"] = [nw, ns, ne, nn]; c["a"].append(a); break
        else:
            boxes.append({"b": b, "a": [a]})
    return boxes


def near_any(g, anchors):
    """True when polygon g (lon/lat) is within an anchor's radius"""
    rp = g.representative_point()
    gl = to_local(g, rp.y, rp.x)
    for a in anchors:
        ax, ay = xy_fn(rp.y, rp.x)(a["lng"], a["lat"])
        if gl.distance(Point(ax, ay)) <= a["radius_m"]:
            return True
    return False


def overpass_try(q, label, tries=6):
    """-> json or None (after tries); one failed small query must not lose the whole group"""
    try:
        return overpass(q, tries)
    except Exception as ex:
        print("overpass gave up:", label, str(ex)[:80], file=sys.stderr)
        return None


def one_cluster(ci, c, cache_dir):
    """-> (cands, blds, stamps, ok) for one cluster; a finished cluster is cached on disk so a restart does not repeat it"""
    from shapely import wkt
    w, s, e, n = c["b"]
    bb = f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    fn = os.path.join(cache_dir, f"ov_{s:.4f}_{w:.4f}_{n:.4f}_{e:.4f}.json")
    if os.path.exists(fn):
        d = json.load(open(fn))
        return [(x[0], x[1], x[2], x[3], x[4], wkt.loads(x[5])) for x in d["cands"]], [wkt.loads(x) for x in d["blds"]], d["stamps"], (True, d.get("optional_failed", []))
    # small queries with exact tag values (a regex on landuse made the mirror time out); each is retried by itself
    qs = [f'way["amenity"="parking"]({bb});', f'rel["amenity"="parking"]({bb});',
          f'way["leisure"="golf_course"]({bb});rel["leisure"="golf_course"]({bb});way["landuse"="brownfield"]({bb});rel["landuse"="brownfield"]({bb});',
          f'way["landuse"="greenfield"]({bb});rel["landuse"="greenfield"]({bb});way["vacant"="yes"]({bb});rel["vacant"="yes"]({bb});']
    cands, blds, stamps, ids, ok, seen, opt_failed = [], [], [], [], True, set(), []
    for qi, qq in enumerate(qs):
        j = overpass_try(f'[out:json][timeout:180];({qq});out tags geom;', f"cluster {ci + 1} part {qi + 1}", 6 if qi < 2 else 4)
        if j is None:
            if qi < 2:
                ok = False   # parking could not be read: the cluster is not searched
            else:
                opt_failed.append(["golf courses and brownfield land", "greenfield and vacant land"][qi - 2])   # these two kinds are missing for this cluster
            continue
        stamps.append((j.get("osm3s") or {}).get("timestamp_osm_base"))
        for el in j["elements"]:
            t = el.get("tags") or {}
            cl = classify(t)
            if not cl or (el["type"], el["id"]) in seen:
                continue
            g = poly_from_overpass(el)
            if g is None:
                continue
            seen.add((el["type"], el["id"]))
            cands.append((el["type"], el["id"], t, cl[0], cl[1], g)); ids.append((el["type"], el["id"], g))
    # buildings that touch a candidate big enough to matter and near an anchor
    big = [x for x in ids if polygon_acres(x[2]) >= MIN_ACRES and near_any(x[2], c["a"])]
    wid = [x[1] for x in big if x[0] == "way"]
    rid = [x[1] for x in big if x[0] == "relation"]
    for part in range(0, max(len(wid), 1), 150):
        wp = wid[part:part + 150]
        if not wp and not (rid and part == 0):
            continue
        sel = (f"way(id:{','.join(map(str, wp))});" if wp else "") + (f"rel(id:{','.join(map(str, rid))});" if rid and part == 0 else "")
        jb = overpass_try(f'[out:json][timeout:180];({sel})->.c;(way["building"](around.c:0);rel["building"](around.c:0););out tags geom;', f"cluster {ci + 1} buildings")
        if jb is None:
            ok = False; continue
        for el in jb["elements"]:
            t = el.get("tags") or {}
            if is_building(t):
                g = poly_from_overpass(el)
                if g is not None:
                    blds.append(g)
    print(f"cluster {ci + 1}: {len(c['a'])} anchors, {len(ids)} tagged polygons, {len(blds)} buildings{'' if ok else ' (A QUERY FAILED)'}", file=sys.stderr)
    if ok:
        os.makedirs(cache_dir, exist_ok=True)
        json.dump({"cands": [[x[0], x[1], x[2], x[3], x[4], x[5].wkt] for x in cands], "blds": [b.wkt for b in blds], "stamps": stamps, "optional_failed": opt_failed}, open(fn, "w"))
    return cands, blds, stamps, (ok, opt_failed)


def elements_from_overpass(anchors, work):
    from concurrent.futures import ThreadPoolExecutor
    cache_dir = os.path.join(os.path.dirname(work.rstrip("/")), "ovcache")
    cl = clusters(anchors, 0.06)
    with ThreadPoolExecutor(int(os.environ.get("OVERPASS_THREADS", "3"))) as ex:
        res = list(ex.map(lambda ic: one_cluster(ic[0], ic[1], cache_dir), enumerate(cl)))
    cands, blds, stamps, failed, seen, partial = [], [], [], [], set(), {}
    for c, (cd, bl, st, okp) in zip(cl, res):
        ok, optf = okp
        for a in c["a"]:
            if optf:
                partial[a["id"]] = optf
        for x in cd:
            if (x[0], x[1]) not in seen:
                seen.add((x[0], x[1])); cands.append(x)
        blds += bl; stamps += st
        if not ok:
            failed += [a["id"] for a in c["a"]]
    return cands, blds, {"source": "Overpass mirror maps.mail.ru", "url": OVERPASS, "data_timestamp": max(x for x in stamps if x) if any(stamps) else None, "backend": "overpass", "failed_anchor_ids": sorted(set(failed)), "kinds_not_searched": partial}


def polygon_acres(g):
    c = g.representative_point()
    return to_local(g, c.y, c.x).area / ACRE


# ------------------------------------------------------------------ selection
def select(cands, blds, anchors, info):
    """pick candidates >= MIN_ACRES within radius of an anchor; drop built-on lots; one record per OSM element"""
    btree = STRtree(blds) if blds else None
    out, dropped = {}, {"too_small": 0, "built_on": 0, "not_near": 0, "invalid": 0}
    for (typ, oid, t, kind, tagtext, g) in cands:
        if g.is_empty or not g.is_valid:
            g = g.buffer(0)
            if g.is_empty:
                dropped["invalid"] += 1; continue
        rp = g.representative_point()
        lat0, lon0 = rp.y, rp.x
        gl = to_local(g, lat0, lon0)
        area = gl.area
        if area < MIN_ACRES * ACRE:
            dropped["too_small"] += 1; continue
        # nearest anchors (metres from the polygon edge; 0 when the anchor is inside it)
        best = []
        for a in anchors:
            ax, ay = xy_fn(lat0, lon0)(a["lng"], a["lat"])
            d = gl.distance(Point(ax, ay))
            if d <= a["radius_m"]:
                dc = math.hypot(ax, ay)
                best.append((d, dc, a))
        if not best:
            dropped["not_near"] += 1; continue
        best.sort(key=lambda x: (x[1], x[0]))
        built = 0.0
        if btree is not None:
            idx = btree.query(g)
            if len(idx):
                parts = []
                for i in idx:
                    x = blds[i].intersection(g) if blds[i].is_valid else blds[i].buffer(0).intersection(g)
                    if not x.is_empty and x.geom_type in ("Polygon", "MultiPolygon", "GeometryCollection"):
                        parts.append(to_local(x, lat0, lon0))
                bl = unary_union(parts) if parts else None
                built = bl.area / area if bl is not None and not bl.is_empty else 0.0
        if built > BUILT_SHARE:
            dropped["built_on"] += 1; continue
        near, dcen = best[0][2], best[0][1]
        out[(typ, oid)] = {
            "osmType": typ, "osmId": oid, "kind": kind, "osmTags": tagtext, "access": t.get("access"), "name": t.get("name"),
            "areaM2": round(area), "acres": round(area / ACRE, 2), "pt": [round(lat0, 6), round(lon0, 6)], "builtShare": round(built, 3),
            "near": {"id": near["id"], "cls": near["cls"], "name": near["name"], "line": near.get("line"), "distM": round(dcen), "edgeDistM": round(best[0][0]), "fips": near["fips"]},
            "classes": sorted({b[2]["cls"] for b in best}),
            "alsoNear": [{"name": b[2]["name"], "cls": b[2]["cls"], "distM": round(b[1])} for b in best[1:4]],
        }
    return list(out.values()), dropped


GROUPS_FILE = "groups.json"


def main():
    work, gkey = sys.argv[1], sys.argv[2]
    groups = json.load(open(os.path.join(work, GROUPS_FILE)))
    g = groups[gkey]
    A = json.load(open(os.path.join(work, "anchors.json")))["anchors"]
    byid = {a["id"]: a for a in A}
    anchors = [byid[i] for i in g["anchors"]]
    t0 = time.time()
    os.makedirs(os.path.join(work, "cands"), exist_ok=True)
    lock = os.path.join(work, "cands", gkey.replace("/", "_") + ".lock")
    try:
        os.close(os.open(lock, os.O_CREAT | os.O_EXCL))   # two runners may share a list: the second skips a group the first has taken
    except FileExistsError:
        print("skip (already taken)", gkey); return
    tmp = os.path.join(work, "tmp_" + gkey.replace("/", "_")); os.makedirs(tmp, exist_ok=True)
    if g["backend"] == "extract":
        cands, blds, info = elements_from_extract(g["url"], anchors, tmp)
    else:
        cands, blds, info = elements_from_overpass(anchors, tmp)
    recs, dropped = select(cands, blds, anchors, info)
    info.update({"group": gkey, "anchors": len(anchors), "tagged_polygons": len(cands), "buildings_read": len(blds), "dropped": dropped, "kept": len(recs), "seconds": round(time.time() - t0)})
    os.makedirs(os.path.join(work, "cands"), exist_ok=True)
    json.dump({"info": info, "records": recs}, open(os.path.join(work, "cands", gkey.replace("/", "_") + ".json"), "w"))
    try:
        os.rmdir(tmp)
    except OSError:
        pass
    print(json.dumps(info))


if __name__ == "__main__":
    main()
