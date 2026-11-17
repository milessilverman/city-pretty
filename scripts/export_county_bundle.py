#!/usr/bin/env python3
"""Publish one county bundle built by the pipeline (pipeline/build_oc.py) to the page.

Writes counties/bundle_<fips>.json.gz exactly as w5/tools/export_county.py --gz does (compact JSON, gzip level 9, mtime 0),
turns the county's "lots only" tag in index.html (data-coverage="lots", no data file) into a data tag (data-src), and adds or
replaces its row in counties/manifest.json. No site-suggestions file is written: those need w5/tools/sites.py, which this
environment can't run (it reads the old build machine's paths); the page handles a county without data-sites.

Usage: python3 scripts/export_county_bundle.py <pipeline data dir (holds bundle-oc.b64, metrics.json)> <fips>
"""
import base64, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    d, fips = sys.argv[1], sys.argv[2]
    B = json.loads(gzip.decompress(base64.b64decode(open(os.path.join(d, "bundle-oc.b64")).read())))
    if not B["meta"].get("fips"):
        B["meta"]["fips"] = fips
    assert B["meta"]["fips"] == fips, (B["meta"]["fips"], fips)
    out = os.path.join(ROOT, "counties", f"bundle_{fips}.json.gz")
    open(out, "wb").write(gzip.compress(json.dumps(B, separators=(",", ":")).encode(), 9, mtime=0))

    reg = json.load(open(os.path.join(ROOT, "national", "data", "counties.json")))[fips]
    # index.html: the county's tag
    p = os.path.join(ROOT, "index.html"); h = open(p, encoding="utf-8").read()
    pat = re.compile(r'<script type="application/json" class="county-bundle"[^>]*data-fips="' + fips + r'"[^>]*></script>')
    m = pat.search(h)
    if not m:
        sys.exit(f"no county-bundle tag for {fips} in index.html")
    name = re.search(r'data-name="([^"]*)"', m.group(0)).group(1)
    st = re.search(r'data-st="([^"]*)"', m.group(0)).group(1)
    tag = (f'<script type="application/json" class="county-bundle" data-fips="{fips}" data-name="{name}" data-st="{st}" '
           f'data-src="counties/bundle_{fips}.json.gz"></script>')
    h = h[:m.start()] + tag + h[m.end():]
    open(p, "w", encoding="utf-8").write(h)

    # manifest row (same fields as w5/tools/build_site.py)
    mp = os.path.join(ROOT, "counties", "manifest.json"); M = json.load(open(mp))
    osm_state = ""
    for f in os.listdir(os.path.join(d, "osm")):
        if f.endswith(".state.txt"):
            osm_state = next((l.split("=", 1)[1] for l in open(os.path.join(d, "osm", f)).read().splitlines() if l.startswith("timestamp=")), "")
    crash = next((r for r in B["meta"]["sources"] if r[0].startswith("State crash") or "crash" in r[0].lower() and r[3]), None)
    row = {"fips": fips, "name": reg["name"], "state": reg["state"], "block_groups": len(json.load(open(os.path.join(d, "metrics.json")))["metrics"]),
           "bundle_mb": round(os.path.getsize(out) / 1e6, 1), "built": B["meta"].get("built"), "osm": osm_state,
           "crash_source": crash[0] if crash and crash[3] else None, "crash_years": None}
    M["counties"] = sorted([c for c in M["counties"] if c["fips"] != fips] + [row], key=lambda c: c["fips"])
    json.dump(M, open(mp, "w"), indent=1)
    print(fips, name, row["block_groups"], "block groups,", row["bundle_mb"], "MB")


if __name__ == "__main__":
    main()
