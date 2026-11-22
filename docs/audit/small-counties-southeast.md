# Small counties: the Southeast (22 Nov 2026), served from R2 only

**Result: all 393 counties of the six states are built, checked and on the page, served from R2 only; none was
withheld.** Each state was built, checked, uploaded, live-checked and committed on its own.

| State | Counties built / missing | People (ACS 2020-24) | Block groups | Data files (bytes) | Tiers | Census values checked | R2 bytes added |
|---|---|---|---|---|---|---|---|
| GA | 132 / 132 | 3,320,290 | 2,517 | 42,245,163 | 26 C, 106 D | 3,056 | 42,278,325 |
| AL | 53 / 53 | 1,815,314 | 1,542 | 26,822,986 | 7 C, 46 D | 1,272 | 26,836,325 |
| MS | 76 / 76 | 1,910,304 | 1,683 | 18,154,565 | 15 C, 61 D | 1,808 | 18,173,708 |
| SC | 30 / 30 | 1,101,374 | 971 | 23,240,848 | 19 C, 11 D | 720 | 23,248,434 |
| FL | 31 / 31 | 1,063,001 | 788 | 12,096,065 | 10 C, 21 D | 744 | 12,103,870 |
| NC | 71 / 71 | 2,827,232 | 2,254 | 48,815,417 | 21 C, 50 D | 1,700 | 48,833,288 |
| **All** | **393 / 393** | **12,037,515** | **9,755** | **171,375,044** | 98 C, 295 D | **9,300** | **171,473,950** |

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 393 counties (all of them where a county has fewer), 9,300 values | 9,300 of 9,300 equal | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all county files, after each state | 393 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap ID for ID vs live Overpass (`scripts/check_osm_extract_vs_overpass.py`) | 2 counties per state, 12 (seed 20261122, drawn from each state's sorted list of new counties) | 8 counties exact (roads and bus stops): GA Jefferson, AL Macon and Lamar, MS Wilkinson and Tishomingo, SC Kershaw and Hampton, FL Levy. The other 4 lie on a state line (GA Wilkes, FL Jefferson, NC Warren and Hertford), so their boxes reach into the next state and into neighbouring counties the extract file does not hold; compared inside the state, every road matches except 1 road in Warren NC added to OpenStreetMap after the extract was made (details in each state's section) | 0% inside the counties apart from that 1 road in Warren |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, `LIVE_PORT=9221`, 3 points per county, seed 20261123) | 12 counties, 36 points | 223 pass, 100 not checkable (no parcel service on the page for the GA, AL, MS and SC counties, so the house-panel rows do not apply; 4 more at one Florida point whose parcel service did not answer); 3 USGS elevation rows first showed "Not available (the service did not answer in time)" (the page's 6 s limit): all 3 passed when re-opened alone or when the county was run again, and the first tries are kept in the result files; no wrong value was shown anywhere | 0 wrong values |

Counties still without a data file after this batch, counted from the registry the same way (not in
`counties/bundle_*.json.gz` or `counties/.r2-only.txt`, Puerto Rico left out): **628** (1,021 before), of which Los
Angeles and Orange (built by their own pipeline, loaded from `app/data/`) are 2 and Hawaii's 5 have no OpenStreetMap
extract in the registry. Remaining by state: TX 211, VA 116, OK 72, AR 67, CO 53, WV 52, LA (Louisiana) 50, HI 5, CA 2.

**R2 storage:** before 1,704,660,375 bytes (2,766 objects), after 1,876,134,325 bytes (3,159 objects): 171,473,950 bytes
added (the 393 data files, 171,375,044, plus the larger `manifest.json`). 1.876 GB of the 8 GB ceiling and the 10 GB
allowance. Every upload went through `scripts/r2_sync_counties.py` after a `--dry-run`; the largest projection was 1.876 GB
(the brief's stop was 4 GB); the per-state figures are in each state's section.

**Measured projection for the rest:** this batch stored 17,568 bytes per block group (state range 10,787 for Mississippi to
23,935 for South Carolina; 436,069 bytes per county). The 628 remaining counties have 22,472 block groups (ACS 2020-24
B01003 rows), of which 8,640 are Los Angeles's and Orange's and 1,083 are Hawaii's, which this route does not build: 12,749
block groups are left for it. At this batch's rate that is 0.224 GB (0.138 GB at Mississippi's rate, 0.305 GB at South
Carolina's), which would take R2 from 1.876 GB to about 2.10 GB (range 2.01 to 2.18 GB). A projection from these
southeastern counties; Texas (3,522 block groups) and Virginia (2,604) are the largest remaining.

The batch is every county under 100,000 people with no data file (not in `counties/bundle_*.json.gz`, not in
`counties/.r2-only.txt`), counted from the registry (`national/data/counties.json`) before starting: GA 132, AL 53, MS 76,
SC 30, FL 31, NC 71, **393 counties** (no county of these states with 100,000 people or more was without a data file). The
method is the Great Lakes batch's (`small-counties-greatlakes.md`), unchanged: files are uploaded with
`scripts/r2_sync_counties.py` after a `--dry-run`, listed in `counties/.r2-only.txt`, and not committed. No pipeline code
was changed.

## How

- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec` from
  a copy of `pipeline/` in the session's scratch folder, three counties at a time, the national ACS table files already in
  the shared cache; then `scripts/export_county_bundle.py <dir> <fips> --r2-only` one county at a time;
  `build_tree_equity_2025.py <state>` (existing counties' files that differ only in `_meta.built` were restored to what is
  committed); `build_acs_fallback_flags.py` (all county files; the 1,381 earlier R2-only files were downloaded from the
  bucket's public address into this worktree's gitignored `counties/` first); `build_county_completeness.py` (only the new
  rows are kept, since a fresh run rewrites `computed_on` on every row).
- **OpenStreetMap:** Georgia, Florida and North Carolina counties read the sub-region or state files the registry names
  (openstreetmap.fr, one download each, shared by the counties that use it). Alabama, Mississippi and South Carolina are
  `split: us-south/<state>` in the registry: `us-south-latest.osm.pbf` (4,623,607,998 bytes, md5
  `aaee92b7cea7116859b6f51c768d7830`, equal to the published `us-south.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z
  from `us-south.state.txt`) was downloaded once, cut into the three states with `national/osm_split.py` and deleted. Each
  state's files and build folders were deleted once the state was uploaded and checked.
- **HUD income limits:** `tests/unit/buildingCosts.test.ts` needs a row (or a listed failure) in
  `app/data/hud_income_limits.json` for every manifest county. Each state's rows were fetched from HUD's API
  (`https://www.huduser.gov/hudapi/public/il/data/<fips>99999`) with the script's own `get()` and `row_from()`
  (`scripts/costs/fetch_hud_income_limits.py`); existing rows were not re-fetched or changed.
- **Transit corridors:** `tests/unit/transitCorridors.test.ts` checks every stop's `county_on_page` flag against the
  manifest; the flags of stops whose county is now on the page were set to true in the same commit as the state (three
  Mississippi stops; none for the other five states).
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency and rail distance where the per-state notes say so.

## Checks (every state)

- **Census:** `scripts/census_spot_check.py` (seed 20261119): population, median home value, median gross rent and median
  household income of 6 randomly chosen block groups in every county (all of them where a county has fewer) against the
  ACS 2020-24 table files, read by a separate parser. Where the block group's median is suppressed the file must hold the
  tract's published median, flagged as a tract value in `acs_fallback_flags.json`, or nothing.
- **OpenStreetMap:** `scripts/check_osm_extract_vs_overpass.py`, ID for ID against a live Overpass query of the same box
  (maps.mail.ru mirror), two counties per state, picked at random from the state's sorted list of new counties with
  `random.Random(20261122).sample(list, 2)`. The extracts are dated snapshots and Overpass is live, so a few differences
  could be edits made since; the IDs would be listed. Where a county's box crosses a state line, the comparison was repeated
  inside the extract's state (Overpass query limited to `area["ISO3166-2"="US-XX"]`), as the Great Lakes record did, and the
  differing roads were located by TIGERweb county.
- **Live:** `scripts/live_check_panels.mjs` (`LIVE_PORT=9221`, 3 points per county) on the real page loading each county's
  file from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev`; the counties were picked with `random.Random(20261123).sample(list, 2)`.


## Georgia (132 of 132 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Appling County (13001) | 18,493 | 16 | 282,289 | D | 7 |
| Atkinson County (13003) | 8,337 | 6 | 134,478 | D | 0 |
| Bacon County (13005) | 11,109 | 10 | 126,933 | D | 0 |
| Baker County (13007) | 2,790 | 4 | 150,851 | D | 0 |
| Baldwin County (13009) | 43,642 | 39 | 305,530 | D | 26 |
| Banks County (13011) | 19,264 | 13 | 415,502 | D | 4 |
| Barrow County (13013) | 89,886 | 45 | 541,011 | D | 39 |
| Ben Hill County (13017) | 17,089 | 14 | 206,882 | D | 12 |
| Berrien County (13019) | 18,352 | 16 | 208,076 | D | 8 |
| Bleckley County (13023) | 12,430 | 12 | 206,836 | D | 12 |
| Brantley County (13025) | 18,315 | 10 | 230,226 | C | 1 |
| Brooks County (13027) | 16,293 | 16 | 230,473 | D | 0 |
| Bryan County (13029) | 48,263 | 20 | 784,453 | C | 11 |
| Bulloch County (13031) | 82,683 | 57 | 415,938 | D | 37 |
| Burke County (13033) | 24,470 | 18 | 279,831 | D | 6 |
| Butts County (13035) | 26,496 | 17 | 248,537 | D | 6 |
| Calhoun County (13037) | 5,498 | 6 | 109,664 | D | 0 |
| Camden County (13039) | 56,970 | 39 | 401,786 | D | 28 |
| Candler County (13043) | 11,043 | 9 | 129,199 | D | 0 |
| Catoosa County (13047) | 68,634 | 49 | 445,122 | C | 44 |
| Charlton County (13049) | 12,818 | 9 | 179,638 | C | 0 |
| Chattahoochee County (13053) | 8,887 | 8 | 352,379 | C | 6 |
| Chattooga County (13055) | 25,036 | 23 | 424,391 | D | 16 |
| Clay County (13061) | 2,850 | 3 | 115,843 | D | 0 |
| Clinch County (13065) | 6,759 | 7 | 200,641 | C | 0 |
| Coffee County (13069) | 43,347 | 32 | 363,500 | D | 17 |
| Colquitt County (13071) | 46,224 | 45 | 287,038 | C | 26 |
| Cook County (13075) | 17,532 | 16 | 151,088 | C | 13 |
| Crawford County (13079) | 12,225 | 9 | 504,321 | D | 0 |
| Crisp County (13081) | 19,790 | 20 | 142,588 | C | 15 |
| Dade County (13083) | 16,165 | 14 | 292,611 | D | 2 |
| Dawson County (13085) | 30,242 | 15 | 373,326 | D | 6 |
| Decatur County (13087) | 29,195 | 23 | 236,408 | D | 12 |
| Dodge County (13091) | 19,805 | 18 | 583,493 | D | 8 |
| Dooly County (13093) | 10,984 | 9 | 166,727 | D | 0 |
| Dougherty County (13095) | 83,091 | 75 | 275,895 | D | 72 |
| Early County (13099) | 10,603 | 13 | 280,280 | D | 0 |
| Echols County (13101) | 3,709 | 3 | 102,272 | D | 0 |
| Effingham County (13103) | 69,143 | 40 | 442,522 | C | 17 |
| Elbert County (13105) | 19,849 | 20 | 449,244 | D | 11 |
| Emanuel County (13107) | 23,026 | 17 | 349,171 | D | 8 |
| Evans County (13109) | 10,757 | 10 | 118,867 | D | 0 |
| Fannin County (13111) | 25,742 | 18 | 845,908 | C | 0 |
| Franklin County (13119) | 24,234 | 22 | 440,644 | D | 0 |
| Gilmer County (13123) | 32,426 | 20 | 660,420 | C | 9 |
| Glascock County (13125) | 2,932 | 3 | 83,411 | D | 0 |
| Glynn County (13127) | 85,447 | 69 | 394,513 | D | 65 |
| Gordon County (13129) | 59,100 | 39 | 483,919 | D | 22 |
| Grady County (13131) | 26,108 | 26 | 222,726 | D | 12 |
| Greene County (13133) | 20,109 | 19 | 434,336 | D | 0 |
| Habersham County (13137) | 47,793 | 32 | 648,480 | C | 20 |
| Hancock County (13141) | 8,650 | 7 | 359,934 | D | 0 |
| Haralson County (13143) | 31,285 | 21 | 344,144 | D | 6 |
| Harris County (13145) | 36,086 | 20 | 372,234 | C | 2 |
| Hart County (13147) | 26,939 | 20 | 309,364 | D | 6 |
| Heard County (13149) | 11,773 | 8 | 267,904 | D | 0 |
| Irwin County (13155) | 9,285 | 8 | 235,103 | D | 0 |
| Jackson County (13157) | 84,757 | 48 | 854,412 | C | 29 |
| Jasper County (13159) | 15,929 | 10 | 357,802 | D | 0 |
| Jeff Davis County (13161) | 14,924 | 12 | 183,053 | D | 8 |
| Jefferson County (13163) | 15,341 | 17 | 236,324 | D | 0 |
| Jenkins County (13165) | 8,711 | 8 | 117,986 | D | 0 |
| Johnson County (13167) | 9,190 | 8 | 260,248 | D | 0 |
| Jones County (13169) | 28,673 | 26 | 366,719 | D | 7 |
| Lamar County (13171) | 19,571 | 13 | 201,755 | D | 11 |
| Lanier County (13173) | 10,221 | 8 | 101,017 | D | 0 |
| Laurens County (13175) | 49,798 | 39 | 748,207 | D | 26 |
| Lee County (13177) | 33,626 | 18 | 192,210 | D | 9 |
| Liberty County (13179) | 67,397 | 35 | 863,478 | C | 26 |
| Lincoln County (13181) | 7,854 | 7 | 244,094 | D | 0 |
| Long County (13183) | 18,374 | 11 | 324,492 | C | 4 |
| Lumpkin County (13187) | 34,505 | 21 | 449,006 | D | 6 |
| McDuffie County (13189) | 21,718 | 18 | 230,439 | D | 13 |
| McIntosh County (13191) | 11,312 | 16 | 174,669 | D | 0 |
| Macon County (13193) | 11,864 | 13 | 234,486 | D | 0 |
| Madison County (13195) | 31,528 | 18 | 434,216 | C | 4 |
| Marion County (13197) | 7,509 | 5 | 105,448 | D | 0 |
| Meriwether County (13199) | 20,929 | 19 | 364,765 | D | 0 |
| Miller County (13201) | 5,850 | 5 | 105,125 | D | 0 |
| Mitchell County (13205) | 21,058 | 19 | 172,052 | D | 7 |
| Monroe County (13207) | 29,664 | 18 | 396,777 | D | 8 |
| Montgomery County (13209) | 8,640 | 7 | 184,410 | D | 1 |
| Morgan County (13211) | 21,078 | 13 | 480,916 | D | 4 |
| Murray County (13213) | 40,562 | 28 | 576,313 | D | 14 |
| Oconee County (13219) | 43,551 | 21 | 618,804 | C | 15 |
| Oglethorpe County (13221) | 15,509 | 13 | 509,431 | C | 0 |
| Peach County (13225) | 28,560 | 20 | 318,824 | D | 18 |
| Pickens County (13227) | 34,951 | 25 | 428,585 | D | 10 |
| Pierce County (13229) | 20,202 | 15 | 253,938 | D | 1 |
| Pike County (13231) | 19,903 | 13 | 178,516 | D | 1 |
| Polk County (13233) | 43,785 | 32 | 405,611 | D | 29 |
| Pulaski County (13235) | 9,939 | 12 | 179,492 | D | 0 |
| Putnam County (13237) | 22,855 | 20 | 328,168 | D | 0 |
| Quitman County (13239) | 2,264 | 2 | 57,827 | D | 0 |
| Rabun County (13241) | 17,312 | 18 | 503,985 | D | 0 |
| Randolph County (13243) | 6,196 | 7 | 121,585 | D | 0 |
| Rockdale County (13247) | 95,281 | 65 | 471,366 | D | 60 |
| Schley County (13249) | 4,513 | 3 | 97,937 | D | 0 |
| Screven County (13251) | 14,130 | 15 | 236,778 | D | 0 |
| Seminole County (13253) | 9,156 | 9 | 117,522 | D | 0 |
| Spalding County (13255) | 68,892 | 48 | 315,272 | D | 37 |
| Stephens County (13257) | 27,012 | 23 | 369,622 | C | 15 |
| Stewart County (13259) | 4,869 | 5 | 108,731 | D | 0 |
| Sumter County (13261) | 29,061 | 25 | 255,988 | C | 17 |
| Talbot County (13263) | 5,742 | 6 | 242,909 | D | 0 |
| Taliaferro County (13265) | 1,558 | 3 | 186,416 | D | 0 |
| Tattnall County (13267) | 24,208 | 21 | 295,564 | D | 0 |
| Taylor County (13269) | 7,786 | 7 | 312,840 | D | 0 |
| Telfair County (13271) | 11,831 | 11 | 426,089 | D | 0 |
| Terrell County (13273) | 8,850 | 10 | 140,228 | D | 0 |
| Thomas County (13275) | 45,777 | 39 | 317,664 | D | 27 |
| Tift County (13277) | 41,438 | 34 | 187,240 | D | 27 |
| Toombs County (13279) | 27,102 | 27 | 219,062 | D | 20 |
| Towns County (13281) | 12,913 | 11 | 406,232 | D | 0 |
| Treutlen County (13283) | 6,376 | 7 | 143,978 | D | 0 |
| Troup County (13285) | 70,330 | 47 | 434,600 | D | 35 |
| Turner County (13287) | 8,939 | 9 | 177,291 | D | 6 |
| Twiggs County (13289) | 7,803 | 9 | 424,439 | D | 0 |
| Union County (13291) | 26,304 | 19 | 561,230 | D | 0 |
| Upson County (13293) | 28,029 | 21 | 267,494 | D | 16 |
| Walker County (13295) | 68,762 | 57 | 861,266 | C | 36 |
| Ware County (13299) | 35,976 | 33 | 429,482 | C | 30 |
| Warren County (13301) | 5,170 | 6 | 244,096 | D | 0 |
| Washington County (13303) | 19,849 | 16 | 376,106 | D | 9 |
| Wayne County (13305) | 30,949 | 25 | 313,415 | C | 17 |
| Webster County (13307) | 2,381 | 2 | 65,533 | C | 0 |
| Wheeler County (13309) | 7,335 | 6 | 334,513 | D | 0 |
| White County (13311) | 28,810 | 19 | 405,853 | D | 0 |
| Wilcox County (13315) | 8,798 | 7 | 247,317 | D | 0 |
| Wilkes County (13317) | 9,549 | 11 | 462,193 | D | 0 |
| Wilkinson County (13319) | 8,747 | 9 | 333,306 | D | 0 |
| Worth County (13321) | 20,451 | 17 | 241,506 | D | 8 |
| **132 counties** | **3,320,290** | **2,517** | **42,245,163** | 26 C, 106 D | 1223 |

- OpenStreetMap: Georgia counties read the file the registry names for each county, from openstreetmap.fr, each downloaded
  once and shared: `southeast` (49 counties), `southwest` (34), `northeast` (29), `northwest` (18), `north_metro` (1) and
  `georgia-latest.osm.pbf` (1). Data timestamps: 2026-11-21T01:02:35Z for the five sub-region files and
  2026-11-21T01:04:36Z for the whole-state file; each county's sources list names its own. Build: fetch 9-122 s, build
  23-164 s per county, three at a time, about 45 min from the first county to the last.
- Bus frequency: 120 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in
  or near the county); 12 have values. Rail distance: 124 counties have none; 8 have values.
- Census spot check: 132 counties, 3,056 of 3,056 values equal (0% mismatch). Tract-median flags: 132 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Georgia has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS holds IL, ME, PA, TN, UT and
  VA only, checked, not GA); all 132 files say "Not connected for Georgia yet: crash gaps are not scored and crash-based
  projects are not proposed". No crash counts were built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. No corridor stop's flag needed changing (the
  script that compares each stop's `county_on_page` with the manifest found 0).
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to several tries first, so the checks ran when it came back. Jefferson (13163): 2,231 = 2,231 roads, 0 = 0
  bus stops (0 missing, 0 extra). Wilkes (13317): bus stops 0 = 0, **roads 1,657 on Overpass, 1,521 in the extract (136 only on
  Overpass, 0 only in the extract)**: Wilkes County lies on the Savannah River and its box reaches into South Carolina and
  into the next Georgia counties, which the `northeast` sub-region file does not hold. With the Overpass query limited to
  Georgia's area (same box, classes and extract; `area["ISO3166-2"="US-GA"]`, result in `southeast_osm_xcheck_state_13317_...json`):
  1,597 on Overpass, 1,521 in the extract, 0 only in the extract, 76 only on Overpass; all 76 lie in the box's margin
  outside Wilkes, in McDuffie County (74) and Warren County (2) (13189 and 13301, located with TIGERweb), beyond the edge
  of the sub-region file. The other 60 of the 136 are the difference between 1,657 and 1,597, that is, roads outside Georgia;
  they were not located one by one. So: inside Wilkes every road and bus stop matches; what is missing is the roads of the
  neighbouring state and counties in the box's margin. The extract's snapshot is 2026-11-21T01:02:35Z.
- Live check from R2 (`LIVE_PORT=9221`): Wheeler (13309) and Emanuel (13107), 3 points each (picked with seed 20261123 from
  the state's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD
  rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6
  points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,704,660,375 bytes (2,766 objects); dry run "133 files, net +0.042 GB, projected 1.747 GB"; after
  1,746,938,700 bytes (2,898 objects): 42,278,325 bytes added (the 132 data files, 42,245,163, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_ga_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_13317_2026-11-22.json`,
`..._13163_...`, `data/backtests/live_check_panels_2026-11-22_southeast_ga.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Alabama (53 of 53 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Autauga County (01001) | 59,947 | 45 | 346,607 | C | 28 |
| Barbour County (01005) | 24,643 | 22 | 340,056 | D | 11 |
| Bibb County (01007) | 22,130 | 18 | 757,009 | D | 0 |
| Blount County (01009) | 59,518 | 43 | 718,474 | D | 8 |
| Bullock County (01011) | 10,058 | 9 | 164,027 | D | 0 |
| Butler County (01013) | 18,630 | 19 | 216,253 | D | 9 |
| Chambers County (01017) | 34,192 | 30 | 431,343 | D | 19 |
| Cherokee County (01019) | 25,443 | 25 | 729,938 | D | 0 |
| Chilton County (01021) | 45,992 | 32 | 530,422 | D | 11 |
| Choctaw County (01023) | 12,380 | 15 | 322,657 | D | 0 |
| Clarke County (01025) | 22,543 | 25 | 451,960 | D | 0 |
| Clay County (01027) | 14,192 | 11 | 367,242 | D | 0 |
| Cleburne County (01029) | 15,426 | 10 | 816,919 | C | 0 |
| Coffee County (01031) | 54,920 | 36 | 272,364 | D | 20 |
| Colbert County (01033) | 58,022 | 49 | 491,626 | D | 33 |
| Conecuh County (01035) | 11,275 | 12 | 388,840 | D | 0 |
| Coosa County (01037) | 10,300 | 10 | 255,895 | D | 0 |
| Covington County (01039) | 37,628 | 38 | 362,921 | D | 18 |
| Crenshaw County (01041) | 13,122 | 13 | 219,612 | D | 0 |
| Cullman County (01043) | 90,566 | 66 | 707,498 | D | 26 |
| Dale County (01045) | 49,599 | 43 | 414,083 | D | 30 |
| Dallas County (01047) | 36,858 | 41 | 790,012 | D | 26 |
| DeKalb County (01049) | 72,269 | 56 | 818,821 | D | 12 |
| Elmore County (01051) | 89,526 | 52 | 474,261 | C | 22 |
| Escambia County (01053) | 36,629 | 32 | 348,687 | D | 19 |
| Fayette County (01057) | 16,053 | 19 | 379,648 | D | 0 |
| Franklin County (01059) | 31,966 | 27 | 291,460 | D | 11 |
| Geneva County (01061) | 26,887 | 24 | 276,582 | D | 2 |
| Greene County (01063) | 7,424 | 11 | 1,230,719 | D | 0 |
| Hale County (01065) | 14,829 | 15 | 803,593 | D | 0 |
| Henry County (01067) | 17,647 | 16 | 228,906 | D | 0 |
| Jackson County (01071) | 53,053 | 44 | 610,457 | D | 15 |
| Lamar County (01075) | 13,693 | 15 | 255,970 | D | 0 |
| Lauderdale County (01077) | 95,830 | 71 | 593,614 | D | 39 |
| Lawrence County (01079) | 33,276 | 31 | 327,335 | D | 1 |
| Lowndes County (01085) | 9,833 | 11 | 225,674 | C | 0 |
| Macon County (01087) | 18,691 | 21 | 337,899 | D | 13 |
| Marengo County (01091) | 18,851 | 25 | 654,120 | D | 8 |
| Marion County (01093) | 29,184 | 29 | 404,747 | D | 0 |
| Monroe County (01099) | 19,388 | 21 | 439,289 | D | 8 |
| Perry County (01105) | 8,031 | 11 | 806,101 | D | 0 |
| Pickens County (01107) | 18,721 | 19 | 562,546 | D | 0 |
| Pike County (01109) | 32,987 | 29 | 254,082 | D | 16 |
| Randolph County (01111) | 22,510 | 19 | 463,860 | D | 0 |
| Russell County (01113) | 58,811 | 45 | 498,108 | C | 31 |
| St. Clair County (01115) | 94,166 | 61 | 790,692 | C | 33 |
| Sumter County (01119) | 11,878 | 14 | 1,547,553 | D | 0 |
| Talladega County (01121) | 81,021 | 60 | 952,663 | C | 39 |
| Tallapoosa County (01123) | 40,938 | 36 | 455,259 | D | 13 |
| Walker County (01127) | 64,841 | 60 | 733,019 | D | 16 |
| Washington County (01129) | 15,143 | 18 | 316,413 | D | 0 |
| Wilcox County (01131) | 10,172 | 13 | 329,175 | D | 0 |
| Winston County (01133) | 23,682 | 25 | 315,975 | D | 0 |
| **53 counties** | **1,815,314** | **1,542** | **26,822,986** | 7 C, 46 D | 537 |

- OpenStreetMap: `us-south-latest.osm.pbf` from download.openstreetmap.fr (4,623,607,998 bytes, md5
  `aaee92b7cea7116859b6f51c768d7830`, equal to the published `us-south.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z
  from `us-south.state.txt`). Alabama, Mississippi and South Carolina were cut from it one at a time with
  `national/osm_split.py us-south --states AL,MS,SC --per-pass 1` (osmium `extract -s smart`, union of the state's county
  boxes plus 0.05 degrees): Alabama 176 s, peak osmium memory 4.13 GB, 184 MB; Mississippi 174 s, 4.09 GB, 117 MB; South
  Carolina 188 s, 4.13 GB, 250 MB. The regional file was deleted once the three were cut (it was on disk for the cuts only).
  Alabama build: fetch 12-51 s, build 100-197 s per county, three at a time (the Georgia checks, tests and the Mississippi
  builds ran alongside), about 42 min from the first county to the last.
- Bus frequency: 48 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 5 have values. Rail distance: 51 counties have none; 2 have values.
- Census spot check: 53 counties, 1,272 of 1,272 values equal (0% mismatch). Tract-median flags: 53 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Alabama has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no AL); all 53 files say
  "Not connected for Alabama yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. No corridor stop's flag needed changing.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. Macon (01087) 5,355 = 5,355 roads, 58 = 58 bus stops; Lamar (01075) 2,027 = 2,027
  roads, 0 = 0 bus stops (0 missing, 0 extra). The extract's snapshot is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9221`): Tallapoosa (01123) and Macon (01087), 3 points each (picked with seed 20261123 from
  the state's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD
  rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6
  points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,746,938,700 bytes (2,898 objects); dry run "54 files, net +0.027 GB, projected 1.774 GB"; after
  1,773,775,025 bytes (2,951 objects): 26,836,325 bytes added (the 53 data files, 26,822,986, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_al_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_01087_2026-11-22.json`,
`..._01075_...`, `data/backtests/live_check_panels_2026-11-22_southeast_al.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Mississippi (76 of 76 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Adams County (28001) | 28,803 | 32 | 315,479 | D | 27 |
| Alcorn County (28003) | 34,289 | 29 | 163,453 | D | 17 |
| Amite County (28005) | 12,565 | 13 | 151,665 | D | 0 |
| Attala County (28007) | 17,526 | 17 | 210,553 | D | 9 |
| Benton County (28009) | 7,589 | 7 | 166,778 | D | 0 |
| Bolivar County (28011) | 29,534 | 28 | 230,589 | D | 13 |
| Calhoun County (28013) | 12,922 | 14 | 103,754 | D | 0 |
| Carroll County (28015) | 9,686 | 9 | 218,055 | C | 0 |
| Chickasaw County (28017) | 16,915 | 16 | 116,652 | D | 0 |
| Choctaw County (28019) | 8,118 | 9 | 159,057 | D | 0 |
| Claiborne County (28021) | 8,582 | 9 | 200,939 | D | 0 |
| Clarke County (28023) | 15,314 | 17 | 184,770 | D | 0 |
| Clay County (28025) | 18,383 | 17 | 163,603 | D | 11 |
| Coahoma County (28027) | 20,540 | 24 | 213,614 | D | 19 |
| Copiah County (28029) | 27,855 | 24 | 366,289 | C | 8 |
| Covington County (28031) | 18,148 | 16 | 259,179 | D | 0 |
| Forrest County (28035) | 78,272 | 57 | 505,302 | C | 48 |
| Franklin County (28037) | 7,622 | 10 | 145,604 | D | 0 |
| George County (28039) | 25,170 | 15 | 176,618 | D | 0 |
| Greene County (28041) | 13,615 | 10 | 161,193 | D | 0 |
| Grenada County (28043) | 21,217 | 21 | 154,944 | D | 16 |
| Hancock County (28045) | 46,167 | 44 | 493,611 | C | 29 |
| Holmes County (28051) | 16,191 | 19 | 238,196 | D | 0 |
| Humphreys County (28053) | 7,395 | 9 | 109,470 | D | 0 |
| Issaquena County (28055) | 928 | 2 | 161,060 | D | 0 |
| Itawamba County (28057) | 24,036 | 18 | 174,507 | D | 0 |
| Jasper County (28061) | 16,059 | 16 | 212,720 | D | 0 |
| Jefferson County (28063) | 7,068 | 8 | 160,748 | D | 0 |
| Jefferson Davis County (28065) | 11,117 | 12 | 395,540 | D | 0 |
| Jones County (28067) | 66,472 | 54 | 428,384 | C | 27 |
| Kemper County (28069) | 8,729 | 9 | 199,663 | D | 0 |
| Lafayette County (28071) | 58,327 | 41 | 326,420 | D | 30 |
| Lamar County (28073) | 65,713 | 45 | 428,642 | C | 23 |
| Lauderdale County (28075) | 71,504 | 70 | 362,424 | C | 47 |
| Lawrence County (28077) | 11,786 | 11 | 407,838 | D | 0 |
| Leake County (28079) | 21,319 | 18 | 167,075 | D | 0 |
| Lee County (28081) | 83,034 | 62 | 280,916 | D | 40 |
| Leflore County (28083) | 27,141 | 29 | 186,170 | C | 23 |
| Lincoln County (28085) | 34,877 | 29 | 443,104 | C | 17 |
| Lowndes County (28087) | 57,838 | 49 | 297,500 | C | 31 |
| Marion County (28091) | 24,193 | 23 | 537,771 | D | 10 |
| Marshall County (28093) | 33,979 | 27 | 290,888 | D | 5 |
| Monroe County (28095) | 33,747 | 30 | 262,804 | C | 8 |
| Montgomery County (28097) | 9,602 | 11 | 141,507 | D | 0 |
| Neshoba County (28099) | 28,932 | 28 | 166,628 | D | 11 |
| Newton County (28101) | 21,093 | 20 | 193,378 | D | 0 |
| Noxubee County (28103) | 10,025 | 10 | 141,473 | D | 0 |
| Oktibbeha County (28105) | 51,771 | 33 | 166,192 | D | 25 |
| Panola County (28107) | 32,808 | 30 | 182,907 | D | 10 |
| Pearl River County (28109) | 57,458 | 42 | 722,871 | C | 18 |
| Perry County (28111) | 11,449 | 11 | 171,183 | D | 0 |
| Pike County (28113) | 39,602 | 33 | 263,099 | C | 20 |
| Pontotoc County (28115) | 31,550 | 22 | 182,346 | D | 0 |
| Prentiss County (28117) | 25,184 | 22 | 152,561 | D | 10 |
| Quitman County (28119) | 5,774 | 9 | 128,450 | C | 0 |
| Scott County (28123) | 27,718 | 25 | 212,733 | D | 0 |
| Sharkey County (28125) | 3,872 | 6 | 84,939 | D | 0 |
| Simpson County (28127) | 25,691 | 24 | 325,652 | D | 0 |
| Smith County (28129) | 14,132 | 15 | 321,049 | D | 0 |
| Stone County (28131) | 18,894 | 12 | 152,915 | D | 0 |
| Sunflower County (28133) | 24,333 | 24 | 217,589 | D | 9 |
| Tallahatchie County (28135) | 11,764 | 12 | 156,642 | D | 0 |
| Tate County (28137) | 28,321 | 18 | 146,166 | D | 5 |
| Tippah County (28139) | 21,523 | 20 | 175,877 | D | 0 |
| Tishomingo County (28141) | 18,660 | 19 | 198,022 | D | 0 |
| Tunica County (28143) | 9,475 | 9 | 206,103 | D | 0 |
| Union County (28145) | 28,122 | 21 | 178,147 | D | 8 |
| Walthall County (28147) | 13,839 | 13 | 474,864 | D | 0 |
| Warren County (28149) | 43,020 | 36 | 324,655 | D | 29 |
| Washington County (28151) | 42,765 | 53 | 254,660 | D | 37 |
| Wayne County (28153) | 19,718 | 17 | 215,513 | D | 0 |
| Webster County (28155) | 9,972 | 8 | 117,152 | D | 0 |
| Wilkinson County (28157) | 8,162 | 8 | 185,832 | D | 0 |
| Winston County (28159) | 17,536 | 19 | 167,956 | D | 0 |
| Yalobusha County (28161) | 12,419 | 12 | 137,398 | D | 0 |
| Yazoo County (28163) | 24,835 | 22 | 354,565 | C | 12 |
| **76 counties** | **1,910,304** | **1,683** | **18,154,565** | 15 C, 61 D | 652 |

- OpenStreetMap: the Mississippi cut of the 21 Nov 2026 `us-south-latest.osm.pbf` (see Alabama: 174 s, peak osmium memory
  4.09 GB, 117 MB; data timestamp 2026-11-21T01:28:06Z). Build: fetch 11-29 s, build 51-216 s per county, three at a time (the
  Alabama checks and the South Carolina builds ran alongside), about 40 min from the first county to the last.
- Bus frequency: 74 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 2 have values. Rail distance: 64 counties have none; 12 have values.
- Census spot check: 76 counties, 1,808 of 1,808 values equal (0% mismatch). Tract-median flags: 76 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Mississippi has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no MS); all 76 files
  say "Not connected for Mississippi yet: crash gaps are not scored and crash-based projects are not proposed". No crash
  counts were built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. `app/data/intercity_transit_corridors.json`:
  Bay St. Louis MS (Hancock, 28045), Meridian MS (Lauderdale, 28075) and Vicksburg MS (Warren, 28149) now say
  `county_on_page: true` (3 lines), as `tests/unit/transitCorridors.test.ts` requires.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. Wilkinson (28157, on the Mississippi River; its box reaches into Louisiana) 1,609 =
  1,609 roads, 0 = 0 bus stops; Tishomingo (28141, on the Alabama and Tennessee lines) 2,622 = 2,622 roads, 0 = 0 bus stops
  (0 missing, 0 extra in both, so no comparison limited to the state was needed). The extract's snapshot is
  2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9221`): Winston (28159) and Tippah (28139), 3 points each (picked with seed 20261123 from
  the state's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD
  rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6
  points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,773,775,025 bytes (2,951 objects); dry run "77 files, net +0.018 GB, projected 1.792 GB"; after
  1,791,948,733 bytes (3,027 objects): 18,173,708 bytes added (the 76 data files, 18,154,565, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_ms_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_28157_2026-11-22.json`,
`..._28141_...`, `data/backtests/live_check_panels_2026-11-22_southeast_ms.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## South Carolina (30 of 30 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Abbeville County (45001) | 24,420 | 21 | 872,931 | D | 7 |
| Allendale County (45005) | 7,661 | 10 | 317,594 | D | 0 |
| Bamberg County (45009) | 13,042 | 17 | 270,232 | C | 0 |
| Barnwell County (45011) | 20,521 | 21 | 323,329 | D | 0 |
| Calhoun County (45017) | 14,182 | 12 | 369,550 | C | 0 |
| Cherokee County (45021) | 56,647 | 47 | 749,572 | D | 23 |
| Chester County (45023) | 32,182 | 30 | 559,854 | D | 16 |
| Chesterfield County (45025) | 43,784 | 38 | 814,387 | C | 10 |
| Clarendon County (45027) | 30,986 | 28 | 508,784 | C | 5 |
| Colleton County (45029) | 38,783 | 33 | 1,824,477 | C | 14 |
| Darlington County (45031) | 62,558 | 57 | 845,357 | C | 37 |
| Dillon County (45033) | 27,862 | 28 | 711,783 | C | 13 |
| Edgefield County (45037) | 27,476 | 21 | 851,626 | D | 4 |
| Fairfield County (45039) | 20,550 | 21 | 515,340 | C | 10 |
| Georgetown County (45043) | 64,811 | 52 | 1,037,974 | C | 32 |
| Greenwood County (45047) | 69,489 | 56 | 789,229 | D | 41 |
| Hampton County (45049) | 18,254 | 19 | 546,581 | C | 0 |
| Jasper County (45053) | 32,166 | 21 | 1,485,985 | C | 1 |
| Kershaw County (45055) | 68,314 | 48 | 557,809 | C | 29 |
| Laurens County (45059) | 68,666 | 57 | 1,589,018 | C | 28 |
| Lee County (45061) | 16,166 | 20 | 365,322 | C | 0 |
| McCormick County (45065) | 9,760 | 9 | 701,421 | D | 0 |
| Marion County (45067) | 28,664 | 31 | 627,647 | C | 20 |
| Marlboro County (45069) | 25,975 | 25 | 788,261 | C | 13 |
| Newberry County (45071) | 38,435 | 31 | 838,083 | D | 15 |
| Oconee County (45073) | 80,469 | 58 | 1,547,410 | C | 30 |
| Orangeburg County (45075) | 83,253 | 83 | 943,961 | C | 36 |
| Saluda County (45081) | 19,131 | 16 | 677,032 | D | 1 |
| Union County (45087) | 26,885 | 26 | 637,002 | D | 15 |
| Williamsburg County (45089) | 30,282 | 35 | 573,297 | C | 9 |
| **30 counties** | **1,101,374** | **971** | **23,240,848** | 19 C, 11 D | 409 |

- OpenStreetMap: the South Carolina cut of the 21 Nov 2026 `us-south-latest.osm.pbf` (see Alabama: 188 s, peak osmium memory
  4.13 GB, 250 MB; data timestamp 2026-11-21T01:28:06Z). Build: fetch 14-37 s, build 127-271 s per county, three at a time
  (the Mississippi checks, tests and the Florida builds ran alongside), about 34 min from the first county to the last.
- Bus frequency: 15 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 15 have values. Rail distance: 20 counties have none; 10 have values.
- Census spot check: 30 counties, 720 of 720 values equal (0% mismatch). Tract-median flags: 30 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: South Carolina has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no SC); all 30
  files say "Not connected for South Carolina yet: crash gaps are not scored and crash-based projects are not proposed". No
  crash counts were built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. No corridor stop's flag needed changing.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. Kershaw (45055) 8,412 = 8,412 roads, 35 = 35 bus stops; Hampton (45049, on the Savannah
  River and the Georgia line) 3,888 = 3,888 roads, 0 = 0 bus stops (0 missing, 0 extra in both, so no comparison limited to
  the state was needed). The extract's snapshot is 2026-11-21T01:28:06Z.
- Live check from R2 (`LIVE_PORT=9221`): Newberry (45071) and Kershaw (45055), 3 points each (picked with seed 20261123 from
  the state's sorted list). Neither county has a parcel service on the page, so the house-panel rows (Census area, HUD
  rent, FEMA, USGS) are not checkable; neighborhood, canopy, canopy goal, crash text, state laws and console pass at all 6
  points (30 pass, 0 fail, 24 not checkable). Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,791,948,733 bytes (3,027 objects); dry run "31 files, net +0.023 GB, projected 1.815 GB"; after
  1,815,197,167 bytes (3,057 objects): 23,248,434 bytes added (the 30 data files, 23,240,848, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_sc_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_45055_2026-11-22.json`,
`..._45049_...`, `data/backtests/live_check_panels_2026-11-22_southeast_sc.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Florida (31 of 31 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Baker County (12003) | 28,430 | 13 | 121,937 | D | 8 |
| Bradford County (12007) | 27,885 | 19 | 143,991 | C | 11 |
| Calhoun County (12013) | 13,492 | 11 | 152,360 | D | 0 |
| Columbia County (12023) | 71,789 | 43 | 270,861 | D | 28 |
| DeSoto County (12027) | 35,386 | 26 | 174,152 | D | 20 |
| Dixie County (12029) | 17,058 | 13 | 446,406 | D | 0 |
| Franklin County (12037) | 12,553 | 13 | 267,177 | D | 0 |
| Gadsden County (12039) | 43,710 | 37 | 558,110 | D | 10 |
| Gilchrist County (12041) | 19,040 | 13 | 96,550 | D | 0 |
| Glades County (12043) | 12,563 | 12 | 152,836 | C | 4 |
| Gulf County (12045) | 15,131 | 14 | 191,922 | D | 0 |
| Hamilton County (12047) | 13,616 | 13 | 158,976 | D | 0 |
| Hardee County (12049) | 25,675 | 21 | 114,011 | D | 11 |
| Hendry County (12051) | 42,382 | 26 | 296,301 | C | 21 |
| Holmes County (12059) | 19,513 | 17 | 218,790 | D | 0 |
| Jackson County (12063) | 48,250 | 40 | 368,308 | D | 8 |
| Jefferson County (12065) | 15,091 | 14 | 442,616 | D | 0 |
| Lafayette County (12067) | 8,161 | 7 | 97,407 | D | 0 |
| Levy County (12075) | 45,391 | 35 | 807,151 | D | 0 |
| Liberty County (12077) | 7,687 | 8 | 300,533 | C | 0 |
| Madison County (12079) | 18,089 | 16 | 157,523 | D | 0 |
| Monroe County (12087) | 81,860 | 71 | 2,644,116 | C | 60 |
| Nassau County (12089) | 97,859 | 62 | 1,456,335 | C | 38 |
| Okeechobee County (12093) | 40,816 | 31 | 156,882 | C | 24 |
| Putnam County (12107) | 75,164 | 57 | 419,130 | C | 23 |
| Suwannee County (12121) | 45,342 | 31 | 197,395 | D | 10 |
| Taylor County (12123) | 21,503 | 21 | 411,812 | C | 13 |
| Union County (12125) | 15,701 | 10 | 115,732 | D | 0 |
| Wakulla County (12129) | 35,387 | 23 | 307,322 | D | 9 |
| Walton County (12131) | 82,948 | 54 | 534,204 | C | 33 |
| Washington County (12133) | 25,529 | 17 | 315,219 | D | 0 |
| **31 counties** | **1,063,001** | **788** | **12,096,065** | 10 C, 21 D | 331 |

- OpenStreetMap: Florida counties read the file the registry names for each county, from openstreetmap.fr, each downloaded
  once and shared: `florida-latest.osm.pbf` (9 counties; 714,596,697 bytes; data timestamp 2026-11-21T01:05:35Z) or a
  sub-region file (northwest 6 counties, northeast 5, panhandle 4, gatorland 2, southwest 2, suncoast 2, treasure_coast 1;
  timestamps 21 Nov 2026 between 01:02:35Z and 01:04:36Z); each county's sources list names its own. Build: fetch 20-81 s,
  build 25-1,153 s per county, three at a time (the Mississippi and South Carolina checks, tests and the North Carolina
  builds ran alongside); the 9 counties that clip the whole-state file took 446-1,153 s each, the
  others 25-331 s; about 52 min from the first county to the last.
- Bus frequency: 24 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 7 have values. Rail distance: 27 counties have none; 4 have values.
- Census spot check: 31 counties, 744 of 744 values equal (0% mismatch). Tract-median flags: 31 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Florida has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no FL); all 31 files say
  "Not connected for Florida yet: crash gaps are not scored and crash-based projects are not proposed". No crash counts were
  built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. No corridor stop's flag needed changing.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to some tries first. Levy (12075) 8,573 = 8,573 roads, 23 = 23 bus stops (0 missing, 0 extra). Jefferson
  (12065): bus stops 0 = 0; **roads 2,670 on Overpass, 2,642 in the extract (28 only on Overpass, 0 only in the extract)**:
  Jefferson County lies on the Georgia line and its box reaches into Georgia. With the Overpass query limited to Florida's
  area (same box, classes and extract; `area["ISO3166-2"="US-FL"]`, result in `southeast_osm_xcheck_state_12065_...json`):
  2,631 on Overpass, 2,642 in the extract, 0 only on Overpass, 11 only in the extract. Located with TIGERweb (centre point of
  each way): all 28 Overpass-only ways are in Georgia (Thomas County 21, Brooks County 7), and the 11 extract-only ways
  are Georgia-centred ways that cross the line and are kept whole (Thomas 9, Brooks 2). Inside Florida every road matches
  and the only bus-stop count is 0 = 0. The extract's snapshot is 2026-11-21T01:05:35Z.
- Live check from R2 (`LIVE_PORT=9221`): Putnam (12107) and Levy (12075), 3 points each (picked with seed 20261123 from the
  state's sorted list). Florida's parcel service is on the page: 5 of the 6 points had the house panel on live parcel
  records (Census area, HUD rent, FEMA and USGS rows checked against the sources); at Levy 120759707002 the parcel service
  did not answer, so that point's house rows are not checkable. **Two USGS elevation rows first showed "Not available (the
  service did not answer in time)" (Levy 120759706004, Putnam 121079514023); the page's USGS call has a 6 s limit.** Re-opened
  alone, Levy's row then showed 74 ft (USGS now 74 ft) and passed (its first try is kept in the result file as
  `usgs_first`); Putnam's re-open found no row ("row missing"), so the whole county was run again as a separate check
  (`..._southeast_fl_rerun12107.json`): all 3 points, 27 of 27 checks pass, with the elevation rows equal to USGS's. In the
  main result file: 49 pass, 3 recorded failures (those two rows' first tries and Putnam's failed re-open, listed above),
  4 not checkable. No wrong value was shown anywhere: where the service did not answer the page said "Not available".
  Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,815,197,167 bytes (3,057 objects); dry run "32 files, net +0.012 GB, projected 1.827 GB"; after
  1,827,301,037 bytes (3,088 objects): 12,103,870 bytes added (the 31 data files, 12,096,065, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_fl_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_12075_2026-11-22.json`,
`..._12065_...`, `data/backtests/southeast_osm_xcheck_state_12065_2026-11-22.json`,
`data/backtests/live_check_panels_2026-11-22_southeast_fl.json`, `..._southeast_fl_rerun12107.json`,
`data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## North Carolina (71 of 71 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Alexander County (37003) | 36,412 | 25 | 410,605 | D | 4 |
| Alleghany County (37005) | 11,174 | 11 | 408,205 | D | 0 |
| Anson County (37007) | 22,289 | 20 | 564,408 | D | 8 |
| Ashe County (37009) | 26,950 | 26 | 896,496 | D | 0 |
| Avery County (37011) | 17,680 | 16 | 699,016 | D | 0 |
| Beaufort County (37013) | 44,499 | 40 | 617,183 | D | 16 |
| Bertie County (37015) | 17,170 | 20 | 544,938 | D | 0 |
| Bladen County (37017) | 29,566 | 30 | 666,791 | D | 0 |
| Burke County (37023) | 87,795 | 61 | 1,292,897 | D | 46 |
| Caldwell County (37027) | 80,536 | 63 | 885,786 | D | 49 |
| Camden County (37029) | 10,927 | 6 | 458,452 | D | 2 |
| Carteret County (37031) | 69,148 | 63 | 986,830 | D | 45 |
| Caswell County (37033) | 22,404 | 18 | 418,563 | C | 2 |
| Chatham County (37037) | 80,151 | 58 | 1,083,465 | C | 24 |
| Cherokee County (37039) | 29,562 | 27 | 1,092,249 | C | 0 |
| Chowan County (37041) | 13,836 | 14 | 224,414 | D | 6 |
| Clay County (37043) | 11,610 | 8 | 690,151 | D | 0 |
| Columbus County (37047) | 50,140 | 48 | 606,953 | D | 9 |
| Currituck County (37053) | 30,601 | 18 | 436,382 | D | 1 |
| Dare County (37055) | 37,875 | 34 | 536,971 | D | 21 |
| Davie County (37059) | 44,122 | 27 | 517,602 | C | 12 |
| Duplin County (37061) | 49,335 | 57 | 656,651 | D | 0 |
| Edgecombe County (37065) | 48,736 | 47 | 525,568 | C | 33 |
| Franklin County (37069) | 74,386 | 41 | 1,134,607 | C | 10 |
| Gates County (37073) | 10,376 | 10 | 219,234 | D | 0 |
| Graham County (37075) | 8,072 | 9 | 725,813 | C | 0 |
| Granville County (37077) | 60,877 | 39 | 831,769 | C | 20 |
| Greene County (37079) | 20,486 | 14 | 251,610 | D | 0 |
| Halifax County (37083) | 47,675 | 51 | 788,719 | C | 26 |
| Haywood County (37087) | 62,662 | 54 | 1,623,766 | C | 46 |
| Hertford County (37091) | 19,908 | 20 | 330,941 | D | 7 |
| Hoke County (37093) | 53,835 | 34 | 709,111 | C | 24 |
| Hyde County (37095) | 4,592 | 8 | 465,303 | D | 0 |
| Jackson County (37099) | 43,771 | 27 | 1,608,193 | C | 16 |
| Jones County (37103) | 9,302 | 7 | 692,765 | C | 0 |
| Lee County (37105) | 65,816 | 40 | 576,660 | D | 31 |
| Lenoir County (37107) | 54,919 | 49 | 497,967 | D | 29 |
| Lincoln County (37109) | 92,716 | 51 | 512,713 | D | 25 |
| McDowell County (37111) | 44,817 | 33 | 897,167 | C | 20 |
| Macon County (37113) | 37,941 | 28 | 1,231,628 | C | 17 |
| Madison County (37115) | 21,867 | 17 | 971,709 | D | 0 |
| Martin County (37117) | 21,644 | 22 | 490,989 | D | 8 |
| Mitchell County (37121) | 14,992 | 11 | 683,293 | D | 0 |
| Montgomery County (37123) | 26,007 | 22 | 726,958 | D | 0 |
| Nash County (37127) | 96,216 | 72 | 965,013 | C | 45 |
| Northampton County (37131) | 16,931 | 23 | 700,050 | D | 5 |
| Pamlico County (37137) | 12,390 | 18 | 384,219 | D | 0 |
| Pasquotank County (37139) | 40,834 | 32 | 360,251 | D | 22 |
| Pender County (37141) | 65,550 | 35 | 908,300 | C | 14 |
| Perquimans County (37143) | 13,244 | 15 | 274,836 | D | 0 |
| Person County (37145) | 39,542 | 26 | 406,514 | D | 14 |
| Polk County (37149) | 19,891 | 18 | 443,840 | D | 4 |
| Richmond County (37153) | 42,344 | 42 | 689,203 | C | 32 |
| Rockingham County (37157) | 92,131 | 70 | 763,861 | D | 47 |
| Rutherford County (37161) | 64,930 | 57 | 915,704 | D | 27 |
| Sampson County (37163) | 59,470 | 49 | 794,219 | D | 12 |
| Scotland County (37165) | 33,590 | 27 | 421,331 | C | 18 |
| Stanly County (37167) | 64,651 | 47 | 749,920 | D | 23 |
| Stokes County (37169) | 45,139 | 32 | 622,297 | D | 7 |
| Surry County (37171) | 71,425 | 63 | 891,912 | D | 21 |
| Swain County (37173) | 14,013 | 11 | 1,354,439 | C | 0 |
| Transylvania County (37175) | 33,691 | 32 | 1,025,051 | D | 18 |
| Tyrrell County (37177) | 3,423 | 5 | 246,396 | D | 0 |
| Vance County (37181) | 42,322 | 35 | 375,596 | D | 25 |
| Warren County (37185) | 18,795 | 15 | 398,652 | D | 0 |
| Washington County (37187) | 10,812 | 15 | 203,863 | D | 0 |
| Watauga County (37189) | 55,123 | 32 | 936,415 | D | 19 |
| Wilkes County (37193) | 65,935 | 55 | 1,177,166 | D | 28 |
| Wilson County (37195) | 79,290 | 65 | 516,787 | C | 45 |
| Yadkin County (37197) | 37,574 | 29 | 527,554 | D | 0 |
| Yancey County (37199) | 18,797 | 10 | 570,537 | D | 0 |
| **71 counties** | **2,827,232** | **2,254** | **48,815,417** | 21 C, 50 D | 983 |

- OpenStreetMap: North Carolina counties read the file the registry names for each county, from openstreetmap.fr, each
  downloaded once and shared: `northeast` (16 counties), `northwest` (11), `western` (11), `north_central` (10),
  `south_central` (9), `southeast` (7), `piedmont_triad` (6) and `north-carolina-latest.osm.pbf` (1). Data timestamps: 21 Nov
  2026, 01:06:33Z (north_central, northwest, south_central), 01:07:35Z (northeast, piedmont_triad, southeast, western) and
  01:05:35Z (the whole-state file); each county's sources list names its own. Build: fetch 20-110 s, build 21-294 s per
  county, three at a time (the Florida checks, tests and uploads ran alongside), about 32 min from the first county to the
  last.
- Bus frequency: 56 counties have no value in any block group (no feed that is read has a stop with 7-9 am departures in or
  near the county); 15 have values. Rail distance: 65 counties have none; 6 have values.
- Census spot check: 71 counties, 1,700 of 1,700 values equal (0% mismatch). Tract-median flags: 71 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: North Carolina has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no NC); all 71
  files say "Not connected for North Carolina yet: crash gaps are not scored and crash-based projects are not proposed". No
  crash counts were built.
- Tests run: `npm test` 1,632 of 1,632 (46 files), `npm run typecheck` clean. No corridor stop's flag needed changing.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted
  list): it answered 504 to many tries first (Hertford's road query needed about 50 minutes of retries). Both counties lie on the
  Virginia line, so their boxes reach into Virginia and into neighbouring North Carolina counties that the sub-region file
  does not hold; run as the script is, both differ in roads and match in bus stops. **Warren (37185): roads 2,567 on
  Overpass, 2,205 in the extract (362 only on Overpass, 0 only in the extract); bus stops 0 = 0. Hertford (37091): roads
  1,929 on Overpass, 1,885 in the extract (44 only on Overpass, 0 only in the extract); bus stops 0 = 0.** Looked at where
  the differing roads are, with the same box, classes and extract and the Overpass query limited to North Carolina's area
  (`area["ISO3166-2"="US-NC"]`, results `southeast_osm_xcheck_state_37185_...json` and `..._37091_...json`):
  *Hertford:* 1,872 on Overpass in North Carolina, 1,885 in the extract, **0 only on Overpass**, 13 only in the extract; all
  44 roads only on Overpass lie in Virginia (Southampton County 24, Suffolk city 20), and the 13 extract-only ways are
  Virginia-centred ways that cross the line and are kept whole (Southampton 9, Suffolk 4). *Warren:* 2,378 on Overpass in
  North Carolina, 2,205 in the extract, 211 only on Overpass and 38 only in the extract. Located with TIGERweb (centre
  point of each way): the 211 are in Halifax County (175) and Northampton County (34), beyond the edge of the sub-region
  file in the box's margin, 1 in Brunswick County, Virginia (a way across the line) and **1 in Warren County itself: way
  1582919770, version 1, created 2026-11-21T21:02:48Z, about 20 hours after the extract's snapshot (2026-11-21T01:06:33Z),
  so a road added since**; the 38 extract-only ways are Virginia-centred ways that cross the line (Mecklenburg County 20,
  Brunswick County 17) and 1 in Warren County (way 18895937, Birdsong Road, version 3 of 2013, at the state line), which
  is in the box's full Overpass answer (0 only in the extract there) and is left out only by the state-area filter. The
  other 151 of Warren's 362 are outside North Carolina (362 minus 211) and were not located one by one. So: inside both
  counties every road and bus stop matches, except one road in Warren added to OpenStreetMap after the extract was made;
  what is otherwise missing is the roads of Virginia and of the neighbouring counties in the box's margin.
- Live check from R2 (`LIVE_PORT=9221`): Vance (37181) and Davie (37059), 3 points each (picked with seed 20261123 from the
  state's sorted list). North Carolina's parcel service is on the page: all six points had the house panel on live parcel
  records and pass every check (neighborhood, canopy, canopy goal, crash text, state laws, Census area, HUD rent, FEMA,
  USGS, console), with one exception on the first try: **Davie 370590807011's USGS elevation row first showed "Not
  available (the service did not answer in time)"** (the page's 6 s limit); re-opened alone it showed 778 ft, equal to
  USGS's 778 ft, and passed (the first try is kept in the result file as `usgs_first`). 54 pass, 1 recorded failure (that
  first try), 0 not checkable. No wrong value was shown. Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,827,301,037 bytes (3,088 objects); dry run "72 files, net +0.049 GB, projected 1.876 GB"; after
  1,876,134,325 bytes (3,159 objects): 48,833,288 bytes added (the 71 data files, 48,815,417, plus the larger
  `manifest.json`).

Files: `data/backtests/southeast_nc_census_spot_2026-11-22.json`, `data/backtests/southeast_osm_xcheck_37185_2026-11-22.json`,
`..._37091_...`, `data/backtests/southeast_osm_xcheck_state_37185_2026-11-22.json`,
`data/backtests/live_check_panels_2026-11-22_southeast_nc.json`, `data/backtests/acs_fallback_mismatches_2026-11-22.json`.

## Tests and housekeeping

- `npm test`: run in full after each state (1,632 of 1,632 in 46 files each time; no state added or removed a test);
  `npm run typecheck` clean after each. The full browser suite on the final tree: `PW_PORT=9222 npm run test:e2e -- --trace
  off`, run once after the North Carolina commit (all six states in): 93 of 93 passed (8.5 min). `python3 scripts/r2_only.py --check`
  passes. No test was skipped or loosened and no test pin was changed (none of the six states has a crash source, so
  `tests/unit/crashCountsInvariant.test.ts` was not touched). No pipeline code was changed.
- `app/data/hud_income_limits.json`: 393 rows added from HUD's API (none failed; the test lets only New England counties
  fail). Rows already in the file were not changed; `_source.added_for_new_counties` records each state's addition.
- `app/data/intercity_transit_corridors.json`: three stops' `county_on_page` flags (Bay St. Louis MS in Hancock County,
  Meridian MS in Lauderdale, Vicksburg MS in Warren) now say true, in the Mississippi commit. No Georgia, Alabama, South
  Carolina, Florida or North Carolina stop needed a change.
- The 1,381 earlier R2-only files were downloaded from the bucket's public address into this worktree's `counties/` (ignored
  by version control) so that `build_tree_equity_2025.py`, `build_acs_fallback_flags.py` and `build_county_completeness.py`
  could run; the 393 new files are in `counties/` here too and not committed.
- No `sites_` files were built (as for every small-county batch: `w5/tools/sites.py` needs the old build machine's paths).
- The Overpass mirror (maps.mail.ru, the only one reachable from here) answered 504 for long stretches: the Georgia check was
  still open when Georgia was committed (its results were added in the next commit), and Hertford's road query needed about
  50 minutes of retries. All twelve checks were completed; none is open.
- Scratch use: the scratch folder for this job held the national ACS tables (0.65 GB), the 4.6 GB `us-south` file (from the
  download until the Alabama, Mississippi and South Carolina cuts were made, then deleted at once instead of at the end),
  one state's sub-region files and one state's build folders. I did not measure the folder at its peak (the regional file
  and Georgia's build folders were on disk together); the disk's used space had grown by 6 GB at that moment (which
  includes the downloaded county files and other sessions' work), and free space was never below 7.2 GB at any of the times I read it (stop: 6 GB). The
  folder measured 6.7 GB at its largest later measurement (North Carolina's build folders). Each state's build folders were
  deleted after its checks, except the two counties kept for its OpenStreetMap check.

## What is left

Counties still without a data file nationally: 628 (see the top of this page for the list by state). Not done here: Texas,
Virginia, Oklahoma, Arkansas, Colorado's remaining small counties, West Virginia and Louisiana, Hawaii (no extract in the
registry), and crash counts for all six states (no state source is wired into
`pipeline/region.py` for Georgia, Alabama, Mississippi, South Carolina, Florida or North Carolina).
