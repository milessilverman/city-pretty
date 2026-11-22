# Project cards: courses of action, what they cost, what they bring in

Code: `src/engines/projectCardEngine.js` (pure; tests `tests/unit/projectCardEngine.test.ts`), shown by the
"Courses of action" section of the Invest view (`app/invest.js`, browser tests `tests/e2e/projectCards.spec.ts`),
printed by `node scripts/brief.mjs <fips> [--budget N]`, used by the scripted advisor's "I have $X" answer
(`app/advisor-scripts.js`). Live check: `LIVE_PORT=... node scripts/live_check_project_cards.mjs <outDir>`.

## What a card is

A card is one **subject** and the **courses of action** the data on file can support for it.

| Subject | Where it comes from |
|---|---|
| Open lot | the lot open on the map (parcel record, zoning at the point, the panel's back-tested value) |
| Site | a redevelopment site record (`app/data/underused_sites.json`; the six largest are shown, "Show all" lists the rest) |
| Selected area | the block group selected in the Where card |
| Stop city | the block groups within 1 mile of a planned-rail stop city point in the county (`intercity_transit_corridors.json`, `corridorStopAreas.js`); only stops whose record states how the point was placed, one card per stop city |

The menu is fixed: Hold and rent the spaces; Add a backyard home (ADU); Split or add units under state law; Small
multifamily; Station-area apartments (conventional); Station-area apartments (prefabricated). The last four also appear
"with an affordable share".

**A course appears only when its legal basis is determined**: by the statute engine (`evaluateByRightHousing` over
`app/data/statutes.json`, the same one the house panel uses) or by the zoning on file (a lot the zoning map classes as
multifamily). Holding a property needs no approval. Otherwise the course is listed under **Could not be assessed**
with the exact missing fact (for example SB 9: "Not determined: the list of sites this law excludes has not been
confirmed against the statute text"). A neighborhood or stop city has no single lot, so only Hold is assessed there.

Every figure is `{ value, unit, source, basis }`, basis **measured** (read from a cited table), **modelled** (computed
from measured inputs) or **assumed**. Every result is a range `{ low, high }`; a point is allowed only when the source is
exact, and then the card says why (a statutory limit, a median of recorded sales, a recorded sale price).

## Formulas

| Part | Formula | Inputs |
|---|---|---|
| Size, ADU | 1 home (the course itself); floor area not sized: the ADU law record sets no floor-area limit | `ca_adu_66323` |
| Size, units under state law | up to `max_units_by_right` of the law the statute engine applied | statute record |
| Size, multifamily by statute | at least `floor(acres x min_allowed_density_du_per_acre)` homes; at most `floor(max_far x acres x 43,560)` sq ft | statute record, measured site area |
| Size, multifamily by zoning | not sized: no density limit for the zone in `zoning_standards.json` | |
| Cost, ADU (City of Los Angeles only) | `[p25, p75] declared $/sq ft x median permitted floor area`, latest complete permit year | `building_costs.json` LA rows (`display_allowed: true`) |
| Cost, ADU elsewhere | "cost not on file for this place"; the DoD state area cost factor is listed as context only | |
| Cost, multifamily course (since 22 Nov 2026) | only where the homes are sized: `homes x [lowest, highest] county declared permit value per new home in 5+ unit buildings, 2023-2025`, tagged modelled, "structure only"; otherwise "cost not computed: ... not sized" (or not on file) | `building_costs.json` rows `source_key: census_bps_county` |
| Cost, Hold: lot | recorded sale (exact), or back-tested estimate x (1 +/- the tested 80% error of its price band) | page valuation; `county_valuation_models.json` or `valuation_backtest_benchmarks.json` (gate passed) |
| Cost, Hold: area / stop city | median recorded sale of each block group with 5+ sales (passed counties), else Census ACS median value, lowest to highest block group; Census top- and bottom-coded medians are left out and counted | model stats; county bundle |
| Income, market | HUD Fair Market Rent, studio to 2 bedrooms (ADU) or studio to 3 (others) per home per month; ADU also x 12 a year. Bedroom band tagged assumed | `hud_fair_market_rents.json` |
| Income, affordable share | rent ceiling = income limit x 0.30 / 12, at the 50% limit (households of 1 to 4) and the 80% limit; since 22 Nov 2026 also at the 60% tax-credit (MTSP) limit for a studio (1 person) to a 2-bedroom (3 persons), where the county's MTSP limits are on file | `hud_income_limits.json`, `hud_mtsp_income_limits.json`, statute rows `max_rent_share`, `imputed_household_size` |
| Place rows (site and lot cards, since 22 Nov 2026) | shown whatever is built: (1) HUD 2026 and 2027 QCT (by the 2020 tract of the site's point) and metro Small DDA (by its 2020 ZCTA) or nonmetro DDA (by county), and whether the 130% basis of 26 U.S.C. 42(d)(5)(B) applies, quoted; (2) the county's declared permit value per new home in 5+ unit buildings, lowest to highest of 2023-2025; (3) tax-credit rent ceilings at 60% and 50%, studio to 2-bedroom, `MTSP limit(persons) x 0.30 / 12`, persons from 42(g)(2)(C); (4) HUD FMRs studio to 3-bedroom. The county is the one the site's point lies in | `hud_qct_dda.json`, `station_site_places/`, `building_costs.json`, `hud_mtsp_income_limits.json`, `hud_fair_market_rents.json` |
| Affordable homes | `ceil(homes x 0.20)` at the 50% limit (the statute's 20-50 test), only where homes are sized | `min_set_aside` |
| Public money | LIHTC, HOME, FHA multifamily insurance, Florida Live Local exemption: "could apply; not computed because ..." unless every condition is known. HOME shows its federal per-unit cap as a range | `housing_funding_rules.json`, `statutes.json` |
| Value, Hold | today's value, as the cost | |
| Value, new building | none: needs a sourced capitalisation rate or a valuation model tested on that kind of building here; none is on file. No cap rate is typed | |
| Transit | if a planned-rail stop city point is within 1 mile: the verified `transit_value_effects.json` rows for the corridor's mode (commuter/regional -> commuter rail; other intercity and high-speed -> the pooled all-rail rows, said so), residential rows where they exist; average and lowest-to-highest published estimate; the study named; "the station site is not chosen" | |
| Missing, risks | generated from every null and from the source rows' own caveats | |
| Budget fit | `fitToBudget(cards, $)`: within = top of the cost range at or under the budget; straddle = range spans it; over; count of courses with no cost and not assessed. Order: measured cost before modelled, verified legal basis before partly verified, then the menu. Never by a return figure | |

## Data sources and whether they may be shown

| Data | Shown on the page | Note |
|---|---|---|
| ICC Building Valuation Data (Feb 2026) | **No** (`display_allowed: false`) | kept only in `data/internal/building_costs_internal.json`, a folder the page never requests and the site build never copies (since 22 Nov 2026 the rows are no longer in `app/data/` at all). Used only in the card's `internal_only` branch (ICC x DoD factor range x floor area), which is computed only in Node when a script or test passes the internal rows in (`ctx.internalBuildingCosts`; `node scripts/brief.mjs <fips> --internal` prints it to the terminal under the banner "internal estimate: not for display"). The browser passes no internal rows, so the branch is empty there; it is never rendered and `cardsForAdvisor` drops it. Guard tests: `tests/unit/noInternalRows.test.ts` (nothing under `app/` or `dist-site/` carries a `display_allowed: false` row or five ICC cells), and the Invest e2e check that no request URL contains `internal`. `scripts/build_site_dist.mjs` fails the build if such a row is ever found in a published data file |
| DoD area cost factors | Yes | context only; the publisher says not to apply them to commercial cost data |
| Los Angeles ADU permit medians | Yes | declared permit valuations, City of Los Angeles only |
| Terner Center modular figures, Florida and Pennsylvania cost rows, LIHTC equity price | No | terms not checked |
| HUD FMRs, income limits, FHA limits, HOME caps, LIHTC statute and IRS rates | Yes | federal |
| HUD 2026/2027 QCT and DDA lists, HUD MTSP income limits | Yes | federal (HUD User downloads and API) |
| Census Building Permits Survey county files (5+ unit valuation per home) | Yes | federal statistical release; declared value of the structure, not a development cost |
| County valuation models and the LA back-test | Yes | with their tested error |
| Transit value studies | Yes | meta-analysis ranges, not confidence intervals |

## Worked example (real numbers, 22 Nov 2026)

A single-family lot in zone R1-1 in the City of Los Angeles (live check: a real R1-1 lot in ZIP 91352, opened through the page's
own click path):

- Legal: CA ADU law (Gov. Code 66323) applied by the statute engine; a screen, not a permit.
- Cost: new-construction ADU permits, Los Angeles, 2025 (the latest complete year; 1,375 permits): middle half
  $106.09 to $167.11 per sq ft; median permitted size 800 sq ft. $106.09 x 800 = **$84,872** to $167.11 x 800 =
  **$133,688** (modelled; "declared permit valuations", which usually leave out land, fees, hookups and some site work).
- Income: HUD FMR FY2027, Los Angeles-Long Beach-Glendale: studio $2,151, 1 bedroom $2,402, 2 bedrooms $2,964, so
  **$2,151 to $2,964** a month, **$25,812 to $35,568** a year (payment standards, not market rents; no vacancy or upkeep
  taken off).
- Value: none: the LA model (median error 10.4% on 50,323 test sales) was tested on whole homes, not on lots with a new
  ADU, and no capitalisation rate is on file.
- Hold the lot: back-tested estimate $650,000, price band $500k-$1M where 80% of test sales were within 17.53%:
  **$536,055 to $763,945**.
- Could not be assessed: SB 9 (exclusion list not confirmed against the statute text); small multifamily (R1-1 is not
  multifamily; SB 79 needs the distance to heavy or light rail); station-area courses (nearest rail station on file 1.05
  miles away, no planned stop city within 1 mile).
- With $150,000 the ADU course fits (top of its range $133,688); with $50,000 nothing fits.

Affordable rent ceilings, for comparison: Miami-Dade 50% limit $47,700 (1 person) to $68,100 (4 people) gives
$1,192.50 to $1,702.50 a month; Travis $1,176.25 to $1,680.00. **Los Angeles County's row was missing until 22 Nov 2026**
(the fetch script read only `counties/manifest.json`, which does not list Los Angeles or Orange County; both rows were added that day from HUD's API: Los Angeles County FY2026 median income $108,100, 50% limit for 4 people $83,300). Cards for Los Angeles built before that said "not on file".

## Data that would turn "not on file" into numbers (most cards first)

1. **Parcel zoning with the facts each state law's exclusions need**, and confirmed exclusion lists (SB 9, SB 79, Florida
   Live Local, Austin HOME), plus the mode of each site's nearest station. Blocks every building course on every
   neighborhood and stop-city card and most site cards. Research prompt 12 (zoning and land data); the exclusion lists
   are statute reading in this repository.
2. **A displayable construction cost per sq ft or per home by city and building type** (ADU outside the City of LA,
   small and station-area multifamily, prefabricated). Blocks the cost, and so the budget fit, of every building course
   outside LA ADUs. Research prompt 1; paid: RSMeans "from $408 / $1,049 / $5,973 per year" (docs/GAME-PLAN.md, price
   checked 16 Nov 2026), or written permission from ICC to show its table (price not recorded).
3. **Space rental rates** (parking, storage, roof). Blocks income on every Hold course. Research prompt 9.
4. **A sourced capitalisation rate, or a valuation model tested on new ADUs and apartments**, per county. Blocks every
   finished value. No research prompt covers cap rates yet; paid comparables (CoStar) have no published price
   (docs/GAME-PLAN.md).
5. **Each county's FHA base city**, and the LIHTC credit itself (eligible basis, state award). The 2026/2027 QCT/DDA lists and
   the 60% (MTSP) limits were added for the station-site counties on 22 Nov 2026 (`docs/audit/site-cards-2026-11-22.md`).
   Research prompt 6.
6. **Market rents for new homes** (FMRs are payment standards). Paid: RentCast "$74 / $199 / $449 per month" (docs/GAME-PLAN.md,
   checked 16 Nov 2026); research prompt 11 covers value effects, not rents.
