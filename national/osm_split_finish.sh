#!/bin/bash
# Takes over from osm_split_all.sh once its us-south split is running: waits for it, re-cuts any state a memory stop left out (us-south,
# us-west: each run is a no-op for states already cut), deletes the regional files, drops the empty Alaska / Hawaii cuts, refreshes the
# registry, and only then writes "ALL SPLITS DONE" (the second build worker waits for it).
cd /home/user/national; exec >> logs/osm_split_all.log 2>&1
until pgrep -f "osm_split.py us-south" > /dev/null; do sleep 10; done
pkill -f osm_split_all.sh; pkill -f clean_akhi.sh; echo "   $(date +%T) osm_split_finish.sh took over"
while pgrep -f "osm_split.py us-south" > /dev/null; do sleep 30; done
echo "   us-south first pass: $(grep -c wrote logs/osm_split_us-south.log) states written"
for R in us-south us-west; do
  for i in 1 2 3; do
    until [ $(awk '/MemAvailable/{print $2}' /proc/meminfo) -gt 6500000 ]; do sleep 30; done   # osmium needs ~4.1 GB
    python3 osm_split.py $R --per-pass 1 > logs/osm_split_${R}_rerun.log 2>&1
    grep -q "!!" logs/osm_split_${R}_rerun.log || break
    echo "   $R re-run $i: memory stop, trying again"; sleep 120
  done
  if grep -q "!!" logs/osm_split_${R}_rerun.log; then echo "   $R: states still missing, regional file kept"; else rm -f cache/osm_split/$R-latest.osm.pbf; echo "   $R complete: $(grep -c wrote logs/osm_split_${R}_rerun.log) states re-cut"; fi
done
python3 - <<'PY'
import json, os
p = "/home/user/national/data/osm_split.json"; S = json.load(open(p))
for st in ("AK", "HI"):   # us-west does not contain them: the cuts are empty
    e = S.pop(st, None)
    if e:
        for ext in ("-latest.osm.pbf", ".state.txt"):
            f = "/home/user/national/cache/osm_states/" + e["split"].replace("/", "__") + ext
            if os.path.exists(f): os.remove(f)
json.dump(S, open(p + ".tmp", "w"), indent=1, sort_keys=True); os.replace(p + ".tmp", p)
print("   states cut from regional files:", len(S), " ".join(sorted(S)))
PY
python3 registry.py | tail -1
echo "== $(date +%T) ALL SPLITS DONE"
