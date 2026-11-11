#!/bin/bash
# Round 8.5: metrics_oc v7 (stations tagged under construction, proposed, disused or abandoned are never kept by type or operator) and
# transit selection 18. Re-run the 9 counties with stations kept by type or operator (logs/rebundle85d_queue.txt). Four workers.
# log: logs/rebundle85d.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks85d; 
echo "$(date +%T) $(wc -l < /home/user/national/logs/rebundle85d_queue.txt) counties in the list" >> /home/user/national/logs/rebundle85d.log
worker() {
for F in $(cat /home/user/national/logs/rebundle85d_queue.txt); do
  mkdir /home/user/national/logs/locks85d/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild85d_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle85d.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE85D DONE" >> /home/user/national/logs/rebundle85d.log
