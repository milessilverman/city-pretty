#!/bin/bash
# Like build_batch.sh, for counties whose OpenStreetMap file is a state cut from a regional extract (osm_split.py): each county waits
# until its state has been split and registered (counties.json osm.split), then builds; raw files are cleaned up the same way.
# usage: build_batch_split.sh <queue file> <log name>
cd /home/user/national; Q=$1; LOGN=$2
for F in $(cat $Q); do
  [ -f /home/user/w5/county_sites/sites_$F.json ] && continue
  until python3 -c "import json,sys;sys.exit(0 if json.load(open('data/counties.json'))['$F']['osm'].get('split') else 1)" 2>/dev/null; do
    grep -q "ALL SPLITS DONE" logs/osm_split_all.log && { echo "$(date +%T) $F no state split: skipped" >> logs/$LOGN.log; continue 2; }
    sleep 60
  done
  ./build_county2.sh $F || echo "FAILED $F" >> logs/build_$F.log
  D=pipeline/data_$F
  if [ -f /home/user/w5/county_sites/sites_$F.json ]; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json
    rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(du -sh $D | cut -f1)" >> logs/$LOGN.log
done
echo "ALL DONE" >> logs/$LOGN.log
