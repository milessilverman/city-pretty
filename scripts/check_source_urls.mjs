#!/usr/bin/env node
// Checks every http(s) URL value in app/data/*.json (files under 2 MB) and research/*.csv.
//
// Usage: node scripts/check_source_urls.mjs
//
// Writes research/url_checks.csv (one row per URL occurrence, checked 2026-11-18), prints a
// per-file summary, and prints counts of records whose source link is missing or is a generic
// landing page shared by more than 5 records in the same file.
//
// Outbound requests go through HTTPS_PROXY. Node's fetch ignores that variable unless
// NODE_USE_ENV_PROXY=1 is set at startup, so the script re-runs itself with that flag when a
// proxy is configured. No dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(
    process.execPath,
    ['--disable-warning=UNDICI-EHPA', SELF, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } },
  );
  process.exit(r.status ?? 1);
}

const ROOT = path.resolve(path.dirname(SELF), '..');
const DATA_DIR = path.join(ROOT, 'app', 'data');
const RESEARCH_DIR = path.join(ROOT, 'research');
const OUT_CSV = path.join(RESEARCH_DIR, 'url_checks.csv');
const CHECKED = '2026-11-18';
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 4;
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Hosts the agent proxy is known to answer with 403 (policy, not dead links).
const PROXY_BLOCKED_HOSTS = ['transit.dot.gov', 'railroads.dot.gov', 'bls.gov', 'zillow.com'];
const ID_KEYS = ['id', 'name', 'key', 'title', 'fips', 'slug', 'label', 'program', 'statute'];
// Link-bearing keys used for the A3 coverage check. The brief names the first four; the others
// are link fields that the data files actually use (statute, evaluation, study, plan documents).
const URL_KEYS = ['source_url', 'sourceUrl', 'url', 'doi', 'statute_url', 'evaluation_url', 'official_study_url', 'rtp_document_url'];
const URL_RE = /^https?:\/\/\S+$/i;

const isUrl = (s) => typeof s === 'string' && URL_RE.test(s.trim());

function idLabel(obj) {
  for (const k of ID_KEYS) {
    const v = obj[k];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v);
  }
  return null;
}

// ---------- collection ----------

// Returns { occ: [{record, field, url}], records: [{label, values}] } for one parsed JSON value.
function collectJson(root) {
  const occ = [];
  const records = [];

  const addRecord = (label, obj) => {
    const values = {};
    for (const k of URL_KEYS) {
      if (k in obj) values[k] = obj[k];
    }
    records.push({ label, values });
  };

  const walk = (node, p, label, isRoot) => {
    if (typeof node === 'string') {
      if (isUrl(node)) occ.push({ record: label ?? p, field: p, url: node.trim() });
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        const itemPath = `${p}[${i}]`;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const lbl = idLabel(item) ?? label ?? itemPath;
          if (isRoot) addRecord(lbl, item);
          walk(item, itemPath, lbl, false);
        } else {
          walk(item, itemPath, label, false);
        }
      });
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const childPath = p ? `${p}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const lbl = idLabel(v) ?? (isRoot ? k : label);
        if (isRoot) addRecord(lbl, v);
        walk(v, childPath, lbl, false);
      } else {
        walk(v, childPath, label, false);
      }
    }
  };

  walk(root, '', null, true);
  return { occ, records };
}

// Minimal RFC 4180 CSV parser (quoted fields, embedded commas, quotes and newlines).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function collectCsv(text) {
  const rows = parseCsv(text).filter((r) => r.some((c) => c !== ''));
  const occ = [];
  const records = [];
  if (!rows.length) return { occ, records };
  const header = rows[0];
  const idCol = header.findIndex((h) => ['id', 'name', 'item', 'program', 'location'].includes(h.trim()));
  rows.slice(1).forEach((r, n) => {
    const label = (idCol >= 0 && r[idCol]) || `row ${n + 2}`;
    const values = {};
    header.forEach((h, c) => {
      const cell = (r[c] ?? '').trim();
      if (URL_KEYS.includes(h.trim())) values[h.trim()] = cell;
      if (isUrl(cell)) occ.push({ record: label, field: h.trim() || `col${c}`, url: cell });
    });
    records.push({ label, values });
  });
  return { occ, records };
}

function listSources() {
  const sources = [];
  const skipped = [];
  for (const f of fs.readdirSync(DATA_DIR).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.b64.txt')) continue;
    const full = path.join(DATA_DIR, f);
    const size = fs.statSync(full).size;
    if (size > MAX_JSON_BYTES) { skipped.push(`app/data/${f} (${size} bytes)`); continue; }
    sources.push({ rel: `app/data/${f}`, full, kind: 'json' });
  }
  for (const f of fs.readdirSync(RESEARCH_DIR).sort()) {
    if (!f.endsWith('.csv') || f === 'url_checks.csv') continue;
    sources.push({ rel: `research/${f}`, full: path.join(RESEARCH_DIR, f), kind: 'csv' });
  }
  return { sources, skipped };
}

// ---------- HTTP checks ----------

function describeError(e) {
  const cause = e?.cause;
  const parts = [e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout after 20s' : e?.message || String(e)];
  if (cause) parts.push(`[${cause.code ?? ''} ${cause.message ?? ''}]`.replace(/\s+/g, ' ').trim());
  return parts.join(' ').trim();
}

async function fetchOnce(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error('timeout')), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctl.signal,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    await res.body?.cancel().catch(() => {});
    return { status: res.status, finalUrl: res.url || url, error: '' };
  } catch (e) {
    return { status: null, finalUrl: '', error: describeError(e), cause: e?.cause };
  } finally {
    clearTimeout(timer);
  }
}

function classify(url, r) {
  const host = new URL(url).hostname.toLowerCase();
  const knownBlocked = PROXY_BLOCKED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  const origPath = new URL(url).pathname;
  let finalPath = '';
  try { finalPath = new URL(r.finalUrl).pathname; } catch { /* no final url */ }

  if (r.error) {
    const code = r.cause?.code ?? '';
    const msg = `${r.error}`;
    if (/statusCode=403/.test(msg)) return { tag: 'PROXY_403', category: 'blocked' };
    if (/ENOTFOUND|EAI_AGAIN|ENODATA/.test(code + ' ' + msg)) return { tag: 'DNS_FAIL', category: 'dead' };
    return { tag: 'ERROR', category: 'other' };
  }
  if (r.status === 403) {
    // A 403 from a known proxy-blocked host is treated as a proxy block, not a dead link.
    // Any other 403 cannot be told apart from the origin's bot protection, so it stays 403_unknown.
    if (knownBlocked) return { tag: 'blocked_by_proxy', category: 'blocked' };
    return { tag: '403_unknown', category: 'blocked' };
  }
  if (r.status === 404 || r.status === 410) return { tag: String(r.status), category: 'dead' };
  if (r.status >= 200 && r.status < 300) {
    const toHome = origPath !== '/' && origPath !== '' && (finalPath === '/' || finalPath === '') && r.finalUrl !== url;
    return toHome ? { tag: String(r.status), category: 'redirected_to_home' } : { tag: String(r.status), category: 'ok' };
  }
  return { tag: String(r.status), category: 'other' };
}

async function checkUrl(url) {
  let r = await fetchOnce(url);
  const retryable = r.error ? !/statusCode=403/.test(r.error) : r.status === 429 || r.status >= 500;
  if (retryable) r = await fetchOnce(url);
  const c = classify(url, r);
  let note = '';
  if (c.tag === 'blocked_by_proxy' || c.tag === 'PROXY_403') note = 'proxy answered 403 (host on known-blocked list or CONNECT refused); not treated as dead';
  if (c.tag === '403_unknown') note = 'HTTP 403 from a host not on the known-blocked list; may be origin bot protection, not confirmed dead';
  return { ...r, ...c, note };
}

async function runPool(urls, worker) {
  const results = new Map();
  let idx = 0;
  let done = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < urls.length) {
      const url = urls[idx++];
      results.set(url, await worker(url));
      done++;
      if (done % 25 === 0 || done === urls.length) process.stderr.write(`checked ${done}/${urls.length}\r`);
    }
  });
  await Promise.all(runners);
  process.stderr.write('\n');
  return results;
}

// ---------- output ----------

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function rpad(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

// ---------- main ----------

async function main() {
  const { sources, skipped } = listSources();
  const perFile = new Map(); // rel -> { occ, records }
  for (const s of sources) {
    const text = fs.readFileSync(s.full, 'utf8');
    let parsed;
    if (s.kind === 'json') {
      try { parsed = collectJson(JSON.parse(text)); } catch (e) { console.error(`skip ${s.rel}: ${e.message}`); continue; }
    } else {
      parsed = collectCsv(text);
    }
    perFile.set(s.rel, parsed);
  }

  const uniqueUrls = [...new Set([...perFile.values()].flatMap((p) => p.occ.map((o) => o.url)))];
  console.log(`Files scanned: ${sources.length}; skipped (>2 MB): ${skipped.length ? skipped.join(', ') : 'none'}`);
  console.log(`URL occurrences: ${[...perFile.values()].reduce((n, p) => n + p.occ.length, 0)}; unique URLs: ${uniqueUrls.length}`);

  const results = await runPool(uniqueUrls, checkUrl);

  // Write url_checks.csv (one row per occurrence)
  const header = ['file', 'record', 'field', 'url', 'checked', 'http_status', 'error', 'final_url', 'redirected_to_home', 'category', 'check_class', 'note'];
  const lines = [header.join(',')];
  for (const [rel, { occ }] of perFile) {
    for (const o of occ) {
      const r = results.get(o.url);
      const statusCol = r.status ?? r.tag;  // numeric status, or error class when there was none
      lines.push([
        rel, o.record, o.field, o.url, CHECKED,
        statusCol, r.error, r.finalUrl,
        r.category === 'redirected_to_home' ? 'yes' : 'no',
        r.category, r.tag, r.note,
      ].map(csvCell).join(','));
    }
  }
  fs.mkdirSync(RESEARCH_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n');
  console.log(`Wrote ${path.relative(ROOT, OUT_CSV)} (${lines.length - 1} rows)`);

  // A2 summary table
  const cats = ['ok', 'dead', 'redirected_to_home', 'blocked', 'other'];
  const w = 44;
  console.log('\nA2 summary (per URL occurrence)');
  console.log(pad('file', w) + cats.map((c) => rpad(c, 19)).join('') + rpad('total', 8));
  const totals = Object.fromEntries(cats.map((c) => [c, 0]));
  for (const [rel, { occ }] of perFile) {
    const counts = Object.fromEntries(cats.map((c) => [c, 0]));
    for (const o of occ) counts[results.get(o.url).category]++;
    for (const c of cats) totals[c] += counts[c];
    if (!occ.length) continue;
    console.log(pad(rel, w) + cats.map((c) => rpad(counts[c], 19)).join('') + rpad(occ.length, 8));
  }
  console.log(pad('TOTAL', w) + cats.map((c) => rpad(totals[c], 19)).join('') + rpad(Object.values(totals).reduce((a, b) => a + b, 0), 8));
  const deadUrls = uniqueUrls.filter((u) => results.get(u).category === 'dead');
  if (deadUrls.length) {
    console.log('\nDead (unique URLs):');
    for (const url of deadUrls) console.log(`  ${results.get(url).tag}  ${url}`);
  }

  // A3 source-link coverage (app/data/*.json only)
  console.log('\nA3 source-link coverage (app/data/*.json)');
  for (const s of sources.filter((x) => x.kind === 'json')) {
    const { records } = perFile.get(s.rel);
    if (!records.length) continue;
    const missing = [];
    const sharedMap = new Map(); // url -> [labels]
    for (const rec of records) {
      const key = URL_KEYS.find((k) => k in rec.values && rec.values[k] !== null && String(rec.values[k]).trim() !== '');
      if (!key) { missing.push(rec.label); continue; }
      const v = String(rec.values[key]).trim();
      if (!sharedMap.has(v)) sharedMap.set(v, []);
      sharedMap.get(v).push(rec.label);
    }
    const generic = [...sharedMap.entries()].filter(([, labels]) => labels.length > 5);
    const genericRecords = generic.reduce((n, [, l]) => n + l.length, 0);
    console.log(`\n${s.rel}: records=${records.length} missing_link=${missing.length} generic_shared_by_>5=${genericRecords} (${generic.length} distinct URLs)`);
    if (missing.length) console.log(`  missing examples: ${missing.slice(0, 3).join(' | ')}`);
    for (const [url, labels] of generic.slice(0, 3)) {
      console.log(`  shared ${labels.length}x: ${url}  e.g. ${labels.slice(0, 2).join(', ')}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
