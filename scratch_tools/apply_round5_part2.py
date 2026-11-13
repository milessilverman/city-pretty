import re

FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

print("Original length:", len(content))

# 1. Add getAllMetroStations and highlightQuery helpers before addressSearch
HELPERS = '''
function highlightQuery(text, query) {
  if (!text || !query) return esc(text || "");
  const terms = query.trim().split(/\\s+/).filter(t => t.length > 0).map(t => t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'));
  if (!terms.length) return esc(text);
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return esc(text).replace(re, '<mark style="background:#fef08a;color:#854d0e;border-radius:2px;padding:0 2px;font-weight:600">$1</mark>');
}

function getAllMetroStations() {
  const fipsList = [
    "48453", "06037", "06059", "08031", "53033", "04013", "22071",
    "17031", "13121", "06075", "06085", "12086", "11001", "24031", "48113", "36081", "36047", "25025", "42101"
  ];
  const list = [];
  const seen = new Set();
  fipsList.forEach(f => {
    try {
      const pipe = getMetroPipeline(f);
      if (pipe && pipe.stations) {
        pipe.stations.forEach(s => {
          const key = `${s.name}_${s.lat.toFixed(4)}_${s.lng.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              fips: pipe.fips,
              metroName: pipe.metroName,
              title: pipe.title,
              units: s.units,
              affordPct: s.affordPct
            });
          }
        });
      }
    } catch(e) {}
  });
  return list;
}

let _currentSvHeading = 0;
function setStreetViewAngle(heading) {
  _currentSvHeading = heading;
  document.querySelectorAll(".sv-angle-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.heading === heading);
  });
  const iframe = document.querySelector("#sv-iframe");
  if (iframe && iframe.dataset.baseLat && iframe.dataset.baseLng) {
    const lat = iframe.dataset.baseLat, lng = iframe.dataset.baseLng;
    iframe.src = `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=11,${heading},0,0,0&output=svembed`;
  }
}
'''

if "function getAllMetroStations" not in content:
    target_fn = "function addressSearch(q, isFinal = false) {"
    if target_fn in content:
        content = content.replace(target_fn, HELPERS + "\n" + target_fn, 1)
        print("Inserted HELPERS before addressSearch")
    else:
        print("ERROR: addressSearch not found")

# 2. Upgrade addressSearch implementation with stations, highlightQuery, and keyboard arrows
NEW_ADDR_SEARCH = '''function addressSearch(q, isFinal = false) {
  q = String(q || "").trim();
  activeSearchIndex = -1;
  if (!q) { hideAddr(); return; }

  if (isFinal) {
    hideAddr();
    handleSearchSubmit(q);
    return;
  }

  if (q.length < 2) { hideAddr(); return; }
  clearTimeout(addrTimer);
  addrTimer = setTimeout(async () => {
    try {
      const qLower = q.toLowerCase();

      // 1. Match local neighborhoods and communities in current county
      const localMatches = [];
      let searchMap = null;
      if (typeof isOrangeActive === "function" && isOrangeActive() && typeof D_OC !== "undefined" && D_OC && D_OC.search) {
        searchMap = D_OC.search;
      } else if (typeof D_OC !== "undefined" && D_OC && D_OC.search) {
        searchMap = D_OC.search;
      } else if (typeof D !== "undefined" && D && D.meta && D.meta.search) {
        searchMap = D.meta.search;
      }
      if (searchMap) {
        const keys = Object.keys(searchMap);
        for (const k of keys) {
          if (k.toLowerCase().includes(qLower)) {
            localMatches.push({ name: k, bgId: searchMap[k] });
            if (localMatches.length >= 4) break;
          }
        }
      }

      // 2. Match Planned P3 Transit Stations & Hubs
      const stationMatches = [];
      try {
        const allStns = typeof getAllMetroStations === "function" ? getAllMetroStations() : [];
        for (const s of allStns) {
          const sName = (s.name || "").toLowerCase();
          const mName = (s.metroName || "").toLowerCase();
          if (sName.includes(qLower) || mName.includes(qLower)) {
            stationMatches.push(s);
            if (stationMatches.length >= 3) break;
          }
        }
      } catch(e) {}

      // 3. Match US Counties from county-bundle elements
      const countyMatches = [];
      if (typeof countyBundleEls === "function") {
        const cEls = countyBundleEls();
        for (const el of cEls) {
          const cn = (el.dataset.name || "");
          const st = (el.dataset.st || "");
          const full = `${cn}, ${st}`;
          if (cn.toLowerCase().includes(qLower) || full.toLowerCase().includes(qLower)) {
            countyMatches.push({ name: full, fips: el.dataset.fips });
            if (countyMatches.length >= 3) break;
          }
        }
      }

      // 4. ArcGIS World Geocoder candidates for street addresses & specific houses
      let cands = [];
      try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&f=json&maxLocations=6&countryCode=USA`;
        const r = await fetch(arcUrl);
        if (r.ok) {
          const data = await r.json();
          cands = (data.candidates || []).filter(c => c.address && c.location);
        }
      } catch(e) {}

      hideAddr();
      if (!localMatches.length && !stationMatches.length && !countyMatches.length && !cands.length) return;

      const box = document.createElement("div");
      box.id = "addr-results";

      let html = "";
      if (localMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">🏙️ Local Neighborhoods & Communities</div>`;
        localMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="local" data-bg="${esc(m.bgId)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#0284c7;font-size:14px">🏙️</span> <span>${highlightQuery(m.name, q)}</span></button>`;
        });
      }

      if (stationMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0284c7;background:#f0f9ff;border-bottom:1px solid #bae6fd;">🚆 Planned P3 Rail & Transit Stations</div>`;
        stationMatches.forEach((s, idx) => {
          html += `<button type="button" class="addr-item" data-type="station" data-idx="${idx}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#0284c7;font-size:14px">🚆</span> <div><div style="font-weight:600">${highlightQuery(s.name, q)}</div><div style="font-size:11px;color:#64748b">${esc(s.metroName)}</div></div></button>`;
        });
      }

      if (countyMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">🏛️ US Counties</div>`;
        countyMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="county" data-fips="${esc(m.fips)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#8b5cf6;font-size:14px">🏛️</span> <span>${highlightQuery(m.name, q)}</span></button>`;
        });
      }

      if (cands.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">📍 Specific Addresses & Houses (USA)</div>`;
        cands.forEach((c, idx) => {
          html += `<button type="button" class="addr-item" data-type="cand" data-i="${idx}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#e11d48;font-size:14px">📍</span> <span>${highlightQuery(c.address, q)}</span></button>`;
        });
      }

      box.innerHTML = html;
      const qInput = $("#q");
      if (qInput && qInput.parentElement) {
        qInput.parentElement.style.position = "relative";
        qInput.after(box);

        box.querySelectorAll("button.addr-item").forEach(b => {
          b.onmouseenter = () => {
            box.querySelectorAll("button.addr-item").forEach(other => other.style.background = "#fff");
            b.style.background = "#e0f2fe";
          };
          b.onmouseleave = () => { b.style.background = "#fff"; };
          b.onclick = (e) => {
            e.stopPropagation();
            const type = b.dataset.type;
            if (type === "local") {
              const bgId = b.dataset.bg;
              qInput.value = b.dataset.label;
              hideAddr();
              if (bgId && typeof select === "function") select(bgId, true);
            } else if (type === "station") {
              const s = stationMatches[+b.dataset.idx];
              if (s) {
                qInput.value = s.name;
                hideAddr();
                if (s.fips && s.fips !== (typeof activeFips === "function" ? activeFips() : "06037") && typeof openCounty === "function") {
                  openCounty(s.fips).then(() => {
                    setTimeout(() => {
                      if (typeof focusP3Walkshed === "function") focusP3Walkshed(s.lat, s.lng, s.name);
                    }, 800);
                  });
                } else {
                  if (typeof focusP3Walkshed === "function") focusP3Walkshed(s.lat, s.lng, s.name);
                }
              }
            } else if (type === "county") {
              const fips = b.dataset.fips;
              qInput.value = b.dataset.label;
              hideAddr();
              if (fips && typeof openCounty === "function") openCounty(fips);
            } else if (type === "cand") {
              const cand = cands[+b.dataset.i];
              if (cand) {
                qInput.value = cand.address;
                hideAddr();
                addressSearchUS(cand.address);
              }
            }
          };
        });
      }
    } catch(e) {}
  }, 220);
}'''

# Replace old addressSearch
patt = r"function addressSearch\(q, isFinal = false\) \{.*?^}"
match = re.search(patt, content, re.MULTILINE | re.DOTALL)
if match:
    content = content[:match.start()] + NEW_ADDR_SEARCH + content[match.end():]
    print("Successfully replaced addressSearch with enhanced station, highlight, and station-aware implementation")
else:
    print("ERROR: could not regex match addressSearch")

# 3. Enhance keydown listener on #q for ArrowDown, ArrowUp, Enter
KEYBOARD_LISTENER = '''  let activeSearchIndex = -1;
  function updateActiveSearchItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeSearchIndex) {
        item.classList.add("active-search-item");
        item.style.background = "#e0f2fe";
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active-search-item");
        item.style.background = "#fff";
      }
    });
  }
  $("#q").addEventListener("keydown", e => {
    const box = $("#addr-results");
    const items = box ? box.querySelectorAll("button.addr-item") : [];
    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      activeSearchIndex = (activeSearchIndex + 1) % items.length;
      updateActiveSearchItem(items);
      return;
    }
    if (e.key === "ArrowUp" && items.length > 0) {
      e.preventDefault();
      activeSearchIndex = (activeSearchIndex - 1 + items.length) % items.length;
      updateActiveSearchItem(items);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (box && activeSearchIndex >= 0 && items[activeSearchIndex]) {
        items[activeSearchIndex].click();
        return;
      }
      handleSearchSubmit(e.target.value);
      return;
    }
    if (e.key === "Escape") {
      hideAddr();
      return;
    }
  });'''

old_keydown = '''  $("#q").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(e.target.value); }
    if (e.key === "Escape") { hideAddr(); }
  });'''

if old_keydown in content:
    content = content.replace(old_keydown, KEYBOARD_LISTENER, 1)
    print("Successfully upgraded #q keydown listener with Arrow navigation")
else:
    print("WARNING: old_keydown not found exactly")

# 4. Enhance street click roadway message in houseAt
old_street_err = 'box.innerHTML = `<h3>This home</h3><p class="small muted" style="padding:16px 0;line-height:1.5">No parcel at that spot (street or public land). Click on a lot.</p>`;'
new_street_err = '''box.innerHTML = `<h3>This home</h3>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin:8px 0;line-height:1.5;">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px;">
          <span>🛣️</span> <span>Public Right-of-Way / Roadway</span>
        </div>
        <div style="font-size:12px;color:#64748b;">
          This point is located within the public street or transportation right-of-way (${ll.lat.toFixed(5)}°, ${ll.lng.toFixed(5)}°). Private zoning and single-family lot improvements only apply to deeded tax parcels. Click directly inside any lot boundary line to view property details.
        </div>
      </div>`;'''

if old_street_err in content:
    content = content.replace(old_street_err, new_street_err, 1)
    print("Successfully upgraded roadway notice in houseAt")
else:
    print("WARNING: old_street_err not found")

# 5. Add inline Street View Elevation Drawer into renderHouse
STREET_VIEW_INSPECT_DRAWER = '''
        <details class="streetview-inspect-drawer" style="margin:10px 0;border:1px solid #bae6fd;border-radius:8px;background:#f0f9ff;overflow:hidden;">
          <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#0284c7;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
            <span>📷 Inspect Street View &amp; Elevation (Verify Stories)</span>
            <span style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:4px;font-weight:600">360° Facade Camera</span>
          </summary>
          <div style="padding:10px 12px;background:#fff;border-top:1px solid #bae6fd;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
              <div style="font-size:11px;font-weight:700;color:#0f172a;">Perspective Angles:</div>
              <div style="display:inline-flex;gap:4px;">
                <button type="button" class="sv-angle-btn active" data-heading="0" onclick="setStreetViewAngle(0)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Front Facade</button>
                <button type="button" class="sv-angle-btn" data-heading="315" onclick="setStreetViewAngle(315)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Angle Left (-45°)</button>
                <button type="button" class="sv-angle-btn" data-heading="45" onclick="setStreetViewAngle(45)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Angle Right (+45°)</button>
                <button type="button" class="sv-angle-btn" data-heading="180" onclick="setStreetViewAngle(180)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Opposite (180°)</button>
              </div>
            </div>
            <div style="position:relative;width:100%;height:220px;border-radius:6px;overflow:hidden;border:1px solid #cbd5e1;background:#0f172a;">
              <iframe id="sv-iframe" data-base-lat="${ll.lat.toFixed(6)}" data-base-lng="${ll.lng.toFixed(6)}" src="https://www.google.com/maps?layer=c&cbll=${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}&cbp=11,0,0,0,0&output=svembed" width="100%" height="100%" style="border:0;" loading="lazy"></iframe>
            </div>
            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <div style="font-size:11.5px;color:#475569;">
                Verify stories with Street View:
                <span style="display:inline-flex;gap:3px;margin-left:4px;">
                  <button type="button" class="story-btn${F.stories === 1 ? ' active' : ''}" onclick="setHouseStories(1)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">1 Story</button>
                  <button type="button" class="story-btn${F.stories === 2 ? ' active' : ''}" onclick="setHouseStories(2)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">2 Stories</button>
                  <button type="button" class="story-btn${F.stories >= 3 ? ' active' : ''}" onclick="setHouseStories(3)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">3+ Stories</button>
                </span>
              </div>
              <a href="${svUrl}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:700;color:#0284c7;text-decoration:none;">Open Full Window ↗</a>
            </div>
          </div>
        </details>
'''

target_table_end = '    </tbody></table>'
if target_table_end in content:
    content = content.replace(target_table_end, target_table_end + "\n" + STREET_VIEW_INSPECT_DRAWER, 1)
    print("Successfully added inline Street View inspection drawer to renderHouse")
else:
    print("WARNING: target_table_end not found")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated file successfully, new size:", len(content))
