import { CountyDataCompleteness } from "../types";

export interface AppViewState {
  countyFips: string;          // e.g., "06037" (LA), "06059" (OC), "48201" (Harris TX)
  blockGroupGeoid: string | null;
  metric: string;              // "top_vpd" | "top" | "pkg_cost" | "value" | "heat" | "crime" | "park" | "bus" | "sites" | "profit"
  gradeFilter: "A" | "B" | "C" | "D" | "U";
  applyLocalAdjustment: boolean;
  includeExperimental: boolean;
  compareGeoids: string[];     // Up to 3 block groups
}

const DEFAULT_STATE: AppViewState = {
  countyFips: "06037",
  blockGroupGeoid: null,
  metric: "top_vpd",
  gradeFilter: "D",
  applyLocalAdjustment: false,
  includeExperimental: false,
  compareGeoids: [],
};

export function parseHashState(hashString: string): AppViewState {
  const clean = hashString.replace(/^#/, "");
  const params = new URLSearchParams(clean);

  const compareRaw = params.get("compare");
  const compareGeoids = compareRaw
    ? compareRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    countyFips: params.get("county") ?? DEFAULT_STATE.countyFips,
    blockGroupGeoid: params.get("bg") ?? null,
    metric: params.get("metric") ?? DEFAULT_STATE.metric,
    gradeFilter: (params.get("grade") as AppViewState["gradeFilter"]) ?? DEFAULT_STATE.gradeFilter,
    applyLocalAdjustment: params.get("adj") === "1",
    includeExperimental: params.get("exp") === "1",
    compareGeoids,
  };
}

export function serializeHashState(state: AppViewState): string {
  const params = new URLSearchParams();
  params.set("county", state.countyFips);
  if (state.blockGroupGeoid) params.set("bg", state.blockGroupGeoid);
  if (state.metric !== DEFAULT_STATE.metric) params.set("metric", state.metric);
  if (state.gradeFilter !== DEFAULT_STATE.gradeFilter) params.set("grade", state.gradeFilter);
  if (state.applyLocalAdjustment) params.set("adj", "1");
  if (state.includeExperimental) params.set("exp", "1");
  if (state.compareGeoids.length > 0) params.set("compare", state.compareGeoids.slice(0, 3).join(","));
  return `#${params.toString()}`;
}

export function syncHeaderDomToCounty(
  county: CountyDataCompleteness,
  buildDateText: string
): void {
  const eyebrowEl = document.querySelector("[data-city-pretty-eyebrow]");
  const titleEl = document.querySelector("header h1");
  const gradeAOption = document.querySelector('select option[value="A"]');
  const readinessEl = document.querySelector("[data-county-readiness-pill]");

  const unitLabel = county.name.toUpperCase();
  if (eyebrowEl) {
    eyebrowEl.textContent = `CITY PRETTY · ${unitLabel}, ${county.state.toUpperCase()} · ${buildDateText}`;
  }
  if (titleEl) {
    titleEl.textContent = `Which improvements make ${county.name} neighborhoods better, and worth more, per dollar`;
  }
  if (gradeAOption) {
    gradeAOption.textContent =
      county.fips === "06037"
        ? "Measured in LA County only (A)"
        : "Measured in local metro studies only (A)";
  }
  if (readinessEl) {
    readinessEl.setAttribute("data-tier", county.readiness_tier);
    readinessEl.textContent =
      `Tier: ${county.readiness_tier.toUpperCase()} | ` +
      `Assessor: ${county.assessor_roll_vintage ?? "Unverified"} | ` +
      `Zoning: ${county.zoning_source} | ` +
      `GTFS Feeds: ${county.gtfs_agencies_count}`;
  }
}
