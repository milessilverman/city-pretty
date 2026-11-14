/**
 * City Pretty: Nov 08 Delta Patch
 * Implements:
 * 1. resolveRepoAssetUrl() to prevent 404s on GitHub Pages /city-pretty/ subpath
 * 2. patchCanopyCardDom() to decouple floating canopy card from hardcoded LA numbers
 * 3. patchTopBarControlsDom() to:
 *    - Update "Measured in LA only (A)" -> "Measured in local metro only (A)"
 *    - Update "Heat vs. county median" -> "Heat vs. EPA Level IV ecoregion median"
 *    - Add "Renter displacement sensitivity (0–100)" to metric select
 *    - Quarantine unverified/experimental modes (grade=U, metric=profit) behind an opt-in toggle
 */

export function resolveRepoAssetUrl(path: string): string {
  if (!path) return "";
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, "");

  if (typeof window !== "undefined" && window.location) {
    const loc = window.location;
    if (loc.protocol === "file:") {
      return `https://milessilverman.github.io/city-pretty/${cleanPath}`;
    }
    if (loc.pathname && loc.pathname.startsWith("/city-pretty/")) {
      return `/city-pretty/${cleanPath}`;
    }
  }

  return cleanPath;
}

export function patchCanopyCardDom(stateCode?: string, countyName?: string): void {
  if (typeof document === "undefined") return;

  const st = (stateCode || (typeof (window as any).activeState === "function" ? (window as any).activeState() : "CA")).toUpperCase();
  const cName = countyName || (typeof (window as any).countyNameOf === "function" && typeof (window as any).activeFips === "function" ? (window as any).countyNameOf((window as any).activeFips()) : "this county");

  let cardEl = document.getElementById("canopy-hud-economic");
  if (!cardEl) {
    const hud = document.getElementById("canopy-hud");
    if (hud) {
      const divs = hud.querySelectorAll("div");
      for (let i = 0; i < divs.length; i++) {
        if (divs[i].textContent && divs[i].textContent!.includes("Economic Impact")) {
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

export function patchTopBarControlsDom(): void {
  if (typeof document === "undefined") return;

  // 1. Patch evidence dropdown
  const evidSel = document.getElementById("evid") as HTMLSelectElement | null;
  if (evidSel) {
    const optA = evidSel.querySelector('option[value="A"]');
    if (optA) {
      optA.textContent = "Measured in local metro only (A)";
    }
  }

  // 2. Patch metric dropdown
  const metricSel = document.getElementById("metric") as HTMLSelectElement | null;
  if (metricSel) {
    const optHeat = metricSel.querySelector('option[value="heat"]');
    if (optHeat) {
      optHeat.textContent = "Heat vs. EPA Level IV ecoregion median";
    }

    let optDisp = metricSel.querySelector('option[value="displacement"]');
    if (!optDisp) {
      optDisp = document.createElement("option");
      (optDisp as HTMLOptionElement).value = "displacement";
      optDisp.textContent = "Renter displacement sensitivity (0–100)";
      metricSel.appendChild(optDisp);
    }
  }

  // 3. Quarantine unverified/experimental modes behind toggle
  const isExperimental = !!(window as any).__CITY_PRETTY_EXPERIMENTAL__;
  
  if (evidSel) {
    const optU = evidSel.querySelector('option[value="U"]') as HTMLOptionElement | null;
    if (optU) {
      optU.hidden = !isExperimental;
      if (!isExperimental && evidSel.value === "U") {
        evidSel.value = "D";
      }
    }
  }

  if (metricSel) {
    const optProfit = metricSel.querySelector('option[value="profit"]') as HTMLOptionElement | null;
    if (optProfit) {
      optProfit.hidden = !isExperimental;
      if (!isExperimental && metricSel.value === "profit") {
        metricSel.value = "top_vpd";
      }
    }
  }
}

export function toggleExperimentalModes(enabled?: boolean): boolean {
  if (typeof window === "undefined") return false;
  const curr = !(window as any).__CITY_PRETTY_EXPERIMENTAL__;
  const next = enabled !== undefined ? enabled : curr;
  (window as any).__CITY_PRETTY_EXPERIMENTAL__ = next;
  patchTopBarControlsDom();
  return next;
}
