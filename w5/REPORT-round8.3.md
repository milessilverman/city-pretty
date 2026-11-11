# City Pretty, round 8.3: MobilityData's current transit catalog, rail stations mapped as areas, a new metros page, more counties (7 Nov 2026)

Round 8.3 follows round 8.2. It makes two changes. The transit step now reads MobilityData's current catalog as well as its legacy one. The OpenStreetMap step now finds rail stations that are mapped as areas. Every built county was re-checked, the counties whose data changed were re-bundled, and all regional pages and the national site were rebuilt, plus one new page.

## 1. Transit selection 8: MobilityData's current catalog
Until now the transit step read only MobilityData's legacy catalog, `mdb-csv/sources.csv`, with 1,193 US GTFS rows. MobilityData's current export, `feeds_v2.csv` (updated 6 Nov 2026), is reachable here from the same storage bucket as the feeds. It lists 1,706 US GTFS rows, 529 of them under ids the legacy file lacks: Transitland (`tld-`), the National Transit Database (`ntd-`) and TransitFeeds (`tfs-`).

Selection 8 (`pipeline/fetch_oc.py`, `mdb_catalog_rows`) reads both:
- A feed listed in both keeps its legacy status, so feeds the legacy catalog marked inactive stay out. It takes the current export's bounding box, redirect and operator URL where the export has one.
- Feeds listed only in the current export are added unless they are inactive, in development or future.
- TransitFeeds copies are read from its archive bucket.
- Round 8.2's rules still apply: each feed and each bus route counted once, the most current and most specific feed first. A feed that appears under an old and a new id is not double counted. Example: in Pima County, AZ, seven Sun Tran routes also appear in the Regional Transportation Authority's feed (ntd-91122) at the same stops, and are counted once.

**One rule added: the newer schedule wins.** The current catalog lists some operators twice, under their own id and under an NTD copy. Round 8.2's tie-break between two current copies of a route was the later end of service. That picked NTD copies with long nominal calendars over the operators' own, newer feeds. Example: Brockton's BAT (Massachusetts) appears as its own feed (422, issued 27 Feb 2026, 963 stops) and as ntd-10004 (calendar 2021–2027, 815 stops). The first selection-8 run took ntd-10004 for 12 of BAT's routes, and five Massachusetts counties lost bus stops (Plymouth: 4,065 → 3,360). The rank is now:
1. service includes today;
2. the most specific feed;
3. **the newer schedule (later start)**;
4. the later end;
5. more trips.

The 55 counties where a duplicate-route choice was made were re-checked with it and re-bundled where their stops changed.

Examples of operators found only in the current export:
- York County, PA: rabbittransit (tld-223, 4 Oct 2026 – 31 May 2027). The legacy catalog has only a 2023 schedule.
- Mobile County, AL: The Wave (City of Mobile, tld-6773, 576 stops), absent from the legacy catalog. Mobile had no bus data.

## 1b. Rail stations mapped as areas
The distance to the nearest rail station (`rm`) is shown in every block-group panel ("rail 0.2 mi") and decides several projects:
- bus lanes need no rail within 800 m;
- BRT, none within a mile;
- a share of a new rail station, none within 2.4 km;
- bike share, rail within 813 m.

`osm_extract.py` read rail stations only as OpenStreetMap points (`railway=station` or `halt` nodes). Many networks map their stations as areas instead (station outlines with `railway=station`), plus stop positions on the tracks. Those stations were missed. A check on the north Texas extract found 149 station areas and 43 station points, and 136 of the areas had no point within 200 m. They include most of DART:
- in downtown Dallas: West End, Akard, St. Paul, Pearl/Arts District;
- in Collin County: Parker Road, Downtown Plano, Galatyn Park, CityLine/Bush, and the newer Plano-area stations (12th Street, Shiloh Road, UT Dallas).

Collin County had no rail station at all.

**The fix:**
- A station mapped as an area becomes a point at the area's centre, unless a station point lies within 150 m.
- A rail stop position (`railway=stop` on a train, light-rail or subway line) is used only where no station lies within 300 m.
- Stations that are not transit are dropped, whether points or areas:
  - stations tagged `usage=tourism`, `railway:historic`, `historic=railway_station`, `station=miniature`, a tourism attraction or museum, or private or no access (e.g. the US Capitol subway);
  - stations whose name, operator, network, description or note says miniature, mini train, vintage railroad, heritage railway, excursion, scenic railway, railroad or railway museum, tea garden, steam train, park railroad or park train. Examples:
    - Balboa Park Miniature Railroad, Grapevine Vintage Railroad, Cuyahoga Valley Scenic Railroad;
    - Fort Myers' "Colonial Station", whose note says it "is only used for excursion trains";
  - stations whose operator is a museum or a history organisation (e.g. Carillon Park Railroad, operated by Dayton History);
  - zoo and safari trains, unless the station belongs to a transit network. The Cincinnati Zoo's Safari Train is dropped; METRORail's "Memorial Hermann Hospital/Houston Zoo" stays;
  - station areas without a name.

  The filter deliberately ignores the word "historic", because Salt Lake's "Historic Gardner" is a TRAX station.
- Collin County now has 10 rail stations. `station_scan.py` checked every built county against its OpenStreetMap source: 142 of 325 have a different station set.

## 2. Effect
**Transit (selection 8 and the newer-schedule rule).** All 293 counties built before the change were re-checked, and 120 had different stops and were re-bundled. After the newer-schedule rule, the 55 counties with a duplicate-route choice were checked again. 13 changed and were re-bundled:
- 11 of the 120;
- Hampden County, MA, which selection 8 had left unchanged;
- Whatcom County, WA, built in batch 4.

No re-bundle failed. Block groups, old (round-8.2 national site) against new (current bundle), with the 18 largest changes:

| County | Block groups | Bus frequency changed (up / down) | Became unknown | Became known | Median new/old | Bus-dependent projects changed | Top project changed |
|---|---|---|---|---|---|---|---|
| Marion County, IN | 759 | 0 (0 / 0) | 0 | 684 | – | 81 | 0 |
| Hidalgo County, TX | 572 | 0 (0 / 0) | 0 | 572 | – | 59 | 0 |
| Lucas County, OH | 480 | 0 (0 / 0) | 0 | 478 | – | 89 | 0 |
| Orleans Parish, LA | 440 | 0 (0 / 0) | 0 | 440 | – | 98 | 0 |
| Mobile County, AL | 334 | 0 (0 / 0) | 0 | 318 | – | 34 | 0 |
| Jefferson Parish, LA | 328 | 0 (0 / 0) | 0 | 314 | – | 43 | 0 |
| St. Lucie County, FL | 198 | 0 (0 / 0) | 0 | 197 | – | 12 | 0 |
| Horry County, SC | 186 | 0 (0 / 0) | 0 | 186 | – | 12 | 0 |
| Webb County, TX | 177 | 0 (0 / 0) | 0 | 177 | – | 26 | 0 |
| Ventura County, CA | 479 | 100 (100 / 0) | 0 | 7 | 1.045 | 8 | 0 |
| York County, PA | 338 | 0 (0 / 0) | 0 | 99 | – | 71 | 0 |
| Alachua County, FL | 160 | 0 (0 / 0) | 0 | 97 | – | 3 | 0 |
| Lake County, IN | 398 | 71 (71 / 0) | 0 | 5 | 1.0 | 4 | 0 |
| Westmoreland County, PA | 265 | 66 (66 / 0) | 0 | 1 | 1.0 | 16 | 0 |
| Ottawa County, MI | 183 | 12 (12 / 0) | 0 | 17 | 1.0 | 2 | 0 |
| Tulare County, CA | 305 | 15 (15 / 0) | 0 | 4 | 1.0 | 17 | 0 |
| Baltimore city, MD | 618 | 19 (19 / 0) | 0 | 0 | 1.0 | 13 | 0 |
| Washtenaw County, MI | 308 | 16 (16 / 0) | 0 | 2 | 1.0 | 11 | 0 |

120 re-bundled counties compared with round 8.2; 66 with no bus-frequency change. The counties with no bus data before, and whose block groups now all have bus frequency:
- Indianapolis (Marion County): IndyGo, 684 block groups;
- New Orleans (Orleans Parish): 440;
- Toledo (Lucas County): 478;
- McAllen (Hidalgo County): 572;
- Mobile: 318;
- Jefferson Parish: 314;
- St. Lucie County: 197;
- Myrtle Beach (Horry County): 186;
- Laredo (Webb County): 177.

York County, PA gains rabbittransit (99 block groups no longer unknown), and Gainesville (Alachua) 97. Hays County, TX has 11 block groups newly unknown: stops of two stale feeds the current catalog adds (Bobcat Transit, ended 2023, and Capital Area Rural Transportation, ended July 2025) now mark them unknown. No block group's top-ranked project changed.

**Rail stations.** 130 counties were re-bundled because their stations change under the new rule. In all, 196 counties were re-bundled this round, for transit, stations or both:
- 160 of those builds ran the new station rule;
- the other 36 ran before it was installed, and `station_scan.py` finds no station change for them under it.

The table compares the 177 re-bundled counties that have a round-8.2 bundle; the other 19 were built in batch 4. Old (round 8.2) against new, with the 20 largest changes:

| County | Block groups | Stations on the map, before → after | Rail distance newly known | Shorter (median, m) | Longer | Rail-dependent projects changed |
|---|---|---|---|---|---|---|
| Dallas County, TX | 1,570 | 25 → 89 | 0 | 1,409 (8000) | 0 | 14 |
| Clark County, NV | 1,325 | 3 → 17 | 0 | 1,118 (5148) | 0 | 1 |
| King County, WA | 1,545 | 40 → 60 | 0 | 586 (1180) | 44 | 7 |
| Collin County, TX | 588 | 0 → 10 | 588 | 0 (–) | 0 | 2 |
| Shelby County, TN | 685 | 1 → 2 | 0 | 558 (4832) | 0 | 0 |
| Riverside County, CA | 1,394 | 13 → 13 | 0 | 423 (53800) | 85 | 0 |
| Tulsa County, OK | 508 | 0 → 2 | 508 | 0 (–) | 0 | 0 |
| Hamilton County, OH | 678 | 2 → 1 | 0 | 0 (–) | 497 | 0 |
| Pierce County, WA | 618 | 5 → 14 | 0 | 483 (7895) | 10 | 1 |
| Douglas County, NE | 489 | 0 → 3 | 489 | 0 (–) | 0 | 1 |
| Denton County, TX | 483 | 1 → 7 | 0 | 387 (13590) | 0 | 0 |
| Harris County, TX | 2,830 | 53 → 55 | 0 | 363 (7385) | 0 | 0 |
| San Diego County, CA | 2,058 | 67 → 90 | 0 | 336 (771) | 0 | 15 |
| Bexar County, TX | 1,139 | 7 → 6 | 0 | 82 (222) | 251 | 0 |
| Broward County, FL | 1,121 | 8 → 10 | 0 | 308 (1471) | 0 | 0 |
| Knox County, TN | 301 | 0 → 1 | 301 | 0 (–) | 0 | 0 |
| Worcester County, MA | 571 | 11 → 13 | 0 | 293 (7075) | 0 | 0 |
| Milwaukee County, WI | 861 | 3 → 2 | 0 | 0 (–) | 280 | 0 |
| York County, PA | 338 | 7 → 10 | 0 | 96 (4398) | 180 | 4 |
| Hamilton County, TN | 278 | 3 → 5 | 0 | 70 (3736) | 203 | 0 |

177 re-bundled counties compared with round 8.2; 69 with no rail-distance change. Notes:
- "Longer" means a station was dropped as not transit, so the nearest real station is farther:
  - Cincinnati: the zoo's Safari Train;
  - Milwaukee: the zoo's train;
  - Bexar: the San Antonio Zoo and Landa Park trains;
  - Cuyahoga: the Cuyahoga Valley Scenic Railroad;
  - Chattanooga: the Tennessee Valley Railroad's Grand Junction.
- Riverside's median gain is 54 km: block groups in the Coachella Valley now reach Palm Springs' Amtrak station; before, the nearest station was in the Inland Empire.
- Scripts: `transit7_effect.py site82 …` and `station_effect.py`; tables in `logs/transit8_effect_table.md` and `logs/station_effect_table.md`.

## 3. New regional page: US metros 3
`city-pretty-us-metros-3.html` adds six large counties that had no single-file page. Three of them had their transit fixed in round 8.2:
- Milwaukee, WI: MCTS, added in round 8.2;
- Hennepin, MN (Minneapolis);
- Franklin, OH (Columbus);
- Hamilton, OH (Cincinnati): its doubled Metro feed was fixed in round 8.2;
- Westchester, NY: Bee-Line, added in round 8.2;
- Wake, NC (Raleigh).

Like every regional page, it also holds LA and Orange County. Its test results are in section 5.

## 4. More counties
- **Batch 4 is complete:** the 100 largest counties not built before, from any state with an OpenStreetMap file. Examples: Chester PA, Ramsey MN, Summit and Montgomery OH, Plymouth MA, Marion IN (Indianapolis), Orleans Parish LA (New Orleans), Lucas OH (Toledo), Mobile AL, Hidalgo TX.
- **National total:** 338 counties built in 41 states and DC. The national site (`site83`) holds all of them.
- **Next:** batch 5, the next 150 counties, starts with round 8.4. The first in line is San Juan, Puerto Rico.

## 5. Tests
**Regional pages:** 12 pages, all rebuilt. Each runs the LA + Orange regression (91 checks) and `countytest.js` for each of its counties. All 4,354 of 4,354 checks pass.

| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |
|---|---|---|---|---|
| `city-pretty-socal.html` | San Diego, Riverside, San Bernardino, Ventura, Imperial | 54.2 MB | 81d0856bbc09 | 298/298 |
| `city-pretty-bay-area.html` | Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma | 51.3 MB | 6bc98b52e58d | 455/455 |
| `city-pretty-central-coast.html` | Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito | 40.7 MB | f910b375e634 | 295/295 |
| `city-pretty-central-valley.html` | Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings | 54.7 MB | 0343f5b2c528 | 424/424 |
| `city-pretty-sacramento-region.html` | Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa | 43.3 MB | cc2f13b77b5d | 493/493 |
| `city-pretty-us-sample.html` | Denver, Cook, Harris, Kings, Fairfax | 64.3 MB | f8d999381713 | 271/271 |
| `city-pretty-north-coast-and-mountains.html` | Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity | 62.2 MB | a084a355808c | 513/513 |
| `city-pretty-sierra-and-gold-country.html` | Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono | 38.8 MB | 98a2ea145f8a | 377/377 |
| `city-pretty-us-new-states.html` | Middlesex, Philadelphia, Allegheny, Providence, Salt Lake | 54.3 MB | c824e1f9da55 | 283/283 |
| `city-pretty-us-metros-2.html` | Maricopa, Clark, King, Cuyahoga, St. Louis, Davidson | 68.1 MB | 53c0f3337a6a | 317/317 |
| `city-pretty-us-florida.html` | Miami-Dade, Broward, Palm Beach, Orange, Hillsborough, Duval | 53.1 MB | f31bd0478152 | 315/315 |
| `city-pretty-us-metros-3.html` | Milwaukee, Hennepin, Franklin, Hamilton, Westchester, Wake | 51.5 MB | 3973b87c018d | 313/313 |

- **National site (`site83`, 338 counties, served over plain HTTP):** LA + Orange 91/91, King County WA 38/38, Hamilton County OH 38/38, Forsyth County NC 36/36, Philadelphia 34/34.
- **One test change: the "no other county's claims" check now skips the transit feed list.**
  - The check fails a county panel that names another county's places or programmes.
  - The transit sources row now names each operator whose feed was read. For San Diego, Riverside and San Bernardino that includes the Orange County Transportation Authority, whose feed's area reaches them. The first SoCal run therefore failed 10 checks in each (32/42).
  - `countytest.js` already skipped the old wording of this row; it now also skips the new wording.
  - The three counties were re-tested on the same page: 42/42 each.
- **Selection 8 before install:** a dry run on six counties (York PA, Westchester NY, King WA, Sacramento CA, Shelby TN, Volusia FL) completed without errors. Shelby still finds no current MATA feed (section 6).
- **Station rule:**
  - Before the re-bundles, `station_scan.py` ran the rule on every built county's OpenStreetMap extract and listed the stations each county would gain or lose.
  - Reading the lists of dropped stations found a false drop. The first version dropped every station with "zoo" in its name, including METRORail's "Memorial Hermann Hospital/Houston Zoo". It was corrected to keep zoo stations of a transit network, and every county with a zoo or safari station was re-bundled again (`build_station_queue.py`).
  - The heritage filter was then widened (notes, museum operators, park railroads, unnamed areas). `station_scan2.py` compared the final rule with the previous one: 18 of 337 counties differ, and all 18 were re-bundled after the final rule was installed.
- **Re-bundles:**
  - all 196 finished with exit 0;
  - `layer_check.py` compared the 177 with a round-8.2 bundle. Every one kept its block-group count and every map layer, except that the stations layer emptied in two counties, both correctly:
    - Summit County, OH: the Cuyahoga Valley Scenic Railroad's five stations;
    - Rutherford County, TN: Watertown, an excursion stop of the Tennessee Central Railway Museum, just outside the county.
- **County quality:** `county-quality.md`, regenerated after the re-bundles.

## 6. Known limits
- **Bus operators still without a current schedule** in any copy reachable here (their stops make nearby block groups "unknown", not 0): SacRT (Sacramento), MATA (Memphis), Mountain Metro (Colorado Springs), Gainesville RTS, StarMetro (Tallahassee), ECAT (Pensacola), Chatham Area Transit (Savannah), CCRTA (Corpus Christi), Votran (Volusia), Greensboro Transit Authority, Rockford Mass Transit District and Madison County Transit (IL). The current catalog marks most of them "inactive": MobilityData cannot fetch their feeds either. `county-quality.md` has every county's count.
- **Feeds are taken as published:** a schedule that ended less than a year ago is still used, on the Wednesday nearest today within its calendar. A seasonal service whose feed lists year-round dates counts as running. Example: the Devils Postpile National Monument shuttle feed (3206), newly found in the current catalog, lists service for all of 2026. It and two Yosemite National Park feeds add a few stops in Fresno, Inyo, Madera, Mariposa, Mono and Tuolumne counties.
- **Rail stations that are not transit but look like it:** a heritage or tourist station with no tag or name that gives it away still counts, and so does an unnamed rail stop position. Examples:
  - Knoxville's Three Rivers Rambler (Knox County, TN);
  - the Stewartstown and Maryland & Pennsylvania heritage railroads (York County, PA);
  - Asheville's "Silver Line Station" (Buncombe County, NC);
  - two unnamed stop positions in Tulsa County, OK.

  These counties have no passenger rail, but their panels show a distance to "rail". Checking stations against the stops of current GTFS rail feeds, as bus frequency already is, would remove them; that is the next round.
- **Feed names in sources tables:** counties not re-bundled since round 8.2 still name their feeds by the catalog entry.
- Unchanged from round 8.2: no earthquake-retrofit row outside California, no fire hazard outside California, no crime data outside California, injury crashes only where a state or county source exists, Alaska and Hawaii not built, LA's crash-gated rows (`la_crash_count_check.md`).
