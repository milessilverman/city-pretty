#!/usr/bin/env python3
"""Florida single-family sales for the home-value back-test, from the statewide parcel layer the page already uses.

Source: Florida Statewide Cadastral (Florida Geographic Information Office copy of the Department of Revenue NAL
property roll), https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0
One row per parcel: the most recent sale (SALE_PRC1, SALE_YR1, SALE_MO1, QUAL_CD1, VI_CD1), characteristics
(TOT_LVG_AR, ACT_YR_BLT, EFF_YR_BLT, LND_SQFOOT), the 2026 just value (JV, as of 1 January 2026; ASMNT_YR 2026),
and CENSUS_BK (12 digits). CENSUS_BK is the 2010 block group, not the 2020 one: checked 16 Nov 2026 against TIGERweb
Census2010 and Census2020 block groups at parcel points (Miami-Dade, Palm Beach). The page reads the same field.

Filters, stated and applied here:
  * DOR_UC = '001' (single family) and VI_CD1 = 'I' (improved at sale)
  * QUAL_CD1 in the qualified set passed on the command line (default '01'); see county_config.json for the
    evidence used to pick the qualified code(s)
  * sale price >= $25,000 and living area >= 400 sq ft
  * sale year >= the start year (default 2025)
Sale date = the 15th of SALE_MO1/SALE_YR1 (the roll records month, not day).

Usage: python3 scripts/backtests/pull_florida.py <DOR county number> <county FIPS> "<county name>" [start year] [codes]
"""
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
B = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query"
FIELDS = "OBJECTID,PARCEL_ID,QUAL_CD1,VI_CD1,SALE_PRC1,SALE_YR1,SALE_MO1,JV,ASMNT_YR,TOT_LVG_AR,ACT_YR_BLT,EFF_YR_BLT,LND_SQFOOT,CENSUS_BK,DOR_UC,NO_RES_UNT"


def q(params, tries=8):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(B + "?" + urllib.parse.urlencode(params), timeout=240) as r:
                d = json.load(r)
            if "error" not in d:
                return d
            last = d["error"]
        except Exception as e:
            last = e
        time.sleep(3 + 3 * i)
    raise RuntimeError(f"query failed: {last}")


def main():
    co, fips, name = int(sys.argv[1]), sys.argv[2], sys.argv[3]
    start = int(sys.argv[4]) if len(sys.argv) > 4 else 2025
    codes = (sys.argv[5] if len(sys.argv) > 5 else "01").split(",")
    where0 = f"CO_NO={co} AND DOR_UC='001' AND SALE_YR1>={start} AND SALE_PRC1>=25000"
    # The service intermittently rejects queries under load; progress is checkpointed so a stall resumes, not restarts.
    ck = os.path.join(ROOT, "data", "backtests", f".pull_{fips}_partial.json")
    raw, last = (json.load(open(ck)) if os.path.exists(ck) else ([], 0))
    stalls = 0
    while True:
        try:
            d = q({"where": f"{where0} AND OBJECTID>{last}", "outFields": FIELDS, "returnGeometry": "false", "orderByFields": "OBJECTID",
                   "resultRecordCount": 1000, "f": "json"})
        except RuntimeError as e:
            stalls += 1
            if stalls > 6:
                raise
            print(f"  stalled at {len(raw)} rows ({e}); waiting 90 s", file=sys.stderr)
            time.sleep(90)
            continue
        f = [x["attributes"] for x in d.get("features", [])]
        if not f:
            break
        raw += f
        last = f[-1]["OBJECTID"]
        json.dump([raw, last], open(ck, "w"))
        print(f"  {len(raw)} rows", file=sys.stderr)
        if not d.get("exceededTransferLimit") and len(f) < 1000:
            break
    rows, drop, code_counts = [], {}, {}
    def no(k):
        drop[k] = drop.get(k, 0) + 1
    for a in raw:
        code_counts[a["QUAL_CD1"]] = code_counts.get(a["QUAL_CD1"], 0) + 1
        if (a["VI_CD1"] or "").strip() != "I": no("not improved at sale"); continue
        if codes != ["*"] and (a["QUAL_CD1"] or "").strip() not in codes: no("sale not qualified"); continue
        if not (a["TOT_LVG_AR"] or 0) >= 400: no("living area missing or under 400 sq ft"); continue
        mo = str(a["SALE_MO1"] or "").strip()
        if not mo.isdigit(): no("no sale month"); continue
        bk = str(a["CENSUS_BK"] or "").strip()
        if len(bk) < 12: no("no block group"); continue
        yb = a["ACT_YR_BLT"] or 0
        rows.append({
            "qual": (a["QUAL_CD1"] or "").strip(), "id": a["PARCEL_ID"], "price": float(a["SALE_PRC1"]), "date": f"{a['SALE_YR1']}-{int(mo):02d}-15",
            "bg": bk[:12], "tract": bk[:11], "sqft": float(a["TOT_LVG_AR"]), "lot": float(a["LND_SQFOOT"]) if a["LND_SQFOOT"] else None,
            "yb": yb if yb > 1700 else None, "eff": a["EFF_YR_BLT"] or None,
            # Florida's roll records neither bedrooms nor bathrooms; the shared schema marks them unknown (-1 = not recorded)
            "beds": 0, "baths": 0,
            "av": float(a["JV"]) if a["JV"] else None, "av_date": f"{a['ASMNT_YR']}-01-01" if a["ASMNT_YR"] else None,
        })
    out = {
        "county_fips": fips, "county_name": name, "pulled": date.today().isoformat(), "sources": {"florida_statewide_cadastral": B},
        "filters": __doc__.split("Filters, stated and applied here:")[1].split("Usage:")[0].strip(), "qualified_codes_used": codes,
        "qualification_code_counts_in_pull": code_counts, "dropped": drop, "rows": rows,
        "note": "Florida's roll has no bedroom/bathroom counts; beds/baths are set to 0 for every row so models that use them get no information from them.",
    }
    path = os.path.join(ROOT, "data", "backtests", f"sales_{fips}_{date.today().isoformat()}.json.gz")
    with gzip.open(path, "wt") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {path}: {len(rows)} sales; codes in pull {code_counts}; dropped {drop}", file=sys.stderr)


if __name__ == "__main__":
    main()
