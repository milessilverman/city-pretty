# Crash counts outside California: rebuilt with a boundary rule (16 Nov 2026; 1/k split 21 Nov 2026)

> **21 Nov 2026:** the rule below (a boundary crash counts for each block group it borders) is the 16 Nov rule. Since 21 Nov a
> crash within 10 m of k block groups counts 1/k in each, so a county's block groups add up to its placed crashes. The
> tables below describe the 16 Nov pass (the "boundary rule vs strictly inside" ratios are the overcount the split removes).

## Why

`pipeline/metrics_oc.py:587` counted a crash for a block group only if the point was strictly `within` it. Crashes are
geocoded onto street centerlines, and streets are usually block-group boundaries, so a crash on a boundary street was
counted on one side or the other by geocoding accident. The same problem was found and fixed for Los Angeles
(`scripts/build_la_crash_counts.py`).

## What was rebuilt

`scripts/build_state_crash_counts.py` writes `app/data/crash_counts/<county fips>.json` for every county whose data
file (`counties/bundle_<fips>.json.gz`, `meta.sources`) loaded state or city crash records: **94 counties in 7
sources**. San Francisco (DataSF) is California and was skipped.

Rule: a crash counts for a block group if it is inside it or within 10 m of its boundary, so a boundary-street crash
counts for each block group it borders. Block groups: Census TIGERweb 2020 (`tigerWMS_Current` layer 10), projected
to metres with a per-county equirectangular projection.

Window: the latest three full years each source publishes. The bundles used longer windows, so old and new are
compared as per-year rates below.

| Source | Counties | New window | Bundle window | Matched crashes on a boundary | Boundary rule vs strictly inside (all / KSI) | Per-year rate new vs bundle (KSI / ped-bike), median block group | Block groups whose KSI rate moved > 25% |
|---|---|---|---|---|---|---|---|
| Denver Police traffic accidents | 1 | 2023–2025 | 2016–2025 | 46% | ×1.67 / ×1.89 | ×1.67 / ×1.67 | 36% |
| Illinois DOT crash records | 20 | 2023–2025 | 2016–2025 | 42% | ×1.54 / ×1.54 | ×1.34 / ×1.67 | 35% |
| MaineDOT crash records | 5 | 2023–2025 | 2016–2025 | 39% | ×1.45 / ×1.37 | ×1.38 / ×1.48 | 33% |
| Pennsylvania DOT (PennShare) | 31 | 2021–2023 | 2017–2023 | 37% | ×1.41 / ×1.39 | ×1.51 / ×1.17 | 26% |
| Tennessee TITAN (injury crashes only) | 14 | 2022–2024 | 2021–2025 | 46% | ×1.54 / ×1.52 | ×1.67 / ×1.67 | 50% |
| Utah DOT crash records | 6 | 2023–2025 | 2019–2025 | 53% | ×1.61 / ×1.64 | ×1.90 / ×1.87 | 49% |
| Virginia DOT crash records | 17 | 2023–2025 | 2017–2025 | 45% | ×1.50 / ×1.53 | ×1.50 / ×1.50 | 39% |

How to read it: in every source 37–53% of crashes sit within 10 m of a block-group boundary, and counting them for
both neighbours raises block-group totals by 40–67% over strictly-inside counting (the same pattern as LA). The
per-year comparison with the bundles mixes that rule with the change of years, so it is shown for size only. A
quarter to half of block groups' killed-or-seriously-injured rates move by more than 25%, which is enough to change
"worse than X% of similar areas" rankings. Per-county figures: each file's `_meta` (`on_boundary`, `matched`,
`strict_within_totals`).

## Field mappings

None of these services publishes field descriptions, only aliases, so meanings rest on the aliases, the coded values
observed on 16 Nov 2026, and the checks recorded in `pipeline/region.py`.

| Source | Service | Killed | Seriously injured | Pedestrian / bicycle | Values observed |
|---|---|---|---|---|---|
| Illinois DOT | `CRASHES_2023`, `CRASHES__2024`, `CRASHES___2025` (FeatureServer/0) | `TotalFatals` | `AInjuries` (KABCO A) | `TypeOfFirstCrash` = `Pedestrian` / `Pedalcyclist` | 2024: Pedestrian 4,637, Pedalcyclist 3,370 of ~300k. **First harmful event only**, so pedestrian/bicycle counts are a lower bound |
| Virginia DOT | `Full_Crash/FeatureServer/0`, `CRASH_YEAR` '2023'–'2025' | `K_PEOPLE` ("K_People") | `A_PEOPLE` ("A_People") | `PED_NONPED` ("Pedestrian?") = 1, `BIKE_NONBIKE` ("Bike?") = 1 | 2024: PED 1,747 / BIKE 690 coded 1, rest 0 |
| Pennsylvania DOT | `CRASH2019_2023/FeatureServer/8`, `CRASH_YEAR` 2021–2023 | `FATAL_COUNT` | `SUSP_SERIOUS_INJ_COUNT` | `PED_COUNT` > 0, `BICYCLE_COUNT` > 0 | Longitudes unsigned; made negative. Table ends 2023 |
| MaineDOT | `Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44`, `ACCIDENT_YEAR` 2023–2025 | `NO_OF_K_INJ` ("No Of K Inj") | `NO_OF_A_INJ` ("No Of A Inj") | `PED_YN` / `BICYCLE_YN` = Y | 2024: Y 263 / 204, rest N |
| Utah DOT | `Utah_Crash_Locations/FeatureServer/3,2,1` (2023, 2024, 2025) | `number_fatalities` | `number_four_injuries` (UDOT severity 4, suspected serious) | `pedestrian_involved` / `bicyclist_involved` = Y | 2024: Y 1,026 / 604 |
| Tennessee TITAN | `TITAN_Dashboard_Crashes__07_18_23_WFL1/17` (2022), `__12_03_25_WFL1/17` (2023–2024) | `Fatality` | `Crash_Type` = "Suspected Serious Injury" | `Pedestrian` = Pedestrian, `Pedalcyclist` = Pedalcyclist | 2024 `Crash_Type`: Possible 19,858, Minor 19,780, Serious 4,794, Fatal 1,097. **Injury and fatal crashes only**, so "all" = injury or fatal crashes. 2025 left out (snapshot ends 2 Dec 2025) |
| Denver Police | `ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325`, `first_occurrence_date` 2023–2025 | `FATALITIES` | `SERIOUSLY_INJURED` | `pedestrian_ind` > 0, `bicycle_ind` > 0 | Minor injuries not recorded by this source |

## What this does not fix

- **Crashes stored without a location** are not returned by a map query, so their share is unknown for these
  sources (in LA's CCRS data it is 26%).
- **California** was rebuilt separately (`scripts/build_crash_counts_ca.py`; San Francisco with this script) and, on 19 Nov 2026, again with the 1/k split. The files from this pass (outside California) were built under the older rule (a boundary crash counts in full in each bordering block group); all 175 were rebuilt with the 1/k split on 21 Nov 2026 (below).
- **Counties with no crash source** (most of the 637) have no crash counts; only federal FARS fatal crashes were
  downloaded and are not scored.
- The bundles' own crash-based rankings and the traffic-calming placement still use the old counts until the page is
  wired to these files and the bundles are rebuilt (not done here; `app/app.js` was out of scope).

## Update 21 Nov 2026: all 175 files rebuilt with the 1/k split

The 175 files outside California (the 94 counties above plus 81 Tennessee counties added 17 Nov) were rebuilt with
`scripts/build_state_crash_counts.py` (same services, queries and years). Every source answered, and every county's crashes
read and placed are the same as in the old files. Block-group sums (all crashes) against placed crashes, from the files:

| State | Counties | Placed | Sum before (ratio) | Sum after |
|---|---|---|---|---|
| 08 Colorado (Denver) | 1 | 51,561 | 84,502 (1.64) | 51,561.0 |
| 17 Illinois | 20 | 803,735 | 1,189,172 (1.48) | 803,735.0 |
| 23 Maine | 5 | 69,522 | 98,692 (1.42) | 69,522.0 |
| 42 Pennsylvania | 31 | 302,628 | 448,097 (1.48) | 302,628.0 |
| 47 Tennessee | 95 | 141,107 | 221,471 (1.57) | 141,107.0 |
| 49 Utah | 6 | 148,709 | 243,448 (1.64) | 148,709.0 |
| 51 Virginia | 17 | 209,055 | 309,516 (1.48) | 209,055.0 |
| All | 175 | 1,726,317 | 2,594,898 (1.50) | 1,726,316.9 |

Invariant test over every county: `tests/unit/crashCountsInvariant.test.ts`. Details, the recomputed comparisons and the
live check: `docs/DATA-AUDIT-AND-TRANSPARENCY.md`, 21 Nov 2026 entry.
