# App code fixes (2026-11-16)

Follows `appjs-constants-audit.md`, `engines-sites-audit.md` and the laws, research and costs/transit audits. Rule
applied throughout: an invented number is deleted, not relabeled. Where a card can no longer show a figure it says
"Not modeled yet" and names what data is missing. Layout and styles (`app/app.css`) were not touched.

Checks after the changes: `npm test` 80/80, `npm run typecheck` clean, `npm run test:e2e` 14/14 (one new browser test
renders a house panel and a neighborhood panel from fixed records and fails on any of the removed figures or a
script error). No console warnings when a house panel and the prospectus render.

## Home value estimate — `app/app.js` `estimatePropertyMarketValue`, mirrored in `src/engines/propertyValuationEngine.{js,ts}`

| Removed / changed | Why |
|---|---|
| `HPI_INDEX_TO_2026` table ("FHFA & Case-Shiller") and `getHpiMultiplier`/`getTierElasticity` | No index data behind it. Sales older than 2 years and Prop 13 base years older than 2 years are no longer indexed or used; the panel says so. |
| `STATE_BASELINE_PROFILES` (52 state medians, ref sizes) | Stand-in values. With no ACS median on file the hedonic part does not run; if nothing else is on file the estimate is withheld with the reason. One labeled `VALUATION_ASSUMPTIONS` block holds the remaining model constants. |
| `LUXURY_TIER_MUNICIPALITIES` (invented city medians) | Top-coded ACS medians now stop the hedonic anchor instead. |
| `× 1.165` "ACS → 2026" inflation, `× 1.02–1.08` assessor markups | No source. Statutory ratios kept, marked pending the laws audit. |
| Defaults `lotSqft = 6000`, living area = state reference, beds 3 / baths 2 / year 1975 | Unknown facts now contribute nothing. |
| ± bands 3.8–7.8% and labels "High Precision", "institutional agreement", "High Confidence" | No back-test exists. `valueLow/valueHigh/confidenceMarginPct` are null; label is "Unvalidated estimate — no back-test against sales yet". |
| `renderHouse`: invented `{hv: 400000, rent: 1800}` neighborhood fallback, 6.5% fallback margin | Removed. |
| `valuationCheck` dead back-test withholding branch | Removed; `valuation_backtest_benchmarks.json` is a `no_backtest_run` stub. |

## Single-house auditor — `auditSingleHouseParcel` (`app/app.js`, `src/engines/parcelHouseAuditor.{js,ts}`)

- Permit valuations are summed and shown, never added to value (the 85% / 60% capitalization was invented).
- `getHighValueSaturationMultiplier` removed (invented, and only displayed).
- Imagery: the hardcoded LiDAR 2020/2023 and Street View "2021-06" dates are gone; with no real dates the badge is
  `imagery_dates_unknown`. Default permit date "2024-01-01" and default sale year 2023 removed.
- Solar: no system size, cost, yield, savings, payback or NPV. The roof model's usable share (64%/88%) and all
  $/W, kWh/kW and $/kWh inputs were assumptions. Only the confirmed § 25D fact remains.
- Trees: dollar lift / savings / irrigation removed (per-regime values unsourced; the Portland study DOI 404'd).
- Displacement score `48 ± 15/8` removed (null).
- EverySpace and renovation-quote calls removed.
- Lot split: flagged only when the statute engine applies the SB 9 record (zoning on file, single-family zoning, no
  HPOZ/floodway); the `lotSqft ≥ 4800` rule and the "no use description ⇒ single-family" inference are gone.
- Panel (`renderHouseAuditAside`, mirrored in `src/ui/houseInspectorPanel.{js,ts}`) rewritten to the above.

## Roof engine

`estimateAccurateRoofArea` (app and `src/engines/roofAreaEngine.{js,ts}`): re-roofing material costs
("RSMeans 2026 Installed" — no RSMeans data in the repo) and kWh yield removed. Roof drawer placeholders
("2,400 sq ft", "24 sqs", "1.118x", "1,200", "60 panels", "24.6 kW") replaced with "–"/"not modeled".

## State housing laws — statute engine

`evaluateByRightHousing` (app and `src/engines/statutoryZoningEngine.{js,ts}`) now reads `app/data/statutes.json`.
The old hardcoded rules stated several laws wrongly (120-unit SB 79 cap, AZ 30 ft height, FL 0.5-space parking
minimum, TX SB 840 1-space minimum, OR thresholds, etc.). Now:

- Only records with `verification.status` verified / partially_verified apply; others go to `not_confirmed`.
- Fields listed in a record's `unverified_fields` are returned null and listed in `unconfirmed_fields`.
- Conditions that need unknown inputs (population, transit distance, city name, lot size) are reported, not assumed.
- CO HB24-1313 and MA MBTA Communities are treated as jurisdiction-level duties, never parcel rights.
- All hardcoded law prose was replaced by text built from the records with their status: map popup headline
  (`stateReformHeadline`), zoning section bullets, methods modal ("State housing laws on file"), prospectus.
- `getActiveZoningSummary` no longer invents a state-typical zoning mix ("R-1 68%; R-2 18%...") when no zoning
  is loaded; it returns nothing and the panel says zoning is not on file.

## Owner playbook and prospectus

- `computePropertyPlaybook` rebuilt: one card per applicable statute record; equity, ROI, cost, cash flow and
  payback are null with "Not modeled yet — no sourced cost data". Removed: SB 79 $210/$165 per lot sq ft and
  3.85 ROI; TX/FL/WA/OR/AZ constants; ADU $260/sq ft × 1.65 + $45k parking; solar card dollars; lot-split $45/sq ft;
  the $35k "modernization" fallback; the downtown-LA coordinate fallback. HUD rent shown only as a labeled reference.
- Copy-memo text no longer prints equity/ROI or "Verified via ... Intelligence Engine".
- Prospectus: `playbook.optimal` → `playbook.best` (bug: every prospectus printed the same strategy and $2.50/$1);
  $2.50 fallback, $520k roll fallback and ×1.6 markup removed; the pro-forma table replaced by the screened strategy
  and "not modeled"; the Terner/Furman/USDA "Verified Studies" removed; the TX/FL/WA/CA "✓ Qualifies" boxes replaced
  by statute-record text.

## Neighborhood panel

- Multi-Project Synergy Simulator removed (invented costs, lifts, +12/+25% "synergy multipliers", "+$36,375,000").
- Park and geography sections: all "+x% within y m" home-value effects removed (no checked source); named-but-unchecked
  attributions removed; the Chalfin lighting trial described without the unverified 36% figure.
- Transit corridor (P3) panel: Los Angeles fallback for every other county removed (`getMetroPipeline` returns null →
  "No adopted transit corridor is on file"); the invented generic pipeline object removed; the P3 simulator (IRR
  15.6%, $1.62M/yr, +12.5%, +54%, term/affordability adjustments, capital-stack table, engineering-spec claims,
  copy term sheet) removed. Stations without coordinates are skipped; unverified stations are labeled; `stn.units`
  ("null mixed-income homes") removed. The house "transit walkshed" card uses verified station locations only.
- Non-California TIF tile: removed bond capacity computed from a $45M baseline fallback, guessed millage and the
  unsourced `non_pledgeable_share`; shows only confirmed profile facts with the record's status.

## Research library and case studies

- "540+ Research Studies" → actual count. "Average Measured Benefit: $x / $1" (with an invented `|| 1.8` default)
  removed. "Return: $vpd / $1" badge replaced by the record's verification label. "Verified Source" link text →
  "Source" plus Verified / Partly verified / Couldn't check. Null impact/takeaway handled.
- Case studies: money figures guarded (no "$0.0M"), labels by verification status.

## County data scorecard

Rebuilt from `county_completeness.json` fields only: plain tiers "Data tier A–D" / "No data file"; inline LA/OC
records with invented roll dates, comps windows and feed statuses removed; per-state hardcoded transit-agency,
assessment, CAD-gap and TIF text removed. Hand-entered `ca_counties_registry.json` text labeled "(hand-entered,
unverified)". Methods-modal financing/water prose labeled as unchecked.

## AI advisor context

- Underused site: only a site in the selected block group (bug: any county golf course was sent).
- Intercity corridor: only a corridor with a station in this county; verification status and station
  `location_verified` passed; railyard recommendation removed.
- Value estimate passed with status, no low/high. EverySpace, renovation and StreetForge payloads removed.
- `src/ai/advisorGroundingContract.ts`: removed those fields; prompt now tells the model the value is unvalidated
  and to treat anything not marked verified as unconfirmed.

## Deleted

`src/engines/{streetForgeEngine,everySpaceEngine,renovationQuoteEngine,transitCorridorOpportunityEngine}.{ts,js}`
(never ran in the shipped app; invented numbers and wrong law) and `scripts/run_valuation_backtests.mjs` (fake sales).

## index.html

Accuracy tab: "~96% / ~98% / ~95% / ~88–92% / ~99% Accuracy" badges, the CoStar comparison table and the
"Zero-Hallucination" AI section replaced by a plain per-subsystem account of what has and has not been checked.
Research modal header "52 Peer-Reviewed Studies · Measured Real Estate Impacts" replaced.

## Left in place (not covered here)

- County bundle catalog value-per-$1 figures (`r.vpd`, grades, `HEDONIC_SE` bands, `calibrateVpd`) and the
  ADU/upgrade cost schedule (already labeled "unverified estimate"): the bundle needs its own audit pass.
- Hedonic model coefficients, statutory assessment ratios: kept as labeled assumptions / pending laws audit.
- `calculateTaxIncrementCapacity` remains in code (tests use it) but no longer drives any displayed figure outside
  the California EIFD calculator, which runs on roll data with user-editable inputs.
- `.tier-dot` colors in `app/app.css` key on the old tier names; with new tier values the dot uses its default
  color. Left for the design owner (rule 6: styles not changed here).
