// Parcel lookup for the AI advisor: the public county or state parcel service that covers a point, queried live.
//
// The services are exactly the ones the page uses (app/data/parcel_services.json, generated from app/app.js by
// scripts/extract_parcel_services.mjs). The county's own service is tried first, then a statewide one. Only the fields
// the page reads are requested, and each is returned under the page's label, with the service URL and its terms page.
// No service, or no parcel at the point, gives ok:false with the reason; nothing is filled in.

import REGISTRY from "../app/data/parcel_services.json" with { type: "json" };
import type { Sourced, SourceRef } from "./sources.ts";

type Service = { url: string; states: string[]; counties?: string[]; name: string; terms?: string; fields: [string, string][] };
const SERVICES = (REGISTRY as unknown as { services: Service[] }).services;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ParcelRecord = { service: string; fields: Record<string, string | number | null> };

export function parcelServicesFor(countyFips: string): Service[] {
  const f = String(countyFips || "").padStart(5, "0");
  const st = f.slice(0, 2);
  const county = SERVICES.filter((s) => (s.counties || []).includes(f));
  const statewide = SERVICES.filter((s) => !(s.counties || []).length && s.states.includes(st));
  return [...county, ...statewide];
}

export async function parcelAt(lat: number, lng: number, countyFips: string, fetcher: FetchLike = fetch): Promise<Sourced<ParcelRecord>> {
  const services = parcelServicesFor(countyFips);
  const none: SourceRef = { name: "Public parcel services", publisher: "County / state GIS", url: "repo://app/data/parcel_services.json", retrieved_at: new Date().toISOString() };
  if (!services.length) return { ok: false, value: null, source: none, error: `No public parcel service on file for county ${countyFips}` };
  let lastErr = "no parcel at this point";
  for (const s of services) {
    const fields = s.fields.map(([f]) => f).filter((f) => !/\(\)$/.test(f)); // skip computed geometry fields
    const url =
      `${s.url}/query?` +
      new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields.join(","), returnGeometry: "false", f: "json" });
    const source: SourceRef = { name: s.name, publisher: "Public parcel GIS service", url, retrieved_at: new Date().toISOString(), license: s.terms ? `See ${s.terms}` : undefined };
    try {
      const res = await fetcher(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "city-pretty/1.0 (public-data lookups)", Accept: "application/json" } });
      if (!res.ok) { lastErr = `HTTP ${res.status} from ${s.name}`; continue; }
      const d = (await res.json()) as { error?: { message?: string }; features?: { attributes: Record<string, string | number | null> }[] };
      if (d.error) { lastErr = d.error.message || "service error"; continue; }
      const a = d.features && d.features[0] && d.features[0].attributes;
      if (!a) { lastErr = `no parcel at this exact point in ${s.name} (it may be in a street right-of-way; try a point inside the lot)`; continue; }
      const out: Record<string, string | number | null> = {};
      for (const [f, label] of s.fields) if (f in a) out[label] = a[f] === "" ? null : a[f];
      return {
        ok: true,
        source,
        value: { service: s.name, fields: out },
        notes: ["Fields are the agency's own; values like assessed value follow that state's assessment rules and are not market value."],
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, value: null, source: none, error: lastErr };
}
