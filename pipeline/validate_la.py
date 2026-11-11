"""Regenerate LA County's recommendation rows from LA's own block-group metrics with engine.py and compare them with the
rows that ship in the page. Run from the scratchpad work folder (needs details.json and bundle.json decoded there)."""
import json, sys, collections, statistics
import numpy as np
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import engine

WORK = sys.argv[1] if len(sys.argv) > 1 else "."
dd = json.load(open(f"{WORK}/details.json"))

KEYS = ["ht", "vc", "pcr", "pa", "pn", "bt", "gro", "din", "ten", "dog", "pool", "ev", "fw", "tg", "nocar", "inc", "yb", "pop"]
pools = engine.Pools({k: [v["m"][k] for v in dd.values() if v["m"].get(k) is not None] for k in KEYS})


def extras(m):
    fc = m.get("fc") or {}
    x = {"school_m": fc.get("school"), "library_m": fc.get("library"), "clinic_m": fc.get("clinic"), "center_m": fc.get("community center"),
         "pubbldg_m": min([v for v in [fc.get("library"), fc.get("community center")] if v is not None] or [9e9])}
    return {k: v for k, v in x.items() if v is not None}


actual = collections.defaultdict(dict); predicted = collections.defaultdict(dict)
for k, v in dd.items():
    m = dict(v["m"]); m["x"] = extras(m)
    # crashes: LA rows carry the count only inside the why text; recover it for a fair test
    for a in v["r"]:
        if a[0] in ("crosswalks", "ped_signals"):
            try: m["pbcr"] = float(a[10].split()[0]); break
            except Exception: pass
    for a in v["r"]:
        actual[a[0]][k] = a
    for r in engine.run(m, pools):
        predicted[r[0]][k] = r

print(f"{'project':22s} {'actual':>6s} {'pred':>6s} {'prec':>5s} {'rec':>5s} | cost ratio p50 (p10-p90) | value ratio p50 (p10-p90) | need abs err p50")
for pid in sorted(set(actual) | set(predicted), key=lambda p: -len(actual[p])):
    A, P = actual[pid], predicted[pid]
    both = set(A) & set(P)
    prec = len(both) / len(P) if P else 0; rec = len(both) / len(A) if A else 0
    cr = [P[k][3] / A[k][3] for k in both if A[k][3]]; vr = [P[k][7] / A[k][7] for k in both if A[k][7]]
    ne = [abs(P[k][11] - A[k][11]) for k in both]
    f = lambda arr: f"{np.median(arr):.2f} ({np.percentile(arr, 10):.2f}-{np.percentile(arr, 90):.2f})" if arr else "   -   "
    print(f"{pid:22s} {len(A):6d} {len(P):6d} {prec:5.2f} {rec:5.2f} | {f(cr):24s} | {f(vr):24s} | {np.median(ne) if ne else float('nan'):.3f}")
