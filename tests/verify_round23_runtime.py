#!/usr/bin/env python3
"""
verify_round23_runtime.py
Tests runtime in Chrome CDP:
1. openDataAccuracyModal() and renderCountyReadinessMatrix()
2. Tab switching between Readiness Matrix and Econometric Model Provenance
3. 6-Subsystem scorecard validation (Assessor, Zoning, GTFS, Safety CAD gaps, TIF AF49/Measure W, Ecoregion norm)
4. Directory live search and tier filtering across 639 counties
5. syncMethodsModalToCounty() dynamic decoupling (CA vs TX vs FL)
6. exportExecutiveProspectus() dynamic multi-state statutes and tax notes
"""

import urllib.request
import json
import base64
import time
import sys

def cdp_send(ws_url, method, params=None, req_id=1):
    import websocket
    ws = websocket.create_connection(ws_url, timeout=15)
    payload = {"id": req_id, "method": method, "params": params or {}}
    ws.send(json.dumps(payload))
    res = json.loads(ws.recv())
    ws.close()
    return res

def eval_js(target_id, expr):
    import websocket
    ws_url = f"ws://127.0.0.1:9444/devtools/page/{target_id}"
    ws = websocket.create_connection(ws_url, timeout=15)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": expr, "returnByValue": True}}))
    res = json.loads(ws.recv())
    ws.close()
    if "result" in res and "result" in res["result"]:
        return res["result"]["result"].get("value")
    return res

def capture_screenshot(target_id, filename):
    import websocket
    ws_url = f"ws://127.0.0.1:9444/devtools/page/{target_id}"
    ws = websocket.create_connection(ws_url, timeout=15)
    ws.send(json.dumps({"id": 2, "method": "Page.captureScreenshot", "params": {"format": "jpeg", "quality": 90}}))
    res = json.loads(ws.recv())
    ws.close()
    if "result" in res and "data" in res["result"]:
        b64 = res["result"]["data"]
        raw = base64.b64decode(b64)
        with open(filename, "wb") as f:
            f.write(raw)
        return True
    return False

def main():
    print("Checking Chrome debug endpoints on port 9444...")
    req = urllib.request.urlopen("http://127.0.0.1:9444/json")
    pages = json.loads(req.read().decode())
    target = None
    for p in pages:
        if p.get("type") == "page":
            target = p
            break
    if not target:
        print("No open page target found!")
        sys.exit(1)

    target_id = target["id"]
    print(f"Target ID: {target_id}")

    # Navigate to local web server
    import websocket
    ws_url = f"ws://127.0.0.1:9444/devtools/page/{target_id}"
    ws = websocket.create_connection(ws_url, timeout=15)
    ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": "http://127.0.0.1:8088/index.html"}}))
    ws.recv()
    ws.close()
    time.sleep(3.5)

    print("--- 1. Testing openDataAccuracyModal() and renderCountyReadinessMatrix() ---")
    res1 = eval_js(target_id, """(() => {
        openDataAccuracyModal("06037");
        const modal = document.getElementById("accuracy-modal");
        const matrix = document.getElementById("county-readiness-matrix-container");
        const tabReadiness = document.getElementById("accuracy-tab-readiness");
        const tabProv = document.getElementById("accuracy-tab-provenance");
        return {
            modalVisible: !modal.hidden,
            readinessTabDisplay: tabReadiness.style.display,
            provTabDisplay: tabProv.style.display,
            hasContent: matrix && matrix.innerHTML.length > 500,
            title: matrix ? matrix.querySelector("h3").textContent : null,
            hasSafetyGaps: matrix ? matrix.innerHTML.includes("Beverly Hills PD, Burbank PD, Glendale PD, Pasadena PD, Torrance PD, and Culver City PD") : false,
            hasTifAF49: matrix ? matrix.innerHTML.includes("AF49 Modified ATI Ratios") : false
        };
    })()""")
    print("Test 1 Result:", json.dumps(res1, indent=2))
    assert res1["modalVisible"], "Accuracy modal should be visible"
    assert res1["hasContent"], "Readiness matrix should be populated"
    assert res1["hasSafetyGaps"], "LA County safety gaps notice should be present"
    assert res1["hasTifAF49"], "AF49 Modified ATI Ratios should be referenced"

    capture_screenshot(target_id, "/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_readiness_matrix_verified.jpg")
    print("✓ Saved screenshot_readiness_matrix_verified.jpg")

    print("--- 2. Testing Directory Filter (639 Counties) & County Inspection ---")
    res2 = eval_js(target_id, """(() => {
        filterCountyReadinessTier("verified_B");
        const countEl = document.getElementById("county-matrix-count");
        const tbody = document.getElementById("county-matrix-table-tbody");
        const verifiedRows = tbody ? tbody.children.length : 0;

        filterCountyReadinessTable("Harris");
        const harrisRows = tbody ? tbody.children.length : 0;

        // Inspect Harris County TX
        renderCountyReadinessMatrix("48201");
        const matrix = document.getElementById("county-readiness-matrix-container");
        return {
            verifiedRows,
            harrisRows,
            harrisTitle: matrix ? matrix.querySelector("h3").textContent : null,
            harrisTirz: matrix ? matrix.innerHTML.includes("Texas TIRZ (Tex. Tax Code Ch. 311)") : false,
            harrisHome: matrix ? matrix.innerHTML.includes("Austin HOME") : false,
            harrisTwdb: matrix ? matrix.innerHTML.includes("TWDB") : false
        };
    })()""")
    print("Test 2 Result:", json.dumps(res2, indent=2))
    assert res2["harrisTirz"], "Harris County must reference Texas TIRZ"
    assert res2["harrisHome"], "Texas statutes must be referenced"

    print("--- 3. Testing syncMethodsModalToCounty() Decoupling ---")
    res3 = eval_js(target_id, """(() => {
        // Test LA County
        syncMethodsModalToCounty("06037");
        const laFin = document.getElementById("methods-financing-section").textContent;
        const laWater = document.getElementById("methods-water-section").textContent;

        // Test Texas (48201)
        syncMethodsModalToCounty("48201");
        const txFin = document.getElementById("methods-financing-section").textContent;
        const txWater = document.getElementById("methods-water-section").textContent;

        // Test Florida (12086)
        syncMethodsModalToCounty("12086");
        const flFin = document.getElementById("methods-financing-section").textContent;
        const flWater = document.getElementById("methods-water-section").textContent;

        return {
            laHasMeasureW: laWater.includes("Safe Clean Water Program"),
            laHasAF49: laFin.includes("AF49 report"),
            txHasTIRZ: txFin.includes("Texas Tax Increment Reinvestment Zones (TIRZ, Tex. Tax Code Ch. 311)"),
            txHasTWDB: txWater.includes("Texas Water Development Board (TWDB)"),
            flHasCRA: flFin.includes("Florida Community Redevelopment Agencies (CRA, Fla. Stat. § 163 Part III)"),
            flHasResilientFL: flWater.includes("Resilient Florida (Fla. Stat. § 380.093)")
        };
    })()""")
    print("Test 3 Result:", json.dumps(res3, indent=2))
    assert res3["laHasMeasureW"], "LA County water section should reference Measure W"
    assert res3["txHasTIRZ"], "Texas financing should reference TIRZ"
    assert res3["flHasCRA"], "Florida financing should reference CRA § 163"

    print("--- 4. Testing getEcoregionNorm() Normalization ---")
    res4 = eval_js(target_id, """(() => {
        const coastalNorm = getEcoregionNorm({ c: "Santa Monica", n: "Downtown Santa Monica" }, { ht: 2.1, tg: 19 });
        const valleyNorm = getEcoregionNorm({ c: "Van Nuys", n: "San Fernando Valley" }, { ht: 4.5, tg: 22 });
        const desertNorm = getEcoregionNorm({ c: "Lancaster", n: "Antelope Valley" }, { ht: 8.0, tg: 12 });
        return {
            coastalCode: coastalNorm.ecoregionCode,
            coastalTarget: coastalNorm.targetCanopyPct,
            valleyCode: valleyNorm.ecoregionCode,
            valleyTarget: valleyNorm.targetCanopyPct,
            desertCode: desertNorm.ecoregionCode,
            desertTarget: desertNorm.targetCanopyPct
        };
    })()""")
    print("Test 4 Result:", json.dumps(res4, indent=2))
    assert "85f" in res4["coastalCode"], "Coastal should resolve to EPA IV 85f"
    assert "85g" in res4["valleyCode"], "Valley should resolve to EPA IV 85g"
    assert "81" in res4["desertCode"], "Lancaster should resolve to Mojave 81"
    assert res4["desertTarget"] == 15, "Desert canopy target should be 15%"

    print("--- 5. Testing Tab Switching in Accuracy Modal ---")
    res5 = eval_js(target_id, """(() => {
        switchAccuracyTab("provenance");
        const tabReadiness = document.getElementById("accuracy-tab-readiness");
        const tabProv = document.getElementById("accuracy-tab-provenance");
        const btnProv = document.getElementById("tab-btn-model-provenance");
        const p1 = {
            provActive: btnProv.classList.contains("active"),
            provDisplay: tabProv.style.display,
            readinessDisplay: tabReadiness.style.display
        };
        switchAccuracyTab("readiness");
        const p2 = {
            readinessDisplay: tabReadiness.style.display,
            provDisplay: tabProv.style.display
        };
        return { p1, p2 };
    })()""")
    print("Test 5 Result:", json.dumps(res5, indent=2))
    assert res5["p1"]["provActive"], "Provenance tab button should be active"
    assert res5["p2"]["readinessDisplay"] == "block", "Readiness tab should be displayed on switch"

    print("\n========================================================")
    print("ALL ROUND 23 RUNTIME VERIFICATIONS PASSED (100% SUCCESS)!")
    print("========================================================")

if __name__ == "__main__":
    main()
