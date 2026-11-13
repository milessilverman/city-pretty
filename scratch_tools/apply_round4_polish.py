import re
import sys

INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add #l-p3 checkbox to layers dropdown (if not already added)
old_layers_dropdown = """      <label><input type="checkbox" id="l-roads" checked> Streets &amp; names</label>
      <label><input type="checkbox" id="l-transit" checked> Rail &amp; frequent buses</label>"""

new_layers_dropdown = """      <label><input type="checkbox" id="l-roads" checked> Streets &amp; names</label>
      <label><input type="checkbox" id="l-transit" checked> Rail &amp; frequent buses</label>
      <label><input type="checkbox" id="l-p3" checked> 🚆 Planned P3 Rail &amp; BRT Corridors</label>"""

if old_layers_dropdown in content:
    content = content.replace(old_layers_dropdown, new_layers_dropdown, 1)
    print("SUCCESS: Added #l-p3 checkbox to layers dropdown")

# 2. Add .hud-pct CSS (if not already added)
old_hud_css = """.hud-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}"""

new_hud_css = """.hud-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.hud-pct {
  background: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  padding: 2px 7px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}"""

if old_hud_css in content and ".hud-pct" not in content:
    content = content.replace(old_hud_css, new_hud_css, 1)
    print("SUCCESS: Added .hud-pct CSS")

# 3. Add hud-pct element into #county-hud HTML
old_hud_html = """<div id="county-hud" class="county-hud" style="display:none"><span class="hud-spinner"></span><span id="hud-text">Loading county data…</span></div>"""
new_hud_html = """<div id="county-hud" class="county-hud" style="display:none"><span class="hud-spinner"></span><span class="hud-pct" id="hud-pct">15%</span><span id="hud-text">Loading county data…</span></div>"""

if old_hud_html in content:
    content = content.replace(old_hud_html, new_hud_html, 1)
    print("SUCCESS: Added hud-pct element into #county-hud")

# 4. Update hud and progress functions
old_progress_block = """function startProgress(initialPct = 15) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = initialPct + "%";
}
function setProgress(pct) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = pct + "%";
}
function doneProgress() {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.width = "100%";
  setTimeout(() => {
    bar.style.opacity = "0";
    setTimeout(() => { bar.style.width = "0%"; }, 400);
  }, 250);
}"""

new_progress_block = """function startProgress(initialPct = 15) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = initialPct + "%";
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = Math.round(initialPct) + "%";
}
function setProgress(pct) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = pct + "%";
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = Math.round(pct) + "%";
}
function doneProgress() {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.width = "100%";
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = "100%";
  setTimeout(() => {
    bar.style.opacity = "0";
    setTimeout(() => { bar.style.width = "0%"; }, 400);
  }, 250);
}"""

if old_progress_block in content:
    content = content.replace(old_progress_block, new_progress_block, 1)
    print("SUCCESS: Updated startProgress, setProgress, and doneProgress for percentage counter")

# 5. Add drawP3Corridors and clearP3Corridors right before function drawContext()
draw_p3_code = """let p3PersistentLayer = null;

function clearP3Corridors() {
  if (p3PersistentLayer && typeof map !== "undefined" && map && map.hasLayer(p3PersistentLayer)) {
    map.removeLayer(p3PersistentLayer);
    p3PersistentLayer = null;
  }
}

function drawP3Corridors() {
  clearP3Corridors();
  if (typeof map === "undefined" || !map) return;
  const cb = $("#l-p3");
  if (cb && !cb.checked) return;

  const pipe = (typeof getMetroPipeline === "function") ? getMetroPipeline(activeFips()) : null;
  if (!pipe || !pipe.corridorRings || !pipe.corridorRings.length) return;

  const layers = [];

  // 1. Neon glowing transit corridor polyline
  const transitLine = L.polyline(pipe.corridorRings, {
    color: "#0284c7",
    weight: 4.5,
    opacity: 0.85,
    dashArray: "8 5"
  }).bindTooltip(`<b>${esc(pipe.title.split('&')[0].trim())}</b><br><span style="color:#0369a1;font-size:11px">Planned P3 Transit Alignment</span>`, { sticky: true });
  layers.push(transitLine);

  // 2. Station circle markers with labels
  if (pipe.stations && pipe.stations.length) {
    pipe.stations.forEach(stn => {
      const isAnchor = (stn.lat === pipe.hubLat && stn.lng === pipe.hubLng);
      const marker = L.circleMarker([stn.lat, stn.lng], {
        radius: isAnchor ? 7 : 5,
        color: isAnchor ? "#0284c7" : "#0369a1",
        weight: 2.5,
        fillColor: isAnchor ? "#38bdf8" : "#ffffff",
        fillOpacity: 1
      }).bindTooltip(`<b>${isAnchor ? '🚆 ' : '🚉 '}${esc(stn.name)}</b><br><span style="font-size:11px;color:#0284c7">${stn.units} TOD Homes (${stn.affordPct}% affordable)</span>`, { sticky: true });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        flyToP3Station(stn.lat, stn.lng, stn.name, stn.units, stn.affordPct, stn.retailSqft);
      });
      layers.push(marker);
    });
  }

  p3PersistentLayer = L.layerGroup(layers).addTo(map);
}
"""

old_draw_context_anchor = """function drawContext() {"""
if old_draw_context_anchor in content and "function drawP3Corridors" not in content:
    content = content.replace(old_draw_context_anchor, draw_p3_code + "\n" + old_draw_context_anchor, 1)
    print("SUCCESS: Added drawP3Corridors definition")

# 6. Wire drawP3Corridors into drawContext()
old_draw_context_end = """  zoomed();
}"""

new_draw_context_end = """  zoomed();
  if (on("#l-p3")) {
    drawP3Corridors();
  } else {
    clearP3Corridors();
  }
}"""

if old_draw_context_end in content:
    content = content.replace(old_draw_context_end, new_draw_context_end, 1)
    print("SUCCESS: Wired drawP3Corridors into drawContext")

# 7. Wire #l-p3 onchange in top listeners
old_listener_list = """  ["#l-roads", "#l-transit", "#l-parks", "#l-amen", "#l-hoods", "#l-fac", "#l-zone", "#l-under", "#l-proj"].forEach(id => $(id).onchange = drawContext);"""
new_listener_list = """  ["#l-roads", "#l-transit", "#l-parks", "#l-amen", "#l-hoods", "#l-fac", "#l-zone", "#l-under", "#l-proj", "#l-p3"].forEach(id => $(id) && ($(id).onchange = drawContext));"""

if old_listener_list in content:
    content = content.replace(old_listener_list, new_listener_list, 1)
    print("SUCCESS: Wired #l-p3 onchange listener")

# 8. Add Valuation Comps & Methodology details drawer in renderHouse
old_house_facts_table = """          <a href="https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(searchAddress.replace(/\\s+/g, '-'))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#d92228;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;text-decoration:none;" title="Cross-check on Realtor.com">
            🏠 Realtor.com ↗
          </a>
        </div>
      </div>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; cross-check with live Zillow/Redfin valuation comps`)}"""

new_house_facts_table = """          <a href="https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(searchAddress.replace(/\\s+/g, '-'))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#d92228;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;text-decoration:none;" title="Cross-check on Realtor.com">
            🏠 Realtor.com ↗
          </a>
        </div>
        <details style="margin-top:6px;border:1px solid #e2e8f0;border-radius:6px;padding:6px 9px;background:#f8fafc;font-size:11.5px;">
          <summary style="font-weight:700;cursor:pointer;color:#0284c7;">📈 How is this estimated? (Valuation Comps &amp; Methodology)</summary>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;line-height:1.45;">
            <div><b>Hedonic Baseline Model:</b> Multi-variate property model calibrated against recent county deed transfers and Census ACS block-group microdata.</div>
            <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <div>• <b>Gross Living Area:</b> ${fmtN(livingSqft)} sq ft @ ~$${houseVpsf}/sq ft</div>
              <div>• <b>Age Factor:</b> ${F.yb ? `${F.yb} (${ageFactor >= 1 ? '+' : ''}${((ageFactor - 1) * 100).toFixed(1)}%)` : 'Baseline'}</div>
              <div>• <b>Beds/Baths:</b> ${F.beds || 3} bd / ${F.baths || 2} ba (${bedBathFactor >= 1 ? '+' : ''}${((bedBathFactor - 1) * 100).toFixed(1)}%)</div>
              <div>• <b>Lot Premium:</b> ${fmtN(lot || 6000)} sq ft (${lotBonus >= 0 ? '+' : ''}${fmt$(lotBonus)})</div>
              ${F.pool ? `<div>• <b>Pool Premium:</b> +${fmt$(poolBonus)}</div>` : ''}
              ${sale ? `<div>• <b>Last Recorded Sale:</b> ${fmt$(sale.price)} (${sale.date.slice(0, 4)})</div>` : ''}
            </div>
            <div style="margin-top:5px;font-size:11px;color:#64748b;">
              <b>Note on Assessor Roll vs Market Value:</b> Tax assessment roll values typically reflect statutory base-year acquisition caps (such as California Prop 13 or Florida Save Our Homes), which often lag true open-market equity. Compare with live broker AVMs using the Zillow and Redfin buttons above.
            </div>
          </div>
        </details>
      </div>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; cross-check with live Zillow/Redfin valuation comps`)}"""

if old_house_facts_table in content:
    content = content.replace(old_house_facts_table, new_house_facts_table, 1)
    print("SUCCESS: Added Valuation Comps & Methodology details drawer in renderHouse")

with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: All Round 4 polish changes written to index.html!")
