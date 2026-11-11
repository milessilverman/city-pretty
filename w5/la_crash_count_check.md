# LA crash-count check (7 Nov 2026)

**Claim on the LA page.** Rows such as traffic calming, protected bike lanes, crosswalks and signal retiming say "0 fatal/severe and N pedestrian/bike crashes recorded". The crash source is CHP CCRS 2023–2026, per the page's sources table.

**Test.** For 400 random LA block groups (seed 1) that carry the sentence, I counted CCRS 2023–2025 crashes inside the block group, using the CCRS rows downloaded in round 5 (`la_data/ccrs_la_*.json`).

| Comparison | Result |
|---|---|
| Correlation of N with all crashes in the block group | 0.995 |
| Correlation of N with pedestrian/bicycle crashes in the block group | 0.316 |
| Median of N / all crashes (block groups with 20+ crashes) | 1.19 (consistent with 2023–2026 vs 2023–2025) |
| Sum over the sample: N | 25,505 |
| Sum over the sample: all crashes 2023–25 | 21,363 |
| Sum over the sample: pedestrian/bicycle crashes 2023–25 | 833 |

Examples:

| Block group | N on the page | All crashes inside, 2023–25 | Pedestrian/bike inside |
|---|---|---|---|
| 060372044101 | 221 | 177 | 0 |
| 060372046001 | 134 | 106 | 0 |
| 060372047003 | 130 | 113 | 0 |

**Finding.** N is every reported crash in the block group, including property-damage-only crashes. It is not pedestrian/bicycle crashes. Separately, the fatal/severe count is 0 in all 6,587 LA block groups because it was never filled.

**Page fix (text only).** LA rows now read "N crashes of all kinds recorded here (CCRS 2023–2026; the LA build counted every crash, not only pedestrian/bike ones, and has no fatal/severe count)".

**Real counts added (round 8).** `tools/la_crash_counts.py` counts, for every LA block group, the CCRS 2023–2025 crashes:
- that involved a pedestrian or cyclist;
- in which someone was killed or seriously injured, using the statewide CCRS injured-persons lists (Fatal, SuspectSerious, SevereInactive).

Totals: 8,727 pedestrian/bicycle crashes and 7,058 KSI crashes, out of 229,962 geocoded crashes. LA rows now show them next to the original number. Example: "221 crashes of all kinds recorded here (CCRS 2023–2026; …; CCRS 2023–2025 for this block group: 0 involving a pedestrian or cyclist, 2 killed or seriously injured)".

**Not fixed.** The LA engine used N to decide eligibility: traffic calming at 1+ crashes, protected bike lanes at 2+, 8 intersections instead of 4 at 10+. As a result, LA offers these projects more often than real pedestrian/bike crashes would justify. A correct fix means rebuilding the LA rows with the real pedestrian/bike count. The engine reproduces LA only approximately (`validate_la.py`), so that rebuild is left for an LA rebuild round rather than done here.
