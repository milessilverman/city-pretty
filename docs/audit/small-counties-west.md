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
