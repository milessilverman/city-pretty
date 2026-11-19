# Audit: engines, underused sites, valuation back-test

Audited 2026-11-16. Machine-readable detail, including every constant with file:line: [`engines-sites-audit.json`](engines-sites-audit.json).

Everything marked "fetched" was checked against a live source from this environment on 2026-11-16. Anything not fetched is said to be not confirmed.

## 1. Underused sites (`app/data/underused_sites.json`): 99 → 90 records

**Removed 9 hand-typed records** (from `scripts/expand_underused_sites_nationwide.mjs`):
`site_phx_golf_1, site_phx_lot_2, site_atx_golf_1, site_atx_lot_2, site_sea_lot_1, site_den_golf_1, site_chi_lot_1, site_det_vacant_1, site_tpa_lot_1`.

- The script fetches nothing. The assessed and market values, home counts and profit margins were typed in.
- Where I could check, the facts are wrong:
  - Hancock Golf Course is about 4.1 km from Plaza Saltillo; the record says 750 m.
  - Papago Golf Course is about 2.8 km from the 44th St/Washington station; the record says 620 m.
  - Papago's address is on E Karsten Way, not E Moreland St.
  - Austin and Phoenix records are flagged as California "Housing Element" sites, a designation that only exists in California.

**Kept 90 Los Angeles records** (from `scripts/build_underused_sites.mjs`, which selects from `app/data/bundle-la.b64.txt` → `under.sites`). Each one now has a `verification` object that separates source fields from model outputs.

- **Source fields** (acres, assessed land value, base year, use, zoning, rail distance, owner) come from LA County Assessor and GIS data packaged in the bundle.
  - Spot check: all **33 of 33** records that have an address match the LA County public parcel layer. Roll land value matches exactly and parcel area is within about 1%.
  - The 57 records with no address were not checked.
- **Model outputs**: `marketLandValue`, `potentialHomes`, `margin`, `idea`.
  - The assumptions are documented in the bundle (`under.assumptions`), but the code that computed them is **not in this repo**, so `margin` cannot be reproduced.
  - `site_la_1` (a Palmdale golf course) shows a $94.3M margin on 452 homes, about $208k per home, which looks implausible.
- **Classification oddities**:
  - Some "vacant" records have Assessor use codes for heavy manufacturing or industrial.
  - `site_la_82` is labeled "lightly built commercial", but the roll shows about 222k sq ft of buildings.

## 2. Valuation back-test: the sales were fabricated

- **Los Angeles:** 5 of the 6 parcel numbers do not exist in the LA County parcel layer. The sixth (4091001009) exists, but its land value, base year and living area all differ from the script.
- **King, Harris, Hillsborough and Cook:** the parcel IDs are arithmetic sequences (fixed steps of 30 to 45). Cook County PINs are 14 digits; the script's are 10.

`app/data/valuation_backtest_benchmarks.json` is now an honest stub with `_status: "no_backtest_run"`.

Code that reads it:

- `app/app.js:12, 42, 81` load it.
- `app/app.js:5515-5522` is the withholding check. No caller passes `enforceCountyBacktest`, so this path is dead; the stub has no effect on it.
- `tests/unit/dataAccuracy.test.ts:211` (test 11) asserts the file holds verified back-tests. **It will now fail** and must be rewritten.
- `scripts/run_valuation_backtests.mjs` holds the fabricated sales. Delete it or replace it with a real fetch. Cook County's sales data (Socrata) is publicly reachable and could serve.
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md` and `CHANGELOG.md` claim "BACK-TESTED". That claim is false.

## 3. Which engines actually run in the shipped app

I checked this in headless Chromium against `scripts/serve.mjs`. `index.html` loads only the vendor scripts, `app/config.js`, `app/app.js` and `app/explore.js`.

| Engine | Ships? |
|---|---|
| EverySpace | **No.** `app.js:1383` resolves to null in the browser, so the EverySpace UI block (`app.js:2244`) never renders. |
| Renovation quote | **No.** There is also a name mismatch: app.js expects `evaluateRenovationQuote`, but the engine exports `evaluateHomeownerRenovationQuote`. |
| StreetForge | **No.** `app.js:1391-1397` resolve to null, and the advisor's StreetForge block never runs. |
| Transit corridor opportunity | No. Not referenced by app.js. |
| Underused land | No. Not referenced by app.js. |
| Valuation back-test | No. Only its JSON output is read. |
| Property valuation | **Yes.** A copy is inlined in `app.js:634-970`. |

Data that does ship: `underused_sites.json` and `intercity_transit_corridors.json` are loaded and sent to the AI advisor (`app.js:9343-9392`).

- **Bug at `app.js:9375`:** when the selected block group has no site, the matcher falls back to *any* golf course in the county, so the AI is sent an unrelated site.

## 4. Real-world constants (47 entries in the JSON)

Legend:
- **a**: confirmed by fetching.
- **b**: cites a source I could not confirm.
- **b-contradicted**: I fetched the source and it contradicts the code.
- **c**: no source; an assumption or invented number.

### Contradicted by law I fetched

- **IRC §30C EV charger credit** (`streetForgeEngine.ts:229-231`, comment at line 81).
  - P.L. 119-21 §70504 ends the credit for property placed in service after **June 30, 2026**; AFDC marks it "Expired 06/30/2026".
  - When it applied, it was 6% (30% only with prevailing wage and apprenticeship), with eligibility based on IRS-listed census tracts, not "Justice40".
  - A charger built today gets **$0**; the engine credits up to 30%.
- **NEVI** (`streetForgeEngine.ts:223-227`).
  - The IIJA sets the NEVI federal share at **80%**, paid as formula funds to states for FY2022–2026 (FHWA interim final guidance, Aug 11, 2025).
  - The engine awards 65% to any fast charger, and also to Level-2 chargers in "Justice40" tracts.
  - Justice40 (EO 14008) was **revoked by EO 14148** on Jan 20, 2025.
- **SS4A** (`streetForgeEngine.ts:115,149`).
  - Statute: federal share "shall not exceed 80 percent", authorized for FY2022–2026, and only public agencies can apply.
  - The engine subtracts a 75% or 60% "match" from the cost as if the grant were already awarded.
- **Social cost of carbon at $190/ton** (`streetForgeEngine.ts:132`).
  - EO 14154 disbanded the working group that produced these estimates and withdrew them. This is not current federal policy, and it is mislabeled "EPA 2024".
- **"Backed by HUD FY2026 Fair Market Rents"** (`everySpaceEngine.ts:170`). The HUD file it relies on was hand-typed.
- **Arizona ADU citation** (`renovationQuoteEngine.ts:126`). A.R.S. § 9-467.04 does not exist (azleg returns 404); the ADU statute is **§ 9-461.18**.
- **Washington** (line 142). RCW 36.70A.696 is the definitions section; the operative rule is **36.70A.681**.
- **Florida** (line 158). § 166.04151 exists, but it is the Live Local affordable-housing section, not an ADU law.
- **Not confirmed:**
  - The California and Colorado citations: their legislature sites block this environment.
  - Texas § 214.909: the statute site renders with JavaScript, so I couldn't read the section.

### Confirmed

- `advisorGroundingContract.ts:154`: §25D residential solar credit ends for expenditures after Dec 31, 2025 (P.L. 119-21 §70506). **Correct.**

### No source (class c): the most important to remove or label

- **Transit corridor engine** `transitCorridorOpportunityEngine.ts:207, 217, 225, 262, 272, 307, 317`. It presents promised returns to users: "18% to 24% IRR", "22% to 28% project equity IRR", "+20% to +30% appreciation", "+$1,200–$1,600/mo", "100% negative carry offset".
- **Shipped valuation bands** `app/app.js:929-942`: ±3.8% to ±7.8% labeled "High Precision" or "High Confidence". No real back-test supports them.
- **Underused land engine** `underusedLandEngine.ts:195, 196, 254, 255`: invented fallbacks ($750,000 home value; $800k and $1.2M per acre; $65k margin per home). These are the kind of fallbacks the audit doc says were removed.
- **Back-test engine** `valuationBacktestEngine.ts:139-149`: invents property attributes during a back-test. Line 105 auto-stamps a "lastVerified" date.
- **StreetForge** `streetForgeEngine.ts:105-109, 120-143, 197-249`: every lane cost, ridership, crash, sales-lift, charger cost and charger revenue number.
- **EverySpace** `everySpaceEngine.ts:84-159`: all rent figures (driveway, storage, pool, roof, ADU). Its solar "roof lease" income is likely wrong in most residential markets.
- **Renovation** `renovationQuoteEngine.ts:95-105, 268-281`: the cost and equity-lift benchmark table, and fixed "alternative project" numbers that are shown for every property.
