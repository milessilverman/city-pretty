"""Merge LA + OC site suggestions into the page data block (gzip + base64) and check every record has what its card renders."""
import json, gzip, base64, sys
W5 = "/home/user/w5"
import glob, collections
def load_shards(pattern, single):
    files = sorted(glob.glob(pattern))
    if not files:
        return json.load(open(single))
    parts = [json.load(open(f)) for f in files]
    meta = dict(parts[0]["meta"]); cnt = collections.Counter()
    for p in parts: cnt.update(p["meta"]["counts"])
    meta["counts"] = dict(cnt); meta["shards"] = len(parts)
    sites = {}
    for p in parts:
        assert not (set(sites) & set(p["sites"])); sites.update(p["sites"])
    return {"meta": meta, "sites": sites}
la = load_shards(f"{W5}/la_data/sites_la_[0-9].json", f"{W5}/la_data/sites_la.json"); oc = json.load(open(f"{W5}/oc_data/sites_oc.json"))
V = json.load(open(f"{W5}/research/verified.json"))
for m in (la["meta"], oc["meta"]):
    m.pop("verified", None)
# usage: combine_sites.py [out.b64] [<fips sites json> ...]   (extra counties from sites.py <fips>)
OUTP = sys.argv[1] if len(sys.argv) > 1 else f"{W5}/sites.b64"
extra = [json.load(open(f)) for f in sys.argv[2:]]
for e in extra:
    e["meta"].pop("verified", None)
import sys as _s; _s.path.insert(0, W5 + '/tools')
from sitefilters import drop_commercial
import os as _os
def post_filter(e):
    """sites.py runs since the rule carry lot_park_commercial_rule_m; older runs are filtered here when their OSM extract still exists"""
    if e["meta"].get("lot_park_commercial_rule_m"):
        return "rule in sites.py"
    f = e["meta"]["fips"]; osm = f"/home/user/national/pipeline/data_{f}/osm_sites.json"
    if not _os.path.exists(osm):
        return "built after the rule (raw OSM removed)"
    return drop_commercial(e, osm, round(json.load(open("/home/user/national/data/counties.json"))[f]["lat"], 1))
print("commercial-lot drops", drop_commercial(la, f"{W5}/la_data/osm_sites_la.json"), drop_commercial(oc, f"{W5}/oc_data/osm_sites_oc.json"),
      *[post_filter(e) for e in extra])
sites = {**la["sites"], **oc["sites"]}
assert not (set(la["sites"]) & set(oc["sites"]))
for e in extra:
    assert not (set(sites) & set(e["sites"])); sites.update(e["sites"])
NEED = {"creek": ["nm", "kind", "len", "free", "covered", "cost", "d"], "lot_park": ["ac", "pa", "src"], "ev": ["dest", "dk", "ac", "dl2", "ddc", "n_l2", "n_dc"],
        "calm": ["street", "len", "n", "ped", "bike", "killed", "humps", "elig"], "xing": ["at", "n", "ped", "bike", "killed", "pt"]}
bad = 0
for g, L in sites.items():
    for s in L:
        for k in NEED[s["t"]]:
            if (k not in s) if (s["t"], k) in (("ev", "dl2"), ("ev", "ddc")) else s.get(k) is None:   # no charger of a kind in the county's AFDC list: None
                bad += 1; print("missing", g, s["t"], k) if bad < 10 else None
assert bad == 0, bad
out = {"meta": {"la": la["meta"], "oc": oc["meta"], **{e["meta"]["fips"]: e["meta"] for e in extra}, "verified": V}, "sites": sites}
raw = json.dumps(out, separators=(",", ":"), ensure_ascii=False).encode()
b = base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode()
open(OUTP, "w").write(b)
print("block groups", len(sites), "raw MB", round(len(raw) / 1e6, 2), "b64 MB", round(len(b) / 1e6, 2), "LA", la["meta"]["counts"], "OC", oc["meta"]["counts"], *[(e["meta"]["fips"], e["meta"]["counts"]) for e in extra])
