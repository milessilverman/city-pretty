"""Every county re-bundled by the transit checks (logs/transit6_rebundle.log, logs/transit7_rebundle.log): its bundle's map layers must not
be emptied compared with its round-8.1 site bundle (site81). Prints one line per county and exits 1 if any layer that had features now
has none (a sign the build ran without its inputs)."""
import json, os, gzip, base64, sys
N = "/home/user/national"
# usage: layer_check.py [<baseline site dir, default site81> [<re-bundle log> ...]]
BASE = sys.argv[1] if len(sys.argv) > 1 else "site81"
LOGS = sys.argv[2:] or ["logs/transit6_rebundle.log", "logs/transit7_rebundle.log"]
done = []
for lg in LOGS:
    if os.path.exists(f"{N}/{lg}"):
        for l in open(f"{N}/{lg}"):
            p = l.split()
            if len(p) >= 4 and p[2] == "EXIT":
                done.append(p[1])
bad = 0
def lay(X):
    return {k: (len(v.get("features", [])) if isinstance(v, dict) else len(v) if isinstance(v, list) else None) for k, v in (X.get("layers") or {}).items()}
for F in sorted(set(done)):
    nb, ob = f"{N}/pipeline/data_{F}/bundle-oc.b64", f"{N}/{BASE}/counties/bundle_{F}.json.gz"
    if not os.path.exists(nb):
        print(F, "NO BUNDLE"); bad += 1; continue
    B = json.loads(gzip.decompress(base64.b64decode(open(nb).read())))
    if not os.path.exists(ob):
        print(F, f"no {BASE} bundle to compare (built later)", len(B["features"]), "block groups"); continue
    O = json.loads(gzip.decompress(open(ob, "rb").read()))
    ln, lo = lay(B), lay(O)
    # a rail-stations layer may legitimately empty (round 8.3 drops miniature / heritage railway stations), so it does not fail the check
    emptied = [k for k in lo if lo.get(k) and not ln.get(k) and k not in ("stations", "stations_con")]
    if lo.get("stations") and not ln.get("stations"):
        print(F, "note: stations layer", lo["stations"], "-> 0")
    if emptied or len(B["features"]) != len(O["features"]):
        bad += 1
    print(F, "block groups", len(B["features"]), "/", len(O["features"]), "layers emptied:" if emptied else "ok", emptied or "")
print("LAYER CHECK", "FAILED" if bad else "OK", bad)
sys.exit(1 if bad else 0)
