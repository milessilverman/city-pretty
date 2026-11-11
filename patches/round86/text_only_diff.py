"""Compare two bundles built from the same county data (new text vs old text): every number must be equal; list the changed strings.
usage: python3 text_only_diff.py <old bundle-oc.json> <new bundle-oc.json>"""
import json, sys, re, collections
a, b = (json.load(open(p)) for p in sys.argv[1:3])
nums, types, keys, lens = [], [], [], []
txt = collections.Counter(); ex = collections.defaultdict(list)
def walk(x, y, path):
    if isinstance(x, bool) or isinstance(y, bool) or x is None or y is None:
        if x != y:   # a value appearing, disappearing or flipping counts as a number change
            nums.append((path, x, y))
        return
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        if x != y:
            nums.append((path, x, y))
        return
    if type(x) != type(y):
        types.append((path, str(x)[:60], str(y)[:60])); return
    if isinstance(x, dict):
        for k in set(x) | set(y):
            if k not in x or k not in y:
                keys.append(path + "." + str(k))
            else:
                walk(x[k], y[k], path + "." + (k if re.fullmatch(r"[a-z_]{1,14}", str(k)) else "K"))
    elif isinstance(x, list):
        if len(x) != len(y):
            lens.append((path, len(x), len(y)))
        for p_, q_ in zip(x, y):
            walk(p_, q_, path + "[]")
    elif x != y:
        k = re.sub(r"\[\]", "", path)
        txt[k] += 1
        if len(ex[k]) < 2:
            ex[k].append((str(x)[:170], str(y)[:170]))
walk(a, b, "")
print(f"numbers changed: {len(nums)}; types changed: {len(types)}; keys added/removed: {len(keys)}; list lengths changed: {len(lens)}")
for t in (nums[:8] + types[:4] + keys[:6] + lens[:6]):
    print("  !!", t)
print(f"strings changed at {len(txt)} paths:")
for k, v in txt.most_common(40):
    print(f"  {v:5d} {k}")
    for o, n in ex[k]:
        print("        -", o); print("        +", n)
