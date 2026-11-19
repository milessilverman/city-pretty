#!/usr/bin/env python3
"""Build app/data/transit_value_effects.json from papers fetched on 2026-11-18.
argv[1] = scratch dir holding t4023.txt (pdftotext -layout of papers.tinbergen.nl/04023.pdf), portland.txt, hia.txt
Every row's quote is checked to occur verbatim (whitespace-normalised) in the fetched text before it is written."""
import json, re, sys, os
S, OUT = sys.argv[1], sys.argv[2]
def norm(s): return re.sub(r'\s+', ' ', s)
T = {k: norm(open(os.path.join(S, k + '.txt'), errors='ignore').read()) for k in ('t4023', 'portland', 'hia')}
DEB = dict(
    study='Debrezion, Pels & Rietveld, "The Impact of Railway Stations on Residential and Commercial Property Value" (Tinbergen Institute Discussion Paper TI 2004-023/3, Aug 2003 draft; published version: J. Real Estate Finance & Economics 2007)',
    doi='10.1007/s11146-007-9032-z', url='https://papers.tinbergen.nl/04023.pdf', key='t4023',
    study_type='meta-analysis of 73 estimates (per-250m) / 70 estimates (within 1/4 mile) from hedonic studies, mostly US',
    caveat='Working-paper draft; the numbers are the draft Table 5 descriptive statistics (mean, min, max across published estimates), not the final journal estimates. Range is across underlying study estimates, not a confidence interval.')
def deb(mode, ptype, label, row_start, per250, qtr):
    # per250 / qtr = (min, mean, max, N) as fractions copied from Table 5 text
    return dict(mode=mode, property_type=ptype, **DEB, row_label=label, row_start=row_start, per250=per250, qtr=qtr)
ROWS = []
def add(**k): ROWS.append(k)
# (mode, ptype, regexp to find the Table 5 row in the text, per250 tuple, quarter-mile tuple)
SPEC = [
 ('all rail station types', 'residential and commercial', 'Over all -0.128 0.026 0.387 0.059 73 -0.619 0.089 1.452 0.235 70', (-0.128, 0.026, 0.387, 73), (-0.619, 0.089, 1.452, 70)),
 ('light rail', 'residential and commercial', 'LRTb -0.014 0.025 0.111 0.036 26 -0.072 0.076 0.368 0.106 23', (-0.014, 0.025, 0.111, 26), (-0.072, 0.076, 0.368, 23)),
 ('heavy rail / metro', 'residential and commercial', 'HRT -0.128 0.015 1.039 0.099 0.040 28 -0.619 0.053 0.547 0.370 0.172 28', (-0.128, 0.015, 0.099, 28), (-0.619, 0.053, 0.370, 28)),
 ('commuter rail', 'residential and commercial', 'CRT -0.056 0.054 1.292 0.387 0.104 15 -0.270 0.194 1.288 1.452 0.421 15', (-0.056, 0.054, 0.387, 15), (-0.270, 0.194, 1.452, 15)),
 ('bus rapid transit', 'residential and commercial', 'BRT -0.031 0.005 1.070 0.041 0.030 4 -0.149 0.025 0.842 0.200 0.144 4', (-0.031, 0.005, 0.041, 4), (-0.149, 0.025, 0.200, 4)),
 ('all rail station types', 'residential', 'Residentialb -0.038 0.019 0.099 0.030 52 -0.193 0.062 0.429 0.109 49', (-0.038, 0.019, 0.099, 52), (-0.193, 0.062, 0.429, 49)),
 ('all rail station types', 'commercial', 'Commercial -0.128 0.043c 1.542 0.387 0.098 21 -0.619 0.152 1.489 1.452 0.395 21', (-0.128, 0.043, 0.387, 21), (-0.619, 0.152, 1.452, 21)),
]
for mode, pt, q, a, b in SPEC:
    assert q in T['t4023'], q
    for band, tup in (('per 250 m closer to the station', a), ('within 1/4 mile of the station', b)):
        ROWS.append(dict(id='debrezion_%s_%s_%s' % (re.sub(r'\W+', '_', mode), re.sub(r'\W+', '_', pt), 'q4' if 'mile' in band else '250m'),
            mode=mode, distance_band=band, property_type=pt, city='mostly US cities (pooled; city list not tabulated in the draft)',
            effect_pct=round(tup[1] * 100, 1), range_low_pct=round(tup[0] * 100, 1), range_high_pct=round(tup[2] * 100, 1), n_estimates=tup[3],
            effect_definition='mean of reported percentage change in property value (rent) %s; range = min/max of the underlying published estimates' % band,
            study=DEB['study'], study_type=DEB['study_type'], study_doi=DEB['doi'], source_url=DEB['url'],
            quote='Table 5 row: ' + q, caveat=DEB['caveat'],
            verification={'status': 'verified_in_fetched_text', 'checked_on': '2026-11-18', 'method': 'table row located verbatim in pdftotext of the fetched PDF'}))
# text-quoted headline
q0 = 'The mean impact of a station on property value (rent) for every 250 metres close to the station is 2.61%.'
assert norm(q0) in T['t4023']
# Portland
PORT = dict(study='Lee (2024), "Property Value Premium of Transit Accessibility and Light Rail Transit Expansion in Portland, Oregon", J. Sustainability Research 6(2):e2400014',
            doi='10.20900/jsr20240014', url='https://doi.org/10.20900/jsr20240014', st='propensity-score-matched hedonic / spatial lag models, single-family sales, houses within a one-mile network buffer of MAX stations (downtown excluded)')
PQ = [
 ('east side, second MAX line, before opening', 10.4, 'The total impact of the second line (treatment) opening in model 1 (before the second MAX line development) was 0.104, which suggested that the sales price increased by 10.4 percent for single-family houses in the station areas.'),
 ('west side, first MAX line, before opening', 11.6, 'the sales price for single-family homes in the treatment group increased by 11.6 percent before the first MAX line opening and 7.7 percent after the first MAX line opening'),
 ('west side, first MAX line, after opening', 7.7, 'the sales price for single-family homes in the treatment group increased by 11.6 percent before the first MAX line opening and 7.7 percent after the first MAX line opening'),
]
for lab, v, q in PQ:
    assert norm(q) in T['portland'], q
    ROWS.append(dict(id='portland_' + re.sub(r'\W+', '_', lab), mode='light rail (MAX)', distance_band='within a one-mile network buffer of the station', property_type='single-family residential sales',
        city='Portland, OR', effect_pct=v, range_low_pct=None, range_high_pct=None, n_estimates=None,
        effect_definition='treatment effect on sale price (log-price model) - ' + lab + '; the paper reports the second MAX line adds no premium on the west side and that premiums fade after opening',
        study=PORT['study'], study_type=PORT['st'], study_doi=PORT['doi'], source_url=PORT['url'], quote=q, caveat='Single metro, single paper; the "after opening" west-side effect is significant only at the 10% level per the paper.',
        verification={'status': 'verified_in_fetched_text', 'checked_on': '2026-11-18', 'method': 'sentence located verbatim in the fetched article page'}))
qh = 'the impact extends to almost 0.9 miles away from LRT stations'
assert norm(qh) in T['hia'], qh
ROWS.append(dict(id='hiawatha_commercial_industrial_extent', mode='light rail (Hiawatha / Blue Line)', distance_band='significant premium out to almost 0.9 miles', property_type='commercial and industrial sales',
    city='Minneapolis, MN', effect_pct=None, range_low_pct=None, range_high_pct=None, n_estimates=None,
    effect_definition='abstract reports a significant price premium and its distance extent only; the percentage estimate was not readable (full-text PDF returned 403), so no number is recorded',
    study='Ko & Cao (2013), "The Impact of Hiawatha Light Rail on Commercial and Industrial Property Values in Minneapolis", Journal of Public Transportation 16(1):47-66', study_type='hedonic pricing, sales before and after opening',
    study_doi='10.5038/2375-0901.16.1.3', source_url='https://digitalcommons.usf.edu/jpt/vol16/iss1/3/', quote='The results show that the LRT has induced a significant price premium for properties nearby and that the impact extends to almost 0.9 miles away from LRT stations.',
    caveat='Abstract-level evidence only.', verification={'status': 'verified_abstract_only', 'checked_on': '2026-11-18', 'method': 'abstract text on the publisher repository landing page'}))
json.dump({'meta': {'generated': '2026-11-18',
    'not_obtained': 'Rennert (2022, doi 10.1016/j.tra.2022.06.013), Mohammad et al. (2013) and Zhang & Yen (2020, BRT meta-analysis, doi 10.1016/j.landusepol.2020.104684) could not be read in full: publisher pages return 403 or paywall; the Zhang & Yen abstract (fetched via Semantic Scholar) states no numeric effect. They are therefore NOT in this file.',
    'rule': 'effect numbers only where the quote appears verbatim in fetched text'}, 'rows': ROWS}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(len(ROWS))
