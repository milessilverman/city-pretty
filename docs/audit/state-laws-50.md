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
