#!/usr/bin/env python3
"""Apply the 2026-11-18 re-verification of app/data/unit_costs.json (and regenerate research/unit_costs.csv).
Each OVERRIDE below was read from the source document fetched on 2026-11-18 (see 'quote' and 'fetched_via')."""
import json, csv
P = '/home/user/city-pretty/app/data/unit_costs.json'
d = json.load(open(P))
DATE = '2026-11-18'
IA = ' (original host returns 403/404/cert error here; read through an Internet Archive copy)'
# idx: dict of overrides.  price_basis says what the number is.
O = {
 0: dict(unit_price=None, status='unverified_unreachable', item_code='05316001', fetched_via='https://ftp.txdot.gov serves an incomplete TLS chain; curl cannot verify it and http is refused by the proxy; no archive copy',
         verification_note='Could not fetch the TxDOT monthly estimate; previous $92/SY not confirmed, nulled.'),
 1: dict(unit_price=None, status='unverified_unreachable', item_code='05316004', fetched_via='same as above', verification_note='Could not fetch; previous $2,994/EA nulled.'),
 2: dict(unit_price=None, status='unverified_unreachable', item_code='06106191', fetched_via='same as above', verification_note='Could not fetch; previous $5,500/EA nulled.'),
 3: dict(item_code='0522 1', period='2025-10-01 to 2026-09-30', region='Florida statewide', price_basis='FDOT weighted average of awarded contracts (122 contracts)', verification_note='Verified: row "0522 1 122 $67.54 ... 154,926 SY CONCRETE SIDEWALK AND DRIVEWAYS, 4\" THICK".'),
 4: dict(item_code='0654 2 21', period='2025-10-01 to 2026-09-30', region='Florida statewide', price_basis='FDOT weighted average, only 3 contracts / 10 units - thin', verification_note='Verified: row "0654 2 21 3 $14,288.83 ... 10 AS MIDBLOCK CROSSWALK: RECTANGULAR RAPID FLASHING BEACON".'),
 5: dict(item_code='0521 72 27', period='2025-10-01 to 2026-09-30', region='Florida statewide', price_basis='FDOT weighted average of awarded contracts', verification_note='Verified: row "0521 72 27 3 $909.87 ... 5,866 LF SHOULDER CONCRETE BARRIER WALL, 14\' NOISE WALL".'),
 6: dict(unit_price=45, item_code='155', period='bids received 2026-09-25', region='Gwinnett County, GA', price_basis="awarded bidder's (The Dickerson Group) unit bid in one contract (BL129-26)",
         quote="155 CONC SIDEWALK, 4 IN ... 4,398 SY ... $45.00 (Dickerson column of the second tab; total $1,248,247.84 = awarded amount)",
         verification_note='CORRECTED from $42: the $42.00 values sit in the first tab columns of other bidders; the awarded bidder Dickerson bid $45.00/SY. County bid, not a DOT.'),
 7: dict(item_code='2591000000-E (848)', period='letting 2026-09-22', region='NCDOT Division 4 (Johnston Co.)', price_basis='low bidder (Allen Grading, contract total $860,737.00) unit bid, one project', verification_note='Verified: 4" CONCRETE SIDEWALK 650 SY 64.00 in the lowest-total column.'),
 8: dict(item_code='2605000000-N (848)', period='letting 2026-09-22', region='NCDOT Division 4 (Johnston Co.)', price_basis='low bidder unit bid, 3 ramps only - weak sample', verification_note='Verified: CONCRETE CURB RAMPS 3 EA 1,550.00 (other bidders $2,550-2,750; same project second tab $5,000).'),
 9: dict(item_code='608', period='bids May 2024', region='Piqua, OH', price_basis="awarded low bidder's (Grissom Construction) unit bid; city bid not DOT", verification_note='Verified: 608 - CONCRETE WALK (6" NON-REINFORCED QC1) - SF $14.00; resolution says lowest bidder.'),
 10: dict(item_code='6', period='bids 2025-05-27', region='Perkasie, PA', price_basis='apparent low bidder (NJS Concrete) unit bid; borough bid', verification_note='Verified: Concrete Sidewalk (4") - Install 982 SF $24.00 in NJS column; other bidders $18-28.50.'),
 11: dict(item_code='14', period='2025', region='Villa Park, IL', price_basis='lowest-total bidder (Davis Concrete, as-read total $288,352) unit bid; village bid', verification_note='Verified: PORTLAND CEMENT CONCRETE SIDEWALK, 5" 11,000 SQFT $8.50.'),
 12: dict(item_code='8030044', period='bids 2025-03-27', region='Kalamazoo, MI', price_basis='lowest-total bidder (Michigan Paving Materials, $860,623.60) unit bid; city bid', verification_note='Verified: 8030044 Sidewalk, Conc, 4 inch SFT 403 $12.64.'),
 13: dict(item_code='12', period='bids 2025-03-13', region='Mesa, AZ', price_basis='lowest Base+Alt 1 bidder (Granite Construction, $16,481,880; award basis) unit bid; city bid', verification_note='Verified: item 12 CONCRETE SIDEWALK, MAG DET 230, 11,936 SF, Granite $34.00 (others $12.60-13.00 - high outlier, single contract).'),
 14: dict(item_code='14', period='bids 2025-03-13', region='Mesa, AZ', price_basis='Granite Construction unit bid (award basis low bidder); city bid', verification_note='Verified: SIDEWALK RAMP, COM DET M-44.02, TYPE A 6 EA 8,500.00 (others $4,296-6,000).'),
 15: dict(unit_price=108.02, item_code='608-00000', period='calendar 2025', region='Colorado statewide (CDOT)', price_basis='CDOT weighted average awarded bid for the year, 5,906.10 SY across projects',
         quote='608-00000 Conc Sidewalk Sq Yard ... Weighted Average for the Year 5,906.10 86.24 107.62 108.02 (Engr. Est. / Average Bid / Awarded Bid)',
         document='CDOT 2025 Cost Data, Item Unit Costs by Projects (compiled Feb 3 2026)', fetched_via='web.archive.org copy of codot.gov 2025-cost-data-book.pdf',
         verification_note='CORRECTED from $110 (a single project, I-25C Walsenburg, 220 SY) to the statewide weighted average awarded bid $108.02/SY.'),
 16: dict(item_code='8-14', period='bid 2025', region='Clark County, WA', price_basis='lowest-total bidder (Thompson Bros, $7,406,494.50) unit bid; county bid', verification_note='Verified: 8-14 CEMENT CONC. SIDEWALK S.Y. 3170 $138.00 in Bidder #1 column (engineer estimate $100).'),
 17: dict(item_code='701', period='2025', region='Gardner, MA', price_basis='lowest-total bidder (Massachusetts Broken Stone, $1,592,920) unit bid; city bid', verification_note='Verified: 701 Concrete Sidewalk (Monolithic) 800 SY $80.00.'),
 18: dict(item_code='701.2', period='2025', region='Gardner, MA', price_basis='lowest-total bidder unit bid, 8 ramps', verification_note='Verified: 701.2 Concrete Handicap Ramps 8 Each $2,000.00 (others $980-1,500).'),
 19: dict(unit_price=245, item_code='1', period='bids 2025', region='New Rochelle, NY', price_basis='lowest-total bidder (last column, total $251,060) unit bid; city bid', quote='Concrete Sidewalk 5" thick 4500 psi 700 SY: bid columns $237.01 (Peduto, total $266,557), $270, $485, $290, $585, $315, $245 (lowest total $251,060)',
         verification_note='CORRECTED from $237.01: that is Peduto Construction\'s bid (second-lowest total); the lowest-total bidder bid $245/SY. Award not confirmed in the tab.'),
 20: dict(item_code='2521518/00040', period='2025-01-01 to 2025-12-31', region='Minnesota statewide (MnDOT, state-aid excluded)', price_basis='MnDOT average bid price for awarded contracts (21 contracts, 231,359 SF)', verification_note='Verified: 2521518/00040 4" CONCRETE WALK SF 231,359 $1,915.65 (000s) $8.28 21.'),
 21: dict(item_code='sidewalk 7,000 SF line', period='bids 2025-03-20', region='Des Peres, MO', price_basis='awarded contract unit price (SIC Concrete); city', verification_note='Verified: SIC Concrete $11.25 sidewalk; resolution authorizes the contract.'),
 22: dict(item_code='701-01.01', period='2025-01-01 to 2025-06-30', region='Tennessee statewide (TDOT)', price_basis='TDOT average unit price of awarded contracts (288,960 SF)', fetched_via='web.archive.org copy of tn.gov Const_aup2025.pdf (tn.gov returns 403)', verification_note='Verified: 701-01.01 CONCRETE SIDEWALK (4 ") S.F. STATE $7.19 $2,076,649.76 288960.00.'),
 23: dict(item_code='0947253', period='letting 2025-06-25', region='CTDOT contract 0301-0130 (New Haven)', price_basis='lowest bidder (Yonkers Contracting, $159.6M total) unit bid inside a rail car-shop rehabilitation contract; not street speed-hump pricing', verification_note='Verified: 0947253 SPEED HUMP 3 ea 6,000.00; weak sample.'),
 24: dict(item_code=None, period='awarded 2025-12-18', region='Chatham County, GA', price_basis='lump sum award to KOMPAN, Inc. for one playground replacement', verification_note='Verified: BID 25-0092-2 GREENBRIAR PLAYGROUND REPLACEMENT, AWARDED TO KOMPAN, AMOUNT AWARDED $207,666.'),
 25: dict(item_code='37', period='change order approved 2023-01-30', region='Sarasota Bradenton Intl Airport, FL', price_basis='contractor change-order schedule line (4 shelters incl. foundation design/engineering)', fetched_via='web.archive.org copy of flysrq.com agenda PDF (flysrq.com returns 403)', verification_note='Verified: "Bus Shelters, concrete foundation design and engineering, installed ... 4.0 EA $31,555.62 $126,222.46". Not a DOT price.'),
}
for i, x in enumerate(d):
    o = O.get(i, {})
    for k, v in o.items():
        if k in ('verification_note', 'fetched_via'): continue
        x[k] = v
    x.setdefault('item_code', None); x.setdefault('period', None); x.setdefault('region', x.get('city_or_region'))
    x.setdefault('price_basis', None)
    if i in O:
        x['last_verified'] = DATE if O[i].get('status') is None else None
        x['verification'] = dict(status=('verified_in_fetched_document' if O[i].get('status') is None else O[i]['status']), checked_on=DATE,
                                 url_fetched=x['source_url'], fetched_via=O[i].get('fetched_via', 'direct'), note=O[i]['verification_note'])
    else:
        x['last_verified'] = None
        x['verification'] = dict(status='no_source_never_found' if x['unit_price'] is None and not x['source_url'] else 'not_rechecked', checked_on=DATE, url_fetched=x['source_url'], fetched_via=None,
                                 note='No price on file (earlier search found no awarded unit price); nothing typed in its place.' if x['unit_price'] is None else 'not rechecked')
    if x['unit_price'] is None and x['status'] == 'confirmed': x['status'] = 'unverified'
json.dump(d, open(P, 'w'), indent=1, ensure_ascii=False)
cols = ['state', 'city_or_region', 'item', 'item_code', 'unit_price', 'unit', 'period', 'region', 'price_basis', 'source_agency', 'document', 'status', 'source_url', 'quote', 'checked_on', 'verification_note', 'notes']
with open('/home/user/city-pretty/research/unit_costs.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(cols)
    for x in d:
        w.writerow([x.get('state'), x.get('city_or_region'), x['item'], x.get('item_code'), x['unit_price'], x['unit'], x.get('period'), x.get('region'), x.get('price_basis'), x['source_agency'], x['document'], x['status'], x['source_url'], x['quote'], DATE, x['verification']['note'], x['notes']])
import collections; print(collections.Counter(x['status'] for x in d))
