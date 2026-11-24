// Read-only results page for the Los Angeles County pilot. Every number is read from ./data/platform_pilot_la.json.
const FILE = "./data/platform_pilot_la.json";

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "text") e.textContent = v; else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : String(n));
const label = (s) => String(s).replace(/_/g, " ");

function table(headers, rows, testid) {
  const t = el("table", testid ? { "data-testid": testid } : {});
  t.append(el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", { text: h })))));
  const tb = el("tbody");
  for (const r of rows) tb.append(el("tr", { "data-testid": testid ? testid + "-row" : "row" }, ...r));
  t.append(tb);
  return el("div", { class: "scroll" }, t);
}
const cell = (text, cls) => el("td", cls ? { class: cls, text } : { text });


function checkCell(c) {
  const td = el("td");
  td.append(el("strong", { text: c.result }));
  if (c.reasons && c.reasons.length) td.append(el("div", { class: "note", text: "Reasons: " + c.reasons.join("; ") }));
  if (c.missing && c.missing.length) {
    const d = el("details", {}, el("summary", { text: `${c.missing.length} missing` }));
    d.append(el("ul", {}, ...c.missing.map((m) => el("li", { text: m }))));
    td.append(d);
  }
  return td;
}

function render(data) {
  const root = document.getElementById("root");
  root.replaceChildren();
  const s = data.summary;
  const bs = s.evaluations.byStatus;
  const samples = data.sampleOpportunities || [];

  // 1 banner
  const counts = el("ul", { class: "counts" });
  const add = (id, name, n) => counts.append(el("li", {}, el("strong", { "data-testid": id, text: fmt(n) }), " " + name));
  add("count-total", "evaluations run", s.evaluations.total);
  add("count-viable", "viable", bs.viable);
  add("count-needs-info", "need information", bs.needs_info);
  add("count-rejected", "rejected", bs.rejected);
  add("count-not-evaluated", "not evaluated", bs.not_evaluated);
  root.append(el("section", { class: "banner", "data-testid": "banner" },
    el("p", { text: `This is a read-only screening pilot for Los Angeles County. It checks locations against financial, regulatory and engineering questions and reports what could be decided. Data as of ${s.asOf}.` }),
    counts,
    el("p", { text: `"Needs information" means required data is missing, not "no opportunity": nothing has been ruled out. Candidate count: ${fmt(bs.candidate)}.` })));

  // 2 table
  root.append(el("h2", { text: "Sample opportunities" }));
  root.append(el("p", { class: "note", text: `${data.sampleNote}. Showing a sample of ${fmt(samples.length)} of ${fmt(s.discovery.opportunitiesMerged)} merged opportunities.` }));
  const cats = [...new Set(samples.map((o) => o.categoryId))].sort();
  const stats = [...new Set(samples.map((o) => o.status))].sort();
  const mk = (id, name, vals) => {
    const sel = el("select", { "data-testid": id, id }, el("option", { value: "", text: "All" }), ...vals.map((v) => el("option", { value: v, text: label(v) })));
    return { sel, lab: el("label", { for: id }, name, sel) };
  };
  const cf = mk("filter-category", "Category", cats);
  const sf = mk("filter-status", "Status", stats);
  root.append(el("div", { class: "filters" }, cf.lab, sf.lab));
  const tableHost = el("div");
  const shown = el("p", { class: "note", "data-testid": "rows-shown" });
  root.append(shown, tableHost);
  const draw = () => {
    const rows = samples.filter((o) => (!cf.sel.value || o.categoryId === cf.sel.value) && (!sf.sel.value || o.status === sf.sel.value));
    shown.textContent = `${fmt(rows.length)} rows shown`;
    tableHost.replaceChildren(table(
      ["Category", "Location type", "Status", "Found by", "Financial", "Regulatory", "Engineering", "Missing inputs", "Confidence"],
      rows.map((o) => [
        cell(label(o.categoryId)), cell(`${o.sourceType} (${o.locationKind})`), cell(label(o.status)), cell(o.discoveredBy.join(", ")),
        checkCell(o.checks.financial), checkCell(o.checks.regulatory), checkCell(o.checks.engineering),
        cell(fmt(o.missingInputs.length), "num"), cell(o.confidence)]
        .map((c, i) => { if (i === 0) c.setAttribute("data-category", o.categoryId); return c; })),
      "opportunities"));
  };
  cf.sel.addEventListener("change", draw);
  sf.sel.addEventListener("change", draw);
  draw();

  // 3 rejected
  const rej = samples.filter((o) => o.status === "rejected");
  const rs = el("section", { "data-testid": "rejected-section" }, el("h2", { text: "Rejected, with reasons" }));
  if (bs.rejected === 0) {
    rs.append(el("p", { "data-testid": "rejected-none", text: "None rejected: nothing was rejected because nothing could be fully assessed." }));
  } else {
    rs.append(el("ul", {}, ...rej.map((o) => el("li", { text: `${o.id}: ${(o.rejectionReasons || []).join("; ")}` }))));
  }
  root.append(rs);

  // 4 missing
  root.append(el("h2", { text: "What is missing" }));
  root.append(el("p", { class: "note", text: "Opportunities naming each input as missing." }));
  root.append(table(["Input", "Opportunities"], s.topMissingInputs.map((m) => [cell(m.name), cell(fmt(m.count), "num")]), "missing-inputs"));

  // 5 limits
  root.append(el("h2", { text: "Data quality and limits" }));
  root.append(el("ul", { "data-testid": "limits-list" }, ...s.limits.map((l) => el("li", { text: l }))));

  // 6 impact
  const im = s.impact;
  root.append(el("section", { "data-testid": "impact-section" },
    el("h2", { text: "Impact area" }),
    el("p", { text: `${fmt(im.modelsRegistered)} impact models are registered (${fmt(im.modelsSkipped)} skipped). Categories with a model: ${im.categoriesWithModel.map(label).join(", ")}. ${fmt(im.categoriesLackingModelCount)} categories have none.` }),
    el("p", { text: `Impact areas computed: ${fmt(im.impactAreasComputed)}. Why: ${im.note}.` })));

  // 7 scenarios
  root.append(el("section", { "data-testid": "scenario-section" },
    el("h2", { text: "Scenario comparison" }),
    el("p", { text: "No scenario has been run because no sourced costs or revenues exist yet. The financial check is missing:" }),
    el("ul", {}, ...s.financial.missing.map((m) => el("li", { text: m })))));
}

(async () => {
  const root = document.getElementById("root");
  try {
    const r = await fetch(FILE);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    render(await r.json());
  } catch (e) {
    root.replaceChildren(el("p", { class: "error", role: "alert", "data-testid": "load-error", text: `Could not load ${FILE}: ${e.message}` }));
  }
})();
