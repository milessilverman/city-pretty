#!/usr/bin/env python3
"""Geography for the prediction model (docs/PREDICTION-MODEL.md A.5): tract centres, county -> CBSA, tract -> permit jurisdiction.

Downloads (to PREDICT_SCRATCH, deleted after reduction; URLs checked 22 Nov 2026):
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_tracts_national.zip   (tract internal points)
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_cousubs_national.zip   (county subdivision names)
  https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx
  https://www2.census.gov/geo/docs/maps-data/data/baf2020/BlockAssign_ST<ss>_<ST>.zip   (2020 block -> place, block -> county subdivision)
Writes data/predict/:
  tract_centroids_2020.csv.gz   tract,lat,lon,aland  (every 2020 tract in the sample counties' states)
  county_cbsa_2023.csv          county,cbsa,cbsa_title,metro_micro  (every county in a CBSA)
  tract_jurisdiction_50counties.csv.gz  tract,state,bps_id,kind,name,block_share  (kind: place | mcd | unincorporated)
  geo_meta.json                 URLs, Last-Modified headers, retrieval date, match counts
Usage: python3 scripts/predict/fetch_geo.py
"""
import collections
import datetime
import gzip
import csv
import io
import json
import os
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "scripts", "signals"))
from common import backtest_counties, curl_file, read_gz_csv, write_gz_csv  # noqa: E402

OUT = os.path.join(ROOT, "data", "predict")
SCRATCH = os.environ.get("PREDICT_SCRATCH", "/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/predict/dl")
os.makedirs(OUT, exist_ok=True)
os.makedirs(SCRATCH, exist_ok=True)

GAZ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/"
CBSA_URL = "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx"
BAF = "https://www2.census.gov/geo/docs/maps-data/data/baf2020/BlockAssign_ST{ss}_{st}.zip"
USPS = {"04": "AZ", "06": "CA", "12": "FL", "13": "GA", "17": "IL", "18": "IN", "25": "MA", "26": "MI", "27": "MN", "29": "MO", "32": "NV",
        "34": "NJ", "36": "NY", "39": "OH", "40": "OK", "42": "PA", "47": "TN", "48": "TX", "49": "UT", "53": "WA", "55": "WI"}
# Consolidated cities: the block file codes the "balance" place, the permit file the whole consolidated city.
# Indianapolis city (balance) 36003 -> Indianapolis 36000 (Marion County, IN; seen in both files on 22 Nov 2026).
BALANCE_ALIAS = {("18", "36003"): "36000"}


def last_modified(url):
    r = subprocess.run(["curl", "-sSI", "--fail", url], capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.lower().startswith("last-modified:"):
            return line.split(":", 1)[1].strip()
    return None


def fetch(url):
    dest = os.path.join(SCRATCH, os.path.basename(url))
    if not (os.path.exists(dest) and os.path.getsize(dest) > 0):
        curl_file(url, dest)
    return dest


def main():
    counties = backtest_counties()
    states = sorted({c[:2] for c in counties})
    missing_states = [s for s in states if s not in USPS]
    if missing_states:
        raise SystemExit("no USPS code for state " + ",".join(missing_states))
    meta = {"retrieved": datetime.date.today().isoformat(), "sources": []}

    # 1. tract centres
    url = GAZ + "2020_Gaz_tracts_national.zip"
    z = fetch(url)
    rows = []
    with zipfile.ZipFile(z) as zf, zf.open(zf.namelist()[0]) as f:
        hdr = None
        for raw in io.TextIOWrapper(f, encoding="utf-8"):
            p = [x.strip() for x in raw.rstrip("\n").split("\t")]
            if hdr is None:
                hdr = p
                continue
            d = dict(zip(hdr, p))
            if d["GEOID"][:2] in states:
                rows.append((d["GEOID"], d["INTPTLAT"], d["INTPTLONG"], d["ALAND"]))
    write_gz_csv(os.path.join(OUT, "tract_centroids_2020.csv.gz"), ["tract", "lat", "lon", "aland"], rows)
    meta["sources"].append({"url": url, "last_modified": last_modified(url), "rows_kept": len(rows)})
    os.remove(z)

    # 2. county subdivision names
    url = GAZ + "2020_Gaz_cousubs_national.zip"
    z = fetch(url)
    cousub = {}
    with zipfile.ZipFile(z) as zf, zf.open(zf.namelist()[0]) as f:
        hdr = None
        for raw in io.TextIOWrapper(f, encoding="utf-8"):
            p = [x.strip() for x in raw.rstrip("\n").split("\t")]
            if hdr is None:
                hdr = p
                continue
            d = dict(zip(hdr, p))
            if d["GEOID"][:5] in counties:
                cousub[d["GEOID"]] = d["NAME"]
    meta["sources"].append({"url": url, "last_modified": last_modified(url), "cousubs_in_sample": len(cousub)})
    os.remove(z)

    # 3. CBSA delineation (header row is the third line of the sheet)
    import openpyxl
    z = fetch(CBSA_URL)
    ws = openpyxl.load_workbook(z, read_only=True).active
    it = ws.iter_rows(values_only=True)
    hdr = None
    out = []
    for row in it:
        if hdr is None:
            if row and row[0] == "CBSA Code":
                hdr = list(row)
            continue
        d = dict(zip(hdr, row))
        if not d.get("FIPS State Code"):
            continue
        out.append((str(d["FIPS State Code"]).zfill(2) + str(d["FIPS County Code"]).zfill(3), d["CBSA Code"], d["CBSA Title"], d["Metropolitan/Micropolitan Statistical Area"]))
    with open(os.path.join(OUT, "county_cbsa_2023.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["county", "cbsa", "cbsa_title", "metro_micro"])
        w.writerows(sorted(out))
    meta["sources"].append({"url": CBSA_URL, "last_modified": last_modified(CBSA_URL), "counties": len(out),
                            "sample_counties_matched": sum(1 for c in counties if any(r[0] == c for r in out))})
    os.remove(z)

    # 4. permit jurisdictions (Building Permits Survey place rows in the sample counties, any year)
    bps = {}  # (state, county) -> list of (bps_id, fips_place, name)
    for r in read_gz_csv(os.path.join(ROOT, "data", "signals", "bps_place_annual.csv.gz")):
        sc = r["state"] + r["county"]
        if sc in counties:
            bps.setdefault(sc, {})[r["bps_id"]] = (r["fips_place"], r["name"])
    by_place = collections.defaultdict(dict)  # state -> fips_place -> bps_id (incorporated places with a code)
    by_name = collections.defaultdict(dict)   # county -> lower name -> bps_id
    unincorp = {}
    for sc, d in bps.items():
        for bid, (fp, name) in d.items():
            if fp == "99990":
                unincorp[sc] = (bid, name)
            elif fp != "00000":
                by_place[sc[:2]][fp] = (bid, name)
            by_name[sc][name.lower()] = (bid, name)

    tract_votes = collections.defaultdict(collections.Counter)
    counts = collections.Counter()
    for ss in states:
        url = BAF.format(ss=ss, st=USPS[ss])
        z = fetch(url)
        with zipfile.ZipFile(z) as zf:
            names = zf.namelist()
            place = {}
            with zf.open([n for n in names if n.endswith("_INCPLACE_CDP.txt")][0]) as f:
                for i, raw in enumerate(io.TextIOWrapper(f, encoding="utf-8")):
                    if i == 0:
                        continue
                    b, fp = raw.rstrip("\n").split("|")
                    if b[:5] in counties:
                        place[b] = fp
            mcd = {}
            mcd_files = [n for n in names if n.endswith("_MCD.txt")]
            if mcd_files:  # some states have no county-subdivision file in the 2020 block assignment set
                with zf.open(mcd_files[0]) as f:
                    for i, raw in enumerate(io.TextIOWrapper(f, encoding="utf-8")):
                        if i == 0:
                            continue
                        b, cf, cs = raw.rstrip("\n").split("|")
                        if b[:5] in counties:
                            mcd[b] = cs
            for b, fp in place.items():
                sc = b[:5]
                cs = mcd.get(b, "")
                hit = None
                fp = BALANCE_ALIAS.get((ss, fp), fp)
                if fp and fp in by_place[ss]:
                    hit = by_place[ss][fp] + ("place",)
                if hit is None and cs:
                    nm = cousub.get(sc + cs)
                    if nm and nm.lower() in by_name[sc]:
                        hit = by_name[sc][nm.lower()] + ("mcd",)
                if hit is None and sc in unincorp:
                    hit = unincorp[sc] + ("unincorporated",)
                counts[hit[2] if hit else "none"] += 1
                tract_votes[b[:11]][(hit[0], hit[2], hit[1]) if hit else (None, "none", None)] += 1
        meta["sources"].append({"url": url, "last_modified": last_modified(url)})
        os.remove(z)
    rows = []
    for t, c in sorted(tract_votes.items()):
        (bid, kind, name), n = c.most_common(1)[0]
        rows.append((t, t[:2], bid or "", kind, name or "", round(n / sum(c.values()), 4)))
    write_gz_csv(os.path.join(OUT, "tract_jurisdiction_50counties.csv.gz"), ["tract", "state", "bps_id", "kind", "name", "block_share"], rows)
    meta["block_matches"] = dict(counts)
    meta["tracts"] = len(rows)
    meta["tracts_by_kind"] = dict(collections.Counter(r[3] for r in rows))
    json.dump(meta, open(os.path.join(OUT, "geo_meta.json"), "w"), indent=1)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
