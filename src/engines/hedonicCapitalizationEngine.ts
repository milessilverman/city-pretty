export interface CandidateIntervention {
  id: string;
  name: string;
  evidenceGrade: "A" | "B" | "C" | "D" | "U";
  rawPriceLiftPct: number;       // Distance-decayed study price effect (e.g., 0.042 for +4.2%)
  studyStandardErrorPct: number; // Meta-analytic SE replacing arbitrary judgment bands
  lifecycleCostUsd: number;      // RSMeans-adjusted capital + 10-yr discounted upkeep
  localContextMultiplier: number;// Derived from ecoregion heat anomaly, canopy deficit, transit gap
}

export interface NeighborhoodBaseline {
  blockGroupGeoid: string;
  ecoregionId: string;
  medianHomeValueUsd: number;
  reachedHomesCount: number;
  isUrbanCore: boolean;
  renterShare: number;           // 0.0 to 1.0
  severeRentBurdenShare: number; // 0.0 to 1.0
  rentControlCoverage: number;   // 0.0 to 1.0
}

export function computeSubAdditivePackage(
  baseline: NeighborhoodBaseline,
  candidates: CandidateIntervention[],
  applyLocalContext: boolean
) {
  // Empirical neighborhood capitalization ceiling (prevents +30-50% linear stacking hallucinations)
  const pMax = baseline.isUrbanCore ? 0.30 : 0.22;

  // Sort by standalone marginal value per dollar first
  const scored = candidates
    .map((c) => {
      const adjLift = applyLocalContext
        ? c.rawPriceLiftPct * c.localContextMultiplier
        : c.rawPriceLiftPct;
      const standaloneValueAdded =
        baseline.medianHomeValueUsd * baseline.reachedHomesCount * adjLift;
      return {
        ...c,
        effectiveLiftPct: adjLift,
        standaloneRoiPerDollar: standaloneValueAdded / Math.max(1, c.lifecycleCostUsd),
        ci95HalfWidthPct: 1.96 * c.studyStandardErrorPct,
      };
    })
    .sort((a, b) => b.standaloneRoiPerDollar - a.standaloneRoiPerDollar);

  // Greedy marginal sub-additive accumulation: ΔP_joint = P_max * [1 - Π (1 - Δp_i / P_max)]
  let survivalProduct = 1.0;
  let cumulativeCostUsd = 0;

  const rankedMarginal = scored.map((item) => {
    const prevJointPct = pMax * (1 - survivalProduct);
    const clampedLift = Math.min(item.effectiveLiftPct, pMax * 0.95);
    survivalProduct *= 1 - clampedLift / pMax;
    const newJointPct = pMax * (1 - survivalProduct);

    const marginalLiftPct = newJointPct - prevJointPct;
    const marginalValueAddedUsd =
      baseline.medianHomeValueUsd * baseline.reachedHomesCount * marginalLiftPct;
    const marginalRoiPerDollar = marginalValueAddedUsd / Math.max(1, item.lifecycleCostUsd);

    if (marginalRoiPerDollar >= 1.0) {
      cumulativeCostUsd += item.lifecycleCostUsd;
    }

    return {
      ...item,
      marginalLiftPct,
      marginalRoiPerDollar,
      paysBackMarginally: marginalRoiPerDollar >= 1.0,
    };
  });

  const jointCapitalizationPct = pMax * (1 - survivalProduct);
  const jointValueAddedUsd =
    baseline.medianHomeValueUsd * baseline.reachedHomesCount * jointCapitalizationPct;

  // Renter Displacement Sensitivity Score (0-100)
  const vulnerabilityBase =
    0.4 * baseline.renterShare +
    0.35 * baseline.severeRentBurdenShare +
    0.25 * (1 - baseline.rentControlCoverage);
  const displacementRiskScore = Math.round(
    100 * vulnerabilityBase * Math.min(1, jointCapitalizationPct / 0.1)
  );

  return {
    jointCapitalizationPct,
    jointValueAddedUsd: Math.round(jointValueAddedUsd),
    totalPaybackPackageCostUsd: Math.round(cumulativeCostUsd),
    displacementRiskScore,
    projects: rankedMarginal,
  };
}
