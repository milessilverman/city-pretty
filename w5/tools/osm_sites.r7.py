"""Extract the OpenStreetMap features the site suggestions need from a county .osm.pbf.
usage: python3 osm_sites.py <in.osm.pbf> <out.json> [w,s,e,n clip box]
Output (lon/lat, 6 decimals):
  water:   [[name, waterway, intermittent(0/1), [[lon,lat],...]], ...]        streams, rivers, canals, drains (culverts/covered left out)
  paths:   [[kind, name, [[lon,lat],...]], ...]                                cycleways, paths, footways, bridleways, bike-designated ways
  parking: [[name, operator, access, parking, area_m2, [lon,lat] centroid, [[lon,lat],...] outer ring], ...]   surface lots (and untagged)
  dest:    [[kind, name, lon, lat], ...]                                       libraries, community centres, town halls, schools, colleges,
                                                                               hospitals, supermarkets, malls, parks (centroid), stations, park-and-ride
  roads:   [[way_id, name, highway, maxspeed, lanes, [[lon,lat],...], [[i, cross_name], ...]], ...]   named drivable roads with cross streets by vertex index
  calm:    [[kind, lon, lat], ...]                                              existing traffic-calming devices and marked crossings
"""
import sys, json, math, collections
import osmium

src, out = sys.argv[1:3]
R = lambda x: round(x, 6)
DRIVE = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "primary_link", "secondary_link", "tertiary_link"}
PATHK = {"cycleway", "path", "footway", "bridleway", "track", "pedestrian"}
DEST_AMEN = {"library": "library", "community_centre": "community center", "townhall": "city hall", "school": "school", "college": "college",
             "university": "university", "hospital": "hospital", "social_facility": "social facility", "place_of_worship": "place of worship"}
DEST_SHOP = {"supermarket": "supermarket", "mall": "shopping center", "department_store": "department store"}


def ring_area(pts):
    if len(pts) < 4:
        return 0.0
    lat0 = math.radians(sum(p[1] for p in pts) / len(pts)); kx = 111320 * math.cos(lat0); ky = 110540
    a = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        a += x1 * kx * y2 * ky - x2 * kx * y1 * ky
    return abs(a) / 2


class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.water, self.paths, self.parking, self.dest, self.calm = [], [], [], [], []
        self.roads = []                       # (way_id, name, hw, maxspeed, lanes, node_ids, coords)
        self.node_names = collections.defaultdict(set)

    def node(self, n):
        t = n.tags
        tc = t.get("traffic_calming"); hw = t.get("highway")
        if tc or hw == "traffic_calming":
            self.calm.append([tc or "yes", R(n.location.lon), R(n.location.lat)])
        elif hw == "crossing" or t.get("crossing") in ("marked", "zebra", "traffic_signals"):
            self.calm.append(["crossing:" + (t.get("crossing") or "yes"), R(n.location.lon), R(n.location.lat)])
        self._dest(t, n.location.lon, n.location.lat)

    def _dest(self, t, lon, lat):
        a, s = t.get("amenity"), t.get("shop")
        k = DEST_AMEN.get(a) or DEST_SHOP.get(s)
        if not k and t.get("leisure") == "park":
            k = "park"
        if not k and (t.get("railway") == "station" or (t.get("public_transport") == "station" and t.get("train") == "yes")):
            k = "rail station"
        if not k and a == "parking" and t.get("park_ride") not in (None, "no"):
            k = "park-and-ride"
        if k:
            self.dest.append([k, t.get("name") or "", R(lon), R(lat)])

    def way(self, w):
        t = w.tags
        try:
            coords = [(n.lon, n.lat) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 2:
            return
        cl = [[R(x), R(y)] for x, y in coords]
        ww = t.get("waterway")
        if ww in ("river", "stream", "canal", "drain") and t.get("tunnel") not in ("culvert", "yes") and t.get("covered") != "yes" and t.get("layer", "0") not in ("-1", "-2"):
            self.water.append([t.get("name") or "", ww, 1 if t.get("intermittent") == "yes" else 0, cl])
        hw = t.get("highway")
        if (hw in PATHK or t.get("bicycle") == "designated" and hw not in DRIVE) and not (hw == "footway" and t.get("footway") in ("sidewalk", "crossing", "access_aisle")):
            self.paths.append([hw or "path", t.get("name") or "", cl])
        if t.get("amenity") == "parking" and w.is_closed() and t.get("parking", "surface") == "surface":
            area = ring_area(coords)
            cx = sum(x for x, _ in coords[:-1]) / max(1, len(coords) - 1); cy = sum(y for _, y in coords[:-1]) / max(1, len(coords) - 1)
            self.parking.append([t.get("name") or "", t.get("operator") or t.get("owner") or "", t.get("access") or "", t.get("parking") or "", round(area), [R(cx), R(cy)], cl])
            if t.get("park_ride") not in (None, "no"):
                self.dest.append(["park-and-ride", t.get("name") or "", R(cx), R(cy)])
        if w.is_closed() and (t.get("amenity") in DEST_AMEN or t.get("shop") in DEST_SHOP or t.get("leisure") == "park"):
            cx = sum(x for x, _ in coords[:-1]) / max(1, len(coords) - 1); cy = sum(y for _, y in coords[:-1]) / max(1, len(coords) - 1)
            self._dest(t, cx, cy)
        if hw in DRIVE and t.get("name") and t.get("area") != "yes":
            ids = [n.ref for n in w.nodes]
            nm = t.get("name")
            for i in ids:
                self.node_names[i].add(nm)
            self.roads.append((w.id, nm, hw, t.get("maxspeed") or "", t.get("lanes") or "", ids, cl))


h = H()
h.apply_file(src, locations=True, idx="flex_mem")
roads = []
for wid, nm, hw, ms, ln, ids, cl in h.roads:
    cross = []
    for i, nid in enumerate(ids):
        others = sorted(h.node_names[nid] - {nm})
        if others:
            cross.append([i, others[0]])
    roads.append([wid, nm, hw, ms, ln, cl, cross])
if len(sys.argv) > 3:   # optional clip box "w,s,e,n" for state or regional extracts
    W_, S_, E_, N_ = (float(v) for v in sys.argv[3].split(","))
    inb = lambda x, y: W_ <= x <= E_ and S_ <= y <= N_
    anyin = lambda cl: any(inb(x, y) for x, y in cl)
    h.water = [w for w in h.water if anyin(w[3])]; h.paths = [p for p in h.paths if anyin(p[2])]
    h.parking = [p for p in h.parking if inb(*p[5])]; h.dest = [d for d in h.dest if inb(d[2], d[3])]
    roads = [r for r in roads if anyin(r[5])]; h.calm = [c for c in h.calm if inb(c[1], c[2])]
state = ""
try:
    state = [l.split("=")[1].replace("\\", "") for l in open(src.replace("-latest.osm.pbf", ".state.txt")).read().splitlines() if l.startswith("timestamp")][0]
except Exception:
    pass
json.dump({"source": src, "osm_timestamp": state, "water": h.water, "paths": h.paths, "parking": h.parking, "dest": h.dest, "roads": roads, "calm": h.calm}, open(out, "w"))
print(out, {k: len(v) for k, v in [("water", h.water), ("paths", h.paths), ("parking", h.parking), ("dest", h.dest), ("roads", roads), ("calm", h.calm)]}, "osm", state)
