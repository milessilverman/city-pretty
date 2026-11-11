#!/bin/bash
# Build every county in a queue file (pipeline + site suggestions), then keep only what later steps need:
# bundle-oc.b64, metrics.json, bg.geojson, places.geojson, transit / crash metadata and the site suggestions.
# usage: build_batch.sh <queue file> <log name>
cd /home/user/national; Q=$1; LOGN=$2
for F in $(cat $Q); do
  [ -f /home/user/w5/county_sites/sites_$F.json ] && continue
  ./build_county2.sh $F || echo "FAILED $F" >> logs/build_$F.log
  D=pipeline/data_$F
  if [ -f /home/user/w5/county_sites/sites_$F.json ]; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json
    rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(du -sh $D | cut -f1)" >> logs/$LOGN.log
done
echo "ALL DONE" >> logs/$LOGN.log
