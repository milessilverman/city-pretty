# Alaska county data files (17 Nov 2026)

## What was wrong
Alaska's 30 boroughs and census areas were on the page as "lot lines only" placeholders (`data-coverage="lots"` in
`index.html`, no data file): opening Anchorage showed property lines and nothing else, and the live panel check could not
run there. The registry (`national/data/counties.json`) gave the reason: "openstreetmap.fr publishes no Alaska extract
... and no other OSM download host is reachable here". Every other step of the county pipeline covers Alaska.

## What was built
The same county pipeline as every other county (`pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`,
`build_oc.py`), with one change: where the registry has no downloadable extract it may name an Overpass API endpoint, and
`fetch_oc.py` then downloads the county box from it.

- **OpenStreetMap through Overpass.** The query asks for exactly the tags `osm_extract.py` keeps (roads, rail, parks,
  water, amenities, places, noise walls, power lines, bus stops) plus every node and member way they need, as OSM XML.
  `osm_extract.py` reads that file with the same osmium code it uses for a .pbf, so the output is the same set of features.
  The box is the one `osm_extract.py` clips to (block groups plus 0.02 degree). The public endpoint (maps.mail.ru; the
  only one reachable here with current data) answers many requests with 504, so the box is cut into tiles, each tile is
  retried and split further if needed, and the tiles are merged with osmium (duplicates kept once). All or nothing: if a
  tile fails, nothing is saved. The extract's database timestamp is recorded (Anchorage: 2026-11-16T23:46:04Z).
- **Check:** Anchorage's 10,674 road ways, 382 bus stops and 13 libraries in the extract match an independent Overpass
  count for the same box and tags, way for way (`osm_roads.json` ids against `out ids`).
- **Everything else** comes from the same pulls as other counties: Census 2020 block groups (TIGERweb), ACS 2020-2024
  (www2.census.gov table files), places, Esri USA Parks, MobilityData GTFS (Anchorage People Mover, 680 stops, weekday
  18 Nov 2026), NCES schools, AFDC chargers. HUD FY2027 rents and the current Tree Equity release come from the page's
  own files (`app/data/hud_fair_market_rents.json`, `app/data/tree_equity_2025/02020.json`, built by
  `scripts/build_tree_equity_2025.py ak`: 197 of 200 block groups).
- Published with `scripts/export_county_bundle.py` (same format as `w5/tools/export_county.py --gz`; w5/ was removed in 4bc63cd and is at `git show 4bc63cd^:w5/tools/export_county.py`), which also turns the
  borough's placeholder tag into a data tag and adds its `counties/manifest.json` row. `app/data/county_completeness.json`
  rebuilt: Anchorage is tier C (Census, OpenStreetMap, transit; no parcel-and-zoning pair).

## Empty fields, and why (shown as "not on file" / not scored, never 0)
| Field | Why |
|---|---|
| Crash gaps (pedestrian/bicycle, killed-or-seriously-injured) | No Alaska state crash records source is connected; FARS fatal crashes are downloaded for reference only, as everywhere |
| Heat (Tree Equity 2021) and the bundle's own canopy gap | American Forests' 2021 file for Alaska returns 403 (`national_tes_share/ak.zip.zip`), where California's and Washington's return 200; the release covered the contiguous states. The current release's canopy gap is shown from `tree_equity_2025/02020.json`; its heat measure is a different one and is not used |
| Crime | Not connected outside California (as everywhere) |
| Rail-station distance | OpenStreetMap has 5 Alaska Railroad stations in the box, but no GTFS feed read here has an Alaska Railroad stop, and the pipeline keeps a station only when a schedule confirms it, so none is kept |
| Site suggestions (`sites_<fips>.json.gz`) | `w5/tools/sites.py` reads the old build machine's paths and OSM tags this download doesn't include; not built. The page handles a county without them |
| Street-tree survey, 311, assessor sales, tax-rate areas | Not connected for Anchorage (as for most counties) |

## Built so far
| Borough | Block groups | OSM check (extract vs direct Overpass, same box) | Live panels (3 block groups) |
|---|---|---|---|
| Anchorage (02020) | 200 | roads 10,674 = 10,674; bus stops 382 = 382 | pass; parcel clicks 3/3 |
| Fairbanks North Star (02090) | 63 | roads 5,907 = 5,907; bus stops 104 = 104 | pass (no parcel service: block-group panels only) |
| Matanuska-Susitna (02170) | 61 | roads 17,204 = 17,204; bus stops 381 = 381 | pass (no parcel service) |
| Juneau (02110) | 21 | roads 1,205 = 1,205; bus stops 59 = 59 | pass (no parcel service) |
| Kenai Peninsula (02122) | 35 | roads 15,544 = 15,544; bus stops 400 = 400 | pass (no parcel service) |

Kenai, like Mat-Su, has no feed with stops inside the borough (bus frequency unknown in all 35 block groups). Its and
Mat-Su's boxes overlap Anchorage, so their bus-stop counts include Anchorage's.

## Round 2 (17 Nov): 24 more boroughs and census areas built; Aleutians West left out
29 of Alaska's 30 county-equivalents now open as data counties. Same pipeline and sources as above, one borough per
background job (`ak_one.sh <fips>`: `fetch_oc.py`, then `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`,
`build_oc.py inputs/page_dec`), three at a time, then `scripts/export_county_bundle.py`, `scripts/build_tree_equity_2025.py ak`
(29 county files), `scripts/build_acs_fallback_flags.py` (0 mismatches; the new boroughs add 114 home values and 115 rents,
11 of the rents tract medians) and `scripts/build_county_completeness.py` (Alaska: 13 tier C, where a transit feed was
found, 16 tier D, 1 none).

Every borough's roads and bus stops were checked against a direct Overpass query of the same box, ID for ID
(`data/backtests/alaska_overpass_xcheck_2026-11-17.json`; Juneau re-run as a check of the script):

| Borough (FIPS) | Block groups | Road ways: direct = extract | Bus stops: direct = extract | File (gzip) |
|---|---|---|---|---|
| Aleutians East Borough (02013) | 3 | 259 = 259 | 0 = 0 | 2.8 MB |
| Bethel Census Area (02050) | 10 | 2,056 = 2,056 | 2 = 2 | 14.8 MB |
| Bristol Bay Borough (02060) | 1 | 267 = 267 | 0 = 0 | 0.3 MB |
| Chugach Census Area (02063) | 7 | 719 = 719 | 1 = 1 | 2.9 MB |
| Copper River Census Area (02066) | 2 | 1,157 = 1,157 | 0 = 0 | 2.9 MB |
| Denali Borough (02068) | 2 | 606 = 606 | 11 = 11 | 0.8 MB |
| Dillingham Census Area (02070) | 2 | 678 = 678 | 0 = 0 | 5.8 MB |
| Haines Borough (02100) | 3 | 1,661 = 1,661 | 64 = 64 | 6.7 MB |
| Hoonah-Angoon Census Area (02105) | 3 | 2,176 = 2,176 | 114 = 114 | 11.7 MB |
| Juneau City and Borough (02110, round 1) | 21 | 1,205 = 1,205 | 59 = 59 | 6.2 MB |
| Ketchikan Gateway Borough (02130) | 11 | 875 = 875 | 54 = 54 | 8.7 MB |
| Kodiak Island Borough (02150) | 10 | 803 = 803 | 2 = 2 | 2.7 MB |
| Kusilvak Census Area (02158) | 4 | 448 = 448 | 0 = 0 | 3.9 MB |
| Lake and Peninsula Borough (02164) | 1 | 1,036 = 1,036 | 2 = 2 | 3.3 MB |
| Nome Census Area (02180) | 5 | 887 = 887 | 2 = 2 | 3.2 MB |
| North Slope Borough (02185) | 6 | 637 = 637 | 1 = 1 | 3.3 MB |
| Northwest Arctic Borough (02188) | 9 | 320 = 320 | 0 = 0 | 2.6 MB |
| Petersburg Borough (02195) | 4 | 356 = 356 | 0 = 0 | 6.2 MB |
| Prince of Wales-Hyder Census Area (02198) | 10 | 1,883 = 1,883 | 54 = 54 | 17.5 MB |
| Sitka City and Borough (02220) | 11 | 500 = 500 | 55 = 55 | 7.5 MB |
| Skagway Municipality (02230) | 1 | 105 = 105 | 5 = 5 | 4.9 MB |
| Southeast Fairbanks Census Area (02240) | 5 | 1,889 = 1,889 | 0 = 0 | 1.7 MB |
| Wrangell City and Borough (02275) | 2 | 519 = 519 | 0 = 0 | 8.2 MB |
| Yakutat City and Borough (02282) | 1 | 111 = 111 | 0 = 0 | 6.5 MB |
| Yukon-Koyukuk Census Area (02290) | 8 | 9,847 = 9,847 | 115 = 115 | 7.7 MB |

Boxes are rectangles around the block groups, so some take in a neighbor: Yukon-Koyukuk's box covers Fairbanks
(most of its roads and bus stops), Hoonah-Angoon's covers Juneau. The page clips nothing out of a box; this is the same
rule as every other county.

**Small boroughs are built, not left out.** Ten have 1-3 block groups. Each block group's comparisons are against the 50
most similar block groups across LA County and the borough (`build_oc.py` peer pool), so a one-block-group borough still
gets them, and its Census, HUD and canopy figures are its own. No borough had zero OSM roads.

**Left out: Aleutians West Census Area (02016).** Its block groups cross the 180th meridian (Attu and the Near Islands
are at +172 to +180 longitude), so the pipeline's box (min to max longitude) would span the globe and the Overpass
download would cover the whole band; the page's map and lot lookups also assume one longitude range. It stays "lot
lines only". A build would need the box split at the meridian in `fetch_oc.py`, `osm_extract.py` and the page.

**Large files.** Most of the size is OpenStreetMap water lines and park outlines at full detail: Prince of Wales-Hyder
(17.5 MB; 182,728 water features), Bethel (14.8 MB; 273,964 water lines in the Yukon-Kuskokwim delta), Hoonah-Angoon
(11.7 MB; 79,630). The previous largest file was Maricopa's 9.8 MB. Bethel at first did not load at all: the page's county
loader appended each layer with `push(...features)`, which overflowed the call stack ("Maximum call stack size exceeded",
app.js); the coordinator fixed that on main (e7d3aa3, loop-based append) and Bethel then loaded and passed. All three
load and pass on the real page.

**Petersburg** took two runs: the first was stopped at the 2-hour job limit while the public Overpass endpoint answered
504 to most tiles (nothing was saved: the download is all or nothing); the second finished in 45 minutes.

Live checks on the real page (`scripts/live_check_panels.mjs`; `data/backtests/live_check_panels_2026-11-17_ak3.json` to
`_ak9.json`): Bethel, Kodiak, Ketchikan, Skagway, Petersburg, Prince of Wales-Hyder, Hoonah-Angoon, Sitka, Nome,
Yukon-Koyukuk, Bristol Bay and Yakutat, 3 block groups each (1 where the borough has 1): every panel matches its source
(neighborhood ACS values, canopy gap and goal, crash panel empty, state laws), no console errors. None of these boroughs
has a public parcel service, so house-panel checks (HUD, FEMA, USGS) are n/a and clicks say so. Bethel, Kodiak, Ketchikan
and Skagway were re-checked after their canopy files were built (`_ak9`). The panel check started at the second block
group and so sampled nothing in a one-block-group borough; it now starts at the first when a borough has too few to skip
one (`scripts/live_check_panels.mjs`).

Juneau's file is 6.2 MB gzipped for 21 block groups: 24 MB of the uncompressed layers is park outlines (the Tongass
National Forest and other protected areas drawn at full detail), within the range of existing files (Maricopa's is 9.8 MB).

Mat-Su's transit row says the one feed read (Anchorage People Mover) has no stop with 7-9 am departures inside the borough, so
bus frequency is unknown (not 0) in all 61 block groups; no MobilityData feed for the Valley's own service was found.

## Page bug found and fixed: clicks routed to another county's parcel service (251 counties)
`parcelSvc()` and `getParcelService()` fell back to the first registry service that listed the county's state. Every
county service also lists its state, so in a county with no service of its own the click queried another county's layer:
every Alaska borough asked Anchorage's; Fresno, Ventura and 50 other California counties asked Kern's; Fort Bend and
Brazoria asked Harris's; 251 of the 640 counties with data files in all (counted after Mat-Su was added). That layer had no parcel at the point, and the
page then said "Public Right-of-Way / Roadway: This point is located within the public street ...". Now only a statewide
service (no county list) is a state fallback, as `workers/parcels.ts` already did, and a county with no service says
"No public parcel service is on file for this county ... Nothing is assumed about this point." Checked before changing
it (`data/backtests/parcel_state_fallback_check_2026-11-17.json`): for each of the 251 counties, the service the old code
used was asked for parcels around three block-group points; 714 of 751 answers were 0, 34 failed, and the 3 non-zero
answers were block groups on the border with the service's own county (Walton GA / Gwinnett, Brazoria and Fort Bend /
Harris). So no county lost a working service. e2e: a Fairbanks click shows the new message and never "Right-of-Way".

## Live checks on the real page
- `scripts/live_check_panels.mjs 02020` (`data/backtests/live_check_panels_2026-11-17_alaska.json`): 3 parcels through
  the page's click path; every panel matches its source (neighborhood ACS values, canopy gap and goal, HUD FY2027
  2-bed $1,529, census area, FEMA, USGS, laws), and the crash panel shows no crash text.
- `scripts/live_check_alaska_parcels.mjs` (`data/backtests/live_check_alaska_parcels_2026-11-17.json`): clicking 646 F St,
  1200 W Dimond Blvd and 7431 E 36th Ave shows the parcel ID the Municipality's `PropertyInformation_Hosted` layer returns
  for that point, queried separately (3/3). The only failed requests: the expected 404s for `crash_counts/02020.json` and
  `crash_gaps/02020.json` (no crash source) and two 504s from the page's own Overpass lookups.
- e2e: Anchorage opens as a data county (200 block groups), its sources name Overpass, and no block group carries a crash
  or heat value of 0.

## Mistakes (mine), caught before anything was published
- The first Overpass download used `fetch_oc.py`'s county box (block groups plus 0.01 degree) while `osm_extract.py` clips
  to 0.02 degree, so 111 of the 10,674 road ways in the clip box were never downloaded. Found by comparing with an Overpass
  count; the download now uses the extract's own box, and the counts match.
- The parent session's note said the page had no Alaska county to open; it had 30 "lot lines only" placeholders.
- My first check of the old parcel fallback took the service order from `app/data/parcel_services.json`, which puts LA
  County's assessor first; the page's own list (`PARCELS87`) starts with Kern's. So for the 52 California counties it probed
  LA's service instead of the one the page used. Re-run in the page's order (the file now committed); the conclusion is the
  same (all 52 asked Kern's; no parcels inside them).
- In the panel check I first added a fallback point for counties with no parcel service; `parcelPointIn()` already had one,
  so I reverted it.
- Round 2: the worktree started on an unrelated old commit (94a3f0b); reset to the branch head (0429a9f) before any change.
- Round 2: the build directory's registry link still pointed at round 1's deleted worktree; repointed before the first build.
- Round 2: I first exported Bethel before seeing it fail to load on the page, then reverted the export; it was re-exported
  only after main's loader fix, and passed.
- Round 2: the first Skagway live check sampled no block group (the check skipped the first one); fixed in the script and
  re-run.
