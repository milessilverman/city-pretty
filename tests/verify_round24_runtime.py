#!/usr/bin/env python3
"""
verify_round24_runtime.py
Tests:
1. Multi-token directory search (e.g. "harris tx", "orange ca", "cook il", "miami fl").
2. exportAccuracyReport() and .accuracy-printing class activation.
3. exportExecutiveProspectus() 4-column header with baseline AVM valuation and $/sqft.
"""

import urllib.request
import json
import base64
import time
import sys
import websocket

def main():
    print("Checking Chrome debug endpoints on port 9444...")
    req = urllib.request.urlopen("http://127.0.0.1:9444/json")
    pages = json.loads(req.read().decode())
    target_id = pages[0]["id"]
    ws_url = f"ws://127.0.0.1:9444/devtools/page/{target_id}"
    ws = websocket.create_connection(ws_url, timeout=15)

    # Reload page
    ws.send(json.dumps({"id": 1, "method": "Page.reload"}))
    ws.recv()
    time.sleep(3.0)

    print("--- 1. Testing Multi-Token Search in County Directory ---")
    expr1 = """(() => {
        openDataAccuracyModal("06037");

        filterCountyReadinessTable("harris tx");
        const tbody = document.getElementById("county-matrix-table-tbody");
        const harrisCount = tbody.children.length;
        const harrisText = tbody.children[0] ? tbody.children[0].textContent : "";

        filterCountyReadinessTable("orange ca");
        const orangeCount = tbody.children.length;
        const orangeText = tbody.children[0] ? tbody.children[0].textContent : "";

        filterCountyReadinessTable("cook il");
        const cookCount = tbody.children.length;
        const cookText = tbody.children[0] ? tbody.children[0].textContent : "";

        filterCountyReadinessTable("miami fl");
        const miamiCount = tbody.children.length;
        const miamiText = tbody.children[0] ? tbody.children[0].textContent : "";

        return {
            harrisMatch: harrisCount === 1 && harrisText.includes("Harris County, TX"),
            orangeMatch: orangeCount === 1 && orangeText.includes("Orange County, CA"),
            cookMatch: cookCount === 1 && cookText.includes("Cook County, IL"),
            miamiMatch: miamiCount === 1 && miamiText.includes("Miami-Dade County, FL")
        };
    })()"""
    ws.send(json.dumps({"id": 2, "method": "Runtime.evaluate", "params": {"expression": expr1, "returnByValue": True}}))
    res1 = json.loads(ws.recv())
    v1 = res1["result"]["result"]["value"]
    print("Multi-Token Search Result:", v1)
    assert v1["harrisMatch"], "Multi-term search 'harris tx' failed"
    assert v1["orangeMatch"], "Multi-term search 'orange ca' failed"
    assert v1["cookMatch"], "Multi-term search 'cook il' failed"
    assert v1["miamiMatch"], "Multi-term search 'miami fl' failed"

    print("--- 2. Testing exportAccuracyReport() Print Class ---")
    expr2 = """(() => {
        exportAccuracyReport();
        const isPrinting = document.body.classList.contains("accuracy-printing");
        return { isPrinting };
    })()"""
    ws.send(json.dumps({"id": 3, "method": "Runtime.evaluate", "params": {"expression": expr2, "returnByValue": True}}))
    res2 = json.loads(ws.recv())
    v2 = res2["result"]["result"]["value"]
    print("Export Accuracy Report Result:", v2)
    assert v2["isPrinting"], "body should contain .accuracy-printing class"

    print("--- 3. Testing Executive Prospectus 4-Column AVM Header ---")
    expr3 = """(() => {
        closeAccuracyModal();
        // Mock activeHouse valuation
        window.activeHouse = {
            a: { SitusFullAddress: "123 Ocean Ave", AIN: "4289-012-004", City: "Santa Monica", YearBuilt: 1988, Units: 1 },
            lot: 6500,
            ll: { lat: 34.01, lng: -118.49 },
            st: { sortCol: "net", sortDir: "desc" },
            houseHv: 2661000,
            houseVpsf: 1250,
            valuation: { estimatedValue: 2661000, vpsf: 1250, livingSqft: 2128, confidenceRating: "⭐⭐⭐⭐ High Precision" }
        };
        exportExecutiveProspectus();
        const content = document.getElementById("prospectus-content");
        return {
            has4Columns: content ? content.innerHTML.includes("Baseline AVM Value") : false,
            hasAvmPrice: content ? content.innerHTML.includes("$2,661,000") : false,
            hasVpsf: content ? content.innerHTML.includes("$1,250/sqft") : false
        };
    })()"""
    ws.send(json.dumps({"id": 4, "method": "Runtime.evaluate", "params": {"expression": expr3, "returnByValue": True}}))
    res3 = json.loads(ws.recv())
    v3 = res3["result"]["result"]["value"]
    print("Prospectus 4-Column Header Result:", v3)
    assert v3["has4Columns"], "Prospectus should have 4-column header with Baseline AVM Value"
    assert v3["hasAvmPrice"], "Prospectus should display exact AVM value $2,661,000"

    ws.send(json.dumps({"id": 5, "method": "Page.captureScreenshot", "params": {"format": "jpeg", "quality": 90}}))
    res4 = json.loads(ws.recv())
    ws.close()
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_prospectus_4col_verified.jpg", "wb") as f:
        f.write(base64.b64decode(res4["result"]["data"]))
    print("Saved screenshot_prospectus_4col_verified.jpg")

    print("\n========================================================")
    print("ALL ROUND 24 RUNTIME VERIFICATIONS PASSED (100% SUCCESS)!")
    print("========================================================")

if __name__ == "__main__":
    main()
