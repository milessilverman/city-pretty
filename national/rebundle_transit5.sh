#!/bin/bash
# Transit selection 5 (MobilityData's hosted copies first, every catalog redirect followed, a feed counted once): re-bundle built counties.
# Refetches what cleanup removed (+ GTFS), then osm_extract, metrics, layers, bundle; site suggestions do not depend on transit and are
# kept. Priority counties first (transit_priority4.txt), then every other built county. Orange County keeps OCTA. Several workers can
# run (locks in logs/locks5).   usage: rebundle_transit5.sh [forward|reverse]      log: logs/rebundle5.log
cd /home/user/national/pipeline
ORDER=${1:-forward}; mkdir -p /home/user/national/logs/locks5
ALL=$(ls -d data_* | sed 's/data_//' | sort); [ "$ORDER" = "reverse" ] && ALL=$(echo "$ALL" | tac)
for F in $(cat /home/user/national/transit_priority4.txt) $ALL; do
  D=data_$F; [ -d $D ] || continue; [ "$F" = "06059" ] && continue
  [ -f $D/metrics.json ] || continue
  python3 -c "import json,sys;c=(json.load(open('$D/metrics.json')).get('coverage',{}).get('transit') or {});sys.exit(0 if (c.get('selection') or 0)>=5 else 1)" 2>/dev/null && continue
  [ -f /home/user/w5/county_sites/sites_$F.json ] || [ -f /home/user/w5/sd_data/sites_$F.json ] || continue   # still being built
  [ -d /home/user/national/logs/build_locks/$F ] && ! grep -q "DONE $F" /home/user/national/logs/build_$F.log 2>/dev/null && continue
  mkdir /home/user/national/logs/locks5/$F 2>/dev/null || continue
  LOG=/home/user/national/logs/rebuild7_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(grep -m1 'transit (MobilityData)' $LOG | sed 's/.*transit/transit/') | $(tail -1 $LOG)" >> /home/user/national/logs/rebundle5.log
done
echo "REBUNDLE5 PASS DONE ($ORDER)" >> /home/user/national/logs/rebundle5.log
