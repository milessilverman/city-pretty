#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"

def capture():
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

    # Select an LA block group to check the sub-additive package rendering
    eval_js('select("060372044201", false)')
    time.sleep(1)

    # Check that sub-additive package rendered
    pkg_text = eval_js('document.querySelector(".pkg") ? document.querySelector(".pkg").textContent : "no-pkg"')
    print("Package Strip Text:", pkg_text)

    # Capture screenshot of side panel
    shot_res = call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
    shot_b64 = shot_res.get("data", "")
    if shot_b64:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_subadditive_verified.jpg", "wb") as f:
            f.write(base64.b64decode(shot_b64))
        print("✓ Saved screenshot_subadditive_verified.jpg")

    ws.close()
    print("✓ Done!")

if __name__ == "__main__":
    capture()
