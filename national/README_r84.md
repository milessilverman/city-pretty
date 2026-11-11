# City Pretty, national build

## Pieces
- `registry.py` builds `data/counties.json`: all 3,222 US counties (Census 2025 Gazetteer). Each entry has:
  - FIPS code, name, centre and land area;
  - its OpenStreetMap extract (`osm.url`, `clip`);
  - the data sources usable there, with `ready` / `missing` lists.
- `data/sources.json` is the source catalogue: national, state-specific or county-specific. Each source has a status:
  - `ready`: adapter written and run;
  - `adapter`: written, not yet run for this county;
  - `host`: needs a host this environment does not allow;
  - `key`: needs an API key;
  - `none`: no source found.
- `pipeline/` is the county pipeline, driven by `CP_FIPS`. `region.py` holds everything county-specific:
  - name, LAT0, the CHP county code and the OSM extract;
  - `COUNTY_OVERRIDES` for county-only adapters, e.g. Orange County's OCGIS cities and parks, OCTA GTFS, Anaheim trees, Section 99 tax shares, OC funding.
- `cache/` holds state-wide downloads shared by every county in a state (ACS tables, TES, CDE schools, DOJ), linked into each county folder.

## Build a county (California)
```bash
cd pipeline && export CP_FIPS=06065          # e.g. Riverside
```
```bash
python3 fetch_oc.py > fetch_$CP_FIPS.log     # block groups, ACS, TIGER lines, places, parks, fire, AFDC, CCRS, TES, OSM extract
```
```bash
python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec
```
The output is `data_<fips>/bundle-oc.b64`. Site suggestions (from /home/user/w5):
```bash
python3 tools/fetch_la.py chargers_county 06065
```
```bash
python3 tools/osm_sites.py ../national/pipeline/data_06065/osm/<name>-latest.osm.pbf ../national/pipeline/data_06065/osm_sites.json
```
```bash
python3 tools/sites.py 06065 <county>_data/sites_06065.json
```
Then add the county to the page:
```bash
python3 tools/combine_sites.py sites.b64 <county sites json> ...
```
```bash
python3 tools/patch5.py in.html sites.b64 <OC bundle> tools/sites_ui.js out5.html
```
```bash
python3 tools/patch6.py out5.html out.html 06073=<bundle.b64> 06065=<bundle.b64> ...
```
Test with:
```bash
node tools/countytest.js <page> <label> <fips> "<County Name>" <block groups>
```
plus `node tools/regress.js <page> <label>` for LA and Orange County.

## Checked so far
- Orange County (06059): the national pipeline reproduces the round-5 bundle exactly. The only differences are `meta.fips` and a corrected parks count.
- San Diego (06073), Riverside (06065), San Bernardino (06071), Ventura (06111): built and tested with `tools/countytest.js` (41/41 each).
- Denver County, CO (08031): built and tested (29/29).
- Round 8:
  - all 58 California counties, the 30 largest counties in TX, FL, GA, NC, IL, MI, NY, VA and CO, and Cook rebuilt with Illinois DOT crashes;
  - the first counties in states cut by `osm_split.py`: Providence RI (38/38 on its own page), Middlesex MA (38/38 on the hosted site), Philadelphia and Allegheny PA;
  - `logs/quality.md` has every built county's checks (block groups vs ACS, Tree Equity coverage, crash geocoding, transit feeds and unknowns, site candidates).
- Round 8.1 (7 Nov 2026):
  - every built county was re-bundled with transit selection 5 and land-only block-group shapes, and California with the injured-person pedestrian/cyclist flags (no failures);
  - batch 3 is complete (the 60 largest counties in the newly covered states) and batch 2 is building;
  - `national_status.py` prints the current totals.
- Round 8.2 (7 Nov 2026):
  - transit selections 6 and 7 (see Transit): every built county was re-checked with `transit7_check.py`, and the counties whose stops changed were re-bundled. `layer_check.py` confirms that no re-bundled county lost map layers against its round-8.1 bundle;
  - batch 2 is complete (90 counties); batch 4, the next 100 largest counties in any state (`us_queue4.txt`), is building with selection 7.
- Round 8.3 (7 Nov 2026):
  - transit selection 8 reads MobilityData's current catalog too (`feeds_v2.csv`), and duplicate route copies now prefer the newer schedule;
  - rail stations mapped as areas are read, and miniature / heritage / zoo railways are dropped (see Rail stations);
  - every built county was re-checked; `transit8_check.py` and `station_scan.py` / `station_scan2.py` listed the counties re-bundled;
  - batch 4 is complete; 338 counties in 41 states and DC; a twelfth regional page (`us-metros-3`).
- Round 8.4 (8 Nov 2026):
  - transit selections 10–16: the representative Wednesday is never a fixed-date holiday and skips other reduced-service days and one-off feed spikes, judged by 07:00–09:00 departures; the counties measured on 11 Nov whose buses or stop layer changed, the batch-5 counties measured then, and every county whose selection-16 day runs other services than the one it was built with (`transit_day_audit.py`, every feed) were re-run;
  - transit selection 9 also saves the stops of every rail route it reads (`transit_rail_stops.json`), and rail stations are confirmed by them (see Rail stations);
  - transit selection 15 names each rail stop after its GTFS parent station, groups a station's platforms and leaves out stops with no boarding or alighting and employee-only stops (`rail15_sim.py` replays the change on every county);
  - every county on the national site is re-bundled with it (`round84_start.sh`, most rail stations first); `station84_review.py` lists the decisions, and the pages wait for that review (`logs/station84_reviewed`). Each refinement of the rule found in the review was replayed on built counties before install and followed by a re-run pass (`rebundle84b.sh` … `rebundle84f.sh`); the bus-weekday fixes by `rebundle84g.sh` … `rebundle84l.sh` (`transit_day_audit.py` replays every feed's weekday choice). Every step is logged in `logs/rebundle84.notes`;
  - batch 5 (the next 150 largest counties, `us_queue5.txt`, starting with San Juan, PR) was built with the new code from the start, all 150, plus Laramie County, WY: 487 pipeline counties, every state with an OpenStreetMap file;
  - `sites.py` no longer stops in a county with no DC fast charger (San Juan); `patch6.py` section 21: station tooltips.

## Outside California (first county built and tested: Denver, CO)
Run the whole build with one command:
```bash
./build_county2.sh <fips>
```
This runs the pipeline, then chargers, OSM sites (clipped) and sites.py; the log goes to `logs/build_<fips>.log`.

What works:
- **OSM:** `osm_regions.py` reads openstreetmap.fr's published extract polygons (`/polygons/<path>.poly`) and TIGERweb county boundaries. It assigns each county in TX, FL, GA, NC, IL, MI, NY, VA and CO to the smallest sub-state extract that fully contains it; 943 counties are placed (`data/osm_subregions.json`), and the rest use their state file. Extracts are clipped to the county box (`osm_extract.py`, `osm_sites.py`). A file shared by several counties is downloaded once per day into `cache/osm` and hard-linked into each county folder.
- **OSM in the other states (round 8):** openstreetmap.fr publishes only four regional files for them (us-northeast 2.0 GB, us-midwest 2.8 GB, us-west 3.8 GB, us-south 4.6 GB). `osm_extract.py` needs node locations for its whole input, which is too much memory for a region, so `osm_split.py <region>` cuts each region once into one file per state:
  - area: the union of the state's county boxes (TIGERweb, one box per polygon part) plus 0.05°, so every county box lies fully inside;
  - `osmium extract -s smart` (osmium-tool from Ubuntu's archive), so ways stay complete and multipolygon relations (parks, lakes) whole;
  - one state per pass, because each extract needs about 4.1 GB (osmium's node-id sets span the whole OSM id range); 50–210 s per state;
  - output: `cache/osm_states/<region>__<state>-latest.osm.pbf`, with the regional file's `.state.txt` (same data timestamp), listed in `data/osm_split.json`.
  - `registry.py` then gives those counties `osm.split`, and `fetch_oc.py` hard-links the state file instead of downloading. The sources table names the regional file and says it was cut by state.
  - `osm_split_all.sh` runs the four regions in turn (download, split, delete the regional file, refresh the registry). Re-run it to refresh the data; a state is re-cut only when the regional timestamp changes.
  - Puerto Rico uses openstreetmap.fr's `central-america/puerto_rico` file. Alaska and Hawaii have no extract on any reachable host: `osm.missing` says so, and `region.py` refuses to build them.
- **Schools:** NCES EDGE public school locations (`fetch_schools`).
- **Crashes:** NHTSA FARS 2023–2024 fatal crashes via the USDOT/BTS NTAD layers (`fetch_fars`). They are downloaded and listed, but not scored: the injury-crash scores and the calming/crossing candidates need state injury records.
- **Tree Equity Score:** per state (`tes_<st>.zip`, `tes/<st>.shp`). TES uses 2010 block-group codes, so a county whose code changed since then (Connecticut's 2022 planning regions, Oglala Lakota SD) gets its TES block groups by location instead: always in Connecticut, elsewhere when its code matches none. FARS is selected by location in Connecticut for the same reason.
- **California-only cache files** (CDE, DOJ, TES-CA) are never linked into other states' folders, and CAL FIRE layers are fetched only for California.

State crash records (`region.STATE_DEFAULTS`, read by `fetch_state_crashes`):
- **Illinois:** IDOT's yearly crash layers, 2016–2025. The 2016–2018 extracts store longitude without its sign; this is fixed on read.
- **Virginia:** VDOT's Full Crash layer, 2017–2025 (no 2016 records exist in it).
- Both include every reportable crash with KABCO injury counts and pedestrian/bicycle flags, so Illinois and Virginia counties get the same crash scores and calming/crossing candidates as California.
- **Round 8, field-mapped sources** (`kind: "arcgis_map"`, read by `pipeline/state_crashes.py`; a new state is a field map in `region.STATE_DEFAULTS`, not new code):
  - **Utah:** UDOT UPlan "Utah Crash Locations", 2019–2025, one layer per year, all reportable crashes with killed, suspected-serious (A), B and C counts and pedestrian/bicyclist flags. Each year layer misses about one day at its edges (1 Jan before 07:00 and 31 Dec after 07:00, as stored).
  - **Pennsylvania:** PennDOT's crash tables on PennShare, 2017–2023, all reportable crashes:
    - 2019–2023: one row per crash (CRN), month and year only, so dates are kept as the first of the month;
    - 2017–2018: the 2017–2021 table, which repeats rows per crash (the copies differ only by about 10 m in coordinates; the first is kept);
    - checked on 4,957 Pittsburgh crashes of 2019 found in both tables: deaths, injured, pedestrian, bicycle and month agree for all, and `MAJOR_INJU` equals "suspected serious injury count > 0".
  - **Tennessee:** the Department of Safety's TITAN records behind its public dashboard, 2021 to 2 Dec 2025 (two snapshots). Injury and fatal crashes only, with pedestrian/pedalcyclist flags and crash severity. Davidson test: 51,299 injury crashes.
  - **Maine:** MaineDOT's "Crash Locations - 10 Years Complete", 2016–2025, all reportable crashes with K/A/B/C counts and pedestrian/bicycle flags (a rolling window, so 2016 will drop out). Portland test box: 11,713 crashes.
  - `STATE_CRASH_SOURCES.md` lists every state: sources in use, partial sources not used and why, official sources on hosts this environment cannot reach, and states with nothing found.
  - Crash counts are raw counts over each source's years and the engine's thresholds are fixed (≥1, ≥2 or ≥3 crashes), so a shorter window (Tennessee 5 years, Pennsylvania 7) means fewer crash-triggered projects than in a 10-year state. The years are stated with every crash number.
- Denver (police reports) and San Francisco (DataSF) use their own county sources.

Shared caches: the Tree Equity Score state files are downloaded once per state into `cache/tes_states` and unpacked once into `cache/tes_unzipped`, and each county links to them. Converting the existing counties freed 4.3 GB.

Still missing outside California, and left empty (never approximated):
- **Crime:** FBI Crime Data Explorer needs an api.data.gov key.
- **Fire hazard:** no layer on an allowed host gives the high-hazard share the engine uses (the Esri block-group WHP summary has only min/max/mean).
- **Transit:** covered nationally through MobilityData (see Transit below); where an operator has no current mirrored feed, bus frequency is shown as unknown, never 0.
- **Injury crashes:** a state source exists for IL, VA, UT, PA, TN and ME (above), plus Denver and San Francisco. No official statewide layer with every needed field was found on an allowed host for any other state (see `STATE_CRASH_SOURCES.md`). Arizona's current layers are on `services6.arcgis.com` and Ohio's on ODOT's own server, neither of which this environment allows.
- **Funding programmes, EIFD-like tax increment, and per-house parcel services:** the page shows notes instead.

## Land-only block-group shapes (round 8.1)
Census block-group shapes include water. `metrics_oc.py` (`land_shapes`) therefore removes mapped water (Census TIGER area hydrography: lakes, reservoirs, bays, ocean, rivers and canals, not swamps) wherever it is 5% or more of a block group's shape:
- acreage, the freeway band (150 m) and the homes-near-a-freeway share then use land only;
- the reference point for distances, and the centre of the 400 m / half-mile buffers, move only if they lay in water.

Tested on Duval County, FL (582 block groups, many on the St. Johns River):
- water was removed from 139 block groups;
- the gap between our acreage and the Census land area fell from 36.5% to 2.1% (90th percentile);
- distances changed only in the ~35 block groups whose point was in water.

Shapes with under 5% water (ponds, creeks) are measured exactly as before, because moving a point for a pond only adds noise (up to 860 m in tests). `metrics.json` coverage records `land_shapes`. Orange County keeps its audited round-5 bundle.

## California pedestrian and cyclist crashes (round 8.1)
CCRS's "motor vehicle involved with" field names only the first object struck, so it misses some crashes: a pedestrian or cyclist hurt after another collision, or cyclists hurt without a motor vehicle.
- `fetch_oc.py ccrs` also saves `ccrs_pedbike_<year>.json`: every collision in CCRS's injured-persons table with an injured or killed person typed Pedestrian (P) or Bicyclist (B), 2016–2025.
- `sources_oc.crash_points` and `sites.py` count a crash as pedestrian/bicycle if either source says so.
- California 2024: 23,425 → 25,662 crashes (+9.5%); Marin 2016–2025: +26%.
- `metrics.json` coverage records `crash_pedbike`, and the sites meta records `pedbike_injured_person_years`.

## Rail stations (round 8.3)
`osm_extract.py` builds the rail-station points that give each block group its distance to rail (`rm`) and the map's stations layer:
- a station node (`railway=station` or `halt`, or `public_transport=station` with `train=yes`);
- a station mapped as an area: its centre, unless a station node is within 150 m. Many networks are mapped this way; before round 8.3 they were missed, e.g. most of DART, and all of Collin County, TX;
- a rail stop position (`railway=stop` with `train`, `light_rail` or `subway=yes`): only where no station is within 300 m.

Not transit, so dropped (`is_transit_station`):
- stations tagged `usage=tourism`, `railway:historic`, `historic=railway_station`, `station=miniature`, `tourism=attraction|museum` or `access=private|no`;
- stations whose name, operator, network, description or note matches miniature, mini train, vintage railroad, heritage rail, excursion, scenic rail, railroad/railway museum, tea garden, steam train, park railroad or park train;
- stations whose operator is a museum or a history organisation (e.g. Dayton History's Carillon Park Railroad);
- zoo and safari trains without a `network` tag;
- station areas without a name.

The extractor prints how many stations came from nodes, areas and stop positions. `station_scan.py` compares every built county's station set under the old and new rules; the counties that differ are re-bundled by `station_all.sh`.

### Confirmed by GTFS rail stops (round 8.4)
Tags alone do not separate every heritage or excursion line from transit (Knoxville's Three Rivers Rambler is tagged like a commuter station). Since round 8.4, `metrics_oc.confirm_rail_stations` checks each station against the stops of rail routes in the county's MobilityData feeds and in Amtrak's national feed (mdb-11). The stops are saved by `fetch_oc.py` in `transit_rail_stops.json` as [lon, lat, name, feed, route type, agency, parent station], from current and stale feeds alike (selection 9). Since selection 15 a platform listed under a GTFS parent station takes the station's name and id (WMATA's "Archives, Green/Yellow Line Center Platform" is Archives; VRE's tracks "1" to "4" are their stations), a station's platforms are added once at their centre, and stops where no train lets passengers on or off (pickup and drop-off type 1 on every visit: maintenance facilities, crew relief points) or named for employees only are left out.

A station is kept when:
1. a GTFS rail stop is within 400 m, or a rail stop of the same name lies 1 to 15 km away, so one of the two positions is wrong (Metrolink's feed puts "Moreno Valley / March Field" at Riverside–Hunter Park/UCR); the OpenStreetMap station counts;
2. or it is a named subway, light-rail or monorail station (`station=` / `subway=` / `light_rail=` / `monorail=`) of a named network or operator that:
   - is not an amusement park, fair, zoo, museum, farm, shop or resort (e.g. Jungle Jim's International Market's monorail, Waldameer & Water World's train);
   - is not an airport people mover (operator or network naming an airport or aviation department, or a name like "C Gates", "Terminal 1" or "Concourse A");
   - has no current feed here. This keeps transit that has no feed here (the Las Vegas Monorail) and stations newer than the feed copy (SacRT's Dos Rios, missing from the stale SacRT feed);
3. or it is named and its operator or network runs rail routes only in stale feeds of the county's, so the station may be newer than the copy.

A feed counts as current when its calendar runs past today; rail-only feeds, whose calendars the transit step does not record, count as current, and so does Amtrak's. A station missing from its operator's current feed is not served, e.g. the MBTA's Hastings, Mishawum, Plimptonville and Plymouth, which remain on the map. Theme-park and museum lines, which OpenStreetMap tags as monorails or light rail with no network, are dropped.

Every other station is dropped. A GTFS stop of a subway, commuter, intercity, monorail or funicular route with no kept station within 150 m is added under its GTFS name, once per 150 m. This includes stations just across the county line that the county's OpenStreetMap extract leaves out (Davis for Sacramento, Metra's DuPage stations for Cook). A stop named as a rail yard (Metro-North's Highbridge Yard, DART's "EAST TEX YARD LIMIT") is never added. Tram, light-rail, cable-car and funicular stops only confirm (San Francisco's cable-car stops and DART's streetcar stops, which DART's feed types as cable trams, are street stops).

LA County's bundle is not built by this pipeline: `w5/tools/la_station_fix.py <in.html> <LA rail stops> <out.json>` applies the same check to LA's station layer. LA's rail stops come from `fetch_gtfs_mdb` for 06037, saved in `w5/research/la_transit_rail_stops_r84.json`. It writes the edits that `patch5.py` step 2c makes on every page (`w5/research/la_station_fix_r84.json`):
- 16 stations removed (Disneyland, Knott's, the Getty Center tram, Fillmore & Western, two unnamed points);
- in 78 block groups, the rail distance, gap texts and strengths corrected;
- 88 underused-site listings and 14 neighborhood-plan texts corrected;
- 3 transit-upzoning rows removed.

Every old value is checked and nothing else may change.

Orange County keeps OCTA's own feed, so the transit step writes no rail-stop file for it: `pipeline/oc_rail_stops.py <Orange data dir>` runs the catalog step into a scratch folder and copies only `transit_rail_stops.json`. The round-8.4 Orange bundle (`oc_regress`) was rebuilt that way: Disneyland's and Knott's park trains are dropped, and Anaheim's ARTIC is added from Metrolink's feed. The rebuild also brings Orange the land-only block-group shapes (round 8.1), which put 15 coastal block groups in their cities instead of "Unincorporated Orange County". LA + Orange regression: 91/91.

Each county's decisions are in `data_<fips>/rail_confirm.json` (kept by stop, type or operator; dropped with their tags; added). `station84_review.py` lists them for all counties in `logs/station84_review.md`. The sources table gets a "GTFS rail stops" row with the counts. Counties built before round 8.4 have no rail-stop file and keep the round-8.3 rule.

Known limit (round 8.4): an added GTFS stop is merged with a mapped station only within 150 m, and 112 added stops lie 150–300 m from the station they duplicate (Metro-North's Milford, Caltrain's Bayshore, Amtrak's "Boston" at South Station), so the map shows two dots there; `NEXT_ROUND.md` item 1 widens the merge distance.

## Transit (all counties except Orange, which keeps its OCTA feed)
`fetch_oc.py fetch_gtfs_mdb` reads MobilityData's GTFS catalog (`storage.googleapis.com/mdb-csv/sources.csv`) and its mirror of each feed's latest version (`storage.googleapis.com/mdb-latest/...`). Both are on an allowed host, so this works for any US county.

Feed selection:
- feeds whose bounding box overlaps the county;
- active only: not deprecated or redirected, not demand-response "Flex", not multi-state (Amtrak, intercity coaches);
- one feed per provider.

Counting:
- bus departures 07:00–09:00 at each stop, on one representative Wednesday per feed (`fetch_oc._choose_wednesday`). Since selection 14 (round 8.4) the candidates are the feed's Wednesdays within three weeks of today that are not a fixed-date holiday (1 Jan, 19 Jun, 4 Jul, 11 Nov, 24, 25 and 31 Dec), or, for a feed with none that near, the three weeks around its own Wednesday nearest today; full weekday service is the highest 07:00–09:00 departure count that at least two candidates reach within 10% (the highest count when no two are that close); and the day is the candidate nearest today within 10% of it. Each feed's candidate counts are in the county's `transit_stops_7_9.meta.json` (`wednesdays_7_9am_departures`). The single busiest Wednesday can be a feed error: SRTA's feed adds its Thursday schedule on 25 Nov 2026 without removing the regular one (5,980 departures against 4,426), which selection 12 (at least 90% of the busiest) measured; selection 13 (the second-highest count) failed with two candidates (Greater Portland Metro, whose feed starts 7 Nov: 3,066 departures on 18 Nov, 2,744 on 25 Nov). A feed whose main schedule lapses is measured on its last full Wednesday within three weeks (Dutchess County: 1,717 departures on 28 Oct, 216 from 4 Nov, when its main calendar has ended). Since selection 16 a schedule ends, for the one-year staleness test, on the last date a service with bus trips runs (Cherriots' copy: 3 May 2025, though its calendar runs to 2 Jan 2026); a stale feed is judged around its last Wednesday with morning departures; and a feed whose calendar covers today but runs no service on its Wednesdays within three weeks counts no buses (recorded in the meta's skipped list) instead of its busiest Wednesday ever. Before, it was simply the nearest Wednesday; on 8 Nov 2026 that was 11 Nov, Veterans Day, when many operators run a Saturday or Sunday schedule, which halved bus frequency in many counties (Providence's RIPTA: 2,320 buses an hour summed over stops, against 5,350 on 4 Nov). Selection 10 compared whole-day trips and missed holidays that drop only peak extras (Rochester's RTS keeps 91% of its trips on 11 Nov but not its school and peak services). Selection 11 compared morning departures but let through small holiday cuts (Riverside Transit Agency runs its weekday schedule without school trips: 2.5 → 2 buses an hour at Hemet stops);
- calendar_dates exceptions and frequencies.txt are applied;
- the result is divided by 2 to give buses per hour.

Exclusions:
- feeds whose schedule ended more than a year ago, and feeds whose mirror can't be downloaded, are left out and listed in the sources table;
- example: AC Transit's current feed has no mirror, and its only mirrored copy (April 2025) predates the August 2025 "Realign" network redesign.

Feed downloads (selection version 3):
- Feeds are downloaded by their id from a daily listing of the mirror bucket, because the catalog's `urls.latest` is sometimes out of date. SFMTA's current feed (2886) is in the bucket under a different name; without this, San Francisco had no Muni service.
- Feeds the bucket doesn't have are listed as "no mirror".
- Feeds without a bounding box in the catalog are included when they are in the same state, or have no state but a municipality inside the county; their stops must still fall in the county.

Feed downloads (selection versions 4 and 5, round 8):
- `fetch_oc.py` takes each feed from MobilityData's current hosted copy first: `storage.googleapis.com/mobilitydata-datasets-prod/mdb-<id>/latest.zip`, the store behind files.mobilitydatabase.org. The bucket can't be listed, but its objects are public.
- The legacy `mdb-latest` mirror is only a fallback.
- Version 5 follows every catalog redirect (numeric, `tld-`, `ntd-`, `mdb-` and `tdg-` ids) and tries the target first; the targets live in the same hosted store. Examples:
  - Jacksonville's JTA 346 → tld-764, which runs to March 2027;
  - Butte's B-Line 241 → ntd-90208;
  - County Connection 1243 → 2421, whose own catalog row is filed under Tennessee, so the bounding-box test missed it.
- A feed reached through two catalog entries is counted once.
- Tables zipped in a subfolder or named `.csv` are read too (BJCTA's current feed is packaged that way). A feed without bus routes or service dates is listed with that reason, never skipped silently.
- This closed most gaps: AC Transit, SamTrans, Tri Delta, VIA (San Antonio), JTA, Sun Metro.
- `rebundle_transit5.sh` re-bundles counties built earlier, known-gap counties first (`transit_priority4.txt`). The county's `transit_stops_7_9.meta.json` records which copy each feed came from.

Counting each bus once (selection versions 6 and 7, round 8.2). Version 5 counted some buses two or three times. These rules fix that:
- **One feed, one id:** MobilityData writes some ids two ways ("75" and, in redirects, "mdb-75"). Ids are normalised, so a feed reached through two catalog entries is read and counted once. Version 5 had counted El Dorado Transit (75), Cincinnati Metro (307) and Leprechaun Lines (910) twice.
- **Each route once:** a route is (agency, route_short_name), or the long name when a feed has no short names. Two copies must stop at the same places: 20% of the stops within about 100 m for the same agency, 80% for two agency names. When two feeds carry the same route, it is counted from one of them, chosen in this order:
  - the feed whose service for that route includes today;
  - the most specific feed (fewest agencies), so an agency's own feed comes before a regional aggregate;
  - the newer schedule (the later start of the route's service). Added in round 8.3: the current catalog lists Brockton's BAT twice, as its own feed (422, issued 27 Feb 2026, 963 stops) and as an NTD copy (ntd-10004, a calendar running 2021–2027, 815 stops), and "later end" had picked the thinner NTD copy;
  - the later end of the route's service;
  - more weekday trips.

  Examples:
  - King County Metro's own feed appears as both 267 and 1330, and again in the Puget Sound consolidated feed (1080). Version 5 counted Metro's buses three times: King County's 7–9 am total fell from 95,250 to about 34,000 buses per hour.
  - Sound Transit's express routes appear in the feeds of King County Metro, Pierce Transit and Community Transit, each with the routes it operates. All of them are kept, each once.
  - Lower Hudson Transit Link's routes H01–H07X appear under agency "LHTL" in feed 915 and "Hudson Link" in feed 2312.
- **Superseded schedules:** an agency's schedule that does not run today is dropped when another feed has the same agency running today at the same stops. Example: RABA's December 2025 – May 2026 schedule (2852) and its current one (3031).
- **Feeds with no location in the catalog:** a row without a bounding box is placed by the box of its own stops, read from the hosted copy (cached 30 days in `cache/mdb/feed_boxes.json`). Version 5 placed such rows by their state, or by a municipality inside the county when the row had no state. It missed rows with neither, among them Winston-Salem Transit (3479) and Galveston Island Transit (2861, municipality "City of Galveston"). When there is no hosted copy to read, the old rule still applies, and "City of X" is now matched as "X".
- **Demonstration feeds** (e.g. "Sunny Valley Transit (Demo)", 3473) are skipped.
- **Malformed rows:** calendar rows with a blank service_id, and dates that are not 8 digits, are ignored. Georgia's Xpress feed ends `calendar_dates.txt` with a blank row, so the reader used to reject the whole feed.
- **The operator's own URL (version 7):** when both MobilityData copies are stale or missing, the operator's download URL from the catalog is tried, where this environment can reach it. Example: Westchester's Bee-Line is current (Oct 2026 – Feb 2027) on NYSDOT's 511NY bucket (`s3.amazonaws.com/datatools-511ny`), while both MobilityData copies ended in 2025.
- **Gap stops:** a stale feed's stops no longer mark a block group "unknown" where a current feed of the same agency is read; those places have no service in the current schedule.
- **Audit:** `transit_stops_7_9.meta.json` lists, per feed, the agencies counted and the routes counted from another feed, and flags route numbers shared by two agency names at 50–80% of the same stops (`possible_duplicate_routes`) for review.
- `transit7_check.py` runs the transit step alone for a built county and compares the result with its current files. Counties whose stops changed are re-bundled by `transit7_all.sh`. Counties where only stale-feed stops changed and no block group could change are not re-bundled.

MobilityData's current catalog (selection version 8, round 8.3):
- `mdb_catalog_rows` reads the legacy catalog (`mdb-csv/sources.csv`, 1,193 US GTFS rows) and MobilityData's current export (`storage.googleapis.com/mobilitydata-datasets-prod/feeds_v2.csv`, the file behind files.mobilitydatabase.org; refreshed daily into `cache/mdb/feeds_v2.csv`). The current export has 1,706 US GTFS rows.
- A feed in both keeps its legacy status, so feeds the legacy catalog marked inactive stay out. It takes the export's bounding box, redirect and operator URL where the export has one.
- Feeds only in the export (Transitland `tld-`, NTD `ntd-`, TransitFeeds `tfs-` and a few `mdb-` ids) are added unless they are inactive, in development or future. TransitFeeds copies are read from its archive bucket (`openmobilitydata-data.s3.us-west-1.amazonaws.com`).
- Example: York County, PA's rabbittransit is stale in the legacy catalog (499, 2023) but current in the export (tld-223, 4 Oct 2026 – 31 May 2027).
- The route-level rules above keep a feed that appears under an old and a new id from being counted twice.

Fallback and gap stops (selection version 2):
- If a provider has no working active feed, its deprecated mirror is tried, but only if its schedule is less than a year old.
- The bus stops of feeds that were skipped as stale are kept as evidence of service (`transit_gap_stops.json`). Example: Butte Regional Transit's only mirror ended in January 2024; its 527 stops make Chico's bus frequency unknown rather than 0.

Coverage check: `osm_extract.py` also saves OpenStreetMap bus stops. If a block group has 3 or more OSM bus stops within 400 m but the feeds have under 30% as many stops there, an operator is missing, so `bt` is set to unknown rather than 0. It is also unknown where a gap stop lies within 400 m and the current feeds have none. Transit-dependent projects are then not scored there. Results when the check was added (round 7, before selections 4 and 5 found AC Transit's current feed):
- Alameda: 716 of 1,134 block groups unknown (AC Transit missing);
- Contra Costa: 249 of 708 unknown;
- Fresno: 5 of 637 unknown.

`logs/quality.md` has the current count for every county.

## Site suggestions (sites.py rules added in round 8)
- **Shore rule (`creek_shore_rule: 2`):** where a waterway lies mostly inside a mapped water polygon (OSM river/canal areas, or the Census water layer, which also covers estuaries OSM bounds by coastline), the "path alongside" search reaches the shore.
  - Search radius: the shore distance plus 80 m, or plus 250 m on wide rivers (shore 200 m or more away), because waterfront paths often run behind piers or levees.
  - Wide buffers are measured by sampling the line every 25 m, which keeps memory low.
- **Tunnels:** waterways tagged or named as tunnels are underground and are skipped.
- **Parking lots:** a lot that is itself a park-and-ride is transit infrastructure and is never suggested as a park. Lots within 120 m of a supermarket, shopping centre, department store or hospital are skipped too (round 5).
- **Rail-station destinations (round 8.4):** `sites.py` leaves out "rail station" destinations within 150 m of a station the county's rail-station check dropped (`data_<fips>/rail_confirm.json`); `tools/sites_drop_stations.py` removes such suggestions from site files built before.
- **No charger of a kind (round 8.4):** where the county's AFDC list has no Level 2 or no DC fast charger (San Juan, PR has no DC fast charger), that distance is left empty (`dl2` / `ddc` = null) and the page says "none in the AFDC list for this area". Before, `sites.py` stopped with an error.
- `tools/resites.sh <fips>` re-runs one county's site suggestions after its raw files were cleaned up: it re-downloads chargers, OSM, Census water and CCRS as needed, then cleans up again. `resites_pass.sh` runs it across all counties.

## Regional single-file pages
`tools/build_region.py <name> <fips> ...` builds one page with LA and Orange County plus the listed counties, each with its site suggestions. It then runs the LA/OC regression and `countytest.js` for every county. The regions are defined in `/home/user/w5/regions.json`:
- seven California regions: socal, bay-area, central-coast, central-valley, sacramento-region, north-coast-and-mountains, sierra-and-gold-country; together they cover all 56 other counties;
- us-sample: Denver, Cook, Harris, Kings (Brooklyn) and Fairfax;
- us-new-states: Middlesex MA, Philadelphia, Allegheny, Providence and Salt Lake (states cut by `osm_split.py`).
- us-metros-2: Maricopa, Clark, King, Cuyahoga, St. Louis and Davidson; us-florida: Miami-Dade, Broward, Palm Beach, Orange, Hillsborough and Duval; us-metros-3 (round 8.3): Milwaukee, Hennepin, Franklin, Hamilton, Westchester and Wake;
- us-new-states-2 (round 8.4): the largest county of each state first built in batch 5, plus Wyoming's and Puerto Rico's. These are San Juan PR, Hinds MS, Yellowstone MT, Cass ND, Minnehaha SD, Chittenden VT, Kanawha WV and Laramie WY.
- `tools/build_region_when_ready.py <name>` builds one region once all its counties are built and no other page build is running.

## Hosted mode (for a national site)
A single HTML file can't hold thousands of counties, so a hosted site embeds only LA and Orange County and fetches every other county when it is opened.

1. Write each county's files:
```bash
python3 /home/user/w5/tools/export_county.py <fips> <site>/counties
```
This writes `counties/bundle_<fips>.json` (the county bundle) and `counties/sites_<fips>.json` (its site suggestions; the commercial-lot filter is applied where needed).
2. Build the page with hosted entries:
```bash
python3 /home/user/w5/tools/patch6.py base5.html <site>/index.html 06073=@counties 08031=@counties ...
```
Each `@<base>` entry becomes an empty `<script class="county-bundle" data-src=... data-sites=...>`. The county picker lists it, and opening it fetches both files and merges the site suggestions into the page.
3. Serve `<site>/` over HTTP. Bundles are 14–28 MB raw. Either let the server gzip them (Content-Encoding), or write them pre-compressed:
   - `export_county.py <fips> <site>/counties --gz` writes `bundle_<fips>.json.gz` and `sites_<fips>.json.gz` (about 4–8 MB each);
   - then use `<fips>=@gz:counties` in `patch6.py`;
   - the page unpacks gzip itself when the server sends the bytes unchanged, so any static host works. Tested 7 Nov 2026 over a plain `http.server`: Providence (gzip files) 38/38, Denver (plain JSON) 34/34.

Tested 7 Nov 2026 with `python3 -m http.server` and `tools/countytest.js http://127.0.0.1:8765/index.html ...`:
- Denver: 33/33;
- Santa Clara: 41/41;

bundles and site suggestions were fetched on demand. A file:// page cannot fetch, which is why the single-file deliverables embed their counties.

### Build more counties (round 8)
```bash
python3 make_queue.py q.txt --states PA,OH --top 20
```
- It lists unbuilt counties, largest first (ACS population), skipping Alaska and Hawaii (no OSM file).
- Then run `./queue_worker.sh <log name> q.txt`. Start it twice for two counties at a time: the workers share per-county locks (`logs/build_locks`), and a county whose state isn't cut yet waits for `osm_split.py`.
- A county takes 4–15 minutes and about 2–4 GB of memory; Cook, with 1.9 million crash rows, took 32 minutes.

### One command for the whole national site (round 8)
```bash
python3 /home/user/w5/tools/build_site.py <site dir>
```
- It exports every county that has a bundle and site suggestions as `counties/*.json.gz`, writes `counties/manifest.json` (name, state, block groups, size, build date, OSM date, crash source and years per county), and builds `index.html` with LA and Orange County embedded and every other county hosted.
- Upload `<site dir>` to any static host as it is: the page unpacks the gzip files itself.
- Built 7 Nov 2026 at `/home/user/national/site`: index.html 28.7 MB plus 89 counties (216 MB).
- Tested over a plain local `http.server`: LA + Orange regression 91/91; Middlesex MA 38/38, Fairfax VA 42/42, Alameda 42/42 (`regress.js` and `countytest.js` both accept a `http://127.0.0.1` URL).

## Page size
Each county adds about 8 MB to the single-file page. The loader also accepts `data-src` URLs, so a hosted national site can fetch per-county files on demand instead of embedding them (a local file:// page cannot fetch, which is why counties are embedded here).
