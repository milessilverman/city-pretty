#!/bin/bash
# Round 8.4: transit selection 11 (05:11:08; candidate Wednesdays compared by 07:00-09:00 bus departures). Re-run the re-bundled counties
# still measured on 11 Nov whose bus data or stop layer differ from round 8.3, every batch-5 county measured on 11 Nov, and the county batch
# 5 was building. Three workers.  log: logs/rebundle84i.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks12i
worker() {
for F in $(cat /home/user/national/logs/rebundle84i_queue.txt); do
  mkdir /home/user/national/logs/locks12i/$F 2>/dev/null || continue
  until grep -q " $F EXIT" /home/user/national/logs/rebundle84.log || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  D=data_$F; LOG=/home/user/national/logs/rebuild14i_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84i.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE84I DONE" >> /home/user/national/logs/rebundle84i.log
