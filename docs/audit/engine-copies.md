# Engine copies: what the page runs vs. what the tests test (17 Nov 2026)

The page (`index.html`) loads only `app/vendor/*.js` and `app/app.js`; no file under `src/` is loaded by the page.
`app/app.js` carries its own inlined copy of each engine it uses. The unit tests import `src/engines/<name>` and
`src/adapters/<name>` without an extension, which Vitest resolves to the `.js` file before the `.ts` one. So until
today the tests checked the `src/*.js` copies, the page ran the `app.js` copies, and the `src/*.ts` copies ran nowhere.

`scripts/check_engine_copies.mjs` compares every top-level function and constant in `src/engines/*.js` and
`src/adapters/*.js` with the same name in `app/app.js`; `tests/unit/engineCopies.test.ts` fails if any shared one
differs (only the three bindings that load another engine, `_estVal`, `_valVintage`, `_evalHousing`, may differ:
`require` in Node, a page global in the browser).

## Copy map (before this change)

| Engine | app.js inline | src .js | src .ts | Page runs | Imported by |
|---|---|---|---|---|---|
| statutoryZoningEngine | statuteFieldUnconfirmed, statuteField, statuteAppliesTo, evaluateByRightHousing, 2 constants | yes | yes (drifted, 222 vs 197 lines) | app.js | audit, stateLaws50, localOrdinances tests; parcelHouseAuditor.js |
| roofAreaEngine | getDefaultPitchRise, estimateAccurateRoofArea | yes | yes | app.js | safetyRules test; parcelHouseAuditor.js |
| propertyValuationEngine | estimatePropertyMarketValue, 3 constants | yes | yes | app.js | parcelHouseAuditor test; parcelHouseAuditor.js; valuationBacktestEngine.js |
| parcelHouseAuditor | auditSingleHouseParcel, calculatePermitCapitalization, calculateCalibratedTreeEconomics | yes | yes | app.js | parcelHouseAuditor, safetyRules tests; src/ui/houseInspectorPanel.ts (type only) |
| lidarStreetViewValidator | validateParcelImageryVintage | yes | yes | app.js (via the auditor) | parcelHouseAuditor.js |
| solarMicrogridEngine | calculateSolarMicrogridRoi, STATE_SOLAR_CREDITS | yes | yes | defined, never called | audit test |
| hedonicCapitalizationEngine | computeSubAdditivePackage | yes | yes | defined, no longer called | audit test |
| gtfsWalkshedEngine | evaluateTransitWalkshed | yes | yes | defined, never called | nothing |
| arcgisNormalizer (adapter) | normalizeArcGisFeature, FIELD_ALIASES | yes | yes | defined, never called | audit test |
| municipalFinanceEngine | FINANCE_CALC_FIELDS only (the page's tax-increment calculator is its own code) | yes | yes | app.js's own calculator | audit, financeProfiles tests |
| underusedLandEngine | none | yes | yes | not used | nothing |
| valuationBacktestEngine | none | yes | yes | not used | nothing |

## Behavioral differences between the page's copy and the tested copy

Every function and constant was compared; these four differed. All others were identical.

1. **Roof engine (`estimateAccurateRoofArea`, `getDefaultPitchRise`): the page invented inputs. Page fixed.**
   Commit ff6b849 (14 Nov, "eliminate ... fallback numbers ... without inventing assumptions for unrecorded attributes")
   changed `src/engines/roofAreaEngine.js` and `.ts` only. The page's copy kept both fallbacks:
   - a house with no recorded living area and no building outline over 200 sq ft was treated as **1,600 sq ft**, so the
     roof drawer showed a roof area, roofing squares and pitch for a house nothing was known about (the drawer is built
     for every house panel);
   - an unknown build year was treated as **1975**, which selects the 1945-78 "ranch" pitch (4.5:12) for every house
     without a recorded year outside snow and desert states.
   The page now runs the tested code: nothing recorded gives no estimate (the drawer says "Living area not on file" and
   its pitch buttons do nothing), and an unknown year uses the no-era default. One more change comes with it: the
   no-era default pitch is 5.5:12 in the tested copy and was 6.0:12 on the page; neither value has a source (both are
   the engine's own assumptions, as are all its pitch values), and the page now uses 5.5 with the rest of the tested
   code. Roof areas for houses built after 1978 or with no recorded year therefore change slightly.
   Tests: `tests/e2e/site.spec.ts` "roof estimate: nothing recorded gives no estimate..." and the copy test.
2. **Valuation engine (`estimatePropertyMarketValue`): the tested copy had an LA early return the page never had.
   Tested copy aligned with the page.** The tested copy returned "withheld" for Los Angeles inside the engine, quoting
   an old 18.8% back-test error. The page withholds LA's generic estimate in `publishValuation` instead (LA shows only
   its own tested model; covered by e2e), and the page's copy also returns `assessorMethodName`. Adopting the tested
   copy on the page would have blanked inputs that `publishLaValuation` reads (living area, so no $/sq ft), so the
   page's version is now in `src/` and the stale LA text is gone. No user-visible change.
3. **House auditor (`auditSingleHouseParcel`): the page's copy is newer. Tested copy aligned with the page.** The page's
   copy passes the value through `publishValuation` when it exists and has the newer disclaimer ("Unless a back-test
   result is shown with it..."); the tested copy had neither and passed `countyFips` to reach the LA early return above.
   The Node module now defines the same helper names, so the function text is identical. Unit test "2b" had checked the
   LA early return, which never ran on the page; it now checks that the auditor applies a `publishValuation` gate when
   one is defined (the real gate is covered by e2e). No user-visible change.
4. **Statutory zoning engine: identical** after a70a49b (the city-ordinance fix was applied to all three copies); the
   `.ts` copy had drifted in other ways and ran nowhere.

## What was removed

All `src/engines/*.ts` and `src/adapters/*.ts` copies (12 files). Nothing ran them: the page doesn't load `src/`, the
tests resolve to `.js`, and only other `.ts` files imported them (for types; no type check covers `src/`).
`src/types/index.ts` and `src/ui/*` are untouched; `src/ui/houseInspectorPanel.ts` imports a type from
`../engines/parcelHouseAuditor`, which now resolves to the `.js` file (no type check runs on it).

## Not done

The page still carries its own copies (the preferred end state, one module loaded by both the page and the tests, needs
`app.js`'s globals untangled). Instead the copy test fails on any difference. Functions that exist only in `app.js`
(most of the page) are not covered by these engine tests; e2e covers them.
