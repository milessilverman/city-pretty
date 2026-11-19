# Crash-based comparisons and crash-dependent improvements, recomputed (16 Nov 2026)

## What was wrong

- **Comparison** ("N pedestrian/cyclist crashes here; similar neighborhoods: M; worse than X%"): computed in
  `pipeline/build_oc.py` against the 50 most similar block groups (standardized income, homes per acre, home value,
  year built, share without a car, single-family share) drawn from LA County plus the county. The metric was the raw
  count `pbcr`. Problems:
  - Counts gave each boundary-street crash to one side (`pipeline/metrics_oc.py`, strict `within`); 37–53% of
    crashes sit within 10 m of a boundary.
  - Windows differed by source and from LA: California county files 2016–2025 (10 years), Pennsylvania 2017–2023,
    LA 2023–2026, but the peer pool mixed LA with each county.
  - LA's own count was every crash, labelled pedestrian/bike (e.g. "134 crashes that injured someone walking or
    biking" where CCRS shows 1 such crash).
- **Rows**: traffic calming, crosswalks, pedestrian signals and slow streets need at least 1 pedestrian/cyclist crash,
  protected bike lanes 2, street lighting 3 (`pipeline/engine.py`), and crosswalks are sized at 4 or 8 intersections
  on a 10-crash threshold. All read the same counts.

## What was done (`scripts/recompute_crash_gaps.py` → `app/data/crash_gaps/<fips>.json`)

- **151 counties** with rebuilt counts (`app/data/crash_counts/`): 57 California, 94 elsewhere.
- **Comparison**: same peer rule, thresholds (gap at ≥80% with a 10% margin from the peer median, strength at ≤20%)
  and minimum of 20 peers, with the rebuilt 3-year counts (inside the block group or within 10 m of its boundary).
  **One deliberate change:** peers come only from the same crash source, because counts from different sources,
  definitions or windows aren't comparable. California counties: LA County plus the county (all CHP CCRS
  2023–2025). Other counties: the county itself (one state source). LA: LA only.
- **Rows**: crash-dependent rows re-run through `pipeline/engine.py` with the rebuilt pedestrian/cyclist and KSI
  counts. Rows that no longer qualify are dropped; crosswalks re-sized where the threshold flips; rows that now
  qualify are added from the engine (not in LA, whose rows come from an LA build not in this repo).
- **Lower-bound sources**: the rebuilt California count uses only CCRS's "motor vehicle involved with" field (the
  county files also used the injured-persons table), and Illinois records only the first thing struck. A lower bound
  can prove a block group qualifies, not that it doesn't, so in California and Illinois rows are only added or sized
  up, never dropped. The page says the count may be an undercount.
- **Page** (`app/app.js` `applyCrashGaps`): applied to each county's records as they load (LA chunk by chunk), so the
  gap list, cards, map ranking, Explore and exports agree. Old pedestrian/cyclist comparisons are removed everywhere.
  Neighborhood plan steps built on the old comparison are left out until plans are rebuilt.
- **Withheld**: San Francisco (its data file uses DataSF injury crashes; only 34% of its CCRS crashes are geocoded,
  so no rebuilt counts). The panel says "comparison not recomputed yet with the corrected crash counts".
- **Pipeline**: `pipeline/metrics_oc.py` now counts a crash for a block group if it is within 10 m of it, so a rebuild
  matches.

## What changed for users

| | Before | After |
|---|---|---|
| Block groups with a pedestrian/cyclist "worse than similar areas" gap | 5,147 | 9,047 |
| ... listed as a strength | 6,675 | 13,314 |
| Of the 5,147 old gaps, share whose percentile moved by more than 10 points | | 49% (2,537) |
| Traffic calming rows (the one fully sourced improvement) | | 2,169 dropped, 1,594 added |
| Crosswalk rows re-sized (4 ↔ 8 intersections) | | 1,337 |

Drops happen outside California and Illinois where the rebuilt 3-year count has no pedestrian/cyclist crash; the old
counts covered 7–10 years. The engine's 1-crash threshold was set on LA's ~3-year window, which is what the rebuilt
counts use.

## Update 19 Nov 2026: California on the 1/k counts

All 58 California count files were rebuilt with the 1/k split and the California `crash_gaps` recomputed. On the 57 CCRS
counties plus San Francisco: gaps 4,624 -> 5,099, strengths 6,571 -> 6,398, crash rows dropped 15,417 -> 25,367, added
2,898 -> 615, crosswalks re-sized 4,291 -> 4,380. The engine's thresholds (`>= 1` pedestrian/cyclist crash and so on) now
read the split counts, so a block group whose only crash sits on an edge shared with two others (0.33 or 0.5) no longer
qualifies; that is the intent of audit item P1-3 but it is the main reason rows dropped. Counts and medians in
`crash_gaps` are shown to one decimal when fractional. Outside California the gaps still use the older, un-split counts.

## Not done

- Neighborhood plans (`plans` in the data files) aggregate the old gaps; their pedestrian/cyclist steps are hidden,
  not recomputed.
- The crash-based comparison for San Francisco.
- The California count's pedestrian/cyclist definition should add CCRS's injured-persons table
  (`scripts/build_crash_counts_ca.py`), which would make it complete rather than a lower bound.
