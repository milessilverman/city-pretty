# Small counties: the Great Lakes states (22 Nov 2026), served from R2 only

**Result: all 394 counties of the five states are built, checked and on the page, served from R2 only; none was
withheld.** Each state was built, checked, uploaded, live-checked and committed on its own.

| State | Counties built / missing | People (ACS 2020-24) | Block groups | Data files (bytes) | Tiers | Census values checked | R2 bytes added |
|---|---|---|---|---|---|---|---|
| IL | 82 / 82 | 1,952,417 | 1,998 | 21,904,642 | 31 C, 51 D | 1,948 | 21,928,053 |
| IN | 75 / 75 | 2,516,089 | 2,133 | 15,891,586 | 13 C, 62 D | 1,800 | 15,910,443 |
| OH | 61 / 61 | 2,785,392 | 2,373 | 19,753,582 | 20 C, 41 D | 1,464 | 19,768,932 |
| MI | 63 / 63 | 2,205,151 | 1,993 | 26,830,353 | 14 C, 49 D | 1,508 | 26,846,239 |
| KY | 113 / 113 | 2,760,440 | 2,284 | 47,127,356 | 21 C, 92 D | 2,688 | 47,155,763 |
| **All** | **394 / 394** | **12,219,489** | **10,781** | **131,507,519** | 99 C, 295 D | **9,408** | **131,609,430** |

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 394 counties (all of them where a county has fewer), 9,408 values | 9,408 of 9,408 equal | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all county files, after each state | 394 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap ID for ID vs live Overpass (`scripts/check_osm_extract_vs_overpass.py`) | 2 counties per state, 10 | 7 counties exact (roads and bus stops). Adams IL, Alexander IL and Adams OH differ in the raw result only because their boxes reach into other states (and, for Adams IL, 110 roads of the next county at the edge of the sub-region file): limited to the extract's own state, every road and bus stop inside the three counties matches (see Illinois and Ohio) | 0% inside the counties; 110 roads of Pike County IL outside Adams County |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, `LIVE_PORT=9211`, 3 points per county) | 10 counties, 30 points | 198 pass, 72 not checkable (no parcel service on the page for the IL, MI and KY counties, so the house-panel rows do not apply); no wrong value was shown anywhere | 0 wrong values |

**Crash counts:** Illinois is the one state of the five that `pipeline/region.py` STATE_DEFAULTS holds a crash source for;
all 82 Illinois files loaded the Illinois DOT records, and crash counts and gaps were built for them (255 gaps, 183
strengths). Indiana, Ohio, Michigan and Kentucky have none wired in: their files say "Not connected for <state> yet: crash
gaps are not scored and crash-based projects are not proposed".

Counties still without a data file after this batch, counted from the registry the same way (not in
`counties/bundle_*.json.gz` or `counties/.r2-only.txt`, Puerto Rico left out): **1,021** (1,415 before), of which Los
Angeles and Orange (built by their own pipeline, loaded from `app/data/`) are 2 and Hawaii's 5 have no OpenStreetMap
extract in the registry. Remaining by state: TX 211, GA 132, VA 116, MS 76, OK 72, NC 71, AR 67, AL 53, CO 53, WV 52,
LA 50, FL 31, SC 30, HI 5, CA 2.

**R2 storage:** before 1,573,050,945 bytes (2,372 objects), after 1,704,660,375 bytes (2,766 objects): 131,609,430 bytes
added (the 394 data files, 131,507,519, plus the larger `manifest.json`). 1.705 GB of the 8 GB ceiling and the 10 GB
allowance. Every upload went through `scripts/r2_sync_counties.py` after a `--dry-run`; the largest projection was 1.705 GB
(the brief's stop was 4 GB); the per-state figures are in each state's section.

**Measured projection for the rest:** this batch stored 12,198 bytes per block group (state range 7,450 for Indiana to
20,634 for Kentucky; 333,775 bytes per county). The 1,021 remaining counties have 32,227 block groups (ACS 2020-24 B01003
rows), of which 8,640 are Los Angeles's and Orange's and 1,083 are Hawaii's, which this route does not build: 22,504
block groups are left for it. At this batch's rate that is 0.275 GB (0.168 GB at Indiana's rate, 0.464 GB at Kentucky's),
which would take R2 from 1.705 GB to about 1.98 GB (range 1.87 to 2.17 GB). Kentucky's files are the largest per block
group; the Southern states may be more like Kentucky than like Indiana, so the high end is the one to plan on.

The batch is every county under 100,000 people with no data file (not in `counties/bundle_*.json.gz`, not in
`counties/.r2-only.txt`), counted from the registry (`national/data/counties.json`) before starting: IL 82, IN 75, OH 61,
MI 63, KY 113, **394 counties**. The method is the Midwest batch's (`small-counties-midwest.md`), unchanged: files are
uploaded with `scripts/r2_sync_counties.py` after a `--dry-run`, listed in `counties/.r2-only.txt`, and not committed.
No pipeline code was changed.

## How

- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec` from
  a copy of `pipeline/` in the session's scratch folder, three counties at a time, the national ACS table files already in
  the shared cache; then `scripts/export_county_bundle.py <dir> <fips> --r2-only` one county at a time;
  `build_tree_equity_2025.py <state>` (existing counties' files that differ only in `_meta.built` were restored to what is
  committed); `build_acs_fallback_flags.py` (all county files; the 987 earlier R2-only files were downloaded from the
  bucket's public address into this worktree's gitignored `counties/` first); `build_county_completeness.py` (only the new
  rows are kept, since a fresh run rewrites `computed_on` on every row).
- **HUD income limits:** `tests/unit/buildingCosts.test.ts` needs a row (or a listed failure) in
  `app/data/hud_income_limits.json` for every manifest county. Each state's rows were fetched from HUD's API
  (`https://www.huduser.gov/hudapi/public/il/data/<fips>99999`) with the script's own `get()` and `row_from()`
  (`scripts/costs/fetch_hud_income_limits.py`); existing rows were not re-fetched or changed.
- **Transit corridors:** `tests/unit/transitCorridors.test.ts` checks every stop's `county_on_page` flag against the
  manifest; the flags of stops whose county is now on the page were set to true in the same commit as the state.
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency and rail distance where the per-state notes say so.

## Checks (every state)

- **Census:** `scripts/census_spot_check.py` (seed 20261119): population, median home value, median gross rent and median
  household income of 6 randomly chosen block groups in every county (all of them where a county has fewer) against the
  ACS 2020-24 table files, read by a separate parser. Where the block group's median is suppressed the file must hold the
  tract's published median, flagged as a tract value in `acs_fallback_flags.json`, or nothing.
- **OpenStreetMap:** `scripts/check_osm_extract_vs_overpass.py`, ID for ID against a live Overpass query of the same box
  (maps.mail.ru mirror), two counties per state. The extracts are dated snapshots and Overpass is live, so a few differences
  could be edits made since; the IDs would be listed.
- **Live:** `scripts/live_check_panels.mjs` (`LIVE_PORT=9211`, 3 points per county) on the real page loading each county's
  file from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev`.


## Illinois (82 of 82 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (17001) | 64,754 | 60 | 309,531 | C | 44 |
| Alexander County (17003) | 4,875 | 9 | 198,486 | C | 0 |
| Bond County (17005) | 16,716 | 15 | 161,903 | D | 8 |
| Boone County (17007) | 53,230 | 31 | 223,084 | C | 27 |
| Brown County (17009) | 6,322 | 6 | 126,688 | D | 0 |
| Bureau County (17011) | 32,866 | 37 | 551,306 | C | 17 |
| Calhoun County (17013) | 4,330 | 5 | 193,015 | D | 0 |
| Carroll County (17015) | 15,576 | 18 | 321,637 | D | 0 |
| Cass County (17017) | 12,784 | 14 | 118,108 | D | 7 |
| Christian County (17021) | 33,538 | 37 | 160,744 | C | 23 |
| Clark County (17023) | 15,266 | 20 | 392,580 | D | 0 |
| Clay County (17025) | 13,052 | 10 | 130,375 | D | 4 |
| Clinton County (17027) | 36,954 | 27 | 236,768 | C | 4 |
| Coles County (17029) | 46,777 | 47 | 309,819 | C | 39 |
| Crawford County (17033) | 18,511 | 20 | 139,340 | D | 9 |
| Cumberland County (17035) | 10,334 | 11 | 150,454 | D | 0 |
| De Witt County (17039) | 15,373 | 15 | 135,769 | D | 10 |
| Douglas County (17041) | 19,751 | 19 | 227,366 | D | 6 |
| Edgar County (17045) | 16,535 | 19 | 849,389 | D | 10 |
| Edwards County (17047) | 6,075 | 8 | 92,145 | D | 0 |
| Effingham County (17049) | 34,522 | 25 | 186,490 | C | 12 |
| Fayette County (17051) | 21,315 | 23 | 246,626 | D | 9 |
| Ford County (17053) | 13,406 | 15 | 193,379 | C | 4 |
| Franklin County (17055) | 37,323 | 41 | 217,535 | D | 21 |
| Fulton County (17057) | 33,020 | 43 | 659,994 | D | 17 |
| Gallatin County (17059) | 4,819 | 7 | 194,791 | D | 0 |
| Greene County (17061) | 11,683 | 15 | 193,695 | D | 0 |
| Grundy County (17063) | 53,219 | 37 | 249,337 | C | 28 |
| Hamilton County (17065) | 7,916 | 10 | 113,187 | D | 0 |
| Hancock County (17067) | 17,281 | 22 | 219,004 | C | 4 |
| Hardin County (17069) | 3,605 | 6 | 196,582 | D | 0 |
| Henderson County (17071) | 6,193 | 8 | 137,356 | C | 0 |
| Henry County (17073) | 48,643 | 52 | 509,764 | C | 29 |
| Iroquois County (17075) | 26,449 | 29 | 249,659 | C | 7 |
| Jackson County (17077) | 53,064 | 53 | 489,978 | C | 41 |
| Jasper County (17079) | 9,180 | 13 | 111,559 | D | 0 |
| Jefferson County (17081) | 36,550 | 36 | 204,205 | D | 20 |
| Jersey County (17083) | 21,274 | 18 | 383,270 | C | 10 |
| Jo Daviess County (17085) | 21,851 | 27 | 692,958 | C | 4 |
| Johnson County (17087) | 13,376 | 11 | 375,499 | D | 0 |
| Knox County (17095) | 49,046 | 57 | 517,289 | C | 40 |
| Lawrence County (17101) | 15,031 | 18 | 120,659 | D | 7 |
| Lee County (17103) | 33,869 | 36 | 380,324 | D | 19 |
| Livingston County (17105) | 35,565 | 34 | 267,605 | C | 14 |
| Logan County (17107) | 27,713 | 29 | 205,887 | C | 17 |
| McDonough County (17109) | 26,920 | 33 | 371,696 | C | 19 |
| Macoupin County (17117) | 44,350 | 50 | 335,914 | C | 24 |
| Marion County (17121) | 37,000 | 43 | 256,792 | C | 28 |
| Marshall County (17123) | 11,647 | 12 | 324,858 | D | 0 |
| Mason County (17125) | 12,745 | 20 | 327,682 | D | 0 |
| Massac County (17127) | 13,865 | 13 | 224,485 | D | 10 |
| Menard County (17129) | 12,095 | 10 | 125,327 | D | 0 |
| Mercer County (17131) | 15,495 | 19 | 197,086 | D | 0 |
| Monroe County (17133) | 35,036 | 19 | 359,825 | C | 15 |
| Montgomery County (17135) | 27,942 | 28 | 235,877 | D | 15 |
| Morgan County (17137) | 33,021 | 35 | 185,325 | D | 25 |
| Moultrie County (17139) | 14,424 | 14 | 108,665 | D | 6 |
| Ogle County (17141) | 51,495 | 45 | 547,484 | D | 17 |
| Perry County (17145) | 20,639 | 22 | 133,097 | C | 8 |
| Piatt County (17147) | 16,695 | 17 | 127,328 | D | 7 |
| Pike County (17149) | 14,469 | 20 | 195,294 | D | 0 |
| Pope County (17151) | 3,739 | 4 | 318,484 | D | 0 |
| Pulaski County (17153) | 5,015 | 7 | 204,156 | C | 0 |
| Putnam County (17155) | 5,601 | 8 | 167,039 | D | 0 |
| Randolph County (17157) | 30,058 | 33 | 315,013 | D | 7 |
| Richland County (17159) | 15,598 | 15 | 123,879 | D | 9 |
| Saline County (17165) | 23,213 | 30 | 270,779 | D | 14 |
| Schuyler County (17169) | 6,787 | 7 | 238,675 | D | 0 |
| Scott County (17171) | 4,937 | 4 | 81,487 | D | 0 |
| Shelby County (17173) | 20,720 | 25 | 234,067 | D | 7 |
| Stark County (17175) | 5,308 | 8 | 209,791 | C | 0 |
| Stephenson County (17177) | 43,768 | 46 | 336,223 | D | 29 |
| Union County (17181) | 16,997 | 16 | 372,729 | C | 8 |
| Vermilion County (17183) | 72,386 | 67 | 327,906 | D | 47 |
| Wabash County (17185) | 11,119 | 14 | 128,794 | D | 10 |
| Warren County (17187) | 16,447 | 22 | 256,637 | D | 11 |
| Washington County (17189) | 13,627 | 18 | 164,111 | C | 1 |
| Wayne County (17191) | 15,973 | 19 | 156,287 | D | 6 |
| White County (17193) | 13,619 | 16 | 190,513 | D | 9 |
| Whiteside County (17195) | 54,947 | 61 | 402,066 | C | 39 |
| Williamson County (17199) | 66,876 | 56 | 399,373 | D | 41 |
| Woodford County (17203) | 38,312 | 29 | 604,759 | C | 10 |
| **82 counties** | **1,952,417** | **1,998** | **21,904,642** | 31 C, 51 D | 933 |

- OpenStreetMap: Illinois counties read the file the registry names for each county, from openstreetmap.fr: a sub-region file
  (northwest 12 counties, southern 23, southwest 12, northeast 7, central 11, east_central 15, north 1) or
  `illinois-latest.osm.pbf` (1), each downloaded once and shared. Their data timestamps differ: 17 Nov 2026 (north,
  northeast, southwest), 19 Nov (central, northwest, southern) and 21 Nov (east_central, whole state); each county's
  sources list names its own date. Build: fetch 13-84 s, build 18-240 s per county, three at a time (the Indiana builds and
  checks ran alongside), about 30 min from the first county to the last.
- Bus frequency: 70 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 12 have values. Rail distance: 59 counties have none; 23 have values.
- Census spot check: 82 counties, 1,948 of 1,948 values equal (0% mismatch). Tract-median flags: 82 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- **Crash counts (Illinois DOT, the state source `pipeline/region.py` STATE_DEFAULTS holds for IL):** all 82 files list
  "Illinois DOT crash records 2016-2025" as loaded (IDOT's yearly ArcGIS layers; 0 counties without it). Its report total is
  for the county's box (the block groups plus a margin), so a small county's total includes crashes just over its border
  (Pope: 2,593 reports for 3,739 people); per block group a crash counts only if it is inside it or within 10 m.
  `scripts/build_state_crash_counts.py` (boundary rule, 1/k weighting, 2023-2025 layers) wrote `app/data/crash_counts/` for
  all 82 (1,998 block groups); `scripts/recompute_crash_gaps.py` found 255 pedestrian/cyclist gaps and 183 strengths and
  changed no improvement row (0 dropped, 0 added, 0 re-sized); as for every Illinois county the pedestrian/cyclist count
  is a lower bound (first harmful event only). `tests/unit/crashCountsInvariant.test.ts` pinned Illinois at 20 files and 245
  outside California; it now pins 102 and 327 (the 82 new files pass its 1/k sum check).
- Tests: `app/data/intercity_transit_corridors.json`: Wyanet IL (Bureau, 17011), Quincy IL (Adams, 17001) and Carbondale IL
  (Jackson, 17077) now say `county_on_page: true` (3 lines).
- Tests run: `npm test` 1,620 of 1,620 (45 files), `npm run typecheck` clean.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 to every query for about two hours first, so the
  checks were run when it came back). Run as the script is, both counties differ, because their boxes (block groups plus
  0.02 degree) reach into other states and counties that the Illinois sub-region file does not hold. Adams (17001): bus
  stops 2 = 2; roads 4,550 on Overpass, 3,729 in the extract (821 only on Overpass, 0 only in the extract). Alexander
  (17003): roads 2,880 on Overpass, 1,584 in the extract (1,296 only on Overpass, 0 only in the extract); bus stops 2 on
  Overpass, 0 in the extract. Looked at where the differing objects are, with the same box, the same highway classes and
  the same extract, and the Overpass query limited to the state's area (`area["ISO3166-2"="US-IL"]`, a check written for
  this and kept in the result files): **Adams, roads in Illinois 3,834 on Overpass, 3,729 in the extract: 110 only on
  Overpass, all 110 in Pike County (17149, beyond the edge of the sub-region file, in the margin outside Adams County), and
  5 only in the extract, all Missouri-centred ways that cross the Mississippi and are kept whole. Alexander, roads in
  Illinois 1,575 on Overpass, 1,584 in the extract: 0 only on Overpass, 9 only in the extract, all Missouri-centred ways
  that cross the river (Cape Girardeau 6, Mississippi 2, Scott 1); its 2 bus stops are both in Cape Girardeau County,
  Missouri (SEMO Transit Nexus; Normal & West End Blvd).** The first 50 of Adams's 821 Overpass-only roads, as the result
  file lists them, are all in Lewis and Marion counties, Missouri; the other Overpass-only roads outside Illinois (about
  700) were not located one by one. So: inside the two counties every road and bus stop matches; what is missing is the
  neighbouring state's roads, and 110 roads of the neighbouring county at the file's edge, in the box's margin.
- Live check from R2 (`LIVE_PORT=9211`): Jackson (17077) and Fulton (17057), 3 points each. Neither county has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy,
  canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). The crash rows
  show the rebuilt counts (Jackson 170770109003: counts [3, 1.25, 49.25] with a pedestrian/cyclist gap; Fulton
  170579536002: [0, 0, 18]). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,573,050,945 bytes (2,372 objects); dry run "83 files, net +0.022 GB, projected 1.595 GB"; after
  1,594,978,998 bytes (2,454 objects): 21,928,053 bytes added (the 82 data files, 21,904,642, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_il_census_spot_2026-11-22.json`, `data/backtests/greatlakes_osm_xcheck_17001_2026-11-22.json`,
`..._17003_...`, `data/backtests/greatlakes_osm_xcheck_state_17001_2026-11-22.json`, `..._17003_...`, `data/backtests/live_check_panels_2026-11-22_greatlakes_il.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Indiana (75 of 75 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (18001) | 36,227 | 30 | 126,042 | D | 13 |
| Bartholomew County (18005) | 83,536 | 59 | 386,519 | D | 43 |
| Benton County (18007) | 8,735 | 11 | 97,397 | D | 0 |
| Blackford County (18009) | 11,950 | 11 | 64,993 | D | 6 |
| Boone County (18011) | 74,718 | 41 | 278,845 | C | 31 |
| Brown County (18013) | 15,606 | 15 | 247,369 | D | 0 |
| Carroll County (18015) | 20,535 | 19 | 201,089 | D | 3 |
| Cass County (18017) | 37,680 | 39 | 199,436 | C | 27 |
| Clay County (18021) | 26,409 | 26 | 159,745 | D | 15 |
| Clinton County (18023) | 32,944 | 29 | 130,221 | D | 15 |
| Crawford County (18025) | 10,499 | 10 | 248,865 | D | 0 |
| Daviess County (18027) | 33,658 | 30 | 228,760 | D | 17 |
| Dearborn County (18029) | 51,094 | 38 | 289,041 | C | 18 |
| Decatur County (18031) | 26,422 | 21 | 187,681 | D | 12 |
| DeKalb County (18033) | 43,807 | 35 | 162,275 | C | 19 |
| Dubois County (18037) | 43,614 | 31 | 312,072 | D | 22 |
| Fayette County (18041) | 23,334 | 25 | 133,278 | C | 20 |
| Floyd County (18043) | 80,918 | 55 | 361,319 | C | 43 |
| Fountain County (18045) | 16,617 | 19 | 161,502 | D | 0 |
| Franklin County (18047) | 23,020 | 17 | 241,028 | C | 2 |
| Fulton County (18049) | 20,312 | 22 | 152,453 | D | 11 |
| Gibson County (18051) | 33,000 | 31 | 351,438 | D | 13 |
| Grant County (18053) | 66,295 | 57 | 188,727 | D | 40 |
| Greene County (18055) | 31,021 | 32 | 236,293 | D | 10 |
| Hancock County (18059) | 84,037 | 43 | 407,336 | D | 36 |
| Harrison County (18061) | 39,859 | 24 | 356,447 | C | 6 |
| Henry County (18065) | 48,970 | 45 | 225,107 | D | 22 |
| Howard County (18067) | 83,752 | 66 | 198,709 | C | 55 |
| Huntington County (18069) | 36,798 | 33 | 179,654 | D | 21 |
| Jackson County (18071) | 46,660 | 36 | 338,060 | D | 20 |
| Jasper County (18073) | 33,234 | 27 | 175,524 | C | 8 |
| Jay County (18075) | 20,229 | 23 | 102,899 | D | 10 |
| Jefferson County (18077) | 32,998 | 25 | 220,046 | D | 16 |
| Jennings County (18079) | 27,562 | 20 | 210,752 | D | 7 |
| Knox County (18083) | 36,007 | 43 | 404,585 | D | 26 |
| Kosciusko County (18085) | 80,442 | 66 | 274,432 | C | 44 |
| LaGrange County (18087) | 40,805 | 27 | 149,523 | D | 0 |
| Lawrence County (18093) | 45,102 | 40 | 283,840 | D | 22 |
| Marshall County (18099) | 46,284 | 38 | 198,532 | D | 13 |
| Martin County (18101) | 9,830 | 10 | 250,646 | D | 0 |
| Miami County (18103) | 35,712 | 36 | 210,308 | D | 23 |
| Montgomery County (18107) | 38,312 | 34 | 180,217 | C | 18 |
| Morgan County (18109) | 72,659 | 52 | 327,291 | D | 33 |
| Newton County (18111) | 13,922 | 13 | 129,387 | D | 0 |
| Noble County (18113) | 47,495 | 36 | 195,176 | D | 11 |
| Ohio County (18115) | 5,999 | 6 | 98,080 | D | 0 |
| Orange County (18117) | 19,767 | 20 | 227,006 | D | 0 |
| Owen County (18119) | 21,604 | 19 | 203,517 | D | 0 |
| Parke County (18121) | 16,406 | 19 | 225,375 | D | 1 |
| Perry County (18123) | 19,270 | 17 | 243,121 | D | 10 |
| Pike County (18125) | 12,154 | 13 | 169,652 | D | 0 |
| Posey County (18129) | 25,116 | 24 | 237,411 | D | 11 |
| Pulaski County (18131) | 12,441 | 13 | 98,943 | D | 0 |
| Putnam County (18133) | 37,280 | 30 | 199,210 | D | 12 |
| Randolph County (18135) | 24,387 | 30 | 146,344 | D | 10 |
| Ripley County (18137) | 29,095 | 23 | 219,925 | D | 5 |
| Rush County (18139) | 16,739 | 17 | 187,365 | D | 10 |
| Scott County (18143) | 24,526 | 20 | 151,446 | D | 9 |
| Shelby County (18145) | 45,265 | 37 | 293,190 | D | 21 |
| Spencer County (18147) | 19,955 | 19 | 277,146 | D | 0 |
| Starke County (18149) | 23,365 | 22 | 114,517 | D | 0 |
| Steuben County (18151) | 34,726 | 33 | 164,356 | D | 17 |
| Sullivan County (18153) | 20,780 | 22 | 149,871 | D | 9 |
| Switzerland County (18155) | 9,909 | 8 | 158,929 | D | 0 |
| Tipton County (18159) | 15,346 | 17 | 92,419 | C | 11 |
| Union County (18161) | 6,985 | 7 | 74,830 | D | 0 |
| Vermillion County (18165) | 15,421 | 18 | 243,664 | D | 10 |
| Wabash County (18169) | 30,844 | 33 | 181,859 | D | 21 |
| Warren County (18171) | 8,464 | 9 | 154,490 | D | 0 |
| Warrick County (18173) | 65,261 | 51 | 299,152 | D | 41 |
| Washington County (18175) | 28,212 | 25 | 307,844 | D | 9 |
| Wayne County (18177) | 66,397 | 56 | 253,363 | D | 32 |
| Wells County (18179) | 28,420 | 26 | 149,998 | D | 11 |
| White County (18181) | 24,717 | 29 | 226,545 | D | 15 |
| Whitley County (18183) | 34,618 | 30 | 177,159 | D | 14 |
| **75 counties** | **2,516,089** | **2,133** | **15,891,586** | 13 C, 62 D | 1050 |

- OpenStreetMap: `us-midwest-latest.osm.pbf` from download.openstreetmap.fr (2,816,740,006 bytes, md5
  `e549a1125cf9e2b88b1cf3a44813b0a8`, equal to the published `us-midwest.osm.pbf.md5`; data timestamp 2026-11-21T01:07:35Z
  from `us-midwest.state.txt`). Indiana and Ohio were cut from it with `national/osm_split.py us-midwest --states OH,IN
  --per-pass 1` (osmium `extract -s smart`, union of the state's county boxes plus 0.05 degrees): Indiana 138 s, peak
  osmium memory 4.15 GB, 241 MB; Ohio 150 s, peak 4.16 GB, 374 MB. The regional file was deleted once both were cut.
  Build: fetch 9-25 s, build 124-157 s per county, three at a time (the Illinois checks and the Ohio builds ran alongside),
  about 65 min from the first county to the last.
- Bus frequency: 67 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 8 have values. Rail distance: 71 counties have none; 4 have values.
- Census spot check: 75 counties, 1,800 of 1,800 values equal (0% mismatch). Tract-median flags: 75 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Indiana has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS holds IL, ME, PA, TN, UT
  and VA only, checked, not IN); all 75 files say "Not connected for Indiana yet: crash gaps are not scored and crash-based
  projects are not proposed". No crash counts were built.
- Tests run: `npm test` 1,620 of 1,620 (45 files), `npm run typecheck` clean. No corridor stop's flag changed (none of the
  Indiana stops is in a new county).
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 for about two hours first): Adams (18001) 1,686
  = 1,686 roads, 2 = 2 bus stops; Bartholomew (18005) 5,297 = 5,297 roads, 0 = 0 bus stops (0 missing, 0 extra). The
  extract's snapshot is 2026-11-21T01:07:35Z.
- Live check from R2 (`LIVE_PORT=9211`): Putnam (18133) and Henry (18065), 3 points each (Indiana's parcel service is on
  the page): all six points had the house panel on live parcel records and pass every check (neighborhood, canopy, canopy
  goal, crash text, state laws, Census area, HUD rent, FEMA, USGS, console): 54 pass, 0 fail. Each data file came from the
  r2.dev address (HEAD 200, GET 200).
- R2: before 1,594,978,998 bytes (2,454 objects); dry run "76 files, net +0.016 GB, projected 1.611 GB"; after
  1,610,889,441 bytes (2,529 objects): 15,910,443 bytes added (the 75 data files, 15,891,586, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_in_census_spot_2026-11-22.json`, `data/backtests/greatlakes_osm_xcheck_18001_2026-11-22.json`,
`..._18005_...`, `data/backtests/live_check_panels_2026-11-22_greatlakes_in.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Ohio (61 of 61 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (39001) | 27,540 | 23 | 338,837 | C | 0 |
| Ashland County (39005) | 52,256 | 44 | 349,106 | D | 24 |
| Ashtabula County (39007) | 97,167 | 92 | 554,699 | C | 61 |
| Athens County (39009) | 61,737 | 46 | 588,766 | C | 25 |
| Auglaize County (39011) | 46,125 | 38 | 319,850 | C | 30 |
| Belmont County (39013) | 65,473 | 65 | 583,156 | D | 37 |
| Brown County (39015) | 43,845 | 34 | 345,721 | C | 2 |
| Carroll County (39019) | 26,659 | 25 | 278,003 | D | 0 |
| Champaign County (39021) | 38,804 | 34 | 173,394 | D | 13 |
| Clinton County (39027) | 42,012 | 33 | 253,511 | D | 13 |
| Coshocton County (39031) | 36,744 | 32 | 334,989 | D | 15 |
| Crawford County (39033) | 41,711 | 44 | 172,809 | D | 33 |
| Darke County (39037) | 51,594 | 52 | 210,354 | D | 20 |
| Defiance County (39039) | 38,343 | 36 | 204,036 | D | 21 |
| Erie County (39043) | 74,581 | 63 | 385,186 | C | 53 |
| Fayette County (39047) | 28,876 | 26 | 193,370 | D | 16 |
| Fulton County (39051) | 42,240 | 30 | 173,214 | D | 6 |
| Gallia County (39053) | 29,068 | 26 | 386,516 | D | 10 |
| Geauga County (39055) | 95,481 | 62 | 641,474 | C | 18 |
| Guernsey County (39059) | 38,223 | 36 | 381,430 | D | 20 |
| Hancock County (39063) | 74,866 | 64 | 303,464 | C | 49 |
| Hardin County (39065) | 30,475 | 27 | 158,841 | D | 16 |
| Harrison County (39067) | 14,306 | 17 | 260,901 | D | 0 |
| Henry County (39069) | 27,567 | 26 | 183,564 | C | 9 |
| Highland County (39071) | 43,517 | 37 | 313,915 | D | 14 |
| Hocking County (39073) | 27,799 | 23 | 427,760 | D | 13 |
| Holmes County (39075) | 44,418 | 25 | 229,523 | D | 0 |
| Huron County (39077) | 58,319 | 47 | 216,757 | D | 32 |
| Jackson County (39079) | 32,650 | 30 | 345,752 | D | 19 |
| Jefferson County (39081) | 64,518 | 62 | 443,208 | D | 48 |
| Knox County (39083) | 63,142 | 46 | 454,811 | D | 21 |
| Lawrence County (39087) | 56,819 | 57 | 453,971 | C | 45 |
| Logan County (39091) | 46,089 | 40 | 218,823 | D | 23 |
| Madison County (39097) | 44,423 | 30 | 252,273 | D | 15 |
| Marion County (39101) | 65,020 | 59 | 206,992 | D | 45 |
| Meigs County (39105) | 21,896 | 23 | 331,931 | D | 6 |
| Mercer County (39107) | 42,484 | 32 | 206,207 | D | 11 |
| Monroe County (39111) | 13,227 | 16 | 377,519 | D | 0 |
| Morgan County (39115) | 13,651 | 15 | 347,073 | C | 0 |
| Morrow County (39117) | 35,404 | 25 | 219,912 | D | 1 |
| Muskingum County (39119) | 86,411 | 71 | 506,543 | C | 47 |
| Noble County (39121) | 14,282 | 12 | 380,057 | D | 0 |
| Ottawa County (39123) | 39,994 | 44 | 308,255 | C | 22 |
| Paulding County (39125) | 18,791 | 17 | 142,885 | D | 0 |
| Perry County (39127) | 35,535 | 28 | 448,885 | C | 8 |
| Pickaway County (39129) | 60,131 | 40 | 411,404 | C | 23 |
| Pike County (39131) | 27,044 | 21 | 302,058 | D | 7 |
| Preble County (39135) | 40,765 | 33 | 157,734 | D | 12 |
| Putnam County (39137) | 34,314 | 27 | 232,180 | C | 7 |
| Ross County (39141) | 76,492 | 61 | 420,304 | D | 31 |
| Sandusky County (39143) | 58,778 | 58 | 260,430 | D | 40 |
| Scioto County (39145) | 72,627 | 70 | 574,537 | C | 41 |
| Seneca County (39147) | 54,770 | 55 | 200,519 | D | 36 |
| Shelby County (39149) | 47,929 | 39 | 205,022 | D | 25 |
| Tuscarawas County (39157) | 92,385 | 77 | 455,801 | D | 56 |
| Union County (39159) | 67,324 | 33 | 289,988 | C | 21 |
| Van Wert County (39161) | 28,826 | 27 | 189,313 | C | 17 |
| Vinton County (39163) | 12,630 | 12 | 379,073 | D | 2 |
| Washington County (39167) | 58,978 | 47 | 713,694 | D | 26 |
| Williams County (39171) | 36,719 | 37 | 205,642 | C | 13 |
| Wyandot County (39175) | 21,598 | 22 | 147,640 | D | 11 |
| **61 counties** | **2,785,392** | **2,373** | **19,753,582** | 20 C, 41 D | 1229 |

- OpenStreetMap: the Ohio cut of the 21 Nov 2026 `us-midwest-latest.osm.pbf` (see Indiana: 150 s, peak osmium memory
  4.16 GB, 374 MB). Build: fetch 11-62 s, build 199-248 s per county, three at a time (the Indiana checks and the Michigan
  builds ran alongside, so these are slower than Indiana's), about 83 min from the first county to the last.
- Bus frequency: 49 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 12 have values. Rail distance: 55 counties have none; 6 have values.
- Census spot check: 61 counties, 1,464 of 1,464 values equal (0% mismatch). Tract-median flags: 61 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Ohio has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no OH); all 61 files say
  "Not connected for Ohio yet: crash gaps are not scored and crash-based projects are not proposed".
- Tests run: `npm test` 1,620 of 1,620 (45 files), `npm run typecheck` clean. No corridor stop's flag changed.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 for a while first): Ashland (39005) 4,002 =
  4,002 roads, 0 = 0 bus stops (0 missing, 0 extra). Adams (39001) bus stops 1 = 1; **roads 3,015 on Overpass, 2,463 in the
  extract (552 only on Overpass, 0 only in the extract)**: Adams County lies on the Ohio River and its box reaches into
  Kentucky, which an Ohio extract does not hold. With the Overpass query limited to Ohio's area (same box, classes and
  extract; `area["ISO3166-2"="US-OH"]`): 2,416 on Overpass, 2,463 in the extract, 0 only on Overpass, 47 only in the
  extract, all 47 centred in Kentucky (Lewis County 46, Mason County 1: ways that cross the river or lie just across it,
  kept by the extract). Inside Ohio every road matches. The extract's snapshot is 2026-11-21T01:07:35Z.
- Live check from R2 (`LIVE_PORT=9211`): Guernsey (39059) and Perry (39127), 3 points each (Ohio's parcel service is on
  the page): all six points had the house panel on live parcel records and pass every check (neighborhood, canopy, canopy
  goal, crash text, state laws, Census area, HUD rent, FEMA, USGS, console): 54 pass, 0 fail. Each data file came from the
  r2.dev address (HEAD 200, GET 200).
- R2: before 1,610,889,441 bytes (2,529 objects); dry run "62 files, net +0.020 GB, projected 1.631 GB"; after
  1,630,658,373 bytes (2,590 objects): 19,768,932 bytes added (the 61 data files, 19,753,582, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_oh_census_spot_2026-11-22.json`, `data/backtests/greatlakes_osm_xcheck_39001_2026-11-22.json`,
`..._39005_...`, `data/backtests/greatlakes_osm_xcheck_state_39001_2026-11-22.json`,
`data/backtests/live_check_panels_2026-11-22_greatlakes_oh.json`, `data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Michigan (63 of 63 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Alcona County (26001) | 10,397 | 12 | 264,005 | D | 3 |
| Alger County (26003) | 8,762 | 8 | 750,336 | D | 0 |
| Alpena County (26007) | 28,880 | 35 | 288,628 | D | 21 |
| Antrim County (26009) | 24,127 | 29 | 452,681 | D | 0 |
| Arenac County (26011) | 15,077 | 19 | 268,844 | C | 4 |
| Baraga County (26013) | 8,191 | 9 | 667,066 | D | 0 |
| Barry County (26015) | 63,409 | 42 | 281,851 | D | 9 |
| Benzie County (26019) | 18,310 | 18 | 262,040 | C | 7 |
| Branch County (26023) | 45,300 | 42 | 183,741 | D | 14 |
| Cass County (26027) | 51,520 | 44 | 247,369 | C | 20 |
| Charlevoix County (26029) | 26,108 | 29 | 655,823 | D | 16 |
| Cheboygan County (26031) | 25,865 | 31 | 468,566 | D | 10 |
| Chippewa County (26033) | 36,295 | 39 | 924,044 | D | 19 |
| Clare County (26035) | 31,218 | 33 | 250,837 | D | 7 |
| Clinton County (26037) | 79,626 | 58 | 332,951 | C | 37 |
| Crawford County (26039) | 13,369 | 16 | 284,187 | D | 1 |
| Delta County (26041) | 36,813 | 30 | 564,954 | D | 18 |
| Dickinson County (26043) | 25,954 | 20 | 421,569 | C | 17 |
| Emmet County (26047) | 34,125 | 33 | 415,038 | D | 20 |
| Gladwin County (26051) | 25,693 | 26 | 216,410 | D | 0 |
| Gogebic County (26053) | 14,319 | 21 | 1,538,850 | D | 10 |
| Grand Traverse County (26055) | 96,166 | 66 | 697,746 | C | 50 |
| Gratiot County (26057) | 41,385 | 38 | 182,571 | D | 18 |
| Hillsdale County (26059) | 45,654 | 44 | 224,701 | D | 15 |
| Houghton County (26061) | 37,693 | 36 | 1,356,163 | C | 24 |
| Huron County (26063) | 31,113 | 37 | 293,466 | D | 0 |
| Ionia County (26067) | 66,574 | 47 | 279,641 | D | 25 |
| Iosco County (26069) | 25,347 | 33 | 290,517 | D | 22 |
| Iron County (26071) | 11,667 | 12 | 516,262 | D | 0 |
| Isabella County (26073) | 64,565 | 51 | 267,302 | D | 30 |
| Kalkaska County (26079) | 18,239 | 16 | 231,516 | D | 0 |
| Keweenaw County (26083) | 2,133 | 5 | 434,398 | D | 0 |
| Lake County (26085) | 12,563 | 12 | 230,301 | D | 0 |
| Lapeer County (26087) | 88,837 | 65 | 315,179 | C | 17 |
| Leelanau County (26089) | 22,734 | 20 | 408,088 | C | 6 |
| Lenawee County (26091) | 98,415 | 83 | 344,588 | C | 41 |
| Luce County (26095) | 6,271 | 8 | 364,877 | D | 0 |
| Mackinac County (26097) | 10,957 | 16 | 754,643 | D | 5 |
| Manistee County (26101) | 25,350 | 28 | 332,602 | D | 13 |
| Marquette County (26103) | 67,112 | 64 | 1,211,246 | C | 41 |
| Mason County (26105) | 29,207 | 31 | 275,850 | D | 15 |
| Mecosta County (26107) | 41,242 | 37 | 298,038 | D | 18 |
| Menominee County (26109) | 23,247 | 22 | 631,395 | D | 8 |
| Midland County (26111) | 83,757 | 66 | 308,917 | D | 45 |
| Missaukee County (26113) | 15,207 | 13 | 205,638 | D | 0 |
| Montcalm County (26117) | 67,816 | 49 | 420,261 | C | 9 |
| Montmorency County (26119) | 9,516 | 12 | 237,992 | D | 0 |
| Newaygo County (26123) | 50,792 | 34 | 385,462 | D | 7 |
| Oceana County (26127) | 26,915 | 21 | 311,368 | D | 0 |
| Ogemaw County (26129) | 20,885 | 22 | 214,942 | D | 0 |
| Ontonagon County (26131) | 5,850 | 7 | 1,442,824 | D | 0 |
| Osceola County (26133) | 23,227 | 25 | 213,708 | D | 0 |
| Oscoda County (26135) | 8,425 | 11 | 141,668 | D | 0 |
| Otsego County (26137) | 25,584 | 20 | 301,943 | D | 11 |
| Presque Isle County (26141) | 13,209 | 17 | 272,166 | D | 0 |
| Roscommon County (26143) | 23,737 | 28 | 252,495 | D | 23 |
| St. Joseph County (26149) | 60,969 | 56 | 255,117 | D | 25 |
| Sanilac County (26151) | 40,462 | 41 | 289,072 | D | 7 |
| Schoolcraft County (26153) | 8,128 | 10 | 618,906 | D | 0 |
| Shiawassee County (26155) | 67,991 | 56 | 237,728 | C | 30 |
| Tuscola County (26157) | 52,980 | 50 | 319,104 | D | 8 |
| Van Buren County (26159) | 75,795 | 66 | 455,964 | C | 21 |
| Wexford County (26165) | 34,077 | 24 | 264,198 | D | 15 |
| **63 counties** | **2,205,151** | **1,993** | **26,830,353** | 14 C, 49 D | 782 |

- OpenStreetMap: Michigan counties read the file the registry names for each county, from openstreetmap.fr:
  `michigan-latest.osm.pbf` (32 counties; data timestamp 2026-11-21T01:17:47Z) or a sub-region file (west 8 counties,
  northern_lower 7, southeast 5, central 5, southwest 4, upper_peninsula 2; timestamps 21 Nov 2026 for west, central and
  southwest, 19 Nov for northern_lower and upper_peninsula, 17 Nov for southeast), each downloaded once and shared; each
  county's sources list names its own date. Build: fetch 10-67 s, build 21-301 s per county, three at a time (the Ohio checks
  and the Kentucky download, cut and builds ran alongside), about 53 min from the first county to the last.
- Bus frequency: 55 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 8 have values. Rail distance: 59 counties have none; 4 have values.
- Census spot check: 63 counties, 1,508 of 1,508 values equal (0% mismatch). Tract-median flags: 63 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Michigan has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no MI); all 63 files
  say "Not connected for Michigan yet: crash gaps are not scored and crash-based projects are not proposed".
- Tests run: `npm test` 1,620 of 1,620 (45 files), `npm run typecheck` clean. No corridor stop's flag changed.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 for a while first): Alcona (26001) 1,510 = 1,510
  roads, 0 = 0 bus stops; Alger (26003) 2,049 = 2,049 roads, 0 = 0 bus stops (0 missing, 0 extra).
- Live check from R2 (`LIVE_PORT=9211`): Cass (26027) and Marquette (26103), 3 points each. Neither county has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy,
  canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each data file
  came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,630,658,373 bytes (2,590 objects); dry run "64 files, net +0.027 GB, projected 1.658 GB"; after
  1,657,504,612 bytes (2,653 objects): 26,846,239 bytes added (the 63 data files, 26,830,353, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_mi_census_spot_2026-11-22.json`, `data/backtests/greatlakes_osm_xcheck_26001_2026-11-22.json`,
`..._26003_...`, `data/backtests/live_check_panels_2026-11-22_greatlakes_mi.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Kentucky (113 of 113 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adair County (21001) | 19,089 | 15 | 432,704 | D | 6 |
| Allen County (21003) | 21,293 | 16 | 324,584 | C | 7 |
| Anderson County (21005) | 24,353 | 16 | 260,003 | D | 13 |
| Ballard County (21007) | 7,654 | 8 | 120,702 | D | 0 |
| Barren County (21009) | 44,938 | 38 | 412,375 | C | 22 |
| Bath County (21011) | 12,851 | 9 | 691,247 | D | 0 |
| Bell County (21013) | 23,509 | 25 | 812,783 | D | 12 |
| Bourbon County (21017) | 20,240 | 20 | 263,134 | C | 15 |
| Boyd County (21019) | 47,911 | 42 | 279,790 | C | 40 |
| Boyle County (21021) | 30,941 | 23 | 210,358 | D | 19 |
| Bracken County (21023) | 8,444 | 8 | 175,992 | D | 0 |
| Breathitt County (21025) | 13,276 | 13 | 771,332 | D | 0 |
| Breckinridge County (21027) | 20,881 | 18 | 415,208 | D | 0 |
| Bullitt County (21029) | 84,027 | 51 | 593,990 | C | 42 |
| Butler County (21031) | 12,393 | 8 | 366,810 | C | 0 |
| Caldwell County (21033) | 12,618 | 12 | 320,232 | D | 7 |
| Calloway County (21035) | 38,224 | 34 | 260,992 | D | 20 |
| Campbell County (21037) | 93,426 | 71 | 505,502 | C | 64 |
| Carlisle County (21039) | 4,762 | 5 | 80,414 | D | 0 |
| Carroll County (21041) | 10,954 | 10 | 153,993 | D | 6 |
| Carter County (21043) | 26,341 | 20 | 794,204 | D | 7 |
| Casey County (21045) | 15,914 | 14 | 328,677 | D | 0 |
| Christian County (21047) | 72,069 | 56 | 457,624 | C | 41 |
| Clark County (21049) | 37,192 | 26 | 264,549 | D | 19 |
| Clay County (21051) | 19,921 | 19 | 723,507 | D | 0 |
| Clinton County (21053) | 9,202 | 8 | 150,244 | D | 0 |
| Crittenden County (21055) | 8,979 | 10 | 303,055 | D | 0 |
| Cumberland County (21057) | 5,948 | 8 | 209,710 | D | 0 |
| Edmonson County (21061) | 12,355 | 11 | 316,944 | D | 0 |
| Elliott County (21063) | 7,307 | 9 | 313,813 | D | 0 |
| Estill County (21065) | 14,035 | 14 | 691,436 | D | 8 |
| Fleming County (21069) | 15,323 | 11 | 697,269 | D | 0 |
| Floyd County (21071) | 35,224 | 40 | 421,978 | D | 18 |
| Franklin County (21073) | 51,842 | 46 | 280,492 | D | 38 |
| Fulton County (21075) | 6,409 | 9 | 107,101 | C | 4 |
| Gallatin County (21077) | 8,769 | 7 | 151,701 | D | 0 |
| Garrard County (21079) | 17,568 | 15 | 305,183 | D | 0 |
| Grant County (21081) | 25,418 | 17 | 263,740 | D | 0 |
| Graves County (21083) | 36,630 | 29 | 196,766 | D | 14 |
| Grayson County (21085) | 26,707 | 24 | 450,291 | D | 11 |
| Green County (21087) | 11,369 | 11 | 293,647 | D | 0 |
| Greenup County (21089) | 35,501 | 30 | 425,968 | C | 24 |
| Hancock County (21091) | 9,034 | 9 | 177,279 | D | 2 |
| Harlan County (21095) | 25,772 | 33 | 946,105 | D | 11 |
| Harrison County (21097) | 19,140 | 15 | 283,365 | C | 9 |
| Hart County (21099) | 19,603 | 17 | 372,509 | D | 3 |
| Henderson County (21101) | 44,280 | 34 | 289,058 | D | 25 |
| Henry County (21103) | 15,856 | 14 | 257,314 | D | 0 |
| Hickman County (21105) | 4,439 | 6 | 123,834 | C | 0 |
| Hopkins County (21107) | 45,119 | 40 | 417,320 | D | 23 |
| Jackson County (21109) | 13,086 | 11 | 621,952 | D | 0 |
| Jessamine County (21113) | 54,588 | 32 | 426,809 | C | 29 |
| Johnson County (21115) | 22,334 | 20 | 284,408 | D | 10 |
| Knott County (21119) | 13,830 | 15 | 339,116 | D | 0 |
| Knox County (21121) | 29,865 | 27 | 841,005 | D | 17 |
| Larue County (21123) | 15,107 | 13 | 342,014 | D | 0 |
| Laurel County (21125) | 62,983 | 44 | 927,688 | D | 31 |
| Lawrence County (21127) | 16,077 | 14 | 405,148 | D | 5 |
| Lee County (21129) | 7,339 | 6 | 604,211 | D | 0 |
| Leslie County (21131) | 10,079 | 11 | 763,271 | D | 0 |
| Letcher County (21133) | 20,808 | 25 | 597,259 | C | 0 |
| Lewis County (21135) | 12,965 | 11 | 732,559 | D | 0 |
| Lincoln County (21137) | 24,504 | 18 | 301,257 | D | 1 |
| Livingston County (21139) | 8,903 | 9 | 321,809 | D | 1 |
| Logan County (21141) | 27,986 | 21 | 316,118 | D | 10 |
| Lyon County (21143) | 8,900 | 8 | 292,231 | D | 0 |
| McCracken County (21145) | 67,564 | 55 | 283,533 | D | 46 |
| McCreary County (21147) | 16,867 | 15 | 779,869 | C | 0 |
| McLean County (21149) | 9,114 | 9 | 196,144 | D | 0 |
| Madison County (21151) | 95,769 | 71 | 814,849 | D | 57 |
| Magoffin County (21153) | 11,348 | 12 | 290,838 | D | 0 |
| Marion County (21155) | 19,749 | 16 | 262,243 | D | 8 |
| Marshall County (21157) | 31,743 | 24 | 340,673 | D | 3 |
| Martin County (21159) | 11,027 | 10 | 194,804 | D | 0 |
| Mason County (21161) | 16,956 | 16 | 203,430 | C | 11 |
| Meade County (21163) | 30,158 | 23 | 326,076 | D | 6 |
| Menifee County (21165) | 6,230 | 6 | 603,386 | D | 0 |
| Mercer County (21167) | 23,028 | 16 | 259,772 | D | 8 |
| Metcalfe County (21169) | 10,425 | 10 | 284,012 | D | 0 |
| Monroe County (21171) | 11,269 | 13 | 226,918 | D | 0 |
| Montgomery County (21173) | 28,395 | 20 | 569,113 | D | 12 |
| Morgan County (21175) | 14,053 | 12 | 830,021 | D | 0 |
| Muhlenberg County (21177) | 30,591 | 29 | 347,641 | D | 16 |
| Nelson County (21179) | 47,606 | 27 | 555,552 | D | 16 |
| Nicholas County (21181) | 7,708 | 6 | 178,666 | D | 0 |
| Ohio County (21183) | 23,735 | 21 | 484,474 | D | 7 |
| Oldham County (21185) | 69,257 | 42 | 417,354 | C | 38 |
| Owen County (21187) | 11,330 | 11 | 382,174 | D | 0 |
| Owsley County (21189) | 3,971 | 5 | 562,866 | D | 0 |
| Pendleton County (21191) | 14,723 | 11 | 353,393 | D | 0 |
| Perry County (21193) | 27,499 | 24 | 916,417 | D | 14 |
| Pike County (21195) | 56,727 | 63 | 897,879 | C | 22 |
| Powell County (21197) | 13,038 | 11 | 649,050 | D | 0 |
| Pulaski County (21199) | 65,897 | 51 | 1,019,649 | D | 35 |
| Robertson County (21201) | 2,283 | 2 | 108,845 | D | 0 |
| Rockcastle County (21203) | 16,163 | 14 | 682,430 | D | 0 |
| Rowan County (21205) | 24,578 | 19 | 734,959 | D | 12 |
| Russell County (21207) | 18,221 | 17 | 359,330 | D | 0 |
| Scott County (21209) | 59,536 | 47 | 380,980 | C | 33 |
| Shelby County (21211) | 49,096 | 35 | 466,042 | D | 20 |
| Simpson County (21213) | 19,972 | 14 | 212,866 | D | 10 |
| Spencer County (21215) | 20,193 | 10 | 245,651 | D | 0 |
| Taylor County (21217) | 26,397 | 22 | 297,304 | D | 15 |
| Todd County (21219) | 12,469 | 9 | 176,326 | C | 0 |
| Trigg County (21221) | 14,315 | 14 | 321,360 | D | 0 |
| Trimble County (21223) | 8,550 | 6 | 141,434 | D | 0 |
| Union County (21225) | 13,260 | 17 | 172,726 | D | 0 |
| Washington County (21229) | 12,140 | 10 | 223,968 | D | 0 |
| Wayne County (21231) | 19,602 | 17 | 726,169 | D | 7 |
| Webster County (21233) | 12,842 | 13 | 235,026 | D | 0 |
| Whitley County (21235) | 36,920 | 30 | 825,516 | D | 18 |
| Wolfe County (21237) | 6,443 | 7 | 690,465 | D | 0 |
| Woodford County (21239) | 27,279 | 23 | 311,480 | C | 14 |
| **113 counties** | **2,760,440** | **2,284** | **47,127,356** | 21 C, 92 D | 1062 |

- OpenStreetMap: `us-south-latest.osm.pbf` from download.openstreetmap.fr (4,623,607,998 bytes, md5
  `aaee92b7cea7116859b6f51c768d7830`, equal to the published `us-south.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z
  from `us-south.state.txt`). Kentucky was cut from it with `national/osm_split.py us-south --states KY --per-pass 1`
  (osmium `extract -s smart`, union of the state's county boxes plus 0.05 degrees): 170 s, peak osmium memory 4.18 GB,
  180 MB; the regional file was deleted after the cut. Build: fetch 11-65 s, build 72-130 s per county, three at a time (the
  Michigan checks ran alongside), about 67 min from the first county to the last.
- Bus frequency: 97 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 16 have values. Rail distance: 108 counties have none; 5 have values.
- Census spot check: 113 counties, 2,688 of 2,688 values equal (0% mismatch). Tract-median flags: 113 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Kentucky has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no KY); all 113 files
  say "Not connected for Kentucky yet: crash gaps are not scored and crash-based projects are not proposed".
- Tests run: `npm test` 1,620 of 1,620 (45 files), `npm run typecheck` clean. No corridor stop's flag changed.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 for a while first): Adair (21001) 4,220 = 4,220
  roads, 0 = 0 bus stops; Allen (21003) 3,099 = 3,099 roads, 0 = 0 bus stops (0 missing, 0 extra). The extract's snapshot
  is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9211`): Elliott (21063) and Monroe (21171), 3 points each. Neither county has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy,
  canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each data file
  came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,657,504,612 bytes (2,653 objects); dry run "114 files, net +0.047 GB, projected 1.705 GB"; after
  1,704,660,375 bytes (2,766 objects): 47,155,763 bytes added (the 113 data files, 47,127,356, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_ky_census_spot_2026-11-22.json`, `data/backtests/greatlakes_osm_xcheck_21001_2026-11-22.json`,
`..._21003_...`, `data/backtests/live_check_panels_2026-11-22_greatlakes_ky.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Tests and housekeeping

- `npm test`: run in full after each state (1,620 of 1,620 in 45 files each time; Illinois grew the count with its crash
  files); `npm run typecheck` clean after each. The full browser suite on the final tree: `PW_PORT=9212 npm run test:e2e -- --trace off`, run once on the Kentucky commit (all five states in): 93 of 93 passed (8.5 min). `python3
  scripts/r2_only.py --check` passes. No test was skipped or loosened. One test pin was changed, as the Utah batch did:
  `tests/unit/crashCountsInvariant.test.ts` (Illinois 20 -> 102 crash-count files, 245 -> 327 outside California). No
  pipeline code was changed.
- `app/data/hud_income_limits.json`: 394 rows added from HUD's API (none failed; the test lets only New England counties
  fail). Rows already in the file were not changed; `_source.added_for_new_counties` records each state's addition.
- `app/data/intercity_transit_corridors.json`: three stops' `county_on_page` flags (Wyanet IL in Bureau, Quincy IL in
  Adams, Carbondale IL in Jackson) now say true, in the Illinois commit. No Indiana, Ohio, Michigan or Kentucky stop needed
  a change.
- The 987 earlier R2-only files were downloaded from the bucket's public address into this worktree's `counties/` (ignored
  by version control) so that `build_tree_equity_2025.py`, `build_acs_fallback_flags.py` and `build_county_completeness.py`
  could run; the 394 new files are in `counties/` here too and not committed.
- No `sites_` files were built (as for every small-county batch: `w5/tools/sites.py` needs the old build machine's paths).
- The Overpass mirror (maps.mail.ru, the only one reachable from here) answered 504 for hours at a time, so the
  OpenStreetMap checks for Illinois and Indiana were still open when those two states were committed; their results were
  added in the commit after Indiana's (`greatlakes_osm_xcheck_*` result files). Ohio, Michigan and Kentucky were checked
  before their commits.
- Scratch use: **the 5 GB limit was passed once, for the Kentucky download.** The scratch folder measured 2.5 GB (Michigan's
  and Kentucky's build folders at about 19 MB each, the shared ACS tables 0.5 GB) when the 4.6 GB `us-south` file was
  downloaded into it, so it held about 7 GB until the Kentucky cut was made and the regional file deleted (disk free never
  fell below 8.8 GB). Elsewhere it stayed under 5 GB; each state's build folders and state file were deleted after its
  checks.

## What is left

Counties still without a data file nationally: 1,021 (see the top of this page for the list by state). Not done here: the
South (Texas, Georgia, Virginia, Mississippi, Oklahoma, North Carolina, Arkansas, Alabama, West Virginia, Louisiana,
Florida, South Carolina) and Colorado's remaining small counties, Hawaii (no extract in the registry), the 100,000-plus
counties, and crash counts for Indiana, Ohio, Michigan and Kentucky (no state source is wired into the pipeline for them).
