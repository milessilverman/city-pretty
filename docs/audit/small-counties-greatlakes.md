# Small counties: the Great Lakes states (22 Nov 2026), served from R2 only

**In progress: this page grows one state at a time (Illinois, Indiana, Ohio, Michigan, Kentucky); the totals at the top are
written when the last state is done.**

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
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): **not complete at this commit.** Adams (17001): bus stops 2 = 2
  (0 missing, 0 extra); its roads query got no answer (504 on all 8 tries). Alexander (17003): neither query was answered. The
  mirror answered 504 to a small test query each time it was tried over about half an hour, and the other Overpass servers are refused from this
  machine. The check keeps retrying; its result is added to this section when it answers.
- Live check from R2 (`LIVE_PORT=9211`): Jackson (17077) and Fulton (17057), 3 points each. Neither county has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy,
  canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). The crash rows
  show the rebuilt counts (Jackson 170770109003: counts [3, 1.25, 49.25] with a pedestrian/cyclist gap; Fulton
  170579536002: [0, 0, 18]). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,573,050,945 bytes (2,372 objects); dry run "83 files, net +0.022 GB, projected 1.595 GB"; after
  1,594,978,998 bytes (2,454 objects): 21,928,053 bytes added (the 82 data files, 21,904,642, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_il_census_spot_2026-11-22.json`, `data/backtests/live_check_panels_2026-11-22_greatlakes_il.json`,
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
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): **not complete at this commit.** The
  mirror answered 504 to every query again (Overpass servers other than maps.mail.ru are refused from this machine); the
  check is queued for Adair-first counties Adams (18001) and Blackford (18005) and its result is added to this section when
  it answers.
- Live check from R2 (`LIVE_PORT=9211`): Putnam (18133) and Henry (18065), 3 points each (Indiana's parcel service is on
  the page): all six points had the house panel on live parcel records and pass every check (neighborhood, canopy, canopy
  goal, crash text, state laws, Census area, HUD rent, FEMA, USGS, console): 54 pass, 0 fail. Each data file came from the
  r2.dev address (HEAD 200, GET 200).
- R2: before 1,594,978,998 bytes (2,454 objects); dry run "76 files, net +0.016 GB, projected 1.611 GB"; after
  1,610,889,441 bytes (2,529 objects): 15,910,443 bytes added (the 75 data files, 15,891,586, plus the larger
  `manifest.json`).

Files: `data/backtests/greatlakes_in_census_spot_2026-11-22.json`, `data/backtests/live_check_panels_2026-11-22_greatlakes_in.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.
