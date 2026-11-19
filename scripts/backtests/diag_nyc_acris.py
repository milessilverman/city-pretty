#!/usr/bin/env python3
"""Diagnostic (not a back-test): do NYC's own deed records mark the low-price Queens test sales as non-arm's-length?

The Queens back-test (data/backtests/county_model_test_36081.json) passed overall (14.97%) but its 230 test sales under
$500k had a median signed error of +99%: the model estimated about twice the recorded price. This script looks up each
test-window sale's deed in ACRIS (NYC Department of Finance, NYC Open Data; public, no key):
  Real Property Legals  8h5j-fqxa  borough / block / lot -> document_id
  Real Property Master  bnx9-e6tj  document_id -> doc_type, document_date, document_amt, percent_trans
  Real Property Parties 636b-3b5g  document_id -> party_type (1 grantor, 2 grantee), name
A deed matches a sale when it is a DEED-type document on the same lot dated within 3 days of the sale with the same
amount. Markers counted per price band: percent_trans under 100 (a partial interest), a doc type other than plain
DEED, a grantor and grantee sharing a surname, a referee/executor/estate/trust grantor.

This does not change any published result (the one-final-test rule). It decides which screens to lock in before the
next fresh test window. Usage: python3 scripts/backtests/diag_nyc_acris.py [sales file] [test start] [test end]
Output: data/backtests/acris_diag_36081_<date>.json
"""
import gzip, json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOC = "https://data.cityofnewyork.us/resource"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}


def get(ds, params, tries=6):
    url = f"{SOC}/{ds}.json?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{ds}: {last}")


def surnames(names):
    out = set()
    for n in names:
        n = n.upper().strip()
        if "," in n:
            s = n.split(",")[0].strip()
            if s and not re.search(r"\b(LLC|INC|CORP|BANK|TRUST|ESTATE|ASSOC|CO)\b", s):
                out.add(s)
    return out


def main():
    sales_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data/backtests/sales_36081_2026-11-16.json.gz")
    t0 = sys.argv[2] if len(sys.argv) > 2 else "2026-05-01"
    t1 = sys.argv[3] if len(sys.argv) > 3 else "2026-09-30"
    rows = [r for r in json.load(gzip.open(sales_file))["rows"] if t0 <= r["date"] <= t1]
    print(f"{len(rows)} test-window sales", file=sys.stderr)
    by_bbl = defaultdict(list)
    for r in rows:
        by_bbl[r["id"]].append(r)
    bbls = sorted(by_bbl)

    # 1. legals -> document ids
    docs_for = defaultdict(set)
    for i in range(0, len(bbls), 60):
        chunk = bbls[i:i + 60]
        cond = " OR ".join(f"(block={int(b[1:6])} AND lot={int(b[6:])})" for b in chunk)
        for x in get("8h5j-fqxa", {"$where": f"borough='{chunk[0][0]}' AND ({cond})", "$select": "document_id,block,lot", "$limit": 50000}):
            docs_for[f"{chunk[0][0]}{int(x['block']):05d}{int(x['lot']):04d}"].add(x["document_id"])
    all_docs = sorted({d for s in docs_for.values() for d in s})
    all_set = set(all_docs)
    print(f"{len(all_docs)} documents on these lots", file=sys.stderr, flush=True)

    # 2. master: every DEED-type document citywide (recorded_borough is where it was recorded, mostly 1, not the lot's borough) dated from 40 days before to 10 days after the window, paged
    # (one pass over a few tens of thousands of rows, instead of per-document lookups), then kept if on one of our lots.
    master = {}
    lo = (datetime.fromisoformat(t0) - timedelta(days=40)).date().isoformat()
    hi = (datetime.fromisoformat(t1) + timedelta(days=10)).date().isoformat()
    boro = bbls[0][0]
    off = 0
    while True:
        page = get("bnx9-e6tj", {"$where": f"starts_with(doc_type,'DEED') AND document_date between '{lo}' and '{hi}'",
                                 "$select": "document_id,doc_type,document_date,document_amt,percent_trans,recorded_datetime",
                                 "$order": "document_id", "$limit": 50000, "$offset": off})
        for m in page:
            if m["document_id"] in all_set:
                master[m["document_id"]] = m
        print(f"  master page at {off}: {len(page)} rows, {len(master)} on our lots", file=sys.stderr, flush=True)
        if len(page) < 50000:
            break
        off += 50000

    # 3. parties for matched deeds
    parties = defaultdict(lambda: {"1": [], "2": []})
    mids = sorted(master)
    for i in range(0, len(mids), 150):
        ids = ",".join(f"'{d}'" for d in mids[i:i + 150])
        for p in get("636b-3b5g", {"$where": f"document_id in ({ids})", "$select": "document_id,party_type,name", "$limit": 50000}):
            if p.get("party_type") in ("1", "2"):
                parties[p["document_id"]][p["party_type"]].append(p.get("name", ""))

    def band(p):
        return "under $500k" if p < 500000 else "$500k-$1M" if p < 1e6 else "$1M-$2M" if p < 2e6 else "$2M and up"

    stats = defaultdict(Counter)
    examples = defaultdict(list)
    row_marks = []  # every sale in the window: its markers, or "no_matching_deed" (read by screen_nyc_sales.py)
    for bbl, rs in by_bbl.items():
        for r in rs:
            b = band(r["price"])
            st = stats[b]
            st["sales"] += 1
            sd = date.fromisoformat(r["date"])
            cands = []
            for d in docs_for.get(bbl, ()):
                m = master.get(d)
                if not m:
                    continue
                dd = date.fromisoformat(m["document_date"][:10])
                amt = float(m.get("document_amt") or 0)
                if abs((dd - sd).days) <= 3 and abs(amt - r["price"]) <= max(1.0, 0.001 * r["price"]):
                    cands.append(m)
            if not cands:
                st["no_matching_deed"] += 1
                row_marks.append({"id": bbl, "date": r["date"], "price": r["price"], "deed": None, "markers": ["no_matching_deed"]})
                continue
            m = cands[0]
            st["matched"] += 1
            pt = float(m.get("percent_trans") or 0)
            g, e = parties[m["document_id"]]["1"], parties[m["document_id"]]["2"]
            marks = []
            if 0 < pt < 100:
                marks.append("partial_interest")
            if m["doc_type"] != "DEED":
                marks.append("doc_type_" + m["doc_type"].replace(" ", "_").replace(",", ""))
            if surnames(g) & surnames(e):
                marks.append("shared_surname")
            if any(re.search(r"\bREFEREE\b", n.upper()) for n in g):
                marks.append("referee_grantor")
            if any(re.search(r"\b(EXECUT|ADMINISTRAT|ESTATE OF|DECEASED)", n.upper()) for n in g):
                marks.append("estate_grantor")
            if any(re.search(r"\bTRUST", n.upper()) for n in g + e):
                marks.append("trust_party")
            row_marks.append({"id": bbl, "date": r["date"], "price": r["price"], "deed": m["document_id"], "markers": marks})
            for k in marks:
                st[k] += 1
            if not marks:
                st["no_marker"] += 1
            else:
                st["any_marker"] += 1
            if b == "under $500k" and len(examples[b]) < 40:
                examples[b].append({"bbl": bbl, "date": r["date"], "price": r["price"], "doc": m["document_id"], "doc_type": m["doc_type"],
                                    "percent_trans": pt, "grantors": g[:3], "grantees": e[:3], "markers": marks})
    out = {
        "ran_on": datetime.now(timezone.utc).isoformat(),
        "script": "scripts/backtests/diag_nyc_acris.py",
        "sales_file": os.path.relpath(sales_file, ROOT),
        "test_window": [t0, t1],
        "sources": [f"{SOC}/8h5j-fqxa.json", f"{SOC}/bnx9-e6tj.json", f"{SOC}/636b-3b5g.json"],
        "by_band": {b: dict(c) for b, c in stats.items()},
        "examples_under_500k": examples["under $500k"],
        "row_markers": row_marks,
    }
    p = os.path.join(ROOT, f"data/backtests/acris_diag_36081_{t0}_{t1}.json")
    json.dump(out, open(p, "w"), indent=1)
    print(json.dumps(out["by_band"], indent=1))
    print("wrote", p, file=sys.stderr)


if __name__ == "__main__":
    main()
