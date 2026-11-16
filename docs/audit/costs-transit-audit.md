# Audit: construction unit costs and transit corridors

**Checked on:** 16 November 2026
**Files:** `app/data/unit_costs.json`, `app/data/transit_pipelines.json`, `app/data/intercity_transit_corridors.json`
**Full evidence (quotes, URLs, Nominatim distances, everything removed):** [`costs-transit-audit.json`](costs-transit-audit.json)

## How things were checked

- **verified**: I fetched the source during this audit, and it shows the specific value. For bid tabs, I also confirmed the price came from the low or awarded bidder.
- **partially_verified**: The value is in the fetched source, but part of the claim is not confirmed (for example the formal award vote). The unconfirmed parts are listed in `unverified_fields`.
- **could_not_check**: The source could not be fetched from this environment (403, dead link, a TLS failure, or a Wayback connection reset). The value is not confirmed. It is not shown to be wrong either.
- **unverified**: There is no source on record.
- Wikipedia is used only as a **secondary** source, and every use is labelled as such.
- Station coordinates were checked with OpenStreetMap Nominatim at about 1 request/sec.

Every record now has a `verification` block.

## Results

| File | verified | partially_verified | could_not_check | unverified |
|---|---|---|---|---|
| unit_costs.json (32) | 8 | 12 | 8 | 4 (null, no source) |
| transit_pipelines.json (5) | 0 | 5 | 0 | 0 |
| intercity_transit_corridors.json (4) | 0 | 2 | 2 | 0 |

## Errors found

### unit_costs.json
1. **Gwinnett County, GA sidewalk: $42 was the wrong bidder's price.** The award notice names The Dickerson Group, whose price was **$45.00/SY**. Corrected.
2. **New Rochelle, NY sidewalk: $237.01 was Peduto Construction's bid, and Peduto was not the low bidder.** The low total was MFD Quality ($251,060), at **$245.00/SY**. Corrected; the award is not confirmed.
3. **TDOT statewide sidewalk ($7.19/SF) could not be reproduced.** The file at the cited URL now covers all of 2025 and shows **$8.21/SF**. Updated.
4. **Ogden, UT high-visibility crosswalk was marked `not_found`, but the cited bid tab shows $218/EA.** Filled from the source.
5. **8 records could not be fetched:** TxDOT ×3 (TLS failure), the Sarasota airport bus shelter (403), Kalamazoo (403), Mesa ×2 (403), and CDOT (the URL is dead, 404). Their `status` changed from `confirmed` to `unchecked`.
6. **The 4 big-ticket items have no cost at all:** protected bike lane, red bus lane, bioswale, and undergrounding. Separately, `src/engines/transitCorridorOpportunityEngine.ts` uses **$220,000/mile for protected bike lanes and labels it "verified DOT unit costs"**. No such value exists in the data.

### transit_pipelines.json
1. **Invented housing programs:** `units`, `affordPct`, and `retailSqft` had no source for any corridor (for example 460 homes / 35% / 28,000 sq ft for Austin). All set to null.
2. **Invented station amenities:** "16 DC fast EV stalls", "24 fast EV charging bays", "3.4-mi rail-with-trail cycleway". Removed.
3. **Austin:** ATP lists 15 stops. The file has 6 stops whose names don't match ATP's, and "Downtown" sits on the generic Austin city geocode. It also called the line "grade-separated" (ATP says street-level), and its status was outdated (an FTA Record of Decision was issued Jan 16, 2026, per a secondary source).
4. **LA D Line:** the status said all sections were under construction, but Section 1 opened May 8, 2026. The "$3.6B FTA CIG" figure could not be confirmed, so it was removed. The missing Westwood/VA Hospital terminus was added.
5. **OC Streetcar:** the source URL returned 404 and was replaced. OCTA says 16 stops and service starting early 2027. The file lists two separate Harbor stations, which is likely wrong.
6. **Denver East Colfax:** the BRT is center-running only from Broadway to Yosemite, not "10 miles to Anschutz". The "Yosemite → R Line light rail" connection is wrong.
7. **Chicago RLE:** CTA says 5.5 miles (the file said 5.6). The "$1.973B FFGA, Sept 2024" claim could not be confirmed.

### intercity_transit_corridors.json
1. **All 4 railyard "siting recommendations" were fabricated.** Each paired a made-up per-acre land cost with a RECOMMENDED / NOT RECOMMENDED verdict (Coolidge $2.38M vs Tempe $171M; Kyle $3.15M vs East Austin $165M; Pueblo TTC at $18k/acre). All removed.
2. **Brightline West's "Apple Valley VMF – APPROVED & UNDER CONSTRUCTION" is contradicted.** According to Wikipedia (secondary), the maintenance facility moved to Sloan, NV.
3. **Every station's home value, land $/sqft, and "underused acres" had no source.** All set to null.
4. **Speeds, travel times, and capital costs had no source** for Phoenix–Tucson, Austin–San Antonio, and Front Range. Set to null.
5. **Brightline West:** the capital cost was $12.0B, but a secondary source puts it at $21.5B (Jan 2026). Speed (200 mph), length (218 mi), and "about 2 hours" were confirmed on the official site. The missing Hesperia station was added.
6. **Placeholder coordinates presented as stations:** Phoenix, Chandler, Coolidge, Marana, San Marcos, New Braunfels, and Colorado Springs are city centroids (Phoenix is 14 m from OSM's city point). The Austin "station" is 1.57 km from Plaza Saltillo. All are flagged in `coordinate_basis`.
7. **Front Range: the cited `source_url` now redirects to a gambling spam page.** It was replaced with a labelled secondary source, and `official_study_url` was set to null.
8. **Phoenix–Tucson and Austin–San Antonio could not be checked at all.** ADOT and FRA return 403, and the TxDOT link is dead (404). Every station on those two corridors is unconfirmed, and the Phoenix–Tucson stations appear to have been invented.

## What this breaks (not fixed here — data files only)

- **Tests:** `tests/unit/dataAccuracy.test.ts`
  - Test 16 requires railyard sites, positive travel times, https study URLs, and lat > 20 for every station.
  - Test 17 hard-codes fabricated outputs (`railyardCostSavingsUsd > 150,000,000`, `yard_coolidge_junction`, Phoenix land cost 95 $/sqft).
  - Test 9 needs ≥20 `confirmed` records; there are now 19.
  - Separately, `tests/unit/advisorGroundingContract.test.ts` expects route 121 and a $1.68M railyard. That data never matched the file.
- **`src/engines/transitCorridorOpportunityEngine.ts`:** arithmetic on null fields will produce NaN, and the yard selection gets an empty list.
- **`app/app.js` around line 8048:** renders `${pipe.units} mixed-income homes` without a null check, so it will display "null". The tooltip near line 2811 already showed "undefined", because stations never had `units`.
