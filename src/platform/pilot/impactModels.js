// @ts-check
// Pilot adapter: rows of app/data/transit_value_effects.json -> ImpactModel records for the rail_station category.
// Pure: takes the parsed JSON. Every number comes from a field of the row (the reach is parsed from the row's distance_band text).
import { makeQuantity } from '../schema/quantity.js';
import { validateImpactModel } from '../impact/models.js';

const WORDS = /** @type {Record<string, number>} */ ({ one: 1 });

/** @param {string} t @returns {number|null} a number written as digits, a fraction "a/b" or the word one */
function numberOf(t) {
  const f = /^(\d+)\s*\/\s*(\d+)$/.exec(t.trim());
  if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2]);
  if (/^\d+(?:\.\d+)?$/.test(t.trim())) return Number(t);
  const w = WORDS[t.trim().toLowerCase()];
  return w === undefined ? null : w;
}
const NUM = String.raw`(\d+\s*\/\s*\d+|\d+(?:\.\d+)?|one)`;

/**
 * Reach of a distance band written in miles.
 *  - "within N mile" (N digits, fraction or "one"), no other distance wording: a disc { miles }.
 *  - "between X and Y mile(s)" or "X to Y mile(s)", both numbers present: an annulus { miles: Y, innerM, outerM } (innerM, outerM in metres).
 *  - anything else (gradients, "beyond", "to" without two numbers, a second distance in a "within" band): null.
 * @param {string} band @returns {{ miles: number, innerM?: number, outerM?: number }|null}
 */
export function parseBandMiles(band) {
  if (typeof band !== 'string') return null;
  const ann = new RegExp(String.raw`(?:between\s+${NUM}\s*(?:mile|miles|mi)?\s*and\s+${NUM}\s*[- ]?(?:mile|miles|mi)\b|\b${NUM}\s*(?:mile|miles|mi)?\s+to\s+${NUM}\s*[- ]?(?:mile|miles|mi)\b)`, 'i').exec(band);
  if (ann) {
    const x = numberOf(ann[1] ?? ann[3]), y = numberOf(ann[2] ?? ann[4]);
    if (x === null || y === null || !(x >= 0) || !(y > x)) return null;
    return { miles: y, innerM: x * 1609.344, outerM: y * 1609.344 };
  }
  if (/\b(between|beyond|to|and|from|outside|over|more than)\b/i.test(band)) return null; // an annulus or compound band we cannot read unambiguously
  const all = [...band.matchAll(new RegExp(String.raw`within\s+(?:a\s+)?${NUM}[- ]?mile`, 'gi'))];
  if (all.length !== 1) return null;
  const v = numberOf(all[0][1]);
  return v === null ? null : { miles: v };
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
        // 'all rail station types' is the general model (specificity 0, no appliesTo); a named mode is more specific and applies only to that mode.
        specificity: /^all\b/i.test(row.mode) ? 0 : 1,
        ...(/^all\b/i.test(row.mode) ? {} : { appliesTo: { mode: String(row.mode) } }),
        decay: { form: 'bands', parameters: {} },
        reach: makeQuantity({ ...common, value: band.miles, low: band.miles, high: band.miles, unit: 'mile', method: `parsed from distance_band '${row.distance_band}'` }),
        ...(band.innerM !== undefined ? { innerRadius: makeQuantity({ ...common, value: band.innerM, low: band.innerM, high: band.innerM, unit: 'm', method: `inner radius parsed from distance_band '${row.distance_band}'` }) } : {}),
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
