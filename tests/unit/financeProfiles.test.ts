// State finance profiles: what the tax-increment model may use (round 2 of the laws/finance audit, 16 Nov 2026).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FINANCE_CALC_FIELDS, financeProfileGate } from "../../src/engines/municipalFinanceEngine";

const root = path.resolve(__dirname, "../..");
const P = JSON.parse(fs.readFileSync(path.join(root, "app/data/state_finance_profiles.json"), "utf8"));
const app = fs.readFileSync(path.join(root, "app/app.js"), "utf8");
const UNSOURCED = ["non_pledgeable_share", "rsmeans_cost_multiplier", "tree_capital_cost_usd", "climate_energy_regime"];

describe("state finance profiles", () => {
  it("the four fields with no source in any state are gone (data, engine and page)", () => {
    for (const [st, r] of Object.entries(P) as [string, any][]) for (const f of UNSOURCED) expect(r[f], `${st}.${f}`).toBeUndefined();
    for (const f of ["src/engines/municipalFinanceEngine.js", "src/types/index.ts", "app/app.js"]) {
      const code = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\/.*$/gm, "");
      for (const k of UNSOURCED) expect(code.includes(`.${k}`) || code.includes(`${k}:`), `${f} uses ${k}`).toBe(false);
    }
    expect(fs.existsSync(path.join(root, "src/engines/residualProfitEngine.ts"))).toBe(false);
  });

  it("every confirmed or corrected field carries the source it was read in", () => {
    for (const [st, r] of Object.entries(P) as [string, any][]) {
      for (const [f, e] of Object.entries(r.field_evidence || {}) as [string, any][]) {
        // not_confirmed / corrected_to_unknown: the source was read but doesn't settle the value (e.g. CO's 2026 rate
        // depends on a board certification); such a field must stay listed as unverified.
        expect(["confirmed", "corrected", "not_confirmed", "corrected_to_unknown"], `${st}.${f}`).toContain(e.status);
        if (!["confirmed", "corrected"].includes(e.status)) expect(r.verification.unverified_fields, `${st}.${f}`).toContain(f);
        expect(e.source_url, `${st}.${f}`).toMatch(/^https:\/\//);
        expect(String(e.quote).length, `${st}.${f} quote`).toBeGreaterThan(20);
        expect(e.checked_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("round 4: every tax-increment field counted as confirmed has a fetched quote and source URL on file", () => {
    // A record marked verified (or a field left off unverified_fields in a partly verified record) must carry the
    // verbatim quote and URL it was confirmed from, field by field; a summary sentence in verification.evidence is not enough.
    for (const [st, r] of Object.entries(P) as [string, any][]) {
      const uf = (r.verification.unverified_fields || []).map((u: string) => String(u).split(/[\s(]/)[0]);
      for (const f of FINANCE_CALC_FIELDS) {
        if (uf.includes(f)) continue;
        const e = (r.field_evidence || {})[f];
        expect(e, `${st}.${f} is counted as confirmed but has no field_evidence`).toBeTruthy();
        expect(["confirmed", "corrected"], `${st}.${f}`).toContain(e.status);
        expect(e.source_url, `${st}.${f} source_url`).toMatch(/^https:\/\/[^\s]+\.[a-z]{2,}/);
        expect(String(e.quote).trim().length, `${st}.${f} quote`).toBeGreaterThan(20);
        expect(e.checked_on, `${st}.${f} checked_on`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (r.verification.status === "verified") {
        expect(uf.filter((f: string) => FINANCE_CALC_FIELDS.includes(f)), `${st} is verified but lists unverified fields`).toEqual([]);
        expect(r.last_verified, `${st}.last_verified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (r.verification.status === "unverified" || r.verification.status === "could_not_check") {
        expect(financeProfileGate(r).length, `${st} is ${r.verification.status} but the gate passes`).toBeGreaterThan(0);
      }
    }
  });

  it("round 4 (21 Nov 2026) corrections stay corrected", () => {
    expect(P.AL.annual_assessment_cap).toBe(0.07); // Act 2024-344: 7% cap on Class II and III (ALDOR)
    expect(P.AK.homestead_exemption_rule.type).toBe("none"); // AS 29.45.050(a): local option only, up to $75,000
    expect(P.AR.reassessment_cycle_years).toBe(4); // Act 139 of 2023 (ACD annual report 2025)
    expect(P.DC.homestead_exemption_rule.amount_or_pct).toBe(95100); // OTR, tax year 2027
    expect(P.IN.homestead_exemption_rule).toBeNull(); // the 1% circuit breaker caps the bill; it is not an exemption
    expect(P.ME.res_assessment_ratio).toBeNull(); // 36 M.R.S. 327: each town's ratio, 70% to 110%
    expect(P.ME.homestead_exemption_rule).toEqual({ type: "flat_market", amount_or_pct: 25000 }); // just value
    expect(P.NJ.res_assessment_ratio).toBe(1); // all 21 counties chose 100% (Division of Taxation)
    expect(P.NJ.reassessment_cycle_years).toBeNull(); // no fixed statewide cycle
    expect(P.NY.res_assessment_ratio).toBeNull(); // RPTL: uniform percentage, not necessarily 100%
    expect(P.PA.res_assessment_ratio).toBeNull(); // 53 Pa.C.S. 8842: county predetermined ratio
    expect(P.OK.uncaps_on_sale).toBe(true); // OAC 710:10-1-3: cap does not apply when title transfers
    expect(P.VT.reassessment_cycle_years).toBe(6); // Department of Taxes: every six years from Jan 2025
    expect(P.WI.reassessment_cycle_years).toBe(5); // s. 70.05(5)(b): within 10% once every five years
    expect(P.IL.reassessment_cycle_years).toBe(4); // PIO-16: four years outside Cook County
    expect(P.IL.homestead_exemption_rule.amount_or_pct).toBe(6000); // 35 ILCS 200/15-175, other counties
    expect(P.IL.scope_note).toMatch(/outside Cook County/); // the page must not present downstate figures as Cook's
    expect(app.match(/pf\.scope_note/g)?.length ?? 0).toBeGreaterThanOrEqual(2); // TIF section and methods panel
    expect(P.GA.homestead_exemption_rule.amount_or_pct).toBe(2000); // DOR: $2,000 off the 40% assessed value
    expect(P.SC.uncaps_on_sale).toBe(true); // 12-37-3140(A)(1)(b): value resets after an assessable transfer
    expect(P.VA.reassessment_cycle_years).toBe(4); // Va. Code 58.1-3252, counties
    expect(P.MA.reassessment_cycle_years).toBe(1); // G.L. c. 59, 2A: valuation as of 1 January each year
    expect(P.OH.homestead_exemption_rule).toBeNull(); // R.C. 323.152: seniors/disabled only, of true value
    expect(P.RI.res_assessment_ratio).toBeNull(); // R.I.G.L. 44-5-12: uniform percentage up to 100%
  });

  it("a calculator field counts as confirmed only when it is not listed as unverified", () => {
    for (const [st, r] of Object.entries(P) as [string, any][]) {
      const missing = financeProfileGate(r);
      const uf = (r.verification.unverified_fields || []).map((u: string) => String(u).split(/[\s(]/)[0]);
      for (const f of FINANCE_CALC_FIELDS) expect(missing.includes(f), `${st}.${f}`).toBe(uf.includes(f) || (r[f] == null && f !== "annual_assessment_cap"));
      if (missing.length) expect(r.verification.status, st).not.toBe("verified");
    }
  });

  it("corrections found in round 2 stay corrected", () => {
    expect(P.UT.res_assessment_ratio).toBe(1); // the 45% exemption is in homestead_exemption_rule; 0.55 double-counted it
    expect(P.UT.homestead_exemption_rule).toEqual({ type: "percent_market", amount_or_pct: 0.45 });
    expect(P.OH.reassessment_cycle_years).toBe(6); // R.C. 5713.01: at least once in each six-year period
    expect(P.MD.annual_assessment_cap).toBe(0.1); // Tax-Prop. 9-105: 110% homestead credit percentage (State tax)
    expect(P.NV.annual_assessment_cap).toBeNull(); // NRS 361.4723 caps the tax bill, not the assessment
    expect(P.NV.tax_bill_growth_cap).toBe(0.03);
    expect(P.IA.res_assessment_ratio).toBeNull(); // recalculated yearly by formula (Iowa Code 441.21)
    expect(P.MN.res_assessment_ratio).toBeNull(); // net tax capacity class rates, not an assessment ratio
    expect(P.SC.reassessment_increase_cap).toBe(0.15);
  });

  it("the page gates bond capacity on the same fields and never invents tax shares or a base value", () => {
    expect(app).toContain("function financeGateMissing(pf)");
    expect(app).toMatch(/Not computed: \$\{esc\(activeStateName\(\)\)\} tax rules not verified yet/);
    expect(app).not.toMatch(/a\.mv \* 0\.55/);
    expect(app).not.toMatch(/\[uninc \? 0 : 0\.20, 0\.24\]/);
    expect(app).not.toContain("function setEifdTurnover");
  });

  it("round 3: TX, FL, AZ, WA and CA have every tax-increment field confirmed; CO does not", () => {
    for (const st of ["TX", "FL", "AZ", "WA", "CA"]) expect(financeProfileGate(P[st]), st).toEqual([]);
    expect(financeProfileGate(P.CO)).toEqual(expect.arrayContaining(["res_assessment_ratio", "homestead_exemption_rule"]));
    // Texas: 2025 law raised the school homestead exemption to $140,000 (Comptroller); reappraisal is at least every 3 years.
    expect(P.TX.homestead_exemption_rule.amount_or_pct).toBe(140000);
    expect(P.TX.reassessment_cycle_years).toBe(3);
  });
});
