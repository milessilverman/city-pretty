# Small counties: the West (21 Nov 2026), served from R2 only

**Result: 186 of the 238 counties built, checked and on the page, served from R2 only; none withheld for a failed
check. Montana's 52 were not built in the first session (time) and were built, checked and uploaded by a second session
the same afternoon (see "Montana"): all 238 are now on the page.** Each state was uploaded, checked live and committed on its own.

| State | Counties built / missing | People (ACS 2020-24) | Block groups | Data files (bytes) | Tiers |
|---|---|---|---|---|---|
| AZ | 6 / 6 | 233,367 | 204 | 9,238,194 | 2 C, 4 D |
| NV | 15 / 15 | 357,864 | 264 | 14,504,357 | 10 C, 5 D |
| UT | 23 / 23 | 513,359 | 341 | 18,469,389 | 11 C, 12 D |
| WY | 22 / 22 | 481,337 | 379 | 13,948,447 | 3 C, 19 D |
| OR | 26 / 26 | 910,952 | 758 | 22,959,783 | 24 C, 2 D |
| WA | 26 / 26 | 1,065,186 | 843 | 33,591,841 | 25 C, 1 D |
| NM | 28 / 28 | 791,399 | 682 | 20,898,297 | 17 C, 11 D |
| ID | 40 / 40 | 853,018 | 644 | 25,734,441 | 16 C, 24 D |
| MT | 52 / 52 | 592,477 | 538 | 27,707,927 | 15 C, 37 D |
| **All** | **238 / 238** | **5,798,959** | **4,653** | **187,052,676** | 123 C, 115 D |

Summary of the checks (details per state below):

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 186 counties (all of them where a county has fewer), 4,076 values | 4,076 of 4,076 equal | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all county files | 186 counties added, no existing county changed, 0 mismatches | 0% |
| OpenStreetMap ID for ID vs live Overpass (`scripts/check_osm_extract_vs_overpass.py`) | Greenlee AZ, Esmeralda NV | 1,235 = 1,235 and 1,810 = 1,810 roads; 0 = 0 and 14 = 14 bus stops | 0% |
| Crash counts, Utah DOT (the only western state with a state source) | all 23 Utah counties, 341 block groups | 1/k rule, sums pass `crashCountsInvariant.test.ts`; 42 gaps, 66 strengths | |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, LIVE_PORT 9332-9339) | 15 counties (1 AZ, 2 in each other state), 45 points, 9 checks each (405) | 301 pass, 104 not checkable, 0 fail; 19 points had the house panel on live parcel records and passed all 10 checks; the rest had no parcel service or no parcel at the point (house rows not checkable). Every data file came from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200, GET 200); no console errors | 0 wrong values |

Files: `data/backtests/west_census_spot_2026-11-21.json`, `data/backtests/west_osm_xcheck_2026-11-21.json`,
`data/backtests/live_check_panels_2026-11-21_west_{az,nv,ut,wy,or,wa,nm,id}.json`,
`data/backtests/acs_fallback_mismatches_2026-11-21.json`.

**R2 storage:** before 1,220,931,278 bytes (1,503 objects); after 1,380,323,467 bytes (1.380 GB, 1,689 objects):
159,392,189 bytes added (the 186 data files, 159,344,749, plus the larger `manifest.json`). 1.380 GB of the 8 GB
ceiling and the 10 GB allowance. Every upload went through `scripts/r2_sync_counties.py` after a `--dry-run`.

**Pipeline code: not changed.** Test pins changed: `tests/unit/crashCountsInvariant.test.ts` (Utah 6 -> 29 files,
222 -> 245 outside California). Data flags changed: two corridor stops' `county_on_page` (Pasco WA, Sandpoint ID).

**No `sites_` files** were built (as for every small-county batch: `w5/tools/sites.py` needs the old build
machine's paths).

The batch is every county with no data file (not in `counties/bundle_*.json.gz`, not in `counties/.r2-only.txt`) whose
registry OSM extract (`national/data/counties.json`) is openstreetmap.fr's `us-west-latest.osm.pbf`. Recount before
starting, from the registry: AZ 6, NV 15, WY 22, UT 23, OR 26, WA 26, NM 28, ID 40, MT 52, **238 counties**; every one
has `split: us-west/<state>`, so no state points at sub-region files (unlike New York in the Northeast batch).

Left out (registry extract is not us-west, or no OSM extract): Colorado 53 (openstreetmap.fr Colorado sub-region
files: denver 3, northeast 10, northwest 14, southeast 12, southwest 14), California 2 (Los Angeles and Orange, built
by their own pipeline), Hawaii 5 and Alaska 1 (no extract in the registry), Puerto Rico 73.

The method is the Northeast batch's (`small-counties-northeast.md`), unchanged.

## Arizona (6 of 6 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Apache (04001) | 65,341 | 56 | 2,224,648 | C | 0 |
| Gila (04007) | 53,795 | 45 | 4,158,011 | C | 27 |
| Graham (04009) | 39,232 | 30 | 986,996 | D | 20 |
| Greenlee (04011) | 9,409 | 8 | 568,862 | D | 0 |
| La Paz (04012) | 16,664 | 29 | 535,283 | D | 17 |
| Santa Cruz (04023) | 48,926 | 36 | 764,394 | D | 18 |
| **6 counties** | **233,367** | **204** | **9,238,194** | 2 C, 4 D | 82 |

- OpenStreetMap: `us-west-latest.osm.pbf` (3,789,555,685 bytes, md5 `837d2bbdaa41cda846637e47ca6499d9`, equal to the
  published `us-west.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z), downloaded in 2 min 46 s. Arizona cut alone
  with `national/osm_split.py us-west --states AZ --per-pass 1`: 114 s, peak osmium memory 4.13 GB, 343 MB.
- Build: fetch 28-119 s, build 233-296 s per county, three at a time (most of the build is `osm_extract.py` reading
  the 343 MB state file: 221 s for Graham).
- Census spot check (`scripts/census_spot_check.py`, seed 20261119, 6 block groups per county): 144 of 144 values
  equal (0% mismatch). Tract-median flags: 6 counties added, no existing county changed, 0 mismatches.
- Live check from R2 (`LIVE_PORT=9332`): Santa Cruz, 3 block groups: neighborhood, canopy, canopy goal, crash text,
  state laws and console all pass; the house-panel rows are not checkable (no parcel service for the county). The
  data file came from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200, GET 200).
- Crash counts: Arizona has no state crash source connected; the files say crash gaps are not scored.
- R2: before 1,220,931,278 bytes (1,503 objects); dry run "7 files, net +0.009 GB, projected 1.230 GB"; after
  1,230,170,981 bytes (1,509 objects).

## Nevada (15 of 15 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Churchill (32001) | 25,805 | 20 | 411,232 | D | 16 |
| Douglas (32005) | 49,623 | 35 | 530,124 | C | 28 |
| Elko (32007) | 54,047 | 39 | 1,110,109 | C | 22 |
| Esmeralda (32009) | 1,028 | 1 | 890,171 | C | 0 |
| Eureka (32011) | 1,585 | 2 | 249,001 | D | 0 |
| Humboldt (32013) | 17,289 | 14 | 921,939 | C | 12 |
| Lander (32015) | 5,770 | 5 | 609,078 | C | 0 |
| Lincoln (32017) | 4,405 | 5 | 723,308 | D | 0 |
| Lyon (32019) | 61,680 | 40 | 766,661 | C | 24 |
| Mineral (32021) | 4,542 | 5 | 488,987 | D | 0 |
| Nye (32023) | 54,344 | 35 | 6,408,751 | C | 27 |
| Pershing (32027) | 6,487 | 6 | 452,878 | C | 0 |
| Storey (32029) | 4,140 | 3 | 301,510 | C | 1 |
| White Pine (32033) | 8,735 | 9 | 377,155 | D | 5 |
| Carson City (32510) | 58,384 | 45 | 263,453 | C | 44 |
| **15 counties** | **357,864** | **264** | **14,504,357** | 10 C, 5 D | 179 |

- Nevada cut alone: 112 s, peak osmium memory 4.10 GB, 154 MB. Build: fetch 14-190 s, build 87-159 s per county.
- Census spot check: AZ and NV together 444 of 444 values equal (0% mismatch). Tract-median flags: 15 counties added,
  no existing county changed, 0 mismatches.
- OpenStreetMap ID for ID vs a live Overpass query of the same box (maps.mail.ru mirror; 504 twice on each first):
  Greenlee AZ 1,235 = 1,235 roads, 0 = 0 bus stops; Esmeralda NV 1,810 = 1,810 roads, 14 = 14 bus stops (0%).
- Live check from R2 (`LIVE_PORT=9333`): Carson City, 3 points with the house panel on live parcel records: all 10
  checks pass at each (neighborhood, canopy, canopy goal, crash text, state laws, Census area, HUD rent, FEMA, USGS,
  console); Douglas, 3 points, no parcel service (house rows not checkable), the rest pass. Both data files came from
  the r2.dev address (HEAD 200, GET 200). Failed loads on the page: optional files (404), overpass-api.de blocked by
  CORS from this machine, three 403s, as in earlier batches.
- R2: dry run "16 files, net +0.015 GB, projected 1.245 GB"; after 1,244,679,103 bytes (1,524 objects).

## Utah (23 of 23 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Beaver (49001) | 7,273 | 6 | 192,718 | D | 0 |
| Box Elder (49003) | 61,246 | 42 | 1,204,938 | C | 33 |
| Carbon (49007) | 20,517 | 15 | 368,550 | C | 14 |
| Daggett (49009) | 783 | 1 | 255,680 | D | 0 |
| Duchesne (49013) | 20,185 | 12 | 529,837 | C | 4 |
| Emery (49015) | 10,046 | 9 | 1,418,226 | C | 0 |
| Garfield (49017) | 5,219 | 5 | 1,425,347 | D | 0 |
| Grand (49019) | 9,754 | 8 | 1,334,959 | C | 8 |
| Iron (49021) | 62,252 | 36 | 496,630 | D | 28 |
| Juab (49023) | 12,586 | 9 | 431,252 | C | 6 |
| Kane (49025) | 8,170 | 7 | 1,608,679 | D | 0 |
| Millard (49027) | 13,315 | 11 | 328,181 | D | 0 |
| Morgan (49029) | 12,802 | 6 | 673,372 | C | 0 |
| Piute (49031) | 1,694 | 2 | 151,554 | D | 0 |
| Rich (49033) | 2,631 | 2 | 647,971 | D | 0 |
| San Juan (49037) | 14,483 | 11 | 2,708,872 | D | 0 |
| Sanpete (49039) | 29,719 | 20 | 424,914 | D | 4 |
| Sevier (49041) | 22,085 | 17 | 375,398 | D | 7 |
| Summit (49043) | 42,970 | 36 | 1,163,853 | C | 24 |
| Tooele (49045) | 79,347 | 39 | 402,882 | C | 34 |
| Uintah (49047) | 37,056 | 23 | 647,022 | C | 16 |
| Wasatch (49051) | 36,642 | 22 | 855,575 | C | 19 |
| Wayne (49055) | 2,584 | 2 | 822,979 | D | 0 |
| **23 counties** | **513,359** | **341** | **18,469,389** | 11 C, 12 D | 197 |

- Utah cut alone: 138 s, peak osmium memory 4.10 GB, 192 MB. Build: fetch 20-130 s, build 81-108 s per county.
- **Interrupted and re-run:** the first build queue ran as a background job with the default 30-minute limit and was
  stopped at 12:22 while Emery, Garfield and Grand were being built (nothing had been exported for them). They were
  built again from the start of the pipeline (the fetch step reused the downloads already in their folders, hence
  fetch 4 s) and checked like the rest. The queue was restarted with the 2-hour limit.
- Census spot check: AZ, NV and UT together 924 of 924 values equal (0% mismatch). Tract-median flags: 23 counties
  added, no existing county changed, 0 mismatches.
- **Crash counts (Utah DOT, the state source the pipeline reads: UDOT UPlan "Utah Crash Locations", layers 2019-2025):**
  `scripts/build_state_crash_counts.py` (boundary rule, 1/k weighting) wrote `app/data/crash_counts/` for all 23
  (341 block groups); `scripts/recompute_crash_gaps.py` then found 42 pedestrian/cyclist gaps and 66 strengths (only
  counties with enough block groups for the 20-peer minimum get either), dropped 487 crash-based improvement rows
  that the rebuilt counts no longer qualify and re-sized 32 (the same rule as every county with a state source).
  `tests/unit/crashCountsInvariant.test.ts` pinned Utah at 6 files and 222 outside California; it now pins 29 and 245
  (the 23 new files pass its 1/k sum check).
- R2: dry run "24 files, net +0.018 GB, projected 1.263 GB"; after 1,263,154,945 bytes (1,547 objects).
- Live check from R2 (`LIVE_PORT=9334`): Summit and Iron, 3 points each: 4 points with the house panel on live
  parcel records pass all 10 checks; 2 points with no parcel at the point pass the 6 checks that apply. The crash
  rows show the rebuilt 1/k counts (e.g. Summit 490439643073: 2 pedestrian/cyclist, 4.5 killed or seriously injured,
  127.3 all, a pedestrian/cyclist gap), as `crash_counts/49043.json` and `crash_gaps/49043.json` hold. Data files
  from the r2.dev address (HEAD 200, GET 200); no console errors.

## Wyoming (22 of 22 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Albany (56001) | 38,249 | 33 | 823,569 | D | 29 |
| Big Horn (56003) | 11,828 | 9 | 461,458 | D | 0 |
| Campbell (56005) | 47,240 | 29 | 477,963 | D | 26 |
| Carbon (56007) | 14,463 | 16 | 842,212 | D | 9 |
| Converse (56009) | 13,762 | 11 | 412,670 | D | 6 |
| Crook (56011) | 7,455 | 6 | 334,602 | D | 0 |
| Fremont (56013) | 39,533 | 33 | 1,449,502 | C | 23 |
| Goshen (56015) | 12,605 | 12 | 212,066 | D | 8 |
| Hot Springs (56017) | 4,620 | 4 | 254,431 | D | 0 |
| Johnson (56019) | 8,686 | 7 | 618,054 | D | 6 |
| Lincoln (56023) | 20,486 | 15 | 1,520,448 | C | 0 |
| Natrona (56025) | 79,977 | 56 | 449,774 | D | 53 |
| Niobrara (56027) | 2,368 | 2 | 219,625 | D | 0 |
| Park (56029) | 30,449 | 23 | 1,526,809 | D | 17 |
| Platte (56031) | 8,612 | 9 | 274,892 | D | 0 |
| Sheridan (56033) | 32,055 | 22 | 376,484 | D | 18 |
| Sublette (56035) | 8,838 | 7 | 859,083 | D | 0 |
| Sweetwater (56037) | 41,542 | 34 | 611,034 | D | 32 |
| Teton (56039) | 23,396 | 20 | 1,147,335 | C | 9 |
| Uinta (56041) | 20,644 | 17 | 538,716 | D | 11 |
| Washakie (56043) | 7,703 | 9 | 245,753 | D | 7 |
| Weston (56045) | 6,826 | 5 | 291,967 | D | 0 |
| **22 counties** | **481,337** | **379** | **13,948,447** | 3 C, 19 D | 254 |

- Wyoming cut alone: 132 s, peak osmium memory 4.05 GB, 106 MB. Build: fetch 2-68 s, build 56-76 s per county (the
  smallest state file, so the fastest builds).
- **Built twice (my mistake, no effect on the files):** after the Utah commit I deleted build folders by taking the
  first 44 lines of a queue file that also listed Wyoming, which removed the 20 finished and 2 running Wyoming
  folders before they were exported (2 of the running builds then failed). All 22 were built again from scratch,
  the first run's logs kept aside, and only the second run was exported. Since then folders are deleted by each
  state's own list.
- Census spot check: AZ, NV, UT and WY together 1,424 of 1,424 values equal (0% mismatch). Tract-median flags: 22
  counties added, no existing county changed, 0 mismatches.
- Crash counts: Wyoming has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9335`): Albany and Park, 3 points each, all with the house panel on live parcel
  records: all 10 checks pass at all 6 points. Data files from the r2.dev address (HEAD 200, GET 200).
- R2: the first dry run stopped on a malformed Cloudflare API reply (JSON "Extra data"; nothing was uploaded); run
  again: "23 files, net +0.014 GB, projected 1.277 GB"; after 1,277,108,927 bytes (1,569 objects).

## Oregon (26 of 26 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Baker (41001) | 16,840 | 17 | 950,773 | C | 10 |
| Benton (41003) | 96,303 | 67 | 733,801 | C | 59 |
| Clatsop (41007) | 41,363 | 37 | 886,483 | C | 25 |
| Columbia (41009) | 53,493 | 40 | 731,198 | C | 26 |
| Coos (41011) | 64,827 | 67 | 1,000,663 | C | 47 |
| Crook (41013) | 26,277 | 20 | 695,573 | C | 13 |
| Curry (41015) | 23,381 | 21 | 1,003,585 | C | 12 |
| Gilliam (41021) | 1,971 | 2 | 340,293 | D | 0 |
| Grant (41023) | 7,209 | 8 | 1,169,595 | C | 0 |
| Harney (41025) | 7,499 | 7 | 1,136,001 | C | 5 |
| Hood River (41027) | 23,905 | 19 | 498,148 | C | 11 |
| Jefferson (41031) | 25,203 | 19 | 533,349 | C | 7 |
| Josephine (41033) | 88,179 | 65 | 1,519,295 | C | 47 |
| Klamath (41035) | 70,247 | 70 | 1,381,450 | C | 49 |
| Lake (41037) | 8,267 | 10 | 1,325,492 | D | 0 |
| Lincoln (41041) | 50,964 | 47 | 801,635 | C | 37 |
| Malheur (41045) | 31,954 | 31 | 1,129,389 | C | 13 |
| Morrow (41049) | 12,300 | 10 | 485,435 | C | 0 |
| Polk (41053) | 89,662 | 48 | 607,096 | C | 39 |
| Sherman (41055) | 1,938 | 2 | 350,255 | C | 0 |
| Tillamook (41057) | 27,496 | 30 | 871,427 | C | 18 |
| Umatilla (41059) | 79,940 | 63 | 1,251,398 | C | 50 |
| Union (41061) | 26,144 | 26 | 1,035,968 | C | 17 |
| Wallowa (41063) | 7,553 | 8 | 873,435 | C | 0 |
| Wasco (41065) | 26,552 | 22 | 1,149,653 | C | 18 |
| Wheeler (41069) | 1,485 | 2 | 498,393 | C | 0 |
| **26 counties** | **910,952** | **758** | **22,959,783** | 24 C, 2 D | 503 |

- Oregon cut alone: 146 s, peak osmium memory 4.17 GB, 318 MB. Build: fetch 17-90 s, build 122-147 s per county.
- Census spot check: all 92 counties so far, 2,000 of 2,000 values equal (0% mismatch). Tract-median flags: 26
  counties added, no existing county changed, 0 mismatches.
- Crash counts: Oregon has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9336`): Klamath and Crook, 3 points each; neither county has a parcel service on the
  page, so the house rows are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console
  pass at all 6. Data files from the r2.dev address (HEAD 200, GET 200).
- R2: dry run "27 files, net +0.023 GB, projected 1.300 GB"; after 1,300,075,243 bytes (1,595 objects).

## Washington (26 of 26 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (current release) |
|---|---|---|---|---|---|
| Adams (53001) | 20,800 | 15 | 348,518 | C | 7 |
| Asotin (53003) | 22,467 | 21 | 556,044 | C | 21 |
| Chelan (53007) | 80,172 | 63 | 2,607,297 | C | 50 |
| Clallam (53009) | 77,813 | 66 | 1,863,528 | C | 51 |
| Columbia (53013) | 4,014 | 5 | 324,985 | D | 0 |
| Douglas (53017) | 44,366 | 31 | 1,115,317 | C | 22 |
| Ferry (53019) | 7,387 | 8 | 494,649 | C | 0 |
| Franklin (53021) | 98,902 | 56 | 693,015 | C | 50 |
| Garfield (53023) | 2,353 | 3 | 491,058 | C | 0 |
| Grays Harbor (53027) | 77,053 | 68 | 3,350,468 | C | 51 |
| Island (53029) | 86,836 | 65 | 791,028 | C | 46 |
| Jefferson (53031) | 33,577 | 27 | 3,745,130 | C | 16 |
| Kittitas (53037) | 47,172 | 32 | 1,813,286 | C | 23 |
| Klickitat (53039) | 23,411 | 19 | 871,358 | C | 5 |
| Lewis (53041) | 85,154 | 62 | 3,269,388 | C | 32 |
| Lincoln (53043) | 11,489 | 11 | 415,664 | C | 0 |
| Mason (53045) | 67,982 | 56 | 1,449,300 | C | 27 |
| Okanogan (53047) | 43,425 | 43 | 2,430,806 | C | 13 |
| Pacific (53049) | 23,994 | 25 | 2,500,788 | C | 12 |
| Pend Oreille (53051) | 14,050 | 14 | 505,059 | C | 0 |
| San Juan (53055) | 18,478 | 19 | 379,364 | C | 5 |
| Skamania (53059) | 12,402 | 10 | 1,049,617 | C | 0 |
| Stevens (53065) | 48,067 | 38 | 769,337 | C | 8 |
| Wahkiakum (53069) | 4,658 | 5 | 735,137 | C | 0 |
| Walla Walla (53071) | 62,161 | 46 | 452,711 | C | 37 |
| Whitman (53075) | 47,003 | 35 | 568,989 | C | 24 |
| **26 counties** | **1,065,186** | **843** | **33,591,841** | 25 C, 1 D | 500 |

- Washington cut alone: 144 s, peak osmium memory 4.16 GB, 441 MB (the largest state file). Build: fetch 15-128 s,
  build 170-205 s per county.
- Canopy: American Forests' Washington zip has a newer member (dated 2026-03-13) than the other states (2025-07-01);
  `build_tree_equity_2025.py` records it per file; the 13 existing Washington files changed only in their build date
  and were left as committed.
- Census spot check: all 118 counties so far, 2,604 of 2,604 values equal (0% mismatch). Tract-median flags: 26
  counties added, no existing county changed, 0 mismatches.
- Crash counts: Washington has no state crash source connected.
- Transit corridors: the Big Sky North Coast corridor's Pasco stop is in Franklin County (53021), now on the page;
  its `county_on_page` flag in `app/data/intercity_transit_corridors.json` is set to true (only the flag changed;
  `tests/unit/transitCorridors.test.ts` checks it against the manifest).
- Live check from R2 (`LIVE_PORT=9337`): Kittitas and Walla Walla, 3 points each, all with the house panel on live
  parcel records: all 10 checks pass at all 6 points. Data files from the r2.dev address (HEAD 200, GET 200).
- R2: dry run "27 files, net +0.034 GB, projected 1.334 GB"; after 1,333,673,648 bytes (1,621 objects).

## New Mexico (28 of 28 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Catron (35003) | 3,743 | 5 | 1,059,643 | D | 0 |
| Chaves (35005) | 64,217 | 53 | 859,688 | C | 44 |
| Cibola (35006) | 26,845 | 23 | 535,556 | C | 13 |
| Colfax (35007) | 12,322 | 16 | 772,527 | C | 11 |
| Curry (35009) | 47,638 | 43 | 139,260 | D | 37 |
| De Baca (35011) | 1,576 | 2 | 191,297 | D | 0 |
| Eddy (35015) | 61,105 | 44 | 571,562 | C | 41 |
| Grant (35017) | 27,775 | 25 | 1,694,664 | C | 21 |
| Guadalupe (35019) | 4,381 | 4 | 287,167 | C | 0 |
| Harding (35021) | 741 | 1 | 230,304 | D | 0 |
| Hidalgo (35023) | 4,041 | 3 | 580,831 | C | 0 |
| Lea (35025) | 73,733 | 61 | 254,365 | C | 50 |
| Lincoln (35027) | 20,224 | 23 | 544,773 | D | 17 |
| Los Alamos (35028) | 19,435 | 17 | 162,754 | C | 17 |
| Luna (35029) | 25,611 | 19 | 781,604 | C | 14 |
| McKinley (35031) | 70,431 | 62 | 1,525,401 | C | 23 |
| Mora (35033) | 4,149 | 5 | 355,982 | C | 0 |
| Otero (35035) | 68,816 | 60 | 914,926 | D | 34 |
| Quay (35037) | 8,564 | 12 | 269,835 | D | 9 |
| Rio Arriba (35039) | 40,070 | 30 | 4,137,496 | C | 19 |
| Roosevelt (35041) | 18,928 | 16 | 204,965 | D | 14 |
| San Miguel (35047) | 26,850 | 31 | 670,080 | C | 18 |
| Sierra (35051) | 11,500 | 12 | 1,412,755 | D | 11 |
| Socorro (35053) | 16,200 | 14 | 943,486 | D | 8 |
| Taos (35055) | 34,543 | 30 | 858,653 | C | 18 |
| Torrance (35057) | 15,490 | 12 | 236,125 | C | 0 |
| Union (35059) | 4,013 | 4 | 321,952 | D | 0 |
| Valencia (35061) | 78,458 | 55 | 380,646 | C | 50 |
| **28 counties** | **791,399** | **682** | **20,898,297** | 17 C, 11 D | 469 |

- New Mexico cut alone: 148 s, peak osmium memory 4.16 GB, 152 MB. Build: fetch 11-95 s, build 74-109 s per county.
- Census spot check: all 146 counties so far, 3,204 of 3,204 values equal (0% mismatch). Tract-median flags: 28
  counties added, no existing county changed, 0 mismatches.
- Crash counts: New Mexico has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9338`): Los Alamos and Taos, 3 points each; neither county has a parcel service on
  the page (house rows not checkable); neighborhood, canopy, canopy goal, crash text, state laws and console pass at
  all 6. Data files from the r2.dev address (HEAD 200, GET 200).
- R2: dry run "29 files, net +0.021 GB, projected 1.355 GB"; after 1,354,578,978 bytes (1,649 objects).

## Idaho (40 of 40 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams (16003) | 4,744 | 5 | 682,562 | D | 0 |
| Bannock (16005) | 89,454 | 64 | 507,168 | C | 56 |
| Bear Lake (16007) | 6,650 | 7 | 369,242 | D | 0 |
| Benewah (16009) | 10,142 | 9 | 291,018 | C | 0 |
| Bingham (16011) | 49,664 | 32 | 774,374 | D | 20 |
| Blaine (16013) | 24,951 | 20 | 1,155,223 | C | 18 |
| Boise (16015) | 8,273 | 8 | 1,038,063 | C | 0 |
| Bonner (16017) | 51,049 | 44 | 878,366 | C | 16 |
| Boundary (16021) | 13,172 | 9 | 472,330 | C | 0 |
| Butte (16023) | 2,684 | 3 | 336,579 | D | 0 |
| Camas (16025) | 1,124 | 1 | 345,833 | C | 0 |
| Caribou (16029) | 7,162 | 7 | 447,370 | D | 0 |
| Cassia (16031) | 25,483 | 19 | 414,180 | D | 12 |
| Clark (16033) | 849 | 1 | 418,138 | D | 0 |
| Clearwater (16035) | 9,012 | 13 | 994,193 | D | 0 |
| Custer (16037) | 4,470 | 4 | 1,049,962 | C | 0 |
| Elmore (16039) | 29,321 | 19 | 1,147,472 | C | 14 |
| Franklin (16041) | 15,056 | 10 | 294,441 | C | 0 |
| Fremont (16043) | 13,943 | 12 | 529,715 | D | 0 |
| Gem (16045) | 20,614 | 12 | 343,747 | D | 12 |
| Gooding (16047) | 15,931 | 13 | 233,495 | D | 0 |
| Idaho (16049) | 17,432 | 15 | 2,710,357 | D | 0 |
| Jefferson (16051) | 33,154 | 16 | 374,548 | D | 8 |
| Jerome (16053) | 25,173 | 19 | 301,356 | D | 13 |
| Latah (16057) | 41,049 | 31 | 463,748 | D | 19 |
| Lemhi (16059) | 8,249 | 8 | 1,039,425 | D | 0 |
| Lewis (16061) | 3,682 | 5 | 346,790 | D | 0 |
| Lincoln (16063) | 5,358 | 4 | 238,986 | D | 0 |
| Madison (16065) | 54,618 | 32 | 318,059 | D | 27 |
| Minidoka (16067) | 22,208 | 16 | 213,336 | D | 14 |
| Nez Perce (16069) | 42,697 | 36 | 631,392 | C | 29 |
| Oneida (16071) | 4,768 | 3 | 194,946 | D | 0 |
| Owyhee (16073) | 12,503 | 9 | 1,988,850 | C | 0 |
| Payette (16075) | 26,771 | 16 | 246,088 | C | 11 |
| Power (16077) | 8,133 | 7 | 449,597 | C | 0 |
| Shoshone (16079) | 13,785 | 17 | 1,075,387 | C | 0 |
| Teton (16081) | 12,425 | 19 | 221,571 | C | 0 |
| Twin Falls (16083) | 93,734 | 57 | 607,028 | D | 37 |
| Valley (16085) | 12,389 | 12 | 1,090,610 | D | 3 |
| Washington (16087) | 11,142 | 10 | 498,896 | D | 6 |
| **40 counties** | **853,018** | **644** | **25,734,441** | 16 C, 24 D | 315 |

- Idaho cut alone: 126 s, peak osmium memory 4.11 GB, 157 MB. Build: fetch 3-100 s, build 58-80 s per county.
- **Interrupted and re-run:** the second build queue reached the 2-hour background limit at 14:22 while Clearwater,
  Custer and Elmore were being built; they were built again from the start in a new queue that held only the 26
  Idaho counties not yet built, and checked like the rest.
- Census spot check: all 186 counties, 4,076 of 4,076 values equal (0% mismatch). Tract-median flags: 40 counties
  added, no existing county changed, 0 mismatches.
- Crash counts: Idaho has no state crash source connected.
- Transit corridors: the Big Sky North Coast corridor's Sandpoint stop is in Bonner County (16017), now on the page;
  its `county_on_page` flag is set to true (only the flag changed).
- R2: dry run "41 files, net +0.026 GB, projected 1.380 GB"; after 1,380,323,467 bytes (1,689 objects).
- Live check from R2 (`LIVE_PORT=9339`): Latah and Twin Falls, 3 points each; the checker found no parcel near any
  of the 6 block-group interior points, so the house rows are not checkable; neighborhood, canopy, canopy goal, crash
  text, state laws and console pass at all 6. Data files from the r2.dev address (HEAD 200, GET 200).

## Montana (52 of 52 built, none withheld; second session, 21 Nov 15:14-15:47 UTC)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Beaverhead (30001) | 9,713 | 10 | 1,442,690 | C | 7 |
| Big Horn (30003) | 12,891 | 11 | 921,460 | D | 0 |
| Blaine (30005) | 6,949 | 6 | 364,231 | D | 0 |
| Broadwater (30007) | 7,668 | 5 | 399,740 | D | 0 |
| Carbon (30009) | 11,116 | 12 | 540,244 | D | 0 |
| Carter (30011) | 1,308 | 2 | 171,494 | D | 0 |
| Cascade (30013) | 84,606 | 75 | 531,107 | C | 65 |
| Chouteau (30015) | 5,906 | 6 | 533,070 | C | 0 |
| Custer (30017) | 11,961 | 14 | 250,989 | D | 13 |
| Daniels (30019) | 1,494 | 2 | 62,860 | D | 0 |
| Dawson (30021) | 8,827 | 10 | 170,465 | D | 8 |
| Deer Lodge (30023) | 9,597 | 11 | 349,451 | D | 8 |
| Fallon (30025) | 2,760 | 3 | 137,244 | D | 0 |
| Fergus (30027) | 11,687 | 10 | 646,425 | D | 8 |
| Garfield (30033) | 1,094 | 1 | 392,402 | D | 0 |
| Glacier (30035) | 13,637 | 15 | 1,774,453 | C | 0 |
| Golden Valley (30037) | 899 | 1 | 298,679 | D | 0 |
| Granite (30039) | 3,462 | 3 | 551,031 | D | 0 |
| Hill (30041) | 16,155 | 14 | 257,117 | C | 12 |
| Jefferson (30043) | 12,774 | 9 | 529,332 | D | 0 |
| Judith Basin (30045) | 2,071 | 2 | 216,465 | D | 0 |
| Lake (30047) | 32,561 | 27 | 707,821 | D | 7 |
| Lewis and Clark (30049) | 73,464 | 54 | 1,252,903 | D | 46 |
| Liberty (30051) | 1,952 | 2 | 86,754 | D | 0 |
| Lincoln (30053) | 21,175 | 20 | 1,201,818 | C | 8 |
| McCone (30055) | 1,670 | 2 | 198,052 | C | 0 |
| Madison (30057) | 9,223 | 8 | 844,544 | C | 0 |
| Meagher (30059) | 2,007 | 3 | 364,732 | D | 0 |
| Mineral (30061) | 4,959 | 5 | 666,570 | D | 0 |
| Musselshell (30065) | 5,152 | 5 | 247,932 | D | 0 |
| Park (30067) | 17,710 | 18 | 1,156,820 | C | 10 |
| Petroleum (30069) | 447 | 1 | 296,743 | D | 0 |
| Phillips (30071) | 4,221 | 4 | 454,663 | C | 0 |
| Pondera (30073) | 6,035 | 7 | 981,325 | C | 0 |
| Powder River (30075) | 1,815 | 2 | 257,429 | D | 0 |
| Powell (30077) | 7,053 | 8 | 845,969 | D | 0 |
| Prairie (30079) | 1,250 | 1 | 166,744 | D | 0 |
| Ravalli (30081) | 46,727 | 32 | 1,056,911 | D | 8 |
| Richland (30083) | 11,235 | 9 | 164,617 | D | 7 |
| Roosevelt (30085) | 10,526 | 10 | 183,704 | C | 0 |
| Rosebud (30087) | 8,165 | 8 | 847,506 | D | 0 |
| Sanders (30089) | 13,285 | 11 | 1,463,963 | C | 0 |
| Sheridan (30091) | 3,669 | 4 | 115,035 | D | 0 |
| Silver Bow (30093) | 35,785 | 37 | 389,484 | D | 36 |
| Stillwater (30095) | 9,182 | 7 | 795,744 | D | 0 |
| Sweet Grass (30097) | 3,720 | 5 | 778,258 | D | 0 |
| Teton (30099) | 6,353 | 6 | 456,158 | D | 0 |
| Toole (30101) | 5,061 | 8 | 149,554 | C | 0 |
| Treasure (30103) | 732 | 1 | 90,425 | D | 0 |
| Valley (30105) | 7,519 | 8 | 465,506 | C | 0 |
| Wheatland (30107) | 2,056 | 2 | 401,669 | D | 0 |
| Wibaux (30109) | 1,193 | 1 | 77,625 | D | 0 |
| **52 counties** | **592,477** | **538** | **27,707,927** | 15 C, 37 D | 243 |

- OpenStreetMap: the Montana cut left by the first session (`us-west__montana-latest.osm.pbf`, 118,300,541 bytes,
  same us-west snapshot, 2026-11-21T01:28:06Z). Build: the same `build_one.sh` steps (fetch_oc, osm_extract,
  metrics_oc, layers_oc, build_oc inputs/page_dec), three at a time, detached from the tool so no time limit stopped
  it: all 52 in 26 min (15:15-15:41), fetch 12-91 s, build 50-71 s per county, no failure. Exported, checked,
  uploaded and committed in three groups (10, 16, 26), each upload committed right after.
- Census spot check (`scripts/census_spot_check.py`, seed 20261119, 6 block groups per county or all of them):
  948 of 948 values equal (0% mismatch), `data/backtests/mt_census_spot_2026-11-21.json`. Tract-median flags: 52
  counties added, no existing county changed, 0 mismatches.
- Canopy (`build_tree_equity_2025.py mt`, release 2025-07-01): 52 new files; the 4 existing Montana files differed
  only in their build date and were left as committed.
- Completeness: 52 rows from a fresh `build_county_completeness.py` run (15 C, 37 D); every other row left as
  committed.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru mirror, 504 first), `data/backtests/mt_osm_xcheck_2026-11-21.json`:
  Broadwater (30007, interior) 2,408 = 2,408 roads, 0 = 0 bus stops (0%). Blaine (30005, on the Canadian border):
  2,362 of 2,378 roads in the box, 0 = 0 bus stops; the 16 missing roads, looked up by ID on the same mirror, all lie
  wholly north of 49.005 N (in Canada, which the us-west file does not hold), so 0 missing on the US side.
- Live check from R2 (`LIVE_PORT=9350`, `data/backtests/live_check_panels_2026-11-21_mt.json`): Cascade (30013)
  and Carbon (30009), 3 points each, all with the house panel on live parcel records (Montana Cadastral Framework):
  all 10 checks pass at all 6 points. Data files from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200,
  GET 200); no console errors (404s for optional files, as before).
- Crash counts: Montana has no state crash source connected; the files say crash gaps are not scored.
- Transit corridors: the Big Sky North Coast corridor's Glendive (30021), Helena (30049), Butte (30093) and St. Regis
  (30061) stops are now in counties on the page; their `county_on_page` flags are set to true (only the flags changed;
  `tests/unit/transitCorridors.test.ts` failed until they were, as it should).
- R2 (`--usage` and the script's byte total): before 1,380,323,467 bytes (1,689 objects). Dry runs "11 files, net
  +0.005 GB, projected 1.386 GB", "17 files, +0.009 GB, 1.394 GB", "27 files, +0.014 GB, 1.408 GB"; after
  **1,408,044,502 bytes** (1.408 GB, 1,741 objects): 27,721,035 bytes added (the 52 data files, 27,707,927, plus the
  larger `manifest.json`). 1.408 GB of the 8 GB ceiling and the 10 GB allowance.
- Tests: `npm test` 1,280 of 1,280 and `npm run typecheck` clean before each of the three commits. `PW_PORT=9360 npm run
  test:e2e -- --trace off` after the last Montana commit: 87 of 87 passed (7.4 min).

## Found on the way

- **`scripts/r2_sync_counties.py` uploads on any unrecognised argument (found, not changed).** It reads only
  `--dry-run` and `--usage`; anything else, including `--help`, runs a real upload. Run once with `--help` at the start
  of this batch, it printed the account total and "To upload: 0 files" (nothing was pending), so nothing was sent. The
  storage guard still applies on that path, but a script whose job is to protect the owner's limit should refuse
  unknown arguments. Not changed here (the brief allows pipeline changes only when a county cannot build otherwise).
- **Background time limits stopped two build queues.** The first queue ran under the default 30-minute limit and the
  second under the 2-hour maximum; each stop killed the three builds in flight (Emery, Garfield, Grand UT; Clearwater,
  Custer, Elmore ID). Nothing had been exported for them; each was built again from the start and checked.
- **Wyoming built twice** (my deletion mistake, described in the Wyoming section; no effect on the published files).
- **One malformed Cloudflare API reply** (JSON "Extra data") stopped a dry run; nothing was uploaded; the rerun was
  normal.

## What is left

- ~~Montana: 52 counties~~ **done (see "Montana")**. Was: registry `split: us-west/montana`. Its state file is cut
  (`us-west__montana-latest.osm.pbf`, 118 MB, from the same us-west snapshot, 2026-11-21T01:28:06Z; recorded in
  `national/data/osm_split.json`) and was kept in the session's scratch folder; if it is gone, download us-west
  again and run `osm_split.py us-west --states MT --per-pass 1`. At this batch's pace (Idaho: 26 counties in 15 min
  three at a time) Montana is about 30 minutes of builds plus about 15 minutes of checks. Montana has no state crash
  source connected.
- **Not us-west, left out of this batch:** Colorado 53 (the registry clips them from openstreetmap.fr's five Colorado
  sub-region files, the same edge problem the Northeast batch found for New York: cut Colorado from us-west instead),
  Hawaii 5 and Alaska 1 (no OSM extract in the registry), Puerto Rico 73.
- Registry count after this batch (Puerto Rico, Los Angeles and Orange left out): **2,096 counties with no data
  file**, 2,093 under 100,000 people (43,754 block groups, 51,105,486 people by ACS 2020-24): the Northeast batch's
  2,282 and 2,279 less these 186.

## Tests

- Before every state's commit: `npm test` (1,211 tests before Utah, 1,280 after: the suite adds per-county tests for
  crash files) and `npm run typecheck` clean.
- `PW_PORT=9331 npm run test:e2e -- --trace off` after the Idaho commit (all eight states in): 87 of 87 passed (7.8 min).
- Two test-facing data changes, both stated in their commits: `crashCountsInvariant.test.ts` pins (Utah) and the two
  corridor `county_on_page` flags. No test was skipped or loosened.
