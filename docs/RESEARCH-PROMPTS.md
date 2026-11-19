# Research prompts to send out

Written 19 Nov 2026. Each prompt below is self-contained: paste it as-is into a research tool. Send the answer back
unchanged. A cheaper agent then loads it into a data table, re-fetches a sample of the sources to confirm the quotes,
and wires it into the page. Anything whose quote cannot be confirmed is left out.

Every prompt ends with the same answer rules, so they are written once here and referred to as **[ANSWER RULES]**.
When sending a prompt, paste this block in place of that tag.

```
ANSWER RULES
- Use only primary or official sources: government agencies, statutes, agency budgets and board reports, published
  datasets, peer-reviewed papers, and the organisation's own documents. News articles and blogs may only point to one.
- For every figure give: the value, its unit, the year it applies to, the place it applies to, the exact source URL,
  and a verbatim quote of at most 300 characters from that source containing the figure. No quote, no figure.
- If sources disagree, give each with its quote; do not average or pick one silently.
- If you cannot find something, write "not found" and say where you looked. Never estimate or fill in from memory.
- Say whether each dataset can be downloaded in bulk or by API (give the URL), what it costs, and whether its
  licence allows the figures to be shown on a public website.
- Return the answer as (1) a short summary, then (2) a CSV or JSON table with one row per figure and the columns
  named in the prompt plus: value, unit, year, place, source_url, quote, licence_note.
```

---

## 1. What a building costs to build, by type and place (including prefabricated)

```
I need construction cost per square foot for new residential and mixed-use buildings in the United States, by
building type and by metro area or state, from sources that are free to use and can be shown on a public website.

Find and extract:
a) The International Code Council's Building Valuation Data (latest edition): the full table of cost per square foot
   by occupancy group and construction type, the edition date, and ICC's terms for reusing it.
b) Any free regional cost modifiers that adjust a national figure to a metro or state (for example the Department of
   Defense Area Cost Factors, HUD or GSA cost indices, state housing agency cost limits, LIHTC total-development-cost
   limits per unit by state). For each: the table of factors and how the agency says to apply it.
c) Published costs of prefabricated / modular / panelised multifamily buildings versus conventional construction:
   cost per square foot and schedule (months) from named projects or studies (e.g. Terner Center, McKinsey, HUD PD&R,
   state housing finance agencies, modular manufacturers' published case studies). Give each project or study its own row.
d) Per-unit total development costs for recent affordable housing projects by state from housing finance agency
   reports (LIHTC cost reports).
e) Cost to build an accessory dwelling unit (detached, attached, garage conversion) from city or state permit data
   or agency studies, by city.

Columns: item, building_type, construction_method (conventional | modular | panelised), measure (cost_per_sqft |
cost_per_unit | cost_factor | months_to_build).
[ANSWER RULES]
```

## 2. What an addition adds to a home's value

```
I need measured evidence of how much value specific changes add to a US single-family home or lot, with enough detail
to apply it by region.

Find peer-reviewed or agency studies (and assessor / appraisal studies using recorded sales) that estimate the sale
price effect of: an added bedroom; an added bathroom; added living area (price per added square foot, including
whether it declines with size); an accessory dwelling unit; a garage or added parking space; a second storey; rooftop
solar; a lot split or the right to build more units on a lot (upzoning value capture). For each estimate give the
effect size as the study states it (percent or dollars), the confidence interval or standard error if given, the
sample (place, years, number of sales), and the method.

Also find any free public dataset that gives sale prices together with bedrooms, bathrooms and living area for many
US counties (assessor open data portals, state sales files), listing each county or state, the download URL, the
years covered, and the licence.

Columns: change, effect, effect_low, effect_high, sample_place, sample_years, n_sales, method.
[ANSWER RULES]
```

## 3. How many people will ride a new transit line

```
I need published, citable methods and coefficients for estimating ridership at a new US transit station or line from
what is around it, simple enough to compute from Census data.

Find and extract:
a) Direct ridership models (station-level regression models) from TCRP reports, FTA, MPOs or peer-reviewed papers for
   light rail, heavy rail, commuter rail, bus rapid transit and streetcar: the full equation, every coefficient, the
   variables' definitions and units (e.g. population and jobs within a half mile, parking spaces, feeder bus lines,
   service frequency), the R-squared, and the cities and years it was fitted on.
b) FTA's STOPS model: what inputs it needs, where its default parameters are published, and whether a simplified
   sketch-level version is published.
c) Measured elasticities of ridership with respect to service frequency, fare, travel time, and station-area
   households and jobs, with their sources.
d) Observed boardings per station for existing US systems by mode (National Transit Database, agency ridership
   reports, GTFS-ride), with the download URL for each dataset.
e) Trip generation and transit mode share of transit-oriented housing (vehicle trips per unit, transit share within
   a half mile), e.g. TCRP Report 128 and later studies.
f) For intercity rail: the methods and published ridership forecasts in Amtrak and FRA corridor studies, with the
   forecast riders per year per corridor where stated.

Columns: mode, model_or_measure, equation_or_value, variable_definitions, fitted_on, r_squared.
[ANSWER RULES]
```

## 4. What transit costs to run and what fares bring in

```
I need operating cost and fare revenue figures for US transit by mode and agency, to estimate a new line's yearly
operating cost, fare revenue and funding gap.

From the National Transit Database (latest report year; give the exact table names and download URLs) extract, by
mode and for each of the 50 largest agencies plus national averages: operating expense per vehicle revenue hour,
per vehicle revenue mile and per unlinked passenger trip; average fare revenue per unlinked passenger trip; farebox
recovery ratio; average trip length; vehicle revenue hours per route mile.

Also find: capital cost per mile of recent US projects by mode (FTA Capital Investment Grant project profiles, the
Transit Costs Project dataset), with year-of-expenditure dollars; vehicle purchase costs by type; station costs by
type (at-grade, elevated, underground) where agencies publish them; and typical annual state-of-good-repair
reinvestment as a share of capital value.

For intercity rail, extract Amtrak's route-level operating revenue, expense and ridership (Amtrak monthly
performance reports / annual route financials) for every route.

Columns: agency, mode, measure, report_year.
[ANSWER RULES]
```

## 5. Who pays for transit: grants, loans and value capture

```
I need the funding sources a US transit or passenger rail project can use, with the rules that decide how much each
can cover, so a model can split a project's cost between fares, federal, state, local and private money.

For each of the following give: the statute or programme citation, who can apply, eligible costs, the maximum share
of project cost it can cover, typical award sizes in the last three years (with examples), match requirements, and
application timing: FTA Capital Investment Grants (New Starts, Small Starts, Core Capacity); FRA Federal-State
Partnership and Corridor ID; CRISI; RAISE/BUILD; TIFIA and RRIF loans (terms, interest rate basis, maximum share,
including the transit-oriented development eligibility); private activity bonds; state transit capital programmes
for the 15 most populous states; local option sales taxes and how many passed in the last five years with their rates.

Value capture: tax increment financing, special assessment and benefit districts, station-area impact fees, joint
development (FTA Circular 7050.1), air-rights sales and ground leases. For each give the enabling law in the 15 most
populous states and at least three real projects that used it, with the dollars raised and the share of project cost.

Public-private partnerships: for each US transit or rail P3 that reached financial close (for example Denver Eagle
P3, Maryland Purple Line, LAX people mover, Brightline), give the structure, the private partner's role, the payment
mechanism (availability payment, farebox, real estate), total cost, and public share.

Columns: source_type, programme_or_project, jurisdiction, max_share_of_cost, amount, terms.
[ANSWER RULES]
```

## 6. Public money for the homes: affordable housing funding

```
I need the public funding a developer can use when a share of homes in a new US building is affordable, by state,
with enough detail to estimate dollars per unit.

For the federal Low-Income Housing Tax Credit (4% with bonds, and 9%): how the credit amount is computed, current
credit pricing (cents per dollar) from published syndicator or agency surveys, each state's per-capita allocation
and its cost and basis limits. For HOME, CDBG, the Housing Trust Fund, Section 8 project-based vouchers and HUD 221(d)(4):
what each pays for and typical dollars per unit. For the 15 most populous states: state housing tax credits, housing
trust funds, property tax exemptions or abatements for affordable or mixed-income housing (statute, percent, term,
income limits), density bonus laws (how many extra units for what share of affordable units) and transit-oriented
housing programmes.

Also give the download URL and format for HUD's income limits and rent limits by county (the affordable rent a unit
can charge at 30%, 50%, 60%, 80% and 120% of area median income).

Columns: programme, jurisdiction, what_it_funds, amount_or_rate, income_limit, term_years, statute.
[ANSWER RULES]
```

## 7. Planned passenger rail in the United States and where it stops

```
I need a complete list of planned or proposed new passenger rail service in the United States and the places it
would stop, from official documents only.

Cover: every corridor selected in FRA's Corridor Identification and Development Program (all rounds); every corridor
in Amtrak's long-term expansion vision ("Amtrak Connects US" and later updates); every preferred route in FRA's
Long-Distance Service Study final report; state rail plans' proposed new services for the 20 most populous states;
high-speed projects (California High-Speed Rail, Brightline West, Texas Central, Cascadia) with current status.

For each corridor: sponsor, document name and date, type (new, extension, added frequency, high-speed), current
stage, endpoints, EVERY stop city or station the document names (one row per stop, with state), proposed daily round
trips and trip time if stated, capital cost and forecast annual riders if stated, and target opening year if stated.
Do not add stops the document does not name.

Columns: corridor, sponsor, document, document_date, stage, stop_city, stop_state, stop_order, measure.
[ANSWER RULES]
```

## 8. Local transit lines being planned, city by city

```
I need a list of new local transit lines (light rail, streetcar, bus rapid transit, heavy rail and commuter rail
extensions) that US agencies are planning, designing or building, with their station locations.

Sources: FTA's Capital Investment Grants annual report and current project profiles (every project in Project
Development, Engineering or with a grant agreement); each agency's project page; adopted long-range plans of the 50
largest metropolitan planning organisations for projects with funding identified.

For each project: agency, mode, length in miles, number of stations, EVERY station name with its cross-streets or
coordinates if the agency publishes them (and the URL of the agency's station list, map or GIS file), capital cost in
year-of-expenditure dollars, federal share requested, forecast daily boardings (opening year and horizon year),
current stage, and planned opening year. Note which agencies publish a joint-development or station-area land policy
and link it.

Columns: agency, project, mode, stage, station_name, station_location, measure.
[ANSWER RULES]
```

## 9. Renting out every space: parking, storage and short-term uses

```
I need measured rental income figures for the spaces in and around a residential or mixed-use building in the United
States, by city, from sources whose figures may be shown on a public website.

Find, for as many of the 50 largest US metros as possible: monthly rate for an off-street residential parking space;
hourly and daily public parking rates; monthly rate for commercial vehicle or fleet parking and for electric vehicle
charging stalls (revenue per port per day where published); self-storage rent per square foot per month by unit
size; short-term ("pop-up") retail rent; rooftop lease rates for cellular antennas and for solar; billboard or
signage lease rates; rents for vacant ground-floor retail used as storage or micro-fulfilment; event-space hourly
rental of yards and pools.

Prefer: city parking authority rate schedules and audits, public REIT filings for self-storage and parking
operators (rent per square foot and occupancy by market), state utility commission filings for charging revenue,
academic or agency studies. Marketplace listing sites may be cited only if their terms allow reuse; say what the
terms state. For each figure state whether it is an asking rate, an achieved rate or an average, and the occupancy
that goes with it if given.

Also find the rules that limit these uses: cities that cap or ban renting residential parking to non-residents, and
zoning treatment of storage or delivery uses in residential and mixed-use zones for the 10 largest cities.

Columns: space_type, metro, rate, rate_basis (asking | achieved | average), occupancy.
[ANSWER RULES]
```

## 10. What streets and utilities cost to build or change (for StreetForge)

```
I need unit costs for changing a US city street and its utilities, from awarded public bids or agency cost manuals,
by state.

For each of the 15 most populous states, find the state DOT's published average unit bid prices (give the download
URL and the period covered) and extract the items a street rebuild uses: pavement removal and replacement per square
yard, curb and gutter per linear foot, sidewalk per square foot, curb ramps each, striping, protected bike lane
separators, bus boarding islands and shelters, street trees with tree wells, street lighting, traffic signals,
storm drain pipe by diameter per linear foot, catch basins and bioswales.

From water, sewer and electric utilities' capital plans, rate cases or bid tabs, find: water main and sewer main
replacement cost per linear foot by diameter; new service connection fees and capacity or impact fees per dwelling
unit for the 20 largest cities; electric distribution line extension and transformer upgrade costs and each
utility's line-extension allowance rules; cost to underground overhead lines per mile; cost to install a Level 2 and
a DC fast electric vehicle charger including make-ready work (NREL, state energy offices, utility make-ready
programme filings) and the incentives that offset it (NEVI formula programme rules, the federal 30C credit, utility
rebates) with amounts.

Also list public datasets that map where pipes and wires are (city open-data water, sewer and storm networks;
utility hosting-capacity maps for the 20 largest utilities), with URLs and licences.

Columns: item, unit, state_or_city, bid_period, low, average, high.
[ANSWER RULES]
```

## 11. What rising transit and neighborhood investment does to property values

```
I need measured effects on property values and rents from new transit stations and from neighborhood improvements,
with distance bands and timing, from peer-reviewed or agency studies of US cities.

Transit: for light rail, heavy rail, commuter rail, bus rapid transit, streetcar and intercity rail stations, the
change in home sale prices, land values, residential rents and commercial rents by distance from the station
(quarter mile, half mile, one mile), and WHEN it happens (at announcement, during construction, at opening, five
years after). Give every study its own rows, including studies that found no effect or a negative one.

Other improvements, each with effect size and distance: new or renovated public schools and school quality ratings;
street trees and parks; protected bike lanes and road diets; sidewalk and lighting upgrades; vacant-lot greening;
main-street and business improvement districts; new grocery stores; removal of surface parking; upzoning.

Also: studies of how much of the value increase near new stations was captured by public agencies, and studies of
displacement and rent burden after new stations opened.

Columns: improvement, mode, distance_band, timing, outcome (sale_price | land_value | rent | commercial_rent),
effect, effect_low, effect_high, city, study.
[ANSWER RULES]
```

## 12. Zoning and land ownership data that can be used for free

```
I need free, machine-readable sources of zoning, parcel ownership and publicly owned land for US cities.

For each of the 100 largest US cities and their counties: the URL of the zoning district GIS layer (ArcGIS REST,
Socrata or download), the field holding the zone code, the URL of the zoning code text with the table of permitted
uses, density, height, floor-area ratio, lot coverage, setbacks and parking minimums per zone, the date last updated,
and the licence. Note the National Zoning Atlas coverage and download terms for each state.

For publicly owned and surplus land: each city, county, school district, transit agency and state's surplus-property
list or inventory URL; federal real property (GSA FRPP public dataset); transit agencies' joint-development site
lists. For school sites: where districts publish closed or under-enrolled schools and enrollment by school
(state education department data URLs for the 15 most populous states).

Columns: jurisdiction, dataset, url, format, key_fields, last_updated, licence.
[ANSWER RULES]
```
