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
    
    print("Navigating to http://localhost:8088/index.html#bg=260810021001...")
    ws.call("Page.navigate", {"url": "http://localhost:8088/index.html#bg=260810021001"}, req_id=12)
    time.sleep(4.5)

    # 1. Check Kent County load status & parcel service resolution
    r_status = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const fips = activeFips();
            const svc = parcelSvc("26081");
            return {
                activeFips: fips,
                countyName: countyOf(),
                serviceFound: !!svc,
                serviceUrl: svc ? svc.url : null,
                serviceApn: svc ? svc.apn : null,
                serviceAddr: svc ? svc.addr : null
            };
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("\n--- Kent County Parcel Service Resolution ---")
    print(json.dumps(r_status.get("result", {}).get("value"), indent=2))

    # 2. Zoom in to street level (zoom 17 at Cherry St / Heritage Hill) and ensure property lines are checked
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            map.setView([42.95838, -85.65823], 17);
            const cb = document.querySelector('#l-lots');
            if (cb) cb.checked = true;
            if (typeof syncLots === 'function') syncLots();
        })()"""
    }, req_id=14)
    time.sleep(2.5)

    # 3. Check natLots polygons drawn
    r_lots = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const nl = window.natLots || natLots;
            let layerCount = 0;
            let firstProps = null;
            if (nl) {
                nl.eachLayer(l => {
                    layerCount++;
                    if (!firstProps && l._feat && l._feat.attributes) {
                        firstProps = l._feat.attributes;
                    }
                });
            }
            return {
                hasNatLots: !!nl,
                layerCount: layerCount,
                firstFeatureSample: firstProps
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("\n--- Property Lines (natLots) Drawn on Map ---")
    print(json.dumps(r_lots.get("result", {}).get("value"), indent=2))

    # 4. Simulate clicking on an actual lot polygon (e.g. 343 CHERRY ST SE)
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const nl = window.natLots || natLots;
            if (nl) {
                let targetLayer = null;
                nl.eachLayer(l => {
                    if (!targetLayer && l._feat) targetLayer = l;
                });
                if (targetLayer) {
                    const bounds = targetLayer.getBounds();
                    const center = bounds.getCenter();
                    houseAt(center, targetLayer._feat);
                }
            }
        })()"""
    }, req_id=16)
    time.sleep(1.0)

    # 5. Check House dossier rendering for Kent County parcel
    r_house = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const houseSec = document.querySelector('#house');
            if (!houseSec) return null;
            return {
                rendered: true,
                titleText: houseSec.querySelector('h3') ? houseSec.querySelector('h3').textContent : null,
                addressText: houseSec.querySelector('.small') ? houseSec.querySelector('.small').textContent : null,
                hasValuation: houseSec.innerText.includes("Estimated market value"),
                hasZillow: !!houseSec.querySelector('.zillow-pill'),
                hasStories: houseSec.innerText.includes("Stories"),
                hasSolar: !!houseSec.querySelector('.solar-potential-drawer')
            };
        })()""",
        "returnByValue": True
    }, req_id=17)
    print("\n--- House Dossier on Kent County Parcel ---")
    print(json.dumps(r_house.get("result", {}).get("value"), indent=2))

    # 6. Capture screenshot
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=18)
    scr_res = ss.get("result", ss)
    if "data" in scr_res:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_kent_parcels_verified.jpg", "wb") as f:
            f.write(base64.b64decode(scr_res["data"]))
        print("\nSaved screenshot to screenshot_kent_parcels_verified.jpg")

finally:
    ws.close()

print("\nKent County CDP verification completed successfully!")
