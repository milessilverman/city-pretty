# Census medians filled from the tract (17 Nov 2026)

**Question.** In every county data file, a block group whose ACS median home value (B25077) or median gross rent (B25064)
is suppressed by the Census holds the surrounding tract's published median instead. For home value each block group
said so (`hvs`: "... for the surrounding Census tract (no block-group value published)"). For rent only the county's
source note said so, so the page showed a tract rent as the block group's own.

**What was checked.** `scripts/build_acs_fallback_flags.py` reads every value in the 642 county files, Orange County
(`app/data/bundle-oc.b64.txt`) and Los Angeles (`app/data/details-la.json`, rent only: LA's home values are rebuilt
on the page from assessor transfers), plus the blanks the page fills from `app/data/bundle_corrections.json`, and
compares each with the Census Bureau's ACS 2020-24 table-based summary files (the vintage every file's `meta.acs`
names), downloaded from www2.census.gov:

- `acsdt5y2024-b25077.dat` (median value) and `acsdt5y2024-b25064.dat` (median gross rent), block groups (`1500000US`)
  and tracts (`1400000US`). A negative estimate (-666666666 etc.) is "not published". Top codes (2000001 = $2,000,000+,
  3501 = $3,500+) count as the block group's own.

**Result.**

| | Block group's own | Tract median (block group suppressed) | Matches neither |
|---|---|---|---|
| Median home value | 158,638 | 13,724 | 0 |
| Median rent | 130,491 | 43,901 | 0 |

- **No mismatches** (0 values): every value is either the block group's published estimate or, where that is
  suppressed, exactly its tract's.
- The county files' own home-value notes agree with the Census in every case: 12,522 notes
  say "surrounding Census tract" and all are tract values; 158,638 say "this block group"
  and all are the block group's own. (The other 1,202 tract home values
  come from `bundle_corrections.json`, whose notes also say tract.)
- Los Angeles: all 5,601 rents on file are the block groups' own 2020-24 estimates (LA leaves suppressed rents blank),
  so nothing is labeled there.
- Counties with no tract-filled value: 3.

Largest counts of tract-filled rents:

| County | Rent from the tract | Home value from the tract |
|---|---|---|
| 17031 | 1,138 of 3,887 | 322 of 3,960 |
| 04013 | 672 of 2,678 | 206 of 2,733 |
| 48201 | 637 of 2,747 | 337 of 2,595 |
| 36059 | 561 of 893 | 23 of 1,131 |
| 36103 | 471 of 867 | 26 of 1,013 |
| 12086 | 404 of 1,759 | 225 of 1,798 |
| 06059 | 400 of 2,016 | 206 of 2,026 |
| 06073 | 352 of 2,035 | 173 of 2,022 |
| 26125 | 339 of 882 | 46 of 987 |
| 26163 | 327 of 1,352 | 129 of 1,396 |
| 27053 | 323 of 1,001 | 65 of 1,056 |
| 06065 | 319 of 1,357 | 85 of 1,372 |
| 42101 | 309 of 1,259 | 180 of 1,242 |
| 25017 | 305 of 1,117 | 52 of 1,155 |
| 48113 | 298 of 1,501 | 173 of 1,438 |

Per-county counts: `data/backtests/acs_fallback_mismatches_2026-11-17.json`. The page reads
`app/data/acs_fallback_flags.json` (per county, the block groups whose value is the tract's).

**What the page now says.** Wherever a block group's rent or home value is the tract's, it is labeled "tract median;
the block group's is suppressed by the Census": the neighborhood panel's rent tile and detail list, the comparison
drawer, the printable brief, and the home-value note on a house where the estimate is withheld ("The surrounding
tract's median home value is ..."). The AI advisor's page context carries `medianHomeValueLevel` and
`medianRentLevel` ("tract" or "block group"). The home-value tile already showed the file's note.

Also fixed in passing: the vintage label printed "Census ACS 2020-2024 ACS 5-year"; it now reads "Census 2020-2024
ACS 5-year".

**Checks.** Unit tests (`tests/unit/acsFallbackFlags.test.ts`: schema, totals, no mismatches, the notes agree,
Anchorage 020200028221 rent $1,517 = tract 02020002822's published median while the block group's is suppressed).
Browser test through `select()` (Anchorage). Live check on the real page (`scripts/live_check_acs_labels.mjs`,
`data/backtests/live_check_acs_labels_2026-11-17.json`): Anchorage and Cook County, 3 tract-filled and 3 own rents each,
12/12: each tract rent is the tract's published median and labeled, each own rent the block group's and unlabeled.

**Income checked too (one-off, not in the script).** Median household income (B19013) in the 642 county files:
161,725 values are the block group's own published estimate (top code 250001 counted as own), 14,133 are blank, none
is a tract value and none mismatches. So suppressed incomes are left blank, not filled, and need no label.

**Not covered.** Population and year built are not checked here. Re-run the script when the county files are rebuilt
from a new ACS release.
