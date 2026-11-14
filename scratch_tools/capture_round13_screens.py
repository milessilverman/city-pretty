import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"
TARGET_URL = "http://localhost:8088/index.html"

def capture_detailed_screenshots():
    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    ws_url = tabs[0]["webSocketDebuggerUrl"]

    ws = websocket.create_connection(ws_url, timeout=30)
    msg_id = 0

    def call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        payload = {"id": msg_id, "method": method, "params": params or {}}
        ws.send(json.dumps(payload))
        while True:
            res = ws.recv()
            data = json.loads(res)
            if data.get("id") == msg_id:
                return data.get("result", {})

    call("Page.enable")
    call("Runtime.enable")
    call("Page.setDeviceMetricsOverride", {
        "width": 1400, "height": 900, "deviceScaleFactor": 1, "mobile": False
    })

    # Screenshot 1: Gentrification displacement banner on block group 060372044201
    call("Runtime.evaluate", {"expression": "select('060372044201', false)"})
    time.sleep(1)
    scr1 = call("Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_gentrification_verified.jpg", "wb") as f:
        f.write(base64.b64decode(scr1["data"]))
    print("Saved screenshot_gentrification_verified.jpg")

    # Screenshot 2: Accuracy modal with scientific econometric provenance
    call("Runtime.evaluate", {"expression": "openAccuracyModal()"})
    time.sleep(1)
    scr2 = call("Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_accuracy_modal_verified.jpg", "wb") as f:
        f.write(base64.b64decode(scr2["data"]))
    print("Saved screenshot_accuracy_modal_verified.jpg")
    call("Runtime.evaluate", {"expression": "closeAccuracyModal()"})

    # Screenshot 3: Methods modal with empirical confidence intervals and 2026 vintages
    call("Runtime.evaluate", {"expression": "openMethodsModal()"})
    time.sleep(1)
    scr3 = call("Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_methods_modal_verified.jpg", "wb") as f:
        f.write(base64.b64decode(scr3["data"]))
    print("Saved screenshot_methods_modal_verified.jpg")
    call("Runtime.evaluate", {"expression": "closeMethodsModal()"})

    ws.close()
    print("Captured all detailed screenshots!")

capture_detailed_screenshots()
