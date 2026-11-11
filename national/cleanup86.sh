#!/bin/bash
# Round 8.6, after the round-8.5 audit: free disk without losing anything that is not identical elsewhere or re-buildable.
#  1. site84 (round-8.4 national site; the round-8.5 audit, which compared against it, is complete);
#  2. the round-8.5 hand-off pages become hard links to the identical region pages (cmp first), and build_region.py unlinks a page
#     before rebuilding it, so the hand-off keeps the round-8.5 version;
#  3. per-county copies of a state's TES zip become hard links to one copy (cmp first);
#  4. the round-8.1 transit backups (*.sel5), which nothing reads.
set -e
N=/home/user/national; H=/home/user/handoff/round8.5; L=$N/logs/cleanup86.log
echo "$(date +%T) free before: $(df -k /home/user | tail -1 | awk '{print $4}') KB" >> $L
rm -rf /home/user/national/site84 && echo "$(date +%T) site84 removed" >> $L
python3 -I - <<'PY'
p = "/home/user/w5/tools/build_region.py"; s = open(p).read()
a = 'print(run(["python3", "-I", f"{W5}/tools/patch6.py", base, page] + bundles).strip().splitlines()[-1])'
if s.count(a) != 1: raise SystemExit("build_region.py changed: page line not found")
if "os.remove(page)" not in s:
    s = s.replace(a, 'if os.path.exists(page):   # round 8.6: write a new file, so a hard link elsewhere (the hand-off) keeps the previous page\n    os.remove(page)\n' + a)
    open(p, "w").write(s)
PY
python3 -I -c "import ast; ast.parse(open('/home/user/w5/tools/build_region.py').read())" && echo "$(date +%T) build_region.py unlinks a page before rebuilding it" >> $L
for f in $H/city-pretty-*.html; do
  b=$(basename $f); g=$(ls /home/user/w5/regions/*/$b 2>/dev/null | head -1)
  if [ -n "$g" ] && cmp -s "$f" "$g"; then ln -f "$g" "$f"; echo "$(date +%T) linked $b" >> $L; else echo "$(date +%T) kept $b (no identical region page)" >> $L; fi
done
python3 -I - <<'PY'
import os, glob, filecmp, collections
by = collections.defaultdict(list)
for p in glob.glob("/home/user/national/pipeline/data_*/tes_*_latest_csv.zip"):
    if not os.path.islink(p): by[os.path.basename(p)].append(p)
log = open("/home/user/national/logs/cleanup86.log", "a"); saved = 0
for name, ps in by.items():
    ref = ps[0]
    for p in ps[1:]:
        if os.stat(p).st_ino != os.stat(ref).st_ino and filecmp.cmp(ref, p, shallow=False):
            saved += os.path.getsize(p); tmp = p + ".lnk"; os.link(ref, tmp); os.replace(tmp, p)
log.write(f"TES zips linked: {sum(len(v) for v in by.values())} files, {saved / 1e6:.0f} MB freed\n")
PY
find /home/user/national/pipeline -maxdepth 2 -name "*.sel5" -type f -delete && echo "$(date +%T) .sel5 backups removed" >> $L
echo "$(date +%T) free after: $(df -k /home/user | tail -1 | awk '{print $4}') KB" >> $L
