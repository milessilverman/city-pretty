#!/usr/bin/env python3
"""
City Pretty: Apply Nov 08 Comprehensive Audit Delta Patch
1. Controls and HUD updates:
   - canopy-hud-economic ID
   - "Measured in local metro only (A)"
   - "Heat vs. EPA Level IV ecoregion median"
   - Renter displacement sensitivity (0–100) metric
   - Experimental modes quarantine
2. Embeds parcelHouseAuditor.js, houseInspectorPanel.js, nov08DeltaPatch.js
3. Injects auditSingleHouseParcel & renderHouseAuditAside into renderHouse()
4. Wires syncHeaderDomToCounty to patchCanopyCardDom & patchTopBarControlsDom
5. Incorporates resolveRepoAssetUrl into fetchJSON()
"""

import re
import sys

def main():
    print("Reading index.html...")
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Update Canopy Card economic div ID
    old_canopy = '<div style="font-size:11px;color:#cbd5e1;line-height:1.4;margin-bottom:8px;">\n    🌲 <b>Economic Impact:</b> Mature street tree canopy adds <b>+$7,130</b>'
    new_canopy = '<div id="canopy-hud-economic" style="font-size:11px;color:#cbd5e1;line-height:1.4;margin-bottom:8px;">\n    🌲 <b>Economic Impact:</b> Mature street tree canopy adds <b>+$7,130</b>'
    if old_canopy in html:
        html = html.replace(old_canopy, new_canopy, 1)
        print("✓ Updated #canopy-hud-economic ID.")

    # 2. Update Evidence Select option A
    old_evid_a = '<option value="A">Measured in LA only (A)</option>'
    new_evid_a = '<option value="A">Measured in local metro only (A)</option>'
    if old_evid_a in html:
        html = html.replace(old_evid_a, new_evid_a, 1)
        print("✓ Updated evidence option A to 'Measured in local metro only (A)'.")

    # 3. Update Metric Select heat option and add displacement option
    old_heat_opt = '<option value="heat">Heat vs. county median</option>'
    new_heat_opt = '<option value="heat">Heat vs. EPA Level IV ecoregion median</option>\n      <option value="displacement">Renter displacement sensitivity (0–100)</option>'
    if old_heat_opt in html:
        html = html.replace(old_heat_opt, new_heat_opt, 1)
        print("✓ Updated metric select: Heat vs. EPA Level IV ecoregion & added Renter displacement sensitivity.")

    # 4. Add experimental mode toggle button next to ROI mode
    old_roi_ctl = '<div class="ctl"><label for="roi-mode">ROI Mode</label>\n    <select id="roi-mode" onchange="setRoiMode(this.value)">\n      <option value="base" selected>Base Hedonic Study ROI</option>\n      <option value="adj">Locally Context-Adjusted ROI</option>\n    </select>\n  </div>'
    new_roi_ctl = '<div class="ctl"><label for="roi-mode">ROI Mode</label>\n    <select id="roi-mode" onchange="setRoiMode(this.value)">\n      <option value="base" selected>Base Hedonic Study ROI</option>\n      <option value="adj">Locally Context-Adjusted ROI</option>\n    </select>\n    <button type="button" id="btn-toggle-experimental" class="story-btn" onclick="toggleExperimentalModes()" style="font-size:10px;padding:2px 7px;border-radius:4px;margin-top:2px;" title="Toggle speculative research modes (Grade U unverified leads & profit metric)">🧪 Exp Modes</button>\n  </div>'
    if old_roi_ctl in html:
        html = html.replace(old_roi_ctl, new_roi_ctl, 1)
        print("✓ Injected #btn-toggle-experimental button.")

    # 5. Update METRICS dictionary in JS
    old_metrics = """const METRICS = {
  top_vpd: { label: "Best value per $1 (where ≥ $1)", f: p => p.v >= 1 ? p.v : null, unit: fvpd, ramp: "seq", none: "Nothing returns $1 per $1" },
  pkg_cost: { label: "Cost of every project returning ≥ $1 per $1", f: p => p.pc || null, unit: fmt$, ramp: "seq" },
  value: { label: "Typical home value", f: p => p.hv, unit: fmt$, ramp: "seq" },
  heat: { label: "Heat vs. county median", f: p => p.ht, unit: v => (v > 0 ? "+" : "") + v.toFixed(1) + "°F", ramp: "heat" },
  crime: { label: "Violent crimes per 1,000 residents, 12 mo", f: p => p.vc, unit: v => v.toFixed(1), ramp: "heat" },
  park: { label: "Park acres within ½ mile", f: p => p.pa, unit: v => v.toFixed(1) + " ac", ramp: "seq" },
  bus: { label: "Buses per hour, busiest stop within 400 m (7–9am)", f: p => p.bt, unit: v => Math.round(v) + "/hr", ramp: "seq" },
  sites: { label: "Open street-tree sites", f: p => p.ts, unit: v => fmtN(v), ramp: "heat" },
  profit: { label: "Experimental: Profit potential (unverified)", f: p => p.pp > 0 ? p.pp * 100 : null, unit: v => v.toFixed(1) + "%", ramp: "seq", none: "No paying projects or sites" },
};"""

    new_metrics = """const METRICS = {
  top_vpd: { label: "Best value per $1 (where ≥ $1)", f: p => p.v >= 1 ? p.v : null, unit: fvpd, ramp: "seq", none: "Nothing returns $1 per $1" },
  pkg_cost: { label: "Cost of every project returning ≥ $1 per $1", f: p => p.pc || null, unit: fmt$, ramp: "seq" },
  value: { label: "Typical home value", f: p => p.hv, unit: fmt$, ramp: "seq" },
  heat: { label: "Heat vs. EPA Level IV ecoregion median", f: p => p.ht, unit: v => (v > 0 ? "+" : "") + v.toFixed(1) + "°F", ramp: "heat" },
  crime: { label: "Violent crimes per 1,000 residents, 12 mo", f: p => p.vc, unit: v => v.toFixed(1), ramp: "heat" },
  park: { label: "Park acres within ½ mile", f: p => p.pa, unit: v => v.toFixed(1) + " ac", ramp: "seq" },
  bus: { label: "Buses per hour, busiest stop within 400 m (7–9am)", f: p => p.bt, unit: v => Math.round(v) + "/hr", ramp: "seq" },
  sites: { label: "Open street-tree sites", f: p => p.ts, unit: v => fmtN(v), ramp: "heat" },
  displacement: {
    label: "Renter displacement sensitivity (0–100)",
    f: p => {
      if (p.dr != null) return p.dr;
      const rShare = p.renter_share ?? p.rs ?? (p.rent ? 0.48 : 0.40);
      const burden = p.severe_burden_share ?? p.rb ?? 0.28;
      const rentCtrl = p.rent_control_share ?? p.rc ?? 0.15;
      return Math.round(Math.max(0, Math.min(100, (rShare * 0.45 + burden * 0.40 + (1 - rentCtrl) * 0.15) * 100)));
    },
    unit: v => Math.round(v) + " / 100",
    ramp: "heat",
    none: "No rent data"
  },
  profit: { label: "Experimental: Profit potential (unverified)", f: p => p.pp > 0 ? p.pp * 100 : null, unit: v => v.toFixed(1) + "%", ramp: "seq", none: "No paying projects or sites" },
};"""

    if old_metrics in html:
        html = html.replace(old_metrics, new_metrics, 1)
        print("✓ Updated METRICS object with displacement and ecoregion heat label.")

    # 6. Read new engine files: lidarStreetViewValidator.js, parcelHouseAuditor.js, houseInspectorPanel.js, nov08DeltaPatch.js
    with open("src/engines/lidarStreetViewValidator.js", "r", encoding="utf-8") as f:
        js_lidar = f.read()
    with open("src/engines/parcelHouseAuditor.js", "r", encoding="utf-8") as f:
        js_auditor = f.read()
    with open("src/ui/houseInspectorPanel.js", "r", encoding="utf-8") as f:
        js_panel = f.read()
    with open("src/patches/nov08DeltaPatch.js", "r", encoding="utf-8") as f:
        js_patch = f.read()

    combined_js = f"""// === CITY PRETTY INSTITUTIONAL PARCEL AUDITOR & DELTA PATCH (NOV 08 2026) ===
{js_lidar}

{js_auditor}

{js_panel}

{js_patch}
// ============================================================================"""

    token_start = "// === CITY PRETTY INSTITUTIONAL PARCEL AUDITOR & DELTA PATCH (NOV 08 2026) ==="
    token_end = "// ============================================================================"
    p_start = html.find(token_start)
    p_end = html.find(token_end)
    if p_start != -1 and p_end != -1:
        html = html[:p_start] + combined_js + html[p_end + len(token_end):]
        print("✓ Replaced and updated institutional engine block in index.html with lidarStreetViewValidator.")
    else:
        token_sync = "function syncHeaderDomToCounty(fips) {"
        if token_sync in html:
            html = html.replace(token_sync, combined_js + "\n\n" + token_sync, 1)
            print("✓ Injected institutional engines before syncHeaderDomToCounty.")

    # 7. Update syncHeaderDomToCounty to call patchCanopyCardDom & patchTopBarControlsDom
    old_sync_end = """  if (typeof syncMethodsModalToCounty === "function") {
    syncMethodsModalToCounty(f);
  }
}"""
    new_sync_end = """  if (typeof syncMethodsModalToCounty === "function") {
    syncMethodsModalToCounty(f);
  }
  if (typeof patchCanopyCardDom === "function") {
    patchCanopyCardDom(comp.state, comp.name);
  }
  if (typeof patchTopBarControlsDom === "function") {
    patchTopBarControlsDom();
  }
}"""
    if old_sync_end in html:
        html = html.replace(old_sync_end, new_sync_end, 1)
        print("✓ Connected syncHeaderDomToCounty to patchCanopyCardDom and patchTopBarControlsDom.")

    # 8. Update fetchJSON to use resolveRepoAssetUrl
    old_fetch_top = """async function fetchJSON(url) {   // hosted county file: JSON, or gzip-compressed JSON (.json.gz) that the server sent as it is
  const isFile = typeof window !== "undefined" && window.location && window.location.protocol === "file:";
  const cleanUrl = url.startsWith("http") ? url : (isFile ? "https://milessilverman.github.io/city-pretty/" + url : url);"""

    new_fetch_top = """async function fetchJSON(url) {   // hosted county file: JSON, or gzip-compressed JSON (.json.gz) that the server sent as it is
  const cleanUrl = (typeof resolveRepoAssetUrl === "function") ? resolveRepoAssetUrl(url) : (url.startsWith("http") ? url : url);"""

    if old_fetch_top in html:
        html = html.replace(old_fetch_top, new_fetch_top, 1)
        print("✓ Updated fetchJSON() with resolveRepoAssetUrl().")

    # 9. Update renderHouse to run auditSingleHouseParcel and renderHouseAuditAside
    old_render_anchor = """  const h = houseChecks(a, lot, m, z, hMax, F, R);
  h.houseHv = houseHv;"""

    new_render_anchor = """  // Run Single-House Institutional Parcel Auditor
  let houseAudit = null;
  if (typeof auditSingleHouseParcel === "function") {
    try {
      const permitsList = (R && R.permits && Array.isArray(R.permits.v)) ? R.permits.v.map(p => ({
        issue_date: String(p.ISSUEDATE || p.IssueDate || "2024-01-01"),
        permit_type: /addition/i.test(p.VALUATION || p.TYPE || "") ? "addition" : /seismic/i.test(p.VALUATION || p.TYPE || "") ? "seismic" : "remodel",
        valuation_usd: +(p.VALUATION || p.Valuation || p.VALUATION_USD || 0) || 0,
        description: p.DESCRIPTION || p.Description || "Municipal building permit"
      })) : [];

      houseAudit = auditSingleHouseParcel({
        parcelId: String(a.AIN || a.APN || "PARCEL"),
        address: a.SitusFullAddress || "",
        lat: ll.lat,
        lng: ll.lng,
        lotSqft: lot || 6000,
        livingSqft: livingSqft,
        yearBuilt: F.yb || null,
        effectiveYearBuilt: F.eff || null,
        bedrooms: F.beds || 3,
        bathrooms: F.baths || 2,
        stories: F.stories || 1,
        hasPool: !!F.pool,
        hasGarage: !!F.garage,
        isVacantLand: valuation ? valuation.isVacantLand : false,
        units: F.units || 1,
        zoningCode: z ? z.zone : (a.ZoneCode || "R-1"),
        useDescription: a.UseDescription || "",
        rollLandValue: rollLand,
        rollImpValue: rollImp,
        rollBaseYear: rollBaseYear,
        lastSalePrice: sale ? sale.price : null,
        lastSaleDate: sale ? sale.date : null,
        neighborhoodMedianHv: baseNeighborhoodHv,
        stateCode: typeof activeState === "function" ? activeState() : "CA",
        countyFips: typeof activeFips === "function" ? activeFips() : "06037",
        recentPermits: permitsList,
        imageryInfo: {
          lidarYear: 2020,
          streetViewDate: "2021-06",
          hasStreetView: true
        },
        exclusions: {
          historic_district_hpoz: !!(R && R.hpoz && R.hpoz.ok),
          fema_100yr_floodway: !!(R && R.flood && R.flood.ok),
          calfire_or_state_vhfhsz: !!(R && R.fire && R.fire.ok)
        }
      });
      if (activeHouse) {
        activeHouse.audit = houseAudit;
      }
    } catch(errAudit) {
      console.warn("Single-house audit evaluation error:", errAudit);
    }
  }

  const h = houseChecks(a, lot, m, z, hMax, F, R);
  h.houseHv = houseHv;"""

    if old_render_anchor in html:
        html = html.replace(old_render_anchor, new_render_anchor, 1)
        print("✓ Connected auditSingleHouseParcel into renderHouse().")

    # In addition, render the house audit panel inside box.innerHTML right before interactive site plan
    old_site_plan = "<!-- 📐 INTERACTIVE SITE PLAN & INFILL / ADU MASSING VISUALIZER -->"
    new_site_plan = """<!-- 🏛️ INSTITUTIONAL PARCEL AUDIT & COMPREHENSIVE SCREENING PANEL -->
    ${houseAudit && typeof renderHouseAuditAside === "function" ? renderHouseAuditAside(houseAudit) : ""}

    <!-- 📐 INTERACTIVE SITE PLAN & INFILL / ADU MASSING VISUALIZER -->"""

    if old_site_plan in html:
        html = html.replace(old_site_plan, new_site_plan, 1)
        print("✓ Injected renderHouseAuditAside() into house dossier layout.")

    # 10. Update AI Advisor to append legal non-reliance disclosure
    old_ai_return = 'aiHistory.push({ role: "assistant", text: answer });'
    # Check if disclaimer is appended in generateAiAnswer
    old_answer_footer = 'return `<b>Active Transit Corridor: ${esc(pipe.title)}</b>'
    # Let's append disclaimer right at generateAiAnswer return
    old_gen_footer = """  setTimeout(() => {
    const answer = generateAiAnswer(q);
    aiHistory.push({ role: "assistant", text: answer });"""

    new_gen_footer = """  setTimeout(() => {
    let answer = generateAiAnswer(q);
    const disclaimer = `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:10px;color:#64748b;line-height:1.35;"><b>LEGAL &amp; ENGINEERING NON-RELIANCE NOTICE:</b> Preliminary screening based on public municipal GIS, tax rolls, and statutory feeds as of November 2026. Feasibility determinations do not constitute formal zoning verification letters, title opinions, or structural engineering assessments. Verify all easements, utility hookups, and setbacks with local building departments.</div>`;
    if (!answer.includes("NON-RELIANCE NOTICE")) {
      answer += disclaimer;
    }
    aiHistory.push({ role: "assistant", text: answer });"""

    if old_gen_footer in html:
        html = html.replace(old_gen_footer, new_gen_footer, 1)
        print("✓ Appended institutional legal & engineering non-reliance disclosure to AI Advisor.")

    old_ask_footer = """  setTimeout(() => {
    const answer = generateAiAnswer(promptText, key);
    aiHistory.push({ role: "assistant", text: answer });"""

    new_ask_footer = """  setTimeout(() => {
    let answer = generateAiAnswer(promptText, key);
    const disclaimer = `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:10px;color:#64748b;line-height:1.35;"><b>LEGAL &amp; ENGINEERING NON-RELIANCE NOTICE:</b> Preliminary screening based on public municipal GIS, tax rolls, and statutory feeds as of November 2026. Feasibility determinations do not constitute formal zoning verification letters, title opinions, or structural engineering assessments. Verify all easements, utility hookups, and setbacks with local building departments.</div>`;
    if (!answer.includes("NON-RELIANCE NOTICE")) {
      answer += disclaimer;
    }
    aiHistory.push({ role: "assistant", text: answer });"""

    if old_ask_footer in html:
        html = html.replace(old_ask_footer, new_ask_footer, 1)
        print("✓ Appended institutional disclaimer to askAiPrompt.")

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✓ Successfully wrote patched index.html.")

if __name__ == "__main__":
    main()
