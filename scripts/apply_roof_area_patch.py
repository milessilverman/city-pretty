#!/usr/bin/env python3
"""
Applies Roof Area & Architectural Cadastre estimation engine to index.html:
1. Injects estimateAccurateRoofArea, getDefaultPitchRise, and recalculateRoofDrawer functions.
2. Updates auditSingleHouseParcel to populate roofCadastre and ground rooftop solar on accurate roof area.
3. Updates renderHouseAuditAside to include 3.5 Accurate Roof Cadastre section.
4. Updates renderHouse to render interactive #roof-area-drawer with SVG slope elevation, facet map, and live pitch controls.
5. Updates computePropertyPlaybook to use accurate 3D roof calculations.
"""

import sys

def patch():
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # Read the engine code
    with open("src/engines/roofAreaEngine.js", "r", encoding="utf-8") as f:
        roof_engine_code = f.read()

    # 1. Inject engine code and recalculateRoofDrawer before renderHouseAuditAside
    target_engine_anchor = """if (typeof window !== "undefined") {
  window.auditSingleHouseParcel = auditSingleHouseParcel;
  window.getHighValueSaturationMultiplier = getHighValueSaturationMultiplier;
  window.calculatePermitCapitalization = calculatePermitCapitalization;
  window.calculateCalibratedTreeEconomics = calculateCalibratedTreeEconomics;
}


"use strict";

function renderHouseAuditAside(audit) {"""

    replacement_engine_anchor = f"""if (typeof window !== "undefined") {{
  window.auditSingleHouseParcel = auditSingleHouseParcel;
  window.getHighValueSaturationMultiplier = getHighValueSaturationMultiplier;
  window.calculatePermitCapitalization = calculatePermitCapitalization;
  window.calculateCalibratedTreeEconomics = calculateCalibratedTreeEconomics;
}}

// ---------------- ACCURATE ROOF AREA & ARCHITECTURAL CADASTRE ENGINE ----------------
{roof_engine_code}

let _currentRoofParams = null;
function recalculateRoofDrawer(pitchRise, roofShape, overhangInches) {{
  if (!_currentRoofParams) return;
  if (pitchRise != null) _currentRoofParams.pitchRise = pitchRise;
  if (roofShape != null) _currentRoofParams.roofShape = roofShape;
  if (overhangInches != null) _currentRoofParams.eavesOverhangInches = overhangInches;

  const res = (typeof estimateAccurateRoofArea === "function")
    ? estimateAccurateRoofArea(_currentRoofParams)
    : null;
  if (!res) return;

  const elGross = document.getElementById("roof-val-gross");
  const elSquares = document.getElementById("roof-val-squares");
  const elMult = document.getElementById("roof-val-mult");
  const elAngle = document.getElementById("roof-val-angle");
  const elSolarSqft = document.getElementById("roof-val-solar-sqft");
  const elPanels = document.getElementById("roof-val-panels");
  const elKw = document.getElementById("roof-val-kw");
  const elGen = document.getElementById("roof-val-gen");
  const elShingle = document.getElementById("roof-cost-shingle");
  const elMetal = document.getElementById("roof-cost-metal");
  const elTile = document.getElementById("roof-cost-tile");
  const elBadge = document.getElementById("roof-summary-badge");

  if (elGross) elGross.textContent = res.grossRoofSqft.toLocaleString() + " sq ft";
  if (elSquares) elSquares.textContent = res.roofingSquares + " sqs";
  if (elMult) elMult.textContent = res.pitchMultiplier + "x (" + res.pitchRatio + ")";
  if (elAngle) elAngle.textContent = res.slopeAngleDeg + "°";
  if (elSolarSqft) elSolarSqft.textContent = res.usableSolarSqft.toLocaleString() + " sq ft";
  if (elPanels) elPanels.textContent = res.maxSolarPanels + " panels";
  if (elKw) elKw.textContent = res.solarDcKw.toFixed(1) + " kW DC";
  if (elGen) elGen.textContent = "~" + res.annualYieldKwh.toLocaleString() + " kWh/yr";
  if (elBadge) elBadge.textContent = "~" + res.grossRoofSqft.toLocaleString() + " Sq Ft (" + res.roofingSquares + " Squares) · " + res.pitchRatio;

  if (elShingle && res.materials[0]) elShingle.textContent = "$" + res.materials[0].totalCostLowUsd.toLocaleString() + " – $" + res.materials[0].totalCostHighUsd.toLocaleString();
  if (elMetal && res.materials[1]) elMetal.textContent = "$" + res.materials[1].totalCostLowUsd.toLocaleString() + " – $" + res.materials[1].totalCostHighUsd.toLocaleString();
  if (elTile && res.materials[2]) elTile.textContent = "$" + res.materials[2].totalCostLowUsd.toLocaleString() + " – $" + res.materials[2].totalCostHighUsd.toLocaleString();

  document.querySelectorAll(".roof-pitch-btn").forEach(b => {{
    const active = +b.dataset.pitch === res.pitchRise;
    b.classList.toggle("active", active);
    b.style.background = active ? "#0284c7" : "#fff";
    b.style.color = active ? "#fff" : "#334155";
  }});
  document.querySelectorAll(".roof-shape-btn").forEach(b => {{
    const active = b.dataset.shape === res.roofShape;
    b.classList.toggle("active", active);
    b.style.background = active ? "#0284c7" : "#fff";
    b.style.color = active ? "#fff" : "#334155";
  }});

  const svgText = document.getElementById("roof-svg-angle-text");
  if (svgText) svgText.textContent = res.pitchRatio + " (" + res.slopeAngleDeg + "°)";
  const svgPoly = document.getElementById("roof-svg-slope");
  if (svgPoly) {{
    const triH = Math.min(55, Math.round(12 + res.pitchRise * 3.8));
    svgPoly.setAttribute("d", `M 15 70 L 85 ${{70 - triH}} L 155 70 Z`);
  }}
}}
window.recalculateRoofDrawer = recalculateRoofDrawer;

"use strict";

function renderHouseAuditAside(audit) {{"""

    if target_engine_anchor in html:
        html = html.replace(target_engine_anchor, replacement_engine_anchor)
        print("✓ Injected roofAreaEngine code & recalculateRoofDrawer into index.html.")
    else:
        print("ℹ Engine anchor already patched or not found.")

    # 2. Update auditSingleHouseParcel inside index.html to compute roofCalc
    target_single_solar = """  // 4. 2026 Rooftop Solar, Battery Storage & Microgrid Calculator
  const grossRoofSqft = Math.round(livingSqft / Math.max(1, input.stories || 1) * 1.15);
  const unshadedFraction = 0.55; // LiDAR DSM slope/pitch/shading mask
  const unshadedRoofSqft = Math.round(grossRoofSqft * unshadedFraction);
  const dcKw = Number(((unshadedRoofSqft / 100) * 1.6).toFixed(1));"""

    replacement_single_solar = """  // 4. Accurate Roof Cadastre & 2026 Solar Microgrid Calculator
  const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
    livingSqft,
    stories: input.stories || 1,
    hasGarage: input.hasGarage,
    garageAttached: true,
    yearBuilt: input.yearBuilt,
    stateCode: stCode,
  }) : null;

  const grossRoofSqft = roofCalc ? roofCalc.grossRoofSqft : Math.round(livingSqft / Math.max(1, input.stories || 1) * 1.15);
  const unshadedFraction = roofCalc && roofCalc.grossRoofSqft > 0 ? (roofCalc.usableSolarSqft / roofCalc.grossRoofSqft) : 0.55;
  const unshadedRoofSqft = roofCalc ? roofCalc.usableSolarSqft : Math.round(grossRoofSqft * unshadedFraction);
  const dcKw = roofCalc ? roofCalc.solarDcKw : Number(((unshadedRoofSqft / 100) * 1.6).toFixed(1));"""

    target_single_return = """    statutoryZoning: {
      parcel_id: statutoryZoning.parcel_id,
      state_code: statutoryZoning.state_code,
      base_zoning_code: statutoryZoning.base_zoning_code,
      applicable_statutes: statutoryZoning.applicable_statutes,
      statutory_exclusions: statutoryZoning.statutory_exclusions,
      net_by_right_feasible: statutoryZoning.net_by_right_feasible,
      privateCovenantsDisclaimer: "NOTICE ON PRIVATE COVENANTS: State zoning preemptions (e.g., CA SB 9, TX SB 15, WA HB 1110) override municipal zoning but may not automatically extinguish recorded private Homeowners Association (HOA) covenants or CC&Rs running with the land. Check title report for private encumbrances.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    solarMicrogrid: {"""

    replacement_single_return = """    statutoryZoning: {
      parcel_id: statutoryZoning.parcel_id,
      state_code: statutoryZoning.state_code,
      base_zoning_code: statutoryZoning.base_zoning_code,
      applicable_statutes: statutoryZoning.applicable_statutes,
      statutory_exclusions: statutoryZoning.statutory_exclusions,
      net_by_right_feasible: statutoryZoning.net_by_right_feasible,
      privateCovenantsDisclaimer: "NOTICE ON PRIVATE COVENANTS: State zoning preemptions (e.g., CA SB 9, TX SB 15, WA HB 1110) override municipal zoning but may not automatically extinguish recorded private Homeowners Association (HOA) covenants or CC&Rs running with the land. Check title report for private encumbrances.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    roofCadastre: roofCalc,
    solarMicrogrid: {"""

    if target_single_solar in html and target_single_return in html:
        html = html.replace(target_single_solar, replacement_single_solar)
        html = html.replace(target_single_return, replacement_single_return)
        print("✓ Connected estimateAccurateRoofArea into auditSingleHouseParcel().")
    else:
        print("ℹ auditSingleHouseParcel solar targets already patched or not found.")

    # 3. Add 3.5 Accurate Roof Cadastre into renderHouseAuditAside in index.html
    target_audit_aside_cadastre = """      <div style="font-size:10.5px;color:#64748b;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;">
        ℹ️ ${z.privateCovenantsDisclaimer}
      </div>
    </div>

    <!-- 4. 2026 Solar, Storage & Microgrid -->"""

    replacement_audit_aside_cadastre = """      <div style="font-size:10.5px;color:#64748b;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;">
        ℹ️ ${z.privateCovenantsDisclaimer}
      </div>
    </div>

    <!-- 3.5 Accurate Roof Cadastre & Pitch Engineering -->
    ${audit.roofCadastre ? `
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">📐 Accurate Roof Cadastre &amp; Pitch Engineering</span>
        <span style="font-size:11px;color:#0284c7;font-weight:600;">${audit.roofCadastre.pitchRatio} Pitch (${audit.roofCadastre.slopeAngleDeg}°)</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>Gross 3D Roof Area:</b> <b>${fmtN(audit.roofCadastre.grossRoofSqft)} sq ft</b> (${audit.roofCadastre.roofingSquares} roofing squares &middot; ${audit.roofCadastre.pitchMultiplier}x secant multiplier)<br>
        • <b>Footprint Breakdown:</b> ${fmtN(audit.roofCadastre.groundFootprintSqft)} sq ft base footprint + ${fmtN(audit.roofCadastre.eavesOverhangSqft)} sq ft eaves overhang ${audit.roofCadastre.garageRoofAdditionSqft > 0 ? `+ ${fmtN(audit.roofCadastre.garageRoofAdditionSqft)} sq ft attached garage` : ""}<br>
        • <b>Usable Solar Facets:</b> <b>${fmtN(audit.roofCadastre.usableSolarSqft)} sq ft</b> (excluding north planes &amp; 3-ft fire code setbacks &middot; fits ~${audit.roofCadastre.maxSolarPanels} panels)<br>
        • <b>Re-Roofing Cost:</b> Architectural Shingles: ~$${fmtN(audit.roofCadastre.materials[0].totalCostLowUsd)}–$${fmtN(audit.roofCadastre.materials[0].totalCostHighUsd)} &middot; Metal: ~$${fmtN(audit.roofCadastre.materials[1].totalCostLowUsd)}–$${fmtN(audit.roofCadastre.materials[1].totalCostHighUsd)}
      </div>
    </div>` : ""}

    <!-- 4. 2026 Solar, Storage & Microgrid -->"""

    if target_audit_aside_cadastre in html:
        html = html.replace(target_audit_aside_cadastre, replacement_audit_aside_cadastre)
        print("✓ Injected section 3.5 into renderHouseAuditAside().")
    else:
        print("ℹ renderHouseAuditAside cadastre target already patched or not found.")

    # 4. In renderHouse, compute roofCalc, update usableSolarSqft, and inject interactive #roof-area-drawer
    target_render_house_solar = """        ${(() => {
          const usableSolarSqft = Math.round((F.foot || 1200) * 0.65);
          const solarKw = Math.max(3.5, Math.min(18.0, Math.round((usableSolarSqft / 60) * 2) / 2));
          const solarKwhYr = Math.round(solarKw * 1480);
          const solarSavYr = Math.round(solarKwhYr * 0.23);
          const isCaNEM3 = (typeof activeState === "function" ? activeState() : "CA") === "CA";
          const solarGrossCost = Math.round(solarKw * 2800);
          const batteryCost = isCaNEM3 ? 12000 : 0;
          const totalGrossCost = solarGrossCost + batteryCost;
          const ppaCredit30 = Math.round(totalGrossCost * 0.30);
          const netCostPpa = totalGrossCost - ppaCredit30;
          const cumulative25Yr = Math.round(solarSavYr * 25 - netCostPpa);
          return `
          <details class="solar-potential-drawer" style="margin:10px 0;border:1px solid #fde047;border-radius:8px;background:#fefce8;overflow:hidden;">"""

    replacement_render_house_solar = """        ${(() => {
          const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
            footprintSqft: F.foot || null,
            livingSqft: livingSqft,
            stories: F.stories || 1,
            hasGarage: !!F.garage,
            garageAttached: true,
            yearBuilt: F.yb || 1975,
            stateCode: typeof activeState === "function" ? activeState() : "CA"
          }) : null;

          window._currentRoofParams = {
            footprintSqft: F.foot || null,
            livingSqft: livingSqft,
            stories: F.stories || 1,
            hasGarage: !!F.garage,
            garageAttached: true,
            pitchRise: roofCalc ? roofCalc.pitchRise : 6.0,
            roofShape: roofCalc ? roofCalc.roofShape : "gable",
            eavesOverhangInches: 18,
            yearBuilt: F.yb || 1975,
            stateCode: typeof activeState === "function" ? activeState() : "CA"
          };

          const usableSolarSqft = roofCalc ? roofCalc.usableSolarSqft : Math.round((F.foot || 1200) * 0.65);
          const solarKw = roofCalc ? roofCalc.solarDcKw : Math.max(3.5, Math.min(18.0, Math.round((usableSolarSqft / 60) * 2) / 2));
          const solarKwhYr = roofCalc ? roofCalc.annualYieldKwh : Math.round(solarKw * 1480);
          const solarSavYr = Math.round(solarKwhYr * 0.23);
          const isCaNEM3 = (typeof activeState === "function" ? activeState() : "CA") === "CA";
          const solarGrossCost = Math.round(solarKw * 2800);
          const batteryCost = isCaNEM3 ? 12000 : 0;
          const totalGrossCost = solarGrossCost + batteryCost;
          const ppaCredit30 = Math.round(totalGrossCost * 0.30);
          const netCostPpa = totalGrossCost - ppaCredit30;
          const cumulative25Yr = Math.round(solarSavYr * 25 - netCostPpa);

          return `
          <!-- 📐 ACCURATE ROOF AREA & PITCH ESTIMATOR DRAWER -->
          <details id="roof-area-drawer" class="roof-area-drawer" style="margin:10px 0;border:1px solid #0284c7;border-radius:8px;background:#f0f9ff;overflow:hidden;">
            <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#0284c7;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
              <span>📐 Accurate Roof Area &amp; Architectural Cadastre</span>
              <span id="roof-summary-badge" style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:4px;font-weight:600">
                ~${roofCalc ? roofCalc.grossRoofSqft.toLocaleString() : "2,400"} Sq Ft (${roofCalc ? roofCalc.roofingSquares : "24"} Squares) &middot; ${roofCalc ? roofCalc.pitchRatio : "6:12"}
              </span>
            </summary>
            <div style="padding:12px;background:#fff;border-top:1px solid #bae6fd;font-size:12px;line-height:1.45;">
              <!-- Pitch Controls -->
              <div style="margin-bottom:8px;">
                <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">1. Architectural Slope &amp; Pitch (Rise : 12" Run):</div>
                <div style="display:inline-flex;gap:4px;flex-wrap:wrap;">
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise <= 2 ? ' active' : ''}" data-pitch="1" onclick="recalculateRoofDrawer(1, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise <= 2 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Flat (1:12 · 4.8°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 2 && roofCalc.pitchRise <= 5 ? ' active' : ''}" data-pitch="4" onclick="recalculateRoofDrawer(4, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 2 && roofCalc.pitchRise <= 5 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Low Ranch (4:12 · 18.4°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 5 && roofCalc.pitchRise <= 7 ? ' active' : ''}" data-pitch="6" onclick="recalculateRoofDrawer(6, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 5 && roofCalc.pitchRise <= 7 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Standard (6:12 · 26.6°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 7 && roofCalc.pitchRise <= 9 ? ' active' : ''}" data-pitch="8" onclick="recalculateRoofDrawer(8, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 7 && roofCalc.pitchRise <= 9 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Steep Tudor (8:12 · 33.7°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 9 ? ' active' : ''}" data-pitch="10" onclick="recalculateRoofDrawer(10, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 9 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Alpine / Cape (10:12 · 39.8°)</button>
                </div>
              </div>

              <!-- Shape & Overhang Controls -->
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                <div>
                  <span style="font-size:11px;font-weight:700;color:#0f172a;margin-right:4px;">Shape:</span>
                  <span style="display:inline-flex;gap:3px;">
                    <button type="button" class="roof-shape-btn story-btn active" data-shape="gable" onclick="recalculateRoofDrawer(null, 'gable', null)" style="font-size:10.5px;padding:2px 7px;background:#0284c7;color:#fff;">Gable (1.05x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="hip" onclick="recalculateRoofDrawer(null, 'hip', null)" style="font-size:10.5px;padding:2px 7px;">Hip (1.08x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="complex" onclick="recalculateRoofDrawer(null, 'complex', null)" style="font-size:10.5px;padding:2px 7px;">Complex (1.16x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="flat" onclick="recalculateRoofDrawer(null, 'flat', null)" style="font-size:10.5px;padding:2px 7px;">Flat (1.01x)</button>
                  </span>
                </div>
                <div>
                  <span style="font-size:11px;font-weight:700;color:#0f172a;margin-right:4px;">Eaves Overhang:</span>
                  <span style="display:inline-flex;gap:3px;">
                    <button type="button" class="story-btn" onclick="recalculateRoofDrawer(null, null, 12)" style="font-size:10.5px;padding:2px 6px;">12"</button>
                    <button type="button" class="story-btn active" onclick="recalculateRoofDrawer(null, null, 18)" style="font-size:10.5px;padding:2px 6px;">18" Std</button>
                    <button type="button" class="story-btn" onclick="recalculateRoofDrawer(null, null, 24)" style="font-size:10.5px;padding:2px 6px;">24" Deep</button>
                  </span>
                </div>
              </div>

              <!-- Visual SVG Cadastre Diagram -->
              <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:11px;font-weight:700;color:#334155;">Roof Plane Geometry &amp; Solar Facet Segmentation:</span>
                  <span id="roof-svg-angle-text" style="font-size:11px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:1px 6px;border-radius:4px;">
                    ${roofCalc ? roofCalc.pitchRatio : "6:12"} (${roofCalc ? roofCalc.slopeAngleDeg : "26.6"}°)
                  </span>
                </div>
                <svg viewBox="0 0 340 90" style="width:100%;height:90px;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;">
                  <!-- Cross Section Elevation -->
                  <path id="roof-svg-slope" d="M 15 70 L 85 36 L 155 70 Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="2" />
                  <line x1="85" y1="36" x2="85" y2="70" stroke="#94a3b8" stroke-dasharray="2 2" />
                  <text x="85" y="82" font-size="9" text-anchor="middle" fill="#64748b">ELEVATION SLOPE</text>

                  <!-- Top-Down Aerial Facets -->
                  <polygon points="180,20 250,20 240,48 190,48" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" />
                  <text x="215" y="36" font-size="8" text-anchor="middle" fill="#475569">NORTH (SHADED)</text>
                  <polygon points="190,48 240,48 250,76 180,76" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.5" />
                  <text x="215" y="65" font-size="8.5" font-weight="700" text-anchor="middle" fill="#15803d">SOLAR ACTIVE</text>
                  <line x1="188" y1="48" x2="242" y2="48" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 2" />
                  <text x="260" y="32" font-size="8" fill="#64748b">• North (Low Sun)</text>
                  <text x="260" y="50" font-size="8" fill="#15803d" font-weight="700">• Solar Active</text>
                  <text x="260" y="68" font-size="8" fill="#b45309">• 3-Ft Fire Setback</text>
                </svg>
              </div>

              <!-- Architectural Metrics Grid -->
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-bottom:10px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Gross 3D Area</div>
                  <div id="roof-val-gross" style="font-size:14px;font-weight:800;color:#0f172a;">${roofCalc ? roofCalc.grossRoofSqft.toLocaleString() : "2,400"} sq ft</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Roofing Squares</div>
                  <div id="roof-val-squares" style="font-size:14px;font-weight:800;color:#0284c7;">${roofCalc ? roofCalc.roofingSquares : "24"} sqs</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Pitch Multiplier</div>
                  <div id="roof-val-mult" style="font-size:14px;font-weight:800;color:#334155;">${roofCalc ? roofCalc.pitchMultiplier : "1.118"}x (${roofCalc ? roofCalc.pitchRatio : "6:12"})</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Net Solar Area</div>
                  <div id="roof-val-solar-sqft" style="font-size:14px;font-weight:800;color:#15803d;">${roofCalc ? roofCalc.usableSolarSqft.toLocaleString() : "1,200"} sq ft</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">PV Panel Capacity</div>
                  <div id="roof-val-panels" style="font-size:14px;font-weight:800;color:#15803d;">${roofCalc ? roofCalc.maxSolarPanels : "60"} panels</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">DC kW Sizing</div>
                  <div id="roof-val-kw" style="font-size:14px;font-weight:800;color:#7c3aed;">${roofCalc ? roofCalc.solarDcKw.toFixed(1) : "24.6"} kW DC</div>
                </div>
              </div>

              <!-- Material Replacement Cost Table -->
              <div style="border-top:1px solid #e2e8f0;padding-top:8px;">
                <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">Re-Roofing Material Estimates (RSMeans 2026 Installed):</div>
                <table style="width:100%;font-size:11px;border-collapse:collapse;">
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:3px 0;color:#475569;">• 30-Yr Architectural Shingles ($460–$590/sq):</td>
                    <td id="roof-cost-shingle" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[0] ? `$${roofCalc.materials[0].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[0].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:3px 0;color:#475569;">• Standing Seam Metal ($1,100–$1,480/sq):</td>
                    <td id="roof-cost-metal" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[1] ? `$${roofCalc.materials[1].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[1].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#475569;">• Concrete / Clay Tile ($1,250–$1,750/sq):</td>
                    <td id="roof-cost-tile" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[2] ? `$${roofCalc.materials[2].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[2].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                </table>
              </div>
            </div>
          </details>

          <details class="solar-potential-drawer" style="margin:10px 0;border:1px solid #fde047;border-radius:8px;background:#fefce8;overflow:hidden;">"""

    if target_render_house_solar in html:
        html = html.replace(target_render_house_solar, replacement_render_house_solar)
        print("✓ Injected interactive #roof-area-drawer into renderHouse().")
    else:
        print("ℹ renderHouse solar target already patched or not found.")

    # 5. In computePropertyPlaybook, update roofSqft & usableSolarSqft
    target_pb_roof = """  const bldgSqft = (F && F.bldg) || 1600;
  const yb = (F && F.yb) || 1975;
  const roofSqft = Math.round(((F && F.foot) || Math.min(bldgSqft, lotSqft * 0.35)) * 1.15);
  const usableSolarSqft = Math.round(roofSqft * 0.65);
  const solarKw = Math.max(3.5, +(usableSolarSqft / 75).toFixed(1));"""

    replacement_pb_roof = """  const bldgSqft = (F && F.bldg) || 1600;
  const yb = (F && F.yb) || 1975;
  const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
    footprintSqft: (F && F.foot) || null,
    livingSqft: bldgSqft,
    stories: (F && F.stories) || 1,
    hasGarage: !!(F && F.garage),
    yearBuilt: yb,
    stateCode: typeof activeState === "function" ? activeState() : "CA"
  }) : null;
  const roofSqft = roofCalc ? roofCalc.grossRoofSqft : Math.round(((F && F.foot) || Math.min(bldgSqft, lotSqft * 0.35)) * 1.15);
  const usableSolarSqft = roofCalc ? roofCalc.usableSolarSqft : Math.round(roofSqft * 0.65);
  const solarKw = roofCalc ? roofCalc.solarDcKw : Math.max(3.5, +(usableSolarSqft / 75).toFixed(1));"""

    if target_pb_roof in html:
        html = html.replace(target_pb_roof, replacement_pb_roof)
        print("✓ Connected estimateAccurateRoofArea into computePropertyPlaybook().")
    else:
        print("ℹ computePropertyPlaybook roof target already patched or not found.")

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✓ Successfully updated index.html with Roof Area & Cadastre engine.")

if __name__ == "__main__":
    patch()
