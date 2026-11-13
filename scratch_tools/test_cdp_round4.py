import urllib.request
import json
import time
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

    # 1. Verify #l-p3 checkbox and persistent corridor drawing
    r_lp3 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const cb = document.querySelector('#l-p3');
            return {
                exists: !!cb,
                checked: cb ? cb.checked : false,
                hasPersistentLayer: !!p3PersistentLayer,
                layerCount: p3PersistentLayer ? p3PersistentLayer.getLayers().length : 0
            };
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("P3 persistent layer checkbox & state:", json.dumps(r_lp3.get("result", {}).get("value"), indent=2))

    # 2. Verify HUD percentage element
    r_hud = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const hud = document.querySelector('#county-hud');
            const pct = document.querySelector('#hud-pct');
            return {
                hasHud: !!hud,
                hasPct: !!pct,
                pctText: pct ? pct.textContent : null
            };
        })()""",
        "returnByValue": True
    }, req_id=14)
    print("HUD Percentage Counter:", json.dumps(r_hud.get("result", {}).get("value"), indent=2))

    # 3. Test valuation comps drawer in mock renderHouse
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-box-comps';
            document.body.appendChild(dummyBox);
            const mockA = {
                AIN: "1111-222-333",
                SQFTmain1: 2350,
                YearBuilt1: 1988,
                Bedrooms1: 4,
                Bathrooms1: 3,
                SitusFullAddress: "450 Ocean Ave",
                county: "Los Angeles"
            };
            const mockSt = { osmDone: true, rDone: true, manualStories: null };
            const mockLl = { lat: 34.01, lng: -118.49 };
            window.activeHouse = { box: dummyBox, a: mockA, lot: 6200, ll: mockLl, st: mockSt };
            renderHouse(dummyBox, mockA, 6200, mockLl, mockSt);
        })()"""
    }, req_id=15)
    time.sleep(1.0)

    r_comps = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#dummy-house-box-comps');
            if (!box) return null;
            const details = box.querySelector('details summary[style*=\"0284c7\"]');
            const fullText = box.innerText;
            return {
                hasCompsDrawer: !!details,
                drawerTitle: details ? details.textContent.trim() : null,
                mentionsHedonic: fullText.includes("Hedonic Baseline Model"),
                mentionsGrossLivingArea: fullText.includes("Gross Living Area")
            };
        })()""",
        "returnByValue": True
    }, req_id=16)
    print("Valuation Comps Drawer:", json.dumps(r_comps.get("result", {}).get("value"), indent=2))

finally:
    ws.close()

print("Round 4 checks completed successfully!")
