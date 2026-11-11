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
import sys, os, json, math, collections
import osmium

src, out = sys.argv[1:3]
# optional clip box "w,s,e,n" for state or regional extracts: features whose extent misses it are dropped while reading (the exact clip
# below still applies), so a state file is not held in memory whole (Florida: 6 GB before)
BOXC = tuple(float(v) for v in sys.argv[3].split(",")) if len(sys.argv) > 3 else None


def near(xs, ys):
    return BOXC is None or not (max(xs) < BOXC[0] - 1e-5 or min(xs) > BOXC[2] + 1e-5 or max(ys) < BOXC[1] - 1e-5 or min(ys) > BOXC[3] + 1e-5)
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
        self.water_areas = []                 # outer rings of river / canal water polygons: the shore of wide rivers (Hudson, East River ...)
        self.roads = []                       # (way_id, name, hw, maxspeed, lanes, node_ids, coords)
        self.node_names = collections.defaultdict(set)

    def node(self, n):
        if BOXC is not None and not (BOXC[0] - 1e-5 <= n.location.lon <= BOXC[2] + 1e-5 and BOXC[1] - 1e-5 <= n.location.lat <= BOXC[3] + 1e-5):
            return
        t = n.tags
        tc = t.get("traffic_calming"); hw = t.get("highway")
        if tc or hw == "traffic_calming":
            self.calm.append([tc or "yes", R(n.location.lon), R(n.location.lat)])
        elif hw == "crossing" or t.get("crossing") in ("marked", "zebra", "traffic_signals"):
            self.calm.append(["crossing:" + (t.get("crossing") or "yes"), R(n.location.lon), R(n.location.lat)])
        self._dest(t, n.location.lon, n.location.lat)

    def area(self, a):
        t = a.tags
        if not (t.get("waterway") == "riverbank" or (t.get("natural") == "water" and t.get("water") in ("river", "canal", "oxbow", "stream", "tidal_channel"))):
            return
        try:
            for ring in a.outer_rings():
                cl = [[R(n.lon), R(n.lat)] for n in ring]
                if len(cl) >= 4 and near([p[0] for p in cl], [p[1] for p in cl]):
                    self.water_areas.append(cl)
        except Exception:
            return

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
        if len(coords) < 2 or not near([x for x, _ in coords], [y for _, y in coords]):
            return
        cl = [[R(x), R(y)] for x, y in coords]
        ww = t.get("waterway")
        if ww in ("river", "stream", "canal", "drain") and t.get("tunnel") in (None, "no") and t.get("covered") != "yes" and t.get("layer", "0") not in ("-1", "-2") \
                and "tunnel" not in (t.get("name") or "").lower():   # any tunnel (culvert, flushing tunnel, ...) is underground
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
# a state-sized input (e.g. Florida's 713 MB file) needs ~6 GB for an in-memory node index: use a disk index there (16 bytes per node)
_big = os.path.getsize(src) > 300e6
_idxf = os.path.join(os.path.dirname(os.path.abspath(out)), ".osm_sites_nodes.idx") if _big else None
_lock = None
if _big:
    # county builds run side by side: one disk index at a time, begun only while the disk has room for it (about 2 bytes of index per
    # byte of input: Washington's 440 MB file made an 872 MB index) and 800 MB more for the other builds; after 2 hours of waiting, stop
    import fcntl, shutil, time
    _lock = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".osm_sites_idx.lock"), "w")
    fcntl.flock(_lock, fcntl.LOCK_EX)
    _need, _t0 = 2.1 * os.path.getsize(src) + 800e6, time.time()
    while shutil.disk_usage(os.path.dirname(os.path.abspath(out))).free < _need:
        if time.time() - _t0 > 7200:
            sys.exit(f"osm_sites: {_need / 1e9:.1f} GB not free after 2 hours of waiting; node index not built")
        print(f"osm_sites: waiting for {_need / 1e9:.1f} GB free for the node index", flush=True); time.sleep(60)
try:
    h.apply_file(src, locations=True, idx=f"sparse_file_array,{_idxf}" if _big else "flex_mem")
finally:
    if _idxf and os.path.exists(_idxf):
        os.remove(_idxf)
    if _lock:
        _lock.close()
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
    h.water_areas = [w for w in h.water_areas if anyin(w)]
    h.parking = [p for p in h.parking if inb(*p[5])]; h.dest = [d for d in h.dest if inb(d[2], d[3])]
    roads = [r for r in roads if anyin(r[5])]; h.calm = [c for c in h.calm if inb(c[1], c[2])]
state = ""
try:
    state = [l.split("=")[1].replace("\\", "") for l in open(src.replace("-latest.osm.pbf", ".state.txt")).read().splitlines() if l.startswith("timestamp")][0]
except Exception:
    pass
json.dump({"source": src, "osm_timestamp": state, "water": h.water, "paths": h.paths, "parking": h.parking, "dest": h.dest, "roads": roads, "calm": h.calm, "water_areas": h.water_areas}, open(out, "w"))
print(out, {k: len(v) for k, v in [("water", h.water), ("paths", h.paths), ("parking", h.parking), ("dest", h.dest), ("roads", roads), ("calm", h.calm), ("water_areas", h.water_areas)]}, "osm", state)
