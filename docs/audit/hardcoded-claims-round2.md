# Hand-written claims on the page, round 2 (16 Nov 2026)

Follows `appjs-constants-audit.md` / `appjs-fixes.md` (round 1) and the panel live check (`live-panels-check.md`),
which found hardcoded housing-rights claims outside California. Provenance tests cover the data files; they don't
cover text written into `app/app.js` and `index.html`. This pass covered that text: the financing summaries, the
tree-canopy targets and tree economics, funding-program lists, ADU fees and grants, and the California house checks.
Rule: a claim stays only if it was checked against a fetched primary source (URL and quote below). Otherwise it is
removed, or it is marked "not re-checked" where it describes an editable assumption.

## Wrong or invented, now fixed

| Where | What the page said | What the source says / outcome |
|---|---|---|
| Canopy box (`patchCanopyCardDom`), every state | "+$5,400" (cold states), "+$8,200" (AZ/NV/NM/UT), "+$6,200" (others) home value and "$95 / $220 / $115 / $140 a year" in energy savings, all credited to "USDA Forest Service" | **Invented.** Neither study has them. Replaced in every state by the two checked findings below |
| Canopy box (`index.html`) | "+$7,130 home value in Portland" and "$65–$140/yr in AC cooling savings in Southern California" | Donovan & Butry 2010 ([Treesearch 36186](https://research.fs.usda.gov/download/treesearch/36186.pdf)): *"Let us consider a tree with a canopy cover of 312 ft2 (29m2) (the average for our sample). This tree adds $7130 to the price of the house it fronts."* (the study's average for all street trees is $8,870). McPherson & Simpson 2003 ([Treesearch 48730](https://research.fs.usda.gov/download/treesearch/48730.pdf)): *"The present wholesale value of annual cooling reductions for the 15-year period is $ 3.6 billion ($ 71/tree planted)."* **$65–$140/yr is not in the paper.** Text now states both findings as written, with links. `research.json` tree_001 / tree_008: impact and geography filled in with these quotes |
| Canopy box, comparison drawer, map metric | Ecoregion codes ("EPA IV: 85g / CEC Zone 9", "EPA III: 83 ...", "EPA Conterminous US Base"), summer baselines and **canopy targets by state (15–42%)**; heat labelled "vs. EPA Level IV ecoregion median"; with nothing selected, "+1.8°F vs Eco-Norm" and "16% to Regional Goal" | **No source** for the codes, baselines or targets, and the heat figure is not an ecoregion comparison. The county files' source list gives it as Tree Equity Score 2021 *"heat (block-group temperature vs its urbanized area)"* (treeequityscore.org/methodology: *"TEMPdiff = TEMPbg,ave - TEMPua,ave"*). Now: the gap is shown against **the block group's own Tree Equity goal** (`tc_goal`, current release, already in `app/data/tree_equity_2025/`); no goal figure where only the 2021 release is on file; heat is labelled "vs. its urban area's average (Tree Equity Score 2021)"; nothing is shown with no selection. The table and `getEcoregionNorm` are deleted |
| Canopy box (bug) | The box read the map feature's 2021 values while the panel showed the current Tree Equity release | Now reads the block group's details record |
| Comparison drawer | "Renter Displacement: Low Risk / Elevated" from a 45%-owners cut-off | Judgment label with no source; now the renter share only |
| Methods panel, financing, per state (TX, FL, WA, IL, others) | Hand-written prose: "1.30× / 1.35× debt-service coverage", "25-to-30-year bonds", SB 2 3.5% caps, PID overlays, "95% of increment", "3% Save Our Homes", "23-year" IL TIF, "25 years" WA, and a claim that TIF bonds are *modeled* there | The page computes no bond figure outside California, so "models incorporate ..." was false. Replaced by the state's `state_finance_profiles.json` record (vehicle, citation, status, link) and the `funding_programs.json` records for the state, each with its status and unconfirmed fields |
| Methods panel, LA | "interactive turnover presets from 2.0% to 4.5%", "30-year bond yields 4.25% AAA to 6.25% unrated", "about 47%" school/ERAF share, "certified Artesia IFP" | **The calculator has no presets or yield range** (one editable rate, 5.25%; turnover fixed at 3.5%). Now built from the LA data file's Auditor-Controller metadata (13,392 tax-rate areas, 99.99% matched, FY 2026-27 AF49) and `FUND_ASSUME`, each assumption labelled as one; Artesia pledges marked "not re-checked"; 47% removed |
| Methods panel, stormwater, every state but LA | TWDB Flood Infrastructure Fund, Resilient Florida, Ecology SFAP, "FEMA BRIC grants", CWSRF ... | Unchecked program names; now "No checked stormwater funding record is on file for this county" |
| Measure W text (methods panel and the funding line on project cards) | 50 / 40 / 10, 110-point scoring, 60 to qualify, 110% to disadvantaged communities | **Confirmed**, with a caveat, from Public Works' 17 July 2018 Board letter with the proposed ordinance ([file.lacounty.gov 124293.pdf](https://file.lacounty.gov/SDSInter/bos/supdocs/124293.pdf)): *"Ten percent (10%) shall be allocated to the District"*, *"Forty percent (40%) shall be allocated to Municipalities ... in the same proportion as the amount of revenues collected"*, *"Fifty percent (50%) ... Regional Program"*, *"not less than one hundred ten percent (110%) of the ratio of the DAC population"*, *"The initial Threshold Score is sixty (60) points"*, *"Total Points All Sections 110"*. Text says "as proposed for the November 2018 ballot; later amendments not checked" and links the letter. `funding_programs.json` la_measure_w: could_not_check → partially_verified, with `field_evidence` |
| Park and geography sections | Nine "Non-Private Funding" lines naming programs (IRA urban forestry grants, FEMA BRIC, EPA EJ Thriving Communities, CDBG-NDR, "Civic Arts Trust", USACE "Storm Risk Grants", Quimby Act shown outside CA, ...) | None checked for current status or eligibility; removed, with a note saying so |
| ADU cost schedule, fees | WA: "HB 1337 prohibits ... impact fees" → $0; FL: "Live Local Act abatement" $3,500 + $8/sq ft; TX: "Austin HOME infill schedule" for the whole state; elsewhere $2.50/sq ft school fee + $5,000 + $12/sq ft; CA over 750 sq ft: $8,000 + $18/sq ft | **Invented attributions and amounts.** Only California is kept: Gov. Code § 66311.5(c)(1) (california.public.law copy of the current text): *"shall not impose any impact fee upon the development of an accessory dwelling unit that has 750 square feet of interior livable space or less ... Any impact fees charged for an accessory dwelling unit that has more than 750 square feet ... shall be charged proportionately in relation to the square footage of the primary dwelling unit"*; § 66311.5(c)(3) with Educ. Code § 17620(a)(1)(C) for the 500 sq ft school-fee threshold; the SAB 2026 maximum Level I rate, DGS/OPSC 28 Jan 2026 index adjustment ([PDF](https://www.dgs.ca.gov/-/media/Divisions/OPSC/Resources/CCI-Adjustments/01282026_Index-Adjustment-on-Development_Approved_FINAL.pdf)): *"Residential $4.79 $5.17 $5.38"*. The over-750 fee amount is local, so it is shown as "–" (not in the total). Other states: "fee rules not on file". The ADU fee tiles no longer say "$0 (exempt)" where fees are unknown. (The ADU row itself is unverified, so this card is not shown at present) |
| Upgrade table, seismic row | Subtracted a $3,000 Brace + Bolt grant from the cost, as if awarded | The amount is confirmed (crmp.org: *"EBB provides up to $3,000 toward a code-compliant seismic retrofit to a qualifying house"*), but eligibility is by ZIP code and registration round. Not subtracted any more |
| House checks, "Add a bathroom" (every state) | "an addition recoups only about 58% of its cost at resale (JLC/Zonda Cost vs Value 2025: $63,595 cost, $36,603 value)" | The source returns 403 (paywalled; `upgrade_verification.json` could_not_check), and it was an LA figure shown nationwide. Removed |
| House checks, SB 9 (CA) | "SB 9 allows a split ... and up to 4 total units" as a **yes**; "SB 9 does not apply in designated historic districts"; a fire-zone exclusion cited to § 65913.4(a)(6)(D) | Gov. Code § 66411.7 (current text): lots of roughly equal area, *"one parcel shall not be smaller than 40 percent"*, *"no smaller than 1,200 square feet"*. A city *"shall not be required to permit more than two units on a parcel"* (j). Bars landmarks, and bars demolition or alteration of contributing structures in historic districts (a)(3)(E)–(F), not every lot in a district. Conditions the page can't see: tenant in the last three years, rent control, covenants, and the § 65913.4(a)(6)(B)–(K) site list "as that section read on September 16, 2021". Now **maybe**, with those conditions named. The hazard-zone case defers to the site list instead of citing an unchecked paragraph |
| House checks, ADU (CA) | "easily fits ... with the 4-ft rear/side setbacks state law allows"; JADU rule credited to "AB 1154 since 1 Jan 2026" | § 66314(d)(7): *"a setback of no more than four feet from the side and rear lot lines shall be required"*, kept as a ceiling a city may impose. § 66333(b): owner-occupancy only *"If the junior accessory dwelling unit has shared sanitation facilities"*; (g) rentals *"longer than 30 days"*; § 66313(d) 500 sq ft. Kept; the bill and date attribution (not checked) removed |
| House facts, selling an ADU separately (CA) | "Not allowed here ... unless the city opts in to AB 1033" for every CA city but Santa Monica | § 66314(d)(1) bars a separate sale *"Except as provided in Article 4"*; § 66341 (qualified nonprofit) and § 66342 (local condominium ordinance) are the exceptions. Which cities have opted in is not on file, so now: "only if the city has adopted an ordinance ... whether this city has is not on file". Santa Monica confirmed from the city's Nov 2025 ADU guide: *"Permitted to be sold separately from the SUD following the standards of SMMC Section 9.31.026"* |
| EIFD text (neighborhood panel) | "No vote is needed to form one; since AB 116 (2019) bonds need 3 hearings and fail only on a 50% protest"; "State law has no housing set-aside"; "Since AB 116 (2019) EIFD bonds need no public vote" | Gov. Code § 53398.66: the plan is considered *"at two public hearings"*. Over 50% protest ends it; *"An election shall be called if between 25 percent and 50 percent ... file a protest"*. Under 25%, adopted subject to referendum. § 53398.77: bonds issued *"by majority vote"* of the authority. § 53398.51(a): affected taxing entity *"not including any county office of education, school district, or community college district"*. The housing set-aside claim (unchecked) is removed. The LA and OC County policy sentences and the Artesia pledge examples are marked "not re-checked" |

## Checked and kept unchanged

- Earthquake Brace + Bolt "up to $3,000; only in eligible ZIP codes" in the house check (crmp.org, above; the FAQ
  says ZIP codes are chosen by the CRMP Governing Board).
- AB 2097 parking text (`statutes.json` ca_ab2097, verified).
- FEMA Zone X "0.2% annual chance" (FEMA's zone definition; not re-fetched).
- Federal § 25D ended after 31 Dec 2025 (round 1, engines track).

## Found, not changed (outside this pass or not displayed)

- `STATE_SOLAR_CREDITS` (NY / MA / AZ / SC) and the solar ROI function: unsourced, but `calculateSolarMicrogridRoi` is
  never called by the page (`_calcSolar` is defined, never used). Not displayed.
- Valuation assessment ratios (`ratioStates`): OH 35%, GA 40%, NV 35% and MI SEV 50% match `field_evidence` marked
  confirmed in `state_finance_profiles.json`. TN 25% is unverified, and Cook's 10% isn't in the profile, which stores
  the statewide 33.33%. They run only in counties without a passing back-test, where the estimate is withheld.
- The zone explanations (e.g. "R1: one house per 5,000+ sq ft lot") are hand-written plain-language summaries,
  unchecked against each city's code.
- The OC County policy warning in the EIFD calculator ("caps its contribution at 50% ... no longer than 20 years"),
  and LA County Policy 3.106: not re-fetched.
- The pool premiums ("Redfin 2019") and other upgrade notes with figures are already hidden for unsourced rows
  (`upSourced`).
- `src/patches/nov08DeltaPatch.{js,ts}`: unreferenced copies of the old canopy text and labels. Deleted so they
  can't be wired back in.

## Tests

`tests/e2e/site.spec.ts`, four new browser tests through the page's own paths:
1. `select` in Travis TX: the canopy box shows `<gap> pts below its <goal>% goal`, equal to the Tree Equity file. No
   EPA, CEC or ecoregion text in the box or the comparison drawer, and the static box has the two checked findings.
2. Methods panel in LA and in Travis: built from the records (13,392 TRAs; TX TIRZ profile and funding record), with
   none of the removed prose.
3. `houseAt` on a real R1-1 lot from the page's LA zoning layer (parcel response mocked): SB 9 text from § 66411.7,
   with no "up to 4 total units", no 58% claim and no AB 1154 attribution. The ADU fee function cites § 66311.5(c)
   and uses $5.38/sq ft.
4. `select` in LA: no "Non-Private Funding" lines; the EIFD protest rule is stated as § 53398.66 says.

Live check: `scripts/live_check_panels.mjs` now also checks the canopy box against the Tree Equity file
(`canopy_hud`). Run on 16 Nov for Travis TX and LA, 2 real parcels each, through `houseAt` and `select`
(`LIVE_PORT=8941 LIVE_N=2 LIVE_SHARD=hardcoded`, output `data/backtests/live_check_panels_2026-11-16_hardcoded.json`).
4/4 parcels passed every check (neighborhood, canopy, canopy box, crash, laws, Census area, HUD, FEMA, USGS).

## My own mistakes in this pass

- My first live run used port 8824, where another checkout's server (older code) was answering. It reported the old
  "20% to 32% Goal / Eco-Norm" box, then lost the connection when that server stopped. The script now refuses a port
  that already answers. The re-run on a free port is the result above.

- The first draft of the Measure W `field_evidence` had a paraphrase in the `quote` field; I replaced it with the
  ordinance's exact sentence before committing.
- My first ADU fee change set the impact fee to 0 for every case, which would have made the fee tile say
  "$0 (exempt)" where fees are unknown. I caught it before testing and added the "Set locally" / "Not on file" states.
- My first canopy-box change read the map feature, which carries the 2021 values. It now reads the details record.
