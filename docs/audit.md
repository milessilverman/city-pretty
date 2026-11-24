# Stage 0 audit: what City Pretty has and what the investment platform still needs

Written 24 Nov 2026 from three read-only audits (`docs/audit/stage0-code.md`, `stage0-data.md`,
`stage0-analysis.md`), plus a baseline run the same day: 854 unit tests passed, typecheck clean, 80 browser
tests passed. Every status below has file:line evidence in those three files.

## Verdict

The repository is a well-tested **sourced-facts and screening** product. It is not yet an investment or P3
analysis product: there is no IRR, no project cash flow, no private/public contribution split, no P3
comparison, no sequencing, no optimiser, and every effect is tied to a census block group. Nothing in the
audit contradicts the plan; the work is additive. The existing page, Worker, pipeline and tests are kept.

## Keep (working, tested, reused by the new modules)

| Piece | Where | Why it is kept |
|---|---|---|
| Statute engine that refuses unverified laws | `src/engines/statutoryZoningEngine.js:41,139` | Already jurisdiction-gated by state code; base of the regulatory framework |
| Provenance wrapper `tv()` and evidence-tier gate | `src/engines/investmentDecisionEngine.js:103,267-325` | Same idea as the new `Quantity` type |
| Tax-increment capacity with state profile gate | `src/engines/municipalFinanceEngine.js:9,17` | Municipal fiscal effect input |
| Neighbourhood-score back-test (FHFA tract index) | `docs/DECISION-ENGINE.md:16-44` | Honest result: the score does no better than picking the cheapest tracts |
| Home-value back-test withholding | `src/engines/valuationBacktestEngine.js:19,170` | Estimates show only where a model passed |
| Advisor grounding contract | `src/ai/advisorGroundingContract.ts:117` | AI may not assert unsourced numbers |
| County files, crash counts, HUD rents, tree equity | `stage0-data.md` rows 6-34 | Demographic and condition inputs |

## Missing or presentational (the plan's stages 1 to 5)

| Capability | Status | Evidence | Stage |
|---|---|---|---|
| Per-location coverage ledger, recall/precision | missing (only per-idea `withheld`) | `investmentDecisionEngine.js:343-345` | 1 |
| Back-test of opportunity discovery | missing (only price back-tests) | `stage0-analysis.md` rows 35-37 | 1 |
| Impact geography (network distance, decay, barriers, negatives) | unsupported: homes in block group x percent | `investmentDecisionEngine.js:326` | 2 |
| Walkshed "network distance" | unsupported: haversine, no callers | `src/engines/gtfsWalkshedEngine.js:3,8` | 2 |
| Exhaustive / problem-first / asset-first / combination discovery | partial: iterates pre-built rows | `investmentDecisionEngine.js:326`, `app/invest.js:11` | 3 |
| Office-to-residential, air rights, assembly, brownfield, multi-use compare | missing | `stage0-analysis.md` rows 26-27 | 3 |
| IRR, hurdle rate, risk-adjusted return, revenue model | missing | `stage0-analysis.md` rows 4-12 | 4 |
| Max private / min public contribution, P3 comparison | missing | `stage0-analysis.md` rows 13-15 | 4 |
| Funding catalogue with eligibility rules | partial: name filter, 11 records | `app/app.js:3818-3819` | 4 |
| Synergy and negative synergy | partial: sub-additive cap, unused on page | `hedonicCapitalizationEngine.js:11` | 5 |
| Sequencing, scenarios, portfolio optimisation | missing / unsupported | `app/app.js:8551`, `app/invest.js:319` | 5 |
| Quality-of-life scoring | unsupported: field passed through | `investmentDecisionEngine.js:262` | 6 |

## Accuracy-rule violations already in the code (not fixed in this run unless a new module replaces them)

| Violation | Where | Handling |
|---|---|---|
| EIFD plan applies one city's pledges and hand-typed turnover, rate and coverage to every California county; sums per-project capacity with no overlap guard | `app/app.js:3686-3688,3703,3769` | New underwriting engine takes these as sourced inputs; old code logged for removal |
| Effect sizes borrowed from studies elsewhere; 46 of 81 catalogue items unverified, 33 partial, 2 verified | `intervention_verification.json`; `investmentDecisionEngine.js:405` | New impact engine refuses to produce dollars without a cited effect record |
| Stacking cap and solar rates typed without a source | `hedonicCapitalizationEngine.js:13`; `solarMicrogridEngine.js:10-15` | Not reused; synergy engine takes sourced parameters |
| Back-test substitutes invented inputs (lot size, home value, state) | `valuationBacktestEngine.js:22,56-58` | Logged in STATE.md open items |
| Valuation elasticities marked "(assumption)" drive dollar estimates | `propertyValuationEngine.js:25-31` | Logged |
| SB 9 text in page zoning descriptions, California gating not verified | `app/app.js:2908,2937` | Logged; regulatory framework gates by jurisdiction |

## Data: what exists and what limits the analysis

- **Nationwide (747 county files, 49 states + DC + PR, no Hawaii):** block-group metrics, OpenStreetMap layers,
  plans. Crash counts in 233 counties of 8 states. Zoning standards parsed for 5 jurisdictions. State housing-law
  records for 20 states + DC. HUD rents for 3,222 counties. Home-value models that passed in 11 counties.
- **Parcels are live look-ups only** (118 public services, 102 counties). No parcel geometry is stored.
- **Absent everywhere:** street centreline network (Los Angeles has names only, plus arterial/freeway lines),
  utility records, capital improvement or street reconstruction schedules, construction cost by building type,
  rents and cap rates by submarket, vacancy, brownfield list, building permits, flood layers.
- **Weak:** `underused_sites.json` profit margin is "not reproducible" by its own verification; `unit_costs.json`
  sources mostly "unchecked"; `ca_counties_registry.json` is hand-entered and marked unverified;
  `statutes.json` and `state-housing-laws.json` are byte-identical duplicates.

Consequence: the new engines are built and tested as deterministic functions, but on the pilot most dollar
outputs will read **"requires investigation"** until sourced costs, rents and effect sizes are ingested. That is
the correct behaviour under the accuracy rules, and it is stated in every report.

## Code structure risks (from `stage0-code.md` section 6)

`app/app.js` is 11,339 lines with about 80 window globals; engines reach the page as inlined copies guarded by a
drift test; four engines are unused on the page; typecheck covers only the five Worker files. New work therefore
goes into a separate module tree (`src/platform/`) with its own type check, and does not edit `app/app.js`.

## StreetForge (fetched from https://www.streetforge.app/ on 24 Nov 2026)

It is a separate, free, client-side street design tool. Seen in its page source: a project JSON format
(`format: 'streetforge-project'`, scenes `before` / `after` made of `elements`), PNG export, `share`, `remix`
and `gallery` URL parameters, Overpass look-ups. **Not found:** any cost estimate, engineering quantity,
funding output, `postMessage` or public API. This repository has no StreetForge code (the earlier in-repo
"engine" was removed as invented). So integration is a contract plus mock adapter only.

## Pilot geography: Los Angeles County (FIPS 06037)

1. Best covered: 6,587 block groups, 9,411 underused-site records, zoning cells, 6,379 tracked projects with
   status and year, arterial/freeway/rail/wall lines, a local tract price index, crash counts, a passing
   home-value back-test.
2. California is where SB 9, SB 79, Prop 13 and EIFDs actually apply, so the regulatory and funding modules
   can be populated from the 8 verified California statute records without stretching them to other states.
3. District of Columbia is second (parsed zoning, passing back-test) but has no crash counts, price index or
   funding records; San Diego has no back-test.
