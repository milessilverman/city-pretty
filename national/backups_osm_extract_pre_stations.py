"""Read the Orange County OpenStreetMap extract (data/osm/orange-latest.osm.pbf, from download.openstreetmap.fr) and write
the per-theme element files the rest of the pipeline reads (data/osm_<theme>.json, Overpass-style elements)."""
import os, sys, json, time
import osmium
from osmium.geom import GeoJSONFactory
import osmium.filter as F

import region
DATA = region.DATA
PBF = os.path.join(DATA, "osm", region.OSM_FILE)
STATE_TXT = PBF.replace("-latest.osm.pbf", ".state.txt")
ROADS = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "secondary", "tertiary", "residential", "living_street", "unclassified", "primary_link", "secondary_link", "tertiary_link"}
RAIL_W = {"rail", "light_rail", "subway", "tram"}
PARK_LEISURE = {"park", "garden", "nature_reserve", "dog_park", "playground", "recreation_ground"}
PARK_LANDUSE = {"recreation_ground", "allotments", "cemetery"}
AMEN = {"library", "community_centre", "townhall", "fire_station", "police", "post_office", "hospital", "clinic", "doctors", "courthouse", "school", "college", "university", "kindergarten", "marketplace", "charging_station", "social_facility", "restaurant", "cafe", "fast_food", "toilets"}
AMEN_LEISURE = {"pitch", "playground", "dog_park", "swimming_pool", "sports_centre", "fitness_station"}
SHOP = {"supermarket", "greengrocer", "grocery"}
SPORTS = ("pickleball", "tennis", "basketball", "soccer", "baseball", "skateboard")
PLACES = {"neighbourhood", "suburb", "quarter", "village", "hamlet", "town", "city"}
KEYS = ["highway", "railway", "public_transport", "leisure", "landuse", "natural", "boundary", "waterway", "amenity", "tourism", "sport", "shop", "place", "barrier", "noise_barrier", "power"]


def is_amenity(t):
    return (t.get("amenity") in AMEN or t.get("leisure") in AMEN_LEISURE or t.get("tourism") == "museum" or t.get("shop") in SHOP
            or any(s in (t.get("sport") or "") for s in SPORTS) or (t.get("leisure") == "garden" and t.get("garden:type") == "community") or t.get("landuse") == "allotments")


def is_park(t):
    return t.get("leisure") in PARK_LEISURE or t.get("landuse") in PARK_LANDUSE or t.get("natural") == "beach" or t.get("boundary") == "protected_area"


def is_water(t):
    return t.get("waterway") in ("river", "stream", "canal", "drain") or t.get("natural") in ("water", "coastline")


def is_infra(t):
    return (t.get("barrier") == "wall" and "noise" in (t.get("wall") or "")) or "noise_barrier" in t or t.get("power") == "line" or (t.get("highway") == "service" and t.get("service") == "alley")


def county_box(margin=0.02):
    """(w, s, e, n) of the county's block groups plus a margin: used to clip state or regional extracts (registry clip=True)"""
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
        else:
            for q in c: walk(q)
    for f in json.load(open(os.path.join(DATA, "bg.geojson")))["features"]:
        walk(f["geometry"]["coordinates"])
    return min(xs) - margin, min(ys) - margin, max(xs) + margin, max(ys) + margin


def main():
    t0 = time.time()
    BOX = county_box() if region.OSM.get("clip") else None
    inb = (lambda lon, lat: BOX[0] <= lon <= BOX[2] and BOX[1] <= lat <= BOX[3]) if BOX else (lambda lon, lat: True)
    if BOX: print("clipping", os.path.basename(PBF), "to", [round(v, 3) for v in BOX])
    out = {k: [] for k in ("roads", "rail", "parks", "water", "amenities", "places", "infra", "bus_stops")}
    seen_area_ways = set()
    gj = GeoJSONFactory()
    fp = osmium.FileProcessor(PBF).with_locations().with_areas().with_filter(F.EmptyTagFilter()).with_filter(F.KeyFilter(*KEYS))
    n = 0
    for o in fp:
        n += 1
        t = dict(o.tags)
        if o.is_node():
            if BOX and not inb(o.location.lon, o.location.lat):
                continue
            el = {"type": "node", "id": o.id, "lat": o.location.lat, "lon": o.location.lon, "tags": t}
            if t.get("place") in PLACES:
                out["places"].append(el)
            if t.get("railway") in ("station", "halt") or (t.get("public_transport") == "station" and t.get("train") == "yes"):
                out["rail"].append(el)
            if is_amenity(t):
                out["amenities"].append(el)
            if t.get("highway") == "bus_stop":   # used only to check that the GTFS feeds cover the county's bus network
                out["bus_stops"].append({"type": "node", "id": o.id, "lat": o.location.lat, "lon": o.location.lon, "tags": {}})
        elif o.is_way():
            try:
                pts = [{"lat": nd.location.lat, "lon": nd.location.lon} for nd in o.nodes if nd.location.valid()]
            except Exception:
                continue
            if len(pts) < 2 or (BOX and not any(inb(p["lon"], p["lat"]) for p in pts)):
                continue
            el = {"type": "way", "id": o.id, "tags": t, "geometry": pts}
            hw = t.get("highway")
            if hw in ROADS:
                out["roads"].append(el)
            if t.get("railway") in RAIL_W:
                out["rail"].append(el)
            if t.get("waterway") in ("river", "stream", "canal", "drain") or t.get("natural") == "coastline":
                out["water"].append(el)
            if is_infra(t):
                out["infra"].append(el)
        elif o.is_area():
            try:
                g = json.loads(gj.create_multipolygon(o))
            except Exception:
                continue
            rings = [p[0] for p in g["coordinates"]] if g["type"] == "MultiPolygon" else [g["coordinates"][0]]
            members = [{"role": "outer", "geometry": [{"lon": x, "lat": y} for x, y in r]} for r in rings if len(r) >= 4]
            if not members or (BOX and not any(inb(p["lon"], p["lat"]) for m in members for p in m["geometry"])):
                continue
            r0 = members[0]["geometry"]
            cx = sum(p["lon"] for p in r0) / len(r0); cy = sum(p["lat"] for p in r0) / len(r0)
            el = {"type": "relation" if not o.from_way() else "way_area", "id": o.orig_id(), "tags": t, "members": members, "center": {"lon": cx, "lat": cy}}
            if is_park(t):
                out["parks"].append(el)
            if t.get("natural") == "water":
                out["water"].append(el)
            if is_amenity(t):
                out["amenities"].append(dict(el, type="relation"))
    for k, v in out.items():
        with open(os.path.join(DATA, f"osm_{k}.json"), "w", encoding="utf-8") as fh:
            json.dump({"elements": v, "source": "OpenStreetMap, " + region.OSM["url"] + (" (cut to " + region.OSM["split"] + " by osm_split.py)" if region.OSM.get("split") else ""), "state": open(STATE_TXT).read().strip() if os.path.exists(STATE_TXT) else ""}, fh)
        print(k, len(v))
    print("objects", n, "secs", round(time.time() - t0))


if __name__ == "__main__":
    main()
