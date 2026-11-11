#!/bin/bash
# Second national worker, started once the OSM state splits are done (memory): batch 3 in priority order (states with crash records
# first, then by population), then batch 2. Shares the county locks with the first worker.
cd /home/user/national
until grep -q "ALL SPLITS DONE" logs/osm_split_all.log; do sleep 60; done
./queue_worker.sh national2 us_queue3b.txt us_queue2.txt
