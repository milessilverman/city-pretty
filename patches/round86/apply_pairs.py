"""apply @@OLD/@@NEW/@@END replacement pairs from a text file to a source file; each OLD must occur exactly once
usage: python3 apply_pairs.py <pairs.txt> <file>"""
import sys
pairs_p, p = sys.argv[1:3]
txt = open(pairs_p).read()
blocks = txt.split("@@OLD\n")[1:]
s = open(p).read()
for b in blocks:
    old, rest = b.split("@@NEW\n", 1)
    new = rest.split("@@OLD\n")[0].split("@@END")[0]
    old, new = old[:-1], new[:-1]   # drop the newline before the next marker
    c = s.count(old)
    assert c == 1, (c, old[:90])
    s = s.replace(old, new)
open(p, "w").write(s)
print(len(blocks), "pairs applied to", p)
