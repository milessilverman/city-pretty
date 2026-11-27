// Los Angeles County platform pilot. Usage: node scripts/platform_pilot_la.mjs YYYY-MM-DD
// Reads repo data, runs the engines, writes app/data/platform_pilot_la.json and docs/audit/pilot-la-coverage.md.
// Every number in both outputs is computed here; nothing is typed by hand.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { runLaPilot } from '../src/platform/pilot/runPilot.js';
import { projectsFromBundle, chooseCutoffYear, backtestLaProjects, OUTCOME_BY_STATUS, CATEGORY_BY_KIND } from '../src/platform/pilot/laProjects.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asOf = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf || '')) { console.error('usage: node scripts/platform_pilot_la.mjs YYYY-MM-DD'); process.exit(2); }

const readB64Gz = (rel) => JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(root, rel), 'utf8'), 'base64')).toString('utf8'));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const FILES = ['app/data/sites-la.b64.txt', 'app/data/bundle-la.b64.txt', 'app/data/statutes.json', 'app/data/state_finance_profiles.json', 'app/data/transit_value_effects.json'];

const bundle = readB64Gz(FILES[1]);
const { opportunities, summary, foundBy, typeOf } = runLaPilot({
  sitesJson: readB64Gz(FILES[0]), bundle, statutes: readJson(FILES[2]),
  financeProfileCA: readJson(FILES[3]).CA, transitValueEffects: readJson(FILES[4]), asOf, criteria: {}, problemMap: [],
});

// Sample: first two opportunities per (source type, category, status), in discovery order, at most 200.
const seen = new Map();
const sample = [];
for (const o of opportunities) {
  const key = `${typeOf.get(o.location.id)}|${o.categoryId}|${o.status}`;
  const n = seen.get(key) || 0;
  if (n >= 2 || sample.length >= 200) continue;
  seen.set(key, n + 1);
  sample.push({
    id: o.id, categoryId: o.categoryId, sourceType: typeOf.get(o.location.id), locationKind: o.location.kind, discoveredBy: foundBy[o.id],
    status: o.status, checks: o.checks, rejectionReasons: o.rejectionReasons, missingInputs: o.missingInputs.slice(0, 30), confidence: o.confidence,
  });
}
const out = JSON.stringify({ summary, sampleOpportunities: sample, sampleNote: 'first two opportunities per (source type, category, status), at most 200' }, null, 1) + '\n';
if (Buffer.byteLength(out) > 400 * 1024) throw new Error(`output ${Buffer.byteLength(out)} bytes exceeds 400 KB`);
fs.writeFileSync(path.join(root, 'app/data/platform_pilot_la.json'), out);

// ---- markdown report (max 70 lines)
const S = summary;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
const entries = (o) => Object.entries(o);
const md = [];
const inline = (o) => entries(o).map(([k, n]) => `${k} ${n}`).join('; ');
md.push(`As of ${asOf}: every number below was computed by scripts/platform_pilot_la.mjs from ${FILES.join(', ')}.`, '');
md.push('## Locations', ...table(['type', 'records in file', 'located (has point)', 'skipped (no point)'],
  entries(S.locations.byType).map(([t, v]) => [t, v.records, v.located, v.skippedNoPoint])));
md.push('', `Located ${S.locations.total} of ${S.locations.recordsInFile}. Kinds: ${inline(S.locations.byKind)}. Lots with a straight-line station distance: ${S.locations.lotsWithStationDistance} (stations in bundle: ${S.locations.stationsInBundle}).`);
md.push('', '## Evaluations (exhaustive screen)', ...table(['status', 'count'], entries(S.evaluations.byStatus).map(([k, n]) => [k, n])));
md.push('', `Total ${S.evaluations.total}. Needs_info because a criterion was not supplied: ${S.evaluations.needsInfoBecauseCriterionNotSupplied} (criteria supplied: ${S.evaluations.criteriaSupplied}; problem-map rows: ${S.evaluations.problemMapRows}).`);
md.push('', `By category (needs_info / not_evaluated / rejected / viable / candidate): ${entries(S.evaluations.byCategory).map(([c, v]) => `${c} ${v.needs_info || 0}/${v.not_evaluated || 0}/${v.rejected || 0}/${v.viable || 0}/${v.candidate || 0}`).join('; ')}.`);
md.push('', '## Discovery methods', `Run: ${S.discovery.methodsRun.join(', ')}. Merged opportunities ${S.discovery.opportunitiesMerged}; duplicates merged ${S.discovery.duplicatesMerged}.`,
  ...table(['method', 'hits', 'note'], ['exhaustive', 'problem_first', 'asset_first', 'combination'].map((m) => [m, S.discovery.opportunitiesByMethodHits[m], S.discovery.methodNotes[m]])));
md.push('', '## Top 15 missing inputs (opportunities naming each)', S.topMissingInputs.map((m) => `${m.name} ${m.count}`).join('; ') + '.');
md.push('', '## Regulatory (California module)', `Modules: ${S.regulatory.modulesRegistered.join('; ')}. Parcel-topic pairs evaluated ${S.regulatory.parcelTopicPairsEvaluated}; locations with a city ${S.regulatory.parcelsWithPlace} (from block group: ${S.regulatory.placeFromBlockGroup}; in a city with zone_rules rows [${S.regulatory.zoneRuleJurisdictions.join(', ')}]: ${S.regulatory.placeInZoneRuleCity}; block group is an unincorporated area: ${S.regulatory.placeAreaNotCity}; block group not in bundle: ${S.regulatory.blockGroupNotInBundle}).`,
  '', `Conclusions by finding: ${inline(S.regulatory.conclusionsByFinding)}.`, '', `Conclusions by statute record id: ${inline(S.regulatory.conclusionsByRuleId)}.`);
md.push('', '## Financial and engineering checks', `Financial check: ${S.financial.checkResult}. Reason: ${S.financial.reason}. Missing: ${S.financial.missing.join(', ')}. Engineering: ${S.financial.engineeringCheck}.`);
md.push('', '## Impact models', `Registered ${S.impact.modelsRegistered}; skipped ${S.impact.modelsSkipped}. Categories with a model: ${S.impact.categoriesWithModel.join(', ') || 'none'}; categories lacking one: ${S.impact.categoriesLackingModelCount}. Impact areas computed: ${S.impact.impactAreasComputed}. ${S.impact.note}.`);
md.push('', '## Coverage ledgers', `Ledgers ${S.ledgers.count}; all finalized: ${S.ledgers.allFinalized}. Confidence: ${inline(S.ledgers.confidence)}. Entries: ${inline(S.ledgers.totals)} (${S.ledgers.note}).`);
md.push('', '## Limits', ...S.limits.map((l) => `- ${l}`));
if (md.length > 70) throw new Error(`report is ${md.length} lines, max 70`);
fs.writeFileSync(path.join(root, 'docs/audit/pilot-la-coverage.md'), md.join('\n') + '\n');
console.log(`pilot ${asOf}: locations ${S.locations.total}, evaluations ${S.evaluations.total}, ${JSON.stringify(S.evaluations.byStatus)}; json ${Buffer.byteLength(out)} bytes; report ${md.length} lines`);

// ---- first back-test on the bundle's project rows (docs/audit/pilot-la-backtest.md, max 40 lines)
const SHARE = 0.7; // design choice: the cut-off leaves roughly the latest 30% of outcome-bearing dated records as truth
const rows = bundle.layers.projects, kinds = bundle.layers.pj_kinds;
const parsed = projectsFromBundle(rows, kinds);
const cutoffYear = chooseCutoffYear(parsed.records, SHARE);
const bt = backtestLaProjects({
  rows, kinds, cutoffYear,
  // The pilot's discovery runs on located site records, none of which carries a date, so it cannot be restricted to
  // pre-cut-off inputs without a leakage claim nobody can check. The harness refuses before this is reached.
  discover: () => { throw new Error('discover reached: pilot site records carry no dates, so no pre-cut-off restriction can be shown'); },
});
const T = bt.tally;
const rowsOf = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('; ');
const b = [];
b.push(`As of ${asOf}: computed by scripts/platform_pilot_la.mjs from ${FILES[1]} (layers.projects, layers.pj_kinds). Back-test harness: src/platform/coverage/backtest.js (unchanged).`, '');
b.push(`## Result: ${bt.possible ? 'back-test ran' : 'back-test not possible on this data'}`);
if (bt.possible) {
  const r = bt.result;
  b.push(`Cut-off ${T.cutoff}. Recall ${r.overall.recall}; precision (judged) ${r.overall.precision}; strict precision ${r.precisionStrict}; unjudged ${r.counts.unjudged}.`, `By category: ${JSON.stringify(r.byCategory)}.`);
} else {
  b.push(`Harness refusal (${bt.refusal.name}): ${bt.refusal.message}`);
}
b.push('', '## Counts', `Rows ${T.rows}; undated (year not a 4-digit value) ${T.undated}; dated on or before the cut-off ${T.inputs}; dated after it ${T.afterCutoff}.`,
  `Cut-off year ${cutoffYear}: the year by which ${SHARE * 100}% of dated rows with a mapped outcome fall (the later rows are kept as truth). Rows carry a year only; each is dated 31 Dec of that year.`,
  `After the cut-off: ${T.afterCutoffWithOutcome} rows have a mapped outcome; truth records (mapped outcome and mapped category) ${T.truth}; by outcome ${rowsOf(T.truthOutcomes)}.`,
  `Outcome mapped from status text for ${parsed.counts.outcomeMapped} rows; unmapped ${T.outcomeUnmapped}. Category mapped for ${T.categoryMapped}; unmapped ${T.categoryUnmapped}. Duplicate row ids made unique: ${T.duplicateIds}.`);
b.push('', '## Mappings used (read from code, not judgement per row)', `Status to outcome: ${Object.entries(OUTCOME_BY_STATUS).map(([k, v]) => `"${k}" -> ${v}`).join('; ')}. Every other status text has outcome null.`,
  `Kind to category: ${Object.entries(CATEGORY_BY_KIND).map(([k, v]) => `"${k}" -> ${v}`).join('; ')}. Every other kind is unmapped.`);
b.push('', '## Rows by status', rowsOf(T.byStatus) + '.', '', '## Rows by kind', rowsOf(T.byKind) + '.');
b.push('', '## What is missing', 'Dated project outcomes that include failed or cancelled projects (and plausible alternatives), with a year or date for when each outcome was known, and a record of which rows the pilot discovery could have seen before the cut-off.', `Rows whose status text maps to failed or cancelled: ${parsed.records.filter((r) => r.outcome === 'failed' || r.outcome === 'cancelled').length}; to alternative: 0 (no status text names one). None was invented and the harness was not changed.`);
if (b.length > 40) throw new Error(`back-test report is ${b.length} lines, max 40`);
fs.writeFileSync(path.join(root, 'docs/audit/pilot-la-backtest.md'), b.join('\n') + '\n');
console.log(`back-test: possible ${bt.possible}; cutoff ${cutoffYear}; truth ${T.truth}; ${bt.refusal ? bt.refusal.name : 'ok'}`);
