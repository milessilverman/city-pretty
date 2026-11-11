"""Name-aware merge for added GTFS rail stops (round 8.5 candidate): an addition is a duplicate of a kept or already added station within
150 m, or within 300 m when the two names match (token sets, abbreviations expanded, generic words dropped: Jaccard >= 0.5) or the
addition is Amtrak's (its feed names stops by city: "Boston" at South Station)."""
import re
ABBR = {"hts": "heights", "av": "avenue", "ave": "avenue", "blvd": "boulevard", "sq": "square", "pkwy": "parkway", "ctr": "center",
        "centre": "center", "mt": "mount", "ft": "fort", "pt": "point", "jct": "junction", "n": "north", "s": "south", "e": "east",
        "w": "west", "saint": "st", "st.": "st"}
GENERIC = {"station", "stn", "rail", "railway", "train", "metro", "amtrak", "caltrain", "metrolink", "transit", "transportation", "center",
           "the", "at", "and", "of", "st", "street", "line", "platform", "stop"}
def tokens(name):
    t = [ABBR.get(w, w) for w in re.findall(r"[a-z0-9]+", (name or "").lower().replace("&", " and "))]
    return {w for w in t if w not in GENERIC}
def similar(a, b):
    x, y = tokens(a), tokens(b)
    return bool(x and y) and len(x & y) / len(x | y) >= 0.5
def duplicate(d, add_name, add_fid, other_name):
    return d <= 150.0 or (d <= 300.0 and (str(add_fid) == "11" or similar(add_name, other_name)))
