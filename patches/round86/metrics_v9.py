"""Round 8.6: metrics_oc v9 (patches the file given as argv[1] in place; the install wrapper backs it up first). No data change:
a missing or unreadable pipeline/stations_not_served.json stops the build instead of reading as an empty list, which would silently
bring back the stations of the lines it lists (round-8.5 audit, code finding 5)."""
import sys, py_compile, os
p = sys.argv[1]; s = open(p).read()
old = '''    try:
        return json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "stations_not_served.json")))
    except (OSError, ValueError):
        return []'''
new = '''    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stations_not_served.json")
    try:
        d = json.load(open(p))
    except (OSError, ValueError) as e:   # v9: stop, rather than silently keep the lines' stations (round-8.5 audit)
        raise SystemExit(f"metrics_oc: {p} is missing or not valid JSON ({e!r}); it lists the lines whose stations are not kept (v8)")
    if not isinstance(d, list):
        raise SystemExit(f"metrics_oc: {p} must hold a list of lines")
    return d'''
if s.count(old) != 1: sys.exit(f"{s.count(old)} matches for the v8 loader")
s = s.replace(old, new)
tmp = p + ".tmp86"; open(tmp, "w").write(s); py_compile.compile(tmp, doraise=True); os.replace(tmp, p); print("metrics_oc v9 written to", p)
