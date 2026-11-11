"""Build one regional page once all its counties carry the round-8 site rules and no other page build is running (memory: page tests
load 40-70 MB pages).  usage: python3 build_region_when_ready.py <region name>     log: /home/user/w5/regions_build.log"""
import json, os, subprocess, sys, time
W5 = "/home/user/w5"; N = "/home/user/national"; name = sys.argv[1]
fl = json.load(open(f"{W5}/regions.json"))[name]


def ready(F):
    S = f"{W5}/sd_data/sites_{F}.json" if F == "06073" else f"{W5}/county_sites/sites_{F}.json"
    try:
        return json.load(open(S))["meta"].get("creek_shore_rule") == 2 and os.path.exists(f"{N}/pipeline/data_{F}/bundle-oc.b64")
    except Exception:
        return False


def busy():
    return subprocess.run(["pgrep", "-f", "build_region.py"], capture_output=True).returncode == 0


while not all(ready(f) for f in fl) or busy():
    time.sleep(60)
with open(f"{W5}/regions_build.log", "a") as log:
    log.write(f"== {time.strftime('%H:%M:%S')} {name}\n"); log.flush()
    subprocess.run(["python3", f"{W5}/tools/build_region.py", name] + fl, stdout=log, stderr=subprocess.STDOUT)
    log.write(f"REGION DONE {name} {time.strftime('%H:%M:%S')}\n")
