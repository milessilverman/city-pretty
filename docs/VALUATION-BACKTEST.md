# Home-value back-test against recorded sales

Run on 2026-11-18 by `scripts/run_valuation_backtests.mjs`, written to `app/data/valuation_backtest_benchmarks.json`.

This replaces the 15 Nov 2026 "back-test", which scored the model on five or six hand-typed sales per county
(Los Angeles, King, Cook, Harris, Hillsborough). Those sales were not downloaded from anywhere, so every number
built on them has been deleted. Los Angeles, Harris and Hillsborough are no longer in the file because they have
not been tested on real data. If a county has no entry in the file, it has **not been back-tested**.

## Short answer

Across six counties in four states (17,000+ evaluation sales), the shipped engine's typical error (MdAPE) runs from
9.8% (King County, WA) to 21.3% (Philadelphia). **In five of the six counties it does worse than a naive baseline:
the assessor's own pre-sale value times one county-wide sale/assessment ratio.** Philadelphia is the exception, and
there the two are effectively tied (21.3% vs 21.4%). Most of the gap comes from a level bias: the engine comes in
low everywhere (median signed error -2.5% to -9.6%), because its fixed state multipliers do not match what homes
actually sold for. When the same engine is given county calibration fitted on a separate half of the sales (see
"Engine changes"), it only ties the baseline (within ±0.6 points, better in some counties and worse in others).
Even then the prior-sale and hedonic parts add almost nothing on top of the assessor value.

## Results (evaluation half only)

| County | n (eval) | Engine MdAPE | within 5% / 10% / 20% | median bias | Assessor x county ratio MdAPE (within 10%) | Prior sale x FHFA HPI MdAPE (n) | Engine on the same prior-sale subset | Engine with county calibration | Status |
|---|---|---|---|---|---|---|---|---|---|
| Cook County, IL (17031) | 4000 | 17.2% | 15.0% / 30.4% / 56.6% | -9.6% | 14.8% (36.3%), ratio 13.0769 | 19.1% (2620) | 17.1% | 15.2% | withhold |
| Kings County, NY (36047) | 1478 | 17.5% | 15.5% / 31.1% / 55.1% | -4.9% | 16.7% (32.9%), ratio 1.0474 | 26.9% (412) | 19.5% | 17.1% | withhold |
| Queens County, NY (36081) | 3842 | 14.4% | 19.3% / 36.3% / 64.4% | -4.5% | 13.4% (39.7%), ratio 1.0691 | 27.7% (1085) | 18.6% | 13.3% | withhold |
| Richmond County, NY (36085) | 1945 | 11.4% | 23.5% / 44.8% / 72.5% | -2.5% | 11.0% (46.2%), ratio 1.0921 | 16.1% (587) | 11.1% | 11.0% | acceptable |
| Philadelphia County, PA (42101) | 3957 | 21.3% | 13.7% / 27.4% / 48.2% | -8.5% | 21.4% (25.1%), ratio 1.2188 | 28.2% (2880) | 19.2% | 20.8% | withhold |
| King County, WA (53033) | 3409 | 9.8% | 27.6% / 51.1% / 78.1% | -4.2% | 9.5% (52.1%), ratio 1.1306 | 12.4% (2793) | 8.9% | 9.5% | acceptable |

MdAPE = median absolute percentage error. Bias = median of (estimate - price) / price, so a negative number means
the estimates come in under the sale price. "Status" applies the thresholds in `valuationBacktestEngine` to the
engine as shipped: reliable means MdAPE ≤ 8% with ≥ 80% of sales within 20%. Acceptable means MdAPE ≤ 14% with
≥ 65% within 20%. Anything worse is withhold.

By price band (engine MdAPE / median bias, n):

- **Cook**: < $250k 28.1% / -0.5% (883); $250k-500k 15.5% / -11.3% (1929); $500k-1M 15.1% / -9.1% (880); $1M-2M 15.9% / -12.7% (235); > $2M 31.9% / -25.8% (73)
- **Kings**: < $250k 646.7% (31); $250k-500k 65.7% (94); $500k-1M 12.1% / +0.4% (721); $1M-2M 16.3% / -10.2% (390); > $2M 31.2% / -30.1% (242)
- **Queens**: < $250k 334.8% (76); $250k-500k 52.1% (320); $500k-1M 12.1% / -4.2% (2462); $1M-2M 14.5% / -13.0% (906); > $2M 27.5% / -27.5% (78)
- **Richmond**: < $250k 481.8% (28); $250k-500k 24.6% (215); $500k-1M 9.8% / -3.5% (1493); $1M-2M 17.8% / -13.5% (188); > $2M 33.8% / -33.8% (21)
- **Philadelphia**: < $250k 27.6% / -1.7% (1962); $250k-500k 18.0% / -13.8% (1500); $500k-1M 12.6% / -6.4% (409); $1M-2M 17.4% / -14.6% (68); > $2M 10.1% (18)
- **King**: $250k-500k 10.5% / +0.8% (88); $500k-1M 7.9% / -0.3% (1504); $1M-2M 10.6% / -6.6% (1313); > $2M 14.2% / -13.1% (504)

By the path the engine took:

- **Cook**: prior sale + assessor + hedonic 16.9% (2576); assessor + hedonic 17.6% (1423)
- **King**: 8.9% (2789) vs 14.1% (620)
- **Philadelphia**: 18.7% (2695) vs 25.4% (1255)
- **Queens**: 18.8% (1075) vs 13.4% (2767). In New York City the prior-sale path makes the estimate worse.

Patterns:
- The engine is low on expensive homes in every county except Philadelphia (-13% to -34% median bias above $2M; Philadelphia has only 18 such sales).
- The very low NYC "one-family" sales (under $250k, and some under $500k) are almost certainly not market sales.
  NYC publishes no deed-type or arm's-length flag, so they cannot be filtered out, and they hurt every model equally.

## Method

1. **Data**: everything is downloaded from the county or city's own open-data service at run time and cached. No
   sale, value or code meaning is typed in. Per county:
   - **Cook**: Assessor open data on datacatalog.cookcountyil.gov: Parcel Sales `wvhk-k5uv`, Assessed Values
     `uzyt-m557`, Single and Multi-Family Improvement Characteristics `x54s-btds`, Parcel Universe `pabr-t5kh`.
   - **King**: Department of Assessments extracts from aqua.kingcounty.gov: Real Property Sales, Value History,
     Residential Building, Parcel and Lookup. Parcel shapes come from the gismaps.kingcounty.gov KingCo_Parcels layer.
   - **Philadelphia**: phl.carto.com SQL API tables `rtt_summary` (real estate transfers), `assessments` (OPA value
     history) and `opa_properties_public`.
   - **NYC**: data.cityofnewyork.us Annualized Calendar Sales `w2pb-icbu` (2025) and Rolling Calendar Sales
     `usep-8jbt` (2026), Property Valuation and Assessment Data `8y4t-faws`, and PLUTO `64uk-42ks` for lot coordinates.
   - **Price index**: FHFA all-transactions HPI by metro division, `hpi_at_metro.csv`. Each county's division code
     (Cook 16984, King 42644, Philadelphia 37964, NYC boroughs 35614) was checked against the Census 2023 CBSA
     delineation file (`list1_2023.xlsx`).
   - **Neighborhood figures** for the engine's hedonic part: the county bundle's block-group record (ACS 2020-24),
     found by point-in-polygon. This is the same record the page passes to the engine.
2. **Sale window**: sale dates from 2025-01-01 to 2026-09-30. Philadelphia's transfer table currently ends at
   2026-08-10.
3. **Arm's-length single-family filters**: each filter is listed in the benchmarks file with how many sales it
   dropped.
   - **Cook**: the Assessor's own flags (deed type, under $10k, resale within 365 days, multi-sale); Warranty or
     Trustee deeds only; classes 202-210, 234, 278 and 295 (classes whose characteristic records are ≥ 99%
     "Single-Family"); one building card.
   - **King**: PrincipalUse RESIDENTIAL, PropertyClass Res-Improved, Warranty or Statutory Warranty Deed, SaleReason
     "None", **no SaleWarning code at all**, one parcel per excise affidavit, PresentUse Single Family, one dwelling.
     The code meanings are read from the county's lookup table, and the script refuses to run if they change.
   - **Philadelphia**: document type exactly DEED (no sheriff, land-bank or miscellaneous deeds), one property per
     deed, at least $10k, OPA category SINGLE FAMILY, one deed for that account that day, and a name screen. The name
     screen drops government, sheriff, lender, trustee or estate parties, plus grantor and grantee with the same
     first name token, which is a heuristic for family transfers.
   - **NYC**: building class category "01 ONE FAMILY DWELLINGS", 1 residential and 0 commercial units, at least $10k,
     and not a multi-lot sale (no other lot on the block sold the same day for the same price).
   - **All counties**: a deterministic sample of at most 8,000 sales (the lowest FNV-1a hash of parcel and document)
     before the per-parcel downloads, and a $25k floor.
4. **Leakage guard** (`selectPreSaleAssessment`): the engine only sees an assessor value that existed before the
   sale.
   - **Cook, Philadelphia and NYC**: the roll labelled with a year strictly before the sale's calendar year. These
     sources publish no change dates, so the roll for the sale's own year is never used. Cook uses the "mailed"
     first-pass value, which comes before any appeal that could cite the purchase price.
   - **King**: a value with tax year ≤ the sale year **and** a published ChangeDate strictly before the sale date.
   - Characteristics come from the same pre-sale roll year where the source keeps history (Cook, NYC). In
     Philadelphia and King they are the current record (see Limits).
   - The prior sale (`selectPriorSale`) is the latest recorded sale of the same parcel strictly before the tested
     sale, from a different document, at least $10k.
5. **Out-of-sample**: sales are split by parcel (`parcelSplit`, FNV-1a hash), so a parcel's sales never sit in both
   halves. The baseline ratio and every engine calibration are fitted on the calibration half. **Every number above
   is measured on the evaluation half.**
6. **Baselines**:
   - A: pre-sale assessor value × the median sale/assessor-value ratio of the calibration half.
   - B: prior sale × the change in the FHFA metro-division index, from the prior sale's quarter to the latest
     quarter that ended at least 90 days before the sale. The 90-day publication lag is an assumption, not FHFA's
     published schedule.

## Engine changes and their measured effect

- **Illinois assessor path threshold** (`propertyValuationEngine.ts/.js`). The path only fired above an assessed
  value of 10,000, which is about $100k of market value at Cook's level of assessment. Every cheaper Cook home fell
  through to the hedonic or prior-sale paths, which had a 40-48% MdAPE against 16-17% for the assessor path. The
  threshold is now 2,500 (about $25k). Cook moved from 17.3% to 17.2% overall, and almost no Cook sales are left
  outside the assessor path.
- **Optional `calibration` input** (`assessorRatio`, `hedonicScale`, blend `weights`) and an optional
  `salesInfo.hpiRatio` from a published index. With no calibration passed, the engine is unchanged (except for the
  IL fix above). The fitted calibration for each county is stored in the benchmarks file under
  `engine_calibrated.calibration`:
  - `assessorRatio`: the median sale / assessor-value ratio.
  - `hedonicScale`: the median sale / hedonic estimate ratio.
  - `weights`: proportional to 1/MdAPE² of each calibrated component on the calibration half.

  Effect on the evaluation half:

  | County | Shipped | Calibrated | Assessor-ratio baseline |
  |---|---|---|---|
  | Cook | 17.2% | 15.2% | 14.8% |
  | King | 9.8% | 9.5% | 9.5% |
  | Philadelphia | 21.3% | 20.8% | 21.4% |
  | Queens | 14.4% | 13.3% | 13.4% |
  | Richmond | 11.4% | 11.0% | 11.0% |
  | Kings | 17.5% | 17.1% | 16.7% |

  Calibration removes the level bias (median bias within ±1.5%), but the result is no better than the baseline.
- **Constants not changed**: the shipped state multipliers (for example Cook's "×10" when the measured ratio is
  13.08) and the national HPI table were left alone. The table is typed and unverified, and `hpiRatio` bypasses it.
  The ratio is measured in one county, while the IL path covers the whole state.
- **`valuationBacktestEngine`**:
  - The back-test no longer fills missing inputs with made-up values. It used to assume a 6,000 sq ft lot, a $750k
    neighborhood, 3 bedrooms, 2 bathrooms and a 1980 build year.
  - The minimum sample for a status went from 5 to 100. At n = 5 the 95% interval for a median spans the whole
    sample.
  - `supportedConfidenceMarginPct` is now the measured MdAPE, where before it was a clamped hand-picked number.
  - A county with no entry in the file reports `backtested: false` and `supportedMargin: null`, where before it
    reported a default 8%.
  - The status thresholds are unchanged.

## Limits

- **Characteristics may postdate the sale**: in Philadelphia and King, living area, bedrooms and year built are the
  current record. A renovation after the sale leaks into the hedonic part, which favours the engine slightly.
- **No arm's-length flag in NYC**: related-party transfers over $10k remain, and they dominate the bands under $500k.
- **Philadelphia's party screen is a heuristic**: its transfer data has no validity code.
- **Prior sales are incomplete in NYC**: they only go back to 2016, so the prior-sale coverage there is 28-30%.
- **Sample cap**: Cook, King and Philadelphia use 8,000-sale deterministic samples, not every sale.
- **Inputs differ from the live page**: the live page passes whatever the parcel layer returns. The back-test maps
  the assessor files into the field names the engine reads (`Roll_*`, `AppraisedValue`, `MarketValue`,
  `MARKET_VALUE`). The page's own layer may expose different names; Philadelphia's layer, for example, has
  `market_value`, which the engine does not read. So these numbers measure what the engine can do with the right
  inputs. They are not a test of every page view.
- **The page runs its own copy of the engine**: `app/app.js` carries an inline copy and does not import
  `src/engines/propertyValuationEngine.js`. It passes no `calibration`, and calls `valuationCheck` without
  `enforceCountyBacktest`. Until that changes, the benchmarks' `withhold` flags do not reach the page.

## Counties tried and not included

- **Allegheny County, PA (WPRDC)**: real-estate sales with validity codes are available. The assessment file is a
  current snapshot with no value history, so a value changed after a sale (for example on appeal) cannot be ruled
  out. The appeals dataset (2015-2027) could support a guard later.
- **Washington, DC**: the CAMA residential file exists, but no assessment history was found. Not pursued.
- **Los Angeles, Harris, Hillsborough, Franklin OH, Maricopa, Miami-Dade, Travis, Denver, Mecklenburg, Wake**:
  not attempted in this round. Only some download hosts were checked to see whether they respond. Their typed
  entries were removed.

## How to add a county

1. Write an adapter in `scripts/run_valuation_backtests.mjs` that returns `{ meta, sales }`.
   - `meta` needs: `fips`, `name`, `state`, the FHFA `msad` (check it against the Census delineation file),
     `source_url`, `source_dataset`, `roll_rule` and `roll_rule_text`, `filters` (an `applySaleFilters` report),
     `pre_kept`, and optional `post_filters`.
   - Each sale needs: `parcelId`, `docId`, `saleDate`, `salePrice`, `rolls[]` (`{year,total,land,bldg,changeDate?}`),
     `chars{}`, `lon`, `lat` and `history[]`.
   - Use only the source's own validity fields and code tables. Do not type code meanings in.
2. Pick the strictest leakage rule the source supports. Use `requireChangeDateBefore` if it publishes change dates,
   otherwise `maxYearOffset: 1`.
3. Map the roll into the attribute name the engine's state path reads (`engineAttributes`).
4. Add the adapter to `ADAPTERS` and run
   `BACKTEST_CACHE=<dir> BACKTEST_COUNTIES=<fips> node scripts/run_valuation_backtests.mjs`. A partial run merges into
   the existing file. A county with fewer than 500 evaluation sales is not written.
5. Run `npx vitest run tests/unit/valuationBacktestReal.test.ts`.
