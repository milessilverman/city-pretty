#!/bin/bash
# Round 8.4, after every re-bundle (rebundle84.log and the re-run passes 84b-84e) has finished: remove site suggestions anchored on a
# dropped station, list the station decisions, compare stations and bus frequency with the round-8.3 national site, refresh the quality
# table. Then read logs/station84_review.md and, if right, touch logs/station84_reviewed (round84_finish.sh waits for it).
cd /home/user/national
L="logs/rebundle84.log logs/rebundle84b.log logs/rebundle84c.log logs/rebundle84d.log logs/rebundle84e.log logs/rebundle84f.log logs/rebundle84g.log logs/rebundle84h.log logs/rebundle84i.log logs/rebundle84j.log logs/rebundle84k.log logs/rebundle84l.log"
python3 /home/user/w5/tools/sites_drop_stations.py > logs/sites_drop_stations.out 2>&1; tail -1 logs/sites_drop_stations.out
python3 station84_review.py
python3 station_effect.py site83 $L > logs/station_effect84_table.md 2>&1; tail -1 logs/station_effect84_table.md
python3 transit7_effect.py site83 $L > logs/transit84_effect_table.md 2>&1; tail -1 logs/transit84_effect_table.md
python3 quality.py > /dev/null 2>&1; head -3 logs/quality.md
