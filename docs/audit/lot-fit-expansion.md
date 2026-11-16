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
