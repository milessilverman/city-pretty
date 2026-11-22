#!/usr/bin/env python3
"""Source (a): FHFA annual House Price Index (all-transactions, developmental) at tract, ZIP5 and county level.

URLs (checked 22 Nov 2026):
  https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv    CSV: tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000
  https://www.fhfa.gov/hpi/download/annual/hpi_at_zip5.xlsx    sheet ZIP5, header on row 6 (40 MB)
  https://www.fhfa.gov/hpi/download/annual/hpi_at_county.xlsx  sheet county, header on row 6 (5 MB)
  (hpi_at_bdl_* names return 404.)  Dataset page: https://www.fhfa.gov/data/hpi/datasets

Outputs (national, all years in the files; blanks stay blank, never zero):
  data/signals/fhfa_tract_annual.csv.gz   tract,year,annual_change,hpi      (2020 tract codes)
  data/signals/fhfa_zip5_annual.csv.gz    zip5,year,annual_change,hpi
  data/signals/fhfa_county_annual.csv.gz  county,year,annual_change,hpi
  data/signals/fhfa_meta.json             retrieval date, 'Last updated' text, row counts
hpi is on the area's own base (100 in its first year); ratios between years are valid, levels across areas are not.
The tract CSV is taken from BACKTEST_CACHE if present (the same file the back-test used), else streamed from fhfa.gov.
Usage: python3 scripts/signals/fetch_fhfa.py
"""
import csv
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BACKTEST_CACHE, OUT, SCRATCH, curl_file, write_gz_csv  # noqa: E402

BASE = "https://www.fhfa.gov/hpi/download/annual/"


def num(x):
    if x is None:
        return ""
    s = str(x).strip()
    if s in ("", ".", "NA", "nan"):
        return ""
    try:
        float(s)
    except ValueError:
        return ""
    return s


def tract():
    src = os.path.join(BACKTEST_CACHE, "hpi_at_tract.csv")
    if not os.path.exists(src):
        src = curl_file(BASE + "hpi_at_tract.csv", os.path.join(SCRATCH, "hpi_at_tract.csv"))
    rows = []
    with open(src, newline="") as f:
        r = csv.reader(f)
        h = next(r)
        assert h == ["tract", "state_abbr", "year", "annual_change", "hpi", "hpi1990", "hpi2000"], h
        for p in r:
            t = p[0].strip().zfill(11)
            if num(p[4]) == "":
                continue
            rows.append([t, p[2], num(p[3]), num(p[4])])
    return rows


def xlsx(name, sheet_cols):
    import openpyxl
    dest = curl_file(BASE + name, os.path.join(SCRATCH, name))
    wb = openpyxl.load_workbook(dest, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows, note, started = [], "", False
    for r in ws.iter_rows(values_only=True):
        if r[0] and str(r[0]).startswith("Last updated"):
            note = str(r[0])
        if not started:
            if r[0] in ("Five-Digit ZIP Code", "State"):
                started = True
            continue
        rows.append(sheet_cols(r))
    wb.close()
    os.remove(dest)
    return [x for x in rows if x and num(x[3]) != ""], note


def main():
    meta = {"retrieved": datetime.date.today().isoformat()}
    t = tract()
    meta["tract_rows"] = len(t)
    meta["tract_bytes"] = write_gz_csv(os.path.join(OUT, "fhfa_tract_annual.csv.gz"), ["tract", "year", "annual_change", "hpi"], t)
    z, note = xlsx("hpi_at_zip5.xlsx", lambda r: [str(r[0]).zfill(5), r[1], num(r[2]), num(r[3])])
    meta["zip5_rows"], meta["zip5_note"] = len(z), note
    meta["zip5_bytes"] = write_gz_csv(os.path.join(OUT, "fhfa_zip5_annual.csv.gz"), ["zip5", "year", "annual_change", "hpi"], z)
    c, note = xlsx("hpi_at_county.xlsx", lambda r: [str(r[2]).zfill(5), r[3], num(r[4]), num(r[5])])
    meta["county_rows"], meta["county_note"] = len(c), note
    meta["county_bytes"] = write_gz_csv(os.path.join(OUT, "fhfa_county_annual.csv.gz"), ["county", "year", "annual_change", "hpi"], c)
    for k, rows in (("tract", t), ("zip5", z), ("county", c)):
        ys = [int(r[1]) for r in rows]
        meta[k + "_years"] = [min(ys), max(ys)]
        meta[k + "_areas"] = len({r[0] for r in rows})
    json.dump(meta, open(os.path.join(OUT, "fhfa_meta.json"), "w"), indent=1)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
