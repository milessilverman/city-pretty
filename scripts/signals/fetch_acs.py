#!/usr/bin/env python3
"""Source (h): ACS 5-year tract estimates for the two vintages the neighbourhood back-test used, for the 50 back-test counties.

This REUSES the files the back-test downloaded (BACKTEST_CACHE, see common.py); a missing file is fetched from the URL below.
URLs (same ones scripts/backtest_neighborhood_score.mjs uses):
  ACS 2015-2019  https://www2.census.gov/programs-surveys/acs/summary_file/2019/prototype/5YRData/acsdt5y2019-<table>.dat      (pipe-delimited, one file per table)
  ACS 2010-2014  https://www2.census.gov/programs-surveys/acs/summary_file/2014/data/5_year_seq_by_state/<State>/Tracts_Block_Groups_Only/20145<st><seq>000.zip
                 + g20145<st>.csv (geography) + .../documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt (table -> sequence/position)
Both vintages are on 2010 tract codes. Release dates: ACS 2010-14 in Dec 2015, ACS 2015-19 in Dec 2020 (so as a feature for a window it is
usable from the following year, the convention the back-test used).
Output: data/signals/acs_tract_50counties.csv.gz  tract,vintage,<cell columns>  (blank = Census annotation / not available; never zero)
Cells: pop B01003_1, workers B08301_1, transit B08301_10, inc B19013_1 (median household income), units B25001_1, occ_total B25002_1, vacant B25002_3,
  ten_total B25003_1, owner B25003_2, struct_total B25024_1, sf_detached B25024_2, sf_attached B25024_3, yb B25035_1 (median year built),
  veh_total B25044_1, owner_noveh B25044_3, renter_noveh B25044_10, rent B25064_1 (median gross rent), hv B25077_1 (median home value)
Usage: python3 scripts/signals/fetch_acs.py
"""
import csv
import io
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BACKTEST_CACHE, SCRATCH, OUT, backtest_counties, curl_file, write_gz_csv  # noqa: E402

CELLS = {
    "pop": ("B01003", 1), "workers": ("B08301", 1), "transit": ("B08301", 10), "inc": ("B19013", 1),
    "units": ("B25001", 1), "occ_total": ("B25002", 1), "vacant": ("B25002", 3), "ten_total": ("B25003", 1), "owner": ("B25003", 2),
    "struct_total": ("B25024", 1), "sf_detached": ("B25024", 2), "sf_attached": ("B25024", 3), "yb": ("B25035", 1),
    "veh_total": ("B25044", 1), "owner_noveh": ("B25044", 3), "renter_noveh": ("B25044", 10), "rent": ("B25064", 1), "hv": ("B25077", 1),
}
STATE_DIR = {"01": "Alabama", "04": "Arizona", "06": "California", "08": "Colorado", "11": "DistrictOfColumbia", "12": "Florida", "13": "Georgia", "17": "Illinois",
             "18": "Indiana", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota", "29": "Missouri", "32": "Nevada", "34": "NewJersey", "36": "NewYork",
             "39": "Ohio", "40": "Oklahoma", "42": "Pennsylvania", "47": "Tennessee", "48": "Texas", "49": "Utah", "53": "Washington", "55": "Wisconsin"}
USPS = {"01": "al", "04": "az", "06": "ca", "08": "co", "11": "dc", "12": "fl", "13": "ga", "17": "il", "18": "in", "25": "ma", "26": "mi", "27": "mn", "29": "mo",
        "32": "nv", "34": "nj", "36": "ny", "39": "oh", "40": "ok", "42": "pa", "47": "tn", "48": "tx", "49": "ut", "53": "wa", "55": "wi"}
COUNTIES = set(backtest_counties())
ROOT19 = "https://www2.census.gov/programs-surveys/acs/summary_file/2019/prototype/5YRData/"
ROOT14 = "https://www2.census.gov/programs-surveys/acs/summary_file/2014/data/5_year_seq_by_state/"
LOOKUP = "https://www2.census.gov/programs-surveys/acs/summary_file/2014/documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt"


def cached(name, url):
    p = os.path.join(BACKTEST_CACHE, name)
    return p if os.path.exists(p) else curl_file(url, os.path.join(SCRATCH, name))


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return ""
    return "" if x < 0 else (str(int(x)) if x == int(x) else str(x))  # negative = Census annotation code


def acs2019():
    out = {}
    for tab in sorted({t for t, _ in CELLS.values()}):
        f = cached(f"acsdt5y2019-{tab.lower()}.dat", f"{ROOT19}acsdt5y2019-{tab.lower()}.dat")
        with open(f, encoding="latin1") as fh:
            hdr = fh.readline().rstrip("\n").split("|")
            ix = {h: i for i, h in enumerate(hdr)}
            for line in fh:
                if not line.startswith("1400000US"):
                    continue
                p = line.rstrip("\n").split("|")
                t = p[0][9:]
                if t[:5] not in COUNTIES:
                    continue
                row = out.setdefault(t, {})
                for k, (tb, ln) in CELLS.items():
                    if tb == tab:
                        row[k] = num(p[ix[f"{tab}_E{ln:03d}"]])
    return out


def lookup14():
    f = cached("ACS_5yr_Seq_Table_Number_Lookup_2014.txt", LOOKUP)
    start, titles = {}, {}
    for p in csv.reader(open(f, encoding="latin1")):
        if len(p) < 8 or p[0] != "ACSSF":
            continue
        if p[4].strip() and not p[3].strip():
            start[p[1]] = (p[2], int(p[4]))
        if p[3].strip().isdigit():  # (half-lines such as 0.5 are table sub-headings)
            titles[(p[1], int(p[3]))] = p[7]
    return start, titles


def acs2014():
    start, titles = lookup14()
    assert titles[("B25002", 3)].startswith("Vacant") and titles[("B25003", 2)].startswith("Owner occupied"), "lookup layout changed"
    out = {}
    for st in sorted({c[:2] for c in COUNTIES}):
        u, d = USPS[st], STATE_DIR[st]
        geo = cached(f"g20145{u}.csv", f"{ROOT14}{d}/Tracts_Block_Groups_Only/g20145{u}.csv")
        rec = {}
        for line in open(geo, encoding="latin1"):
            m = re.match(r"^ACSSF,[A-Z]{2},140,00,(\d{7}),.*14000US(\d{11})", line)
            if m and m.group(2)[:5] in COUNTIES:
                rec[m.group(1)] = m.group(2)
        for seq in sorted({s for s, _ in start.values() if s in {start[t][0] for t, _ in CELLS.values()}}):
            z = cached(f"20145{u}{seq}000.zip", f"{ROOT14}{d}/Tracts_Block_Groups_Only/20145{u}{seq}000.zip")
            with zipfile.ZipFile(z) as zf, zf.open(f"e20145{u}{seq}000.txt") as fh:
                for line in io.TextIOWrapper(fh, encoding="latin1"):
                    p = line.rstrip("\r\n").split(",")
                    t = rec.get(p[5])
                    if not t:
                        continue
                    row = out.setdefault(t, {})
                    for k, (tb, ln) in CELLS.items():
                        if start[tb][0] == seq:
                            row[k] = num(p[start[tb][1] - 1 + ln - 1])
    return out


def main():
    rows = []
    for vint, data in (("2010-2014", acs2014()), ("2015-2019", acs2019())):
        for t in sorted(data):
            rows.append([t, vint] + [data[t].get(k, "") for k in CELLS])
        print(vint, len(data), "tracts")
    print("bytes", write_gz_csv(os.path.join(OUT, "acs_tract_50counties.csv.gz"), ["tract", "vintage"] + list(CELLS), rows))


if __name__ == "__main__":
    main()
