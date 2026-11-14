import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://localhost:9444"
TARGET_URL = "http://localhost:8088/index.html#bg=260810021001"

def get_ws_url():
    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    for t in tabs:
        if t.get("type") == "page":
            return t.get("webSocketDebuggerUrl")
    raise RuntimeError("No page target found")

def send_cmd(ws, method, params=None, msg_id=1):
    msg = {"id": msg_id, "method": method, "params": params or {}}
    ws.send(json.dumps(msg))
    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == msg_id:
            return resp

def evaluate_js(ws, expr, msg_id=100):
    res = send_cmd(ws, "Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True
    }, msg_id)
    if "result" in res and "result" in res["result"]:
        return res["result"]["result"].get("value")
    return res

def take_screenshot(ws, filename, msg_id=200):
    res = send_cmd(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 90}, msg_id)
    img_data = res["result"]["data"]
    with open(filename, "wb") as f:
        f.write(base64.b64decode(img_data))
    print(f"Saved screenshot to {filename}")

def run_tests():
    ws_url = get_ws_url()
    ws = websocket.create_connection(ws_url, timeout=15)
    print("Connected to CDP")

    # Reload with cache bypass
    print("Reloading page with ignoreCache=True...")
    send_cmd(ws, "Page.reload", {"ignoreCache": True}, 1)
    time.sleep(3.5)

    # 1. Test Historical Trends Corridor on Map
    print("\n--- 1. Historical Trends Corridor on Map Test ---")
    trend_res = evaluate_js(ws, """
    (function() {
      // Focus on High Line NYC
      focusHistoricalProject('highline_nyc', 40.7480, -74.0048, '36061');
      const hasLayer = !!(trendCorridorLayer && map.hasLayer(trendCorridorLayer));
      const layerCount = trendCorridorLayer ? trendCorridorLayer.getLayers().length : 0;
      const center = map.getCenter();
      return {
        hasLayer: hasLayer,
        layerCount: layerCount,
        centerLat: center.lat.toFixed(4),
        centerLng: center.lng.toFixed(4)
      };
    })()
    """, 101)
    print("Trend corridor on map result:", json.dumps(trend_res, indent=2))
    assert trend_res["hasLayer"] == True, "trendCorridorLayer should be on map"
    assert trend_res["layerCount"] >= 2, "Should have polyline and station markers"
    time.sleep(1.0)
    take_screenshot(ws, "/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_trends_corridor_verified.jpg", 102)

    # 2. Test 1-Click Executive Prospectus Modal
    print("\n--- 2. Executive Prospectus Modal Test ---")
    prospectus_res = evaluate_js(ws, """
    (function() {
      exportExecutiveProspectus();
      const m = document.getElementById("prospectus-modal");
      const content = document.getElementById("prospectus-content");
      return {
        modalVisible: m && !m.hidden,
        hasTitle: content && content.innerText.includes("EXECUTIVE PROPERTY"),
        hasTernerCenter: content && content.innerText.includes("Terner Center"),
        hasZeroParking: content && content.innerText.includes("Zero-Parking Exemption")
      };
    })()
    """, 103)
    print("Prospectus modal result:", json.dumps(prospectus_res, indent=2))
    assert prospectus_res["modalVisible"] == True, "Prospectus modal should be visible"
    assert prospectus_res["hasTitle"] == True, "Prospectus modal should have executive title"
    time.sleep(0.8)
    take_screenshot(ws, "/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_prospectus_verified.jpg", 104)

    # Close prospectus
    evaluate_js(ws, "closeProspectusModal()", 105)

    # 3. Test Satellite Canopy & Heat Island HUD
    print("\n--- 3. Satellite Canopy & Heat Island HUD Test ---")
    canopy_res = evaluate_js(ws, """
    (function() {
      applyPreset("green");
      const hud = document.getElementById("canopy-heat-hud");
      const isVisible = hud && hud.style.display !== "none";
      const hoodText = document.getElementById("canopy-hud-hood").textContent;
      const heatText = document.getElementById("canopy-hud-heat").textContent;
      const gapText = document.getElementById("canopy-hud-gap").textContent;
      return {
        hudVisible: isVisible,
        hood: hoodText,
        heat: heatText,
        gap: gapText
      };
    })()
    """, 106)
    print("Canopy & Heat Island HUD result:", json.dumps(canopy_res, indent=2))
    assert canopy_res["hudVisible"] == True, "Canopy HUD should be visible"
    time.sleep(0.8)
    take_screenshot(ws, "/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_canopy_hud_verified.jpg", 107)

    # 4. Test High-Tech HUD & Progress Bar
    print("\n--- 4. High-Tech HUD & Progress Bar Test ---")
    hud_test_res = evaluate_js(ws, """
    (function() {
      showHud("Testing 123 Municipal Cadastre Endpoints...", 65);
      const hud = document.getElementById("county-hud");
      const bar = document.getElementById("top-progress");
      const dot = hud ? hud.querySelector(".hud-pulse-dot") : null;
      const res = {
        hudDisplay: hud ? hud.style.display : null,
        barWidth: bar ? bar.style.width : null,
        hasPulseDot: !!dot
      };
      doneProgress();
      hideHud();
      return res;
    })()
    """, 108)
    print("HUD & Progress test result:", json.dumps(hud_test_res, indent=2))
    assert hud_test_res["hasPulseDot"] == True, "HUD should have cyberpunk radar pulse dot"

    print("\nAll Round 11 CDP verifications completed successfully!")
    ws.close()

if __name__ == "__main__":
    run_tests()
