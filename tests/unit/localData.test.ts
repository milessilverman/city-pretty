import { readFileSync } from "node:fs";
// The advisor's tools over City Pretty's audited tables (workers/localData.ts).
import { describe, expect, it } from "vitest";
import {
  constructionUnitCosts, countyDataCoverage, fundingPrograms, improvementEvidence, researchStudies, stateHousingLaws, transitProjectsFor,
} from "../../workers/localData";
import { ADVISOR_TOOLS, runAdvisorTool } from "../../workers/advisorAgent";

describe("advisor tools over audited tables", () => {
  it("every record handed to the model carries its verification block", () => {
    for (const r of [stateHousingLaws("CA"), fundingPrograms("06037"), researchStudies("transit rail"), constructionUnitCosts("sidewalk"), transitProjectsFor("06037", "AZ")]) {
      expect(r.value.count).toBeGreaterThan(0);
      for (const rec of r.value.records) expect(["verified", "partially_verified", "could_not_check", "unverified"]).toContain(rec.verification.status);
      expect(r.notes.join(" ")).toMatch(/not that it doesn't exist/);
    }
  });

  it("state laws are filtered by state and use the corrected citations", () => {
    const tx = stateHousingLaws("tx").value.records;
    expect(tx.every((r: any) => r.state_code === "TX")).toBe(true);
    expect(JSON.stringify(tx)).not.toMatch(/SB 1412/); // never passed; removed in the audit
    expect(stateHousingLaws("ZZ").value.count).toBe(0);
  });

  it("a county lookup returns its own programs plus state and federal ones", () => {
    const ids = fundingPrograms("06037").value.records.map((r: any) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["la_measure_w", "ca_urban_greening", "federal_fra_intercity_grant"]));
    expect(ids).not.toContain("tx_tirz_ch311");
  });

  it("fields found fabricated never reach the model", () => {
    const all = JSON.stringify([researchStudies("park tree transit"), transitProjectsFor("06037")]);
    for (const k of ['vpd', 'baseIRR', 'tifiaLoan', 'seniorDebt', 'developerEquity', 'removed_unverified_claims']) expect(all).not.toContain(`"${k}":`);
  });

  it("county coverage and improvement evidence come from the computed files", () => {
    expect(countyDataCoverage("48453").value.records[0].source).toMatch(/build_county_completeness/);
    expect(improvementEvidence("traffic_calming").value.records[0].status).toBe("verified");
    expect(improvementEvidence().value.records.every((r: any) => r.status !== "unverified")).toBe(true);
  });

  it("the advisor exposes and runs these tools", async () => {
    const names = ADVISOR_TOOLS.map((t) => t.name);
    for (const n of ["state_housing_laws", "funding_programs", "research_studies", "construction_unit_costs", "transit_projects", "county_data_coverage", "improvement_evidence"]) expect(names).toContain(n);
    const r = await runAdvisorTool("state_housing_laws", { state: "CA" }, {});
    expect(r.isError).toBe(false);
    expect(r.sources[0].url).toBe("repo://app/data/statutes.json");
  });
  it("matches intercity corridors to a county by a named stop, and marks same-state corridors state_only", () => {
    const data = JSON.parse(readFileSync("app/data/intercity_transit_corridors.json", "utf8")) as any[];
    const hasStop = (c: any, f: string) => (c.proposed_stations || []).some((s: any) => s.fips === f);
    const r: any = transitProjectsFor("48113", "TX");
    const inter = r.value.records.filter((x: any) => x.county_match);
    const expectedStop = data.filter((c) => hasStop(c, "48113")).map((c) => c.id).sort();
    expect(expectedStop.length).toBeGreaterThan(0);
    expect(inter.filter((x: any) => x.county_match === "stop_in_county").map((x: any) => x.id).sort()).toEqual(expectedStop);
    for (const x of inter.filter((x: any) => x.county_match === "state_only")) {
      expect(hasStop(x, "48113")).toBe(false);
      expect(x.states).toContain("TX");
    }
    // stop matches are listed before state-only ones
    const kinds = inter.map((x: any) => x.county_match);
    expect(kinds.lastIndexOf("stop_in_county")).toBeLessThan(kinds.indexOf("state_only") === -1 ? Infinity : kinds.indexOf("state_only"));
  });
});
