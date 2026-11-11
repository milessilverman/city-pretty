# City Pretty: county data (part 2)

This repository holds county data files for the City Pretty map at **https://milessilverman.github.io/city-pretty/**. GitHub Pages
publishes at most 1 GB a site, so the counties are split over two repositories: `city-pretty` holds the page and the counties up to its
share, and this one holds the rest. The page loads a county's two files from here when you open that county:

| Path | What it is |
|---|---|
| `counties/bundle_<FIPS>.json.gz` | one county's data (block groups, metrics, projects, map layers, sources table) |
| `counties/sites_<FIPS>.json.gz` | one county's site suggestions (specific parcels and corridors) |

The list of counties, with the repository each one is in, is `counties/manifest.json` in the `city-pretty` repository. How each county is
built, and the sources behind every number, are described there (`docs/`) and in each county's sources table on the map.

The files are gzip-compressed JSON; the page unpacks them itself, so any static host serves them as they are. Both repositories are
published from the same GitHub Pages origin (milessilverman.github.io), so the page reads them without cross-origin requests.
