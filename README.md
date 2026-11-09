# City Pretty

A civic data map of **639 US counties** (48 contiguous states, DC and Puerto Rico; 269 million people). For each block group it scores
what a city could build or fix there (parks, street trees, bus service, safer streets, clinics, schools and more) from public data, and
shows the sources behind every number.

**Open the map: https://milessilverman.github.io/city-pretty/**

Pick a county from the list on the front page; its data loads when you open it.

## What is here

| Path | What it is |
|---|---|
| `index.html` | the national page (map, county picker, scoring engine; LA and Orange County are built in) |
| `counties/bundle_<FIPS>.json.gz` | one county's data, loaded when you pick it |
| `counties/sites_<FIPS>.json.gz` | one county's site suggestions (specific parcels and corridors) |
| `counties/manifest.json` | the list of counties and their files |
| `docs/` | the round 8.5 report, its errata to round 8.4, the pipeline README, the next-round plan and a quality table per county |

The page has to be served over the web, as GitHub Pages does here: opened from a file on your computer, it cannot load the county files,
because browsers do not let a local page read other local files.

## Version

Round 8.5, built 8 Nov 2026; documents revised 9 Nov 2026 after the pre-delivery audit (`docs/REPORT-round8.5.md`, section 8). Round 8.6,
in progress, re-runs every county with corrected bus measurements and adds 150 counties; this repository will be updated when its
tests pass.

## Sources

Every county page has a sources table: Census TIGER and the ACS 2020–2024, OpenStreetMap, GTFS transit schedules (MobilityData's
catalog), state and county crash data, NREL's charger data, American Forests' Tree Equity Score and others. Numbers trace to these
sources or are labelled as estimates. `docs/pipeline-README.md` describes how each county is built.
