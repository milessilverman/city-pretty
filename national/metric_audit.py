"""Sanity audit of the per-block-group inputs across every built county (like the transit check, but for the other distances and counts).
For each county: share of block groups with no value, and the population-weighted median, for grocery (gro, m), nearest park (pn, m),
park acres within 1/2 mile (pa), dining within 400 m (din), EV charger (ev, m), school / hospital / library distance (fc, m), rail (rm, m)
and freeway (fw, m). Flags counties whose values sit far outside the range of counties of similar density (people per acre).
Writes logs/metric_audit.json and prints the flags."""
import json, glob, os, statistics, collections
N = "/home/user/national"
C = json.load(open(f"{N}/data/counties.json"))
KEYS = ["gro", "pn", "pa", "din", "ev", "rm", "fw"]
FC = ["school", "hospital", "library"]


def wmed(vals):   # population-weighted median of (value, weight)
    v = sorted((x, w) for x, w in vals if x is not None and w)
    if not v:
        return None
    tot = sum(w for _, w in v); acc = 0
    for x, w in v:
        acc += w
        if acc >= tot / 2:
            return x


rows = []
for p in sorted(glob.glob(f"{N}/pipeline/data_*/metrics.json")):
    F = p.split("data_")[1][:5]
    try:
        M = json.load(open(p))["metrics"]
    except Exception:
        continue
    pop = sum((m.get("pop") or 0) for m in M.values()); acres = sum((m.get("acres") or 0) for m in M.values())
    r = {"fips": F, "county": C.get(F, {}).get("name"), "st": C.get(F, {}).get("state"), "bgs": len(M), "density": round(pop / acres, 2) if acres else None}
    for k in KEYS:
        r[k + "_none"] = round(sum(1 for m in M.values() if m.get(k) is None) / max(len(M), 1), 3)
        r[k + "_med"] = wmed([(m.get(k), m.get("pop")) for m in M.values()])
    for k in FC:
        r[k + "_none"] = round(sum(1 for m in M.values() if (m.get("fc") or {}).get(k) is None) / max(len(M), 1), 3)
        r[k + "_med"] = wmed([((m.get("fc") or {}).get(k), m.get("pop")) for m in M.values()])
    rows.append(r)
json.dump(rows, open(f"{N}/logs/metric_audit.json", "w"), indent=1)
# compare each county with counties of similar density (same density band)
band = lambda d: 0 if d is None else (0 if d < 0.5 else 1 if d < 2 else 2 if d < 6 else 3 if d < 15 else 4)
by = collections.defaultdict(list)
for r in rows:
    by[band(r["density"])].append(r)
flags = []
for r in rows:
    peers = by[band(r["density"])]
    for k in KEYS + FC:
        vals = [q[k + "_med"] for q in peers if q[k + "_med"] is not None]
        if len(vals) < 8:
            continue
        lo, hi = statistics.quantiles(vals, n=20)[0], statistics.quantiles(vals, n=20)[-1]
        v = r[k + "_med"]
        if r[k + "_none"] > 0.5:
            flags.append((r["fips"], r["county"], r["st"], k, f"no value in {r[k + '_none']:.0%} of block groups"))
        elif v is not None and (v > hi * 2 or (hi > 0 and v < lo / 2 and k not in ("pa", "din"))):
            flags.append((r["fips"], r["county"], r["st"], k, f"median {v:,.0f} vs peers' 5-95% range {lo:,.0f}-{hi:,.0f} (density {r['density']})"))
for f in flags:
    print(" | ".join(str(x) for x in f))
print(len(rows), "counties audited;", len(flags), "flags")
