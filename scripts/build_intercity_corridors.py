#!/usr/bin/env python3
"""Rebuild app/data/intercity_transit_corridors.json.
argv[1]=pdftotext of FRA 'FY22 Corridor Identification and Development Program Selections' (cid.txt)
argv[2]=cities.json (Nominatim city-centre coordinates + Census county FIPS, fetched 2026-11-18)
Only facts that appear in the FRA document are recorded; everything else is null."""
import json, re, sys
cid = re.sub(r'\s+', ' ', open(sys.argv[1]).read()).replace('\u2019', "'")
C = json.load(open(sys.argv[2]))
FRA_URL = 'https://railroads.dot.gov/sites/fra.dot.gov/files/2025-02/FY22%20CID%20Project%20Summaries-Map-r3.pdf'
def q(s):
    s = re.sub(r'\s+', ' ', s); assert s in cid, s; return s
def stn(cid_, key, name, st_label):
    c = C[key]
    city = key.split(',')[0]
    return dict(id='%s_%s' % (cid_, re.sub(r'\W+', '_', city.lower())), name=name, city=city, county=c['county'].replace(' County', ''), fips=c['fips'],
        station_type='city_center', station_basis='illustrative_city_center', lat=c['lat'], lng=c['lon'],
        coordinate_source='Nominatim (OpenStreetMap) city centre, osm %s; county FIPS from Census geocoder, retrieved 2026-11-18' % c['osm'],
        why_listed=st_label,
        median_home_value_walkshed=None, avg_land_cost_per_sqft=None, available_underused_acres_walkshed=None,
        statutory_housing_regime=None, recommended_redevelopment_focus=None)
def corridor(id_, name, states, cat, header, text_quote, sponsor_label, leads, step_note, stations, extra=None):
    q(header); q(text_quote)
    d = dict(id=id_, name=name, states=states, route_length_miles=None, route_length_basis='not stated in the FRA selection document; no study fetched',
        lead_agencies=leads, funding_status='FRA Corridor Identification and Development Program selection (FY22): up to $500,000 for planning. Not a construction grant.',
        official_study_url=FRA_URL, source_url=FRA_URL, last_verified='2026-11-18',
        corridor_type=cat, max_speed_mph=None, projected_one_way_minutes=None, highway_comparison_minutes=None, estimated_capital_cost_billions=None,
        federal_match_program=None, cid_selection=dict(program='FRA Corridor ID Program', selection_round='FY22', sponsor=sponsor_label, step_note=step_note, header=header, quote=text_quote),
        proposed_stations=stations, candidate_railyard_sites=[],
        verification=dict(status='verified_in_fetched_document', checked_on='2026-11-18',
            method='FRA selection PDF read through an Internet Archive copy of the railroads.dot.gov file (the FRA host returns 403 here); header and quote located verbatim.',
            nulled='length, speed, trip time, highway time, capital cost, per-station home values, land costs, acres, housing-law text and railyard sites: no published study fetched, so null/empty'))
    if extra: d.update(extra)
    return d
R = []
R.append(corridor('corridor_phx_tus', 'Phoenix-Tucson Corridor', ['AZ'], 'new_conventional_rail',
    'Phoenix-Tucson Corridor (Up to $500,000) Arizona Department of Transportation',
    'The proposed corridor would reconnect Phoenix (Buckeye) to Tucson, AZ, with multiple daily frequencies.',
    'Arizona Department of Transportation', ['Arizona Department of Transportation (ADOT)'], 'Step 1',
    [stn('phx_tus', 'Phoenix,AZ', 'Phoenix', 'named endpoint in the FRA selection text ("Phoenix (Buckeye)"); position illustrative'), stn('phx_tus', 'Tucson,AZ', 'Tucson', 'named endpoint in the FRA selection text')]))
R.append(corridor('corridor_front_range', 'Colorado Front Range Corridor', ['CO'], 'new_conventional_rail',
    'Colorado Front Range Corridor (Up to $500,000) Front Range Passenger Rail District',
    'The proposed corridor would connect Fort Collins to Pueblo, CO, with intermediate stops in Boulder, Denver, Colorado Springs, CO, and other points.',
    'Front Range Passenger Rail District', ['Front Range Passenger Rail District'], 'Step 2 (a Service Development Plan was already being funded under a prior FRA grant, per the document footnote)',
    [stn('front_range', k, k.split(',')[0], 'named in the FRA selection text') for k in ('Fort Collins,CO', 'Boulder,CO', 'Denver,CO', 'Colorado Springs,CO', 'Pueblo,CO')]))
R.append(corridor('corridor_brightline_west', 'Brightline West High-Speed Corridor', ['CA', 'NV'], 'new_high_speed_rail',
    'Brightline West High-Speed Corridor (Up to $500,000) Nevada Department of Transportation',
    'The proposed corridor would connect Rancho Cucamonga, CA, to Las Vegas, NV, providing new service on a new high-speed rail alignment with intermediate stops at Hesperia and Victorville, CA.',
    'Nevada Department of Transportation', ['Nevada Department of Transportation (CID sponsor)', 'Brightline West'], 'Step 1',
    [stn('brightline_west', k, k.split(',')[0], 'named in the FRA selection text') for k in ('Rancho Cucamonga,CA', 'Hesperia,CA', 'Victorville,CA', 'Las Vegas,NV')],
    extra=dict(funding_note_unverified='Earlier file text claimed a $3.0B FRA construction grant and "under construction"; that is not in the FRA selection document and no source was fetched, so it is removed.')))
R.append(corridor('corridor_cascadia_hsgt', 'Cascadia High-Speed Ground Transportation', ['WA', 'OR'], 'new_high_speed_rail',
    'Cascadia High-Speed Ground Transportation (Up to $500,000) Washington State Department of Transportation',
    'The proposed corridor would connect Vancouver, Canada to Portland, OR, via Seattle, WA, with a potential future extension south to Eugene, OR.',
    'Washington State Department of Transportation', ['Washington State Department of Transportation'], 'Step 1',
    [stn('cascadia', k, k.split(',')[0], 'named in the FRA selection text (Vancouver, Canada omitted: no US county)') for k in ('Seattle,WA', 'Portland,OR', 'Eugene,OR')]))
R.append(corridor('corridor_hou_sat', 'Houston to San Antonio Corridor', ['TX'], 'new_conventional_rail',
    'Houston to San Antonio Corridor (Up to $500,000) Texas Department of Transportation',
    'The proposed corridor would connect Houston and San Antonio, TX, with a new conventional intercity passenger rail service using the route of Amtrak\'s existing long-distance Sunset Limited service.',
    'Texas Department of Transportation', ['Texas Department of Transportation (TxDOT)'], 'Step 1',
    [stn('hou_sat', k, k.split(',')[0], 'named in the FRA selection text') for k in ('Houston,TX', 'Rosenberg,TX', 'Flatonia,TX', 'Seguin,TX', 'San Antonio,TX')]))
# Austin-San Antonio: NOT in the FRA FY22 list
assert 'Austin' not in cid
R.append(dict(id='corridor_atx_sat', name='Austin-San Antonio passenger rail (unverified corridor)', states=['TX'], route_length_miles=None,
    route_length_basis='no source fetched', lead_agencies=[], funding_status='No FRA Corridor ID selection found: the FY22 selection list fetched on 2026-11-18 contains no Austin-San Antonio corridor (the word "Austin" does not appear in it). Earlier file text claiming a $500k Corridor ID step-1 award is not supported.',
    official_study_url=FRA_URL, source_url=FRA_URL, last_verified='2026-11-18', corridor_type=None, max_speed_mph=None, projected_one_way_minutes=None, highway_comparison_minutes=None,
    estimated_capital_cost_billions=None, federal_match_program=None, cid_selection=None,
    proposed_stations=[stn('atx_sat', 'Austin,TX', 'Austin', 'illustrative: no published station plan fetched'), stn('atx_sat', 'San Antonio,TX', 'San Antonio', 'illustrative: no published station plan fetched')],
    candidate_railyard_sites=[],
    verification=dict(status='corridor_not_confirmed', checked_on='2026-11-18', method='searched the FRA FY22 selection PDF for the corridor; absent', nulled='everything except the endpoint cities')))
json.dump(R, open('/home/user/city-pretty/app/data/intercity_transit_corridors.json', 'w'), indent=1, ensure_ascii=False)
print(len(R))
