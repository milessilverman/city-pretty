// app/data/bundle_corrections.json: tract-level ACS values for California block groups where the county bundle
// skipped the pipeline's tract fallback (docs/audit/bundles-nationwide-audit.md). Built by
// scripts/audit_bundles_nationwide.py fallback from the Census Bureau's 2020-2024 ACS table files.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const corr = JSON.parse(fs.readFileSync(path.join(root, "app/data/bundle_corrections.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "docs/audit/bundles-nationwide-audit.json"), "utf8"));

describe("bundle corrections (missed ACS tract fallback)", () => {
  it("records where its values came from", () => {
    expect(corr._source.values_from.hv).toMatch(/www2\.census\.gov\/programs-surveys\/acs\/summary_file\/2024\/.*b25077/);
    expect(corr._source.values_from.rent).toMatch(/b25064/);
    expect(corr._source.vintage).toBe("2020-2024 ACS 5-year");
  });

  it("only touches California block groups outside LA and Orange County, each labelled as a tract value", () => {
    const entries = Object.entries(corr.block_groups) as [string, any][];
    expect(entries.length).toBeGreaterThan(4000);
    for (const [g, e] of entries) {
      expect(g).toMatch(/^06\d{10}$/);
      expect(g.slice(0, 5)).not.toBe("06037");
      expect(g.slice(0, 5)).not.toBe("06059");
      if ("hv" in e) {
        expect(e.hv).toBeGreaterThan(0);
        expect(e.hv).toBeLessThanOrEqual(2000001);
        expect(e.hvs).toMatch(/surrounding Census tract/);
      }
      if ("rent" in e) {
        expect(e.rent).toBeGreaterThan(0);
        expect(e.rent_s).toBe("tract median");
      }
    }
  });

  it("matches the audit's full scan", () => {
    const n = (Object.values(corr.block_groups) as any[]).reduce((s, e) => s + ("hv" in e ? 1 : 0) + ("rent" in e ? 1 : 0), 0);
    expect(n).toBe(audit.tract_fallback_scan.tract_value_available_but_not_applied);
  });

  it("the audit's ACS sample found no value mismatch other than missed fallbacks", () => {
    for (const s of Object.values(audit.acs.fields) as any[]) {
      expect(s.mismatch).toBe(s.bundle_null_census_has);
    }
  });
});
