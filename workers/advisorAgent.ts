// The AI advisor's model loop and its fact-finding tools.
//
// The advisor may only state facts that come from (a) the page data the browser sent, or (b) a tool result in this
// conversation. Each tool calls an official public source in workers/sources.ts and returns the exact URL queried, so
// every number in an answer can be traced. The list of sources consulted is returned to the page with the answer.

import Anthropic from "@anthropic-ai/sdk";
import { LOCAL_DATA_TOOLS, runLocalDataTool } from "./localData.ts";
import { parcelAt } from "./parcels.ts";
import {
  cdcPlacesTractHealth,
  censusGeographies,
  epaWalkabilityIndex,
  fhfaTractHpi,
  geocodeAddress,
  ncesNearbySchools,
  noaaSeaLevelRise,
  osmNearby,
  OSM_FEATURES,
  pvwattsV8,
  siteFacts,
  type OsmFeatureKind,
  type SourceRef,
} from "./sources.ts";

export const ADVISOR_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

export const SOURCING_RULES = `
How to handle facts (these rules override anything else):
- Every number, law, program, price, rent, value or date you state must come from the page data in the user's message or from a tool result in this conversation. Name the source next to it (for example "HUD Fair Market Rents" or "FEMA flood map").
- If what you need is not in the page data and no tool returns it, say plainly that it is not on file. Do not estimate from memory, do not use "typical" figures, and do not invent studies, statutes or programs.
- When you do arithmetic (for example rent x 12, or cost per unit), show the inputs and their sources. Any input that is your assumption must be labeled "assumption" with the reason.
- A tool returning ok:false means the source had no answer; report that, do not fill the gap.
- An unmapped FEMA flood area means "no flood map", not "no flood risk". OpenStreetMap can be incomplete; a missing feature does not prove absence.
- Treat page data fields marked unverified as unverified and say so if you rely on them. The same applies to records from City Pretty's own tables (state_housing_laws, funding_programs, research_studies, construction_unit_costs, transit_projects, improvement_evidence): give each record's verification status when you use it, and never present a field listed in verification.unverified_fields as fact.
- Laws: say whether a law could apply and which conditions you could and could not confirm from data (lot size, zoning, distance to transit, exclusions). Never state that something is allowed "by right" unless every condition is confirmed; end with "confirm with the local planning department".
- Separate what is sourced from what is your judgment. Recommendations are judgment; say what evidence would change them.`;

export const ADVISOR_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "lookup_site_facts",
    description:
      "Look up sourced public facts for a point: Census county/tract/block group and city, HUD Fair Market Rents, USGS ground elevation, FEMA flood zone, and Census ACS tract estimates (median home value, rent, income, tenure, vacancy) when configured. Every result includes the source URL. Use this before stating any of these facts.",
    input_schema: {
      type: "object",
      properties: { lat: { type: "number", description: "Latitude (WGS84)" }, lng: { type: "number", description: "Longitude (WGS84)" } },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "geocode_address",
    description: "Turn a U.S. street address into coordinates using the Census Geocoder. Use when the user names an address.",
    input_schema: {
      type: "object",
      properties: { address: { type: "string", description: "One-line U.S. address" } },
      required: ["address"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "osm_features_near",
    description:
      "List OpenStreetMap features near a point: buildings (with height / levels tags when mapped), parking lots, rail stations, transit stops, parks, golf courses, EV chargers, power lines, bike lanes. Volunteer-mapped; may be incomplete.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        radius_m: { type: "number", description: "Search radius in metres, 10 to 2000" },
        kind: { type: "string", enum: Object.keys(OSM_FEATURES) },
      },
      required: ["lat", "lng", "radius_m", "kind"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "lookup_parcel",
    description:
      "Look up the property record at a point from the county's or state's public parcel service (the same services the City Pretty page uses): parcel ID, address, land use, and where the agency publishes them, assessed values, year built, size, bedrooms. Returns the agency's own fields with the service URL, or why none is available.",
    input_schema: {
      type: "object",
      properties: { lat: { type: "number" }, lng: { type: "number" } },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "model_solar_pv",
    description:
      "Model annual solar photovoltaic energy production (kWh/yr) and solar radiation for a system size at coordinates using the NLR (formerly NREL) PVWatts v8 API. Use when the user asks about solar potential, solar panels, or energy generation.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude (WGS84)" },
        lng: { type: "number", description: "Longitude (WGS84)" },
        system_capacity_kw: { type: "number", description: "System capacity in DC kW (e.g. 4.0, 6.5)" },
        tilt_deg: { type: "number", description: "Optional tilt angle in degrees (default: 20)" },
        azimuth_deg: { type: "number", description: "Optional azimuth angle in degrees (default: 180 for south-facing)" },
      },
      required: ["lat", "lng", "system_capacity_kw"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "lookup_health_profile",
    description:
      "Look up CDC PLACES local health data (prevalence of asthma, depression, physical inactivity, general health status, obesity) for a Census tract from the CDC PLACES 2025 release.",
    input_schema: {
      type: "object",
      properties: {
        tract_fips: { type: "string", description: "11-digit Census tract FIPS GEOID (e.g. '48453000302')" },
      },
      required: ["tract_fips"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "find_nearby_schools",
    description:
      "Look up official public schools near coordinates using the National Center for Education Statistics (NCES EDGE) Public School Locations directory.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude (WGS84)" },
        lng: { type: "number", description: "Longitude (WGS84)" },
        radius_m: { type: "number", description: "Search radius in meters (default: 2000)" },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "lookup_walkability_index",
    description:
      "Look up the EPA National Walkability Index score (1 to 20, categorized from 'Least Walkable' to 'Most Walkable') and quantile rankings for street intersection density, land use diversity, and transit commute split.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude (WGS84)" },
        lng: { type: "number", description: "Longitude (WGS84)" },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "check_sea_level_rise",
    description:
      "Screen whether coordinates intersect NOAA Sea Level Rise (SLR) inundation or low-lying coastal flooding zones under 1ft to 10ft scenarios.",
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude (WGS84)" },
        lng: { type: "number", description: "Longitude (WGS84)" },
        scenario_ft: { type: "number", description: "Sea level rise scenario in feet (1 to 10, default: 1)" },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "lookup_hpi_appreciation",
    description:
      "Look up Federal Housing Finance Agency (FHFA) annual tract-level House Price Index (HPI), 1-year price change %, 5-year CAGR %, and 10-year appreciation % for an 11-digit Census tract.",
    input_schema: {
      type: "object",
      properties: {
        tract_fips: { type: "string", description: "11-digit Census tract FIPS (e.g. '48453000302')" },
      },
      required: ["tract_fips"],
      additionalProperties: false,
    },
    strict: true,
  },
  ...(LOCAL_DATA_TOOLS as Anthropic.Beta.BetaTool[]),
];

export type ToolEnv = { censusApiKey?: string; fetcher?: (url: string, init?: RequestInit) => Promise<Response> };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Runs one tool. Returns the JSON text for the model plus the sources it consulted.
export async function runAdvisorTool(name: string, input: unknown, env: ToolEnv): Promise<{ text: string; isError: boolean; sources: SourceRef[] }> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const f = env.fetcher || fetch;
  const collect = (obj: unknown, out: SourceRef[] = []): SourceRef[] => {
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      if (o.source && typeof o.source === "object" && "url" in (o.source as object)) out.push(o.source as SourceRef);
      for (const v of Object.values(o)) if (v && typeof v === "object" && v !== o.source) collect(v, out);
    }
    return out;
  };
  const done = (result: unknown) => ({ text: JSON.stringify(result), isError: false, sources: collect(result) });
  const bad = (msg: string) => ({ text: JSON.stringify({ ok: false, error: msg }), isError: true, sources: [] });

  if (name === "lookup_site_facts") {
    if (!isNum(i.lat) || !isNum(i.lng)) return bad("lat and lng must be numbers");
    return done(await siteFacts(i.lat, i.lng, { censusApiKey: env.censusApiKey, fetcher: f }));
  }
  if (name === "geocode_address") {
    if (typeof i.address !== "string" || !i.address.trim()) return bad("address is required");
    return done(await geocodeAddress(i.address, f));
  }
  if (name === "osm_features_near") {
    if (!isNum(i.lat) || !isNum(i.lng) || !isNum(i.radius_m)) return bad("lat, lng, radius_m must be numbers");
    if (typeof i.kind !== "string" || !(i.kind in OSM_FEATURES)) return bad("unknown kind");
    return done(await osmNearby(i.lat, i.lng, i.radius_m, i.kind as OsmFeatureKind, f, 100));
  }
  if (name === "lookup_parcel") {
    if (!isNum(i.lat) || !isNum(i.lng)) return bad("lat and lng must be numbers");
    const geo = await censusGeographies(i.lat, i.lng, f);
    if (!geo.ok) return done(geo);
    return done(await parcelAt(i.lat, i.lng, geo.value.county_fips, f));
  }
  if (name === "model_solar_pv") {
    if (!isNum(i.lat) || !isNum(i.lng) || !isNum(i.system_capacity_kw)) return bad("lat, lng and numeric system_capacity_kw are required");
    const tilt = isNum(i.tilt_deg) ? i.tilt_deg : 20;
    const azimuth = isNum(i.azimuth_deg) ? i.azimuth_deg : 180;
    return done(await pvwattsV8(i.lat, i.lng, i.system_capacity_kw, { tiltDeg: tilt, azimuthDeg: azimuth, fetcher: f }));
  }
  if (name === "lookup_health_profile") {
    if (typeof i.tract_fips !== "string" || !i.tract_fips.trim()) return bad("11-digit tract_fips is required");
    return done(await cdcPlacesTractHealth(i.tract_fips, f));
  }
  if (name === "find_nearby_schools") {
    if (!isNum(i.lat) || !isNum(i.lng)) return bad("lat and lng must be numbers");
    const radius = isNum(i.radius_m) ? i.radius_m : 2000;
    return done(await ncesNearbySchools(i.lat, i.lng, radius, f));
  }
  if (name === "lookup_walkability_index") {
    if (!isNum(i.lat) || !isNum(i.lng)) return bad("lat and lng must be numbers");
    return done(await epaWalkabilityIndex(i.lat, i.lng, f));
  }
  if (name === "check_sea_level_rise") {
    if (!isNum(i.lat) || !isNum(i.lng)) return bad("lat and lng must be numbers");
    const scenario = isNum(i.scenario_ft) ? i.scenario_ft : 1;
    return done(await noaaSeaLevelRise(i.lat, i.lng, scenario, f));
  }
  if (name === "lookup_hpi_appreciation") {
    if (typeof i.tract_fips !== "string" || !i.tract_fips.trim()) return bad("11-digit tract_fips is required");
    return done(await fhfaTractHpi(i.tract_fips, f));
  }
  const local = runLocalDataTool(name, i);
  if (local !== undefined) return done(local);
  return bad(`Unknown tool ${name}`);
}

export type AdvisorAnswer =
  | { ok: true; text: string; sources: SourceRef[]; tool_rounds: number; stopped_early?: string }
  | { ok: false; status: number; error: string };

// The minimal client surface used, so tests can pass a fake.
export type AdvisorClient = { beta: { messages: { create: (body: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage> } } };

export async function runAdvisor(
  client: AdvisorClient,
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  env: ToolEnv,
): Promise<AdvisorAnswer> {
  const convo: Anthropic.Beta.BetaMessageParam[] = [...messages];
  const sources: SourceRef[] = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: ADVISOR_MODEL,
        max_tokens: 16000,
        // Stable prefix (tools, then system) is cached; the conversation varies.
        tools: ADVISOR_TOOLS,
        system: [{ type: "text", text: system + "\n" + SOURCING_RULES, cache_control: { type: "ephemeral" } }],
        messages: convo,
        output_config: { effort: "high" },
        // If the model declines on a safety classifier, the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return { ok: false, status: 429, error: "The AI service is busy; try again in a minute" };
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, status: 503, error: "The AI key is not valid" };
      if (e instanceof Anthropic.APIError) return { ok: false, status: 502, error: `The AI service returned an error (${e.status ?? "network"})` };
      throw e;
    }

    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop_reason === "refusal") return { ok: false, status: 422, error: "The AI declined to answer this question" };
    if (res.stop_reason === "end_turn" || res.stop_reason === "stop_sequence") {
      return { ok: true, text, sources: dedupe(sources), tool_rounds: round };
    }
    if (res.stop_reason === "max_tokens") {
      return { ok: true, text: text + "\n\n[Answer cut off at the length limit.]", sources: dedupe(sources), tool_rounds: round, stopped_early: "max_tokens" };
    }

    convo.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") {
      if (round === MAX_TOOL_ROUNDS) {
        return { ok: true, text: text || "[Answer paused at the model limit. Ask a narrower question.]", sources: dedupe(sources), tool_rounds: round, stopped_early: "pause_turn" };
      }
      continue;
    }

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) return { ok: true, text, sources: dedupe(sources), tool_rounds: round };
    if (round === MAX_TOOL_ROUNDS) {
      return { ok: true, text: text || "I ran out of lookup steps before finishing. Ask a narrower question.", sources: dedupe(sources), tool_rounds: round, stopped_early: "tool_rounds" };
    }
    // Run this round's tool calls together and return all results in one user message.
    const results = await Promise.all(uses.map((u) => runAdvisorTool(u.name, u.input, env)));
    results.forEach((r) => sources.push(...r.sources));
    convo.push({
      role: "user",
      content: uses.map((u, k) => ({ type: "tool_result" as const, tool_use_id: u.id, content: results[k].text, is_error: results[k].isError || undefined })),
    });
  }
  return { ok: false, status: 500, error: "Advisor loop ended unexpectedly" };
}

function dedupe(s: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return s.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}
