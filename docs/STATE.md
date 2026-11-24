# STATE (rewritten, not appended; the working memory for every session and subagent)

Last updated: 24 Nov 2026, end of the first platform run (Stages 0 to 5 built, Stage 6 scaffolded).

## Read first

- Plan and contracts: `docs/architecture.md` (schemas, module map), `docs/roadmap.md` (acceptance criteria).
- Audit: `docs/audit.md`; evidence in `docs/audit/stage0-*.md`. Review: `docs/audit/stage-gate-review.md`.
- Pilot result: `docs/audit/pilot-la-coverage.md` (generated; do not edit by hand). Data needs: `docs/data-needs.md`.
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

## Status

| Stage | Status | Tests (in `tests/unit/platform/`) |
|---|---|---|
| 0 Audit | done | baseline 854 unit, 80 browser |
| 1 Schemas, coverage ledger, metrics, back-test harness | done | `schema`, `coverage` |
| 2 Impact geography | done | `impact` |
| 3 Discovery (4 methods, 17 parcel rule sets, AI idea intake) | done | `discovery`, `pilotBundle` |
| 4 Underwriting and P3 | done, reviewed, fixed | `underwriting` |
| 5 Synergy, sequencing, scenarios, optimiser | done (not independently reviewed) | `portfolio` |
| 6 Regulatory framework, StreetForge contract, quality of life, data needs, results page | scaffolded | `regulatory`, `streetforge`, `qol`, `tests/e2e/platform.spec.ts` |
| Pilot run | done | `pilotRun` (fails if `app/data/platform_pilot_la.json` is stale) |

Totals on 24 Nov 2026: 1,078 unit tests, typecheck clean (Worker files + `src/platform`), 81 browser tests.

## Pilot result (Los Angeles County, as of 2026-11-24; regenerate with `node scripts/platform_pilot_la.mjs <date>`)

- 3,968 of 8,800 site records are located (776 lots, 2,662 crossings, 530 charger sites); street-calming and
  creek records carry no point.
- 35,644 evaluations: 0 viable, 0 candidate, 0 rejected, 13,192 need information, 22,452 not evaluated
  (non-parcel categories have no rule set yet).
- Why nothing is viable: no sourced costs, revenues, period count or hurdle rate; no engineering check; no
  screening criteria supplied; the site file states no units, so lot area is unusable; no record states its city.
- Regulation: 17,848 conclusions, all "requires investigation". Impact: 6 rail-station models, 36 categories
  without a model, 0 impact areas computed.

## Module ownership (one owner per directory)

`schema/`, `coverage/` Stage 1 · `impact/`, `pilot/impactModels.js` Stage 2 · `discovery/`, `pilot/laBundle.js`
Stage 3 · `underwriting/` Stage 4 · `portfolio/` Stage 5 · `regulatory/`, `streetforge/`, `qol/` Stage 6 ·
`pilot/laSites.js`, `pilot/runPilot.js`, `scripts/platform_pilot_la.mjs`, `app/platform.*` pilot.

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
| Non-parcel categories (street, open space, transit, utility, facility) have no feasibility rule sets | `discovery/feasibility.js` | Stage 3 scope was the 17 parcel categories; 22,452 pilot evaluations wait on this |
| Units for lot area and land value in the site file; city per record | `pilot/laSites.js` | The file does not state them; needs the assessor source |
| AB 2011 repeal date is prose in the record, not a field | `app/data/statutes.json` | Rule stays applied with high uncertainty; add `repeal_date` from the fetched statute |
| PAB, LIHTC, historic credit and SS4A sunsets are text only; opportunity zones need current text | `underwriting/data/funding_mechanisms.json` | Eligibility is "unknown" until dates are fetched |
| Optimiser treats a missing public-outcome value as 0 toward a minimum (conservative, not flagged) | `portfolio/optimize.js` | Should be listed as unknown |
| Pilot station distance is built outside `makeQuantity` | `pilot/laSites.js` | Use the derived-Quantity helper |
| Stage 5 has had no independent review | `portfolio/` | One reviewer run was spent on finance, regulation, impact |
| Old EIFD panel, back-test defaults, SB 9 page text, duplicate statutes file, stale engine-copies doc | see `docs/audit.md` | Existing page code; out of scope for this run |
| No back-test has been run on real outcomes | `coverage/backtest.js` | Needs dated project outcomes including failures (`docs/data-needs.md`) |
| Results page table scrolls sideways at phone width | `app/platform.html` | Analytics before polish |

## Open questions for the owner

1. Which sourced cost, rent and effect-size datasets may be ingested or licensed (decides when pilot outputs leave
   "requires investigation"). Ranked list in `docs/data-needs.md`.
2. GitHub Pages 1 GB cap vs `counties/` in the repo (from `docs/WORK-QUEUE.md`), unchanged by this work.
3. Whether `app/platform.html` should be linked from the main page.
