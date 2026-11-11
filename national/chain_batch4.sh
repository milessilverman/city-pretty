#!/bin/bash
# Batch 4: after batch 2's two queue workers finish, queue the next 100 largest counties not built yet (any state with an OpenStreetMap
# file) and build them with two workers. They use transit selection 7 (fetch_oc.py) from the start.   log: logs/batch4.log
cd /home/user/national
while pgrep -f "queue_worker.sh national" > /dev/null; do sleep 120; done
python3 make_queue.py us_queue4.txt --top 100 >> logs/batch4.log 2>&1
echo "$(date +%T) batch 4 queue written: $(wc -l < us_queue4.txt) counties" >> logs/batch4.log
nohup ./queue_worker.sh batch4a us_queue4.txt > /dev/null 2>&1 &
sleep 30
nohup ./queue_worker.sh batch4b us_queue4.txt > /dev/null 2>&1 &
echo "$(date +%T) batch 4 workers started" >> logs/batch4.log
