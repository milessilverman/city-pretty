#!/usr/bin/env python3
"""Recompute the crash-based neighbourhood comparisons and crash-dependent improvement rows from the rebuilt counts.

Why: the county data files computed "worse than X% of similar areas" for pedestrian/cyclist crashes, and decided which
street-safety improvements a block group qualifies for, from crash counts that gave each boundary-street crash to one
side (pipeline/metrics_oc.py used strict `within`; LA's build counted every crash as a pedestrian/bike crash). The
rebuilt counts (app/data/crash_counts/<fips>.json, boundary rule: inside or within 10 m) change both.

Method (pipeline/build_oc.py main(), with one deliberate change to the peer pool):
  * peers: the 50 most similar block groups by standardized [income, homes per acre, home value, year built,
    households without a car, single-family share]. The pipeline drew them from LA County plus the county. Crash
    counts are only comparable within one source, definition and window, so here: California counties use LA County
    plus the county (all CHP CCRS 2023-2025, same definition); other counties use the county only (one state source);
    LA uses LA only.
  * metric: the 3-year count of crashes involving a pedestrian or cyclist (`pbcr`), now from the rebuilt file, for
    the block group and every peer (peers without a rebuilt count are left out; at least 20 peers required);
  * "worse than X%": share of peers with a lower count; shown as a gap at >= 80% with a margin of 10% of the peer
    median, as a strength at <= 20% with the same margin (thresholds unchanged).
  * crash-dependent rows (traffic calming, crosswalks, pedestrian signals, slow streets, protected bike lanes, street
    lighting): eligibility re-run through pipeline/engine.py with the rebuilt pedestrian/cyclist and KSI counts.
    Where the source's pedestrian/cyclist count is a lower bound (Illinois: first harmful event only; California files
    built before round 4 used only CCRS's "motor vehicle involved with" field; since round 4 they also use the
    Parties and injured-persons tables and are complete), a count
    can prove a block group qualifies but not that it doesn't: rows are added or sized up, never dropped or sized
    down. Elsewhere rows that no longer qualify are dropped and crosswalk rows re-sized where the 10-crash threshold
    flips. LA's rows were built by an LA build whose code is not in this repository, so LA rows are never added.

Output: app/data/crash_gaps/<fips>.json
  {"_meta": {...}, "bg": {"<geoid>": {"p": [count, peer_median, worse_share, "g"|"s"] , "drop": [ids], "add": [rows], "repl": [rows]}}}
Only block groups with a pedestrian/cyclist gap or strength, or a row change, are listed.
Usage: python3 scripts/recompute_crash_gaps.py [fips ...]
"""
import base64
import glob
import gzip
import json
import os
import re
import statistics
import sys
from datetime import date

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
import engine  # noqa: E402

CRASH_DIR = os.path.join(ROOT, "app", "data", "crash_counts")
OUT_DIR = os.path.join(ROOT, "app", "data", "crash_gaps")
CRASH_IDS = {"traffic_calming", "crosswalks", "ped_signals", "slow_streets", "protected_bike", "street_lighting"}
POOL_KEYS = ["ht", "vc", "pcr", "pa", "pn", "bt", "gro", "din", "ten", "dog", "pool", "ev", "fw", "tg", "nocar", "inc", "yb", "pop"]


def vec(m):
    d = (m["homes"] / m["acres"]) if m.get("acres") and m.get("homes") else 0
    return [m.get("inc") or 0, d, m.get("hv") or 0, m.get("yb") or 1960, m.get("nocar") or 0, m.get("sf") or 0]


def load_la_details():
    d = json.load(open(os.path.join(ROOT, "app", "data", "details-la.json")))
    out = {}
    for b in d["chunks"].values():
        out.update(json.loads(gzip.decompress(base64.b64decode(b))))
    return out


def load_bundle(fips):
    if fips == "06059":
        return json.loads(gzip.decompress(base64.b64decode(open(os.path.join(ROOT, "app", "data", "bundle-oc.b64.txt")).read().strip())))
    p = os.path.join(ROOT, "counties", f"bundle_{fips}.json.gz")
    return json.loads(gzip.decompress(open(p, "rb").read())) if os.path.exists(p) else None


def counts(fips):
    p = os.path.join(CRASH_DIR, f"{fips}.json")
    return json.load(open(p)) if os.path.exists(p) else None


def xr(x):
    """A count as shown: a whole number stays an int; a 1/k-weighted count keeps one decimal."""
    return int(round(x)) if abs(x - round(x)) < 1e-9 else round(float(x), 1)


def crosswalk_n(row):
    mm = re.match(r"(\d+) intersections", row[1] or "")
    return int(mm.group(1)) if mm else None


def build(fips, la_det, la_counts, today):
    cc = counts(fips)
    if not cc:
        return None
    is_la = fips == "06037"
    if is_la:
        det = la_det
    else:
        B = load_bundle(fips)
        if not B or not B.get("details"):
            return None
        det = B["details"]
    county_m = {g: dict(v.get("m") or {}) for g, v in det.items()}
    # Pool with LA only when this county's counts come from the same source as LA's (CHP CCRS). San Francisco's come
    # from DataSF's injury-crash records, so it is compared within its own county.
    cc_meta0 = cc.get("_meta") or {}
    ca = fips.startswith("06") and "CCRS" in str(cc_meta0.get("source", ""))
    # IL: first harmful event only. CA: complete once the count also uses CCRS's Parties and injured-persons tables
    # (round 4, 16 Nov 2026; the file's _meta.pedbike_rule says so); a CA file without that rule is still a lower bound.
    cc_meta = cc.get("_meta") or {}
    lower_bound = (fips.startswith("17") or (ca and "Parties" not in str(cc_meta.get("pedbike_rule", "")))
                   or bool(cc_meta.get("pedbike_lower_bound")))
    peers = list(county_m.items()) if (is_la or not ca) else [(g, dict(v["m"])) for g, v in la_det.items()] + list(county_m.items())
    X = np.array([vec(m) for _, m in peers], float)
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = (X - mu) / sd
    peer_cnt = [((la_counts if (is_la or g.startswith("06037")) else cc).get(g) or [None])[0] for g, _ in peers]
    # percentile pools for the engine's quality-of-life field, built as build_oc.py does (LA + this county)
    pool_src = list(county_m.values()) if is_la else [v["m"] for v in la_det.values()] + list(county_m.values())
    pools = engine.Pools({k: [m[k] for m in pool_src if m.get(k) is not None] for k in POOL_KEYS})
    county_name = (B.get("meta") or {}).get("county") if not is_la else "Los Angeles County"
    state = (B.get("meta") or {}).get("state") if not is_la else "CA"

    out, stats = {}, {"block_groups": 0, "with_rebuilt_count": 0, "gaps": 0, "strengths": 0, "old_gaps": 0, "old_strengths": 0,
                      "rank_moved_10pts": 0, "rank_compared": 0, "rows_dropped": 0, "rows_added": 0, "rows_resized": 0}
    gid_index = {g: i for i, (g, _) in enumerate(peers)}
    for gid, m in county_m.items():
        stats["block_groups"] += 1
        c = cc.get(gid)
        old_gp = (m.get("gp") or {})
        old_p = next((e for e in old_gp.get("g", []) if e[0] == "pedbike"), None)
        stats["old_gaps"] += bool(old_p)
        stats["old_strengths"] += any(e[0] == "pedbike" for e in old_gp.get("s", []))
        if not isinstance(c, list):
            continue
        stats["with_rebuilt_count"] += 1
        rec = {}
        x = c[0]
        i = gid_index[gid]
        dist = ((Z - Z[i]) ** 2).sum(1)
        near = [j for j in np.argsort(dist) if j != i][:50]
        pv = [peer_cnt[j] for j in near if peer_cnt[j] is not None]
        if len(pv) >= 20:
            med = statistics.median(pv)
            worse = float(np.mean([x > p for p in pv]))
            margin = abs(x - med) >= (0.1 * abs(med) if med else 1e-9)
            if old_p is not None:
                stats["rank_compared"] += 1
                stats["rank_moved_10pts"] += abs(worse - float(old_p[3])) > 0.10
            if worse >= 0.8 and margin:
                rec["p"] = [xr(x), round(float(med), 2), round(worse, 2), "g"]
                stats["gaps"] += 1
            elif worse <= 0.2 and margin:
                rec["p"] = [xr(x), round(float(med), 2), round(worse, 2), "s"]
                stats["strengths"] += 1
        # crash-dependent rows
        rows = (det[gid].get("r") or [])
        old = {r[0]: r for r in rows if r[0] in CRASH_IDS}
        m2 = dict(m)
        m2["pbcr"], m2["ksi"] = c[0], c[1]
        new = {r[0]: r for r in engine.run(m2, pools, county_name or "", state or "") if r[0] in CRASH_IDS}
        drop = [] if lower_bound else [k for k in old if k not in new]
        add = [] if is_la else [new[k] for k in new if k not in old]
        repl = []
        if "crosswalks" in old and "crosswalks" in new:
            on, nn = crosswalk_n(old["crosswalks"]), crosswalk_n(new["crosswalks"])
            if on != nn and (not lower_bound or (nn or 0) > (on or 0)):
                repl.append(new["crosswalks"])
        if drop:
            rec["drop"] = drop
        if add:
            rec["add"] = add
        if repl:
            rec["repl"] = repl
        stats["rows_dropped"] += len(drop)
        stats["rows_added"] += len(add)
        stats["rows_resized"] += len(repl)
        if rec:
            out[gid] = rec
    cm = cc["_meta"]
    # California's files (scripts/build_crash_counts_ca.py) don't record years; that script reads CCRS 2023-2025.
    years = cm.get("years") or ([2023, 2025] if "build_crash_counts_ca" in (cm.get("script") or "") else None)
    payload = {
        "_meta": {
            "county_fips": fips,
            "built": today,
            "script": "scripts/recompute_crash_gaps.py",
            "crash_counts": f"app/data/crash_counts/{fips}.json",
            "crash_source": cm.get("source"),
            "crash_weighting": cm.get("weighting"),
            "crash_years": years,
            "peers": "50 most similar block groups by standardized income, homes per acre, home value, year built, share without a car, single-family share, "
                     + ("within LA County" if is_la else "from LA County plus this county (all CHP CCRS 2023-2025)" if ca else "within this county (one state crash source)"),
            "pedbike_count_is_lower_bound": lower_bound,
            "metric": "3-year count of crashes involving a pedestrian or cyclist, inside the block group or within 10 m of its boundary",
            "thresholds": "gap if worse than at least 80% of peers and at least 10% from the peer median; strength if at most 20%",
            "rows": "crash-dependent rows re-run through pipeline/engine.py with the rebuilt counts" + ("; LA rows only dropped or re-sized" if is_la else ""),
            **stats,
        },
        "bg": out,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(payload, open(os.path.join(OUT_DIR, f"{fips}.json"), "w"), separators=(",", ":"))
    return stats


def main():
    want = [a for a in sys.argv[1:] if re.fullmatch(r"\d{5}", a)]
    fipses = want or sorted(os.path.basename(p)[:5] for p in glob.glob(os.path.join(CRASH_DIR, "*.json")))
    la_det = load_la_details()
    la_counts = counts("06037") or {}
    today = date.today().isoformat()
    tot = {}
    for f in fipses:
        s = build(f, la_det, la_counts, today)
        if s is None:
            print(f"{f}: no bundle or crash file, skipped", file=sys.stderr)
            continue
        for k, v in s.items():
            tot[k] = tot.get(k, 0) + v
        print(f"{f}: {s}", file=sys.stderr)
    print("TOTAL", json.dumps(tot), file=sys.stderr)


if __name__ == "__main__":
    main()
