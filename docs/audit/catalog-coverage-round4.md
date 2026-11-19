# Improvement catalog, round 4 (16 Nov 2026)

Same standard as round 3: an effect or cost changes only on text fetched this round, quoted below. Applied by
`scripts/apply_catalog_round4.py`. Candidates were the ten unverified or partly verified items most often the best
project or in the top 3 nationwide (ungated ranking over LA's rows and all 637 county files).

## Results per improvement

| Improvement | Engine assumed | Found | Status change |
|---|---|---|---|
| EV fast-charging hub | +1.0% (a "deep discount" of a study the round-1 audit said it could not find); $800,000 per 8-port site | **Effect:** Liang, Qiu, Liu, He & Mauzerall (2023), *Nature Sustainability*, doi:10.1038/s41893-022-01058-5, abstract on nature.com: "The average price premium for houses with EVCSs within 1 km is about 3.3% (or US$17,212) compared with homes without proximate EVCSs." **Cost:** CTC baseline agreement, SBCAG / City of Santa Barbara ZEV Charging Infrastructure project report (Nov 2025), p. 171: "Eight DC Fast Chargers (DCFC) will be installed at this location. ... Total Project Cost $1,777,000 Outputs 8 DC charging ports" (funding table p. 174: $1,777 thousand) | unverified → **partly verified** (effect and cost both from sources; the effect is a hedonic association and the cost is one planned project). Override: +3.3% and $1,777,000 capex. **California only.** |
| School modernization (bond) | +3.0% on every home (catalog text said +6%) | Cellini, Ferreira & Rothstein (2010), *QJE*, doi:10.1162/qjec.2010.125.1.215, abstract: "implying a willingness to pay on the part of marginal homebuyers of $1.50 or more for each $1 of capital spending" | unverified → **partly verified** (effect checked; the area's spending share is not). Override: value = $1.50 per $1 of cost (new `value_per_dollar` override). **California only** (the study's sample). |
| Rehab blighted homes | +2.3% for neighbors | Ganduri & Maturana (2024), *Journal of Urban Economics*, doi:10.1016/j.jue.2024.103694 (SSRN 3794796), abstract via Semantic Scholar: "We find that house prices around a rehabilitated property increase between 2.3 and 4.0 percentage points following the rehabilitation." | unverified → **partly verified** (magnitude = the study's low end; distance band of "around" not checked; cost $110,000 per rehab not checked) |
| Weekly farmers market | +0.25% within 400 m | Collins (2020), *Applied Geography*, doi:10.1016/j.apgeog.2020.102272: an "inverse association between housing prices and distance to the closest farmers' market" (Central Maryland); no effect size in the abstract, full text unreachable | stays unverified |
| Community garden | +1.5% (poor areas) / +0.5% | Voicu & Been (2008), *Real Estate Economics*: "significant positive effects, especially in the poorest neighborhoods"; no number in the abstract; paper copies (SSRN, NELLCO) unreachable | stays unverified |
| Corner stores, slow streets, wayfinding, night markets | +1.9%, +1.1%, +0.2%, +0.6% | No property-value study found in Crossref (OpenAlex rate-limited) | stay unverified |
| Park renovation, street trees | | Re-checked in rounds 2–3; nothing new | stay unverified |

**Correction:** the round-1 catalog audit said "Liang et al. 2023" could not be found. It is Liang et al., *Nature
Sustainability* 2023 (a 2022 SSRN version also exists), and it states the +3.3% within 1 km the catalog cited.

**Cost correction:** the engine's $800,000 per 8-port EV site was about 45% of the public Santa Barbara budget, so
EV-hub returns per $1 were overstated about 2.2x on cost alone.

**Why California only:** both the EV and school-bond studies sample California only. Applying them nationwide made
school bonds the best project in 30,916 non-LA block groups; that is extrapolation, so outside California these items
stay without dollar figures (`applies_if.state_fips_in`, honored by the page's `ivAllows` and
`scripts/catalog_coverage.py`).

## California pedestrian/cyclist crash counts are now complete

`scripts/build_crash_counts_ca.py` used only the crash table's "motor vehicle involved with" field (the first thing
struck). It now also counts a crash when any party in CCRS's Parties table, or any injured person, is a Pedestrian or
Bicyclist (74,380 such crashes statewide, 2023–2025). Rebuilt all 57 counties (San Francisco stays on DataSF):

- pedestrian/cyclist crashes: 58,520 → 64,278 (+10%); LA 15,228 → 16,491 (+8%); total crashes unchanged; no block
  group's count went down;
- `scripts/recompute_crash_gaps.py` no longer treats California as a lower bound (Illinois still is), so crash rows
  that no longer qualify are now dropped in California too: 15,417 rows dropped (part of this is the 3-year window
  versus the county files' roughly 10-year window); California pedestrian/cyclist gaps 4,387 → 4,485.

## Coverage (share of block groups whose best gated project returns ≥ $1 per $1)

| Area | Before round 4 | After | Both effect and cost sourced, before → after |
|---|---|---|---|
| LA County (6,587) | 61.7% | 88.6% | 45.7% → 62.3% |
| All non-LA files (175,478) | 16.9% | 31.3% | 15.2% → 14.0% |
| Travis County, TX (766) | 1.0% | 18.1% | 0.1% → 0.1% |
| Nationwide (182,065) | 18.5% | 33.3% | 16.3% → 15.7% |

Best project after round 4, nationwide: blight rehab 26,669; traffic calming 26,018; school bonds 2,716 (California);
EV hubs 2,421 (California); undergrounding 1,481. The "both sourced" share fell outside LA because blight rehab
(cost unchecked) now outranks traffic calming in some block groups. The coverage script ignores the crash-row
recompute, so it slightly overstates traffic calming where the page drops those rows.
