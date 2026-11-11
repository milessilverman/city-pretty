"""fetch_oc selection 24 (round 8.6, 9 Nov): no rule changes. The cloud environment's network was opened to every host at the owner's
request; until then 213 operator feed URLs on 93 hosts were refused (logs/r86_transit_gaps.md), and 83 of them now answer. Raising the
selection makes every county's transit step run again, so those feeds are tried where MobilityData's copies are stale or missing.
usage: sel24_fetch.py <fetch_oc.py>"""
import sys, re
p = sys.argv[1]; s = open(p).read()
old = "GTFS_SELECTION = 23   # 23 (round 8.6):"
assert s.count(old) == 1, s.count(old)
s = s.replace(old, """GTFS_SELECTION = 24   # 24 (round 8.6, 9 Nov): no rule change; the environment's network was opened to every host, so the operator feed URLs
#   it refused before (213 URLs on 93 hosts; 83 answered on 9 Nov, e.g. ACTS for Calhoun AL, which counted only Gadsden's feed) are tried in
#   every county again.
# 23 (round 8.6):""")
open(p, "w").write(s); print("selection 24:", p)
