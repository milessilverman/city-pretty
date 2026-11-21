# Small counties: the West (21 Nov 2026), served from R2 only

In progress; this file is rewritten as each state group is uploaded and committed.

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
