#!/bin/bash
# Round 8.4: transit selection 10 (03:27:10; the representative Wednesday skips reduced-service days such as Veterans Day, 11 Nov 2026).
# Re-run with three workers: the re-bundled counties whose bus frequency changed against round 8.3 while measured on 11 Nov, the batch-5
# counties measured on 11 Nov, and the county batch 5 was building. A batch-5 county waits for its first build.  log: logs/rebundle84g.log
cd /home/user/national/pipeline; mkdir -p /home/user/national/logs/locks12g
worker() {
for F in $(cat /home/user/national/logs/rebundle84g_queue.txt); do
  mkdir /home/user/national/logs/locks12g/$F 2>/dev/null || continue
  until grep -q " $F EXIT" /home/user/national/logs/rebundle84.log || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  D=data_$F; LOG=/home/user/national/logs/rebuild14g_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84g.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE84G DONE" >> /home/user/national/logs/rebundle84g.log
