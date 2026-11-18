# Decision engine

`src/engines/investmentDecisionEngine.ts` (source) and `src/engines/investmentDecisionEngine.js` (the browser twin)
turn a county bundle into ranked decisions: which neighborhoods to look at, what to build there, what to add to one
house, and whether transit should be built and how big. The functions are pure: no network, no file reads. Every
table is passed in. A missing input gives `null` plus a `missing: [...]` list, never a default number. Every number is
`{ value, unit, source, basis }`, where basis is `measured` (read from a cited table), `modelled` (computed from
measured inputs) or `assumed` (no evidence).

The neighborhood weights come from `app/data/neighborhood_score_backtest.json`, built by
`scripts/backtest_neighborhood_score.mjs` from public price and Census data. The main finding is that **no combination
of the fields in the bundles beat the plain "cheapest tracts in the county" baseline**. So the score is a
relative-value screen, not a forecast, and the engine says so in every output.

## Back-test

**Question.** Within a county, did tracts that ranked higher on a signal at the start of a 5-year window gain more in
price than the county's median tract over that window?

**Data.**
- Outcome: FHFA annual census-tract House Price Index (developmental repeat-sales index,
  https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv). The file uses 2020 tract codes: 63,015 of the 63,743
  codes in its 2019 rows match the 2020 Gazetteer, and 46,532 match 2010.
- Features: ACS 5-year estimates from the Census Bureau's bulk files on www2.census.gov. ACS 2010-2014 comes from the
  sequence files and ACS 2015-2019 from the table-based prototype files. api.census.gov now answers "Missing Key".
- Join: the tract code exists in both the 2010 and 2020 tract lists and its land area changed by less than 5%.
- Sample: the 50 largest counties in `counties/manifest.json` (Connecticut excluded). That gives 10,124 tracts in
  49 counties for 2015-20 and 7,762 tracts in 47 counties for 2020-25. Counties need at least 20 tracts.

**Timing.** ACS estimates ending in year E are released at the end of E+1, so they predict from E+1:
- P1 uses ACS 2010-14 to predict 2015→2020, with momentum measured 2010→2015.
- P2 uses ACS 2015-19 to predict 2020→2025, with momentum measured 2015→2020.

The two outcome windows do not overlap, and only P2 contains the 2020-22 boom.

**Measures.**
- Spearman rank correlation within each county, then averaged across counties.
- Top-fifth minus bottom-fifth gap: the average relative 5-year price change of the top 20% of tracts by the signal,
  minus that of the bottom 20%.
- 90% intervals from 2,000 bootstrap draws over counties.

A signal counts as "supported" only if it has the same sign in both periods and its interval excludes zero in both.

### Each signal on its own

| Signal | bundle field | 2015-20 Spearman (90% CI) | 2015-20 top-bottom fifth | 2020-25 Spearman (90% CI) | 2020-25 top-bottom fifth | supported |
|---|---|---|---|---|---|---|
| Prior 5-year price change (FHFA tract HPI) | - | -0.128 (-0.220 to -0.032) | -3.9% (-6.3 to -1.2) | +0.060 (+0.007 to +0.110) | +0.9% (-0.4 to +2.1) | no |
| Median home value (log) | hv | -0.713 (-0.744 to -0.678) | -19.2% (-21.2 to -17.3) | -0.183 (-0.239 to -0.124) | -4.2% (-5.7 to -2.8) | yes |
| Annual median rent / median home value | rent/hv | +0.542 (+0.504 to +0.579) | +17.7% (+15.2 to +20.5) | +0.182 (+0.137 to +0.227) | +4.6% (+3.3 to +5.9) | yes |
| Median household income (log) | inc | -0.589 (-0.620 to -0.555) | -16.5% (-18.4 to -14.7) | -0.099 (-0.149 to -0.046) | -1.9% (-3.2 to -0.6) | yes |
| Median home value / median household income | hv/inc | -0.273 (-0.324 to -0.223) | -7.8% (-9.4 to -6.1) | -0.164 (-0.215 to -0.117) | -4.2% (-5.5 to -2.9) | yes |
| Share of households renting | own | +0.305 (+0.267 to +0.345) | +9.8% (+8.4 to +11.3) | -0.006 (-0.048 to +0.035) | -0.5% (-1.7 to +0.6) | no |
| Median year structure built | yb | -0.259 (-0.310 to -0.209) | -7.0% (-8.6 to -5.3) | +0.048 (-0.010 to +0.104) | +1.4% (+0.0 to +2.9) | no |
| Share of homes in 1-unit buildings | sf | -0.128 (-0.168 to -0.083) | -3.0% (-4.2 to -1.7) | +0.050 (+0.017 to +0.084) | +1.3% (+0.3 to +2.3) | no |
| Share of households with no vehicle | nocar | +0.354 (+0.325 to +0.384) | +11.4% (+10.0 to +13.1) | -0.011 (-0.055 to +0.030) | -0.4% (-1.6 to +0.7) | no |
| Housing units per square mile of land (log) | homes/acres | +0.277 (+0.229 to +0.323) | +7.7% (+6.2 to +9.1) | -0.102 (-0.156 to -0.048) | -2.5% (-4.0 to -0.9) | no |
| Vacant share of housing units | - | +0.163 (+0.115 to +0.212) | +5.6% (+3.6 to +7.9) | -0.038 (-0.072 to -0.003) | -0.8% (-1.7 to +0.2) | no |
| Share of workers commuting by public transport | - | +0.245 (+0.200 to +0.288) | +7.7% (+5.8 to +9.8) | -0.075 (-0.128 to -0.025) | -1.7% (-3.2 to -0.4) | no |

What the table shows:
- **Cheap places gained more in both windows.** Low value, high rent for the price, low income and low value for the
  income all pointed the same way in both periods. The effect was about four times weaker in 2020-25.
- **Momentum did not carry forward.** Tracts that had risen most fell back relative to their county in 2015-20. In
  2020-25 the relation was barely positive.
- **Urban signals flipped sign.** Density, transit commuting, renting and no-car households pointed up in 2015-20 and
  down in 2020-25, which is the pandemic move away from dense cores. None of them is used.

### Combined models, tested out of sample

Each cell gives the mean Spearman (90% interval), the top-fifth minus bottom-fifth gap, and the share of counties
where the correlation was above zero.

| Model | fit 2015-20, test 2020-25 | fit 2020-25, test 2015-20 | fit half A 2015-20, test half B 2020-25 | fit half B 2015-20, test half A 2020-25 |
|---|---|---|---|---|
| all bundle fields | +0.176 (+0.117 to +0.235); +4.1%; 76% | +0.474 (+0.426 to +0.517); +15.7%; 98% | +0.141 (+0.069 to +0.214); +3.8%; 76% | +0.214 (+0.121 to +0.299); +4.7%; 75% |
| all bundle fields + momentum | +0.176 (+0.114 to +0.234); +3.9%; 76% | +0.555 (+0.517 to +0.590); +17.4%; 100% | +0.135 (+0.057 to +0.206); +3.6%; 76% | +0.219 (+0.132 to +0.302); +4.5%; 75% |
| momentum only (baseline) | -0.060 (-0.110 to -0.009); -0.9%; 36% | -0.128 (-0.223 to -0.034); -3.9%; 33% | +0.057 (-0.019 to +0.124); +1.1%; 59% | -0.062 (-0.136 to +0.013); -0.8%; 32% |
| cheapest tracts only (baseline) | +0.183 (+0.123 to +0.239); +4.4%; 70% | +0.713 (+0.679 to +0.746); +23.8%; 100% | +0.148 (+0.066 to +0.232); +3.9%; 68% | +0.213 (+0.134 to +0.291); +4.9%; 72% |

**Verdict: screen.**
- The combined model beats momentum in every test.
- It never clearly beats "cheapest tracts only".
- Its 2020-25 strength is modest. The top fifth of the score gained +2.9% relative to its county over 5 years and the
  bottom fifth lost 1.4%. The same fifths moved +9.7% and -8.4% in 2015-20.
- **Per county.** The score ranked tracts the right way round in:
  - 2015-20: 98% of counties;
  - 2020-25: 70% of counties.
- **Where it failed in 2020-25.** Maricopa, San Diego, Dallas, Tarrant, Bexar, Travis, Alameda, Contra Costa,
  San Francisco, Hennepin, Salt Lake, Oklahoma, Palm Beach and Suffolk (MA). These are mostly Sun Belt and West Coast
  metros, where higher-priced suburbs gained more.
- **Effect on grades.** The engine grades every block group in a county that failed as D.

### Weights the engine uses

The model was fitted on both periods pooled, on within-county percentile ranks. Units are log points of 5-year
relative change across the full percentile span. There are no assumed weights. A signal without support gets weight 0
and is not used.

| Signal | Bundle field | Weight | Fitted on 2015-20 only | Fitted on 2020-25 only |
|---|---|---|---|---|
| Home value (log) | hv | -0.089 | -0.167 | -0.008 |
| Rent / value | rent/hv | +0.029 | +0.021 | +0.017 |
| Income (log) | inc | -0.063 | -0.093 | -0.020 |
| Value / income | hv/inc | -0.028 | -0.020 | -0.039 |

Renting, year built, single-family share, no-car share and density all get weight 0 because their sign flipped
between periods.

Rerun: `node scripts/backtest_neighborhood_score.mjs --cache <scratch dir>`. It downloads about 700 MB on the first
run, and the bootstrap is seeded so results repeat.

## API

The browser twin is one IIFE that publishes `window.InvestmentDecisionEngine`. To load it:
- add `<script src="src/engines/investmentDecisionEngine.js"></script>` after `app/app.js`, or
- paste it into app.js like the other engines.

It uses app.js's global `evaluateByRightHousing` when that exists. In Node, `require()` it. In TS, import the
named exports from `src/engines/investmentDecisionEngine`.

```
rankNeighborhoods(countyBundle, { backtest, limit?, minHomes? })
  -> { role: "screen"|"predictor", county, method, countyEvidence, ranked: [ { rank, id, name, city, score, scoreQuintile,
       historicalRelativeChange: { "2020_2025", "2015_2020" }, components: [...], confidence: { grade A-D, reasons },
       dataFlags, reasons: [plain sentences], missing } ], rankedCount, unscored: [ { id, missing } ], missing }

recommendForNeighborhood({ id, m, r }, { catalog, countyFips?, underusedSites?, sites? })
  -> { ideas: [ { id, name, kind, project, cost, valueAdded, valuePerDollar, priceLiftPct,
       evidence: { tier: "measured locally"|"borrowed study"|"assumed", grade, sources } } ],
       byReturn: [ids], housingPlays: [adu, lot_split, small_multifamily, underused_site_conversion], places, caveats, missing }

recommendForParcel(parcelFacts, { unitCosts?, valueCoefficients?, sizes?, neighborhood?, overCapRatio?, zoningEngine? })
  -> { zoning, expansions: [ { expansion: adu|added_bedroom|added_bathroom|second_storey|lot_split, legal, cost: {low, high},
       valueAdded, netValue, overCapitalisation, missing } ], caveats, missing }

evaluateTransit(corridorOrArea, { costBenchmarks?, valueEffects? })
  -> { verdict: build|do_not_build|screen_only|not_enough_data, scale: bus_frequency|brt|light_rail|heavy_rail|null,
       proposedMode, proposedModeSupported, alsoSupported, density, ftaLandUse, costEffectiveness, capitalCost,
       costByMode, warrant, hsr, valueEffects, reasons, sources, missing }

buildDecisionBrief(countyBundle, { blockGroupId?, parcel?, corridor?, top? }, ctx)
  -> { schema: "city-pretty/decision-brief@1", county, role, howToRead, backtest, topNeighborhoods, neighborhood,
       parcel, transit, caveats, sources, missing }
```

**Context the caller supplies.**
- `ctx.backtest`: the parsed `app/data/neighborhood_score_backtest.json`.
- `ctx.catalog`: `D.catalog` from the LA bundle, which holds the idea grades and sources. County bundles do not carry it.
- `ctx.sites`: a decoded `sites_<fips>.json.gz`.
- `ctx.underusedSites`: `app/data/underused_sites.json`.

**Transit tables.** These are injected, never read by the engine:
- `costBenchmarks` rows: `{ mode, cost_per_mile, year, source_url }`;
- `valueEffects` rows: `{ mode, distance_band, effect_pct, source_url }`.

Mode names are normalised, so "LRT" and "light rail" both read as light_rail.

**House tables.**
- `unitCosts` rows: `{ item, state|county_fips, low, high, unit: "USD/sqft"|"USD/each", source_url }`;
- `valueCoefficients` rows: `{ item, state|county_fips, value_per_sqft|pct_of_value|value_each, source_url }`.

Items are `adu`, `added_bedroom`, `added_bathroom`, `second_storey` and `lot_split`.

## Transit rules (cited, fetched 2026-11-18)

**Density and frequency.** TCRP Report 165 (TCQSM 3rd ed.) Exhibit 3-8, after Pushkarev and Zupan, gives the minimum
residential density for each service:

| Service | Homes per net acre | Downtown floor area |
|---|---|---|
| Local bus, 1 bus/h | 4.5 | — |
| Local bus, 2 bus/h | 7 | — |
| Local bus, 6 bus/h | 15 | — |
| Light rail, 5-min peak | 9 | 35-50 million sq ft (20 million if fully at grade) |
| Rapid transit, 5-min peak | 12 | over 50 million sq ft |
| Commuter rail, 20 trains/day | 1-2 | over 100 million sq ft |

The manual says gross acres are about 1.5 times net acres. Bundle densities are gross, so they are multiplied by 1.5.
The 6-bus-an-hour row is read as BRT-capable, because FTA's BRT rule requires 10-minute peak headways. That reading is
the engine's mapping, not FTA's.

**FTA CIG Final Policy Guidance, November 2025.** The engine uses:
- station-area population-density and employment breakpoints;
- 2025 cost-per-trip breakpoints: High under $8; Medium-High $8-9.99; Medium $10-19.99; Medium-Low $20-34.99;
  Low over $35;
- the warrant table (capital cost band against existing corridor riders);
- the New Starts threshold of $400 million.

The policy guidance was fetched through web.archive.org, because transit.dot.gov answers 403.

**FRA high-speed-rail market.** About 100 to 500 miles, as quoted in CRS R42584.

**How the verdict is reached.**
1. Density sets the largest urban scale it supports.
2. A proposed mode larger than that scale gets "do not build".
3. Cost per trip rated Medium-Low or Low also gets "do not build".
4. A proposal within the supported scale is "build" if its cost per trip rates Medium or better.
5. Without cost per trip the result is "screen_only".
6. Rail is "not enough data" until downtown floor area is given.

## What it cannot know

- **Absolute appreciation.** The score is relative to the county, so a county-wide boom or bust is not predicted.
- **Whether the past repeats.** The cheap-gains-more pattern weakened about fourfold between the two windows, and it
  reversed in about 30% of counties in 2020-25.
- **Block-group precision.** Relations were tested on tracts and applied to block groups. Many block-group values are
  noisy ACS medians, and some are tract medians.
- **Fast-growing new areas.** Tracts that were split in 2020 (the fastest growing) and thinly traded tracts are missing
  from the back-test.
- **Risk.** Neither window contains a broad price decline, so the back-test says nothing about how cheap tracts
  behave in a bust.
- **Returns on improvements.** Idea costs and value gains in the bundles are pipeline estimates, and most effect sizes
  are borrowed from studies elsewhere.
- **What an expansion costs or adds.** The repo has no sourced construction cost per sq ft and no sourced hedonic
  coefficient for an added bedroom, bathroom, storey or ADU, so those come back null.
- **Local zoning.** The engine knows only what `statutoryZoningEngine` knows about state laws. Local height, FAR and
  setback limits are not loaded, so bedroom, bathroom and storey legality is "not determined".
- **Ridership.** Transit verdicts are rules of thumb unless the caller supplies FTA-style annualised cost and trip
  forecasts.

## Data that would most improve it (most valuable first)

1. **Recorded sales with prices and dates (county recorders or a vendor).** This would allow a block-group or parcel
   back-test, a hedonic value per added sq ft, bedroom and ADU, and a real neighborhood ceiling (for example the top
   decile of recent sales) for the over-capitalisation check.
2. **Construction cost per sq ft by metro for ADUs, additions and small multifamily.** Sources would be RSMeans or
   published city permit valuations.
3. **Building permits by block group and year (Census BPS, Shovels or city portals).** These are a forward-looking
   supply signal that the back-test could add.
4. **Parcel zoning codes with local rule tables (height, FAR, minimum lot size).** These would turn "not determined"
   into an answer for lot splits, second storeys and small multifamily.
5. **A third, earlier window (for example 2005-2010, through the crash).** This would measure downside risk and test
   whether the cheap-tract pattern survives a bust.
6. **Jobs by block (LEHD LODES) and downtown floor area.** These would complete the FTA employment rating and the
   rail tests.
7. **CBSA-level relative outcomes.** These would replace county-relative ones for multi-county metros.
