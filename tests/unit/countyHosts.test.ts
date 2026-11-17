import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// County data files are served from regional GitHub Pages sites (each capped at 1 GB). app/data/county_hosts.json says
// which region serves which states; every state that has county files must be in exactly one region.
const H = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/data/county_hosts.json"), "utf-8"));
const files = fs.readdirSync(path.join(__dirname, "../../counties")).filter((f) => /^bundle_\d{5}\.json\.gz$/.test(f));

describe("county hosts", () => {
  it("every state with county files is in exactly one region", () => {
    const seen = new Map<string, string>();
    for (const [name, r] of Object.entries<any>(H.regions)) for (const st of r.states) {
      expect(seen.has(st), `${st} in ${seen.get(st)} and ${name}`).toBe(false);
      seen.set(st, name);
    }
    const states = new Set(files.map((f) => f.slice(7, 9)));
    for (const st of states) expect(seen.has(st), `state ${st} has county files but no region`).toBe(true);
  });
  it("each region names an https Pages base and its repo; enabled only with a check date", () => {
    for (const r of Object.values<any>(H.regions)) {
      expect(r.base).toMatch(/^https:\/\/milessilverman\.github\.io\/city-pretty-data-[a-z]+\/$/);
      expect(r.repo).toMatch(/^milessilverman\/city-pretty-data-[a-z]+$/);
      if (r.enabled) expect(r.checked_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("no region's files exceed 95% of the per-site limit", () => {
    const limit = H._source.limit_bytes_per_site;
    for (const [name, r] of Object.entries<any>(H.regions)) {
      const size = files.filter((f) => r.states.includes(f.slice(7, 9))).reduce((a, f) => a + fs.statSync(path.join(__dirname, "../../counties", f)).size, 0);
      expect(size, name).toBeLessThan(limit * 0.95);
    }
  });
});
