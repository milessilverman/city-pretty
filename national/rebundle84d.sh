#!/bin/bash
# Round 8.4: re-run the counties affected by the yard-stop refinement (GTFS stops named as yards are never added as stations)
# that had one added (Highbridge Yard: Bergen, Bronx, Manhattan, Queens; TEX yard limits: Dallas) and those whose build was running.
# Each waits for its running build to end (rebundle84.log, rebundle84b.log or the batch-5 log).  log: logs/rebundle84d.log
cd /home/user/national/pipeline
inq() { grep -qx "$1" /home/user/national/logs/$2 2>/dev/null; }
for F in $(cat /home/user/national/logs/rebundle84d_queue.txt); do
  until { grep -q " $F EXIT" /home/user/national/logs/rebundle84.log && { ! inq $F rebundle84b_queue.txt || grep -q " $F EXIT" /home/user/national/logs/rebundle84b.log; }; } \
        || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  D=data_$F; LOG=/home/user/national/logs/rebuild14d_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84d.log
done
echo "$(date +%T) REBUNDLE84D DONE" >> /home/user/national/logs/rebundle84d.log
