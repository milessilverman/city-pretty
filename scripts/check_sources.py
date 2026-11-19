#!/usr/bin/env python3
"""Re-check every source link in app/data and report links that have broken since the last baseline.

Each URL is classified:
  ok        2xx/3xx with content
  blocked   the site refuses automated requests (401/403/405/429, bot challenges such as HTTP 202 with no body).
            Not evidence the source is gone; check it from a normal browser.
  broken    404/410, DNS failure, or connection refused: the source moved or is gone
  error     timeouts and other transient failures (retried; reported, not failed)

The run fails (exit 1) only when a URL that was ok or blocked in the baseline is now broken, so a monthly scheduled
run flags real breakage without failing on hosts that always block bots.

Usage:
  python3 scripts/check_sources.py                 # check, compare with data/source_link_baseline.json
  python3 scripts/check_sources.py --update-baseline
"""
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "data")
BASELINE = os.path.join(ROOT, "data", "source_link_baseline.json")
REPORT = os.path.join(ROOT, "data", "source_link_report.json")
SKIP_FILES = {"county_completeness.json", "hud_fair_market_rents.json"}  # service URLs checked by their own build scripts
UA = "Mozilla/5.0 (compatible; city-pretty-source-check/1.0)"


def urls_in(obj, path, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            urls_in(v, f"{path}.{k}", out)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            urls_in(v, f"{path}[{i}]", out)
    elif isinstance(obj, str) and obj.startswith(("http://", "https://")) and " " not in obj:
        out.setdefault(obj, []).append(path)


def collect():
    out = {}
    for f in sorted(os.listdir(DATA)):
        if f.endswith(".json") and f not in SKIP_FILES:
            try:
                urls_in(json.load(open(os.path.join(DATA, f))), f, out)
            except json.JSONDecodeError:
                continue
    return out


def check(url, tries=3):
    last = ("error", "unknown")
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read(2048)
                if r.status == 202 and not body.strip():
                    return ("blocked", "202 bot challenge")
                return ("ok", str(r.status))
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return ("broken", str(e.code))
            if e.code in (401, 403, 405, 429, 451, 503):
                last = ("blocked", str(e.code))
            else:
                last = ("error", str(e.code))
        except urllib.error.URLError as e:
            reason = e.reason
            if isinstance(reason, socket.gaierror) or "Name or service not known" in str(reason):
                return ("broken", "DNS")
            if isinstance(reason, ConnectionRefusedError):
                return ("broken", "connection refused")
            last = ("error", str(reason)[:80])
        except Exception as e:  # timeouts, resets
            last = ("error", str(e)[:80])
        time.sleep(2 * (i + 1))
    return last


def main():
    urls = collect()
    print(f"{len(urls)} distinct source URLs in app/data", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = dict(zip(urls, ex.map(check, list(urls))))
    report = {
        "checked": date.today().isoformat(),
        "counts": {s: sum(1 for v in results.values() if v[0] == s) for s in ("ok", "blocked", "broken", "error")},
        "urls": {u: {"status": s, "detail": d, "used_in": urls[u][:5]} for u, (s, d) in sorted(results.items())},
    }
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    json.dump(report, open(REPORT, "w"), indent=1)
    print(json.dumps(report["counts"]), file=sys.stderr)

    if "--update-baseline" in sys.argv:
        json.dump({"checked": report["checked"], "status": {u: v["status"] for u, v in report["urls"].items()}}, open(BASELINE, "w"), indent=1)
        print(f"baseline written: {BASELINE}", file=sys.stderr)
        return 0
    base = json.load(open(BASELINE))["status"] if os.path.exists(BASELINE) else {}
    newly = [u for u, v in report["urls"].items() if v["status"] == "broken" and base.get(u) in ("ok", "blocked")]
    for u in sorted(u for u, v in report["urls"].items() if v["status"] == "broken"):
        print(("NEWLY BROKEN " if u in newly else "broken (known) ") + u + "  <- " + ", ".join(report["urls"][u]["used_in"][:2]), file=sys.stderr)
    return 1 if newly else 0


if __name__ == "__main__":
    sys.exit(main())
