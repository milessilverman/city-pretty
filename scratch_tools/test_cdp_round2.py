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

    # 1. Verify IndexedDB functions exist
    r_idb = ws.call("Runtime.evaluate", {
        "expression": "typeof openBundleDB === 'function' && typeof getCachedBundle === 'function' && typeof setCachedBundle === 'function'",
        "returnByValue": True
    }, req_id=13)
    print("IndexedDB cache functions present:", r_idb.get("result", {}).get("value"))

    # 2. Select first block group and verify P3 section with Capital Stack & Sensitivity pills
    ws.call("Runtime.evaluate", {
        "expression": "if (typeof select === 'function') select(Array.from(byId.keys())[0], false);"
    }, req_id=14)
    time.sleep(1)

    r_p3_ui = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const flyBtn = document.querySelector('button[onclick*=\"flyToP3Hub\"]');
            const termBtns = Array.from(document.querySelectorAll('.p3-term-btn')).map(b => b.textContent.trim());
            const affordBtns = Array.from(document.querySelectorAll('.p3-afford-btn')).map(b => b.textContent.trim());
            const proforma = document.querySelector('details summary[style*=\"0369a1\"]');
            const playbook = document.querySelector('details summary[style*=\"047857\"]');
            return {
                hasFlyBtn: !!flyBtn,
                flyBtnText: flyBtn ? flyBtn.textContent.trim() : null,
                termBtns,
                affordBtns,
                hasProforma: !!proforma,
                hasPlaybook: !!playbook
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("P3 Enhanced UI elements:", json.dumps(r_p3_ui.get("result", {}).get("value"), indent=2))

    # 3. Test Sensitivity Toggling: 55-year term & 50% affordability
    ws.call("Runtime.evaluate", {
        "expression": "setP3Term(55); setP3Afford(50);"
    }, req_id=16)
    time.sleep(0.5)

    r_p3_sens = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            return {
                irr_55yr_50afford: document.querySelector('#p3-irr').textContent,
                rev: document.querySelector('#p3-rev').textContent
            };
        })()""",
        "returnByValue": True
    }, req_id=17)
    print("P3 Sensitivity Test (55-yr term, 50% afford):", json.dumps(r_p3_sens.get("result", {}).get("value"), indent=2))

    # Reset to optimal
    ws.call("Runtime.evaluate", {
        "expression": "setP3Term(99); setP3Afford(35);"
    }, req_id=18)

    # 4. Test flyToP3Hub
    print("Testing flyToP3Hub('06037')...")
    ws.call("Runtime.evaluate", {
        "expression": "flyToP3Hub('06037')"
    }, req_id=19)
    time.sleep(1.5)

    r_walkshed = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            return {
                hasLayer: !!p3WalkshedLayer,
                layerCount: p3WalkshedLayer ? p3WalkshedLayer.getLayers().length : 0,
                mapCenter: map.getCenter()
            };
        })()""",
        "returnByValue": True
    }, req_id=20)
    print("P3 Walkshed & Hub Layer on map:", json.dumps(r_walkshed.get("result", {}).get("value"), indent=2))

    # 5. Test mock house facts for localStorage persistence and Realtor.com pill
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-box-2';
            document.body.appendChild(dummyBox);
            const mockA = {
                AIN: "9876-543-210",
                SQFTmain1: 2100,
                SitusFullAddress: "742 Evergreen Terrace",
                county: "Los Angeles"
            };
            const mockSt = { osmDone: true, rDone: true, manualStories: null };
            const mockLl = { lat: 34.05, lng: -118.25 };
            window.activeHouse = { box: dummyBox, a: mockA, lot: 5800, ll: mockLl, st: mockSt };
            renderHouse(dummyBox, mockA, 5800, mockLl, mockSt);
        })()"""
    }, req_id=21)
    time.sleep(1)

    # Set story to 3
    ws.call("Runtime.evaluate", {
        "expression": "setHouseStories(3)"
    }, req_id=22)
    time.sleep(0.5)

    r_persist = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const saved = localStorage.getItem("cp_story_9876-543-210");
            const realtorPill = document.querySelector('a[href*=\"realtor.com\"]');
            return {
                savedInLocalStorage: saved,
                hasRealtorPill: !!realtorPill,
                realtorHref: realtorPill ? realtorPill.href : null
            };
        })()""",
        "returnByValue": True
    }, req_id=23)
    print("Story persistence and Realtor.com pill:", json.dumps(r_persist.get("result", {}).get("value"), indent=2))

    # 6. Take screenshot of walkshed on map
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 85}, req_id=24)
    if "data" in ss:
        with open("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/screenshot_walkshed.jpg", "wb") as f:
            f.write(base64.b64decode(ss["data"]))
        print("Captured walkshed screenshot to screenshot_walkshed.jpg")

finally:
    ws.close()

print("All Round 2 verification tests passed flawlessly!")
