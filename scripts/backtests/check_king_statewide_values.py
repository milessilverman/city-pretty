#!/usr/bin/env python3
"""Check that the Washington statewide parcel layer holds King County's tax-year-2026 appraised values.

The King back-test used the Assessor's tax-year-2026 appraised land + improvements value (EXTR_ValueHistory_V,
scripts/backtests/pull_king.py). The page can read a value for King only from the Washington statewide parcel layer
(VALUE_LAND + VALUE_BLDG), which has no roll-year field. So: sample parcels from the back-test's sales file, read the
same parcels from the statewide layer, and count exact matches. The page computes King estimates only while this
check's match rate is at least 98% and the check is recent (app/app.js, countyModelEstimate).

Usage: python3 scripts/backtests/check_king_statewide_values.py [sample size]   (default 500; seed fixed)
Output: data/backtests/king_statewide_value_check.json
"""
import gzip
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALES = os.path.join(ROOT, "data", "backtests", "sales_53033_2026-11-16.json.gz")
OUT = os.path.join(ROOT, "data", "backtests", "king_statewide_value_check.json")
LAYER = "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def query(pins):
    where = "FIPS_NR='033' AND ORIG_PARCEL_ID IN (" + ",".join(f"'{p}'" for p in pins) + ")"
    url = f"{LAYER}/query?" + urllib.parse.urlencode({"where": where, "outFields": "ORIG_PARCEL_ID,VALUE_LAND,VALUE_BLDG", "returnGeometry": "false", "f": "json"})
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                d = json.load(r)
            if "error" in d:
                raise RuntimeError(d["error"])
            return {f["attributes"]["ORIG_PARCEL_ID"]: f["attributes"] for f in d.get("features", [])}
        except Exception:
            if i == 3:
                raise
            time.sleep(3 * (i + 1))


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    rows = json.load(gzip.open(SALES))["rows"]
    # latest record per parcel with a tax-year-2026 value
    av = {}
    for r in rows:
        if r.get("av"):
            av[r["id"]] = r["av"]
    pins = sorted(av)
    random.Random(20261116).shuffle(pins)
    sample = pins[:n]
    found, matched, mismatches = 0, 0, []
    for i in range(0, len(sample), 100):
        got = query(sample[i:i + 100])
        for p in sample[i:i + 100]:
            g = got.get(p)
            if not g:
                continue
            found += 1
            v = (g.get("VALUE_LAND") or 0) + (g.get("VALUE_BLDG") or 0)
            if abs(v - av[p]) < 0.5:
                matched += 1
            elif len(mismatches) < 20:
                mismatches.append({"pin": p, "assessor_2026": av[p], "statewide_layer": v})
    out = {
        "checked_on": date.today().isoformat(),
        "layer": LAYER,
        "compared": "VALUE_LAND + VALUE_BLDG vs the Assessor's tax-year-2026 appraised land + improvements value in the back-test sales file",
        "sales_file": os.path.relpath(SALES, ROOT),
        "sampled": len(sample), "found_in_layer": found, "matched": matched,
        "match_rate": round(matched / found, 4) if found else 0,
        "rule": "the page computes King estimates only while match_rate >= 0.98 and the check is at most 120 days old",
        "mismatch_examples": mismatches,
    }
    json.dump(out, open(OUT, "w"), indent=1)
    print(json.dumps({k: out[k] for k in ("sampled", "found_in_layer", "matched", "match_rate")}), file=sys.stderr)


if __name__ == "__main__":
    main()
