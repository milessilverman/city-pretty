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
- **Tree canopy** comes from the 2021 Tree Equity release on 2010 block groups but was labeled "current". Relabeled; a
  2025 release exists.
Not checked: parks (OpenStreetMap's query service is unreachable from the audit machine).

### Crash counts (rebuilt 16 Nov: `app/data/crash_counts/<county>.json`)

California: all counties except San Francisco rebuilt from CCRS with the boundary rule below
(`scripts/build_crash_counts_ca.py`). The share of crashes with coordinates ranges from 51% (Sutter) to 100%, 74% in
LA. San Francisco's CCRS crashes are only 34% geocoded, so it keeps its DataSF injury-crash source for now (not yet
rebuilt with the boundary rule). **Outside California: 94 counties** in Illinois (2023–25), Virginia (2023–25),
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

### Safety comparisons recomputed (16 Nov, `audit/crash-rankings.md`)

The "worse than X% of similar areas" comparisons and crash-dependent recommendations (traffic calming, crosswalks,
signals, slow streets, bike lanes, lighting) are recomputed for all 151 counties with rebuilt crash counts
(`scripts/recompute_crash_gaps.py`), comparing only within one crash source. 49% of old pedestrian/cyclist gaps moved
more than 10 points; 2,169 traffic-calming rows were dropped (no pedestrian/cyclist crash in the 3-year window) and
1,594 added. In California and Illinois the pedestrian/cyclist count is a lower bound, so rows there are only added,
never dropped. San Francisco's comparison is withheld until its counts are rebuilt. The pipeline now uses the same
10 m boundary rule.

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
