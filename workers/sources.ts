// Live, official public-data connectors.
//
// Rule for everything in this file: a value either comes back from the named public source in this request, or it
// is null with the reason. Nothing here substitutes a "typical" number. Every result carries the exact URL that was
// queried and when, so the page and the AI advisor can cite it and anyone can re-run it.
//
// Sources (all free; only Census ACS needs a key, which is free at api.census.gov/data/key_signup.html):
//   Census Geocoder ........ address -> lat/lng; lat/lng -> state, county, tract, block group
//   Census ACS 5-year ...... median home value, median rent, income, tenure, etc. (needs CENSUS_API_KEY)
//   HUD Fair Market Rents .. HUD's published FMR polygons (ArcGIS service run by HUD PD&R)
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

// Federal Register revisions HUD published but never loaded into its map service, and the notice that superseded FY2026.
import HUD_FMR_REVISIONS from "../app/data/hud_fmr_revisions.json" with { type: "json" };

export const HUD_FMR_LAYER = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Fair_Market_Rents/FeatureServer/0";

export type HudFmr = {
  fmr_area_code: string;
  fmr_area_name: string;
  rent_0br: number | null;
  rent_1br: number | null;
  rent_2br: number | null;
  rent_3br: number | null;
  rent_4br: number | null;
};

export async function hudFairMarketRent(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<Sourced<HudFmr>> {
  const url =
    `${HUD_FMR_LAYER}/query?` +
    new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FMR_CODE,FMR_AREANAME,FMR_0BDR,FMR_1BDR,FMR_2BDR,FMR_3BDR,FMR_4BDR",
      returnGeometry: "false",
      f: "json",
    });
  const source: SourceRef = {
    name: "HUD Fair Market Rents",
    publisher: "U.S. Department of Housing and Urban Development (PD&R)",
    url,
    retrieved_at: now(),
    // Checked 2026-11-16 against the Federal Register: FY2026 as first published (see app/data/hud_fmr_revisions.json).
    vintage: "FY2026 (HUD map service; FY2027 took effect 2026-10-01 and is not in the service)",
  };
  if (!validLatLng(lat, lng)) return fail(source, "Invalid coordinates");
  try {
    const d = (await getJson(fetcher, url)) as any;
    if (d?.error) return fail(source, d.error.message || "ArcGIS error");
    const f = d?.features?.[0]?.attributes;
    if (!f) return fail(source, "Point is not inside any HUD FMR area");
    const notes = [
      "FMRs are HUD's 40th-percentile gross rent (rent + utilities) for voucher payment standards; they are not market asking rents.",
      `Not current: ${HUD_FMR_REVISIONS.superseded.by} (${HUD_FMR_REVISIONS.superseded.document}); HUD's map service still serves FY2026.`,
    ];
    const rev = (HUD_FMR_REVISIONS.revisions as Record<string, Record<string, number | string>>)[f.FMR_AREANAME];
    if (rev) {
      notes.push(`HUD revised this area's FY2026 FMRs in the Federal Register (${HUD_FMR_REVISIONS._source.document}, effective ${HUD_FMR_REVISIONS._source.effective}); the notice's values are used. The map service still shows 2BR $${f.FMR_2BDR}.`);
      return {
        ok: true,
        source: { ...source, name: "HUD Fair Market Rents (FY2026 revised, Federal Register)", url: HUD_FMR_REVISIONS._source.url },
        value: { fmr_area_code: f.FMR_CODE, fmr_area_name: f.FMR_AREANAME, rent_0br: num(rev.rent_0br), rent_1br: num(rev.rent_1br), rent_2br: num(rev.rent_2br), rent_3br: num(rev.rent_3br), rent_4br: num(rev.rent_4br) },
        notes,
      };
    }
    return {
      ok: true,
      source,
      value: {
        fmr_area_code: f.FMR_CODE,
        fmr_area_name: f.FMR_AREANAME,
        rent_0br: num(f.FMR_0BDR),
        rent_1br: num(f.FMR_1BDR),
        rent_2br: num(f.FMR_2BDR),
        rent_3br: num(f.FMR_3BDR),
        rent_4br: num(f.FMR_4BDR),
      },
      notes,
    };
  } catch (e) {
    return fail(source, e);
  }
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
// OpenStreetMap via Overpass
// ---------------------------------------------------------------------------------------------------------------

export const OSM_FEATURES = {
  buildings: 'way["building"]',
  parking_lots: 'way["amenity"="parking"]',
  rail_stations: 'node["railway"="station"]',
  transit_stops: 'node["public_transport"="platform"]',
  parks: 'way["leisure"="park"]',
  golf_courses: 'way["leisure"="golf_course"]',
  ev_chargers: 'node["amenity"="charging_station"]',
  power_lines: 'way["power"="line"]',
  bike_lanes: 'way["cycleway"]',
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

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

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
  const query = `[out:json][timeout:25];${OSM_FEATURES[kind]}(around:${r},${lat},${lng});out center tags ${n + 1};`;
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
        const h = tags.height ? parseFloat(tags.height) : NaN; // OSM height is metres unless a unit is written
        const unitOk = !tags.height || /^\s*[0-9.]+\s*(m)?\s*$/.test(tags.height);
        return {
          osm_type: e.type,
          osm_id: e.id,
          lat: num(e.lat ?? e.center?.lat),
          lng: num(e.lon ?? e.center?.lon),
          name: tags.name || null,
          tags,
          height_m: unitOk && Number.isFinite(h) ? h : null,
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

export async function siteFacts(lat: number, lng: number, opts: { censusApiKey?: string; acsYear?: number; fetcher?: FetchLike } = {}) {
  const f = opts.fetcher || fetch;
  const [geo, fmr, elev, flood] = await Promise.all([
    censusGeographies(lat, lng, f),
    hudFairMarketRent(lat, lng, f),
    usgsElevation(lat, lng, f),
    femaFloodZone(lat, lng, f),
  ]);
  let acs: Sourced<AcsResult> | null = null;
  if (geo.ok && geo.value.tract_geoid) {
    acs = await acs5(
      { state: geo.value.state_fips, county: geo.value.county_fips.slice(2), tract: geo.value.tract_geoid.slice(5) },
      opts.acsYear || 2024,
      opts.censusApiKey,
      undefined,
      f,
    );
  }
  return { lat, lng, geographies: geo, hud_fair_market_rent: fmr, elevation: elev, flood_zone: flood, acs_tract: acs };
}
