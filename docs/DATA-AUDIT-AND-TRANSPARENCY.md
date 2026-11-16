# City Pretty: data audit and accuracy status

**Last updated:** 16 November 2026. This replaces the 15 November version, which was itself inaccurate (section 1).

**Short version: most of the data that was labeled "verified" was not. As of this audit, nothing in City Pretty
should be used to make an investment, legal or zoning decision unless the record says `verified` and you have
opened its source.**

Evidence for every finding below is in [`docs/audit/`](audit/): one report per area, each with a machine-readable
`.json` listing every record, what was checked, and what was found.

---

## 1. What went wrong, including in the last "fix"

An earlier audit found that 80% of the content and sources were hallucinated. The session that responded to it
(commits `a41d513` through `6cb4eec`, 15 Nov 2026) published a transparency statement saying the problem was fixed.
**It was not fixed, and that session added more fabricated data while saying so:**

| What the 15 Nov statement claimed | What was true |
|---|---|
| HUD Fair Market Rents "VERIFIED 100% (10 metros)", later 46 metros, "official FY2026" | Hand-typed from memory. Only **1 of 46** 2-bedroom rents matched HUD; others were off by up to 13.5%, and it used metro names HUD retired in 2023 |
| Valuation model "BACK-TESTED" against county recorder sales (LA, King, Cook, Harris, Hillsborough) | The "sales" were invented. 5 of 6 LA parcel numbers don't exist; King County IDs were sequential round numbers; Cook County PINs had the wrong number of digits |
| Underused land "VERIFIED 100% (90 sites)", then 9 more nationwide | The 9 nationwide sites were hand-typed with invented land values, home counts and profits; rail distances were wrong by kilometres. The 90 LA sites are real parcels, but their profit and home-count figures are unvalidated model outputs |
| Research library "VERIFIED 100% (52/52)" | Only **7 of 52** hold up. 13 studies don't exist; about 13 DOIs pointed to unrelated papers (gravel excavation, synthetic estrogens, power-line radiation) |
| State housing laws "VERIFIED 100%" | Wrong bills cited (TX SB 840 cited a 2023 hospital-assault bill; Utah SB 174 is a driver's-license bill), a bill that never passed (TX SB 1412), Arizona statute numbers that don't exist, and about six errors in CA SB 79 |
| State finance profiles "VERIFIED 100% (52/52)" | 1 verified; 42 not checked at all |
| County data tiers computed "from actual data presence" | Not true: 683 counties rated B and 23 rated A, claiming assessor rolls, live zoning and crime feeds that the counties' own data files say were never loaded |
| StreetForge, EverySpace, renovation engines "wired into UI" | They never ran in the app. Their numbers were invented, and they cited a tax credit that expired 30 June 2026 and an Arizona statute that doesn't exist |
| Every row had `last_verified: 2026-11-15` | Stamped by script on records nobody had checked |

The worst part was not any single error. It was reporting the work as verified when it hadn't been checked. That is
what this audit and the rules in section 4 are meant to stop.

## 2. Current status of every dataset

`verified` = a source was fetched in this audit and shows the specific value.
`partially_verified` = the source exists, but some fields couldn't be confirmed (they're listed per record in
`verification.unverified_fields`).
`could_not_check` = the source couldn't be reached from the audit machine (many .gov sites block automated access);
the record is **not** confirmed.
`unverified` = not checked.

| Dataset | Records | verified | partially | could not check | unverified | Removed | Report |
|---|---|---|---|---|---|---|---|
| HUD Fair Market Rents (`hud_fair_market_rents.json`) | 3,222 counties | 3,222 (machine pull from HUD) | | | | 46 hand-typed rows replaced | `scripts/fetch_hud_fmr.py` |
| Research studies (`research.json`) | 39 | 7 | 19 | 13 | | 13 nonexistent studies; all "$ per $1" figures | `audit/research-audit.md` |
| Case studies (`case_studies.json`) | 8 | | | 8 | | all money figures nulled | `audit/research-audit.md` |
| State housing laws (`statutes.json`) | 21 | 13 | 4 | 2 | | 1 (a bill that never passed); 18 corrected | `audit/laws-finance-audit.md` |
| State finance profiles (`state_finance_profiles.json`) | 52 | 0 complete | 29 (33 fields in 21 states quote-checked) | 1 | 22 | 4 unsourced fields removed; errors corrected in UT, OH, MD, NV, SC, IA, MN (round 2) | `audit/laws-finance-audit.md` |
| Funding programs (`funding_programs.json`) | 11 | 2 | 4 | 5 | | 5 corrected | `audit/laws-finance-audit.md` |
| Construction unit costs (`unit_costs.json`) | 32 | 8 | 12 | 8 | 4 (no source) | 3 wrong bid prices corrected | `audit/costs-transit-audit.md` |
| Transit projects (`transit_pipelines.json`) | 5 | | 5 | | | invented housing/EV details nulled | `audit/costs-transit-audit.md` |
| Intercity rail corridors (`intercity_transit_corridors.json`) | 4 | | 2 | 2 | | fabricated railyard recommendations; unsourced costs/times nulled | `audit/costs-transit-audit.md` |
| Underused land (`underused_sites.json`) | 90 | | 90 (assessor fields real; model outputs not) | | | 9 hand-typed sites | `audit/engines-sites-audit.md` |
| Valuation back-test (`valuation_backtest_benchmarks.json`) | LA County: 50,720 recent transfers | 1 run (LA) | | | other counties: none | all fabricated rows | `scripts/backtest_la_valuation.mjs`, section 2a |
| County data tiers (`county_completeness.json`) | 706 | 639 computed from data files + service pings | | | 67 (no data file) | hand-assigned tiers | `scripts/build_county_completeness.py` |
| California county registry (`ca_counties_registry.json`) | 58 | | | | 58 | false Census TIGER stamps | this document |

### 2a. Home-value estimate: first real back-test (Los Angeles County, 16 Nov 2026)

LA County's public parcel layer has no sale prices, so the test uses a legal proxy: under Cal. Rev. & Tax. Code §110.1
and §110(b), a purchase resets a home's Prop 13 base-year value to the purchase price. Single-family homes whose land
and building base years are both 2025 or 2026 (53,958 pulled; 50,720 after filtering out new construction, multi-unit
and odd values) were valued by the page's own code with their roll values hidden, as for a home that has not sold.

| | Median error | Within 10% | Within 20% | Median bias |
|---|---|---|---|---|
| The page's estimate (47,172 valued) | **18.8%** | 25% | 53% | −13% (under-estimates) |
| The neighborhood's typical value alone | **15.0%** | 35% | 62% | −6% |

**The model is worse than using the neighborhood value alone, so in LA the page now withholds it**, shows the test's
numbers, and points to the closest sourced figure (a recent recorded sale or a recent base-year value). Other counties
have no back-test and keep the "unvalidated" label. Error is largest at $2M and up (31%). Caveats: base-year resets are
a proxy (some are non-sale reassessments); 2025 values include up to a 2% inflation factor; the page's $2M guard
(written for the Census ACS top-code) withholds most $2M+ homes in LA. Full results, by price band, base year and city:
`app/data/valuation_backtest_benchmarks.json`; every record tested: `data/backtests/la_sample_2026-11-16.json.gz`.

**Round 2 (later on 16 Nov): traceable neighborhood values and a model that passed.**

*Neighborhood values.* The old LA block-group values ("median of N recorded home sales") could not be traced. They
were rebuilt from the Assessor's public parcel layer: 150,596 single-family homes whose Prop 13 base year was reset in
2022–2026, grouped by 2020 block group (tract fallback below 5 homes). Script `scripts/build_la_neighborhood_values.mjs`,
output `app/data/la_neighborhood_values.json`, raw pulls with every query in `data/backtests/`. Compared with the old
values (`docs/audit/la-neighborhood-values-comparison.json`): 6,029 block groups have both; the new values are a
median 5.4% higher, half agree within 8.6%, 55% within 10%, 75% within 20%, and 588 (10%) differ by more than 50%.
530 block groups that had an old value have no traceable one (too few single-family transfers) and now show none.

*Model.* Protocol, fixed before the test: candidates developed only on 2022–24 resets (chosen on 2024 using
statistics from 2022–23; model locked in commit 290ce39), then tested **once** on the 50,723 homes with 2025–26 resets,
using neighborhood statistics from 2022–24 only. No test home is in the training data or in its own statistics.

| Candidate (test: 2025–26 resets) | Median error | Within 10% | Within 20% | Median bias |
|---|---|---|---|---|
| Regression on log value (neighborhood $/sq ft and median, size, lot, age, beds, baths, quality class) | **10.4%** | 48% | 76% | −1.8% |
| Neighborhood median (rebuilt, traceable) | 12.7% | 41% | 68% | −1.7% |
| Neighborhood $/sq ft × living area | 16.3% | 32% | 59% | −2.0% |
| Old bundle typical value (untraceable) | 15.0% | 35% | 62% | −5.7% |
| The page's earlier generic estimate (first test) | 18.8% | 25% | 53% | −13% |

The regression passes the rule (median error ≤ 15% and better than the neighborhood median), so **LA now shows its
estimate with the tested error**, and says so when the home is in a price band where the test error was larger (under
$500k: 17.7%; $2M and up: 17.2%). Homes with a 2025–26 recorded sale or Prop 13 base year show that figure instead.
Homes missing an input the model needs (living area, lot, quality class, beds, baths, year built) get no estimate.
Caveats: base-year resets remain a proxy for sales; only single-family homes were tested; the page uses statistics
from 2022–26, one year fresher than the tested configuration. Not fixed yet: the LA improvement estimates in the county
data file were computed from the old typical values and have not been recomputed.

### The improvement catalog (what the map recommends)

Audited 16 Nov (`audit/bundle-catalog-audit.md`). The catalog of 81 improvements inside the county data files drives
the "best bet", the top-3 cards, the totals and the map colors. Findings:

- **1 of 81 is fully sourced** (traffic calming: effect from Polloni's study, cost from an LADOT report in the repo).
  30 are partly sourced (effect or cost, not both). **50 have no checkable source.**
- **Street trees, the only "grade A" item, can't be reproduced.** It cites "City Pretty local hedonic, 3,386 Westside
  sales", but no regression code or sales data exists in the repo or its history. It was labeled a "local sales
  estimate" in 637 counties where it was never measured, and was the best project in 98.7% of block groups where it
  applied.
- **The default map was driven by an assumption:** a grade-D farmers-market effect (+0.25%, sources not checkable)
  was the best project in 60% of non-LA block groups.
- About half of all modeled value ($513B of ~$1.03T) came from items whose source note says "one AI research pass".
- Misapplied or missing sources: the affordable-housing effect (Diamond & McQuade) holds for neighborhoods with very
  low incomes but was applied up to $93k; the ADU and EV-hub studies could not be found; the school-bond figure used
  differs from the one cited.
- `research/effects.csv`: of 31 rows marked confirmed, 22 quotes were re-found word for word, 9 sources were
  unreachable, none contradicted. The engine didn't use this file.

**Round 2 (later on 16 Nov, `audit/catalog-coverage-round2.md`):** bus rapid transit upgraded to verified (effect:
Beaudoin & Tyndall's Vancouver, WA study, "a 5-7% price premium"; cost: LA Metro's $428,988,535 budget for the
19-mile North Hollywood–Pasadena line), with a caution that other studies find no effect. **Sound walls downgraded
to unverified: the engine used about 40% of the cost in Metro's own document ($10M per mile), so every sound-wall
return shown had been overstated about 2.5x.** Now 2 verified, 28 partly verified, 51 unverified.

**Homeowner upgrade table (46 rows):** every row is a self-graded estimate with no checkable source; costs, values and
returns are now withheld, rows are listed by name. Unchecked ADU claims shown for every house ("Exempt (0 spaces)",
"Ministerial (60 Days)") were removed.

**Closed later on 16 Nov (see 2a, round 2): LA neighborhood home values were rebuilt from Assessor records.** Original note: 4,348 LA block groups say their typical value is the "median of N
recorded home sales (County Assessor)", and 1,127 more cite tract-level sales. LA County publishes no sale prices in
its public parcel layer and the code that built these values is not in the repo, so they can't be traced. They are
the base of every LA dollar figure (and the baseline in the LA back-test). They are now labeled unverified;
re-basing them on Census ACS is the next fix.

**Fix:** a verification gate in the app (`app/data/intervention_verification.json`): unsourced items show no dollar
figures, can't be the best bet and don't count in totals; partly sourced items are labeled; neighborhood "profit" is
withheld (it was modeled home-value gain, not profit). See `audit/bundle-catalog-fixes.md`.

### Not yet audited (treat as unverified)

- `details-la.json` (LA's per-block-group recommendation rows), `overlays-la.json`, `la-crash-counts.json`.
- Most cost documents behind the catalog (LA agency sites block automated access).
- The rest of each county file (Census, OSM, GTFS layers) was built by the pipeline from the public sources listed in
  the file; it was not re-checked value by value.

### App code

97 hardcoded numbers or claims were found in `app/app.js` (`audit/appjs-constants-audit.md`), 63 with no source. The
invented dollar outputs were removed and the by-right rules now come from `statutes.json` (`audit/appjs-fixes.md`).

## 3. What was built to keep it accurate

- **Machine pulls instead of typing:** `scripts/fetch_hud_fmr.py` (HUD rents for every county) and
  `scripts/build_county_completeness.py` (tiers from each county's own data file plus a ping of every live service).
- **Live sourced lookups:** `workers/sources.ts` returns Census, HUD, USGS, FEMA, ACS and OpenStreetMap facts with
  the exact URL queried, or `null` with the reason. The AI advisor (`workers/advisorAgent.ts`) may only state facts
  from page data or these tools.
- **Provenance tests** (`tests/unit/provenance.test.ts`): every record in every sourced file must carry a verification
  status; a `verified` record must state its method and evidence; removed fabrications must stay removed. CI runs it
  on every push.
- **Generators deleted:** the scripts that wrote hand-typed data into these files
  (`build_verified_data.*`, `expand_*_nationwide.mjs`, `add_nationwide_housing_laws.mjs`, `build_underused_sites.mjs`,
  `run_valuation_backtests.mjs`, the old county-tier scripts) are gone, so re-running them can't undo this audit.
  The audited JSON files are now the source of truth.

## 4. Rules

1. **No invented numbers.** A value comes from a fetched source or is `null` and shows "not on file". An assumption
   used in a calculation is labeled as an assumption, with its basis.
2. **Every record says how it was checked**: `verification.status`, `method`, `checked_on`, `evidence`,
   `unverified_fields`.
3. **"Verified" means fetched and confirmed**, not "has a URL". A URL that 403s is `could_not_check`.
4. **Pull, don't type.** If a source has an API or file, write a script that pulls it.
5. **Report mistakes immediately**, in this document and in the session summary, including mistakes found in an AI's
   own earlier work, before moving on.
6. Screening output is not an appraisal or a legal zoning determination.

## 5. Known open items

- 8 unit costs and 2 rail corridors couldn't be reached from the audit machine (TxDOT, ADOT, FRA block it). Re-check
  from a normal browser.
- 42 state finance profiles were never checked; their numbers feed the tax-increment calculator.
- The HUD service's item page says FY2026, but its layer description still says FY2024. Confirm against
  huduser.gov, which blocked our automated download.
- **Correction (later on 16 Nov):** this list said 7 of 150 live parcel/zoning services were dead. That was wrong:
  all 7 answered when re-checked; county servers drop requests under load. Tiers now count configured services, and
  each county lists services that failed three retries at build time (`live_services.not_responding`; 6 on the last
  build, including New York State's parcel service, which reported "not started").
- OpenStreetMap lookups through Overpass are untested against the live service (unreachable from the build machine).
