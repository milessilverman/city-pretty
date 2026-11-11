"""Replace the Orange County bundle inside the page: python3 splice_bundle.py <page.html> <bundle-oc.b64> <out.html>"""
import sys, re
page, b64, out = sys.argv[1:4]
s = open(page, encoding="utf-8").read(); b = open(b64).read().strip()
m = re.search(r'(<script type="application/octet-stream" id="bundle-oc">)(.*?)(</script>)', s, re.S)
assert m, "bundle-oc script tag not found"
s = s[:m.start(2)] + b + s[m.end(2):]
open(out, "w", encoding="utf-8").write(s)
print("spliced", len(b) / 1e6, "MB of bundle into", out)
