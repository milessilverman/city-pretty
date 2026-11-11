# City Pretty, round 8.1: land-only block groups, more complete pedestrian/cyclist crashes, current transit everywhere, checked crash sources (7 Nov 2026)

Round 8.1 follows the round-8 delivery. Every county is re-bundled with three changes, and the regional pages and the national site are rebuilt from those bundles.

## 1. Land-only block-group shapes
Census block-group shapes include water. Three inputs treated the whole shape as land:
- acreage;
- the reference point for distances (which could sit in a river);
- the freeway sound-wall inputs (unwalled freeway within 150 m, share of homes within 100 m).

Example: MIT's block group reaches into the Charles River, so Storrow Drive on the far bank counted.

Now `metrics_oc.py` removes mapped water wherever it is 5% or more of a block group's shape. The water is Census TIGER area hydrography: lakes, reservoirs, bays, ocean, rivers and canals, but not swamps. Points move off water only where they lay in it.

Tested on Duval County, FL (582 block groups on the St. Johns River and the coast):
- water was removed from 139 block groups;
- the gap between our acreage and the Census land area fell from 36.5% to 2.1% (90th percentile);
- distances changed only in the ~35 block groups whose point was in water;
- the freeway inputs changed in 19–28 block groups.

Smaller amounts of water (ponds, creeks) are left alone, because moving a point for a pond only adds noise (up to 860 m in tests).

LA and Orange County keep their audited bundles.

Applied to every county built by the national pipeline: 149 counties, re-bundled without a failure. Water was removed from 7,210 block groups. The most were in coastal and lake counties:
- Miami-Dade 441 of 1,843;
- Hillsborough 305 of 914;
- Broward 285 of 1,121;
- Orange County FL 216 of 673;
- Hennepin 197 of 1,098;
- Palm Beach 197 of 982;
- King County WA 195 of 1,545;
- Suffolk NY 191 of 1,058.

Water-only block groups (zero land area, no residents; e.g. 84 in Manhattan's rivers) keep their outlines and stay "no data".

## 1b. California pedestrian and cyclist crashes: injured persons counted too
CCRS marks a crash as pedestrian or bicycle only by its first object struck ("motor vehicle involved with"). Two kinds are missed:
- crashes where a pedestrian or cyclist was hurt but something else was hit first;
- cyclists hurt without a motor vehicle (e.g. solo falls).

CCRS's injured-persons table lists every injured or killed person with a type (Pedestrian, Bicyclist), for every year 2016–2025. A crash now counts as pedestrian/bicycle if either source says so.
- California 2024 statewide: 23,425 crashes by first object struck, 25,662 with the injured-persons table (+9.5%).
- Marin County, 2016–2025: 1,431 → 1,804 (+26%), mostly cyclists.
- The site suggestions (crossing and calming candidates) use the same flags. Across the 54 re-run California counties, candidates rose from 19,651 to 19,974 (+1.6%), mostly crossings where an injured pedestrian or cyclist had been missed (e.g. Riverside +38, Santa Clara +33). San Francisco keeps DataSF's own crash table; LA and Orange County keep their audited builds.

## 2. Current transit everywhere
Transit selection 5 (round 8, section 2) is now applied to every county:
- MobilityData's hosted copies first;
- every catalog redirect followed;
- each feed counted once (after this build, two kinds of double counting were found: see section 7).

All built counties now use transit selection 5: 101 re-bundled, none failed.
- Since the round-8 quality table, Riverside's unknown bus frequency fell from 336 to 7 of 1,394 block groups, and Sonoma's from 99 to 4 of 404. The round-8 report lists the gap counties fixed earlier (Alameda, Contra Costa, San Mateo, Monterey, Butte, San Antonio, Jacksonville, El Paso).
- Across the 103 counties in both tables, block groups with unknown bus frequency fell from 2,004 to 1,690.
- Most of the remainder are Sacramento (528, SacRT) and Westchester (402, Bee-Line), whose schedules ended over a year ago in both of MobilityData's copies, and Memphis (MATA).

## 3. Crash sources checked against NHTSA FARS (2023 deaths)
| State | Source | FARS | Difference |
|---|---|---|---|
| IL | 1,244 | 1,241 | +0.2% |
| VA | 907 | 914 | −0.8% |
| UT | 279 | 280 | −0.4% |
| PA | 1,204 | 1,211 | −0.6% |
| TN (TITAN) | 1,323 | 1,323 | 0.0% |
| ME | 148 | 135 | +9.6% |

FARS counts only crashes on public roads where someone died within 30 days. MaineDOT's layer flags which crashes are in FARS (`FARS_YN`): its FARS-flagged crashes hold 134 deaths (FARS: 135, −0.7%), and the other 14 deaths are in crashes MaineDOT marks as not in FARS (4) or leaves unmarked (10). City Pretty keeps all of them, as MaineDOT records them. Script: `crash_validate.py`.

## 4. More counties
**Batch 3 is complete:** the 60 largest counties in the states cut from regional files are built, each with its state file, current transit, land-only shapes and the state's crash records where one exists:
  - AL: Jefferson;
  - AZ: Maricopa, Pima;
  - CT: Capitol, Western Connecticut, South Central Connecticut;
  - DC: District of Columbia;
  - DE: New Castle;
  - IN: Marion;
  - KS: Johnson;
  - KY: Jefferson;
  - MA: Middlesex, Worcester, Essex, Suffolk, Norfolk, Bristol;
  - MD: Montgomery, Prince George's, Baltimore, Anne Arundel, Baltimore city;
  - MN: Hennepin;
  - MO: St. Louis, Jackson;
  - NE: Douglas;
  - NJ: Bergen, Middlesex, Essex, Hudson, Ocean, Monmouth, Union;
  - NM: Bernalillo;
  - NV: Clark;
  - OH: Franklin, Cuyahoga, Hamilton;
  - OK: Oklahoma, Tulsa;
  - OR: Multnomah, Washington;
  - PA: Philadelphia, Allegheny, Montgomery, Bucks, Delaware, Lancaster;
  - RI: Providence;
  - SC: Greenville;
  - TN: Shelby, Davidson;
  - UT: Salt Lake, Utah;
  - WA: King, Pierce, Snohomish, Spokane;
  - WI: Milwaukee, Dane.

With batch 3, 149 counties were built in 36 states and DC.

**Batch 2 is building:** 90 more counties in the ten states covered from the start, largest first. It includes Miami-Dade, Hillsborough, Pinellas, Erie NY and Virginia Beach, which earlier batches skipped because only a whole-state OSM file covers them. 73 of the 90 were built by 13:40 on 7 Nov.

**National site (`site81`):** 206 counties, including 59 from batch 2.

## 5. Fixes
- **Bucks County, PA:** failed twice in the street-length step on a shape GEOS rejects. Shapes are now repaired only when rejected.
- **Essex County, MA:** interrupted by an operator mistake during the transit switch, rebuilt from scratch.
- **Feeds packaged unusually:** Birmingham's BJCTA publishes its current feed with the tables in a subfolder and named `.csv`. The reader found no routes and skipped the feed without a reason, leaving Jefferson County, AL with no bus data. It now reads tables in subfolders or as `.csv`, and records a reason whenever a feed has no bus routes or dates. Jefferson County now has BJCTA's 947 stops (schedule to 28 Oct 2026).
- **Counties with the same name in different states:** Kings (CA, NY), Orange (CA, FL), Middlesex (MA, NJ), Jefferson (AL, KY) and many more.
  - The county picker now groups counties by state and adds the state outside California ("Kings, NY"), and the page heading names it ("KINGS COUNTY, NY").
  - Orange County, CA's own features (OCTA, Orange County funding programmes, OC Parks) were switched on by the county's name, so Orange County, FL got them. They now require Orange County, CA's FIPS code. Found when the Florida page's test failed 4 of 38 checks; it now passes 38/38.
- **Florida's state file:** `osm_sites.py` held a whole state file's features in memory before clipping to the county (6 GB for Florida), and two such builds at once were killed for lack of memory (Miami-Dade, Hillsborough). It now drops out-of-county features while reading: 2.2 GB, same output. Both counties were rebuilt.
- **Remaining transit gaps:** operators whose schedule ended over a year ago in both of MobilityData's copies:
  - Sacramento (SacRT);
  - Westchester (Bee-Line);
  - Memphis (MATA);
  - Milwaukee (MCTS, ended Aug 2025).

  Bus frequency is shown as unknown there, not 0.

## 6. Tests
**Regional pages:** 11 pages. Each runs the LA + Orange regression (91 checks) and `countytest.js` for each of its counties. All 4,041 of 4,041 checks pass.

| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |
|---|---|---|---|---|
| `city-pretty-socal.html` | San Diego, Riverside, San Bernardino, Ventura, Imperial | 54.2 MB | 04efd98c450a | 298/298 |
| `city-pretty-bay-area.html` | Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma | 51.3 MB | 18c6dad36a4b | 455/455 |
| `city-pretty-central-coast.html` | Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito | 40.7 MB | 63377dee0a63 | 295/295 |
| `city-pretty-central-valley.html` | Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings | 54.7 MB | b08f1cbcd2eb | 424/424 |
| `city-pretty-sacramento-region.html` | Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa | 43.3 MB | d82e2fd879b8 | 493/493 |
| `city-pretty-us-sample.html` | Denver, Cook, Harris, Kings, Fairfax | 64.3 MB | 0a2033bb7846 | 271/271 |
| `city-pretty-north-coast-and-mountains.html` | Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity | 62.2 MB | 075c96405352 | 513/513 |
| `city-pretty-sierra-and-gold-country.html` | Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono | 38.8 MB | c8f41c13f576 | 377/377 |
| `city-pretty-us-new-states.html` | Middlesex, Philadelphia, Allegheny, Providence, Salt Lake | 54.3 MB | eef8ab855963 | 283/283 |
| `city-pretty-us-metros-2.html` (new) | Maricopa, Clark, King, Cuyahoga, St. Louis, Davidson | 68.2 MB | d419c8618ab2 | 317/317 |
| `city-pretty-us-florida.html` (new) | Miami-Dade, Broward, Palm Beach, Orange, Hillsborough, Duval | 53.1 MB | fa11cfa59468 | 315/315 |

- **Davidson County, TN:** the first run passed 37 of 38 checks. The failing check looks for Los Angeles Metro text in other counties, and its pattern "Metro " matched "Metro Nashville Schools" (Nashville's school district) in a parking-lot suggestion. The test now matches only LA Metro's own names (LA Metro, Metro Board, Metro Bike Share, Metro Micro, Metro Rail). The page was not changed; the re-run passed 38/38.
- **National site (`site81`, 206 counties, served over plain HTTP):** LA + Orange 91/91, Alameda 42/42, Bexar 38/38, Maricopa 38/38, Philadelphia 34/34.
- **New page code (state-grouped county picker; Orange County, CA features keyed to its FIPS code):** tested before install on Orange County, FL 38/38, Middlesex County, NJ 38/38, Kings County, NY 26/26, and LA + Orange 91/91.
- **County quality:** `county-quality.md` lists every built county (block groups, Tree Equity coverage, crash geocoding, transit feeds and unknowns).

## 7. Found after this build: some bus schedules counted twice (fix in progress)
A check of the transit selection after this build found three faults. So far they affect the bus-frequency score in 20 built counties.

**The same buses counted twice (13 counties).** Bus frequency is overstated near these operators' stops, up to double where both copies serve a stop:
- one feed under two ids (MobilityData writes some ids both as "75" and as "mdb-75"):
  - El Dorado Transit in Amador, El Dorado, Placer, Sacramento and Yolo counties;
  - Cincinnati Metro in Hamilton County, OH;
  - Leprechaun Lines in Dutchess and Orange counties, NY.
- one agency in two feeds:
  - King County Metro's combined feed, published under two ids (King, Pierce and Snohomish counties, WA);
  - RABA's schedule for December 2025 – May 2026 and its current one, from 26 October 2026 (Shasta and Tehama counties, CA).

**Feeds with no location in the catalog were never selected.** Winston-Salem Transit (Forsyth County, NC) and Galveston Island Transit (Galveston County, TX) are missing, so bus frequency there shows 0 or unknown where those buses run.

**One feed could not be read.** Georgia's Xpress feed ends with a blank row, so the reader skipped it as unreadable. Its schedule ended in July 2025, so its stops should mark nearby block groups "unknown". It has 74 stops in Fulton, DeKalb, Cobb, Gwinnett and Clayton counties; block groups near them with no other operator's stop can show 0 instead of unknown.

**Fix (transit selection 6), being applied to every built county:**
- each feed is counted once;
- each agency is counted once, from its most current feed;
- catalog rows with no location are placed by their own stops;
- demonstration feeds are skipped;
- blank or malformed rows are ignored.

Round 8.2 will rebuild the affected counties and the pages that hold them: Sacramento region, Sierra and Gold Country, North Coast and Mountains, US metros 2, and the national site. Until then, read bus frequency in those counties with care.
