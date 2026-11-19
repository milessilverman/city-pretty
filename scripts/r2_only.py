#!/usr/bin/env python3
"""County files kept only in the Cloudflare R2 bucket, not in the repository (19 Nov 2026).

GitHub Pages publishes at most 1 GB per site and the repository is already over it, so county files built from now on
are uploaded to R2 with scripts/r2_sync_counties.py and NOT committed. counties/.r2-only.txt lists them, one file
name per line (e.g. bundle_24001.json.gz). The page loads these from R2 only (index.html tag data-r2only="1"), and
tests and scripts that enumerate counties/ read this list instead of assuming every county file is on disk.

Usage: python3 scripts/r2_only.py --gitignore   rewrite the generated block in .gitignore from the list
       python3 scripts/r2_only.py --check       exit 1 if .gitignore's block differs from the list or a listed file
                                                is tracked by git
       python3 scripts/r2_only.py --add NAME... add file names to the list (sorted, unique), then --gitignore
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, "counties", ".r2-only.txt")
GITIGNORE = os.path.join(ROOT, ".gitignore")
BEGIN = "# BEGIN r2-only county files (generated from counties/.r2-only.txt by scripts/r2_only.py --gitignore; do not edit)"
END = "# END r2-only county files"
NAME = re.compile(r"^(bundle|sites)_\d{5}\.json\.gz$")


def names():
    """File names (not paths) listed in counties/.r2-only.txt; empty when the list does not exist."""
    if not os.path.exists(LIST):
        return []
    out = [l.strip() for l in open(LIST, encoding="utf-8") if l.strip() and not l.startswith("#")]
    bad = [n for n in out if not NAME.match(n)]
    if bad:
        raise SystemExit(f"counties/.r2-only.txt: not a county file name: {bad[:5]}")
    return out


def fips_set():
    """FIPS codes of counties whose data file (bundle) is R2-only."""
    return {n[7:12] for n in names() if n.startswith("bundle_")}


def missing_local():
    """Listed R2-only files that are not in counties/ on this machine. A script that rebuilds a file from every county
    file must stop when this is non-empty (it would otherwise silently drop those counties)."""
    return [n for n in names() if not os.path.exists(os.path.join(ROOT, "counties", n))]


def require_local(script):
    miss = missing_local()
    if miss:
        raise SystemExit(f"{script}: {len(miss)} R2-only county files listed in counties/.r2-only.txt are not in counties/ "
                         f"here (e.g. {miss[0]}). Download them from the R2 bucket's public address first; running "
                         "without them would drop those counties.")


def block():
    return "\n".join([BEGIN] + ["counties/" + n for n in names()] + [END])


def write_gitignore():
    g = open(GITIGNORE, encoding="utf-8").read()
    if BEGIN in g:
        g = g[:g.index(BEGIN)] + block() + g[g.index(END) + len(END):]
    else:
        g = g.rstrip("\n") + "\n" + block() + "\n"
    open(GITIGNORE, "w", encoding="utf-8").write(g)


def check():
    g = open(GITIGNORE, encoding="utf-8").read()
    ok = True
    if names() and block() not in g:
        print(".gitignore's r2-only block does not match counties/.r2-only.txt: run scripts/r2_only.py --gitignore"); ok = False
    tracked = subprocess.run(["git", "ls-files", "counties"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    both = sorted(set("counties/" + n for n in names()) & set(tracked))
    if both:
        print("R2-only files tracked by git:", both[:10]); ok = False
    return ok


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--add"]:
        new = a[1:]
        for n in new:
            if not NAME.match(n):
                raise SystemExit(f"not a county file name: {n}")
        allnames = sorted(set(names()) | set(new))
        with open(LIST, "w", encoding="utf-8") as f:
            f.write("".join(n + "\n" for n in allnames))
        write_gitignore()
        print(f"{len(allnames)} R2-only files listed")
    elif a[:1] == ["--gitignore"]:
        write_gitignore()
    elif a[:1] == ["--check"]:
        sys.exit(0 if check() else 1)
    else:
        print(__doc__)
