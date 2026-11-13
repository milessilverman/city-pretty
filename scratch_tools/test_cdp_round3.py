import urllib.request
import json
import time
import base64
from simple_cdp import SimpleWS

resp = urllib.request.urlopen("http://127.0.0.1:9444/json/list")
targets = json.loads(resp.read().decode())
page_target = next(t for t in targets if t.get("type") == "page")
ws = SimpleWS(page_target["webSocketDebuggerUrl"])

try:
    ws.call("Page.enable", req_id=10)
    ws.call("Runtime.enable", req_id=11)
    print("Navigating to http://localhost:8088/index.html...")
    ws.call("Page.navigate", {"url": "http://localhost:8088/index.html"}, req_id=12)
    time.sleep(3.5)

    # 1. Switch to Austin
    print("Opening Austin (48453)...")
    ws.call("Runtime.evaluate", { "expression": "openCounty('48453')" }, req_id=13)
    time.sleep(3.0)

    # 2. Select Austin block group and verify station network buttons
    ws.call("Runtime.evaluate", {
        "expression": "if (typeof select === 'function') select(Array.from(byId.keys())[0], false);"
    }, req_id=14)
    time.sleep(1.0)

    r_stns_ui = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const pipe = getMetroPipeline('48453');
            const stnBtns = Array.from(document.querySelectorAll('button[onclick*=\"flyToP3Hub(\\'48453\\'\"]')).map(b => b.textContent.trim());
            return {
                title: pipe.title,
                stationCount: pipe.stations ? pipe.stations.length : 0,
                stations: pipe.stations ? pipe.stations.map(s => s.name) : [],
                stnButtonsInUI: stnBtns
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("Austin Station Network in UI:", json.dumps(r_stns_ui.get("result", {}).get("value"), indent=2))

    # 3. Test flyToP3Hub with all stations
    print("Testing flyToP3Hub('48453')...")
    ws.call("Runtime.evaluate", { "expression": "flyToP3Hub('48453')" }, req_id=16)
    time.sleep(1.5)

    r_map_stns = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            return {
                hasWalkshedLayer: !!p3WalkshedLayer,
                layerCount: p3WalkshedLayer ? p3WalkshedLayer.getLayers().length : 0,
                center: map.getCenter()
            };
        })()""",
        "returnByValue": True
    }, req_id=17)
    print("Austin Map layers with stations:", json.dumps(r_map_stns.get("result", {}).get("value"), indent=2))

    # 4. Test clicking station 2 (South Congress)
    ws.call("Runtime.evaluate", { "expression": "flyToP3Hub('48453', 2)" }, req_id=18)
    time.sleep(1.2)
    r_stn2 = ws.call("Runtime.evaluate", {
        "expression": "map.getCenter()",
        "returnByValue": True
    }, req_id=19)
    print("Center after focusing South Congress station:", r_stn2.get("result", {}).get("value"))

    # 5. Capture screenshot of Austin Station Network on Map
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 90}, req_id=20)
    if "data" in ss:
        with open("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/screenshot_austin_stations.jpg", "wb") as f:
            f.write(base64.b64decode(ss["data"]))
        print("Captured screenshot to screenshot_austin_stations.jpg")

finally:
    ws.close()

print("Round 3 verification completed successfully!")
