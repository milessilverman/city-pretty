import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VALUE_STREAM_KEYS, makeQuantity, makeUseOption, sumValueStreams } from "../../../src/platform/schema/index.js";
import {
  buildCashFlow, checkEligibility, compareDeliveryModels, contributionRange, debtService, dscr, equityMultiple, fundingStack,
  irr, mirr, municipalFiscalEffect, npv, paybackPeriod, riskAdjusted, sensitivity, solveMaxPrivate, underwrite,
  validateMechanismRecord, MECHANISM_TYPES,
} from "../../../src/platform/underwriting/index.js";

// FIXTURE: not real data. Every number below is synthetic and chosen so the answer can be checked by hand.
const SRC = { title: "FIXTURE", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const q = (value: number, low = value, high = value, unit = "USD") =>
  makeQuantity({ value, unit, low, high, status: "verified", source: SRC, jurisdiction: "XX", effectiveDate: "2000-01-01" });
const r = (value: number, low = value, high = value) => q(value, low, high, "ratio");
const asOf = "2000-01-01";

describe("metrics: NPV and IRR known answers", () => {
  it("NPV textbook cases", () => {
    // -100 + 110/1.1 = 0
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
    // -1000 + 500/1.1 + 500/1.21 + 500/1.331 = -1000 + 454.545 + 413.223 + 375.657 = 243.426
    expect(npv(0.1, [-1000, 500, 500, 500])).toBeCloseTo(243.426, 3);
    // rate 0: plain sum
    expect(npv(0, [-5, 2, 3])).toBe(0);
  });
  it("IRR textbook cases", () => {
    expect(irr([-100, 110]).value).toBeCloseTo(0.1, 10); // 110/100 - 1
    expect(irr([-100, 0, 121]).value).toBeCloseTo(0.1, 10); // sqrt(121/100) - 1
    const r3 = irr([-1000, 500, 500, 500]);
    // annuity factor 2 at three periods: 1/1.2338 + 1/1.2338^2 + 1/1.2338^3 = 2.000 -> IRR about 23.38%
    expect(r3.value).toBeCloseTo(0.2338, 4);
    expect(npv(r3.value as number, [-1000, 500, 500, 500])).toBeCloseTo(0, 6);
    expect(r3.multipleIrrPossible).toBe(false);
  });
  it("no sign change gives null with reason no_sign_change", () => {
    expect(irr([100, 100])).toMatchObject({ value: null, reason: "no_sign_change" });
    expect(irr([-100, -1])).toMatchObject({ value: null, reason: "no_sign_change" });
  });
  it("more than one sign change is flagged, both roots listed, MIRR given when rates are supplied", () => {
    // -100 + 230/x - 132/x^2 = 0 with x = 1+r  ->  100x^2 - 230x + 132 = 0  ->  x = 1.1 or 1.2
    const res = irr([-100, 230, -132], { financeRate: 0.1, reinvestmentRate: 0.1 });
    expect(res.multipleIrrPossible).toBe(true);
    expect(res.value).toBeNull();
    expect(res.reason).toBe("multiple_irr");
    expect(res.roots.length).toBe(2);
    expect(res.roots[0]).toBeCloseTo(0.1, 8);
    expect(res.roots[1]).toBeCloseTo(0.2, 8);
    // MIRR: PV(neg at 10%) = -100 - 132/1.21 = -209.0909; FV(pos at 10%) = 230*1.1 = 253; (253/209.0909)^(1/2) - 1 = sqrt(1.21) - 1 = 0.1
    expect(res.mirr).toBeCloseTo(0.1, 10);
    expect(mirr([-100, 230, -132], 0.1, 0.1)).toBeCloseTo(0.1, 10);
    expect(irr([-100, 230, -132]).mirrReason).toBe("finance_and_reinvestment_rates_not_supplied");
  });
  it("payback and equity multiple", () => {
    // cumulative -100, -70, -30, +20: payback = 2 + 30/50 = 2.6
    expect(paybackPeriod([-100, 30, 40, 50])).toBeCloseTo(2.6, 12);
    expect(paybackPeriod([-100, 10])).toBeNull();
    expect(equityMultiple([-100, 30, 40, 50])).toBeCloseTo(1.2, 12); // 120 / 100
  });
  it("debt service known answers", () => {
    // level: 1000 * 0.1 / (1 - 1.1^-3) = 100 / 0.248685 = 402.1148
    const lvl = debtService(1000, 0.1, 3, "level");
    expect(lvl.payment).toBeCloseTo(402.1148, 4);
    expect(lvl.schedule[0].interest).toBeCloseTo(100, 10);
    expect(lvl.schedule[2].balance).toBe(0);
    expect(lvl.schedule.reduce((a, x) => a + x.principal, 0)).toBeCloseTo(1000, 8);
    // interest-only: 100, 100, 1100
    expect(debtService(1000, 0.1, 3, "interest_only").schedule.map((x) => x.payment)).toEqual([100, 100, 1100].map((x) => expect.closeTo(x, 10)));
    expect(debtService(900, 0, 3, "level").payment).toBe(300);
    expect(dscr([120, 0], [100, 0])).toEqual([1.2, null]);
  });
});

describe("cash flow: coherent low/point/high series", () => {
  const base = () => ({
    periods: 3, asOf,
    capexSchedule: [q(100, 90, 120), q(0), q(0)],
    omSchedule: [q(0), q(10, 8, 12), q(10, 8, 12)],
    revenueSchedule: [q(0), q(70, 60, 80), q(70, 60, 80)],
    financing: null,
  });
  it("low = low revenue with high costs; high = high revenue with low costs", () => {
    const cf = buildCashFlow(base() as any);
    // point: [-100, 70-10, 70-10]; low: [-120, 60-12, 60-12]; high: [-90, 80-8, 80-8]
    expect(cf.cases.unleveredNet).toEqual({ point: [-100, 60, 60], low: [-120, 48, 48], high: [-90, 72, 72] });
    expect(cf.series.unleveredNet[1]).toMatchObject({ value: 60, low: 48, high: 72, status: "estimated" });
    // IRR is computed on each coherent series, so low-case IRR is the IRR of [-120, 48, 48], not of mixed bounds
    const lowIrr = irr(cf.cases.unleveredNet!.low).value as number;
    expect(npv(lowIrr, [-120, 48, 48])).toBeCloseTo(0, 8);
    expect(lowIrr).toBeLessThan(irr(cf.cases.unleveredNet!.point).value as number);
    expect(cf.status).toBe("ok");
  });
  it("a missing input makes dependent outputs requires_investigation with the missing list; unknown is not zero", () => {
    const b: any = base();
    b.revenueSchedule[2] = undefined;
    const cf = buildCashFlow(b);
    expect(cf.status).toBe("requires_investigation");
    expect(cf.missing).toContain("revenueSchedule[2]");
    expect(cf.cases.unleveredNet).toBeNull();
    expect(cf.series.unleveredNet[0]).toMatchObject({ value: null, status: "requires_investigation" });
    const c2: any = base();
    delete c2.financing;
    const cf2 = buildCashFlow(c2);
    expect(cf2.cases.unleveredNet).not.toBeNull(); // unlevered does not depend on financing
    expect(cf2.cases.levered).toBeNull();
    expect(cf2.missing[0]).toMatch(/^financing/);
  });
  it("financing: draw, level debt service with the rate range, DSCR", () => {
    const b: any = base();
    b.financing = { principal: q(100), rate: r(0.1, 0.08, 0.12), termPeriods: 2, type: "level", drawPeriod: 0 };
    const cf = buildCashFlow(b);
    // point DS = 100*0.1/(1-1.1^-2) = 57.6190; low case (adverse) uses 12%: 100*0.12/(1-1.12^-2) = 59.1698
    expect(cf.cases.debtService!.point[1]).toBeCloseTo(57.619, 3);
    expect(cf.cases.debtService!.low[1]).toBeCloseTo(59.1698, 3);
    expect(cf.cases.levered!.point[0]).toBeCloseTo(0, 10); // -100 capex + 100 draw
    expect(cf.cases.levered!.point[1]).toBeCloseTo(60 - 57.619, 3);
    expect(cf.dscr!.point[1]).toBeCloseTo(60 / 57.619, 4);
    b.financing.termPeriods = 3; // repayment would run past the last period
    expect(buildCashFlow(b).dependentMissing.levered.join(" ")).toMatch(/horizon/);
  });
});

describe("risk-adjusted return", () => {
  const p = (v: number) => r(v);
  it("needs stated probabilities summing to 1", () => {
    expect(riskAdjusted({ scenarios: [{ name: "a", probability: undefined as any, flows: [-100, 110] }], discountRate: r(0.1) }).status).toBe("requires_investigation");
    const bad = riskAdjusted({ scenarios: [{ name: "a", probability: p(0.5), flows: [-100, 110] }, { name: "b", probability: p(0.4), flows: [-100, 88] }], discountRate: r(0.1) });
    expect(bad.status).toBe("requires_investigation");
    expect(bad.missing.join(" ")).toMatch(/sum to/);
    expect(bad.expectedNpv.value).toBeNull();
  });
  it("expected NPV, IRR range and probability of loss from stated scenarios", () => {
    // NPV at 10%: [-100,110] -> 0; [-100,88] -> -20. Expected = 0.5*0 + 0.5*(-20) = -10. IRRs 10% and -12%.
    const res = riskAdjusted({ scenarios: [{ name: "up", probability: p(0.5), flows: [-100, 110] }, { name: "down", probability: p(0.5), flows: [-100, 88] }], discountRate: r(0.1) });
    expect(res.status).toBe("ok");
    expect(res.expectedNpv.value).toBeCloseTo(-10, 10);
    expect(res.probabilityNpvNegative).toBeCloseTo(0.5, 12);
    expect(res.irrDistribution!.min).toBeCloseTo(-0.12, 10);
    expect(res.irrDistribution!.max).toBeCloseTo(0.1, 10);
    expect(res.irrDistribution as any).not.toHaveProperty("certaintyEquivalent");
  });
  it("one-at-a-time sensitivity table, sorted by swing", () => {
    // output = 2a + b; a in [1,3] swings 4, b in [0,1] swings 1
    const t = sensitivity({ evaluate: (x) => 2 * x.a + x.b, inputs: { a: 2, b: 0.5 } }, [{ name: "b", low: 0, high: 1 }, { name: "a", low: 1, high: 3 }]);
    expect(t.baseOutput).toBe(4.5);
    expect(t.rows.map((x) => [x.driver, x.swing])).toEqual([["a", 4], ["b", 1]]);
  });
});

describe("contribution: max private, min public, both-benefit range", () => {
  const stream = (flows: number[], k = "public") => ({ flows: flows.map((x) => q(x)), capturedBy: k, mechanism: "none_identified" });
  // cost 1500 at t0; private receives 1100 at t1; hurdle 10% -> PV of private flows = 1000 -> max private = 1000, min public = 500
  const base = (over: any = {}) => ({
    costSchedule: [q(1500), q(0)], privateNetFlows: [q(0), q(1100)], hurdleRate: r(0.1), publicDiscountRate: r(0.05),
    publicStreams: { publicEconomicBenefit: stream([0, 420]), municipalTaxRevenue: stream([0, 210], "municipality") },
    countable: { streams: ["publicEconomicBenefit"] }, privateMechanism: "ground_lease_fixture", ...over,
  });
  it("max private = largest contribution meeting the hurdle; verified by plugging it back in", () => {
    const res = contributionRange(base());
    expect(res.maxPrivateContribution.value).toBeCloseTo(1000, 6);
    // private flows with that contribution: [-1000, 1100] -> IRR = 10% = hurdle
    expect(irr([-(res.maxPrivateContribution.value as number), 1100]).value).toBeCloseTo(0.1, 8);
    expect(res.minPublicContribution.value).toBeCloseTo(500, 6); // 1500 - 1000
    expect(res.fundingGap).toBe(res.minPublicContribution);
  });
  it("multi-period pro-rata contribution solved by bisection; plug-in IRR equals hurdle", () => {
    // K = [600, 400], F = [0, 0, 605], h = 10%: PV(F) = 605/1.21 = 500; PV(K) = 600 + 400/1.1 = 963.636
    // share s = 500/963.636 = 0.518868; C = s*1000 = 518.868; min public = 481.132
    const res = contributionRange(base({ costSchedule: [q(600), q(400), q(0)], privateNetFlows: [q(0), q(0), q(605)],
      publicStreams: {}, countable: undefined }));
    const C = res.maxPrivateContribution.value as number;
    expect(C).toBeCloseTo(518.868, 2);
    const s = C / 1000;
    const priv = irr([-s * 600, -s * 400, 605]);
    expect(priv.value).toBeCloseTo(0.1, 8);
    expect(res.minPublicContribution.value).toBeCloseTo(1000 - C, 8);
    expect(res.publicCeiling.value).toBeNull(); // no countable streams -> unknown, never zero
    expect(res.range.deal).toBe("unknown");
  });
  it("min public floored at 0 when private can fund everything; equals total cost when private flows miss the hurdle", () => {
    const rich = contributionRange(base({ privateNetFlows: [q(0), q(5000)] }));
    expect(rich.maxPrivateContribution.value).toBe(1500);
    expect(rich.minPublicContribution.value).toBe(0);
    expect(rich.privateByCase!.point.cappedAtTotalCost).toBe(true);
    const poor = contributionRange(base({ privateNetFlows: [q(0), q(-10)] }));
    expect(poor.maxPrivateContribution.value).toBe(0);
    expect(poor.minPublicContribution.value).toBe(1500);
  });
  it("no deal when the public ceiling is below the minimum public contribution", () => {
    // ceiling = PV(420 at 5%) = 400 < min public PV 500 -> no deal, short by 100
    const res = contributionRange(base());
    expect(res.publicCeiling.value).toBeCloseTo(400, 8);
    expect(res.range.deal).toBe("no_deal");
    expect(res.range.shortBy.value).toBeCloseTo(100, 6);
  });
  it("streams are not summed without a stated no-overlap basis; with one, the range is [min public, ceiling]", () => {
    // PVs: 420/1.05 = 400 and 210/1.05 = 200
    const noBasis = contributionRange(base({ countable: { streams: ["publicEconomicBenefit", "municipalTaxRevenue"] } }));
    expect(noBasis.publicCeiling.value).toBeCloseTo(400, 8); // largest single stream, not 600
    expect(noBasis.range.deal).toBe("no_deal");
    const withBasis = contributionRange(base({ countable: { streams: ["publicEconomicBenefit", "municipalTaxRevenue"], basis: "FIXTURE: streams accrue to different budgets" } }));
    expect(withBasis.publicCeiling.value).toBeCloseTo(600, 8);
    expect(withBasis.range.deal).toBe("both_benefit");
    expect(withBasis.range.from.value).toBeCloseTo(500, 6);
    expect(withBasis.range.to.value).toBeCloseTo(600, 6);
    // the recommendation is the minimum, never the ceiling
    expect(withBasis.recommendedPublicContribution.value).toBeCloseTo(500, 6);
    expect(withBasis.publicValueByStream.municipalTaxRevenue.pv.value).toBeCloseTo(200, 8);
    expect(withBasis.capture.find((c: any) => c.party === "private")).toMatchObject({ stream: "investorCashFlow", mechanism: "ground_lease_fixture" });
  });
  it("low/point/high cases are coherent", () => {
    // low: F = 1000, h = 12%, K = 1600 -> max private 1000/1.12 = 892.857, min public 707.143
    // high: F = 1200, h = 8%, K = 1400 -> max private 1200/1.08 = 1111.111, min public 288.889
    const res = contributionRange(base({ costSchedule: [q(1500, 1400, 1600), q(0)], privateNetFlows: [q(0), q(1100, 1000, 1200)], hurdleRate: r(0.1, 0.08, 0.12) }));
    expect(res.maxPrivateContribution.low).toBeCloseTo(892.857, 2);
    expect(res.maxPrivateContribution.high).toBeCloseTo(1111.111, 2);
    expect(res.minPublicContribution.high).toBeCloseTo(707.143, 2);
    expect(res.minPublicContribution.low).toBeCloseTo(288.889, 2);
  });
  it("solveMaxPrivate core", () => {
    expect(solveMaxPrivate([1500, 0], [0, 1100], 0.1).contribution).toBeCloseTo(1000, 6);
  });
});

describe("delivery models: lifecycle cost and risk allocation", () => {
  const sch = (xs: number[]) => xs.map((x) => q(x));
  const conventional = {
    capex: sch([100, 0, 0]), om: sch([0, 10, 10]), renewal: sch([0, 0, 5]), financing: null, transactionCost: q(2),
    riskRegister: [{ risk: "construction overrun", allocatedTo: "public", expectedCost: q(20) }],
  };
  const p3 = {
    capex: sch([100, 0, 0]), om: sch([0, 9, 9]), renewal: sch([0, 0, 5]),
    financing: { rate: r(0.1), termPeriods: 2, type: "level" }, transactionCost: q(5),
    riskRegister: [
      { risk: "construction overrun", allocatedTo: "private", expectedCost: q(20) },
      { risk: "demand", allocatedTo: "shared", expectedCost: q(10), publicShare: r(0.5) },
    ],
  };
  it("lifecycle PV, retained and transferred risk, value for money", () => {
    const res = compareDeliveryModels({ periods: 3, publicDiscountRate: r(0.1), models: { conventional, p3 } as any });
    // conventional: 2 + 100 + 10/1.1 + 15/1.21 = 123.4876; + retained risk 20 = 143.4876
    expect(res.models.conventional.lifecycleCostPv.value).toBeCloseTo(123.4876, 3);
    expect(res.models.conventional.totalPublicCostPv.value).toBeCloseTo(143.4876, 3);
    // p3: debt at 10% discounted at 10% has PV 100; 5 + 100 + 9/1.1 + 14/1.21 = 124.7521; retained 0 + 0.5*10 = 5; transferred 20 + 5 = 25
    expect(res.models.p3.lifecycleCostPv.value).toBeCloseTo(124.7521, 3);
    expect(res.models.p3.publicRetainedRisk.value).toBeCloseTo(5, 10);
    expect(res.models.p3.riskTransferred.value).toBeCloseTo(25, 10);
    // VfM = 143.4876 - 129.7521 = 13.7355 (positive favours P3)
    expect(res.valueForMoney.value).toBeCloseTo(13.7355, 3);
    expect(res.riskAllocation.filter((x: any) => x.model === "p3").map((x: any) => [x.risk, x.allocatedTo, x.publicPortion.value])).toEqual([
      ["construction overrun", "private", 0], ["demand", "shared", 5]]);
    expect(res.models.private.status).toBe("requires_investigation");
  });
  it("no efficiency is assumed: a missing model makes value for money requires_investigation", () => {
    const res = compareDeliveryModels({ periods: 3, publicDiscountRate: r(0.1), models: { conventional } as any });
    expect(res.status).toBe("requires_investigation");
    expect(res.valueForMoney.value).toBeNull();
    expect(res.valueForMoney.inputs).toContain("models.p3");
  });
  it("shared risk without a public share is unknown, not split by default", () => {
    const p3b = { ...p3, riskRegister: [{ risk: "demand", allocatedTo: "shared", expectedCost: q(10) }] };
    const res = compareDeliveryModels({ periods: 3, publicDiscountRate: r(0.1), models: { conventional, p3: p3b } as any });
    expect(res.models.p3.status).toBe("requires_investigation");
  });
  it("fully private is not applicable when revenue cannot meet the hurdle", () => {
    // NPV at 10% = -123.4876 + 30/1.1 + 30/1.21 = -123.4876 + 27.2727 + 24.7934 = -71.4215 < 0
    const priv = { ...conventional, revenue: sch([0, 30, 30]), hurdleRate: r(0.1) };
    const res = compareDeliveryModels({ periods: 3, publicDiscountRate: r(0.1), models: { conventional, p3, private: priv } as any });
    expect(res.models.private.status).toBe("not_applicable");
    expect(res.models.private.reason).toMatch(/^revenue_cannot_meet_hurdle/);
    expect(res.models.private.npvAtHurdleByCase.point).toBeCloseTo(-71.4215, 3);
  });
});

describe("municipal fiscal effect", () => {
  const ruleCA = { id: "fixture-ca-style", state: "CA", source: SRC, annualIncreaseCap: r(0.02), reassessOnSale: true };
  const ruleTX = { id: "fixture-tx-market", state: "TX", source: SRC, annualIncreaseCap: null, reassessOnSale: false };
  const spec = (over: any = {}) => ({
    project: { state: "TX" }, assessedValueChange: q(1000), marketValueGrowth: r(0.05), taxRate: r(0.01), jurisdictionShare: r(0.5),
    assessmentRule: ruleTX, otherRevenues: [q(1), q(1), q(1)], serviceCosts: [q(2), q(2), q(2)], horizon: 3, ...over,
  });
  it("refuses a California-style rule for a Texas project", () => {
    const res = municipalFiscalEffect(spec({ assessmentRule: ruleCA }));
    expect(res.status).toBe("refused");
    expect(res.reason).toBe("assessment_rule_jurisdiction_mismatch");
    expect(res.municipalTaxRevenue.byYear[0].value).toBeNull();
  });
  it("applies an uncapped rule: AV 1000, 1050, 1102.5 x 1% x 50%", () => {
    const res = municipalFiscalEffect(spec());
    expect(res.municipalTaxRevenue.byYear.map((x: any) => x.value)).toEqual([5, 5.25, 5.5125].map((x) => expect.closeTo(x, 10)));
    // net = tax + 1 - 2
    expect(res.netFiscalEffectByYear[0].value).toBeCloseTo(4, 10);
    expect(res.separation.notMergedWith).toEqual(["investorCashFlow", "propertyAppreciation"]);
    expect(Object.keys(res)).not.toContain("investorCashFlow");
  });
  it("applies a capped rule with reassessment on sale generically (same-state project)", () => {
    // cap 2%: AV 1000, 1020; sale in year 2 resets to market 1000*1.05^2 = 1102.5
    const res = municipalFiscalEffect(spec({ project: { state: "CA" }, assessmentRule: ruleCA, saleYears: [2] }));
    expect(res.assessedValuePath!.point).toEqual([1000, 1020, 1102.5].map((x) => expect.closeTo(x, 9)));
    const noSale = municipalFiscalEffect(spec({ project: { state: "CA" }, assessmentRule: ruleCA, saleYears: [] }));
    expect(noSale.assessedValuePath!.point[2]).toBeCloseTo(1040.4, 9);
    expect(municipalFiscalEffect(spec({ project: { state: "CA" }, assessmentRule: ruleCA })).missing.join(" ")).toMatch(/saleYears/);
  });
  it("unknown project state or missing inputs give requires_investigation", () => {
    expect(municipalFiscalEffect(spec({ project: {} })).status).toBe("requires_investigation");
    expect(municipalFiscalEffect(spec({ taxRate: undefined })).municipalTaxRevenue.byYear[0].value).toBeNull();
  });
});

describe("funding mechanisms", () => {
  const rec = (over: any = {}) => ({
    id: "fx", mechanismType: "federal_grant", name: "FIXTURE grant",
    jurisdiction: { level: "federal", state: null, countyFips: null, place: null },
    legalBasis: { citation: "FIXTURE 1", url: "https://example.invalid/law", publisher: "FIXTURE", primary: true, retrieved: asOf, textCurrency: "FIXTURE" },
    quotes: [{ topic: "eligibility", text: "FIXTURE quote", sourceUrl: "https://example.invalid/q" }, { topic: "limit", text: "FIXTURE share" }],
    rules: [{ field: "project.use", op: "eq", value: "housing", quoteIndex: 0, alternativeGroup: null }],
    publicShare: { maxShareOfEligibleCost: null, quoteIndex: null }, matchRequirement: null, deadlineOrSunset: null,
    certainty: "by_right", capturedValueStream: null, status: "verified", reason: "", notRepresented: [], ...over,
  });
  it("validator accepts a good record and rejects bad ones", () => {
    expect(validateMechanismRecord(rec())).toEqual({ valid: true, errors: [] });
    expect(validateMechanismRecord(rec({ mechanismType: "magic" })).valid).toBe(false);
    expect(validateMechanismRecord(rec({ rules: [{ field: "project.colour", op: "eq", value: 1, quoteIndex: 0, alternativeGroup: null }] })).valid).toBe(false);
    expect(validateMechanismRecord(rec({ jurisdiction: { level: "state", state: null } })).valid).toBe(false);
    expect(MECHANISM_TYPES).toHaveLength(15);
  });
  it("eligible, ineligible, and unknown (an undefined field is never ineligible)", () => {
    expect(checkEligibility(rec(), { use: "housing" }).result).toBe("eligible");
    expect(checkEligibility(rec(), { use: "office" })).toMatchObject({ result: "ineligible" });
    const u = checkEligibility(rec(), {});
    expect(u.result).toBe("unknown");
    expect(u.unknownFields).toEqual(["project.use"]);
    expect(checkEligibility(rec({ status: "requires_investigation", reason: "FIXTURE not read" }), { use: "housing" }).result).toBe("unknown");
    expect(checkEligibility(rec(), { use: "housing" }).quotesUsed[0]).toMatchObject({ index: 0, text: "FIXTURE quote" });
  });
  it("alternativeGroup labels: AND within a label, OR across labels; open label gives unknown", () => {
    const rules = [
      { field: "project.use", op: "eq", value: "rental", quoteIndex: 0, alternativeGroup: null },
      { field: "project.affordableUnitShare", op: "gte", value: 0.2, quoteIndex: 0, alternativeGroup: "a" },
      { field: "project.affordableIncomeLimitPctAmi", op: "lte", value: 50, quoteIndex: 0, alternativeGroup: "a" },
      { field: "project.affordableUnitShare", op: "gte", value: 0.4, quoteIndex: 0, alternativeGroup: "b" },
      { field: "project.affordableIncomeLimitPctAmi", op: "lte", value: 60, quoteIndex: 0, alternativeGroup: "b" },
    ];
    const R = rec({ rules });
    expect(checkEligibility(R, { use: "rental", affordableUnitShare: 0.2, affordableIncomeLimitPctAmi: 50 }).result).toBe("eligible"); // label a
    expect(checkEligibility(R, { use: "rental", affordableUnitShare: 0.4, affordableIncomeLimitPctAmi: 60 }).result).toBe("eligible"); // label b
    // 20% of units at 60% AMI: label a fails on income, label b fails on share -> ineligible (no single label holds in full)
    expect(checkEligibility(R, { use: "rental", affordableUnitShare: 0.2, affordableIncomeLimitPctAmi: 60 }).result).toBe("ineligible");
    // share 0.5 known, income limit unknown: neither label fails outright -> unknown
    const u = checkEligibility(R, { use: "rental", affordableUnitShare: 0.5 });
    expect(u.result).toBe("unknown");
    expect(u.unknownFields).toEqual(["project.affordableIncomeLimitPctAmi"]);
    // null-group rule fails -> ineligible even with a label holding
    expect(checkEligibility(R, { use: "office", affordableUnitShare: 0.4, affordableIncomeLimitPctAmi: 60 }).result).toBe("ineligible");
  });
  it("empty rules give unknown with notRepresented, never eligible by default", () => {
    const res = checkEligibility(rec({ rules: [], notRepresented: ["FIXTURE: activity list not encoded"] }), { use: "housing", state: "TX" });
    expect(res.result).toBe("unknown");
    expect(res.notRepresented).toEqual(["FIXTURE: activity list not encoded"]);
  });
  it("jurisdiction gate uses jurisdiction.state even with no project.state rule", () => {
    const stateRec = rec({ id: "fx-ca", mechanismType: "special_assessment", jurisdiction: { level: "state", state: "CA", countyFips: null, place: null },
      rules: [{ field: "project.hasLocalApproval", op: "is_true", value: true, quoteIndex: 0, alternativeGroup: null }] });
    const tx = checkEligibility(stateRec, { state: "TX", hasLocalApproval: true });
    expect(tx).toMatchObject({ result: "ineligible", reason: "jurisdiction" });
    expect(checkEligibility(stateRec, { state: "CA", hasLocalApproval: true }).result).toBe("eligible");
    expect(checkEligibility(stateRec, { hasLocalApproval: true })).toMatchObject({ result: "unknown", reason: "jurisdiction" });
  });
  it("funding stack: ordered by certainty, capped, never secured, minimum subsidy not raised", () => {
    const gap = q(500);
    const competitive = rec({ id: "fx-comp", certainty: "competitive", publicShare: { maxShareOfEligibleCost: 0.8, quoteIndex: 1 },
      matchRequirement: { text: "FIXTURE 20% match", quoteIndex: 1 } });
    const byRight = rec({ id: "fx-right", certainty: "by_right", publicShare: { maxShareOfEligibleCost: 0.1, quoteIndex: 1 } });
    const res = fundingStack({ gap, candidates: [competitive, byRight], project: { use: "housing", eligibleCostUsd: 1500 }, asOf });
    expect(res.securedAmount.value).toBe(0);
    expect(res.potential.map((x: any) => x.id)).toEqual(["fx-right", "fx-comp"]);
    // by-right: 0.1 * 1500 = 150; competitive: min(0.8*1500 = 1200, 500 - 150 = 350) = 350
    expect(res.potential[0].amount.value).toBeCloseTo(150, 10);
    expect(res.potential[1].amount.value).toBeCloseTo(350, 10);
    expect(res.potential.every((x: any) => x.amount.status !== "verified" && x.guaranteed === false)).toBe(true);
    expect(res.potential[1].neverGuaranteed).toBe(true);
    expect(res.potential[1].matchRequirement.text).toBe("FIXTURE 20% match");
    // 1200 of competitive money exists but the minimum public subsidy stays at the gap (500), never raised
    expect(res.minimumPublicSubsidy.value).toBe(500);
    expect(res.remainingGap.value).toBe(500); // nothing secured
    const awarded = fundingStack({ gap, candidates: [byRight], project: { use: "housing", eligibleCostUsd: 1500 }, asOf,
      awards: [{ mechanismId: "fx-right", amount: q(150), awardRecord: SRC }] });
    expect(awarded.securedAmount.value).toBe(150);
    expect(awarded.remainingGap.value).toBe(350);
  });
  it("the real catalogue validates (sibling data file)", () => {
    const path = fileURLToPath(new URL("../../../src/platform/underwriting/data/funding_mechanisms.json", import.meta.url));
    if (!existsSync(path)) {
      console.warn("SKIP: src/platform/underwriting/data/funding_mechanisms.json is absent");
      return;
    }
    const data = JSON.parse(readFileSync(path, "utf8"));
    const bad = data.records.map((x: any) => ({ id: x.id, ...validateMechanismRecord(x) })).filter((x: any) => !x.valid);
    expect(bad).toEqual([]);
    for (const x of data.records) {
      const res = checkEligibility(x, { state: "TX" });
      if (x.jurisdiction.level === "state" && x.jurisdiction.state !== "TX") expect(res.result).toBe("ineligible");
    }
  });
});

describe("underwrite: orchestration and financial check", () => {
  const sch = (xs: number[]) => xs.map((x) => q(x));
  const project = (over: any = {}) => ({
    id: "fx-1", use: "develop", asOf, state: "TX", periods: 3,
    capexSchedule: [q(1000, 950, 1050), q(0), q(0)], omSchedule: sch([0, 50, 50]), revenueSchedule: [q(0), q(650, 600, 700), q(650, 600, 700)],
    financing: null, hurdleRate: r(0.1), publicDiscountRate: r(0.05),
    publicStreams: { publicEconomicBenefit: { flows: sch([0, 0, 441]), capturedBy: "public", mechanism: "none_identified" } },
    countable: { streams: ["publicEconomicBenefit"] },
    fiscal: { assessedValueChange: q(1000), marketValueGrowth: r(0), taxRate: r(0.01), jurisdictionShare: r(1),
      assessmentRule: { id: "fx-tx", state: "TX", source: SRC, annualIncreaseCap: null, reassessOnSale: false },
      otherRevenues: sch([0, 0, 0]), serviceCosts: sch([0, 0, 0]), horizon: 3 },
    ...over,
  });
  it("pass when the low-case IRR meets the hurdle; seven separate value streams", () => {
    // point case [-1000, 600, 600]: IRR solves 600/x + 600/x^2 = 1000 -> x = 1.1307, 13.07% >= 10% hurdle
    const res = underwrite(project({ designatedCase: "point" }));
    expect(res.financialCheck.result).toBe("pass");
    expect(Object.keys(res.valueStreams).sort()).toEqual([...VALUE_STREAM_KEYS].sort());
    expect(() => sumValueStreams(res.valueStreams)).toThrow();
    expect(res.valueStreams.municipalTaxRevenue.amount.value).toBeCloseTo(10 + 10 / 1.05 + 10 / 1.1025, 8);
    expect(res.valueStreams.propertyAppreciation.amount.value).toBeNull();
    expect(makeUseOption({ use: "develop", checks: { financial: res.financialCheck } as any }).checks.financial!.result).toBe("pass");
  });
  it("low case below hurdle but a non-empty both-benefit range passes; empty range fails", () => {
    // low case [-1050, 550, 550]: PV at 10% of 550, 550 = 954.545 < 1050, so the IRR misses the hurdle;
    // max private 954.545, min public 1050 - 954.545 = 95.455
    // ceiling at 5% (public rate has no range): 441/1.1025 = 400 >= 95.455 -> both benefit
    const pass = underwrite(project());
    expect(pass.financialCheck.result).toBe("pass");
    expect(pass.contribution.minPublicContribution.high).toBeCloseTo(1050 - 550 / 1.1 - 550 / 1.21, 6);
    const fail = underwrite(project({ publicStreams: { publicEconomicBenefit: { flows: sch([0, 0, 11.025]), capturedBy: "public", mechanism: "none_identified" } } }));
    // ceiling 10 < 95.455 -> no deal -> fail
    expect(fail.financialCheck.result).toBe("fail");
    expect(fail.financialCheck.basis).toBe("financial");
  });
  it("missing inputs give unknown, never pass or fail", () => {
    const res = underwrite(project({ hurdleRate: undefined }));
    expect(res.financialCheck.result).toBe("unknown");
    expect(res.financialCheck.missing).toContain("hurdleRate");
    const noPublic = underwrite(project({ countable: undefined }));
    expect(noPublic.financialCheck.result).toBe("unknown");
  });
  it("minimum not maximum subsidy: extra available grant money does not raise the recommended public contribution", () => {
    const grant = { id: "fx-big", mechanismType: "federal_grant", name: "FIXTURE big grant",
      jurisdiction: { level: "federal", state: null, countyFips: null, place: null },
      legalBasis: { citation: "FIXTURE", url: "https://example.invalid/g", publisher: "FIXTURE", primary: true, retrieved: asOf, textCurrency: "FIXTURE" },
      quotes: [{ topic: "eligibility", text: "FIXTURE" }], rules: [{ field: "project.use", op: "eq", value: "develop", quoteIndex: 0, alternativeGroup: null }],
      publicShare: { maxShareOfEligibleCost: 1, quoteIndex: 0 }, matchRequirement: null, deadlineOrSunset: null, certainty: "competitive",
      capturedValueStream: null, status: "verified", reason: "", notRepresented: [] };
    const without = underwrite(project());
    const withGrant = underwrite(project({ funding: { candidates: [grant], descriptor: { use: "develop", eligibleCostUsd: 1_000_000 } } }));
    expect(withGrant.contribution.recommendedPublicContribution.value).toBe(without.contribution.recommendedPublicContribution.value);
    const f: any = withGrant.funding;
    expect(f.minimumPublicSubsidy.value).toBe(without.contribution.minPublicContribution.value);
    expect(f.potential[0].amount.value).toBeCloseTo(without.contribution.minPublicContribution.value as number, 8); // capped at the gap, not 1,000,000
    expect(f.securedAmount.value).toBe(0);
  });
  it("benchmark: 10,000 underwrite runs within 3 s", () => {
    const p = project({ designatedCase: "point" });
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) underwrite(p);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(3000);
  });
});
