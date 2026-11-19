#!/usr/bin/env python3
"""Tree Equity Score current release (2020 block groups), per county with a City Pretty data file.

The county data files carry the 2021 release on 2010 block groups (area-weighted onto 2020 ones). American Forests'
current release is published per state at https://tes-app-data-share.s3.amazonaws.com/<st>/<st>_csv.zip (zip members
dated 2025-07-01 in the files checked). This writes app/data/tree_equity_2025/<county fips>.json:
  {"<block group GEOID>": [canopy_gap_pts, tree_canopy_pct, canopy_goal_pct], "_meta": {...}}
Canopy gap = goal minus canopy (data dictionary: "the tree canopy gap of the block group (goal minus canopy) [range: 0-1]"),
the same definition the data files use, so it replaces their 2021 value one for one. Heat is NOT taken: the current
release's temp_diff is a different measure ("heat extremity ... variance in heat severity", no unit stated) from the
2021 figure the page shows in degrees.

Usage: python3 scripts/build_tree_equity_2025.py [state abbreviation ...]
"""
import csv
import glob
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "tree_equity_2025")
URL = "https://tes-app-data-share.s3.amazonaws.com/{st}/{st}_csv.zip"
FIPS_ST = {"01": "al", "02": "ak", "04": "az", "05": "ar", "06": "ca", "08": "co", "09": "ct", "10": "de", "11": "dc", "12": "fl", "13": "ga",
           "15": "hi", "16": "id", "17": "il", "18": "in", "19": "ia", "20": "ks", "21": "ky", "22": "la", "23": "me", "24": "md", "25": "ma",
           "26": "mi", "27": "mn", "28": "ms", "29": "mo", "30": "mt", "31": "ne", "32": "nv", "33": "nh", "34": "nj", "35": "nm", "36": "ny",
           "37": "nc", "38": "nd", "39": "oh", "40": "ok", "41": "or", "42": "pa", "44": "ri", "45": "sc", "46": "sd", "47": "tn", "48": "tx",
           "49": "ut", "50": "vt", "51": "va", "53": "wa", "54": "wv", "55": "wi", "56": "wy", "72": "pr"}


def counties_with_files():
    f = {re.search(r"bundle_(\d{5})", p).group(1) for p in glob.glob(os.path.join(ROOT, "counties", "bundle_*.json.gz"))}
    return f | {"06037", "06059"}


def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "city-pretty-data-pipeline/1.0"}), timeout=300) as r:
                return r.read()
        except Exception:
            if i == 3:
                raise
            time.sleep(5 * (i + 1))


def pct(v):
    try:
        return round(float(v) * 100, 1)
    except (TypeError, ValueError):
        return None


def main():
    want = {a.lower() for a in sys.argv[1:]}
    fips_all = counties_with_files()
    by_state = {}
    for f in fips_all:
        st = FIPS_ST.get(f[:2])
        if st and (not want or st in want):
            by_state.setdefault(st, set()).add(f)
    os.makedirs(OUT, exist_ok=True)
    summary, missing = {}, []
    for st in sorted(by_state):
        url = URL.format(st=st)
        try:
            z = zipfile.ZipFile(io.BytesIO(get(url)))
        except Exception as e:
            missing.append((st, str(e)[:120]))
            continue
        member = next(i for i in z.infolist() if i.filename.endswith("_tes.csv"))
        member_date = "%04d-%02d-%02d" % member.date_time[:3]
        # Crosswalk Connecticut's 2020 county codes (09001...) in the American Forests CSV
        # to Connecticut's planning regions (09110...) used in modern bundles.
        ct_bgs = {}
        if st == "ct":
            import gzip
            for p in glob.glob(os.path.join(ROOT, "counties", "bundle_09*.json.gz")):
                try:
                    with gzip.open(p) as f_gz:
                        d_gz = json.load(f_gz)
                        for bg in d_gz.get("details", {}).keys():
                            ct_bgs[bg[5:]] = bg
                except Exception:
                    pass

        rows = {}
        for r in csv.DictReader(io.TextIOWrapper(z.open(member), encoding="utf-8-sig")):
            g = str(r["GEOID"]).zfill(12)
            if st == "ct" and g.startswith("09"):
                suffix = g[5:]
                if suffix in ct_bgs:
                    g = ct_bgs[suffix]
            if g[:5] in by_state[st]:
                rows.setdefault(g[:5], {})[g] = [pct(r.get("tc_gap")), pct(r.get("treecanopy")), pct(r.get("tc_goal"))]
        for f in sorted(by_state[st]):
            d = rows.get(f, {})
            d["_meta"] = {
                "county_fips": f,
                "source": "American Forests, Tree Equity Score (current release)",
                "url": url,
                "zip_member": member.filename,
                "zip_member_date": member_date,
                "geography": "2020 Census block groups (urban-area block groups only; Tree Equity Score covers urban areas)",
                "fields": ["canopy gap to goal (percentage points; goal minus canopy)", "tree canopy (%)", "canopy goal (%)"],
                "not_used": "temp_diff (heat): a different measure from the 2021 heat figure shown in degrees",
                "terms": "No data license is stated on treeequityscore.org's reachable pages (home, methodology, about; checked 2026-11-16), and https://www.americanforests.org/terms-of-use/ has no data-license clause. Cited as American Forests, Tree Equity Score; confirm reuse terms with American Forests before redistribution.",
                "built": date.today().isoformat(),
                "script": "scripts/build_tree_equity_2025.py",
            }
            with open(os.path.join(OUT, f"{f}.json"), "w") as fh:
                json.dump(d, fh, separators=(",", ":"))
            summary[f] = len(d) - 1
        print(f"{st}: {member_date}, {sum(len(rows.get(f, {})) for f in by_state[st])} block groups in {len(by_state[st])} counties", file=sys.stderr, flush=True)
        time.sleep(0.5)
    print(f"wrote {len(summary)} county files; {sum(summary.values())} block groups; states failed: {missing}", file=sys.stderr)


if __name__ == "__main__":
    main()
