# Live check of every sourced panel (16 Nov 2026)

**Why.** The home-value work showed that features passing unit tests can still be broken on the live page (8 of 12
counties were). This check does the same for every other sourced feature, across the country.

**How.** `scripts/live_check_panels.mjs` (Playwright, real network, not part of CI). Sample: 2 counties per Census
division (9 divisions, 18 counties), plus Los Angeles and Orange County, 3 points each, 60 points in all. Each point is
a real parcel from the county's own parcel service, inside a block group spread across the county's list, with
TIGERweb confirming the point lies in that block group. For each point the script selects the block group with the
page's `select()` and opens the parcel with the page's own click path (`houseAt()`). It then checks what the page shows
against the source, fetched separately by the script:

| Check | Page row | Compared with |
|---|---|---|
| Census area | house panel "Census area" | TIGERweb county (layer 82) and block group (layer 10) for the point |
| HUD | "HUD Fair Market Rent (FY2027)" | `app/data/hud_fair_market_rents.json`, for the county TIGERweb gives (New England: the town range) |
| FEMA | "FEMA flood zone" | FEMA NFHL layer 28, re-queried for the point |
| USGS | "Ground elevation" | USGS EPQS, re-queried for the point |
| Crash | block-group crash text and the KSI row in the details table | `app/data/crash_counts/<fips>.json` and `crash_gaps/<fips>.json`; with no crash file, no rebuilt crash text may appear |
| Laws | "Housing laws & rights" and the house checks list | only that state's records from `app/data/statutes.json`, all of them; no hardcoded rights; no other state's records |
| Neighborhood | tiles: typical home value, median rent, homes | the county data file (with `bundle_corrections.json`); LA home value from `la_neighborhood_values.json` |
| Canopy | "Canopy gap to goal (…)" row | `app/data/tree_equity_2025/<fips>.json`, and its label names the current release |
| Console | script errors | none allowed (resources the browser couldn't load are listed separately) |

The run used 4 browsers in parallel. Every FEMA or USGS row the page showed as "Not available" was then re-opened
alone (`--recheck-fema`). Where the script's own reference query to FEMA timed out, FEMA was re-queried afterwards.
Results: `data/backtests/live_check_panels_2026-11-16.json` (every point, with the page's text and the expected
value).

## Results (60 points, after fixes)

| County | Census area | HUD | FEMA | USGS | Crash | Laws | Neighborhood | Canopy | Console |
|---|---|---|---|---|---|---|---|---|---|
| Los Angeles CA (06037) | pass | pass | pass | pass | pass | pass | pass¹ | pass | pass |
| Orange CA (06059) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Cumberland ME (23005) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Capitol Planning Region CT (09110) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Allegheny PA (42003) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Essex NJ (34013) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Cook IL (17031) | pass (2 of 3)² | pass (2 of 3)² | pass (2 of 3)² | pass (2 of 3)² | pass | pass | pass | pass | pass |
| Hamilton IN (18057) | pass | pass | pass (2 of 3)³ | pass | pass | pass | pass | pass | pass |
| Linn IA (19113) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Wyandotte KS (20209) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Fairfax VA (51059) | pass | pass | pass (2 of 3)³ | pass | pass | pass | pass | pass | pass |
| Wake NC (37183) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Davidson TN (47037) | **not shown**⁴ | **not shown**⁴ | **not shown**⁴ | **not shown**⁴ | pass | pass | pass | pass | pass |
| Jefferson AL (01073) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Travis TX (48453) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Pulaski AR (05119) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Salt Lake UT (49035) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Maricopa AZ (04013) | pass | pass | pass (2 of 3)³ | pass | pass | pass | pass | pass | pass |
| San Diego CA (06073) | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Multnomah OR (41051) | pass | pass | pass | pass | pass | pass | pass | pass | pass |

Point totals: neighborhood, canopy, crash and laws 60/60; Census area, HUD and USGS 56/60; FEMA 53/60. None of the 60
points showed a wrong value. The points not counted are the 4 where no house panel opened (Davidson ×3, Cook ×1) and 3
FEMA rows where the page said "Not available".

1. LA: only the home value is checked against its source (`la_neighborhood_values.json`). LA's rent and home count
   were not checked independently.
2. One Cook point: the county parcel service didn't answer the page during the parallel run, so no house panel opened.
   The same service answered at the other two Cook points.
3. At one point each in Hamilton, Fairfax and Maricopa, the page said "FEMA flood zone: Not available" (timeout, or
   FEMA dropped the connection) after its retry. Fairfax and Maricopa were re-opened alone and still said it; FEMA then
   answered the same query from the same browser on a separate request (Zone X at both). Hamilton was not re-opened
   alone, because the script's own FEMA query had also timed out during the run. FEMA, re-queried afterwards from
   Node, gives Zone X there. No wrong zone was shown at any of the three; the row was empty.
4. Davidson: see "Unresolved" below.

Crash data was checked in the 9 sampled counties that have it (LA, Orange, Cumberland, Allegheny, Cook, Fairfax,
Davidson, Salt Lake, San Diego). Where `crash_gaps` has a comparison marked "g", the rewritten text ("N crashes
involving a pedestrian or cyclist inside this block group…") appears. The old unrewritten crash text never appears. The
KSI row equals the file's count. In the 11 counties with no crash file, no rebuilt crash text appears.

## Bugs found and fixed

1. **The house checks asserted housing rights that no law record supports, in every state but California**
   (`houseChecks` in `app/app.js`). The text was hardcoded per state:
   - "Austin HOME Initiative authorizes up to 3 units" for any lot in Texas;
   - "WA HB 1110 allows up to 2–4 middle housing units by right";
   - "Oregon HB 2001 permits duplexes and cottage clusters by right";
   - Florida "Live Local Act & local infill standards allow internal apartment conversions" (the Act covers
     commercial, industrial and mixed-use zones only);
   - "eligible for duplex conversion … under municipal infill schedule" and "under federal Fannie Mae / FHA accessory
     housing standards" everywhere else;
   - California's 4-ft ADU setback applied nationwide.

   The same panel's "Selling an ADU separately" row claimed "Fee-simple lot split allowed down to 2,000 sq ft lots
   under Austin HOME Phase 2" for all of Texas.

   Now outside California these rows assert nothing. They name the state's records on file in `statutes.json`, with
   their check status, and say each "applies only where all of its conditions are met". If none is on file, they say
   so. California's SB 9 rows keep their checked conditions; the fire-zone row now cites SB 9's mitigation exception.
   The seismic and hurricane rows no longer say a house "qualifies" for a grant or discount (that depends on foundation
   type, ZIP code and open rounds, none on file): they are marked "?" with the condition.

   Where it showed live: the check's sample never reached these rows outside LA, because of bug 2. Florida parcels
   (use code from the DOR roll) reached them. Test: *"house checks name only the state's law records on file…"*
   (Travis TX, Jefferson AL and Lee FL through `houseAt`). It fails on the old code and passes on the new.

2. **A lot whose use the parcel service doesn't record was called non-residential.** Outside LA, almost no parcel
   service gives a readable use (Maricopa gives bare codes like "0131"). The page said "This parcel is Travis County
   GIS Parcels parcel, so residential homeowner checks do not apply". That was all 51 non-LA houses that opened in this
   sample: every one now lands in the unknown-use branch, which used to be the `!res` branch. It now says "The parcel
   service doesn't record this lot's use, so the residential checks aren't run" (with the code where one is given).
   Same test.

3. **Median rent was rounded to thousands.** A $2,356 Census median rent showed as "$2k/mo" (it used the
   home-value formatter). Rent is now shown to the dollar in the tile, the details table and the compare card.
   Test: *"median rent is shown to the dollar…"*. The live check now expects the dollar figure, formatted by the
   script rather than the page; see the re-run below.

4. **FEMA (and other agency) rows lost to a dropped connection.** When several queries arrive together, FEMA's NFHL
   drops some connections. The browser reports this as "Failed to fetch", and the row said "Not available". `app/facts.js` now retries
   once, after 0.9 s, on a network-level failure (not on timeouts or HTTP/service errors). Unit test in
   `tests/unit/facts.test.ts`. The retry clears most drops, but not all under heavy parallel load (footnote 3).

## Re-run after the rent fix

Ran 1 new point per county (20 points, 2 browsers) with the rent check expecting the dollar figure: results in
`data/backtests/live_check_panels_2026-11-16_rerun.json`. The neighborhood figures (home value, rent to the dollar, home
count), canopy, crash and laws matched at 20/20. Census area, HUD and USGS matched at 19/20, and FEMA at 19/20; the one
not counted for each is Davidson, where no parcel opens. In one FEMA row (Allegheny) and one USGS row (Hamilton) the
page said "Not available" during the parallel run. Both matched when re-opened alone. No script errors.

Examples of rent now shown: Travis $2,718/mo, Fairfax $3,421/mo, Pulaski $976/mo. All 19 non-LA counties match their
county file to the dollar. Davidson's block-group panel checks still ran there.

## Unresolved

- **Davidson County, TN: no parcel opens on the live page.** The registry's service
  (`geoviewer.cot.tn.gov … NonImpact_Parcels/MapServer/1`) sends no CORS header, so the browser blocks `fetch`. The
  JSONP fallback gets a 403 `text/html` reply to browser-like requests, which Chrome blocks (`ERR_BLOCKED_BY_ORB`).
  From a script the same query answers. The service needs replacing, for example with Metro Nashville's own parcel
  layer. That belongs to the parcel registry (`PARCELS87` / `parcel_services.json`), which another track is editing, so
  I left it. Until then a click in Davidson says the parcel service didn't answer. That's honest, but it shows nothing.
- **Residential checks are not run outside LA and Florida.** Parcel services don't give a use the page can read, so the
  "what fits on this lot" list is skipped (now saying why). Decoding each county's use codes would bring it back.
- **FEMA under load:** 3 of 60 rows stayed "Not available" after the retry (footnote 3). An extra retry or a longer
  timeout would trade wait time for coverage.
- **Browser network errors** (not script errors) on every county page: FEMA dropped connections, OpenStreetMap
  Overpass refusals (rate limiting) and the Davidson service. The page shows "not available" for these rather than
  failing. Counts per county are in the results file (`network_errors`).
- **Not covered by this check:** the methods-modal financing and stormwater summaries (marked hand-written,
  unverified on the page) and the ecoregion canopy targets in the heat model (hardcoded per state).
- **e2e port:** `PW_PORT=8835` was in use by another track's live run (`live_check_valuations.mjs`), so the e2e suite
  ran on `PW_PORT=8836`.
