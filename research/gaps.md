# City Pretty: Research Verification & Data Gaps Report (November 2026)

This document accompanies the 18 verified CSV data files generated for the City Pretty national data pipeline. Every item has been audited against primary public sources, official open-data endpoints, peer-reviewed journals, and university/federal working papers.

---

## 1. What Could Not Be Found (Data Gaps)

### Topic 1: Crime Rates & Police Coverage Outside California
- **FBI Crime Data Explorer (CDE) Agency Population Counts**: While national and state totals for 2023–2025 are available, direct machine-readable endpoints providing annual population baselines mapped to every reporting agency ORI were not found in the public API.
- **Statewide Police Coverage Rosters (26 States)**: Official place-to-police-department crosswalks were not found for: Arkansas, Delaware, Georgia, Indiana, Iowa, Kentucky, Louisiana, Maryland, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Mexico, New York, North Dakota, Ohio, Oklahoma, South Carolina, Tennessee, Virginia, West Virginia, Wyoming, District of Columbia, and Puerto Rico. In these states, municipal policing status must be inferred from LEAIC or municipal incorporation status.

### Topic 2: Pedestrian and Bicycle Crashes
- **Statewide Geocoded Non-Fatal Crash Feeds**: 17 states/territories lack open, queryable, row-level crash endpoints with geocoded coordinates covering non-fatal pedestrian/cyclist injuries (AL, AR, HI, ID, IN, KS, MS, MT, ND, NE, OK, PR, SC, SD, VT, WV, WY). In these jurisdictions, City Pretty must fall back to NHTSA FARS (fatal crashes only) or municipal portals.
- **Standardized Severity Coding**: Delaware (production Socrata), Indiana (IMPD), and several municipal layers omit data dictionary documentation defining whether minor injuries vs. serious injuries (KABCO scale) are separated from property-damage-only incidents.

### Topic 3: GTFS Schedule Feeds
- **Unreachable / Expired GTFS Endpoints**: 18 counties that show no transit in existing bundles lack current, downloadable GTFS zip feeds. Specific operators without reachable feeds include:
  - Pulaski County, AR (Rock Region METRO): GTFS endpoint unresolved.
  - Nueces County, TX (TxDOT Port Aransas Ferry & Fisherman's Wharf): No GTFS feed exists.
  - Cameron County, TX (Brownsville Metro): No open GTFS URL found.
  - Escambia County, FL (ECAT): Feed missing from county portal.
  - Shelby County, TN (MATA Rail): Bus feed verified, but rail/streetcar operations remain in operational conflict with FY26 budget assumptions.

### Topic 4: Construction Costs by Region
- **Missing Awarded Unit Contracts for 6 Standard Items**:
  - `street_tree` (with 3-year establishment watering): Only bid schedules found (e.g. Stillwater MN, $1,007/tree); awarded contracts either cap compensation without watering or combine park/street trees.
  - `crosswalk` (high-visibility thermoplastic): Only submitted bid tabs found (e.g. Ogden UT, $218/ea); no awarded contract confirmed.
  - `protected_bike_lane`: No awarded unit price per mile for a standardized curb-protected lane package was recovered (corridor reconstruction projects combine paving, drainage, and utilities).
  - `red_bus_lane`: No verified awarded contract per lane-mile with defined width/thermoplastic coating was recovered.
  - `bioswale_extension`: No verified each-price for an engineered bioswale curb extension package was found.
  - `undergrounding`: No awarded per-mile overhead-to-underground conversion contract was recovered (utility estimates and capital budgets are projections, not awarded unit bids).
- **State DOT Cost Indexes**: CDOT (Colorado) and Caltrans (California) publish index dashboards, but current machine-readable quarterly numeric factor tables were not accessible.

### Topic 5: Home-Value Effects Outside California
- **Project Types Without US Peer-Reviewed Studies**:
  - `street_lighting`: No US hedonic study isolating property value gains from new/upgraded street lighting was identified (studies focus on night-time crime reduction rather than capitalization).
  - `traffic_calming`: Speed hump / traffic calming capitalization studies in the US were not found.
  - `freeway_cap` / deck parks: No controlled repeat-sales or hedonic studies found.
  - `undergrounding` (power lines): US studies not found; supplemented with French rural corridor evidence.
  - `plaza` / pedestrian plazas: No hedonic property value study identified.
  - `foot_patrol` / `violence_interruption`: Crime reductions are documented in criminological literature, but direct capitalization into home prices was not measured.

### Topic 6: Planned Transit Lines & Timing
- **Station Coordinates**: Full GIS coordinate datasets (shapefiles/GeoJSON) for planned stations across the 116 urban projects and 72 FRA corridor selections are not published in public FTA CIG profiles or FRA notifications; only station names or general corridors are listed.
- **Stage Timing Studies**: Studies isolating price movements across all 5 discrete stages (announcement, funding, construction start, opening, post-opening) were not found for Denver FasTracks, Houston METRORail, Salt Lake TRAX, Utah FrontRunner, Silver Line, and Honolulu Skyline.

### Topic 7: Rail, Transmission, and Freeways
- **Isolated Trackside Nuisance Penalty for HSR**: Studies consistently measure station accessibility benefits (which decay with distance from stations), but an isolated trackside noise/vibration discount along rural or non-station corridor segments was not isolated in the opened primary literature.

### Topic 8: Parcel (Lot Line) Services
- **Assessed Values in GIS Layers**: In Texas, New Hampshire, and Pennsylvania, GIS parcel services expose boundary geometry and parcel IDs, but assessed land and improvement values are maintained in separate CAMA databases that require tabular joins.

### Topic 9: Vacant and Surplus Land
- **Open Surplus Land Inventories**: While 97 datasets were verified across 100 cities, cities including New York (COLP lacks surplus flag), Phoenix, Houston, and Dallas lack dedicated open public surplus real estate registries.

### Topic 10: Home Price and Rent Data
- **Redistribution / Display Terms**: County-level parcel transaction feeds in Cook County (IL), Hillsborough (FL), Pierce (WA), Franklin (OH), and Pasco (FL) provide warranty disclaimers but lack express open-license grants for public web display. Fairfax County (VA) explicitly restricts data to internal/personal use.

### Topic 11: Tree Canopy & Summer Heat
- **Ready-to-Use National Summer Heat Raster**: USGS Landsat 8/9 Level-2 Surface Temperature provides raw scene observations at 30 m, but a pre-computed, cloud-masked, contiguous US summer heat composite ready for block-group zonal statistics is not published by USGS.

### Topic 12: Municipal GIS Data
- **Sidewalk and Tree Inventories**: 34 of the 50 audited cities lack dedicated sidewalk centerline or street tree point layers, publishing only curb-to-curb street centerlines.

---

## 2. What Needs a Human / Credentials (Logins, API Keys, MOUs)

1. **Transitland v2 API Key**: Required to query non-MobilityData GTFS feeds programmatically.
2. **State DOT Secure Crash Portals**: North Dakota, Wyoming, South Carolina, Mississippi, and Arkansas require registered agency accounts or Data Sharing Agreements (MOUs) to download complete geocoded incident tables.
3. **Police Troop Patrol Boundaries**: Pennsylvania State Police, Maine State Police, Vermont State Police, and Massachusetts State Police do not publish troop coverage GIS boundaries as open REST layers; obtaining GIS shapefiles requires formal open-records requests (RTKL / FOIA).
4. **Socrata App Tokens (`X-App-Token`)**: Required to avoid rate-limiting (HTTP 429 / 503) during bulk county pipeline execution.
5. **Census & BEA API Keys**: Recommended for automated extraction of ACS 5-year block group statistics and Regional Price Parities.

---

## 3. Contradictions with Attached Research Leads

1. **Maine State Police Coverage**: Attached research reported this source as blocked ("HTTP 403"). Testing verified that the endpoint is reachable (HTTP 200) under standard browser headers, though automated Python user agents without custom headers are blocked.
2. **Texas StratMap Parcel Service**: Attached research claimed "Supported Operations omit Query". Live probing of `https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/0?f=json` confirmed `Capabilities: Query,Map` with `maxRecordCount: 2000` and 38 queryable fields.
3. **Stillwater MN Tree Replacement Costs**: The attached research cited a $176,358 total as an awarded tree planting cost ($1,007/tree). Official council minutes verify the planting contract was capped at $120,533, and 3-year establishment watering ($55,825) was excluded from the grant award.
4. **Brightline Florida Price Effect**: Attached research cited an academic journal paper, but primary verification identifies the document as an industry research report from the University of Florida Bergstrom Real Estate Center.
5. **NYC Open Crash Data Service Intermittency**: Automated queries to Socrata endpoint `h9gi-nx95` intermittently returned HTTP 503 Service Unavailable under burst queries, requiring retry backoff.

---

## 4. Pipeline Integration & Next Steps (Claude Code / City Pretty Pipeline)

### File Layout
All 18 generated CSV files are saved in `/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-data/`:
1. `crime_sources.csv` (51 rows)
2. `police_coverage.csv` (64 rows)
3. `crash_sources.csv` (56 rows)
4. `gtfs_feeds.csv` (46 rows)
5. `cost_factors.csv` (8 rows)
6. `unit_costs.csv` (32 rows)
7. `effects.csv` (40 rows)
8. `transit_projects.csv` (188 rows)
9. `transit_stations.csv` (172 rows)
10. `price_timing.csv` (13 rows)
11. `corridors.csv` (35 rows)
12. `parcel_services.csv` (115 rows)
13. `vacant_land.csv` (118 rows)
14. `price_data.csv` (16 rows)
15. `canopy_heat.csv` (10 rows)
16. `city_data.csv` (250 rows)
17. `ca_sheriff_cities.csv` (22 rows)
18. `location_types_verified.csv` (46 rows)

### Recommendations for Pipeline Enhancements

#### A. Compound / Package Interventions
Currently, `pipeline/engine.py` evaluates project types largely independently. To capture the compounding value of combined interventions (e.g. street trees + traffic calming + sidewalk repair along school walk corridors):
- Add a multi-project synergy factor $\sigma \in [1.10, 1.25]$ in `engine.py` when complementary interventions occur in the same block group within 400 m of schools or transit stops.
- This accurately reflects parent/family willingness to pay for safe, shaded, walk-to-school routes.

#### B. Eliminating the "Farmers Market" Universal Recommendation
- In existing pipeline rounds, "weekly farmers market" is frequently recommended across hundreds of block groups because its modeled cost is low ($10,000–$25,000/yr operating) and measured effect is positive.
- Update `engine.py` scoring:
  1. Check existing USDA Farmers Market Directory / OpenStreetMap `amenity=marketplace` within 3 miles. If one exists, suppress the project.
  2. Subordinate low-capital programming projects to structural capital improvements (trees, sidewalks, lighting, road diets) where baseline infrastructure deficits are severe (e.g. tree canopy < 15% or zero sidewalks).

#### C. Coastal vs. Inland Neighborhood Improvements
- **Coastal Block Groups**: Using Census TIGER / OSM coastline boundaries within 1,000 ft, trigger coastal-specific projects:
  - Beach nourishment / widening
  - Public beach volleyball courts and promenade seating
  - Dune restoration / living shorelines (from `location_types_verified.csv`, `living_shoreline`)
- **Inland / Hillside Block Groups**: In foothill or suburban locations (e.g. Santa Clarita, Boise, suburban Denver), trigger:
  - Multi-use trailheads and mountain bike trail construction on municipal open space
  - Wildfire defensible space and home hardening (from `location_types_verified.csv`, `wildfire_hardening`)


### Texas Building Footprints and LiDAR Access (TxGIO / TNRIS)
- **API Resource**: `https://api.tnris.org/api/v1/resources/` feeds AWS S3 URLs for compressed data collections via the TNRIS bulk-downloader utility (`https://github.com/TNRIS/bulk-downloader`).
- **Service Gap**: Direct anonymous public ArcGIS ImageServer for statewide lidar height or single-endpoint FeatureServer for statewide building footprints is not published without collection-by-collection scripted retrieval.
