#!/usr/bin/env python3
# Round 4 of the state finance profile audit (21 Nov 2026), as run. Its inputs (one evidence file per state, ev/XX.json,
# the text of every page fetched, pages/NAME.txt, and the fetch log pages/_fetchlog.jsonl) were kept in the session's
# scratch folder (S below) and are not committed; what they hold is in docs/audit/state-finance-profiles-2026-11-21.json.
# It must run against the pre-round file: git show a2e75a8:app/data/state_finance_profiles.json.
"""Check every quote in ev/*.json against the fetched page text, then write the committed evidence JSON and
apply it to app/data/state_finance_profiles.json. Usage: build.py REPO_ROOT [--apply]"""
import json, os, re, sys, glob, copy
S = "/tmp/claude-0/-home-user-city-pretty/50d74d63-5299-58f9-9f96-14125693e4c0/scratchpad"
root = sys.argv[1]
APPLY = "--apply" in sys.argv
CALC = ["res_assessment_ratio", "annual_assessment_cap", "uncaps_on_sale", "reassessment_cycle_years", "homestead_exemption_rule"]
DAY = "2026-11-21"
norm = lambda s: re.sub(r"\s+", " ", s.replace("​", "")).strip()
log = [json.loads(l) for l in open(os.path.join(S, "pages/_fetchlog.jsonl"))]
fetched = {}
for l in log: fetched[l["name"]] = l
bad = 0
out = {}
for fn in sorted(glob.glob(os.path.join(S, "ev/*.json"))):
    ev = json.load(open(fn))
    st = ev["state"]
    for f, e in ev["fields"].items():
        if e.get("quote"):
            txt = norm(open(os.path.join(S, "pages", e["page"] + ".txt"), encoding="utf-8", errors="replace").read())
            if norm(e["quote"]) not in txt:
                print(f"QUOTE NOT FOUND {st}.{f} in {e['page']}: {e['quote'][:90]}"); bad += 1
            fl = fetched.get(e["page"])
            if not fl: print(f"NO FETCH LOG {st}.{f} {e['page']}"); bad += 1
            else:
                eff = fl["result"].split(" ", 1)[1].strip() if " " in fl["result"] else ""
                if e["source_url"] not in (fl["url"], eff): print(f"URL MISMATCH {st}.{f}: {e['source_url']} vs {fl['url']} / {eff}"); bad += 1
    out[st] = ev
if bad: print(bad, "problems"); sys.exit(1)
print("all quotes found:", sum(len(v["fields"]) for v in out.values()), "fields in", len(out), "states")
if not APPLY: sys.exit(0)

pp = os.path.join(root, "app/data/state_finance_profiles.json")
P = json.load(open(pp))
committed = {"_about": "Round 4 of the state finance profile audit (work queue R5), 21 Nov 2026. Every quote was checked "
             "verbatim against the page text fetched in this session (fetch log: fetched_at). Applied to "
             "app/data/state_finance_profiles.json.", "states": {}}
corrections = []
for st, ev in out.items():
    r = P[st]; v = r["verification"]
    fe = r.setdefault("field_evidence", {})
    done = []; withheld = []
    for f, e in ev["fields"].items():
        if e["status"] == "corrected":
            if r.get(f) != e["old"]: raise SystemExit(f"{st}.{f}: stored {r.get(f)!r} is not the expected old value {e['old']!r}")
            r[f] = e["new"]; corrections.append((st, f, e["old"], e["new"], e["source_url"]))
        if e["status"] == "corrected_to_unknown":
            if r.get(f) != e["old"]: raise SystemExit(f"{st}.{f}: stored {r.get(f)!r} != {e['old']!r}")
            r[f] = None; corrections.append((st, f, e["old"], None, e["source_url"]))
        rec = {"status": e["status"], "source_url": e.get("source_url"), "quote": e.get("quote", ""), "checked_on": DAY, "note": e.get("note", "")}
        if e.get("quote"):
            fe[f] = rec  # a field with no quote gets no field_evidence entry; the reason goes in verification.notes
        else:
            withheld.append(f"{f}: {e.get('note', '')}")
        if e["status"] in ("confirmed", "corrected"): done.append(f)
    uf = [u for u in (v.get("unverified_fields") or []) if String(u) not in done] if False else \
         [u for u in (v.get("unverified_fields") or []) if str(u).split()[0].split("(")[0] not in done]
    for f, e in ev["fields"].items():
        if e["status"] not in ("confirmed", "corrected") and f not in [str(u).split()[0] for u in uf]: uf.append(f)
    still = [f for f in CALC if f in [str(u).split()[0].split("(")[0] for u in uf]]
    status = "verified" if not still else ("partially_verified" if any(f in done for f in CALC) or v["status"] == "partially_verified" else v["status"])
    if ev.get("status_if_nothing_confirmed") and not any(f in done for f in CALC): status = ev["status_if_nothing_confirmed"]
    if not still and any(fe.get(f, {}).get("status") not in ("confirmed", "corrected") for f in CALC):
        raise SystemExit(f"{st}: would be verified but a calculator field lacks evidence")
    old_status = v["status"]
    v["status"] = status
    old_method = v.get("method", "")
    earlier = "" if old_method.startswith("Not checked") or old_method.startswith("ilga.gov") else f" Earlier rounds: {old_method}"
    v["method"] = f"Round 4 (21 Nov 2026): {ev['host']}; per-field quotes in field_evidence.{earlier}"
    v["checked_on"] = DAY
    first = next((f for f in CALC if f in done), None)
    if first and not v.get("evidence"): v["evidence"] = f"{first}: '{ev['fields'][first]['quote'][:160]}'"
    v["unverified_fields"] = uf
    n_c = sum(1 for f in done if ev["fields"][f]["status"] == "confirmed"); n_x = sum(1 for f in done if ev["fields"][f]["status"] == "corrected")
    note = f"Round 4 (2026-11-21): status {old_status} -> {status}; {n_c} field(s) confirmed, {n_x} corrected"
    if still: note += f"; still not confirmed: {', '.join(still)}"
    if withheld: note += ". Withheld (no source sentence found): " + " ".join(withheld)
    if ev.get("note"): note += ". " + ev["note"]
    oldnotes = v.get("notes", "").replace("Only the 10 featured states were checked against statute text. Treat every number in this profile as unverified. ", "Before round 4 (21 Nov 2026) this profile was not checked against a source. ")
    v["notes"] = (oldnotes + " " + note.rstrip(".") + ".").strip()
    if not any(e.get("quote") for e in ev["fields"].values()): v["method"] = f"Round 4 (21 Nov 2026): {ev['host']}.{earlier}"
    if status == "verified" or done:
        r["last_verified"] = DAY
        r["verified_by"] = ev.get("verified_by", "state_statute_database")
    if ev.get("source_url"): r["source_url"] = ev["source_url"]
    if ev.get("statutory_citation"): r["statutory_citation"] = ev["statutory_citation"]
    if ev.get("scope_note"): r["scope_note"] = ev["scope_note"]
    cs = {"host": ev["host"], "status_before": old_status, "status_after": status, "fields": {}}
    for f, e in ev["fields"].items():
        c = {k: e[k] for k in ("status", "source_url", "quote", "note", "old", "new") if k in e}
        fl = fetched.get(e.get("page"))
        if fl: c["fetched_at"] = fl["at"]; c["http"] = fl["result"].split(" ")[0]
        cs["fields"][f] = c
    committed["states"][st] = cs
json.dump(P, open(pp, "w"), indent=2, ensure_ascii=True); open(pp, "a").write("\n")
json.dump(committed, open(os.path.join(root, "docs/audit/state-finance-profiles-2026-11-21.json"), "w"), indent=1, ensure_ascii=False)
for c in corrections: print("CORRECTION", c)
