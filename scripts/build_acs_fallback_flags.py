#!/usr/bin/env python3
"""Which block-group home values and rents in the county data files are the block group's own Census figure, and which
are the surrounding tract's (the block group's is suppressed)?

The county files (counties/bundle_<fips>.json.gz) hold, per block group, `hv` (ACS median home value, B25077) and `rent`
(ACS median gross rent, B25064). Where the Census suppresses a block group's median, the pipeline put the tract's
published median there. For home value it says so per block group (`hvs`); for rent it said so only in the county's
source notes. This script checks every value against the Census Bureau's own table-based summary files and writes one
flag per block group and field:

  own       the value equals the block group's published estimate
  tract     the block group's estimate is not published (suppressed or missing) and the value equals the tract's
  mismatch  the value equals neither (a data error; listed in docs/audit/acs-fallback-flags.md, never hidden)
  (absent)  the file has no value for this block group

Values the page fills from app/data/bundle_corrections.json (blanks only, California) are checked the same way.
Orange County (app/data/bundle-oc.b64.txt) is checked like the county files. Los Angeles (app/data/details-la.json) is
checked for rent only: the page replaces LA's home values with the assessor-based values (la_neighborhood_values.json),
and LA's file names no ACS vintage, so 2020-2024 is used and the run reports how many LA rents match it.
Top-coded estimates (B25077: 2000001 = "$2,000,000+"; B25064: 3501 = "$3,500+") count as the block group's own.

Sources (Census Bureau, public, no key):
  https://www2.census.gov/programs-surveys/acs/summary_file/<year>/table-based-SF/data/5YRData/acsdt5y<year>-b25077.dat
  https://www2.census.gov/programs-surveys/acs/summary_file/<year>/table-based-SF/data/5YRData/acsdt5y<year>-b25064.dat
The vintage is the one each county file's meta.acs names (all 2020-2024 when this was written).

Usage: python3 -I scripts/build_acs_fallback_flags.py [cache dir]
Writes app/data/acs_fallback_flags.json (what the page reads) and data/backtests/acs_fallback_mismatches_<date>.json
(per-county counts and every mismatch with the published figures).
"""
import glob
import gzip
import json
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-{t}.dat"
FIELDS = {"hv": "b25077", "rent": "b25064"}
TOP = {"hv": 2000001, "rent": 3501}


def fetch(year, table, cache):
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, f"acsdt5y{year}-{table}.dat")
    url = BASE.format(y=year, t=table)
    if not os.path.exists(path) or os.path.getsize(path) < 1_000_000:
        req = urllib.request.Request(url, headers={"User-Agent": "city-pretty-data-pipeline/1.0"})
        with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        os.replace(path + ".part", path)
    bg, tract = {}, {}
    with open(path, encoding="utf-8") as f:
        head = f.readline().rstrip("\n").split("|")
        assert head[0] == "GEO_ID" and head[1].endswith("_E001"), head
        for line in f:
            p = line.rstrip("\n").split("|")
            g, v = p[0], p[1]
            try:
                v = int(float(v))
            except ValueError:
                v = None
            if v is not None and v < 0:  # -666666666 etc.: estimate not published
                v = None
            if g.startswith("1500000US"):
                bg[g[9:]] = v
            elif g.startswith("1400000US"):
                tract[g[9:]] = v
    return url, bg, tract


def same(a, b):
    return a is not None and b is not None and abs(float(a) - float(b)) < 0.5


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), ".cache", "city-pretty", "acs")
    files = sorted(glob.glob(os.path.join(ROOT, "counties", "bundle_*.json.gz")))
    corr = json.load(open(os.path.join(ROOT, "app", "data", "bundle_corrections.json"))).get("block_groups", {})
    vint = Counter()
    bundles = []
    for f in files:
        d = json.load(gzip.open(f))
        m = re.search(r"(\d{4})-(\d{4}) ACS", str(d.get("meta", {}).get("acs", "")))
        if not m:
            sys.exit(f"{f}: meta.acs names no vintage")
        vint[m.group(2)] += 1
        bundles.append((d["meta"].get("fips") or os.path.basename(f)[7:12], m.group(2), d["details"]))
    # Orange County and Los Angeles are stored in their own formats.
    import base64
    oc = json.loads(gzip.decompress(base64.b64decode(open(os.path.join(ROOT, "app", "data", "bundle-oc.b64.txt")).read())))
    m = re.search(r"(\d{4})-(\d{4}) ACS", str(oc.get("meta", {}).get("acs", "")))
    bundles.append(("06059", m.group(2), oc["details"]))
    vint[m.group(2)] += 1
    la = {}
    for v in json.load(open(os.path.join(ROOT, "app", "data", "details-la.json")))["chunks"].values():
        for bg, rec in json.loads(gzip.decompress(base64.b64decode(v))).items():
            mm = dict((rec or {}).get("m") or {})
            mm.pop("hv", None)  # replaced on the page by the assessor-based value; not an ACS figure
            la[bg] = {"m": mm}
    bundles.append(("06037", "2024", la))
    vint["2024"] += 1
    tables = {}
    for y in vint:
        for k, t in FIELDS.items():
            tables[(y, k)] = fetch(y, t, cache)
    flags, counts, mism = {}, defaultdict(Counter), defaultdict(list)
    hvs_check = Counter()
    for fips, y, det in bundles:
        out = {}
        for bg, rec in det.items():
            mm = rec.get("m", rec) if isinstance(rec, dict) else {}
            row = {}
            for k in FIELDS:
                v = mm.get(k)
                src = "bundle"
                if v is None and bg in corr and corr[bg].get(k) is not None:
                    v, src = corr[bg][k], "bundle_corrections"
                if v is None:
                    continue
                _, B, T = tables[(y, k)]
                b, t = B.get(bg), T.get(bg[:11])
                if same(v, b) or (b == TOP[k] and float(v) >= TOP[k] - 1):
                    fl = "own"
                elif b is None and same(v, t):
                    fl = "tract"
                else:
                    fl = "mismatch"
                    mism[fips].append({"bg": bg, "field": k, "value": v, "from": src, "bg_published": b, "tract_published": t})
                row[k] = fl
                counts[fips][f"{k}_{fl}"] += 1
                if k == "hv" and src == "bundle":
                    said_tract = "surrounding Census tract" in str(mm.get("hvs", ""))
                    hvs_check[(fl, said_tract)] += 1
            for k, x in row.items():
                if x != "own":
                    out.setdefault(f"{k}_{x}", []).append(bg[5:])  # block group ID without the county FIPS
        flags[fips] = {k: sorted(v) for k, v in sorted(out.items())}
    tot = Counter()
    for c in counts.values():
        tot.update(c)
    doc = {
        "_source": {
            "built": date.today().isoformat(),
            "script": "scripts/build_acs_fallback_flags.py",
            "census_files": sorted({tables[k][0] for k in tables}),
            "meaning": "Per county FIPS, lists of block groups (the 7 digits after the county FIPS) whose value is not the "
                       "block group's own published ACS estimate. hv_tract / rent_tract: the block group's estimate is not "
                       "published and the value is the surrounding tract's published median. hv_mismatch / rent_mismatch: "
                       "equals neither (a data error, see docs/audit/acs-fallback-flags.md). A block group not listed holds "
                       "its own estimate (or has no value). Los Angeles: rent only (its home values are assessor-based).",
            "fields": {"hv": "B25077 median home value", "rent": "B25064 median gross rent"},
            "totals": dict(sorted(tot.items())),
            "hvs_note_vs_census": {f"{fl}/{'says tract' if s else 'says block group'}": n for (fl, s), n in sorted(hvs_check.items())},
        },
        "counties": flags,
    }
    with open(os.path.join(ROOT, "app", "data", "acs_fallback_flags.json"), "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    with open(os.path.join(ROOT, "data", "backtests", f"acs_fallback_mismatches_{date.today().isoformat()}.json"), "w") as f:
        json.dump({"counts": {k: dict(v) for k, v in sorted(counts.items())}, "mismatches": mism}, f, indent=1)
    print(json.dumps(doc["_source"]["totals"], indent=1))
    print(json.dumps(doc["_source"]["hvs_note_vs_census"], indent=1))
    print("counties with mismatches:", {k: len(v) for k, v in sorted(mism.items(), key=lambda x: -len(x[1]))[:25]})


if __name__ == "__main__":
    main()
