"""Build the map layers for Orange County in the exact schema of the LA bundle (D.layers), from the OSM downloads."""
import os, json, math, collections
from shapely.geometry import shape, Point, LineString, Polygon, mapping
import geo
from metrics_oc import load_osm, DATA
import region
import sources_oc

FAC_KINDS = ["school", "college", "library", "city hall", "fire station", "police", "post office", "hospital", "clinic", "community center", "museum", "courthouse"]
CELL = 0.05


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def feat(geom, props):
    g = mapping(geom)
    # round coordinates to 5 decimals (about 1 m) to keep the bundle small
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c, (list, tuple)) and c and isinstance(c[0], (list, tuple)) else [round(c[0], 5), round(c[1], 5)]
    g["coordinates"] = rnd(g["coordinates"]) if g["type"] != "Point" else [round(g["coordinates"][0], 5), round(g["coordinates"][1], 5)]
    return {"type": "Feature", "geometry": g, "properties": props}


def lines_of(g):
    if g.geom_type == "LineString":
        return [g]
    if g.geom_type == "MultiLineString":
        return list(g.geoms)
    if g.geom_type == "Polygon":
        return [LineString(g.exterior.coords)]
    return []


def build():
    roads = load_osm("roads"); parks = sources_oc.merged_parks(load_osm("parks")); water = load_osm("water"); rail = load_osm("rail"); amen = load_osm("amenities"); places = load_osm("places"); infra = load_osm("infra")
    L = {}
    # freeways / arterials (FeatureCollections) and the streets cell index
    fw_feats, art_feats = [], []
    names, name_idx = [], {}
    def nid(n):
        if n not in name_idx:
            name_idx[n] = len(names); names.append(n)
        return name_idx[n]
    cells = collections.defaultdict(list); fwy = []
    for t, g, _ in roads:
        hw = t.get("highway"); nm = t.get("name") or ""
        for ln in lines_of(g):
            coords = list(ln.coords)
            if hw in ("motorway", "trunk"):
                ref = t.get("ref") or nm
                fw_feats.append(feat(ln, {"n": ref}))
                if ref:
                    fwy.append([0, nid(ref), geo.enc_polyline([(y, x) for x, y in coords])])
            elif hw in ("motorway_link", "trunk_link"):
                fw_feats.append(feat(ln, {"n": ""}))
            elif hw in ("primary", "secondary"):
                art_feats.append(feat(ln.simplify(0.00003), {}))
                if nm:
                    c = ln.centroid; cells[geo.cell_key(c.x, c.y)].append([1, nid(nm), geo.enc_polyline([(y, x) for x, y in coords])])
            elif hw == "tertiary":
                if nm:
                    c = ln.centroid; cells[geo.cell_key(c.x, c.y)].append([2, nid(nm), geo.enc_polyline([(y, x) for x, y in coords])])
            else:
                c = ln.centroid; cells[geo.cell_key(c.x, c.y)].append([3, nid(nm or ""), geo.enc_polyline([(y, x) for x, y in coords])])
    L["freeways"] = fc(fw_feats); L["arterials"] = fc(art_feats)
    L["streets"] = {"cell": CELL, "names": names, "cells": dict(cells), "fwy": fwy}
    # parks + labels
    pk, labels = [], []
    for t, g, _ in parks:
        if g.geom_type not in ("Polygon", "MultiPolygon") or t.get("access") == "private":
            continue
        k = "community garden" if t.get("landuse") == "allotments" else "dog park" if t.get("leisure") == "dog_park" else "playground" if t.get("leisure") == "playground" else "beach" if t.get("natural") == "beach" else "open space" if (t.get("leisure") == "nature_reserve" or t.get("boundary") == "protected_area" or t.get("natural") in ("wood", "scrub", "heath")) else "park" if t.get("leisure") in ("park", "garden", "recreation_ground") or t.get("landuse") == "recreation_ground" else None
        if not k:
            continue
        a = round(geo.acres(g), 2)
        pk.append(feat(g.simplify(0.00003), {"n": t.get("name"), "k": k, "a": a}))
        if t.get("name") and a >= 0.5:
            c = g.representative_point(); labels.append([t["name"], round(c.y, 5), round(c.x, 5), a])
    L["parks"] = fc(pk); L["park_labels"] = sorted(labels, key=lambda r: -r[3])
    # water
    L["water"] = fc([feat(ln.simplify(0.00005), {}) for t, g, _ in water if t.get("waterway") or t.get("natural") == "coastline" for ln in lines_of(g)])
    # rail + stations
    L["rail"] = fc([feat(ln.simplify(0.00003), {}) for t, g, _ in rail if t.get("railway") in ("rail", "light_rail", "subway", "tram") for ln in lines_of(g)])
    L["stations"] = fc([feat(g, {"n": t.get("name") or ""}) for t, g, _ in rail if isinstance(g, Point)])
    L["rail_con"] = []; L["stations_con"] = []
    # noise walls
    L["walls"] = fc([feat(ln, {}) for t, g, _ in infra if (t.get("barrier") == "wall" or t.get("noise_barrier")) for ln in lines_of(g)])
    # bus stops with 7-9am frequency
    sp = next((os.path.join(DATA, n) for n in ("octa_stops_7_9.json", "transit_stops_7_9.json") if os.path.exists(os.path.join(DATA, n))), None)
    stops = json.load(open(sp)) if sp else []
    L["stops"] = fc([feat(Point(s[0], s[1]), {"cell": "", "t": s[2]}) for s in stops if s[2] >= 6])
    # amenities (points) and facilities
    am, fac, fac_cells = [], [], collections.defaultdict(list)
    for t, g, _ in amen:
        c = g if isinstance(g, Point) else g.centroid
        sp = t.get("sport") or ""; le = t.get("leisure"); a = t.get("amenity")
        k = ("pickleball" if "pickleball" in sp else "tennis" if "tennis" in sp else "basketball" if "basketball" in sp else "skatepark" if "skateboard" in sp else
             "playground" if le == "playground" else "dog park" if le == "dog_park" else "pool" if le == "swimming_pool" and t.get("access") != "private" else
             "library" if a == "library" else "community garden" if (t.get("landuse") == "allotments" or t.get("garden:type") == "community") else None)
        if k:
            am.append(feat(c, {"k": k, "n": t.get("name")}))
        fk = ("school" if a in ("school", "kindergarten") else "college" if a in ("college", "university") else "library" if a == "library" else "city hall" if a == "townhall" else
              "fire station" if a == "fire_station" else "police" if a == "police" else "post office" if a == "post_office" else "hospital" if a == "hospital" else
              "clinic" if a in ("clinic", "doctors") else "community center" if a in ("community_centre", "social_facility") else "museum" if t.get("tourism") == "museum" else "courthouse" if a == "courthouse" else None)
        if fk:
            fac.append([FAC_KINDS.index(fk), t.get("name") or "", round(c.y, 5), round(c.x, 5)])
            if g.geom_type in ("Polygon", "MultiPolygon"):
                polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
                for pg in polys:
                    rings = [geo.enc_ring_lonlat(list(pg.exterior.coords))] + [geo.enc_ring_lonlat(list(r.coords)) for r in pg.interiors]
                    fac_cells[geo.cell_key(c.x, c.y)].append([FAC_KINDS.index(fk), rings])
    L["amenities"] = fc(am); L["facilities"] = fac; L["fac_kinds"] = FAC_KINDS; L["fac_areas"] = {"cell": CELL, "cells": dict(fac_cells)}
    L["projects"] = []; L["pj_kinds"] = ["housing completed", "housing permitted", "housing approved", "affordable housing", "new apartments", "new ADU", "new house", "new building", "city capital project"]
    # neighborhood labels from OSM place nodes (no polygons for OC)
    hood_labels = [[t["name"], round(g.y, 5), round(g.x, 5)] for t, g, _ in places if t.get("name") and t.get("place") in ("neighbourhood", "suburb", "quarter")]
    return L, hood_labels


def cities_layer():
    feats, labels, seen = [], [], set()
    for g, nm, inc in sources_oc.city_polys():
        lines = [LineString(g.exterior.coords)] if g.geom_type == "Polygon" else [LineString(p.exterior.coords) for p in g.geoms] if g.geom_type == "MultiPolygon" else []
        if not lines:
            continue
        feats.append(feat(shape({"type": "MultiLineString", "coordinates": [list(l.simplify(0.0001).coords) for l in lines]}), {}))
        if inc or (nm not in seen and region.UNINC != nm):
            c = g.representative_point(); labels.append([nm, round(c.y, 5), round(c.x, 5)]); seen.add(nm)
    return fc(feats), labels


if __name__ == "__main__":
    L, hl = build(); C, cl = cities_layer()
    json.dump({"layers": L, "hood_labels": hl, "cities": C, "city_labels": cl, "parks_added": dict(sources_oc.LAST_ADDED)}, open(os.path.join(DATA, "layers.json"), "w"))
    print({k: (len(v["features"]) if isinstance(v, dict) and "features" in v else (len(v) if hasattr(v, "__len__") else v)) for k, v in L.items()})
