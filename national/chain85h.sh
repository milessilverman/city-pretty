#!/bin/bash
# after rebundle85e: install transit selection 19, re-run CamTran's three counties (rebundle85h), then start the round-8.5 finish
N=/home/user/national
until grep -q "REBUNDLE85E DONE" $N/logs/rebundle85e.log 2>/dev/null; do sleep 30; done
python3 /tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/edit85/sel19.py >> $N/logs/rebundle85h.log 2>&1 || { echo "$(date +%T) selection 19 install FAILED" >> $N/logs/rebundle85h.log; exit 1; }
echo "$(date +%T) transit selection 19 installed (fetch_oc.py; previous: pipeline/backups_fetch_oc_sel18.py): MobilityData's 'future' rows are candidates" >> $N/logs/rebundle84.notes
cd $N && ./rebundle85h.sh
cd /home/user/w5 && nohup ./round85_finish.sh > /dev/null 2>&1 &
