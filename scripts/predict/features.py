"""Build the pre-registered features (docs/PREDICTION-MODEL.md A.5) and targets (A.2) on 2020 tracts.

load_store()            -> store {source: {data_year: {key: value}}} plus static geography (store["_geo"])
features_at(store, T)   -> {tract20: {feature: value or None}} for every sample tract, reading only through asof.Guard
targets(store, T, h)    -> {tract20: {"y": county-relative, "y_metro": CBSA-relative}} (outcome, not a feature)
"""
import collections
import csv
import gzip
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "scripts", "signals"))
sys.path.insert(0, HERE)
import loaders  # noqa: E402
from asof import Guard  # noqa: E402

PRED = os.path.join(ROOT, "data", "predict")

FEATURES = ["value_acs", "loan_level", "trend_1y", "trend_3y", "trend_5y", "app_growth", "loan_growth", "nonowner_share",
            "nonowner_change", "denial_rate", "buyer_income_ratio", "permits_place", "jobs_tract", "jobs_5km", "rent_to_value", "vacancy"]
COUNTY_FEATURES = ["permits_county", "net_migration", "county_trend_vs_metro"]
PRICE_LEVEL = ["value_acs", "loan_level", "rent_to_value"]

# as-of rule of each feature, in words (copied into the output file)
ASOF_RULE = {
    "value_acs": "ACS 5-year median home value, latest vintage ending E with E+1 <= T",
    "loan_level": "HMDA home-purchase median loan amount, year T-1",
    "trend_1y": "FHFA tract index, years T-2 to T-1", "trend_3y": "FHFA tract index, years T-4 to T-1", "trend_5y": "FHFA tract index, years T-6 to T-1",
    "app_growth": "HMDA home-purchase applications, year T-2 to T-1", "loan_growth": "HMDA median loan amount, year T-2 to T-1",
    "nonowner_share": "HMDA originations not owner-occupied, year T-1", "nonowner_change": "the same, T-2 to T-1",
    "denial_rate": "HMDA home-purchase denial rate, year T-1", "buyer_income_ratio": "HMDA median applicant income T-1 / ACS median household income (vintage as value_acs)",
    "permits_place": "BPS annual units authorised, years T-3..T-1, in the tract's permit jurisdiction / ACS homes there (vintage as value_acs)",
    "jobs_tract": "LODES jobs in the tract, years T-4 to T-2", "jobs_5km": "LODES jobs within 5 km, years T-4 to T-2",
    "rent_to_value": "12 x ACS median rent / ACS median value (vintage as value_acs)", "vacancy": "ACS vacant / housing units (vintage as value_acs)",
    "permits_county": "BPS annual county units authorised T-3..T-1 / ACS homes in the sample tracts of the county",
    "net_migration": "IRS county returns, (in - out) / non-migrant returns, year_end T-2",
    "county_trend_vs_metro": "FHFA county index T-6 to T-1 minus the median of the CBSA's counties",
}
LABEL = {
    "value_acs": "home value (Census)", "loan_level": "size of this year's purchase loans", "trend_1y": "last year's price change",
    "trend_3y": "3-year price change", "trend_5y": "5-year price change", "app_growth": "growth in mortgage applications",
    "loan_growth": "growth in loan sizes", "nonowner_share": "share of purchases by investors and second-home buyers",
    "nonowner_change": "change in investor and second-home buying", "denial_rate": "mortgage denial rate",
    "buyer_income_ratio": "buyers' income compared with residents' income", "permits_place": "building permits in its city or town per existing home",
    "jobs_tract": "job growth in the tract", "jobs_5km": "job growth within 5 km", "rent_to_value": "rent compared with home value",
    "vacancy": "vacant homes share",
}


def _rows(path):
    with gzip.open(path, "rt", newline="") as f:
        yield from csv.DictReader(f)


def _ln(a, b):
    return math.log(a / b) if a is not None and b is not None and a > 0 and b > 0 else None


def load_store(counties=None, with_zillow=False):
    counties = set(counties or loaders_counties())
    geo = {}
    cent = {r["tract"]: (float(r["lat"]), float(r["lon"])) for r in _rows(os.path.join(PRED, "tract_centroids_2020.csv.gz"))}
    cbsa = {}
    with open(os.path.join(PRED, "county_cbsa_2023.csv")) as f:
        for r in csv.DictReader(f):
            cbsa[r["county"]] = r["cbsa"]
    juris = {r["tract"]: (r["state"], r["bps_id"]) for r in _rows(os.path.join(PRED, "tract_jurisdiction_50counties.csv.gz")) if r["bps_id"]}
    xw = loaders.tract10_to_tract20()
    sample = sorted(t for t in cent if t[:5] in counties)
    stable = set()
    for t10, lst in xw.items():
        for t20, w10, w20 in lst:
            if t10 == t20 and w10 is not None and w20 is not None and w10 >= 0.95 and w20 >= 0.95:
                stable.add(t20)
    geo.update(sample=sample, cbsa=cbsa, juris=juris, stable=stable, counties=sorted(counties))
    store = {"_geo": geo}

    # FHFA tract (national, for county and CBSA medians of the outcome) and county
    fh = collections.defaultdict(dict)
    for r in _rows(os.path.join(ROOT, "data", "signals", "fhfa_tract_annual.csv.gz")):
        if r["hpi"] not in ("", None):
            fh[int(r["year"])][r["tract"]] = float(r["hpi"])
    store["fhfa"] = dict(fh)
    fc = collections.defaultdict(dict)
    for r in _rows(os.path.join(ROOT, "data", "signals", "fhfa_county_annual.csv.gz")):
        if r["hpi"] not in ("", None):
            fc[int(r["year"])][r["county"]] = float(r["hpi"])
    store["fhfa_county"] = dict(fc)

    # HMDA -> 2020 tracts
    def nonowner(d):
        if d.get("orig_nonowner") is not None:
            return d["orig_nonowner"]
        if d.get("orig_second_home") is not None or d.get("orig_investor") is not None:
            return (d.get("orig_second_home") or 0) + (d.get("orig_investor") or 0)
        return None
    COUNTS = ["apps", "orig", "denied", "approved_not_accepted", "nonowner"]
    LEVELS = ["median_loan", "median_income_k"]
    hm = {}
    for legacy in (True, False):
        for (tract, year), d in loaders.hmda(legacy=legacy).items():
            d = dict(d)
            d["nonowner"] = nonowner(d)
            hm.setdefault(year, []).append((tract, d))
    store["hmda"] = {}
    for year, lst in hm.items():
        out = {}
        if all(d["tract_vintage"] == "2020" for _, d in lst):
            for t, d in lst:
                out[t] = {k: d.get(k) for k in COUNTS + LEVELS}
        else:
            cnt = {k: collections.defaultdict(float) for k in COUNTS}
            lev_n = {k: collections.defaultdict(float) for k in LEVELS}
            lev_d = {k: collections.defaultdict(float) for k in LEVELS}
            for t10, d in lst:
                for t20, w10, w20 in xw.get(t10, []):
                    w10, w20 = w10 or 0.0, w20 or 0.0
                    for k in COUNTS:
                        if d.get(k) is not None:
                            cnt[k][t20] += d[k] * w10
                    for k in LEVELS:
                        if d.get(k) is not None:
                            lev_n[k][t20] += d[k] * w20
                            lev_d[k][t20] += w20
            keys = set().union(*[set(cnt[k]) for k in COUNTS])
            for t in keys:
                out[t] = {k: cnt[k].get(t) for k in COUNTS}
                for k in LEVELS:
                    out[t][k] = lev_n[k][t] / lev_d[k][t] if lev_d[k].get(t) else None
        store["hmda"][year] = out

    # ACS -> 2020 tracts, keyed by end year
    acs_raw = loaders.acs()
    store["acs"] = {}
    for vint, E in (("2010-2014", 2014), ("2015-2019", 2019)):
        lv = {k: {} for k in ("hv", "rent", "inc")}
        ct = {k: {} for k in ("units", "vacant")}
        for (t10, v), d in acs_raw.items():
            if v != vint:
                continue
            for k in lv:
                lv[k][t10] = d.get(k) if (d.get(k) or 0) > 0 else None
            for k in ct:
                ct[k][t10] = d.get(k)
        L = {k: loaders.level_to_tract20(lv[k], xw) for k in lv}
        C = {k: loaders.count_to_tract20(ct[k], xw) for k in ct}
        out = {}
        for t in set(L["hv"]) | set(C["units"]):
            out[t] = {"hv": L["hv"].get(t), "rent": L["rent"].get(t), "inc": L["inc"].get(t), "units": C["units"].get(t), "vacant": C["vacant"].get(t)}
        store["acs"][E] = out

    # LODES jobs (tracts in the sample states) and jobs within 5 km
    lo = loaders.lodes_tract(set(cent))
    jobs = collections.defaultdict(dict)
    for (t, y), d in lo.items():
        jobs[y][t] = d.get("jobs") or 0.0
    store["lodes"] = dict(jobs)
    ids = sorted(cent)
    lat = np.radians(np.array([cent[t][0] for t in ids]))
    lon = np.radians(np.array([cent[t][1] for t in ids]))
    idx = {t: i for i, t in enumerate(ids)}
    neigh = {}
    for t in sample:
        i = idx[t]
        near = np.where((np.abs(lat - lat[i]) < 0.0012) & (np.abs(lon - lon[i]) < 0.0012 / max(0.2, math.cos(lat[i]))))[0]
        dl, dn = lat[near] - lat[i], lon[near] - lon[i]
        a = np.sin(dl / 2) ** 2 + np.cos(lat[i]) * np.cos(lat[near]) * np.sin(dn / 2) ** 2
        km = 2 * 6371.0 * np.arcsin(np.sqrt(a))
        neigh[t] = [ids[j] for j in near[km <= 5.0]]
    geo["neigh5km"] = neigh
    # a state-year missing from LODES (lodes_coverage.json) must stay missing, not zero
    import json
    with open(os.path.join(ROOT, "data", "signals", "lodes_coverage.json")) as fh_:
        cov = json.load(fh_)
    STATE_ABBR = {"26": "mi", "02": "ak"}
    missing_sy = {(fips, int(x[2:])) for x in cov["not_found"] for fips, ab in STATE_ABBR.items() if x.startswith(ab)}
    geo["lodes_missing"] = missing_sy
    store["lodes5km"] = {y: {t: sum(jobs[y].get(n, 0.0) for n in neigh[t]) for t in sample} for y in jobs}

    # BPS annual: place (state, bps_id) and county totals
    bp = collections.defaultdict(dict)
    for r in _rows(os.path.join(ROOT, "data", "signals", "bps_place_annual.csv.gz")):
        if r["state"] + r["county"] in counties:
            u = sum(float(r[k] or 0) for k in ("u1", "u2", "u34", "u5p"))
            key = (r["state"], r["bps_id"])
            bp[int(r["year"])][key] = bp[int(r["year"])].get(key, 0.0) + u
    store["bps_place"] = dict(bp)
    bc = collections.defaultdict(dict)
    for (c, y), d in loaders.bps_county().items():
        bc[y][c] = sum(d.get(k) or 0 for k in ("u1", "u2", "u34", "u5p"))
    store["bps_county"] = dict(bc)

    irs = collections.defaultdict(dict)
    for (c, y), d in loaders.irs_migration().items():
        irs[y][c] = d
    store["irs"] = dict(irs)

    if with_zillow:
        z = loaders.zillow("zhvi", monthly=True)
        zt = loaders.zcta_to_tract20()
        out = collections.defaultdict(dict)
        for y in range(2012, 2027):
            num, den = collections.defaultdict(float), collections.defaultdict(float)
            for zp, rec in z.items():
                v1, v0 = rec["values"].get(f"{y}-11"), rec["values"].get(f"{y - 1}-11")
                g = _ln(v1, v0)
                if g is None:
                    continue
                for t20, _wz, wt in zt.get(zp, []):
                    if wt:
                        num[t20] += g * wt
                        den[t20] += wt
            out[y] = {t: num[t] / den[t] for t in num if den[t] > 0}
        store["zillow"] = dict(out)
    return store


def loaders_counties():
    import json
    return json.load(open(os.path.join(ROOT, "app", "data", "neighborhood_score_backtest.json")))["sample"]["county_list"]


def features_at(store, T, tracts=None, guard=None):
    """{tract: {feature: value|None}} for origin T. Reads data only through the as-of guard."""
    g = guard or Guard(store, T)
    geo = store["_geo"]
    tracts = tracts or geo["sample"]
    E = g.latest("acs")
    acs = g.get("acs", E) if E is not None else {}
    fh1, fh2, fh4, fh6 = (g.get("fhfa", T - k) for k in (1, 2, 4, 6))
    hm1, hm2 = g.get("hmda", T - 1), g.get("hmda", T - 2)
    lo2, lo4 = g.get("lodes", T - 2), g.get("lodes", T - 4)
    l52, l54 = g.get("lodes5km", T - 2), g.get("lodes5km", T - 4)
    bps = [g.get("bps_place", T - k) for k in (1, 2, 3)]
    zil = g.get("zillow", T) if "zillow" in store else None

    # homes per permit jurisdiction (ACS vintage at T), over the sample tracts assigned to it
    homes_j = collections.defaultdict(float)
    for t in geo["sample"]:
        j = geo["juris"].get(t)
        u = (acs.get(t) or {}).get("units")
        if j and u:
            homes_j[j] += u

    out = {}
    for t in tracts:
        a = acs.get(t) or {}
        h1, h2 = hm1.get(t) or {}, hm2.get(t) or {}
        f = {}
        f["value_acs"] = math.log(a["hv"]) if a.get("hv") else None
        f["loan_level"] = math.log(h1["median_loan"]) if h1.get("median_loan") else None
        f["trend_1y"] = _ln(fh1.get(t), fh2.get(t))
        f["trend_3y"] = _ln(fh1.get(t), fh4.get(t))
        f["trend_5y"] = _ln(fh1.get(t), fh6.get(t))
        f["app_growth"] = math.log((h1["apps"] + 5) / (h2["apps"] + 5)) if h1.get("apps") is not None and h2.get("apps") is not None else None
        f["loan_growth"] = _ln(h1.get("median_loan"), h2.get("median_loan"))
        s1 = h1["nonowner"] / h1["orig"] if h1.get("orig") and h1.get("nonowner") is not None else None
        s2 = h2["nonowner"] / h2["orig"] if h2.get("orig") and h2.get("nonowner") is not None else None
        f["nonowner_share"] = s1
        f["nonowner_change"] = s1 - s2 if s1 is not None and s2 is not None else None
        den = sum(h1.get(k) or 0 for k in ("orig", "approved_not_accepted", "denied"))
        f["denial_rate"] = (h1.get("denied") or 0) / den if den > 0 and h1.get("denied") is not None else None
        f["buyer_income_ratio"] = h1["median_income_k"] * 1000 / a["inc"] if h1.get("median_income_k") and a.get("inc") else None
        j = geo["juris"].get(t)
        f["permits_place"] = (sum(b.get(j, 0.0) for b in bps) / homes_j[j]) if j and homes_j.get(j) and all(j in b for b in bps) else None
        st = t[:2]
        lodes_ok = (st, T - 2) not in geo["lodes_missing"] and (st, T - 4) not in geo["lodes_missing"] and lo2 and lo4
        f["jobs_tract"] = math.log((lo2.get(t, 0.0) + 10) / (lo4.get(t, 0.0) + 10)) if lodes_ok else None
        f["jobs_5km"] = math.log((l52.get(t, 0.0) + 10) / (l54.get(t, 0.0) + 10)) if lodes_ok and t in l52 else None
        f["rent_to_value"] = 12 * a["rent"] / a["hv"] if a.get("rent") and a.get("hv") else None
        f["vacancy"] = a["vacant"] / a["units"] if a.get("units") and a.get("vacant") is not None else None
        if zil is not None:
            f["zillow_1y"] = zil.get(t)
        out[t] = f

    # county-level (metro-relative variant)
    bc = [g.get("bps_county", T - k) for k in (1, 2, 3)]
    fc1, fc6 = g.get("fhfa_county", T - 1), g.get("fhfa_county", T - 6)
    irs = g.get("irs", T - 2)
    homes_c = collections.defaultdict(float)
    for t in geo["sample"]:
        u = (acs.get(t) or {}).get("units")
        if u:
            homes_c[t[:5]] += u
    ctrend = {c: _ln(fc1.get(c), fc6.get(c)) for c in fc1}
    by_cbsa = collections.defaultdict(list)
    for c, v in ctrend.items():
        if v is not None and geo["cbsa"].get(c):
            by_cbsa[geo["cbsa"][c]].append(v)
    for t in tracts:
        c = t[:5]
        f = out[t]
        f["permits_county"] = sum(b.get(c, 0.0) for b in bc) / homes_c[c] if homes_c.get(c) and all(c in b for b in bc) else None
        r = irs.get(c)
        f["net_migration"] = (r["in_returns"] - r["out_returns"]) / r["nonmig_returns"] if r and r.get("nonmig_returns") and r.get("in_returns") is not None and r.get("out_returns") is not None else None
        cb = geo["cbsa"].get(c)
        f["county_trend_vs_metro"] = ctrend[c] - float(np.median(by_cbsa[cb])) if ctrend.get(c) is not None and cb and by_cbsa.get(cb) else None
    return out


def targets(store, T, h):
    """County- and CBSA-relative ln change T -> T+h for sample tracts with both values. Not a feature: reads the outcome years."""
    geo = store["_geo"]
    a, b = store["fhfa"].get(T, {}), store["fhfa"].get(T + h, {})
    raw = {t: math.log(b[t] / a[t]) for t in a if t in b and a[t] > 0 and b[t] > 0}
    by_c, by_m = collections.defaultdict(list), collections.defaultdict(list)
    for t, v in raw.items():
        by_c[t[:5]].append(v)
        m = geo["cbsa"].get(t[:5])
        if m:
            by_m[m].append(v)
    med_c = {c: float(np.median(v)) for c, v in by_c.items()}
    med_m = {m: float(np.median(v)) for m, v in by_m.items()}
    out = {}
    for t in geo["sample"]:
        if t in raw:
            m = geo["cbsa"].get(t[:5])
            out[t] = {"y": raw[t] - med_c[t[:5]], "y_metro": raw[t] - med_m[m] if m else None, "raw": raw[t]}
    return out
