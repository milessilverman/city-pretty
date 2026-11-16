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
