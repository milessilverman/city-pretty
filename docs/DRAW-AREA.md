# Draw an area

The map's "Draw an area" control lets a visitor draw any shape, or a circle around a point, and see what the data on
file says is inside it. The shape does not have to follow neighborhood lines.

- Page code: `app/draw-area.js` (the control, the drawing, the panel). It computes no figure.
- Rules: `src/engines/areaAggregationEngine.js` (pure functions; `tests/unit/areaAggregationEngine.test.ts`).
- Ideas, housing plays and the transit screen come from `src/engines/investmentDecisionEngine.js`; courses of action
  from `src/engines/projectCardEngine.js`; station-area sites from `src/engines/stationSites.js`.
- Browser tests: `tests/e2e/draw-area.spec.ts`. Live check on the real page: `scripts/live_check_draw_area.mjs`.

## Drawing

- **A shape:** click to add corners; double-click the last corner, click the first corner, or press Finish to close;
  Escape or Cancel stops; Undo removes the last corner. Up to 60 corners. A shape whose lines cross is refused.
- **A circle:** a quarter mile, half a mile or one mile around a clicked point, or around a station or planned stop
  chosen from the list. The list holds the open county's rail stations, the stations of local projects on file and
  the stop cities of rail corridors; a point whose own record says it is not the agency's station site is labelled so.
  The circle is drawn and measured as a 72-sided shape with its corners on the circle (0.13% smaller than the circle).
- **Editing:** drag a corner (or the circle's centre); double-click a corner to remove it.
- One area at a time. It is kept in the link as `area=`: `p_lat_lng_lat_lng...` for a shape, `c_lat_lng_radius` for
  a circle, five decimals (about a metre). The page keeps positions to those five decimals, so a link reproduces the
  shape exactly. Mouse and touch both work; nothing is loaded from outside the site.

## How figures are worked out

The data is per Census block group, and a drawn shape cuts through block groups. For each block group the engine
computes the share of its mapped shape that lies inside the drawn shape. It clips polygons itself (Sutherland-Hodgman
against the convex parts of the drawn shape), in a local flat projection. The block-group shape is the one the map
draws; the county build removes mapped water from it where water is 5% or more (`docs/pipeline-README.md`), so the
share is a share of land there. Overlaps under half a percent of both the block group and the shape are treated as
boundary noise, because neighbouring outlines are simplified separately.

Every figure is `{ value, unit, basis, from, source }`. `from` lists each block group, its share and its own value;
the panel shows it under "How this was worked out".

| Kind of figure | Rule | Tag on the page |
|---|---|---|
| Counts (people, homes, land acres, crashes, property crimes) | sum of share x the block group's count | "Estimated by area", with "estimated from N block groups by area" and the largest partial share. "Exact" when every block group is wholly inside |
| Medians (home value, rent, income, year built) | never averaged into one figure: the lowest and highest block-group median, plus a homes-weighted average of medians labelled exactly as that | "Range" |
| Shares and rates with their denominator on file (homes in single-unit buildings, violent crime per 1,000 residents) | turned back into counts, apportioned, and divided again | "Estimated by area" |
| Shares whose denominator is not on file (owner-occupied, households without a car) and levels (heat, canopy gap, buses per hour at the busiest stop, park acres within half a mile) | lowest and highest block-group value | "Range" |
| Homes per acre, people per square mile | apportioned homes or people divided by apportioned land | "Modelled" |
| Points (stations, bus stops, redevelopment sites, suggested places) | counted only if the point, or the centre of the site's outline, is inside the shape | "Exact" |

- A value a block group does not have stays missing. The figure says how many block groups had none, and a count
  says the real figure is higher.
- A Census top code (for example a home value published only as "$2,000,000 or more") is named, because it makes the
  high end and the average too low.
- Home values that are the surrounding tract's median are counted and said.
- Area weighting assumes people and homes are spread evenly across a block group. That is false where part of one is
  a park, a campus, water or an industrial yard. The page says so on every apportioned figure.

## What to build

The decision engine's `recommendForNeighborhood` runs on every block group touched. For each idea the panel shows
the block-group estimates of home value per dollar as a range, and their average weighted by the share of each block
group inside the shape. An idea whose figures are withheld in a block group (not confirmed by the data audit, or its
study does not apply there) adds nothing from that block group and is listed by name. Costs are never added across
block groups: neighbours can list the same project (the same park), so a sum could count it twice. Housing plays keep
the engine's "not determined" answers. Where the project card engine can assess a course of action for the area or
for a site with a zoning code on file, its card is shown; otherwise the missing fact is named.

## Land to redevelop

Candidates inside the shape come from:

- the station-area sites files (`app/data/station_sites/<fips>.json`): surface parking, vacant or brownfield land
  and golf courses near stations and stop cities, measured from OpenStreetMap and matched to the county parcel
  record where a service is on file;
- for Los Angeles County, the underused-land inventory in the county data file (the same lot can be in both lists);
- for other counties, the parking lots the county's site suggestions list.

For each candidate the panel says what the record can and cannot say: its zoning code or "not on file"; the state-law
answer from the statute engine when a zoning code is on file, "not determined" otherwise; whether its centre is
within half a mile, in a straight line, of an existing station or one under construction on file (planned stops whose
positions their own record marks unverified are not used); and which facts block a recommendation (zoning, owner,
cost, overlay checks). Estimates in the Los Angeles file that the data audit could not check (market land value,
homes it could hold, margin, suggested use) are not shown. No public owner is named in the Los Angeles inventory.

**There is no "build X to get Y redeveloped".** The repository has no sourced study or record linking a public
project to a nearby lot being redeveloped. The panel says so and lists the data that would be needed: recorded sales
and permits around past projects, owners and lease terms, local zoning rules, construction cost and land prices, and
overlay checks for each site.

## Transit

`evaluateTransit` is run with the area's apportioned density (homes inside divided by land acres inside, times the
manual's 1.5 gross-to-net factor). It is a planning rule of thumb, not a forecast. Riders, fares and operating cost
are not given for a drawn area: the ridership model works on a line (its length and stops), not on a shape.
Bus stops counted are the busier stops the county data file keeps on its stops layer, not every stop; the panel
states the layer's lowest frequency.

## Limits (this tool's own working rules, not thresholds from a published source)

- **Smallest area:** if the shape covers less than 25% of every block group it touches, block-group figures are not
  shown, only the exact point data.
- **Largest area:** 150 block groups. Beyond that the panel asks for a smaller area.
- A shape outside the open county says so.

## What it cannot know

- The median home value, rent or income of the drawn area. That needs household-level records.
- Where inside a block group people live.
- Who owns a site, what it would cost to build on, or what it would sell for, unless the record on file says so.
- What would cause a site to be redeveloped.
- Ridership for the area.
- Anything about a county that is not open on the map.

## The advisor

"Ask the advisor about this area" adds `drawn_area` to the advisor context: the engine's compact summary, at most
6,000 characters (`DRAWN_AREA_MAX_CHARS` in `src/ai/advisorGroundingContract.ts`; a larger one is dropped whole with
the reason). It stays until the area is cleared. The prompt tells the model never to present a range or a weighted
average of medians as the median of the area.

## Worked example

Half a mile around the Downtown rail station in Austin (Travis County, TX), opened on the real page on 22 Nov 2026
by `scripts/live_check_draw_area.mjs`. Link: `#county=48453&area=c_30.26478_-97.73841_0.5`.

| What the panel showed | Figure | Tag |
|---|---|---|
| The shape | 502 acres (0.78 square miles), 10 block groups in 9 named neighborhoods, 9 of them cut by the circle | Exact |
| People | about 6,140 | Estimated by area |
| Homes | about 4,494 | Estimated by area |
| Land inside the shape | about 471 acres (the rest is mapped water) | Estimated by area |
| Homes per acre of land | 9.5 | Modelled |
| Typical home value | $389,700 to $1,195,800 across the block-group medians; no median for the area | Range |
| Median rent | $1,744 to "$3,500 or more" a month (a Census top code) | Range |
| Median household income | $110k to $220k | Range |
| Homes in single-unit buildings | about 5% | Estimated by area |
| Owner-occupied | 4% to 72% | Range |
| Buses per hour at the busiest stop | 0 to 24 | Range |
| Rail stations inside | 1 (Downtown) | Exact |
| Busier bus stops inside | 8 | Exact |
| Redevelopment candidates inside | 9; the largest is a surface parking lot with a matched parcel record, no zoning code on the record, so the state-law answer is "not determined" | Exact |
| Top idea | Rehab or replace blighted homes: $3.05 back per $1 as the share-weighted average; block-group estimates run from $1.21 to $9.35 in 6 of 10 block groups | Range |
| Transit | Screen only, no build decision: 14.3 homes per net acre supports more frequent buses | Modelled |

Check made by the script, without the page's clipping code (a grid count of points inside both the block group and
the circle): 6,145.59 people, 4,498.92 homes and 472.03 land acres, against the panel's 6,140, 4,494 and 471. The
difference (0.1%) is the grid's own error.

In Los Angeles, half a mile around Wilshire/La Brea (`#area=c_34.06254_-118.34438_0.5`): 23 block groups, about
14,514 people and about 9,037 homes (grid count: 14,514.96 and 9,037.69), typical home values from $1,781,561 to
$6,223,983, 1 station, 9 candidates; the largest is a parking lot zoned [Q]C2-1 within walk distance of the station,
for which the statute engine applies a state law on file.

In Lake County, TN, a one-mile circle covers at most 18% of the one block group it touches, so the panel shows the
too-coarse message and only the exact point data.

The same run drew a five-corner shape over three block groups in Los Angeles, Travis and Lake County, TN, at desktop
and phone width, and compared people, homes and land acres with a grid count made in the script: 162 of 162 checks passed.
Results: `data/backtests/live_check_draw_area_2026-11-22.json`.
