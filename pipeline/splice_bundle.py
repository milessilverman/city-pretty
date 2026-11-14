"""Install a rebuilt Orange County bundle for the page: python3 splice_bundle.py <bundle-oc.b64> [<repo root>]

The page used to carry this bundle inside index.html; it now fetches app/data/bundle-oc.b64.txt (gzip+base64, the
same text build_oc.py writes to data/bundle-oc.b64), so installing a bundle is a file copy.
"""
import os, sys

b64 = sys.argv[1]
root = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
text = open(b64).read().strip()
assert text.startswith("H4sI"), "not a gzip+base64 bundle"
out = os.path.join(root, "app", "data", "bundle-oc.b64.txt")
open(out, "w").write(text)
print("installed", len(text) / 1e6, "MB of bundle at", out)
