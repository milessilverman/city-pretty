# City Pretty: what has been checked

Revised 18 Nov 2026. This replaces the 15 Nov version, whose "VERIFIED 100%" rows were wrong: most of the tables it
listed had been typed from memory. On 18 Nov each table was checked row by row against its primary source. Evidence
(URL fetched, date, quote) is in the `research/*_verification.csv` files and in each row's `verification` block.

## What the 18 Nov check found

| Table | Before | After |
|---|---|---|
| Fair Market Rents | 46 typed rows, every one wrong (LA 1BR 2,010) | 639 counties from HUD's API, FY2027 (LA 1BR 2,402); 13 New England counties blank because their towns sit in different HUD areas |
| Research library | 52 "verified" studies | 34 removed (DOI led to another paper or a dead page); 18 kept with real citations, 14 with the finding quoted from the paper |
| Case studies | 8, with unsourced uplift and "Year 3/7/12" figures | 5; High Line corrected from +103% to about +10% within a third of a mile; unsourced figures blank |
| Housing laws | 21 "verified" | 22: 5 confirmed (CA SB 9, CA AB 2097, WA HB 1110, OR HB 2001, VT Act 47), 12 partly, 5 unconfirmed. SB 79, TX SB 840, Arizona and Florida conditions corrected; SB 684 and a Texas ADU statute were not enacted |
| Funding programs | 11 "verified" | 0 fully confirmed, 7 partly, 4 unconfirmed; 8 funding shares blank |
| State assessment rules | 52 "verified" | California confirmed, 8 partly, 43 unconfirmed (old values kept and labelled) |
| Street unit costs | 32 "75% confirmed" | 22 found in the bid document, 3 corrected, the rest blank (including 3 Texas rows whose source was unreachable) |
| Local transit projects | 5 with invented unit counts, station details and wrong costs | 5 rebuilt from FTA profiles and agency pages |
| Intercity rail corridors | lengths, speeds, costs and station figures typed | 5 real federal Corridor ID corridors; Austin-San Antonio is not in the federal list and is flagged unconfirmed; typed figures blank |
| Redevelopment sites | 99, nationwide ones typed | 94: 90 LA sites matched to the live parcel service, 4 others re-measured, 5 that did not exist as described removed. Homes and margin are a labelled screening estimate with assumed inputs |
| Home-value estimate | "back-tested" on 5 typed sales per county | Tested on about 18,600 recorded sales in six counties. Median error 9.8% to 21.3%. It does not beat assessor value times the county sales ratio. Shown in King WA and Staten Island, withheld in Cook, Queens, Brooklyn and Philadelphia, "not back-tested" everywhere else |
| Neighborhood ranking | never tested | Tested on FHFA tract prices, 50 largest counties, two five-year windows. No better than picking the cheapest areas; right direction in 70% of counties in 2020-25. Presented as a screen |

New tables built from fetched sources: `transit_cost_benchmarks.json` (52 US projects, no high-speed rail),
`transit_value_effects.json` (18 measured station effects), `hud_safmr/` (ZIP-level rents, 204 counties).

## What is still not known

- Construction cost per square foot and the value an added room, ADU or storey adds, by area. Until these exist the
  page cannot say what a house expansion costs or returns.
- Zoning for most cities. Without it per-lot rights read "not determined".
- Redevelopment sites outside Los Angeles (4 on file).
- Station-area density and ridership for transit verdicts; cost benchmarks for high-speed rail.
- Sources that refused this build machine and need checking from another: California bill pages, LA Measure W,
  Illinois statutes, FTA and FRA sites (read through archive copies), TxDOT bid prices.
- The pipeline's per-neighborhood return estimates ("$ per $1") still rest on borrowed study effects; 16 of the 40
  effect rows have their quote confirmed in full text.

## Rules

1. A number enters a data file only from a source fetched at the time, with the URL and quote recorded. Otherwise it
   is `null` and the page says "not on file".
2. Every row carries `verification` (status, date, evidence). A law that is not confirmed is never shown as a right.
3. Model outputs are kept apart from facts and labelled as estimates, with their assumptions listed.
4. A claim of accuracy needs a measurement: sample size, error, and a simple baseline it was compared with.
5. The scripts that once wrote typed data now exit with a notice; the JSON tables and the fetch scripts in `scripts/`
   are the source of truth.
