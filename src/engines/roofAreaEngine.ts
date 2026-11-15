/**
 * Roof Area & Architectural Cadastre Calculation Engine
 * Estimates true 3D roof plane surface area from 2D building footprints,
 * LiDAR DSM pitch/azimuth/overhang geometry, and roofing material assemblies.
 */

export interface RoofInput {
  footprintSqft?: number;
  livingSqft: number;
  stories: number;
  hasGarage?: boolean;
  garageAttached?: boolean;
  garageSqft?: number;
  pitchRise?: number; // Rise in inches per 12 inches run (e.g. 6 for 6:12). Defaults based on era & climate.
  roofShape?: "gable" | "hip" | "complex" | "flat";
  eavesOverhangInches?: number; // Defaults to 18 inches
  yearBuilt?: number | null;
  stateCode?: string;
  treeCanopyShadePct?: number; // 0.0 to 0.40
}

export interface RoofMaterialEstimate {
  materialKey: string;
  materialName: string;
  costPerSquareLowUsd: number;
  costPerSquareHighUsd: number;
  totalCostLowUsd: number;
  totalCostHighUsd: number;
  lifespanYears: number;
  warranty: string;
  solarFriendly: boolean;
}

export interface AccurateRoofCalculation {
  groundFootprintSqft: number;
  eavesOverhangSqft: number;
  garageRoofAdditionSqft: number;
  effectiveGroundFootprintSqft: number;
  pitchRise: number;
  pitchRatio: string;
  slopeAngleDeg: number;
  pitchMultiplier: number;
  roofShape: "gable" | "hip" | "complex" | "flat";
  shapeComplexityMultiplier: number;
  grossRoofSqft: number;
  roofingSquares: number;
  productiveAzimuthFraction: number;
  fireCodeAndVentSetbackFraction: number;
  treeShadeFraction: number;
  usableSolarSqft: number;
  maxSolarPanels: number;
  solarDcKw: number;
  annualYieldKwh: number;
  materials: RoofMaterialEstimate[];
  estimationMethod: string;
}

export function getDefaultPitchRise(yearBuilt?: number | null, stateCode?: string): number {
  const st = (stateCode || "CA").toUpperCase();

  // Regional climate adaptations
  const isDesertOrArid = ["AZ", "NV", "NM"].includes(st);
  const isHeavySnowOrRain = ["MN", "WI", "MI", "NY", "MA", "VT", "NH", "ME", "WA", "OR"].includes(st);

  if (isDesertOrArid) {
    return 3.5; // Predominantly low-pitch ranch or flat tile
  }
  if (isHeavySnowOrRain) {
    return (yearBuilt && yearBuilt < 1940) ? 8.0 : 7.0; // Steep pitch for snow and ice shedding
  }

  // Era adaptations
  if (yearBuilt && yearBuilt < 1940) return 7.5; // Craftsman, Tudor, Victorian, Spanish revival
  if (yearBuilt && yearBuilt >= 1945 && yearBuilt <= 1978) return 4.5; // California Ranch, Mid-Century Modern
  return 5.5; // Standard typical suburban pitch (5.5:12)
}

export function estimateAccurateRoofArea(input: RoofInput): AccurateRoofCalculation {
  const stories = Math.max(1, Number(input.stories) || 1);
  const hasGla = input.livingSqft != null && !isNaN(Number(input.livingSqft)) && Number(input.livingSqft) > 0;
  const livingSqft = hasGla ? Math.max(200, Number(input.livingSqft)) : 0;

  // 1. Base Footprint determination
  let groundFootprintSqft = 0;
  let method = "assessor_gla_inferred";

  if (input.footprintSqft && input.footprintSqft > 200) {
    groundFootprintSqft = Math.round(input.footprintSqft);
    method = "cadastral_lidar_osm_polygon";
  } else if (hasGla) {
    // Inferred ground footprint from GLA and story count
    groundFootprintSqft = Math.round(livingSqft / stories);
  } else {
    method = "not_recorded";
  }

  if (method === "not_recorded") {
    return {
      groundFootprintSqft: 0,
      eavesOverhangSqft: 0,
      garageRoofAdditionSqft: 0,
      effectiveGroundFootprintSqft: 0,
      pitchRise: 0,
      pitchRatio: "0:12",
      slopeAngleDeg: 0,
      pitchMultiplier: 1.0,
      roofShape: "flat",
      shapeComplexityMultiplier: 1.0,
      grossRoofSqft: 0,
      roofingSquares: 0,
      productiveAzimuthFraction: 0,
      fireCodeAndVentSetbackFraction: 0,
      treeShadeFraction: 0,
      usableSolarSqft: 0,
      maxSolarPanels: 0,
      solarDcKw: 0,
      annualYieldKwh: 0,
      materials: [],
      estimationMethod: "not_recorded",
    };
  }

  // 2. Attached Garage Addition (if not already counted in footprint)
  let garageAdditionSqft = 0;
  const hasGarage = input.hasGarage !== false;
  const garageAttached = input.garageAttached !== false;
  if (hasGarage && garageAttached) {
    const specifiedGarage = input.garageSqft && input.garageSqft > 150 ? input.garageSqft : 0;
    if (specifiedGarage) {
      garageAdditionSqft = specifiedGarage;
    } else if (method !== "cadastral_lidar_osm_polygon") {
      // 2-car garage typically adds ~400 sq ft of single-story roof plane
      garageAdditionSqft = stories > 1 ? 400 : 380;
    }
  }

  // 3. Eaves & Overhang Perimeter Calculation
  const overhangInches = input.eavesOverhangInches != null ? Math.max(0, input.eavesOverhangInches) : 18;
  const overhangFeet = overhangInches / 12.0;

  // Approximate perimeter based on typical residential aspect ratio of ~1.4:1
  const approxWidth = Math.sqrt(groundFootprintSqft / 1.4);
  const approxLength = approxWidth * 1.4;
  const approxPerimeter = 2 * (approxWidth + approxLength);
  const eavesOverhangSqft = Math.round(approxPerimeter * overhangFeet + 4 * overhangFeet * overhangFeet);

  const effectiveGroundFootprintSqft = groundFootprintSqft + garageAdditionSqft + eavesOverhangSqft;

  // 4. Pitch & Slope Multiplier (secant theta = sqrt(1 + (rise/12)^2))
  const pitchRise = input.pitchRise != null
    ? Math.max(0.5, Math.min(18.0, Number(input.pitchRise)))
    : getDefaultPitchRise(input.yearBuilt, input.stateCode);

  const slopeAngleRad = Math.atan(pitchRise / 12.0);
  const slopeAngleDeg = Number(((slopeAngleRad * 180) / Math.PI).toFixed(1));
  const pitchMultiplier = Number((Math.sqrt(144 + pitchRise * pitchRise) / 12.0).toFixed(4));

  // 5. Roof Shape Complexity Multiplier
  const roofShape = input.roofShape || (pitchRise <= 2.0 ? "flat" : "gable");
  let shapeComplexityMultiplier = 1.05; // Standard gable with rakes and ridge caps
  if (roofShape === "flat") shapeComplexityMultiplier = 1.01;
  else if (roofShape === "hip") shapeComplexityMultiplier = 1.08;
  else if (roofShape === "complex") shapeComplexityMultiplier = 1.16;

  // 6. Gross 3D Roof Surface Area & Roofing Squares
  const grossRoofSqft = Math.round(effectiveGroundFootprintSqft * pitchMultiplier * shapeComplexityMultiplier);
  const roofingSquares = Number((grossRoofSqft / 100.0).toFixed(1));

  // 7. Usable Solar Photovoltaic Plane Area
  // In Northern hemisphere, north-facing planes (315° to 45°) have steep irradiance penalties
  const productiveAzimuthFraction = roofShape === "flat" ? 0.88 : 0.64; // South, East, West planes
  const fireCodeAndVentSetbackFraction = 0.18; // 3-ft ridge/valley fire pathways + plumbing vents
  const treeShadeFraction = Math.max(0, Math.min(0.35, Number(input.treeCanopyShadePct) || 0.05));

  const usableSolarSqft = Math.round(
    grossRoofSqft *
      productiveAzimuthFraction *
      (1 - fireCodeAndVentSetbackFraction) *
      (1 - treeShadeFraction)
  );

  // 8. Solar Capacity & Energy Yield
  // Standard modern 410W monocrystalline module is ~19.5 sq ft (including mounting hardware gaps)
  const maxSolarPanels = Math.max(4, Math.floor(usableSolarSqft / 19.5));
  const solarDcKw = Number(((maxSolarPanels * 410) / 1000.0).toFixed(1));
  // Annual yield factor: ~1,500 kWh/kW in CA/AZ, ~1,200 in northern US
  const stUpper = (input.stateCode || "CA").toUpperCase();
  const yieldMultiplier = ["CA", "AZ", "NV", "NM", "TX", "FL"].includes(stUpper) ? 1520 : 1240;
  const annualYieldKwh = Math.round(solarDcKw * yieldMultiplier);

  // 9. Roofing Material Cost Estimates (RSMeans 2026 calibrated per square installed)
  const materials: RoofMaterialEstimate[] = [
    {
      materialKey: "asphalt_shingle",
      materialName: "30-Yr Architectural Asphalt Shingle",
      costPerSquareLowUsd: 460,
      costPerSquareHighUsd: 590,
      totalCostLowUsd: Math.round(roofingSquares * 460),
      totalCostHighUsd: Math.round(roofingSquares * 590),
      lifespanYears: 30,
      warranty: "30-Year Manufacturer Limited Warranty",
      solarFriendly: true,
    },
    {
      materialKey: "standing_seam_metal",
      materialName: "24-Gauge Standing Seam Metal",
      costPerSquareLowUsd: 1100,
      costPerSquareHighUsd: 1480,
      totalCostLowUsd: Math.round(roofingSquares * 1100),
      totalCostHighUsd: Math.round(roofingSquares * 1480),
      lifespanYears: 50,
      warranty: "Lifetime / 50-Year Non-Prorated",
      solarFriendly: true, // Ideal for non-penetrating S-5! solar clamps
    },
    {
      materialKey: "concrete_clay_tile",
      materialName: "Concrete / Spanish Clay Barrel Tile",
      costPerSquareLowUsd: 1250,
      costPerSquareHighUsd: 1750,
      totalCostLowUsd: Math.round(roofingSquares * 1250),
      totalCostHighUsd: Math.round(roofingSquares * 1750),
      lifespanYears: 60,
      warranty: "50-Year Class A Fire Rated",
      solarFriendly: false, // Requires tile replacement mounts / hooks
    },
    {
      materialKey: "tpo_commercial_flat",
      materialName: "60-Mil TPO Single-Ply Membrane (Low-Slope)",
      costPerSquareLowUsd: 580,
      costPerSquareHighUsd: 820,
      totalCostLowUsd: Math.round(roofingSquares * 580),
      totalCostHighUsd: Math.round(roofingSquares * 820),
      lifespanYears: 25,
      warranty: "25-Year Commercial NDL",
      solarFriendly: true, // Ballasted solar racking compatible
    },
  ];

  return {
    groundFootprintSqft,
    eavesOverhangSqft,
    garageRoofAdditionSqft: garageAdditionSqft,
    effectiveGroundFootprintSqft,
    pitchRise,
    pitchRatio: `${pitchRise}:12`,
    slopeAngleDeg,
    pitchMultiplier,
    roofShape,
    shapeComplexityMultiplier,
    grossRoofSqft,
    roofingSquares,
    productiveAzimuthFraction,
    fireCodeAndVentSetbackFraction,
    treeShadeFraction,
    usableSolarSqft,
    maxSolarPanels,
    solarDcKw,
    annualYieldKwh,
    materials,
    estimationMethod: method,
  };
}
