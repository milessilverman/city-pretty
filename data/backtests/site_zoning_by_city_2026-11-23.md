# Station-area sites by the government that zones them (2026-11-23)

7098 sites (app/data/station_sites). Jurisdiction: the site's interior point in the Census TIGER/Line 2024 place outlines; an incorporated place (FUNCSTAT A) zones the site, otherwise it is the county's unincorporated land. `Code on record` = the county parcel service returned a zoning field for the matched parcel (station_sites `p.zn`). `Registered zoning service` = a point-queryable zoning layer already on file for the county (app/app.js `ZONING_SERVICES`, app/data/zoning_standards.json point layers); whether it covers this city is in the audit.

| # | Jurisdiction | County | Sites | Parcel matched | Code on record | Distinct codes | Most common codes (sites) | Registered zoning service for the county |
|---|---|---|---|---|---|---|---|---|
| 1 | New York city | 36047 | 561 | 548 | 548 | 78 | R6 (88), M1-1 (50), PARK (35), R5 (26), R7-2 (25), M3-1 (24), R4 (24), C8-1 (20) ... | none on file |
| 2 | Chicago city | 17031 | 520 | 488 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 3 | Phoenix city | 04013 | 461 | 445 | 441 | 1 | CONTACT LOCAL JURISDICTION (441) | https://services1.arcgis.com/MdyCMZnX1raZ7TS3/arcgis/rest/services/EXLU_2026/FeatureServer/0 |
| 4 | San Diego city | 06073 | 442 | 436 | 303 | 9 | 6 (181), 7 (86), 1 (17), 2 (6), 3 (4), 4 (4), 9 (3), 5 (1) ... | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 5 | Dallas city | 48113 | 440 | 430 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 6 | Houston city | 48201 | 395 | 378 | 0 | 0 | - | none on file |
| 7 | Los Angeles city | 06037 | 337 | 328 | 0 | 0 | - | none on file |
| 8 | Indianapolis city (balance) | 18097 | 144 | 137 | 0 | 0 | - | none on file |
| 9 | Seattle city | 53033 | 140 | 81 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 10 | St. Paul city | 27123 | 97 | 97 | 0 | 0 | - | none on file |
| 11 | Charlotte city | 37119 | 88 | 88 | 0 | 0 | - | https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0 |
| 12 | Denver city | 08031 | 85 | 84 | 84 | 17 | CMX (23), CBD (15), CMP (8), GTR (8), OSA (6), CMS (6), OSB (4), CRX (3) ... | https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_ZONE_ZONING_A/FeatureServer/209 |
| 13 | Miami city | 12086 | 85 | 77 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 14 | Nashville-Davidson metropolitan government (balance) | 47037 | 85 | 85 | 85 | 11 | DTC (48), MUI (8), SP (7), IR (5), CS (5), IG (3), CF (3), RM20 (3) ... | none on file |
| 15 | Irving city | 48113 | 84 | 13 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 16 | Richardson city | 48085 | 83 | 31 | 0 | 0 | - | none on file |
| 17 | Mesa city | 04013 | 77 | 75 | 75 | 1 | CONTACT LOCAL JURISDICTION (75) | https://services1.arcgis.com/MdyCMZnX1raZ7TS3/arcgis/rest/services/EXLU_2026/FeatureServer/0 |
| 18 | Baltimore city | 24510 | 75 | 75 | 64 | 14 | C-2 (18), C-5DC (12), TOD-4 (8), R-8 (8), I-1 (3), C-1 (3), BSC (3), I-MU (2) ... | https://baltegis.baltimorecity.gov/mapping/rest/services/CityView/Zoning_New/FeatureServer/0 |
| 19 | Jacksonville city | 12031 | 73 | 73 | 0 | 0 | - | none on file |
| 20 | Fort Worth city | 48439 | 73 | 68 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 21 | Raleigh city | 37183 | 67 | 67 | 0 | 0 | - | none on file |
| 22 | Tempe city | 04013 | 65 | 65 | 65 | 1 | CONTACT LOCAL JURISDICTION (65) | https://services1.arcgis.com/MdyCMZnX1raZ7TS3/arcgis/rest/services/EXLU_2026/FeatureServer/0 |
| 23 | Clark County (unincorporated) | 32003 | 65 | 60 | 0 | 0 | - | https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/Zoning/MapServer/0 |
| 24 | Redlands city | 06071 | 62 | 62 | 0 | 0 | - | none on file |
| 25 | Riverside city | 06065 | 61 | 61 | 0 | 0 | - | none on file |
| 26 | Federal Way city | 53033 | 61 | 46 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 27 | Redmond city | 53033 | 59 | 44 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 28 | Bellevue city | 53033 | 59 | 43 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 29 | Minneapolis city | 27053 | 58 | 58 | 0 | 0 | - | none on file |
| 30 | Colorado Springs city | 08041 | 53 | 53 | 0 | 0 | - | none on file |
| 31 | Newark city | 34013 | 49 | 49 | 0 | 0 | - | none on file |
| 32 | Portland city | 41051 | 49 | 49 | 48 | 12 | CX (25), CM3 (9), IG1 (5), IH (1), RM1 (1), EG1 (1), CM1 (1), CI2 (1) ... | https://www.portlandmaps.com/arcgis/rest/services/Public/Zoning/MapServer/0; https://www.portlandmaps.com/od/rest/services/COP_OpenData_ZoningCode/MapServer/16 |
| 33 | Addison town | 48113 | 48 | 48 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 34 | El Cajon city | 06073 | 47 | 47 | 39 | 5 | 6 (16), 7 (12), 3 (6), 4 (3), 1 (2) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 35 | National City city | 06073 | 45 | 44 | 13 | 2 | 6 (8), 7 (5) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 36 | Long Beach city | 06037 | 44 | 43 | 0 | 0 | - | none on file |
| 37 | Chula Vista city | 06073 | 42 | 42 | 38 | 4 | 6 (21), 7 (10), 3 (6), 9 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 38 | Austin city | 48453 | 41 | 39 | 0 | 0 | - | https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0 |
| 39 | Los Angeles County (unincorporated) | 06037 | 40 | 37 | 0 | 0 | - | none on file |
| 40 | Pasadena city | 06037 | 40 | 40 | 0 | 0 | - | none on file |
| 41 | Oceanside city | 06073 | 40 | 39 | 26 | 4 | 6 (20), 7 (3), 9 (2), 4 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 42 | El Segundo city | 06037 | 38 | 38 | 0 | 0 | - | none on file |
| 43 | Santa Ana city | 06059 | 37 | 37 | 0 | 0 | - | none on file |
| 44 | La Mesa city | 06073 | 35 | 34 | 23 | 4 | 6 (20), 0 (1), 4 (1), 1 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 45 | Columbus city | 39049 | 35 | 34 | 0 | 0 | - | https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/31 |
| 46 | Milwaukee city | 55079 | 35 | 31 | 0 | 0 | - | none on file |
| 47 | Montclair city | 06071 | 32 | 17 | 0 | 0 | - | none on file |
| 48 | Santa Monica city | 06037 | 30 | 30 | 0 | 0 | - | none on file |
| 49 | SeaTac city | 53033 | 30 | 20 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 50 | Anaheim city | 06059 | 29 | 29 | 0 | 0 | - | none on file |
| 51 | San Marcos city | 06073 | 29 | 29 | 16 | 3 | 6 (7), 9 (5), 7 (4) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 52 | District of Columbia | 11001 | 29 | 28 | 0 | 0 | - | https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/32 |
| 53 | Burbank city | 06037 | 26 | 25 | 0 | 0 | - | none on file |
| 54 | Detroit city | 26163 | 25 | 25 | 25 | 8 | SD2 (6), B4 (5), R6 (4), R3 (3), R5 (3), B3 (2), PD (1), R1 (1) | https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/Zoning_1/FeatureServer/0 |
| 55 | Pomona city | 06037 | 24 | 21 | 0 | 0 | - | none on file |
| 56 | Miami-Dade County (unincorporated) | 12086 | 23 | 23 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 57 | Plano city | 48085 | 23 | 0 | 0 | 0 | - | none on file |
| 58 | Tampa city | 12057 | 22 | 21 | 0 | 0 | - | https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/28 |
| 59 | Orange city | 06059 | 21 | 21 | 0 | 0 | - | none on file |
| 60 | Grapevine city | 48439 | 21 | 14 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 61 | Irvine city | 06059 | 20 | 20 | 0 | 0 | - | none on file |
| 62 | Cleveland city | 39035 | 20 | 20 | 0 | 0 | - | none on file |
| 63 | Kent city | 53033 | 19 | 14 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 64 | Norwalk city | 06037 | 18 | 16 | 0 | 0 | - | none on file |
| 65 | Upland city | 06071 | 18 | 15 | 0 | 0 | - | none on file |
| 66 | San Bernardino city | 06071 | 18 | 18 | 0 | 0 | - | none on file |
| 67 | Escondido city | 06073 | 18 | 18 | 14 | 3 | 6 (8), 7 (4), 1 (2) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 68 | Santee city | 06073 | 18 | 18 | 16 | 2 | 6 (15), 7 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 69 | Puyallup city | 53053 | 18 | 0 | 0 | 0 | - | none on file |
| 70 | Hawthorne city | 06037 | 17 | 16 | 0 | 0 | - | none on file |
| 71 | Arlington Heights village | 17031 | 17 | 17 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 72 | Farmers Branch city | 48113 | 17 | 17 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 73 | Tacoma city | 53053 | 15 | 0 | 0 | 0 | - | none on file |
| 74 | Fullerton city | 06059 | 14 | 14 | 0 | 0 | - | none on file |
| 75 | Aventura city | 12086 | 14 | 14 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 76 | Carrollton city | 48121 | 14 | 0 | 0 | 0 | - | none on file |
| 77 | Santa Clarita city | 06037 | 13 | 13 | 0 | 0 | - | none on file |
| 78 | Lancaster city | 06037 | 13 | 13 | 0 | 0 | - | none on file |
| 79 | Atlanta city | 13121 | 13 | 13 | 0 | 0 | - | https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/22 |
| 80 | Las Vegas city | 32003 | 13 | 13 | 0 | 0 | - | https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/Zoning/MapServer/0 |
| 81 | Philadelphia city | 42101 | 13 | 11 | 0 | 0 | - | https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_BaseDistricts/FeatureServer/0 |
| 82 | Garland city | 48113 | 13 | 2 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 83 | Redondo Beach city | 06037 | 12 | 12 | 0 | 0 | - | none on file |
| 84 | Glendora city | 06037 | 12 | 12 | 0 | 0 | - | none on file |
| 85 | Fontana city | 06071 | 12 | 12 | 0 | 0 | - | none on file |
| 86 | Coral Gables city | 12086 | 12 | 11 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 87 | Rosemont village | 17031 | 12 | 12 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 88 | Compton city | 06037 | 11 | 10 | 0 | 0 | - | none on file |
| 89 | Culver City city | 06037 | 11 | 11 | 0 | 0 | - | none on file |
| 90 | Orland Park village | 17031 | 11 | 11 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 91 | Deerfield village | 17097 | 11 | 7 | 0 | 0 | - | none on file |
| 92 | Tinley Park village | 17031 | 11 | 9 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 93 | Memphis city | 47157 | 11 | 11 | 11 | 4 | RU-1 (7), EMP (2), RU-6 (1), CMU-2 (1) | none on file |
| 94 | Mountlake Terrace city | 53061 | 11 | 0 | 0 | 0 | - | none on file |
| 95 | Buena Park city | 06059 | 10 | 5 | 0 | 0 | - | none on file |
| 96 | Inglewood city | 06037 | 10 | 10 | 0 | 0 | - | none on file |
| 97 | Victorville city | 06071 | 10 | 9 | 0 | 0 | - | none on file |
| 98 | Encinitas city | 06073 | 10 | 10 | 5 | 2 | 6 (3), 8 (2) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 99 | Skokie village | 17031 | 10 | 10 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 100 | Park Ridge city | 17031 | 10 | 10 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 101 | Wheeling village | 17031 | 10 | 10 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 102 | Lewisville city | 48121 | 10 | 0 | 0 | 0 | - | none on file |
| 103 | North Richland Hills city | 48439 | 10 | 9 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 104 | Tukwila city | 53033 | 10 | 6 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 105 | San Juan Capistrano city | 06059 | 9 | 9 | 0 | 0 | - | none on file |
| 106 | Glenview village | 17031 | 9 | 9 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 107 | Des Moines city | 53033 | 9 | 5 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 108 | Shoreline city | 53033 | 9 | 7 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 109 | Maricopa city | 04021 | 8 | 0 | 0 | 0 | - | none on file |
| 110 | Tucson city | 04019 | 8 | 8 | 0 | 0 | - | https://gis.tucsonaz.gov/arcgis/rest/services/PDSD/PRO_Overlays/MapServer/1 |
| 111 | Manhattan Beach city | 06037 | 8 | 8 | 0 | 0 | - | none on file |
| 112 | Claremont city | 06037 | 8 | 3 | 0 | 0 | - | none on file |
| 113 | Ontario city | 06071 | 8 | 7 | 0 | 0 | - | none on file |
| 114 | Corona city | 06065 | 8 | 7 | 0 | 0 | - | none on file |
| 115 | Perris city | 06065 | 8 | 8 | 0 | 0 | - | none on file |
| 116 | Carlsbad city | 06073 | 8 | 6 | 1 | 1 | 6 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 117 | Cicero town | 17031 | 8 | 8 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 118 | San Antonio city | 48029 | 8 | 8 | 0 | 0 | - | https://services.arcgis.com/g1fRTDLeMgspWrYp/ArcGIS/rest/services/COSA_Zoning/FeatureServer/12 |
| 119 | Rowlett city | 48113 | 8 | 8 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 120 | Mercer Island city | 53033 | 8 | 4 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 121 | South Pasadena city | 06037 | 7 | 7 | 0 | 0 | - | none on file |
| 122 | Mission Viejo city | 06059 | 7 | 7 | 0 | 0 | - | none on file |
| 123 | Needles city | 06071 | 7 | 7 | 0 | 0 | - | none on file |
| 124 | Vista city | 06073 | 7 | 7 | 2 | 2 | 6 (1), 1 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 125 | Aurora city | 08005 | 7 | 6 | 0 | 0 | - | none on file |
| 126 | Northbrook village | 17031 | 7 | 7 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 127 | Bartlett village | 17031 | 7 | 5 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 128 | Elgin city | 17089 | 7 | 0 | 0 | 0 | - | none on file |
| 129 | King County (unincorporated) | 53033 | 7 | 5 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 130 | Auburn city | 53033 | 7 | 5 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 131 | Sumner city | 53053 | 7 | 0 | 0 | 0 | - | none on file |
| 132 | Downey city | 06037 | 6 | 5 | 0 | 0 | - | none on file |
| 133 | Rialto city | 06071 | 6 | 5 | 0 | 0 | - | none on file |
| 134 | Cook County (unincorporated) | 17031 | 6 | 5 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 135 | Des Plaines city | 17031 | 6 | 6 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 136 | Barrington village | 17031 | 6 | 4 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 137 | Buffalo Grove village | 17097 | 6 | 0 | 0 | 0 | - | none on file |
| 138 | Azusa city | 06037 | 5 | 5 | 0 | 0 | - | none on file |
| 139 | Commerce city | 06037 | 5 | 5 | 0 | 0 | - | none on file |
| 140 | Barstow city | 06071 | 5 | 5 | 0 | 0 | - | none on file |
| 141 | Solana Beach city | 06073 | 5 | 5 | 3 | 1 | 6 (3) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 142 | Lemon Grove city | 06073 | 5 | 5 | 4 | 3 | 9 (2), 6 (1), 3 (1) | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 143 | Blue Island city | 17031 | 5 | 5 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 144 | Mokena village | 17197 | 5 | 0 | 0 | 0 | - | none on file |
| 145 | Hanover Park village | 17043 | 5 | 3 | 0 | 0 | - | none on file |
| 146 | Roselle village | 17043 | 5 | 0 | 0 | 0 | - | none on file |
| 147 | Hinsdale village | 17043 | 5 | 0 | 0 | 0 | - | none on file |
| 148 | New Orleans city | 22071 | 5 | 5 | 0 | 0 | - | https://gis.nola.gov/arcgis/rest/services/dev/zone_test/MapServer/0 |
| 149 | Highland Park city | 26163 | 5 | 0 | 0 | 0 | - | https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/Zoning_1/FeatureServer/0 |
| 150 | county 36059 (unincorporated) | 36059 | 5 | 0 | 0 | 0 | - | none on file |
| 151 | University Park city | 48113 | 5 | 5 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 152 | Renton city | 53033 | 5 | 3 | 0 | 0 | - | https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0 |
| 153 | San Dimas city | 06037 | 4 | 4 | 0 | 0 | - | none on file |
| 154 | Lynwood city | 06037 | 4 | 2 | 0 | 0 | - | none on file |
| 155 | Palmdale city | 06037 | 4 | 4 | 0 | 0 | - | none on file |
| 156 | Duarte city | 06037 | 4 | 4 | 0 | 0 | - | none on file |
| 157 | La Verne city | 06037 | 4 | 4 | 0 | 0 | - | none on file |
| 158 | Covina city | 06037 | 4 | 3 | 0 | 0 | - | none on file |
| 159 | Glendale city | 06037 | 4 | 4 | 0 | 0 | - | none on file |
| 160 | Hialeah city | 12086 | 4 | 4 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 161 | South Miami city | 12086 | 4 | 4 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 162 | Worth village | 17031 | 4 | 4 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 163 | University Park village | 17197 | 4 | 0 | 0 | 0 | - | none on file |
| 164 | Chicago Ridge village | 17031 | 4 | 4 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 165 | Evanston city | 17031 | 4 | 4 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 166 | Forest Park village | 17031 | 4 | 4 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 167 | Arcadia city | 06037 | 3 | 3 | 0 | 0 | - | none on file |
| 168 | Laguna Niguel city | 06059 | 3 | 3 | 0 | 0 | - | none on file |
| 169 | Riverside County (unincorporated) | 06065 | 3 | 3 | 0 | 0 | - | none on file |
| 170 | county 17043 (unincorporated) | 17043 | 3 | 0 | 0 | 0 | - | none on file |
| 171 | Homewood village | 17031 | 3 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 172 | Glencoe village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 173 | Wilmette village | 17031 | 3 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 174 | East Hazel Crest village | 17031 | 3 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 175 | La Grange village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 176 | Richton Park village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 177 | River Forest village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 178 | Morton Grove village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 179 | Franklin Park village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 180 | Palatine village | 17031 | 3 | 3 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 181 | Boston city | 25025 | 3 | 3 | 0 | 0 | - | https://gis.bostonplans.org/hosting/rest/services/Zoning_Districts/FeatureServer/0 |
| 182 | Floral Park village | 36059 | 3 | 0 | 0 | 0 | - | none on file |
| 183 | Arlington city | 48439 | 3 | 3 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 184 | Pima County (unincorporated) | 04019 | 2 | 2 | 0 | 0 | - | https://gis.tucsonaz.gov/arcgis/rest/services/PDSD/PRO_Overlays/MapServer/1 |
| 185 | Santa Fe Springs city | 06037 | 2 | 2 | 0 | 0 | - | none on file |
| 186 | Montebello city | 06037 | 2 | 2 | 0 | 0 | - | none on file |
| 187 | Baldwin Park city | 06037 | 2 | 2 | 0 | 0 | - | none on file |
| 188 | El Monte city | 06037 | 2 | 2 | 0 | 0 | - | none on file |
| 189 | Carson city | 06037 | 2 | 2 | 0 | 0 | - | none on file |
| 190 | Tustin city | 06059 | 2 | 2 | 0 | 0 | - | none on file |
| 191 | Garden Grove city | 06059 | 2 | 2 | 0 | 0 | - | none on file |
| 192 | San Clemente city | 06059 | 2 | 2 | 0 | 0 | - | none on file |
| 193 | Palm Springs city | 06065 | 2 | 2 | 0 | 0 | - | none on file |
| 194 | Jurupa Valley city | 06065 | 2 | 2 | 0 | 0 | - | none on file |
| 195 | Rancho Cucamonga city | 06071 | 2 | 2 | 0 | 0 | - | none on file |
| 196 | San Diego County (unincorporated) | 06073 | 2 | 0 | 0 | 0 | - | https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0; https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0 |
| 197 | Miami Springs city | 12086 | 2 | 2 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 198 | Highland Park city | 17097 | 2 | 0 | 0 | 0 | - | none on file |
| 199 | River Grove village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 200 | Prospect Heights city | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 201 | Schaumburg village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 202 | Harvey city | 17031 | 2 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 203 | Brookfield village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 204 | Matteson village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 205 | Maywood village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 206 | Willow Springs village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 207 | Riverside village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 208 | Berwyn city | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 209 | La Grange Park village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 210 | Oak Park village | 17031 | 2 | 2 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 211 | Kansas City city | 29095 | 2 | 2 | 0 | 0 | - | none on file |
| 212 | Hurst city | 48439 | 2 | 2 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 213 | Richland Hills city | 48439 | 2 | 2 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 214 | Monterey Park city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 215 | Industry city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 216 | Signal Hill city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 217 | Irwindale city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 218 | Beverly Hills city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 219 | San Fernando city | 06037 | 1 | 1 | 0 | 0 | - | none on file |
| 220 | Miami Gardens city | 12086 | 1 | 1 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 221 | Medley town | 12086 | 1 | 1 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 222 | Opa-locka city | 12086 | 1 | 1 | 0 | 0 | - | https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6 |
| 223 | Golf village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 224 | Burnham village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 225 | Itasca village | 17043 | 1 | 0 | 0 | 0 | - | none on file |
| 226 | Bensenville village | 17043 | 1 | 0 | 0 | 0 | - | none on file |
| 227 | South Holland village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 228 | Oak Lawn village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 229 | Schiller Park village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 230 | Park Forest village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 231 | Oak Forest city | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 232 | Midlothian village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 233 | Olympia Fields village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 234 | Palos Park village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 235 | Palos Heights city | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 236 | Elmhurst city | 17043 | 1 | 0 | 0 | 0 | - | none on file |
| 237 | Mount Prospect village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 238 | county 17097 (unincorporated) | 17097 | 1 | 0 | 0 | 0 | - | none on file |
| 239 | Flossmoor village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 240 | Calumet Park village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 241 | Lemont village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 242 | Romeoville village | 17197 | 1 | 0 | 0 | 0 | - | none on file |
| 243 | Berkeley village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 244 | Hazel Crest village | 17031 | 1 | 1 | 0 | 0 | - | https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65 |
| 245 | North Kansas City city | 29047 | 1 | 0 | 0 | 0 | - | none on file |
| 246 | Lawrence village | 36059 | 1 | 0 | 0 | 0 | - | none on file |
| 247 | Grand Prairie city | 48439 | 1 | 0 | 0 | 0 | - | https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54 |
| 248 | Coppell city | 48113 | 1 | 1 | 0 | 0 | - | https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15 |
| 249 | county 53053 (unincorporated) | 53053 | 1 | 0 | 0 | 0 | - | none on file |
| 250 | Lakewood city | 53053 | 1 | 0 | 0 | 0 | - | none on file |
