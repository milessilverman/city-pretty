# Small counties: Virginia, West Virginia and Colorado (23 Nov 2026), served from R2 only

(In progress: Virginia is built and checked; West Virginia and Colorado follow, one commit each. The summary tables, totals and
the browser-suite result are added when the last state is in.)

## Virginia (116 of 116 built, none withheld)

The 116 are 85 counties and 31 independent cities. Virginia's independent cities are county-equivalents with their own
five-digit codes (51510, 51550, 51650 and others were already built the same way: one file per city, named "<Name> city");
the registry, the ACS tables and the crash records treat them as counties, so they were built by the same steps. All 31 of
them had a "lots only" tag in `index.html` (`data-coverage="lots"`, no data file) and a placeholder "none" row in
`county_completeness.json`; the export script turned each tag into a data tag (as it was written to do) and the 31
placeholder rows were replaced by the real ones (85 rows added, 31 replaced, no other row changed).

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Accomack County (51001) | 33,335 | 35 | 810,613 | C | 4 |
| Alleghany County (51005) | 14,859 | 15 | 505,095 | C | 10 |
| Amelia County (51007) | 13,462 | 9 | 466,459 | C | 0 |
| Amherst County (51009) | 31,485 | 23 | 710,043 | C | 11 |
| Appomattox County (51011) | 16,610 | 12 | 356,465 | D | 0 |
| Augusta County (51015) | 78,033 | 56 | 879,952 | C | 17 |
| Bath County (51017) | 4,100 | 5 | 415,083 | C | 0 |
| Bedford County (51019) | 80,894 | 55 | 1,454,135 | C | 25 |
| Bland County (51021) | 6,199 | 6 | 482,203 | C | 0 |
| Botetourt County (51023) | 34,004 | 26 | 1,019,458 | C | 15 |
| Brunswick County (51025) | 15,841 | 16 | 502,749 | C | 0 |
| Buchanan County (51027) | 19,415 | 24 | 569,251 | C | 0 |
| Buckingham County (51029) | 16,976 | 12 | 437,785 | C | 0 |
| Campbell County (51031) | 55,312 | 25 | 831,554 | C | 17 |
| Caroline County (51033) | 32,098 | 19 | 523,452 | C | 0 |
| Carroll County (51035) | 29,157 | 25 | 850,998 | C | 1 |
| Charles City County (51036) | 6,627 | 6 | 227,042 | C | 0 |
| Charlotte County (51037) | 11,422 | 10 | 825,749 | C | 0 |
| Clarke County (51043) | 15,216 | 11 | 288,185 | C | 0 |
| Craig County (51045) | 4,856 | 4 | 448,274 | C | 0 |
| Culpeper County (51047) | 54,397 | 27 | 699,672 | C | 16 |
| Cumberland County (51049) | 9,818 | 8 | 264,096 | C | 2 |
| Dickenson County (51051) | 13,733 | 16 | 431,146 | C | 0 |
| Dinwiddie County (51053) | 28,191 | 20 | 529,377 | C | 7 |
| Essex County (51057) | 10,623 | 9 | 435,823 | C | 0 |
| Fauquier County (51061) | 74,577 | 42 | 871,542 | C | 20 |
| Floyd County (51063) | 15,593 | 12 | 740,712 | C | 0 |
| Fluvanna County (51065) | 28,092 | 16 | 278,397 | C | 6 |
| Franklin County (51067) | 55,130 | 42 | 1,322,622 | C | 9 |
| Frederick County (51069) | 95,008 | 55 | 573,709 | C | 40 |
| Giles County (51071) | 16,557 | 15 | 443,667 | C | 0 |
| Gloucester County (51073) | 39,526 | 23 | 525,151 | C | 8 |
| Goochland County (51075) | 26,410 | 16 | 488,392 | C | 4 |
| Grayson County (51077) | 15,287 | 15 | 848,177 | C | 2 |
| Greene County (51079) | 21,155 | 12 | 194,135 | C | 0 |
| Greensville County (51081) | 11,275 | 8 | 459,118 | C | 5 |
| Halifax County (51083) | 33,639 | 31 | 1,048,529 | C | 11 |
| Henry County (51089) | 49,980 | 45 | 686,088 | C | 29 |
| Highland County (51091) | 2,296 | 3 | 323,191 | D | 0 |
| Isle of Wight County (51093) | 39,974 | 25 | 1,025,943 | C | 14 |
| James City County (51095) | 81,013 | 44 | 509,161 | C | 41 |
| King and Queen County (51097) | 6,695 | 5 | 516,518 | C | 0 |
| King George County (51099) | 27,896 | 15 | 204,779 | D | 0 |
| King William County (51101) | 18,593 | 11 | 543,483 | C | 0 |
| Lancaster County (51103) | 10,936 | 13 | 266,721 | D | 0 |
| Lee County (51105) | 21,900 | 24 | 491,817 | C | 0 |
| Louisa County (51109) | 39,980 | 24 | 386,312 | D | 0 |
| Lunenburg County (51111) | 12,016 | 10 | 488,576 | C | 0 |
| Madison County (51113) | 14,044 | 7 | 339,104 | C | 0 |
| Mathews County (51115) | 8,540 | 9 | 203,003 | D | 0 |
| Mecklenburg County (51117) | 30,516 | 29 | 817,396 | D | 8 |
| Middlesex County (51119) | 10,847 | 13 | 178,430 | D | 0 |
| Montgomery County (51121) | 99,101 | 64 | 808,614 | C | 55 |
| Nelson County (51125) | 14,732 | 12 | 605,356 | C | 0 |
| New Kent County (51127) | 25,105 | 12 | 280,885 | C | 0 |
| Northampton County (51131) | 12,059 | 14 | 607,639 | C | 0 |
| Northumberland County (51133) | 12,188 | 14 | 371,893 | D | 0 |
| Nottoway County (51135) | 15,597 | 16 | 304,887 | C | 0 |
| Orange County (51137) | 37,822 | 19 | 444,457 | C | 9 |
| Page County (51139) | 23,727 | 21 | 450,326 | C | 7 |
| Patrick County (51141) | 17,512 | 17 | 636,475 | D | 0 |
| Pittsylvania County (51143) | 59,856 | 50 | 1,188,967 | C | 12 |
| Powhatan County (51145) | 31,555 | 16 | 485,246 | C | 1 |
| Prince Edward County (51147) | 21,996 | 17 | 367,723 | C | 8 |
| Prince George County (51149) | 43,146 | 23 | 412,092 | C | 16 |
| Pulaski County (51155) | 33,687 | 32 | 502,427 | C | 22 |
| Rappahannock County (51157) | 7,427 | 6 | 392,311 | D | 0 |
| Richmond County (51159) | 9,095 | 6 | 332,730 | C | 0 |
| Roanoke County (51161) | 97,023 | 58 | 1,000,517 | C | 54 |
| Rockbridge County (51163) | 22,531 | 18 | 647,701 | C | 6 |
| Rockingham County (51165) | 85,600 | 58 | 824,229 | C | 35 |
| Russell County (51167) | 25,538 | 29 | 813,613 | C | 2 |
| Scott County (51169) | 21,479 | 20 | 482,268 | C | 2 |
| Shenandoah County (51171) | 44,925 | 29 | 580,244 | C | 9 |
| Smyth County (51173) | 29,420 | 29 | 629,868 | C | 15 |
| Southampton County (51175) | 17,964 | 12 | 852,737 | C | 2 |
| Surry County (51181) | 6,549 | 7 | 473,321 | C | 0 |
| Sussex County (51183) | 10,765 | 11 | 636,617 | C | 0 |
| Tazewell County (51185) | 39,624 | 38 | 631,296 | C | 27 |
| Warren County (51187) | 41,531 | 28 | 430,809 | C | 19 |
| Washington County (51191) | 53,926 | 39 | 817,220 | C | 22 |
| Westmoreland County (51193) | 18,826 | 17 | 298,947 | C | 4 |
| Wise County (51195) | 35,448 | 29 | 600,362 | C | 13 |
| Wythe County (51197) | 28,188 | 24 | 771,823 | C | 11 |
| York County (51199) | 71,005 | 42 | 846,370 | C | 39 |
| Bristol city (51520) | 16,849 | 15 | 115,995 | C | 15 |
| Buena Vista city (51530) | 6,593 | 5 | 85,384 | C | 5 |
| Charlottesville city (51540) | 45,437 | 38 | 151,496 | C | 38 |
| Colonial Heights city (51570) | 18,352 | 12 | 123,093 | C | 12 |
| Covington city (51580) | 5,680 | 6 | 86,655 | C | 6 |
| Danville city (51590) | 42,214 | 38 | 253,993 | C | 37 |
| Emporia city (51595) | 5,547 | 7 | 61,709 | C | 7 |
| Fairfax city (51600) | 25,026 | 17 | 214,150 | C | 17 |
| Falls Church city (51610) | 14,710 | 10 | 168,633 | C | 10 |
| Franklin city (51620) | 8,250 | 6 | 60,392 | D | 6 |
| Fredericksburg city (51630) | 28,873 | 20 | 183,065 | C | 20 |
| Galax city (51640) | 6,726 | 8 | 94,938 | C | 8 |
| Harrisonburg city (51660) | 51,392 | 33 | 150,062 | C | 33 |
| Hopewell city (51670) | 22,959 | 18 | 105,361 | C | 18 |
| Lexington city (51678) | 7,525 | 6 | 62,810 | C | 6 |
| Lynchburg city (51680) | 79,497 | 58 | 344,616 | C | 58 |
| Manassas city (51683) | 42,976 | 26 | 227,682 | C | 26 |
| Manassas Park city (51685) | 16,798 | 9 | 144,782 | C | 9 |
| Martinsville city (51690) | 13,658 | 15 | 113,484 | C | 15 |
| Norton city (51720) | 3,577 | 4 | 92,281 | C | 4 |
| Petersburg city (51730) | 33,537 | 31 | 198,497 | C | 31 |
| Poquoson city (51735) | 12,639 | 11 | 168,514 | C | 10 |
| Portsmouth city (51740) | 97,190 | 83 | 493,716 | C | 83 |
| Radford city (51750) | 16,726 | 11 | 76,596 | C | 11 |
| Roanoke city (51770) | 98,355 | 77 | 453,491 | C | 77 |
| Salem city (51775) | 25,618 | 20 | 172,526 | C | 20 |
| Staunton city (51790) | 25,948 | 20 | 140,723 | C | 20 |
| Suffolk city (51800) | 98,796 | 84 | 756,895 | C | 61 |
| Waynesboro city (51820) | 22,841 | 17 | 147,296 | C | 17 |
| Williamsburg city (51830) | 15,798 | 9 | 164,245 | C | 9 |
| Winchester city (51840) | 27,913 | 25 | 133,077 | C | 25 |
| **116 counties** | **3,497,085** | **2,604** | **55,015,459** | 104 C, 12 D | 1426 |

- OpenStreetMap: Virginia counties read the file the registry names for each county, from openstreetmap.fr, each downloaded
  once and shared: `salem` (23 counties), `richmond` (21), `appomattox` (18), `wytheville` (17), `chesapeake` (17),
  `culpeper` (14), `fairfax` (4) and `virginia-latest.osm.pbf` (2). Data timestamps: 21 Nov 2026, 01:05:35Z (salem,
  chesapeake), 01:06:33Z (appomattox, culpeper, fairfax, richmond, wytheville) and 01:07:35Z (the whole-state file); each
  county's sources list names its own. Build: fetch 16-109 s, build 16-190 s per county, one at a time (this job's brief
  rules out parallel builds), about 2.3 hours from the first county to the last.
- Bus frequency: 14 counties have no value in any block group; 102 have values. Rail distance: 82 counties have none; 34
  have values.
- Census spot check: 116 counties, 2,744 of 2,744 values equal (0% mismatch). Tract-median flags: 116 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- **Crash counts (Virginia DOT, the state source `pipeline/region.py` STATE_DEFAULTS holds for VA):** all 116 files list
  "Virginia DOT crash records 2017-2025" as loaded (0 counties without it). The report total in each file is for the
  county's box (the block groups plus a margin), so a small county's total includes crashes just over its border. Reports
  per resident over the nine years (median; lowest; highest): the 31 cities 0.262 (0.055; 0.490), the 85 counties 0.299
  (0.110; 1.667); the extremes are as the source returns them and were not examined further. Per block group a crash counts
  only if it is inside it or within 10 m. `scripts/build_state_crash_counts.py` (boundary rule, 1/k weighting, 2023-2025
  layers) wrote `app/data/crash_counts/` for all 116 (2,604 block groups); `scripts/recompute_crash_gaps.py` found 299
  pedestrian/cyclist gaps and 390 strengths, dropped 4,370 crash-dependent improvement rows that the rebuilt counts no
  longer support, added 0 and re-sized 186 (as for the 17 earlier Virginia counties, Virginia's pedestrian and bicycle flags
  are not a lower bound, so rows may be dropped). The files' own earlier comparisons had 13 gaps and 31 strengths; of the
  13 block groups compared, 9 moved by 10 points or more. `tests/unit/crashCountsInvariant.test.ts` pinned Virginia at 17
  files and 327 outside California; it now pins 133 and 443 (the measured counts; the 116 new files pass its 1/k sum check).
  The pin was the only test that failed before the update (133 files found where 17 were expected); nothing was weakened.
- Tests run: `npm test` 2,085 of 2,085 (50 files), `npm run typecheck` clean.
- Corridor stops: six stops now say `county_on_page: true` (Charlottesville, Roanoke, Bristol, Bedford, Petersburg and
  Fredericksburg, Virginia; 6 lines).
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted list:
  Scott 51169 and Prince George 51149; the mirror answered 504 to many tries and each query was retried until it answered).
  Run as the script is, both differ in roads and match in bus stops, because their boxes (block groups plus 0.02 degree) reach
  into other states and counties that the sub-region file does not hold. **Scott (51169): roads 4,135 on Overpass, 3,405 in
  the extract (730 only on Overpass, 0 only in the extract); bus stops 0 = 0. Prince George (51149): roads 6,007 on Overpass,
  5,478 in the extract (529 only on Overpass, 0 only in the extract); bus stops 3 = 3.** Looked at where the differing roads
  are, with the same box, classes and extract and the Overpass query limited to Virginia's area
  (`area["ISO3166-2"="US-VA"]`): *Scott:* 3,267 on Overpass in Virginia, 3,405 in the extract, **0 only on Overpass**, 138
  only in the extract; located with TIGERweb (centre point of each way), the 138 are Tennessee- and Kentucky-centred ways
  that cross the line and are kept whole (Sullivan County TN 106, Hawkins TN 23, Hancock TN 7, Harlan KY 2). *Prince
  George:* 6,007 on Overpass in Virginia, 5,478 in the extract, 529 only on Overpass, 0 only in the extract; **none of the
  529 is in Prince George**: 393 are in Sussex County and 136 in Surry County, in the margin of the box beyond the edge of
  the `richmond` file. So inside both counties every road and bus stop matches.
- Live check from R2 (`LIVE_PORT=9271`): Galax city (51640) and Shenandoah County (51171), 3 points each (picked with seed
  20261123 from the state's sorted list). Virginia's parcel service is on the page: all six points had the house panel on
  live parcel records, and neighborhood, canopy, canopy goal, crash text (Galax 516400701012 counts [0, 0.5, 32.67], no
  comparison; Shenandoah 511710404001 counts [0, 5.5, 29.5], no comparison), state laws, Census area, HUD rent, FEMA and the
  console pass at all six. **USGS elevation: 5 of the 6 rows first showed "Not available (the service did not answer in
  time)" (the page's 6 s limit).** Re-opened alone several times, 3 later showed the elevation equal to USGS's (Galax
  2,465 ft and 2,443 ft; Shenandoah 947 ft); at the other 3 points (Galax 516400701014, Shenandoah 511710404001 and
  511710404002) USGS itself gave no answer when asked from here, so the page's "Not available" is the right text and the
  row is not checkable. 51 pass, 5 recorded first-try failures (the 5 USGS rows above, kept in
  `live_check_panels_2026-11-23_vawvco_va_first_try.json`), 3 not checkable. No wrong value was shown. Each data file came
  from the r2.dev address (HEAD 200, GET 200).
- R2: before 1,926,479,192 bytes (3,298 objects); dry run "117 files, net +0.055 GB, projected 1.981 GB"; right after the
  upload 1,981,492,955 bytes (3,414 objects): the 116 data files are 55,015,459 bytes, and `manifest.json` went from 668,080
  to 666,384 bytes (the other agent's manifest, which was in the bucket, was replaced by this branch's; see "Tests and
  housekeeping").

Files: `data/backtests/vawvco_va_census_spot_2026-11-23.json`, `data/backtests/vawvco_osm_xcheck_51169_2026-11-23.json`,
`..._51149_...`, `data/backtests/vawvco_osm_xcheck_state_51169_2026-11-23.json`, `..._51149_...`,
`data/backtests/vawvco_osm_locate_51169_2026-11-23.txt`, `..._51149_...`,
`data/backtests/live_check_panels_2026-11-23_vawvco_va.json` (and `..._first_try.json`),
`data/backtests/acs_fallback_mismatches_2026-11-23.json`.

## West Virginia (52 of 52 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Barbour County (54001) | 15,424 | 16 | 456,281 | C | 0 |
| Boone County (54005) | 21,026 | 17 | 378,272 | D | 0 |
| Braxton County (54007) | 12,208 | 13 | 395,265 | D | 0 |
| Brooke County (54009) | 21,805 | 20 | 169,561 | D | 15 |
| Cabell County (54011) | 92,739 | 89 | 526,667 | C | 84 |
| Calhoun County (54013) | 6,048 | 6 | 208,554 | D | 0 |
| Clay County (54015) | 7,835 | 7 | 277,974 | D | 0 |
| Doddridge County (54017) | 7,711 | 8 | 199,980 | D | 0 |
| Fayette County (54019) | 39,519 | 36 | 568,024 | C | 19 |
| Gilmer County (54021) | 7,288 | 10 | 337,872 | D | 0 |
| Grant County (54023) | 10,983 | 10 | 506,524 | D | 0 |
| Greenbrier County (54025) | 32,386 | 33 | 1,018,062 | C | 12 |
| Hampshire County (54027) | 23,465 | 26 | 539,131 | D | 0 |
| Hancock County (54029) | 28,431 | 27 | 177,331 | D | 19 |
| Hardy County (54031) | 14,243 | 13 | 447,831 | C | 0 |
| Harrison County (54033) | 64,984 | 60 | 449,737 | C | 44 |
| Jackson County (54035) | 27,705 | 23 | 326,851 | D | 0 |
| Jefferson County (54037) | 59,260 | 42 | 552,692 | C | 24 |
| Lewis County (54041) | 16,740 | 15 | 353,628 | D | 7 |
| Lincoln County (54043) | 19,902 | 21 | 395,452 | D | 0 |
| Logan County (54045) | 31,418 | 31 | 390,348 | D | 20 |
| McDowell County (54047) | 17,943 | 22 | 610,309 | D | 0 |
| Marion County (54049) | 55,909 | 61 | 446,813 | C | 47 |
| Marshall County (54051) | 29,865 | 32 | 264,201 | D | 24 |
| Mason County (54053) | 25,043 | 22 | 357,134 | D | 11 |
| Mercer County (54055) | 58,563 | 49 | 596,628 | C | 37 |
| Mineral County (54057) | 26,854 | 20 | 561,002 | C | 11 |
| Mingo County (54059) | 22,542 | 25 | 514,178 | D | 0 |
| Monroe County (54063) | 12,386 | 12 | 452,949 | C | 0 |
| Morgan County (54065) | 17,426 | 16 | 425,922 | C | 0 |
| Nicholas County (54067) | 24,277 | 19 | 738,159 | C | 0 |
| Ohio County (54069) | 41,582 | 51 | 218,536 | D | 41 |
| Pendleton County (54071) | 6,043 | 8 | 640,473 | D | 0 |
| Pleasants County (54073) | 7,521 | 7 | 129,819 | D | 0 |
| Pocahontas County (54075) | 7,784 | 10 | 838,785 | C | 0 |
| Preston County (54077) | 34,160 | 34 | 540,854 | C | 0 |
| Putnam County (54079) | 57,177 | 40 | 469,566 | D | 35 |
| Raleigh County (54081) | 73,195 | 56 | 791,445 | C | 39 |
| Randolph County (54083) | 27,576 | 28 | 1,221,891 | C | 17 |
| Ritchie County (54085) | 8,286 | 11 | 325,362 | D | 0 |
| Roane County (54087) | 13,786 | 16 | 282,209 | D | 0 |
| Summers County (54089) | 11,729 | 11 | 429,530 | C | 0 |
| Taylor County (54091) | 16,487 | 18 | 188,369 | C | 13 |
| Tucker County (54093) | 6,654 | 8 | 438,741 | C | 0 |
| Tyler County (54095) | 8,064 | 10 | 232,570 | D | 0 |
| Upshur County (54097) | 23,712 | 19 | 309,467 | C | 10 |
| Wayne County (54099) | 38,164 | 38 | 659,348 | C | 19 |
| Webster County (54101) | 8,144 | 8 | 481,324 | D | 0 |
| Wetzel County (54103) | 14,078 | 17 | 260,893 | D | 8 |
| Wirt County (54105) | 5,053 | 4 | 202,703 | D | 0 |
| Wood County (54107) | 83,407 | 72 | 431,377 | D | 61 |
| Wyoming County (54109) | 20,629 | 18 | 545,129 | C | 0 |
| **52 counties** | **1,365,159** | **1,285** | **23,281,723** | 23 C, 29 D | 617 |

- OpenStreetMap: West Virginia is `split: us-south/west-virginia` in the registry. `us-south-latest.osm.pbf` (4,624,950,259
  bytes, md5 `da655e384013439bc0ea8cd43eae8d9b`, equal to the published `us-south.osm.pbf.md5`; data timestamp
  2026-11-23T01:36:20Z from `us-south.state.txt`; the registry's own note for these counties says 2026-11-07, older) was
  downloaded once, cut into West Virginia's file with `national/osm_split.py us-south --states WV` (131 MB; 162 s, peak
  osmium 4.08 GB) and deleted. All 52 counties read that file. Build: fetch 14-73 s, build 67-80 s per county, one at a
  time, about 1.5 hours from the first county to the last.
- Bus frequency: 35 counties have no value in any block group; 17 have values. Rail distance: 43 counties have none; 9 have
  values.
- Census spot check: 52 counties, 1,240 of 1,240 values equal (0% mismatch). Tract-median flags: 52 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: West Virginia has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS holds IL, ME, PA, TN,
  UT and VA, not WV); all 52 files say "Not connected for West Virginia yet: crash gaps are not scored and crash-based
  projects are not proposed". No crash counts were built, so `tests/unit/crashCountsInvariant.test.ts` was not touched.
- Tests run: `npm test` 2,085 of 2,085 (50 files), `npm run typecheck` clean. No corridor stop needed a change.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; two counties picked with seed 20261122 from the state's sorted list:
  Putnam 54079 and Pendleton 54071). **Both exact: Putnam roads 6,948 = 6,948 and bus stops 9 = 9; Pendleton roads 2,304 =
  2,304 and bus stops 0 = 0; 0 only on Overpass and 0 only in the extract in each.** Their boxes lie inside West Virginia,
  so no state-line comparison was needed.
- Live check from R2 (`LIVE_PORT=9271`): Wetzel (54103) and Putnam (54079), 3 points each (picked with seed 20261123 from
  the state's sorted list). West Virginia's parcel service is on the page: all six points had the house panel on live
  parcel records and pass every check (neighborhood, canopy, canopy goal, crash text "no crash data for this county", state
  laws, Census area, HUD rent, FEMA, USGS, console), with two exceptions on the first try: **Wetzel 541030307004 and Putnam
  540790205005 first showed a USGS elevation of "Not available (the service did not answer in time)"** (the page's 6 s
  limit); re-opened alone they showed 647 ft and 589 ft, equal to USGS's, and passed (the first tries are kept in
  `live_check_panels_2026-11-23_vawvco_wv_first_try.json`). 54 pass, 2 recorded first-try failures, 0 not checkable. No wrong
  value was shown. Each data file came from the r2.dev address.
- R2: before 2,061,749,096 bytes (3,675 objects); dry run "53 files, net +0.023 GB, projected 2.085 GB"; right after the
  upload 2,084,976,473 bytes (3,727 objects): the 52 data files are 23,281,723 bytes, and `manifest.json` went from 733,803
  to 679,457 bytes (again the other agent's manifest replaced by this branch's; see "Tests and housekeeping").

Files: `data/backtests/vawvco_wv_census_spot_2026-11-23.json`, `data/backtests/vawvco_osm_xcheck_54079_2026-11-23.json`,
`..._54071_...`, `data/backtests/live_check_panels_2026-11-23_vawvco_wv.json` (and `..._first_try.json`),
`data/backtests/acs_fallback_mismatches_2026-11-23.json`.

## Colorado (53 of 53 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Alamosa County (08003) | 16,581 | 15 | 512,390 | D | 10 |
| Archuleta County (08007) | 13,900 | 14 | 1,352,674 | D | 9 |
| Baca County (08009) | 3,428 | 4 | 142,114 | D | 0 |
| Bent County (08011) | 5,549 | 5 | 184,288 | D | 0 |
| Broomfield County (08014) | 76,304 | 52 | 545,332 | C | 50 |
| Chaffee County (08015) | 20,178 | 15 | 1,254,833 | D | 11 |
| Cheyenne County (08017) | 1,741 | 2 | 126,049 | D | 0 |
| Clear Creek County (08019) | 9,262 | 11 | 341,192 | C | 0 |
| Conejos County (08021) | 7,530 | 6 | 885,867 | D | 0 |
| Costilla County (08023) | 3,607 | 4 | 823,234 | C | 0 |
| Crowley County (08025) | 5,647 | 4 | 81,337 | D | 0 |
| Custer County (08027) | 5,247 | 7 | 674,497 | D | 0 |
| Delta County (08029) | 31,598 | 26 | 1,359,843 | C | 7 |
| Dolores County (08033) | 2,432 | 3 | 1,057,037 | C | 0 |
| Eagle County (08037) | 55,135 | 36 | 2,013,563 | C | 33 |
| Elbert County (08039) | 27,874 | 17 | 281,200 | C | 0 |
| Fremont County (08043) | 49,634 | 38 | 1,256,223 | C | 22 |
| Garfield County (08045) | 62,479 | 39 | 2,399,583 | C | 34 |
| Gilpin County (08047) | 5,901 | 5 | 200,132 | C | 0 |
| Grand County (08049) | 15,895 | 13 | 1,676,761 | C | 7 |
| Gunnison County (08051) | 17,241 | 16 | 2,783,372 | C | 9 |
| Hinsdale County (08053) | 1,005 | 1 | 785,509 | D | 0 |
| Huerfano County (08055) | 6,972 | 6 | 971,013 | D | 0 |
| Jackson County (08057) | 1,372 | 2 | 694,381 | C | 0 |
| Kiowa County (08061) | 1,376 | 2 | 76,531 | D | 0 |
| Kit Carson County (08063) | 7,023 | 6 | 161,706 | D | 0 |
| Lake County (08065) | 7,380 | 8 | 654,651 | C | 6 |
| La Plata County (08067) | 56,331 | 35 | 1,745,890 | C | 16 |
| Las Animas County (08071) | 14,413 | 17 | 1,083,876 | C | 12 |
| Lincoln County (08073) | 5,550 | 5 | 242,919 | D | 0 |
| Logan County (08075) | 20,892 | 17 | 217,745 | C | 14 |
| Mineral County (08079) | 729 | 1 | 794,434 | D | 0 |
| Moffat County (08081) | 13,207 | 15 | 392,467 | C | 13 |
| Montezuma County (08083) | 26,412 | 23 | 1,330,300 | D | 12 |
| Montrose County (08085) | 43,807 | 32 | 1,620,476 | C | 22 |
| Morgan County (08087) | 29,520 | 25 | 164,927 | C | 18 |
| Otero County (08089) | 18,321 | 20 | 242,127 | C | 9 |
| Ouray County (08091) | 5,087 | 5 | 598,630 | C | 0 |
| Park County (08093) | 17,907 | 13 | 1,006,767 | C | 0 |
| Phillips County (08095) | 4,496 | 6 | 47,539 | D | 0 |
| Pitkin County (08097) | 16,985 | 14 | 1,458,309 | C | 12 |
| Prowers County (08099) | 11,910 | 14 | 165,007 | C | 11 |
| Rio Blanco County (08103) | 6,544 | 7 | 970,222 | D | 0 |
| Rio Grande County (08105) | 11,321 | 10 | 1,002,579 | D | 0 |
| Routt County (08107) | 25,084 | 24 | 938,506 | C | 16 |
| Saguache County (08109) | 6,580 | 6 | 2,106,277 | D | 0 |
| San Juan County (08111) | 724 | 1 | 625,990 | C | 0 |
| San Miguel County (08113) | 7,968 | 7 | 1,050,911 | C | 6 |
| Sedgwick County (08115) | 2,304 | 2 | 65,956 | C | 0 |
| Summit County (08117) | 31,017 | 31 | 1,173,978 | C | 30 |
| Teller County (08119) | 24,825 | 19 | 429,790 | C | 8 |
| Washington County (08121) | 4,831 | 5 | 152,033 | D | 0 |
| Yuma County (08125) | 9,979 | 9 | 160,083 | D | 0 |
| **53 counties** | **879,035** | **720** | **43,083,050** | 31 C, 22 D | 397 |

- OpenStreetMap: Colorado counties read the file the registry names for each county, from openstreetmap.fr, each downloaded
  once and shared: `southwest` (14 counties), `northwest` (14), `southeast` (12), `northeast` (10) and `denver` (3). All five
  have data timestamp 23 Nov 2026, 01:12:49Z. Build: fetch 26-109 s, build 34-75 s per county, one at a time, about 1.4 hours
  from the first county to the last.
- Bus frequency: 29 counties have no value in any block group; 24 have values. Rail distance: 45 counties have none; 8
  have values.
- Census spot check: 53 counties, 1,092 of 1,092 values equal (0% mismatch). Tract-median flags: 53 counties added, no
  existing county changed, 0 values matching neither the block group nor the tract.
- Crash counts: Colorado has no state crash source connected (`pipeline/region.py` STATE_DEFAULTS has no CO; the one earlier
  Colorado county with crash counts is Denver, which has its own city source); all 53 files say "Not connected for Colorado yet: crash gaps
  are not scored and crash-based projects are not proposed". No crash counts were built, so
  `tests/unit/crashCountsInvariant.test.ts` was not touched.
- Tests run: `npm test` 2,085 of 2,085 (50 files), `npm run typecheck` clean. No corridor stop needed a change.
- OpenStreetMap ID for ID vs live Overpass (maps.mail.ru; it answered 504 to many tries, each query was retried until it
  answered; two counties picked with seed 20261122 from the state's sorted list: Otero 08089 and Moffat 08081).
  **Otero: roads 2,922 = 2,922 and bus stops 10 = 10, exact.** **Moffat: bus stops 16 = 16; roads 1,577 on Overpass, 1,554
  in the extract (23 only on Overpass, 0 only in the extract).** Moffat's box reaches over the Wyoming and Utah lines, so the
  comparison was repeated inside Colorado (`area["ISO3166-2"="US-CO"]`): 1,537 on Overpass in Colorado, 1,554 in the
  extract, **0 only on Overpass**, 17 only in the extract. Located with TIGERweb (centre point of each way): the 23 raw
  Overpass-only roads are in Carbon County WY 19, Sweetwater County WY 2, Daggett County UT 1 and Uintah County UT 1; the 17
  extract-only ways are Wyoming- and Utah-centred ways that cross the line and are kept whole (Carbon WY 9, Sweetwater WY 4,
  Daggett UT 2, Uintah UT 2). None of the 40 is in Moffat County. So inside both counties every road and bus stop matches.
- Live check from R2 (`LIVE_PORT=9271`): Sedgwick (08115) and Otero (08089), picked with seed 20261123 from the state's sorted
  list. Sedgwick has two block groups, so it has 2 points (5 points in all, not 6). Both Sedgwick points had the house panel
  on live parcel records and pass every check (neighborhood, canopy, canopy goal, crash text "no crash data for this
  county", state laws, Census area, HUD rent, FEMA, USGS, console). Otero has no parcel service on the page, so its three
  points open the neighbourhood panel only ("no parcel at point"): neighborhood, canopy, canopy goal, crash text, state laws
  and console pass, and the house-panel rows (Census area, HUD rent, FEMA, USGS) are not checkable. 33 pass, 0 fail, 12 not
  checkable. No wrong value was shown. Each data file came from the r2.dev address (HEAD 200, GET 200).
- R2: before 2,084,976,473 bytes (3,727 objects); dry run "54 files, net +0.043 GB, projected 2.128 GB". The first upload
  run stopped after 31 objects with a JSON decoding error from the script ("Extra data", no file lost); a new `--dry-run`
  showed the remaining 23 files, net +0.017 GB, projected 2.128 GB, and the second run finished with "Failed: 0". After:
  3,780 objects, 2.128 GB; the 53 data files are 43,083,050 bytes.

Files: `data/backtests/vawvco_co_census_spot_2026-11-23.json`, `data/backtests/vawvco_osm_xcheck_08089_2026-11-23.json`,
`..._08081_...`, `data/backtests/vawvco_osm_xcheck_state_08081_2026-11-23.json`,
`data/backtests/live_check_panels_2026-11-23_vawvco_co.json`, `data/backtests/acs_fallback_mismatches_2026-11-23.json`.
