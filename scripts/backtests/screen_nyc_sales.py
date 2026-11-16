#!/usr/bin/env python3
"""Apply the locked NYC deed screens (scripts/backtests/nyc_sale_screens_locked.json) to a sales file.

Inputs: a sales file from pull_nyc.py and the diag_nyc_acris.py output for the window to be tested (its row_markers
list every sale in that window with the markers found on its ACRIS deed). Sales in that window carrying an excluded
marker are dropped; sales outside the window are left as they are (the screens were locked for the next fresh test
window only, not to rewrite the fit data). Writes sales_<fips>_<pulled>_screened.json.gz next to the input, with the
screens added to its filters and the drop counts recorded. Point county_config.json's sales_file at it for that test.

Usage: python3 -I scripts/backtests/screen_nyc_sales.py <sales file> <acris diag file>
"""
import gzip, json, os, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    sales_path, diag_path = sys.argv[1], sys.argv[2]
    lock = json.load(open(os.path.join(ROOT, "scripts/backtests/nyc_sale_screens_locked.json")))
    excl = {e["marker"] for e in lock["exclude_when"]}
    data = json.load(gzip.open(sales_path))
    diag = json.load(open(diag_path))
    t0, t1 = diag["test_window"]
    marks = {(m["id"], m["date"], m["price"]): m["markers"] for m in diag.get("row_markers", [])}
    if not marks:
        sys.exit("diag file has no row_markers; re-run diag_nyc_acris.py")
    kept, drop, missing = [], Counter(), 0
    for r in data["rows"]:
        if not (t0 <= r["date"] <= t1):
            kept.append(r)
            continue
        mk = marks.get((r["id"], r["date"], r["price"]))
        if mk is None:
            missing += 1
            kept.append(r)
            continue
        hit = [m for m in mk if m in excl]
        if hit:
            for m in hit:
                drop[m] += 1
            drop["rows dropped"] += 1
        else:
            kept.append(r)
    if missing:
        sys.exit(f"{missing} window sales are not in the diag file; the diag must be run on this same sales file")
    data["rows"] = kept
    data["filters"] = list(data.get("filters", [])) + [
        f"deed screens locked {lock['locked_on']} (scripts/backtests/nyc_sale_screens_locked.json), applied to sales dated {t0}..{t1}: "
        + "; ".join(f"{e['marker']} ({e['rule']})" for e in lock["exclude_when"])]
    data.setdefault("counts", {})["deed_screens"] = {"window": [t0, t1], "diag_file": os.path.relpath(diag_path, ROOT), **dict(drop)}
    out = sales_path.replace(".json.gz", "_screened.json.gz")
    with gzip.open(out, "wt") as f:
        json.dump(data, f, separators=(",", ":"))
    print(json.dumps(data["counts"]["deed_screens"], indent=1))
    print("wrote", out, file=sys.stderr)


if __name__ == "__main__":
    main()
