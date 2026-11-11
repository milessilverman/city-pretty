#!/bin/bash
# Round 8.6: install transit selection 21 (text only: measurements unchanged) and build_oc's singular forms ("1 feed", "1 bus/hr") while
# rebundle86a runs. fetch_oc.py and build_oc.py are
# replaced by rename, so a worker starting a step reads the old file or the new one, never part of one. A county whose meta still says
# selection 20 afterwards is re-run by rebundle86b.sh.   log: logs/rebundle84.notes
set -e
N=/home/user/national; P=$N/pipeline; E=/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/edit86
cd $P
cp -p fetch_oc.py backups_fetch_oc_sel20.py
cp -p build_oc.py $N/backups_build_oc_pre86c.py
cp fetch_oc.py .fetch_oc.sel21.tmp; python3 $E/sel21_fetch.py .fetch_oc.sel21.tmp
cp build_oc.py .build_oc.sel21.tmp; python3 $E/sel21_build.py .build_oc.sel21.tmp; python3 $E/apply_pairs.py $E/sel21_plural.txt .build_oc.sel21.tmp
python3 -c "import ast,sys; [ast.parse(open(f).read()) for f in sys.argv[1:]]; print('both parse')" .fetch_oc.sel21.tmp .build_oc.sel21.tmp
mv -f .fetch_oc.sel21.tmp fetch_oc.py
mv -f .build_oc.sel21.tmp build_oc.py
cp -p fetch_oc.py fetch_oc_sel21.py
echo "$(date +%T) installed selection 21: fetch_oc.py (backup pipeline/backups_fetch_oc_sel20.py) and build_oc.py (backup backups_build_oc_pre86c.py)"
