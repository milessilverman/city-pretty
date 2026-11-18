// Live, official public-data connectors.
//
// Rule for everything in this file: a value either comes back from the named public source in this request, or it
// is null with the reason. Nothing here substitutes a "typical" number. Every result carries the exact URL that was
// queried and when, so the page and the AI advisor can cite it and anyone can re-run it.
//
// Sources (all free; only Census ACS needs a key, which is free at api.census.gov/data/key_signup.html):
//   Census Geocoder ........ address -> lat/lng; lat/lng -> state, county, tract, block group
//   Census ACS 5-year ...... median home value, median rent, income, tenure, etc. (needs CENSUS_API_KEY)
//   HUD Fair Market Rents .. current FY, per county, from HUD's FMR API (bundled file, refreshed by script)
//   USGS 3DEP (EPQS) ....... ground elevation at a point
//   FEMA NFHL .............. flood hazard zone at a point
//   OpenStreetMap Overpass . buildings (height / levels tags), parking lots, rail stations, etc. near a point

export type SourceRef = {
  name: string;
  publisher: string;
  url: string; // the exact request made
  retrieved_at: string; // ISO timestamp
  vintage?: string | null;
  license?: string;
};

export type Sourced<T> =
  | { ok: true; value: T; source: SourceRef; notes?: string[] }
  | { ok: false; value: null; source: SourceRef; error: string };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const UA = "city-pretty/1.0 (public-data lookups)";
const now = () => new Date().toISOString();

async function getJson(fetcher: FetchLike, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetcher(url, { signal: AbortSignal.timeout(20000), ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  const text = await res.text();
  if (text.includes("missing_key") || (text.trim().startsWith("<") && text.includes("key"))) {
    throw new Error("Census Data API requires a valid CENSUS_API_KEY (received missing_key response)");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${new URL(url).host}`);
  }
}

function fail<T>(source: SourceRef, e: unknown): Sourced<T> {
  return { ok: false, value: null, source, error: e instanceof Error ? e.message : String(e) };
}

function validLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------------------------------------------
// Census Geocoder
// ---------------------------------------------------------------------------------------------------------------

export type Geographies = {
  state_fips: string;
  county_fips: string; // 5-digit
  county_name: string;
  tract_geoid: string | null; // 11-digit
  block_group_geoid: string | null; // 12-digit (first 12 digits of the 2020 Census block GEOID)
  place_name: string | null; // incorporated city/town, if any
  place_geoid: string | null;
};

export async function censusGeographies(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<Geographies>> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates?" +
    new URLSearchParams({ x: String(lng), y: String(lat), benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" });
  const source: SourceRef = { name: "Census Geocoder (geographies)", publisher: "U.S. Census Bureau", url, retrieved_at: now(), vintage: "Current_Current" };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const g = d?.result?.geographies || {};
    const county = (g["Counties"] || [])[0];
    const tract = (g["Census Tracts"] || [])[0];
    const block = (g["2020 Census Blocks"] || [])[0];
    const place = (g["Incorporated Places"] || [])[0];
    if (!county) return fail(source, "Point is not inside a U.S. county");
    return {
      ok: true,
      source,
      value: {
        state_fips: county.STATE,
        county_fips: county.GEOID,
        county_name: county.NAME,
        tract_geoid: tract ? tract.GEOID : null,
        block_group_geoid: block && typeof block.GEOID === "string" && block.GEOID.length === 15 ? block.GEOID.slice(0, 12) : null,
        place_name: place ? place.NAME : null,
        place_geoid: place ? place.GEOID : null,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

export type AddressMatch = { matched_address: string; lat: number; lng: number };

const DIRS: Record<string, string> = { N: "N", NORTH: "N", S: "S", SOUTH: "S", E: "E", EAST: "E", W: "W", WEST: "W" };

// Compares the house number and the street's leading direction (N/S/E/W) of the requested and matched address.
export function addressMismatch(requested: string, matched: string): string | null {
  const tok = (a: string) => a.toUpperCase().replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  const r = tok(requested), m = tok(matched);
  if (/^\d/.test(r[0] || "") && /^\d/.test(m[0] || "") && r[0] !== m[0]) return `house number ${r[0]} vs ${m[0]}`;
  const rd = DIRS[r[1] || ""], md = DIRS[m[1] || ""];
  if (rd && md && rd !== md) return `street direction ${rd} vs ${md}`;
  if (rd && !md) return `direction ${rd} missing in match`;
  return null;
}

export async function geocodeAddress(address: string, fetcher: FetchLike = fetch): Promise<Sourced<AddressMatch>> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
    new URLSearchParams({ address: address.slice(0, 200), benchmark: "Public_AR_Current", format: "json" });
  const source: SourceRef = { name: "Census Geocoder (address)", publisher: "U.S. Census Bureau", url, retrieved_at: now() };
  try {
    const d = (await getJson(fetcher, url)) as any;
    const matches = d?.result?.addressMatches || [];
    if (!matches.length) return fail(source, "No address match");
    const m = matches[0];
    const out: Sourced<AddressMatch> = {
      ok: true,
      source,
      value: { matched_address: m.matchedAddress, lat: m.coordinates.y, lng: m.coordinates.x },
    };
    const notes: string[] = [];
    if (matches.length > 1) notes.push(`${matches.length} candidate matches; first used`);
    const mismatch = addressMismatch(address, m.matchedAddress);
    if (mismatch) notes.push(`WARNING: the Census Geocoder matched a different address (${mismatch}). Facts below are for "${m.matchedAddress}", not necessarily the address asked about.`);
    if (notes.length) out.notes = notes;
    return out;
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Census ACS 5-year (needs a free key)
// ---------------------------------------------------------------------------------------------------------------

// Variable IDs are from the ACS detailed tables. Labels are kept with the IDs so the AI never guesses what a code is.
export const ACS_VARIABLES: Record<string, string> = {
  B25077_001E: "Median value (dollars), owner-occupied housing units",
  B25064_001E: "Median gross rent (dollars)",
  B19013_001E: "Median household income in the past 12 months (dollars)",
  B01003_001E: "Total population",
  B25003_001E: "Occupied housing units (total)",
  B25003_002E: "Owner-occupied housing units",
  B25003_003E: "Renter-occupied housing units",
  B25001_001E: "Housing units (total)",
  B25002_003E: "Vacant housing units",
};

// ACS uses large negative sentinels (e.g. -666666666) for "not available"; those become null, never a number.
const acsValue = (v: unknown): number | null => {
  const n = num(v);
  return n === null || n < 0 ? null : n;
};

export type AcsResult = { geography: string; year: number; values: Record<string, { label: string; value: number | null }> };

export async function acs5(
  geo: { state: string; county: string; tract?: string; blockGroup?: string },
  year: number,
  apiKey: string | undefined,
  variables: string[] = Object.keys(ACS_VARIABLES),
  fetcher: FetchLike = fetch,
): Promise<Sourced<AcsResult>> {
  const vars = variables.filter((v) => v in ACS_VARIABLES);
  const params = new URLSearchParams({ get: ["NAME", ...vars].join(",") });
  let level = "county";
  if (geo.blockGroup && geo.tract) {
    params.set("for", `block group:${geo.blockGroup}`);
    params.set("in", `state:${geo.state} county:${geo.county} tract:${geo.tract}`);
    level = "block group";
  } else if (geo.tract) {
    params.set("for", `tract:${geo.tract}`);
    params.set("in", `state:${geo.state} county:${geo.county}`);
    level = "tract";
  } else {
    params.set("for", `county:${geo.county}`);
    params.set("in", `state:${geo.state}`);
  }
  const publicUrl = `https://api.census.gov/data/${year}/acs/acs5?${params}`;
  const source: SourceRef = {
    name: `American Community Survey 5-year estimates (${level})`,
    publisher: "U.S. Census Bureau",
    url: publicUrl, // the key is never put in the cited URL
    retrieved_at: now(),
    vintage: `${year - 4}-${year}`,
  };
  if (!apiKey) return fail(source, "CENSUS_API_KEY is not configured; ACS lookups are off until it is");
  try {
    const d = (await getJson(fetcher, `${publicUrl}&key=${encodeURIComponent(apiKey)}`)) as unknown[];
    if (!Array.isArray(d) || d.length < 2) return fail(source, "No ACS row returned");
    const [header, row] = d as string[][];
    const values: AcsResult["values"] = {};
    for (const v of vars) values[v] = { label: ACS_VARIABLES[v], value: acsValue(row[header.indexOf(v)]) };
    return { ok: true, source, value: { geography: row[header.indexOf("NAME")], year, values } };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// HUD Fair Market Rents
// ---------------------------------------------------------------------------------------------------------------

// HUD's current Fair Market Rents per county, pulled from HUD's FMR API (scripts/fetch_hud_fmr_api.py) and bundled
// with the Worker. HUD's map service, used earlier, still holds FY2026 as first published (audit 16 Nov 2026).
import HUD_FMR from "../app/data/hud_fair_market_rents.json" with { type: "json" };

type HudRecord = {
  fips: string; county_name: string; state_code: string; fiscal_year: number; metro_or_county_name: string | null;
  zero_bed_eff: number | null; one_bed_1br: number | null; two_bed_2br: number | null; three_bed_3br: number | null; four_bed_4br: number | null;
  two_bed_range?: number[]; towns?: unknown[]; sub_areas?: { area: string; fmr_area: string; two_bed_2br: number }[];
  small_area_fmr_metro?: boolean; verification: { status: string; notes?: string };
  zip_rents?: Record<string, { zero_bed_eff?: number; one_bed_1br?: number; two_bed_2br?: number; three_bed_3br?: number; four_bed_4br?: number }>;
};
const HUD_BY_FIPS = new Map<string, HudRecord>((HUD_FMR as unknown as { records: HudRecord[] }).records.map((r) => [r.fips, r]));
const HUD_SRC = (HUD_FMR as unknown as { _source: { fiscal_year: number; retrieved: string; federal_register?: string } })._source;
export const HUD_FMR_INFO_URL = "https://www.huduser.gov/portal/datasets/fmr.html";

export type HudFmr = {
  fiscal_year: number;
  fmr_area_name: string | null;
  rent_0br: number | null;
  rent_1br: number | null;
  rent_2br: number | null;
  rent_3br: number | null;
  rent_4br: number | null;
  rent_2br_range_by_town: number[] | null; // New England, where HUD sets FMRs by town
};

export function hudFairMarketRentForCounty(countyFips: string, zipCode?: string): Sourced<HudFmr> {
  const source: SourceRef = {
    name: `HUD Fair Market Rents FY${HUD_SRC.fiscal_year}`,
    publisher: "U.S. Department of Housing and Urban Development (PD&R), FMR API",
    url: HUD_FMR_INFO_URL,
    retrieved_at: HUD_SRC.retrieved,
    vintage: `FY${HUD_SRC.fiscal_year}${HUD_SRC.federal_register ? " (Federal Register " + HUD_SRC.federal_register + ")" : ""}`,
  };
  const r = HUD_BY_FIPS.get(String(countyFips || "").padStart(5, "0"));
  if (!r || r.verification.status !== "verified") return fail(source, "No HUD Fair Market Rent on file for this county");
  const notes = ["FMRs are HUD's 40th-percentile gross rent (rent + utilities) for voucher payment standards; they are not market asking rents."];
  if (r.verification.notes) notes.push(r.verification.notes);

  if (zipCode && r.zip_rents && r.zip_rents[zipCode]) {
    const zr = r.zip_rents[zipCode];
    notes.push(`HUD Small Area Fair Market Rent (SAFMR) for ZIP ${zipCode}.`);
    return {
      ok: true,
      source,
      value: {
        fiscal_year: r.fiscal_year,
        fmr_area_name: `ZIP ${zipCode} Small Area FMR (${r.metro_or_county_name || r.county_name})`,
        rent_0br: zr.zero_bed_eff ?? null,
        rent_1br: zr.one_bed_1br ?? null,
        rent_2br: zr.two_bed_2br ?? null,
        rent_3br: zr.three_bed_3br ?? null,
        rent_4br: zr.four_bed_4br ?? null,
        rent_2br_range_by_town: null,
      },
      notes,
    };
  }

  return {
    ok: true,
    source,
    value: {
      fiscal_year: r.fiscal_year,
      fmr_area_name: r.metro_or_county_name,
      rent_0br: r.zero_bed_eff, rent_1br: r.one_bed_1br, rent_2br: r.two_bed_2br, rent_3br: r.three_bed_3br, rent_4br: r.four_bed_4br,
      rent_2br_range_by_town: r.two_bed_range || null,
    },
    notes,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// USGS elevation (3DEP via the Elevation Point Query Service)
// ---------------------------------------------------------------------------------------------------------------

export async function usgsElevation(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<{ elevation_ft: number; resolution_m: number | null }>> {
  const url = "https://epqs.nationalmap.gov/v1/json?" + new URLSearchParams({ x: String(lng), y: String(lat), units: "Feet", wkid: "4326" });
  const source: SourceRef = { name: "USGS Elevation Point Query Service (3DEP)", publisher: "U.S. Geological Survey", url, retrieved_at: now() };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const v = num(d?.value);
    // EPQS returns -1000000 for "no data" (e.g. offshore).
    if (v === null || v <= -100000) return fail(source, "No elevation data at this point");
    return { ok: true, source, value: { elevation_ft: v, resolution_m: num(d?.resolution) } };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FEMA National Flood Hazard Layer
// ---------------------------------------------------------------------------------------------------------------

export type FloodZone = { zone: string; zone_subtype: string | null; special_flood_hazard_area: boolean };

export async function femaFloodZone(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<FloodZone>> {
  const url =
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?" +
    new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      returnGeometry: "false",
      f: "json",
    });
  const source: SourceRef = { name: "FEMA National Flood Hazard Layer (flood hazard zones)", publisher: "Federal Emergency Management Agency", url, retrieved_at: now() };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    if (d?.error) return fail(source, d.error.message || "ArcGIS error");
    const f = d?.features?.[0]?.attributes;
    // No polygon means FEMA has no effective digital flood map here. That is "unmapped", not "safe".
    if (!f) return fail(source, "No effective FEMA flood map covers this point (unmapped, not 'no risk')");
    return { ok: true, source, value: { zone: f.FLD_ZONE, zone_subtype: f.ZONE_SUBTY || null, special_flood_hazard_area: f.SFHA_TF === "T" } };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FEMA National Risk Index (NRI) Census Tracts
// ---------------------------------------------------------------------------------------------------------------

export type NationalRiskIndex = {
  tract_fips: string;
  risk_score: number | null;
  risk_rating: string | null;
  eal_score: number | null;
  eal_rating: string | null;
  social_vulnerability_rating: string | null;
  community_resilience_rating: string | null;
  earthquake_rating: string | null;
  wildfire_rating: string | null;
  flood_rating: string | null;
  hurricane_rating: string | null;
};

export async function femaNationalRiskIndex(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<NationalRiskIndex>> {
  const url =
    "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query?" +
    new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "TRACTFIPS,RISK_SCORE,RISK_RATNG,EAL_SCORE,EAL_RATNG,SOVI_RATNG,RESL_RATNG,WFIR_RISKR,ERQK_RISKR,HRCN_RISKR,IFLD_RISKR",
      returnGeometry: "false",
      f: "json",
    });
  const source: SourceRef = {
    name: "FEMA National Risk Index (Census Tracts)",
    publisher: "Federal Emergency Management Agency (FEMA)",
    url,
    retrieved_at: now(),
    vintage: "December 2025 release",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    if (d?.error) return fail(source, d.error.message || "ArcGIS error");
    const f = d?.features?.[0]?.attributes;
    if (!f) return fail(source, "No FEMA National Risk Index record found for this location");
    return {
      ok: true,
      source,
      value: {
        tract_fips: f.TRACTFIPS,
        risk_score: num(f.RISK_SCORE),
        risk_rating: f.RISK_RATNG || null,
        eal_score: num(f.EAL_SCORE),
        eal_rating: f.EAL_RATNG || null,
        social_vulnerability_rating: f.SOVI_RATNG || null,
        community_resilience_rating: f.RESL_RATNG || null,
        earthquake_rating: f.ERQK_RISKR || null,
        wildfire_rating: f.WFIR_RISKR || null,
        flood_rating: f.IFLD_RISKR || null,
        hurricane_rating: f.HRCN_RISKR || null,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// USGS ASCE 7-22 Seismic Design
// ---------------------------------------------------------------------------------------------------------------

export type SeismicDesign = {
  seismic_design_category: string | null;
  pga_m: number | null;
  sds: number | null;
  sd1: number | null;
  ss: number | null;
  s1: number | null;
};

export async function usgsSeismicDesign(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<SeismicDesign>> {
  const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lng}&riskCategory=II&siteClass=D&title=CityPretty`;
  const source: SourceRef = {
    name: "USGS Seismic Design Maps (ASCE 7-22)",
    publisher: "U.S. Geological Survey (USGS)",
    url,
    retrieved_at: now(),
    vintage: "ASCE 7-22 standard",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const data = d?.response?.data;
    if (!data) return fail(source, "No seismic data returned by USGS for this coordinate");
    return {
      ok: true,
      source,
      value: {
        seismic_design_category: data.sdc || null,
        pga_m: num(data.pgam),
        sds: num(data.sds),
        sd1: num(data.sd1),
        ss: num(data.ss),
        s1: num(data.s1),
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// NLR PVWatts v8 Solar Photovoltaic Energy Model
// ---------------------------------------------------------------------------------------------------------------

export type PvWattsResult = {
  ac_annual_kwh: number | null;
  solrad_annual: number | null;
  capacity_factor_pct: number | null;
  system_capacity_kw: number;
};

export async function pvwattsV8(
  lat: number,
  lng: number,
  systemCapacityKw: number,
  opts: { tiltDeg?: number; azimuthDeg?: number; apiKey?: string; fetcher?: FetchLike } = {}
): Promise<Sourced<PvWattsResult>> {
  const f = opts.fetcher || fetch;
  const key = opts.apiKey || "DEMO_KEY";
  const tilt = opts.tiltDeg ?? 20;
  const azimuth = opts.azimuthDeg ?? 180;
  const kw = Math.max(0.1, Number(systemCapacityKw.toFixed(2)));
  const params = new URLSearchParams({
    api_key: key,
    lat: String(lat),
    lon: String(lng),
    system_capacity: String(kw),
    azimuth: String(azimuth),
    tilt: String(tilt),
    array_type: "1", // fixed roof mount
    module_type: "0", // standard
    losses: "14",
  });
  const publicUrl = `https://developer.nlr.gov/api/pvwatts/v8.json?lat=${lat}&lon=${lng}&system_capacity=${kw}&azimuth=${azimuth}&tilt=${tilt}&array_type=1&module_type=0&losses=14`;
  const source: SourceRef = {
    name: "NLR PVWatts v8 (Solar Photovoltaic Energy Model)",
    publisher: "National Laboratory for Renewable Energy (NLR)",
    url: publicUrl,
    retrieved_at: now(),
    vintage: "PVWatts v8.5.0",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(f, `https://developer.nlr.gov/api/pvwatts/v8.json?${params}`)) as any;
    if (d?.errors && d.errors.length) return fail(source, d.errors.join("; "));
    const out = d?.outputs;
    if (!out || out.ac_annual == null) return fail(source, "No PVWatts energy yield returned");
    return {
      ok: true,
      source,
      value: {
        ac_annual_kwh: Math.round(out.ac_annual),
        solrad_annual: num(out.solrad_annual),
        capacity_factor_pct: num(out.capacity_factor),
        system_capacity_kw: kw,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Geodetic Distance Helper
// ---------------------------------------------------------------------------------------------------------------

export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------------------------------------------
// CDC PLACES (Local Data for Better Health: Census Tract Data)
// ---------------------------------------------------------------------------------------------------------------

export type CdcPlacesHealth = {
  tract_fips: string;
  population: number | null;
  measures: Record<string, { label: string; value_pct: number; unit: string; confidence_interval?: [number, number] }>;
};

export async function cdcPlacesTractHealth(
  tractFips: string,
  fetcher: FetchLike = fetch
): Promise<Sourced<CdcPlacesHealth>> {
  const cleanFips = String(tractFips || "").replace(/\D/g, "");
  const url = `https://chronicdata.cdc.gov/resource/cwsq-ngmh.json?locationid=${cleanFips}&$limit=50`;
  const source: SourceRef = {
    name: "CDC PLACES (Local Data for Better Health: Census Tract Data)",
    publisher: "Centers for Disease Control and Prevention (CDC)",
    url,
    retrieved_at: now(),
    vintage: "PLACES 2025 Release (BRFSS 2022-2023)",
  };
  if (cleanFips.length !== 11) return fail(source, `Invalid 11-digit Census tract FIPS: ${tractFips}`);
  try {
    const rows = (await getJson(fetcher, url)) as any[];
    if (!Array.isArray(rows) || !rows.length) return fail(source, "No CDC PLACES health data found for this tract");
    const measures: CdcPlacesHealth["measures"] = {};
    let pop: number | null = null;
    for (const r of rows) {
      if (!r.measureid || r.data_value == null) continue;
      if (pop == null && r.totalpopulation) pop = Number(r.totalpopulation);
      measures[r.measureid] = {
        label: r.short_question_text || r.measure || r.measureid,
        value_pct: Number(r.data_value),
        unit: r.data_value_unit || "%",
        confidence_interval:
          r.low_confidence_limit != null && r.high_confidence_limit != null
            ? [Number(r.low_confidence_limit), Number(r.high_confidence_limit)]
            : undefined,
      };
    }
    return {
      ok: true,
      source,
      value: {
        tract_fips: cleanFips,
        population: pop,
        measures,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// NCES EDGE Public School Locations
// ---------------------------------------------------------------------------------------------------------------

export type NcesSchool = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  distance_m?: number;
};

export type NcesNearbySchoolsResult = {
  count: number;
  schools: NcesSchool[];
};

export async function ncesNearbySchools(
  lat: number,
  lng: number,
  radiusM: number = 2000,
  fetcher: FetchLike = fetch
): Promise<Sourced<NcesNearbySchoolsResult>> {
  const url = `https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${radiusM}&units=esriSRUnit_Meter&outFields=NAME,STREET,CITY,STATE,ZIP,LAT,LON&returnGeometry=false&f=json`;
  const source: SourceRef = {
    name: "NCES EDGE Public School Locations",
    publisher: "National Center for Education Statistics (NCES)",
    url,
    retrieved_at: now(),
    vintage: "Current 2023-2024 School Year",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const feats = Array.isArray(d?.features) ? d.features : [];
    const schools: NcesSchool[] = [];
    for (const f of feats) {
      const a = f.attributes || {};
      if (!a.NAME) continue;
      const sLat = num(a.LAT);
      const sLon = num(a.LON);
      const dist = sLat != null && sLon != null ? Math.round(haversineDistanceM(lat, lng, sLat, sLon)) : undefined;
      schools.push({
        name: String(a.NAME).trim(),
        address: String(a.STREET || "").trim(),
        city: String(a.CITY || "").trim(),
        state: String(a.STATE || "").trim(),
        zip: String(a.ZIP || "").trim(),
        lat: sLat ?? 0,
        lng: sLon ?? 0,
        distance_m: dist,
      });
    }
    schools.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
    return {
      ok: true,
      source,
      value: {
        count: schools.length,
        schools,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Google Solar API buildingInsights
// ---------------------------------------------------------------------------------------------------------------

export type GoogleSolarRoofSegment = {
  pitch_degrees: number;
  azimuth_degrees: number;
  area_m2: number;
  center?: { lat: number; lng: number };
};

export type GoogleSolarInsights = {
  imagery_date: string | null;
  roof_area_m2: number | null;
  roof_segments: GoogleSolarRoofSegment[];
  max_panels_count: number | null;
  carbon_offset_factor_kg_per_mwh?: number | null;
};

export async function googleSolarBuildingInsights(
  lat: number,
  lng: number,
  apiKey: string | undefined,
  fetcher: FetchLike = fetch
): Promise<Sourced<GoogleSolarInsights>> {
  const publicUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE`;
  const source: SourceRef = {
    name: "Google Solar API (buildingInsights)",
    publisher: "Google Maps Platform",
    url: publicUrl,
    retrieved_at: now(),
    vintage: "High-resolution 3D aerial modeling (terms: solar feasibility only, 30-day max cache)",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  if (!apiKey) return fail(source, "GOOGLE_SOLAR_API_KEY is not configured");
  try {
    const d = (await getJson(fetcher, `${publicUrl}&key=${encodeURIComponent(apiKey)}`)) as any;
    if (d?.error) return fail(source, d.error.message || "Google Solar API returned an error");
    const pot = d?.solarPotential;
    if (!pot) return fail(source, "No solar potential data returned for this location");
    const segments: GoogleSolarRoofSegment[] = (pot.roofSegmentStats || []).map((s: any) => ({
      pitch_degrees: num(s.pitchDegrees) ?? 0,
      azimuth_degrees: num(s.azimuthDegrees) ?? 0,
      area_m2: num(s.stats?.areaMeters2) ?? 0,
      center: s.center ? { lat: s.center.latitude, lng: s.center.longitude } : undefined,
    }));
    const imgDate = d.imageryDate ? `${d.imageryDate.year}-${String(d.imageryDate.month).padStart(2, "0")}-${String(d.imageryDate.day).padStart(2, "0")}` : null;
    return {
      ok: true,
      source,
      value: {
        imagery_date: imgDate,
        roof_area_m2: num(pot.wholeRoofStats?.areaMeters2),
        roof_segments: segments,
        max_panels_count: pot.maxArrayPanelsCount != null ? Number(pot.maxArrayPanelsCount) : null,
        carbon_offset_factor_kg_per_mwh: num(pot.carbonOffsetFactorKgPerMwh),
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FHWA National Highway Construction Cost Index (NHCCI)
// ---------------------------------------------------------------------------------------------------------------

export type NhcciResult = {
  quarter: string;
  nhcci: number;
  nhcci_seasonally_adjusted: number | null;
  base_year_2024_adjustment_factor: number;
};

// Base 2024 Q1 index: 3.191321352
const NHCCI_2024_Q1_BASE = 3.191321352;

export async function fhwaNhcci(
  quarter?: string,
  fetcher: FetchLike = fetch
): Promise<Sourced<NhcciResult>> {
  const url = quarter
    ? `https://data.transportation.gov/resource/r94d-n4f9.json?quarter=${encodeURIComponent(quarter)}`
    : `https://data.transportation.gov/resource/r94d-n4f9.json?$limit=1&$order=quarter%20desc`;
  const source: SourceRef = {
    name: "FHWA National Highway Construction Cost Index (NHCCI)",
    publisher: "Federal Highway Administration (FHWA)",
    url,
    retrieved_at: now(),
    vintage: "data.transportation.gov dataset r94d-n4f9",
  };
  try {
    const rows = (await getJson(fetcher, url)) as any[];
    if (!Array.isArray(rows) || !rows.length) return fail(source, "No NHCCI index row returned");
    const r = rows[0];
    const val = num(r.nhcci);
    if (val == null) return fail(source, "Missing numeric nhcci value");
    return {
      ok: true,
      source,
      value: {
        quarter: String(r.quarter || ""),
        nhcci: val,
        nhcci_seasonally_adjusted: num(r.nhcci_seasonally_adjusted),
        base_year_2024_adjustment_factor: Number((val / NHCCI_2024_Q1_BASE).toFixed(4)),
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FHFA House Price Index (tract-level annual)
// ---------------------------------------------------------------------------------------------------------------

export type FhfaHpiPoint = {
  year: number;
  hpi: number;
  annual_change_pct: number | null;
  hpi2000?: number | null;
};

export type FhfaTractHpiResult = {
  tract_fips: string;
  state_abbr?: string | null;
  latest_year: number;
  latest_hpi: number;
  annual_change_pct: number | null;
  five_year_appreciation_pct: number | null;
  five_year_cagr_pct: number | null;
  ten_year_appreciation_pct: number | null;
  history: FhfaHpiPoint[];
};

export const FHFA_HPI_URL = "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv";

export async function fhfaTractHpi(
  tractFips: string,
  fetcher: FetchLike = fetch,
  urlOverride?: string
): Promise<Sourced<FhfaTractHpiResult>> {
  const cleanFips = String(tractFips || "").replace(/\D/g, "");
  const url = urlOverride || FHFA_HPI_URL;
  const source: SourceRef = {
    name: "FHFA House Price Index (tract-level annual)",
    publisher: "Federal Housing Finance Agency (FHFA)",
    url,
    retrieved_at: now(),
    vintage: "Annual Tract-Level HPI (1975–present)",
  };
  if (cleanFips.length !== 11) return fail(source, `Invalid 11-digit Census tract FIPS: ${tractFips}`);

  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": UA, Accept: "application/json, text/csv, text/plain" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    const text = await res.text();

    let records: Array<{ tract: string; state_abbr?: string; year: number; annual_change: number | null; hpi: number; hpi2000?: number | null }> = [];
    const trimmed = text.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed.records || parsed.data || [];
      records = arr
        .filter((r: any) => String(r.tract || "").replace(/\D/g, "") === cleanFips)
        .map((r: any) => ({
          tract: cleanFips,
          state_abbr: r.state_abbr || r.state,
          year: Number(r.year),
          annual_change: num(r.annual_change ?? r.annual_change_pct),
          hpi: num(r.hpi) ?? 0,
          hpi2000: num(r.hpi2000),
        }));
    } else {
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.includes(cleanFips)) continue;
        const parts = line.split(",").map((p) => p.trim());
        if (parts[0] === cleanFips) {
          records.push({
            tract: cleanFips,
            state_abbr: parts[1] || undefined,
            year: Number(parts[2]),
            annual_change: num(parts[3]),
            hpi: num(parts[4]) ?? 0,
            hpi2000: num(parts[6]),
          });
        }
      }
    }

    if (!records.length) return fail(source, `No FHFA HPI records found for tract ${cleanFips}`);

    records.sort((a, b) => a.year - b.year);

    const history: FhfaHpiPoint[] = records.map((r) => ({
      year: r.year,
      hpi: r.hpi,
      annual_change_pct: r.annual_change,
      hpi2000: r.hpi2000,
    }));

    const latest = history[history.length - 1];
    const latestYear = latest.year;
    const latestHpi = latest.hpi;

    const prior1 = history.find((p) => p.year === latestYear - 1);
    const annualChange = latest.annual_change_pct != null
      ? latest.annual_change_pct
      : prior1 && prior1.hpi > 0
      ? Number((((latestHpi - prior1.hpi) / prior1.hpi) * 100).toFixed(2))
      : null;

    const prior5 = history.find((p) => p.year === latestYear - 5);
    const fiveYearAppreciation = prior5 && prior5.hpi > 0
      ? Number((((latestHpi - prior5.hpi) / prior5.hpi) * 100).toFixed(2))
      : null;
    const fiveYearCagr = prior5 && prior5.hpi > 0 && latestHpi > 0
      ? Number(((Math.pow(latestHpi / prior5.hpi, 1 / 5) - 1) * 100).toFixed(2))
      : null;

    const prior10 = history.find((p) => p.year === latestYear - 10);
    const tenYearAppreciation = prior10 && prior10.hpi > 0
      ? Number((((latestHpi - prior10.hpi) / prior10.hpi) * 100).toFixed(2))
      : null;

    return {
      ok: true,
      source,
      value: {
        tract_fips: cleanFips,
        state_abbr: records[0].state_abbr || null,
        latest_year: latestYear,
        latest_hpi: latestHpi,
        annual_change_pct: annualChange,
        five_year_appreciation_pct: fiveYearAppreciation,
        five_year_cagr_pct: fiveYearCagr,
        ten_year_appreciation_pct: tenYearAppreciation,
        history,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// EPA National Walkability Index
// ---------------------------------------------------------------------------------------------------------------

export type EpaWalkabilityResult = {
  block_group_fips: string;
  walkability_index: number;
  category: "Least Walkable" | "Below Average Walkable" | "Above Average Walkable" | "Most Walkable";
  rankings?: {
    intersection_density_rank?: number;
    land_use_mix_rank?: number;
    employment_diversity_rank?: number;
    transit_commute_rank?: number;
  };
};

export async function epaWalkabilityIndex(
  lat: number,
  lng: number,
  fetcher: FetchLike = fetch
): Promise<Sourced<EpaWalkabilityResult>> {
  const url = `https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID20,GEOID10,NatWalkInd,D3B_Ranked,D2A_Ranked,D2B_Ranked,D4A_Ranked&returnGeometry=false&f=json`;
  const source: SourceRef = {
    name: "EPA National Walkability Index",
    publisher: "U.S. Environmental Protection Agency (EPA)",
    url,
    retrieved_at: now(),
    vintage: "2021 Release (Census 2020 / Smart Location Database)",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const feat = d?.features?.[0];
    if (!feat || !feat.attributes) return fail(source, "No EPA Walkability Index feature found for coordinates");
    const a = feat.attributes;
    const rawScore = num(a.NatWalkInd);
    if (rawScore == null) return fail(source, "No NatWalkInd score returned");
    const score = Number(rawScore.toFixed(2));
    let category: EpaWalkabilityResult["category"];
    if (score <= 5.75) category = "Least Walkable";
    else if (score <= 10.5) category = "Below Average Walkable";
    else if (score <= 15.25) category = "Above Average Walkable";
    else category = "Most Walkable";

    return {
      ok: true,
      source,
      value: {
        block_group_fips: String(a.GEOID20 || a.GEOID10 || "").trim(),
        walkability_index: score,
        category,
        rankings: {
          intersection_density_rank: num(a.D3B_Ranked) ?? undefined,
          land_use_mix_rank: num(a.D2A_Ranked) ?? undefined,
          employment_diversity_rank: num(a.D2B_Ranked) ?? undefined,
          transit_commute_rank: num(a.D4A_Ranked) ?? undefined,
        },
      },
      notes: [
        `EPA Walkability Index: ${score} / 20 (${category}). Quantile scores reflect intersection density, diversity of land uses, and transit commute mode split.`,
      ],
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// NOAA Sea Level Rise Screening
// ---------------------------------------------------------------------------------------------------------------

export type NoaaSlrResult = {
  scenario_ft: number;
  in_low_lying_slr_area: boolean;
  layer_name?: string;
  notes: string;
};

export async function noaaSeaLevelRise(
  lat: number,
  lng: number,
  scenarioFt: number = 1,
  fetcher: FetchLike = fetch
): Promise<Sourced<NoaaSlrResult>> {
  const allowed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ft = allowed.includes(scenarioFt) ? scenarioFt : 1;
  const url = `https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_${ft}ft/MapServer/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=top&tolerance=1&mapExtent=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&imageDisplay=400,400,96&returnGeometry=false&f=json`;
  const source: SourceRef = {
    name: `NOAA Sea Level Rise (${ft}ft Scenario)`,
    publisher: "National Oceanic and Atmospheric Administration (NOAA) Office for Coastal Management",
    url,
    retrieved_at: now(),
    vintage: "NOAA SLR Inundation Viewer (CORS enabled)",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    const results = Array.isArray(d?.results) ? d.results : [];
    const isIn = results.length > 0;
    const topLayer = results[0]?.layerName || undefined;
    return {
      ok: true,
      source,
      value: {
        scenario_ft: ft,
        in_low_lying_slr_area: isIn,
        layer_name: topLayer,
        notes: isIn
          ? `Point intersects NOAA ${ft}ft Sea Level Rise inundation / low-lying zone.`
          : `Point does not intersect NOAA ${ft}ft Sea Level Rise inundation zone.`,
      },
    };
  } catch (e) {
    return fail(source, e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// OpenStreetMap via Overpass
// ---------------------------------------------------------------------------------------------------------------

export const OSM_FEATURES = {
  buildings: 'way["building"]',
  parking_lots: 'nwr["amenity"="parking"]',
  rail_stations: 'node["railway"="station"]',
  transit_stops: 'node["public_transport"="platform"]',
  parks: 'nwr["leisure"="park"]',
  golf_courses: 'nwr["leisure"="golf_course"]',
  ev_chargers: 'node["amenity"="charging_station"]',
  power_lines: 'way["power"="line"]',
  bike_lanes: 'bike_lanes',
} as const;
export type OsmFeatureKind = keyof typeof OSM_FEATURES;

export type OsmElement = {
  osm_type: string;
  osm_id: number;
  lat: number | null;
  lng: number | null;
  name: string | null;
  tags: Record<string, string>;
  // Building height straight from OSM tags. levels -> height is NOT converted here: that is an estimate, and the
  // caller must label it as one if it does.
  height_m: number | null;
  levels: number | null;
};

export function parseOsmHeight(val: string | null | undefined): number | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const ftInMatch = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/);
  if (ftInMatch) {
    const feet = parseFloat(ftInMatch[1]);
    const inches = ftInMatch[2] ? parseFloat(ftInMatch[2]) : 0;
    const m = (feet * 0.3048) + (inches * 0.0254);
    return Number.isFinite(m) && m > 0 ? Math.round(m * 100) / 100 : null;
  }
  const ftMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/i);
  if (ftMatch) {
    const feet = parseFloat(ftMatch[1]);
    const m = feet * 0.3048;
    return Number.isFinite(m) && m > 0 ? Math.round(m * 100) / 100 : null;
  }
  const mMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?$/i);
  if (mMatch) {
    const m = parseFloat(mMatch[1]);
    return Number.isFinite(m) && m > 0 ? Math.round(m * 100) / 100 : null;
  }
  return null;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export async function osmNearby(
  lat: number,
  lng: number,
  radiusM: number,
  kind: OsmFeatureKind,
  fetcher: FetchLike = fetch,
  limit = 200,
): Promise<Sourced<{ count: number; truncated: boolean; elements: OsmElement[] }>> {
  const r = Math.max(10, Math.min(2000, Math.round(radiusM)));
  const n = Math.max(1, Math.min(500, limit));
  const around = `(around:${r},${lat},${lng})`;
  const queryBody = (kind === "bike_lanes")
    ? `(way["highway"="cycleway"]${around};way["cycleway"~"^(lane|track)$"]${around};way["cycleway:left"~"^(lane|track)$"]${around};way["cycleway:right"~"^(lane|track)$"]${around};way["cycleway:both"~"^(lane|track)$"]${around};);`
    : `${OSM_FEATURES[kind]}${around};`;
  const query = `[out:json][timeout:25];${queryBody}out center tags ${n + 1};`;
  let lastErr: unknown = null;
  for (const ep of OVERPASS_ENDPOINTS) {
    const url = `${ep}?data=${encodeURIComponent(query)}`;
    const source: SourceRef = {
      name: `OpenStreetMap (${kind} within ${r} m)`,
      publisher: "OpenStreetMap contributors via Overpass API",
      url,
      retrieved_at: now(),
      license: "ODbL 1.0 — attribution required: © OpenStreetMap contributors",
    };
    if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
    try {
      const d = (await getJson(fetcher, url)) as any;
      const els: any[] = d?.elements || [];
      const elements: OsmElement[] = els.slice(0, n).map((e) => {
        const tags: Record<string, string> = e.tags || {};
        return {
          osm_type: e.type,
          osm_id: e.id,
          lat: num(e.lat ?? e.center?.lat),
          lng: num(e.lon ?? e.center?.lon),
          name: tags.name || null,
          tags,
          height_m: parseOsmHeight(tags.height),
          levels: num(tags["building:levels"]),
        };
      });
      const out: Sourced<{ count: number; truncated: boolean; elements: OsmElement[] }> = {
        ok: true,
        source,
        value: { count: elements.length, truncated: els.length > n, elements },
        notes: ["OpenStreetMap is volunteer-mapped: absence of a feature does not prove it is absent on the ground."],
      };
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  return fail(
    { name: `OpenStreetMap (${kind})`, publisher: "OpenStreetMap contributors via Overpass API", url: OVERPASS_ENDPOINTS[0], retrieved_at: now() },
    lastErr,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One call for "everything we can source about this point"
// ---------------------------------------------------------------------------------------------------------------

// Dynamic default ACS vintage: ACS 5-year data releases around December each year (e.g. 2021-25 release in Dec 2026).
export const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
export const DEFAULT_ACS_YEAR = Math.max(2024, CURRENT_CALENDAR_YEAR - (new Date().getMonth() >= 11 ? 1 : 2));

export async function siteFacts(lat: number, lng: number, opts: { censusApiKey?: string; acsYear?: number; fetcher?: FetchLike } = {}) {
  const f = opts.fetcher || fetch;
  const [geo, elev, flood, nri, seismic, schools, walkability, slr] = await Promise.all([
    censusGeographies(lat, lng, f),
    usgsElevation(lat, lng, f),
    femaFloodZone(lat, lng, f),
    femaNationalRiskIndex(lat, lng, f),
    usgsSeismicDesign(lat, lng, f),
    ncesNearbySchools(lat, lng, 2000, f),
    epaWalkabilityIndex(lat, lng, f),
    noaaSeaLevelRise(lat, lng, 1, f),
  ]);
  const fmr: Sourced<HudFmr> = geo.ok
    ? hudFairMarketRentForCounty(geo.value.county_fips)
    : fail({ name: "HUD Fair Market Rents", publisher: "HUD", url: HUD_FMR_INFO_URL, retrieved_at: now() }, "County unknown (Census lookup failed)");
  let acs: Sourced<AcsResult> | null = null;
  let health: Sourced<CdcPlacesHealth> | null = null;
  if (geo.ok && geo.value.tract_geoid) {
    [acs, health] = await Promise.all([
      acs5(
        { state: geo.value.state_fips, county: geo.value.county_fips.slice(2), tract: geo.value.tract_geoid.slice(5) },
        opts.acsYear || DEFAULT_ACS_YEAR,
        opts.censusApiKey,
        undefined,
        f,
      ),
      cdcPlacesTractHealth(geo.value.tract_geoid, f),
    ]);
  }
  return {
    lat,
    lng,
    geographies: geo,
    hud_fair_market_rent: fmr,
    elevation: elev,
    flood_zone: flood,
    national_risk_index: nri,
    seismic_design: seismic,
    nearby_schools: schools,
    walkability,
    sea_level_rise: slr,
    health_profile: health,
    acs_tract: acs,
  };
}
