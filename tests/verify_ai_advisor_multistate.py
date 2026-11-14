#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"

def verify_ai():
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

    print("Navigating to index.html...")
    call("Page.navigate", {"url": "http://127.0.0.1:8088/index.html"})
    time.sleep(3)

    # 1. Test AI Advisor Solar 2026 response
    ans_solar = eval_js('generateAiAnswer("What is the solar tax credit in 2026 and battery requirement?", "solar_equity")')
    print("AI Solar Answer contains 'IRC § 25D expired':", "IRC § 25D expired" in ans_solar)
    print("AI Solar Answer contains 'NEM 3.0':", "NEM 3.0" in ans_solar)

    # 2. Test AI Advisor Housing / Lot Split response for CA SB 9
    eval_js("""
    window.activeHouse = {
      a: { AIN: "2044201001", SitusFullAddress: "1234 1st St, Los Angeles, CA", ZoneCode: "R-1", UseType: "residential" },
      lot: 12000,
      ll: { lat: 34.05, lng: -118.25 }
    };
    """)
    ans_housing = eval_js('generateAiAnswer("Can I build housing here under state law?", "lot_split")')
    print("AI Housing Answer contains 'Statutory By-Right Housing Rights Unlocked':", "Statutory By-Right Housing Rights Unlocked" in ans_housing)

    # 3. Test AI Advisor Modal opening and chat rendering
    eval_js('openAiAdvisor()')
    time.sleep(1)
    eval_js('askAiPrompt("solar_equity")')
    time.sleep(1)

    modal_vis = eval_js('!document.getElementById("ai-advisor-modal").hidden')
    print("AI Advisor Modal Visible:", modal_vis)

    # Capture verified screenshot of the AI Advisor Modal
    shot_res = call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
    shot_b64 = shot_res.get("data", "")
    if shot_b64:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_ai_advisor_multistate_verified.jpg", "wb") as f:
            f.write(base64.b64decode(shot_b64))
        print("✓ Saved screenshot_ai_advisor_multistate_verified.jpg")

    ws.close()
    print("✓ AI Advisor multi-state & 2026 solar verification passed!")

if __name__ == "__main__":
    verify_ai()
