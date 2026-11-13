import re

FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

HELPERS_AND_SEARCH = '''function highlightQuery(text, query) {
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

async function addressSearch(text, go) {
  const q = String(text || "").trim();
  activeSearchIndex = -1;
  if (!q) { hideAddr(); return; }
  if (go) return addressSearchUS(q);

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

target_start = "async function addressSearch(text, go) {"
target_end = "// ---------------- house numbers at zoom 18+ (County CAMS address points)"

start_idx = content.find(target_start)
end_idx = content.find(target_end, start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + HELPERS_AND_SEARCH + "\n\n" + content[end_idx:]
    print("Successfully replaced addressSearch with enhanced station, highlight, and helper suite")
else:
    print("ERROR: could not find boundaries for addressSearch", start_idx, end_idx)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated file size:", len(content))
