#!/bin/bash
# Waits for chain86b.sh to finish, then runs round86_finish.sh (read only then, so it can be edited until that moment).
until grep -q "CHAIN86B DONE" /home/user/national/logs/chain86.log 2>/dev/null; do sleep 60; done
cd /home/user/w5 && exec ./round86_finish.sh
