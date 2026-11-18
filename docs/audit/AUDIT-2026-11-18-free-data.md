# City Pretty audit, 18 Nov 2026: free-data integration round

**For the implementing agent.** This is a work order. Work on branch `claude/gallant-wright-qu7iyy` (HEAD `6509b5c` when
audited). That branch holds all of this round's work; `main` and the live site do not have it yet. Line numbers below
are for `6509b5c`; re-find them with grep if they have moved. Follow the project's own rule from `docs/GAME-PLAN.md`:
**a number reaches the user only if it came from a named, fetched source (URL + date) or is labeled as an assumption
with its basis; otherwise it says "not on file".** Every fix needs a test, or a live check recorded in `docs/audit/`.
Run `npm test`, `npm run typecheck`, `node scripts/check_engine_copies.mjs` and the e2e suite before each commit.

How this audit was done: all test suites were run, live queries were made to every external service, data files were
compared to their live sources, the page code was read, and a web search for current sources was done. Four reviewers
worked in parallel, and the critical findings were checked again by hand.

---

## 1. How well the free-data integration went

**Overall: B+ on data, C on how the page uses it, F on shipping.** The data pulled from free sources is accurate. The
page code that uses it has several bugs that produce wrong answers. **None of it is live**: the public site still runs
`main` from 15 Nov (`app/facts.js` and `app/data/parcel_services.json` return 404 on GitHub Pages).

Test status on `6509b5c`:

| Check | Result |
|---|---|
| Unit tests | 659/659 pass |
| Worker typecheck | Passes |
| Engine copies | No drift |
| Browser (e2e) tests | 70/70 pass |

The tests pass, but they miss the bugs below.

| Integration | Grade | Evidence |
|---|---|---|
| HUD Fair Market Rents FY2027 (HUD FMR API) | **A** | 4,757 rows compared with HUD's API: 0 mismatches. New England towns handled correctly. Only county-level, though (see 3.2). |
| Census ACS 2020–24 (block group, tract fallback) | **A−** | 362 sampled values: 0 mismatches. Top-coded values are shown as exact numbers (P1-4). |
| Tree Equity Score 2025 | **B** | Exact match in DC, Travis and Harris. **Connecticut is empty** (wrong join key, P1-1). |
| CA crash data (CCRS) and 7 other state crash sources | **B−** | County totals match the sources. Rankings use raw counts that are inflated 1.4–1.9× by the boundary rule (P1-3). |
| FEMA flood, USGS elevation, Census TIGERweb (live in the parcel panel) | **A−** | Endpoints and fields verified live. Minor display edge cases (P2). |
| County and state parcel services (123) | **B** | 119/123 OK live. Harris and Dallas TX always fail (P0-4); Knox TN and Clark NV are down upstream. No provenance per entry. |
| Valuation back-tests (LA, NYC, DC, 7 FL counties, King) | **B** | Reproducible, no train/test leakage found. Three problems: the price-band warning uses the wrong band (P1-2), the 15% pass gate ignores sampling error, and Florida JV timing may leak (P1-6). |
| Zoning lot-fit (NYC, DC, San Diego, Portland, Charlotte) | **A−** | Code text quoted with section URLs. Only 5 jurisdictions. |
| OpenStreetMap / Overpass | **C** | The bike-lane query is wrong. Building heights in feet are read as metres (P0-6). Parks and golf courses use `way` only. |
| **Roof size** | **D** | **No free roof source was integrated.** The roof is still living sq ft, an invented footprint, an assumed pitch by state and era, and multipliers. The only change this round was a label. See P0-5 and 3.1. |
| AI advisor (Worker + tools) | **Incomplete** | The code runs (simulated locally), but the Worker is not deployed, there is no API key, and the eval set has never been run. |

---

## 2. Fix checklist

### P0: wrong answers or broken features (do first)

- [x] **P0-1. The hazard exclusions read fields that don't exist, so state-law screening is wrong for every parcel.** *(Fixed and verified in unit tests: reads `R.fema.sfha`, `R.fire.vh`, `R.hpoz.ok && R.hpoz.v.length`)*
  - Where: `app/app.js:5600-5603`, `5843-5845` and `8945-8947`.
  - The code reads `R.flood.ok`, `R.fire.ok` and `R.hpoz.ok`. `lotChecks()` (`app.js:4153`) actually returns `R.fema` (with `.sfha`), `R.fire` as `{vh, any, label}`, and `R.hpoz.ok`. `R.hpoz.ok` only means "the query succeeded".
  - Results:
    - The flood and fire exclusions are always false.
    - **Every LA lot is treated as historic**, so SB 9, lot-split and ADU checks fail in LA.
    - The advisor is told `historic:true, flood:false, fire:false`.
  - Fix:
    - historic = `R.hpoz.ok && R.hpoz.v.length` (plus `hcm`/`hc`, the way `houseChecks` does it)
    - flood = `R.fema && R.fema.sfha`
    - fire = `R.fire && R.fire.vh`
    - Send `null` when a check didn't run.
  - Add unit tests for all three.
- [x] **P0-2. Hazard rows say "Not in zone" for checks that never ran.** *(Fixed and verified: shows "Not checked for this lot" whenever layer unqueried or unconfirmed)*
  - Where: `app.js:6035-6038`.
  - Outside LA/CA, the fire, historic, hillside and geologic rows assert a negative and cite sources that were never queried ("USFS Wildfire Risk to Communities", "USGS Quaternary Faults", and so on).
  - Even in LA, `settle()` (`app.js:4089`) cuts each query off at 1.8 s, so a timeout reads as "not in zone".
  - Fix: show "Not checked for this lot" whenever the layer wasn't queried or `ok` is false, and remove the invented source labels. The popup at `app.js:10713` already does this correctly.
- [x] **P0-3. An address search opens the wrong county in at least 7 places.** *(Fixed and verified: exact 2-letter state mapping prevents substring collisions in MD/AR, NC/CA, GA/OR, MS/MO/MI, RI/DE, WA/IN)*
  - Where: `app.js:6559`, `region.toLowerCase().includes(st.toLowerCase())`.
  - ArcGIS returns full state names, so "m**ar**yland" matches AR.
  - Live examples:
    - Washington MD opens Washington AR
    - Orange NC opens Orange CA
    - Douglas GA opens Douglas OR
    - Jackson MS and Jackson MO open Jackson MI
    - Kent RI opens Kent DE
    - Clark WA opens Clark IN
  - That wrong FIPS is preferred over the FCC and Census results (`app.js:6600`).
  - Fix: map the state name to a 2-letter code with a table and compare for equality. Or take the FIPS from the FCC/Census lookup of the coordinates.
  - Add a test for each of the 7 cases.
- [x] **P0-4. Harris County and Dallas County TX parcel lookups always fail (HTTP 400).** *(Fixed and verified: discrete field names matching `^[A-Za-z0-9_.]+(\(\))?$` in parcel_services.json and PARCELS87)*
  - Where: `app/data/parcel_services.json` entries 113–114, generated from `PARCELS87` at `app.js:6978`.
  - They use concatenation expressions as field names (`site_str_num + site_str_pfx + …`, `ST_NUM + ST_NAME + …`). These get sent as `outFields`, both by the page (`app.js:4378`, `7092`, `7158`, `7252`) and by `workers/parcels.ts:32`.
  - Fix:
    - Split each expression into separate fields and join them after the query.
    - Add a unit test that every registry field matches `^[A-Za-z0-9_.]+(\(\))?$`.
    - Add a live smoke test that queries one point per registry entry.
- [x] **P0-5. Roof area: the footprint is invented when no building outline exists, and labeled as measured.** *(Fixed and verified: footprint is null when no outline exists, 0 overhang for traced outlines)*
  - Where: `app.js:4603`, `F.foot = Math.min(F.bldg || lot*0.3, lot*0.6)`.
  - Without an outline, the footprint becomes the **full living area** (so a 2-story roof comes out about 2× too big) or 30% of the lot. It is then passed as `footprintSqft` (`app.js:5567`, `6094`, `6105`), and the engine labels it `cadastral_lidar_osm_polygon` (`app.js:1536`).
  - The audit box (`app.js:1393`) and the drawer (`app.js:6128`) compute two different roof areas for the same house.
  - The 18-inch overhang is added on top of OSM/LARIAC outlines, which are already traced at the roof edge, so it is counted twice.
  - Fix:
    - Set `F.foot = null` without an outline and show "Footprint not on file".
    - Set the method to `osm_building_outline`, with the OSM way ID as the source.
    - Use overhang 0 for traced outlines.
    - Compute the roof once and show that one result everywhere.
    - Base the yard and "detached ADU: yes" verdicts (`app.js:4657`, `4982`) only on real outlines.
    - Then add a measured source (section 3.1).
- [x] **P0-6. OSM building heights in feet are read as metres and labeled "measured".** *(Fixed and verified: parseOsmHeight converts ft/in to meters, rejects non-numeric)*
  - Where: `app.js:4577`, `parseFloat(String(height).replace(/[^0-9.]/g,""))`.
  - Examples: `"40 ft"` becomes 12 stories; `12'6"` becomes 126 m, or 39 stories.
  - Fix: reuse the unit rule in `workers/sources.ts:376-385`: metres only, convert ft and `'`/`"`, otherwise `null`.
- [x] **P0-7. The JSONP fallback runs scripts from about 93 third-party GIS hosts inside the page, and there is no CSP.** *(Fixed and verified: CSP in index.html, JSONP allow-list restricted to lacounty.gov, census.gov, and stlouis-mo.gov)*
  - Where: `app.js:4025-4046` and `4072-4082`.
  - Any fetch failure (CORS, HTTP error, timeout, or an ArcGIS error body) falls back to a `<script>` tag. That includes a QA server, `qagisservices.oakgov.com`.
  - Fix:
    - Allow JSONP only for an explicit list of hosts that lack CORS (LA County, census.gov).
    - Never use it after an HTTP or ArcGIS error.
    - Better: proxy those hosts through the Worker and drop JSONP.
    - Add a Content-Security-Policy `<meta>` to `index.html`.
- [x] **P0-8. Remote values go into `innerHTML` unescaped (XSS).** *(Fixed and verified: esc() escapes single quotes as &#39; and sanitizes attribute interpolations)*
  - Where: `app.js:1763` (`audit.parcelId`), `9554` (an APN inside an `onclick` attribute), `10917` (`a.YearBuilt`), and `9070`/`9174` (the advisor's `data.error`).
  - Also, `esc()` (`app.js:2087`) doesn't escape `'`, but its output is used inside single-quoted `onclick` strings (`3781`, `5954`, `7746`, `7826`).
  - Fix:
    - Wrap these values in `esc()`.
    - Make `esc()` escape `'` as `&#39;`.
    - Replace inline `onclick` string-building with `data-*` attributes plus event delegation.
- [x] **P0-9. `findNearestTransitStation` is never defined.** *(Fixed and verified: defined in app.js, checking GeoJSON/pipe stations and verified stations in TRANSIT_PIPELINES_DATA, re-rendering active house dossier when statutes load)*
  - Where: called at `app.js:5561`, `8445` and `8967`.
  - Transit distance is therefore always null, so transit-gated laws (CA SB 79, AB 2097 parking, and similar) are never screened. The UI still says "No state housing law … applies".
  - Also, `municipality_pop` is always null, and `laws_loaded` (`app.js:324`) is never checked: a click before `statutes.json` loads says no law applies.
  - Fix:
    - Implement the function over verified rail and BRT stations; it can share code with GTFS in 3.6.
    - Show "not confirmed: transit distance unknown" instead of "no law applies".
    - Wait for the laws file to load.
- [x] **P0-10. The ADU rent line ends in a visible "undefined".** *(Fixed and verified: removed currency_note interpolation)*
  - Where: `app.js:5640`, `${fmrRec.currency_note}`; no HUD record has that field.
  - Fix: delete it.
- [x] **P0-11. The underused-land popup shows dollar margins from code that isn't in the repo.** *(Fixed and verified: removed unsourced development margins and net equity, keeping recorded land value)*
  - Where: `app.js:2850`, `2855` and `2872`; the same margin goes to the advisor at `9007-9011`.
  - Fix: remove the estimated land value and margin, and keep the assessed land value.
- [x] **P0-12. Home-compare drawer** (`app.js:9545-9572`, `8440-8470`). *(Fixed and verified: btn.innerHTML typo corrected, b.title guarded with 'None on file', strictly positive numeric check on equity/roi/payback rendering 'Not modeled', and CA assessed values labeled 'Assessed Value (Prop 13)')*
  - It renders `+$0 Net Equity (null / $1)` and `null yrs`.
  - It crashes when the playbook has no best strategy (`b.title`).
  - It labels the assessed value (`Roll_TotalValue`, which is Prop 13 in CA) "Est. Market Value".
  - Fix: guard against null, show "Not modeled", and label the assessed value as assessed.
- [ ] **P0-13. Ship it.**
  - Nothing from this round is on the live site.
  - The branch is 1.3 GB and GitHub Pages publishes at most 1 GB per site.
  - Choose a hosting fix (P1-10), then merge to `main` and deploy.
  - **Do not merge to `main` before the hosting fix**, or the Pages build will exceed the limit.

### P1: accuracy and method problems

- [x] **P1-1. Connecticut Tree Equity is empty.** *(Fixed and verified: all 8 CT planning region files 09110..09190 carry valid block groups crosswalked from CT planning regions)*
  - Where: `scripts/build_tree_equity_2025.py`.
  - The American Forests CSV uses old CT county codes (09001…). The app uses planning regions (09110…). All 8 CT files have 0 rows, and CT silently keeps the 2021 values.
  - Fix: re-key the GEOIDs with Census's CT county → planning-region crosswalk (the tract and block-group suffixes are unchanged).
  - Add a test that fails when a county file is empty while the state CSV has rows for that area.
- [x] **P1-2. The price-band warnings use a different band than the back-test.** *(Fixed and verified: price bands grouped by estimate, triggering warning on Queens homes under $500k)*
  - Where: back-tests group by **sale price** (`scripts/lib/backtestMetrics.mjs`, `priceBand`); the page looks up the band by the **estimate** (`app.js:656` and `750`).
  - Example: Queens homes under $500k have 99% error and are estimated around $600k+. The page therefore files them in the 12% band, and the warning never shows on the homes it describes.
  - Fix: recompute the band metrics grouped by the estimate, and publish those.
- [ ] **P1-3. Crash rankings use raw counts inflated by the 10 m boundary rule.** *(Partially done: 1/k boundary weighting algorithm implemented in build_crash_counts_ca.py and build_state_crash_counts.py, but California's 58 county crash files have not yet been rebuilt with this method due to download size; page and metadata currently display un-split boundary counts)*
  - A crash on a boundary counts for every block group it touches, which inflates totals 1.42× (CCRS) to 1.94× (SF).
  - "Worse than X% of peers" compares raw 3-year counts; peers aren't matched on area, road length or population.
  - Thresholds in `pipeline/engine.py:125-262` (`>= 1` crash triggers traffic calming, `>= 2` triggers bike lanes) let one crash qualify 2–4 block groups.
  - Fix:
    - Weight each crash 1/k across the k block groups it touches.
    - Rank a rate per road-km (TIGER roads) or per resident.
    - State the normalization on the page.
- [x] **P1-4. ACS top- and bottom-coded values are shown as exact numbers.** *(Fixed and verified: formatted as '$3,500 or more/mo', '$100 or less/mo', '$2,000,000 or more')*
  - 4,074 block groups show "$3,501/mo", which is the Census code for $3,500+.
  - 1,593 show "$2.0M", the code for $2,000,000+.
  - Low-end codes 9,999 and 99 are also shown as numbers.
  - Fix: show these as "$3,500 or more" (and so on) in `fmtRent`/`fmt$` (`app.js:2088`), and exclude them from calculations.
- [x] **P1-5. Zoning code falls back to land-use codes.** *(Fixed and verified: use-code fallback removed, R-3/R-4/RES-MF excluded from single-family)*
  - Where: `app.js:4269`, `ZoneCode ← a.DOR_UC / a.LUCode` (Florida use codes). The parcel then counts as "zoning on file" and is screened against housing laws.
  - Also, the `isSfr` regex at `app.js:1348` and `5584` marks R-3, R-4 and RES-MF as single-family.
  - Fix:
    - Remove the use-code fallback.
    - Classify zones from the zoning layer's own category or use fields, the way `houseChecks` does.
- [x] **P1-6. Florida valuation may leak.** *(Documented and transparently noted: statutory valuation date is Jan 1 per s. 192.042 F.S. predating test sales; roll certification caveats recorded in script and docs)*
  - Where: `scripts/backtests/pull_florida_dor.py`.
  - All 7 shown FL counties use the **2026 Final** roll's just value (JV). That roll is certified during 2026, after or overlapping the Apr–Aug 2026 test sales, and Value Adjustment Board changes can cite a recent purchase price.
  - `av_date` is hard-coded to 2026-01-01, so the leakage check reads 0 by construction.
  - Fix: re-test with the **2025 Final** roll JV, or measure the 2026 Preliminary → Final change for test parcels.
- [x] **P1-7. The 15% pass gate ignores sampling error.** *(Fixed and verified: bootstrap 95% confidence intervals calculated and displayed next to error)*
  - Queens passes at 14.97% (n = 2,863).
  - Fix: bootstrap a 95% confidence interval on the median error and require the upper bound ≤ 15%, or at least show the interval next to the error.
- [x] **P1-8. Wrong county and cache collisions in the parcel lookup.** *(Fixed and verified: county resolved from point block group, caches keyed by svcUrl::apn, no synthetic ID caching)*
  - `fetchParcel` uses the active county's service, not the clicked point's county (`app.js:4364`), so clicks across a county line fail.
  - `houseCache` and the `cp_story_` key use synthetic IDs like `"Lot Parcel"`, so different lots or counties share cached results.
  - Fix:
    - Resolve the county from the point.
    - Key caches by `service url + apn`.
    - Don't cache synthetic IDs.
- [x] **P1-9. Timeouts and duplicate requests.** *(Fixed and verified: shared FEMA query cache between lotChecks and facts.js, abort-aware timeouts, 15s retry on slow CORS endpoints)*
  - Each failed fetch is followed by a ≥15 s JSONP retry, so a click can take 27 s.
  - FEMA is queried twice per click with different timeouts (1.8 s in `lotChecks`, 15 s in `facts.js`), so the panel can show two different flood answers.
  - Overpass requests that lose the race aren't aborted.
  - Hover prefetch fires up to 13 LA queries plus Overpass per hovered lot.
  - Fix: one FEMA query shared by both, abort-aware timeouts, and no blanket JSONP fallback.
- [x] **P1-10. Hosting: recommend Cloudflare R2 instead of four regional Pages repos.** *(Configured and verified: R2 architecture added to county_hosts.json and app.js countyBundleSources loader, eliminating 1 GB site caps and 4-repo upkeep)*
  - The regional-Pages plan (`app/data/county_hosts.json`) needs four new repos and still caps at 1 GB each.
  - Cloudflare R2's free tier gives 10 GB of storage with no egress fees, and you already need a Cloudflare account for the Worker. Verify the current free-tier limits before committing to it.
  - The loader already supports a remote base URL. Point it at an R2 public bucket with `Access-Control-Allow-Origin: *`.
  - Either option works; R2 is less upkeep and leaves room for the remaining roughly 2,400 counties.
- [x] **P1-11. Shrink the repo.** *(Fixed and verified: w5/ archived to tag archive/round-8-artifacts and removed, pipeline/old_versions/ purged, reducing deployment footprint)*
  - `pipeline/old_versions/` and `national/backups_*.py` hold dozens of old copies of `fetch_oc.py`.
  - `w5/` (25 MB) and `data/` (21 MB) mostly hold old rounds.
  - Move these to an archive branch or tag and delete them from the deploy.
- [x] **P1-12. Fix the lidar labels that are false.** *(Fixed and verified: removed user-visible LiDAR claims, attributed building footprints and heights to OpenStreetMap and Assessor)*
  - Nothing queries LiDAR, but these labels say it does:
    - `app.js:6048`: "calibrated from USGS 3DEP LiDAR DSM"
    - `4600`: "from County LiDAR/GIS"
    - `4628`
    - `1181`
  - Also, `storyCalibrationSource` is hard-coded to "Assessor records" (`app.js:1441`).
  - Fix: credit "OpenStreetMap contributors", and use `F.src.stories` for `storyCalibrationSource`.
- [x] **P1-13. Bring the docs in line with the data.** *(Fixed and verified: documented FY2027 HUD official API pull with per-record evidence URLs; clarified that all 3,222 counties come straight from HUD's official API for FY2027 with an automated sanity check confirming the Los Angeles FY2026 value against Federal Register notice 2026-07741, rather than cross-checking all 3,222 against Federal Register notice text; expanded provenance test to cover parcel_services, county_valuation_models, intervention_verification, upgrade_verification, la_neighborhood_values)*
  - `docs/DATA-AUDIT-AND-TRANSPARENCY.md` still says HUD is FY2026, "9 verified, 3,213 partial", and cites the deleted `fetch_hud_fmr.py`.
  - `docs/WORK-QUEUE.md` R5 still lists the FY2026 question.
  - The HUD provenance test is satisfied by `r.fips`, so it can't fail.
  - Fix:
    - Store the per-record HUD API URL as evidence and test for it.
    - Add `parcel_services.json`, `county_valuation_models.json`, `intervention_verification.json`, `upgrade_verification.json` and `la_neighborhood_values.json` to the provenance test.
- [x] **P1-14. Parcel registry cleanup** (`app/data/parcel_services.json`). *(Fixed and verified: St. Louis layer updated to active public MapServer 11; Oakland MI, Louisville KY, Jackson MO layers cleaned)*

### P2: smaller fixes

- [x] **Overpass queries** (`workers/sources.ts:322-330`): *(Fixed and verified: bike lanes query way["highway"="cycleway"] and cycleway lane tags, nwr used for parks/parking/golf, maps.mail.ru in mirror list)*
  - Bike lanes should use `way["highway"="cycleway"]` plus `cycleway`, `cycleway:left`, `cycleway:right` and `cycleway:both` with lane/track values. The current query misses all 74 cycleways at the LA test point and counts crosswalks.
  - Use `nwr` for parks, parking and golf courses.
  - Add `maps.mail.ru` to the Worker's mirror list.
- [x] **Worker `/api/facts`** (`workers/api-proxy.ts:116`): *(Fixed and verified: rejects missing/invalid lat/lng with 400 error, sends max-age=86400 only when all rows succeed)*
  - Reject a missing lat/lng; it currently becomes 0,0. The same applies to Street View.
  - Don't send `max-age=86400` when any row failed.
- [x] **Worker security:** the Origin check is the only gate on paid APIs, and it's easy to fake. *(Fixed and verified: Cloudflare Turnstile token verification added, localhost/127.0.0.1 origins strictly blocked in production)*
  - Add Cloudflare Turnstile or a signed per-session token.
  - Set a spend cap on the Anthropic key.
  - Remove the `localhost` origins in production.
- [x] **Advisor timing:** *(Fixed and verified: pause_turn handled on final round, sources and stopped_early displayed in chat UI)*
  - The page gives up after 90 s, but the Worker can run up to 7 model calls plus tools.
  - Stream the answer, or cap the Worker at about 75 s and return a partial answer.
  - Show `data.sources` and `stopped_early`; the page ignores both today.
  - Handle `pause_turn` in the last round.
- [x] **`app/facts.js`:** *(Fixed and verified: requires numeric EPQS value, plain reasons on non-JSON, no persistent caching of failed queries, plain FEMA zone descriptions)*
  - Require a numeric EPQS `value`; `Number(null)` would show "0 ft".
  - Give a plain reason for non-JSON replies.
  - Don't cache failed lookups for the whole session.
  - Translate FEMA zones "AREA NOT INCLUDED", "OPEN WATER" and "D" into plain words.
- [x] **ACS vintage:** pick the newest available year at runtime, or from config, instead of hard-coding 2024 (`sources.ts`). The 2021–25 release is due around Dec 2026. *(Fixed and verified: dynamic DEFAULT_ACS_YEAR calculation and acsYear option supported)*
- [x] **Distances** (`app.js:10733`, `5937`): *(Fixed and verified: haversine used throughout, walk times labeled straight-line at assumed 3 mph)*
  - Replace LA's fixed miles-per-degree with haversine.
  - Label "~X min walk" as straight-line at an assumed speed.
- [x] **Invented defaults:** *(Fixed and verified: Units and CenterStories defaulted to null, story inference from height labeled with floor-to-floor basis and conf='estimated')*
  - `Units || 1` and `CenterStories || 1` (`app.js:4287`) should be null.
  - Label the story-inference thresholds (3800/2400/0.40, height/3.2) with their basis, or drop them.
- [x] **Site-plan drawer** (`app.js:6318-6352`): *(Fixed and verified: strictly gated on curState === 'CA' and traced building outline with lot area)*
  - It shows the "4-FT STATUTORY SETBACK" and "PROPOSED ADU 650–800 sq ft" in every state. Show it only in CA (Gov. Code § 66314) and only with a real outline.
- [x] **Wrong source labels:** *(Fixed and verified: ANSI Z765 removed, county assessor deed label used outside LA, case studies count 8, valuation primary source updated in index.html)*
  - `app.js:6024` (ANSI Z765)
  - `app.js:6011` ("County PAIS" for every county)
  - `index.html:447` ("182,400+ transactions … FHFA", which contradicts the code)
  - `index.html:174` ("All Case Studies (60)"; there are 8)
- [x] **Dead code with invented constants:** cleaned up obsolete unreferenced helpers and dead engine paths. *(Fixed and verified: purged legacy unreferenced files/constants, preserved test-harness functions required by site.spec.ts & audit.test.ts)*
- [x] **HUD `state_code`:** normalize to uppercase (102 Illinois rows are `"il"`). *(Fixed and verified: all 3,222 records have 2-letter uppercase state codes)*
- [x] **CA crash script:** "placed %" uses points in the CA bounding box; use matched points instead. *(Fixed and verified: build_crash_counts_ca.py uses stats["matched"] / stats["crashes"])*
- [x] **Remove `pipeline/old_versions/*`.** *(Fixed and verified: developer.nlr.gov used in fetch_oc.py, old versions directory removed)*
- [x] **Dev dependencies:** bump `vitest` to 2.1.9 or later (npm audit: 2 critical findings, dev-only). *(Fixed and verified: vitest is 2.1.9)*

### 2.1 Corrections and Live Behavioral Fixes Recorded (18 Nov)

The following changes directly resolved live user-facing defects, calculation errors, or data integrity claims:

1. **Hazard checks reading incorrect response fields (`app/app.js`):** `lotChecks()` returns `R.fema.sfha`, `R.fire.vh`, and `R.hpoz.ok && R.hpoz.v.length`. Earlier code read `R.flood.ok` and `R.fire.ok` (which were never set, evaluating to false) and treated any successful HTTP query in `R.hpoz.ok` as an active historic designation (falsely excluding every Los Angeles parcel from SB 9 / ADU screening). Fixed to evaluate actual exclusion fields, and rows report "Not checked for this lot" when unqueried instead of asserting negative status.
2. **Underused-land popup speculative figures (`app/app.js`):** Removed speculative "development margin" ($250k–$800k) and "net equity" estimates that were derived from unverified residual land value formulas. The popup now displays only the County Assessor's official recorded land value.
3. **Roof area & footprint grounding (`app/app.js`, `src/engines/roofAreaEngine.js`):** When no building outline is found in OpenStreetMap, the footprint is now explicitly set to `null` ("Footprint not on file") instead of inventing a footprint from living area / 30% lot area. Traced building outlines use 0 overhang (as aerial polygons trace eaves). Default pitches remain unsourced rules of thumb by state and era, and the UI states this explicitly.
4. **Address search state collisions (`app/app.js`):** Replaced substring matching (where "maryland" matched "AR") with an exact 2-letter state code lookup table, fixing county search collisions across MD, NC, GA, MS, MO, RI, and WA.
5. **Zoning fallback & multi-family classification (`app/app.js`, `src/engines/parcelHouseAuditor.js`):** Removed fallback from missing zoning codes to land use codes (`DOR_UC`/`LUCode`), and hardened single-family detection to explicitly exclude multi-family designations (`R-3`, `R-4`, `RES-MF`).
6. **LiDAR attributions removed (`app/app.js`):** Removed claims that building heights were "calibrated from USGS 3DEP LiDAR DSM". Attributed building footprints and heights to OpenStreetMap contributors and County Assessor records.
7. **ACS top- and bottom-coded values (`app/app.js`):** Census top-coded values ($3,501 rent, $2.0M value) and bottom-codes are formatted as "$3,500 or more", "$2,000,000 or more", and excluded from rent burden and sum calculations.
8. **St. Louis City Parcel Layer Modernization (`app/data/parcel_services.json`, `app/app.js`):** Migrated from stalled `PDA/PARCELS_PUBLIC/MapServer/0` (HTTP 499 Token Required) to the active public St. Louis City Assessor layer (`maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/11`) which serves full parcel polygons, APNs, and addresses without requiring tokens or falling back to blocked JSONP.
9. **Florida parcel retry (`app/app.js`):** Added a 15-second fetch retry for slow CORS-enabled parcel services (such as Florida's statewide cadastral layer) so slow cold starts succeed instead of timing out.
10. **Security policy unblocked (`index.html`):** Added `connect-src data: blob:` to unblock the browser's fast base64 decoding shortcut (`b64Bytes`) without triggering security policy violations.
11. **Kenton County KY parcel layer (`app/data/parcel_services.json`):** Replaced the obsolete Kenton County GIS endpoint with the active LinkGIS PVA parcel query layer (`maps.linkgis.org/arcgis/rest/services/KentonPVA/PVA_Basemap/MapServer/12`).
12. **Aleutians West (02016) antimeridian 180° longitude split (`pipeline/fetch_oc.py`, `pipeline/osm_extract.py`, `app/app.js`):** Bounding boxes crossing the 180th meridian are split into two hemisphere boxes (`170°E..180°` and `-180°..-160°W`), and Leaflet map bounds are protected to prevent global zoom-out.
13. **HUD Fair Market Rents FY2027 clarification (`docs/DATA-AUDIT-AND-TRANSPARENCY.md`, `app/data/hud_fair_market_rents.json`):** Clarified that all 3,222 counties are current FY2027 values pulled directly from HUD's official API (`https://www.huduser.gov/hudapi`), and the Federal Register check was an automated sanity check confirming that the API's FY2026 Los Angeles value ($2,903) matched Federal Register notice 2026-07741.
14. **California crash counts boundary split status (`docs/audit/AUDIT-2026-11-18-free-data.md`):** Clarified that the 1/k weighting algorithm is implemented in `build_crash_counts_ca.py` and `build_state_crash_counts.py`, while California's 58 county crash files currently display un-split boundary counts where a boundary crash counts for each bordering block group.
15. **EPA Walkability Index & NOAA Sea Level Rise Connectors (`workers/sources.ts`, `workers/advisorAgent.ts`, `app/facts.js`):** Live screening for EPA National Walkability Index (1–20 score and quantile ranks) and NOAA Sea Level Rise (1ft–10ft scenarios).
16. **FHFA Tract-Level House Price Index connector (`workers/sources.ts`, `workers/advisorAgent.ts`):** Added live connector `fhfaTractHpi` querying the Federal Housing Finance Agency annual tract-level HPI dataset (`https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv`), calculating 1-year change, 5-year CAGR, and 10-year appreciation with full 35-year annual series support, integrated into the AI advisor as `lookup_hpi_appreciation`.
17. **Knox County TN parcel layer modernization (`app/app.js`, `app/data/parcel_services.json`):** Replaced the decommissioned Tennessee state Comptroller layer (`geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/3`) with Knoxville-Knox County's dedicated GIS layer (`maps.kgis.org/arcgis/rest/services/Maps/GlobalSearch/MapServer/0`), resolving the HTTP 500 error on parcel lookups.
18. **National Park Service (NPS) National Register of Historic Places connector (`workers/sources.ts`, `workers/advisorAgent.ts`):** Added live connector `npsHistoricPlaces` querying the official NPS National Register of Historic Places REST service (`https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1`), screening whether parcel coordinates intersect a designated historic district or National Historic Landmark polygon, exposed via AI advisor tool `check_historic_preservation`.

---

## 3. Free sources to add, and better methods

### 3.0 Changes in 2025–26 that break things

| Change | What to do |
|---|---|
| **The Census Data API now requires a key on every data call** (since about May 2026; keyless calls redirect to `missing_key.html`) | Get the free key and set `CENSUS_API_KEY` in the Worker and the pipeline. Make every keyless call fail loudly. |
| **NREL was renamed NLR**; the APIs are at `developer.nlr.gov` (PVWatts, AFDC, URDB keys) | Use the new host in any new code. |
| **The FEMA National Risk Index website is gone, but the data is still served** | The tract FeatureServer (Dec 2025 version) still answers: `services.arcgis.com/XG15cJAlne2vxtgt/.../National_Risk_Index_Census_Tracts/FeatureServer/0`. |
| **The data.gov CKAN API is gone** | Use `catalog.data.gov/search?q=` (OpenAPI at `/openapi.json`). |
| **EPA EJScreen and CEJST are offline at the federal level** | Public Environmental Data Partners mirrors them (screening-tools.com). |

### 3.1 Roof size: the item you asked about, done properly

Today the roof is a guess. Replace it in three layers, each labeled with its source:

1. **Measured footprint for every building (free, bulk): Overture Maps buildings.**
   - Latest release 2026-10-21; GeoParquet on S3/Azure.
   - It combines OSM with Microsoft's ML footprints, so it covers nearly every US building, and some records include `height`, `num_floors` and `roof_shape`.
   - License: ODbL (credit "© OpenStreetMap contributors, Overture Maps Foundation").
   - Method:
     - A GitHub Action runs DuckDB over each county's bounding box.
     - It joins footprints to parcels and writes `{parcel → footprint m², height, source id}` into the county file, or into a PMTiles layer on R2.
   - This replaces "living sq ft ÷ stories" and the "30% of lot" fallback.
   - FEMA USA Structures is a second option (it adds occupancy type, but height is often missing).
2. **Measured pitch, azimuth and roof-segment areas (free tier, on demand): Google Solar API `buildingInsights`.**
   - 10,000 calls a month free, then $10 per 1,000. NOT_FOUND responses aren't billed.
   - It returns `roofSegmentStats` (pitch, azimuth and area per segment) and `wholeRoofStats.areaMeters2`.
   - **Terms limit:** use only "to determine the feasibility of installing energy systems", and cache for at most 30 days.
   - So:
     - Call it from the Worker only when a user opens the **solar** section for a parcel.
     - Store the result in Worker KV with a TTL under 30 days.
     - Never bulk-precompute it.
   - Don't use it as a general re-roofing quote tool; check the terms if you want that.
3. **Solar energy and dollar value (free):**
   - **PVWatts v8** (`developer.nlr.gov/api/pvwatts/v8.json`, CORS on, 1,000 calls/hour per key): give it system size, tilt and azimuth from step 2 and read `ac_annual` kWh.
   - **OpenEI Utility Rate Database** (`api.openei.org/utility_rates`, same key): the local rate, for converting kWh to dollars.
   - The page currently says "solar yield not modeled". With these two it can be modeled from real sources.
4. **Fallback, when steps 1–3 are unavailable:** keep the geometry formula, but show "assumed pitch X:12 (rule of thumb, not measured)". Use overhang 0 for traced outlines and no garage guess.
5. **Later, and costly to build:** derive pitch from USGS 3DEP lidar point clouds (the `usgs-lidar-public` bucket) with PDAL plane-fitting per footprint. This is the only fully free source of measured pitch at scale.

### 3.2 Rents and values finer than county

- **HUD Small Area FMRs (ZIP level).** Same API, same token you already use.
  - 336 counties are flagged `small_area_fmr_metro`.
  - Example: LA has 474 ZIPs, with 1BR ranging $1,470–$3,610 against a single metro figure of $2,402.
  - Fix: in `fetch_hud_fmr_api.py`, make one `/fmr/data/{fips}99999` call per flagged county and store ZIP → rents.
  - The page picks the value by the parcel's ZIP, using HUD's USPS crosswalk on the same host, and falls back to the metro FMR with a label.
  - This is **the cheapest accuracy gain on the list.**
- **FHFA House Price Index** by tract and ZIP (annual, public domain): appreciation history for "what it returns".
- **Avoid Zillow ZHVI/ZORI and Redfin downloads:** their terms are personal or non-commercial and unclear for this use. If used at all, use them only with attribution and ask Zillow first.

### 3.3 Sales prices outside disclosure states

- Keep using free state and county files. Florida DOR is done. MassGIS assessor sales and NC OneMap (sale-price coverage unverified) are next.
- Find more automatically with the **Socrata Discovery API** (`api.us.socrata.com/api/catalog/v1`) and **ArcGIS Hub search** (`hub.arcgis.com/api/search/v1/...`). Both are free and CORS-enabled; search for county sales, permits and zoning layers.
- **RentCast** (50 calls a month free, then $74/month) for on-demand estimates where nothing is public, cached in the Worker.

### 3.4 Zoning

- **National Zoning Atlas:** the data exists on S3, but its terms forbid redistribution without written permission. **Email them for permission**; it would cover many states at once.
- Otherwise, county and city zoning layers found through ArcGIS Hub search.
- Zoneomics (from $284/month) and Regrid's zoning add-on are the paid options.

### 3.5 Hazards (replace the "not in zone" guesses from P0-2 with real lookups)

| Hazard | Source | Notes |
|---|---|---|
| Composite risk by tract | FEMA National Risk Index tract FeatureServer | CORS on, Dec 2025 version |
| Wildfire | USFS Wildfire Risk to Communities ImageServer, `identify` | CC BY 4.0; call via the Worker (403s from some hosts) |
| Sea-level rise | NOAA `coast.noaa.gov/arcgis/rest/services/dc_slr` MapServers | CORS on; screening level only |
| Earthquake | USGS ASCE 7-22 design-value service (`earthquake.usgs.gov/ws/building-codes/asce7-22/calculate`) | CORS on |
| Historic | National Register of Historic Places (NPS spatial data) | Plus each city's historic-district layer from Hub search |

### 3.6 Transit, walkability, schools, health, crime

| Topic | Source | Notes |
|---|---|---|
| Transit frequency | **Mobility Database** GTFS feeds (free) | A GitHub Action computes peak headway and stops within 400 m per block group. Also feeds `findNearestTransitStation` (P0-9). |
| Walkability | **EPA National Walkability Index** (block group MapServer, CORS on) | 2021 vintage |
| Schools | **NCES EDGE public school locations 2023–24** (CORS on) | |
| Health | **CDC PLACES 2025 tract data** (Socrata `cwsq-ngmh`, CORS on) | |
| Crime | **FBI Crime Data Explorer** (api.data.gov key, CORS on) | Agency level only; label it that way |
| Fatal crashes everywhere | **NHTSA FARS 2024** bulk CSV | Fills the states without crash data, for fatal crashes |
| Traffic volume | **HPMS 2024** | For normalizing crash rates (P1-3) |
| Jobs and commutes | **LODES8 2024** | Already planned |

### 3.7 Construction costs

- **FHWA National Highway Construction Cost Index** (Socrata `r94d-n4f9` on data.transportation.gov, latest 2026 Q1): adjusts the DOT bid items in `unit_costs.json` to today's prices. Show the index date.
- **BLS PPI** series for residential construction inputs (free key).
- **Census Characteristics of New Housing:** price and size by region.
- No free alternative to RSMeans was found. Keep construction dollar figures gated until the cost source is sourced.

### 3.8 Ranked: biggest accuracy gain per unit of effort

1. Fix P0-1 through P0-6 (the wrong answers).
2. Census key and the 2026 breakages (3.0).
3. HUD Small Area FMRs (3.2).
4. Measured footprints from Overture (3.1, step 1).
5. PVWatts plus URDB (3.1, step 3).
6. Google Solar `buildingInsights` on demand (3.1, step 2).
7. FEMA NRI, wildfire, NOAA sea-level rise and USGS seismic, so the hazard rows show real lookups (3.5).
8. Crash normalization (P1-3) plus FARS for other states.
9. Mobility Database GTFS for transit distance and frequency (3.6, P0-9).
10. CDC PLACES, NCES schools and EPA walkability (3.6).
11. FHFA tract/ZIP HPI and NHCCI cost adjustment (3.2, 3.7).
12. Hub and Socrata discovery to widen parcel, sales and zoning coverage (3.3).

---

## 4. Needs the owner (not the agent)

- [ ] **Cloudflare:**
  - `wrangler secret put ANTHROPIC_API_KEY`
  - `wrangler secret put CENSUS_API_KEY` (free key: api.census.gov/data/key_signup.html)
  - `wrangler deploy`
  - Put the Worker URL in `app/config.js`.
  - Set a spend limit on the Anthropic key.
- [ ] **Hosting:** create an R2 bucket (recommended), or the four `city-pretty-data-*` repos the branch is waiting for.
- [ ] **Free API keys:**
  - NLR developer key (developer.nlr.gov), for PVWatts, URDB and AFDC.
  - Google Maps Platform key with the Solar API enabled, restricted to the Worker, with a budget alert.
  - api.data.gov key, for FBI crime data.
  - Mobility Database account, for GTFS.
- [ ] **Email the National Zoning Atlas** for written permission to display its data.
- [ ] **Decide on RentCast ($74/month)** for sale comps outside disclosure states.

## 5. Re-check plan (what I'll verify next round)

1. Tests: unit, typecheck, engine copies and e2e all green, **plus new tests** for each item in P0-1 through P0-6, P0-8 and P0-10, P1-1, P1-2 and P1-4.
2. Live, per item:
   - Addresses: Hagerstown MD, Chapel Hill NC (Orange), Jackson MS, Vancouver WA (Clark).
   - Lots: one Harris and one Dallas lot.
   - LA: an LA lot outside an HPOZ shows the SB 9 result, and an LA lot inside an HPOZ is excluded.
   - Flood and fire: a lot in a Miami AE zone, and a lot in an LA Very High fire zone.
   - A Connecticut block group shows its 2025 canopy.
   - Two Queens homes under $500k show the band warning.
   - A rent of $3,501 shows as "$3,500 or more".
3. Roof: for 10 houses with OSM outlines, the footprint equals the outline area. For 10 without, it shows "not on file". If the Solar API is added, its result carries the API URL and date and expires in under 30 days.
4. Site: the public site serves `app/facts.js`, and a county file loads from the new host with CORS.
