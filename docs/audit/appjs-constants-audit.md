# app.js constants & claims audit

**Date:** 2026-11-16 · **Scope:** `app/app.js` (11,674 lines), `app/explore.js` · audit only, no code changed.

Excluded (engines track): `src/engines/*` and the internals of the EverySpace / StreetForge / renovation engines. `app/explore.js` has no hardcoded $/% facts of its own — it ranks ideas from the county bundle catalog and labels grades honestly; **the bundle catalog itself (81 interventions in `app/data/bundle-la.b64.txt`, including a claimed grade-A 'City Pretty local hedonic: 3,386 Westside sales' estimate) was not audited here and needs its own pass.**

## Class legend

- **A** — traced to a dataset in `app/data` that carries a source
- **B** — cites a named source (marked whether that source is in `app/data/research.json`, itself under re-audit)
- **C** — no source: invented constant or assumption
- **D** — text that asserts certainty or verification that isn't backed

## Counts

97 entries (an entry can carry more than one class). A: 2, B: 28, C: 63, D: 34

## 15 most consequential

Ranked by how prominently it is shown and whether it produces a $ figure someone would act on. Entries sharing a rank are one finding.

| Rank | Where | Finding |
|---|---|---|
| 1 | `app/app.js:5393` | ADU cost at $260/sq ft — contradicts the page's own ADU schedule (~$500+/sq ft, line 4748) — C |
| 1 | `app/app.js:5396` | ADU resale value = 165% of cost; drives 'net equity' and ROI of the #1 card — C |
| 1 | `app/app.js:5399` | Adds $45k to equity of transit ADU; nationwide 'statutory parking exemption' text — C+D |
| 2 | `app/app.js:5249` | Headline 'Net Equity' $ for CA SB 79 strategy ($210/$165 per lot sq ft) — C |
| 2 | `app/app.js:5255` | SB 79 'Return per $1' 3.85, cost $160k, cash flow ($1,950 rent, 12% margin) — all hardcoded — C |
| 2 | `app/app.js:5272` | TX SB 840 strategy equity/ROI/cost/payback — C |
| 2 | `app/app.js:5295` | FL Live Local strategy equity/ROI/cost + '75% TAX ABATEMENT' badge — C+D |
| 2 | `app/app.js:5324` | WA HB 1110 strategy ROI/cost/cash flow — C |
| 2 | `app/app.js:5347` | OR HB 2001 strategy ROI/cost/cash flow — C |
| 2 | `app/app.js:5370` | AZ HB 2720/2721 strategy — C |
| 3 | `app/app.js:5445` | Offers a lot split to ANY lot >= 4,800 sq ft in any state (no zoning/statute gate), with $45/sq ft 'six-figure land equity'. Same for Strategy 1 (line 5390): a 'By-Right' ADU card for any lot >= 4,500 sq ft regardless of zoning or state. The playbook card renders for every parcel opened (line 6091). — C+D |
| 4 | `app/app.js:11499` | BUG: computePropertyPlaybook returns {best, alternatives, all}; .optimal is undefined, so the prospectus never uses the lot's strategy — D |
| 4 | `app/app.js:11504` | Because of the bug above, EVERY prospectus prints 'Return per Invested Dollar: $2.50 per $1.00' and title 'Transit-Oriented By-Right Infill ADU' — C+D |
| 5 | `app/app.js:11631` | Section titled 'Empirical Academic Grounding (Verified Studies)' — B+D |
| 5 | `app/app.js:11634` | Same section — B+D |
| 5 | `app/app.js:11637` | Same section — B+D |
| 6 | `app/app.js:7492` | Cost and % lift of each package item — C |
| 6 | `app/app.js:7657` | Multiplies total lift UP by 12–25%, contradicting the app's own sub-additive ceiling (line 1002) — C+D |
| 6 | `app/app.js:7665` | 'Total Home Value Created' applies the lift linearly to every home in the block group; static HTML shows '+$36,375,000' and '$48.50 per $1 invested' (line 7604ff) before the sim even runs — C+D |
| 7 | `app/app.js:7950` | Any county with no pipeline record is shown LOS ANGELES's transit corridor as its own — C+D |
| 8 | `app/app.js:8097` | Shown before runP3Sim replaces them, and pasted into the copied term sheet if elements are missing — C |
| 8 | `app/app.js:8220` | Developer IRR, ridership and lift adjustments — C |
| 9 | `app/app.js:1641` | Solar payback (cash vs lease) — C |
| 9 | `app/app.js:5195` | Solar strategy savings/cost/payback (also 5941-5944 in roof drawer, $0.23/kWh) — C |
| 10 | `app/app.js:499` | Indexes every sale/base-year to 2026; header comment claims FHFA & Case-Shiller — B+C |
| 10 | `app/app.js:526` | Fallback neighborhood value when block-group data is missing — a stand-in number the Nov-15 audit said was removed — C |
| 11 | `app/app.js:938` | The ± range shown next to the value — C+D |
| 11 | `app/app.js:944` | Confidence label shown under value — D |
| 12 | `app/app.js:4844` | ADU rent and resale value (return per $1) — C |
| 12 | `app/app.js:11561` | Prospectus state-rules box claims the lot 'Qualifies' (checkmark) for TX/FL/WA/CA — B+D |
| 13 | `app/app.js:2278` | Green verification badge — D |
| 13 | `app/app.js:4060` | Count claim (library has 52, most failed DOI checks) — D |
| 13 | `app/app.js:9190` | Presents unverified studies as measured — D |
| 14 | `app/app.js:5655` | Hardcoded imagery dates for every parcel in the country — C+D |
| 14 | `app/app.js:5905` | Shown for every house without a post-imagery remodel; nothing is checked — D |
| 15 | `app/app.js:1958` | Re-roof $ estimates — C+D |
| 15 | `app/app.js:6047` | False attribution to RSMeans (no RSMeans data in repo) — D |

## Recommended fix strategy

1. **Delete, don't relabel, the class-C dollar outputs that a user would act on**: the Owner Playbook's per-strategy equity/ROI/cost/cash-flow constants, the Synergy Simulator, the P3 IRR/ridership adjustments and static placeholders, the Prospectus 2.50 fallback, and the three unsourced 'Verified Studies' in the Prospectus. Show 'not modeled yet' instead.
2. **Fix the two logic bugs**: `playbook.optimal` → `playbook.best` (11499), and the LA-pipeline fallback for every county (7950).
3. **One `ASSUMPTIONS` registry** (e.g. `app/data/assumptions.json`): every remaining modeling constant (hedonic coefficients, cap rates, NOI share, roof factors, EIFD pledges, solar inputs) gets an id, value, unit, basis ('judgment', 'transferred from X', or a source URL), and `status: assumption|sourced`. Code reads constants only from the registry, and every UI number derived from an assumption shows a small 'assumption' tag that opens the basis. A unit test fails if a numeric literal that looks like money/percent appears in a computation outside the registry (allow-list for layout values).
4. **Replace fallbacks with nulls** (STATE_BASELINE_PROFILES, LUXURY_TIER_MUNICIPALITIES, hv/rent placeholders, lot 6000, imagery dates, permit date, roof placeholders); swap in official pulls where free: Census ACS (B25077 home value, B25064 rent, B25003 tenure, B25070 burden), FHFA HPI, NREL PVWatts, EIA electricity prices, EPA ecoregion polygons.
5. **Strip certainty language** unless backed by a check log: 'Verified', 'High Precision', 'institutional', 'Statutory By-Right Verified', 'Facade verified current', 'RSMeans', '540+ studies', 'Average Measured Benefit'.
6. **Legal parameters** in `evaluateByRightHousing` and the prospectus/popup statute strings should read from `statutes.json` records that the laws track verifies, and display each record's verification status.

## All entries, by feature

### House panel: Owner Playbook card (+ copy memo, home compare)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:5177` | const cLat = ll ? ll.lat : 34.05, cLng = ll ? ll.lng : -118.25 | Nearest-station search runs from downtown LA when the lot has no coordinates | **C** | Remove fallback; return no playbook when location is unknown. |
| `app/app.js:5249` | netEq = Math.round(lotSqft * (isTier1 ? 210 : 165)) | Headline 'Net Equity' $ for CA SB 79 strategy ($210/$165 per lot sq ft) | **C** | Remove. Replace with residual-land-value calc fed by sourced rents (HUD FMR), sourced costs, and local land comps; until then show no $. |
| `app/app.js:5255` | roi: 3.85, cost: 160000, annualCashflow: units*1950*12*0.12 | SB 79 'Return per $1' 3.85, cost $160k, cash flow ($1,950 rent, 12% margin) — all hardcoded | **C** | Remove hardcoded ROI/cost/rent; derive or omit. |
| `app/app.js:5272` | netEq = lotSqft * 95; roi: 2.95; cost: 85000; annualCashflow: lotSqft*9.5; paybackYrs '1.2' | TX SB 840 strategy equity/ROI/cost/payback | **C** | Remove; same as above. |
| `app/app.js:5295` | netEq = lotSqft * 115; roi: 3.35; cost: 95000; annualCashflow: lotSqft*11 | FL Live Local strategy equity/ROI/cost + '75% TAX ABATEMENT' badge | **C+D** | Remove $; verify Live Local terms via laws track before showing badge. |
| `app/app.js:5324` | roi: 2.65, cost: 65000, units*1400*12*0.20 | WA HB 1110 strategy ROI/cost/cash flow | **C** | Remove. |
| `app/app.js:5347` | roi: 2.50, cost: 58000, units*1350*12*0.18 | OR HB 2001 strategy ROI/cost/cash flow | **C** | Remove. |
| `app/app.js:5370` | roi: 2.35, cost: 52000, annualCashflow: 1500*12, paybackYrs '3.2' | AZ HB 2720/2721 strategy | **C** | Remove. |
| `app/app.js:5393` | aduCost = Math.round(aduSqft * 260) | ADU cost at $260/sq ft — contradicts the page's own ADU schedule (~$500+/sq ft, line 4748) | **C** | Use one cost model (the labeled-unverified ADU schedule) or none. |
| `app/app.js:5396` | resValue = Math.round(aduCost * 1.65) | ADU resale value = 165% of cost; drives 'net equity' and ROI of the #1 card | **C** | Remove; value must come from local sales/income approach with sourced inputs. |
| `app/app.js:5399` | parkingSavings = inWalkshed ? 45000 : 0 (also '~$45k' text at 5412/5417, '$35,000–$55,000' at 5772) | Adds $45k to equity of transit ADU; nationwide 'statutory parking exemption' text | **C+D** | Remove $; parking exemption is CA AB 2097-specific, not a national rule. |
| `app/app.js:5195` | solarSavYr = solarKw * 1450 * 0.23; solarGrossCost = solarKw*2800; battery 12000; ppa net = capex*0.70 | Solar strategy savings/cost/payback (also 5941-5944 in roof drawer, $0.23/kWh) | **C** | Replace with NREL PVWatts (free API) for yield + EIA/utility tariffs for rates; label assumptions. |
| `app/app.js:5445` | if (lotSqft >= 4800) { ... 'Missing-Middle Two-Unit Subdivision' ... addedLandValue = lotSqft * 45; roi 2.45; cost 35000; paybackYrs 'Instant' } | Offers a lot split to ANY lot >= 4,800 sq ft in any state (no zoning/statute gate), with $45/sq ft 'six-figure land equity'. Same for Strategy 1 (line 5390): a 'By-Right' ADU card for any lot >= 4,500 sq ft regardless of zoning or state. The playbook card renders for every parcel opened (line 6091). | **C+D** | Gate on evaluateByRightHousing result + recorded zoning; remove $45/sqft. |
| `app/app.js:5473` | best fallback: equity 35000, roi 1.45, cost 24000, annualCashflow 1800, payback 4.5 | Shown as best strategy when nothing else applies | **C** | Remove; show 'no modeled strategy'. |
| `app/app.js:5395` | moRent = fmrRec ? fmrRec.two_bed_2br/one_bed_1br : F.rent | ADU rent | **A** | OK: now reads app/data/hud_fair_market_rents.json (official HUD pull, scripts/fetch_hud_fmr.py). Note the surrounding ADU cost/resale are still class C. |

### Executive Prospectus (printable PDF)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:11499` | const strat = playbook ? playbook.optimal : null | BUG: computePropertyPlaybook returns {best, alternatives, all}; .optimal is undefined, so the prospectus never uses the lot's strategy | **D** | Fix to playbook.best (after the playbook $ are fixed). |
| `app/app.js:11504` | const vpd = ... : 2.50 | Because of the bug above, EVERY prospectus prints 'Return per Invested Dollar: $2.50 per $1.00' and title 'Transit-Oriented By-Right Infill ADU' | **C+D** | Remove the 2.50 fallback; print 'not modeled'. |
| `app/app.js:11509` | rollVal = ... : 520000; aPrice = houseHv \|\| F.aPrice \|\| rollVal * 1.6 | Invented $520k roll value and x1.6 markup when assessor value missing | **C** | Remove fallback. |
| `app/app.js:11631` | UC Berkeley Terner Center (2023): '14.8%–22.4% unlevered cap rates ... outperforming ... by 2.4x' | Section titled 'Empirical Academic Grounding (Verified Studies)' | **B+D** (not in research.json) | Remove. Not in research.json; no matching publication located; numbers look fabricated. |
| `app/app.js:11634` | Furman Center NYU (2022): '21.8% higher rate of permit issuance ... 4.2 months faster' | Same section | **B+D** (not in research.json) | Remove. Not in research.json (the only Furman entry is an unrelated BID study whose DOI failed). |
| `app/app.js:11637` | USDA Forest Service (Donovan & Butry): '+$7,130 ... curbing AC bills by 18%–26%' | Same section | **B+D** (in research.json) | Keep only if research track verifies the $7,130 figure; the 18–26% AC claim has no source. research.json tree_001 DOI returned 404 in Crossref. |
| `app/app.js:11561` | 'Texas ... up to 3 residential units by-right ... minimum lot sizes reduced to 2,500 sqft ... mandatory parking waivers' | Prospectus state-rules box claims the lot 'Qualifies' (checkmark) for TX/FL/WA/CA | **B+D** | Route through statutes.json records verified by laws track; show the record's verification status. |
| `app/app.js:11564` | 'Middle Housing Infill & 75% Tax Abatement (SB 102/328)' | FL box | **B+D** | Same as above. |

### Neighborhood panel: Multi-Project Synergy Simulator (open by default)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:7492` | 12 checkboxes with data-cost (120000..850000) and data-lift (0.022..0.052), e.g. trees $120k +2.4%, school $450k +4.5%, beach $850k +5.2% | Cost and % lift of each package item | **C** | Remove the simulator or drive it from the county catalog (bundle) items with their grades and caveats. |
| `app/app.js:7657` | mult = 1.25 (3+ items) / 1.12 (2 items) 'compounding synergy' | Multiplies total lift UP by 12–25%, contradicting the app's own sub-additive ceiling (line 1002) | **C+D** | Remove; use computeSubAdditivePackage. |
| `app/app.js:7665` | valCreated = homes * hv * totLift * mult | 'Total Home Value Created' applies the lift linearly to every home in the block group; static HTML shows '+$36,375,000' and '$48.50 per $1 invested' (line 7604ff) before the sim even runs | **C+D** | Remove static placeholders; no value without sourced lifts and a reach radius. |
| `app/app.js:7485` | 'creating +15% to +25% h[ome value]' synergy claim in intro text | Marketing claim | **D** | Remove. |

### Neighborhood panel: P3 & Transit Corridor (open by default)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:7950` | if (!found) found = list.find(p => p.fips === '06037') | Any county with no pipeline record is shown LOS ANGELES's transit corridor as its own | **C+D** | Return null and show 'no adopted corridor on file for this county'. |
| `app/app.js:8097` | static '15.6%' IRR, '$1.62M / yr', '+12.5%', '+54%' in markup (also copyP3TermSheet defaults 8169-8172) | Shown before runP3Sim replaces them, and pasted into the copied term sheet if elements are missing | **C** | Render 'Not on file' placeholders. |
| `app/app.js:8220` | termAdj (0/-0.4/-1.2), affordAdj (+0.6/0/-0.8), +0.4/+0.2/+0.3/+0.5 IRR bumps, ridership +4/+8, lift +1.2 | Developer IRR, ridership and lift adjustments | **C** | Remove adjustments; IRR needs a real pro forma. |
| `app/app.js:8121` | '99-year ground lease with zero taxpayer bond debt ... guaranteed annual lease' P3 narrative | Deal structure presented as fact | **D** | Label as an example structure, not this agency's terms. |

### House panel: home value estimate + range + confidence label

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:499` | HPI_INDEX_TO_2026 {2025:1.042 ... 1980:9.800} | Indexes every sale/base-year to 2026; header comment claims FHFA & Case-Shiller | **B+C** | Replace with FHFA HPI series pulled by script (free, public) at metro/state level; cite series id. |
| `app/app.js:526` | STATE_BASELINE_PROFILES (medianHv/medianVpsf/refSqft/refLot for 52 states) | Fallback neighborhood value when block-group data is missing — a stand-in number the Nov-15 audit said was removed | **C** | Replace with Census ACS B25077 (median value) pulled by script, or return no estimate. |
| `app/app.js:601` | LUXURY_TIER_MUNICIPALITIES (Beverly Hills 3,950,000 ... Atherton 6,800,000) | Replaces ACS top-coded medians with invented city medians | **C** | Remove; mark top-coded areas as 'above ACS cap'. |
| `app/app.js:623` | getTierElasticity: 1.05/1.00/0.82/0.70/0.58 by price band ('Case-Shiller tier') | Dampens appreciation for expensive homes | **B+C** | Use FHFA/Case-Shiller tier indices if available; else remove. |
| `app/app.js:644` | lotSqft = 6000 default parameter | Lot size fallback in valuation | **C** | Remove default. |
| `app/app.js:684` | baseNeighborhoodHv * 1.165 ('ACS midpoint 2022.5 -> late 2026 +16.5%') | Inflates ACS median by 16.5% | **C** | Derive from FHFA HPI change over the actual ACS window. |
| `app/app.js:689` | landShare 0.58/0.42/0.35/0.28 by state group; GLA elasticity 0.68 (700); lot 0.18/0.35 (706-710); bed/bath .025/.035; age .003; quality ±8/16%; pool 2.5/5%; garage 2.5%; view 3.5%; basement 10%; condo 0.92; multi-unit 8% | Hedonic micro-model coefficients | **C** | Label 'uncalibrated assumptions' in the methodology drawer, or estimate coefficients on real county sales. |
| `app/app.js:766` | Michigan SEV * 2.0 * 1.04; FL/TX JV*1.03; AZ/WA/OR/PA/NY/WI/NC *1.02; OH /0.35; IL Cook *10; GA /0.40; NV /0.35; TN /0.25; CO /0.067 (lines 766-848) | Converts assessed values to market value per state statute ratios plus unexplained 2–4% markups | **B+C** | Statute ratios belong in state_finance_profiles.json (laws track verifying). CO 6.7% is year-specific and likely stale for 2026. Drop the 1.02–1.04 markups. |
| `app/app.js:938` | confMarginPct 0.065 / 0.038 / 0.050 / 0.078 | The ± range shown next to the value | **C+D** | Ranges must come from a real back-test (none exists — the benchmark file was fabricated). Show 'accuracy untested'. |
| `app/app.js:944` | '±3.8% high-precision institutional agreement'; ratings 'High Precision', 'High Confidence (Vacant Infill Land Appraisal)' | Confidence label shown under value | **D** | Remove certainty labels. |
| `app/app.js:5550` | fallback neighborhood { c: 'Neighborhood', hv: 400000, rent: 1800 } (also 11327: hv 850000, rent 2200) | Invented neighborhood value/rent when no block group selected | **C** | Remove fallbacks. |

### House panel: Single-House Auditor aside (solar, trees, imagery, EverySpace/renovation inputs)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:1446` | calculateCalibratedTreeEconomics: baseVal 7130/5400/8200/6200; savings 140/95/220/115; irrigation 20/0/45/10 | Tree value lift and utility savings by climate regime | **B+C** (in research.json) | 7,130 matches research.json tree_001 (Donovan & Butry, Portland) whose DOI 404'd; other regimes invented. Keep only Portland figure if verified, labeled as transferred. |
| `app/app.js:1641` | solar inputs: $3.15/$2.85 per W, 1620/1780/1250 kWh/kW, $0.38/$0.16 import, $0.055/$0.14 export, self-consumption 0.78/0.50, battery $11,500 (1641-1672) | Solar payback (cash vs lease) | **C** | PVWatts + EIA state average price; label install cost as assumption. |
| `app/app.js:1083` | STATE_SOLAR_CREDITS NY 25%/$5,000, MA 15%/$1,000, AZ 25%/$1,000, SC 25%/$3,500 | State solar tax credits | **C** | Verify each against state statute (laws track) and move to a sourced dataset. |
| `app/app.js:1102` | federalItcPct 0.3 vs 0.06 for 2026 TPO depending on FEOC/prevailing wage; '§25D expired Dec 31 2025 (OBBBA P.L. 119-21)' | Federal credit applied in solar math and text at 1777/1826, 6077, 5434-5439 | **B** | Engines track is verifying 2025 law changes; centralize in one sourced record. |
| `app/app.js:1695` | monthlyDebtServiceMortgageUsd = value * 0.0055; tax&insurance = value * 0.0012 | Inputs to EverySpace carry calculation | **C** | Label as assumption with stated rate, or take user input. |
| `app/app.js:1721` | renovationOptions quotedTotalCost: 65_000 / 185_000 / 26_000 | Synthetic 'contractor quotes' evaluated and shown as 'Quote: $X' in the Renovation Quote Evaluator | **C+D** | Remove; the evaluator should only run on a user-uploaded quote. (Overlaps engines track.) |
| `app/app.js:1531` | sale year default 2023 when date missing; lidarYear \|\| 2020; streetView \|\| '2021-06' (1554-1555, 1767-1768) | Fabricated dates fed into imagery-vintage check | **C+D** | Remove defaults; unknown dates stay unknown. |
| `app/app.js:2278` | 'Statutory By-Right Verified' badge on Renovation Quote Evaluator | Green verification badge | **D** | Remove. |
| `app/app.js:2127` | '✓ Verified Current Imagery' when confidenceBadge === 'verified_current' | Badge can be reached with no imagery actually checked (dates are hardcoded upstream) | **D** | Remove until imagery dates are read from source metadata. |
| `app/app.js:1410` | getHighValueSaturationMultiplier: (2.5M/value)^0.45 | Luxury dampening | **C** | Label as assumption or remove. |
| `app/app.js:1423` | permit capitalization: 85% up to $250k, 60% above, seismic capped $15k | Adds permit value to estimate | **C** | Label as assumption or remove. |

### House panel: imagery / Street View

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:5655` | lidarYear: CA ? 2020 : 2023; streetViewDate: hasStreetView ? '2021-06' : null | Hardcoded imagery dates for every parcel in the country | **C+D** | Read capture dates from the actual imagery/LiDAR metadata or show 'unknown'. |
| `app/app.js:5905` | '✓ Remote Sensing Cadastre: LiDAR (2020) & Facade verified current with tax roll vintage' / 'USGS 3DEP / LARIAC Cadastral Mesh' | Shown for every house without a post-imagery remodel; nothing is checked | **D** | Remove. |

### House panel

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:5621` | permit issue_date default '2024-01-01' | Fabricated permit date | **C** | Remove default. |

### House panel: Roof area & solar drawer

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:1958` | roof cost per square: shingles $460–590, metal $1,100–1,480, tile $1,250–1,750, other $580–820 (1958-1990) | Re-roof $ estimates | **C+D** | Label as unverified assumption; drop 'RSMeans' attribution unless licensed data is used. |
| `app/app.js:6047` | 'Re-Roofing Material Estimates (RSMeans 2026 Installed)' | False attribution to RSMeans (no RSMeans data in repo) | **D** | Remove attribution. |
| `app/app.js:6025` | placeholders when roofCalc missing: '24' sqs, '1.118x (6:12)', '1,200' sq ft, '60' panels (6025-6040) | Invented roof facts shown as measurements | **C** | Show '–'. |
| `app/app.js:1874` | roof engine: pitch defaults 3.5/7/7.5/4.5/6.0 by era (1853-1872), complexity 1.01–1.16, azimuth 0.88/0.64, setback 0.18, shade 0.05, 410 W panels, 19.5 sq ft/panel, yield 1520/1240 | Roof area & solar kW | **C** | Label as assumptions; prefer OSM roof tags / LiDAR when available. |

### House panel: ADU / addition cost schedule & upgrades table

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:4748` | ADU hard cost schedule: 400sf $503.75/sf, 650sf $201.5k->$317.5k, 800sf $378k; trade splits .12/.36/.13/.18 (4743-4770) | ADU construction cost (already labeled 'unverified' in UI at 4926) | **C** | Keep label; replace with sourced cost data when available. |
| `app/app.js:4777` | WA HB 1337 'prohibits ... impact fees' -> $0; FL 'Live Local Act abatement' 3500+8/sf; 'Austin HOME infill schedule' 4000+10/sf; default 5000+12/sf (4774-4784) | Impact fees by state with invented attributions | **B+C+D** | Remove attributions not verified by laws track; CA $5.38/sf SAB Level 1 needs verification too. |
| `app/app.js:4844` | baseRentMo 1750/2250/2850+1.5/sf; NOI 70%; cap 5.5%; resale = 0.5*income + 0.5*(sqft*vpsf*0.82) | ADU rent and resale value (return per $1) | **C** | Use HUD FMR (now official) for rent; label cap rate as assumption. |
| `app/app.js:4859` | second story $490/sf, demo 28000, stairs 19000, plans 24000, temp housing 28000, permits 14000+12/sf | Addition cost | **C** | Already labeled unverified; keep label. |
| `app/app.js:4989` | medRent fallback 2102; rent1 = 2102 * locRent | LA median rent used as base everywhere when bundle lacks rent_med | **C** | Use HUD FMR / ACS B25064 for the active county. |
| `app/app.js:5025` | bath addition v = 36603 (JLC/Zonda Cost vs Value 2025, LA) | Upgrade value | **B** (not in research.json) | Paywalled source; not in research.json; keep only with citation link + 'survey estimate' label (present). |
| `app/app.js:5031` | pool premium 20000/56000/95000 ('Redfin 2019') | Upgrade value | **B** (not in research.json) | Not in research.json; 2019 blog estimate; label or remove. |
| `app/app.js:5028` | v = houseHv * 0.05 (bedroom conversion) | Upgrade value | **C** | Label as assumption (already says 'estimate'). |
| `app/app.js:4800` | CA school fee '$5.38/sq ft (SAB Level 1, Jan 2026)' | School fee | **B** | Named source; verify current SAB Level 1 rate. |

### House checks list

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:4717` | 'an addition recoups only about 58%' (JLC/Zonda) | Text claim | **B** (not in research.json) | Same source as 5025. |
| `app/app.js:4709` | 'qualifies for California Earthquake Brace + Bolt grant (up to $3,000)' / FL 'My Safe Florida Home grant (up to $10,000)' (4709-4711) | Asserts grant eligibility as 'yes' from year built alone | **B+D** | Say 'may be eligible — check program'; verify amounts. |

### Neighborhood ranking: value-per-$1 bands, displacement metric

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:2523` | HEDONIC_SE { A: 0.041, B: 0.063, C: 0.087, D: 0.125 } 'derived from published ... literature' | The ± band on every value-per-$1 range | **B+D** | No source given for these SE rates; label as judgment bands (UI partly does: 'judgment band'). |
| `app/app.js:2560` | calibrateVpd fallbacks: canopy gap 20, heat 0, hv 850000, buses 4, dining 2, tree sites 50; factors .035/.008/.28/.02/.015, freeway 0.90 | Local adjustment multiplier on value per $1 | **C** | Skip adjustment when inputs missing (no fallbacks). |
| `app/app.js:2616` | displacement metric fallbacks: renter share 0.48/0.40, burden 0.28, rent control 0.15; weights .45/.40/.15 | Renter displacement score shown on map when data missing | **C** | Return null when inputs missing (ACS B25003/B25070 can supply real values). |
| `app/app.js:1002` | pMax = 0.30 urban / 0.22 suburban joint capitalization ceiling | Caps package value | **C** | Label as assumption. |

### Recommendation cards

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:4060` | 'Explore 540+ Research Studies' | Count claim (library has 52, most failed DOI checks) | **D** | Show actual count of verified studies. |

### Research library modal

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:9190` | '... empirical research studies · Average Measured Benefit: $X / $1' | Presents unverified studies as measured | **D** | Relabel; show verification status per study. |

### Recommendation cards (QoL mode)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:4052` | benefit[0] * 8.53 (10-yr PV factor) | Public benefit per $1 | **C** | Already labeled 'unverified estimate'; state the discount rate. |

### Neighborhood panel: Specific Park Improvements / Geography-Specific Improvements

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:7699` | '+1.0% within 400 m', '+0.4% within 300 m', '+0.3% within 200 m', '+1.4% within 400 m' (7699-7732) | Home value effects of specific park items | **C** | Tie each to a verified research.json record or remove. |
| `app/app.js:7733` | 'Nighttime outdoor crime drops 36% (Chalfin et al. 2021 NYC randomized controlled trial)' | Crime claim | **B** (in research.json) | research.json safe_002 — DOI check was rate-limited; research track verifying. |
| `app/app.js:7722` | '(Philadelphia Mural Arts / Sampson 2019)' | Graffiti claim | **B** (not in research.json) | Not in research.json; verify or remove. |
| `app/app.js:7752` | geography items: bioswales +3.6% @400m, bayou trail +2.8%, desert cool corridor +3.4% & 'up to 12°F', xeriscape +2.6%, beach +5.2% (Landry et al.), volleyball +0.8%, MTB +3.2% (Headwaters), rail-trail +3.0% (7752-7790) | Home value effects by geography | **B+C** (not in research.json) | Landry/Headwaters not in research.json; others unsourced. Remove % or tie to verified records. |

### Canopy HUD + methods modal (ecoregion / heat)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:2527` | ECOREGIONS_TABLE (6 regions; targetCanopy 12–38; coolingFactor 0.90–1.45) chosen by lat/lng boxes, labeled 'EPA Level IV' | Heat/canopy normalization | **C+D** | Use the real EPA Level III/IV ecoregion polygons (free) or drop the EPA label. |
| `app/app.js:9694` | getEcoregionNorm: 'EPA IV: 85g / CEC Zone 9', baselineSummerTemp 85/72/96/93/89/74/79/82, targetCanopy 30/25/15/32/35/42/38/30 (9688-9745) | Ecoregion code and target canopy shown in canopy HUD and methods modal | **C+D** | Same; codes are assigned by bounding box, not looked up. |
| `app/app.js:11475` | no-selection HUD: '+1.8°F vs Eco-Norm', '16% to Regional Goal' | Static numbers shown for whole county | **C** | Show '–'. |

### EIFD / tax-increment calculator

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:3943` | FUND_ASSUME { turnover 0.035, cityPledge 0.75, countyPledge 0.49, uninc 0.5, admin 0.03, rate 0.0525, dscr 1.35, years 30, housing 0.20 } | EIFD bond capacity per project | **C** | Expose as editable assumptions with stated basis; county pledge policy should cite LA County policy doc. |
| `app/app.js:56` | DEFAULT_CA_PROFILE non_pledgeable_share 0.47, rsmeans_cost_multiplier 1.24, tree_capital_cost_usd 1945, verified_by 'state_statute_database' | CA defaults used before state_finance_profiles.json loads | **C+D** | 0.47 and 1.24 have no source; 1945 matches LAMC 62.177 in the LA bundle catalog; remove 'verified_by'. Should load from the JSON only. |

### Residual land value calc

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:1168` | residual land: NOI = 70% of gross rent | Feasibility | **C** | Expose as assumption. |

### Statutory zoning engine (feeds playbook, auditor, prospectus)

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:338` | SB 79 Tier 1: 120 units, 75 ft, FAR 3.5, 10% affordability; Tier 2: 100/65/3.0 (334-361); CA_SB79_ELIGIBLE_COUNTIES list (291) | By-right capacity used in playbook | **B** | Hardcoded in code, not linked to statutes.json; laws track must verify; move to data with citation. |
| `app/app.js:381` | TX: municipality_pop > 150000 && county_pop > 300000; units 999; parking 1.0 | TX SB 840/SB 15 gate | **B** | Verify thresholds against enrolled bill text. |
| `app/app.js:411` | FL Live Local: affordability 0.40, tax_exemption 0.75, parking 0.5/1.0 | Feeds '75% tax abatement' badges | **B** | Verify; § 196.1979 exemption terms are more nuanced (unit-level, AMI tiers). |
| `app/app.js:418` | WA: >75k -> 4/6 units, >=25k -> 2/4; near transit 0.25 mi; affordability 0.17 (418-433) | WA HB 1110 | **B** | Verify; '0.17' affordability share has no visible source. |
| `app/app.js:437` | OR: >25k -> 4 units, >10k -> 2 (436-449) | OR HB 2001 | **B** | Verify thresholds. |
| `app/app.js:453` | AZ: municipality_pop > 75000, 4 units, 30 ft, parking 1.0 (453-463) | AZ HB 2720/2721 | **B** | Verify. |
| `app/app.js:1609` | statutoryNotes: 'SB 9 ... (>=4,800 sq ft)'; 'mandatory 75%–100% property tax exemption under Fla. Stat. § 196.1979' | Auditor statutory notes | **B+D** | SB 9 itself has no 4,800 sq ft trigger (that's the 1,200 sf min new lot + 60/40 split rule interplay); verify. |

### Map popup headline

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:11302` | stateReformHeadline strings (AB 2097, HB 1110, HB 1337 'up to 2 ADUs ... zero owner-occupancy', HB 24-1152, HB 24-1313, HB 2001, CFEC, HB 2720/SB 1415) (11298-11320) | Statute summaries | **B** | Point each to a verified statutes.json record. |

### Neighborhood panel: site cards

| Location | Snippet | What it drives | Class | Recommended action |
|---|---|---|---|---|
| `app/app.js:3850` | site cost-for-scale lines: Puente Creek Bikeway $3.7M, Walnut Park pocket park $4.62M, CARB $9,575 per L2 connector (3850-3866) via siteLink(...) -> SITES.meta.verified | Project cost comparables | **A** | Sourced from the sites bundle meta.verified with links (not re-verified in this audit). |

