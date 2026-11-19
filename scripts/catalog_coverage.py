"""Share of block groups whose best gated value item returns >= $1 per $1, mirroring app.js ivAllows + ivRow.
Usage: coverage.py <intervention_verification.json>"""
import json, gzip, base64, glob, sys, collections

iv = json.load(open(sys.argv[1]))
la_bundle = json.loads(gzip.decompress(base64.b64decode(open("app/data/bundle-la.b64.txt").read().strip())))
CAT = la_bundle["catalog"]


FIPS = ""   # county being tallied (set by tally); the page uses activeFips()


def allows(id_, m):
    r = iv.get(id_)
    if not r or r.get("status") not in ("verified", "partially_verified"):
        return False
    c = r.get("applies_if") or {}
    if c.get("median_household_income_below") is not None:
        inc = (m or {}).get("inc")
        if inc is None or not (float(inc) < c["median_household_income_below"]):
            return False
    if c.get("state_fips_in") is not None and FIPS[:2] not in c["state_fips_in"]:
        return False
    return True


def row(a):
    o = (iv.get(a[0]) or {}).get("sourced_effect")
    if o and o.get("value_per_dollar") and a[3]:
        b = list(a)
        b[7] = round(a[3] * o["value_per_dollar"])
        b[8] = o["value_per_dollar"]
        return b
    if not o or not o.get("pct") or not a[9]:
        return a
    swap = o.get("capex") and o.get("replaces_capex")
    if float(a[9]) == float(o["pct"]) and not swap:
        return a
    b = list(a)
    b[7] = round(a[7] * o["pct"] / a[9])
    if swap:
        old_capex = a[4] if a[4] and a[4] > 0 else o["replaces_capex"]
        b[3] = max(0, round(a[3] - old_capex + o["capex"]))
        b[4] = o["capex"]
    b[8] = round(b[7] / b[3], 3) if b[3] else 0
    return b


def best(rows, m, cat):
    cands = []
    for a in rows or []:
        c = cat.get(a[0])
        if not c or c.get("kind") != "value" or not allows(a[0], m):
            continue
        a = row(a)
        if a[8] >= 1:
            cands.append(a)
    return max(cands, key=lambda a: a[8]) if cands else None


def both_sourced(id_):
    r = iv.get(id_) or {}
    return r.get("status") == "verified" or (r.get("effect") == "checked" and r.get("cost") == "checked")


def tally(items, cat):
    n = ok = both = 0
    dist = collections.Counter()
    for rows, m in items:
        n += 1
        b = best(rows, m, cat)
        if b:
            ok += 1
            dist[b[0]] += 1
            both += both_sourced(b[0])
    return n, ok, both, dist


def la_items():
    src = json.load(open("app/data/details-la.json"))
    for b in src["chunks"].values():
        for bg, d in json.loads(gzip.decompress(base64.b64decode(b))).items():
            yield d.get("r"), d.get("m")


def bundle_items(path):
    d = json.loads(gzip.decompress(open(path, "rb").read()))
    cat = d.get("catalog") or CAT
    for bg, det in (d.get("details") or {}).items():
        yield det.get("r"), det.get("m")


out = {}
FIPS = "06037"
n, ok, both, dist = tally(la_items(), CAT)
out["LA County"] = (n, ok, both, dist.most_common(8))
N = OK = BOTH = 0
DIST = collections.Counter()
trav = None
for p in sorted(glob.glob("counties/bundle_*.json.gz")):
    FIPS = p.split("bundle_")[1][:5]
    n, ok, both, dist = tally(bundle_items(p), CAT)
    N += n; OK += ok; BOTH += both; DIST.update(dist)
    if p.endswith("48453.json.gz"):
        trav = (n, ok, both, dist.most_common(6))
out["all non-LA bundles"] = (N, OK, BOTH, DIST.most_common(8))
out["Travis County, TX"] = trav
out["nationwide (LA + all bundles)"] = (out["LA County"][0] + N, out["LA County"][1] + OK, out["LA County"][2] + BOTH, (DIST + collections.Counter(dict(out["LA County"][3]))).most_common(8))
for k, (n, ok, both, top) in out.items():
    print(f"{k}: {n} block groups; sourced best bet {ok} ({100*ok/n:.1f}%); both sides sourced {both} ({100*both/n:.1f}%); top: {top}")
