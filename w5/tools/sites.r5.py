"""Site-specific suggestions per block group (City Pretty round 5): where a creek/channel path, a parking-lot park, EV chargers
and traffic calming could go, with the evidence behind each.  usage: python3 sites.py la|oc <out.json>

Inputs (all real downloads; nothing synthetic):
  OpenStreetMap county extract (osm_sites.py output): waterways, paths, surface parking lots, destinations, named roads + cross streets,
    existing traffic-calming devices
  CHP CCRS crashes 2016-2025 (data.ca.gov): crashes with coordinates, killed/injured, pedestrian/bicycle involvement
  USDOT/BTS NTAD Alternative Fueling Stations (AFDC copy, updated daily): public, available EV stations
  LA only: LADOT speed humps (ArcGIS), LA County Public Works open channels, the page's Assessor-based parking-lot inventory
Every suggestion carries the facts it rests on (lengths, counts, distances) and is labelled a screening candidate, not a plan.
"""
import sys, os, json, math, re, collections
import numpy as np
import shapely
from shapely.geometry import shape, Point, LineString, Polygon, MultiLineString
from shapely.ops import unary_union, linemerge
from shapely.strtree import STRtree

COUNTY = sys.argv[1]; OUT = sys.argv[2]
SHARD = tuple(int(x) for x in sys.argv[3].split("/")) if len(sys.argv) > 3 else (0, 1)   # i/n: process every n-th block group (parallel runs; merge after)
W5 = "/home/user/w5"; OCP = "/home/user/handoff/pipe/oc_pipeline/data"
LAT0 = 34.0; KX = 111320.0 * math.cos(math.radians(LAT0)); KY = 110540.0
P = lambda x, y: (x * KX, y * KY)
def proj(g): return shapely.transform(g, lambda c: c * np.array([KX, KY]))
def unproj_pt(x, y): return (round(x / KX, 5), round(y / KY, 5))

def enc(coords):
    """Google polyline (lat, lon), precision 1e5 — the page's decodeLine format"""
    out, plat, plon = [], 0, 0
    for lon, lat in coords:
        ilat, ilon = int(round(lat * 1e5)), int(round(lon * 1e5))
        for v in (ilat - plat, ilon - plon):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1f)) + 63)); v >>= 5
            out.append(chr(v + 63))
        plat, plon = ilat, ilon
    return "".join(out)

def dec(s):
    coords, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        for which in (0, 1):
            shift = res = 0
            while True:
                b = ord(s[i]) - 63; i += 1; res |= (b & 0x1f) << shift; shift += 5
                if b < 0x20: break
            d = ~(res >> 1) if res & 1 else res >> 1
            if which == 0: lat += d
            else: lon += d
        coords.append((lon / 1e5, lat / 1e5))
    return coords

def line_coords_m(g):
    """projected geometry -> list of lon/lat coordinate lists"""
    parts = list(g.geoms) if hasattr(g, "geoms") else [g]
    out = []
    for p in parts:
        if p.geom_type == "LineString" and len(p.coords) > 1:
            out.append([(x / KX, y / KY) for x, y in p.coords])
    return out

fmt_m = lambda m: f"{m / 1609.34:.2f} mi" if m >= 400 else f"{int(round(m / 10) * 10)} m"
title = lambda s: " ".join(w if (w.isupper() and len(w) <= 3 and w not in ("AVE", "RD", "ST", "DR", "BLVD", "LN", "WAY", "PL", "CT", "CIR")) else w.capitalize() for w in re.split(r"\s+", s.strip())) if s and s.isupper() else s

# ---------------------------------------------------------------- load the county
V = json.load(open(f"{W5}/research/verified.json"))
if COUNTY == "la":
    B = json.load(open(f"{W5}/bundle_in.json"))
    DET = json.load(open("/home/user/page/dec/details.json"))
    BG = {f["properties"]["id"]: (shape(f["geometry"]), (DET.get(f["properties"]["id"]) or {}).get("m") or {}, f["properties"]) for f in B["bgs"]["features"]}
    OSM = json.load(open(f"{W5}/la_data/osm_sites_la.json"))
    CR_FILES = [f"{W5}/la_data/ccrs_la_{y}.json" for y in range(2016, 2026)]
else:
    OC = json.load(open(f"{OCP}/bundle-oc.json"))
    BG = {f["properties"]["id"]: (shape(f["geometry"]), (OC["details"].get(f["properties"]["id"]) or {}).get("m") or {}, f["properties"]) for f in OC["features"]}
    # use the unsimplified Census polygons for geometry tests
    raw = {f["properties"]["GEOID"]: shape(f["geometry"]) for f in json.load(open(f"{OCP}/bg.geojson"))["features"]}
    BG = {g: (raw.get(g, v[0]), v[1], v[2]) for g, v in BG.items()}
    OSM = json.load(open(f"{W5}/oc_data/osm_sites_oc.json"))
    CR_FILES = [f"{OCP}/ccrs_{y}.json" for y in range(2016, 2026)]
print(COUNTY, "block groups", len(BG), "osm", OSM.get("osm_timestamp"))
gids = list(BG)
bgm = {g: proj(BG[g][0].buffer(0)) for g in gids}
bg_tree = STRtree([bgm[g] for g in gids])

# ---------------------------------------------------------------- crashes
def crash_rows():
    for fpath in CR_FILES:
        j = json.load(open(fpath))
        rows = j["rows"] if isinstance(j, dict) else [[r.get("Collision Id"), r.get("Latitude"), r.get("Longitude"), r.get("NumberKilled"), r.get("NumberInjured"), r.get("MotorVehicleInvolvedWithDesc"), r.get("Crash Date Time")] for r in j]
        for r in rows:
            try:
                lat, lon = float(r[1]), float(r[2])
            except (TypeError, ValueError):
                continue
            if not (32.5 < lat < 35.5 and -119.5 < lon < -117):
                continue
            k = int(r[3] or 0); inj = int(r[4] or 0); w = (r[5] or "").upper()
            yield lon, lat, k, inj, "PEDESTRIAN" in w, "BICYCLE" in w, str(r[6] or "")[:4]
CR = np.array([(P(lo, la)[0], P(lo, la)[1], k, inj, pd, bk, int(y) if y.isdigit() else 0) for lo, la, k, inj, pd, bk, y in crash_rows()], dtype=float)
CR = CR[(CR[:, 2] + CR[:, 3]) > 0]            # injury or fatal crashes only
print("injury/fatal crashes with coordinates", len(CR), "years", int(CR[:, 6].min()), int(CR[:, 6].max()))
cr_pts = shapely.points(CR[:, 0], CR[:, 1])

# ---------------------------------------------------------------- roads, intersections, existing calming
DRIVE_LOCAL = {"residential", "living_street", "unclassified"}
roads = OSM["roads"]
road_geoms = [proj(LineString(r[5])) for r in roads]
road_tree = STRtree(road_geoms)
# snap crashes to the nearest named road within 25 m
idx_cr, idx_rd = road_tree.query_nearest(cr_pts, max_distance=25, all_matches=False)
cr_road = np.full(len(CR), -1); cr_road[idx_cr] = idx_rd
# intersections: vertex of a road with a cross street
inter = {}          # key (round x, round y) -> [x, y, {names}]
for ri, r in enumerate(roads):
    cl = r[5]
    for vi, cross in r[6]:
        x, y = P(*cl[vi]); k = (round(x / 8), round(y / 8))
        e = inter.setdefault(k, [x, y, set()]); e[2].update([r[1], cross])
INT = list(inter.values()); int_pts = shapely.points([e[0] for e in INT], [e[1] for e in INT]); int_tree = STRtree(int_pts)
calm_kinds = {"hump", "table", "cushion", "bump", "chicane", "choker", "island", "rumble_strip", "yes"}
CALM = [P(c[1], c[2]) for c in OSM["calm"] if c[0] in ("hump", "table", "cushion")]
HUMPS_SRC = "OpenStreetMap traffic_calming=hump/table/cushion"
if COUNTY == "la":
    for f in json.load(open(f"{W5}/la_data/la_speed_humps.geojson"))["features"]:
        if (f["properties"].get("Status") or "").strip() in ("Installed", ""):
            x, y = f["geometry"]["coordinates"][:2]; CALM.append(P(x, y))
    HUMPS_SRC += " + LADOT speed humps layer (last edited 26 Aug 2024)"
calm_tree = STRtree(shapely.points([c[0] for c in CALM], [c[1] for c in CALM])) if CALM else None

# ---------------------------------------------------------------- destinations, schools
DEST = [(d[0], d[1], P(d[2], d[3])) for d in OSM["dest"]]
dest_tree = STRtree(shapely.points([d[2][0] for d in DEST], [d[2][1] for d in DEST]))
SCHOOLS = [d for d in DEST if d[0] == "school" and d[1]]
school_tree = STRtree(shapely.points([d[2][0] for d in SCHOOLS], [d[2][1] for d in SCHOOLS]))

def near_dest(pt, r, kinds=None, named=True):
    out = []
    for i in dest_tree.query(pt.buffer(r)):
        k, n, (x, y) = DEST[int(i)]
        if (kinds and k not in kinds) or (named and not n):
            continue
        d = math.hypot(x - pt.x, y - pt.y)
        if d <= r:
            out.append((d, k, n))
    return sorted(out)

def nearest_street(pt, r=60):
    best = None
    for i in road_tree.query(pt.buffer(r)):
        d = road_geoms[int(i)].distance(pt)
        if d <= r and (best is None or d < best[0]):
            best = (d, roads[int(i)][1])
    return best[1] if best else None

# ---------------------------------------------------------------- EV stations
EV = json.load(open(f"{W5}/la_data/afdc_ev_la_oc.geojson"))
evs = [f["properties"] for f in EV["features"] if f["properties"]["access_code"] == "public" and f["properties"]["status_code"] == "E" and f["geometry"]]
ev_l2 = [P(p["longitude"], p["latitude"]) for p in evs if (p["ev_level2_evse_num"] or 0) > 0]
ev_dc = [P(p["longitude"], p["latitude"]) for p in evs if (p["ev_dc_fast_num"] or 0) > 0]
evl2_tree = STRtree(shapely.points([a for a, b in ev_l2], [b for a, b in ev_l2])); evdc_tree = STRtree(shapely.points([a for a, b in ev_dc], [b for a, b in ev_dc]))
def nearest_d(tree, pt):
    i = tree.nearest(pt); g = tree.geometries[int(i)]; return g.distance(pt)
EV_DATE = "AFDC via USDOT/BTS NTAD, downloaded " + (EV.get("downloaded") or "")

# ---------------------------------------------------------------- waterways and paths
water = []   # (name, kind, maintained_by, projected line)
for nm, ww, inter_, cl in OSM["water"]:
    if nm and len(cl) > 1:
        water.append((title(nm), ww, None, proj(LineString(cl))))
if COUNTY == "la":
    for f in json.load(open(f"{W5}/la_data/la_open_channels.geojson"))["features"]:
        pr = f["properties"]; nm = (pr.get("NAME") or "").strip()
        if not nm or nm in ("Unknown", "LA City Channel") or not f["geometry"]:
            continue
        nm = re.split(r"\s+-\s+", nm)[0]
        water.append((title(nm), "channel", (pr.get("MAINTAINED_BY") or "").strip() or None, proj(LineString(f["geometry"]["coordinates"]))))
water_tree = STRtree([w[3] for w in water])
paths = [proj(LineString(p[2])) for p in OSM["paths"] if len(p[2]) > 1]
PATH_SRC = "OpenStreetMap cycleways/paths/footways (not sidewalks)"
if COUNTY == "la":
    # LA County Countywide Trails (Park Needs Assessment Plus layer 22): official trail inventory, developed trails only
    for f in json.load(open(f"{W5}/la_data/la_countywide_trails.geojson"))["features"]:
        g = f["geometry"]
        if not g or (f["properties"].get("RRE_TRAIL_STATUS") or "").upper() not in ("DEVELOPED", ""):
            continue
        for part in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
            if len(part) > 1:
                paths.append(proj(LineString([c[:2] for c in part])))
    PATH_SRC += " + LA County Countywide Trails (developed)"
MR = []   # OC Flood Control District maintenance roads: (status 0 none / 1 below 10 ft / 2 meets 10 ft, facility, projected line)
if COUNTY == "oc":
    for f in json.load(open(f"{W5}/oc_data/ocpw_bikeways_2024.geojson"))["features"]:
        g = f["geometry"]
        if g and f["properties"].get("Class_Type") == 1:
            for part in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
                if len(part) > 1: paths.append(proj(LineString([c[:2] for c in part])))
    PATH_SRC += " + OC Public Works bikeways 2024 (Class I) + OCFCD maintenance roads marked as trails"
    for lvl in (0, 1, 2):
        for f in json.load(open(f"{W5}/oc_data/ocfcd_maint_rd_{lvl}.geojson"))["features"]:
            g = f["geometry"]; pr = f["properties"]
            if not g: continue
            fac = next((v for v in (pr.get("Fac_Name"), pr.get("Fac_Num")) if v and not re.match(r"^[A-Z]\d{2}", v)), pr.get("Fac_Name") or "")
            for part in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
                if len(part) < 2: continue
                ln = proj(LineString([c[:2] for c in part])); MR.append((lvl, fac, ln))
                if lvl == 2 and (pr.get("Trail_Status") or "") == "Yes": paths.append(ln)
mr_tree = STRtree([m[2] for m in MR]) if MR else None
def maint_roads(geom):
    """metres of the waterway with an OCFCD maintenance road within 40 m, by status"""
    if mr_tree is None: return None
    out = [0.0, 0.0, 0.0]; facs = collections.Counter()
    for i in mr_tree.query(geom.buffer(40)):
        lvl, fac, ln = MR[int(i)]
        part = geom.intersection(ln.buffer(40)).length
        if part > 0: out[lvl] += part; facs[fac] += part
    return [round(x) for x in out] + [facs.most_common(1)[0][0] if facs else None] if sum(out) else None
path_union_tree = STRtree(paths)
def path_covered(line, buf=30):
    """length of `line` that has an existing path within buf metres"""
    near = [paths[int(i)] for i in path_union_tree.query(line.buffer(buf))]
    if not near:
        return 0.0
    return line.intersection(unary_union(near).buffer(buf)).length

# ---------------------------------------------------------------- parking lots
LOTS = []   # (name, operator, access, area_m2, projected polygon, centroid, source, extra)
for nm, op, acc, pk, area, c, cl in OSM["parking"]:
    if area < 600 or acc in ("private", "no", "permit") or len(cl) < 4:
        continue
    try:
        pg = proj(Polygon(cl)).buffer(0)
    except Exception:
        continue
    LOTS.append(dict(nm=nm, op=op, acc=acc, area=area, pg=pg, c=pg.representative_point(), src="osm", cl=cl))
lot_tree = STRtree([l["c"] for l in LOTS])
ASSESSOR_LOTS = collections.defaultdict(list)
if COUNTY == "la":
    under = B["under"]["sites"]; cells = B["layers"]["underused"]["cells"]
    shapes_by_i = {}
    for k, items in cells.items():
        for i, rings in items:
            shapes_by_i.setdefault(i, rings)
    for s in under:
        if s["k"] == "parking lot" and not s["bs"] and 0.15 <= (s["ac"] or 0) <= 5 and s["i"] in shapes_by_i:
            ring = dec(shapes_by_i[s["i"]][0])
            if len(ring) >= 4:
                ASSESSOR_LOTS[s["gid"]].append((s, proj(Polygon(ring)).buffer(0)))

# ---------------------------------------------------------------- generate per block group
def creek(g, poly, m):
    out = []; near = poly.buffer(400)
    groups = collections.defaultdict(list)
    for i in water_tree.query(near):
        nm, kind, mb, ln = water[int(i)]
        seg = ln.intersection(near)
        if not seg.is_empty and seg.length > 0:
            groups[nm].append((kind, mb, seg))
    for nm, segs in groups.items():
        geom = unary_union([s for _, _, s in segs]); L = geom.length
        if L < 300:
            continue
        wide = kind in ("river", "canal") or "River" in nm or kind == "channel" and any(w in nm for w in ("River", "Wash", "Creek"))
        cov = path_covered(geom, 150 if wide else 80); free = L - cov
        kinds = collections.Counter(k for k, _, _ in segs); kind = kinds.most_common(1)[0][0]
        mb = next((mb for _, mb, _ in segs if mb), None)
        if free < 300 or free / L < 0.5:
            continue
        lo, hi = 2.0, 3.6   # $M per mile: Puente Creek (programmed) and Coyote Creek (ATP allocation) benchmarks
        mi = free / 1609.34
        d_edge = geom.distance(poly)
        mr = maint_roads(geom) if COUNTY == "oc" else None
        out.append({"t": "creek", "p": "corridor_trail", "nm": nm, "kind": kind, "len": round(L), "free": round(free), "covered": round(cov), "mb": mb, "mr": mr,
                    "d": round(d_edge), "cost": [round(lo * mi * 1e6, -4), round(hi * mi * 1e6, -4)],
                    "g": [enc(c) for c in line_coords_m(geom.simplify(8))][:6]})
    return sorted(out, key=lambda o: -o["free"])[:2]

def lot_park(g, poly, m):
    pn = m.get("pn"); pa = m.get("pa") or 0
    need = (pn is not None and pn > 805) or pa < 1.0      # nearest park over half a mile away, or under 1 acre of park within half a mile
    if not need:
        return []
    out = []
    if COUNTY == "la":
        for s, pg in ASSESSOR_LOTS.get(g, []):
            c = pg.representative_point(); dn = near_dest(c, 150)
            if near_dest(c, 100, {"park"}, named=False):
                continue
            out.append({"t": "lot_park", "p": "pocket_park", "src": "assessor", "site": s["i"], "ac": s["ac"], "ad": s["ad"] or None, "use": s["use"], "z": s["z"],
                        "lav": s["lav"], "own": s["own"], "st": nearest_street(c), "next": (dn[0][2], dn[0][1]) if dn else None, "pn": pn, "pa": pa,
                        "pt": unproj_pt(c.x, c.y), "g": [enc([(x / KX, y / KY) for x, y in pg.exterior.coords])] if pg.geom_type == "Polygon" else []})
    else:
        for i in lot_tree.query(poly):
            l = LOTS[int(i)]
            if not poly.contains(l["c"]) or not (600 <= l["area"] <= 20000):
                continue
            c = l["c"]; dn = near_dest(c, 150)
            if near_dest(c, 100, {"park"}, named=False) or re.search(r"staging|trailhead|park\b", (l["nm"] or "") + " " + (l["op"] or ""), re.I):
                continue                                   # parking that serves a park already
            public_op = re.search(r"city|county|district|school|college|ocTA|metrolink|state of|caltrans|transit", l["op"] or "", re.I)
            civic = dn and dn[0][1] in ("library", "community center", "city hall", "park-and-ride")
            if not (public_op or civic):
                continue                                   # OSM does not record ownership: keep only publicly run lots or lots at civic buildings
            out.append({"t": "lot_park", "p": "pocket_park", "src": "osm", "ac": round(l["area"] / 4046.86, 2), "nmlot": l["nm"] or None, "op": l["op"] or None,
                        "st": nearest_street(c), "next": (dn[0][2], dn[0][1]) if dn else None, "pn": pn, "pa": pa, "pt": unproj_pt(c.x, c.y),
                        "g": [enc(l["cl"])]})
    # prefer lots next to a public destination, then sizes closest to a pocket park (0.25-1 acre)
    pub = {"library", "community center", "city hall", "school", "park", "park-and-ride", "rail station", "college"}
    out.sort(key=lambda o: (0 if (o.get("next") and o["next"][1] in pub) or o.get("own") or o.get("op") else 1, abs(math.log(max(o["ac"], 0.05) / 0.5))))
    return out[:2]

EV_DEST = {"library", "community center", "city hall", "park", "supermarket", "shopping center", "department store", "college", "university", "hospital", "park-and-ride", "rail station"}
def ev_sites(g, poly, m):
    out = []
    for i in lot_tree.query(poly):
        l = LOTS[int(i)]
        if not poly.contains(l["c"]) or l["area"] < 800:
            continue
        c = l["c"]; dn = near_dest(c, 120, EV_DEST)
        if not dn:
            continue
        d2 = nearest_d(evl2_tree, c); dd = nearest_d(evdc_tree, c)
        if min(d2, dd) < 800:
            continue
        big = l["area"] >= 4000 and dn[0][1] in ("supermarket", "shopping center", "department store", "park-and-ride", "rail station", "hospital")
        n_l2 = 6 if l["area"] >= 2000 else 4
        out.append({"t": "ev", "p": "ev_hub", "dest": dn[0][2], "dk": dn[0][1], "ac": round(l["area"] / 4046.86, 2), "nmlot": l["nm"] or None, "op": l["op"] or None,
                    "st": nearest_street(c), "dl2": round(d2), "ddc": round(dd), "n_l2": n_l2, "n_dc": 4 if (big and dd > 1600) else 0,
                    "pt": unproj_pt(c.x, c.y), "g": [enc(l["cl"])]})
    out.sort(key=lambda o: -(o["dl2"] + (2000 if o["n_dc"] else 0)))
    seen, res = set(), []
    for o in out:
        if o["dest"] in seen: continue
        seen.add(o["dest"]); res.append(o)
    return res[:2]

ART = {"motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
art_idx = [j for j, r in enumerate(roads) if r[2] in ART]
art_tree = STRtree([road_geoms[j] for j in art_idx])
_ai, _ = art_tree.query_nearest(cr_pts, max_distance=20, all_matches=False)
near_art = np.zeros(len(CR), bool); near_art[_ai] = True
# crashes per block group (index once)
cr_tree = STRtree(cr_pts)
def calming(g, poly, m):
    res = []
    hits = [int(i) for i in cr_tree.query(poly.buffer(20)) if poly.buffer(20).contains(cr_pts[int(i)])]
    if not hits:
        return res
    # --- residential streets: injury crashes per street name within this block group
    by_street = collections.defaultdict(list)
    for i in hits:
        ri = cr_road[i]
        if ri >= 0 and roads[ri][2] in DRIVE_LOCAL and not near_art[i]:
            by_street[roads[ri][1]].append(i)
    for name, cis in by_street.items():
        if len(cis) < 2:
            continue
        segs = [(ri, road_geoms[ri]) for ri in range(0)]  # placeholder
        ridx = [int(j) for j in road_tree.query(poly.buffer(20)) if roads[int(j)][1] == name and roads[int(j)][2] in DRIVE_LOCAL]
        if not ridx:
            continue
        geom = unary_union([road_geoms[j].intersection(poly.buffer(20)) for j in ridx])
        L = geom.length
        if L < 120:
            continue
        lanes = [roads[j][4] for j in ridx if roads[j][4]]; speeds = [roads[j][3] for j in ridx if roads[j][3]]
        multi_lane = any(re.match(r"^\d+$", x) and int(x) > 2 for x in lanes)
        fast = any(re.match(r"^\d+", x) and int(re.match(r"^\d+", x).group()) > 30 for x in speeds)
        # existing humps on this street segment
        humps = 0
        if calm_tree is not None:
            humps = len(calm_tree.query(geom.buffer(15), predicate="intersects"))
        # cross streets bounding the street inside the block group
        cross = []
        for j in ridx:
            cl = roads[j][5]
            for vi, cn in roads[j][6]:
                x, y = P(*cl[vi])
                if poly.buffer(20).contains(Point(x, y)) and cn != name:
                    cross.append((x, y, cn))
        ends = None
        if len(cross) >= 2:
            line = linemerge(geom) if geom.geom_type == "MultiLineString" else geom
            ref = line if line.geom_type == "LineString" else max(line.geoms, key=lambda q: q.length)
            pos = sorted((ref.project(Point(x, y)), cn) for x, y, cn in cross)
            if pos[0][1] != pos[-1][1]:
                ends = (pos[0][1], pos[-1][1])
        C = CR[cis]
        ped = int(C[:, 4].sum()); bike = int(C[:, 5].sum()); killed = int((C[:, 2] > 0).sum())
        sch = [SCHOOLS[int(k)][1] for k in school_tree.query(geom.buffer(250))]
        eligible = not multi_lane and not fast and humps == 0
        res.append({"t": "calm", "p": "traffic_calming", "street": name, "from": ends[0] if ends else None, "to": ends[1] if ends else None,
                    "len": round(L), "n": len(cis), "ped": ped, "bike": bike, "killed": killed, "humps": humps, "elig": eligible,
                    "lanes": max([int(x) for x in lanes if x.isdigit()] or [0]) or None, "speed": speeds[0] if speeds else None,
                    "school": sorted(set(sch))[:1] or None, "rate": round(len(cis) / (L / 1000), 1),
                    "g": [enc(c) for c in line_coords_m(geom.simplify(5))][:6]})
    res.sort(key=lambda o: (-(o["killed"] * 5 + o["ped"] * 2 + o["bike"] * 2 + o["n"]), -o["rate"]))
    res = [o for o in res if o["n"] >= 3 or o["ped"] + o["bike"] + o["killed"] >= 2][:2]
    # --- intersections with pedestrian / bicycle injury crashes
    pb = [i for i in hits if CR[i, 4] or CR[i, 5]]
    if pb:
        near_i = {}
        ii, jj = int_tree.query_nearest(shapely.points(CR[pb, 0], CR[pb, 1]), max_distance=30, all_matches=False)
        for a, b in zip(ii, jj):
            near_i.setdefault(int(b), []).append(pb[int(a)])
        best = sorted(near_i.items(), key=lambda kv: -len(kv[1]))
        for k, cis in best[:2]:
            if len(cis) < 3:
                continue
            x, y, names = INT[k]
            if not poly.buffer(20).contains(Point(x, y)):
                continue
            C = CR[cis]
            nm = sorted(names)[:2]
            res.append({"t": "xing", "p": "crosswalks", "at": nm, "n": len(cis), "ped": int(C[:, 4].sum()), "bike": int(C[:, 5].sum()), "killed": int((C[:, 2] > 0).sum()),
                        "school": [SCHOOLS[int(s)][1] for s in school_tree.query(Point(x, y).buffer(250))][:1] or None, "pt": unproj_pt(x, y)})
    return res

OUTD = {}
cnt = collections.Counter()
for n, g in enumerate(gids):
    if n % SHARD[1] != SHARD[0]:
        continue
    poly = bgm[g]; m = BG[g][1]
    items = creek(g, poly, m) + lot_park(g, poly, m) + ev_sites(g, poly, m) + calming(g, poly, m)
    for it in items:
        cnt[it["t"]] += 1
    if items:
        OUTD[g] = items
    if n % 1000 == 0:
        print(n, dict(cnt), flush=True)
meta = {"county": COUNTY, "built": __import__("datetime").date.today().isoformat(), "osm": OSM.get("osm_timestamp"), "crash_years": [int(CR[:, 6].min()), int(CR[:, 6].max())],
        "crashes": int(len(CR)), "ev_source": EV_DATE, "ev_public_l2": len(ev_l2), "ev_public_dc": len(ev_dc), "humps_source": HUMPS_SRC, "paths_source": PATH_SRC, "counts": dict(cnt),
        "verified": V}
json.dump({"meta": meta, "sites": OUTD}, open(OUT, "w"), separators=(",", ":"))
print("done", COUNTY, "block groups with suggestions", len(OUTD), dict(cnt))
