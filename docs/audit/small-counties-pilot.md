# Counties the page didn't list: Tennessee pilot (17 Nov 2026)

The page listed 706 counties: every county with 100,000+ people plus a few smaller ones, 80.5% of the US population.
2,443 counties (63.6 million people, 54,113 block groups, in 45 states; Puerto Rico not counted) had no entry at all.
This pilot measured what it takes to cover them, using Tennessee (95 counties, 14 listed, 81 not), then built the state.

## How the files are built

The same county pipeline as every other lower-48 county (`pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`,
`layers_oc.py`, `build_oc.py inputs/page_dec`), then `scripts/export_county_bundle.py`, `scripts/build_tree_equity_2025.py tn`,
`scripts/build_state_crash_counts.py`, `scripts/recompute_crash_gaps.py`, `scripts/build_acs_fallback_flags.py` and
`scripts/build_county_completeness.py`. Nothing is typed; a field with no source stays empty and its source row says why.

- **OpenStreetMap.** openstreetmap.fr publishes no Tennessee file and Geofabrik resets the connection from this machine,
  so the 4.6 GB us-south extract was downloaded (6.5 min) and Tennessee cut from it with the project's own
  `national/osm_split.py` (168 s, 241 MB, osmium `extract -s smart`; data timestamp 2026-11-17 00:54 UTC). osmium-tool
  had to be installed (apt). Every Tennessee county then links the same state file.
- **Page entry.** `export_county_bundle.py` now adds a tag for a county the page doesn't list (name and state from the
  registry, i.e. the Census Gazetteer), in FIPS order, instead of refusing it.

## Pilot: three counties of different sizes

| County | People (ACS 2020-24) | Block groups | Wall time (fetch + build) | Data file (gzip) |
|---|---|---|---|---|
| Sevier (47155) | 99,652 | 69 | 119 s + 173 s | 1.28 MB |
| White (47185) | 28,160 | 17 | 112 s + 168 s | 0.28 MB |
| Pickett (47137) | 5,079 | 6 | 112 s + 169 s | 0.34 MB |

Three ran at once. Each file is mostly drawn map layers: streets 37-49%, water 25-29%, parks 4-33% (Pickett holds part
of Big South Fork and Dale Hollow Lake); the block-group data itself is 4-31 KB.

**Empty fields, each named in the county's sources list:**
- crime (not connected outside California: the FBI's Crime Data Explorer needs an API key), 311 requests, assessor
  parcels and sales, street-tree survey, tax-rate areas (California only): all three counties;
- heat and the 2021 canopy gap where the 2021 Tree Equity release has no block group (it covers urbanized areas only):
  57 of Sevier's 69, all of White's and Pickett's; the current release's canopy (`tree_equity_2025/`) covers them;
- bus frequency where no GTFS feed has a stop with 7-9 am departures (White, Pickett); rail distance (no station);
- EV fast charger distance in Pickett (none in the AFDC download for the area);
- a handful of ACS values the Census suppresses (e.g. Sevier: 5 incomes, 1 home value, 1 rent).

**Crash comparisons.** Tennessee crash counts (TITAN, 2022-2024, boundary rule) were built for all three. The "worse
than X% of similar areas" comparison needs at least 20 peer block groups from the same county and source, so White (17)
and Pickett (6) get none, and say so; Sevier has 14 gaps and 2 strengths.

**Checks.**
- Census: 48 values (population, home value, rent, income in 12 block groups) equal the Census Bureau's ACS 2020-24
  table files; suppressed rents hold the tract's published median and are labeled as such.
- OpenStreetMap, ID for ID against a live Overpass query of the same box (`scripts/check_osm_extract_vs_overpass.py`,
  `data/backtests/tn_osm_xcheck_2026-11-17.json`): Sevier 10,650 = 10,650 roads, 133 = 133 bus stops; Pickett 1,829 =
  1,829 roads; White 2,685 of 2,686 roads. The one difference is way 19650649, Locke Bend Road, tagged Warren County: it
  is in the Tennessee file (last edited 2017, before the snapshot) and only crosses the corner of White's check box, so
  Overpass (which returns a way whose line crosses the box) has it and the extract (which keeps a way with a node in the
  box) doesn't. Not a missing local road.
- Live on the real page (`scripts/live_check_panels.mjs`): 3 block groups in each pilot, every panel matching its
  source; no county has a public parcel service, and clicks say so.

## Full US: estimate

| | Full files (as built) | Light files (no drawn streets, water, parks) |
|---|---|---|
| Size | ~20.6 KB per block group (pilots pooled) -> ~1.1 GB for 54,113 block groups; Tennessee's 81 came to 31.8 MB (0.39 MB a county) -> ~0.95 GB for 2,443 | ~3.5 KB per block group -> ~0.2 GB |
| Build time | ~5 min per county; Tennessee's 78 ran at ~1 min per county with four at once -> ~40 hours for 2,443, plus checks | same |
| OSM | 4 regional downloads (2-4.6 GB each) and ~45 state cuts (~3 min each) | same |

The repository's `counties/` is 1.1 GB today, so full files would about double it. **Light-file test:** White County's
file without the streets, water and parks layers is 60 KB instead of 284 KB; on the real page all panels still match
their sources and there are no page errors. The basemap tiles (CARTO) already draw streets and water; what a light file
loses is the page's own street names and drawn parks for that county. Existing counties are unchanged either way.

**Recommendation.** Build the rest state by state in light form (about 0.2 GB), keeping full files for counties of
50,000+ people; or full files throughout if repository size isn't a concern. Either way: the Overpass cross-check is
too slow to run on every county (5-25 min each through the public mirror); run it on a sample per state, and run
Census and live-page checks on a sample per state.

## Tennessee: the rest of the state (built)

All 81 unlisted Tennessee counties now open as data counties (95 of 95). The 78 after the pilot ran as four workers of
19-20 counties each: about one county a minute overall, no build failures. Page entries: 81 new tags (the page now lists
787 counties) and 81 manifest rows. 81 new files, 31.8 MB in all (median 0.28 MB, largest 1.52 MB).

- **Canopy:** `build_tree_equity_2025.py tn` (current release, 2025-07-01): files for all 95; the 14 existing counties'
  files came out identical apart from the build date and were left unchanged.
- **Crash counts and comparisons:** TITAN 2022-2024 with the boundary rule for all 81; `recompute_crash_gaps.py`:
  181 gaps and 242 strengths across the 78, and 949 crash-based improvement rows dropped where the rebuilt counts no
  longer qualify them (the same rule as every other county). Counties with fewer than 20 block groups get no "worse than
  X%" comparison.
- **Tract-median flags:** `build_acs_fallback_flags.py` rebuilt for all 749 county files: 0 mismatches.
- **Completeness:** 81 new rows (20 tier C where a transit feed was found, 61 tier D); every existing row left exactly as
  it was (a fresh run would also have rewritten four other counties' build-time "not responding" notes; not taken).
- **Checks:** Census 96 more values in six counties equal the ACS table files (144 in all, 0 wrong). OpenStreetMap ID
  for ID in five counties (`data/backtests/tn_osm_xcheck_2026-11-17.json`): Warren 2,626 = 2,626 roads, 1 = 1 bus stop;
  Madison 5,100 of 5,101 roads, the one being way 19439975, Malone Road, tagged Crockett County (last edited 2012), in
  the Tennessee file, the same box-edge case as White's. Two earlier tries for Madison and Warren got no answer from the
  public Overpass mirror. Live on the real page: Madison, Anderson, Warren, Van Buren, Lake and Moore, 3 block groups
  each (18/18), every panel matching its source, no page errors; plus the three pilots (9/9).
- **Tests:** unit 656 (the crash-count and crash-gap tests run per county, so 81 counties add 162), typecheck clean,
  e2e 68/68 (`PW_PORT=8836`).

**Disk.** Each county's build directory held copies of the national ACS table files (about 150 MB a county), and the
session's disk allowance ran out after ~20 counties; four builds stopped mid-way. Those four build directories were
deleted and rebuilt from scratch (no shared cache file was written after the pilots, so none was affected), and each
build now deletes its raw source files when it finishes (keeping only what export and the checks read). A full-US run
needs the same cleanup.

**Noted, not changed:** `scripts/live_check_panels.mjs` labels a sampled point in a county with no parcel service but no
parcel near the point as "no parcel at point (right-of-way)" (Sevier, Anderson); that is the script's own label, not
what the page says. Every county still carries the pipeline's street-tree estimate "from block-group area (the fit used
for Los Angeles County)", which is LA-derived; it predates this pilot and applies to every county outside LA.
