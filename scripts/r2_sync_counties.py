#!/usr/bin/env python3
"""Upload county data files to the Cloudflare R2 bucket, with a hard storage guard.

OWNER'S RULE (19 Nov 2026): the account's R2 storage must NEVER exceed the 10 GB free allowance, under any
circumstance. This script is the only approved way to put objects in R2. It:
  - adds up every object in EVERY bucket of the account before doing anything,
  - refuses to upload if (what is stored now + what would be added) is above CEILING_BYTES (8 GB, a 2 GB margin
    under the 10 GB allowance), and
  - never uses multipart uploads (unfinished parts are billed but invisible in listings).
Do not raise CEILING_BYTES, bypass the check, or upload with any other tool. If the data no longer fits, stop and
ask the owner.

Usage:  python3 scripts/r2_sync_counties.py --dry-run     show usage and what would be uploaded
        python3 scripts/r2_sync_counties.py               upload new or changed files in counties/
        python3 scripts/r2_sync_counties.py --usage       only print what is stored
Auth: a Cloudflare API token with R2 edit rights. In Claude Code cloud sessions the session's network proxy adds it
to requests to api.cloudflare.com; elsewhere set CLOUDFLARE_API_TOKEN.
"""
import concurrent.futures, hashlib, json, os, subprocess, sys, urllib.parse

ALLOWANCE_BYTES = 10 * 10**9          # Cloudflare's free R2 storage allowance (10 GB-month)
CEILING_BYTES = 8 * 10**9             # this script's hard stop; never raise it
MAX_OBJECT_BYTES = 90 * 10**6         # single-request uploads only; nothing here is near this size
ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "f453f73f6bf89cdf05f91ad3396aaec8")
BUCKET = os.environ.get("R2_BUCKET", "city-pretty-data")
API = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def curl(args, binary_out=False):
    cmd = ["curl", "-sS", "-m", "300", "--retry", "3", "--retry-delay", "2"]
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    if tok:
        cmd += ["-H", f"Authorization: Bearer {tok}"]
    r = subprocess.run(cmd + args, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode()[:300])
    return r.stdout if binary_out else r.stdout.decode()


def api_json(args):
    d = json.loads(curl(args))
    if not d.get("success"):
        raise RuntimeError(f"Cloudflare API error: {d.get('errors')}")
    return d


def list_buckets():
    return [b["name"] for b in api_json([API]).get("result", {}).get("buckets", [])]


def list_objects(bucket):
    out, cursor = {}, None
    while True:
        url = f"{API}/{bucket}/objects?per_page=1000" + (f"&cursor={urllib.parse.quote(cursor)}" if cursor else "")
        d = api_json([url])
        for o in d.get("result", []):
            out[o["key"]] = {"size": int(o.get("size", 0)), "etag": str(o.get("etag", "")).strip('"')}
        info = d.get("result_info") or {}
        cursor = info.get("cursor")
        if not cursor or not (info.get("is_truncated") in (True, "true")):
            break
    return out


def account_usage():
    """Bytes stored in every bucket of the account, and this bucket's objects."""
    total, mine = 0, {}
    for b in list_buckets():
        objs = list_objects(b)
        total += sum(o["size"] for o in objs.values())
        if b == BUCKET:
            mine = objs
    return total, mine


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    dry, usage_only = "--dry-run" in sys.argv, "--usage" in sys.argv
    total, remote = account_usage()
    print(f"Stored in R2 now (all buckets): {total/1e9:.3f} GB of the {ALLOWANCE_BYTES/1e9:.0f} GB allowance; "
          f"this script stops at {CEILING_BYTES/1e9:.0f} GB. Bucket '{BUCKET}': {len(remote)} objects.")
    if total > CEILING_BYTES:
        sys.exit("STOP: storage is already above the ceiling. Do not upload. Tell the owner.")
    if usage_only:
        return
    cdir = os.path.join(ROOT, "counties")
    todo, add_bytes = [], 0
    for name in sorted(os.listdir(cdir)):
        if not (name.endswith(".json.gz") or name == "manifest.json"):
            continue
        path, key = os.path.join(cdir, name), "counties/" + name
        size = os.path.getsize(path)
        if size > MAX_OBJECT_BYTES:
            sys.exit(f"STOP: {name} is {size} bytes; too large for a single upload. Multipart is not allowed.")
        r = remote.get(key)
        if r and r["size"] == size and r["etag"] == md5(path):
            continue
        todo.append((path, key, size))
        add_bytes += size - (r["size"] if r else 0)
    projected = total + max(add_bytes, 0)
    print(f"To upload: {len(todo)} files, net +{add_bytes/1e9:.3f} GB. Projected total: {projected/1e9:.3f} GB.")
    if projected > CEILING_BYTES:
        sys.exit(f"STOP: this upload would take storage to {projected/1e9:.3f} GB, above the {CEILING_BYTES/1e9:.0f} GB "
                 "ceiling. Nothing was uploaded. Do not work around this; tell the owner.")
    if dry or not todo:
        return

    def put(item):
        path, key, size = item
        ctype = "application/json" if key.endswith(".json") else "application/gzip"
        d = json.loads(curl(["-X", "PUT", f"{API}/{BUCKET}/objects/{urllib.parse.quote(key)}",
                             "-H", f"Content-Type: {ctype}", "--data-binary", "@" + path]))
        return key, bool(d.get("success")), d.get("errors")

    failed = []
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for i, (key, ok, err) in enumerate(ex.map(put, todo), 1):
            if not ok:
                failed.append((key, err))
            if i % 100 == 0:
                print(f"  {i}/{len(todo)}")
    total2, remote2 = account_usage()
    print(f"Done. Stored in R2 now: {total2/1e9:.3f} GB. Bucket has {len(remote2)} objects. Failed: {len(failed)}")
    for k, e in failed[:10]:
        print("  failed:", k, e)
    if total2 > CEILING_BYTES:
        sys.exit("STOP: storage is above the ceiling after upload. Tell the owner now.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
