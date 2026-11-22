# Small counties: the Midwest (22 Nov 2026), served from R2 only

**Result: all 630 counties of the eight states are built, checked and on the page, served from R2 only; none was
withheld.** Each state was built, checked, uploaded, live-checked and committed on its own.

| State | Counties built / missing | People (ACS 2020-24) | Block groups | Data files (bytes) | Tiers | Census values checked | R2 bytes added |
|---|---|---|---|---|---|---|---|
| IA | 91 / 91 | 1,700,351 | 1,650 | 22,372,507 | 19 C, 72 D | 2,176 | 22,485,343 |
| NE | 90 / 90 | 863,886 | 787 | 12,532,297 | 11 C, 79 D | 1,608 | 12,554,848 |
| KS | 100 / 100 | 1,332,359 | 1,214 | 14,776,609 | 10 C, 90 D | 1,972 | 14,801,692 |
| MN | 75 / 75 | 1,795,733 | 1,569 | 28,730,377 | 25 C, 50 D | 1,772 | 28,749,271 |
| SD | 64 / 64 | 590,627 | 482 | 10,760,889 | 1 C, 63 D | 1,140 | 10,776,933 |
| ND | 51 / 51 | 490,841 | 437 | 12,638,962 | 10 C, 41 D | 864 | 12,651,754 |
| WI | 56 / 56 | 2,006,627 | 1,678 | 31,594,961 | 15 C, 41 D | 1,336 | 31,609,050 |
| MO | 103 / 103 | 2,342,773 | 2,056 | 29,078,889 | 25 C, 78 D | 2,444 | 29,104,788 |
| **All** | **630 / 630** | **11,123,197** | **9,873** | **162,485,491** | 116 C, 514 D | **13,312** | **162,733,679** |

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 630 counties (all of them where a county has fewer), 13,312 values | 13,312 of 13,312 equal | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all county files, after each state | 630 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap ID for ID vs live Overpass (`scripts/check_osm_extract_vs_overpass.py`) | 2 counties per state, 16 | 15 counties exact (roads and bus stops); Adams ND 699 roads on Overpass, 698 in the extract: 1 road on the edge of the box margin (see North Dakota) | 0% inside the counties; 1 road of 699 in one box |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, `LIVE_PORT=9191`, 3 points per county) | 16 counties, 48 points | 325 pass, 105 not checkable (no parcel service or no parcel at the point, so the house-panel rows do not apply); North Dakota: 4 USGS elevation rows first showed "did not answer in time" (the page's 6 s limit), 2 passed when re-opened alone and 2 still showed it; no wrong value was shown anywhere | 0 wrong values |

Counties still without a data file after this batch, counted from the registry the same way (not in
`counties/bundle_*.json.gz` or `counties/.r2-only.txt`, Puerto Rico left out): **1,415** (2,045 before), of which Los
Angeles and Orange (built by their own pipeline, loaded from `app/data/`) are 2 and Hawaii's 5 have no OpenStreetMap
extract in the registry. Remaining by state: TX 211, GA 132, VA 116, KY 113, IL 82, MS 76, IN 75, OK 72, NC 71, AR 67,
MI 63, OH 61, AL 53, CO 53, WV 52, LA 50, FL 31, SC 30, HI 5, CA 2.

**R2 storage:** before 1,410,317,266 bytes (1,742 objects), after 1,573,050,945 bytes (2,372 objects): 162,733,679 bytes
added (the 630 data files, 162,485,491, plus the larger `manifest.json`). 1.573 GB of the 8 GB ceiling and the 10 GB
allowance. Every upload went through `scripts/r2_sync_counties.py` after a `--dry-run`; the per-state figures are in
each state's section.

**Measured projection for the rest:** this batch stored 16,458 bytes per block group (state range 12,172 for Kansas to
28,922 for North Dakota; 257,913 bytes per county). The 1,410 remaining counties under 100,000 people have 33,340 block
groups (ACS 2020-24 B01003 rows). At this batch's rate that is 0.55 GB (0.41 GB at the lowest state's rate, 0.96 GB at
the highest), which would take R2 from 1.573 GB to about 2.1 GB (range 2.0 to 2.5 GB). The southern states'
files may be larger per block group than these rural states' (the handoff estimated 0.5-0.85 MB per county, against 0.26
MB here), so this is a projection from rural Midwest counties, not a measurement of them.

The batch is every county with no data file (not in `counties/bundle_*.json.gz`, not in `counties/.r2-only.txt`) in
Iowa, Nebraska, Kansas, Minnesota, South Dakota, North Dakota, Wisconsin and Missouri. Counted from the registry
(`national/data/counties.json`) before starting: IA 91, NE 90, KS 100, MN 75, SD 64, ND 51, WI 56, MO 103, **630
counties**. Every one has `split: us-midwest/<state>`: the registry extract is openstreetmap.fr's
`us-midwest-latest.osm.pbf`, cut to one state at a time, so no state points at sub-region files (unlike New York and
Colorado).

The method is the Northeast and West batches' (`small-counties-northeast.md`, `small-counties-west.md`), unchanged: the
files are uploaded to the R2 bucket with `scripts/r2_sync_counties.py` after a `--dry-run`, listed in
`counties/.r2-only.txt`, and not committed. No pipeline code was changed.

## How

- **OpenStreetMap:** `us-midwest-latest.osm.pbf` from download.openstreetmap.fr (2,816,740,006 bytes, md5
  `e549a1125cf9e2b88b1cf3a44813b0a8`, equal to the published `us-midwest.osm.pbf.md5`; data timestamp
  2026-11-21T01:07:35Z from the published `us-midwest.state.txt`; the `-latest` names of `.md5` and `.state.txt`
  answer 404), downloaded in about 3 min. One state cut at a time with `national/osm_split.py us-midwest --states ST
  --per-pass 1` (osmium `extract -s smart`, union of the state's county boxes plus 0.05 degrees); the state file and
  each county's build folder were deleted once the state was uploaded and checked, so the scratch folder never held
  more than the regional file, one state file and one state's builds (about 3.5 GB, limit 5 GB).
- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec`
  from a copy of `pipeline/` in the session's scratch folder, four counties at a time, the national ACS table files
  downloaded once into the shared cache; then `scripts/export_county_bundle.py <dir> <fips> --r2-only` one county at a
  time; `build_tree_equity_2025.py <state>` (existing counties' files that differ only in `_meta.built` were left as
  committed); `build_acs_fallback_flags.py` (all county files); `build_county_completeness.py` (only the new rows are
  kept, as in the earlier batches, since a fresh run rewrites `computed_on` on every row).
- **HUD income limits:** `tests/unit/buildingCosts.test.ts` requires `app/data/hud_income_limits.json` to hold a row
  (or a listed failure) for every county in `counties/manifest.json`, so each state adds its counties' rows. They were
  fetched from HUD's API (`https://www.huduser.gov/hudapi/public/il/data/<fips>99999`) with the script's own `get()`
  and `row_from()` (`scripts/costs/fetch_hud_income_limits.py`); rows already in the file were not re-fetched or
  changed, and `_source.added_for_new_counties` says what was added and when.
- **Crash counts:** none of the eight states has a state crash source wired in: `pipeline/region.py`
  `STATE_DEFAULTS` holds IL, ME, PA, TN, UT and VA only (checked), and every new file's "State crash records" row says
  "Not connected for <state> yet: crash gaps are not scored". No crash counts were built for these counties.
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency and rail distance where the per-state notes below say so.

## Checks (every state)

- **Census:** `scripts/census_spot_check.py` (seed 20261119): population, median home value, median gross rent and
  median household income of 6 randomly chosen block groups in every county (all of them where a county has fewer)
  against the ACS 2020-24 table files (`acsdt5y2024-b01003/b25077/b25064/b19013.dat`, downloaded this session by
  `fetch_oc.py`), read by a separate parser. Where the block group's median is suppressed the file must hold the
  tract's published median, flagged as a tract value in `acs_fallback_flags.json`, or nothing.
- **OpenStreetMap:** `scripts/check_osm_extract_vs_overpass.py`, ID for ID against a live Overpass query of the same
  box (maps.mail.ru mirror), two counties per state. The extract is a 21 Nov snapshot and Overpass is live, so a few
  differences could be edits made since; the IDs would be listed.
- **Live:** `scripts/live_check_panels.mjs` (`LIVE_PORT=9191`, 3 points per county) on the real page loading each
  county's file from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev`.

## Iowa (91 of 91 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adair County (19001) | 7,460 | 9 | 214,886 | D | 0 |
| Adams County (19003) | 3,622 | 4 | 100,126 | D | 0 |
| Allamakee County (19005) | 14,092 | 11 | 435,893 | D | 0 |
| Appanoose County (19007) | 12,184 | 10 | 165,008 | D | 4 |
| Audubon County (19009) | 5,599 | 7 | 146,958 | D | 0 |
| Benton County (19011) | 25,724 | 18 | 234,224 | D | 4 |
| Boone County (19015) | 26,668 | 13 | 318,667 | C | 9 |
| Bremer County (19017) | 25,204 | 20 | 195,986 | D | 7 |
| Buchanan County (19019) | 20,694 | 19 | 238,658 | D | 8 |
| Buena Vista County (19021) | 20,753 | 16 | 147,089 | D | 8 |
| Butler County (19023) | 14,268 | 14 | 162,680 | D | 0 |
| Calhoun County (19025) | 9,803 | 11 | 197,073 | D | 0 |
| Carroll County (19027) | 20,594 | 13 | 234,931 | D | 8 |
| Cass County (19029) | 13,096 | 10 | 146,734 | D | 6 |
| Cedar County (19031) | 18,349 | 20 | 213,789 | D | 0 |
| Cerro Gordo County (19033) | 42,632 | 41 | 216,925 | C | 35 |
| Cherokee County (19035) | 11,600 | 14 | 108,053 | D | 7 |
| Chickasaw County (19037) | 11,807 | 8 | 168,209 | D | 0 |
| Clarke County (19039) | 9,662 | 8 | 422,455 | C | 6 |
| Clay County (19041) | 16,461 | 14 | 214,540 | D | 7 |
| Clayton County (19043) | 17,013 | 19 | 568,040 | D | 0 |
| Clinton County (19045) | 46,268 | 48 | 692,896 | C | 36 |
| Crawford County (19047) | 16,277 | 17 | 165,276 | D | 7 |
| Davis County (19051) | 9,157 | 8 | 238,141 | D | 0 |
| Decatur County (19053) | 7,759 | 8 | 140,109 | D | 0 |
| Delaware County (19055) | 17,558 | 18 | 336,182 | D | 8 |
| Des Moines County (19057) | 38,487 | 50 | 240,409 | C | 41 |
| Dickinson County (19059) | 17,990 | 19 | 164,644 | D | 18 |
| Dubuque County (19061) | 99,030 | 83 | 965,079 | C | 62 |
| Emmet County (19063) | 9,262 | 11 | 144,861 | D | 8 |
| Fayette County (19065) | 19,288 | 22 | 250,208 | D | 6 |
| Floyd County (19067) | 15,328 | 17 | 170,982 | D | 9 |
| Franklin County (19069) | 9,956 | 11 | 148,469 | D | 0 |
| Fremont County (19071) | 6,514 | 8 | 166,393 | D | 1 |
| Greene County (19073) | 8,688 | 6 | 210,388 | D | 0 |
| Grundy County (19075) | 12,384 | 7 | 155,312 | D | 0 |
| Guthrie County (19077) | 10,688 | 8 | 375,979 | D | 0 |
| Hamilton County (19079) | 14,886 | 16 | 173,230 | D | 8 |
| Hancock County (19081) | 10,671 | 9 | 96,548 | D | 0 |
| Hardin County (19083) | 16,639 | 20 | 179,150 | D | 8 |
| Harrison County (19085) | 14,632 | 14 | 227,863 | D | 0 |
| Henry County (19087) | 20,004 | 22 | 144,642 | C | 10 |
| Howard County (19089) | 9,445 | 7 | 147,315 | D | 0 |
| Humboldt County (19091) | 9,591 | 11 | 136,177 | D | 5 |
| Ida County (19093) | 6,911 | 7 | 110,494 | D | 0 |
| Iowa County (19095) | 16,507 | 14 | 178,222 | D | 0 |
| Jackson County (19097) | 19,390 | 22 | 961,280 | D | 8 |
| Jasper County (19099) | 37,954 | 37 | 397,706 | D | 18 |
| Jefferson County (19101) | 15,705 | 13 | 177,279 | D | 8 |
| Jones County (19105) | 20,896 | 19 | 389,141 | D | 8 |
| Keokuk County (19107) | 9,924 | 13 | 217,113 | D | 0 |
| Kossuth County (19109) | 14,516 | 17 | 227,665 | D | 6 |
| Lee County (19111) | 32,893 | 41 | 424,681 | C | 27 |
| Louisa County (19115) | 10,678 | 15 | 263,862 | C | 0 |
| Lucas County (19117) | 8,716 | 10 | 259,988 | D | 0 |
| Lyon County (19119) | 12,162 | 13 | 136,899 | D | 0 |
| Madison County (19121) | 16,926 | 12 | 462,903 | D | 6 |
| Mahaska County (19123) | 22,021 | 21 | 310,314 | D | 15 |
| Marion County (19125) | 33,642 | 28 | 466,961 | D | 17 |
| Marshall County (19127) | 40,114 | 41 | 253,104 | C | 26 |
| Mills County (19129) | 14,568 | 13 | 165,203 | C | 7 |
| Mitchell County (19131) | 10,575 | 12 | 114,825 | D | 0 |
| Monona County (19133) | 8,557 | 12 | 174,660 | D | 0 |
| Monroe County (19135) | 7,513 | 8 | 354,148 | D | 0 |
| Montgomery County (19137) | 10,214 | 11 | 115,078 | D | 6 |
| Muscatine County (19139) | 42,559 | 35 | 341,098 | C | 24 |
| O'Brien County (19141) | 14,126 | 15 | 130,021 | D | 5 |
| Osceola County (19143) | 6,100 | 8 | 100,870 | D | 0 |
| Page County (19145) | 15,131 | 19 | 128,036 | D | 12 |
| Palo Alto County (19147) | 8,863 | 10 | 167,215 | D | 0 |
| Plymouth County (19149) | 25,747 | 22 | 193,766 | C | 9 |
| Pocahontas County (19151) | 7,046 | 8 | 127,562 | D | 0 |
| Pottawattamie County (19155) | 93,424 | 93 | 813,785 | C | 74 |
| Poweshiek County (19157) | 18,545 | 17 | 172,738 | D | 9 |
| Ringgold County (19159) | 4,645 | 6 | 130,715 | D | 0 |
| Sac County (19161) | 9,689 | 16 | 190,969 | D | 0 |
| Shelby County (19165) | 11,778 | 15 | 139,394 | D | 7 |
| Sioux County (19167) | 36,212 | 26 | 177,346 | D | 13 |
| Tama County (19171) | 16,868 | 20 | 231,973 | D | 6 |
| Taylor County (19173) | 5,868 | 8 | 139,626 | D | 0 |
| Union County (19175) | 11,993 | 15 | 143,349 | C | 11 |
| Van Buren County (19177) | 7,241 | 9 | 316,050 | D | 0 |
| Wapello County (19179) | 35,362 | 37 | 333,489 | C | 27 |
| Warren County (19181) | 54,409 | 33 | 537,064 | C | 20 |
| Washington County (19183) | 22,561 | 19 | 189,775 | D | 8 |
| Wayne County (19185) | 6,532 | 6 | 106,215 | D | 0 |
| Webster County (19187) | 36,886 | 39 | 283,195 | C | 27 |
| Winnebago County (19189) | 10,583 | 14 | 96,826 | D | 0 |
| Winneshiek County (19191) | 19,873 | 20 | 263,266 | C | 0 |
| Worth County (19195) | 7,350 | 9 | 111,291 | D | 0 |
| Wright County (19197) | 12,791 | 13 | 124,170 | D | 0 |
| **91 counties** | **1,700,351** | **1,650** | **22,372,507** | 19 C, 72 D | 740 |

- Iowa cut alone: 92 s, peak osmium memory 4.16 GB, 174 MB. Build: fetch 8-102 s, build 92-144 s per county, four at a
  time, 52 min from the first county to the last (the first county alone took 3 min 15 s including the national ACS
  files).
- Bus frequency: 76 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  15 have feeds. Rail distance: 81 counties have no station in or near them.
- Census spot check: 91 counties, 2,176 of 2,176 values equal (0% mismatch). Tract-median flags: 91 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; 504 on several tries first): Adair 1,383 = 1,383 roads, 0 = 0
  bus stops; Audubon 1,296 = 1,296 roads, 0 = 0 bus stops (0 missing, 0 extra).
- Crash counts: Iowa has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9191`): Marshall and Muscatine, 3 points each. None of the 91 counties has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood,
  canopy, canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each
  data file came from the r2.dev address (HEAD 200, GET 200); two optional files answered 404.
- R2: before 1,410,317,266 bytes (1,742 objects); dry run "92 files, net +0.022 GB, projected 1.433 GB"; after
  1,432,802,609 bytes (1,833 objects): 22,485,343 bytes added (the 91 data files, 22,372,507, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_ia_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_19001_2026-11-22.json`,
`..._19009_...`, `data/backtests/live_check_panels_2026-11-22_midwest_ia.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Nebraska (90 of 90 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (31001) | 31,052 | 28 | 129,117 | C | 26 |
| Antelope County (31003) | 6,305 | 8 | 130,108 | D | 0 |
| Arthur County (31005) | 484 | 1 | 39,033 | D | 0 |
| Banner County (31007) | 742 | 1 | 43,497 | C | 0 |
| Blaine County (31009) | 422 | 1 | 78,517 | D | 0 |
| Boone County (31011) | 5,356 | 7 | 128,831 | D | 0 |
| Box Butte County (31013) | 10,714 | 11 | 104,263 | D | 10 |
| Boyd County (31015) | 1,688 | 2 | 135,296 | D | 0 |
| Brown County (31017) | 2,869 | 2 | 106,313 | D | 0 |
| Buffalo County (31019) | 50,579 | 37 | 241,216 | D | 25 |
| Burt County (31021) | 6,740 | 6 | 133,462 | D | 0 |
| Butler County (31023) | 8,424 | 7 | 180,205 | D | 0 |
| Cass County (31025) | 27,161 | 22 | 295,600 | D | 8 |
| Cedar County (31027) | 8,315 | 9 | 195,866 | D | 0 |
| Chase County (31029) | 3,671 | 4 | 63,213 | D | 0 |
| Cherry County (31031) | 5,498 | 7 | 293,171 | D | 0 |
| Cheyenne County (31033) | 9,533 | 8 | 125,770 | C | 7 |
| Clay County (31035) | 6,095 | 7 | 107,458 | D | 0 |
| Colfax County (31037) | 10,641 | 10 | 118,376 | D | 5 |
| Cuming County (31039) | 8,975 | 8 | 131,022 | D | 0 |
| Custer County (31041) | 10,518 | 12 | 252,830 | D | 0 |
| Dakota County (31043) | 21,354 | 14 | 246,395 | C | 12 |
| Dawes County (31045) | 8,140 | 8 | 188,795 | D | 5 |
| Dawson County (31047) | 24,202 | 23 | 213,070 | D | 8 |
| Deuel County (31049) | 1,847 | 2 | 73,836 | C | 0 |
| Dixon County (31051) | 5,545 | 6 | 170,031 | D | 0 |
| Dodge County (31053) | 37,351 | 32 | 226,278 | D | 24 |
| Dundy County (31057) | 1,736 | 3 | 92,902 | D | 0 |
| Fillmore County (31059) | 5,541 | 5 | 108,886 | D | 0 |
| Franklin County (31061) | 2,846 | 4 | 71,302 | D | 0 |
| Frontier County (31063) | 2,569 | 3 | 114,484 | D | 0 |
| Furnas County (31065) | 4,568 | 6 | 145,490 | D | 0 |
| Gage County (31067) | 21,629 | 21 | 222,774 | D | 14 |
| Garden County (31069) | 1,761 | 2 | 134,964 | D | 0 |
| Garfield County (31071) | 1,718 | 2 | 71,477 | D | 0 |
| Gosper County (31073) | 2,040 | 2 | 83,027 | D | 0 |
| Grant County (31075) | 626 | 1 | 55,211 | D | 0 |
| Greeley County (31077) | 2,202 | 2 | 89,302 | D | 0 |
| Hall County (31079) | 62,536 | 47 | 219,267 | D | 44 |
| Hamilton County (31081) | 9,464 | 9 | 183,033 | D | 0 |
| Harlan County (31083) | 2,847 | 3 | 94,055 | D | 0 |
| Hayes County (31085) | 843 | 1 | 59,469 | D | 0 |
| Hitchcock County (31087) | 2,569 | 4 | 93,194 | D | 0 |
| Holt County (31089) | 10,102 | 12 | 307,091 | D | 0 |
| Hooker County (31091) | 647 | 1 | 70,992 | D | 0 |
| Howard County (31093) | 6,534 | 6 | 122,104 | D | 0 |
| Jefferson County (31095) | 7,161 | 6 | 108,790 | D | 3 |
| Johnson County (31097) | 5,261 | 4 | 92,852 | D | 0 |
| Kearney County (31099) | 6,713 | 5 | 116,631 | D | 0 |
| Keith County (31101) | 8,219 | 9 | 152,730 | D | 7 |
| Keya Paha County (31103) | 822 | 1 | 70,896 | D | 0 |
| Kimball County (31105) | 3,248 | 4 | 78,465 | C | 0 |
| Knox County (31107) | 8,363 | 6 | 234,125 | D | 0 |
| Lincoln County (31111) | 33,802 | 36 | 283,289 | D | 28 |
| Logan County (31113) | 773 | 1 | 42,810 | D | 0 |
| Loup County (31115) | 578 | 1 | 61,894 | D | 0 |
| McPherson County (31117) | 475 | 1 | 45,819 | D | 0 |
| Madison County (31119) | 35,532 | 30 | 171,263 | C | 22 |
| Merrick County (31121) | 7,724 | 8 | 249,551 | D | 0 |
| Morrill County (31123) | 4,534 | 4 | 179,820 | D | 0 |
| Nance County (31125) | 3,324 | 4 | 130,752 | D | 0 |
| Nemaha County (31127) | 7,046 | 7 | 127,171 | D | 0 |
| Nuckolls County (31129) | 4,087 | 5 | 97,788 | D | 0 |
| Otoe County (31131) | 16,241 | 12 | 180,824 | D | 6 |
| Pawnee County (31133) | 2,530 | 3 | 95,126 | D | 0 |
| Perkins County (31135) | 2,821 | 3 | 47,066 | D | 0 |
| Phelps County (31137) | 9,009 | 10 | 118,600 | C | 7 |
| Pierce County (31139) | 7,325 | 6 | 115,526 | D | 0 |
| Platte County (31141) | 34,716 | 28 | 230,642 | D | 22 |
| Polk County (31143) | 5,225 | 5 | 134,193 | D | 0 |
| Red Willow County (31145) | 10,557 | 12 | 134,393 | C | 9 |
| Richardson County (31147) | 7,751 | 8 | 147,398 | D | 4 |
| Rock County (31149) | 1,319 | 2 | 98,213 | D | 0 |
| Saline County (31151) | 14,650 | 10 | 141,482 | D | 4 |
| Saunders County (31155) | 23,048 | 16 | 336,733 | D | 4 |
| Scotts Bluff County (31157) | 35,843 | 36 | 255,536 | C | 26 |
| Seward County (31159) | 17,641 | 12 | 160,993 | D | 5 |
| Sheridan County (31161) | 5,014 | 5 | 160,284 | D | 0 |
| Sherman County (31163) | 2,967 | 3 | 107,677 | D | 0 |
| Sioux County (31165) | 1,171 | 2 | 216,079 | D | 0 |
| Stanton County (31167) | 5,796 | 6 | 114,468 | C | 2 |
| Thayer County (31169) | 4,901 | 4 | 102,877 | D | 0 |
| Thomas County (31171) | 564 | 1 | 82,173 | D | 0 |
| Thurston County (31173) | 6,627 | 6 | 156,114 | D | 0 |
| Valley County (31175) | 4,066 | 5 | 85,057 | D | 0 |
| Washington County (31177) | 21,106 | 17 | 202,556 | D | 9 |
| Wayne County (31179) | 9,844 | 10 | 113,835 | D | 6 |
| Webster County (31181) | 3,360 | 4 | 68,900 | D | 0 |
| Wheeler County (31183) | 847 | 1 | 61,425 | D | 0 |
| York County (31185) | 14,286 | 11 | 128,888 | D | 8 |
| **90 counties** | **863,886** | **787** | **12,532,297** | 11 C, 79 D | 360 |

- Nebraska cut alone: 88 s, peak osmium memory 4.08 GB, 117 MB. Build: fetch 7-30 s, build 68-130 s per county, four at a
  time, 37 min from the first county to the last (Kansas's cut ran alongside).
- Bus frequency: 82 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  8 have feeds. Rail distance: 87 counties have no station in or near them.
- Census spot check: 90 counties, 1,608 of 1,608 values equal (0% mismatch). Tract-median flags: 90 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Adams 1,580 = 1,580 roads, 0 = 0 bus stops; Arthur 131 = 131 roads, 0 = 0 bus stops (0 missing, 0 extra; the mirror answered 504 on bus stops several times first). The extract's snapshot is 2026-11-21T01:07:35Z (the
  result files' `extract_snapshot` is empty because the build folder's state file was not copied next to them).
- Crash counts: Nebraska has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9191`): Hall and Madison, 3 points each, all six with the house panel on live parcel
  records (Nebraska's statewide parcel service): all checks pass at all 6 points (neighborhood, canopy, canopy goal,
  crash text, state laws, Census area, HUD rent, FEMA, USGS, console): 54 pass, 0 fail. Each data file
  came from the r2.dev address (GET 200). Failed loads on the page: optional files (404), overpass-api.de blocked by
  CORS from this machine, 403s, as in earlier batches.
- R2: before 1,432,802,609 bytes (1,833 objects); dry run "91 files, net +0.013 GB, projected 1.445 GB"; after
  1,445,357,457 bytes (1,923 objects): 12,554,848 bytes added (the 90 data files, 12,532,297, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_ne_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_31001_2026-11-22.json`,
`..._31005_...`, `data/backtests/live_check_panels_2026-11-22_midwest_ne.json`.

## Kansas (100 of 100 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Allen County (20001) | 12,483 | 13 | 187,412 | D | 7 |
| Anderson County (20003) | 7,834 | 7 | 140,616 | D | 0 |
| Atchison County (20005) | 16,208 | 16 | 169,505 | D | 11 |
| Barber County (20007) | 4,069 | 5 | 129,518 | D | 0 |
| Barton County (20009) | 25,097 | 22 | 134,270 | D | 14 |
| Bourbon County (20011) | 14,394 | 14 | 139,292 | D | 9 |
| Brown County (20013) | 9,343 | 10 | 111,154 | D | 0 |
| Butler County (20015) | 68,287 | 53 | 311,746 | D | 32 |
| Chase County (20017) | 2,561 | 3 | 106,937 | D | 0 |
| Chautauqua County (20019) | 3,370 | 3 | 85,704 | D | 0 |
| Cherokee County (20021) | 19,151 | 21 | 148,816 | D | 0 |
| Cheyenne County (20023) | 2,628 | 3 | 130,789 | D | 0 |
| Clark County (20025) | 1,974 | 2 | 87,384 | D | 0 |
| Clay County (20027) | 8,048 | 8 | 145,288 | D | 4 |
| Cloud County (20029) | 8,898 | 10 | 139,673 | D | 6 |
| Coffey County (20031) | 8,308 | 8 | 152,892 | D | 0 |
| Comanche County (20033) | 1,729 | 2 | 93,449 | D | 0 |
| Cowley County (20035) | 34,411 | 30 | 221,154 | D | 25 |
| Crawford County (20037) | 39,008 | 34 | 136,383 | D | 23 |
| Decatur County (20039) | 2,726 | 3 | 112,278 | D | 0 |
| Dickinson County (20041) | 18,445 | 16 | 255,564 | C | 7 |
| Doniphan County (20043) | 7,503 | 10 | 225,630 | D | 4 |
| Edwards County (20047) | 2,779 | 4 | 83,008 | D | 0 |
| Elk County (20049) | 2,453 | 4 | 111,147 | D | 0 |
| Ellis County (20051) | 28,920 | 26 | 196,690 | D | 21 |
| Ellsworth County (20053) | 6,360 | 6 | 120,161 | D | 0 |
| Finney County (20055) | 38,084 | 29 | 154,680 | C | 26 |
| Ford County (20057) | 34,074 | 27 | 159,782 | C | 23 |
| Franklin County (20059) | 26,106 | 22 | 192,203 | D | 12 |
| Geary County (20061) | 35,815 | 31 | 389,762 | C | 30 |
| Gove County (20063) | 2,799 | 3 | 129,183 | D | 0 |
| Graham County (20065) | 2,389 | 3 | 63,501 | D | 0 |
| Grant County (20067) | 7,229 | 6 | 71,435 | D | 6 |
| Gray County (20069) | 5,701 | 6 | 86,001 | D | 0 |
| Greeley County (20071) | 1,304 | 2 | 35,089 | D | 0 |
| Greenwood County (20073) | 5,919 | 6 | 137,016 | D | 0 |
| Hamilton County (20075) | 2,471 | 2 | 44,599 | D | 0 |
| Harper County (20077) | 5,400 | 6 | 77,619 | D | 0 |
| Harvey County (20079) | 33,756 | 28 | 163,709 | C | 20 |
| Haskell County (20081) | 3,641 | 4 | 49,188 | D | 0 |
| Hodgeman County (20083) | 1,652 | 2 | 101,159 | D | 0 |
| Jackson County (20085) | 13,341 | 11 | 189,798 | D | 0 |
| Jefferson County (20087) | 18,349 | 13 | 249,586 | C | 1 |
| Jewell County (20089) | 2,916 | 3 | 166,186 | D | 0 |
| Kearny County (20093) | 3,864 | 3 | 95,022 | D | 0 |
| Kingman County (20095) | 7,186 | 7 | 116,387 | D | 0 |
| Kiowa County (20097) | 2,422 | 3 | 86,538 | D | 0 |
| Labette County (20099) | 19,869 | 18 | 142,178 | D | 10 |
| Lane County (20101) | 1,461 | 2 | 47,320 | D | 0 |
| Leavenworth County (20103) | 83,123 | 62 | 694,273 | C | 48 |
| Lincoln County (20105) | 2,923 | 4 | 105,622 | D | 0 |
| Linn County (20107) | 9,767 | 10 | 160,292 | D | 0 |
| Logan County (20109) | 2,707 | 3 | 93,521 | D | 0 |
| Lyon County (20111) | 32,186 | 31 | 269,167 | D | 28 |
| McPherson County (20113) | 30,205 | 23 | 171,125 | D | 11 |
| Marion County (20115) | 11,754 | 13 | 192,550 | D | 0 |
| Marshall County (20117) | 9,993 | 9 | 204,959 | D | 0 |
| Meade County (20119) | 3,903 | 4 | 70,155 | D | 0 |
| Miami County (20121) | 34,938 | 33 | 247,723 | D | 11 |
| Mitchell County (20123) | 5,779 | 6 | 115,325 | D | 0 |
| Montgomery County (20125) | 30,940 | 31 | 183,607 | D | 21 |
| Morris County (20127) | 5,340 | 6 | 163,015 | D | 0 |
| Morton County (20129) | 2,611 | 3 | 41,769 | D | 0 |
| Nemaha County (20131) | 10,160 | 9 | 138,395 | D | 0 |
| Neosho County (20133) | 15,656 | 17 | 125,028 | D | 10 |
| Ness County (20135) | 2,653 | 4 | 88,485 | D | 0 |
| Norton County (20137) | 5,359 | 5 | 149,474 | D | 0 |
| Osage County (20139) | 15,744 | 15 | 175,974 | D | 0 |
| Osborne County (20141) | 3,452 | 4 | 147,425 | D | 0 |
| Ottawa County (20143) | 5,819 | 6 | 121,103 | D | 0 |
| Pawnee County (20145) | 6,144 | 7 | 95,944 | D | 4 |
| Phillips County (20147) | 4,813 | 7 | 163,345 | D | 0 |
| Pottawatomie County (20149) | 26,204 | 17 | 453,598 | C | 6 |
| Pratt County (20151) | 9,127 | 8 | 76,026 | D | 6 |
| Rawlins County (20153) | 2,516 | 2 | 103,090 | D | 0 |
| Reno County (20155) | 61,553 | 57 | 258,909 | C | 43 |
| Republic County (20157) | 4,646 | 7 | 108,216 | D | 0 |
| Rice County (20159) | 9,350 | 9 | 136,348 | D | 0 |
| Riley County (20161) | 71,946 | 59 | 536,940 | C | 53 |
| Rooks County (20163) | 4,813 | 5 | 127,649 | D | 0 |
| Rush County (20165) | 2,947 | 3 | 87,066 | D | 0 |
| Russell County (20167) | 6,679 | 9 | 156,103 | D | 6 |
| Saline County (20169) | 53,668 | 44 | 194,968 | D | 39 |
| Scott County (20171) | 5,027 | 5 | 59,294 | D | 0 |
| Seward County (20175) | 21,486 | 17 | 86,367 | D | 16 |
| Sheridan County (20179) | 2,426 | 2 | 63,722 | D | 0 |
| Sherman County (20181) | 5,858 | 6 | 120,618 | D | 6 |
| Smith County (20183) | 3,552 | 4 | 124,820 | D | 0 |
| Stafford County (20185) | 3,978 | 4 | 102,608 | D | 0 |
| Stanton County (20187) | 2,038 | 2 | 36,459 | D | 0 |
| Stevens County (20189) | 5,162 | 5 | 50,060 | D | 0 |
| Sumner County (20191) | 22,353 | 24 | 221,315 | D | 10 |
| Thomas County (20193) | 7,885 | 7 | 88,511 | D | 5 |
| Trego County (20195) | 2,777 | 3 | 102,538 | D | 0 |
| Wabaunsee County (20197) | 7,009 | 8 | 263,722 | D | 0 |
| Wallace County (20199) | 1,417 | 2 | 71,395 | D | 0 |
| Washington County (20201) | 5,533 | 7 | 151,861 | D | 0 |
| Wichita County (20203) | 2,091 | 3 | 45,253 | D | 0 |
| Wilson County (20205) | 8,505 | 9 | 121,297 | D | 0 |
| Woodson County (20207) | 3,109 | 4 | 85,179 | D | 0 |
| **100 counties** | **1,332,359** | **1,214** | **14,776,609** | 10 C, 90 D | 614 |

- Kansas cut alone: 145 s, peak osmium memory 4.21 GB, 146 MB. Build: fetch 7-25 s, build 85-137 s per county, four at a
  time (the Nebraska checks and the Minnesota cut ran alongside), 100 counties built in about 46 min of build time.
  Finished counties were exported while the rest were still building, to stay under the disk limit (each finished
  build folder holds about 19 MB of its own files).
- Bus frequency: 93 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  7 have feeds. Rail distance: 96 counties have no station in or near them.
- Census spot check: 100 counties, 1,972 of 1,972 values equal (0% mismatch). Tract-median flags: 100 counties added,
  no existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Allen 1,960 = 1,960 roads, 0 = 0 bus stops; Anderson 1,780 = 1,780 roads, 0 = 0 bus stops (0 missing, 0 extra). The mirror answered 504 on all 8 tries for Anderson's roads the first time, so that result was replaced by a second run that answered.
- Crash counts: Kansas has no state crash source connected (`national/STATE_CRASH_SOURCES.md` lists KDOT's fatal and
  suspected-serious crashes only; none is wired into the pipeline).
- Live check from R2 (`LIVE_PORT=9191`): Riley and Saline, 3 points each. None of the 100 counties has a parcel service
  on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood, canopy,
  canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each data
  file came from the r2.dev address (GET 200).
- R2: before 1,445,357,457 bytes (1,923 objects); dry run "101 files, net +0.015 GB, projected 1.460 GB"; after
  1,460,159,149 bytes (2,023 objects): 14,801,692 bytes added (the 100 data files, 14,776,609, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_ks_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_20001_2026-11-22.json`,
`..._20003_...`, `data/backtests/live_check_panels_2026-11-22_midwest_ks.json`.

## Minnesota (75 of 75 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Aitkin County (27001) | 16,056 | 19 | 433,945 | D | 0 |
| Becker County (27005) | 35,343 | 31 | 464,814 | C | 13 |
| Beltrami County (27007) | 46,512 | 37 | 782,719 | D | 19 |
| Benton County (27009) | 41,593 | 29 | 308,166 | C | 18 |
| Big Stone County (27011) | 5,127 | 6 | 349,010 | D | 0 |
| Blue Earth County (27013) | 69,871 | 50 | 436,741 | C | 35 |
| Brown County (27015) | 25,800 | 26 | 299,672 | D | 13 |
| Carlton County (27017) | 36,518 | 29 | 397,528 | D | 16 |
| Cass County (27021) | 30,992 | 29 | 1,031,309 | C | 0 |
| Chippewa County (27023) | 12,377 | 12 | 286,701 | D | 6 |
| Chisago County (27025) | 57,991 | 38 | 449,868 | D | 22 |
| Clay County (27027) | 66,059 | 43 | 501,123 | C | 36 |
| Clearwater County (27029) | 8,616 | 10 | 290,006 | D | 0 |
| Cook County (27031) | 5,635 | 7 | 601,438 | D | 0 |
| Cottonwood County (27033) | 11,458 | 13 | 306,144 | D | 0 |
| Crow Wing County (27035) | 67,686 | 59 | 535,208 | D | 22 |
| Dodge County (27039) | 21,045 | 16 | 226,266 | D | 5 |
| Douglas County (27041) | 39,575 | 31 | 297,153 | D | 19 |
| Faribault County (27043) | 13,914 | 18 | 187,014 | D | 0 |
| Fillmore County (27045) | 21,414 | 23 | 549,608 | D | 0 |
| Freeborn County (27047) | 30,623 | 31 | 196,164 | C | 20 |
| Goodhue County (27049) | 47,943 | 36 | 1,211,230 | C | 16 |
| Grant County (27051) | 6,127 | 5 | 160,053 | D | 0 |
| Houston County (27055) | 18,653 | 13 | 665,432 | C | 3 |
| Hubbard County (27057) | 21,831 | 18 | 300,220 | D | 0 |
| Isanti County (27059) | 42,596 | 24 | 252,961 | D | 9 |
| Itasca County (27061) | 45,275 | 45 | 1,007,167 | D | 12 |
| Jackson County (27063) | 9,933 | 12 | 216,175 | C | 0 |
| Kanabec County (27065) | 16,390 | 15 | 218,199 | D | 0 |
| Kandiyohi County (27067) | 44,079 | 34 | 246,226 | C | 23 |
| Kittson County (27069) | 4,084 | 5 | 212,346 | D | 0 |
| Koochiching County (27071) | 11,833 | 14 | 719,902 | D | 10 |
| Lac qui Parle County (27073) | 6,682 | 7 | 390,661 | D | 0 |
| Lake County (27075) | 10,879 | 13 | 1,007,693 | D | 0 |
| Lake of the Woods County (27077) | 3,821 | 5 | 309,249 | D | 0 |
| Le Sueur County (27079) | 29,113 | 23 | 315,615 | C | 3 |
| Lincoln County (27081) | 5,603 | 5 | 256,853 | D | 0 |
| Lyon County (27083) | 25,503 | 24 | 343,610 | C | 12 |
| McLeod County (27085) | 36,798 | 29 | 189,907 | D | 20 |
| Mahnomen County (27087) | 5,358 | 5 | 208,029 | D | 0 |
| Marshall County (27089) | 8,909 | 12 | 289,855 | D | 0 |
| Martin County (27091) | 19,780 | 21 | 200,360 | D | 11 |
| Meeker County (27093) | 23,468 | 22 | 253,905 | C | 9 |
| Mille Lacs County (27095) | 27,125 | 20 | 261,596 | D | 3 |
| Morrison County (27097) | 34,249 | 30 | 545,851 | D | 10 |
| Mower County (27099) | 40,343 | 34 | 300,434 | C | 24 |
| Murray County (27101) | 8,097 | 9 | 236,563 | D | 0 |
| Nicollet County (27103) | 34,411 | 22 | 419,423 | C | 17 |
| Nobles County (27105) | 22,041 | 22 | 223,653 | D | 13 |
| Norman County (27107) | 6,367 | 8 | 190,446 | D | 0 |
| Otter Tail County (27111) | 60,475 | 57 | 618,297 | C | 15 |
| Pennington County (27113) | 13,791 | 14 | 125,092 | D | 11 |
| Pine County (27115) | 29,640 | 23 | 648,017 | D | 0 |
| Pipestone County (27117) | 9,284 | 11 | 154,240 | D | 0 |
| Polk County (27119) | 30,705 | 32 | 736,205 | C | 16 |
| Pope County (27121) | 11,418 | 12 | 222,366 | D | 6 |
| Red Lake County (27125) | 3,915 | 5 | 144,501 | D | 0 |
| Redwood County (27127) | 15,350 | 16 | 298,994 | C | 6 |
| Renville County (27129) | 14,558 | 17 | 252,093 | C | 0 |
| Rice County (27131) | 67,917 | 49 | 401,976 | C | 36 |
| Rock County (27133) | 9,621 | 9 | 153,083 | D | 5 |
| Roseau County (27135) | 15,302 | 14 | 286,995 | D | 0 |
| Sibley County (27143) | 15,005 | 16 | 216,712 | D | 0 |
| Steele County (27147) | 37,439 | 28 | 185,197 | C | 22 |
| Stevens County (27149) | 9,739 | 11 | 196,407 | D | 6 |
| Swift County (27151) | 9,748 | 12 | 239,417 | D | 0 |
| Todd County (27153) | 25,575 | 25 | 363,776 | C | 1 |
| Traverse County (27155) | 3,243 | 5 | 184,773 | D | 0 |
| Wabasha County (27157) | 21,565 | 19 | 855,261 | D | 5 |
| Wadena County (27159) | 14,256 | 15 | 205,547 | C | 6 |
| Waseca County (27161) | 18,885 | 15 | 168,001 | C | 7 |
| Watonwan County (27165) | 11,205 | 12 | 172,802 | D | 0 |
| Wilkin County (27167) | 6,371 | 8 | 277,062 | D | 5 |
| Winona County (27169) | 49,779 | 41 | 983,547 | C | 32 |
| Yellow Medicine County (27173) | 9,451 | 14 | 555,805 | D | 0 |
| **75 counties** | **1,795,733** | **1,569** | **28,730,377** | 25 C, 50 D | 618 |

- Minnesota cut alone: 115 s, peak osmium memory 4.15 GB, 339 MB (cut while Kansas was building). Build: fetch 9-86 s,
  build 170-245 s per county, four at a time (the Kansas post-processing and checks ran alongside, so these are slower
  than Kansas's), about 65 min from the first county to the last.
- Bus frequency: 57 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  18 have feeds. Rail distance: 62 counties have no station in or near them.
- Census spot check: 75 counties, 1,772 of 1,772 values equal (0% mismatch). Tract-median flags: 75 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Aitkin 2,072 = 2,072 roads, 0 = 0 bus stops; Becker 2,817 =
  2,817 roads, 0 = 0 bus stops (0 missing, 0 extra).
- Crash counts: Minnesota has no state crash source connected (`national/STATE_CRASH_SOURCES.md` notes a DPS layer with
  2025 onwards only; none is wired into the pipeline).
- Live check from R2 (`LIVE_PORT=9191`): Crow Wing and Blue Earth, 3 points each. Crow Wing's 3 points had the house
  panel on live parcel records (Minnesota's statewide parcel service) and pass every check; Blue Earth's 3 points had no
  parcel at the point, so their house-panel rows are not checkable and the rest pass: 42 pass, 0 fail, 12 not
  checkable. Each data file came from the r2.dev address (GET 200).
- Tests: `tests/unit/transitCorridors.test.ts` checks each corridor stop's `county_on_page` flag against the manifest. It
  was not run after Kansas; after Minnesota it failed on four stops whose counties are now on the page, and
  `app/data/intercity_transit_corridors.json` was updated: Cambridge MN (Isanti, 27059) and Hinckley MN (Pine, 27115),
  Newton KS (Harvey, 20079) and Arkansas City KS (Cowley, 20035) now say `county_on_page: true`. Nothing else in the
  file changed (4 lines).
- R2: before 1,460,159,149 bytes (2,023 objects); dry run "76 files, net +0.029 GB, projected 1.489 GB"; after
  1,488,908,420 bytes (2,098 objects): 28,749,271 bytes added (the 75 data files, 28,730,377, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_mn_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_27001_2026-11-22.json`,
`..._27005_...`, `data/backtests/live_check_panels_2026-11-22_midwest_mn.json`.

## South Dakota (64 of 64 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Aurora County (46003) | 2,642 | 3 | 72,009 | D | 0 |
| Beadle County (46005) | 19,309 | 17 | 182,665 | D | 13 |
| Bennett County (46007) | 3,345 | 4 | 143,754 | D | 0 |
| Bon Homme County (46009) | 7,044 | 5 | 162,943 | D | 0 |
| Brookings County (46011) | 35,353 | 26 | 168,358 | D | 0 |
| Brown County (46013) | 37,877 | 31 | 234,172 | D | 23 |
| Brule County (46015) | 5,283 | 6 | 90,596 | D | 0 |
| Buffalo County (46017) | 1,808 | 2 | 73,442 | D | 0 |
| Butte County (46019) | 10,676 | 8 | 284,200 | D | 6 |
| Campbell County (46021) | 1,593 | 2 | 93,932 | D | 0 |
| Charles Mix County (46023) | 9,281 | 8 | 307,503 | D | 0 |
| Clark County (46025) | 3,917 | 5 | 73,250 | D | 0 |
| Clay County (46027) | 15,219 | 12 | 134,555 | D | 8 |
| Codington County (46029) | 28,767 | 22 | 164,789 | D | 19 |
| Corson County (46031) | 3,806 | 4 | 306,088 | D | 0 |
| Custer County (46033) | 8,892 | 7 | 324,162 | D | 0 |
| Davison County (46035) | 19,952 | 19 | 114,013 | D | 16 |
| Day County (46037) | 5,437 | 6 | 108,974 | D | 0 |
| Deuel County (46039) | 4,328 | 4 | 282,208 | D | 0 |
| Dewey County (46041) | 5,205 | 4 | 226,027 | D | 0 |
| Douglas County (46043) | 2,828 | 3 | 60,797 | D | 0 |
| Edmunds County (46045) | 4,048 | 4 | 69,187 | D | 0 |
| Fall River County (46047) | 7,258 | 6 | 234,724 | D | 0 |
| Faulk County (46049) | 2,126 | 3 | 63,205 | D | 0 |
| Grant County (46051) | 7,563 | 9 | 464,202 | D | 0 |
| Gregory County (46053) | 4,016 | 4 | 200,536 | D | 0 |
| Haakon County (46055) | 1,722 | 2 | 140,292 | D | 0 |
| Hamlin County (46057) | 6,373 | 5 | 65,988 | D | 0 |
| Hand County (46059) | 3,140 | 4 | 86,955 | D | 0 |
| Hanson County (46061) | 3,472 | 3 | 73,689 | D | 0 |
| Harding County (46063) | 1,148 | 1 | 219,811 | D | 0 |
| Hughes County (46065) | 17,664 | 14 | 188,413 | D | 13 |
| Hutchinson County (46067) | 7,404 | 7 | 119,384 | D | 0 |
| Hyde County (46069) | 1,191 | 2 | 43,014 | D | 0 |
| Jackson County (46071) | 2,802 | 4 | 265,274 | D | 0 |
| Jerauld County (46073) | 1,772 | 2 | 43,770 | D | 0 |
| Jones County (46075) | 1,004 | 1 | 134,170 | D | 0 |
| Kingsbury County (46077) | 5,244 | 6 | 83,849 | D | 0 |
| Lake County (46079) | 10,972 | 9 | 83,133 | D | 4 |
| Lawrence County (46081) | 27,233 | 16 | 351,481 | D | 15 |
| Lincoln County (46083) | 70,638 | 41 | 279,981 | D | 30 |
| Lyman County (46085) | 3,724 | 4 | 258,600 | D | 0 |
| McCook County (46087) | 5,751 | 6 | 77,567 | D | 0 |
| McPherson County (46089) | 2,145 | 3 | 81,919 | D | 0 |
| Marshall County (46091) | 4,344 | 3 | 218,321 | D | 0 |
| Meade County (46093) | 30,546 | 19 | 389,238 | D | 16 |
| Mellette County (46095) | 1,943 | 2 | 156,527 | D | 0 |
| Miner County (46097) | 2,300 | 3 | 68,868 | D | 0 |
| Moody County (46101) | 6,397 | 6 | 93,437 | D | 0 |
| Oglala Lakota County (46102) | 13,491 | 5 | 266,295 | D | 0 |
| Perkins County (46105) | 3,001 | 3 | 226,374 | D | 0 |
| Potter County (46107) | 2,388 | 2 | 58,853 | D | 0 |
| Roberts County (46109) | 10,221 | 12 | 531,564 | D | 0 |
| Sanborn County (46111) | 2,384 | 3 | 75,022 | D | 0 |
| Spink County (46115) | 6,219 | 7 | 147,612 | D | 0 |
| Stanley County (46117) | 3,015 | 3 | 231,796 | D | 3 |
| Sully County (46119) | 1,526 | 2 | 78,755 | D | 0 |
| Todd County (46121) | 9,244 | 7 | 122,671 | D | 0 |
| Tripp County (46123) | 5,611 | 5 | 126,997 | D | 0 |
| Turner County (46125) | 8,882 | 8 | 116,109 | D | 0 |
| Union County (46127) | 17,081 | 11 | 206,410 | C | 4 |
| Walworth County (46129) | 5,271 | 6 | 96,490 | D | 0 |
| Yankton County (46135) | 23,414 | 19 | 156,170 | D | 14 |
| Ziebach County (46137) | 2,377 | 2 | 155,799 | D | 0 |
| **64 counties** | **590,627** | **482** | **10,760,889** | 1 C, 63 D | 184 |

- South Dakota cut alone: 60 MB (cut while Minnesota was building). Build: fetch 8-31 s, build 42-87 s per county,
  four at a time, 17.5 min from the first county to the last (the smallest state file, so the fastest builds).
- Bus frequency: 63 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  1 has feeds. Rail distance: all 64 counties have no station in or near them.
- Census spot check: 64 counties, 1,140 of 1,140 values equal (0% mismatch). Tract-median flags: 64 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Aurora 723 = 723 roads, 0 = 0 bus stops; Beadle 2,221 = 2,221
  roads, 0 = 0 bus stops (0 missing, 0 extra).
- Crash counts: South Dakota has no state crash source connected (`national/STATE_CRASH_SOURCES.md` notes a rolling
  five-year layer with no counts; none is wired into the pipeline).
- Live check from R2 (`LIVE_PORT=9191`): Lincoln and Brown, 3 points each. Lincoln's page has the Sioux Falls parcel
  service: 2 of its 3 points had the house panel on live parcel records and pass every check, the third had no parcel at
  the point; Brown has no parcel service. House-panel rows that do not apply are not checkable and the rest pass:
  38 pass, 0 fail, 16 not checkable. Each data file came from the r2.dev address (GET 200).
- R2: before 1,488,908,420 bytes (2,098 objects); dry run "65 files, net +0.011 GB, projected 1.500 GB"; after
  1,499,685,353 bytes (2,162 objects): 10,776,933 bytes added (the 64 data files, 10,760,889, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_sd_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_46003_2026-11-22.json`,
`..._46005_...`, `data/backtests/live_check_panels_2026-11-22_midwest_sd.json`.

## North Dakota (51 of 51 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (38001) | 2,145 | 2 | 87,617 | D | 0 |
| Barnes County (38003) | 10,773 | 13 | 356,690 | D | 9 |
| Benson County (38005) | 5,808 | 7 | 298,108 | C | 0 |
| Billings County (38007) | 1,024 | 1 | 219,516 | D | 0 |
| Bottineau County (38009) | 6,378 | 7 | 159,598 | D | 0 |
| Bowman County (38011) | 2,906 | 4 | 116,222 | D | 0 |
| Burke County (38013) | 2,156 | 2 | 88,288 | D | 0 |
| Cavalier County (38019) | 3,633 | 5 | 360,729 | D | 0 |
| Dickey County (38021) | 4,935 | 7 | 110,100 | D | 0 |
| Divide County (38023) | 2,167 | 2 | 71,911 | D | 0 |
| Dunn County (38025) | 4,040 | 3 | 802,270 | D | 0 |
| Eddy County (38027) | 2,307 | 3 | 105,080 | D | 0 |
| Emmons County (38029) | 3,254 | 4 | 145,166 | D | 0 |
| Foster County (38031) | 3,358 | 3 | 73,560 | D | 0 |
| Golden Valley County (38033) | 1,653 | 2 | 111,447 | D | 0 |
| Grand Forks County (38035) | 72,923 | 60 | 613,304 | C | 49 |
| Grant County (38037) | 2,269 | 2 | 187,352 | D | 0 |
| Griggs County (38039) | 2,245 | 2 | 189,979 | D | 0 |
| Hettinger County (38041) | 2,432 | 3 | 92,544 | D | 0 |
| Kidder County (38043) | 2,377 | 3 | 74,015 | D | 0 |
| LaMoure County (38045) | 4,118 | 4 | 103,330 | D | 0 |
| Logan County (38047) | 1,819 | 2 | 50,553 | D | 0 |
| McHenry County (38049) | 5,207 | 4 | 177,315 | D | 0 |
| McIntosh County (38051) | 2,497 | 3 | 51,393 | D | 0 |
| McKenzie County (38053) | 14,321 | 12 | 473,576 | C | 6 |
| McLean County (38055) | 9,823 | 8 | 736,009 | D | 0 |
| Mercer County (38057) | 8,337 | 8 | 742,225 | D | 0 |
| Morton County (38059) | 33,777 | 20 | 585,195 | C | 13 |
| Mountrail County (38061) | 9,507 | 6 | 246,442 | C | 0 |
| Nelson County (38063) | 3,016 | 4 | 177,001 | D | 0 |
| Oliver County (38065) | 1,839 | 2 | 256,406 | D | 0 |
| Pembina County (38067) | 6,727 | 9 | 325,666 | D | 0 |
| Pierce County (38069) | 3,928 | 5 | 179,994 | C | 0 |
| Ramsey County (38071) | 11,556 | 12 | 268,617 | C | 9 |
| Ransom County (38073) | 5,643 | 6 | 180,249 | D | 0 |
| Renville County (38075) | 2,304 | 3 | 123,853 | D | 0 |
| Richland County (38077) | 16,584 | 14 | 369,482 | D | 7 |
| Rolette County (38079) | 11,924 | 11 | 155,903 | D | 0 |
| Sargent County (38081) | 3,804 | 6 | 188,105 | D | 0 |
| Sheridan County (38083) | 1,303 | 1 | 102,990 | D | 0 |
| Sioux County (38085) | 3,740 | 4 | 212,664 | D | 0 |
| Slope County (38087) | 766 | 1 | 76,931 | D | 0 |
| Stark County (38089) | 33,302 | 28 | 343,342 | D | 23 |
| Steele County (38091) | 1,804 | 2 | 283,725 | D | 0 |
| Stutsman County (38093) | 21,549 | 21 | 227,665 | D | 15 |
| Towner County (38095) | 2,079 | 3 | 273,516 | D | 0 |
| Traill County (38097) | 7,970 | 10 | 254,932 | D | 0 |
| Walsh County (38099) | 10,396 | 13 | 416,279 | C | 0 |
| Ward County (38101) | 68,973 | 54 | 413,542 | C | 40 |
| Wells County (38103) | 3,890 | 5 | 116,983 | D | 0 |
| Williams County (38105) | 39,555 | 21 | 261,583 | C | 18 |
| **51 counties** | **490,841** | **437** | **12,638,962** | 10 C, 41 D | 189 |

- North Dakota cut alone: 138 MB (cut while South Dakota was building). Build: fetch 8-42 s, build 62-126 s per county,
  four at a time, 19.8 min from the first county to the last.
- Bus frequency: 49 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  2 have feeds. Rail distance: 42 counties have no station in or near them.
- Census spot check: 51 counties, 864 of 864 values equal (0% mismatch). Tract-median flags: 51 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Barnes 1,557 = 1,557 roads, 0 = 0 bus stops. **Adams 699
  roads on Overpass, 698 in the extract (1 not in the extract)**, 0 = 0 bus stops. The one road is way 9776296 (77th Avenue
  Southwest, `highway=unclassified`, last edited 2 Nov 2022). It is in `us-midwest-latest.osm.pbf` and in the North
  Dakota cut; its nodes run from x -101.97793 to -101.977686, and the county box's east edge is x -101.9779300002878, so
  it sits on the box's edge (the 0.02 degree margin beyond the county's block groups) and the clip drops it by a rounding
  difference of the edge, not by a data gap. 1 of 699 roads (0.14%) in that box; 0 of 1,557 in Barnes.
- Crash counts: North Dakota has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9191`): Grand Forks and Ward, 3 points each (North Dakota's statewide parcel service
  is on the page): 5 of the 6 points had the house panel on live parcel records and pass the Census area, HUD rent, FEMA and
  neighborhood, canopy, crash text and state-law checks; 1 had no parcel at the point. **4 USGS elevation rows showed
  "Not available (the service did not answer in time)", the page's own 6 s limit, while USGS's service gave 989, 832,
  1,628 and 1,669 ft to the checker.** Re-opened alone, 2 of the 4 showed 989 and 1,628 ft as USGS does; the other 2 (Grand
  Forks 380350102001, Ward 381010108003) again showed "did not answer in time" on two re-checks. The page showed no wrong
  elevation; it said it had none. Counted in the result file as 47 pass, 6 fail (the 4 first-run rows are kept as
  `usgs_first`; 2 rows still fail), 5 not checkable. Each data file came from the r2.dev address (GET 200).
- R2: before 1,499,685,353 bytes (2,162 objects); dry run "52 files, net +0.013 GB, projected 1.512 GB"; after
  1,512,337,107 bytes (2,213 objects): 12,651,754 bytes added (the 51 data files, 12,638,962, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_nd_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_38001_2026-11-22.json`,
`..._38003_...`, `data/backtests/live_check_panels_2026-11-22_midwest_nd.json`.

## Wisconsin (56 of 56 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (55001) | 21,123 | 23 | 282,940 | C | 0 |
| Ashland County (55003) | 16,080 | 18 | 1,072,901 | D | 8 |
| Barron County (55005) | 46,797 | 43 | 398,529 | D | 11 |
| Bayfield County (55007) | 16,575 | 15 | 822,942 | D | 0 |
| Buffalo County (55011) | 13,393 | 13 | 1,025,036 | C | 0 |
| Burnett County (55013) | 16,916 | 15 | 665,764 | D | 0 |
| Calumet County (55015) | 52,942 | 36 | 268,377 | C | 15 |
| Chippewa County (55017) | 66,799 | 47 | 662,902 | C | 20 |
| Clark County (55019) | 34,739 | 30 | 722,195 | D | 0 |
| Columbia County (55021) | 58,272 | 44 | 550,282 | C | 21 |
| Crawford County (55023) | 16,042 | 18 | 576,266 | D | 8 |
| Dodge County (55027) | 88,742 | 67 | 442,146 | C | 39 |
| Door County (55029) | 30,445 | 27 | 434,446 | D | 13 |
| Douglas County (55031) | 44,229 | 43 | 927,301 | C | 27 |
| Dunn County (55033) | 45,527 | 32 | 629,813 | D | 14 |
| Florence County (55037) | 4,646 | 6 | 303,660 | D | 0 |
| Forest County (55041) | 9,369 | 11 | 523,146 | C | 0 |
| Grant County (55043) | 51,770 | 46 | 1,112,268 | C | 8 |
| Green County (55045) | 37,017 | 31 | 394,194 | D | 12 |
| Green Lake County (55047) | 19,263 | 19 | 165,739 | D | 6 |
| Iowa County (55049) | 23,867 | 20 | 491,931 | D | 5 |
| Iron County (55051) | 6,210 | 9 | 682,186 | D | 4 |
| Jackson County (55053) | 20,981 | 17 | 800,524 | D | 6 |
| Jefferson County (55055) | 86,003 | 65 | 410,260 | D | 45 |
| Juneau County (55057) | 26,689 | 25 | 405,380 | C | 0 |
| Kewaunee County (55061) | 20,664 | 18 | 112,572 | D | 0 |
| Lafayette County (55065) | 16,942 | 16 | 453,993 | D | 0 |
| Langlade County (55067) | 19,490 | 21 | 439,808 | D | 12 |
| Lincoln County (55069) | 28,426 | 28 | 546,288 | D | 12 |
| Manitowoc County (55071) | 81,406 | 75 | 300,620 | D | 50 |
| Marinette County (55075) | 42,046 | 44 | 1,053,134 | D | 21 |
| Marquette County (55077) | 15,746 | 15 | 184,666 | D | 0 |
| Menominee County (55078) | 4,252 | 4 | 179,262 | D | 0 |
| Monroe County (55081) | 46,208 | 37 | 524,866 | C | 24 |
| Oconto County (55083) | 39,589 | 30 | 659,846 | D | 0 |
| Oneida County (55085) | 38,167 | 40 | 992,553 | D | 15 |
| Ozaukee County (55089) | 92,966 | 64 | 312,256 | D | 57 |
| Pepin County (55091) | 7,431 | 7 | 666,657 | D | 0 |
| Pierce County (55093) | 42,584 | 28 | 793,805 | C | 8 |
| Polk County (55095) | 45,555 | 35 | 716,513 | D | 0 |
| Portage County (55097) | 70,832 | 52 | 426,213 | C | 36 |
| Price County (55099) | 14,092 | 17 | 590,819 | D | 0 |
| Richland County (55103) | 17,205 | 16 | 378,749 | D | 5 |
| Rusk County (55107) | 14,179 | 17 | 352,396 | D | 0 |
| St. Croix County (55109) | 96,033 | 53 | 748,132 | D | 23 |
| Sauk County (55111) | 66,009 | 46 | 681,774 | C | 29 |
| Sawyer County (55113) | 18,476 | 20 | 564,936 | D | 0 |
| Shawano County (55115) | 41,039 | 32 | 494,472 | D | 14 |
| Taylor County (55119) | 20,024 | 18 | 499,555 | D | 6 |
| Trempealeau County (55121) | 30,839 | 22 | 899,532 | C | 0 |
| Vernon County (55123) | 31,049 | 26 | 673,774 | D | 5 |
| Vilas County (55125) | 23,647 | 21 | 969,754 | D | 0 |
| Washburn County (55129) | 16,854 | 18 | 537,807 | D | 0 |
| Waupaca County (55135) | 51,569 | 42 | 436,373 | D | 21 |
| Waushara County (55137) | 24,868 | 24 | 256,470 | D | 1 |
| Wood County (55141) | 74,004 | 72 | 376,238 | D | 55 |
| **56 counties** | **2,006,627** | **1,678** | **31,594,961** | 15 C, 41 D | 656 |

- Wisconsin cut alone: 118 s, peak osmium memory 4.12 GB, 352 MB (cut while North Dakota was building). Build: fetch
  10-47 s, build 165-237 s per county, four at a time (the largest state file after Minnesota's; the North Dakota
  checks and the Missouri cut ran alongside), 50.5 min from the first county to the last.
- Bus frequency: 47 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  8 have feeds; 1 (Ozaukee) has a feed read around it with no stop with 7-9 am departures inside the county, where
  OpenStreetMap maps 9 bus stops, so bus frequency is left unknown in all its 64 block groups. Rail distance: 45
  counties have no station in or near them.
- Census spot check: 56 counties, 1,336 of 1,336 values equal (0% mismatch). Tract-median flags: 56 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Adams 3,727 = 3,727 roads, 0 = 0 bus stops; Ashland 5,254 =
  5,254 roads (0 missing, 0 extra), 14 = 14 bus stops (0 missing, 0 extra; the mirror answered 504 on Ashland's bus stops in the first run, so the check was run again and the second run's result is kept).
- Crash counts: Wisconsin has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9191`): Manitowoc and Wood, 3 points each (Wisconsin's statewide parcel service is on
  the page), all six with the house panel on live parcel records: every check passes at all 6 points (neighborhood,
  canopy, canopy goal, crash text, state laws, Census area, HUD rent, FEMA, USGS, console): 54 pass, 0 fail. Each data
  file came from the r2.dev address (GET 200).
- R2: before 1,512,337,107 bytes (2,213 objects); dry run "57 files, net +0.032 GB, projected 1.544 GB"; after
  1,543,946,157 bytes (2,269 objects): 31,609,050 bytes added (the 56 data files, 31,594,961, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_wi_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_55001_2026-11-22.json`,
`..._55003_...`, `data/backtests/live_check_panels_2026-11-22_midwest_wi.json`.

## Missouri (103 of 103 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adair County (29001) | 25,301 | 23 | 191,178 | C | 17 |
| Andrew County (29003) | 18,065 | 14 | 188,111 | D | 8 |
| Atchison County (29005) | 5,187 | 7 | 141,910 | D | 0 |
| Audrain County (29007) | 24,548 | 24 | 326,092 | D | 15 |
| Barry County (29009) | 35,033 | 28 | 326,487 | D | 7 |
| Barton County (29011) | 11,690 | 12 | 136,300 | D | 0 |
| Bates County (29013) | 16,186 | 14 | 249,536 | D | 0 |
| Benton County (29015) | 20,151 | 19 | 370,171 | D | 0 |
| Bollinger County (29017) | 10,559 | 11 | 223,300 | D | 0 |
| Buchanan County (29021) | 83,568 | 75 | 341,762 | D | 67 |
| Butler County (29023) | 42,020 | 39 | 333,096 | C | 25 |
| Caldwell County (29025) | 8,927 | 10 | 160,444 | D | 0 |
| Callaway County (29027) | 44,741 | 33 | 522,285 | C | 19 |
| Camden County (29029) | 43,667 | 40 | 708,000 | D | 18 |
| Cape Girardeau County (29031) | 82,735 | 59 | 387,594 | C | 47 |
| Carroll County (29033) | 8,411 | 11 | 188,514 | D | 0 |
| Carter County (29035) | 5,297 | 6 | 194,541 | D | 0 |
| Cedar County (29039) | 14,615 | 14 | 177,199 | D | 0 |
| Chariton County (29041) | 7,390 | 9 | 295,020 | C | 0 |
| Christian County (29043) | 92,915 | 52 | 471,918 | C | 32 |
| Clark County (29045) | 6,675 | 7 | 267,731 | D | 0 |
| Clinton County (29049) | 21,414 | 17 | 167,058 | D | 5 |
| Cole County (29051) | 77,032 | 60 | 469,256 | C | 49 |
| Cooper County (29053) | 16,824 | 14 | 269,010 | C | 9 |
| Crawford County (29055) | 22,797 | 21 | 426,378 | D | 2 |
| Dade County (29057) | 7,641 | 9 | 161,346 | D | 0 |
| Dallas County (29059) | 17,551 | 15 | 266,355 | D | 0 |
| Daviess County (29061) | 8,477 | 8 | 168,139 | C | 0 |
| DeKalb County (29063) | 10,876 | 9 | 179,991 | D | 2 |
| Dent County (29065) | 14,539 | 14 | 403,964 | D | 9 |
| Douglas County (29067) | 11,965 | 11 | 437,061 | D | 0 |
| Dunklin County (29069) | 27,493 | 33 | 206,612 | D | 13 |
| Gasconade County (29073) | 14,746 | 14 | 251,098 | C | 0 |
| Gentry County (29075) | 6,245 | 7 | 143,057 | D | 0 |
| Grundy County (29079) | 9,787 | 12 | 152,686 | D | 8 |
| Harrison County (29081) | 8,190 | 11 | 201,758 | D | 0 |
| Henry County (29083) | 22,328 | 21 | 277,376 | D | 9 |
| Hickory County (29085) | 8,585 | 9 | 250,560 | D | 0 |
| Holt County (29087) | 4,240 | 6 | 178,028 | D | 0 |
| Howard County (29089) | 10,147 | 10 | 276,923 | D | 0 |
| Howell County (29091) | 40,383 | 33 | 435,562 | D | 17 |
| Iron County (29093) | 9,446 | 9 | 387,308 | C | 0 |
| Johnson County (29101) | 54,732 | 40 | 347,478 | C | 22 |
| Knox County (29103) | 3,756 | 5 | 125,186 | D | 0 |
| Laclede County (29105) | 36,390 | 31 | 322,325 | D | 18 |
| Lafayette County (29107) | 33,115 | 30 | 336,600 | D | 11 |
| Lawrence County (29109) | 38,593 | 34 | 173,127 | D | 12 |
| Lewis County (29111) | 9,924 | 11 | 133,056 | D | 0 |
| Lincoln County (29113) | 63,057 | 37 | 460,348 | D | 17 |
| Linn County (29115) | 11,852 | 16 | 295,660 | C | 7 |
| Livingston County (29117) | 14,364 | 14 | 186,166 | D | 11 |
| McDonald County (29119) | 23,701 | 17 | 189,471 | D | 0 |
| Macon County (29121) | 15,163 | 17 | 276,239 | C | 7 |
| Madison County (29123) | 12,729 | 12 | 187,021 | D | 7 |
| Maries County (29125) | 8,450 | 7 | 191,207 | D | 0 |
| Marion County (29127) | 28,457 | 29 | 276,337 | C | 19 |
| Mercer County (29129) | 3,482 | 4 | 122,223 | D | 0 |
| Miller County (29131) | 25,269 | 23 | 340,017 | D | 11 |
| Mississippi County (29133) | 11,902 | 13 | 145,917 | C | 0 |
| Moniteau County (29135) | 15,262 | 12 | 341,714 | C | 0 |
| Monroe County (29137) | 8,734 | 11 | 240,863 | D | 0 |
| Montgomery County (29139) | 11,426 | 14 | 255,991 | C | 0 |
| Morgan County (29141) | 21,717 | 21 | 431,015 | D | 0 |
| New Madrid County (29143) | 15,731 | 21 | 242,185 | D | 2 |
| Newton County (29145) | 60,118 | 46 | 300,679 | D | 26 |
| Nodaway County (29147) | 20,774 | 19 | 204,856 | D | 13 |
| Oregon County (29149) | 8,673 | 10 | 272,735 | D | 0 |
| Osage County (29151) | 13,402 | 11 | 391,754 | C | 0 |
| Ozark County (29153) | 8,873 | 10 | 316,492 | D | 0 |
| Pemiscot County (29155) | 14,958 | 19 | 132,729 | D | 7 |
| Perry County (29157) | 18,976 | 16 | 290,161 | D | 9 |
| Pettis County (29159) | 43,397 | 39 | 298,217 | C | 31 |
| Phelps County (29161) | 45,194 | 42 | 471,154 | D | 24 |
| Pike County (29163) | 17,711 | 17 | 410,689 | D | 0 |
| Polk County (29167) | 32,444 | 23 | 401,738 | D | 9 |
| Pulaski County (29169) | 53,894 | 32 | 322,485 | D | 20 |
| Putnam County (29171) | 4,642 | 7 | 172,617 | D | 0 |
| Ralls County (29173) | 10,428 | 10 | 228,158 | D | 1 |
| Randolph County (29175) | 24,365 | 23 | 198,994 | C | 15 |
| Ray County (29177) | 23,145 | 21 | 245,964 | D | 9 |
| Reynolds County (29179) | 6,010 | 6 | 485,271 | D | 0 |
| Ripley County (29181) | 10,708 | 14 | 156,515 | D | 0 |
| St. Clair County (29185) | 9,587 | 10 | 188,019 | D | 0 |
| Ste. Genevieve County (29186) | 18,571 | 17 | 348,225 | D | 5 |
| St. Francois County (29187) | 66,999 | 48 | 401,467 | D | 35 |
| Saline County (29195) | 23,231 | 24 | 375,933 | C | 14 |
| Schuyler County (29197) | 4,038 | 5 | 99,682 | D | 0 |
| Scotland County (29199) | 4,686 | 6 | 115,289 | D | 0 |
| Scott County (29201) | 37,933 | 36 | 226,885 | D | 28 |
| Shannon County (29203) | 7,177 | 8 | 543,637 | D | 0 |
| Shelby County (29205) | 5,986 | 7 | 162,069 | D | 0 |
| Stoddard County (29207) | 28,470 | 27 | 269,170 | D | 12 |
| Stone County (29209) | 32,048 | 33 | 423,317 | C | 13 |
| Sullivan County (29211) | 5,857 | 8 | 194,495 | D | 0 |
| Taney County (29213) | 56,529 | 47 | 426,254 | C | 35 |
| Texas County (29215) | 25,161 | 22 | 494,292 | D | 1 |
| Vernon County (29217) | 19,687 | 18 | 208,379 | D | 11 |
| Warren County (29219) | 37,177 | 25 | 435,789 | C | 10 |
| Washington County (29221) | 23,470 | 19 | 374,946 | D | 0 |
| Wayne County (29223) | 10,862 | 16 | 288,074 | D | 0 |
| Webster County (29225) | 40,500 | 24 | 325,442 | D | 8 |
| Worth County (29227) | 1,934 | 3 | 107,338 | D | 0 |
| Wright County (29229) | 18,965 | 19 | 238,118 | D | 8 |
| **103 counties** | **2,342,773** | **2,056** | **29,078,889** | 25 C, 78 D | 866 |

- Missouri cut alone: 112 s, peak osmium memory 4.15 GB, 248 MB (cut while Wisconsin was building; it was the last
  state, so the regional file was deleted after it). Build: fetch 9-45 s, build 141-194 s per county, four at a time,
  74 min from the first county to the last.
- Bus frequency: 99 counties have none (no feed that is read has a stop with 7-9 am departures in or near the county);
  4 have feeds. Rail distance: 79 counties have no station in or near them.
- Census spot check: 103 counties, 2,444 of 2,444 values equal (0% mismatch). Tract-median flags: 103 counties added,
  no existing county changed, 0 values matching neither the block group nor the tract.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru): Adair 2,101 = 2,101 roads, 1 = 1 bus stop; Andrew 2,531 =
  2,531 roads, 0 = 0 bus stops (0 missing, 0 extra).
- Crash counts: Missouri has no state crash source connected.
- Live check from R2 (`LIVE_PORT=9191`): Buchanan and Cole, 3 points each. None of the 103 counties has a parcel
  service on the page, so the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable; neighborhood,
  canopy, canopy goal, crash text, state laws and console pass at all 6 points (30 pass, 0 fail, 24 not checkable). Each
  data file came from the r2.dev address (GET 200).
- Tests: `app/data/intercity_transit_corridors.json`: the stops Hannibal MO (Marion, 29127) and St. Joseph MO (Buchanan,
  29021) now say `county_on_page: true` (2 lines; `tests/unit/transitCorridors.test.ts` checks the flag against the
  manifest).
- R2: before 1,543,946,157 bytes (2,269 objects); dry run "104 files, net +0.029 GB, projected 1.573 GB"; after
  1,573,050,945 bytes (2,372 objects): 29,104,788 bytes added (the 103 data files, 29,078,889, plus the larger
  `manifest.json`).

Files: `data/backtests/midwest_mo_census_spot_2026-11-22.json`, `data/backtests/midwest_osm_xcheck_29001_2026-11-22.json`,
`..._29003_...`, `data/backtests/live_check_panels_2026-11-22_midwest_mo.json`.

## Tests and housekeeping

- `npm test`: run in full after Iowa (1 failure, the HUD income-limit rows; fixed, that file re-run), after Nebraska
  (1,374 of 1,374), after Minnesota (1 failure, the corridor flags, which also covered two Kansas stops: the Kansas
  commit itself was not tested; fixed, then 1,374 of 1,374) and after South Dakota, North Dakota, Wisconsin and
  Missouri (1,374 of 1,374 each). `npm run typecheck` clean after each of those runs. `PW_PORT=9192 npm run test:e2e`
  93 of 93 passed (8.3 min), once, on the Missouri commit (all eight states in). `python3 scripts/r2_only.py --check`
  passes. No test was skipped or loosened and no pipeline code was changed.
- `app/data/hud_income_limits.json`: 630 rows added from HUD's API (none failed; the test lets only New England counties
  fail). Rows already in the file were not changed; `_source.added_for_new_counties` records each state's addition.
  Anyone adding counties to `counties/manifest.json` will need to do the same before `npm test` passes.
- `app/data/intercity_transit_corridors.json`: six stops' `county_on_page` flags (Cambridge and Hinckley MN, Newton and
  Arkansas City KS, Hannibal and St. Joseph MO) now say true, as the test requires.
- The 357 earlier R2-only files were downloaded from the bucket's public address into this worktree's `counties/`
  (gitignored) so that `build_tree_equity_2025.py`, `build_acs_fallback_flags.py` and `build_county_completeness.py`
  could run; the 630 new files are in `counties/` here too and not committed.
- No `sites_` files were built (as for every small-county batch: `w5/tools/sites.py` needs the old build machine's
  paths).
- Scratch use: the scratch folder measured 4.7 GB at its largest check (limit 5 GB) (the regional file
  2.8 GB, the national ACS tables 0.5 GB, one or two state files, up to 100 finished build folders at about 19 MB each);
  from Kansas on, finished counties were exported while the rest built.

## What is left

Counties still without a data file nationally: 1,415 (see the top of this page for the list by state). Not done here:
the other regions' small counties (South, the rest of the West: Colorado cut from the larger region file as the handoff
asks, Hawaii and Alaska have no extract in the registry), the 100,000-plus counties, and crash counts for these eight
states (no state source is wired into the pipeline for any of them).
