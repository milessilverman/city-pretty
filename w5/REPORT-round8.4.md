# City Pretty, round 8.4: rail stations checked against the trains that stop there, Puerto Rico and 150 more counties (8 Nov 2026)

Round 8.4 follows round 8.3. Its main change: a rail station counts only where rail service actually stops. Every county on the national site was re-bundled with it, and batch 5 (the next 150 largest counties, starting with San Juan, Puerto Rico) was built with it from the start.

## 1. Rail stations confirmed by GTFS rail stops
Each block-group panel shows the distance to the nearest rail station (`rm`), and that distance decides several projects:
- bus lanes need no rail within 800 m;
- BRT, none within a mile;
- a share of a new rail station, none within 2.4 km;
- bike share, rail within 813 m.

Round 8.3 dropped stations that OpenStreetMap tags as heritage, tourist, miniature or zoo lines. Some excursion lines are tagged exactly like commuter stations, though, and those still counted. Examples:
- Knoxville's Three Rivers Rambler (`train=yes`, its own network);
- the Stewartstown and Northern Central heritage railways in York County, PA;
- Disney World's monorail and railroad, and Universal's Hogwarts Express (tagged as monorails);
- airport trams such as Harry Reid International's (tagged as light rail).

**The rule.** `fetch_oc.py` (transit selection 9) now also saves the stops of every rail route in the feeds it reads (`transit_rail_stops.json`): current and stale feeds, plus Amtrak's national feed (MobilityData 11). `metrics_oc.confirm_rail_stations` then keeps an OpenStreetMap station when:
1. a GTFS rail stop is within 400 m, or a rail stop of the same name lies 1 to 15 km away (one of the two positions is wrong: Metrolink's feed puts "Moreno Valley / March Field" at Riverside–Hunter Park/UCR, 10 km from the station); or
2. it is a named subway, light-rail or monorail station of a named network or operator that has no current feed here and is not an amusement park, fair, zoo, museum, farm, shop, resort or airport people mover. Zoos, museums, farms, shops, resorts and water parks were added to that list after the review found Jungle Jim's International Market's monorail (Butler County, OH) and Waldameer & Water World's train (Erie, PA). This keeps:
   - transit with no feed here: the Las Vegas Monorail, and San Juan's Tren Urbano, whose operator's feed MobilityData marks inactive;
   - stations newer than a stale feed copy: SacRT's Dos Rios and 7th & Railyards, missing from the stale SacRT feed;
3. or it is named and its operator runs rail routes only in stale feeds here, so the station may be newer than the copy.

Every other station is dropped. A station missing from its operator's current feed is not served. For example, the MBTA's Hastings, Mishawum, Plimptonville and Plymouth stations are still mapped but have no trains in the MBTA's current schedule. Metro Transit's current schedule (from 7 Nov) has no Northstar trains: route 888, the number Northstar used, is a bus route. So Anoka County's four Northstar stations are dropped.

A GTFS stop of a subway, commuter, intercity, monorail or funicular route with no kept station within 150 m is added, under its GTFS station name. That adds, for example:
- DART's new Addison station (Silver Line), not yet in OpenStreetMap;
- stations just across a county line that the county's OpenStreetMap extract leaves out (Davis and Roseville for Sacramento, Metra's DuPage stations for Cook).

A stop named as a rail yard is never added: Metro-North's Highbridge Yard and DART's "EAST TEX YARD LIMIT" appear in the schedules as stops, with no passengers. Tram, light-rail, cable-car and funicular stops only confirm. A streetcar or cable-car stop is a street stop, not a rail station. A first run added San Francisco's cable-car stops and DART's streetcar stops, which DART's feed types as cable trams; those counties were re-run.

**Station names and non-passenger stops (transit selection 15).** Many feeds list each platform or track as its own stop under a parent station. A first pass added such stops under the platform's name, sometimes more than once for a station. Examples: WMATA's "Archives, Green/Yellow Line Center Platform", Caltrain's "Bayshore Caltrain Northbound", RTD's "Peoria Station Track 1", and VRE's tracks named "1" to "4" and "Lead".
- Rail stops now take their parent station's name ("Archives", "Bayshore Station", "Peoria Station", "Spotsylvania"), and a station's platforms are added once, at their centre. That also removes duplicates such as the MBTA's Waltham, whose track 1 lies 250 m from the station.
- Stops where no train lets passengers on or off (pickup and drop-off type 1 on every visit) are left out: Metro-North's Springdale MW Facility, LIRR's Hillside Facility and two crew relief points, UTA's Warm Springs and MTA Maryland's light-rail division. Baltimore's OpenStreetMap stop "Relief Point & Division", confirmed only by that relief point, is dropped with it. SEPTA's "Employee Platform - Employees Only" at 69th Street is left out by name.
- A simulation on every county with today's feeds (`rail15_sim.py`) replays each county's additions with the old and new stops. It reproduces every county's current additions with the old stops, and finds 49 counties whose additions or confirmations change. Those 49 were re-run. Orange County's are unchanged.

Each county's decisions are in `data_<fips>/rail_confirm.json`, and `station84_review.py` lists them all (`station84_review.md`). The sources table has a new row, "GTFS rail stops", with the county's counts.

**Effect** (`station_effect.py`, against the round-8.3 site on the 336 counties both have; `logs/station_effect84_table.md`):
- The station layers hold 7,910 stations, against 7,475 in round 8.3.
- Of 143,333 block groups, the rail distance is newly known in 2,043, shorter in 2,453 and longer in 14,900.
- 5,792 block groups no longer have any rail station. Each is in a county whose only mapped stations were excursion or unserved ones: 22 counties' station layers are now empty, among them Berks, Lehigh and Luzerne PA, Tulsa OK, Hamilton and Knox TN, and Anoka MN.
- 154 counties have no rail-distance change.
- Projects that depend on the rail distance (bus lanes, BRT, a share of a new station, bike share) change in 27 block groups. No block group's top-ranked project changes.
- Across all 487 pipeline counties, 7,011 stations are confirmed by a stop, 60 are kept by type, none by operator, 668 are dropped and 1,072 are added.

## 2. LA and Orange County: the same check
LA's and Orange's bundles are older builds that the round-8.4 re-bundle does not touch, so both were checked against their GTFS rail stops (LA Metro Rail, Metrolink and Amtrak; 175 stops in LA's area). Both pass the LA + Orange regression (91/91) on a page with the fixes.

**LA County** (`tools/la_station_fix.py`, applied by `patch5.py` step 2c with a check of every old value). 16 of the 192 stations in LA's layer have no rail stop within 400 m, and none is transit:
- Disneyland's park trains and monorail (7);
- Knott's Berry Farm's Calico Railroad and Camp Snoopy Depot (3);
- the Getty Center tram's two stations;
- the Fillmore & Western heritage railway's Fillmore and Piru (Pasadena's "Fillmore" A Line station stays);
- two unnamed points near Tustin.

They are removed from the map. In the 78 block groups whose nearest station was one of them:
- the rail distance (panel tile and zoning test) now measures the nearest served station, e.g. Bel-Air: 0.4 mi (Getty tram) becomes 3.9 mi (Expo/Bundy);
- 37 rail-gap texts name the served station ("The nearest rail station is Calico Railroad, 4.9 mi away" becomes "…is Norwalk, 5.6 mi away");
- 8 "rail nearby" strengths are removed;
- 3 transit-upzoning rows are removed (two in Brentwood, one in Bel-Air), since those areas have no rail within 810 m and no buses;
- 2 rows quoting the distance are updated.

Outside those 78 block groups:
- 14 neighborhood-plan texts are corrected or removed, including Bel-Air's "The Lower Tram Station station puts parts of the area within ½ mile of rail, where SB 79 and AB 2097 now allow more homes";
- 88 underused-site listings name their nearest served station.

No site's home estimate depended on these stations; the only one within ½ mile is a 1.46-acre lot already counted at single-family density. No block group's top projects change. Not done: rows that need no rail nearby (bus lanes, BRT, a share of a new station) are not added where the distance grew, because `engine.py` does not reproduce LA's own rules for them (`validate_la.py`: BRT recall 0.23, new station 0.20, bus lanes precision 0.64). The gap percentiles keep their old values.

**Orange County** (rebuilt through the pipeline). Orange keeps OCTA's own bus feed, so the transit step never read MobilityData for it, and its stations were never checked. Its bundle on every page is the regression copy (`oc_regress`, built 7 Nov 03:30), and 8 of its 19 "rail stations" were theme-park rides:
- Disneyland Railroad: Main Street, New Orleans Square, Mickey's Toontown, Fantasyland and Tomorrowland;
- the Disneyland Monorail: Tomorrowland and Downtown Disney;
- Knott's Berry Farm: Camp Snoopy Depot.

Anaheim's ARTIC (Metrolink and Amtrak) was missing. For 521 of Orange's 2,049 block groups, the nearest "rail station" was one of those rides.

`pipeline/oc_rail_stops.py` now reads the rail stops of the feeds covering Orange (Metrolink, Amtrak and others), and Orange was rebuilt with them:
- the 8 rides are dropped;
- ARTIC is in;
- the rail distance changed in 874 block groups:
  - longer in 375, where a ride had been the nearest station;
  - shorter in 499, mostly near ARTIC and the stations just across the county line;
- the rail gap ("Rail is 4.0 mi away") now appears in 148 panels and is gone from 102.

The rebuild also brings Orange the land-only block-group shapes the other counties got in round 8.1. Fifteen coastal block groups in Huntington Beach, Laguna Beach and Newport Beach were "Unincorporated Orange County" only because their old shapes reached into the ocean; they now belong to their cities, with the matching police agency and tax shares. No block group's top project changed (28,448 → 28,474 rows), and the LA + Orange regression passes 91/91 on a page with the new bundle.

## 3. Other fixes
- **Bus frequency on a holiday (transit selections 10–16).** The re-bundle re-read every county's bus feeds. Bus frequency is measured on one representative Wednesday per feed, the one nearest today. After midnight on 8 Nov that became 11 Nov 2026, Veterans Day, when many operators run a Saturday or Sunday schedule or drop school and peak extras. Compared with round 8.3, bus frequency fell in 27 counties (in at least 10 block groups each). In 13 of them, the median block group lost a third or more of its buses: Columbus, Providence, Rochester, Stockton, Arlington VA, Springfield MA and others (`logs/transit84_effect_table_pre_sel10.md`).
  - **Selection 10** took the nearest Wednesday, within three weeks, with at least 90% of the busiest one's trips. Providence's RIPTA went back to 4 Nov (5,350 buses an hour summed over its stops, against 2,320), and 105 counties were re-run.
  - **The checks found two problems with it.** Colusa County's only stop vanished from its map (Lake Transit), and Rochester stayed low: RTS runs 91% of its day's trips on 11 Nov, but not its school and peak services, which are what the 07:00–09:00 count measures.
  - **Selection 11** compares the candidate Wednesdays by that count itself, 07:00–09:00 bus departures. Rochester's RTS goes back to 4 Nov: 5,304 buses an hour summed over stops, against 4,143 on Veterans Day. Operators that run normal service on 11 Nov keep that day.
  - **Selection 12** never takes a Wednesday on a fixed-date holiday (1 Jan, 19 Jun, 4 Jul, 11 Nov, 24, 25 and 31 Dec). Riverside Transit Agency runs its weekday schedule on Veterans Day without school trips (2.5 → 2 buses an hour at Hemet stops), a cut too small for the 90% test.
  - After selections 11 and 12, the counties still measured on 11 Nov whose bus data or stop layer differed from round 8.3, and every batch-5 county measured then, were re-run (`rebundle84i.sh`, `rebundle84j.sh`).
  - **Selections 13 and 14: a busiest day that is a feed error.** Comparing the result with round 8.3 found one more problem: the busiest Wednesday can itself be a feed error. SRTA's feed (New Bedford and Fall River) adds its Thursday schedule on 25 Nov without removing the regular one: 5,980 departures, against 4,426 on every other Wednesday. Every normal Wednesday then failed the 90% test, and bus frequency rose in 77 Bristol County block groups. Middletown Area Transit's feed overlaps its old and new schedules from 3 to 9 Nov, which doubles 4 Nov (2,741 departures, against 1,417 before and 1,324 after).
    - Selection 13 took as full service the second-highest count among the candidates. The audit below found that it fails with two candidates: Greater Portland Metro's feed starts on 7 Nov, so it has only 18 Nov (3,066 departures, a school day) and 25 Nov (2,744, no school). It also judged a feed whose schedule had ended on its whole calendar: Placer County Transit's spring schedule instead of its last.
    - **Selection 14** defines full service as the highest count that at least two candidate Wednesdays reach within 10% (or the highest, when no two are that close), and measures the nearest Wednesday within 10% of it. A feed with no Wednesday within three weeks of today is judged on the three weeks around its own Wednesday nearest today. Bristol is back to 4 Nov for all six feeds, and Middletown Area Transit is measured on its new schedule (18 Nov). Selection 15 is the rail-stop change in section 1, with selection 14's weekday rule; selection 16, below, is the final rule.
  - **Selection 16: when a schedule really ends.** A feed is skipped when its schedule ended over a year ago. That end used to be the calendar's last date; it is now the last date on which a service with bus trips runs. Cherriots' copy (Salem, OR; its buses reach Clackamas County) has bus trips to 3 May 2025, plus a service with no trips to 2 Jan 2026. It was therefore measured on 30 Apr 2025 as if current, and selection 14 found no trips in its last weeks. It is now skipped, and the feed's other copies are tried. A feed whose calendar covers today but runs no service on any Wednesday within three weeks now counts no buses, where it used to be measured on its busiest Wednesday ever: Tri-Rail's airport shuttle, whose weekday service ended on 12 Aug 2025, was counted at its 2024 frequency.
  - **A lapsed schedule is measured on its last full Wednesday.** Dutchess County's feed ends its main weekday service on 28 Oct and publishes nothing after: 1,717 departures on 28 Oct, 216 from 4 Nov on. So 28 Oct is measured, as under selection 12. Round 8.3 had measured 4 Nov and counted only the 216, so Dutchess's bus frequency is now higher than round 8.3's in 50 block groups.
  - **Audit of every feed** (`transit_day_audit.py`, `logs/transit_day_audit.md`): it downloads each feed the counties use, counts every Wednesday's 07:00–09:00 departures and active services, and replays each county's recorded selection on its build date. It ran three times, for selections 13, 14 and 16, each on every county built before that selection (`logs/transit_day_audit_sel13.md`, `logs/transit_day_audit_sel14.md`, `logs/transit_day_audit.md`). The last run covers 539 feeds in 443 counties: 1,596 of 1,600 county feeds reproduce the recorded day exactly, and the other 4 feeds were updated since. It lists 46 counties where some feed's selection-16 day runs other services than the recorded one. Most were built after midnight under selection 9 and still name 11 Nov for a feed whose holiday changes fall outside the county (Merced County Transit's 13 stops inside Mariposa County's box), so their bus values matched round 8.3 and the earlier passes left them alone. All were re-run together with the 49 counties whose stations change with selection 15 (`rebundle84k.sh`, `rebundle84l.sh`). Thirteen counties queued only as a precaution were left as built: twelve because the simulation shows their stations unchanged, and Sandoval, NM because Rio Metro's feed cannot be downloaded today (a re-run would lose its Rail Runner stops). Each feed's candidate counts are now in the county's transit meta (`wednesdays_7_9am_departures`).
  - **After all the re-runs** (`logs/transit84_effect_table.md`), bus frequency matches round 8.3 in 326 of the 336 counties. The other 10:
    - Marion County, OR (Salem): 73 block groups go from 0 buses to unknown. Round 8.3 read Cherriots' expired copy as current and counted none of its buses; Cherriots' 775 stops are now marked as a gap. Its current feed, on cherriots.org, is refused by this machine's network.
    - Dutchess County, NY: 50 up (its lapsed schedule, above).
    - Cumberland County, ME: 24 up. Greater Portland Metro's new feed starts on 7 Nov, measured on 18 Nov.
    - Hennepin, Ramsey and Washington, MN: 9 block groups change and 7 gain a known frequency. Metro Transit's new schedule starts on 7 Nov, measured on 18 Nov.
    - El Paso, TX (6), Denver (2) and Adams (1), CO, and South Central Connecticut (1): updated feeds, among them El Paso's new transportation-authority feed, which starts on 8 Nov.
    - No block group's top-ranked project changes.
- **Site suggestions anchored on a dropped station:** an EV-hub suggestion "at the parking lot of <station> (rail station)" needs a real station. `sites.py` now leaves out stations the county's check dropped. `tools/sites_drop_stations.py` removed the suggestions already built on one, e.g. Hennepin's Blake Road and Golden Triangle (Green Line Extension, not open) and Queens' AirTrain stop at Lefferts Boulevard. 21 suggestions in 18 counties were removed (`logs/sites_drop_stations.log`); the final run found none more.
- **Station tooltips:** names that already end in "Station" no longer read "… Station station" (`patch6.py` section 21).

## 4. Batch 5: 150 more counties, six new states and Puerto Rico
**All 150 counties were built**, each through the whole pipeline and with its site suggestions, from 22:21 on 7 Nov to 06:51 on 8 Nov. The round-8.4 station rule applied from the start. 79 of them were re-run by the transit passes. With Laramie County, WY, the pipeline has built 487 counties; with LA and Orange, the national site has 489.

The batch is the 150 largest counties not built before (populations from 336,160 (San Juan) down to 145,807 (ACS 2020-2024)). It adds the first counties in six states (Mississippi, Montana, North Dakota, South Dakota, Vermont, West Virginia) and three Puerto Rico municipios (San Juan, Bayamón, Carolina). Wyoming's largest county, Laramie, was built with them, so every state with an OpenStreetMap file now has at least one county: the 48 contiguous states, DC and Puerto Rico.

**Puerto Rico.** The pipeline treats a municipio like a county. Three things are specific to it:
- Puerto Rico has no incorporated places. Its census-designated places are the municipio's own town centre and communities, so they are now named without "(unincorporated)", and the rest of the municipio is "San Juan Municipio" rather than "Unincorporated San Juan Municipio" (`region.py`, `sources_oc.py`).
- The page title used to add "County" after the name ("San Juan Municipio County"); it now uses the full name (`patch6.py` section 3).
- San Juan's buses: MobilityData lists the Autoridad de Transporte Integrado's feed (AMA buses, Tren Urbano) as inactive, so it is not read. Only the Bayamón municipal feed reaches the county (2 stops), and most block groups show bus frequency as unknown rather than 0. Bayamón's own feed gives bus frequency for 110 of Bayamón's 149 block groups. Carolina has no bus feed at all, so its 128 block groups all show unknown. Tren Urbano's 14 stations count as rail stations under rule 2 (tagged subway, network ATI).


## 5. Tests
**Regional pages:** 13 pages, 4,729 of 4,729 checks passed, with no page or console errors (`regional-pages.md`). Each page was tested with the LA + Orange regression (91 checks) and `countytest.js` for every other county on it.

| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |
|---|---|---|---|---|
| `city-pretty-socal.html` | San Diego, Riverside, San Bernardino, Ventura, Imperial | 54.2 MB | a3afc65cbacf | 298/298 |
| `city-pretty-bay-area.html` | Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma | 51.3 MB | 0e5687a3dc56 | 455/455 |
| `city-pretty-central-coast.html` | Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, San Benito | 40.7 MB | c61e1098be4e | 295/295 |
| `city-pretty-central-valley.html` | Fresno, Kern, San Joaquin, Stanislaus, Tulare, Merced, Madera, Kings | 54.7 MB | 655d6abbfbea | 424/424 |
| `city-pretty-sacramento-region.html` | Sacramento, Placer, Yolo, El Dorado, Sutter, Yuba, Nevada, Butte, Glenn, Colusa | 43.3 MB | 29dc0faec48e | 493/493 |
| `city-pretty-us-sample.html` | Denver, Cook, Harris, Kings, Fairfax | 64.3 MB | d95e6edc42ef | 271/271 |
| `city-pretty-north-coast-and-mountains.html` | Del Norte, Humboldt, Lake, Mendocino, Lassen, Modoc, Plumas, Shasta, Siskiyou, Tehama, Trinity | 62.2 MB | a58edabd5ce8 | 513/513 |
| `city-pretty-sierra-and-gold-country.html` | Sierra, Alpine, Amador, Calaveras, Mariposa, Tuolumne, Inyo, Mono | 38.8 MB | 7aefcbd99322 | 377/377 |
| `city-pretty-us-new-states.html` | Middlesex, Philadelphia, Allegheny, Providence, Salt Lake | 54.3 MB | 28d131b174e1 | 283/283 |
| `city-pretty-us-metros-2.html` | Maricopa, Clark, King, Cuyahoga, St. Louis, Davidson | 68.1 MB | 6336f3a63137 | 317/317 |
| `city-pretty-us-florida.html` | Miami-Dade, Broward, Palm Beach, Orange, Hillsborough, Duval | 53.1 MB | ec7ed68ee107 | 315/315 |
| `city-pretty-us-metros-3.html` | Milwaukee, Hennepin, Franklin, Hamilton, Westchester, Wake | 51.5 MB | 9aed7410501f | 313/313 |
| `city-pretty-us-new-states-2.html` | San Juan Municipio, Hinds, Yellowstone, Cass, Minnehaha, Chittenden, Kanawha, Laramie | 37.3 MB | dc508d98b946 | 375/375 |

- **National site (`site84`: 487 pipeline counties plus LA and Orange, 825 MB, served over plain HTTP):** LA + Orange 91/91, King WA 38/38, Hamilton OH 38/38, Forsyth NC 36/36, Philadelphia 34/34, San Juan PR 30/30; no page or console errors.
- **LA's edited panels** (`tools/lacheck84.js`, on the final `city-pretty-socal.html`): 15/15, no page errors. The check opens four of the 78 edited block groups (Bel-Air, Brentwood, Westwood, Lakewood) and confirms:
  - each panel shows the served station and distance;
  - none shows a removed station, the old distance, a removed upzoning row or the removed "within ½ mile of rail" sentence;
  - LA's stations layer holds no park or tram station.
- **Station rule before install:**
  - a dry run on 10 counties (Sacramento, York PA, Knox, Collin, Clark NV, Miami-Dade, Kings, Cook, Allegheny, Orange FL);
  - two full scratch builds (Knox, Orange FL) through every pipeline step;
  - each later refinement replayed on the counties already built (their logged station tags through the new function). The changes were exactly the intended ones before it was installed.
- **Re-bundles:**
  - 336 of 336 finished with exit 0, plus eleven re-run passes (84b–84l, 401 county builds, all exit 0) and three single rebuilds (San Juan twice, Stafford VA);
  - every county's station decisions were read (`station84_review.md`): 422 counties at 03:28, then the rest of batch 5. After the last re-runs, the changes against the 05:05 review were read again: 42 counties, all from selection 15 (`logs/station84_diff_after_review.txt`). That makes 487 counties;
  - `layer_check.py` against round 8.3: OK for all 336 counties. No map layer emptied and no block-group count changed; 22 station layers emptied, as listed above.
- **San Juan, PR:** a test page with LA, Orange and the eight counties of the new page passed:
  - LA + Orange 91/91;
  - San Juan 30/30;
  - every other county all checks after the one test change below.
- **Transit selections 10–16** were tested before install:
  - selection 10 on Providence: RIPTA back to 4 Nov, 2,562 stops served against 1,871 on Veterans Day;
  - selection 11 on Rochester: RTS back to 4 Nov, 5,304 buses an hour summed over stops against 4,143;
  - selections 13 and 14 on Bristol MA, Ada ID, Dutchess NY and Cumberland ME (transit step only): SRTA and Valley Regional Transit back to 4 Nov, Dutchess County on 28 Oct, Greater Portland Metro on 18 Nov;
  - selection 14's day choice on 12 cases (the feeds above, Placer's and FAST's ended schedules, a schedule ending on 31 Dec 2025, Rochester, a feed with no departures, one candidate, holidays only).
  - selection 16's rule on six feeds through the audit's own reading (Cherriots stale, Tri-Rail's shuttle no service, SRTA, Dutchess County, Greater Portland Metro and Placer County Transit unchanged);
  - selection 15 on Arlington VA (transit step only: 82 rail stops, all under station names, 77 grouped by parent station) and Stafford VA (full build: VRE's track "1" added as Spotsylvania, as the simulation predicted).

  After the re-runs, bus frequency matches round 8.3 in 326 of 336 counties; the 10 that differ are explained in section 3.
- **County quality:** `county-quality.md`, regenerated after the re-bundles.
- **One test change:** `countytest.js`'s "search index has this county" now asks for at least 10 names, or every name the county has if fewer. It used to ask for one name per 20 block groups. Hinds County, MS (Jackson) has no OpenStreetMap neighborhood labels, so its 189 block groups are named by their 5 cities, and the old rule failed it (35/36). With the change it passes 36/36.

## 6. Known limits
- **San Juan's and Carolina's buses:** see section 4.
- **Closed stations of operators with a stale feed** still count, since a station missing from a stale copy may simply be newer than the copy.
- **Seasonal and special-event stations** missing from today's schedule are dropped. Examples: Amtrak's Old Orchard Beach, ME (Downeaster, summer only); Caltrain's Stanford (game days); NJ Transit's Monmouth Park (race days).
- **Lines whose operator's feed has buses but no rail are kept as mapped:** Buffalo's Metro Rail (NFTA's current feed, Transitland 401, has no rail routes, but the line runs) and Jacksonville's Skyway (JTA's current feed has no Skyway routes). For the Skyway, the feeds cannot tell whether it still runs.
- **Rail-only feeds count as current:** the transit step does not record their calendars.
- **Duplicate station dots:** 112 added GTFS stops lie 150–300 m from the mapped station they duplicate, just outside the 150 m merge distance. Examples: Metro-North's Milford and Waterbury, Caltrain's Bayshore, and Amtrak's "Boston" at South Station (Amtrak's feed names its stops by city). A panel's rail distance can therefore measure to the GTFS dot, a difference under 300 m, and its gap text then uses the feed's name. The next round widens the merge distance.
- **Feeds this machine cannot reach:** Cherriots' current feed (cherriots.org) is refused by the network proxy, and Rio Metro's MobilityData copy is not a valid zip today. Salem shows bus frequency as unknown, and Sandoval keeps its earlier build.
- **Schedule changes within three weeks:** where a feed's schedule changes by more than 10% within three weeks of the build, the busier schedule is measured, whether it is the coming one or the one before. Examples: Tri-Valley Transit (Vermont) from 18 Nov, 522 → 638 departures 07:00–09:00; LADOT's feed from 11 Nov, 11,654 → 15,055. The same rule measures a lapsed schedule on its last full Wednesday (Dutchess County), and a feed cannot tell a lapse from a cut.
- **National coverage and disk:** a built county keeps about 8 MB of data plus about 2 MB on the national site. The remaining ~2,700 counties would need about 35 GB, more than this machine has free (about 5 GB). The queue tools (`make_queue.py --top N`, `queue_worker.sh`, `build_site.py`) run unchanged on a larger machine.
- Unchanged from round 8.3: bus operators without a current schedule (SacRT, MATA, Mountain Metro, and others), feeds taken as published, no earthquake-retrofit row or fire hazard outside California, crash data only where a state or county source exists, Alaska and Hawaii not built.
