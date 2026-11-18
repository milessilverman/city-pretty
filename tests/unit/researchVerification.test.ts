import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../../");
const load = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));
const research: any[] = load("app/data/research.json");
const cases: any[] = load("app/data/case_studies.json");
const hasDigit = (v: any) => typeof v === "string" && /\d/.test(v);

function checkBlock(rec: any) {
  const v = rec.verification;
  expect(v, `${rec.id} needs a verification block`).toBeTruthy();
  expect(typeof v.exists).toBe("boolean");
  expect(["supported", "not_found_in_abstract", "contradicted"]).toContain(v.finding);
  expect(v.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(v.evidence_url).toMatch(/^https?:\/\//);
  if (v.finding === "supported") expect(v.evidence_quote, `${rec.id} supported needs a quote`).toBeTruthy();
}

describe("research and case-study verification", () => {
  it("every research record has a verification block and exists", () => {
    expect(research.length).toBeGreaterThan(0);
    for (const r of research) { checkBlock(r); expect(r.verification.exists).toBe(true); }
  });
  it("research records that are not supported carry no numeric effect", () => {
    for (const r of research) {
      if (r.verification.finding === "supported") continue;
      expect(r.vpd, r.id).toBeNull();
      expect(r.impact === null || !hasDigit(r.impact), r.id).toBe(true);
    }
  });
  it("research ids are unique and no record is contradicted", () => {
    expect(new Set(research.map(r => r.id)).size).toBe(research.length);
    for (const r of research) expect(r.verification.finding).not.toBe("contradicted");
  });
  it("every case study has a verification block and exists", () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) { checkBlock(c); expect(c.verification.exists).toBe(true); }
  });
  it("case studies that are not supported carry no figures", () => {
    for (const c of cases) {
      if (c.verification.finding === "supported") continue;
      for (const f of ["publicCost", "privateCap", "ratio", "valueUplift", "taxGrowth", "trajectory"]) expect(c[f], `${c.id}.${f}`).toBeNull();
    }
  });
  it("no invented Year 3/7/12 trajectories remain", () => {
    for (const c of cases) expect(c.trajectory ?? null).toBeNull();
  });
});
