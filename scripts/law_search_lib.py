"""Helpers for the state housing-law search (round 3): fetch a statute page or PDF and find passages on the five topics.

Pages are cached under .law_cache/ (not committed). Every quote stored in docs/audit/state-laws-50.json comes from text
these helpers fetched, never from memory.
"""
import hashlib
import html
import io
import os
import re
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".law_cache")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

TERMS = {
    "adu": r"accessory dwelling|accessory apartment|accessory residential unit|accessory living unit",
    "middle_housing": r"duplex|two-family|middle housing|triplex|fourplex|quadplex|multiplex",
    "lot_split": r"lot split|urban lot split|split(ting)? (of )?(a |an )?(residential )?lot",
    "parking": r"minimum parking|parking minimum|minimum number of (off-street )?parking|off-street parking (space|requirement)",
    "commercial_residential": r"residential use[s]? (in|on|within) .{0,40}commercial|commercial(ly)? zoned .{0,60}residential",
}


def fetch(url, raw=False, timeout=60):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(key):
        b = open(key, "rb").read()
    else:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                b = r.read()
        except Exception:
            return None
        open(key, "wb").write(b)
        time.sleep(0.7)
    if raw:
        return b
    if b[:4] == b"%PDF":
        import pypdf
        try:
            return " ".join(" ".join((p.extract_text() or "").split()) for p in pypdf.PdfReader(io.BytesIO(b)).pages)
        except Exception:
            return ""
    t = b.decode("utf-8", "ignore")
    return " ".join(html.unescape(re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", t, flags=re.S)).split())


def term_hits(text, per_term=3, before=200, after=300):
    out = {}
    for k, pat in TERMS.items():
        found = [text[max(0, m.start() - before): m.end() + after] for m in re.finditer(pat, text, re.I)][:per_term]
        if found:
            out[k] = found
    return out
