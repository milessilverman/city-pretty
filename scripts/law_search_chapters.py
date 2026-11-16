"""Round-3 state housing-law search: fetch every section of each state's zoning chapters and record topic hits.

Usage: python3 scripts/law_search_chapters.py STATE...   (writes .law_cache/round3_<STATE>.json)
"""
import json
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from law_search_lib import fetch, term_hits  # noqa: E402

CHAPTERS = {
    "MO": [("RSMo ch. 89 (zoning and planning)", "https://revisor.mo.gov/main/OneChapter.aspx?chapter=89",
            r"section=(89\.\d+)", "https://revisor.mo.gov/main/OneSection.aspx?section={}")],
    "SD": [(f"SDCL ch. {c}", f"https://sdlegislature.gov/api/Statutes/{c}.html", r"(%s-\d+(?:\.\d+)?)" % re.escape(c),
            "https://sdlegislature.gov/api/Statutes/{}.html") for c in ("11-4", "11-2", "11-6")],
    "WV": [(f"W. Va. Code ch. {c}", f"https://code.wvlegislature.gov/{c}/", r"/(%s-\d+[a-z]?)/" % re.escape(c),
            "https://code.wvlegislature.gov/{}/") for c in ("8A-7", "8A-4", "8A-5")],
    "KS": [("K.S.A. 12-741 to 12-775 (planning and zoning)", "https://www.ksrevisor.gov/statutes/ksa_ch12.html",
            r"(012_007_\d{4}(?:a|b)?)", "https://www.ksrevisor.gov/statutes/chapters/ch12/{}.html")],
    "NE": [(f"Neb. Rev. Stat. ch. {c}", f"https://nebraskalegislature.gov/laws/browse-chapters.php?chapter={c}",
            r"statute=(%s-\d+(?:\.\d+)?)" % c, "https://nebraskalegislature.gov/laws/statutes.php?statute={}") for c in ("19", "14", "15", "16", "17", "23")],
    "AK": [("AS 29.40 (planning, platting, zoning)", "https://www.akleg.gov/basis/statutes.asp?title=29",
            r"(29\.40\.\d{3})", "https://www.akleg.gov/basis/statutes.asp#{}")],
}
# Nebraska's chapter 19 etc. are large; only sections whose index line mentions these words are fetched there.
TITLE_FILTER = {"NE": r"zoning|housing|dwelling|parking|residential|density|lot"}


def run(state):
    log = []
    for cite, idx_url, pat, sec_url in CHAPTERS[state]:
        raw = fetch(idx_url, raw=True)
        if raw is None:
            log.append({"citation": cite, "url": idx_url, "full_text_searched": False, "why_not": "fetch failed"})
            print(state, cite, "index fetch failed")
            continue
        page = raw.decode("utf-8", "ignore")
        secs = sorted(set(re.findall(pat, page)))
        if state in TITLE_FILTER:
            keep = []
            for s in secs:
                i = page.find(s)
                ctx = re.sub(r"<[^>]+>", " ", page[i: i + 400])
                if re.search(TITLE_FILTER[state], ctx, re.I):
                    keep.append(s)
            secs = keep
        hits, n_ok = {}, 0
        for s in secs:
            t = fetch(sec_url.format(s))
            if not t:
                continue
            n_ok += 1
            for k, v in term_hits(t, 2, 150, 300).items():
                hits.setdefault(k, []).append({"section": s, "passage": v[0]})
        log.append({"citation": cite, "url": idx_url, "sections_found": len(secs), "sections_fetched": n_ok,
                    "title_filtered": state in TITLE_FILTER,
                    "full_text_searched": n_ok > 0 and n_ok == len(secs), "term_hits": hits})
        print(state, cite, "sections", len(secs), "fetched", n_ok, {k: [h["section"] for h in v] for k, v in hits.items()})
    json.dump(log, open(f".law_cache/round3_{state}.json", "w"), indent=1)


if __name__ == "__main__":
    for st in sys.argv[1:]:
        run(st)
