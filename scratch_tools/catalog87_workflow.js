export const meta = {
  name: 'catalog-87',
  description: 'Location-aware project list: map the four AI lists onto the catalog, research region-triggered project types (effects, costs, trigger data), verify every citation',
  phases: [
    { title: 'Map', detail: 'every item of the four lists to an existing type, a new type, owner-level, quality-of-life only, or not modelled' },
    { title: 'Research', detail: 'eight region/condition groups: property-value effects, costs, nationwide trigger data' },
    { title: 'Verify', detail: 'one independent checker per research agent re-reads each cited page' },
  ],
}

const LISTS = '/home/user/w5/round87/ai_lists_user_2026-11-09.md'
const CATALOG = args.catalog   // [[key, kind, name], ...] the 81 current project types

const RULES = `Rules (strict):
- Every number must come from a primary source you actually opened and read: peer-reviewed paper (journal page, working-paper PDF or author copy), government or agency report/document/dataset page. Trade or industry surveys only if labelled source_type "trade". News only for program facts when no agency page states them ("news").
- quote: copy one or two sentences VERBATIM from the page/PDF that state the number or fact. If you could not open the source, do not cite it; list it under open_questions.
- Never invent a citation, URL, author or year. Prefer fewer, solid findings over many weak ones.
- Use WebSearch to find sources and WebFetch (or the web-fetch agent) to read them.`

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: {
      source: { type: 'string', enum: ['DeepSeek', 'Kimi', 'ChatGPT', 'Claude', 'user'] },
      item: { type: 'string' },
      decision: { type: 'string', enum: ['existing_type', 'new_type', 'owner_level', 'quality_of_life_only', 'not_modelled'] },
      type_key: { type: 'string', description: 'existing catalog key, or a proposed snake_case key for a new type, or ""' },
      trigger: { type: 'string', description: 'for a new type: the local condition that should switch it on (e.g. "mean annual snowfall above 20 in", "FEMA 1% flood zone", "population fell 2010-2020")' },
      reason: { type: 'string', description: 'one plain sentence; for not_modelled say why (e.g. a social program with no measurable effect on homes or lives at block-group level, a single-home remodel choice, a duplicate)' },
    }, required: ['source', 'item', 'decision', 'type_key', 'trigger', 'reason'] } },
    new_types: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, name: { type: 'string' }, group: { type: 'string', enum: ['flood_hurricane', 'cold_snow', 'wildfire_heat_drought', 'tornado_storm', 'shrinking_city', 'rural', 'suburban', 'stabilize_schools_safety', 'other'] },
      trigger: { type: 'string' }, from_items: { type: 'array', items: { type: 'string' } },
    }, required: ['key', 'name', 'group', 'trigger', 'from_items'] } },
    summary: { type: 'string' },
  },
  required: ['items', 'new_types', 'summary'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    types: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, name: { type: 'string' },
      trigger: { type: 'string', description: 'when the project applies, in data terms' },
      trigger_data: { type: 'string', description: 'nationwide public dataset for the trigger: name, URL, geography, update date, license or terms' },
      effect: { type: 'string', description: 'measured effect on home values (or, if none is measured, on safety/health/costs), with units, distance and place; "none measured" is a valid answer' },
      effect_url: { type: 'string' }, effect_quote: { type: 'string' }, effect_source: { type: 'string', description: 'authors, year, title, venue' },
      effect_type: { type: 'string', enum: ['peer_reviewed', 'government', 'agency', 'working_paper', 'trade', 'news', 'none_found'] },
      cost: { type: 'string', description: 'unit cost with units, year and place' }, cost_url: { type: 'string' }, cost_quote: { type: 'string' },
      notes: { type: 'string' },
    }, required: ['key', 'name', 'trigger', 'trigger_data', 'effect', 'effect_url', 'effect_quote', 'effect_source', 'effect_type', 'cost', 'cost_url', 'cost_quote', 'notes'] } },
    summary: { type: 'string' },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['types', 'summary', 'open_questions'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    checks: { type: 'array', items: { type: 'object', properties: {
      item: { type: 'string' }, url: { type: 'string' }, fetched: { type: 'boolean' }, quote_found: { type: 'boolean' },
      supports_claim: { type: 'boolean' }, corrected: { type: 'string' }, note: { type: 'string' },
    }, required: ['item', 'url', 'fetched', 'quote_found', 'supports_claim', 'corrected', 'note'] } },
    not_checked: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['checks', 'not_checked', 'summary'],
}

const GROUPS = [
  { key: 'flood_hurricane', ask: 'Flood and hurricane areas: buyouts of repeatedly flooded homes converted to open space; elevating homes; living shorelines, dunes and wetland restoration; stronger wind codes and fortified roofs (e.g. IBHS FORTIFIED: resale and insurance evidence); FEMA Community Rating System class discounts on flood insurance premiums; green stormwater infrastructure. Trigger data: FEMA National Flood Hazard Layer, NFIP policy/claims statistics by community, hurricane exposure.' },
  { key: 'cold_snow', ask: 'Cold and snowy areas: municipal snow plowing and sidewalk snow clearing programs; heated or enclosed bus shelters; weatherization and insulation (DOE Weatherization Assistance Program savings); winter recreation (ice rinks); freeze-thaw resistant pavement. Trigger data: NOAA 1991-2020 climate normals (annual snowfall, heating degree days) by station.' },
  { key: 'wildfire_heat_drought', ask: 'Wildfire, heat and drought: home hardening and defensible space (e.g. IBHS Wildfire Prepared Home, Firewise USA, insurance discounts under state rules), cool roofs and cool pavement, turf replacement with drought-tolerant landscaping (rebate costs per sq ft), cooling centers, water recycling. Effects on home values or losses avoided. Trigger data: USDA Forest Service Wildfire Risk to Communities, heat (already have Tree Equity heat), drought monitor.' },
  { key: 'tornado_storm', ask: 'Tornado and severe-storm areas: community safe rooms and shelters (FEMA P-361 costs, Hazard Mitigation grants), outdoor warning sirens, residential safe rooms; any evidence on property values or casualties avoided. Trigger data: NOAA SPC tornado tracks 1950-present.' },
  { key: 'shrinking_city', ask: 'Shrinking or high-vacancy cities: land banks; side-lot programs selling vacant lots to neighbors; demolition of blighted vacant structures (e.g. Detroit demolition program and nearby home values); lead service line replacement (EPA cost estimates; property value evidence); urban farms and forests; Fix-It-First / home repair grants and code enforcement paired with repair (e.g. Philadelphia Basic Systems Repair Program studies); vacant-lot cleaning and greening (Philadelphia). Trigger data: ACS vacancy and population change by tract, HUD-USPS vacancy data, EPA lead service line inventories.' },
  { key: 'rural', ask: 'Rural areas and small towns: broadband or fiber availability (property value or economic effects, e.g. Molnar et al.), extending public water and sewer, paving gravel roads, keeping a rural hospital, pharmacy or grocery open (effects of closures), main-street programs (National Main Street Center reinvestment statistics), outdoor recreation access. Trigger data: FCC National Broadband Map availability, Census urban/rural classification, USDA food access research atlas.' },
  { key: 'suburban', ask: 'Suburbs: retrofitting dead malls and strip centers into mixed-use town centers; connecting cul-de-sacs with walking paths; building sidewalks where none exist; walkability premiums (e.g. Cortright "Walking the Walk"; Pivo and Fisher; Redfin). Effects on nearby home values and costs per mile of sidewalk or per connector. Trigger data: OpenStreetMap sidewalks and footways, retail vacancy, Walk Score-like measures that are openly licensed.' },
  { key: 'stabilize_schools_safety', ask: 'Stabilization, schools and safety (nationwide): targeted block-level investment (Federal Reserve Bank of Richmond "Neighborhoods in Bloom" study: ~10% faster appreciation, ~$20,000 per block threshold), crime reduction and home values (Pope and Pope, "Crime and Property Values: Evidence from the 1990s Crime Drop"), school quality capitalization (Black 1999 boundary study and later), anti-displacement tools (property tax circuit breakers, community land trusts) with evidence. Trigger data: what public data identifies where each applies.' },
]

phase('Map')
const mapped = await agent(`You are helping build City Pretty, a civic data map that suggests neighborhood projects by block group, each with a sourced cost and effect on home values. The owner pasted improvement lists from four AI assistants and asked that they be implemented, and that improvements depend on location rather than on Los Angeles alone. Read the lists: ${LISTS}
The current catalog has these 81 project types ([key, kind, name]; kind 'value' = scored for home values, 'qol' = quality of life only, 'regional', 'owner', 'policy'):
${JSON.stringify(CATALOG)}
Classify EVERY item of every list (DeepSeek, Kimi, ChatGPT's 150, Claude's 140, and the owner's own additions): existing_type (give the key), new_type (propose a snake_case key; group near-duplicates under one key), owner_level (a single-home choice, e.g. a new garage door), quality_of_life_only (a real public improvement whose effect on home values is not measurable at block-group level, e.g. block parties), or not_modelled (with the reason). Then list the distinct new types with the local condition that should trigger each. Do not research sources in this step. Be complete: every item gets a row.`,
  { label: 'map:ai-lists', phase: 'Map', schema: MAP_SCHEMA })

const results = await pipeline(
  GROUPS,
  (g) => agent(`Research for City Pretty (a civic map that suggests neighborhood projects by block group with sourced costs and effects on home values). Group: ${g.key}.
${g.ask}
For each project type: when it applies (trigger, in data terms), a nationwide public dataset for the trigger (with URL and terms), the measured effect (on home values if measured; otherwise on safety, health or costs; "none measured" is a valid answer), and a unit cost, each with a verbatim quote from a primary source.
${mapped && mapped.new_types ? 'Types proposed for this group by the mapping step: ' + JSON.stringify(mapped.new_types.filter(t => t.group === g.key)) : ''}
${RULES}`, { label: `research:${g.key}`, phase: 'Research', schema: FINDINGS }),
  (r, g) => (r ? agent(`Independently check the citations in this research result (group ${g.key}). For each cited URL (effect_url and cost_url of each type; up to 30; list the rest under not_checked with the reason), open the page yourself and check that it can be read, that the quoted text appears (ignoring whitespace/punctuation), and that the page really supports the stated effect or cost. Be skeptical: supports_claim=false unless clearly supported; give the exact text in corrected when the number differs. Use WebFetch or the web-fetch agent.
${JSON.stringify(r).slice(0, 60000)}`, { label: `verify:${g.key}`, phase: 'Verify', schema: VERDICTS }) : Promise.resolve(null)).then((v) => ({ group: g.key, result: r, verify: v })),
)
return { mapped, groups: results.filter(Boolean) }
