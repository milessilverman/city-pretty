"""Summarise the regional pages: size, SHA-256 prefix, counties and test results (regions/<name>/tests.json) as a Markdown table."""
import json, os, hashlib, re
W5 = "/home/user/w5"
R = json.load(open(f"{W5}/regions.json")); C = json.load(open("/home/user/national/data/counties.json"))
rows = ["| Page | Counties (besides LA + Orange) | Size | SHA-256 | Tests |", "|---|---|---|---|---|"]
for name, fl in R.items():
    d = f"{W5}/regions/{name}"; page = f"{d}/city-pretty-{name}.html"; tp = f"{d}/tests.json"
    if not os.path.exists(page):
        rows.append(f"| {name} | – | not built | – | – |"); continue
    sha = hashlib.sha256(open(page, "rb").read()).hexdigest()[:12]
    t = json.load(open(tp)) if os.path.exists(tp) else {}
    passed = total = 0; fails = []
    for k, v in t.items():
        lines = v if isinstance(v, list) else [v]
        for l in lines:
            m = re.search(r"(\d+)/(\d+) checks passed", l or "")
            if m: passed += int(m.group(1)); total += int(m.group(2))
            if (l or "").strip().startswith("FAIL"): fails.append(f"{k}: {l.strip()[:80]}")
    names = ", ".join(C[f]["name"].replace(" County", "") for f in fl)
    rows.append(f"| `city-pretty-{name}.html` | {names} | {os.path.getsize(page) / 1e6:.1f} MB | {sha} | {passed}/{total}" + (f" ({len(fails)} failing: {'; '.join(fails)[:200]})" if fails else "") + " |")
print("\n".join(rows))
