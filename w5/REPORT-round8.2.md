# City Pretty, round 8.2: each bus counted once, missing bus operators added, home-upgrade table fixed (7 Nov 2026)

Round 8.2 follows round 8.1. It fixes the transit faults that round 8.1's report described in section 7, and several more that the fix uncovered. Every built county was re-checked. The counties whose bus data changed were re-bundled, and all 11 regional pages and the national site were rebuilt.

## 1. What was wrong
The bus-frequency input (`bt`) is the number of buses per hour at the busiest stop within 400 m of a block group, 7–9 am on a weekday. It decides transit projects such as bus lanes, BRT, signal priority, shelters and microtransit. Round 8.1 found three faults; checking them turned up more.

**The same buses counted more than once:**
- **One feed under two ids:** MobilityData writes some ids both as "75" and as "mdb-75". This doubled:
  - El Dorado Transit in Amador, El Dorado, Placer, Sacramento and Yolo counties;
  - Cincinnati Metro in Hamilton County, OH;
  - Leprechaun Lines in Dutchess and Orange counties, NY.
- **One operator in several feeds:**
  - King County Metro's own feed appears under two ids (267, 1330) and again in the Puget Sound consolidated feed (1080). Metro's buses were counted three times, and Pierce Transit's and Community Transit's twice. King County's 7–9 am total over all stops was 95,250 buses per hour; the correct figure is about 34,000.
  - Pierce and Snohomish counties were affected the same way.
  - RABA's December 2025 – May 2026 schedule was counted on top of its current one (Shasta and Tehama counties, CA).
  - Lower Hudson Transit Link's routes (H01–H07X) appear as "LHTL" in one feed and as "Hudson Link" in another. They were counted twice in Westchester, Rockland and Orange counties, NY, and in Bergen and Passaic counties, NJ, whose boxes reach the routes.

**Operators missing:**
- **No location in the catalog:** Winston-Salem Transit (Forsyth County, NC) and Galveston Island Transit (Galveston County, TX) were never selected.
- **Feed unreadable:** Georgia's Xpress feed ends with a blank row, so the reader rejected the whole feed.
- **Fresher copies never tried:**
  - When MobilityData's hosted copy was stale, its legacy mirror wasn't tried. The mirror has newer schedules for:
    - Milwaukee's MCTS (8 March – 22 August 2026). Round 8.1's report said MCTS had ended in both copies; that was wrong. All 861 Milwaukee block groups showed bus frequency as unknown; now 8 do.
    - Gold Coast Transit (Ventura County's main operator, to August 2026).
  - The operator's own URL wasn't tried. Westchester's Bee-Line is current on NYSDOT's 511NY bucket (October 2026 – February 2027), while both MobilityData copies ended in 2025, so 420 of Westchester's 725 block groups showed bus frequency as unknown on the round-8.1 site. Now none do.

## 2. The fix: transit selections 6 and 7
Both are in `pipeline/fetch_oc.py` (`fetch_gtfs_mdb`); the national README has the details.

**Each bus counted once:**
- Feed ids are normalised ("mdb-75" is "75"), so a feed reached through two catalog entries is read and counted once.
- Each route is counted once. A route is the agency plus its route number (or the route's name where a feed has no numbers). When two feeds carry the same route, it is counted from one of them, chosen in this order:
  1. the feed whose service for that route includes today;
  2. the most specific feed (fewest agencies), so an operator's own feed comes before a regional aggregate;
  3. the later end of the route's service;
  4. more weekday trips.
- Two copies count as one route only if they stop at the same places: 20% of stops within about 100 m when the agency name matches, 80% when it differs (as with "LHTL" and "Hudson Link"). Two operators that only share a name or a route number are both kept. Example: Sound Transit's express routes appear in the feeds of King County Metro, Pierce Transit and Community Transit, each with the routes it runs, so all of them count, each once.
- A schedule that does not run today is dropped when another feed has the same operator running today at the same stops (RABA's old schedule).

**Missing operators added:**
- A catalog row with no location is placed by the box around its own stops, read from MobilityData's copy and cached for 30 days.
- When MobilityData's hosted copy is stale, its legacy mirror is tried, then the operator's own URL from the catalog, where this environment can reach it.
- Blank or malformed calendar rows are ignored instead of rejecting the feed.
- Demonstration feeds are skipped, such as "Sunny Valley Transit (Demo)", whose made-up stops sit near Bozeman, MT.

**Unknown instead of 0, only where it should be:** a stop of a stale feed still marks nearby block groups "unknown", unless the same operator's current feed is read. Where the current schedule has no service, the answer is 0, not unknown.

**Audit:** each county's `transit_stops_7_9.meta.json` lists, per feed, the agencies counted and the routes counted from another feed. It also flags any route number that two agency names share at 50–80% of the same stops, for review. In San Bernardino County, Omnitrans route 10 ("Fontana - Baseline - San Bdno") and SunLine's "Route 10 Commuter Link" share stops in San Bernardino. They are different services, and both are kept.

## 3. Effect
**The check:** all 237 counties built before the change were re-checked. 38 had different bus departures or stops. 62 were re-bundled, with no failures:
- those 38;
- 13 where only stale-feed stops changed and a block group could be affected;
- the 11 counties whose feed names were wrong (section 4).

**Block groups (old: the round-8.1 national site; new: the current bundle).** 59 of the 62 were on the round-8.1 site and can be compared; the other three were built after it. In 41 of the 59, no block group's bus frequency changed: the changed stops lay outside the county or near no block group's point. In the other 18:

| County | Block groups | Bus frequency lower | Bus frequency higher | Unknown → known | Known → unknown | Median new / old | Block groups whose bus-dependent projects changed |
|---|---|---|---|---|---|---|---|
| King County, WA | 1,545 | 945 | 0 | 0 | 0 | 0.333 | 648 |
| Milwaukee County, WI | 861 | 0 | 0 | 853 | 0 | – | 169 |
| Westchester County, NY | 725 | 1 | 26 | 420 | 0 | 3.24 | 101 |
| Hamilton County, OH | 678 | 362 | 0 | 0 | 0 | 0.5 | 193 |
| Snohomish County, WA | 575 | 245 | 0 | 0 | 0 | 0.5 | 63 |
| Pierce County, WA | 618 | 194 | 0 | 0 | 0 | 0.5 | 58 |
| Ventura County, CA | 479 | 0 | 9 | 110 | 0 | 1.0 | 93 |
| Forsyth County, NC | 250 | 0 | 42 | 23 | 0 | 1.75 | 11 |
| Galveston County, TX | 276 | 0 | 6 | 39 | 0 | – | 12 |
| Shasta County, CA | 133 | 10 | 0 | 0 | 2 | 1.0 | 3 |
| Bronx County, NY | 1,182 | 0 | 8 | 2 | 0 | 1.0 | 2 |
| Sacramento County, CA | 1,024 | 9 | 0 | 0 | 0 | 0.581 | 1 |
| Jefferson County, AL | 583 | 0 | 0 | 7 | 0 | 1.0 | 1 |
| Bexar County, TX | 1,139 | 0 | 0 | 7 | 0 | 1.0 | 0 |
| Stanislaus County, CA | 340 | 0 | 0 | 6 | 0 | 1.0 | 1 |
| Salt Lake County, UT | 712 | 0 | 0 | 5 | 0 | 1.0 | 0 |
| Fairfax County, VA | 678 | 0 | 4 | 1 | 0 | 1.0 | 1 |
| El Dorado County, CA | 154 | 4 | 0 | 0 | 0 | 1.0 | 0 |

**Example:** in downtown Seattle (block groups 530330081011, 530330080021, 530330080023, 530330072021, 530330072022), the busiest stop within 400 m went from 208.5 to 69.5 buses an hour, 7–9 am. The rebuilt page shows "70/hr" there; it showed 209.

Notes:
- "Median new / old" is over block groups with bus service both before and after: 1/3 in King County (counted three times), 1/2 in Hamilton, Pierce and Snohomish counties (counted twice).
- "Bus-dependent projects" are the engine's projects that depend on bus frequency: signal priority, shelters, shade canopies, bus lanes, BRT, a rail station share, protected bike lanes on a bus street, microtransit and a food hall on a busy bus corridor.
- No block group's top-ranked project changed.

**County totals** (7–9 am bus departures per hour, summed over every stop in the county's box):
- King, WA: 95,250 → 34,026;
- Pierce, WA: 22,648 → 9,768;
- Snohomish, WA: 14,190 → 6,534;
- Hamilton, OH: 25,238 → 13,334;
- Shasta, CA: 729 → 330;
- Milwaukee, WI: 0 → 12,130 (MCTS);
- Westchester, NY: 18,902 → 27,420 (Bee-Line);
- Forsyth, NC: 76 → 2,128 (Winston-Salem Transit);
- Ventura, CA: 1,548 → 2,868 (Gold Coast Transit);
- Galveston, TX: 156 → 440 (Island Transit).

Script: `transit7_effect.py` (block groups) and `transit7_summary.py` (totals); results in `logs/transit7_effect.json` and `logs/transit7_summary.json`.

## 4. Other fixes
- **Home-upgrade table outside California** (patch section 20; the table holds LA-metro averages):
  - It listed "Seismic bolting and cripple-wall bracing" for every pre-1980 home, priced with California costs and California's Earthquake Brace + Bolt grant, so Miami homes were offered an earthquake retrofit. Outside California the row is no longer shown. Showing it in other earthquake regions would need a seismic-hazard layer, which this build doesn't have.
  - Its note told users to "zoom in and click a home for numbers sized to that house". House-level numbers exist only where parcel lines do (LA and Orange County). Elsewhere it now says the figures are LA-wide averages, not adjusted to the county.
  - Checked on 12 Miami-Dade panels: no seismic row, new note. On 12 Alameda panels: seismic row kept, new note. On LA panels: both unchanged.
  - The other LA-only rebates in the table (MWD/LADWP turf rebate, City Plants trees, Measure W) were already reworded outside LA County.
- **Scan for California terms:** 81 Miami-Dade and 82 Davidson block-group panels were scanned for California and LA terms. The seismic row was the only real problem. The other hits are labelled references ("LADOT's criteria (City of LA, used here for reference)", LA unit costs used for scale) or notes saying California law does not apply.
- **Two re-bundles of one county at once:** Sacramento County was queued by both transit checks, and two workers rebuilt it at the same moment. One worker's cleanup deleted the other's inputs, so its bundle came out with empty map layers. Sacramento was rebuilt alone, and each worker is now locked out of the other's counties. All re-bundled counties were then checked against their round-8.1 bundles: same map-layer counts.
- **Feed names in the sources table:** each county's sources table named every feed by its MobilityData catalog entry. Two entries are wrong:
  - feed 348, listed as "Sarasota County Area Transit (SCAT)", is Space Coast Area Transit (Brevard County, FL);
  - feed 2280, listed as Denver's RTD, holds Colorado DOT's Bustang routes (agency URL ridebustang.com; North, South and West Lines, Pegasus, CSU RamsRoute).

  The table now names each feed by the agencies in its own `agency.txt`, plus its MobilityData id (e.g. "Space Coast Area Transit (MobilityData 348, 2026-11-04)"). Counties re-bundled in this round use the new form, and the eleven counties that use feed 348 or 2280 were re-bundled for it: Brevard, Orange and Volusia in Florida, and Adams, Arapahoe, Denver, Douglas, El Paso, Jefferson, Larimer and Weld in Colorado. Other counties keep the catalog names until their next build; they are right apart from rebrandings (e.g. "Fort Worth Transit Authority" for Trinity Metro).
- **Faster checks:** a file missing from MobilityData's buckets (the bucket answers 403) is no longer retried three times.

## 5. More counties
- **Batch 2 is complete:** all 90 counties in the ten states covered from the start (Miami-Dade, Hillsborough, Pinellas, Erie NY, Virginia Beach and 85 more).
- **Batch 4 started at 14:01:** the next 100 largest counties in any state, beginning with Chester PA, Ramsey MN, Summit OH, Montgomery OH and Plymouth MA. 49 were built when the national site was rebuilt; the rest are building. They use transit selection 7 from the start.
- **National site (`site82`):** 286 counties in 40 states and DC (606 MB of county files and a 28.7 MB page). 292 counties are built by now.

## 6. Tests
**Regional pages:** 11 pages, all rebuilt. Each runs the LA + Orange regression (91 checks) and `countytest.js` for each of its counties. All 4,041 of 4,041 checks pass.

| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |
|---|---|---|---|---|
| `city-pretty-socal.html` | San Diego, Riverside, San Bernardino, Ventura, Imperial | 54.2 MB | 1d01b54da7d0 | 298/298 |
| `city-pretty-bay-area.html` | Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma | 51.3 MB | d0073bb59b71 | 455/455 |
| `city-pretty-central-coast.html` | Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito | 40.7 MB | a91e30b94158 | 295/295 |
| `city-pretty-central-valley.html` | Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings | 54.7 MB | af699b6cc94b | 424/424 |
| `city-pretty-sacramento-region.html` | Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa | 43.3 MB | 30991993a6f6 | 493/493 |
| `city-pretty-us-sample.html` | Denver, Cook, Harris, Kings, Fairfax | 64.3 MB | 3dd17179b466 | 271/271 |
| `city-pretty-north-coast-and-mountains.html` | Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity | 62.2 MB | d868def584e3 | 513/513 |
| `city-pretty-sierra-and-gold-country.html` | Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono | 38.8 MB | 8a45ce2f9916 | 377/377 |
| `city-pretty-us-new-states.html` | Middlesex, Philadelphia, Allegheny, Providence, Salt Lake | 54.3 MB | 7b95d2ae41d3 | 283/283 |
| `city-pretty-us-metros-2.html` | Maricopa, Clark, King, Cuyahoga, St. Louis, Davidson | 68.1 MB | ed54204a80ff | 317/317 |
| `city-pretty-us-florida.html` | Miami-Dade, Broward, Palm Beach, Orange, Hillsborough, Duval | 53.1 MB | 58ef6a9ca984 | 315/315 |

- **National site (`site82`, 286 counties, served over plain HTTP):** LA + Orange 91/91, King County WA 38/38, Hamilton County OH 38/38, Forsyth County NC 36/36, Philadelphia 34/34.
- **Bus frequency on the pages:** the rebuilt metros page shows 70 buses an hour at the busiest stop near five downtown Seattle block groups; the round-8.1 page shows 209 for the same block groups.
- **Transit selections 6 and 7, before install:** dry runs on the 14 counties with the faults found first (King, Snohomish, Pierce, Forsyth, Galveston, Hamilton, El Dorado, Amador, Shasta, Tehama, Dutchess, Orange NY, Fulton, Tarrant). Selection 7 was then tried on Westchester, Sacramento, Shelby and King. The faults found during the full check (LHTL / Hudson Link, MCTS, Gold Coast Transit) are covered by the check's own before/after comparison.
- **Re-bundles:** `layer_check.py` compared all 62 re-bundled counties with their round-8.1 bundles. Every county kept its block-group count and every map layer.
- **Patch section 20 (home-upgrade table):** tested on a page with Miami-Dade and Alameda before install: LA + Orange 91/91, Miami-Dade 38/38, Alameda 42/42. Panel checks: no seismic row in 12 Miami-Dade panels; the row is kept in 12 Alameda panels and in LA.
- **County quality:** `county-quality.md`, regenerated after the re-bundles.

## 7. Known limits
- **Bus operators with no current schedule in any copy this environment can reach.** Their stops make nearby block groups "unknown", not 0:
  - SacRT (Sacramento): 530 of 1,024 block groups unknown;
  - MATA (Memphis): no current feed;
  - Mountain Metro (Colorado Springs): 137 unknown;
  - Gainesville RTS, StarMetro (Tallahassee), ECAT (Pensacola), Chatham Area Transit (Savannah), CCRTA (Corpus Christi): no current feed;
  - Votran (Volusia): 123 unknown;
  - Greensboro Transit Authority: 89 unknown;
  - Rockford Mass Transit District: 123 unknown;
  - rabbittransit (York, PA): 99 unknown;
  - Madison County Transit (IL): 74 unknown.

  Their own download hosts are not on the environment's allow-list. `logs/quality.md` has every county's count.
- **Next: MobilityData's current catalog.** The pipeline reads MobilityData's legacy catalog (`mdb-csv/sources.csv`, 1,193 US GTFS rows). Its current export (`feeds_v2.csv`, updated 6 Nov 2026) is reachable too. It has 1,706 US GTFS rows, 529 of them under ids the legacy file lacks (Transitland `tld-`, NTD `ntd-` and TransitFeeds `tfs-` ids), and 253 of those are active.
  - Example: York County, PA's rabbittransit is current there (tld-223, 4 Oct 2026 – 31 May 2027, 720 stops), but stale in the legacy file (2023).
  - Reading it needs its id formats and its "inactive" status (used for feeds whose URL fails) handled as stale fallbacks, so that is round 8.3.
- **Slightly old schedules:** a schedule that ended less than a year ago is used, on the Wednesday nearest today within it. Examples: MCTS (Milwaukee) and Gold Coast Transit run to August 2026, and MARTA to 21 August 2026. Each county's `transit_stops_7_9.meta.json` lists every feed's calendar.
- **Feed names:** counties not re-bundled in this round still name their feeds by the MobilityData catalog entry (section 4).
- **Earthquake retrofit:** outside California the home-upgrade table leaves it out everywhere, including other earthquake regions (Washington, Oregon, Utah, Alaska), until a seismic-hazard source is added. A USGS 2023 hazard data release on ScienceBase is the lead; an ArcGIS copy of its intensity map found here has no stated probability level, so it was not used.
- **Fire hazard outside California:** the USDA Forest Service's Wildfire Hazard Potential (2023, 270 m) would supply it. Its ArcGIS Online item (owner USFSEnterpriseContent) points to an image service on imagery.geoplatform.gov, and neither that host nor apps.fs.usda.gov is reachable here.
- Unchanged from round 8.1: no crime data outside California, injury crashes only where a state or county source exists, Alaska and Hawaii not built, LA's crash-gated rows (see `la_crash_count_check.md`).
