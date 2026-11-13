import re

FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

print("Original length:", len(content))

# 1. Add focusP3Walkshed definition and wire flyToP3Station to call it
FOCUS_WALKSHED_FN = '''
function focusP3Walkshed(lat, lng, name, radiusMeters = 805) {
  if (typeof map === "undefined" || !map) return;
  map.flyTo([lat, lng], radiusMeters > 1000 ? 15 : 16, { animate: true, duration: 1.0 });

  if (p3WalkshedLayer && map.hasLayer(p3WalkshedLayer)) {
    map.removeLayer(p3WalkshedLayer);
    p3WalkshedLayer = null;
  }

  const layers = [];
  const circle = L.circle([lat, lng], {
    radius: radiusMeters,
    color: "#0284c7",
    weight: 2,
    dashArray: "6,6",
    fillColor: "#38bdf8",
    fillOpacity: 0.14,
    interactive: false
  });
  layers.push(circle);

  const marker = L.circleMarker([lat, lng], {
    radius: 9,
    color: "#ffffff",
    weight: 3,
    fillColor: "#0284c7",
    fillOpacity: 1.0
  }).bindPopup(`
    <div style="font-family:var(--body);line-height:1.45;padding:4px 2px;min-width:220px;">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.5px;">🚆 Planned Transit Station</div>
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin:2px 0 4px;">${esc(name || "Transit Station")}</div>
      <div style="font-size:11.5px;color:#475569;margin-bottom:6px;">
        <b>Walkshed Radius:</b> ${(radiusMeters / 1609.34).toFixed(2)} mi (~${Math.round(radiusMeters / 80)} min walk)
      </div>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 402)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters <= 500 ? '#0284c7' : '#fff'};color:${radiusMeters <= 500 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">5-Min (0.25 mi)</button>
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 805)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters > 500 && radiusMeters <= 1000 ? '#0284c7' : '#fff'};color:${radiusMeters > 500 && radiusMeters <= 1000 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">10-Min (0.5 mi)</button>
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 1207)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters > 1000 ? '#0284c7' : '#fff'};color:${radiusMeters > 1000 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">15-Min (0.75 mi)</button>
      </div>
      <div style="font-size:11px;color:#0369a1;background:#e0f2fe;padding:5px 8px;border-radius:4px;">
        <b>Transit Infill Bonus:</b> 0 parking minimums for ADUs &amp; conversions within ½ mile
      </div>
    </div>
  `);
  layers.push(marker);

  p3WalkshedLayer = L.layerGroup(layers).addTo(map);
  setTimeout(() => marker.openPopup(), 400);
  showToast(`Focusing station: ${name} (${(radiusMeters / 1609.34).toFixed(2)}-mi walkshed)`);
}
'''

if "function focusP3Walkshed" not in content:
    target_pos = "let p3WalkshedLayer = null;"
    if target_pos in content:
        content = content.replace(target_pos, target_pos + "\n" + FOCUS_WALKSHED_FN, 1)
        print("Successfully inserted focusP3Walkshed")
    else:
        print("ERROR: target_pos for focusP3Walkshed not found")

# 2. Add Transit Walkshed Card and Solar Drawer into renderHouse
# Let's see where facts table starts in renderHouse
target_facts_start = '<table class="small facts"><tbody>'
TRANSIT_WALKSHED_SNIPPET = '''${(() => {
      let nearestStation = null;
      let minStationDistMi = Infinity;
      try {
        const allStns = typeof getAllMetroStations === "function" ? getAllMetroStations() : [];
        for (const s of allStns) {
          const dLat = (s.lat - ll.lat) * 69.0;
          const dLng = (s.lng - ll.lng) * 54.6;
          const distMi = Math.hypot(dLat, dLng);
          if (distMi < minStationDistMi) {
            minStationDistMi = distMi;
            nearestStation = s;
          }
        }
      } catch(e) {}

      if (nearestStation && minStationDistMi <= 0.75) {
        return `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:11px 13px;margin:8px 0;line-height:1.45;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px;color:#1e40af;">
              <span>🚆</span> <span>Transit Walkshed: ~${minStationDistMi.toFixed(2)} mi to ${esc(nearestStation.name)}</span>
            </div>
            <button type="button" onclick="focusP3Walkshed(${nearestStation.lat}, ${nearestStation.lng}, '${esc(nearestStation.name)}', 805)" style="background:#0284c7;color:#fff;border:none;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
              Focus Station Walkshed
            </button>
          </div>
          <div style="font-size:11.5px;color:#334155;">
            <div>• <b>Zero Parking Minimums:</b> By-right parking exemption applies under statutory transit housing accords (saves ~$35,000–$55,000 in garage replacement costs for ADUs and conversions).</div>
            <div>• <b>Corridor:</b> ${esc(nearestStation.metroName)} · ~${Math.round(minStationDistMi * 18)} min walk</div>
          </div>
        </div>`;
      }
      return "";
    })()}
    <table class="small facts"><tbody>'''

if target_facts_start in content and "Transit Walkshed: ~" not in content:
    content = content.replace(target_facts_start, TRANSIT_WALKSHED_SNIPPET, 1)
    print("Successfully added Transit Walkshed card to renderHouse")
else:
    print("WARNING: target_facts_start not found or already inserted")

# 3. Add Rooftop Solar Potential Drawer right after Street View Inspect Drawer
target_sv_drawer_end = '</details>\n'
SOLAR_DRAWER_SNIPPET = '''${(() => {
        const usableSolarSqft = Math.round((F.foot || 1200) * 0.65);
        const solarKw = Math.max(3.5, Math.min(18.0, Math.round((usableSolarSqft / 60) * 2) / 2));
        const solarKwhYr = Math.round(solarKw * 1480);
        const solarSavYr = Math.round(solarKwhYr * 0.23);
        const solarGrossCost = Math.round(solarKw * 2800);
        const solarTaxCredit = Math.round(solarGrossCost * 0.30);
        const solarNetCost = solarGrossCost - solarTaxCredit;
        const solarPaybackYrs = (solarNetCost / Math.max(solarSavYr, 500)).toFixed(1);
        return `
        <details class="solar-potential-drawer" style="margin:10px 0;border:1px solid #fde047;border-radius:8px;background:#fefce8;overflow:hidden;">
          <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#854d0e;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
            <span>☀️ Rooftop Solar &amp; Clean Energy Potential</span>
            <span style="font-size:11px;background:#fef9c3;color:#713f12;padding:2px 7px;border-radius:4px;font-weight:600">~${solarKw.toFixed(1)} kW System · Saves ${fmt$(solarSavYr)}/yr</span>
          </summary>
          <div style="padding:10px 12px;background:#fff;border-top:1px solid #fde047;font-size:12px;line-height:1.45;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
              <div>• <b>Usable Solar Roof Area:</b> ${fmtN(usableSolarSqft)} sq ft (~65% unshaded)</div>
              <div>• <b>System Capacity:</b> ${solarKw.toFixed(1)} kW DC (${Math.round(solarKw * 2.5)} premium panels)</div>
              <div>• <b>Annual Clean Generation:</b> ${fmtN(solarKwhYr)} kWh / year</div>
              <div>• <b>Annual Electric Bill Savings:</b> ~${fmt$(solarSavYr)} / yr @ $0.23/kWh</div>
              <div>• <b>30% Federal ITC (IRA § 25D):</b> -${fmt$(solarTaxCredit)} tax credit</div>
              <div>• <b>Net System Cost:</b> ~${fmt$(solarNetCost)} (Payback in ~${solarPaybackYrs} yrs)</div>
            </div>
            <div style="font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:6px;">
              <b>Clean Energy Equity:</b> Projected 25-year cumulative net savings: <b>+${fmt$(solarSavYr * 25 - solarNetCost)}</b>. Compatible with net metering / solar billing tariff and battery backup storage.
            </div>
          </div>
        </details>`;
      })()}
'''

target_drawer_marker = '        </details>\n\n    ${bestH ?'
if target_drawer_marker in content:
    content = content.replace(target_drawer_marker, '        </details>\n' + SOLAR_DRAWER_SNIPPET + '\n    ${bestH ?', 1)
    print("Successfully added Solar Potential Drawer to renderHouse")
else:
    print("WARNING: target_drawer_marker not found")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.html, new length:", len(content))
