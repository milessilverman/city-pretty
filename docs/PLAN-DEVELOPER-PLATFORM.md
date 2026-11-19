# City Pretty: one-month plan to the developer platform

Written 19 Nov 2026 from the owner's description of the goal. Open issues stay in `WORK-QUEUE.md`; what has been
checked is in `DATA-AUDIT-AND-TRANSPARENCY.md`. The accuracy rules in `CLAUDE.md` apply to everything here.

## The goal, in the owner's terms

Go to a city where rail is coming (Austin's light rail, an Amtrak corridor), become the public-private partner, and
redevelop the land around the stations:

- pick the stations and the properties around them worth redeveloping;
- say what kind of transit fits, how many people will ride, what fares bring in, and how much more money is needed;
- say what else to build to raise values (school rebuild, trees, streets) and which public money pays for it;
- build the housing (prefabricated where it saves money), with affordable units that bring public funding;
- rent out every space from day one (parking nobody needs, vacant shops as storage, roofs) so the project always earns;
- price the streets, pipes and wires through StreetForge, and the space rentals through EverySpace;
- give exact projects, steps and costs, and when told "I have $X", find the project that fits.

Rule that does not bend: a figure appears only if it was fetched from its source or computed from figures that were.
Where the data is missing, the page says what is missing.

## What exists today (19 Nov)

- Per-neighborhood data for about 750 counties, checked tables for rents, laws, costs of public works, crash counts.
- The Invest view: where, what to build, properties, this house, transit verdict by density thresholds.
- The advisor, deployed, answering from sourced lookups. Script-first answering is being added.
- County files on Cloudflare R2 (hard limit: never above 10 GB; see `CLAUDE.md`).
- Missing for the goal: building costs, value added, ridership and fare model, funding stack, station lists,
  space-rental rates, utility costs, zoning for most cities, sites outside Los Angeles.

## The four weeks

### Week 1 (20-26 Nov): corridors, stations and the data to price them
- Planned rail: every FRA Corridor ID corridor, Amtrak's expansion vision, the long-distance study routes, with the
  stop cities each document names (in progress). Then local projects with station lists (research prompt 8).
- Research prompts 1, 3, 4, 7, 8 sent out first: costs, ridership, operating cost and fares, corridors, local lines.
- Station areas: for each named stop, the neighborhoods within a half mile and a mile, their homes, jobs, values,
  zoning status and publicly owned or underused parcels. Site discovery from OpenStreetMap and parcel services run
  for station areas first (golf courses, surface parking, vacant and public land), not county-wide.
- Housekeeping finishing now: per-statute exclusions, small counties on R2, site hosting off GitHub Pages.

### Week 2 (27 Nov - 3 Dec): the transit model
- Ridership: a station-level model from published coefficients (prompt 3), computed from Census homes and jobs
  around each stop, shown with the published model's own error. Tested against real boardings of existing stations
  before it is shown for proposed ones.
- Money: yearly operating cost and fare revenue by mode from the National Transit Database (prompt 4); capital cost
  from the benchmark table; the gap; then the funding stack (prompt 5): what federal, state, local and value-capture
  sources can cover under their own rules.
- Output on the page: for a corridor or a drawn line, "mode that fits, riders, fare revenue, operating gap, capital
  cost range, who can pay for what", each figure tagged with its basis.

### Week 3 (4-10 Dec): the development model
- Building costs by type and place, conventional and prefabricated (prompt 1); value added by additions (prompt 2).
- A project pro forma per site: units allowed (where zoning is on file), build cost, affordable share and the public
  money it unlocks (prompt 6), rents from HUD and local data, sale values from the county's tested valuation model.
- Interim and permanent income from every space (prompt 9), as the EverySpace hand-off.
- Street and utility costs per site (prompt 10), as the StreetForge hand-off: a stated interface (inputs City Pretty
  sends, costs StreetForge returns) so the two connect when StreetForge is ready.
- Value uplift from the transit line and the other improvements, by distance and timing (prompt 11).

### Week 4 (11-18 Dec): the project finder and the advisor
- "I have $X": rank station-area projects that fit the budget, with what is built, the public money assumed, the
  return range and what could break it. Scripted where it is arithmetic; the advisor explains trade-offs and reads
  documents.
- Back-tests before anything is called a forecast: ridership model vs real stations; cost model vs awarded projects;
  uplift vs measured studies. Results shown beside each figure.
- Advisor evaluation extended to these questions; cost per question measured.

## How the work is split

- Research prompts (`RESEARCH-PROMPTS.md`) go out through the owner; answers come back as tables with quotes.
- A cheaper agent loads each answer, re-fetches a sample of sources to confirm the quotes, and wires the table in.
- Scripts do the calculations. The advisor is for questions that need judgement, comparison or reading a document.
- Stronger agents are used for models (ridership, pro forma), reviews and anything where a wrong number costs money.

## What the owner needs to supply

- Answers to the research prompts.
- API keys (see `WORK-QUEUE.md` status section): a new Claude key, Census, Google Maps, NREL, Google Solar.
- A decision on paid data once the free sources are loaded: RSMeans for building costs if ICC's free table and state
  cost limits prove too coarse; a sales feed for the non-disclosure states.
- StreetForge and EverySpace interfaces when they are ready.
