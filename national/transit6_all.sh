#!/bin/bash
# Transit selection 6 for every built county (each feed and each bus route counted once; feeds without a catalog box placed by their own
# stops; blank rows ignored). Two roles, run as separate workers:
#   check     run the transit step alone (transit6_check.py), compare, adopt the new files; counties whose stops changed are queued in
#             logs/transit6_rebundle.txt. Repeats until no built county is older than selection 6 and no batch worker is still building.
#   rebundle  re-bundle each queued county (fetch_oc refetches the raw files cleanup removed; transit is already current), then clean up.
# usage: transit6_all.sh check|rebundle        logs: logs/transit6_check.log, logs/transit6_rebundle.log
cd /home/user/national; ROLE=$1; mkdir -p logs/locks6c logs/locks6r
batch_running() { pgrep -f "queue_worker.sh" > /dev/null; }
if [ "$ROLE" = "check" ]; then
  while true; do
    TODO=$(python3 transit6_todo.py); n=0
    for F in $TODO; do
      mkdir logs/locks6c/$F 2>/dev/null || continue
      n=$((n + 1)); python3 transit6_check.py $F > /dev/null 2>&1 || echo "$(date +%T) $F check failed" >> logs/transit6_check.log
    done
    if [ -z "$TODO" ] && ! batch_running; then break; fi
    [ $n -eq 0 ] && sleep 120
  done
  echo "$(date +%T) TRANSIT6 CHECK DONE" >> logs/transit6_check.log
elif [ "$ROLE" = "rebundle" ]; then
  cd pipeline
  while true; do
    did=0
    for F in $(cat /home/user/national/logs/transit6_rebundle.txt 2>/dev/null); do
      mkdir /home/user/national/logs/locks6r/$F 2>/dev/null || continue
      did=1; D=data_$F; LOG=/home/user/national/logs/rebuild8_$F.log
      ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
      echo "EXIT $?" >> $LOG
      if grep -q "^EXIT 0" $LOG; then
        rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
      fi
      FAILS=$(grep -c "!! failed" $LOG)
      echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $FAILS $(grep '!! failed' $LOG | head -2 | cut -c1-160 | tr '\n' ' ')" >> /home/user/national/logs/transit6_rebundle.log
    done
    if [ $did -eq 0 ]; then
      [ "$final" = 1 ] && break   # one more pass after the check finished, so a county queued at the very end is not missed
      if grep -q "TRANSIT6 CHECK DONE" /home/user/national/logs/transit6_check.log 2>/dev/null; then final=1; continue; fi
      sleep 120
    fi
  done
  echo "$(date +%T) TRANSIT6 REBUNDLE DONE" >> /home/user/national/logs/transit6_rebundle.log
fi
