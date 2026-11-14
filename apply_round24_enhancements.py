#!/usr/bin/env python3
"""
apply_round24_enhancements.py
Implements:
1. Multi-term search in filterCountyReadinessTable (supports "harris tx", "miami fl", "orange ca").
2. Horizontal overflow scroll safety on the 639-county table.
3. Executive Prospectus Baseline AVM value integration and 4-column property identification header.
4. 1-click Print/PDF export for County Data Readiness & Provenance Report (exportAccuracyReport and .accuracy-printing CSS).
"""

import sys

def main():
    path = "index.html"
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Add .accuracy-printing to print CSS
    old_css = """  body.compare-printing * { visibility: hidden !important; }
  body.compare-printing #compare-modal, body.compare-printing #compare-modal * { visibility: visible !important; }
  body.compare-printing #compare-modal { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20px !important; background: #fff !important; }
  body.compare-printing .modal-close, body.compare-printing #compare-modal button { display: none !important; }"""

    new_css = """  body.compare-printing * { visibility: hidden !important; }
  body.compare-printing #compare-modal, body.compare-printing #compare-modal * { visibility: visible !important; }
  body.compare-printing #compare-modal { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20px !important; background: #fff !important; }
  body.compare-printing .modal-close, body.compare-printing #compare-modal button { display: none !important; }

  body.accuracy-printing * { visibility: hidden !important; }
  body.accuracy-printing #accuracy-modal, body.accuracy-printing #accuracy-modal * { visibility: visible !important; }
  body.accuracy-printing #accuracy-modal { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20px !important; background: #fff !important; }
  body.accuracy-printing .modal-close, body.accuracy-printing #accuracy-modal button, body.accuracy-printing #county-matrix-search { display: none !important; }"""

    if old_css not in html:
        print("ERROR: old_css not found!")
        sys.exit(1)
    html = html.replace(old_css, new_css)

    # 2. Add Print button to #accuracy-modal tab header
    old_acc_tabs = """    <!-- Top Tab Switcher -->
    <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid #cbd5e1;padding-bottom:10px;">
      <button type="button" id="tab-btn-county-readiness" class="action-pill active" onclick="switchAccuracyTab('readiness')" style="font-size:12px;font-weight:700;">🏛️ County Data Readiness &amp; Provenance Matrix</button>
      <button type="button" id="tab-btn-model-provenance" class="action-pill" onclick="switchAccuracyTab('provenance')" style="font-size:12px;font-weight:700;">🔬 Econometric Hedonic Model &amp; AI Backbone</button>
    </div>"""

    new_acc_tabs = """    <!-- Top Tab Switcher & Export Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:18px;border-bottom:1px solid #cbd5e1;padding-bottom:10px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" id="tab-btn-county-readiness" class="action-pill active" onclick="switchAccuracyTab('readiness')" style="font-size:12px;font-weight:700;">🏛️ County Data Readiness &amp; Provenance Matrix</button>
        <button type="button" id="tab-btn-model-provenance" class="action-pill" onclick="switchAccuracyTab('provenance')" style="font-size:12px;font-weight:700;">🔬 Econometric Hedonic Model &amp; AI Backbone</button>
      </div>
      <button type="button" onclick="exportAccuracyReport()" style="background:#0284c7;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
        🖨️ Print / Save Report (PDF)
      </button>
    </div>"""

    if old_acc_tabs not in html:
        print("ERROR: old_acc_tabs not found!")
        sys.exit(1)
    html = html.replace(old_acc_tabs, new_acc_tabs)

    # 3. Add exportAccuracyReport helper
    old_acc_fn = """function closeAccuracyModal() {
  const m = document.getElementById("accuracy-modal");
  if (m) { m.hidden = true; document.body.style.overflow = ""; }
}"""

    new_acc_fn = """function closeAccuracyModal() {
  const m = document.getElementById("accuracy-modal");
  if (m) { m.hidden = true; document.body.style.overflow = ""; }
}

function exportAccuracyReport() {
  document.body.classList.remove("prospectus-printing", "compare-printing");
  document.body.classList.add("accuracy-printing");
  window.print();
  setTimeout(() => document.body.classList.remove("accuracy-printing"), 1200);
}
window.exportAccuracyReport = exportAccuracyReport;"""

    if old_acc_fn not in html:
        print("ERROR: old_acc_fn not found!")
        sys.exit(1)
    html = html.replace(old_acc_fn, new_acc_fn)

    # 4. Update filterCountyReadinessTable to support multi-word search & overflow: auto
    old_table_wrapper = """      <div style="max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">"""
    new_table_wrapper = """      <div style="max-height:300px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;">"""
    if old_table_wrapper in html:
        html = html.replace(old_table_wrapper, new_table_wrapper)

    old_filter_logic = """    if (q) {
      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchState = (c.state || "").toLowerCase().includes(q);
      const matchFips = (c.fips || "").toLowerCase().includes(q);
      return matchName || matchState || matchFips;
    }"""

    new_filter_logic = """    if (q) {
      const full = `${c.name || ""} ${c.state || ""} ${c.fips || ""}`.toLowerCase();
      const tokens = q.split(/\\s+/).filter(Boolean);
      return tokens.every(tok => full.includes(tok));
    }"""

    if old_filter_logic not in html:
        print("ERROR: old_filter_logic not found!")
        sys.exit(1)
    html = html.replace(old_filter_logic, new_filter_logic)

    # 5. Update exportExecutiveProspectus to resolve baseline AVM value and show 4th column
    old_prosp_values = """  const rollVal = a.Roll_TotalValue || a.TAXABLETRIBUNAL1 || (a.Roll_LandValue && a.Roll_ImpValue ? a.Roll_LandValue + a.Roll_ImpValue : 520000);
  const aPrice = F.aPrice || (rollVal * 1.6);
  const sqft = a.SQFTmain || F.sqft || 1450;
  const lotSqft = (lot && lot.lotSqft) || (a.ACREAGE ? Math.round(a.ACREAGE * 43560) : 6200);

  content.innerHTML = `
    <!-- Prospectus Print Header -->
    <div style="border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#0284c7;">City Pretty Institutional Advisory Platform</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#0f172a;margin:2px 0;">EXECUTIVE PROPERTY &amp; INVESTMENT PROSPECTUS</div>
        <div style="font-size:13px;font-weight:600;color:#64748b;">Ground-Truth Cadastre · By-Right Statutory Zoning · Empirical ROI Capitalization</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#64748b;">DATE: ${dateStr}</div>
        <div style="font-size:11px;font-weight:700;color:#059669;">CONFIDENTIAL &amp; PROPRIETARY</div>
      </div>
    </div>

    <!-- Property Identification Box -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Deeded Situs Address</div>
        <div style="font-size:15px;font-weight:800;color:#0f172a;">${esc(addr)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(juris)}, ${activeState()} · FIPS: ${activeFips()}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Assessor Parcel (APN)</div>
        <div style="font-size:14px;font-weight:700;font-family:var(--mono);color:#0f172a;">${esc(ain)}</div>
        <div style="font-size:11px;color:#64748b;">Lot: ${fmtN(lotSqft)} sqft (${(lotSqft/43560).toFixed(2)} ac)</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Existing Improvements</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${fmtN(sqft)} sqft Main</div>
        <div style="font-size:11px;color:#64748b;">Built ${a.YearBuilt || "N/A"} · ${a.Units || 1} Unit(s)</div>
      </div>
    </div>"""

    new_prosp_values = """  const valObj = (typeof currentHouse !== "undefined" && currentHouse && currentHouse.valuation) || (typeof activeHouse !== "undefined" && activeHouse && activeHouse.valuation) || null;
  const houseHv = (typeof activeHouse !== "undefined" && activeHouse && activeHouse.houseHv) || (valObj ? valObj.estimatedValue : null);
  const rollVal = a.Roll_TotalValue || a.TAXABLETRIBUNAL1 || (a.Roll_LandValue && a.Roll_ImpValue ? a.Roll_LandValue + a.Roll_ImpValue : 520000);
  const aPrice = houseHv || F.aPrice || (rollVal * 1.6);
  const sqft = (valObj && valObj.livingSqft) || a.SQFTmain || F.bldg || F.sqft || 1450;
  const lotSqft = (lot && lot.lotSqft) || (a.ACREAGE ? Math.round(a.ACREAGE * 43560) : 6200);

  content.innerHTML = `
    <!-- Prospectus Print Header -->
    <div style="border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#0284c7;">City Pretty Institutional Advisory Platform</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#0f172a;margin:2px 0;">EXECUTIVE PROPERTY &amp; INVESTMENT PROSPECTUS</div>
        <div style="font-size:13px;font-weight:600;color:#64748b;">Ground-Truth Cadastre · By-Right Statutory Zoning · Empirical ROI Capitalization</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#64748b;">DATE: ${dateStr}</div>
        <div style="font-size:11px;font-weight:700;color:#059669;">CONFIDENTIAL &amp; PROPRIETARY</div>
      </div>
    </div>

    <!-- Property Identification Box -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:grid;grid-template-columns:2fr 1.2fr 1.2fr 1.2fr;gap:12px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Deeded Situs Address</div>
        <div style="font-size:15px;font-weight:800;color:#0f172a;">${esc(addr)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(juris)}, ${activeState()} · FIPS: ${activeFips()}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Assessor Parcel (APN)</div>
        <div style="font-size:14px;font-weight:700;font-family:var(--mono);color:#0f172a;">${esc(ain)}</div>
        <div style="font-size:11px;color:#64748b;">Lot: ${fmtN(lotSqft)} sqft (${(lotSqft/43560).toFixed(2)} ac)</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Existing Improvements</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${fmtN(sqft)} sqft Main</div>
        <div style="font-size:11px;color:#64748b;">Built ${a.YearBuilt || "N/A"} · ${a.Units || 1} Unit(s)</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Baseline AVM Value</div>
        <div style="font-size:14px;font-weight:800;color:#059669;">${fmtP(aPrice)}</div>
        <div style="font-size:11px;color:#64748b;">~$${Math.round(aPrice / Math.max(sqft, 1)).toLocaleString()}/sqft</div>
      </div>
    </div>"""

    if old_prosp_values not in html:
        print("ERROR: old_prosp_values not found!")
        sys.exit(1)
    html = html.replace(old_prosp_values, new_prosp_values)

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("SUCCESS: apply_round24_enhancements.py applied successfully!")

if __name__ == "__main__":
    main()
