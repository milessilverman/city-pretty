# Stage 5 portfolio engine: independent review (2026-11-27)

Scope: `src/platform/portfolio/{synergy,sequencing,scenarios,optimize,index}.js`. Line numbers are those of commit 3bc1207
(before the fixes). All fixtures are synthetic. Every defect below was reproduced by a script before it was fixed.

| # | severity | file:line | defect | reproducing input and wrong output | fixed |
|---|---|---|---|---|---|
| 1 | major | optimize.js:251 | Crash when no candidate is assessable (`pool[0]` undefined) | one candidate, endPeriod 9, horizon 3: `TypeError: Cannot read properties of undefined (reading 'cost')` (12 of 400 fuzz cases) | yes, `review #1` |
| 2 | major | optimize.js:101 | Two interaction records on one pair: the search sums both but the reported objective Quantity keeps only the last | a=10, b=10, records +3 and +2: objectiveValue 25 but `totals.objective` 22, opportunity cost 12 (should be 15) | yes, `review #2` |
| 3 | major | optimize.js:83 | `conservative` compared high cost with the point budget, not the low budget | budget 100 (80..120), cost 90: chose `a`, slack 10; conservative test is 90 > 80, so nothing fits | yes, `review #3` |
| 4 | major | optimize.js:105 | Missing public-outcome value counted as 0 without being flagged; a NaN value satisfied any minimum | homes min 5, `b` has no homes: no `unknownPublicOutcome`; `{homes: NaN}` alone met min 5 | yes, `review #4` |
| 5 | major | synergy.js:111 | Capacity/land limits checked only pairwise | A, B, C each need 4 of a limit of 10: every pair 8 <= 10, so `feasible: true`; the set needs 12 > 10 | yes, `review #5` |
| 6 | major | synergy.js:171 | Unknown demand on a hard limit gave `feasible: true` | A needs 4, B has no demand: `feasible: true`; now `null` with `hardUnknown` | yes, `review #6` |
| 7 | minor | synergy.js:102 | A pair with only hard-limit records was missing from `notAssessed` although no value-stream record exists | A, B with one land_limit record: `notAssessed: []` | yes, `review #7` |
| 8 | minor | synergy.js:157 | `capped_sum` cap unit never checked against the stream unit | USD stream 176 capped to 5 by a cap in acres | yes, `review #8` |
| 9 | major | sequencing.js:86 | Street work in the period after the build reported `coordinated` (`finish` is exclusive) | start 0, duration 2 (build periods 0, 1), street work period 2: `coordinated` | yes, `review #9` |
| 10 | minor | sequencing.js:79 | Only the first sourced street-work entry for a segment was tested | entries at 8 and 1, build 0..1: `not_aligned` | yes, `review #10` |
| 11 | minor | sequencing.js:68 | Low absorption bound <= 0 silently replaced by the point value for the slowest case | 20 units at 10 (0..20): `slowestPeriods: 2`; slow case never completes | yes, `review #11` |
| 12 | minor | sequencing.js:52 | Missing `durationPeriods`/`earliestStart` scheduled as NaN and never flagged | durationPeriods undefined: finish NaN, `flagged: []` | yes, `review #12` |
| 13 | minor | optimize.js:67 | Unknown `endPeriod` passed any horizon | endPeriod null, horizon 3: chosen `a` | yes, `review #13` |
| 14 | minor | optimize.js:118 | Candidates with no IRR silently unchoosable under a minimum return | not listed anywhere; now `unknownReturn` | yes, `review #14` |

## Checked and found correct

| Area | Result |
|---|---|
| Optimiser fuzz vs own brute force (fixed-seed LCG, n 1..9, budget ranges, conservative, exclusions, requirements, outcome minimums incl. negative and missing values, minimum return with null IRR, horizon, duplicate and negative interactions, negative objectives) | 400 cases: 39 value/feasibility mismatches before (112 counting the unlisted missing outcomes), 0 after; 2000 cases after: 0. 300 of them now run in `review fuzz` |
| Ties and determinism | Same chosen set when candidates and interactions are given in reverse order (all fuzz cases); no `Math.random` or `Date` in the module |
| Next-best and opportunity cost (exact path) | Distinct from best, equals brute-force second value in every fuzz case |
| Minimum return | Cost-weighted IRR uses the same cost (point, or high when conservative) as the budget test; matches brute force |
| Synergy sign and base | Positive on `cost` lowers cost; ratio applied to the sum of the two items' amounts; streams never summed together; guard bounds low, point and high |
| Sequencing | Cycle (incl. self-dependency) named; regulatory gate inclusive (`availableFrom` 3 starts at 3); absorption `ceil(units / rate)` per bound |
| Scenarios | `subQ` gives low = aLow - bHigh, high = aHigh - bLow; unknown or missing on either side gives unknown; horizons paired by index |
| Hard-coded numbers | None real-world; only algorithm settings (`maxExact` 20, `maxPasses` 200, 1e-12 tolerance). Benchmark 200 candidates: about 0.1 s |

## Modelling choices the owner should know

- A hard-limit `resource` name is one shared pool: every item named by any record on it draws on it, and the tightest limit applies.
- Conservative mode uses high cost, low budget, and high cost as the IRR weight; the heuristic path (n > 20) is still unproven.
- An item with no entry for a value stream is left out of that stream's standalone sum (treated as not having it, not as unknown).
- `no_schedule_data` is also returned when a schedule exists but the two costs are not both sourced; `reason` tells them apart.
