"""Small shared helper: paged Socrata (SODA) downloads from data.transportation.gov with retries.
Honours HTTPS_PROXY and uses the CA bundle named by SSL_CERT_FILE / the agent bundle if present."""
import json, os, ssl, sys, time, urllib.parse, urllib.request

HOST = "https://data.transportation.gov"
UA = "city-pretty-data-fetch/1.0"


def _ctx():
    for p in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if p and os.path.exists(p):
            return ssl.create_default_context(cafile=p)
    return ssl.create_default_context()


def get(url, tries=4, timeout=180):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


def view_meta(host, dataset_id):
    d = json.loads(get(f"{host}/api/views/{dataset_id}.json"))
    return {
        "dataset_id": dataset_id,
        "name": d.get("name"),
        "rows_updated_at_utc": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(d["rowsUpdatedAt"])) if d.get("rowsUpdatedAt") else None,
        "licence": (d.get("license") or {}).get("name"),
        "licence_terms_link": (d.get("license") or {}).get("termsLink"),
        "attribution": d.get("attribution"),
        "landing_url": f"{host}/d/{dataset_id}",
        "api_url": f"{host}/resource/{dataset_id}.json",
        "description": (d.get("description") or "")[:600],
    }


def fetch_all(dataset_id, host=HOST, where=None, select=None, order=":id", page=50000):
    out, off = [], 0
    while True:
        q = {"$limit": page, "$offset": off, "$order": order}
        if where: q["$where"] = where
        if select: q["$select"] = select
        rows = json.loads(get(f"{host}/resource/{dataset_id}.json?" + urllib.parse.urlencode(q)))
        out.extend(rows)
        sys.stderr.write(f"  {dataset_id} offset {off}: +{len(rows)}\n")
        if len(rows) < page:
            return out
        off += page
