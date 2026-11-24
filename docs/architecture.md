# Platform architecture (investment, development and infrastructure intelligence)

Decided 24 Nov 2026 after the Stage 0 audit (`docs/audit.md`). The existing page, Worker and pipeline stay as they
are. All new analysis lives in `src/platform/` as small engines that share two schemas.

## Rules every engine follows

1. **Pure functions.** Input objects in, result objects out. No network, no file reads, no `Date.now()` (the
   caller passes `asOf`). Same input gives the same output.
2. **No numbers inside engines.** Costs, rents, rates, effect sizes, decay distances and legal thresholds are
   *inputs* carrying provenance. If an input is missing the engine returns `requires_investigation` and lists what
   is missing. It never substitutes a default.
3. **Every number is a `Quantity`** (below). Engines propagate ranges (low / high) and the list of inputs.
4. **Unknown is not zero and not "no opportunity".** It is recorded in the coverage ledger.
5. **Seven value streams are never added together** (see `ValueStreams`).
6. **AI proposes, engines decide.** An idea from the AI layer is a `candidate` until the financial, regulatory and
   engineering checks have each returned `pass`.
7. Plain ES modules (`.js`) with JSDoc types and `// @ts-check`, so the static page can load them without a build
   step. Type-checked by `src/platform/tsconfig.json` (added to `npm run typecheck`).
8. Tests in `tests/unit/platform/<module>.test.ts`; each module has known-answer cases and a size/time benchmark.
   Test fixtures are synthetic and labelled `FIXTURE: not real data`.

## Module map

| Module (`src/platform/…`) | Stage | Job | Depends on |
|---|---|---|---|
| `schema/` | 1 | `Quantity`, `GeoRef`, `ImprovementCategory`, `Opportunity`, `ValueStreams`, validators | none |
| `coverage/` | 1 | Per-location coverage ledger; recall/precision; back-test harness with leakage guard | schema |
| `impact/` | 2 | Impact area per improvement: network distance, decay, barriers, negative effects | schema |
| `discovery/` | 3 | Exhaustive, problem-first, asset-first, combination discovery; parcel feasibility; AI idea intake | schema, coverage |
| `underwriting/` | 4 | Cash flow, IRR, NPV, risk adjustment, P3 contribution range, delivery-model comparison, funding catalogue | schema |
| `portfolio/` | 5 | Synergy and negative synergy, sequencing, scenarios, optimisation under constraints | schema, underwriting |
| `regulatory/` | 6 (scaffold) | Jurisdiction-module framework; California + City of Los Angeles populated from verified records only | schema |
| `streetforge/` | 6 (scaffold) | Interface contract, validator, mock adapter | schema |
| `qol/` | 6 (scaffold) | Quality-of-life dimensions with user weights, shown beside returns | schema |
| `pilot/` | 3-6 | Adapters from the Los Angeles County bundle to the schemas (the only place that reads repo data) | all |

Engines do not import each other except as listed. The existing `src/engines/*` are not edited; `pilot/` may call
`statutoryZoningEngine` and `municipalFinanceEngine` through thin adapters.

## Shared schema (field names are the contract; `schema/` is the source of truth once written)

**Quantity**: `{ value: number|null, unit, low: number|null, high: number|null, status, source, jurisdiction,
effectiveDate, inputs: string[], assumptions: string[], method }`
- `status`: `verified` (fetched primary source) | `estimated` (computed from verified inputs) | `assumed`
  (user scenario input, labelled) | `unavailable` | `requires_investigation`.
- `source`: `{ title, url, quote, retrieved }` or `null` only when `value` is `null`.
- A non-null `value` without `unit`, `low`/`high`, `jurisdiction`, `effectiveDate` and (`source` or a non-empty
  `assumptions`) is rejected by `makeQuantity()`. `unknownQuantity(unit, reason)` builds the null form.
- Arithmetic helpers (`addQ`, `mulQ`, `scaleQ`) combine ranges by interval arithmetic, union the inputs and
  assumptions, and downgrade status to the weakest operand. Any null operand gives a null result.

**GeoRef**: `{ kind, id, jurisdiction: { country:'US', state, countyFips, place|null }, geometry, crs:'EPSG:4326' }`
- `kind`: `point` | `parcel` | `street_segment` | `asset` | `block_group` | `area`. `geometry` is GeoJSON.
- Block groups are demographic inputs only. No engine output is keyed by block group.

**ImprovementCategory**: `{ id, family, appliesTo: GeoRef.kind[], requiredInputs: string[], impactModelId|null }`
- `family`: `parcel_development` | `street` | `open_space` | `transit` | `utility_energy` | `facility`.
- The parcel families cover: underused land, surface parking, vacant land, ageing retail, brownfield, assembly,
  lot split, ADU, densification, office-to-residential, mixed-use, air rights, shared parking, P3 mixed-use,
  park with development, industrial revitalisation, commercial revitalisation.

**ValueStreams** (seven keys, each `{ amount: Quantity, capturedBy, mechanism }`): `propertyAppreciation`,
`developmentProfit`, `municipalTaxRevenue`, `publicEconomicBenefit`, `investorCashFlow`, `operatingRevenue`,
`capturableLandValue`. `mechanism` names the lawful conversion to funding (for example "EIFD under Cal. Gov.
Code") or is `none_identified`. There is deliberately no `total`.

**Opportunity**: `{ id, categoryId, location: GeoRef, discoveredBy, status, uses: UseOption[], checks, rejectionReasons,
missingInputs, confidence, valueStreams|null, evidence: Quantity[] }`
- `discoveredBy`: `exhaustive` | `problem_first` | `asset_first` | `combination` | `ai_exploration`.
- `status`: `candidate` | `viable` | `rejected` | `needs_info`. `viable` requires all three `checks`
  (`financial`, `regulatory`, `engineering`) to be `{ result:'pass' }`; any `unknown` gives `needs_info`.
- `uses`: develop / preserve / public space / coordinated development, each evaluated separately.
- `confidence`: `high` | `medium` | `low` | `unknown`, with `confidenceReasons`.

**CoverageLedger** (per location): `{ location, asOf, evaluated[], notEvaluated[{categoryId, reason}], found[],
rejected[{categoryId, reason}], needsInfo[{categoryId, missing[]}], staleData[], missingData[], confidence }`.

**ImpactArea**: `{ improvementId, modelId, cells[{ ref: GeoRef, distanceM, distanceKind, weight, sign }],
resolution, excludedByBarrier[], notes }` where `distanceKind` is `network` or `straight_line_fallback`,
`sign` is `+1` or `-1` (noise, traffic, displacement), and `resolution` is `parcel` only when the inputs
support it, else `street_segment` or `area`.

## StreetForge interface contract (scaffold)

StreetForge today (source read 24 Nov 2026) is a client-side street design tool with a project JSON
(`format:'streetforge-project'`, scenes `before`/`after` of `elements`), share/remix links and PNG export. It has
no cost, quantity or funding output and no API. The contract therefore defines what City Pretty *would* send and
accept, behind a mock:

- Request: `{ contractVersion, segment: GeoRef(kind street_segment), proposedChange: { categoryId, parameters },
  asOf }`.
- Response: `{ contractVersion, design: { format:'streetforge-project', … }|null, quantities: Quantity[],
  cost: Quantity, tradeoffs[], capabilities: string[] }`. A real StreetForge can only fill `design` today, so
  `cost` and `quantities` come back as `unavailable`. The mock adapter returns exactly that unless a test injects
  fixture values. No City Pretty output may describe a StreetForge capability that `capabilities` did not report.

## Pilot geography

Los Angeles County (FIPS 06037); regulatory pilot jurisdiction: State of California plus City of Los Angeles.
Reasons and limits are in `docs/audit.md`. Outside the pilot the engines run but adapters do not exist yet.
