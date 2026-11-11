#!/bin/bash
# Round 8.5: metrics_oc v4 (name-aware merge of added GTFS rail stops, up to 300 m). Re-run the counties whose additions change in the
# simulation (logs/merge85_queue.txt; Suffolk MA was rebuilt first as the test). Three workers.  log: logs/rebundle85a.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks85a; mkdir /home/user/national/logs/locks85a/25025 2>/dev/null
echo "$(date +%T) $(wc -l < /home/user/national/logs/merge85_queue.txt) counties in the list (25025 done as the test)" >> /home/user/national/logs/rebundle85a.log
worker() {
for F in $(cat /home/user/national/logs/merge85_queue.txt); do
  mkdir /home/user/national/logs/locks85a/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild85_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle85a.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE85A DONE" >> /home/user/national/logs/rebundle85a.log
