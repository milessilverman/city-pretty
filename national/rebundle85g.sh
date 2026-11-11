#!/bin/bash
# Round 8.5: metrics_oc v8 (a line whose operator's current schedule omits it is not kept by type or operator: the JTA Skyway,
# pipeline/stations_not_served.json). Re-run the only county with such a station kept (Duval, FL: the JRTC's Skyway platform).
# log: logs/rebundle85g.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks85g; 
echo "$(date +%T) $(wc -l < /home/user/national/logs/rebundle85g_queue.txt) counties in the list" >> /home/user/national/logs/rebundle85g.log
worker() {
for F in $(cat /home/user/national/logs/rebundle85g_queue.txt); do
  mkdir /home/user/national/logs/locks85g/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild85g_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle85g.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE85G DONE" >> /home/user/national/logs/rebundle85g.log
