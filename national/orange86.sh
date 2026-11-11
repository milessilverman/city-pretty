#!/bin/bash
# Round 8.6: Orange County's page bundle (oc_regress) rebuilt with the final build_oc.py text (singular forms, sources rows); Orange keeps
# OCTA's own feed, so nothing upstream of build_oc changes. The round-8.5 bundle is kept in backups_oc_regress_pre86/, and the diff of every
# string and number in the bundle is written to logs/orange86_diff.txt: numbers must not change.   usage: ./orange86.sh
set -e
N=/home/user/national; O=$N/oc_regress; B=${ORANGE_BASE:-$N/backups_oc_regress_pre86}   # round 8.6 (install86h): ORANGE_BASE=backups_oc_regress_86h after the data fixes
mkdir -p $B
[ -f $B/bundle-oc.b64 ] || cp -p $O/bundle-oc.b64 $O/bundle-oc.json $B/
cd $N/pipeline
CP_FIPS=06059 CP_DATA=$O python3 build_oc.py /home/user/page/dec > $N/logs/orange86_build.log 2>&1
python3 -I - "$B/bundle-oc.b64" "$O/bundle-oc.b64" > $N/logs/orange86_diff.txt <<'PY'
import json, gzip, base64, sys, collections
a, b = (json.loads(gzip.decompress(base64.b64decode(open(p, "rb").read()))) for p in sys.argv[1:3])
diffs = collections.Counter(); ex = collections.defaultdict(list); nums = 0
def walk(x, y, path):
    global nums
    if type(x) != type(y) and not (isinstance(x, (int, float)) and isinstance(y, (int, float))):
        diffs["TYPE " + path] += 1; ex["TYPE " + path].append((str(x)[:80], str(y)[:80])); return
    if isinstance(x, dict):
        for k in set(x) | set(y):
            if k not in x or k not in y: diffs["KEY " + path + "." + str(k)] += 1
            else: walk(x[k], y[k], path + "." + (k if len(k) < 15 else "K"))
    elif isinstance(x, list):
        if len(x) != len(y): diffs["LEN " + path] += 1
        for p, q in zip(x, y): walk(p, q, path + "[]")
    elif x != y:
        k = ("NUMBER " if isinstance(x, (int, float)) else "text ") + path
        if isinstance(x, (int, float)): nums += 1
        diffs[k] += 1
        if len(ex[k]) < 3: ex[k].append((str(x)[:140], str(y)[:140]))
walk(a, b, "")
print(f"number changes: {nums}")
for k, v in diffs.most_common():
    print(v, k)
    for o, n in ex[k]: print("    -", o, "\n    +", n)
PY
echo "$(date +%T) Orange rebuilt; $(head -1 $N/logs/orange86_diff.txt)"
