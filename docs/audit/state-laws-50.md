# State housing laws: 50-state + DC review (16 Nov 2026)

Question for each state: is a state law **in effect** that requires local governments to allow, by right or
ministerially, (a) ADUs, (b) duplexes/middle housing on single-family lots, (c) lot splits, (d) limits on minimum
parking, or (e) homes on commercial land? Evidence is primary text only (legislature sites, session laws, official
code); every quote was cut from the fetched page by `scripts/add_state_laws_50.py`. Per-state detail, including what
was searched, is in `state-laws-50.json`.

## Added to `app/data/statutes.json` (13 records)

| State | Record | Law | Status |
|---|---|---|---|
| WA | `wa_hb1337_adu` | RCW 36.70A.681: two ADUs on single-family lots in urban growth areas; parking limits | verified |
| WA | `wa_sb5184_parking` | Laws 2025 ch. 204: caps of 0.5 space per multifamily unit, 1 per house, in places over 30,000 | verified (jurisdiction-wide, not a parcel right) |
| WA | `wa_hb1042_existing_buildings` | Laws 2023 ch. 285: +50% homes inside existing commercial/mixed-use buildings, no parking for added units | verified |
| OR | `or_adu_197a425` | ORS 197A.425: one ADU per detached home inside UGBs (cities > 2,500, counties > 15,000), operative 2018-07-01 | verified |
| OR | `or_commercial_197a460` | ORS 197A.460: covenant-affordable housing on commercial-only land, operative 2024-01-01 | verified |
| MT | `mt_adu_76_2_345` | MCA 76-2-345: one ADU by right | partially verified (bill no., date, court challenge) |
| MT | `mt_commercial_76_2_304_4` | MCA 76-2-304(4)-(5): multifamily in commercial zones, 1-space parking cap | partially verified |
| MA | `ma_adu_40a3` | M.G.L. c. 40A § 3: one ADU in single-family zones, effective 2025-02-02 | verified |
| RI | `ri_adu_large_lot`, `ri_adu_existing_footprint` | R.I.G.L. 45-24-73(a): ADU by right on lots ≥ 20,000 sq ft or within an existing footprint, effective 2024-06-25 | verified |
| CA | `ca_adu_66323` | Gov. Code §§ 66317, 66323: ADU + JADU ministerially | partially verified (FindLaw copy; date) |
| AZ | `az_adaptive_reuse_9_462_10` | A.R.S. 9-462.10: multifamily/adaptive reuse on commercial parcels in cities ≥ 150,000 | partially verified (date) |
| TX | `tx_sb15_small_lots` | Local Gov't Code 211.051-.058: 3,000 sq ft lots in new subdivisions of large cities, effective 2025-09-01 | verified |

The engine (`src/engines/statutoryZoningEngine.*` and its copy in `app/app.js`) gained three generic fields so these
apply correctly: `applies_to_zone: "commercial"`, `parcel_level: false`, and `unmapped_condition` (a condition the
parcel record can't express, reported as "not on file" rather than assumed).

## Not added

- **Hawaii** SB 3202 (2024): counties must allow two ADUs by ordinance; the self-executing fallback starts only after
  2026-12-31. Not yet a parcel right.
- **Could not check** (sites unreachable from the audit machine): New Hampshire (RSA 674:71-73), Connecticut
  (C.G.S. § 8-2o, with local opt-out), DC (11 DCMR ADU rules).
- **Not checked**: Maryland HB 538 (2024; density bonuses, not by-right rules).
- **Known gaps**: California AB 2011 (eligibility section blocked), Colorado HB 24-1304 parking (text not fetched),
  Texas 2025 ADU bills, Montana court challenge outcome.
- **Local option only**: Florida ADUs (§ 163.31771: "may adopt").

## None found (32 states)

AL, AK, AR, DE, GA, ID, IL, IN, IA, KS, KY, LA, MI, MN, MS, MO, NE, NV, NJ, NM, NY, NC, ND, OH, OK, PA, SC, SD, TN, VA,
WV, WI, WY (statewide). Candidate discovery used secondary pages and a known-reform list, with code searches only for
IA, MN and VA, so "none found" is not proof that no such law exists.

## Round 2 (16 Nov 2026): searching the code text itself

`scripts/search_zoning_chapters.py` fetched each "none found" state's zoning-enabling chapter(s) from the state's own
code site and searched the text for ADU, duplex/two-family/middle-housing, lot-split, parking-minimum and
commercial-residential terms. A page counts as searched only if it holds statute text (8,000+ characters and at least
10 occurrences of "shall"); tables of contents and bot checks don't count. `scripts/add_state_laws_n3b.py` added what
was found, with every quote cut from fetched text, and wrote each state's search log into `state-laws-50.json`
(`round2_search`).

**Added (5) and corrected (1):**

| Record | Law | What it does | Status |
|---|---|---|---|
| `id_adu_67_6541` | Idaho Code § 67-6541 (2026 ch. 265, S 1354aa, effective 2026-07-01) | Cities over 10,000 may not ban ADUs in residential zones; ADUs meeting local requirements are approved administratively as of right; by 1 Feb 2027, one ADU per single-family lot with parking, size and owner-occupancy limits | verified |
| `id_starter_home_67_6542` | Idaho Code § 67-6542 (2026 ch. 264, S 1352aa, effective 2026-07-01) | Starter-home subdivisions (4+ acres, lots up to 1,500 sq ft) may not be banned in cities over 10,000; lot and setback limits due by 1 Feb 2027. A subdivision rule, not a single-lot right | verified |
| `nv_adu_ordinance_278_257` | NRS 278.257 (added 2025) | Counties of 100,000+ and cities of 60,000+ must adopt an ordinance allowing ADUs (no kitchen bans, at most one extra parking space, no rental bans). Approval is not made ministerial, so the engine reports it as unconfirmed | partially verified (effective date and bill not identified) |
| `ca_ab2011_affordable` | Cal. Gov. Code §§ 65912.110-.114 (AB 2011, Stats. 2022 ch. 647; amended 2024) | 100%-affordable multifamily housing by right, ministerial, on sites zoned for office, retail or parking, with urbanized-area, perimeter and industrial-adjacency conditions; repealed 1 Jan 2033. Read from the Legislative Counsel bulk database (`scripts/ca_pubinfo_section.py`) | verified |
| `co_hb24_1304_parking` | C.R.S. § 29-36-103 (HB 24-1304) | From 30 June 2025, no parking minimums for multifamily or residential adaptive re-use inside an MPO and a mapped transit service area | verified |
| `co_hb24_1152` (corrected) | C.R.S. § 29-35-103 (HB 24-1152) | Citation and no-new-parking rule confirmed from the signed act. **It had no coverage condition, so the engine applied it to every Colorado single-family parcel;** it now requires a municipality of 1,000+ inside an MPO | verified |

**Searched, nothing qualifying:**
- **Full text searched:** IA (ch. 414, 335), MI (Zoning Enabling Act), MN (§ 462.357), ND (ch. 40-47), OH (ch. 713, 519), SC (ch. 6-29), WY (title 15).
- **North Carolina:** G.S. 160D-702(c)(2a) bars minimum parking requirements, but is marked "(Effective January 1, 2027)", so it's passed but not yet in effect.
- **Texas:** SB 673 (2025 ADUs) was not enacted; its last action was being placed on the House calendar on 26 May 2025. HB 2789, which I checked as a possible ADU bill, is a child-welfare bill.
- **California:** AB 2011's Article 2 (mixed-income commercial corridors, §§ 65912.120 ff.) is not added yet.

**Could not search the code text** (the state's site returned only a table of contents, a bot check or an error):
AL, AK, AR, DE, GA, IL, IN, KS, KY, LA, MS, MO, NE, NJ, NM, NY, OK, PA, SD, TN, VA, WV, WI. For these states "none
found" still rests on round 1's candidate search only. NH, CT, DC and MD stay could-not-check or not-checked, because
their official sites don't connect from the audit machine and Justia and FindLaw block it. Search engines (LegiScan,
Justia search, DuckDuckGo, Brave, Mojeek) blocked automated queries. Bing's results were not used, because its terms
forbid it.
