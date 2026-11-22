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

None yet.
