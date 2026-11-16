# County-bundle catalog: fixes applied (16 Nov 2026)

This follows `docs/audit/bundle-catalog-audit.md`. The county bundles themselves were not rebuilt. The gate is
applied when the page loads the data, and the pipeline was fixed so a rebuild can't bring the removed items back.

## The rule

`app/data/intervention_verification.json` gives each of the 81 catalog interventions one of three statuses:

| Status | Count | Meaning |
|---|---|---|
| `verified` | 1 | `traffic_calming`: Polloni's effect and LADOT's $5,958 hump cost were both found in their sources. |
| `partially_verified` | 30 | One side checked, or a cost-only item whose cost cites a named document. |
| `unverified` | 50 | Everything else. |

Each entry also records the effect check (`checked`, `unchecked`, `misapplied` or `not_found`), the cost check
(`checked` or `unchecked`), the evidence and notes. Decisions taken in the file:

- **`street_trees`: unverified.** The local-hedonic regression and its sales data are not in the repo or its history, so the estimate can't be reproduced.
- **`ev_hub` and `adu`: unverified.** The cited studies could not be found.
- **`school_bond`: unverified.** The engine uses 3% while the catalog says 6% is used, and neither was confirmed.
- **`affordable_housing`: partially verified, with `applies_if.median_household_income_below = 26000`.**
  - Diamond & McQuade's +6.5% is for low-income areas. The $26k cut-off comes from the catalog's citation; the abstract doesn't state it.

How the page applies it:

- **unverified**: no dollar figure, no $-per-$1 and no "adds ~$X". These items are never ranked as a best bet and never count in a total. They appear only under **"Other ideas (effect not sourced yet)"**, by name.
- **partially_verified**: numbers are shown with a **"Partly verified: … not re-checked"** label that names the unchecked side.
- **verified**: numbers are shown with a **"Verified"** label.
- The catalog's A–D grade now appears only next to the verification label ("Verified · catalog grade C"), never on its own.

## What changed

**`app/app.js`**
- **Loading the file.** It loads `intervention_verification.json` through `cpJson`, and `init()` waits for it before the first map ranking. Until it arrives, everything counts as unverified.
- **New helpers:** `ivStatus`, `ivAllows(id, m)` (which also applies the income condition), `ivLabel`, `ivChip`, `gateRecs`, `recsOf`, `otherIdeasHtml`, `ivCompactRows` and `ivScanLA`.
- **`allowed(id)`** now also excludes unverified items.
- **Map ranking.** `retop()` ranks only gated rows.
  - National and Orange County bundles are gated straight from their details.
  - LA details are lazily chunked, so a background pass, `ivScanLA()`, decodes each chunk once without caching it and tags every block group with compact gated rows.
  - Until that pass finishes, LA falls back to the build's per-tier bests, filtered so that no unverified item can win.
- **Block-group panel (`select`).** Rows are gated at the source. That covers the best bet, the Top 3, all ranked lists, the "Paying projects", "Total cost" and "Joint Value Created" tiles, the TIF calculator inputs, and a new "Other ideas" list.
  - If nothing sourced applies, the best-bet line says "No sourced estimate is available here yet".
- **Project cards.** A verification chip replaces the lone "evidence X" chip; "Evidence grade X" became a "Verification" line; the unverified "public benefit" dollar line was removed.
- **Neighborhood plan.** Steps for unverified fixes say "No sourced estimate yet" and show no cost or return. Gap-list fix costs are gated the same way.
- **Neighborhood profit is withheld everywhere.** The panel line now reads "Neighborhood value created: Not modeled yet", and the `profit` map metric returns nothing.
- **Exports and AI context:**
  - **CSV export:** adds a Verification column. Unverified rows are listed with empty number columns.
  - **Copy summary and compare drawer:** use only gated rows.
  - **AI advisor context:** `serializeLiveAdvisorContext` sends gated top projects with their verification labels, plus the names of the unsourced ideas.
- **Report tab:**
  - "Your neighborhoods", "Most profitable neighborhoods", "What comes out on top" and "By city" are withheld; their figures were computed before the audit.
  - The improvement library shows a "Verification (catalog grade)" column.
  - "Evidence grades" now explains the verification labels.
- **`whyFix`** rewrites "local sales estimate" as "from an LA sales regression that could not be reproduced".

**`app/explore.js`**
- **"How sure we are"** shows the verification status, and the catalog grade only next to it. The grade descriptions that claimed "Measured on actual home sales in Los Angeles County" were removed.
- **Lists and rankings.** Unverified ideas are not listed, and neighborhood pages use gated rows plus an "Other ideas (effect not sourced yet)" list.
- **Summary cache.** It is rebuilt when LA's background tagging finishes.

**`index.html`** (text only)
- The "Experimental: Profit potential" metric, the "Also show unverified leads" evidence option and the "Show experimental modes" button are removed.
- The grade filter is relabelled as a catalog-grade filter over sourced estimates only.
- The methods text no longer claims the bands are "empirical 95% confidence intervals". They are judgment bands by catalog grade, and the text now says so.

**`pipeline/engine.py`, `pipeline/build_oc.py`**
- `CATALOG_EXTENSIONS` and `FUNDING_EXTENSIONS` are deleted, along with the `add()` calls for their eight self-cited items: `safe_school_corridor`, `park_trees`, `park_seating`, `park_mural`, `park_lighting`, `beach_nourishment`, `beach_volleyball` and `mountain_bike_trails`.
- The `build_oc.py` references are removed, and comments point to the audit.
- `affordable_housing` is now generated only where income is under `LIHTC_LOW_INCOME_CUT = 26000`, instead of under LA's median of $93,240. As a result, `pipeline/validate_la.py` will report that difference against the old LA rows; this is intended.

## Effect on the map's best project

Default filter, block groups whose best project returns at least $1 per $1:

| Area | Before the gate | After the gate | Best projects after |
|---|---|---|---|
| LA County (6,587 block groups) | ~all ranked | **63.5%** have a sourced best bet | traffic_calming 2,989; undergrounding 758; noise_wall 313; grocery 85; brt 21; vacant_lot_green 13; affordable_housing 1 |
| 639 other bundles (177,527 block groups) | 81.1% (60% of them farmers_market) | **18.0%** | traffic_calming 27,793; undergrounding 1,885; grocery 1,086; noise_wall 968; brt 215 |
| Travis County, TX (766) | | 1.2% | grocery, undergrounding, noise_wall, brt |

Outside LA, most block groups now show "No sourced estimate is available here yet". The verified item, traffic
calming, needs crash records, and most states' bundles have none. That is the honest result until more effect sizes
are confirmed.

## Tests

- **Unit** (`tests/unit/interventionVerification.test.ts`), part of the 89 unit tests that pass:
  - The file covers every LA catalog id and every id used in Travis County's rows.
  - It uses only valid values, and "verified" requires both sides checked.
  - The audit's decisions are recorded.
  - The extensions can't re-ship, and the income cut is in place.
  - The page wires up the gate.
- **Browser** (`tests/e2e/site.spec.ts`), 16 of 16 pass:
  - **New:** an LA block group with an unverified item worth ≥ $1 per $1 before the gate shows no card or number for it. The item appears in "Other ideas" without numbers, the best bet is not unverified, no profit is shown, and no map feature's best project is unverified.
  - **New:** Travis County has no unverified best projects, no "local sales estimate" wording and no lone grade chip.
  - **Updated:** the Explore test now opens the verified traffic-calming idea and checks that street trees are not offered.
- `npm run typecheck` is clean.
- **Headless check:**
  - **LA:** 300 sampled block groups, with the map and panel best bet agreeing in 300 of 300.
  - **Travis County:** panels and Explore mode.
  - No console errors.

## Left as is

- **LA bundle rows still carry the old numbers.** They are gated at display time, not rewritten.
- **The bundle `tp`, `profit` and `plans` values** are still in the data files; the page simply no longer shows the ungated ones.
- **`D.upgrades`, the homeowner upgrade table,** has its own cost and resale figures outside the catalog. It was not audited here.
- **Partly verified effects are transferred from other places,** for example Canberra undergrounding and Portland traffic calming. The labels say "partly verified", not "local".
- **To widen sourced coverage,** wire the engine to the quote-checked rows in `research/effects.csv`; recommendation 6 of the audit.
