# Parcel services, round 3 (17 Nov 2026)

Four registry entries were failing: Shelby, Hamilton and Knox TN on the TN Comptroller's `geoviewer.cot.tn.gov`
server, and Hinds MS on MDEQ's `opcgis.deq.state.ms.us`. Each change below was checked by direct query (layer
metadata, browser-request header, a point check) and on the real page with `scripts/live_check_panels.mjs`
(`data/backtests/live_check_panels_2026-11-17_round3.json`). Registry check after the changes: 122 of 123 answer
(`data/backtests/parcel_registry_check_2026-11-17.json`); the one that doesn't is Knox (below).

## What was wrong

- **The TN state server's 403s are its web application firewall** (`Microsoft-Azure-Application-Gateway/v2`), and they
  come and go for the same query: three identical clean queries for Knox got 200, 403, 403. The page queries it from
  the browser, so a 403 there is a failed click.
- **Knox's field list was broken.** It named one field as `LOC_HOUSE_NUMBER + LOC_STREET_NAME`. The layer has no such
  field, and any query that asks for it fails ("Failed to execute query", HTTP 400). So no Knox lot could be read on the
  page even when the server answered. Now `PARCELID_1`, `LOC_HOUSE_NUMBER`, `LOC_STREET_NAME`, `LANDUSE`; the page
  joins the two address fields (`normalizeParcelFeature`).
- **Hinds**: MDEQ's server returns HTTP 500 on every request, its root included (since at least 16 Nov).

## Changes

| County | Was | Now | Evidence |
|---|---|---|---|
| Shelby TN (47157) | TN Comptroller layer 6 (`PARCELID` only) | City of Memphis GIS, `CERT_TAX_PARCELS` (ArcGIS item [cc1241646f84404185571113c1233665](https://www.arcgis.com/home/item.html?id=cc1241646f84404185571113c1233665)), through Esri's proxy to the county's certified tax-parcel service | 352,614 parcels (county scale); `TAXYR` 2025 (the certified roll); browser requests allowed (the proxy echoes the page's origin). Point: the Census geocoder's point for 1835 Union Ave, Memphis returns parcel `016043  00020`, `1835 UNION AVE`, within 25 m. Fields: ID, address, land use, zoning, municipality, living units, tax year |
| Hamilton TN (47065) | TN Comptroller layer 2 (`GISLINK` only) | Chattanooga-Hamilton County Regional Planning Agency, `Parcels_ZoneAugust2026` (item [84204e58446e43e9a406fbd28c2ca95c](https://www.arcgis.com/home/item.html?id=84204e58446e43e9a406fbd28c2ca95c)) | 169,200 parcels; edited 11 Sep 2026 (an August 2026 snapshot); `access-control-allow-origin: *`. Point: the centroid of `1013 E DALLAS RD` returns that parcel (`033127H G 03700`, appraised $452,500). Fields: ID, address, land-use code, property-type code, appraised value, zoning (the RPA's join). Not used: `CALCACRES`, which is coarse (654 of 2,000 sampled rows read exactly 1) |
| Hinds MS (28049) | MDEQ `HINDS_PARCELS` (down) | `Hinds_Service` layer 1, `parcelpolys_current` (item [d409b11173134140981e5394319f629d](https://www.arcgis.com/home/item.html?id=d409b11173134140981e5394319f629d)), published by Atlas Geodata, the same account that publishes the county's "Hinds County Parcels" app; it is the parcel layer of the CMPDD-hosted Hinds parcel viewer that the JXN Water item names as the place for current Hinds parcel data | 128,266 parcels; edited 1 Oct 2026; `access-control-allow-origin: *`. Point: the Census geocoder's point for 1100 Robinson St, Jackson returns Robinson St parcels within 25 m. Fields: ID, house number, direction, street (joined into the address), GIS acres, true value of land and improvements (Mississippi assessor's "true value"; assessed value is 15% of it, e.g. 32,016 / 213,440), land type, year built |
| Knox TN (47093) | TN Comptroller layer 3 with a broken field list | Same layer, fields fixed | Clean queries succeed when the firewall lets them through (two downtown Knoxville parcels: `109AL006` 140 HAWTHORNE AVE, `094EL003` 500 MCGHEE AVE) |

Live on the real page: Shelby 3/3, Hamilton 3/3, Hinds 3/3 points read their lot through the new layer, and every
panel matched its source except USGS elevation, which timed out on several points and was shown as "Not available"
(no wrong value). Knox: 3/3 points "parcel service did not answer" (the state server's firewall); neighborhood panels
correct.

## Not resolved

- **Knox** still depends on the TN state server. Knox's own KGIS servers (`maps.kgis.org`, `www.kgis.org`) answer 403
  to the build machine; the City of Knoxville's ArcGIS Online parcel items are a 1-record export and a 2023 hex copy.
  No other public Knox layer was found.
- **Shelby's own server** (`scgis.shelbycountytn.gov`) fails TLS with "unsafe legacy renegotiation", which browsers
  also refuse, so the City of Memphis copy is the usable route. It depends on Esri's proxy item staying shared.
- **Hamilton's own server** (`mapsdev.hamiltontn.gov`) returns 522 (its origin is unreachable behind Cloudflare). The
  RPA layer is a snapshot (August 2026), not the live roll; re-check for a newer one.
- **Not done here:** the state GIS office's `Tennessee_Property_Boundaries_Public_Use` (edited 13 Nov 2026, browser
  requests allowed) covers 86 of 95 counties (not Davidson, Shelby, Hamilton, Knox and five others). It could be the
  statewide fallback for the TN counties with no service; that needs its terms checked first.

## Mistakes

- The worktree started from an unrelated old commit (`94a3f0b`); I reset it to the branch head (`fcd437e`) first.
- My first two Chattanooga point checks found nothing because the geocoded points fall in the street; I checked by a
  parcel's own centroid instead, which is how the page clicks.
