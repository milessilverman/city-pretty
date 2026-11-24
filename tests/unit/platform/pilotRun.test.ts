import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { runLaPilot } from "../../../src/platform/pilot/runPilot.js";
import { IMPROVEMENT_CATEGORIES } from "../../../src/platform/schema/index.js";

// Real repo data (not fixtures): the Los Angeles County pilot run.
const root = path.resolve(__dirname, "../../..");
const gz = (rel: string) => JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(root, rel), "utf8"), "base64")).toString("utf8"));
const json = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const ASOF = "2026-11-24";

const sitesJson = gz("app/data/sites-la.b64.txt");
const t0 = Date.now();
const run = runLaPilot({
  sitesJson, bundle: gz("app/data/bundle-la.b64.txt"), statutes: json("app/data/statutes.json"),
  financeProfileCA: json("app/data/state_finance_profiles.json").CA, transitValueEffects: json("app/data/transit_value_effects.json"),
  asOf: ASOF, criteria: {}, problemMap: [],
});
const elapsedMs = Date.now() - t0;

describe("Los Angeles County pilot run (real files)", () => {
  it("locates exactly the records that have a point", () => {
    let withPt = 0;
    for (const recs of Object.values(sitesJson.sites) as any[][]) for (const r of recs) if (Array.isArray(r.pt) && r.pt.length === 2) withPt++;
    expect(withPt).toBeGreaterThan(0);
    expect(run.summary.locations.total).toBe(withPt);
    expect(run.ledgers.length).toBe(withPt);
  });

  it("finalizes every ledger with all applicable categories accounted for", () => {
    expect(run.summary.ledgers.allFinalized).toBe(true);
    for (const l of run.ledgers) {
      const applicable = IMPROVEMENT_CATEGORIES.filter((c) => (c.appliesTo as readonly string[]).includes(l.location.kind)).map((c) => c.id);
      const accounted = new Set([
        ...l.found.map((x: any) => x.categoryId), ...l.rejected.map((x: any) => x.categoryId),
        ...l.needsInfo.map((x: any) => x.categoryId), ...l.notEvaluated.map((x: any) => x.categoryId),
      ]);
      for (const id of applicable) expect(accounted.has(id)).toBe(true);
      expect(accounted.size).toBe(IMPROVEMENT_CATEGORIES.length);
    }
  });

  it("marks nothing viable unless all three checks passed, and rejects nothing for missing data", () => {
    for (const o of run.opportunities) {
      if (o.status === "viable") {
        expect(o.checks.financial?.result).toBe("pass");
        expect(o.checks.regulatory?.result).toBe("pass");
        expect(o.checks.engineering?.result).toBe("pass");
      }
      expect(o.status).not.toBe("rejected");
    }
    expect(run.summary.evaluations.byStatus.viable).toBe(0);
    for (const l of run.ledgers) expect(l.rejected.length).toBe(0);
    expect(run.summary.evaluations.byStatus.rejected).toBe(0);
    expect(run.summary.evaluations.byStatus.needs_info).toBeGreaterThan(0);
  });

  it("matches the committed app/data/platform_pilot_la.json summary (not stale)", () => {
    const committed = json("app/data/platform_pilot_la.json");
    expect(JSON.parse(JSON.stringify(run.summary))).toEqual(committed.summary);
    expect(fs.statSync(path.join(root, "app/data/platform_pilot_la.json")).size).toBeLessThan(400 * 1024);
    expect(committed.sampleOpportunities.length).toBeLessThanOrEqual(200);
  });

  it("completes within 20 s", () => {
    expect(elapsedMs).toBeLessThan(20000);
  });
});
