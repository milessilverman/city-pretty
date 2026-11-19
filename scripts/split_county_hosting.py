#!/usr/bin/env python3
"""Split counties/ into one folder per regional GitHub Pages site (app/data/county_hosts.json).

GitHub Pages publishes at most 1 GB per site, and the county data files outgrew one site. Each region's folder is laid out
to be pushed as the root of its own repo (milessilverman/city-pretty-data-<region>): counties/bundle_<fips>.json.gz for
the region's states, counties/manifest.json with only those counties, a .nojekyll file (so Pages serves files as they
are) and a short README. Files are copied byte for byte; nothing is rebuilt. The script refuses to write a region whose
files would exceed the configured limit.

Usage: python3 scripts/split_county_hosting.py <output dir>
Prints each region's file count and size.
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    out = sys.argv[1]
    hosts = json.load(open(os.path.join(ROOT, "app/data/county_hosts.json")))
    limit = hosts["_source"]["limit_bytes_per_site"]
    manifest = json.load(open(os.path.join(ROOT, "counties/manifest.json")))
    files = sorted(f for f in os.listdir(os.path.join(ROOT, "counties")) if f.startswith("bundle_") and f.endswith(".json.gz"))
    state_region = {st: name for name, r in hosts["regions"].items() for st in r["states"]}
    unplaced = sorted({f[7:9] for f in files if f[7:9] not in state_region})
    if unplaced:
        sys.exit(f"states with county files but no region: {unplaced}")
    for name, r in hosts["regions"].items():
        mine = [f for f in files if state_region[f[7:9]] == name]
        size = sum(os.path.getsize(os.path.join(ROOT, "counties", f)) for f in mine)
        if size > limit * 0.95:
            sys.exit(f"{name}: {size} bytes is within 5% of the {limit}-byte limit; split the region before publishing")
        d = os.path.join(out, name)
        os.makedirs(os.path.join(d, "counties"), exist_ok=True)
        for f in mine:
            shutil.copyfile(os.path.join(ROOT, "counties", f), os.path.join(d, "counties", f))
        fips = {f[7:12] for f in mine}
        sub = dict(manifest)
        sub["counties"] = [m for m in manifest["counties"] if str(m.get("fips", "")) in fips]
        missing = fips - {str(m.get("fips", "")) for m in sub["counties"]}
        if missing:
            sys.exit(f"{name}: county files with no manifest row: {sorted(missing)[:10]}")
        json.dump(sub, open(os.path.join(d, "counties", "manifest.json"), "w"), separators=(",", ":"))
        open(os.path.join(d, ".nojekyll"), "w").close()
        open(os.path.join(d, "README.md"), "w").write(
            f"# City Pretty county data: {name}\n\nCounty data files for {', '.join(r['states'])} (state FIPS), served by GitHub Pages for "
            f"https://milessilverman.github.io/city-pretty/. Built from milessilverman/city-pretty's counties/ folder by "
            f"scripts/split_county_hosting.py; do not edit by hand.\n")
        print(f"{name}: {len(mine)} files, {size / 1e6:.0f} MB -> {d}")


if __name__ == "__main__":
    main()
