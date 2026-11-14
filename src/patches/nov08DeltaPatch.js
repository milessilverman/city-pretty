"use strict";

function resolveRepoAssetUrl(path) {
  if (!path) return "";
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, "");

  if (typeof window !== "undefined" && window.location) {
    const loc = window.location;
    if (loc.protocol === "file:") {
      return "https://milessilverman.github.io/city-pretty/" + cleanPath;
    }
    if (loc.pathname && loc.pathname.startsWith("/city-pretty/")) {
      return "/city-pretty/" + cleanPath;
    }
  }

  return cleanPath;
}

function patchCanopyCardDom(stateCode, countyName) {
  if (typeof document === "undefined") return;

  const st = (stateCode || (typeof window !== "undefined" && typeof window.activeState === "function" ? window.activeState() : "CA")).toUpperCase();
  const cName = countyName || (typeof window !== "undefined" && typeof window.countyNameOf === "function" && typeof window.activeFips === "function" ? window.countyNameOf(window.activeFips()) : "this county");

  let cardEl = document.getElementById("canopy-hud-economic");
  if (!cardEl) {
    const hud = document.getElementById("canopy-hud");
    if (hud) {
      const divs = hud.querySelectorAll("div");
      for (let i = 0; i < divs.length; i++) {
        if (divs[i].textContent && divs[i].textContent.includes("Economic Impact")) {
          divs[i].id = "canopy-hud-economic";
          cardEl = divs[i];
          break;
        }
      }
    }
  }

  if (!cardEl) return;

  const HEATING_STATES = new Set([
    "AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"
  ]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);

  if (HEATING_STATES.has(st)) {
    cardEl.innerHTML = `🌲 <b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$5,400</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$95/yr</b> in winter windbreak heating load.`;
  } else if (ARID_STATES.has(st)) {
    cardEl.innerHTML = `🌲 <b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$8,200</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$220/yr</b> in peak summer cooling load (with xeriscape drip irrigation).`;
  } else if (st === "CA") {
    cardEl.innerHTML = `🌲 <b>Economic Impact (CA):</b> Mature street tree canopy adds <b>+$7,130</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$140/yr</b> in AC cooling load.`;
  } else {
    cardEl.innerHTML = `🌲 <b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$6,200</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$115/yr</b> in balanced seasonal heating &amp; cooling efficiency.`;
  }
}

function patchTopBarControlsDom() {
  if (typeof document === "undefined") return;

  // 1. Patch evidence dropdown
  const evidSel = document.getElementById("evid");
  if (evidSel) {
    const optA = evidSel.querySelector('option[value="A"]');
    if (optA) {
      optA.textContent = "Measured in local metro only (A)";
    }
  }

  // 2. Patch metric dropdown
  const metricSel = document.getElementById("metric");
  if (metricSel) {
    const optHeat = metricSel.querySelector('option[value="heat"]');
    if (optHeat) {
      optHeat.textContent = "Heat vs. EPA Level IV ecoregion median";
    }

    let optDisp = metricSel.querySelector('option[value="displacement"]');
    if (!optDisp) {
      optDisp = document.createElement("option");
      optDisp.value = "displacement";
      optDisp.textContent = "Renter displacement sensitivity (0–100)";
      metricSel.appendChild(optDisp);
    }
  }

  // 3. Quarantine unverified/experimental modes behind toggle
  const isExperimental = !!(typeof window !== "undefined" && window.__CITY_PRETTY_EXPERIMENTAL__);

  if (evidSel) {
    const optU = evidSel.querySelector('option[value="U"]');
    if (optU) {
      optU.hidden = !isExperimental;
      if (!isExperimental && evidSel.value === "U") {
        evidSel.value = "D";
      }
    }
  }

  if (metricSel) {
    const optProfit = metricSel.querySelector('option[value="profit"]');
    if (optProfit) {
      optProfit.hidden = !isExperimental;
      if (!isExperimental && metricSel.value === "profit") {
        metricSel.value = "top_vpd";
      }
    }
  }
}

function toggleExperimentalModes(enabled) {
  if (typeof window === "undefined") return false;
  const curr = !window.__CITY_PRETTY_EXPERIMENTAL__;
  const next = enabled !== undefined ? enabled : curr;
  window.__CITY_PRETTY_EXPERIMENTAL__ = next;
  patchTopBarControlsDom();
  return next;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    resolveRepoAssetUrl,
    patchCanopyCardDom,
    patchTopBarControlsDom,
    toggleExperimentalModes,
  };
}

if (typeof window !== "undefined") {
  window.resolveRepoAssetUrl = resolveRepoAssetUrl;
  window.patchCanopyCardDom = patchCanopyCardDom;
  window.patchTopBarControlsDom = patchTopBarControlsDom;
  window.toggleExperimentalModes = toggleExperimentalModes;
}
