#!/usr/bin/env python3
"""Generate research/transit_verification.csv: one row per checked item across the transit data files (2026-11-18)."""
import json, csv, subprocess
R = '/home/user/city-pretty/'
# last commit before the 2026-11-18 re-verification (the checkpoint commit 81974cc already contains new data)
BASE = {'app/data/intercity_transit_corridors.json': '9d00f3c', 'app/data/transit_pipelines.json': 'ff6b849'}
def head(path):
    return json.loads(subprocess.run(['git', '-C', R, 'show', BASE[path] + ':' + path], capture_output=True, text=True).stdout)
cols = ['file', 'record', 'field', 'old_value', 'new_value', 'status', 'source_url', 'evidence_quote', 'checked_on']
rows = []
def add(*a): rows.append(list(a) + ['2026-11-18'])

# pipelines
old = {p['fips']: p for p in head('app/data/transit_pipelines.json')}
new = json.load(open(R + 'app/data/transit_pipelines.json'))
for p in new:
    o = old.get(p['fips'], {})
    src = p['verification']['sources'][0].split(' (')[0]
    ev = ' | '.join(p['verification']['evidence'])
    for f in ('title', 'agency', 'status', 'adopted_year', 'length_miles', 'total_capital_cost_musd', 'cig_share_musd'):
        if f in p or f in o:
            add('transit_pipelines.json', p['fips'] + ' ' + p['title'], f, o.get(f), p.get(f), 'corrected' if o.get(f) != p.get(f) and p.get(f) is not None else ('nulled' if p.get(f) is None else 'verified'), src, ev)
    add('transit_pipelines.json', p['fips'] + ' ' + p['title'], 'stations', '%d typed stations' % len(o.get('stations', [])), '%d stations with OSM coordinates; %d verified names' % (len(p['stations']), len(p.get('station_names_verified', []))), 'rebuilt', src, p['verification'].get('station_note', ''))
    for f in ('units', 'affordPct', 'retailSqft', 'p3Type'):
        add('transit_pipelines.json', p['fips'] + ' ' + p['title'], f, o.get(f), None, 'nulled_unsourced', '', 'no source found for this figure')
# corridors
oc = {c['id']: c for c in head('app/data/intercity_transit_corridors.json')}
for c in json.load(open(R + 'app/data/intercity_transit_corridors.json')):
    o = oc.get(c['id'], {})
    q = (c.get('cid_selection') or {}).get('quote', c['funding_status'])
    add('intercity_transit_corridors.json', c['id'], 'corridor_real_per_FRA_FY22_list', o.get('funding_status'), c['funding_status'], c['verification']['status'], c['source_url'], q)
    for f in ('route_length_miles', 'max_speed_mph', 'projected_one_way_minutes', 'highway_comparison_minutes', 'estimated_capital_cost_billions'):
        add('intercity_transit_corridors.json', c['id'], f, o.get(f), None, 'nulled_unsourced', '', 'not in the FRA selection document; no published study fetched')
    add('intercity_transit_corridors.json', c['id'], 'proposed_stations', '%d typed stations with home value/land cost/acres' % len(o.get('proposed_stations', [])), '%d city-centre stations (illustrative_city_center)' % len(c['proposed_stations']), 'rebuilt', c['source_url'], 'per-station numbers removed; names are cities named in the FRA text')
    add('intercity_transit_corridors.json', c['id'], 'candidate_railyard_sites', '%d typed sites (acres, $/acre)' % len(o.get('candidate_railyard_sites', [])), '[]', 'removed_unsourced', '', 'no published railyard siting study fetched')
# unit costs
before = json.load(open('/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/transit/unit_costs.before.json'))
after = json.load(open(R + 'app/data/unit_costs.json'))
for b, a in zip(before, after):
    st = a['verification']['status']
    s = 'corrected' if (b['unit_price'] != a['unit_price'] and a['unit_price'] is not None) else ('nulled' if b['unit_price'] is not None and a['unit_price'] is None else ('verified' if st == 'verified_in_fetched_document' else st))
    add('unit_costs.json', '%s %s %s' % (a['item'], a['state'], a.get('item_code') or ''), 'unit_price', b['unit_price'], a['unit_price'], s, a['source_url'], a['verification']['note'])
# benchmarks
for r in json.load(open(R + 'app/data/transit_cost_benchmarks.json'))['rows']:
    add('transit_cost_benchmarks.json', r['id'], 'cost_usd_millions/length_miles', None, '%s / %s' % (r['cost_usd_millions'], r['length_miles']), r['verification']['status'], r['source_url'], r['quote'])
for r in json.load(open(R + 'app/data/transit_value_effects.json'))['rows']:
    add('transit_value_effects.json', r['id'], 'effect_pct', None, r['effect_pct'], r['verification']['status'], r['source_url'], r['quote'][:300])
with open(R + 'research/transit_verification.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(cols); w.writerows(rows)
print(len(rows))
