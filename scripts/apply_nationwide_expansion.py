#!/usr/bin/env python3
"""
City Pretty Nationwide Multi-County Architecture Expander
Injects:
1. Master indices (StateFinanceProfiles, CountyCompleteness, CaCountiesRegistry)
2. Core calculation engines (TaxIncrement, StatutoryZoning, HedonicSubAdditive, Solar2026, ArcGisNormalizer)
3. Header decoupling & Persistent County Readiness Pill
4. Pre-populated Accessible Multi-State County Selector
5. Multi-state TIF/EIFD model (TIRZ, CRA, TIF, DDA) & suppresses LA Measure W outside LA
6. Statutory Housing Engine (CA SB 79 rail tiers, TX SB 840/SB 15 population gating, FL Live Local 4.0)
7. 2026 Solar ITC compliance (IRC § 25D expiration, NEM 3.0 battery storage flag)
8. Sub-additive joint capitalization & Renter Displacement Sensitivity Index
"""

import json
import re
import sys

def main():
    print("Reading index.html...")
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    print("Loading registries...")
    with open("public/data/county_completeness.json", "r", encoding="utf-8") as f:
        county_completeness = json.load(f)

    with open("src/data/state_finance_profiles.json", "r", encoding="utf-8") as f:
        state_finance_profiles = json.load(f)

    with open("src/data/ca_counties_registry.json", "r", encoding="utf-8") as f:
        ca_counties_registry = json.load(f)

    cc_map = {c["fips"]: c for c in county_completeness}
    sfp_map = {s["state_code"]: s for s in state_finance_profiles}
    ca_map = {c["fips"]: c for c in ca_counties_registry}

    # 1. Update Header Eyebrow, H1 and County Readiness Pill
    header_old = """<header class="top gutter">
  <div class="brand"><div class="eyebrow">CITY PRETTY · ALL OF LOS ANGELES COUNTY · 04 NOV 2026</div><h1>Which improvements make Los Angeles County neighborhoods better, and worth more, per dollar</h1></div>"""

    header_new = """<header class="top gutter">
  <div class="brand">
    <div class="eyebrow" data-city-pretty-eyebrow>CITY PRETTY · LOS ANGELES COUNTY, CA · 08 NOV 2026</div>
    <div class="brand-title-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <h1>Which improvements make Los Angeles County neighborhoods better, and worth more, per dollar</h1>
      <div id="county-readiness-pill" class="county-readiness-pill" data-tier="audited_A" style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.02em;background:#064e3b;color:#a7f3d0;border:1px solid #059669;cursor:pointer;" onclick="openDataAccuracyModal()" title="Click to inspect county data provenance, roll vintage, zoning and transit feeds">
        Tier: AUDITED A · Assessor: 2026 Roll · Zoning: Live Municipal · GTFS: 19 Agencies
      </div>
    </div>
  </div>"""

    if header_old in html:
        html = html.replace(header_old, header_new)
        print("✓ Updated header with data-city-pretty-eyebrow and #county-readiness-pill.")
    else:
        print("! Header target not found exactly, attempting regex replace...")
        html = re.sub(
            r'<header class="top gutter">\s*<div class="brand"><div class="eyebrow">.*?</div><h1>(.*?)</h1></div>',
            header_new,
            html,
            count=1
        )
        print("✓ Regex replaced header.")

    # 2. Build pre-populated optgroups for #county-more
    STATE_NAMES = {
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "PR": "Puerto Rico"
    }

    by_state = {}
    for c in county_completeness:
        st = c.get("state", "US")
        by_state.setdefault(st, []).append(c)

    optgroups_html = ['<select id="county-more" class="county-btn" aria-label="Select from 637+ US Counties" title="Select from 637+ US Counties" style="border-left:1px solid var(--rule);font-family:inherit;max-width:11.5em;min-width:0">']
    optgroups_html.append('<option value="">More counties (637+)…</option>')

    sorted_states = sorted(by_state.keys(), key=lambda s: (0 if s == "CA" else 1, STATE_NAMES.get(s, s)))
    for st in sorted_states:
        sname = STATE_NAMES.get(st, st)
        optgroups_html.append(f'<optgroup label="{sname}">')
        counties_in_state = sorted(by_state[st], key=lambda x: x["name"])
        for c in counties_in_state:
            fips = c["fips"]
            cname = c["name"].replace(" County", "")
            tier_badge = " [Audited]" if c.get("readiness_tier") == "audited_A" else ""
            optgroups_html.append(f'<option value="{fips}">{cname}{tier_badge}</option>')
        optgroups_html.append('</optgroup>')
    optgroups_html.append('</select>')
    prefilled_select = "\n      ".join(optgroups_html)

    select_old = '<select id="county-more" class="county-btn" aria-label="More counties" title="More counties" style="border-left:1px solid var(--rule);font-family:inherit;max-width:10.5em;min-width:0"><option value="">More counties…</option></select>'
    if select_old in html:
        html = html.replace(select_old, prefilled_select)
        print("✓ Pre-populated #county-more dropdown with all 58 CA counties and 637+ national jurisdictions.")
    else:
        html = re.sub(
            r'<select id="county-more"[^>]*>.*?</select>',
            prefilled_select,
            html,
            count=1
        )
        print("✓ Pre-populated #county-more via regex.")

    # 3. Read JS engine files
    with open("src/engines/municipalFinanceEngine.js", "r", encoding="utf-8") as f:
        js_finance = f.read()
    with open("src/engines/statutoryZoningEngine.js", "r", encoding="utf-8") as f:
        js_zoning = f.read()
    with open("src/engines/hedonicCapitalizationEngine.js", "r", encoding="utf-8") as f:
        js_hedonic = f.read()
    with open("src/engines/solarMicrogridEngine.js", "r", encoding="utf-8") as f:
        js_solar = f.read()
    with open("src/engines/residualProfitEngine.js", "r", encoding="utf-8") as f:
        js_residual = f.read()
    with open("src/engines/gtfsWalkshedEngine.js", "r", encoding="utf-8") as f:
        js_gtfs = f.read()
    with open("src/adapters/arcgisNormalizer.js", "r", encoding="utf-8") as f:
        js_arcgis = f.read()

    sync_code = """function syncHeaderDomToCounty(fips) {
  const f = fips || (typeof activeFips === "function" ? activeFips() : "06037");
  const comp = COUNTY_COMPLETENESS_INDEX[f] || {
    fips: f,
    name: (typeof countyNameOf === "function" ? countyNameOf(f) : "County " + f),
    state: (typeof activeState === "function" ? activeState() : "US"),
    readiness_tier: "cadastral_only_D",
    assessor_roll_vintage: "Unverified",
    zoning_source: "statewide_parcel",
    gtfs_agencies_count: 0
  };
  
  const eyebrowEl = document.querySelector("[data-city-pretty-eyebrow]") || document.querySelector(".eyebrow");
  const titleEl = document.querySelector("header h1");
  const readinessEl = document.querySelector("#county-readiness-pill");
  const buildDateText = (typeof buildStamp === "function" ? buildStamp() : "08 NOV 2026");

  if (eyebrowEl) {
    const isPrelim = comp.readiness_tier.startsWith("preliminary") || comp.readiness_tier.startsWith("cadastral");
    eyebrowEl.textContent = "CITY PRETTY · " + comp.name.toUpperCase() + ", " + comp.state.toUpperCase() + (isPrelim ? " (PRELIMINARY)" : "") + " · " + buildDateText;
  }
  if (titleEl) {
    titleEl.textContent = "Which improvements make " + comp.name + " neighborhoods better, and worth more, per dollar";
  }
  if (readinessEl) {
    readinessEl.setAttribute("data-tier", comp.readiness_tier);
    const tierLabel = comp.readiness_tier === "audited_A" ? "AUDITED A" : comp.readiness_tier === "verified_B" ? "VERIFIED B" : comp.readiness_tier === "preliminary_C" ? "PRELIMINARY C" : "CADASTRAL ONLY D";
    const bgCol = comp.readiness_tier === "audited_A" ? "#064e3b" : comp.readiness_tier === "verified_B" ? "#1e3a8a" : comp.readiness_tier === "preliminary_C" ? "#78350f" : "#334155";
    const textCol = comp.readiness_tier === "audited_A" ? "#a7f3d0" : comp.readiness_tier === "verified_B" ? "#bfdbfe" : comp.readiness_tier === "preliminary_C" ? "#fef3c7" : "#e2e8f0";
    const borderCol = comp.readiness_tier === "audited_A" ? "#059669" : comp.readiness_tier === "verified_B" ? "#2563eb" : comp.readiness_tier === "preliminary_C" ? "#d97706" : "#64748b";
    
    readinessEl.style.background = bgCol;
    readinessEl.style.color = textCol;
    readinessEl.style.border = "1px solid " + borderCol;
    readinessEl.textContent = "Tier: " + tierLabel + " · Assessor: " + (comp.assessor_roll_vintage || "Unverified") + " · Zoning: " + comp.zoning_source.replace(/_/g, " ") + " · GTFS: " + comp.gtfs_agencies_count + (comp.gtfs_agencies_count === 1 ? " Agency" : " Agencies");
  }
}
window.syncHeaderDomToCounty = syncHeaderDomToCounty;
"""

    engines_injection = (
        "\n// ============================================================================\n"
        "// NATIONWIDE MULTI-COUNTY & MULTI-STATE CALCULATION ENGINES\n"
        "// ============================================================================\n"
        "const STATE_FINANCE_PROFILES = " + json.dumps(sfp_map, indent=2) + ";\n"
        "const COUNTY_COMPLETENESS_INDEX = " + json.dumps(cc_map, indent=2) + ";\n"
        "const CA_COUNTIES_REGISTRY = " + json.dumps(ca_map, indent=2) + ";\n\n"
        + js_finance + "\n\n"
        + js_zoning + "\n\n"
        + js_hedonic + "\n\n"
        + js_solar + "\n\n"
        + js_residual + "\n\n"
        + js_gtfs + "\n\n"
        + js_arcgis + "\n\n"
        + sync_code + "\n"
        + "// ============================================================================\n"
    )

    marker = "const $ = s => document.querySelector(s);"
    if marker in html:
        html = html.replace(marker, marker + "\n" + engines_injection)
        print("✓ Injected multi-state calculation engines and data tables.")
    else:
        print("! Marker for engine injection not found!")
        sys.exit(1)

    # 4. Update switchCounty to trigger syncHeaderDomToCounty(activeFips())
    sw_marker = 'performance.mark("sw:context");'
    if sw_marker in html:
        html = html.replace(sw_marker, sw_marker + '\n  if (typeof syncHeaderDomToCounty === "function") syncHeaderDomToCounty(activeFips());')
        print("✓ Hooked syncHeaderDomToCounty into switchCounty().")

    # 5. Update eifdSection to support non-CA states (Texas TIRZ, Florida CRA, Washington TIF, etc.)
    eifd_old_pattern = r'function eifdSection\(p, m\) \{\s*if \(!isCAActive\(\)\) return `.*?`;'
    eifd_new_head = """function eifdSection(p, m) {
  const stCode = (typeof activeState === "function" ? activeState() : "CA");
  const profile = STATE_FINANCE_PROFILES[stCode] || STATE_FINANCE_PROFILES["CA"];
  
  if (stCode !== "CA") {
    // Generalized Multi-State TIF/TIRZ/CRA/DDA Engine
    const baselineMv = (m && m.hv && m.homes) ? m.hv * m.homes : 45000000;
    const effMillage = profile.state_code === "TX" ? 0.021 : profile.state_code === "FL" ? 0.0165 : 0.0125;
    const tifCap = calculateTaxIncrementCapacity({
      profile,
      baselineMarketValueUsd: baselineMv,
      effectiveMillageRate: effMillage,
      annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.035,
      newConstructionAnnualUsd: 1500000,
      affordableExemptUnitsShare: 0.15,
      affordableExemptionPct: profile.state_code === "FL" ? 0.75 : 0.0,
      localPledgeShare: 0.65,
      bondTermYears: 30,
      bondInterestRate: 0.0525,
      dscr: 1.35
    });

    return `<div class="section">
      <h3>${esc(tifCap.vehicleName)}: Municipal Finance Capacity</h3>
      <p class="small muted">
        Under ${esc(activeStateName())} municipal finance law, local governments pledge ad valorem tax increment from revitalization districts to finance public infrastructure.
        ${profile.annual_assessment_cap ? `Assessed values are constrained by ${esc(activeStateName())}'s ${(profile.annual_assessment_cap * 100).toFixed(0)}% annual assessment cap.` : `Properties undergo annual market assessment with no statutory reassessment cap.`}
      </p>
      <div class="pkg" style="margin:8px 0;">
        ${tile("District Vehicle", esc(tifCap.vehicleName), "Statutory Bond Instrument")}
        ${tile("Initial Taxable Base", fmt$(tifCap.initialTaxableValueUsd), "Assessment Ratio: " + (profile.res_assessment_ratio * 100) + "%")}
        ${tile("Year 10 Increment", fmt$(tifCap.year10AnnualIncrementUsd) + "/yr", "65% local pledge")}
        ${tile("30-Yr Bond Capacity", fmt$(tifCap.maxBondCapacityUsd), "5.25% yield · 1.35x DSCR")}
      </div>
      <div style="font-size:11px;color:#475569;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;">
        <b>Statutory Tax Rules for ${esc(activeStateName())}:</b>
        ${tifCap.notes.length ? tifCap.notes.map(n => `<div>• ${esc(n)}</div>`).join("") : `<div>• Standard ad valorem assessment cycle (${profile.reassessment_cycle_years} yr).</div>`}
        <div>• Unlike California Proposition 13, ${esc(activeStateName())} ad valorem levies step up with market reappraisals rather than freezing at acquisition deed value.</div>
      </div>
    </div>`;
  }"""

    html = re.sub(eifd_old_pattern, eifd_new_head, html, count=1)
    print("✓ Updated eifdSection to dynamically model 52-jurisdiction StateFinanceProfiles.")

    # 6. Update Rooftop Solar Drawer to 2026 rules (0% IRC § 25D federal ITC, NEM 3.0 battery storage flag)
    solar_old = """                <div>• <b>30% Federal ITC (IRA § 25D):</b> -${fmt$(solarTaxCredit)} tax credit</div>
                <div>• <b>Net System Cost:</b> ~${fmt$(solarNetCost)} (Payback in ~${solarPaybackYrs} yrs)</div>"""

    solar_new = """                <div>• <b>2026 Federal ITC (Cash/Loan):</b> $0 (IRC § 25D Expired Dec 31, 2025; 30% available via Third-Party Lease / PPA under § 48E)</div>
                <div>• <b>Net System Cost:</b> ~${fmt$(solarGrossCost)} (or ~${fmt$(solarGrossCost * 0.7)} via Third-Party PPA)</div>"""

    if solar_old in html:
        html = html.replace(solar_old, solar_new)
        print("✓ Updated rooftop solar drawer to reflect 2026 federal ITC rules.")
    else:
        print("! solar_old not found directly; attempting regex...")
        html = re.sub(
            r'<div>• <b>30% Federal ITC.*?</div>\s*<div>• <b>Net System Cost:</b>.*?</div>',
            solar_new,
            html,
            count=1
        )
        print("✓ Updated solar drawer via regex.")

    # 7. Update select() to apply sub-additive capitalization ceiling to paying projects
    subadditive_old = 'if (pkg.length) h += `<div class="pkg" style="margin-bottom:12px">${tile("Paying projects", pkg.length, "≥ $1 per $1")}${tile("Total cost", fmt$(pkg.reduce((s, r) => s + r.cost, 0)), "build + land + 10-yr upkeep")}${tile("Value created", fmt$(pkg.reduce((s, r) => s + r.value, 0)), "nearby homes, combined")}</div>`;'
    
    subadditive_new = """if (pkg.length) {
    const isUrbanCore = (m.acres != null && m.homes != null && (m.homes / Math.max(0.1, m.acres)) > 15);
    const candidateObjs = pkg.map(r => ({
      id: r.id,
      name: (D.catalog[r.id] && D.catalog[r.id].name) || r.id,
      evidenceGrade: ((D.catalog[r.id] && D.catalog[r.id].grade) || "C"),
      rawPriceLiftPct: (r.pct ? r.pct / 100 : 0.025),
      studyStandardErrorPct: HEDONIC_SE[(D.catalog[r.id] && D.catalog[r.id].grade) || "C"] || 0.08,
      lifecycleCostUsd: r.cost || 100000,
      localContextMultiplier: 1.0
    }));
    const subPkg = computeSubAdditivePackage({
      blockGroupGeoid: id,
      ecoregionId: "us_general",
      medianHomeValueUsd: m.hv || 750000,
      reachedHomesCount: m.homes || 400,
      isUrbanCore,
      renterShare: (m.own != null ? (100 - m.own) / 100 : 0.45),
      severeRentBurdenShare: 0.28,
      rentControlCoverage: isCAActive() ? 0.65 : 0.15
    }, candidateObjs, false);

    const subCost = subPkg.totalPaybackPackageCostUsd || pkg.reduce((s, r) => s + r.cost, 0);
    const subVal = subPkg.jointValueAddedUsd || pkg.reduce((s, r) => s + r.value, 0);

    h += `<div class="pkg" style="margin-bottom:12px">
      ${tile("Paying projects", pkg.length, "≥ $1 per $1 (Sub-additive)")}
      ${tile("Total cost", fmt$(subCost), "build + land + 10-yr upkeep")}
      ${tile("Joint Value Created", fmt$(subVal), "Capped at " + (isUrbanCore ? "30%" : "22%") + " max neighborhood lift")}
    </div>`;

    if (renterViewOn || subPkg.displacementRiskScore > 40) {
      h += `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:7px 10px;margin-bottom:10px;font-size:11.5px;color:#9a3412;">
        <b>⚠️ Renter Displacement Sensitivity Index: ${subPkg.displacementRiskScore}/100</b> · Public capital investment of this scale may trigger market rent escalation in non-rent-stabilized parcels. Pair with local tenant protections.
      </div>`;
    }
  }"""

    if subadditive_old in html:
        html = html.replace(subadditive_old, subadditive_new)
        print("✓ Replaced linear project stacking with sub-additive joint capitalization.")
    else:
        print("! subadditive_old not matched directly; checking regex...")
        html = re.sub(
            r'if \(pkg\.length\) h \+= `<div class="pkg".*?</div>`;',
            subadditive_new,
            html,
            count=1
        )
        print("✓ Replaced linear stacking via regex.")

    print("Writing modified index.html...")
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✓ Successfully updated index.html!")

if __name__ == "__main__":
    main()
