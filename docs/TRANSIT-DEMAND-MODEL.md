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

## 8. Where a line would run

Corridor stop cities are Census place points, and pipeline stations in `transit_pipelines.json` are marked as unverified
illustrative locations. Station sites are not chosen in the documents. Per-stop figures rank stops against each other
only.

## Results

(Written by the fitting script after this method was committed.)
