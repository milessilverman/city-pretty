# Small counties: the Northeast (21 Nov 2026), nine states served from R2 only

The batch was every county with no data file in the nine states of openstreetmap.fr's us-northeast extract (Connecticut,
Rhode Island, New Jersey, Massachusetts, New Hampshire, Maine, Vermont, New York, Pennsylvania). Recounted with
`national/data/counties.json` against `counties/bundle_*.json.gz` and `counties/.r2-only.txt` before starting: CT 1,
RI 2, NJ 2, MA 3, NH 6, ME 11, VT 13, NY 34, PA 36, **108 counties**. All 108 are built, checked and on the page;
none was withheld. A recount afterwards finds 0 counties without a data file in these nine states.

The method is Maryland's (`small-counties-maryland.md`), unchanged: the files are uploaded to the R2 bucket with
`scripts/r2_sync_counties.py`, listed in `counties/.r2-only.txt`, and not committed. The small states (CT, RI, NJ, MA,
NH: 14 counties) were built and checked first as a pilot and uploaded before the rest were exported.

## What was built

| State | Counties built / missing | People | Block groups | Data files (bytes) | Tiers |
|---|---|---|---|---|---|
| CT | 1 / 1 | 96,312 | 83 | 1,248,134 | 1 C |
| RI | 2 / 2 | 135,147 | 100 | 1,124,484 | 2 C |
| NJ | 2 / 2 | 160,216 | 153 | 1,800,158 | 2 C |
| MA | 3 / 3 | 106,360 | 95 | 1,943,447 | 3 C |
| NH | 6 / 6 | 360,866 | 321 | 6,387,511 | 6 C |
| ME | 11 / 11 | 467,318 | 468 | 14,906,959 | 8 C, 3 D |
| VT | 13 / 13 | 477,348 | 432 | 9,215,827 | 13 C |
| NY | 34 / 34 | 1,848,133 | 1,787 | 17,015,296 | 33 C, 1 D |
| PA | 36 / 36 | 1,631,622 | 1,509 | 22,468,982 | 33 C, 3 D |
| **All** | **108 / 108** | **5,283,322** | **4,948** | **76,110,798** | 101 C, 7 D |

People are the county rows (`0500000US...`) of the Census Bureau's `acsdt5y2024-b01003.dat`; block groups are the
features in each county file; tiers are this run's rows of `app/data/county_completeness.json`. The files average
704,730 bytes a county and 15,382 bytes a block group (median 636,252 bytes; largest Aroostook ME, 2,962,863
bytes; smallest Nantucket MA, 136,558 bytes). No `sites_` files were built (as for Tennessee and Maryland: `w5/tools/sites.py` needs the
old build machine's paths).

<details><summary>Every county</summary>

| State | County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier |
|---|---|---|---|---|---|
| CT | Northeastern Connecticut Planning Region (09150) | 96,312 | 83 | 1,248,134 | C |
| RI | Bristol (44001) | 50,490 | 37 | 273,700 | C |
| RI | Newport (44005) | 84,657 | 63 | 850,784 | C |
| NJ | Cape May (34009) | 94,941 | 107 | 926,402 | C |
| NJ | Salem (34033) | 65,275 | 46 | 873,756 | C |
| MA | Dukes (25007) | 20,933 | 21 | 441,078 | C |
| MA | Franklin (25011) | 70,944 | 62 | 1,365,811 | C |
| MA | Nantucket (25019) | 14,483 | 12 | 136,558 | C |
| NH | Belknap (33001) | 64,659 | 53 | 864,302 | C |
| NH | Carroll (33003) | 51,804 | 53 | 1,107,840 | C |
| NH | Cheshire (33005) | 77,297 | 59 | 908,627 | C |
| NH | Coos (33007) | 31,271 | 36 | 1,035,772 | C |
| NH | Grafton (33009) | 92,120 | 80 | 1,809,478 | C |
| NH | Sullivan (33019) | 43,715 | 40 | 661,492 | C |
| ME | Aroostook (23003) | 67,058 | 75 | 2,962,863 | C |
| ME | Franklin (23007) | 30,413 | 38 | 883,746 | D |
| ME | Hancock (23009) | 56,460 | 50 | 1,616,110 | C |
| ME | Knox (23013) | 41,003 | 41 | 799,840 | C |
| ME | Lincoln (23015) | 36,099 | 35 | 896,670 | C |
| ME | Oxford (23017) | 59,255 | 56 | 1,697,430 | D |
| ME | Piscataquis (23021) | 17,263 | 20 | 1,473,374 | D |
| ME | Sagadahoc (23023) | 37,285 | 34 | 704,262 | C |
| ME | Somerset (23025) | 50,959 | 49 | 1,975,765 | C |
| ME | Waldo (23027) | 40,192 | 34 | 567,324 | C |
| ME | Washington (23029) | 31,331 | 36 | 1,329,575 | C |
| VT | Addison (50001) | 37,664 | 31 | 675,254 | C |
| VT | Bennington (50003) | 37,269 | 36 | 832,322 | C |
| VT | Caledonia (50005) | 30,475 | 26 | 685,862 | C |
| VT | Essex (50009) | 5,982 | 6 | 505,966 | C |
| VT | Franklin (50011) | 50,638 | 37 | 488,486 | C |
| VT | Grand Isle (50013) | 7,450 | 8 | 152,578 | C |
| VT | Lamoille (50015) | 26,148 | 15 | 433,822 | C |
| VT | Orange (50017) | 29,761 | 24 | 745,709 | C |
| VT | Orleans (50019) | 27,606 | 27 | 549,372 | C |
| VT | Rutland (50021) | 60,425 | 60 | 933,673 | C |
| VT | Washington (50023) | 60,017 | 54 | 821,388 | C |
| VT | Windham (50025) | 45,923 | 47 | 1,023,907 | C |
| VT | Windsor (50027) | 57,990 | 61 | 1,367,488 | C |
| NY | Allegany (36003) | 47,159 | 48 | 388,410 | C |
| NY | Cattaraugus (36009) | 76,145 | 80 | 592,168 | C |
| NY | Cayuga (36011) | 75,102 | 80 | 674,784 | C |
| NY | Chemung (36015) | 82,147 | 86 | 317,731 | C |
| NY | Chenango (36017) | 46,321 | 52 | 479,734 | C |
| NY | Clinton (36019) | 78,493 | 78 | 490,654 | C |
| NY | Columbia (36021) | 61,100 | 64 | 681,510 | C |
| NY | Cortland (36023) | 46,246 | 47 | 292,322 | C |
| NY | Delaware (36025) | 44,487 | 55 | 803,325 | C |
| NY | Essex (36031) | 36,973 | 44 | 956,765 | C |
| NY | Franklin (36033) | 46,696 | 42 | 819,342 | C |
| NY | Fulton (36035) | 52,487 | 60 | 332,673 | C |
| NY | Genesee (36037) | 57,787 | 51 | 257,752 | C |
| NY | Greene (36039) | 47,409 | 46 | 631,712 | C |
| NY | Hamilton (36041) | 5,089 | 8 | 530,932 | D |
| NY | Herkimer (36043) | 59,757 | 64 | 661,139 | C |
| NY | Lewis (36049) | 26,607 | 22 | 471,260 | C |
| NY | Livingston (36051) | 61,498 | 49 | 344,591 | C |
| NY | Madison (36053) | 67,328 | 50 | 489,020 | C |
| NY | Montgomery (36057) | 49,528 | 43 | 423,336 | C |
| NY | Orleans (36073) | 39,608 | 33 | 245,312 | C |
| NY | Otsego (36077) | 60,108 | 59 | 606,101 | C |
| NY | Putnam (36079) | 98,107 | 74 | 693,793 | C |
| NY | Schoharie (36095) | 30,049 | 33 | 379,290 | C |
| NY | Schuyler (36097) | 17,562 | 19 | 233,407 | C |
| NY | Seneca (36099) | 32,920 | 32 | 228,929 | C |
| NY | Steuben (36101) | 92,588 | 94 | 615,969 | C |
| NY | Sullivan (36105) | 79,721 | 89 | 1,093,595 | C |
| NY | Tioga (36107) | 47,864 | 45 | 370,872 | C |
| NY | Warren (36113) | 65,517 | 60 | 640,791 | C |
| NY | Washington (36115) | 60,522 | 53 | 588,398 | C |
| NY | Wayne (36117) | 90,929 | 64 | 305,459 | C |
| NY | Wyoming (36121) | 39,753 | 38 | 217,269 | C |
| NY | Yates (36123) | 24,526 | 25 | 156,951 | C |
| PA | Armstrong (42005) | 64,622 | 66 | 728,555 | C |
| PA | Bedford (42009) | 47,513 | 42 | 1,099,352 | C |
| PA | Bradford (42015) | 59,858 | 59 | 833,605 | C |
| PA | Cameron (42023) | 4,427 | 5 | 262,600 | C |
| PA | Carbon (42025) | 65,382 | 56 | 748,593 | C |
| PA | Clarion (42031) | 37,179 | 40 | 516,890 | C |
| PA | Clearfield (42033) | 78,635 | 66 | 921,917 | C |
| PA | Clinton (42035) | 37,798 | 36 | 778,025 | C |
| PA | Columbia (42037) | 65,362 | 54 | 787,089 | C |
| PA | Crawford (42039) | 82,716 | 83 | 526,919 | C |
| PA | Elk (42047) | 30,506 | 26 | 562,953 | C |
| PA | Forest (42053) | 6,715 | 5 | 238,313 | D |
| PA | Fulton (42057) | 14,531 | 11 | 506,648 | C |
| PA | Greene (42059) | 34,835 | 38 | 455,677 | C |
| PA | Huntingdon (42061) | 43,653 | 38 | 739,610 | C |
| PA | Indiana (42063) | 83,042 | 71 | 730,500 | C |
| PA | Jefferson (42065) | 43,864 | 44 | 560,469 | C |
| PA | Juniata (42067) | 23,379 | 19 | 842,268 | C |
| PA | Lawrence (42073) | 85,024 | 77 | 455,130 | C |
| PA | McKean (42083) | 39,904 | 35 | 447,230 | C |
| PA | Mifflin (42087) | 46,041 | 37 | 688,186 | C |
| PA | Montour (42093) | 18,103 | 13 | 329,665 | C |
| PA | Northumberland (42097) | 90,560 | 85 | 1,077,952 | C |
| PA | Perry (42099) | 46,239 | 36 | 1,030,873 | C |
| PA | Pike (42103) | 60,621 | 59 | 1,024,761 | C |
| PA | Potter (42105) | 16,188 | 17 | 356,959 | C |
| PA | Snyder (42109) | 39,668 | 30 | 437,275 | D |
| PA | Somerset (42111) | 72,799 | 75 | 918,405 | C |
| PA | Sullivan (42113) | 5,888 | 9 | 329,015 | C |
| PA | Susquehanna (42115) | 38,219 | 40 | 511,865 | D |
| PA | Tioga (42117) | 40,945 | 38 | 417,822 | C |
| PA | Union (42119) | 42,456 | 31 | 520,534 | C |
| PA | Venango (42121) | 49,801 | 52 | 488,484 | C |
| PA | Warren (42123) | 37,920 | 45 | 378,465 | C |
| PA | Wayne (42127) | 51,262 | 49 | 784,800 | C |
| PA | Wyoming (42131) | 25,967 | 22 | 431,578 | C |

</details>

## How

- **OpenStreetMap:** `us-northeast-latest.osm.pbf` from download.openstreetmap.fr (2,002,222,456 bytes, md5
  `b3318ae9c29bbbf6478d362c810116ad`, equal to the published `us-northeast.osm.pbf.md5`; data timestamp
  2026-11-21T01:28:06Z), downloaded in 1 min 44 s. `us-northeast-latest.osm.pbf.md5` and `.state.txt` answer 404 on
  the server; the published `.md5` and `.state.txt` are named without `-latest`. Eight states cut with
  `national/osm_split.py us-northeast` (osmium `extract -s smart`), from a copy in the session's scratch folder:

  | Cut | Time | Peak osmium memory | State files (bytes) |
  |---|---|---|---|
  | CT, MA, NH together | 102 s | 12.18 GB | CT 268,588,355; MA 384,849,405; NH 120,258,807 |
  | NJ, RI together | 74 s | 8.11 GB | NJ 313,624,170; RI 74,839,957 |
  | ME alone | 78 s | 4.14 GB | 114,016,039 |
  | PA alone | 98 s | 4.17 GB | 432,186,615 |
  | VT alone | 76 s | 4.12 GB | 62,061,510 |

  Three states in one osmium pass needed 12.18 GB of the machine's 15 GB, so the later states were cut one at a time
  while county builds ran. `national/data/osm_split.json` records the eight new cuts.
- **New York is not cut from the regional file.** `osm_split.py` leaves out states that openstreetmap.fr publishes
  itself (`STATE_FILE` in `national/registry.py`), and the registry gives each New York county the smallest
  openstreetmap.fr New York file whose polygon contains it (the same rule as the 28 New York counties built before).
  The 34 were therefore clipped from eight New York sub-region files and one statewide file, downloaded by
  `fetch_oc.py`: capital_district, central_new_york, mohawk_valley, north_country, southern_tier, western_new_york
  (data timestamp 2026-11-21T01:27:06Z), hudson_valley (2026-11-21T01:26:02Z), finger_lakes and new-york
  (2026-11-19T01:25:58Z; openstreetmap.fr had not refreshed those two). See the OpenStreetMap check below for what this
  costs at the county edges.
- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec`
  from a copy of `pipeline/` in the scratch folder (raw downloads kept there, never in the repository); then
  `scripts/export_county_bundle.py <dir> <fips> --r2-only` one county at a time. The national ACS table files were
  downloaded once and linked into every county's folder (the shared-cache rule in `fetch_oc.py`), so a county folder
  held about 5 MB of its own files instead of about 550 MB. **No pipeline code was changed.**
- **Time:** Bristol RI first (fetch 111 s including the national ACS tables, build 36 s), then the other 13 pilot
  counties three at a time in 13.5 min, then the other 94 three at a time in 72.5 min (no build failed). From the start
  of the download to the last county built: 95.7 min. Per county: fetch 14-107 s, build 14-265 s.
- **Canopy:** `build_tree_equity_2025.py ct nj ri ma nh` then `me vt ny pa` (release 2025-07-01) wrote files for every
  county of the nine states with a data file; the 110 existing ones (45 and 65) differed only in `_meta.built` and were
  left as committed. The 108 new files hold 2,145 block groups; 20 counties have none in the current release (urban
  areas only), and their canopy rows stay empty, as their sources list says.
- **Crash counts:** Maine (MaineDOT, 2023-2025) and Pennsylvania (PennDOT PennShare) have a state crash source; the 47
  new counties of those two states got `build_state_crash_counts.py` (boundary rule) and `recompute_crash_gaps.py`:
  1,977 block groups, 302 gaps and 139 strengths, 2,432 crash-based improvement rows dropped and 42 re-sized where the
  rebuilt counts no longer qualify them (the same rule as every other county). No state crash source is connected for
  the other seven states (as for the existing counties there); those files say crash gaps are not scored.
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency in every block group of 16 counties: 13 where no feed read has a stop
  with 7-9 am departures in or near the county (Aroostook, Franklin, Knox, Lincoln, Piscataquis, Somerset ME; Belknap,
  Carroll, Coos NH; Hamilton NY; Forest, Snyder, Susquehanna PA) and 3 where feeds were read but none has such a stop
  inside the county (Oxford, Sagadahoc, Waldo ME), plus single block groups elsewhere where OpenStreetMap shows stops
  the feeds do not have; rail distance in the 53 counties with no station in or near them; the 2021 heat and canopy
  gap outside urbanized areas.
- **Transit catalog:** some MobilityData copies answered 403 from storage.googleapis.com (e.g. mdb-431, tfs-296), as in
  earlier builds; those feeds were not read. Advance Transit's own download answered 503; its MobilityData copy (631)
  was read and counted for Grafton and Sullivan NH.

## Checks

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`acsdt5y2024-b01003/b25077/b25064/b19013.dat`, separate parser: `scripts/census_spot_check.py`, seed 20261119) | 6 block groups in each of the 108 counties (all of them in Cameron and Forest PA, which have 5), 646 block groups, 2,584 values | 2,584 of 2,584 equal | 0% |
| ...of which the block group's own estimate | 2,364 values | equal to the published estimate | 0% |
| ...of which suppressed for the block group | 165 hold the tract's published median and are flagged as tract values in `acs_fallback_flags.json` (141 rents, 24 home values); 55 are left empty (30 incomes, 14 rents, 11 home values) | as expected | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all 865 county files plus Orange and Los Angeles | 108 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap, ID for ID vs a live Overpass query of the same box (`scripts/check_osm_extract_vs_overpass.py`, maps.mail.ru mirror) | Bristol RI and Cameron PA (cut from the regional file) | Bristol 4,082 = 4,082 roads, 278 = 278 bus stops; Cameron 1,212 = 1,212 roads, 0 = 0 bus stops (the mirror answered 504 twice first) | 0% |
| Same check, a New York county (sub-region file) | Hamilton NY | 1,489 of 2,024 roads in the box; 0 = 0 bus stops (504 four times on bus stops first). The 535 missing roads all lie outside the county: every road with a node inside Hamilton's block groups in the regional file (1,092) is in the extract | 0% inside the county; 26% of the box |
| New York, every county: roads of the same classes in `us-northeast-latest.osm.pbf` vs each county extract | all 34 | 0 roads missing inside any county; 0 to 4,550 missing in the 0.02 degree margin of the county box (Madison 4,550, Delaware 2,768, Columbia 2,200; Franklin and Orleans 0) | 0% inside the counties |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, LIVE_PORT 9311-9314) | one county in each state: Bristol RI, Grafton NH, Cape May NJ, Aroostook ME, Essex NY, Cameron PA, Windsor VT, Franklin MA, Northeastern CT; 3 block groups each (27 points, 9 checks each, 243) | 210 pass, 32 not checkable (no parcel at the point or no parcel service, so the house-panel checks do not apply), 1 USGS row first showed "did not answer in time" (the page's limit) and, re-checked alone, showed 436 ft as USGS does. Every data file request went to `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200, GET 200). No console errors; failed resource loads are recorded per county in the result files (404s for optional files, overpass-api.de refused by CORS from this machine) | 0 wrong values |

Files: `data/backtests/ne_census_spot_2026-11-21.json`, `data/backtests/ne_osm_xcheck_2026-11-21.json` (includes the
New York comparison), `data/backtests/live_check_panels_2026-11-21_ne_pilot.json`, `..._ne_b2.json`, `..._ne_b3.json`,
`data/backtests/acs_fallback_mismatches_2026-11-21.json`.

**Found by the live check and fixed (the checker, not the page):** the first pilot run marked Bristol RI block group
440010304001 "neighborhood: FAIL": the file holds 3501 for its rent (the block group's median is suppressed,
`-666666666`; the tract's published median is 3501, the Census top-code for "$3,500+"), and the page shows "$3,500 or
more/mo" labelled as the tract's figure, which is right. `scripts/live_check_panels.mjs` expected "$3,501/mo". It now
expects the Census top- and bottom-code wording for rents of 3501 and 100 or less; re-run, the point passed.

**Found, not fixed (New York edges):** the New York sub-region files stop at their own polygons, so roads, parks and
other features in the margin a county box keeps beyond the county line are missing where the neighbouring county is in
another sub-region. Inside the counties nothing is missing (above). Distances that can reach across a county line
(nearest park, amenity or facility) may therefore be longer than they are for block groups at the edge of the 34 new
counties and, by the same rule, the 28 New York counties built before. Logged in `docs/DATA-AUDIT-AND-TRANSPARENCY.md`;
the fix is to cut New York from the regional file like the other eight states.

## Tests

- `npm test` 977 of 977 passed (also with the 118 R2-only files moved out of `counties/`, as in a fresh clone);
  `npm run typecheck` clean; `PW_PORT=9321 npm run test:e2e` 86 of 86 passed (7.6 min).
- Three tests were brought up to date with the new counties (none skipped or loosened beyond what is stated):
  `provenance.test.ts` expected 8 Connecticut canopy files and now expects all 9 planning regions;
  `stateCrashCounts.test.ts` compared the stored per-block-group sum with the strictly-inside total exactly, but each
  stored count is rounded to 4 decimals (1/k parts), so Aroostook's stored sum is 3993.9998 against 3994: the test now
  allows the rounding (0.00005 per block group) and nothing more; the FRA corridor test checks each stop's
  `county_on_page` flag against the manifest, so the six corridor stops in counties built here (Rockland ME; Rutland,
  Bennington, Manchester, St. Albans and White River Junction VT) now say `county_on_page: true` in
  `app/data/intercity_transit_corridors.json`.
- Completeness: 108 rows taken from a fresh `build_county_completeness.py` run (101 C, 7 D); every other row left as
  committed (a fresh run would also rewrite `computed_on` on all 797 existing rows and `live_services` on 49).

## R2 storage

`python3 scripts/r2_sync_counties.py --usage` and the script's own byte total: before **1,144,791,085 bytes** (1.145 GB,
1,395 objects). Pilot: dry run "To upload: 15 files, net +0.013 GB. Projected total: 1.157 GB"; after 1,157,298,373
bytes (1,409 objects). Second upload (Maine, New York, the first eight Pennsylvania counties): dry run "54 files, net
+0.038 GB, projected 1.195 GB". Third (the rest): dry run "42 files, net +0.026 GB, projected 1.221 GB". After:
**1,220,931,278 bytes** (1.221 GB, 1,503 objects); a further dry run finds 0 files to upload. Added 76,140,193 bytes:
the 108 data files (76,110,798) plus the larger `manifest.json`. The R2 copies of `bundle_44001.json.gz` and
`bundle_50027.json.gz` were downloaded with an Origin header: 200, `access-control-allow-origin: *`, ETag equal to the
local MD5, byte-identical. Storage is 1.221 GB of the 8 GB ceiling and the 10 GB allowance.
