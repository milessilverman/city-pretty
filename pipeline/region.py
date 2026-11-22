"""Region configuration for the City Pretty county pipeline.
Pick the county with the environment variable CP_FIPS (5-digit county FIPS; default 06059 Orange County, the original build).
Data goes to CP_DATA (default: ./data for Orange County, ./data_<FIPS> otherwise). Everything county-specific in the
pipeline reads from here, so a new county is: add nothing, or add a COUNTY_OVERRIDES entry for county-only sources."""
import os, json, re

HERE = os.path.dirname(os.path.abspath(__file__))
_REG_PATH = os.path.join(HERE, "..", "data", "counties.json")
if not os.path.exists(_REG_PATH):   # a fresh checkout keeps the registry under national/data
    _REG_PATH = os.path.join(HERE, "..", "national", "data", "counties.json")
REG = json.load(open(_REG_PATH))
FIPS = os.environ.get("CP_FIPS", "06059")
C = REG[FIPS]
STATE_FIPS, COUNTY_FIPS, STATE = C["state_fips"], C["county_fips"], C["state"]
NAME = C["name"]                                   # e.g. "San Diego County"
SHORT = NAME.replace(" County", "").replace(" Parish", "").replace(" Borough", "")
# States where every acre, bar a few unorganized townships, gores and reservations in northern New England and New York, lies in a city,
# borough, village, town or township with its own government. Census keeps towns and townships as county subdivisions, not places (round 8.6).
TOWN_STATES = {"CT", "MA", "RI", "NJ", "NY", "PA", "NH", "VT", "ME"}
UNINC = (NAME if STATE == "PR" else   # Puerto Rico: the municipio is the local government (no unincorporated land)
         f"{NAME} (outside any Census place)" if STATE in TOWN_STATES else f"Unincorporated {NAME}")
DATA = os.environ.get("CP_DATA") or os.path.join(HERE, "data" if FIPS == "06059" else f"data_{FIPS}")
LAT0 = round(C["lat"], 2) if FIPS != "06059" else 33.70     # local projection latitude (Orange County keeps its original value)
OSM = C["osm"]
if not OSM.get("url") and not OSM.get("overpass"):
    raise SystemExit(f"{FIPS}: no OpenStreetMap extract: {OSM.get('missing')}")
# local file name in data_<fips>/osm: a state cut from a regional file (osm_split.py) is named after the state, otherwise the download's name.
# Where no extract can be downloaded (Alaska: openstreetmap.fr has none, Geofabrik is not reachable here) the registry names an Overpass API
# endpoint ("overpass"): fetch_oc.py saves the county box, with only the tags osm_extract.py keeps, as OSM XML, which osm_extract.py reads
# with the same osmium code as a .pbf file.
OVERPASS_URL = OSM.get("overpass") if not OSM.get("url") else None
OSM_FILE = (f"{FIPS}-overpass.osm" if OVERPASS_URL else
            OSM["split"].rsplit("/", 1)[1] + "-latest.osm.pbf" if OSM.get("split") else OSM["url"].rsplit("/", 1)[1])
OSM_STATE = re.sub(r"(-latest\.osm\.pbf|\.osm)$", ".state.txt", OSM_FILE)   # the extract's replication timestamp (Overpass: osm_base)
OSM_DESC = (f'OpenStreetMap through the Overpass API ({OVERPASS_URL.split("/")[2]}), county box' if OVERPASS_URL else
            f'{OSM["url"].rsplit("/", 1)[1]} from download.openstreetmap.fr, cut to {OSM["split"].rsplit("/", 1)[1].replace("-", " ").title()} (county boxes) with osmium'
            if OSM.get("split") else f'{OSM_FILE}, download.openstreetmap.fr')

# California: CHP / SWITRS county codes are the 58 counties in alphabetical order (Alameda 01 ... Los Angeles 19, Orange 30, San Diego 37)
CA_ORDER = sorted(c["name"] for c in REG.values() if c["state"] == "CA")
CHP_CODE = f"{CA_ORDER.index(NAME) + 1:02d}" if STATE == "CA" else None

COUNTY_OVERRIDES = {
    "06059": {"bbox": (-118.13, 33.38, -117.41, 33.95), "cities": "ocgis", "county_parks": "ocgis", "gtfs": ["https://www.octa.net/current/Google_Transit_20261108.zip"],
              "transit_name": "OCTA", "trees": "anaheim", "tra": "oc", "funding": "oc", "sheriff": "Orange Co. Sheriff"},
    # Denver: the city-county's own police crash reports (all reported crashes, with pedestrian/bicycle flags and serious-injury and
    # fatality counts; minor injuries are not recorded), City of Denver Open Data on ArcGIS Online
    # San Francisco: CCRS has coordinates for only ~30% of SF crashes; DataSF's injury-crash table (TIMS-geocoded, SWITRS severity
    # classes, republished monthly in the City's ArcGIS Online org) has coordinates for all of them
    "06075": {"crashes": {"kind": "sf_datasf", "name": "San Francisco injury crashes (DataSF)", "all_injury": True,
                          "url": "https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Traffic_Crashes_Resulting_in_Injury_from_DataSF_pulled_monthly_/FeatureServer/0"}},
    "08031": {"crashes": {"kind": "denver_dpd", "name": "Denver Police traffic accidents",
                          "url": "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325"}},
}
# State crash records on ArcGIS Online (all reportable crashes, with KABCO injury counts and pedestrian / bicycle flags), used for
# every county of the state unless the county has its own source. Same 2016-2025 window as CCRS where the state publishes it.
IDOT = "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services"
UDOT = "https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer"   # layer 0 = 2026 ... 7 = 2019
TITAN = "https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes"
TITAN_MAP = {"id": "MRN", "lat": "geometry", "lon": "geometry", "killed": "Fatality", "serious": {"eq": ["Crash_Type", ["Suspected Serious Injury"]]},
             "injured": "Injury", "ped": {"eq": ["Pedestrian", ["Pedestrian"]]}, "bike": {"eq": ["Pedalcyclist", ["Pedalcyclist"]]}}
STATE_DEFAULTS = {
    "IL": {"crashes": {"kind": "il_idot", "name": "Illinois DOT crash records", "layers": {
        2016: f"{IDOT}/Crashes_2016_SDMExtract/FeatureServer/0", 2017: f"{IDOT}/Crashes_2017_SDMExtract/FeatureServer/0", 2018: f"{IDOT}/Crashes_2018_SDMExtract/FeatureServer/0",
        2019: f"{IDOT}/Crashes2019/FeatureServer/0", 2020: f"{IDOT}/Crashes_2020/FeatureServer/0", 2021: f"{IDOT}/CRASHES2021/FeatureServer/0",
        2022: f"{IDOT}/CRASHES_2022/FeatureServer/0", 2023: f"{IDOT}/CRASHES_2023/FeatureServer/0", 2024: f"{IDOT}/CRASHES__2024/FeatureServer/0",
        2025: f"{IDOT}/CRASHES___2025/FeatureServer/0"}, "url": f"{IDOT}/CRASHES__2024/FeatureServer/0"}},
    "VA": {"crashes": {"kind": "va_vdot", "name": "Virginia DOT crash records", "years": [2017, 2025],
                       "url": "https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/Full_Crash/FeatureServer/0"}},
    # Round 8, read through field maps (state_crashes.py). Utah: UDOT UPlan "Utah Crash Locations", one layer per year, all reportable
    # crashes with killed / suspected-serious (four) / B / C injury counts and pedestrian / bicyclist flags; each year layer misses
    # about one day at its edges (1 Jan before 07:00 and 31 Dec after 07:00 local, as stored)
    "UT": {"crashes": {"kind": "arcgis_map", "name": "Utah DOT crash records", "years": [2019, 2025], "url": f"{UDOT}/0",
                       "jobs": [{"label": str(y), "url": f"{UDOT}/{2026 - y}", "map": {"id": "crash_id", "lat": "geometry", "lon": "geometry",
                                 "killed": "number_fatalities", "serious": "number_four_injuries",
                                 "injured": {"sum": ["number_four_injuries", "number_three_injuries", "number_two_injuries"]},
                                 "ped": {"eq": ["pedestrian_involved", ["Y"]]}, "bike": {"eq": ["bicyclist_involved", ["Y"]]}, "date": {"text": "crash_datetime"}}}
                                for y in range(2019, 2026)]}},
    # Pennsylvania: PennDOT's crash tables on PennShare (PennDOT's ArcGIS Online), all reportable crashes. 2019-2023: one row per crash
    # (CRN), month and year only (no day), so dates are kept as the first of the month. 2017-2018: the 2017-2021 table, which repeats
    # rows per crash (copies differ only by ~10 m in coordinates; the first is kept). Checked on 4,957 Pittsburgh crashes of 2019 found in
    # both tables: deaths, injured, pedestrian, bicycle and month agree for all, and MAJOR_INJU equals "suspected serious injury count > 0"
    "PA": {"crashes": {"kind": "arcgis_map", "name": "Pennsylvania DOT crash records (PennShare)", "years": [2017, 2023], "date_precision": "day 2017-2018, month 2019-2023",
                       "url": "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8",
                       "jobs": [{"label": "2017-2018", "url": "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/Crashes_2017_to_2021/FeatureServer/0",
                                 "where": "CRASH_YEAR IN ('2017', '2018')", "dedupe": True,
                                 "map": {"id": "CRN", "lat": "DEC_LAT", "lon": "DEC_LONG", "lon_negative": True, "killed": "FATAL_COUN", "serious": "MAJOR_INJU",
                                         "injured": "TOT_INJ_CO", "ped": {"gt0": "PED_COUNT"}, "bike": {"gt0": "BICYCLE"}, "date": {"text": "CRASH_DATE"}}},
                                {"label": "2019-2023", "url": "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8",
                                 "where": "CRASH_YEAR >= 2019 AND CRASH_YEAR <= 2023",
                                 "map": {"id": "CRN", "lat": "DEC_LAT", "lon": "DEC_LONG", "lon_negative": True, "killed": "FATAL_COUNT",
                                         "serious": "SUSP_SERIOUS_INJ_COUNT", "injured": "TOT_INJ_COUNT", "ped": {"gt0": "PED_COUNT"},
                                         "bike": {"gt0": "BICYCLE_COUNT"}, "date": {"ym": ["CRASH_YEAR", "CRASH_MONTH"]}}}]}},
    # Maine: MaineDOT "Crash Locations - 10 Years Complete" (rolling ten years plus the current year, updated weekly), one row per crash
    # (CRASH_ID), all reportable crashes with K / A / B / C person counts and pedestrian / bicycle flags; dates stored as local midnight
    "ME": {"crashes": {"kind": "arcgis_map", "name": "MaineDOT crash records", "years": [2016, 2025],
                       "url": "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44",
                       "jobs": [{"label": "2016-2025", "url": "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44",
                                 "where": "ACCIDENT_YEAR >= 2016 AND ACCIDENT_YEAR <= 2025",
                                 "map": {"id": "CRASH_ID", "lat": "geometry", "lon": "geometry", "killed": "NO_OF_K_INJ", "serious": "NO_OF_A_INJ",
                                         "injured": {"sum": ["NO_OF_A_INJ", "NO_OF_B_INJ", "NO_OF_C_INJ"]}, "ped": {"eq": ["PED_YN", ["Y"]]},
                                         "bike": {"eq": ["BICYCLE_YN", ["Y"]]}, "date": {"epoch": "ACCIDENT_DATE"}}}]}},
    # Tennessee: Department of Safety and Homeland Security TITAN crash records behind its public dashboard (two snapshots: 2021-2022 from
    # July 2023, 2023 to 2 Dec 2025 from Dec 2025); injury and fatal crashes only, with pedestrian / pedalcyclist flags; the crash type
    # gives suspected serious injury per crash (not a person count), which is what the killed-or-seriously-injured counts need
    "TN": {"crashes": {"kind": "arcgis_map", "name": "Tennessee TITAN injury crash records", "years": [2021, 2025], "all_injury": True,
                       "url": f"{TITAN}__12_03_25_WFL1/FeatureServer/17",
                       "jobs": [{"label": "2021-2022", "url": f"{TITAN}__07_18_23_WFL1/FeatureServer/17", "where": "Collision_Year >= 2021 AND Collision_Year <= 2022",
                                 "map": {**TITAN_MAP, "date": {"epoch": "Collision_Date"}}},
                                {"label": "2023-2025", "url": f"{TITAN}__12_03_25_WFL1/FeatureServer/17", "where": "Collision_Year >= 2023 AND Collision_Year <= 2025",
                                 "map": {**TITAN_MAP, "date": {"text": "Collision_Date"}}}]}},
}
OV = {**STATE_DEFAULTS.get(STATE, {}), **COUNTY_OVERRIDES.get(FIPS, {})}
GTFS = OV.get("gtfs", [])
os.makedirs(DATA, exist_ok=True)


# ---- counties that cross the 180th meridian (Aleutians West, 02016: Attu is at 172 E, Unalaska at 166 W) ----
# Longitudes are written -180..180 in every raw download. For a county whose block groups lie on both sides of 180 the pipeline works on a
# continuous scale instead: west-hemisphere longitudes get +360 when a file is read (geo.wl / geo.shape_ll), so 166 W is 194 and all
# distances and nearest-neighbour searches are plain geometry; the bundle keeps that scale (Leaflet draws longitudes above 180 in the
# same place as their -180..180 twins and keeps the county in one piece). A box that crosses 180 is written west > east (the GeoJSON
# convention); split_box() cuts it into the two plain boxes a web query needs. Every other county takes the old code path unchanged.
def crosses_antimeridian(xs):
    """True when longitudes (-180..180) lie on both sides of 180 and are closer together that way round than through 0"""
    xs = list(xs)
    if not xs:
        return False
    lo, hi = min(xs), max(xs)
    if lo >= 0 or hi <= 0:
        return False
    sh = [x + 360.0 if x < 0 else x for x in xs]
    return max(sh) - min(sh) < hi - lo


def lon_extent(xs):
    """(west, east) of longitudes; west > east when the set crosses the 180th meridian (west is then the smallest positive, east the largest negative)"""
    xs = list(xs)
    if crosses_antimeridian(xs):
        return min(x for x in xs if x >= 0), max(x for x in xs if x < 0)
    return min(xs), max(xs)


def split_box(b, east_edge=180.0):
    """(w, s, e, n) -> list of plain boxes: the box itself, or two boxes cut at 180 when w > e. east_edge is where the east box stops:
    ArcGIS servers answer an envelope that ends at exactly 180 with features from far outside it (the NCES school layer returned
    schools 40 degrees east of the box), so arcgis_query asks for 179.999; Overpass takes 180."""
    w, s, e, n = b
    return [tuple(b)] if w <= e else [(w, s, east_edge, n), (-180.0, s, e, n)]


def lon_in(w, e, lon):
    """lon inside west..east, where west > east means the range crosses 180"""
    return w <= lon <= e if w <= e else (lon >= w or lon <= e)


def lon_overlap(w1, e1, w2, e2):
    """do two longitude ranges (west > east: crossing 180) share any longitude"""
    return any(not (b[2] < a[0] or b[0] > a[2]) for a in split_box((w1, 0, e1, 0)) for b in split_box((w2, 0, e2, 0)))


def bg_lons(path=None):
    """every longitude of data_dir/bg.geojson (None when the file is not there yet)"""
    path = path or os.path.join(DATA, "bg.geojson")
    if not os.path.exists(path):
        return None
    xs = []
    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
        else:
            for q in c:
                walk(q)
    for f in json.load(open(path))["features"]:
        walk(f["geometry"]["coordinates"])
    return xs


_CROSS = None
def crosses_180():
    """does this county's block-group file cross the 180th meridian (False until bg.geojson exists)"""
    global _CROSS
    if _CROSS is None:
        xs = bg_lons()
        if xs is None:
            return False
        _CROSS = crosses_antimeridian(xs)
    return _CROSS
