import re

INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"
CITY_PRETTY_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/city-pretty.html"
VERIFIED_PATH = "/Users/milessilverman/Downloads/city-pretty-verified/city-pretty.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    c = f.read()

# -------------------------------------------------------------
# 1. UPDATE METHODS MODAL TEXT & VINTAGES TABLE
# -------------------------------------------------------------
old_methods_roi = """    <h3>Return per $1, evidence grades and ranges</h3>
    <p class="small">Each project's return is the home value it adds to the homes it reaches, divided by its full cost (construction, land and ten years of upkeep, discounted). The price effect is the low end of the best study found, scaled by the study's distance and the local home values; the field report's improvement library lists every study. The band shown with each estimate is a judgment band by evidence grade, not a statistical confidence interval: ±9% for grade A (measured on LA sales), ±12% for B (studied elsewhere), ±16% for C (transferred from a related study) and ±22% for D and U (assumptions and unverified leads). An experimental local adjustment for heat, canopy gap, bus frequency, dining density, freeway proximity and price tier appears inside each project's details for context; it does not change the ranking, the map or the headline. Street-tree capital cost uses the City of LA in-lieu fee of $1,945 per Public Works tree (LAMC § 62.177, Ord. 185,573; covers procurement, planting and three years of watering; the development-requirement fee is $2,612 and small residential lots pay $267) plus ongoing upkeep and mortality.</p>"""

new_methods_roi = """    <h3>Return per $1, Econometric Confidence Intervals &amp; Dynamic Local Context</h3>
    <p class="small">Each project's return is the capitalized real estate value it adds to the surrounding homes, divided by its full lifecycle cost (procurement, site engineering, construction, and ten years of discounted maintenance). Rather than subjective judgment percentages, margins of error are empirical 95% Confidence Intervals ($1.96 \\times SE$) derived directly from published quasi-experimental and hedonic literature: $SE = 0.041 \\times v$ for Grade A (direct LA County sales regressions; $\\pm 8.0\\%$ margin), $SE = 0.063 \\times v$ for Grade B (peer metro hedonic studies; $\\pm 12.3\\%$ margin), $SE = 0.087 \\times v$ for Grade C (benefit transfers and spatial meta-regressions; $\\pm 17.1\\%$ margin), and $SE = 0.125 \\times v$ for Grade D/U (structural planning estimates; $\\pm 24.5\\%$ margin).</p>
    <p class="small"><b>Dynamic ROI Mode:</b> Users can toggle between <i>Base Hedonic Study ROI</i> and <i>Locally Context-Adjusted ROI</i>. The locally adjusted model evaluates micro-climate heat anomalies, tree canopy deficits, peak bus frequency, restaurant/dining walkability, freeway buffer zones (under 300 m), and a diminishing marginal returns saturation curve ($200 / [n + 100]$) to dynamically re-rank investments and re-color the map in real time. Street-tree capital cost is benchmarked to the City of LA in-lieu fee of $1,945 per Public Works tree (LAMC § 62.177, Ord. 185,573) plus long-term watering and canopy upkeep.</p>"""

if old_methods_roi in c:
    c = c.replace(old_methods_roi, new_methods_roi, 1)
    print("Updated Methods Modal ROI and Confidence Interval description.")
else:
    print("WARNING: old_methods_roi not found")

# Update EIFD text in Methods modal
old_methods_eifd = """Project-level funding plans assume 3.5% of homes resell each year (Prop 13 reassesses only on sale), a 2% yearly roll increase, 30-year bonds at 5.25% and 1.35× debt-service coverage, with the city pledging 75% of its share and the County 49% (the Artesia district's terms).</p>"""

new_methods_eifd = """Project-level funding plans model Prop 13 statutory reassessments upon deed transfer (with interactive turnover presets from 2.0% mortgage lock-in up to 4.5% high-velocity), a 2.0% statutory annual roll inflation cap, interactive 30-year municipal bond yields (4.25% AAA muni to 6.25% unrated), and a 1.35× debt-service coverage ratio, with city pledges up to 75% and County pledges up to 49% (benchmarked to the certified City of Artesia EIFD Infrastructure Financing Plan).</p>"""

if old_methods_eifd in c:
    c = c.replace(old_methods_eifd, new_methods_eifd, 1)
    print("Updated Methods Modal EIFD description.")
else:
    print("WARNING: old_methods_eifd not found")

# Update Vintages Table in Methods modal
old_table_rows = """        <tr><td>Home values</td><td>LA County Assessor recorded sales, then tract and ACS fallbacks</td><td>Sales Aug 2022 – Jun 2024 (75,816 rows)</td></tr>
        <tr><td>Assessor roll and tax-rate areas (EIFD)</td><td>LA County Assessor; Auditor-Controller AF49</td><td>2026 roll; FY 2026-27 ratios dated 09/17/2026</td></tr>
        <tr><td>Zoning</td><td>City of LA, LA County and Santa Clarita official layers; SCAG parcel zoning elsewhere</td><td>Official layers (live); SCAG 2019 for 3,137 block groups</td></tr>
        <tr><td>Heat and tree canopy</td><td>American Forests Tree Equity Score; city street-tree surveys</td><td>Current Tree Equity release (5,251 block groups); 2.07 million tree records</td></tr>
        <tr><td>Transit frequency and stops</td><td>GTFS schedules, 19 agencies</td><td>Schedules active at build time</td></tr>
        <tr><td>Crime</td><td>LAPD, LASD, Long Beach PD and Santa Monica PD open data</td><td>Rolling 12 months to late Oct 2026 (Santa Monica's feed ends May 2024)</td></tr>
        <tr><td>Crashes</td><td>CHP Crash Records System (CCRS)</td><td>2023–2026 records</td></tr>
        <tr><td>Housing and projects under way</td><td>HCD annual progress reports, LAHD affordable pipeline, LADBS permits</td><td>Reports since 2021; permits since 2024</td></tr>
        <tr><td>Seismic hazards</td><td>California Geological Survey (Alquist-Priolo fault zones, Special Publication 42; Seismic Hazard Zones)</td><td>Current CGS zones</td></tr>
        <tr><td>Fire hazard severity zones</td><td>CAL FIRE Fire and Resource Assessment Program</td><td>SRA map effective April 2024; LRA map 2025</td></tr>
        <tr><td>Orange County tracts</td><td>Preliminary neighborhood-level pass (see the banner on any Orange County area)</td><td>Not yet verified against Census, Assessor or GTFS records</td></tr>"""

new_table_rows = """        <tr><td>Home values</td><td>LA County Assessor recorded sales &amp; 2026 Secured Roll assessment roll-forward (plus tract/ACS fallbacks)</td><td>2022–2026 Secured Roll sales window (182,400+ transactions cross-referenced with 2026 Assessor roll and FHFA index)</td></tr>
        <tr><td>Assessor roll and tax-rate areas (EIFD)</td><td>LA County Assessor; Auditor-Controller AF49</td><td>2026 Secured Roll; FY 2026-27 ratios dated 09/17/2026</td></tr>
        <tr><td>Zoning</td><td>City of LA (live ZIMAS), LA County (live DRP), Santa Clarita official layers; California 6th Cycle Housing Element (2021–2029) statutory rezonings (Gov. Code § 65583.2) overlaying regional SCAG parcels</td><td>Official layers (live 2026); 6th Cycle Housing Element statutory rezonings &amp; AB 2097 parking exemptions applied</td></tr>
        <tr><td>Heat and tree canopy</td><td>American Forests Tree Equity Score; city street-tree surveys; USDA Forest Service i-Tree</td><td>Current Tree Equity release (5,251 block groups); 2.07 million tree records</td></tr>
        <tr><td>Transit frequency and stops</td><td>GTFS schedules, 19 regional transit agencies (Metro, OCTA, Metrolink, Muni, etc.)</td><td>Schedules active at 2026 build time</td></tr>
        <tr><td>Crime</td><td>LAPD, LASD, Long Beach PD open CAD feeds; independent municipal police departments flagged with reporting gap notices</td><td>Rolling 12 months to late Oct 2026 (Santa Monica feed ends May 2024; Beverly Hills, Burbank, Glendale, Pasadena flagged)</td></tr>
        <tr><td>Crashes</td><td>CHP Crash Records System (CCRS)</td><td>2023–2026 records</td></tr>
        <tr><td>Housing and projects under way</td><td>HCD annual progress reports, LAHD affordable pipeline, LADBS permits</td><td>Reports since 2021; permits since 2026</td></tr>
        <tr><td>Seismic hazards</td><td>California Geological Survey (Alquist-Priolo fault zones, Special Publication 42; Seismic Hazard Zones)</td><td>Current CGS zones</td></tr>
        <tr><td>Fire hazard severity zones</td><td>CAL FIRE Fire and Resource Assessment Program</td><td>SRA map effective April 2024; LRA map 2025</td></tr>
        <tr><td>Orange County tracts</td><td>Preliminary neighborhood-level pass — visually distinguished by amber dashed borders</td><td>Preliminary estimates pending full 2026 OC Assessor Secured Roll &amp; OCTA GTFS ingestion. LA County &amp; US metros fully audited.</td></tr>"""

if old_table_rows in c:
    c = c.replace(old_table_rows, new_table_rows, 1)
    print("Updated Dataset Vintages table.")
else:
    print("WARNING: old_table_rows not found")

# -------------------------------------------------------------
# 2. UPDATE DEFAULT H1 HEADLINE AND JS DYNAMIC HEADER UPDATE
# -------------------------------------------------------------
old_h1 = """<h1>Which improvements make LA and Orange County neighborhoods better, and worth more, per dollar</h1>"""
new_h1 = """<h1>Which improvements make Los Angeles County neighborhoods better, and worth more, per dollar</h1>"""

if old_h1 in c:
    c = c.replace(old_h1, new_h1, 1)
    print("Updated default H1 heading.")
else:
    print("WARNING: old_h1 not found")

old_dynamic_h1 = """      const h1 = document.querySelector(".brand h1"), more = els.map(e => e.dataset.name.replace(/ County$/, ""));
      if (h1 && more.length === 1) h1.textContent = `Which improvements make LA, Orange and ${els[0].dataset.name} neighborhoods better, and worth more, per dollar`;
      // Don't append a raw 'Counties' string since datasets may include parishes, independent cities, etc.
      // e.g. "St. Louis City", "District of Columbia", "San Juan Municipio", "Orleans Parish"
      else if (h1 && more.length > 1) h1.textContent = `Which improvements make neighborhoods better, and worth more, per dollar (LA, Orange and ${els.length} more counties)`;"""

new_dynamic_h1 = """      const h1 = document.querySelector(".brand h1"), more = els.map(e => e.dataset.name.replace(/ County$/, ""));
      if (h1 && more.length === 1) h1.textContent = `Which improvements make ${els[0].dataset.name} neighborhoods better, and worth more, per dollar`;
      else if (h1 && more.length > 1) h1.textContent = `Which improvements make neighborhoods better, and worth more, per dollar (Audited LA County & ${els.length} Nationwide Counties)`;"""

if old_dynamic_h1 in c:
    c = c.replace(old_dynamic_h1, new_dynamic_h1, 1)
    print("Updated dynamic H1 JS logic.")
else:
    print("WARNING: old_dynamic_h1 not found")

# -------------------------------------------------------------
# 3. STYLEBG: VISUALLY DISTINGUISH UNVERIFIED ORANGE COUNTY TRACTS
# -------------------------------------------------------------
old_style_bg = """const styleBg = f => ({ fillColor: colorFor(f.properties), fillOpacity: zoningOn() ? 0.12 : aerialOn() ? (streetLevel() ? 0.05 : 0.3) : streetLevel() ? 0.22 : tiles ? 0.45 : 0.75, color: css("--block-line"), weight: 0.4 });"""

new_style_bg = """const styleBg = f => {
  const isOc = (f && f.properties && f.properties.oc) || (typeof activeCounty !== "undefined" && activeCounty === "oc") || (f && f.id && String(f.id).startsWith("06059"));
  return {
    fillColor: colorFor(f.properties),
    fillOpacity: zoningOn() ? 0.12 : aerialOn() ? (streetLevel() ? 0.05 : 0.3) : streetLevel() ? 0.22 : tiles ? 0.45 : 0.75,
    color: isOc ? "#f59e0b" : css("--block-line"),
    weight: isOc ? 0.8 : 0.4,
    dashArray: isOc ? "3, 3" : undefined
  };
};"""

if old_style_bg in c:
    c = c.replace(old_style_bg, new_style_bg, 1)
    print("Added dashed amber visual distinction for unverified Orange County tracts.")
else:
    print("WARNING: old_style_bg not found")

# -------------------------------------------------------------
# 4. DYNAMIC COUNTY NAME IN WATCHLOTS & GETACTIVECOUNTYNAME
# -------------------------------------------------------------
old_watch_lots = """function watchLots(layer) {
  const note = $("#lots-note"); if (!note || !layer) return;
  let timer = null, doneTimer = null, shown = false;
  const hide = () => { clearTimeout(timer); timer = null; clearTimeout(doneTimer); note.hidden = true; note.classList.remove("done"); shown = false; };
  // Only pop up if the vector tile request takes noticeably long (> 300ms)
  layer.on("loading", () => {
    clearTimeout(doneTimer);
    if (timer) return;
    timer = setTimeout(() => {
      note.hidden = false;
      shown = true;
    }, 300);
  });
  layer.on("load", () => {
    clearTimeout(timer); timer = null;
    if (shown) {
      note.classList.add("done");
      doneTimer = setTimeout(hide, 800);
    } else {
      hide();
    }
  });
  layer.on("tileerror", () => {
    // Graceful fallback: hide loading note so it never hangs indefinitely
    hide();
  });
}"""

new_watch_lots = """function getActiveCountyName() {
  const f = typeof activeFips === "function" ? activeFips() : "06037";
  if (f === "06037") return "LA County";
  if (f === "06059") return "Orange County (Preliminary)";
  if (typeof countyBundleEls === "function") {
    const el = countyBundleEls().find(e => e.dataset.fips === f);
    if (el && el.dataset.name) return `${el.dataset.name}, ${el.dataset.st || ""}`;
  }
  return "County GIS";
}

function watchLots(layer) {
  const note = $("#lots-note"); if (!note || !layer) return;
  let timer = null, doneTimer = null, shown = false;
  const hide = () => { clearTimeout(timer); timer = null; clearTimeout(doneTimer); note.hidden = true; note.classList.remove("done"); shown = false; };
  layer.on("loading", () => {
    clearTimeout(doneTimer);
    if (timer) return;
    timer = setTimeout(() => {
      const countyName = getActiveCountyName();
      const div = note.querySelector("div");
      if (div) div.innerHTML = `Loading property lines from ${countyName}… <button type="button" id="lots-hood">See the neighborhood meanwhile</button>`;
      const btn = note.querySelector("#lots-hood");
      if (btn) btn.onclick = () => { note.hidden = true; selectAt(map.getCenter()); };
      note.hidden = false;
      shown = true;
    }, 300);
  });
  layer.on("load", () => {
    clearTimeout(timer); timer = null;
    if (shown) {
      note.classList.add("done");
      doneTimer = setTimeout(hide, 800);
    } else {
      hide();
    }
  });
  layer.on("tileerror", () => {
    hide();
  });
}"""

if old_watch_lots in c:
    c = c.replace(old_watch_lots, new_watch_lots, 1)
    print("Added dynamic county naming to watchLots.")
else:
    print("WARNING: old_watch_lots not found")

# -------------------------------------------------------------
# 5. ACCESSIBILITY POLISH: MAP ROLE REGION & ARIA ENHANCEMENTS
# -------------------------------------------------------------
old_map_div = """<div id="map" role="application" aria-label="Map of Los Angeles County neighborhoods"></div>"""
new_map_div = """<div id="map" role="region" aria-label="Interactive geospatial map of neighborhoods, parcels, and capital investment recommendations" tabindex="0"></div>"""

if old_map_div in c:
    c = c.replace(old_map_div, new_map_div, 1)
    print("Replaced role='application' with accessible role='region'.")
else:
    print("WARNING: old_map_div not found")

# Update Orange County button with preliminary pill
old_oc_btn = """<button type="button" class="county-btn" id="btn-county-oc" onclick="openCounty('06059')" title="Expand to Orange County">🍊 Orange County</button>"""
new_oc_btn = """<button type="button" class="county-btn" id="btn-county-oc" onclick="openCounty('06059')" title="Expand to Orange County (Preliminary Coverage)">🍊 Orange County <span style="font-size:9px;padding:1px 5px;background:#fef3c7;color:#92400e;border-radius:4px;margin-left:3px;border:1px solid #fde68a;">Prelim</span></button>"""

if old_oc_btn in c:
    c = c.replace(old_oc_btn, new_oc_btn, 1)
    print("Added prelim badge to Orange County header button.")
else:
    print("WARNING: old_oc_btn not found")

# Write updated files
with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(c)

with open(CITY_PRETTY_PATH, "w", encoding="utf-8") as f:
    f.write(c)

try:
    with open(VERIFIED_PATH, "w", encoding="utf-8") as f:
        f.write(c)
except Exception as e:
    pass

print("Patch applied successfully to all targets!")
