# City Pretty, round 7: seven counties, first county outside California (6 Nov 2026)

Built on the round-6 page. Output SHA-256 b98b5dc8573c4393…, 57 MB. LA County and Orange County are unchanged (91/91 regression checks).

## 1. Counties on the page

| County | Block groups | Built from | Specific places (block groups with candidates) |
|---|---|---|---|
| Los Angeles | 6,587 | round 1–5 LA build | 3,152 |
| Orange | 2,049 | national pipeline (identical to round 5) | 1,261 |
| San Diego | 2,058 | national pipeline | 676 |
| Riverside | 1,394 | national pipeline | 944 |
| San Bernardino | 1,275 | national pipeline | 606 |
| Ventura | 479 | national pipeline | 377 |
| Denver, CO | 571 | national pipeline, first non-California county | 420 (621 crossings, 162 calming streets, 36 EV, 14 creek, 1 lot) |

Counts by type are in `sites-summary.json`.

Block-group counts match the Census ACS geography file exactly in every county.

## 2. New national data sources (all on hosts this environment already allows)
- **Denver crashes (county adapter):** Denver Police traffic accidents 2016–2025 come from the City of Denver's open data on ArcGIS (208,116 reports, 200,179 with coordinates). They give:
  - the pedestrian/bicycle crash and killed-or-seriously-injured scores for every block group (same definitions as California's CCRS);
  - safer-crossing and traffic-calming candidates.

  The city does not record minor injuries, so Denver's cards count "serious, fatal or walking/biking crashes" and say so. That set is narrower than California's "injury crashes", so Denver candidates are conservative.
- **Crashes elsewhere outside California:** NHTSA FARS 2023 (final) and 2024 (initial), from the USDOT/BTS NTAD copies on ArcGIS (`fetch_fars`). These are fatal crashes only, so they are downloaded and listed but not scored. The injury-crash scores and the traffic-calming / safer-crossing candidates stay absent, and the page says why.
- **Schools outside California:** NCES EDGE "Public School Locations – Current", from NCES's own ArcGIS Online layer (`fetch_schools`).
- **Tree Equity Score:** now per state (`tes_<st>.zip`). Denver matched 570 of 571 block groups.
- **OSM:** openstreetmap.fr sub-state extracts where one matches a county (Cook, Denver, Detroit metro, NYC boroughs, Long Island, Fairfax). State and regional files are clipped to the county in `osm_extract.py` and `osm_sites.py`.
- **Fire hazard outside California:** checked, not used. The only block-group summary of USFS Wildfire Hazard Potential on an allowed host gives min/max/mean, not the high-hazard share the engine uses. Fire stays empty, not 0.

## 3. Honesty fixes for counties outside California (and some inside)
- **EIFD:** EIFDs exist only under California law. Outside California, the calculator and the EIFD-based funding plan are replaced by a note, and the section is titled "Tax-Increment Financing".
- **Plan steps:** California programmes (ATP, TCC, AHSC, CAL FIRE forestry, Prop 4, Rule 20, Quimby, EIFD) are not offered outside California. LA programmes (Measure W, A, M/R, ULA) are not offered outside LA County.
- **Upgrade table:**
  - Prop 13 reassessment notes become "Check local assessment rules" outside California.
  - CalHFA, SGIP, TECH Clean California and Brace + Bolt are marked as California programmes.
- **State DOT:** "Caltrans" becomes "the state DOT" outside California. Caltrans districts: Riverside and San Bernardino are District 8, Ventura is District 7. Project caveats now go through the same agency-name rules.
- **Measure W:** "grant match (Measure W, Prop 4)" now reads "local stormwater funds" outside LA County (Orange County included).
- **Engine text (text only, no formula change):** "check Caltrans" and "SCE lines not mapped" now name the state DOT and the local utility outside California.
- **Pipeline:** CAL FIRE layers and California-only cache files (CDE, DOJ, TES-CA) are no longer linked into other states' folders. Before this fix, Denver would have been scored with a fire share of 0 from empty California layers.
- **City boundaries:** Census places are clipped to the county. Neighbouring-county communities no longer show as map labels.

## 4. LA crash-count correction (found this round)
LA's rows said "0 fatal/severe and N pedestrian/bike crashes recorded". Checked against CHP CCRS (details in `la_crash_count_check.md`):
- N is every crash in the block group: correlation 0.995 with all crashes, 0.32 with pedestrian/bike crashes. In a 400-block-group sample, the page showed 25,505 where the real pedestrian/bike figure is about 990.
- The fatal/severe count was never filled: it is 0 in all 6,587 block groups.

The text now says what the number is. The LA engine also used N to decide when to offer traffic calming, protected bike lanes and crosswalk upgrades, so those LA recommendations are offered too often. Fixing that needs an LA rows rebuild with the real counts, recommended as the next LA task.

## 5. Tests
- `tools/regress.js` (LA + OC): 91/91.
- `tools/countytest.js` runs for each county (picker, active bundle, eyebrow, clean text in up to 5 sample block groups plus every site type, no other county's or state's claims, funding note, EIFD, per-house, search, switching to OC and LA and back, phone width):
  - San Diego 41/41;
  - Riverside 41/41;
  - Ventura 41/41;
  - San Bernardino 41/41;
  - Denver 33/33. Denver has fewer checks because it is a consolidated city-county, with no second city or unincorporated area to sample.

## 6. Known limits
- **Heat values are centred on each county.**
  - LA's heat-disparity values are centred on LA: mean −0.5, median 0.0, sd 3.0. Orange County and the new counties are centred the same way, on their own block groups in each urbanized area (Orange County: mean 0.0, sd 2.9). The engine's heat thresholds were calibrated on these centred values, so every county is treated alike.
  - I tested a statewide urbanized-area baseline. It would shift Orange County by −1.17°F and drop heat projects (cooling centres, splash pads, green streets) from 677 block groups. It was not adopted.
  - Consequence: heat values are not comparable across a county line. At the LA/Orange border, the LA median is −2.1 and the Orange median +0.3.
  - LA's canopy gap also follows its own method: it correlates only 0.42 with the current Tree Equity `tc_gap`, while Orange County's matches LA at the border (ratio 1.01).
- Each project card's "sources" list still cites the LA evidence base. For example, the undergrounding card lists LADWP line maps and CAL FIRE zones, because those are the studies and data the cost and effect figures come from.
- Outside California there is no crime data (FBI Crime Data Explorer needs an api.data.gov key), no fire share, no transit frequency (no GTFS connected) and no injury crashes.
- Page size is 57 MB with seven counties. A national site should host each county as its own file; the loader already accepts `data-src`.

## 7. Update 7.1 (7 Nov 2026)
- **Shared links work for every county.** A `#bg=<block group>` link now opens that block group's county, embedded or hosted. This also fixes Orange County links, which were broken before: the page's first selection replaced the link before Orange County unpacked. Each county's test now opens a fresh page from a shared link.
- **Caltrans districts for all 58 counties.** Each county's majority district comes from Caltrans' own District Boundaries layer (Caltrans Environmental, ArcGIS Online, last edited 19 Jul 2024), intersected with TIGERweb counties. Kern is split: 62% District 6, 38% District 9.
- **Crime-data name fixes.** The CA DOJ file names some cities differently from the Census:
  - Ventura → San Buenaventura (Ventura); Big Bear → Big Bear Lake;
  - Angels Camp → Angels; Carmel → Carmel-by-the-Sea; Paso Robles → El Paso de Robles;
  - "Buelton" → Buellton and "Suisun" → Suisun City (misspelt in the DOJ file);
  - Central Marin Police Authority → one shared rate for Larkspur, Corte Madera and San Anselmo.

  Ventura (city of 110,000) and Big Bear Lake now have crime rates. Ventura matches 11 agencies, San Bernardino 25.
- **Hosted mode for a national site.** `export_county.py` writes per-county bundle and site files, and `patch6.py <fips>=@<url>` loads them on demand. Tested over HTTP with Denver and Santa Clara (see `national-README.md`).
- **More counties built** (data products, not embedded in this page): Santa Clara, Alameda, Sacramento, Contra Costa, San Francisco and Fresno so far; the rest of California is building.
  - San Francisco uses DataSF's injury-crash table: 30,526 crashes for 2016–2025, all but 1 geocoded. CCRS has coordinates for only about 30% of SF crashes.
- **Tests:** LA + Orange County 91/91; San Diego, Riverside, Ventura and San Bernardino 42/42 each; Denver 34/34.
