#!/bin/bash
# Round 8.6: publish site86 to GitHub Pages, split over two repositories (build_site.py --split): site86/city-pretty -> milessilverman/city-pretty
# and site86/city-pretty-data -> milessilverman/city-pretty-data. Run only after the owner has created city-pretty-data (and switched its
# Pages on) and chosen how to treat history:
#   fresh : each repository gets one new history (a root commit, then the county files in parts); city-pretty is force-pushed, replacing
#           round 8.5's commits (the owner must agree: it rewrites the repository's history)
#   keep  : city-pretty gets commits on top of round 8.5's (the repository grows by ~0.9 GB); city-pretty-data starts its own history
# Files are hard links into site86, so the working trees cost no disk; git's objects do (~1.2 GB). Pushes go in parts of ~250 files.
# usage: ./publish86.sh fresh|keep        log: logs/publish86.log
set -e
MODE=$1; N=/home/user/national; S=$N/site86; W5=/home/user/w5; G=/home/user/gh86; L=$N/logs/publish86.log
[ "$MODE" = fresh ] || [ "$MODE" = keep ] || { echo "usage: publish86.sh fresh|keep"; exit 2; }
[ -f $S/city-pretty/index.html ] && [ -d $S/city-pretty-data/counties ] || { echo "site86 is not built"; exit 1; }
[ "$(df --output=avail -k /home/user | tail -1)" -gt 1600000 ] || { echo "need 1.6 GB free for git objects"; exit 1; }
echo "$(date +%T) publish86 $MODE" >> $L
gitc() { git -c user.name=Claude -c user.email=noreply@anthropic.com "$@"; }
TRAILER="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Trq9XRdQZM6U4HLYvibYPR"
push_parts() {   # commit the untracked/changed files under counties/ in parts and push each part
  local repo=$1 label=$2; local files; files=$(git status --porcelain counties | awk '{print $2}' | sort)
  local n; n=$(echo "$files" | grep -c . || true); local i=0 part=0 parts=$(( (n + 249) / 250 ))
  echo "$files" | split -l 250 - /tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/pub86_part_
  for f in /tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/pub86_part_*; do
    part=$((part + 1)); xargs git add -A -- < $f
    gitc commit -q -m "$label county files, part $part of $parts ($(wc -l < $f) files, $(head -1 $f | sed 's/.*_//;s/.json.gz//') to $(tail -1 $f | sed 's/.*_//;s/.json.gz//'))" -m "$TRAILER"
    for t in 1 2 3 4 5; do git push -u origin main >> $L 2>&1 && break; sleep $((2 ** t)); done
    rm -f $f
  done
}
mkdir -p $G
# ---- city-pretty (page, docs, manifest, first share of the counties)
if [ "$MODE" = fresh ]; then
  rm -rf "${G:?}/city-pretty"; mkdir -p $G/city-pretty; cd $G/city-pretty
  git init -q -b main; git remote add origin https://github.com/milessilverman/city-pretty
else
  cd /home/user/city-pretty; git pull -q origin main
  git ls-files counties | while read f; do [ -f "$S/city-pretty/$f" ] || git rm -q "$f"; done   # counties moved to city-pretty-data
fi
cp -al --remove-destination $S/city-pretty/. .
cp $W5/round86/README_main86.md README.md; touch .nojekyll; mkdir -p docs; cp $W5/round86/docs86/* docs/
git add index.html README.md .nojekyll docs counties/manifest.json
gitc commit -q -m "Round 8.6: page, documents and county list" -m "$TRAILER"
if [ "$MODE" = fresh ]; then git push --force -u origin main >> $L 2>&1; else git push -u origin main >> $L 2>&1; fi
push_parts city-pretty "Round 8.6"
echo "$(date +%T) city-pretty pushed: $(git rev-parse --short HEAD)" >> $L
# ---- city-pretty-data (the rest of the counties)
rm -rf "${G:?}/city-pretty-data"; mkdir -p $G/city-pretty-data; cd $G/city-pretty-data
git init -q -b main; git remote add origin https://github.com/milessilverman/city-pretty-data
cp -al $S/city-pretty-data/. .; cp $W5/round86/README_city-pretty-data.md README.md; touch .nojekyll
git add README.md .nojekyll; gitc commit -q -m "City Pretty county data, part 2: README" -m "$TRAILER"
git push -u origin main >> $L 2>&1
push_parts city-pretty-data "Round 8.6"
echo "$(date +%T) city-pretty-data pushed: $(git rev-parse --short HEAD); PUBLISH86 DONE" >> $L
