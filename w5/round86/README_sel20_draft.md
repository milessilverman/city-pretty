Round 8.6 (selection 20):
- **An ended copy is not final.** When the copy read has a bus schedule that ended before the build, the feed's other copies are read
  (MobilityData's legacy mirror, the operator's URL), then, in California, the State's Cal-ITP tables, then the provider's other catalog
  rows (deprecated ids, redirects). The first current copy is used; when none is current, the ended copy whose bus schedule ends last is
  used and the meta records `schedule_ended` and `copies_read`; the sources row then says "the newest copy that could be read ends on
  <date>", and its status cell counts such feeds. Outside California no newer copy could be read for any of the 44 feeds measured on an
  ended copy on 8 Nov (MobilityData's current catalog marks 41 of them inactive; the operators' sites are refused by this machine's network
  policy; Yates Transit's own file on NYSDOT's bucket also ends 31 Dec 2025).
- **California: Cal-ITP's statewide tables.** Cal-ITP collects every California feed nightly and publishes the tables on data.ca.gov
  (dataset `cal-itp-gtfs-ingest-pipeline-dataset`, read through the datastore's SQL API; snapshot of 1 Oct 2026). `calitp_index` caches
  the schedule datasets with their agencies and last service dates (`cache/calitp/index.json`, daily); `calitp_zip` rebuilds one dataset as
  a GTFS zip from the tables (pages of 32,000 rows by `_id`; cached per snapshot in `cache/calitp`). A dataset is a copy of a feed when it
  has one to three agencies, one of them the feed's (by `_agency_key`), is not a 'Flex' feed and lists service later than the copies read.
  The tables round stop positions to 3 decimals (about 100 m; Muni's stop 16186 is stored as 37.756, -122.402), so each stop takes its
  position from the feed's other copies (the newest copy's, by stop_id, by stop_code, which Bay Area 511 writes as Muni's ids, or by a
  unique stop name within 0.0012 degrees). A Cal-ITP copy with fewer than 90% of its stops placed that way is not used; a stop without
  an exact position is never merged with a neighbour.
- **A departure is a stop time where a rider can board.** A trip's last stop and stop times with pickup_type 1 (drop-off only) are no
  longer counted. A terminal used to count arriving buses as departures, which doubled transit centres (Oxnard Transit Center 27.5 -> 14
  buses an hour, St. Louis's North Hanley 25 -> 13). The weekday comparison (`_choose_wednesday`'s counts) is unchanged.
- **Headway stops.** A frequencies.txt trip lists a stop only when it departs there 07:00-09:00 (35 stops on the round-8.5 site had
  0 buses an hour: 29 Dana Point trolley stops in Riverside's search box, 1 in Indian River FL, 5 in Monongalia WV).
- **Sources row.** It names the copy read when it is not MobilityData's hosted one, and no longer lists as "Not included" a copy of a
  feed that is counted from another copy (30 such entries in 18 counties on the round-8.5 site, e.g. Gold Coast Transit in Ventura).

Round 8.6 (selection 21, text only; installed 9 Nov 01:33):
- **Skipped feeds are listed where they have a stop.** Each skipped feed records `stops_in_county`, the number of its stops (of any kind)
  inside the county's box (padded by 0.02°). The sources row lists a skipped feed only where that number is above 0; the rest stay in the
  meta for audits. Round 8.5 listed Fresno State University's feed in all 56 California counties and City of Tyler's in 43 Texas counties.
- **Feeds that could not be located.** A catalog row with no area is tried in every county of its state (selection 7). When no copy of it
  can be downloaded, the meta flags it `unlocated` and the sources row names such feeds once, in a "Not located" sentence, instead of
  listing each with its download errors (round 8.5: 411 such entries in 102 counties).
- **Plain errors.** Download errors are written as "MobilityData's hosted copy is not available (HTTP 403)", "the operator's own URL
  cannot be reached from the build machine" and so on, not as cut Python exception texts.
- An empty list of counted feeds reads "none"; a long list of routes counted from other feeds is cut at a whole entry ("; and N more").
- The selection number is in each meta (`selection`: 21); `fetch_gtfs_mdb` re-reads a county's feeds only when its meta has an older
  number, so raising it forces the transit step to run again.

metrics_oc v10 (9 Nov 01:0x): a county where no feed that is read has a listed stop (7-9 am departures) inside the county, while
OpenStreetMap maps 3 or more bus stops in it, has unknown bus frequency in every block group (`coverage.transit.county_unserved`), not 0
from a neighbour's stops (Winnebago IL: 137 zeros and 123 unknown -> 260 unknown). Where OpenStreetMap maps fewer, the values stand: block
groups within 400 m of an ended feed's stops are unknown, the others 0 (Calhoun AL: Gadsden's 22 stops lie 6-13 km outside it).

Build steps (round 8.6):
- `osm_sites.py` (site suggestions) builds a state-sized file's node index on disk one county at a time (a lock in w5/tools), and only
  while the disk has room for it (about 2 bytes per byte of input plus 800 MB): Washington's 440 MB file makes an 872 MB index.
- `build_site.py <out> --split city-pretty:<MB>,city-pretty-data:<MB>` lays the national site out one folder per repository for GitHub
  Pages' 1 GB limit (see Hosted mode).
- Singular forms in the bundles and the page ("1 feed", "1 bus/hr", "1 pt below goal", "1 person walking or biking hurt").

Round 8.6 (selection 22, installed 9 Nov 02:00):
- **The current catalog's "active" counts.** `mdb_catalog_rows` merges MobilityData's legacy catalog with its current export; a row in
  both kept the legacy status, so a feed the legacy catalog marked inactive stayed out even when the current export marked it active.
  Now the current export's active or future status wins. On 9 Nov this concerned 7 US feeds, all with current hosted copies, among them
  CityBus of Greater Lafayette (Tippecanoe IN had no counted feed; now 610 stops), LINK Transit in Wenatchee, Plumas Transit and Orlando's
  I-Ride Trolley. The copy's own calendar still decides whether it is current, as for every feed.

Round 8.6 (selection 23, installed 9 Nov 02:08):
- **Inactive feeds mark gaps.** A feed MobilityData marks inactive (in either catalog) is never counted. Since selection 23 its last copy
  is read after the other feeds when its box overlaps the county, and its bus stops inside the county's box become gap stops, unless a
  counted feed has the same agencies: a block group with such a stop within 400 m and no counted stop has unknown bus frequency, as near
  a schedule that ended over a year ago. The sources row lists it ("marked inactive in MobilityData's catalog; its last copy ended on
  <date>") where it has stops in the county and its agency is not counted. Indianapolis counted only CIRTA while IndyGo's rows are
  inactive (last copies ending 24 Feb 2024 and 7 Jun 2025): 684 of 759 block groups showed 0 buses an hour; now 432 do (more than 400 m
  from any IndyGo stop, old or new) and 327 are unknown.
- The status cell now says unknown block groups are "where OpenStreetMap or an out-of-date schedule shows bus stops that the feeds read
  do not have" (it named OpenStreetMap only, though ended schedules' stops were already a cause).
- Singular forms in the project rationales too (engine.py display strings only; scoring untouched): "1 bus an hour", "1 pedestrian/bike
  crash", "1 café within 400 m" (round 8.5 had 3,783 "1 cafés"). A feed listed under two reasons (two copies read) keeps the last copy's,
  which decided (Tri-Rail 333: "no bus routes").

Sources table (round 8.6, from a review of every row against the code):
- A row is marked loaded only where its source supplied values here: no counted bus feed ("Not loaded: no feed that is read has a
  stop with 7-9 am departures in or near <county>"; 91 counties in round 8.5), no Tree Equity value ("No values here": the 2021 release
  covers Census urbanized areas only and has no Puerto Rico file; 49 counties), no AFDC station in the download (8 counties: OpenStreetMap
  charging stations are used). Partial Tree Equity coverage says "Loaded for N of M block groups".
- Counts for the box around a county (bus stops, state crash reports, AFDC stations) say "in and around <county>".
- New rows say what is not connected: state crash records (crash gaps not scored, crash-based projects not proposed) and crime data
  outside California (the FBI's Crime Data Explorer needs an API key).
- The EIFD fallbacks are named as the page uses them (placeholder shares in California; the calculator covers California only), the
  street-tree estimate is described as coded (about 68 plus 0.11 per acre, halved where the canopy gap is under 10 points), the NCES
  school year is given (2024-25), and dates are written out ("Wed 18 Nov 2026").
- The page finds the transit row by its "GTFS feeds" prefix, whatever the rest of the wording (round 8.6's re-runs had broken the
  "unknown" bus tile, which matched the round-8.5 wording); countytest.js now checks that tile.

Wording of the panels (round 8.6, from a review of the bundles' text against the code; text and the order of plan steps only):
- Dining counts restaurants and cafés within 400 m (as the Area profile says); the gap sentence and the label said ½ mile.
- Bus frequency keeps halves (departures over two hours, so 1.5 buses an hour is common; it printed as 1), says "No bus stop within
  400 m has a 7-9 am departure" instead of "0 buses an hour at the busiest stop", and "under 1 bus" for one departure in two hours.
- Distances in a gap sentence get a second decimal where both would print alike ("0.24 mi; similar neighborhoods 0.18 mi", not 0.2 and
  0.2); "right next to the freeway" instead of "0.00 mi"; "a park lies in this block group" instead of "park 0 m away"; distances of
  1,000 m and more in miles; "+-0.0°F" and "-0.0°F" no longer printed.
- A plan puts its cheapest step first only among steps that have a cost; the page calls the first step a "Quick win" only then.
- The comparison sentence names the pool: "the 50 block groups in Los Angeles County and <county> most like this one".
- Project rationales: LA-specific wording outside LA removed (SCE lines, LA walls, "the LA build's rule"), the crime ratio named as
  LA County's median, shares of a project over 100% or under 1% written out, and modelling shorthand ("uses +0.5%") spelled out.
- Feed labels say "measured on Wed 4 Nov 2026"; feeds whose routes are all counted from another feed get their own sentence
  ("Counted through other feeds"); a Cal-ITP copy that was not used says so.
