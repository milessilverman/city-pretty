"""engine.py display text only (rationale strings beside each project): singular forms. Scoring is untouched.
usage: python3 engine86_plural.py <engine.py>"""
import sys
p = sys.argv[1]; s = open(p).read()
R = [('{int(bt)} buses an hour', "{int(bt)} {'bus' if int(bt) == 1 else 'buses'} an hour", 7),
     ('{int(crashes)} pedestrian/bike crashes', "{int(crashes)} pedestrian/bike {'crash' if int(crashes) == 1 else 'crashes'}", 3),
     ('{int(crashes)} pedestrian or bike crashes', "{int(crashes)} pedestrian or bike {'crash' if int(crashes) == 1 else 'crashes'}", 2),
     ('f"{int(din)} cafés within 400 m and the nearest grocery', "f\"{int(din)} {'café' if int(din) == 1 else 'cafés'} within 400 m and the nearest grocery", 1)]
for old, new, n in R:
    c = s.count(old)
    assert c == n, (old, c, n)
    s = s.replace(old, new)
open(p, "w").write(s); print("engine text patched:", [(o[:30], n) for o, _, n in R])
