# Station-site project cards: what blocks them, and what was filled (22 Nov 2026)

The owner wants each station-area site's card to say what to build, what it costs, what public money applies and what
it earns. This record measures what the cards said for all 7,098 sites in `app/data/station_sites/` (42 county files),
fills what could be filled from primary sources reachable from this machine, and says what is still missing and what
would fill it. Everything below was fetched or computed on 22 Nov 2026.

## 1. Measurement before (`scripts/measure_site_cards.mjs`, `data/backtests/site_cards_measure_before.{json,md}`)

One card per site, built with the subject the page builds (`pcSubjects` in `app/invest.js`) and displayable rows only.
The "before" run uses the card engine as it was at the start of the job (`ENGINE=<copy of HEAD>`).

| Shows | Sites before |
|---|---|
| any cost range | 0 |
| a public-money rule that applies | 0 |
| an income range | 0 |
| none of the three | 7,098 |

Ranked blocking reasons (each counts all 7,098 sites in all 42 counties):

1. Five of the six courses (ADU, units under state law, small multifamily, station-area conventional, station-area
   prefabricated) are not assessed: **"the zoning code is not on file for this site"**. The page never passes a station
   site's zoning to the engine (the station-site audit chose this: a code alone gives no category).
2. Hold: cost "the purchase price is not on file" (the parcel's land value is a tax base, not a price).
3. Hold: income "space rental income not on file" (no sourced parking, storage or roof rate).
4. Hold: value (same reason as 2). Public money: no programme pays for holding.

So the QCT/DDA check, the rent ceilings and any building cost could not appear at all: they sit inside the building
courses, which the legal basis blocks.

**Zoning experiment (not shipped).** 1,949 of the sites have a zoning code on their parcel record. Passing that code
with no category: still 0 building courses assessed (multifamily needs a category or a state law). Passing it as if
every one were multifamily: small multifamily is assessed for 1,949 and station-area courses for 1,508, but **0 are
sized** ("the density limit for <zone> is not in the zoning standards on file"), so 0 get a cost. Querying the city
zoning services by point (`ZONING_SERVICES` in `app/app.js` covers 30 of the 42 counties) would add codes, not
categories or densities, so step 2c was not done: it would not change a single cost, rent or funding row.

## 2. What was added

Because the building courses stay blocked by zoning, the figures that hold for a site **whatever is built** are now
card-level "place rows" (`placeFacts`), shown on site and lot cards ahead of the courses, and also feed the courses
when a course is assessed.

### (a) HUD qualified census tracts and difficult development areas, 2026 and 2027

- Sources (downloaded with a browser user agent; HUD's page answers an empty 202 to a bare client):
  `https://www.huduser.gov/portal/datasets/qct/QCT2027CSV.zip`, `.../QCT2026CSV.zip` (lists of QCT tract GEOIDs),
  `https://www.huduser.gov/portal/datasets/qct/2027-DDAs-Data-Used-to-Designate.xlsx` and the 2026 workbook (sheet
  "<year> MDDA": every metropolitan ZCTA with the column "<year> SDDA (1=SDDA)"; sheet "<year> NMDDA": nonmetro
  counties). File hashes and fetch dates are in `app/data/hud_qct_dda.json` `_source`.
- Effective date, already a funding-rules row, re-shown: "The 2027 lists of QCTs and DDAs are effective: (1) for
  allocations of credit after December 31, 2026" (Federal Register 2026-20390).
- Site geography (`pipeline/site_places_build.py` -> `app/data/station_site_places/<fips>.json`): the 2020 tract of
  each site's interior point from Census TIGER/Line 2023 tract files
  (`https://www2.census.gov/geo/tiger/TIGER2023/TRACT/tl_2023_<state>_tract.zip`); the 2020 ZCTA from the Census
  1:500,000 ZCTA file (`https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip`). Because that
  outline is generalised, wherever ZCTAs with different DDA flags lie within 150 m of the point, the ZCTA was asked of
  Census TIGERweb's full-resolution 2020 ZCTA layer instead: 858 sites asked, 10 changed, 1 left undetermined.
  Tract found for 7,090 of 7,098 (8 points fall outside every tract polygon: water); ZCTA for 7,087.
- Table: `app/data/hud_qct_dda.json` (90 KB): for the 1,855 tracts holding a site, [on the 2026 list, on the 2027 list];
  for the 740 ZCTAs holding a site, [2026 flag, 2027 flag, HUD's own "LIHTC Maximum Rent" for the ZCTA, metro name].
- Statute, fetched from `https://www.law.cornell.edu/uscode/text/26/42` and matched by
  `scripts/costs/add_site_card_rules.py` (new rows in `housing_funding_rules.json`):
  - 42(d)(5)(B)(i)(I): "In the case of any building located in a qualified census tract or difficult development area
    which is designated for purposes of this subparagraph— (I) in the case of a new building, the eligible basis of
    such building shall be 130 percent of such basis"
  - 42(d)(5)(B)(v): "designated by the State housing credit agency as requiring the increase in credit under this
    subparagraph in order for such building to be financially feasible" (shown when a site is in neither list)
- Card: "A new tax-credit building here counts 130% of its eligible basis" (or "No 130% basis by location; the state
  housing credit agency may still designate the building"), each year's QCT and DDA answer with its HUD file, the
  statute quote and the effective-date quote; cautions when the point is under 30 m from a tract edge (251 sites),
  when the ZCTA came from TIGERweb, and when the site lies in another county (below). The LIHTC entry of an
  affordable course now carries the same location rule instead of "HUD's list download was not read".

### (b) Construction cost per new home (Census Building Permits Survey)

- Source: `https://www2.census.gov/econ/bps/County/co2023a.txt`, `co2024a.txt`, `co2025a.txt`, columns "5+units rep"
  (Reported Data: buildings, units, value). Census definitions page
  (`https://www.census.gov/construction/bps/definitions.html`): "Valuation - The valuation is the estimated value of the
  residential structure as shown on the building permit. If no value is listed on the permit, we accept estimates from
  the permit official." and "Data labeled as "Reported Data" include the data reported from the respondent or from the
  Census Bureau's Survey of Construction (SOC) but exclude imputed data."
- 174 rows added to `app/data/building_costs.json` in its schema (`measure: cost_per_unit`, `county_fips`, `homes`,
  `quote` = the county's line verbatim, `verification` with the file's sha256, `display_allowed: true`, federal
  statistical release) by `scripts/costs/add_bps_permit_values.py` for the 58 counties that hold a site's point, 3 years
  each. Value per home = reported 5+ unit valuation / reported 5+ unit homes.
- Card: "Declared construction value per new home, buildings with 5 or more units": lowest to highest year, measured,
  with each year's homes and file; caution "the value of the structure as written on the permit: no land, fees,
  financing, site work or developer costs". Example, Travis County: 2023 $88,195 (18,311 homes), 2024 $114,890
  (12,145), 2025 $131,985 (9,780). A multifamily course whose homes are sized now gets `homes x` that range, tagged
  modelled, "structure only"; where homes are not sized it says "cost not computed: ... not sized".
- Not added (step 2b candidates): state housing finance agency cost limits or cost reports were not attempted in this
  job (the funding-rules build of 22 Nov recorded the CTCAC and Illinois URLs it tried as 404); HUD's per-unit FHA
  limits are mortgage limits, not costs, and need each county's base city (not mapped); Census "Characteristics of New
  Housing" multifamily tables carry no cost. No ICC or `data/internal/` row was used.

### (c) Zoning: not done (section 1 says why).

### (d) What a new unit could charge: tax-credit rent ceilings and Fair Market Rents

- HUD MTSP income limits (the limits HUD publishes for tax-credit projects), FY2026, from HUD's API
  `https://www.huduser.gov/hudapi/public/mtspil/data/<county>99999` (`scripts/costs/fetch_hud_mtsp_limits.py` ->
  `app/data/hud_mtsp_income_limits.json`: 57 counties, 1 failed: Suffolk County MA, HUD 404, New England limits are
  by town).
- Formula, all from the statute: ceiling = 0.30 x the income limit for the unit's imputed household / 12; imputed
  household from 42(g)(2)(C): "(i) In the case of a unit which does not have a separate bedroom, 1 individual. (ii) In
  the case of a unit which has 1 or more separate bedrooms, 1.5 individuals for each separate bedroom." So a studio
  uses the 1-person limit and a 2-bedroom the 3-person limit; a 1-bedroom (1.5 persons) needs HUD's interpolation and
  is not computed. HUD's own column heading "LIHTC Maximum Rent (1/12 of 30% of 120% of VLIL)" is stored as a rule row.
- Card: "Tax-credit rent ceilings (gross rent, studio to 2-bedroom)" at 60% and at 50%, tagged modelled, with the
  limits used and the formula; "limits, not market rents: the ceiling is gross rent, so the tenant's utility allowance
  comes off it". HUD FMRs (FY2027, already on file) are shown beside them, studio to 3-bedroom, "payment standards
  ... not market rents". Travis: 60% $1,412 to $1,815; 50% $1,176 to $1,513; FMR $1,447 to $2,292.

### Wiring

`src/engines/projectCardEngine.js`: `placeFactsFor` (rows `qct_dda`, `cost`, `rent_limits`, `fmr`; each with unit,
basis, source URL, year and place, or `why`), courses read them (multifamily cost, affordable 60% income, LIHTC
location rule); `cardsForAdvisor` adds a short `place` object. `src/engines/stationSites.js`: `loadPlaces(fips)`
attaches each site's tract and ZCTA. `app/invest.js`: loads the two new tables, passes `place`, renders "This place,
whatever is built". Tests: `tests/unit/siteCards.test.ts` (17, including every withheld path).

## 3. After (`data/backtests/site_cards_measure_after.{json,md}`)

| Shows | Before | After |
|---|---|---|
| a cost figure (per-home construction value for the site's county) | 0 | 7,098 |
| a building course with a total cost | 0 | 0 (no course is sized; zoning) |
| a public-money rule that applies: the 130% basis, site in a 2027 QCT or DDA | 0 | 4,639 |
| the location rule known either way | 0 | 7,079 |
| an income range (tax-credit rent ceilings or FMRs) | 0 | 7,095 |
| none of these | 7,098 | 0 |

Still unfilled, by reason: QCT/DDA not determined for 19 sites (8 no tract, 7 no ZCTA, 4 ZCTA not on HUD's metro
sheet); rent ceilings and FMR for 3 sites (Suffolk County MA, HUD sets limits by town); every building course on all
7,098 sites (zoning code not on file); Hold cost, income and value on all 7,098 (purchase price, space rents). By
county: `site_cards_measure_after.md`.

## 4. Checks

- **Re-derived by hand, seed 20261122, 10 sites in 8 counties** (04013, 06073, 17031, 27123, 36047, 37183, 41051,
  48113; `scripts/recheck_site_cards.py` -> `data/backtests/site_cards_rederive_2026-11-22.json`): tract asked again
  of the Census Geocoder, ZCTA of TIGERweb, QCT and DDA read from HUD's files, permit values divided from the Census
  lines, rent ceilings from HUD's raw MTSP responses, FMRs asked again of HUD's API. **130 figures, 0 differ.**
- **Live, real page** (`scripts/live_check_site_cards.mjs`, LIVE_PORT=9241, `data/backtests/live_check_site_cards_2026-11-22.json`,
  screenshots `data/backtests/site_cards_{los_angeles,travis,cook}{,_place}.png`): Los Angeles (opening county),
  Travis and Cook. Each shows the place rows on its station-site cards (Los Angeles 4, Travis 6, Cook 6 of the 6 site
  cards listed; the first two opened and read);
  0 "NaN", "undefined" or "null" in the section; 0 page errors; every dollar figure in the opened place rows (19 per
  card) is one of the card's own sourced figures.
- `npm test` (48 files, 1,708 tests) and `npm run typecheck` pass.

## 5. Found while doing this

- **544 sites lie in a different county from the county file that lists them** (e.g. 170 of Kings County's 406 sites
  are in Queens, 31 in Manhattan, 17 on Staten Island; 61 of Dallas County's in Collin). Their station is in range
  across the line. The card now uses the county the site's point lies in for every place row, and says so. The site
  files themselves are unchanged (station-site lane).
- `hud_income_limits.json` says "The API has no 60% (LIHTC / MTSP) limit". True of the `il` endpoint; HUD's `mtspil`
  endpoint has it. The engine's "not on file: HUD's API gives 30, 50 and 80 percent only" now names the MTSP file.
- `cardsForAdvisor` could return a few characters over its cap: `truncated` was added after the last size check
  (seen: 6,006 for a 6,000 cap). Fixed; tested at 800, 2,500 and 6,000.
- For sites near existing stations the card uses the distance from the site's interior point, while the inventory
  counted them by the distance from the outline's edge (within 0.5 mile): 467 of the 5,613 sites whose nearest anchor
  is an existing station are more than 0.5 mile away by their interior point, so a station-area course would call
  them out of range. Sites near the stations of local projects and stop cities pass no station distance at all ("no
  rail station distance is on file"), though their record names the station. Not changed: station-area courses are
  blocked by zoning first; the owner may want the edge distance passed.

## 6. What would fill the rest

1. **Zoning category and density for each site** (all 5 building courses, 7,098 sites): a code-to-category and
   code-to-density table per city (the `zoning_standards.json` pattern, from each city's code text) and, for the 5,149
   sites with no zoning code on the parcel record, a point query of the city's zoning service. Free; research prompt 12.
2. **Purchase price** (Hold cost and value): recorded sales for the parcel. County recorders; paid aggregators' prices
   were not fetched.
3. **Space rental rates** (Hold income): research prompt 9.
4. **1-bedroom rent ceiling**: HUD's MTSP methodology for 1.5-person limits (HUD User), not fetched.
5. **Suffolk County MA**: HUD's town-level MTSP and FMR entities for Boston (HUD API by town id), not fetched.
6. **Total development cost per home by state**: state housing finance agency cost limits or LIHTC cost reports.
