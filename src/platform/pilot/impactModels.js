// @ts-check
// Pilot adapter: rows of app/data/transit_value_effects.json -> ImpactModel records for the rail_station category.
// Pure: takes the parsed JSON. Every number comes from a field of the row (the reach is parsed from the row's distance_band text).
import { makeQuantity } from '../schema/quantity.js';
import { validateImpactModel } from '../impact/models.js';

const WORDS = /** @type {Record<string, number>} */ ({ one: 1 });

/** @param {string} band @returns {{ miles: number }|null} */
export function parseBandMiles(band) {
  let m = /within\s+(\d+)\s*\/\s*(\d+)\s*mile/i.exec(band);
  if (m) return { miles: Number(m[1]) / Number(m[2]) };
  m = /within\s+(?:a\s+)?(\d+(?:\.\d+)?|[a-z]+)[- ]mile/i.exec(band);
  if (m) { const v = /^\d/.test(m[1]) ? Number(m[1]) : WORDS[m[1].toLowerCase()]; if (Number.isFinite(v)) return { miles: v }; }
  return null;
}

/** @param {string} t */
const targetFor = (t) => (t === 'residential' ? 'residential_property_value' : t === 'commercial' ? 'commercial_property_value' : 'property_value_residential_and_commercial');

/**
 * @param {any} json parsed transit_value_effects.json
 * @returns {{ models: import('../impact/models.js').ImpactModel[], skipped: { id: string, reason: string }[] }}
 */
export function modelsFromTransitValueEffects(json) {
  const rows = json && Array.isArray(json.rows) ? json.rows : [];
  /** @type {import('../impact/models.js').ImpactModel[]} */ const models = [];
  /** @type {{ id: string, reason: string }[]} */ const skipped = [];
  for (const row of rows) {
    const id = String((row && row.id) || '(no id)');
    /** @param {string} reason */
    const skip = (reason) => { skipped.push({ id, reason }); };
    if (!row || typeof row.mode !== 'string') { skip('no mode'); continue; }
    if (!/rail/i.test(row.mode) || /bus/i.test(row.mode)) { skip(`mode '${row.mode}' is not a rail station mode`); continue; }
    if (typeof row.distance_band !== 'string' || !row.distance_band) { skip('no distance band'); continue; }
    if (typeof row.effect_pct !== 'number') { skip('no effect value'); continue; }
    if (typeof row.range_low_pct !== 'number' || typeof row.range_high_pct !== 'number') { skip('no range (low/high)'); continue; }
    if (!row.quote || !row.source_url) { skip('no quote or source url'); continue; }
    if (!row.verification || row.verification.status !== 'verified_in_fetched_text') { skip(`verification status '${row.verification && row.verification.status}' not mapped`); continue; }
    const band = parseBandMiles(row.distance_band);
    if (!band) { skip(`distance band '${row.distance_band}' is a gradient or has no stated reach; an impact area would need an invented reach`); continue; }
    const checked = row.verification.checked_on;
    const source = { title: String(row.study), url: String(row.source_url), quote: String(row.quote), retrieved: String(checked) };
    try {
      const common = { jurisdiction: String(row.city), effectiveDate: String(checked), status: /** @type {'verified'} */ ('verified'), source };
      const model = /** @type {import('../impact/models.js').ImpactModel} */ ({
        id: `model.rail_station.${row.id}`, categoryIds: ['rail_station'], target: targetFor(row.property_type), sign: 1,
        variant: row.mode,
        decay: { form: 'bands', parameters: {} },
        reach: makeQuantity({ ...common, value: band.miles, low: band.miles, high: band.miles, unit: 'mile', method: `parsed from distance_band '${row.distance_band}'` }),
        magnitude: makeQuantity({ ...common, value: row.effect_pct, low: row.range_low_pct, high: row.range_high_pct, unit: 'percent', method: String(row.effect_definition || '') }),
        negativeEffects: [],
        distanceBasis: /network/i.test(row.distance_band) ? 'network' : 'unspecified',
        transferability: `Study area: ${row.city}. Caveat from the row: ${row.caveat || '(none stated)'}`,
        source, verification: { ...row.verification }, caveat: row.caveat, studyArea: row.city,
      });
      const v = validateImpactModel(model);
      if (!v.valid) { skip('invalid model: ' + v.errors.join('; ')); continue; }
      models.push(model);
    } catch (e) { skip('could not build quantities: ' + (e instanceof Error ? e.message : String(e))); }
  }
  return { models, skipped };
}
