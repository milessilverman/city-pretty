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
- Published with `scripts/export_county_bundle.py` (same format as `w5/tools/export_county.py --gz`), which also turns the
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
