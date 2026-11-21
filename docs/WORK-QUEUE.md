# Work queue

What is being worked on now, what is next, and why, in order. Updated as items finish. The long-range plan is in
`GAME-PLAN.md`; what has been checked and what hasn't is in `DATA-AUDIT-AND-TRANSPARENCY.md`.

Rule for every item: a number reaches the page or the AI only if it was fetched from its source and checked, or it
is withheld with the reason. Each item ends with tests passing and a commit; anything I get wrong is reported in the
audit doc the same day.

## Status 19 Nov 2026 (planned rail corridors)

- **Done:** `app/data/intercity_transit_corridors.json` now holds all 69 FRA FY22 Corridor ID selections (4 Amtrak-led, 65 by
  others; Amtrak's release of 2023-12-08 gives the same 69) plus the unconfirmed Austin-San Antonio record. Each lists only the
  cities the document names (309 stop records), each with its quote, the Census place and county lookups, and
  `county_on_page`. Source texts are in `research/corridors/`. Brightline West, Cascadia and Dallas-Houston carry their sponsor
  or Amtrak documents and status as stated. The Invest view's Transit card says how many neighborhoods lie within 1 mile of
  each stop city centre (`src/engines/corridorStopAreas.js`), with links. Checks: `tests/unit/transitCorridors.test.ts`,
  `scripts/live_check_corridors.mjs` (three counties, counts agree with Census TIGERweb).
- **Documents not obtained (the owner supplies them through a research request):** Amtrak's Corridor Vision report
  (media.amtrak.com link from the 2021 release returns 404, amtrak.com 403, amtrakconnectsus.com not configured, Internet
  Archive resets), the FRA Amtrak Daily Long-Distance Service Study final report and appendices (railroads.dot.gov 403;
  fralongdistancerailstudy.org says the files are "being re-attached" and its media library holds only unrelated images),
  California High-Speed Rail's own status pages (hsr.ca.gov bot challenge), a current Texas Central status (its site shows
  posts only to 2020), and TxDOT's rail pages. So no corridor was built from the Amtrak vision or the long-distance study.
- **Fixed 21 Nov:** the Worker's `transit_projects` tool now matches an intercity corridor to a county only when a stop the source names is in that county (`county_match: stop_in_county`); same-state corridors follow, marked `state_only` (test in `tests/unit/localData.test.ts`).
- **Next:** when those documents arrive, add their corridors the same way (`scripts` for the Census lookups are not in the
  repository; the lookup URL is recorded on each stop). The Worker's `transitProjectsFor` still matches intercity corridors
  by state, not by county (outside this change; `workers/localData.ts`). `app/app.js` builds the advisor's
  `intercityCorridor` from the first corridor with a stop in the county only.

## Status 19 Nov 2026 (hosting and the advisor)

- **County files are served from Cloudflare R2** (bucket `city-pretty-data`, public r2.dev address in
  `app/data/county_hosts.json`). 1,385 files, 1.138 GB. Five counties were opened on the real page and loaded from R2.
  The local `counties/` folder is still in the repository as the fallback and for tests and scripts.
  **Hard limit from the owner: R2 storage must never exceed 10 GB. Upload only with `scripts/r2_sync_counties.py`
  (stops at 8 GB). See `CLAUDE.md`.**
- **The advisor Worker is deployed** at `https://city-pretty-api-proxy.city-pretty.workers.dev` with the Claude key
  set as a secret; `/api/health` reports the advisor ready, and one real question (Travis County two-bedroom Fair
  Market Rent) returned HUD's figure with its sources. `app/config.js` points at it. Not set: `CENSUS_API_KEY`,
  `GOOGLE_MAPS_KEY`. Do NOT set `TURNSTILE_SECRET_KEY` until the page sends a Turnstile token (it would refuse every
  question).
- **Small counties, Maryland (19 Nov, `audit/small-counties-maryland.md`): the path to R2 proven end to end.**
  Built: 10 counties (Allegany, Calvert, Caroline, Dorchester, Garrett, Kent, Queen Anne's, Somerset, Talbot,
  Worcester; 327 block groups, 444,413 people); none withheld. Time: 20.6 min from the start of the OSM download to the
  last county built (download 6 min, Maryland cut 106 s, then about 2-2.5 min a county, three at a time; 47.6 s a
  county overall for the nine run together). The new files are uploaded to R2 and **not committed**
  (`counties/.r2-only.txt`, generated `.gitignore` block); the page loads them from R2 only and says so if R2 fails.
  Checks: Census 240 of 240 values equal (0% mismatch); OpenStreetMap ID for ID in 2 counties, 0 differences; live on
  the real page from R2, 3 counties x 3 block groups, 0 wrong values.
  **R2 bytes added: 6,852,303** (data files 6,849,774 plus the larger manifest): 1,137,938,782 -> 1,144,791,085 bytes
  (1.138 -> 1.145 GB, 1,385 -> 1,395 objects).
  **Projection, measured:** Maryland's files average 684,977 bytes a county and 20,947 bytes a block group
  (Tennessee's: 0.39 MB a county). Building the remaining 2,387 counties the same way adds about 1.64 GB by the
  per-county figure (1.11 GB by the per-block-group figure), so total R2 storage would be about **2.8 GB, under the
  6 GB mark and the 8 GB ceiling** of `scripts/r2_sync_counties.py`, without site-suggestion files (not built for small
  counties). The path is ready to repeat state by state; run `--dry-run` before every upload.
  Registry count of what is left (counties in `national/data/counties.json` with no data file, Puerto Rico left out,
  under 100,000 people by ACS 2020-24): 2,387 counties, 52,817 block groups, 61.6 million people; this is 35 more than
  2,443 minus Tennessee and Maryland, so the 17 Nov count and this one were not made the same way.
- **Small counties, the Northeast (21 Nov, `audit/small-counties-northeast.md`): all 108 missing counties of CT, RI,
  NJ, MA, NH, ME, VT, NY and PA built, served from R2 only.** CT 1, RI 2, NJ 2, MA 3, NH 6, ME 11, VT 13, NY 34,
  PA 36; 4,948 block groups, 5,283,322 people; none withheld; no pipeline code changed. Time: 95.7 min from the start
  of the OSM download to the last county built (download 1 min 44 s, eight states cut in five osmium passes of 74-102 s,
  then three counties at a time). Checks: Census 2,584 of 2,584 values equal (0% mismatch); OpenStreetMap ID for ID in Bristol RI
  and Cameron PA, 0 differences; live on the real page from R2, one county in each of the nine states x 3 block groups,
  0 wrong values. **R2 bytes added: 76,140,193**: 1,144,791,085 -> 1,220,931,278 bytes (1.145 -> 1.221 GB, 1,395 ->
  1,503 objects). Maine and Pennsylvania counties have crash counts and gaps (state sources); the other seven states
  have no state crash source connected.
  **Open from this batch:** (1) New York counties are clipped from openstreetmap.fr's New York sub-region files (the
  registry's rule; `osm_split.py` skips New York), which stop at their own polygons: inside the counties nothing is
  missing, but features in the county box's margin across a sub-region line are (0 to 4,550 roads per county). Cut New
  York from us-northeast like the other states and rebuild its 62 counties (34 new, 28 older). (2) What is left
  (registry count, 21 Nov, Puerto Rico left out): 2,282 counties with no data file, 2,279 of them under 100,000 people
  (47,869 block groups, 56,311,968 people by ACS 2020-24), so the 19 Nov count less this batch exactly.
- **Small counties, the West (21 Nov, `audit/small-counties-west.md`): 186 of the 238 missing us-west counties built,
  served from R2 only.** AZ 6, NV 15, UT 23, WY 22, OR 26, WA 26, NM 28, ID 40 (every missing county of those eight
  states); 4,115 block groups, 5,206,482 people; none withheld; no pipeline code changed. One us-west download
  (3.79 GB, md5 checked), each state cut alone (112-148 s, about 4.1 GB osmium memory). Checks: Census 4,076 of 4,076
  values equal (0% mismatch); OpenStreetMap ID for ID in Greenlee AZ and Esmeralda NV, 0 differences; live on the real
  page from R2, 15 counties x 3 points, 0 wrong values. Utah counties have UDOT crash counts (1/k) and gaps; the other
  seven states have no state crash source. **R2 bytes added: 159,392,189**: 1,220,931,278 -> 1,380,323,467 bytes
  (1.221 -> 1.380 GB, 1,503 -> 1,689 objects).
  **Open from this batch:** (1) ~~Montana's 52 counties not built~~ **done 21 Nov (second session)**: all 52 built,
  538 block groups, 592,477 people, served from R2 only; Census 948 of 948 values equal; OSM ID for ID Broadwater
  2,408 = 2,408 roads (Blaine's 16 box-only roads all in Canada); live from R2 Cascade and Carbon, 6 points, all 10
  checks pass; R2 1,380,323,467 -> 1,408,044,502 bytes (1,741 objects); end-to-end 87 of 87 passed after the Montana commits. (2) Colorado's 53 are clipped from openstreetmap.fr Colorado sub-region files (the
  New York edge problem); cut Colorado from us-west and build them. (3) `scripts/r2_sync_counties.py` uploads on any
  unrecognised argument (e.g. `--help`); it should refuse unknown arguments (fixed 21 Nov: it now exits with a usage message and uploads nothing). (4) Left (registry count, Puerto Rico,
  LA and Orange left out): 2,096 counties with no data file, 2,093 under 100,000 people (43,754 block groups,
  51,105,486 people).
- **Site off GitHub Pages (19 Nov, built, not yet deployed):** a second Worker `city-pretty` (`wrangler.site.toml`,
  `npm run deploy:site`) serves a 1,908-file, 63 MiB `dist-site/` and also answers `/city-pretty/...`; the advisor Worker
  now allows its origin (redeployed). The deploy itself failed from the build session because its proxy overwrites
  Wrangler's asset-upload token (401); deploy from a normal machine or the `deploy-site.yml` workflow, then run the
  checks in `docs/HOSTING.md` before making the repository private. Evidence: `docs/audit/hosting-cloudflare-2026-11-19.md`.
- (Superseded by the item above) Still to decide: how the public site gets under GitHub Pages' 1 GB cap now that R2 serves the county files
  (deploy Pages from a workflow that leaves out `counties/bundle_*`, or remove them from the repository).

## Advisor: script-first answers (19 Nov 2026)

- The chat now answers plain lookups from the page's own data with no model call (`app/advisor-scripts.js`,
  `docs/ADVISOR-ROUTING.md`): figures for the selected neighborhood and the open lot, HUD rents, where to look, what
  to build, ADU and lot-split screens, sites, transit, "I have $X" and simple sums. Everything else goes to the Worker
  with the page's findings attached. Offline eval: `npm run eval:advisor -- --scripted` (58 cases, no wrong answers);
  it answers 0 of the 113 model-eval questions, because every one of them names an address or another place.
- Optional Worker secret added: `NREL_API_KEY` for the solar tool (without it the tool keeps the shared DEMO_KEY).
- Resolved 21 Nov by merging `claude/upbeat-rubin-7orjxv` (live check `data/backtests/live_check_la_zoning_screen_2026-11-21.json`: 2107 Duxbury Cir, zone R1V2-O reaches the screen). Was: LA lots inside a mapped zone reach the legal screen with no zoning code (see the 19 Nov correction in
  `DATA-AUDIT-AND-TRANSPARENCY.md`), so ADU and lot-split answers there say "not determined".

## Running now (background)

| # | Item | Done when |
|---|---|---|
| ✓ R1 | **California crash counts**, all 58 counties, rebuilt from CHP's crash database with the boundary rule (a crash counts for a block group if inside it or within 10 m of its edge). **Rebuilt again 19 Nov with the 1/k split** (a crash near k block groups counts 1/k in each; the 16 Nov files counted it in full in each and were 43% too high in total). 57 counties from CCRS, San Francisco from DataSF; every county's block groups now add up to its located crashes (unit test); `crash_gaps` recomputed; page text states the rule per county | 58 files in `app/data/crash_counts/`; page shows them with the rule and the share of crashes that have coordinates. Done 19 Nov (`DATA-AUDIT-AND-TRANSPARENCY.md`, 19 Nov entry). The 175 files outside California (states 08, 17, 23, 42, 47, 49, 51) were rebuilt with the 1/k split on 21 Nov (block groups had held 2,594,898 crashes for 1,726,317 placed, 50% too many; now equal), `crash_gaps` recomputed, invariant test covers every county, live check recorded (`DATA-AUDIT-AND-TRANSPARENCY.md`, 21 Nov entry) |
| R2 | **Crash counts in the other states with public crash data** (PA, IL, VA, TN, UT, ME, Denver) | Same, per county |
| R3 | **LA neighborhood values made traceable**, and a home-value model developed on 2022–24 sales and tested once on 2025–26 | Values rebuilt from the assessor's base-year resets with code committed; the model ships only if it beats the neighborhood value alone and stays under 15% median error |
| R4 | **Real evidence for the most-asked-about improvements** (trees, bike lanes, parks, sidewalks, lighting, ADUs, vacant lots, bus lanes) | Each effect matched to a quoted, fetched study, or left unverified |
| ✓ | **HUD rents current**: FY2027 for all counties from HUD's FMR API (token added 16 Nov) | Done |
| R5 | **Remaining unchecked records**: 22 state tax profiles, ~38 sources marked "couldn't check" (HUD FY2027 resolved via API). **State tax profiles done 21 Nov** (`audit/state-finance-profiles-2026-11-21.md`): of the 22, 6 now verified (AK, AL, DC, KY, LA, NM), 11 partly verified, 3 checked with nothing confirmed (IN, NY, PA), 2 could not be fetched (NH, PR); IL could-not-check -> partly verified; 175 fields checked in 44 profiles: 93 confirmed, 18 corrected, 64 withheld (10 of them set to unknown because the stored value was wrong); verified 4 -> 11 (WY too). Still open: 8 partly verified profiles not re-checked (ID, MN, MO, MT, ND, SD, UT, WV), NH and PR, and the ~38 other "couldn't check" sources | Each upgraded with evidence, corrected, or left marked |
| R6 | **Nationwide spot check of the county files' census numbers** (home value, rent, income, population), bus frequency, schools, EV chargers, tree canopy | Mismatch rate per field, per state; corrections where wrong |

## What I'm doing in parallel (doesn't touch the files above)

| # | Item | Why | Done when |
|---|---|---|---|
| P1 | **Source link checker + monthly scheduled run** | Sources move and change; a link that worked in the audit can break. The roadmap asks for a monthly re-check | `scripts/check_sources.py` checks every `source_url` in `app/data`; a GitHub Actions schedule runs it monthly and fails on newly broken links |
| P2 | **Nationwide advisor evaluation** | The eval set has 26 questions from 8 metros; "all of the US" needs answers checked in every state | 100+ questions with answers pulled live for addresses in all 50 states and DC, plus traps; `npm run eval:advisor` |
| P3 | **Parcel lookup tool for the AI advisor** | "Which house should I buy" needs the parcel's own record. The page already knows 150 public parcel/zoning services; the advisor can't use them yet | Worker tool that queries the configured county service for a point and returns its fields with the service URL, or "no parcel service for this county" |

## Next, in order (queued until the running items that touch the same files finish)

| # | Item | Waits for | Done when |
|---|---|---|---|
| N1 | Merge R1–R6, check each one's claims against its sources, re-run everything | each item | Tests pass on the merged code; spot checks recorded |
| N2 | **Home-value back-tests outside California**. Done 16 Nov: estimates are withheld in every county without a passing back-test. DC passed (10.7%) and is shown; Philadelphia (18.7%) and Cook (18.6%) failed and are withheld with their numbers. N2b (16 Nov): shown, with a browser parity test, for Queens (14.97%), Staten Island (13.1%) and Hillsborough FL (9.7%; DOR SDF/NAL, `QUAL_CD` 01/02 from DOR's guide). Withheld after failing: Brooklyn (18.1%), Bronx (17.85%), Manhattan (22.4%, only 56 test sales) and Allegheny (16.3%). King County passed (8.8%, assessed value + neighborhood median) but is withheld: the page's King parcel layer (zoning) lacks the assessed value. Still to do: wire King to the WA statewide layer's value, with a check that it is still the tax-year-2026 roll; other Florida counties; fix the missing-rooms-read-as-0 bug in DC, Cook and Philadelphia (needs a new test window); Queens and Staten Island sales under $500k (99% and 39% error) | R3 (same valuation code) | Each county has real results; estimates show only where the model passed |
| ✓ N3 | **State housing laws for all 50 states** (done 16 Nov: 13 laws added; NH, CT, DC still to check; "none found" states need code-text searches) (ADUs, lot splits, middle housing, parking): primary-source text for each state that has such a law | R5 (same law file) | Every state either has verified records or is marked "no law found as of date" with the search recorded |
| ✓ N4 | **Rebuild the county data files' internal rankings** (done 16 Nov in the page; SF done 19 Nov; California redone 19 Nov on the 1/k counts) ("worse than X% of similar areas") from the rebuilt crash counts | R1, R2 | Safety rankings use the boundary rule |
| ✓ N5 | **Improvement catalog, round 4** (done 16 Nov: EV hubs, school bonds, blight rehab sourced; EV and school bonds California-only; CA pedestrian/cyclist crash counts made complete; see `audit/catalog-coverage-round4.md`) | R4 | Same standard |

## What can't be made complete, and how it's handled

- **Sale prices**: most states don't publish them (Texas and about a dozen others are non-disclosure states). There,
  the page shows Census and HUD figures and says sales aren't public; no estimate is shown without a back-test.
- **Crash locations**: only some states publish geocoded crash data. Elsewhere crash-based items say "no crash data".
- **Zoning**: only where a city or county publishes it. Elsewhere by-right claims are withheld.
- **Sites that block automated access** from the build machine (several .gov hosts): listed as "couldn't check" until
  checked from a normal browser.

## Open issues found 16 Nov (to fix next)

| Issue | Why it matters | Fix |
|---|---|---|
| **Queens sales under $500k show 99% error** (230 test sales; Staten Island 39%). Diagnosed 16 Nov from NYC's deed records (ACRIS) | The model estimated about twice the recorded price | In both the development and test windows, these sales' own deeds mark many as non-market: grantor and grantee share a surname in 27-28% (vs 3% at $500k-$1M), a partial share was conveyed in 2-6%, a referee (foreclosure) sold 7-10%. Screens locked on development evidence only (`scripts/backtests/nyc_sale_screens_locked.json`). Applied by `screen_nyc_sales.py` (after `diag_nyc_acris.py` on the window to test; on the development window it drops 194 of 2,186 sales). Next: when DOF publishes sales after 30 Sep 2026, pull, screen and test once on that window; until then the page keeps the band warning |
| **Missing bedroom/bathroom counted as 0** in the shared model code | Affected published DC (2 rows), Cook (8) and Philadelphia (81 bed / 1,280 bath) results | Fixed in the model code for new runs (16 Nov; legacy flag keeps the three published finals reproducible); re-test those counties on the next fresh window (the one-test rule forbids re-running the same final) |
| ✓ **King County shown** (16 Nov) | Reads the WA statewide value by PIN; computes only while the value check is >= 98% (99.2% on 16 Nov) and <= 120 days old | Re-run scripts/backtests/check_king_statewide_values.py at least every 120 days |
| ✓ **Florida beyond Hillsborough** (16 Nov) | Miami-Dade, Broward, Duval, Orange, Palm Beach, Pinellas all passed (8.7–11.2%) and are shown | Other Florida counties: same script (pull_florida_dor.py <DOR no> <fips> <file name>) |
| ✓ **9 of 123 parcel services failed** (fixed 16 Nov; all 123 pass `scripts/check_parcel_registry.mjs`, and each fixed service returned a real parcel at a live point, `scripts/check_fixed_parcels.mts`) | Clicks there returned nothing | MN: layer 1 was the metadata table, now layer 0. CRCOG, Sioux Falls, WestCOG, St. Charles: field names read from each layer's own field list (WestCOG's layer has no address or value fields, so only ID, town, acres). NYS: moved to the GIS Program Office's `NYS_Tax_Parcels_Public` (found by arcgis.com search; the old ITS server lists no services; 38 opt-in counties only). Philadelphia: the city's `PWD_PARCELS` polygons. Detroit: the URL had a typo in the org id; now `parcel_file_current` (the old "Parcels_Current" item is titled deprecated). Clark NV: unchanged; the HTTP 500 was transient |
| ✓ **Florida estimate path seen live** for homes with no sale since 2025 (16 Nov) | Every earlier sampled home had a 2025 sale, so the page showed the sale | `live_check_valuations.mjs --old-sale 12011 12095`, 5 homes per county by point and by drawn lot (`data/backtests/live_check_2026-11-16_old_sale.json`). Broward 5/5 and Orange 4/5 show the estimate with its tested error (8.9% / 8.7%); the 5th Orange home (Winter Park, BG 120950160011) is withheld because its block group and tract had no sales in the model's data, as tested. Estimates ran 1.1–1.2× the roll's just value. No page bug found |
| **Florida statewide parcel layer can be slower than the page waits** | In the first Broward run one Coral Springs click got "Couldn't get this lot from the parcel service"; the same point query took 23.6 s by curl right after (page waits 12 s, then 15 s by JSONP). A re-run showed the estimate | The page says so and asks to retry (no wrong number). Measured 21 Nov (`data/backtests/fl_parcel_point_times_2026-11-21.json`, ran 10:06 UTC): the page's point query in 12 seeded-random Florida counties, 3 points each, sequential: 36 of 36 HTTP 200, no errors, median 1.0 s, max 6.14 s (first try per county: median 1.07 s), none over the page's 12 s. One run at one time of day, Broward not in the sample; no change to the wait made on this evidence. Re-measure at a busy hour before deciding |
| **Florida statewide layer refuses any WHERE on the sale fields** (HTTP 400) and times out on county-wide paged queries | Sampling scripts can't filter by sale year server-side | `--old-sale` samples small boxes and filters in the script; in the rows checked (1,000 Broward rows), the layer's SALE_YR1 was only 0, 2025 or 2026 |
| ✓ **Travis County's parcel services emptied overnight** (17 Nov) | Every Travis click said "couldn't get this lot" | Now the City of Austin's public TCAD parcel copy; live 3/3 |
| ✓ **Alaska's statewide parcel layer now requires a login** (found 16 Nov, 21:20) | Anchorage clicks returned nothing | Replaced with the Municipality of Anchorage's public `PropertyInformation_Hosted` layer (point check passed) |
| ✓ (17 Nov: Hinds now on the county's parcel-viewer layer; Shelby, Hamilton moved; Knox field bug fixed, still on the flaky state server) **Hinds County MS parcel server down** (HTTP 500 on every request since at least 21:20 16 Nov; worked at 19:41) | Jackson MS clicks get "couldn't get this lot" | Re-check; if still down, find a working public layer (the county's own server and CMPDD's also failed on 16 Nov) |
| ✓ **Davidson TN parcel service blocked in browsers** (fixed 16 Nov) | Nashville clicks failed on the live page | Now Metro Nashville's own `Parcels_view` layer (allows browser requests; edited 16 Nov; adds zoning, land use, acres, total appraisal). Live panel check, 3 Nashville parcels through the page's click path: all panels pass, no blocked requests (`data/backtests/live_check_panels_2026-11-16_parcelfix.json`). Hamilton, Knox and Shelby still use the TN state server, which intermittently answers 403 |
| ✓ **Alaska county data files** (17 Nov: 29 of 30) | The page had no Alaska county to open | Aleutians West (crosses the 180th meridian); Alaska crash data; heat (2021 file 403) |
| ✓ (21 Nov: answering again; `FeatureServer/1` query returned HTTP 200 with parcel rows, and the live panel check through the page's click path passed 6 parcels in Hillsborough and Rockingham, 54/54 checks, service "NH GRANIT Statewide Cadastral Parcel Mosaic": `data/backtests/live_check_panels_2026-11-21_nh.json`) **New Hampshire's statewide parcel layer (GRANIT CAD_ParcelMosaic) answered HTTP 503 on every layer, on both its old and new hosts** (17 Nov; the catalog item is still public) | Clicks in Hillsborough, Rockingham, Merrimack, Strafford and Grafton say "couldn't get this lot" | Re-check; if it stays down, look for county or town layers |
| ✓ **Tract medians labeled** (17 Nov: 43,901 rents and 13,724 home values; 0 mismatches against the Census files) | | |
| ✓ **Lot-fit outside LA and Florida** (16 Nov: NYC R1-R5 from the Zoning Resolution) | The checks were skipped everywhere else | DC R-1A/R-1B/R-2/R-3 added and Davidson/DC use tables added (16 Nov, round 2). NYC R6-R10 added 17 Nov (round 3); NYC R11/R12 + commercial (round 4); San Diego RS zones (round 5). Charlotte and Portland added (round 6); Miami withheld (code only in a JS app). Engine copies reconciled 17 Nov (drift test; .ts copies deleted). Next: roof pitch values are unsourced; Denver (code text not found), Nashville (Municode 403), NYC R11/R12 and commercial districts, other counties' use-code tables; NYC R6+ districts; the NYC "Owner playbook" line still says zoning not on file. Fixed 17 Nov: NYC and DC clicks showed "Lot Parcel" for the parcel number (now BBL / SSL), and NC OneMap's sale date was read as a sale price (never shown: it parsed as year 1727) |
| **2,443 US counties (under 100,000 people; 63.6 million people) aren't on the page** (measured 17 Nov). Tennessee done 17 Nov (all 95 counties; `audit/small-counties-pilot.md`). **Maryland done 19 Nov** (10 counties, all 24 now; the first state served from R2 only, not committed: `audit/small-counties-maryland.md`). **Northeast done 21 Nov** (108 counties in CT, RI, NJ, MA, NH, ME, VT, NY, PA; every county of those states now has a data file; R2 only: `audit/small-counties-northeast.md`). **West done 21 Nov** (238 counties in AZ, NV, UT, WY, OR, WA, NM, ID, MT; Montana's 52 by a second session; R2 only: `audit/small-counties-west.md`). Remaining count below is from before Montana (subtract its 52 counties). Remaining: 2,093 counties under 100,000 people, 43,754 block groups (registry count, 21 Nov, after the West batch; see the status note above) | Most small-town and rural addresses can't be looked up | **Hosting decided 17 Nov: regional Pages sites** (`app/data/county_hosts.json`, `scripts/split_county_hosting.py`; page support built, regions disabled until each site is checked). **Waiting on the user to create** `city-pretty-data-northeast`, `-midwest`, `-south`, `-west` (public, Pages on from main). Earlier note: GitHub Pages publishes at most 1 GB per site; `main` is already 1.07 GB and this branch 1.30 GB, almost all county files. The rest of the US adds about 1 GB more (about 0.2 GB with light files that leave out drawn streets, water and parks). Options: split county files into a few regional Pages repos (no new accounts; recommended), host them on Cloudflare (needs the user's account), or light files for small counties. Merging this branch into `main` as it is would likely push the site past the limit |
| **23 states' codes unsearchable from the build machine** | "No law found" is unverified there | Alternate routes, or a script run from the user's computer |

## Open from the statute screen work (20 Nov 2026)

Details and sources: `docs/DATA-AUDIT-AND-TRANSPARENCY.md` (the 20 Nov corrections), `docs/audit/la_sb9_zone_scope.md`
and `docs/audit/site_exclusions/`. Done the same day: the engine's blanket hazard stop was replaced by each law's own
text; the California ADU record reaches multifamily zoning; Santa Clarita's SB 9 zones; the Travis rent check.

- Apply the citation changes the research found: Utah 10-9a-530 / 17-27a-526 (now 10-21-303 / 17-80-303) and Arizona
  middle housing (now § 9-462.13). Each needs its text fetched and the record's evidence re-quoted.
- Not fetched: LAMC § 12.08 (are R1V / R1F / R1R / R1H and R1P one-family R1 zones?); Minneapolis Title 20; the
  § 65913.4 text of 16 Sep 2021; Colorado's current C.R.S. numbering; whether SB 9 is mandatory in LA's A zones.
- Not measured by the page: farmland maps and land ownership, so the laws' farmland and public-land exclusions never
  fire. ADU unit counts on multifamily lots are not modeled; the ADU record is not applied to mixed-use zoning.
- Colorado HB 24-1313 sets a citywide goal and, per the evidence, gives no parcel a by-right entitlement; check
  whether it should be a parcel-level record at all.
- `app/advisor-scripts.js` (`answerLot`) is on no pushed branch. If it lands, drop its sentence explaining the old
  "no zoning code" gap.
