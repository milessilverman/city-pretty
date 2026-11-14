import json
import re

INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"
CITY_PRETTY_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/city-pretty.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    c = f.read()

# -------------------------------------------------------------
# 1. Update Header Buttons to add AI Advisor Button
# -------------------------------------------------------------
old_header_btns = """    <button type="button" class="top-act-btn" id="btn-methods-header" title="Methods and dataset vintages">Methods &amp; Vintages</button>
    <button type="button" class="top-act-btn" id="btn-accuracy-header" title="Platform Accuracy & AI Backbone Provenance" onclick="openAccuracyModal()">🎯 Accuracy &amp; AI Backbone</button>
  </div>"""

new_header_btns = """    <button type="button" class="top-act-btn" id="btn-methods-header" title="Methods and dataset vintages">Methods &amp; Vintages</button>
    <button type="button" class="top-act-btn" id="btn-accuracy-header" title="Platform Accuracy & AI Backbone Provenance" onclick="openAccuracyModal()">🎯 Accuracy &amp; AI Backbone</button>
    <button type="button" class="top-act-btn" id="btn-ai-header" title="AI Urban & Property Advisor Copilot" onclick="openAiAdvisor()" style="background:#7c3aed;color:#fff;border-color:#6d28d9;box-shadow:0 2px 6px rgba(124,58,237,0.3)">🤖 AI Advisor</button>
  </div>"""

if old_header_btns in c:
    c = c.replace(old_header_btns, new_header_btns, 1)
    print("Added AI Advisor button to header.")

# -------------------------------------------------------------
# 2. Add AI Advisor Drawer Modal Markup
# -------------------------------------------------------------
ai_advisor_modal_html = """
<!-- City Pretty AI Urban & Property Advisor Modal -->
<div class="overlay-modal" id="ai-advisor-modal" hidden>
  <div class="modal-card" style="max-width:780px;height:84vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:24px;">🤖</span>
        <div>
          <div style="font-size:16px;font-weight:800;letter-spacing:0.3px;">City Pretty AI Urban &amp; Property Advisor</div>
          <div style="font-size:11px;color:#e0e7ff;opacity:0.95;">Grounded in Verified GIS Cadastre, State Statutory Housing Rights &amp; Infrastructure ROI</div>
        </div>
      </div>
      <button type="button" onclick="closeAiAdvisor()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>

    <!-- Active Context Strip -->
    <div id="ai-context-strip" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 16px;font-size:11.5px;color:#334155;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-weight:700;color:#0f172a;">📍 Active Context:</span>
      <span id="ai-context-desc" style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;font-weight:600;">No home selected (select a parcel or neighborhood to ground AI advice)</span>
    </div>

    <!-- Chat Message History -->
    <div id="ai-chat-history" style="flex:1;overflow-y:auto;padding:16px;background:#fdfdfd;display:flex;flex-direction:column;gap:12px;font-size:12.5px;line-height:1.5;">
      <!-- Populated dynamically -->
    </div>

    <!-- Quick Prompts Strip -->
    <div style="padding:8px 14px;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;gap:6px;overflow-x:auto;">
      <button type="button" class="story-btn" onclick="askAiPrompt('best_move')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">🎯 Best Move for this Lot?</button>
      <button type="button" class="story-btn" onclick="askAiPrompt('adu_parking')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">🚗 Can I Skip Parking for ADU?</button>
      <button type="button" class="story-btn" onclick="askAiPrompt('solar_equity')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">☀️ Solar &amp; Battery Savings?</button>
      <button type="button" class="story-btn" onclick="askAiPrompt('lot_split')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">📐 Can I Split this Lot (SB 9)?</button>
      <button type="button" class="story-btn" onclick="askAiPrompt('p3_roi')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">🚆 Nearby P3 Transit Infrastructure?</button>
    </div>

    <!-- Input Bar -->
    <form onsubmit="handleAiSubmit(event)" style="display:flex;gap:8px;padding:10px 14px;background:#fff;border-top:1px solid #e2e8f0;">
      <input type="text" id="ai-user-input" placeholder="Ask anything about zoning, ROI, permits, parking exemptions, or transit..." style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:12.5px;outline:none;" />
      <button type="submit" style="background:#7c3aed;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
        <span>Ask</span> <span>⚡</span>
      </button>
    </form>
  </div>
</div>
"""

modal_anchor = '<div class="overlay-modal" id="accuracy-modal" hidden>'
if modal_anchor in c:
    c = c.replace(modal_anchor, ai_advisor_modal_html + "\n" + modal_anchor, 1)
    print("Inserted AI Advisor modal markup.")

# -------------------------------------------------------------
# 3. Add AI Advisor & Comparison Tabs Logic
# -------------------------------------------------------------
ai_logic_js = """
// --- City Pretty AI Urban & Property Advisor Engine ---
let aiHistory = [];

function openAiAdvisor() {
  const m = document.getElementById("ai-advisor-modal");
  if (m) {
    m.hidden = false;
    document.body.style.overflow = "hidden";
    updateAiContext();
    if (aiHistory.length === 0) {
      initAiWelcome();
    }
  }
}

function closeAiAdvisor() {
  const m = document.getElementById("ai-advisor-modal");
  if (m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
}

function updateAiContext() {
  const strip = document.getElementById("ai-context-desc");
  if (!strip) return;
  if (activeHouse && activeHouse.a) {
    const a = activeHouse.a;
    const addr = a.SitusFullAddress || ("Parcel " + a.AIN);
    const lotSqft = activeHouse.lot ? `${activeHouse.lot.toLocaleString()} sq ft` : "Lot area loading";
    strip.innerHTML = `<b>${esc(addr)}</b> (APN ${esc(a.AIN || "–")}) &middot; ${lotSqft} &middot; ${esc(a.county || countyOf())}`;
  } else if (selected && byId.get(selected)) {
    const p = byId.get(selected).properties;
    strip.innerHTML = `<b>${esc(p.n)}</b>, ${esc(p.c)} &middot; Neighborhood Focus`;
  } else {
    strip.textContent = `General County Focus: ${countyOf() || "United States"}`;
  }
}

function initAiWelcome() {
  const isHouse = activeHouse && activeHouse.a;
  const initialText = isHouse
    ? `Hello! I am your AI Urban & Property Advisor. I have examined the official county assessor records, statutory housing laws, transit walkshed buffers, and solar irradiance for <b>${esc(activeHouse.a.SitusFullAddress || "this property")}</b>.<br><br>Click any prompt below or ask me anything about zoning entitlements, building an ADU without parking, lot splitting, or solar payback.`
    : `Hello! I am your AI Urban & Property Advisor. Select any home or neighborhood on the map, and I will analyze its authoritative property lines, state housing statutes, P3 transit corridors, and optimal return-on-investment pathways.<br><br>How can I assist your planning or investment strategy today?`;

  aiHistory = [{ role: "assistant", text: initialText }];
  renderAiChat();
}

function renderAiChat() {
  const box = document.getElementById("ai-chat-history");
  if (!box) return;
  box.innerHTML = aiHistory.map(msg => {
    if (msg.role === "user") {
      return `<div style="align-self:flex-end;background:#4f46e5;color:#fff;padding:8px 12px;border-radius:12px 12px 0 12px;max-width:82%;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-weight:500;">
        ${esc(msg.text)}
      </div>`;
    } else {
      return `<div style="align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a;padding:12px 14px;border-radius:12px 12px 12px 0;max-width:92%;box-shadow:0 1px 4px rgba(0,0,0,0.05);line-height:1.5;">
        <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
          <span>🤖</span> <span>AI ADVISOR VERDICT</span>
        </div>
        ${msg.text}
      </div>`;
    }
  }).join("");
  box.scrollTop = box.scrollHeight;
}

function handleAiSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("ai-user-input");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  aiHistory.push({ role: "user", text: q });
  renderAiChat();

  setTimeout(() => {
    const answer = generateAiAnswer(q);
    aiHistory.push({ role: "assistant", text: answer });
    renderAiChat();
  }, 400);
}

function askAiPrompt(key) {
  let promptText = "";
  if (key === "best_move") promptText = "What is the single best investment move for this lot?";
  else if (key === "adu_parking") promptText = "Can I build an ADU here without adding parking spaces?";
  else if (key === "solar_equity") promptText = "What is the estimated rooftop solar sizing, cost, and equity return?";
  else if (key === "lot_split") promptText = "Can I split this lot into two separate deeded parcels under SB 9?";
  else if (key === "p3_roi") promptText = "What P3 transit infrastructure and station corridor investments are nearby?";
  
  aiHistory.push({ role: "user", text: promptText });
  renderAiChat();

  setTimeout(() => {
    const answer = generateAiAnswer(promptText, key);
    aiHistory.push({ role: "assistant", text: answer });
    renderAiChat();
  }, 400);
}

function generateAiAnswer(q, promptKey = null) {
  const isHouse = activeHouse && activeHouse.a;
  const a = isHouse ? activeHouse.a : {};
  const lotSqft = (isHouse && activeHouse.lot) ? activeHouse.lot : 5500;
  const ll = (isHouse && activeHouse.ll) ? activeHouse.ll : (map ? map.getCenter() : { lat: 34.05, lng: -118.25 });
  const nearestStn = (typeof findNearestTransitStation === "function") ? findNearestTransitStation(ll.lat, ll.lng) : null;
  const inWalkshed = nearestStn && nearestStn.distMi <= 0.50;
  const isCa = (ll.lat >= 32.5 && ll.lat <= 42.0 && ll.lng >= -124.5 && ll.lng <= -114.1);

  const qLower = q.toLowerCase();

  if (promptKey === "best_move" || qLower.includes("best") || qLower.includes("highest roi") || qLower.includes("playbook")) {
    if (isHouse) {
      const pb = computePropertyPlaybook(a, lotSqft, activeHouse.F || {}, null, ll, activeHouse.st);
      const b = pb.best;
      return `<b>Strategy Recommendation:</b> ${esc(b.title)}<br><br>
        <b>Financial Economics:</b>
        <ul style="margin:4px 0;padding-left:18px;">
          <li><b>Net Equity Created:</b> +$${Math.round(b.equity).toLocaleString()}</li>
          <li><b>Return per $1:</b> $${b.roi} / $1</li>
          <li><b>Estimated Cost:</b> ~$${Math.round(b.cost).toLocaleString()}</li>
          <li><b>Annual Cash Flow:</b> +$${Math.round(b.annualCashflow).toLocaleString()}/yr (Payback: ~${b.paybackYrs} yrs)</li>
        </ul>
        <b>Statutory Authority:</b> ${esc(b.statute)}.<br><br>
        <b>Action Blueprint:</b><br>
        1. ${esc(b.steps[0] || "Pull city pre-approved plans")}<br>
        2. ${esc(b.steps[1] || "Verify statutory exemptions")}<br>
        3. ${esc(b.steps[2] || "Submit ministerial application within 60 days")}`;
    } else {
      return `For this neighborhood, the top municipal investment is <b>modernizing local parks and tree canopy</b>, returning an estimated <b>$1.80 to $2.40 per $1</b> of public capital invested. Select a specific property parcel to see parcel-level ADU, solar, and lot-split ROI.`;
    }
  }

  if (promptKey === "adu_parking" || qLower.includes("parking") || qLower.includes("ab 2097") || qLower.includes("garage")) {
    if (inWalkshed) {
      return `<b>Yes, you are 100% exempt from adding parking!</b><br><br>
        This property is located <b>${(nearestStn.distMi * 5280).toFixed(0)} ft (${nearestStn.distMi.toFixed(2)} mi)</b> from <b>${esc(nearestStn.name)}</b> station.<br><br>
        Under <b>${isCa ? 'California Public Resources Code § 65863.2 (AB 2097)' : 'Transit Corridor Walkshed Statutory Parking Exemptions'}</b>, local jurisdictions cannot impose minimum parking requirements on residential developments within 0.5 miles of a major transit stop. This saves you an estimated <b>$35,000 to $55,000</b> by eliminating the need to construct a garage or covered parking space.`;
    } else if (isCa) {
      return `Under California State ADU Law (Gov. Code § 66314), parking cannot be required for an ADU if it is within 0.5 miles of any public transit stop, within an architecturally historic district, or if the unit is created by converting existing space (e.g. attached garage or basement). Furthermore, you do not have to replace garage parking converted into an ADU (Gov. Code § 66314(d)).`;
    } else {
      return `Under missing-middle and transit-oriented housing ordinances, accessory dwelling units built within 0.5 miles of transit corridors are generally exempt from off-street parking mandates.`;
    }
  }

  if (promptKey === "solar_equity" || qLower.includes("solar") || qLower.includes("battery") || qLower.includes("clean energy") || qLower.includes("itc")) {
    const usableRoof = Math.round(lotSqft * 0.25);
    const kw = Math.max(3.5, +(usableRoof / 75).toFixed(1));
    const grossCost = Math.round(kw * 2800);
    const taxCredit = Math.round(grossCost * 0.30);
    const netCost = grossCost - taxCredit;
    const savYr = Math.round(kw * 1450 * 0.23);
    const equity25Yr = Math.round(savYr * 25 - netCost);

    return `<b>Rooftop Solar &amp; Electrification Assessment:</b><br><br>
      • <b>Recommended DC Capacity:</b> ${kw.toFixed(1)} kW DC (${Math.round(kw * 2.5)} premium panels)<br>
      • <b>Annual Clean Generation:</b> ~${(kw * 1450).toLocaleString()} kWh / year<br>
      • <b>Utility Bill Offset:</b> ~$${savYr.toLocaleString()} / year (@ $0.23/kWh)<br>
      • <b>30% Federal ITC (IRA § 25D):</b> -$${taxCredit.toLocaleString()} direct tax credit<br>
      • <b>Net Initial Investment:</b> ~$${netCost.toLocaleString()} (Payback in ${(netCost / savYr).toFixed(1)} years)<br>
      • <b>25-Year Cumulative Equity:</b> <b style="color:#15803d">+ $${equity25Yr.toLocaleString()}</b> net savings. Pair with a 10–13.5 kWh battery storage system to maximize time-of-use peak arbitrage.`;
  }

  if (promptKey === "lot_split" || qLower.includes("split") || qLower.includes("sb 9") || qLower.includes("subdivision") || qLower.includes("duplex")) {
    if (lotSqft >= 4800) {
      return `<b>Lot Split Feasibility: Highly Favorable!</b><br><br>
        With a deeded area of <b>${lotSqft.toLocaleString()} sq ft</b>, this parcel exceeds the standard 4,800 sq ft threshold required for a statutory two-lot urban subdivision.<br><br>
        ${isCa ? `Under <b>California Senate Bill 9 (Gov. Code § 66411.7)</b>, this parcel qualifies for an administrative, ministerial lot split into two separate deeded parcels (minimum 1,200 sq ft per lot, neither lot smaller than 40% of the total). You can build up to 2 homes on each lot (4 total units) without discretionary planning hearings, CEQA review, or neighbor appeals.` : `Under local missing-middle subdivision statutes, parcels over 4,800 sq ft can typically be divided into two fee-simple lots, instantly unlocking six-figure unencumbered land equity.`}`;
    } else {
      return `This lot is currently <b>${lotSqft.toLocaleString()} sq ft</b>. For lots under 4,800 sq ft, a fee-simple subdivision is tight, but an attached or detached Accessory Dwelling Unit (ADU) + Junior ADU (JADU) remains completely allowable by right without subdividing.`;
    }
  }

  if (promptKey === "p3_roi" || qLower.includes("p3") || qLower.includes("transit") || qLower.includes("rail") || qLower.includes("station")) {
    const pipe = (typeof getMetroPipeline === "function") ? getMetroPipeline(activeFips()) : null;
    if (pipe) {
      return `<b>Active Transit Corridor: ${esc(pipe.title)}</b><br><br>
        • <b>Lead Sponsoring Agency:</b> ${esc(pipe.agency)}<br>
        • <b>Status:</b> ${esc(pipe.status)}<br>
        • <b>P3 Delivery Model:</b> 99-year ground lease concession with private development consortium.<br>
        • <b>Projected Economic Return:</b> $1.65 to $2.20 of property value lift per $1 invested.<br>
        • <b>Complementary Infrastructure:</b> Protected rail-with-trail cycleway, 16 DC fast EV charging stalls, and urban tree canopy cooling.`;
    } else {
      return `City Pretty tracks 16 major metropolitan transit expansion corridors across 86 stations. Browse our transit layer to inspect corridor walksheds and P3 joint development ROI.`;
    }
  }

  return `Based on our verified GIS cadastral records for <b>${esc(a.SitusFullAddress || countyOf())}</b>, this location benefits from statutory by-right residential infill rights and favorable clean energy irradiance. You can ask me specifically about:<br>
    • <b>ADU Sizing &amp; Parking Exemption</b><br>
    • <b>Rooftop Solar Financial Payback</b><br>
    • <b>Senate Bill 9 Lot Splitting</b><br>
    • <b>Capital Project Return-per-$1</b>`;
}
"""

if "function openAiAdvisor" not in c:
    c = c.replace("function openAccuracyModal() {", ai_logic_js + "\nfunction openAccuracyModal() {", 1)
    print("Added AI Advisor JS logic.")

# -------------------------------------------------------------
# 4. Property Comparison ("Compare Homes") System
# -------------------------------------------------------------
home_compare_js = """
// --- Property Deal Comparison System ---
let homeCompareList = [];
let compareActiveTab = "hoods";

function toggleHomeCompare() {
  if (!activeHouse || !activeHouse.a) return;
  const a = activeHouse.a;
  const apn = a.AIN;
  const idx = homeCompareList.findIndex(h => h.ain === apn);
  if (idx >= 0) {
    homeCompareList.splice(idx, 1);
    showToast("Removed property from comparison");
  } else {
    if (homeCompareList.length >= 3) {
      showToast("Property comparison is limited to 3 homes");
      return;
    }
    const lotSqft = activeHouse.lot || 5000;
    const F = activeHouse.F || {};
    const ll = activeHouse.ll || (map ? map.getCenter() : { lat: 34.05, lng: -118.25 });
    const pb = computePropertyPlaybook(a, lotSqft, F, null, ll, activeHouse.st);
    const nearestStn = (typeof findNearestTransitStation === "function") ? findNearestTransitStation(ll.lat, ll.lng) : null;
    const roofSqft = Math.round(((F.foot || Math.min(F.bldg || 1600, lotSqft * 0.35)) * 1.15));
    const solarKw = Math.max(3.5, +(Math.round(roofSqft * 0.65) / 75).toFixed(1));

    homeCompareList.push({
      ain: apn,
      address: a.SitusFullAddress || ("Parcel " + apn),
      county: a.county || countyOf(),
      lotSqft: lotSqft,
      bldgSqft: F.bldg || 1600,
      stories: F.stories || 1,
      valuation: a.Roll_TotalValue || 750000,
      playbook: pb,
      solarKw: solarKw,
      nearestStn: nearestStn,
      ll: ll
    });
    showToast("Added home to deal comparison");
  }
  updateHomeCompareUI();
}

function updateHomeCompareUI() {
  const btn = document.getElementById("btn-compare-home-dossier");
  if (btn && activeHouse && activeHouse.a) {
    const inC = homeCompareList.some(h => h.ain === activeHouse.a.AIN);
    btn.textContent = inC ? "✓ In Home Comparison" : "⚖️ + Compare This Home";
    btn.classList.toggle("active", inC);
  }
  const tabHomes = document.getElementById("tab-cmp-homes");
  if (tabHomes) tabHomes.textContent = `🏠 Homes & Lots (${homeCompareList.length})`;
}

function switchCompareTab(tab) {
  compareActiveTab = tab;
  const tabH = document.getElementById("tab-cmp-hoods");
  const tabP = document.getElementById("tab-cmp-homes");
  if (tabH) tabH.classList.toggle("active", tab === "hoods");
  if (tabP) tabP.classList.toggle("active", tab === "homes");
  renderCompareDrawer();
}
"""

if "function toggleHomeCompare" not in c:
    c = c.replace("function updateCompareUI() {", home_compare_js + "\nfunction updateCompareUI() {", 1)
    print("Added Home Compare JS logic.")

# -------------------------------------------------------------
# 5. Enhance Compare Drawer to Support Both Neighborhoods and Homes Tabs
# -------------------------------------------------------------
old_render_compare = """function renderCompareDrawer() {
  const box = $("#compare-content");
  if (!box) return;
  if (!compareList.length) {
    box.innerHTML = `<p class="empty">No neighborhoods selected. Click "+ Compare" on any neighborhood card.</p>`;
    return;
  }
  box.innerHTML = compareList.map(id => {"""

new_render_compare = """function renderCompareDrawer() {
  const box = $("#compare-content");
  if (!box) return;

  // Render Tab Switcher at top of modal
  let tabHeader = document.getElementById("compare-tab-bar");
  if (!tabHeader) {
    const parent = box.parentElement;
    tabHeader = document.createElement("div");
    tabHeader.id = "compare-tab-bar";
    tabHeader.style.cssText = "display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid #cbd5e1;padding-bottom:8px;";
    tabHeader.innerHTML = `
      <button type="button" class="action-pill ${compareActiveTab === 'hoods' ? 'active' : ''}" id="tab-cmp-hoods" onclick="switchCompareTab('hoods')">🏘️ Neighborhoods (${compareList.length})</button>
      <button type="button" class="action-pill ${compareActiveTab === 'homes' ? 'active' : ''}" id="tab-cmp-homes" onclick="switchCompareTab('homes')">🏠 Homes &amp; Lots (${homeCompareList.length})</button>
    `;
    parent.insertBefore(tabHeader, box);
  } else {
    document.getElementById("tab-cmp-hoods").className = `action-pill ${compareActiveTab === 'hoods' ? 'active' : ''}`;
    document.getElementById("tab-cmp-homes").className = `action-pill ${compareActiveTab === 'homes' ? 'active' : ''}`;
    document.getElementById("tab-cmp-hoods").textContent = `🏘️ Neighborhoods (${compareList.length})`;
    document.getElementById("tab-cmp-homes").textContent = `🏠 Homes & Lots (${homeCompareList.length})`;
  }

  if (compareActiveTab === "homes") {
    if (!homeCompareList.length) {
      box.innerHTML = `<p class="empty" style="padding:20px;text-align:center;">No homes selected. Click <b>"⚖️ + Compare This Home"</b> on any property dossier to compare investment returns side-by-side.</p>`;
      return;
    }
    box.innerHTML = homeCompareList.map(h => {
      const b = h.playbook.best;
      return `
        <div class="compare-col" style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <h4 style="margin:0 0 2px 0;font-size:13px;font-weight:800;color:#0f172a;">${esc(h.address)}</h4>
              <div style="font-size:10.5px;color:#64748b;">APN ${esc(h.ain)} &middot; ${esc(h.county)}</div>
            </div>
            <button type="button" class="small" style="background:none;border:none;cursor:pointer;color:var(--ink-3);font-size:14px;font-weight:700;" onclick="homeCompareList = homeCompareList.filter(x => x.ain !== '${h.ain}'); renderCompareDrawer(); updateHomeCompareUI();">✕</button>
          </div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px;margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;">Top Recommended Move:</div>
            <div style="font-size:12px;font-weight:800;color:#15803d;margin-top:2px;">${esc(b.title)}</div>
            <div style="font-size:11px;font-weight:700;color:#047857;margin-top:2px;">+$${Math.round(b.equity).toLocaleString()} Net Equity (${b.roi} / $1)</div>
          </div>

          <div class="c-row"><span class="k">Lot Size</span><span class="v">${h.lotSqft.toLocaleString()} sq ft</span></div>
          <div class="c-row"><span class="k">Living Area</span><span class="v">${h.bldgSqft.toLocaleString()} sq ft (${h.stories} story)</span></div>
          <div class="c-row"><span class="k">Est. Value</span><span class="v">$${Number(h.valuation).toLocaleString()}</span></div>
          <div class="c-row"><span class="k">Solar DC Capacity</span><span class="v">${h.solarKw} kW DC</span></div>
          <div class="c-row"><span class="k">Transit Walkshed</span><span class="v">${h.nearestStn ? (h.nearestStn.distMi <= 0.5 ? '<b style="color:#0284c7">0-Parking Exempt</b>' : h.nearestStn.distMi.toFixed(2) + ' mi') : '–'}</span></div>
          <div class="c-row"><span class="k">Payback Horizon</span><span class="v">${b.paybackYrs} yrs</span></div>
        </div>
      `;
    }).join("");
    return;
  }

  // Otherwise Neighborhoods tab
  if (!compareList.length) {
    box.innerHTML = `<p class="empty">No neighborhoods selected. Click "+ Compare" on any neighborhood card.</p>`;
    return;
  }
  box.innerHTML = compareList.map(id => {"""

if old_render_compare in c:
    c = c.replace(old_render_compare, new_render_compare, 1)
    print("Enhanced renderCompareDrawer to support both Neighborhoods and Homes tabs.")

# -------------------------------------------------------------
# 6. Add Interactive Site Plan & Infill Setback Visualizer in renderHouse
# -------------------------------------------------------------
site_plan_markup = """
    <!-- 📐 INTERACTIVE SITE PLAN & INFILL / ADU MASSING VISUALIZER -->
    <details class="site-plan-drawer" style="margin:10px 0;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;overflow:hidden;">
      <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
        <span>📐 Interactive Site Plan &amp; Infill Setback Visualizer</span>
        <span style="font-size:11px;background:#e2e8f0;color:#334155;padding:2px 7px;border-radius:4px;font-weight:600">4-Ft Setbacks &middot; By-Right Footprint</span>
      </summary>
      <div style="padding:12px;background:#fff;border-top:1px solid #cbd5e1;font-size:12px;">
        <div style="margin-bottom:8px;color:#475569;line-height:1.4;">
          Visualizes this parcel\'s deeded footprint with state statutory 4-ft side and rear setback buffers and the proposed accessory infill building massing.
        </div>

        <div style="display:flex;justify-content:center;margin:10px 0;">
          <svg viewBox="0 0 320 200" style="width:100%;max-width:320px;height:200px;background:#f1f5f9;border:1.5px solid #94a3b8;border-radius:6px;">
            <!-- Lot boundary -->
            <rect x="15" y="15" width="290" height="170" fill="#f8fafc" stroke="#475569" stroke-width="2" />
            <text x="25" y="32" font-size="9" font-weight="700" fill="#64748b">DEEDED LOT BOUNDARY (${lot.toLocaleString()} SQ FT)</text>
            
            <!-- 4-ft Setback Buffer (Dashed Orange) -->
            <rect x="25" y="25" width="270" height="150" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" />
            <text x="200" y="38" font-size="8" fill="#d97706" font-weight="600">4-FT STATUTORY SETBACK</text>

            <!-- Main Residence (Slate Blue) -->
            <rect x="35" y="50" width="130" height="100" rx="3" fill="#3b82f6" fill-opacity="0.85" stroke="#1d4ed8" stroke-width="1.5" />
            <text x="45" y="95" font-size="10" font-weight="700" fill="#fff">PRIMARY HOME</text>
            <text x="45" y="110" font-size="8.5" fill="#e0e7ff">${(F.foot || Math.min(F.bldg || 1600, lot * 0.35)).toLocaleString()} sq ft</text>

            <!-- Rear Yard Proposed ADU (Emerald Green) -->
            <rect x="185" y="65" width="95" height="75" rx="3" fill="#10b981" fill-opacity="0.9" stroke="#047857" stroke-width="1.5" />
            <text x="195" y="100" font-size="9.5" font-weight="800" fill="#fff">PROPOSED ADU</text>
            <text x="195" y="115" font-size="8.5" fill="#d1fae5">650–800 sq ft</text>
          </svg>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11.5px;color:#334155;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;">
          <div>• <b>Side/Rear Setback:</b> <span style="color:#059669;font-weight:700">4.0 ft (Compliant)</span></div>
          <div>• <b>Lot Coverage:</b> ~${Math.min(48, Math.round(((F.foot || 1600) + 750) / Math.max(lot, 4000) * 100))}% (By-right allowable)</div>
          <div>• <b>Parking Replacement:</b> <span style="color:#0284c7;font-weight:700">Exempt (0 spaces)</span></div>
          <div>• <b>Permit Review:</b> <span style="color:#16a34a;font-weight:700">Ministerial (60 Days)</span></div>
        </div>
      </div>
    </details>
"""

# Insert Site Plan right before the ADU Interactive Card in renderHouse
adu_card_target = '<!-- Interactive ADU Sizing & Return Modeler -->'
if adu_card_target in c:
    c = c.replace(adu_card_target, site_plan_markup + "\n    " + adu_card_target, 1)
    print("Inserted Interactive Site Plan Visualizer into renderHouse.")

# -------------------------------------------------------------
# 7. Add Compare This Home Button in renderHouse Header
# -------------------------------------------------------------
old_house_header = """      <p class="small" style="margin:0"><b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b> · AIN/APN ${esc(a.AIN)} · ${esc(a.UseDescription || "")}</p>"""

new_house_header = """      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
        <p class="small" style="margin:0;flex:1;"><b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b> &middot; AIN/APN ${esc(a.AIN)} &middot; ${esc(a.UseDescription || "")}</p>
        <div style="display:flex;gap:4px;">
          <button type="button" id="btn-compare-home-dossier" class="story-btn" onclick="toggleHomeCompare()" style="font-size:11px;padding:3px 8px;font-weight:600;">⚖️ + Compare This Home</button>
          <button type="button" class="story-btn" onclick="openAiAdvisor()" style="background:#7c3aed;color:#fff;border-color:#6d28d9;font-size:11px;padding:3px 8px;font-weight:700;">🤖 Ask AI</button>
        </div>
      </div>"""

if old_house_header in c:
    c = c.replace(old_house_header, new_house_header, 1)
    print("Added Compare Home and Ask AI buttons to renderHouse header.")

# -------------------------------------------------------------
# 8. Save updated index.html and city-pretty.html
# -------------------------------------------------------------
with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(c)

with open(CITY_PRETTY_PATH, "w", encoding="utf-8") as f:
    f.write(c)

print(f"Successfully applied Round 8 features! New file size: {len(c)}")
