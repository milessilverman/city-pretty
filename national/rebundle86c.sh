#!/bin/bash
# Round 8.6, third pass (stragglers, run by round86_finish.sh): as the second pass (selections 21-23): every county whose transit meta is below selection 23 or whose bundle is older than
# the installed build_oc.py (install86c.sh 01:33, 'none' for an empty feed list 01:39; selection 22 at 02:00, selection 23 and build_oc text at 02:08), batch-7 counties included, re-run as in
# rebundle86a.sh. Queue:
# logs/rebundle86c_queue.txt, written at the start. Four workers; a county starts only while more than 800 MB are free.
# log: logs/rebundle86c.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks86c
python3 -I - > /home/user/national/logs/rebundle86c_queue.txt <<'PY'
import json, os
N = "/home/user/national"
q = open(f"{N}/logs/rebundle86a_queue.txt").read().split()
q7 = [F for F in open(f"{N}/us_queue7.txt").read().split() if os.path.exists(f"/home/user/w5/county_sites/sites_{F}.json")]
bo = max(os.path.getmtime(f"{N}/pipeline/{x}") for x in ("build_oc.py", "engine.py", "metrics_oc.py"))   # a bundle older than the installed build_oc or engine has its old text
for F in q + q7:
    p = f"{N}/pipeline/data_{F}/transit_stops_7_9.meta.json"; b = f"{N}/pipeline/data_{F}/bundle-oc.b64"
    if not os.path.exists(p) or json.load(open(p)).get("selection", 0) < 24 or not os.path.exists(b) or os.path.getmtime(b) < bo:
        print(F)
PY
echo "$(date +%T) $(wc -l < /home/user/national/logs/rebundle86c_queue.txt) counties in the list" >> /home/user/national/logs/rebundle86c.log
worker() {
for F in $(cat /home/user/national/logs/rebundle86c_queue.txt); do
  [ -d /home/user/national/logs/locks86c/$F ] && continue
  while [ "$(df --output=avail -k /home/user | tail -1)" -lt 819200 ]; do sleep 60; done
  mkdir /home/user/national/logs/locks86c/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild86c_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle86c.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE86C DONE" >> /home/user/national/logs/rebundle86c.log
