#!/usr/bin/env python3
"""
City Pretty: Nov 08 Comprehensive Audit Runtime Verification
Tests live DOM and V8 runtime in headless Chrome (port 9444):
1. Jurisdiction completeness in <select id="county-more">
2. Top bar controls (local metro evidence, ecoregion heat, displacement metric)
3. Experimental mode quarantine toggle
4. Dynamic canopy card economics (climate regime scaling)
5. Single-house parcel auditor & inspector panel rendering
6. AI Advisor non-reliance notice injection
7. Asset URL subpath resolution
"""

import json
import urllib.request
import websocket
import time
import sys

CDP_HTTP = "http://127.0.0.1:9444"

def main():
    print("========================================================")
    print("NOV 08 COMPREHENSIVE AUDIT BROWSER RUNTIME VERIFICATION")
    print("========================================================")

    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    target = None
    for tab in tabs:
        if "8088" in tab.get("url", ""):
            target = tab
            break
    if not target:
        target = tabs[0]

    ws_url = target["webSocketDebuggerUrl"]
    ws = websocket.create_connection(ws_url, timeout=30)
    msg_id = 0

    def call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        ws.send(json.dumps(payload))
        while True:
            res = ws.recv()
            data = json.loads(res)
            if data.get("id") == msg_id:
                return data.get("result", {})

    def eval_js(expr):
        r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in r:
            print("JS EXCEPTION:", r["exceptionDetails"])
            return None
        return r.get("result", {}).get("value")

    call("Page.enable")
    call("Runtime.enable")

    # Reload page to execute fresh index.html
    print("Reloading http://127.0.0.1:8088/index.html...")
    call("Page.reload", {"ignoreCache": True})
    time.sleep(2.0)

    # 1. Test Jurisdiction completeness in <select id="county-more">
    res_jurisdictions = eval_js("""
    (() => {
        const sel = document.getElementById("county-more");
        if (!sel) return { ok: false, error: "no_county_more_select" };
        const opts = Array.from(sel.querySelectorAll("option")).map(o => o.value);
        const optgroups = Array.from(sel.querySelectorAll("optgroup")).map(g => g.label);
        
        return {
            ok: true,
            totalOptions: opts.length,
            hasAlaska: optgroups.includes("Alaska"),
            hasHawaii: optgroups.includes("Hawaii"),
            hasAnchorage: opts.includes("02020"),
            hasHonolulu: opts.includes("15003"),
            hasCtNortheastern: opts.includes("09150"),
            hasFairfaxCity: opts.includes("51600"),
            hasRadfordCity: opts.includes("51750"),
            hasWinchesterCity: opts.includes("51840"),
            completenessCount: (typeof COUNTY_COMPLETENESS_INDEX !== "undefined") ? Object.keys(COUNTY_COMPLETENESS_INDEX).length : 0
        };
    })()
    """)
    print("1. Jurisdiction Completeness Check:", res_jurisdictions)
    assert res_jurisdictions["ok"] is True
    assert res_jurisdictions["hasAlaska"] is True
    assert res_jurisdictions["hasHawaii"] is True
    assert res_jurisdictions["hasAnchorage"] is True
    assert res_jurisdictions["hasHonolulu"] is True
    assert res_jurisdictions["hasCtNortheastern"] is True
    assert res_jurisdictions["hasFairfaxCity"] is True
    assert res_jurisdictions["hasRadfordCity"] is True
    assert res_jurisdictions["hasWinchesterCity"] is True
    assert res_jurisdictions["completenessCount"] >= 700
    print("✓ All 700+ jurisdictions verified in live browser selector and completeness index.")

    # 2. Test Top Bar Controls
    res_controls = eval_js("""
    (() => {
        const evidA = document.querySelector('#evid option[value="A"]');
        const heatOpt = document.querySelector('#metric option[value="heat"]');
        const dispOpt = document.querySelector('#metric option[value="displacement"]');
        
        return {
            evidText: evidA ? evidA.textContent.trim() : null,
            heatText: heatOpt ? heatOpt.textContent.trim() : null,
            hasDisplacement: !!dispOpt,
            displacementText: dispOpt ? dispOpt.textContent.trim() : null,
            metricDisplacementInDict: (typeof METRICS !== "undefined" && !!METRICS.displacement)
        };
    })()
    """)
    print("2. Top Bar Controls Check:", res_controls)
    assert res_controls["evidText"] == "Measured in local metro only (A)"
    assert res_controls["heatText"] == "Heat vs. EPA Level IV ecoregion median"
    assert res_controls["hasDisplacement"] is True
    assert "displacement" in res_controls["displacementText"].lower()
    assert res_controls["metricDisplacementInDict"] is True
    print("✓ Controls cleaned of hardcoded LA strings; displacement metric wired in DOM & METRICS.")

    # 3. Test Experimental Modes Quarantine
    res_exp = eval_js("""
    (() => {
        // Run patch to ensure initial quarantine
        patchTopBarControlsDom();
        const optU1 = document.querySelector('#evid option[value="U"]');
        const optProfit1 = document.querySelector('#metric option[value="profit"]');
        const initialHidden = (optU1 && optU1.hidden) && (optProfit1 && optProfit1.hidden);

        // Toggle on
        toggleExperimentalModes(true);
        const optU2 = document.querySelector('#evid option[value="U"]');
        const optProfit2 = document.querySelector('#metric option[value="profit"]');
        const unhiddenAfterToggle = (optU2 && !optU2.hidden) && (optProfit2 && !optProfit2.hidden);

        // Toggle back off
        toggleExperimentalModes(false);
        const optU3 = document.querySelector('#evid option[value="U"]');
        const optProfit3 = document.querySelector('#metric option[value="profit"]');
        const hiddenAgain = (optU3 && optU3.hidden) && (optProfit3 && optProfit3.hidden);

        return {
            initialHidden,
            unhiddenAfterToggle,
            hiddenAgain
        };
    })()
    """)
    print("3. Experimental Modes Quarantine Check:", res_exp)
    assert res_exp["initialHidden"] is True
    assert res_exp["unhiddenAfterToggle"] is True
    assert res_exp["hiddenAgain"] is True
    print("✓ Experimental modes (Grade U & unverified profit) strictly quarantined behind toggle.")

    # 4. Test Dynamic Canopy Card Climate Scaling
    res_canopy = eval_js("""
    (() => {
        patchCanopyCardDom("MN", "Hennepin County");
        const mnText = document.getElementById("canopy-hud-economic").textContent;

        patchCanopyCardDom("AZ", "Maricopa County");
        const azText = document.getElementById("canopy-hud-economic").textContent;

        patchCanopyCardDom("CA", "Los Angeles County");
        const caText = document.getElementById("canopy-hud-economic").textContent;

        return {
            mnText,
            azText,
            caText
        };
    })()
    """)
    print("4. Canopy Card Climate Regime Check:")
    print("   MN:", res_canopy["mnText"])
    print("   AZ:", res_canopy["azText"])
    print("   CA:", res_canopy["caText"])
    assert "windbreak" in res_canopy["mnText"]
    assert "drip irrigation" in res_canopy["azText"]
    assert "7,130" in res_canopy["caText"]
    print("✓ Canopy card dynamically updates based on regional climate regime and RSMeans multipliers.")

    # 5. Test Single-House Parcel Auditor & Panel Rendering
    res_audit_panel = eval_js("""
    (() => {
        const audit = auditSingleHouseParcel({
            parcelId: "06037-999888",
            address: "450 S Grand Ave, Los Angeles, CA",
            lat: 34.051,
            lng: -118.251,
            lotSqft: 7200,
            livingSqft: 2200,
            yearBuilt: 1982,
            neighborhoodMedianHv: 880000,
            stateCode: "CA",
            countyFips: "06037",
            recentPermits: [
                { issue_date: "2024-06-01", permit_type: "remodel", valuation_usd: 60000, description: "Kitchen remodel" }
            ]
        });

        const html = renderHouseAuditAside(audit);
        return {
            estimatedValue: audit.valuation.estimatedValue,
            permitCapAdded: audit.valuation.permitCapitalizationAdded,
            htmlLength: html.length,
            hasAvmSection: html.includes("Institutional AVM Valuation"),
            hasSolarSection: html.includes("2026+ Rooftop Solar"),
            hasTreeSection: html.includes("Climate-Calibrated Street Tree"),
            hasDisclaimers: html.includes("Institutional Disclaimers:")
        };
    })()
    """)
    print("5. Single-House Parcel Auditor & Panel Check:", res_audit_panel)
    assert res_audit_panel["estimatedValue"] > 800000
    assert res_audit_panel["permitCapAdded"] == 51000 # 60,000 * 0.85 = 51,000
    assert res_audit_panel["hasAvmSection"] is True
    assert res_audit_panel["hasSolarSection"] is True
    assert res_audit_panel["hasTreeSection"] is True
    assert res_audit_panel["hasDisclaimers"] is True
    print("✓ Single-house parcel auditor & inspector aside successfully executed in browser.")

    # 6. Test AI Advisor Non-Reliance Notice Injection
    res_ai = eval_js("""
    new Promise(resolve => {
        openAiAdvisor();
        askAiPrompt("p3_roi");
        setTimeout(() => {
            const lastMsg = aiHistory[aiHistory.length - 1];
            resolve({
                role: lastMsg.role,
                textLength: lastMsg.text.length,
                hasTransit: lastMsg.text.includes("Transit Corridor"),
                hasDisclaimer: lastMsg.text.includes("NON-RELIANCE NOTICE")
            });
        }, 600);
    })
    """)
    print("6. AI Advisor Non-Reliance Guardrails Check:", res_ai)
    assert res_ai["role"] == "assistant"
    assert res_ai["hasTransit"] is True
    assert res_ai["hasDisclaimer"] is True
    print("✓ AI Advisor outputs enforce institutional legal and engineering non-reliance notices.")

    # 7. Test Asset URL Subpath Resolution
    res_url = eval_js("""
    (() => {
        const u1 = resolveRepoAssetUrl("data/test.json");
        const u2 = resolveRepoAssetUrl("/tiles/la/15/5602/12845.pbf");
        const u3 = resolveRepoAssetUrl("https://example.com/api");
        return { u1, u2, u3 };
    })()
    """)
    print("7. Subpath Asset Resolution Check:", res_url)
    assert res_url["u3"] == "https://example.com/api"
    assert not res_url["u2"].startswith("//")
    print("✓ Asset URL resolution verified.")

    ws.close()
    print("========================================================")
    print("ALL BROWSER RUNTIME VERIFICATIONS PASSED (100% SUCCESS)!")
    print("========================================================")

if __name__ == "__main__":
    main()
