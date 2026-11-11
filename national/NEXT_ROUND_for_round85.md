# Next round (8.5) — queued work, in order

1. **Merge distance for added rail stations: 150 m -> 300 m** (`metrics_oc.confirm_rail_stations`, `R_SAME` for additions only).
   Round 8.4 leaves 112 added GTFS stops 150-300 m from the mapped station they duplicate (Metro-North's Milford and Waterbury,
   Caltrain's Bayshore, Amtrak's "Boston" at South Station, WMATA's Ballston-MU at 150.4 m). A simulation on the counties built with
   selection 15 or later (8 Nov 08:25) removes 98 of them in 34 counties; distinct stations within 300 m of a mapped one are rare
   (Philadelphia's Walnut-Locust beside PATCO's 12-13th & Locust: the rail distance moves by under 300 m). Re-run every county whose
   additions change (simulate first, as rail15_sim.py).
2. **Batch 6**: the next 150 largest counties (`make_queue.py --top 150` -> us_queue6.txt, `queue_worker.sh batch6 us_queue6.txt`);
   disk: about 10 MB per county; delete site83 and the round-8.3 handoff first (about 1.3 GB).
3. **Rail-only feeds' calendars**: record them in the transit meta and treat a rail-only feed whose last trip is over a year old as
   stale (today they count as current).
   Checked on 8 Nov (11:00, scratchpad tools/rail_calendar.py on the 34 rail-only feeds whose stops are used): last rail trip over a
   year ago in Detroit People Mover 417 (10 Aug 2020), DC Streetcar 487 (1 Jun 2023) and 2223 (30 Jun 2025), ACE 1133 (31 Dec 2024),
   Metra's deprecated 1187 (31 Dec 2024) and VRE's 478 (29 Nov 2024); ended this year: LIRR 3136 (7 Sep 2026), PATH 517 (1 Jun 2026),
   PATCO 505 (31 Aug 2026), QLine 802 (31 Dec 2025). Additions come from such copies too: 81 of Metra's come from 1187 (sorted before
   2854); all 81 are stops of today's 2854 copy, but Will County's build at 07:25 read only 3 stops from 2854 while today's hosted copy
   gives 74 through the same _rail_stops, so the copy a build reads matters: record each rail feed's copy, calendar and stop count in
   the meta, and prefer a current copy's stops over a stale copy's for additions.
4. **Bus departures at a trip's last stop**: a drop-off-only terminal counts as a departure; consider counting only stop_times with
   pickup_type != 1.
   Measured on 8 Nov (scratchpad tools/pickup_share.py, 07:00-09:00 bus stop_times with pickup_type 1): Metro Transit 205 4.2%,
   RIPTA 624 2.3%, CT Transit 553 0.6%, WMATA 1846, SRTA 421 and Valley Regional Transit 142 0%. The bias sits at the stops where
   inbound express buses only let passengers off (downtown in the morning peak), so it is local; it needs a national re-run.
5. **Feeds this machine cannot reach**: Cherriots (cherriots.org, refused by the proxy), Rio Metro (MobilityData copy not a zip on
   8 Nov); retry their hosted copies each round.
