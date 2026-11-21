# State finance profiles, round 4: field-by-field check (21 Nov 2026)

**Work queue item:** R5, first part (the 22 unchecked state tax profiles, then Illinois, then the partly verified ones).
**File:** `app/data/state_finance_profiles.json`.
**Evidence:** [`state-finance-profiles-2026-11-21.json`](state-finance-profiles-2026-11-21.json) holds, for every field
checked, the status, the source URL, the verbatim quote, the HTTP status and the time the page was fetched.
The same quote and URL are stored with the field in the profile (`field_evidence.<field>`, `checked_on: 2026-11-21`).
**Applied by:** [`state-finance-profiles-2026-11-21-apply.py`](state-finance-profiles-2026-11-21-apply.py), run against
the pre-round file (commit `a2e75a8`). Before it writes anything, it checks that every quote appears word for word in
the text of the page fetched in this session, and that the URL is the one fetched (or where it redirected). The fetched
pages themselves were kept in the session's scratch folder and are not committed.

## Rules followed

- A field is **confirmed** only if a page fetched today says it, in the quoted words.
- **Corrected** means the source says something else; the value was changed to what it says.
- **Set to unknown** (`corrected_to_unknown`) means the source shows the stored value is wrong, but no single value
  describes the state (for example, each town sets its own assessment ratio). The value is now `null`.
- **Withheld** (`not_confirmed` or `could_not_check`) means no fetched sentence settles it. The value is left as it was
  but listed in `verification.unverified_fields`, so the page and the tax-increment model treat it as not confirmed.
- "No cap" (`annual_assessment_cap: null`) was confirmed only where a source says values follow the market each year
  or are held until the next revaluation. `uncaps_on_sale` in a state with no cap is marked "moot" in its note; the model
  ignores it when the cap is null.
- A homestead exemption stored as "none" was confirmed only where the source limits relief to named groups (for
  example, owners 65 and older). Where relief is a tax credit (Arkansas, Mississippi, Wisconsin), the field is withheld:
  the model can only subtract an exemption from value.
- Secondary sources were used only where no official host answered, and are named: the texas.public.law mirror for
  Texas Tax Code section 23.23, and Cornell LII's copy of the Oklahoma Administrative Code.

## Result

| Status | Before (16 Nov) | After (21 Nov) |
|---|---|---|
| verified | 4 (AZ, CA, TX, WA) | 11 (AK, AL, AZ, CA, DC, KY, LA, NM, TX, WA, WY) |
| partially verified | 25 | 36 |
| could not check | 1 (IL) | 2 (NH, PR) |
| unverified | 22 | 3 (IN, NY, PA) |

FL moved the other way on one field: its homestead rule was withheld because Florida voters changed it on
3 Nov 2026 (see corrections). AZ, CA, TX and WA were already "verified" but had a quote on file for only some of their
tax-increment fields; the missing quotes were fetched today, so a new unit test can require one for every field
counted as confirmed (`tests/unit/financeProfiles.test.ts`, "round 4: every tax-increment field counted as confirmed
has a fetched quote and source URL on file").

### Per state

Fields checked include `comm_assessment_ratio` where a source covered it. "Withheld" counts fields left not confirmed,
could-not-check, or set to unknown.

**The 22 unverified profiles**

| State | Status | Fields checked | Confirmed | Corrected | Withheld | Source host used |
|---|---|---|---|---|---|---|
| AL | unverified -> verified | 6 | 5 | 1 | 0 | www.revenue.alabama.gov (Alabama Department of Revenue) |
| AK | unverified -> verified | 6 | 5 | 1 | 0 | www.akleg.gov (Alaska Statutes) |
| AR | unverified -> partially verified | 6 | 3 | 1 | 2 | www.dfa.arkansas.gov (Assessment Coordination Division) |
| CT | unverified -> partially verified | 6 | 5 | 0 | 1 | prdext3.cga.ct.gov (General Statutes ch. 203); www.cga.ct.gov did not answer |
| DE | unverified -> partially verified | 6 | 5 | 0 | 1 | delcode.delaware.gov (Title 9 ch. 83) |
| DC | unverified -> verified | 6 | 5 | 1 | 0 | code.dccouncil.gov and otr.cfo.dc.gov |
| HI | unverified -> partially verified | 5 | 2 | 0 | 3 | realproperty.honolulu.gov (Honolulu only); www.capitol.hawaii.gov returned 403 |
| IN | unverified -> unverified | 5 | 0 | 0 | 5 (1 set to unknown) | www.in.gov/dlgf and forms.in.gov |
| KY | unverified -> verified | 6 | 6 | 0 | 0 | revenue.ky.gov |
| LA | unverified -> verified | 6 | 6 | 0 | 0 | legis.la.gov (Constitution art. VII) |
| ME | unverified -> partially verified | 5 | 0 | 1 | 4 (1 set to unknown) | legislature.maine.gov (Title 36) |
| MS | unverified -> partially verified | 6 | 3 | 0 | 3 | www.dor.ms.gov |
| NH | unverified -> could not check | 5 | 0 | 0 | 5 | none: gc.nh.gov did not answer, www.revenue.nh.gov 403, web.archive.org did not answer |
| NJ | unverified -> partially verified | 6 | 0 | 2 | 4 (1 set to unknown) | nj.gov / www.nj.gov (Division of Taxation) |
| NM | unverified -> verified | 6 | 6 | 0 | 0 | www.nmlegis.gov (committee handout, 23 Sep 2024) and www.santafecountynm.gov (Assessor) |
| NY | unverified -> unverified | 6 | 0 | 0 | 6 (2 set to unknown) | www.tax.ny.gov; www.nysenate.gov returned 403 |
| OK | unverified -> partially verified | 5 | 3 | 1 | 1 | www.law.cornell.edu (OAC copy, secondary) and www.oklegislature.gov; oscn.net showed a human-verification page |
| PA | unverified -> unverified | 6 | 0 | 0 | 6 (2 set to unknown) | www.palegis.us (53 Pa.C.S.) |
| TN | unverified -> partially verified | 6 | 3 | 0 | 3 | comptroller.tn.gov |
| VT | unverified -> partially verified | 6 | 2 | 1 | 3 | legislature.vermont.gov and tax.vermont.gov |
| WI | unverified -> partially verified | 6 | 2 | 1 | 3 | www.revenue.wi.gov (PB-060, 2026); docs.legis.wisconsin.gov did not answer |
| PR | unverified -> could not check | 5 | 0 | 0 | 5 | none: portal.crimpr.net has no rule text, bvirtualogp.pr.gov did not answer, law.justia.com 403 |
| **Total** | | **126** | **61** | **10** | **55 (7 set to unknown)** | |

**The could-not-check profile**

| State | Status | Fields checked | Confirmed | Corrected | Withheld | Source host used |
|---|---|---|---|---|---|---|
| IL | could not check -> partially verified | 6 | 2 | 2 | 2 | tax.illinois.gov (PIO-16 and the Property Tax Relief page); www.ilga.gov still did not answer |

**Verified profiles: quotes backfilled**

| State | Fields checked | Confirmed | Source host used |
|---|---|---|---|
| AZ | 3 | 3 | www.azleg.gov |
| CA | 3 | 3 | www.boe.ca.gov / boe.ca.gov (leginfo returns 403) |
| TX | 2 | 2 | comptroller.texas.gov and texas.public.law (secondary; statutes.capitol.texas.gov returned only its menu) |
| WA | 3 | 3 | app.leg.wa.gov |

**Partly verified profiles (as far as time allowed)**

| State | Status | Fields checked | Confirmed | Corrected | Withheld | Source host used |
|---|---|---|---|---|---|---|
| FL | partially verified -> partially verified | 3 | 2 | 0 | 1 (set to unknown) | www.leg.state.fl.us and floridarevenue.com |
| NC | partially verified -> partially verified | 5 | 5 | 0 | 0 | www.ncleg.gov |
| OR | partially verified -> partially verified | 3 | 2 | 0 | 1 | www.oregonlegislature.gov (official text) |
| CO | partially verified -> partially verified | 1 | 0 | 0 | 1 | none read: the null cap had no quote, so it is now listed as not confirmed |
| GA | partially verified -> partially verified | 2 | 0 | 1 | 1 | dor.georgia.gov |
| SC | partially verified -> partially verified | 1 | 0 | 1 | 0 | www.scstatehouse.gov |
| OH | partially verified -> partially verified | 1 | 0 | 0 | 1 (set to unknown) | codes.ohio.gov |
| VA | partially verified -> partially verified | 1 | 0 | 1 | 0 | law.lis.virginia.gov |
| MD | partially verified -> partially verified | 1 | 1 | 0 | 0 | mgaleg.maryland.gov |
| MI | partially verified -> partially verified | 1 | 1 | 0 | 0 | www.legislature.mi.gov |
| RI | partially verified -> partially verified | 3 | 2 | 0 | 1 (set to unknown) | webserver.rilegislature.gov |
| MA | partially verified -> partially verified | 1 | 0 | 1 | 0 | malegislature.gov; www.mass.gov returned 403 |
| KS | partially verified -> partially verified | 1 | 1 | 0 | 0 | www.ksrevisor.gov |
| NE | partially verified -> partially verified | 1 | 1 | 0 | 0 | nebraskalegislature.gov |
| NV | partially verified -> partially verified | 1 | 1 | 0 | 0 | www.leg.state.nv.us |
| IA | partially verified -> partially verified | 2 | 1 | 0 | 1 | www.legis.iowa.gov |
| WY | partially verified -> verified | 4 | 2 | 2 | 0 | wyoleg.gov (Title 39 as compiled on the Legislature's site) |

Not reached this round: ID, MN, MO, MT, ND, SD, UT, WV (their open fields are unchanged and still listed as not
confirmed). code.wvlegislature.gov did not answer when tried; le.utah.gov returned only its menu for the section tried.

Overall: 44 profiles touched, 175 fields checked: 93 confirmed, 18 corrected, 64 withheld (10 of them set to unknown).

## Corrections (old -> new, source)

All are also logged in `docs/DATA-AUDIT-AND-TRANSPARENCY.md` (21 Nov 2026 entry).

| State | Field | Old | New | Source and quote |
|---|---|---|---|---|
| AL | annual_assessment_cap | null (no cap) | 0.07 | ALDOR, HB73 / Act 2024-344: "New rules will cap annual increases in taxable assessed value for Class II and Class III real properties at 7 percent." |
| AK | homestead_exemption_rule | $50,000 of market value | none | AS 29.45.050(a): a municipal exemption "may not exceed the assessed value of $75,000 for any one residence"; it is local and voter-approved. $50,000 appears nowhere. |
| AR | reassessment_cycle_years | 3 | 4 | ACD 2025 annual report: "With the passage of Act 139 of 2023, all counties will now reappraise real property on four-year cycles." |
| DC | homestead_exemption_rule | $87,500 | $95,100 (tax year 2027) | OTR: "This deduction reduces your real property's assessed value by $95,100.00 for tax year 2027" |
| FL | homestead_exemption_rule | $50,000 | unknown | DOR bulletin PTO 26-21 (5 Nov 2026): Amendment 3, approved 3 Nov 2026, "exempting assessed value up to $150,000 in 2027 and up to $250,000 in 2028" for non-school taxes |
| GA | homestead_exemption_rule | $10,000 of assessed value | $2,000 of assessed value | Georgia DOR: "The $2,000 is deducted from the 40% assessed value of the homestead." ($10,000 is the cap on an income-limited 65+ exemption.) |
| IL | reassessment_cycle_years | 3 | 4 | IDOR PIO-16: "Every four years when all property is reassessed (three years in Cook County)" |
| IL | homestead_exemption_rule | $10,000 | $6,000 | IDOR: "up to a maximum of $10,000 in Cook County, $8,000 in counties contiguous to Cook County, and $6,000 in all other counties" (the profile's 33 1/3% ratio is the non-Cook one) |
| IN | homestead_exemption_rule | "circuit breaker" 1% | unknown | DLGF form: standard deduction "in 2026, $40,000; in 2027, $30,000 ... 2030 ... $0" plus a supplemental percentage; the 1% circuit breaker caps the bill, not the value |
| MA | reassessment_cycle_years | 3 | 1 | G.L. c. 59, s. 2A: "shall determine the fair cash valuation ... on the first day of January of each year" |
| ME | res_assessment_ratio | 1 | unknown | 36 M.R.S. s. 327: "a 70% minimum assessment ratio ... should not have an assessment ratio at an amount greater than 110%" (each town's own ratio) |
| ME | homestead_exemption_rule | $25,000 of assessed value | $25,000 of just (market) value | 36 M.R.S. s. 683: "the just value of $10,000" plus "$15,000 of the just value of the homestead" |
| NJ | res_ and comm_assessment_ratio | 0.85 | 1 | Division of Taxation: "All 21 counties in New Jersey have chosen 100%." |
| NJ | reassessment_cycle_years | 3 | unknown | Revaluation brochure: "Revaluation is needed when properties in a municipality are not being assessed at the same rate of value ..." (no fixed cycle) |
| NY | res_ and comm_assessment_ratio | 1 | unknown | ORPTS: the law "doesn't require assessments to be at 100 percent of market value" |
| OH | homestead_exemption_rule | $25,000 of assessed value | unknown | R.C. 323.152: "Twenty-five thousand dollars of the true value", for owners 65+, disabled, or a qualifying surviving spouse only |
| OK | uncaps_on_sale | false | true | OAC 710:10-1-3: the limits "do not apply in any year when the title of the property is transferred" |
| PA | res_ and comm_assessment_ratio | 1 | unknown | 53 Pa.C.S. s. 8842(a): a county "predetermined ratio which may not exceed 100% of actual value" |
| RI | res_assessment_ratio | 1 | unknown | R.I.G.L. 44-5-12: "or at a uniform percentage thereof, not to exceed one hundred percent (100%)" |
| SC | uncaps_on_sale | false | true | S.C. Code 12-37-3140(A)(1)(b): value is set as of "December thirty-first of the year in which an assessable transfer of interest has occurred" |
| VA | reassessment_cycle_years | 1 | 4 | Va. Code 58.1-3252: "a general reassessment of real estate every four years" (counties; 3, 5 or 6 by option) |
| VT | reassessment_cycle_years | 3 | 6 | Department of Taxes: "Vermont towns are required to reappraise every six years as of January 2025" |
| WY | annual_assessment_cap | null (no cap) | 0.04 | W.S. 39-11-105(a)(xliii): exempts assessed value of a single-family home "in excess of the prior year assessed value ... plus four percent (4%)" |
| WY | homestead_exemption_rule | none | 25% of market value (first $1,000,000) | W.S. 39-11-105(a)(xlvi): "twenty-five percent (25%) of the fair market value of a single family residential structure and the associated improved land" |
| WI | reassessment_cycle_years | 1 | 5 | DOR PB-060: "within 10% of full value in the same year, at least once within a five-year period" |

Other record changes: LA's `source_url` pointed at Constitution art. VII s. 11 (Budgets) and now points at s. 18; CT, DE,
DC, IL, MS, NJ, OK, PA and TN have a new `source_url` or `statutory_citation` matching what was read; OR's homestead
rule and CO's null cap had been counted as confirmed without any quote on file and are now listed as not confirmed.

## What could not be fetched, and why

- **New Hampshire:** www.gencourt.state.nh.us redirects to gc.nh.gov, which did not answer from this machine;
  www.revenue.nh.gov returned 403; web.archive.org did not answer (it did not answer for any state today). A
  summarizing web fetch of RSA 75:8-a worked but returns no verbatim text that can be checked, so it was not used.
- **Puerto Rico:** the CRIM portal answered but has no rule text on its home page; the official law library
  (bvirtualogp.pr.gov) did not answer; Justia returns 403.
- **Hawaii:** www.capitol.hawaii.gov (HRS) returned 403; the Honolulu appeals brochure that states its 100% rule
  returned 404.
- **Oklahoma:** the Constitution (art. X ss. 8, 8B) on oscn.net is behind a human-verification page (not bypassed);
  oksenate.gov returned 404. The ratio is withheld.
- **New York:** www.nysenate.gov (RPTL s. 1805, the record's citation) returned 403.
- **Illinois:** www.ilga.gov did not answer; the Department of Revenue's own publications were used instead.
- **Connecticut:** www.cga.ct.gov did not answer; the same statutes were read on the General Assembly's other host,
  prdext3.cga.ct.gov.
- **Wisconsin:** docs.legis.wisconsin.gov did not answer; the Department of Revenue's guide was used.
- **Massachusetts:** www.mass.gov returned 403 (the General Laws on malegislature.gov were read).
- **Florida:** floridarevenue.com returned 401 for its inflation-adjusted homestead table, so the 2026 indexed amount
  was not read.

## Seen on the real page

`LIVE_PORT=9324 node <scratch>/live_finance.cjs . 01073 11001 34013 17031` (a short Playwright script: it serves this
worktree, answers the page's county-file requests to R2 from the local `counties/` folder so no request reaches R2,
opens each county and reads the tax-increment section and the methods-panel financing text). Saved in
`data/backtests/live_check_finance_profiles_2026-11-21.json`; no page errors.

- Jefferson AL (01073): "Annual assessment cap: 7%. Residential assessment ratio: 10.0%. ... (Verified) Not computed:
  ... state rules are confirmed, but local tax rates and pledge shares are not on file from a source."
- District of Columbia (11001): "Annual assessment cap: 10%. Residential assessment ratio: 100.0%. ... (Verified)".
- Essex NJ (34013): "Residential assessment ratio: 100.0%. ... (Partly verified) Not computed: ... tax rules not verified
  yet (annual assessment cap, uncaps on sale, reassessment cycle years, homestead exemption rule)."
- Cook IL (17031): the first run showed "Residential assessment ratio: 33.3%" for Cook County with no caveat, because
  IL's (non-Cook) ratio was now confirmed. Profiles can now carry a `scope_note`, which the tax-increment section and
  the methods panel print; IL's says the figures are for counties outside Cook and gives Cook's 10% ratio, three-year
  cycle and $10,000 exemption from the same IDOR pages. The rerun shows the note. HI has one too (Honolulu only).

Found, not changed: for AL and DC the tax-increment section reads "Not computed: this state's state rules are
confirmed" where a state name was expected (NJ also reads "this state tax rules"; IL shows "Illinois"). The wording
comes from existing code (`activeStateName()`); not investigated here.

## The advisor

The Cloudflare Worker advisor (`workers/`) does not read `state_finance_profiles.json` (searched for the file name,
`STATE_FINANCE_PROFILES`, `assessment_ratio` and `financeProfile`). On the page, the profile is used only by the
tax-increment section (`eifdSection`) and the methods panel (`methodsFinancingHtml`), which show only fields not listed
in `unverified_fields`, label the record with its status, and compute nothing outside California.
