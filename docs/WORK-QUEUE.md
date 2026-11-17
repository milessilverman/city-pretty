# Work queue

What is being worked on now, what is next, and why, in order. Updated as items finish. The long-range plan is in
`GAME-PLAN.md`; what has been checked and what hasn't is in `DATA-AUDIT-AND-TRANSPARENCY.md`.

Rule for every item: a number reaches the page or the AI only if it was fetched from its source and checked, or it
is withheld with the reason. Each item ends with tests passing and a commit; anything I get wrong is reported in the
audit doc the same day.

## Running now (background)

| # | Item | Done when |
|---|---|---|
| R1 | **California crash counts**, all 58 counties, rebuilt from CHP's crash database with the boundary rule (a crash counts for a block group if inside it or within 10 m of its edge) | 58 files in `app/data/crash_counts/`; page shows them with the rule and the share of crashes that have coordinates |
| R2 | **Crash counts in the other states with public crash data** (PA, IL, VA, TN, UT, ME, Denver) | Same, per county |
| R3 | **LA neighborhood values made traceable**, and a home-value model developed on 2022–24 sales and tested once on 2025–26 | Values rebuilt from the assessor's base-year resets with code committed; the model ships only if it beats the neighborhood value alone and stays under 15% median error |
| R4 | **Real evidence for the most-asked-about improvements** (trees, bike lanes, parks, sidewalks, lighting, ADUs, vacant lots, bus lanes) | Each effect matched to a quoted, fetched study, or left unverified |
| ✓ | **HUD rents current**: FY2027 for all counties from HUD's FMR API (token added 16 Nov) | Done |
| R5 | **Remaining unchecked records**: 22 state tax profiles, ~38 sources marked "couldn't check", and HUD's FY2026-vs-FY2024 question | Each upgraded with evidence, corrected, or left marked |
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
| ✓ N4 | **Rebuild the county data files' internal rankings** (done 16 Nov in the page; SF pending) ("worse than X% of similar areas") from the rebuilt crash counts | R1, R2 | Safety rankings use the boundary rule |
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
| **Florida statewide parcel layer can be slower than the page waits** | In the first Broward run one Coral Springs click got "Couldn't get this lot from the parcel service"; the same point query took 23.6 s by curl right after (page waits 12 s, then 15 s by JSONP). A re-run showed the estimate | The page says so and asks to retry (no wrong number). Decide whether a longer first-click wait is worth it; measure cold times across counties first |
| **Florida statewide layer refuses any WHERE on the sale fields** (HTTP 400) and times out on county-wide paged queries | Sampling scripts can't filter by sale year server-side | `--old-sale` samples small boxes and filters in the script; in the rows checked (1,000 Broward rows), the layer's SALE_YR1 was only 0, 2025 or 2026 |
| ✓ **Travis County's parcel services emptied overnight** (17 Nov) | Every Travis click said "couldn't get this lot" | Now the City of Austin's public TCAD parcel copy; live 3/3 |
| ✓ **Alaska's statewide parcel layer now requires a login** (found 16 Nov, 21:20) | Anchorage clicks returned nothing | Replaced with the Municipality of Anchorage's public `PropertyInformation_Hosted` layer (point check passed) |
| ✓ (17 Nov: Hinds now on the county's parcel-viewer layer; Shelby, Hamilton moved; Knox field bug fixed, still on the flaky state server) **Hinds County MS parcel server down** (HTTP 500 on every request since at least 21:20 16 Nov; worked at 19:41) | Jackson MS clicks get "couldn't get this lot" | Re-check; if still down, find a working public layer (the county's own server and CMPDD's also failed on 16 Nov) |
| ✓ **Davidson TN parcel service blocked in browsers** (fixed 16 Nov) | Nashville clicks failed on the live page | Now Metro Nashville's own `Parcels_view` layer (allows browser requests; edited 16 Nov; adds zoning, land use, acres, total appraisal). Live panel check, 3 Nashville parcels through the page's click path: all panels pass, no blocked requests (`data/backtests/live_check_panels_2026-11-16_parcelfix.json`). Hamilton, Knox and Shelby still use the TN state server, which intermittently answers 403 |
| ✓ **Alaska county data files** (17 Nov: Anchorage, Fairbanks North Star, Mat-Su, Kenai, Juneau; ~80% of the population) | The page had no Alaska county to open | Remaining 25 boroughs and census areas; Alaska crash data; heat (2021 file 403) |
| ✓ **Tract medians labeled** (17 Nov: 43,901 rents and 13,724 home values; 0 mismatches against the Census files) | | |
| ✓ **Lot-fit outside LA and Florida** (16 Nov: NYC R1-R5 from the Zoning Resolution) | The checks were skipped everywhere else | DC R-1A/R-1B/R-2/R-3 added and Davidson/DC use tables added (16 Nov, round 2). NYC R6-R10 added 17 Nov (round 3); NYC R11/R12 + commercial (round 4); San Diego RS zones (round 5). Charlotte and Portland added (round 6); Miami withheld (code only in a JS app). Next: the engine's .ts copy has drifted from the tested .js and the page's copy (consolidate); Denver (code text not found), Nashville (Municode 403), NYC R11/R12 and commercial districts, other counties' use-code tables; NYC R6+ districts; the NYC "Owner playbook" line still says zoning not on file. Fixed 17 Nov: NYC and DC clicks showed "Lot Parcel" for the parcel number (now BBL / SSL), and NC OneMap's sale date was read as a sale price (never shown: it parsed as year 1727) |
| **23 states' codes unsearchable from the build machine** | "No law found" is unverified there | Alternate routes, or a script run from the user's computer |
