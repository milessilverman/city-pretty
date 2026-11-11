# Crash research B — statewide official crash layers on allowed ArcGIS hosts
Started 2026-11-07. Allowed hosts: services{,1,2,3,5,7,8}.arcgis.com, www.arcgis.com, hub.arcgis.com

## Progress log

### Iowa — EXISTS BUT NOT ON AN ALLOWED HOST
- Official: Iowa DOT item 7a1f786d55a2439a9bfa8f7a527936e8 "Crash Data" (owner IowaDOT_GIS, org 8lRhdTsQyJpO52F1): "General crash-wide data from the prior 10 years in the State of Iowa." URL https://gis.iowadot.gov/agshost/rest/services/Traffic_Safety/Crash_Data/FeatureServer (also Crash_Vehicle_Data, Crash_Person_Data) -> gis.iowadot.gov not allowed.
- Iowa DOT's AGOL org (services.arcgis.com/8lRhdTsQyJpO52F1, 266 services) has only PCR segment/intersection aggregates, VRU analyses — no crash point layer.
- Non-official copies: mcoenen (Des Moines Area MPO) services1.arcgis.com/6oz1ALkDiRZ7VlIc "Crashes" — extent is Des Moines metro only (not statewide). esri_devlabs "Iowa DOT Crash Data" services3/GVgbJbqm8hXASVYi (demo). MAPA "All Crashes 2018 to 2022" (Omaha MPO, NE+IA metro).

### Utah — USABLE (2019–2026 only)
- Service: https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer
  layers: 0=2026, 1=2025, 2=2024, 3=2023, 4=2022, 5=2021, 6=2020, 7=2019 (points, SR 26912 NAD83 UTM12N; outSR=4326 works)
- Item 834f76028e934c7b84cd32498fe6a1eb "Utah Crash Locations", owner jharman@utah.gov_uplan, org pA2nEVnB6tquxgOW (UDOT UPlan). "This service shows crash locations with all personal identification information removed. The date range is 1/1/2019 to current ... refreshed nightly ... contact Chris Whipple (chriswhipple@utah.gov) ... protected under 23 USC 407. 2025 numbers are preliminary"
- Counts: 2019 64544, 2020 50409, 2021 61141, 2022 58806, 2023 59882, 2024 59316, 2025 59860, 2026 48416 (thru 2026-11-04)
- Salt Lake Co envelope (-112.26,40.41,-111.55,40.92): 2024 26061 (county_name='SALT LAKE' 22871); 2019 31368; 2025 26372
- All severities (PDO incl.). One row per crash (distinct crash_id = count in 2024).
- Fields: crash_id (BigInt), crash_datetime (TimestampOffset, ISO string in JSON), number_fatalities, number_four_injuries (=A suspected serious), number_three_injuries (B), number_two_injuries (C), number_one_injuries (= uninjured persons, O!), crash_severity_desc in {'No Injury/PDO','Possible Injury','Suspected Minor Injury','Suspected Serious Injury','Fatal'}, pedestrian_involved 'Y'/'N', bicyclist_involved 'Y'/'N'.
- persons injured = four+three+two.
- 2024 sums: K 277, A 1924, B 9847, C 15266.
- Quirks: crash_datetime holds LOCAL time labelled +00:00 (hour histogram peaks 17-18h, trough 2-4h); year layers span stored [Y-01-01 07:00, Y-12-31 07:00) so ~Jan 1 00:00-06:59 and Dec 31 07:00-23:59 local are MISSING from every year layer (2024 layer: 0 recs >= 2024-12-31 07:00; 2025 layer: 0 recs < 2025-01-01 07:00). Use first 10 chars of string as date.
  lat_utm_y/long_utm_x fields actually hold Web Mercator metres (e.g. -12469562, 5046837) — use geometry with outSR=4326.
  1 rec of 2026 outside UT bbox. maxRecordCount 2000, pagination supported. dataLastEditDate 1793969587475 (2026-11-06 12:53 UTC).
- Not allowed: UDOT_Admin "Crash Locations" MapServer back to 2018 at central.udot.utah.gov/central/rest/services/TrafficAndSafety/Crash_Locations/MapServer.

### Louisiana — NOT FOUND
- LADOTD AGOL org PLiuXYMBpMK5h36e ("Louisiana Department of Transportation & Development", 79 services): no crash point layer; only Ped_Bike_TAA_ALL (2023 VRU target analysis areas, polygons).
- Only local/consultant copies (Westwood "DOTD_crash_data" services.arcgis.com/FqQ2BQIKVGpUWqAa — small local extent, 17785 recs; CSRS copy on services6 = not allowed host (403); EBR parish Ped_Cyc_Crash; St. Mary Parish). LA crash data is distributed via LSU CARTS (crashdata.lsu.edu), not ArcGIS.

### Kentucky — NOT FOUND
- KYTC AGOL org CcI36Pduqd0OR4W9 (services2, 307 services): only consultant/project-local crash layers (All_Crash_Points_2019_2023 2298 recs local extent; Crashes2020to2024 15215 recs local extent; CrashDataStoryMap 146). No statewide layer. KYTC "Combined Incidents Reports for 24 hrs" is 511-style incidents, not crash records.
- Statewide crash data via KSP/KTC (crashinformationky.org public site, KTSDS data requests) — not ArcGIS REST on allowed hosts.

### Oregon — PARTIAL (fatal-only, preliminary, 2024–2026)
- https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/InitialFatalPublic/FeatureServer/0 ("Initial Fatal Crashes"; layer 1 = table "Initial Fatal Crash Fatalities" 1338 rows)
- Item 745dc7169bf144b1a0a08ce7669a6364, owner jennifer.lanzarotta_ODOT, org uUvqNMGPm7axC2dD ("Oregon ArcGIS Online", state shared org). Desc: "The publicly accessible copy of the Oregon DOT CAR Unit initial fatal crash data."
- 1255 rows; ACDT_DT range 2024-01-01 .. 2026-06-22; REMOVED=1 on 111 rows (filter REMOVED=0). Not-removed: 2024 489 crashes (536 killed), 2025 460 (488), 2026 195 (205, partial).
- Fields: ST_ACDT (CAR fatal crash #, unique), ACDT_DT (Date, local midnight PST stored as 08:00Z), LAT, LONGTD (signed, ok), NUM_FATALS, PED 'Yes'/'No', BIKE 'Yes'/'No', COUNTY. No serious-injury or injured counts.
- SR 2992 (Oregon Lambert ft) — use outSR=4326 or LAT/LONGTD. maxRecordCount 10000. dataLastEditDate 1782765997885 (2026-06-29).
- Multnomah envelope (-122.93,45.43,-121.82,45.73) REMOVED=0: 198 (COUNTY='Multnomah': 141).
- Other ODOT hosted: Crashes_R1Hwys_2014_2023 (Region 1 ODOT highways only, 81527), ODOT_Region1_Crashes (R1 KA 2012-2016), 2019_2024_Fatal/_Serious_Injury (small project sets). Statewide all-crash data is on ODOT TransGIS gis.odot.state.or.us/arcgis1006/rest/services/transgis/catalog/MapServer (not allowed host).

### Oklahoma — PARTIAL (KAB-only crashes, statewide, 2017–2021; no ped/bike flags in crash layers)
- Org 1RKb5IC5HFxsUYMS = "Oklahoma Department of Public Safety" (urlKey OKDPSWF), owner amygraham (OHSO analyst; items have no descriptions; used in "OHSO Interactive Crash Maps" app bbceac52ab4644cb8e9d9753bfd8f137).
- Layers (all point, Web Mercator; one row per crash: distinct DOC_ID = count):
  2017 https://services2.arcgis.com/1RKb5IC5HFxsUYMS/arcgis/rest/services/kab_crashes_2017/FeatureServer/0  10089 (K613/A2146/B7330), maxRec 2000, edit 2019-02-28
  2018 .../kab_crashes_2018/FeatureServer/0 10128 (K603/A2054/B7471), maxRec 2000, edit 2019-09-05
  2019 .../kab_crashes_2019/FeatureServer/0 9763 (K584/A1809/B7370), maxRec 2000, edit 2020-08-07
  2020 .../2020_kab_crashes/FeatureServer/0 8609 (K602/A1700/B6307), maxRec 1000, edit 2021-08-30
  2021 .../2021_kab_crashes/FeatureServer/0 9360 (K681/A1703/B6976), maxRec 1000, edit 2024-02-20 (2021_kab_crashes_a = duplicate)
- Oklahoma Co. envelope (-97.68,35.29,-97.14,35.73): 2017 2409, 2018 2451, 2019 2423, 2020 1990, 2021 2178
- Fields: DOC_ID; SEVERITY 2017/18 {'Fatal','Incapacitating','Non-incapacitating'}, 2019-21 {'Fatal','Serious','Minor'}; KABCO_LABEL (2019+) {'A Fatal','B Serious','C Minor'} = SORT PREFIXES, not KABCO letters!; killed: NUMBER_KILLED (2017) / TOTAL_KILLED (2018+); injured persons: NUMBER_INJURED (2017) / TOTAL_INJURED (2018+); no per-crash A-injury count; lat/lon: LATITUDE (2017/18) / LATITIDE [sic] (2019+), LONGITUDE (signed); DATE = Date (2017/18 00:00Z; 2019/20 06:00Z local midnight) but 2021 DATE is a STRING 'M/D/YYYY' (TIME is a bogus Date). YEAR field.
- K sums match official: 2017 657, 2019 640, 2021 762.
- Ped/bike: not in crash layers. Separate person-level layer bk_ped_2015_2017/FeatureServer/0 (despite name: 2015-2021, ~1000-1130 persons/yr, 7120 distinct DOCID, all severities, CRASH_SEVERITY {'Fatal','Serious','Minor','Possible','None'}) could flag crashes via DOCID join.
- Misc: kab_crashes_16_17_18 actually holds 2021 + partial 2019/2020 (misleading); 22_23_fatalities = person-level fatalities 2022-23 (1421); SORTPO_crash_ocers = SORTPO region only 2023-2025 (has NUM_PEDESTRIANS/NUM_BICYCLISTS).
- ODOT (Oklahoma DOT) org RBtoEUQ2lmN0K3GY is on services6 (not allowed); only corridor/top-25 layers anyway.

### Connecticut — EXISTS BUT NOT ON AN ALLOWED HOST
- CTDOT_OpenData items (e.g. "Fatal Crashes" e069dc173d7140ac899db2c8d11fec12, "Pedestrian Crashes" c04873d148da48fa9d7e1b06639d6e1c, "Bike Crashes" 5ccc2ce232264fdd8a24bf8db1009e5c, "Non Motorist", "Intersection", ... "2015 to present") all point to https://gis.cti.uconn.edu/arcgis/rest/services/Crash_Dashboards/<Theme>/FeatureServer (UConn CTSRC server) -> not allowed. Themed subsets, not an all-crash layer; full data in CT Crash Data Repository (UConn).
- CTDOT AGOL org FCaUeJ5SOVtImake (services1, 132 services): no crash point layer (only county DUI-crash 3-yr WFL1 maps 2016-2019 by Thad.Dymkowski_CTDOT).

### Nevada — NOT FOUND
- NDOT AGOL org 9Y4hSlLf13E9S0Eo ("Nevada Department of Transportation", services1, 58 services): only "TSE Crash Data Request Submissions" (a Survey123 request form). Crash data is by request.
- Non-official copies: Jacobs (NDOT consultant) NDOT_FY2024_Crashes_2019_2023 etc. on services9 (not allowed host; crashes within 150 ft of state routes only); UNLV ped/bike layers on services6 (not allowed); City of Las Vegas "CLV Traffic Crashes" services1/F1v0ufATbBQScMtY (city only).

### Arkansas — NOT FOUND
- ARDOT AGOL org 7cbqsWqMe170dJ3k ("Arkansas Department of Transportation", 763 services): no crash point layer; only ArDOT_Freight_Highway_Safety (truck-crash polygons aggregates, consultant High Street). ARDOT's Arkansas Crash Analytics Tool (ACAT; eCrash-based; FHWA webinar says hosted on AGOL; a 3rd-party index cites a service "ACATHistCrash15to19View") — not discoverable/public in search; ACAT dashboard item 22d65b51cf2c42b5af4215774c9c4814 is inaccessible.

### Kansas — PARTIAL (KA-only: fatal + suspected-serious crashes, statewide, 2016–2024)
- Org q2CglofYX6ACNEeu = "Kansas State Government GIS" (urlKey KSDOT), KDOT staff owners. All-crash layer "Crashes in Kansas" (KanDOT item b79862ee9eaa4..., "past 10 years plus current year") is at kanplan.ksdot.gov/arcgis_web_adaptor/rest/services/Transportation/Accidents/FeatureServer -> NOT allowed host (also Accidents_SHSP, Accidents_State).
- (a) 2016–2020: https://services1.arcgis.com/q2CglofYX6ACNEeu/arcgis/rest/services/Highest_Severity_by_Crash/FeatureServer/1 ("F + SSI Local GDB"), item 0f25d4e175894668a8280cbc56e53ae6 owner xdpearson: "Contains high severity (Fatal - F or Suspected Serious injury - D) person level crash data by crash point location reviewed by KDOT ... 6,862 crash incidents between 2016 and 2020 ... Source: KDOT". 6862 rows, distinct ACCIDENT_KEY 6862 (one row per crash). Per year FATAL/INJURY: 2016 380/951, 2017 407/820, 2018 364/805, 2019 361/1113, 2020 381/1280. Sedgwick env (-97.81,37.47,-97.15,37.83): 1050. maxRec 2000. edit 2022-05-27.
- (b) 2020–2024: https://services1.arcgis.com/q2CglofYX6ACNEeu/arcgis/rest/services/Crash_Selector_Map___SHSP_Troops/FeatureServer/1 ("Accident"), item f94f1e86fe044628871ed3364fe4c96c owner Wenjun.Yang_KSDOT ("This map is specified for Troop use, including troop layer."). 8656 rows, distinct ACCIDENT_KEY 8656. FATAL/INJURY: 2020 381/1244, 2021 380/1385, 2022 360/1430, 2023 353/1504, 2024 285/1334. Sedgwick env: 1594. maxRec 2000. dataLastEdit 1757363228715 (2025-09-08).
  (also SHSP_Crash_summary_2023/FeatureServer/0 2019–2023 8775 (custom Lambert SR); Crash_Selector_Map___SHSP_Dashboard_with_KTA/FeatureServer/0 2018–2022 7766)
- Fields: ACCIDENT_KEY (str), DATE_OF_ACCIDENT (Date; (a) 00:00Z, (b) 06:00Z = local midnight CST), ACC_YEAR (string), ACC_SEVERITY {'FATAL','INJURY'}, MOST_SERIOUS_INJURY {'F','D'} (Kansas codes: F fatal, D disabling = A), FATALITIES, DISABLING_INJURIES (=A count), NON_INCAPACITATING_INJURIES (B), POSSIBLE_INJURIES (C), PEDESTRIAN_ACCS (count 0..5 -> >0), PEDAL_CYCLIST_ACCS (count 0..2 -> >0), also EA_PEDESTRIANS/EA_BICYCLISTS in (b); DOT_LATITUDE/DOT_LONGITUDE (signed). Point geom Web Mercator.
- persons injured = DISABLING + NON_INCAPACITATING + POSSIBLE.

### Mississippi — NOT FOUND
- No MDOT (Mississippi) / MS Office of Highway Safety crash layer in AGOL search; only a student project (as5142_msstate) and bridge-crash research layers.

### New Mexico — PARTIAL (VRU-only = ped/bike-involved injury crashes K/A/B/C, statewide, 2013–2023)
- https://services.arcgis.com/hOpd7wfnKm16p9D9/arcgis/rest/services/VRU_crashes/FeatureServer/0 — item 6729211c6a8445b2a171c59703c45224 "VRU Crashes: 2013-2023", owner alma.pacheco_NMDOT, org hOpd7wfnKm16p9D9 = "NMDOT ArcGIS Online" (urlKey NMDOT); snippet "Crashes based on the KABCO Scale from 2013-2023" (no description).
- 8868 rows. Per year: 2013 658, 2014 755, 2015 836, 2016 855, 2017 902, 2018 895, 2019 926, 2020 674, 2021 741, 2022 849, 2023 777. KABCO {'K':937,'A':1274,'B':3838,'C':2819} (no O crashes). Ped only 5847, bike only 3014, both 7.
- Bernalillo env (-107.20,34.87,-106.15,35.22): 4631.
- Fields: LAT, LON (signed), DATE_OF_CRASH (Date = TRUE UTC incl. time: e.g. local 19:xx Feb 5 stored 2013-02-06T02:00Z -> convert to America/Denver or use CRASH_YEAR/MONTH(name)/CRASH_DAY), KABCO 'K','A','B','C', person counts K, A, B, C, O (O = uninjured persons), PEDESTRIAN_INVOLVEMENT 0/1, PEDALCYCLE_INVOLVEMENT 0/1, CRASH_SEVERITY e.g. 'Injury Crash'. Sums K 954, A 1342. No crash ID field (OBJECTID only). maxRec 2000. dataLastEdit 1770676434014 (2026-02-09).
- Persons injured = A+B+C.
- Other: NMDOT I40_Crashes_2016_to_2020 (corridor), HSIP network screening; UNM-GPS (NMDOT crash-data contractor, org yoHEqrpdNTkXieBJ on services8) has only themed subsets (2024 ped crashes, animal, motorcycle, truck, SE NM 2021-2024) — no statewide all-crash layer.

### Nebraska — NOT FOUND
- State of Nebraska AGOL org Sj9eBhzWwOMzQCfI (services1, 25 services) and NDOT services on gis.ne.gov (not allowed host) — no crash layers in either per search. Only MAPA (Omaha MPO) "All Crashes 2018 to 2022" (NE+IA metro, draft) and city layers.

### Idaho — EXISTS BUT NOT ON AN ALLOWED HOST
- ITD crash data served from https://gis.itd.idaho.gov/arcgisprod/rest/services/ArcGISOnline/CrashLayers/MapServer (e.g. layer 23 "Crash Person 2005 to Present") and .../ArcGISOnline/IdahoTransportationLayersForOpenData/MapServer/123 ("ITD Crash Data") -> not allowed.
- ITD AGOL org Qqv4dYPC8Vv8e3c3 ("Idaho Transportation Department", urlKey IPLAN, services1, 312 services): only small district study-area crash layers (AllCrash 280 recs, AGOL_TrafficCrash 578 recs 2011-16).
- COMPASS (Boise MPO) "Crash Data" from ITD is on swidrdc.org (not allowed, regional).

### West Virginia — NOT FOUND
- WVDOT AGOL org xLpB90lOmCXYDAWo (services2, 326 services; Open Data hub data-wvdot.opendata.arcgis.com): no crash points; only county/MPO safety-data aggregates (WV_SafetyData_2021 table, WV_SafetyCountiesDistricts_2020 polygons, consultant CamSys).
- Non-official: Marshall University org IXca74Swt1ZsLFr1 — Crash_Web_Tool_WFL1/FeatureServer/7 CRASH_TABLE (204,270 crash rows, 2002-02-15..2013-04-16 only; contains officer names/phones; NumOfFatalInjuries, NumOfABCInjuries, LE_GPSCoord_Lat/Long) — old, academic, not recommended; also CMV / young-driver subsets.

### New Hampshire — NOT FOUND
- NHDOT AGOL org 22pI3HyqMrW5cmOh ("State of New Hampshire DOT", 34 services): no crash layers. Only RPC/regional extracts (UVLSRPC "Crash History" 2002-..., route studies), a 511 incidents feed, and a Tufts student 2019 layer.

### Maine — USABLE (2016–2026, all crashes incl. PDO)
- https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44  (NOTE layer id 44)
  item b8dd5e49520d4b7495ad8aa3e547b255 "MaineDOT Crash Locations - 10 Years Complete", owner MaineDOT.IT, org RbMX0mRVOFNTdLzd = "State of Maine" (urlKey maine). Desc: "Point Dataset representing location of crashes from the previous ten years, including current year. Dataset is derived using RLM (Route Log Mile) ... Hosted feature layer view is derived from a hosted feature layer that gets updated weekly on Sunday. Last refreshed on 2026-10-26". Tags MaineDOT/Safety.
  Sibling views (same schema, layer 44): Crashes_Attributes_1_Year_Test_View (2025, 35083), _3_Year_ (101516), _5_Year_ (168183), _10_Year_ (335644 = 2016-2025), _Current_Year_ (23543 = 2026).
- 359,187 rows; distinct CRASH_ID = 359,187 (one row per crash; REPORT_NUMBER not unique: 340,076 distinct).
- Per year: 2016 33302, 2017 34972, 2018 35186, 2019 35249, 2020 28752, 2021 32649, 2022 34018, 2023 33705, 2024 32728, 2025 35083, 2026 23543 (partial, to ~Oct).
- Cumberland env (-70.86,43.53,-69.84,44.06): 102,462 (COUNTY_NAME='Cumberland': 85,030).
- Fields: CRASH_ID (str 'YYYY-n'), ACCIDENT_DATE (Date, local midnight stored 04:00Z/05:00Z -> UTC date == local date), ACCIDENT_DATE_TIME (true UTC), ACCIDENT_YEAR, INJURY_LEVEL {'K','A','B','C','PD'} (INJURY_LEVEL_CODE 1..5), NO_OF_K_INJ (killed), NO_OF_A_INJ, NO_OF_B_INJ, NO_OF_C_INJ, NO_OF_NON_INJ, INJURY_COUNT (= K+A+B+C, includes killed!), PED_YN 'Y'/'N' (2823 Y), BICYCLE_YN 'Y'/'N' (2063 Y), LATITUDE/LONGITUDE (signed; 4 nulls but geometry present), COUNTY_NAME, TOWN_NAME.
- Severity counts (crash-level): K 1651, A 6808, B 29215, C 48313, PD 273200. Killed sums/yr: 2016 157 ... 2024 188, 2025 174.
- persons injured = NO_OF_A_INJ+NO_OF_B_INJ+NO_OF_C_INJ (or INJURY_COUNT-NO_OF_K_INJ).
- maxRecordCount 2000; Web Mercator; dataLastEditDate 1793004181794 (2026-10-26 08:43 UTC).

### Rhode Island — NOT FOUND
- RIDOT AGOL org JfTJE9T2RFfUZzVx ("Rhode Island Department of Transportation", services5, 44 services): no crash layers. Nothing else statewide in AGOL search (only consultant safety-project layers by VHB).

### Montana — EXISTS BUT NOT ON AN ALLOWED HOST
- MDT item 13d4ffddc9cd4eadb7e8d41c342573f8 "Public Crash Information" (owner U8161@mt.gov_mdt, org dKlvxNSUvl36IGMp "Montana Department of Transportation"): "MDT Public Crash Information from 2016-2025" -> https://gis.mtmdt.us/server/rest/services/MDTGIS/Public_Crash_Information/MapServer/0 (not allowed).
- MDT AGOL hosted (services1/dKlvxNSUvl36IGMp, 265 services): only Animal_Crashes_2010_2019 + wildlife analysis.

### Delaware — PARTIAL (DelDOT-hosted static snapshot of Public Crash Data, 2009-01-01..2024-11-30; crash class only, no killed/A counts)
- Official source: FirstMap@De item "Delaware Public Crash Data 2.0" ("De-identified public crash data in Delaware from 2009 through six months ago") at https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Transportation/DE_Public_... -> NOT allowed host (also apps.firstmaptest.delaware.gov DelDOT/DE_ODP_CRASH_DATA).
- Allowed-host copy: https://services1.arcgis.com/bQ68YUVG6MKPIQ8f/arcgis/rest/services/Crash_Data/FeatureServer/0 ("PublicCrashData_CopyFeatures"), item e8b966ce5bbe43c7b98e868dea66c5ab "Crash Data", owner deldot.allen (DelDOT org bQ68YUVG6MKPIQ8f, same org as nchavan@deldot / slain@deldot), public, NO description, created/modified 2025-06-05 (dataLastEdit 1749136475485) -> one-off copy, not refreshed.
- 539,945 rows; Year: 2009 19118 (partial?), 2010 31272, 2011 31066, 2012 31232, 2013 32450, 2014 32739, 2015 35015, 2016 36955, 2017 37145, 2018 37495, 2019 37437, 2020 31664, 2021 37762, 2022 37439, 2023 37253, 2024 33903 (to Nov 30).
- No crash ID field (OBJECTID only); (CRASH_DATETIME,LAT,LON) distinct = count for 2023 -> appears 1 row/crash.
- CRASH_CLASS/CRASH_CLASS_DESC: '01' Non-Reportable 148719, '02' Property Damage Only 304695, '03' Personal Injury Crash 84810, '04' Fatality Crash 1692, + ~30 junk codes. NO killed count, NO serious-injury (A) info, NO injured count.
- PED_INVOLVED 'Y'/'N' (7143 Y), BIKE_INVOLVED 'Y'/'N' (3093 Y); LATITUDE/LONGITUDE (signed); CRASH_DATE (00:00Z = local date); CRASH_DATETIME (local time labelled UTC); COUNTY_DESC Kent/New Castle/Sussex.
- New Castle env (-75.79,39.36,-75.47,39.84): 310,021 (COUNTY='N': 320,644).
- Other DelDOT hosted: DelDOT_Ped_Crashes_2019toPresent (682 ped crashes), AllBikeAccidents2010toDecember2022 (2341). DELDOT_CRASHDATA_POINT is empty (0 rows).
- Consultant copies: JMT Delaware_Public_Crash_Data_2_0 (1,005,262 rows - likely duplicated), KLF copy (482,970).

### South Dakota — PARTIAL (all crashes, statewide, rolling window 2021-11-05..2026-10-29; ped/bike combined; killed/A counts only via person table)
- https://services1.arcgis.com/PwrabBhZHUggYYSp/arcgis/rest/services/AR_Crashes_(view_layer)/FeatureServer/0  (URL-encode parens as %28 %29)
  + table .../FeatureServer/16 "AR_Persons" (145,048 persons; AccidentSeqID join key)
  item 4b42531e4b5e444b886766d0cdd4a3eb "AR Crashes (view layer)", owner dps.gis.coord (SD Dept of Public Safety GIS coordinator), org PwrabBhZHUggYYSp (State of South Dakota / sdbit), snippet "Accident Records crashes for dashboard", tags ar, crashes. (Twin: AR_Crashes_(filtered_export_data_) item a2fe33c5034543df9219fce3001a47e3.)
- Official SDDOT crash layer (used by SDDOT "Local Roads Map Viewer") is https://sdgis.sd.gov/dot/rest/services/TIM/DOT_Crashes/FeatureServer/0 -> not allowed host.
- 88,645 rows; distinct AccidentNbr 88,643 (≈1 row/crash). AccYear: 2021 3755 (from Nov 5), 2022 18728, 2023 18898, 2024 18847, 2025 19001, 2026 9416 (to Oct 29).
- InjurySeverity (crash-level): 'Fatal injury' 605, 'Incapacitating' 2274 (=A), 'Non-incapacitating' 6966 (B), 'Possible' 7109 (C), 'No injury' 49743, 'Wild animal hit' 21025 (short-form animal PDO; attributes like 'Wild animal hit - damage only'), 'Not applicable' 644, 'Not reported' 52, 'Unknown' 227.
- PedOrCycle 'Y'/'N' (1026 Y) — pedestrian and bicycle NOT separable. No killed/injured counts on crash layer.
- AR_Persons: InjuryStatusTxt {'Fatal injury' 669, 'Incapacitating' 2847, 'Non-incapacitating' 9245, 'No Injury' 132287} (no 'Possible' person category!) -> killed/A per crash via groupBy AccidentSeqID.
- Dates: AccidentDateTime = local time labelled UTC (TimeOfDay matches); Date2 = true UTC. AccYear int. Lat/lon: point geometry only (Web Mercator; use outSR=4326) — no lat/lon attribute fields.
- Minnehaha env (-97.13,43.50,-96.45,43.94): 29,581. maxRec 2000. dataLastEditDate 1793832161488 (2026-11-04 22:42 UTC).

### North Dakota — EXISTS BUT NOT ON AN ALLOWED HOST
- NDDOT crash data is served by NDSU-UGPTI (NDDOT's data partner) at https://dotsc.ugpti.ndsu.edu:6443/arcgis/rest/services/NDDOT_crash/{nddot_crash_history, ND_Recent_Crashes, Rural_Crashes_2017_to_2025}/FeatureServer -> not allowed (used by NDSU dashboards "ND County Crash Dashboard" 93a0ca93..., "North Dakota Recent Crashes" 17f88a57...).
- State of North Dakota AGOL org GOcSXpzwBHyk2nog (NDGOV, 193 services): no crash layers. NDSU org hDXM0jVzBTOKdR4i: only DUI-crash/student layers. Bismarck-Mandan MPO (BMI) has regional bike/ped crashes since 2017.

### District of Columbia — PARTIAL on allowed host (fatalities only, person-level); full crash layer EXISTS BUT NOT ON AN ALLOWED HOST
- Official all-crash layer: DCGISopendata item 70392a096a8... "Crashes in DC" -> https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Public_Safety_WebMercator/MapServer/24 (+ table 25 "Crash Details"), also DDOT/VisionZero FeatureServer on maps2.dcgis.dc.gov -> NOT allowed host.
- Allowed host: https://services.arcgis.com/neT9SoYxizqTHZPH/arcgis/rest/services/DC_Traffic_Fatalities_2011_YTD_1/FeatureServer/0 (layer "survey"), item a223064795034482b3fd4308883c32b8 "CrashData_View_Dashboard_1", owner rafael.moreno@dc.gov_DCGIS, org neT9SoYxizqTHZPH = "City of Washington, DC" (DCGIS); no description; used by DC Vision Zero fatalities dashboard. dataLastEdit 1793820662971 (2026-11-04 19:31 UTC). SR 4326, maxRec 1000.
  531 rows = one per FATALITY (person), 483 distinct ccn (crash complaint number) -> group by ccn for crashes. death_case = 2-digit year ('11'..'26'): 2011 32, 2012 19, 2013 29, 2014 26, 2015 26, 2016 28, 2017 30, 2018 36, 2019 27, 2020 37, 2021 40, 2022 35, 2023 52, 2024 52, 2025 25(?), 2026 36.
  Fields: datetime (Date), fatality_perso {'pedestrian_ped_','bicyclist_bic_','driver','passenger','motorcyclist_moped_mo_','personal_mobility_device_pmd_',...}, vehicle_type, ccn, ward, hit_and_run, age_years, sex; point geometry (no serious-injury data).
- Other DC hosted: DC_Crashes_2018___ARCGIS_Pro_Essentials_WFL1 (training copy, 2018 only, 26559), corridor crash layers.

### Vermont — PARTIAL (all crashes 2010–2026 statewide, but severity only Fatal/Injury/PDO; no killed/A/injured counts; single 'Involving' category)
- https://services1.arcgis.com/NXmBVyW5TaiCXqFs/arcgis/rest/services/CrashPQT/FeatureServer/0 ("CrashQueryToolData"), item 8de17645f63a4516a524fe7eb00aaf90 "CrashPQT", owner mlofgren, org NXmBVyW5TaiCXqFs = "VTrans" (urlKey VTrans); snippet "Crash, PQT, VT, Public Query Tool, Vermont" (backs https://apps.vtrans.vermont.gov/crashpqt per Jack_Evans item 87b5aa65...). dataLastEdit 1793951558326 (2026-11-06) — refreshed ~daily (max ACCIDENTDATE 2026-11-05).
- 182,835 rows; distinct (REPORTNUMBER, REPORTINGAGENCYid) = 182,835 (1 row/crash; REPORTNUMBER alone 182,267).
- Per year (ACCIDENTDATE): 2010 11200, 2011 12647, 2012 11649, 2013 13798, 2014 12731, 2015 14113, 2016 12657, 2017 12669, 2018 10272, 2019 13552, 2020 10549, 2021 10533, 2022 8433, 2023 7177, 2024 7064, 2025 7636, 2026 6032 (to Nov 5). NOTE big drop from 2022 = InjuryType-null rows (~2000-3800/yr before 2022, ~100/yr after) disappear; Fatal/Injury/PDO counts stable.
- InjuryType {'Fatal' 987, 'Injury' 32637, 'Property Damage Only' 124698, null 24348, '' 165}. Fatal crashes ~57-73/yr.
- Involving (single value) {'Pedestrian' 2083, 'Bicycle' 1342, 'Motorcycle' 2689, 'Heavy Truck' 8867, 'None' 144296, 'NULL' 2025, null 21533} -> ped = Involving='Pedestrian', bike = Involving='Bicycle' (cannot capture multi-involvement).
- LATITUDE/LONGITUDE (signed; 3036 null), SR 32145 (Vermont State Plane m) -> use outSR=4326. ACCIDENTDATE Date with time (e.g. 1447241340000) — timezone handling unverified. maxRec 2000.
- Chittenden env (-73.45,44.30,-72.80,44.70): 65,385.
- Consultant copy with KABCO: VHB "Crash Query Tool Data With Vtrans Injury Severity" services1/9lDFdeC4JIBgML6L (10-yr, 112,087 + severities table) — not official.

### Wyoming — NOT FOUND
- WYDOT AGOL org WI04Bd6haCzitbuQ ("WYDOT", services2, 116 services): only corridor study crash layers (Crash_Map_WFL1/Crash_Map2: Sheridan-Coffeen 203, I25-I80 398, US89 193). No statewide layer; WYDOT crash data not published as GIS (Casper city item points to WYDOT_Crash_Data 2004-2014 on a private 10.x IP).

## Second-pass corrections / extra evidence (Rutgers "United States Crash Data Database" index, services1/ze0XBzU1FXj94DJq "Crash Database" layer)
- Arkansas -> reclassify EXISTS BUT NOT ON AN ALLOWED HOST (dashboard only): ARDOT crash dashboard on ARDOT Enterprise portal https://gis.ardot.gov/portal/apps/dashboards/3ae35f942fa340888abd27f26d405558 ; raw data "N/A".
- Mississippi: raw eCrash data download at publicdata.dps.ms.gov/Public-CrashData/eCrash/ (not ArcGIS, not allowed host).
- Nebraska: dashboard/map only at ntip.nebraska.gov/Map (not allowed host).
- Kentucky: crashinformationky.org (KSP) dashboard + location search (not ArcGIS REST).
- Louisiana: carts.lsu.edu dashboards only. Nevada/RI/WV/WY: "Data is not Public" per index.
- Iowa extra: item 628dd609ce4148b3820c5b5f326f7bbc "Crash_Data" File Geodatabase (84 MB zip) IS on www.arcgis.com (/sharing/rest/content/items/<id>/data) but last modified 2020-11-06 (stale) and not a query endpoint.
- Utah timestamp check: 0 crashes stored in the non-existent local hour 02:00-02:59 on DST spring-forward days 2021-2025 -> confirms crash_datetime = local wall-clock labelled +00:00. Year-boundary gap confirmed: e.g. 2024 layer has 19 recs on stored 2024-12-31 (all < 07:00) vs 137 on 12-30; 2025 layer has 0 recs before 2025-01-01 07:00.
- Mappings verified: UT 'Suspected Serious Injury' crashes all have number_four_injuries>0 (1523/1524), Fatal crashes == number_fatalities>0 (251); ME INJURY_LEVEL 'A' == NO_OF_A_INJ>0, 'K' == NO_OF_K_INJ>0. Pagination (resultOffset) works on UT and ME.
- NM VRU: distinct (DATE_OF_CRASH,LAT,LON) = 8868 = count (no dupes).

## SUMMARY TABLE
| State | Status | Allowed-host layer |
|---|---|---|
| Iowa | EXISTS, NOT ALLOWED HOST | gis.iowadot.gov/agshost .../Traffic_Safety/Crash_Data |
| Utah | USABLE 2019-2026 | services.arcgis.com/pA2nEVnB6tquxgOW/.../Utah_Crash_Locations/FeatureServer/0-7 |
| Louisiana | NOT FOUND | - |
| Kentucky | NOT FOUND | - |
| Oregon | PARTIAL fatal-only 2024-26 | services.arcgis.com/uUvqNMGPm7axC2dD/.../InitialFatalPublic/FeatureServer/0 |
| Oklahoma | PARTIAL KAB 2017-21 | services2.arcgis.com/1RKb5IC5HFxsUYMS/.../kab_crashes_YYYY |
| Connecticut | EXISTS, NOT ALLOWED HOST | gis.cti.uconn.edu Crash_Dashboards |
| Nevada | NOT FOUND | - |
| Arkansas | EXISTS (dashboard), NOT ALLOWED HOST | gis.ardot.gov portal |
| Kansas | PARTIAL KA 2016-2024 | services1.arcgis.com/q2CglofYX6ACNEeu/... |
| Mississippi | NOT FOUND (raw download elsewhere) | - |
| New Mexico | PARTIAL VRU injury 2013-23 | services.arcgis.com/hOpd7wfnKm16p9D9/.../VRU_crashes/FeatureServer/0 |
| Nebraska | NOT FOUND | - |
| Idaho | EXISTS, NOT ALLOWED HOST | gis.itd.idaho.gov/arcgisprod |
| West Virginia | NOT FOUND | - |
| New Hampshire | NOT FOUND | - |
| Maine | USABLE 2016-2026 | services1.arcgis.com/RbMX0mRVOFNTdLzd/.../Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44 |
| Rhode Island | NOT FOUND | - |
| Montana | EXISTS, NOT ALLOWED HOST | gis.mtmdt.us |
| Delaware | PARTIAL (static copy 2009-2024, class only) | services1.arcgis.com/bQ68YUVG6MKPIQ8f/.../Crash_Data/FeatureServer/0 |
| South Dakota | PARTIAL (2021-11..2026-10, ped/bike combined) | services1.arcgis.com/PwrabBhZHUggYYSp/.../AR_Crashes_(view_layer)/FeatureServer/0 |
| North Dakota | EXISTS, NOT ALLOWED HOST | dotsc.ugpti.ndsu.edu:6443 |
| DC | PARTIAL fatalities only (full = not allowed host) | services.arcgis.com/neT9SoYxizqTHZPH/.../DC_Traffic_Fatalities_2011_YTD_1/FeatureServer/0 |
| Vermont | PARTIAL (all crashes 2010-26, F/Inj/PDO only) | services1.arcgis.com/NXmBVyW5TaiCXqFs/.../CrashPQT/FeatureServer/0 |
| Wyoming | NOT FOUND | - |
