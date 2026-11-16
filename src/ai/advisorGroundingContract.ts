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
  flood: boolean | null;
  fire: boolean | null;
  historic: boolean | null;
  lotSplitEligibility: boolean | null;
}

export interface AdvisorHudFmr {
  fips: string | null;
  metro_or_county_name: string | null;
  efficiency_0br: number | null;
  one_bed_1br: number | null;
  two_bed_2br: number | null;
  three_bed_3br: number | null;
  four_bed_4br: number | null;
  source: string | null;
}

export interface AdvisorIntercityCorridor {
  id: string | null;
  name: string | null;
  route_length_miles: number | null;
  funding_status: string | null;
  projected_minutes: number | null;
  highway_minutes: number | null;
  estimated_cost_billions: number | null;
  nearestStation?: {
    name: string | null;
    city: string | null;
    avg_land_cost_per_sqft: number | null;
    available_underused_acres: number | null;
    statutory_housing_regime: string | null;
  } | null;
  recommendedRailyard?: {
    name: string | null;
    location: string | null;
    total_land_cost: number | null;
  } | null;
}

export interface AdvisorUnderusedSite {
  id: string | null;
  name: string | null;
  kind: string | null;
  acres: number | null;
  cityName: string | null;
  baseZoning: string | null;
  distanceToRailMeters: number | null;
  potentialHomes: number | null;
  margin: number | null;
  publicOwner: string | null;
  inConservationEasement: boolean | null;
  idea: string | null;
}

export interface AdvisorRenovationQuote {
  improvementType: string | null;
  quotedCost: number | null;
  benchmarkMarketCostLow: number | null;
  benchmarkMarketCostHigh: number | null;
  costFairnessRating: string | null;
  estimatedEquityValueAdd: number | null;
  netEquityGainUsd: number | null;
  returnOnInvestmentPct: number | null;
  everySpaceMonthlyYieldUsd: number | null;
  governingStatute: string | null;
  verdict: string | null;
  verdictSummary: string | null;
}

export interface AdvisorStreetForge {
  reallocationType: string | null;
  lengthMiles: number | null;
  netMunicipalCostUsd: number | null;
  annualCo2TonsAvoided: number | null;
  crashReductionPct: number | null;
  benefitCostRatio: number | null;
  evChargerSuitabilityScore?: number | null;
  evNetProjectCostUsd?: number | null;
  evPaybackYears?: number | null;
}

export interface AdvisorEverySpace {
  totalMonthlyGrossRevenueUsd: number | null;
  netMonthlyHoldingCashFlowUsd: number | null;
  monthlyHoldingDeficitReductionPct: number | null;
  isCashFlowPositiveDuringHold: boolean | null;
  holdingStrategyRecommendation: string | null;
}

export interface AdvisorContext {
  county: AdvisorCounty;
  roiMode: string | null;
  blockGroup?: AdvisorBlockGroup;
  parcel?: AdvisorParcel;
  hudFmr?: AdvisorHudFmr | null;
  intercityCorridor?: AdvisorIntercityCorridor | null;
  underusedSite?: AdvisorUnderusedSite | null;
  renovationQuote?: AdvisorRenovationQuote | null;
  streetForge?: AdvisorStreetForge | null;
  everySpace?: AdvisorEverySpace | null;
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
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
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
      flood: bool(p.flood),
      fire: bool(p.fire),
      historic: bool(p.historic),
      lotSplitEligibility: bool(p.lotSplitEligibility),
    };
    if (ctx.parcel.valueEstimateWithheld) ctx.parcel.valueEstimate = null;
  }
  if (r.hudFmr) {
    const f = obj(r.hudFmr);
    ctx.hudFmr = {
      fips: str(f.fips, 5),
      metro_or_county_name: str(f.metro_or_county_name, 100),
      efficiency_0br: num(f.efficiency_0br),
      one_bed_1br: num(f.one_bed_1br),
      two_bed_2br: num(f.two_bed_2br),
      three_bed_3br: num(f.three_bed_3br),
      four_bed_4br: num(f.four_bed_4br),
      source: str(f.source, 120),
    };
  }
  if (r.intercityCorridor) {
    const ic = obj(r.intercityCorridor);
    const stn = ic.nearestStation ? obj(ic.nearestStation) : null;
    const yd = ic.recommendedRailyard ? obj(ic.recommendedRailyard) : null;
    ctx.intercityCorridor = {
      id: str(ic.id, 40),
      name: str(ic.name, 100),
      route_length_miles: num(ic.route_length_miles),
      funding_status: str(ic.funding_status, 200),
      projected_minutes: num(ic.projected_minutes),
      highway_minutes: num(ic.highway_minutes),
      estimated_cost_billions: num(ic.estimated_cost_billions),
      nearestStation: stn ? {
        name: str(stn.name, 80),
        city: str(stn.city, 60),
        avg_land_cost_per_sqft: num(stn.avg_land_cost_per_sqft),
        available_underused_acres: num(stn.available_underused_acres),
        statutory_housing_regime: str(stn.statutory_housing_regime, 120),
      } : null,
      recommendedRailyard: yd ? {
        name: str(yd.name, 80),
        location: str(yd.location, 80),
        total_land_cost: num(yd.total_land_cost),
      } : null,
    };
  }
  if (r.underusedSite) {
    const us = obj(r.underusedSite);
    ctx.underusedSite = {
      id: str(us.id, 40),
      name: str(us.name, 100),
      kind: str(us.kind, 40),
      acres: num(us.acres),
      cityName: str(us.cityName, 60),
      baseZoning: str(us.baseZoning, 40),
      distanceToRailMeters: num(us.distanceToRailMeters),
      potentialHomes: num(us.potentialHomes),
      margin: num(us.margin),
      publicOwner: str(us.publicOwner, 100),
      inConservationEasement: bool(us.inConservationEasement),
      idea: str(us.idea, 300),
    };
  }
  if (r.renovationQuote) {
    const rq = obj(r.renovationQuote);
    ctx.renovationQuote = {
      improvementType: str(rq.improvementType, 60),
      quotedCost: num(rq.quotedCost),
      benchmarkMarketCostLow: num(rq.benchmarkMarketCostLow),
      benchmarkMarketCostHigh: num(rq.benchmarkMarketCostHigh),
      costFairnessRating: str(rq.costFairnessRating, 40),
      estimatedEquityValueAdd: num(rq.estimatedEquityValueAdd),
      netEquityGainUsd: num(rq.netEquityGainUsd),
      returnOnInvestmentPct: num(rq.returnOnInvestmentPct),
      everySpaceMonthlyYieldUsd: num(rq.everySpaceMonthlyYieldUsd),
      governingStatute: str(rq.governingStatute, 150),
      verdict: str(rq.verdict, 60),
      verdictSummary: str(rq.verdictSummary, 300),
    };
  }
  if (r.streetForge) {
    const sf = obj(r.streetForge);
    ctx.streetForge = {
      reallocationType: str(sf.reallocationType, 60),
      lengthMiles: num(sf.lengthMiles),
      netMunicipalCostUsd: num(sf.netMunicipalCostUsd),
      annualCo2TonsAvoided: num(sf.annualCo2TonsAvoided),
      crashReductionPct: num(sf.crashReductionPct),
      benefitCostRatio: num(sf.benefitCostRatio),
      evChargerSuitabilityScore: num(sf.evChargerSuitabilityScore),
      evNetProjectCostUsd: num(sf.evNetProjectCostUsd),
      evPaybackYears: num(sf.evPaybackYears),
    };
  }
  if (r.everySpace) {
    const es = obj(r.everySpace);
    ctx.everySpace = {
      totalMonthlyGrossRevenueUsd: num(es.totalMonthlyGrossRevenueUsd),
      netMonthlyHoldingCashFlowUsd: num(es.netMonthlyHoldingCashFlowUsd),
      monthlyHoldingDeficitReductionPct: num(es.monthlyHoldingDeficitReductionPct),
      isCashFlowPositiveDuringHold: bool(es.isCashFlowPositiveDuringHold),
      holdingStrategyRecommendation: str(es.holdingStrategyRecommendation, 300),
    };
  }
  return ctx;
}

export function buildAdvisorUserMessage(question: string, ctx: AdvisorContext): string {
  return ["Page data (JSON):", "```json", JSON.stringify(ctx, null, 2), "```", "", `Question: ${question}`].join("\n");
}
