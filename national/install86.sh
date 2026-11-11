#!/bin/bash
# Round 8.6: install transit selection 20 (fetch_oc.py), the transit sources-row text (build_oc.py) and the weekday audit's selection-20
# mode (transit_day_audit.py), each backed up first; patches in the session scratchpad (edit86/). Run only after the round-8.5 audit.
set -e
N=/home/user/national; E=/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/edit86
cp -p $N/pipeline/fetch_oc.py $N/pipeline/backups_fetch_oc_sel19.py
cp -p $N/pipeline/build_oc.py $N/backups_build_oc_pre86.py
python3 -I $E/sel20_fetch.py $N/pipeline/fetch_oc.py
python3 -I $E/sel20_build.py $N/pipeline/build_oc.py
python3 -I $E/audit20.py
cp -p $N/pipeline/metrics_oc.py $N/pipeline/backups_metrics_oc_v8.py
python3 -I $E/metrics_v9.py $N/pipeline/metrics_oc.py
cp -p $N/pipeline/metrics_oc.py $N/pipeline/metrics_oc_v9.py
grep -q "^GTFS_SELECTION = 20" $N/pipeline/fetch_oc.py
cp -p $N/pipeline/fetch_oc.py $N/pipeline/fetch_oc_sel20.py
echo "$(date +%T) transit selection 20 installed (fetch_oc.py = fetch_oc_sel20.py; previous: pipeline/backups_fetch_oc_sel19.py): an ended copy is not final (other copies, then in California the Cal-ITP statewide tables on data.ca.gov, the newest used; meta schedule_ended, copies_read, calitp); a departure is a stop time where a rider can board (not a trip's last stop, not pickup_type 1); headway stops only with departures 07:00-09:00. build_oc.py (previous: backups_build_oc_pre86.py): sources row names the copy read and an ended schedule, drops 'Not included' entries of feeds counted from another copy, and states the departure rule. transit_day_audit.py (previous: transit_day_audit_sel19.py): CUR = 20, --all, Cal-ITP copies read from cache/calitp. metrics_oc v9 (metrics_oc.py = metrics_oc_v9.py; previous: backups_metrics_oc_v8.py), no data change: a missing or unreadable stations_not_served.json stops the build (round-8.5 audit)." >> $N/logs/rebundle84.notes
echo "installed"
