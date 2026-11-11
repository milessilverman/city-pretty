#!/bin/bash
# After station_scan2.py: re-bundle the counties whose rail stations differ between the previous and the final station rule
# (logs/station_rebundle2.txt), once the rank-fix re-bundles (transit8b_run.sh) are done, skipping any county that loop just rebuilt
# with the final rule. Sequential.   log: logs/station2_rebundle.log
cd /home/user/national; mkdir -p logs/locks11r
until [ -f logs/station_rebundle2.txt ]; do sleep 60; done   # runs beside transit8b_run.sh: the two lists share no county (those in it are skipped)
cd pipeline
worker() {
for F in $(cat /home/user/national/logs/station_rebundle2.txt); do
  grep -q "^$F$" /home/user/national/logs/transit8b_rebundle.txt && continue   # rebuilt with the final rule by transit8b_run.sh
  mkdir /home/user/national/logs/locks11r/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild13_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/station2_rebundle.log
done
}
worker & worker & wait   # two at a time (locks in logs/locks11r)
echo "$(date +%T) STATION2 REBUNDLE DONE" >> /home/user/national/logs/station2_rebundle.log
