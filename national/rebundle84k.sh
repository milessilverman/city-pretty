#!/bin/bash
# Round 8.4: transit selections 14 and 15 (14 installed 06:30, 15 at 06:42 with metrics_oc v3: rail stops named by their station, platforms
# grouped, non-passenger stops left out; full weekday service = the highest 07:00-09:00 count two candidate Wednesdays reach within
# 10%, the day the nearest within 10% of it; a feed with no Wednesday near today is judged on its own last three weeks). Once the
# selection-12 pass and batch 5 have ended (both use selection 14 for every build started after the install), transit_day_audit.py
# re-reads every feed of the counties built before selection 14 and lists those where some feed's selection-14 day runs other services
# than the recorded one (logs/transit_day_audit_queue.txt); they are re-run here. Three workers.  log: logs/rebundle84k.log
cd /home/user/national
until grep -q "REBUNDLE84J DONE" logs/rebundle84j.log 2>/dev/null && grep -q "ALL DONE us_queue5.txt" logs/batch5a.log 2>/dev/null; do sleep 30; done
echo "$(date +%T) audit started" >> logs/rebundle84k.log
( cd /tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad && nice -n 5 python3 -I /home/user/national/transit_day_audit.py 3 ) > logs/transit_day_audit.log 2>&1
grep -q "| queue:" logs/transit_day_audit.log || { echo "$(date +%T) AUDIT FAILED" >> logs/rebundle84k.log; exit 1; }
# the queue: the audit's list, the counties whose rail stations change with selection 15 (rail15_sim.py: logs/rail15_queue.txt), and the
# counties built with selection 14 that have rail stops (built between the two installs, after the simulation read the files); each only
# while it is still built with an earlier selection
python3 /home/user/national/rebundle84k_queue.py >> logs/rebundle84k.log
cd pipeline; mkdir -p /home/user/national/logs/locks14k
worker() {
for F in $(cat /home/user/national/logs/rebundle84k_queue.txt); do
  mkdir /home/user/national/logs/locks14k/$F 2>/dev/null || continue
  D=data_$F; LOG=/home/user/national/logs/rebuild14k_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84k.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE84K DONE" >> /home/user/national/logs/rebundle84k.log
