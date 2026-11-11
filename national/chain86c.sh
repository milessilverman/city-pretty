#!/bin/bash
# Round 8.6: chain86b.sh resumed after the 05:08 reboot (rebundle86a had finished at 02:38; rebundle86b was still waiting for
# logs/release86b.flag). Same remaining steps: rebundle86b (held until the flag), three more batch-7 workers, the weekday audit,
# then "CHAIN86B DONE" (round86_launch.sh waits for that line).   log: logs/chain86.log
N=/home/user/national; L=$N/logs/chain86.log
echo "$(date +%T) chain86c start after the reboot (rebundle86b holds until logs/release86b.flag)" >> $L
cd $N && ./rebundle86b.sh
echo "$(date +%T) rebundle86b done: $(grep -c 'EXIT 0 |' $N/logs/rebundle86b.log) exit 0 of $(wc -l < $N/logs/rebundle86b_queue.txt); three more batch-7 workers" >> $L
cd $N
for w in batch7b batch7c batch7d; do nohup ./queue_worker.sh $w us_queue7.txt > /dev/null 2>&1 & sleep 30; done
until [ "$(cat logs/batch7a.log logs/batch7b.log logs/batch7c.log logs/batch7d.log 2>/dev/null | grep -c 'ALL DONE us_queue7.txt')" -ge 4 ]; do sleep 120; done
echo "$(date +%T) batch 7 done; weekday audit" >> $L
for x in transit_day_audit.json transit_day_audit.md transit_day_audit.log transit_day_audit_queue.txt; do if [ -f logs/$x ] && [ ! -f logs/r85_$x ]; then cp -p logs/$x logs/r85_$x; fi; done
python3 -I transit_day_audit.py 2 --all > logs/transit_day_audit86.out 2>&1 || echo "$(date +%T) weekday audit exit $?" >> $L
echo "$(date +%T) CHAIN86B DONE" >> $L
