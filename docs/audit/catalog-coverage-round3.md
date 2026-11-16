# Improvement catalog, round 3: evidence for the most-asked improvements (16 Nov 2026)

Goal: find real, fetched evidence for the ten improvements people ask about most, and use it only where it matches
what the engine computes. Every quote below was read from a fetched source in this session. OpenAlex search and
Semantic Scholar search were rate-limited from the audit machine, so studies were found with Crossref bibliographic
search and their text read from Crossref abstracts, OpenAlex single-work records, or open full-text copies.

## How an override works

Where a fetched study supports a different effect than a bundle row was built with, the record in
`app/data/intervention_verification.json` gets a `sourced_effect` (`pct`, `replaces_pct`, `basis`, `citations` with
the exact quote and URL). The page rescales that row's value with the engine's own formula: value is linear in the
effect (`homes x price x pct/100 x discount x scale`, `pipeline/engine.py` `add()`), so `value x new/old`, and
`$ per $1 = value / total cost` as before (`ivRow()` in `app/app.js`, applied in `recsOf()` and `ivCompactRows()`,
the two paths every panel, total, export and map tag goes through). The card shows a "Sourced effect" line with the
citation. `pipeline/engine.py` uses the same numbers so a rebuild matches.

## Results by target

| Target | What was found (exact quote) | Engine used | Decision |
|---|---|---|---|
| Street trees (new plantings) | Wachter & Wong 2008, *Real Estate Economics*, doi:10.1111/j.1540-6229.2008.00212.x: "A 7 to 11% price differential is identified within 4,000 feet of the Fairmount tree plantings." and "Any positive changes brought by the PHS tree plantings were not detected with sufficient statistical power." | +0.24% per home per tree within 50 m (unreproducible local regression) | **Stays unverified.** Correlational, not a per-tree effect, and the community block-planting program (the kind City Pretty would recommend) showed no detectable effect. |
| Protected bike lanes | Conrow, Mooney & Wentz 2020 (*Urban Studies*, doi:10.1177/0042098020926034) and Connolly, Livy, Qiu & Klaiber 2019 (*Landscape and Urban Planning*, doi:10.1016/j.landurbplan.2018.09.010) report associations with no usable effect size in the abstract | no value effect (quality-of-life item) | No change. |
| Park renovation | Livy & Klaiber 2016, *Land Economics*, doi:10.3368/le.92.1.96 exists; its abstract gives no number and the paper is closed (Unpaywall: no open copy) | +0.5% within ~400 m ("assumed") | **Stays unverified.** |
| Sidewalks | no property-value study with a number found | no value effect | No change; LA Controller audit cost not re-fetched (site search is script-driven). |
| **Street lighting** | (1) Chalfin, Hansen, Lerner & Parker 2019, NBER w25798 (full text fetched): "Accounting conservatively for potential spillovers, lighting reduces outdoor nighttime index crimes by approximately 36 percent and reduces overall index crimes by approximately 4 percent in affected communities" and "On NYC's public housing campuses, approximately 11 percent of index crimes occur outdoors and during nighttime hours." (2) Pope & Pope 2012, *Regional Science and Urban Economics*, doi:10.1016/j.regsciurbeco.2011.08.008 (open copy fetched): "The estimated elasticities of property values with respect to crime range from -0.15 to -0.35." | **+1.358%** = 36% x an assumed 32.5% nighttime-outdoor share x an unverified 0.116 coefficient | **Unverified -> partially verified, with override +0.6%** (4% x 0.15, the low end). The bundle overstated the effect about 2.3x: the paper puts the nighttime-outdoor share at ~11%, not 32.5%. Cost not re-fetched. |
| **ADUs** | Brueckner & Thomaz 2024, *Real Estate Economics*, doi:10.1111/1540-6229.12471 (Crossref abstract): "The assessed-value regressions show that ADU presence raises a parcel's assessed value and selling price by 7%-9%" | +9.2% (above the study's range) | **Unverified -> partially verified, with override +7%** (low end). **Correction:** the 16 Nov catalog audit said this study was not found in Crossref; it is there, and that finding was wrong. Cost not re-checked. |
| **Vacant-lot greening** | Lin, Jensen & Wachter 2021, SSRN 3899624, doi:10.2139/ssrn.3899624 (Crossref abstract): "we find that prices for houses within 1,000 feet of a greened vacant lot rise by about 4%" | +4.3% | **Stays partially verified, override +4.0%** (the bundle's 4.3% came from a later version not re-fetched). Cost not re-fetched. |
| Bus lanes | no study isolating bus-only lanes found | +0.5% scaled from BRT | Stays unverified. |
| Undergrounding cost | CPUC still unreachable from the audit machine | $3.44M per mile | Cost stays unchecked. |
| Affordable housing cost | LAHD's site is now reachable, but the cited March 2026 cost report was not located | $782,000 per unit | Cost stays unchecked. |

Also corrected while adding studies: two author names written from memory were wrong (the ADU paper's second author
is Sarah Thomaz; the vacant-lot paper's second author is Shane Jensen). All author lists in the new research records
were then copied from Crossref. The Chalfin paper was already in `research.json` (`safe_002`, partly verified); its
effect is now confirmed from the full text and it is marked verified.

## Coverage (share of block groups with a sourced best bet of at least $1 per $1)

Computed with `scripts/catalog_coverage.py` (mirrors the page's `ivAllows` + `ivRow`), on the round-2
file ("before") and this round's file ("after"):

| Area | Before | After | Best bet has both effect and cost sourced |
|---|---|---|---|
| LA County (6,587 block groups) | 59.4% | **61.7%** | 45.7% (unchanged) |
| All non-LA county bundles (175,478) | 16.9% | 16.9% | 15.2% |
| Travis County, TX (766) | 1.0% | 1.0% | 0.1% |

Street lighting is now the best sourced bet in 153 LA block groups. Outside LA nothing changed: street lighting
needs crime data the national bundles mostly lack, and the ADU is an owner-level item that is not ranked on the map.
(Round 2 reported 17.5% for non-LA on a slightly different block-group set; both columns here use the same set.)

## Still open

- Costs for street lighting, ADUs, vacant-lot greening, undergrounding and affordable housing (agency sites block or
  hide documents from the audit machine).
- Street-tree and park-renovation effects: no study found that measures what the engine computes.
- The crime-to-value link for foot patrols, violence interruption and BIDs could use Pope & Pope's elasticity, but
  their own crime effects were not re-checked this round, so they stay unverified.
