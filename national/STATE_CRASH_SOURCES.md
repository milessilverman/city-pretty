# Statewide injury-crash sources (checked 7 Nov 2026)

City Pretty's crash scores (pedestrian/bicycle crashes, killed or seriously injured) and its traffic-calming and crossing candidates need every injury crash with a location, a date, the severity (killed, suspected serious injury) and pedestrian/bicycle involvement. Fatal-only data (NHTSA FARS) is downloaded everywhere but not scored.

This environment reaches ArcGIS Online feature services on `services`, `services1/2/3/5/7/8.arcgis.com`. Other hosts, including `services6.arcgis.com`, state DOT servers and Socrata portals, are not reachable. Every layer marked "in use" was queried live (counts, fields, sample records) before its adapter was written.

## In use
| State | Source | Years | Notes |
|---|---|---|---|
| CA | CHP CCRS (data.ca.gov) | 2016–2025 | San Francisco uses DataSF's injury-crash table instead (CCRS geocodes ~30% of SF crashes). |
| IL | IDOT yearly crash layers | 2016–2025 | 2016–2018 longitudes stored unsigned (fixed on read). |
| VA | VDOT Full_Crash | 2017–2025 | No 2016 records in the layer. |
| UT | UDOT UPlan "Utah Crash Locations", one layer per year | 2019–2025 | All reportable crashes. Each year layer misses ~1 day at its edges. Times are local wall-clock labelled +00:00, so the date is read as stored. |
| PA | PennDOT crash tables on PennShare | 2017–2023 | 2019–2023 has month precision only. 2017–2018 come from the 2017–2021 table, which repeats rows per crash; it was checked against the newer table on 4,957 crashes and deduplicated. |
| TN | Dept. of Safety TITAN dashboard records (two snapshots) | 2021 – 2 Dec 2025 | Injury and fatal crashes only. TDOT's all-crash layer (2021–Jan 2025) has no pedestrian/bicycle flags and holds only ~93% of injury crashes, so TITAN is used. |
| ME | MaineDOT "Crash Locations - 10 Years Complete" | 2016–2025 | All reportable crashes with K/A/B/C counts. A rolling window, so 2016 will drop out. |
| Denver, CO | Denver police crash reports | 2016–2025 | County source; minor injuries are not recorded. |

## Check against NHTSA FARS (2023 deaths)
Run 7 Nov 2026 by summing each source's death counts for 2023 and NHTSA FARS (final release, USDOT/BTS copy) for the same state; script `crash_validate.py` in the round-8.1 notes.

| State | Source | FARS | Difference |
|---|---|---|---|
| IL | 1,244 | 1,241 | +0.2% |
| VA | 907 | 914 | −0.8% |
| UT | 279 | 280 | −0.4% |
| PA | 1,204 | 1,211 | −0.6% |
| TN (TITAN) | 1,323 | 1,323 | 0.0% |
| ME | 148 | 135 | +9.6% |

FARS counts only crashes on public roads where someone died within 30 days. MaineDOT's layer flags which crashes are in FARS (`FARS_YN`): its FARS-flagged crashes hold 134 deaths (FARS: 135, −0.7%), and the other 14 deaths are in crashes MaineDOT marks as not in FARS (4) or leaves unmarked (10). City Pretty keeps all of them, as MaineDOT records them.

## Partial (found, not used: a required field or years are missing)
- **Maryland:** all crashes 2019–2026, but severity is only Fatal / Injury / PDO; pedestrian and bicycle are not separated, and the non-motorist flag is empty for 2021–2022.
- **Minnesota:** DPS all-crash layer, rich, but only 2025 onwards.
- **New Jersey:** pedestrian and bicycle crashes only, year only.
- **South Carolina:** fatal crashes only (2001 to May 2024).
- **Kansas:** fatal and suspected-serious crashes only, 2016–2024.
- **Oklahoma:** fatal and injury (K/A/B) crashes only, 2017–2021, no pedestrian/bicycle field.
- **South Dakota:** all crashes, rolling five years; pedestrian and bicycle share one flag; no counts on the crash layer.
- **Vermont:** all crashes 2010–2026, but severity is only Fatal / Injury / PDO.
- **Delaware:** a one-off DelDOT copy, 2009 to Nov 2024, crash class only.
- **New Mexico:** pedestrian/bicycle injury crashes only, 2013–2023.
- **Oregon:** preliminary fatal crashes only, 2024–2026.
- **District of Columbia:** fatalities only.

## Official data exists, but not on a reachable host
- **Arizona:** ADOT's fatal and serious crashes 2016–2025, on `services6.arcgis.com`.
- **Ohio:** ODOT TIMS yearly crash locations (`tims.dot.state.oh.us`).
- **Massachusetts:** MassDOT open crash data (`gis.crashdata.dot.mass.gov`, `gis.massdot.state.ma.us`).
- **Washington:** WSDOT Crash Data Portal.
- **Wisconsin:** WisTransPortal / Community Maps.
- **Iowa:** `gis.iowadot.gov` Crash_Data.
- **Connecticut:** UConn CTCRASH.
- **Idaho:** ITD CrashLayers.
- **Montana:** MDT Public Crash Information (2016–2025).
- **North Dakota:** NDDOT crash services at NDSU.
- **Pennsylvania 2024+:** CDART statewide zips on `gis.penndot.gov`.
- **Kansas, all crashes:** KanPlan.
- **Delaware:** FirstMap.
- **Oregon:** TransGIS.
- **South Dakota:** `sdgis.sd.gov`.
- **DC:** `maps2.dcgis.dc.gov`.
- **Utah 2018:** UDOT central server.

Adding these hosts to the environment's allow-list would unlock them; each needs only a field map in `region.STATE_DEFAULTS`.

## Nothing found
Texas, Florida, Georgia, North Carolina, Michigan, New York, Colorado (round 7), Indiana, Missouri, Alabama, Louisiana, Kentucky, Nevada, Mississippi, Nebraska, West Virginia, New Hampshire, Rhode Island, Wyoming, Arkansas (dashboard only), Alaska and Hawaii (no OSM extract either).

## Layer URLs (in use)
- **IL:** `https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/<yearly layer>/FeatureServer/0`, e.g. `CRASHES__2024`; the full list is in `pipeline/region.py`.
- **VA:** `https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/Full_Crash/FeatureServer/0`
- **UT:** `https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer/{1-7}` (layer 7 = 2019 ... layer 1 = 2025)
- **PA:**
  - `https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8`
  - `https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/Crashes_2017_to_2021/FeatureServer/0`
- **TN:**
  - `https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes__07_18_23_WFL1/FeatureServer/17` (2021–2022)
  - `.../TITAN_Dashboard_Crashes__12_03_25_WFL1/FeatureServer/17` (2023–2025)
- **ME:** `https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44`
- **Denver:** City of Denver open data (`pipeline/region.py` COUNTY_OVERRIDES 08031).
- **San Francisco:** DataSF injury crashes in the City's ArcGIS org (`pipeline/region.py` COUNTY_OVERRIDES 06075).

Field maps for UT, PA, TN and ME are in `pipeline/region.py` (`STATE_DEFAULTS`, kind `arcgis_map`, read by `pipeline/state_crashes.py`). The research notes behind this table, with per-state counts and field checks, are in the round-8 handoff.
