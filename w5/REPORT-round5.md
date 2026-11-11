# City Pretty, round 5: specific places and data accuracy (6 Nov 2026)

Built on the page uploaded on 6 Nov 2026 (SHA-256 98f21e39…). That upload equals my round-4 build plus performance changes from the Fable session: lazy map layers, merged polylines and a faster street-name lookup. Those changes are kept unchanged.

## 1. New: "Specific places for these projects"

For every block group in both counties, the page now names concrete candidates instead of generic project types:

| Type | What it finds | Data | Cost reference (verified) |
|---|---|---|---|
| Creek / channel path | Named creeks, rivers and flood channels within 400 m with at least 300 m and half their length lacking a path alongside (80 m search; 150 m for rivers and wide channels) | OSM waterways; LA County Public Works open channels (with maintainer); existing paths from OSM (sidewalks excluded), LA County Countywide Trails (developed), OC Public Works Class I bikeways 2024 and OCFCD maintenance roads marked as trails; OC: OCFCD maintenance-road status (≥10 ft / narrower / none) | Puente Creek Bikeway $3.7M programmed for 1.86 mi (withdrawn 2025); Coyote Creek / OC Loop P–Q $5.699M ATP for 1.6 mi; OC Loop A rail-trail ~$14.8M/mi |
| Parking lot → pocket park | Park-poor block groups only (nearest park over ½ mile, or under 1 acre of park within ½ mile). LA: the County Assessor parking-lot parcels already in the page. OC: OSM surface lots that are publicly run or next to a library, community center, city hall or park-and-ride; lots serving a park are skipped | LA Assessor (page inventory); OSM | Walnut Park pocket park (LA County, 0.5 ac): $4,622,842 budget incl. $3,330,000 construction; land $1,265,000; ~$385k/yr |
| EV chargers | Surface lots of 800 m² or more at named destinations (libraries, parks, community centers, city halls, supermarkets, shopping centers, colleges, hospitals, park-and-rides, rail stations) where no public, working charger of any kind is within 800 m | AFDC station list (USDOT/BTS NTAD copy, updated daily; 8,066 stations in LA+OC, 781 public DC fast) | CARB: $9,575 per Level 2 connector, $103,238 per DC fast charger |
| Traffic calming | Residential streets with 3+ injury crashes (or 2+ involving a pedestrian, cyclist or death), 2016–2025, within the block group. Crashes within 20 m of a bigger road are left out. Cross streets are named, and existing humps are counted (LADOT layer + OSM). Each street is checked against LADOT's map-checkable criteria | CHP CCRS crash records (data.ca.gov); OSM roads; LADOT speed humps (4,628, last edit 26 Aug 2024) | LADOT $5,958 per hump (5 Nov 2025 memo); criteria from the 4 Mar and 5 Nov 2025 memos; speed-feedback sign $14,221 (LA 2022) |
| Safer crossing | Intersections with 3+ injury crashes involving people walking or biking within 30 m, 2016–2025 | CCRS; OSM intersections | LA City unit prices 2022: crosswalk $3,950, LPI $34,034, RRFB $118,512, curb extension $158,016–260,726 |

**Counts:** LA County has 3,152 block groups with at least one candidate:

| Type | LA County | Orange County |
|---|---|---|
| Creek / channel path | 2,221 | 847 |
| Safer crossing | 1,839 | 823 |
| Traffic calming | 1,271 | 493 |
| Parking lot → park | 773 | 3 |
| EV chargers | 357 | 173 |

Orange County has 1,261 block groups with at least one candidate.

Each card states the facts it rests on and links its source. Clicking a card draws and zooms to the site on the map. Matching project cards get a "Specific candidate" line.

## 2. Accuracy changes
- **Orange County charger distance:** the "nearest DC fast charger" metric now uses the official AFDC list (512 public, working DC fast stations via USDOT/BTS) instead of OpenStreetMap. 1,843 block groups changed (median 1,484 m → 1,384 m); 186 `ev_hub` rows changed, 21 added and 26 dropped.
- **Catalog source corrections (5):**
  - Safer crossings, leading pedestrian signals and protected bike lanes now show LA City's own 2022 unit prices.
  - Corridor trails now show checked channel-path budgets.
  - Pocket parks now show the Walnut Park budget.
  - The engine's costs are unchanged.
- **Safer crossings:** the catalog's bulb-out figure ($11–18k, Santa Monica, unverified) is 10–20× below LA's own curb-extension prices ($158k–261k per corner, 2022). This is now stated next to it.
- **Parking lots that serve a business are no longer offered as parks:** an LA candidate in Bell was a supermarket's parking lot. Lots within 120 m of a supermarket, shopping center, department store or hospital are now dropped: 142 in LA and 1 in OC. The rule is also in sites.py for future runs.
- **Speed-hump rules outside the City of LA:** LADOT's criteria apply only to the City of Los Angeles. In Culver City, Bell, unincorporated areas and Orange County, the card now says that city (or LA County Public Works) sets its own rules, and LADOT's are shown for reference.
- **Orange County parks count:** the sources table said Esri USA Parks added "1,010" parks. That figure was hard-coded from an older build; this build adds 335. It is now computed at build time.

## 3. Checks
- Headless regression: 91/91 checks passed, 0 page or console errors.
  - Both counties were tested: all five site types render, card clicks move the map, there is no NaN/undefined/LA-specific leakage, the round-5 catalog corrections are present, and dark and phone layouts work.
- The OC bundle in this page was rebuilt by the new national pipeline (section 4) from the same downloads. It is identical to the round-5 OC bundle except for the park count above and a new `meta.fips` field.

## 4. National-ready infrastructure (in progress, see REPORT-round6)
- **County registry:** `national/registry.py` lists all 3,222 US counties (Census 2025 Gazetteer) and which data sources apply to each.
  - National sources: Census, OSM, USA Parks, AFDC, Tree Equity.
  - California-only sources: CCRS crashes, CDE schools, DOJ crime, CAL FIRE.
  - Sources still blocked: FARS (host not allowed), FBI crime (needs a key), a national fire-hazard layer (none found).
- **Pipeline:** `national/pipeline` runs for any county with `CP_FIPS=<fips>`. It reproduces Orange County exactly, as described in section 3.
- **San Diego County** (06073) is built as the first new county.

Output page SHA-256 9efbd9d8f550b704…
