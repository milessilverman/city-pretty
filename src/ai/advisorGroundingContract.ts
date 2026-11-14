// The AI advisor's prompt, built in the Worker (workers/api-proxy.ts) from what the page sends.
//
// The page (app/app.js, serializeLiveAdvisorContext) sends the data it is showing. Unknown values arrive as null,
// never as stand-in numbers. The Worker keeps only the fields below (sanitizeAdvisorContext), so a visitor cannot
// change the instructions, only the data the model reads.

export interface AdvisorCounty {
  fips: string | null;
  name: string | null;
  state: string | null;
  readiness_tier: string | null;
  assessor_roll_vintage: string | null;
  zoning_source: string | null;
}

export interface AdvisorBlockGroup {
  geoid: string | null;
  name: string | null;
  nameSource: string | null;
  city: string | null;
  medianHomeValue: number | null;
  medianRent: number | null;
  population: number | null;
  acres: number | null;
  topProjects: unknown[] | null;
}

export interface AdvisorParcel {
  parcelId: string | null;
  address: string | null;
  useType: string | null;
  useDescription: string | null;
  zoningCode: string | null;
  lotSqft: number | null;
  livingSqft: number | null;
  yearBuilt: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  units: number | null;
  assessorValue: number | null;
  lastSale: { price: number | null; date: string | null } | null;
  valueEstimate: { value: number | null; low: number | null; high: number | null; method: string | null } | null;
  valueEstimateWithheld: string | null;
  nearestRailOrBrt: { name: string | null; miles: number | null } | null;
}

export interface AdvisorContext {
  county: AdvisorCounty;
  roiMode: string | null;
  blockGroup?: AdvisorBlockGroup;
  parcel?: AdvisorParcel;
}

// Stable text: keep it free of per-request values so it can be prompt-cached.
export const ADVISOR_SYSTEM_PROMPT = [
  "You answer questions from visitors to City Pretty, a public map of US neighborhoods. For each block group it estimates which public improvements (street trees, parks, bus service, safer streets, clinics, schools and more) would make the area better and raise home values per dollar spent, and it can screen a single lot: its public record, zoning and a rough home-value estimate.",
  "Each question comes with the data the page is showing, as JSON. Base every figure you give on that JSON. When a value is null or missing, say the page does not have it; do not estimate it or bring in numbers from elsewhere.",
  "If parcel.valueEstimateWithheld is set, the page deliberately gives no home value for this lot. Do not give one; explain the reason it states.",
  "The page's figures are screening estimates from public data, not appraisals, zoning determinations, tax advice or legal advice. When a question is about building, adding a unit, splitting a lot, permits or property taxes, give what the data shows and name the city or county office that decides.",
  "Mention a state or federal law only when you are confident it applies in this state, and say that rules change. As of 2026 the federal 30% residential solar credit (IRC 25D) no longer applies to systems installed after 2025.",
  "Answer in a few sentences, then at most five short bullet points if they help. Use plain text with **bold** and '-' bullets only.",
].join("\n\n");

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function sanitizeAdvisorContext(raw: unknown): AdvisorContext {
  const r = obj(raw);
  const c = obj(r.county);
  const ctx: AdvisorContext = {
    county: {
      fips: str(c.fips, 5),
      name: str(c.name, 80),
      state: str(c.state, 2),
      readiness_tier: str(c.readiness_tier, 40),
      assessor_roll_vintage: str(c.assessor_roll_vintage, 40),
      zoning_source: str(c.zoning_source, 60),
    },
    roiMode: str(r.roiMode, 20),
  };
  if (r.blockGroup) {
    const b = obj(r.blockGroup);
    ctx.blockGroup = {
      geoid: str(b.geoid, 15),
      name: str(b.name, 120),
      nameSource: str(b.nameSource, 160),
      city: str(b.city, 80),
      medianHomeValue: num(b.medianHomeValue),
      medianRent: num(b.medianRent),
      population: num(b.population),
      acres: num(b.acres),
      topProjects: Array.isArray(b.topProjects) ? JSON.parse(JSON.stringify(b.topProjects.slice(0, 3)).slice(0, 2000) || "null") : null,
    };
  }
  if (r.parcel) {
    const p = obj(r.parcel);
    const sale = p.lastSale ? obj(p.lastSale) : null;
    const est = p.valueEstimate ? obj(p.valueEstimate) : null;
    const rail = p.nearestRailOrBrt ? obj(p.nearestRailOrBrt) : null;
    ctx.parcel = {
      parcelId: str(p.parcelId, 40),
      address: str(p.address, 160),
      useType: str(p.useType, 40),
      useDescription: str(p.useDescription, 160),
      zoningCode: str(p.zoningCode, 40),
      lotSqft: num(p.lotSqft),
      livingSqft: num(p.livingSqft),
      yearBuilt: num(p.yearBuilt),
      bedrooms: num(p.bedrooms),
      bathrooms: num(p.bathrooms),
      stories: num(p.stories),
      units: num(p.units),
      assessorValue: num(p.assessorValue),
      lastSale: sale ? { price: num(sale.price), date: str(sale.date, 10) } : null,
      valueEstimate: est ? { value: num(est.value), low: num(est.low), high: num(est.high), method: str(est.method, 80) } : null,
      valueEstimateWithheld: str(p.valueEstimateWithheld, 300),
      nearestRailOrBrt: rail ? { name: str(rail.name, 80), miles: num(rail.miles) } : null,
    };
    if (ctx.parcel.valueEstimateWithheld) ctx.parcel.valueEstimate = null;
  }
  return ctx;
}

export function buildAdvisorUserMessage(question: string, ctx: AdvisorContext): string {
  return ["Page data (JSON):", "```json", JSON.stringify(ctx, null, 2), "```", "", `Question: ${question}`].join("\n");
}
