# Two branches checked the same tables: comparison and settlement (19 Nov 2026)

Two branches checked the same data tables independently. This base kept its own version of every shared table on
merge. The other branch's checking evidence (`research/laws_verification.csv`, `research_verification.csv`,
`sites_verification.csv`, `transit_verification.csv`) and its final tables (commit 4e76a8a, read with
`git show 4e76a8a:app/data/<file>`) were never compared with this base's tables. This file does that, record by
record. Every disagreement on a fact a user or the advisor sees was settled by fetching the official text on
19 Nov 2026; the side that was right is named in each row. Where it could not be settled, the field is marked
unconfirmed the way this base does (`verification.unverified_fields`) and what depends on it is withheld.

Method: both JSON files were loaded and compared field by field (scripts kept outside the repository). "Other" means
the other branch's table or CSV; "base" means this branch before today.

## Results at a glance

| Table | Records here / other | Agree on every user-visible field | Disagreed and settled | One side only |
|---|---|---|---|---|
| Housing laws (`statutes.json`, mirrored in `state-housing-laws.json`) | 45 / 22 (18 shared) | 2 | 9 (including the Florida and SB 79 / SB 722 leads); 7 left flagged | base 27, other 4 |
| Funding programs | 11 / 11 | 0 (every record differed in at least one field) | 11 | none |
| State finance profiles | 52 / 52 | 43 | 9 (base right in all 9) | none |
| Studies (`research.json`) | 45 / 18 | 18 shared agree on DOI, title and year | effect-size or geography fields on 12 shared records (7 restored with quotes); 9 unconfirmed records removed | base 27 (the other deleted or never had them) |
| Case studies | 8 / 5 | 0 | 5 | base 3 (Denver, Cleveland, Austin) |
| Underused sites | 90 / 94 | 0 by id; 12 by parcel (acres within 1%) | 2 disputed, 1 flagged unconfirmed | base 78, other 82 |
| Transit pipelines | 5 / 5 | 0 | 5 (2 settled with new figures, 3 left) | none |
| Intercity corridors | 4 / 6 | 0 | 4 | other 2 (Cascadia, Houston-San Antonio) |
| Unit costs | 33 / 32 | 20 | 4 (3 are different rows, 1 base right) | base 2, other 1 |
| HUD fair market rents | 3,222 / 639 | 620 | 0 (19 differ only in layout) | base 2,583 |

## 1. Housing laws

Agree (same facts on both sides): `ca_ab2097` (the other only adds the chapter number) and `wa_hb1110` (same unit counts,
75,000 / 25,000 bands and 1/4-mile rule; the other adds a 50-year affordability term). Shared records still unsettled and
flagged on both sides: `mn_minneapolis_2040`, `nc_raleigh_missing_middle` (both unverified, so never applied), `co_hb24_1313`,
`co_hb24_1152`, `me_ld2003`, `mt_sb323`, `ma_mbta_communities` (dates and citations only).

Disagreed, and what the official text says:

| Record | Base said | Other said | Official text (fetched 19 Nov 2026) | Right |
|---|---|---|---|---|
| `fl_live_local` scope | commercial or industrial zoning only (`commercial_or_industrial_only: true`) | not stated | Fla. Stat. 166.04151(7)(a)1: "in any area zoned for commercial, industrial, or mixed use; ... on property owned by a county, municipality, or school district; and on property that is more than 3 acres in size and owned by a religious institution ... regardless of the underlying zoning" | Pilot lead was right; base wrong. Fixed. |
| `fl_live_local` exclusions | airport noise, "everglades_or_wekiva_or_trpa" | exclusions of (7)(o) | (7)(o): 1. airport-impacted areas, s. 333.03; 2. recreational and commercial working waterfront in industrial zones, s. 342.201(2)(b); 3. Wekiva Study Area; 4. Everglades Protection Area; 5. open-character districts in existence before July 1, 2026; 6. areas of critical state concern; 7. conservation easements. No TRPA. | Other right; base wrong. Fixed. |
| `fl_live_local` amendments | ended at ch. 2024-188 | through ch. 2025-172 | History line: "s. 5, ch. 2023-17; s. 2, ch. 2024-188; s. 2, ch. 2025-172; s. 15, ch. 2026-14; s. 2, ch. 2026-163; s. 2, ch. 2026-179"; also "(p) This subsection expires October 1, 2033." | Pilot lead right; both sides stale. Fixed. |
| `fl_live_local` effective date | 2024-07-01 | 2023-07-01 | ch. 2023-17: "this act shall take effect July 1, 2023" (approved 2023-03-29); ch. 2024-188 effective on becoming law (2024-05-16); ch. 2025-172 effective 2025-07-01; ch. 2026-179 effective 2026-07-01 | Other right for first enactment; base's 2024-07-01 appears in no act. |
| `fl_live_local` AMI ceiling, 75% exemption | 1.2, 0.75 (AMI definition not fetched) | blank | 420.0004(12) moderate income "less than 120 percent"; 196.1978(3)(d)1.a "Seventy-five percent of the assessed value" for >80% to 120% AMI | Base right; now sourced. |
| `ca_sb79_*` citation | Ch. 512 only | adds SB 722, ch. 100 | Official code table: GOV 65912.157 "Amended (as added by Stats. 2025, Ch. 512, Sec. 1) by Stats. 2026, Ch. 100, Sec. 2. (SB 722) Effective July 16, 2026."; SB 722 chaptered 2026-07-16, urgency statute, adds 65912.157(h)(3): sites governed by the Mobilehome Residency Law, RV Park Occupancy Law, Mobilehome Parks Act or Special Occupancy Parks Act | Pilot lead right. Fixed. |
| `ca_sb79_*` eligible counties | 8-county list (flagged unverified) | none; "not in the statute" | 65912.156(q): "'Urban transit county' means a county with more than 15 passenger rail stations." | Other right. Engine changed (below). |
| `ca_sb79_*` exclusions | VHFHSZ, sea-level rise, local historic register | VHFHSZ only via 65913.4; others in alternative-plan rules | 65912.157(h)(1)-(3) lists the site exclusions; sea-level and historic-register sites appear only in 65912.161 (local alternative plans); the VHFHSZ bar comes through 65912.159(a)(3) when streamlining is sought | Other right. Fixed. |
| `ca_sb79_*` parking minimum 0, affordability | parking 0 (flagged); one list of 7/10/13% options | no parking elimination in SB 79; "a single percentage is not statutory" | 65912.157(d): density bonus law parking ratios; (i)(1)(A): 7% extremely low, 10% very low or 13% lower | Agree on facts; base keeps its unverified flag on parking. |
| `ca_sb9_lot_split` exclusions | 4 site conditions | 7 | 65852.21(a)(2) incorporates 65913.4(a)(6)(B)-(K) "as that section read on September 16, 2021" (that text not read); 66411.7: 1,200 sq ft minimum new parcel, 40% rule | Other closer to the statute; the full list is unconfirmed here. Marked unverified; 1,200 sq ft recorded. Both sections were amended by SB 1426 (Stats. 2026, ch. 56, eff. 2026-06-30), now cited. |
| `tx_sb840` exclusions | airport noise only | 218.101(c) list | 218.101(c): "(1) a zoning classification that allows heavy industrial use; (2) land located within: (A) 1,000 feet of an existing heavy industrial use ...; or (B) 3,000 feet of an airport or military base; or (3) an area designated by a municipality as a clear zone or accident potential zone." | Other right. Fixed; parcel checks marked unverified. |
| `az_hb2720_2721` max units | 4 (middle housing) | 3 (ADU path) | A.R.S. 9-461.18(A)(1): "At least one attached and one detached accessory dwelling unit" (home + 2 = 3). Laws 2024 ch. 197 (HB 2721, approved 2024-05-21) added 9-462.10, but that section now reads "Commercial buildings; multifamily residential development; adaptive reuse ..." | Both partly right; current status of the 4-unit rule not confirmed. Unit count withheld; 3 recorded for the ADU path. |
| `vt_act47` max units, date | 2 units, effective 2023-07-01 | 4 units, effective 2024-12-01 | 24 V.S.A. 4412(1)(D): duplexes permitted wherever year-round residential use is allowed; in districts "served by municipal sewer and water infrastructure ... multiunit dwellings with four or fewer units shall be a permitted use". Act 47: secs. 1-2 effective Dec 1, 2024 "except for subdivision (1)(D) of Sec. 2, which shall take effect on July 1, 2023" | Base's date right for (1)(D); other's 4 units right where sewer and water serve. Unit count withheld (service is not a parcel field); both numbers recorded. |
| `or_hb2001` effective date | 2020-01-01 | 2019-08-08 | Enrolled bill: "an emergency is declared to exist, and this 2019 Act takes effect on its passage." Signing date not on the copy fetched. | Neither confirmed; 2020-01-01 is in no text. Set to unconfirmed. |
| `tx_austin_home` | ordinances 20231207-001 and 20240516-006, effective 2024-05-16 | ordinance numbers "not confirmed", 2024-02-05 | City page: "Ordinance 20231207-001 - Phase 1 HOME Amendments"; "Ordinance 20240516-006 - Phase 2"; "Feb. 5, 2024: Development applications accepted under HOME Phase 1"; "May 16, 2024: HOME Phase 2 adopted" | Base right on numbers; both dates are real events. Note added. |
| `co_hb24_1313`, `co_hb24_1152`, `me_ld2003`, `mt_sb323` | dates and citations typed, flagged unverified | citations differ, dates null | Not re-read (dates are in the records' `unverified_fields`) | Unsettled; left flagged. |

One side only: base has 27 records the other lacks (SB 79 light-rail tiers, ADU and parking laws in UT, WA, OR, MT, MA,
RI, CA, AZ, TX, ID, NV, CO, VA, DC, CT and others); other has `tx_adu_statute` (its own check found SB 1412 failed
to pass: nothing enacted), `ut_sb174` (page needed JavaScript; unverified), and `wa_hb1337` / `tx_sb15` (base has the same
laws as `wa_hb1337_adu` and `tx_sb15_small_lots`).

Engine changes (`evaluateByRightHousing` copies in `app/app.js` and `src/engines/statutoryZoningEngine.js`, kept
identical; test: `tests/unit/statuteCorrections1119.test.ts`):
- `fl_live_local` applied to commercial parcels only. It now also applies where the parcel is flagged as public or
  religious-institution land, and reports "who owns the parcel" as not confirmed when neither is known.
- SB 79 returned "does not apply" for any county outside the 8-county list. It now checks the distance first and, for a
  county off the list with a stop in range, reports "whether this county is an urban transit county (more than 15
  passenger rail stations)" as not confirmed.
- The hard exclusion flag `everglades_or_wekiva_or_trpa` (applied to every state's laws) was removed from the generic
  check and renamed `wekiva_or_everglades_protection_area`; it excludes only through the Florida record's list.

## 2. Funding programs

All 11 records match on program name and the statutes cited, except the fields below. Base kept percent shares and
cycle dates that its own `unverified_fields` flagged; the other branch removed them. Settled by the statute text and the
Public Works board letter already quoted in each record; the unsourced values were removed here too.

| Record | Field | Base | Other | Source says | Right |
|---|---|---|---|---|---|
| `la_measure_w` | share, cycle | 100%; "deadline July 31" | none | Board letter 17 July 2018: 50% Regional, 40% Municipal, 10% District of revenues; project share not stated | Other |
| `la_prop_k` | share, cycle | 80%; "biennial" | none | not fetched (eng.lacity.gov unreachable) | Other |
| `calfire_urban_forestry` | share | 90% | range 25-90% | PRC 4799.12: "25 to 90 percent of costs"; may be waived in disadvantaged communities | Other; range kept |
| `il_transit_tif` | share, term | 100%, 35 years | none | source page 404; statute not fetched | Other |
| `az_gplet` | share | 100% property tax abatement | excise tax abatement, 8 years | A.R.S. 42-6209: abates the lease excise tax, 8 years, single central business district | Other |
| `fl_live_local_tax_exemption`, `fl_cra_ch163`, `tx_tirz_ch311`, `co_ura_tif`, `federal_fra_intercity_grant` | cycle dates, agency | typed, flagged unverified | none | statute text for the shares agrees on both sides (75%, 95%, 15%, 25 years, 80%) | Other on dates; shares agree |
| `ca_urban_greening` | program name | Proposition 4 Climate Bond; 2026 round dates | Cap-and-Trade; annual window | base fetched the program page; other was older | Base |

## 3. State finance profiles

38 of 52 profiles match on every number. Differences that a user or the advisor sees:

| State | Field | Base | Other | Source (base's own quote, re-checked today where marked *) | Right |
|---|---|---|---|---|---|
| TX | homestead exemption | $140,000 (school taxes) | $100,000 | Comptroller page* "Tax Code Section 11.13(b) requires school districts to provide a $140,000 exemption on a residence homestead" | Base |
| TX | reassessment cycle | 3 years | 1 | Tax Code 25.18 "at least once every three years" | Base |
| CO | commercial ratio | 0.25 | 0.279 | HB 24B-1001 summary quoted in the record (2026 value) | Base (2025 value was 27.9%) |
| MD | annual cap, homestead | 10% credit; no exemption | none; 5% exemption | Md. Tax-General 9-105 quoted in the record | Base |
| NV | assessed-value cap | none; 3% tax-bill cap | 3% assessment cap | NRS 361.4723 limits tax bill growth | Base |
| OH | reassessment | 6 years | 3 | R.C. 5713.01 "at least once in each six-year period" | Base |
| UT | residential ratio | 1.00 | 0.55 | 59-2-103: 45% exemption of fair market value; the record had both | Base |
| IA, MN | residential ratio | withheld (formula; class rates) | 0.5, 1 | statute text quoted in the record | Base |
| SC | 15% five-year cap | present | absent | S.C. Code 12-37-3140 referred to as "The fifteen percent cap in Section 12-37-3140" (read in 12-37 chapter page*) | Base |
| FL, AZ, MI, TX | cap scope notes | absent | present | consistent with base's field evidence | Agree |

No change was needed.

## 4. Studies and case studies

Every study with a DOI was re-checked in Crossref and OpenAlex today (title, authors, year, journal). All 27 DOIs
resolve to the paper named in this record (the earlier mismatches were already fixed on this base by substitution).
`tree_009`'s indexes append ": Table 1" to the title; same article, same authors.

Records the other deleted that this base still showed, and what was done:

| Record | Evidence today | Action |
|---|---|---|
| `art_008`, `tree_006`, `hist_004`, `hist_006`, `hist_008`, `hist_009`, `transit_002`, `bike_001`, `bike_004` | cited pages return 404 (or fail TLS/proxy); existence not confirmed; effect sizes already removed | Removed from the list (withheld) |
| `hist_001` | other found the real source; fetched the PDF: Levere, "The High Line Park and Timing of Capitalization of Public Goods", 20 Dec 2014: "Home values within one-third of a mile of the park increased 10% immediately following its opening." | Replaced; the invented ULI report and +103% stay removed |
| `hist_003` | publisher page now 403 here; other's 18 Nov fetch also read 148% | Kept, note added |
| `art_002`, `tree_005`, `park_005`, `facade_002`, `park_002` | pages exist, no study or figure found | Kept as "source page exists", no effect size |
| `art_001`, `art_003`, `tree_008`, `transit_004`, `hist_010`, `crime_pope_pope`, `adu_brueckner_thomaz`, `vacant_lin_jensen_wachter`, `tree_wachter_wong`, `ev_liang_2023`, `rehab_ganduri_maturana_2024` | DOI resolves to the named paper; quotes were taken from abstracts in earlier rounds (`hist_010` re-read in the ITDP PDF: "$5.8 billion") | Kept |

Effect sizes the other had and this base withheld (all re-read in the source today, then restored with a quote):
`tree_002` ($1371 / 0.48% per 10% more tree cover within 100 m, USDA PDF), `hist_002` (17.9-26.6%, abstract),
`park_001` (20% abutting passive parks, abstract), `park_003` (premium in two of three neighborhoods, abstract),
`solar_001` ($4/W, $15,000 for 3.6 kW, abstract), `hist_007` (adds the 22.3% premium on the same page).
Not adopted: `school_001`'s "vpd 1.5" (base uses the $1.50 quote in `intervention_verification.json`; the research table keeps value-per-dollar null by rule).
`solar_001` authors: OSTI/OpenAlex list Adomatis, Jackson, Graff Zivin, Thayer, Klise and Wiser (base right; the other named Hoen).

Case studies: `highline_nyc` (publicCost $115M and +10% from Levere) and `beltline_atl` (17.9-26.6%) restored. `healthline_cle`
keeps $5.8B and $200M+ (ITDP PDF re-read: "$114.54 dollars", "$5.8 billion"); the other's 404 was for a different URL. Denver, Waller Creek, OKC and
Greenville remain without figures (pages 404 or 403).

## 5. Underused sites

The two tables hold different parcels (the other rebuilt its list from live county parcels, ranked by size; ids differ).
12 sites appear in both (same parcel index): acres agree within 1% (for example 134 vs 134.06, 114.16 vs 114.19). Two base sites were dropped by the
other's live check: `site_la_30_6569` ("Metro Park and Ride", an OpenStreetMap parking polygon; live parcel at the point is "Single", 1.29 ac) and
`site_la_73_5568` (shopping center 7.52 ac vs live "Store Combination" 7.48 ac). The records carry no coordinates, so the check could
not be re-run: 6569's kind and acres are now listed as unconfirmed; 5568 stays with a note. The other's 82 sites (for example Sepulveda Basin golf, 569.87 ac, and five
outside Los Angeles County) and its measured acres stay in `research/sites_verification.csv`; this base's table holds Los Angeles County only.

## 6. Transit pipelines and intercity corridors

Fetched today: the FTA project profiles for Austin (rating assigned November 2024; LPA June 2023; "receiving a Full Funding Grant Agreement in June 2027" as ATP's planned schedule; 9.8 miles, 15 stations; $8,233.60M; CIG $4,067.40M) and Chicago ("CTA and FTA entered into an FFGA in January 2025 ... revenue service date projected for August 2031"; $5,750.00M; CIG $1,973.98M; LPA adopted into the long-range plan October 2010), and the FRA FY22 Corridor ID selection list.

| Record | Base said | Other said | Source | Right |
|---|---|---|---|---|
| Austin status | pre-construction; FTA Record of Decision Jan 16, 2026 (Wikipedia) | New Starts Project Development; FFGA not executed | FTA profile (Nov 2025); ROD not on an agency page | Other for what is sourced; base's ROD claim kept only as "secondary source" |
| Austin adopted year | 2020 (voter approval) | 2023 (LPA) | FTA: LPA June 2023 | Other |
| Austin title | "... & Riverside/South Congress TOD Corridor" | "Austin Light Rail Phase 1" | FTA title | Other; "(Project Connect)" kept because the page and an Invest test use that name |
| Chicago RLE status | FFGA not confirmed; adopted 2024 | FFGA Jan 2025; adopted 2010 | FTA profile | Other |
| LA D Line, OC Streetcar, Denver BRT | status text equal in substance | equal; other dropped hub/station geometry | agency pages already quoted | Agree; geometry stays flagged unverified |
| Phoenix-Tucson | MAG, PAG, FRA leads; 120 miles; $500k Step 1 | ADOT only; no length | FRA list: "Arizona Department of Transportation"; "Step 1"; no length | Other on leads and length; base right on the $500k planning award |
| Austin-San Antonio | "FRA Corridor ID Step 1 Award ($500k)" | none found | FRA FY22 list has no Austin-San Antonio corridor (lists Houston to San Antonio, Texas Triangle, Amtrak Texas High-Speed Rail); other rounds unchecked | Other; claim withheld |
| Front Range | SB24-184 (secondary), 173 miles | FY22 selection Step 2 | FRA list: Step 2 | Both; selection added, length removed |
| Brightline West | $3B grant (secondary), 218 miles (company site) | FY22 selection Step 1 | FRA list: Step 1 NDOT | Both; selection added |

Other has Cascadia high-speed and Houston-San Antonio corridors that this base does not carry; they were not added (no station or length data checked).

## 7. Unit costs, HUD rents

Unit costs: 20 of 33 identical. Settled: Ogden high-visibility crosswalk (base $218 confirmed; other nulled): the bid tab PDF was re-fetched and reads "7 HIGH VISIBILITY CROSSWALK EA 130 $ 218.00 $ 28,340.00" for the only bidder (base right). Walsenburg sidewalk: base $110 is the awarded bid for one 220 SY project; other $108.02 is the statewide weighted average from a web-archive copy: different rows, not a conflict; the CDOT book could not be re-fetched today (old path 404; archive refused), so left. Gwinnett $45 and New Rochelle $245 agree. Grayson County TX (3 rows), Kalamazoo, Mesa and Sarasota stay "unchecked" (TxDOT server fails TLS verification, others return 403).

HUD fair market rents (FY2027): 620 of the 639 counties the other carries agree to the dollar; 19 New England counties differ only in layout (base lists town-level rows, other a county value). Base holds 3,222 counties.

## 8. Carried-over files: kept or deleted

Deleted (content captured above and in this base's own evidence files):
`research/research_verification.csv` (every study re-checked here), `research/laws_verification.csv` (every law, program and state profile compared above; its quotes duplicate the statute text now in the records), `research/url_checks.csv` (3,025 rows of link status from 18 Nov: 2,594 ok, 341 blocked, 43 dead, 46 other; the dead links in this base's tables are already noted in their records, and `scripts/check_sources.py` rechecks monthly).

Kept:
- `research/sites_verification.csv`: the only live county-parcel measurements (94 sites, with parcel numbers); 78 of this base's sites have no counterpart.
- `research/transit_verification.csv`: `tests/unit/transitData.test.ts` requires it, and it holds per-field evidence for the intercity, pipeline and unit-cost tables, only some of which is adopted above.
- `research/leftover_claims.md`: a grep inventory of overclaiming words and engine constants, not evidence for any table in this comparison; not reviewed here and its line numbers are stale.

## 9. Not settled

- Colorado, Maine, Montana effective dates and citations (still in each record's `unverified_fields`).
- Arizona middle-housing status after the 2024 act (which later act replaced the text of 9-462.10 was not found).
- Walsenburg statewide average; Grayson County, Kalamazoo, Mesa and Sarasota unit prices.
- Whether the two disputed Los Angeles sites are parcels of the stated kind.
- California SB 9's full exclusion list (65913.4(a)(6)(B)-(K) as it read on 2021-09-16).
