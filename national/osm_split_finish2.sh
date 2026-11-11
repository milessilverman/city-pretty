#!/bin/bash
# Finishes the state splits (replaces osm_split_finish.sh, which kept the 3.8 GB us-west file on disk): waits for the us-south split,
# re-cuts any state a memory stop left out (re-downloading a regional file deleted for disk space; the same day's file has the same
# timestamp, so only the missing states are cut), deletes the regional files, drops the empty Alaska / Hawaii cuts, refreshes the
# registry, and only then writes "ALL SPLITS DONE" (the second build worker waits for it).
cd /home/user/national; exec >> logs/osm_split_all.log 2>&1
echo "   $(date +%T) osm_split_finish2.sh took over"
while pgrep -f "osm_split.py us-south" > /dev/null; do sleep 30; done
echo "   us-south first pass: $(grep -c wrote logs/osm_split_us-south.log) states written"
for R in us-south us-west; do
  for i in 1 2 3; do
    if [ ! -f cache/osm_split/$R-latest.osm.pbf ]; then
      curl -sS --max-time 3600 -o cache/osm_split/$R-latest.osm.pbf.part https://download.openstreetmap.fr/extracts/north-america/$R-latest.osm.pbf && \
      curl -sS -o cache/osm_split/$R.state.txt https://download.openstreetmap.fr/extracts/north-america/$R.state.txt && \
      mv cache/osm_split/$R-latest.osm.pbf.part cache/osm_split/$R-latest.osm.pbf && echo "   re-downloaded $R ($(grep timestamp cache/osm_split/$R.state.txt))"
    fi
    until [ $(awk '/MemAvailable/{print $2}' /proc/meminfo) -gt 6500000 ]; do sleep 30; done   # osmium needs ~4.1 GB
    python3 osm_split.py $R --per-pass 1 > logs/osm_split_${R}_rerun.log 2>&1
    grep -q "!!" logs/osm_split_${R}_rerun.log || break
    echo "   $R re-run $i: memory stop, trying again"; sleep 120
  done
  if grep -q "!!" logs/osm_split_${R}_rerun.log; then echo "   $R: states still missing, regional file kept"; else rm -f cache/osm_split/$R-latest.osm.pbf; echo "   $R complete: $(grep -c wrote logs/osm_split_${R}_rerun.log) states cut in the re-run"; fi
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
