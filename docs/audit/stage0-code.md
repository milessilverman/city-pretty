# Stage 0 code map (read-only, 24 Nov 2026)
## 1. Runtime modules
| item | status | evidence | keep / modify / replace |
|---|---|---|---|
| index.html: page shell, script order, fonts, county data tags | implemented | index.html:11-13, 472-473, 1263-1268 | keep |
| app/app.js: map, parcel, valuation, zoning, house UI, 11,339 lines | implemented | app/app.js:2030, 1133, 1201-1211 | modify (split) |
| app/config.js: Worker base URL, empty string disables advisor | implemented | app/config.js:8 | keep |
| app/explore.js: plain-language ideas and neighborhood explorer | implemented | app/explore.js:118, 148, 478 | keep |
| app/invest.js: investment panel, reads engine global | implemented | app/invest.js:24, 220 | keep |
| app/facts.js: live public-records panel as ES module | implemented | index.html:1268; tests/unit/facts.test.ts:6 | keep |
| app/app.css: all page styling, 1,670 lines | implemented | index.html:13 | keep |
| src/engines/investmentDecisionEngine.js: ranking, recommendations, window global | implemented | index.html:1266; src/engines/investmentDecisionEngine.js:184, 326, 453, 781 | keep |
| src/engines, 10 other files: Node copies; page runs inlined app.js copies | partial | app/app.js:1201-1211; docs/audit/engine-copies.md:3 | modify (dedupe) |
| gtfsWalkshed, solarMicrogrid, hedonicCapitalization, valuationBacktest engines: not used on page | unsupported | docs/audit/engine-copies.md (copy map table) | replace or delete |
| src/adapters/arcgisNormalizer.js: ArcGIS field mapping, tests only | unsupported | docs/audit/engine-copies.md (copy map table) | modify |
| src/ai/advisorGroundingContract.ts: advisor prompt, context sanitiser, user message | implemented | src/ai/advisorGroundingContract.ts:115, 131, 255 | keep |
| workers/api-proxy.ts: Worker router for health, advisor, Street View, facts | implemented | workers/api-proxy.ts:186, 193, 208-210; MODEL_CALL_IMPLEMENTED :36 | keep |
| workers/advisorAgent.ts: Claude tool loop with sourced lookups | implemented | workers/advisorAgent.ts:28, 42, 303 | keep |
| workers/localData.ts: bundled JSON lookups for advisor tools | implemented | workers/localData.ts:8-16, 175 | keep |
| workers/sources.ts: live public-source fetchers (Census, HUD, USGS, FEMA) | implemented | workers/sources.ts:74, 172, 245, 295, 316 | keep |
| workers/parcels.ts: county parcel-service lookup | implemented | workers/parcels.ts:18, 26 | keep |
| AI advisor page client: status, context serialise, send | implemented | app/app.js:9168, 9195, 9208, 9341 | keep |
## 2. Module dependency facts
| fact | status | evidence | keep / modify / replace |
|---|---|---|---|
| Load order: leaflet, fflate, config, app, explore, engine, invest, facts (module) | implemented | index.html:472-473, 1263-1268 | keep |
| County JSON tags name counties/bundle files; app fetches them, with a hard-coded origin fallback | implemented | index.html:475; app/app.js:10120-10127 | modify |
| Engines reach the page two ways: script tag, or inlined copy in app.js | partial | index.html:1266; app/app.js:1201-1211 | modify |
| Ranking and recommendations live in investmentDecisionEngine (rankNeighborhoods, recommendForParcel) | implemented | src/engines/investmentDecisionEngine.js:184, 326, 453; app/invest.js:220 | keep |
| Page gating of recommendations: ivAllows, gateRecs, ivScanLA, recCard, rankedRecs | implemented | app/app.js:2120, 2154, 2209, 3775; app/explore.js:148 | modify (move to module) |
| Valuation and house screening inlined in app.js (zoning rule, estimate, publish gate, auditor) | implemented | app/app.js:332, 436, 815, 1254 | modify |
| Worker imports app/data JSON at build time | implemented | workers/localData.ts:8-16; workers/parcels.ts:8; workers/sources.ts:221 | modify |
| Worker imports the page's grounding contract | implemented | workers/api-proxy.ts:14 | keep |
| Drift guard for inlined copies | partial | scripts/check_engine_copies.mjs:1; tests/unit/engineCopies.test.ts:5-8 | keep |
| Engine doc says page loads no src file; index.html loads one, and underusedLandEngine is listed but absent | partial | docs/audit/engine-copies.md:3; index.html:1266 | modify (doc correction) |
## 3. Pipeline and scripts by purpose
| group | status | evidence | keep / modify / replace |
|---|---|---|---|
| Orange County pipeline, 13 modules: fetch, metrics, layers, engine, bundle | implemented | pipeline/build_oc.py:1; pipeline/engine.py:1 | keep |
| Publish and hosting: export bundle, split hosting, R2 upload with storage guard | implemented | scripts/r2_sync_counties.py:2; scripts/export_county_bundle.py:2; scripts/split_county_hosting.py:2 | keep |
| Source health: link checks, probes, live API smoke tests | implemented | scripts/check_sources.py:2; scripts/probe_sources_runner.py:2; scripts/smoke_sources.mts:1 | keep |
| Live checks on the real page and local server | implemented | scripts/serve.mjs:1; live_check_*.mjs and check_fixed_parcels: not verified | keep |
| Valuation and backtest builders: county and LA models, backtests/, scripts/lib | partial | scripts/county_valuation_models.mjs, scripts/lib/countyValuationModels.mjs: not verified | keep |
| Data build and fetch: build_*.py, fetch_*.py (transit, crashes, tree equity, HUD, FHFA) | implemented | not verified (listing only) | keep |
| One-off data rounds: add_state_laws_*, apply_*_round*, law_search_*; edit data in place | partial | not verified (listing only) | replace (archive) |
| Advisor and brief tools | implemented | scripts/brief.mjs:1; scripts/run_advisor_eval.mts:1 | keep |
| Engine copy check | implemented | scripts/check_engine_copies.mjs:1 | keep |
## 4. Tests, build and deploy
| item | status | evidence | keep / modify / replace |
|---|---|---|---|
| Unit tests: 33 files, 339 it/test blocks; engines, workers, ingest, provenance | implemented | tests/unit/*.test.ts (33 files); tests/unit/advisorGroundingContract.test.ts:148 | keep |
| E2E: 2 Playwright specs, 75 test blocks, local server on PW_PORT | implemented | tests/e2e/site.spec.ts, invest.spec.ts (2 files); playwright.config.ts:16 | keep |
| Vitest runs tests/unit; excludes .claude/ | implemented | vitest.config.ts:4; package.json:6 | keep |
| Typecheck covers 5 worker files only; page JS and src JS unchecked | partial | package.json:8 | modify |
| CI on push and PR: npm test, typecheck, Playwright | implemented | .github/workflows/checks.yml:8-24 | keep |
| Scheduled source checks and probes (monthly, report only) | implemented | .github/workflows/source-check.yml:6; .github/workflows/probe-sources.yml:7 | keep |
| Build: no build step; static files served by scripts/serve.mjs | implemented | package.json:4-13; scripts/serve.mjs:1 | keep |
| Deploy: wrangler deploy by hand, no CI deploy; Worker main is workers/api-proxy.ts | partial | wrangler.toml:2; docs/GAME-PLAN.md:69 | modify |
## 5. StreetForge references (12 files; grep excluding node_modules and counties)
| location | status | evidence | keep / modify / replace |
|---|---|---|---|
| Code: no hits in app/, src/, workers/, scripts/, pipeline/, index.html | missing | grep, no hits | keep |
| Test asserts removed StreetForge fields are dropped | implemented | tests/unit/advisorGroundingContract.test.ts:148-156 | keep |
| Docs, 5 top-level: CHANGELOG, GAME-PLAN, GRAND-VISION, DATA-AUDIT, ACCURACY-ROADMAP | partial | docs/CHANGELOG.md:22; docs/GAME-PLAN.md:156; docs/GRAND-VISION-AND-ECOSYSTEM.md:64; docs/DATA-AUDIT-AND-TRANSPARENCY.md:29; docs/ACCURACY-ROADMAP.md:68 | modify (mark removed) |
| Audit files, 5: appjs-constants, appjs-fixes, engines-sites (md and json); research/leftover_claims.md | partial | docs/audit/engines-sites-audit.md:54; docs/audit/engines-sites-audit.json:13; research/leftover_claims.md:181 | modify (stale paths: streetForgeEngine.js/.ts absent) |
## 6. Architectural risks
| risk | status | evidence | keep / modify / replace |
|---|---|---|---|
| Monolith: app.js 11,339 lines, about 80 window globals, no module system | partial | app/app.js:2030; grep count of window assignments | replace (split) |
| Duplicated engines: inlined copies drift; 4 engines unused | partial | app/app.js:1201-1211; docs/audit/engine-copies.md | modify |
| Stale page doc contradicts index.html | partial | docs/audit/engine-copies.md:3; index.html:1266 | modify |
| Mixed module systems: classic globals, ES module facts.js, require guards | partial | index.html:1268; src/engines/investmentDecisionEngine.js:781 | modify |
| Worker build reads app/data JSON, so data edits need a Worker redeploy | partial | workers/localData.ts:8-16 | modify |
| Hard-coded external endpoints in page (Overpass mirror list, origin fallback) | partial | app/app.js:4039, 10127 | modify |
| Type-check gap: page and src/engines JS not type-checked | partial | package.json:8 | modify |
| Manual Worker deploy; one-off data scripts accumulate | partial | docs/GAME-PLAN.md:69; .github/workflows/checks.yml:8-24 | modify |
