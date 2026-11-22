# Transit operating, ridership and station data: what was fetched (22 Nov 2026)

All fetches ran on 22 Nov 2026 from the build machine through scripts in `scripts/transit/` (re-runnable). Nothing here
was typed from memory: every number in the data files was read from the source named below. Where a source could not be
reached or read by a script, it is listed under "Not obtained".

## Files

| File | What it holds |
|---|---|
| `data/transit/ntd_agency_mode_annual.csv` (6.9 MB) | 22,507 agency / mode / type-of-service / report-year rows, report years 2020-2025, raw measures plus derived ratios, source dataset and URL on every row |
| `data/transit/ntd_sources.json` | dataset metadata (id, name, last-updated time, licence field, attribution), formulas, mode names |
| `app/data/transit_operating_benchmarks.json` (0.45 MB) | quartiles by mode and by mode + type of service, each report year, two cuts; 126 rail/BRT agency rows for 2025 |
| `data/transit/ntd_monthly_series.csv`, `ntd_monthly_ridership.csv.gz` (1.4 MB), `ntd_monthly_source.json` | 1,578 agency-mode series, 121,092 monthly rows, January 2019 to September 2026 |
| `data/transit/station_boardings.csv` (0.35 MB), `station_boardings_sources.json` | 941 station rows, 7 systems, with coordinates, period and source |
| `data/transit/amtrak_route_ridership_fy25.csv` | Amtrak FY25 and FY24 ridership for 50 routes |
| `scripts/transit/fetch_ntd_annual.py`, `build_operating_benchmarks.py`, `fetch_ntd_monthly.py`, `fetch_station_boardings.py`, `fetch_amtrak_routes.py`, `check_ntd_crosscheck.py`, `_socrata.py` | the fetchers and checks |
| `tests/unit/transitOperatingData.test.ts` | 13 tests; derived values recomputed by hand from the raw rows |

Raw downloads (about 100 MB of JSON) were kept outside the repository and deleted after the compact tables were written.

## a. NTD annual agency-mode service and finance data

- Source: `data.transportation.gov`, dataset **npsm-38gk**, "2025 NTD Annual Data - Service Data and Operating Expenses by Mode (Time Series 2.1)", FTA. URL `https://data.transportation.gov/d/npsm-38gk`. Rows last updated 2026-10-15 13:53 UTC (portal metadata). Time series 2015-2025; **report years 2020 to 2025 were taken** (latest year 2025 and the five before it). 277,397 long-form rows became 22,507 agency-mode-type-of-service-year rows. Fields taken: Fares, Operating Expenses (total and four functions), Vehicle Revenue Hours, Vehicle Revenue Miles, Unlinked Passenger Trips, Passenger Miles Traveled, Vehicles Operated in Maximum Service, Directional Route Miles.
- Licence: the portal's licence field reads "Public Domain U.S. Government", terms link `https://www.usa.gov/government-works` (which redirects to `https://www.usa.gov/government-copyright`). Attribution field: "Federal Transit Administration". I did not extract a verbatim sentence from the linked page; the quote above is the portal's own licence field.
- Report year here is NTD's report year (the agency's fiscal year ending in that year). Dollars are nominal.
- Derived in code (`fetch_ntd_annual.py`, formulas also in the JSON): operating expense per vehicle revenue hour = operating expenses / vehicle revenue hours; per vehicle revenue mile = operating expenses / vehicle revenue miles; per trip = operating expenses / unlinked passenger trips; fare revenue per trip = fares / unlinked passenger trips; farebox recovery = fares / operating expenses; average trip length = passenger miles / unlinked passenger trips; revenue hours per route mile = vehicle revenue hours / directional route miles. A ratio is blank when an input is missing or the denominator is not above zero. For rail, NTD counts revenue hours and miles per railcar, so "per revenue hour" is per car-hour.
- Cross-checks (`check_ntd_crosscheck.py`, against NTD's own Metrics tables: **ekg5-frzt** "2022 - 2025 NTD Annual Data - Metrics", rows updated 2026-10-14, and **vaik-frhy** "2021 Annual Metrics - National Transit Database"). Rows matched on NTD id + mode + type of service + year where the key is unique in both: operating expenses, passenger trips, revenue hours and revenue miles agree to the unit in every row for 2021, and in all but 8 to 11 operating-expense rows a year for 2022-2025 (of about 3,650 to 3,750); trips, hours and miles agree in every compared row. Fare revenue differs on 17, 0, 17, 16 and 21 rows in 2021 to 2025 (of about 1,700 to 3,100 compared), mostly purchased-transportation rows at a few agencies where the two NTD tables allocate fares differently (the largest gaps: ntd ids 00029, 60007, 40078, 10102, 50026). The medians below use this table's fares as published; fare ratios for purchased-transportation rows are the least certain figures here. 2020 has no Metrics table to compare with.
- Spot checks done by hand (also in the tests): BART heavy rail 2025 = 885,628,745 / 2,166,352 = 408.81 per revenue hour, which equals NTD's Metrics value 408.8111; fare per trip 236,627,027 / 56,592,868 = 4.1812, equal to Metrics 4.1812. MTA New York City Transit subway 2021 = 5,027,256,304 / 18,327,790 = 274.30, equal to the 2021 Metrics value.

### National medians by mode, report year 2025 (all qualifying agency rows; median with 25th to 75th percentile; n = agency-mode rows)

Row rule: mode status "Operating", both inputs above zero, no trimming of outliers. Quartiles by linear interpolation. Full tables for 2020-2025, mode + type of service, and a "top 50 by trips" cut are in `app/data/transit_operating_benchmarks.json`.

| Mode | Cost per revenue hour ($) | Cost per trip ($) | Fare per trip ($) | Farebox recovery | Avg trip (mi) |
|---|---|---|---|---|---|
| Heavy rail | 419 (323-578), n=16 | 10.74 (8.83-15.15), n=16 | 1.35 (1.03-1.97), n=15 | 0.189 (0.077-0.246), n=15 | 5.4 (4.6-6.6), n=16 |
| Light rail | 448 (385-637), n=23 | 11.97 (8.03-13.91), n=23 | 0.76 (0.61-0.99), n=23 | 0.069 (0.054-0.106), n=23 | 5.0 (3.5-6.3), n=23 |
| Streetcar | 376 (268-568), n=26 | 10.24 (7.68-19.74), n=26 | 0.58 (0.32-0.65), n=15 | 0.031 (0.011-0.061), n=15 | 1.4 (1.1-1.6), n=26 |
| Bus rapid transit | 197 (152-272), n=20 | 6.84 (5.04-8.03), n=20 | 0.67 (0.44-0.78), n=16 | 0.083 (0.065-0.110), n=16 | 3.4 (2.7-3.9), n=19 |
| Commuter rail | 852 (708-1,032), n=29 | 36.60 (24.27-49.46), n=29 | 4.69 (3.01-6.97), n=29 | 0.119 (0.074-0.268), n=29 | 24.7 (19.4-28.3), n=29 |
| Hybrid rail | 1,173 (714-1,436), n=6 | 40.84 (20.05-60.20), n=6 | 1.08 (0.68-1.80), n=6 | 0.028 (0.020-0.043), n=6 | 11.5 (7.3-15.0), n=6 |
| Monorail / automated guideway | 523 (353-656), n=6 | 10.11 (3.91-20.07), n=6 | 1.70 (0.06-4.16), n=4 | 0.164 (0.018-0.505), n=4 | 1.2 (0.9-1.7), n=6 |
| Bus | 114 (83-152), n=1,212 | 14.38 (8.90-24.67), n=1,212 | 0.84 (0.52-1.28), n=907 | 0.054 (0.028-0.086), n=907 | 4.3 (3.3-5.8), n=457 |
| Commuter bus | 158 (113-237), n=156 | 29.17 (19.15-49.17), n=156 | 2.92 (1.58-5.50), n=139 | 0.091 (0.045-0.222), n=139 | 25.5 (18.4-33.9), n=75 |
| Trolleybus | 234 (190-272), n=4 | 6.41 (4.75-8.06), n=4 | 0.83 (0.73-0.94), n=4 | 0.126 (0.113-0.149), n=4 | 1.8 (1.6-2.6), n=4 |
| Ferryboat | 1,075 (348-2,044), n=40 | 19.05 (10.47-40.77), n=40 | 5.08 (3.29-10.56), n=36 | 0.276 (0.178-0.441), n=36 | 5.2 (1.6-11.2), n=29 |
| Demand response | 81 (56-117), n=2,099 | 39.52 (25.55-60.35), n=2,100 | 1.99 (1.00-3.55), n=1,799 | 0.052 (0.025-0.112), n=1,799 | 7.1 (5.4-9.5), n=536 |
| Vanpool | 35 (27-56), n=111 | 7.09 (5.42-13.04), n=111 | 5.90 (4.56-7.35), n=111 | 0.847 (0.406-1.156), n=111 | 41.2 (32.9-48.8), n=87 |

Revenue hours per directional route mile (2025 median): heavy rail 8,379 (n=16), light rail 3,786 (n=23), streetcar 3,109 (n=26), bus rapid transit 2,277 (n=19), commuter rail 603 (n=29), bus 423 (n=455).

Cautions: heavy-rail and light-rail samples are 16 and 23 agencies, so the quartiles move with a single large system. Medians describe operating systems, not a new line. 2020 and 2021 are pandemic years. Rows labelled "Separate" or "Discontinued" in the source carry partial data and are excluded from the medians.

## b. NTD monthly ridership

- Source: dataset **8bui-9xvu**, "Complete Monthly Ridership (with Adjustments and Estimates)", FTA, `https://data.transportation.gov/d/8bui-9xvu`, rows updated 2026-11-03 14:51 UTC, licence field "Public Domain U.S. Government". The portal says the data are also published as a static Excel file on transit.dot.gov (not reachable here; the portal copy is updated weekly).
- Taken: all rows with date on or after 2019-01-01: 121,092 rows, 1,578 agency / mode / type-of-service / status series, months 2019-01 to 2026-09 (1,297 to 1,308 series reported per month in the latest eight months). Columns: unlinked passenger trips, vehicle revenue miles, vehicle revenue hours, vehicles operated in maximum service. No blank trip values.
- Checks: no duplicate series-month rows; MTA New York City Transit heavy rail January 2019 = 200,106,107 trips and 1,663,211 revenue hours in the file and in the live API.
- The latest months are early reports and may be revised.

## c. Station-level boardings (the validation set)

**Obtained: 7 systems, 941 station rows (station-line rows where a station has more than one line), with coordinates for 935.** Six of the seven are among the 25 largest rail/BRT operators by 2025 trips (ranked from the table in (a)): MTA New York City Transit (1), MBTA (2), CTA (4), BART (11), UTA (21) and Maryland MTA (22). Valley Metro (26) is the seventh. **19 of the 25 largest were not obtained** (list below). Boardings are not on the NTD portal at station level.

| System | Stations | Measure and period | Source | Licence text on file |
|---|---|---|---|---|
| NYC subway (MTA NYCT) | 428 station complexes | entries (fare taps, MTA estimate), mean over the 261 weekdays of 2025 | data.ny.gov **5wq4-mkjj** "MTA Subway Hourly Ridership: Beginning 2025", updated 2026-11-18; coordinates in the same file | portal licence field empty; terms not obtained |
| Chicago CTA 'L' | 144 | entries, mean of the 12 monthly average-weekday values of 2025 | data.cityofchicago.org **t2rn-p8d7** (updated 2026-11-20); coordinates from **8pix-ypme** (mean of the stop rows of each station) | licence field "See Terms of Use"; the City's terms page (`https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html`) was reachable but I did not extract a clause |
| BART | 50 | entries (row totals of the origin-destination workbook, average weekday), mean of the ten monthly workbooks 2026-01 to 2026-10 | `https://www.bart.gov/about/reports/ridership` (`Ridership_2026MM.xlsx`); names from `station-names.xls`; coordinates from BART GTFS parent stations | no licence statement found on the page |
| MBTA | 118 (rapid transit and light rail) | boardings (ons), weekday average, all routes and directions summed, Fall 2024 season | MBTA Hub table "Fall 2024 MBTA Rail Ridership by SDP Time Period, Route/Line, and Stop" (ArcGIS service `.../Fall_2024_MBTA_Rail_Ridership_by_SDP_Time_Period_Route_Line_and_Stop/FeatureServer/0`); coordinates from `https://cdn.mbta.com/MBTA_GTFS.zip` | no licence text in the service |
| UTA | 75 (TRAX, FrontRunner, S-line; operator relief points dropped) | boardings, weekday average per month, mean of 2025 months, routes summed | `maps.rideuta.com` service `RAIL_STOP_RIDERSHIP_TABLE_SINCE_2017`; coordinates by name join to UTA's TRAX and FrontRunner station layers (6 stops without a match have no coordinates) | no licence text in the service |
| Maryland MTA | 85 station-line rows (Metro SubwayLink, Light RailLink, MARC) | weekday ridership as published; **the dataset does not state the year**; dataset last updated 2019-08-26 | opendata.maryland.gov **cqt2-ypem** "MTA Transit Oriented Development (TOD) Data" | portal licence field "Public Domain" |
| Valley Metro light rail | 41 | average **daily** (all days) boardings, July-September 2018 | Valley Metro ArcGIS service `RidershipDataPortal` layer 0 | item text: figures "are for information purposes only and are not to be used for official ridership total calculations"; a licensee attribution statement is required |

Checks: system sums are plausible against known scale (BART 205,596 weekday entries; MBTA 455,545; CTA 357,884; NYC 4.02 million; UTA 56,241). BART's station-name join compares the workbook code table and GTFS names; one pair scored below 0.6 similarity (Pleasant Hill vs "Pleasant Hill / Contra Costa Centre") and is the same station. Each row carries `period`, `year`, `day_basis` ("weekday" or "all days") and the measure text. Entry versus exit bases differ (Maryland Metro is gate exits). Years differ by system: 2025 for NYC, CTA and UTA, 2026 for BART, 2024 for MBTA, 2018 for Valley Metro, none stated for Maryland. A model test should compare within a system first.

Also found and not loaded: Mesa light rail monthly riders per station (citydata.mesaaz.gov **pdpe-wbxu**, monthly totals, boarding basis not stated, 7 stations); NYC LIRR stop-level occupancy (data.ny.gov **hb2b-cimm**, occupancy not boardings); NTD facility inventories (station lists, no boardings).

**Not obtained (19 of the 25 largest):** WMATA (the MWCOG Metro ridership map service answered with a server error and the portal is a Power BI view), SEPTA (only route and mode level average daily ridership layers found), MTA Long Island Rail Road, MTA Metro-North, NJ TRANSIT, LA Metro, PATH (system totals only on data.ny.gov), San Diego MTS, Sound Transit, Peninsula Corridor (Caltrain), Northeast Illinois (Metra), SFMTA, MARTA, DART, TriMet, Miami-Dade, Denver RTD, Metro Transit (Minnesota; a bus-stop layer exists, no rail file found), Houston METRO. These were searched for in the ArcGIS Hub and Socrata catalogs and on a few agency pages in a time-boxed pass; most agency ridership pages are script-rendered or PDF and I did not find a machine-readable station file. This is "not found", not proof that none exists. valleymetro.org itself returned 403; amtrak.com returned 403.

## d. Capital cost

`app/data/transit_cost_benchmarks.json` is **unchanged**. A search of data.transportation.gov's catalog for FTA Capital Investment Grant project profiles and New Starts returned nothing; the NTD capital datasets there are agency spending by category, not project rows with route length. The FTA project profiles are on transit.dot.gov, which refuses this machine. MTA's own capital project datasets on data.ny.gov (for example 9hy6-8j6t) hold budgets, not per-mile project rows, and were not added.

## e. Amtrak

- Obtained: FY25 and FY24 **ridership by route** for 50 routes from Amtrak's year-end fact sheet `https://media.amtrak.com/wp-content/uploads/2025/11/FY25-Year-End-Ridership-Fact-Sheet.pdf` (footer "Last update: November 2025"), parsed by `fetch_amtrak_routes.py`. The route rows add up exactly to the sheet's own three subtotals (NEC spine 15,173,228; state supported 14,844,768; long distance 4,449,602) and total 34,467,598. Some published year-on-year changes look odd (for example Silver Star 38,138 against 388,122, with Floridian 504,332 in FY25); they are copied as published and not explained by the sheet.
- **Not obtained:** route-level revenue and operating expense. The FY25 sheet states ridership only, and the FY22 and FY23 sheets on media.amtrak.com are also ridership only. Amtrak's monthly performance reports are on amtrak.com, which refuses this machine (HTTP 403).

## Loader arguments for `evaluateTransit` (documentation only; the engine was not changed)

The engine takes cost tables through `ctx` and returns null where an input is missing. The new data would be injected as:

```
ctx.operatingBenchmarks = {
  "<mode code, e.g. LR>": { year: "2025", cut: "all" | "top50_upt",
    opex_per_vrh | opex_per_vrm | opex_per_upt | fare_per_upt | farebox_recovery | avg_trip_miles | vrh_per_route_mile:
      { n, p25, median, p75, pooled, unit, source_url } }   // from by_mode[mode].years[year].cuts[cut]
}
ctx.ridershipValidation = rows of data/transit/station_boardings.csv
  { system, station_name, lat, lon, avg_boardings_per_day, day_basis, year, mode, source_url }
```

Derivation the model would use: yearly operating cost = planned vehicle revenue hours x cost per revenue hour; fare revenue = trips x fare per trip; operating gap = cost minus fare revenue; any missing input gives null. The same text is in `meta.evaluate_transit_loader_arguments` of the benchmarks file.

## Corrections

None found in existing data during this work.
