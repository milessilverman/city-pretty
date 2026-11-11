#!/bin/bash
# Round 8.6 after selection 21 (install86c.sh) replaced chain86.sh's last steps: when rebundle86a ends, the selection-21 pass
# (rebundle86b.sh, four workers), then three more batch-7 workers, and when batch 7 is done the weekday audit over every county
# (round-8.5 outputs kept as logs/r85_transit_day_audit.*).   log: logs/chain86.log
N=/home/user/national; L=$N/logs/chain86.log
echo "$(date +%T) chain86b start (waits for rebundle86a)" >> $L
until grep -q "REBUNDLE86A DONE" $N/logs/rebundle86a.log; do sleep 60; done
echo "$(date +%T) rebundle86a done: $(grep -c 'EXIT 0 |' $N/logs/rebundle86a.log) exit 0; selection-21 pass" >> $L
cd $N && ./rebundle86b.sh
echo "$(date +%T) rebundle86b done: $(grep -c 'EXIT 0 |' $N/logs/rebundle86b.log) exit 0 of $(wc -l < $N/logs/rebundle86b_queue.txt); three more batch-7 workers" >> $L
cd $N
for w in batch7b batch7c batch7d; do nohup ./queue_worker.sh $w us_queue7.txt > /dev/null 2>&1 & sleep 30; done
until [ "$(cat logs/batch7a.log logs/batch7b.log logs/batch7c.log logs/batch7d.log 2>/dev/null | grep -c 'ALL DONE us_queue7.txt')" -ge 4 ]; do sleep 120; done
echo "$(date +%T) batch 7 done; weekday audit" >> $L
for x in transit_day_audit.json transit_day_audit.md transit_day_audit.log transit_day_audit_queue.txt; do if [ -f logs/$x ] && [ ! -f logs/r85_$x ]; then cp -p logs/$x logs/r85_$x; fi; done
python3 -I transit_day_audit.py 2 --all > logs/transit_day_audit86.out 2>&1 || echo "$(date +%T) weekday audit exit $?" >> $L
echo "$(date +%T) CHAIN86B DONE" >> $L
