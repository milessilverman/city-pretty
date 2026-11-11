#!/bin/bash
# Re-check (transit step only) the counties where selection 8 chose between duplicate route copies, after the rank fix (newer schedule
# first). Two at a time. Then re-bundle the ones whose stops changed, after the station re-bundles finish (never two builds of one county).
cd /home/user/national; mkdir -p logs/locks10r
xargs -a logs/rank_recheck.txt -n 1 -P 2 python3 transit8b_check.py > /dev/null 2>&1
echo "$(date +%T) TRANSIT8B CHECK DONE" >> logs/transit8b_check.log
until [ -f logs/station_queue_final ] && ! (for F in $(cat logs/station_rebundle_queue.txt); do grep -q " $F EXIT" logs/station_rebundle.log || echo $F; done | grep -q .); do sleep 60; done
cd pipeline
for F in $(cat /home/user/national/logs/transit8b_rebundle.txt 2>/dev/null); do
  mkdir /home/user/national/logs/locks10r/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild12_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/transit8b_rebundle.log
done
echo "$(date +%T) TRANSIT8B REBUNDLE DONE" >> /home/user/national/logs/transit8b_rebundle.log
