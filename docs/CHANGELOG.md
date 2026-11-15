# City Pretty Data & Accuracy Changelog

All notable changes to the data pipelines, empirical estimates, statutory engines, and underlying datasets of City Pretty are documented here, in accordance with `docs/ACCURACY-ROADMAP.md`.

---

## [2026-11-15] — Data Accuracy, Sourced Records & Hallucination Elimination

### 1. Research Study Library (`app/data/research.json`)
- **Deleted 488 generated filler studies** ("Study #24", "Education Economics & Public Finance Consortium #24", etc.) that lacked empirical provenance or peer-reviewed citations.
- **Verified 52 authentic empirical studies** across urban forestry, transit value capture, middle housing, street design, and traffic safety.
- Every study in `app/data/research.json` now includes:
  - `doi` or verified `source_url`
  - Canonical authors, journal name, year, and published title
  - Quoted empirical finding from the published paper
  - `retrieved` and `last_verified` dates ("2026-11-15")
- Decoupled `RESEARCH_CORPUS_500` from `app/app.js` into dynamic async fetch via `cpJson("research")`, cutting ~400KB from `app.js`.

### 2. Elimination of Hardcoded Stand-in Fallback Numbers
- Removed ~52 hardcoded fallback numbers across the codebase:
  - Home value: removed `|| 900000`, `750000`, `360000` stand-ins. Missing home values remain strictly `null` and display "not on file".
  - County population: removed `|| 500000`. Population missing values remain `null`.
  - Project costs: removed `|| 25000`.
  - Planned transit development costs: removed `|| 145000000` and invented debt splits.
  - Lot size: removed `lot || 6000`. Missing lot size is strictly `null`.
  - Living area: removed `1650` and `1800` defaults; missing living area is strictly `null`.
- Calculations that strictly require missing inputs now omit speculative projections or display "not on file" rather than presenting fabricated estimates.

### 3. Transit Pipelines & Federal Capital Investment Grants (`app/data/transit_pipelines.json`)
- Replaced synthetic corridors with 5 verified FTA Capital Investment Grant (CIG) and agency-adopted corridors (e.g., CTA Red Line Extension, DART Silver Line, Austin Project Connect Light Rail, Phoenix Valley Metro NW Extension Phase II, Sound Transit West Seattle Link).
- Unadopted speculative metrics (`tdc`, `seniorDebt`, `tifiaLoan`, `developerEquity`) are set strictly to `null`.
- Corridors cite official FTA CIG profile URLs and regional transit agency documents.

### 4. Historical Case Studies (`app/data/case_studies.json`)
- Sourced 8 authentic case studies (e.g., High Line NYC, BeltLine Atlanta, Indy Cultural Trail, Houston Buffalo Bayou Park, Denver Union Station, Minneapolis Midtown Greenway, Portland Eastbank Esplanade, Dallas Klyde Warren Park) with published third-party economic evaluations and official URLs.

### 5. State Housing Statutes & By-Right Zoning Engine (`app/data/statutes.json`, `app/data/state-housing-laws.json`, `src/engines/statutoryZoningEngine.ts`)
- Cataloged 9 verified state housing statutes (CA SB 79, CA SB 9, CA AB 2097, TX SB 840, TX SB 15, FL Live Local Act Fla. Stat. § 166.04151 & § 196.1979, WA HB 1110, OR HB 2001, AZ HB 2720/2721) with official state legislature links, effective dates, and statutory conditions.
- **Enforced strict zoning presence requirement (Roadmap Item 10)**:
  - Parcels with missing, unzoned, or unknown zoning codes never infer by-right housing rights or single-family residential status.
  - `lotSplitFeasible` requires verified local zoning; missing zoning sets `lotSplitFeasible: false` and explicitly notes that zoning is not on file.

### 6. Funding Programs & Tax Measures (`app/data/funding_programs.json`)
- Structured municipal and state funding programs into an empirical data table:
  - LA County Measure W (Safe, Clean Water Program)
  - LA City Proposition K (L.A. for Kids Program)
  - California Urban Greening Program (Cal. Health & Safety Code § 75129)
  - CAL FIRE Urban & Community Forestry Grant Program (Cal. Pub. Res. Code § 4799.06)
- Each program includes administering agency, statutory citation, eligible project scopes (such as stormwater capture street trees), match requirements, and application portal links.

### 7. Multi-State Assessment & Finance Profiles (`app/data/state_finance_profiles.json`)
- Decoupled `STATE_FINANCE_PROFILES` from `app/app.js` (cutting 885 lines of duplicate raw code) into `app/data/state_finance_profiles.json`.
- Enriched all 50 states + DC + PR profiles with:
  - Exact state assessment statutes (e.g. CA Prop 13 / RTC § 51, TX Tax Code § 23.23 / 311, FL SOH Fla. Stat. § 163 / 196.1979, MI Headlee / MCL 211.27a, OR Measure 50 ORS 308.146)
  - Official legislative portal URLs
  - `last_verified: "2026-11-15"`

### 8. Public Agency Construction Unit Costs (`app/data/unit_costs.json`)
- Structured verified construction bid items from `research/unit_costs.csv` into `app/data/unit_costs.json`.
- Covers confirmed contract pay items from TxDOT, FDOT, Gwinnett County DOT, NCDOT, CDOT, MnDOT, TDOT, and municipal bid tabs with unit prices, bid documents, quotes, and contract links.
- Items lacking verified public awards are strictly marked `status: "not_found"` with `unit_price: null`.

### 9. AI Advisor Grounding Contract (`src/ai/advisorGroundingContract.ts`)
- Expanded unified parcel shape to include `flood: boolean | null`, `fire: boolean | null`, `historic: boolean | null`, and `lotSplitEligibility: boolean | null`.
- Wired `serializeLiveAdvisorContext()` to pipe live environmental exclusions and statutory lot-split determinations directly into the AI context without hallucinated defaults.

### 10. Plain Labels & Language Hygiene
- Eliminated promotional adjectives and ungrounded claims across UI and engine docstrings (e.g., "Zillow-grade", "institutional-grade", "audited public records", "95% CI").
- Replaced with plain, factual descriptions: "Hedonic appraisal screening model", "USGS LiDAR and county assessor records".
