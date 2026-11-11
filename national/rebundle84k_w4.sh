#!/bin/bash
# A fourth worker for rebundle84k.sh (batch 5 has ended, so one CPU is free): the same queue, locks and log.
cd /home/user/national/pipeline
for F in $(cat /home/user/national/logs/rebundle84k_queue.txt); do
  mkdir /home/user/national/logs/locks14k/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild14k_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84k.log
done
echo "$(date +%T) REBUNDLE84K W4 DONE" >> /home/user/national/logs/rebundle84k.log
