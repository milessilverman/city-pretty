"""Assemble the Orange County bundle (schema 2) from data/metrics.json and data/layers.json, run the engine, build the
gap analysis, neighborhood plans and profit totals, then write data/bundle-oc.json and data/bundle-oc.b64 (gzip+base64)
ready for splice_bundle.py. Needs the LA details/bundle (decoded from the page) for the peer pool: pass their folder."""
import os, sys, json, gzip, base64, statistics, math, collections, datetime, re
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine

import region
DATA = region.DATA
LA = sys.argv[1] if len(sys.argv) > 1 else "."
GAP_FIX = {"heat": "street_trees", "canopy": "street_trees", "violent": "foot_patrol", "property": "foot_patrol", "freeway": "school_filters", "library": "library", "rail": "rail_station",
           "pool": "pool", "ev": "ev_hub", "dining": "main_street", "center": "rec_center", "play_d": "park_upgrade", "pedbike": "protected_bike", "park_d": "pocket_park",
           "bus": "transit_priority", "park_ac": "pocket_park", "grocery": "grocery", "clinic": "clinic", "school": "new_school"}
GAP_METRIC = {"heat": ("ht", True), "canopy": ("tg", True), "violent": ("vc", True), "property": ("pcr", True), "freeway": ("fw", False), "library": ("fc_library", True),
              "rail": ("rm", True), "pool": ("pool", True), "ev": ("ev", True), "dining": ("din", False), "center": ("fc_center", True), "play_d": ("playground_m", True),
              "pedbike": ("pbcr", True), "park_d": ("pn", True), "bus": ("bt", False), "park_ac": ("pa", False), "grocery": ("gro", True), "clinic": ("fc_clinic", True), "school": ("fc_school", True)}


TRANSIT_DEPENDENT = {"microtransit", "transit_priority", "bus_shelters", "transit_shade", "bus_lane", "brt", "food_hall"}



COPY_TEXT = {"legacy mirror": "MobilityData's legacy mirror", "producer URL": "the operator's own URL", "TransitFeeds archive": "the TransitFeeds archive",
             "Cal-ITP statewide tables": "the State of California's Cal-ITP tables"}


def _feed_label(f):
    """one feed in the transit sources row: its agencies, MobilityData id, the copy read when it is not MobilityData's hosted one, the
    weekday measured and, when the newest copy that could be read has ended (fetch_oc selection 20), the end of its bus schedule"""
    cp = COPY_TEXT.get(f.get("copy"))
    if cp and f.get("calitp"):
        cp += f": {f['calitp'].get('name')}, snapshot of {_d(f['calitp'].get('snapshot'))}"
    return (f"{', '.join(f['agencies']) if f.get('agencies') else f['provider']} (MobilityData {f['id']}; measured on {_d(f['weekday'], True)}"
            + (f"; read from {cp}" if cp else "") + (f"; the newest copy that could be read ends on {_d(f['schedule_ended'])}" if f.get("schedule_ended") else "") + ")")


STATE_NAMES = dict(zip("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(),
    ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
     "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
     "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
     "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Puerto Rico", "Rhode Island", "South Carolina",
     "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]))
ERR_COPY = {"hosted": "MobilityData's hosted copy", "legacy mirror": "MobilityData's legacy mirror", "producer URL": "the operator's own URL",
            "TransitFeeds archive": "the TransitFeeds archive", "Cal-ITP statewide tables": "the State's Cal-ITP tables"}


MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _d(s, wd=False):
    """'2026-11-18' or '20261118' -> '18 Nov 2026' ('Wed 18 Nov 2026' with wd); anything else as it is"""
    g = re.sub(r"\D", "", str(s or ""))
    try:
        t = datetime.date(int(g[:4]), int(g[4:6]), int(g[6:8])) if len(g) == 8 else None
    except ValueError:
        t = None
    return ((t.strftime("%a ") if wd else "") + f"{t.day} {MON[t.month - 1]} {t.year}") if t else str(s or "")


def _count(n, noun):
    """'1 feed', '2 feeds', '1,234 stops'"""
    return f"{n:,} {noun}" + ("" if n == 1 else "s")


def _and(xs):
    """'a', 'a and b', 'a, b and c'"""
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def _err_text(part):
    """one download error as fetch_oc records it ("<copy>: <the exception's text, cut at 50 characters>") in plain words"""
    kind, _, err = part.partition(": ")
    who = ERR_COPY.get(kind.strip(), kind.strip())
    code = re.search(r"HTTPError:? (\d{3})", err)
    if "Tunnel connection failed" in err:   # the build machine's network proxy refuses the host
        what = "is not reachable from where this map is built"
    elif code:
        what = {"403": "is not available (HTTP 403)", "404": "is not found (HTTP 404)", "410": "is gone (HTTP 410)"}.get(code.group(1), f"answered HTTP {code.group(1)}")
    elif re.search(r"timed? ?out|Timeout", err, re.I):
        what = "timed out"
    elif "BadZipFile" in err:
        what = "does not serve a zip file"
    elif re.search(r"RemoteDisconnected|ConnectionReset|IncompleteRead|ConnectionAborted", err):
        what = "dropped the connection"
    elif re.search(r"Name or service not known|getaddrinfo|nodename nor servname|name resolution", err):
        what = "has a host name that does not resolve"
    elif re.search(r"CERTIFICATE_VERIFY_FAILED|SSLError|SSLCertVerification", err):
        what = "failed its certificate check"
    else:
        what = "could not be downloaded"
    return f"{who} {what}"


def _why_text(why):
    """a skipped feed's reason as the page shows it (selection 21): download errors in plain words, and a long list of routes counted from
    other feeds cut at a whole entry"""
    m = re.search(r"its Cal-ITP copy places only (\d+) of (\d+) stops exactly", why)
    if m:   # round 8.6: say that the copy was not used
        k, n = int(m.group(1)), int(m.group(2))
        why = why.replace(m.group(0), "its Cal-ITP copy was not used: " + (f"none of its {n:,} stops has an exact position" if k == 0 else f"only {k:,} of its {n:,} stops have an exact position"))
        if why.startswith("its Cal-ITP"):
            return why
    pre = "no copy could be downloaded ("
    if why.startswith(pre):
        body, tail = why[len(pre):], ""
        k = body.find("); its Cal-ITP copy")
        if k >= 0:
            body, tail = body[:k], body[k + 3:]
        elif body.endswith(")"):
            body = body[:-1]
        parts = [q for q in re.split(r"; (?=(?:" + "|".join(map(re.escape, ERR_COPY)) + r"): )", body) if q.strip()]
        return "no copy could be downloaded: " + _and([_err_text(q) for q in parts]) + ("; " + tail if tail else "")
    if why.startswith("feed could not be read ("):
        m = re.match(r"feed could not be read \((\w+)", why)
        return "the feed could not be read" + (f" ({m.group(1)})" if m else "")
    pre = "its routes are counted from other feeds: "
    if why.startswith(pre):
        why = why.replace(" counted from feed ", " counted from MobilityData ").replace(" current one in feed ", " current one in MobilityData ")
    if why.startswith(pre) and len(why) > len(pre) + 240:
        items, out = why[len(pre):].split("; "), []
        for it in items:
            if out and len("; ".join(out + [it])) > 240:
                break
            out.append(it)
        return pre + "; ".join(out) + (f"; and {len(items) - len(out)} more" if len(out) < len(items) else "")
    return why


def _counted_text(x):
    """a feed whose routes are all counted from other feeds, for the 'Counted through other feeds' sentence"""
    items = x["why"].split(": ", 1)[1].split("; ") if ": " in x["why"] else []
    out = []
    for it in items:
        m = re.match(r"^(.*?): (\d+) (routes?) counted from (?:feed|MobilityData) (\S+)$", it)
        m2 = re.match(r"^(.*?): schedule superseded by the current one in (?:feed|MobilityData) (\S+)$", it)
        own = lambda a: "its" if a.strip().lower() == x["provider"].strip().lower() else f"{a}'s"
        if m:
            out.append(f"{own(m.group(1))} {m.group(2)} {m.group(3)} {'is' if m.group(2) == '1' else 'are'} counted from MobilityData {m.group(4)}")
        elif m2:
            out.append(f"{own(m2.group(1))} schedule is superseded by the current one in MobilityData {m2.group(2)}")
        else:
            out.append(it)
    if len(out) > 6:
        out = out[:6] + [f"and {len(out) - 6} more"]
    return f"{x['provider'].strip()} (MobilityData {x['id']}; " + "; ".join(out) + ")"


def _unlocated(x):
    """a feed tried in every county of its state, the catalog giving it no area, of which no copy could be downloaded (selection 21)"""
    return bool(x.get("unlocated")) and (x.get("why") or "").startswith("no copy could be downloaded")


def _not_counted(tr):
    """skipped feeds, less the copies of a feed that is counted from another copy or read with no stop here (Gold Coast Transit 32: its
    hosted copy ended over a year ago and its legacy mirror is read); since selection 21 also less feeds read with no stop in the county's
    box (stops_in_county 0: Fresno State University's feed was listed in all 56 California counties) and unlocated feeds (_not_located)"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    out = collections.OrderedDict()   # one entry a feed: a later copy's reason replaces an earlier one, since the last copy read decided
    for x in (tr.get("skipped") or []):   # (Tri-Rail 333: its hosted copy ended over a year ago, its other copy has no bus routes)
        if x["id"] not in counted and x.get("stops_in_county", 1) > 0 and not _unlocated(x):
            out[x["id"]] = x
    return list(out.values())


def _not_located(tr):
    """the sentence naming unlocated feeds (selection 21), each once, with their download errors in plain words; '' when there are none"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    nl = [x for x in (tr.get("skipped") or []) if _unlocated(x) and x["id"] not in counted]
    if not nl:
        return ""
    by = collections.OrderedDict()
    for x in nl:
        by.setdefault(x["provider"].strip(), []).append(x["id"])
    names = [f"{pv} (MobilityData {_and(list(dict.fromkeys(ids)))})" for pv, ids in by.items()]
    err = {pv: list(dict.fromkeys(_why_text(x["why"]).split(": ", 1)[1] for x in nl if x["provider"].strip() == pv)) for pv in by}
    one = len(names) == 1
    where = "municipio of Puerto Rico" if region.STATE == "PR" else f"{STATE_NAMES.get(region.STATE, region.STATE)} county"
    variants = list(dict.fromkeys(e for v in err.values() for e in v))
    why = ("no copy could be downloaded: " + "; ".join(variants) if one else
           "none could be downloaded: for each, " + variants[0] if len(variants) == 1 else
           "none could be downloaded: " + "; ".join(f"{pv}: {'; '.join(v)}" for pv, v in err.items()))
    return (f". Not located: {_and(names)}. MobilityData's catalog gives {'this feed' if one else 'these feeds'} no area, so {'it was' if one else 'each was'} "
            f"tried in every {where}, and {why}")


def _ended_note(tr):
    """the status cell's count of feeds measured on a schedule that has ended (fetch_oc selection 20 records schedule_ended)"""
    n = sum(1 for f in (tr.get("feeds") or []) if f.get("schedule_ended"))
    return f"; {n} {'feed' if n == 1 else 'feeds'} measured on the newest schedule that could be read, which has ended" if n else ""

def _crash_layers(LOC):
    """the layers the crash rows were read from (crashes_local.json 'jobs', or Illinois's yearly layers in region.OV), each with its
    years; numbered layers of one service are listed once. LOC['source'] is only the config's reference URL (round 8.6: for Utah a layer
    that was not read)"""
    cfg = region.OV.get("crashes") or {}
    lab = {j["url"]: j.get("label", "") for j in cfg.get("jobs") or []}
    lab.update({u: str(y) for y, u in (cfg.get("layers") or {}).items()})
    urls = LOC.get("jobs") or ([u for _, u in sorted(cfg["layers"].items())] if LOC.get("kind") == "il_idot" and cfg.get("layers") else [])
    if not urls:
        return LOC.get("source", "")
    by_root = {}
    for u in urls:
        root, _, n = u.rpartition("/")
        by_root.setdefault(root, []).append((n, lab.get(u, "")))
    return "; ".join(f"{root}/{ls[0][0]}" + (f" ({ls[0][1]})" if ls[0][1] else "") if len(ls) == 1 else
                     f"{root}, layers " + ", ".join(f"{n} ({l})" if l else n for n, l in ls) for root, ls in by_root.items())


def sources_table(M):
    cr = M.get("crash") or {}
    cov = M.get("coverage") or {}; tr = cov.get("transit") or {}; te = cov.get("tree_equity") or {}; st = cov.get("street_trees") or {}; ta = cov.get("tax_rate_areas") or {}
    osm_state = ""
    try:
        osm_state = [l.split("=")[1].replace("\\", "") for l in open(os.path.join(DATA, "osm", region.OSM_FILE.replace("-latest.osm.pbf", ".state.txt"))).read().splitlines() if l.startswith("timestamp")][0][:10]
    except Exception:
        pass
    ex = lambda n: os.path.exists(os.path.join(DATA, n)); CA = region.STATE == "CA"
    PA = (json.load(open(os.path.join(DATA, "layers.json"))).get("parks_added") or {}) if os.path.exists(os.path.join(DATA, "layers.json")) else {}
    LOC = json.load(open(os.path.join(DATA, "crashes_local.json"))) if os.path.exists(os.path.join(DATA, "crashes_local.json")) else {}
    NM = "the District of Columbia" if region.NAME == "District of Columbia" else region.NAME; STN = STATE_NAMES.get(region.STATE, region.STATE); PR = region.STATE == "PR"

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
    nc_through = [x for x in _not_counted(tr) if x["why"].startswith("its routes are counted from other feeds")]
    nc_other = [x for x in _not_counted(tr) if not x["why"].startswith("its routes are counted from other feeds")]
    rows = [
        ["TIGERweb Tracts_Blocks", f"Census 2020 block-group boundaries ({len(M['metrics']):,} in {NM})", "Loaded", True],
        ["ACS 2020-2024 5-year", "population, homes, tenure, home value (B25077), rent (B25064), income, year built, vehicles (B25044), children (B01001); the Census tract's median home value and rent where the block group's is suppressed", "Loaded (www2.census.gov table files)", True],
        ["OpenStreetMap " + osm_state, "streets, parks, water, rail, stations, amenities, facilities, neighborhood names, noise walls, power lines (" + osm_desc + ")", "Loaded", True],
        ["OC Parks Park_Boundaries", "county parks, beaches and wilderness with amenity flags (restrooms, playgrounds, courts, fields)", "Loaded (123 parks)", True] if ex("oc_county_parks.geojson") else None,
        ["Esri USA Parks", f"parks not yet drawn in OpenStreetMap: local, regional and county parks, and state and national parks or forests as open space ({PA.get('usa', 0):,} added)", "Loaded", True] if ex("usa_parks.geojson") else None,
        ["OCGIS City_Boundaries_Public", "city limits and unincorporated communities", "Loaded", True] if ex("oc_cities.geojson") else
        (["Census TIGERweb places", "zonas urbanas and comunidades (census-designated places; Puerto Rico has no incorporated places); the rest of the municipio is shown under the municipio's name", "Loaded", True] if PR else
         ["Census TIGERweb places and county subdivisions", "city, borough and village limits (incorporated places), the towns and townships around them (county subdivisions with their own government) and named communities inside a town or township (census-designated places, shown as '<community> (<town>)')", "Loaded", True]
         if region.STATE in region.TOWN_STATES and ex("cousub.geojson") else
         ["Census TIGERweb places", "city, borough and village limits (incorporated places) and census-designated places; town and township boundaries not loaded, so land outside a place is shown under the county's name", "Loaded", True]
         if region.STATE in region.TOWN_STATES else
         ["Census TIGERweb places", "city limits (incorporated places) and named unincorporated communities (census-designated places)", "Loaded", True]),
        (["Transit GTFS", "weekday 7-9 am bus frequency per stop", f"Not loaded: no feed reachable for {NM} yet, so bus-frequency projects and gaps are not scored here", False]
         if not (ex("octa_stops_7_9.json") or ex("transit_stops_7_9.json")) else
        [f"{region.OV.get('transit_name', 'Transit')} GTFS", f"weekday 7-9 am bus frequency per stop (feed calendar {_d(tr.get('calendar_start', '?'))} to {_d(tr.get('calendar_end', '?'))}; {tr.get('url', '')})", "Loaded", True]
         if ex("octa_stops_7_9.json") else
        ["GTFS feeds (MobilityData's copies of each operator's feed, or the operator's own download" + ("; in California also the State's Cal-ITP tables" if CA else "") + ")",
         "weekday 7-9 am bus departures per stop (one weekday per feed; each bus route counted once; stops listed without a time interpolated between the trip's timed stops; a trip's last stop and drop-off-only stop times not counted). Feeds counted: "
         + ("; ".join(_feed_label(f) for f in feeds) or "none")
         + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider'].strip()} (MobilityData {x['id']}: {not_inc(x)})" for x in nc_other)) if nc_other else "")
         + (". Counted through other feeds: " + "; ".join(dict.fromkeys(_counted_text(x) for x in nc_through)) if nc_through else "") + _not_located(tr),
         tr_status, tr_ok]),
        (lambda RC: ["GTFS rail stops (the feeds read for buses, current or out of date, and Amtrak's national feed)", "which OpenStreetMap rail stations are served, for the distance to rail: a station counts where a rail route stops within 400 m; so does a named subway, light-rail or monorail station of a network that runs no rail routes in a current feed here, or a station newer than its operator's out-of-date feed, unless OpenStreetMap marks it under construction, proposed, disused or abandoned or its operator's current schedule omits the line; heritage, excursion, airport and unserved stations are left out, and a subway, commuter, intercity or monorail stop with no station within 150 m (300 m for a same-named station or an Amtrak stop) is added", *((f"Loaded ({_count(len(RC['gtfs']), 'station')} confirmed by a stop, {len(RC['mode']) + len(RC['agency']):,} by type or operator, {len(RC['dropped']):,} left out, {len(RC['added']):,} added)", True)
                        if (RC['gtfs'] or RC['mode'] or RC['agency'] or RC['dropped'] or RC['added']) else (f"None: no rail station found in or near {NM} (OpenStreetMap and the feeds read)", False))] if RC else None)(json.load(open(os.path.join(DATA, "rail_confirm.json"))) if ex("rail_confirm.json") else None),   # round 8.4 (metrics_oc.confirm_rail_stations)
        ["CDE School Directory", "active entries of the California School Directory with a location: public schools and the district and county offices listed with them (sd.cde.ca.gov)", "Loaded", True] if CA else
        (["NCES EDGE public school locations", "public schools" + (f", {syt} school year" if syt else "") + " (NCES EDGE's latest release, via ArcGIS)", "Loaded", True] if ex("nces_schools.geojson") else None),
        ["CHP CCRS " + ("-".join(str(y) for y in (cr.get("years") or [])[:1] + (cr.get("years") or [])[-1:]) if cr.get("years") else ""), f"crashes by block group: {cr.get('rows', 0):,} " + NM + f" records, {cr.get('with_coords', 0):,} with coordinates ({(cr.get('with_coords', 0) / cr['rows'] * 100) if cr.get('rows') else 0:.0f}%); pedestrian/bicycle crashes are those whose first object struck was a pedestrian or bicycle or that list an injured or killed pedestrian or cyclist in CCRS's injured-persons table; killed-or-seriously-injured counts come from the same table", "Loaded (data.ca.gov datastore)", True] if CA and not ex("crashes_local.json") else
        ([f"{LOC.get('name', 'Local crash reports')} " + "-".join(str(y) for y in (cr.get("years") or [])[:1] + (cr.get("years") or [])[-1:]), f"crashes by block group: {cr.get('rows', 0):,} reports in and around {NM}, {cr.get('with_coords', 0):,} with coordinates; pedestrian/bicycle involvement and killed-or-seriously-injured" + ("" if (LOC.get("all_injury") or LOC.get("fields9")) else " (minor injuries are not recorded)"), "Loaded (" + _crash_layers(LOC) + ")", True] if LOC else
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
        ["City 311 requests", "requests about dumping, graffiti, litter and encampments (used for cleanup projects)", ("No " + NM + " city publishes an open 311 export (checked Nov 2026); projects not scored" if region.FIPS == "06059" else "Not connected for " + NM + " yet; projects not scored"), False],
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
    return [r for r in rows if r]


def oc_eifd(m):
    """Orange County EIFD inputs in the page's m.e shape. sh = [city, County General, other districts, schools+ERAF] shares of the
    1% levy increment from the Auditor-Controller's FY 2026-27 Section 99 factors, area-weighted over BOE 2026 tax-rate areas.
    No Assessor roll value exists for Orange County, so av is absent (the calculator keeps its 55%-of-market-value base) and
    w (market value, homes x median value) weights block groups when a neighborhood is combined."""
    t = m.get("tra")
    if not t:
        return None
    city = t.get("city", 0.0); cg = t["cg"]; sch = t["sch"]
    other = max(0.0, 1.0 - city - cg - sch)
    return {"sh": [round(city, 5), round(cg, 5), round(other, 5), round(sch, 5)], "t": [[t["tra"], None]], "w": (m.get("hv") or 0) * (m.get("homes") or 0), "oc": 1}


def gap_value(m, key):
    x = m.get("x") or {}; fc = m.get("fc") or {}
    if key.startswith("fc_"):
        return fc.get(key[3:].replace("_", " "))
    if key in x:
        return x[key]
    return m.get(key)


def fmt_gap(key, v):
    if v is None:
        return "–"
    if key in ("fw", "fc_library", "rm", "pool", "ev", "fc_center", "playground_m", "pn", "gro", "fc_clinic", "fc_school"):
        return "<0.1 mi" if v < 80.45 else f"{v / 1609:.1f} mi"   # round 8.6: not '0.0 mi'
    if key == "ht":
        v = 0.0 if abs(v) < 0.05 else v
        return "0.0°F" if v == 0 else f"{v:+.1f}°F"
    if key in ("vc", "pcr"):
        return f"{v:.1f}/1k"
    if key == "pa":
        return f"{v:.1f} ac"
    if key == "bt":
        b = round(v * 2) / 2   # 7-9 am departures / 2: halves occur
        return f"{b:g} bus/hr" if b == 1 else f"{b:g} buses/hr"
    if key == "tg":
        t = _pt(v)
        return f"{t} pt below goal" if t == "1" else f"{t} pts below goal"
    return str(int(v))


def _pt(v):
    """canopy gap in points: rounded half up (int() used to truncate 9.9 to 9); one decimal under 9.95"""
    return f"{v:.1f}" if v < 9.95 else str(int(v + 0.5))


def _pts(x, p):
    """two canopy gaps, or both with one decimal where they would print alike (a gap needs a 10% difference)"""
    a, b = _pt(x), _pt(p)
    return (a, b) if a != b else (f"{x:.1f}", f"{p:.1f}")


CRASH_SPAN = ""   # round 8.6: set in main() from metrics.json crash.years
EV_WHAT = "The nearest EV fast charger"   # round 8.6: set in main() from afdc_dcfc.json


def _deg(v):
    """a heat value against its own urban-area average: '+2.9°F', '-0.6°F', '0.0°F'"""
    v = 0.0 if abs(v) < 0.05 else v
    return "0.0°F" if v == 0 else f"{v:+.1f}°F"


def _canopy_why(x, p):
    a, b = _pts(x, p)
    return f"Tree canopy is {a} {'point' if a == '1' else 'points'} below the Tree Equity goal (similar neighborhoods: {b})."


def _mi(x, p):
    """two distances in miles, one decimal, or two where they would print alike (a gap needs a 10% difference, not 0.1 mi)"""
    a, b = f"{x / 1609:.1f}", f"{p / 1609:.1f}"
    return (a, b) if a != b else (f"{x / 1609:.2f}", f"{p / 1609:.2f}")


def _near(what, x, p):
    a, b = _mi(x, p)
    return f"{what} is {a} mi away; in similar neighborhoods it's about {b} mi."


def _fwy(x, p):
    a, b = _mi(x, p)
    return (f"Homes sit right next to the freeway (within 0.05 mi; similar neighborhoods: {b} mi)" if x < 80 else
            f"Homes sit {a} mi from the freeway (similar neighborhoods: {b} mi)") + ", so noise and exhaust are higher."


def _bus_why(x, p):
    """bt is 7-9 am departures / 2 at the busiest stop within 400 m"""
    h = f"{round(p * 2) / 2:g}"
    if not x:
        return f"No bus stop within 400 m has a 7-9 am departure (similar neighborhoods: {h} {'bus' if h == '1' else 'buses'} an hour)."
    b = round(x * 2) / 2
    return ("Under 1 bus" if b < 1 else f"{b:g} bus" if b == 1 else f"{b:g} buses") + f" an hour at the busiest stop within 400 m (similar neighborhoods: {h})."


WHY = {"heat": lambda x, p: f"Summer heat here is {_deg(x)} against this county's urban-area average; similar neighborhoods are about {_deg(p)} against theirs.", "canopy": _canopy_why,
       "violent": lambda x, p: f"{x:.1f} violent crimes per 1,000 residents a year (similar neighborhoods: {p:.1f}).", "property": lambda x, p: f"{x:.1f} property crimes per 1,000 residents a year (similar neighborhoods: {p:.1f}).",
       "freeway": _fwy, "library": lambda x, p: _near("The nearest library", x, p),
       "rail": lambda x, p: _near("Rail", x, p), "pool": lambda x, p: _near("The nearest public pool", x, p),
       "ev": lambda x, p: _near(EV_WHAT, x, p), "dining": lambda x, p: ("1 restaurant or café" if int(x) == 1 else f"{int(x)} restaurants and cafés") + f" within 400 m (similar neighborhoods: {int(p)}).",
       "center": lambda x, p: _near("The nearest community or rec center", x, p), "play_d": lambda x, p: _near("The nearest playground", x, p),
       "pedbike": lambda x, p: f"{int(x)} {'crash' if int(x) == 1 else 'crashes'} involving a pedestrian or cyclist here{CRASH_SPAN} (similar neighborhoods: {p:g}).", "park_d": lambda x, p: _near("The nearest park", x, p),
       "bus": _bus_why, "park_ac": lambda x, p: f"{x:.1f} acres of park within ½ mile (similar neighborhoods: {p:.1f}).",
       "grocery": lambda x, p: _near("The nearest supermarket", x, p), "clinic": lambda x, p: _near("The nearest clinic", x, p),
       "school": lambda x, p: _near("The nearest public school", x, p)}


def main():
    M = json.load(open(os.path.join(DATA, "metrics.json"))); metrics = M["metrics"]
    global CRASH_SPAN, EV_WHAT   # round 8.6: the crash period for the crash gap sentence; which charger list the EV distance comes from
    _ys = (M.get("crash") or {}).get("years") or []
    CRASH_SPAN = f" in {min(_ys)}–{max(_ys)}" if _ys else ""
    _af = os.path.join(DATA, "afdc_dcfc.json")
    if not (os.path.exists(_af) and any(st.get("ev_dc_fast_num") for st in (json.load(open(_af)).get("fuel_stations") or []))):
        EV_WHAT = "The nearest public charging station mapped in OpenStreetMap (no fast-charger list here)"
    LY = json.load(open(os.path.join(DATA, "layers.json")))
    bg = json.load(open(os.path.join(DATA, "bg.geojson")))
    la_det = json.load(open(os.path.join(LA, "details.json"))); la_b = json.load(open(os.path.join(LA, "bundle.json")))
    cat = la_b["catalog"]
    # ---- percentile pools across LA + OC ----
    KEYS = ["ht", "vc", "pcr", "pa", "pn", "bt", "gro", "din", "ten", "dog", "pool", "ev", "fw", "tg", "nocar", "inc", "yb", "pop"]
    pool_lists = {k: [v["m"][k] for v in la_det.values() if v["m"].get(k) is not None] + [m[k] for m in metrics.values() if m.get(k) is not None] for k in KEYS}
    pools = engine.Pools(pool_lists)
    # ---- peer pool for gaps: standardized [inc, dens, hv, yb, kids share, nocar, sf] ----
    def vec(m):
        d = (m["homes"] / m["acres"]) if m.get("acres") and m.get("homes") else 0
        return [m.get("inc") or 0, d, m.get("hv") or 0, m.get("yb") or 1960, m.get("nocar") or 0, m.get("sf") or 0]
    peers = [(k, dict(v["m"])) for k, v in la_det.items()] + [(k, m) for k, m in metrics.items()]
    X = np.array([vec(m) for k, m in peers], float); mu, sd = X.mean(0), X.std(0) + 1e-9; Z = (X - mu) / sd
    # ---- run engine ----
    details, features, search = {}, [], {}
    plans_acc = collections.defaultdict(lambda: {"homes": 0, "bgs": 0, "gaps": collections.Counter(), "best": {}, "strong": collections.Counter(), "proj": 0.0})
    from shapely.geometry import shape, mapping
    def simp(g):   # LA's block groups carry ~7 vertices each; keep OC comparable (about 10 m tolerance, 5-decimal coordinates)
        gg = shape(g).simplify(0.00012, preserve_topology=True)
        m = mapping(gg)
        rnd = lambda c: [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 5), round(c[1], 5)]
        return {"type": m["type"], "coordinates": rnd(m["coordinates"])}
    geom = {f["properties"]["GEOID"]: simp(f["geometry"]) for f in bg["features"]}
    for i, (gid, m) in enumerate(metrics.items()):
        rows = engine.run(m, pools, region.NAME, region.STATE)
        if m.get("bt") is None:
            # no transit feed for this county: the engine reads a missing bus frequency as 0, which would make microtransit claim
            # "only 0 buses an hour"; drop rows whose reason depends on bus frequency (data availability, not a formula change)
            rows = [r for r in rows if r[0] not in TRANSIT_DEPENDENT]
        # gaps vs the 50 most similar block groups (LA + this county)
        zi = (np.array(vec(m)) - mu) / sd; dist = ((Z - zi) ** 2).sum(1); near = np.argsort(dist)[1:51]
        G, S = [], []
        for gk, (mk, hi) in GAP_METRIC.items():
            x = gap_value(m, mk)
            if x is None:
                continue
            pv = [gap_value(peers[j][1], mk) for j in near]; pv = [p for p in pv if p is not None]
            if len(pv) < 20:
                continue
            med = statistics.median(pv)
            worse = np.mean([(x > p) if hi else (x < p) for p in pv])
            margin = abs(x - med) >= (0.1 * abs(med) if med else 1e-9)
            fix = GAP_FIX[gk]; cost = next((r[3] for r in rows if r[0] == fix), None)
            if worse >= 0.8 and margin:
                why = WHY[gk](x, med)
                if gk in ("violent", "property") and "sheriff polices: " in (m.get("ag") or ""):   # round 8.6: the rate is the sheriff's, not this place's own
                    why = why.replace(" (similar neighborhoods: ", f" (the sheriff's rate for {m['ag'].split('sheriff polices: ', 1)[1].split(';', 1)[0]}; similar neighborhoods: ", 1)
                G.append([gk, fmt_gap(mk, x), fmt_gap(mk, med), round(float(worse), 2), fix, why, cost])
            elif worse <= 0.2 and margin:
                S.append([gk, fmt_gap(mk, x), fmt_gap(mk, med)])
        md = {k: v for k, v in m.items() if k not in ("x", "tra")}
        md["gp"] = {"g": G, "s": S}; md["z"] = None; md["e"] = oc_eifd(m)
        details[gid] = {"m": md, "r": rows}
        val = [r for r in rows if cat.get(r[0], {}).get("kind") in ("value", "regional")]
        # tp: best paying project per evidence tier and cost of all paying projects at that tier
        tp = []
        for tier in "ABCDU":
            ok = [r for r in val if cat[r[0]]["grade"] <= tier]
            pay = [r for r in ok if r[8] >= 1]
            best = max(pay, key=lambda r: r[8]) if pay else (max(ok, key=lambda r: r[8]) if ok else None)
            tp.append([best[0] if best else None, best[8] if best else None, int(sum(r[3] for r in pay)) or None])
        t, v, pc = tp[3]
        pp = sum(r[7] - r[3] for r in val if r[8] >= 1) / (m["homes"] * m["hv"]) if m.get("hv") and m.get("homes") else 0
        props = {"id": gid, "n": m["n"], "c": m["c"], "h": m["homes"], "v": v, "t": t if (v or 0) >= 1 else None, "pc": pc, "hv": m.get("hv"), "ht": m.get("ht"), "vc": m.get("vc"),
                 "pa": m.get("pa"), "bt": m.get("bt"), "ts": m.get("ts"), "pp": round(pp, 4), "tp": tp}
        features.append({"type": "Feature", "geometry": geom[gid], "properties": props})
        search[f"{m['n']}, {m['c']}"] = gid if f"{m['n']}, {m['c']}" not in search else search[f"{m['n']}, {m['c']}"]
        key = f"{m['n']}|{m['c']}"; P = plans_acc[key]; P["homes"] += m["homes"]; P["bgs"] += 1
        for g in G:
            P["gaps"][g[0]] += 1
            # round 8.6: the most affected part that has a sized project (the LA build's rule, as the page says): a costed row first, then the
            # highest worse-than share, then the widest gap, then the lower cost (was: the lowest cost, else the first part read)
            mk, hi = GAP_METRIC[g[0]]; xv = gap_value(m, mk)
            rank = (g[6] is not None, g[3], xv if hi else -xv, -(g[6] or 0))
            if g[0] not in P["best"] or rank > P["best"][g[0]][4]:
                P["best"][g[0]] = (gid, g[6], g[5], g[4], rank)
        for s in S:
            P["strong"][s[0]] += 1
        P["proj"] += sum(r[7] - r[3] for r in val if r[8] >= 1)
    # ---- plans & profit ----
    plans, profit = {}, {}
    labels = {**la_b.get("gap_labels", {}), "dining": "restaurants and cafés within 400 m"}   # LA's label said ½ mile; the count is within 400 m
    for key, P in plans_acc.items():
        steps = []
        for gk, n in P["gaps"].most_common(6):
            gid, cost, why, fix, _ = P["best"][gk]; rows = details[gid]["r"]; r = next((r for r in rows if r[0] == fix), None)
            c = cat.get(fix, {})
            steps.append({"gap": gk, "share": round(n / P["bgs"], 2), "parts": n, "why": why, "fix": fix, "name": re.sub(r"\s*\([^()]*\)$", "", c.get("name", fix)) if r else c.get("name", fix), "kind": c.get("kind", "qol"), "bg": gid, "near": None,
                          "cost": r[3] if r else None, "value": r[7] if r else None, "vpd": r[8] if r else None, "project": r[1] if r else None, "funding": (c.get("funding") or [None])[0]})
        steps.sort(key=lambda s: (-(s["vpd"] or 0), -(s["share"])))   # round 8.6: by return, then by how many parts share the gap (the LA build's order, as the page says)
        costed = [s for s in steps if s["cost"] is not None]   # round 8.6: a step with no cost is never put first as the cheapest
        if len(steps) > 1 and costed:
            cheap = min(costed, key=lambda s: s["cost"]); steps.remove(cheap); steps.insert(0, cheap)
        plans[key] = {"homes": int(P["homes"]), "bgs": P["bgs"], "steps": steps, "strong": [[k, labels.get(k, k)] for k, n in P["strong"].most_common(3)], "ctx": [],
                      "peer_note": ("Compared with the 50 most similar block groups across LA and Orange County for each part of the neighborhood." if region.FIPS == "06059" else "Compared with the 50 most similar block groups across LA County and " + ("the District of Columbia" if region.NAME == "District of Columbia" else region.NAME) + " for each part of the neighborhood.")}
        hv_tot = sum((metrics[g]["hv"] or 0) * metrics[g]["homes"] for g in metrics if f"{metrics[g]['n']}|{metrics[g]['c']}" == key)
        profit[key] = {"proj": int(P["proj"]), "land": 0, "total": int(P["proj"]), "pct": round(P["proj"] / hv_tot, 4) if hv_tot else 0, "per_home": int(P["proj"] / P["homes"]) if P["homes"] else 0,
                       "homes": int(P["homes"]), "sites": 0, "site_homes": 0, "soon": [], "way": {}}
    bundle = {"type": "FeatureCollection", "features": features, "details": details, "search": search, "plans": plans, "profit": profit,
              "layers": LY["layers"], "cities": LY["cities"], "city_labels": LY["city_labels"], "hoods": {"type": "FeatureCollection", "features": []}, "hood_labels": LY["hood_labels"],
              "meta": {"schema": 2, "county": region.NAME, "fips": region.FIPS, "built": datetime.date.today().isoformat(), "acs": M.get("vintage"), "rent_med": M.get("rent_med"), "default_bg": features[0]["properties"]["id"] if features else None,
                       "sources": sources_table(M)},
              # Round 4: verified Orange County funding programmes, city fees and the tax-share source (read by the page in OC mode)
              "oc_funding": json.load(open(os.path.join(DATA, "oc_funding.json"))) if os.path.exists(os.path.join(DATA, "oc_funding.json")) else None,
              "oc_fees": json.load(open(os.path.join(DATA, "oc_city_fees.json"))) if os.path.exists(os.path.join(DATA, "oc_city_fees.json")) else None,
              "eifd": {k: v for k, v in ((M.get("coverage") or {}).get("tax_rate_areas") or {}).items() if not (k == "note" and "run fetch_oc.py" in str(v))}}
    raw = json.dumps(bundle, separators=(",", ":")).encode()
    open(os.path.join(DATA, "bundle-oc.json"), "wb").write(raw)
    b64 = base64.b64encode(gzip.compress(raw, 9)).decode()
    open(os.path.join(DATA, "bundle-oc.b64"), "w").write(b64)
    print(f"bundle: {len(features)} block groups, {sum(len(d['r']) for d in details.values())} rows, {len(plans)} neighborhoods, json {len(raw) / 1e6:.1f} MB, b64 {len(b64) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
