# Neighbourhood price prediction, second attempt: hold-out metros, absolute returns (23 Nov 2026)

Earlier attempt: `docs/PREDICTION-MODEL.md` (22 Nov; within-county ranking in 50 counties; did not beat "cheapest tracts").
This page asks a different, harder question that matches what an investor does: **of all neighbourhoods in metros the
model has never seen, which will rise most in price over the next 3 or 5 years?** Code: `scripts/predict2/`. Outputs:
`data/backtests/prediction_holdout_2026-11-23*.json`.

## Part A. Protocol (written and committed before any model or baseline was evaluated on this design)

Nothing in Part A changes after the first evaluation run except by a dated note in A.9 that says what changed and why.

### A.1 Unit, universe, target

- Unit: 2020 Census tract (the codes of FHFA's tract house price index).
- Universe at origin T: tracts in counties of a **Metropolitan** Statistical Area (Census CBSA delineation, July 2023,
  `data/predict/county_cbsa_2023.csv`), 50 states and DC, that have an FHFA tract index value in years T-6, T-1, T and
  T+h, and a current home-value estimate (A.4 feature `value_now`). The same tracts are used for every method, so
  methods are compared on identical sets.
- Target: y = 100 x ln(HPI[T+h] / HPI[T]), the tract's **absolute** (not county-relative) price change, in points
  (100 x log change; close to percent for small changes). Horizons h = 5 (primary) and h = 3.
- Origin T = a decision on 31 December of year T, buying at year-T prices.

### A.2 Hold-out metros

- A metro is in the hold-out set if `int(sha256(cbsa_code).hexdigest(), 16) % 10` is 0, 1 or 2 (about 30% of metros,
  fixed by the code alone, not chosen by size, region or results).
- Hold-out tracts are never used for fitting, for scaling features, or for choosing any setting. Every number marked
  **hold-out** below is computed only on hold-out metros. Numbers on the other metros are marked **seen metros**.

### A.3 Origins and walk-forward

- Origins: T = 2012 ... 2020 for h = 5 (last outcome year 2025); T = 2012 ... 2022 for h = 3.
- A model predicting at test origin T is fitted on **training metros only**, origins S = 2012 ... T-h (outcome fully
  known by T). Test origins are therefore 2017-2020 (h = 5, four origins) and 2015-2022 (h = 3, eight origins).
- Baselines need no fitting; they are evaluated on the same test origins and hold-out tracts.

### A.4 Features (as of T; publication lags from `docs/audit/prediction-signals-2026-11-22.md` section 0)

| Family | Feature | Definition at origin T | Source, lag |
|---|---|---|---|
| Price trend | `mom1` | ln HPI[T-1]/HPI[T-2] | FHFA tract annual, year t usable when t <= T-1 |
| Price trend | `mom5` | ln HPI[T-1]/HPI[T-6] | same |
| Price trend | `metro_mom1`, `metro_mom5` | median of the same over all FHFA tracts of the tract's CBSA | same |
| Price level | `value_now` | ln(ACS median home value of vintage E x HPI[T-1] / HPI[E-2]), E = latest ACS 5-year vintage released by T (E <= T-1) among 2010, 2014, 2019; E-2 is the middle year of the 5-year period | ACS 5-year tract tables (2010 tract codes, moved to 2020 tracts by the Census relationship file, land-area weights); FHFA |
| Price level | `value_pct_metro` | percentile of `value_now` among the universe tracts of the same CBSA at T | same |
| Price level | `rent_to_value` | 12 x median gross rent / median home value, vintage E | ACS |
| Price level | `value_to_income` | median home value / median household income, vintage E | ACS |
| Price level | `vacancy` | vacant / all housing units, vintage E | ACS |
| Supply | `permits_county` | housing units authorised in years T-2 and T-1 in the county / housing units in the county (ACS vintage E) | Census Building Permits Survey, county annual files (year t usable when t <= T-1); ACS |
| Supply | `permits_metro` | the same for the whole CBSA | same |
| Jobs | `jobs_tract` | annualised ln((jobs[T-2]+10)/(jobs[a]+10)), a = max(2010, T-4); missing when a = T-2 (T = 2012) | LEHD LODES8 workplace jobs by tract; year t usable when t <= T-2 |
| Jobs | `jobs_county` | the same for the county total | same |

Missing values: after scaling, a missing feature is set to 0 (the cross-section's middle).
Scaling (for every fitted model): each feature is winsorised at the 1st/99th percentile and z-scored **within each
origin, using the training metros' tracts at that origin only**; hold-out tracts are scaled with the training tracts'
numbers of the same origin. The target is demeaned within each training origin before fitting (the models learn which
tracts beat the market, not the market's direction; a forecast of the national market is not attempted).

### A.5 Methods

Baselines (no fitting):
- **No change**: every tract predicted 0. Its top decile is the average hold-out tract (ties are averaged).
- **Metro average**: predict each tract by its metro's trailing trend `metro_mom5` (every tract of a metro tied).
- **Momentum**: the tract's own last-period change carried forward: ln HPI[T-1]/HPI[T-1-h].
- **Cheapest in metro**: lowest `value_pct_metro` first (the site's current screen idea).
- **Cheapest in dollars**: lowest `value_now` first.

Models (fitted on training metros, A.3):
- **Ridge, all four families (primary)**: least squares with penalty lambda x n x |w|^2 on the scaled features; outcome
  winsorised at its 1st/99th percentile for fitting. lambda from {0.001, 0.01, 0.1, 1, 10} by 5-fold cross-validation
  over training metros (folds by CBSA, same seeded split) on the training origins; criterion: mean over training origins
  of the top-decile mean of the held-out folds. Only training metros are used.
- **Ridge, price trend + price level only** (ablation: do permits and jobs add anything?).
- **Shallow boosted trees** (`scripts/predict/model.py` gbm: depth 3, learning rate 0.05, 150 trees, min 50 per leaf,
  80% subsample, seed fixed), inputs = the scaled features mapped to within-origin percentile ranks among training
  tracts. Fixed settings, no tuning. Reported; it can be shipped only if the ridge also passes (one primary model).

### A.6 Metrics (hold-out tracts, each test origin, then the mean over test origins)

- **Spearman rank correlation** between prediction and y, over all hold-out tracts of the origin.
- **Top-decile return**: mean y of the 10% of hold-out tracts with the highest prediction at that origin (tied
  predictions: each tracts' y is replaced by the mean y of its tie group, so tie order cannot matter). Also reported as
  excess over the no-change baseline (the average hold-out tract).
- **Paired difference**: model top-decile return minus each baseline's, mean over test origins.
- **Uncertainty**: 2,000 bootstrap draws resampling **hold-out metros** (a metro's tracts at every origin together),
  seed 20261123; **95%** percentile intervals. Draws re-select the top decile on the resampled set.
- Per-origin tables, and the number of test origins in which the model's top decile beat each baseline's.

### A.7 Decision rule (fixed now)

The model is shown on the page as a prediction only if, for **both** horizons, on hold-out metros:
1. its top-decile return minus **each** of the five baselines' has a 95% interval entirely above zero; and
2. its mean Spearman is above each baseline's.

If it fails, the page shows no prediction. It states what was tested and that it did not beat the baselines, and shows
the signals themselves (price trend, permits trend, jobs trend) as sourced, dated facts without a forecast.

### A.8 Known limits stated with every result (not fixable here)

- FHFA history is one revised vintage (file dated March 2026); values for 2012 are not what was known in 2012.
- LODES8 2010-2021 were re-created in 2023 on 2020 blocks.
- ACS tract values are moved from 2010 to 2020 tracts by land area, which is crude where a tract split.
- The FHFA tract index is thinner after 2021 (fewer tracts), and the universe needs a value at T+h.
- Four (h = 5) and eight (h = 3) overlapping test windows are few; the metro bootstrap does not capture the chance that
  the whole period was unusual (it was: 2020-2022). Per-origin results are shown for that reason.

### A.9 Deviations (dated notes only)

- 23 Nov 2026, while writing the code, **before any evaluation**: two definitions above would have used future data,
  because the universe (A.1) needs an index value at T+h. (1) `value_pct_metro` is the percentile among **all tracts of
  the CBSA that have `value_now` at T** (the "feature pool"), not only universe tracts. (2) Within-origin scaling uses
  the training metros' feature-pool tracts at that origin, with or without an outcome. Metrics are still computed on
  universe tracts (those with an outcome), the same set for every method.
- 23 Nov 2026, before any evaluation: Connecticut drops out. FHFA's file and the 2023 CBSA delineation use the new
  planning-region codes (e.g. tract `09110400101`), while the 2010-2020 tract relationship file, so the ACS inputs,
  use the old county codes; no Connecticut tract gets `value_now`, so none is in the universe.
- 23 Nov 2026, first run: it stopped while loading (a blank weight in the tract relationship file); blank weights now
  count as 0. No result had been produced. The second run is the only evaluation; nothing was changed after it.
- 23 Nov 2026, **after** the run: `scripts/predict2/diagnostics.py` (each single signal's Spearman on hold-out tracts at
  every origin, training years included) was added to explain the failure. It is descriptive and chose nothing.

## Part B. Results (run 23 Nov 2026, 07:11-07:20; 2,000 metro resamples, seed 20261123)

### B.0 In one paragraph

**The model still does not beat the baselines.** On 129 hold-out metros, the ridge model's top 10% of tracts rose more
than the average tract (5 years: +3.4 points, 95% interval +1.3 to +5.6; 3 years: +1.3, +0.4 to +2.8), but less than
simply buying the cheapest tracts in each metro (5 years: -3.5 points, -5.2 to -0.3; 3 years: -2.7, -3.7 to -0.9), and
not distinguishably better than the metro-trend, momentum or cheapest-in-dollars baselines. Its rank correlation
(0.073 over 5 years, 0.053 over 3) is far below the cheapest-tract baselines' (0.29 and 0.23). The boosted trees and the
trend-plus-level ridge did no better. By the rule in A.7 nothing is shown as a prediction.

### B.1 Why it failed (descriptive, from `data/backtests/prediction_holdout_2026-11-23_signals.json`)

The relations the model has to learn **changed sign between the years it trains on and the years it is tested on**:

| Signal (Spearman with the later change, hold-out tracts, 5-year windows) | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 |
|---|---|---|---|---|---|---|---|---|---|
| `mom5` (tract's own last 5 years) | -0.396 | -0.390 | -0.162 | +0.099 | +0.168 | +0.207 | +0.033 | +0.014 | -0.058 |
| `metro_mom5` | -0.409 | -0.384 | -0.105 | +0.273 | +0.333 | +0.295 | +0.043 | +0.034 | -0.047 |
| `value_to_income` | +0.283 | +0.258 | +0.159 | +0.014 | -0.101 | -0.134 | -0.197 | -0.162 | -0.205 |
| `value_pct_metro` (cheap in metro = low) | -0.041 | -0.135 | -0.243 | -0.312 | -0.387 | -0.340 | -0.321 | -0.306 | -0.206 |
| `permits_metro` | +0.031 | +0.115 | +0.262 | +0.268 | +0.271 | +0.383 | +0.335 | +0.207 | +0.019 |

Windows starting 2012-2013 were the rebound after the 2006-2011 fall: the tracts and metros that had fallen most rose
most. The first fitted models learned that (large negative weight on `mom5`) and carried it into later windows, where
recent winners kept winning. Only "cheap within its metro" pointed the same way in every window. In the 3-year
windows starting 2022, permits, job growth and momentum all reversed (Spearman -0.37, -0.36, -0.28 for
`permits_metro`, `jobs_county`, `mom5`), the end of the 2020-2022 run-up. A model fitted on past windows cannot see
such turns coming with these signals; the simple "cheap within its metro" rule held up better because it did not
depend on them.

### B.2 The existing model, re-run (not quoted)

`python3 scripts/predict/walkforward.py --no-zillow` re-run on 23 Nov 2026 (2 min 33 s) gave the same numbers as
`docs/PREDICTION-MODEL.md` B.1-B.3 (every line of `report_tables.py`'s output identical; the only lines missing are the
two internal Zillow variants, skipped because no new Zillow use is allowed): 5-year within-county test (windows starting 2019-2020, 48 counties), ridge minus
cheapest tracts **+0.2 points (90% interval -0.3 to +0.6)**, ridge minus prior trend +5.7 (+4.1 to +7.2); 3-year
ridge minus cheapest -0.1 (-0.3 to +0.1). That model answers a narrower question (rank tracts inside one of 50 large
counties) with county-bootstrap 90% intervals; it also did not beat "cheapest tracts". It was not re-scored on hold-out
metros: its mortgage (HMDA) features exist nationally only for 2012-2017, so it cannot be built for the hold-out metros
in the test years.

### B.3 What was wired into the page

- No forecast. The Invest view's "How this was tested" section now has a panel "Price prediction: tested, not shown"
  with the question, every method's hold-out top-10% change and 95% interval for 3 and 5 years, the rank correlations,
  the limits and the data dates (`app/invest.js` `holdoutPanel`, data `app/data/neighborhood_prediction_holdout.json`,
  14.6 KB).
- Under each listed area: "Trends (facts, not a forecast)": the tract's FHFA price change 2020-2025 and 2024-2025, jobs
  located in the tract in 2024 and the 2022-2024 change (LODES), and the county's homes authorised by permits 2021-2025
  (BPS), each with its source link or "Not on file" and the reason (`src/engines/neighborhoodSignals.js`, data
  `app/data/neighborhood_signals/<state>.json`, 51 files, 3.16 MB in total, largest California 324 KB).
- Live check: `LIVE_PORT=9291 node scripts/live_check_prediction_signals.mjs` (Travis TX, Cook IL, Wayne MI): panel and
  table rows match the stored numbers, every listed area's trends match its tract's row, no forecast wording, no
  console errors (`data/backtests/live_check_prediction_signals_2026-11-23.json`).
- Checks before commit: `npm test` 2,094 passed; `npm run typecheck` clean; `PW_PORT=9292 npm run test:e2e -- --trace off`
  122 passed (the first full run failed one test, `invest.spec.ts` "renders the five sections", because the new panel
  reused the `iv-honest` class that test expects to be unique; the panel now has its own class, the test is unchanged);
  `python3 -m unittest tests.predict2.test_features` 9 passed (as-of guard, planted future values change no feature,
  tie and weight handling of the metrics).

### B.4 Sources fetched for this job (provenance next to the data)

- ACS 5-year tract tables, every state and DC, vintages 2006-10, 2010-14, 2015-19: `data/predict2/acs_tract_national.csv.gz`
  (3.3 MB; URLs, cells, table titles quoted from the Census lookup files, terms quote and checks in
  `data/predict2/acs_tract_national_meta.json`). Check: every value shared with the 22 Nov 50-county table is equal
  (151,488 of 151,488).
- Not fetchable as planned: `api.census.gov` answers every request from here with a redirect to "missing_key" (no key
  is configured), so the summary files were used instead. One 2010 file (New Hampshire, sequence 98) is always answered
  "Request Rejected"; it was read from the whole-state archive.
- Reused from `data/signals/` (22 Nov, see `docs/audit/prediction-signals-2026-11-22.md`): FHFA tract index, BPS
  county annual files, LODES8 tract jobs, the 2010-2020 tract relationship file. File dates re-read on 23 Nov:
  `co2025a.txt` Last-Modified 14 May 2026; `tx_wac_S000_JT00_2024.csv.gz` Last-Modified 14 Oct 2026; FHFA's tract CSV
  sends no Last-Modified header.
- Not used: Zillow (terms unconfirmed); HUD/USPS vacancy (needs a registered government or non-profit account, per the
  22 Nov page; not re-checked); national HMDA 2018+ (not built); distance to rail stations (the station tables cover
  a few metros, not the national universe, so they cannot be tested this way).

### B.5 Limits

As A.8, plus: the hold-out bootstrap treats metros as independent, but neighbouring metros move together; the top
decile is pooled over all hold-out metros, so a model can win by picking whole metros (none did); prices only, no rents
or costs.

### B.6 Decisions for the owner

1. Accept that the page shows trends and the tested failure, not a forecast. The next honest step is not a bigger
   model on the same signals but **signals that did not change sign**: the 22 Nov page lists dated FHFA vintages,
   recorded sales counts, and older ACS tract tables (to add the 2008-2012 fall to the training years).
2. A Census API key (free) would make ACS pulls simpler and allow 2020-24 tract data for current values.
3. Whether to show "cheapest within its metro" itself as a tested screen across metros (it was the best rule here, but
   its edge has shrunk: top decile minus the average tract fell from 8.3 points for 5-year windows starting 2016-2017 to
   4.6 for 2020).

### B.7 Tables (generated by `python3 scripts/predict2/report.py`)


### 5-year horizon (test windows starting 2017-2020)

**Hold-out metros**: 129 metros; tracts per test origin: 2017: 15,026, 2018: 13,249, 2019: 13,341, 2020: 13,298

| Method | Top-decile change, points (95% interval) | Excess over the average tract | Spearman (95% interval) |
|---|---|---|---|
| ridge_all | 43.3 (41.6 to 46.0) | +3.4 | 0.073 (-0.012 to 0.184) |
| ridge_trend_level | 42.9 (41.2 to 45.2) | +3.0 | -0.001 (-0.101 to 0.119) |
| gbm_all | 41.7 (39.6 to 43.8) | +1.7 | 0.033 (-0.064 to 0.138) |
| no_change | 39.9 (38.4 to 42.1) | +0.0 | 0.000 (0.000 to 0.000) |
| metro_average | 40.7 (37.7 to 45.8) | +0.8 | 0.081 (-0.057 to 0.200) |
| momentum | 41.2 (38.5 to 45.0) | +1.3 | 0.049 (-0.056 to 0.154) |
| cheapest_in_metro | 46.7 (44.9 to 48.2) | +6.8 | 0.293 (0.207 to 0.368) |
| cheapest_dollars | 45.0 (42.9 to 46.8) | +5.1 | 0.291 (0.159 to 0.375) |

Paired differences, hold-out (model minus baseline; top-decile points, 95% interval; test origins won; Spearman difference):

| Model | no_change | metro_average | momentum | cheapest_in_metro | cheapest_dollars |
|---|---|---|---|---|---|
| ridge_all | +3.4 (+1.3 to +5.6); 4/4; rho +0.073 | +2.6 (-2.4 to +6.4); 3/4; rho -0.009 | +2.1 (-1.8 to +5.7); 3/4; rho +0.024 | -3.5 (-5.2 to -0.3); 0/4; rho -0.221 | -1.7 (-3.6 to +1.1); 1/4; rho -0.218 |
| ridge_trend_level | +3.0 (+0.8 to +5.1); 4/4; rho -0.001 | +2.2 (-2.8 to +6.0); 3/4; rho -0.082 | +1.7 (-2.2 to +5.1); 3/4; rho -0.050 | -3.9 (-5.4 to -1.3); 0/4; rho -0.294 | -2.2 (-3.8 to +0.3); 1/4; rho -0.292 |
| gbm_all | +1.7 (-0.9 to +3.8); 3/4; rho +0.033 | +1.0 (-4.2 to +4.4); 3/4; rho -0.048 | +0.5 (-3.7 to +3.6); 3/4; rho -0.016 | -5.1 (-6.8 to -2.9); 0/4; rho -0.260 | -3.4 (-5.4 to -1.1); 0/4; rho -0.258 |

By test origin, hold-out (top-decile change, points; the last column is the average hold-out tract):

| Origin | ridge_all | ridge_trend_level | gbm_all | no_change | metro_average | momentum | cheapest_in_metro | cheapest_dollars | average tract |
|---|---|---|---|---|---|---|---|---|---|
| 2017 | 39.6 | 39.3 | 39.0 | 39.1 | 46.7 | 45.1 | 47.4 | 43.5 | 39.1 |
| 2018 | 43.9 | 42.5 | 42.2 | 39.8 | 40.0 | 40.2 | 47.5 | 46.6 | 39.8 |
| 2019 | 45.8 | 45.1 | 42.4 | 40.8 | 39.4 | 40.9 | 47.5 | 46.2 | 40.8 |
| 2020 | 43.9 | 44.5 | 43.1 | 40.0 | 36.8 | 38.6 | 44.6 | 43.9 | 40.0 |

Seen metros, later years (out of time only): 253 metros; tracts per test origin: 2017: 29,463, 2018: 25,269, 2019: 25,405, 2020: 25,162

| Method | Top-decile change, points (95% interval) | Excess over the average tract | Spearman (95% interval) |
|---|---|---|---|
| ridge_all | 43.0 (40.8 to 45.0) | +1.4 | -0.074 (-0.193 to 0.057) |
| ridge_trend_level | 42.8 (40.8 to 45.0) | +1.3 | -0.106 (-0.219 to 0.024) |
| gbm_all | 41.3 (39.3 to 43.5) | -0.3 | -0.079 (-0.192 to 0.048) |
| no_change | 41.5 (39.8 to 43.4) | -0.0 | 0.000 (0.000 to 0.000) |
| metro_average | 43.7 (36.2 to 49.4) | +2.1 | 0.134 (-0.019 to 0.266) |
| momentum | 44.9 (39.7 to 49.6) | +3.4 | 0.124 (-0.008 to 0.250) |
| cheapest_in_metro | 46.9 (44.8 to 49.0) | +5.4 | 0.224 (0.184 to 0.264) |
| cheapest_dollars | 46.1 (44.5 to 47.8) | +4.5 | 0.286 (0.176 to 0.381) |

Baselines at every origin, hold-out metros (top-decile change, points; no fitting):

| Origin | tracts | average tract | metro_average | momentum | cheapest_in_metro | cheapest_dollars |
|---|---|---|---|---|---|---|
| 2012 | 15,877 | 24.6 | 18.1 | 19.2 | 26.1 | 22.1 |
| 2013 | 16,036 | 27.2 | 20.5 | 21.8 | 31.0 | 27.0 |
| 2014 | 15,917 | 26.0 | 28.0 | 27.1 | 32.4 | 28.3 |
| 2015 | 15,776 | 25.1 | 30.1 | 29.4 | 32.1 | 28.5 |
| 2016 | 15,848 | 30.6 | 36.9 | 35.1 | 38.9 | 35.0 |
| 2017 | 15,026 | 39.1 | 46.7 | 45.1 | 47.4 | 43.5 |
| 2018 | 13,249 | 39.8 | 40.0 | 40.2 | 47.5 | 46.6 |
| 2019 | 13,341 | 40.8 | 39.4 | 40.9 | 47.5 | 46.2 |
| 2020 | 13,298 | 40.0 | 36.8 | 38.6 | 44.6 | 43.9 |

Ridge lambda chosen per test origin (all families / trend+level): 2017: 0.001 / 0.01, 2018: 0.001 / 0.001, 2019: 0.1 / 0.1, 2020: 0.1 / 0.1

### 3-year horizon (test windows starting 2015-2022)

**Hold-out metros**: 129 metros; tracts per test origin: 2015: 15,424, 2016: 15,584, 2017: 15,779, 2018: 15,915, 2019: 15,223, 2020: 13,186, 2021: 13,356, 2022: 13,229

| Method | Top-decile change, points (95% interval) | Excess over the average tract | Spearman (95% interval) |
|---|---|---|---|
| ridge_all | 22.2 (21.2 to 24.3) | +1.3 | 0.053 (-0.014 to 0.156) |
| ridge_trend_level | 22.1 (21.5 to 23.8) | +1.2 | -0.015 (-0.066 to 0.078) |
| gbm_all | 21.9 (21.1 to 22.7) | +0.9 | 0.055 (0.003 to 0.117) |
| no_change | 20.9 (20.0 to 22.1) | +0.0 | 0.000 (0.000 to 0.000) |
| metro_average | 22.3 (21.0 to 24.2) | +1.4 | 0.146 (0.072 to 0.199) |
| momentum | 24.3 (23.3 to 25.6) | +3.4 | 0.217 (0.168 to 0.261) |
| cheapest_in_metro | 24.9 (24.1 to 25.8) | +4.0 | 0.233 (0.181 to 0.276) |
| cheapest_dollars | 23.6 (22.2 to 24.8) | +2.6 | 0.187 (0.080 to 0.254) |

Paired differences, hold-out (model minus baseline; top-decile points, 95% interval; test origins won; Spearman difference):

| Model | no_change | metro_average | momentum | cheapest_in_metro | cheapest_dollars |
|---|---|---|---|---|---|
| ridge_all | +1.3 (+0.4 to +2.8); 6/8; rho +0.053 | -0.1 (-2.3 to +2.5); 3/8; rho -0.094 | -2.1 (-3.5 to +0.2); 2/8; rho -0.165 | -2.7 (-3.7 to -0.9); 2/8; rho -0.181 | -1.4 (-2.7 to +1.0); 4/8; rho -0.134 |
| ridge_trend_level | +1.2 (+0.5 to +2.6); 6/8; rho -0.015 | -0.2 (-2.0 to +2.0); 3/8; rho -0.161 | -2.2 (-3.3 to -0.3); 3/8; rho -0.232 | -2.8 (-3.5 to -1.1); 2/8; rho -0.248 | -1.4 (-2.4 to +0.5); 2/8; rho -0.201 |
| gbm_all | +0.9 (-0.2 to +2.1); 5/8; rho +0.055 | -0.4 (-2.3 to +1.0); 5/8; rho -0.091 | -2.5 (-3.9 to -1.3); 3/8; rho -0.162 | -3.1 (-3.9 to -2.0); 2/8; rho -0.178 | -1.7 (-2.8 to -0.3); 3/8; rho -0.131 |

By test origin, hold-out (top-decile change, points; the last column is the average hold-out tract):

| Origin | ridge_all | ridge_trend_level | gbm_all | no_change | metro_average | momentum | cheapest_in_metro | cheapest_dollars | average tract |
|---|---|---|---|---|---|---|---|---|---|
| 2015 | 18.9 | 17.3 | 14.8 | 16.9 | 23.4 | 24.4 | 20.5 | 17.5 | 16.9 |
| 2016 | 15.8 | 15.6 | 15.1 | 16.0 | 20.3 | 21.2 | 20.5 | 17.8 | 16.0 |
| 2017 | 15.1 | 14.7 | 14.3 | 14.1 | 15.6 | 17.2 | 19.4 | 17.1 | 14.1 |
| 2018 | 20.9 | 20.1 | 23.4 | 19.3 | 21.8 | 23.1 | 25.1 | 23.2 | 19.3 |
| 2019 | 32.3 | 30.2 | 34.0 | 29.0 | 33.7 | 34.9 | 34.2 | 31.5 | 29.0 |
| 2020 | 35.7 | 35.5 | 36.1 | 31.3 | 33.0 | 35.1 | 35.4 | 34.8 | 31.3 |
| 2021 | 29.1 | 29.7 | 28.1 | 25.6 | 23.2 | 26.7 | 28.0 | 28.6 | 25.6 |
| 2022 | 9.7 | 13.9 | 9.0 | 15.1 | 7.4 | 12.0 | 16.5 | 17.9 | 15.1 |

Seen metros, later years (out of time only): 253 metros; tracts per test origin: 2015: 30,629, 2016: 31,102, 2017: 31,580, 2018: 31,650, 2019: 29,848, 2020: 25,175, 2021: 25,447, 2022: 25,040

| Method | Top-decile change, points (95% interval) | Excess over the average tract | Spearman (95% interval) |
|---|---|---|---|
| ridge_all | 22.4 (21.1 to 23.8) | +0.7 | -0.031 (-0.096 to 0.046) |
| ridge_trend_level | 22.2 (21.1 to 23.4) | +0.5 | -0.063 (-0.121 to 0.012) |
| gbm_all | 22.2 (21.3 to 23.2) | +0.5 | 0.034 (-0.010 to 0.081) |
| no_change | 21.7 (20.8 to 22.6) | +0.0 | 0.000 (0.000 to 0.000) |
| metro_average | 22.8 (19.9 to 25.3) | +1.1 | 0.171 (0.095 to 0.235) |
| momentum | 25.7 (24.3 to 27.1) | +4.0 | 0.254 (0.206 to 0.297) |
| cheapest_in_metro | 25.3 (24.3 to 26.3) | +3.7 | 0.224 (0.199 to 0.246) |
| cheapest_dollars | 23.9 (22.8 to 25.0) | +2.2 | 0.197 (0.124 to 0.262) |

Baselines at every origin, hold-out metros (top-decile change, points; no fitting):

| Origin | tracts | average tract | metro_average | momentum | cheapest_in_metro | cheapest_dollars |
|---|---|---|---|---|---|---|
| 2012 | 15,931 | 13.6 | 11.3 | 12.7 | 13.4 | 11.0 |
| 2013 | 16,295 | 15.4 | 12.9 | 19.1 | 16.2 | 13.0 |
| 2014 | 15,890 | 15.6 | 18.5 | 22.3 | 18.2 | 14.9 |
| 2015 | 15,424 | 16.9 | 23.4 | 24.4 | 20.5 | 17.5 |
| 2016 | 15,584 | 16.0 | 20.3 | 21.2 | 20.5 | 17.8 |
| 2017 | 15,779 | 14.1 | 15.6 | 17.2 | 19.4 | 17.1 |
| 2018 | 15,915 | 19.3 | 21.8 | 23.1 | 25.1 | 23.2 |
| 2019 | 15,223 | 29.0 | 33.7 | 34.9 | 34.2 | 31.5 |
| 2020 | 13,186 | 31.3 | 33.0 | 35.1 | 35.4 | 34.8 |
| 2021 | 13,356 | 25.6 | 23.2 | 26.7 | 28.0 | 28.6 |
| 2022 | 13,229 | 15.1 | 7.4 | 12.0 | 16.5 | 17.9 |

Ridge lambda chosen per test origin (all families / trend+level): 2015: 0.001 / 0.001, 2016: 0.01 / 0.001, 2017: 0.1 / 0.1, 2018: 0.1 / 0.01, 2019: 0.1 / 0.1, 2020: 0.1 / 0.1, 2021: 0.1 / 0.1, 2022: 0.1 / 0.1

Decision: FAIL
- 5-year: top-decile difference vs metro_average has a 95% interval -2.4 to +6.4 (not above zero)
- 5-year: Spearman 0.073 not above metro_average 0.081
- 5-year: top-decile difference vs momentum has a 95% interval -1.8 to +5.7 (not above zero)
- 5-year: top-decile difference vs cheapest_in_metro has a 95% interval -5.2 to -0.3 (not above zero)
- 5-year: Spearman 0.073 not above cheapest_in_metro 0.293
- 5-year: top-decile difference vs cheapest_dollars has a 95% interval -3.6 to +1.1 (not above zero)
- 5-year: Spearman 0.073 not above cheapest_dollars 0.291
- 3-year: top-decile difference vs metro_average has a 95% interval -2.3 to +2.5 (not above zero)
- 3-year: Spearman 0.053 not above metro_average 0.146
- 3-year: top-decile difference vs momentum has a 95% interval -3.5 to +0.2 (not above zero)
- 3-year: Spearman 0.053 not above momentum 0.217
- 3-year: top-decile difference vs cheapest_in_metro has a 95% interval -3.7 to -0.9 (not above zero)
- 3-year: Spearman 0.053 not above cheapest_in_metro 0.233
- 3-year: top-decile difference vs cheapest_dollars has a 95% interval -2.7 to +1.0 (not above zero)
- 3-year: Spearman 0.053 not above cheapest_dollars 0.187
