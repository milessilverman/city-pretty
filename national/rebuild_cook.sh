#!/bin/bash
# Rebuild Cook County with Illinois DOT crash records once the crash download (fetch_oc.py local_crashes) has finished.
cd /home/user/national
while pgrep -f "fetch_oc.py local_crashes" > /dev/null; do sleep 30; done
[ -f pipeline/data_17031/crashes_local.json ] || { echo "$(date +%T) no crashes_local.json for Cook" >> logs/rebuild_cook.log; exit 1; }
echo "$(date +%T) crash rows: $(python3 -c "import json;print(len(json.load(open('pipeline/data_17031/crashes_local.json'))['rows']))")" >> logs/rebuild_cook.log
./build_county2.sh 17031 && echo "$(date +%T) Cook rebuilt" >> logs/rebuild_cook.log || echo "$(date +%T) Cook rebuild FAILED" >> logs/rebuild_cook.log
D=pipeline/data_17031
if grep -q "DONE 17031" <(tail -3 logs/build_17031.log); then
  rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json
  rm -rf $D/osm
fi
