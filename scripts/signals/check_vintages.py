#!/usr/bin/env python3
"""Checks which census-tract vintage (2010 or 2020 codes) each table's tract codes belong to, and how much the 2010 -> 2020 change touches the
50 back-test counties. Writes data/signals/vintage_checks.json (quoted in docs/audit/prediction-signals-2026-11-22.md).

A tract code 'belongs' to a vintage if it is in that vintage's list (the 2010 list = tract10 column of xwalk_tract10_tract20, the 2020 list = tract20 column).
Codes present in both lists are 'same code'; a same-code tract may still have different boundaries (see share_unchanged: w10to20 >= 0.95 and w20from10 >= 0.95).
Usage: python3 scripts/signals/check_vintages.py
"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loaders  # noqa: E402
from common import OUT, backtest_counties, read_gz_csv  # noqa: E402

cs = set(backtest_counties())


def main():
    x = loaders.tract10_to_tract20()
    t10 = set(x)
    t20 = {t for v in x.values() for t, _, _ in v}
    one_to_one = {}
    for a, v in x.items():
        for b, w10, w20 in v:
            if a == b and (w10 or 0) >= 0.95 and (w20 or 0) >= 0.95:
                one_to_one[a] = True
    res = {"tracts_2010": len(t10), "tracts_2020": len(t20), "same_code_both": len(t10 & t20), "same_code_and_95pct_same_land": len(one_to_one)}
    in50_10 = {t for t in t10 if t[:5] in cs}
    in50_20 = {t for t in t20 if t[:5] in cs}
    res["50_counties"] = {"tracts_2010": len(in50_10), "tracts_2020": len(in50_20),
                          "same_code_and_95pct_same_land": sum(1 for t in one_to_one if t[:5] in cs),
                          "share_2010_tracts_unchanged": round(sum(1 for t in one_to_one if t[:5] in cs) / len(in50_10), 4)}

    def vint(codes):
        n = len(codes)
        return {"n": n, "share_in_2010_list": round(sum(c in t10 for c in codes) / n, 4), "share_in_2020_list": round(sum(c in t20 for c in codes) / n, 4)}

    for name, fn in (("hmda_2018plus", "hmda_tract_year_50counties.csv.gz"), ("hmda_2012_2017", "hmda_legacy_tract_year_50counties.csv.gz")):
        if os.path.exists(os.path.join(OUT, fn)):
            by = collections.defaultdict(set)
            for r in read_gz_csv(os.path.join(OUT, fn)):
                by[r["year"]].add(r["tract"])
            res[name] = {y: vint(c) for y, c in sorted(by.items())}
    by = collections.defaultdict(set)
    for r in read_gz_csv(os.path.join(OUT, "fhfa_tract_annual.csv.gz")):
        if r["year"] in ("1999", "2010", "2020", "2025"):
            by[r["year"]].add(r["tract"])
    res["fhfa_tract"] = {y: vint(c) for y, c in sorted(by.items())}
    json.dump(res, open(os.path.join(OUT, "vintage_checks.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
