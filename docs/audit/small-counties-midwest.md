# Small counties: the Midwest (22 Nov 2026), served from R2 only

**Status: in progress.** The states listed below were built, checked, uploaded and committed one at a time; a state that
is not listed below is not done. See the end of this page for what is left.

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
