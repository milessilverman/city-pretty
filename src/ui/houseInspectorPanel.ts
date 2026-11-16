// Mirror of renderHouseAuditAside in app/app.js (the shipped copy). Keep the two in step.
import { HouseParcelAuditResult } from "../engines/parcelHouseAuditor";

export function renderHouseAuditAside(audit: HouseParcelAuditResult): string {
  const esc = (x: unknown) => String(x ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[ch]);
  const v: any = audit.valuation;
  const im: any = audit.imagery;
  const z: any = audit.statutoryZoning;
  const sol: any = audit.solarMicrogrid;
  const tree: any = audit.treeEconomics;
  const st: any = audit.subAdditiveStacking;

  const fmt$ = (n: number | null | undefined) => (n == null || isNaN(n)) ? "–" : "$" + Math.round(n).toLocaleString();
  const fmtN = (n: number | null | undefined) => (n == null || isNaN(n)) ? "–" : Math.round(n).toLocaleString();
  const box = "background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;";
  const notModeled = (t: string | null | undefined) => `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:4px;">${t}</div>`;

  const badgeColor = im.confidenceBadge === "stale_imagery_permit_override" ? "#b45309" : "#64748b";
  const badgeText =
    im.confidenceBadge === "stale_imagery_permit_override" ? "Imagery may predate recent work"
    : im.confidenceBadge === "imagery_dates_unknown" ? "Imagery dates not on file"
    : im.confidenceBadge === "verified_current" ? "Imagery dates checked against permits"
    : "No Street View on file";
  const top = z.applicable_statutes && z.applicable_statutes[0];

  return `
  <div class="house-audit-panel" style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#1e293b;padding:12px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;margin-top:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Parcel profile (screening)</div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;">Parcel ID: ${audit.parcelId} (${audit.stateCode} · FIPS ${audit.countyFips})</div>
      </div>
      <div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;background:${badgeColor}15;color:${badgeColor};border:1px solid ${badgeColor}40;">${badgeText}</div>
    </div>

    <div style="${box}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11px;font-weight:700;color:#334155;">Value estimate</span>
        <span style="font-size:11px;color:#b45309;font-weight:600;">${v.confidenceRating}</span>
      </div>
      ${v.estimatedValue ? `
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin:3px 0;">${fmt$(v.estimatedValue)}</div>
      <div style="font-size:11.5px;color:#475569;margin-bottom:6px;">
        ${v.vpsf ? `~${fmt$(v.vpsf)}/sq ft ${v.isVacantLand ? "of lot" : "of living area"} &middot; ` : ""}Built from: <b>${v.valuationMethod}</b>
      </div>
      <div style="font-size:10.5px;color:#64748b;">No accuracy range is shown: the estimate has not been tested against recorded sales.</div>` :
      notModeled(v.withheldReason || "Withheld — not enough on file to estimate.")}
      ${v.notes && v.notes.length ? `<div style="font-size:10.5px;color:#64748b;margin-top:4px;">${v.notes.join(" ")}</div>` : ""}
      ${v.permitValuationTotal > 0 ? `<div style="font-size:11px;color:#475569;margin-top:4px;">• <b>Recorded permit valuations:</b> ${fmt$(v.permitValuationTotal)} (not added to the estimate)</div>` : ""}
    </div>

    <div style="${box}">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Imagery dates</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        • <b>LiDAR:</b> ${im.lidarAcquisitionYear || "date not on file"} &middot; <b>Street View:</b> ${im.streetViewCaptureDate || "date not on file"} &middot; <b>Latest permit:</b> ${im.latestPostConstructionPermitDate || "none on file"}<br>
        • <b>Story count from:</b> ${im.storyCalibrationSource}
      </div>
      ${im.warningMessage ? `<div style="font-size:11px;color:#b45309;background:#fef3c7;padding:6px 8px;border-radius:4px;border:1px solid #fde68a;"><b>Note:</b> ${im.warningMessage}</div>` : ""}
    </div>

    <div style="${box}">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">State housing laws (screening, unverified)</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        ${top ? `
          <div style="color:#334155;font-weight:700;margin-bottom:4px;">May apply: ${z.applicable_statutes.map((s: any) => s.citation).join(", ")}</div>
          ${top.max_units_by_right != null ? `• <b>Units:</b> up to ${top.max_units_by_right} as the engine reads the law.<br>` : ""}
          ${top.max_height_ft ? `• <b>Height:</b> ${top.max_height_ft} ft${top.max_far ? ` &middot; ${top.max_far} FAR` : ""}<br>` : ""}
          ${top.min_parking_spaces_per_unit != null ? `• <b>Parking minimum:</b> ${top.min_parking_spaces_per_unit} per unit.<br>` : ""}
        ` : `<div style="color:#334155;">${z.statutoryNotes}</div>`}
        • <b>Lot split:</b> ${z.lotSplitFeasible ? "A state lot-split law may apply (zoning and lot size on file)." : "Not indicated by the records on file."}<br>
        • <b>ADU:</b> ${z.aduFeasible ? "Zoning on file allows the screening engine to consider an ADU." : "Cannot be screened (zoning not on file or historic district)."}
      </div>
      <div style="font-size:10.5px;color:#64748b;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;">${z.privateCovenantsDisclaimer}</div>
    </div>

    ${audit.roofCadastre ? `
    <div style="${box}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">Roof area (geometry model)</span>
        <span style="font-size:11px;color:#64748b;font-weight:600;">Assumed pitch ${audit.roofCadastre.pitchRatio}</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>Roof area:</b> ~${fmtN(audit.roofCadastre.grossRoofSqft)} sq ft (from living area, stories and an assumed pitch; not measured)
      </div>
      ${notModeled("Re-roofing cost: not modeled yet — no sourced cost data.")}
    </div>` : ""}

    <div style="${box}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">Rooftop solar</span>
        <span style="font-size:10.5px;font-weight:700;color:#b45309;">Federal § 25D credit: ended Dec 31, 2025</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        ${sol.dcKwCapacity ? `• <b>Approximate system size:</b> ${sol.dcKwCapacity} kW DC<br>` : ""}
      </div>
      ${notModeled(sol.dollarStatus)}
    </div>

    <div style="${box}">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Shade trees</div>
      <div style="font-size:11px;color:#475569;">• <b>Climate:</b> ${tree.climateRegime.replace(/_/g, " ")} &middot; ${tree.utilityBenefitDescription}</div>
      ${notModeled(tree.dollarStatus)}
    </div>

    <div style="${box}">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Combining improvements</div>
      <div style="font-size:11px;color:#475569;">
        • Several improvements together raise values by less than the sum of each. The app caps the combined lift at ${(st.maxStackingCeilingPct * 100).toFixed(0)}% (a modeling assumption, not a measured figure).<br>
        • <b>Renter displacement score:</b> ${st.displacementSensitivityScore == null ? "not on file" : st.displacementSensitivityScore + " / 100"}
      </div>
    </div>

    <div style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.4;">
      <b>Limits of this screening:</b><br>
      ${audit.legalEngineeringDisclaimers.map((d: string) => `• ${d}`).join("<br>")}
    </div>
  </div>
  `;
}
