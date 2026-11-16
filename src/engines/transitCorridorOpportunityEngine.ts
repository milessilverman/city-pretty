/**
 * Intercity Transit Corridor & Station Opportunity Engine
 * Implements Roadmap P2 Item 18 & User Macro-to-Micro Redevelopment Mandate.
 *
 * Models passenger rail corridors (e.g. Phoenix–Tucson, Austin–San Antonio, Front Range, Brightline West),
 * evaluates station-area land costs and TOD yield under statutory zoning preemption,
 * analyzes railyard and maintenance facility siting economics,
 * and generates tailored investment strategies from $100k to $100M+.
 */

export interface ProposedStation {
  id: string;
  name: string;
  city: string;
  county: string;
  fips: string;
  station_type: "urban_center" | "suburban_infill" | "rural_exurban_infill" | "university_intermodal" | "intermodal_hub" | "suburban_growth" | "suburban_heritage";
  lat: number;
  lng: number;
  median_home_value_walkshed: number;
  avg_land_cost_per_sqft: number;
  available_underused_acres_walkshed: number;
  statutory_housing_regime: string;
  recommended_redevelopment_focus: string;
}

export interface CandidateRailyardSite {
  id: string;
  name: string;
  location: string;
  required_acres: number;
  avg_cost_per_acre: number;
  total_land_acquisition_cost: number;
  terrain_grade_pct: number;
  adjacent_mainline: string;
  advantages: string;
  siting_recommendation: string;
}

export interface IntercityCorridor {
  id: string;
  name: string;
  states: string[];
  route_length_miles: number;
  lead_agencies: string[];
  funding_status: string;
  official_study_url: string;
  source_url: string;
  last_verified: string;
  corridor_type: string;
  max_speed_mph: number;
  projected_one_way_minutes: number;
  highway_comparison_minutes: number;
  estimated_capital_cost_billions: number;
  federal_match_program?: string;
  proposed_stations: ProposedStation[];
  candidate_railyard_sites: CandidateRailyardSite[];
}

export interface StationTODAnalysis {
  stationId: string;
  stationName: string;
  city: string;
  walkshedAcquisitionCostPerAcre: number;
  totalUnderusedLandAcquisitionCost: number;
  projectedLandValueUpliftPct: number;
  feasibleHousingUnits: number;
  estimatedFinishedDevelopmentValue: number;
  applicableStatutoryPreemptions: string[];
  recommendedBikeNetworkMiles: number;
  estimatedBikeNetworkCost: number;
  investmentStrategySummary: string;
}

export interface CorridorFeasibilityEvaluation {
  corridorId: string;
  corridorName: string;
  isViable: boolean;
  travelTimeSavedMinutes: number;
  speedCompetitivenessRatio: number; // >1 means train is faster than highway
  totalStationUnderusedAcres: number;
  totalFeasibleHousingUnits: number;
  recommendedRailyardSite: CandidateRailyardSite | null;
  railyardCostSavingsUsd: number;
  verdictSummary: string;
}

export interface CapitalAllocationPillar {
  pillar: string;
  allocatedAmount: number;
  sharePct: number;
  actionItems: string[];
  projectedReturn: string;
}

export interface TargetedInvestmentPlan {
  budget: number;
  corridorName: string;
  stationName: string;
  tier: "homeowner_single_lot" | "private_syndication" | "institutional_p3_fund";
  pillars: CapitalAllocationPillar[];
  everySpaceMonetizationStrategy: string;
  statutoryPreemptionLeveraged: string;
  recommendationNarrative: string;
}

/**
 * Evaluates the macro feasibility of an entire passenger rail corridor
 */
export function evaluateCorridorFeasibility(corridor: IntercityCorridor): CorridorFeasibilityEvaluation {
  const timeSaved = corridor.highway_comparison_minutes - corridor.projected_one_way_minutes;
  const speedRatio = Math.round((corridor.highway_comparison_minutes / corridor.projected_one_way_minutes) * 100) / 100;
  const isViable = timeSaved >= 20 && speedRatio >= 1.15;

  const totalAcres = corridor.proposed_stations.reduce((sum, s) => sum + s.available_underused_acres_walkshed, 0);
  
  // Units: 45 units/acre average in transit walksheds
  const totalUnits = Math.round(totalAcres * 45);

  // Railyard analysis
  const recommendedYard = corridor.candidate_railyard_sites.find(y => y.siting_recommendation.includes("RECOMMENDED")) || corridor.candidate_railyard_sites[0] || null;
  const expensiveYard = corridor.candidate_railyard_sites.find(y => y.siting_recommendation.includes("NOT RECOMMENDED"));
  const savings = (expensiveYard && recommendedYard) ? Math.max(0, expensiveYard.total_land_acquisition_cost - recommendedYard.total_land_acquisition_cost) : 0;

  const verdict = isViable
    ? `Strong intercity passenger corridor. Train saves ${timeSaved} minutes over highway congestion (${speedRatio}x faster). Station areas control ${totalAcres.toFixed(1)} underused acres capable of supporting ~${totalUnits.toLocaleString()} transit-oriented homes.`
    : `Marginal time competitiveness (${timeSaved} minutes saved). Requires higher track speed or highway express lane bottlenecks to justify capital cost.`;

  return {
    corridorId: corridor.id,
    corridorName: corridor.name,
    isViable,
    travelTimeSavedMinutes: timeSaved,
    speedCompetitivenessRatio: speedRatio,
    totalStationUnderusedAcres: Math.round(totalAcres * 10) / 10,
    totalFeasibleHousingUnits: totalUnits,
    recommendedRailyardSite: recommendedYard,
    railyardCostSavingsUsd: savings,
    verdictSummary: verdict
  };
}

/**
 * Evaluates station-area real estate and TOD opportunity
 */
export function evaluateStationTODPotential(
  station: ProposedStation
): StationTODAnalysis {
  const costPerAcre = Math.round(station.avg_land_cost_per_sqft * 43560);
  const totalAcquisition = Math.round(costPerAcre * station.available_underused_acres_walkshed);

  // Empirical land value uplift within 0.5-1.0 mi (Okamoto & Sato 2018; Loumeau & Russo 2023)
  const upliftPct = station.station_type === "urban_center" ? 0.32 : station.station_type === "suburban_infill" ? 0.24 : 0.18;

  // Feasible units depend on station density type
  const densityMultiplier = station.station_type === "urban_center" ? 75 : station.station_type === "university_intermodal" ? 60 : 35;
  const feasibleUnits = Math.round(station.available_underused_acres_walkshed * densityMultiplier);

  // Finished value: ~85% of walkshed median home value per unit
  const finishedUnitValue = Math.round(station.median_home_value_walkshed * 0.85);
  const totalFinishedValue = feasibleUnits * finishedUnitValue;

  // Active transportation feeder network: 3-5 miles of protected bike lanes
  const bikeMiles = station.station_type === "rural_exurban_infill" ? 2.5 : 4.5;
  // Cost: ~$220,000/mile for buffered/protected bike lane from verified DOT unit costs
  const bikeCost = Math.round(bikeMiles * 220_000);

  const strategy = `Acquire available underused land in the ${station.name} walkshed (~$${(costPerAcre / 1e6).toFixed(2)}M/acre). Deploy ${station.statutory_housing_regime} for ministerial by-right approval of ~${feasibleUnits.toLocaleString()} units, paired with ${bikeMiles} miles of protected bike paths ($${(bikeCost / 1e3).toFixed(0)}k) connecting adjacent residential neighborhoods.`;

  return {
    stationId: station.id,
    stationName: station.name,
    city: station.city,
    walkshedAcquisitionCostPerAcre: costPerAcre,
    totalUnderusedLandAcquisitionCost: totalAcquisition,
    projectedLandValueUpliftPct: upliftPct,
    feasibleHousingUnits: feasibleUnits,
    estimatedFinishedDevelopmentValue: totalFinishedValue,
    applicableStatutoryPreemptions: [station.statutory_housing_regime],
    recommendedBikeNetworkMiles: bikeMiles,
    estimatedBikeNetworkCost: bikeCost,
    investmentStrategySummary: strategy
  };
}

/**
 * Generates actionable capital allocation plans from $100,000 to $100,000,000+
 */
export function generateStationInvestmentPlan(
  corridor: IntercityCorridor,
  station: ProposedStation,
  capitalBudget: number
): TargetedInvestmentPlan {
  const tod = evaluateStationTODPotential(station);

  if (capitalBudget <= 250_000) {
    // Tier 1: $100k - $250k (Individual house / Casita / EverySpace)
    const pillars: CapitalAllocationPillar[] = [
      {
        pillar: "Residential Property Acquisition Down Payment",
        allocatedAmount: Math.round(capitalBudget * 0.70),
        sharePct: 70,
        actionItems: [
          `Place 20% down on an existing single-family residence within 0.75 miles of ${station.name} (${station.city}).`,
          `Target lots with ≥5,000 sq ft and detached rear yard access.`
        ],
        projectedReturn: "Equity upside from +20% to +30% post-rail ground-breaking appreciation."
      },
      {
        pillar: "Statutory Casita / ADU Permitting & Architectural Pre-Fab",
        allocatedAmount: Math.round(capitalBudget * 0.20),
        sharePct: 20,
        actionItems: [
          `File ministerial by-right ADU application under ${station.statutory_housing_regime}.`,
          `Zero public hearing or discretionary council approval required.`
        ],
        projectedReturn: "+$1,200 to +$1,600/mo incremental rental income upon completion."
      },
      {
        pillar: "EverySpace Holding Carry Monetization",
        allocatedAmount: Math.round(capitalBudget * 0.10),
        sharePct: 10,
        actionItems: [
          "Monetize driveway for commuter/RV parking and rooftop for solar generation during 6-12 month permitting period.",
          "Generates $400-$750/mo to offset debt service and eliminate negative holding carry."
        ],
        projectedReturn: "100% negative carry offset during entitlement phase."
      }
    ];

    return {
      budget: capitalBudget,
      corridorName: corridor.name,
      stationName: station.name,
      tier: "homeowner_single_lot",
      pillars,
      everySpaceMonetizationStrategy: "EverySpace driveway and rooftop solar leasing during pre-construction entitlement window.",
      statutoryPreemptionLeveraged: station.statutory_housing_regime,
      recommendationNarrative: `With $${capitalBudget.toLocaleString()}, acquire a single residential house near ${station.name}. Use ${station.statutory_housing_regime} to add a second unit by-right while EverySpace monetizes storage and driveway parking to ensure positive cash flow from day one.`
    };
  } else if (capitalBudget <= 10_000_000) {
    // Tier 2: $1M - $10M (Contiguous lot assembly & missing middle)
    const pillars: CapitalAllocationPillar[] = [
      {
        pillar: "Contiguous Lot Assembly (2–4 Parcels)",
        allocatedAmount: Math.round(capitalBudget * 0.65),
        sharePct: 65,
        actionItems: [
          `Assemble 2 to 4 adjacent residential parcels within 0.5 miles of ${station.name}.`,
          "Perform statutory lot splits under state middle-housing statutes (e.g. Austin HOME / AZ HB 2720 / CA SB 9)."
        ],
        projectedReturn: "Doubles or triples building footprint capacity by-right."
      },
      {
        pillar: "Missing-Middle Multi-Unit Construction",
        allocatedAmount: Math.round(capitalBudget * 0.25),
        sharePct: 25,
        actionItems: [
          "Construct 6 to 16 townhomes or garden cluster units.",
          "Eliminate vehicular parking requirements where permitted near passenger rail."
        ],
        projectedReturn: "18% to 24% IRR upon finished sale or long-term lease-up."
      },
      {
        pillar: "Feeder Bike Spur & Neighborhood Micro-Mobility",
        allocatedAmount: Math.round(capitalBudget * 0.10),
        sharePct: 10,
        actionItems: [
          `Co-fund a dedicated 0.5-mile protected bike path connecting the parcels directly to ${station.name}.`,
          "Install secure bike lockers and EV micromobility charging."
        ],
        projectedReturn: "Premium tenant appeal and 10% rent premium for direct station connectivity."
      }
    ];

    return {
      budget: capitalBudget,
      corridorName: corridor.name,
      stationName: station.name,
      tier: "private_syndication",
      pillars,
      everySpaceMonetizationStrategy: "Interim contractor staging yard and fleet parking rental during site prep.",
      statutoryPreemptionLeveraged: station.statutory_housing_regime,
      recommendationNarrative: `With $${(capitalBudget / 1e6).toFixed(1)}M, assemble contiguous parcels near ${station.name}. Leverage statutory lot splits to deliver 10–16 missing-middle homes with zero parking requirements and a direct bike link to the rail platform.`
    };
  } else {
    // Tier 3: $10M - $100M+ (Institutional P3 & City-Scale Redevelopment)
    const pillars: CapitalAllocationPillar[] = [
      {
        pillar: "Master Transit-Oriented Development (TOD) Site Assembly",
        allocatedAmount: Math.round(capitalBudget * 0.50),
        sharePct: 50,
        actionItems: [
          `Acquire 10–25 acres of underused parking lots or industrial land in the ${station.name} walkshed.`,
          "Structure a Public-Private Partnership (P3) with the municipality and regional transit authority."
        ],
        projectedReturn: "Master land basis secured at pre-construction valuation."
      },
      {
        pillar: "Mixed-Use Residential Towers & Affordable Inclusion",
        allocatedAmount: Math.round(capitalBudget * 0.35),
        sharePct: 35,
        actionItems: [
          `Deliver 300 to 800 residential units with 15–20% deed-restricted workforce housing.`,
          "Incorporate ground-floor neighborhood retail, grocery, and child care."
        ],
        projectedReturn: "22% to 28% project equity IRR supported by regional housing demand."
      },
      {
        pillar: "Public Realm, Tax Increment Financing (TIF/TIRZ) & Active Transit",
        allocatedAmount: Math.round(capitalBudget * 0.15),
        sharePct: 15,
        actionItems: [
          `Pledge incremental tax yield into a dedicated TIF / TIRZ / EIFD district to issue infrastructure bonds.`,
          `Fund complete ${tod.recommendedBikeNetworkMiles}-mile protected bicycle and trail network connecting the entire neighborhood.`
        ],
        projectedReturn: "Municipal bond financing repays 40–60% of public realm infrastructure costs."
      }
    ];

    return {
      budget: capitalBudget,
      corridorName: corridor.name,
      stationName: station.name,
      tier: "institutional_p3_fund",
      pillars,
      everySpaceMonetizationStrategy: "Temporary EV fleet charging depot, food truck plaza, and event parking during phased construction.",
      statutoryPreemptionLeveraged: `${station.statutory_housing_regime} + Municipal P3 / Tax Increment District`,
      recommendationNarrative: `With $${(capitalBudget / 1e6).toFixed(1)}M, transform ${station.name} through an institutional P3. Build hundreds of transit-oriented homes, capture tax increment revenue to fund public infrastructure, and construct a complete active transit network.`
    };
  }
}
