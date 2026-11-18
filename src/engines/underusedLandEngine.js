/**
 * Underused Land Engine (CommonJS companion of underusedLandEngine.ts - keep the two in sync)
 * ACCURACY-ROADMAP.md Item 16
 *
 * MEASURED facts live at the top level of each site record. Everything in `screening_estimate`
 * is MODEL OUTPUT computed by computeScreeningEstimate() from those facts plus the named
 * SCREENING_ASSUMPTIONS, none of which is measured (each is `assumed: true`, `source: null`).
 * A number is null whenever one of its inputs is null.
 */

const A = (value, note, source = null) => ({ value, assumed: source == null, source, note });

const SCREENING_ASSUMPTIONS = {
  shareDeveloped: {
    "golf course": A(0.12, "Scenario: keep the course as open space and build on a 12% perimeter strip. Not measured."),
    "parking lot": A(1, "Scenario: the whole lot is redeveloped. Not measured."),
    vacant: A(1, "Scenario: the whole parcel is redeveloped. Not measured."),
    "lightly built commercial": A(1, "Scenario: the whole parcel is redeveloped. Not measured."),
  },
  homesPerAcre: {
    "golf course": { base: A(30, "Scenario density, townhomes/garden apartments. Not from local zoning."), nearRail: A(45, "Scenario density near rail. Not from local zoning or statute.") },
    "parking lot": { base: A(35, "Scenario density. Not from local zoning."), nearRail: A(60, "Scenario density near rail. Not from local zoning or statute.") },
    vacant: { base: A(20, "Scenario density. Not from local zoning."), nearRail: A(45, "Scenario density near rail. Not from local zoning or statute.") },
    "lightly built commercial": { base: A(35, "Scenario density. Not from local zoning."), nearRail: A(60, "Scenario density near rail. Not from local zoning or statute.") },
  },
  nearRailMeters: A(805, "Half a mile; a screening cut-off, not a legal threshold."),
  finishedValueRatio: A(0.85, "New homes are assumed to sell for 85% of the block group's median home value. Not measured."),
  costPerHome: A(340000, "Hard + soft construction cost per home in dollars. Not from a cited cost source."),
};

const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
const money = n => `$${Math.round(n).toLocaleString("en-US")}`;

function computeScreeningEstimate(site, assumptions = SCREENING_ASSUMPTIONS) {
  const kindKey = site.kind;
  const share = assumptions.shareDeveloped[kindKey];
  const dens = assumptions.homesPerAcre[kindKey];
  const acres = num(site.acres);
  const rail = num(site.distanceToRailMeters);
  const nearRail = rail != null && rail <= assumptions.nearRailMeters.value;
  const densParam = dens ? (nearRail ? dens.nearRail : dens.base) : null;
  const hv = num(site.neighborhoodMedianHv);
  const lav = num(site.assessedLandValue);

  const inputs = {
    acres: { value: acres, assumed: false, source: "site.acres (measured)" },
    shareDeveloped: share ? { value: share.value, assumed: share.assumed, source: share.source, note: share.note } : { value: null, assumed: true, source: null, note: "unknown kind" },
    homesPerAcre: densParam
      ? { value: densParam.value, assumed: densParam.assumed, source: densParam.source, note: `${nearRail ? "near-rail" : "base"} density; ${densParam.note}` }
      : { value: null, assumed: true, source: null, note: "unknown kind" },
    medianHomeValue: { value: hv, assumed: false, source: "site.neighborhoodMedianHv (ACS B25077 for the block group)" },
    finishedValueRatio: { value: assumptions.finishedValueRatio.value, assumed: assumptions.finishedValueRatio.assumed, source: assumptions.finishedValueRatio.source, note: assumptions.finishedValueRatio.note },
    costPerHome: { value: assumptions.costPerHome.value, assumed: assumptions.costPerHome.assumed, source: assumptions.costPerHome.source, note: assumptions.costPerHome.note },
    assessedLandValue: { value: lav, assumed: false, source: "site.assessedLandValue (county assessor roll land value; not market value)" },
  };

  const missing = [];
  for (const [k, v] of Object.entries(inputs)) if (v.value == null) missing.push(k);

  const developedAcres = acres != null && share ? acres * share.value : null;
  const potentialHomes = developedAcres != null && densParam ? Math.round(developedAcres * densParam.value) : null;
  const finishedValuePerHome = hv != null ? Math.round(hv * assumptions.finishedValueRatio.value) : null;
  const landCostShare = lav != null && share ? Math.round(lav * share.value) : null;
  const marginBeforeLand =
    potentialHomes != null && finishedValuePerHome != null ? potentialHomes * (finishedValuePerHome - assumptions.costPerHome.value) : null;
  const margin = marginBeforeLand != null && landCostShare != null ? marginBeforeLand - landCostShare : null;

  let idea = null;
  if (potentialHomes != null && developedAcres != null) {
    const pct = Math.round((share ? share.value : 1) * 100);
    idea =
      kindKey === "golf course"
        ? `Scenario: keep the course as open space and build on ${pct}% of it (~${Math.round(developedAcres * 10) / 10} acres): about ${potentialHomes} homes at ${densParam.value} per acre (assumed).`
        : `Scenario: redevelop ${Math.round(developedAcres * 100) / 100} acres as about ${potentialHomes} homes at ${densParam.value} per acre (assumed).`;
  }

  return {
    model: "underused-screening-v1",
    inputs,
    developedAcres: developedAcres != null ? Math.round(developedAcres * 100) / 100 : null,
    potentialHomes,
    finishedValuePerHome,
    landCostShare,
    marginBeforeLand,
    margin,
    marketLandValue: null,
    idea,
    formula:
      "developedAcres = acres x shareDeveloped; homes = round(developedAcres x homesPerAcre); " +
      "margin = homes x (medianHomeValue x finishedValueRatio - costPerHome) - assessedLandValue x shareDeveloped",
    missing_inputs: missing,
  };
}

function estimateOf(site) {
  return site.screening_estimate || computeScreeningEstimate(site);
}

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

    if (query.requirePositiveMargin) {
      const m = estimateOf(s).margin;
      if (m == null || m <= 0) return false;
    }
    if (query.maxAcquisitionCost != null && s.assessedLandValue != null && s.assessedLandValue > query.maxAcquisitionCost) {
      return false;
    }

    if (query.cityName && s.cityName && !s.cityName.toLowerCase().includes(query.cityName.toLowerCase())) {
      return false;
    }

    return true;
  });
}

// Heuristic ranking score: the weights are arbitrary ranking choices, not measured or sourced.
function computeSiteSuitabilityScore(site) {
  if (site.alreadyBuilt || site.inConservationEasement) return 0;

  const est = estimateOf(site);
  let score = 50;

  if (est.margin != null) {
    if (est.margin > 10000000) score += 25;
    else if (est.margin > 2000000) score += 15;
    else if (est.margin > 0) score += 8;
    else score -= 20;
  }

  if (site.distanceToRailMeters != null) {
    if (site.distanceToRailMeters <= 402) score += 15;
    else if (site.distanceToRailMeters <= 805) score += 10;
    else if (site.distanceToRailMeters <= 1609) score += 5;
  }

  const homes = est.potentialHomes;
  if (homes != null) {
    if (homes >= 100) score += 10;
    else if (homes >= 30) score += 6;
    else if (homes >= 10) score += 3;
  }

  if (site.publicOwner) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

const isCalifornia = fips => typeof fips === "string" && fips.startsWith("06");

function evaluateGolfCourseConversion(site, assumptions = SCREENING_ASSUMPTIONS) {
  const est = computeScreeningEstimate({ ...site, kind: "golf course" }, assumptions);
  const totalAcres = site.acres;
  const housingEdgeAcres = est.developedAcres != null ? est.developedAcres : 0;
  const publicParkPreservedAcres = Math.round((totalAcres - housingEdgeAcres) * 100) / 100;

  const homes = est.potentialHomes;
  const construction = homes != null ? homes * assumptions.costPerHome.value : null;
  const finished = homes != null && est.finishedValuePerHome != null ? homes * est.finishedValuePerHome : null;
  const totalCost = construction != null && est.landCostShare != null ? construction + est.landCostShare : null;
  const margin = est.margin;
  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;

  const statutes = [];
  // Statute applicability is NOT verified here; it is only gated to California sites.
  if (isCalifornia(site.countyFips)) {
    if (distanceToRailMiles != null && distanceToRailMiles <= 0.5) {
      statutes.push("CA SB 79 (Transit-Oriented Density)");
      statutes.push("CA AB 2097 (Zero Parking Mandates)");
    }
    statutes.push("Quimby Act Parkland Dedication Credit");
  }

  const rationale =
    homes != null
      ? `Scenario (assumed inputs, not a forecast): ${housingEdgeAcres} acres of ${totalAcres} (${Math.round(est.inputs.shareDeveloped.value * 100)}%) built as ${homes} homes; ${publicParkPreservedAcres} acres stay open. ` +
        (margin != null ? `Screening margin ${money(margin)}.` : `Margin not computed: missing ${est.missing_inputs.join(", ") || "inputs"}.`)
      : `No estimate: missing ${est.missing_inputs.join(", ")}.`;

  return {
    siteId: site.id,
    name: site.name,
    cityName: site.cityName || null,
    totalAcres,
    publicParkPreservedAcres,
    housingEdgeAcres,
    potentialHomes: homes,
    estimatedLandAcquisitionCost: est.landCostShare,
    estimatedConstructionCost: construction,
    estimatedFinishedValue: finished,
    netDevelopmentMargin: margin,
    marginPerHome: margin != null && homes ? Math.round(margin / homes) : null,
    returnOnCostPct: margin != null && totalCost ? Math.round((margin / totalCost) * 1000) / 10 : null,
    distanceToRailMiles,
    nearestRailStation: site.nearestRailStation,
    applicableStatutes: statutes,
    recommendationRationale: rationale,
    screening_estimate: est,
  };
}

function evaluateParkingLotConversion(site, assumptions = SCREENING_ASSUMPTIONS) {
  const est = computeScreeningEstimate({ ...site, kind: "parking lot" }, assumptions);
  const acres = site.acres;
  const distanceToRailMiles = site.distanceToRailMeters != null ? Math.round((site.distanceToRailMeters / 1609.34) * 100) / 100 : null;
  const isNearTransit = distanceToRailMiles != null && distanceToRailMiles <= 0.5;

  const statutes = [];
  // Statute applicability is NOT verified here; it is only gated to California sites.
  if (isCalifornia(site.countyFips)) {
    if (isNearTransit) {
      statutes.push("CA AB 2097 (Parking Minimum Abolition)");
      statutes.push("CA SB 79 (By-Right Transit Housing)");
    }
    if (site.publicOwner) statutes.push("CA Surplus Land Act (Gov. Code § 54220)");
  }

  const rationale =
    est.potentialHomes != null
      ? `Scenario (assumed inputs, not a forecast): ${acres.toFixed(2)}-acre surface parking lot redeveloped as ${est.potentialHomes} homes.`
      : `No estimate: missing ${est.missing_inputs.join(", ")}.`;

  return {
    siteId: site.id,
    name: site.name,
    cityName: site.cityName || null,
    acres,
    potentialHomes: est.potentialHomes,
    parkingMandateEliminated: isNearTransit && isCalifornia(site.countyFips),
    estimatedLandCost: est.landCostShare,
    estimatedMargin: est.margin,
    distanceToRailMiles,
    applicableStatutes: statutes,
    recommendationRationale: rationale,
    screening_estimate: est,
  };
}

function getTopGolfCourseConversions(sites, limit = 5) {
  const golfSites = filterUnderusedSites(sites, {
    kind: "golf course",
    excludeEasements: true,
    excludeAlreadyBuilt: true
  });

  const evaluated = golfSites.map(s => evaluateGolfCourseConversion(s));
  evaluated.sort((a, b) => (b.netDevelopmentMargin == null ? -Infinity : b.netDevelopmentMargin) - (a.netDevelopmentMargin == null ? -Infinity : a.netDevelopmentMargin));
  return evaluated.slice(0, limit);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCREENING_ASSUMPTIONS,
    computeScreeningEstimate,
    filterUnderusedSites,
    computeSiteSuitabilityScore,
    evaluateGolfCourseConversion,
    evaluateParkingLotConversion,
    getTopGolfCourseConversions
  };
}
