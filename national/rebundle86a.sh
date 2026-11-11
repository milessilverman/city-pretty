#!/bin/bash
# Round 8.6: every built county at transit selection 20 (ended copies not final; headway stops only with morning departures) and with
# build_oc's sources-row text fix (copies named, contradictory 'Not included' entries dropped). Queue: logs/rebundle86a_queue.txt (all
# counties with a pipeline/data_<fips> folder, largest first). Four workers; a county starts only while more than 800 MB are free.
# log: logs/rebundle86a.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks86a
echo "$(date +%T) $(wc -l < /home/user/national/logs/rebundle86a_queue.txt) counties in the list" >> /home/user/national/logs/rebundle86a.log
worker() {
for F in $(cat /home/user/national/logs/rebundle86a_queue.txt); do
  [ -d /home/user/national/logs/locks86a/$F ] && continue
  while [ "$(df --output=avail -k /home/user | tail -1)" -lt 819200 ]; do sleep 60; done
  mkdir /home/user/national/logs/locks86a/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild86a_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle86a.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE86A DONE" >> /home/user/national/logs/rebundle86a.log
