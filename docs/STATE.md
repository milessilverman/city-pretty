# STATE (rewritten, not appended; the working memory for every session and subagent)

Last updated: 24 Nov 2026, end of Stage 0.

## Read first

- Plan and contracts: `docs/architecture.md` (schemas, module map), `docs/roadmap.md` (acceptance criteria).
- Audit: `docs/audit.md` (summary); evidence in `docs/audit/stage0-code.md`, `stage0-data.md`, `stage0-analysis.md`.
- Repo rules: `CLAUDE.md` (R2 10 GB hard limit; never type an unfetched number; tests before commit).

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | New analysis lives in `src/platform/`; `app/app.js` and `src/engines/*` are not edited | 11k-line monolith with drift-guarded copies; additive work keeps 854 unit + 80 browser tests green |
| D2 | Plain ES modules + JSDoc + `// @ts-check`; type check via `src/platform/tsconfig.json` | Static site has no build step |
| D3 | Engines contain no numeric parameters; all are provenance-carrying inputs; missing gives `requires_investigation` | Accuracy rules; 46 of 81 catalogue effects are unverified |
| D4 | Pilot: Los Angeles County 06037; regulatory pilot: California + City of Los Angeles | Best data coverage; California law applies there |
| D5 | Test fixtures are synthetic and labelled `FIXTURE: not real data` | Keeps invented numbers out of product data |
| D6 | StreetForge is contract + mock only | Its source shows a design tool with no cost or API output |
| D7 | Tests in `tests/unit/platform/`; benchmark = known answers + size/time budget | Roadmap |

## Status

| Stage | Status | Notes |
|---|---|---|
| 0 Audit | done | Baseline 24 Nov: 854 unit, typecheck clean, 80 e2e |
| 1 Schemas, coverage, back-test | next | |
| 2 Impact geography | queued | |
| 3 Discovery | queued | |
| 4 Underwriting and P3 | queued | |
| 5 Synergy, sequencing, scenarios, optimiser | queued | |
| 6 Scaffolds | queued | StreetForge, regulatory, QoL, data needs |

## Module ownership (one owner per directory; no two agents edit the same file)

| Path | Owner stage |
|---|---|
| `src/platform/schema/`, `src/platform/coverage/`, `src/platform/tsconfig.json`, `package.json` typecheck line | 1 |
| `src/platform/impact/` | 2 |
| `src/platform/discovery/`, `src/platform/pilot/` | 3 |
| `src/platform/underwriting/` | 4 |
| `src/platform/portfolio/` | 5 |
| `src/platform/regulatory/`, `streetforge/`, `qol/`, `docs/data-needs.md` | 6 |

## Pilot data facts (Los Angeles County bundle, read 24 Nov 2026 from `app/data/bundle-la.b64.txt`)

- base64 of gzip JSON. Keys: `bgs` (6,587 block-group features), `under.sites` (9,411 records with keys such as
  `k`, `use`, `ac`, `lav`, `by`, `mkt`, `z`, `zc`, `rail`), `under.assumptions` (unverified), `zone_rules` (14),
  `layers` (`freeways`, `arterials`, `rail`, `walls`, `water`, `parks`, `stations`, `stops` as GeoJSON;
  `streets` is a name grid, not a network; `projects` 6,379 rows with status and year; `zoning` cells).
- Parcels: live look-up only (`app/data/parcel_services.json`). No stored parcel geometry.

## Open items (logged, not on the critical path)

| Item | Where | Why deferred |
|---|---|---|
| Old EIFD panel uses one city's pledges for all California counties and sums per-project capacity | `app/app.js:3686-3712,3769` | Editing the monolith is out of scope; superseded by `underwriting/` when the UI is wired |
| Back-test substitutes invented inputs | `src/engines/valuationBacktestEngine.js:22,56-58` | Needs a correction entry and a new test window |
| SB 9 text in page zoning descriptions, California gating unverified | `app/app.js:2908,2937` | Needs a browser check |
| `statutes.json` and `state-housing-laws.json` are identical | `app/data/` | Remove one after checking consumers |
| `docs/audit/engine-copies.md` says the page loads no `src/` file; `index.html:1266` loads one | docs | Doc correction |
| Street centreline network, utility records, CIP schedules, building-type costs, submarket rents and cap rates, vacancy, brownfields, permits, flood layers | absent | No dataset ingested without a consuming module; ranked in `docs/data-needs.md` (Stage 6) |

## Open questions for the owner

1. GitHub Pages 1 GB cap vs `counties/` in the repo (from `docs/WORK-QUEUE.md`), unchanged by this work.
2. Which sourced cost and rent datasets may be licensed or ingested (decides how many pilot outputs leave
   "requires investigation").
