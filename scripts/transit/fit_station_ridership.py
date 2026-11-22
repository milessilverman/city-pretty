#!/usr/bin/env python3
"""Fit and test the station ridership model described in docs/TRANSIT-DEMAND-MODEL.md (method committed first).

Reads only files on file in the repository:
  data/transit/station_boardings.csv          outcome (941 station rows, 7 systems)
  counties/bundle_<fips>.json.gz              ACS 2020-24 block-group people and homes, 2020 block-group polygons,
                                              OpenStreetMap station points (layers.stations)
  data/signals/lodes_wac_bg_50counties.csv.gz LODES8 jobs by block group (50 counties)
  data/signals/lodes_wac_tract_*.csv.gz       LODES8 jobs by tract (national), spread over block groups by area
  data/transit/ntd_agency_mode_annual.csv     NTD annual rows (annual trips per weekday count; trips per route mile; speed)
  app/data/intercity_transit_corridors.json, app/data/transit_pipelines.json   stops to predict

Writes:
  data/transit/station_ring_features.csv      the predictors of every station row (the test set; JS re-runs the test on it)
  app/data/transit_demand_model.json          coefficients, leave-one-system-out results, baselines, NTD extras
  app/data/transit_demand_stops.json          ring people / homes / jobs and flags for corridor stops and pipeline stations
  docs/TRANSIT-DEMAND-MODEL.md                the "Results" section (between the RESULTS markers)

Usage: python3 scripts/transit/fit_station_ridership.py [--cache DIR]
  --cache DIR keeps a county-bounding-box index between runs (put it outside the repository).
"""
import argparse, csv, glob, gzip, json, math, os, statistics, sys
import numpy as np
from shapely.geometry import shape, Point
import warnings
from shapely.ops import transform
warnings.filterwarnings("ignore", category=DeprecationWarning)
from shapely.strtree import STRtree

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
P = lambda *a: os.path.join(ROOT, *a)
MPD = 69.0935  # miles per degree of latitude (same constant as src/engines/corridorStopAreas.js)
LODES_YEAR = 2023
TRANSFER_MI = 0.25
NTD_YEAR = "2025"
FIT_MODES = {"HR": "heavy rail", "LR": "light rail", "CR": "commuter rail"}
MIN_GROUP = 20
FEATURES = ["ln_pop_half", "ln_jobs_half", "ln_pop_ring", "ln_jobs_ring", "terminal", "transfer"]


def local(lat0, lon0):
    kx = MPD * math.cos(math.radians(lat0))
    return lambda x, y, z=None: ((np.asarray(x) - lon0) * kx, (np.asarray(y) - lat0) * MPD)


def hav_mi(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 3958.8 * math.asin(math.sqrt(h))


# ------------------------------------------------------------------ bundles
def bundle_bboxes(cache):
    fn = os.path.join(cache, "bundle_bbox.json") if cache else None
    files = sorted(glob.glob(P("counties", "bundle_*.json.gz")))
    if fn and os.path.exists(fn):
        bb = json.load(open(fn))
        if len(bb) == len(files):
            return bb
    bb = {}
    for f in files:
        fips = os.path.basename(f)[7:12]
        try:
            d = json.load(gzip.open(f))
        except Exception:
            bb[fips] = None; continue
        xs, ys = [], []
        for ft in d.get("features") or []:
            g = ft.get("geometry") or {}
            polys = [g.get("coordinates")] if g.get("type") == "Polygon" else (g.get("coordinates") or []) if g.get("type") == "MultiPolygon" else []
            for p in polys:
                for c in (p[0] if p else []):
                    xs.append(c[0]); ys.append(c[1])
        bb[fips] = [min(xs), min(ys), max(xs), max(ys)] if xs else None
    if fn:
        os.makedirs(cache, exist_ok=True); json.dump(bb, open(fn, "w"))
    return bb


class Geo:
    def __init__(self, cache):
        self.bb = bundle_bboxes(cache)
        self.loaded = {}
        self.bgs = []      # dicts: id, geom (lon/lat), pop, homes, county
        self.osm = []      # (lat, lon, name)
        self.tree = None
        self._load_lodes()

    def _load_lodes(self):
        self.bg_jobs, self.bg_counties = {}, set()
        with gzip.open(P("data", "signals", "lodes_wac_bg_50counties.csv.gz"), "rt") as f:
            for r in csv.DictReader(f):
                self.bg_counties.add(r["block_group"][:5])
                if int(r["year"]) == LODES_YEAR:
                    self.bg_jobs[r["block_group"]] = float(r["jobs"])
        self.tract_jobs = {}
        for fn in sorted(glob.glob(P("data", "signals", "lodes_wac_tract_*.csv.gz"))):
            with gzip.open(fn, "rt") as f:
                for r in csv.DictReader(f):
                    if int(r["year"]) == LODES_YEAR:
                        self.tract_jobs[r["tract"]] = float(r["jobs"])

    def reset(self):
        self.loaded, self.bgs, self.osm, self.tree = {}, [], [], None

    def ensure(self, lat, lon, r=1.05):
        if len(self.loaded) > 40:
            self.reset()
        dlat, dlon = r / MPD, r / (MPD * math.cos(math.radians(lat)))
        new = False
        for fips, b in self.bb.items():
            if not b or fips in self.loaded:
                continue
            if b[2] < lon - dlon or b[0] > lon + dlon or b[3] < lat - dlat or b[1] > lat + dlat:
                continue
            self._load(fips); new = True
        if new or self.tree is None:
            self.tree = STRtree([g["geom"] for g in self.bgs]) if self.bgs else None

    def _load(self, fips):
        d = json.load(gzip.open(P("counties", f"bundle_{fips}.json.gz")))
        det = d.get("details") or {}
        rows = []
        for ft in d.get("features") or []:
            pid = (ft.get("properties") or {}).get("id")
            m = (det.get(pid) or {}).get("m") if pid else None
            if not m or not ft.get("geometry"):
                continue
            try:
                g = shape(ft["geometry"])
                if not g.is_valid:
                    g = g.buffer(0)
            except Exception:
                continue
            rows.append({"id": pid, "geom": g, "pop": float(m.get("pop") or 0), "homes": float(m.get("homes") or 0), "county": fips})
        # jobs: block-group LODES where the county is in the 50-county table; else tract jobs spread by polygon area
        by_tract = {}
        for x in rows:
            by_tract.setdefault(x["id"][:11], []).append(x)
        for tr, xs in by_tract.items():
            if fips in self.bg_counties:
                for x in xs:
                    x["jobs"] = self.bg_jobs.get(x["id"], 0.0); x["jobs_basis"] = "block group"
            else:
                areas = [transform(local(x["geom"].centroid.y, x["geom"].centroid.x), x["geom"]).area for x in xs]
                s = sum(areas) or 1.0
                tj = self.tract_jobs.get(tr, 0.0)
                for x, a in zip(xs, areas):
                    x["jobs"] = tj * a / s; x["jobs_basis"] = "tract spread by area"
        self.bgs.extend(rows)
        for ft in ((d.get("layers") or {}).get("stations") or {}).get("features") or []:
            c = (ft.get("geometry") or {}).get("coordinates")
            if c:
                self.osm.append((c[1], c[0], (ft.get("properties") or {}).get("n")))
        self.loaded[fips] = True

    def rings(self, lat, lon):
        self.ensure(lat, lon)
        out = {"pop_half": 0.0, "homes_half": 0.0, "jobs_half": 0.0, "pop_ring": 0.0, "homes_ring": 0.0, "jobs_ring": 0.0,
               "coverage_1mi": 0.0, "in_block_group": False, "jobs_tract_spread_share": 0.0, "counties": set()}
        if self.tree is None:
            return out
        f = local(lat, lon)
        c05, c1 = Point(0, 0).buffer(0.5, 128), Point(0, 0).buffer(1.0, 128)
        dlat, dlon = 1.02 / MPD, 1.02 / (MPD * math.cos(math.radians(lat)))
        from shapely.geometry import box
        idx = self.tree.query(box(lon - dlon, lat - dlat, lon + dlon, lat + dlat))
        pt = Point(lon, lat)
        jt = 0.0; jall = 0.0
        for i in idx:
            x = self.bgs[int(i)]
            g = transform(f, x["geom"])
            A = g.area
            if A <= 0:
                continue
            a1 = g.intersection(c1).area
            if a1 <= 0:
                continue
            a05 = g.intersection(c05).area
            if x["geom"].contains(pt):
                out["in_block_group"] = True
            out["counties"].add(x["county"])
            for k in ("pop", "homes", "jobs"):
                out[k + "_half"] += x[k] * a05 / A
                out[k + "_ring"] += x[k] * (a1 - a05) / A
            jw = x["jobs"] * a1 / A
            jall += jw
            if x["jobs_basis"] != "block group":
                jt += jw
            out["coverage_1mi"] += a1
        out["coverage_1mi"] /= c1.area
        out["jobs_tract_spread_share"] = jt / jall if jall > 0 else 0.0
        return out

    def osm_within(self, lat, lon, mi):
        return [o for o in self.osm if abs(o[0] - lat) < 0.01 and hav_mi((lat, lon), (o[0], o[1])) <= mi]


def mst_degree(points):
    """Prim's minimum spanning tree on great-circle distance; returns degree of each point."""
    n = len(points)
    if n < 2:
        return [0] * n
    inT = [False] * n; best = [math.inf] * n; par = [-1] * n; best[0] = 0; deg = [0] * n
    for _ in range(n):
        u = min((i for i in range(n) if not inT[i]), key=lambda i: best[i])
        inT[u] = True
        if par[u] >= 0:
            deg[u] += 1; deg[par[u]] += 1
        for v in range(n):
            if not inT[v]:
                d = hav_mi(points[u], points[v])
                if d < best[v]:
                    best[v] = d; par[v] = u
    return deg


# ------------------------------------------------------------------ model
def feats(r):
    return [math.log1p(r["pop_half"]), math.log1p(r["jobs_half"]), math.log1p(r["pop_ring"]), math.log1p(r["jobs_ring"]), float(r["terminal"]), float(r["transfer"])]


def fit(rows):
    systems = sorted(set(r["system"] for r in rows))
    X = np.array([[1.0 if r["system"] == s else 0.0 for s in systems] + feats(r) for r in rows])
    y = np.array([math.log(r["boardings"]) for r in rows])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    dof = max(1, len(y) - X.shape[1])
    s2 = float(resid @ resid) / dof
    try:
        cov = s2 * np.linalg.inv(X.T @ X); se = np.sqrt(np.diag(cov))
    except np.linalg.LinAlgError:
        se = np.full(X.shape[1], np.nan)
    ss_within = sum(((y[[i for i, r in enumerate(rows) if r["system"] == s]] - y[[i for i, r in enumerate(rows) if r["system"] == s]].mean()) ** 2).sum() for s in systems)
    k = len(systems)
    return {"systems": systems, "intercepts": {s: float(beta[i]) for i, s in enumerate(systems)},
            "coef": {f: float(beta[k + j]) for j, f in enumerate(FEATURES)}, "se": {f: float(se[k + j]) for j, f in enumerate(FEATURES)},
            "within_r2": 1 - float(resid @ resid) / ss_within if ss_within > 0 else None, "n": len(rows), "resid_sd": math.sqrt(s2)}


def ranks(v):
    order = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); i = 0
    while i < len(v):
        j = i
        while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
            j += 1
        for t in range(i, j + 1):
            r[order[t]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(a, b):
    if len(set(a)) < 2 or len(set(b)) < 2:
        return None
    ra, rb = ranks(a), ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den


def scaled_scores(pred, obs):
    """pred, obs > 0. Scale pred by the factor making median ln(obs/pred) zero; return MdAPE, factor, log errors."""
    lr = [math.log(o / p) for p, o in zip(pred, obs)]
    k = math.exp(statistics.median(lr))
    ape = [abs(p * k - o) / o for p, o in zip(pred, obs)]
    return statistics.median(ape), k, [math.log(o / (p * k)) for p, o in zip(pred, obs)]


def loso(rows):
    systems = sorted(set(r["system"] for r in rows))
    out, pooled = [], []
    for S in systems:
        tr = [r for r in rows if r["system"] != S]; te = [r for r in rows if r["system"] == S]
        m = fit(tr)
        abar = sum(m["intercepts"].values()) / len(m["intercepts"])
        pl = [abar + sum(m["coef"][f] * x for f, x in zip(FEATURES, feats(r))) for r in te]
        pred = [math.exp(v) for v in pl]
        obs = [r["boardings"] for r in te]
        mdape, k, le = scaled_scores(pred, obs)
        pooled.extend(le)
        b1 = scaled_scores([1.0] * len(obs), obs)
        b2p = [r["pop_half"] + r["jobs_half"] + 1.0 for r in te]
        b2 = scaled_scores(b2p, obs)
        out.append({"held_out": S, "stations": len(te), "trained_on": m["systems"],
                    "model": {"spearman": spearman(pred, obs), "mdape_after_scaling": mdape, "level_factor": k},
                    "baseline_system_average": {"spearman": None, "mdape_after_scaling": b1[0]},
                    "baseline_people_plus_jobs_half_mile": {"spearman": spearman(b2p, obs), "mdape_after_scaling": b2[0]}})
    return out, pooled


def pct(v, q):
    return float(np.percentile(np.array(v), q)) if v else None


# ------------------------------------------------------------------ NTD extras
def ntd_tables(station_rows):
    rows = list(csv.DictReader(open(P("data", "transit", "ntd_agency_mode_annual.csv"))))
    fl = lambda x: float(x) if x not in (None, "") else None
    extras = {}
    for mode in ("HR", "LR", "CR", "SR", "RB", "MB"):
        upd, spd = [], []
        for r in rows:
            if r["report_year"] != NTD_YEAR or r["mode"] != mode or r["mode_status"] != "Operating":
                continue
            upt, drm, vrm, vrh = fl(r["upt"]), fl(r["drm"]), fl(r["vrm"]), fl(r["vrh"])
            if upt and drm and upt > 0 and drm > 0:
                upd.append(upt / drm)
            if vrm and vrh and vrm > 0 and vrh > 0:
                spd.append(vrm / vrh)
        q = lambda v, unit, formula: {"n": len(v), "p25": pct(v, 25), "median": pct(v, 50), "p75": pct(v, 75), "unit": unit, "formula": formula} if v else None
        extras[mode] = {"upt_per_drm": q(upd, "annual unlinked trips per directional route mile", "unlinked passenger trips / directional route miles"),
                        "avg_speed_mph": q(spd, "miles per revenue hour", "vehicle revenue miles / vehicle revenue hours")}
    # annual NTD trips per weekday station count, per fitted system
    factors = []
    groups = {}
    for r in station_rows:
        groups.setdefault((r["system"], r["agency_ntd_id"], r["mode"]), []).append(r)
    for (sysn, nid, mode), rs in sorted(groups.items()):
        if mode not in FIT_MODES:
            continue
        yrs = {r["year"] for r in rs}; basis = {r["day_basis"] for r in rs}
        yr = next(iter(yrs)) if len(yrs) == 1 else None
        entry = {"system": sysn, "ntd_id": nid, "mode": mode, "station_year": yr, "day_basis": "/".join(sorted(basis)), "stations": len(rs)}
        if basis != {"weekday"} or not yr or not yr.isdigit() or int(yr) < 2020:
            entry["factor"] = None; entry["why"] = "station counts are not weekday counts of 2020 or later, so no NTD year matches"
            factors.append(entry); continue
        ny = str(min(int(yr), 2025))
        upt = sum(fl(r["upt"]) or 0 for r in rows if r["ntd_id"] == nid and r["mode"] == mode and r["report_year"] == ny and r["mode_status"] == "Operating")
        tot = sum(r["boardings"] for r in rs)
        entry.update({"ntd_report_year": ny, "ntd_upt": upt, "station_weekday_sum": round(tot, 1), "factor": upt / tot if upt and tot else None})
        factors.append(entry)
    return extras, factors


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--cache", default=None); a = ap.parse_args()
    geo = Geo(a.cache)
    st = list(csv.DictReader(open(P("data", "transit", "station_boardings.csv"))))
    pts = [r for r in st if r["lat"] and r["lon"]]
    # transfer: another station row within 0.25 mi, or two or more OSM station points within 0.25 mi
    feats_rows = []
    by_group = {}
    for r in pts:
        by_group.setdefault((r["system"], r["mode"]), []).append(r)
    term = {}
    for k, rs in by_group.items():
        deg = mst_degree([(float(x["lat"]), float(x["lon"])) for x in rs])
        for x, dg in zip(rs, deg):
            term[(x["system"], x["station_id"], x["mode"])] = 1 if dg == 1 else 0
    for i, r in enumerate(pts):
        lat, lon = float(r["lat"]), float(r["lon"])
        g = geo.rings(lat, lon)
        others = [o for o in pts if o is not r and not (o["system"] == r["system"] and o["station_id"] == r["station_id"] and o["mode"] == r["mode"])
                  and abs(float(o["lat"]) - lat) < 0.01 and hav_mi((lat, lon), (float(o["lat"]), float(o["lon"]))) <= TRANSFER_MI]
        osm = geo.osm_within(lat, lon, TRANSFER_MI)
        feats_rows.append({
            "system": r["system"], "agency_ntd_id": r["agency_ntd_id"], "mode": r["mode"], "station_id": r["station_id"], "station_name": r["station_name"],
            "lat": lat, "lon": lon, "boardings": float(r["avg_boardings_per_day"]), "day_basis": r["day_basis"], "year": r["year"],
            "pop_half": g["pop_half"], "homes_half": g["homes_half"], "jobs_half": g["jobs_half"], "pop_ring": g["pop_ring"], "homes_ring": g["homes_ring"], "jobs_ring": g["jobs_ring"],
            "terminal": term[(r["system"], r["station_id"], r["mode"])], "transfer": 1 if (others or len(osm) >= 2) else 0,
            "coverage_1mi": g["coverage_1mi"], "in_block_group": int(g["in_block_group"]), "jobs_tract_spread_share": g["jobs_tract_spread_share"], "counties": ";".join(sorted(g["counties"]))})
        if i % 100 == 0:
            print(f"  features {i}/{len(pts)}", file=sys.stderr)
    cols = list(feats_rows[0].keys())
    with open(P("data", "transit", "station_ring_features.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
        for x in feats_rows:
            w.writerow({k: (round(v, 3) if isinstance(v, float) else v) for k, v in x.items()})
    # re-read the rounded file so the JS test and this fit use identical numbers
    fr = []
    for x in csv.DictReader(open(P("data", "transit", "station_ring_features.csv"))):
        for k in ("lat", "lon", "boardings", "pop_half", "homes_half", "jobs_half", "pop_ring", "homes_ring", "jobs_ring", "coverage_1mi", "jobs_tract_spread_share"):
            x[k] = float(x[k])
        for k in ("terminal", "transfer", "in_block_group"):
            x[k] = int(x[k])
        fr.append(x)
    usable = lambda x: x["in_block_group"] == 1 and x["boardings"] > 0
    model = {"meta": {
        "generated_by": "scripts/transit/fit_station_ridership.py", "method": "docs/TRANSIT-DEMAND-MODEL.md (committed before the fit)",
        "features": FEATURES, "form": "ln(weekday or daily station count) = system intercept + sum(coef x feature)",
        "feature_definitions": {
            "ln_pop_half": "ln(1 + people within 0.5 mi), ACS 2020-2024 block groups apportioned by polygon area",
            "ln_jobs_half": f"ln(1 + jobs within 0.5 mi), LODES8 WAC {LODES_YEAR} all jobs (block group where on file, else tract spread over its block groups by area)",
            "ln_pop_ring": "ln(1 + people 0.5 to 1 mi)", "ln_jobs_ring": "ln(1 + jobs 0.5 to 1 mi)",
            "terminal": "1 if degree 1 in the minimum spanning tree of the line's or system's stops", "transfer": f"1 if another rail station is within {TRANSFER_MI} mi"},
        "lodes_year": LODES_YEAR, "acs": "2020-2024 ACS 5-year (county bundles)", "test": "leave one system out, within mode; single system-level scaling factor (median log ratio = 0)",
        "sources": {"stations": "data/transit/station_boardings.csv (see data/transit/station_boardings_sources.json)",
                    "lodes": "https://lehd.ces.census.gov/data/lodes/LODES8/", "ntd": "https://data.transportation.gov/d/npsm-38gk"},
        "not_obtained": [
            "Published direct-ridership-model coefficients: TCRP Report 153 PDF (onlinepubs.trb.org returned an empty reply; the web.archive.org copy reset the connection; nap.edu requires a guest sign-in to download), FTA STOPS documentation (transit.dot.gov refuses this machine). None were typed from memory, so none are tested.",
            "Station-level rail service (trains per hour): no rail frequency table on file; system-level service is absorbed by the system intercept.",
            "Station boardings for bus rapid transit, streetcar and bus: none on file, so those modes get riders only from NTD trips per route mile."]},
        "modes": {}}
    dropped = {"no_coordinates": len(st) - len(pts), "outside_block_groups_on_file": sum(1 for x in fr if not x["in_block_group"]), "zero_count": sum(1 for x in fr if x["boardings"] <= 0)}
    model["meta"]["dropped"] = dropped
    for mode, label in FIT_MODES.items():
        rows = [x for x in fr if x["mode"] == mode and usable(x)]
        sys_n = {}
        for x in rows:
            sys_n[x["system"]] = sys_n.get(x["system"], 0) + 1
        rows = [x for x in rows if sys_n[x["system"]] >= 2]
        if len(rows) < MIN_GROUP:
            continue
        for x in rows:
            x["boardings"] = float(x["boardings"])
        full = fit(rows)
        res, pooled = loso(rows) if len(full["systems"]) >= 2 else ([], [])
        mdn = lambda key, sub: statistics.median([r[key][sub] for r in res if r[key][sub] is not None]) if res and any(r[key][sub] is not None for r in res) else None
        model["modes"][mode] = {
            "label": label, "stations": len(rows), "systems": full["systems"], "stations_by_system": sys_n,
            "coef": full["coef"], "se": full["se"], "intercepts": full["intercepts"], "within_r2_in_sample": full["within_r2"], "resid_sd_in_sample": full["resid_sd"],
            "loso": res,
            "loso_summary": {"systems_tested": len(res),
                             "median_spearman": {"model": mdn("model", "spearman"), "baseline_people_plus_jobs_half_mile": mdn("baseline_people_plus_jobs_half_mile", "spearman")},
                             "median_mdape_after_scaling": {"model": mdn("model", "mdape_after_scaling"), "baseline_system_average": mdn("baseline_system_average", "mdape_after_scaling"), "baseline_people_plus_jobs_half_mile": mdn("baseline_people_plus_jobs_half_mile", "mdape_after_scaling")},
                             "level_factor_range": [min(r["model"]["level_factor"] for r in res), max(r["model"]["level_factor"] for r in res)] if res else None,
                             "log_error_after_scaling_p10_p90": [pct(pooled, 10), pct(pooled, 90)] if pooled else None,
                             "log_error_after_scaling_p25_p75": [pct(pooled, 25), pct(pooled, 75)] if pooled else None},
            "beats_people_plus_jobs_baseline": None, "beats_system_average_error": None}
        s = model["modes"][mode]["loso_summary"]
        if res:
            model["modes"][mode]["beats_system_average_error"] = bool(s["median_mdape_after_scaling"]["model"] < s["median_mdape_after_scaling"]["baseline_system_average"])
            model["modes"][mode]["beats_people_plus_jobs_baseline"] = bool((s["median_spearman"]["model"] or -1) > (s["median_spearman"]["baseline_people_plus_jobs_half_mile"] or -1) and s["median_mdape_after_scaling"]["model"] < s["median_mdape_after_scaling"]["baseline_people_plus_jobs_half_mile"])
    extras, factors = ntd_tables(fr)
    model["ntd_extras"] = {"report_year": NTD_YEAR, "row_rule": "mode status Operating, both inputs above zero, agency x mode x type-of-service rows, quartiles by linear interpolation (as scripts/transit/build_operating_benchmarks.py)", "by_mode": extras, "source_url": "https://data.transportation.gov/d/npsm-38gk"}
    model["annual_trips_per_weekday_count"] = {"definition": "NTD annual unlinked passenger trips of the agency and mode / sum of the station weekday counts on file for that system and mode. Puts station counts on NTD's trip basis (it includes transfers inside the system and weekend days).", "rows": factors}
    json.dump(model, open(P("app", "data", "transit_demand_model.json"), "w"), indent=1)
    write_stops(geo)
    write_results(model)
    print(json.dumps({m: v["loso_summary"] for m, v in model["modes"].items()}, indent=1))


def write_stops(geo):
    out = {"meta": {"generated_by": "scripts/transit/fit_station_ridership.py", "note": "Ring people, homes and jobs around each stop point. Corridor stop points are Census place internal points and pipeline station points are marked unverified illustrative locations in transit_pipelines.json: station sites are not chosen in the documents, so these figures only rank stops against each other.", "lodes_year": LODES_YEAR, "transfer_miles": TRANSFER_MI}, "corridors": {}, "pipelines": {}}
    def one(lat, lon, fips):
        if not any(f == fips for f in geo.bb) or geo.bb.get(fips) is None:
            return {"on_file": False, "why": f"county {fips} has no county bundle on file"}
        g = geo.rings(lat, lon)
        if not g["in_block_group"]:
            return {"on_file": False, "why": "the point is not inside a block group on file"}
        osm = geo.osm_within(lat, lon, TRANSFER_MI)
        return {"on_file": True, "pop_half": round(g["pop_half"]), "homes_half": round(g["homes_half"]), "jobs_half": round(g["jobs_half"]),
                "pop_ring": round(g["pop_ring"]), "homes_ring": round(g["homes_ring"]), "jobs_ring": round(g["jobs_ring"]),
                "transfer": 1 if osm else 0, "transfer_with": [o[2] for o in osm][:4], "coverage_1mi": round(g["coverage_1mi"], 3), "jobs_tract_spread_share": round(g["jobs_tract_spread_share"], 3)}
    for c in json.load(open(P("app", "data", "intercity_transit_corridors.json"))):
        ss = [s for s in c.get("proposed_stations") or [] if s.get("lat") is not None and s.get("lng") is not None]
        if not ss:
            continue
        deg = mst_degree([(s["lat"], s["lng"]) for s in ss])
        out["corridors"][c["id"]] = {"corridor_type": c.get("corridor_type"), "stops": [dict(id=s["id"], name=s.get("name"), fips=s.get("fips"), lat=s["lat"], lng=s["lng"], terminal=1 if (dg == 1 or len(ss) == 1) else 0, point_basis="Census place internal point (a city point, not a station site)", **one(s["lat"], s["lng"], s.get("fips"))) for s, dg in zip(ss, deg)]}
    for p in json.load(open(P("app", "data", "transit_pipelines.json"))):
        ss = [s for s in p.get("stations") or [] if s.get("lat") is not None]
        deg = mst_degree([(s["lat"], s["lng"]) for s in ss])
        out["pipelines"][p["title"]] = {"fips": p["fips"], "stops": [dict(name=s["name"], fips=p["fips"], lat=s["lat"], lng=s["lng"], terminal=1 if dg == 1 else 0, point_basis="station point in transit_pipelines.json, marked there as an unverified illustrative location" if not s.get("verified") else "station point in transit_pipelines.json", **one(s["lat"], s["lng"], p["fips"])) for s, dg in zip(ss, deg)]}
    json.dump(out, open(P("app", "data", "transit_demand_stops.json"), "w"), indent=1)


def write_results(model):
    fn = P("docs", "TRANSIT-DEMAND-MODEL.md")
    t = open(fn).read()
    L = ["<!-- RESULTS:BEGIN (written by scripts/transit/fit_station_ridership.py; do not edit by hand) -->", ""]
    pc = lambda v: "none" if v is None else f"{v * 100:.0f}%"
    sp = lambda v: "none" if v is None else f"{v:.2f}"
    L.append(f"Dropped station rows: {model['meta']['dropped']}.")
    L.append("")
    for mode, m in model["modes"].items():
        s = m["loso_summary"]
        L.append(f"### {m['label']} ({mode}): {m['stations']} stations in {len(m['systems'])} systems")
        L.append("")
        L.append("| Held-out system | Stations | Model rank corr. | Model error* | People+jobs rank corr. | People+jobs error* | System-average error* | Level factor |")
        L.append("|---|---|---|---|---|---|---|---|")
        for r in m["loso"]:
            L.append(f"| {r['held_out']} | {r['stations']} | {sp(r['model']['spearman'])} | {pc(r['model']['mdape_after_scaling'])} | {sp(r['baseline_people_plus_jobs_half_mile']['spearman'])} | {pc(r['baseline_people_plus_jobs_half_mile']['mdape_after_scaling'])} | {pc(r['baseline_system_average']['mdape_after_scaling'])} | {r['model']['level_factor']:.2f} |")
        L.append("")
        if s["systems_tested"]:
            L.append(f"Median over held-out systems: model rank correlation {sp(s['median_spearman']['model'])}, error {pc(s['median_mdape_after_scaling']['model'])}; people+jobs baseline {sp(s['median_spearman']['baseline_people_plus_jobs_half_mile'])}, {pc(s['median_mdape_after_scaling']['baseline_people_plus_jobs_half_mile'])}; system average error {pc(s['median_mdape_after_scaling']['baseline_system_average'])}. Beats the people+jobs baseline on both: {m['beats_people_plus_jobs_baseline']}. Lower error than the system average: {m['beats_system_average_error']}. Level factors (training systems' average level vs the held-out system's own) ranged {s['level_factor_range'][0]:.2f} to {s['level_factor_range'][1]:.2f}.")
        L.append("")
        L.append("Coefficients (all systems of the mode): " + "; ".join(f"{k} {v:+.3f} (s.e. {m['se'][k]:.3f})" for k, v in m["coef"].items()) + f". Within-system R2 in sample {m['within_r2_in_sample']:.2f}.")
        L.append("")
    L.append("\\* median absolute percentage error after one system-level scaling factor.")
    L.append("")
    L.append("**What this can say for a new line:** the order of its stops, and the level only as a bracket: the range of the fitted systems' own levels, which is the spread of the level factors above. It cannot say which end of that bracket a new system will land on.")
    L.append("")
    L.append("Annual NTD trips per weekday station count (used to annualise): " + "; ".join(f"{r['system']} {r['mode']}: {('%.0f' % r['factor']) if r.get('factor') else 'none (' + r.get('why', 'no NTD match') + ')'}" for r in model["annual_trips_per_weekday_count"]["rows"]) + ".")
    L.append("")
    L.append("<!-- RESULTS:END -->")
    block = "\n".join(L)
    if "<!-- RESULTS:BEGIN" in t:
        t = t[:t.index("<!-- RESULTS:BEGIN")] + block + t[t.index("<!-- RESULTS:END -->") + len("<!-- RESULTS:END -->"):]
    else:
        t = t.replace("(Written by the fitting script after this method was committed.)", block)
    open(fn, "w").write(t)


if __name__ == "__main__":
    main()
