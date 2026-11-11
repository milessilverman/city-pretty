# Next round (8.6): queued work, in order

1. **Headway stops with no morning service (transit selection 20).** A stop served only by headway (frequencies.txt) trips outside
   07:00–09:00 is listed with 0 buses an hour (35 stops on the site: 29 Dana Point trolley stops in Riverside's search box, 1 in
   Indian River FL, 5 in Monongalia WV), while a timed stop with no morning departures is not listed. Add a departure only when the
   count is positive (fetch_oc, `per[rr][st["stop_id"]] += c` only if c) as selection 20, and install it before item 2, so that
   item 2's re-runs also fix Riverside, Indian River and Monongalia.
2. **Every county at the current transit selection.** No meta built before selection 18 lists the feeds read with service but no stop
   in the county (`read_no_stops_here`): 529 counties, 321 on selections 9–16 and 208 on 17 (`logs/rebundle86_queue.txt`; the 321
   alone are in `logs/rebundle85f_queue.txt`). The 74 counties on selections 9–12 that read a feed also lack the candidate counts
   (`wednesdays_7_9am_departures`). The weekday audit at selection 18 reproduces every recorded day (1,623 of 1,623 county feeds),
   but it cannot see feeds that no meta records. Re-run all 529 with four workers (about five hours at rebundle85e's pace), then run
   `transit_day_audit.py` and the layer check against site85. Broward, Miami-Dade and Palm Beach (Tri-Rail's copy 333), Fresno and Madera (Clovis Transit's
   headway trips) then carry selection 18's records too.
3. **Bus schedules that have ended.** 44 feeds in 109 counties are measured from copies whose schedule ended before the build, up to
   11 months old: MARTA (12 Atlanta-area counties, 19 Aug 2026), Metro St. Louis (10 Jun), PSTA (3 Jun), Milwaukee County Transit
   (19 Aug), SFMTA (26 Aug), Sun Metro (10 Jun), SunTran (13 May), CDTA (26 Aug), NCTD (29 Jul), WRTA, Lane Transit, Gold Coast and
   others. A copy whose bus schedule ended less than a year ago is measured on its last Wednesday with morning departures, and no
   other copy or operator URL is then tried. When a copy's schedule has ended, try the provider's other copies (Transitland ids,
   the legacy mirror) and the operator's URL where the network allows it, and use the newest; where none is current, say on the page
   that the values come from the last published schedule (the sources row already gives the date).
4. **Batch 7**: the next 150 largest counties with an OpenStreetMap file, from Sevier County, TN (99,652) to Greene County, TN (71,628),
   in 39 states, with Guaynabo, Arecibo and Toa Baja, PR (`us_queue7.txt`, written by `make_queue.py us_queue7.txt --top 150`; 2,548
   counties remain). Batch 6 used about 3.6 MB of data and 0.85 MB of site files per county (535 MB and 127 MB), so batch 7 needs about 0.7 GB. About 2 GB is
   free after site85 and the round-8.5 hand-off. Free more before round 8.6's site: site84 (853 MB) once round 8.6's site is built,
   and, if needed, `cache/osm` (7.0 GB of openstreetmap.fr extracts, re-downloadable) for areas whose counties are all built and re-run.
5. **Las Colinas APT (Dallas County)**: search excerpts of its operator's site (dcurd.org: "THE APT SYSTEM IS CLOSED INDEFINITELY";
   "beginning August 29, 2020, the APT System is suspending all passenger services until further notice") say it has not run since
   2020, but this machine's network policy refuses the page. Open it from a machine that can. Dallas's map has four APT stations:
   three kept by type, and Tower 909, which DART's Las Colinas Urban Center stop (180 m) confirms. If the closure is confirmed, add
   the line to `pipeline/stations_not_served.json` (match network "Las Colinas APT", mode light_rail) with the URL and quote, let a
   not-served match drop a station even when another line's stop confirms it (or list Tower 909 by name), and re-run Dallas (48113).
6. **Rail-only feeds' calendars**: record them in the transit meta and treat a rail-only feed whose last trip is over a year old as
   stale (today they count as current). Checked on 8 Nov: last rail trip over a year ago in Detroit People Mover 417 (10 Aug 2020),
   DC Streetcar 487 (1 Jun 2023) and 2223 (30 Jun 2025), ACE 1133 (31 Dec 2024), Metra's deprecated 1187 (31 Dec 2024) and VRE's 478
   (29 Nov 2024). Additions come from such copies too: 82 added stops come from Metra's 1187 (76 distinct stops in 7 counties), all
   of them stops of today's 2854 copy. Record each rail feed's copy, calendar and stop count in the meta, prefer a current copy's
   stops over a stale copy's for additions, and save the check's output under logs/ (rail_calendar_check.py prints only).
7. **Bus departures at a trip's last stop**: a drop-off-only terminal counts as a departure; consider counting only stop_times with
   pickup_type != 1 (07:00–09:00 shares with pickup_type 1: Metro Transit 205 4.2%, RIPTA 624 2.3%, CT Transit 553 0.6%). It needs a
   national re-run, so it belongs with item 2 if it is adopted. Save pickup_share_check.py's output under logs/.
8. **California feeds that MobilityData holds only as stale copies** (SacRT, Gold Coast): the state's Cal-ITP GTFS tables on
   data.ca.gov are reachable from here; check whether they carry those operators' current schedules (the station check found SacRT's
   feed URL listed but no SacRT stops in the 1 Oct 2026 stops table).
9. **Feeds this machine cannot reach.** For 12 feed ids (11 operators) no copy downloads: MobilityData's hosted copy answers 403 and
   the proxy refuses the operator's URL. They are Fayetteville Area System of Transit (Cumberland NC: all 228 block groups unknown),
   City of Loveland Transit (Larimer CO: 45 of Loveland's 46 block groups show 0), Fredericksburg Regional Transit (Spotsylvania and
   Stafford: no block group shows buses), Tulare InterModal Express, Lompoc Transit, St Lawrence County Public Transit's second feed,
   Danville Mass Transit (no built county yet; Vermilion County, IL is in batch 7) and four LA-area municipal feeds (Torrance,
   Glendale, West Hollywood, I-Line; LA's bundle has its own feeds). Also: Cherriots (MobilityData's copies ended on 3 May 2025, and
   the proxy refuses cherriots.org); Rio Metro (hosted copy empty; the legacy mirror is read for its Rail Runner stops, but its buses ended in 2024, and the proxy refuses riometro.org); NCTD (hosted copy answers 403 and the proxy refuses lfportal.nctd.org, so the legacy
   mirror, which ends 2 Aug 2026, is read; the pipeline does not try lfportal.nctd.org while that copy is under a year old; see item 3). Retry each round.
