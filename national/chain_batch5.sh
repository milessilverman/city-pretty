#!/bin/bash
# Batch 5: once round 8.3's pages and national site are built (so the builds don't compete), queue the next 150 largest counties not
# built yet and build them with two workers. They use transit selection 8 and the round-8.3 rail-station rule from the start.
# log: logs/batch5.log
cd /home/user/national
until grep -qE "ROUND 8.3 READY|ROUND 8.3 STOPPED" /home/user/w5/regions_build.log; do sleep 120; done
python3 make_queue.py us_queue5.txt --top 150 >> logs/batch5.log 2>&1
echo "$(date +%T) batch 5 queue written: $(wc -l < us_queue5.txt) counties" >> logs/batch5.log
nohup ./queue_worker.sh batch5a us_queue5.txt > /dev/null 2>&1 &
sleep 30
nohup ./queue_worker.sh batch5b us_queue5.txt > /dev/null 2>&1 &
echo "$(date +%T) batch 5 workers started" >> logs/batch5.log
