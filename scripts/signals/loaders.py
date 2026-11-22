"""Loaders for the tables in data/signals/ (pure standard library; every function returns plain dicts keyed as documented).

Blank cells come back as None, never 0. See docs/audit/prediction-signals-2026-11-22.md for each table's meaning, years and gaps.
  from scripts.signals import loaders   (or: sys.path.insert(0, 'scripts/signals'); import loaders)
"""
import collections
import glob
import gzip
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "data", "signals")


def _rows(name):
    with gzip.open(os.path.join(DIR, name), "rt", newline="") as f:
        yield from csv.DictReader(f)


def _f(x):
    return None if x in ("", None) else float(x)


def _num_cols(r, skip):
    return {k: _f(v) for k, v in r.items() if k not in skip}


def fhfa(level, ids=None):
    """level 'tract' | 'zip5' | 'county' -> {id: {year: {'hpi': float, 'annual_change': float|None}}}"""
    out = collections.defaultdict(dict)
    for r in _rows(f"fhfa_{level}_annual.csv.gz"):
        k = r[level]
        if ids is None or k in ids:
            out[k][int(r["year"])] = {"hpi": _f(r["hpi"]), "annual_change": _f(r["annual_change"])}
    return dict(out)


def hmda(legacy=False, counties_only=True):
    """-> {(tract, year): {column: value}}. tract codes: 2010 tracts for year <= 2021, 2020 tracts for year >= 2022 (see tract_vintage)."""
    out = {}
    names = ["hmda_legacy_tract_year_50counties.csv.gz" if legacy else "hmda_tract_year_50counties.csv.gz"]
    for n in names:
        for r in _rows(n):
            d = _num_cols(r, {"tract", "tract_vintage"})
            d["tract_vintage"] = r["tract_vintage"]
            out[(r["tract"], int(r["year"]))] = d
    return out


def bps_county(monthly=False):
    """-> {(county5, year[, month]): {'u1','u2','u34','u5p' units incl. imputation, 'r1'.. reported only, 'value_total'}}"""
    out = {}
    for r in _rows("bps_county_monthly.csv.gz" if monthly else "bps_county_annual.csv.gz"):
        key = (r["state"] + r["county"], int(r["year"])) + ((int(r["month"]),) if monthly else ())
        out[key] = _num_cols(r, {"year", "month", "state", "county"})
    return out


def bps_place(monthly=False):
    """-> {(state, bps_id, year[, month]): {...}} ; place annual is national, place monthly only the 50 back-test counties."""
    out = {}
    for r in _rows("bps_place_monthly_50counties.csv.gz" if monthly else "bps_place_annual.csv.gz"):
        key = (r["state"], r["bps_id"], int(r["year"])) + ((int(r["month"]),) if monthly else ())
        d = _num_cols(r, {"year", "month", "state", "county", "bps_id", "fips_place", "name"})
        d.update({"county": r["county"], "fips_place": r["fips_place"], "name": r["name"]})
        out[key] = d
    return out


def lodes_tract(tracts=None):
    """-> {(tract20, year): {'jobs','earn_low','earn_mid','earn_high','s_goods',...}} (2020 tract codes for every year)"""
    out = {}
    for fn in sorted(glob.glob(os.path.join(DIR, "lodes_wac_tract_*.csv.gz"))):
        for r in _rows(os.path.basename(fn)):
            if tracts is None or r["tract"] in tracts:
                out[(r["tract"], int(r["year"]))] = _num_cols(r, {"tract", "year"})
    return out


def lodes_bg():
    return {(r["block_group"], int(r["year"])): _num_cols(r, {"block_group", "year"}) for r in _rows("lodes_wac_bg_50counties.csv.gz")}


def zillow(kind="zhvi", monthly=True):
    """Not committed to git (terms unconfirmed); rebuild with fetch_zillow.py. -> {zip: {'meta': {...}, 'values': {'YYYY-MM' or 'dec_YYYY': float|None}}}"""
    name = f"zillow_{kind}_zip_{'monthly_50counties' if monthly else 'annual_national'}.csv.gz"
    out = {}
    for r in _rows(name):
        out[r["zip"]] = {"meta": {k: r[k] for k in ("state", "county_name", "metro")},
                         "values": {k: _f(v) for k, v in r.items() if k not in ("zip", "state", "county_name", "metro")}}
    return out


def irs_migration():
    """-> {(county5, year_end): {...}}; year_end 2022 = IRS file pair '2122': returns filed in calendar 2021 vs 2022."""
    return {(r["county"], int(r["year_end"])): _num_cols(r, {"county", "year_end"}) for r in _rows("irs_migration_county.csv.gz")}


def acs():
    """-> {(tract10, vintage): {...}}, vintage '2010-2014' | '2015-2019'; tract codes are 2010 tracts."""
    return {(r["tract"], r["vintage"]): _num_cols(r, {"tract", "vintage"}) for r in _rows("acs_tract_50counties.csv.gz")}


def tract10_to_tract20():
    """-> {tract10: [(tract20, w10to20, w20from10)]}. w10to20 splits a 2010-tract COUNT; w20from10 averages a 2010-tract RATE/LEVEL."""
    out = collections.defaultdict(list)
    for r in _rows("xwalk_tract10_tract20.csv.gz"):
        out[r["tract10"]].append((r["tract20"], _f(r["w10to20"]), _f(r["w20from10"])))
    return dict(out)


def zcta_to_tract20():
    """-> {zcta: [(tract20, w_zcta_to_tract, w_tract_from_zcta)]}"""
    out = collections.defaultdict(list)
    for r in _rows("xwalk_zcta20_tract20.csv.gz"):
        out[r["zcta"]].append((r["tract20"], _f(r["w_zcta_to_tract"]), _f(r["w_tract_from_zcta"])))
    return dict(out)


def level_to_tract20(values_by_tract10, xwalk=None):
    """Map a 2010-tract LEVEL/RATE (e.g. median income) to 2020 tracts: area-weighted mean over the 2010 pieces (weights w20from10)."""
    xwalk = xwalk or tract10_to_tract20()
    num, den = collections.defaultdict(float), collections.defaultdict(float)
    for t10, v in values_by_tract10.items():
        if v is None:
            continue
        for t20, _w10, w20 in xwalk.get(t10, []):
            if not w20:  # blank weight: water-only tract with no land (e.g. 01003990000)
                continue
            num[t20] += v * w20
            den[t20] += w20
    return {t: num[t] / den[t] for t in num if den[t] > 0}


def count_to_tract20(counts_by_tract10, xwalk=None):
    """Map a 2010-tract COUNT to 2020 tracts by land-area share (weights w10to20); totals are preserved."""
    xwalk = xwalk or tract10_to_tract20()
    out = collections.defaultdict(float)
    for t10, v in counts_by_tract10.items():
        if v is None:
            continue
        for t20, w10, _ in xwalk.get(t10, []):
            if not w10:  # blank weight: water-only tract with no land
                continue
            out[t20] += v * w10
    return dict(out)
