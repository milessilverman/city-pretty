# Laws, state finance and funding programs: audit log

**Audited:** 16 November 2026
**Files:** `app/data/statutes.json` (and its byte-identical copy `app/data/state-housing-laws.json`), `app/data/state_finance_profiles.json`, `app/data/funding_programs.json`
**Machine-readable log:** [`laws-finance-audit.json`](laws-finance-audit.json). **Changes applied by:** [`laws-finance-apply.py`](laws-finance-apply.py). It is one-shot and must run against the pre-audit files; it fails if re-run. **Source URL reachability:** [`laws-finance-urlcheck.json`](laws-finance-urlcheck.json)

## The rule this audit followed

A field is marked **verified** only if a source fetched during this audit confirms that exact claim: bill number, what the law does, the numbers, the date. Nothing was filled in from memory.

- If no reachable source confirmed a claim, the record says `could_not_check` or `unverified`, and the open fields are listed in `verification.unverified_fields`.
- Facts that were disproven were corrected to the sourced value, or set to `null`.
- Laws that are not laws were removed.

Every kept record now has a `verification` block:

```json
"verification": {"status": "verified|partially_verified|unverified|could_not_check",
                 "method": "...", "checked_on": "2026-11-16", "evidence": "short quote",
                 "unverified_fields": ["..."], "notes": "..."}
```

`last_verified` is now `null` on records nobody actually verified. The old files stamped `2026-11-15` on everything, which was not true.

### How sources were reached

- **California:** leginfo.legislature.ca.gov returns 403 from this container. I read the Legislative Counsel's official bulk database instead (`downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip`), pulling only the `LAW_SECTION_TBL` code sections and SB 79's chaptered text with HTTP range requests.
- **Texas:** capitol.texas.gov (bill history and enrolled text). Tax Code sections came from the texas.public.law mirror, which is secondary.
- **Florida:** leg.state.fl.us statutes, flsenate.gov and floridarevenue.com.
- **Washington, Oregon, Arizona, Montana, Maine, Vermont, Massachusetts, Utah, North Carolina:** each state's official legislature or statute site, except ORS 308.146, which came from the oregon.public.law mirror.
- **Colorado:** leg.colorado.gov bill summaries and histories.
- **Austin:** austintexas.gov.
- **Federal:** 49 U.S.C. § 24911 via Cornell LII.
- **Wikipedia** was used only as a secondary source, and only where noted.

## Results

| File | Records before | Verified | Partially verified | Could not check | Unverified (not checked) | Removed | Added | Records corrected |
|---|---|---|---|---|---|---|---|---|
| statutes.json / state-housing-laws.json | 20 | 13 (+2 added) | 4 | 2 | 0 | 1 | 2 | 18 |
| state_finance_profiles.json | 52 | 1 (AZ) | 7 | 2 (IL, GA) | 42 | 0 | 0 | 4 values corrected (AZ, CO, NC, TX) |
| funding_programs.json | 11 | 2 | 4 | 5 | 0 | 0 | 0 | 5 |

## Worst errors found (all fixed in the data)

1. **TX SB 840 was the wrong bill.** The record cited 88(R) SB 840 (2023), which is *"Relating to increasing the criminal penalty for assault of certain hospital personnel."* The commercial-to-residential law is **89(R) SB 840 (2025), effective 9/1/2025**, codified at Local Gov't Code ch. 218.
   - It is not limited to office conversions.
   - Cities may not cap density below the greater of the city's highest allowed density or 36 du/ac, or height below the greater of the commercial height or 45 ft.
   - "1 parking space" is a **cap**, not a minimum.
2. **The "TX Middle Housing & ADU Framework" (SB 1412, 88R) is not a law.** Texas Legislature Online shows *"05/22/2023 H Failed to pass to 3rd reading."* **Removed.**
3. **The Utah ADU record cited a driver-license bill.** Utah SB 174 (2021) is *"Driver License Document Requirements."* The internal-ADU law is **HB 82 (2021)**: signed 3/16/2021, effective 5/5/2021, and it enacts Utah Code § 10-9a-530. The record's id changed from `ut_sb174` to `ut_hb82_iadu`. Its unconfirmed "HB 465 / § 10-9a-403 / commuter-rail" claims were removed.
4. **The Arizona citations did not exist.** A.R.S. §§ 9-467.04 and 9-467.05 return 404. The real sources:
   - HB 2720 is Laws 2024 ch. 196, which adds A.R.S. § 9-461.18 (ADUs, cities over 75,000).
   - HB 2721 is Laws 2024 ch. 197, which added § 9-462.10 as enacted. That law requires duplexes through fourplexes and townhomes within 1 mile of the downtown business district by Jan 1, 2026, with no more than 1 parking space per unit.
   - The "30 ft max height" was not in either law.
5. **CA SB 79 had the wrong section, a wrong county and a misread density figure.**
   - The record cited Gov. Code § 65913.16, which is a different section (amended by SB 597). SB 79 is **§§ 65912.155–65912.162**.
   - It listed Contra Costa County, which was amended out.
   - It treated the 120 **du/acre** density floor as a "120-unit by-right" cap.
   - It claimed a single 10% affordability mandate. The statute requires one of 7% extremely-low, 10% very-low or 13% lower-income units, and exempts projects of 10 units or fewer.
   - It said SB 79 "mandates ministerial by-right approval," which the statute does not do on its own.
   - The record labelled "Tier 2" was actually Tier 1 at 1/4–1/2 mile. I added the two real Tier 2 rows from the statute text.
6. **Florida Live Local had the wrong tax section and an invented parking figure.** The record cited § 196.1979 for the 75% exemption. That section is a separate local-option exemption for households at or below 60% of area median income. The 75% exemption is **§ 196.1978(3)(d)1.a**. The "0.5 parking spaces per unit" figure appears nowhere in the statute; the statute actually requires a 15% parking reduction near transit on request. The DOR form is DR-504AFH, not "DR-504AF."
7. **Austin HOME had the wrong ordinance number and lot size.** Phase 2 is Ordinance **20240516-006**, not -004. The minimum small lot is **1,800 sq ft**, not 1,500.
8. **Oregon used old numbering and an old threshold.** ORS 197.758 has been renumbered to **ORS 197A.420**. The duplex mandate now covers cities of **2,500–25,000** outside Metro, not 10,000+.
9. **Maine reflected the pre-2025 law.** Current 30-A M.R.S. § 4364-A requires at least **3 units per lot**, or 4 in growth areas or on public water and sewer. The record still said 2.
10. **Colorado HB 24-1313 was overstated.** It sets a zoning-capacity goal averaging 40 du/acre across transit areas, not a by-right density on every parcel. It does not abolish parking minimums. The "31 municipalities" figure is unconfirmed and was removed.
11. **State finance values were corrected after reading the statutes:**
    - **AZ:** commercial assessment ratio 16.5% → **15.5%** for tax year 2026 (A.R.S. § 42-15001(16)).
    - **CO:** commercial ratio 27.9% → **25%** for 2026 (HB 24B-1001).
    - **NC:** reassessment cycle 4 → **8** years, the statutory default under § 105-286. Counties may advance it.
    - **TX:** the record cited the § 23.23 10% homestead cap but stored `annual_assessment_cap: null`, meaning "no cap." It is now **0.10**, for residence homesteads only.
12. **Funding programs:**
    - The Urban Greening citation "PRC § 75114" does not exist in California's official code database. It is now `null`.
    - CAL FIRE Urban Forestry grants: the statute says 25–90% of costs, waivable for disadvantaged communities. The record said "100% DAC / 75% non-DAC."
    - Texas TIRZ: the "50–100% pledge" range is unconfirmed (§ 311.013 leaves the share to agreement), so `funding_share_pct` is now `null`.

## Still not verified, and why

- **State finance profiles:** 42 of 52 states were not checked beyond a source-URL reachability test, and every number in those profiles should be treated as unverified. Of the 52 source URLs, 40 returned 200, 4 returned 403, 4 failed to connect, 3 returned 404 (MI, OK, TN) and 1 returned 406.
- **Fields with no source in any state:** `rsmeans_cost_multiplier` (RSMeans is a proprietary, licensed index), `tree_capital_cost_usd`, `climate_energy_regime` and `non_pledgeable_share`. They were kept, not nulled, because `src/engines/residualProfitEngine.ts` and the TIF code multiply by them. They are flagged in every profile.
- **Blocked or unreachable sources:** Illinois (ilga.gov unreachable), Georgia (justia 403), Raleigh (raleighnc.gov 403), LA Measure W (403), LA Prop K (unreachable), CA Urban Greening program page (403), Colorado URA TIF and Illinois Transit TIF (statute text not reached; source URLs dead).
- **Minneapolis 2040:** only a secondary source confirms the elimination of single-family zoning. The triplex rule, parking repeal and citations are unconfirmed.
- **Texas homestead exemption:** the Tax Code mirror shows $100,000. 89(R) SB 4 raises it to $140,000 only if voters approved SJR 2 in November 2025, which I could not confirm.
- **Effective dates:** several remain unconfirmed and are listed per record.

## Consumer impact (for the parent/integrator)

- `app/app.js` loads `statutes.json` and `funding_programs.json` into globals (`STATE_HOUSING_LAWS_DATA`, `FUNDING_PROGRAMS_DATA`) but never reads them afterwards, so the `null`s added there cannot break the app.
- `state_finance_profiles.json` *is* used by the TIF calculator (`app/app.js` ~L190–260). No consumed field was set to `null` there; only the 4 numeric corrections above changed. TX TIF results will now apply a 10% cap.
- `src/engines/statutoryZoningEngine.{ts,js}` contains its own **hardcoded copy** of the old, wrong statute values (SB 79 "120 units", 999-unit placeholders and so on). It does not read `statutes.json` and was not changed by this audit; it needs the same corrections.
- `tests/unit/dataAccuracy.test.ts` asserts several of the disproven facts and now fails:
  - #15 expects Austin minimum lot 1500.
  - #20 expects citations containing the nonexistent "9-467.04" and the unconfirmed "C.R.S. § 29-35-101", and expects the removed `tx_adu_statute`.
  - #2, #3, #8 and #18 require a `last_verified` date on every record, including unverified ones.

  These tests encode fabrications and need rewriting. They were not edited under this audit's scope.

---

## Round 2 (16 Nov 2026): state finance profiles and the tax-increment calculator

Script: `scripts/apply_finance_round2.py` (idempotent; every value it sets carries the quote it was read in, under each
profile's `field_evidence`). Sources were the state code sites that answered from the audit machine, or the state
revenue department where the legislature's site did not (marked in the note).

### What the app uses from these profiles

- **Shown on the page (non-California states):** `annual_assessment_cap` and `res_assessment_ratio` (only when
  confirmed), `statutory_citation`, `tif_vehicle_name`, and now `reassessment_increase_cap` / `tax_bill_growth_cap`
  where sourced.
- **Tax-increment model** (`src/engines/municipalFinanceEngine.ts`): `res_assessment_ratio`, `annual_assessment_cap`,
  `uncaps_on_sale`, `reassessment_cycle_years`, `homestead_exemption_rule`. The page did not call this model (an
  unused copy in `app/app.js` was deleted).
- **Removed everywhere:** `non_pledgeable_share`, `rsmeans_cost_multiplier`, `tree_capital_cost_usd`,
  `climate_energy_regime` had no source in any state. `src/engines/residualProfitEngine.*`, the only user of
  `rsmeans_cost_multiplier` (with an unsourced $265/sq ft base cost), was deleted. The non-pledgeable share is now a
  caller input that must come from a sourced tax-rate-area split.

### Fields checked: 33 checks in 21 states

| State | Confirmed | Corrected (old → new) |
|---|---|---|
| GA | residential ratio 40% (Dept. of Revenue quoting O.C.G.A. 48-5-7) | |
| ID | market value; annual assessment; homestead exemption $125,000 (lesser of that or 50%, not modeled) | |
| IA | | residential ratio 0.5 → null (set yearly by formula, Iowa Code 441.21) |
| KS | residential 11.5% | |
| MD | 3-year cycle | cap null → 10% (homestead credit, Tax-Prop. 9-105); homestead "5% exemption" → none (the credit is the relief) |
| MA | full and fair cash value | |
| MI | 50%; cap lesser of 5% or inflation; uncaps on transfer | |
| MN | | ratio 1 → null (net tax capacity class rates 1% / 1.25%) |
| MO | residential 19%; odd-year (2-year) reassessment | |
| MT | revalued every 2 years | |
| NE | actual value | |
| NV | 35% | cap 3% → null: NRS 361.4723 caps the *tax bill* of owner-occupied homes (now `tax_bill_growth_cap`) |
| ND | 9% of 50% = 4.5% | |
| OH | ratio at most 35% | cycle 3 → 6 (R.C. 5713.01 "at least once in each six-year period"; triennial update not confirmed) |
| RI | update every 3 years (revaluation every 9) | |
| SC | 4% legal residence; reappraisal every fifth year | the 15% cap is per five-year reassessment, not annual (now `reassessment_increase_cap`) |
| SD | equalized to 85% (Dept. of Revenue) | |
| UT | 45% residential exemption | ratio 0.55 → 1: the record also carried the 45% exemption, so the calculator applied it twice |
| VA | 100% fair market value | |
| WV | 60% | |
| WY | 9.5% | |

Not reachable from the audit machine (left unverified): New York (nysenate.gov and Justia 403), Illinois (ilga.gov
certificate error), Pennsylvania, New Jersey, Tennessee, Oklahoma, Indiana, Kentucky, Louisiana, Alabama, Mississippi,
Arkansas, Connecticut, New Hampshire, Wisconsin, Hawaii, Alaska, Maine, DC, Vermont, Delaware, New Mexico (pages
rendered without text or returned 403/404). The Lincoln Institute's Significant Features database was reachable but
only through an interactive report builder, so it was not used.

Result: the residential ratio is confirmed for 21 states (was 5: AZ, CA, FL, TX, WA). **No state has all five calculator fields confirmed.**

### Calculator behavior now

- **Outside California:** the section shows only confirmed facts and "Not computed: <state> tax rules not verified
  yet (<fields>)". The engine itself returns `computed: false` with `missingFields` for any profile that isn't fully
  confirmed (`financeProfileGate`); a confirmed null assessment cap counts as "no cap".
- **California EIFD calculator** (runs on the Assessor roll and the Auditor's apportionment factors):
  - removed the 55%-of-market-value stand-in base and the 20% / 24% stand-in city/County shares; with no roll or no
    factors the inputs stay blank and the calculator says "Not computed";
  - removed the same 20% / 24% stand-in in the per-project funding plan (`fundPlan`), which now returns nothing;
  - removed the turnover buttons, which overwrote the growth input with an invented conversion
    (`2 + (rate − 2) × 0.65`), and the bond-yield buttons labeled "AAA Muni / Benchmark / High-Rate" (no source);
  - growth, interest rate, coverage and the 3% admin are labeled assumptions; the Artesia pledge defaults are labeled
    examples "not re-checked".

Tests: `tests/unit/financeProfiles.test.ts`, test 4 in `tests/unit/audit.test.ts`, and the browser test
"tax-increment section…" in `tests/e2e/site.spec.ts`.

## Round 3 (16 Nov 2026, later)

Script: `scripts/apply_finance_round3.py` (finance), `scripts/apply_records_round3.py` and
`scripts/apply_broken_links_round3.py` (funding, statutes). Every quote is in the record's `field_evidence` or
`verification.evidence`.

**State finance profiles: all five tax-increment fields now confirmed in TX, FL, AZ, WA, CA.**

| State | Field | Result | Source (quote) |
|---|---|---|---|
| TX | homestead_exemption_rule | **corrected $100,000 -> $140,000** (school district taxes) | Comptroller: "Tax Code Section 11.13(b) requires school districts to provide a $140,000 exemption" (the texas.public.law mirror still shows $100,000) |
| TX | reassessment_cycle_years | **corrected 1 -> 3** | Tax Code 25.18(b): "at least once every three years" |
| TX | uncaps_on_sale | confirmed | Tax Code 23.23(c): the limitation "expires on January 1 of the first tax year that neither the owner ... qualifies" |
| FL | uncaps_on_sale | confirmed | 193.155(3)(a): "assessed at just value as of January 1 of the year following a change of ownership" |
| FL | reassessment_cycle_years | confirmed (1) | 192.042: "Real property, on January 1 of each year" |
| AZ | uncaps_on_sale | confirmed (false) | 42-13302(A) lists the cases that reset limited value; a sale is not one; "A change in the occupant ... is not a change in use" |
| AZ | homestead_exemption_rule | confirmed (none) | 15-972: owner relief is "additional state aid for education", not a value exemption |
| WA | reassessment_cycle_years | confirmed (1) | RCW 84.41.030: "must be revalued annually" |
| WA | homestead_exemption_rule | confirmed (none) | DOR lists only targeted programs (veterans' widows, seniors/disabled, limited-income deferral) |
| CA | uncaps_on_sale, reassessment_cycle_years | confirmed | R&T 110.1 (base year at change in ownership); 401.3 and 2192 (annual lien date) |
| CO | reassessment_cycle_years | confirmed (2) | 39-1-104(10.2)(b): "During the two years of each reassessment cycle ..." |
| CO | res_assessment_ratio, homestead_exemption_rule | **not confirmed; homestead 'none' was wrong** | HB 24B-1001: from 2026, if the State Board of Equalization certifies statewide growth above 5%, local levies use 6.7% of actual value minus the lesser of 10% or $70,000; the certification was not fetched |

The page still computes no tax-increment dollar figure outside California: local millage rates and pledge shares
are not on file from a source. Known model limit (not fixed): the engine applies a homestead exemption once to an
area's total value, as if the area were one home.

**Funding programs.** CA Urban Greening corrected from its program page: funded by Proposition 4 (~$100M, two
cycles, $46,125,000 in round 1), not Cap-and-Trade; applications through RAPTR, not SOAR; next round late 2027 or
early 2028; grant share not stated (now null). CO URA TIF: C.R.S. 31-25-107 confirms property and/or municipal sales
taxes may be divided "for a period not to exceed twenty-five years"; the "100% of increment" share and listed
projects are not in the statute. FRA grant and AZ GPLET: dead program pages replaced with the statutes the records
were verified against. IL Transit TIF: source link broken, downgraded to unverified.

**Statutes.** Minneapolis 2040 downgraded to unverified: the city's housing page doesn't state the triplex or parking
rule, Minn. Stat. 473.858 has no 2024 amendment, and the cited Laws 2024 c. 115 has no comprehensive-plan language.
