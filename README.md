# City Pretty pipeline (private)

This repository holds the code, notes and research behind City Pretty, a free public map that scores every Census block group in US counties for neighborhood projects. Each project shows a sourced cost and a sourced effect on home values.

- Live site: https://milessilverman.github.io/city-pretty/
- Site repository (public): https://github.com/milessilverman/city-pretty. It holds the page (`index.html`), one bundle and one site-suggestion file per county (`counties/`), and the docs.
- This repository (private) holds what builds those files. It was saved on 11 Nov 2026 from the cloud machine the work ran on, which is wiped after it sits idle.

There is no data here, apart from five gzipped page inputs. Every county's data is downloaded again by the pipeline.

## Layout

| Folder | What it is |
|---|---|
| `pipeline/` | The per-county pipeline, round 8.6 code: `fetch_oc.py` (downloads), `osm_extract.py`, `metrics_oc.py` (block-group metrics), `layers_oc.py` (map layers), `engine.py` (project rows: cost, value, why), `build_oc.py` (the county bundle), `region.py` (county settings), `sources_oc.py`, `geo.py`, `state_crashes.py`. `old_versions/` keeps earlier versions for reference. |
| `national/` | Orchestration: `build_county2.sh` (one new county, start to finish), queue workers, round re-run scripts (`rebundle86b.sh` is the latest), `osm_split.py`, `janitor86.py`. Also `data/counties.json` (the county registry: names, FIPS, OSM extract per county) and the gazetteer files. |
| `national/logs/` | Install notes (`rebundle84.notes`: every code install with its reason), effect reports, station and transit evidence (JSON, Markdown). Logs from single county builds are left out. |
| `w5/` | Page and site tools: `tools/patch6.py` builds the page from `inputs/w5/in.html`. Also `tools/osm_sites.py` and `tools/sites.py` (site suggestions), `build_all_regions.sh` (regional pages), the `round*_finish.sh` scripts, and every round report (`REPORT-round*.md`). |
| `w5/round86/` | The round 8.6 report draft, `NEXT_ROUND_87_draft.md` (the plan for 8.7), and the README planned for a second data repository. |
| `w5/round87/` | Round 8.7 research: the four AI lists the owner pasted, the parcel-service registry (`parcels87.json`), and `catalog87_result.json` (the full location-specific research with checker verdicts). |
| `w5/research/` | Source documents saved as evidence in earlier rounds (agency PDFs and pages). |
| `research/` | CSV exports of the round 8.7 research. `location_types_research.csv` covers 46 location-specific project types, each with its trigger, effect, cost, quotes and check result. Also: `ai_list_mapping.csv` (514 list items mapped to types), `new_types.csv` (70 proposed types) and `citation_checks.csv`. |
| `patches/round86/` | The scripts that made each round 8.6 change. They are already applied to `pipeline/`; each script's docstring says what it changed and why. |
| `page/` | Page test and patch helpers (`regress.js`, `patch_page.py`). |
| `inputs/` | The large page inputs, gzipped. `w5/in.html` is the base page and `w5/bundle_in.json` the LA bundle. `page_dec/` holds the decoded LA and Orange bundles; `build_oc.py` reads its project catalog from `bundle_oc.json`. |
| `scratch_tools/` | Probes and tests from the last rounds: parcel registry build, address and lot tests, interim page tests. Also the research prompts page and the workflow that ran the round 8.7 research. |

## Running it

Paths are written out in full in the scripts: `/home/user/national`, `/home/user/w5` and `/home/user/page`. On a new machine, recreate those paths (put `national/` and `pipeline/` under `/home/user/national`, and `w5/` at `/home/user/w5`). Then gunzip `inputs/` into `/home/user/w5` and `/home/user/page/dec`.

Requirements:
- Python 3.13 with shapely 2.x, numpy, pyosmium (`osmium`) and pyshp (`shapefile`).
- The `osmium` command-line tool.
- About 40 GB of disk. The OpenStreetMap state extracts alone take about 12 GB; the rest is per-county data and caches.

One new county, start to finish (bundle plus site suggestions), logged to `national/logs/build_<FIPS>.log`:

```bash
cd /home/user/national && ./build_county2.sh 42049
```

Re-running a built county after a code change (what `rebundle86b.sh` does for each county):

```bash
cd /home/user/national/pipeline && CP_FIPS=42049 python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec
```

The output is `pipeline/data_<FIPS>/bundle-oc.b64`. The site files are made from it by the `round*_finish.sh` steps, which also run the regression tests and the regional pages.

A full re-run of about 712 counties took about 10 hours on 4 cores.

## Where things stand (11 Nov 2026)

- **Live:** round 8.5's county files (637 counties), with the newer page: address search, lot lines from public parcel services, and text fixes.
- **Round 8.6 code is in `pipeline/`.** It brings transit selection 24 (213 refused feeds retried), the sheriff crime-rate fix and town and township names in the Northeast. It also has same-city neighborhood labels and the numbers-lens fixes; see `w5/round86/REPORT-round8.6.draft.md`.
- **The round 8.6 re-run stopped part way.** It had started 321 of its 712 counties when the disk filled, and then the machine restarted. Batch 7 (150 new counties) had built 88. To finish:
  1. re-run the remaining counties;
  2. run `w5/round86_finish.sh` (Orange regression, effect checks against round 8.5, regional pages, the site, tests);
  3. publish.

  GitHub Pages allows 1 GB per site, so batch 7's counties need a second data repository; see `w5/round86/README_city-pretty-data.md`.
- **Round 8.7 is planned in `w5/round86/NEXT_ROUND_87_draft.md`.**
  - Location-specific project types: 46 researched, and an independent check confirmed the source of 42 effects and 40 costs (`research/location_types_research.csv`).
  - A layer for big projects: planned transit lines and when nearby prices move, high-speed rail, transmission lines and freeways.
  - Regional costs.
- **Outside research:** 13 research prompts (`scratch_tools/research_prompts.html`) went to other AI assistants. Their checked results are to come back as CSV files in the formats set by the hand-off prompt on that page.

## Rules the work follows

- Every number traces to a primary source, with its URL and a verbatim quote, or it is labelled an estimate.
- No synthetic data, ever.
- Existing projects' scoring formulas in `engine.py` are not changed. New project types are added alongside them, and ids and keys stay stable.
- Research and AI-written answers are leads, used only after the primary source is checked.
- Bot checks (Cloudflare, Incapsula, Akamai) are never bypassed.
- Downloaded files are untrusted. Each goes in its own new directory and is read with `python3 -I`.
- No secrets in code or in environment variables, and no personal data (owner names, mailing addresses).
