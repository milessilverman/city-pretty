#!/usr/bin/env python3
"""Fetch Amtrak's FY25 year-end route ridership fact sheet (media.amtrak.com) and write
data/transit/amtrak_route_ridership_fy25.csv. Ridership only: the sheet has no route revenue or operating expense, and
amtrak.com (monthly performance reports) is not reachable from this machine, so those are recorded as not obtained.
Needs pdftotext (poppler). Checks that route rows add up to the sheet's own subtotals and total.
Usage: python3 scripts/transit/fetch_amtrak_routes.py
"""
import csv, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _socrata as s

URL = "https://media.amtrak.com/wp-content/uploads/2025/11/FY25-Year-End-Ridership-Fact-Sheet.pdf"
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "data", "transit", "amtrak_route_ridership_fy25.csv")
LINE = re.compile(r"^\s*(?P<name>[A-Za-z][A-Za-z0-9 /&\-\.\*]+?)\s{2,}(?:(?P<st>[A-Z]{2}(?:/[A-Z]{2})*)\s+)?(?P<a>[\d,]+|-)\s+(?P<b>[\d,]+|-)\s+(?P<c>[+-][\d.]+|N/A|-)\s*$")
SECTIONS = {"NEC Spine": "NEC Spine", "State Supported": "State Supported", "Long Distance": "Long Distance"}


def n(x):
    return "" if x == "-" else int(x.replace(",", ""))


def main():
    with tempfile.TemporaryDirectory() as d:
        pdf = os.path.join(d, "a.pdf")
        open(pdf, "wb").write(s.get(URL))
        txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    section, sub, rows, subtotals, total = "NEC Spine", "", [], {}, None
    for ln in txt.splitlines():
        t = ln.strip()
        hit = [v for k, v in SECTIONS.items() if t == k or t.startswith(k + " ")]
        if hit and "  " not in t.replace("by state(s)", "").strip():
            section, sub = hit[0], ""
            continue
        if t in ("Northeast Routes", "Southern Routes", "Midwest Routes", "Western Routes", "Buses & Special Trains", "Southeast Routes", "Central Routes", "Southwest Routes"):
            sub = t
            continue
        m = LINE.match(ln)
        if not m:
            continue
        name = m["name"].strip()
        if name == "Subtotal":
            subtotals[section] = n(m["a"])
            continue
        if name == "Amtrak Total":
            total = n(m["a"])
            continue
        rows.append(dict(group=section, subgroup=sub, route=name.rstrip("*"), states=m["st"] or "", fy25_ridership=n(m["a"]), fy24_ridership=n(m["b"]),
                         pct_change_as_published=m["c"], source_url=URL, fiscal_year_note="Amtrak fiscal year 2025 (Oct 2024 - Sep 2025); sheet footer: 'Last update: November 2025'"))
    for g, v in subtotals.items():
        got = sum(r["fy25_ridership"] or 0 for r in rows if r["group"] == g)
        assert got == v, (g, got, v)
    assert sum(r["fy25_ridership"] or 0 for r in rows) == total, (total,)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f"{len(rows)} route rows; subtotals {subtotals}; total {total}; all sums match the sheet")


if __name__ == "__main__":
    main()
