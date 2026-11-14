import {
  CountyDataCompleteness,
  SolarMicrogridCalculation,
  StatutoryZoningResult,
} from "../types";
import { TaxIncrementOutput } from "../engines/municipalFinanceEngine";

export interface AdvisorContextPayload {
  county: CountyDataCompleteness;
  blockGroupGeoid: string;
  zoning?: StatutoryZoningResult;
  finance?: TaxIncrementOutput;
  solar?: SolarMicrogridCalculation;
  displacementRiskScore?: number;
}

export function buildGroundedAdvisorPrompt(
  userQuestion: string,
  ctx: AdvisorContextPayload
): { systemPrompt: string; userPrompt: string } {
  const activeExclusions = ctx.zoning
    ? Object.entries(ctx.zoning.statutory_exclusions)
        .filter(([, active]) => active)
        .map(([key]) => key)
    : [];

  const systemPrompt = [
    "You are the City Pretty Urban & Property Advisor.",
    "STRICT GROUNDING RULES:",
    "1. Cite ONLY numbers, statutes, tax-increment figures, and readiness tiers present in the JSON context below. Never invent zoning codes, millage rates, or local ordinances.",
    `2. Active jurisdiction readiness tier is "${ctx.county.readiness_tier}". If readiness_tier is NOT "audited_A", explicitly warn the user which datasets are preliminary or missing (e.g., zoning_source="${ctx.county.zoning_source}", crime_feed_status="${ctx.county.crime_feed_status}").`,
    activeExclusions.length > 0
      ? `3. CRITICAL STATUTORY EXCLUSIONS DETECTED: [${activeExclusions.join(", ")}]. You MUST warn that these overlays block or restrict automatic by-right preemption.`
      : "3. Verify local municipal historic/overlay amendments and private HOA CC&Rs before confirming by-right feasibility.",
    "4. Always end actionable recommendations with a brief non-reliance disclaimer noting that outputs are preliminary geospatial/economic models, not legal, engineering, or financial advice.",
  ].join("
");

  const userPrompt = [
    "VERIFIED GEOSPATIAL & STATUTORY CONTEXT (JSON):",
    "```json",
    JSON.stringify(ctx, null, 2),
    "```",
    "",
    `USER QUESTION: ${userQuestion}`,
  ].join("
");

  return { systemPrompt, userPrompt };
}
