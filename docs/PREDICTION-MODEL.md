# Neighborhood price prediction: method, results, limits

Job: `docs/PLAN-WEEK-2026-11-22.md` section 2. Data: `docs/audit/prediction-signals-2026-11-22.md` (tables in `data/signals/`).
Code: `scripts/predict/`. Output: `app/data/neighborhood_prediction.json` and `app/data/prediction/<fips>.json`.

## Part A. Pre-registered method (written and committed 22 Nov 2026, before any evaluation was run)

Nothing in Part A may change after the first evaluation run except by a dated note in Part A.10 that explains the deviation.

### A.1 Question and sample

Do leading signals (mortgage applications, loan sizes, investor buying, permits, jobs, migration) rank Census tracts by
their **future house-price change relative to their own county** better than (a) "pick the cheapest tracts" and (b)
"pick the tracts that rose most", out of sample in time?

- Sample: the 50 counties of the existing back-test (`app/data/neighborhood_score_backtest.json` -> `sample.county_list`).
- Unit: 2020 Census tract (the FHFA outcome's codes). Every input on 2010 tract codes is moved to 2020 tracts with the
  Census relationship file (`xwalk_tract10_tract20.csv.gz`): counts split by `w10to20`, rates and levels averaged by
  `w20from10` (loaders `count_to_tract20`, `level_to_tract20`).
- A tract is in an evaluation cell (origin x county) if it has an FHFA index value at both ends of the outcome window.
  A cell needs at least 20 tracts.

### A.2 Targets

- **Primary: 5-year county-relative change.** y = ln(HPI[T+5] / HPI[T]) for the tract minus the median of the same
  quantity over all tracts of the county that have both values (all FHFA tracts in the county, not only sample tracts).
- Secondary: the same over 3 years (T+3).
- Metro-relative variant: the same change minus the median over all FHFA tracts in the tract's CBSA (Census CBSA
  delineation file, July 2023). Reported, not used for the decision.
- Binary: whether the tract ends in the top third of its county on y. Scored as the hit rate of the "top third" call:
  of the tracts a method puts in its county's top third, the share that realised a top-third outcome (no skill = 33.3%).

### A.3 Timing and as-of rules

Origin T means a decision taken on 31 December of year T, buying at the year-T price level. A value for data year t is
usable at origin T only if it was published by then. Publication rules (from file dates in the signals audit page):

| Source | Data year t usable at origin T when | Reason |
|---|---|---|
| FHFA tract / county annual index | t <= T-1 | year t is published in spring t+1 (2025 file "Last updated: March 31, 2026") |
| HMDA (2012-2017 and 2018-2025 files) | t <= T-1 | annual data published after the year |
| Building Permits Survey, annual files | t <= T-1 | annual 2024 file posted 1 May 2025; annual files are the revised totals |
| LEHD LODES8 | t <= T-2 | 2024 posted 14 Oct 2026, about 21-23 months after year end |
| IRS county migration (year_end = second year of the pair) | t <= T-2 | pair 2324 (year_end 2024) posted 19 Nov 2026 |
| ACS 5-year ending year E | E <= T-1 | released in December E+1 |
| Zillow ZHVI monthly (internal variant only) | month <= November of T | published about mid-month after |

Geography files (2020 tracts, the 2010-2020 relationship file, 2020 block assignment files, 2020 Gazetteer, 2023 CBSA
delineation) are used for every origin although they were published 2021-2023. They describe boundaries, not prices;
this is stated as an exception.

Known leaks that cannot be removed and are stated with every result: FHFA history is one revised vintage (March 2026);
LODES 2010-2021 were re-created in 2023; HMDA is the current public file.

The outcome starts at HPI[T] while price features end at HPI[T-1], so features and outcome share no index value (this
also avoids the artificial mean reversion that a shared noisy year would create).

Code rule: every feature reads data only through an as-of guard (`scripts/predict/asof.py`) that raises if a value
published after T is requested; a unit test builds every origin's features and fails if any read is after T, and a
second test plants extreme values in every post-T year and checks that no feature changes.

### A.4 Origins

Features exist from T = 2014 (HMDA growth needs 2012 and 2013; LODES growth needs 2010 and 2012).
- 5-year: origins T = 2014 ... 2020 (outcome to 2025).
- 3-year: origins T = 2014 ... 2022.
- A fitted model predicting from T is trained only on origins S with S + h <= T (outcome fully known by T, so the
  training windows never overlap the evaluation window). Hence fitted-model test origins are 2019 and 2020 for 5 years
  and 2017 ... 2022 for 3 years. Baselines need no fitting and are also reported for every origin.
- Current prediction: origin T = 2026 (inputs up to 2025, LODES and IRS up to 2024; all published by 22 Nov 2026),
  model fitted on all 5-year origins 2014 ... 2020.

### A.5 Features (each a within-county percentile rank at origin T, centred to -0.5 ... +0.5; a missing value gets 0, the county middle)

| # | Feature | Definition (as of T) | Why it should lead prices |
|---|---|---|---|
| 1 | value_acs | ln ACS median home value, latest 5-year vintage released by T (2010-14 for T 2015-19; 2015-19 from T 2020; none for T 2014) | cheap-for-the-county catch-up (the existing back-test's finding) |
| 2 | loan_level | ln median HMDA home-purchase loan amount, year T-1 | the same, from this year's buyers |
| 3 | trend_1y | ln HPI[T-1]/HPI[T-2] | short momentum |
| 4 | trend_3y | ln HPI[T-1]/HPI[T-4] | medium momentum or reversal |
| 5 | trend_5y | ln HPI[T-1]/HPI[T-6] | long momentum or reversal |
| 6 | app_growth | ln((apps[T-1]+5)/(apps[T-2]+5)), home-purchase applications (actions 1-5) | buyers arriving before prices show it |
| 7 | loan_growth | ln(median loan[T-1]/median loan[T-2]) | buyers paying more, ahead of the repeat-sales index |
| 8 | nonowner_share | originations not owner-occupied / originations, T-1 (2012-17 code 2; 2018+ second home + investor, the same definition) | investor and second-home demand |
| 9 | nonowner_change | nonowner_share[T-1] - nonowner_share[T-2] | investors moving in or out |
| 10 | denial_rate | denied / (originated + approved not accepted + denied), T-1 | weaker applicant credit, weaker demand |
| 11 | buyer_income_ratio | HMDA median applicant income (T-1) / ACS median household income (vintage as in 1) | richer buyers than residents: neighbourhood change |
| 12 | permits_place | housing units authorised in years T-3..T-1 in the tract's permit-issuing jurisdiction / homes in that jurisdiction (ACS vintage as in 1) | supply coming, and builders' bets on the area |
| 13 | jobs_tract | ln((jobs[T-2]+10)/(jobs[T-4]+10)), LODES jobs located in the tract | job growth on the spot |
| 14 | jobs_5km | the same for all jobs in tracts whose centre is within 5 km of the tract's centre | job growth within reach |
| 15 | rent_to_value | 12 x ACS median rent / ACS median value (vintage as in 1) | high yield for the price (supported in the existing back-test) |
| 16 | vacancy | ACS vacant / all housing units (vintage as in 1) | emptying or filling up (free substitute for HUD vacancy, which needs an account) |

Metro-relative variant only (constant within a county, so useless for within-county ranking): county permits per home
(T-3..T-1), county net migration rate (IRS returns, year_end T-2: (in - out) / non-migrant returns), county 5-year
FHFA trend minus the CBSA median county trend.

Jurisdiction for feature 12: each 2020 block's incorporated place from the 2020 block assignment file, else its county
subdivision matched by name to the permit file (township states), else the county's unincorporated row; the tract takes
the jurisdiction holding most of its blocks. Not used: county-level permits and migration in the county-relative model
(constant within county), the 2018+-only investor share (at most two training origins), Zillow (terms unconfirmed).

### A.6 Models (simplest first)

- **No skill**: predicted relative change 0 for every tract (county median). Its 80% interval is the 10th-90th
  percentile of past realised relative changes in the training origins.
- **Cheapest**: rank by -value_acs; where no ACS vintage is published (T = 2014) by -loan_level.
- **Prior trend**: rank by trend_5y.
- **Ridge (primary candidate)**: least squares on the 16 centred ranks, outcome winsorised at the 1st/99th percentile of
  its cell for fitting only, penalty lambda x n x |w|^2. Lambda from {0.001, 0.01, 0.1, 1} by nested walk-forward inside the
  training window (inner validation origins V in the training set that have at least one training origin S <= V - h;
  criterion: mean within-cell Spearman). With no inner fold (every 5-year origin, early 3-year origins) the default
  lambda 0.01 is used.
- **Boosted trees (secondary)**: numpy histogram gradient boosting, squared loss, depth 3, learning rate 0.05, 16 bins per
  rank feature, minimum 50 rows per leaf, 80% row subsample, seeded; number of trees from {50, 150, 300} by the same
  nested rule (default 150). Reported only. It cannot be shipped in this round: choosing between two models on the
  same test folds would need a fresh hold-out.
- **Ablation**: the ridge without the price-level features (1, 2 and 15) to show whether any edge is more than mean reversion.
- **Internal only**: the ridge plus a Zillow ZIP feature (ln ZHVI Nov T / Nov T-1, ZCTA area-weighted to tracts).
  Aggregate skill only is reported; nothing from it is shipped or displayed.

Predicted 80% range = point prediction + 10th and 90th percentiles of the model's past errors: errors from inner
walk-forward predictions inside the training window if any exist, else the training fit's own errors (stated).

### A.7 Metrics (computed per origin x county cell on the raw, not winsorised, relative change)

- Spearman rank correlation of prediction and outcome.
- Top-minus-bottom quintile spread: mean y of the top fifth by prediction minus the bottom fifth, in points (100 x log
  change; close to percentage points for these sizes).
- Hit rate of the top-third call (A.2).
- Coverage of the 80% range (share of outcomes inside it; target 80%), for ridge and no skill.
- Uncertainty: 2,000 bootstrap draws resampling counties (all of a county's cells together), seeded; 90% intervals.
- Paired comparison: per cell, model minus baseline on each metric; mean over cells with its county-bootstrap 90%
  interval and the share of draws at or below zero.
- Reported by origin, pooled over origins, and by county.
- Single-signal table: each feature's own within-cell Spearman over all origins (no fitting), county bootstrap. The
  "strongest signal" is the one with the largest absolute pooled mean Spearman whose sign is the same in at least
  three quarters of origins.

### A.8 Robustness (reported whatever it shows)

1. Excluding 2020-2022 origins.
2. Tracts that still have an FHFA value in 2025 (survivors of the post-2020 thinning) vs all tracts, on cells whose
   outcome ends by 2021 (where both sets exist).
3. Tracts whose 2010 and 2020 codes are the same with at least 95% of land shared both ways ("stable") vs tracts that
   were converted through the relationship file.
4. Ridge without the price-level features (A.6 ablation).
5. Metro-relative target.

### A.9 Decision rule (applied to the ridge, 5-year county-relative target, test origins 2019-2020)

The ridge prediction is used for a county only if BOTH:
1. pooled over all test cells, its quintile spread beats the cheapest baseline AND the prior-trend baseline, each paired
   difference having a 90% county-bootstrap interval above zero; AND
2. in that county's own test cells, its mean quintile spread is not below either baseline's.

If (1) fails, the model is not used anywhere: every county keeps the current relative-value screen, and the output says
the new model was tested and did not beat the baselines. If (1) holds and (2) fails for a county, that county keeps the
baseline and says so.

### A.10 Deviations (dated notes only)

- 22 Nov 2026, after the first run (no change to Part A.1-A.9): **added** a table of realised relative change by the cheapest
  baseline's home-value fifth (10th, 50th, 90th percentile, pooled over all 5-year origins 2014-2020, by origin and by county) and an
  out-of-time coverage check of those ranges (ranges from windows S <= T - 5 applied at T = 2019, 2020). Reason: the model failed the
  rule, so the shipped prediction is the baseline, and the page needs the baseline's own tested range and hit rate. It was not used for
  any decision.
- 22 Nov 2026, implementation details not spelled out in A.5 (fixed before the first run): blocks of Indianapolis city (balance), place
  code 36003, are matched to the permit file's Indianapolis, 36000; LODES state-years that were never published (Alaska 2017-2024,
  Michigan 2022-2024) are missing, not zero; tracts within 5 km are searched among the 2020 tracts of the sample counties' states only
  (so Kentucky tracts near Hamilton County, OH are not counted); metro-relative cells are the sample tracts of each CBSA (33 CBSAs).
- Runs: the walk-forward ran twice on 22 Nov 2026: the first produced every pre-registered result; the second only added the fifth
  table above (seeded, so every other number is identical). Nothing was tuned between runs.

## Part B. Results (22 Nov 2026)

### What the test found, in plain words

1. **The leading signals do not beat "pick the cheapest tracts".** Over 5 years (test windows starting 2019 and 2020) the model's top
   fifth of tracts beat its bottom fifth by about the same margin as the cheapest fifth beat the dearest; the paired difference is not
   distinguishable from zero (B.1). The same holds over 3 years (B.3), and without the 2020-2022 origins (robustness lists). By the
   pre-written rule, **no county uses the model**. Every county keeps the relative-value screen.
2. **Both beat the prior-trend baseline** clearly. Past price momentum is a poor guide to the next 5 years within a county.
3. **It is mean reversion.** Taking out the price-level inputs leaves a much smaller edge, well below the cheapest baseline. The new
   signals carry a little information of their own (the model without price levels beats prior trend over 3 years), but nothing that adds
   to the price level.
4. **The strongest single signal is the price level** (Census median home value, and the same thing from mortgage loan sizes). The
   strongest of the new signals is the **mortgage denial rate** (higher denial rate, more later gain), which points the same way in every
   origin; it is itself a marker of cheaper, lower-income tracts. Job growth, investor buying changes and permit counts add nothing useful
   within a county (permits point slightly the other way: tracts in towns that issued more permits per home gained less).
5. **The cheap-tract edge is fading.** The cheapest fifth's median 5-year gain over its county's median tract fell from about 10 points
   (windows starting 2015-2016) to about 2 (starting 2020), and over 3 years it was near zero or reversed for windows starting 2021-2022
   (B.2-B.3 fifth tables).
6. **The stated 80% ranges are too narrow**: about three quarters of outcomes fell inside (model and screen alike), and less in the most
   recent windows. The page says so.
7. **Robustness does not change the verdict**: the same answer for stable vs converted tracts, for tracts that survive FHFA's post-2020
   thinning, for the metro-relative target and for boosted trees. Two results are worse for the model: over 3 years without the 2020-2022
   origins, and over 3 years on the metro-relative target, it did slightly but measurably worse than the cheapest baseline. One is better:
   the internal Zillow variant (ZIP home-value change, terms unconfirmed, not shipped) was a fraction of a point above the cheapest
   baseline over 3 years with an interval just above zero, and not distinguishable from it over 5 years. That is too small, and too close
   to a multiple-testing accident, to act on; it is worth re-testing once Zillow's terms are confirmed.

### What it can and cannot say

- **Can:** within one of the 50 large counties, a tract that is cheap for its county has tended to gain more than the county's median
  tract over the next 3-5 years, by a margin that has shrunk; the page shows the tested range for each home-value fifth and how often
  "cheapest third" found a top-third gainer in that county.
- **Cannot:** forecast a county-wide rise or fall; pick winners beyond cheapness; say anything about rents or cash flow; vouch for a
  single tract (the ranges are wide and were too narrow in the test); say what was knowable at the time for FHFA and LODES history (both
  are today's revised series); cover new-build areas well (FHFA publishes fewer tracts after 2020).
- **What to tell an investor:** treat it as a screen for "cheap for its area", useful to narrow a search, with a measured edge that has
  been shrinking. It is not a forecast of where prices will rise.


### What ships

- `app/data/neighborhood_prediction.json` (about 95 KB): the decision and rule, every result table above with intervals, the by-origin
  and by-county tables, calibration, the feature list with as-of rules and sources, data vintages and caveats. Every county's entry says
  `"applies": "baseline"` and why. `tract_files` is empty: tract-level model predictions are written (to `app/data/prediction/<fips>.json`)
  only for counties that pass, and none did. The current-origin (2026) model fit is kept in the scratch run folder for the record, not shipped.
- `src/engines/investmentDecisionEngine.js` `rankNeighborhoods(bundle, { backtest, prediction, predictionTracts })`: where a county's
  entry says "model" and its tract file is passed, block groups are ranked by their tract's prediction (labelled tract-level), with the
  80% range, rank, drivers, hit rate and a grade tied to the measured hit rate (A at 45% or more, else B). Everywhere else the ranking is
  unchanged; in the 50 tested counties each block group also gets the screen's tested 5-year range for its home-value fifth (the county's
  own tracts) and the county's measured hit rate, with a grade reason saying the new model was tested and did not beat the screen.
  Counties outside the test say "not tested".
- `app/invest.js`: loads the file and shows the tested range and the "tested on" line under each listed area.

### How to re-run

```
python3 scripts/predict/fetch_geo.py           # geography (tract centres, CBSA, permit jurisdictions); about 20 s
python3 scripts/predict/walkforward.py         # features, walk-forward, every table -> scratch run/results.json, current.json; about 3 min
python3 scripts/predict/write_outputs.py       # app/data/neighborhood_prediction.json (and app/data/prediction/<fips>.json where a county passes)
python3 scripts/predict/report_tables.py       # the tables below, as markdown
python3 -m unittest                            # as-of tests (tests/predict/test_asof.py), writer tests, signal table tests
```
The signal tables come from `scripts/signals/` (see the audit page). Zillow tables are git-ignored; without them the internal variant is
skipped (`--no-zillow`). Bootstraps are seeded.

### Data that would most improve it next

1. **Dated vintages of the outcome** (FHFA's tract index as published each year, or recorded sales with dates): removes the revision leak
   and allows a real "as known then" test.
2. **More, older windows**: ACS 2005-09 and 2008-12 tract tables and HMDA before 2012 would add origins 2008-2013, including the 2008-2012
   bust, the only way to learn how cheap tracts behave in a fall.
3. **Address-level vacancy (HUD/USPS, needs a registered non-profit or government account)** and **recorded sales counts** by tract:
   direct demand signals that are not proxies for cheapness.
4. **Permits by tract** (city permit portals) instead of by jurisdiction, so the supply signal varies inside big cities.
5. **The current ACS 2020-24 tract tables** in `data/signals/`, so today's prediction uses current composition rather than 2015-19.

## Part B tables (generated by `scripts/predict/report_tables.py` from the run; points = 100 x log change relative to the county's median tract)

### B.1 Decision (5-year, county-relative, test windows starting 2019 and 2020)

| Paired difference in top-minus-bottom-fifth spread (points) | Mean (90% county-bootstrap interval) | Share of draws <= 0 | Cells / counties |
|---|---|---|---|
| Ridge minus cheapest tracts | +0.2 (-0.3 to +0.6) | 0.251 | 95 / 48 |
| Ridge minus prior trend | +5.7 (+4.1 to +7.2) | 0.000 | 95 / 48 |

Part 1 of the rule: failed (the interval against the cheapest baseline includes zero). Counties using the model: 0 of 50. For information only: the model's own-county spread was at least both baselines' in 24 of 48 counties with test cells.

### B.2 5-year test, windows starting 2019, 2020

Cells (counties with at least 20 tracts) per origin: 2014: 49, 2015: 49, 2016: 49, 2017: 49, 2018: 47, 2019: 48, 2020: 47. Tracts per origin: 2014: 12383, 2015: 12876, 2016: 12987, 2017: 11642, 2018: 9700, 2019: 9776, 2020: 9674.

| Method | Top-minus-bottom fifth, points (90% interval) | Spearman (90% interval) | Top-third hit rate (90% interval) |
|---|---|---|---|
| No skill (county median) | +0.0 (+0.0 to +0.0) | 0.000 (0.000 to 0.000) | 0.333 (0.333 to 0.333) |
| Cheapest tracts | +6.4 (+5.0 to +7.9) | 0.261 (0.209 to 0.312) | 0.469 (0.442 to 0.496) |
| Prior 5-year trend | +0.9 (-0.2 to +2.1) | 0.068 (0.020 to 0.116) | 0.374 (0.350 to 0.399) |
| Ridge, all 16 features (primary) | +6.6 (+5.2 to +7.9) | 0.265 (0.213 to 0.313) | 0.464 (0.436 to 0.491) |
| Ridge without price-level features | +2.7 (+1.6 to +3.8) | 0.101 (0.061 to 0.140) | 0.388 (0.370 to 0.406) |
| Boosted trees (secondary) | +6.6 (+5.2 to +7.9) | 0.258 (0.206 to 0.307) | 0.466 (0.437 to 0.492) |

By origin (top-minus-bottom fifth, points / hit rate):

| Method | 2019 | 2020 |
|---|---|---|
| No skill (county median) | +0.0 / 0.33 | +0.0 / 0.33 |
| Cheapest tracts | +8.5 / 0.50 | +4.3 / 0.43 |
| Prior 5-year trend | +1.5 / 0.40 | +0.4 / 0.35 |
| Ridge, all 16 features (primary) | +8.6 / 0.50 | +4.6 / 0.42 |
| Ridge without price-level features | +2.7 / 0.38 | +2.7 / 0.39 |
| Boosted trees (secondary) | +8.6 / 0.50 | +4.5 / 0.43 |

Paired differences (points, 90% interval):

| Comparison | Pooled | 2019 | 2020 |
|---|---|---|---|
| ridge minus cheapest | +0.2 (-0.3 to +0.6) | +0.1 | +0.3 |
| ridge minus trend | +5.7 (+4.1 to +7.2) | +7.0 | +4.2 |
| ridge_noprice minus cheapest | -3.7 (-5.0 to -2.4) | -5.8 | -1.6 |
| ridge_noprice minus trend | +1.8 (-0.1 to +3.7) | +1.2 | +2.4 |
| gbm minus cheapest | +0.1 (-0.2 to +0.5) | +0.1 | +0.1 |
| gbm minus trend | +5.6 (+4.1 to +7.1) | +7.1 | +4.1 |

Baselines at every origin (no fitting needed; top-minus-bottom fifth, points):

| Baseline | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 |
|---|---|---|---|---|---|---|---|
| Cheapest tracts | +17.5 | +21.2 | +23.4 | +18.1 | +11.7 | +8.5 | +4.3 |
| Prior 5-year trend | -9.4 | -2.4 | -1.7 | +0.9 | +1.1 | +1.5 | +0.4 |

Calibration of the stated 80% range: ridge 0.728 (0.707 to 0.749) of outcomes inside, mean width 18.81 points (errors from: training fit's own errors (no inner walk-forward fold)); no-skill range 0.882 (0.863 to 0.901), width 25.65 points. By origin (ridge): 2019: 0.78, 2020: 0.68.

#### Robustness (5-year)

- Excluding 2020-2022 origins (origins left: 2019): spread ridge +8.6, cheapest +8.5, trend +1.5; ridge minus cheapest +0.1 (-0.5 to +0.6), ridge minus trend +7.0 (+5.1 to +9.0).
- FHFA thinning (origins whose window ends by 2021: 2014, 2015, 2016): spread on tracts that still have a 2025 value vs all tracts: Cheapest tracts +18.9 vs +20.7; Prior 5-year trend -4.3 vs -4.5.
- Tract vintage: stable 2010-2020 tracts: ridge +6.4, cheapest +6.4, ridge minus cheapest +0.0 (-0.5 to +0.5) (95 cells); converted tracts: ridge +6.8, cheapest +7.2, ridge minus cheapest -0.4 (-0.9 to +0.1) (62 cells).
- Without the price-level features (value_acs, loan_level, rent_to_value): spread +2.7 (+1.6 to +3.8); minus cheapest -3.7 (-5.0 to -2.4); minus trend +1.8 (-0.1 to +3.7).
- Metro-relative target (33 CBSA cells per origin): ridge + county features +7.5 (+6.0 to +9.1), cheapest +7.4 (+5.8 to +9.0), trend +0.3 (-1.1 to +1.6); ridge minus cheapest +0.1 (-0.4 to +0.7).
- Internal only (Zillow terms unconfirmed; nothing shipped): ridge + Zillow ZIP 1-year change, minus cheapest +0.4 (-0.1 to +0.8).

#### Single signals (5-year, every origin, no fitting; within-county Spearman, 90% interval; share of origins with the pooled sign)

| Feature | Spearman | Top-minus-bottom fifth, points | Origins | Same sign |
|---|---|---|---|---|
| value_acs | -0.506 (-0.533 to -0.479) | -14.6 | 6 | 1.00 |
| loan_level | -0.501 (-0.531 to -0.470) | -14.5 | 7 | 1.00 |
| rent_to_value | 0.409 (0.379 to 0.437) | +12.1 | 6 | 1.00 |
| denial_rate | 0.237 (0.212 to 0.261) | +6.8 | 7 | 1.00 |
| buyer_income_ratio | -0.149 (-0.179 to -0.120) | -4.0 | 6 | 1.00 |
| permits_place | -0.130 (-0.170 to -0.091) | -2.8 | 6 | 1.00 |
| trend_1y | 0.116 (0.096 to 0.138) | +3.0 | 7 | 1.00 |
| trend_3y | 0.098 (0.060 to 0.138) | +2.4 | 7 | 0.86 |
| vacancy | 0.090 (0.062 to 0.121) | +3.0 | 6 | 0.83 |
| nonowner_share | 0.077 (0.045 to 0.110) | +2.7 | 7 | 0.86 |
| loan_growth | 0.075 (0.061 to 0.091) | +2.1 | 7 | 1.00 |
| app_growth | 0.071 (0.060 to 0.083) | +2.4 | 7 | 0.86 |
| jobs_5km | -0.030 (-0.056 to -0.003) | -0.7 | 7 | 1.00 |
| trend_5y | -0.027 (-0.066 to 0.015) | -1.4 | 7 | 0.43 |
| jobs_tract | -0.027 (-0.037 to -0.017) | -0.8 | 7 | 0.86 |
| nonowner_change | -0.004 (-0.012 to 0.004) | -0.2 | 7 | 0.43 |

#### Realised 5-year relative change by home-value fifth (cheapest baseline; added after pre-registration, A.10)

| Fifth (1 = cheapest) | p10 | median | p90 | tracts |
|---|---|---|---|---|
| 1 | -3.8 | +7.9 | +22.6 | 15796 |
| 2 | -5.2 | +3.4 | +13.0 | 15801 |
| 3 | -7.5 | +0.1 | +8.1 | 15809 |
| 4 | -10.8 | -3.0 | +4.9 | 15810 |
| 5 | -17.8 | -6.9 | +3.0 | 15812 |

Median by origin (fifth 1 / fifth 5): 2014: +9.4 / -7.9, 2015: +10.6 / -8.9, 2016: +10.8 / -10.2, 2017: +8.4 / -7.7, 2018: +6.3 / -4.6, 2019: +4.6 / -3.3, 2020: +2.4 / -1.5.
 Out-of-time coverage of the fifth's 80% range (ranges from earlier windows only): 0.734 (0.711 to 0.756).

### B.3 3-year test, windows starting 2017, 2018, 2019, 2020, 2021, 2022

Cells (counties with at least 20 tracts) per origin: 2014: 49, 2015: 49, 2016: 49, 2017: 49, 2018: 49, 2019: 49, 2020: 47, 2021: 48, 2022: 47. Tracts per origin: 2014: 12343, 2015: 12193, 2016: 12575, 2017: 12828, 2018: 12596, 2019: 11723, 2020: 9794, 2021: 9875, 2022: 9562.

| Method | Top-minus-bottom fifth, points (90% interval) | Spearman (90% interval) | Top-third hit rate (90% interval) |
|---|---|---|---|
| No skill (county median) | +0.0 (+0.0 to +0.0) | 0.000 (0.000 to 0.000) | 0.333 (0.333 to 0.333) |
| Cheapest tracts | +6.7 (+6.0 to +7.5) | 0.315 (0.290 to 0.340) | 0.496 (0.481 to 0.511) |
| Prior 5-year trend | +1.4 (+0.8 to +2.0) | 0.086 (0.054 to 0.118) | 0.383 (0.368 to 0.400) |
| Ridge, all 16 features (primary) | +6.7 (+6.0 to +7.3) | 0.311 (0.286 to 0.336) | 0.497 (0.483 to 0.511) |
| Ridge without price-level features | +3.5 (+2.8 to +4.2) | 0.164 (0.136 to 0.192) | 0.430 (0.416 to 0.444) |
| Boosted trees (secondary) | +6.7 (+6.0 to +7.4) | 0.311 (0.286 to 0.335) | 0.495 (0.479 to 0.510) |

By origin (top-minus-bottom fifth, points / hit rate):

| Method | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 |
|---|---|---|---|---|---|---|
| No skill (county median) | +0.0 / 0.33 | +0.0 / 0.33 | +0.0 / 0.33 | +0.0 / 0.33 | +0.0 / 0.33 | +0.0 / 0.33 |
| Cheapest tracts | +13.3 / 0.65 | +12.8 / 0.64 | +9.7 / 0.52 | +4.7 / 0.45 | +0.8 / 0.38 | -1.4 / 0.33 |
| Prior 5-year trend | +2.7 / 0.40 | +3.2 / 0.43 | +2.8 / 0.41 | +1.5 / 0.38 | -0.6 / 0.35 | -1.2 / 0.32 |
| Ridge, all 16 features (primary) | +12.2 / 0.63 | +12.7 / 0.63 | +9.7 / 0.52 | +5.0 / 0.45 | +1.1 / 0.39 | -1.2 / 0.34 |
| Ridge without price-level features | +4.3 / 0.45 | +6.7 / 0.51 | +6.0 / 0.47 | +3.4 / 0.43 | +1.2 / 0.37 | -0.8 / 0.34 |
| Boosted trees (secondary) | +12.1 / 0.63 | +12.6 / 0.63 | +9.8 / 0.52 | +5.1 / 0.45 | +1.1 / 0.39 | -1.2 / 0.34 |

Paired differences (points, 90% interval):

| Comparison | Pooled | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 |
|---|---|---|---|---|---|---|---|
| ridge minus cheapest | -0.1 (-0.3 to +0.1) | -1.0 | -0.1 | -0.1 | +0.3 | +0.3 | +0.2 |
| ridge minus trend | +5.2 (+4.3 to +6.2) | +9.6 | +9.5 | +6.9 | +3.5 | +1.7 | -0.0 |
| ridge_noprice minus cheapest | -3.2 (-3.8 to -2.7) | -9.0 | -6.0 | -3.7 | -1.3 | +0.3 | +0.6 |
| ridge_noprice minus trend | +2.1 (+1.0 to +3.1) | +1.6 | +3.5 | +3.2 | +1.9 | +1.8 | +0.4 |
| gbm minus cheapest | -0.1 (-0.2 to +0.1) | -1.2 | -0.2 | +0.1 | +0.4 | +0.3 | +0.2 |
| gbm minus trend | +5.2 (+4.3 to +6.2) | +9.4 | +9.4 | +7.0 | +3.6 | +1.7 | -0.0 |

Baselines at every origin (no fitting needed; top-minus-bottom fifth, points):

| Baseline | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 |
|---|---|---|---|---|---|---|---|---|---|
| Cheapest tracts | +9.2 | +12.5 | +13.7 | +13.3 | +12.8 | +9.7 | +4.7 | +0.8 | -1.4 |
| Prior 5-year trend | -4.5 | -1.0 | -0.1 | +2.7 | +3.2 | +2.8 | +1.5 | -0.6 | -1.2 |

Calibration of the stated 80% range: ridge 0.723 (0.706 to 0.741) of outcomes inside, mean width 14.94 points (errors from: inner walk-forward errors inside the training window; training fit's own errors (no inner walk-forward fold)); no-skill range 0.823 (0.805 to 0.842), width 19.01 points. By origin (ridge): 2017: 0.85, 2018: 0.86, 2019: 0.76, 2020: 0.63, 2021: 0.61, 2022: 0.62.

#### Robustness (3-year)

- Excluding 2020-2022 origins (origins left: 2017, 2018, 2019): spread ridge +11.5, cheapest +11.9, trend +2.9; ridge minus cheapest -0.4 (-0.7 to -0.1), ridge minus trend +8.6 (+7.2 to +10.1).
- FHFA thinning (origins whose window ends by 2021: 2014, 2015, 2016, 2017, 2018): spread on tracts that still have a 2025 value vs all tracts: Cheapest tracts +11.6 vs +13.0; Prior 5-year trend +2.8 vs +2.9; Ridge, all 16 features (primary) +11.0 vs +12.4; Ridge without price-level features +5.6 vs +5.5; Boosted trees (secondary) +11.0 vs +12.4.
- Tract vintage: stable 2010-2020 tracts: ridge +6.8, cheapest +6.8, ridge minus cheapest -0.0 (-0.2 to +0.2) (289 cells); converted tracts: ridge +6.6, cheapest +6.7, ridge minus cheapest -0.1 (-0.4 to +0.2) (201 cells).
- Without the price-level features (value_acs, loan_level, rent_to_value): spread +3.5 (+2.8 to +4.2); minus cheapest -3.2 (-3.8 to -2.7); minus trend +2.1 (+1.0 to +3.1).
- Metro-relative target (33 CBSA cells per origin): ridge + county features +7.1 (+6.1 to +8.0), cheapest +7.3 (+6.4 to +8.3), trend +1.2 (+0.4 to +1.9); ridge minus cheapest -0.3 (-0.5 to -0.1).
- Internal only (Zillow terms unconfirmed; nothing shipped): ridge + Zillow ZIP 1-year change, minus cheapest +0.3 (+0.0 to +0.6).

#### Single signals (3-year, every origin, no fitting; within-county Spearman, 90% interval; share of origins with the pooled sign)

| Feature | Spearman | Top-minus-bottom fifth, points | Origins | Same sign |
|---|---|---|---|---|
| value_acs | -0.379 (-0.400 to -0.358) | -8.3 | 8 | 0.88 |
| loan_level | -0.367 (-0.391 to -0.342) | -8.2 | 9 | 0.89 |
| rent_to_value | 0.307 (0.285 to 0.328) | +6.9 | 8 | 0.88 |
| denial_rate | 0.165 (0.146 to 0.184) | +3.8 | 9 | 1.00 |
| trend_3y | 0.122 (0.098 to 0.148) | +2.3 | 9 | 0.89 |
| trend_1y | 0.106 (0.092 to 0.122) | +2.2 | 9 | 0.89 |
| permits_place | -0.102 (-0.131 to -0.073) | -1.7 | 8 | 1.00 |
| buyer_income_ratio | -0.095 (-0.115 to -0.074) | -2.0 | 8 | 0.88 |
| loan_growth | 0.071 (0.061 to 0.082) | +1.5 | 9 | 1.00 |
| vacancy | 0.068 (0.047 to 0.090) | +1.7 | 8 | 0.62 |
| nonowner_share | 0.064 (0.040 to 0.089) | +1.6 | 9 | 0.78 |
| app_growth | 0.051 (0.041 to 0.061) | +1.3 | 9 | 0.67 |
| trend_5y | 0.035 (0.010 to 0.062) | +0.3 | 9 | 0.56 |
| jobs_5km | -0.024 (-0.046 to -0.003) | -0.4 | 9 | 0.78 |
| jobs_tract | -0.014 (-0.023 to -0.005) | -0.3 | 9 | 0.89 |
| nonowner_change | 0.000 (-0.006 to 0.008) | +0.1 | 9 | 0.44 |

#### Realised 3-year relative change by home-value fifth (cheapest baseline; added after pre-registration, A.10)

| Fifth (1 = cheapest) | p10 | median | p90 | tracts |
|---|---|---|---|---|
| 1 | -5.5 | +4.6 | +16.4 | 20694 |
| 2 | -5.4 | +2.1 | +9.9 | 20687 |
| 3 | -6.3 | +0.1 | +7.0 | 20694 |
| 4 | -8.1 | -1.8 | +5.0 | 20682 |
| 5 | -12.7 | -4.1 | +4.7 | 20712 |

Median by origin (fifth 1 / fifth 5): 2014: +5.2 / -4.8, 2015: +6.4 / -5.7, 2016: +6.8 / -5.5, 2017: +6.4 / -4.8, 2018: +5.7 / -5.4, 2019: +4.0 / -4.6, 2020: +2.7 / -2.2, 2021: +1.0 / +0.2, 2022: +0.0 / +1.2.
 Out-of-time coverage of the fifth's 80% range (ranges from earlier windows only): 0.750 (0.732 to 0.768).

### B.4 By county (5-year test cells, origins 2019 and 2020)

| County | Cells | Spread ridge | Spread cheapest | Spread trend | Hit ridge | Hit cheapest | Uses model |
|---|---|---|---|---|---|---|---|
| Maricopa County, AZ | 2 | +1.2 | +2.1 | +2.4 | 0.43 | 0.45 | no |
| Pima County, AZ | 2 | +6.6 | +5.4 | +6.7 | 0.47 | 0.48 | no |
| Alameda County, CA | 2 | -5.4 | -9.4 | -18.1 | 0.17 | 0.15 | no |
| Contra Costa County, CA | 2 | -1.3 | -1.4 | -6.2 | 0.36 | 0.36 | no |
| Riverside County, CA | 2 | +4.4 | +5.1 | +3.9 | 0.50 | 0.50 | no |
| Sacramento County, CA | 2 | +8.8 | +8.1 | +7.8 | 0.51 | 0.52 | no |
| San Bernardino County, CA | 2 | +9.4 | +10.7 | +9.7 | 0.60 | 0.64 | no |
| San Diego County, CA | 2 | -0.6 | -0.2 | -0.5 | 0.32 | 0.33 | no |
| San Francisco County, CA | 2 | -4.6 | -5.1 | -1.7 | 0.19 | 0.26 | no |
| Santa Clara County, CA | 2 | +4.3 | +4.0 | -1.7 | 0.29 | 0.37 | no |
| Broward County, FL | 2 | +2.8 | +2.4 | +4.7 | 0.41 | 0.43 | no |
| Hillsborough County, FL | 2 | +7.6 | +7.9 | +5.5 | 0.48 | 0.51 | no |
| Miami-Dade County, FL | 2 | +3.5 | +4.2 | +4.0 | 0.45 | 0.48 | no |
| Palm Beach County, FL | 2 | +2.8 | -1.0 | +3.4 | 0.47 | 0.44 | no |
| Pinellas County, FL | 2 | +5.9 | +7.0 | +7.0 | 0.47 | 0.45 | no |
| Fulton County, GA | 2 | +10.7 | +9.4 | +0.6 | 0.46 | 0.45 | no |
| Cook County, IL | 2 | +11.0 | +11.0 | +0.1 | 0.58 | 0.56 | no |
| Marion County, IN | 2 | +19.1 | +16.5 | -7.4 | 0.62 | 0.54 | no |
| Middlesex County, MA | 2 | +10.0 | +8.8 | -6.1 | 0.60 | 0.61 | no |
| Suffolk County, MA | 2 | +5.8 | +4.8 | -0.2 | 0.29 | 0.33 | no |
| Macomb County, MI | 2 | +11.0 | +11.2 | +9.4 | 0.64 | 0.63 | no |
| Oakland County, MI | 2 | +4.9 | +5.4 | +1.4 | 0.48 | 0.46 | no |
| Wayne County, MI | 2 | +13.0 | +13.3 | +5.8 | 0.53 | 0.55 | no |
| Hennepin County, MN | 2 | -1.0 | -0.1 | -0.7 | 0.31 | 0.28 | no |
| St. Louis County, MO | 2 | +11.7 | +11.5 | +0.4 | 0.63 | 0.61 | no |
| Clark County, NV | 2 | +5.2 | +5.1 | +5.0 | 0.51 | 0.55 | no |
| Bergen County, NJ | 2 | +5.2 | +5.0 | +3.8 | 0.55 | 0.57 | no |
| Erie County, NY | 2 | +5.8 | +5.3 | +2.3 | 0.47 | 0.49 | no |
| Kings County, NY | 1 | +5.1 | +8.0 | +2.8 | 0.29 | 0.43 | no |
| Nassau County, NY | 2 | +8.6 | +8.4 | +4.7 | 0.52 | 0.54 | no |
| Queens County, NY | 2 | +7.1 | +13.6 | -1.0 | 0.34 | 0.52 | no |
| Suffolk County, NY | 2 | +10.7 | +11.7 | +7.9 | 0.57 | 0.62 | no |
| Westchester County, NY | 2 | +3.7 | +3.2 | -3.0 | 0.46 | 0.46 | no |
| Cuyahoga County, OH | 2 | +11.2 | +10.4 | -0.4 | 0.54 | 0.51 | no |
| Franklin County, OH | 2 | +15.8 | +14.6 | +3.7 | 0.63 | 0.63 | no |
| Hamilton County, OH | 2 | +12.7 | +11.6 | +1.4 | 0.51 | 0.54 | no |
| Oklahoma County, OK | 2 | +3.9 | +2.9 | -5.1 | 0.36 | 0.33 | no |
| Allegheny County, PA | 2 | +7.3 | +8.4 | -3.6 | 0.54 | 0.51 | no |
| Philadelphia County, PA | 2 | +16.4 | +12.1 | -7.4 | 0.50 | 0.44 | no |
| Shelby County, TN | 2 | +18.4 | +22.1 | +0.6 | 0.66 | 0.70 | no |
| Bexar County, TX | 2 | -0.5 | -0.8 | -0.6 | 0.37 | 0.37 | no |
| Dallas County, TX | 2 | +1.2 | +0.9 | -0.8 | 0.40 | 0.41 | no |
| Harris County, TX | 2 | +11.6 | +12.9 | +7.2 | 0.57 | 0.54 | no |
| Tarrant County, TX | 2 | -1.0 | -0.6 | -0.4 | 0.37 | 0.33 | no |
| Travis County, TX | 2 | +0.9 | -1.9 | -2.6 | 0.36 | 0.28 | no |
| Salt Lake County, UT | 2 | +1.1 | +1.2 | -0.1 | 0.36 | 0.35 | no |
| King County, WA | 2 | +11.9 | +10.6 | -3.0 | 0.49 | 0.44 | no |
| Milwaukee County, WI | 2 | +12.3 | +12.4 | +4.2 | 0.56 | 0.57 | no |

### B.5 Current model (fitted on 5-year origins 2014-2020, lambda 0.001, range from inner walk-forward errors inside the training window; not shipped)

| Feature | Weight (log points per full percentile span) |
|---|---|
| value_acs | -0.0456 |
| loan_level | -0.1266 |
| trend_1y | +0.0162 |
| trend_3y | +0.0133 |
| trend_5y | -0.0480 |
| app_growth | +0.0062 |
| loan_growth | +0.0200 |
| nonowner_share | +0.0034 |
| nonowner_change | -0.0010 |
| denial_rate | +0.0226 |
| buyer_income_ratio | -0.0051 |
| permits_place | +0.0007 |
| jobs_tract | -0.0005 |
| jobs_5km | +0.0014 |
| rent_to_value | +0.0243 |
| vacancy | -0.0001 |
