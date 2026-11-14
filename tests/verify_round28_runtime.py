#!/usr/bin/env python3
"""
verify_round28_runtime.py
Verifies in Headless Chrome:
1. Global Escape key dismisses open modals.
2. Backdrop click dismisses open modals.
3. Multi-state statutory assessor calibration in browser context.
"""

import json
import urllib.request
import time
import websocket

def run_tests():
    print("Checking Chrome debug endpoints on port 9444...")
    req = urllib.request.urlopen("http://127.0.0.1:9444/json")
    tabs = json.loads(req.read().decode())
    target = None
    for tab in tabs:
        if "8088" in tab.get("url", ""):
            target = tab
            break
    if not target:
        target = tabs[0]
    
    ws_url = target["webSocketDebuggerUrl"]
    ws = websocket.create_connection(ws_url, timeout=10)
    
    msg_id = 1
    def send_cmd(method, params=None):
        nonlocal msg_id
        cmd = {"id": msg_id, "method": method, "params": params or {}}
        msg_id += 1
        ws.send(json.dumps(cmd))
        while True:
            res = json.loads(ws.recv())
            if res.get("id") == cmd["id"]:
                return res

    def eval_js(expr):
        res = send_cmd("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        })
        if "result" in res and "result" in res["result"]:
            val = res["result"]["result"].get("value")
            return val
        print("Runtime eval error:", res)
        return None

    # Reload page to ensure latest code is running
    eval_js("window.location.reload()")
    time.sleep(2.5)

    # 1. Test Escape key modal dismiss
    print("--- 1. Testing Escape Key Modal Dismiss ---")
    t1 = eval_js("""
    (() => {
        openAiAdvisor();
        const m1 = document.getElementById("ai-advisor-modal");
        const wasOpen = !m1.hidden;
        
        // Dispatch Escape keydown
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
        const isClosedNow = m1.hidden;
        return { wasOpen, isClosedNow };
    })()
    """)
    print("Escape Modal Result:", json.dumps(t1, indent=2))
    assert t1["wasOpen"] is True
    assert t1["isClosedNow"] is True
    print("✓ Escape key dismiss verified.")

    # 2. Test Backdrop click dismiss
    print("--- 2. Testing Backdrop Click Modal Dismiss ---")
    t2 = eval_js("""
    (() => {
        openAccuracyModal();
        const m2 = document.getElementById("accuracy-modal");
        const wasOpen = !m2.hidden;

        // Click on the backdrop (the overlay-modal element itself)
        m2.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        const isClosedNow = m2.hidden;
        return { wasOpen, isClosedNow };
    })()
    """)
    print("Backdrop Click Result:", json.dumps(t2, indent=2))
    assert t2["wasOpen"] is True
    assert t2["isClosedNow"] is True
    print("✓ Backdrop click dismiss verified.")

    # 3. Test Multi-State Statutory Calibrations (AZ & WA) in Browser
    print("--- 3. Testing Arizona & Washington AVM in Browser ---")
    t3 = eval_js("""
    (() => {
        const az = estimatePropertyMarketValue({
            attributes: { FCV: 480000 }, lotSqft: 6800, stateCode: "AZ",
            neighborhood: { hv: 450000, c: "Phoenix" },
            facts: { bldg: 1850, beds: 3, baths: 2, yb: 1995 }
        });
        const wa = estimatePropertyMarketValue({
            attributes: { AppraisedValue: 720000 }, lotSqft: 7000, stateCode: "WA",
            neighborhood: { hv: 700000, c: "Seattle" },
            facts: { bldg: 1900, beds: 3, baths: 2, yb: 1980 }
        });
        return {
            azVal: az.estimatedValue,
            azMethod: az.valuationMethod,
            waVal: wa.estimatedValue,
            waMethod: wa.valuationMethod
        };
    })()
    """)
    print("Multi-State Valuation Result:", json.dumps(t3, indent=2))
    assert 470000 <= t3["azVal"] <= 530000
    assert "Arizona Statutory Full Cash Value" in t3["azMethod"]
    assert 710000 <= t3["waVal"] <= 770000
    assert "Washington King/WA" in t3["waMethod"]
    print("✓ Multi-state statutory calibrations verified in browser.")

    ws.close()
    print("\n========================================================")
    print("ALL ROUND 28 RUNTIME VERIFICATIONS PASSED (100% SUCCESS)!")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
