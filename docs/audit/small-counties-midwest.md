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
