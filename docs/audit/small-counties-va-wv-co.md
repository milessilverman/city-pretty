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
