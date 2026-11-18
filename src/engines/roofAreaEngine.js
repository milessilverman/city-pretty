/**
 * Roof Area & Architectural Cadastre Calculation Engine
 * Estimates true 3D roof plane surface area from 2D building footprints,
 * LiDAR DSM pitch/azimuth/overhang geometry, and roofing material assemblies.
 */

function getDefaultPitchRise(yearBuilt, stateCode) {
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

function estimateAccurateRoofArea(input) {
  input = input || {};
  const stories = Math.max(1, Number(input.stories) || 1);
  const hasGla = input.livingSqft != null && !isNaN(Number(input.livingSqft)) && Number(input.livingSqft) > 0;
  const livingSqft = hasGla ? Math.max(200, Number(input.livingSqft)) : 0;

  // 1. Base Footprint determination
  let groundFootprintSqft = 0;
  let method = "assessor_gla_inferred";

  if (input.footprintSqft && input.footprintSqft > 200) {
    groundFootprintSqft = Math.round(input.footprintSqft);
    method = input.footprintSource || "osm_building_outline";
  } else if (hasGla) {
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

  const isTracedOutline = method === "osm_building_outline" || method === "cadastral_lidar_osm_polygon";

  // 2. Attached Garage Addition (if not already counted in footprint)
  let garageAdditionSqft = 0;
  const hasGarage = input.hasGarage !== false;
  const garageAttached = input.garageAttached !== false;
  if (hasGarage && garageAttached) {
    const specifiedGarage = input.garageSqft && input.garageSqft > 150 ? input.garageSqft : 0;
    if (specifiedGarage) {
      garageAdditionSqft = specifiedGarage;
    } else if (!isTracedOutline) {
      garageAdditionSqft = stories > 1 ? 400 : 380;
    }
  }

  // 3. Eaves & Overhang Perimeter Calculation (overhang is 0 for traced outlines already at roof edge)
  const defaultOverhang = isTracedOutline ? 0 : 18;
  const overhangInches = input.eavesOverhangInches != null ? Math.max(0, input.eavesOverhangInches) : defaultOverhang;
  const overhangFeet = overhangInches / 12.0;

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
  let shapeComplexityMultiplier = 1.05;
  if (roofShape === "flat") shapeComplexityMultiplier = 1.01;
  else if (roofShape === "hip") shapeComplexityMultiplier = 1.08;
  else if (roofShape === "complex") shapeComplexityMultiplier = 1.16;

  // 6. Gross 3D Roof Surface Area & Roofing Squares
  const grossRoofSqft = Math.round(effectiveGroundFootprintSqft * pitchMultiplier * shapeComplexityMultiplier);
  const roofingSquares = Number((grossRoofSqft / 100.0).toFixed(1));

  // 7. Usable Solar Photovoltaic Plane Area
  const productiveAzimuthFraction = roofShape === "flat" ? 0.88 : 0.64;
  const fireCodeAndVentSetbackFraction = 0.18;
  const treeShadeFraction = Math.max(0, Math.min(0.35, Number(input.treeCanopyShadePct) || 0.05));

  const usableSolarSqft = Math.round(
    grossRoofSqft *
      productiveAzimuthFraction *
      (1 - fireCodeAndVentSetbackFraction) *
      (1 - treeShadeFraction)
  );

  // 8. Solar Capacity & Energy Yield
  const maxSolarPanels = Math.max(4, Math.floor(usableSolarSqft / 19.5));
  const solarDcKw = Number(((maxSolarPanels * 410) / 1000.0).toFixed(1));
  // Solar yield (kWh/yr) and re-roofing costs are not modeled: no sourced yield or installed-cost data is loaded.
  const annualYieldKwh = null;
  const materials = [];

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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    estimateAccurateRoofArea,
    getDefaultPitchRise,
  };
}

if (typeof window !== "undefined") {
  window.estimateAccurateRoofArea = estimateAccurateRoofArea;
  window.getDefaultPitchRise = getDefaultPitchRise;
}
