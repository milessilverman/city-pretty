# City Pretty: game plan from accurate data to the full vision

Written 16 November 2026. Replaces the roadmap section of `GRAND-VISION-AND-ECOSYSTEM.md`, whose "completed" checkmarks
were not true (see `DATA-AUDIT-AND-TRANSPARENCY.md`).

## The rule everything rests on

**A number reaches the user (or the AI) only if it came from a named source we fetched, with the URL and date, or it is
labeled as an assumption with its basis. Otherwise it is blank and says "not on file".** Every record carries a
`verification` status (`verified`, `partially_verified`, `could_not_check`, `unverified`). The test suite fails if a
record claims `verified` without evidence. When anyone (human or AI) finds a mistake, it goes into the audit log the
same day, even if the fix comes later.

The second rule: **pull data from the source by script, don't type it.** Hand-typed numbers are where nearly all of the
fabrication came from. `scripts/fetch_hud_fmr.py` is the pattern: it pulls HUD's rents for all 3,222 counties straight
from HUD, and can be re-run any time.

## What the finished product does

One AI advisor that answers, for any budget from $100K to $100M+:
**where to buy, what to build or improve, when, why, how much it costs, how much it makes, and what it does for the
community**, at house, neighborhood, city, region/state and national scale. It works with two sister apps:

- **StreetForge** (separate app): exact cost and trade-offs of a street or infrastructure change (bike lane vs drive
  lane, EV charger placement) using OSM, utility and bid-price data, net of grants and tax credits.
- **EverySpace** (separate app): rents out every part of a held property (driveway, attic, pool, roof, whole house)
  so properties make money while they're held for redevelopment.

City Pretty calls them through defined interfaces; it does not fake their outputs.

## Phases

Each phase has a finish line you can check. Nothing is marked done until its check passes.

### Phase 0: clean foundation (started 16 Nov 2026)

| Item | Status | Finish line |
|---|---|---|
| Audit every data file and the app's hardcoded numbers | **Done**, evidence in `docs/audit/` | Every file has a per-record `verification` status |
| Replace hand-typed HUD rents with HUD's own data | **Done**: 3,222 counties via script | Test checks the file came from the script and spot-checks values |
| Remove fabricated valuation back-test, sites, railyard picks, invented studies | **Done** (see audit doc) | Nothing fabricated remains in `app/data` |
| Remove invented dollar outputs from the app (strategy cards, simulator, P3 numbers, prospectus) | **Done**; improvement catalog and upgrade table gated on verification | Page shows "not modeled yet" instead of invented numbers |
| Provenance test in CI | **Done** | `npm test` fails on any `verified` record without evidence |
| Re-check the 8 unit costs and 2 rail corridors we couldn't reach from the build machine | **Open** | Fetched from a machine that can reach TxDOT/ADOT/FRA |

### Phase 1: sourced facts and a connected AI advisor (started)

Done this session:
- `workers/sources.ts`: live connectors that return a value **with its source URL** or `null` with a reason:
  Census Geocoder (address → coordinates; coordinates → county/tract/block group/city), HUD Fair Market Rents,
  USGS elevation, FEMA flood zone, Census ACS (home value, rent, income, tenure, vacancy), OpenStreetMap via Overpass
  (buildings with height/levels, parking lots, rail stations, golf courses, EV chargers, power lines, bike lanes).
- `workers/advisorAgent.ts`: the Claude advisor loop with these as tools. The system prompt requires every fact to
  come from page data or a tool result, with the source named. Answers come back with the list of sources consulted.
- `GET /api/facts?lat=&lng=` on the Worker.
- Tests use real responses captured from each service (`tests/fixtures/sources/`).
- An evaluation set (`tests/eval/advisor_questions.json`, run with `npm run eval:advisor`): 22 questions. 16 have
  answers pulled live from HUD and FEMA for 8 addresses in 8 metros. 5 are traps with no sourced answer (a sale price,
  a "mural study", the Phoenix–Tucson rail cost, a by-right lot split, a street-tree ROI); the advisor passes only by
  saying it doesn't know. 1 checks the geocoder trap below.
- Found while building it: the Census Geocoder matched "200 **N** Spring St, Los Angeles" to "200 **S** Spring St"
  without saying so. The connector now flags any house-number or street-direction mismatch.
- The Worker bundles for Cloudflare (`wrangler deploy --dry-run`, 191 KB gzipped). It has not been run on Cloudflare.

Honest limits: the Overpass (OSM) connector is **untested against the live service**, because the build machine
can't reach it. ACS needs a free key. The AI has not answered a real question yet, because no API key is configured.

**What I need from you to finish Phase 1:**
1. `wrangler secret put ANTHROPIC_API_KEY`, then `wrangler deploy`, then put the Worker URL in `app/config.js`.
2. A free Census key from https://api.census.gov/data/key_signup.html, then `wrangler secret put CENSUS_API_KEY`.

Also done (16 Nov, round 2):
- **The parcel panel shows live public records** (HUD rent, FEMA flood zone, USGS elevation, Census area), each
  linked to its exact query, straight from the agencies. This works before the Worker is deployed (`app/facts.js`).
- **The advisor reads City Pretty's audited tables** (`workers/localData.ts`): state housing laws, funding programs,
  research, unit costs, transit projects, county data coverage, improvement evidence. Each record reaches the model
  with its verification status; fields found fabricated are stripped. The eval set has 26 questions.

Next in Phase 1:
- Run the evaluation set once the key is in; it must pass 26/26 before advisor changes ship. Grow it to 100+.
- A county parcel tool for the advisor (LA's assessor service is live and public).

### Phase 2: parcel-level truth nationwide

What "which house should I buy" needs, with the cheapest honest source for each:

| Need | Free source | Paid source (price checked 16 Nov 2026 where published) |
|---|---|---|
| Parcel lines, owner, land use | County GIS portals (many are ArcGIS services, like LA's) | Regrid: nationwide, price not published (contact sales) |
| Sales prices (for valuation and back-tests) | County recorders (some publish; many don't) | RentCast API: free 50 calls/mo, then $74 / $199 / $449 per month. ATTOM: pricing page not reachable; unknown |
| Rents | HUD FMR (done), Census ACS (done) | RentCast (above) |
| Zoning | City GIS where published; National Zoning Atlas (partial coverage) | Regrid zoning add-on (price not published) |
| Building permits / renovation activity | Some cities' open data | Shovels: free 500 records/mo, $599 / $999 per month |
| Building height, footprint | OSM tags (done), USGS 3DEP elevation (done) | none needed to start |
| Construction costs | State DOT bid tabs (some verified in `unit_costs.json`) | RSMeans: from $408 / $1,049 / $5,973 per year |
| Commercial comps, vacancy | none good | CoStar: pricing page blocked; unknown |

**First real back-test (LA, 16 Nov):** using Prop 13 base-year resets as a sale-price proxy (50,720 homes that changed
hands in 2025–26), the page's home-value model had an 18.8% median error and did **worse than the neighborhood
typical value alone (15.0%)**. LA estimates are now withheld with those numbers shown. Next: (1) rebuild the LA
neighborhood values from the assessor's own base-year resets with the code committed (today's values can't be
traced); (2) replace the model with one that beats that baseline in the back-test before showing any estimate.

**Recommendation:** start with free sources plus RentCast at $74/month. It gives sales comps for back-tests outside
California (the Prop 13 proxy only works in California). Add Regrid when you need more counties
than the free GIS portals cover.

**On CoStar:** copying CoStar data into City Pretty would break its terms of use. CoStar has sued competitors over
copied data (CoStar v. Xceligent is the case I know of; I haven't verified the details this session, so confirm with a
lawyer). The legal route is a license, or building the same picture from public records, which is the plan above.

Finish line: for a test county, the valuation estimate is back-tested against at least 200 real recorded sales and its
real error is shown. Where the error is too high, the estimate is withheld.

**Status (16 Nov 2026):** done for LA County with a public-record proxy (Prop 13 base-year resets, 50,720 homes;
`scripts/backtest_la_valuation.mjs`). Result: the model's median error is 18.8%, worse than the neighborhood's typical
value alone (15.0%), so LA estimates are now withheld. Next: refit the model on this sample, with a holdout set it
never sees, and re-test; it only goes back on the page if it beats the neighborhood value. Repeat for counties whose
assessors publish sale prices or market values.

### Phase 3: what improvements are worth (house and neighborhood scale)

- **The improvement catalog is the biggest gap.** 1 of 81 improvements is fully sourced; 50 have no checkable source
  (see the audit). Priority order: (1) re-run the street-tree hedonic regression on real sales with the code committed,
  so it can be reproduced; (2) source the effect and cost for the ~10 improvements people ask about most (trees, bike
  lanes, parks, transit stations, ADUs, lighting, sidewalks); (3) make the pipeline read only confirmed rows of
  `research/effects.csv`, with a test.
- Rebuild the research library from **real** studies only (Crossref-verified DOIs), with the effect size copied word
  for word from the paper and the page number. Today most studies in the library fail this (see audit).
- Homeowner renovation check: upload a quote; the advisor compares each line to sourced costs (RSMeans or local bid
  data) and to sales evidence of what that improvement adds. Where the evidence doesn't exist, it says so.
- Underused land: golf courses, parking lots and vacant parcels from county assessor data plus OSM, each with flood
  zone, transit distance and zoning from live sources.

### Phase 4: city, region and state scale

- **Transit questions** (e.g. "should there be a Phoenix–Tucson train, and where should the stations go?"): commute flows
  from Census LODES (free, reachable), population and growth from ACS, existing studies from ADOT/FRA (to be fetched
  and cited), and land prices near candidate stations from Phase 2 data. The advisor must label ridership and cost
  estimates as models with their inputs shown. It cannot cite a study we haven't fetched.
- **Policy and opportunity feed:** city council legislation via Legistar's public API (works for Austin and Phoenix,
  tested), federal grants via Grants.gov search (tested), FTA transit projects, ballot measures (Ballotpedia's API
  needs a paid key; price unknown). This is how the advisor finds "this city is drafting a P3 for X" or "a ballot
  measure for Y is being drafted". It must link the actual agenda item.
- **Funding and tax measures:** a table per jurisdiction of programs, eligible projects, funding share, how to apply
  and deadlines. Every row comes from the program's own documents (laws/funding audit in `docs/audit/`).

### Phase 5: capital allocation ($100K to $100M+)

The advisor ranks options for a budget across scales, showing for each: cost, expected return **as a range with its
evidence**, community impact, timing, risks, and which inputs are assumptions. Money questions only after Phases 2–4
give it real inputs; until then it answers with what is known and says what is missing.

### Phase 6: StreetForge and EverySpace integration

- Define the interface: City Pretty sends a site and a proposed change; StreetForge returns cost, trade-offs and
  funding, each with sources. City Pretty sends a property; EverySpace returns rentable spaces and their income
  evidence.
- The previous build had StreetForge/EverySpace "engines" inside City Pretty. They never ran, their numbers were
  invented, and they cited tax rules that are wrong as of 2026 (the §30C EV charger credit expired 30 June 2026).
  They were removed. The real versions belong in those apps, built on sourced data.

## How I'll report progress

Every work session ends with:
1. What was done, and the check that proves it (test output, source fetched).
2. **What I got wrong or couldn't verify**, before anything else, so it can't compound.
3. What's next, and anything I need from you (keys, money decisions).
