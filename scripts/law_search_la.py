"""Round-3 search of the Louisiana Revised Statutes through the legislature's own text search (legis.la.gov LawSearch).

Each phrase is searched in the Revised Statutes; every listed section is opened by citation and its topic passages are
recorded in .law_cache/round3_LA.json.
"""
import html
import json
import re
import sys
import time

import requests

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from law_search_lib import UA, term_hits  # noqa: E402

BASE = "https://www.legis.la.gov/legis/"
PHRASES = ["accessory dwelling", "accessory apartment", "duplex", "minimum parking", "off-street parking", "lot split",
           "middle housing", "residential use commercial zone", "accessory residential"]
P = "ctl00$ctl00$PageBody$PageContent$"


def hidden(page):
    return {m.group(1): html.unescape(m.group(2)) for m in re.finditer(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', page)}


def text(page):
    page = re.sub(r"<script.*?</script>|<style.*?</style>", " ", page, flags=re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", page)).split())


def form(sess, extra, target):
    page = sess.get(BASE + "LawSearch.aspx", timeout=60).text
    data = hidden(page)
    data.update({P + "ddlLawBodies": "RS", P + "tbFirstNumber": " Title", P + "tbSecondNumber": " Section"})
    data.update(extra)
    return sess.post(BASE + target, data=data, timeout=120)


def search(sess, phrase):
    r = form(sess, {P + "tbText": phrase, P + "btnSearchText": "Search", P + "cbLaws$9": "on"}, "LawSearchList.aspx")
    t = text(r.text)
    n = re.search(r"There are (\d+) sections? of law", t)
    rows = re.findall(r"(RS \d+:\d+(?:\.\d+)?) (.*?) Last Modified (\d\d/\d\d/\d{4})", t)
    return r.status_code, int(n.group(1)) if n else 0, rows


def section(sess, cite):
    title, sec = cite[3:].split(":")
    r = form(sess, {P + "tbFirstNumber": title, P + "tbSecondNumber": sec, P + "btnViewLaw": "View"}, "LawSearch.aspx")
    return r.url, text(r.text)


def main():
    sess = requests.Session()
    sess.headers["User-Agent"] = UA
    out = {"route": BASE + "LawSearch.aspx (Revised Statutes text search; sections opened by citation)", "searches": []}
    seen = {}
    for ph in PHRASES:
        code, n, rows = search(sess, ph)
        res = []
        for cite, desc, mod in rows:
            if cite not in seen:
                try:
                    url, t = section(sess, cite)
                    seen[cite] = {"url": url, "chars": len(t), "hits": term_hits(t, 1, 200, 400)}
                except Exception as e:  # noqa: BLE001
                    seen[cite] = {"error": str(e)}
                time.sleep(0.7)
            res.append({"cite": cite, "title": desc, "last_modified": mod, **seen[cite]})
        out["searches"].append({"phrase": ph, "http": code, "sections_reported": n, "sections_listed": len(rows), "sections": res})
        print(ph, code, n, len(rows), [(r["cite"], r["title"][:40], r["last_modified"], list(r.get("hits", {}))) for r in res])
        time.sleep(1)
    json.dump(out, open(".law_cache/round3_LA.json", "w"), indent=1)


if __name__ == "__main__":
    main()
