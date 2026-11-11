# Round 8.6 working notes (facts for the report; each with its evidence file)

## Selection 20 (scratch tests 8 Nov 20:27-21:10; runs in scratchpad/sel20test/runs, comparisons compare_runs.py / compare_pickup.py / compare_20d.py)
- Ended copies (44 feeds / 109 counties on the 8.5 site; definition: calendar ended before the build and the weekday measured is more than
  three weeks before it; 46/111 by the weekday rule alone, 48/115 by the calendar rule alone): copies_meta.jsonl (metadata check of every
  copy): MobilityData's v2 catalog marks 41 of the 44 inactive (2 deprecated, 1 active); producer URLs answer only for reLAXsan (file of 10 Oct 2025) and Yates Transit
  (file re-uploaded 7 Nov 2026; its schedule also ends 31 Dec 2025).
- Selection 19 vs 20 (before the boarding rule), 12 counties: identical stops and buses everywhere except the headway fix (Riverside 29,
  Indian River 1, Monongalia 5 zero-bus stops removed; totals unchanged) and the new meta records (schedule_ended, copies_read).
- Boarding-only departures (20 vs 20b), 12 counties: summed buses/h -1.7% (Pinellas) to -13.0% (Monongalia); transit centres halve
  (North Hanley 25 -> 13, 5th & Missouri 22 -> 11, Oxnard TC 27.5 -> 14, Marietta Transfer Center 33 -> 20.5, Westover Terminal 26 -> 13.5).
- Cal-ITP (20b vs 20d): SF Muni 26 Aug (ended 28 Aug) -> 4 Nov (Bay Area 511 Muni Schedule, runs to 15 Jan 2027), exact positions 3,239 of
  3,240; county buses/h +0.3%. Alameda: LAVTA current (Tri-Valley Wheels, 625/649 exact), Union City Transit counted (163 stops; its
  MobilityData copies are stale), Modesto Area Express via StanRTA (1 stop); county stops 6,870 -> 7,009, buses/h +2.5%.
- Cal-ITP coordinates are rounded to 3 decimals in the State's tables (datastore numeric 37.756 exactly; Muni stop 16186); 3,219 of 3,234
  matched Muni stops equal MobilityData's position rounded to 3 decimals. Match rates for the eight CA candidates (calitp_match.py):
  Muni 99.8% (stop_code), Tri-Valley 96.3%, Nevada County 98.4%, Placer 100%, Tehama 95.0% (by name), Vacaville 100%, Gold Coast 99.1%,
  Yolobus 100%.
- Full selection 20 (20d/20e) vs 20b: controls Fulton GA and Ontario NY identical (Cal-ITP affects California only). Placer 763 -> 801
  stops, buses/h 921 -> 984 (Placer County Transit and Nevada County Connects current from Cal-ITP: ActionFigure and Remix feeds);
  Nevada 369 -> 396, buses/h 395.5 -> 441; Solano 1,567 -> 1,631 (FAST current via Bay Area 511, Rio Vista Delta Breeze newly counted,
  Yolobus to its 28 Oct schedule, still ended 31 Oct); Yolo: Yolobus 28 Oct; Placer's current schedule has no stop in Yolo's box 7-9 am
  (its ended copy had 7); Tehama unchanged (Cal-ITP's agency 'TRAX/ParaTRAX' does not match the feed's agency name); Ventura: Gold Coast
  current (621 stops), all 20b points kept plus 2 (after the fix that takes positions from the newest copy: 20d had taken a 2025 copy's).
- Unreachable feeds (no copy downloadable: tld-4386, Glendale tld-471, tld-4781 in Bay Area boxes): their Cal-ITP copies have no exact
  positions (nothing else read) and are not used; the skip reason says so.

## Storage for the national expansion (measured 23:05)
- Disk allowance ~39 GB, 37 GB used. national/ 22 GB: cache 16 GB (OpenStreetMap: cache/osm 7.0 GB of sub-region files, re-downloaded when
  over a day old; cache/osm_states 7.4 GB of state cuts, linked without an age check), pipeline 4.3 GB, oc_regress 0.8, site84 0.8, site85 0.9.
- 637 county folders = 4.53 GB (7.1 MB each): bg.geojson 1,388 MB, bundle-oc.b64 1,245 MB, places.geojson 663 MB, crashes_local.json
  539 MB, metrics.json 248 MB, tes_ca_latest_csv.zip 200 MB (one 3.4 MB copy per California county: hardlink them), transit_*.sel5
  46 MB (round-8.1 backups, unused).
- The 2,548 counties left would need ~18 GB at today's 7.1 MB each, plus a site copy per county: too much. Needed before batch 8:
  gzip the large per-county JSON inputs (read through one helper that accepts path or path.gz), keep one national site, and drop a
  state's OpenStreetMap cut once its counties are built if re-runs can do without it (keep the county extraction outputs instead).
- Plan (round 8.7, before batch 8): (1) cache/osm's sub-region files are re-downloaded whenever they are over a day old
  (fetch_osm_extract: `time.time() - os.path.getmtime(cp) < 86400`), so keeping them past a batch buys nothing: delete them after each
  batch or re-run (7.0 GB now). (2) "Cold" county folders: once a county is built and exported, pack its inputs (bg.geojson,
  places.geojson, crashes_local.json, metrics.json, transit files) into data_<fips>/inputs.tar.gz and unpack before a re-run; the readers
  (15 scripts for bg.geojson alone) stay unchanged. Expected 7.1 -> ~2.8 MB a county. (3) One national site at a time.
  Budget for all 3,222 counties: ~9 GB of county folders + ~4.8 GB site + 7.4 GB state cuts + ~5 GB other = ~26 GB of ~39.
- metrics_oc v9 (round-8.5 audit, code finding 5): a missing or unreadable stations_not_served.json stops the build instead of reading
  as an empty list (which would silently bring the JTA Skyway's 8 stations back). No data change; tested with the real file (loads
  'jta-skyway') and a missing one (stops). Installed by install86.sh with selection 20.

## GitHub (9 Nov)
- milessilverman/city-pretty (public) holds the round-8.5 site: 1,284 files, 936 MB (index 28.8 MB, 637 bundles 893 MB, sites 19 MB,
  manifest, README, .nojekyll, docs/). Pushed 00:24-00:27 in 6 commits. Pages must be switched on by the owner (the proxy refuses the
  Pages API); github.io itself is refused here, so the live site can only be checked from a browser. The deployments endpoint is readable
  (empty at 00:57 = Pages not yet on).
- Round 8.6's site (~787 counties, ~1.06 GB) exceeds the 1 GB Pages limit: split the county files into a second repository
  (city-pretty-data). Project sites share the origin milessilverman.github.io, so the page fetches ../city-pretty-data/counties/... with
  no cross-origin request; build_site.py passes "<fips>=@gz:<base>" to patch6.py per county, so the split is only the base per county.
- The local clone /home/user/city-pretty holds ~936 MB of git objects (its working tree is hard links into site85). Its removal was
  blocked by the workspace safety check; the owner was told. For round 8.6, update from a blobless clone (--filter=blob:none) or ask
  whether to keep history (the repository grows ~1 GB a round) or replace it with one commit (force-push).
- Pages switched on by the owner at about 01:27 (9 Nov): the "pages build and deployment" run for 0a71468 succeeded (repos API
  has_pages true; deployment to github-pages 01:28:50Z). Asked the owner (01:38) to create city-pretty-data and whether to keep history.

## Selection 21 and singular forms (installed 01:33:38, install86c.sh; text only)
- Found while checking v10 on Sierra (06091): its "Not included" list named ten feeds, none of which runs in Sierra County, e.g. "Torrance
  Transit (MobilityData tld-438: no copy could be downloaded (hosted: <HTTPError 403: 'Forbidden'>; producer URL: URLError(OSError('Tunnel
  connection failed: 403 Fo))". Same text in site85 (delivered round 8.5).
- Measured on site85 (637 bundles): 411 "no copy could be downloaded" entries in 102 counties (CA 56, NC 29, CO 11, VA 3, NY 2, IL 1), all
  with that cut error text; feeds read and listed in every county of their state: Fresno State University tld-4461, City of Manteca
  ntd-90217, Humboldt's tld-4798 (all 56 CA counties), City of Tyler ntd-60089 (43 TX), Citrus County Transit (36 FL), Emory Hospital
  Midtown (27 GA). Cause: catalog rows with no area are tried in every county of their state (selection 7), and a read feed's skip reason
  was recorded before any check of where its stops are.
- fetch_oc selection 21: skip entries record stops_in_county (stops of any kind in the county's padded box); rows tried statewide for want
  of an area carry "unlocated" when no copy could be downloaded; the "counted from other feeds" list is no longer cut at 240 characters.
  Control flow unchanged, so measurements are unchanged.
- build_oc: a skipped feed is listed only where stops_in_county > 0 (missing field: listed, as before); unlocated feeds go to one sentence
  ("Not located: ...: MobilityData's catalog gives these feeds no area, so each was tried in every California county, and none could be
  downloaded: for each, MobilityData's hosted copy is not available (HTTP 403) and the operator's own URL cannot be reached from the build
  machine"); download errors in plain words; long route lists cut at a whole entry ("; and N more").
- Singular forms (site85 counts): "1 feeds" 206 counties, "1 stations" 123, "1 block groups" 65, "1 stops" 3, block-group cells "1 buses/hr"
  10,904 and "1 pts below goal" 2,834, sentences "1 restaurants and cafés" 158, "1 crashes" 9, "Tree canopy is 1 points" 9. Fixed in
  build_oc (fmt_gap, WHY, sources rows); the page template's corridor text "(1 buses/hr)" fixed in w5/in.html (backup in.html.bak_pre86).
  engine.py's three "restaurants and cafés" rationales were left alone (scoring file; they print only for busy strips).
- Test: Sierra scratch build (scratchpad t86b): metrics.json identical to the 01:00 selection-20 build except the new meta fields; bundle
  diff = the transit sources row, then (after the singular forms) "Loaded (1 feed, 3 stops)" only.
- chain86.sh stopped by PID (6838) before its weekday audit; chain86b.sh: rebundle86b (all counties below selection 21) -> 3 more batch-7
  workers -> weekday audit after batch 7. transit_day_audit.py re-reads a meta caught mid-write.

## Storage, measured for round 8.7 (site85)
- Bundles 934 MB, sites 18 MB, index 29 MB. Per bundle (sample of 32, JSON before gzip): layers 5.95 MB of ~7.2 (water 2.61, streets 1.25,
  arterials 0.64, parks 0.63, freeways 0.41), details 0.91. Sierra's water layer: 29,110 LineString features at 5 decimals, each wrapped as
  its own Feature (about 2 MB of wrapper text). Merging lines into MultiLineStrings and simplifying at ~10 m would cut the site well below
  the per-repository 1 GB; to test visually in round 8.7 (a layers_oc change needs a full re-run).

## Site split for GitHub Pages (build_site.py --split, 9 Nov 01:47)
- `build_site.py <out> --split city-pretty:<MB>,city-pretty-data:<MB>[,...]` lays the site out as GitHub serves project sites
  (<out>/<repo>/): the first repository gets index.html, the manifest and the counties in FIPS order up to its MB (60 MB reserved for
  index.html, README and docs), then the next. A county in another repository is fetched from ../<repo>/counties/ (same origin
  <owner>.github.io). Without --split the output is as before. Backup tools/build_site.py.bak_pre86.
- Test (8 finished counties, city-pretty:75 so that 5 went to city-pretty-data): data-src "../city-pretty-data/counties/bundle_08031.json.gz";
  served over HTTP from the parent folder: countytest Jefferson AL (first repository) 38/38, Denver (second) 34/34, 0 page/console errors;
  the server log shows the fetches from /city-pretty-data/counties/.
- regions.json: us-batch-7 added (8 counties of batch 7 in 8 states incl. Guaynabo PR): 47155 Sevier TN, 19061 Dubuque IA, 53021 Franklin WA,
  51770 Roanoke city VA, 36079 Putnam NY, 72061 Guaynabo PR, 41003 Benton OR, 26055 Grand Traverse MI (backup regions.json.bak_pre86).
- Orange (oc_regress) is to be rebuilt with the final build_oc text (singular forms, sources rows), backing up bundle-oc.b64/json first;
  only text may change, then the LA+OC regression.
- Zero-feed counties (round 8.5: 91, e.g. Memphis, Corpus Christi, Savannah, Erie, Tallahassee, Sioux Falls, Fayetteville NC): MobilityData's
  copies ended over a year ago and the operators' download hosts are refused here (93 hosts, scratchpad hosts86.json; top:
  data.trilliumtransit.com 71 feeds in 150 counties). Asked the owner at 01:41 whether to propose them as allowed hosts.
- Calhoun AL (built at 00:19 under v9, re-run by rebundle86b): Gadsden's feed has 22 stops in its padded box, 6-13 km outside the county,
  so 97 block groups became known (0) and 10 near ACTS's ended-feed stops unknown; under v10 the same (OSM maps 0 bus stops in Calhoun),
  which is defensible: no schedule, current or old, has a stop within 400 m of those 97.
- Page singular forms (w5/in.html, after the corridor fix; pre-change copy scratchpad edit86/in.html.pre_plural): bus-stop tooltip
  "1 bus an hour", corridor "where the busiest stop gets 1 bus an hour", "~1 home" (Housing Element, site margin, value gain, sites of a
  plan), "up to 1 home per acre" (zoning), "1 home completed", "this block group" instead of "these 1 block groups" (Orange TRA note), and
  no "#1 of 1 neighborhoods" rank when a county has one neighborhood (Sierra). sites_ui.js: "1 person walking or biking hurt" (backup
  sites_ui.js.bak_pre86). All page scripts parse (node new Function on every code script).

## Selection 22 and 23 (9 Nov 02:00-)
- Selection 22 (installed 02:00:11): the current export's active/future status wins over the legacy catalog's "inactive" (7 US feeds with
  current hosted copies; Tippecanoe IN 0 -> 610 stops from CityBus; Plumas CA +34 (Plumas Transit); Orange FL +96 (I-Ride Trolley)).
- Found next: Indianapolis (Marion IN, built at selection 18) counted only CIRTA's 34 stops: IndyGo's rows are inactive in both catalogs
  (1237: last copy 9 Nov 2023 - 24 Feb 2024; ntd-50050: 6 Mar - 7 Jun 2025; own URL www.indygo.net refused here), so 684 of its 759 block
  groups showed 0 buses an hour and 75 were unknown (OpenStreetMap maps 782 bus stops there). 223 built counties have an inactive catalog
  row overlapping their box with no counted feed of that provider (box test; e.g. MATA's trolley row in Memphis, CAT tld-7925 in Savannah).
- Selection 23 (scratch, t86b): inactive rows (legacy or current export) placed by their box are read after the others, never counted; the
  bus stops of their last copy inside the county's box become gap stops (the existing rule: a block group with a gap stop within 400 m and
  no counted stop is unknown), unless a counted feed has the same agencies; listed as "marked inactive in MobilityData's catalog; its last
  copy ended on <date>" where it has stops in the county and its agency is not counted. Marion IN: 1237 -> 2,698 gap stops, ntd-50050 ->
  2,450.
- build_oc: the status text said unknowns are "where the feeds miss OpenStreetMap's bus stops"; gap stops of ended schedules were already a
  cause (Calhoun AL: 10 unknown block groups, OpenStreetMap maps no bus stop there). Now "where OpenStreetMap or an out-of-date schedule
  shows bus stops that the feeds read do not have".
- Leads (not changed): counties where OpenStreetMap maps >= 100 bus stops and the counted feeds list < 15% of that (8): Marion IN (fixed by
  selection 23), El Paso CO, Alachua FL, Mesa CO (each with 400-1,276 gap stops from ended schedules: their zeros are block groups > 400 m
  from any stop, old or new), Spotsylvania VA (FRED: copies ended or not downloadable), Laramie WY (Cheyenne Transit has no row; Kimball
  County's 6 stops counted), Sutter CA (Yuba-Sutter Transit 79: hosted copy's calendar 1 Nov 2022 - 31 Dec 2026, 2 routes and 4 stops
  with 7-9 am service in the county while OpenStreetMap maps 125: possibly an old schedule kept current by a long calendar; not checkable
  without the operator's feed), San Juan PR (all unknown by the PR rule).
- Page template test (02:13): test-86a page (Sierra 06091 + Flagler 12035) built from w5/in.html and sites_ui.js with the singular-form
  fixes: LA+OC 91/91, Sierra 30/30, Flagler 36/36, 0 page/console errors (page removed afterwards).
- engine.py display text (02:14:55): "1 bus an hour" (7 rationales), "1 pedestrian/bike crash" (5), "1 café within 400 m" (corner store);
  build_oc: one "Not included" entry a feed (the last copy's reason). Sierra rebuilt with the live code: only eifd.note removed, 0 number
  changes.
- Scratch evidence kept in scratchpad/evidence86 (selection 22 and 23 metas and logs); test folders removed (disk 1.2 -> 1.6 GB free).
  Careful: t86b/cache and t86b/data are symlinks to the national cache and data folders.
- REGRESSION FOUND AND FIXED (review lead, 02:20): the page's busUnknown() (tools/patch6.py) showed "unknown" on the Bus service tile only
  where the sources row label starts "GTFS feeds (MobilityData"; round 8.6's build_oc renamed the row ("GTFS feeds (each operator's
  feed: ...)"), so every re-run county would have shown "–" there. patch6 now matches any "GTFS feeds" row, loaded or not (a county with
  no counted feed is unknown everywhere); backup tools/patch6.py.bak_pre86. Checked in a browser (test-86b page, Calhoun AL): block groups
  010150012012 and 010150005001 "Bus service unknown", 010150013001 "0/hr"; no page errors. The county tests do not look at this tile.
- countytest.js: new check 'unknown bus frequency is shown as "unknown"' (first block group with bt null; skipped where none); test-86c (Calhoun): 39/39 incl. the new check; backup tools/countytest.js.bak_pre86.
- Consumers of the sources rows checked after the rewrite (02:35): patch6 busUnknown (fixed above), whyFix's AFDC check (r[3]: the 8
  counties with no AFDC station now keep the OpenStreetMap wording, which is what their distances use), the crash-years insertion (regex
  now accepts '1 ... crash recorded' from the engine's singular form), the page's own override of the Tax-rate row outside California
  (unchanged), regress.js's Orange check of the OCTA calendar (now '8 Nov 2026 to 13 Feb 2027', the old form still accepted; backup
  tools/regress.js.bak_pre86).

## Publishing round 8.6 (plan, disk)
- site86 (~1.15 GB of new .gz files) plus git objects for a fresh commit (~1.2 GB) need ~2.3 GB; free disk is ~1.8 GB during the runs.
  Round 8.5's files are hard-linked three ways (site85, handoff/round8.5, the city-pretty working tree), so deleting site85 frees nothing.
- After batch 7 and the straggler pass, delete cache/osm (sub-region downloads, ~7 GB; fetch_oc re-downloads any over a day old) before
  building site86's git commits; keep cache/osm_states (state cuts for batch 8).
- Publish: site86/city-pretty -> milessilverman/city-pretty, site86/city-pretty-data -> milessilverman/city-pretty-data (owner to create
  the repository and switch Pages on). History: one fresh commit per repository if the owner agrees (force-push), else a commit on top.
- patch6 whyFix (02:36): where the AFDC row exists but lists no station (8 counties), the EV rationale says 'the federal AFDC list has no station near this county' instead of 'needs an API key and was not loaded'.
- in.html (02:45, from the language review; pre-change copy scratchpad edit86/in.html.pre_language): the comparison sentence names the pool ('the 50 block groups in Los Angeles County and <county> most like this one'; it said 'county-wide', but county peers come from both); 'Quick win' and 'The first is the cheapest' only when the first step has a cost; the dining label 'restaurants and cafés within 400 m' (LA's label said ½ mile; the count is within 400 m everywhere, as the Area profile says).
