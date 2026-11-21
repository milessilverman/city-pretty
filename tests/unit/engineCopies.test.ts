import { describe, expect, it } from "vitest";
// @ts-ignore plain ES module script
import { compareEngineCopies } from "../../scripts/check_engine_copies.mjs";

// The page runs its own inlined copies of the engines in app/app.js; the unit tests import src/engines/*.js and
// src/adapters/*.js. Every function and constant the two share must be the same text, so what the tests check is what
// the page runs. Found 17 Nov 2026: the roof engine's page copy still invented a 1975 build year and a 1,600 sq ft house
// that a 14 Nov fix had removed from the tested copy only (docs/audit/engine-copies.md).
// The only allowed differences are the environment bindings that load another engine (require in Node, a page global
// in the browser).
const BINDINGS = new Set(["_estVal", "_valVintage", "_evalHousing"]);

describe("engine copies: the page's code is the tested code", () => {
  const rows = compareEngineCopies();
  it("finds the shared engines", () => {
    expect(rows.filter((r: any) => r.in_app).length).toBeGreaterThan(20);
  });
  it("the exclusion check and the law evaluator are compared, and the page runs the same text as the tests", () => {
    for (const name of ["statuteExclusionCheck", "evaluateByRightHousing", "statuteAppliesTo"]) {
      const row = rows.find((r: any) => r.name === name);
      expect(row && row.in_app, name).toBe(true);
      expect(row.identical, name).toBe(true);
    }
  });
  it("every shared function and constant is identical", () => {
    const diff = rows.filter((r: any) => r.in_app && !r.identical && !BINDINGS.has(r.name)).map((r: any) => `${r.file} ${r.kind} ${r.name}`);
    expect(diff).toEqual([]);
  });
});
