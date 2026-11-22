import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { FUNDING_FIXTURES, ICC_FIXTURES, leaks, scanDir } from "./helpers/internalRows";

// Structural guard: rows the publisher does not let us display (display_allowed: false, mainly the ICC Building Valuation
// Data table) live only in data/internal/, which the page never requests and the site build never copies. GitHub Pages
// serves app/ as it is, so nothing under app/ may carry them; neither may the dist-site/ build.
const root = path.resolve(__dirname, "../..");
const json = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

describe("the guard itself", () => {
  const bc = json("data/internal/building_costs_internal.json").rows;
  it("its ICC fixtures are real cells of the internal table", () => {
    for (const f of ICC_FIXTURES) {
      const r = bc.find((x: any) => x.icc_occupancy_group === f.group && x.icc_construction_type === f.type);
      expect(r, `${f.group} ${f.type}`).toBeTruthy();
      expect(r.value).toBe(f.value);
    }
  });
  it("its funding fixtures are real quotes of the internal funding table", () => {
    const fr = json("data/internal/housing_funding_rules_internal.json").rows;
    for (const q of FUNDING_FIXTURES) expect(fr.some((x: any) => String(x.quote).includes(q)), q).toBe(true);
  });
  it("every row of the internal files is marked display_allowed: false, and none of the public ones", () => {
    for (const n of ["building_costs", "housing_funding_rules"]) {
      const internal = json(`data/internal/${n}_internal.json`).rows, pub = json(`app/data/${n}.json`).rows;
      expect(internal.length).toBeGreaterThan(0);
      expect(internal.every((r: any) => r.display_allowed === false), n).toBe(true);
      expect(pub.every((r: any) => r.display_allowed !== false), n).toBe(true);
    }
    expect(bc.filter((r: any) => r.icc_occupancy_group).length).toBe(238);
  });
  it("the scanner flags a leaked row, an ICC cell and a funding quote, and passes a clean file", () => {
    expect(leaks('{"rows":[{"value":1,"display_allowed": false}]}')).not.toEqual([]);
    expect(leaks('{"value": 300.49}')).not.toEqual([]);
    expect(leaks('{"icc_occupancy_group":"R-2"}')).not.toEqual([]);
    expect(leaks("x " + FUNDING_FIXTURES[0])).not.toEqual([]);
    expect(leaks('{"value": 3004.9, "display_allowed": true}')).toEqual([]);
  });
});

describe("nothing the site serves carries a not-displayable row", () => {
  it("app/ (served as it is by GitHub Pages)", () => {
    const r = scanDir(path.join(root, "app"));
    expect(r.files).toBeGreaterThan(100);
    expect(r.found).toEqual([]);
  });
  it("dist-site/ after npm run build:site", () => {
    const b = spawnSync("node", ["scripts/build_site_dist.mjs"], { cwd: root, encoding: "utf8" });
    expect(b.status, b.stdout + b.stderr).toBe(0);
    const r = scanDir(path.join(root, "dist-site"));
    expect(r.files).toBeGreaterThan(1000);
    expect(r.found).toEqual([]);
    expect(fs.existsSync(path.join(root, "dist-site", "data", "internal"))).toBe(false);
  }, 120_000);
});
