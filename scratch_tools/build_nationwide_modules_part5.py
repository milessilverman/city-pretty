import os

BASE_DIR = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline"

# 1. src/engines/gtfsWalkshedEngine.ts
GTFS = """export interface GtfsStopMetric {
  stopId: string;
  agencyId: string;
  routeType: number; // GTFS: 0=Tram/LRT, 1=Subway/Heavy Rail, 2=Commuter Rail, 3=Bus, 4=Ferry
  lat: number;
  lng: number;
  weekdayPeakTripsPerHour: number;   // 07:00-09:00 and 16:00-18:00 average
  weekdayAllDayTripsPerHour: number; // 06:00-22:00 average (CA AB 2097 / SB 79 benchmark)
  hasFrequentService15Min: boolean;  // >= 4 trips/hr in both directions
}

export interface WalkshedSummary {
  blockGroupGeoid: string;
  busiestStopTripsPerHour: number;
  busiestStopAgency: string;
  withinQuarterMileHeavyRail: boolean;
  withinHalfMileHeavyRail: boolean;
  withinHalfMileFrequentTransit: boolean; // Triggers CA AB 2097 zero-parking & WA HB 1110 tiers
  qualifyingAgencies: string[];
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateBlockGroupTransit(
  blockGroupGeoid: string,
  centroidLat: number,
  centroidLng: number,
  stops: GtfsStopMetric[]
): WalkshedSummary {
  const CIRCUITY_FACTOR = 1.25;

  let busiestStopTripsPerHour = 0;
  let busiestStopAgency = "None";
  let withinQuarterMileHeavyRail = false;
  let withinHalfMileHeavyRail = false;
  let withinHalfMileFrequentTransit = false;
  const agencies = new Set<string>();

  for (const stop of stops) {
    const walkMiles = haversineMiles(centroidLat, centroidLng, stop.lat, stop.lng) * CIRCUITY_FACTOR;
    if (walkMiles > 0.75) continue;

    agencies.add(stop.agencyId);

    if (walkMiles <= 0.5 && stop.weekdayAllDayTripsPerHour > busiestStopTripsPerHour) {
      busiestStopTripsPerHour = Number(stop.weekdayAllDayTripsPerHour.toFixed(1));
      busiestStopAgency = stop.agencyId;
    }

    const isHeavyOrCommuterRail = stop.routeType === 1 || stop.routeType === 2;
    if (isHeavyOrCommuterRail && walkMiles <= 0.25) {
      withinQuarterMileHeavyRail = true;
    }
    if (isHeavyOrCommuterRail && walkMiles <= 0.5) {
      withinHalfMileHeavyRail = true;
    }
    if (walkMiles <= 0.5 && (stop.hasFrequentService15Min || isHeavyOrCommuterRail)) {
      withinHalfMileFrequentTransit = true;
    }
  }

  return {
    blockGroupGeoid,
    busiestStopTripsPerHour,
    busiestStopAgency,
    withinQuarterMileHeavyRail,
    withinHalfMileHeavyRail,
    withinHalfMileFrequentTransit,
    qualifyingAgencies: Array.from(agencies).sort(),
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/gtfsWalkshedEngine.ts"), "w", encoding="utf-8") as f:
    f.write(GTFS)

print("Wrote src/engines/gtfsWalkshedEngine.ts")

# 2. src/engines/lidarStreetViewValidator.ts
LIDAR = """export interface ImageryVintageCheck {
  parcelId: string;
  lidarAcquisitionYear: number;
  streetViewCaptureDate: string | null; // ISO "YYYY-MM"
  latestPostConstructionPermitDate: string | null;
  permitScopeDescription: string | null;
  isLidarStale: boolean;
  isStreetViewStale: boolean;
  confidenceBadge: "verified_current" | "stale_imagery_permit_override" | "no_street_view";
  warningMessage: string | null;
}

export function validateParcelImageryVintage(input: {
  parcelId: string;
  lidarAcquisitionYear: number;
  streetViewCaptureDate: string | null;
  latestPostConstructionPermitDate: string | null;
  permitScopeDescription: string | null;
  referenceYear?: number;
}): ImageryVintageCheck {
  const currentYear = input.referenceYear ?? 2026;
  const permitYear = input.latestPostConstructionPermitDate
    ? Number(input.latestPostConstructionPermitDate.slice(0, 4))
    : null;

  const isLidarStale =
    permitYear !== null && permitYear >= input.lidarAcquisitionYear;

  let isStreetViewStale = false;
  if (input.streetViewCaptureDate) {
    const svYear = Number(input.streetViewCaptureDate.slice(0, 4));
    const ageYears = currentYear - svYear;
    isStreetViewStale =
      ageYears > 3 || (permitYear !== null && permitYear >= svYear);
  }

  if (!input.streetViewCaptureDate) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale: true,
      confidenceBadge: "no_street_view",
      warningMessage:
        "No Google Street View coverage at parcel frontage; story count relies solely on USGS LiDAR/OSM footprints.",
    };
  }

  if (isLidarStale || isStreetViewStale) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale,
      confidenceBadge: "stale_imagery_permit_override",
      warningMessage: `Building permit (${input.latestPostConstructionPermitDate}: ${
        input.permitScopeDescription ?? "structural alteration"
      }) post-dates LiDAR (${input.lidarAcquisitionYear}) or Street View (${
        input.streetViewCaptureDate
      }). Verify current structure before modeling ADU/SB 9 capacity.`,
    };
  }

  return {
    ...input,
    isLidarStale: false,
    isStreetViewStale: false,
    confidenceBadge: "verified_current",
    warningMessage: null,
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/lidarStreetViewValidator.ts"), "w", encoding="utf-8") as f:
    f.write(LIDAR)

print("Wrote src/engines/lidarStreetViewValidator.ts")

# 3. src/adapters/arcgisNormalizer.ts
ARCGIS = """const FIELD_ALIASES = {
  parcel_id: ["APN", "PARCEL_ID", "PARCELID", "PIN", "FOLIO", "TAX_ID", "PROP_ID", "SBL", "MAPBLOLOT", "GEO_ID", "AIN"],
  situs_address: ["SITUS_ADDR", "SITE_ADDR", "PROP_ADDR", "ADDRESS", "FULL_ADDR", "PHY_ADDR", "LOC_ADDR"],
  zoning_code: ["ZONING", "ZONE_CODE", "ZONING_CD", "ZONE_DIST", "BASE_ZONE", "MUN_ZONE", "LAND_USE_Z"],
  land_use_code: ["USE_CODE", "LAND_USE", "LU_CODE", "PROP_CLASS", "CLASS_CD", "DOR_UC", "STATE_USE"],
  assessed_total: ["ASSESSED_VAL", "TOT_ASSESS", "ASSD_VAL", "TAXABLE_VAL", "AV_TOTAL", "NET_VALUE", "SEV"],
  market_total: ["MARKET_VAL", "FULL_MKT_VAL", "JUST_VAL", "APPRAISED_VAL", "FCV", "TOTAL_VALUE"],
  owner_exempt_flag: ["EXEMPT_CD", "TAX_EXEMPT", "OWNER_TYPE", "GOV_OWNED", "PUBLIC_LAND", "EXEMPTION"],
  lot_sqft: ["LOT_SQFT", "GIS_SQFT", "AREA_SQFT", "LAND_SQFT", "SHAPE_Area"],
};

export function normalizeArcGisFeature(attributes: Record<string, unknown>) {
  const resolve = (keys: string[]) => {
    for (const k of keys) {
      const match = Object.keys(attributes).find((attr) => attr.toUpperCase() === k);
      if (match && attributes[match] !== null && attributes[match] !== "") {
        return attributes[match];
      }
    }
    return null;
  };

  return {
    parcel_id: String(resolve(FIELD_ALIASES.parcel_id) ?? "UNKNOWN"),
    situs_address: String(resolve(FIELD_ALIASES.situs_address) ?? ""),
    zoning_code: String(resolve(FIELD_ALIASES.zoning_code) ?? "UNZONED"),
    land_use_code: String(resolve(FIELD_ALIASES.land_use_code) ?? ""),
    assessed_total: Number(resolve(FIELD_ALIASES.assessed_total) ?? 0),
    market_total: Number(resolve(FIELD_ALIASES.market_total) ?? 0),
    owner_exempt_flag: Boolean(resolve(FIELD_ALIASES.owner_exempt_flag)),
    lot_sqft: Number(resolve(FIELD_ALIASES.lot_sqft) ?? 0),
  };
}
"""

with open(os.path.join(BASE_DIR, "src/adapters/arcgisNormalizer.ts"), "w", encoding="utf-8") as f:
    f.write(ARCGIS)

print("Wrote src/adapters/arcgisNormalizer.ts")

# 4. src/state/urlHashSync.ts
URL_HASH = """import { CountyDataCompleteness } from "../types";

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
"""

with open(os.path.join(BASE_DIR, "src/state/urlHashSync.ts"), "w", encoding="utf-8") as f:
    f.write(URL_HASH)

print("Wrote src/state/urlHashSync.ts")

# 5. src/ai/advisorGroundingContract.ts
ADVISOR = """import {
  CountyDataCompleteness,
  SolarMicrogridCalculation,
  StatutoryZoningResult,
} from "../types";
import { TaxIncrementOutput } from "../engines/municipalFinanceEngine";

export interface AdvisorContextPayload {
  county: CountyDataCompleteness;
  blockGroupGeoid: string;
  zoning?: StatutoryZoningResult;
  finance?: TaxIncrementOutput;
  solar?: SolarMicrogridCalculation;
  displacementRiskScore?: number;
}

export function buildGroundedAdvisorPrompt(
  userQuestion: string,
  ctx: AdvisorContextPayload
): { systemPrompt: string; userPrompt: string } {
  const activeExclusions = ctx.zoning
    ? Object.entries(ctx.zoning.statutory_exclusions)
        .filter(([, active]) => active)
        .map(([key]) => key)
    : [];

  const systemPrompt = [
    "You are the City Pretty Urban & Property Advisor.",
    "STRICT GROUNDING RULES:",
    "1. Cite ONLY numbers, statutes, tax-increment figures, and readiness tiers present in the JSON context below. Never invent zoning codes, millage rates, or local ordinances.",
    `2. Active jurisdiction readiness tier is "${ctx.county.readiness_tier}". If readiness_tier is NOT "audited_A", explicitly warn the user which datasets are preliminary or missing (e.g., zoning_source="${ctx.county.zoning_source}", crime_feed_status="${ctx.county.crime_feed_status}").`,
    activeExclusions.length > 0
      ? `3. CRITICAL STATUTORY EXCLUSIONS DETECTED: [${activeExclusions.join(", ")}]. You MUST warn that these overlays block or restrict automatic by-right preemption.`
      : "3. Verify local municipal historic/overlay amendments and private HOA CC&Rs before confirming by-right feasibility.",
    "4. Always end actionable recommendations with a brief non-reliance disclaimer noting that outputs are preliminary geospatial/economic models, not legal, engineering, or financial advice.",
  ].join("\n");

  const userPrompt = [
    "VERIFIED GEOSPATIAL & STATUTORY CONTEXT (JSON):",
    "```json",
    JSON.stringify(ctx, null, 2),
    "```",
    "",
    `USER QUESTION: ${userQuestion}`,
  ].join("\n");

  return { systemPrompt, userPrompt };
}
"""

with open(os.path.join(BASE_DIR, "src/ai/advisorGroundingContract.ts"), "w", encoding="utf-8") as f:
    f.write(ADVISOR)

print("Wrote src/ai/advisorGroundingContract.ts")

# 6. src/ui/lazyModals.ts
LAZY_MODALS = """export type ModalId =
  | "historical-audits"
  | "research-library"
  | "ai-advisor"
  | "accuracy-provenance"
  | "neighborhood-compare"
  | "methodology";

const MODAL_ENDPOINTS: Record<ModalId, string> = {
  "historical-audits": "/data/modals/historical_audits.json",
  "research-library": "/data/modals/study_library_540.json",
  "ai-advisor": "/data/modals/advisor_templates.json",
  "accuracy-provenance": "/data/modals/accuracy_provenance.json",
  "neighborhood-compare": "/data/modals/compare_schema.json",
  "methodology": "/data/modals/methodology_vintages.json",
};

const modalCache = new Map<ModalId, unknown>();

export async function openLazyModal(
  modalId: ModalId,
  containerEl: HTMLElement,
  renderFn: (data: unknown) => string
): Promise<void> {
  containerEl.hidden = false;
  containerEl.setAttribute("aria-busy", "true");

  if (!modalCache.has(modalId)) {
    containerEl.innerHTML = `<div class="modal-skeleton" role="status">Loading ${modalId.replace("-", " ")}…</div>`;
    const response = await fetch(MODAL_ENDPOINTS[modalId]);
    if (!response.ok) {
      containerEl.innerHTML = `<p role="alert">Failed to load dataset (${response.status}).</p>`;
      containerEl.setAttribute("aria-busy", "false");
      return;
    }
    const payload = await response.json();
    modalCache.set(modalId, payload);
  }

  containerEl.innerHTML = renderFn(modalCache.get(modalId));
  containerEl.setAttribute("aria-busy", "false");
}
"""

with open(os.path.join(BASE_DIR, "src/ui/lazyModals.ts"), "w", encoding="utf-8") as f:
    f.write(LAZY_MODALS)

print("Wrote src/ui/lazyModals.ts")

# 7. src/ui/countyCombobox.ts
COMBOBOX = """import { CountyDataCompleteness } from "../types";

export function mountAccessibleCountySelector(
  rootEl: HTMLElement,
  counties: CountyDataCompleteness[],
  activeFips: string,
  onSelect: (selected: CountyDataCompleteness) => void
): void {
  const sorted = [...counties].sort((a, b) => {
    if (a.state === "CA" && b.state !== "CA") return -1;
    if (a.state !== "CA" && b.state === "CA") return 1;
    return `${a.state}-${a.name}`.localeCompare(`${b.state}-${b.name}`);
  });

  const active = sorted.find((c) => c.fips === activeFips) ?? sorted[0];

  rootEl.innerHTML = `
    <label for="city-pretty-county-input" class="sr-only">Search County, Parish, or City</label>
    <input
      id="city-pretty-county-input"
      type="text"
      role="combobox"
      aria-expanded="false"
      aria-autocomplete="list"
      aria-controls="city-pretty-county-listbox"
      value="${active ? `${active.name}, ${active.state}` : "Los Angeles County, CA"}"
      placeholder="Search 637+ counties, parishes, cities…"
    />
    <ul id="city-pretty-county-listbox" role="listbox" hidden></ul>
  `;

  const inputEl = rootEl.querySelector<HTMLInputElement>("#city-pretty-county-input")!;
  const listEl = rootEl.querySelector<HTMLUListElement>("#city-pretty-county-listbox")!;

  const renderOptions = (query: string) => {
    const q = query.trim().toLowerCase();
    const matches = sorted
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.fips.startsWith(q)
      )
      .slice(0, 40);

    listEl.innerHTML = matches
      .map(
        (c) => `
        <li
          role="option"
          tabindex="-1"
          data-fips="${c.fips}"
          aria-selected="${c.fips === activeFips}"
        >
          <span>${c.name}, ${c.state}</span>
          <small>[${c.readiness_tier}]</small>
        </li>`
      )
      .join("");
    listEl.hidden = matches.length === 0;
    inputEl.setAttribute("aria-expanded", String(matches.length > 0));
  };

  inputEl.addEventListener("focus", () => renderOptions(""));
  inputEl.addEventListener("input", () => renderOptions(inputEl.value));

  listEl.addEventListener("click", (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLLIElement>("li[data-fips]");
    if (!li) return;
    const chosen = sorted.find((c) => c.fips === li.dataset.fips);
    if (chosen) {
      inputEl.value = `${chosen.name}, ${chosen.state}`;
      listEl.hidden = true;
      inputEl.setAttribute("aria-expanded", "false");
      onSelect(chosen);
    }
  });
}
"""

with open(os.path.join(BASE_DIR, "src/ui/countyCombobox.ts"), "w", encoding="utf-8") as f:
    f.write(COMBOBOX)

print("Wrote src/ui/countyCombobox.ts")

# 8. workers/api-proxy.ts
WORKER = """export interface Env {
  GOOGLE_MAPS_KEY: string;
  LLM_API_KEY: string;
}

const ALLOWED_ORIGIN = "https://milessilverman.github.io";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden Origin", { status: 403 });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/streetview") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      const heading = url.searchParams.get("heading") ?? "0";
      const upstream = `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${lat},${lng}&heading=${heading}&pitch=5&key=${env.GOOGLE_MAPS_KEY}`;
      const res = await fetch(upstream);
      return new Response(res.body, {
        headers: {
          "Content-Type": "image/jpeg",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Cache-Control": "public, max-age=604800",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
"""

with open(os.path.join(BASE_DIR, "workers/api-proxy.ts"), "w", encoding="utf-8") as f:
    f.write(WORKER)

print("Wrote workers/api-proxy.ts")
