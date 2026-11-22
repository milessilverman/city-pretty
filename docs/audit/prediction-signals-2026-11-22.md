# Prediction signals: dated, free, national data for the walk-forward model (22 Nov 2026)

Built for `docs/PLAN-WEEK-2026-11-22.md` section 2. This page lists what was fetched, from where, what is in each table, what was
checked, and what is missing. **No model was fitted.** Tables are in `data/signals/`; fetchers in `scripts/signals/`; loaders in
`scripts/signals/loaders.py`; tests in `tests/signals/test_signals.py` (`python3 -m unittest tests.signals.test_signals`).
Every number below was read from the files in this session (22 Nov 2026). Licence/terms text is quoted only where it was fetched.

## 0. Read this first (for the modelling agent)

**Sample.** The "50 counties" are the back-test's own list (`app/data/neighborhood_score_backtest.json` -> `sample.county_list`; the 50 largest
counties by block groups, Connecticut excluded). Where a source is national and small it is national; otherwise 50 counties.

**Tract codes come in two vintages. This is the main join trap.**
- FHFA tract HPI, LODES8, and the 2022-and-later HMDA files use **2020 tract codes**.
- ACS 2010-14 and 2015-19 (the back-test's features) and HMDA 2012-2021 use **2010 tract codes**.
  Checked on the files (`data/signals/vintage_checks.json`): of the HMDA tracts in the 50 counties, 99.96% (2018-21) and 100% (2012-16)
  are in the 2010 tract list and only 86% are in the 2020 list; for 2022-25, 100% are in the 2020 list and only 77% in the 2010 list.
  FHFA tracts: 98.7-98.8% are in the 2020 list in every year checked.
- Nationally there are 74,002 tracts (2010 list) and 85,378 (2020 list) in the Census relationship file; 62,489 codes exist in both and
  60,405 of those keep at least 95% of their land on both sides. In the 50 counties, 15,799 of 18,936 2010 tracts (83.4%) are
  essentially unchanged; the rest were split or merged. The back-test kept only the unchanged ones (same code, land within 5%);
  that drops the fastest-growing tracts. The tables here keep everything as published so the modeller can choose.
- `xwalk_tract10_tract20.csv.gz` gives land-area weights (the Census file has no population). Use `w10to20` to split a **count**
  (loader `count_to_tract20`) and `w20from10` to average a **rate or level** (`level_to_tract20`). Weights by land area are crude for
  tracts that split into a populated part and an empty part; say so if a result depends on it.
- ZIP to tract: `xwalk_zcta20_tract20.csv.gz` (ZCTA, by land area). A ZCTA is not a ZIP code (it is the Census area for the ZIP's main
  delivery area); Zillow and FHFA ZIP5 codes are matched to ZCTAs by equal code, and ZIPs with no ZCTA (PO boxes, single buildings) do not join.
  HUD's address-based ZIP-tract crosswalk (better weights: residential address ratios) answers through `www.huduser.gov/hudapi/public/usps`
  with the injected auth (one test call for ZIP 11001 returned `res_ratio` rows, quarter 2026Q2). It needs one call per ZIP (the API showed
  `X-Ratelimit-Limit: 60`), so it was **not** pulled; it is a candidate for the next step if area weights prove too crude.

**What leaks future information if used naively.**
1. **Every FHFA index is re-estimated on each release, so any year's value in today's file already uses later data** (the county and
   ZIP5 sheets say "Last updated: March 31, 2026"; the quoted note: "revisions to these indexes may reflect the impact of new data or
   technical adjustments"). A walk-forward test that fits on the 2026 file's 2012 value is not what anyone knew in 2012. No dated
   vintages were found on the FHFA page. Treat FHFA-based features and outcomes as "as revised in 2026" and say so in results.
2. **Zillow ZHVI/ZORI** are one current download (16 Nov 2026) with all history re-estimated. The `sm_sa` variant is smoothed and seasonally
   adjusted; the table here uses the raw `month` ZHVI (not smoothed or adjusted) and the only ZORI file (smoothed, `sm`).
3. **Publication lag.** A value for year *t* was not public at the end of *t*. Evidence from file dates (`Last-Modified` headers,
   22 Nov 2026): LODES 2022 data posted 3 Oct 2024, 2023 on 3 Dec 2025, 2024 on 14 Oct 2026 (about 21-23 months after year end);
   BPS monthly Dec 2025 file posted 20 Feb 2026 and Sep 2026 on 27 Oct 2026 (4-7 weeks); BPS annual 2024 posted 1 May 2025 and 2025 on
   14 May 2026; IRS migration `2324` posted 19 Nov 2026 but `1112` and `2223` show re-upload dates of 7 Nov 2025 and 19 Mar 2026, so
   those dates are not first-release dates. ACS 5-year files are released in December of the year after the period ends (the back-test's
   convention: features usable from E+1). HMDA public data for a year is published after the year; the exact dates were not fetched.
   Lag every annual series by at least one year (LODES by two) when building features "as of" a date.
4. **LODES8 history was rewritten**: the 2010-2019 files all carry `Last-Modified` 31 Mar 2023 (and `createdate` 20230321 in the rows), i.e. the
   whole series was re-run on 2020 blocks. It is not what was published in 2013.
5. **BPS**: the monthly "current month" files and the annual files differ (Cook County 2019 monthly files sum to 9,502 units, the annual file says 9,556),
   because the annual file includes late reports. Use monthly files for "what was known by month *m*" only if you also lag them; the annual
   total is the revised figure.
6. **Outcome thinning.** The FHFA tract file has index values for 59,412 tracts in 2015 and 62,400 in 2020, but only 56,227 in 2022 and about
   46,400-46,900 in 2023-2025. Missing late-year tracts are not random (thin sales), and the 2020-25 back-test outcome rests on that subset.

**Terms.** Quoted per source below. Where no licence text could be fetched this is stated. Zillow: "terms not confirmed: use for internal
testing only, do not display." The Zillow tables are therefore **git-ignored** (`data/signals/.gitignore`) and must be rebuilt with
`python3 scripts/signals/fetch_zillow.py` (about 1 minute); a copy sits in the scratch folder of this session.

## Table inventory (all gzip CSV; repository total about 80 MB; each file under 20 MB)

| File | Grain / coverage | Rows | Bytes |
|---|---|---|---|
| `fhfa_tract_annual.csv.gz` | tract (2020 codes) x year 1975-2025, national | 2,069,265 | 16.9 MB |
| `fhfa_zip5_annual.csv.gz` | ZIP5 x year 1975-2025, national (19,024 ZIPs) | 670,165 | 5.2 MB |
| `fhfa_county_annual.csv.gz` | county x year 1975-2025 (2,795 counties) | 105,195 | 0.8 MB |
| `hmda_tract_year_50counties.csv.gz` | tract x year 2018-2025, 50 counties | 156,919 | 3.5 MB |
| `hmda_legacy_tract_year_50counties.csv.gz` | tract x year 2012-2017, 50 counties | 110,513 | 2.2 MB |
| `hmda_legacy_tract_year_national.csv.gz` | tract x year 2012-2017, national | 433,645 | 8.5 MB |
| `bps_county_annual.csv.gz` | county x year 2010-2025, national | 48,524 | 0.6 MB |
| `bps_county_monthly.csv.gz` | county x month 2010-01..2026-09, national | 284,309 | 2.6 MB |
| `bps_place_annual.csv.gz` | place x year 2010-2025, national | 320,987 | 5.7 MB |
| `bps_place_monthly_50counties.csv.gz` | place x month, places in the 50 counties | 275,938 | 4.7 MB |
| `lodes_wac_tract_{01_29,30_47,48_72}.csv.gz` | tract (2020 codes) x year 2010-2024, national, split by state FIPS | 1,246,961 | 22.7 MB in 3 files |
| `lodes_wac_bg_50counties.csv.gz` | block group x year, 50 counties | 887,222 | 7.8 MB |
| `zillow_*` (git-ignored) | ZIP x month (50-county ZIPs) and ZIP x December (national) | see section 5 | 9.6 MB |
| `irs_migration_county.csv.gz` | county x year pair 2011-12..2023-24, national | 40,845 | 1.1 MB |
| `acs_tract_50counties.csv.gz` | tract (2010 codes) x 2 vintages, 50 counties | 37,872 | 1.4 MB |
| `xwalk_tract10_tract20.csv.gz` | 2010 tract to 2020 tract, land-area weights | 122,706 | 1.5 MB |
| `xwalk_zcta20_tract20.csv.gz` | ZCTA to 2020 tract, land-area weights | 168,048 | 2.3 MB |

Not in the repository: HMDA 2018-2025 for all states (not built; see section 2), Zillow national monthly (36.6 MB; rebuilt by `fetch_zillow.py`).

---

## 1. FHFA House Price Index (a)  `scripts/signals/fetch_fhfa.py`

- **URLs** (reachable): `https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv` (89.9 MB; header `tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000`);
  `.../hpi_at_zip5.xlsx` (39.8 MB, sheet `ZIP5`); `.../hpi_at_county.xlsx` (5.3 MB, sheet `county`). The names `hpi_at_bdl_zip5.xlsx` and
  `hpi_at_bdl_county.xlsx` return 404. Page: `https://www.fhfa.gov/data/hpi/datasets` lists them as "Census Tracts (Developmental Index; Not Seasonally Adjusted)" [CSV],
  "Five-Digit ZIP Codes (Developmental Index; Not Seasonally Adjusted)" [XLSX], "Counties (Developmental Index; Not Seasonally Adjusted)" [XLSX].
- **Years/grain:** 1975-2025 annual; tract (2020 codes, 63,930 tracts), ZIP5 (19,024), county (2,795). Columns kept: id, year, `annual_change` (%), `hpi`
  (index on the area's own base of 100 in its first year; compare ratios across years, not levels across areas). Blank/"." stays blank.
- **Reuse:** the tract CSV was read from the back-test's cache (the 18 Nov download); ZIP5 and county were fetched today.
- **Terms:** no licence text on the page or files. Quoted from both xlsx notes: "These annual county indexes should be considered developmental. As with the
  standard FHFA HPIs, revisions to these indexes may reflect the impact of new data or technical adjustments." and "In cases where sample sizes are small for the
  county area, an index is either not reported if recording has not started or a missing value is reported with a period (".")." Licence: not confirmed.
- **Checks (unit tests):** county 01001 1987: -2.14 / 97.86; ZIP 01001 1985: 15.82 / 115.82; tract 01001020100 1999: -4.86 / 95.14 (raw rows read).
- **Gaps:** thinning after 2021 (section 0, item 6). Annual only; no quarterly tract/ZIP series. County file is also "developmental".

## 2. HMDA, loan-level public data (b)  `fetch_hmda.py`, `fetch_hmda_legacy.py`

**2018 onward (current format).**
- **URL pattern** (reachable): `https://ffiec.cfpb.gov/v2/data-browser-api/view/csv?counties=<FIPS>&years=<YYYY>&loan_purposes=1` (and `states=<USPS>`); the reply is a
  301 to a `files.ffiec.cfpb.gov/data-browser/datasets/<year>/filtered-queries/...csv`. HEAD requests get HTTP 405, use GET. Years 2018-2025 returned data; asking for 2017
  returns the text "must provide years in the range of 2018-2023", yet 2024 and 2025 were served. `files.ffiec.gov` (bulk snapshot) returned 502 from the proxy and the S3 bulk
  snapshot URL returned 403, so the filtered API is the route.
- **Reduction (one CSV at a time, deleted after):** home-purchase (`loan_purposes=1`), `total_units` 1-4 only. Per tract-year: `apps` (action 1-5), `orig` (1),
  `denied` (3), `withdrawn` (4), `incomplete` (5), `approved_not_accepted` (2), `denial_rate = denied/(orig+approved_not_accepted+denied)`,
  originations by occupancy (`orig_owner_occ` 1, `orig_second_home` 2, `orig_investor` 3), `orig_conventional`, median loan amount, median income ($000, numeric only,
  `n_income` = rows behind it), median property value, median LTV. Purchased loans (6) and pre-approvals (7, 8) are not counted.
- **Obtained:** 50 counties x 2018-2025 = 156,919 tract-year rows. The published loan amounts are rounded values (e.g. 445,000; 1,005,000).
  National by state: not done (see "National HMDA 2018+" below).
- **Terms:** no licence text found. CFPB's historic-data page says: "The data are modified to protect applicant and borrower privacy." The documentation site
  (`ffiec.cfpb.gov/documentation/`) is script-rendered and gave no readable text.
- **Checks (test):** New York County 2022 tract 36061001501 from the raw CSV: actions 1:65, 2:1, 3:8, 4:14, 5:9 (apps 97), originations by occupancy 59 owner / 6 second home, median loan 705,000, median income 267: all match the table.
- **Tract codes:** 2010 codes for 2018-2021, 2020 codes for 2022-2025 (measured; section 0). A tract's 2021 and 2022 counts are not comparable without a crosswalk step.
- **Gaps:** no cell suppression by the publisher, but tracts with a handful of applications are noisy (keep `apps` and `n_income` as weights). Multifamily (5+ units)
  excluded. Applicant income is in the lender's reported units rounded to $000; "NA"/"Exempt" excluded. Refinance and home-improvement loans are not in the table
  (fetch with `loan_purposes=31` etc. if wanted).

**2012-2017 (older format).**
- **URL pattern** (reachable): `https://files.consumerfinance.gov/hmda-historic-loan-data/hmda_<YYYY>_nationwide_all-records_codes.zip` (182-435 MB each, streamed through
  `curl | funzip`, never stored). The page `https://www.consumerfinance.gov/data-research/hmda/historic-data/` links `..._first-lien-owner-occupied-1-4-family-records_labels.zip`;
  those are narrower (first-lien owner-occupied only, no investor share) and the 2012 link on the page returns 404, so the `all-records_codes` files (which exist for 2012) were used.
  `funzip` printed "invalid compressed data--length error" at the end of each file; every file had been read in full (2012: 18,691,551 rows; 2013: 17,016,159; 2014: 12,049,341;
  2015: 14,374,184; 2017: 14,285,496).
- **Reduction:** `property_type == 1`, `loan_purpose == 1`; same columns except `orig_nonowner` (occupancy code 2 = not owner-occupied; investor and second home cannot be separated) and no
  property value or LTV. National table kept (8.5 MB), plus the 50-county subset.
- **Tract codes:** 2010 tract codes for 2012-2017 (100% of 2012-2016 tracts in the 50 counties are in the 2010 list).
- **Not tested against raw rows in a unit test** (the raw files are 0.2-0.4 GB); row totals above are the check that the stream was read to the end.
- **Gap:** 2012-2017 and 2018+ differ in definitions (occupancy split, no value/LTV, the older files are keyed on lender-reported action codes with the same numbering). Splice with care.

**National HMDA 2018+: not done.** `fetch_hmda.py --scope states` (51 states x 8 years = 408 downloads) was started and stopped after 21 pieces (about 12 minutes for Alabama, Alaska and part of Arizona; large states are much slower, estimate several hours). Finished pieces are cached as small JSON in the scratch folder `hmda_pieces/states_*`, and the command resumes. The output would go to the scratch folder unless under 20 MB.

## 3. Building Permits Survey (c)  `fetch_bps.py`

- **URLs** (reachable, plain text): county annual `https://www2.census.gov/econ/bps/County/co<YYYY>a.txt` (2010-2025); county monthly `.../County/co<YYMM>c.txt` ("c" = that month only; 2010-01 to 2026-09;
  `co2610c.txt` is 404); place annual `.../Place/<Midwest|Northeast|South|West>%20Region/<mw|ne|so|we><YYYY>a.txt`; place monthly `<xx><YYMM>c.txt`. The `y` files are year-to-date and not used. Documentation folder: `.../econ/bps/Documentation/`.
- **Grain/years:** county annual 3,026 counties (2010) to 3,034 (2020); county monthly 730-3,032 counties per month (mean 1,413): **counties with no row in a month are absent, which may mean
  zero permits or not reporting; the file does not say** - use the annual file or `months_rep` for place. Place annual: 320,987 rows over 16 years (64 of 64 region-year files found). Place monthly: kept only for places in the 50 counties
  (804 of 804 region-month files found; one earlier run lost 6 files to transient errors, so the fetcher retries).
- **Columns:** units authorised in 1-unit, 2-unit, 3-4-unit, 5+-unit buildings (`u*`, includes the Bureau's imputation for non-reporters) and from actual reports only (`r*`); `value_total` is the sum of the four value fields (dollars).
  Place rows also carry `bps_id`, `fips_place`, `name`, `months_rep` (months reporting in the annual file).
- **Terms:** no licence text found for the bulk files. The Census API terms page says: "You may not modify or falsely represent content accessed through the API and still claim the source is the Census Bureau." (applies to the API; the bulk files carry no stated terms).
- **Checks (tests):** county 2020 Baldwin (01003) 1-unit 3,395, 2-unit 14, 5+ 205, value 817,322,441 + 2,220,389 + 35,095,317; Autauga 332; Nov 2025 Baldwin 282 / 0 / 4 / 44 (raw rows read).
- **Gaps:** place codes: use `state + bps_id` as the key (some places have `fips_place` 00000); places that cross counties appear once under the county in the file. Monthly vs annual differ (section 0, item 5). Permits are not completions.

## 4. LEHD LODES8 workplace area characteristics (d)  `fetch_lodes.py`

- **URL** (reachable): `https://lehd.ces.census.gov/data/lodes/LODES8/<st>/wac/<st>_wac_S000_JT00_<YYYY>.csv.gz` (one row per 2020 block; "all jobs", "all segments"). Streamed, nothing stored.
- **Obtained:** 754 of 765 state-years for 2010-2024; **not found: Alaska 2017-2024 and Michigan 2022-2024** (listed in `lodes_coverage.json`). Tract counts per year: 82,226 (2010), 83,765-83,935 (2011-2021), 80,813 (2022-2024; Michigan missing).
  A tract with no jobs has no row (zero, not missing), except for the missing state-years.
- **Tables:** national tract x year (2020 tract codes for every year) with total jobs, earnings bands (CE01 <= $1,250/month, CE02 $1,251-$3,333, CE03 > $3,333) and six broad sectors made from the 20 sector counts (goods = CNS01-05; trade and transport = 06-08;
  professional and finance = 09-14; education and health = 15-16; leisure and other = 17-19; public = 20). Block-group totals (jobs and earnings bands) for the 50 counties, 887,222 rows. Workplace location only (where jobs are, not where workers live).
- **Terms:** no licence text found. The LEHD data page gives a citation form: `U.S. Census Bureau, "{File Name}," ... https://lehd.ces.census.gov/data/ ..., accessed on {Date}.`
- **Checks (test):** tx 2019 tract 48001950100: 54 blocks sum to 803 jobs, earnings bands 147/284/372, goods 160 (from the raw file with awk); block-group totals roll up to the tract table.
- **Gaps:** block-level counts are protected by the Bureau before release (the technical document was not fetched this session, so the method is not quoted here; read it before leaning on small tracts). Year 2010-2021 files were re-created in 2023 (section 0).

## 5. Zillow ZHVI and ZORI by ZIP (e)  `fetch_zillow.py`

- **URLs** (reachable, `Last-Modified` 16 Nov 2026): ZHVI `https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_month.csv` (152 MB, raw) and
  `..._sm_sa_month.csv` (125 MB, smoothed and seasonally adjusted; not used); ZORI `https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv` (10 MB). `Zip_zori_uc_sfrcondomfr_month.csv` and `Zip_zori_uc_sfr_sm_month.csv` are 404.
- **Years/grain:** ZHVI month-ends 1996-02 to 2026-10 for 29,820 ZIPs; ZORI 2015-01 to 2026-10 for 8,355 ZIPs. Tables: monthly for the 3,045 (ZHVI) and 2,397 (ZORI) ZIPs with at least 50% of their ZCTA land in the 50 counties; national December values by year plus the latest month. National monthly in the scratch folder.
  Zillow's file has no county code (only `CountyName`, `Metro`).
- **Terms: not confirmed.** `zillow.com/research/data/`, `zillow.com/z/corp/terms/` and `zillowgroup.com/terms-of-use` all answered HTTP 403 ("Access to this page has been denied", a bot block) from this machine, also through the page-fetch tool. **Use for internal testing only, do not display.**
- **Checks (test):** ZIP 60601: Dec 2019 ZHVI 469,848.54, Oct 2026 409,725.91; ZORI 2,290.13 and 2,961.34 (raw rows read; the test skips if the git-ignored table is absent).
- **Gaps:** no value for ZIP-months Zillow does not publish (blank); ZORI covers fewer ZIPs and starts 2015; revisions leak (section 0, item 2).

## 6. HUD aggregated USPS vacancy data (f): **skipped, needs a registered account**

- `https://www.huduser.gov/portal/datasets/usps.html` loads (with a browser user-agent) but the data are behind a login. Page text: "Under the current agreement with the USPS, HUD can make the data accessible only to governmental entities and non-profit organizations registered as users. Use of the data is permitted only for activities related to the \" stated purpose \" outlined in the sublicense agreement." and "To access the restricted data, please login here." (links: `.../apps/public/usps/ncwm-login`, `.../apps/public/usps/register`).
- The HUD API (`https://www.huduser.gov/hudapi/public/usps?type=1&query=11001`) works with no key from here but serves the **crosswalk** (ZIP-tract residential/business/other address ratios), not vacancy counts. Nothing was downloaded for vacancy; a for-profit site is not eligible under the text above.
- Modelling consequence: the plan's "address vacancy by tract" signal is not available. ACS vacancy (`vacant/occ_total`) is the free substitute (table `acs_tract_50counties`).

## 7. IRS SOI county-to-county migration (g)  `fetch_irs_migration.py`

- **URLs** (reachable): `https://www.irs.gov/pub/irs-soi/countyinflow<YYYY>.csv` and `countyoutflow<YYYY>.csv` for `1112` ... `2324` (13 pairs); landing pages `https://www.irs.gov/statistics/soi-tax-stats-migration-data-<Y1>-<Y2>`; user guide `https://www.irs.gov/pub/irs-soi/2122inpublicmigdoc.pdf`.
  Columns `y2_statefips,y2_countyfips,y1_statefips,y1_countyfips,y1_state,y1_countyname,n1,n2,agi` (returns, exemptions, AGI in $ thousands).
- **Table:** one row per county and year pair (label `year_end` = second calendar year, e.g. 2022 for `2122`): non-migrant returns, inflow and outflow returns/exemptions/AGI for "US total" (row 97,0), different-state and foreign flows. Pair-by-pair county flows are not kept (add if the model needs origin-destination detail).
  Quote (user guide): "Migration data are based on the population of Forms 1040 that were filed and processed by the IRS during calendar years 2021 and 2022" (for pair 2122), and "For the County-to-County migration flows a cell must have at least 20 returns to be shown ... counties with less than 20 returns have been aggregated into various 'Other Flows' categories".
- **Terms:** no licence text found on the pages fetched (`irs-website-policies` page had no reuse statement in its text). US government tax statistics; licence: not confirmed.
- **Checks (tests):** Cook County (17031) pair 2122: inflow 79,866 returns, 114,360 exemptions, AGI 7,327,293; non-migrants 2,014,547; different state 52,157; foreign 161; Autauga 2,076 / 4,489 / 130,188 (raw rows read).
- **Gaps:** about 3,143 counties per pair; 2011-2012 to 2023-2024 only (older files exist back to 1990-91 but were not pulled); county FIPS changes over time (e.g. Alaska and Connecticut) are not mapped; the 2023-24 Connecticut codes were not examined.

## 8. ACS 5-year tract tables (h)  `fetch_acs.py` (reuses the back-test cache)

- Same files and cells as `scripts/backtest_neighborhood_score.mjs` (ACS 2015-2019 `acsdt5y2019-<table>.dat`; ACS 2010-2014 sequence files with the 2014 lookup file). 18 cells (population, workers, transit commuters, median household income, units, occupancy, vacant, tenure, structure type, median year built, vehicles, median rent, median home value) for 18,936 tracts in the 50 counties, both vintages, **2010 tract codes**.
- Census annotation codes (negative numbers) become blanks. Checks (test): tract 04013010101: income 99,489 and home value 548,800 (2015-19, read from the raw `.dat`), 102,458 and 476,700 (2010-14, as read by the back-test).
- **Terms:** Census terms as in section 3 (none stated for bulk files). **Gap:** earlier vintages (2005-09, 2000 Census) are not included; only the two the back-test used.

## 9. Census tract relationship files (i)  `fetch_crosswalks.py`

- **URLs** (reachable): `https://www2.census.gov/geo/docs/maps-data/data/rel2020/t10t20/TAB2010_TAB2020_ST<ss>.zip` (52 state/territory files; block-to-block, `AREALAND_INT` = land area of the intersection) and
  `https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tract20_natl.txt` (24 MB). (`.../rel2020/tab20_tract20_tract10_natl.txt` is 404; the `t10t20` folder is the real one.)
- **Tables:** 122,706 tract pairs with `land_int`, `w10to20` (share of the 2010 tract's land in this 2020 tract) and `w20from10`; 168,048 ZCTA-tract pairs with the equivalent shares. Open-water-only blocks (no 2020 tract) are dropped.
- **Checks (tests):** 2010 tract 11001000100: 1,657,442 of 1,868,369 land units in 2020 tract 11001000102 (0.8871); ZCTA 20001 / tract 11001004702: 326,418 of 5,302,364.
- **Gaps:** weights are land area, not people or homes (flagged in section 0). Puerto Rico (72) included, no territories beyond that.

---

## What was not done / decisions for the owner

- HUD vacancy: needs a registered government or non-profit account; the owner's organisation would have to apply. Free substitute: ACS vacancy.
- Zillow terms could not be fetched; the tables are git-ignored until someone with a browser reads `zillow.com/research/data/`.
- The planned-stations signal (corridor table, FTA profiles) is not part of this job.
- No model, no scoring, no back-test was run on these tables.

## Rebuild commands

```
python3 scripts/signals/fetch_crosswalks.py      # run first (Zillow subset uses it)
python3 scripts/signals/fetch_fhfa.py
python3 scripts/signals/fetch_hmda.py            # 50 counties, 2018-2025, resumable; --scope states for national (long)
python3 scripts/signals/fetch_hmda_legacy.py     # 2012-2017
python3 scripts/signals/fetch_bps.py
python3 scripts/signals/fetch_lodes.py
python3 scripts/signals/fetch_zillow.py
python3 scripts/signals/fetch_irs_migration.py
python3 scripts/signals/fetch_acs.py
python3 scripts/signals/check_vintages.py
python3 -m unittest tests.signals.test_signals -v
```
Raw downloads go to `SIGNALS_SCRATCH` (default: the session scratch folder) and are deleted after reduction; the back-test cache is read from `BACKTEST_CACHE`.
