#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"

def test_kent():
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

    # Navigate to Kent County block group as shown in user's image
    print("Navigating to Kent County Heritage Hill #bg=260810021001...")
    call("Page.navigate", {"url": "http://127.0.0.1:8088/index.html#bg=260810021001"})
    time.sleep(4)

    # Check active county
    fips = eval_js("activeFips()")
    print("Active FIPS:", fips)

    pill = eval_js('document.querySelector("#county-readiness-pill").textContent')
    print("Readiness Pill:", pill)

    eyebrow = eval_js('document.querySelector("[data-city-pretty-eyebrow]").textContent')
    print("Eyebrow:", eyebrow)

    # Zoom in to zoom 17 at Grand Rapids Heritage Hill
    eval_js('map.setView([42.95838, -85.65823], 17)')
    time.sleep(2)
    eval_js('if (typeof scheduleNatLots === "function") scheduleNatLots(0)')
    time.sleep(3)

    lot_count = eval_js('natLots ? natLots._count : 0')
    print("Rendered Nationwide Lot Count:", lot_count)

    shot_res = call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
    shot_b64 = shot_res.get("data", "")
    if shot_b64:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_kent_lots_expanded.jpg", "wb") as f:
            f.write(base64.b64decode(shot_b64))
        print("✓ Saved screenshot_kent_lots_expanded.jpg")

    ws.close()
    print("✓ Done testing Kent County lots!")

if __name__ == "__main__":
    test_kent()
