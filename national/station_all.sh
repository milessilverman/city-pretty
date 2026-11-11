#!/bin/bash
# Round 8.3, rail stations: osm_extract.py now reads stations mapped as areas and rail stop positions, and drops miniature / heritage /
# zoo railways. Re-bundle the counties listed in logs/station_rebundle_queue.txt (from station_scan.py). One role: rebundle (several
# workers share locks in logs/locks9r). Stops after one more pass once logs/station_queue_final exists.
# usage: station_all.sh rebundle        log: logs/station_rebundle.log
cd /home/user/national; ROLE=$1; mkdir -p logs/locks9c logs/locks9r
batch_running() { pgrep -f "queue_worker.sh" > /dev/null; }
if [ "$ROLE" = "check" ]; then
  while true; do
    TODO=$(python3 transit7_todo.py); n=0
    for F in $TODO; do
      mkdir logs/locks9c/$F 2>/dev/null || continue
      n=$((n + 1)); python3 transit8_check.py $F > /dev/null 2>&1 || echo "$(date +%T) $F check failed" >> logs/transit8_check.log
    done
    if [ -z "$TODO" ] && ! batch_running; then break; fi
    [ $n -eq 0 ] && sleep 120
  done
  echo "$(date +%T) TRANSIT8 CHECK DONE" >> logs/transit8_check.log
elif [ "$ROLE" = "rebundle" ]; then
  cd pipeline
  while true; do
    did=0
    for F in $(cat /home/user/national/logs/station_rebundle_queue.txt 2>/dev/null); do
      mkdir /home/user/national/logs/locks9r/$F 2>/dev/null || continue
      did=1; D=data_$F; LOG=/home/user/national/logs/rebuild11_$F.log
      ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
      echo "EXIT $?" >> $LOG
      if grep -q "^EXIT 0" $LOG; then
        rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
      fi
      FAILS=$(grep -c "!! failed" $LOG)
      echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $FAILS $(grep '!! failed' $LOG | head -2 | cut -c1-160 | tr '\n' ' ')" >> /home/user/national/logs/station_rebundle.log
    done
    if [ $did -eq 0 ]; then
      [ "$final" = 1 ] && break   # one more pass after the check finished, so a county queued at the very end is not missed
      if [ -f /home/user/national/logs/station_queue_final ]; then final=1; continue; fi
      sleep 120
    fi
  done
  echo "$(date +%T) STATION REBUNDLE DONE" >> /home/user/national/logs/station_rebundle.log
fi
