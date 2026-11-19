# Advisor routing: script-first answers

The advisor chat tries `app/advisor-scripts.js` first. When a question is plainly one of the fixed kinds below and a
county is loaded, the page answers it from data it already holds: no network request, no model call, no cost. Every
other question goes to the Worker (`workers/api-proxy.ts`) as before, with what the page found attached as
`context.scripted_findings`.

Each page answer keeps the panels' basis tags (`[measured]`, `[modelled]`, `[assumed]`), names its source (with a
link where the page has one), says "Not on file" with the reason where the panels withhold a figure, and ends with
"Answered from this page's data without the AI." and a button **Ask the AI for a deeper answer**, which sends the same
question to the Worker with the page's findings.

## Intents and where each answer comes from

| Intent | Example questions | Data source on the page |
|---|---|---|
| Figure lookup: home value, rent, income, population (selected neighborhood) | "What is the median rent here?" | the county data file's block-group record (`m.hv`, `m.rent`, `m.inc`, `m.pop`), with the panel's tract-median note (`acsNote`) and home-value source text (`hvSourceText`) |
| Figure lookup: HUD Fair Market Rent by bedroom (county, or the open lot's ZIP) | "What is the 2-bedroom fair market rent?" | `getHudFmr` (app/data/hud_fair_market_rents.json, verified records only), link = the record's HUD API URL |
| Figure lookup: crashes (selected neighborhood) | "How many crashes here?" | `crashTextFor` (app/data/crash_counts/&lt;fips&gt;.json), else the older count the panel shows (`m.ksi`); hands off while the file is loading |
| Figure lookup: tree canopy (selected neighborhood) | "What is the tree canopy here?" | `canopyHeatFacts` (Tree Equity Score figures on the record) |
| Figure lookup: flood zone of the open lot | "Is this lot in a flood zone?" | the lot's FEMA NFHL result (`activeHouse.st.R.fema`); unmapped = "no flood map", not "no risk" |
| Figure lookup: zoning of the open lot | "What is the zoning of this lot?" | as the house panel's Zoning row: LA's parcel zoning layer (`zoneAt`), else the parcel record's zone code |
| Where to look | "Where should I invest?", "Which neighborhoods should I look at?" | the decision brief's `topNeighborhoods` (first 5) and the Invest view's back-test honesty line (`honest()` in app/invest.js) |
| What to build | "What should I build here?" | the brief's `neighborhood.build`, `housingPlays` and `withheld` for the selected neighborhood |
| ADU / lot split / N units on the open lot | "Can I add an ADU?", "Can I split this lot?", "Can I build 4 units?" | the brief's `parcel.expansions[].legal` and `parcel.zoning` (the statute engine, `evaluateByRightHousing`, with app/data/statutes.json). "N units" is answered only when no state law applied (then "not determined" with the reasons); when a law applies it hands off |
| Sites to redevelop | "What properties could be redeveloped?" | app/data/underused_sites.json rows for the county, largest first; model fields listed as unverified are not given |
| Transit | "Should transit be built here?", "What kind of transit does this area support?" | the brief's `transit` (evaluateTransit on the selected block group) and `TRANSIT_THRESHOLDS` (TCRP Report 165 Exhibit 3-8, FTA CIG) |
| Budget | "I have $50,000", "My budget is $300k", "What can I do with $1.5 million?" | the brief's housing plays then improvements for the selected neighborhood (the Build card's order); lists those whose cost on file is at or under the budget, counts those over it and names those with no cost on file. No other financial maths |
| Arithmetic on a named figure | "rent x 12", "What is the annual rent?", "2-bedroom FMR x 12", "What is the sale price per square foot?" | the figure above, with the sum shown; price per square foot = the lot's last recorded sale price (or assessed value, if asked) / its living area on the parcel record |

`cpInvest.advisorInputs()` (app/invest.js) gives the layer the same engine inputs, open-lot facts, measured sites and
honesty line the Invest cards use; the layer builds the brief for the map's selected neighborhood with
`InvestmentDecisionEngine.buildDecisionBrief`.

## What always goes to the model

A question is handed off when it: asks why; compares; asks "should I/we" (other than "where should I invest" and
"what should I build here"); has a time horizon or asks about the future; asks about a strategy, return, risk, taxes,
financing or what is "best"; names a law, permit, parking or another rule the page does not test; names an address,
a ZIP, a state, or a capitalised place; covers several places; quotes or refers to a document; is over 220
characters or holds more than one question; names more than one amount of money; or matches none of the intents.
A matched question also goes to the model when its data is still loading.

## Worker side

`sanitizeAdvisorContext` (src/ai/advisorGroundingContract.ts) keeps `scripted_findings` as `{ intent,
answered_on_page, findings[] }` only, at most 12 findings and 4,000 characters (`SCRIPTED_FINDINGS_MAX_CHARS`), and
the system prompt tells the model these are page data to use as given, not to re-derive.

## Measuring it

`npm run eval:advisor -- --scripted` runs offline (no key, no network): 58 cases in
`tests/eval/advisor_scripted_cases.json` (37 that must be answered, 21 near misses that must hand off) against
snapshots built from the repository's data files by `scripts/lib/advisor_snapshot.mjs`, and it reports how many of
the model eval's questions (`tests/eval/advisor_questions.json`) the layer would answer itself. The unit test
`tests/unit/advisorScripts.test.ts` runs the same eval and fails on any wrong scripted answer.
