#!/bin/bash
# Round 8.6: an extra worker on rebundle86b's queue (same queue file, lock directories, log and cleanup as rebundle86b.sh's workers; a
# county is claimed with mkdir, so any number of workers can share the queue). Started 10 Nov because the workers wait on downloads.
cd /home/user/national/pipeline
for F in $(cat /home/user/national/logs/rebundle86b_queue.txt); do
  [ -d /home/user/national/logs/locks86b/$F ] && continue
  while [ "$(df --output=avail -k /home/user | tail -1)" -lt 819200 ]; do sleep 60; done
  mkdir /home/user/national/logs/locks86b/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild86b_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle86b.log
done
