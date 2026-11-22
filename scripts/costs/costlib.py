"""Shared helpers for the building-cost and housing-funding data scripts (scripts/costs/).

Every figure written to a data file carries a verbatim quote and the URL it was fetched from. `Source.check(quote)`
confirms the quote really occurs in the fetched text (whitespace collapsed), so a typo cannot reach a data file.
Downloads go to a cache folder outside the repository (pass it as --cache); nothing here is committed except the
small JSON tables the scripts write.
"""
import hashlib
import json
import os
import re
import subprocess
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = "Mozilla/5.0 (city-pretty data pipeline)"
TODAY = date.today().isoformat()


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip()


def fetch(url, dest):
    """Download url to dest with curl (skipped when dest already exists). Returns dest. Raises unless HTTP 200."""
    if not os.path.exists(dest) or os.path.getsize(dest) == 0:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        r = subprocess.run(["curl", "-sL", "-m", "180", "-A", "Mozilla/5.0", "-o", dest, "-w", "%{http_code}", url], capture_output=True, text=True)
        if r.stdout.strip() != "200":
            if os.path.exists(dest):
                os.remove(dest)
            raise RuntimeError(f"HTTP {r.stdout.strip()} for {url}")
    return dest


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def pdf_text(path, layout=True):
    args = ["pdftotext"] + (["-layout"] if layout else []) + [path, "-"]
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def html_text(path):
    t = open(path, errors="ignore").read()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    import html as _h
    return _h.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))


class Source:
    """One fetched document: its URL, local file, searchable text and what the publisher lets us do with it."""

    def __init__(self, name, url, path, text, publisher, edition, display_allowed, display_terms):
        self.name, self.url, self.path = name, url, path
        self.text, self.ntext = text, norm(text)
        self.publisher, self.edition = publisher, edition
        self.display_allowed, self.display_terms = display_allowed, display_terms
        self.sha256 = sha256(path)

    def check(self, quote):
        q = norm(quote)
        if len(q) > 300:
            raise ValueError(f"quote over 300 characters ({len(q)}): {q[:60]}...")
        if q not in self.ntext:
            raise ValueError(f"quote not found in {self.name}: {q[:120]}")
        return q

    def verification(self):
        return {"status": "quote_matched_in_fetched_text", "method": "scripts/costs build script re-reads the fetched file and requires the quote to occur in it",
                "checked_on": TODAY, "source_file_sha256": self.sha256}


def dump(path, obj, compact=False):
    with open(path, "w") as f:
        json.dump(obj, f, ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))
        f.write("\n")
    print("wrote", os.path.relpath(path, ROOT), os.path.getsize(path), "bytes")
