# Which zones do SB 9 and the state ADU law reach? (Los Angeles area)

Research only. No code, test or existing doc was changed. All fetches were made on 20 Nov 2026.
Every quote below was copied from the fetched file; nothing was filled in from memory.
Downloaded files are kept outside the repo in
`/tmp/claude-0/-home-user-city-pretty/804e51d6-2e9d-51f2-80b4-538565e4fc2e/scratchpad/sb9/`
(that directory is temporary). The first 16 hex digits of each PDF's SHA-256 are given so a later
fetch can be compared.

## What could not be fetched

| Source | What happened |
| --- | --- |
| `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65852.21` (also 66411.7, 66314, 66313, 66323) | HTTP 403 with a Cloudflare "Just a moment..." challenge page, from both curl and WebFetch. **The codified text on leginfo was not fetched.** |
| `https://web.archive.org/web/2026/https://leginfo.legislature.ca.gov/...` | curl: connection reset; WebFetch: "unable to fetch from web.archive.org". |
| `https://law.justia.com/codes/california/code-gov/.../section-65852-21/` | HTTP 403 (and not a primary source anyway). |
| `https://planning.lacounty.gov/long-range-planning/sb-9/` | HTTP 404 (guessed URL; the county memos were fetched directly instead). |
| `https://www.longbeach.gov/globalassets/lbcd/media-library/documents/planning/sb9/sb-9-chart-final` | HTTP 404. |
| Pasadena, Torrance, Burbank SB 9 pages | One search found no official page; not fetched. |

Consequences:

- **SB 9 statute (Q1):** quoted from the chaptered text of Assembly Bill 1061 (Chapter 505, approved
  10 Oct 2025) as attached to an LA County Regional Planning memo. This is an official copy of the bill
  that amended both sections, but it is not the leginfo codified page. Whether either section was
  amended again after AB 1061 is **not confirmed**.
- **ADU statute (Q4):** the verbatim text of Gov. Code § 66314 was **not fetched**. Only the state
  housing department's (HCD) and the City's paraphrases with section citations were fetched. The exact
  statutory wording in the task brief ("zoned to allow single-family or multifamily dwelling residential
  use") is therefore **not confirmed** and is withheld as a quote.

---

## 1. SB 9 statute: which zones?

**Source:** Assembly Bill No. 1061, Chapter 505, as Attachment A of the LA County memo.
URL: https://planning.lacounty.gov/wp-content/uploads/2026/01/SB9_MEMO.pdf
(PDF sha256 `accfc245b36848fb…`; memo dated "June 8, 2026" despite the `2026/01` path.)

Header of the attachment, verbatim:

> Assembly Bill No. 1061
> CHAPTER 505
> An act to amend Sections 65852.21 and 66411.7 of the Government Code, relating to land use.
> [Approved by Governor October 10, 2025. Filed with Secretary of State October 10, 2025.]

Gov. Code § 65852.21(a), verbatim:

> 65852.21. (a) A proposed housing development containing no more than two residential units within a
> single-family residential zone shall be considered ministerially, without discretionary review or a
> hearing, if the proposed housing development meets all of the following requirements:

Gov. Code § 66411.7(a)(3)(A), verbatim:

> (3) The parcel being subdivided meets all the following requirements:
> (A) The parcel is located within a single-family residential zone.

Plain reading: both halves of SB 9 apply only "within a single-family residential zone". The text
fetched does not define that phrase or name any zone codes.

**State agency reading of that phrase.** HCD, "SB 9 Fact Sheet", dated "September 2024".
URL: https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf
(sha256 `83fc411eaf75a41b…`). Note: September 2024 predates AB 1061 (2025). Verbatim:

> Single-Family Residential Zones Only
> (Reference: Gov. Code, §§ 65852.21, subd. (a); 66411.7 subd. (a)(3)(A))
> The parcel that will contain the proposed housing development or that will be subject to the lot split
> must be located in a single-family residential zone. Parcels located in multi-family residential,
> commercial, agricultural, mixed-use zones, etc., are not subject to SB 9 mandates even if they allow
> single-family residential uses as a permitted use. While some zones are readily identifiable as
> single-family residential zones (e.g., R-1 "Single-Family Residential"), others may not be so obvious.

and, continuing:

> This review will enable the local agency to identify zones whose primary purpose is single-family
> residential uses, and which are therefore subject to SB 9. Considerations such as minimum lot sizes,
> natural features such as hillsides, or the permissibility of keeping horses should not factor into the
> determination.

Plain reading: HCD says agricultural zones are **not** subject to SB 9 mandates even where a house is a
permitted use; the test is the zone's primary purpose. Large-lot and horse-keeping single-family zones
still count.

## 2. City of Los Angeles: which zones does the City treat as SB 9 eligible?

**Source A: LA City Planning interdepartmental memorandum**, subject "Updated Implementation of Senate
Bills 9 (2021) and 450 (2024) and Assembly Bill 1061 (2025) - Housing Opportunity and More Efficiency
(HOME) Act - Two Unit Development and Urban Lot Splits".
URL: https://planning.lacity.gov/odocument/bef6b998-de32-4090-9557-5f98711c6c15/SB9_Memo_2-7-22MG_-_signed.pdf
(sha256 `7c8631acd04701c1…`). Linked from https://planning.lacity.gov/plans-policies/initiatives-policies/housing .

Verbatim (the PDF's text layer drops the spaces between some words; spaces are restored here, no word
changed; the first letter of "Eligible" is a separate drop capital in the PDF):

> Eligible Zones. The law applies to parcels zoned for single-family (one-family) residential uses,
> which includes the following Zones: A, RA, RE, RS, R1, RU, RZ, and RW1 in Chapter 1 of the Zoning
> Code, as well as 1L Density Districts in Chapter 1A of the Zoning Code.

Same memo, on what it replaces:

> This memorandum updates and replaces the memorandum issued by LACP on March 16, 2023 to reflect
> changes to state law that are now effective.

Same memo, on scope:

> This memorandum focuses primarily on projects governed by Chapter 1 of the Los Angeles Zoning Code.
> Additional guidance specific to Chapter 1A will be provided in a subsequent memorandum.

Date: the DATE field of the memo is blank in the extracted text (**memo's own date not confirmed from
the memo**). The City's FAQ (Source B) gives the revision dates. The file name still says "2-7-22"
although the content is the version covering AB 1061 (2025), so the URL is being reused for the
current memo. It does not predate SB 450 or AB 1061.

Plain reading: the City counts the agricultural "A" zones (written as "A", not "A1, A2"), RA, RE, RS,
R1, RU, RZ and RW1 as SB 9 zones. R1 variation zones (R1V, R1F, R1R, R1H), RW2, R2, RD and R3 are not
named anywhere in the memo.

**Conflict to flag:** the City's inclusion of "A" zones sits against HCD's 2024 statement (section 1)
that parcels in "agricultural ... zones ... are not subject to SB 9 mandates". The City may choose to
offer SB 9 there; the fetched sources do not show that state law requires it. Not resolved here.

**Source B: LA City Planning FAQ**, "Frequently Asked Questions Related to HOME Act Implementation
(SB 9)", "Revised on August 24, 2026".
URL: https://planning.lacity.gov/odocument/597fb369-6fbd-4148-a057-3f33233405d2/SB9FAQ2.7l.pdf
(sha256 `00915f91fd662ac1…`). Verbatim:

> Los Angeles City Planning released an Interdepartmental Implementation Memo on Jan. 10, 2022. Revised
> versions of the Memo were issued on March 16, 2023 and Aug. 24, 2026.

> Q18. My property is zoned for two or more units. Can I use SB 9?
> No, SB 9 is only applicable to single-family zones.

Plain reading: the current memo is the 24 Aug 2026 revision; lots zoned for two or more units are out.
The FAQ does not list zone codes.

**LADBS pages** (https://ladbs.org/services/special-assistance/senate-bill-9-two-unit-development-and-urban-lot-split
and https://dbs.lacity.gov/node/4491): fetched (HTTP 200); no zone list found in the page text.

## 3. Unincorporated LA County

**Source: LA County Department of Regional Planning memo to staff**, dated "June 8, 2026", from the
Director of Regional Planning, on SB 9 / SB 450 / AB 1061.
URL: https://planning.lacounty.gov/wp-content/uploads/2026/01/SB9_MEMO.pdf (sha256 `accfc245b36848fb…`).
Verbatim:

> 1. The project site is located within Zone R-1 or R-A; 3 or within one of the following specific

The earlier memo dated "March 5, 2026"
(https://planning.lacounty.gov/wp-content/uploads/2026/03/S_3_4_2026_AP_M_SB9_SB450.LJ_.ap_.ajb-3-5-26.pdf,
sha256 `36818bc30f73a408…`) gives the full list, verbatim:

> B. Project Location. The project satisfies all of the following:
> 1. The project site is located within Zone R-1 or R-A; 3 or within one of the following specific plan
> zones:
> a. West Carson TOD Specific Plan: West Carson Residential 1
> b. Willowbrook TOD Specific Plan: Willowbrook Residential 1
> c. Connect Southwest LA TOD Specific Plan: CSLA Residential 1

(the "3" is a footnote mark: "For split-zoned parcels, refer to Section 22.06.070.D of the County Code.")

Plain reading: in unincorporated areas only County zones R-1 and R-A and three named specific-plan
zones are SB 9 eligible. No agricultural zone is on the list. The same three specific-plan lines
(a, b, c) appear in the June 8, 2026 memo.

## 4. State ADU law: zoning condition

Statute text (Gov. Code § 66314): **not fetched** (leginfo blocked, see top). Paraphrases with section
citations from two official sources:

**HCD, "Accessory Dwelling Unit Handbook", "March 2026".**
URL: https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf
(sha256 `ec499e12c08974d8…`). Verbatim:

> Does a local agency have to permit ADUs on lots zoned for multifamily use?
> Yes. A local agency must permit an attached, detached, or converted ADU on a lot that is zoned to
> allow single-family or multifamily residential use and includes an existing or proposed dwelling
> (Gov. Code, § 66314, subds. (d)(2), (d)(3)).

> Must ADUs be allowed jurisdiction-wide?
> No. Local agencies may, by ordinance, designate where ADUs are permitted within zones that allow
> residential use. However, any limits on where ADUs are allowed may only be based on the adequacy of
> water and sewer service and on the impacts on traffic flow and public safety. (Gov. Code, § 66314,
> subd. (a).)

**City of Los Angeles, ZA Memorandum No. 143**, dated "December 30, 2024".
URL: https://planning.lacity.gov/odocument/184600d8-71d7-4d74-baf1-1f9cd2603320/ZA%20Memo%20No%20143-%20Implementation%20of%202019%20ADU%20Ord%20and%20State%20ADU%20Law%20(Updated%20based%20on%202022,%202023%20an.pdf
(sha256 `2b5441910e2cc006…`). It states it reflects state law "effective January 1, 2025", so it
predates any 2025-2026 ADU amendments. Verbatim:

> ADUs are permitted through a ministerial process in all areas zoned to allow for single-family or
> multifamily residential uses (see Q.2) and where there is a proposed or existing dwelling unit (or
> units) on a lot.

> Areas zoned for these uses means zones in which these uses are a permitted use in the respective zone
> classification. In cases when the residential use is tied to the provision of another use (such as a
> caretaker or watchman unit as part of an industrial development in the M zones) the zone is not
> considered to allow these uses.

> Q. 29 What zones allow residential uses "permitted by right" pursuant to LAMC 12.22 A.33(c)(3)?
> Any zone where a residential use (e.g. one family dwelling, etc) is a permitted use in the use
> provisions of the zoning code.

Plain reading: the ADU test is use-based, not zone-name-based: any zone where a one-family or
multifamily dwelling is a permitted use, with a dwelling existing or proposed on the lot. That is
wider than SB 9's "single-family residential zone" and covers multifamily zones. Neither source lists
LA zone codes; the LAMC use lists for each zone were not fetched.

## 5. Other jurisdictions in the bundle (low priority)

| Jurisdiction | Result |
| --- | --- |
| Long Beach | City page https://www.longbeach.gov/lbcd/adus/ (HTTP 200), verbatim: "To qualify for an SB 9 unit, a property must be zoned R-1 (Single-Family) and contain no more than one existing single-family dwelling." The city's chart of R-1 sub-districts returned 404; sub-district list **not fetched**. |
| Glendale | City page not fetched. HCD technical-assistance letter to Glendale dated "February 10, 2026" (https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/HAU/glendale-ta-021026.pdf, sha256 `9c0a06c0de3acf75…`) summarises the city code, verbatim: "GMC 30.34.110(D)(2) - A SB 9 housing development is permitted to have a maximum of two units on a parcel in a single-family residential zone (ROS, R1R, and R1)." This is HCD's description of the Glendale code, not the code itself. |
| Pasadena | not fetched |
| Torrance | not fetched |
| Burbank | not fetched |

---

## Summary table (City of Los Angeles zone prefixes)

Column 2 is traceable to the City memo quote in section 2 (Source A) and FAQ Q18 (Source B).
Column 3 is traceable to the HCD handbook and ZA Memo 143 quotes in section 4; because those give a
use-based rule and no zone list, "yes" there rests on the City memo's own statement that the listed
zones are "zoned for single-family (one-family) residential uses".

| Zone prefix | SB 9 eligible per LA City source? | ADU law reaches it? |
| --- | --- | --- |
| A1 | yes, as "A" (memo lists "A", does not spell out A1). Conflicts with HCD 2024 fact sheet on agricultural zones; state-law mandate not confirmed | yes (City memo calls "A" zoned for one-family use; ADU rule is any zone permitting that use) |
| A2 | yes, as "A" (same caveat as A1) | yes (same basis as A1) |
| RA | yes | yes |
| RE (e.g. the layer's RE40) | yes ("RE"; numbered variants not listed separately) | yes |
| RS | yes | yes |
| R1 | yes | yes |
| R1 variations (R1V, R1F, R1R, R1H) | not stated (memo names only "R1"; variation zones are not mentioned) | not stated by zone; yes by rule only if a one-family dwelling is a permitted use there (LAMC not fetched) |
| RU | yes | yes |
| RZ (e.g. the layer's RZ3) | yes ("RZ"; numbered variants not listed separately) | yes |
| RW1 | yes | yes |
| RW2 | not stated (not in the list) | not stated by zone; rule-based only |
| R1P / "-1L" suffix (e.g. R1P-1L) | not confirmed. The memo's "1L Density Districts in Chapter 1A" may or may not be what the layer's "1L" suffix means; not checked against the zoning code | not stated by zone; rule-based only |
| R2 | no by FAQ Q18 ("zoned for two or more units ... No"); R2 itself is not named | yes by rule (multifamily zones are covered); R2 not named |
| RD | no by FAQ Q18 (same); RD not named | yes by rule; RD not named |
| R3, R4, R5 (R3+) | no by FAQ Q18 (same); not named | yes by rule; not named |

### Bottom line for the page's "single-family" category

- In per the City's current memo: A (A1, A2), RA, RE, RS, R1, RU, RZ, RW1.
- Out per the City FAQ: zones for two or more units (R2, RD, R3+), which still fall under the ADU rule.
- Unconfirmed: R1 variation zones, RW2, the R1P / "-1L" codes, and whether SB 9 as state law (as opposed
  to City practice) reaches the A zones, given HCD's statement that agricultural zones are not subject
  to SB 9 mandates.
- Unincorporated County differs from the City: only R-1, R-A and three specific-plan zones; no County
  agricultural zone is listed. A City-style rule must not be applied to County rows.
- Still owed: the leginfo codified text of §§ 65852.21, 66411.7 and 66314 (needs a browser fetch).
