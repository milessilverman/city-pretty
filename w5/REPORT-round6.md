# City Pretty, round 6: national-ready build, San Diego County added (6 Nov 2026)

Built on the round-5 page. LA County and Orange County behave exactly as in round 5 (91/91 regression checks). San Diego County is the first county built by the new national pipeline. Output SHA-256 529dab6c233847be…, 37.0 MB.

## 1. What's new on the page
- **County picker:** a "More counties" list sits next to the LA County / Orange County buttons. It is filled automatically from every county bundle embedded in the page.
  - The headline names all loaded counties.
  - The eyebrow, the toast and the map extent follow the active county.
- **San Diego County:** 2,058 block groups, the same engine, scoring and project catalog as LA and Orange County.
  - Specific places: 382 creek paths, 207 safer crossings, 151 traffic-calming streets, 288 EV sites and 31 parking-lot parks, in 676 block groups.
- **Honest gaps:** where San Diego has no verified source yet, the page says so instead of borrowing another county's:
  - funding programmes: "have not been verified yet"; LA's Measure W, A, M/R and ULA are never offered;
  - EIFD county policy: not claimed;
  - tax-rate-area shares: the calculator keeps its 55%-of-value estimate;
  - per-house parcels: "not connected for San Diego County yet";
  - bus frequency: no GTFS feed yet, so transit projects are not scored;
  - 311 requests: "not connected yet" (not "none exist"; the City of San Diego does publish Get It Done data).

## 2. Accuracy fixes found while testing San Diego (these also apply to Orange County)
- **Plan steps:** they said a project "could be paid for by Measure M / R (Metro sales tax)" or "Measure A (county parks)". Both are LA County programmes, and this appeared in Orange County too. Orange County now gets OCTA Measure M2; other counties get no LA programme.
- **Caltrans district:** "Caltrans District 7" (LA's district) was shown in Orange County. It is now District 12 there and District 11 in San Diego. "Metro Board" and "Caltrans/Metro" now read OCTA in Orange County.
- **Upgrade-table rebates:** the LADWP turf adder, City Plants (City of LA), Measure W stormwater credit and LADWP charger rebate are reworded to "check your water agency / city / utility" outside LA County.
- **Agency names outside Orange County:**
  - "Anaheim Public Utilities" now reads "the local electric utility";
  - "OC Parks" now reads "the county parks department";
  - "OC Housing" now reads "the county housing agency";
  - "OC Flood Control" now reads "the county flood control district".
- **Area-profile source line:** it was hard-coded to OCTA GTFS and OC Parks. It now lists the active county's own loaded sources.
- **Pool resale premium in San Diego:** uses Redfin's San Diego estimate ($20,001), the same source as the existing cooler-LA figure.

## 3. Pipeline fixes (national/pipeline)
- **CCRS crashes:** a hard-coded Orange County coordinate box dropped 99% of San Diego crashes (1,983 of 258,432 kept). The box now comes from each county's block groups: 160,414 crashes with coordinates (62%; Orange County is 65%).
- **Peer-comparison note:** it named Orange County for every county. It now names the real peer pool (LA County + this county).
- **Sources-table typo:** a missing f-string prefix would have printed "{cr.get(...)}" literally. Fixed.
- **Street-tree survey:** the Anaheim survey text is no longer attached to other counties.
- **Sidewalk note:** the engine named "Orange County" for every county; it now uses the county passed in. This is a text-only change; no formula changed.
- **Parks count:** "Esri USA Parks (N added)" is computed at build time.

## 4. Tests
- `tools/regress.js`: LA + Orange County, 91/91, 0 errors.
- `tools/sdtest.js` (new): San Diego, 42/42, 0 errors. It checks:
  - the picker, the active bundle and the button state;
  - clean text in 10 sample block groups (city, Chula Vista, unincorporated, Escondido, a CDP, and every site type);
  - no Orange County or LA claims in any San Diego panel (labelled LA cost examples excepted);
  - the funding note, EIFD, the per-house message and search;
  - switching back to Orange County (OC funding and policy still present), then LA, then reopening San Diego;
  - phone width with no overflow.
- National pipeline vs. the round-5 OC pipeline: same inputs give an identical metrics.json and an identical bundle, apart from `meta.fips` and the corrected parks count.

## 5. Adding the next county
See `national/README.md`. For a California county it is one command per stage, about 10 minutes and one 8 MB bundle. Outside California, crashes (FARS host), crime (FBI key) and fire hazard still need sources; the registry records which are missing for each county.
