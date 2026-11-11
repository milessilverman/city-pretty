#!/bin/bash
# Re-bundle counties built before MobilityData transit (and its OSM bus-stop coverage check) was added: refetch what cleanup removed (+ GTFS), then metrics, layers, bundle.
# Site suggestions do not depend on transit and are kept. Skips counties still being built (no sites file yet) and Orange County.
cd /home/user/national/pipeline
ORDER=${1:-forward}; mkdir -p /home/user/national/logs/locks
DIRS=$(ls -d data_* | sort); [ "$ORDER" = "reverse" ] && DIRS=$(ls -d data_* | sort -r)
for D in $DIRS; do
  F=${D#data_}
  [ "$F" = "06059" ] && continue
  # done = the metrics recorded the GTFS-vs-OSM bus-stop check (or the county has no feeds at all)
  python3 -c "import json,sys;cv=json.load(open('$D/metrics.json')).get('coverage',{});c=cv.get('transit') or {};sys.exit(0 if ((c.get('selection')==3 and ('osm_bus_stops' in c or c.get('stops')==0)) and (cv.get('tree_equity') or {}).get('heat_baseline','').startswith('urbanized-area mean over this county')) else 1)" 2>/dev/null && continue
  [ -f /home/user/w5/county_sites/sites_$F.json ] || [ -f /home/user/w5/sd_data/sites_$F.json ] || continue
  mkdir /home/user/national/logs/locks/$F 2>/dev/null || continue   # another worker has (or had) this county in this pass
  LOG=/home/user/national/logs/rebuild5_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG && [ "${F:0:2}" = "06" ] && [ "$F" != "06073" ] && [ "$F" != "06065" ] && [ "$F" != "06111" ] && [ "$F" != "06071" ]; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(grep -c '' $LOG) $(tail -1 $LOG)" >> /home/user/national/logs/rebundle.log
done
echo "REBUNDLE PASS DONE ($ORDER)" >> /home/user/national/logs/rebundle.log
