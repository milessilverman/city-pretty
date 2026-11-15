# City Pretty: accuracy roadmap (before the AI is connected)

Written 15 Nov 2026 from a review of the code and data in this repository. Hand this to whoever works on accuracy.

## What the platform is for

City Pretty is for **investors who buy houses and land and improve the community while making a return**. The
AI, once connected, will answer questions such as:

- *What is the best thing to build where, and where should I buy?*
- *If a train line were built from Austin to San Antonio, where should it end for real-estate development, what else
  should be built, how much, and at what cost?*
- *Which golf course is the best to convert to homes, where, why, and what profit?*
- *Here is my house and a renovation plan (photos, plans, records): which addition adds the most value?*
- *Which tax measures and programs pay for part of it, and how?* (for example, LA County's Measure W, the Safe
  Clean Water Program, funding stormwater capture that street trees can provide)
- *Can this lot be split into more units?* (more homes per lot, which can bring prices down as density rises)

The AI can only be as good as the data it reads. **The job now is to make every number in City Pretty either
sourced or plainly marked as unknown.** Don't build the long-term features yet (renting units out during a
renovation, investor money, tax-credit financing).

## Rules for this work

1. **No invented numbers.** Every figure shown or passed to the AI comes from a source with a link, or it is
   `null` and the page says "not on file". A missing value is never filled with a typical-looking number.
2. **Every source is checked.** Use the pattern already in `research/citation_checks.csv`: fetch the URL, find the
   quote, record whether it supports the claim and the date checked. Add a `last_verified` date to every data table.
3. **Data lives in data files, not in `app/app.js`.** Move large constants (study library, case studies, transit
   pipelines, statutes, funding programs) into `app/data/*.json` with one record per source-backed item.
4. **Fix data in the pipeline** (`pipeline/`, `national/`) and rebuild; don't patch county data in the page. No
   `apply_*.py` scripts that edit `index.html` or `app/app.js` with string replacement.
5. **Plain labels.** No "Zillow-grade", "institutional", "audited", "100% operational", or "95% CI" unless a real
   statistical test produced it.
6. **Leave the look to Claude.** Don't change `app/app.css`, the header, the map bar or the welcome card markup in
   `index.html`. Change data, calculations and text.
7. **Keep the checks green.** `npm run check` (unit tests, Worker type-check, browser tests) must pass. Add a test
   with every fix.

## P0: remove or verify invented content (do first)

| # | What | Where | What to do |
|---|---|---|---|
| 1 | **Research library: 488 of 540 "studies" are generated filler** ("Study #24", authors like "Education Economics & Public Finance Consortium #24"), and none has a URL or DOI. Some of the other 52 pair real authors with titles that may not exist. | `RESEARCH_CORPUS_500` in `app/app.js` | Delete the 488. Verify each of the 52 (a URL or DOI, and the quoted finding); keep only what checks out, in `app/data/research.json`. Change "540+" everywhere to the real count. |
| 2 | **About 52 hard-coded fallback numbers** stand in for missing data: home value `\|\| 900000` / `750000` / `360000`, county population `\|\| 500000`, project costs `\|\| 25000`, transit development cost `\|\| 145000000` and its debt split, `lot \|\| 6000`, living area `1650` / `1800`. | `app/app.js` (search for `\|\| [0-9]{4,}` and `?? [0-9]{4,}`) | Replace each with `null`, carry `null` through the calculations, and show "not on file". If the calculation can't run without it, don't show its result. |
| 3 | **Planned transit "pipelines"** (21 corridors with stations, unit counts, affordable shares, total development cost, senior debt, TIFIA loan) mix real projects (the Chicago Red Line Extension's 103rd Street station is real) with invented numbers. | `corridorRings` / pipeline objects in `app/app.js`; compare with `research/transit_projects.csv` and `research/transit_stations.csv` | Keep only projects found in an agency's own documents, with status (planned, funded, under construction) and a source link. Drop financing figures unless the agency published them. |
| 4 | **Historic case studies** (High Line and others): uplift percentages, "Year 3 / 7 / 12" trajectories and tax growth have no sources. | `HISTORICAL_TRENDS_DATA` in `app/app.js` | Source each figure or remove it. |
| 5 | **State housing laws** used for "by right" claims: CA SB 79, SB 9, AB 2097, Gov. Code 66314; TX SB 840 and SB 15; Austin HOME; FL Live Local; WA HB 1110 and HB 1337; OR HB 2001; AZ HB 2720 and 2721. | `src/engines/statutoryZoningEngine.ts`, `stateReformHeadline()` and the prospectus in `app/app.js` | Put each law in `app/data/state-housing-laws.json`: citation, effective date, what it allows, the conditions (lot size, population, transit distance, exclusions), source URL and last-verified date. Show a law only where its conditions are met. |
| 6 | **Tax measures and funding programs** (Measure W, EIFD, TIF, CRA, TIRZ and others) are written as prose with LA-specific text. | Funding text in `app/app.js`; `src/engines/municipalFinanceEngine.ts` | Make a data table per jurisdiction: program, eligible project types (for Measure W, which kinds of stormwater capture qualify, so trees can be matched to it), funding share, how to apply, cycle dates, source. The AI will read this table. |
| 7 | **Fixed figures in text**, such as the canopy card's "+$7,130 home value and $140/yr cooling" and "19 agencies". | `canopy-heat-hud` in `index.html`; `patchCanopyCardDom()` and `syncHeaderDomToCounty()` in `app/app.js` | Read the figures from the county's data with their source, or remove them. |

## P1: make the core estimates trustworthy

| # | What | What to do |
|---|---|---|
| 8 | **Home-value estimate has never been tested against real sales.** Its ranges are fixed percentages; the state "calibrators" (Michigan 2x SEV, Florida Just Value, Texas CAD and others) are unverified. | Build a back-test: for each county, take recent arm's-length sales (county recorder files now, CoStar later), run the estimate as of the day before each sale, and report the median absolute error and the share within 10%. Show the range a county's back-test supports; withhold the estimate where its error is too large. Keep `valuationCheck()`. Verify each state's assessment rule with the state's own source. |
| 9 | **"$ per $1" returns per improvement**: effect sizes and costs should trace to `research/effects.csv`, `research/unit_costs.csv` and `research/cost_factors.csv`, but the "model range" bands use assumed spreads (code comments near `calibrateVpd` / grade SE in `app/app.js`). | Re-run the citation checks for every row. Derive each band from the studies' own reported ranges, or label it "assumed ±X%". Record which county figures were measured locally and which were borrowed from elsewhere. |
| 10 | **Zoning**: only some cities have live zoning; elsewhere the page used to assume "residential". | Record, per county, whether zoning is live, a snapshot (with its date) or missing. Never infer by-right rights from a missing zone. |
| 11 | **County coverage**: 637 county files are round 8.5 (built 7–8 Nov); round 8.6 (corrected bus measurements, 150 more counties) is unfinished; 67 counties have no data file at all. | Finish round 8.6 and build the 67. Move the "Near <name>" rule (`qualifyNearestNames()` in `app/app.js`) into the pipeline. Record each source's vintage in the county's metadata. |
| 12 | **Data tiers** (A to D) come from a hand-kept CSV (`src/data/county_sources_master.csv`) and an inline copy in the page (`COUNTY_COMPLETENESS_INDEX`). | Compute each tier from what the county file actually contains, and keep one copy. |

## P2: data the AI will need (structure it now, so connecting the AI later is quick)

| # | Data | Notes |
|---|---|---|
| 13 | **Per-lot facts** in one shape: parcel ID, use, zoning, lot size, living area, year built, beds and baths, assessor value, last sale, flood, fire, historic, transit distance, lot-split eligibility | The AI's context is `serializeLiveAdvisorContext()` in `app/app.js`; its accepted fields are listed in `src/ai/advisorGroundingContract.ts`. Unknowns stay `null`. |
| 14 | **Lot-split and added-unit rules** per state and city (CA SB 9, TX SB 15 minimum lot sizes, ADU rules) | Same table as item 5; this is what "split into multiple units" recommendations rest on. |
| 15 | **Construction costs** by item and region | `research/unit_costs.csv` now; StreetForge later (utilities and site costs). Record each cost's region and year. |
| 16 | **Underused land**: golf courses, parking lots, vacant parcels | Already a map layer. Add per site: acreage, public or private owner, zoning, flood and fire, distance to transit, nearby home values. This answers "which golf course to convert". |
| 17 | **Rents** | HUD Fair Market Rents (free) now; CoStar later. |
| 18 | **Transit and development studies**: measured home-value changes near new stations, by mode and distance | With citations. Needed for "what if this train line were built" questions. |
| 19 | **Sales and listings** | County recorder sales now; CoStar when available. |

## P3: keeping it accurate

- Every data file gets `source`, `source_url`, `retrieved` and `last_verified` fields, and a test that fails when
  any are missing.
- A monthly check that re-fetches source URLs and flags dead links or changed text.
- `docs/CHANGELOG.md`: what changed in the data, and why.

## Where the AI connects later (not now)

- `workers/api-proxy.ts`, function `askAdvisorModel()`: the Claude call. Budget is about $80 a month for one user,
  enough for several hundred long analyses with Claude Opus 5.5 and prompt caching.
- Lookup tools the AI should get once P0 to P2 exist: lot facts (13), zoning and state laws (5, 14), funding
  programs (6), comparable sales (8, 19), construction costs (15), underused land (16), transit effects (18).
- Photo and document uploads (renovation plans, home records) come with the AI integration. They will only be as
  accurate as items 8, 9 and 15.
