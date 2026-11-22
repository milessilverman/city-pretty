# Site cards measured (after, 2026-11-22)

7098 sites in 42 counties (app/data/station_sites). Inputs: the page's displayable inputs only (pcSubjects / pcCtx in app/invest.js); no data/internal rows.

| Shows | Sites |
|---|---|
| a cost range (any course or place row) | 7098 |
| a public-money rule that applies to the site (a programme computed for a course, or the 130% tax-credit basis because the site is in a 2027 QCT or DDA) | 4639 |
| the location rule known either way (in or not in a 2027 QCT/DDA) | 7079 |
| an income range (any course, or the place's tax-credit rent ceilings or Fair Market Rents) | 7095 |
| none of the three | 0 |

## Courses assessed and rows filled

| Course | Assessed | Size | Cost | Public money applies | Income | Value |
|---|---|---|---|---|---|---|
| hold | 7098 | 7098 | 0 | 0 | 0 | 0 |

## Courses not assessed, by reason

| Course | Reason | Sites | Counties | Largest counties |
|---|---|---|---|---|
| adu | the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| state_law_units | the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| small_multifamily | the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| station_conventional | the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| station_prefab | the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |

## Place facts (card rows that do not depend on a course)

| Row | Filled | Unfilled reason | Sites | Counties |
|---|---|---|---|---|
| qct_dda | 7079 | the census tract of this site is not on file (…) | 8 | 3 |
|  |  | the ZIP Code Tabulation Area of this site is not on file | 7 | 3 |
|  |  | ZIP area # is not on HUD's # metropolitan DDA sheet | 4 | 3 |
| cost | 7098 | - | 0 | 0 |
| rent_limits | 7095 | HUD's tax-credit (MTSP) income limits are not on file for county #: HTTP #; New England: HUD sets limits by town / area (entity ids are town-level), so no county-wide row exists and none is invented | 3 | 1 |
| fmr | 7095 | HUD Fair Market Rent not on file for county # | 3 | 1 |

## Blocking reasons ranked (course rows and unassessed courses; a site counts once per course)

| # | Row: reason | Site-courses | Counties | Largest counties |
|---|---|---|---|---|
| 1 | cost: the purchase price is not on file: the site record's market land value is an unverified model estimate, and its assessed value is a tax base, not a price | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 2 | publicMoney: no programme listed | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 3 | income: space rental income not on file: no sourced rate for parking, storage or roof space is in the data (research prompt # (renting out every space)) | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 4 | value: the purchase price is not on file: the site record's market land value is an unverified model estimate, and its assessed value is a tax base, not a price | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 5 | course not assessed (adu): the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 6 | course not assessed (state_law_units): the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 7 | course not assessed (small_multifamily): the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 8 | course not assessed (station_conventional): the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |
| 9 | course not assessed (station_prefab): the zoning code is not on file for this site | 7098 | 42 | 17031:800, 06037:800, 48113:756, 06073:753, 04013:611 |

## Sites showing nothing, by first reason

| Reason | Sites | Counties |
|---|---|---|

## By county

| County | Sites | Cost range | Money rule applies | Location rule known | Income range | Nothing |
|---|---|---|---|---|---|---|
| 11001 District of Columbia | 29 | 29 | 14 | 29 | 29 | 0 |
| 12031 Duval County | 73 | 73 | 68 | 73 | 73 | 0 |
| 12057 Hillsborough County | 22 | 22 | 21 | 22 | 22 | 0 |
| 12086 Miami-Dade County | 147 | 147 | 123 | 147 | 147 | 0 |
| 13121 Fulton County | 13 | 13 | 7 | 13 | 13 | 0 |
| 17031 Cook County | 800 | 800 | 407 | 799 | 800 | 0 |
| 18097 Marion County | 144 | 144 | 65 | 144 | 144 | 0 |
| 22071 Orleans Parish | 5 | 5 | 2 | 5 | 5 | 0 |
| 24510 Baltimore city | 75 | 75 | 54 | 75 | 75 | 0 |
| 25025 Suffolk County | 3 | 3 | 3 | 3 | 0 | 0 |
| 26163 Wayne County | 30 | 30 | 20 | 30 | 30 | 0 |
| 27053 Hennepin County | 58 | 58 | 50 | 58 | 58 | 0 |
| 27123 Ramsey County | 97 | 97 | 56 | 97 | 97 | 0 |
| 29095 Jackson County | 3 | 3 | 2 | 3 | 3 | 0 |
| 32003 Clark County | 78 | 78 | 25 | 73 | 78 | 0 |
| 34013 Essex County | 49 | 49 | 26 | 49 | 49 | 0 |
| 36047 Kings County | 406 | 406 | 355 | 400 | 406 | 0 |
| 36081 Queens County | 164 | 164 | 124 | 164 | 164 | 0 |
| 37119 Mecklenburg County | 88 | 88 | 68 | 88 | 88 | 0 |
| 37183 Wake County | 67 | 67 | 19 | 67 | 67 | 0 |
| 39035 Cuyahoga County | 20 | 20 | 16 | 20 | 20 | 0 |
| 39049 Franklin County | 35 | 35 | 28 | 35 | 35 | 0 |
| 41051 Multnomah County | 49 | 49 | 20 | 49 | 49 | 0 |
| 42101 Philadelphia County | 13 | 13 | 11 | 13 | 13 | 0 |
| 47037 Davidson County | 85 | 85 | 38 | 85 | 85 | 0 |
| 47157 Shelby County | 11 | 11 | 3 | 11 | 11 | 0 |
| 48029 Bexar County | 8 | 8 | 3 | 8 | 8 | 0 |
| 48113 Dallas County | 756 | 756 | 420 | 755 | 756 | 0 |
| 48201 Harris County | 395 | 395 | 315 | 395 | 395 | 0 |
| 48439 Tarrant County | 102 | 102 | 78 | 102 | 102 | 0 |
| 48453 Travis County | 41 | 41 | 26 | 41 | 41 | 0 |
| 53033 King County | 476 | 476 | 282 | 475 | 476 | 0 |
| 55079 Milwaukee County | 35 | 35 | 31 | 35 | 35 | 0 |
| 04013 Maricopa County | 611 | 611 | 375 | 611 | 611 | 0 |
| 04019 Pima County | 10 | 10 | 0 | 10 | 10 | 0 |
| 06037 Los Angeles County | 800 | 800 | 618 | 798 | 800 | 0 |
| 06059 Orange County | 151 | 151 | 65 | 151 | 151 | 0 |
| 06065 Riverside County | 85 | 85 | 52 | 85 | 85 | 0 |
| 06071 San Bernardino County | 166 | 166 | 165 | 166 | 166 | 0 |
| 06073 San Diego County | 753 | 753 | 548 | 750 | 753 | 0 |
| 08031 Denver County | 92 | 92 | 31 | 92 | 92 | 0 |
| 08041 El Paso County | 53 | 53 | 5 | 53 | 53 | 0 |
