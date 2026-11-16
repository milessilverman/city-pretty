# City Pretty

A civic data map of **639 US counties** (48 contiguous states, DC and Puerto Rico; 269 million people), plus 67 more
where only live property lines are shown so far. For each block group it scores what a city could build or fix there
(parks, street trees, bus service, safer streets, clinics, schools and more) from public data, and shows the sources
behind every number.

**Open the map: https://milessilverman.github.io/city-pretty/**

Pick a county from the list on the front page; its data loads when you open it.

**Update, 9 Nov 2026:** the search box now finds any US street address (the U.S. Census Bureau geocoder, then OpenStreetMap's
Nominatim): press Enter and the map opens that address's county and neighborhood. Orange County's tree-canopy and crime figures are
corrected (a canopy gap was scaled twice; the sheriff's rate now counts residents of unincorporated communities), and several
sentences are clearer. The other counties' files are still round 8.5's; the round 8.6 rebuild with the same fixes is running.

**Lots, 10 Nov 2026:** zoom in to street level (zoom 17+) with "Property lines" on to see lot lines, and click a lot for its public record
(parcel number, site address, land use, assessed or appraised value, where the county publishes them; never owner names). The lines come
live from each state's or county's own open parcel service: statewide in 27 states and DC, plus New York City, Maricopa, Cook, San Diego,
Franklin (OH), Fulton (GA), Allegheny and Clark (NV) counties. An address search outlines its lot.

**Fixes, 14 Nov 2026:** the page is no longer one 30 MB file, and a first visit uses about 140 MB of browser memory instead of
about 460 MB (Orange County loads only when opened). The home-value estimate is withheld, with the reason, where it cannot be
right (government and commercial lots, lots the assessor values at $20M or more, estimates under half the assessor's value);
unknown zoning, flood and fire checks say "not checked" instead of defaulting to "allowed" or "no risk"; and block groups named
after a neighborhood label outside them read "Near …". The AI advisor says plainly that it is not connected yet instead of
showing canned answers. Phones get a compact layout.

**Explore mode, 16 Nov 2026:** a Map / Explore switch in the header. Explore shows the same county without a map: cards for
every improvement idea, each explained in plain words (what it is, how sure the estimate is, what it means for renters, who
decides, who could pay, and where in the county it pays off most), a searchable list of neighborhoods with a short story for
each, and a step-by-step "How it works". "See it on the map" opens the same neighborhood in map mode.

## What is here

| Path | What it is |
|---|---|
| `index.html` | the page's markup (map, county picker, panels) |
| `app/app.js`, `app/app.css` | the page's code and styles (edit these directly; there is no build step) |
| `app/explore.js` | Explore mode: idea cards, neighborhood stories and the plain-language explanations of each idea |
| `app/config.js` | site settings: `workerUrl`, the AI advisor's and Street View's server (see below) |
| `app/data/` | LA County and Orange County data, fetched when needed |
| `app/vendor/` | Leaflet 1.9.4 and fflate |
| `counties/bundle_<FIPS>.json.gz` | one county's data, loaded when you pick it |
| `counties/sites_<FIPS>.json.gz` | one county's site suggestions (specific parcels and corridors) |
| `counties/manifest.json` | the list of counties and their files |
| `workers/api-proxy.ts`, `wrangler.toml` | the Cloudflare Worker for the AI advisor and Street View photos (keeps API keys off the page) |
| `src/` | calculation engines and the AI advisor's prompt contract, with unit tests in `tests/unit/` |
| `tests/e2e/` | browser tests of the page |
| `pipeline/`, `national/` | the data pipeline that builds county files (`pipeline/splice_bundle.py` installs a rebuilt Orange County file into `app/data/`) |
| `docs/` | the round 8.5 report, its errata to round 8.4, the pipeline README, the next-round plan and a quality table per county |

## Running it locally

The page has to be served over the web, as GitHub Pages does: opened from a file on your computer, it cannot load the county
files. With Node.js 22:

```bash
npm install
```

```bash
npm run serve
```

Then open http://127.0.0.1:8080/city-pretty/.

## Checks

`npm test` runs the unit tests, `npm run typecheck` checks the Worker, and `npm run test:e2e` runs the browser tests against a
local copy of the page (run `npx playwright install chromium` once first). GitHub runs all three on every push
(`.github/workflows/checks.yml`).

## The AI advisor and Street View (not connected yet)

Both need the Cloudflare Worker in `workers/api-proxy.ts`, which holds the API keys so the page never does. Until it is
deployed and `workerUrl` is set in `app/config.js`, the advisor shows "Not connected" and Street View opens on Google Maps.
To connect the advisor to Claude:

1. Fill in `askAdvisorModel()` in `workers/api-proxy.ts` (it receives the fixed instructions and the conversation; return the
   reply's text) and set `MODEL_CALL_IMPLEMENTED = true`. The prompt is in `src/ai/advisorGroundingContract.ts`.
2. `wrangler secret put ANTHROPIC_API_KEY` (and `GOOGLE_MAPS_KEY` for Street View), then `wrangler deploy`.
3. Put the Worker's URL in `app/config.js` as `workerUrl`.

The Worker only answers the site's own pages, rate-limits each visitor (`wrangler.toml`), and ignores any prompt or model a
caller sends; `/api/health` tells the page whether the advisor is ready.

## Version

Round 8.5, built 8 Nov 2026; documents revised 9 Nov 2026 after the pre-delivery audit (`docs/REPORT-round8.5.md`, section 8).
Page fixes 14 Nov 2026 (above). Round 8.6, in progress, re-runs every county with corrected bus measurements and adds 150
counties; this repository will be updated when its tests pass.

## Sources

Every county page has a sources table: Census TIGER and the ACS 2020–2024, OpenStreetMap, GTFS transit schedules (MobilityData's
catalog), state and county crash data, NREL's charger data, American Forests' Tree Equity Score and others. Numbers trace to these
sources or are labelled as estimates. `docs/pipeline-README.md` describes how each county is built.
