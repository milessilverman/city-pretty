# Impact-distance effects: evidence note (fetched 2026-11-27)

Data: `app/data/impact_distance_effects.json`. Quotes were checked against text saved this session; bands only where the quote has both distance and effect.

| improvementKey | status | study | what was fetched (URL) | why not verified |
|---|---|---|---|---|
| traffic_calming | requires_investigation | Polloni 2017, Portland | Crossref abstract https://api.crossref.org/works/10.2139/ssrn.2952964 | SSRN 403; abstract gives effect per treated street, no distance |
| street_trees | verified | Donovan & Butry 2010, Portland | https://www.fs.usda.gov/pnw/pubs/journals/pnw_2010_donovan001.pdf | |
| pocket_park | verified | Russell & Kweon 2025, Baltimore | Crossref abstract https://api.crossref.org/works/10.3390/land14030483 | (MDPI full text 403; abstract only) |
| park_upgrade | requires_investigation | Livy & Klaiber 2013, Baltimore Co. | https://ageconsearch.umn.edu/nanna/record/150634/files/Renovating%20Parks.pdf | distance in words only ("a mile"), effect in dollars only |
| crosswalks | requires_investigation | none found | Crossref searches (2) | only engineering/safety papers returned |
| protected_bike | verified | Doucet et al. 2020, Waterloo Region (condos, negative) | https://uwaterloo.ca/urban-growth-change/sites/default/files/uploads/documents/cycling-infrastructure-and-its-relationship-to-residential-property-prices-report.pdf | |
| ev_hub | requires_investigation | none found | Crossref searches (2) | no property-value study returned |
| vacant_lot_green | verified | Lin, Jensen & Wachter 2023, Philadelphia | Crossref abstract https://api.crossref.org/works/10.1111/1540-6229.12401 | (Wiley 403; abstract only) |
| street_lighting | requires_investigation | none found | Crossref searches (2) | no property-value study returned |
| noise_wall | verified | Moretti & Wheeler 2025 (NBER WP), Florida | https://eml.berkeley.edu/~moretti/noise.pdf | |
| grocery | verified | Cerrato Caceres & Geoghegan 2017, Worcester MA | https://www.cambridge.org/core/journals/agricultural-and-resource-economics-review/article/effects-of-new-grocery-store-development-on-innercity-neighborhood-residential-prices/8B9211DFDBF757D7F938CB1122AC1657 | |
| corridor_trail | verified | Doucet et al. 2020, Waterloo Region (condos) | same Doucet PDF as protected_bike | |

Blocked in this session (no numbers taken from them): MDPI full texts for Russell & Kweon 2025 and Ebesu 2026 (403 on page, /htm and DOI), Wiley page for Lin et al. (403), SSRN for Polloni (403).

Notes
- Distance bands are cumulative or non-overlapping exactly as each study states; units are kept as published (m, ft, mile).
- Fractions of a mile (1/8, 1/4) in Russell & Kweon are recorded as 0.125 and 0.25 mile.
- Self-check (quote present in fetched text; band numbers present in quote; a "within X" band has implied inner 0): 7 verified records, 0 failures.
- Not used: Sander et al. 2010 (gradient per 10% tree cover, not a band); Dahir & Le 2025 (per-city results, no pooled band).
