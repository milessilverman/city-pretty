# Transit demand model: riders, fares, operating gap, capital cost

Status: **method fixed 22 Nov 2026, before any fit was run.** Results are added below the line "Results" by the fitting
script's run, never edited by hand. Fitting script: `scripts/transit/fit_station_ridership.py`. Engine:
`src/engines/transitDemandEngine.js`. Model file: `app/data/transit_demand_model.json`.

## 1. What the model is for, and what it cannot do

It ranks stations against each other from the people and jobs around them, and turns a line's predicted riders into
fare revenue, operating cost, an operating gap and a capital cost, each as a range from sourced tables.

It is fitted on 7 systems whose station counts are measured differently (entries, boardings, weekday, all days, years
2018 to 2026; see `docs/audit/transit-operating-data-2026-11-22.md` section c). So:

- **Within a system** (which station gets more riders than which) can be tested, and is.
- **The absolute level for a new system cannot be validated from 7 systems.** It is only bracketed: the range of levels
  the 7 systems show, applied to the new line. The page says so beside every rider figure.

## 2. Data (all on file; nothing typed)

| Input | File | How it is used |
|---|---|---|
| Station boardings | `data/transit/station_boardings.csv` | outcome: `avg_boardings_per_day` |
| People and homes | county bundles `counties/bundle_<fips>.json.gz` (ACS 2020-2024 5-year block groups: `pop`, `homes`, 2020 block-group polygons) | ring sums |
| Jobs | `data/signals/lodes_wac_bg_50counties.csv.gz` (block group) where the county is in it; otherwise `lodes_wac_tract_*.csv.gz` (tract) spread over the tract's block groups by polygon area. LODES8 WAC, all jobs, year 2023 | ring sums |
| Other stations (transfer flag) | the same station file, plus each bundle's OpenStreetMap `layers.stations` points | flag |

Rings: a circle of 0.5 mile and the annulus 0.5 to 1 mile around the station point, in a local flat projection. A
block group contributes `count x (polygon area inside the ring / polygon area)`: counts are assumed spread evenly over
the polygon (water and parks inside a block group are not removed; this is crude for large block groups).

## 3. Predictors (computable anywhere from data on file)

- `ln(1 + people within 0.5 mi)`, `ln(1 + jobs within 0.5 mi)`
- `ln(1 + people 0.5-1 mi)`, `ln(1 + jobs 0.5-1 mi)`
- `terminal` (0/1): for a fitted system, a station of degree 1 in the minimum spanning tree of that system-mode's
  station points (an approximation of "end of a line"); for a new line, the first and last stop of its ordered list.
- `transfer` (0/1): another rail station within 0.25 mi (400 m): a different row of the station file, or two or more
  OpenStreetMap station points in the bundle within that distance. For a new line, any existing station point within
  0.25 mi.
- Homes in the rings are computed and shown but **not** used as a predictor (they move almost one-for-one with people).
- Service level: station-level rail frequency is not on file (no rail GTFS frequency table in the repository). NTD gives
  service only by system, which the system term absorbs. Service level is therefore **not** a predictor; stated as a gap.
- Mode: separate fits by NTD mode: heavy rail (HR), light rail (LR), commuter rail (CR). Groups with fewer than 20
  stations (UTA S-line streetcar, NYC tram, Staten Island Railway, MBTA rows coded HR/LR) are not fitted.

## 4. Form

`ln(boardings) = a_system + b . x + e`, ordinary least squares, one intercept per system (the system term absorbs the
measure, year, day basis, fare policy and service level of each system), slopes shared within the mode.

## 5. Test: leave one system out, within mode

For each system S of a mode with at least 2 systems: fit on the other systems of that mode; predict S with the slopes
and (a) the mean of the training systems' intercepts, (b) then a single scaling factor for S: the factor that makes the
median of ln(observed / predicted) zero on S (it uses S's own level, which is exactly what cannot be known for a new
system). Reported per held-out system:

- Spearman rank correlation between predicted and observed (unaffected by scaling);
- median absolute percentage error, `median(|pred - obs| / obs)`, after the scaling (b);
- the scaling factor itself (how far the training systems' average level was from S's level): the spread of these is
  the level bracket for a new system.

Baselines, scored the same way:
1. **System average**: every station of S predicted at one value (after scaling, S's median); rank correlation is not
   defined (reported as none).
2. **People + jobs in the half mile**: prediction proportional to `people + jobs within 0.5 mi`, scaled the same way.

The model is shown on the page only with its own test results, and if it does not beat baseline 2 in rank correlation
and error for a mode, the page says so and shows the result anyway with that warning.

Published direct-ridership-model coefficients: to be fetched from TCRP (onlinepubs.trb.org, nap.edu) or FTA STOPS
documentation and tested on the same stations if reachable; never typed from memory.

## 6. From riders to money (engine; every figure a range with its basis)

- Weekday boardings at a stop: `exp(a + b . x)`, with `a` taken across the fitted systems' intercepts (lowest to highest),
  so the range is the bracket of system levels; the per-stop error band (10th and 90th percentile of the held-out log
  errors after scaling) is reported beside it.
- Annual trips: line weekday boardings x the ratio of the system's NTD annual unlinked trips to the sum of its station
  weekday counts on file (computed per fitted system for the same mode and nearest report year; range across systems).
  This puts riders on NTD's own trip basis, so NTD per-trip fares and costs apply to it directly.
- Fare revenue = annual trips x NTD fare revenue per trip (25th to 75th percentile for the mode, 2025), or the named local
  agency's own 2025 figure when that agency reports the mode.
- Operating cost = vehicle revenue hours x NTD operating cost per revenue hour (25th-75th percentile). Revenue hours by
  default = directional route miles (2 x length) x NTD revenue hours per directional route mile (25th-75th percentile for
  the mode). A stated plan (span in hours, headway in minutes, cars per train, days) may be given instead, with NTD's
  average speed (revenue miles / revenue hours) for the mode. Cross-check: annual trips x NTD operating cost per trip.
- Operating gap = operating cost minus fare revenue (low = cost low - fares high; high = cost high - fares low).
- Capital cost = length x the cost-per-mile range of `app/data/transit_cost_benchmarks.json` rows of that mode (tunnel-share
  band when the caller gives one and rows with that band exist), lowest to highest and median, dollar years as published.
- Modes without station data (bus, BRT, streetcar): riders come only from NTD trips per directional route mile for the
  mode (25th-75th percentile), which knows nothing about the land around the stops; labelled as such.

## 7. Mode recommendation

FTA's measure is (annualised capital + annual operating cost) / annual trips, rated on the 2025 breakpoints already
quoted in `investmentDecisionEngine.js`. FTA's annualisation factors are not on file (the CIG guidance PDF and its
archive copy could not be fetched again on 22 Nov 2026; no factor was typed). Because annualised capital is never below
zero, **operating cost per trip is a floor on FTA's cost per trip**, so it gives the best rating a mode could possibly
get. Per mode the engine reports: riders (range), capital cost per annual rider (range), operating gap per rider
(range), operating cost per trip and the best possible FTA rating it allows.

The mode that fits: the largest mode on the ladder bus frequency -> BRT -> light rail -> heavy rail (commuter rail
reported beside it, as in `evaluateTransit`) that (a) the density screen supports when density is known, and (b) can
still rate Medium or better (operating cost per trip, at the midpoint of its range, under $20). The runner-up is the
next mode down that passes; if none passes, "none fits" with the reason. A mode whose riders or costs are not on file
is listed with what is missing and is not chosen.

**Change on 22 Nov 2026, after the first run (the station model and its test were not changed):** the rule above
ignores capital, so on the first run (Austin light rail, Chicago Red Line extension) every mode passed the operating
floor and the largest mode always won. The rule used now: of the modes that pass (a) and (b), the one with the
**lowest capital cost per annual rider** (middle of its range) fits and the next lowest is the runner-up. A mode with
no capital benchmark (ordinary bus service) is listed as passing but is not ranked on capital. Known bias: bus and BRT
riders come from NTD trips per route mile of operating systems, not from the land around the stops, so the comparison
of BRT with rail mixes two kinds of rider estimate; the page says so beside it.

## 8. Where a line would run

Corridor stop cities are Census place points, and pipeline stations in `transit_pipelines.json` are marked as unverified
illustrative locations. Station sites are not chosen in the documents. Per-stop figures rank stops against each other
only.

## Results

<!-- RESULTS:BEGIN (written by scripts/transit/fit_station_ridership.py; do not edit by hand) -->

Dropped station rows: {'no_coordinates': 4, 'outside_block_groups_on_file': 35, 'zero_count': 0}.

### heavy rail (HR): 651 stations in 5 systems

| Held-out system | Stations | Model rank corr. | Model error* | People+jobs rank corr. | People+jobs error* | System-average error* | Level factor |
|---|---|---|---|---|---|---|---|
| Chicago Transit Authority | 143 | 0.58 | 41% | 0.58 | 51% | 58% | 0.49 |
| MTA New York City Transit | 399 | 0.64 | 50% | 0.66 | 45% | 56% | 1.27 |
| Maryland Transit Administration | 14 | 0.64 | 29% | 0.38 | 52% | 33% | 1.04 |
| Massachusetts Bay Transportation Authority | 48 | 0.47 | 46% | 0.46 | 50% | 41% | 1.47 |
| San Francisco Bay Area Rapid Transit District | 47 | 0.62 | 27% | 0.63 | 33% | 40% | 1.34 |

Median over held-out systems: model rank correlation 0.62, error 41%; people+jobs baseline 0.58, 50%; system average error 41%. Beats the people+jobs baseline on both: True. Lower error than the system average: False. Level factors (training systems' average level vs the held-out system's own) ranged 0.49 to 1.47.

Coefficients (all systems of the mode): ln_pop_half +0.090 (s.e. 0.074); ln_jobs_half +0.300 (s.e. 0.046); ln_pop_ring +0.166 (s.e. 0.090); ln_jobs_ring +0.054 (s.e. 0.054); terminal +0.367 (s.e. 0.076); transfer +0.145 (s.e. 0.123). Within-system R2 in sample 0.43.

### light rail (LR): 183 stations in 4 systems

| Held-out system | Stations | Model rank corr. | Model error* | People+jobs rank corr. | People+jobs error* | System-average error* | Level factor |
|---|---|---|---|---|---|---|---|
| Maryland Transit Administration | 33 | 0.24 | 45% | 0.31 | 65% | 41% | 1.13 |
| Massachusetts Bay Transportation Authority | 65 | 0.32 | 50% | 0.43 | 56% | 38% | 0.74 |
| Utah Transit Authority | 44 | 0.43 | 49% | 0.52 | 55% | 52% | 0.94 |
| Valley Metro Rail | 41 | -0.07 | 45% | 0.03 | 56% | 33% | 1.51 |

Median over held-out systems: model rank correlation 0.28, error 47%; people+jobs baseline 0.37, 56%; system average error 39%. Beats the people+jobs baseline on both: False. Lower error than the system average: False. Level factors (training systems' average level vs the held-out system's own) ranged 0.74 to 1.51.

Coefficients (all systems of the mode): ln_pop_half -0.038 (s.e. 0.118); ln_jobs_half +0.181 (s.e. 0.086); ln_pop_ring +0.109 (s.e. 0.144); ln_jobs_ring +0.083 (s.e. 0.111); terminal +0.342 (s.e. 0.181); transfer -0.171 (s.e. 0.158). Within-system R2 in sample 0.17.

### commuter rail (CR): 53 stations in 2 systems

| Held-out system | Stations | Model rank corr. | Model error* | People+jobs rank corr. | People+jobs error* | System-average error* | Level factor |
|---|---|---|---|---|---|---|---|
| Maryland Transit Administration | 37 | 0.36 | 73% | 0.33 | 86% | 65% | 0.57 |
| Utah Transit Authority | 16 | 0.79 | 34% | 0.80 | 25% | 41% | 3.05 |

Median over held-out systems: model rank correlation 0.57, error 53%; people+jobs baseline 0.57, 56%; system average error 53%. Beats the people+jobs baseline on both: True. Lower error than the system average: False. Level factors (training systems' average level vs the held-out system's own) ranged 0.57 to 3.05.

Coefficients (all systems of the mode): ln_pop_half +0.804 (s.e. 0.669); ln_jobs_half +0.387 (s.e. 0.425); ln_pop_ring -0.687 (s.e. 0.772); ln_jobs_ring -0.189 (s.e. 0.499); terminal +0.900 (s.e. 0.637); transfer +0.349 (s.e. 0.538). Within-system R2 in sample 0.17.

\* median absolute percentage error after one system-level scaling factor.

**What this can say for a new line:** the order of its stops, and the level only as a bracket: the range of the fitted systems' own levels, which is the spread of the level factors above. It cannot say which end of that bracket a new system will land on.

Annual NTD trips per weekday station count (used to annualise): Chicago Transit Authority HR: 387; MTA New York City Transit HR: 578; Maryland Transit Administration CR: none (station counts are not weekday counts of 2020 or later, so no NTD year matches); Maryland Transit Administration HR: none (station counts are not weekday counts of 2020 or later, so no NTD year matches); Maryland Transit Administration LR: none (station counts are not weekday counts of 2020 or later, so no NTD year matches); Massachusetts Bay Transportation Authority HR: 299; Massachusetts Bay Transportation Authority LR: 498; San Francisco Bay Area Rapid Transit District HR: 275; Utah Transit Authority CR: 285; Utah Transit Authority LR: 344; Valley Metro Rail LR: none (station counts are not weekday counts of 2020 or later, so no NTD year matches).

<!-- RESULTS:END -->

## Reading the results (written 22 Nov 2026 after the run above)

- **Heavy rail:** the model orders stations a little better than "people + jobs in the half mile" (median rank
  correlation 0.62 against 0.58) and its error after one scaling factor is lower than that baseline's (41% against 50%),
  but **no lower than calling every station the system median (41%)**. So it ranks stations; it does not size them
  better than the system average does.
- **Light rail:** the model is **worse** than the people + jobs baseline at ordering stations (0.28 against 0.37) and
  worse than the system average on error (47% against 39%). Light-rail station boardings in these four systems are not
  explained by people and jobs around the stop as measured here. The page shows light-rail riders with that warning.
- **Commuter rail:** two systems only (MARC, FrontRunner); each test trains on one system. Treat as untested.
- **Level for a new system:** the held-out systems' levels sat 0.49 to 1.47 times (heavy rail), 0.74 to 1.51 times
  (light rail) and 0.57 to 3.05 times (commuter rail) the training systems' average. That is the honest bracket.
- **The transfer flag** as fixed in the method is 1 for nearly every station in New York, Boston and BART (the
  OpenStreetMap layer has several points per station, and dense networks have a station within 0.25 mi), so it carries
  little information there. It was kept as committed, not tuned after the fact.
- **Jobs:** Maryland counties are not in the 50-county block-group LODES table, so their jobs are tract totals spread by
  area; this blurs the half-mile ring for MARC, Baltimore Metro and Light RailLink.
- **35 station rows** fall outside the block groups on file (mostly points on piers, in water or at county edges whose
  bundle polygon does not contain them) and 4 have no coordinates; they are left out, not imputed.
- **Published direct-ridership-model coefficients were not obtained** (TCRP Report 153: onlinepubs.trb.org gave an empty
  reply, the archive copy reset the connection, nap.edu wants a sign-in to download; FTA STOPS documentation is on
  transit.dot.gov, which refuses this machine). None were typed from memory, so none are tested here.
