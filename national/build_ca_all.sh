#!/bin/bash
# Build every queued California county (pipeline + site suggestions), then delete the large raw downloads to save disk.
cd /home/user/national
for F in $(cat ca_queue.txt); do
  [ -f /home/user/w5/county_sites/sites_$F.json ] && continue
  ./build_county2.sh $F || echo "FAILED $F" >> logs/build_$F.log
  D=pipeline/data_$F
  if [ -f /home/user/w5/county_sites/sites_$F.json ]; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson
    rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(du -sh $D | cut -f1)" >> logs/ca_all.log
done
echo "ALL DONE" >> logs/ca_all.log
