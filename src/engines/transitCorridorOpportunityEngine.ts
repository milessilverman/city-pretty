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
  station_type: "city_center" | "urban_center" | "suburban_infill" | "rural_exurban_infill" | "university_intermodal" | "intermodal_hub" | "suburban_growth" | "suburban_heritage";
  lat: number;
  lng: number;
  station_basis?: string;
  median_home_value_walkshed: number | null;
  avg_land_cost_per_sqft: number | null;
  available_underused_acres_walkshed: number | null;
  statutory_housing_regime: string | null;
  recommended_redevelopment_focus: string | null;
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
  route_length_miles: number | null;
  lead_agencies: string[];
  funding_status: string;
  official_study_url: string;
  source_url: string;
  last_verified: string;
  corridor_type: string;
  max_speed_mph: number | null;
  projected_one_way_minutes: number | null;
  highway_comparison_minutes: number | null;
  estimated_capital_cost_billions: number | null;
  federal_match_program?: string;
  proposed_stations: ProposedStation[];
  candidate_railyard_sites: CandidateRailyardSite[];
}

export interface StationTODAnalysis {
  stationId: string;
  stationName: string;
  city: string;
  walkshedAcquisitionCostPerAcre: number | null;
  totalUnderusedLandAcquisitionCost: number | null;
  projectedLandValueUpliftPct: number | null;
  feasibleHousingUnits: number | null;
  estimatedFinishedDevelopmentValue: number | null;
  applicableStatutoryPreemptions: string[];
  recommendedBikeNetworkMiles: number | null;
  estimatedBikeNetworkCost: number | null;
  investmentStrategySummary: string;
}

export interface CorridorFeasibilityEvaluation {
  corridorId: string;
  corridorName: string;
  isViable: boolean | null;
  travelTimeSavedMinutes: number | null;
  speedCompetitivenessRatio: number | null; // >1 means train is faster than highway; null = not on file
  totalStationUnderusedAcres: number | null;
  totalFeasibleHousingUnits: number | null;
  recommendedRailyardSite: CandidateRailyardSite | null;
  railyardCostSavingsUsd: number | null;
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

// Null-safety: a missing (null/undefined/NaN) input yields a null output ("not on file"), never NaN.
function num(x: unknown): number | null { return (typeof x === "number" && Number.isFinite(x)) ? x : null; }

export function evaluateCorridorFeasibility(corridor: IntercityCorridor): CorridorFeasibilityEvaluation {
  const hwy = num(corridor.highway_comparison_minutes);
  const rail = num(corridor.projected_one_way_minutes);
  const haveTimes = hwy !== null && rail !== null && rail > 0;
  const timeSaved = haveTimes ? hwy - rail : null;
  const speedRatio = haveTimes ? Math.round((hwy / rail) * 100) / 100 : null;
  const isViable = haveTimes ? (timeSaved >= 20 && speedRatio >= 1.15) : null;

  const acresList = (corridor.proposed_stations || []).map((s: ProposedStation) => num(s.available_underused_acres_walkshed)).filter((v): v is number => v !== null);
  const totalAcres = acresList.length ? acresList.reduce((a: number, v: number) => a + v, 0) : null;
  const totalUnits = totalAcres !== null ? Math.round(totalAcres * 45) : null;

  const yards = corridor.candidate_railyard_sites || [];
  const recommendedYard = yards.find((y: CandidateRailyardSite) => (y.siting_recommendation || "").includes("RECOMMENDED")) || yards[0] || null;
  const expensiveYard = yards.find((y: CandidateRailyardSite) => (y.siting_recommendation || "").includes("NOT RECOMMENDED"));
  const yc: (number | null)[] | null = expensiveYard && recommendedYard ? [num(expensiveYard.total_land_acquisition_cost), num(recommendedYard.total_land_acquisition_cost)] : null;
  const savings = yc && yc[0] !== null && yc[1] !== null ? Math.max(0, yc[0] - yc[1]) : null;

  const verdict = isViable === null
    ? "Not on file: this corridor has no published trip-time comparison in the data, so no viability verdict is given."
    : isViable
      ? `Train saves ${timeSaved} minutes over highway (${speedRatio}x faster).` + (totalAcres !== null ? ` Station areas control ${totalAcres.toFixed(1)} underused acres capable of supporting ~${totalUnits.toLocaleString()} transit-oriented homes.` : "")
      : `Marginal time competitiveness (${timeSaved} minutes saved). Requires higher track speed or highway express lane bottlenecks to justify capital cost.`;

  return {
    corridorId: corridor.id,
    corridorName: corridor.name,
    isViable,
    travelTimeSavedMinutes: timeSaved,
    speedCompetitivenessRatio: speedRatio,
    totalStationUnderusedAcres: totalAcres !== null ? Math.round(totalAcres * 10) / 10 : null,
    totalFeasibleHousingUnits: totalUnits,
    recommendedRailyardSite: recommendedYard,
    railyardCostSavingsUsd: savings,
    verdictSummary: verdict
  };
}

export function evaluateStationTODPotential(station: ProposedStation): StationTODAnalysis {
  const landSqft = num(station.avg_land_cost_per_sqft);
  const acres = num(station.available_underused_acres_walkshed);
  const homeValue = num(station.median_home_value_walkshed);
  const nothingOnFile = landSqft === null && acres === null && homeValue === null;

  const costPerAcre = landSqft !== null ? Math.round(landSqft * 43560) : null;
  const totalAcquisition = costPerAcre !== null && acres !== null ? Math.round(costPerAcre * acres) : null;

  const upliftPct = nothingOnFile ? null : station.station_type === "urban_center" ? 0.32 : station.station_type === "suburban_infill" ? 0.24 : 0.18;
  const densityMultiplier = station.station_type === "urban_center" ? 75 : station.station_type === "university_intermodal" ? 60 : 35;
  const feasibleUnits = acres !== null ? Math.round(acres * densityMultiplier) : null;

  const finishedUnitValue = homeValue !== null ? Math.round(homeValue * 0.85) : null;
  const totalFinishedValue = feasibleUnits !== null && finishedUnitValue !== null ? feasibleUnits * finishedUnitValue : null;

  const bikeMiles = nothingOnFile ? null : station.station_type === "rural_exurban_infill" ? 2.5 : 4.5;
  const bikeCost = bikeMiles !== null ? Math.round(bikeMiles * 220000) : null;

  const strategy = nothingOnFile
    ? `Not on file: no walkshed land-cost, underused-acre or home-value data exists for ${station.name}.`
    : `Acquire available underused land in the ${station.name} walkshed` + (costPerAcre !== null ? ` (~$${(costPerAcre / 1e6).toFixed(2)}M/acre)` : "") + `. Deploy ${station.statutory_housing_regime || "applicable state housing law (not on file)"}` + (feasibleUnits !== null ? ` for ministerial by-right approval of ~${feasibleUnits.toLocaleString()} units` : "") + (bikeMiles !== null ? `, paired with ${bikeMiles} miles of protected bike paths ($${(bikeCost / 1e3).toFixed(0)}k)` : "") + ".";

  return {
    stationId: station.id,
    stationName: station.name,
    city: station.city,
    walkshedAcquisitionCostPerAcre: costPerAcre,
    totalUnderusedLandAcquisitionCost: totalAcquisition,
    projectedLandValueUpliftPct: upliftPct,
    feasibleHousingUnits: feasibleUnits,
    estimatedFinishedDevelopmentValue: totalFinishedValue,
    applicableStatutoryPreemptions: station.statutory_housing_regime ? [station.statutory_housing_regime] : [],
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
  station = { ...station, statutory_housing_regime: station.statutory_housing_regime || "applicable state housing law (not on file)" };
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
          `${tod.recommendedBikeNetworkMiles !== null ? `Fund complete ${tod.recommendedBikeNetworkMiles}-mile protected bicycle and trail network connecting the entire neighborhood.` : "Active-transportation network length: not on file."}`
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
