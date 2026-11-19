#!/usr/bin/env python3
"""Compares the county data files' 2021 canopy gap (m.tg) with the current Tree Equity release
(app/data/tree_equity_2025/<fips>.json) for every block group present in both. Prints counts; writes
docs/audit/tree-equity-current-vs-2021.json."""
import base64
import gzip
import json
import os
import re
import statistics
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def bundle_details(fips):
    if fips == "06059":
        d = json.loads(gzip.decompress(base64.b64decode(open(os.path.join(ROOT, "app/data/bundle-oc.b64.txt")).read().strip())))
        return d.get("details", {})
    if fips == "06037":
        src = json.load(open(os.path.join(ROOT, "app/data/details-la.json")))
        out = {}
        for b in src["chunks"].values():
            out.update(json.loads(gzip.decompress(base64.b64decode(b))))
        return out
    p = os.path.join(ROOT, "counties", f"bundle_{fips}.json.gz")
    return json.loads(gzip.decompress(open(p, "rb").read())).get("details", {}) if os.path.exists(p) else {}


diffs, only_new, only_old, dates = [], 0, 0, {}
for p in sorted(glob.glob(os.path.join(ROOT, "app/data/tree_equity_2025/*.json"))):
    fips = os.path.basename(p)[:5]
    te = json.load(open(p))
    dates[te["_meta"]["zip_member_date"]] = dates.get(te["_meta"]["zip_member_date"], 0) + 1
    det = bundle_details(fips)
    for g, v in det.items():
        m = (v or {}).get("m") or {}
        old = m.get("tg")
        new = te.get(g, [None])[0] if g in te else None
        if old is not None and new is not None:
            diffs.append(abs(float(new) - float(old)))
        elif new is not None:
            only_new += 1
        elif old is not None:
            only_old += 1
res = {
    "block_groups_compared": len(diffs),
    "median_abs_diff_pts": round(statistics.median(diffs), 2) if diffs else None,
    "moved_gt_5_pts": sum(1 for d in diffs if d > 5),
    "share_moved_gt_5_pts": round(sum(1 for d in diffs if d > 5) / len(diffs), 3) if diffs else None,
    "current_only": only_new,
    "old_only_no_current_value": only_old,
    "county_files_by_release_date": dates,
}
json.dump(res, open(os.path.join(ROOT, "docs/audit/tree-equity-current-vs-2021.json"), "w"), indent=1)
print(json.dumps(res))
