#!/usr/bin/env python3
"""Fetch statute / session-law pages and print the passages that contain given phrases.

Used to build the evidence quotes in docs/audit/state-laws-50.json: every quote stored there was printed by this
script from the fetched page, never typed from memory.

Usage:
  python3 scripts/fetch_law_text.py URL [phrase ...]      # prints status and +-300 chars around each phrase
  python3 scripts/fetch_law_text.py --status URL ...       # HTTP status only
Pages are cached under .law_cache/ (not committed).
"""
import hashlib
import html
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".law_cache")
UA = "Mozilla/5.0 (compatible; city-pretty-law-audit/1.0)"


def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".txt")
    if os.path.exists(key):
        return 200, open(key, encoding="utf8").read()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/pdf,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)
    if "pdf" in ctype or raw[:4] == b"%PDF":
        import io
        try:
            import pypdf
            text = " ".join((p.extract_text() or "") for p in pypdf.PdfReader(io.BytesIO(raw)).pages)
        except Exception as e:
            text = f"[pdf unreadable: {e}]"
    else:
        t = raw.decode("utf8", "ignore")
        t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", t)
        text = html.unescape(re.sub(r"<[^>]+>", " ", t))
    text = " ".join(text.split())
    open(key, "w", encoding="utf8").write(text)
    return 200, text


def main():
    args = sys.argv[1:]
    if args and args[0] == "--status":
        for u in args[1:]:
            code, text = fetch(u)
            print(code, len(text), u)
        return
    url, phrases = args[0], args[1:]
    code, text = fetch(url)
    print("STATUS", code, "LEN", len(text))
    if not phrases:
        print(text[:1500])
    for p in phrases:
        hits = [m.start() for m in re.finditer(re.escape(p), text, re.I)]
        print(f"--- {p!r}: {len(hits)} hit(s)")
        for h in hits[:3]:
            print("   ", text[max(0, h - 300): h + 300])


if __name__ == "__main__":
    main()
