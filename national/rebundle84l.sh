#!/bin/bash
# Round 8.4: transit selection 16 (07:01; a schedule ends on its last date with bus trips, a stale feed is judged around its last Wednesday
# with morning departures, a current calendar with no service near today has no buses). After rebundle84k.sh and its fourth worker end,
# re-run the counties of transit_day_audit.py's selection-16 list (logs/transit_day_audit_queue.txt, run at 07:02 on every county) that are
# still built with an earlier selection. Four workers.  log: logs/rebundle84l.log
cd /home/user/national
until grep -q "REBUNDLE84K DONE" logs/rebundle84k.log 2>/dev/null && grep -q "REBUNDLE84K W4 DONE" logs/rebundle84k.log 2>/dev/null && grep -q "| queue:" logs/transit_day_audit.log 2>/dev/null; do sleep 30; done
: > logs/rebundle84l_queue.txt
for F in $(cat logs/transit_day_audit_queue.txt); do
  python3 -c "import json,sys;sys.exit(json.load(open('pipeline/data_$F/transit_stops_7_9.meta.json')).get('selection',0)>=16)" && echo $F >> logs/rebundle84l_queue.txt
done
echo "$(date +%T) $(wc -l < logs/rebundle84l_queue.txt) counties queued ($(wc -l < logs/transit_day_audit_queue.txt) in the audit's list): $(tail -1 logs/transit_day_audit.log)" >> logs/rebundle84l.log
cd pipeline; mkdir -p /home/user/national/logs/locks16l
worker() {
for F in $(cat /home/user/national/logs/rebundle84l_queue.txt); do
  mkdir /home/user/national/logs/locks16l/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild16l_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84l.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!; sleep 10; worker & D2=$!
wait $A $B $C $D2
echo "$(date +%T) REBUNDLE84L DONE" >> /home/user/national/logs/rebundle84l.log
