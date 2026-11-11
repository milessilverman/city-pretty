"""Write one county's hosted files for a national site: bundle_<fips>.json (the county bundle) and sites_<fips>.json (its site
suggestions), for patch6.py's hosted mode ("<fips>=@<base url>").  usage: python3 export_county.py <fips> <out dir> [--gz]
--gz writes bundle_<fips>.json.gz and sites_<fips>.json.gz instead (4-8 MB instead of 14-28 MB; use "<fips>=@gz:<base url>" in patch6.py:
the page unpacks them itself, so the host needs no Content-Encoding setup)"""
import sys, os, json, gzip, base64, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sitefilters import drop_commercial
fips, out = sys.argv[1], sys.argv[2]; GZ = "--gz" in sys.argv[3:]; os.makedirs(out, exist_ok=True)


def write(obj, name):
    data = json.dumps(obj, separators=(",", ":")).encode()
    p = os.path.join(out, name + (".json.gz" if GZ else ".json"))
    open(p, "wb").write(gzip.compress(data, 9, mtime=0) if GZ else data)
    return p
P = "/home/user/national/pipeline"; W5 = "/home/user/w5"
d = os.path.join(P, "data" if fips == "06059" else f"data_{fips}")
B = json.loads(gzip.decompress(base64.b64decode(open(os.path.join(d, "bundle-oc.b64")).read())))
if not B["meta"].get("fips"):
    B["meta"]["fips"] = fips
bp = write(B, f"bundle_{fips}")
cand = [f"{W5}/county_sites/sites_{fips}.json", f"{W5}/sd_data/sites_{fips}.json"]
sp = next((c for c in cand if os.path.exists(c)), None)
note = "no site suggestions built"
if sp:
    S = json.load(open(sp)); S["meta"].pop("verified", None); note = "site suggestions included"
    if not S["meta"].get("lot_park_commercial_rule_m"):          # runs from before sites.py had the rule: filter here
        osm = os.path.join(d, "osm_sites.json")
        if os.path.exists(osm):
            lat0 = round(json.load(open("/home/user/national/data/counties.json"))[fips]["lat"], 1)
            note = f"commercial-lot filter applied here ({drop_commercial(S, osm, lat0)} dropped)"
        else:
            note = "built after sites.py gained the commercial-lot rule (no post-filter needed)"
    write(S, f"sites_{fips}")
print(fips, B["meta"]["county"], len(B["features"]), "block groups;", round(os.path.getsize(bp) / 1e6, 1), "MB;", note)
