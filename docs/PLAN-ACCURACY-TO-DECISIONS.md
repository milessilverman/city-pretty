# City Pretty: plan from "scores on a map" to "what to buy, what to build"

Written 18 Nov 2026. Supersedes the status claims in `DATA-AUDIT-AND-TRANSPARENCY.md` and the "COMPLETED" boxes in
`GRAND-VISION-AND-ECOSYSTEM.md` until Stage 1 below is finished.

## The goal

Open a county and get one decision brief:

1. **Where to invest**: neighborhoods ranked, with the reason and how much the ranking has been right in the past.
2. **What to build there**: public improvements and housing plays, ranked by return and by strength of evidence.
3. **Which properties to redevelop**: real sites (golf courses, surface parking, vacant and surplus land) with measured
   acreage, owner, zoning and a transparent homes-and-margin estimate.
4. **What to add to a given house**: ADU, lot split, added rooms or storey; what the law allows, what it costs, what it adds.
5. **Transit**: build or not, and at what scale (more buses, BRT, light rail, regional rail, HSR), with cost benchmarks.
6. **An AI advisor** that reads the same brief and can look things up, and cannot state a number the brief does not hold.

A limit to state once: no model can say *exactly* which neighborhood will rise. What this plan delivers instead is a
ranking whose past hit rate is measured and shown, so the confidence on each recommendation is earned, not asserted.

## Where it stands (found 18 Nov)

- The per-block-group pipeline data (Census, OSM, GTFS, crashes, canopy) is the solid part.
- The 14-15 Nov "accuracy" round replaced invented numbers with a second layer of typed-in numbers labelled verified.
  Checked example: LA FY2026 one-bedroom Fair Market Rent is 2,010 in the repo and 2,328 from HUD's API. The valuation
  "back-test" is five typed sample sales per county. Nationwide underused sites and intercity-rail station figures were
  typed into scripts.
- Nothing combines the engines into a ranked decision, and no recommendation has been tested against what happened.
- The AI advisor is not connected.

## Stage 1: make every input real (in progress, 8 agents)

| Workstream | Model | Output |
|---|---|---|
| HUD Fair Market Rents from the HUD API for every county, plus ZIP-level rents | Sonnet | `app/data/hud_fair_market_rents.json`, `app/data/hud_safmr/`, `scripts/fetch_hud_fmr.mjs` |
| Valuation back-test on thousands of real recorded sales per county, with a naive baseline to beat | Opus | `app/data/valuation_backtest_benchmarks.json`, `docs/VALUATION-BACKTEST.md` |
| Research library and case studies: each DOI resolved, each effect size found in the paper or removed | Sonnet | `app/data/research.json`, `research/research_verification.csv` |
| Housing laws, funding programs, state assessment rules checked against statutes; zoning engine never says "allowed" on an unverified law | Sonnet | `app/data/state-housing-laws.json`, `research/laws_verification.csv` |
| Transit pipelines, intercity corridors and unit costs checked; new tables of real per-mile costs and measured station value effects | Sonnet | `app/data/transit_cost_benchmarks.json`, `app/data/transit_value_effects.json` |
| Underused sites: typed sites re-measured from parcel services or removed; model outputs separated from facts | Sonnet | `app/data/underused_sites.json` |
| Decision engine, with the neighborhood score back-tested on tract price history | Opus | `src/engines/investmentDecisionEngine.*`, `app/data/neighborhood_score_backtest.json`, `docs/DECISION-ENGINE.md` |
| Link checker over every source URL; inventory of leftover claims and fallback numbers | Haiku | `scripts/check_source_urls.mjs`, `research/url_checks.csv`, `research/leftover_claims.md` |

Exit test: every row of every data table carries a `verification` block (status, date, evidence URL, quote); a unit
test fails the build if one is missing or if an unverified row carries a number.

## Stage 2: the decision brief, easy to use

- An **Invest** view beside Map and Explore: pick a county (or search an address), get the brief in five cards:
  where, what to build, which sites, this house, transit. Each number shows its basis (measured, modelled, assumed) and
  opens its source. One budget control ($100k to $100M+) changes which plays are shown.
- The page's null guards updated wherever Stage 1 removed a number, so "not on file" appears instead of a blank or NaN.
- Docs and README corrected to say what is and is not verified.

## Stage 3: the AI advisor

- `workers/api-proxy.ts`: the Claude call (Opus 5.5, prompt caching), given the decision brief as context, with lookup
  tools that return rows from the verified tables (lot facts, laws, costs, rents, sites, transit benchmarks).
- A grounding check on replies: any figure not present in the brief or a tool result is rejected and regenerated.
- Needs from the owner: an Anthropic API key and a Cloudflare account to deploy the Worker.

## Stage 4: depth where it pays most

Ranked by expected gain in accuracy:

1. **Sales and assessor attributes for more counties** (free where published; ATTOM or Regrid if bought). Drives both
   the valuation error and the "what does an added bedroom or ADU add here" answer.
2. **Systematic site discovery** from OpenStreetMap and parcel services for every county, replacing the curated list.
3. **Live zoning for more cities** (National Zoning Atlas, city services); without zoning, per-lot advice stays "not determined".
4. **Building permits** (city open data; Shovels if bought) as a leading signal in the neighborhood score.
5. **Round 8.6 pipeline re-run** (stale bus schedules, 150 more counties) from `NEXT_ROUND.md`.
6. **Monthly re-verification**: the link checker and the back-tests run on a schedule and open an issue when something drifts.

## How "accurate" is measured from now on

| Claim | Measure | Shown on the page |
|---|---|---|
| Home value | Median absolute error vs recorded sales, per county, vs a naive baseline | Range from the county's own error; withheld where untested or poor |
| Neighborhood ranking | Top-minus-bottom quintile appreciation over the next 5 years, out of sample | Hit rate beside the ranking |
| Law and funding facts | Share of rows verified against the statute | "Not determined" for the rest |
| Costs and rents | Pulled from the agency's own published figures, dated | Source and year on each figure |
