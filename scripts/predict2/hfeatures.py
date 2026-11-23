"""Features and targets for the hold-out-metro test (docs/audit/prediction-2026-11-23.md, A.1-A.4). numpy only.

Every feature at origin T reads only data published by 31 Dec T (A.4): FHFA years <= T-1, BPS years <= T-1,
LODES years <= T-2, ACS vintage E <= T-1. The target reads FHFA years T and T+h and is built separately (targets()).
The guard `Asof` raises if a feature asks for a later year; tests/predict2/test_features.py plants extreme values in
every later year and checks that no feature changes.
"""
import csv
import gzip
import hashlib
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIG = os.path.join(ROOT, "data", "signals")
Y0, Y1 = 1975, 2025          # FHFA years held in the matrix
ACS_VINTAGES = (2010, 2014, 2019)
FEATURES = ["mom1", "mom5", "metro_mom1", "metro_mom5", "value_now", "value_pct_metro", "rent_to_value", "value_to_income",
            "vacancy", "permits_county", "permits_metro", "jobs_tract", "jobs_county"]
FAMILIES = {"trend": ["mom1", "mom5", "metro_mom1", "metro_mom5"],
            "level": ["value_now", "value_pct_metro", "rent_to_value", "value_to_income", "vacancy"],
            "supply": ["permits_county", "permits_metro"], "jobs": ["jobs_tract", "jobs_county"]}


class Leak(Exception):
    pass


class Asof:
    """Hands out yearly data only up to the year allowed at origin T for each source."""
    LAG = {"fhfa": 1, "bps": 1, "acs": 1, "lodes": 2}

    def __init__(self, T):
        self.T = T

    def ok(self, src, year):
        if year > self.T - self.LAG[src]:
            raise Leak(f"{src} {year} is not published by the end of {self.T}")
        return year


def _rows(path):
    with gzip.open(path, "rt", newline="") as f:
        yield from csv.DictReader(f)


def holdout_metro(cbsa):
    return int(hashlib.sha256(str(cbsa).encode()).hexdigest(), 16) % 10 in (0, 1, 2)


def cv_fold(cbsa, k=5):
    return int(hashlib.sha256((str(cbsa) + "fold").encode()).hexdigest(), 16) % k


def load(root=ROOT, acs_path=None):
    """Everything the features need, as arrays over the FHFA tracts in metropolitan counties."""
    sig = os.path.join(root, "data", "signals")
    cbsa_of, title = {}, {}
    with open(os.path.join(root, "data", "predict", "county_cbsa_2023.csv"), newline="") as f:
        for r in csv.DictReader(f):
            if r["metro_micro"].startswith("Metropolitan"):
                cbsa_of[r["county"]] = r["cbsa"]
                title[r["cbsa"]] = r["cbsa_title"]
    # FHFA tract index -> matrix tracts x years
    hp = {}
    for r in _rows(os.path.join(sig, "fhfa_tract_annual.csv.gz")):
        if r["hpi"] in ("", "."):
            continue
        hp.setdefault(r["tract"], {})[int(r["year"])] = float(r["hpi"])
    tracts = sorted(t for t in hp if t[:5] in cbsa_of)
    ix = {t: i for i, t in enumerate(tracts)}
    H = np.full((len(tracts), Y1 - Y0 + 1), np.nan)
    for t in tracts:
        for y, v in hp[t].items():
            if Y0 <= y <= Y1 and v > 0:
                H[ix[t], y - Y0] = v
    county = np.array([t[:5] for t in tracts])
    cbsa = np.array([cbsa_of[c] for c in county])
    # ACS (2010 tract codes) -> 2020 tracts: medians averaged by w20from10, counts split by w10to20
    acs = {v: {} for v in ACS_VINTAGES}
    for r in _rows(acs_path or os.path.join(root, "data", "predict2", "acs_tract_national.csv.gz")):
        acs[int(r["vintage_end"])][r["tract"]] = r
    xw = {}
    for r in _rows(os.path.join(sig, "xwalk_tract10_tract20.csv.gz")):
        if r["tract20"] in ix:
            # blank weight = a tract with no land area in the file (water only); counts as 0
            xw.setdefault(r["tract20"], []).append((r["tract10"], float(r["w10to20"] or 0), float(r["w20from10"] or 0)))
    A = {}
    county_units = {}
    for v in ACS_VINTAGES:
        d = acs[v]
        M = {k: np.full(len(tracts), np.nan) for k in ("hv", "inc", "rent", "units", "vacant")}
        for t20, parts in xw.items():
            i = ix[t20]
            for k in ("hv", "inc", "rent"):
                num = den = 0.0
                for t10, _, w in parts:
                    x = d.get(t10, {}).get(k, "")
                    if x != "" and w > 0:
                        num += w * float(x)
                        den += w
                if den >= 0.5:      # at least half the 2020 tract's land has a value
                    M[k][i] = num / den
            for k in ("units", "vacant"):
                s, have = 0.0, False
                for t10, w, _ in parts:
                    x = d.get(t10, {}).get(k, "")
                    if x != "":
                        s += w * float(x)
                        have = True
                if have:
                    M[k][i] = s
        A[v] = M
        cu = {}
        for t10, r in d.items():       # county housing units straight from the 2010-code tracts (no conversion)
            if r["units"] != "":
                cu[t10[:5]] = cu.get(t10[:5], 0.0) + float(r["units"])
        county_units[v] = cu
    # BPS county annual: units authorised (all structure sizes)
    bps = {}
    for r in _rows(os.path.join(sig, "bps_county_annual.csv.gz")):
        c = r["state"] + r["county"]
        u = sum(float(r[k] or 0) for k in ("u1", "u2", "u34", "u5p"))
        bps[(c, int(r["year"]))] = u
    # LODES tract jobs (2020 codes); state-years never published are missing, other absent rows are zero
    cov = json.load(open(os.path.join(sig, "lodes_coverage.json")))
    usps_fips = {"ak": "02", "mi": "26"}
    nf = {(usps_fips.get(s[:2], "??"), int(s[2:])) for s in cov["not_found"]}
    jobs = {}
    for part in ("01_29", "30_47", "48_72"):
        for r in _rows(os.path.join(sig, f"lodes_wac_tract_{part}.csv.gz")):
            if r["tract"] in ix:
                jobs[(r["tract"], int(r["year"]))] = float(r["jobs"])
    J = np.zeros((len(tracts), 2024 - 2010 + 1))
    for (t, y), v in jobs.items():
        J[ix[t], y - 2010] = v
    for (st, y) in nf:
        J[np.array([t[:2] == st for t in tracts]), y - 2010] = np.nan
    return {"tracts": tracts, "ix": ix, "H": H, "county": county, "cbsa": cbsa, "cbsa_title": title, "acs": A,
            "county_units": county_units, "bps": bps, "J": J, "holdout": np.array([holdout_metro(c) for c in cbsa])}


def _hp(S, g, y):
    return S["H"][:, g.ok("fhfa", y) - Y0]


def _group_median(vals, keys):
    out = np.full(len(vals), np.nan)
    order = np.argsort(keys, kind="mergesort")
    ks, vs = keys[order], vals[order]
    bounds = np.flatnonzero(np.r_[True, ks[1:] != ks[:-1], True])
    for a, b in zip(bounds[:-1], bounds[1:]):
        x = vs[a:b]
        x = x[~np.isnan(x)]
        if len(x):
            out[order[a:b]] = np.median(x)
    return out


def _group_pct(vals, keys):
    """Percentile (0..1, ties averaged) of each value within its key group; nan stays nan."""
    out = np.full(len(vals), np.nan)
    ok = ~np.isnan(vals)
    idx = np.flatnonzero(ok)
    for k in np.unique(keys[ok]):
        m = idx[keys[idx] == k]
        x = vals[m]
        o = np.argsort(x, kind="mergesort")
        r = np.empty(len(x))
        xs = x[o]
        i = 0
        while i < len(x):
            j = i
            while j + 1 < len(x) and xs[j + 1] == xs[i]:
                j += 1
            r[o[i:j + 1]] = (i + j) / 2 + 0.5
            i = j + 1
        out[m] = r / len(x)
    return out


def features_at(S, T):
    """Feature matrix (tracts x FEATURES) at origin T, plus the feature-pool mask (A.9 note 1)."""
    g = Asof(T)
    n = len(S["tracts"])
    h1, h2, h6 = _hp(S, g, T - 1), _hp(S, g, T - 2), _hp(S, g, T - 6)
    F = {}
    F["mom1"] = np.log(h1 / h2)
    F["mom5"] = np.log(h1 / h6)
    F["metro_mom1"] = _group_median(F["mom1"], S["cbsa"])
    F["metro_mom5"] = _group_median(F["mom5"], S["cbsa"])
    E = max(v for v in ACS_VINTAGES if v <= T - 1)
    g.ok("acs", E)
    a = S["acs"][E]
    hmid = _hp(S, g, E - 2)
    F["value_now"] = np.log(a["hv"] * h1 / hmid)
    F["value_pct_metro"] = _group_pct(F["value_now"], S["cbsa"])
    F["rent_to_value"] = 12 * a["rent"] / a["hv"]
    F["value_to_income"] = a["hv"] / a["inc"]
    with np.errstate(invalid="ignore", divide="ignore"):
        F["vacancy"] = np.where(a["units"] > 0, a["vacant"] / a["units"], np.nan)
    # permits: years T-2, T-1 over ACS housing units (vintage E), county and CBSA
    cu = S["county_units"][E]
    yrs = [g.ok("bps", T - 2), g.ok("bps", T - 1)]
    cnty = sorted(set(S["county"]))
    pc, cbsa_p, cbsa_u = {}, {}, {}
    cb_of = dict(zip(S["county"], S["cbsa"]))
    for c in cnty:
        p = [S["bps"].get((c, y)) for y in yrs]
        u = cu.get(c)
        if None in p or not u:
            continue
        pc[c] = sum(p) / u
        cb = cb_of[c]
        cbsa_p[cb] = cbsa_p.get(cb, 0.0) + sum(p)
        cbsa_u[cb] = cbsa_u.get(cb, 0.0) + u
    F["permits_county"] = np.array([pc.get(c, np.nan) for c in S["county"]])
    F["permits_metro"] = np.array([cbsa_p[b] / cbsa_u[b] if b in cbsa_u else np.nan for b in S["cbsa"]])
    # jobs: annualised log growth from max(2010, T-4) to T-2
    b_, a_ = g.ok("lodes", T - 2), max(2010, T - 4)
    if b_ > a_:
        jb, ja = S["J"][:, b_ - 2010], S["J"][:, a_ - 2010]
        F["jobs_tract"] = np.log((jb + 10) / (ja + 10)) / (b_ - a_)
        cj = {}
        for k, (x, y) in enumerate(zip(ja, jb)):
            c = S["county"][k]
            s = cj.setdefault(c, [0.0, 0.0, False])
            if np.isnan(x) or np.isnan(y):
                s[2] = True
            else:
                s[0] += x
                s[1] += y
        F["jobs_county"] = np.array([np.nan if cj[c][2] or cj[c][0] <= 0 else math.log(cj[c][1] / cj[c][0]) / (b_ - a_) for c in S["county"]])
    else:
        F["jobs_tract"] = np.full(n, np.nan)
        F["jobs_county"] = np.full(n, np.nan)
    X = np.column_stack([F[f] for f in FEATURES])
    X[~np.isfinite(X)] = np.nan
    pool = ~np.isnan(F["mom5"]) & ~np.isnan(F["value_now"])
    return X, pool, E


def baselines_at(S, T, h, X):
    """Baseline predictions (higher = pick first), A.5. Uses only features (as-of T) and FHFA T-1-h (<= T-1)."""
    g = Asof(T)
    col = {f: X[:, j] for j, f in enumerate(FEATURES)}
    mom_h = np.log(_hp(S, g, T - 1) / _hp(S, g, T - 1 - h))
    return {"no_change": np.zeros(len(S["tracts"])), "metro_average": col["metro_mom5"], "momentum": mom_h,
            "cheapest_in_metro": -col["value_pct_metro"], "cheapest_dollars": -col["value_now"]}


def targets(S, T, h):
    """100 x ln(HPI[T+h]/HPI[T]); reads the outcome years only here."""
    a, b = S["H"][:, T - Y0], S["H"][:, T + h - Y0]
    return 100 * np.log(b / a)
