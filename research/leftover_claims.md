# Leftover claims and constants (sweep, Part B)

Checked 2026-11-18 by grep over the working tree. Line numbers refer to the files as they stood when this was generated; `app/app.js` and `app/data/*` were being edited by other agents in parallel, so re-run the greps before acting on a line number.

Method notes:
- B1 buckets each hit. **user** = not inside a comment, not part of an identifier or data key (no `_` in the token, no camelCase compound), not CSS. These are the candidates for user-visible text; a few may still be variable values or enum labels (the buckets are heuristic, so read the examples). **code**, **css** and **comment** hits are counted but not listed.
- B2b lists every 4+ digit integer or decimal literal that is an operand of `*` or `/` in a non-comment line under `src/engines/` (both `.ts` and `.js` twins). Years and FIPS-like numbers are included because the brief asked for every literal.

## B1. Overclaiming words in user-facing strings

Files: `app/app.js`, `app/explore.js`, `index.html`, `src/**/*.ts`, `src/**/*.js`.

| word | user-visible candidates | code/identifier | CSS | comment |
|---|---:|---:|---:|---:|
| institutional | 10 | 4 | 0 | 6 |
| Zillow-grade | 0 | 0 | 0 | 1 |
| audited | 3 | 9 | 0 | 0 |
| 100% | 17 | 0 | 28 | 23 |
| 95% CI | 0 | 0 | 0 | 4 |
| verified | 44 | 39 | 0 | 21 |
| back-tested | 4 | 0 | 0 | 1 |
| guaranteed | 3 | 0 | 0 | 0 |
| high-conviction | 2 | 0 | 0 | 0 |
| empirical | 8 | 0 | 0 | 11 |

Candidate hits per file: `app/app.js` 48, `index.html` 10, `src/ui/houseInspectorPanel.js` 5, `src/ui/houseInspectorPanel.ts` 5, `src/engines/valuationBacktestEngine.ts` 4, `src/engines/parcelHouseAuditor.js` 3, `src/engines/parcelHouseAuditor.ts` 3, `src/engines/transitCorridorOpportunityEngine.js` 2, `src/engines/transitCorridorOpportunityEngine.ts` 2, `app/explore.js` 1, `src/engines/everySpaceEngine.js` 1, `src/engines/everySpaceEngine.ts` 1, `src/engines/propertyValuationEngine.js` 1, `src/engines/propertyValuationEngine.ts` 1, `src/engines/renovationQuoteEngine.js` 1, `src/engines/renovationQuoteEngine.ts` 1, `src/engines/residualProfitEngine.ts` 1, `src/state/urlHashSync.ts` 1.

### "institutional" (10 candidates; first 10 shown)

- `app/app.js:2293` <b>Institutional Disclaimers:</b><br>
- `app/app.js:3258` [/^MPD$/, "Planned industrial development."], [/^MXD/, "Mixed use: apartments with shops or offices."], [/^IT$/, "Institutional: schools, hospitals, churches."],
- `src/engines/transitCorridorOpportunityEngine.js:200` recommendationNarrative: 'With $${(capitalBudget / 1e6).toFixed(1)}M, transform ${station.name} through an institutional P3. Build hundreds of transit-oriented homes, capture tax increment revenue to…
- `src/engines/transitCorridorOpportunityEngine.ts:329` recommendationNarrative: 'With $${(capitalBudget / 1e6).toFixed(1)}M, transform ${station.name} through an institutional P3. Build hundreds of transit-oriented homes, capture tax increment revenue to…
- `src/ui/houseInspectorPanel.js:33` <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Parcel Comprehensive Institutional Audit</div>
- `src/ui/houseInspectorPanel.js:44` <span style="font-size:11px;font-weight:700;color:#334155;">Institutional AVM Valuation</span>
- `src/ui/houseInspectorPanel.js:198` <b>Institutional Disclaimers:</b><br>
- `src/ui/houseInspectorPanel.ts:33` <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Parcel Comprehensive Institutional Audit</div>
- `src/ui/houseInspectorPanel.ts:44` <span style="font-size:11px;font-weight:700;color:#334155;">Institutional AVM Valuation</span>
- `src/ui/houseInspectorPanel.ts:198` <b>Institutional Disclaimers:</b><br>

### "Zillow-grade" (0 candidates; first 0 shown)

None.

### "audited" (3 candidates; first 3 shown)

- `app/app.js:10034` <h4 style="margin:0;font-size:15px;font-weight:800;color:var(--ink);">All 639 Audited US Counties Directory</h4>
- `app/app.js:10037` <button type="button" class="action-pill" id="btn-filter-audited" onclick="filterCountyReadinessTier('audited_A')" style="font-size:11px;padding:3px 9px;">Tier A (LA)</button>
- `app/app.js:10085` const btn = document.getElementById("btn-filter-" + (t === "all" ? "all" : t === "audited_A" ? "audited" : t === "verified_B" ? "verified" : t === "preliminary_C" ? "prelim" : "cadastral"));

### "100%" (17 candidates; first 15 shown)

- `app/app.js:782` assessorMethodName = "Washington King/WA 100% True & Fair Value";
- `app/app.js:1606` statutoryNotes = "Florida Live Local Act 4.0: Preempts local height/density on commercial sites; mandatory 75%–100% property tax exemption under Fla. Stat. § 196.1979.";
- `app/app.js:2496` var ENHANCEMENTS = {"street_trees": {"lead_agency": "City Public Works (StreetsLA) / Urban Forestry Division","process": "Board of Public Works street tree planting contract & Urban Forestry permit",…
- `app/app.js:3624` L_.push("<b>SB 4 (Affordable Housing on Faith Lands):</b> Permits 100% affordable housing by right on land owned by religious institutions and nonprofit colleges.");
- `app/app.js:3633` L_.push("<b>Property Tax Abatement:</b> Up to 100% county and municipal ad valorem tax exemptions for units dedicated to moderate- and workforce-income households.");
- `app/app.js:5403` (isCa ? "CA Gov. Code § 65863.2 (AB 2097) — 100% Zero Minimum Parking Mandate + Gov Code § 66314 (Ministerial ADU)" : "Station Transit Walkshed Statutory Parking Exemption (Saves ~$45,000 in garage r…
- `app/app.js:8558` if (pctEl) pctEl.textContent = "100%";
- `app/app.js:9906` assessRatioText = "Texas Property Tax Code § 23.01 100% Market Value CAD Ad Valorem Assessment";
- `app/app.js:9912` assessRatioText = "Florida Constitution Art. VII Just Value (100% Fair Market Valuation) & Save Our Homes 3% Inflation Cap";
- `app/app.js:9936` assessRatioText = "100% Statutory Ad Valorem Market Baseline & State Sales Ratio Normalization";
- `index.html:372` Deterministic statutory engines codifying enacted state laws (CA AB 2097 zero parking, SB 9 lot splits, Gov Code § 66314 ADUs, TX HB 2720, FL Live Local Act). 100% auditable code citations.
- `src/engines/parcelHouseAuditor.js:238` statutoryNotes = "Florida Live Local Act 4.0: Preempts local height/density on commercial sites; mandatory 75%–100% property tax exemption under Fla. Stat. § 196.1979.";
- `src/engines/parcelHouseAuditor.ts:367` statutoryNotes = "Florida Live Local Act 4.0: Preempts local height/density on commercial sites; mandatory 75%–100% property tax exemption under Fla. Stat. § 196.1979.";
- `src/engines/propertyValuationEngine.js:321` assessorMethodName = "Washington King/WA 100% True & Fair Value";
- `src/engines/propertyValuationEngine.ts:306` assessorMethodName = "Washington King/WA 100% True & Fair Value";

### "95% CI" (0 candidates; first 0 shown)

None.

### "verified" (44 candidates; first 15 shown)

- `app/app.js:1598` statutoryNotes = "Zoning is not on file for this parcel; by-right housing rights and ministerial lot splits cannot be determined without verified local zoning.";
- `app/app.js:1815` "Statutory housing rights and lot split feasibility must be verified with local municipal planning and building departments prior to architectural design, capital allocation, or contractor commitment…
- `app/app.js:2118` ? "✓ Verified Current Imagery"
- `app/app.js:2269` <span style="font-size:10.5px;font-weight:700;color:#15803d;">Statutory By-Right Verified</span>
- `app/app.js:2458` assessor_roll_vintage: "Unverified",
- `app/app.js:2589` const GRADE_TXT = { A: "A · measured on LA sales", B: "B · studied elsewhere", C: "C · transferred from a related study", D: "D · assumption", U: "U · unverified research lead (round 6)" };
- `app/app.js:2616` profit: { label: "Experimental: Profit potential (unverified)", f: p => p.pp > 0 ? p.pp * 100 : null, unit: v => v.toFixed(1) + "%", ramp: "seq", none: "No paying projects or sites" },
- `app/app.js:3806` function siteSrc(key) { const v = ((SITES || {}).meta || {}).verified || {}; return v[key] || null; }
- `app/app.js:3988` const F = ocFunding(id); if (!F) return isOrangeArea(m) ? "" : '<p class="small muted">Funding programmes for ${esc(countyOf(m))} have not been verified yet, so none are listed (LA County's programme…
- `app/app.js:3991` return '<p class="small"><b>Orange County funding (verified):</b> ${F.funding.map(x => '<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.name)}</a> <span class="muted">(${esc(x.what)…
- `app/app.js:4043` ${c.benefit && mode === "qol" ? '<p class="small"><b>Public benefit (unverified estimate):</b> about ${fmt$(c.benefit[0])} a year from ${esc(c.benefit[1].toLowerCase())}, roughly <b>${fvpd(c.benefit[…
- `app/app.js:4917` <p class="small muted" style="margin:4px 0 6px">Construction costs are this page's model estimate (unit costs per sq ft), not contractor quotes; the cost schedule they were first calibrated to could …
- `app/app.js:5023` note = isSD ? "modeled ~$20k resale premium (Redfin 2019 San Diego estimate: $20,001; not verified on local sales)" : isOC ? "modeled ~$56k resale premium (Redfin 2019 Orange County estimate; not ver…
- `app/app.js:5023` note = isSD ? "modeled ~$20k resale premium (Redfin 2019 San Diego estimate: $20,001; not verified on local sales)" : isOC ? "modeled ~$56k resale premium (Redfin 2019 Orange County estimate; not ver…
- `app/app.js:5023` note = isSD ? "modeled ~$20k resale premium (Redfin 2019 San Diego estimate: $20,001; not verified on local sales)" : isOC ? "modeled ~$56k resale premium (Redfin 2019 Orange County estimate; not ver…

### "back-tested" (4 candidates; first 4 shown)

- `src/engines/valuationBacktestEngine.ts:443` ): { withhold: boolean; reason: string | null; supportedMargin: number | null; backtested: boolean } {
- `src/engines/valuationBacktestEngine.ts:446` return { withhold: false, reason: null, supportedMargin: null, backtested: false };
- `src/engines/valuationBacktestEngine.ts:453` backtested: true
- `src/engines/valuationBacktestEngine.ts:456` return { withhold: false, reason: null, supportedMargin: benchmark.supportedConfidenceMarginPct ?? null, backtested: true };

### "guaranteed" (3 candidates; first 3 shown)

- `app/app.js:8112` <b>P3 Partnership Structure:</b> Public transit agency contributes land/concession rights via 99-year ground lease with zero taxpayer bond debt for vertical construction. Private capital consortium f…
- `src/engines/everySpaceEngine.js:89` revenueNotes: "Backed by HUD FY2026 Fair Market Rent benchmarks for guaranteed workforce demand."
- `src/engines/everySpaceEngine.ts:170` revenueNotes: "Backed by HUD FY2026 Fair Market Rent benchmarks for guaranteed workforce demand."

### "high-conviction" (2 candidates; first 2 shown)

- `src/engines/renovationQuoteEngine.js:138` summary = 'High-conviction value add. Projects +$${estimatedEquityValueAdd.toLocaleString()} in property equity (+${roiPct}% net ROI) and +$${everySpaceMonthlyYield.toLocaleString()}/mo ongoing Every…
- `src/engines/renovationQuoteEngine.ts:243` summary = 'High-conviction value add. Projects +$${estimatedEquityValueAdd.toLocaleString()} in property equity (+${roiPct}% net ROI) and +$${everySpaceMonthlyYield.toLocaleString()}/mo ongoing Every…

### "empirical" (8 candidates; first 8 shown)

- `app/app.js:9181` countLabel.innerHTML = 'Showing <b>${filtered.length}</b> of ${RESEARCH_CORPUS_500.length} empirical research studies &middot; Average Measured Benefit: <b>$${avgVpd} / $1</b>';
- `app/app.js:9187` <div style="font-size:14px;font-weight:700;">No empirical studies matching "${esc(activeResearchSearch)}"</div>
- `app/app.js:11618` 3. Empirical Academic &amp; Precedent Grounding
- `index.html:174` <div style="font-size:11.5px;color:#bae6fd;">Longitudinal Empirical Audits: Where Targeted Public Capital Generated Multi-Billion Dollar Private Real Estate Surges</div>
- `index.html:210` <div style="font-size:17px;font-weight:800;letter-spacing:0.3px;">Empirical Urban Economics &amp; Historical Research Library</div>
- `index.html:237` <div id="research-list" role="region" aria-label="Empirical research study results" aria-live="polite" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;back…
- `index.html:238` <div style="padding:24px;text-align:center;color:#64748b;font-size:13px;">Loading peer-reviewed research papers and empirical econometric findings…</div>
- `index.html:499` <p class="small">Each project's return is the capitalized real estate value it adds to the surrounding homes, divided by its full lifecycle cost (procurement, site engineering, construction, and ten …

## B2a. Fallback numbers: `|| <3+ digits>` and `?? <3+ digits>`

Files: same set as B1. Total matching lines: **61**.

- `app/app.js:710` const effYear = +(F.eff || a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || F.yb || a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || 1975) || 1975;
- `app/app.js:1307` const currentYear = input.referenceYear ?? 2026;
- `app/app.js:1313` permitYear !== null && permitYear >= (input.lidarAcquisitionYear || 2020);
- `app/app.js:1545` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `app/app.js:1684` lotSqft: lotSqft || 6000,
- `app/app.js:1685` livingSqft: livingSqft || 1500,
- `app/app.js:1692` hasAtticOrBasementStorage: (livingSqft || 1500) > 1200,
- `app/app.js:1693` storageSqft: Math.round((livingSqft || 1500) * 0.15),
- `app/app.js:1708` currentLivingSqft: livingSqft || 1500,
- `app/app.js:1709` lotSqft: lotSqft || 6000,
- `app/app.js:1719` currentLivingSqft: livingSqft || 1500,
- `app/app.js:1720` lotSqft: lotSqft || 6000,
- `app/app.js:1730` currentLivingSqft: livingSqft || 1500,
- `app/app.js:1758` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `app/app.js:1846` const yb = yearBuilt || 1975;
- `app/app.js:1868` const livingSqft = Math.max(400, Number(input.livingSqft) || 1600);
- `app/app.js:6922` resultRecordCount: String(Math.min(svc.max || 1000, 1000)), f: "json" });
- `app/app.js:6987` const maxRec = Math.min(svc.max || 1000, 1000);
- `src/engines/everySpaceEngine.js:28` const sqft = input.features.storageSqft || 250;
- `src/engines/everySpaceEngine.js:60` const roofSqft = input.features.availableRoofSqft || 1200;
- `src/engines/everySpaceEngine.js:78` const aduRent = (input.localHudFmr && input.localHudFmr.one_bed_1br) || 1850;
- `src/engines/everySpaceEngine.ts:103` const sqft = input.features.storageSqft || 250;
- `src/engines/everySpaceEngine.ts:139` const roofSqft = input.features.availableRoofSqft || 1200;
- `src/engines/everySpaceEngine.ts:159` const aduRent = input.localHudFmr?.one_bed_1br || 1850;
- `src/engines/lidarStreetViewValidator.js:8` const currentYear = input.referenceYear ?? 2026;
- `src/engines/lidarStreetViewValidator.js:14` permitYear !== null && permitYear >= (input.lidarAcquisitionYear || 2020);
- `src/engines/lidarStreetViewValidator.ts:21` const currentYear = input.referenceYear ?? 2026;
- `src/engines/parcelHouseAuditor.js:177` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `src/engines/parcelHouseAuditor.js:316` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.js:317` livingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.js:324` hasAtticOrBasementStorage: (livingSqft || 1500) > 1200,
- `src/engines/parcelHouseAuditor.js:325` storageSqft: Math.round((livingSqft || 1500) * 0.15),
- `src/engines/parcelHouseAuditor.js:340` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.js:341` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.js:351` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.js:352` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.js:362` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.js:390` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `src/engines/parcelHouseAuditor.ts:306` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `src/engines/parcelHouseAuditor.ts:445` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.ts:446` livingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.ts:453` hasAtticOrBasementStorage: (livingSqft || 1500) > 1200,
- `src/engines/parcelHouseAuditor.ts:454` storageSqft: Math.round((livingSqft || 1500) * 0.15),
- `src/engines/parcelHouseAuditor.ts:469` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.ts:470` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.ts:480` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.ts:481` lotSqft: lotSqft || 6000,
- `src/engines/parcelHouseAuditor.ts:491` currentLivingSqft: livingSqft || 1500,
- `src/engines/parcelHouseAuditor.ts:519` lidarAcquisitionYear: imagery.lidarYear || 2020,
- `src/engines/renovationQuoteEngine.js:84` const sqft = input.projectedSqft || 500;
- `src/engines/renovationQuoteEngine.js:115` everySpaceMonthlyYield = (input.localHudFmr && input.localHudFmr.one_bed_1br) || 1850;
- `src/engines/renovationQuoteEngine.js:117` everySpaceMonthlyYield = (input.localHudFmr && input.localHudFmr.zero_bed_eff) || 1450;
- `src/engines/renovationQuoteEngine.js:164` monthlyEverySpaceYield: (input.localHudFmr && input.localHudFmr.zero_bed_eff) || 1450,
- `src/engines/renovationQuoteEngine.ts:178` const sqft = input.projectedSqft || 500;
- `src/engines/renovationQuoteEngine.ts:215` everySpaceMonthlyYield = input.localHudFmr?.one_bed_1br || 1850;
- `src/engines/renovationQuoteEngine.ts:218` everySpaceMonthlyYield = input.localHudFmr?.zero_bed_eff || 1450;
- `src/engines/renovationQuoteEngine.ts:271` monthlyEverySpaceYield: input.localHudFmr?.zero_bed_eff || 1450,
- `src/engines/streetForgeEngine.js:19` const aadt = input.currentAadt || 14000;
- `src/engines/valuationBacktestEngine.js:56` lotSqft: s.lotSqft || s.attributes?.LotSqft || 6000,
- `src/engines/valuationBacktestEngine.js:58` hv: s.neighborhoodMedianHv || 750000,
- `src/engines/valuationBacktestEngine.js:66` yb: s.attributes?.YearBuilt || s.attributes?.CONST_YEAR || 1980

## B2b. Multiplier literals in `src/engines/` (4+ digits or decimals, operand of `*` or `/`)

Total: **298** occurrences in 24 files. Context is the line from 30 characters before to 30 after the literal, comment text excluded.

### `src/engines/everySpaceEngine.js`

- line 29: literal `1.25`: " expected = Math.round(sqft * 1.25);"
- line 34: literal `0.90`: "enueLowUsd: Math.round(sqft * 0.90),"
- line 35: literal `1.60`: "nueHighUsd: Math.round(sqft * 1.60),"
- line 83: literal `0.90`: "eLowUsd: Math.round(aduRent * 0.90),"
- line 84: literal `1.15`: "HighUsd: Math.round(aduRent * 1.15),"
### `src/engines/everySpaceEngine.ts`

- line 105: literal `1.25`: " expected = Math.round(sqft * 1.25);"
- line 110: literal `0.90`: "enueLowUsd: Math.round(sqft * 0.90),"
- line 111: literal `1.60`: "nueHighUsd: Math.round(sqft * 1.60),"
- line 164: literal `0.90`: "eLowUsd: Math.round(aduRent * 0.90),"
- line 165: literal `1.15`: "HighUsd: Math.round(aduRent * 1.15),"
### `src/engines/hedonicCapitalizationEngine.js`

- line 26: literal `1.96`: " ci95HalfWidthPct: 1.96 * c.studyStandardErrorPct,"
- line 37: literal `0.95`: "item.effectiveLiftPct, pMax * 0.95);"
- line 63: literal `0.4`: " 0.4 * baseline.renterShare +"
- line 64: literal `0.35`: " 0.35 * baseline.severeRentBurdenSh"
- line 65: literal `0.25`: " 0.25 * (1 - baseline.rentControlCo"
- line 67: literal `0.1`: "n(1, jointCapitalizationPct / 0.1)"
### `src/engines/hedonicCapitalizationEngine.ts`

- line 42: literal `1.96`: " ci95HalfWidthPct: 1.96 * c.studyStandardErrorPct,"
- line 53: literal `0.95`: "item.effectiveLiftPct, pMax * 0.95);"
- line 80: literal `0.4`: " 0.4 * baseline.renterShare +"
- line 81: literal `0.35`: " 0.35 * baseline.severeRentBurdenSh"
- line 82: literal `0.25`: " 0.25 * (1 - baseline.rentControlCo"
- line 84: literal `0.1`: "n(1, jointCapitalizationPct / 0.1)"
### `src/engines/parcelHouseAuditor.js`

- line 33: literal `2500000`: " return Math.pow(2500000 / marketVal, 0.45);"
- line 46: literal `0.85`: "pitalized += Math.round(val * 0.85);"
- line 48: literal `250000`: "otalCapitalized += Math.round(250000 * 0.85 + (val - 250000) * 0.6"
- line 48: literal `0.85`: "alized += Math.round(250000 * 0.85 + (val - 250000) * 0.60);"
- line 48: literal `0.60`: "000 * 0.85 + (val - 250000) * 0.60);"
- line 163: literal `1000`: "= Math.round(rawAdjustedVal / 1000) * 1000;"
- line 163: literal `1000`: "ound(rawAdjustedVal / 1000) * 1000;"
- line 164: literal `1000`: "seAvm.confidenceMarginPct)) / 1000) * 1000;"
- line 164: literal `1000`: "nfidenceMarginPct)) / 1000) * 1000;"
- line 165: literal `1000`: "seAvm.confidenceMarginPct)) / 1000) * 1000;"
- line 165: literal `1000`: "nfidenceMarginPct)) / 1000) * 1000;"
- line 253: literal `1.15`: ".max(1, input.stories || 1) * 1.15);"
- line 256: literal `1.6`: "r(((unshadedRoofSqft / 100) * 1.6).toFixed(1));"
- line 290: literal `1000`: "emCostUsd = Math.round(dcKw * 1000 * (stCode === "CA" ? 3.15 : 2"
- line 318: literal `0.0055`: "h.round(finalEstimatedValue * 0.0055),"
- line 319: literal `0.0012`: "h.round(finalEstimatedValue * 0.0012),"
- line 325: literal `0.15`: ".round((livingSqft || 1500) * 0.15),"
- line 433: literal `3.0`: " ? "CA NEM 3.0 / Net Billing Tariff: Mid-day"
- line 433: literal `0.055`: "e credited at avoided cost (~$0.055/kWh). Paired 10–13.5 kWh batt"
### `src/engines/parcelHouseAuditor.ts`

- line 159: literal `2500000`: " return Math.pow(2500000 / marketVal, 0.45);"
- line 172: literal `0.85`: "pitalized += Math.round(val * 0.85);"
- line 174: literal `250000`: "otalCapitalized += Math.round(250000 * 0.85 + (val - 250000) * 0.6"
- line 174: literal `0.85`: "alized += Math.round(250000 * 0.85 + (val - 250000) * 0.60);"
- line 174: literal `0.60`: "000 * 0.85 + (val - 250000) * 0.60);"
- line 292: literal `1000`: "= Math.round(rawAdjustedVal / 1000) * 1000;"
- line 292: literal `1000`: "ound(rawAdjustedVal / 1000) * 1000;"
- line 293: literal `1000`: "seAvm.confidenceMarginPct)) / 1000) * 1000;"
- line 293: literal `1000`: "nfidenceMarginPct)) / 1000) * 1000;"
- line 294: literal `1000`: "seAvm.confidenceMarginPct)) / 1000) * 1000;"
- line 294: literal `1000`: "nfidenceMarginPct)) / 1000) * 1000;"
- line 419: literal `1000`: "emCostUsd = Math.round(dcKw * 1000 * (stCode === "CA" ? 3.15 : 2"
- line 447: literal `0.0055`: "h.round(finalEstimatedValue * 0.0055),"
- line 448: literal `0.0012`: "h.round(finalEstimatedValue * 0.0012),"
- line 454: literal `0.15`: ".round((livingSqft || 1500) * 0.15),"
- line 550: literal `3.0`: " ? "CA NEM 3.0 / Net Billing Tariff: Mid-day"
- line 550: literal `0.055`: "e credited at avoided cost (~$0.055/kWh). Paired 10–13.5 kWh batt"
### `src/engines/propertyValuationEngine.js`

- line 194: literal `0.95`: "otSqft || rawSqft < lotSqft * 0.95 || rawSqft < 4500)) {"
- line 214: literal `1.165`: "th.round(baseNeighborhoodHv * 1.165);"
- line 239: literal `0.18`: "siteValue / profile.refLot) * 0.18 * excessDecay;"
- line 240: literal `0.22`: "otAdj = Math.max(-siteValue * 0.22, Math.min(siteValue * 0.30, l"
- line 240: literal `0.30`: " * 0.22, Math.min(siteValue * 0.30, lotAdj));"
- line 246: literal `0.025`: ", Math.min(0.20, (beds - 3) * 0.025 + (baths - 2) * 0.035)) * str"
- line 246: literal `0.035`: " - 3) * 0.025 + (baths - 2) * 0.035)) * structVal : 0;"
- line 250: literal `0.003`: ".min(0.25, (effYear - 1980) * 0.003)) * structVal : 0;"
- line 255: literal `0.16`: "ss)) qualityAdj = structVal * 0.16;"
- line 256: literal `0.08`: "ss)) qualityAdj = structVal * 0.08;"
- line 257: literal `0.08`: "s)) qualityAdj = -structVal * 0.08;"
- line 264: literal `0.025`: " "")) ? (baseNeighborhoodHv * 0.025) : 0;"
- line 265: literal `0.035`: " "")) ? (baseNeighborhoodHv * 0.035) : 0;"
- line 269: literal `0.10`: " = hasBasement ? (structVal * 0.10) : 0;"
- line 276: literal `0.08`: ".min(0.24, (unitsCount - 1) * 0.08) * structVal : 0;"
- line 296: literal `2.0`: "rMarketEst = Math.round(sev * 2.0 * 1.04);"
- line 296: literal `1.04`: "tEst = Math.round(sev * 2.0 * 1.04);"
- line 302: literal `1.03`: "MarketEst = Math.round(fVal * 1.03);"
- line 307: literal `1.03`: "rketEst = Math.round(mktVal * 1.03);"
- line 313: literal `1.02`: "arketEst = Math.round(azVal * 1.02);"
- line 319: literal `1.02`: "arketEst = Math.round(waVal * 1.02);"
- line 325: literal `1.02`: "arketEst = Math.round(orVal * 1.02);"
- line 331: literal `1.02`: "arketEst = Math.round(paVal * 1.02);"
- line 336: literal `1.02`: "rketEst = Math.round(mktVal * 1.02);"
- line 342: literal `1.02`: "MarketEst = Math.round(wVal * 1.02);"
- line 348: literal `1.02`: "MarketEst = Math.round(nVal * 1.02);"
- line 353: literal `0.35`: "etEst = Math.round((rollTot / 0.35) * 1.02);"
- line 353: literal `1.02`: "Math.round((rollTot / 0.35) * 1.02);"
- line 358: literal `10.0`: "ketEst = Math.round(rollTot * 10.0 * 1.02);"
- line 358: literal `1.02`: "= Math.round(rollTot * 10.0 * 1.02);"
- line 363: literal `0.40`: "etEst = Math.round((rollTot / 0.40) * 1.02);"
- line 363: literal `1.02`: "Math.round((rollTot / 0.40) * 1.02);"
- line 368: literal `0.35`: "etEst = Math.round((rollTot / 0.35) * 1.02);"
- line 368: literal `1.02`: "Math.round((rollTot / 0.35) * 1.02);"
- line 373: literal `0.25`: "etEst = Math.round((rollTot / 0.25) * 1.02);"
- line 373: literal `1.02`: "Math.round((rollTot / 0.25) * 1.02);"
- line 378: literal `0.067`: "etEst = Math.round((rollTot / 0.067) * 1.02);"
- line 378: literal `1.02`: "ath.round((rollTot / 0.067) * 1.02);"
- line 397: literal `0.80`: "ollTot < baseNeighborhoodHv * 0.80) {"
- line 399: literal `0.035`: "/ Math.max(rollTot, 25000)) / 0.035));"
- line 411: literal `1.08`: "ketEst = Math.round(rollTot * 1.08);"
- line 417: literal `1.03`: "rketEst = Math.round(mktVal * 1.03);"
- line 464: literal `1000`: "ath.round(rawEstimatedValue / 1000) * 1000;"
- line 464: literal `1000`: "d(rawEstimatedValue / 1000) * 1000;"
- line 485: literal `1000`: "alue * (1 - confMarginPct)) / 1000) * 1000;"
- line 485: literal `1000`: "1 - confMarginPct)) / 1000) * 1000;"
- line 486: literal `1000`: "alue * (1 + confMarginPct)) / 1000) * 1000;"
- line 486: literal `1000`: "1 + confMarginPct)) / 1000) * 1000;"
### `src/engines/propertyValuationEngine.ts`

- line 201: literal `0.95`: "otSqft || rawSqft < lotSqft * 0.95 || rawSqft < 4500)) {"
- line 218: literal `1.165`: "th.round(baseNeighborhoodHv * 1.165);"
- line 240: literal `0.18`: "siteValue / profile.refLot) * 0.18 * excessDecay;"
- line 241: literal `0.22`: "otAdj = Math.max(-siteValue * 0.22, Math.min(siteValue * 0.30, l"
- line 241: literal `0.30`: " * 0.22, Math.min(siteValue * 0.30, lotAdj));"
- line 246: literal `0.025`: ", Math.min(0.20, (beds - 3) * 0.025 + (baths - 2) * 0.035)) * str"
- line 246: literal `0.035`: " - 3) * 0.025 + (baths - 2) * 0.035)) * structVal : 0;"
- line 249: literal `0.003`: ".min(0.25, (effYear - 1980) * 0.003)) * structVal : 0;"
- line 253: literal `0.16`: "ss)) qualityAdj = structVal * 0.16;"
- line 254: literal `0.08`: "ss)) qualityAdj = structVal * 0.08;"
- line 255: literal `0.08`: "s)) qualityAdj = -structVal * 0.08;"
- line 259: literal `0.025`: " "")) ? (baseNeighborhoodHv * 0.025) : 0;"
- line 260: literal `0.035`: " "")) ? (baseNeighborhoodHv * 0.035) : 0;"
- line 263: literal `0.10`: " = hasBasement ? (structVal * 0.10) : 0;"
- line 268: literal `0.08`: ".min(0.24, (unitsCount - 1) * 0.08) * structVal : 0;"
- line 285: literal `2.0`: "rMarketEst = Math.round(sev * 2.0 * 1.04);"
- line 285: literal `1.04`: "tEst = Math.round(sev * 2.0 * 1.04);"
- line 290: literal `1.03`: "MarketEst = Math.round(fVal * 1.03);"
- line 294: literal `1.03`: "rketEst = Math.round(mktVal * 1.03);"
- line 299: literal `1.02`: "arketEst = Math.round(azVal * 1.02);"
- line 304: literal `1.02`: "arketEst = Math.round(waVal * 1.02);"
- line 309: literal `1.02`: "arketEst = Math.round(orVal * 1.02);"
- line 314: literal `1.02`: "arketEst = Math.round(paVal * 1.02);"
- line 318: literal `1.02`: "rketEst = Math.round(mktVal * 1.02);"
- line 323: literal `1.02`: "MarketEst = Math.round(wVal * 1.02);"
- line 328: literal `1.02`: "MarketEst = Math.round(nVal * 1.02);"
- line 332: literal `0.35`: "etEst = Math.round((rollTot / 0.35) * 1.02);"
- line 332: literal `1.02`: "Math.round((rollTot / 0.35) * 1.02);"
- line 336: literal `10.0`: "ketEst = Math.round(rollTot * 10.0 * 1.02);"
- line 336: literal `1.02`: "= Math.round(rollTot * 10.0 * 1.02);"
- line 340: literal `0.40`: "etEst = Math.round((rollTot / 0.40) * 1.02);"
- line 340: literal `1.02`: "Math.round((rollTot / 0.40) * 1.02);"
- line 344: literal `0.35`: "etEst = Math.round((rollTot / 0.35) * 1.02);"
- line 344: literal `1.02`: "Math.round((rollTot / 0.35) * 1.02);"
- line 348: literal `0.25`: "etEst = Math.round((rollTot / 0.25) * 1.02);"
- line 348: literal `1.02`: "Math.round((rollTot / 0.25) * 1.02);"
- line 352: literal `0.067`: "etEst = Math.round((rollTot / 0.067) * 1.02);"
- line 352: literal `1.02`: "ath.round((rollTot / 0.067) * 1.02);"
- line 370: literal `0.80`: "ollTot < baseNeighborhoodHv * 0.80) {"
- line 371: literal `0.035`: "/ Math.max(rollTot, 25000)) / 0.035));"
- line 382: literal `1.08`: "ketEst = Math.round(rollTot * 1.08);"
- line 387: literal `1.03`: "rketEst = Math.round(mktVal * 1.03);"
- line 429: literal `1000`: "ath.round(rawEstimatedValue / 1000) * 1000;"
- line 429: literal `1000`: "d(rawEstimatedValue / 1000) * 1000;"
- line 449: literal `1000`: "alue * (1 - confMarginPct)) / 1000) * 1000;"
- line 449: literal `1000`: "1 - confMarginPct)) / 1000) * 1000;"
- line 450: literal `1000`: "alue * (1 + confMarginPct)) / 1000) * 1000;"
- line 450: literal `1000`: "1 + confMarginPct)) / 1000) * 1000;"
### `src/engines/renovationQuoteEngine.js`

- line 35: literal `2720`: "governingStatute: "Arizona HB 2720 / A.R.S. § 9-467.04 (Casitas "
- line 43: literal `214.909`: "te: "Texas Local Gov't Code § 214.909 / Austin HOME Phase 1 (3 unit"
- line 51: literal `1337`: "erningStatute: "Washington HB 1337 / RCW 36.70A.696 (2 ADUs per "
- line 59: literal `1152`: "rningStatute: "Colorado HB 24-1152 / C.R.S. § 29-35-102 (By-righ"
- line 107: literal `1.20`: "ift = Math.round(marketHigh * 1.20);"
### `src/engines/renovationQuoteEngine.ts`

- line 126: literal `2720`: "governingStatute: "Arizona HB 2720 / A.R.S. § 9-467.04 (Casitas "
- line 134: literal `214.909`: "te: "Texas Local Gov't Code § 214.909 / Austin HOME Phase 1 (3 unit"
- line 142: literal `1337`: "erningStatute: "Washington HB 1337 / RCW 36.70A.696 (2 ADUs per "
- line 150: literal `1152`: "rningStatute: "Colorado HB 24-1152 / C.R.S. § 29-35-102 (By-righ"
- line 205: literal `1.20`: "ift = Math.round(marketHigh * 1.20);"
### `src/engines/residualProfitEngine.js`

- line 22: literal `0.70`: "ilizedNoy = annualGrossRent * 0.70;"
### `src/engines/residualProfitEngine.ts`

- line 54: literal `2.5`: " : input.parcelLotSqft * 2.5;"
- line 55: literal `1.15`: "te.max_units_by_right * 950 * 1.15;"
- line 59: literal `0.45`: "e.affordability_mandate_pct * 0.45;"
- line 61: literal `0.85`: " maxBuildableSqft * 0.85 * input.submarketPricePerSqft"
- line 73: literal `0.15`: "t.existingStructureValueUsd * 0.15;"
### `src/engines/roofAreaEngine.js`

- line 87: literal `12.0`: "erhangFeet = overhangInches / 12.0;"
- line 89: literal `1.4`: "th.sqrt(groundFootprintSqft / 1.4);"
- line 90: literal `1.4`: " approxLength = approxWidth * 1.4;"
- line 101: literal `12.0`: "leRad = Math.atan(pitchRise / 12.0);"
- line 103: literal `12.0`: "44 + pitchRise * pitchRise) / 12.0).toFixed(4));"
- line 114: literal `100.0`: "res = Number((grossRoofSqft / 100.0).toFixed(1));"
- line 129: literal `19.5`: " Math.floor(usableSolarSqft / 19.5));"
- line 130: literal `1000.0`: "ber(((maxSolarPanels * 410) / 1000.0).toFixed(1));"
- line 153: literal `1100`: ": Math.round(roofingSquares * 1100),"
- line 154: literal `1480`: ": Math.round(roofingSquares * 1480),"
- line 164: literal `1250`: ": Math.round(roofingSquares * 1250),"
- line 165: literal `1750`: ": Math.round(roofingSquares * 1750),"
### `src/engines/roofAreaEngine.ts`

- line 139: literal `12.0`: "erhangFeet = overhangInches / 12.0;"
- line 142: literal `1.4`: "th.sqrt(groundFootprintSqft / 1.4);"
- line 143: literal `1.4`: " approxLength = approxWidth * 1.4;"
- line 154: literal `12.0`: "leRad = Math.atan(pitchRise / 12.0);"
- line 156: literal `12.0`: "44 + pitchRise * pitchRise) / 12.0).toFixed(4));"
- line 167: literal `100.0`: "res = Number((grossRoofSqft / 100.0).toFixed(1));"
- line 184: literal `19.5`: " Math.floor(usableSolarSqft / 19.5));"
- line 185: literal `1000.0`: "ber(((maxSolarPanels * 410) / 1000.0).toFixed(1));"
- line 209: literal `1100`: ": Math.round(roofingSquares * 1100),"
- line 210: literal `1480`: ": Math.round(roofingSquares * 1480),"
- line 220: literal `1250`: ": Math.round(roofingSquares * 1250),"
- line 221: literal `1750`: ": Math.round(roofingSquares * 1750),"
### `src/engines/solarMicrogridEngine.js`

- line 20: literal `18.5`: "mSizeDcKw = (usableRoofSqft * 18.5) / 1000;"
- line 20: literal `1000`: "w = (usableRoofSqft * 18.5) / 1000;"
- line 22: literal `1000`: " systemSizeDcKw * 1000 * input.localInstallCostPerWa"
- line 55: literal `0.5`: "nput.retailImportRateUsdKwh * 0.5;"
### `src/engines/solarMicrogridEngine.ts`

- line 29: literal `18.5`: "mSizeDcKw = (usableRoofSqft * 18.5) / 1000;"
- line 29: literal `1000`: "w = (usableRoofSqft * 18.5) / 1000;"
- line 31: literal `1000`: " systemSizeDcKw * 1000 * input.localInstallCostPerWa"
- line 64: literal `0.5`: "nput.retailImportRateUsdKwh * 0.5;"
### `src/engines/streetForgeEngine.js`

- line 22: literal `1000`: "th.min(65, Math.round((aadt / 1000) * 2.8)) : 12;"
- line 22: literal `2.8`: "5, Math.round((aadt / 1000) * 2.8)) : 12;"
- line 26: literal `2.5`: " = Math.round(newBikeRiders * 2.5 * 0.7);"
- line 26: literal `0.7`: "h.round(newBikeRiders * 2.5 * 0.7);"
- line 28: literal `0.000404`: "ath.round((annualVmtReduced * 0.000404) * 10) / 10;"
- line 29: literal `0.00078`: "Math.round(annualVmtReduced * 0.00078 * 10) / 10;"
- line 33: literal `1.8`: "Crashes = Math.round((miles * 1.8 * (crashReductionPct / 100)) "
- line 34: literal `145000`: "= Math.round(avoidedCrashes * 145000);"
- line 38: literal `350000`: "ain = Math.round(businesses * 350000 * (salesLiftPct / 100) * 0.02"
- line 38: literal `0.02`: "0000 * (salesLiftPct / 100) * 0.02);"
- line 62: literal `0.005`: " Math.round(delaySec * aadt * 0.005 * 250)"
- line 105: literal `1.5`: "ters > 80 ? transformerBase * 1.5 : transformerBase;"
- line 106: literal `0.12`: "ilTotal + transformerTotal) * 0.12);"
- line 113: literal `0.65`: "rant = Math.round(grossCost * 0.65);"
- line 117: literal `100000`: " sec30cCredit = Math.min(100000 * ports, Math.round(eligibleA"
- line 117: literal `0.30`: ", Math.round(eligibleAmount * 0.30));"
- line 120: literal `0.85`: "ntives = Math.min(grossCost * 0.85, neviGrant + sec30cCredit);"
- line 123: literal `4.2`: "Sessions = Math.round(ports * 4.2);"
- line 129: literal `0.21`: "Cost = Math.round(annualKwh * 0.21);"
- line 130: literal `1800`: "t networkAndOpex = Math.round(1800 * ports);"
### `src/engines/streetForgeEngine.ts`

- line 123: literal `1000`: "th.min(65, Math.round((aadt / 1000) * 2.8)) : 12;"
- line 123: literal `2.8`: "5, Math.round((aadt / 1000) * 2.8)) : 12;"
- line 128: literal `2.5`: " = Math.round(newBikeRiders * 2.5 * 0.7);"
- line 128: literal `0.7`: "h.round(newBikeRiders * 2.5 * 0.7);"
- line 130: literal `0.000404`: "ath.round((annualVmtReduced * 0.000404) * 10) / 10;"
- line 131: literal `0.00078`: "Math.round(annualVmtReduced * 0.00078 * 10) / 10;"
- line 136: literal `1.8`: "Crashes = Math.round((miles * 1.8 * (crashReductionPct / 100)) "
- line 142: literal `0.02`: "_000 * (salesLiftPct / 100) * 0.02);"
- line 167: literal `0.005`: " Math.round(delaySec * aadt * 0.005 * 250)"
- line 216: literal `1.5`: "ters > 80 ? transformerBase * 1.5 : transformerBase;"
- line 217: literal `0.12`: "ilTotal + transformerTotal) * 0.12);"
- line 227: literal `0.65`: "rant = Math.round(grossCost * 0.65);"
- line 231: literal `0.30`: ", Math.round(eligibleAmount * 0.30));"
- line 234: literal `0.85`: "ntives = Math.min(grossCost * 0.85, neviGrant + sec30cCredit);"
- line 238: literal `4.2`: "Sessions = Math.round(ports * 4.2);"
- line 245: literal `0.21`: "Cost = Math.round(annualKwh * 0.21);"
- line 246: literal `1800`: "t networkAndOpex = Math.round(1800 * ports);"
### `src/engines/transitCorridorOpportunityEngine.js`

- line 36: literal `43560`: "tion.avg_land_cost_per_sqft * 43560);"
- line 43: literal `0.85`: ".median_home_value_walkshed * 0.85);"
- line 47: literal `220000`: "Cost = Math.round(bikeMiles * 220000);"
- line 74: literal `0.70`: "t: Math.round(capitalBudget * 0.70),"
- line 84: literal `0.20`: "t: Math.round(capitalBudget * 0.20),"
- line 94: literal `0.10`: "t: Math.round(capitalBudget * 0.10),"
- line 118: literal `0.65`: "t: Math.round(capitalBudget * 0.65),"
- line 122: literal `2720`: "tes (e.g. Austin HOME / AZ HB 2720 / CA SB 9).""
- line 128: literal `0.25`: "t: Math.round(capitalBudget * 0.25),"
- line 138: literal `0.10`: "t: Math.round(capitalBudget * 0.10),"
- line 162: literal `0.50`: "t: Math.round(capitalBudget * 0.50),"
- line 172: literal `0.35`: "t: Math.round(capitalBudget * 0.35),"
- line 182: literal `0.15`: "t: Math.round(capitalBudget * 0.15),"
### `src/engines/transitCorridorOpportunityEngine.ts`

- line 149: literal `43560`: "tion.avg_land_cost_per_sqft * 43560);"
- line 160: literal `0.85`: ".median_home_value_walkshed * 0.85);"
- line 201: literal `0.70`: "t: Math.round(capitalBudget * 0.70),"
- line 211: literal `0.20`: "t: Math.round(capitalBudget * 0.20),"
- line 221: literal `0.10`: "t: Math.round(capitalBudget * 0.10),"
- line 246: literal `0.65`: "t: Math.round(capitalBudget * 0.65),"
- line 250: literal `2720`: "tes (e.g. Austin HOME / AZ HB 2720 / CA SB 9).""
- line 256: literal `0.25`: "t: Math.round(capitalBudget * 0.25),"
- line 266: literal `0.10`: "t: Math.round(capitalBudget * 0.10),"
- line 291: literal `0.50`: "t: Math.round(capitalBudget * 0.50),"
- line 301: literal `0.35`: "t: Math.round(capitalBudget * 0.35),"
- line 311: literal `0.15`: "t: Math.round(capitalBudget * 0.15),"
### `src/engines/underusedLandEngine.js`

- line 182: literal `1609.34`: "((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;"
- line 213: literal `1000`: ".round((margin / totalCost) * 1000) / 10 : null,"
- line 225: literal `1609.34`: "((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;"
### `src/engines/underusedLandEngine.ts`

- line 362: literal `1609.34`: "((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;"
- line 393: literal `1000`: ".round((margin / totalCost) * 1000) / 10 : null,"
- line 411: literal `1609.34`: "((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;"
### `src/engines/valuationBacktestEngine.js`

- line 83: literal `10000`: " Math.round(percentageError * 10000) / 10000,"
- line 83: literal `10000`: "nd(percentageError * 10000) / 10000,"
- line 84: literal `10000`: "th.round(absPercentageError * 10000) / 10000,"
- line 84: literal `10000`: "absPercentageError * 10000) / 10000,"
- line 96: literal `10000`: "ath.round(median(absErrors) * 10000) / 10000;"
- line 96: literal `10000`: "(median(absErrors) * 10000) / 10000;"
- line 97: literal `10000`: " sum + v, 0) / sampleCount) * 10000) / 10000;"
- line 97: literal `10000`: " 0) / sampleCount) * 10000) / 10000;"
- line 98: literal `10000`: ".round(median(signedErrors) * 10000) / 10000;"
- line 98: literal `10000`: "dian(signedErrors) * 10000) / 10000;"
- line 104: literal `1000`: "within5Count / sampleCount) * 1000) / 1000;"
- line 104: literal `1000`: "ount / sampleCount) * 1000) / 1000;"
- line 105: literal `1000`: "ithin10Count / sampleCount) * 1000) / 1000;"
- line 105: literal `1000`: "ount / sampleCount) * 1000) / 1000;"
- line 106: literal `1000`: "ithin20Count / sampleCount) * 1000) / 1000;"
- line 106: literal `1000`: "ount / sampleCount) * 1000) / 1000;"
- line 122: literal `10000`: "round(median(bandAbsErrors) * 10000) / 10000 : 0,"
- line 122: literal `10000`: "ian(bandAbsErrors) * 10000) / 10000 : 0,"
- line 123: literal `1000`: "10Count / bandEvals.length) * 1000) / 1000 : 0"
- line 123: literal `1000`: "/ bandEvals.length) * 1000) / 1000 : 0"
- line 130: literal `1.25`: ".min(0.18, Math.round(mdape * 1.25 * 1000) / 1000));"
- line 130: literal `1000`: "18, Math.round(mdape * 1.25 * 1000) / 1000));"
- line 130: literal `1000`: ".round(mdape * 1.25 * 1000) / 1000));"
### `src/engines/valuationBacktestEngine.ts`

- line 131: literal `10000`: "(v: number) => Math.round(v * 10000) / 10000;"
- line 131: literal `10000`: "r) => Math.round(v * 10000) / 10000;"
- line 132: literal `1000`: "(v: number) => Math.round(v * 1000) / 1000;"
- line 132: literal `1000`: "er) => Math.round(v * 1000) / 1000;"
- line 262: literal `86400000`: "e(t) || saleT - t < minDays * 86400000) continue;"

## B3. Data loads in `app/app.js`

The data-file id map is `CP_DATA_FILES` (`app/app.js:6-15`). The loader fetches `app/data/<file>` through `cpText`/`cpJson` (`app/app.js:17-30`). Consumers, grouped by data file:

| data file | id | consumers (app/app.js line) |
|---|---|---|
| `app/data/research.json` | `research` | 68-69 (loadVerifiedDataFiles), 9075 (research modal) |
| `app/data/case_studies.json` | `case-studies` | 70 (loadVerifiedDataFiles), 8901 |
| `app/data/transit_pipelines.json` | `transit-pipelines` | 71, 7929 (cpTextNow) |
| `app/data/statutes.json` | `statutes` | 72 |
| `app/data/funding_programs.json` | `funding-programs` | 73 |
| `app/data/state_finance_profiles.json` | `state-finance-profiles` | 74-78 |
| `app/data/unit_costs.json` | `unit-costs` | 79 |
| `app/data/hud_fair_market_rents.json` | `hud-fmr` | 80 |
| `app/data/valuation_backtest_benchmarks.json` | `valuation-benchmarks` | 81 |
| `app/data/underused_sites.json` | `underused-sites` | 82 |
| `app/data/intercity_transit_corridors.json` | `intercity-corridors` | 83 |
| `app/data/county_completeness.json` | `county-completeness` | 84-91 |
| `app/data/ca_counties_registry.json` | `ca-counties-registry` | 92-98 |
| `app/data/details-la.json (6.7 MB)` | `details-chunks` | 2689, 2694 (LA bundle, with bundle-la) |
| `app/data/overlays-la.json (5.1 MB)` | `overlay-chunks` | 2658-2661, 11227 |
| `app/data/la-crash-counts.json` | `la-crash-counts` | 4097-4099, 11227 |
| `app/data/sites-la.b64.txt` | `sites-data` | 3796-3798 |
| `app/data/bundle-la.b64.txt` | `bundle` | 2689-2691, 2690 (error text) |
| `app/data/bundle-oc.b64.txt` | `bundle-oc` | 10826-10829 |

Other loads in the same file that are not in `app/data/`: county bundles fetched by `fetchJSON` (`app/app.js:10409-10416`, called at 10506 and 10545, using `data-src` / `data-sites` attributes in `index.html` and the inline `counties/` path); the hosted fallback `https://milessilverman.github.io/city-pretty/` (`app/app.js:10416`); a `data:` URI decode of base64 (`app/app.js:2623`).

Raw grep matches for the B3 patterns (all lines, for completeness):

- line 4: // Data files. LA and Orange County data used to be pasted into index.html (30 MB); it now lives in app/data/ and is
- line 5: // fetched when needed. cpText(id) returns a promise of the file's text (cached); cpTextNow(id) returns it only if loaded.
- line 6: const CP_DATA_FILES = {
- line 7: "bundle": "bundle-la.b64.txt", "details-chunks": "details-la.json", "overlay-chunks": "overlays-la.json",
- line 8: "sites-data": "sites-la.b64.txt", "la-crash-counts": "la-crash-counts.json", "bundle-oc": "bundle-oc.b64.txt",
- line 9: "research": "research.json", "statutes": "statutes.json", "state-housing-laws": "state-housing-laws.json",
- line 10: "funding-programs": "funding_programs.json", "case-studies": "case_studies.json", "transit-pipelines": "transit_pipelines.json",
- line 11: "state-finance-profiles": "state_finance_profiles.json", "unit-costs": "unit_costs.json", "hud-fmr": "hud_fair_market_rents.json",
- line 12: "valuation-benchmarks": "valuation_backtest_benchmarks.json", "underused-sites": "underused_sites.json",
- line 13: "intercity-corridors": "intercity_transit_corridors.json", "county-completeness": "county_completeness.json",
- line 14: "ca-counties-registry": "ca_counties_registry.json"
- line 17: function cpText(id) {
- line 20: rec.promise = fetch("app/data/" + CP_DATA_FILES[id])
- line 27: function cpJson(id) {
- line 28: return cpText(id).then(t => {
- line 32: function cpTextNow(id) { return _cpData[id] ? _cpData[id].value : null; }
- line 69: cpJson("research").then(d => { if (Array.isArray(d)) RESEARCH_CORPUS_500 = d; });
- line 70: cpJson("case-studies").then(d => { if (Array.isArray(d)) HISTORICAL_TRENDS_DATA = d; });
- line 71: cpJson("transit-pipelines").then(d => { if (Array.isArray(d)) TRANSIT_PIPELINES_DATA = d; });
- line 72: cpJson("statutes").then(d => { if (Array.isArray(d)) STATE_HOUSING_LAWS_DATA = d; });
- line 73: cpJson("funding-programs").then(d => { if (Array.isArray(d)) FUNDING_PROGRAMS_DATA = d; });
- line 74: cpJson("state-finance-profiles").then(d => {
- line 79: cpJson("unit-costs").then(d => { if (Array.isArray(d)) UNIT_COSTS_DATA = d; });
- line 80: cpJson("hud-fmr").then(d => { if (Array.isArray(d)) HUD_FMR_DATA = d; });
- line 81: cpJson("valuation-benchmarks").then(d => { if (d && typeof d === "object") VALUATION_BACKTEST_BENCHMARKS = d; });
- line 82: cpJson("underused-sites").then(d => { if (Array.isArray(d)) UNDERUSED_SITES_DATA = d; });
- line 83: cpJson("intercity-corridors").then(d => { if (Array.isArray(d)) INTERCITY_CORRIDORS_DATA = d; });
- line 84: cpJson("county-completeness").then(d => {
- line 92: cpJson("ca-counties-registry").then(d => {
- line 111: // Verified 52-state assessment & finance profiles loaded via app/data/state_finance_profiles.json
- line 112: // Multi-county data loaded dynamically from app/data/county_completeness.json and ca_counties_registry.json
- line 2658: const s = cpTextNow("overlay-chunks");
- line 2659: if (s === null) { cpText("overlay-chunks"); return null; } // still downloading: callers fall back to live queries
- line 2689: const [bundleText, detailsText] = await Promise.all([cpText("bundle"), cpText("details-chunks")]);
- line 2690: if (!bundleText) throw new Error("Could not download the Los Angeles County data (app/data/" + CP_DATA_FILES.bundle + ")");
- line 3796: _sitesLoading = cpText("sites-data").then(t => {
- line 4097: const t = cpTextNow("la-crash-counts");
- line 4098: if (t === null) cpText("la-crash-counts"); // still downloading; counts show on the next render
- line 4157: permits: "https://data.lacity.org/resource/pi9x-tg5x.json", // LADBS permits 2020-present (ADU/JADU fields)
- line 4158: permitsOld: "https://data.lacity.org/resource/d9aa-v8bm.json", // LADBS building permits (of_stories)
- line 4213: const d = await r.json();
- line 4229: if (!r.ok) throw new Error("HTTP " + r.status); return r.json();
- line 4537: const d = await r.json();
- line 6375: const d = await r.json();
- line 6394: const data = await r.json();
- line 6431: const a = (await r.json())[0];
- line 6634: const data = await r.json();
- line 6758: d = await (await fetch(q)).json();
- line 7072: const d = await (await fetch(lotQuery(svc, lon - 0.0004, lat - 0.0004, lon + 0.0004, lat + 0.0004))).json();
- line 7082: const d2 = await (await fetch(q2)).json(); byAddr = (d2.features || []).find(g => g.geometry && g.geometry.rings) || null;
- line 7929: const raw = cpTextNow("transit-pipelines");
- line 8891: // (app/data/research.json and app/data/case_studies.json) via loadVerifiedDataFiles() / cpJson().
- line 8901: cpJson("case-studies").then(d => {
- line 9075: cpJson("research").then(d => {
- line 9278: const j = r.ok ? await r.json().catch(() => ({})) : {};
- line 9493: const data = await res.json().catch(() => null);
- line 10409: async function fetchJSON(url) { // hosted county file: JSON, or gzip-compressed JSON (.json.gz) that the server sent as it is
- line 10506: B = el.dataset.src ? await fetchJSON(el.dataset.src) : el.textContent.trim() ? await unpackGzipB64(el.textContent.trim()) : null;
- line 10545: const S = await fetchJSON(el.dataset.sites);
- line 10826: const b64Text = await cpText("bundle-oc");
- line 11227: cpText("la-crash-counts"); setTimeout(() => cpText("overlay-chunks"), 800); // small/background downloads after first paint

## B4. Claims in the three docs

Matches "VERIFIED", "COMPLETED", "100%", "BACK-TESTED" (case-insensitive, so lower-case "verified" and "back-tested" are included and marked). Only the line is quoted; the table row is the whole line.

### `README.md` (3 lines)

- `README.md:9` > - **Purged & Verified:** All 488 generated filler studies have been removed. 52 empirical peer-reviewed studies with confirmed DOIs/URLs have been verified. 52 state property assessment statutes, 9 state middle housing laws, 4 municipal funding programs, and 32 DOT bid item unit costs are now verified against primary government sources. All ~52 hardcoded fallback numbers have been replaced with…
- `README.md:10` > - **Still Unverified / Estimated:** County-level hedonic ROI spreads, preliminary transit corridors without adopted agency capital budgets, and parcels in jurisdictions lacking live GIS zoning feeds are unverified estimates or incomplete.
- `README.md:11` > - **Operational Guidance:** Do NOT deploy investment capital or make legal zoning commitments based on unverified screening metrics. See ['docs/DATA-AUDIT-AND-TRANSPARENCY.md'](docs/DATA-AUDIT-AND-TRANSPARENCY.md) for full component-by-component audit scores and ['docs/GRAND-VISION-AND-ECOSYSTEM.md'](docs/GRAND-VISION-AND-ECOSYSTEM.md) for the ecosystem architecture (City Pretty + StreetForge +…

### `docs/DATA-AUDIT-AND-TRANSPARENCY.md` (15 lines)

- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:13` This document discloses what was found, what has been repaired, what remains unverified or estimated, and the strict rules governing all future data engineering.
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:21` | **Research Study Library** | 488 of 540 "studies" in 'RESEARCH_CORPUS_500' were generated filler (e.g. *"Education Economics & Public Finance Consortium #24"*, *"Study #14"*) without DOIs, publication URLs, or verifiable peer-reviewed text. | **FAILED AUDIT (90% Hallucinated)** | Purged all 488 filler entries. Sourced and verified 52 authentic empirical studies with DOIs and direct URLs in ['ap…
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:25` | **State Assessment Rules** | 885 lines of state finance constants were hardcoded inline in 'app/app.js' without statutory citations or state revenue department URLs. | **FAILED AUDIT (Unverified Constants)** | Decoupled into ['app/data/state_finance_profiles.json'](../app/data/state_finance_profiles.json) with verified assessment statutes and legislative URLs for all 50 states + DC + PR. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:34` | Subsystem | Underlying Files | Current Status | % Verified | Primary Public Source | Known Gaps / Limitations |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:36` | **Research Study Library** | 'app/data/research.json' | **VERIFIED** | 100% (52/52) | Peer-reviewed journals, NBER, TRB, USDA | Limited to 52 studies; expanding to 200+ ongoing. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:37` | **State Housing Laws** | 'app/data/statutes.json' | **VERIFIED** | 100% (11/11) | State legislature legislative portals | Covers CA, TX (including Austin HOME), FL, WA, OR, AZ; other states in development. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:38` | **Municipal Funding Programs** | 'app/data/funding_programs.json' | **VERIFIED** | 100% (4/4) | LA County SCW, LA City Prop K, CalEPA, CAL FIRE | Currently covers CA jurisdictions; expanding nationally. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:39` | **State Finance Profiles** | 'app/data/state_finance_profiles.json' | **VERIFIED** | 100% (52/52) | State Revenue Codes, Statutes, Constitutions | General state rules; county-specific millage requires local lookups. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:41` | **HUD Fair Market Rents (FMR)** | 'app/data/hud_fair_market_rents.json' | **VERIFIED** | 100% (10 metros) | HUD User FY2026 SAFMR Dataset | Official FY2026 1BR/2BR benchmarks; unrecorded metros state 'Not on file'. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:42` | **FTA Transit Corridors** | 'app/data/transit_pipelines.json' | **VERIFIED** | 100% of kept | FTA CIG Profiles, Regional Transit Authorities | Unadopted financing metrics strictly omitted ('null'). |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:43` | **Underused Land Inventory** | 'app/data/underused_sites.json' | **VERIFIED** | 100% (90 sites) | County Assessor & SCAG GIS Parcels | Curated golf courses, parking lots, and vacant parcels with verified acreage, transit distance, and zoning. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:44` | **Automated Valuation Model (AVM)** | 'propertyValuationEngine.ts', 'valuationBacktestEngine.ts' | **BACK-TESTED** | Benchmark validated | County recorder sales (LA, King, Cook, Harris, Hillsborough) | Screened against arm's-length recorder sales; strictly withheld when MdAPE exceeds 14.0%. |
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:54` 1. **Never Invent Numbers:** If an assessor value, lot size, construction price, or population count is not verified in an authoritative record, pass 'null'. The user interface must say *"Not on file"* or *"Not recorded"*.
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:56` 3. **Every Sourced Item Requires an Audit Trail:** Every row in a data table must contain 'source', 'source_url', 'retrieved', and 'last_verified' dates.
- `docs/DATA-AUDIT-AND-TRANSPARENCY.md:57` 4. **Transparent Mistakes:** If an AI agent or contributor generates or discovers unverified data, it must be flagged immediately in the documentation, never hidden behind optimistic marketing language.

### `docs/GRAND-VISION-AND-ECOSYSTEM.md` (4 lines)

- `docs/GRAND-VISION-AND-ECOSYSTEM.md:92` | **HUD Fair Market Rents (SAFMR)** | HUD User REST API | ZIP code-level 40th and 50th percentile rent by bedroom count (0–4 BR) | Empirical baseline for rental pro-formas and EverySpace holding income without unverified rent heuristics. |
- `docs/GRAND-VISION-AND-ECOSYSTEM.md:116` P0["P0: Sourced Data\n(Purge Filler & Fallbacks)\n✅ COMPLETED"]
- `docs/GRAND-VISION-AND-ECOSYSTEM.md:117` P1["P1: Core Reality\n(Zoning Safety, State Law)\n✅ COMPLETED"]
- `docs/GRAND-VISION-AND-ECOSYSTEM.md:127` - Maintain 100% test pass rate ('npm run check') with zero hallucinated figures.

