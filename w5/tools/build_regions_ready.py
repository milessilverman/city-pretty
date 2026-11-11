"""Build every regional page in regions.json as soon as all its counties carry the round-8 site rules (creek_shore_rule 2), one page
at a time; the US sample waits for Cook County's rebuild with Illinois DOT crashes. Log: /home/user/w5/regions_build.log"""
import json, os, subprocess, time
W5 = "/home/user/w5"; N = "/home/user/national"
R = json.load(open(f"{W5}/regions.json")); todo = list(R)
log = open(f"{W5}/regions_build.log", "a")


def ready(F):
    S = f"{W5}/sd_data/sites_{F}.json" if F == "06073" else f"{W5}/county_sites/sites_{F}.json"
    try:
        return json.load(open(S))["meta"].get("creek_shore_rule") == 2 and os.path.exists(f"{N}/pipeline/data_{F}/bundle-oc.b64")
    except Exception:
        return False


def cook_done():
    p = f"{N}/logs/rebuild_cook.log"
    return os.path.exists(p) and ("Cook rebuilt" in open(p).read() or "FAILED" in open(p).read())


while todo:
    pick = next((r for r in todo if all(ready(f) for f in R[r]) and (r != "us-sample" or cook_done())), None)
    if not pick:
        time.sleep(60); continue
    todo.remove(pick)
    log.write(f"== {time.strftime('%H:%M:%S')} {pick}\n"); log.flush()
    subprocess.run(["python3", f"{W5}/tools/build_region.py", pick] + R[pick], stdout=log, stderr=subprocess.STDOUT)
    log.flush()
log.write(f"ALL REGIONS DONE {time.strftime('%H:%M:%S')}\n"); log.close()
