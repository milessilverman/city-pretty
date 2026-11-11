# City Pretty, round 8: all of California, map data for every state, transit everywhere, six state crash sources, regional pages (7 Nov 2026)

## 1. What was built
- **California:** every county is now built by the national pipeline. LA and Orange keep their earlier builds; the other 56 are new data products (bundle + site suggestions). Block-group counts match the Census ACS geography file in every county (`quality.json`).
- **Regional single-file pages** (LA and Orange County always included):
  - `city-pretty-socal.html`, SoCal: San Diego, Riverside, San Bernardino, Ventura, Imperial;
  - `city-pretty-bay-area.html`, Bay Area: Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma;
  - `city-pretty-central-coast.html`, Central Coast: Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito;
  - `city-pretty-central-valley.html`, Central Valley: Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings;
  - `city-pretty-sacramento-region.html`, Sacramento region: Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa;
  - `city-pretty-us-sample.html`, US sample: Denver CO, Cook IL, Harris TX, Kings NY, Fairfax VA (crash records: Denver police, Illinois DOT, Virginia DOT);
  - `city-pretty-north-coast-and-mountains.html`, North Coast and mountains: Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity;
  - `city-pretty-sierra-and-gold-country.html`, Sierra and Gold Country: Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono;
  - `city-pretty-us-new-states.html`, US new states: Middlesex MA, Philadelphia PA, Allegheny PA, Providence RI, Salt Lake UT (states cut by osm_split.py; Pennsylvania and Utah crash records).
- **Hosted mode** (for a national site): `export_county.py` and `patch6.py <fips>=@<url>`, tested over HTTP (round 7.1).
  - New this round: pre-compressed county files (`--gz`, `@gz:`). The page unpacks them itself, so any static host works without server settings.
  - New this round: `build_site.py <dir>` builds the whole national site in one command. Built here mid-round, before the transit and page fixes: index.html (28.7 MB) plus 89 counties (216 MB) at `/home/user/national/site`. It is rebuilt once the transit re-bundle finishes.
  - Tested over plain HTTP: LA + Orange 91/91; Middlesex MA 38/38, Fairfax VA 42/42, Alameda 42/42.

## 1b. National infrastructure: OpenStreetMap for every state
Until now only California and nine other states (TX, FL, GA, NC, IL, MI, NY, VA, CO) could be built, because openstreetmap.fr publishes state or smaller files only for them. The other 2,105 counties had only a regional file (2.0–4.6 GB), too large to read for one county.
- `osm_split.py` cuts each regional file once into one file per state with osmium (complete ways, whole multipolygons), covering every county box plus a margin. Each state takes 1–4 minutes and about 4.1 GB of memory.
- The registry then points those counties to their state file, and the pipeline links it instead of downloading.
- Puerto Rico now uses its own openstreetmap.fr file. Alaska and Hawaii have no extract on any reachable host, so they are marked as missing OSM and are not built.
- Batch 3: the 60 largest counties in the newly covered states, from Maricopa (Phoenix), Clark (Las Vegas), King (Seattle) and Philadelphia down to Greenville, SC. Two workers are building it; 23 are done so far: Middlesex MA, Philadelphia PA, Allegheny PA, Capitol Planning Region CT, Bergen NJ, Middlesex NJ, Worcester MA, Montgomery PA, Essex NJ, Suffolk MA, Norfolk MA, Hudson NJ, Providence RI, Ocean NJ, Monmouth NJ, Western Connecticut Planning Region CT, Delaware PA, Lancaster PA, Maricopa AZ, Salt Lake UT, Utah UT, Shelby TN, Davidson TN.

## 2. New data source: transit for every county (MobilityData GTFS catalog)
MobilityData's GTFS catalog and its mirror of each feed are both on `storage.googleapis.com`, which this environment already allows. So bus frequency (weekday 7–9 am buses per hour at the best stop within 400 m) is now measured for every county, not only Orange.

Rules:
- active feeds overlapping the county, one per provider and feed name;
- feeds whose schedule ended over a year ago are skipped and listed;
- mirrors that can't be downloaded are skipped and listed;
- one representative weekday per feed, with calendar exceptions and frequency-based trips handled;
- buses only (the metric is bus frequency).

**Download details (selection version 3).**
- Feeds are downloaded by id from a daily listing of MobilityData's mirror bucket, because the catalog's links are sometimes out of date. Without this, San Francisco's Muni feed (2886) was missed.
- Catalog entries without a bounding box are kept when they are in the same state, or have no state but a municipality inside the county.
- Agencies that publish several feeds under one name are kept per feed (MTA's borough bus feeds, NJ Transit bus and rail, RTD and Bustang).
- A provider whose active feed has no mirror falls back to its deprecated mirror, but only if that schedule is less than a year old.
- Stale feeds' stop locations are kept as evidence of service, so nearby block groups show bus frequency as unknown rather than 0 (e.g. SacRT, whose schedule ended in April 2025).

**Selection versions 4 and 5 (found late in round 8, being applied):** MobilityData's current hosted copies are public on the same allowed host (`storage.googleapis.com/mobilitydata-datasets-prod/<id>/latest.zip`, the store behind files.mobilitydatabase.org). Feeds the catalog marks as moved to another id (`tld-`, `ntd-` or a newer number) are there too. The transit fetch now takes the hosted copy first, the legacy mirror only as a fallback, and follows every redirect (version 5), counting each feed once. Version 5 also catches two catalog errors:
- County Connection's current feed is filed under Tennessee;
- Butte's B-Line is filed under Montana.

This closes most of the gaps:
- AC Transit (current to April 2027), SamTrans, Tri Delta;
- San Antonio's VIA (5,993 stops; it had no current feed) and Jacksonville's JTA;
- El Paso's Sun Metro.

Block groups with unknown bus frequency, before → after (version 5):
- Alameda: 819 → 33 of 1,134 (19 current feeds instead of 14);
- Contra Costa: 355 → 11 of 708 (County Connection's 1,044 stops found through its redirect);
- San Mateo: 337 → 9 of 500;
- Monterey: 152 → 19 of 272; Butte: 66 → 0 of 200 (its B-Line found through its redirect);
- San Antonio (Bexar), Jacksonville (Duval) and El Paso: from every block group unknown → 13, 0 and 0;
- Sacramento: still 528 of 1,024, because SacRT's schedule ended in April 2025 in both copies.

SacRT, Westchester's Bee-Line and Memphis's MATA are still stale in both copies. New builds use version 5; the counties already built are being re-bundled, gap counties first. Each county's transit metadata (`transit_stops_7_9.meta.json`) records which copy each feed came from.

**Coverage check against OpenStreetMap.** If a block group has 3+ OSM bus stops within 400 m but the feeds have under 30% as many stops there, an operator is missing, so bus frequency is left unknown (not 0) and transit-dependent projects aren't scored there. Examples:
- Alameda before version 4: AC Transit's current feed had no legacy mirror, and its only mirrored copy predated the August 2025 "Realign" redesign, so 819 of 1,134 block groups were unknown (AC Transit's old stop locations counted as evidence of service). With the hosted copy, 33 remain.
- Fresno: 5 of 637 unknown.

## 2b. New data source: state crash records (Illinois, Virginia, Utah, Pennsylvania, Tennessee, Maine)
- **Illinois:** IDOT publishes every reportable crash, 2016–2025, on ArcGIS. Its 2016–2018 extracts store longitude without the minus sign; this is fixed on read, since otherwise those years would silently fall outside every county.
- **Virginia:** VDOT publishes 2017–2025.

Both give KABCO injury counts and pedestrian/bicycle flags, so their counties get the same crash scores (pedestrian/bike crashes, killed or seriously injured) and traffic-calming and crossing candidates as California. Test downloads:
- DuPage: 239,272 crashes, 53,428 with injury, 1,658 pedestrian and 1,734 bicycle;
- Fairfax: 207,469 crashes, 63,973 with injury.

**Utah, Pennsylvania, Tennessee and Maine** were added the same way, through one field-mapped reader (`state_crashes.py`), so each new state is a configuration entry, not new code:
- **Utah:** UDOT's crash locations, 2019–2025, all reportable crashes with killed and serious-injury counts and pedestrian/bicyclist flags.
- **Pennsylvania:** PennDOT's crash tables on PennShare, 2017–2023, all reportable crashes. 2019–2023 has month precision only (no day), which is enough for counting crashes by year. 2017–2018 come from an older table that repeats rows per crash; it was checked against the newer one on 4,957 Pittsburgh crashes of 2019 (all counts and flags agree) and deduplicated.
- **Tennessee:** the Department of Safety's TITAN injury and fatal crashes, 2021 to 2 Dec 2025.
- **Maine:** MaineDOT's ten-year crash locations, 2016–2025, all reportable crashes.
- Test downloads: Salt Lake 188,770 crashes 2019–2025 (60,138 with injury or death); Davidson 51,299 injury crashes 2021–2025.

Crash counts are raw counts over each source's years, and the engine's crash thresholds are fixed. So a 5- or 7-year source (Tennessee, Pennsylvania) yields fewer crash-triggered projects than a 10-year one; the years are always shown.

Two research passes checked every other state (`STATE_CRASH_SOURCES.md`):
- **Partial (not used):** eleven states and DC publish a layer that lacks a field the scores need. Examples: Maryland and Vermont give severity only as fatal/injury/PDO; Minnesota starts in 2025; New Jersey covers pedestrian and bicycle crashes only.
- **Unreachable:** seventeen official sources (states, or a fuller version of a partial one) sit on hosts this environment does not allow, including Arizona (`services6.arcgis.com`), Ohio, Massachusetts, Washington, Iowa and Montana. Allowing those hosts would unlock them with a field map each.
- Counties without a source keep "not screened" notes.

## 3. Accuracy fixes
- **San Francisco crashes:** CCRS has coordinates for only ~30% of SF crashes. SF now uses DataSF's injury-crash table (2016–2025, 30,526 crashes, all but 1 geocoded, same severity classes as CCRS), from the City's ArcGIS org.
- **Crime-data names:** eight DOJ-to-Census name fixes, two of them DOJ misspellings, plus Central Marin Police Authority as one shared rate for Larkspur, Corte Madera and San Anselmo.
- **Heat baseline (investigated, unchanged):** a statewide urbanized-area baseline would shift Orange County by −1.17°F and drop heat projects in 677 block groups. LA's values are centred per county (mean −0.5, sd 3.0) and the engine's thresholds were set on them, so the county-internal baseline stays. The reason is written into the code and the report.
- **Connecticut's planning regions:** in 2022 the Census replaced Connecticut's eight counties with nine planning regions (09110–09190). Tree Equity Score and FARS still use the old county codes, so the first Connecticut build matched no Tree Equity block groups (0 of 731) and no fatal crashes. Both are now selected by location for Connecticut. The Capitol region now has Tree Equity values for 700 of its 731 block groups, and 73 fatal crashes in 2023 and 83 in 2024. Found by `quality.py`.
- **Invalid shapes:** Bucks County, PA failed twice in the street-length step on a shape GEOS rejects (an OpenStreetMap area tagged as a road). Shapes are now repaired only when GEOS rejects them, so valid shapes are measured exactly as before.
- **Census places** are clipped to each county, so neighbouring communities no longer appear as map labels.
- **Creek/river path candidates on wide rivers:** a river's centre line can be far from its banks (the Hudson at Manhattan is about 470 m from the Census shoreline). Paths on the bank were missed, so 45 Hudson "no path alongside" candidates appeared despite the Hudson River Greenway.
  - Fix: where a waterway runs inside a mapped water polygon (OSM water areas or the Census water layer), the path search reaches the shore, plus a 250 m margin on wide rivers because waterfront paths often run behind piers or levees.
  - Manhattan's Hudson candidates fell from 45 to 2.
- **Underground waterways:** any waterway tagged or named as a tunnel is dropped. Brooklyn had 22 candidates along the "Gowanus Canal Flushing Tunnel".
- **Alpine County** (a single block group with rent data suppressed) built only after making the county median rent optional.
- **Park-and-ride lots** are no longer suggested as pocket parks (they are transit infrastructure). Kern's Delano Airport Park-and-Ride was an example.
- **LA wording in agency and process texts.** I ran the page's own agency-name rules over all 162 lead-agency and process texts for Orange, a California county and an out-of-state county, and listed what survived. These references are now local, or generic where no local equivalent is verified:
  - LA organisations: Los Angeles Neighborhood Land Trust, LA Community Garden Council, LA County Department of Parks and Recreation, LA Public Library / LA County Library, LAHSA;
  - Metro, Metro Micro, Metro Bike Share and Measure M local return (Orange County gets OCTA and OCTA Measure M2);
  - "Measure A or Quimby funding".

  Outside California, CEQA, the California Vehicle Code, CARB Clean Mobility, LCTOP and Quimby fees are reworded too. Orange County was affected by most of these.
- **Parcel lines and map credits:** outside LA and Orange County, the page loaded Orange County's parcel tiles (empty there) and showed LA's credit line (LAPD, MyLA311, ...).
  - The parcel layer is now off outside LA and Orange County, and its label says where it exists.
  - The credit line follows the active county: LA's, Orange County's, other California counties' (CA DOJ, CHP, CAL FIRE, CDE, MobilityData), or other states' (NCES, MobilityData). Every source is listed under Methods & Vintages.
- **State transportation departments named:** outside California, texts that name Caltrans in LA's version now name the state's own department, e.g. "PennDOT (the state DOT)", "RIDOT", "UDOT", instead of a generic "the state DOT".
- **CEQA:** "CEQA review" in the transit-oriented-development process texts survived the round-8 rules. These texts appear only near rail stations, so earlier out-of-state test counties never showed them; Philadelphia's test caught it. Any CEQA reference outside California now reads "environmental review".
- **Texts that were true only for LA's and Orange County's builds:**
  - The EV fast-charging hub's reason said OpenStreetMap chargers were used because "the federal AFDC list needs an API key". The national builds load AFDC's fast chargers (USDOT/BTS copy), so the page now says "no public DC fast charger within 800 m (federal AFDC station list)" wherever the county's sources show it loaded.
  - Crash counts in the reasons now carry the county's own years, e.g. "4 pedestrian/bike crashes recorded 2017–2023" in Pennsylvania.
  - The traffic-calming and crossing candidates said "2016–2025" (California's window) everywhere; they now use the county's crash years.
  - The crime tile's "independent police" caption (LA's cities with their own police) now reads "no crime source outside California", or "agency not in CA DOJ data" in other California counties.
- **Housing law outside California:**
  - The zoning block listed California's ADU law, SB 9, SB 79 and AB 2097 for every county. Outside California it now says that state rules differ and California's don't apply.
  - Inside California, counties outside the SCAG region are pointed to "the regional planning agency's" SB 79 map instead of SCAG's.
  - The transit-upzoning policy is titled "transit-oriented zoning" instead of "SB 79 / TOC zoning" outside California.
  - The undergrounding reason no longer mentions LADWP's service area outside LA.
  - The sources table says the tax-rate-area row is not used outside California (the tax-increment calculator models California's EIFDs).
  - Found by a new audit that walks 150 of Philadelphia's block-group panels and lists every California- or LA-specific term outside the labelled evidence lists. What remains is labelled evidence, the "California program; check local programs" rebate notes, and the new notes themselves.
- **Evidence lists** (the cost and effect examples under each project) are mostly LA County projects. Outside LA County they now carry the heading "Evidence and cost examples (mostly from LA County projects, used here for scale)".

## 4. Tests
- **Regional pages:** every page runs the LA + Orange regression (91 checks) and `countytest.js` for each of its counties. Results are in the table below and in `tests/`.

| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |
|---|---|---|---|---|
| `city-pretty-socal.html` | San Diego, Riverside, San Bernardino, Ventura, Imperial | 54.2 MB | 53a7cece0f81 | 298/298 |
| `city-pretty-bay-area.html` | Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma | 51.3 MB | 4338912f90d8 | 455/455 |
| `city-pretty-central-coast.html` | Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito | 40.7 MB | 8c4cc084f801 | 295/295 |
| `city-pretty-central-valley.html` | Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings | 54.7 MB | 975fb07a8ea5 | 424/424 |
| `city-pretty-sacramento-region.html` | Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa | 43.3 MB | c2efd0e7a226 | 493/493 |
| `city-pretty-us-sample.html` | Denver, Cook, Harris, Kings, Fairfax | 64.3 MB | 701837b1c2ca | 271/271 |
| `city-pretty-north-coast-and-mountains.html` | Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity | 62.2 MB | a6c05588c8f0 | 513/513 |
| `city-pretty-sierra-and-gold-country.html` | Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono | 38.8 MB | d2b52ab5979b | 377/377 |
| `city-pretty-us-new-states.html` | Middlesex, Philadelphia, Allegheny, Providence, Salt Lake | 54.3 MB | 68f4e47b0e29 | 283/283 |

All 3,409 of 3,409 checks pass. The Bay Area, Central Coast, Central Valley and Sacramento pages were rebuilt after the transit fix (selection 5) and re-tested.

- **Hosted national site:** LA + Orange 91/91 over plain HTTP; Middlesex MA 38/38, Fairfax VA 42/42, Alameda 42/42 (gzip and plain JSON files both tested).
- **New patch sections 12–17:** each was tested on a page with Providence RI and Philadelphia PA before install (LA + Orange 91/91, Philadelphia 34/34, Providence 38/38).
- **California-term audit:** 150 Philadelphia block-group panels were scanned for California or LA-specific terms outside the labelled evidence lists. This found the housing-law, SB 79 title, CEQA and EIFD texts fixed in section 3.
- **Crash adapters:** each new source was downloaded for a real county and checked against the source's own totals:
  - Pennsylvania's yearly deaths match the state's published counts, per the research pass;
  - the two Pennsylvania tables agree on 4,957 shared crashes;
  - Utah: one row per crash, every Suspected Serious crash but one has an A-injury count, Fatal matches the fatality count;
  - Tennessee and Maine: one row per crash (distinct ids equal rows).
- **County quality:** `county-quality.md` lists every built county. It covers block groups vs the ACS geography file, Tree Equity coverage, crash geocoding, transit feeds and unknowns, and site candidates, and it flags gaps (e.g. Sacramento's SacRT and Memphis's MATA have no current feed).

## 5. Known limits
- **Outside California:**
  - No crime data: the FBI Crime Data Explorer needs an api.data.gov key.
  - No fire-hazard share.
  - Injury crashes need a state or county source. One exists for CA, IL, VA, UT, PA, TN and ME, plus Denver and San Francisco; elsewhere there is only fatal FARS data (see `STATE_CRASH_SOURCES.md`).
- **Crash counts don't compare across sources.** Pedestrian/bicycle crashes per 1,000 residents over each source's years: Cook 9.3, Denver 9.6, DuPage 2.8, Fairfax 2.0, San Diego 1.2. The differences come from:
  - geocoding: CCRS has coordinates for about 60% of crashes in most California counties;
  - definitions: California and Illinois flag pedestrian/bicycle crashes by the first object struck or the first harmful event, while Denver, Virginia, Utah, Pennsylvania, Tennessee and Maine use involvement flags. Measured for California 2024 statewide: 23,425 crashes by first object struck vs 26,563 pedestrian or bicyclist parties in CCRS's parties table (some crashes have more than one), so about 10% are missed. Using the parties table is the fix for a later round;
  - reporting thresholds.

  The scores rank block groups within one county; they should not be read as one county being safer than another.
- **Alaska and Hawaii** can't be built: no OpenStreetMap extract is on a reachable host.
- **Transit gaps** where an operator's schedule ended over a year ago in both of MobilityData's copies: SacRT (Sacramento), Bee-Line (Westchester) and MATA (Memphis). Bus frequency is shown as unknown there. Counties built or re-bundled before transit version 4 still show the older gaps (AC Transit, Tri Delta, SamTrans, VIA, JTA, Sun Metro) until their re-bundle finishes.
- **LA:** the crash-gated recommendations still need an LA rebuild (see `la_crash_count_check.md`).
- **Block groups that reach into water:** Census block-group shapes include water, and the freeway sound-wall inputs (unwalled freeway within 150 m, share of homes within 100 m) treat the whole shape as land. A block group on a river can therefore count a freeway on the far bank; example: MIT's block group in Cambridge, MA, and Storrow Drive across the Charles. This is the same method that reproduces the audited Orange County build. Clipping shapes to land would change every county and needs a full rebuild, so it is left for a later round.
- **Hosts that would unlock more data if allowed in the environment's settings:** `services6.arcgis.com` (Arizona crashes), ODOT TIMS (Ohio), MassDOT's crash server, and the transit operators' own GTFS hosts.
