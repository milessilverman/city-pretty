# "What fits on this lot" outside LA and Florida (16 Nov 2026)

## Why it didn't work before

The house checks list (`houseChecks` in `app/app.js`) runs only when the page can tell the lot is a home. It could
tell in two places: LA (the assessor's `UseCode` starts with 0) and Florida (DOR use codes 000–009 also start with 0).
Elsewhere the parcel services give either no use field, a bare code the page couldn't read, or a worded use. A bare
code was "unknown", and the checks were skipped. No local zoning standard was on file anywhere outside LA, and LA's
rules are labelled "round-6 research, not yet checked against the code".

## What was done

**New York City (5 counties, R1–R5 districts) is covered.** `scripts/build_zoning_standards.py` fetches the Zoning
Resolution from zr.planning.nyc.gov. It parses the tables and sentences and writes `app/data/zoning_standards.json`.
Each rule keeps its verbatim text and section URL. A parse that doesn't find what it expects stops the build. Nothing
is typed by hand.

| What | Section | Example (R2A) |
|---|---|---|
| Housing types allowed (lots that aren't qualifying residential sites) | ZR 22-121, 22-122 | "limited to single-family detached residences" |
| Minimum lot area and width for a detached or zero-lot-line home | ZR 23-11 table | 2,850 sq ft, 30 ft |
| Maximum floor area ratio, plus the 0.60 per-home cap on lots of 4,000 sq ft or more | ZR 23-21 table, note 1 | 0.75 |
| Height (23-421 pitched-roof envelope, 23-422 flat-roof limits; where both name a district the lower governs) | ZR 23-42x | 35 ft, perimeter walls 25 ft |
| Ancillary dwelling unit: 800 sq ft, one per one- or two-family home, owner occupancy at first occupancy, no backyard ADU in R1-2A/R2A/R3A outside the Greater Transit Zone | ZR 12-10 | |
| Qualifying residential site (the exception to 22-122) | ZR 12-10 | quoted, not checked per lot |

District lists follow ZR 11-25. A section that lists R4 also covers R4-1, R4A and R4B unless the same section gives
those their own rules. Districts R6–R12, C and M, and special-purpose districts are not encoded; such a lot shows
"not on file" with that reason.

**NYC parcel use is decoded.** MapPLUTO's `LandUse` codes come from the PLUTO Data Dictionary (August 2026, 26v2),
parsed from the PDF into `app/data/parcel_use_codes.json`. Code 01 is "One & Two Family Buildings". Before this, every
NYC lot said "doesn't record this lot's use".

**On the page** (NYC home lots), the checks list now shows:

- the district, its housing types, minimum lot, height and the special-district caveat (ZR 22-00);
- the floor area allowed (FAR × MapPLUTO lot area) against the city's recorded gross floor area, labelled a screening
  figure, because gross floor area isn't zoning floor area and a zoning lot can span several tax lots;
- whether a second home is allowed;
- whether the lot is at least twice the minimum by size, the only part of a lot split checked here;
- the ADU rule, replacing the generic ADU rows;
- the height limit, which feeds the "Height limit" fact.

What isn't checked (transit zone, historic districts, flood-risk maps, special districts) is said, not assumed.

**Everywhere else**, a "Local zoning standards — Not on file" row gives the reason. For five places the reason is
specific, because I tried their code publisher and was refused (`scripts/zoning_standards_withheld.json`):

| Place | Publisher | Result on 16 Nov 2026 |
|---|---|---|
| Austin | Municode | HTTP 403, bot check |
| Phoenix | municipal.codes | HTTP 403 |
| Seattle | municipal.codes | HTTP 403 |
| Chicago | American Legal | HTTP 403 |
| Philadelphia | American Legal | HTTP 403 |

All other places get the general reason: a standard is used only after it has been read from the code itself.

## Bug found and fixed: commercial lots got the home checks

`houseChecks` decided a lot was a home with `/resid/i.test(UseType)`, and that also matches "non-residential". Every
lot that `parcelUseType` reads as non-residential got the ADU, pool and second-story checks. That covers worded uses
such as "OFFICE BUILDING", "CHURCH" or "COMMERCIAL", from Massachusetts, Franklin County OH, Jefferson County AL and
others. LA and Florida were not affected; they decide by `UseCode`. The new e2e test caught it with a MapPLUTO
commercial lot. It's now fixed and tested, with both a coded (NYC 05) and a worded ("OFFICE BUILDING") use.

## Verification

- `tests/unit/zoningStandards.test.ts` checks that each number appears in the table row or sentence it was parsed
  from, spot-checks values against the ZR, and covers the withheld entries and the PLUTO codes. Both files were added
  to the provenance test.
- An e2e test (`what fits on this lot uses the NYC Zoning Resolution…`) runs through `houseAt` with mocked MapPLUTO
  answers. It covers R2A (one-family, 6,000 sq ft), R4B (two-family, small lot), an R6 lot (not on file), a commercial
  lot, and a Travis lot (Austin reason) and an office lot.
- **Live** (`scripts/live_check_lot_fit.mjs`, results in `data/backtests/live_check_lot_fit_2026-11-16.json`):
  - 8 real one- and two-family lots in Queens, Staten Island, Brooklyn and the Bronx, across 7 districts (R1-2,
    R1-2A, R2, R3X, R3-2, R4, R4-1), clicked on the real page with live MapPLUTO. All 8 showed the right district,
    use, minimum lot, height, housing types, ADU row and FAR figure, against MapPLUTO queried separately.
  - All 22 cited quotes and table rows were re-found in the live ZR section pages.
  - Travis (809 Park Blvd) and Jefferson AL showed the "not on file" row with their reasons. No page errors.
- Full suite: 454 unit tests, typecheck, 48 e2e tests (`PW_PORT=8824`).

## Not done, and why

- **Manhattan** has almost no R1–R5 lots, so it wasn't sampled live. The code path is the same as the other boroughs.
- *(Round 2 update: DC is now covered. **Correction:** the claim below that denvergov.org has the Denver Zoning
  Code PDF wasn't borne out. The city's zoning-code page didn't link the current articles, so Denver is withheld;
  see Round 2. The use fields for DC and Davidson are now decoded.)*
- **DC and Denver** publish their codes on reachable official sites (dcregs.dc.gov; denvergov.org has the Denver
  Zoning Code PDF). They are the next candidates. DC's zoning handbook (handbook.dcoz.dc.gov) answers every path with
  the same app shell, so the DCMR text would have to come from dcregs. Not attempted in this track.
- **Other worded or coded use fields** (CO `landUseDsc`, DC `PROPTYPE`/`USECODE`, Cook `BLDGClass`, Maricopa `PUC`,
  WA `LANDUSE_CD`, NJ/NYS `PROP_CLASS`, Davidson's new `LUDesc`) are not decoded yet. Each needs its publisher's code
  table.
- Two smaller issues outside this track's scope:
  - The "Owner playbook" line still says "Zoning is not on file" for NYC lots; it reads only the map zoning layer.
  - The NYC address line shows "AIN/APN Lot Parcel" in some live clicks.

## My own mistakes on this track

- A command I ran fetched a parcel centroid and then wrote coordinates into the live-check script, but the fetch
  half was refused and the edit half ran. For a moment the script held a point I hadn't computed (30.300765,
  -97.724364). I replaced it with the parcel's real centroid (30.301426, -97.722411; PROP_ID 214875, 809 Park Blvd)
  and confirmed the point falls in that parcel before running.
- My first `nyc_expand` treated a bare family name (R4) as the whole family by guesswork. I replaced it with the ZR's
  own rule (11-25) before anything was published.
- My first 23-421 quote joined two sentences that aren't adjacent in the code. The live re-check caught it (21/22).
  It now uses " … ", and each part is checked.

# Round 2 (16 Nov 2026): Washington, DC; DC and Nashville use tables; Denver and Nashville withheld

## Washington, DC (base R zones R-1A, R-1B, R-2, R-3)

`build_dc()` in `scripts/build_zoning_standards.py` reads the 2016 Zoning Regulations (11 DCMR) from dcregs.dc.gov.
For each section it takes the Word file that the chapter list links as "View text". That file's id changes when a
section is amended, so the build reads it from the chapter list each time. LibreOffice converts the file to text,
and the tables and sentences are parsed from that text. Each rule cites its section page
(`SectionList.aspx?SectionNumber=11-D202`, which shows the effective date) and the text file it came from.

| What | Section | Values read |
|---|---|---|
| Zone purpose (house types) | Subtitle D § 101 | R-1A detached on large lots; R-1B detached, moderate lots; R-2 semi-detached; R-3 row houses |
| Units per lot | Subtitle D § 201.1 | "one (1) principal dwelling unit and one (1) accessory apartment ... per lot of record" |
| Minimum lot to create a new lot of record | Table D § 202.1 (amended 10 Jul 2026) | R-1A 75 ft / 7,500; R-1B 50 / 5,000; R-2 semi-detached 30 / 3,000, other 40 / 4,000; R-3 row 20 / 2,000, semi-detached 30 / 3,000, other 40 / 4,000 |
| Same, inclusionary developments | Table D § 202.2 | stored, not shown |
| Height | Table D § 203.2 | 40 ft and 3 stories in R-1, R-2, R-3, not counting a penthouse or rooftop structure |
| Lot occupancy | Table D § 210.1 | 40%; 60% for a single household row building in R-3 |
| Accessory apartment | Subtitle U § 253 | by right in the house or an accessory building; owner-occupied; at most 3 people; up to 35% of the house; house at least 2,000 sq ft (R-1) / 1,200 (R-2), no minimum listed for R-3; access conditions for an accessory building; rental licence |
| Geographically modified zones | Subtitle D § 100.2 | "indicated by letters following the base zone name, such as R-1A/TS/NO or R-3/FB" |

"R-1" in Tables D § 203.2, D § 210.1 and U § 253.7(a) is read as the R-1 zone family, R-1A and R-1B, on the strength
of § 101.3 ("The purposes of the R-1A and R-1B zones"). That reading is stated in the build script.

DC's parcel layer has no zone field, so the zone comes from DC's official zoning map: Zoning Regulations of 2016,
DC GIS `Planning_Landuse_and_Zoning_WebMercator/MapServer/32`. `enrichZoneFromLayer` in `app/app.js` queries it at the
clicked point. It is a new `zone_source` kind, `point_layer`. If the map doesn't answer, the reason is shown and no
standards are applied. Lot area is OTR's `LANDAREA`; the house's gross floor area is OTR's residential CAMA `GBA`,
which the page already reads.

**Geographically modified zones get no standards.** R-1B/GT, R-3/FB and the like have their own rules, which change
the base zone's, so the panel says the lot is in a modified zone and shows nothing. All other DC zones (RF, RA, MU,
etc.) show "on file only for R-1A, R-1B, R-2, R-3".

On the page, a DC house in a covered zone shows:
- the zone's purpose sentence, units per lot, minimum lot and height;
- lot occupancy as a footprint (percentage × lot area), compared with building outlines only when outlines exist,
  and labelled a screening figure;
- "Second home: no" with the § 201.1 sentence quoted;
- a lot split checked by area only (width isn't in the parcel record);
- the accessory-apartment rule, replacing the generic ADU rows;
- the height and story limit.

## Use tables (so home checks run where the publisher says what a lot is)

- **DC: OTR's own USECODE table**, DC GIS Property and Land layer 54, 109 codes. The type is read from OTR's labels
  by a rule stated in the file. Residential means 'Residential...' labels (not garages or transient uses) and condo
  units that OTR describes as single-family use. Vacant means 'Vacant...' labels. 000 'Not assigned yet' and
  995 'Condo Main' are unknown. Everything else, including garages and religious, educational and commercial codes,
  is non-residential.
- **Nashville: the Assessor's `LUDesc`.** The layer's metadata PDF defines it as "General Land Use assigned by the
  Assessor of Property", but it doesn't list the values. The 89 labels are read from the layer itself, as every
  distinct LUCode / LUDesc pair, and that is stated in the file. The type is read from the label, not the code,
  because the same label has two codes: SINGLE FAMILY is 011 (urban) and 081 (rural). RURAL COMBO, PARSONAGE and
  DORMITORY/BOARDING HOUSE are unknown.
- **Building form.** Both tables now say each residential use's form: single-family, small multi-unit (2-4),
  multi-family building, or a unit in a condominium or cooperative. A condo or co-op unit, or an apartment building,
  is residential but not a house on its own lot. Without this, both cities' condos would have got ADU, pool and
  lot-split checks, because the record has no unit count. Those checks are now skipped with the reason, and a duplex
  to fourplex isn't treated as single-family.

## Withheld, with what was tried (`scripts/zoning_standards_withheld.json`)

| Place | Why |
|---|---|
| Nashville / Davidson | Title 17 is on Municode: `library.municode.com` and `api.municode.com` both answered HTTP 403 on 16 Nov 2026. Home checks run there (use from LUDesc), without local standards. |
| Denver | The city's Denver Zoning Code page answered, but it links only interpretations and the former Chapter 59, not the current articles. A guessed article URL returned 404. Denver's house standards are building-form tables keyed to the lot-size letter in the zone name, and Colorado's statewide parcel layer gives Denver zones without that letter ("SSU", "ESU"). Not encoded until the current text is read. |

## Verification (round 2)

- **Unit** (`tests/unit/zoningStandards.test.ts`):
  - each DC number appears in the table row it was parsed from;
  - spot checks against the text as published on 16 Nov;
  - every DC rule cites a section page and a text file;
  - the DC and Nashville use tables are checked, including the 011/081 label collision and the building forms.
- **Browser** (new e2e through `houseAt`, with DC's parcel, CAMA and zoning-map answers and Nashville's parcel layer
  mocked), covering:
  - DC: an R-1B house, including the accessory-apartment floor-area figures; an R-3 row house (60%, no minimum house
    size); an R-3/GT lot (withheld); a condo unit (no lot checks); a church;
  - Nashville: a single family, a duplex (not single-family) and a church;
  - the test also checks that the zoning map was actually queried at the point.
- **Live** (`scripts/live_check_lot_fit.mjs`, real page, real services):
  - 5 of 5 DC houses match DC's zoning map, OTR's parcel layer and CAMA queried separately: 3717 Fordham Rd NW
    (R-1A), 5820 Chevy Chase Pkwy NW (R-1B), 3825 Legation St NW (R-2), 5330 Connecticut Ave NW (R-3), and
    1918 38th St NW (R-3/GT, withheld with the reason).
  - 27 of 27 DC quotes and table cells were found again in freshly downloaded section files.
  - 2 of 2 Nashville single-family lots show the decoded use, the Municode reason and the home checks.
  - The NYC lots and quotes are re-run in the same script (see the results file).

## My own mistakes this round

- The build script's header said "Washington, DC: see build_dc()" before any `build_dc()` existed. The previous
  round left that line in; it is now true.
- My first Nashville rule typed uses by code range (011-019 residential). The live data has SINGLE FAMILY and DUPLEX
  under 081/082 too, in the rural range. The build's own assertion caught it before anything was written, and the
  type is now read from the label.
- My first DC table parser ran past the end of Table D § 202.2 into the "SOURCE:" line. The parser's assertion
  stopped it.
- I first wrote "which usually means it is an existing lot of record" for a DC lot smaller than the minimum. That is
  an inference, not code text. It now says what § 202.1 says: the minimums apply to creating a new lot of record.
- The first DC browser test hit Playwright's 90 s per-test limit, not a page failure. The limit is raised for that
  one eight-lot test.

# Round 3 (17 Nov 2026): New York City R6-R10

## What was added

25 residence districts: R6, R6-1, R6-2, R6A, R6B, R6D, R7-1, R7-2, R7-3, R7A, R7B, R7D, R7X, R8, R8A, R8B, R8X, R9,
R9-1, R9A, R9D, R9X, R10, R10A, R10X. These are exactly the R6-R10 districts named in the ZR 23-22 and 23-432 tables
(the build asserts the two tables list the same set). R11 and R12, which share those tables, are not encoded; nor are
commercial, manufacturing or special-purpose districts, or R10H and other districts that appear only in special
district chapters.

Each rule is parsed by `build_nyc_high()` in `scripts/build_zoning_standards.py` from zr.planning.nyc.gov:

| Rule | Section | What the build reads |
|---|---|---|
| Housing types | 22-121 (Use Group II table) | The R6-R10 columns are "●" (Permitted) for every residence type, with no "P" (additional conditions); the build asserts each cell. 22-122's limitations name R1-R5 only. |
| Minimum lot | 23-12 | "R6 - R12": 2,375 sq ft and 25 ft for a single- or two-family detached or zero lot line home; 1,700 sq ft and 18 ft for other residences |
| Floor area ratio | 23-22 | Standard residences and qualifying affordable or senior housing, per row |
| Base and building height | 23-432 | Minimum base, maximum base and maximum building height, for standard residences and for qualifying affordable or senior housing, per row |

**Conditions are kept, never collapsed.** The 23-22 and 23-432 tables mark rows and values with footnotes (within
100 feet of a wide street; a narrow street beyond 100 feet; outside Mandatory Inclusionary Housing areas for UAP or
senior housing). The page can't see which applies to a lot, so every value is stored with the footnote's own words and
shown that way. A district row without a footnote, where the same district also has a footnoted row, is shown as "for
other lots" (R6: FAR 3.00 within 100 feet of a wide street, 2.20 for other lots). The floor-area line gives the lowest
standard figure and the highest, each with its condition, and says which applies isn't checked. The "Height limit" fact
shows the range for standard residences (e.g. R8: 115–135 ft, depending on the street), and the second-story check uses
the lowest. Footnote-3 rows of 23-432 (R8, outside MIH areas, for lots containing UAP or senior housing) go to the
qualifying column only; the build asserts their standard-residence values equal the footnote-1 row's, so nothing is
lost.

**Superscripts are read from the HTML.** In the flattened text "R6 1" and "R7 -1 1" are R6 and R7-1 with footnote 1.
The build reads `<sup>` as `^n` (the digit can sit inside a `<span>`), and fails if any `<sup>` is left unread.

Not checked here, and the panel says so: whether the lot is within 100 feet of a wide street, Mandatory Inclusionary
Housing areas and UAP, transit zones, commercial overlays, special purpose districts and Article VI rules, towers, and
the alternative rules of ZR 23-70 (predominantly built-up areas, Brooklyn Community District 12, sky exposure plane
buildings).

**Apartment buildings.** NYC's use table now records the building form from the PLUTO label: LandUse 02 "Multi-Family
Walk-Up Buildings" and 03 "Multi-Family Elevator Buildings" are apartment buildings, so house-only rows (second home,
lot split, ADU, pool) aren't run on them. In R6-R10 they still get the district's standards and floor area, since that
is what matters for a building there. LandUse 01 "One & Two Family Buildings" is left to the record's unit count.

## Bug avoided

R6-R10 districts have no single height. The page read `max_height_ft` directly, so a missing single height would have
become 0 ft and the "second story" check would have said no. It now uses the lowest standard-residence limit for the
check and the range for the fact; a test asserts no "null ft" or "NaN" appears.

## Verification (round 3)

- **Build:** every number is parsed from the live table row; the build fails if a row's district list doesn't
  re-assemble from its tokens, if a value or footnote is missing, or if the two tables disagree on the district set.
- **Unit tests** (`tests/unit/zoningStandards.test.ts`): each option's numbers appear in the row it came from; no
  district has two unconditioned options in one column; spot checks against the tables as published on 17 Nov 2026
  (R6 3.00/2.20, R7-1 4.00/3.44 and heights 40/75/85 and 40/65/75, R8 qualifying 7.20/8.64, R8 heights 115/135 and
  145/145/175, R10A minimum base 125 on a wide street).
- **e2e** (`tests/e2e/site.spec.ts`, through `houseAt`): an R6 walk-up (floor area with both conditions, no house-only
  rows), an R7-1 one-family house (heights by street, second home allowed, split check), and R11 still "not on file".
- **Live check** (`scripts/live_check_lot_fit.mjs`, `data/backtests/live_check_lot_fit_2026-11-17.json`):
  - 12 of 12 real R6-R10 lots matched MapPLUTO queried separately, in Brooklyn (R6B, R6A, R7A), Manhattan (R10A, R8B,
    R7-2), Queens (R7-1, R7A, R6) and the Bronx (R8, R8A, R7-1), across one-family, walk-up and elevator buildings.
  - 40 of 40 table rows the data was parsed from were found again in the live 23-12, 23-22 and 23-432 tables (read with
    the same superscript handling), and 22-121 still marks every residence type "●" in R6-R10.
  - Unchanged: NYC R1-R5 8/8 and 22/22 quotes, DC 5/5 and 27/27, Nashville 2/2, Travis and Jefferson "not on file".

## My own mistakes this round

- The worktree for this track was created from an unrelated old commit (`94a3f0b`, not on this branch). I reset it to
  the branch head (`5ccd271`) before changing anything.
- My first build read R7-1 and R7-2's 23-432 rows with no condition: their footnote digit sits inside a `<span>`
  within `<sup>`, which my first regex missed. The printed output showed the empty condition; the regex now allows tags
  inside `<sup>`, and the build fails if any `<sup>` is left unread.

# Round 4 (17 Nov 2026): NYC R11, R12 and commercial districts

## What was added

**R11, R11A and R12** (same tables as R6-R10): ZR 22-121 marks every residence type "●" in the R11 and R12 columns;
23-12 gives 2,375 sq ft / 25 ft and 1,700 sq ft / 18 ft for R6-R12; 23-22 gives R11 12.00 / 15.00 and R12 15.00 / 18.00;
23-432 gives R11 60/155/255 ft (qualifying 155/325), R11A by street (125 or 60 minimum base), R12 60/155/325 (155/395).
23-22 lists R11 but not R11A, so R11A takes R11's floor area row under ZR 11-25 ("All regulations applicable to a
district designation shall be applicable to such district designation appended with a suffix, except as otherwise set
forth in express provisions"); the build checks that 23-22 never mentions R11A, and the record says so (`via_11_25`).

**Commercial districts where residences are permitted.** Read from the code, each with the section URL:

| Rule | Section | What it decides |
|---|---|---|
| Use Group II by commercial district | 32-121 table | Residences permitted in C1, C2, C5, C6 (●), C4 (● P), C3 (detached ●, others ♦); not in C7 or C8 (–) |
| C3A | 32-122 | "only single- or two-family detached or zero lot line residences shall be permitted" |
| C4 condition | 32-123 | C4-1 lots of 4+ acres in Staten Island's lower density growth management areas need a special permit (named, not checked) |
| Residential equivalent | 34-112 table | e.g. C4-4 → R7-2, C6-2A → R8A, C4-1 → R5, C3 → R3-2, C6-11 → R11, C6-12 → R12 |
| C3A bulk | 34-03 | R3A's bulk "in lieu" of Chapter 34 |
| Which lots | 34-01 | only zoning lots with residential buildings only; mixed buildings follow Article III Ch. 5 (said, not checked) |
| Floor area | 34-221 | the equivalent's Article II floor area; plaza and arcade bonuses not counted |
| Heights, R6-R12 equivalents | 35-632 | "as set forth in the table in Section 23-432 for the applicable Residence District" |
| Heights, R1-R5 equivalents | 35-62 | non-qualifying sites within R3/R4 take R4's heights, within R5A/R5B take R5's. How that applies to a C3 or C4-1 lot (an *equivalent*, not mapped *within* R3/R4) isn't settled from the text, so **no height is shown** for C3 and C4-1 |
| C1/C2 overlays | 34-111, 35-62 | within an overlay on R1 or R2, R3-2's bulk; on R3/R4 non-qualifying sites R4's heights; R5A/R5B → R5's heights |

The commercial designations the page handles are the ones actually mapped (MapPLUTO's ZoneDist1 values, queried at
build time). "C5" in the R10 row covers C5-1 to C5-5 under ZR 11-25. **Withheld, with the reason on the page:**
designations the 34-112 table doesn't list and that carry other suffixes, which are mapped with Special Purpose
District rules: C5-2.5, C5-P, C6-1G, C6-2G, C6-2M, C6-4.5, C6-4M, C6-5.5, C6-6.5, C6-7T. C7 and C8 lots say
residences aren't permitted (32-121). M, MX and special-district-only districts stay "not on file".

**Overlays and special districts on the page.** The registry's MapPLUTO request doesn't carry `Overlay1`, `Overlay2`,
`SPDist1`, `SPDist2` or `LotFront`, so the page reads them from the same layer by BBL (`zone_source.extra_fields`; the
build checks the URL is the registry's). A lot with a C1/C2 overlay keeps its residence district's standards (an overlay
need only cover 10% of the lot, per the PLUTO data dictionary) and gets a row quoting 34-111 / 35-62 and saying what
changes within the overlay. A lot in a special purpose district gets a row naming it and saying its rules aren't
checked. If the BBL read fails, the page says overlays and special districts weren't checked.

**Side effect, intended:** `LotFront` was never in the registry's request, so on the live page NYC lot-width checks
(minimum width, "split into two lots") never ran before this round; the browser tests passed only because their mocks
return every field. Width now comes from the BBL read.

## Verification (round 4)

- **Build** asserts every quoted sentence is found in its section, every 34-112 row's tokens rebuild the cell, the
  32-121 cells are exactly as expected (C1/C2/C5/C6 ●, C4 ● P, C3 ●/♦, C7/C8 –), the 34-111 district list is
  C1-1..C2-5, and each equivalent exists in the data.
- **Unit tests** (`tests/unit/zoningStandards.test.ts`, 20 pass): each commercial district's equivalent is the one its
  34-112 row names (or 11-25's parent), its floor area, lot and height equal the equivalent's; spot checks for R11, R11A,
  R12 and 13 commercial districts; C7/C8 and withheld designations; overlay mapping.
- **e2e** (`tests/e2e/site.spec.ts`, through `houseAt`): R11, M1-1 "not on file", a C4-4 house (R7-2's floor area with
  both conditions, row quoted, ADU not evaluated), C3 (height withheld), C8-1 (no residences), an R2 lot with a C1-2
  overlay (R3-2 within it), and a special purpose district lot.
- **Live check** (`scripts/live_check_lot_fit.mjs`, `data/backtests/live_check_lot_fit_2026-11-17.json`, LIVE_PORT 8872):
  - 14 of 14 residential commercial lots in all five boroughs matched MapPLUTO queried separately: C4-5D, C6-3A, C4-3A
    (Brooklyn); C4-4, C4-2, C4-3 (Queens); C4-4D, C4-5X, C4-4A (Bronx); C4-1, C4-2 (Staten Island); C4-7, C4-6A, C1-8A
    (Manhattan).
  - 6 of 6 overlay lots (R3-2 / R3X with C1-1, C1-3, C2-1, C2-2 in Queens and Staten Island) show the overlay row with
    35-62's R4 heights for non-qualifying sites. No R1/R2 overlay lot was sampled live; that path is covered by e2e only.
  - 29 of 29 commercial quotes and 34-112 rows re-found in the live sections; 32-121 cells as expected.
  - 45 of 45 R6-R12 table rows re-found (40 before, plus R11/R11A/R12 rows).
  - **R11/R12 on a real lot: not possible.** MapPLUTO has no R11, R11A or R12 lots; the only R11/R12 equivalents
    mapped are one C6-11 lot (vacant, LandUse 11) and one C6-12 lot (commercial, LandUse 05), where home checks don't
    run. R11/R12 values are checked by the live table rows and e2e only.
  - Unchanged: R1-R5 8/8 and 22/22 quotes, R6-R10 12/12, DC 5/5 and 27/27, Nashville 2/2, Travis and Jefferson "not on
    file". No page errors.

## My own mistakes this round

- The worktree was created from an unrelated old commit (`94a3f0b`); I reset it to the branch head (`1366fed`) first.
- My first quote patterns assumed spaces before punctuation; the build's text helper removes them, and a global edit I
  made to fix "non- " also turned the normalizing line into a no-op. The build stopped on the missing quotes; fixed.
- I first withheld C3A's height like C3's; 34-03 says Chapter 34 (with its 34-24 height modifications) doesn't apply in
  C3A, so it now takes R3A's own heights.
- Drawn-lot clicks (Brooklyn, Bronx, Manhattan, which have no county model) skipped enrichment, so they would never have
  read the overlay fields; caught in review before the live run and fixed for both NYC and DC's zoning-map lookup.
