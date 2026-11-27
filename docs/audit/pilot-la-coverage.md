As of 2026-11-24: every number below was computed by scripts/platform_pilot_la.mjs from app/data/sites-la.b64.txt, app/data/bundle-la.b64.txt, app/data/statutes.json, app/data/state_finance_profiles.json, app/data/transit_value_effects.json.

## Locations
| type | records in file | located (has point) | skipped (no point) |
|---|---|---|---|
| calm | 1764 | 0 | 1764 |
| creek | 3068 | 0 | 3068 |
| ev | 530 | 530 | 0 |
| lot_park | 776 | 776 | 0 |
| xing | 2662 | 2662 | 0 |

Located 3968 of 8800. Kinds: asset 530; parcel 776; point 2662. Lots with a straight-line station distance: 776 (stations in bundle: 176).

## Evaluations (exhaustive screen)
| status | count |
|---|---|
| viable | 0 |
| candidate | 0 |
| needs_info | 35644 |
| rejected | 0 |
| not_evaluated | 0 |

Total 35644. Needs_info because a criterion was not supplied: 35644 (criteria supplied: 0; problem-map rows: 0).

By category (needs_info / not_evaluated / rejected / viable / candidate): adu 776/0/0/0/0; ageing_retail 776/0/0/0/0; air_rights 776/0/0/0/0; assembly 776/0/0/0/0; brownfield 776/0/0/0/0; bus_shelter 2662/0/0/0/0; clinic 1306/0/0/0/0; commercial_revitalisation 776/0/0/0/0; crosswalk 2662/0/0/0/0; densification 776/0/0/0/0; ev_charger 3968/0/0/0/0; grocery 1306/0/0/0/0; industrial_revitalisation 776/0/0/0/0; library 1306/0/0/0/0; lot_split 776/0/0/0/0; mixed_use 776/0/0/0/0; office_to_residential 776/0/0/0/0; p3_mixed_use 776/0/0/0/0; park 776/0/0/0/0; park_with_development 776/0/0/0/0; pocket_park 3438/0/0/0/0; rail_station 3192/0/0/0/0; school_upgrade 530/0/0/0/0; shared_parking 776/0/0/0/0; solar_microgrid 1306/0/0/0/0; surface_parking 776/0/0/0/0; underused_land 776/0/0/0/0; vacant_land 776/0/0/0/0.

## Discovery methods
Run: exhaustive, problem_first, asset_first. Merged opportunities 35644; duplicates merged 3104.
| method | hits | note |
|---|---|---|
| exhaustive | 35644 | ran on every located site |
| problem_first | 0 | ran with an empty problemMap: no indicator is mapped to any category, so it produced nothing |
| asset_first | 3104 | ran with empty criteria: every flag test lacks its threshold or attributes |
| combination | 0 | not run: no adjacency data and no combination bound supplied |

## Top 15 missing inputs (opportunities naming each)
capexSchedule 35644; check:engineering 35644; hurdleRate 35644; omSchedule 35644; periods 35644; revenueSchedule 35644; adjacent_work 22452; criterion:min_adjacent_work 22452; zoning_district 14495; adjacent_parcels 13192; criterion:min_coordination_partners 13192; criterion:min_public_space_area 13192; parcel_area 13192; site_area 9438; ab2011_site_criteria_met 6984.

## Regulatory (California module)
Modules: California (state); Los Angeles (city), from bundle zone_rules. Parcel-topic pairs evaluated 9312; locations with a city 2338 (from block group: 2338; in a city with zone_rules rows [Los Angeles, Unincorporated LA County, Long Beach, Glendale, Pasadena, Torrance, Burbank]: 741; block group is an unincorporated area: 631; block group not in bundle: 999).

Conclusions by finding: requires_investigation 18709.

Conclusions by statute record id: (no registered rule: placeholder conclusion) 4741; ca_ab2011_affordable 1552; ca_ab2097 776; ca_adu_66323 776; ca_sb79_tier1 2328; ca_sb79_tier2 2328; ca_sb79_tier2_light_rail_half 2328; ca_sb79_tier2_light_rail_quarter 2328; ca_sb9_lot_split 1552.

## Financial and engineering checks
Financial check: unknown. Reason: underwriting inputs missing: periods, capexSchedule, revenueSchedule, omSchedule, hurdleRate. Missing: periods, capexSchedule, revenueSchedule, omSchedule, hurdleRate. Engineering: not supplied (unknown for every site).

## Impact models
Registered 6; skipped 12. Categories with a model: rail_station; categories lacking one: 36. Impact areas computed: 0. 3192 opportunities are in categories with a model, but no street-network graph is supplied to this run, so no impact area was computed.

## Coverage ledgers
Ledgers 3968; all finalized: true. Confidence: high 0; medium 0; low 3968; unknown 0. Entries: found 0; rejected 0; needsInfo 35644; notEvaluated 111172 (totals.notEvaluated includes categories that do not apply to the location kind).

## Limits
- Only records with a point (`pt`) are located. Street segments (calm) and creek records carry no `pt` in this file and are counted but not located.
- No repo build script or data file states a unit or definition for ac, lav, pn, pa, dl2 or ddc (the script that built the site file is not in the repo; see UNIT_SEARCH). They stay labels under their own keys, so no rule reading parcel_area or assessed_land_value can use them. No unit was inferred from magnitudes.
- Counts (n, ped, bike, killed, n_l2, n_dc) are Quantities with unit "count" and status assumed; the file does not say what period or definition each count uses beyond its meta (crash_years, crashes, ev_source).
- Lot polygons are decoded from the encoded line in `g` using precision 5 (an assumption about the encoding, not stated in the file); a lot whose line cannot be decoded as a closed ring falls back to an asset point.
- No record states its city. 2338 located records take jurisdiction.place from their block group's own city value (method: city of the containing block group as carried in the county bundle); 741 are in a city that has rows in the bundle's zone_rules (Los Angeles, Unincorporated LA County, Long Beach, Glendale, Pasadena, Torrance, Burbank). 631 sit in a block group whose value is an unincorporated area, not a city (place left null), and 999 sit in a block group absent from the bundle (place null). A point can lie outside its block group's city value; this is not a point-in-polygon test.
- The crossing counts (n, ped, bike, killed) are not mapped to crosswalk rule attributes: the file meta gives only crash_years and a county crash total, and no repo build script defines what each count measures.
- Distances to rail stations are straight-line (haversine), status assumed (built with makeQuantity), and are stored under a name the California rules do not read.
- criteria and problemMap are empty by default: nothing is screened on a threshold, so a site never passes or fails a physical test it has no criterion for.
- No sourced costs, revenues, period count or hurdle rate exist in the repo, so the financial check is unknown for every site.
- No engineering check exists, so no opportunity can be viable.
