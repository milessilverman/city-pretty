// County files kept only in Cloudflare R2 (counties/.r2-only.txt, 19 Nov 2026): the repository must not grow past
// GitHub Pages' 1 GB, so these are uploaded with scripts/r2_sync_counties.py and not committed. The page must still
// know each county exists (index tag, manifest, completeness row) and must load it from R2 only.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { r2OnlyNames, r2OnlyBundleFips } from "../r2Only";

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const tags = [...html.matchAll(/<script type="application\/json" class="county-bundle"[^>]*><\/script>/g)].map((m) => m[0]);
const tagOf = (fips: string) => tags.find((t) => t.includes(`data-fips="${fips}"`));

describe("R2-only county files", () => {
  it("are listed one file name per line, sorted and unique", () => {
    for (const n of r2OnlyNames) expect(n).toMatch(/^(bundle|sites)_\d{5}\.json\.gz$/);
    expect([...new Set(r2OnlyNames)].sort()).toEqual(r2OnlyNames);
  });

  it(".gitignore carries the block generated from the list (scripts/r2_only.py --gitignore)", () => {
    if (!r2OnlyNames.length) return;
    const g = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    const block = ["# BEGIN r2-only county files (generated from counties/.r2-only.txt by scripts/r2_only.py --gitignore; do not edit)",
      ...r2OnlyNames.map((n) => "counties/" + n), "# END r2-only county files"].join("\n");
    expect(g).toContain(block);
  });

  it("none of them is tracked by git", () => {
    const tracked = new Set(execFileSync("git", ["ls-files", "counties"], { cwd: root, encoding: "utf8" }).split("\n"));
    for (const n of r2OnlyNames) expect(tracked.has("counties/" + n), n).toBe(false);
  });

  it("each R2-only county has a page tag marked data-r2only, a manifest row and a completeness row", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "counties/manifest.json"), "utf8")).counties;
    const comp = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_completeness.json"), "utf8"));
    const compRows = comp.counties || comp;
    for (const fips of r2OnlyBundleFips) {
      const t = tagOf(fips);
      expect(t, fips).toBeDefined();
      expect(t).toContain(`data-src="counties/bundle_${fips}.json.gz"`);
      expect(t).toContain('data-r2only="1"');
      const sites = r2OnlyNames.includes(`sites_${fips}.json.gz`);
      if (/data-sites=/.test(t!)) expect(sites, `${fips} has data-sites but its sites file is not listed`).toBe(true);
      const row = manifest.find((c: any) => c.fips === fips);
      expect(row, fips).toBeDefined();
      expect(row.r2_only).toBe(true);
      expect(compRows[fips], fips).toBeDefined();
    }
  });

  it("only listed counties are marked R2-only on the page", () => {
    for (const t of tags.filter((x) => x.includes('data-r2only="1"'))) {
      const fips = t.match(/data-fips="(\d{5})"/)![1];
      expect(r2OnlyBundleFips, fips).toContain(fips);
    }
  });
});
