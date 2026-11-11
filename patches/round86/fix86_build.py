"""build_oc text fixes that go with the round-8.6 data fixes (numbers lens). Applied after build86_language.py. Display text only:
canopy gaps are rounded, not truncated (int() printed 9.9 as 9), with one decimal under 10 points or where both would print alike;
a crime gap in a block group that takes the sheriff's rate says which area that rate covers.   usage: fix86_build.py <build_oc.py>"""
import sys
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


rep('''    if key == "tg":
        return f"{int(v)} pt{'' if int(v) == 1 else 's'} below goal"''', '''    if key == "tg":
        t = _pt(v)
        return f"{t} pt below goal" if t == "1" else f"{t} pts below goal"''')
rep('''def _mi(x, p):''', '''def _pt(v):
    """canopy gap in points: rounded half up (int() used to truncate 9.9 to 9); one decimal under 9.95"""
    return f"{v:.1f}" if v < 9.95 else str(int(v + 0.5))


def _pts(x, p):
    """two canopy gaps, or both with one decimal where they would print alike (a gap needs a 10% difference)"""
    a, b = _pt(x), _pt(p)
    return (a, b) if a != b else (f"{x:.1f}", f"{p:.1f}")


def _canopy_why(x, p):
    a, b = _pts(x, p)
    return f"Tree canopy is {a} {'point' if a == '1' else 'points'} below the Tree Equity goal (similar neighborhoods: {b})."


def _mi(x, p):''')
rep('''"canopy": lambda x, p: f"Tree canopy is {_count(int(x), 'point')} below the Tree Equity goal (similar neighborhoods: {int(p)}).",''',
    '''"canopy": _canopy_why,''')
rep('''                G.append([gk, fmt_gap(mk, x), fmt_gap(mk, med), round(float(worse), 2), fix, WHY[gk](x, med), cost])''',
    '''                why = WHY[gk](x, med)
                if gk in ("violent", "property") and "sheriff polices: " in (m.get("ag") or ""):   # round 8.6: the rate is the sheriff's, not this place's own
                    why = why.replace(" (similar neighborhoods: ", f" (the sheriff's rate for {m['ag'].split('sheriff polices: ', 1)[1].split(';', 1)[0]}; similar neighborhoods: ", 1)
                G.append([gk, fmt_gap(mk, x), fmt_gap(mk, med), round(float(worse), 2), fix, why, cost])''')
open(p, "w").write(s)
print("build_oc canopy and sheriff text applied:", p)
