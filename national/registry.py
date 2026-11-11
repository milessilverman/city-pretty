"""City Pretty national county registry.
Builds data/counties.json: every US county (Census 2025 Gazetteer) with the data sources the pipeline can use there.
Each source is either national (works for any county), state-specific (an adapter exists for that state), or missing
(left out of that county's build, never approximated). Adding a county later = run the pipeline with its FIPS code.

usage: python3 registry.py            -> data/counties.json + data/sources.json (the source catalogue)
"""
import os, json, csv, io, zipfile

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
OSMFR = "https://download.openstreetmap.fr/extracts/north-america/"
# Census region of each state (for the openstreetmap.fr regional extracts)
REGION = {**{s: "us-west" for s in "AK AZ CA CO HI ID MT NM NV OR UT WA WY".split()},
          **{s: "us-midwest" for s in "IA IL IN KS MI MN MO ND NE OH SD WI".split()},
          **{s: "us-northeast" for s in "CT MA ME NH NJ NY PA RI VT".split()},
          **{s: "us-south" for s in "AL AR DC DE FL GA KY LA MD MS NC OK SC TN TX VA WV".split()}}
STATE_FILE = {"CA": "us-west/california", "CO": "us-west/colorado", "IL": "us-midwest/illinois", "MI": "us-midwest/michigan", "NY": "us-northeast/new-york",
              "FL": "us-south/florida", "GA": "us-south/georgia", "NC": "us-south/north-carolina", "TX": "us-south/texas", "VA": "us-south/virginia"}

# Source catalogue. scope: national | state:<ST> | county:<FIPS>. status: ready (adapter written and run) | adapter (written, not yet run
# for this county) | host (needs a network host this build environment does not allow yet) | key (needs an API key) | none (no source found)
SOURCES = {
  "blockgroups": {"name": "Census TIGERweb 2020 block groups", "scope": "national", "status": "ready", "url": "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer"},
  "acs": {"name": "ACS 2020-2024 5-year table-based summary files", "scope": "national", "status": "ready", "url": "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF"},
  "places": {"name": "Census TIGERweb incorporated places and CDPs (city names and limits)", "scope": "national", "status": "adapter", "url": "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer"},
  "osm": {"name": "OpenStreetMap extract (openstreetmap.fr)", "scope": "national", "status": "ready", "url": OSMFR},
  "parks_national": {"name": "Esri USA Parks", "scope": "national", "status": "ready", "url": "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Parks/FeatureServer/0"},
  "ev": {"name": "AFDC station list (USDOT/BTS NTAD copy, daily)", "scope": "national", "status": "ready", "url": "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/Alternative_Fueling_Stations/FeatureServer/0"},
  "tree_equity": {"name": "American Forests Tree Equity Score, state block-group files", "scope": "national", "status": "ready", "url": "https://tes-app-data-share.s3.amazonaws.com/{st}/{st}_csv.zip"},
  "crash_ca": {"name": "CHP CCRS crashes (data.ca.gov)", "scope": "state:CA", "status": "ready", "url": "https://data.ca.gov/dataset/ccrs"},
  "crash_national": {"name": "NHTSA FARS fatal crashes 2023 (final) and 2024 (initial), USDOT/BTS NTAD copies", "scope": "national", "status": "ready",
                     "url": "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Fatality_Analysis_Reporting_System_FinalRelease_Accidents/FeatureServer/0",
                     "note": "fetch_oc.py fetch_fars; fatal crashes only, so the injury-crash scores (pbcr, ksi) stay absent outside California until a state injury source is added"},
  "crash_il": {"name": "Illinois DOT crash records 2016-2025 (all reportable crashes, KABCO injuries, pedestrian / pedalcyclist first harmful event)", "scope": "state:IL", "status": "ready",
               "url": "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services", "note": "region.STATE_DEFAULTS; 2016-2018 extracts store longitude unsigned (fixed on read)"},
  "crash_va": {"name": "Virginia DOT crash records 2017-2025 (all reportable crashes, KABCO injuries, pedestrian / bike flags)", "scope": "state:VA", "status": "ready",
               "url": "https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/Full_Crash/FeatureServer/0", "note": "no 2016 records in the layer: a 9-year window"},
  "crash_ut": {"name": "Utah DOT crash records 2019-2025 (UDOT UPlan, all reportable crashes, killed / suspected serious injury counts, pedestrian / bicyclist flags)", "scope": "state:UT",
               "status": "ready", "url": "https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer",
               "note": "one layer per year; each misses about one day at its edges (1 Jan before 07:00, 31 Dec after 07:00 as stored)"},
  "crash_pa": {"name": "Pennsylvania DOT crash records 2017-2023 (PennShare, all reportable crashes, fatal / suspected serious injury counts, pedestrian and bicycle counts)",
               "scope": "state:PA", "status": "ready", "url": "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8",
               "note": "2019-2023 has crash month and year only (no day); 2017-2018 from the 2017-2021 table, deduplicated by CRN; 2024 onwards not on an allowed host (gis.penndot.gov)"},
  "crash_me": {"name": "MaineDOT crash records 2016-2025 (all reportable crashes, K / A / B / C person counts, pedestrian / bicycle flags)", "scope": "state:ME",
               "status": "ready", "url": "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44",
               "note": "a rolling ten-year view, updated weekly: 2016 will drop out of it"},
  "crash_tn": {"name": "Tennessee Dept. of Safety TITAN injury and fatal crashes 2021 - 2 Dec 2025 (pedestrian / pedalcyclist flags, crash severity)", "scope": "state:TN",
               "status": "ready", "url": "https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes__12_03_25_WFL1/FeatureServer/17",
               "note": "two dashboard snapshots (July 2023 for 2021-2022, Dec 2025 for 2023-2025); property-damage-only crashes are not included"},
  "schools_ca": {"name": "CDE public school directory", "scope": "state:CA", "status": "ready", "url": "https://www.cde.ca.gov/SchoolDirectory/report?rid=dl1&tp=txt"},
  "schools_national": {"name": "NCES EDGE public school locations (current school year)", "scope": "national", "status": "ready",
                       "url": "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0",
                       "note": "fetch_oc.py fetch_schools outside California (NCES's own ArcGIS Online layer)"},
  "crime_ca": {"name": "CA DOJ Crimes & Clearances by agency", "scope": "state:CA", "status": "ready", "url": "https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Crimes_and_Clearances_with_Arson-1985-2025.csv"},
  "crime_national": {"name": "FBI Crime Data Explorer (agency level)", "scope": "national", "status": "key", "url": "https://api.usa.gov/crime/fbi/cde/", "note": "needs an api.data.gov key"},
  "fire_ca": {"name": "CAL FIRE Fire Hazard Severity Zones (SRA 2023, LRA 2025)", "scope": "state:CA", "status": "ready", "url": "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services"},
  "fire_national": {"name": "USFS Wildfire Hazard Potential", "scope": "national", "status": "none",
                    "url": "https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/5",
                    "note": "candidate checked 6 Nov 2026: Esri's block-group summary of USFS WHP gives MIN/MAX/MEAN only, not the share of a block group in the highest class that the engine's fire metric uses (CAL FIRE Very High share); the USFS rasters (imagery.geoplatform.gov) are on a host not allowed here. Fire stays absent outside CA"},
  "transit": {"name": "GTFS feeds from the MobilityData catalog (mirrored on storage.googleapis.com)", "scope": "national", "status": "ready",
              "url": "https://storage.googleapis.com/mdb-csv/sources.csv",
              "note": "fetch_oc.py fetch_gtfs_mdb: active feeds overlapping the county, one per provider, schedules ended over a year ago skipped; bus departures 07:00-09:00 on one weekday per feed. Orange County keeps its OCTA feed"},
  "tax_shares_ca": {"name": "County Auditor-Controller tax-rate-area factors + BOE TRA map", "scope": "state:CA", "status": "adapter", "url": "https://services7.arcgis.com/iwxhJVOFEKDxO7gk/arcgis/rest/services", "note": "BOE publishes TRA maps for every CA county; each Auditor's factor report format differs (OC parser written)"},
  "assessor": {"name": "County Assessor parcels/sales", "scope": "county", "status": "adapter", "note": "LA County: ready (page inventory); others vary"},
  "city_311": {"name": "City 311 service requests", "scope": "county", "status": "none", "note": "LA City only so far"},
}
COUNTY_EXTRA = {   # county-specific sources already built (FIPS -> list of source ids and notes)
  "06037": {"built": True, "page": "embedded (LA bundle)", "sources": ["assessor", "city_311", "speed_humps:LADOT", "channels:LA County Public Works", "trails:LA County Countywide Trails", "tax_shares:AF49"]},
  "06059": {"built": True, "page": "embedded (bundle-oc)", "sources": ["tax_shares_ca", "street_trees:Anaheim", "channels:OCFCD maintenance roads", "bikeways:OCPW 2024", "transit:OCTA GTFS", "funding:OCTA M2"]},
}


# openstreetmap.fr sub-state extracts that cover one county (or a few): much smaller than the state file; still clipped
SUBREGION = {"17031": "us-midwest/illinois/cook", "08031": "us-west/colorado/denver", "26163": "us-midwest/michigan/detroit_metro",
             **{f: "us-northeast/new-york/new_york_city" for f in ("36005", "36047", "36061", "36081", "36085")},
             **{f: "us-northeast/new-york/long_island" for f in ("36059", "36103")}, "51059": "us-south/virginia/fairfax"}


AUTO_SUBREGION = json.load(open(os.path.join(DATA, "osm_subregions.json"))) if os.path.exists(os.path.join(DATA, "osm_subregions.json")) else {}   # osm_regions.py


OSM_SPLIT = json.load(open(os.path.join(DATA, "osm_split.json"))) if os.path.exists(os.path.join(DATA, "osm_split.json")) else {}   # osm_split.py
NO_OSM = {"AK": "openstreetmap.fr publishes no Alaska extract (us-west stops at the Canadian border) and no other OSM download host is reachable here",
          "HI": "openstreetmap.fr publishes no Hawaii extract and no other OSM download host is reachable here"}


def osm_source(st, name, fips):
    if st in NO_OSM:
        return {"url": None, "clip": True, "missing": NO_OSM[st]}
    if st == "PR":
        return {"url": "https://download.openstreetmap.fr/extracts/central-america/puerto_rico-latest.osm.pbf", "clip": True}
    if fips not in SUBREGION and fips in AUTO_SUBREGION and st != "CA":   # smallest openstreetmap.fr extract whose polygon contains the county
        return {"url": f"{OSMFR}{AUTO_SUBREGION[fips]}-latest.osm.pbf", "clip": True}
    if fips in SUBREGION:
        return {"url": f"{OSMFR}{SUBREGION[fips]}-latest.osm.pbf", "clip": True}
    if st == "CA":
        slug = name.replace(" County", "").lower().replace(" ", "_")
        return {"url": f"{OSMFR}us-west/california/{slug}-latest.osm.pbf", "clip": False}
    if st in STATE_FILE:
        return {"url": f"{OSMFR}{STATE_FILE[st]}-latest.osm.pbf", "clip": True}
    if st in OSM_SPLIT:   # cut once from the regional file by osm_split.py into cache/osm_states; each county is clipped from it like a state file
        return {"url": f"{OSMFR}{REGION[st]}-latest.osm.pbf", "clip": True, "split": OSM_SPLIT[st]["split"], "timestamp": OSM_SPLIT[st]["timestamp"]}
    return {"url": f"{OSMFR}{REGION[st]}-latest.osm.pbf", "clip": True}


def built_info(fips):
    """a county built by the national pipeline: bundle size, block groups, build date (pipeline/data_<fips>/bundle-oc.b64 + metrics.json)"""
    d = os.path.join(HERE, "pipeline", "data" if fips == "06059" else f"data_{fips}")
    b = os.path.join(d, "bundle-oc.b64")
    if not os.path.exists(b):
        return None
    out = {"bundle": os.path.relpath(b, HERE), "mb": round(os.path.getsize(b) / 1e6, 1), "date": __import__("time").strftime("%Y-%m-%d", __import__("time").localtime(os.path.getmtime(b)))}
    try:
        out["block_groups"] = len(json.load(open(os.path.join(d, "metrics.json")))["metrics"])
    except Exception:
        pass
    sites = f"/home/user/w5/county_sites/sites_{fips}.json"
    out["sites"] = os.path.exists(sites)
    return out


def main():
    os.makedirs(DATA, exist_ok=True)
    z = zipfile.ZipFile(os.path.join(DATA, "gaz_counties_2025.zip"))
    rows = list(csv.DictReader(io.TextIOWrapper(z.open(z.namelist()[0]), encoding="utf-8"), delimiter="|"))
    out = {}
    for r in rows:
        r = {k.strip(): (v or "").strip() for k, v in r.items()}
        st, fips, name = r["USPS"], r["GEOID"], r["NAME"]
        lat, lon = float(r["INTPTLAT"]), float(r["INTPTLONG"])
        src = ["blockgroups", "acs", "places", "osm", "parks_national", "ev", "tree_equity", "transit"]
        src += ["crash_ca", "schools_ca", "crime_ca", "fire_ca", "tax_shares_ca"] if st == "CA" else ["crash_national", "schools_national", "crime_national", "fire_national"]
        if "crash_" + st.lower() in SOURCES and st != "CA":   # a statewide crash adapter (IL, VA, UT, PA, TN)
            src.append("crash_" + st.lower())
        osm = osm_source(st, name, fips); no_osm = {"osm"} if osm.get("missing") else set()
        out[fips] = {"fips": fips, "state": st, "state_fips": fips[:2], "county_fips": fips[2:], "name": name, "lat": lat, "lon": lon,
                     "land_sqmi": float(r["ALAND_SQMI"] or 0), "osm": osm, "sources": src,
                     "ready": [s for s in src if SOURCES[s]["status"] == "ready" and s not in no_osm],
                     "missing": [s for s in src if SOURCES[s]["status"] in ("host", "key", "none") or s in no_osm],
                     **({"extra": COUNTY_EXTRA[fips]} if fips in COUNTY_EXTRA else {}),
                     **({"built": built_info(fips)} if built_info(fips) else {})}
    json.dump(out, open(os.path.join(DATA, "counties.json.tmp"), "w"), indent=0)   # replaced in one step: running builds read it
    os.replace(os.path.join(DATA, "counties.json.tmp"), os.path.join(DATA, "counties.json"))
    json.dump(SOURCES, open(os.path.join(DATA, "sources.json"), "w"), indent=1)
    ca = [c for c in out.values() if c["state"] == "CA"]
    print("built:", sorted(f for f, c in out.items() if c.get("built")))
    print("counties", len(out), "states", len({c['state'] for c in out.values()}), "CA", len(ca), "CA fully sourced (all core adapters ready):", sum(1 for c in ca if not c["missing"]))


if __name__ == "__main__":
    main()
