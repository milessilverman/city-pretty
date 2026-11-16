# Nationwide sample audit of the county bundles (16 Nov 2026)

Scope: the public-data values inside the 637 non-LA county bundles (`counties/bundle_*.json.gz`), checked against the
sources each bundle names. Script: `scripts/audit_bundles_nationwide.py` (modes `acs`, `fallback`, `gtfs`,
`facilities`). Machine-readable results, including the full sample and seed: `bundles-nationwide-audit.json`.

## Summary

| Check | Sample | Result |
|---|---|---|
| Census ACS 2020–2024 fields (home value, homes, owner share, population, income, rent, year built, single-family share, car-free share) | 1,410 block groups, up to 3 counties per state in every state with bundles (seed 20261116) | **Exact match for 9 of 9 fields** except 17 values where the bundle is empty but a tract fallback was due (below). No wrong numbers. Vintage in every bundle's metadata ("2020-2024 ACS 5-year") is correct. Census "not available" codes are handled (become empty, never numbers). |
| Tract fallback (full scan, every block group in every bundle) | 14,479 block groups with homes but no block-group value | **Defect: 4,299 values in 4,178 California block groups** (1,202 home values, 3,097 rents) in all 54 California counties outside LA and Orange County did not get the tract fallback the pipeline specifies; they show "no Census value". **Zero cases outside California.** |
| Home-value labels | 1,381 block groups | Correct: 1,271 say "this block group", 106 say "surrounding Census tract"; the 4 others are the missed fallbacks. |
| Bus frequency (GTFS, 7–9 am weekday) | 60 block groups in 6 counties (AL, ID, IN, NE, OH, VA), re-computed from the current MobilityData feed | **60 of 60 identical**, including the 20 with service (0.5 to 9 buses/hr). |
| Nearest public school (NCES EDGE current) | 120 block groups in 12 counties / 12 states | 116 within 25 m. **Defect (method):** schools are read only inside the county, so a nearer school across the county line is ignored (1 of 120 here). 3 others: water-adjusted reference point or a school added since the build. |
| Nearest public DC fast charger (AFDC copy) | same 120 | 111 within 25 m, 116 within 100 m; the rest are stations opened or delisted since the 7 Nov download (normal drift). |
| Tree Equity Score | Douglas County, NE (487 block groups) | Bundles use the **2021 release (2010 block groups, area-weighted)**. A current release exists (files dated 1 Jul 2025, 2020 block groups). Canopy gap (same definition): median difference 1.8 points, >5 points in 23% of block groups. Heat: the two releases measure different things (below). |
| Parks (OpenStreetMap) | — | **Not checked**: Overpass is unreachable from the audit machine and the OSM editing API is not for area reads. |

## Findings to fix

1. **California tract fallback missed (data).** 4,178 block groups in 54 counties show no home value and/or rent
   although the Census publishes a tract value, which every other state's bundles use. Likely cause: in
   `pipeline/fetch_oc.py` `fetch_acs`, a California county with a cached `acs_bg.json` returns early, so
   `acs_tract.json` (read by the fallback in `pipeline/metrics_oc.py` ~504–512) is never written. The exact tract
   values and the pipeline's own labels are in `app/data/bundle_corrections.json` (built from the Census table files);
   the page should apply them on load for those block groups. Fix the early return before the next rebuild.
2. **School distance ignores schools across the county line (method).** `fetch_oc.py` ~1348 queries NCES with
   `CNTY='<county>'`; query a padded bounding box instead (as the AFDC charger query already does). Example: Travis
   484530359001 shows 9,298 m; the nearest school is 5,665 m away in Williamson County. The same check is worth doing
   for OSM facilities (library, clinic, etc.), which come from a per-county extract.
3. **Tree Equity Score vintage (label, then data).** The panel's heat and canopy figures come from the 2021 release on
   2010 geography but are labelled only "Tree Equity Score". At minimum label them "Tree Equity Score 2021 (2010 block
   groups)". Recommended: switch canopy gap to the current release (same definition, 2020 block groups, no
   reweighting). For heat, the current `temp_diff` is a "heat extremity" difference with no stated unit, so it must not
   be shown as °F; either keep the 2021 avg_temp measure with its vintage, or show the current one as an index.

## What held up

Every ACS value checked, every bus frequency checked, and nearly every school and charger distance reproduce from the
named public sources. Apart from the three findings above, the sample found no wrong number in the non-LA bundles.
This is a sample: 1,410 of about 177,500 block groups for ACS (full scan for the fallback), 60 for transit, 120 for
facilities, one county for Tree Equity.
