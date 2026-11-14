import { HouseParcelAuditResult } from "../engines/parcelHouseAuditor";

export function renderHouseAuditAside(audit: HouseParcelAuditResult): string {
  const v = audit.valuation;
  const im = audit.imagery;
  const z = audit.statutoryZoning;
  const sol = audit.solarMicrogrid;
  const tree = audit.treeEconomics;
  const st = audit.subAdditiveStacking;

  const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString();
  const fmtN = (n: number) => Math.round(n).toLocaleString();

  const badgeColor =
    im.confidenceBadge === "verified_current"
      ? "#15803d"
      : im.confidenceBadge === "stale_imagery_permit_override"
      ? "#b45309"
      : "#64748b";

  const badgeText =
    im.confidenceBadge === "verified_current"
      ? "✓ Verified Current Imagery"
      : im.confidenceBadge === "stale_imagery_permit_override"
      ? "⚠️ Stale Imagery (Post-Construction Permit Override)"
      : "ℹ️ No Street View (Rural / Cul-de-sac / Gated)";

  return `
  <div class="house-audit-panel" style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#1e293b;padding:12px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;margin-top:10px;">
    <!-- Header & Parcel ID -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Parcel Comprehensive Institutional Audit</div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;">Parcel ID: ${audit.parcelId} (${audit.stateCode} · FIPS ${audit.countyFips})</div>
      </div>
      <div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;background:${badgeColor}15;color:${badgeColor};border:1px solid ${badgeColor}40;">
        ${badgeText}
      </div>
    </div>

    <!-- 1. Zillow-Parity AVM & Permit Capitalization -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11px;font-weight:700;color:#334155;">Institutional AVM Valuation</span>
        <span style="font-size:11px;color:#0284c7;font-weight:600;">${v.confidenceRating}</span>
      </div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin:3px 0;">
        ${fmt$(v.estimatedValue)}
        <span style="font-size:12px;font-weight:500;color:#64748b;">(${fmt$(v.valueLow)} – ${fmt$(v.valueHigh)} · ±${(v.confidenceMarginPct * 100).toFixed(1)}%)</span>
      </div>
      <div style="font-size:11.5px;color:#475569;margin-bottom:6px;">
        ~${fmt$(v.vpsf)}/sq ft ${v.isVacantLand ? "lot (Vacant Land Appraisal)" : "living area"} &middot; Model: <b>${v.valuationMethod}</b>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;background:#ffffff;padding:8px;border-radius:4px;border:1px solid #cbd5e1;">
        <div>• <b>Site Land Equity:</b> ${fmt$(v.siteValue)}</div>
        <div>• <b>Finished Structure (GLA):</b> ${v.isVacantLand ? "$0 (unimproved)" : fmt$(v.structVal)}</div>
        ${v.permitCapitalizationAdded > 0 ? `<div style="color:#15803d;font-weight:700;">• <b>Permit Capitalization (+85%):</b> +${fmt$(v.permitCapitalizationAdded)}</div>` : `<div>• <b>Permit Additions:</b> No unassessed active permits</div>`}
        ${v.luxuryDampeningApplied ? `<div style="color:#b45309;">• <b>High-Value Cap ($2.5M+):</b> Non-linear elasticity (${v.luxurySaturationMultiplier}x)</div>` : `<div>• <b>Tier Scaling:</b> Standard linear elasticity</div>`}
        ${v.multiUnitBonusPct > 0 ? `<div style="color:#0284c7;font-weight:700;">• <b>Rental Density Bonus:</b> +${v.multiUnitBonusPct}% (2–4 Plex)</div>` : ""}
      </div>
    </div>

    <!-- 2. LiDAR, Stories & Street View Proxy Verification -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Building Footprints &amp; 4-Angle Street View Verification</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        • <b>LiDAR Acquisition:</b> ${im.lidarAcquisitionYear} USGS 3DEP DSM &middot; <b>Street View:</b> ${im.streetViewCaptureDate || "Unavailable"} &middot; <b>Permit Vintage:</b> ${im.latestPostConstructionPermitDate || "None post-imagery"}<br>
        • <b>Story Calibration:</b> ${im.storyCalibrationSource}
      </div>
      ${im.warningMessage ? `<div style="font-size:11px;color:#b45309;background:#fef3c7;padding:6px 8px;border-radius:4px;border:1px solid #fde68a;margin-bottom:6px;"><b>Imagery Notice:</b> ${im.warningMessage}</div>` : ""}
      <div style="font-size:10.5px;color:#64748b;font-style:italic;">
        🔒 ${im.proxyRoutingNotice}
      </div>
    </div>

    <!-- 3. Statutory By-Right Housing Rights & Exclusions -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Statutory By-Right Housing Rights &amp; Exclusions</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        ${z.applicable_statutes.length > 0 ? `
          <div style="color:#15803d;font-weight:700;margin-bottom:4px;">✓ Statutory Preemption Active: ${z.applicable_statutes.map(s => s.citation).join(", ")}</div>
          • <b>By-Right Density:</b> Up to ${z.applicable_statutes[0].max_units_by_right} units ministerially.<br>
          • <b>Height &amp; FAR:</b> ${z.applicable_statutes[0].max_height_ft ? `${z.applicable_statutes[0].max_height_ft} ft` : "Base zoning"} ${z.applicable_statutes[0].max_far ? `&middot; ${z.applicable_statutes[0].max_far} FAR` : ""}<br>
          • <b>Mandatory Parking:</b> ${z.applicable_statutes[0].min_parking_spaces_per_unit} spaces/unit.<br>
          ${z.applicable_statutes[0].tax_exemption_pct > 0 ? `• <b>Ad Valorem Exemption:</b> ${(z.applicable_statutes[0].tax_exemption_pct * 100).toFixed(0)}% under Fla. Stat. § 196.1979.<br>` : ""}
        ` : `
          <div style="color:#334155;">${z.statutoryNotes}</div>
        `}
        • <b>Lot Split Feasibility:</b> ${z.lotSplitFeasible ? "<span style='color:#15803d;font-weight:700;'>Feasible (≥4,800 sq ft, unencumbered)</span>" : "<span style='color:#64748b;'>Ineligible (lot size or floodway/HPOZ exclusion)</span>"}<br>
        • <b>ADU Feasibility:</b> ${z.aduFeasible ? "<span style='color:#15803d;font-weight:700;'>By-Right Feasible</span>" : "<span style='color:#b45309;'>Discretionary HPOZ review required</span>"}
      </div>
      <div style="font-size:10.5px;color:#64748b;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;">
        ℹ️ ${z.privateCovenantsDisclaimer}
      </div>
    </div>

    <!-- 4. 2026 Solar, Storage & Microgrid -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">2026+ Rooftop Solar &amp; Battery Storage</span>
        <span style="font-size:10.5px;font-weight:700;color:#b45309;">Federal § 25D Credit: 0% (Expired Dec 2025)</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>LiDAR Usable Roof:</b> ${fmtN(sol.unshadedRoofSqft)} sq ft unshaded DSM &middot; Sized at <b>${sol.dcKwCapacity} kW DC</b> (~${fmtN(sol.annualYieldKwh)} kWh/yr)<br>
        • <b>Cash/Loan Option:</b> ${fmt$(sol.netSystemCostCashUsd)} net cost &middot; Payback: ~${sol.paybackYearsCash} yrs &middot; 25-Yr Equity: ${fmt$(sol.net_25yr_npv_usd)}<br>
        • <b>Commercial / TPO Lease (IRC § 48E 30%):</b> ${fmt$(sol.netSystemCostLeaseUsd)} net &middot; Payback: ~${sol.paybackYearsLease} yrs<br>
        ${sol.state_tax_credit_usd > 0 ? `• <b>State Clean Energy Credit:</b> +${fmt$(sol.state_tax_credit_usd)} direct state tax credit.<br>` : ""}
      </div>
      <div style="font-size:10.5px;color:#0284c7;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;margin-top:4px;">
        ⚡ ${sol.nemTariffNotice}
      </div>
    </div>

    <!-- 5. Climate- & RSMeans-Calibrated Tree Economics -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Climate-Calibrated Street Tree &amp; Canopy Economics</div>
      <div style="font-size:11px;color:#475569;">
        • <b>Capitalized Property Value:</b> +${fmt$(tree.capitalizedValueLiftUsd)} (RSMeans-adjusted for ${tree.stateCode})<br>
        • <b>Annual Utility Dividend:</b> +${fmt$(tree.netAnnualSavingsUsd)}/yr net (${fmt$(tree.annualUtilitySavingsUsd)}/yr utility savings - ${fmt$(tree.annualIrrigationCostUsd)}/yr irrigation)<br>
        • <b>Climate Regime:</b> ${tree.climateRegime.replace(/_/g, " ")} &middot; ${tree.utilityBenefitDescription}
      </div>
    </div>

    <!-- 6. Sub-Additive Saturation & Displacement Risk -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Sub-Additive Package Stacking &amp; Displacement Risk</div>
      <div style="font-size:11px;color:#475569;">
        • <b>Stacking Saturation Ceiling:</b> ${(st.maxStackingCeilingPct * 100).toFixed(0)}% maximum cumulative neighborhood price lift.<br>
        • <b>Diminishing Returns Formula:</b> <code style="font-size:10px;background:#e2e8f0;padding:1px 4px;border-radius:3px;">${st.jointCapitalizationFormula}</code><br>
        • <b>Renter Displacement Sensitivity Score:</b> <b>${st.displacementSensitivityScore} / 100</b>
      </div>
    </div>

    <!-- 7. Legal & Engineering Disclaimers -->
    <div style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.4;">
      <b>Institutional Disclaimers:</b><br>
      ${audit.legalEngineeringDisclaimers.map(d => `• ${d}`).join("<br>")}
    </div>
  </div>
  `;
}
