#!/bin/bash
# Round 8.4: transit selection 10, second pass: the re-bundled counties still measured on 11 Nov (Veterans Day) whose bus-stop layer differs
# from round 8.3 although their block-group bus frequency does not (the layer check found Colusa's only stop gone; 16 counties in all).
# Three workers.  log: logs/rebundle84h.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks12h
worker() {
for F in $(cat /home/user/national/logs/rebundle84h_queue.txt); do
  mkdir /home/user/national/logs/locks12h/$F 2>/dev/null || continue
  until grep -q " $F EXIT" /home/user/national/logs/rebundle84.log || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  D=data_$F; LOG=/home/user/national/logs/rebuild14h_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84h.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE84H DONE" >> /home/user/national/logs/rebundle84h.log
