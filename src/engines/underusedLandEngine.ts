/**
 * Underused Land Engine (ACCURACY-ROADMAP.md Item 16)
 * Analyzes underutilized urban land: golf courses, surface parking lots,
 * vacant parcels, and lightly built commercial sites.
 *
 * Answers strategic redevelopment questions:
 * - Which golf course is the best to convert to homes, where, why, and what profit?
 * - Which parking lot offers the highest transit-oriented infill yield under statutory zoning preemption?
 * - What is the opportunity cost and profit margin of conversion?
 */

export type UnderusedSiteKind = "golf course" | "parking lot" | "vacant" | "lightly built commercial";

export interface UnderusedSite {
  id: string;
  name: string | null;
  address?: string | null;
  kind: UnderusedSiteKind;
  acres: number;
  countyFips: string;
  blockGroupId: string;
  cityName?: string | null;
  neighborhoodName?: string | null;
  lat?: number;
  lng?: number;
  assessedLandValue: number | null;
  marketLandValue: number | null;
  baseZoning: string | null;
  zoningCategory: string | null;
  distanceToRailMeters: number | null;
  nearestRailStation: string | null;
  railStationStatus?: "open" | "coming" | "planned" | null;
  publicOwner: string | null;
  inConservationEasement: boolean;
  isHousingElementSite: boolean;
  alreadyBuilt: boolean;
  neighborhoodMedianHv: number | null;
  potentialHomes: number;
  margin: number | null;
  idea: string;
  applicableStatutes?: string[];
  suitabilityScore?: number;
  sourceUrl?: string;
  lastVerified?: string;
}

export interface UnderusedQuery {
  kind?: UnderusedSiteKind | UnderusedSiteKind[];
  minAcres?: number;
  maxAcres?: number;
  maxDistanceToRailMeters?: number;
  requirePositiveMargin?: boolean;
  excludeEasements?: boolean;
  excludeAlreadyBuilt?: boolean;
  maxAcquisitionCost?: number;
  cityName?: string;
}

export interface GolfCourseConversionEvaluation {
  siteId: string;
  name: string | null;
  cityName: string | null;
  totalAcres: number;
  publicParkPreservedAcres: number;
  housingEdgeAcres: number;
  potentialHomes: number;
  estimatedLandAcquisitionCost: number;
  estimatedConstructionCost: number;
  estimatedFinishedValue: number;
  netDevelopmentMargin: number;
  marginPerHome: number;
  returnOnCostPct: number;
  distanceToRailMiles: number | null;
  nearestRailStation: string | null;
  applicableStatutes: string[];
  recommendationRationale: string;
}

export interface ParkingLotConversionEvaluation {
  siteId: string;
  name: string | null;
  cityName: string | null;
  acres: number;
  potentialHomes: number;
  parkingMandateEliminated: boolean; // AB 2097 / statutory
  estimatedLandCost: number;
  estimatedMargin: number;
  distanceToRailMiles: number | null;
  applicableStatutes: string[];
  recommendationRationale: string;
}

/**
 * Filter underused sites according to investor or municipal constraints
 */
export function filterUnderusedSites(
  sites: UnderusedSite[],
  query: UnderusedQuery
): UnderusedSite[] {
  return sites.filter(s => {
    // Kind filter
    if (query.kind) {
      if (Array.isArray(query.kind)) {
        if (!query.kind.includes(s.kind)) return false;
      } else if (s.kind !== query.kind) {
        return false;
      }
    }

    // Acreage bounds
    if (query.minAcres != null && s.acres < query.minAcres) return false;
    if (query.maxAcres != null && s.acres > query.maxAcres) return false;

    // Transit proximity
    if (query.maxDistanceToRailMeters != null) {
      if (s.distanceToRailMeters == null || s.distanceToRailMeters > query.maxDistanceToRailMeters) {
        return false;
      }
    }

    // Easement exclusion (cannot build on deed-restricted conservation easements)
    if (query.excludeEasements && s.inConservationEasement) return false;

    // Already built / under construction
    if (query.excludeAlreadyBuilt && s.alreadyBuilt) return false;

    // Financial filter
    if (query.requirePositiveMargin && (s.margin == null || s.margin <= 0)) return false;
    if (query.maxAcquisitionCost != null && s.marketLandValue != null && s.marketLandValue > query.maxAcquisitionCost) {
      return false;
    }

    // City filter
    if (query.cityName && s.cityName && !s.cityName.toLowerCase().includes(query.cityName.toLowerCase())) {
      return false;
    }

    return true;
  });
}

/**
 * Computes an objective 0-100 redevelopment suitability score
 */
export function computeSiteSuitabilityScore(site: UnderusedSite): number {
  if (site.alreadyBuilt || site.inConservationEasement) return 0;

  let score = 50;

  // 1. Financial viability (margin)
  if (site.margin != null) {
    if (site.margin > 10_000_000) score += 25;
    else if (site.margin > 2_000_000) score += 15;
    else if (site.margin > 0) score += 8;
    else score -= 20; // Negative carry/margin
  }

  // 2. Transit proximity (walkshed to fixed guideway rail)
  if (site.distanceToRailMeters != null) {
    if (site.distanceToRailMeters <= 402) score += 15; // 0.25 mi (Tier 1 SB 79)
    else if (site.distanceToRailMeters <= 805) score += 10; // 0.50 mi (Tier 2 SB 79 / AB 2097)
    else if (site.distanceToRailMeters <= 1609) score += 5; // 1.0 mi
  }

  // 3. Scale and housing yield
  if (site.potentialHomes >= 100) score += 10;
  else if (site.potentialHomes >= 30) score += 6;
  else if (site.potentialHomes >= 10) score += 3;

  // 4. Public ownership bonus (Surplus Land Act / streamlined P3 opportunity)
  if (site.publicOwner) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Evaluates a golf course site for an optimal edge-development conversion:
 * Preserves 85-90% as permanent public park while developing 10-15% perimeter
 * for mixed-income housing.
 */
export function evaluateGolfCourseConversion(
  site: UnderusedSite,
  marketContext?: { medianHv?: number; hudFmr2br?: number }
): GolfCourseConversionEvaluation {
  const totalAcres = site.acres;
  // Edge development preserves 88% as public park greenway and clusters housing on 12%
  const housingShare = 0.12;
  const housingEdgeAcres = Math.round(totalAcres * housingShare * 100) / 100;
  const publicParkPreservedAcres = Math.round((totalAcres - housingEdgeAcres) * 100) / 100;

  // Density: 35-40 units per net residential acre (townhomes and 3-story garden apartments)
  const densityPerAcre = (site.distanceToRailMeters && site.distanceToRailMeters <= 805) ? 45 : 30;
  const potentialHomes = site.potentialHomes || Math.max(4, Math.round(housingEdgeAcres * densityPerAcre));

  const medHv = site.neighborhoodMedianHv || marketContext?.medianHv || 750_000;
  const estimatedLandAcquisitionCost = site.marketLandValue || Math.round(totalAcres * 800_000);
  
  // Hard + soft construction cost: ~$340,000 per unit for townhome/garden apt
  const unitHardSoftCost = 340_000;
  const estimatedConstructionCost = potentialHomes * unitHardSoftCost;
  
  // Finished unit value grounded in neighborhood median home value (~85% of SFR value)
  const finishedUnitValue = Math.round(medHv * 0.85);
  const estimatedFinishedValue = potentialHomes * finishedUnitValue;

  const totalCost = (estimatedLandAcquisitionCost * housingShare) + estimatedConstructionCost;
  const netDevelopmentMargin = site.margin != null ? site.margin : Math.round(estimatedFinishedValue - totalCost);
  const marginPerHome = potentialHomes > 0 ? Math.round(netDevelopmentMargin / potentialHomes) : 0;
  const returnOnCostPct = totalCost > 0 ? Math.round((netDevelopmentMargin / totalCost) * 1000) / 10 : 0;

  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;

  const statutes: string[] = [];
  if (distanceToRailMiles != null && distanceToRailMiles <= 0.5) {
    statutes.push("CA SB 79 (Transit-Oriented Density)");
    statutes.push("CA AB 2097 (Zero Parking Mandates)");
  }
  statutes.push("Quimby Act Parkland Dedication Credit");

  const rationale = `Converts ${housingEdgeAcres} acres (12% edge) into ${potentialHomes} homes while dedicating ${publicParkPreservedAcres} acres (88%) as a permanent public municipal park. Estimated net margin: $${(netDevelopmentMargin / 1e6).toFixed(2)}M (${returnOnCostPct}% return on capital).`;

  return {
    siteId: site.id,
    name: site.name,
    cityName: site.cityName || null,
    totalAcres,
    publicParkPreservedAcres,
    housingEdgeAcres,
    potentialHomes,
    estimatedLandAcquisitionCost,
    estimatedConstructionCost,
    estimatedFinishedValue,
    netDevelopmentMargin,
    marginPerHome,
    returnOnCostPct,
    distanceToRailMiles,
    nearestRailStation: site.nearestRailStation,
    applicableStatutes: statutes,
    recommendationRationale: rationale
  };
}

/**
 * Evaluates a surface parking lot for transit-oriented infill housing
 */
export function evaluateParkingLotConversion(
  site: UnderusedSite
): ParkingLotConversionEvaluation {
  const acres = site.acres;
  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;
  const isNearTransit = distanceToRailMiles != null && distanceToRailMiles <= 0.5;

  const potentialHomes = site.potentialHomes || Math.round(acres * (isNearTransit ? 60 : 35));
  const estimatedLandCost = site.marketLandValue || Math.round(acres * 1_200_000);
  const estimatedMargin = site.margin != null ? site.margin : Math.round(potentialHomes * 65_000);

  const statutes: string[] = [];
  if (isNearTransit) {
    statutes.push("CA AB 2097 (Parking Minimum Abolition)");
    statutes.push("CA SB 79 (By-Right Transit Housing)");
  }
  if (site.publicOwner) {
    statutes.push("CA Surplus Land Act (Gov. Code § 54220)");
  }

  const rationale = `Redevelops ${acres.toFixed(2)}-acre surface parking lot into ${potentialHomes} transit-oriented housing units. Zero vehicular parking minimums under AB 2097 within 0.5 mi of ${site.nearestRailStation || "rail"}.`;

  return {
    siteId: site.id,
    name: site.name,
    cityName: site.cityName || null,
    acres,
    potentialHomes,
    parkingMandateEliminated: isNearTransit,
    estimatedLandCost,
    estimatedMargin,
    distanceToRailMiles,
    applicableStatutes: statutes,
    recommendationRationale: rationale
  };
}

/**
 * Returns top-ranked golf courses for conversion, sorted by development margin and feasibility
 */
export function getTopGolfCourseConversions(
  sites: UnderusedSite[],
  limit: number = 5
): GolfCourseConversionEvaluation[] {
  const golfSites = filterUnderusedSites(sites, {
    kind: "golf course",
    excludeEasements: true,
    excludeAlreadyBuilt: true
  });

  const evaluated = golfSites.map(s => evaluateGolfCourseConversion(s));
  evaluated.sort((a, b) => b.netDevelopmentMargin - a.netDevelopmentMargin);
  return evaluated.slice(0, limit);
}
