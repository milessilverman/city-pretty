# County-bundle intervention catalog audit

Audited 2026-11-16. Audit only: nothing in the bundles or pipeline was changed. Machine-readable version:
`docs/audit/bundle-catalog-audit.json`.

## What was audited

- **The catalog**: 81 interventions in `app/data/bundle-la.b64.txt` → `catalog`. The page uses this one catalog for every county.
- **Recommendation rows**: `details[bg].r` in the OC bundle and the 637 `counties/bundle_*.json.gz` files, 2,208,065 rows across 177,527 block groups. Each row is `[id, project, homes, cost, capex, land, om, value, vpd, pct, why, qol]`.
- **`plans` and `profit`**: per-neighborhood plans and profit totals in the same bundles.
- **The code that made them**: `pipeline/engine.py` and `pipeline/build_oc.py`.
- **The research tables**: `research/effects.csv`, `unit_costs.csv`, `cost_factors.csv`, `citation_checks.csv`.

How each row's value is computed (from `pipeline/engine.py`):

    value = homes_reached × per_home × pct/100 × 1.03^-years × scale
    per_home = own% × ACS home value + (1 − own%) × ACS rent × 12 / 0.045
    cost = capex + land + 8.53 × yearly upkeep

## Classes

- **V**: effect and cost both confirmed against a source fetched in this audit.
- **P**: one of the two confirmed. For items with no dollar effect (`qol`), P means the cost cites a named public document.
- **U**: neither confirmed, the source wasn't found, the result can't be reproduced, or the catalog itself labels it unverified.

**Result: 1 V, 30 P, 50 U of 81.**
- The 48 items that produce a dollar value: 1 V, 7 P, 40 U.
- The only V is `traffic_calming`. Polloni's abstract says a 16% traffic cut raises values 1%, and LADOT's saved report gives $5,958 per hump.

Effect codes:
- **V**: number confirmed in fetched text.
- **R**: `effects.csv` records the quote, but the source returned 403 today.
- **C**: the study exists, but the number wasn't checked.
- **A**: the catalog itself calls it an assumption or a borrowed number.
- **X**: not found, irreproducible, or labelled an AI research pass.

Cost codes:
- **V**: checked against a document.
- **S**: cites a named document that wasn't re-fetched (most LA agency sites return 403 here).
- **X**: no source, or "Gemini research pass".

## Findings

1. **Half the modeled money comes from interventions the catalog itself calls unverified.**
   - Net modeled value (value minus cost, rows returning ≥ $1 per $1) across non-LA bundles is ~$1.03T.
   - By grade: U $513.1B, B $224.0B, C $170.7B, D $103.9B, A $15.8B.
   - The top two drivers are `corner_store` (19.6%, +1.9%) and `stormwater_park` (14.5%, +2.8%). `plaza` adds 7.9%. All three are grade U: "one AI research pass, cost and effect claims not checked".
   - The bundle's `profit` totals include these U items. That metric is behind the experimental toggle.
2. **The default map is mostly an assumption.**
   - Under the default evidence filter (grades A–D), the "best project" is `farmers_market` in 59.9% of 177,527 block groups.
   - That project is grade D: +0.25% assumed, from studies cited only as "Maryland 2020; Edmonton 2024". Its cost ($18k plus $40k/yr) has no source.
   - It wins because its cost is tiny. The ranking says more about the cost assumption than about evidence.
3. **The "measured" tier A can't be reproduced.**
   - Grade A is a single item: `street_trees`, citing "City Pretty local hedonic: 3,386 Westside sales 2022-24".
   - Neither the regression code nor the sales data exists in the repo or its git history. `pipeline/engine.py` says its numbers were "reverse-engineered from the LA County build".
   - The 0.24% low end ships in all 637 non-LA counties with the text "local sales estimate". It is the tier-A best project in 98.7% of block groups.
4. **A correct number can still be misapplied.**
   - `affordable_housing` uses Diamond &amp; McQuade's +6.5%, which their abstract confirms.
   - In the paper, +6.5% applies to tracts with median income under about $26k. The engine applies it wherever income is below LA's median of $93,240.
5. **Internal inconsistencies:**
   - `school_bond`'s catalog says "+6% used here", but the engine uses 3.0%. Cellini et al.'s "$1.50 per $1" is confirmed.
   - `ev_hub` cites "Liang et al. 2023 (14M California sales) +3.3% (confirmed)", but no such paper was found. The Crossref match is an unrelated preprint.
   - `adu` (+9.2%, Brueckner &amp; Thomaz 2024) wasn't found in Crossref, and the catalog admits the number is unverified. Every single-family block group shows it as `hv × 0.092`.
6. **The crime-to-price chain rests on one unchecked coefficient.**
   - `street_lighting`, `foot_patrol`, `violence_interruption` and `bid` each multiply a real crime study by a Schwartz–Susin–Voicu coefficient. The catalog itself says that coefficient is "not verified".
7. **Effect sizes the page doesn't use are actually solid.**
   - `research/effects.csv` has 31 rows marked confirmed. Of those I re-fetched, 22 quotes were found verbatim or near-verbatim (PDF line breaks); 9 sources returned 403. None was contradicted.
   - The engine doesn't read this file. Its numbers come from the catalog text. Example: street trees use the LA hedonic, not Donovan &amp; Butry's confirmed figures.
8. **Unshipped code with self-citing sources.**
   - `pipeline/engine.py` `CATALOG_EXTENSIONS` (8 items: `safe_school_corridor` grade A with a "25% compounding synergy", `park_trees`, `park_lighting`, `beach_nourishment` and others) cite their own effect sizes as sources ("Capitalization within 400 m: +1.0%").
   - They are in no shipped bundle yet. The next rebuild would ship them.
9. **Non-money text is mostly sourced.**
   - Gap "why" text ("Summers run 2.4°F hotter") comes from computed metrics: ACS, OSM, Tree Equity Score 2021, GTFS.
   - It is labelled with comparisons to the 50 most similar block groups. Not audited line by line.
10. **Other keys:** `eifd`, `oc_funding` and `oc_fees` are empty (null or "missing") in the national bundles. The LA `eifd` cites the LA County Auditor-Controller AF49 report, which wasn't re-fetched.

## Interventions that produce a dollar value (48)

| id | grade | effect used (%) | effect | cost | class | net modeled value, non-LA | note |
|---|---|---|---|---|---|---|---|
| corner_store | U | 1.9 | X | X | **U** | $205.9B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| stormwater_park | U | 2.8 | X | X | **U** | $152.6B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| school_bond | B | 3.0 | C | S | **U** | $98.3B | Cellini, Ferreira & Rothstein abstract confirms "$1.50 or more for each $1"; catalog says +6% used but engine uses pct 3.0 — inconsistent |
| park_upgrade | C | 0.5 | A | S | **U** | $92.3B | catalog: "No matched renovation coefficient"; 0.5% is an assumption |
| farmers_market | D | 0.25 | A | X | **U** | $89.5B | "Maryland 2020; Edmonton 2024" — no authors/titles; catalog: association, not this effect; 0.25% assumed |
| plaza | U | 2.9 | X | X | **U** | $82.6B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| ev_hub | C | 1.0 | X | S | **U** | $64.9B | "Liang et al. 2023 (14M California sales)" not found; Crossref hit is an unrelated preprint; 1% is a self-declared discount |
| community_garden | B | 0.5, 1.5 | C | S | **U** | $53.4B | Voicu & Been 2008 exists (REE); +1.5 pts not in abstract |
| blight_rehab | B | 2.3 | C | S | **U** | $36.4B | Ganduri & Maturana exists (2021 working paper on Crossref); +2.3 pts unchecked |
| upzone_transit | C | 3.0 | C | S | **U** | $20.7B | Kuhlmann 2021 exists (Crossref); +3-5% unchecked |
| night_market | U | 0.6 | X | X | **U** | $19.9B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| grocery | B | 4.0 | V | S | **P** | $17.2B | Worcester DiD (Cerrato Caceres et al.) +7%/+4% quote re-found (effects.csv row 22); engine uses 4.0 |
| street_trees | A | 0.24 | X | S | **U** | $15.8B | City Pretty local hedonic (3,386 Westside sales): no regression code or sales data in repo or git history; irreproducible. Shipped to 637 non-LA count |
| cooling_center | U | 0.4 | X | X | **U** | $12.6B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| undergrounding | B | 2.9 | V | S | **P** | $9.5B | McNair & Abelson abstract: "increase house prices by 2.9 per cent" (Canberra; transferred) |
| food_hall | U | 1.6 | X | X | **U** | $8.8B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| park_cafe | U | 0.6 | X | X | **U** | $7.6B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| slow_streets | U | 1.1 | X | X | **U** | $6.3B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| main_street | D | 1.0 | A | S | **U** | $6.1B | Ghorbani & Meltzer not found in Crossref; catalog: association, not a measured effect |
| bid | C | 0.418 | A | S | **U** | $6.1B | MacDonald et al. exists; price link via unverified coefficient |
| clt | U | 1.4 | X | X | **U** | $5.7B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| noise_wall | B | 6.8 | V | S | **P** | $5.7B | Moretti & Wheeler 6.8% quote re-found in eml.berkeley.edu PDF (effects.csv row 21) |
| bus_lane | D | 0.5 | A | S | **U** | $5.4B | scaled down from BRT (catalog caveat) |
| bike_share | U | 0.4 | X | X | **U** | $5.2B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| brt | B | 5.0 | V | S | **P** | $3.7B | Beaudoin & Tyndall +5-7%: quote re-found in UHERO working paper (effects.csv row 15); engine uses 5.0 |
| traffic_calming | C | 1.0 | V | V | **V** | $3.6B | Polloni abstract: "decreasing traffic by 16% raise home values on treated streets by 1%" (Crossref) |
| dog_park | D | 0.25 | A | S | **U** | $2.5B | catalog: +0.25% is an assumption; cited study coefficient not recovered |
| wayfinding | U | 0.2 | X | X | **U** | $2.4B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| pocket_park | C | 2.1, 3.0 | A | S | **U** | $2.0B | borrowed passive-park premium (catalog caveat) |
| microtransit | U | 0.9 | X | X | **U** | $1.5B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| freeway_cap | C | 5.0 | A | S | **U** | $1.3B | borrowed passive-park premium |
| solar | B | 1.2–240.024 (varies: 24000/home value) | C | S | **U** | $0.9B | LBNL "Selling into the Sun" exists (research-audit kept it); $4/W unchecked |
| vending_zone | U | 0.3 | X | X | **U** | $0.7B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| transit_shade | U | 0.5 | X | X | **U** | $0.6B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| foot_patrol | C | 2.668 | A | S | **U** | $0.5B | Ratcliffe RCT confirmed (crime); price link via unverified Schwartz coefficient |
| green_street | U | 1.2 | X | X | **U** | $0.3B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| ebike_library | U | 0.2 | X | X | **U** | $0.3B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| schoolyard_green | D | 1.0 | A | S | **U** | $0.3B | catalog caveat: +1% borrowed from passive parks |
| adu | B | 9.2 | X | S | **U** | $0.1B | Brueckner & Thomaz 2024 not found in Crossref; catalog admits 9.2% not verified |
| violence_interruption | C | 0.406 | A | S | **U** | $0.1B | Brantingham et al. exists (2023 on Crossref); price link via unverified coefficient |
| affordable_housing | B | 6.5 | V | S | **P** | $0.0B | Diamond & McQuade abstract confirms +6.5%/-2.5% (OpenAlex). MISAPPLIED: study +6.5% is for tracts with median income under ~$26k; engine applies it be |
| street_lighting | C | 1.358 | A | S | **U** | $0.0B | chains Chalfin crime RCT (exists) with Schwartz-Susin-Voicu coefficient the catalog itself says is unverified |
| vacant_lot_green | B | — | R | S | **P** | $0.0B | Lin, Jensen & Wachter (Real Estate Econ., 10.1111/1540-6229.12401): effects.csv records +4.3% quote; publisher 403 today |
| rail_station | C | 4.2 | V | S | **P** | $0.0B | Debrezion, Pels & Rietveld 2007 abstract: "about 4.2% for the average residence" (OpenAlex) |
| encampment | C | — | C | S | **U** | $0.0B | Bhandari 2024 exists (Crossref); -1.41% unchecked |
| new_school | U | — | X | X | **U** | $0.0B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| alley_gating | U | — | X | X | **U** | $0.0B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |
| box_art | U | — | X | X | **U** | $0.0B | grade U: "one AI research pass", cost and effect claims not checked (catalog self-label) |

## Interventions with no dollar effect (33, cost only)

| id | grade | effect used (%) | effect | cost | class | net modeled value, non-LA | note |
|---|---|---|---|---|---|---|---|
| green_alley | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| cool_pavement | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| pickleball | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| tennis | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| basketball | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| pool | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| splash_pad | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| skate_park | none | — | NA | S | **P** | $0.0B | no $ value effect used |
| sports_field | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| rec_center | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| restroom | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| bus_shelters | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| crosswalks | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| road_diet | none | — | NA | S | **P** | $0.0B | no $ value effect used |
| sidewalks | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| cameras | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| litter | none | — | NA | S | **P** | $0.0B | no $ value effect used |
| graffiti | none | — | NA | S | **P** | $0.0B | no $ value effect used |
| microgrid | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| school_filters | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| library | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| clinic | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| outdoor_dining | none | 0 | NA | S | **P** | $0.0B | no $ value effect used |
| protected_bike | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |
| corridor_trail | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |
| transit_priority | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |
| speed_cameras | none | — | NA | X | **U** | $0.0B | no $ value effect used |
| roundabout | none | — | NA | X | **U** | $0.0B | no $ value effect used |
| ped_signals | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |
| school_street | none | — | NA | X | **U** | $0.0B | no $ value effect used |
| murals | none | — | NA | X | **U** | $0.0B | no $ value effect used |
| tiny_forest | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |
| fiber_5g | none | 0 | NA | X | **U** | $0.0B | no $ value effect used |

## Recommended fix

1. **Remove U rows from every dollar figure, not just the default filter.** That means `profit`, plan step values, the Explore "back per $1" text and the AI context. Grade-U items can show as "lead, not an estimate" with no dollar amount.
2. **Stop shipping `street_trees` as grade A, and stop calling it a "local sales estimate" outside LA.**
   - Either commit the regression code and sales data so it can be reproduced, or regrade it to C and use a confirmed effect from `research/effects.csv`: Donovan &amp; Butry 2010 or Sander et al. 2010, both quote-checked.
3. **Hide `farmers_market` from the best-project ranking** until both its effect and its cost have a source. It currently decides the default map for 60% of block groups.
4. **Withhold the neighborhood `profit` / `per_home` figures entirely.**
   - They sum modeled value-minus-cost over rows, half of it from U items.
   - "Profit" is the wrong word anyway: it is modeled home-value gain to existing owners, not anyone's return.
5. **Fix the misapplications:** gate `affordable_housing` at the study's income level, reconcile `school_bond` (3% vs. 6%), and drop `ev_hub` until a real study is found.
6. **Wire the engine to `research/effects.csv`** (confirmed rows only) instead of free-text catalog sources, and add a CI test that every value-producing intervention maps to a confirmed row.
7. **Delete `CATALOG_EXTENSIONS`** or give each item real sources before the next rebuild.
