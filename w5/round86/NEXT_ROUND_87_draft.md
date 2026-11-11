# Next round (8.7): draft, from round 8.6's findings and the owner's requests of 9 Nov

## 0. The owner's requests (9 Nov 2026; the four AI lists are in w5/round87/ai_lists_user_2026-11-09.md)
Improvements must depend on location, not on Los Angeles alone; the other assistants' lists are to be implemented; larger projects
(a new freeway, high-speed rail such as Cheyenne-Pueblo, a transmission line on the same corridor) and planned metro lines with their
price effects and timing ("if the prices have already gone up or when they likely will"); specific lots on the map; address search.
Every number still needs a primary source (the lists are leads); research for each part runs as a workflow with an independent check of
every citation (round 8.7 evidence: wf_cded0b30-748).
- 0a. Address search: done in round 8.6 (report 7c). Lots: Los Angeles and Orange already draw parcel lines from their counties' services;
  elsewhere, query each county's or state's open parcel service on demand (registry by county, from the parcel research), with lot
  outline, parcel number, land use and assessed value where published; hosting every US parcel is not possible on GitHub Pages.
- 0b. Location-aware projects: map every item of the four lists to an existing type (81), a new type, owner-level, quality-of-life only,
  or "not modelled" with the reason; add types triggered by local data (snow, flood and hurricane, wildfire, heat and drought, tornado,
  shrinking cities, rural, suburban, home repair), each with a sourced cost and effect.
- 0c. Big projects and planned lines: agencies' adopted plans (stations, milestones), station-area effects by distance, and price indexes
  near future stations against the county since announcement (FHFA/ZIP indexes, terms permitting); what-if corridors with costs per mile.
  Evidence so far points to gains near stations, not along whole corridors, and small losses next to high-voltage lines; show both.
- 0d. Street-tree estimate in very large block groups: the national engine has no cap (604 rows in 149 counties above 10,000 trees, up to
  445,746); Los Angeles's rows stop at 3,000 trees per block group (060379001021: ~11,755 sites, 3,000 trees). A cap changes project
  numbers, so it waits for the owner's decision.

## 1. Bus schedules this machine cannot reach
- 92 built counties had no counted feed on 9 Nov (16.4 million people; Memphis, Brownsville, Little Rock, Killeen, Corpus Christi,
  Savannah, Erie, Tallahassee, Sioux Falls, Fayetteville NC). Their agencies' MobilityData copies ended over a year ago, or the catalog
  has no row for them; their own download URLs are on hosts this environment's network refuses (93 hosts, `logs/r86_transit_gaps.md`;
  `data.trilliumtransit.com` alone serves 71 feeds in 150 counties). With the owner's approval, add the hosts (exact names) and re-run the
  counties whose feeds use them; the pipeline already tries the operator's URL after MobilityData's copies.
- Inactive rows (selection 23) are read for gap stops only. Where an inactive row's own URL is reachable and current (IndyGo's
  www.indygo.net), read it as a candidate.
- Counties with no catalog row for their main operator (Cheyenne Transit, Brownsville Metro, Hill Country Transit's HOP is inactive):
  Transitland's API (needs a key) or state portals.
- Long calendars that may hide old schedules (Yuba-Sutter Transit 79: 1 Nov 2022 - 31 Dec 2026, 4 stops with 7-9 am service in Sutter
  County while OpenStreetMap maps 125): compare a feed's stops with OpenStreetMap's and flag large shortfalls.

## 2. Storage for the national expansion (3,222 counties)
- Map layers are ~6 of ~7.2 MB a county bundle (JSON before gzip; water 2.6 MB: Sierra's 29,110 water lines are each a GeoJSON Feature).
  Merge lines into MultiLineStrings and simplify at about 10 m; check visually at every zoom level the page allows; full re-run.
- GitHub Pages: 1 GB a site; `build_site.py --split` spreads the counties over several repositories (city-pretty, city-pretty-data,
  city-pretty-data-2, ...). Replace each repository's history with one commit per round (each grows ~1 GB a round otherwise).
- Machine disk (this container): delete cache/osm sub-region files over a day old after each batch (re-downloaded anyway), pack cold
  county inputs, keep one national site at a time.

## 3. Orange and LA on the national rules
- Orange keeps OCTA's own feed and LA its own bundle: neither uses selections 20-23 (ended copies, boarding departures, inactive gap
  stops). Move Orange to the MobilityData path with OCTA's feed as a pinned candidate; check LA's bus values against the national method.

## 4. Rail calendars
- Rail-only feeds' calendars are not judged (a rail stop counts if its feed has the route): carry selection 20's ended-copy rule to rail
  stops (item 6 of round 8.5's plan).

## 5. Review of metrics v10 and selection 23 counties
- List every county where v10 (no listed stop inside the county) or selection 23 (inactive gap stops) changed values, and read a sample
  against the operators' maps.

## 6. Consistency review: 14 low-severity items not yet checked (the checks hit the usage limit on 10 Nov)
Each is a lead from the review, to be checked against the code and a bundle before any change:
- [10] Airport people-mover stations within 400 m of a GTFS rail stop are kept as rail stations, contrary to the sources row. The map shows tooltips like 'Grand Hyatt station'. (metrics_oc.py:208-209 (rule 1 without _airside))
- [11] For the playground and pedestrian/bike-crash gaps no LA block group has a value. Those 'similar neighborhoods' medians come only from the county's own block groups among the 50 (as few as 20). (build_oc.py:447-449 (pv filtered, minimum 20) and 501 (peer_note))
- [12] The 8.6 rewording turned 'no <county> sidewalk survey loaded' into a claim that none exists. (engine.py:255)
- [13] The street-tree row says there is no city tree survey, while the sources row for the same county says only that none is connected. (engine.py:150)
- [14] The EV-hub reason in the bundle says AFDC was not loaded and OpenStreetMap was used. The same bundle's sources row says the AFDC list was loaded, and m.ev comes from it. (engine.py:289)
- [15] Plan strength labels come straight from LA's gap_labels, which contradict the 8.6 wording. (build_oc.py:488 (labels = LA gap_labels + dining only))
- [16] The same comparison set is called 'similar neighborhoods' in the gap sentences, 'similar areas' on the page and '50 most similar block groups' in the peer note. 'Neighborhood' is also used for a whole city or the whole unincorporated county. (build_oc.py:361-399 (WHY wording))
- [17] The pocket-park reason still prints metres above 1,000; every other row now switches to miles from 1,000 m. (engine.py:188)
- [18] ISO dates appear in the sources table next to dates written '4 Nov 2026'. (fetch_oc.py:1186 (last.isoformat()), not reformatted by build_oc.py:95-127 (_why_text))
- [19] Crime gap sentences say whose rate it is only for the sheriff. A city-wide DOJ rate is presented as if it were this block group's. The sources row still says 'city level' although many block groups now get the sheriff's area rate. (build_oc.py:391 and 456-457 (WHY crime))
- [20] The DC article fix covers NM in build_oc but not STN, and not the county name the engine receives. (build_oc.py:262 (STN))
- [21] 'On a bus street' is asserted, but the crashes are counted anywhere in the block group. (engine.py:229)
- [22] The 'Counted through other feeds' sentence points to feeds by bare MobilityData id, and repeats a provider name twice when MobilityData's catalog lists it twice. (build_oc.py:139-141 and 146 (_counted_text))
- [23] The search list doubles the name wherever the block group is named after its city or place. (build_oc.py:477)
