"""build_oc sources table, round 8.6 (from the review of the round-8.6 bundles, each point checked against the code): statuses that say what
was really loaded (no counted feed, no Tree Equity value, no AFDC station: not 'Loaded'), counts said to be 'in and around' the county where
they are for the box around it, the EIFD fallbacks named correctly, the street-tree estimate described as coded, the NCES school year, Puerto
Rico's places, rows for crime and crash data that are not connected, dates written out. Text only.   usage: build86_sources.py <build_oc.py>"""
import sys, re
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, old[:90])
    s = s.replace(old, new)


# helpers: dates written out
rep('''def _count(n, noun):''', '''MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _d(s, wd=False):
    """'2026-11-18' or '20261118' -> '18 Nov 2026' ('Wed 18 Nov 2026' with wd); anything else as it is"""
    g = re.sub(r"\\D", "", str(s or ""))
    try:
        t = datetime.date(int(g[:4]), int(g[4:6]), int(g[6:8])) if len(g) == 8 else None
    except ValueError:
        t = None
    return ((t.strftime("%a ") if wd else "") + f"{t.day} {MON[t.month - 1]} {t.year}") if t else str(s or "")


def _count(n, noun):''')

# feed labels: the weekday measured, written out
rep('''            + f", {f['weekday']}" + (f"; the newest copy that could be read ends on {f['schedule_ended']}" if f.get("schedule_ended") else "") + ")")''',
    '''            + f", {_d(f['weekday'], True)}" + (f"; the newest copy that could be read ends on {_d(f['schedule_ended'])}" if f.get("schedule_ended") else "") + ")")''')

# routes counted from other feeds: MobilityData ids, as in the rest of the row
rep('''    pre = "its routes are counted from other feeds: "
    if why.startswith(pre) and len(why) > len(pre) + 240:''', '''    pre = "its routes are counted from other feeds: "
    if why.startswith(pre):
        why = why.replace(" counted from feed ", " counted from MobilityData ").replace(" current one in feed ", " current one in MobilityData ")
    if why.startswith(pre) and len(why) > len(pre) + 240:''')

# the rows
i = s.index("    rows = [\n", s.index("def sources_table(M):"))
j = s.index("    return [r for r in rows if r]", i)
NEW = r'''    NM = region.NAME; STN = STATE_NAMES.get(region.STATE, region.STATE); PR = region.STATE == "PR"

    def _jl(n):
        try:
            return json.load(open(os.path.join(DATA, n)))
        except Exception:
            return None
    osm = region.OSM; host = (osm.get("url") or "").split("/")[2] if "//" in (osm.get("url") or "") else "download.openstreetmap.fr"
    osm_desc = (f'{osm["url"].rsplit("/", 1)[1]} from {host}, cut to {STN} with osmium, then to the box around {NM}' if osm.get("split") else
                f"{region.OSM_FILE} from {host}" + (f", clipped to the box around {NM}" if osm.get("clip") else ""))
    afdc = _jl("afdc_dcfc.json") if ex("afdc_dcfc.json") else None
    n_af = len((afdc or {}).get("fuel_stations") or [])
    sy = sorted({str((f.get("properties") or f.get("attributes") or {}).get("SCHOOLYEAR") or "") for f in ((_jl("nces_schools.geojson") or {}).get("features") or [])} - {""})
    syt = ", ".join(f"{y[:4]}-{y[-2:]}" if re.fullmatch(r"\d{4}-\d{4}", y) else y for y in sy)
    n_te, n_bg = te.get("block_groups_with_values"), len(M["metrics"])
    heat = "heat (block-group temperature vs the average of this county's block groups in the same urbanized area) and tree-canopy gap; 2010 block groups area-weighted onto 2020 ones"
    te_note = ("kept because the Los Angeles County block groups in the comparison pool use it; "
               + ("American Forests' current California file (08/01/2023 dataset, downloads updated 6 Dec 2024 and 2 Jun 2025)" if CA else f"American Forests' current {STN} file")
               + " was downloaded but is not used")
    feeds = tr.get("feeds") or []; cu = tr.get("county_unserved") or {}
    unk = (lambda n: "its one block group" if n == 1 else f"all {n:,} block groups")
    if not feeds:
        tr_status, tr_ok = f"Not loaded: no feed that is read has a stop with 7-9 am departures in or near {NM}, so bus frequency is unknown in every block group", False
    elif cu.get("unknown"):
        tr_status, tr_ok = (f"Read ({_count(len(feeds), 'feed')}, {_count(tr.get('stops', 0), 'stop')} around {NM}), but none has a stop with 7-9 am departures inside {NM}, "
                            f"where OpenStreetMap maps {cu['osm_bus_stops_in_county']:,} bus stops: bus frequency left unknown in {unk(tr.get('bt_unknown') or n_bg)}"), False
    else:
        tr_status, tr_ok = (f"Loaded ({_count(len(feeds), 'feed')}, {_count(tr.get('stops', 0), 'stop')} in and around {NM}" + _ended_note(tr)
                            + ((f"; bus frequency left unknown in {_count(tr['bt_unknown'], 'block group')}" + (" where no feed that is read has a stop within 400 m, or" if PR else "")
                                + " where OpenStreetMap or an out-of-date schedule shows bus stops that the feeds read do not have") if tr.get("bt_unknown") else "") + ")"), True
    built = _d(tr.get("downloaded")) or "the build"
    not_inc = lambda x: _why_text(x["why"]).replace("within three weeks of today", f"within three weeks of the build date ({built})")
    rows = [
        ["TIGERweb Tracts_Blocks", f"Census 2020 block-group boundaries ({len(M['metrics']):,} in {NM})", "Loaded", True],
        ["ACS 2020-2024 5-year", "population, homes, tenure, home value (B25077), rent (B25064), income, year built, vehicles (B25044), children (B01001); the Census tract's median home value and rent where the block group's is suppressed", "Loaded (www2.census.gov table files)", True],
        ["OpenStreetMap " + osm_state, "streets, parks, water, rail, stations, amenities, facilities, neighborhood names, noise walls, power lines (" + osm_desc + ")", "Loaded", True],
        ["OC Parks Park_Boundaries", "county parks, beaches and wilderness with amenity flags (restrooms, playgrounds, courts, fields)", "Loaded (123 parks)", True] if ex("oc_county_parks.geojson") else None,
        ["Esri USA Parks", f"parks not yet drawn in OpenStreetMap: local, regional and county parks, and state and national parks or forests as open space ({PA.get('usa', 0):,} added)", "Loaded", True] if ex("usa_parks.geojson") else None,
        ["OCGIS City_Boundaries_Public", "city limits and unincorporated communities", "Loaded", True] if ex("oc_cities.geojson") else
        (["Census TIGERweb places", "zonas urbanas and comunidades (census-designated places; Puerto Rico has no incorporated places); the rest of the municipio is shown under the municipio's name", "Loaded", True] if PR else
         ["Census TIGERweb places", "city limits (incorporated places) and named unincorporated communities (census-designated places)", "Loaded", True]),
        (["Transit GTFS", "weekday 7-9 am bus frequency per stop", f"Not loaded: no feed reachable for {NM} yet, so bus-frequency projects and gaps are not scored here", False]
         if not (ex("octa_stops_7_9.json") or ex("transit_stops_7_9.json")) else
        [f"{region.OV.get('transit_name', 'Transit')} GTFS", f"weekday 7-9 am bus frequency per stop (feed calendar {_d(tr.get('calendar_start', '?'))} to {_d(tr.get('calendar_end', '?'))}; {tr.get('url', '')})", "Loaded", True]
         if ex("octa_stops_7_9.json") else
        ["GTFS feeds (MobilityData's copies of each operator's feed, or the operator's own download" + ("; in California also the State's Cal-ITP tables" if CA else "") + ")",
         "weekday 7-9 am bus departures per stop on one weekday per feed, each bus route counted once, stops listed without a time interpolated between the trip's timed stops, a trip's last stop and drop-off-only stop times not counted as departures: "
         + ("; ".join(_feed_label(f) for f in feeds) or "none") + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider'].strip()} (MobilityData {x['id']}: {not_inc(x)})" for x in _not_counted(tr))) if _not_counted(tr) else "") + _not_located(tr),
         tr_status, tr_ok]),
        (lambda RC: ["GTFS rail stops (the feeds read for buses, current or out of date, and Amtrak's national feed)", "which OpenStreetMap rail stations are served, for the distance to rail: a station counts where a rail route stops within 400 m; so does a named subway, light-rail or monorail station of a network that runs no rail routes in a current feed here, or a station newer than its operator's out-of-date feed, unless OpenStreetMap marks it under construction, proposed, disused or abandoned or its operator's current schedule omits the line; heritage, excursion, airport and unserved stations are left out, and a subway, commuter, intercity or monorail stop with no station within 150 m (300 m for a same-named station or an Amtrak stop) is added", f"Loaded ({_count(len(RC['gtfs']), 'station')} confirmed by a stop, {len(RC['mode']) + len(RC['agency']):,} by type or operator, {len(RC['dropped']):,} left out, {len(RC['added']):,} added)", True] if RC else None)(json.load(open(os.path.join(DATA, "rail_confirm.json"))) if ex("rail_confirm.json") else None),   # round 8.4 (metrics_oc.confirm_rail_stations)
        ["CDE School Directory", "active entries of the California School Directory with a location: public schools and the district and county offices listed with them (sd.cde.ca.gov)", "Loaded", True] if CA else
        (["NCES EDGE public school locations", "public schools" + (f", {syt} school year" if syt else "") + " (NCES EDGE's latest release, via ArcGIS)", "Loaded", True] if ex("nces_schools.geojson") else None),
        ["CHP CCRS " + ("-".join(str(y) for y in (cr.get("years") or [])[:1] + (cr.get("years") or [])[-1:]) if cr.get("years") else ""), f"crashes by block group: {cr.get('rows', 0):,} " + NM + f" records, {cr.get('with_coords', 0):,} with coordinates ({(cr.get('with_coords', 0) / cr['rows'] * 100) if cr.get('rows') else 0:.0f}%); pedestrian/bicycle crashes are those whose first object struck was a pedestrian or bicycle, or with an injured or killed pedestrian or cyclist in CCRS's injured-persons table; killed-or-seriously-injured from the same table", "Loaded (data.ca.gov datastore)", True] if CA and not ex("crashes_local.json") else
        ([f"{LOC.get('name', 'Local crash reports')} " + "-".join(str(y) for y in (cr.get("years") or [])[:1] + (cr.get("years") or [])[-1:]), f"crashes by block group: {cr.get('rows', 0):,} reports in and around {NM}, {cr.get('with_coords', 0):,} with coordinates; pedestrian/bicycle involvement and killed-or-seriously-injured" + ("" if (LOC.get("all_injury") or LOC.get("fields9")) else " (minor injuries are not recorded)"), "Loaded (" + LOC.get("source", "") + ")", True] if LOC else
         ["State crash records", "pedestrian/bicycle and killed-or-seriously-injured crashes by block group", f"Not connected for {STN} yet: crash gaps are not scored and crash-based projects are not proposed", False]),
        (["NHTSA FARS 2023-2024 (USDOT/BTS NTAD)", "fatal crashes only (downloaded for reference; not scored)", "Downloaded, not scored", False] if ex("fars_2023.json") else None),
        ["CA DOJ Crimes & Clearances 2025", "violent and property crime per 1,000 residents by police agency (city level, not block group)", "Loaded", True] if CA else
        ["Crime data", "violent and property crime per 1,000 residents", "Not connected outside California (the FBI's Crime Data Explorer needs an API key): crime gaps are not scored", False],
        (["Tree Equity Score 08/01/2023 dataset (downloads updated 6 Dec 2024, 2 Jun 2025)", "heat disparity (temp_diff) and tree-canopy gap (tc_gap) on 2020 block groups", "Loaded (current California file)", True]
         if te.get("release", "2021") != "2021" else
         ["Tree Equity Score 2021", heat, ((f"No values here: the 2021 release has no {STN} file" if not ex(os.path.join("tes", region.STATE.lower() + ".shp")) else
                                           f"No values here: the 2021 release covers Census urbanized areas only and has no block group in {NM}") + "; heat and tree-canopy gaps are not scored"), False]
         if n_te == 0 else
         ["Tree Equity Score 2021", heat, f"Loaded for {n_te:,} of {n_bg:,} block groups (the 2021 release covers Census urbanized areas only and is {te_note})", True]
         if n_te is not None and n_te < n_bg else
         ["Tree Equity Score 2021", heat, f"Loaded (2021 release, {te_note})", True]),
        ["CAL FIRE FHSZ SRA 2023 / LRA 2025", "Very High fire hazard share", "Loaded", True] if CA else None,
        (["AFDC EV stations (USDOT/BTS NTAD copy)", "public, available DC fast chargers for the 'nearest fast charger' distance", f"Loaded ({_count(n_af, 'station')} in and around {NM}, downloaded {_d((afdc or {}).get('downloaded', ''))})", True]
         if afdc is not None and n_af else
         ["AFDC EV stations (USDOT/BTS NTAD copy)", "public, available DC fast chargers for the 'nearest fast charger' distance", f"None in the download for the area around {NM} (downloaded {_d((afdc or {}).get('downloaded', ''))}); OpenStreetMap charging stations used instead", False]
         if afdc is not None else
         ["NREL AFDC chargers", "DC fast chargers (needs an API key)", "Not loaded; OpenStreetMap charging stations used", False]),
        ["City 311 requests", "dumping, graffiti, litter, encampment projects", ("No " + NM + " city publishes an open 311 export (checked Nov 2026); projects not scored" if region.FIPS == "06059" else "Not connected for " + NM + " yet; projects not scored"), False],
        ["Assessor parcels / sales", "parcel zoning, underused land, recorded sales at block-group level", ("Not loaded (OCGIS parcels carry no value or sale fields); per-house lookups still query OCGIS live" if region.FIPS == "06059" else
                                                                                                          f"Not loaded for {NM}; the EIFD calculator estimates the assessed base as 55% of market value" if CA else f"Not loaded for {NM}"), False],
        (["City street-tree inventories", "open planting sites (street sites only)", f"Anaheim inventory ({', '.join(f"{c['city']}: {c['vacant_sites']:,} open street sites" for c in st.get('cities', []))}; {_count(st.get('block_groups', 0), 'block group')}); elsewhere open sites are estimated from block-group area (about 68 plus 0.11 per acre, halved where the canopy gap is under 10 points; the fit used for Los Angeles County)", True]
         if st.get("block_groups") else
         ["Street-tree survey", "open planting sites", f"No street-tree inventory connected for {NM}; open sites estimated from block-group area (about 68 plus 0.11 per acre, halved where the canopy gap is under 10 points; the fit used for Los Angeles County)", False]),
        (["Tax-rate areas (BOE 2026) + Auditor Section 99 factors FY 2026-27", "County and city share of property-tax increment per block group, for the EIFD calculator", f"Loaded ({_count(ta.get('block_groups', 0), 'block group')})", True]
         if ta.get("block_groups") else
         ["Tax-rate areas", "County and city share of property-tax increment", "Not loaded; the EIFD calculator starts from placeholder shares (city 20%, none where unincorporated; County General Fund 24%) that can be edited", False]
         if CA else
         ["Tax-rate areas", "County and city share of property-tax increment", "Not used: the EIFD calculator covers California only", False]),
    ]
'''
s = s[:i] + NEW + s[j:]
open(p, "w").write(s)
print("sources table rewritten in", p)
