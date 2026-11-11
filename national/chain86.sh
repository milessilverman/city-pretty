#!/bin/bash
# Round 8.6 after the round-8.5 audit: install selection 20 (install86.sh), seed cache/calitp with the zips the scratch tests built from
# the same 1 Oct 2026 snapshot, re-run every county (rebundle86a.sh, four workers), then the weekday audit over all counties.
# log: logs/rebundle86a.log (and logs/chain86.log)
set -e
N=/home/user/national; L=$N/logs/chain86.log
echo "$(date +%T) chain86 start" >> $L
$N/install86.sh >> $L 2>&1
mkdir -p $N/cache/calitp
for f in /tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/sel20test/cache/calitp/*-2026-10-01.zip; do
  [ -f "$N/cache/calitp/$(basename $f)" ] || cp -p "$f" $N/cache/calitp/
done
echo "$(date +%T) cache/calitp seeded: $(ls $N/cache/calitp | wc -l) files" >> $L
mkdir -p $N/logs/r85_snapshot   # the round-8.5 state of every county's transit meta and station decisions, for the round-8.6 diffs
for d in $N/pipeline/data_*/; do F=$(basename $d | cut -d_ -f2)
  for x in transit_stops_7_9.meta.json rail_confirm.json; do if [ -f $d$x ]; then cp -p $d$x $N/logs/r85_snapshot/${F}_$x; fi; done
done
echo "$(date +%T) round-8.5 snapshot: $(ls $N/logs/r85_snapshot | wc -l) files" >> $L
cd $N && ./rebundle86a.sh
cd $N; echo "$(date +%T) re-run done; weekday audit (round-8.5 outputs kept as logs/r85_transit_day_audit.*)" >> $L
for x in transit_day_audit.json transit_day_audit.md transit_day_audit.log transit_day_audit_queue.txt; do if [ -f logs/$x ]; then cp -p logs/$x logs/r85_$x; fi; done
python3 -I transit_day_audit.py 2 --all > logs/transit_day_audit86.out 2>&1 || echo "$(date +%T) weekday audit exit $?" >> $L
echo "$(date +%T) CHAIN86 DONE" >> $L
