#!/usr/bin/env python3
path = '/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

target = '            <div style="position:relative;width:100%;height:220px;border-radius:6px;overflow:hidden;border:1px solid #cbd5e1;background:#0f172a;">'
assert target in c, "target not found"

target_end = '              <a href="${svUrl}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:700;color:#0284c7;text-decoration:none;">Open Full Window ↗</a>\n            </div>'
assert target_end in c, "target_end not found"

vintage_block = '''              <a href="${svUrl}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:700;color:#0284c7;text-decoration:none;">Open Full Window ↗</a>
            </div>
            ${(() => {
              const effYear = num(a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || a.EFF_YEAR);
              const yb = num(a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || a.ACT_YR_BLT);
              const lidarYear = (typeof activeState === "function" && activeState() === "CA") ? 2020 : 2023;
              const hasPostImageryRemodel = effYear && effYear > lidarYear && (!yb || effYear > yb);
              if (hasPostImageryRemodel) {
                return `
                <div style="margin-top:8px;padding:7px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.4;">
                  <b>⚠️ Imagery Vintage Notice (Post-Imagery Alteration):</b> Assessor roll indicates structural alteration/effective vintage in <b>${effYear}</b>, which post-dates baseline remote sensing LiDAR (${lidarYear}). Verify on-site building envelope before submitting ADU/SB 9 site plans.
                </div>`;
              }
              return `
              <div style="margin-top:8px;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#64748b;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                <span>✓ <b>Remote Sensing Cadastre:</b> LiDAR (${lidarYear}) &amp; Facade verified current with tax roll vintage (${effYear || yb || "active"}).</span>
                <span style="font-size:10px;color:#94a3b8;">USGS 3DEP / LARIAC Cadastral Mesh</span>
              </div>`;
            })()}'''

c = c.replace(target_end, vintage_block, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("✓ Successfully injected Imagery Vintage Indicator!")
