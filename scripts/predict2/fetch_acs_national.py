#!/usr/bin/env python3
"""ACS 5-year tract estimates, every state + DC, for the hold-out-metro prediction test (docs/audit/prediction-2026-11-23.md).

Vintages and URLs (all on www2.census.gov, checked 23 Nov 2026):
  2006-2010  .../acs/summary_file/2010/data/5_year_seq_by_state/<State>/Tracts_Block_Groups_Only/20105<st><seq>000.zip + g20105<st>.csv
             lookup .../acs/summary_file/2010/documentation/5_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt
  2010-2014  .../acs/summary_file/2014/data/5_year_seq_by_state/<State>/Tracts_Block_Groups_Only/20145<st><seq>000.zip + g20145<st>.csv
             lookup .../acs/summary_file/2014/documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt
  2015-2019  .../acs/summary_file/2019/prototype/5YRData/acsdt5y2019-<table>.dat  (national, one file per table)
Cells: hv B25077_1 (median value), inc B19013_1 (median household income), rent B25064_1 (median gross rent),
       units B25002_1 (housing units), vacant B25002_3.
Census annotation codes (negative numbers) become blank. Raw files go to the scratch folder and are deleted after reading.
Output: data/predict2/acs_tract_national.csv.gz  tract,vintage_end,hv,inc,rent,units,vacant   (tract codes as published)
Usage: python3 scripts/predict2/fetch_acs_national.py [--scratch DIR]
"""
import argparse
import concurrent.futures as cf
import csv
import gzip
import io
import json
import os
import re
import subprocess
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "predict2")
B = "https://www2.census.gov/programs-surveys/acs/summary_file/"
CELLS = {"hv": ("B25077", 1), "inc": ("B19013", 1), "rent": ("B25064", 1), "units": ("B25002", 1), "vacant": ("B25002", 3)}
STATES = {"01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California", "08": "Colorado", "09": "Connecticut",
          "10": "Delaware", "11": "DistrictOfColumbia", "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
          "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine", "24": "Maryland",
          "25": "Massachusetts", "26": "Michigan", "27": "Minnesota", "28": "Mississippi", "29": "Missouri", "30": "Montana",
          "31": "Nebraska", "32": "Nevada", "33": "NewHampshire", "34": "NewJersey", "35": "NewMexico", "36": "NewYork",
          "37": "NorthCarolina", "38": "NorthDakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania",
          "44": "RhodeIsland", "45": "SouthCarolina", "46": "SouthDakota", "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont",
          "51": "Virginia", "53": "Washington", "54": "WestVirginia", "55": "Wisconsin", "56": "Wyoming"}
USPS = {"01": "al", "02": "ak", "04": "az", "05": "ar", "06": "ca", "08": "co", "09": "ct", "10": "de", "11": "dc", "12": "fl", "13": "ga",
        "15": "hi", "16": "id", "17": "il", "18": "in", "19": "ia", "20": "ks", "21": "ky", "22": "la", "23": "me", "24": "md", "25": "ma",
        "26": "mi", "27": "mn", "28": "ms", "29": "mo", "30": "mt", "31": "ne", "32": "nv", "33": "nh", "34": "nj", "35": "nm", "36": "ny",
        "37": "nc", "38": "nd", "39": "oh", "40": "ok", "41": "or", "42": "pa", "44": "ri", "45": "sc", "46": "sd", "47": "tn", "48": "tx",
        "49": "ut", "50": "vt", "51": "va", "53": "wa", "54": "wv", "55": "wi", "56": "wy"}
SEQ = {2010: {"lookup": B + "2010/documentation/5_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt",
              "dir": B + "2010/data/5_year_seq_by_state/"},
       2014: {"lookup": B + "2014/documentation/user_tools/ACS_5yr_Seq_Table_Number_Lookup.txt",
              "dir": B + "2014/data/5_year_seq_by_state/"}}
ROOT19 = B + "2019/prototype/5YRData/"


def curl(url, dest):
    """Download with retries. The server sometimes answers HTTP 200 with a small HTML "Request Rejected" page when hit
    in parallel, so a reply that starts with "<html" is treated as a failure and retried after a pause."""
    for i in range(4):
        r = subprocess.run(["curl", "-sSL", "--fail", "--max-time", "900", "-o", dest + ".part", url])
        if r.returncode == 0:
            with open(dest + ".part", "rb") as fh:
                head = fh.read(64).lstrip().lower()
            if not head.startswith(b"<html") or url.endswith(".html"):
                os.replace(dest + ".part", dest)
                return dest
        time.sleep(5 + 10 * i)
    raise RuntimeError("download failed: " + url)


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return ""
    return "" if x < 0 else (str(int(x)) if x == int(x) else str(x))


def lookup(path):
    start = {}
    for p in csv.reader(open(path, encoding="latin1")):
        if len(p) < 6 or p[0] != "ACSSF":
            continue
        if p[4].strip() and not p[3].strip():
            start[p[1]] = (int(p[2]), int(p[4]))
    return start


def seq_state(year, st, start, scratch):
    done = os.path.join(scratch, f"done_{year}_{st}.json")
    if os.path.exists(done):
        return json.load(open(done))
    out = _seq_state(year, st, start, scratch)
    json.dump(out, open(done, "w"))
    return out


def _seq_state(year, st, start, scratch):
    u, d = USPS[st], STATES[st]
    base = f"{SEQ[year]['dir']}{d}/Tracts_Block_Groups_Only/"
    yy = str(year)
    geo = curl(f"{base}g{yy}5{u}.csv", os.path.join(scratch, f"g{yy}5{u}.csv"))
    rec = {}
    for line in open(geo, encoding="latin1"):
        m = re.match(r"^ACSSF,[A-Z]{2},140,00,(\d{7}),.*14000US(\d{11})", line)
        if m:
            rec[m.group(1)] = m.group(2)
    os.remove(geo)
    out = {}
    for seq in sorted({start[t][0] for t, _ in CELLS.values()}):
        name = f"{yy}5{u}{seq:04d}000"
        try:
            z = curl(f"{base}{name}.zip", os.path.join(scratch, name + ".zip"))
        except RuntimeError:
            # One sequence file (2010, New Hampshire, seq 98) is always answered with "Request Rejected"; the same
            # file is inside the whole-state archive <dir>/../5_year_by_state/<State>_Tracts_Block_Groups_Only.zip.
            whole = SEQ[year]["dir"].replace("5_year_seq_by_state/", "5_year_by_state/") + f"{d}_Tracts_Block_Groups_Only.zip"
            wz = curl(whole, os.path.join(scratch, f"{yy}_{d}_whole.zip"))
            with zipfile.ZipFile(wz) as zw:
                inner = [n for n in zw.namelist() if n.endswith(f"e{name}.txt")]
                z = os.path.join(scratch, name + ".zip")
                with zipfile.ZipFile(z, "w") as zo:
                    zo.writestr(f"e{name}.txt", zw.read(inner[0]))
            os.remove(wz)
            print("fallback (whole-state archive):", whole, flush=True)
        with zipfile.ZipFile(z) as zf, zf.open(f"e{name}.txt") as fh:
            for line in io.TextIOWrapper(fh, encoding="latin1"):
                p = line.rstrip("\r\n").split(",")
                t = rec.get(p[5])
                if not t:
                    continue
                row = out.setdefault(t, {})
                for k, (tb, ln) in CELLS.items():
                    if start[tb][0] == seq:
                        row[k] = num(p[start[tb][1] - 1 + ln - 1])
        os.remove(z)
    return out


def acs_seq(year, scratch):
    lk = curl(SEQ[year]["lookup"], os.path.join(scratch, f"lookup{year}.txt"))
    start = lookup(lk)
    out, n = {}, 0
    with cf.ThreadPoolExecutor(2) as ex:
        for res in ex.map(lambda st: seq_state(year, st, start, scratch), sorted(STATES)):
            out.update(res)
            n += 1
    print(year, "states", n, "tracts", len(out), flush=True)
    return out


def acs2019(scratch):
    out = {}
    for tab in sorted({t for t, _ in CELLS.values()}):
        f = curl(f"{ROOT19}acsdt5y2019-{tab.lower()}.dat", os.path.join(scratch, f"acsdt5y2019-{tab.lower()}.dat"))
        with open(f, encoding="latin1") as fh:
            hdr = fh.readline().rstrip("\n").split("|")
            ix = {h: i for i, h in enumerate(hdr)}
            for line in fh:
                if not line.startswith("1400000US"):
                    continue
                p = line.rstrip("\n").split("|")
                t = p[0][9:]
                if t[:2] not in STATES:
                    continue
                row = out.setdefault(t, {})
                for k, (tb, ln) in CELLS.items():
                    if tb == tab:
                        row[k] = num(p[ix[f"{tab}_E{ln:03d}"]])
        os.remove(f)
    print(2019, "tracts", len(out), flush=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scratch", default="/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/pred1123/acs")
    a = ap.parse_args()
    os.makedirs(a.scratch, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    data = {2010: acs_seq(2010, a.scratch), 2014: acs_seq(2014, a.scratch), 2019: acs2019(a.scratch)}
    path = os.path.join(OUT, "acs_tract_national.csv.gz")
    with gzip.open(path, "wt", newline="", compresslevel=9) as f:
        w = csv.writer(f)
        w.writerow(["tract", "vintage_end"] + list(CELLS))
        for y, d in data.items():
            for t in sorted(d):
                w.writerow([t, y] + [d[t].get(k, "") for k in CELLS])
    meta = {"retrieved": time.strftime("%Y-%m-%d"), "file": "acs_tract_national.csv.gz", "bytes": os.path.getsize(path),
            "tracts": {str(y): len(d) for y, d in data.items()},
            "urls": {"2010": SEQ[2010]["dir"], "2014": SEQ[2014]["dir"], "2019": ROOT19,
                     "lookup_2010": SEQ[2010]["lookup"], "lookup_2014": SEQ[2014]["lookup"]},
            "cells": {k: f"{t}_{ln:03d}" for k, (t, ln) in CELLS.items()},
            "fallback": "2010 New Hampshire sequence 98 (median gross rent) is always answered 'Request Rejected'; it is read from "
                        "https://www2.census.gov/programs-surveys/acs/summary_file/2010/data/5_year_by_state/NewHampshire_Tracts_Block_Groups_Only.zip",
            "definitions_quoted_from_lookup_2014": {"B25077": "MEDIAN VALUE (DOLLARS)", "B19013": "MEDIAN HOUSEHOLD INCOME IN THE PAST 12 MONTHS (IN 2014 INFLATION-ADJUSTED DOLLARS)",
                                                    "B25064": "MEDIAN GROSS RENT (DOLLARS)", "B25002": "OCCUPANCY STATUS", "B25002_3": "Vacant"},
            "terms": {"url": "https://www.census.gov/data/developers/about/terms-of-service.html", "retrieved": "2026-11-23",
                      "quote": "You may not modify or falsely represent content accessed through the API and still claim the source is the Census Bureau.",
                      "note": "These terms are for the Census API; the summary files above carry no separate licence text that was found."},
            "checks": "2010-14 and 2015-19 values equal data/signals/acs_tract_50counties.csv.gz for every shared tract and cell (151,488 of 151,488, checked 23 Nov 2026)."}
    json.dump(meta, open(os.path.join(OUT, "acs_tract_national_meta.json"), "w"), indent=1)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
