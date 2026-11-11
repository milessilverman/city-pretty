#!/bin/bash
cd /home/user/national
until grep -q "REBUNDLE PASS DONE (forward)" logs/rebundle.log && grep -q "REBUNDLE PASS DONE (reverse)" logs/rebundle.log; do sleep 30; done
echo "--- resites pass start $(date +%T)" >> logs/resites_pass.log
./resites_pass.sh forward & ./resites_pass.sh reverse & wait
