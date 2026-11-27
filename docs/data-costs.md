# What the data costs (fetched 2026-11-27)

Everything at zero cost: the street network, rents (HUD county rents, Apartment List city rents), building-permit counts, vacancy counts from the Census, cleanup-site lists and the hosting you already have. What cannot be done without paying (or a sales quote): construction cost by building type (the one published price is a book), market cap rates (the yield an investor expects on a building) and bulk parcel records with assessed land and building values. The only published price that unlocks any part of "return figures" is the RSMeans Square Foot Costs Book at "$566.95", but it covers construction cost only; the prices for cap rates and parcel values are not published, so the single cheapest full paid step cannot be named from what was fetched.

Every price below is quoted from the page named in the table. A row saying "No price stated" means the page shows no charge or price either way. Terms: ACS = American Community Survey (Census yearly household survey); HVS = Housing Vacancy Survey; FMR = Fair Market Rent (HUD's county rent benchmark); ODbL = Open Database Licence.

| What it is for | Option | Free or paid | Price exactly as the page states it | What you get / coverage as stated | Licence or use limits as stated | Page fetched (URL) | Fetched on |
|---|---|---|---|---|---|---|---|
| Cost to build, by building type | RSMeans Square Foot Costs Book (Gordian) | Paid | "2027 Square Foot Costs Book Special Price $566.95 Regular Price $667.00" | Book name only; page gives no coverage text | Not stated on page | https://www.rsmeans.com/products/books | 2026-11-27 |
| Cost to build, by building type | Cotality Marshall & Swift | Paid (price hidden) | Price not published (sales quote required) | "Accurate replacement cost evaluation" | Not stated | https://www.cotality.com/ | 2026-11-27 |
| Cost to build, trend over time | Census Construction Price Indexes | No price stated | No price stated on page | "price indexes for single-family houses sold and for single-family houses under construction" (national, not by building type) | Not stated | https://www.census.gov/construction/cpi/ | 2026-11-27 |
| Cost of street items | State highway bid tabulations in `app/data/unit_costs.json` | Free (already in repo) | Not re-fetched this session | Not re-verified this session | Not re-verified | none fetched | n/a |
| Rents, county level | HUD Fair Market Rents | No price stated | No price stated on page | "Click Here For FY2027 FMRs" (county level) | Not stated on page | https://www.huduser.gov/portal/datasets/fmr.html | 2026-11-27 |
| Rents, city and metro | Apartment List research data | No price stated | No price stated on page | "monthly estimates of the median rent paid for new leases in a given market" | "make accurate, timely, and transparent housing market data available to the general public" | https://www.apartmentlist.com/research/category/data-rent-estimates | 2026-11-27 |
| Rents, survey based | Census ACS | No price stated | No price stated on page | "Access demographic, economic and population data from the U.S. Census Bureau." | Not stated | https://www.census.gov/programs-surveys/acs/data.html | 2026-11-27 |
| Cap rates (investor yield) | Green Street (private market data) | Paid (price hidden) | Price not published (sales quote required) | "Private Market Data" listed; page offers "Request a Demo" | Not stated | https://www.greenstreet.com/ | 2026-11-27 |
| Parcels with land and building values | Regrid U.S. parcel data | Paid (price hidden) | Price not published (sales quote required) | "Nationwide U.S. parcel data, ready for enterprise"; page says "Contact enterprise sales" | Not stated | https://regrid.com/pricing | 2026-11-27 |
| Parcels, Los Angeles County | County open data portal | No price stated | No price stated on page | Page text is only "County of Los Angeles Open Data"; parcel and assessor datasets not confirmed | Not stated | https://data.lacounty.gov/ | 2026-11-27 |
| Vacancy, national survey | Census HVS | No price stated | No price stated on page | Page is the Census HVS index (national survey; no neighbourhood detail shown on page) | Not stated | https://www.census.gov/housing/hvs/index.html | 2026-11-27 |
| Vacancy, address level | HUD-USPS vacancy data | Restricted | No price stated on page | "aggregate vacancy and no-stat counts of residential and business addresses" | "HUD can make the data accessible only to governmental entities and non-profit organizations registered as users." | https://www.huduser.gov/portal/datasets/usps.html | 2026-11-27 |
| Street network | OpenStreetMap | Free | No price stated on page | Community map data, worldwide | "licensed under the Open Data Commons Open Database License (ODbL)"; "You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors." | https://www.openstreetmap.org/copyright | 2026-11-27 |
| Street network, official | Census TIGER/Line Shapefiles | No price stated | No price stated on page | "The core TIGER/Line Files and Shapefiles do not include demographic data, but they do contain geographic entity" | Not stated | https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html | 2026-11-27 |
| Permit counts | Census Building Permits Survey | No price stated | No price stated on page | "Data are available monthly, year-to-date, and annually at the national, state, CBSA (formerly MSA), county and place levels." Counts only; no project failures shown | Not stated | https://www.census.gov/construction/bps/ | 2026-11-27 |
| Permits, Los Angeles | City open data portal | No price stated | No price stated on page | Page title "Los Angeles Open Data Portal"; permit dataset not confirmed | Not stated | https://data.lacity.org/ | 2026-11-27 |
| Polluted-site (brownfield) lists | EPA Cleanups in My Community | No price stated | No price stated on page | "enables you to map and list hazardous waste cleanup locations and grant areas" | Not stated | https://www.epa.gov/cleanups/cleanups-my-community | 2026-11-27 |
| Zoning rules, parcel look-up | ZIMAS (city zoning map) | No price stated | No price stated on page | Page text is "ZIMAS Public" only | Not stated | https://zimas.lacity.org/ | 2026-11-27 |
| Cloud storage you already use | Cloudflare R2 | Free up to a limit | "Free Storage 10 GB-month / month"; beyond that "Storage $0.015 / GB-month"; "Egress (data transfer to Internet) Free" | Free tier and standard rates | "The free tier only applies to Standard storage" | https://developers.cloudflare.com/r2/pricing/ | 2026-11-27 |
| Web hosting you already use | GitHub Pages | Free (limits) | No price stated on page | "Published GitHub Pages sites may be no larger than 1 GB."; "soft bandwidth limit of 100 GB per month" | "GitHub Pages is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site" | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits | 2026-11-27 |

## Not published or not reachable

| Provider | What was tried | Result |
|---|---|---|
| Zillow Research (ZORI rent index) | https://www.zillow.com/research/data/ twice | Could not be fetched from here (bot wall: "Access to this page has been denied") |
| CoStar | https://www.costar.com/products twice | Could not be fetched from here (403 Access Denied) |
| CBRE cap rate survey | https://www.cbre.com/insights/reports/us-cap-rate-survey twice | Could not be fetched from here (bot wall "Just a moment...") |
| ICC Building Valuation Data | https://www.iccsafe.org/building-safety-journal/bsj-technical/building-valuation-data-bvd/ twice | Page not found (404); price not obtained |
| BLS producer price indexes | https://www.bls.gov/ppi/ twice | Could not be fetched from here (BLS blocks automated retrieval) |
| ATTOM | https://www.attomdata.com/pricing/ twice | Page not found (404); price not obtained |
| FEMA flood layer | https://www.fema.gov/flood-maps/national-flood-hazard-layer twice | Could not be fetched from here (403 Access Denied) |
| LA municipal code (zoning text) | https://codelibrary.amlegal.com/codes/los_angeles/latest/overview twice | Could not be fetched from here (bot wall) |
| Paywalled research articles | https://plos.org/open-access/ twice | Could not be fetched from here (403); no per-article price obtained |
| Free federal cap-rate source | none found in the pages checked | Not established; CBRE page blocked |
| Utility capacity (water, sewer, power) | no provider page fetched | No public source was identified in this session |
| Regrid, Green Street, Cotality prices | pages above | Price not published (sales quote required) |

## What I recommend deciding

- Buy the RSMeans Square Foot Costs Book at "$566.95" for construction cost by building type? (Cost only; it does not give rents or yields.)
- Keep rents on the free HUD and Apartment List data, at no charge shown, until a paid rent source is quoted?
- Ask Regrid and Green Street for written quotes (price not published) before deciding on parcel values and cap rates?
- Accept that address-level vacancy (HUD-USPS) is restricted to governments and non-profits, and use the Census survey instead?
- Keep storing only what you do now in R2 (free up to "10 GB-month / month"), with the repo's own 8 GB ceiling still in force?
