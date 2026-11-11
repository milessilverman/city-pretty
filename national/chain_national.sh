#!/bin/bash
# After US batch 1: batch 3 (largest counties in the states cut by osm_split.py), then batch 2 (more counties in the ten states)
cd /home/user/national
until grep -q "ALL DONE" logs/us_batch.log; do sleep 60; done
./queue_worker.sh national us_queue3.txt us_queue2.txt
