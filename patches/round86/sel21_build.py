"""build_oc text for fetch_oc selection 21: plain-language download errors, a 'Not located' sentence for feeds tried in every county of
their state that could not be downloaded, skipped feeds listed only where they have a stop in the county's box, long route lists cut at a
whole entry. Text only."""
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, old[:80])
    s = s.replace(old, new)

rep('''import os, sys, json, gzip, base64, statistics, math, collections, datetime
''', '''import os, sys, json, gzip, base64, statistics, math, collections, datetime, re
''')

rep('''def _not_counted(tr):
    """skipped feeds, less the copies of a feed that is counted from another copy or read with no stop here (Gold Coast Transit 32: its
    hosted copy ended over a year ago and its legacy mirror is read)"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    return [x for x in (tr.get("skipped") or []) if x["id"] not in counted]
''', '''STATE_NAMES = dict(zip("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(),
    ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
     "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
     "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
     "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Puerto Rico", "Rhode Island", "South Carolina",
     "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]))
ERR_COPY = {"hosted": "MobilityData's hosted copy", "legacy mirror": "MobilityData's legacy mirror", "producer URL": "the operator's own URL",
            "TransitFeeds archive": "the TransitFeeds archive", "Cal-ITP statewide tables": "the State's Cal-ITP tables"}


def _and(xs):
    """'a', 'a and b', 'a, b and c'"""
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def _err_text(part):
    """one download error as fetch_oc records it ("<copy>: <the exception's text, cut at 50 characters>") in plain words"""
    kind, _, err = part.partition(": ")
    who = ERR_COPY.get(kind.strip(), kind.strip())
    code = re.search(r"HTTPError:? (\\d{3})", err)
    if "Tunnel connection failed" in err:   # the build machine's network proxy refuses the host
        what = "cannot be reached from the build machine"
    elif code:
        what = {"403": "is not available (HTTP 403)", "404": "is not found (HTTP 404)", "410": "is gone (HTTP 410)"}.get(code.group(1), f"answered HTTP {code.group(1)}")
    elif re.search(r"timed? ?out|Timeout", err, re.I):
        what = "timed out"
    elif "BadZipFile" in err:
        what = "does not serve a zip file"
    elif re.search(r"RemoteDisconnected|ConnectionReset|IncompleteRead|ConnectionAborted", err):
        what = "dropped the connection"
    elif re.search(r"Name or service not known|getaddrinfo|nodename nor servname|name resolution", err):
        what = "has a host name that does not resolve"
    elif re.search(r"CERTIFICATE_VERIFY_FAILED|SSLError|SSLCertVerification", err):
        what = "failed its certificate check"
    else:
        what = "could not be downloaded"
    return f"{who} {what}"


def _why_text(why):
    """a skipped feed's reason as the page shows it (selection 21): download errors in plain words, and a long list of routes counted from
    other feeds cut at a whole entry"""
    pre = "no copy could be downloaded ("
    if why.startswith(pre):
        body, tail = why[len(pre):], ""
        k = body.find("); its Cal-ITP copy")
        if k >= 0:
            body, tail = body[:k], body[k + 3:]
        elif body.endswith(")"):
            body = body[:-1]
        parts = [q for q in re.split(r"; (?=(?:" + "|".join(map(re.escape, ERR_COPY)) + r"): )", body) if q.strip()]
        return "no copy could be downloaded: " + _and([_err_text(q) for q in parts]) + ("; " + tail if tail else "")
    if why.startswith("feed could not be read ("):
        m = re.match(r"feed could not be read \\((\\w+)", why)
        return "the feed could not be read" + (f" ({m.group(1)})" if m else "")
    pre = "its routes are counted from other feeds: "
    if why.startswith(pre) and len(why) > len(pre) + 240:
        items, out = why[len(pre):].split("; "), []
        for it in items:
            if out and len("; ".join(out + [it])) > 240:
                break
            out.append(it)
        return pre + "; ".join(out) + (f"; and {len(items) - len(out)} more" if len(out) < len(items) else "")
    return why


def _unlocated(x):
    """a feed tried in every county of its state, the catalog giving it no area, of which no copy could be downloaded (selection 21)"""
    return bool(x.get("unlocated")) and (x.get("why") or "").startswith("no copy could be downloaded")


def _not_counted(tr):
    """skipped feeds, less the copies of a feed that is counted from another copy or read with no stop here (Gold Coast Transit 32: its
    hosted copy ended over a year ago and its legacy mirror is read); since selection 21 also less feeds read with no stop in the county's
    box (stops_in_county 0: Fresno State University's feed was listed in all 56 California counties) and unlocated feeds (_not_located)"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    return [x for x in (tr.get("skipped") or []) if x["id"] not in counted and x.get("stops_in_county", 1) > 0 and not _unlocated(x)]


def _not_located(tr):
    """the sentence naming unlocated feeds (selection 21), each once, with their download errors in plain words; '' when there are none"""
    counted = {f["id"] for f in (tr.get("feeds") or []) + (tr.get("read_no_stops_here") or [])}
    nl = [x for x in (tr.get("skipped") or []) if _unlocated(x) and x["id"] not in counted]
    if not nl:
        return ""
    by = collections.OrderedDict()
    for x in nl:
        by.setdefault(x["provider"].strip(), []).append(x["id"])
    names = [f"{pv} (MobilityData {', '.join(dict.fromkeys(ids))})" for pv, ids in by.items()]
    err = {pv: list(dict.fromkeys(_why_text(x["why"]).split(": ", 1)[1] for x in nl if x["provider"].strip() == pv)) for pv in by}
    one = len(names) == 1
    where = "municipio of Puerto Rico" if region.STATE == "PR" else f"{STATE_NAMES.get(region.STATE, region.STATE)} county"
    variants = list(dict.fromkeys(e for v in err.values() for e in v))
    why = ("no copy could be downloaded: " + "; ".join(variants) if one else
           "none could be downloaded: for each, " + variants[0] if len(variants) == 1 else
           "none could be downloaded: " + "; ".join(f"{pv}: {'; '.join(v)}" for pv, v in err.items()))
    return (f". Not located: {_and(names)}: MobilityData's catalog gives {'this feed' if one else 'these feeds'} no area, so {'it was' if one else 'each was'} "
            f"tried in every {where}, and {why}")
''')

rep('''(". Not included: " + "; ".join(dict.fromkeys(f"{x['provider']} (MobilityData {x['id']}: {x['why']})" for x in _not_counted(tr))) if _not_counted(tr) else "")''',
    '''(". Not included: " + "; ".join(dict.fromkeys(f"{x['provider'].strip()} (MobilityData {x['id']}: {_why_text(x['why'])})" for x in _not_counted(tr))) if _not_counted(tr) else "") + _not_located(tr)''')

open(p, "w").write(s)
print("sel21 build patch applied to", p)
