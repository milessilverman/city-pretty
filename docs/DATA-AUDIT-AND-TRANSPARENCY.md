# City Pretty: Data Audit & Transparency Disclosure

**Published:** 15 November 2026  
**Auditor:** Multi-agent peer review (Claude Code Audit & Antigravity Accuracy Review)

---

## 1. Executive Statement & Direct Accountability

> **"I don't know if this information is accurate."**  
> Any platform that guides investment capital or public policy must hold accuracy as an incompromisable requirement. An independent audit of earlier builds in this repository revealed that **a large proportion of previously cited studies, financing metrics, and calculation fallbacks were hallucinated or filled with synthetic placeholder heuristics**. 

This document discloses what was found, what has been repaired, what remains unverified or estimated, and the strict rules governing all future data engineering.

---

## 2. Audit Findings: What Was Hallucinated or Inaccurate

| Component | What Was Found in Earlier Builds | Accuracy Status | Remediation Action Taken |
| :--- | :--- | :--- | :--- |
| **Research Study Library** | 488 of 540 "studies" in `RESEARCH_CORPUS_500` were generated filler (e.g. *"Education Economics & Public Finance Consortium #24"*, *"Study #14"*) without DOIs, publication URLs, or verifiable peer-reviewed text. | **FAILED AUDIT (90% Hallucinated)** | Purged all 488 filler entries. Sourced and verified 52 authentic empirical studies with DOIs and direct URLs in [`app/data/research.json`](../app/data/research.json). |
| **Fallback & Stand-In Numbers** | Approximately 52 hardcoded fallback numbers stood in for missing data across the codebase: home values defaulted to `\|\| 900000`, `750000`, or `360000`; county populations to `\|\| 500000`; project costs to `\|\| 25000`; transit costs to `\|\| 145000000`; lot sizes to `\|\| 6000`; living areas to `1650` or `1800`. | **FAILED AUDIT (Fabricated Estimates)** | Replaced all ~52 fallbacks with `null`. Calculations propagate `null` safely and UI displays "Not on file" / "Not recorded" rather than inventing numbers. |
| **Planned Transit Corridors** | 21 transit corridors mixed real projects with fabricated capital costs, unadopted TIFIA loans, senior debt splits, and projected developer equity. | **FAILED AUDIT (Synthetic Metrics)** | Purged all 946 lines of synthetic corridor models. Sourced 5 official FTA Capital Investment Grant (CIG) profiles in [`app/data/transit_pipelines.json`](../app/data/transit_pipelines.json); unadopted metrics set strictly to `null`. |
| **By-Right Zoning & Entitlements** | Parcels without recorded zoning defaulted to `"R-1"` and assumed `is_single_family_residential = true`, inadvertently granting CA SB 9 lot splits, WA HB 1110 middle housing, and AB 2097 zero-parking mandates to unzoned or unrecorded land. | **FAILED AUDIT (Ungrounded Assumptions)** | Enforced strict zoning check (Roadmap Item 10). Missing zoning sets `base_zoning_code: null`, `isSfr: false`, and `lotSplitFeasible: false`, with explicit notice that zoning is unrecorded. |
| **State Assessment Rules** | 885 lines of state finance constants were hardcoded inline in `app/app.js` without statutory citations or state revenue department URLs. | **FAILED AUDIT (Unverified Constants)** | Decoupled into [`app/data/state_finance_profiles.json`](../app/data/state_finance_profiles.json) with verified assessment statutes and legislative URLs for all 50 states + DC + PR. |
| **Public Agency Unit Costs** | Capital improvement costs (e.g., sidewalks, curb ramps, street trees, bus shelters) relied on assumed regional multipliers rather than awarded public bids. | **FAILED AUDIT (Heuristic Assumed Spreads)** | Structured 32 public DOT bid item awards in [`app/data/unit_costs.json`](../app/data/unit_costs.json) from TxDOT, FDOT, Gwinnett County DOT, NCDOT, CDOT, and MnDOT. Items lacking competitive awards are set to `null`. |

---

## 3. Current System-Wide Provenance Matrix

The table below indicates the current verification status of every major data subsystem in City Pretty:

| Subsystem | Underlying Files | Current Status | % Verified | Primary Public Source | Known Gaps / Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Research Study Library** | `app/data/research.json` | **VERIFIED** | 100% (52/52) | Peer-reviewed journals, NBER, TRB, USDA | Limited to 52 studies; expanding to 200+ ongoing. |
| **State Housing Laws** | `app/data/statutes.json` | **VERIFIED** | 100% (11/11) | State legislature legislative portals | Covers CA, TX (including Austin HOME), FL, WA, OR, AZ; other states in development. |
| **Municipal Funding Programs** | `app/data/funding_programs.json` | **VERIFIED** | 100% (4/4) | LA County SCW, LA City Prop K, CalEPA, CAL FIRE | Currently covers CA jurisdictions; expanding nationally. |
| **State Finance Profiles** | `app/data/state_finance_profiles.json` | **VERIFIED** | 100% (52/52) | State Revenue Codes, Statutes, Constitutions | General state rules; county-specific millage requires local lookups. |
| **Construction Unit Costs** | `app/data/unit_costs.json` | **PARTIAL** | 75% confirmed | State DOT monthly estimate reports, bid tabulations | Standardized per-mile bike lane & bioswale unit contracts still unconfirmed. |
| **HUD Fair Market Rents (FMR)** | `app/data/hud_fair_market_rents.json` | **VERIFIED** | 100% (10 metros) | HUD User FY2026 SAFMR Dataset | Official FY2026 1BR/2BR benchmarks; unrecorded metros state 'Not on file'. |
| **FTA Transit Corridors** | `app/data/transit_pipelines.json` | **VERIFIED** | 100% of kept | FTA CIG Profiles, Regional Transit Authorities | Unadopted financing metrics strictly omitted (`null`). |
| **Underused Land Inventory** | `app/data/underused_sites.json` | **VERIFIED** | 100% (90 sites) | County Assessor & SCAG GIS Parcels | Curated golf courses, parking lots, and vacant parcels with verified acreage, transit distance, and zoning. |
| **Automated Valuation Model (AVM)** | `propertyValuationEngine.ts`, `valuationBacktestEngine.ts` | **BACK-TESTED** | Benchmark validated | County recorder sales (LA, King, Cook, Harris, Hillsborough) | Screened against arm's-length recorder sales; strictly withheld when MdAPE exceeds 14.0%. |
| **Hedonic ROI Spreads** | `app/app.js`, county bundles | **ESTIMATED** | Statistical model | Academic literature effect sizes | Bands use statistical standard errors; local validation in progress. |
| **Crime Statistics** | County bundle feeds | **PARTIAL** | 60% of counties | FBI CDE, Open Data Portals | 17 states lack statewide geocoded non-fatal crash/crime feeds. |

---

## 4. Uncompromising Rules for Accuracy

All developers, AI agents, and contributors must adhere to these five operational principles:

1. **Never Invent Numbers:** If an assessor value, lot size, construction price, or population count is not verified in an authoritative record, pass `null`. The user interface must say *"Not on file"* or *"Not recorded"*.
2. **Never Infer Entitlements from Missing Data:** A missing zoning code does not mean single-family residential. If zoning is unrecorded, by-right building rights and lot splits must be withheld.
3. **Every Sourced Item Requires an Audit Trail:** Every row in a data table must contain `source`, `source_url`, `retrieved`, and `last_verified` dates.
4. **Transparent Mistakes:** If an AI agent or contributor generates or discovers unverified data, it must be flagged immediately in the documentation, never hidden behind optimistic marketing language.
5. **Separation of Screening from Advice:** City Pretty is an empirical screening tool. No screening output constitutes an appraisal, legal zoning determination, or binding investment offering.
