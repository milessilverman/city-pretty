// County files kept only in Cloudflare R2, not in the repository (counties/.r2-only.txt, scripts/r2_only.py).
// Tests that enumerate counties/ use these helpers so an R2-only file is skipped by name, whether or not a copy
// happens to be on this machine, and the county still counts as having a data file.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const listPath = path.join(root, "counties/.r2-only.txt");

/** file names listed in counties/.r2-only.txt (e.g. "bundle_24001.json.gz") */
export const r2OnlyNames: string[] = fs.existsSync(listPath)
  ? fs.readFileSync(listPath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
  : [];
const r2Set = new Set(r2OnlyNames);

/** FIPS of counties whose data file is R2-only */
export const r2OnlyBundleFips: string[] = r2OnlyNames.filter((n) => n.startsWith("bundle_")).map((n) => n.slice(7, 12));

/** bundle_<fips>.json.gz files in counties/ that are kept in the repository (R2-only names skipped explicitly) */
export function localBundleFiles(): string[] {
  return fs.readdirSync(path.join(root, "counties")).filter((f) => /^bundle_\d{5}\.json\.gz$/.test(f) && !r2Set.has(f));
}

/** FIPS of every county with a data file: the repository's plus the R2-only ones */
export function allBundleFips(): string[] {
  return [...new Set([...localBundleFiles().map((f) => f.slice(7, 12)), ...r2OnlyBundleFips])].sort();
}
