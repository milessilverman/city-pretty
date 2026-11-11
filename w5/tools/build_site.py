"""Build a national hosted site: one index.html with LA and Orange County embedded and every other built county listed and fetched on
demand from counties/bundle_<fips>.json.gz + sites_<fips>.json.gz (the page unpacks gzip itself, so any static host works).
usage: python3 build_site.py <out dir> [--split <repo>:<MB>,<repo>:<MB>,...] [<fips> ...]   (no fips: every county with a bundle and sites)
Writes <out>/index.html, <out>/counties/*.json.gz and <out>/counties/manifest.json; upload <out>/ as it is.
--split (round 8.6: GitHub Pages publishes at most 1 GB a site): the site is laid out as GitHub serves project sites, one folder per
repository, <out>/<repo>/; the first repository gets index.html and the counties, in FIPS order, up to its MB, then the next, and so on.
A county in another repository is fetched from ../<repo>/counties/ (project sites share the origin <owner>.github.io, so no cross-origin
request). Test by serving <out> and opening /<first repo>/index.html. The manifest (first repository) gives each county's folder."""
import sys, os, json, subprocess, gzip, base64, time, shutil
W5 = "/home/user/w5"; P = "/home/user/national/pipeline"
args = sys.argv[1:]; out = args.pop(0); split = None
if args[:1] == ["--split"]:
    split = [(r.split(":")[0], float(r.split(":")[1])) for r in args[1].split(",")]; args = args[2:]
want = args
root = out
if split:   # counties are exported to <out>/<first repo>/counties and moved to the other repositories after packing
    out = os.path.join(root, split[0][0])
C = json.load(open("/home/user/national/data/counties.json"))
os.makedirs(os.path.join(out, "counties"), exist_ok=True)


def sites_path(f):
    return next((p for p in (f"{W5}/county_sites/sites_{f}.json", f"{W5}/sd_data/sites_{f}.json") if os.path.exists(p)), None)


fips = want or sorted(f for f in C if f not in ("06037", "06059") and os.path.exists(f"{P}/data_{f}/bundle-oc.b64") and sites_path(f))
man = []
for f in fips:
    r = subprocess.run(["python3", "-I", f"{W5}/tools/export_county.py", f, os.path.join(out, "counties"), "--gz"], capture_output=True, text=True)
    if r.returncode:
        print("FAILED export", f, r.stderr[-300:]); continue
    S = json.load(open(sites_path(f)))["meta"]
    man.append({"fips": f, "name": C[f]["name"], "state": C[f]["state"], "block_groups": len(json.load(open(f"{P}/data_{f}/metrics.json"))["metrics"]),
                "bundle_mb": round(os.path.getsize(os.path.join(out, "counties", f"bundle_{f}.json.gz")) / 1e6, 1), "built": S.get("built"),
                "osm": S.get("osm"), "crash_source": (S.get("crash_source") or {}).get("name"), "crash_years": S.get("crash_years")})
    print(r.stdout.strip())
base_of = {m["fips"]: "counties" for m in man}
if split:   # pack in FIPS order: each repository up to its MB (index.html, the manifest and the page assets count against the first)
    sz = lambda f: sum(os.path.getsize(os.path.join(out, "counties", f"{k}_{f}.json.gz")) for k in ("bundle", "sites"))
    ri, used = 0, 60e6   # the first repository also holds index.html (~30 MB), README and docs
    for m in sorted(man, key=lambda m: m["fips"]):
        while used + sz(m["fips"]) > split[ri][1] * 1e6:
            ri += 1; used = 0
            if ri >= len(split):
                sys.exit(f"--split: the counties need more than {', '.join(f'{r}:{mb:g}' for r, mb in split)}; add a repository")
        used += sz(m["fips"])
        if ri:
            d = os.path.join(root, split[ri][0], "counties"); os.makedirs(d, exist_ok=True)
            for k in ("bundle", "sites"):
                os.replace(os.path.join(out, "counties", f"{k}_{m['fips']}.json.gz"), os.path.join(d, f"{k}_{m['fips']}.json.gz"))
            base_of[m["fips"]] = f"../{split[ri][0]}/counties"
        m["folder"] = base_of[m["fips"]]
json.dump({"built": time.strftime("%Y-%m-%d"), "counties": man}, open(os.path.join(out, "counties", "manifest.json"), "w"), indent=1)
sb, base = os.path.join(out, "sites.b64"), os.path.join(out, "base5.html")
subprocess.run(["python3", "-I", f"{W5}/tools/combine_sites.py", sb], check=True, capture_output=True)
subprocess.run(["python3", "-I", f"{W5}/tools/patch5.py", f"{W5}/in.html", sb, "/home/user/national/oc_regress/bundle-oc.b64", f"{W5}/tools/sites_ui.js", base], check=True, capture_output=True)
r = subprocess.run(["python3", "-I", f"{W5}/tools/patch6.py", base, os.path.join(out, "index.html")] + [f"{m['fips']}=@gz:{base_of[m['fips']]}" for m in man], capture_output=True, text=True)
print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-500:])
for p in (sb, base, base + ".changes.txt"):
    if os.path.exists(p):
        os.remove(p)
tot = sum(os.path.getsize(os.path.join(out, "counties", x)) for x in os.listdir(os.path.join(out, "counties")))
print(f"site {out}: index.html {os.path.getsize(os.path.join(out, 'index.html')) / 1e6:.1f} MB + {sum(1 for m in man if base_of[m['fips']] == 'counties')} counties ({tot / 1e6:.0f} MB)")
for r, mb in (split or [])[1:]:
    d = os.path.join(root, r, "counties")
    if os.path.isdir(d):
        t = sum(os.path.getsize(os.path.join(d, x)) for x in os.listdir(d))
        print(f"  {r}: {sum(1 for m in man if base_of[m['fips']] == f'../{r}/counties')} counties ({t / 1e6:.0f} MB, limit {mb:g} MB)")
