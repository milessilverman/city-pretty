import re
import sys

INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update addressSearch
old_addr_search = """async function addressSearch(text, go) {
  const q = String(text || "").trim();
  if (!q) { hideAddr(); return; }
  if (go) return addressSearchUS(q);

  if (q.length < 3) { hideAddr(); return; }
  clearTimeout(addrTimer);
  addrTimer = setTimeout(async () => {
    try {
      const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&f=json&maxLocations=5&countryCode=USA`;
      const r = await fetch(arcUrl);
      if (!r.ok) return;
      const data = await r.json();
      const cands = (data.candidates || []).filter(c => c.address && c.location);
      hideAddr();
      if (!cands.length) return;
      const box = document.createElement("div");
      box.id = "addr-results";
      box.innerHTML = cands.map((c, i) => `<button type="button" data-i="${i}" style="text-align:left;display:block;width:100%;padding:8px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:12px;color:#0f172a">📍 ${esc(c.address)}</button>`).join("");
      const qInput = $("#q");
      if (qInput && qInput.parentElement) {
        qInput.parentElement.style.position = "relative";
        qInput.after(box);
        box.querySelectorAll("button").forEach(b => {
          b.onclick = () => {
            const cand = cands[+b.dataset.i];
            if (qInput) qInput.value = cand.address;
            hideAddr();
            addressSearchUS(cand.address);
          };
        });
      }
    } catch(e) {}
  }, 220);
}"""

new_addr_search = """async function addressSearch(text, go) {
  const q = String(text || "").trim();
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

      // 2. Match US Counties from county-bundle elements
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

      // 3. ArcGIS World Geocoder candidates for street addresses & specific houses
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
      if (!localMatches.length && !countyMatches.length && !cands.length) return;

      const box = document.createElement("div");
      box.id = "addr-results";

      let html = "";
      if (localMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">🏙️ Local Neighborhoods & Communities</div>`;
        localMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="local" data-bg="${esc(m.bgId)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#0284c7;font-size:14px">🏙️</span> <span>${esc(m.name)}</span></button>`;
        });
      }

      if (countyMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">🏛️ US Counties</div>`;
        countyMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="county" data-fips="${esc(m.fips)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#8b5cf6;font-size:14px">🏛️</span> <span>${esc(m.name)}</span></button>`;
        });
      }

      if (cands.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">📍 Specific Addresses & Houses (USA)</div>`;
        cands.forEach((c, idx) => {
          html += `<button type="button" class="addr-item" data-type="cand" data-i="${idx}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#e11d48;font-size:14px">📍</span> <span>${esc(c.address)}</span></button>`;
        });
      }

      box.innerHTML = html;
      const qInput = $("#q");
      if (qInput && qInput.parentElement) {
        qInput.parentElement.style.position = "relative";
        qInput.after(box);

        box.querySelectorAll("button.addr-item").forEach(b => {
          b.onmouseenter = () => { b.style.background = "#f1f5f9"; };
          b.onmouseleave = () => { b.style.background = "#fff"; };
          b.onclick = (e) => {
            e.stopPropagation();
            const type = b.dataset.type;
            if (type === "local") {
              const bgId = b.dataset.bg;
              qInput.value = b.dataset.label;
              hideAddr();
              if (bgId && typeof select === "function") select(bgId, true);
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
}"""

if old_addr_search not in content:
    print("ERROR: old_addr_search not found")
    sys.exit(1)

content = content.replace(old_addr_search, new_addr_search, 1)
print("SUCCESS: Patched addressSearch")

# 2. Update houseFacts for Assessor stories attributes
old_house_facts = """  // Stories determination (Never 'unknown' - uses Street View toggle, LiDAR, or physical living area ratio)
  if (st && st.manualStories != null) {
    F.stories = st.manualStories;
    F.conf = "manual";
    F.src.stories = `User confirmed via Street View (${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"})`;
  } else if (big && big.levels) {
    F.stories = big.levels; F.src.stories = `OpenStreetMap levels tag (${big.levels})`; F.conf = "recorded";
  } else if (big && big.height) {
    F.stories = Math.max(1, Math.round((big.height - 1) / 3.2));
    F.src.stories = `building height ${big.height.toFixed(1)} m (County LiDAR via OpenStreetMap)`; F.conf = "measured";
  } else if (big && F.bldg && big.sqft > 0) {
    const r = F.bldg / big.sqft;
    F.stories = r >= 1.38 ? 2 : 1;
    F.src.stories = r >= 1.38 ? `2 stories (living area ÷ footprint = ${r.toFixed(2)})` : `1 story (living area ÷ footprint = ${r.toFixed(2)})`;
    F.conf = "estimated";
  } else if (PF && PF.stories) {
    F.stories = PF.stories; F.src.stories = PF.storiesSrc; F.conf = "permit";
  } else {
    // Intelligent physical inference from Assessor living area and lot coverage
    if (F.bldg >= 2600 || (lot > 0 && F.bldg / lot > 0.42)) {
      F.stories = 2;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 2-story layout`;
      F.conf = "estimated";
    } else {
      F.stories = 1;
      F.src.stories = F.bldg ? `inferred: single-story profile (${fmtN(F.bldg)} sq ft living area)` : "assumed 1 story (no living-area record for this parcel)";
      F.conf = "estimated";
    }
  }"""

new_house_facts = """  // Assessor story attributes from across US county tax assessment records
  const assessorStories = [
    a.STORIES, a.Stories, a.stories, a.NO_OF_STORIES, a.NUM_STORIES,
    a.BLD_STORIES, a.Story, a.story, a.NSTORIES, a.TOT_STORIES,
    a.NO_STORIES, a.NUM_FLOORS, a.FLOORS
  ].map(v => (v !== undefined && v !== null && v !== "") ? parseFloat(v) : null).find(v => v && !isNaN(v) && v > 0);

  // Stories determination (Never 'unknown' - uses Street View toggle, Assessor records, LiDAR, or physical living area ratio)
  if (st && st.manualStories != null) {
    F.stories = st.manualStories;
    F.conf = "manual";
    F.src.stories = `User confirmed via Street View (${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"})`;
  } else if (assessorStories) {
    F.stories = Math.round(assessorStories);
    F.conf = "assessor";
    F.src.stories = `County Assessor tax assessment record (${assessorStories} stor${assessorStories === 1 ? "y" : "ies"})`;
  } else if (big && big.levels) {
    F.stories = big.levels; F.src.stories = `OpenStreetMap levels tag (${big.levels})`; F.conf = "recorded";
  } else if (big && big.height) {
    F.stories = Math.max(1, Math.round((big.height - 1) / 3.2));
    F.src.stories = `building height ${big.height.toFixed(1)} m (County LiDAR via OpenStreetMap)`; F.conf = "measured";
  } else if (big && F.bldg && big.sqft > 0) {
    const r = F.bldg / big.sqft;
    const estStories = r >= 2.35 ? 3 : (r >= 1.35 ? 2 : 1);
    F.stories = estStories;
    F.src.stories = `${estStories} stor${estStories > 1 ? "ies" : "y"} (living area ${fmtN(F.bldg)} sq ft ÷ footprint ${fmtN(big.sqft)} sq ft = ${r.toFixed(2)})`;
    F.conf = "estimated";
  } else if (PF && PF.stories) {
    F.stories = PF.stories; F.src.stories = PF.storiesSrc; F.conf = "permit";
  } else {
    // Intelligent physical inference from Assessor living area and lot coverage
    if (F.bldg >= 3800) {
      F.stories = 3;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 3-story layout`;
      F.conf = "estimated";
    } else if (F.bldg >= 2400 || (lot > 0 && F.bldg / lot > 0.40)) {
      F.stories = 2;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 2-story layout`;
      F.conf = "estimated";
    } else {
      F.stories = 1;
      F.src.stories = F.bldg ? `inferred: single-story profile (${fmtN(F.bldg)} sq ft living area)` : "assumed 1 story (no living-area record for this parcel)";
      F.conf = "estimated";
    }
  }"""

if old_house_facts not in content:
    print("ERROR: old_house_facts not found")
    sys.exit(1)

content = content.replace(old_house_facts, new_house_facts, 1)
print("SUCCESS: Patched houseFacts")

# 3. Update toggleHouseStories and add setHouseStories
old_toggle_stories = """function toggleHouseStories() {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  const current = st.manualStories != null ? st.manualStories : (activeHouse.lastStories || 1);
  st.manualStories = current === 1 ? 2 : 1;
  renderHouse(box, a, lot, ll, st);
  showToast(`Updated to ${st.manualStories}-story house model`);
}"""

new_toggle_stories = """function toggleHouseStories() {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  const current = st.manualStories != null ? st.manualStories : (activeHouse.lastStories || 1);
  const next = current === 1 ? 2 : (current === 2 ? 3 : 1);
  setHouseStories(next);
}

function setHouseStories(n) {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  st.manualStories = Math.max(1, Math.min(4, +n || 1));
  renderHouse(box, a, lot, ll, st);
  showToast(`House model set to ${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"}`);
}"""

if old_toggle_stories not in content:
    print("ERROR: old_toggle_stories not found")
    sys.exit(1)

content = content.replace(old_toggle_stories, new_toggle_stories, 1)
print("SUCCESS: Patched toggleHouseStories and added setHouseStories")

# 4. Update renderHouse for Zillow & Redfin cross checks and story pills
old_render_facts = """    <table class="small facts"><tbody>
      ${fact("Estimated market value", `<span><b>${fmt$(houseHv)}</b> <span class="vpd-range" style="font-size:12px;margin-left:6px;font-weight:normal;color:var(--ink-2)">(${fmt$(valLow)} – ${fmt$(valHigh)} · screening range ±6.5%)</span></span>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; not an appraisal`)}
      ${totalRoll > 0 ? fact("Assessor Roll Value", `<span>${fmt$(totalRoll)} <span class="muted">(Land ${fmt$(rollLand)} + Imp ${fmt$(rollImp)}${rollBaseYear ? `, base year ${rollBaseYear}` : ""})</span></span>`, "County Assessor Assessment Roll") : ""}
      ${sale ? fact("Last recorded sale", `<span>${fmt$(sale.price)} <span class="muted">(${sale.date.length === 8 ? sale.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "date not recorded"})</span></span>`, "County PAIS recorded deed transfer") : ""}
      ${fact("Stories", `<span><b>${F.stories} stor${F.stories > 1 ? "ies" : "y"}</b>${F.conf === "estimated" ? " (estimate)" : ""} <button type="button" class="story-toggle-btn" onclick="toggleHouseStories()" title="Click to switch story count and recalculate upgrades">Switch to ${F.stories === 1 ? "2-story" : "1-story"}</button> <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-link" title="Open Google Street View in a new tab">📷 Street View ↗</a></span>`, esc(F.src.stories))}"""

new_render_facts = """    ${(() => {
        const fullAddr = String(a.SitusFullAddress || "").trim();
        const rawCity = String(a.county || p.c || (m && m.c) || "").trim();
        const rawState = (typeof activeState === "function" ? activeState() : null) || "CA";
        const searchAddress = fullAddr ? `${fullAddr}, ${rawCity}, ${rawState}` : `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
        const cleanAddrForUrl = encodeURIComponent(searchAddress.replace(/\\s+/g, " "));
        const zillowUrl = `https://www.zillow.com/homes/${cleanAddrForUrl}_rb/`;
        const redfinUrl = `https://www.redfin.com/stingray/do/query-location?location=${cleanAddrForUrl}`;
        return `
    <table class="small facts"><tbody>
      ${fact("Estimated market value", `<div>
        <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
          <b>${fmt$(houseHv)}</b> <span class="vpd-range" style="font-size:12px;color:var(--ink-2)">(${fmt$(valLow)} – ${fmt$(valHigh)} · screening range ±6.5%)</span>
        </div>
        <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <a href="${zillowUrl}" target="_blank" rel="noopener" class="zillow-pill" title="Cross-check this screening estimate against live Zillow Zestimate for ${esc(searchAddress)}">
            🏠 Zillow Zestimate ↗
          </a>
          <a href="${redfinUrl}" target="_blank" rel="noopener" class="redfin-pill" title="Cross-check against live Redfin Estimate for ${esc(searchAddress)}">
            🏠 Redfin ↗
          </a>
        </div>
      </div>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; cross-check with live Zillow/Redfin valuation comps`)}
      ${totalRoll > 0 ? fact("Assessor Roll Value", `<span>${fmt$(totalRoll)} <span class="muted">(Land ${fmt$(rollLand)} + Imp ${fmt$(rollImp)}${rollBaseYear ? `, base year ${rollBaseYear}` : ""})</span></span>`, "County Assessor Assessment Roll") : ""}
      ${sale ? fact("Last recorded sale", `<span>${fmt$(sale.price)} <span class="muted">(${sale.date.length === 8 ? sale.date.replace(/(\\d{4})(\\d{2})(\\d{2})/, "$1-$2-$3") : "date not recorded"})</span></span>`, "County PAIS recorded deed transfer") : ""}
      ${fact("Stories", `<div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <b>${F.stories} stor${F.stories > 1 ? "ies" : "y"}</b>${F.conf === "estimated" ? " (estimate)" : ""}
          <div class="story-pill-group" role="group" aria-label="Verify story count" style="display:inline-flex;gap:3px;">
            <button type="button" class="story-btn${F.stories === 1 ? " active" : ""}" onclick="setHouseStories(1)" title="Set to 1 story">1 Story</button>
            <button type="button" class="story-btn${F.stories === 2 ? " active" : ""}" onclick="setHouseStories(2)" title="Set to 2 stories">2 Stories</button>
            <button type="button" class="story-btn${F.stories >= 3 ? " active" : ""}" onclick="setHouseStories(3)" title="Set to 3+ stories">3+ Stories</button>
          </div>
          <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-link" title="Open Google Street View in a new tab to inspect facade and roofline">📷 Street View ↗</a>
        </div>
      </div>`, esc(F.src.stories))}`;
      })()}"""

if old_render_facts not in content:
    print("ERROR: old_render_facts not found")
    sys.exit(1)

content = content.replace(old_render_facts, new_render_facts, 1)
print("SUCCESS: Patched renderHouse facts")

# 5. Update updateHouseMapPopup for Zillow & Redfin cross-check buttons
old_popup_val = """        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span><b>Estimated Market Value:</b></span>
          <span style="color:#087b78;font-weight:700">${fmt$(houseHv)} <span style="font-size:10.5px;color:#64748b;font-weight:normal">(±6.5%)</span></span>
        </div>
        ${rollVal > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span><b>Assessor Roll Value:</b></span><span>${fmt$(rollVal)}</span></div>` : ""}"""

new_popup_val = """        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span><b>Estimated Market Value:</b></span>
          <span style="color:#087b78;font-weight:700">${fmt$(houseHv)} <span style="font-size:10.5px;color:#64748b;font-weight:normal">(±6.5%)</span></span>
        </div>
        <div style="display:flex;gap:5px;margin-top:4px;margin-bottom:4px;">
          <a href="https://www.zillow.com/homes/${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim())}_rb/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#006aff;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Cross-check with live Zillow Zestimate">
            🏠 Zillow Zestimate ↗
          </a>
          <a href="https://www.redfin.com/stingray/do/query-location?location=${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim())}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#a02021;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Cross-check with Redfin Estimate">
            🏠 Redfin ↗
          </a>
        </div>
        ${rollVal > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span><b>Assessor Roll Value:</b></span><span>${fmt$(rollVal)}</span></div>` : ""}"""

if old_popup_val not in content:
    print("ERROR: old_popup_val not found")
    sys.exit(1)

content = content.replace(old_popup_val, new_popup_val, 1)
print("SUCCESS: Patched updateHouseMapPopup")

# 6. Add getMetroPipeline, p3Section, runP3Sim functions right before function select(id, fly)
old_select_anchor = """function select(id, fly) {"""

p3_functions_code = """// ---------------- Public-Private Partnerships (P3) & Transit Joint Development Pipeline
function getMetroPipeline(fips, city) {
  fips = String(fips || activeFips() || "06037");
  city = String(city || "").toLowerCase();

  // Austin / Travis County, TX
  if (fips === "48453" || city.includes("austin")) {
    return {
      fips: "48453",
      metroName: "Austin Metro · Project Connect",
      title: "Project Connect Light Rail & Riverside/South Congress TOD Corridor",
      agency: "Austin Transit Partnership (ATP) & City of Austin",
      status: "Engineering & NEPA Approved · FTA Capital Investment Grant (CIG) Pipeline",
      hubName: "Riverside & Pleasant Valley / South Congress Transit Hub",
      corridorDesc: "9.8-mile phase 1 light rail connecting Downtown Austin to East Riverside and South Congress, transitioning CapMetro to high-capacity grade-separated rail transit.",
      p3Type: "Station-Area Ground Lease & Master Joint Development (99-Year Concession)",
      units: 460,
      affordPct: 35,
      retailSqft: 28000,
      baseIRR: 15.6,
      baseGroundLease: 1150000,
      baseHomeLiftPct: 6.8,
      baseBoardingBoostPct: 40,
      bikewayName: "Pleasant Valley & Riverside Rail-with-Trail Protected Cycleway",
      bikewayDesc: "3.4-mile 12-ft paved dual-direction bike highway along light rail ROW connecting to the Ann and Roy Butler Hike-and-Bike Trail.",
      bikewayCost: 3200000,
      bikewayHomeLift: 3.2,
      bikewayRidership: 14,
      treeSpecies: "Native Texas Live Oak, Cedar Elm & Mexican White Oak",
      treeCount: 1100,
      treeCost: 950000,
      treeTempDrop: 5.2,
      treeHomeLift: 2.5,
      evStalls: 16,
      evKw: 150,
      evCost: 680000,
      evAnnualMargin: 52000,
      evCo2Tons: 220,
      plazaRetailSqft: 14000,
      plazaRetailCost: 1900000,
      plazaAnnualRent: 420000,
      localSalesTax: 340000
    };
  }

  // Los Angeles County, CA
  if (fips === "06037" || city.includes("los angeles")) {
    return {
      fips: "06037",
      metroName: "Los Angeles County · Metro Measure M/R",
      title: "Metro Measure M/R Rail Expansion & Station Joint Development Pipeline",
      agency: "Los Angeles County Metropolitan Transportation Authority (Metro)",
      status: "Multiple Extensions Active & Under Construction · Metro 10,000-Home TOD Goal",
      hubName: "Wilshire/La Brea, Southeast Gateway Line & Crenshaw/Slauson Hubs",
      corridorDesc: "Transformative 28-by-'28 rail expansion (D Line Subway, Southeast Gateway, Sepulveda Pass, K Line) with Metro-owned parcel air rights.",
      p3Type: "Metro Joint Development Ground Lease (Prevailing Wage + 35% Affordable)",
      units: 520,
      affordPct: 35,
      retailSqft: 32000,
      baseIRR: 14.8,
      baseGroundLease: 1850000,
      baseHomeLiftPct: 7.2,
      baseBoardingBoostPct: 45,
      bikewayName: "Rail-to-Rail Active Transportation Corridor & Slauson Greenway",
      bikewayDesc: "5.5-mile multi-use walking/biking corridor built on former freight rail right-of-way connecting Fairview Heights station to the A Line.",
      bikewayCost: 4800000,
      bikewayHomeLift: 3.4,
      bikewayRidership: 16,
      treeSpecies: "Coast Live Oak, Western Sycamore & Desert Willow",
      treeCount: 2200,
      treeCost: 1750000,
      treeTempDrop: 6.4,
      treeHomeLift: 2.8,
      evStalls: 24,
      evKw: 250,
      evCost: 1100000,
      evAnnualMargin: 84000,
      evCo2Tons: 380,
      plazaRetailSqft: 20000,
      plazaRetailCost: 2800000,
      plazaAnnualRent: 680000,
      localSalesTax: 510000
    };
  }

  // Orange County, CA
  if (fips === "06059" || city.includes("santa ana") || city.includes("anaheim")) {
    return {
      fips: "06059",
      metroName: "Orange County · OC Streetcar & Regional Transit",
      title: "OC Streetcar Santa Ana–Garden Grove TOD Corridor & SARTC Expansion",
      agency: "Orange County Transportation Authority (OCTA) & City of Santa Ana",
      status: "Revenue Service Launch · Transit-Oriented Development Overlay District",
      hubName: "Santa Ana Regional Transportation Center (SARTC) & 4th Street Hub",
      corridorDesc: "4.15-mile streetcar linking Amtrak/Metrolink regional rail to Historic Downtown Santa Ana arts district and Garden Grove civic center.",
      p3Type: "Municipal Surface Parking Lot Redevelopment P3 Concession",
      units: 340,
      affordPct: 30,
      retailSqft: 22000,
      baseIRR: 15.2,
      baseGroundLease: 920000,
      baseHomeLiftPct: 6.0,
      baseBoardingBoostPct: 35,
      bikewayName: "Pacific Electric Right-of-Way Trail Connection",
      bikewayDesc: "Class I off-street bikeway leveraging historic Pacific Electric interurban railway right-of-way through Santa Ana.",
      bikewayCost: 2600000,
      bikewayHomeLift: 2.9,
      bikewayRidership: 12,
      treeSpecies: "California Sycamore, Engelmann Oak & Jacaranda",
      treeCount: 950,
      treeCost: 820000,
      treeTempDrop: 4.8,
      treeHomeLift: 2.2,
      evStalls: 14,
      evKw: 150,
      evCost: 590000,
      evAnnualMargin: 46000,
      evCo2Tons: 190,
      plazaRetailSqft: 12000,
      plazaRetailCost: 1600000,
      plazaAnnualRent: 360000,
      localSalesTax: 280000
    };
  }

  // Denver / Denver County, CO
  if (fips === "08031" || city.includes("denver")) {
    return {
      fips: "08031",
      metroName: "Denver Metro · FasTracks & East Colfax BRT",
      title: "East Colfax Center-Running Bus Rapid Transit & DURA Station Infill",
      agency: "City and County of Denver (DOTI), RTD Denver & DURA",
      status: "Active Construction (Opening 2026-2027) · Dedicated Center Lanes & Signal Priority",
      hubName: "East Colfax & Broadway / Colorado Blvd Multi-Modal Station",
      corridorDesc: "10-mile high-frequency rapid transit replacing Denver's highest-ridership bus line with protected median platforms and off-board fare collection.",
      p3Type: "Denver Urban Renewal Authority Tax-Increment Financing & P3 Housing Ground Lease",
      units: 320,
      affordPct: 40,
      retailSqft: 18000,
      baseIRR: 14.5,
      baseGroundLease: 780000,
      baseHomeLiftPct: 5.8,
      baseBoardingBoostPct: 38,
      bikewayName: "Colfax Parallel Greenway & High Line Canal Cycle Link",
      bikewayDesc: "Protected two-way cycle tracks on 13th and 14th Avenues offering continuous low-stress bike routing parallel to the BRT line.",
      bikewayCost: 2400000,
      bikewayHomeLift: 2.8,
      bikewayRidership: 11,
      treeSpecies: "Bur Oak, Hackberry, Kentucky Coffeetree & Ponderosa Pine",
      treeCount: 1250,
      treeCost: 1050000,
      treeTempDrop: 5.6,
      treeHomeLift: 2.4,
      evStalls: 12,
      evKw: 150,
      evCost: 520000,
      evAnnualMargin: 41000,
      evCo2Tons: 170,
      plazaRetailSqft: 11000,
      plazaRetailCost: 1450000,
      plazaAnnualRent: 320000,
      localSalesTax: 260000
    };
  }

  // Seattle / King County, WA
  if (fips === "53033" || city.includes("seattle")) {
    return {
      fips: "53033",
      metroName: "Puget Sound · Sound Transit 3 (ST3)",
      title: "ST3 Ballard & West Seattle Link Extensions Equitable TOD Pipeline",
      agency: "Sound Transit & Seattle Office of Housing",
      status: "Final Engineering & NEPA Review · 80-80-80 Equitable Housing Accord",
      hubName: "Ballard Multi-Modal Hub & Chinatown-International District Hub",
      corridorDesc: "62-mile light rail system expansion connecting Seattle urban centers with high-capacity grade-separated rail transit.",
      p3Type: "Surplus ROW Property 99-Year Ground Lease with Mass Timber Density Bonus",
      units: 380,
      affordPct: 40,
      retailSqft: 24000,
      baseIRR: 15.0,
      baseGroundLease: 1350000,
      baseHomeLiftPct: 7.0,
      baseBoardingBoostPct: 42,
      bikewayName: "Burke-Gilman Ballard Missing Link & Station Connector Trail",
      bikewayDesc: "Protected grade-separated cycle track completing the iconic regional trail directly into Ballard transit terminal.",
      bikewayCost: 3600000,
      bikewayHomeLift: 3.5,
      bikewayRidership: 15,
      treeSpecies: "Douglas Fir, Bigleaf Maple, Western Redcedar & Oregon White Oak",
      treeCount: 1300,
      treeCost: 1100000,
      treeTempDrop: 4.2,
      treeHomeLift: 2.6,
      evStalls: 16,
      evKw: 200,
      evCost: 720000,
      evAnnualMargin: 56000,
      evCo2Tons: 240,
      plazaRetailSqft: 15000,
      plazaRetailCost: 2100000,
      plazaAnnualRent: 480000,
      localSalesTax: 390000
    };
  }

  // Phoenix / Maricopa County, AZ
  if (fips === "04013" || city.includes("phoenix")) {
    return {
      fips: "04013",
      metroName: "Valley Metro · Phoenix Transit 2050",
      title: "South Central Extension / Downtown Hub Light Rail & Central Station P3",
      agency: "Valley Metro & City of Phoenix Public Transit",
      status: "Active Construction & Testing · $300M+ Central Station P3 High-Rise Rising",
      hubName: "Central Station Transit Hub & South Central/Southern Ave Hub",
      corridorDesc: "5.5-mile extension linking Downtown Phoenix to Baseline Road, anchoring major P3 mixed-use residential towers.",
      p3Type: "Private Consortium Joint Development with City Air Rights and Long-Term Ground Lease",
      units: 420,
      affordPct: 30,
      retailSqft: 26000,
      baseIRR: 15.8,
      baseGroundLease: 1100000,
      baseHomeLiftPct: 6.4,
      baseBoardingBoostPct: 36,
      bikewayName: "Grand Canalscape & South Central Protected Bikeway",
      bikewayDesc: "Continuous paved multi-use corridor with grade separations along canal banks and transit avenue.",
      bikewayCost: 2800000,
      bikewayHomeLift: 3.0,
      bikewayRidership: 12,
      treeSpecies: "Desert Ironwood, Velvet Mesquite, Thornless Palo Verde & Live Oak",
      treeCount: 1600,
      treeCost: 1200000,
      treeTempDrop: 8.5,
      treeHomeLift: 2.7,
      evStalls: 20,
      evKw: 200,
      evCost: 880000,
      evAnnualMargin: 68000,
      evCo2Tons: 290,
      plazaRetailSqft: 16000,
      plazaRetailCost: 2200000,
      plazaAnnualRent: 450000,
      localSalesTax: 370000
    };
  }

  // New Orleans / Orleans Parish, LA
  if (fips === "22071" || city.includes("new orleans")) {
    return {
      fips: "22071",
      metroName: "New Orleans RTA · Climate Resilience Transit",
      title: "New Orleans Union Passenger Terminal (UPT) Multimodal Hub & High-Capacity Transit",
      agency: "New Orleans Regional Transit Authority (RTA) & City of New Orleans",
      status: "FTA Planning Grant Awarded · Climate Resilience Infrastructure Accord",
      hubName: "Union Passenger Terminal (UPT) & Downtown Transit Center",
      corridorDesc: "Regional rail, streetcar, and high-frequency bus multimodal connection linking Downtown NOLA, BioDistrict, and East NOLA.",
      p3Type: "Resilient Joint Development P3 with Ground-Floor Micro-Market & Stormwater Detention",
      units: 280,
      affordPct: 40,
      retailSqft: 20000,
      baseIRR: 14.6,
      baseGroundLease: 650000,
      baseHomeLiftPct: 5.5,
      baseBoardingBoostPct: 32,
      bikewayName: "Lafitte Greenway to UPT Multi-Modal Trail Extension",
      bikewayDesc: "Off-street paved greenway extension connecting Mid-City cultural corridor directly to the regional transit terminal.",
      bikewayCost: 2100000,
      bikewayHomeLift: 3.3,
      bikewayRidership: 13,
      treeSpecies: "Southern Live Oak, Bald Cypress & Sweetbay Magnolia",
      treeCount: 850,
      treeCost: 720000,
      treeTempDrop: 4.6,
      treeHomeLift: 2.3,
      evStalls: 10,
      evKw: 150,
      evCost: 440000,
      evAnnualMargin: 35000,
      evCo2Tons: 150,
      plazaRetailSqft: 10000,
      plazaRetailCost: 1350000,
      plazaAnnualRent: 290000,
      localSalesTax: 240000
    };
  }

  // Nationwide Default for any US County
  const cName = countyOf();
  return {
    fips: fips,
    metroName: `${cName} · Regional Transit & Infrastructure`,
    title: `${cName} High-Capacity Transit Corridor & TOD Joint Development`,
    agency: "Regional Transportation Commission & County Transit Authority",
    status: "FTA Capital Investment Grants (CIG) & RAISE Pipeline · Federal P3 Guidelines",
    hubName: `${cName} Multi-Modal Transit Center & Central Station Hub`,
    corridorDesc: "High-frequency rapid transit corridor and active transportation revitalization connecting municipal activity centers.",
    p3Type: "Surplus Transit Agency ROW 99-Year Ground Lease with Infill Zoning Incentives",
    units: 350,
    affordPct: 30,
    retailSqft: 20000,
    baseIRR: 15.0,
    baseGroundLease: 850000,
    baseHomeLiftPct: 5.5,
    baseBoardingBoostPct: 35,
    bikewayName: "Corridor Rail-with-Trail Active Transportation Greenway",
    bikewayDesc: "Class I separated multi-use pedestrian and bicycle trail linking stations to residential neighborhoods and school districts.",
    bikewayCost: 2500000,
    bikewayHomeLift: 3.0,
    bikewayRidership: 12,
    treeSpecies: "Climate-Resilient Native Hardwood & Shade Canopy Trees",
    treeCount: 1000,
    treeCost: 850000,
    treeTempDrop: 4.5,
    treeHomeLift: 2.3,
    evStalls: 12,
    evKw: 150,
    evCost: 520000,
    evAnnualMargin: 42000,
    evCo2Tons: 180,
    plazaRetailSqft: 12000,
    plazaRetailCost: 1500000,
    plazaAnnualRent: 340000,
    localSalesTax: 270000
  };
}

function p3Section(p, m) {
  const pipe = getMetroPipeline(activeFips(), p.c || m.c);
  return `
    <div style="font-family:var(--body);line-height:1.45;color:var(--ink)">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.5px;">🚆 Active Major Infrastructure Pipeline</span>
          <span style="font-size:11px;font-weight:600;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;">${esc(pipe.status.split('·')[0])}</span>
        </div>
        <div style="font-size:15px;font-weight:800;color:#0c4a6e;margin-bottom:4px;">${esc(pipe.title)}</div>
        <div style="font-size:12px;color:#334155;margin-bottom:6px;"><b>Lead Sponsoring Agency:</b> ${esc(pipe.agency)}</div>
        <div style="font-size:12px;color:#475569;margin-bottom:6px;"><b>Station Focus Hub:</b> <span style="color:#0369a1;font-weight:600">${esc(pipe.hubName)}</span></div>
        <div style="font-size:12px;color:#475569;">${esc(pipe.corridorDesc)}</div>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px;">P3 Joint Development &amp; Corridor Bundle Simulator</div>
        <div style="font-size:12px;color:var(--ink-2);margin-bottom:10px;">Select complementary investments around the transit corridor to calculate combined private developer IRR, public agency ground lease revenue, and neighborhood property value lift:</div>

        <div style="display:flex;flex-direction:column;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;">
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-tod" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Transit-Oriented Housing &amp; Mixed-Use Joint Development</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.units} mixed-income homes (${pipe.affordPct}% affordable), ${fmtN(pipe.retailSqft)} sq ft ground-floor retail via 99-year public ground lease.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>${esc(pipe.bikewayName)}</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${esc(pipe.bikewayDesc)} (+${pipe.bikewayHomeLift}% home value lift; +${pipe.bikewayRidership}% station cycling boardings).</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trees" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Urban Forest Shade Tree Canopy Corridor</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${fmtN(pipe.treeCount)} native shade trees (${esc(pipe.treeSpecies)}) along station walkshed (cooling ambient heat by -${pipe.treeTempDrop}°F; +${pipe.treeHomeLift}% property value lift).</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-ev" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Fast EV Charging Hub (${pipe.evStalls} DC Fast Stalls, ${pipe.evKw} kW)</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.evStalls} ultra-fast charging bays with solar canopy; generates ~$${fmtN(pipe.evAnnualMargin)}/yr net charging margin and offsets ${pipe.evCo2Tons} tons CO2/yr.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-retail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Plaza Micro-Retail &amp; Local Bodega / Grocer Hub</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${fmtN(pipe.plazaRetailSqft)} sq ft active station storefronts; generates $${fmtN(pipe.plazaAnnualRent)}/yr concession revenue and $${fmtN(pipe.localSalesTax)}/yr municipal sales tax.</div>
            </div>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:12px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Private Dev IRR</div>
            <div id="p3-irr" style="font-size:20px;font-weight:800;color:#15803d;margin-top:2px;">15.6%</div>
            <div style="font-size:10px;color:#166534;margin-top:2px;">Hurdle: 14.0%–16.5%</div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;">Public Agency Rev</div>
            <div id="p3-rev" style="font-size:20px;font-weight:800;color:#1d4ed8;margin-top:2px;">$1.62M / yr</div>
            <div style="font-size:10px;color:#1e40af;margin-top:2px;">Ground Lease + Concessions</div>
          </div>

          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;">Property Value Lift</div>
            <div id="p3-lift" style="font-size:20px;font-weight:800;color:#7e22ce;margin-top:2px;">+12.5%</div>
            <div style="font-size:10px;color:#6b21a8;margin-top:2px;">Corridor Walkshed Homes</div>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;">Ridership Boost</div>
            <div id="p3-ridership" style="font-size:20px;font-weight:800;color:#b45309;margin-top:2px;">+54%</div>
            <div style="font-size:10px;color:#92400e;margin-top:2px;">Station Boardings</div>
          </div>
        </div>

        <div id="p3-notes" style="font-size:11.5px;color:var(--ink-2);background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;line-height:1.4;">
          <b>P3 Partnership Structure:</b> Public transit agency contributes land/concession rights via 99-year ground lease with zero taxpayer bond debt for vertical construction. Private capital consortium finances, builds, and manages residential towers & retail, providing guaranteed annual lease revenue back to public transit operations.
        </div>
      </div>
    </div>
  `;
}

function runP3Sim() {
  const pipe = getMetroPipeline(activeFips(), (selected && byId.get(selected)) ? byId.get(selected).properties.c : "");
  const tod = $("#p3-tod") ? $("#p3-tod").checked : true;
  const trail = $("#p3-trail") ? $("#p3-trail").checked : true;
  const trees = $("#p3-trees") ? $("#p3-trees").checked : true;
  const ev = $("#p3-ev") ? $("#p3-ev").checked : true;
  const retail = $("#p3-retail") ? $("#p3-retail").checked : true;

  let irr = tod ? pipe.baseIRR : 0;
  let groundLease = tod ? pipe.baseGroundLease : 0;
  let propLift = tod ? pipe.baseHomeLiftPct : 0;
  let ridership = tod ? pipe.baseBoardingBoostPct : 0;

  if (trail) {
    irr += tod ? 0.4 : 0; // Trail connectivity boosts residential leasing velocity
    propLift += pipe.bikewayHomeLift;
    ridership += pipe.bikewayRidership;
  }
  if (trees) {
    irr += tod ? 0.2 : 0; // Shaded streetscape premium
    propLift += pipe.treeHomeLift;
    ridership += 4;
  }
  if (ev) {
    groundLease += pipe.evAnnualMargin;
    irr += 0.3;
  }
  if (retail) {
    groundLease += pipe.plazaAnnualRent;
    ridership += 8;
    propLift += 1.2;
    irr += 0.5;
  }

  const irrEl = $("#p3-irr");
  if (irrEl) irrEl.textContent = irr > 0 ? `${irr.toFixed(1)}%` : "N/A";

  const revEl = $("#p3-rev");
  if (revEl) revEl.textContent = groundLease >= 1000000 ? `$${(groundLease / 1000000).toFixed(2)}M / yr` : `$${Math.round(groundLease / 1000)}k / yr`;

  const liftEl = $("#p3-lift");
  if (liftEl) liftEl.textContent = `+${propLift.toFixed(1)}%`;

  const riderEl = $("#p3-ridership");
  if (riderEl) riderEl.textContent = `+${ridership}%`;
}

"""

if old_select_anchor not in content:
    print("ERROR: old_select_anchor not found")
    sys.exit(1)

content = content.replace(old_select_anchor, p3_functions_code + old_select_anchor, 1)
print("SUCCESS: Added getMetroPipeline, p3Section, and runP3Sim")

# 7. Add P3 section to select(id, fly)
old_select_panels = """  // 3. Geography-Specific Improvements (Coastal vs Inland Trails)
  h += `<details class="panel-sec"><summary><b>📍 Geography-Specific Improvements (Coastal vs. Inland Trails)</b></summary><div class="sec-content">${geographicImprovementsSection(p, m)}</div></details>`;"""

new_select_panels = """  // 3. Geography-Specific Improvements (Coastal vs Inland Trails)
  h += `<details class="panel-sec"><summary><b>📍 Geography-Specific Improvements (Coastal vs. Inland Trails)</b></summary><div class="sec-content">${geographicImprovementsSection(p, m)}</div></details>`;

  // 4. Public-Private Partnerships (P3) & Transit Joint Development Pipeline
  h += `<details class="panel-sec" open><summary><b>🚆 Public-Private Partnerships (P3) &amp; Transit Corridor Pipeline</b></summary><div class="sec-content">${p3Section(p, m)}</div></details>`;"""

if old_select_panels not in content:
    print("ERROR: old_select_panels not found")
    sys.exit(1)

content = content.replace(old_select_panels, new_select_panels, 1)
print("SUCCESS: Added P3 section to select(id, fly)")

# 8. Add click-outside and escape listeners for #addr-results
old_q_listeners = """  $("#q").onchange = e => handleSearchSubmit(e.target.value);
  $("#q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(e.target.value); } });
  $("#q").addEventListener("input", e => { clearTimeout(addrTimer); const v = e.target.value.trim(); if (v.length >= 3) addrTimer = setTimeout(() => addressSearch(v, false), 220); else hideAddr(); });"""

new_q_listeners = """  $("#q").onchange = e => handleSearchSubmit(e.target.value);
  $("#q").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(e.target.value); }
    if (e.key === "Escape") { hideAddr(); }
  });
  $("#q").addEventListener("input", e => {
    clearTimeout(addrTimer);
    const v = e.target.value.trim();
    if (v.length >= 2) addrTimer = setTimeout(() => addressSearch(v, false), 220);
    else hideAddr();
  });
  document.addEventListener("click", e => {
    const ar = $("#addr-results");
    if (ar && !ar.contains(e.target) && e.target !== $("#q")) { hideAddr(); }
  });"""

if old_q_listeners not in content:
    print("ERROR: old_q_listeners not found")
    sys.exit(1)

content = content.replace(old_q_listeners, new_q_listeners, 1)
print("SUCCESS: Patched #q event listeners and added outside-click dismiss")

with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: All Part 2 patches successfully written to index.html!")
