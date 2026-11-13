import subprocess
import urllib.request
import json
import time
import sys
import base64

# Start HTTP server if needed
try:
    urllib.request.urlopen("http://127.0.0.1:8088/index.html", timeout=1)
except Exception:
    subprocess.Popen(["python3", "-m", "http.server", "8088"],
                     cwd="/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline",
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)

# Start Chrome if needed
try:
    urllib.request.urlopen("http://127.0.0.1:9444/json/version", timeout=1)
except Exception:
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    subprocess.Popen([
        chrome_path,
        "--headless=new",
        "--remote-debugging-port=9444",
        "--disable-gpu",
        "--no-sandbox",
        "--window-size=1440,900"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

sys.path.append("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/scratch_tools")
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

    # 1. Test focusP3Walkshed function and walkshed circle
    r_walkshed = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            focusP3Walkshed(30.2435, -97.7170, "East Riverside & Pleasant Valley (Hub)", 805);
            const layer = window.p3WalkshedLayer || p3WalkshedLayer;
            let hasCircle = false, hasMarker = false;
            if (layer) {
                layer.eachLayer(l => {
                    if (l instanceof L.Circle) hasCircle = true;
                    if (l instanceof L.CircleMarker) hasMarker = true;
                });
            }
            return {
                layerExists: !!layer,
                hasCircle,
                hasMarker,
                circleRadius: hasCircle ? 805 : 0
            };
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("\n--- focusP3Walkshed Test Results ---")
    print(json.dumps(r_walkshed.get("result", {}).get("value"), indent=2))

    # 2. Test Transit Walkshed Infill Card & Solar Drawer in renderHouse
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-round6';
            document.body.appendChild(dummyBox);
            
            // House located right by Wilshire / La Brea station (34.0625, -118.3440)
            const mockA = {
                AIN: "5089-012-034",
                SQFTmain1: 2400,
                YearBuilt1: 1985,
                Bedrooms1: 3,
                Bathrooms1: 2,
                SitusFullAddress: "720 S La Brea Ave",
                county: "Los Angeles",
                STORIES: 2
            };
            const mockSt = { osmDone: true, rDone: true, manualStories: null };
            const mockLl = { lat: 34.0620, lng: -118.3435 }; // 0.04 mi from Wilshire/La Brea
            window.activeHouse = { box: dummyBox, a: mockA, lot: 6500, ll: mockLl, st: mockSt };
            renderHouse(dummyBox, mockA, 6500, mockLl, mockSt);
        })()"""
    }, req_id=14)
    time.sleep(1.0)

    r_house = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#dummy-house-round6');
            if (!box) return null;
            const transitCard = box.innerText.includes("Transit Walkshed: ~");
            const zeroParking = box.innerText.includes("Zero Parking Minimums");
            const solarDrawer = box.querySelector('.solar-potential-drawer');
            const solarSummary = solarDrawer ? solarDrawer.querySelector('summary').textContent : null;
            const fullText = box.innerText;
            return {
                hasTransitWalkshedCard: transitCard,
                mentionsZeroParking: zeroParking,
                hasSolarDrawer: !!solarDrawer,
                solarSummaryText: solarSummary,
                mentionsFederalITC: fullText.includes("30% Federal ITC"),
                mentionsCleanEnergyEquity: fullText.includes("Clean Energy Equity")
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("\n--- Transit Walkshed & Solar Potential Test Results ---")
    print(json.dumps(r_house.get("result", {}).get("value"), indent=2))

    # 3. Capture screenshot
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=16)
    scr_res = ss.get("result", ss)
    if "data" in scr_res:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_round6_verified.jpg", "wb") as f:
            f.write(base64.b64decode(scr_res["data"]))
        print("Saved screenshot to screenshot_round6_verified.jpg")

finally:
    ws.close()

print("\nRound 6 tests completed successfully!")
