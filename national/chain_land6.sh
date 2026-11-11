#!/bin/bash
# start the land-shape pass (two workers) once both transit-5 workers have finished
cd /home/user/national
until [ $(grep -c "REBUNDLE5 PASS DONE" logs/rebundle5.log 2>/dev/null || echo 0) -ge 2 ]; do sleep 60; done
nohup ./rebundle_land6.sh forward > /dev/null 2>&1 &
sleep 5
nohup ./rebundle_land6.sh reverse > /dev/null 2>&1 &
