"""Small geometry helpers shared by the Orange County pipeline (no GDAL/pyproj needed; shapely only)."""
import math
from shapely.geometry import shape, Point, LineString, Polygon, MultiPolygon, mapping
from shapely.ops import unary_union, transform
from shapely.strtree import STRtree

import region
LAT0 = region.LAT0   # county mid-latitude for the local equirectangular projection (Orange County: 33.70)
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110540.0


def to_xy(lon, lat):
    return lon * KX, lat * KY


def to_ll(x, y):
    return x / KX, y / KY


def proj(geom):
    """shapely geometry in lon/lat -> local metres"""
    return transform(lambda x, y, z=None: (x * KX, y * KY), geom)


def unproj(geom):
    return transform(lambda x, y, z=None: (x / KX, y / KY), geom)


def enc_polyline(coords, precision=1e5):
    """Google encoded polyline of [(lat, lon), ...] (what the page's decodeLine expects)"""
    out = []; plat = plon = 0
    for lat, lon in coords:
        ilat, ilon = int(round(lat * precision)), int(round(lon * precision))
        for v in (ilat - plat, ilon - plon):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1f)) + 63)); v >>= 5
            out.append(chr(v + 63))
        plat, plon = ilat, ilon
    return "".join(out)


def enc_ring_lonlat(ring):
    return enc_polyline([(y, x) for x, y in ring])


def cell_key(lon, lat, cell=0.05):
    return f"{math.floor((lon + 180) / cell)},{math.floor((lat + 90) / cell)}"


def acres(geom_ll):
    return proj(geom_ll).area / 4046.856


def haversine_m(lon1, lat1, lon2, lat2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


class PointIndex:
    """nearest-distance queries for a set of points (metres); points: list of (lon, lat, payload)"""
    def __init__(self, pts):
        self.pts = pts
        self.geoms = [Point(*to_xy(p[0], p[1])) for p in pts]
        self.tree = STRtree(self.geoms) if self.geoms else None

    def nearest(self, lon, lat):
        if not self.tree:
            return None, None
        q = Point(*to_xy(lon, lat))
        i = self.tree.nearest(q)
        i = int(i) if not hasattr(i, "distance") else self.geoms.index(i)
        return self.geoms[i].distance(q), self.pts[i][2] if len(self.pts[i]) > 2 else None

    def count_within(self, lon, lat, r):
        if not self.tree:
            return 0
        q = Point(*to_xy(lon, lat)).buffer(r)
        hits = self.tree.query(q)
        return int(sum(1 for i in hits if self.geoms[int(i)].intersects(q)))


class GeomIndex:
    """distance / intersection queries against polygons or lines (metres)"""
    def __init__(self, geoms_ll, payloads=None):
        self.geoms = [proj(g) for g in geoms_ll]
        self.payloads = payloads or [None] * len(self.geoms)
        self.tree = STRtree(self.geoms) if self.geoms else None

    def nearest_dist(self, lon, lat):
        if not self.tree:
            return None
        q = Point(*to_xy(lon, lat))
        i = self.tree.nearest(q)
        i = int(i) if not hasattr(i, "distance") else self.geoms.index(i)
        return self.geoms[i].distance(q)

    def query(self, geom_m):
        if not self.tree:
            return []
        return [int(i) for i in self.tree.query(geom_m)]
