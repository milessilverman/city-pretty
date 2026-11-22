# Station-area redevelopment sites (22 Nov 2026)

What this adds: a measured list of land near stations that could be redeveloped (surface parking lots, vacant or brownfield land, golf courses), for the places in section 2, with each lot's size taken from its OpenStreetMap outline and its parcel facts taken from the county's parcel service where one is on file. It is an inventory of candidates, not a recommendation: section 8 lists what it cannot say. The data is in `app/data/station_sites/` (one file per county plus `index.json`), loaded for a county when it is opened; the page lists it in the Invest view's Properties card and passes each site to the project card engine as a site subject.

Everything below was fetched or computed on 22 Nov 2026 from this machine. Files: `pipeline/station_sites_scope.py` (what is covered), `station_sites_groups.py`, `station_sites_osm.py` (OpenStreetMap candidates), `station_sites_parcels.py` (parcel lookups), `station_sites_build.py` (county files), `station_sites_stats.py`, `station_sites_recheck.py` (sample re-check); `src/engines/stationSites.js` (loader); `tests/unit/stationSites.test.ts`; `scripts/live_check_station_sites.mjs`. Work files (extracts, caches) were kept outside the repository.

## 1. Results at a glance

- **8,763 candidate sites** found within range of the stations and stop cities that were searched (26,385 acres in the 7,138 largest per county that were looked up in parcel services; see 4). 7,098 are in the county files (each file is kept under 300 KB, largest sites first; the rest are counted in the file as left out).
- By type (the 7,138 looked up): surface parking 6,323 (12,049 acres), vacant or brownfield land 736 (4,863 acres), golf courses 79 (9,473 acres).
- By station class, nearest anchor first (a lot within range of two kinds of anchor is counted once, under the nearer): existing rail stations 5,653, stations of local projects on file 183, corridor stop-city centres 1,302. Counting every lot within range of each class: 5,672, 194 and 1,408.
- Parcel match: a parcel record was found at the interior point for 6,462 of 7,138 (90.5%); 530 points fell where the service has no parcel (road, water, or outside the service's area); 146 service errors.
- Of the parcels found, 2,471 are between 0.5 and 2 times the OpenStreetMap outline's area; **3,991 (61.8%) are outside that range** (3,087 larger than 2x, 886 smaller than 0.5x), so their assessed values were withheld (the value is for the whole parcel).
- Sample re-check (section 5): parcel service asked again for 30 random records, **0 of 30 differ** (0%); 20 random OpenStreetMap elements looked up again by id in the main OpenStreetMap database, **0 of 20 differ** (0%).

## 2. Exactly what was processed

### (a) Stations of the local projects in `app/data/transit_pipelines.json`: 30 stations, 0.5 mile

Every station that has a point. Many of these points are marked in the project record as unverified or illustrative (`verified: false`); the site records say so ("the project's own record marks this stop location as unverified").

| County | Project | Station | Location verified in the project record | Sites within 0.5 mile (found; counted under the nearest anchor) |
|---|---|---|---|---|
| 48453 | Austin Light Rail Phase 1 (Project Connect) | Downtown / Congress | no | 11 |
| 48453 | Austin Light Rail Phase 1 (Project Connect) | Waterfront / Lady Bird Lake | no | 11 |
| 48453 | Austin Light Rail Phase 1 (Project Connect) | South Congress / Travis Heights | no | 2 |
| 48453 | Austin Light Rail Phase 1 (Project Connect) | East Riverside & Pleasant Valley (Hub) | no | 6 |
| 48453 | Austin Light Rail Phase 1 (Project Connect) | Montopolis / Crossing Place | no | 9 |
| 48453 | Austin Light Rail Phase 1 (Project Connect) | Yellow Jacket / Riverside Terminus | no | 2 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Wilshire / Western (D Line) | yes | 4 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Wilshire / La Brea (Anchor Hub) | yes | 0 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Wilshire / Fairfax (Museum Row) | yes | 1 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Wilshire / La Cienega | yes | 2 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Century City / Constellation | yes | 4 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Westwood / UCLA | yes | 6 |
| 06037 | Metro D Line (Purple Line) Subway Extension & Station Joint Development | Westwood / VA Hospital | yes | 22 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | SARTC Transit Center (Anchor Hub) | yes | 0 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | Downtown Santa Ana / 4th St | no | 13 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | Civic Center / Santa Ana Blvd | no | 8 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | Pacific Electric ROW / Fairview | no | 13 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | Harbor Blvd Transit Transfer | no | 3 |
| 06059 | OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center | Garden Grove / Harbor Terminus | no | 1 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Broadway (Civic Center) | no | 34 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Downing | no | 10 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Josephine | no | 5 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Colorado (Anchor Hub) | no | 6 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Monaco | no | 4 |
| 08031 | East Colfax Center-Running Bus Rapid Transit & Station Infill | Colfax & Yosemite / Aurora | no | 4 |
| 17031 | CTA Red Line Extension to 130th St & Far South Side Equitable TOD | 95th / Dan Ryan Multimodal Terminal | yes | 3 |
| 17031 | CTA Red Line Extension to 130th St & Far South Side Equitable TOD | 103rd Street Station | no | 12 |
| 17031 | CTA Red Line Extension to 130th St & Far South Side Equitable TOD | 111th Street Station | no | 12 |
| 17031 | CTA Red Line Extension to 130th St & Far South Side Equitable TOD | Michigan Avenue / 116th St | no | 3 |
| 17031 | CTA Red Line Extension to 130th St & Far South Side Equitable TOD | 130th Street Terminal (Anchor Hub) | no | 3 |

### (b) Corridor stop cities (`app/data/intercity_transit_corridors.json`): 1 mile, stop-city centre, not a station site

The file lists 314 stops in 219 distinct places. The parcel registry (the page's `parcelSvc()`: a county's own service, else its state's statewide service; Los Angeles and Orange County have their own lookups) covers 148 of them that also have a Census place id and population; 68 have no parcel service on file and were not processed. Ranked by 2020 Census population (TIGERweb `POP100`, fetched), **the 40 largest were targeted.** Searched: 40 of 40. The anchor is the Census internal point of the place: **stop city centre, not a station site.**

| Rank | Stop city | Population (2020) | County | Corridors | Searched | Sites within 1 mile (found; under the nearest anchor) |
|---|---|---|---|---|---|---|
| 1 | New York | 8,804,190 | 36047 | Adirondack Corridor; Amtrak to Long Island; Daily Cardinal Service; Empire Corridor; Green | yes | 0 |
| 2 | Los Angeles | 3,898,747 | 06037 | California High-Speed Rail Phase 1 Corridor; Coachella Valley Rail Corridor; Daily Sunset  | yes | 17 |
| 3 | Chicago | 2,746,388 | 17031 | Big Sky North Coast Corridor; Chicago to Carbondale Corridor; Chicago to Grand Rapids Corr | yes | 33 |
| 4 | Houston | 2,304,580 | 48201 | Amtrak Texas High-Speed Rail Corridor; Daily Sunset Limited Service; Fort Worth to Houston | yes | 37 |
| 5 | Phoenix | 1,608,139 | 04013 | Phoenix-Tucson Corridor | yes | 16 |
| 6 | Philadelphia | 1,603,797 | 42101 | Daily Cardinal Service; Keystone Corridor: Pittsburgh to Philadelphia; Reading-Philadelphi | yes | 13 |
| 7 | San Antonio | 1,434,625 | 48029 | Daily Sunset Limited Service; Houston to San Antonio Corridor | yes | 8 |
| 8 | San Diego | 1,386,932 | 06073 | Los Angeles-San Diego-San Luis Obispo (LOSSAN) Rail Corridor | yes | 14 |
| 9 | Dallas | 1,304,379 | 48113 | Amtrak Texas High-Speed Rail Corridor; Fort Worth to Houston High-Speed Rail Corridor; I-2 | yes | 18 |
| 10 | Jacksonville | 949,611 | 12031 | Jacksonville-Orlando-Miami Corridor | yes | 73 |
| 11 | Fort Worth | 918,915 | 48439 | Fort Worth to Houston High-Speed Rail Corridor; Heartland Flyer Extension; I-20 Corridor I | yes | 23 |
| 12 | Columbus | 905,748 | 39049 | Chicago, Fort Wayne, Columbus, and Pittsburgh; Cleveland-Columbus-Dayton-Cincinnati (3C&D) | yes | 35 |
| 13 | Indianapolis | 887,642 | 18097 | Daily Cardinal Service; Indianapolis-Chicago Corridor; Louisville-Indianapolis Passenger R | yes | 144 |
| 14 | Charlotte | 874,579 | 37119 | Charlotte to Kings Mountain, North Carolina, Corridor; Charlotte, North Carolina, to Atlan | yes | 88 |
| 15 | Seattle | 737,015 | 53033 | Amtrak Cascades Corridor; Big Sky North Coast Corridor; Cascadia High-Speed Ground Transpo | yes | 11 |
| 16 | Denver | 715,522 | 08031 | Colorado Front Range Corridor | yes | 29 |
| 17 | Washington | 689,545 | 11001 | Amtrak to Long Island; Charlotte, North Carolina, to Washington, D.C., Corridor; Daily Car | yes | 29 |
| 18 | Nashville | 689,447 | 47037 | Atlanta-Chattanooga-Nashville-Memphis Corridor | yes | 85 |
| 19 | Boston | 675,647 | 25025 | Boston and Albany Corridor; Downeaster Corridor | yes | 3 |
| 20 | Portland | 652,503 | 41051 | Amtrak Cascades Corridor; Big Sky North Coast Corridor; Cascadia High-Speed Ground Transpo | yes | 49 |
| 21 | Las Vegas | 641,903 | 32003 | Brightline West High-Speed Corridor | yes | 3 |
| 22 | Detroit | 639,111 | 26163 | Cleveland-Toledo-Detroit Corridor; Wolverine Corridor | yes | 30 |
| 23 | Memphis | 633,104 | 47157 | Atlanta-Chattanooga-Nashville-Memphis Corridor | yes | 11 |
| 24 | Baltimore | 585,708 | 24510 | Daily Cardinal Service | yes | 75 |
| 25 | Milwaukee | 577,222 | 55079 | Big Sky North Coast Corridor; Milwaukee to Chicago Hiawatha Service Expansion; Milwaukee t | yes | 35 |
| 26 | Tucson | 542,629 | 04019 | Daily Sunset Limited Service; Phoenix-Tucson Corridor | yes | 10 |
| 27 | Kansas City | 508,090 | 29095 | Kansas City, MO, to St Joseph, MO | yes | 3 |
| 28 | Atlanta | 498,715 | 13121 | Atlanta to Savannah Corridor; Atlanta-Chattanooga-Nashville-Memphis Corridor; Charlotte, N | yes | 13 |
| 29 | Colorado Springs | 478,961 | 08041 | Colorado Front Range Corridor | yes | 53 |
| 30 | Raleigh | 467,665 | 37183 | Charlotte, North Carolina, to Washington, D.C., Corridor; Fayetteville to Raleigh, North C | yes | 67 |
| 31 | Miami | 442,241 | 12086 | Jacksonville-Orlando-Miami Corridor; Miami-Orlando-Tampa Corridor | yes | 6 |
| 32 | Minneapolis | 429,954 | 27053 | Milwaukee-Madison-Eau Claire-Twin Cities Corridor; Northern Lights Express; TCMC Service E | yes | 58 |
| 33 | Arlington | 394,266 | 48439 | Fort Worth to Houston High-Speed Rail Corridor | yes | 3 |
| 34 | Tampa | 384,959 | 12057 | Miami-Orlando-Tampa Corridor | yes | 22 |
| 35 | New Orleans | 383,997 | 22071 | Baton Rouge-New Orleans Corridor; Daily Sunset Limited Service; Gulf Coast Passenger Rail  | yes | 5 |
| 36 | Cleveland | 372,624 | 39035 | Cleveland-Columbus-Dayton-Cincinnati (3C&D) Corridor; Cleveland-Toledo-Detroit Corridor | yes | 20 |
| 37 | Anaheim | 346,824 | 06059 | California High-Speed Rail Phase 1 Corridor | yes | 8 |
| 38 | Riverside | 314,998 | 06065 | Coachella Valley Rail Corridor | yes | 24 |
| 39 | Newark | 311,549 | 34013 | Scranton to New York Penn Station Corridor | yes | 49 |
| 40 | St. Paul | 311,527 | 27123 | Big Sky North Coast Corridor; Eau Claire-Twin Cities Corridor; TCMC Service Expansion via  | yes | 97 |

Not in the 40: Montclair, NJ, Austin, None, San Antonio, None (no Census place id in the stop record, so no population to rank by; Austin and San Antonio stops of the Texas corridors are in counties covered under (a) and (c) anyway).

### (c) Existing rail stations in the 15 largest counties on file: 0.5 mile

The 15 largest by 2020 Census population (TIGERweb `POP100`) among the counties with a data file in `counties/` plus Los Angeles and Orange (`app/data/bundle-la.b64.txt`, `bundle-oc.b64.txt`). Stations are the county data file's `layers.stations` points (rail stations confirmed served).

| County | Population (2020) | Stations | Stations searched | Sites within 0.5 mile (found; counted under the nearest anchor) |
|---|---|---|---|---|
| 06037 Los Angeles County | 10,014,009 | 176 (176 distinct points) | 176 | 950 |
| 17031 Cook County | 5,275,541 | 368 (368 distinct points) | 368 | 2,153 |
| 48201 Harris County | 4,731,145 | 46 (46 distinct points) | 46 | 358 |
| 04013 Maricopa County | 4,420,568 | 66 (66 distinct points) | 66 | 595 |
| 06073 San Diego County | 3,298,634 | 90 (90 distinct points) | 90 | 739 |
| 06059 Orange County | 3,186,989 | 18 (18 distinct points) | 18 | 105 |
| 36047 Kings County | 2,736,074 | 367 (367 distinct points) | 367 | 406 |
| 12086 Miami-Dade County | 2,701,767 | 56 (55 distinct points) | 55 | 141 |
| 48113 Dallas County | 2,613,539 | 83 (83 distinct points) | 83 | 778 |
| 06065 Riverside County | 2,418,185 | 28 (28 distinct points) | 28 | 61 |
| 36081 Queens County | 2,405,464 | 485 (485 distinct points) | 485 | 164 |
| 53033 King County | 2,269,675 | 51 (51 distinct points) | 51 | 465 |
| 32003 Clark County | 2,265,461 | 8 (8 distinct points) | 8 | 75 |
| 06071 San Bernardino County | 2,181,654 | 28 (28 distinct points) | 28 | 166 |
| 48439 Tarrant County | 2,110,640 | 16 (16 distinct points) | 16 | 76 |

## 3. Method

1. **OpenStreetMap geometry.** Where openstreetmap.fr publishes a sub-region extract that holds the county, the extract was downloaded (one at a time, then deleted), cut to the box around the anchors with `osmium extract --strategy smart`, filtered to the tags below and buildings with `osmium tags-filter`, and read with pyosmium (areas assembled from ways and multipolygon relations). Counties whose registry extract is only a split of a 3.8 GB regional file (us-west and some of us-midwest) were read from the `maps.mail.ru` Overpass mirror instead (overpass-api.de and Geofabrik refuse this machine; the mirror answers slowly and often returns 504, so queries are small and retried). Each record keeps its source, URL and data date: extract dates are the files' own replication timestamps, Overpass dates are the mirror's `timestamp_osm_base`.

   | Source | Data date |
   |---|---|
   | overpass/AZ (overpass) | 2026-11-22T08:06:18Z |
   | overpass/DC (overpass) | 2026-11-22T03:24:52Z |
   | overpass/IN (overpass) | 2026-11-22T04:06:35Z |
   | overpass/LA (overpass) | 2026-11-22T04:36:03Z |
   | overpass/MA (overpass) | 2026-11-22T03:34:03Z |
   | overpass/MD (overpass) | 2026-11-22T03:58:21Z |
   | overpass/MN (overpass) | 2026-11-22T07:19:48Z |
   | overpass/MO (overpass) | 2026-11-22T05:17:56Z |
   | overpass/NJ (overpass) | 2026-11-22T04:42:20Z |
   | overpass/NV (overpass) | 2026-11-22T03:52:21Z |
   | overpass/OH (overpass) | 2026-11-22T05:47:20Z |
   | overpass/OR (overpass) | 2026-11-22T03:57:18Z |
   | overpass/PA (overpass) | 2026-11-22T03:37:06Z |
   | overpass/TN (overpass) | 2026-11-22T05:35:06Z |
   | overpass/WA (overpass) | 2026-11-22T07:53:01Z |
   | overpass/WI (overpass) | 2026-11-22T04:43:16Z |
   | us-midwest/illinois/cook (extract) | 2026-11-17T00:48:10Z |
   | us-midwest/michigan/detroit_metro (extract) | 2026-11-21T01:15:33Z |
   | us-northeast/new-york/new_york_city (extract) | 2026-11-19T01:25:58Z |
   | us-south/florida (extract) | 2026-11-21T01:05:35Z |
   | us-south/florida/northeast (extract) | 2026-11-21T01:04:36Z |
   | us-south/georgia/north_metro (extract) | 2026-11-21T01:02:35Z |
   | us-south/north-carolina/north_central (extract) | 2026-11-21T01:06:33Z |
   | us-south/north-carolina/south_central (extract) | 2026-11-21T01:06:33Z |
   | us-south/texas/central (extract) | 2026-11-21T01:04:36Z |
   | us-south/texas/northwest (extract) | 2026-11-21T01:05:35Z |
   | us-south/texas/southeast (extract) | 2026-11-21T01:04:36Z |
   | us-west/california/los_angeles (extract) | 2026-11-21T01:12:34Z |
   | us-west/california/orange (extract) | 2026-11-21T01:14:33Z |
   | us-west/california/riverside (extract) | 2026-11-21T01:10:31Z |
   | us-west/california/san_bernardino (extract) | 2026-11-19T01:13:52Z |
   | us-west/california/san_diego (extract) | 2026-11-21T01:09:31Z |
   | us-west/colorado/denver (extract) | 2026-11-21T01:08:35Z |
   | us-west/colorado/southeast (extract) | 2026-11-21T01:07:35Z |

2. **What counts**, with the tag recorded on each record: surface parking (`amenity=parking` with `parking=surface` or no `parking` tag, no `building` tag); vacant or brownfield land (`landuse=brownfield`, `landuse=greenfield`, `vacant=yes`); golf courses (`leisure=golf_course`). Each must be at least 0.5 acre, computed from the polygon in a local equal-area projection around its centre. **Large single-storey retail with big parking was not built:** no OpenStreetMap tag says "single-storey store with a big lot"; getting there means joining a `shop=*` or `building=retail` object to a nearby lot by guesswork. `access` is kept when tagged (`customers` and `private` lots are on the list but marked).
3. **Distance.** Within 0.5 mile (1 mile for stop cities) of the anchor, measured from the polygon's edge; the record also gives the distance from its interior point to the anchor, and names the nearest anchor and up to three others in range.
4. **Already built on.** A candidate is removed when OpenStreetMap `building` polygons cover more than **20%** of it (building=roof, carport and canopy do not count). Dropped for this reason: AZ 1, MD 1, NV 1, PA 1, TN 2, WA 2, WI 1, cook 7, detroit_metro 6, new_york_city 6, florida 4, northeast 2, north_metro 1, south_central 2, central 1, northwest 9, southeast 6, los_angeles 12, orange 1, riverside 1, san_diego 5, southeast 1. Lots are rarely drawn over buildings in OpenStreetMap, so few are removed; a lot with a building the map does not show is not caught.
5. **Parcel record.** The county's service from `app/data/parcel_services.json` is asked, with the page's own point query, for the parcel that contains the polygon's interior point (at most 2 requests a second per service, 4 tries with a pause, answers cached). Fields are matched from the layer's field list by name; what the service does not give is stored as not on file, with the reason. Recorded: parcel id, owner (only a public agency or company name; a person, trust or estate is stored as a type with no name), the service's own owner-type code if it has one, land use code and text, assessed land value and total value, zoning code, the parcel's area from its returned outline, the service URL and the date. The zoning code is shown but **not** passed to the card engine, which needs a category (residential, commercial) that a code alone does not give.
6. **Mismatch rule.** When the parcel's area is more than 2 times or less than 0.5 times the OpenStreetMap outline's, the record keeps the parcel id, use and owner but the land and total values are withheld: they belong to the whole parcel (the Los Angeles audit did the same).
7. **Size cut.** A county file is kept under 300 KB, largest sites first; parcel lookups were made for the 800 largest per county. Counties where this cut applies say how many were left out.

## 4. Counts by county and type

`Found` is every candidate within range; `In file` is what the 300 KB county file holds (largest first). Kinds and classes are for the sites in the file. P = parking, V = vacant or brownfield, G = golf. Classes: E = existing station, L = local-project station, S = stop-city centre.

| County | Found | In file | P / V / G | E / L / S | Parcel service | Parcel found | Parcel area mismatch |
|---|---|---|---|---|---|---|---|
| 04013 Maricopa County | 611 | 611 | 486 / 124 / 1 | 595 / 0 / 16 | Maricopa County Assessor Parcels | 585 | 383 |
| 04019 Pima County | 10 | 10 | 10 / 0 / 0 | 0 / 0 / 10 | Pima County GIS Parcels | 10 | 9 |
| 06037 Los Angeles County | 1,006 | 800 | 756 / 36 / 8 | 755 / 31 / 14 | own lookup (LA County GIS) | 752 | 426 |
| 06059 Orange County | 151 | 151 | 139 / 10 / 2 | 105 / 38 / 8 | own lookup (OC Public Works parcels) | 151 | 100 |
| 06065 Riverside County | 85 | 85 | 84 / 1 / 0 | 61 / 0 / 24 | Riverside County GIS Parcels | 83 | 44 |
| 06071 San Bernardino County | 166 | 166 | 145 / 20 / 1 | 166 / 0 / 0 | San Bernardino County GIS Parcels | 159 | 91 |
| 06073 San Diego County | 753 | 753 | 736 / 12 / 5 | 739 / 0 / 14 | SanGIS Parcels (hosted by SANDAG) | 740 | 541 |
| 08031 Denver County | 92 | 92 | 86 / 6 / 0 | 0 / 63 / 29 | Colorado Public Parcels (Governor's Office of Information Technology) | 90 | 45 |
| 08041 El Paso County | 53 | 53 | 53 / 0 / 0 | 0 / 0 / 53 | Colorado Public Parcels (Governor's Office of Information Technology) | 53 | 43 |
| 11001 District of Columbia | 29 | 29 | 28 / 1 / 0 | 0 / 0 / 29 | DC Owner Polygons (Common Ownership Layer) + ITSPE / CAMA sales | 28 | 17 |
| 12031 Duval County | 73 | 73 | 71 / 2 / 0 | 0 / 0 / 73 | Florida Statewide Parcels (FGIO / Dept. of Revenue Property Tax Oversight) | 73 | 44 |
| 12057 Hillsborough County | 22 | 22 | 15 / 7 / 0 | 0 / 0 / 22 | Florida Statewide Parcels (FGIO / Dept. of Revenue Property Tax Oversight) | 21 | 8 |
| 12086 Miami-Dade County | 147 | 147 | 124 / 23 / 0 | 141 / 0 / 6 | Florida Statewide Parcels (FGIO / Dept. of Revenue Property Tax Oversight) | 138 | 92 |
| 13121 Fulton County | 13 | 13 | 8 / 5 / 0 | 0 / 0 / 13 | Fulton County OpenData Tax_Parcels | 13 | 6 |
| 17031 Cook County | 2,219 | 800 | 575 / 190 / 35 | 769 / 10 / 21 | Cook County GIS - Current Parcel (cookVwrDynmc layer 44) | 708 | 440 |
| 18097 Marion County | 144 | 144 | 142 / 2 / 0 | 0 / 0 / 144 | Parcel Boundaries of Indiana Current (IGIO Data Harvest) | 137 | 66 |
| 22071 Orleans Parish | 5 | 5 | 3 / 2 / 0 | 0 / 0 / 5 | New Orleans Cadastral Parcels GIS | 5 | 4 |
| 24510 Baltimore city | 75 | 75 | 66 / 9 / 0 | 0 / 0 / 75 | Maryland Parcel Boundaries (MD iMAP / MDP / SDAT) | 75 | 44 |
| 25025 Suffolk County | 3 | 3 | 3 / 0 / 0 | 0 / 0 / 3 | MassGIS Massachusetts Property Tax Parcels (Level 3 + assessor extract) | 3 | 2 |
| 26163 Wayne County | 30 | 30 | 22 / 8 / 0 | 0 / 0 / 30 | City of Detroit Parcels (Current), Office of the Assessor | 25 | 14 |
| 27053 Hennepin County | 58 | 58 | 57 / 1 / 0 | 0 / 0 / 58 | Parcels, Compiled from Opt-In Open Data Counties, Minnesota (MnGeo) | 58 | 29 |
| 27123 Ramsey County | 97 | 97 | 91 / 6 / 0 | 0 / 0 / 97 | Parcels, Compiled from Opt-In Open Data Counties, Minnesota (MnGeo) | 97 | 54 |
| 29095 Jackson County | 3 | 3 | 3 / 0 / 0 | 0 / 0 / 3 | Jackson County GIS Parcels | 2 | 1 |
| 32003 Clark County | 78 | 78 | 66 / 11 / 1 | 75 / 0 / 3 | Clark County Assessor Parcels (Assessor/Layers) | 73 | 55 |
| 34013 Essex County | 49 | 49 | 47 / 2 / 0 | 0 / 0 / 49 | Parcels and MOD-IV Composite of NJ, Web Mercator (NJOGIS) | 49 | 34 |
| 36047 Kings County | 406 | 406 | 336 / 67 / 3 | 406 / 0 / 0 | NYC MapPLUTO (NYC Department of City Planning) | 397 | 223 |
| 36081 Queens County | 164 | 164 | 133 / 29 / 2 | 164 / 0 / 0 | NYC MapPLUTO (NYC Department of City Planning) | 151 | 83 |
| 37119 Mecklenburg County | 88 | 88 | 88 / 0 / 0 | 0 / 0 / 88 | NC OneMap - NC1Map_Parcels (Integrated Cadastral Data Exchange) | 88 | 46 |
| 37183 Wake County | 67 | 67 | 66 / 0 / 1 | 0 / 0 / 67 | NC OneMap - NC1Map_Parcels (Integrated Cadastral Data Exchange) | 67 | 41 |
| 39035 Cuyahoga County | 20 | 20 | 17 / 3 / 0 | 0 / 0 / 20 | Ohio Statewide Parcels Public View (OGRIP) | 20 | 17 |
| 39049 Franklin County | 35 | 35 | 30 / 5 / 0 | 0 / 0 / 35 | Franklin County Auditor Tax Parcel (Parcel_Features) | 34 | 32 |
| 41051 Multnomah County | 49 | 49 | 44 / 5 / 0 | 0 / 0 / 49 | Multnomah County GIS Parcels | 49 | 23 |
| 42101 Philadelphia County | 13 | 13 | 8 / 5 / 0 | 0 / 0 / 13 | Philadelphia Water Department parcels (City of Philadelphia) | 11 | 3 |
| 47037 Davidson County | 85 | 85 | 78 / 7 / 0 | 0 / 0 / 85 | Metro Nashville & Davidson County Parcels | 85 | 43 |
| 47157 Shelby County | 11 | 11 | 10 / 0 / 1 | 0 / 0 / 11 | Shelby County certified tax parcels (City of Memphis GIS) | 11 | 9 |
| 48029 Bexar County | 8 | 8 | 7 / 0 / 1 | 0 / 0 / 8 | Bexar County GIS Parcels | 8 | 3 |
| 48113 Dallas County | 796 | 756 | 698 / 47 / 11 | 738 / 0 / 18 | Dallas County GIS Parcels | 555 | 354 |
| 48201 Harris County | 395 | 395 | 375 / 18 / 2 | 358 / 0 / 37 | Harris County GIS Parcels | 378 | 216 |
| 48439 Tarrant County | 102 | 102 | 93 / 8 / 1 | 76 / 0 / 26 | Tarrant County GIS Parcels | 98 | 57 |
| 48453 Travis County | 41 | 41 | 40 / 0 / 1 | 0 / 41 / 0 | Travis Central Appraisal District parcels (City of Austin copy) | 39 | 28 |
| 53033 King County | 476 | 476 | 434 / 39 / 3 | 465 / 0 / 11 | King County Parcels (King County Assessor / GIS Center) | 283 | 176 |
| 55079 Milwaukee County | 35 | 35 | 11 / 24 / 0 | 0 / 0 / 35 | Wisconsin Statewide Parcels V12 (Statewide Parcel Map Initiative) | 31 | 23 |

### What each parcel service gave (records looked up)

| Service | Looked up | Parcel found | Area mismatch | Owner type | Land value (not withheld) | Zoning | Land use |
|---|---|---|---|---|---|---|---|
| Cook County GIS - Current Parcel (cookVwrDynmc layer 44) | 800 | 708 | 440 | 0 | 268 | 0 | 708 |
| Los Angeles County Assessor parcels (LA County GIS) | 800 | 752 | 426 | 0 | 226 | 0 | 734 |
| Dallas County GIS Parcels | 796 | 584 | 376 | 532 | 0 | 0 | 582 |
| SanGIS Parcels (hosted by SANDAG) | 753 | 740 | 541 | 0 | 197 | 503 | 503 |
| Maricopa County Assessor Parcels | 611 | 585 | 383 | 579 | 0 | 581 | 581 |
| NYC MapPLUTO (NYC Department of City Planning) | 570 | 548 | 306 | 548 | 242 | 548 | 537 |
| King County Parcels (King County Assessor / GIS Center) | 476 | 283 | 176 | 0 | 0 | 0 | 0 |
| Harris County GIS Parcels | 395 | 378 | 216 | 377 | 161 | 0 | 376 |
| Florida Statewide Parcels (FGIO / Dept. of Revenue Property Tax Oversight) | 242 | 232 | 144 | 229 | 88 | 0 | 232 |
| San Bernardino County GIS Parcels | 166 | 159 | 91 | 0 | 31 | 0 | 159 |
| Parcels, Compiled from Opt-In Open Data Counties, Minnesota (MnGeo) | 155 | 155 | 83 | 154 | 72 | 0 | 154 |
| NC OneMap - NC1Map_Parcels (Integrated Cadastral Data Exchange) | 155 | 155 | 87 | 155 | 68 | 0 | 155 |
| Orange County parcels (OC Public Works / ocgis.com) | 151 | 151 | 100 | 0 | 0 | 0 | 0 |
| Colorado Public Parcels (Governor's Office of Information Technology) | 145 | 143 | 88 | 90 | 0 | 84 | 90 |
| Parcel Boundaries of Indiana Current (IGIO Data Harvest) | 144 | 137 | 66 | 0 | 0 | 0 | 137 |
| Tarrant County GIS Parcels | 102 | 98 | 57 | 98 | 41 | 0 | 0 |
| Metro Nashville & Davidson County Parcels | 85 | 85 | 43 | 85 | 42 | 85 | 85 |
| Riverside County GIS Parcels | 85 | 83 | 44 | 0 | 0 | 0 | 0 |
| Clark County Assessor Parcels (Assessor/Layers) | 78 | 73 | 55 | 0 | 0 | 0 | 0 |
| Maryland Parcel Boundaries (MD iMAP / MDP / SDAT) | 75 | 75 | 44 | 0 | 0 | 64 | 65 |
| Parcels and MOD-IV Composite of NJ, Web Mercator (NJOGIS) | 49 | 49 | 34 | 0 | 13 | 0 | 40 |
| Multnomah County GIS Parcels | 49 | 49 | 23 | 0 | 0 | 48 | 49 |
| Travis Central Appraisal District parcels (City of Austin copy) | 41 | 39 | 28 | 0 | 0 | 0 | 0 |
| Franklin County Auditor Tax Parcel (Parcel_Features) | 35 | 34 | 32 | 33 | 0 | 0 | 31 |
| Wisconsin Statewide Parcels V12 (Statewide Parcel Map Initiative) | 35 | 31 | 23 | 31 | 5 | 0 | 14 |
| City of Detroit Parcels (Current), Office of the Assessor | 30 | 25 | 14 | 25 | 11 | 25 | 25 |
| DC Owner Polygons (Common Ownership Layer) + ITSPE / CAMA sales | 29 | 28 | 17 | 28 | 11 | 0 | 28 |
| Ohio Statewide Parcels Public View (OGRIP) | 20 | 20 | 17 | 0 | 0 | 0 | 20 |
| Philadelphia Water Department parcels (City of Philadelphia) | 13 | 11 | 3 | 11 | 0 | 0 | 9 |
| Fulton County OpenData Tax_Parcels | 13 | 13 | 6 | 13 | 0 | 0 | 13 |
| Shelby County certified tax parcels (City of Memphis GIS) | 11 | 11 | 9 | 11 | 0 | 11 | 11 |
| Pima County GIS Parcels | 10 | 10 | 9 | 10 | 0 | 0 | 0 |
| Bexar County GIS Parcels | 8 | 8 | 3 | 8 | 5 | 0 | 8 |
| New Orleans Cadastral Parcels GIS | 5 | 5 | 4 | 0 | 0 | 0 | 0 |
| MassGIS Massachusetts Property Tax Parcels (Level 3 + assessor extract) | 3 | 3 | 2 | 3 | 1 | 0 | 3 |
| Jackson County GIS Parcels | 3 | 2 | 1 | 0 | 0 | 0 | 0 |

Across all lookups: owner type for 3,020 parcels (name stored for 2,562, public agencies and companies only), land value for 1,482, zoning code for 1,949, land use for 5,341.

## 5. Verification

Every record carries: its OpenStreetMap element (`way/<id>` or `relation/<id>`), the source and data date of the extract or mirror (index into the file's `sources`), the matched tags, the parcel service URL and retrieval date (or the reason there is no parcel record). Sample re-check, seed 20261122, `pipeline/station_sites_recheck.py`, details in `data/backtests/station_sites_recheck_2026-11-22.json`:

- **Parcel facts: 30 random records with a parcel record asked again** from the county's service on the same day (fresh query, no cache): parcel id, land use, owner type, zoning, land value, total value and parcel area compared with the file. 30 identical, 0 different, 0 without an answer. **Mismatch rate 0%.** A same-day re-query shows the file holds what the service returned; it cannot show the assessor's roll is right or unchanged over time.
- **OpenStreetMap elements: 20 random records looked up again by id** in the main OpenStreetMap database (api.openstreetmap.org, a second source apart from the extract or Overpass mirror): element still exists, its tags still give the same type and the same matched tag text. 20 same, 0 tags changed, 0 deleted or missing. **Mismatch rate 0%.** For the 17 ways in that sample the area was also recomputed from the way's current nodes with a geodesic area (pyproj): 17 within 2% of the file's acres.
- Unit tests (`tests/unit/stationSites.test.ts`): schema, areas of at least 0.5 acre, every record has verification, no owner string looks like a person's name ("Lastname, Firstname" outside a legal entity's name, or two capitalised words with no company or agency word), values withheld on a mismatch, files under 300 KB, the loader.

## 6. Example: the five largest sites near the Austin light rail stations (Travis County, 48453)

Austin Light Rail Phase 1 (Project Connect) is a planned project; its station points in `transit_pipelines.json` are marked unverified or illustrative, so "near" means near those points.

| # | Type | Acres (OSM outline) | OSM element | Near (distance from interior point) | Parcel | Land use | Owner | Zoning | Land value |
|---|---|---|---|---|---|---|---|---|---|
| 1 | golf course (Riverside Golf Course) | 151.73 | way/30769048 | Montopolis / Crossing Place, 323 m | 287816 (136.93 acres) | not on file | not on file | not on file | not on file |
| 2 | surface parking | 3.44 | way/187669417 | Waterfront / Lady Bird Lake, 441 m | 190741 (6.59 acres) | not on file | not on file | not on file | not on file |
| 3 | surface parking | 3.37 | way/701662566 | East Riverside & Pleasant Valley (Hub), 804 m | 810187 (2.62 acres) | not on file | not on file | not on file | not on file |
| 4 | surface parking | 3.16 | way/187668222 | Waterfront / Lady Bird Lake, 362 m | 190736 (44.79 acres) | not on file | not on file | not on file | withheld: parcel 14.16x the outline |
| 5 | surface parking | 2.6 | way/187669419 | Waterfront / Lady Bird Lake, 510 m | 190749 (16.7 acres) | not on file | not on file | not on file | withheld: parcel 6.42x the outline |

## 7. What blocked coverage

- Every anchor in section 2 was searched.
- **Searched for parking only.** In 9 anchors' clusters the Overpass query for golf courses and brownfield land, or for greenfield and vacant land, still failed after retries, so that kind is missing there (parking was searched): county 04013: 3 station(s) (greenfield and vacant land not searched); county 53033: 5 station(s) (golf courses and brownfield land not searched); county 53033: 1 station(s) (greenfield and vacant land not searched).
- **King County's parcel service** (Washington) answered HTTP 500 "Error performing query operation" to 146 of its 476 lookups after four tries each and a second pass of retries on later runs; those records keep the OpenStreetMap facts with parcel facts not on file and the reason given.
- **Overpass.** The maps.mail.ru mirror returned 504 (gateway time-out) to most queries; a cluster of nearby anchors is searched in a few small queries, each retried up to 6 times. A cluster is marked not searched only if a query still failed, so a gap is never silent. Counties whose registry extract is a split of the 3.8 GB us-west or us-midwest file (Arizona, Washington, Nevada, Ohio, Indiana, Tennessee, Maryland, Minnesota, Missouri, Wisconsin, ...) can only be read this way: the whole regional file is larger than this job's 4 GB limit.
- **No parcel service on file:** 68 stop cities (not processed at all, per the brief).
- **Parcel services without what was asked:** the services for Orange County (id and address only), New Orleans (id and acres), Clark County NV (id and acres), King County WA (id only), Wisconsin (no zoning), Cook County (no owner) and others give no owner, value, use or zoning field; the table in section 4 shows each. Riverside County's and Pima County's layer metadata returns 403 to this machine; their point queries were tried the same way.

## 8. What this inventory cannot say

- **Ownership intent, leases, deed restrictions or encumbrances.** A parking lot may be under a long lease, held for a future project, or owned by a transit agency that wants it for a station. The owner field, where a service has one, names the owner of record only.
- **Contamination.** `landuse=brownfield` is a mapper's tag, not an environmental finding; nothing here says a site is clean or dirty.
- **Whether a lot is required parking for a neighbour.** Zoning or a lease can require a shop, office or church to keep these spaces; OpenStreetMap does not record that.
- **Whether a lot is in use.** A surface lot may be full every day; nothing here measures occupancy.
- **Parcel facts belong to the parcel, not the lot.** Most lots are part of a larger parcel (the mismatch rate above), so the parcel id, owner and use describe the whole parcel, and its value is withheld.
- **Zoning, what could be built, homes, value if built, margin.** None is computed. The zoning code is shown when the service gives one and is not passed to the card engine; the card engine says what it cannot assess.
- **Completeness.** OpenStreetMap is mapped by volunteers: a lot that is not drawn, or drawn as part of a bigger area, is missing; a lot drawn badly has the wrong size. Retail with large parking is not listed (section 3).
- **Station and stop locations.** Planned-project stations are mostly illustrative points; stop cities are Census place points, not stations; existing stations are points from the county data file.
- **Dates.** Extracts are 1 to 5 days old and the Overpass mirror's data is live: anything edited since is not here. Parcel values are as the service returned them on the retrieval date; the service does not always say which assessment year they are for.

## 9. Rebuilding

Work files go in a folder outside the repository. In order: `python3 pipeline/station_sites_scope.py <work>` (anchors; needs TIGERweb), `python3 pipeline/station_sites_groups.py <work>`, `python3 pipeline/station_sites_osm.py <work> <group>` for each group in `<work>/groups.json` (extract groups download one regional file at a time and delete it; Overpass groups cache each finished cluster and can be re-run to retry failed ones), `python3 pipeline/station_sites_parcels.py <work>` (cached; re-run to retry errors), `python3 pipeline/station_sites_build.py <work>`, `python3 pipeline/station_sites_stats.py <work>`, `python3 pipeline/station_sites_recheck.py`. Run Python with `-I`. The 18 extracts came to about 2.9 GB in total (the sum of the files' sizes, rounded, from the servers' headers), downloaded one at a time and deleted after use; the largest was Florida's, 715 MB, and the work folder never held more than one.

## 10. On the page

The Invest view's Properties card lists the county's station-area sites after its existing sites, largest first, each labelled "<type> near <station or stop city>" with "measured from OpenStreetMap and the county parcel record"; opening one shows the facts and not-on-file reasons. The largest 150 per county are listed; the card says how many the county file holds. The same sites are site subjects for the project cards: no homes count, no value-if-built, no margin is shown for them; the card engine reports each course it cannot assess (for example "the zoning code is not on file for this site"). The live check is in `data/backtests/live_check_station_sites_2026-11-22.json` and screenshots (`data/backtests/station_sites_*.png`).
