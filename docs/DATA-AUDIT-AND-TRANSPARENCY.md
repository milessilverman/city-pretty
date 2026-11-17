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
| HUD Fair Market Rents (`hud_fair_market_rents.json`) | 3,222 counties | 9 (Federal Register revised values) | 3,213 (HUD's values; fiscal year unconfirmed) | | | 46 hand-typed rows replaced; LA and 6 other areas corrected to HUD's May-2026 revision (round 3) | `scripts/fetch_hud_fmr.py` |
| Research studies (`research.json`) | 39 | 8 | 21 | 3 | 7 (source link broken) | 13 nonexistent studies; all "$ per $1" figures; HealthLine figures corrected (round 3) | `audit/research-audit.md` |
| Case studies (`case_studies.json`) | 8 | | 5 | 1 | 2 (source link broken) | all unsourced money figures nulled; HealthLine and Cultural Trail figures re-sourced (round 3) | `audit/research-audit.md` |
| State housing laws (`statutes.json`) | 21 | 15 | 4 | 1 | 1 (Minneapolis 2040: cited law not confirmed) | 1 (a bill that never passed); 18 corrected | `audit/laws-finance-audit.md` |
| State finance profiles (`state_finance_profiles.json`) | 52 | 4 (TX, AZ, WA, CA; FL has all 5 calculator fields too) | 25 | 1 | 22 | round 3: TX homestead $100,000 -> $140,000, TX reappraisal 1 -> 3 years, CO homestead 'none' -> unknown | `audit/laws-finance-audit.md` |
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
- **Florida's just value** is as of 1 January (s. 192.042, F.S.) but certified later in 2026.
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
- **HUD Fair Market Rents are not current (round 3).** FY2027 rents took effect 1 Oct 2026 (Federal Register
  2026-17891) and HUD's map service doesn't have them; the file holds FY2026. Checked against the Federal Register,
  the service's values match no earlier year's published revisions and are consistent with FY2026 as first
  published, but the service never applied HUD's own May-2026 revision for seven areas (2026-07741): Los Angeles'
  2-bedroom FMR is $2,903 in the notice and $2,601 in the service. Those seven areas now use the notice's values.
  Next: pull FY2027 from huduser.gov (blocked from the build machine) or the HUD API (free token).
- **Correction (later on 16 Nov):** this list said 7 of 150 live parcel/zoning services were dead. That was wrong:
  all 7 answered when re-checked; county servers drop requests under load. Tiers now count configured services, and
  each county lists services that failed three retries at build time (`live_services.not_responding`; 6 on the last
  build, including New York State's parcel service, which reported "not started").
- OpenStreetMap lookups through Overpass are untested against the live service (unreachable from the build machine).
