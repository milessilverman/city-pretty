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
| N2 | **Home-value back-tests outside California**: Cook County, King County, Philadelphia, Allegheny County, New York City, DC and Florida (statewide sales file). Withhold estimates in any county that hasn't passed a back-test | R3 (same valuation code) | Each county has real results; estimates show only where the model passed |
| ✓ N3 | **State housing laws for all 50 states** (done 16 Nov: 13 laws added; NH, CT, DC still to check; "none found" states need code-text searches) (ADUs, lot splits, middle housing, parking): primary-source text for each state that has such a law | R5 (same law file) | Every state either has verified records or is marked "no law found as of date" with the search recorded |
| ✓ N4 | **Rebuild the county data files' internal rankings** (done 16 Nov in the page; SF pending) ("worse than X% of similar areas") from the rebuilt crash counts | R1, R2 | Safety rankings use the boundary rule |
| N5 | **Improvement catalog, round 4**: the next ten improvements after R4 | R4 | Same standard |

## What can't be made complete, and how it's handled

- **Sale prices**: most states don't publish them (Texas and about a dozen others are non-disclosure states). There,
  the page shows Census and HUD figures and says sales aren't public; no estimate is shown without a back-test.
- **Crash locations**: only some states publish geocoded crash data. Elsewhere crash-based items say "no crash data".
- **Zoning**: only where a city or county publishes it. Elsewhere by-right claims are withheld.
- **Sites that block automated access** from the build machine (several .gov hosts): listed as "couldn't check" until
  checked from a normal browser.
