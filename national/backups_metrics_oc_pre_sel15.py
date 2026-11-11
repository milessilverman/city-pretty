"""Compute the per-block-group metrics dict `m` (same keys as the LA build's D.details[id].m) plus the extra geometry
inputs the engine needs (m["x"]). Reads ./data written by fetch_oc.py. Output: data/metrics.json"""
import os, sys, json, csv, math, statistics, collections, re
from shapely.geometry import shape, Point, LineString, MultiLineString, Polygon
from shapely.ops import unary_union
import geo
import sources_oc

import region
DATA = region.DATA
ld = lambda n: json.load(open(os.path.join(DATA, n), encoding="utf-8")) if os.path.exists(os.path.join(DATA, n)) else None


def osm_geom(el):
    """OSM element (with geometry from `out geom` or `center`) -> shapely lon/lat geometry or None"""
    if el["type"] == "node":
        return Point(el["lon"], el["lat"])
    if el["type"] == "way" and el.get("geometry"):
        pts = [(g["lon"], g["lat"]) for g in el["geometry"]]
        if len(pts) >= 4 and pts[0] == pts[-1]:
            return Polygon(pts)
        return LineString(pts) if len(pts) >= 2 else None
    if el["type"] in ("relation", "way_area") and el.get("members"):
        polys = []
        for mbr in el["members"]:
            if mbr.get("role") == "outer" and mbr.get("geometry"):
                pts = [(g["lon"], g["lat"]) for g in mbr["geometry"]]
                if len(pts) >= 4:
                    polys.append(Polygon(pts))
        if polys:
            return unary_union(polys)
    if el.get("center"):
        return Point(el["center"]["lon"], el["center"]["lat"])
    return None


def load_osm(theme):
    j = ld(f"osm_{theme}.json") or {"elements": []}
    out = []
    for el in j["elements"]:
        g = osm_geom(el)
        if g is not None and not g.is_empty:
            out.append((el.get("tags", {}), g, el))
    return confirm_rail_stations(out) if theme == "rail" else out


URBAN_RAIL = ("subway", "light_rail", "monorail")
AMUSEMENT_OP = __import__("re").compile(r"\b(disney|universal studios|universal orlando|six flags|cedar fair|busch gardens|seaworld|knott'?s|legoland|"
                                        r"dollywood|kings island|worlds of fun|amusement|theme park|water ?world|water ?park|kiddie|zoo|farm|market|mall|"
                                        r"event cent(er|re)|museum|expo|fair ?grounds?|state fair|county fair|resort|casino)\b", __import__("re").I)
# (operator / network words of parks, fairs, zoos, shops and resorts: Jungle Jim's International Market's monorail, Waldameer & Water World)
AIRPORT_OP = __import__("re").compile(r"\b(airport|aviation|air ?train|sky ?train|plane ?train)\b", __import__("re").I)   # airport people
AIRPORT_NAME = __import__("re").compile(r"\b(gates?|concourse)\b|^terminal\b|^\d{1,2}$", __import__("re").I)   # movers: Harry Reid's "C Gates"


def _airside(t, nm):
    """an airport people mover's station ("C Gates", "Terminal 1", Miami's "Gates E20-E35"): not transit for the neighbourhood"""
    return bool(AIRPORT_OP.search(" ".join(t.get(k) or "" for k in ("operator", "network"))) or AIRPORT_NAME.search(nm))


CONFIRM_TAGS = ("railway", "public_transport", "station", "train", "subway", "light_rail", "monorail", "operator", "network", "usage", "confirm_by", "from_area",
                "stop_position")


def _norm(v):
    return "".join(ch for ch in (v or "").lower() if ch.isalnum())


def confirm_rail_stations(rail, R_CONFIRM=400.0, R_SAME=150.0):
    """Round 8.4: which OpenStreetMap rail stations are served. The evidence is the stops of rail routes in the county's MobilityData feeds,
    current or stale, and in Amtrak's national feed (transit_rail_stops.json, fetch_oc selection 9). An OSM station is kept when
      1. a GTFS rail route stops within 400 m ("gtfs"); or a rail stop of the same name lies 1-15 km away, so one of the two positions is
         wrong (Metrolink's "Moreno Valley / March Field" sits at Riverside-Hunter Park/UCR in its feed): the OSM station counts, or
      2. it is a named metro, light-rail or monorail station (station= / subway= / light_rail= / monorail=), which heritage and excursion
         lines are not, of a named network or operator that is not an amusement park, a fair or an airport's people mover, and that has no
         current feed here: transit with no feed (the Las Vegas Monorail, Tren Urbano) and stations newer than a stale feed copy (SacRT's Dos
         Rios) stay ("mode"); theme-park and museum lines, which OpenStreetMap tags as monorails or light rail with no network, do not, or
      3. it is named and its operator or network runs rail routes in a stale feed of the county's (and in no current one): a station newer
         than the copy ("agency"). A station missing from its operator's current feed is not served (closed stations stay on the map).
    Every other station is dropped: heritage and tourist lines OpenStreetMap does not mark as such (Knoxville's Three Rivers Rambler, York
    County's heritage railroads), excursion stops, unnamed stop positions. A GTFS stop of a subway, commuter / intercity rail, monorail or
    funicular route with no kept station within 150 m becomes a station itself, under its GTFS name, once per 150 m (platforms of one
    station, the same station in two feeds); a tram, light-rail, cable-car or funicular stop only confirms an OSM station (a streetcar or
    cable-car stop is not a rail station). Each decision is written to rail_confirm.json. Older transit files (no rail-stop file): unchanged."""
    gp = ld("transit_rail_stops.json")
    if gp is None:
        return rail
    idx = geo.PointIndex([(p[0], p[1], p[2]) for p in gp]) if gp else None
    # Is each rail agency's feed current? From the transit step's record (transit_stops_7_9.meta.json): a feed used for buses has its
    # calendar; a skipped one says why ("schedule ended over a year ago", or "no bus routes" for a rail-only feed, whose calendar is not
    # recorded: taken as current). Amtrak's national feed (11) is current. A station missing from a CURRENT feed of its own operator is
    # not served (the MBTA's Hastings, Mishawum, Plimptonville and Plymouth stations, closed); one missing from a STALE feed may be newer
    # than the copy (SacRT's Dos Rios).
    import datetime
    meta = ld("transit_stops_7_9.meta.json") or {}
    today = datetime.date.today().isoformat()
    fstat = {"11": "current"}
    for f in meta.get("feeds", []):
        cal = f.get("calendar") or [None, None]
        fstat[str(f.get("id"))] = "current" if str(cal[1] or "") >= today else "stale"
    for q in meta.get("skipped", []):
        fid, why = str(q.get("id")), q.get("why") or ""
        if fid not in fstat:
            fstat[fid] = "stale" if "ended" in why else "current"
    ag_stat = {}
    for p in gp:
        if len(p) > 5 and len(_norm(p[5])) >= 4:
            ag_stat.setdefault(_norm(p[5]), set()).add(fstat.get(str(p[3]), "current"))
    current_ag = {a for a, st in ag_stat.items() if "current" in st}
    stale_ag = {a for a, st in ag_stat.items() if "current" not in st}

    def agency_match(t, agencies):
        for k in ("operator", "network"):
            for v in (t.get(k) or "").split(";"):
                v = _norm(v)
                if len(v) >= 4 and any(v in ag or ag in v for ag in agencies):
                    return True
        return False

    byname = {}   # GTFS rail stops by name: a same-named stop 1-15 km away means one of the two positions is wrong (Metrolink's feed puts
    for p in gp:  # "Moreno Valley / March Field" at Riverside-Hunter Park/UCR, 10 km from the station); the OpenStreetMap station counts
        if len(_norm(p[2])) >= 5:
            byname.setdefault(_norm(p[2]), []).append(geo.to_xy(p[0], p[1]))

    def same_name_far(nm, x, y):
        return any(1000.0 < ((x - a) ** 2 + (y - b) ** 2) ** 0.5 <= 15000.0 for a, b in byname.get(_norm(nm), []))

    log = {"gtfs": [], "mode": [], "agency": [], "dropped": [], "added": []}
    keep, pts = [], []
    for t, g, el in rail:
        if not isinstance(g, Point):
            keep.append((t, g, el)); continue
        d = idx.nearest(g.x, g.y)[0] if idx is not None else None
        nm = (t.get("name") or "").strip()
        why = None
        if d is not None and d <= R_CONFIRM:
            why = "gtfs"
        elif nm and same_name_far(nm, *geo.to_xy(g.x, g.y)) and not _airside(t, nm) and not AMUSEMENT_OP.search(
                " ".join(t.get(k) or "" for k in ("operator", "network"))):
            why = "gtfs"; t = dict(t, confirm_by="same-named GTFS stop 1-15 km away")
        elif nm and (t.get("station") in URBAN_RAIL or any(t.get(m) == "yes" for m in URBAN_RAIL)) and (t.get("network") or t.get("operator")) \
                and not AMUSEMENT_OP.search(" ".join(t.get(k) or "" for k in ("operator", "network"))) and not _airside(t, nm) \
                and not agency_match(t, current_ag):
            why = "mode"
        elif nm and agency_match(t, stale_ag) and not agency_match(t, current_ag) and not _airside(t, nm):
            why = "agency"
        if why:
            keep.append((t, g, el)); pts.append(geo.to_xy(g.x, g.y))
        tags = {k: t[k] for k in CONFIRM_TAGS if k in t}
        tags.update({k: True for k in ("from_area", "stop_position") if el.get(k)})
        log[why or "dropped"].append([round(g.x, 6), round(g.y, 6), nm, round(d) if d is not None else None, tags])
    added = []
    for lon, lat, name, fid, ty, *ag in sorted(gp, key=lambda p: (p[4], str(p[3]), p[2], p[0], p[1])):
        if ty in (0, 5, 7, 1400) or 900 <= ty <= 906:
            continue   # tram / light-rail, cable-car and funicular stops only confirm an OSM station: San Francisco's cable-car stops and
            #            Pittsburgh's inclines are street or hillside stops, not rail stations
        if re.search(r"\byard\b", name or "", re.I) and not re.search(r"navy yard", name or "", re.I):
            continue   # a rail yard or yard limit listed as a stop (Metro-North's Highbridge Yard, DART's "EAST TEX YARD LIMIT"): no passengers
        x, y = geo.to_xy(lon, lat)
        if any((x - px) ** 2 + (y - py) ** 2 <= R_SAME * R_SAME for px, py in pts):
            continue
        pts.append((x, y))
        added.append(({"railway": "station", "name": name, "gtfs_feed": f"MobilityData {fid}"}, Point(lon, lat), {"type": "gtfs", "id": fid}))
        log["added"].append([round(lon, 6), round(lat, 6), name, fid, ty, ag[0] if ag else ""])
    try:
        json.dump(log, open(os.path.join(DATA, "rail_confirm.json"), "w"))
    except OSError:
        pass
    return keep + added


def _ilen(g, pm):
    """length of a street inside a block group; a street shape GEOS rejects (e.g. a self-touching OSM area tagged as a road, Bucks County PA)
    is repaired first, and valid shapes are measured exactly as before"""
    try:
        return g.intersection(pm).length
    except Exception:
        import shapely
        try:
            return shapely.make_valid(g).intersection(pm).length
        except Exception:
            return 0.0


WATER_MTFCC = {"H2030", "H2040", "H2041", "H2051", "H2053", "H2060", "H3010", "H3013", "H3020"}   # lakes, reservoirs, bays, ocean, rivers, canals (not swamps or glaciers)


def land_shapes(polys):
    """each block group minus mapped water (Census TIGER area hydrography, tiger_hydro_area.geojson), so acreage, the reference point and the
    buffers that assume homes are spread over the shape use land only (Census land area excludes the same water). A shape that water would
    erase almost entirely keeps its full outline."""
    wa = ld("tiger_hydro_area.geojson")
    if not wa or not wa.get("features"):
        return dict(polys), 0
    from shapely.strtree import STRtree
    wp = [shape(f["geometry"]).buffer(0) for f in wa["features"] if f.get("geometry") and (f.get("properties") or {}).get("MTFCC") in WATER_MTFCC]
    wp = [g for g in wp if not g.is_empty]
    if not wp:
        return dict(polys), 0
    tree = STRtree(wp); out = {}; n_cut = 0
    for gid, g in polys.items():
        hits = [wp[int(i)] for i in tree.query(g) if wp[int(i)].intersects(g)]
        land = g
        if hits:
            try:
                land = g.buffer(0).difference(unary_union(hits))
            except Exception:
                land = g
            if land.is_empty or land.area < 0.05 * g.area or land.area > 0.95 * g.area:
                land = g   # water under 5% of the shape (ponds, creeks) is ignored: those shapes are measured exactly as before
        if land is not g:
            n_cut += 1
        out[gid] = land
    return out, n_cut


def main():
    bg = ld("bg.geojson"); acs = ld("acs_bg.json") or {}; acs_tract = ld("acs_tract.json") or {}
    assert bg, "run fetch_oc.py first (data/bg.geojson missing)"
    feats = [f for f in bg["features"] if f["properties"].get("GEOID")]
    polys = {f["properties"]["GEOID"]: shape(f["geometry"]) for f in feats}
    land, n_land = land_shapes(polys)
    print("land shapes: mapped water (5% or more of the shape) removed from", n_land, "block groups")
    # reference point for distances: the shape's usual point, unless it lies in mapped water (then a point on the land part)
    cent = {}
    for gid, g in polys.items():
        rp = g.representative_point()
        cent[gid] = rp if (land[gid] is g or land[gid].contains(rp)) else land[gid].representative_point()

    # ---- OSM themes ----
    roads = load_osm("roads"); parks = sources_oc.merged_parks(load_osm("parks")); water = load_osm("water"); rail = load_osm("rail"); amen = load_osm("amenities"); places = load_osm("places"); infra = load_osm("infra")
    fwy = [g for t, g, _ in roads if t.get("highway") in ("motorway", "trunk")]
    fwy_idx = geo.GeomIndex(fwy)
    walls = [g for t, g, _ in infra if t.get("barrier") == "wall" or t.get("noise_barrier")]
    wall_union_m = unary_union([geo.proj(g) for g in walls]).buffer(40) if walls else None
    power_idx = geo.GeomIndex([g for t, g, _ in infra if t.get("power") == "line"])
    local = [(g, t.get("highway")) for t, g, _ in roads if t.get("highway") in ("residential", "living_street", "unclassified")]
    all_streets_m = [(geo.proj(g), h) for g, h in local] + [(geo.proj(g), t.get("highway")) for t, g, _ in roads if t.get("highway") in ("primary", "secondary", "tertiary")]
    street_idx = geo.GeomIndex([g for g, h in local] + [g for t, g, _ in roads if t.get("highway") in ("primary", "secondary", "tertiary")])

    cpa = sources_oc.county_park_amenities()

    def pts_of(filter_fn, name_key="name", extra=None):
        out = []
        for t, g, _ in amen:
            if filter_fn(t):
                c = g.centroid if not isinstance(g, Point) else g
                out.append((c.x, c.y, t.get(name_key)))
        return geo.PointIndex(out + list(cpa.get(extra) or []))
    sport = lambda s: (lambda t: s in (t.get("sport") or ""))
    idx = {
        "tennis": pts_of(sport("tennis"), extra="tennis"), "pickle": pts_of(sport("pickleball")), "bask": pts_of(sport("basketball"), extra="bask"),
        "field": pts_of(lambda t: t.get("leisure") == "pitch" and any(s in (t.get("sport") or "") for s in ("soccer", "baseball", "football", "softball")), extra="field"),
        "playground": pts_of(lambda t: t.get("leisure") == "playground", extra="playground"), "dog": pts_of(lambda t: t.get("leisure") == "dog_park"),
        "pool": pts_of(lambda t: t.get("leisure") == "swimming_pool" and t.get("access") not in ("private",) and t.get("swimming_pool") != "private"),
        "library": pts_of(lambda t: t.get("amenity") == "library"), "center": pts_of(lambda t: t.get("amenity") in ("community_centre", "social_facility")),
        "clinic": pts_of(lambda t: t.get("amenity") in ("clinic", "doctors")), "hospital": pts_of(lambda t: t.get("amenity") == "hospital"),
        "school": pts_of(lambda t: t.get("amenity") in ("school",)), "fire": pts_of(lambda t: t.get("amenity") == "fire_station"), "police": pts_of(lambda t: t.get("amenity") == "police"),
        "post": pts_of(lambda t: t.get("amenity") == "post_office"), "cityhall": pts_of(lambda t: t.get("amenity") == "townhall"),
        "grocery": pts_of(lambda t: t.get("shop") in ("supermarket", "greengrocer", "grocery")), "dining": pts_of(lambda t: t.get("amenity") in ("restaurant", "cafe")),
        "market": pts_of(lambda t: t.get("amenity") == "marketplace"), "ev": pts_of(lambda t: t.get("amenity") == "charging_station"),
        "toilets": pts_of(lambda t: t.get("amenity") == "toilets", extra="toilets"), "garden": pts_of(lambda t: t.get("landuse") == "allotments" or t.get("garden:type") == "community"),
    }
    # CDE schools (more complete than OSM)
    cde_pts = []
    p = os.path.join(DATA, "cde_schools.txt")
    if os.path.exists(p):
        with open(p, encoding="utf-8", errors="replace") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                try:
                    if r.get("County") == region.SHORT and r.get("StatusType") == "Active" and r.get("Latitude") not in (None, "", "No Data"):
                        cde_pts.append((float(r["Longitude"]), float(r["Latitude"]), r.get("School") or r.get("District")))
                except Exception:
                    pass
    if not cde_pts and ld("nces_schools.geojson"):   # outside California: NCES EDGE public school locations
        cde_pts = [(f["properties"]["LON"], f["properties"]["LAT"], f["properties"].get("NAME")) for f in ld("nces_schools.geojson")["features"]
                   if f["properties"].get("LAT") is not None]
    if cde_pts:
        idx["school"] = geo.PointIndex(cde_pts)
    # AFDC DC fast chargers if present
    afdc = ld("afdc_dcfc.json")
    if afdc and afdc.get("fuel_stations"):
        idx["ev"] = geo.PointIndex([(s["longitude"], s["latitude"], s.get("station_name")) for s in afdc["fuel_stations"] if s.get("ev_dc_fast_num")])
    # parks: polygons with acreage, kinds
    park_polys = []
    for t, g, _ in parks:
        if g.geom_type not in ("Polygon", "MultiPolygon"):
            continue
        k = "community garden" if (t.get("landuse") == "allotments") else "dog park" if t.get("leisure") == "dog_park" else "playground" if t.get("leisure") == "playground" else "beach" if t.get("natural") == "beach" else "open space" if (t.get("leisure") == "nature_reserve" or t.get("boundary") == "protected_area" or t.get("natural") in ("wood", "scrub", "heath")) else "park" if t.get("leisure") in ("park", "garden", "recreation_ground") or t.get("landuse") == "recreation_ground" else None
        if k and t.get("access") != "private":
            park_polys.append((g, k, t.get("name"), geo.acres(g)))
    park_idx = geo.GeomIndex([g for g, *_ in park_polys if _[0] in ("park", "playground", "beach", "open space")])
    park_m = [(geo.proj(g), k, n, a) for g, k, n, a in park_polys]
    # rail stations
    stations = [(g.x, g.y, t.get("name")) for t, g, _ in rail if isinstance(g, Point)]
    st_idx = geo.PointIndex(stations)
    # bus frequency (OCTA)
    stops = ld("octa_stops_7_9.json") or ld("transit_stops_7_9.json") or []   # Orange County: OCTA feed; elsewhere: MobilityData feeds
    stop_idx = geo.PointIndex([(s[0], s[1], s[2]) for s in stops])
    # coverage guard for the MobilityData feeds: OpenStreetMap bus stops show where buses run; if a block group has 3+ OSM bus stops
    # within 400 m but the feeds have under 30% as many stops there, an operator is missing from the feeds and bt is unknown, not 0
    mdb = not ld("octa_stops_7_9.json") and bool(stops)
    osm_bus = (ld("osm_bus_stops.json") or {}).get("elements", []) if mdb else []
    osm_bus_idx = geo.PointIndex([(e["lon"], e["lat"], 1) for e in osm_bus]) if osm_bus else None
    gap_stops = (ld("transit_gap_stops.json") or []) if mdb else []   # stops of operators whose schedule is stale or has no mirror
    gap_idx = geo.PointIndex([(g_[0], g_[1], 1) for g_ in gap_stops]) if gap_stops else None
    bt_unknown = 0
    # fire zones
    fire_polys = []
    for name in ("fire_sra.geojson", "fire_lra.geojson"):
        fc = ld(name)
        if fc:
            for f in fc["features"]:
                pr = f.get("properties", {}); hz = str(pr.get("FHSZ_Description") or pr.get("FHSZ") or pr.get("HAZ_CLASS") or "")
                if "very high" in hz.lower() or hz.strip() == "3":
                    try:
                        fire_polys.append(geo.proj(shape(f["geometry"])))
                    except Exception:
                        pass
    fire_union = unary_union(fire_polys) if fire_polys else None
    # cities
    city_polys = [(g, nm) for g, nm, inc in sources_oc.city_polys()]
    city_tree = geo.GeomIndex([g for g, nm in city_polys])
    # places (neighborhood labels)
    place_pts = [(g.x, g.y, t.get("name")) for t, g, _ in places if t.get("name") and t.get("place") in ("neighbourhood", "suburb", "quarter")]
    place_idx = geo.PointIndex(place_pts)
    # Tree Equity Score. Default: 2021 release, area-weighted onto 2020 block groups (what the shipped build used).
    # Round 3: TES_RELEASE=latest reads the current California file (2020 block groups, no reweighting needed); off by default
    # because its release date is unpublished and switching changes ht/tg for every block group.
    tes_release = os.environ.get("TES_RELEASE", "2021")
    tes = tes_latest(polys) if tes_release == "latest" else sources_oc.tes_by_bg(polys)
    # Round 3: city street-tree inventories -> open planting sites (ts) and inventoried trees (st), only where a city survey exists
    tree_cov = tree_survey(polys)
    # Round 4: County / city share of the 1% levy increment (Auditor Section 99 factors by TRA), area-weighted per block group
    tra_cov = tra_shares(polys)
    # crime (CA DOJ Crimes & Clearances, agency-year rows) -> city rates per 1,000 residents, latest year
    crime = {}
    dojp = os.path.join(DATA, "doj", "Crimes_and_Clearances_with_Arson-1985-2025.csv")
    if os.path.exists(dojp):
        pop = ld("acs_place.json") or {}
        rows = [r for r in csv.DictReader(open(dojp, encoding="utf-8", errors="replace")) if r.get("County") == region.NAME and r.get("Year", "").isdigit()]
        yr = max(int(r["Year"]) for r in rows)
        # unincorporated population = ACS block-group population of the block groups whose centroid is outside every city
        uninc_pop = sum((acs.get(g) or {}).get("pop") or 0 for g, c in cent.items() if not any(city_polys[int(i)][0].contains(c) and city_polys[int(i)][1] != region.UNINC for i in city_tree.query(geo.proj(c))))
        for r in rows:
            if r["Year"] != str(yr):
                continue
            ag = r.get("NCICCode") or ""
            if ag.strip() in DOJ_SHARED:   # one police authority for several cities: the same authority-level rate for each
                cities = DOJ_SHARED[ag.strip()]; p_ = sum(pop.get(c) or 0 for c in cities)
                for c in cities:
                    if p_ and pop.get(c):
                        crime[c] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000,
                                    "ag": f"{ag} (shared rate for {', '.join(cities)})", "yr": yr}
                continue
            city = region.UNINC if ag.startswith(region.OV.get("sheriff") or (region.SHORT + " Co. Sheriff")) else DOJ_ALIAS.get(ag.strip(), ag.strip())
            p_ = uninc_pop if city == region.UNINC else pop.get(city)
            if p_:
                crime[city] = {"vc": float(r.get("Violent_sum") or 0) / p_ * 1000, "pcr": float(r.get("Property_sum") or 0) / p_ * 1000, "ag": ag, "yr": yr}
        print("DOJ crime", yr, "agencies matched", len(crime), "unincorporated pop", round(uninc_pop))
    # crashes (CCRS 2023-2025, CHP via data.ca.gov) -> per BG counts
    crash_pts, crash_years, crash_all, crash_coord = sources_oc.crash_points()
    crash_idx = geo.PointIndex(crash_pts) if crash_pts else None

    rents = [v["rent"] for k, v in acs.items() if not k.startswith("_") and v.get("rent")] if acs else []
    med_rent = statistics.median(rents) if rents else (None if acs else 2102)   # None: no block-group rent published (e.g. Alpine County)
    out = {}
    for gid, poly in polys.items():
        a = acs.get(gid) or {}
        c = cent[gid]; lon, lat = c.x, c.y
        pm = geo.proj(land[gid]); ac = pm.area / 4046.856
        if not pm.is_valid:   # a few TIGER shapes self-touch after projection (Bucks County PA): repair only those; valid shapes are untouched
            import shapely, shapely.ops
            pm = shapely.make_valid(pm)
            if pm.geom_type == "GeometryCollection":
                pm = shapely.ops.unary_union([g for g in pm.geoms if g.geom_type in ("Polygon", "MultiPolygon")])
        units = a.get("units") or 0; occ = a.get("occ") or 0; owner = a.get("owner") or 0
        sf = (((a.get("sf_det") or 0) + (a.get("sf_att") or 0)) / a["units_all"] * 100) if a.get("units_all") else None
        hv = a.get("hv"); tract = (acs_tract or {}).get(gid[:11]) or {}
        hvs = "Census ACS 2020-24 median value for this block group (Census values stop at $2M)" if hv else "no Census value"
        if not hv and tract.get("hv") and units:
            hv = tract["hv"]; hvs = "Census ACS 2020-24 median value for the surrounding Census tract (no block-group value published)"
        if hv and hv >= 2000001:
            hv = 2000001
        rent = a.get("rent"); rent_s = None
        if not rent and tract.get("rent") and units:
            rent = tract["rent"]; rent_s = "tract median"
        city = next((city_polys[int(i)][1] for i in city_tree.query(geo.proj(c)) if city_polys[int(i)][0].contains(c)), None) or region.UNINC
        d_place, pname = place_idx.nearest(lon, lat)
        n = pname if (pname and d_place is not None and d_place <= 2500) else city
        ns = "nearest neighborhood label (OpenStreetMap)" if n != city else "City boundary (no neighborhood map)"
        # parks within 1/2 mile and nearest
        pc0 = geo.proj(poly).centroid   # the usual centre for the 400 m / half-mile buffers, unless it lies in mapped water
        pc = pc0 if (land[gid] is poly or pm.contains(pc0)) else pm.representative_point()
        half = pc.buffer(804.7)
        pa = sum(min(g.intersection(half).area, g.area) for g, k, nm, acr in park_m if k in ("park", "playground", "beach", "open space") and g.intersects(half)) / 4046.856
        pn = park_idx.nearest_dist(lon, lat)
        bt_hits = stop_idx.tree.query(pc.buffer(400)) if stop_idx.tree else []
        bt = max([stop_idx.pts[int(i)][2] for i in bt_hits if stop_idx.geoms[int(i)].distance(pc) <= 400] or [0]) if stops else None   # None: no feed for this county
        if bt is not None and mdb:
            n_gtfs = sum(1 for i in bt_hits if stop_idx.geoms[int(i)].distance(pc) <= 400)
            n_osm = sum(1 for i in osm_bus_idx.tree.query(pc.buffer(400)) if osm_bus_idx.geoms[int(i)].distance(pc) <= 400) if osm_bus_idx is not None and osm_bus_idx.tree is not None else 0
            n_gap = sum(1 for i in gap_idx.tree.query(pc.buffer(400)) if gap_idx.geoms[int(i)].distance(pc) <= 400) if gap_idx is not None and gap_idx.tree is not None else 0
            if (n_osm >= 3 and n_gtfs < 0.3 * n_osm) or (n_gap >= 1 and n_gtfs == 0):
                bt = None; bt_unknown += 1
        rm_d, _ = st_idx.nearest(lon, lat)
        fw = fwy_idx.nearest_dist(lon, lat)
        gro_d, _ = idx["grocery"].nearest(lon, lat); din = idx["dining"].count_within(lon, lat, 400)
        ten_d, _ = idx["tennis"].nearest(lon, lat); dog_d, _ = idx["dog"].nearest(lon, lat); pool_d, _ = idx["pool"].nearest(lon, lat); ev_d, _ = idx["ev"].nearest(lon, lat)
        fc = {}
        for key, name in [("school", "school"), ("library", "library"), ("cityhall", "city hall"), ("fire", "fire station"), ("police", "police"), ("post", "post office"), ("hospital", "hospital"), ("clinic", "clinic"), ("center", "community center")]:
            dd, _ = idx[key].nearest(lon, lat)
            if dd is not None:
                fc[name] = round(dd, 1)
        fire = (fire_union.intersection(pm).area / pm.area) if (fire_union is not None and fire_union.intersects(pm)) else 0.0
        # freeway without wall within 150 m; homes within 100 m of a freeway
        fwy_unwalled = 0.0; homes_100 = 0.0
        if fw is not None and fw <= 500:
            band = pm.buffer(150)
            for i in fwy_idx.query(band):
                seg = fwy_idx.geoms[i].intersection(band)
                if seg.is_empty:
                    continue
                if wall_union_m is not None:
                    seg = seg.difference(wall_union_m)
                fwy_unwalled += seg.length
            near = unary_union([fwy_idx.geoms[i] for i in fwy_idx.query(pm.buffer(100))]) if fwy_idx.query(pm.buffer(100)) else None
            if near is not None:
                homes_100 = units * (pm.intersection(near.buffer(100)).area / pm.area)
        street_km = sum(_ilen(g, pm) for g, h in all_streets_m if g.intersects(pm)) / 1000
        local_km = sum(_ilen(g, pm) for g, h in all_streets_m if h in ("residential", "living_street", "unclassified") and g.intersects(pm)) / 1000
        tr = tes.get(gid) or {}
        def num(*keys):
            for k in keys:
                v = tr.get(k)
                try:
                    if v not in (None, ""):
                        return float(v)
                except Exception:
                    pass
            return None
        ht = num("temp_diff", "heat_disparity", "ht", "temp_diff_f"); tg = num("tc_gap", "canopy_gap", "tg", "tree_canopy_gap")
        if tg is not None and tg <= 1:
            tg *= 100
        cr = crime.get(city)
        pb = ksi = None
        if crash_idx and crash_idx.tree:
            hits = crash_idx.tree.query(pm)
            pts = [crash_idx.pts[int(i)][2] for i in hits if crash_idx.geoms[int(i)].within(pm)]
            pb = sum(1 for p in pts if p["pb"]); ksi = sum(1 for p in pts if p["ksi"])
        m = {"c": city, "n": n, "county": region.NAME, "acres": round(ac, 1), "ns": ns, "csa": f"{city} - {n}",
             "hv": hv, "hvs": hvs,
             "homes": units, "own": round(owner / occ * 100) if occ else None, "pop": a.get("pop"), "inc": a.get("inc"), "rent": rent,
             "yb": a.get("yb"), "sf": round(sf) if sf is not None else None, "nocar": round((a.get("nocar") or 0) / a["hh"] * 100) if a.get("hh") else None,
             "ht": ht, "tg": tg, "vc": round(cr["vc"], 1) if cr else None, "pcr": round(cr["pcr"], 1) if cr else None, "ag": (f"{cr['ag']} (city-level rate, CA DOJ Crimes & Clearances {cr['yr']})") if cr else None,
             "pa": round(pa, 1), "pn": round(pn) if pn is not None else None, "bt": bt, "rm": round(rm_d) if rm_d is not None else None,
             "fw": round(fw) if fw is not None else None, "gro": round(gro_d) if gro_d is not None else None, "din": din,
             "ten": round(ten_d) if ten_d is not None else None, "dog": round(dog_d) if dog_d is not None else None, "pool": round(pool_d) if pool_d is not None else None, "ev": round(ev_d) if ev_d is not None else None,
             "fire": round(fire, 2) if region.STATE == "CA" else None, "ksi": ksi, "pbcr": pb, "fc": fc, "tr": [rm_d, rm_d, bt, bt] if rm_d is not None else None, "sb": None,
             "x": {k: v for k, v in {"school_m": fc.get("school"), "library_m": fc.get("library"), "clinic_m": fc.get("clinic"), "center_m": fc.get("community center"),
                     "pubbldg_m": min([v for v in [fc.get("library"), fc.get("community center")] if v is not None] or [None]) if (fc.get("library") or fc.get("community center")) else None,
                     "garden_m": idx["garden"].nearest(lon, lat)[0], "restroom_m": idx["toilets"].nearest(lon, lat)[0], "pickle_m": idx["pickle"].nearest(lon, lat)[0], "bask_m": idx["bask"].nearest(lon, lat)[0],
                     "playground_m": idx["playground"].nearest(lon, lat)[0], "field_m": idx["field"].nearest(lon, lat)[0], "power_m": power_idx.nearest_dist(lon, lat), "market_m": idx["market"].nearest(lon, lat)[0],
                     "crash_years": crash_years if crash_idx else None, "street_km": round(street_km, 2), "local_km": round(local_km, 2), "fwy_unwalled_m": round(fwy_unwalled), "homes_100m_fwy": round(homes_100), "other_vacant": a.get("other_vacant"), "kids": a.get("kids")}.items() if v is not None}}
        if tra_cov["by_bg"].get(gid):
            t = dict(tra_cov["by_bg"][gid]); cities = t.pop("_cities")
            if city != region.UNINC and not city.endswith("(unincorporated)"):
                t["city"] = round(cities.get(city.upper() + " CITY", 0.0), 5)
            m["tra"] = t
        ts_row = tree_cov["by_bg"].get(gid)
        if ts_row:
            m["ts"], m["st"] = ts_row["ts"], ts_row["st"]
        out[gid] = m
    coverage = {
        "street_trees": {k: v for k, v in tree_cov.items() if k != "by_bg"},
        "requests_311": ({"keys": ["graf", "dump", "e"], "cities": [], "block_groups": 0,
                         "note": "No " + region.NAME + " city publishes an open 311 export of dumping, graffiti, litter or encampment requests (checked 5 Nov 2026). Keys left absent everywhere.",
                         "checked": {"Santa Ana": "Homeless_Services ArcGIS layer: unlisted dashboard export, licence 'For use by CDA', contains reporter names/emails; Jan-Mar 2026 only; not used",
                                     "Irvine": "Code_Enforcement_Cases: code cases, no graffiti/dumping/litter/encampment topics; not 311",
                                     "Anaheim, Huntington Beach, Garden Grove, Costa Mesa, OC Public Works": "no public request export found"}}
                         if region.FIPS == "06059" else
                         {"keys": ["graf", "dump", "e"], "cities": [], "block_groups": 0,
                          "note": "City 311 requests are not connected for " + region.NAME + " yet; keys left absent everywhere (not a finding that none exist)."}),
        "tax_rate_areas": {k: v for k, v in tra_cov.items() if k != "by_bg"},
        "tree_equity": {"release": tes_release, "block_groups_with_values": len(tes), "heat_baseline": "urbanized-area mean over this county's block groups (centred like LA's values)",
                        "source": f"https://tes-app-data-share.s3.amazonaws.com/{region.STATE.lower()}/{region.STATE.lower()}_csv.zip (release date unpublished)" if tes_release == "latest" else f"https://national-tes-data-share.s3.amazonaws.com/national_tes_share/{region.STATE.lower()}.zip.zip (2021 release, 2010 block groups area-weighted)"},
        "transit": json.load(open(os.path.join(DATA, "octa_stops_7_9.meta.json"))) if os.path.exists(os.path.join(DATA, "octa_stops_7_9.meta.json")) else
                   json.load(open(os.path.join(DATA, "transit_stops_7_9.meta.json"))) if os.path.exists(os.path.join(DATA, "transit_stops_7_9.meta.json")) else ({"url": "https://www.octa.net/current/google_transit.zip"} if region.FIPS == "06059" else {"url": None, "note": "no GTFS feed connected for this county yet"}),
    }
    if isinstance(coverage.get("transit"), dict) and mdb:   # always recorded when the MobilityData feeds are used (zero counts included)
        coverage["transit"]["bt_unknown"] = bt_unknown; coverage["transit"]["osm_bus_stops"] = len(osm_bus); coverage["transit"]["gap_stops_used"] = len(gap_stops)
    if region.STATE == "CA" and not region.OV.get("crashes"):
        coverage["crash_pedbike"] = {"rule": "CCRS: the first object struck was a pedestrian or bicycle, or an injured or killed person was a pedestrian or cyclist (injured-persons table)",
                                     "years_with_injured_person_lists": sorted(int(y) for y in crash_years if os.path.exists(os.path.join(DATA, f"ccrs_pedbike_{y}.json")))}
    coverage["land_shapes"] = {"block_groups_clipped": n_land, "rule": "Census TIGER area hydrography (lakes, reservoirs, bays, ocean, rivers, canals) removed where it is 5% or more of a block group's shape; reference points moved off water only where they lay in it"}
    json.dump({"metrics": out, "vintage": acs.get("_vintage"), "rent_med": med_rent, "crash": {"years": crash_years, "rows": crash_all, "with_coords": crash_coord}, "coverage": coverage}, open(os.path.join(DATA, "metrics.json"), "w"))
    print("coverage:", json.dumps({k: (v if k != "requests_311" else v["cities"]) for k, v in coverage.items()})[:600])
    print("metrics for", len(out), "block groups", f"(bus frequency unknown in {bt_unknown}: GTFS feeds miss the OSM bus stops there)" if osm_bus else "")


# ---------------- Round 3 helpers ----------------
def _street(p):
    return (p.get("DEPARTMENT") or "").strip() != "Parks" and (p.get("PARKWAYTYP") or "").strip() != "Parkland"


TREE_SURVEYS = {
    # city name as in oc_cities.geojson -> (raw file, vacant-site test, living-tree test, vintage note)
    "Anaheim": ("trees_anaheim.geojson",
                # Round 4: street sites only. 1,265 of the 23,985 vacant records are DEPARTMENT 'Parks' and 5 are PARKWAYTYP
                # 'Parkland' (counts checked 6 Nov 2026); LA's survey counts street (parkway) sites, so park records are left out.
                lambda p: "VACANT" in (p.get("COMMONNAME") or "").upper() and _street(p),
                lambda p: _street(p) and not any(w in (p.get("COMMONNAME") or "").upper() for w in ("VACANT", "STUMP")),
                "Anaheim street-tree inventory (gis.anaheim.net AnaheimTrees layer 0); Parks-department and Parkland records excluded; no dataset-wide update date published"),
}
SURVEY_MIN_SHARE = 0.95   # a block group counts as covered only if >=95% of its area lies inside the surveying city


def tree_survey(polys):
    """Open planting sites (ts) and inventoried living trees (st) per block group, from city inventories that record vacant
    sites. Block groups not (almost) wholly inside a surveying city get nothing, so the engine keeps its LA fallback there."""
    from shapely.strtree import STRtree
    if region.OV.get("trees") != "anaheim":   # no city planting-site survey connected for this county yet
        return {"cities": [], "block_groups": 0, "by_bg": {}, "note": "No city street-tree planting-site survey connected for " + region.NAME + " yet; open sites are estimated from street length and canopy gap (LA rule)."}
    cov = {"cities": [], "block_groups": 0, "by_bg": {}, "rule": f"block group >= {SURVEY_MIN_SHARE:.0%} inside the city; street records only (Anaheim: DEPARTMENT not Parks, PARKWAYTYP not Parkland); ts = records marked vacant site; st = records that are neither vacant nor stump"}
    parts = collections.defaultdict(list)
    for g, nm, inc in sources_oc.city_polys():
        parts[nm].append(g.buffer(0))
    cities = {nm: unary_union(gs) for nm, gs in parts.items()}
    for city, (fname, is_vacant, is_tree, note) in TREE_SURVEYS.items():
        fc = ld(fname)
        if not fc or city not in cities:
            print("tree survey missing:", city, fname); continue
        cpoly = cities[city]
        pts, flags = [], []
        for f in fc["features"]:
            gm = f.get("geometry") or {}
            if gm.get("type") != "Point":
                continue
            pts.append(Point(gm["coordinates"][0], gm["coordinates"][1])); flags.append((is_vacant(f["properties"]), is_tree(f["properties"])))
        tree = STRtree(pts)
        n_bg = 0
        for gid, poly in polys.items():
            if not poly.intersects(cpoly):
                continue
            share = poly.intersection(cpoly).area / poly.area if poly.area else 0
            if share < SURVEY_MIN_SHARE:
                continue
            idx = [int(i) for i in tree.query(poly) if poly.covers(pts[int(i)])]
            cov["by_bg"][gid] = {"ts": sum(1 for i in idx if flags[i][0]), "st": sum(1 for i in idx if flags[i][1]), "city": city}
            n_bg += 1
        cov["cities"].append({"city": city, "file": fname, "records": len(pts), "vacant_sites": sum(1 for v, t in flags if v), "living_trees": sum(1 for v, t in flags if t),
                              "block_groups": n_bg, "source": fc.get("source"), "downloaded": fc.get("downloaded"), "note": note})
        cov["block_groups"] += n_bg
        print("tree survey", city, "records", len(pts), "block groups covered", n_bg)
    cov["not_used"] = {"Irvine": "City Trees layer has 82 vacant records in 65,692 (not a planting-site survey); raw file kept for audit",
                       "Costa Mesa": "contractor-hosted i-Tree benefits table, no vacant sites; raw file kept for audit"}
    return cov


# CA DOJ agency names that differ from the Census place names (checked 7 Nov 2026 against the 2025 rows; two are misspelt in the DOJ file)
DOJ_ALIAS = {"Ventura": "San Buenaventura (Ventura)", "Big Bear": "Big Bear Lake", "Angels Camp": "Angels", "Carmel": "Carmel-by-the-Sea",
             "Paso Robles": "El Paso de Robles (Paso Robles)", "Buelton": "Buellton", "Suisun": "Suisun City", "La Canada-Flintridge": "La Cañada Flintridge"}
# police authorities serving several cities (Central Marin Police Authority: JPA of Larkspur, Corte Madera and San Anselmo since 2013,
# also part of unincorporated Greenbrae, which is left out here)
DOJ_SHARED = {"Central Marin": ["Larkspur", "Corte Madera", "San Anselmo"]}


def tes_latest(polys):
    """Current Tree Equity Score California CSV (2020 block groups): temp_diff (heat disparity), tc_gap (0-1 -> percent)."""
    import zipfile, io
    st = region.STATE.lower(); p = os.path.join(DATA, f"tes_{st}_latest_csv.zip")
    if not os.path.exists(p):
        return {}
    out = {}
    with zipfile.ZipFile(p) as z:
        for r in csv.DictReader(io.TextIOWrapper(z.open(f"{st}_tes.csv"), encoding="utf-8-sig")):
            g = r["GEOID"].zfill(12)
            if g in polys:
                f = lambda k: float(r[k]) if r.get(k) not in (None, "") else None
                out[g] = {"temp_diff": f("temp_diff"), "tc_gap": round(f("tc_gap") * 100, 1) if f("tc_gap") is not None else None, "tes": f("tes")}
    print("TES latest: block groups with values", len(out))
    return out


# schools, community colleges, County Office of Education and ERAF (cannot join an EIFD); 37 fund names in the FY 2026-27 report
SCHOOL_FUND = __import__("re").compile(r"EDUCATIONAL REVENUE|UNIF|ELEM|HIGH|SCH|COMM COLL|COLLEGE|EDUCATION|SCHOOL|CCD")


def tra_shares(polys):
    """m["tra"] = {"cg": County General Fund factor, "city": the city's general-fund factor (fund named '<CITY> CITY'), "tra": largest TRA,
    "cov": share of the block group covered by TRA polygons that have factors}. Factors are each fund's share of the 1% levy increment."""
    from shapely.strtree import STRtree
    g = ld("tra_oc_2026.geojson"); f = ld("tra_factors_2026_27.json")
    out = {"by_bg": {}}
    if not g or not f:
        out["note"] = "tra_oc_2026.geojson / tra_factors_2026_27.json missing; run fetch_oc.py tra"; return out
    fac = f["tras"]
    polys_t, ids = [], []
    for ft in g["features"]:
        try:
            pg = shape(ft["geometry"]).buffer(0)
        except Exception:
            continue
        polys_t.append(pg); ids.append(ft["properties"]["TRA"])
    tree = STRtree(polys_t)
    for gid, poly in polys.items():
        wa = cg_s = sch_s = 0.0; best = (0, None); city_s = collections.Counter()
        for i in tree.query(poly):
            i = int(i); tid = ids[i]
            if tid not in fac:
                continue
            a = polys_t[i].intersection(poly).area
            if a <= 0:
                continue
            rows = fac.get(tid) or []
            wa += a; cg_s += a * sum(v for n, v in rows if n.startswith("ORANGE CO GEN."))
            sch_s += a * sum(v for n, v in rows if SCHOOL_FUND.search(n))
            for n, v in rows:
                if n.endswith(" CITY"):
                    city_s[n] += a * v
            if a > best[0]: best = (a, tid)
        if wa:
            out["by_bg"][gid] = {"cg": round(cg_s / wa, 5), "sch": round(sch_s / wa, 5), "tra": best[1], "cov": round(wa / poly.area, 3),
                                 "_cities": {n: v / wa for n, v in city_s.items()}}
    n_poly_ids = len(set(ids)); n_match = len(set(ids) & set(fac))
    out.update({"block_groups": len(out["by_bg"]), "tra_polygons": len(ids), "tra_ids_with_factors": n_match, "factor_tras": len(fac),
                "polygons_source": g.get("source"), "factors_source": f.get("source"), "report": f.get("report"),
                "rule": "area-weighted over TRA polygons; cg = County General (funds named 'ORANGE CO GEN.*'); sch = schools, colleges, County Office of Education and ERAF (37 fund names); city = the block group's own city's general fund (fund named '<CITY> CITY'; city lighting/sewer sub-funds and any neighbouring city's share count as other); no city key in unincorporated block groups; other = 1 - city - cg - sch",
                "note": f"{len(fac) - n_match} report TRAs have no polygon in the BOE layer"})
    print("TRA shares: block groups", out["block_groups"], "polygon ids matched", n_match, "of", n_poly_ids)
    return out


if __name__ == "__main__":
    main()
