# Small counties: Texas, Oklahoma, Arkansas and Louisiana (22-23 Nov 2026), served from R2 only

**Result: all 400 counties of the four states are built, checked and on the page, served from R2 only; none was
withheld.** Each state was built, checked, uploaded, live-checked and committed on its own (Texas, the largest, in two parts
by OpenStreetMap file). The states were built in the order Oklahoma, Arkansas, Louisiana, Texas, because the first three
share one regional OpenStreetMap download.

| State | Counties built / missing | People (ACS 2020-24) | Block groups | Data files (bytes) | Tiers | Census values checked | R2 bytes added |
|---|---|---|---|---|---|---|---|
| OK | 72 / 72 | 1,950,784 | 1,661 | 29,899,678 | 14 C, 58 D | 1,636 | 29,917,780 |
| AR | 67 / 67 | 1,491,796 | 1,297 | 20,410,231 | 11 C, 56 D | 1,604 | 20,427,087 |
| LA | 50 / 50 | 1,461,591 | 1,660 | 23,608,142 | 11 C, 39 D | 1,196 | 23,622,545 |
| TX part 1 | 101 / 101 | 1,592,770 | 1,328 | 22,996,230 | 6 C, 95 D | 2,072 | 23,021,597 |
| TX part 2 | 110 / 110 | 2,815,555 | 2,194 | 33,584,350 | 21 C, 89 D | 2,328 | 33,611,999 |
| **TX (211)** | **211 / 211** | **4,408,325** | **3,522** | **56,580,580** | 27 C, 184 D | **4,400** | **56,633,596** |
| **All** | **400 / 400** | **9,312,496** | **8,140** | **130,498,631** | 63 C, 337 D | **8,836** | **130,601,008** |

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 400 counties (all of them where a county has fewer), 8,836 values | 8,836 of 8,836 equal | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all county files, after each state | 400 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap ID for ID vs live Overpass (`scripts/check_osm_extract_vs_overpass.py`) | 2 counties per state (Texas: 2 per part), 10 (seed 20261122, drawn from each state's or part's sorted list of new counties) | 7 counties exact (roads and bus stops): OK Jefferson, AR White, LA St. John the Baptist and St. Bernard, TX Matagorda, Lampasas and Rains. 3 differ in roads, and each difference was traced: OK Stephens (54 roads) and AR Jefferson (9 roads) differ only by roads edited, added or deleted after the extract was made (each way's history read from the OpenStreetMap API); TX Navarro (830 roads only on Overpass) differs only in the margin of the check's box: every one of the county's own roads is in the extract (6,439 of 6,439) and all 830 have their centre outside the county | 0% inside the counties apart from 63 roads (54 + 9) changed in OpenStreetMap after the extracts' snapshots |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, `LIVE_PORT=9261`, 3 points per county) | 10 counties (seed 20261123), 30 points | 169 pass, 99 not checkable (no parcel service on the page for the OK, LA and TX counties, so the house-panel rows do not apply), 5 recorded failures, all one kind: at 3 of the 6 Arkansas points the page's USGS elevation row said "Not available (the service did not answer in time)" (the page's 6 s limit; USGS took 16-18 s for the one point timed). No wrong value was shown anywhere | 0 wrong values |

**Crash counts:** none of the four states has a crash source in `pipeline/region.py` STATE_DEFAULTS (it holds IL, VA, UT,
PA, ME and TN), so all 400 files say "Not connected for <state> yet: crash gaps are not scored and crash-based projects
are not proposed". No crash counts were built.

Counties still without a data file after this batch, counted from the registry the same way (not in
`counties/bundle_*.json.gz` or `counties/.r2-only.txt`, Puerto Rico left out) in this worktree: **228** (628 before), of
which Los Angeles and Orange (built by their own pipeline, loaded from `app/data/`) are 2 and Hawaii's 5 have no
OpenStreetMap extract in the registry. Remaining by state: VA 116, CO 53, WV 52, HI 5, CA 2; TX, OK, AR and LA 0. The
Virginia, West Virginia and Colorado counties are being built in another worktree and are not in this one.

**R2 storage:** my files: 130,601,008 bytes added (the 400 data files, 130,498,631, plus the larger `manifest.json`).
The account total went from 1,876,134,325 bytes (3,159 objects) before my first upload to 2,061,749,096 bytes (3,675
objects) after my last: 1.876 GB to 2.062 GB of the 8 GB ceiling and the 10 GB allowance; the difference of 185,614,771
bytes is my 130,601,008 plus 55,013,763 bytes of another job's uploads seen between my Arkansas and Louisiana uploads. Every
upload went through `scripts/r2_sync_counties.py` after a `--dry-run`; the largest projection was 2.062 GB (the brief's stop
was 4 GB); the per-state figures are in each state's section.

**Measured rate:** this batch stored 16,032 bytes per block group (state range 14,222 for Louisiana to 18,001 for Oklahoma;
326,247 bytes per county). The registry's Virginia, West Virginia and Colorado counties have 4,609 block groups (ACS 2020-24
B01003 rows), which at this batch's rate is 0.074 GB (0.066 to 0.083 GB).

The batch is every county under 100,000 people with no data file (not in `counties/bundle_*.json.gz`, not in
`counties/.r2-only.txt`), counted from the registry (`national/data/counties.json`) before starting: TX 211, OK 72, AR 67,
LA 50, **400 counties** (no county of these states with 100,000 people or more was without a data file). The method is the
Southeast batch's (`small-counties-southeast.md`), unchanged: files are uploaded with `scripts/r2_sync_counties.py` after a
`--dry-run`, listed in `counties/.r2-only.txt`, and not committed. No pipeline code was changed.

## How

- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec` from
  a copy of `pipeline/` in the session's scratch folder, three counties at a time, the national ACS table files already in
  the shared cache; then `scripts/export_county_bundle.py <dir> <fips> --r2-only` one county at a time;
  `build_tree_equity_2025.py <state>` (existing counties' files that differ only in `_meta.built` were restored to what is
  committed); `build_acs_fallback_flags.py` (all county files; the 1,774 earlier R2-only files were downloaded from the
  bucket's public address into this worktree's gitignored `counties/` first); `build_county_completeness.py` (only the new
  rows are kept, since a fresh run rewrites `computed_on` on every row).
- **OpenStreetMap:** Texas counties read the sub-region or whole-state files the registry names (openstreetmap.fr, one
  download each, shared by the counties that use it). Oklahoma, Arkansas and Louisiana are `split: us-south/<state>` in the
  registry: `us-south-latest.osm.pbf` (4,623,607,998 bytes, md5 `aaee92b7cea7116859b6f51c768d7830`, equal to the published
  `us-south.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z from `us-south.state.txt`) was downloaded once, cut into the
  three states with `national/osm_split.py` and deleted. Each state's build folders were deleted once the state was uploaded
  and checked.
- **HUD income limits:** `tests/unit/buildingCosts.test.ts` needs a row (or a listed failure) in
  `app/data/hud_income_limits.json` for every manifest county. Each state's rows were fetched from HUD's API
  (`https://www.huduser.gov/hudapi/public/il/data/<fips>99999`) with the script's own `get()` and `row_from()`
  (`scripts/costs/fetch_hud_income_limits.py`); existing rows were not re-fetched or changed.
- **Transit corridors:** `tests/unit/transitCorridors.test.ts` checks every stop's `county_on_page` flag against the
  manifest; the flags of stops whose county is now on the page were set to true in the same commit as the state (nine stops:
  Oklahoma 2, Louisiana 1, Texas 6; none for Arkansas).
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency and rail distance where the per-state notes say so.

## Checks (every state)

- **Census:** `scripts/census_spot_check.py` (seed 20261119): population, median home value, median gross rent and median
  household income of 6 randomly chosen block groups in every county (all of them where a county has fewer) against the
  ACS 2020-24 table files, read by a separate parser. Where the block group's median is suppressed the file must hold the
  tract's published median, flagged as a tract value in `acs_fallback_flags.json`, or nothing.
- **OpenStreetMap:** `scripts/check_osm_extract_vs_overpass.py`, ID for ID against a live Overpass query of the same box
  (maps.mail.ru mirror), two counties per state (per part for Texas), picked at random from the state's sorted list of new
  counties with `random.Random(20261122).sample(list, 2)`. The extracts are dated snapshots and Overpass is live, so a few
  differences could be edits made since; where roads differed, each one's history was read from the OpenStreetMap API
  (`/api/0.6/way/<id>/history`) and compared with the snapshot time, and where the box reaches past the county the differing
  roads were placed inside or outside the county.
- **Live:** `scripts/live_check_panels.mjs` (`LIVE_PORT=9261`, 3 points per county) on the real page loading each county's
  file from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev`; the counties were picked with `random.Random(20261123).sample(list, 2)`.


## Oklahoma (72 of 72 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adair County (40001) | 19,575 | 18 | 303,530 | C | 0 |
| Alfalfa County (40003) | 5,696 | 4 | 210,432 | D | 0 |
| Atoka County (40005) | 14,379 | 12 | 250,716 | D | 0 |
| Beaver County (40007) | 5,028 | 7 | 100,853 | D | 0 |
| Beckham County (40009) | 22,148 | 18 | 225,734 | D | 13 |
| Blaine County (40011) | 8,570 | 11 | 576,114 | D | 0 |
| Bryan County (40013) | 48,253 | 31 | 498,577 | D | 16 |
| Caddo County (40015) | 26,447 | 28 | 379,770 | D | 8 |
| Carter County (40019) | 48,555 | 48 | 322,758 | C | 28 |
| Cherokee County (40021) | 47,942 | 37 | 390,490 | D | 18 |
| Choctaw County (40023) | 14,297 | 17 | 275,319 | D | 7 |
| Cimarron County (40025) | 2,218 | 2 | 84,048 | D | 0 |
| Coal County (40029) | 5,320 | 6 | 99,562 | D | 0 |
| Cotton County (40033) | 5,485 | 6 | 153,311 | D | 0 |
| Craig County (40035) | 14,302 | 13 | 113,058 | D | 7 |
| Creek County (40037) | 72,830 | 55 | 1,087,344 | C | 27 |
| Custer County (40039) | 28,259 | 23 | 399,414 | D | 19 |
| Delaware County (40041) | 41,279 | 39 | 318,668 | D | 8 |
| Dewey County (40043) | 4,360 | 4 | 589,423 | D | 0 |
| Ellis County (40045) | 3,683 | 3 | 466,116 | D | 0 |
| Garfield County (40047) | 62,146 | 50 | 489,243 | D | 42 |
| Garvin County (40049) | 25,860 | 26 | 226,791 | C | 8 |
| Grady County (40051) | 56,606 | 46 | 470,852 | D | 14 |
| Grant County (40053) | 4,131 | 4 | 86,061 | D | 0 |
| Greer County (40055) | 5,489 | 6 | 187,635 | D | 0 |
| Harmon County (40057) | 2,406 | 3 | 102,238 | D | 0 |
| Harper County (40059) | 3,203 | 2 | 333,280 | D | 0 |
| Haskell County (40061) | 11,683 | 11 | 358,992 | D | 0 |
| Hughes County (40063) | 13,389 | 14 | 648,800 | D | 7 |
| Jackson County (40065) | 24,678 | 24 | 280,778 | D | 18 |
| Jefferson County (40067) | 5,380 | 6 | 121,824 | D | 0 |
| Johnston County (40069) | 10,278 | 10 | 120,626 | D | 0 |
| Kay County (40071) | 43,625 | 40 | 213,201 | D | 32 |
| Kingfisher County (40073) | 15,430 | 12 | 633,376 | D | 0 |
| Kiowa County (40075) | 8,383 | 9 | 329,532 | D | 0 |
| Latimer County (40077) | 9,518 | 8 | 289,537 | D | 0 |
| Le Flore County (40079) | 49,053 | 40 | 525,072 | C | 11 |
| Lincoln County (40081) | 34,219 | 25 | 778,372 | D | 1 |
| Logan County (40083) | 51,938 | 39 | 741,585 | C | 20 |
| Love County (40085) | 10,261 | 7 | 180,185 | D | 0 |
| McClain County (40087) | 45,273 | 31 | 1,093,770 | C | 7 |
| McCurtain County (40089) | 30,863 | 33 | 503,184 | D | 10 |
| McIntosh County (40091) | 19,400 | 20 | 743,191 | D | 0 |
| Major County (40093) | 7,628 | 7 | 593,307 | D | 0 |
| Marshall County (40095) | 15,792 | 14 | 173,027 | D | 0 |
| Mayes County (40097) | 39,604 | 32 | 205,717 | D | 10 |
| Murray County (40099) | 13,753 | 14 | 168,875 | D | 5 |
| Muskogee County (40101) | 66,444 | 62 | 818,022 | D | 45 |
| Noble County (40103) | 10,897 | 11 | 342,999 | C | 6 |
| Nowata County (40105) | 9,435 | 12 | 67,389 | D | 0 |
| Okfuskee County (40107) | 11,278 | 12 | 830,536 | D | 0 |
| Okmulgee County (40111) | 36,899 | 37 | 681,876 | D | 22 |
| Osage County (40113) | 45,997 | 40 | 780,926 | C | 15 |
| Ottawa County (40115) | 30,341 | 30 | 145,539 | D | 18 |
| Pawnee County (40117) | 15,795 | 16 | 361,644 | C | 0 |
| Payne County (40119) | 82,972 | 64 | 802,628 | C | 48 |
| Pittsburg County (40121) | 43,561 | 43 | 1,204,321 | D | 24 |
| Pontotoc County (40123) | 38,235 | 34 | 472,171 | D | 23 |
| Pottawatomie County (40125) | 73,463 | 57 | 847,704 | D | 36 |
| Pushmataha County (40127) | 10,790 | 10 | 278,069 | D | 0 |
| Roger Mills County (40129) | 3,359 | 3 | 381,260 | D | 0 |
| Rogers County (40131) | 98,610 | 58 | 489,614 | C | 32 |
| Seminole County (40133) | 23,494 | 27 | 651,075 | D | 11 |
| Sequoyah County (40135) | 39,860 | 31 | 407,954 | C | 8 |
| Stephens County (40137) | 43,551 | 37 | 157,675 | D | 19 |
| Texas County (40139) | 20,774 | 19 | 133,313 | D | 10 |
| Tillman County (40141) | 6,910 | 9 | 165,407 | D | 0 |
| Wagoner County (40145) | 86,609 | 49 | 648,613 | C | 37 |
| Washington County (40147) | 53,326 | 45 | 170,581 | D | 37 |
| Washita County (40149) | 10,815 | 10 | 176,125 | D | 0 |
| Woods County (40151) | 8,596 | 11 | 814,930 | D | 8 |
| Woodward County (40153) | 20,158 | 19 | 625,019 | D | 13 |
| **72 counties** | **1,950,784** | **1,661** | **29,899,678** | 14 C, 58 D | 748 |

- OpenStreetMap: the Oklahoma cut of the 21 Nov 2026 `us-south-latest.osm.pbf` (download.openstreetmap.fr; 4,623,607,998 bytes,
  md5 `aaee92b7cea7116859b6f51c768d7830`, equal to the published `us-south.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z
  from `us-south.state.txt`). Arkansas, Louisiana and Oklahoma were cut from it one at a time with
  `national/osm_split.py us-south --states AR,LA,OK --per-pass 1` (osmium `extract -s smart`, union of the state's county
  boxes plus 0.05 degrees): Arkansas 146 s, peak osmium memory 4.08 GB, 125 MB; Louisiana 140 s, 4.11 GB, 167 MB; Oklahoma
  142 s, 4.15 GB, 194 MB. The regional file was deleted once the three were cut (it was on disk for the cuts only). Oklahoma
  build: fetch 10-53 s, build 94-110 s per county, three at a time (the tests, the upload and the checks ran alongside),
  about 48 min from the first county to the last.
- Bus frequency: 61 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 11 have values. Rail distance: 69 counties have none; 3 have values.
- Census spot check: 72 counties, 1,636 of 1,636 values equal (0% mismatch). Tract-median flags: 72 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Oklahoma has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS holds IL, VA, UT, PA, ME and
  TN only, checked, not OK); all 72 files say "Not connected for Oklahoma yet: crash gaps are not scored and crash-based
  projects are not proposed". No crash counts were built.
- Tests run: `npm test` 1,737 of 1,737 (50 files), `npm run typecheck` clean. `app/data/intercity_transit_corridors.json`:
  Perry OK (Noble, 40103) and Ponca City OK (Kay, 40071), the two Heartland Flyer extension stops, now say
  `county_on_page: true` (2 lines), as `tests/unit/transitCorridors.test.ts` requires.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to many tries first (Stephens's road query failed all 8 tries once and was run again). Jefferson (40067, on the Red River and the Texas line) 1,728 = 1,728 roads, 0 = 0 bus stops (0 missing, 0 extra). Stephens
  (40137): bus stops 0 = 0; **roads 3,403 on Overpass, 3,427 in the extract (15 only on Overpass, 39 only in the extract)**.
  Read from the OpenStreetMap API (`/api/0.6/way/<id>/history`; result in
  `southcentral_osm_xcheck_40137_history_2026-11-22.json`), every one of the 54 ways was edited after the extract's snapshot
  (2026-11-21T01:28:06Z): the 15 only on Overpass were created between 2026-11-21T12:41Z and 2026-11-22T22:56Z (version 1
  or 2); of the 39 only in the extract, 6 have since been deleted, 30 now carry `highway=service` and 1 `highway=track` (not
  in the compared classes), and 2 (way 14763346, Cox City Road, version 10 of 2026-11-21T21:17Z, and way 14796152, N2940
  Road, version 5 of 2026-11-22T22:56Z) were split or reshaped so that none of their nodes now lies inside the box. So the
  differences are all roads edited or added after the extract was made; none is a road the extract misses that existed at
  its snapshot. The extract's snapshot is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9261`): Sequoyah (40135) and Garfield (40047), 3 points each (picked with seed 20261123 from
  the state's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD
  rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6
  points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,876,134,325 bytes (3,159 objects); dry run "73 files, net +0.030 GB, projected 1.906 GB"; after
  1,906,052,105 bytes (3,231 objects): 29,917,780 bytes added (the 72 data files, 29,899,678, plus the larger
  `manifest.json`).

Files: `data/backtests/southcentral_ok_census_spot_2026-11-22.json`, `data/backtests/southcentral_osm_xcheck_40137_2026-11-22.json`,
`..._40137_history_...`, `..._40067_...`, `data/backtests/live_check_panels_2026-11-22_southcentral_ok.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Arkansas (67 of 67 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Arkansas County (05001) | 16,515 | 14 | 235,771 | D | 7 |
| Ashley County (05003) | 18,429 | 20 | 198,841 | D | 10 |
| Baxter County (05005) | 42,407 | 30 | 639,621 | D | 18 |
| Boone County (05009) | 38,138 | 24 | 471,697 | D | 14 |
| Bradley County (05011) | 10,208 | 12 | 193,480 | D | 9 |
| Calhoun County (05013) | 4,704 | 5 | 200,595 | D | 0 |
| Carroll County (05015) | 28,626 | 20 | 481,318 | D | 4 |
| Chicot County (05017) | 9,765 | 12 | 196,394 | D | 0 |
| Clark County (05019) | 21,125 | 18 | 820,579 | C | 9 |
| Clay County (05021) | 14,280 | 13 | 171,286 | D | 0 |
| Cleburne County (05023) | 25,226 | 21 | 205,286 | D | 6 |
| Cleveland County (05025) | 7,453 | 8 | 134,106 | D | 0 |
| Columbia County (05027) | 22,349 | 19 | 164,398 | D | 11 |
| Conway County (05029) | 21,054 | 16 | 285,432 | D | 7 |
| Crawford County (05033) | 61,139 | 44 | 429,415 | C | 26 |
| Crittenden County (05035) | 47,266 | 43 | 428,493 | C | 33 |
| Cross County (05037) | 16,543 | 16 | 136,022 | D | 7 |
| Dallas County (05039) | 6,242 | 9 | 246,456 | D | 0 |
| Desha County (05041) | 10,786 | 12 | 226,114 | D | 6 |
| Drew County (05043) | 17,046 | 18 | 170,777 | D | 11 |
| Franklin County (05047) | 17,326 | 12 | 243,899 | D | 0 |
| Fulton County (05049) | 12,302 | 12 | 247,251 | D | 0 |
| Grant County (05053) | 18,242 | 11 | 208,746 | D | 4 |
| Greene County (05055) | 46,432 | 31 | 222,893 | D | 21 |
| Hempstead County (05057) | 19,508 | 20 | 247,403 | C | 16 |
| Hot Spring County (05059) | 33,180 | 26 | 518,143 | C | 15 |
| Howard County (05061) | 12,583 | 12 | 290,639 | D | 0 |
| Independence County (05063) | 38,175 | 30 | 301,186 | C | 12 |
| Izard County (05065) | 14,009 | 10 | 283,509 | D | 0 |
| Jackson County (05067) | 16,712 | 17 | 240,124 | C | 9 |
| Jefferson County (05069) | 64,802 | 67 | 370,454 | D | 58 |
| Johnson County (05071) | 26,003 | 17 | 322,412 | D | 8 |
| Lafayette County (05073) | 6,136 | 9 | 149,261 | D | 0 |
| Lawrence County (05075) | 16,238 | 17 | 229,170 | C | 10 |
| Lee County (05077) | 8,359 | 10 | 126,623 | C | 0 |
| Lincoln County (05079) | 12,950 | 10 | 157,562 | D | 0 |
| Little River County (05081) | 11,821 | 14 | 242,284 | D | 0 |
| Logan County (05083) | 21,277 | 17 | 325,392 | D | 0 |
| Lonoke County (05085) | 75,272 | 41 | 338,716 | D | 21 |
| Madison County (05087) | 17,329 | 13 | 488,849 | D | 0 |
| Marion County (05089) | 17,228 | 17 | 604,852 | D | 0 |
| Miller County (05091) | 42,360 | 39 | 276,281 | C | 28 |
| Mississippi County (05093) | 39,126 | 44 | 409,419 | C | 28 |
| Monroe County (05095) | 6,589 | 8 | 186,868 | D | 0 |
| Montgomery County (05097) | 8,553 | 9 | 264,945 | D | 0 |
| Nevada County (05099) | 8,159 | 8 | 310,930 | D | 0 |
| Newton County (05101) | 7,112 | 6 | 482,775 | D | 0 |
| Ouachita County (05103) | 22,085 | 25 | 285,969 | D | 14 |
| Perry County (05105) | 10,101 | 9 | 278,581 | D | 0 |
| Phillips County (05107) | 15,450 | 24 | 220,795 | D | 16 |
| Pike County (05109) | 10,115 | 9 | 330,236 | D | 0 |
| Poinsett County (05111) | 22,543 | 23 | 164,309 | D | 7 |
| Polk County (05113) | 19,361 | 16 | 437,480 | D | 7 |
| Pope County (05115) | 64,131 | 41 | 412,359 | D | 23 |
| Prairie County (05117) | 8,064 | 10 | 209,498 | D | 0 |
| Randolph County (05121) | 18,838 | 17 | 239,665 | D | 7 |
| St. Francis County (05123) | 22,400 | 24 | 198,706 | D | 13 |
| Scott County (05127) | 9,816 | 9 | 345,958 | D | 0 |
| Searcy County (05129) | 7,859 | 10 | 502,514 | D | 0 |
| Sevier County (05133) | 15,712 | 11 | 248,348 | D | 6 |
| Sharp County (05135) | 17,773 | 18 | 311,436 | D | 0 |
| Stone County (05137) | 12,568 | 12 | 318,726 | D | 0 |
| Union County (05139) | 37,900 | 42 | 334,213 | D | 28 |
| Van Buren County (05141) | 15,998 | 17 | 334,234 | D | 0 |
| White County (05145) | 77,838 | 53 | 471,451 | D | 29 |
| Woodruff County (05147) | 6,026 | 9 | 175,515 | D | 0 |
| Yell County (05149) | 20,134 | 17 | 463,571 | D | 5 |
| **67 counties** | **1,491,796** | **1,297** | **20,410,231** | 11 C, 56 D | 563 |

- OpenStreetMap: the Arkansas cut of the 21 Nov 2026 `us-south-latest.osm.pbf` (see Oklahoma: 146 s, peak osmium memory 4.08 GB,
  125 MB; data timestamp 2026-11-21T01:28:06Z). Build: fetch 11-36 s, build 60-69 s per county, three at a time (the Oklahoma
  checks and upload ran alongside), about 32 min from the first county to the last.
- Bus frequency: 64 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 3 have values. Rail distance: 61 counties have none; 6 have values.
- Census spot check: 67 counties, 1,604 of 1,604 values equal (0% mismatch). Tract-median flags: 67 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Arkansas has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no AR); all 67 files say
  "Not connected for Arkansas yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,737 of 1,737 (50 files), `npm run typecheck` clean. No corridor stop's flag needed changing.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. White (05145) 7,100 = 7,100 roads, 1 = 1 bus stops (0 missing, 0 extra). Jefferson (05069): bus stops 0 = 0; **roads 6,437 on
  Overpass, 6,436 in the extract (5 only on Overpass, 4 only in the extract)**. Read from the OpenStreetMap API
  (`/api/0.6/way/<id>/history`; result in `southcentral_osm_xcheck_05069_history_2026-11-22.json`), all 9 ways were edited
  after the extract's snapshot (2026-11-21T01:28:06Z): of the 5 only on Overpass, 2 were created on 2026-11-21 at 17:35Z
  (version 1) and 3 older ways (12829972 Levee Road, 12839427 and 12839429 Pines Mall Drive) were changed on 2026-11-21 at
  16:43Z and 17:35Z (versions 3, 9 and 8); the 4 only in the extract have since been deleted. So the differences are all
  roads edited or added after the extract was made. The extract's snapshot is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9261`): Van Buren (05141) and Franklin (05047), 3 points each (picked with seed 20261123 from
  the state's sorted list). Arkansas's parcel service is on the page: all six points had the house panel on live parcel
  records and pass neighborhood, canopy, canopy goal, crash text, state laws, Census area, HUD rent, FEMA and console.
  **The USGS elevation row first showed "Not available (the service did not answer in time)" at 3 of the 6 points (Van Buren
  051414602003, Franklin 050479501001 and 050479501003)**; the page's USGS call has a 6 s limit. Re-opened alone, Van Buren's
  showed 742 ft, equal to the 742 ft USGS had given for that point (the second USGS call did not answer, so that row is
  recorded as not checkable, not as a pass); Franklin's two showed "Not available" again, so Franklin was run again as a
  separate check (`..._southcentral_ar_rerun05047.json`): 24 of 27 checks pass, 2 not checkable (USGS did not answer the
  script), and 1 row (050479501003) again "Not available" on the page while USGS answered the script with 378 ft. Timed with
  `curl`, USGS's elevation service (epqs.nationalmap.gov) answered for that point's coordinates in 18.2 s and 16.1 s and then
  with a 504 after 29.5 s, so the page's 6 s limit is the cause. In the main result file: 49 pass, 5 recorded failures (those
  rows' first tries and re-opens, each a "Not available" row), 3 not checkable; the first-try file is kept as
  `..._southcentral_ar_first_try.json`. No wrong value was shown anywhere: where the service did not answer the page said "Not
  available". Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,906,052,105 bytes (3,231 objects); dry run "68 files, net +0.020 GB, projected 1.926 GB"; after
  1,926,479,192 bytes (3,298 objects): 20,427,087 bytes added (the 67 data files, 20,410,231, plus the larger
  `manifest.json`). The upload script printed a JSON decoding error (`Extra data`) at the end of the run, after the files
  were sent; a second `--dry-run` found 0 files to upload and 3,298 objects, and the account total equals the figure above.

Files: `data/backtests/southcentral_ar_census_spot_2026-11-22.json`, `data/backtests/southcentral_osm_xcheck_05069_2026-11-22.json`,
`..._05069_history_...`, `..._05145_...`, `data/backtests/live_check_panels_2026-11-23_southcentral_ar.json`, `..._ar_first_try.json`,
`..._ar_rerun05047.json`, `data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Louisiana (50 of 50 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Acadia Parish (22001) | 56,955 | 107 | 345,644 | D | 46 |
| Allen Parish (22003) | 22,477 | 19 | 540,256 | D | 7 |
| Assumption Parish (22007) | 20,484 | 19 | 161,731 | D | 14 |
| Avoyelles Parish (22009) | 38,905 | 31 | 467,400 | C | 9 |
| Beauregard Parish (22011) | 36,676 | 27 | 572,696 | D | 12 |
| Bienville Parish (22013) | 12,638 | 16 | 338,161 | D | 0 |
| Caldwell Parish (22021) | 9,500 | 9 | 191,504 | D | 0 |
| Cameron Parish (22023) | 5,015 | 10 | 219,866 | D | 0 |
| Catahoula Parish (22025) | 8,583 | 9 | 461,668 | D | 0 |
| Claiborne Parish (22027) | 13,833 | 17 | 201,125 | D | 0 |
| Concordia Parish (22029) | 18,174 | 20 | 357,429 | D | 16 |
| De Soto Parish (22031) | 27,026 | 25 | 413,998 | D | 9 |
| East Carroll Parish (22035) | 7,072 | 8 | 144,696 | D | 0 |
| East Feliciana Parish (22037) | 19,271 | 16 | 200,066 | D | 0 |
| Evangeline Parish (22039) | 32,060 | 64 | 478,518 | D | 25 |
| Franklin Parish (22041) | 19,408 | 15 | 280,717 | D | 7 |
| Grant Parish (22043) | 22,095 | 16 | 1,040,916 | D | 0 |
| Iberia Parish (22045) | 68,599 | 141 | 609,888 | C | 118 |
| Iberville Parish (22047) | 29,815 | 22 | 663,972 | C | 12 |
| Jackson Parish (22049) | 14,884 | 15 | 246,845 | D | 8 |
| Jefferson Davis Parish (22053) | 31,924 | 26 | 365,135 | C | 12 |
| Lafourche Parish (22057) | 96,252 | 77 | 1,313,352 | C | 69 |
| LaSalle Parish (22059) | 14,789 | 14 | 728,320 | D | 0 |
| Lincoln Parish (22061) | 48,174 | 37 | 257,255 | D | 27 |
| Madison Parish (22065) | 9,513 | 10 | 265,857 | D | 9 |
| Morehouse Parish (22067) | 24,551 | 25 | 335,050 | D | 18 |
| Natchitoches Parish (22069) | 36,693 | 39 | 1,213,525 | D | 23 |
| Plaquemines Parish (22075) | 22,803 | 24 | 984,556 | C | 14 |
| Pointe Coupee Parish (22077) | 20,217 | 18 | 242,403 | D | 11 |
| Red River Parish (22081) | 7,443 | 8 | 162,731 | D | 0 |
| Richland Parish (22083) | 19,822 | 17 | 345,385 | D | 0 |
| Sabine Parish (22085) | 21,977 | 26 | 742,157 | D | 0 |
| St. Bernard Parish (22087) | 44,419 | 50 | 788,788 | C | 47 |
| St. Charles Parish (22089) | 51,396 | 36 | 388,987 | C | 32 |
| St. Helena Parish (22091) | 10,858 | 8 | 102,731 | D | 0 |
| St. James Parish (22093) | 19,528 | 19 | 109,199 | D | 12 |
| St. John the Baptist Parish (22095) | 40,743 | 31 | 429,238 | C | 28 |
| St. Landry Parish (22097) | 81,670 | 151 | 752,044 | D | 81 |
| St. Martin Parish (22099) | 51,353 | 96 | 1,093,375 | C | 63 |
| St. Mary Parish (22101) | 47,828 | 48 | 506,676 | D | 45 |
| Tensas Parish (22107) | 3,935 | 5 | 228,367 | D | 0 |
| Union Parish (22111) | 20,821 | 22 | 424,402 | D | 0 |
| Vermilion Parish (22113) | 57,123 | 94 | 399,039 | D | 56 |
| Vernon Parish (22115) | 47,117 | 48 | 1,181,082 | D | 30 |
| Washington Parish (22117) | 45,120 | 34 | 839,544 | D | 14 |
| Webster Parish (22119) | 35,820 | 39 | 294,880 | D | 27 |
| West Baton Rouge Parish (22121) | 27,974 | 15 | 360,697 | C | 13 |
| West Carroll Parish (22123) | 9,464 | 11 | 131,968 | D | 0 |
| West Feliciana Parish (22125) | 15,327 | 10 | 209,938 | D | 0 |
| Winn Parish (22127) | 13,467 | 16 | 474,365 | D | 10 |
| **50 counties** | **1,461,591** | **1,660** | **23,608,142** | 11 C, 39 D | 924 |

- OpenStreetMap: the Louisiana cut of the 21 Nov 2026 `us-south-latest.osm.pbf` (see Oklahoma: 140 s, peak osmium memory 4.11 GB,
  167 MB; data timestamp 2026-11-21T01:28:06Z). Build: fetch 9-78 s, build 78-143 s per county, three at a time (the Arkansas
  checks, tests and upload ran alongside), about 31 min from the first county to the last.
- Bus frequency: 41 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 9 have values. Rail distance: 47 counties have none; 3 have values.
- Census spot check: 50 counties, 1,196 of 1,196 values equal (0% mismatch). Tract-median flags: 50 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Louisiana has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no LA); all 50 files say
  "Not connected for Louisiana yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,737 of 1,737 (50 files), `npm run typecheck` clean. `app/data/intercity_transit_corridors.json`:
  Ruston LA (Lincoln Parish, 22061) now says `county_on_page: true` (1 line), as `tests/unit/transitCorridors.test.ts`
  requires.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. St. John the Baptist (22095) 10,730 = 10,730 roads, 132 = 132 bus stops; St. Bernard (22087) 6,497 = 6,497
  roads, 5 = 5 bus stops (0 missing, 0 extra in both). The extract's snapshot is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9261`): West Feliciana (22125) and St. John the Baptist (22095), 3 points each (picked with
  seed 20261123 from the state's sorted list). Neither parish has a parcel service on the page, so the house-panel rows
  (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console
  pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,981,492,955 bytes (3,414 objects; the Virginia, West Virginia and Colorado job had uploaded files since my
  Arkansas upload); dry run "51 files, net +0.024 GB, projected 2.005 GB"; after 2,005,115,500 bytes (3,464 objects):
  23,622,545 bytes added (the 50 data files, 23,608,142, plus the larger `manifest.json`: 666,384 bytes in the bucket when I
  started, which was the other job's copy, replaced by this worktree's copy of 680,787 bytes).

Files: `data/backtests/southcentral_la_census_spot_2026-11-22.json`, `data/backtests/southcentral_osm_xcheck_22095_2026-11-22.json`,
`..._22087_...`, `data/backtests/live_check_panels_2026-11-23_southcentral_la.json`,
`data/backtests/acs_fallback_mismatches_2026-11-23.json`.

## Texas, part 1 of 2 (101 of 101 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Archer County (48009) | 8,867 | 9 | 177,954 | D | 1 |
| Armstrong County (48011) | 1,822 | 3 | 115,342 | D | 0 |
| Atascosa County (48013) | 51,008 | 29 | 407,465 | D | 12 |
| Bailey County (48017) | 6,913 | 6 | 43,756 | D | 5 |
| Bandera County (48019) | 22,021 | 21 | 442,276 | D | 0 |
| Baylor County (48023) | 3,485 | 5 | 101,135 | D | 0 |
| Blanco County (48031) | 12,446 | 11 | 470,447 | D | 0 |
| Bosque County (48035) | 18,687 | 17 | 363,226 | D | 0 |
| Briscoe County (48045) | 1,301 | 2 | 148,842 | D | 0 |
| Brown County (48049) | 38,347 | 35 | 250,942 | D | 22 |
| Burnet County (48053) | 52,652 | 35 | 952,450 | C | 19 |
| Caldwell County (48055) | 48,669 | 29 | 586,909 | D | 19 |
| Calhoun County (48057) | 19,868 | 20 | 309,133 | D | 11 |
| Callahan County (48059) | 14,241 | 12 | 145,732 | D | 0 |
| Carson County (48065) | 5,801 | 6 | 90,773 | D | 0 |
| Castro County (48069) | 7,344 | 7 | 82,306 | D | 0 |
| Childress County (48075) | 6,743 | 7 | 160,920 | D | 6 |
| Clay County (48077) | 10,495 | 11 | 189,166 | D | 0 |
| Cochran County (48079) | 2,550 | 3 | 40,908 | D | 0 |
| Coleman County (48083) | 7,833 | 11 | 222,316 | D | 6 |
| Collingsworth County (48087) | 2,588 | 4 | 138,840 | D | 0 |
| Comanche County (48093) | 13,950 | 14 | 219,920 | D | 0 |
| Coryell County (48099) | 84,748 | 51 | 772,110 | C | 44 |
| Cottle County (48101) | 1,368 | 3 | 454,905 | D | 0 |
| Crosby County (48107) | 5,041 | 6 | 107,862 | D | 0 |
| Dallam County (48111) | 7,298 | 6 | 77,419 | D | 5 |
| Deaf Smith County (48117) | 18,460 | 17 | 105,021 | D | 16 |
| DeWitt County (48123) | 20,016 | 18 | 459,015 | D | 11 |
| Dickens County (48125) | 1,747 | 3 | 113,793 | D | 0 |
| Donley County (48129) | 3,257 | 4 | 153,670 | D | 0 |
| Eastland County (48133) | 18,011 | 19 | 200,153 | D | 0 |
| Falls County (48145) | 17,291 | 14 | 452,403 | D | 6 |
| Fayette County (48149) | 25,042 | 27 | 601,787 | D | 7 |
| Fisher County (48151) | 3,655 | 5 | 163,525 | D | 0 |
| Floyd County (48153) | 5,216 | 8 | 87,021 | D | 0 |
| Foard County (48155) | 991 | 1 | 160,165 | D | 0 |
| Freestone County (48161) | 20,049 | 17 | 251,769 | C | 0 |
| Frio County (48163) | 18,582 | 14 | 190,567 | D | 9 |
| Garza County (48169) | 5,118 | 6 | 141,921 | D | 0 |
| Gillespie County (48171) | 27,524 | 19 | 275,226 | D | 12 |
| Goliad County (48175) | 7,141 | 7 | 185,563 | D | 0 |
| Gonzales County (48177) | 19,851 | 16 | 541,504 | D | 8 |
| Gray County (48179) | 21,045 | 25 | 172,757 | D | 21 |
| Hale County (48189) | 32,131 | 30 | 134,374 | D | 21 |
| Hall County (48191) | 2,820 | 3 | 134,178 | D | 0 |
| Hamilton County (48193) | 8,406 | 7 | 226,642 | D | 0 |
| Hansford County (48195) | 5,119 | 5 | 65,477 | D | 0 |
| Hardeman County (48197) | 3,501 | 5 | 141,806 | D | 0 |
| Hartley County (48205) | 5,215 | 4 | 79,094 | D | 3 |
| Haskell County (48207) | 5,421 | 6 | 143,225 | D | 0 |
| Hemphill County (48211) | 3,234 | 4 | 106,992 | D | 0 |
| Hill County (48217) | 37,328 | 27 | 399,732 | D | 9 |
| Hockley County (48219) | 21,363 | 18 | 102,978 | D | 12 |
| Hutchinson County (48233) | 20,184 | 22 | 131,114 | D | 16 |
| Jack County (48237) | 8,882 | 7 | 163,457 | D | 0 |
| Jackson County (48239) | 15,152 | 11 | 309,050 | D | 6 |
| Jones County (48253) | 20,304 | 16 | 188,722 | D | 0 |
| Karnes County (48255) | 14,968 | 12 | 273,373 | D | 0 |
| Kendall County (48259) | 48,567 | 27 | 487,244 | D | 12 |
| Kent County (48263) | 734 | 1 | 105,084 | D | 0 |
| Kerr County (48265) | 53,489 | 37 | 596,316 | D | 31 |
| King County (48269) | 211 | 1 | 169,466 | D | 0 |
| Knox County (48275) | 3,307 | 4 | 126,303 | D | 0 |
| Lamb County (48279) | 12,828 | 12 | 97,203 | D | 6 |
| Lampasas County (48281) | 22,715 | 16 | 285,132 | D | 10 |
| Lavaca County (48285) | 20,552 | 18 | 344,484 | D | 4 |
| Lee County (48287) | 17,971 | 14 | 522,543 | D | 0 |
| Limestone County (48293) | 22,283 | 19 | 345,717 | C | 8 |
| Lipscomb County (48295) | 2,918 | 2 | 66,925 | D | 0 |
| Llano County (48299) | 22,424 | 19 | 287,433 | D | 10 |
| Lynn County (48305) | 5,752 | 4 | 71,054 | D | 0 |
| McMullen County (48311) | 700 | 1 | 78,099 | D | 0 |
| Matagorda County (48321) | 36,329 | 36 | 586,841 | D | 21 |
| Medina County (48325) | 53,547 | 33 | 452,821 | D | 7 |
| Milam County (48331) | 25,567 | 20 | 396,210 | D | 11 |
| Mills County (48333) | 4,511 | 5 | 186,673 | D | 0 |
| Mitchell County (48335) | 9,018 | 7 | 127,808 | D | 5 |
| Montague County (48337) | 21,046 | 21 | 187,851 | C | 9 |
| Moore County (48341) | 21,373 | 18 | 106,714 | D | 13 |
| Motley County (48345) | 1,183 | 2 | 121,984 | D | 0 |
| Nolan County (48353) | 14,454 | 17 | 159,926 | D | 14 |
| Ochiltree County (48357) | 9,786 | 9 | 67,458 | D | 9 |
| Oldham County (48359) | 2,249 | 2 | 105,389 | D | 0 |
| Parmer County (48369) | 9,731 | 9 | 87,564 | D | 0 |
| Roberts County (48393) | 832 | 1 | 80,963 | D | 0 |
| Runnels County (48399) | 9,874 | 10 | 126,127 | D | 0 |
| San Saba County (48411) | 5,696 | 6 | 229,151 | D | 0 |
| Scurry County (48415) | 16,488 | 15 | 176,276 | D | 13 |
| Shackelford County (48417) | 3,175 | 4 | 109,657 | D | 0 |
| Sherman County (48421) | 2,295 | 2 | 59,013 | D | 0 |
| Stephens County (48429) | 9,351 | 10 | 135,272 | D | 9 |
| Stonewall County (48433) | 1,227 | 2 | 161,609 | D | 0 |
| Swisher County (48437) | 6,937 | 8 | 120,930 | D | 0 |
| Terry County (48445) | 11,629 | 13 | 95,677 | D | 11 |
| Throckmorton County (48447) | 1,639 | 2 | 105,076 | D | 0 |
| Victoria County (48469) | 91,413 | 71 | 483,024 | D | 58 |
| Wheeler County (48483) | 4,862 | 5 | 120,807 | D | 0 |
| Wilbarger County (48487) | 12,616 | 12 | 134,555 | D | 10 |
| Wilson County (48493) | 52,781 | 31 | 535,763 | C | 6 |
| Yoakum County (48501) | 7,571 | 6 | 50,651 | D | 0 |
| Young County (48503) | 18,029 | 16 | 172,309 | D | 10 |
| **101 counties** | **1,592,770** | **1,328** | **22,996,230** | 6 C, 95 D | 594 |

- Texas has 211 missing counties; they were built in two parts by the OpenStreetMap file the registry names for each, so
  that each part could be built, checked and uploaded on its own. Part 1 is the 101 counties on the `north` sub-region file
  (63), the `central` file (33) and the whole-state file `texas-latest.osm.pbf` (5); part 2 is the other 110 (see the next
  section). Each file was downloaded once from openstreetmap.fr and shared by the counties that use it. Data timestamps:
  `north` and `central` 2026-11-21T01:04:36Z, the whole-state file (813,256,716 bytes) 2026-11-21T01:07:35Z; each county's
  sources list names its own. Build: fetch 9-60 s, build 34-42 s per county on `north`, 80-95 s on `central`, 338-349 s for
  the 5 that clip the whole-state file, three at a time (the Louisiana checks, tests and upload ran alongside), about 51 min
  from the first county to the last.
- Bus frequency: 99 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 2 have values. Rail distance: 99 counties have none; 2 have values.
- Census spot check: 101 counties, 2,072 of 2,072 values equal (0% mismatch). Tract-median flags: 101 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Texas has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no TX); all 101 files say
  "Not connected for Texas yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,737 of 1,737 (50 files), `npm run typecheck` clean. `app/data/intercity_transit_corridors.json`:
  Flatonia TX (Fayette County, 48149) now says `county_on_page: true` (1 line), as `tests/unit/transitCorridors.test.ts`
  requires.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from this part's sorted
  list): it answered 504 to some tries first. Matagorda (48321, whole-state file, on the Gulf coast) 6,396 = 6,396 roads, 1 = 1 bus stops; Lampasas (48281, `central` file)
  2,850 = 2,850 roads, 0 = 0 bus stops (0 missing, 0 extra in both). The extracts' snapshots are 2026-11-21T01:07:35Z and
  2026-11-21T01:04:36Z.
- Live check from R2 (`LIVE_PORT=9261`): Wheeler (48483) and Medina (48325), 3 points each (picked with seed 20261123 from
  this part's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD rent,
  FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6 points
  (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 2,005,115,500 bytes (3,464 objects); dry run "102 files, net +0.023 GB, projected 2.028 GB"; after
  2,028,137,097 bytes (3,565 objects): 23,021,597 bytes added (the 101 data files, 22,996,230, plus the larger
  `manifest.json`).

Files: `data/backtests/southcentral_txa_census_spot_2026-11-22.json`, `data/backtests/southcentral_osm_xcheck_48321_2026-11-22.json`,
`..._48281_...`, `data/backtests/live_check_panels_2026-11-23_southcentral_txa.json`,
`data/backtests/acs_fallback_mismatches_2026-11-23.json`.

## Texas, part 2 of 2 (110 of 110 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Anderson County (48001) | 58,439 | 39 | 529,850 | C | 24 |
| Andrews County (48003) | 18,610 | 12 | 66,133 | D | 12 |
| Angelina County (48005) | 87,275 | 68 | 686,673 | C | 41 |
| Aransas County (48007) | 24,876 | 26 | 188,940 | D | 24 |
| Austin County (48015) | 31,170 | 21 | 396,786 | D | 7 |
| Bee County (48025) | 31,083 | 25 | 212,405 | D | 17 |
| Borden County (48033) | 713 | 1 | 68,330 | D | 0 |
| Bowie County (48037) | 92,115 | 80 | 449,092 | C | 54 |
| Brewster County (48043) | 9,503 | 11 | 680,927 | C | 8 |
| Brooks County (48047) | 6,943 | 7 | 98,938 | D | 6 |
| Burleson County (48051) | 18,857 | 20 | 560,042 | D | 0 |
| Camp County (48063) | 12,798 | 11 | 142,978 | D | 0 |
| Cass County (48067) | 28,568 | 29 | 279,068 | D | 11 |
| Chambers County (48071) | 51,498 | 22 | 530,469 | C | 7 |
| Cherokee County (48073) | 51,886 | 37 | 429,844 | C | 13 |
| Coke County (48081) | 3,353 | 4 | 103,355 | C | 0 |
| Colorado County (48089) | 21,006 | 18 | 422,186 | D | 0 |
| Concho County (48095) | 3,328 | 2 | 93,389 | D | 0 |
| Cooke County (48097) | 43,046 | 31 | 346,294 | C | 18 |
| Crane County (48103) | 4,610 | 5 | 84,335 | D | 0 |
| Crockett County (48105) | 2,822 | 5 | 180,790 | D | 0 |
| Culberson County (48109) | 2,195 | 3 | 421,813 | D | 0 |
| Dawson County (48115) | 12,134 | 14 | 96,798 | D | 12 |
| Delta County (48119) | 5,438 | 4 | 165,717 | D | 0 |
| Dimmit County (48127) | 8,380 | 8 | 164,938 | D | 6 |
| Duval County (48131) | 9,742 | 10 | 102,313 | D | 0 |
| Edwards County (48137) | 1,290 | 2 | 435,329 | D | 0 |
| Erath County (48143) | 43,794 | 28 | 350,089 | D | 15 |
| Fannin County (48147) | 37,326 | 30 | 274,438 | D | 10 |
| Franklin County (48159) | 10,632 | 9 | 125,576 | D | 0 |
| Gaines County (48165) | 22,232 | 15 | 127,802 | D | 10 |
| Glasscock County (48173) | 1,068 | 2 | 43,815 | D | 0 |
| Grimes County (48185) | 31,340 | 21 | 351,067 | D | 7 |
| Hardin County (48199) | 57,642 | 41 | 607,117 | C | 26 |
| Harrison County (48203) | 70,155 | 55 | 517,852 | C | 39 |
| Henderson County (48213) | 84,862 | 66 | 611,571 | D | 34 |
| Hood County (48221) | 65,894 | 36 | 352,679 | D | 27 |
| Hopkins County (48223) | 37,784 | 28 | 317,256 | D | 15 |
| Houston County (48225) | 22,051 | 20 | 445,058 | D | 7 |
| Howard County (48227) | 32,290 | 28 | 155,005 | D | 27 |
| Hudspeth County (48229) | 3,403 | 4 | 404,057 | D | 0 |
| Irion County (48235) | 1,409 | 2 | 65,230 | D | 0 |
| Jasper County (48241) | 32,727 | 28 | 941,476 | D | 14 |
| Jeff Davis County (48243) | 1,865 | 2 | 381,157 | D | 0 |
| Jim Hogg County (48247) | 4,727 | 5 | 92,140 | D | 0 |
| Jim Wells County (48249) | 38,850 | 34 | 268,662 | D | 21 |
| Kenedy County (48261) | 145 | 2 | 39,940 | D | 0 |
| Kimble County (48267) | 4,389 | 6 | 198,067 | D | 0 |
| Kinney County (48271) | 3,157 | 4 | 277,172 | D | 0 |
| Kleberg County (48273) | 30,579 | 28 | 179,593 | D | 24 |
| Lamar County (48277) | 50,669 | 40 | 323,649 | D | 25 |
| La Salle County (48283) | 6,839 | 5 | 133,217 | D | 0 |
| Leon County (48289) | 16,263 | 16 | 312,808 | D | 0 |
| Live Oak County (48297) | 11,620 | 12 | 211,509 | D | 0 |
| Loving County (48301) | 33 | 1 | 44,528 | D | 0 |
| McCulloch County (48307) | 7,514 | 10 | 167,992 | D | 7 |
| Madison County (48313) | 13,648 | 10 | 195,992 | D | 0 |
| Marion County (48315) | 9,737 | 11 | 183,816 | C | 0 |
| Martin County (48317) | 5,218 | 4 | 80,932 | D | 0 |
| Mason County (48319) | 3,955 | 4 | 175,171 | D | 0 |
| Maverick County (48323) | 58,082 | 37 | 299,591 | D | 36 |
| Menard County (48327) | 1,955 | 3 | 94,375 | D | 0 |
| Morris County (48343) | 12,076 | 14 | 142,149 | D | 0 |
| Nacogdoches County (48347) | 65,162 | 48 | 711,215 | C | 33 |
| Navarro County (48349) | 54,711 | 30 | 621,845 | D | 19 |
| Newton County (48351) | 12,093 | 14 | 467,243 | D | 0 |
| Orange County (48361) | 85,307 | 69 | 539,671 | C | 55 |
| Palo Pinto County (48363) | 29,295 | 23 | 308,419 | D | 14 |
| Panola County (48365) | 22,726 | 21 | 294,004 | D | 9 |
| Pecos County (48371) | 14,896 | 17 | 460,460 | C | 13 |
| Polk County (48373) | 52,800 | 48 | 667,696 | D | 13 |
| Presidio County (48377) | 5,930 | 6 | 495,696 | D | 0 |
| Rains County (48379) | 12,775 | 9 | 152,582 | D | 0 |
| Reagan County (48383) | 3,232 | 4 | 46,570 | D | 0 |
| Real County (48385) | 2,802 | 4 | 214,378 | D | 0 |
| Red River County (48387) | 11,611 | 16 | 292,166 | D | 0 |
| Reeves County (48389) | 12,664 | 11 | 356,329 | D | 10 |
| Refugio County (48391) | 6,707 | 8 | 198,550 | D | 0 |
| Robertson County (48395) | 17,167 | 14 | 314,196 | D | 0 |
| Rusk County (48401) | 52,842 | 43 | 440,086 | C | 22 |
| Sabine County (48403) | 10,023 | 11 | 396,007 | D | 0 |
| San Augustine County (48405) | 7,874 | 9 | 461,604 | D | 0 |
| San Jacinto County (48407) | 28,441 | 22 | 576,273 | D | 0 |
| San Patricio County (48409) | 70,181 | 49 | 365,684 | D | 38 |
| Schleicher County (48413) | 2,381 | 3 | 53,514 | D | 0 |
| Shelby County (48419) | 24,155 | 19 | 483,299 | D | 6 |
| Somervell County (48425) | 9,691 | 8 | 104,896 | D | 0 |
| Starr County (48427) | 66,067 | 46 | 406,889 | D | 40 |
| Sterling County (48431) | 1,468 | 1 | 51,703 | D | 0 |
| Sutton County (48435) | 3,277 | 4 | 162,389 | D | 0 |
| Terrell County (48443) | 835 | 1 | 173,598 | C | 0 |
| Titus County (48449) | 31,363 | 24 | 225,102 | D | 16 |
| Trinity County (48455) | 14,046 | 17 | 360,669 | D | 0 |
| Tyler County (48457) | 20,238 | 18 | 483,729 | D | 0 |
| Upshur County (48459) | 42,567 | 32 | 473,333 | C | 13 |
| Upton County (48461) | 3,191 | 3 | 53,019 | D | 0 |
| Uvalde County (48463) | 24,881 | 21 | 340,591 | D | 14 |
| Val Verde County (48465) | 47,741 | 40 | 438,191 | C | 37 |
| Van Zandt County (48467) | 62,649 | 39 | 432,186 | C | 0 |
| Walker County (48471) | 80,209 | 41 | 423,146 | D | 28 |
| Waller County (48473) | 61,552 | 27 | 573,320 | C | 9 |
| Ward County (48475) | 11,144 | 10 | 156,754 | D | 9 |
| Washington County (48477) | 36,647 | 29 | 416,675 | D | 16 |
| Wharton County (48481) | 41,794 | 35 | 522,548 | D | 25 |
| Willacy County (48489) | 20,139 | 16 | 147,539 | D | 11 |
| Winkler County (48495) | 7,454 | 9 | 40,114 | D | 8 |
| Wise County (48497) | 75,005 | 40 | 428,295 | D | 11 |
| Wood County (48499) | 46,961 | 36 | 429,802 | C | 8 |
| Zapata County (48505) | 13,841 | 14 | 178,559 | D | 12 |
| Zavala County (48507) | 9,412 | 9 | 213,536 | D | 7 |
| **110 counties** | **2,815,555** | **2,194** | **33,584,350** | 21 C, 89 D | 1100 |

- Part 2 of Texas: the 110 counties on the `northwest` (29), `west` (32), `southeast` (26) and `south` (23) sub-region
  files, each downloaded once from openstreetmap.fr and shared by the counties that use it (273,124,283, 47,315,523,
  170,840,503 and 45,501,350 bytes). Data timestamp of all four: 2026-11-23T01:09:51Z (newer than part 1's `north` and
  `central` files, 2026-11-21T01:04:36Z, which were downloaded earlier); each county's sources
  list names its own. Build: fetch 8-70 s; build 107-141 s per county on `northwest`, 44-55 s on `west`, 84-103 s on
  `southeast`, 29-40 s on `south`; three at a time (the part 1 checks, tests and upload ran alongside), about 59 min from the
  first county to the last.
- Bus frequency: 105 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 5 have values. Rail distance: 98 counties have none; 12 have values.
- Census spot check: 110 counties, 2,328 of 2,328 values equal (0% mismatch). Tract-median flags: 110 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Texas has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no TX); all 110 files say
  "Not connected for Texas yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,737 of 1,737 (50 files), `npm run typecheck` clean. `app/data/intercity_transit_corridors.json`:
  Mineola TX (Wood, 48499), Marshall TX (Harrison, 48203), Corsicana TX (Navarro, 48349), Hearne TX (Robertson, 48395) and
  Navasota TX (Grimes, 48185) now say `county_on_page: true` (5 lines), as `tests/unit/transitCorridors.test.ts` requires.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from this part's sorted
  list): it answered 504 to many tries first (Rains's road query failed all 8 tries once and was run again). Rains (48379) 1,690 = 1,690 roads, 0 = 0 bus stops (0 missing, 0 extra). Navarro (48349): bus stops 0 = 0; **roads 12,275 on
  Overpass, 11,445 in the extract (830 only on Overpass, 0 only in the extract)**. The check's box reaches 0.02 degrees past
  the county, so it was run again with the same box and classes asking Overpass for each road's centre point
  (`xcheck_inside.py` in the session's scratch folder, `out center`; result, with all 830 IDs, in
  `southcentral_osm_xcheck_inside_48349_2026-11-23.json`) and each road placed inside or outside the county (the union of
  the county's block-group shapes): of the 12,275 roads, 6,439 have their centre inside Navarro County and **all 6,439 are in
  the extract (0 missing inside the county)**; all 830 roads that are not in the extract have their centre outside the
  county, in the margin of the box. The extract's snapshot is 2026-11-23T01:09:51Z (both counties are on the `northwest`
  file).
- Live check from R2 (`LIVE_PORT=9261`): Uvalde (48463) and Reagan (48383), 3 points each (picked with seed 20261123 from
  this part's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD rent,
  FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6 points
  (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 2,028,137,097 bytes (3,565 objects); dry run "111 files, net +0.034 GB, projected 2.062 GB"; after
  2,061,749,096 bytes (3,675 objects): 33,611,999 bytes added (the 110 data files, 33,584,350, plus the larger
  `manifest.json`).

Files: `data/backtests/southcentral_txb_census_spot_2026-11-22.json`, `data/backtests/southcentral_osm_xcheck_48379_2026-11-23.json`,
`..._48349_...`, `..._xcheck_inside_48349_...`, `data/backtests/live_check_panels_2026-11-23_southcentral_txb.json`,
`data/backtests/acs_fallback_mismatches_2026-11-23.json`.

## Tests and housekeeping

- `npm test`: run in full after each state (1,737 of 1,737 in 50 files each time; no state added or removed a test);
  `npm run typecheck` clean after each. The full browser suite on the final tree: (run after this commit; the result is added by the next commit). `python3 scripts/r2_only.py --check`
  passes. No test was skipped or loosened and no test pin was changed (none of the four states has a crash source, so
  `tests/unit/crashCountsInvariant.test.ts` was not touched). No pipeline code was changed.
- `app/data/hud_income_limits.json`: 400 rows added from HUD's API (none failed; the test lets only New England counties
  fail). Rows already in the file were not changed; `_source.added_for_new_counties` records each state's addition.
- `app/data/intercity_transit_corridors.json`: nine stops' `county_on_page` flags now say true, each in the commit of its
  state: Perry OK (Noble, 40103) and Ponca City OK (Kay, 40071) in Oklahoma; Ruston LA (Lincoln Parish, 22061) in Louisiana;
  Flatonia TX (Fayette, 48149) in Texas part 1; Mineola TX (Wood, 48499), Marshall TX (Harrison, 48203), Corsicana TX
  (Navarro, 48349), Hearne TX (Robertson, 48395) and Navasota TX (Grimes, 48185) in Texas part 2. No Arkansas stop needed a
  change.
- The 1,774 earlier R2-only files were downloaded from the bucket's public address into this worktree's `counties/` (ignored
  by version control) so that `build_tree_equity_2025.py`, `build_acs_fallback_flags.py` and `build_county_completeness.py`
  could run; the 400 new files are in `counties/` here too and not committed. The Virginia, West Virginia and Colorado
  files, built in another worktree, are not in this one, so this branch's `acs_fallback_flags.json`,
  `county_completeness.json`, `hud_income_limits.json`, `counties/manifest.json`, `counties/.r2-only.txt`, `.gitignore` and
  `index.html` do not hold them, and merging the two branches will need those files merged by hand.
- `counties/manifest.json` in the bucket is one object that every upload of either job replaces with that worktree's own
  copy (666,384 bytes when I started my Louisiana upload, which was the other job's copy; 733,803 bytes after my last). Neither
  copy holds the other job's counties. Nothing on the page reads that object (no reference in `index.html` or `app/`), but
  the merged manifest should be uploaded once after the merge.
- The upload script printed a JSON decoding error ("Extra data") at the end of the Arkansas upload, after the files had been
  sent; a second `--dry-run` showed 0 files to upload and the bucket held 3,298 objects, as expected. It did not happen again.
- No `sites_` files were built (as for every small-county batch: `w5/tools/sites.py` needs the old build machine's paths).
- The Overpass mirror (maps.mail.ru, the only one reachable from here) answered 504 for long stretches: Stephens's and
  Rains's road queries failed all 8 tries once and were run again, and Navarro's second query needed one retry. All ten checks
  were completed; none is open. The OpenStreetMap API (api.openstreetmap.org) answered every history request.
- Scratch use: the scratch folder for this job held the national ACS tables (0.7 GB), the 4.6 GB `us-south` file (from the
  download until the Oklahoma, Arkansas and Louisiana cuts were made, then deleted at once) and one state's build folders. I
  measured the folder at 3.5 GB after the Oklahoma builds (before they were pruned) and 3.2 GB during Texas part 1; I did
  not measure it while the regional file was on disk. The disk's free space was never below 7.8 GB at any of the times I
  read it (stop: 6 GB). Each state's build folders were deleted after its checks, except the two counties kept for its
  OpenStreetMap check. The clipped copy of the region file that each county's folder holds (osm/*.pbf) and the TIGER water
  files are deleted once the county's build succeeds (nothing later reads them); they were reported at 8.9 GB in total
  when first deleted, but the disk's free space did not change, so they did not occupy separate space.
- No mistake was found in already-published data, so no entry was added to `docs/DATA-AUDIT-AND-TRANSPARENCY.md`.

## What is left

Counties still without a data file nationally: 228 in this worktree (see the top of this page for the list by state); the
Virginia, West Virginia and Colorado ones are being built in another worktree. Not done here: Hawaii (no extract in the
registry), and crash counts for all four states (no state source is wired into `pipeline/region.py` for Texas, Oklahoma,
Arkansas or Louisiana).
