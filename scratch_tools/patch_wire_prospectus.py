INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"
CITY_PRETTY_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/city-pretty.html"
VERIFIED_PATH = "/Users/milessilverman/Downloads/city-pretty-verified/city-pretty.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    c = f.read()

# 1. Wire up Export Prospectus button on Playbook
old_btn = """        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <button type="button" id="btn-copy-playbook" onclick="copyPlaybookMemo('${esc(b.title)}', ${b.equity}, ${b.roi}, '${esc(b.statute)}', '${cleanAddr}', '${cleanApn}')" style="background:#fff;color:#0f172a;border:1px solid #94a3b8;border-radius:6px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:all 0.15s;">
            📋 Copy Executive Investment Memo
          </button>
          <span style="font-size:10.5px;color:#64748b;">
            Deterministic &middot; AI Backbone Ready
          </span>
        </div>"""

new_btn = """        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <div style="display:flex;gap:6px;flex:1;max-width:380px;">
            <button type="button" id="btn-copy-playbook" onclick="copyPlaybookMemo('${esc(b.title)}', ${b.equity}, ${b.roi}, '${esc(b.statute)}', '${cleanAddr}', '${cleanApn}')" style="flex:1;background:#fff;color:#0f172a;border:1px solid #94a3b8;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              📋 Copy Memo
            </button>
            <button type="button" onclick="exportExecutiveProspectus()" style="flex:1;background:#0f172a;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.15);">
              📄 Export Prospectus (PDF)
            </button>
          </div>
          <span style="font-size:10.5px;color:#64748b;">
            Deterministic &middot; AI Backbone Ready
          </span>
        </div>"""

if old_btn in c:
    c = c.replace(old_btn, new_btn, 1)
    print("Added Export Prospectus button to Playbook card.")
else:
    print("WARNING: old_btn not found")

# 2. Wire up updateCanopyHud in select()
old_select_end = '$("#panel").innerHTML = h; $("#panel").scrollTop = 0;\n  eifdWire(p); fillSites(p);'
new_select_end = '$("#panel").innerHTML = h; $("#panel").scrollTop = 0;\n  eifdWire(p); fillSites(p);\n  if (typeof updateCanopyHud === "function") updateCanopyHud(p);'

if old_select_end in c:
    c = c.replace(old_select_end, new_select_end, 1)
    print("Added updateCanopyHud(p) call to select().")
else:
    print("WARNING: old_select_end not found")

# Save
with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(c)

with open(CITY_PRETTY_PATH, "w", encoding="utf-8") as f:
    f.write(c)

try:
    with open(VERIFIED_PATH, "w", encoding="utf-8") as f:
        f.write(c)
except Exception as e:
    pass
print("Finished syncing changes.")
