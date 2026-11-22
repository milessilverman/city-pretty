# California site exclusions: source notes (companion to `ca.json`)

Research only. No code, test, `app/data` file or existing doc was changed. All fetches were made on 20 Nov 2026.
Every quote was copied by script from the fetched text. Working copies are outside the repo in
`/tmp/claude-0/-home-user-city-pretty/804e51d6-2e9d-51f2-80b4-538565e4fc2e/scratchpad/ca_excl/` (temporary).

## How the statute text was obtained

The Legislative Counsel's official bulk database is reachable even though the leginfo web pages are not:

- `https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip` (HTTP 200; `Last-Modified: Mon, 16 Nov 2026 05:26:36 GMT`).
  Read over HTTP range requests with the repo's existing `scripts/ca_pubinfo_section.py` (table `LAW_SECTION_TBL` and
  its `.lob` files). This is the codified text, an **official** source.
- `https://downloads.leginfo.legislature.ca.gov/pubinfo_2021.zip` (HTTP 200; `Last-Modified: Mon, 28 Nov 2022 05:27:40 GMT`),
  table `BILL_VERSION_TBL`, row `20210AB117492CHP`, file `BILL_VERSION_TBL_8486.lob`: the chaptered text of AB 1174
  (2021), used for the SB 9 cross-reference to § 65913.4 "as that section read on September 16, 2021".

Sections read, with the table's own history line:

| Section | Table row | History line (verbatim) |
| --- | --- | --- |
| § 65852.21 | `GOV65852.21.2026567` | Amended by Stats. 2026, Ch. 56, Sec. 7. (SB 1426) Effective June 30, 2026. |
| § 66411.7 | `GOV66411.7.2026569` | Amended by Stats. 2026, Ch. 56, Sec. 9. (SB 1426) Effective June 30, 2026. |
| § 65913.4 | `GOV65913.4.20257742` | Amended by Stats. 2025, Ch. 774, Sec. 2. (SB 597) Effective January 1, 2026. Repealed as of January 1, 2036, by its own provisions. |
| § 65912.111 | `GOV65912.111.20242724` | Amended by Stats. 2024, Ch. 272, Sec. 4. (AB 2243) Effective January 1, 2025. Repealed as of January 1, 2033, pursuant to Sec. 65912.105. |
| § 65912.157 | `GOV65912.157.20261002` | Amended (as added by Stats. 2025, Ch. 512, Sec. 1) by Stats. 2026, Ch. 100, Sec. 2. (SB 722) Effective July 16, 2026. |
| § 66314 | `GOV66314.202567109` | Amended by Stats. 2025, Ch. 67, Sec. 109. (AB 1170) Effective January 1, 2026. |
| § 66323 | `GOV66323.20255206` | Amended by Stats. 2025, Ch. 520, Sec. 6. (SB 543) Effective January 1, 2026. |

Other rows (65863.2, 65912.110, .112-.114, .121, .155, .156, .158-.162, 66313, 66317, 66321, 66322, 66329) are
identified by row id and effective date in `ca.json` under `sections_read`.

Only one row per section was present in the table for the sections checked (65852.21, 66411.7, 65913.4, 65912.111,
65912.157, 66313, 66314, 66317, 66321, 66323, 66329), i.e. no second, later-operative version was found.

## Part A in one table (details, quotes and exceptions are in `ca.json`)

| Record | Flood (FEMA) | Very high fire zone | Farmland / ag | Public or tribal land | Historic |
| --- | --- | --- | --- | --- | --- |
| `ca_sb9_lot_split` | yes, with LOMR / NFIP / no-rise exceptions | yes, unless mitigation measures adopted or locally excluded from the zone | yes (FMMP prime / statewide importance; voter ag measure) | no | yes (two-unit: district or landmark; lot split: landmark, or demolition in a district) |
| `ca_ab2011_affordable` | yes, same exceptions | yes; vacant sites have no mitigation exception | yes | no | no (only demolition of a registered historic structure) |
| `ca_sb79_*` (all four) | not for the § 65912.157 standards; yes for optional ministerial streamlining | same; plus a city may exclude such sites by ordinance for a limited time | same as flood | no | not in § 65912.157; a city may exclude locally registered historic sites by ordinance |
| `ca_ab2097` | no | no | no | no | no |
| `ca_adu_66323` | no | no | no | no | no |

Three things the engine should not get wrong:

1. **None of the laws names Williamson Act contracts or agricultural preserves.** The farmland item is
   § 65913.4(a)(6)(B): "Either prime farmland or farmland of statewide importance, as defined pursuant to the United
   States Department of Agriculture land inventory and monitoring criteria, as modified for California, and designated
   on the maps prepared by the Farmland Mapping and Monitoring Program of the Department of Conservation, or land zoned
   or designated for agricultural protection or preservation by a local ballot measure that was approved by the voters
   of that jurisdiction." The engine's `williamson_or_ag_preserve` flag tests something the statutes do not.
2. **None of the laws excludes public or tribal land as such.** The nearest items are conservation-plan lands,
   protected-species habitat, conservation easements, and (AB 2011 vacant sites; § 65913.4(b) streamlining) tribal
   cultural resources.
3. **Fire and flood exclusions are conditional.** Where they apply at all they have exceptions that a map flag cannot
   decide (quotes below).

### SB 9 freezes the 2021 list

§ 65852.21(a)(2) (current text): "(2) The parcel satisfies the requirements specified in subparagraphs (B) to (K),
inclusive, of paragraph (6) of subdivision (a) of Section 65913.4, as that section read on September 16, 2021."
§ 66411.7(a)(3)(C) says the same.

The 2021 fire item, from AB 1174 chaptered (Stats. 2021, Ch. 160; bill metadata: CHAPTERED 2021-09-16, APPROVED
2021-09-16, FILED 2021-09-16):

> (D) Within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection
> pursuant to Section 51178, or within a high or very high fire hazard severity zone as indicated on maps adopted by
> the Department of Forestry and Fire Protection pursuant to Section 4202 of the Public Resources Code. This
> subparagraph does not apply to sites excluded from the specified hazard zones by a local agency, pursuant to
> subdivision (b) of Section 51179, or sites that have adopted fire hazard mitigation measures pursuant to existing
> building standards or state fire mitigation measures applicable to the development.

The flood exception (same words in the 2021 and current text):

> A development may be located on a site described in this subparagraph if either of the following are met: (i) The
> site has been subject to a Letter of Map Revision prepared by the Federal Emergency Management Agency and issued to
> the local jurisdiction. (ii) The site meets Federal Emergency Management Agency requirements necessary to meet
> minimum flood plain management criteria of the National Flood Insurance Program pursuant to Part 59 (commencing with
> Section 59.1) and Part 60 (commencing with Section 60.1) of Subchapter B of Chapter I of Title 44 of the Code of
> Federal Regulations.

**Open point:** AB 1174 was an urgency statute signed on the reference date itself. The version of § 65913.4 in force
just before it was not fetched, so whether paragraph (6) was identical in both is **not confirmed**. Note also that
the 2021 item (D) reaches "high" as well as "very high" zones on the Public Resources Code § 4202 maps; the current
item (D) instead reads "or within the state responsibility area". SB 9 uses the 2021 wording; AB 2011 and SB 79 use
the current wording.

### SB 79: the site list only binds the ministerial path

§ 65912.159(a)(3): "(3) The proposed project shall comply with all other requirements of Section 65913.4, including,
but not limited to, the prohibition against a site that is within a very high fire hazard severity zone, pursuant to
subparagraph (D) of paragraph (6) of subdivision (a) of Section 65913.4."

§ 65912.159(b): "(b) Any housing development proposed pursuant to Section 65912.157 not seeking streamlined approval
under Section 65913.4 shall be reviewed according to the jurisdiction’s development review process and Section
65589.5, except that any local zoning standard conflicting with the requirements of this chapter shall not apply."

Plain reading: a flood, fire or farmland lot is barred from SB 79 *streamlined ministerial approval* (subject to the
same exceptions), but § 65912.157's height / density / floor-area floors still apply to it through the ordinary
review process, unless the city has excluded the site by ordinance under § 65912.161(b)(1) (fire zone, sea level
rise, locally registered historic resource; allowed only "Prior to one year following the adoption of the seventh
revision of the housing element"). Whether any particular city adopted such an ordinance was not researched.

---

## Part B

### B1. State ADU law: zoning condition and multifamily lots

Source: official bulk database, `pubinfo_2025.zip`, rows `GOV66314.202567109` and `GOV66323.20255206`
(URL: https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip).

§ 66314, opening sentence:

> A local agency may, by ordinance, provide for the creation of accessory dwelling units in areas zoned to allow
> single-family or multifamily dwelling residential use.

§ 66314(d)(2):

> (2) The lot is zoned to allow single-family or multifamily dwelling residential use and includes a proposed or
> existing dwelling.

§ 66323(a), opening:

> (a) Notwithstanding Sections 66314 to 66322, inclusive, a local agency shall ministerially approve an application
> for a building permit within a residential or mixed-use zone to create any of the following units, or any
> combination of the following units:

§ 66323(a)(3)-(4):

> (3) (A) Multiple accessory dwelling units within the portions of existing multifamily dwelling structures that are
> not used as livable space, including, but not limited to, storage rooms, boiler rooms, passageways, attics,
> basements, or garages, if each unit complies with state building standards for dwellings. (B) A local agency shall
> allow at least one accessory dwelling unit within an existing multifamily dwelling and shall allow up to 25 percent
> of the existing multifamily dwelling units. (4) (A) (i) Multiple accessory dwelling units, not to exceed the number
> specified in clause (ii) or (iii), as applicable, that are located on a lot that has an existing or proposed
> multifamily dwelling, but are detached from that multifamily dwelling and are subject to a height limitation in
> subparagraph (A), (B), or (C) of paragraph (4) of subdivision (b) of Section 66321, as applicable, and rear yard and
> side setbacks of no more than four feet. (ii) On a lot with an existing multifamily dwelling, not more than eight
> detached accessory dwelling units. However, the number of accessory dwelling units allowable pursuant to this clause
> shall not exceed the number of existing units on the lot. (iii) On a lot with a proposed multifamily dwelling, not
> more than two detached accessory dwelling units. (B) If the existing multifamily dwelling has a rear or side setback
> of less than four feet, the local agency shall not require any modification of the existing multifamily dwelling as
> a condition of approving the application to construct an accessory dwelling unit that satisfies the requirements of
> this paragraph.

Plain reading: the state ADU law is not limited to single-family lots. § 66323 applies "within a residential or
mixed-use zone" and expressly covers lots with an existing or proposed multifamily dwelling. The engine's
single-family-only rule is narrower than the statute.

FindLaw (secondary) check: `https://codes.findlaw.com/ca/government-code/gov-sect-66323/` returned HTTP 403
("Just a moment...") to curl. The WebFetch tool reached it and reported the banner "Current as of January 01, 2026"
and a paraphrase matching (a)(3)-(4), but would not return the text verbatim, so nothing is quoted from FindLaw.

### B2. City of Los Angeles: R1 variation zones and the "P" suffix — NOT ANSWERED

No primary source could be fetched, so no code text is quoted and the question stays open.

| Source tried | Result |
| --- | --- |
| `https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-109540` (and `.../lapz/0-0-0-2386`) | HTTP 403, Cloudflare "Just a moment..." (curl and WebFetch) |
| `https://planning.lacity.gov/odocument/eadcb225-a16b-4ce6-bc94-c915408c2b04/Zoning_Code_Summary` (also with `.pdf`) | HTTP 403 "Access Denied" (curl and WebFetch) |
| `https://planning.lacity.gov/ordinances/docs/R1VariationZones/FinalQA.pdf` | HTTP 403 (curl and WebFetch) |
| `https://planning.lacity.gov/odocument/f206e565-8d72-48c7-a7d5-763b9bb74ec8/Appendix_4.5_-_Land_Use_-_Table_C.pdf` | HTTP 403 (WebFetch) |
| `https://cityclerk.lacity.org/onlinedocs/2016/16-1460_misc_12-19-2016.pdf` | HTTP 200 but a redirect notice, not the document: "This document is no longer available at this location." / "On October 26, 2026, the Office of the City Clerk retired the Council File Management System." |
| `https://zimas.lacity.org/documents/zoneinfo/ZI2462.pdf` (guessed URL) | HTTP 403 |

What search-engine result summaries suggested (these are **not** fetched sources and must not be used as evidence):
that the R1V, R1F, R1R and R1H zones are regulated inside LAMC § 12.08 (the "R1" One-Family Zone section), and that a
Housing Element land-use appendix labels R1P as single-family residential with parking. Both points remain
**unverified**. Nothing was found about A2P.

Plain reading: unknown. Until § 12.08 (and the "P" zone section) can be read, the engine should keep treating R1
variation zones and R1P / RAP / A2P as "not confirmed" for SB 9, as `docs/audit/la_sb9_zone_scope.md` already does.
The owner can settle this by opening LAMC § 12.08 in a browser and pasting the text.

### B3. Santa Clarita: SB 9 zones

Source: City of Santa Clarita Planning Division, "Senate Bill 9 (SB 9) FAQs" (2-page PDF; PDF metadata creation date
"Thu Aug 18 17:19:28 2022 UTC"; sha256 `91ea803f7ff3f614…`).
URL: https://santaclarita.gov/home/showpublisheddocument/21438/637964290558900000

> Single-Family Zoning — Parcels must be zoned NU1, NU2, NU3, NU4, NU5, UR1, or UR2.

(The PDF is a two-column table; the row label is "Single-Family Zoning" and the cell text is quoted exactly.)

Same table, "Other Restricted Locations" row:

> Properties cannot be located in a historic district or historic parcel, prime farmland or farmland of state
> importance, wetlands, hazardous waste site*, within a delineated earthquake fault zone*, within a special flood
> hazard area or regulatory floodway*, or lands under conservation easement.

and "High Fire Severity Zone" row:

> For properties located in the high fire hazard severity zone, the property must either front a highway or have two
> non-overlapping ways of accessing a highway.

Plain reading: Santa Clarita treats all seven codes in the zoning layer (NU1-NU5, UR1, UR2) as SB 9 eligible, and
does not bar fire-zone lots outright (it adds an access condition).

Caveats: this is the City's FAQ, dated 2022 by its metadata, not the ordinance. The municipal code was **not**
fetched: `https://www.codepublishing.com/CA/SantaClarita/html/SantaClarita16/SantaClarita1628.html` now returns only
a notice that the code moved to `https://ecode360.com/SA4627`, and that address returned HTTP 403 to WebFetch.
`https://santaclarita.gov/planning/sb9/` (guessed) returned 404. Whether the FAQ is still current after the 2025 and
2026 SB 9 amendments is not confirmed.

### B4. Is the codified leginfo text reachable honestly?

Yes, through the Legislature's own download site; not through the web pages.

| URL | Result (plain curl, 20 Nov 2026) |
| --- | --- |
| `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66323` | HTTP 403, Cloudflare "Just a moment..." |
| `https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB79` | HTTP 403, same challenge |
| `https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202120220SB9` | HTTP 403, same challenge |
| `https://downloads.leginfo.legislature.ca.gov/` | HTTP 200, a plain directory index |
| `https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip` | HTTP 200, `accept-ranges: bytes`; sections read from it |
| `https://downloads.leginfo.legislature.ca.gov/pubinfo_2021.zip` | HTTP 200; AB 1174 chaptered text read from it |

The directory index also lists `pubinfo_daily_Mon.zip` … `pubinfo_daily_Sat.zip` / `_Sun.zip` (daily files, the newest
dated 2026-11-20 in the index) and `pubinfo_Readme.pdf`; these were not opened. No attempt was made to get past the
bot challenge. So the statute engine's California citations can be sourced to the official bulk files (codified
sections and every bill version), and FindLaw is not needed for the sections covered here.

## What could not be fetched (summary)

- leginfo web pages (403) — replaced by the official bulk files.
- FindLaw verbatim text (403 to curl) — not needed.
- § 65913.4 as it stood immediately before AB 1174 on 16 Sep 2021 — not fetched; see the open point above.
- Gov. Code §§ 66324, 66327, 66332 — not returned by the bulk-table lookup; not read.
- § 65912.114 and § 65913.4 beyond subdivision (a)(1)-(7) — keyword-searched, not read line by line.
- Los Angeles Municipal Code § 12.08 and the "P" zone text, and every City Planning document tried — 403. B2 is open.
- Santa Clarita municipal code (eCode360) — 403; only the City's FAQ was read.
