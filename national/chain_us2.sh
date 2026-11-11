#!/bin/bash
cd /home/user/national
until grep -q "ALL DONE" logs/us_batch.log; do sleep 60; done
./build_batch.sh us_queue2.txt us_batch2
