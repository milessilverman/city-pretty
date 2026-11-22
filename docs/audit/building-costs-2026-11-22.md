# Building costs and housing funding: what was fetched (22 Nov 2026)

Data and loaders. The displayable rows feed the Invest view's courses of action (docs/PROJECT-CARDS.md). Rows marked `display_allowed: false` are not in `app/`: since 22 Nov 2026 the build scripts write them to `data/internal/<name>_internal.json` (same shape), which the page never requests and the site build never copies (`scripts/costs/costlib.py` `dump_split`). Files:

| File | What | Built by |
|---|---|---|
| `app/data/building_costs.json` | 96 displayable cost rows (DoD factors by state, Terner studies that may be shown, Los Angeles ADU medians) | `scripts/costs/build_building_costs.py`, `adu_permit_costs_la.py` |
| `data/internal/building_costs_internal.json` | the other 254 rows, all `display_allowed: false`: the ICC table (238 cells) and 16 more | same script |
| `app/data/area_cost_factors.json` | DoD area cost factor for 5,016 places | same |
| `app/data/housing_funding_rules.json` | 173 displayable rows: LIHTC law and rates, HUD limits, HOME limits | `scripts/costs/build_housing_funding_rules.py` |
| `data/internal/housing_funding_rules_internal.json` | the other 62 rows, `display_allowed: false`: Florida and Pennsylvania cost data, one equity-price survey | same script |
| `app/data/hud_income_limits.json` | HUD income limits, FY2026, 1,038 counties | `scripts/costs/fetch_hud_income_limits.py` |
| `app/data/adu_permit_costs_la.json` | the Los Angeles ADU medians with the exact query | `scripts/costs/adu_permit_costs_la.py` |
| `tests/unit/buildingCosts.test.ts`, `tests/fixtures/costs/` | schema checks, and values re-checked against saved source text or API responses | |

Each build script checks every quote against the fetched file before writing (`scripts/costs/costlib.py`), so a quote
that is not in the source stops the build. Rows carry `display_allowed` and `display_terms`. Downloads stay outside the
repository (`--cache`).

## a. ICC Building Valuation Data: internal use only, not displayed

- Obtained: the February 2026 table, 27 occupancy groups x 9 construction types (238 cells; 5 are "N.P." not permitted).
  iccsafe.org does not serve it: its page says "This is an ICC member-exclusive benefit" and ICC's article pages show
  "Only registered ICC members have access". So the values come from two city copies that agree cell for cell:
  City of Albuquerque MRA Appendix B (names the edition: "Source: International Code Council, Building Valuation Data,
  February 2026") and City of Hermiston ("effective 4/1/2026", no edition named). The copies disagree on the heading
  ("2024" vs "2021 International Building Code"); the numbers are the same.
- ICC's own statements of what is included come from the August 2020 article text (the 2026 article is members-only):
  "The average costs include foundation work, structural and nonstructural building components, electrical, plumbing,
  mechanical and interior finish material." and "The data is a national average and does not take into account any
  regional cost differences." and "This data table is not intended to be used as an estimating guide". Land, site work,
  utility connections, fees, financing and developer profit are not in that list. Footnote in the copies: "For shell
  only buildings deduct 20 percent".
- Terms: ICC Terms of Use: "no portion of the Services may be reprinted, republished, modified, publicly displayed ...
  without Our express written permission." The cities' copies are not ICC permission. All ICC rows are
  `display_allowed: false`: **internal use only: not displayed**. Use them to compute; show only the computed range with a
  source line, and ask ICC (or the owner's ICC membership) before showing the table.
- Gap: an August 2026 edition probably exists (ICC updates every six months); no copy found. Irvine's page "effective
  August 15, 2026" carries a table marked REV 06/24, so it was not used.
- What RSMeans would add: costs by city, by quality class and by building size and story count, unit-price detail,
  separate shell and fit-out, site work, and yearly updates with stated inclusions. ICC gives one national figure per
  code type and says it is for permit fees.

## b. Regional factors: DoD area cost factors (displayable)

- Obtained: UFS 3-701-01 (6 June 2026) Table 4-1 CONUS from the data-tables workbook (15,549 site rows; 5,016 places
  after merging sites in the same city) plus a state row (median, lowest, highest site) in `building_costs.json`. Survey
  year 2025; the 96-Base-City average is 1.00. Examples: Texas median 0.82, Florida 0.87, New York 1.03, California 1.20
  (sites range 1.09 to 1.97, with island sites at the top), Washington 1.10.
- Publisher's instruction: factors adjust "bare" unit costs "to location-specific costs for the most common locations".
  It also says "Do not use the MILCON ACFs to modify detailed quantity take-offs, unit price book (UPB) line items,
  commercial cost data, or user-generated unit costs." So using it to scale an ICC figure is outside the publisher's
  stated use; treat as a rough scaler and say so. The workbook also has military housing unit costs (barracks $534.44 per
  sq ft, Oct 2025) kept as two rows marked as not market housing.
- Terms: document marked "APPROVED FOR PUBLIC RELEASE; DISTRIBUTION UNLIMITED". Displayable.
- Not obtained: HUD or GSA city cost indices. HUD's high cost percentages (below) are a mortgage-limit multiplier, not a
  construction cost index. State and metro construction cost indices from FEMA or states were not found in this pass.
- Added by RSMeans: its own city cost indexes by trade and building type.

## c. Affordable-housing limits and costs

Obtained (displayable, federal):
- HUD basic statutory mortgage limits per unit, calendar 2026 (Federal Register 2026-08795, 6 May 2026): Sections
  207/220, 213, 234, 221(d)(4), 231 by bedroom and elevator or not (51 rows). Example: Section 234 elevator, 2 bedrooms $111,504.
- HUD high cost percentages by base city, 2026 (Mortgagee Letter 2026-05, 20 May 2026): 97 areas; 270 percent, or 405
  percent in Alaska, Hawaii, Guam, Virgin Islands; waiver to 315 percent in high cost areas.
- HOME maximum per-unit subsidy, 0 to 4+ bedrooms: $187,658, $215,122, $261,595, $338,419, $371,477. The notice
  (FR 2026-06926, 10 Apr 2026, "Notice for Comment", comments to 11 May 2026) heads the table "2025" and sets the limit at
  240 percent of the Section 234 elevator limit. A year label of 2025 is kept as printed. Whether HUD finalised it after the comment period was not checked.

Obtained (state, not marked displayable because terms were not fetched):
- Florida Housing: hard cost per unit factors by building type (garden, mid-rise, high-rise, rehab) and RFA cycle 2023/24
  to 2026/27, e.g. 2026/27 high-rise "Except BMP" $338,000. The template's column "BMP" is not defined in the cells read.
  The full Florida limit adds geographic multipliers and a soft-cost factor (not extracted).
- Pennsylvania Housing Finance Agency: general requirements 6 percent, builder's overhead 2 percent, profit 6 percent,
  contingency 5 percent (new) and 10 percent (rehab). Percentages, not dollars per unit.

Not obtained, with reason:
- Per-unit total development cost limits for the other 13 of the 15 most populous states (CA, TX, NY, IL, OH, GA, NC, MI,
  NJ, VA, WA, AZ, MA). California's CTCAC basis-limit memo URL from search returned 404; Illinois' underwriting guide URL
  returned 404; Georgia points to a Cost Limits Workbook not fetched; Virginia's Code says the authority sets limits each
  year but contains no table; the others were not found in one pass. "15 most populous" was taken from the 2020 Census
  order from memory and was not fetched, so treat the list as a working choice. No state "cost report per unit" (actual costs) was loaded. This is the largest
  remaining gap for pricing affordable units by state.
- State housing tax credits, trust funds, property-tax exemptions, density bonus laws (research prompt 6): not attempted.
- HUD TDC limits (PIH 2025-25) exist by tribal area only (NAHASDA); not general.

## d. HUD income limits (FY2026)

- Obtained: HUD API `/hudapi/public/il/data/<county FIPS>99999`, FY2026 (the API rejects 2027). Area median income and the
  30, 50 and 80 percent limits for household sizes 1 to 8, for 1,038 of 1,106 counties: the 1,104 in the manifest plus Los Angeles (06037) and Orange (06059), which the manifest does not list
  because the page loads them from `app/data/`. The first run (1,036 rows) missed those two, and they were in neither the rows nor the
  failed list; added 22 Nov 2026 (median income: Los Angeles $108,100, Orange $138,600). The 357 R2-only counties are all in the manifest. Raw responses were kept outside the repository; 5 are saved as test fixtures.
- Not provided by this API: a 60 percent limit (LIHTC) or 120 percent. None is computed. Statute says the LIHTC 60 percent
  limit is the "imputed income limitation"; HUD publishes it as the MTSP table, not through this API (not fetched).
- 68 New England counties (CT, ME, MA, NH, RI, VT) have no county row: HUD's entity ids there are towns or areas, and the
  county call returns an error. Left as "not on file" with the reason in `_source.failed`.
- Terms: HUD's terms page returned an empty body to this machine; the data is federal and is treated like the existing
  `hud_fair_market_rents.json`. `display_terms` not separately quoted.
- Rent at a limit: statute row: gross rent at most 30 percent of the imputed income limitation, so the monthly rent at
  the 50 percent, 4-person limit is `il50[3] x 0.30 / 12` (utility allowance comes off).

## e. LIHTC basics

Obtained (federal, displayable): from 26 U.S.C. 42 as fetched (Cornell LII copy, includes Pub. L. 119-21): credit = applicable
percentage x qualified basis; 9 percent floor (new, not federally subsidized) and 4 percent floor (after 31 Dec 2020); 70 and
30 percent present-value targets; 130 percent basis boost in a qualified census tract or difficult development area and
the definitions; set-asides (20-50, 40-60, average income with limits 20 to 80); gross rent at most 30 percent of the
limit; state ceiling formula ($1.75 per person or $2,000,000 before indexing); bond test 50 percent of basis, 25 percent for
issues after 31 Dec 2025. IRS: Rev. Proc. 2025-32 for 2026: greater of $3.416 per person or $3,953,600 (the fetched
copy shows $3.416; a search result said the first version had $3.05, so the corrected one is used). Rev. Rul. 2026-21 (November 2026) 8.24
percent and 3.53 percent; Rev. Rul. 2026-24 (December 2026) 8.20 and 3.51 percent. Because of the floors, the credit rate
actually used is 9 percent and 4 percent. The 2027 DDA and QCT designation notice (FR 2026-20390, 6 Oct 2026) is effective for
allocations after 31 Dec 2026; HUD's download page `https://www.huduser.gov/portal/datasets/qct.html` returned an empty
body here, so the file names were not read.
- Equity price: CohnReznick TCA Monitor, November 2026: median net equity price $0.827 for August-September 2026. It is a private
  firm's survey; marked not displayable until terms are checked. It does not give a separate 4 percent price in the text read.
  No agency-published price found.

## f. ADU and modular costs

- Los Angeles permits (city open data, dataset pi9x-tg5x): medians by issue year 2020 to 2026 for three groups (new ADU
  7,966 permits; conversion or addition 19,483; junior ADU 2,080 after filters). Example 2025 new-construction ADU: median
  $126.10 per sq ft (middle half $106.09 to $167.11), median $110,000, 800 sq ft (1,375 permits). These are declared permit
  valuations, which usually omit land, fees, utility hookups and some site work; they are not bids or final costs. The
  query is stored in each row's `source_url`. Terms: LA's portal says data are "provided for informational purposes" with
  no accuracy warranty; no display ban found.
  Selection caution: the "new ADU" group picks permits whose description names an ADU and may include a new house with an ADU
  (limited by the 150 to 1,200 sq ft filter).
- Other cities: Seattle's permit set has a project cost but no square footage; Austin's record seen had no valuation field.
  Not used. California HCD ADU cost data not found as a dataset.
- Modular vs conventional (Terner Center, UC Berkeley; marked not displayable until terms are checked): California conventional
  hard cost $177 per sq ft (2008-09) to $222 (2018, 2018 dollars; 240 projects), Bay Area above $380; a 2016 student report with
  interviews: conventional $250-$275 per sq ft vs modular module cost $80-$100 (module only), 9.29 vs 16.86 months (Modular
  Building Institute figures cited), 5830 Third Street 20 vs 13 months, Marea Alta 19 vs 16 months; Terner 2022: projects expect 10-30
  percent shorter schedules; cost "relative parity" for most respondents, 10-20 percent savings for others.
  HUD PD&R, NREL (blocked from this machine) and state agency studies with stated figures were not obtained.
- Gap: no public study gives a like-for-like modular vs conventional cost per sq ft for finished multifamily buildings. The
  only per-sq-ft modular figure is a module-only manufacturer interview figure from 2016.

## Biggest remaining gap

A sourced, displayable cost per square foot (or per unit) for a finished multifamily building by city. The ICC table is
national and internal-only, the DoD factor is not meant for commercial cost data, and state per-unit limits were obtained for
Florida only. Paid RSMeans (or a licence to show ICC) or the owner's Gemini/ChatGPT research answers for prompts 1 and 6, loaded
only after quotes are matched, would close it.

## What a pro forma needs from these tables (exact inputs)

Cost side, per course of action:
1. `hardCostPerSqft(state, occupancy, constructionType, method)` from `building_costs.json` rows with `measure = cost_per_sqft`:
   ICC row keyed by `icc_occupancy_group` (R-2 multifamily, R-3 ADU or house, R-1 hotel-type) and `icc_construction_type`
   (VB wood frame, IIIA, IA); internal use only. Alternatives: LA ADU medians by `issue_year` (ADU only).
2. `areaFactor(state or place)` from `area_cost_factors.json` (`locations[].area_cost_factor`) or the state row (`value`, `range`).
   Caveat text: the publisher's own limit on use.
3. `grossSqft = units x avg unit size / efficiency` (not in these tables; user or zoning input).
4. `modularAdjustment`: no sourced cost factor; only schedule (`measure = months`) and the Terner 10-30 percent schedule and
   0-20 percent cost ranges, shown as a range with the quote.
5. Exclusions the table says it omits: land, site work, fees, financing, soft costs. Soft-cost shares: Florida `state_hard_cost_per_unit`
   (hard factor only), Pennsylvania `state_cost_rules` (general requirements 6 percent, overhead 2, profit 6, contingency 5 or 10).
6. Cap check: `totalDevelopmentCostPerUnit` vs `hud_fha_statutory_limits` (by `program_section`, `building_type`, `bedrooms`) x
   `hud_high_cost_percentages` for the nearest listed city; and the HOME subsidy cap `home_per_unit_limits` by `bedrooms`.

Affordable units and public money:
7. `incomeLimit(fips, pctAmi, householdSize)` from `hud_income_limits.json` (`il30`, `il50`, `il80` index = size - 1;
   60 percent not available; New England withheld) and `maxRent = limit x 0.30 / 12` (statute row `max_rent_share`).
8. `setAsideTest` from `lihtc_set_aside` rows (20-50, 40-60, average income).
9. `creditAmount = applicablePercentage x qualifiedBasis x 10 years`, where applicablePercentage is `applicable_percentage_floor`
   (9 percent or 4 percent) because the monthly rates are below the floors; `qualifiedBasis = eligibleBasis x 1.30` if the site is
   in a 2027 DDA or QCT (`eligible_basis_multiplier`) x the share of units that are low-income.
10. `equityRaised = creditAmount x equity_price` (0.827 median, Aug-Sep 2026; 9 percent and 4 percent not separated; show a range, not a point).
11. Bond test for 4 percent: `lihtc_bonds` row (25 percent of basis for issues after 31 Dec 2025).
12. State ceiling check (does the state have credits to give): `state_ceiling_per_capita` and `state_ceiling_minimum`.
Withhold, not estimate: any state's per-unit cost cap not in the files; any 60 percent limit; DDA/QCT status of a given tract (needs HUD's list download).
