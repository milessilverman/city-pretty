# Crash research A (PA, OH, NJ, WA, AZ, MA, TN, IN, MD, MO, WI, MN, SC, AL)
Started 2026-11-07. Notes updated incrementally.

## PENNSYLVANIA -> USABLE (2019-2023, month precision only) + PARTIAL extra (2017-2021 w/ exact date but duplicated rows)
Org: PennShare (AGOL orgId jOy9iZUXBy03ojXb, owner 'pennshare'), PennDOT Planning & Programming org ("Welcome to PennShare - a one stop shop for your Planning and Programming maps... PennDOT").
A) https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8  (item b856c0aff0284c82b4770840a6e8cc2d, no description)
 - point, SR 102100; DEC_LAT/DEC_LONG double (4 decimals), also LATITUDE/LONGITUDE DMS strings ("39 59:00.573", no minus). 0 rows null/0 DEC_LAT.
 - maxRecordCount 2000; dataLastEditDate 2024-06-05; 573,118 rows = 1 row/crash (2019 distinct CRN 124,879 == rows).
 - years: 2019 124,879; 2020 104,363; 2021 117,798; 2022 115,877; 2023 110,201. ALL reportable crashes (PDO included).
 - NO day-of-month: CRASH_YEAR (int), CRASH_MONTH (int), DAY_OF_WEEK, HOUR_OF_DAY, TIME_OF_DAY (hhmm). -> date only 'YYYY-MM'.
 - id CRN; killed FATAL_COUNT; serious SUSP_SERIOUS_INJ_COUNT; injured TOT_INJ_COUNT (also INJURY_COUNT, SUSP_MINOR_INJ_COUNT, POSSIBLE_INJ_COUNT); PED_COUNT>0; BICYCLE_COUNT>0 (also PED_DEATH_COUNT, PED_SUSP_SERIOUS_INJ_COUNT, BICYCLE_DEATH_COUNT...)
 - MAX_SEVERITY_LEVEL int: 0 (299,264) PDO,1 killed (5,413),2 susp serious (19,968),3 minor (129,751),4 possible (41,915),8 inj unk sev (56,566),9 unknown (20,241)
 - counts: PED_COUNT>0 16,588; BICYCLE_COUNT>0 4,500; FATAL_COUNT>0 5,417; SUSP_SERIOUS>0 20,826; TOT_INJ>0 250,295
 - COUNTY = PennDOT 2-digit county code int (2=Allegheny: 55,805); COUNTY_NAME/FIPS_COUNTY_CODE all NULL.
 - Allegheny envelope (-80.361,40.191,-79.688,40.674): 64,235
B) https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/Crashes_2017_to_2021/FeatureServer/0 (item 70daec9cb36a426a9f3b5ae8cf069de2: "Feature layer of all crashes in Commonwealth of Pennsylvania from 2017 to 2021. Data provided by PennDOT's Safety Team.")
 - 949,384 rows but DUPLICATED (identical rows repeated per CRN, ~1.6x): 2017 201,840 rows/128,432 CRN; 2018 201,786/128,531; 2019 197,883/125,422; 2020 162,019; 2021 185,856
 - has CRASH_DATE (Double yyyymmdd e.g. 20190107), CRASH_YEAR/CRASH_MONT/DATE_OF_MO strings; FATAL_COUN, MAJOR_INJU(?), SUSPECTED_ (susp serious?), TOT_INJ_CO, PEDESTRIAN 0/1, BICYCLE 0/1, MAX_SEVERI string ('Not injured','Suspected Minor Injury','Injury/ Unknown Severity',...), COUNTY string '02'
 - dataLastEditDate 2023-03-30. Useful for 2017-2018 (dedupe by CRN).
Not on allowed host: yearly statewide CDART zips 2004-2024 at gis.penndot.gov/gishub/crashZip/Statewide/Statewide_<yr>.zip (listed in services1.../2024_Final_CDART_STATEWIDE_URLs/FeatureServer/12); PCIT crashinfo.penndot.pa.gov.

## OHIO -> EXISTS BUT NOT ON AN ALLOWED HOST
 - ODOT (ohiodot.maps.arcgis.com, orgId 1AlElnGrgBM62OSj, services1.arcgis.com/1AlElnGrgBM62OSj) has 519 public services but NO statewide crash point layer; only truck_crashes_2021_2025 (subset), Storymap_Data_gdb/11 "Truck Crash Trends (2019-2024)", predicted-crash STS/RSTS layers.
 - Official statewide yearly crash points are on ODOT TIMS: https://tims.dot.state.oh.us/ags/rest/services/Safety/<YYYY>_Crash_Locations/MapServer/0 (2020..2024 referenced by ODOT web map 8d2350cb98b146339a6af7353c61f94e). Also odotgis.dot.state.oh.us D07/D06 crash services. NOT allowed hosts.
 - Copies on allowed hosts are unofficial: Cuyahoga County Planning "ODOT - Crash Inventory (PROD)" services8.arcgis.com/1cKSe8lh4duMZ8W0/.../ODOT_Crash_Inventory (Cuyahoga only, SR 3734); UC student uploads services8.arcgis.com/WQtGT9bHpwcYeBTA/.../2022|2023|2024_Crash_Locations_shp; MORPC 10-county.

## NEW JERSEY -> PARTIAL (ped+bike crashes only, year only) ; all-crash data EXISTS BUT NOT ON AN ALLOWED HOST
 - NJDOT AGOL org (owners NJDOTGIS / Archive_NJDOT, orgId HggmsDF7UJsNN1FK, services.arcgis.com/HggmsDF7UJsNN1FK): no all-crash layer.
 - https://services.arcgis.com/HggmsDF7UJsNN1FK/arcgis/rest/services/PedestrianCrashData2017to2024/FeatureServer/0 (item d4ec45418c4e462b8b1da0f669bf20ff, owner Archive_NJDOT, no description)
   38,806 rows; Year only (int), no date, no id, no killed/injured counts. 2017 5,827; 2018 5,691; 2019 6,543; 2020 4,738; 2021 4,283; 2022 5,567; 2023 5,141; 2024 1,016 (partial).
   Crash_Type 'Pedestrian' 24,684 / 'Pedalcyclist' 12,080 / others ~2k. Severity: Fatality/Injury/Property Damage Only. Severity_R KABCO strings: 'Fatal Injury' 1,416,'Suspected Serious Injury' 3,370,'Suspected Minor Injury' 12,869,'Possible Injury' 15,354,'No Apparent Injury' 5,797.
   Latitude/Longitude doubles (WGS84) + point geom. maxRecordCount 2000. dataLastEditDate 2025-01-03. County string 'ESSEX' 6,630.
 - .../bikepedcrashespointonemi/FeatureServer/0: 22,822 bike/ped crashes 2017-2024 (subset, '0.1 mi' corridor?), has Crash_Iden, Occurrence (date), Total_Kill, Total_Inju, Pedestri_1, Cyclist_In, Severity_R. dataLastEdit 2025-04-21.
 - All-crash NJDOT crash records: text files on nj.gov (state.nj.us/transportation/refdata/accident) - not allowed host.

## WASHINGTON -> EXISTS BUT NOT ON AN ALLOWED HOST (no official statewide crash points on allowed hosts)
 - WSDOT AGOL org IYrj3otxNjPsrTRD (217 public services): only Collisions_SR_Legacy_2019_Aug2024_BlockGroups (block-group summary of state-highway collisions; aggregated polygons).
 - WSDOT Crash Data Portal: remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/ (not allowed). data.wsdot.wa.gov ArcGIS server (not allowed).
 - WA DOL (state agency) services7.arcgis.com/yraBoJ85dcNGKtSl/.../layers_gdb/FeatureServer/0 "2015-2025 MC Crash Map Layer": MOTORCYCLE crashes only, unit/person-level rows; dataLastEdit 2026-09-06. Not useful.
 - City copies only (Seattle SDOT Collisions, Vancouver wsdotTrafficCollisionsFS_NEW, Tacoma) - not statewide.

## ARIZONA -> EXISTS BUT NOT ON AN ALLOWED HOST (current official layers are on services6.arcgis.com, which is blocked: proxy 403 connect_rejected)
 - AZGeo org clPWQMwZfdWn4MQZ (ADOT-run): owner ADOTSafetyTeam_azgeo item 1133a0fc2d3e4e7f85b5ebbc1347ee63 "Incident_Sev54": "2016 to 2025 AZ statewide fatal and serious injury crashes. Data source: ASCIDM 07/28/2026" -> https://services6.arcgis.com/clPWQMwZfdWn4MQZ/arcgis/rest/services/Incident/FeatureServer (KA only); Person_Sev54 (persons); mpdgisdataviz_azgeo "2018 to 2023 ReGeocoded Crashes" services6 .../2018_to_2023_ReGeocoded_Crashes. ACIS Route Explorer at gis.azdot.gov (not allowed).
 - On allowed host (ADOT org XAiBIVuto7zeZj1B, services1): only old Fatal_Crashes_2012_16 (3,907) and SeriousInjuryCrashes_2012_2016 (17,201), last edited 2017 -> useless for 2016-2025.

## MASSACHUSETTS -> EXISTS BUT NOT ON AN ALLOWED HOST
 - MassDOT AGOL org ceiitspzDAHrdGO1 (owner massDOT_GIS) registers yearly statewide crash layers, but they live on MassDOT servers:
   https://gis.crashdata.dot.mass.gov/arcgis/rest/services/MassDOT/MASSDOT_ODP_OPEN_<YYYY>/FeatureServer/0 (crash), /1 vehicle, /2 person (2021,2022,2023v,2024,2025,2026 seen);
   2020 and earlier: https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/CrashClosedYears/FeatureServer/0. NOT allowed hosts.
 - On services1.arcgis.com/ceiitspzDAHrdGO1 (898 services) only subsets: VRU_Map_Final_WFL1/1 "Non-Motorist KA Crashes, 2016-2020", CrashComparison (200 pts), crashes_NotCovered_* (110 pts), PedCrashes2010to2014, deer collisions, RPA (PVPC, SRPEDD) regional uploads.
 - Boston Region MPO (services1.arcgis.com/jIRgb54Jq9V3BUeD VZDashboard_Crashes_Spatial: injury crashes Boston region 2018-2026) - regional, not state.

## TENNESSEE -> USABLE (TDOT all crashes 2021-2024 + Jan 2025) ; plus TDOSHS TITAN injury crashes 2021-2025 with ped/bike flags
A) TDOT: https://services2.arcgis.com/nf3p7v7Zy4fTOh6M/arcgis/rest/services/Tennessee_Crashes_JAN_2021_JAN_2025/FeatureServer/0
 - item 9a25e06f713a4a1688bec0a9cb2bc582, owner TDOT_GIS (TDOT org: TDOT Administrative Boundaries, SmartWay, Road Segment...), accessInformation/copyright "Tennessee Department of Safety"; desc "This data set includes crash data points for the State of Tennessee."; license names TDOT.
 - point, SR 2274 (NAD83 TN State Plane ft) -> use outSR=4326; no lat/lon fields. maxRecordCount 2000. dataLastEditDate 2025-08-13.
 - 763,379 rows, 1 row/crash (2022: 193,471 rows = 193,471 distinct CASENO). ALL reportable crashes incl PDO.
 - years (YEAROFCRAS string): 2021 196,833; 2022 193,471; 2023 184,844; 2024 179,966; 2025 8,265 (Jan only; 1 row >= 2025-02-01). DATEOFCRAS Date (midnight UTC, min 2021-01-01), TIMEOFCRAS hhmm number.
 - id CASENO (double); killed TOTALKILLE; serious TOTAL_INCA ("Total Incapacitated"); injured TOTALINJUR (incl. incapacitated; only 3 rows TOTALINJUR<TOTAL_INCA); TOTAL_OTHE.
 - TYPEOFCRAS crash severity: 'Fatal' 4,979; 'Suspected Serious Injury' 19,442; 'Suspected Minor Injury' 73,233; 'Possible Injury' 80,645; 'Prop Damage (over)' 501,472; 'Prop Damage (under)' 83,608.
 - NO ped/bike flags: only FIRSTHARMF 'Pedestrian' (5,414) / 'Pedalcycle' (1,464) / 'Other Type Non-Motorist' (199) as proxy.
 - county NBR_TENN_C name upper ('DAVIDSON' 104,764). Davidson envelope (-87.055,35.967,-86.515,36.406): 128,068.
 - 2023 injury crashes = 44,697 vs TITAN 47,810 (~93%; TDOT layer = crashes located to TDOT road network, LOCATE_TYP Automatic/Manual).
B) TDOSHS TITAN (org 'TITAN', urlKey tnsafety, owner sarah.fielden@tn.gov): injury crashes only (no PDO), 1 row per MRN.
 - https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes__12_03_25_WFL1/FeatureServer/17 ("All Pulled Crash Records"; snippet "(Updated weekly)..."): 2023 47,810; 2024 45,529; 2025 41,489 (to 2025-12-02); 3 rows year 0. dataLastEdit 2025-12-03.
 - https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes__07_18_23_WFL1/FeatureServer/17: 2021 48,226; 2022 47,542; 2023 24,960 (partial). (no Lat/Long double fields; Latitude/Longitude strings + geometry)
 - fields: MRN (string id), Fatality (int killed), Injury (STRING count injured), Crash_Type ('Fatal','Suspected Serious Injury','Suspected Minor Injury','Possible Injury'), Pedestrian ('Pedestrian' or '-'), Pedalcyclist ('Pedalcyclist' or '-'), Collision_Date string 'YYYY-MM-DD hh:mm:ss.000', Collision_Year/Month/Day ints, Lat/Long doubles (12_03_25 only), Latitude/Longitude strings. No count of A-injured persons.
 - quirks: 4 rows Long>0, 36 rows Long null/0. Davidson envelope: 29,474 (12_03_25).
C) TDOT .../Tennessee_Bicycle_Pedestrian_Crashes/FeatureServer/0: PERSON-level ped/bike rows 2015-2025 (19,529), year only, no crash id -> weak.

## INDIANA -> NOT FOUND (no official statewide crash layer on allowed hosts)
 - INDOT AGOL org m0skr7SJ35eSV0W6 (services.arcgis.com/m0skr7SJ35eSV0W6, 53 public services): no crash points (INDOT_ARIES_SUPPORT_DATA = ramps + reference posts only).
 - IndianaMap content is on gisdata.in.gov (not allowed); INDOT gis.indot.in.gov (not allowed). Official ARIES crash data is distributed via Indiana Data Hub / MPH (hub.mph.in.gov) - not allowed host (not verified from here).
 - Only non-state copies: Indianapolis MPO (services5.arcgis.com/qVN2o0aio8BMbwcJ: central-IN KA crashes 2018-2025, bike/ped 2022-2025), consultants (CamSys statewide ped/bike crash subsets for INDOT VRU analysis on services2.arcgis.com/d0NFID1O0ng4wccB), Esri PS demo for MPH (2016, Esri PS MEA org hUPR9iC6qnMcwWsa) - not official.

## MARYLAND -> PARTIAL (all crashes 2019-2026 with date+point, but severity only Fatal/Injury/PDO, no counts, no ped vs bike; non-motorist flag missing 2021-2022)
 - Org "ArcGIS Online for Maryland" (urlKey maryland, orgId njFNhDsUCentVYJW = State of Maryland enterprise AGOL; 5,530 public services).
 - https://services.arcgis.com/njFNhDsUCentVYJW/arcgis/rest/services/Crash_Data_Maryland/FeatureServer/1 (layer id 1!)
   item 9893d6f928b64c6eaa6705ae4afb3e72 "Crash Data Maryland", owner andrew.bernish = "Andrew Bernish (TSO)... Senior GIS Planner with the KFH Group currently assigned to the Maryland Department of Transportation in the Transportation Secretary's office"
   snippet: "Crash Data January 1, 2019 through August 17, 2026 (clipped to MD). From https://zerodeathsmd.gov/resources/crashdata/crashdashboard/" (MDOT MVA Highway Safety Office dashboard data; MSP ACRS origin).
 - SR 2248 (MD State Plane ft) but has Latitude/Longitude doubles (WGS84; 0 null/0). maxRecordCount 2000. dataLastEditDate 2026-08-18.
 - fields: Report_Number (str; ONLY populated 2024-2026 [unique] + the non-motorist rows of 2019/2020/2023), Type_of_Crash ('Fatal Crash','Injury Crash','Property Damage Crash'), Non_Motorist_Crash ('Yes'/'No'), Crash_Date (DateOnly 'YYYY-MM-DD'), Crash_Time 'HH:MM', Crash_Year int, Day_of_Week, County (e.g. 'Montgomery'), Latitude, Longitude.
 - years: 2019 114,715; 2020 95,651; 2021 108,876; 2022 108,316; 2023 110,273; 2024 108,060; 2025 102,939; 2026 60,145 (to 2026-08-17). ALL crashes incl PDO.
 - Fatal crashes/yr: 517,567,541,556,594,569,459,194. 2022: Fatal 556 / Injury 28,040 / PDO 79,720.
 - Non_Motorist_Crash='Yes': 2019 4,436; 2020 3,503; 2021 0 (!); 2022 0 (!); 2023 4,454; 2024 4,287; 2025 4,167; 2026 2,595.
 - no killed count, no serious(A), no injured count, no ped vs bike split. No dupes found (Talbot 2022: 759 rows = 759 distinct date/time/lat/lon). Montgomery envelope (-77.53,38.93,-76.89,39.36): 142,659; County='Montgomery' 92,648.
 - companion: .../Safety_Crash_Points/FeatureServer/28 (charles.rudder; "Crash records from Maryland State Police. Prepared by Renaissance Planning Group for MDOT SHA"): 45,586 F&SI-labelled points 2019-2023 (9,718/8,024/9,254/8,890/9,700), Reporttype Fatal/Injury, FlagFatal 1/0, FlagPedes, FlagBike, TYPE MOTOR/VRU, Crashdate (Date at 05:00 UTC = local midnight). Only 204 fatal in 2022 vs 556 statewide -> a SUBSET (unclear which; possibly SHA roads); no crash id -> can't join.
 - Not on allowed hosts: MSP crash data opendata.maryland.gov (Socrata) / mdsp.maryland.gov CrashDataDownload; MDOT SHA maps.roads.maryland.gov OOTS/FatalCrash_Maryland_MDOTSHA.
 - Washington College GIP (washcoll org utBig56dGaw25bwu; MHSO partner, not a state agency): services2.arcgis.com/utBig56dGaw25bwu/.../Maryland_Crash_Points "Maryland Crashes from 2018 to 2023" - not checked in depth (unofficial).

 - (unofficial but richer) Washington College GIP for MHSO: https://services2.arcgis.com/utBig56dGaw25bwu/arcgis/rest/services/MSP_MHSO_Crash_Layer_Overall/FeatureServer/0 "MSP_MHSO_Report": 657,508 crash reports 2018-2023 (118,149/116,051/95,666/108,924/108,528/110,190), SR 4326, Reportnumber, Crashdate, Latitude/Longitude, Reporttype (Fatal/Injury/PDO), TotalFatals, TotalInjs, PedestrianFatals, BicyclistFatals, FlagPedes, FlagBike, NonMotoristCount; no A-injury count. dataLastEdit 2024-04-30. Owner wc_mhso (Washington College org, not a state agency).

## MISSOURI -> NOT FOUND (official) on allowed hosts; EXISTS BUT NOT ON AN ALLOWED HOST (MSHP)
 - MSHP AGOL org k8d7zDfNErR3lpOh (services.arcgis.com/k8d7zDfNErR3lpOh): 5 services, none crash. MSHP crash map/data: mshp.dps.missouri.gov/TR15Map/index.jsp and TR15Reports (not allowed).
 - No MoDOT AGOL crash layer found (MoDOT has no obvious public AGOL org; MSDIS (Mizzou) hosts MoDOT roads only). Only MPO/consultant/city copies (OTO crash_export, EWG Crashes, MARC SS4A via utility.arcgis.com, Wilson Co. KA 2019-23, TREKK modot_crash_data) - not official statewide.

## WISCONSIN -> EXISTS BUT NOT ON AN ALLOWED HOST
 - WisDOT AGOL org 0pgGLzT0Nh7FVjon (owner WisDOTAdmin; services5.arcgis.com/0pgGLzT0Nh7FVjon, 93 services): no crash layer; WisDOT hosts most layers on dotmaps.wi.gov (not allowed).
 - Official crash data = WisDOT/UW TOPS Lab "Community Maps": communitymaps.wi.gov/crash / transportal.cee.wisc.edu (not allowed). Only RPC/consultant/student copies on allowed hosts (ECWRPC Crashes 2021-2025, SEWRPC 2023, SmithGroup Community_Maps_Crash_Data_2024 subset, UWM student layers).

## MINNESOTA -> PARTIAL (official MN DPS layer, all crashes, but only 2025-01-01 onward; rolling/daily)
 - Org "Minnesota Department of Public Safety" (urlKey mndps, orgId V12PKGiMAH7dktkU). Item b2621faefa7c4c569af6852c8ad621e3 "v_crash_rsic_2025on", owner will.butler1: "crash incident records for roadway safety analysis ... statewide roadway incident analysis".
 - https://services2.arcgis.com/V12PKGiMAH7dktkU/arcgis/rest/services/v_crash_rsic_wb/FeatureServer/0  maxRecordCount 1000 (!). SR 3857 + latitude/longitude doubles. dataLastEditDate 2026-11-06 (updated ~daily).
 - 114,711 rows = 114,711 distinct acn (1 row/crash). crash_date DateOnly 2025-01-01..2026-11-05: 2025 64,265; 2026 50,446 (YTD). ALL crashes incl PDO.
 - fields: acn (id), incident_id, crash_date (DateOnly 'YYYY-MM-DD'), crash_timestamp, crash_severity ('Killed' 655,'Suspected Serious Injury' 3,159,'Suspected Minor Injury' 11,764,'Possible Injury' 17,681,'No Apparent Injury' 81,452), fatality_count, injured_count, nonmotorist_involved ('Pedestrian-involved' 2,138 / 'Bicyclist-involved' 1,558 / 'No pedestrian or bicyclist involved'), nonmotorist_count, person_count, crash_type (first harmful event e.g. 'Pedestrian','Pedalcycle (Bike)'), county ('Hennepin'), city.
 - no count of A-injured persons (crash-level KABCO only). 13 rows lat null/0. Hennepin envelope (-93.77,44.78,-93.17,45.25): 44,585; county='Hennepin' 32,892.
 - Historic 2016-2024 statewide NOT on allowed hosts (MnDOT org qWbGMYB49y8mLbRt has only VRU_Crashes_2016_to_2021 (9,036 VRU, no dates/ids), rail crashes, HIN). MN Crash data portal (mncrash.state.mn.us / MnCMAT) not allowed.

## SOUTH CAROLINA -> PARTIAL (fatal crashes only, 2001 - May 2024); all-crash SCDPS view exists but is NOT queryable
 - SCDPS org (owner SCDPS_Admin, services7.arcgis.com/TdsEnMqzMcTd7pnb, 98 services).
 - https://services7.arcgis.com/TdsEnMqzMcTd7pnb/arcgis/rest/services/TrafficFatalityCount/FeatureServer/0 ("South Carolina Traffic Fatality Count Site Data", owner SCDPS_Admin, public). maxRecordCount 2000, dataLastEditDate 2024-05-24, SR 4326.
   rows ~= distinct ACCNO (1 row per fatal crash, apparently one victim per crash): 2016 940; 2017 925; 2018 969; 2019 928/927; 2020 965; 2021 1,109; 2022 1,019; 2023 961/960; 2024 323 (to 2024-05-22). Range 2001-01-01..2024-05-22.
   fields: ACCNO (crash no), ACCDATE (Date+time), LATDEC/LONGDEC (decimal WGS84; LATITUDE/LONGITUDE are DMS-packed numbers e.g. 345655.65 / -821116.45), COUNTYNAM, FHE_Disp ('PEDESTRIAN', ...), TYPEUNIT ('Pedestrian','Pedalcycle', vehicle types) of the victim, VICTIM_ID, OCCSEX, BELTNAME, CMVInvolved. No killed count per crash, no injuries.
 - https://services7.arcgis.com/TdsEnMqzMcTd7pnb/arcgis/rest/services/Extrnl_Collisions_Collision_Dashboard/FeatureServer/0 (item 6b1c4cc6aa5b4042ab8458a0f24c422b "SCDPS Collisions: SCDPS 2017-2021 Raw Collision Data"): ideal schema (AccidentNumber, CrashDate, NumberOfFatalities, NumberOfInjuries, Suspected_Serious_Injuries, Latitude/Longitude, FirstHarmfulEvent...) but it's a view: returnCountOnly -> 0 and any feature query -> 400 "Cannot perform query. Invalid query parameters." => unusable.
 - SCDOT org (services1.arcgis.com/VaY7cY9pvUYUP1Lf, 1,521 services): only crash-rate segments and project/regional subsets. CMV_24 (SCDPS, 13,467 CMV collisions 2024) subset.

## ALABAMA -> NOT FOUND
 - ALDOT AGOL org LZzQi3xDiclG6XvQ (services.arcgis.com/LZzQi3xDiclG6XvQ, 129 public services): no crash layers. ALDOT GIS servers aldotgis.dot.state.al.us / egisalrs.aldot.gov (not allowed). Statewide crash data lives in CARE/eCrash (Univ. of Alabama CAPS for ALEA/ALDOT) - not public ArcGIS.
 - Only consultant/MPO/student derivatives on allowed hosts (Alta HIN/crash profiles services2.arcgis.com/8uN5i97bMkq2Mzrt, county SS4A maps, UAB student county totals).

## (WA addendum) unofficial mirror: https://services.arcgis.com/gfpXnknjcY6QHKhU/arcgis/rest/services/COVI0012_Crashes_2019to2023/FeatureServer/0 "Washington Vehicle Crashes" (owner kat.plank_deagis; org urlKey 'deagis' - consultant, portal info 403; NOT a state agency). 625,419 crashes 2018-2023 (116,075/111,708/86,378/103,384/103,441/104,433), WSDOT Crash Data Portal export columns: REPORT_NUMBER, DATE 'YYYY-MM-DD' string, TIME, MOST_SEVERE_INJURY_TYPE ('Dead at Scene','Dead on Arrival','Died in Hospital','Suspected Serious Injury',...), F__INJ, F__FAT, F__PEDS, F__BIKES, WA State Plane South X/Y (2010) + point geom SR 4326. dataLastEdit 2024-10-03.
## (OH addendum) ODOT truck_crashes_2021_2025 (services1.arcgis.com/1AlElnGrgBM62OSj/.../truck_crashes_2021_2025/FeatureServer/0): 90,807 truck-involved crashes, 175 fields, SR 54030 - subset only.

## extra checks
 - PA A: sums by year FATAL_COUNT 1,057/1,129/1,228/1,178/1,204 (matches PA official fatalities); SUSP_SERIOUS_INJ_COUNT 4,666/4,437/5,108/4,756/4,781; TOT_INJ>=SUSP_SERIOUS always; geometry == DEC_LAT/DEC_LONG (2,000-row check). MAX_SEVERITY_LEVEL 1 <=> FATAL_COUNT>0 (4 rows level 9), 2 <=> serious, 3 <=> minor.
 - PA B: MAX_SEVERI strings 'Fatal','Suspected Serious Injury','Suspected Minor Injury','Possible Injury','Injury/ Unknown Severity','Not injured','Unknown'; CRASH_DATE 20180101..20181231; no 2016. Allegheny env 2017: 23,468 rows / 14,316 CRN; 2018: 23,086 / 14,263.
 - TN A: TOTALKILLE sums 1,376/1,373/1,384/1,230 (2021-24; ~4% above official TN deaths); TOTAL_INCA 5,976/5,836/6,027/5,788. DATEOFCRAS always midnight UTC & matches YEAROFCRAS; CASENO integer-valued.
 - MN: 2025 fatality_count sum 363, injured 23,522; 2025 severity Killed 342 / Serious 1,678 / Minor 6,185 / Possible 9,463 / None 46,597.
 - NJ ped: Essex envelope (-74.38,40.67,-74.11,40.89) 9,797; County='ESSEX' 6,630.
 - SC fatal: Greenville envelope (-82.76,34.46,-82.15,35.22) 2016+: 1,092; COUNTYNAM='Greenville' 650.
 - All key layers: supportsPagination=true, orderBy, distinct, formats JSON/geoJSON/PBF.

## SUMMARY TABLE
| State | Status | Layer |
| PA | USABLE (2019-2023, month only) + PARTIAL 2017-2021 dup rows | services1 jOy9iZUXBy03ojXb CRASH2019_2023/8 ; Crashes_2017_to_2021/0 |
| OH | EXISTS, NOT ALLOWED HOST | tims.dot.state.oh.us Safety/<YYYY>_Crash_Locations |
| NJ | PARTIAL ped/bike only, year only | services HggmsDF7UJsNN1FK PedestrianCrashData2017to2024/0 |
| WA | EXISTS, NOT ALLOWED HOST (+unofficial consultant mirror) | remoteapps.wsdot.wa.gov ; services gfpXnknjcY6QHKhU COVI0012... |
| AZ | EXISTS, NOT ALLOWED HOST (services6) | services6 clPWQMwZfdWn4MQZ Incident (KA 2016-2025) |
| MA | EXISTS, NOT ALLOWED HOST | gis.crashdata.dot.mass.gov MASSDOT_ODP_OPEN_<YYYY> |
| TN | USABLE 2021-2024 (+Jan 2025) ; + TITAN injury 2021-2025 | services2 nf3p7v7Zy4fTOh6M Tennessee_Crashes_JAN_2021_JAN_2025/0 ; services8 LXsQ6ODUaTWmnnpV TITAN.../17 |
| IN | NOT FOUND | - |
| MD | PARTIAL (all crashes 2019-2026; F/I/PDO only) | services njFNhDsUCentVYJW Crash_Data_Maryland/1 |
| MO | NOT FOUND (MSHP TR15Map not allowed) | - |
| WI | EXISTS, NOT ALLOWED HOST | communitymaps.wi.gov |
| MN | PARTIAL (2025-01-01 onward only) | services2 V12PKGiMAH7dktkU v_crash_rsic_wb/0 |
| SC | PARTIAL fatal-only 2001-05/2024 | services7 TdsEnMqzMcTd7pnb TrafficFatalityCount/0 |
| AL | NOT FOUND | - |
 - TN JOIN: TITAN MRN (string) == TDOT CASENO (double) -> verified: 17 of first 20 TITAN 2023 pedestrian MRNs found as CASENO in TDOT layer with same date/county/severity (16 of 17 had FIRSTHARMF='Pedestrian', 1 'Vehicle in Transport'). So TITAN Pedestrian/Pedalcyclist flags can be joined onto TDOT rows for injury crashes 2021-2025.
