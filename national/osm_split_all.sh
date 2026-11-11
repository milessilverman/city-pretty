#!/bin/bash
# Split every openstreetmap.fr regional extract into per-state files (osm_split.py), one region at a time: download, split, delete
# the regional file (disk), then regenerate the registry so those states' counties read their state file.  log: logs/osm_split_all.log
cd /home/user/national; exec >> logs/osm_split_all.log 2>&1
for R in ${@:-us-northeast us-midwest us-west us-south}; do
  echo "== $(date +%T) $R"
  while pgrep -f "osm_split.py $R" > /dev/null; do sleep 30; done     # a split of this region already running: wait for it
  if [ ! -f cache/osm_split/$R-latest.osm.pbf ]; then
    for i in 1 2 3 4; do
      curl -sS --max-time 3600 -o cache/osm_split/$R-latest.osm.pbf.part https://download.openstreetmap.fr/extracts/north-america/$R-latest.osm.pbf && break
      sleep $((2 ** i))
    done
    curl -sS -o cache/osm_split/$R.state.txt https://download.openstreetmap.fr/extracts/north-america/$R.state.txt
    mv cache/osm_split/$R-latest.osm.pbf.part cache/osm_split/$R-latest.osm.pbf
    echo "   downloaded $(stat -c %s cache/osm_split/$R-latest.osm.pbf) bytes"
  fi
  python3 osm_split.py $R --per-pass 1 > logs/osm_split_$R.log 2>&1; echo "   split exit $?"; grep -c "wrote" logs/osm_split_$R.log
  grep -q "!!" logs/osm_split_$R.log && echo "   some states failed: kept the regional file for a re-run" || rm -f cache/osm_split/$R-latest.osm.pbf
  python3 registry.py | tail -1
done
echo "== $(date +%T) ALL SPLITS DONE"
