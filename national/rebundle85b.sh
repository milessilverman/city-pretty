#!/bin/bash
# Round 8.5: transit selection 17 (untimed stop times interpolated, and the audit's selection fixes) and metrics_oc v5. Re-run the
# counties of logs/rebundle85b_queue.txt: those served by a feed with untimed bus stops (logs/untimed_scan.json), v5's three, and the
# audit's five plus Broward. Four workers.  log: logs/rebundle85b.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks85b; 
echo "$(date +%T) $(wc -l < /home/user/national/logs/rebundle85b_queue.txt) counties in the list" >> /home/user/national/logs/rebundle85b.log
worker() {
for F in $(cat /home/user/national/logs/rebundle85b_queue.txt); do
  mkdir /home/user/national/logs/locks85b/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild85b_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle85b.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE85B DONE" >> /home/user/national/logs/rebundle85b.log
