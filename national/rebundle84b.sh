#!/bin/bash
# Round 8.4: re-run the counties whose build started before the station rule's last refinement (metrics_oc.py installed 22:34:44:
# a station missing from its operator's CURRENT feed is not served). Each waits for its first build to end (rebundle84.log EXIT line,
# or the batch-5 worker's log line), then the pipeline runs again (its GTFS files are reused). log: logs/rebundle84b.log
cd /home/user/national/pipeline
for F in $(cat /home/user/national/logs/rebundle84b_queue.txt); do
  until grep -q " $F EXIT" /home/user/national/logs/rebundle84.log || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  if grep -q "^FAILED $F" /home/user/national/logs/build_$F.log 2>/dev/null && ! [ -f /home/user/w5/county_sites/sites_$F.json ]; then
    echo "$(date +%T) $F skipped: its batch-5 build failed" >> /home/user/national/logs/rebundle84b.log; continue
  fi
  D=data_$F; LOG=/home/user/national/logs/rebuild14b_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84b.log
done
echo "$(date +%T) REBUNDLE84B DONE" >> /home/user/national/logs/rebundle84b.log
