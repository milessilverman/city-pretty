import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const load = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "../..", p), "utf-8"));

// 19 Nov 2026 comparison with the other branch's evidence (docs/audit/branch-evidence-comparison-2026-11-19.md).
describe("19 Nov 2026 study, program and project corrections", () => {
  it("studies whose existence could not be confirmed and whose cited page is dead are not listed", () => {
    const ids = load("app/data/research.json").map((r: any) => r.id);
    for (const gone of ["art_008", "tree_006", "hist_004", "hist_006", "hist_008", "hist_009", "transit_002", "bike_001", "bike_004"]) expect(ids).not.toContain(gone);
  });

  it("an effect size restored this day carries its quote in field_evidence, and is not also listed as unverified", () => {
    const rs = load("app/data/research.json");
    for (const id of ["tree_002", "hist_001", "hist_002", "park_001", "park_003", "solar_001", "hist_007"]) {
      const r = rs.find((x: any) => x.id === id);
      expect(r.impact, id).toBeTruthy();
      expect(r.verification.field_evidence.impact.quote.length, id).toBeGreaterThan(30);
      expect(r.verification.field_evidence.impact.checked_on).toBe("2026-11-19");
      expect((r.verification.unverified_fields || []).map((u: string) => u.split(/[\s(]/)[0]), id).not.toContain("impact");
    }
    expect(rs.find((x: any) => x.id === "tree_002").impact).toMatch(/\$1371 \(0\.48%\)/);
    expect(rs.find((x: any) => x.id === "hist_001").authors).toMatch(/Levere/);
  });

  it("funding programs carry no percent share or cycle date without a source", () => {
    const fp = load("app/data/funding_programs.json");
    for (const id of ["la_measure_w", "la_prop_k", "il_transit_tif", "az_gplet", "calfire_urban_forestry"]) expect(fp.find((r: any) => r.id === id).funding_share_pct, id).toBeNull();
    expect(fp.find((r: any) => r.id === "calfire_urban_forestry").funding_share_range_pct).toEqual([0.25, 0.9]);
    for (const r of fp) if (r.id !== "ca_urban_greening") expect(r.cycle_dates ?? null, r.id).toBeNull();
  });

  it("intercity corridors: the FRA Corridor ID selection is what the FRA document says; no Austin-San Antonio award is claimed", () => {
    const cs = load("app/data/intercity_transit_corridors.json");
    const atx = cs.find((c: any) => c.id === "corridor_atx_sat");
    expect(atx.funding_status).toMatch(/^Not confirmed/);
    expect(atx.funding_status).not.toMatch(/Step 1 Award/);
    const phx = cs.find((c: any) => c.id === "corridor_phx_tus");
    expect(phx.cid_selection.sponsor).toBe("Arizona Department of Transportation");
    expect(phx.lead_agencies).toEqual(["Arizona Department of Transportation (ADOT)"]);
  });

  it("transit pipelines: FTA profile figures are kept in fta_profile, with the quote", () => {
    const ps = load("app/data/transit_pipelines.json");
    const chi = ps.find((p: any) => p.fips === "17031");
    expect(chi.fta_profile.total_capital_cost_musd).toBe(5750);
    expect(chi.fta_profile.quote).toContain("$5,750.00 million");
    expect(chi.status).toMatch(/January 2025/);
    const aus = ps.find((p: any) => p.fips === "48453");
    expect(aus.fta_profile.quote).toContain("$8,233.60 Million");
    expect(aus.adopted_year).toBe(2023);
  });
});
