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

(none yet)
