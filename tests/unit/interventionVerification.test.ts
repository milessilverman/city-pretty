// app/data/intervention_verification.json gates which catalog interventions may show dollar figures
// (docs/audit/bundle-catalog-audit.md). These checks keep it complete and consistent with the audit.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel));
const IV = JSON.parse(read("app/data/intervention_verification.json").toString("utf8"));
const ids = Object.keys(IV).filter((k) => !k.startsWith("_"));
const laBundle = JSON.parse(zlib.gunzipSync(Buffer.from(read("app/data/bundle-la.b64.txt").toString("utf8").trim(), "base64")).toString("utf8"));
const travis = JSON.parse(zlib.gunzipSync(read("counties/bundle_48453.json.gz")).toString("utf8"));

describe("intervention verification file", () => {
  it("covers every intervention in the LA catalog", () => {
    const missing = Object.keys(laBundle.catalog).filter((id) => !IV[id]);
    expect(missing).toEqual([]);
    expect(ids.length).toBe(Object.keys(laBundle.catalog).length);
  });

  it("covers every intervention that appears in a national bundle's recommendation rows (Travis County, TX)", () => {
    const used = new Set<string>();
    for (const d of Object.values<any>(travis.details)) for (const r of d.r || []) used.add(r[0]);
    expect([...used].filter((id) => !IV[id])).toEqual([]);
  });

  it("uses only the allowed values", () => {
    for (const id of ids) {
      expect(["verified", "partially_verified", "unverified"]).toContain(IV[id].status);
      expect(["checked", "unchecked", "misapplied", "not_found"]).toContain(IV[id].effect);
      expect(["checked", "unchecked", "contradicted"]).toContain(IV[id].cost);
      expect(typeof IV[id].evidence).toBe("string");
    }
  });

  it("'verified' requires both sides checked; 'partially_verified' requires at least one side or a cost-only item", () => {
    for (const id of ids) {
      const r = IV[id];
      if (r.status === "verified") expect([r.effect, r.cost]).toEqual(["checked", "checked"]);
      if (r.status === "partially_verified") expect(r.effect === "checked" || r.cost === "checked" || r.kind === "qol").toBe(true);
    }
  });

  it("records the audit's decisions", () => {
    expect(IV.street_trees.status).toBe("unverified");
    expect(IV.street_trees.notes).toMatch(/cannot be reproduced/);
    expect(IV.ev_hub.status).toBe("unverified");
    expect(IV.adu.status).toBe("unverified");
    expect(IV.school_bond.status).toBe("unverified");
    expect(IV.farmers_market.status).toBe("unverified");
    expect(IV.affordable_housing.applies_if).toEqual({ median_household_income_below: 26000 });
    expect(IV.traffic_calming.status).toBe("verified");
    // every grade-U ("one AI research pass") item stays unverified
    for (const [id, c] of Object.entries<any>(laBundle.catalog)) if (c.grade === "U") expect(IV[id].status).toBe("unverified");
  });
});

describe("round 2 (docs/audit/catalog-coverage-round2.md)", () => {
  it("BRT is verified on a re-fetched effect quote and Metro's adopted budget, with the contrary studies noted", () => {
    expect(IV.brt.status).toBe("verified");
    expect(IV.brt.evidence).toMatch(/5-7% price premium/);
    expect(IV.brt.evidence).toMatch(/\$428,988,535/);
    expect(IV.brt.caution).toMatch(/no effect or declines/);
  });

  it("sound walls are downgraded: the shipped cost contradicts its own cited source", () => {
    expect(IV.noise_wall.status).toBe("unverified");
    expect(IV.noise_wall.cost).toBe("contradicted");
    expect(IV.noise_wall.evidence).toMatch(/\$10 Million\/mile/);
    const engine = read("pipeline/engine.py").toString("utf8");
    expect(engine).toMatch(/L \* 6214/);
    expect(engine).not.toMatch(/L \* 2485/);
  });

  it("the crime-to-price chain stays unverified (coefficient not in the abstract)", () => {
    for (const id of ["street_lighting", "foot_patrol", "violence_interruption", "bid"]) expect(IV[id].status).toBe("unverified");
  });
});

describe("homeowner upgrade gate", () => {
  const UV = JSON.parse(read("app/data/upgrade_verification.json").toString("utf8"));
  it("covers every row of the upgrade table", () => {
    const names = (laBundle.upgrades as any[]).map((u) => u.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => !UV.rows[n])).toEqual([]);
  });
  it("no row shows figures without evidence of a checked source", () => {
    for (const r of Object.values<any>(UV.rows)) {
      expect(["verified", "partially_verified", "could_not_check", "unverified"]).toContain(r.status);
      if (r.status === "verified") expect([r.cost, r.value]).toEqual(["checked", "checked"]);
      if (r.status === "partially_verified") expect(r.cost === "checked" || r.value === "checked").toBe(true);
    }
  });
  it("the page gates house-level upgrade figures and labels the LA 'recorded sales' home values", () => {
    const js = read("app/app.js").toString("utf8");
    expect(js).toMatch(/cpJson\("upgrade-verification"\)/);
    expect(js).toMatch(/if \(!upSourced\(u\.name\)\)/);
    expect(js).toMatch(/const hvSourceText/);
    expect(js).not.toMatch(/4\.0 ft \(Compliant\)/);
    expect(js).not.toMatch(/Exempt \(0 spaces\)/);
  });
});

describe("pipeline cannot re-ship the self-cited catalog extensions", () => {
  const engine = read("pipeline/engine.py").toString("utf8");
  const build = read("pipeline/build_oc.py").toString("utf8");
  it("CATALOG_EXTENSIONS / FUNDING_EXTENSIONS are gone", () => {
    expect(engine).not.toMatch(/^CATALOG_EXTENSIONS\s*=/m);
    expect(engine).not.toMatch(/^FUNDING_EXTENSIONS\s*=/m);
    expect(build).not.toMatch(/update\(engine\.(CATALOG|FUNDING)_EXTENSIONS\)/);
    for (const id of ["safe_school_corridor", "park_trees", "park_seating", "park_mural", "park_lighting", "beach_nourishment", "beach_volleyball", "mountain_bike_trails"]) {
      expect(engine).not.toContain(`add("${id}"`);
    }
  });
  it("affordable housing uses the study's low-income cut, not LA's median", () => {
    expect(engine).toMatch(/LIHTC_LOW_INCOME_CUT = 26000/);
  });
});

describe("the page loads and uses the gate", () => {
  const app = read("app/app.js").toString("utf8");
  it("registers the data file and gates rows before rendering", () => {
    expect(app).toContain('"intervention-verification": "intervention_verification.json"');
    expect(app).toMatch(/function ivAllows\(id, m\)/);
    expect(app).toMatch(/const \{ recs, other: otherIdeas \} = gateRecs\(recsOf\(d\), m\)/);
  });
  it("no longer shows neighborhood profit figures", () => {
    expect(app).not.toMatch(/<b>Profit potential:<\/b> about/);
  });
});
