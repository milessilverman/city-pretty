"""Round 3/4 integration for city-pretty-la-county-fixed.html.
usage: python3 patch_page.py <in.html> <bundle-oc.b64> <corrections.json> <out.html>
Every text edit is an exact-string replacement that must match exactly once; the LA bundle is decoded, edited field by field,
re-encoded, and re-decoded to prove that only the intended catalog/upgrade fields changed."""
import sys, re, json, gzip, base64, copy

src, oc_b64_path, corr_path, out = sys.argv[1:5]
s = open(src, encoding="utf-8").read()
CHANGES = []   # human-readable change log


def rep(old, new, why, count=1):
    global s
    n = s.count(old)
    assert n == count, f"expected {count} match(es), found {n}: {why}\n{old[:200]}"
    s = s.replace(old, new)
    CHANGES.append(why)


def block(id_):
    m = re.search(r'(<script type="application/(?:octet-stream|json)" id="%s">)(.*?)(</script>)' % id_, s, re.S)
    assert m, id_
    return m


# ---------------------------------------------------------------- 1. LA bundle: catalog + upgrades
m = block("bundle")
B = json.loads(gzip.decompress(base64.b64decode(m.group(2).strip())))
B0 = copy.deepcopy(B)
C = json.load(open(corr_path))
for c in C:
    if c["target"] != "catalog":
        continue
    e = B["catalog"][c["key"]]
    hits = [i for i, t in enumerate(e["sources"]) if c["find"] in t]
    assert len(hits) == 1, (c["key"], hits)
    e["sources"][hits[0]] = e["sources"][hits[0]].replace(c["find"], c["replace"])
    CHANGES.append(f"catalog {c['key']}.sources: correction item {c['item']} ({c['source']})")
# crime coefficient: make foot_patrol / violence_interruption / bid carry the same caveat as street_lighting
SSV_OLD = "Schwartz, Susin & Voicu 2003 (NYC): 1% less violent crime -> +0.116% home prices"
SSV_NEW = "Schwartz, Susin & Voicu 2003 (NYC): 1% less violent crime -> about +0.12% home prices (coefficient as cited; not yet checked against the paper's table here)"
for k in ("foot_patrol", "violence_interruption", "bid"):
    e = B["catalog"][k]
    hits = [i for i, t in enumerate(e["sources"]) if t == SSV_OLD]
    assert len(hits) == 1, (k, e["sources"])
    e["sources"][hits[0]] = SSV_NEW
    CHANGES.append(f"catalog {k}.sources: Schwartz coefficient worded like street_lighting (unverified caveat)")
# bathroom addition: JLC/Zonda Cost vs Value 2025, Los Angeles, midrange
bath = [u for u in B["upgrades"] if u["name"] == "Add a full bathroom"]
assert len(bath) == 1 and bath[0]["cost_2025"] == 60000 and bath[0]["resale_value_added"] == 75000
bath[0]["cost_2025"] = 63595
bath[0]["resale_value_added"] = 36603
CHANGES.append("upgrades 'Add a full bathroom': cost 60,000 -> 63,595, value 75,000 -> 36,603 (JLC/Zonda Cost vs Value 2025, Los Angeles, midrange)")
# prove nothing else changed
def strip(b):
    b = copy.deepcopy(b)
    for k in list(C_KEYS):
        b["catalog"][k]["sources"] = None
    for u in b["upgrades"]:
        if u["name"] == "Add a full bathroom":
            u["cost_2025"] = u["resale_value_added"] = None
    return b
C_KEYS = {c["key"] for c in C if c["target"] == "catalog"} | {"foot_patrol", "violence_interruption", "bid"}
assert strip(B) == strip(B0), "LA bundle changed outside the intended fields"
raw = json.dumps(B, separators=(",", ":"), ensure_ascii=False).encode()
b64 = base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode()
assert json.loads(gzip.decompress(base64.b64decode(b64))) == B
s = s[:m.start(2)] + b64 + s[m.end(2):]

# ---------------------------------------------------------------- 2. Orange County bundle (rebuilt by build_oc.py)
m = block("bundle-oc")
oc = open(oc_b64_path).read().strip()
json.loads(gzip.decompress(base64.b64decode(oc)))   # must decode
s = s[:m.start(2)] + oc + s[m.end(2):]
CHANGES.append("bundle-oc replaced with the round-4 build (Anaheim street-site survey, tax-rate-area shares in m.e, GTFS 8 Nov 2026-13 Feb 2027, verified OC funding and fees)")

# ---------------------------------------------------------------- 3. JavaScript / page text
# 3a. EIFD calculator: Orange County shares (no Assessor roll value: weight by market value), county-aware text and policy
rep("""    const e = m.e; if (!e) return; n++;
    av += e.av || 0; avr += e.avr || 0; avc += e.avc || 0; np += e.np || 0; ry = e.ry || ry;
    if (e.sh) { e.sh.forEach((x, i) => shw[i] += x * e.av); shav += e.av; }
    (e.t || []).forEach(([t, v]) => tras.set(t, (tras.get(t) || 0) + v)); (e.x || []).forEach(x => ex.add(x)); });""",
    """    const e = m.e; if (!e) return; n++;
    av += e.av || 0; avr += e.avr || 0; avc += e.avc || 0; np += e.np || 0; ry = e.ry || ry;
    const wt = e.av || e.w || 0;   // Orange County has no roll value in the build; its shares are weighted by market value (w)
    if (e.sh && wt) { e.sh.forEach((x, i) => shw[i] += x * wt); shav += wt; }
    (e.t || []).forEach(([t, v]) => tras.set(t, (tras.get(t) || 0) + (v == null ? wt : v))); (e.x || []).forEach(x => ex.add(x)); });""",
    "EIFD calculator: block groups weighted by e.w (market value) when no roll value (Orange County)")
rep("""Schools can't take part. State law has no housing set-aside, but LA County Board Policy 3.106 (in effect since 1 Aug 2017; amendments proposed in October 2025 were sent for drafting, not adopted) sets conditions when the County joins (see below).</p>""",
    """Schools can't take part. State law has no housing set-aside, but ${activeCounty === "oc" ? "the County of Orange's EIFD Participation Policy (approved by the Board of Supervisors 4 Jun 2019) sets conditions when the County joins: the city must put in at least as much as the County, the County gives at most 50% of its share for at most 20 years, and the Board must approve (see below)" : "LA County Board Policy 3.106 (revised and approved by the County Audit Committee on 16 Jul 2025, next review 1 Aug 2029; amendments for disaster-recovery districts were directed in October 2025, adoption not verified) sets conditions when the County joins (see below)"}.</p>""",
    "EIFD text: Policy 3.106 sentence corrected (16 Jul 2025 revision); Orange County shows its own 2019 County policy")
rep("""    ${fld("e-kp", "County pledge (%)", 49, 1, "Artesia 49%; range 11–50%")}""",
    """    ${fld("e-kp", "County pledge (%)", 49, 1, activeCounty === "oc" ? "Artesia 49%; OC policy cap 50%" : "Artesia 49%; range 11–50%")}""",
    "EIFD calculator: Orange County pledge note shows the County's 50% cap")
rep("""      <p class="small muted">Where each $1 of the 1% tax goes here, weighted by assessed value across ${a.tras.length} tax-rate area${a.tras.length > 1 ? "s" : ""} (largest: ${a.tras.filter(t => t[1] > 0).slice(0, 3).map(([t, x]) => `TRA ${esc(t)}, ${fmt$(x)}`).join("; ")}). Source: LA County Auditor-Controller ${esc((D.eifd || {}).factor_year || "")} Modified ATI ratios (AF49 report), the shares the Auditor uses to split tax increment. Special districts can also join; their shares are shown but not pledged in this screen.</p>` : "";""",
    """      ${activeCounty === "oc" ? `<p class="small muted">Where each $1 of growth in the 1% tax goes here: ${a.tras.length > 1 ? `the main tax-rate areas of these ${a.n} block groups (largest: ${a.tras.slice(0, 3).map(([t]) => `TRA ${esc(t)}`).join("; ")}), weighted by market value` : `tax-rate area ${esc((a.tras[0] || [""])[0])}, weighted by land area inside this block group`}. Source: Orange County Auditor-Controller Section 99 factor report by tax-rate area, FY 2026-27 (printed 28 Aug 2026), joined to the State Board of Equalization's 2026 tax-rate-area map. The city share is the city's general fund only; its lighting, sewer and similar funds count under other districts. Special districts can also join; their shares are shown but not pledged in this screen.</p>` : `<p class="small muted">Where each $1 of the 1% tax goes here, weighted by assessed value across ${a.tras.length} tax-rate area${a.tras.length > 1 ? "s" : ""} (largest: ${a.tras.filter(t => t[1] > 0).slice(0, 3).map(([t, x]) => `TRA ${esc(t)}, ${fmt$(x)}`).join("; ")}). Source: LA County Auditor-Controller ${esc((D.eifd || {}).factor_year || "")} Modified ATI ratios (AF49 report), the shares the Auditor uses to split tax increment. Special districts can also join; their shares are shown but not pledged in this screen.</p>`}` : "";""",
    "EIFD calculator: Orange County split cites the Auditor's Section 99 report and BOE TRA map")
rep("""      : `No Assessor roll value matched this area, so the base is estimated as 55% of market value (${a.homes.toLocaleString()} homes). ${a.sh ? "" : "Tax shares are placeholders: no apportionment factors matched. "}All figures are a screening estimate, not a financing plan.`;""",
    """      : `${activeCounty === "oc" ? "The Orange County Assessor roll is not in this build (the Assessor sells roll data in person only), so the base" : "No Assessor roll value matched this area, so the base"} is estimated as 55% of market value (${a.homes.toLocaleString()} homes). ${a.sh ? "" : "Tax shares are placeholders: no apportionment factors matched. "}All figures are a screening estimate, not a financing plan.`;""",
    "EIFD calculator: Orange County base-value note explains why the 55% estimate is used")
rep("""    if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). Board Policy 3.106 requires the city's contribution to at least equal the County General Fund's plus any special districts'.`);
    if (county && !uninc && capture > 0 && cityC / capture < 0.15 - 1e-9) w.push("Policy 3.106 also expects at least 15¢ of each captured $1 from the city, with limited exceptions.");
    if (uninc) w.push("No city share here (unincorporated), so the County would form and run the district itself, as it did for West Carson.");""",
    """    if (activeCounty === "oc") {
      if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). The County's EIFD Participation Policy requires the city's contribution to be equal to or greater than the County's.`);
      if (county && v("e-kp") > 50 + 1e-9) w.push("The County's policy caps its contribution at 50% of its share of the increment, for no longer than 20 years.");
      if (uninc) w.push("No city share here (unincorporated); an EIFD would rest on the County alone, which its policy does not contemplate (it expects a city applicant).");
    } else {
    if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). Board Policy 3.106 requires the city's contribution to at least equal the County General Fund's plus any special districts'.`);
    if (county && !uninc && capture > 0 && cityC / capture < 0.15 - 1e-9) w.push("Policy 3.106 also expects at least 15¢ of each captured $1 from the city, with limited exceptions.");
    if (uninc) w.push("No city share here (unincorporated), so the County would form and run the district itself, as it did for West Carson.");
    }""",
    "EIFD calculator: Orange County policy checks (city >= County, County cap 50%, 20 years)")
rep("""${activeCounty === "oc" ? " — for reference; no Orange County EIFD was found in the sources reached" : ""}</summary>""",
    """${activeCounty === "oc" ? " — for reference" : ""}</summary>""",
    "EIFD register: removed 'no Orange County EIFD was found' (Placentia EIFD, 2019, verified)")
rep("""<p class="small" id="e-warn"></p>${eifdRegister()}</div>`;""",
    """<p class="small" id="e-warn"></p>${activeCounty === "oc" ? ocEifdNote() : ""}${eifdRegister()}</div>`;""",
    "EIFD calculator: Orange County note (County policy, Placentia EIFD) shown above the LA register")
rep("""function eifdRegister() {""",
    """function ocEifdNote() {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).OC_EIFD; if (!P) return "";
  return `<p class="small" style="margin:6px 0 2px"><b>In Orange County:</b> ${esc(P.what)} ${esc(P.amount)} <a href="${esc(P.example_source)}" target="_blank" rel="noopener">Placentia amended IFP (May 2024)</a>; <a href="${esc(P.source)}" target="_blank" rel="noopener">County EIFD Participation Policy</a>.</p>`;
}
function eifdRegister() {""",
    "EIFD register: helper for the Orange County note")
rep("""  const uninc = /^Unincorporated/i.test(p.c || "") || p.c === "Los Angeles County";
  const sh = m.e && m.e.sh ? m.e.sh : [uninc ? 0 : 0.20, 0.24];""",
    """  const uninc = /^Unincorporated/i.test(p.c || "") || / \\(unincorporated\\)$/.test(p.c || "") || p.c === "Los Angeles County";
  const sh = m.e && m.e.sh ? m.e.sh : [uninc ? 0 : 0.20, 0.24];""",
    "Funding plan: Orange County named unincorporated communities count as unincorporated")
rep("""    const a = eifdArea(p, scope), unincorp = /^Unincorporated/i.test(p.c) || p.c === "Los Angeles County";""",
    """    const a = eifdArea(p, scope), unincorp = /^Unincorporated/i.test(p.c) || / \\(unincorporated\\)$/.test(p.c || "") || p.c === "Los Angeles County";""",
    "EIFD calculator: Orange County named unincorporated communities count as unincorporated")

# 3b. Funding plan: Orange County programmes instead of LA ones; city's M2 Local Fair Share instead of Metro local return
rep("""  const others = (c.funding || []).filter(k => k !== "EIFD" && D.funding[k]).map(k => D.funding[k]);
  const cm = ((D.r10 || {}).city || {})[p.c] || null, ex = ((D.r10 || {}).stacks || {})[r.id] || null;""",
    """  const ocF = isOCArea(m) ? ocFunding(r.id) : null;
  const others = ocF ? ocF.funding.filter(f => f.code !== "OC_EIFD").map(f => [f.name, f.what, f.source]) : (c.funding || []).filter(k => k !== "EIFD" && D.funding[k]).map(k => D.funding[k]);
  const cm = ocF ? null : ((D.r10 || {}).city || {})[p.c] || null, ex = ((D.r10 || {}).stacks || {})[r.id] || null;""",
    "Funding plan: Orange County uses verified OC programmes (oc_funding) instead of LA County programmes")
rep("""function cityMoney(f) {
  const cm = f.cm; if (!cm) return "";""",
    """function ocFunding(id) {
  const F = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || null;
  return F && F[id] ? F[id] : null;
}
function ocLfs(city) {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).M2_LFS; if (!P) return null;
  const k = /^Unincorporated/i.test(city || "") || / \\(unincorporated\\)$/.test(city || "") ? "County Unincorporated" : city;
  return P.per_city_fy2026_27[k] != null ? { amt: P.per_city_fy2026_27[k], who: k === "County Unincorporated" ? "the County (unincorporated areas)" : k, src: P.source, tab: P.date } : null;
}
function ocMoney(f, id) {
  const F = ocFunding(id), L = ocLfs(f.city); if (!L) return "";
  const uses = F && F.funding.some(x => x.code === "M2_LFS");
  return `<p style="margin:6px 0 0"><b>${uses ? "What " + esc(L.who) + " already gets" : esc(L.who) + "'s own yearly money"}:</b> ~${fmt$(L.amt)} of OCTA Measure M2 Local Fair Share in FY 2026-27 (OCTA forecast apportionment)${uses ? ", which can pay for street, pedestrian, transit and active-transportation projects like this" : ", for streets, transit and active transportation; this one would rely on other grants or the general fund"}.</p>`;
}
function ocFundingHtml(id, m) {
  const F = ocFunding(id); if (!F) return "";
  const fees = ocFeeLine(id, m);
  if (!F.funding.length) return `<p class="small"><b>Orange County funding:</b> <span class="muted">${esc(F.notes)}</span></p>${fees}`;
  return `<p class="small"><b>Orange County funding (verified):</b> ${F.funding.map(x => `<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.name)}</a> <span class="muted">(${esc(x.what)})</span>`).join("; ")}.${F.process ? ` <b>How:</b> ${esc(F.process)}.` : ""}${F.who_decides ? ` <b>Who decides:</b> ${esc(F.who_decides)}.` : ""}${F.notes ? ` <span class="muted">${esc(F.notes)}</span>` : ""}</p>${fees}`;
}
function ocFeeLine(id, m) {
  const fees = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_fees) || null; if (!fees) return "";
  const c = (m && m.c) || "", city = fees[c], key = id === "street_trees" ? "street_tree_fee" : id === "sidewalks" ? "sidewalk_cost_share" : id === "adu" ? "adu_impact_fee" : null;
  const out = [];
  if (key && city && city[key]) { const x = city[key]; out.push(`<b>${esc(c)}:</b> ${esc(x.value)} <span class="muted">(${esc(x.code)}; <a href="${esc(x.source)}" target="_blank" rel="noopener">source</a>, ${esc(x.date)})</span>`); }
  if (id === "adu" && fees._meta && fees._meta.adu_impact_fee_law) { const L = fees._meta.adu_impact_fee_law; out.push(`<b>State rule:</b> ${esc(L.value)} <span class="muted">(<a href="${esc(L.source)}" target="_blank" rel="noopener">statute text</a>)</span>`); }
  return out.length ? `<p class="small">${out.join("<br>")}</p>` : "";
}
function cityMoney(f) {
  if (f.oc) return ocMoney(f, f.id);
  const cm = f.cm; if (!cm) return "";""",
    "Funding plan: Orange County helpers (programmes, M2 Local Fair Share per city, verified city fees)")
rep("""  return { eifd, bond, y10, tot, cityTot, cntyTot, cityK, cntyK, rest, others, uninc, share: r.cost > 0 ? eifd / r.cost : 0, om: r.om || 0, sh, city: p.c, cm, ex, keys: c.funding || [], program };""",
    """  return { eifd, bond, y10, tot, cityTot, cntyTot, cityK, cntyK, rest, others, uninc, share: r.cost > 0 ? eifd / r.cost : 0, om: r.om || 0, sh, city: p.c, cm, ex, keys: c.funding || [], program, id: r.id, oc: !!ocF };""",
    "Funding plan: carry project id and county flag")
rep("""      ${(c.funding || []).length && !(mode === "value" || mode === "qol") ? `<p class="small"><b>Who pays:</b> ${c.funding.map(k => { const f = D.funding[k]; return f ? `${f[2] ? `<a href="${esc(f[2])}" target="_blank" rel="noopener">${esc(f[0])}</a>` : esc(f[0])} (${esc(f[1])})` : ""; }).filter(Boolean).join("; ")}</p>` : ""}""",
    """      ${isOCArea(m) ? ocFundingHtml(r.id, m) : (c.funding || []).length && !(mode === "value" || mode === "qol") ? `<p class="small"><b>Who pays:</b> ${c.funding.map(k => { const f = D.funding[k]; return f ? `${f[2] ? `<a href="${esc(f[2])}" target="_blank" rel="noopener">${esc(f[0])}</a>` : esc(f[0])} (${esc(f[1])})` : ""; }).filter(Boolean).join("; ")}</p>` : ""}""",
    "Project card: Orange County shows verified OC funding, process and city fees instead of LA programmes")
rep("""[/Council District local return allocation/g, "the city's Measure M2 local-return allocation"]""",
    """[/Council District local return allocation/g, "the city's OCTA Measure M2 Local Fair Share allocation"]""",
    "OC agency wording: OCTA's programme is 'Measure M2 Local Fair Share' (not 'local return')")

# 3c. Per-house: bathroom value and ADU cost source
rep("""      v = Math.round(houseHv * 0.10); note = `Cures the bedroom-to-bath imbalance; modeled at ~10% of this home's ${fmt$(houseHv)} value (estimate)`;""",
    """      v = 36603; note = "Cures the bedroom-to-bath imbalance. Value $36,603 on a $63,595 cost: JLC/Zonda Cost vs Value 2025, Los Angeles, midrange 6x8-ft bathroom addition (a survey estimate, not measured sales)";""",
    "Per-house: 'Add a full bathroom' value from JLC/Zonda 2025 LA ($36,603) instead of 10% of home value")
rep("""    // Calibrated to Argon 2025-2026 Trade Schedules:""",
    """    // Unit costs below are this page's own model; the "trade schedule" they were first said to come from could not be found (Nov 2026), so they are unverified estimates:""",
    "ADU cost model comment: removed the unfound 'Argon' attribution")
rep("""    // Calibrated to Argon 2025-2026 Schedule: 600 sf = $393,000 ($655/sf all-in)""",
    """    // Unverified model estimate (no published schedule found): 600 sf = $393,000 ($655/sf all-in)""",
    "Second-story cost model comment: removed the unfound 'Argon' attribution")
rep("""      <div><b>Total All-In Cost: ${fmt$(u.c)}</b> ${ca.costPerSqFt ? `<span class="muted">(~$${Math.round(ca.costPerSqFt)}/sq ft)</span>` : ""}</div>
    </div>""",
    """      <div><b>Total All-In Cost: ${fmt$(u.c)}</b> ${ca.costPerSqFt ? `<span class="muted">(~$${Math.round(ca.costPerSqFt)}/sq ft)</span>` : ""}</div>
    </div>
    <p class="small muted" style="margin:4px 0 6px">Construction costs are this page's model estimate (unit costs per sq ft), not contractor quotes; the cost schedule they were first calibrated to could not be found, so treat them as unverified. Fees follow the cited state rules.</p>""",
    "Cost analysis card: visible note that construction costs are unverified model estimates")

rep("""add("Add a bathroom", "yes", `${beds} bedrooms but only ${baths} bath${baths > 1 ? "s" : ""}: strong resale ROI.`)""",
    """add("Add a bathroom", "yes", `${beds} bedrooms but only ${baths} bath${baths > 1 ? "s" : ""}: fixes the bedroom-to-bath imbalance, though an addition recoups only about 58% of its cost at resale (JLC/Zonda Cost vs Value 2025, Los Angeles: $63,595 cost, $36,603 value).`)""",
    "Per-house checklist: 'Add a bathroom' no longer claims 'strong resale ROI' (JLC 2025 LA: 57.6% recouped)")
assert "Argon" not in s, "Argon still present"
open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w").write("\n".join(f"{i + 1}. {c}" for i, c in enumerate(CHANGES)) + "\n")
print(len(CHANGES), "changes applied ->", out)
