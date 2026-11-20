#!/usr/bin/env python3
"""Write each law's checked site conditions into app/data/statutes.json (and its identical copy,
app/data/state-housing-laws.json) from the evidence files in docs/audit/site_exclusions/*.json.

Why: until 20 Nov 2026 the statute engine screened no law at all on a lot in a FEMA flood hazard area, a very high
fire hazard zone, an agricultural preserve or public / tribal land, in every state. No record said that. The engine
now decides law by law from `site_conditions` on each record:
  excluded true  -> the law's text rules such a lot out (quote and URL kept on the record)
  excluded false -> the operative text was read in full and has no such exclusion
  excluded null  -> not checked (the engine then reports the law as not confirmed on such a lot)

Nothing is typed here: every value comes from an evidence file, which holds the verbatim quote and the URL fetched.
A `true` without a quote, or a `true` / `false` without a URL, is refused. Run: python3 scripts/apply_site_exclusions.py
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
KEYS = ["fema_100yr_floodway", "calfire_or_state_vhfhsz", "williamson_or_ag_preserve", "public_or_tribal_land", "historic_district_hpoz"]


def main():
    evidence = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "docs/audit/site_exclusions/*.json"))):
        data = json.load(open(path, encoding="utf-8"))
        rel = os.path.relpath(path, ROOT)
        for rid, rec in (data.get("records") or {}).items():
            assert rid not in evidence, f"{rid} appears in two evidence files"
            evidence[rid] = (rel, data.get("fetched_on"), rec)

    laws = json.load(open(TARGETS[0], encoding="utf-8"))
    ids = {r["id"] for r in laws}
    unknown = sorted(set(evidence) - ids)
    assert not unknown, f"evidence for ids not in statutes.json: {unknown}"

    counts = {"true": 0, "false": 0, "null": 0}
    for r in laws:
        if r["id"] not in evidence:
            continue
        rel, fetched_on, ev = evidence[r["id"]]
        conditions = {}
        for k in KEYS:
            c = (ev.get("conditions") or {}).get(k) or {}
            excluded = c.get("excluded")
            assert excluded in (True, False, None), (r["id"], k, excluded)
            if excluded is True:
                assert c.get("quote") and c.get("url"), f"{r['id']} {k}: excluded=true needs a quote and a URL"
            if excluded is False:
                assert c.get("url") or (ev.get("sections_read") or []), f"{r['id']} {k}: excluded=false needs the text that was read"
            entry = {"excluded": excluded}
            for f in ("quote", "exception_quote", "url", "note"):
                if c.get(f):
                    entry[f] = c[f]
            conditions[k] = entry
            counts[json.dumps(excluded)] += 1
        conditions["_checked"] = {"on": fetched_on, "evidence_file": rel,
                                  "sections_read": [s.get("citation") for s in (ev.get("sections_read") or []) if s.get("citation")]}
        r["site_conditions"] = conditions

    out = json.dumps(laws, indent=2, ensure_ascii=False) + "\n"
    for t in TARGETS:
        open(t, "w", encoding="utf-8").write(out)
    missing = sorted(r["id"] for r in laws if r.get("parcel_level") is not False and r["id"] not in evidence)
    print(f"records with evidence: {len(evidence)}; conditions excluded={counts['true']}, checked-not-excluded={counts['false']}, not checked={counts['null']}")
    print("parcel-level records with no evidence file entry (stay not confirmed on hazard lots):", missing or "none")


if __name__ == "__main__":
    sys.exit(main())
