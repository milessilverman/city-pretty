# Small counties: Maryland (19 Nov 2026), the first state served from R2 only

Maryland was the next state by the rule in the brief (the pilot doc gives no order): the state in the us-south
extract Tennessee used with the fewest counties missing from the page. Delaware and DC had none missing; Maryland had
10 (of 24). All 10 are built and on the page; none was withheld. Maryland now has 24 of 24 counties with data files.

This is also the first state whose county files are **not committed to the repository**. They are uploaded to the
R2 bucket with `scripts/r2_sync_counties.py` and listed in `counties/.r2-only.txt`; the page loads them from R2 only.

## What was built

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier |
|---|---|---|---|---|
| Allegany (24001) | 67,452 | 53 | 727,710 | C |
| Calvert (24009) | 94,313 | 41 | 553,739 | C |
| Caroline (24011) | 33,669 | 22 | 381,360 | D |
| Dorchester (24019) | 32,754 | 30 | 1,149,122 | D |
| Garrett (24023) | 28,615 | 24 | 650,299 | C |
| Kent (24029) | 19,346 | 18 | 495,837 | C |
| Queen Anne's (24035) | 51,825 | 35 | 714,614 | C |
| Somerset (24039) | 24,822 | 22 | 843,195 | C |
| Talbot (24041) | 37,917 | 27 | 569,354 | D |
| Worcester (24047) | 53,700 | 55 | 764,544 | C |
| **10 counties** | **444,413** | **327** | **6,849,774** | 7 C, 3 D |

People are the county rows (`0500000US24...`) of the Census Bureau's `acsdt5y2024-b01003.dat`. No `sites_` files were
built: as for Tennessee, `w5/tools/sites.py` needs the old build machine's paths, and the page handles a county
without site suggestions.

## How (the pilot's method, unchanged)

- **OpenStreetMap:** `us-south-latest.osm.pbf` from download.openstreetmap.fr (4,622,051,891 bytes, md5
  `d3b68f2f997a6f2dc322ebf7c25052b8` equal to the published `.md5`; data timestamp 2026-11-19T01:25:58Z), downloaded in
  6 min 5 s. Maryland cut with `national/osm_split.py us-south --states MD` (osmium `extract -s smart`): 106 s, 334 MB,
  peak osmium memory 4.1 GB. Geofabrik (`download.geofabrik.de`) still resets the connection from this machine and
  `overpass-api.de` does too; neither was needed. osmium-tool (apt), pyosmium, pyproj and pyshp had to be installed.
- **Pipeline:** `pipeline/fetch_oc.py`, `osm_extract.py`, `metrics_oc.py`, `layers_oc.py`, `build_oc.py inputs/page_dec`,
  run from a copy of `pipeline/` in the session's scratch folder (raw downloads kept there, never in the repository);
  then `scripts/export_county_bundle.py <dir> <fips> --r2-only`, `build_tree_equity_2025.py md`,
  `build_acs_fallback_flags.py`, `build_county_completeness.py`.
- **Time:** Kent alone first (fetch 144 s including the national ACS table files, which were then shared), then the
  other nine three at a time in 428 s (each 120-146 s: fetch 21-48 s, build 97-106 s). From the start of the download
  to the last county built: 20.6 min, including a pipeline fix (below).
- **Fixed on the way:** `pipeline/osm_extract.py` referred to `BOX` after commit 835f341 (18 Nov, antimeridian split)
  renamed it `BOXES`, so every county that clips a state or regional extract stopped with `NameError` before writing
  anything. Three references corrected; no published file was affected (nothing had been built since).
- **Canopy:** `build_tree_equity_2025.py md` (release 2025-07-01) wrote all 24 Maryland files; the 14 existing ones
  differed only in the build date and were left as committed. Six of the ten counties have no block group in the 2021
  release (urbanized areas only), so their heat and 2021 canopy gap stay empty, as their sources list says.
- **Crash counts:** none. Maryland has no state crash source connected (the 14 existing Maryland counties have none
  either); each file says "Not connected for Maryland yet: crash gaps are not scored".
- **Empty fields, each named in the county's sources list:** crime (all), 311, assessor parcels and sales, street-tree
  survey, tax-rate areas (all); bus frequency in every block group of 6 counties (Allegany, Caroline, Garrett: no feed
  read has a 7-9 am departure near them; Dorchester, Kent, Talbot: feeds read, none with a 7-9 am departure inside the
  county) and in 5 of Calvert's and 7 of Worcester's block groups; rail distance in the 7 with no station in or near
  them (Calvert, Caroline, Dorchester, Queen Anne's, Somerset, Talbot, Worcester).
- **Transit catalog:** some MobilityData copies used only to find a feed's area answered 403 from
  storage.googleapis.com (e.g. mdb-431, mdb-612, tfs-177, tfs-209), as in earlier builds; those feeds were not read.

## Checks

| Check | Sample | Result | Mismatch rate |
|---|---|---|---|
| Census: population, median home value, median gross rent, median household income vs the ACS 2020-24 table files (`acsdt5y2024-b01003/b25077/b25064/b19013.dat`, read with a separate parser: `scripts/census_spot_check.py`) | 6 block groups in each of the 10 counties (seeded random), 240 values | 240 of 240 equal | 0% |
| ...of which the block group's own estimate | 208 values | equal to the published estimate | 0% |
| ...of which suppressed for the block group | 24 hold the tract's published median and are flagged as tract values in `acs_fallback_flags.json` (22 rents, 2 home values); 8 are left empty (5 incomes, 2 rents, 1 home value) | as expected | 0% |
| Tract-median flags (`build_acs_fallback_flags.py`, every county file) | all 757 files | 10 counties added, no existing county changed, 0 values matching neither the block group nor the tract | 0% |
| OpenStreetMap, ID for ID vs a live Overpass query of the same box (`scripts/check_osm_extract_vs_overpass.py`, maps.mail.ru mirror) | Kent, Caroline | Kent 4,459 = 4,459 roads, 35 = 35 bus stops; Caroline 2,728 = 2,728 roads, 1 = 1 bus stop (the mirror answered 504 on 4 of 8 tries first) | 0% |
| Live, real page loading from R2 (`scripts/live_check_panels.mjs`, LIVE_PORT 8991) | Kent, Garrett, Worcester; 3 block groups each, 9 checks per point (81) | 80 pass, 1 not checkable (FEMA did not answer the checker); 1 FEMA row in Garrett first showed "did not answer in time" (the page's 6 s limit) and, re-checked alone, showed Zone AE as FEMA does. Every data file request went to `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200, GET 200), none to the site's `counties/` path. No page errors. | 0 wrong values |

Files: `data/backtests/md_census_spot_2026-11-19.json`, `data/backtests/md_osm_xcheck_2026-11-19.json`,
`data/backtests/live_check_panels_2026-11-19_mdsmall.json`, `data/backtests/acs_fallback_mismatches_2026-11-19.json`.

**Found by the live check and fixed:** the first run showed "FEMA flood zone: Not available (No effective FEMA flood map
here (unmapped, not 'no risk'))" at two points where FEMA maps Zone X. The page's shared FEMA query had failed (FEMA
sent no CORS header on an error), and `app/facts.js` read the failed, cached query as "no map here". It now reports a
failed query as "did not answer" and the failed query is not kept, so the next click asks FEMA again. This affected
every county, not only these. Logged in `docs/DATA-AUDIT-AND-TRANSPARENCY.md`.

## R2-only storage (new)

- `counties/.r2-only.txt` lists the 10 files, one per line. `scripts/r2_only.py --gitignore` writes the matching block in
  `.gitignore`; `--check` confirms the block matches and that none is tracked by git. `export_county_bundle.py --r2-only`
  adds a county to the list, marks its page tag `data-r2only="1"` and its manifest row `"r2_only": true`.
- The page (`countyBundleSources` in `app/app.js`) asks R2 alone for a tagged county. If R2 is off or does not return
  the file, the panel says "This county's data could not be loaded: its file is kept only on the R2 data host ...".
  Site-suggestion files (`data-sites`) now go through the same host list (R2 first, then this site), which they did not
  before.
- Tests read the list instead of assuming files are on disk (`tests/r2Only.ts`; `acsFallbackFlags`, `countyHosts`,
  `provenance`, new `r2Only.test.ts`; two new browser tests). The unit suite was also run with the 10 files moved out of
  `counties/` (as in a fresh clone): 849 of 849 passed.
- Scripts that rebuild a file from every county file (`build_acs_fallback_flags.py`, `build_county_completeness.py`,
  `build_state_crash_counts.py`, `build_tree_equity_2025.py`, `audit_bundles_nationwide.py`, `catalog_coverage.py`) stop
  with a message when a listed R2-only file is not on disk, instead of silently dropping those counties;
  `split_county_hosting.py` skips them (they are never on a Pages site). `live_check_panels.mjs` reads the R2 copy when
  there is no local one.
- To rebuild on another machine, download the listed files from the bucket's public address into `counties/` first.

## R2 storage

`python3 scripts/r2_sync_counties.py --usage`: before 1.138 GB (1,137,938,782 bytes, 1,385 objects); dry run "To
upload: 11 files, net +0.007 GB. Projected total: 1.145 GB"; after 1.145 GB (1,144,791,085 bytes, 1,395 objects).
Added 6,852,303 bytes: the 10 data files plus the larger `manifest.json`. The R2 copy of `bundle_24029.json.gz` was
downloaded with an Origin header: 200, `access-control-allow-origin: *`, ETag equal to the local MD5, byte-identical.
