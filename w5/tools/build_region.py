"""Build one regional single-file page: LA + Orange County (always) plus the listed counties, each with its site suggestions, then
test it (LA/OC regression + one countytest per county).  usage: python3 build_region.py <name> <fips> [<fips> ...]
Output: /home/user/w5/regions/<name>/city-pretty-<name>.html, test results next to it."""
import sys, os, json, subprocess, shutil
W5 = "/home/user/w5"; P = "/home/user/national/pipeline"
name, fips = sys.argv[1], sys.argv[2:]
REG = json.load(open("/home/user/national/data/counties.json"))
out_dir = os.path.join(W5, "regions", name); os.makedirs(out_dir, exist_ok=True)


def run(cmd, timeout=3600):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise SystemExit(f"FAILED {' '.join(cmd[:3])}: {r.stderr[-800:]}")
    return r.stdout


sites, bundles, missing = [], [], []
for f in fips:
    s = next((p for p in (f"{W5}/county_sites/sites_{f}.json", f"{W5}/sd_data/sites_{f}.json") if os.path.exists(p)), None)
    b = f"{P}/data_{f}/bundle-oc.b64"
    if not (s and os.path.exists(b)):
        missing.append(f); continue
    sites.append(s); bundles.append(f"{f}={b}")
if missing:
    print("not built yet (left out):", missing)
sb = os.path.join(out_dir, "sites.b64"); base = os.path.join(out_dir, "base5.html"); page = os.path.join(out_dir, f"city-pretty-{name}.html")
print(run(["python3", "-I", f"{W5}/tools/combine_sites.py", sb] + sites).strip().splitlines()[-1][:200])
run(["python3", "-I", f"{W5}/tools/patch5.py", f"{W5}/in.html", sb, "/home/user/national/oc_regress/bundle-oc.b64", f"{W5}/tools/sites_ui.js", base])
if os.path.exists(page):   # round 8.6: write a new file, so a hard link elsewhere (the hand-off) keeps the previous page
    os.remove(page)
print(run(["python3", "-I", f"{W5}/tools/patch6.py", base, page] + bundles).strip().splitlines()[-1])
os.remove(base)
print("page", page, round(os.path.getsize(page) / 1e6, 1), "MB")
results = {}
r = subprocess.run(["node", f"{W5}/tools/regress.js", page, f"{name}_laoc"], capture_output=True, text=True, timeout=3600)
results["LA+OC"] = (r.stdout.strip().splitlines() or ["?"])[-1] if "checks passed" in r.stdout else r.stdout[-300:] + r.stderr[-300:]
for f in fips:
    if f in missing:
        continue
    n = len(json.load(open(f"{P}/data_{f}/metrics.json"))["metrics"])
    r = subprocess.run(["node", f"{W5}/tools/countytest.js", page, f"{name}_{f}", f, REG[f]["name"], str(n)], capture_output=True, text=True, timeout=3600)
    lines = [l for l in r.stdout.splitlines() if "checks passed" in l or l.strip().startswith("FAIL")]
    results[f] = lines or [r.stdout[-300:] + r.stderr[-300:]]
    for d, dst in ((f"{W5}/reg_{name}_{f}/results.json", f"test-{f}.json"),):
        if os.path.exists(d):
            shutil.copy(d, os.path.join(out_dir, dst))
if os.path.exists(f"{W5}/reg_{name}_laoc/results.json"):
    shutil.copy(f"{W5}/reg_{name}_laoc/results.json", os.path.join(out_dir, "test-la-oc.json"))
json.dump(results, open(os.path.join(out_dir, "tests.json"), "w"), indent=1)
for k, v in results.items():
    print(k, v)
