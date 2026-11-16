/**
 * Underused Land Engine (CommonJS companion)
 * ACCURACY-ROADMAP.md Item 16
 */

function filterUnderusedSites(sites, query = {}) {
  return (sites || []).filter(s => {
    if (query.kind) {
      if (Array.isArray(query.kind)) {
        if (!query.kind.includes(s.kind)) return false;
      } else if (s.kind !== query.kind) {
        return false;
      }
    }

    if (query.minAcres != null && s.acres < query.minAcres) return false;
    if (query.maxAcres != null && s.acres > query.maxAcres) return false;

    if (query.maxDistanceToRailMeters != null) {
      if (s.distanceToRailMeters == null || s.distanceToRailMeters > query.maxDistanceToRailMeters) {
        return false;
      }
    }

    if (query.excludeEasements && s.inConservationEasement) return false;
    if (query.excludeAlreadyBuilt && s.alreadyBuilt) return false;

    if (query.requirePositiveMargin && (s.margin == null || s.margin <= 0)) return false;
    if (query.maxAcquisitionCost != null && s.marketLandValue != null && s.marketLandValue > query.maxAcquisitionCost) {
      return false;
    }

    if (query.cityName && s.cityName && !s.cityName.toLowerCase().includes(query.cityName.toLowerCase())) {
      return false;
    }

    return true;
  });
}

function computeSiteSuitabilityScore(site) {
  if (site.alreadyBuilt || site.inConservationEasement) return 0;

  let score = 50;

  if (site.margin != null) {
    if (site.margin > 10000000) score += 25;
    else if (site.margin > 2000000) score += 15;
    else if (site.margin > 0) score += 8;
    else score -= 20;
  }

  if (site.distanceToRailMeters != null) {
    if (site.distanceToRailMeters <= 402) score += 15;
    else if (site.distanceToRailMeters <= 805) score += 10;
    else if (site.distanceToRailMeters <= 1609) score += 5;
  }

  if (site.potentialHomes >= 100) score += 10;
  else if (site.potentialHomes >= 30) score += 6;
  else if (site.potentialHomes >= 10) score += 3;

  if (site.publicOwner) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function evaluateGolfCourseConversion(site, marketContext = {}) {
  const totalAcres = site.acres;
  const housingShare = 0.12;
  const housingEdgeAcres = Math.round(totalAcres * housingShare * 100) / 100;
  const publicParkPreservedAcres = Math.round((totalAcres - housingEdgeAcres) * 100) / 100;

  const densityPerAcre = (site.distanceToRailMeters && site.distanceToRailMeters <= 805) ? 45 : 30;
  const potentialHomes = site.potentialHomes || Math.max(4, Math.round(housingEdgeAcres * densityPerAcre));

  const medHv = site.neighborhoodMedianHv || marketContext.medianHv || 750000;
  const estimatedLandAcquisitionCost = site.marketLandValue || Math.round(totalAcres * 800000);
  
  const unitHardSoftCost = 340000;
  const estimatedConstructionCost = potentialHomes * unitHardSoftCost;
  
  const finishedUnitValue = Math.round(medHv * 0.85);
  const estimatedFinishedValue = potentialHomes * finishedUnitValue;

  const totalCost = (estimatedLandAcquisitionCost * housingShare) + estimatedConstructionCost;
  const netDevelopmentMargin = site.margin != null ? site.margin : Math.round(estimatedFinishedValue - totalCost);
  const marginPerHome = potentialHomes > 0 ? Math.round(netDevelopmentMargin / potentialHomes) : 0;
  const returnOnCostPct = totalCost > 0 ? Math.round((netDevelopmentMargin / totalCost) * 1000) / 10 : 0;

  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;

  const statutes = [];
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

function evaluateParkingLotConversion(site) {
  const acres = site.acres;
  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;
  const isNearTransit = distanceToRailMiles != null && distanceToRailMiles <= 0.5;

  const potentialHomes = site.potentialHomes || Math.round(acres * (isNearTransit ? 60 : 35));
  const estimatedLandCost = site.marketLandValue || Math.round(acres * 1200000);
  const estimatedMargin = site.margin != null ? site.margin : Math.round(potentialHomes * 65000);

  const statutes = [];
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

function getTopGolfCourseConversions(sites, limit = 5) {
  const golfSites = filterUnderusedSites(sites, {
    kind: "golf course",
    excludeEasements: true,
    excludeAlreadyBuilt: true
  });

  const evaluated = golfSites.map(s => evaluateGolfCourseConversion(s));
  evaluated.sort((a, b) => b.netDevelopmentMargin - a.netDevelopmentMargin);
  return evaluated.slice(0, limit);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    filterUnderusedSites,
    computeSiteSuitabilityScore,
    evaluateGolfCourseConversion,
    evaluateParkingLotConversion,
    getTopGolfCourseConversions
  };
}
