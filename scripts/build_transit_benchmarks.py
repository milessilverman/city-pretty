#!/usr/bin/env python3
"""Rebuild app/data/transit_cost_benchmarks.json from fetched sources.

Inputs (all fetched on 2026-11-18, kept in a scratch dir passed as argv[1]):
  tcp_sheet.csv      Transit Costs Project public sheet export (NYU Marron Institute), US rows only are used
  cig/<i>.txt        FTA Capital Investment Grants project profile PDFs converted with pdftotext -layout
  cigmeta.json       [state, city, project name, stage, page url] per FTA row
Nothing here is typed from memory: every number is parsed from those files and the verbatim snippet is stored.
"""
import csv, json, re, sys, os
S = sys.argv[1]
OUT = sys.argv[2]
KM = 1.609344

def flat(t): return re.sub(r'\s+', ' ', t)

rows = []
# ---- Transit Costs Project ----
sheet = list(csv.reader(open(os.path.join(S, 'tcp_sheet.csv'), encoding='utf-8')))
h = sheet[1]
R = [dict(zip(h, r)) for r in sheet[2:] if r]
def num(s):
    s = (s or '').replace(',', '').replace('%', '').strip()
    try: return float(s)
    except: return None
for x in R:
    if x.get('Country') != 'US': continue
    L = num(x['Length']); C = num(x['Cost']);
    if not L or not C: continue
    real25 = num(x['Real cost (2025 dollars)'])
    miles = L / KM
    tp = num(x['TunnelPer'])
    ref = x['Reference'].strip().split()[0] if x['Reference'].strip() else None
    rows.append({
        'id': 'tcp_' + re.sub(r'[^a-z0-9]+', '_', (x['City'] + '_' + x['Phase']).lower()).strip('_'),
        'project': x['Phase'], 'city': x['City'],
        'mode': 'regional_rail' if x['RR?'] == '1' else 'urban_rail',
        'mode_note': 'Transit Costs Project covers urban rail (metro/subway/light rail/regional-rail tunnels); the dataset has no heavy-vs-light flag, so mode is only urban_rail vs regional_rail (RR=1).',
        'status': ('opened_per_dataset_end_year_%s' % x['End year']) if x['End year'].isdigit() and int(x['End year']) <= 2025 else ('not_yet_open_per_dataset_end_year_%s' % x['End year']),
        'construction_start': int(x['Start year']) if x['Start year'].isdigit() else None,
        'construction_end': int(x['End year']) if x['End year'].isdigit() else None,
        'length_miles': round(miles, 2), 'length_km_source': L,
        'tunnel_share_pct': tp,
        'stations': int(num(x['Stations'])) if num(x['Stations']) else None,
        'cost_usd_millions': C, 'cost_basis': 'nominal USD as reported, dollar-year %s (TCP "Year" column; not inflation-adjusted)' % x['Year'],
        'dollar_year': int(x['Year']) if x['Year'].isdigit() else None,
        'cost_per_mile_usd_millions': round(C / miles, 1),
        'cost_2025_dollars_usd_millions': real25,
        'cost_per_mile_2025_dollars_usd_millions': round(real25 / miles, 1) if real25 else None,
        'excludes': 'rolling stock and sales tax in most rows (TCP notes: some rows include equipment; see Comments in source)',
        'source_dataset': 'Transit Costs Project, NYU Marron Institute, doi:10.58153/9wnjp-kez15',
        'source_url': 'https://docs.google.com/spreadsheets/d/16GoHcbW-eVzHUUP_XCWVXS1s_i3ZBnmZh4kvdSX7muU/export?format=csv',
        'dataset_landing_url': 'https://ultraviolet.library.nyu.edu/records/9wnjp-kez15',
        'reference_url': ref,
        'quote': 'sheet row: %s | %s | %s | Length %s km | Cost %s %s | Year %s' % (x['City'], x['Line'], x['Phase'], x['Length'], x['Cost'], x['Currency'], x['Year']),
        'verification': {'status': 'verified_in_fetched_dataset', 'checked_on': '2026-11-18',
                         'method': 'row parsed from fetched sheet export; cost and length are the dataset values, not independently re-derived from agency documents'},
    })

# ---- FTA project profiles ----
meta = json.load(open(os.path.join(S, 'cigrows.json')))
# (index, mode, length regex, cost regex) ; length/cost are parsed from the profile text
SPEC = {
 1: 'light_rail', 2: 'brt', 3: 'streetcar', 4: 'commuter_rail', 6: 'brt', 9: 'commuter_rail', 16: 'brt', 18: 'brt', 20: 'brt',
 22: 'brt', 28: 'brt', 31: 'brt', 33: 'brt', 36: 'brt', 37: 'light_rail', 39: 'brt',
}
NARR = {  # idx: (mode, length regex, cost regex)
 7: ('brt', r'approximately three miles', r'estimated capital cost is \$([\d.]+) million'),
 8: ('commuter_rail', r'along ([\d.]+) miles of the existing', r'current estimated capital cost is \$([\d.]+) million'),
 10: ('brt', r'along a (six)-mile corridor', r'estimated capital cost is \$([\d.]+) million'),
 11: ('brt', r'implement a ([\d.]+)-mile bus rapid transit', r'capital cost estimate is \$([\d.]+) million'),
 12: ('heavy_rail', r'is a ([\d.]+)-mile heavy rail', r'\(FFGA\) is \$([\d,.]+) million'),
 13: ('brt', r'construction of (three) miles', r'current estimated cost is \$([\d.]+) million'),
 15: ('brt', r'implement a ([\d.]+)-mile bus rapid transit', r'estimated capital cost is \$([\d.]+) million'),
 19: ('light_rail', r'implement a ([\d.]+)-mile light-rail', r'estimated capital cost is \$([\d.]+) billion'),
 25: ('heavy_rail', r'two track, ([\d.]+)-mile extension', r'SAS Phase 2 project is \$([\d,.]+) million'),
 26: ('brt', r'in an (11)-mile corridor', r'estimated capital cost is \$([\d.]+) million'),
 27: ('brt', r'in a (10)-mile corridor', r'estimated capital cost is \$([\d.]+) million'),
 32: ('brt', r'proposed ([\d.]+)-mile BRT', r'estimated capital cost is \$([\d.]+) million'),
 35: ('brt', r'implement a ([\d.]+)-mile bus rapid transit', r'estimated capital cost of the Project is \$([\d.]+) million'),
 38: ('brt', r'approximately ([\d.]+) miles to the Gulfton', r'estimated capital cost is \$([\d.]+) million'),
}
WORDS = {'three': 3.0, 'six': 6.0}
def tonum(s):
    s = s.replace(',', '')
    return WORDS.get(s, None) if s in WORDS else float(s)
for i, (st, city, name, stage, href) in enumerate(meta):
    fn = os.path.join(S, 'cig', '%d.txt' % i)
    if not os.path.exists(fn): continue
    t = flat(open(fn, errors='ignore').read())
    name = name.replace('&nbsp;', '').strip(); city = city.replace('&nbsp;', '').strip()
    prof = json.load(open(os.path.join(S, 'cigmeta.json')))[i] if os.path.exists(os.path.join(S, 'cigmeta.json')) else {}
    pdf = prof.get('pdf')
    mode = None; L = None; C = None; stations = None; cig = None; q = []
    if i in SPEC:
        m = re.search(r'Proposed Project: [A-Za-z ]+? ([\d.]+) Miles?,? ?(\d+)? ?Stations?', t)
        c = re.search(r'Total Capital Cost \(\$YOE\): \$([\d,\.]+) Million', t)
        g = re.search(r'Section 5309 CIG Share \(\$YOE\): \$([\d,\.]+) Million', t)
        if not (m and c): continue
        mode = SPEC[i]; L = float(m.group(1)); stations = int(m.group(2)) if m.group(2) else None
        C = float(c.group(1).replace(',', '')); cig = float(g.group(1).replace(',', '')) if g else None
        q = [m.group(0), c.group(0)]
    elif i in NARR:
        mode, lre, cre = NARR[i]
        m = re.search(lre, t); c = re.search(cre, t)
        if not (m and c): print('skip', i, name); continue
        L = tonum(m.group(1)) if m.groups() else 3.0
        C = float(c.group(1).replace(',', '')) * (1000 if 'billion' in cre else 1)
        q = [m.group(0), c.group(0)]
    else:
        continue
    fftext = 'FFGA' if re.search(r'under (?:a|the) Full Funding Grant Agreement|FFGA', t) and i in (12, 23, 25) else None
    rows.append({
        'id': 'fta_' + re.sub(r'[^a-z0-9]+', '_', (city + '_' + name).lower()).strip('_'),
        'project': name, 'city': city, 'state': st,
        'mode': mode,
        'status': 'FTA CIG %s' % stage + (' (construction grant agreement in place)' if stage == 'FFGA' else ' (estimate at development stage, not a final or built cost)'),
        'length_miles': L, 'stations': stations,
        'cost_usd_millions': C,
        'cost_basis': 'sponsor total capital cost in year-of-expenditure dollars as shown in the FTA project profile (profile dates differ by project)',
        'cost_per_mile_usd_millions': round(C / L, 1),
        'cig_share_usd_millions': cig,
        'tunnel_share_pct': None,
        'source_dataset': 'FTA Capital Investment Grants project profile',
        'source_url': pdf,
        'listing_url': 'https://www.transit.dot.gov/funding/grant-programs/capital-investments/current-capital-investment-grant-cig-projects',
        'quote': ' ... '.join(q),
        'retrieval_note': 'transit.dot.gov returns 403 to this environment; the PDF was read from an Internet Archive copy (web.archive.org/web/2026/...) of the FTA file',
        'verification': {'status': 'verified_in_fetched_pdf', 'checked_on': '2026-11-18', 'method': 'regex over pdftotext of the FTA profile PDF; quote is verbatim'},
    })
json.dump({'meta': {'generated': '2026-11-18', 'rule': 'every number is parsed from a fetched source; see quote + source_url per row'}, 'rows': rows}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(len(rows), sum(1 for r in rows if r['id'].startswith('tcp_')), sum(1 for r in rows if r['id'].startswith('fta_')))
