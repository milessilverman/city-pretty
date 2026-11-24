# Stage 0 data inventory (read-only audit, 2026-11-24)

## Datasets: coverage and wiring
| dataset (path) | holds | geography + coverage | vintage | wired into | status | action |
|---|---|---|---|---|---|---|
| counties/bundle_*.json.gz (747) + manifest.json | block-group metrics, OSM layers, plans | 747 counties, 51 state FIPS (49 states, DC, PR; no HI) | built 2026-11-08 (DC) | app/app.js:10196 via county_hosts | implemented | keep |
| counties/sites_*.json.gz (637) | per-county underused-site lists | 637 counties | unknown | engine ctx.sites (investmentDecisionEngine.js:324) | partial | keep |
| app/data/bundle-la.b64.txt, details-la, overlays-la, sites-la | LA County bundle (inline) | LA County only; 38,616 street names | meta built 2026-11-04 | app/app.js:7-8 | implemented | keep |
| app/data/bundle-oc.b64.txt | Orange County bundle | OC only | unknown | app/app.js:10571 | implemented | keep |
| app/data/county_hosts.json | R2 vs local file host map | 4 regions; R2 enabled | checked 2026-11-19 | app/app.js:10196 | implemented | keep |
| app/data/parcel_services.json | ArcGIS parcel endpoint registry | 118 services, 51 states, 102 counties | unknown | workers/parcels.ts:3 | implemented (live-API only) | keep |
| app/data/parcel_use_codes.json | publisher use-code tables | 6 code systems | unknown | app/app.js:4296 | partial | keep |
| app/data/zoning_standards.json | parsed zoning standards | 5 jurisdictions (NYC, DC, San Diego, Portland, Charlotte); 8 withheld | 2026-11-17 | app/app.js:3264 | partial | keep |
| app/data/underused_sites.json | scored underused parcels | 90 records, all 06037 | audited 2026-11-16 | app/app.js:9309; app/invest.js:89 | partial (margin not reproducible) | modify |
| app/data/funding_programs.json | funding program records | 11 records; 2 tagged 06037, 9 no fips | unknown | app/app.js:9628 | partial | keep |
| app/data/unit_costs.json | awarded unit prices | 33 rows, 15 items (16 sidewalk); mixed states | retrieved 2026-11-11 | app/invest.js:86; src/engines/investmentDecisionEngine.js:495 (app.js:115 loads only) | partial (sources "unchecked") | modify |
| app/data/research.json | literature records | 36 records, mostly no geography | unknown | app/app.js:105 (library display) | display-only | keep |
| app/data/transit_value_effects.json | rail-proximity price effects | 18 rows, mostly pooled US | 2026-11-18 | app/invest.js:572; engine | implemented | keep |
| app/data/statutes.json = state-housing-laws.json (cmp identical) | state housing statutes | 45 records, 20 states + DC (CA 8, WA 4) | per-record | app/app.js:335, 3349; src/engines/statutoryZoningEngine.js | partial | modify (drop duplicate) |
| app/data/valuation_backtest_benchmarks.json | home-value back-test results | 18 counties | run 2026-11-16 | app/app.js:614 | implemented | keep |
| app/data/county_valuation_models.json | counties whose model passed | 11 (DC, 6 FL, 36081, 36085, 53033) | 2026-11-16 | app/app.js:695 | implemented | keep |
| data/backtests/ (94 files, 21 MB) | sales samples, model tests | DC, FL, NY, LA etc. | 2026-11-16 | scripts only | present, not shipped | keep |
| app/data/fhfa_hpi_06037.json | FHFA tract HPI | 1,933 tracts, LA County only | retrieved 2026-11-18 | not wired by filename (facts.js:310 uses live fetch, workers/sources.ts:836) | unsupported | modify |
| app/data/neighborhood_score_backtest.json | score vs HPI back-test | 50 counties; verdict "screen" | 2026-11-18 | app/invest.js:315; engine | implemented | keep |
| app/data/intervention_verification.json | catalog item evidence status | 81 items | 2026-11-16 | app/app.js:2116 | implemented | keep |
| app/data/upgrade_verification.json | homeowner upgrade verification | 46 rows | 2026-11-16 | app/app.js:2108 | implemented | keep |
| app/data/state_finance_profiles.json | assessment caps, TIF, exemptions | 52 state-keyed entries | per-record | app/app.js:110; src/engines/municipalFinanceEngine.js | implemented | keep |
| app/data/hud_fair_market_rents.json | HUD FMR | 3,222 county records | FY2027 | app/app.js:158; app/facts.js:12 | implemented | keep |
| app/data/la_neighborhood_values.json | LA bg/tract typical home value | LA County only | built 2026-11-16 | app/app.js:130 | implemented | keep |
| app/data/bundle_corrections.json | ACS tract-fallback fixes | 4,178 block groups | 2026-11-16 | app/app.js:10017 | implemented | keep |
| app/data/acs_fallback_flags.json | which bgs use tract values | 749 counties | 2026-11-17 | app/app.js:124 | implemented | keep |
| app/data/crash_counts/ | crash counts per bg | 233 counties (CA 58; CO, IL, ME, PA, TN, UT, VA) | rebuilt 2026-11-19 (docs) | app/app.js:3845 | partial | keep |
| app/data/crash_gaps/ | crash ranking gaps | 233 counties | unknown | app/app.js:3925 | partial | keep |
| app/data/tree_equity_2025/ | tree equity scores | 749 counties | 2025 | app/app.js:3888 | implemented | keep |
| app/data/county_completeness.json | per-county readiness tier | 787 counties: C 553, D 168, none 38, B 28 | 2026-11 | app/app.js:135 | implemented | keep |
| app/data/ca_counties_registry.json | MPO, GTFS, funding, hazard notes | 58 CA counties; "unverified", hand-entered | unknown | app/app.js:147 | partial | replace |
| app/data/transit_pipelines.json | planned stations | 5 metros | unknown | app/app.js:5777 | partial | keep |
| app/data/intercity_transit_corridors.json | intercity corridors | 4 corridors | unknown | app/app.js:9283; workers/localData.ts:13 | partial | keep |
| app/data/transit_cost_benchmarks.json | transit cost per mile | 52 rows | 2026-11-18 | src/engines/investmentDecisionEngine.js:551 | implemented | keep |
| app/data/case_studies.json | historical projects | 8 | unknown | app/app.js:8828 | display-only | keep |
| research/*.csv (24 files), data/research_corpus_500.json | source inventories | national lists; e.g. parcel_services.csv 118 lines | 2026-11 | not wired (scripts only) | present, unused | keep |
| inputs/, national/ | build inputs, build scripts | 42 MB / scripts | n/a | build only | unused at runtime | keep |

## Pilot-geography candidates (yes / live-API-only / no)
| item | Los Angeles 06037 | District of Columbia 11001 | San Diego 06073 |
|---|---|---|---|
| parcels | live-API only (parcel_services.json LA County GIS; county_completeness: live_service_with_values) | live-API only (not in parcel_services.json; completeness: live_service_lines_only) | live-API only (SanGIS via SANDAG, lines only) |
| zoning standards | no (LA zoning cells local in bundle-la, not parsed standards) | yes (zoning_standards.json, as published 2026-11-17) | yes (City of San Diego) |
| sale prices / backtest | yes (benchmark 06037 pass; la_resets pulls) | yes (11001 pass; data/backtests/sales_11001_2026-11-16.json.gz) | no (not in 18 benchmark counties) |
| crash counts | yes (crash_counts/06037.json) | no (not among 233) | yes |
| transit | yes (bundle stops, stations, rail) | yes (2,246 stops, 84 stations; 10 GTFS agencies) | yes (5 GTFS agencies per completeness) |
| underused sites | yes (90 in underused_sites.json; sites_*.json for others) | partial (counties/sites_11001.json.gz only) | partial (sites_06073 only) |
| home price index | yes (fhfa_hpi_06037.json, tract) | no (live fetch only) | no (live fetch only) |
| funding programs | yes (2 records tagged 06037) | no | no (CA generic only) |
| state law records | yes (CA 8) | yes (DC 1) | yes (CA 8) |
| street network | yes (38,616 named streets, bundle-la) | partial (arterials 11,585, freeways 4,124; streets layer empty) | unknown |
| utility records | no | no | no |

## Data absent for the vision
| missing | searched (app/data, data, research, inputs, national/data, counties/bundle_11001) | finding |
|---|---|---|
| Street centerline network outside LA | layers keys in DC and LA bundles | DC streets layer empty; only OSM arterials/freeways |
| Parcel geometries stored locally | parcel_services.json, bundles | live endpoints only; none stored |
| Utility records (water, sewer, storm) | grep sewer/water main/stormwater | prose only, no dataset |
| Capital improvement / street reconstruction schedules | grep CIP, capital improvement, pavement | prose only in research.json, no schedule |
| Construction cost by building type | grep construction cost; research/cost_factors.csv | one national index (NHCCI), 8 rows; unit_costs.json is street items |
| Rents / cap rates by submarket | grep cap rate; HUD FMR file | only county FMR; cap rate 5.9% inside unverified site assumptions |
| Vacancy rates | grep vacancy; bundle meta ACS fields | no vacancy field listed in DC bundle sources |
| Brownfield / contamination list | grep brownfield | no dataset |
| Building permits / pipeline | grep permit | only prose in law files |
| Flood / hazard layers | grep FEMA/flood; ca registry hazard | hand-entered text for 58 CA counties only |
