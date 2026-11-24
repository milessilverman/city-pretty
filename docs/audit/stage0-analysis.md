# Stage 0 capability audit (read-only, 2026-11-24; code read, nothing run)
| capability | status | evidence | keep / modify / replace |
|---|---|---|---|
| IRR | missing | grep "irr" in src/engines, app/invest.js: no code | replace (new engine) |
| NPV | partial | solarMicrogridEngine.js:41-53 25-yr PV of savings; app.js:956 copy never called | modify |
| Multi-year cash flow | partial | app.js:3701-3706 30-yr tax-gain loop; municipalFinanceEngine.js:60-110 bond-term loop; no project cash flow | modify |
| Capex | partial | investmentDecisionEngine.js:262 REC_KEYS capex/land/om from bundle rows; 33 of 81 verified-in-part | keep |
| O&M | partial | investmentDecisionEngine.js:262 `om` field; "10-yr upkeep" folded into cost (:358); no O&M schedule | modify |
| Revenue model | missing | no rent/sale/fee revenue per project; investmentDecisionEngine.js:383 small_multifamily returns null, "missing" list | replace |
| Financing cost / debt | partial | municipalFinanceEngine.js:104-106 bond rate, DSCR; only for tax-increment bonds | keep |
| Risk-adjusted return | missing | no risk term; docs/DECISION-ENGINE.md:224 "Risk" cannot be known | replace |
| Hurdle / min acceptable return | unsupported | investmentDecisionEngine.js:367 `pays` = value/$ >= 1; no hurdle rate input | replace |
| Max private contribution | missing | not found by grep | replace |
| Min public contribution / funding gap | partial | app.js:3708 `rest = cost - eifd`; one EIFD source only, CA only | modify |
| P3 vs conventional vs private | missing | no code; grep "p3" nothing in engines | replace |
| Municipal fiscal effect (property tax) | partial | app.js:3701-3705 1% x county share of value gain; municipalFinanceEngine.js:17; no sales tax | modify |
| Funding catalog + eligibility | partial | app.js:3818-3819 CA/LA-only sets (name filter only); no eligibility test, no PAB/LIHTC/special assessment | modify |
| Separation of the five value streams | partial | investmentDecisionEngine.js:405 "value gains are nearby homes in total, not cash"; tax split app.js:3703; no developer profit | modify |
| Property value uplift + coefficients | partial | investmentDecisionEngine.js:281-300 sourced-effect override; json 2 verified/33 partial/46 unverified | modify |
| Impact geography | unsupported | uplift = homes reached x pct, bound to block group (investmentDecisionEngine.js:326); no decay/barriers/externalities | replace |
| Network distance | unsupported | gtfsWalkshedEngine.js:6 docstring says network, code is haversine; zero callers | replace |
| Double-counting guards | partial | hedonicCapitalizationEngine.js:11 cap P_max; engine never called by app (app.js:867 unused); app.js:3769 sums per-project EIFD | modify |
| Opportunity discovery | partial | invest.js:11 budget only filters; recommendForNeighborhood iterates pipeline rows (investmentDecisionEngine.js:326); no exhaustive/problem-first/combination search | replace |
| Parcel feasibility: ADU / lot split | partial | parcelHouseAuditor.js:106-108 lot>=2400 + SB 9 record; ADU = SFR/commercial + not historic | modify |
| Parcel feasibility: vacant / underused / parking | partial | investmentDecisionEngine.js:396 lists underused_sites.json rows, no feasibility calc | modify |
| Office-to-resi, mixed-use, air rights, assembly, brownfield | missing | not found by grep in src/engines | replace |
| Multiple uses per parcel | missing | parcelHouseAuditor.js:56 returns flags per use, no comparison | replace |
| Zoning engine: coverage | implemented | statutoryZoningEngine.js:139 reads app/data/statutes.json, per-state; unverified laws refused (:20) | keep |
| SB 9 / SB 79 / Prop 13 outside CA | partial | engine gated by rec.state_code (:158); statutes ca_sb9 only CA; but app.js:2908,2937 zoning text cites SB 9, gating not verified | modify |
| Synergy / negative synergy | partial | hedonicCapitalizationEngine.js:11 sub-additive only (no negatives); unused in UI | modify |
| Sequencing / phasing | missing | not found by grep | replace |
| Scenarios / horizons | unsupported | app.js:8551 setRoiMode forces "base" (locally-adjusted mode removed); fixed 30-yr and 5-yr horizons | replace |
| Portfolio optimisation under budget | unsupported | invest.js:319 BUDGET_OK filters list by cost tier, no optimiser | replace |
| Coverage tracking (evaluated / rejected / needs-info) | partial | investmentDecisionEngine.js:343-345 `withheld` with reason + `missing[]` per idea; no category-level ledger | modify |
| Recall / precision | missing | tests/unit/backtestMetrics.test.ts has error metrics only (no recall/precision grep hits) | replace |
| Backtest: neighbourhood score | implemented | docs/DECISION-ENGINE.md:16-44 FHFA tract HPI, non-overlapping windows, bootstrap CI; result: no better than cheapest | keep |
| Backtest: valuation | partial | valuationBacktestEngine.js:19,128-145 MdAPE gates; sales filter only; no time split or survivorship control | modify |
| Uncertainty ranges | partial | app.js:2045-2058 HEDONIC_SE grade to +/-1.96 SE band; SE per grade hand-set | modify |
| Provenance on numbers | implemented | investmentDecisionEngine.js:103 tv(value,unit,source,basis) on all outputs; tests/unit/provenance.test.ts | keep |
| Quality-of-life scoring | unsupported | `qol` in REC_KEYS (investmentDecisionEngine.js:262) passed through, no scoring | replace |
| Utility / engineering checks | partial | solarMicrogridEngine.js:17 (unused), roofAreaEngine.js; no water/sewer/power capacity | modify |
| AI advisor grounding | implemented | advisorAgent.ts:33-36 prompt rules; advisorGroundingContract.ts:117-118 null-not-estimate; tests/unit/advisorGroundingContract.test.ts | keep |

## Reusable strong pieces
| piece | file:line | test |
|---|---|---|
| Statute engine, conditions must be known | src/engines/statutoryZoningEngine.js:41,139 | tests/unit/stateLaws50.test.ts, localOrdinances.test.ts |
| Evidence tier + sourced-effect gate | src/engines/investmentDecisionEngine.js:267-325 | tests/unit/investmentDecisionEngine.test.ts, sourcedEffects.test.ts |
| tv() provenance wrapper | src/engines/investmentDecisionEngine.js:103 | tests/unit/provenance.test.ts |
| Neighbourhood rank with out-of-sample backtest | src/engines/investmentDecisionEngine.js:184 | investmentDecisionEngine.test.ts |
| Tax-increment capacity with profile gate | src/engines/municipalFinanceEngine.js:9,17 | tests/unit/audit.test.ts:132-149, financeProfiles.test.ts |
| Sub-additive stacking cap | src/engines/hedonicCapitalizationEngine.js:11 | tests/unit/audit.test.ts:154-177 |
| Valuation backtest withholding | src/engines/valuationBacktestEngine.js:19,170 | tests/unit/backtestMetrics.test.ts, countyValuation.test.ts |
| Advisor grounding contract | src/ai/advisorGroundingContract.ts:117 | tests/unit/advisorGroundingContract.test.ts |

## Accuracy-rule violations found
| violation | file:line |
|---|---|
| EIFD plan applies one city's pledges (Artesia) and hand-typed turnover/rate/DSCR to every CA county; 1% rate and 2%/yr growth hard-coded | app/app.js:3686-3688,3703 |
| Borrowed-study effect sizes applied to other counties; 46 of 81 catalog items unverified | src/engines/investmentDecisionEngine.js:405; app/data/intervention_verification.json |
| Hedonic P_max 0.22/0.30 and solar 3%/0.5%/5% rates and state credits typed without a source | src/engines/hedonicCapitalizationEngine.js:13; solarMicrogridEngine.js:10-15,46-52 |
| Backtest substitutes invented inputs (lot 6000 sq ft, home value $750,000, CA default state) | src/engines/valuationBacktestEngine.js:22,56-58 |
| Valuation elasticities labelled "(assumption)" yet drive dollar estimates | src/engines/propertyValuationEngine.js:25-31 |
| Per-project EIFD capacity summed into a package with no overlap guard; walkshed comment claims network distance but uses haversine | app/app.js:3769; src/engines/gtfsWalkshedEngine.js:3,8 |
