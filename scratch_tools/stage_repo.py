"""Stage the City Pretty pipeline, tools, notes and research into one folder for a private GitHub repo (11 Nov 2026).
Copies code and notes as they are; gzips the large page inputs; skips data, caches, logs of single builds and backups.
usage: python3 -I stage_repo.py <out dir>"""
import fnmatch
import gzip
import os
import shutil
import sys

OUT = sys.argv[1]
SP_OLD = "/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad"
SP = "/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad"
MAX = 20e6            # copy files up to 20 MB as they are
SKIP = ["*.pyc", "*.log", "*.bak*", "*.pre_*", "*.delivered-*", "*.out", "*.flag", "*.lock"]
copied, skipped = [], []


def ok(name):
    return not any(fnmatch.fnmatch(name, p) for p in SKIP)


def cp(src, dst_rel):
    dst = os.path.join(OUT, dst_rel)
    sz = os.path.getsize(src)
    if sz > MAX:
        skipped.append((src, sz, "over 20 MB")); return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst); copied.append((dst_rel, sz))


def cp_gz(src, dst_rel):
    dst = os.path.join(OUT, dst_rel + ".gz")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(src, "rb") as f, gzip.open(dst, "wb", compresslevel=9) as g:
        shutil.copyfileobj(f, g)
    copied.append((dst_rel + ".gz", os.path.getsize(dst)))


def files(d, pats, recursive=False):
    out = []
    for root, dirs, fs in os.walk(d):
        dirs[:] = [x for x in dirs if x != "__pycache__" and not x.startswith("data_")]
        for f in fs:
            if any(fnmatch.fnmatch(f, p) for p in pats) and ok(f):
                out.append(os.path.join(root, f))
        if not recursive:
            break
    return sorted(out)


N = "/home/user/national"; PL = f"{N}/pipeline"; W = "/home/user/w5"
CURRENT = {"build_oc.py", "engine.py", "fetch_oc.py", "geo.py", "layers_oc.py", "metrics_oc.py", "oc_rail_stops.py", "osm_extract.py",
           "region.py", "sources_oc.py", "splice_bundle.py", "state_crashes.py", "validate_la.py"}
for p in files(PL, ["*.py", "*.json"]):
    b = os.path.basename(p)
    cp(p, f"pipeline/{b}" if b in CURRENT or b.endswith(".json") else f"pipeline/old_versions/{b}")
for p in files(N, ["*.py", "*.sh", "*.md", "*.txt"]):
    cp(p, f"national/{os.path.basename(p)}")
for p in files(f"{N}/data", ["*"], recursive=True):
    cp(p, "national/data/" + os.path.relpath(p, f"{N}/data"))
for p in files(f"{N}/logs", ["*.md", "*.notes", "*.json", "*.txt"]):
    if os.path.getsize(p) < 2e6:
        cp(p, f"national/logs/{os.path.basename(p)}")
for p in files(W, ["*.md", "*.sh", "*.txt", "*.py", "regions.json", "sites-summary.json", "*.b64"]):
    if os.path.basename(p) != "base64.b64":
        cp(p, f"w5/{os.path.basename(p)}")
for p in files(f"{W}/tools", ["*"]):
    cp(p, f"w5/tools/{os.path.basename(p)}")
for sub in ("round86", "round87", "research"):
    for p in files(f"{W}/{sub}", ["*"], recursive=True):
        cp(p, f"w5/{sub}/" + os.path.relpath(p, f"{W}/{sub}"))
for p in files("/home/user/page", ["*.py", "*.js", "*.txt", "page_nodata.html"]):
    cp(p, f"page/{os.path.basename(p)}")
# large page inputs, gzipped: the base page and LA bundle the page build starts from, and the decoded catalog template build_oc reads
cp_gz(f"{W}/in.html", "inputs/w5/in.html")
cp_gz(f"{W}/bundle_in.json", "inputs/w5/bundle_in.json")
for b in ("bundle.json", "bundle_oc.json", "details.json"):
    cp_gz(f"/home/user/page/dec/{b}", f"inputs/page_dec/{b}")
# round 8.6 patch scripts (already applied to the code above; kept as the record of each change)
for p in files(f"{SP_OLD}/edit86", ["*.py", "*.json", "*.txt", "*.sh", "*.js", "*.md"]):
    cp(p, f"patches/round86/{os.path.basename(p)}")
for rel in ("catalog87_workflow.js", "research_prompts.html", "stage_repo.py", "fixtest.sh", "newbuild.sh"):
    p = f"{SP}/{rel}"
    if os.path.exists(p):
        cp(p, f"scratch_tools/{rel}")
for sub, pats in (("parcelprobe", ["*.py"]), ("addrtest", ["*.js"]), ("interim86", ["*.sh"])):
    for p in files(f"{SP}/{sub}", pats):
        cp(p, f"scratch_tools/{sub}/{os.path.basename(p)}")

tot = sum(s for _, s in copied)
print(f"copied {len(copied)} files, {tot / 1e6:.1f} MB")
for s in skipped:
    print("skipped", s)
big = sorted(copied, key=lambda x: -x[1])[:8]
print("largest:", ", ".join(f"{r} {s / 1e6:.1f} MB" for r, s in big))
