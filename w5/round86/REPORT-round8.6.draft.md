# City Pretty, round 8.6: current California schedules, boarding departures, every county re-run, 150 more counties (draft)

<!-- DRAFT: numbers marked TBD come from the national re-run (rebundle86a), batch 7, the pages and site86. Evidence: w5/round86/notes.md. -->

Round 8.6 follows round 8.5 (delivered 8 Nov, 19:00 and 20:17). It installs transit selection 20, re-runs every built county at it,
builds batch 7, and corrects round 8.5 where the second half of its audit (completed after delivery) and later checks found errors.

## 1. Bus schedules that have ended (selection 20)
- Rule: a copy whose bus schedule ended before the build is no longer final; the feed's other copies are read, then (California) the
  State's Cal-ITP tables, then the provider's other catalog rows; the first current copy is used, else the ended copy whose bus schedule
  ends last, named on the page ("the newest copy that could be read ends on <date>").
- Outside California: no newer copy could be read for the 44 feeds measured on ended copies (MobilityData's current catalog marks 41
  inactive; the operators' sites are refused here; Yates Transit's own file also ends 31 Dec 2025). TBD: ended feeds after the re-run.

## 2. California: Cal-ITP's statewide tables
- Source, matching rule, rounded positions and the 90% exact-position test. Tested: San Francisco (Muni current, 3,239 of 3,240 stops
  exact), Alameda (Union City Transit counted; LAVTA current), Placer, Nevada, Solano, Ventura, Yolo. TBD: statewide effect.

## 3. A departure is a stop time where a rider can board
- A trip's last stop and pickup_type 1 stop times no longer count (terminals doubled: Oxnard Transit Center 27.5 -> 14, North Hanley
  25 -> 13). Test counties: -1.7% to -13.0% summed buses an hour. TBD: national effect on bus frequency and projects.

## 3b. Catalog statuses (selections 22 and 23)
- 22: a feed the legacy catalog marks inactive but MobilityData's current export marks active is read (7 feeds, all with current hosted
  copies: Tippecanoe IN went from no counted feed to CityBus's 610 stops; Plumas Transit; Orlando's I-Ride Trolley).
- 23: a feed marked inactive is never counted, but its last copy's bus stops mark the block groups near them as unknown where no counted
  feed has that agency (Indianapolis counted only CIRTA while IndyGo's rows are inactive: 684 of 759 block groups showed 0 buses an hour).
  TBD: effect after the re-run.

## 4. Headway stops and the sources row
- 35 stops with 0 buses an hour gone (Riverside 29, Indian River 1, Monongalia 5). Sources row: copy named, ended schedules flagged,
  30 contradictory "Not included" entries in 18 counties removed.
- Selection 21 (text only, installed 01:33): a skipped feed is listed only where it has a stop in the county (round 8.5 listed Fresno
  State University's feed in all 56 California counties and City of Tyler's in 43 Texas counties); feeds tried in every county of their
  state for want of an area in the catalog, of which no copy could be downloaded, are named in one "Not located" sentence (round 8.5: 411
  entries in 102 counties, with cut Python error text such as "Tunnel connection failed: 403 Fo"); errors in plain words. TBD: counts
  after the re-run.
- Singular forms: "1 feed", "1 bus/hr", "1 pt below goal", "1 restaurant or café", "1 crash", "1 point", "1 station", "1 block group"
  (round 8.5: "1 buses/hr" in 10,904 block-group cells, "1 pts below goal" in 2,834, "1 feeds" in 206 counties).

## 5. Every county re-run
- TBD: 637 of 637 exit 0, weekday audit (--all), layer check, transit and station effect against site85.

## 6. Batch 7
- TBD: 150 counties from Sevier County, TN to Greene County, TN, 39 states and 3 Puerto Rico municipios.

## 7. Corrections to round 8.5
(The pre-delivery audit's 113 findings were applied to round 8.5's documents in their 9 Nov revision; these are errors found since,
in round 8.5's delivered site.)
- False zeros: Indianapolis showed 0 buses an hour in 684 of 759 block groups (IndyGo's catalog rows are inactive; selection 23).
- Missing current feeds: 7 feeds the legacy catalog marks inactive have current hosted copies (CityBus of Greater Lafayette: Tippecanoe
  IN had no bus data; selection 22).
- Sources table: "Loaded ✓" where nothing was loaded (91 counties with no counted bus feed, 49 with no Tree Equity value, 8 with no AFDC
  station); a developer note in the Tree Equity status; the EIFD fallback misnamed; the street-tree estimate misdescribed; "current school
  year" for the 2024-25 data; Puerto Rico's places described as city limits; the ACS row claiming tract medians for every field; counts for
  the box around a county read as the county's; no row saying crash or crime data are not connected.
- "Not included" lists: 411 entries in 102 counties named feeds that could not be downloaded with cut Python error text ("Tunnel
  connection failed: 403 Fo"), and feeds with no stop in the county were listed in every county of their state (Fresno State University in
  56 California counties); 11 counties listed one feed twice under two reasons.
- The unknown-bus status said "where the feeds miss OpenStreetMap's bus stops" where an ended schedule's stops were the cause (Calhoun AL).
- Singular forms: "1 buses/hr" in 10,904 block-group cells, "1 pts below goal" 2,834, "1 cafés" in 3,783 corner-store rationales,
  "1 feeds" in 206 counties, and others; the page's own "(1 buses/hr)", "#1 of 1 neighborhoods", "1 people walking or biking hurt".
- Every bundle carried an internal note in a field the page does not show ("tra_oc_2026.geojson ... missing; run fetch_oc.py tra").
- Round 8.6 regression caught before delivery: the renamed transit row stopped the page's "unknown" bus tile (patch6 busUnknown); fixed,
  and countytest.js now checks the tile.

## 7b. Data errors found by the bundle review (fixed 9 Nov, install86h)
A review of the round-8.6 bundles in four lenses (language, sources table, numbers, leaks) found three errors in the data itself. Each was
checked against the code and the source files, fixed, and tested by building the same county twice from the same downloads (old and new
code): Butte CA, Houston AL, San Mateo CA, and Orange County's reference data. Every county is re-run with the fix.
- **Tree canopy gap scaled twice.** Both Tree Equity Score readers already return points (tc_gap × 100); metrics_oc then treated any value
  of 1 or less as a fraction and multiplied it by 100 again, so a gap of 0.1-1.0 point showed as 10-100 points. Before the fix, 2,116 block
  groups in 423 counties showed gaps above 48.5 points, which no 2021 Tree Equity block group has; Orange County had 4. Downstream, the
  engine's own rules then sized street-tree projects without the halving it applies under a 10-point gap, and a few block groups qualified
  for schoolyard greening (gap above 15) on the inflated value. Tests: Houston AL 4 block groups (70 → 0.7 points), Butte 5, Orange 5,
  San Mateo 14.
- **California place names shared by a city and a census-designated place.** acs_place.json was keyed by the name without "city/town/CDP",
  so where two places share a name the row read last won: Paradise (Butte) got the 241 residents of Paradise CDP in Mono County, and El
  Cerrito (Contra Costa) the 5,325 of El Cerrito CDP in Riverside County. Paradise showed 141.1 violent and 398.3 property crimes per 1,000
  residents a year; with the town's own 7,392 residents it is 4.6 and 13.0. El Cerrito's population is now 25,994. (Burbank and Rolling
  Hills had the same error, but Los Angeles County uses its own build.) The incorporated place now wins; the file is rewritten from the
  ACS files already on disk.
- **The sheriff's rate left out unincorporated communities.** The sheriff's row in the DOJ file covers every unincorporated area, census-
  designated places included (contract cities that report their own rows are not in it), but its crimes were divided only by residents
  of block groups outside every city and every CDP, and CDP block groups got no rate. Now the population is every block group whose place
  is not incorporated, plus contract cities with no row of their own whose statistics the DOJ says are in the sheriff's row; those block
  groups get the sheriff's rate, and the crime tile says "one rate for everywhere the sheriff polices: ...". Tests: Butte 41,486 → 81,226
  residents (violent 6.0 → 3.0 per 1,000); San Mateo 55,222 → 148,750 (violent 4.2 → 1.6, property 24.6 → 9.1), including Half Moon Bay,
  Millbrae and San Carlos; Orange County 165,112 residents (violent 3.0 → 2.2, property 5.7 → 4.3), and North Tustin, Rossmoor, Orange Park
  Acres and Bolsa Chica (31 block groups) now have a rate. Before the fix Sacramento's sheriff rate read 63.5 violent crimes per 1,000.
  - Contract cities (11 in 7 counties), each from the DOJ's own notes in its Crimes and Clearances context file (data-openjustice.doj.ca.gov,
    July 2026 release), e.g. "Half Moon Bay Police Department ... disbanded in June [2011] ... Criminal statistics for Half Moon Bay are now
    included in those of the Sheriff's Department", or from the city's page: Half Moon Bay, Millbrae, San Carlos (San Mateo); Willows
    (Glenn; its contract ended 1 July 2026, after the 2025 data year); San Juan Bautista (San Benito); Trinidad and Blue Lake (Humboldt);
    Maricopa (Kern); Colfax and Loomis (Placer); Shasta Lake (Shasta). McFarland, Dunsmuir and Mendota re-formed their departments and keep
    their own rows.
  - Not confirmed, so left without a rate as before: Portola Valley and Woodside (San Mateo), Live Oak (Sutter), Mountain House (San
    Joaquin), San Joaquin (Fresno). Their pages, seen only in search results here, say the sheriff polices them; if so their crimes are in
    the sheriff's row while their residents are not in its population, which overstates those counties' sheriff rates somewhat.
  - Arvin (Kern) has its own police department but no row since 2022 (the DOJ notes it did not report); Fort Jones (Siskiyou) contracts with
    Etna's police. Both stay without a rate.
- Orange County's reference data was regenerated with the fixed code: its metrics differ from round 8.5's only in these fields (and the
  name-source wording); 734 numbers changed in its bundle, all in the 114 block groups whose canopy or crime values changed, in 48 whose
  comparison peers did (gap fractions only), and in the plans, map values and profit summaries built on them (logs/orange86_diff_fix86h.txt).
- Text from the same review, no number changed: "below-median income" now names the cut-off, Los Angeles County's median household income
  of $93,240, and says when income is not published; home values at the ACS top code read "$2M or more"; amounts under $1M print in
  dollars; street-tree counts have thousands separators and, from 3,000 estimated sites, say the size-based estimate means little for so
  large a block group; the undergrounding reason no longer names LADWP outside Los Angeles; the heat sentence gives each value against its
  own county's urban-area average instead of their difference; the crash sentence gives the years counted and says the fatal/severe count is
  of every kind of crash; canopy gaps are rounded, not truncated; "<0.1 mi" instead of "0.0 mi"; the EV sentence names OpenStreetMap
  chargers where the federal fast-charger list has none; a county with no rail station shows "None", not "Loaded (0 stations ...)".

## 7d. Labels, plans and page text found by the consistency review (fixed 10 Nov, install86j)
A fourth review lens (internal wording and consistency) reported 24 items; the 10 an independent checker confirmed are fixed here, the
other 14 (low severity, unchecked when the review hit its usage limit) are listed for round 8.7.
- **Towns and townships.** In the nine states where every acre lies in a city, borough, village, town or township (CT, MA, RI, NJ, NY,
  PA, NH, VT, ME), land outside a Census place was labelled "Unincorporated <County>" and every census-designated place "<Name>
  (unincorporated)": 314 of Connecticut's Capitol Planning Region block groups read "Unincorporated Capitol Planning Region", although
  Connecticut has no county government and no unincorporated land (about 11,000 block groups in the nine states). The pipeline now reads
  the Census county subdivisions (towns and townships with their own government) and labels that land by its town or township ("Town of
  Killingly", "Cumberland Township"); a census-designated place reads "<community> (<town>)", and one that is the whole town takes the
  town's name; land in no governing town reads "<County> (outside any Census place)". Tests: Northeastern Connecticut 65 block groups and
  Adams County PA 48, now 0 "Unincorporated" labels. Other states are unchanged.
- **Neighborhood names from another city.** A block group took the nearest OpenStreetMap neighbourhood label within 2.5 km even when the
  label lay in another city: East Palo Alto was "The Willows" (Menlo Park), South San Francisco "Tanforan" (San Bruno). Now only a label in
  the block group's own city or place is used (San Mateo: 130 block groups renamed; Orange County: 409). Plans regroup accordingly.
- **Police districts.** Census-designated places with their own police district and DOJ row (Broadmoor and Kensington in the Bay Area,
  Lake Shastina, Bear Valley Springs) were given the sheriff's rate and label; they keep their own (Broadmoor 1.1 violent, 6.3 property
  per 1,000) and are left out of the sheriff's population. Three more sheriff contract cities were confirmed once the network opened:
  Woodside (its 2025-2030 agreement), Mountain House and San Joaquin (Fresno County Sheriff's page); 14 in all.
- **Plan steps.** The page's footnote (shared with the LA build) says each step describes the most affected part of a neighborhood and the
  steps after the quick win are ordered by return; the code described the part where the fix was cheapest and ordered by how many parts
  share the gap. It now follows the footnote. Orange County: 1,306 numbers changed, all in plans and profit summaries; no block-group
  number moved (logs/orange86_diff_fix86j.txt).
- **"County area".** Every block group outside Los Angeles showed "County area: Chico - Chico" and the like: the field is LA County's
  Countywide Statistical Area, which the pipeline filled with "<city> - <name>". It is now empty outside LA, and the page hides it for
  bundles built before the fix.
- **Page.** Facility distances (school, library, clinic and others) are listed for every county instead of "Not yet mapped (the LA County
  facilities layer stops at the county line)"; the NEVI label outside California no longer names the California Energy Commission; the
  similarity note no longer lists children for county bundles (their peer match has no children variable); state crash sources cite the
  layers actually read.
- Not fixed: Portola Valley (San Mateo) and Live Oak (Sutter) are policed by their sheriffs by all accounts, but their own and their
  sheriffs' pages refuse automated requests, so they stay without a rate; those counties' sheriff rates may read slightly high.

## 7e. Network and transit (9-10 Nov)
At the owner's request the cloud environment's network was opened to every host (it allowed a fixed list before). 213 operator feed URLs
on 93 hosts had been refused; 83 answered on 9 Nov. Transit selection 24 (no rule change) makes every county try them again. Not every
answer helps: ACTS (Calhoun AL) now downloads, but its schedule ended on 30 Sep 2025, so it is still not counted;
data.trilliumtransit.com (47 feed URLs) no longer resolves. 17 counties with no counted feed are served by hosts that now answer
(among them Memphis, Savannah, Tallahassee, Erie and Sioux Falls); the re-run will show which gain bus data.

## 7f. Site updates while the rebuild runs
The live site got two page updates over round 8.5's county files: 9 Nov 22:58 (96d8c7b: address search, Orange County data fixes) and
10 Nov 03:05 (e5461d1: the page fixes in 7d). Before each push, the page was tested over HTTP with the repository's county files: LA and
Orange 91/91 checks, Wake 37/37, King 39/39, Orange FL 39/39, San Juan 31/31, and the four address searches.

## 7c. Address search
The search box asked only Los Angeles County's assessor parcels, so a street address anywhere else found nothing. Pressing Enter now asks
the U.S. Census Bureau geocoder (its JSONP interface: it sends no CORS header), which returns the coordinates and the 2020 block group,
then OpenStreetMap's Nominatim if the Census has no match (one request per search, never while typing, as its usage policy asks). The page
opens the address's county as a #bg= link would, selects the block group and drops a pin. Los Angeles keeps its parcel search (exact lot)
while LA is open. Tested headless: a Raleigh address from the LA view (Wake County opened, Glenwood South selected), an LA address from the
Wake view (LA opened), a Washington DC address (its county is not on the page: said so), and a nonsense address (not found).

## 8. Tests
- TBD: pages, site86, LA+OC regression, county tests.

## 9. Known limits
- TBD. SacRT has no current schedule anywhere this machine reaches (MobilityData's copies ended Apr 2025; Cal-ITP's dataset is empty).
  Orange keeps its OCTA feed and LA its own bundle: neither uses selection 20's rules yet. Rail-only feeds' calendars (item 6).

## 10. Storage for the national expansion
- Measured and planned in notes.md; round 8.7 work before batch 8. Map layers are ~6 of ~7.2 MB a county bundle (water 2.6 MB:
  Sierra's 29,110 water lines are each their own GeoJSON feature); merging and simplifying them is the main lever.
- GitHub: Pages on since 9 Nov 01:27 (round 8.5). Round 8.6 (~1.15 GB) needs a second repository (city-pretty-data); asked the owner.
