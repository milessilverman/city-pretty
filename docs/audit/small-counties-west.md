# Small counties: the West (21 Nov 2026), served from R2 only

In progress; this file is rewritten as each state group is uploaded and committed.

The batch is every county with no data file (not in `counties/bundle_*.json.gz`, not in `counties/.r2-only.txt`) whose
registry OSM extract (`national/data/counties.json`) is openstreetmap.fr's `us-west-latest.osm.pbf`. Recount before
starting, from the registry: AZ 6, NV 15, WY 22, UT 23, OR 26, WA 26, NM 28, ID 40, MT 52, **238 counties**; every one
has `split: us-west/<state>`, so no state points at sub-region files (unlike New York in the Northeast batch).

Left out (registry extract is not us-west, or no OSM extract): Colorado 53 (openstreetmap.fr Colorado sub-region
files: denver 3, northeast 10, northwest 14, southeast 12, southwest 14), California 2 (Los Angeles and Orange, built
by their own pipeline), Hawaii 5 and Alaska 1 (no extract in the registry), Puerto Rico 73.

The method is the Northeast batch's (`small-counties-northeast.md`), unchanged.

## Arizona (6 of 6 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Apache (04001) | 65,341 | 56 | 2,224,648 | C | 0 |
| Gila (04007) | 53,795 | 45 | 4,158,011 | C | 27 |
| Graham (04009) | 39,232 | 30 | 986,996 | D | 20 |
| Greenlee (04011) | 9,409 | 8 | 568,862 | D | 0 |
| La Paz (04012) | 16,664 | 29 | 535,283 | D | 17 |
| Santa Cruz (04023) | 48,926 | 36 | 764,394 | D | 18 |
| **6 counties** | **233,367** | **204** | **9,238,194** | 2 C, 4 D | 82 |

- OpenStreetMap: `us-west-latest.osm.pbf` (3,789,555,685 bytes, md5 `837d2bbdaa41cda846637e47ca6499d9`, equal to the
  published `us-west.osm.pbf.md5`; data timestamp 2026-11-21T01:28:06Z), downloaded in 2 min 46 s. Arizona cut alone
  with `national/osm_split.py us-west --states AZ --per-pass 1`: 114 s, peak osmium memory 4.13 GB, 343 MB.
- Build: fetch 28-119 s, build 233-296 s per county, three at a time (most of the build is `osm_extract.py` reading
  the 343 MB state file: 221 s for Graham).
- Census spot check (`scripts/census_spot_check.py`, seed 20261119, 6 block groups per county): 144 of 144 values
  equal (0% mismatch). Tract-median flags: 6 counties added, no existing county changed, 0 mismatches.
- Live check from R2 (`LIVE_PORT=9332`): Santa Cruz, 3 block groups: neighborhood, canopy, canopy goal, crash text,
  state laws and console all pass; the house-panel rows are not checkable (no parcel service for the county). The
  data file came from `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev` (HEAD 200, GET 200).
- Crash counts: Arizona has no state crash source connected; the files say crash gaps are not scored.
- R2: before 1,220,931,278 bytes (1,503 objects); dry run "7 files, net +0.009 GB, projected 1.230 GB"; after
  1,230,170,981 bytes (1,509 objects).

## Nevada (15 of 15 built, none withheld)

| County | People (ACS 2020-24) | Block groups | Data file (gzip, bytes) | Completeness tier | Canopy block groups (2025 release) |
|---|---|---|---|---|---|
| Churchill (32001) | 25,805 | 20 | 411,232 | D | 16 |
| Douglas (32005) | 49,623 | 35 | 530,124 | C | 28 |
| Elko (32007) | 54,047 | 39 | 1,110,109 | C | 22 |
| Esmeralda (32009) | 1,028 | 1 | 890,171 | C | 0 |
| Eureka (32011) | 1,585 | 2 | 249,001 | D | 0 |
| Humboldt (32013) | 17,289 | 14 | 921,939 | C | 12 |
| Lander (32015) | 5,770 | 5 | 609,078 | C | 0 |
| Lincoln (32017) | 4,405 | 5 | 723,308 | D | 0 |
| Lyon (32019) | 61,680 | 40 | 766,661 | C | 24 |
| Mineral (32021) | 4,542 | 5 | 488,987 | D | 0 |
| Nye (32023) | 54,344 | 35 | 6,408,751 | C | 27 |
| Pershing (32027) | 6,487 | 6 | 452,878 | C | 0 |
| Storey (32029) | 4,140 | 3 | 301,510 | C | 1 |
| White Pine (32033) | 8,735 | 9 | 377,155 | D | 5 |
| Carson City (32510) | 58,384 | 45 | 263,453 | C | 44 |
| **15 counties** | **357,864** | **264** | **14,504,357** | 10 C, 5 D | 179 |

- Nevada cut alone: 112 s, peak osmium memory 4.10 GB, 154 MB. Build: fetch 14-190 s, build 87-159 s per county.
- Census spot check: AZ and NV together 444 of 444 values equal (0% mismatch). Tract-median flags: 15 counties added,
  no existing county changed, 0 mismatches.
- OpenStreetMap ID for ID vs a live Overpass query of the same box (maps.mail.ru mirror; 504 twice on each first):
  Greenlee AZ 1,235 = 1,235 roads, 0 = 0 bus stops; Esmeralda NV 1,810 = 1,810 roads, 14 = 14 bus stops (0%).
- Live check from R2 (`LIVE_PORT=9333`): Carson City, 3 points with the house panel on live parcel records: all 10
  checks pass at each (neighborhood, canopy, canopy goal, crash text, state laws, Census area, HUD rent, FEMA, USGS,
  console); Douglas, 3 points, no parcel service (house rows not checkable), the rest pass. Both data files came from
  the r2.dev address (HEAD 200, GET 200). Failed loads on the page: optional files (404), overpass-api.de blocked by
  CORS from this machine, three 403s, as in earlier batches.
- R2: dry run "16 files, net +0.015 GB, projected 1.245 GB"; after 1,244,679,103 bytes (1,524 objects).
