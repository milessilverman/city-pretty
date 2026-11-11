"""Round 8.5 (pre-delivery audit): in Puerto Rico the transit sources row explained the block groups with unknown bus frequency as places
"where the feeds miss OpenStreetMap's bus stops"; since metrics_oc v6 most of them are unknown because no feed that is read has a stop
within 400 m. Text only, in the GTFS feeds row of the Puerto Rico bundles. usage: python3 pr_text85.py [--dry]"""
import glob, gzip, base64, json, hashlib, os, sys
N = "/home/user/national"
OLD = " block groups where the feeds miss OpenStreetMap's bus stops)"
NEW = " block groups where no feed that is read has a stop within 400 m, or where the feeds miss OpenStreetMap's bus stops)"
assert '"' not in OLD + NEW and "\\" not in OLD + NEW
dry = "--dry" in sys.argv; rep = {}
for p in sorted(glob.glob(f"{N}/pipeline/data_72*/bundle-oc.b64")):
    raw = open(p).read().strip(); s = gzip.decompress(base64.b64decode(raw)).decode("utf-8")
    n = s.count(OLD)
    if n == 0:
        rep[p] = "unchanged"; continue
    assert n == 1, (p, n)
    t = s.replace(OLD, NEW)
    assert t.replace(NEW, "\0") == s.replace(OLD, "\0")
    json.loads(t)   # still valid JSON
    out = base64.b64encode(gzip.compress(t.encode("utf-8"), mtime=0)).decode()
    if not dry:
        tmp = p + ".tmp85"; open(tmp, "w").write(out); os.replace(tmp, p)
    rep[p] = f"changed {hashlib.sha256(raw.encode()).hexdigest()[:16]} -> {hashlib.sha256(out.encode()).hexdigest()[:16]}"
for k, v in rep.items(): print(k.replace(N + "/", ""), v)
