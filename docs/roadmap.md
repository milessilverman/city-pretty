# Roadmap: stages, acceptance criteria and tests

Written 24 Nov 2026. A stage is done only when its tests are green (`npm test`, `npm run typecheck`,
`PW_PORT=<n> npm run test:e2e`), `docs/STATE.md` is updated and the work is committed. Tests live in
`tests/unit/platform/`. "Benchmark" means known-answer cases plus a size/time budget in the test file.

## Stage 1: shared schemas, coverage ledger, metrics, back-test harness

| Module | Acceptance criteria (each is a test) |
|---|---|
| `schema/quantity.js` | Refuses a number without unit, range, jurisdiction, date and source-or-assumption. Null operand gives null result. Interval arithmetic known answers. Status downgrades to weakest operand. |
| `schema/geo.js` | Validates each `GeoRef.kind`; rejects coordinates outside WGS84 bounds; haversine known answers. |
| `schema/opportunity.js` | `viable` impossible unless all three checks pass; any `unknown` check gives `needs_info`; `ValueStreams` has no total and refuses to be summed. |
| `schema/categories.js` | All 17 parcel categories plus street, open-space, transit, utility and facility categories present with `requiredInputs`. |
| `coverage/ledger.js` | Every catalogue category for a location ends in exactly one of evaluated-found, rejected (with reason), needs-info (with missing list) or not-evaluated (with reason). Missing data never yields "rejected". |
| `coverage/metrics.js` | Recall, precision, F1 with known answers; undefined (not 0) when the denominator is 0. |
| `coverage/backtest.js` | Throws if any input record is dated after the cut-off (leakage guard). Ground truth must include failed/cancelled projects and plausible alternatives; a truth set with only successes is refused (survivorship guard). |
| Benchmark | Ledger for 10,000 locations x 30 categories within 2 s. |

## Stage 2: impact geography

| Acceptance criteria |
|---|
| Network distance by Dijkstra over a street graph; known answers on a grid fixture; differs from straight line where a barrier forces a detour. |
| Barriers (freeway, rail, wall, water) cut edges unless a crossing exists. |
| Each improvement type has its own model record: direction, decay form, reach, cited source. No model record gives `requires_investigation`, never a default radius. An EV charger, park, grocery, rail station and speed hump cannot share one model. |
| Negative effects (noise, traffic) are separate signed cells, not netted silently. |
| Overlapping impact areas of several improvements are combined through one guard so a parcel is not counted twice. |
| Output resolution is `parcel` only if parcel refs were supplied; no network gives `straight_line_fallback` with lower confidence. |
| Block groups appear only as demographic inputs (area-weighted to cells). |
| Benchmark: 5,000-node graph, 20 improvements, within 3 s. |

## Stage 3: opportunity discovery

| Acceptance criteria |
|---|
| Exhaustive: every applicable category x every location is screened and lands in the ledger; result count equals categories x locations. |
| Problem-first: a measured deficit (for example crash count, canopy gap) maps to candidate categories; no deficit data gives needs-info. |
| Asset-first: underused, vacant, surface-parking and unused-development-rights rules flag parcels from attributes; missing attribute gives needs-info. |
| Combination: adjacent-parcel assembly and cross-category pairs are generated within a stated bound. |
| Parcel feasibility: all 17 parcel categories have a rule set; each evaluates several uses (develop, preserve, public space, coordinated). |
| AI exploration: ideas must match the fixed schema; malformed, unsourced or numeric-claim ideas are rejected; accepted ideas are `candidate` only. Eight specialist roles defined. |
| Pilot adapter: Los Angeles County underused-site records become schema objects without inventing fields. |
| Benchmark: 10,000 parcels x all parcel categories within 5 s. |

## Stage 4: underwriting and P3

| Acceptance criteria |
|---|
| NPV and IRR known answers (including no-sign-change gives IRR undefined, multiple-IRR flagged). |
| Cash flow built from capex, O&M, revenue and financing schedules; debt service known answers. |
| Risk-adjusted return from stated scenario probabilities; no probabilities gives `requires_investigation`. |
| Max private contribution = largest amount at which investor return still meets the hurdle; min public contribution = total cost minus that, floored at 0; both parties benefit only inside the reported range; empty range reported as "no deal". |
| Minimum subsidy is computed, never maximum. |
| P3 vs conventional vs private compared on lifecycle cost with an explicit risk-allocation table. |
| Municipal fiscal effect separate from investor cash flow and from appreciation. |
| Funding catalogue: every mechanism has eligibility rules, match, deadline, certainty; grants are never counted as secured; California-only tools refuse other states. |
| Benchmark: 10,000 underwriting runs within 3 s. |

## Stage 5: synergy, sequencing, scenarios, optimisation

| Acceptance criteria |
|---|
| Synergy and negative synergy are explicit pair records with a cited basis; no record gives zero interaction and a "not assessed" flag. |
| Combined value never exceeds the double-counting guard. |
| Sequencing respects dependencies; coordinated-with-street-reconstruction cost vs standalone is reported when a schedule exists, else "no schedule data". |
| Scenarios: baseline vs hypothetical, with horizon, phasing and ranges. |
| Optimiser: maximises the chosen objective under budget, minimum return, horizon and public-outcome constraints; exact answer on small fixtures matches brute force; reports opportunity cost of the next-best portfolio. |
| Benchmark: 200 candidates optimised within 5 s. |

## Stage 6+: scaffolds only in this run

| Item | Acceptance criteria |
|---|---|
| StreetForge contract | Validator plus mock adapter; mock reports only capabilities seen in StreetForge's source; cost is `unavailable`. |
| Regulatory framework | Each conclusion carries jurisdiction, source, effective date, uncertainty; California modules refuse non-California parcels; unpopulated topics return `requires_investigation`. |
| Quality of life | Thirteen dimensions, user weights, shown beside returns without being converted to dollars. |
| Data needs | `docs/data-needs.md` ranked by consuming module. |
| UI | Minimal read-only panel for platform outputs. Deferred unless Stages 1 to 5 are green. |

## Not in this run (and why)

Splitting `app/app.js`, removing the old EIFD panel, ingesting new datasets, nationwide adapters, a live
StreetForge link: none is on the critical path of Stages 1 to 5. Each is logged in `docs/STATE.md`.
