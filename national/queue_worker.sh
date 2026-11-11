#!/bin/bash
# Build every county in one or more queue files (pipeline + site suggestions), then keep only what later steps need (as build_batch.sh).
# Several workers can share the same queues: each county is claimed with a lock directory (logs/build_locks/<fips>). A county whose
# OpenStreetMap source is a regional file waits until osm_split.py has cut its state (counties.json osm.split); if every split is done
# and it still has none, it is skipped.   usage: queue_worker.sh <log name> <queue file> [<queue file> ...]   (log: logs/<log name>.log)
cd /home/user/national; LOGN=$1; shift; mkdir -p logs/build_locks
needs_split() { python3 -c "import json,sys;o=json.load(open('data/counties.json'))['$1']['osm'];sys.exit(0 if o.get('url') and not o.get('split') and o['url'].rsplit('/',2)[1]=='north-america' else 1)"; }
for Q in "$@"; do
  for F in $(cat $Q); do
    [ -f /home/user/w5/county_sites/sites_$F.json ] && continue
    mkdir logs/build_locks/$F 2>/dev/null || continue
    while needs_split $F; do
      if grep -q "ALL SPLITS DONE" logs/osm_split_all.log 2>/dev/null; then echo "$(date +%T) $F no state file: skipped" >> logs/$LOGN.log; continue 2; fi
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
  echo "ALL DONE $Q" >> logs/$LOGN.log
done
