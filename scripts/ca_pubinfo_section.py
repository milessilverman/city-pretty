#!/usr/bin/env python3
"""Read California code sections from the Legislative Counsel's official bulk database without downloading it.

leginfo.legislature.ca.gov blocks automated access from City Pretty's build machine, so this opens
downloads.leginfo.legislature.ca.gov/pubinfo_<year>.zip over HTTP range requests, reads LAW_SECTION_TBL.dat to find
the requested sections, and prints their text from the matching .lob files.

Usage: python3 scripts/ca_pubinfo_section.py GOV 65912.110 65912.111 ...
       python3 scripts/ca_pubinfo_section.py --list        (archive members and sizes)
"""
import io
import re
import sys
import urllib.request
import zipfile

URL = "https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip"
UA = {"User-Agent": "city-pretty-law-audit/1.0"}


class HttpRange(io.RawIOBase):
    def __init__(self, url, block=1 << 20):
        self.url, self.pos, self.block, self.cache = url, 0, block, {}
        req = urllib.request.Request(url, method="HEAD", headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self):
        return True

    def readable(self):
        return True

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def tell(self):
        return self.pos

    def _block(self, i):
        if i not in self.cache:
            a = i * self.block
            b = min(self.size, a + self.block) - 1
            req = urllib.request.Request(self.url, headers={**UA, "Range": f"bytes={a}-{b}"})
            for k in range(5):
                try:
                    with urllib.request.urlopen(req, timeout=120) as r:
                        self.cache[i] = r.read()
                    break
                except Exception:
                    if k == 4:
                        raise
            if len(self.cache) > 64:
                self.cache.pop(next(iter(self.cache)))
        return self.cache[i]

    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0:
            return 0
        out, p = bytearray(), self.pos
        while len(out) < n:
            i = p // self.block
            chunk = self._block(i)[p - i * self.block:]
            take = chunk[: n - len(out)]
            out += take
            p += len(take)
        b[: len(out)] = out
        self.pos = p
        return len(out)


def main():
    z = zipfile.ZipFile(io.BufferedReader(HttpRange(URL), buffer_size=1 << 20))
    if sys.argv[1:2] == ["--list"]:
        for i in z.infolist():
            if not i.filename.endswith(".lob"):
                print(i.filename, i.file_size, i.compress_size)
        print("lob members:", sum(1 for i in z.infolist() if i.filename.endswith(".lob")))
        return
    code, wanted = sys.argv[1], set(sys.argv[2:])
    found = {}
    with z.open("LAW_SECTION_TBL.dat") as fh:
        for raw in io.TextIOWrapper(fh, encoding="utf8", errors="replace"):
            cols = raw.rstrip("\n").split("\t")
            if len(cols) > 6 and cols[1].strip("`") == code and cols[2].strip("`").rstrip(".") in wanted:
                found[cols[2].strip("`").rstrip(".")] = cols
                if len(found) == len(wanted):
                    break
    for sec in sorted(wanted):
        cols = found.get(sec)
        if not cols:
            print(f"== {code} {sec}: not found")
            continue
        lob = next((c.strip("`") for c in cols if c.strip("`").endswith(".lob")), None)
        meta = [c.strip("`") for c in cols[:12]]
        text = z.read(lob).decode("utf8", "replace") if lob else ""
        text = " ".join(re.sub(r"<[^>]+>", " ", text).split())
        print(f"== {code} {sec} | meta {meta}\n{text}\n")


if __name__ == "__main__":
    main()
