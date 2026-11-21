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
| HUD Fair Market Rents (`hud_fair_market_rents.json`) | 3,222 counties | 3,222 (FY2027, HUD's FMR API) | | | | 46 hand-typed rows (15 Nov); then FY2026 map-service values (superseded) | `scripts/fetch_hud_fmr_api.py` |
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
| HUD Fair Market Rents (`hud_fair_market_rents.json`) | 3,222 counties | 3,222 (FY2027, HUD's FMR API) | | | | 46 hand-typed rows replaced; superseded map-service pull replaced with HUD User API (FY2027) | `scripts/fetch_hud_fmr_api.py` |
| Research studies (`research.json`) | 39 | 8 | 21 | 3 | 7 (source link broken) | 13 nonexistent studies; all "$ per $1" figures; HealthLine figures corrected (round 3) | `audit/research-audit.md` |
| Case studies (`case_studies.json`) | 8 | | 5 | 1 | 2 (source link broken) | all unsourced money figures nulled; HealthLine and Cultural Trail figures re-sourced (round 3) | `audit/research-audit.md` |
| State housing laws (`statutes.json`) | 21 | 15 | 4 | 1 | 1 (Minneapolis 2040: cited law not confirmed) | 1 (a bill that never passed); 18 corrected | `audit/laws-finance-audit.md` |
| State finance profiles (`state_finance_profiles.json`) | 52 | 11 (AK, AL, AZ, CA, DC, KY, LA, NM, TX, WA, WY) | 36 | 2 (NH, PR) | 3 (IN, NY, PA: checked, nothing confirmed) | round 3: TX homestead $100,000 -> $140,000, TX reappraisal 1 -> 3 years, CO homestead 'none' -> unknown; round 4 (21 Nov): 28 values corrected or set to unknown in 21 states | `audit/laws-finance-audit.md`, `audit/state-finance-profiles-2026-11-21.md` |
| Funding programs (`funding_programs.json`) | 11 | 2 | 6 | 2 | 1 (source link broken) | round 3: CA Urban Greening funding source, cycle and portal corrected | `audit/laws-finance-audit.md` |
| Construction unit costs (`unit_costs.json`) | 32 | 9 | 12 | 7 | 4 (no source) | 3 wrong bid prices corrected; CDOT Walsenburg price confirmed at its new address (round 3) | `audit/costs-transit-audit.md` |
| Transit projects (`transit_pipelines.json`) | 5 | | 5 | | | invented housing/EV details nulled | `audit/costs-transit-audit.md` |
| Intercity rail corridors (`intercity_transit_corridors.json`) | 4 | | 2 | 1 | 1 (source link broken) | fabricated railyard recommendations; unsourced costs/times nulled | `audit/costs-transit-audit.md` |
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

**Outside California (16 Nov): no estimate without a back-test, and three counties tested on recorded sales.**

*Policy.* In every county without a passing back-test the page shows **no** model estimate. It says no back-test
against recorded sales exists and names the closest sourced figure instead: a recent recorded sale, or the block
group's Census ACS median home value (owner-reported, with its vintage). The reason: in LA the same kind of generic
estimate did worse than the neighborhood value alone.

*Protocol* (same as LA; `scripts/county_valuation_models.mjs`): candidates are developed on older sales and compared on
a development window. The chosen model is locked in a commit, then scored **once** on the latest months; the script
refuses to run the final test twice. No scored home is in its own neighborhood statistics (its own earlier sales are
removed too). An assessor value is used for a scored sale only if it was set before the sale. Every sales file, result
and lock is committed; `tests/unit/countyValuation.test.ts` re-runs each final test and checks it matches.

| County | Sales (arm's-length screen) | Test window | Locked model | Test median error | Neighborhood median | Result |
|---|---|---|---|---|---|---|
| **District of Columbia** | 9,254 (OTR CAMA, `QUALIFIED = 'Q'`, one dwelling) | May–Oct 2026, 1,534 sales | regression | **10.7%** (76% within 20%, bias +0.8%) | 17.9% | **Pass: shown** |
| Philadelphia | 38,011 (OPA sale + transfer-tax `DEED` record, one property, no shared surname) | May–Jul 2026, 2,811 | regression + city's 2026 market value | 18.7% | 23.2% | Fail: withheld |
| Cook County, IL | 108,284 (Assessor's own sale screens; `char_use` Single-Family) | Apr–Aug 2026, 7,909 | regression | 18.6% (bias −11%) | 22.0% | Fail: withheld |
| **Queens (NYC)** | 25,903 (DOF sales, class 01/02, ≥ $25k, no same-block package sales; PLUTO 26v2, 1–2 units) | May–Sep 2026, 2,863 | regression on PLUTO inputs | **14.97%** (page shows "15.0%"; 63% within 20%, bias −7.0%) | 17.4% | **Pass: shown** |
| **Staten Island (NYC)** | 12,803 (same) | May–Sep 2026, 1,173 | regression on PLUTO inputs | **13.1%** (71% within 20%, bias −9.2%) | 16.8% | **Pass: shown** |
| Brooklyn (NYC) | 16,295 (same) | May–Sep 2026, 1,783 | regression on PLUTO inputs | 18.1% | 20.9% | Fail: withheld |
| Bronx (NYC) | 5,925 (same) | May–Sep 2026, 668 | regression on PLUTO inputs | 17.85% (page shows "17.9%") | 20.0% | Fail: withheld |
| Manhattan (NYC) | 671 (same) | May–Sep 2026, 56 | regression on PLUTO inputs | 22.4% | 34.0% | Fail (fewer than 200 test sales): withheld |
| **Hillsborough County, FL** | 29,052 (DOR 2026 SDF/NAL: `QUAL_CD` 01/02, not multi-parcel, use code 001, 1 unit) | Apr–Aug 2026, 7,637 | regression without rooms + 1 Jan 2026 just value | **9.7%** (78% within 20%, bias +0.4%) | 20.1% | **Pass: shown** |
| Allegheny County, PA | 17,360 (WPRDC: county code `SALECODE` 0 = VALID SALE, deed, single family) | May–Sep 2026, 2,232 | regression | 16.3% (bias −9.4%) | 21.7% | Fail: withheld |
| King County, WA | 50,191 (Assessor's codes: residential improved single-family, warranty deed, reason None, no sale warning) | May–Oct 2026, 7,261 | regression on neighborhood median + tax-year-2026 assessed value | **8.8%** (83% within 20%, bias 0.0%) | 17.2% | Pass, but withheld: page lacks the input |

Every candidate's test error (the locked one is the only one that decides; the others are recorded in each result file):
- Queens: $/sq ft × size 18.9%. Staten Island 18.5%. Brooklyn 22.1%. Bronx 22.0%. Manhattan 22.2%. NYC has no bedroom or bathroom counts in PLUTO or the DOF sales, so room-based models weren't offered.
- Hillsborough: assessor just value × sales ratio 10.1%; regression without the just value 12.1%; $/sq ft × size 12.8%.
- Allegheny: $/sq ft × size 17.1%. No assessor value used (appeals often reset values to a recent price).
- King: regression with rooms + assessed value 8.3% (the page can't supply rooms or size for King); no rooms + assessed value 8.5%; assessed value × sales ratio 8.8%; rooms regression without assessed value 10.7%; $/sq ft × size 13.4%.

Price bands (by sale price):
- Queens: $500k–$1M 12.2%, $1M–$2M 16.2%, under $500k **99.2%** (230 sales), $2M+ 35.1% (60).
- Staten Island: $500k–$1M 11.1%, $1M–$2M 19.1%, under $500k 38.8% (109).
- Hillsborough: under $500k 10.2%, $500k–$1M 8.2%, $1M–$2M 12.1%, $2M+ 13.4% (122).
- King: $500k–$1M 7.2%, $1M–$2M 10.0%, $2M+ 11.2%, under $500k 10.9%.

The page adds a note when the estimate's band had a larger error. Queens and Staten Island sales under $500k are badly
over-estimated, probably transfers below market that pass the $25,000 screen. Not fixed.

How the page gets the inputs:
- **NYC:** the page's parcel layer is MapPLUTO 26v2, the same release the test joined (`BldgArea`, `LotArea`, `YearBuilt`, `UnitsRes`).
- **Hillsborough:** the Florida statewide parcel layer holds the same 2026 roll (`ASMNT_YR` 2026). The page uses its just value only when `ASMNT_YR` is 2026, and only for DOR use code 001.
- **Parity:** browser tests check that the page computes exactly the tested model (to 1e-9) for Queens, Staten Island and Hillsborough.
- **King:** its passing model can't run. The page's King parcel service is the county zoning layer (PIN and zoning only). The WA statewide layer does carry the tax-year-2026 value (on 16 Nov, 410 of 413 sampled records matched it), but the page doesn't query that layer for King. That layer also has no roll-year field, so the page couldn't confirm it still holds the tested roll. The page says a model passed and names the missing input.
- **Allegheny:** its parcel layer has only the PIN and acreage. It failed anyway.

Code meanings, each from the source's own published list:
- **Florida:** `QUAL_CD` 01 and 02 mean "qualified as arm's length" (DOR 2026 NAL/SDF User's Guide, field 55). This replaces the earlier reading of rule 12D-8.011.
- **King:** the Assessor's `EXTR_LookUp` table. Since 2023 most sales are recorded as instrument 2 (Warranty Deed), not 3 (Statutory Warranty Deed), so both are accepted.
- **Allegheny:** `SALEDESC` "VALID SALE".

More caveats:
- **Florida's just value:** statutory valuation date is as of 1 January (s. 192.042, F.S.), predating 2026 test sales. However, county tax rolls are certified in autumn 2026 after TRIM notices and Value Adjustment Board hearings; any post-sale roll corrections or purchase-price-citing appeals could theoretically introduce post-January signal. Back-tests should monitor preliminary-to-final roll adjustments.
- **King's assessed value:** each value's own change date is used, and 67 test sales whose value changed after the sale are excluded from the assessor models.
- **Characteristics** (NYC, Florida, King, Allegheny) are the current records, not as of the sale.
- **Missing room counts (bug, not fixed):** the shared model code reads a missing bedroom or bathroom count as 0 (`null >= 0` is true in JavaScript). That affected the already-published DC (2 rows), Cook (8) and Philadelphia (81 beds, 1,280 baths) results. Those finals weren't re-run, because a second run would break the one-test rule. New pulls drop such rows.

DC's error by price band: $500k–$1M 9.1%, $1M–$2M 10.3%, under $500k 13.9%, $2M and up 14.2%. The DC page reads each
parcel's residential CAMA record by SSL for the model's inputs, the same fields the test used. A browser test checks
that the page computes exactly the tested model (to 1e-9 on 120 test sales). In Philadelphia the city's own market
value scaled to sale prices was off by 18.1%.

Caveats:
- DC's `QUALIFIED` flag isn't defined in the layer metadata.
- DC's and Cook's assessed values aren't used: their valuation date can't be shown to predate the sales.
- Recording lags shorten the test windows.

Not tested yet: other Florida counties (`scripts/backtests/pull_florida_dor.py` takes any county; only Hillsborough
was run), and every other county outside those listed.
Locks and results are separate commits (NYC 794aa77 / b942628; Hillsborough 3caa591 / 3dfa644; Allegheny
16c129d / f4c4276; King 986cfbf / 7a042e1).

Also fixed: parcel lookup used a 5-result box search, so on blocks of row houses the clicked parcel was often missed.
It now asks for the parcel containing the point first.

#### Florida (six more counties) and King County shown (16 Nov, later)

Same protocol (develop on 2025 and Jan–Mar 2026 sales, lock in a commit, one final test on Apr–Aug 2026; Florida DOR
2026 Final SDF/NAL with QUAL_CD 01/02, which DOR's 2026 User's Guide defines as qualified arm's-length transfers):

| County | Test sales | Locked model (regression + 1 Jan 2026 just value) | Neighborhood median | Result |
|---|---|---|---|---|
| Miami-Dade | 4,088 | 10.6% | 15.6% | Pass, shown (inputs read from the Florida statewide layer; the page's own Miami-Dade layer is a zoning layer) |
| Broward | 7,232 | 8.9% | 15.0% | Pass, shown |
| Duval | 5,311 | 10.0% | 19.1% | Pass, shown |
| Orange | 6,187 | 8.7% | 18.6% | Pass, shown |
| Palm Beach | 7,916 | 9.1% | 19.5% | Pass, shown |
| Pinellas | 4,956 | 11.2% | 21.7% | Pass, shown |

Where the assessor-ratio candidate tied the locked regression on development data (within 0.1 points), the spec the
page can run was locked; that rule was written into each lock before the final test. Errors are larger for homes of
$2M and up (15–18%); the page adds that band's error to the estimate.

**King County** is now shown. The page reads the tax-year-2026 appraised value from the Washington statewide parcel
layer by PIN (VALUE_LAND + VALUE_BLDG). That layer has no roll-year field, so `scripts/backtests/check_king_statewide_values.py`
compares it with the Assessor's tax-year-2026 values used in the test: 496 of 500 sampled parcels matched exactly
(99.2%) on 16 Nov. The page computes King estimates only while that check is at least 98% and at most 120 days old.

**Bug found and fixed:** on the live page, the parcel record dropped the service's own field names and the parcel
query asked for only its first 8 fields. So NYC (Queens, Staten Island) and Hillsborough estimates were withheld for
"missing inputs" despite passing; their parity tests had fed the model raw fields directly and didn't catch it. Raw
fields are now kept, every field the county's model needs is requested, and a browser test covers that path.

**Missing bedroom/bathroom counts** are now treated as missing (not 0) in new runs. DC, Cook and Philadelphia ran
before the fix; they keep the old reading only so their one-time results reproduce, and should be re-tested on a new
window. The page already treats missing rooms as missing for them (it withholds rather than assuming 0).

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

### Nationwide check of the county data files (16 Nov, `audit/bundles-nationwide-audit.md`)

Sampled 1,410 block groups in every state with data: the census fields (home value, rent, income, population, tenure
and others) match the Census Bureau's 2020–24 ACS files exactly, and Census "not available" codes are blank, never
numbers. Bus frequency matched in 60 of 60 block groups re-computed from current transit feeds; nearest school and
DC fast charger within 25 m in 116 and 111 of 120. Problems found and fixed:
- **4,178 California block groups** (outside LA and Orange) showed no home value or rent where the Census publishes a
  tract value; a pipeline caching bug skipped the fallback. The page now fills them from the Census tract files,
  labeled as tract values (`app/data/bundle_corrections.json`), and the pipeline bug is fixed for the next rebuild.
- **School distances stopped at the county line** (e.g. 9.3 km shown in Travis County where the nearest school, in the
  next county, is 5.7 km). Fixed in the pipeline; shipped files keep the old distances until rebuilt. Library and
  clinic distances likely share the bug (not checked).
- **Tree canopy** came from the 2021 Tree Equity release on 2010 block groups but was labeled "current". The page now
  uses American Forests' current release on 2020 block groups for the canopy gap in all 639 counties with data files
  (files dated 2025-07-01, or 2026-03 for TX, WA and a few others; `scripts/build_tree_equity_2025.py`). Of 159,935
  block groups in both, the gap moved a median 4.6 points and more than 5 points in 47% (in Travis County most 2021
  values were 0 against a current median of 12.2). The 2021 comparison with similar areas is withheld where the value
  changed. Heat still shows the 2021 figure, labeled as such: the current release's heat field is a different measure.
  No data license is stated on the reachable Tree Equity pages; reuse terms should be confirmed with American Forests.
Not checked: parks (OpenStreetMap's query service is unreachable from the audit machine).

### Crash counts (rebuilt 16 Nov: `app/data/crash_counts/<county>.json`)

California: all counties except San Francisco rebuilt from CCRS with the boundary rule below
(`scripts/build_crash_counts_ca.py`). The share of crashes with coordinates ranges from 51% (Sutter) to 100%, 74% in
LA. San Francisco's CCRS crashes are only 34% geocoded, so San Francisco is rebuilt from DataSF's injury-crash records instead
(95.6% placed; injury and fatal crashes only; pedestrian/cyclist count is a lower bound, one collision partner per crash). **Outside California: 94 counties** in Illinois (2023–25), Virginia (2023–25),
Pennsylvania (2021–23, the public table ends there), Tennessee (2022–24, injury and fatal crashes only), Utah, Maine
(2023–25) and Denver (2023–25), from each state's crash service (`scripts/build_state_crash_counts.py`,
`audit/crash-counts-nationwide.md`). 37–53% of crashes sit within 10 m of a block-group boundary. A map service
never returns crashes stored without a location, so those counts can't say how many are missing; the page says so.
Illinois records only the first thing struck, so its pedestrian/cyclist counts are a lower bound. Counties in the
other ~490 data files have no public geocoded crash source on file.

### LA crash counts (detail)

A re-count from CHP's crash database (CCRS) found most crashes are geocoded onto street centerlines, which are usually
block-group boundaries: in one block group 14 crashes were clearly inside and 46 within 10 m of its edge, half on each
side. The old file gave each boundary crash to one side by tie-break, so counts could swing by half. Rebuilt with a
stated rule (`scripts/build_la_crash_counts.py`): a crash counts for a block group if it is inside it or within 10 m
of its boundary. Also found: **only 74% of LA County crashes in CCRS (233,034 of 316,685, 2023–2025) have
coordinates**, so every placed count understates the true count; the page says so. The neighborhood comparisons
inside the LA data file ("worse than X% of similar areas" on street safety) still use the old counts until the
bundle is rebuilt.

### Not yet audited (treat as unverified)

- `details-la.json` (LA's per-block-group recommendation rows; audited for money fields, round 2).
- `overlays-la.json` (map snapshot of historic, hillside, landslide, liquefaction, fault and fire-hazard zones): spot
  check 16 Nov found all 36 of LA City's live Historic Preservation Overlay Zones present by name. The other layers
  were not re-checked. Per-house historic and monument checks query LA's live services, not this snapshot.
- Most cost documents behind the catalog (LA agency sites block automated access).
- The rest of each county file (Census, OSM, GTFS layers) was built by the pipeline from the public sources listed in
  the file; it was not re-checked value by value.

### App code

97 hardcoded numbers or claims were found in `app/app.js` (`audit/appjs-constants-audit.md`), 63 with no source. The
invented dollar outputs were removed and the by-right rules now come from `statutes.json` (`audit/appjs-fixes.md`).

### Source links (`scripts/check_sources.py`, monthly in CI)

First run, 16 Nov: of 172 distinct source URLs in `app/data`, 118 worked, 24 refuse automated requests (not evidence
they're gone), 13 timed out, and **17 return 404**: moved or removed documents, including the Michigan and Tennessee
assessment statutes, the Atlanta BeltLine and Waterloo Greenway evaluations, Chicago's transit TIF page and NYC DOT's
"Measuring the Street". They are being re-located or downgraded. The monthly run fails when a working link breaks.

### Round 3 (later on 16 Nov): links and could-not-check records

- `scripts/check_sources.py` found 17 cited URLs returning 404. After round 3: 10. Seven were replaced with the
  document's new address and re-checked (BeltLine, ITDP's HealthLine report, CDOT's cost data book, Michigan's MCL
  211.27a, Arizona's GPLET statute, the FRA grant statute, Tennessee's comptroller). The 10 still broken are marked
  "source link broken as of 2026-11-16" in each record, and records that rested only on that link are now
  `unverified`. The Internet Archive was blocked from the build machine, so archived copies weren't available.
- Re-checked records: ITDP's report shows the earlier HealthLine claims were wrong ($9.5B / 47.5:1 claimed; the
  report says $5.8B of TOD investment, $200M+ public funds of which $50M was transit). California's Urban Greening
  program is funded by Proposition 4, not Cap-and-Trade, and its next round is late 2027 or early 2028.
  Minneapolis 2040's "triplex by right" record is now unverified: the 2024 law it cites doesn't amend the statute named.

### HUD rents brought current (FY2027, 16 Nov)

The first replacement pulled HUD's map service, which turned out to hold **FY2026 as first published**: HUD revised
seven areas in April 2026 (Federal Register 2026-07741; LA 2-bedroom $2,903, service still $2,601) and FY2027 took
effect on 1 Oct 2026 (2026-17891). With a HUD User API token, all 3,222 counties now come from HUD's FMR API for
FY2027 (`scripts/fetch_hud_fmr_api.py`), after a check that the API's FY2026 LA value equals the Federal Register's
revised value. LA's 2-bedroom is $2,964; the median county changed +4.2% from FY2026. New England counties carry
their towns' values (HUD sets FMRs by town there) and no single county figure; one Missouri city piece HUD puts in
the St. Louis metro is attached to its county. The page, the live-records panel and the AI advisor all read this file.

### State housing laws, all 50 states and DC (16 Nov, `audit/state-laws-50.md`)

13 laws added from official statute or session-law text (WA ×3, OR ×2, MT ×2, MA, RI ×2, CA, AZ, TX), each with the
operative text quoted; the table now covers 15 states. Two quotes spot-checked against the live statute pages (RI
45-24-73, TX SB 15) match word for word. Not yet in effect: Hawaii SB 3202 (fallback starts after 31 Dec 2026).
Couldn't check: NH, CT, DC. **"None found" for 32 states is not proof of absence:** candidates came from secondary
pages, and the code text itself was searched only for IA, MN and VA. The zoning engine now refuses to treat a
jurisdiction-wide parking cap as a parcel right, matches commercial-land laws only to commercial parcels, and reports
conditions it can't check (e.g. inside an urban growth area) as "not on file".

Round 2 (later on 16 Nov): **Colorado's ADU law (HB 24-1152) had been applied to every single-family parcel in
Colorado**; it covers only municipalities of 1,000+ inside a metropolitan planning organization. Fixed and verified
from the signed act. Added Idaho §§ 67-6541 (ADUs) and 67-6542 (starter-home subdivisions), Nevada NRS 278.257,
California AB 2011 and Colorado's parking law near transit (HB 24-1304). Statute text was searched with no qualifying
law in IA, MI, MN, ND, OH, SC, WY; North Carolina's parking-minimum ban takes effect 1 Jan 2027. 23 states could not
be searched in round 2 (official code sites blocked or returned no text), plus NH, CT, DC and Maryland HB 538.

Round 3 (later on 16 Nov) found other official routes for 15 of those 27. **Added 6 laws:** Virginia's parking caps
near transit (§ 15.2-2209.4) and small-lot district duty (§ 15.2-2286.2), both 2026; DC's accessory apartment as a
matter of right (11-U DCMR § 253); Connecticut's ADU as of right (§ 8-2o), residential parking limits (§§ 8-2(d)(9),
8-3n) and middle housing on commercial lots from 1 July 2026 (§ 8-2s). Code text searched with nothing qualifying:
AK, DE, KS, KY, LA, MO, NE, OK, PA, SD, WV, and Maryland HB 538 (density bonuses only). Virginia's ADU law
(§ 15.2-2292.4) takes effect 1 July 2027. **Still blocked (12): AL, AR, GA, IL, IN, MS, NH, NJ, NM, NY, TN, WI.** For
those, "none found" is unverified. NY and IN need free API keys; IL, WI and NH don't answer the build machine; the
others need a normal browser. Details: `audit/state-laws-50.md`, round 3.

### Improvement catalog, round 4 (16 Nov, `audit/catalog-coverage-round4.md`)

EV hubs (Liang et al. 2023, *Nature Sustainability*: +3.3% within 1 km, an association; cost from a public $1,777,000
8-port project budget, so the engine's $800,000 had overstated returns ~2.2x), school bonds (Cellini, Ferreira &
Rothstein 2010: $1.50 of home value per $1 of capital spending) and blight rehab (Ganduri & Maturana 2024: +2.3 to
4.0 points) now have sourced effects. EV hubs and school bonds apply **only in California**, where their studies were
measured. **Correction:** round 1 said the EV study could not be found; it exists. California's pedestrian/cyclist
crash counts now also use CCRS's Parties and injured-persons tables (+10% statewide) and are no longer treated as a
lower bound; 15,417 crash-dependent California rows that no longer qualify are dropped. Block groups with a sourced
best project: 18.5% → 33.3% nationwide (LA 61.7% → 88.6%); with both effect and cost sourced: 16.3% → 15.7%.
Farmers markets, community gardens, corner stores, slow streets, wayfinding and night markets stay unverified.

### Safety comparisons recomputed (16 Nov, `audit/crash-rankings.md`)

The "worse than X% of similar areas" comparisons and crash-dependent recommendations (traffic calming, crosswalks,
signals, slow streets, bike lanes, lighting) are recomputed for all 151 counties with rebuilt crash counts
(`scripts/recompute_crash_gaps.py`), comparing only within one crash source. 49% of old pedestrian/cyclist gaps moved
more than 10 points; 2,169 traffic-calming rows were dropped (no pedestrian/cyclist crash in the 3-year window) and
1,594 added. In California and Illinois the pedestrian/cyclist count is a lower bound, so rows there are only added,
never dropped. San Francisco's comparison is now recomputed from its DataSF counts, within the county (not pooled with LA's CCRS counts). The pipeline now uses the same
10 m boundary rule.

### State housing laws, round 3 (16 Nov): independent check of the new quotes

Virginia § 15.2-2209.4 re-fetched from law.lis.virginia.gov: quote matches. Connecticut § 8-2o: the cited CGA search
page renders by JavaScript and the CGA statute site returns nothing to the audit machine, so the quote was confirmed
only in the copy the research track fetched (it matches in full context), not re-fetched independently. Still
blocked: NY and IN (free API keys needed), IL and WI (sites don't answer the build machine), NH, NJ, NM, GA, AL, AR,
MS, TN (need a normal browser). For those, "none found" is unverified.

### Live check of every county reported as showing estimates (16 Nov)

`scripts/live_check_valuations.mjs` opens the real page with live data and clicks 5 real homes per county, by map
point and by drawn lot. **8 of the 12 counties reported as "shown" were broken on the live page**, now fixed (each
with a browser test through the page's own lookup). The worst: **every house outside LA was matched to whichever
block group happened to be selected**, not its own (a map feature without a shape broke the lookup), which skewed
estimates and every neighborhood figure shown for a house; a Queens home that sold for $2,125,000 had been estimated
at $1,059k and is now $2,007k. Also fixed: DC's parcel query asked for fields the layer doesn't have (no DC estimate
ever showed); every Florida click failed (the statewide layer errors on small result limits, and the page gave up
after 5 s); Florida neighborhood values were keyed to 2010 block groups; King and Miami-Dade pointed at zoning
layers; clicking a drawn lot dropped the model's inputs; a failed lookup was shown as "public right-of-way".
After the fixes: LA, DC, Queens, Staten Island and King show estimates for 5/5 homes; the 7 Florida counties show
the home's 2025 recorded sale (every sampled home had one) and the model computes for all of them, but a Florida home
without a recent sale has not yet been seen showing an estimate live. Independently re-run for Queens and DC: 20/20.
A registry check of all 123 parcel services the page uses found 9 failing outside these counties (listed in
`data/backtests/parcel_registry_check_2026-11-16.json`).

Re-run by me at 21:20 on 16 Nov, after merging the fixes: 117, then 121 of 123 answered. Two failures were real and
persistent: **Alaska's statewide parcel layer (used for Anchorage) now refuses requests without a login token**
(it answered at 19:41; three retries all got "Token Required"), so Anchorage now uses the Municipality of Anchorage's
own public `PropertyInformation_Hosted` layer (checked: a point at 646 F St returns that parcel, appraisal year 2026,
data edited 16 Nov). **Hinds County MS's server returns HTTP 500 on every request, including its root**; the two
alternatives found (the county's own server, a regional planning server) also failed, so Hinds is unchanged and
clicks there show "couldn't get this lot". Tennessee's state parcel server answers some requests with 403 and the
next with 200 (likely rate limiting; the four TN counties are queried back to back by the check). Davidson's
entry, which browsers couldn't use at all (blocked cross-origin), now points at Metro Nashville's own public parcel
layer; the live panel check passed on 3 Nashville parcels through it.

### Live check of every other panel, 20 counties (16 Nov)

`scripts/live_check_panels.mjs` opens 60 real parcels (2 counties per Census division, plus LA and Orange CA) through
the page's own click path and checks each panel against its source, fetched separately: Census TIGERweb, the HUD
FY2027 file, FEMA flood zones, USGS elevation, crash counts, state law records, the county data files and Tree Equity.
**No wrong number was shown.** I re-ran it for Travis TX and Jefferson AL: all checks passed except one FEMA
"Not available (failed to fetch)", which is FEMA dropping a request, not a wrong value. Details:
`audit/live-panels-check.md`.

**Correction: the house checks stated housing rights that weren't sourced, in every state but California.** Since
before this audit, the "what can I build" checks printed hardcoded legal claims outside California: "Austin HOME
Initiative authorizes" applied to all of Texas, "WA HB 1110 allows", "HB 2001 permits", Florida Live Local
"internal apartment conversions", a "municipal infill schedule", "Fannie Mae / FHA" financing, California's 4-ft ADU
setback applied everywhere, and Austin's lot-split sale rule applied to all of Texas. None were tied to a checked
record or to the conditions each law requires. They now name only the state's records in `statutes.json`, as
applying only where all their conditions are met, and grant eligibility is stated as conditional. The provenance
audit missed this because the claims were text in `app.js`, not data records. Also fixed: a lot whose use the parcel
service doesn't record was called non-residential (all 51 sampled houses outside LA); median rent was rounded to
thousands ("$2k/mo" for $2,356); the records panel now retries once when FEMA drops a connection.

### "What fits on this lot" beyond LA and Florida (16 Nov)

The lot checks ran only in LA and Florida (the only places whose use codes the page could read), and no zoning
standards existed outside LA. Now: **New York City, districts R1-R5**, from the Zoning Resolution's own text
(zr.planning.nyc.gov; `scripts/build_zoning_standards.py`, each rule with its verbatim quote and section): housing
types (22-122), minimum lot (23-11), floor area (23-21), height (23-421/422), ancillary units up to 800 sq ft (12-10).
NYC parcel use is decoded from the PLUTO data dictionary. Everywhere else the page says "zoning standards not on
file" with the reason (Austin, Phoenix, Seattle, Chicago, Philadelphia: their code sites returned 403 to the build
machine). I re-fetched ZR 23-11 and 23-21 myself: the minimum lot sizes for seven districts and the floor area ratios
(including the 0.60 per-home cap on lots of 4,000 sq ft or more) match the published tables. I re-ran the live check:
8/8 NYC lots across four boroughs match MapPLUTO on the real page, 22/22 quotes found again in the live code, and
Travis TX and Jefferson AL show the reason (`data/backtests/live_check_lot_fit_2026-11-16.json`, `audit/lot-fit-expansion.md`).
**Bug fixed:** a lot counted as a home if its use matched "resid", which also matches "non-residential", so
commercial, church and school lots with a worded use got ADU and second-story checks (LA and Florida unaffected).

**Round 2 (16 Nov): Washington, DC zones R-1A, R-1B, R-2, R-3**, from the 2016 Zoning Regulations (11 DCMR, dcregs.dc.gov):
minimum lot to create a new lot (Table D § 202.1), 40 ft and 3 stories (§ 203), lot occupancy (§ 210), one home plus
one accessory apartment (§ 201.1) and the accessory-apartment rules (Subtitle U § 253). DC's parcel layer has no zone,
so the page reads the zone from DC's official zoning map at the clicked point, and applies nothing if the map doesn't
answer. Modified zones (e.g. R-3/GT) are withheld with the reason. I downloaded the Table D § 202.1 and Subtitle U
§ 253 files myself: every lot width and area for the four zones, the 2,000 / 1,200 sq ft house minimums, the 35%
cap and the three-person limit match. Use tables added for DC (the tax office's 109 use codes) and Nashville (the
Assessor's land-use descriptions, read from the layer itself because its metadata lists none); condo units and
apartment buildings no longer get ADU, pool or lot-split checks. Re-run live: NYC 8/8, DC 5/5, Nashville 2/2, quotes
22/22 and 27/27. Withheld: Nashville's zoning code (Municode returned 403) and Denver (no current code text found; the
statewide layer also truncates Denver's zone names). Correction: the first round's write-up said Denver publishes its
code as a PDF; that was not confirmed and has been removed.

**Round 3 (17 Nov): New York City R6-R10** (25 districts, exactly those the ZR 23-22 and 23-432 tables name), from
ZR 22-121 (all residence types permitted), 23-12 (minimum lot), 23-22 (floor area) and 23-432 (base and building
heights). Where the code's footnotes make a value depend on something the page can't see (within 100 ft of a wide
street, Mandatory Inclusionary Housing areas, qualifying affordable or senior housing), the page shows each value with
its condition and says which applies isn't checked; it never shows one unconditioned figure. I fetched 23-22 and
23-432 myself: R6 (3.00 within 100 ft of a wide street / 2.20 otherwise; 3.90 qualifying), R8 (6.02 / 7.20; heights
115 or 135 ft by street) and R10 (10.00 / 12.00; 185 or 215 ft) match the tables. I re-ran the live check twice:
12/12 R6-R10 lots in four boroughs match MapPLUTO and 40/40 table rows were found again. Apartment buildings (NYC
codes 02, 03) get the district's standards but no house-only checks. A missing single height would have been read as
0 ft (and the second-story check would have said no); fixed before merge.

**Round 4 (17 Nov): NYC R11, R11A, R12 and 58 commercial districts where homes are allowed.** A commercial lot takes the
residence district ZR 34-112's equivalents table assigns it; I fetched 34-112 myself and checked C3 to R3-2, C4-1 to R5,
C4-4 and C1-6 to R7-2, C4-5D to R7D, C6-3A to R9A, C2-8 / C6-4 / C5-3 to R10 and C1-9A to R10A, with their floor area
ratios matching the residence tables. Values are shown with their conditions (residential-only buildings, 34-01; no
plaza bonuses). C7 and C8 say residences aren't permitted; ten special designations the table doesn't list are withheld
with the reason; C3 and C4-1 heights are withheld because how ZR 35-62 applies to an equivalent district isn't clear
from the text. Lots under a C1/C2 overlay keep their residence standards plus a row on what the overlay changes; lots
in a special purpose district say its rules aren't checked. No residential lot in the city is mapped R11 or R12 or
an equivalent, so those are checked against the live tables and a browser test only.

**Round 6 (17 Nov): Charlotte (N1-A to N1-F) and Portland (R20, R10, R7, R5, R2.5).** Charlotte's rules come from the
City's UDO site (Article 4 tables, Article 15 use matrix and ADU rules); Portland's from the City's Title 33 PDFs
(chapters 33.110 and 33.610). Each zone is read from the city's own zoning map at the clicked point; other towns say
"outside". I re-read Portland's Table 610-2 (min lot area 12,000 / 6,000 / 4,200 / 3,000 / 1,500 sq ft, widths 60 / 50
/ 40 / 36 / 25 ft, depths 60 / 60 / 55 / 50 / 40 ft) and Charlotte's Table 4-1 (lot area 10,000 to 3,000 sq ft, widths
70 to 30 ft, heights 48 / 48 / 40 / 40 / 40 / 48 ft): all match. Miami is withheld: its code is published only in a
JavaScript app with no readable text (round 5's table said it was reachable; corrected). Portland's zoning map server
answered some browser requests with HTTP 502; the page then says the map didn't answer and applies nothing.

**Round 5 (17 Nov): City of San Diego, single-family zones RS-1-1 to RS-1-14**, from the City's own PDF of SDMC
Chapter 13, Article 1, Division 4 (edition 9-2026): minimum lot area, width, frontage and depth, setbacks (Table
131-04D), height and floor area ratio (incl. Table 131-04J's bands by lot area). The zone is read from the City's
Official Zoning Map at the clicked point; outside the City (e.g. Chula Vista) the page says so. I downloaded the PDF
myself: RS-1-1 (40,000 sq ft, 100 ft wide), RS-1-7 (5,000 sq ft, 50 ft, 24/30 ft height) and RS-1-14 (5,000 sq ft,
50 ft, 35 ft, FAR 0.60) match the table. My live re-check: 3/3 RS lots, 43/43 quotes re-found, Chula Vista shows the
reason. Of the 30 largest metros, 21 cities' codes answer 403 to the build machine (mostly on Municode and American
Legal); Charlotte, Portland and Miami are reachable and not yet built (`audit/lot-fit-expansion.md`). Also fixed: San
Diego's parcel address showed only the house number; the street fields are now joined (live: "1590 E CHASE AVE").

**Correction: NYC lot-width and lot-split checks never ran on the live page (found 17 Nov).** The registry's MapPLUTO
request never included the lot-frontage field, so in rounds 1-3 the NYC lot-width and "big enough to split" checks were
skipped on every real click. The browser tests passed because their mocks return every field; my live checks compared
district standards and didn't catch the missing row. The page now reads `LotFront`, overlays and special districts from
the same layer by BBL, so R1-R5 lots now show those checks.

**Travis County's parcel service went offline overnight (found 17 Nov by my re-run of the live check).** The county's
`TCAD_public` service (and its two other TCAD services) now list no layers, so every Travis click said "couldn't get
this lot". The page said so and showed nothing, so no wrong value was shown. Travis now uses the City of Austin's
public copy of the appraisal district's parcels (`EXTERNAL_tcad_parcel`, 386,682 parcels, edited 2 Nov 2026, browser
requests allowed; its address field holds only the house number, so it isn't used as the address). Live: Travis
panels 3/3 and the "not on file" reason shown. Registry check: 122 of 123 answer; Hinds MS still returns HTTP 500.

### Correction: more invented figures in the page's own text (round 2, found and fixed 16 Nov)

A second sweep of claims written into the page code (not data files) found more invented or overstated figures,
all from before this audit (details, quotes and URLs: `audit/hardcoded-claims-round2.md`):
- **Tree economics box:** per-state home-value gains (+$5,400 / +$8,200 / +$6,200) and $95-$220/yr energy savings
  credited to the USDA Forest Service were invented. It now quotes the two studies as written; I fetched both myself:
  Donovan & Butry 2010, "This tree adds $7130 to the price of the house it fronts" (a tree of the sample's average
  canopy), and McPherson & Simpson 2003, "$71/tree planted" over 15 years.
- **Ecoregion table:** EPA/CEC codes, per-state canopy targets (15-42%) and a heat label "vs. EPA Level IV
  ecoregion median" had no source. The canopy gap now uses each block group's own Tree Equity goal.
- **Financing text** per state (coverage ratios, bond terms, a claim that bond models run outside California) was
  hand-written; it now comes from the checked finance-profile and funding-program records. Nine unchecked
  "Non-Private Funding" lists were removed. The EIFD text said no vote is needed and a plan fails only on a 50%
  protest; Gov. Code § 53398.66 says a 25-50% protest forces an election and over 50% ends it.
- **ADU fees:** Washington, Florida, Texas and other states' fee rules were invented and are removed; California is
  kept (Gov. Code § 66311.5 and the State Allocation Board's 2026 residential Level I rate, $5.38/sq ft, which I
  read in the board's own document). Fee tiles no longer say "$0 (exempt)" where the fee is unknown.
- **SB 9** was "yes, up to 4 total units"; it is now "maybe", with the conditions of Gov. Code § 66411.7 that the page
  can't see. A "recoups 58%" bathroom figure (an LA-only survey) shown nationwide was removed; the Brace + Bolt grant
  is no longer subtracted as if awarded.
Still unverified and marked so: LA County Policy 3.106, the Orange County EIFD cap, the plain-language zone
summaries, Tennessee's and Cook County's assessment ratios (only used where estimates are withheld).

### Queens low-price sales: what NYC's deed records show (16 Nov, diagnostic)

Queens passed its back-test (14.97%), but its 230 test sales under $500k were estimated at about twice their recorded
price. `scripts/backtests/diag_nyc_acris.py` matched each sale to its deed in ACRIS (same lot, dated within 3 days,
same amount; 226 of 231 matched). The deeds themselves mark many as non-market. In the development window (Jan-Apr
2026), among sales under $500k vs $500k-$1M vs $1M-$2M: grantor and grantee share a surname 27% / 3.3% / 0.6%; a
partial share conveyed 2.3% / 0.2% / 0.1%; a referee (foreclosure) as seller 10% / 4.5% / 1.4%. The test window shows
the same. Those three screens are locked from the development window (`scripts/backtests/nyc_sale_screens_locked.json`)
for the next fresh test window; the published Queens result is not re-run, and the page keeps its warning on the
under-$500k band. My first run filtered deeds by ACRIS's `recorded_borough`, which is the recording office (mostly
Manhattan), not the property's borough; it would have missed most Queens deeds. It was caught before any result was
produced.

### Correction: a point with no parcel was called a "public right-of-way", and border clicks asked another state's service (found and fixed 17 Nov)

The page picks a parcel service for a click by rough latitude/longitude boxes before anything else, and the boxes
overlap neighbors: North Carolina's covers eastern Tennessee, Kern County's reaches into northern LA County. A click in
Sevier County TN (no parcel service) asked NC OneMap, which had no parcel there, and the page then said the point "is
located within the public street or transportation right-of-way", something it can't know; it said the same for any
point where the service it asked returned no parcel. Found in my live check of the new Tennessee counties (the check's
own label had echoed the page's wording). Now the county whose block group contains the point decides first, and a
point with no parcel says "No parcel found at this point", names the service asked, and says it may be a street, water
or a gap in that layer. e2e test on Sevier County, confirmed to fail on the old code.

### Correction: the page's roof drawer used invented inputs the tested code had removed (found and fixed 17 Nov)

The page runs its own copies of several engines inside `app/app.js`; the unit tests ran the copies in `src/engines`.
An earlier commit (ff6b849, "eliminate ... fallback numbers") removed an invented 1,600 sq ft living area and 1975 build
year from the `src/` roof engine only, so the page kept them: the roof drawer, built on every house panel, showed a roof
area, roofing squares and a pitch for houses with no recorded size, and houses with no recorded year got a 1945-78 ranch
pitch. I confirmed both defaults in the page code before the fix. The page now runs the tested code: with nothing
recorded it says "Living area not on file". The roof pitch values themselves are still unsourced assumptions (noted,
not changed). The other differences found were the other way round (the page's valuation and house-auditor copies were
right and the tested copies stale); `src/` now carries the page's code. A test fails if any shared engine function
differs between the page and the tested files, and the 12 unused `.ts` copies are deleted (`audit/engine-copies.md`).

### Correction: city ordinances were applied as state law (found and fixed 17 Nov)

The law table holds three city ordinances alongside the state laws: Austin's HOME initiative, Raleigh's missing-middle
ordinance and Minneapolis 2040. The page's law engine checked Austin's against the city name, but Raleigh's and
Minneapolis's fell through to the generic rule, which matches on the state only, so the "what can I build" check could
apply Raleigh's ordinance (up to 4 units by right, no parking minimum; record marked "could not check") to any
residential lot in North Carolina, and Minneapolis's to any in Minnesota. The house note also listed all three as
"state law on file" anywhere in their state. Each is now tagged with its city (`local_jurisdiction` in
`statutes.json`), applies only where the parcel's city matches (a lot with no city name says the city is missing),
and is labeled "City of X ordinance; applies only in that city". Found by the Charlotte track. Also found: the unit
tests run `src/engines/statutoryZoningEngine.js`, while the page runs its own copy inside `app/app.js` (and a third
`.ts` copy has drifted); a test now fails if the page's copy and the tested copy differ. My mistake in shipping it: I
committed and pushed the fix (a70a49b) while the full browser suite was still running; one test still expected Austin
to be named "state law on file" and failed. The test now asserts the corrected wording, and the full suite passes
(67/67, 57279f8).

### Correction: four more hand-typed figures still reached users (round 3, fixed 17 Nov)

A row-by-row re-check of the 97-entry constants audit (`audit/appjs-constants-round3.md`) found these still live, all
from before this audit; I confirmed each on the code before the fix:
- **Renter displacement map metric and index:** computed from a typed 28% severe rent burden and 65% (California) / 15%
  (elsewhere) rent-control coverage; no county file has those inputs, so every block group got the same score (42/100
  in the samples checked). The metric is removed from the map menu and the index from the project tiles; renter view
  shows the Census renter share only.
- **"Joint Value Created" tile:** a dollar total under a typed 30% / 22% neighborhood cap, with a typed 2.5% lift for
  projects without a sourced effect. Now "not modeled"; "Total cost" is the plain sum of the shown projects' own costs.
- **House panel "How is this estimated?"** (back-tested counties only) split the value into land, age, bed/bath, lot
  and pool premiums from typed rates and said it was "calibrated against county assessor rolls, deed recordings, and
  Census ACS microdata" — false, and not the model that produced the shown estimate. It now shows the actual tested
  method and the recorded facts only.
- **EIFD per-project plan:** now names its 3% administration share and 2%-a-year growth as assumptions.
LA County Policy 3.106 warnings are marked "policy text not re-checked" (Municode 403, County link 404). Still in the
code but not reaching users: the solar credit table, a residual-land-value function and the generic estimator's rates
(never called, or withheld by the back-test gate). My live re-check (LA and Brooklyn): none of the removed figures
shown, panels 6/6 apart from USGS timeouts shown as "Not available".

### Correction: return bands were called a "model range", and an unsourced "locally adjusted" mode could re-rank projects (fixed 17 Nov)

From before this audit. The ± band on every project's value-per-$1 return was labeled "(model range)" for catalog
grades A-C, and the code (and the CHANGELOG, item 19) said the band widths were "derived from published
quasi-experimental & econometric hedonic literature" / "traced directly to published study standard errors". They were
never traced to any study (`audit/appjs-constants-audit.md` had flagged them). Every band is now labeled "judgment band
±X%, not a statistical interval". A "Return estimate" control in the Layers menu offered a "Locally Context-Adjusted
ROI" that multiplied returns by hand-typed factors for heat, canopy gap, bus frequency, dining, freeway distance, price
tier and a saturation curve, and re-ranked projects and map colors; the methods page described it as a model. None of
the factors had a source; the mode, its control and its URL setting are removed. The methods paragraph also stated a
street-tree cost of "$1,945 per Public Works tree (LAMC § 62.177, Ord. 185,573)"; I could not reach the code or the fee
schedule (American Legal and StreetsLA return 403; the Board of Public Works site doesn't resolve from the build
machine), so that sentence is removed as unverified. Browser test added; live check: an LA block group shows 13
"judgment band" labels and no "model range" or "locally adjusted" text.

### Tract medians shown as block-group figures, now labeled (17 Nov)

Where the Census suppresses a block group's median home value or rent, the county files hold the tract's published
median instead. Home values carried a per-block-group note; rents did not, so 43,901 block-group rents (of 174,392)
were shown as the block group's own, disclosed only in the county-wide source note. `scripts/build_acs_fallback_flags.py`
compared every value in all 642 county files (plus Orange, LA and the correction fills) with the Census Bureau's ACS
2020-24 table files: every value is either the block group's own estimate or exactly its tract's; **no mismatches**
(home value: 158,638 own, 13,724 tract; rent: 130,491 own, 43,901 tract). I re-checked 21 flagged values in four
counties (Christian MO, Bibb GA, Catawba NC, Inyo CA) against the Census files myself: all match the tract figure, and
the block group's own is suppressed. The page now labels each such value "tract median; the block group's is suppressed
by the Census" (neighborhood panel, comparison drawer, printable brief, house panel). Live: Wake NC and Inyo CA, 10/10.
A typed fallback (`hv: 850000, rent: 2200`) in the house map popup was never displayed; removed.

### Parcel services round 3 (17 Nov)

Shelby TN now reads the City of Memphis certified tax-parcel layer (2025 roll); Hamilton TN the Chattanooga-Hamilton
County planning agency's August 2026 parcels; Hinds MS the county's parcel-viewer layer (edited 1 Oct 2026), so Jackson
clicks work again. I queried each myself: browser requests allowed, and a point inside a known parcel returns that
parcel (e.g. 1219 E Dallas Rd, Chattanooga). **Knox TN had never loaded a lot**: its field list asked for
"LOC_HOUSE_NUMBER + LOC_STREET_NAME" as one field, and the server rejects that query (I reproduced the HTTP 400). Fixed;
Knox still uses the TN state server, whose firewall answers 403 intermittently. Live: Shelby, Hamilton, Hinds 3/3 each
with every panel matching its source except ground elevation: USGS took 16-30 s or timed out on 17 Nov, and the page
said "Not available".

### Small counties: Tennessee complete (17 Nov); the rest of the US needs a hosting decision

The page listed only counties of 100,000+ people (80.5% of the US population); 2,443 smaller counties (63.6 million
people) weren't on it. A pilot built all 81 unlisted Tennessee counties with the standard pipeline (OpenStreetMap cut
from the US-South extract; Census, HUD, Tree Equity, state crash data as everywhere else), so all 95 Tennessee
counties now open. I checked 32 values in eight block groups of four random new counties against the ACS table files:
all match; no existing county's completeness row changed. The track's checks: 144 Census values in 9 counties, roads
and bus stops ID-for-ID against live Overpass in 5 counties (two off by one road each, a neighbor county's road
crossing the check box's corner), 27/27 block groups live. **Hosting limit found:** GitHub Pages publishes at most
1 GB per site; `main` is already 1.07 GB and this branch is 1.30 GB, almost all county files, so merging into `main`
as it is would likely exceed it. The rest of the US is paused until that's decided (`WORK-QUEUE.md`).

### Alaska round 2: 29 of 30 county-equivalents now have data files (17 Nov)

The remaining 24 boroughs and census areas were built with the same pipeline (OpenStreetMap through Overpass; each
borough's roads and bus stops match a direct Overpass query of the same box, ID for ID). Aleutians West is left out:
its block groups cross the 180th meridian, which the pipeline's box and the page's map don't handle; it stays "lot
lines only". I checked 36 values (population, home value, rent, income) in nine block groups of Bethel, Kodiak and
Yukon-Koyukuk against the Census Bureau's ACS 2020-24 table files: all match (two suppressed rents hold the tract's
published median, labeled). My own Overpass query for Skagway finds 5 bus stops, as the file has. Live, after the
merge: Bethel, Petersburg and North Slope 9/9 block groups, every panel matching its source; no new borough has a
public parcel service, and clicks say so. Three files are larger than any before (Prince of Wales-Hyder 17.5 MB, Bethel
14.8 MB, Hoonah-Angoon 11.7 MB, nearly all water lines); Bethel crashed the page until the county loader stopped using
`push(...array)` (fixed on main, e7d3aa3). Some boroughs' download boxes overlap a neighbor (Hoonah-Angoon with
Juneau, Yukon-Koyukuk with Fairbanks), so distances to bus stops can reach stops just across the line, which is real
geography, not a double count. Details: `audit/alaska-bundles.md`.

### Alaska: five boroughs now have data files (17 Nov)

Anchorage, Fairbanks North Star, Matanuska-Susitna, Kenai Peninsula and Juneau (about 80% of Alaska's population) now
open as data counties, built by the same county pipeline from the same official sources. No Alaska OpenStreetMap
download is reachable from the build machine, so OpenStreetMap is read through the Overpass API (tiled, all-or-nothing);
each borough's road and bus-stop counts match a direct Overpass count of the same box. I checked four Anchorage block
groups against the Census Bureau's own ACS 2020-24 table files (downloaded separately; the Census API now needs a key):
population, median home value, median rent and median income all match; where the block group's rent is suppressed the
file holds the tract's published median ($1,517 for tract 28.22), as the county's source notes say. Anchorage's FY2027
HUD rents come from the HUD file. Left empty and named as missing: state crash data (Alaska has no connected source),
heat (American Forests' 2021 Alaska file returns 403), crime, rail distance (no Alaska Railroad stop in any GTFS feed
found), bus frequency outside Anchorage, and site suggestions. My live re-check: Anchorage 3/3 parcels with all panels
correct; Fairbanks 3/3 block groups correct with "no parcel service on file". The other 25 boroughs still show lot
lines only. Details: `audit/alaska-bundles.md`.

### Correction: clicks in 250 counties queried another county's parcel service and called the point a road (found and fixed 17 Nov)

Found by the Alaska data-file track's live check. When a county had no parcel service of its own, the page fell back
to "the state's" service, but took any service that listed the state, and every county's own service lists its state.
So a click in Fresno or Ventura queried Kern County's service (I reproduced it: on the old code `parcelSvc("06019")`
returns Kern's), and the same in 250 of the 639 counties with data files. That service had no parcel at the point, and
the page then said the point was a "Public Right-of-Way / Roadway", which it had no way of knowing. No other county's
parcel was shown as the clicked lot: probing the old fallback service at 3 points in each affected county found
parcels at only 3 of 751 points, all at county borders (Walton GA by Gwinnett's layer; Brazoria and Fort Bend TX by
Harris's); 714 found none and 34 probes failed (`data/backtests/parcel_state_fallback_check_2026-11-17.json`, re-run in
the page's own service order, in which all 52 affected California counties used Kern's service; the first version of
that file had probed LA's service for them and was replaced; I recounted the corrected file). Now only statewide services
(no county list) are a state's fallback, as the AI advisor's parcel tool already did, and a county with no service says
"No public parcel service is on file for this county". e2e test through the click path (Fresno), confirmed to fail on
the old code. My earlier live checks missed it because they sampled counties that have their own service or a real
statewide one.

### Correction: three "shown" estimates were not shown (found and fixed 16 Nov)

The 16 Nov report said Queens, Staten Island and Hillsborough estimates were shown on the page. They were not: the
page's parcel lookup dropped the service's own field names and requested only the first 8 fields, so the live page
always withheld them for "missing inputs". Their parity tests fed raw fields straight to the model and never went
through the live lookup, so nothing caught it. Fixed, with a browser test of the real lookup path. The earlier claim
was made from a test that didn't cover the live page.

## 3. What was built to keep it accurate

- **Machine pulls instead of typing:** `scripts/fetch_hud_fmr_api.py` (HUD rents for every county) and
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
- State finance profiles (21 Nov): NH and PR could not be fetched; IN, NY and PA were checked but nothing could be
  confirmed; 8 partly verified profiles (ID, MN, MO, MT, ND, SD, UT, WV) were not re-checked in round 4
  (`audit/state-finance-profiles-2026-11-21.md`). The page computes no tax-increment amount outside California.
- **HUD Fair Market Rents (resolved FY2027):** FY2027 rents took effect 1 Oct 2026 (Federal Register
  2026-17891). Replaced the map-service pull with a direct machine pull from HUD's official FMR API
  (`scripts/fetch_hud_fmr_api.py`) with per-record evidence URLs. All 3,222 counties are current FY2027 values
  pulled directly from HUD's official API, with an automated sanity check confirming that the API's FY2026
  Los Angeles value ($2,903) matches the revised Federal Register notice (2026-07741).
- **Correction (later on 16 Nov):** this list said 7 of 150 live parcel/zoning services were dead. That was wrong:
  all 7 answered when re-checked; county servers drop requests under load. Tiers now count configured services, and
  each county lists services that failed three retries at build time (`live_services.not_responding`; 6 on the last
  build, including New York State's parcel service, which reported "not started").
- OpenStreetMap lookups through Overpass are untested against the live service (unreachable from the build machine).

### Corrections & Audit Fixes (18 Nov)

- **Hazard checks reading incorrect response fields (`app/app.js`):** `lotChecks()` returns `R.fema.sfha`, `R.fire.vh`,
  and `R.hpoz.ok && R.hpoz.v.length`. Earlier code read `R.flood.ok` and `R.fire.ok` (which were never set, evaluating
  to false) and treated any successful HTTP query in `R.hpoz.ok` as an active historic designation (falsely excluding
  every Los Angeles parcel from SB 9 / ADU screening). Fixed to evaluate actual exclusion fields, and rows report
  "Not checked for this lot" when unqueried instead of asserting negative status.
- **Underused-land popup speculative figures (`app/app.js`):** Removed speculative "development margin" ($250k–$800k)
  and "net equity" estimates that were derived from unverified residual land value formulas. The popup now displays
  only the County Assessor's official recorded land value.
- **Roof area & footprint grounding (`app/app.js`, `src/engines/roofAreaEngine.js`):** When no building outline is found
  in OpenStreetMap, the footprint is now explicitly set to `null` ("Footprint not on file") instead of inventing a
  footprint from living area / 30% lot area. Traced building outlines use 0 overhang (as aerial polygons trace eaves).
- **Address search state collisions (`app/app.js`):** Replaced substring matching (where "maryland" matched "AR") with
  an exact 2-letter state code lookup table, fixing county search collisions across MD, NC, GA, MS, MO, RI, and WA.
- **Zoning fallback & multi-family classification (`app/app.js`, `src/engines/parcelHouseAuditor.js`):** Removed
  fallback from missing zoning codes to land use codes (`DOR_UC`/`LUCode`), and hardened single-family detection
  to explicitly exclude multi-family designations (`R-3`, `R-4`, `RES-MF`).
- **LiDAR attributions:** Removed false claims that building heights were "calibrated from USGS 3DEP LiDAR DSM".
  Attributed building footprints and heights to OpenStreetMap contributors and County Assessor records.
- **ACS top- and bottom-coded values:** Census top-coded values ($3,501 rent, $2.0M value) and bottom-codes are
  formatted as "$3,500 or more", "$2,000,000 or more", and excluded from rent burden and sum calculations.
- **CSP & JSONP allow-list:** Allowed `maps8.stlouis-mo.gov` so St. Louis City parcel queries succeed via JSONP;
  added `connect-src data: blob:` to unblock the browser's fast base64 decoding shortcut (`b64Bytes`); and added
  a 15-second fetch retry for slow CORS-enabled parcel services (such as Florida's statewide cadastral layer).
- **Correction: roof pitch citations removed (18 Nov).** An earlier edit the same day relabeled the default roof pitch
  values (3.5, 4.5, 5.5, 7.0, 7.5 and 8.0 per 12, unchanged) as "formally grounded" in NREL ResStock (report number
  "NREL/TP-5500-75217") and IRC Section R905, with per-climate "modal pitch" figures. No NREL report with that number
  was found (www.nrel.gov is not reachable from the build machine, so NREL's own catalog wasn't searched), and R905 sets
  only minimum slopes per roofing material (2:12 for asphalt shingles, per municipal guides quoting R905.2.2), not typical
  pitches by climate or era. The values remain unsourced rules of thumb, and the page says so again. Users can still pick
  the pitch that matches the house. Remnant "LiDAR" references were removed from code comments.
- **HUD Small Area FMR (SAFMR) ZIP Integration:** Added ZIP-level Fair Market Rent resolution for designated Small Area FMR
  metropolitan counties (336 counties) via `zip_rents` in `app/app.js` and `app/facts.js`. When a parcel carries a ZIP code,
  it resolves the specific Small Area FMR, displaying the ZIP in the fact title and clarifying that it is a voucher
  benchmark for that ZIP code rather than a market asking rent.
- **St. Louis City Parcel Layer Modernization:** Migrated from stalled `PDA/PARCELS_PUBLIC/MapServer/0` (HTTP 499 Token Required)
  to the active, public St. Louis City Assessor layer (`maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/11`)
  which serves full parcel polygons, APNs, and addresses without requiring tokens or falling back to blocked JSONP.
- **Antimeridian (180°) Grid Coordinate Wrapping:** Updated `gridCellIndicesX(w, e, cell)` in `app/app.js` to handle
  bounding boxes crossing the 180th meridian (where west longitude > east longitude, such as Aleutians West, Alaska),
  wrapping smoothly across the antimeridian instead of collapsing into an empty coordinate array.
- **Valuation Backtest 95% Confidence Intervals:** Augmented model evaluation in `scripts/lib/backtestMetrics.mjs`,
  `app/data/valuation_backtest_benchmarks.json`, and `app/app.js` with bootstrap 95% confidence intervals on the median
  error (`mdape_ci_95`). Displays confidence intervals alongside MdAPE figures (e.g. Queens 14.97% [95% CI 14.36%–15.49%])
  so sampling error is clearly stated.
- **Discrete Parcel Registry Fields (Harris & Dallas TX):** Cleaned concatenation expressions (`site_str_num + ...`) in
  `app/data/parcel_services.json` (entries 113–114) and `PARCELS87` into discrete query fields matching `^[A-Za-z0-9_.]+(\(\))?$`,
  resolving HTTP 400 errors when querying parcel attributes in Harris (48201) and Dallas (48113) counties.
- **OSM Building Height Parsing:** Added unit conversion in `parseOsmHeight` to parse feet (`40 ft`) and feet/inches (`12'6"`)
  into meters, preventing building heights in imperial units from being multiplied into erroneous story estimates.
- **XSS & Quote Sanitization:** Enhanced `esc()` in `app/app.js` to escape single quotes as `&#39;`, preventing quote breaking
  in inline event attributes.
- **Connecticut Tree Equity Coverage:** Verified all 8 Connecticut planning region files (`09110` through `09190`) contain
  valid 2025 Tree Equity block groups crosswalked from historical county codes.
- **Transit Station Resolution (`findNearestTransitStation`):** Defined and hooked `findNearestTransitStation(lat, lng)`
  to calculate network-distance haversine proximity to verified rail and BRT stations across GeoJSON layer features,
  corridor pipeline stations, and verified regional stations in `app/data/transit_pipelines.json` (such as Austin Project Connect,
  Denver FasTracks, Chicago CTA Red Line Extension, and OC Streetcar). When distance cannot be established, statutory screening
  reports "not confirmed: transit distance unknown" rather than denying law applicability. In addition, when `statutes.json`
  resolves after an initial parcel click, the active house dossier dynamically re-renders to reflect applicable housing laws.
- **Home-Compare Drawer Safety & Assessed Valuation Labeling:** Fixed `btn.innerHTML` syntax error in comparison toggle,
  guarded against unmodeled strategies by requiring strictly positive numeric equity, ROI, and payback values (falling back to "Not modeled"
  instead of `+$0 Net Equity (null / $1)` or `null yrs`), guarded `b.title` with "None on file", persisted state code in compare items,
  and appropriately labeled California assessed values as "Assessed Value (Prop 13)" and other jurisdictions as "Assessed Roll Value".
- **Site-Plan Visualizer Constraints:** Gated the 4-ft statutory setback drawer on `activeState() === "CA"` and verified
  a traced building polygon outline (`osm_building_outline` or `cadastral_outline`) is on file, preventing statutory California setback
  rules from rendering in other states or over speculative footprints.
- **Story-Inference Provenance Labeling:** Labeled height-based story inferences as estimates (`estimated: X stories (height Y m ÷ 3.2 m floor-to-floor, OpenStreetMap)`)
  with `F.conf = "estimated"` rather than claiming them as measured.
- **NLR (formerly NREL) Endpoint Migration:** Migrated alternative fuel stations API endpoint in `pipeline/fetch_oc.py` from
  `developer.nrel.gov` to `developer.nlr.gov`, supporting both `NLR_API_KEY` and legacy `NREL_API_KEY`.
- **AI Advisor Turn Limits & Grounding Transparency:** Handled `pause_turn` gracefully on the final model tool round in
  `workers/advisorAgent.ts` to prevent unexpected loop termination, and surfaced `data.sources` as an expandable "Sources consulted"
  list and `stopped_early` as a prominent pause notice in the chat UI.

### Two branches merged; this base's tables kept; the Invest view carried over (19 Nov)

On 19 Nov the smaller decision-brief branch (last full state: commit 4e76a8a) was merged into this branch. For every
file both branches changed, this branch's version was kept, including all shared data tables (`statutes.json`,
`underused_sites.json`, `transit_pipelines.json`, `intercity_transit_corridors.json`, `unit_costs.json` and the
valuation files). Carried over from the smaller branch: the Invest view (`app/invest.js`, its CSS, `tests/e2e/invest.spec.ts`),
the decision engine (`src/engines/investmentDecisionEngine.js`, `docs/DECISION-ENGINE.md`, its unit tests), the
neighborhood-score back-test (`app/data/neighborhood_score_backtest.json`, `scripts/backtest_neighborhood_score.mjs`),
two new transit tables (`app/data/transit_cost_benchmarks.json`, `app/data/transit_value_effects.json`, their build
scripts), `scripts/brief.mjs` (`npm run brief -- <fips>`), `scripts/ai_verify_sources.mjs`,
`docs/PLAN-ACCURACY-TO-DECISIONS.md` and the `research/*_verification.csv`, `research/leftover_claims.md` and
`research/url_checks.csv` records. The smaller branch's link checker (`scripts/check_source_urls.mjs`) was dropped:
`scripts/check_sources.py` checks the same `app/data` links monthly. (`research/url_checks.csv` is that script's
18 Nov output, kept as a record; the research CSVs' own links are not in the monthly check.)

Corrections made while wiring the carried-over code to this base's data:
- **Improvement ideas showed figures the map withholds.** The engine read every bundle row's cost and value. It now
  applies `intervention_verification.json` with the map panel's rule and sourced-effect override (a unit test runs
  both on every row of Cook and Travis). In Travis County's top area, for example, street trees, park upgrades and
  rooftop solar are now named with no figures.
- **"Measured locally" evidence tier removed.** The engine called catalog grade-A items in LA "measured locally"; that
  LA sales estimate could not be reproduced (`audit/bundle-catalog-audit.md`). Audited ideas are now "Sourced inputs" or
  "Partly verified", from the audit.
- **Underused-site homes and margin no longer shown.** The smaller branch showed a "screening estimate" for them; this
  base lists them as unverified model outputs ("margin ... NOT REPRODUCIBLE"), so the Invest view shows the record's
  note instead of a number. This base has underused sites for Los Angeles County only (the nine hand-typed sites
  elsewhere, including two in Austin, were removed as fabricated), so other counties say none are measured.
- **Transit project lengths and costs.** This base's `transit_pipelines.json` has no length or cost fields, so local
  projects are listed without a capital cost (the smaller branch showed 5.5 miles and $5,750M for the CTA Red Line
  Extension from its own copy of the table). An intercity corridor's length or cost is used only when its record does
  not list it as unverified: Austin-San Antonio's 74 miles is shown as not confirmed.
- **Legality.** The engine called a statute engine that this base replaced; it now passes `statutes.json` to this base's
  `evaluateByRightHousing` and says "not determined", with that engine's reason, whenever it does not apply a law.


### Correction: review of the 18 Nov commits (086b38b..c26bf06), found and fixed 19 Nov 2026

Full review, one section per commit, with every request URL and value: `audit/review-2026-11-19-owner-commits.md`.
The rows below (except the HUD, transit and parcel items) render only from the Cloudflare Worker's facts, which the
published page does not use yet (`workerUrl` is empty); they also feed the AI advisor's tools.

| What | Old | New | Source |
|---|---|---|---|
| NOAA sea level rise (Worker, advisor tool) | "In 1ft SLR inundation zone" for San Francisco City Hall and downtown Seattle | Withheld: "Not on file" with the reason | NOAA `dc_slr/slr_1ft` and `slr_3ft` identify, 9 points: every coastal point returns the same region-wide "Low-lying Areas" polygon |
| FHFA tract house prices (Worker, advisor tool) | blank FHFA cell read as 0: index 0, "+0%", -100% over 10 years (17,211 of 63,930 tracts in 2025) | blank = missing; latest year with a value (tract 06037101220: 2024, 823.70, +125.67% over 10 years) | `fhfa.gov/hpi/download/annual/hpi_at_tract.csv`, pulled 19 Nov 2026 |
| FHFA status and licence | "developmental per FHFA FAQ Q5"; "public domain (FAQ Q32)" | "Census Tracts (Developmental Index; Not Seasonally Adjusted)"; licence "not confirmed" | `fhfa.gov/data/hpi/datasets`; no FAQ Q5/Q32 found |
| NPS historic check | "Not in National Register historic district" | "No National Register boundary polygon at this point" + why that is not "unlisted" | NPS `nrhp_locations` layer 0: 10 of 13 listed buildings tried have no polygon (e.g. Arctic Building, Seattle) |
| Nearest school (Worker, advisor tool) | "Nearby public schools", vintage "2023-2024" | "Nearest public school listing (NCES)", straight line, not the assigned school; year read from the layer (2024-2025) | NCES `Public_School_Locations_Current`, SCHOOLYEAR; Seattle's nearest record is "Interagency Detention School" |
| Transit station lookup and compare drawer (page) | Under-construction D Line stations counted; "0-Parking Exempt" in any state | Stations marked under construction / planned / proposed skipped; label California-only | `app/data/transit_pipelines.json` station `desc` |
| Highway cost index (Worker, advisor tool) | "Construction cost index ... Used to index historical unit bid prices"; tool: "index 2024 unit bid prices" | "Highway construction price index, U.S."; not a building cost index; nothing adjusted by it | `data.transportation.gov` r94d-n4f9 description; `unit_costs.json` is 2022-2026 local prices |
| Seismic design (Worker) | "Category D (PGA 0.32g)" | "Seismic Design Category D (PGA_M 0.32 g)", assumes Site Class D / Risk Category II, not a forecast | USGS `asce7-22.json`: St. Louis is C on Site Class C, D on Site Class D |
| FEMA NRI (Worker) | "Score 95/100", vintage "December 2025 release" | "Relative score 95 of 100", vintage "December 2025 (1.20.0)", FEMA's planning-only terms quoted | arcgis.com item 9da4eeb936544335a6db0cd7a8448a51 |
| CDC PLACES (Worker) | percentages with no "estimate" | "of adults (model estimates)", CDC's caution quoted, 2020 Census population | data.cdc.gov `cwsq-ngmh` description |
| EPA walkability (Worker) | "transit commute mode split"; "Census 2020" | "distance to the nearest transit stop"; "2019 Census block groups" | EPA user guide (June 2021); layer description |
| PVWatts publisher (advisor tool) | "National Laboratory for Renewable Energy (NLR)" | "National Laboratory of the Rockies (NLR)"; output carries tilt, azimuth, losses | `developer.nlr.gov/docs/solar/pvwatts/v8/` |
| Google Solar (not wired) | missing pitch/azimuth/area set to 0 | null | code review; needs key, not checked |
| NCES distance sort | a school with no coordinates sorted first (`?? 0`) | sorts last; coordinates null, not 0 | code review |
| Audit checklist | P1-6, P1-10, Worker security marked done; P1-11 "archived to tag" | reopened / corrected (no tag exists; R2 host does not resolve; page sends no Turnstile token) | `audit/AUDIT-2026-11-18-free-data.md` |
| R2 entry (`county_hosts.json`) | "CORS enabled" | "Placeholder: no bucket has been created" (stays disabled) | `pub-data.citypretty.org` does not resolve; R2 pricing page quoted |
| St. Louis and Kenton notes | "HTTP 499 Token Required"; Kenton `KentonPVA/PVA_Basemap/MapServer/12` | old St. Louis layer still answers; St. Louis read by JSONP; Kenton is `Parcel_QueryOnly/MapServer/1` | point queries 19 Nov 2026 |

Tests that encoded the untrue behaviour were changed, not deleted: the NOAA test (asserted a Miami "in zone" hit),
the facts-row label tests, the PVWatts publisher test and the FHFA ingest licence test ("FHFA FAQ Q32").

Live checks (19 Nov 2026, `scripts/live_check_panels.mjs`, LIVE_PORT 8941, results in
`data/backtests/live_check_panels_2026-11-19_review18.json`): St. Louis City 3/3 and Kenton KY 3/3 parcels with every
panel ok; Los Angeles 3/3 ok except one FEMA flood row (unrelated to these commits). Station lookup on the real page skips
Westwood/UCLA (under construction) and still finds Wilshire/La Brea and 95th/Dan Ryan. Details in the review file.
### Correction: California crash counts said 1/k but were built without it (found and fixed 19 Nov)

**What was claimed.** The 18 Nov audit item P1-3 and the script `scripts/build_crash_counts_ca.py` said a crash within
10 m of k block groups counts 1/k in each, and `build_crash_counts_ca.py` implemented it. The work queue (R1) said the 58
California files used the boundary rule.

**What was true.** None of the 58 files had been rebuilt after the 1/k code was written. All 58 (built 16 Nov) counted a
boundary crash in full in every block group it borders (their `_meta.rule` said "crashes on boundary streets count for each
bordering block group"). Their block groups added up to 1,348,795 crashes where the counties have 945,609 located crashes
(43% too many; 1.94 times in San Francisco). The page text said "recorded inside this block group or on its boundary
streets" without saying a crash is shared, and the comparison ("worse than X% of similar areas") and the crash-based
improvement rows used those inflated counts. Nothing on the page was wrong about which crashes were near a block group; the
counts were too high wherever a boundary street had crashes, and two neighbours both showed the same crash in full.

**What is true now.**
- All 57 CCRS counties rebuilt on 19 Nov (CHP CCRS Crashes and InjuredWitnessPassengers 2023-2025 via data.ca.gov; TIGERweb
  2020 block groups; raw downloads kept outside the repo) and San Francisco rebuilt from DataSF with
  `scripts/build_state_crash_counts.py` (its script already had the split; the committed file did not). Each file's `_meta`
  has `weighting: "1/k"`, `located_crashes` and `block_group_sums`.
- Across California: 1,219,650 crashes read (CHP's table has grown by 2 to 10 crashes in six counties since 16 Nov); 950,656
  with coordinates (78%; lowest Sutter 52%); 945,609 placed in a block group; block-group sums now equal 945,608.95
  (rounding). Pedestrian/cyclist 69,956 -> 44,391; killed or seriously injured 58,076 -> 39,905. Per-block-group changes
  run from -373.3 crashes (Santa Clara, 060855046011) to +1.0 (Santa Clara 060855027013, the only block group that rose; CHP's table has two more Santa Clara crashes than on 16 Nov).
- Invariant, every county: sum over block groups of the all-crashes count equals the placed crashes (and pedestrian and
  KSI sums equal their located totals) within rounding. Unit test `tests/unit/caCrashInvariant.test.ts` (58 counties).
- Hand check (independent distance count from the raw rows, no spatial index) of 7 block groups in 3 counties (Amador
  060050003031, 060050004024, 060050003042; Mariposa 060430001012, 060430001013; Los Angeles 060379800241, 060375021001):
  all three counts matched the file exactly (e.g. 060050003031: 184 rows within 10 m, 55 solely its own, 129 shared; 116.5
  crashes; file 116.5; old file 184).
- `crash_gaps` recomputed for the 58 counties (`scripts/recompute_crash_gaps.py`; counts shown to one decimal). Gaps
  4,624 -> 5,099; strengths 6,571 -> 6,398; crash rows dropped 15,417 -> 25,367 (the engine's ">= 1 crash" thresholds
  now read split counts; owner to confirm that is wanted).
- Page: `crashTextFor`, the comparison text and the "killed or seriously injured" row show one decimal where a count is a
  fraction and state the rule of that county's file. The 175 counties outside California still use the older rule and
  the page says so (`older rule: ... counts in full for every block group it borders ... run higher than the number of
  crashes`) until they are rebuilt.
- Live check on the real page (counties 06073 San Diego large, 06077 San Joaquin mid-size, 06049 Modoc small; 3 block
  groups each, all crash checks pass): `data/backtests/live_check_panels_2026-11-19_cacrash.json`; panel text showing the
  rule: `data/backtests/live_check_crash_panel_text_2026-11-19.json`.

### Comparison with the other branch's checking evidence (19 Nov 2026)

The two branches had checked the same tables independently; this base kept its tables on merge and never compared the
other's evidence. `docs/audit/branch-evidence-comparison-2026-11-19.md` does it record by record. Every disagreement
below was settled at the official source on 19 Nov 2026. Details, quotes and the unsettled items are in that file.

| What | Old | New | Source |
|---|---|---|---|
| Florida Live Local: which land | "commercial or industrial zoning only" (`commercial_or_industrial_only`) | commercial, industrial or mixed-use zoning, and land owned by a county, city or school district, and religious-institution land over 3 acres, whatever the zoning; the page asks who owns a parcel it cannot classify | Fla. Stat. 166.04151(7)(a)1 |
| Florida Live Local: exclusions | airport noise, "everglades / Wekiva / TRPA" | airport-impacted areas (s. 333.03), working waterfronts in industrial zones, Wekiva Study Area, Everglades Protection Area, open-character districts, areas of critical state concern, conservation easements; no TRPA | 166.04151(7)(o) |
| Florida Live Local: amendments | through ch. 2024-188 | through ch. 2025-172, 2026-14, 2026-163, 2026-179; subsection expires 2033-10-01; first effective 2023-07-01 | History line; Laws of Florida chs. 2023-17 to 2026-179 |
| California SB 79 | ch. 512 only; exclusions VHFHSZ, sea-level, historic register; 8-county gate | amended by SB 722 (Ch. 100, Stats. 2026, approved 2026-07-16, urgency): adds mobilehome and RV park sites; real exclusions are 65912.157(h); a county off the list is "not confirmed" (statute says "more than 15 passenger rail stations") | Legislature bulk data, GOV 65912.157 row and SB 722 chaptered text; 65912.156(q) |
| California SB 9 | no 2026 amendment noted | 65852.21 and 66411.7 amended by SB 1426 (Stats. 2026, ch. 56, eff. 2026-06-30); 1,200 sq ft new-parcel minimum recorded; exclusion list flagged incomplete | Legislature bulk data code table |
| Texas SB 840 exclusions | airport noise only | heavy-industrial zoning, within 1,000 ft of heavy industry, within 3,000 ft of an airport or military base, clear zones | enrolled text, 218.101(c) |
| Vermont Act 47 | 2 units by right | 2 units where residential use is allowed year-round, 4 where municipal sewer and water serve; count withheld for a parcel | 24 V.S.A. 4412(1)(D); Act 47 sec. 47 |
| Arizona HB 2720 / 2721 | 4 units by right | 3 units on the ADU path (A.R.S. 9-461.18); the 2024 middle-housing act's section number now holds different text, so its status is not confirmed; count withheld | azleg.gov chapter 197; A.R.S. 9-462.10 |
| Oregon HB 2001 effective date | 2020-01-01 | on passage; date unconfirmed | enrolled HB 2001 |
| Funding programs | percent shares (Measure W 100%, Prop K 80%, Illinois TIF 100%, Arizona GPLET 100%, CalFire 90%) and application cycles with no source | removed; CalFire shown as the 25-90% range; GPLET described as the 8-year lease-excise abatement | PRC 4799.12; A.R.S. 42-6209; Public Works board letter |
| 9 study records | listed with titles or links that do not resolve | removed (existence not confirmed) | pages 404 or unreachable 19 Nov |
| 7 study effect sizes | withheld | restored with quote: tree cover $1371 / 0.48% (Ramsey and Dakota Counties), Beltline 17.9-26.6%, parks 20%, greenways, solar $4/W, The 606 22.3%, High Line +10% (Levere working paper replaces an unfindable ULI report) | abstracts via OpenAlex; USDA PDF; IHS page; Levere PDF |
| Case studies | High Line and Beltline with no figures | $115M and +10%; 17.9-26.6% | same sources |
| Intercity corridors | Austin-San Antonio "FRA Corridor ID Step 1 award ($500k)"; Phoenix-Tucson leads MAG and PAG; route lengths 74, 120, 173 | Austin-San Antonio: not confirmed (no such selection in the FY22 list); Phoenix-Tucson: ADOT sponsor, Step 1; lengths removed; Front Range and Brightline FY22 selections added | FRA FY22 selection PDF |
| Austin and Chicago pipeline status | "pre-construction; ROD Jan 2026 (Wikipedia)"; adopted 2020 / 2024; Chicago FFGA unconfirmed | Austin: New Starts Project Development, LPA June 2023; Chicago: FFGA January 2025, $5,750M, revenue service August 2031 | FTA project profiles |
| 2 Los Angeles sites | parking lot (OSM polygon) and shopping center taken as parcels | one flagged unconfirmed (kind, acres), one noted | other branch's live parcel check, not re-run (no coordinates) |

Checked and found correct on this base (other branch wrong or stale): Texas homestead $140,000 and 3-year reappraisal,
Colorado commercial ratio 25%, Ohio 6-year cycle, Utah ratio 1.0, Maryland 10% credit, Nevada tax-bill cap; the Austin HOME
ordinance numbers; the Ogden crosswalk $218; solar premium authors; the High Line and Cleveland HealthLine ITDP figures.

The carried-over `research/research_verification.csv`, `research/laws_verification.csv` and `research/url_checks.csv` were
deleted (content captured in the comparison file); `research/sites_verification.csv`, `research/transit_verification.csv`
(a unit test reads it) and `research/leftover_claims.md` were kept, with the reasons in the comparison file.

Tests: `tests/unit/statuteCorrections1119.test.ts` and `tests/unit/studyCorrections1119.test.ts` (new); the flag
`everglades_or_wekiva_or_trpa` was renamed `wekiva_or_everglades_protection_area` in `app/app.js`, `parcelHouseAuditor.js`,
the types and two tests.

Live checks (19 Nov 2026, `scripts/live_check_panels.mjs`, LIVE_PORT 8971, 2 parcels each, results in
`data/backtests/live_check_panels_2026-11-19_evidence.json`): Los Angeles County CA 2/2, Maricopa AZ 2/2 and Miami-Dade FL 2/2
parcels with every panel ok (the housing-laws panel lists the state's records). On the real page the changed engine
returns, for a Miami-Dade residential lot, "Not on file ... zoning as commercial, industrial or mixed use, or who owns the
parcel" for Live Local, applies it when the parcel is flagged as public or religious-institution land, and for a
Contra Costa parcel 0.2 mi from heavy rail reports "whether this county is an urban transit county (more than 15
passenger rail stations)" for SB 79.
### Correction: a FEMA query that failed was shown as "no flood map here" (found and fixed 19 Nov)

- Found by the live check of the new Maryland counties (`audit/small-counties-maryland.md`). At Kent County MD
  240299504002 (39.179226, -76.130445) and Garrett County MD 240230007004 the house panel said "FEMA flood zone: Not
  available (No effective FEMA flood map here (unmapped, not 'no risk'))"; FEMA's National Flood Hazard Layer
  (`hazards.fema.gov/.../NFHL/MapServer/28/query`) returns Zone X at both points.
- Cause: the page's shared FEMA query (`sharedFemaNfhlQuery`, app/app.js) returns `{ ok: false, v: [] }` when FEMA does
  not answer (here an error reply without a CORS header), and `app/facts.js` read that as an answer with no flood map.
  The failed query was also kept for the session, so clicking again gave the same wrong row. This applied in every
  county.
- Fix: a failed shared query is now a failed request ("Not available (FEMA did not answer ...)" or "... the service did
  not answer in time"), and a failed query is dropped from the cache so the next click asks FEMA again. Re-run on the
  same points: Kent 240299504002 now matches (Zone X); the Garrett point at 240230006013 first timed out at the page's
  6 s limit and said so, and re-checked alone showed Zone AE as FEMA does
  (`data/backtests/live_check_panels_2026-11-19_mdsmall.json`).

### Correction: county builds stopped at the OpenStreetMap step (found and fixed 19 Nov)

- `pipeline/osm_extract.py` still tested `BOX` after commit 835f341 (18 Nov, the antimeridian split for Aleutians West)
  renamed it `BOXES`, so every county that clips a state or regional extract stopped with `NameError: name 'BOX' is not
  defined` before writing anything. Three references corrected. No published file was affected: no county had been
  built with the broken code.

### Found 19 Nov 2026 (not fixed here): LA lots in a mapped zone reach the legal screen with no zoning code

While checking the advisor's no-AI answers on the real page (2107 Duxbury Cir, Los Angeles, opened through
`houseAt`), the house panel's Zoning row showed **R1V2-O** (LA's parcel zoning layer), while the same panel's owner
playbook said "Zoning is not on file for this parcel, so no housing-law strategies can be screened" and the Invest
view's "This house" gave every addition "Not determined: zoning code unknown". Cause: `computePropertyPlaybook`
(app/app.js, `zRule.zone`) and `parcelFacts` (app/invest.js, `zr.zone`) read a `zone` field from the row
`zoneRules()` returns, and those rows (`zone_rules` in the LA bundle, 14 rows) have no `zone` field, so the code is
always dropped when a rule matches. Old behaviour: no state law is tested for such LA lots. Correct behaviour: pass
`zoneAt(ll).zone` (the code the Zoning row shows). Left for the owner or the agent working on the house panel,
because it changes which laws apply to every LA lot and needs the lot-fit live check. Until then the advisor's
ADU and lot-split answers for such lots say that the Zoning row shows a code the legal screen did not receive.
### Planned-rail corridors: the three Phoenix, Front Range and Brightline West station lists replaced (19 Nov 2026)

- **Old -> real.** `app/data/intercity_transit_corridors.json` listed stations that no document named (for example Phoenix
  Tempe/Chandler/Coolidge/Marana as Phoenix-Tucson stations, city centres from OpenStreetMap labelled as stations). It now lists,
  for each of the 69 FRA FY22 Corridor ID selections, only the cities the FRA text names, with the sentence quoted. Phoenix-Tucson:
  Phoenix, Buckeye, Tucson. Brightline West: Rancho Cucamonga, Hesperia, Victorville, Las Vegas (FRA) and Apple Valley (the
  sponsor's pages; its "Victor Valley Station" is "Situated in Apple Valley", so Victorville and Apple Valley disagree between
  documents and both are listed). Each stop sits at the Census internal point of the city, not at a station; the county is the
  one containing that point (a city can reach into other counties; New York City's point is in Kings County).
- **Sources.** FRA "FY22 Corridor Identification and Development Program Selections": text read on 18 Nov from an archived copy
  (railroads.dot.gov returns 403); count checked against Amtrak's release of 2023-12-08 (4 + 65 = 69). Numbers appear only
  with a quote: Brightline West 218 miles / 200 mph / about 2 hours (sponsor pages), Dallas-Houston about 240 miles and 205 mph
  (Amtrak, 2023-08-09), Scranton-New York about 2 h 50 min and 110 mph on one segment (Amtrak, 2023-03-22). Status is the
  document's own words; Cascadia's WSDOT page says its plan "will not: Select a preferred route. Identify station
  locations." California High-Speed Rail's and Texas Central's current status were not obtained.
- **Leads from the earlier branch (4e76a8a).** Held up in the FRA text: Phoenix-Tucson, Front Range, Brightline West, Cascadia
  (Seattle, Portland, Eugene), Houston to San Antonio (Rosenberg, Flatonia, Seguin). Did not hold: Austin-San Antonio (in no
  fetched document; kept as unconfirmed).
- **Test fixed.** `tests/unit/studyCorrections1119.test.ts` expected the lead agency "Arizona Department of Transportation
  (ADOT)"; the FRA text has no acronym, so it now expects the name as written.
- **Not obtained:** Amtrak's Corridor Vision report, the FRA Long-Distance Service Study report, hsr.ca.gov status pages, TxDOT
  rail pages (see `WORK-QUEUE.md`). No corridor was built from Amtrak's vision or the long-distance study.
- Live check (19 Nov 2026, `scripts/live_check_corridors.mjs`, LIVE_PORT 9061): Guadalupe TX (Seguin, 10 neighborhoods),
  Larimer CO (Fort Collins, 21) and Rowan NC (Salisbury, 11, on two corridors) match Census TIGERweb block groups within 1 mile;
  `data/backtests/live_check_corridors_2026-11-19.json`.
### Correction: LA lots in a mapped zone reached the legal screen with no zoning code (found 19 Nov, fixed 20 Nov 2026)

- What was wrong: for a Los Angeles lot inside a mapped zone with a matching `zone_rules` row, the house panel's Zoning
  row showed the zone (from `zoneAt(ll)`), but the owner playbook said "Zoning is not on file for this parcel" and the
  Invest view's "This house" said "Not determined: zoning code unknown" for every addition. Example: 2107 Duxbury Cir,
  Los Angeles (zone R1V2-O).
- Cause: `computePropertyPlaybook` (`app/app.js`) and `parcelFacts` (`app/invest.js`) read a `zone` field from the row
  `zoneRules()` returns. The 14 `zone_rules` rows in `app/data/bundle-la.b64.txt` have no `zone` field (they hold
  `zone_prefix` and the standards), so the code was dropped exactly when a rule matched.
- Fix: both now take the code from `zoneAt(ll).zone`, the same value the Zoning row shows, and fall back to the parcel
  record's `ZoneCode`. The rule row is no longer read for the code.
- Second fault found while checking the fix: with the code restored, the single-family test still failed for LA's R1
  variation zones. `R1V2-O` has no word boundary after `R1`, `R1R3` matched the multifamily pattern as `R3`, and LA's
  assessor use text for a house is "Single", which the text test does not match. Where the lot is in the county
  bundle's own zoning layer and that layer classes the zone as single-family, multifamily or commercial / mixed use,
  that category now decides; the text tests are kept for every other case (parcel-record zoning, and zones read from a
  live city service, whose category is a guess from the code). Counted from the bundle on 20 Nov: of 408 zone codes the
  layer classes single-family, the old text test on the code alone read 127 as single-family, 7 as multifamily (the six
  `R1R3` codes and `UR2`) and 274 as neither.
- Limit, stated plainly: the layer's single-family category also holds LA's agricultural and estate codes (for example
  `A1-1-K`, `RA-1`, `RE40-1-H-K`). Those lots are now screened against the state ADU law and SB 9 like any other lot the
  layer calls single-family. Whether SB 9 reaches each of those zones was not checked against the city's own text in
  this session; the cards already say "unverified screening; confirm eligibility with the planning department".
- Not on this branch: the earlier "found, not fixed" note for this fault and `app/advisor-scripts.js` (`answerLot`)
  are in none of the pushed branches (checked 20 Nov), so there was no entry to mark fixed and no sentence to remove.
  If that file lands from another branch, its sentence explaining this gap should be dropped.
- Seen on the real page (20 Nov, `scripts/live_check_la_zoning_screen.mjs`, LIVE_PORT 8953, result in
  `data/backtests/live_check_la_zoning_screen_2026-11-20.json`): 2107 Duxbury Cir, geocoded by the Census geocoder
  (matched "2107 DUXBURY CIR, LOS ANGELES, CA, 90034"), opened as parcel situs "2107 DUXBURY CIR LOS ANGELES CA 90034".
  Zoning row R1V2-O; owner playbook shows CA SB 9 "as applying to this parcel's recorded zoning (R1V2-O)" and "Also
  screened: CA: ADU and junior ADU approved ministerially on single-family lots"; "This house" shows "Backyard home
  (ADU) Allowed by state law".
- Other checks the same day: `npm test` 862 passed; `npm run typecheck` clean; `npm run test:e2e` 83 passed (one new
  test for an R1 variation lot with use "Single"); `scripts/live_check_panels.mjs 06037` (LIVE_PORT 8964, 3 lots, all
  rows ok, `data/backtests/live_check_panels_2026-11-20_lazone.json`); `scripts/live_check_lot_fit.mjs` (LIVE_PORT
  8965, all groups ok, `data/backtests/live_check_lot_fit_2026-11-20.json`).

### Correction: LA single-family screening followed the map's category, not each jurisdiction's SB 9 list; a failed flood check counted as "not in a flood area"; hazard-blocked lots were told "no law applies" (found and fixed 20 Nov 2026)

Follow-up to the correction above, after (1) the sources were fetched (`docs/audit/la_sb9_zone_scope.md`) and (2) 31
real lots across zone groups were opened on the real page (`scripts/live_check_la_zoning_screen.mjs --sample`).

- Too wide: the same day's fix let the zoning layer's "single-family" category decide. That category also holds
  County A-1 / A-2 and City parking variants (R1P, RAP, A2P). A lot is now classed single-family only where the layer
  says so AND the zone is on the jurisdiction's published list (`bundleZoneClass` in `app/app.js`):
  - City of Los Angeles, City Planning SB 9 memo: "which includes the following Zones: A, RA, RE, RS, R1, RU, RZ, and
    RW1 in Chapter 1 of the Zoning Code, as well as 1L Density Districts in Chapter 1A of the Zoning Code."
    (`https://planning.lacity.gov/odocument/bef6b998-de32-4090-9557-5f98711c6c15/SB9_Memo_2-7-22MG_-_signed.pdf`)
  - LA County Regional Planning SB 9 memo: "The project site is located within Zone R-1 or R-A"
    (`https://planning.lacounty.gov/wp-content/uploads/2026/01/SB9_MEMO.pdf`)
  - Santa Clarita (the layer's third jurisdiction): no list fetched, so the older text tests still apply there.
- Not confirmed, stated plainly:
  - The codified statute on leginfo.legislature.ca.gov could not be fetched (HTTP 403 challenge page); SB 9's text is
    quoted from the copy attached to the County memo. Gov. Code § 66314 (ADU) was not fetched verbatim.
  - The City memo names "R1" but not the variation zones. R1V, R1F, R1R and R1H are read as R1; that is this project's
    reading, not the memo's words.
  - The City lists "A" zones; HCD's SB 9 fact sheet says parcels in agricultural zones "are not subject to SB 9
    mandates even if they allow single-family residential uses"
    (`https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf`). The page follows
    the City's list for City lots; whether state law requires it there is not confirmed.
  - The state ADU law also reaches multifamily zones (per the sources in the audit file), but the engine applies its
    ADU record to single-family lots only. R2 / RD / R4 lots with a house are told the ADU law "was not applied"; that
    is true of the engine and is an open gap, not a finding that no ADU is allowed.
- Same misread elsewhere: the house panel's statutory notes (`auditSingleHouseParcel`, in `app/app.js` and
  `src/engines/parcelHouseAuditor.js`) used the old text tests; they now take the same class. The prospectus export
  passed an empty rule, no point and no hazard answers to the playbook; it now passes the open lot's.
- A failed flood check counted as "no": on 4 of the sampled single-family lots FEMA did not answer, and SB 9 was shown
  as applying. A site condition a law names (historic, flood, fire for SB 9) that was asked and not answered now makes
  that law "Not confirmed" with the reason ("whether the lot is in a FEMA special flood hazard area"); the playbook
  and the statutory notes show the not-confirmed laws next to the ones that apply
  (`evaluateByRightHousing`, both copies).
- "No state housing law applies" with no reason: the engine stops screening every law on a lot in a FEMA flood hazard
  area, a very high fire hazard severity zone, an agricultural preserve or public / tribal land. That is a rule of the
  engine, not something each law's record says (the California ADU record lists no site exclusions). Five sampled
  lots in very high fire zones got the bare sentence. The page now lists each law as "Not screened: the lot is in a
  very high fire hazard severity zone, and the screening engine stops there for every law (its own rule, not a finding
  about this law)". The rule itself is unchanged: whether to drop it and let each law's own exclusions decide is the
  owner's call (it would change results in every state) and is listed in `docs/WORK-QUEUE.md`.
- Seen on the real page (20 Nov, final code):
  - Sample, LIVE_PORT 8986 and 8987: 31 lots checked, 0 failed, 0 points skipped
    (`data/backtests/live_check_la_zoning_screen_2026-11-20_sample.json`). Long Beach, Glendale, Pasadena, Torrance
    and Burbank have no polygons in the layer and were not sampled.
  - 2107 Duxbury Cir, LIVE_PORT 8985: all checks ok (`data/backtests/live_check_la_zoning_screen_2026-11-20.json`).
  - `scripts/live_check_panels.mjs 06037 41051 48453`, LIVE_PORT 8988, 2 lots each: law rows ok on all 6; one
    unrelated failure, Travis block group 484530010004, where the check expected rent "$3,501/mo" and the page showed
    "$3,500 or more/mo" (`data/backtests/live_check_panels_2026-11-20_lazone2.json`). Not fixed here.
  - `scripts/live_check_lot_fit.mjs`: three runs. LIVE_PORT 8989: Portland 1 of 3, Gresham reason not shown; 8990:
    Portland 2 of 3, Gresham not shown; 8991: all groups ok. In the failing runs the panel said "the zoning map
    service didn't answer" while the same service answered 6 of 6 direct queries, the intermittent browser-path
    failure already noted in that script's header. The saved file is the passing third run.
- Tests the same day: `npm test` 863 passed; `npm run typecheck` clean; `npm run test:e2e` 83 passed. Two existing
  auditor tests assumed a lot split with no hazard answers given; they now supply the answers, and new assertions
  cover the unanswered and the blocked cases.

### Correction: the statute engine dropped every law on flood, fire, farmland and public-land lots; site conditions are now decided law by law from each law's text (found and fixed 20 Nov 2026)

- What was wrong: `evaluateByRightHousing` screened no law at all on a lot in a FEMA flood hazard area, a very high
  fire hazard zone, an agricultural preserve or public / tribal land, in every state. No law record said that. Earlier
  the same day the page was made to say this was the engine's own rule; the rule itself is now gone.
- What was checked: for all 39 parcel-level law records, the law's text was fetched and read for five site conditions
  (flood, fire, farmland, public / tribal land, historic). Evidence, with verbatim quotes and URLs:
  `docs/audit/site_exclusions/ca.json` (8 records, from the Legislature's own bulk files at
  `downloads.leginfo.legislature.ca.gov`, which answer where the web pages return 403), `west.json` (19 records),
  `east.json` (12 records) and `ca_notes.md`. `scripts/apply_site_exclusions.py` writes the results onto each record
  as `site_conditions` and refuses an exclusion without a quote and a URL. Counts written: 7 exclusions, 145 "text
  read, no such exclusion", 20 conditional, 23 not settled.
- The rule now (`evaluateByRightHousing`, identical in `app/app.js` and `src/engines/statutoryZoningEngine.js`):
  - the text excludes such a lot: the law is listed as "Ruled out here", with the reason and any exception in the text
    (SB 9 and AB 2011 for flood and fire; Colorado HB 24-1152 for a FEMA floodplain; Arizona adaptive reuse for
    historic areas);
  - the text was read and has no such exclusion: the law is screened as on any other lot (for example the California
    ADU law and AB 2097 in a very high fire zone);
  - the text excludes such land only on terms the page cannot see: the law is "Not confirmed", with those terms (for
    example Maine LD 2003 "only where the municipality has exempted the lot by ordinance"; Washington HB 1110 and
    HB 1337 "a local designation, not the FEMA map"; SB 79 in a fire zone "only from the optional streamlined
    ministerial approval, and where the city has excluded such sites by ordinance for now");
  - the text does not settle it, or could not be fetched (Minneapolis: Municode returned 403): "Not confirmed".
  The short "only ..." wordings and the exception wordings are this project's restatements of the evidence notes; they
  are listed in `scripts/apply_site_exclusions.py` next to the record and condition they describe.
- SB 79 was over-excluded: its records listed the fire zone as a site exclusion. § 65912.157 (the standards the page
  shows) has no such exclusion; the fire-zone bar is on the optional streamlined approval (§ 65912.159(a)(3)) and a
  city may exclude such sites for a time by ordinance (§ 65912.161(b)). It now reads "Not confirmed" there.
- California ADU law was applied to single-family lots only. Gov. Code § 66323(a): "a local agency shall ministerially
  approve an application for a building permit within a residential or mixed-use zone", and (a)(3)(B): "A local agency
  shall allow at least one accessory dwelling unit within an existing multifamily dwelling". The record now applies to
  single-family and multifamily zoning (`scripts/apply_ca_adu_zone_scope.py`). Not applied to commercial / mixed-use
  zoning (the page cannot tell whether such a lot has a dwelling); unit counts on multifamily lots are not modeled.
- Santa Clarita's SB 9 zones, from the city's SB 9 FAQ: "Parcels must be zoned NU1, NU2, NU3, NU4, NU5, UR1, or UR2."
  (`https://santaclarita.gov/home/showpublisheddocument/21438/637964290558900000`; PDF metadata dates it 2022; whether
  it is current after the 2025-2026 amendments is not confirmed).
- Still not confirmed:
  - whether LA's R1V / R1F / R1R / R1H and R1P are R1 zones in the municipal code (LAMC and City Planning pages
    returned 403); the variations are still read as R1 and R1P is still left out;
  - the § 65913.4 text in force on 16 Sep 2021 that SB 9 freezes (quoted from AB 1174 as chaptered that day);
  - farmland and land ownership are not measured by the page at all, so those exclusions never fire;
  - Colorado's current C.R.S. numbering (the signed 2024 acts were read); Minneapolis Title 20;
  - citation changes the research found and that are NOT yet applied to the records: Utah 10-9a-530 / 17-27a-526 now
    return no text (the research found 10-21-303 / 17-80-303); Arizona middle housing is now § 9-462.13.
- Seen on the real page (20 Nov, final code):
  - LA sample, LIVE_PORT 8995 / 8996 / 8997: 31 lots, 0 failed
    (`data/backtests/live_check_la_zoning_screen_2026-11-20_sample.json`). 14033 Barner Ave (RS-1, very high fire
    zone) now shows the ADU law as applying and SB 9 as ruled out with its exception; 436 W Gage Ave (R2-1, a house)
    and 10050 Sepulveda Blvd (R3-1, apartments) show the ADU law; 28871 Silversmith Dr (Santa Clarita UR2) is classed
    single-family. The County A-2 desert lot gets no single-family law and "This house" says its zoning is why.
  - 2107 Duxbury Cir, LIVE_PORT 8998: ok.
  - `scripts/live_check_panels.mjs 06037 53033 08031 41051`, LIVE_PORT 8999, 2 lots each: law rows ok on all 8; one
    Multnomah lot's USGS elevation timed out and the page said so
    (`data/backtests/live_check_panels_2026-11-20_sitecond.json`).
  - `scripts/live_check_lot_fit.mjs`, LIVE_PORT 9002: all groups ok.
  - The Travis rent failure noted above is fixed in the check: the page's "$N or more/mo" top-code wording is accepted
    when the file's value is at least N (`data/backtests/live_check_panels_2026-11-20_travisrent.json`).
- Tests: `npm test` 869 passed; `npm run typecheck` clean; `npm run test:e2e` 83 passed. Tests that asserted the old
  blanket stop were rewritten to the sourced behaviour; `tests/unit/statuteSiteConditions.test.ts` covers the rule.

### Correction: the live check expected a Census rent code as a dollar figure; the page called an exact $3,500 median "or more" (found 20 Nov, fixed 21 Nov 2026)

**What failed.** `scripts/live_check_panels.mjs` for Travis County TX (48453), 20 Nov, block group 484530010004
(saved in `data/backtests/live_check_panels_2026-11-20_lazone2.json` on branch `claude/upbeat-rubin-7orjxv`):
"expected home value $865k, rent $3,501/mo, homes 245 | panel: ... Median rent$3,500 or more/mo Census ACS 2020–24".

**What the sources say (all fetched 21 Nov 2026).**

- Census ACS jam values, <https://www2.census.gov/programs-surveys/acs/tech_docs/jam_values/2024_Jam_Values.xlsx>
  (sha256 `14a61938cff58166ef265af9a324b8a6f4cf6040f8630634e5711cb5b07e2cf5`), section "Median - Jam Values", row
  "Gross Rent", upper interval: meaning "$3,500 or more", character value (data.census.gov) "3,500+", numeric value
  (API and Summary File) "3501". Lower interval: "Less than $100", "100-", "99". The 2023 workbook in the same folder
  has the same row. Caveat: the title cell of the file named 2024 reads "Jam Value Specifications for the 2023
  American Community Survey"; it is the file Census publishes under the 2024 name.
- Census ACS 2020-24 5-year table file,
  <https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b25064.dat>
  (header `GEO_ID|B25064_E001|B25064_M001`): `1500000US484530010004|3501|-333333333` and
  `1500000US484530013092|3500|2500`.
- `counties/bundle_48453.json.gz` stores `rent: 3501.0` for 484530010004, the same as the Census file. Of its 766 block
  groups, 31 hold 3501 and one (484530013092) holds 3500.

**Who was wrong.**

1. The live check. It built its expected text as "$" + the stored number, so the code 3501 became "$3,501/mo". The page's
   "$3,500 or more/mo" for that block group was right. Fixed: the check now expects "$3,500 or more/mo" when the file
   holds exactly 3501 (`ACS_RENT_TOP`), and still formats every other rent itself, to the dollar.
2. The page, for a different value. `fmtRent` in `app/app.js` treated any rent of 3500 or above as the top-code, so
   block group 484530013092, where Census publishes an estimate of 3500 with a margin of 2500, was shown as
   "$3,500 or more/mo". Fixed: only 3501 and above is the top-code; 3500 is shown as "$3,500/mo". The unit test in
   `tests/unit/auditChecklist.test.ts` asserted the old behavior for 3500 and was changed to assert the new one.

**Seen on the real page (21 Nov, after the fix).** `LIVE_PORT=18611 LIVE_N=2 node scripts/live_check_panels.mjs 48453`:
both parcels ok on every panel, 484530010004 "expected home value $865k, rent $3,500 or more/mo, homes 245"
(`data/backtests/live_check_panels_2026-11-21.json`). A separate read of the panel: 484530013092 shows
"Median rent$3,500/mo", 484530010004 shows "Median rent$3,500 or more/mo".

**Not changed, still open.** The page words the bottom code (99) as "$100 or less/mo" where Census says "Less than $100";
no block group in the Travis County file holds it, and the live check would report it as a failure if one were sampled.
Other counties' files were not searched for a stored 3500. The places that leave a top-coded rent out of a calculation
(`m.rent < 3500` in `app/app.js`) were left as they are, so an exact 3500 is also left out there.

### Correction: state finance profiles held numbers no source gave; 28 values corrected or withheld in 21 states (found and fixed 21 Nov 2026)

**What was wrong.** 22 profiles in `app/data/state_finance_profiles.json` had never been checked, Illinois could not be
checked on 16 Nov, and the four "verified" profiles (AZ, CA, TX, WA) had a quote on file for only some of the fields the
tax-increment model uses. Round 4 fetched the state's own statute or revenue-department page for each field and stored
the verbatim quote, URL and date with the field (`field_evidence`). Every quote was checked word for word against the
fetched page text before it was written. Full table, sources and hosts: `docs/audit/state-finance-profiles-2026-11-21.md`;
per-field evidence: `docs/audit/state-finance-profiles-2026-11-21.json`.

**Corrections (old -> new, all sources fetched 21 Nov 2026).**

- AL `annual_assessment_cap` null -> 0.07: ALDOR, "New rules will cap annual increases in taxable assessed value for
  Class II and Class III real properties at 7 percent." (HB73, Act 2024-344).
- AK `homestead_exemption_rule` $50,000 of market value -> none: AS 29.45.050(a) allows only a voter-approved municipal
  exemption that "may not exceed the assessed value of $75,000"; $50,000 appears nowhere.
- AR `reassessment_cycle_years` 3 -> 4: ACD 2025 annual report, "all counties will now reappraise real property on
  four-year cycles" (Act 139 of 2023).
- DC `homestead_exemption_rule` $87,500 -> $95,100 (tax year 2027): OTR, "reduces your real property's assessed value by
  $95,100.00 for tax year 2027".
- FL `homestead_exemption_rule` $50,000 -> unknown: DOR bulletin PTO 26-21 (5 Nov 2026), Amendment 3 approved 3 Nov 2026
  exempts "assessed value up to $150,000 in 2027 and up to $250,000 in 2028" for non-school taxes. The unit test that
  required every FL field to be confirmed (round 3) now requires exactly this field to be withheld.
- GA `homestead_exemption_rule` $10,000 -> $2,000 of assessed value: Georgia DOR, "The $2,000 is deducted from the 40%
  assessed value of the homestead."
- IL `reassessment_cycle_years` 3 -> 4 and `homestead_exemption_rule` $10,000 -> $6,000: IDOR, "Every four years when all
  property is reassessed (three years in Cook County)" and "up to a maximum of $10,000 in Cook County, $8,000 in counties
  contiguous to Cook County, and $6,000 in all other counties". The record mixed Cook County's cycle and exemption with
  the 33 1/3% ratio used outside Cook; it now describes counties outside Cook and says so on the page (`scope_note`).
- IN `homestead_exemption_rule` "1% circuit breaker" -> unknown: the circuit breaker limits the bill; the DLGF form gives a
  standard deduction of "$40,000" for 2026 falling to "$0" in 2030 plus a supplemental percentage, which the model cannot
  represent.
- MA `reassessment_cycle_years` 3 -> 1: G.L. c. 59, s. 2A, fair cash valuation "on the first day of January of each year".
- ME `res_assessment_ratio` 1 -> unknown (36 M.R.S. s. 327: each town's ratio, at least 70%, not above 110%) and
  `homestead_exemption_rule` $25,000 of assessed value -> $25,000 of just value (36 M.R.S. s. 683).
- NJ ratios 0.85 -> 1 ("All 21 counties in New Jersey have chosen 100%") and cycle 3 -> unknown (no fixed cycle).
- NY ratios 1 -> unknown: ORPTS, the law "doesn't require assessments to be at 100 percent of market value".
- OH `homestead_exemption_rule` $25,000 of assessed value -> unknown: R.C. 323.152 gives "Twenty-five thousand dollars of
  the true value" to owners 65 and older, disabled owners and qualifying surviving spouses only.
- OK `uncaps_on_sale` false -> true: OAC 710:10-1-3 (LII copy), the limits "do not apply in any year when the title of the
  property is transferred".
- PA ratios 1 -> unknown: 53 Pa.C.S. s. 8842(a), a county "predetermined ratio which may not exceed 100%".
- RI `res_assessment_ratio` 1 -> unknown: R.I.G.L. 44-5-12, "or at a uniform percentage thereof, not to exceed one
  hundred percent".
- SC `uncaps_on_sale` false -> true: S.C. Code 12-37-3140(A)(1)(b), value as of "December thirty-first of the year in
  which an assessable transfer of interest has occurred".
- VA `reassessment_cycle_years` 1 -> 4: Va. Code 58.1-3252, "every four years" in counties (3, 5 or 6 by option).
- VT `reassessment_cycle_years` 3 -> 6: Department of Taxes, "required to reappraise every six years as of January 2025".
- WI `reassessment_cycle_years` 1 -> 5: DOR PB-060, "within 10% of full value in the same year, at least once within a
  five-year period".
- WY `annual_assessment_cap` null -> 0.04 and `homestead_exemption_rule` none -> 25% of market value (first $1,000,000):
  W.S. 39-11-105(a)(xliii) exempts a home's assessed value "in excess of the prior year assessed value ... plus four percent
  (4%)", and (a)(xlvi) exempts "twenty-five percent (25%) of the fair market value" of a single-family home and its land.
- LA `source_url` pointed at Constitution art. VII s. 11 (Budgets); it now points at s. 18.
- OR's homestead rule and CO's null cap had been counted as confirmed with no quote on file; both are now listed as not
  confirmed.

**Result.** verified 4 -> 11 (AK, AL, AZ, CA, DC, KY, LA, NM, TX, WA, WY); partly verified 25 -> 36; could not check 1 -> 2
(NH, PR: no official host answered); unverified 22 -> 3 (IN, NY, PA: checked, nothing could be confirmed).
New unit test (`tests/unit/financeProfiles.test.ts`): every tax-increment field counted as confirmed must carry a quote
and an https source URL, and a verified profile may list no unverified field.

**Seen on the real page.** A short Playwright script served this branch on port 9324 (county-file requests to R2 were
answered from `counties/`, so none reached R2) and read the tax-increment section and methods panel for Jefferson AL,
DC, Essex NJ and Cook IL (`data/backtests/live_check_finance_profiles_2026-11-21.json`). It caught Cook County being shown
the downstate 33.3% ratio once Illinois's ratio was confirmed; the profile's new `scope_note` is now printed in both
places and the rerun shows it.

**Not done.** 8 partly verified profiles (ID, MN, MO, MT, ND, SD, UT, WV) were not re-checked. Fields stored
as "no cap" or "no homestead exemption" were confirmed only where a source said so; most such fields stay listed as not
confirmed. The advisor (Cloudflare Worker) does not read these profiles.
