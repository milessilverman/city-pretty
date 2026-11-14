#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import base64
import sys

CDP_HTTP = "http://127.0.0.1:9444"

def verify():
    print("Connecting to Chrome on port 9444...")
    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    ws_url = tabs[0]["webSocketDebuggerUrl"]

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
        r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in r:
            print("JS EXCEPTION:", r["exceptionDetails"])
            return None
        return r.get("result", {}).get("value")

    call("Page.enable")
    call("Runtime.enable")

    print("Navigating to http://127.0.0.1:8088/index.html...")
    call("Page.navigate", {"url": "http://127.0.0.1:8088/index.html"})
    time.sleep(3)

    # Check DOM readiness
    title = eval_js("document.title")
    print("Page Title:", title)

    eyebrow = eval_js('document.querySelector("[data-city-pretty-eyebrow]").textContent')
    print("Eyebrow text:", eyebrow)

    pill_text = eval_js('document.querySelector("#county-readiness-pill").textContent')
    print("Readiness Pill:", pill_text)

    pill_tier = eval_js('document.querySelector("#county-readiness-pill").getAttribute("data-tier")')
    print("Readiness Tier:", pill_tier)

    # Verify engines exist on window
    engines_ok = eval_js("""
    Boolean(
        window.calculateTaxIncrementCapacity &&
        window.evaluateByRightHousing &&
        window.computeSubAdditivePackage &&
        window.calculateSolarMicrogridRoi &&
        window.normalizeArcGisFeature &&
        window.syncHeaderDomToCounty
    )
    """)
    print("Engines available on window:", engines_ok)

    # Test syncHeaderDomToCounty for Harris County, TX (48201)
    eval_js('syncHeaderDomToCounty("48201")')
    tx_eyebrow = eval_js('document.querySelector("[data-city-pretty-eyebrow]").textContent')
    tx_pill = eval_js('document.querySelector("#county-readiness-pill").textContent')
    print("Harris County TX Eyebrow:", tx_eyebrow)
    print("Harris County TX Pill:", tx_pill)

    # Test syncHeaderDomToCounty for Kent County, MI (26081)
    eval_js('syncHeaderDomToCounty("26081")')
    mi_eyebrow = eval_js('document.querySelector("[data-city-pretty-eyebrow]").textContent')
    mi_pill = eval_js('document.querySelector("#county-readiness-pill").textContent')
    print("Kent County MI Eyebrow:", mi_eyebrow)
    print("Kent County MI Pill:", mi_pill)

    # Switch back to LA
    eval_js('syncHeaderDomToCounty("06037")')

    # Capture verified screenshot
    print("Capturing screenshot...")
    shot_res = call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
    shot_b64 = shot_res.get("data", "")
    if shot_b64:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_nationwide_header_verified.jpg", "wb") as f:
            f.write(base64.b64decode(shot_b64))
        print("✓ Saved screenshot_nationwide_header_verified.jpg")

    ws.close()
    print("✓ Verification completed successfully!")

if __name__ == "__main__":
    verify()
