#!/bin/bash
cd /home/user/national
until [ $(grep -c "REBUNDLE6 PASS DONE" logs/rebundle6.log 2>/dev/null || echo 0) -ge 2 ]; do sleep 60; done
nohup ./resites_pass2.sh forward > /dev/null 2>&1 &
sleep 5
nohup ./resites_pass2.sh reverse > /dev/null 2>&1 &
