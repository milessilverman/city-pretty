# Improvement catalog and upgrade tables: round 2 (16 Nov 2026)

Follows `bundle-catalog-audit.md` and `bundle-catalog-fixes.md`. Goal: raise the number of sourced improvements only
where a fetched source supports the exact number the engine uses, and audit the two recommendation tables that had not
been checked (the homeowner upgrade table and LA's per-block-group rows).

Result in one line: **one item went up (BRT), one went down (sound walls), the homeowner upgrade table is entirely
unsourced and is now gated, and LA's "recorded home sales" home values could not be verified.**

## 1. Catalog status changes

| Intervention | Before | After | Evidence |
|---|---|---|---|
| `brt` | partially verified (cost unchecked) | **verified** (sourced inputs; model not validated) | Effect re-fetched: Beaudoin & Tyndall, UHERO WP 2023-03, "We estimate a 5-7% price premium for homes located within a 20 minute walk of a BRT station" (engine uses 5.0%). Cost: LA Metro Board file 2026-0295 (Legistar matter 12412), "ESTABLISHING a Life-of-Project (LOP) budget for the North Hollywood to Pasadena Bus Rapid Transit (BRT) Project in the amount of $428,988,535", approved by the Board 2026-05-28; metro.net: 19 miles → $22.58M/mile; engine: $11.3M for 0.5 mile. |
| `noise_wall` | partially verified (cost unchecked) | **unverified** (cost contradicted) | The catalog cites Metro's Feb 2019 soundwall report. That presentation (Legistar file 2018-0787) says "$10 Million/mile if placed adjacent to the freeway shoulder" ($6,214/m). The engine used $2,485/m ($4.0M/mile), 40% of its own source, so every shipped sound-wall return per $1 was overstated about 2.5×. `pipeline/engine.py` now uses $6,214/m; shipped bundles keep the old figure until rebuilt, so no dollar figure is shown. |

Caveats recorded with BRT (shown on the page next to its label): the engine applies the effect to 1.5× the block
group's homes, whereas the study's catchment is a 20-minute walk; it uses one LA project's cost per mile everywhere; and
other studies in `research/effects.csv` find no significant effect (Benson & Cao, Twin Cities A Line) or declines for
single-family homes (Acton, Le & Miller 2022: Miami −2.5%, Pittsburgh −11.4%).

### Checked and left unchanged (no match, so no upgrade)

| Item | Why it stays where it is |
|---|---|
| `street_lighting`, `foot_patrol`, `violence_interruption`, `bid` (unverified) | All four multiply a crime study by the Schwartz, Susin & Voicu (2003) price coefficient. The paper exists (Journal of Housing Research, doi 10.1080/26911337.2003.12519486), but its abstract (OpenAlex) says only that falling crime explains "about a third of the post-1994 boom"; the 0.116 elasticity is not stated. Publisher and Furman Center copies return 403. |
| `street_trees` (unverified) | Donovan & Butry 2010 (quote re-found) measured the bundle of existing street trees fronting a house (+3.0% of median price). The engine applies 0.24% per newly planted tree to homes within 50 m, from a local regression whose code and data are not in the repo. Different effect, so no upgrade. |
| `park_upgrade` (unverified) | Engine's 0.5% is a stated assumption; Livy & Klaiber's figure is a dollar amount per home for a playground replacement, not the 0.5% used. |
| `school_bond`, `bus_lane`, `bike_share`, `clt`, `blight_rehab` (unverified) | The re-found studies report different outcomes or units (e.g. +10.3% for newly built schools vs the engine's 3%; multifamily +41.5% with no single-family effect vs the engine's 0.5% bus lane; a rent index vs home values). |
| `affordable_housing` (partially verified) | Cost cites an LAHD March 2026 report ($782,000/unit); not found on housing.lacity.gov search, and the City Clerk's file host is unreachable. |
| `undergrounding` (partially verified) | Cost cites the CPUC undergrounding table; cpuc.ca.gov unreachable. The catalog calls $3.4M/circuit-mile 2019 dollars while the engine text says 2024 dollars (recorded, unresolved). |
| `grocery`, `rail_station` (partially verified) | Effect checked earlier; the $2M incentive package and the $76M local share have no cited cost source. |

## 2. Homeowner upgrade table (`D.upgrades`, LA bundle; 46 rows)

- **All 46 rows are self-graded `est` ("City Pretty estimates") with no source** for cost, resale value or savings.
  The table's own footnote said they were "being checked against round-8 research".
- Two rows name a source in `app/app.js`: the full bathroom ("JLC/Zonda Cost vs Value 2025, Los Angeles", $63,595 /
  $36,603) and the in-ground pool ("Redfin 2019" county figures; the LA case uses a hardcoded $95,000 with no source).
  costvsvalue.com and remodeling.hw.net return 403 from the audit machine, so both are `could_not_check`.
- The house panel also computes values with unsourced multipliers (den conversion = 5% of home value; junior ADU
  capitalized at a 5.5% cap rate; rooftop deck = 3.5% of value; garage conversion = 65% of local $/sq ft).
- The ADU section asserted, for every house, "Side/Rear Setback: 4.0 ft (Compliant)", "Parking Replacement: Exempt
  (0 spaces)", "Permit Review: Ministerial (60 Days)" and "(By-right allowable)" lot coverage, without checking the lot.

**Fix:** `app/data/upgrade_verification.json` (46 rows, all `unverified` or `could_not_check`) and a gate in
`app/app.js`: unsourced rows show no cost, value, return per $1 or profit anywhere (house "Best bet", package tiles,
ADU sizing modeler, upgrade table and cost breakdowns, and the area-level upgrade table). They are listed by name with
permits, property-tax and rebate notes. The ADU compliance lines are replaced by the computed lot coverage (mapped
footprint + 750 sq ft) and "not checked for this lot; confirm with the city".

## 3. LA per-block-group rows (`app/data/details-la.json`; 6,587 block groups, 99,501 rows)

- Each row is `[id, project, homes, cost, capex, land, om, value, vpd, pct, why, qol]`. Everything from `homes` to
  `pct` is **model output**; `why` is generated text that embeds effect claims (e.g. "each tree lifts ~6 homes within
  50 m by 0.24% (local sales estimate)"). 75 catalog ids appear.
- The gate already covers these rows: `gateRecs()` splits every block group's rows into allowed and names-only before
  any card, plan step, total or export renders, and `ivCompactRows()` feeds the map ranking from the same rule. Since
  the `why` text is rendered only for allowed rows, unverified items' embedded claims are not shown.
- `m` holds block-group metrics (population, homes, tenure, rent, income, transit, heat, crash counts, zoning code and
  others) built from public sources by the LA build; not re-checked value by value.
- **Home value (`m.hv`) gap found:** 4,348 block groups label their value "median of N recorded home sales here,
  2022-24 (County Assessor)" and 1,127 more "recorded home sales in the surrounding Census tract". LA County's public
  parcel layer has no sale-price field, the LA build code is not in the repository, and these medians mostly end in
  …005–010 or …505–510 rather than the round figures that real sale prices (and the ACS values in the same file)
  cluster on. The label cannot be verified. **This value is the base for every LA dollar figure, including the
  verified items.** The page now appends "unverified: the sales data behind it is not in the repository" wherever the
  label appears. Replacing it with Census ACS values (or the Prop 13 base-year proxy, clearly labelled) is the top
  follow-up.

## 4. Best-project coverage (default view, best gated value project ≥ $1 per $1)

| Area | Before round 2 | After round 2 | Best projects after |
|---|---|---|---|
| LA County (6,587 block groups) | 63.5% | 59.4% | traffic_calming 2,990, undergrounding 801, grocery 85, brt 23, vacant_lot_green 13, affordable_housing 1 |
| All non-LA bundles incl. Orange County (177,527) | 18.0% | 17.5% | traffic_calming 27,808, undergrounding 1,940, grocery 1,086, brt 216 |
| Travis County, TX (766) | 1.2% | 1.0% | grocery 5, undergrounding 2, brt 1 |

Block groups whose best bet has **both** sides sourced (traffic calming or BRT): 45.7% in LA, 15.8% elsewhere.
Coverage fell because sound walls, the third most common LA best bet, rested on a cost that contradicts its source.

## 5. Not done / noticed in passing

- Rebuild the bundles with the corrected sound-wall cost (pipeline change made; bundles not rebuilt).
- Re-base LA dollar figures on a verifiable home value (section 3).
- The LA panel's "Municipal Crime Reporting Gap" banner names ten cities as not sending incident feeds; no source is
  given (outside this round's scope).
- Sources still unreachable from the audit machine: CPUC, LAHD/City Clerk reports, Cost vs Value, Taylor & Francis.
