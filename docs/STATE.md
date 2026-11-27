# STATE (rewritten, not appended; the working memory for every session and subagent)

Last updated: 27 Nov 2026, after the second run (draw-your-own-area tool, effect bubbles, cost chart, remaining rule sets, Stage 5 review).

## Read first

- Plan and contracts: `docs/architecture.md` (schemas, module map), `docs/roadmap.md` (acceptance criteria).
- Audit: `docs/audit.md`; evidence in `docs/audit/stage0-*.md`. Review: `docs/audit/stage-gate-review.md`.
- Pilot result: `docs/audit/pilot-la-coverage.md` and `pilot-la-backtest.md` (generated; do not edit by hand).
- Data needs: `docs/data-needs.md`. What the data costs: `docs/data-costs.md`. Distance evidence: `docs/audit/impact-distance-effects.md`.
- Reviews: `docs/audit/stage-gate-review.md` (Stages 2, 4, regulation), `docs/audit/stage5-review.md` (Stage 5).
- Repo rules: `CLAUDE.md` (R2 10 GB hard limit; never type an unfetched number; tests before commit).

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | New analysis lives in `src/platform/`; `app/app.js` and `src/engines/*` are not edited | Additive work keeps the existing page and its tests green |
| D2 | Plain ES modules + JSDoc + `// @ts-check`; type check via `src/platform/tsconfig.json` | Static site has no build step |
| D3 | Engines contain no numeric parameters; all are provenance-carrying inputs; missing gives `requires_investigation` | Accuracy rules |
| D4 | Pilot: Los Angeles County 06037; regulatory pilot: California (City of Los Angeles rows are unsourced) | Best data coverage |
| D5 | Test fixtures are synthetic and labelled `FIXTURE: not real data` | Keeps invented numbers out of product data |
| D6 | StreetForge is contract + mock only | Its source shows a design tool with no cost or API output |
| D7 | A deal test and the recommended public contribution are compared in present value; every figure is labelled nominal or PV | Review finding 4 |
| D8 | The financial check passes on NPV at the hurdle rate, not on IRR alone | Review finding 2 |
| D9 | Back-test: a prediction matching nothing in the truth set is "unjudged", not a false positive | Truth sets are never complete |
| D10 | A funding record whose fetched text is known to be superseded is `requires_investigation` | Opportunity-zone text amended after the fetched edition |
| D11 | A drawn area runs the existing engine (`recommendForNeighborhood`) once per block group and adds only the engine's own figures; no new scoring | Owner asked for the same algorithm on any boundary |
| D12 | Bubbles are drawn only from `app/data/impact_distance_effects.json` (verbatim-quoted distance bands); no record, no ring | No default radius; the speed-hump study gives no distance |
| D13 | Bubble homes and dollar changes are block-group estimates shown to two significant figures; nested "within" bands are never added | No parcel data stored; avoid false precision |
| D14 | No street network is stored; rings use straight-line distance and say so | Owner: no added cost; most cited studies use straight-line bands |

## Status

| Stage | Status | Tests (in `tests/unit/platform/`) |
|---|---|---|
| 0 Audit | done | baseline 854 unit, 80 browser |
| 1 Schemas, coverage ledger, metrics, back-test harness | done | `schema`, `coverage` |
| 2 Impact geography | done | `impact` |
| 3 Discovery (4 methods, 17 parcel + 20 non-parcel rule sets, AI idea intake) | done | `discovery`, `pilotBundle` |
| 4 Underwriting and P3 | done, reviewed, fixed | `underwriting` |
| 5 Synergy, sequencing, scenarios, optimiser | done, reviewed (8 major, 6 minor), fixed | `portfolio` (includes a 300-case fuzz against brute force) |
| 6 Regulatory framework, StreetForge contract, quality of life, data needs, results page | scaffolded | `regulatory`, `streetforge`, `qol`, `tests/e2e/platform.spec.ts` |
| Pilot run | done | `pilotRun` (fails if `app/data/platform_pilot_la.json` is stale), `pilotBacktest` |
| Draw-your-own-area tool (main page) | done | `boundary`, `tests/e2e/boundary.spec.ts` |
| Effect bubbles (main page) | done for 7 improvement types | `distanceEffects`, `tests/e2e/bubbles.spec.ts` |

Totals on 27 Nov 2026: 1,138 unit tests, typecheck clean (Worker files + `src/platform`), 87 browser tests.

## Pilot result (Los Angeles County, as of 2026-11-24; regenerate with `node scripts/platform_pilot_la.mjs <date>`)

- 3,968 of 8,800 site records are located (776 lots, 2,662 crossings, 530 charger sites); street-calming and
  creek records carry no point.
- 35,644 evaluations: 0 viable, 0 candidate, 0 rejected, 35,644 need information (every category now has a rule
  set, so none is "not evaluated").
- Why nothing is viable: no sourced costs, revenues, period count or hurdle rate; no engineering check; no
  screening criteria supplied; no repo file states the units of the site file's fields (its build script is not
  in the repo), so lot area is unusable.
- City is known for 2,338 of 3,968 records (from the containing block group); 999 sit in block groups missing
  from the bundle.
- Regulation: 18,709 conclusions, all "requires investigation".
- Back-test: not possible. The 6,379 tracked projects contain no failed or cancelled project and no kind that
  maps to a category; the harness refused (`docs/audit/pilot-la-backtest.md`).

## Main-page features added 27 Nov 2026

- `app/boundary.js` ("Draw an area"): ranked improvements for any drawn shape from the existing engine, located
  sites per improvement, other located sites in the area. Pure logic in `src/platform/boundary/area.js`.
- `app/bubbles.js` ("Show effect area"): rings per cited distance band, study, quote, where measured, estimated
  homes and change in home values per band, projects already inside, improvements that could be added alongside.
  Pure logic in `src/platform/pilot/distanceEffects.js`.
- Evidence: 7 keys verified (street_trees, pocket_park, protected_bike [negative], vacant_lot_green, noise_wall,
  grocery, corridor_trail); 5 without a cited distance (traffic_calming, park_upgrade, crosswalks, ev_hub,
  street_lighting). Three verified records rest on a fetched abstract, not the full text.

## Module ownership (one owner per directory)

`schema/`, `coverage/` Stage 1 · `impact/`, `pilot/impactModels.js` Stage 2 · `discovery/`, `pilot/laBundle.js`
Stage 3 · `underwriting/` Stage 4 · `portfolio/` Stage 5 · `regulatory/`, `streetforge/`, `qol/` Stage 6 ·
`pilot/laSites.js`, `pilot/laProjects.js`, `pilot/runPilot.js`, `scripts/platform_pilot_la.mjs`, `app/platform.*` pilot ·
`boundary/`, `app/boundary.js` area tool · `pilot/distanceEffects.js`, `app/bubbles.js` bubbles.

## Contract notes that differ from the first draft of `docs/architecture.md`

- Arithmetic on Quantities always yields status `estimated`; opportunity status is derived from checks only.
- Physical screening failures sit on the engineering check with `basis: 'physical'`; `preserve` is the baseline use.
- Regulatory conclusions carry `appliesToCategories`; a conditional passes only when its conditions are known true.
- Impact registry: one model per (category, target, most specific variant); `selectModel` returns one or null.
- Funding rules: within an `alternativeGroup` label all rules must hold; one label must hold in full.
- Private contribution is a pro-rata share of each period's cost; the solve is unlevered.

## Open items

| Item | Where | Why open |
|---|---|---|
| Units of the site file's fields (`ac`, `lav`, ...) | `pilot/laSites.js` (`UNIT_SEARCH`) | Build script not in the repo; needs the assessor source re-fetched |
| Crossing counts (`ped`, `bike`, `killed`) are not mapped to rule inputs | `pilot/laSites.js` | Their definitions are not stated in the file |
| No cited distance for speed humps, crosswalks, EV chargers, street lighting, park renovation | `app/data/impact_distance_effects.json` | Two sources tried per type; full texts blocked or none found |
| Rings are straight-line; freeways and rail do not cut them yet | `app/bubbles.js` | The impact engine supports barriers; the page does not call it yet |
| Area totals add engine figures per block group; partly-inside block groups are flagged, not prorated | `src/platform/boundary/area.js` | Engine figures are per whole block group |
| Bubbles and the area tool are not yet available to the AI advisor | `workers/advisorAgent.ts` | Needs a Worker tool and redeploy |
| AB 2011 repeal date is prose in the record, not a field | `app/data/statutes.json` | Rule stays applied with high uncertainty; add `repeal_date` from the fetched statute |
| PAB, LIHTC, historic credit and SS4A sunsets are text only; opportunity zones need current text | `underwriting/data/funding_mechanisms.json` | Eligibility is "unknown" until dates are fetched |
| Old EIFD panel, back-test defaults, SB 9 page text, duplicate statutes file, stale engine-copies doc | see `docs/audit.md` | Existing page code; out of scope for this run |
| No back-test can run on the data in the repo | `coverage/backtest.js` | Needs dated project outcomes including failed and cancelled ones |
| Results page table scrolls sideways at phone width | `app/platform.html` | Analytics before polish |

## Open questions for the owner

1. Which paid data to buy, if any: see `docs/data-costs.md` (one published price; three providers quote only).
   Also the owner's own minimum acceptable return and screening thresholds.
2. GitHub Pages 1 GB cap vs `counties/` in the repo (from `docs/WORK-QUEUE.md`), unchanged by this work.
3. Whether `app/platform.html` should be linked from the main page.
