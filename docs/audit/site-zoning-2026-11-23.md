# Station-site zoning: who zones each site, its code, and what the code allows (22-23 Nov 2026)

The card engine could not say what to build on any of the 7,098 station-area sites, because no site carried a zoning
category or density (`docs/audit/site-cards-2026-11-22.md`). This job reads, for as many sites as the primary sources
allow, the zone at the site and the city's own code text for that zone, and passes them to the card engine. Everything
below was fetched on 22 Nov 2026 (machine date) from this machine; nothing was typed from memory.

## 1. Measurement: which government zones each site (step 1)

`pipeline/site_zoning_measure.py` places each site's interior point in the Census TIGER/Line 2024 place outlines
(`https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_<state>_place.zip`; hashes in the output). An active
incorporated place (FUNCSTAT A), or the balance of a consolidated city-county (FUNCSTAT F: Nashville-Davidson,
Indianapolis), zones the site; DC is the District; any other point is the county's unincorporated land (the county from
the site's census tract). Whether a county zones its unincorporated land is not decided here.

Table: `data/backtests/site_zoning_by_city_2026-11-23.{md,json}` (250 jurisdictions, with the zoning codes on the parcel
records and the zoning services the repository already registers). Largest by sites:

| Jurisdiction | Sites | Code on the parcel record | Notes |
|---|---|---|---|
| New York city | 561 | 548 (78 distinct; R6 88, M1-1 50, PARK 35) | MapPLUTO ZoneDist1 |
| Chicago | 520 | 0 | Cook County zoning layer registered |
| Phoenix | 461 | 441, all "CONTACT LOCAL JURISDICTION" (not a zone) | regional land-use layer registered |
| San Diego | 442 | 303, all SANDAG one-digit codes (not the City's zones) | City zoning map registered |
| Dallas | 440 | 0 | City zoning map registered |
| Houston | 395 | 0 | none registered |
| Los Angeles | 337 | 0 | none registered for the City in `ZONING_SERVICES` (the LA bundle carries a generalised layer) |
| Indianapolis (balance) | 144 | 0 | none |
| Seattle | 140 | 0 | King County layer registered |
| Austin | 41 | 0 | City zoning map registered |

## 2. Zone at each site (step 2a), `pipeline/site_zoning_points.py`

Each site's point was sent to the city's own zoning map (ArcGIS point query, 2 requests a second, cached in the
scratchpad, answer stored per site with the URL and date):

| City | Service | Sites | With a zone |
|---|---|---|---|
| New York | DCP zoning districts `services5.arcgis.com/GfwWNkhOj9bNBqoJ/.../nyzd/FeatureServer/0`, plus special purpose districts (`nysp`) and commercial overlays (`nyco`) at the same point | 561 | 561 (103 in a special purpose district) |
| San Diego | City Official Zoning Map `webmaps.sandiego.gov/.../DSD/Zoning_Base/MapServer/0` | 442 | 396 (46 points in no zone polygon) |
| Los Angeles | Department of City Planning zoning layer on the City's GeoHub `services5.arcgis.com/7nsPwEMP38bSkCjy/.../Zoning/FeatureServer/15` (zone string and the Department's own CATEGORY) | 337 | 334 |
| Austin | `maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0` | 41 | 38 |

Los Angeles was first asked of ZIMAS (`zimas.lacity.org/.../zma/zoning/MapServer/1101` and `/1102`); it answered the same
zone strings for the 12 points compared but took 30 seconds or more per point, so the GeoHub layer (same owner, same
strings, edited Nov 2026 per its `editingInfo`) was used. Where a city has no point answer, the parcel record's code is
kept (Denver, Baltimore, Nashville, Portland, Detroit, Memphis: 1646 sites now carry a zone code in all).

Per-site files: `app/data/site_zoning/<fips>.json` (zoning jurisdiction, zone, how it was read), `index.json`.

## 3. Code tables (step 2b), `pipeline/site_zoning_build.py` -> `app/data/site_zoning/codes/<city>.json`

Every quote below is checked by the build to occur in the text it fetched; a missing quote stops the build. Shared quotes
are stored once per table (`quotes`, referenced as `{ref}`), so the files are 1 KB (Austin) to 127 KB (Los Angeles).

**New York City (Zoning Resolution, zr.planning.nyc.gov).** The district rules come from the page's own ZR parsers in
`scripts/build_zoning_standards.py`, run fresh: the result was identical to the committed `zoning_standards.json` NYC
entry. Added and quoted this session:
- ZR 23-52: "the maximum number of dwelling units permitted shall be determined by dividing the maximum residential floor
  area permitted on the zoning lot by the applicable dwelling unit factor" and "the applicable dwelling unit factor shall
  be 680. Fractions equal to or greater than three-quarters resulting from this calculation shall be considered to be one
  dwelling unit". Homes = FAR x lot area / 680, with that rounding.
- FAR: the standard column of ZR 23-21 (R1-R5) and 23-22 (R6-R12), commercial districts through their residential
  equivalent (ZR 34-112). Where 23-22 gives a higher figure "within 100 feet of a wide street" (not checked), the
  range runs from the general to the wide-street figure.
- Not determined, with the quote: a point in a special purpose district (ZR 22-00: "may be modified or superseded ...
  through Special Purpose Districts"); a site in Manhattan (ZR 12-10: special density areas include "the Manhattan
  Core"); paired M/R districts (Special Mixed Use District, ZR 12-10); M1-1, M1-5, M1-6 and M districts with a D, M or A
  suffix (ZR 42-12 lets residences into certain of them under 42-311 to 42-314, not read). Other M districts: housing not
  permitted (ZR 42-12). C7, C8: not permitted (ZR 32-121). PARK: not a zoning district.
- Parking (ZR Article II Chapter 5): not read.

**San Diego (Municipal Code, docs.sandiego.gov City PDFs, edition 9-2026).** Chapter 13 Divisions 2-7, Chapter 15
Division 1, Chapter 11 Article 3 Division 2.
- Density from each zone's own purpose sentence, e.g. §131.0507: "CC-3-8 is intended to accommodate development with a
  high intensity, pedestrian orientation and permits a maximum density of 1 dwelling unit for each 600 square feet of lot
  area"; RM zones §131.0406. Rounding §113.0222(a)(1): "If the quotient resulting from this calculation exceeds a whole
  number by 0.50 or more, the number of dwelling units shall be increased to the next whole number."
- Commercial zones with a density are mixed-use with the caution §131.0540(b): "Residential development is permitted only
  when a commercial structure exists on the premises or is a part of the proposed development."
- CC-2-x and CO-2-x ("limited residential uses"): not determined. CR-2-1: "no residential use" (§131.0503(b)).
- RMX, EMX (§131.0703, §131.0704): FAR and height from Table 131-07B; no units per lot area, so homes are not sized.
  EMX housing not determined (Table 131-07A footnote 1, Prime Industrial Land, not checked).
- Industrial: the Table 131-06B "Multiple Dwelling Units" row (only IP-3-1 permits). RS, AR: single dwelling units.
  OC, OF, OP: open space. CCPD, OTCC, OTOP, LJSPD zones: planned districts (§151.0103(a)), not determined. RT-1-5: not parsed.

**Los Angeles.** The Department of City Planning's own category on its zoning layer (Commercial, Multiple Family
Residential, Manufacturing, ...) gives the category. The code text is not on file: the City's page
(`https://planning.lacity.gov/zoning/original-code`, fetched) says Chapter 1 "is published in the Municipal Code" and links
to American Legal Publishing, which answered HTTP 403 (a Cloudflare bot check) to
`codelibrary.amlegal.com/codes/los_angeles/latest/lapz/0-0-0-2527` and `.../0-0-0-1`. So housing permission and density
stay not determined; Q, D and overlay suffixes carry the City page's own explanation as cautions ("A Q condition prefix
may impose ...", "A D limitation may be adopted ...").

**Austin.** No table. `https://library.municode.com/tx/austin/codes/land_development_code` answered a Cloudflare bot check
(once, with a browser user agent in a headless browser, the page loaded; every later request was challenged; nothing was
done to get past the check), `api.municode.com` HTTP 403, and the City's page
`https://www.austintexas.gov/planning/zoning-resources-site-regulations` links only to Municode for 25-2-491 and 25-2-492.

**Others not fetched (URLs tried, 22 Nov):** Chicago and Dallas (codelibrary.amlegal.com, 403), Phoenix and Seattle
(municipal.codes, 403). Houston, Indianapolis, St. Paul, Charlotte, Denver, Miami, Nashville, Baltimore and the rest were
not attempted in this job (Baltimore's code at codes.baltimorecity.gov answers, but its tables are not in the HTML and the
site asks for bulk download instead of page reads).

## 4. Wiring (step 3)

- `src/engines/stationSites.js`: `loadZoning(fips)` reads the county file and the city tables it needs (lazily);
  `attachZoning` sets `site.zoning`, `baseZoning`, `zoningCategory`, `cityName`, `zoningLimits` (`limitsOf`: only what the
  row states, each with section, quote, URL; a zone with no row gets `notDetermined` with the reason and first URL tried).
  The site's fact list gains a "Zoning" row (zone, where read, who zones it, category or why not).
- `app/invest.js` (3 small edits): loads the zoning after the places file; passes `zoning_limits` in the parcel facts and
  the parcel-to-outline ratio. `app/app.js` untouched.
- `src/engines/projectCardEngine.js`: the statute engine still runs first and decides wherever a state law applies. With no
  applicable law, a multifamily or mixed-use code row whose text permits housing makes the multifamily courses' legal
  basis "zoning on file" with the code quote; homes = the code's density x the mapped lot's area (modelled), floor area =
  FAR x area; inputs show the density with its quote, the FAR rows, the site area ("the mapped lot's outline
  (OpenStreetMap), not the county parcel"; where the parcel is over 2x or under 0.5x, "so its area is not used"), height.
  Cost = homes x the county's permit value per home (the existing place row), from the fewest homes at the lowest year to
  the most homes at the highest year, labelled "declared permit valuations, structure only". A code row that withholds
  housing or is not determined gives the not-assessed reason in words.
- Tests: `tests/unit/siteZoning.test.ts` (21): quotes contain the numbers used; each rule; San Diego's own worked example
  (1.5 acres at 1 per 2,000 sq ft = 33); the 0.75 rounding; withheld paths (housing not permitted, planned district, FAR
  only, LA by map category, LA commercial, no table); a state law overriding the zoning row; attaching every county file;
  advisor caps.

## 5. Before and after (step 4), `scripts/measure_site_cards.mjs` (`NOZONING=1` for before)

`data/backtests/site_cards_measure_zoning_{before,after}.{md,json}`:

| Jurisdiction | Sites | Zone passed to the card (before -> after) | Category from a code table | Home count | Building course with a total cost |
|---|---|---|---|---|---|
| New York city | 561 | 0 -> 561 | 0 -> 561 | 0 -> 213 | 0 -> 213 |
| San Diego city | 442 | 0 -> 396 | 0 -> 395 | 0 -> 62 | 0 -> 62 |
| Los Angeles city | 337 | 0 -> 334 | 0 -> 322 | 0 | 0 |
| Austin city | 41 | 0 -> 38 | 0 | 0 | 0 |
| Denver, Baltimore, Nashville, Portland, Detroit, Memphis (parcel code) | 330 | 0 -> 317 | 0 | 0 | 0 |
| all 7,098 | 7,098 | 0 -> 1,646 | 0 -> 1,278 | 0 -> 275 | 0 -> 275 |

("Category" counts rows that name one, including "planned/special" and not-determined rows that still have a category.)
Courses: small multifamily assessed 359, sized 296 (275 with homes, 21 floor area only), costed 275.

## 6. Checks (step 5)

**Re-derivation, seed 20261123** (`scripts/site_zoning_sample.mjs` draws, mulberry32, alternating between the
jurisdictions with home counts; `scripts/recheck_site_zoning.py` re-asks the zoning map at each point and re-fetches the
code text with no cache, then recomputes): 15 sites, 8 New York, 7 San Diego. Zone 15/15 the same, homes 15/15, cost
15/15 (`data/backtests/site_zoning_rederive_20261123.json`). New York's FAR rows were re-read from the 23-21 / 23-22 text
by a separate tokenizer and C4-2 / C4-3 through 34-112 again. **Only 2 cities could be sampled**: no other city has a home
count, so the "at least 4 cities" target was not met.

**Attack on the 3 most common codes per city:**
- San Diego (EMX-2 50, RS-1-7 43, IH-2-1 39; and the costed CC-3-6, CC-3-8, RM-1-1): reading Table 131-04G's footnote 1
  ("as determined in accordance with Section 113.0222") led to §113.0222(a)(1), which **rounds a fraction of 0.50 or
  more up**. The first build floored. Fixed before anything was published; San Diego's worked example is now a test.
  Table 131-05D's density row omits CR-2-1, consistent with §131.0503(b) "no residential use" (checked against the use
  table row). Footnote 2 of Table 131-04G allows more homes under the affordable housing regulations (Chapter 14 Art. 3
  Div. 7), and the Coastal Overlay and airport compatibility overlays can change things: not checked, so the figures
  are the base zone's. EMX: footnote 1 (Prime Industrial Land) keeps housing undetermined. IH-2-1: "-" confirmed.
- New York (R6 90, M1-1 50, PARK 33; costed R4, R5, R7-2): ZR 23-21 gives R1-R5 a higher FAR on "qualifying residential
  sites" (12-10: 5,000 sq ft or more, in the Greater Transit Zone, on a wide street); not checked, so R4/R5 figures are
  the standard-lot figure. ZR 23-22's footnote 1 (wide street) is shown as the range's top. 23-52 has no factor for
  qualifying senior housing and conversions (more homes possible). Mandatory Inclusionary Housing areas are not checked.
  M1-1: 42-314 not read, kept not determined. No contradiction found in the rows used.
- Los Angeles (LAX 12, C2-2D-CPIO 11, PF-1XL 9): category only; LAX is a specific-plan zone the map classes
  Manufacturing; the D and CPIO suffixes carry the City's caution text. The code text could not be read to attack.
- Austin (P-NP 8, GO 7, PUD-NP 4): no table; the -NP (neighbourhood plan) and PUD designations would have been
  "not determined" in any case.

**Live, real page** (`scripts/live_check_site_zoning.mjs`, LIVE_PORT 9251,
`data/backtests/live_check_site_zoning_2026-11-22.json`, screenshots `data/backtests/site_zoning_*.png`): Travis 48453 and
Los Angeles 06037 (as required), Kings 36047 and San Diego 06073. Zoning attached in all four; 0 "NaN", "undefined" or
"null" in the section; 0 page errors; in the opened cards every dollar figure and home count shown is one of the card's
own figures. Travis: the two opened cards say "the site's zoning (MF-3) has rules that are not determined: the city's
code text could not be fetched (library.municode.com ... HTTP 403)". Los Angeles: 0 cards sized (as expected). Kings: 33
of 150 station-site cards sized, e.g. R6 parking lot, 611 to 834 homes, $93.2M to $144.0M. San Diego: 6 of 150 sized,
e.g. CO-3-3, 545 homes, $91.1M to $112.5M.

## 7. What would fill the rest

1. Los Angeles Chapter 1 text (density per zone, LAMC 12.07-12.22): American Legal Publishing blocks this machine; the
   owner can export the sections or ask the City for the Chapter 1 PDF. That alone would size the 322 categorised LA sites.
2. Austin Title 25 (25-2-491 use chart, 25-2-492 site development regulations) on Municode: same.
3. Chicago, Dallas (American Legal), Phoenix, Seattle (municipal.codes): same.
4. Houston has no zoning ordinance by reputation; a quoted primary source was not fetched, so its sites stay "not on file".
5. New York: qualifying residential sites, MIH areas, special district rules (103 sites), 42-314 M1 districts.
6. San Diego: planned districts (Chapter 15 articles), the CC-2/CO-2 use cells, EMX Prime Industrial Land map.
