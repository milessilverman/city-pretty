# Page constants audit, round 3 (17 Nov 2026)

Scope: every row of `appjs-constants-audit.md` (16 Nov, 97 entries), re-checked against `app/app.js`, `index.html` and
`app/facts.js` as of commit 0429a9f, plus a sweep of every string literal in those files that contains a dollar figure,
a percentage or a multiplier (`/tmp` sweep script; 80 hits, each read). For each item: is it still in the code, does
it reach the page, the printable brief, the AI advisor's context or a ranking, and what was done.

Rule applied: a number reaches users only if it was fetched from a source, is labeled on the page as an assumption with
its basis, or is withheld. No number in this round was typed from memory; where a source could not be fetched, the
claim was removed or marked "not re-checked".

## Fixed in this round

| Where | What reached users | Why it was wrong | Fix |
|---|---|---|---|
| Map metric "Renter displacement sensitivity (0–100)" (`METRICS.displacement`, index.html option) | A 0–100 score on the map and its legend | No county file carries renter share, rent burden or rent-control inputs (checked: 0 of 766 Travis block groups; none in Cook or Anchorage). The fallback filled in 0.48/0.40 renter share, 0.28 burden, 0.15 rent control and typed weights 0.45/0.40/0.15, so **every block group got the same 42/100**. | The metric returns only a sourced score (`dr`), else nothing; the option is removed from the menu. |
| Neighborhood panel, paying-projects tiles | "Joint Value Created" dollar total | Computed under a typed 30% (urban) / 22% (suburban) neighborhood cap, with a typed 2.5% lift for projects without one; the page already withholds "neighborhood value created" elsewhere as not modeled. | Tile now reads "Home value created together: not modeled". "Total cost" is the plain sum of the shown projects' own costs (it used the capped model's marginal ≥ $1 subset). |
| Neighborhood panel | "Renter Displacement Sensitivity Index: N/100" box | Built from a typed 28% severe rent burden, typed 65% (CA) / 15% rent-control coverage, a 45% renter fallback and typed weights | Removed. In renter view the box now gives the Census ACS renter share and says no displacement score is shown because burden and rent-control coverage are not on file. The package function call is removed from the panel. |
| House panel, "How is this estimated?" (shown only where an estimate is shown, i.e. back-tested counties) | "Site Land Value" (assumed state land share × ACS median, or 50% of the median), "Age Factor" (0.35%/yr from 1980), "Beds/Baths" (+4%/bed, +3%/bath), "Lot Premium" ((lot−5,500)/5,500 × 10%), "Pool Premium" (4.5% of the median); header "Calibrated against county assessor rolls, deed recordings, and Census ACS microdata" | None of the rates has a source, and the decomposition described a generic model that did **not** produce the shown estimate (that comes from the county's back-tested model, a recorded sale or the roll). The calibration claim was false. | Replaced with the actual method (`valuationMethod` and the back-test summary) and the recorded facts only (living area, year built, beds/baths, lot, last sale, assessor-based value with its rule). The factor variables are deleted. |
| Same block, assessor note | "In California, tax rolls reflect Prop 13 acquisition caps, which we index to 2026" | No index has been applied since the house-price index was removed | Now "…so a roll value is not a market value." |
| Estimate row's source label | "screening estimate: N sq ft at ~$X/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool…" | Described the untested per-sq-ft model, not the tested one | Now the estimate's own method. |
| "Assessor market value" line | Value labeled as "on the roll" | It may be a statutory-ratio conversion (e.g. Michigan SEV × 2) | Labeled "Assessor-based value" with the rule used. |
| Per-project EIFD plan ("Who pays") | Bond amount; disclosure named turnover, pledges, rate and coverage | Two inputs were not named: 3% of the increment to administration, and reassessed values growing 2% a year | Both added to the disclosure, "all assumptions, not sourced figures". |
| EIFD calculator warnings (LA County) | "Board Policy 3.106 requires the city's contribution to at least equal the County's…"; "expects at least 15¢ of each captured $1" | The policy text could not be fetched (Municode 403; the County file link tried returned 404); round 2 had noted it as not re-fetched | Both warnings now say "(policy text not re-checked here)". |

e2e test: "no typed displacement score, package value or valuation decomposition reaches the page (select and house
click paths)", which fails on the code before this round (confirmed). Live check: see the end of this file.

## Every row of the 16 Nov audit

"Gone" = the snippet is no longer in the code (removed in rounds 1–2 or today's 0429a9f); checked by grepping each
row's distinctive literal.

### Owner Playbook card (+ copy memo, home compare)
| Row | Status |
|---|---|
| 5177 downtown-LA station fallback (34.05, −118.25) | Gone |
| 5249 SB 79 net equity $210/$165 per sq ft | Gone |
| 5255 SB 79 roi 3.85, cost $160k, $1,950 rent, 12% margin | Gone |
| 5272 TX SB 840 equity/roi/cost/payback | Gone |
| 5295 FL Live Local equity/roi + "75% TAX ABATEMENT" | Gone |
| 5324 WA HB 1110 roi/cost/cash flow | Gone |
| 5347 OR HB 2001 roi/cost/cash flow | Gone |
| 5370 AZ HB 2720/2721 | Gone |
| 5393 ADU $260/sq ft | Gone |
| 5396 ADU resale 165% of cost | Gone |
| 5399 $45k parking savings | Gone |
| 5195 solar savings $0.23/kWh etc. | Gone |
| 5445 lot split for any lot ≥ 4,800 sq ft, $45/sq ft | Gone |
| 5473 fallback best strategy | Gone |
| 5395 ADU rent from HUD FMR (class A) | n/a (sourced) |

### Executive Prospectus
| Row | Status |
|---|---|
| 11499 `playbook.optimal` bug | Gone |
| 11504 $2.50 per $1 fallback | Gone |
| 11509 $520k roll / ×1.6 | Gone |
| 11631–11637 Terner, Furman, 18–26% AC claim | Gone (Donovan & Butry's $7,130 is now quoted from the paper; round 2) |
| 11561/11564 state "Qualifies" boxes, 75% abatement | Gone (state rules come from statutes.json records) |

### Synergy Simulator
| Row | Status |
|---|---|
| 7492 checkbox costs/lifts, 7657 ×1.25/×1.12, 7665 value created, 7485 +15–25% | Gone (simulator removed 16 Nov) |

### P3 & transit corridor
| Row | Status |
|---|---|
| 7950 LA corridor shown for any county | Gone (no county falls back to 06037) |
| 8097 static 15.6% IRR, $1.62M, +12.5%, +54% | Gone |
| 8220 IRR/ridership adjustments | Gone |
| 8121 99-year ground lease narrative | Gone |

### Home value estimate, range, confidence
| Row | Status |
|---|---|
| 499 HPI_INDEX_TO_2026 | Gone |
| 526 STATE_BASELINE_PROFILES | Gone |
| 601 LUXURY_TIER_MUNICIPALITIES | Gone |
| 623 tier elasticity | Gone |
| 644 lot 6,000 default | Gone |
| 684 ×1.165 inflation | Gone |
| 689 hedonic land share / elasticities / premiums | **Still in the generic estimator, which is never shown** (`publishValuation` withholds it in every county without a passing back-test, and in tested counties the tested model is shown instead). Its decomposition **was** shown in "How is this estimated?": fixed today (above). |
| 766 state assessment ratios | Kept where statutory and named (MI SEV ×2, OH 35%, GA 40%, NV 35%, Cook 10%, TN 25%); they feed only the generic estimator and the "assessor-based value" line, now labeled with its rule. Cook and TN ratios are unverified and only reachable where estimates are withheld. |
| 938 confMarginPct | Set to null; no range is shown except a back-test's |
| 944 "High Precision" labels | Gone |
| 5550 / 11327 hv 400000, rent 1800 / hv 850000, rent 2200 fallbacks | Gone (the last one removed in 9388fd8) |

### Single-house auditor aside
| Row | Status |
|---|---|
| 1446 tree economics 7130/5400/… | Gone; dollars "not modeled" |
| 1641 solar inputs | Not reached: `calculateSolarMicrogridRoi` (with `STATE_SOLAR_CREDITS` and the federal credit rule) is defined but never called; the auditor reports solar as not modeled |
| 1083 STATE_SOLAR_CREDITS | Same: not called. Left in code; unverified |
| 1102 federal ITC 30%/6% | Same: not called. The page's one solar sentence ("the 30% federal credit… IRC § 25D ended for systems paid for after Dec 31, 2025") was confirmed against P.L. 119-21 § 70506 in the engines audit (`engines-sites-audit.md`) |
| 1695 mortgage 0.55% / tax 0.12% | Gone |
| 1721 synthetic contractor quotes | Gone |
| 1531 / 1554 default imagery dates | Gone (unknown dates stay null) |
| 2278 "Statutory By-Right Verified" | Gone |
| 2127 "Verified Current Imagery" | Gone |
| 1410 luxury saturation multiplier | Gone |
| 1423 permit capitalization 85%/60% | `permitCapitalizationAdded` is 0; not shown |
| `multiUnitBonusPct` (8%/unit) in the audit object | Computed, never rendered or sent to the advisor |

### Imagery / Street View
| Row | Status |
|---|---|
| 5655 hardcoded LiDAR 2020/2023, Street View 2021-06 | Gone |
| 5905 "LiDAR (2020) & Facade verified current" | Gone |
| 5621 permit date 2024-01-01 | Gone |

### Roof area & solar drawer
| Row | Status |
|---|---|
| 1958 roof cost per square; 6047 "RSMeans" | Gone; re-roof cost "not modeled yet" |
| 6025 placeholder roof facts | Gone ("–") |
| 1874 pitch defaults, complexity, setback, shade, 410 W, 19.5 sq ft/panel | Roof area/pitch still use the geometry model; the drawer says "a geometry estimate from living area, stories and an assumed pitch, not a measurement". Panels, kW and yield are computed but every display element is set to "not modeled". |

### ADU / addition cost schedule & upgrades table
| Row | Status |
|---|---|
| 4748 ADU hard cost schedule; 4859 second story $490/sf etc.; site adjustments ($4,800 panel, $26,000 hillside, $9,500 wildfire, $6,500 geotech, $110/ft trench, 15% GC) | **Still in code, not reached**: all 46 upgrade rows in `upgrade_verification.json` are unverified or could-not-check, and `houseUpgrades` gives unsourced rows no cost, value, note with figures or cost breakdown; the house "Upgrades that pay back" tiles count only sourced rows (0). |
| 4777 impact fees by state | Gone (round 2); CA kept from Gov. Code § 66311.5 |
| 4844 ADU rent 1750/2250/2850, NOI 70%, cap 5.5% | In code, not reached (same gate) |
| 4989 rent fallback 2102 | In `houseUpgrades` only; not reached (same gate) |
| 5025 bath $36,603 (JLC/Zonda) | Not reached (row unverified) |
| 5031 pool premium (Redfin 2019) | Not reached (row unverified) |
| 5028 bedroom conversion 5% | Not reached (row unverified) |
| 4800 CA school fee $5.38/sq ft | Verified (round 2; re-read in the DGS/OPSC document 17 Nov: Residential 2026 $5.38) |

### House checks list
| Row | Status |
|---|---|
| 4717 "addition recoups 58%" | Gone (round 2) |
| 4709 Brace + Bolt up to $3,000 / My Safe Florida | Now "maybe": Brace + Bolt "up to $3,000; only in eligible ZIP codes" (crmp.org, checked 16 Nov); Florida: "the My Safe Florida Home program offers grants when its application rounds are open" (no amount) |

### Value-per-$1 bands, displacement, package ceiling
| Row | Status |
|---|---|
| 2523 HEDONIC_SE "derived from literature" | Relabeled "judgment band ±X%, not a statistical interval" (0429a9f) |
| 2560 calibrateVpd local adjustment | Removed (0429a9f) |
| 2616 displacement fallbacks | **Fixed today** (above) |
| 1002 pMax 0.30/0.22 | **Fixed today**: the cap no longer reaches the page (its tile and index removed; function no longer called by the panel) |

### Recommendation cards, research library
| Row | Status |
|---|---|
| 4060 "540+ studies" | Gone |
| 9190 "Average Measured Benefit" | Gone |
| 4052 ×8.53 PV factor | Gone |

### Park and geography sections
| Row | Status |
|---|---|
| 7699–7732 park effects +1.0%/+0.4%/… | Gone; sections carry no figures |
| 7733 Chalfin 36% | Number gone; text says the effect size "has not been re-checked here" |
| 7722 Sampson 2019 | Gone |
| 7752 geography effects (+3.6%, Landry, Headwaters…) | Gone |

### Canopy HUD and ecoregions
| Row | Status |
|---|---|
| 2527 ECOREGIONS_TABLE; 9694 getEcoregionNorm; 11475 "+1.8°F vs Eco-Norm" | Gone (round 2: the block group's own Tree Equity goal) |

### EIFD / tax-increment
| Row | Status |
|---|---|
| 3943 FUND_ASSUME | Kept as labeled assumptions; disclosure completed today (admin 3%, growth 2%/yr). The calculator says "Everything else is an assumption you can edit, not a sourced figure". |
| 56 DEFAULT_CA_PROFILE 0.47 / 1.24 / $1,945 tree | Gone from code and profiles; the $1,945 methods sentence removed (0429a9f) |

### Residual land value
| Row | Status |
|---|---|
| 1168 NOI 70% | Still in `calculateResidualLandValue`, which is defined but never called; not reached |

### Statutory zoning engine and popup headline
| Row | Status |
|---|---|
| 338–463 SB 79 / TX / FL / WA / OR / AZ parameters | Read from statutes.json records via `statuteField` (round 1–3 laws work); `CA_SB79_ELIGIBLE_COUNTIES` gone |
| 1609 statutoryNotes | Built from statutes.json records, "Unverified screening — confirm with the planning department" |
| 11302 stateReformHeadline | Built from statutes.json records with their status |

### Site cards
| Row | Status |
|---|---|
| 3850 site cost comparables | Sourced (sites bundle metadata); unchanged |

## Other literals found by the sweep (not in the 16 Nov list)

| Where | Status |
|---|---|
| House facts "Open yard (est.): lot minus buildings, less ~20% for setbacks" | Labeled estimate with its basis stated; kept |
| Crossing / speed-hump / EV charger unit costs (LADOT 2025, LA City 2022 unit prices, AFDC) | Through `siteLink`, sourced; kept |
| Neighborhood transit card "~N min walk" (18 min per mile) | Walking time from distance at an assumed pace; shown with "~"; kept |
| Measure W 50%/110 points/60 threshold/110% | Verified in round 2 (2018 Board letter) |
| Cook County EIFD/OC policy lines | OC policy marked "not re-checked"; LA Policy 3.106 now marked too |

## Still unverified (left, and why)

- `calculateSolarMicrogridRoi`, `STATE_SOLAR_CREDITS`: unverified but never called. Remove or source before wiring up.
- Generic hedonic estimator rates (land shares, elasticities, premiums): unverified; withheld everywhere by the
  back-test gate. They must not be displayed (the e2e test guards the house panel).
- Cook 10% and Tennessee 25% assessment ratios: unverified; only reachable where estimates are withheld.
- ADU / second-story / site-adjustment cost schedule: unverified; gated off by `upgrade_verification.json`.
- LA County Policy 3.106 and the Orange County EIFD policy: could not be fetched; marked "not re-checked".
- `computeSubAdditivePackage` (pMax, displacement index) remains defined in app.js and in `src/engines`; it no longer
  feeds the page.

## Live check (17 Nov, real page, live data)

- `scripts/live_check_panels.mjs 06037 36081` (LIVE_PORT 8870): 6/6 parcels, every panel matches its source, except one
  LA ground elevation where USGS did not answer and the page said "Not available"
  (`data/backtests/live_check_panels_2026-11-17_constants3.json`).
- `scripts/live_check_constants3.mjs` on the same six points (`data/backtests/live_check_constants3_2026-11-17.json`):
  the map metric menu has no displacement option; in LA (block group 060372044201) and Queens (360810669002) the
  paying-projects tiles show "Home value created together: not modeled" and no "Joint Value Created" or displacement
  index; on the 3 of 6 house clicks that show an estimate (1 LA, 2 Queens), "How is this estimated?" lists recorded
  facts only, and none of the six panels contains a removed premium, "Site Land Value" or the "calibrated" claim.
  No page errors.
