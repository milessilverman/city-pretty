# Review of the owner's commits 086b38b..c26bf06 (19 Nov 2026)

22 commits, read with `git show <hash>`. For each: what it shows to users or the AI advisor, the source check
(provider's own service, same parameters as the code), citations, labels, regressions, and fallbacks. Fixes are in
the commit that adds this file; corrections are logged in `docs/DATA-AUDIT-AND-TRANSPARENCY.md` (19 Nov 2026).

**Where these numbers appear.** The new hazard, health, school, walkability, sea-level, historic, house-price and
cost-index rows (`fromWorker` in `app/facts.js`) render only when the page gets its facts from the Cloudflare Worker,
and `app/config.js` has `workerUrl: ""`. So on the published page today they are not shown; they reach users only
through a deployed Worker (facts card and AI advisor tools). The HUD row, parcel services, transit-station lookup and
compare drawer are on the page now.

**Sample points** (one per state, used for every point source):
Austin TX 30.3005,-97.724 · San Francisco CA 37.7749,-122.4194 · Memphis TN 35.1495,-90.049 · Miami FL 25.7617,-80.1918 ·
Seattle WA 47.6062,-122.3321 · St. Louis MO 38.63,-90.2. Scripts and raw replies:
`/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/review18/` (not in the repo).

## Findings ranked by how misleading the shown number was

1. **NOAA sea level rise said "In 1ft SLR inundation zone" for dry high ground** (0c7a56d). The identify call returns
   one region-wide "1ft SLR Low-lying Areas" polygon (the same feature, Shape_Area 403,369,097,568 map units) for
   San Francisco City Hall (37.7793,-122.4193) and downtown Seattle (47.6062,-122.3321, 172 ft elevation by USGS), and
   the 3 ft layer the same. The depth layer returned nothing even in Miami Beach. **Withheld** with the reason.
2. **FHFA tract house prices: a blank FHFA cell was read as 0**, so 17,211 of 63,930 tracts (blank 2025 index in the
   file pulled 19 Nov) would have shown index 0, "+0%" for the year and **-100% over 10 years** (bba8ef0, 73a5deb;
   `Number("")` is 0 and `?? 0` added a second zero). Fixed; real-row test (tract 06037101220: 2024, 823.70, +125.67%).
3. **NPS historic check said "Not in National Register historic district" at listed buildings.** It reads only the
   polygon layer; at the NPS point of the Arctic Building (Seattle, 78002749), Colman Building (72001272), Majestic
   Hotel (St. Louis, 84002653), Fire Station No. 4 (Miami, 84000836) and 6 more (10 of 13 listed points tried), the polygon
   layer had nothing (0db2bd8, 73a5deb). Relabelled: "No National Register boundary polygon at this point", with why
   that is not a finding that the property is unlisted.
4. **"Nearby public schools" showed a juvenile detention school as the nearest school** for downtown Seattle
   ("Interagency Detention School, 4,049 ft"), and Austin's list includes "DELL CHILDREN'S MEDICAL CENTER" and
   "AUSTIN ST HOSPITAL"; the year label said 2023-2024, the layer is 2024-2025 (647126b). Relabelled (straight-line
   NCES listing, not the assigned school), year read from the layer.
5. **Under-construction rail stations counted as stations**, and the compare drawer's "0-Parking Exempt" (a California
   rule) shown in any state (d8afab5 made the lookup read `transit_pipelines.json` nationwide; its "verified" flag is
   about the location, and Century City / Westwood UCLA / Westwood VA say "under construction"). Fixed; test.
6. **Highway construction index offered for "2024 unit bid prices"** (647126b, 4a31e02): the advisor tool said it
   indexes 2024 unit bid prices, but `unit_costs.json` holds 2022-2026 local prices (street trees, playgrounds, bus
   shelters, sidewalks), and the facts row said "Used to index historical unit bid prices" though nothing uses it.
   Relabelled as a national highway index; the advisor is told never to apply it to building costs.
7. **Seismic Design Category shown without its assumptions** (a68b073): it is computed for an assumed Site Class D
   soil; St. Louis is "C" on Site Class C and "D" on Site Class D. Relabelled with the assumption.
8. **NRI score shown as "Score 95/100"** with no word that it is a relative ranking; **PLACES** percentages shown
   without "model-based estimates"; **EPA walkability** described as using "transit commute mode split" (EPA: distance
   to the nearest transit stop) and labelled "Census 2020" (EPA: 2019 block groups). Relabelled.
9. **Wrong publisher name**: PVWatts credited to "National Laboratory for Renewable Energy"; the lab's own site says
   "National Laboratory of the Rockies". Fixed. Output now carries its assumptions (tilt, azimuth, 14% losses).
10. **Audit checklist marked done what was not done**: P1-6 (Florida leak: only a comment was added), P1-10 (R2
    "configured and verified": the host `pub-data.citypretty.org` does not resolve), Worker security (Turnstile: the
    page sends no token), P1-11 (tag `archive/round-8-artifacts` does not exist). FHFA "FAQ Q5" and "FAQ Q32"
    citations could not be found. St. Louis "HTTP 499 token required" not reproducible; Kenton URL in the doc was not
    the one in the code. Corrected.

## Per commit

### 2d9c219 HUD Small Area FMR by ZIP; St. Louis MapServer 11; antimeridian test
1. Shows: HUD row title "HUD Small Area FMR (FY.., ZIP ..)" when a ZIP rent exists; ZIP read from parcel fields.
2. Source: HUD API `https://www.huduser.gov/hudapi/public/fmr/data/4811399999?year=2027` (Dallas),
   `.../1308999999` (Atlanta), `.../0603799999` (LA): ZIP rows come back in `basicdata` (e.g. Dallas
   `{"zip_code":"75001","Two-Bedroom":2250}`, LA `90001` 2BR 2330). `fetch_hud_fmr_api.py --safmr` looks for a key
   `smallareadata`, which HUD does not send, and `hud_fair_market_rents.json` has no `zip_rents` (0 records). **The
   ZIP path never runs**: nothing wrong is shown, the county/metro FMR is shown as before.
   St. Louis: `ASSESSOR/Assessor_Public_Parcels/MapServer/11` answers a point query (1300 PINE ST, 05050000100);
   fields `SITEADDR`, `ColParcelId` exist. The old PDA layer also still answers (same parcel).
3. Citations: none new.
4. Labels: if the ZIP path is ever turned on, the fallback `zipData.x ?? r.x` would mix a metro value into a row
   labelled with a ZIP. ZIP fields read include generic `ZIP`/`Zip`, which on some layers is the owner's mailing ZIP.
5. Regression: St. Louis sends no access-control-allow-origin, so the page uses JSONP; `https://*.stlouis-mo.gov` is in
   the CSP script-src. Live check below.
6. Fallbacks: the `??` metro fallback above.
Verdict: **needs owner** (SAFMR inert; fix the parser key and the ZIP source before enabling).

### 84e498d docs: completed items, SAFMR, St. Louis, bootstrap CIs
Docs only. Item 8 (St. Louis "HTTP 499 Token Required", "without falling back to blocked JSONP") not reproducible /
not true on 19 Nov (above). Item 11 names `KentonPVA/PVA_Basemap/MapServer/12`; the code uses
`Parcel_QueryOnly/MapServer/1`. Verdict: **fixed** (doc corrected).

### d8afab5 transit stations, compare drawer, site plan gate, advisor sources
1. Shows: nearest rail/BRT station (statute screening, compare drawer, advisor context); "Sources consulted" list.
2. `transit_pipelines.json` stations: "verified: true" on 3 stations whose own `desc` says "under construction".
4. Compare drawer "0-Parking Exempt" within 0.5 mi in any state (e.g. Chicago 95th/Dan Ryan).
5. No CSP change; `btn.tnnerHTML` typo fix is correct.
Verdict: **fixed** (stations not in service skipped; parking label California-only; test in `auditChecklist.test.ts`).

### 35d664f Turnstile; localhost origins blocked in production
1. Nothing shown.
5. `wrangler.toml` already sets `ENVIRONMENT = "production"`, so a deployed Worker (and `wrangler dev`, which reads
   `[vars]`) refuses `http://localhost:*` and `127.0.0.1:*`. `npm run serve` tests and the live checks do not use a Worker
   (`workerUrl` is empty; e2e mocks `https://worker.test`), so nothing breaks today. The page has no Turnstile widget
   and sends no `cf-turnstile-response` (and CORS allows only `Content-Type`), so **setting `TURNSTILE_SECRET_KEY` would
   refuse every advisor question**. Worker unit tests pass.
Verdict: **needs owner** (add the widget before the secret; local Worker testing needs ENVIRONMENT not "production").

### a68b073 FEMA NRI, USGS ASCE 7-22 seismic, Florida roll note
2. NRI `services.arcgis.com/XG15cJAlne2vxtgt/.../National_Risk_Index_Census_Tracts/FeatureServer/0/query?geometry=<lng>,<lat>&...outFields=TRACTFIPS,RISK_SCORE,RISK_RATNG,...`:
   Austin 48453000302 28.10 Relatively Low; SF 06075020101 92.80 Relatively High; Memphis 47157004200 97.33;
   Miami 12086006713 21.89; Seattle 53033008102 99.82 Very High; St. Louis 29510125500 94.91. Code fields match, tract
   geography, `NRI_VER` "December 2025" (item page: "Data Version: December 2025 (1.20.0)"). Match.
   USGS `earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=..&longitude=..&riskCategory=II&siteClass=D`:
   sdc/pgam Austin A/0.032, SF D/0.59, Memphis D/0.53, Miami A/0.024, Seattle D/0.69, St. Louis D/0.32. Match; but St.
   Louis Site Class C gives C, BC gives C.
3. FEMA pages (fema.gov, hazards.fema.gov) answer 403 from here; the arcgis item's terms quote used instead:
   "The National Risk Index data are meant for planning purposes only ... not a substitute for localized risk
   assessment analysis." Florida note: no new citation beyond s. 192.042, F.S. (already in the docs).
4. Labels: NRI shown as "Score 28/100" (no "relative"); seismic category without the Site Class assumption. Florida:
   checklist P1-6 marked done although only a comment was added.
Verdict: **fixed** (labels, notes for the advisor; P1-6 reopened).

### 5727cb5 PVWatts v8 + advisor tool; R2 option; crash 1/k weighting
2. `developer.nlr.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=30.3005&lon=-97.724&system_capacity=4&azimuth=180&tilt=20&array_type=1&module_type=0&losses=14`:
   ac_annual 5932.46, solrad_annual 5.396, capacity_factor 16.93, version "8.5.0", weather "NSRDB PSM V3 GOES tmy-2020
   3.2.0", station 1,928 m away. Match (fixture equals live). Docs: `array_type` 1 = "Fixed - Roof Mounted".
   Only Austin run (DEMO_KEY rate limits); the Worker always sends DEMO_KEY (no key wired).
3. Publisher "National Laboratory for Renewable Energy (NLR)" is wrong: the docs page footer says "The National
   Laboratory of the Rockies is a national laboratory of the U.S. Department of Energy". "(formerly NREL)" could not be
   confirmed on a fetched page; removed from the tool description.
   R2: pricing page confirms "10 GB-month / month" free and "no charges for egress bandwidth"; the base
   `https://pub-data.citypretty.org/` does not resolve (proxy 502 on CONNECT), so "CORS enabled" was never checked.
4. Advisor result had no assumptions; now returned with tilt, azimuth, losses, array and module type.
5. Crash 1/k weighting: script changed, data files not rebuilt (stated in b0e77f4). No page change.
Verdict: **fixed** (publisher, assumptions, R2 marked placeholder, P1-10 reopened).

### 647126b CDC PLACES 2025, NCES schools, Google Solar, FHWA NHCCI
2. PLACES `chronicdata.cdc.gov/resource/cwsq-ngmh.json?locationid=<tract>&$limit=50` (dataset title "PLACES: Local
   Data for Better Health, Census Tract Data, 2025 release"): GHLTH/CASTHMA/OBESITY/LPA Austin 11.4/9.3/26.7/14.4,
   SF 17.3/8.5/19.7/18.4, Memphis 11.3/10.0/31.3/14.0, Miami 9.1/7.8/22.0/14.5, Seattle 13.3/9.8/25.8/13.4, St. Louis
   15.4/10.6/33.3/19.0; all "Crude prevalence", year 2023 (2022 for some). Code reads `measureid`/`data_value`: match.
   Tract GEOIDs (2020) match, CT planning-region codes present.
   NCES `services1.arcgis.com/Ua5sjt3LWTPigjyD/.../Public_School_Locations_Current/FeatureServer/0/query?...distance=2000`:
   counts/nearest Austin 6 / LEE EL 2,792 ft, SF 20 / S.F. County Civic Center Secondary 2,267 ft, Memphis 6 / Memphis
   Grizzlies Preparatory Charter 994 ft, Miami 14 / SOUTHSIDE PREPARATORY ACADEMY 784 ft, Seattle 4 / Interagency
   Detention School 4,049 ft, St. Louis 20 / CONFLUENCE PREPARATORY ACADEMY 440 ft. Every record SCHOOLYEAR "2024-2025"
   (code said "Current 2023-2024 School Year"): **mismatch**.
   Google Solar: **needs key, not checked**; not wired to any page or tool.
   NHCCI `data.transportation.gov/resource/r94d-n4f9.json?$limit=1&$order=quarter desc`: 2026 Q1 3.134822428; the
   code's 2024 Q1 constant 3.191321352 matches the 2024 Q1 row; 2003 Q1 = 1. Match.
3. PLACES quote: "This dataset contains model-based census tract estimates" and "users are cautioned against using
   these estimates for program or policy evaluations." NHCCI dataset description: "a price index that can be used
   both to track price changes associated with highway construction costs".
4. Labels: PLACES not called estimates; schools row implied the assigned school; NHCCI "Used to index historical unit
   bid prices" and advisor "index 2024 unit bid prices" (not true: mixed-year local prices; nothing uses it).
6. Fallbacks: NCES `lat: sLat ?? 0`, sort `distance_m ?? 0` (a school with no coordinates sorted first); Google Solar
   `pitch/azimuth/area ?? 0`. All now null.
Verdict: **fixed**.

### 4bc63cd remove w5/; 2eb9a28 P1-11 resolved
5. No script, test, workflow or package script reads `w5/`. Text references remain in `docs/pipeline-README.md`,
   `national/README*.md` (old copies), `docs/audit/alaska-bundles.md`, `docs/audit/bundle-catalog-audit.json` (evidence
   `w5/research/t_hump25.txt` line 77; `git show 4bc63cd^:w5/research/t_hump25.txt` line 77 reads "an average cost of
   $5,958 per speed hump"). The claimed tag `archive/round-8-artifacts` does not exist (local tags: none;
   `git ls-remote origin refs/tags/*`: none). Verdict: **fixed** (docs point at history; P1-11 note corrected).

### dc41d14 Kenton County KY parcel layer
2. `maps.linkgis.org/server/rest/services/Parcel_QueryOnly/MapServer/1` (layer "Parcels_KC_PVA"): envelope query in
   Covington returns PIDN 040-34-04-001.00, ADDRESS "400 W 3RD ST", LANDUSE_TE "OTHER RETAIL", CLASS_TEXT, ACREAGE
   ".980". Fields match. Sends access-control-allow-origin. Verdict: **sound** (live check below).

### 0c7a56d EPA walkability, NOAA sea level rise
2. EPA `geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?...`: NatWalkInd Austin 18, SF
   18.67, Memphis 17.17, Miami 18.67, Seattle 18.33, St. Louis 19.33; each equals D3B/3 + D4A/3 + D2A/6 + D2B/6 of the
   same row. Categories match the EPA user guide ("1 – 5.75 Least walkable ... 15.26 – 20 Most walkable").
   Geography: EPA "shares the SLD's 2019 Census Block Groups" (Seattle point: EPA 530330081002 vs 2020 Census
   530330081021). NOAA: see finding 1 (all 9 coastal/inland points, 1 ft and 3 ft).
3. EPA user guide (June 2021 PDF): D4a is "Distance from population center to nearest transit stop", not commute mode.
Verdict: **fixed** (EPA relabelled; NOAA withheld with reason; old SLR test replaced, it encoded the false positive).

### 835f341 antimeridian split (Aleutians West)
App change only guards `fitBounds` for boxes wider than 180 degrees; no numbers shown. Verdict: **sound** (not live
checked here: Alaska not in this run).

### b0e77f4 docs: HUD wording, CA crash boundary status
Reopens P1-3 correctly (files not rebuilt). Verdict: **sound**.

### bba8ef0 FHFA tract HPI connector; Knox County layer
2. `https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv` (89.9 MB, 63,930 tracts, 1975-2025): Austin
   48453000302 2025 954.01, +13.28%, 10-yr +87.80% (match); SF 06075020101, Memphis 47157004200, Miami 12086006713,
   Seattle 53033008102, St. Louis 29510125500: not in the file (connector says so). Blank cells: finding 2.
   Knox: the TN state layer answered "Service ... not started" (HTTP 500) and `www.kgis.org` 403 from here;
   c26bf06 put the state layer back, so net Knox config equals the pre-bba8ef0 one.
3. FHFA datasets page: "Census Tracts (Developmental Index; Not Seasonally Adjusted)". "FAQ Q5", "FAQ Q32", and
   "public domain" not found. A 90 MB download per advisor call is unlikely to finish inside a Worker's limits.
Verdict: **fixed** (blank handling, developmental label); Knox **could not check**.

### 0db2bd8 NPS NRHP connector; 73a5deb wire NPS and FHFA rows
2. `mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1/query` (polygons): only
   Austin's point hits (Perry Estate--St. Mary's Academy, 01000874). Layer 0 (points) was never read; 10 of 13 listed
   points tried have no polygon (finding 3). Layer description: polygons "represent boundaries created from connecting
   the bounding UTM coordinates submitted with the nomination". Verdict: **fixed** (wording; reading layer 0 is left to
   the owner).

### 4a31e02 NHCCI in siteFacts/facts/advisor; 994ba81 docs
See 647126b. Verdict: **fixed**.

### 7c026bb FHFA ingest, LA dataset, probe workflow, index.html
`app/data/fhfa_hpi_06037.json` (1,933 tracts) is read by no page or Worker code. Its sample 06037101110 (2025,
1297.06, +4.82%) matches FHFA; blank years handled. FAQ citations replaced. The probe workflow only records HTTP
status. index.html "6,587 mapped polygons" matches the LA bundle (`bgs` = 6,587); "4 unpopulated water/island block
groups omitted" not checked (index.html left alone). Verdict: **fixed** (citations).

### c26bf06 Knox fixture fix
Reverts Knox to the TN state layer (same file blob as before bba8ef0). Verdict: **could not check** (state server down).

## Live checks (19 Nov 2026)

Real page, `scripts/live_check_panels.mjs 29510 21117 06037` (LIVE_PORT 8941, 3 parcels each, through the page's own
click path; `data/backtests/live_check_panels_2026-11-19_review18.json`): **St. Louis City 3/3 parcels, every panel ok**
(the MapServer 11 layer works through JSONP under the CSP); **Kenton KY 3/3 ok** (one FEMA row "n/a"); **Los Angeles
3/3 ok except one FEMA row** (060375342023: FEMA now says X, the page showed "No effective FEMA flood map here"; FEMA
flood is not part of these commits, left as found). No page errors.

Station lookup on the real page (`findNearestTransitStation` after load): next to Westwood/UCLA (34.0636,-118.4468)
the nearest is now Expo/Sepulveda 2.08 mi (the under-construction station is skipped); next to Wilshire/La Brea
(open) it is Wilshire/La Brea 0.02 mi; in Cook IL next to 95th/Dan Ryan it is that terminal, 0.1 mi. The compare
drawer row itself was not reached by the script (the drawer did not render its homes tab); its California-only label
is covered by a unit test on the template, not seen live.

Worker code path
run against the real services for St. Louis (38.63,-90.2) and Seattle (47.6062,-122.3321) with the page's renderer:
every new row shows its label, year and limit; sea level rise returns "Not on file" with the reason; FEMA flood for
Seattle answered "fetch failed" (FEMA NFHL, transient; not part of this change).

## Left for the owner

- SAFMR: fix the parser key (`basicdata`) and read only a situs ZIP before running `--safmr`.
- Turnstile: add the page widget before setting the secret; decide how to test a Worker from localhost.
- NPS: read the points layer (listed buildings) before saying anything about a lot without a polygon.
- PVWatts: wire an NLR key (the Worker always uses DEMO_KEY).
- FHFA tract connector: a 90 MB file per call; consider per-county files like `fhfa_hpi_06037.json`.
- Florida P1-6 leak and R2 hosting remain open.
