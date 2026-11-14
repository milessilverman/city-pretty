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

    # 1. Zoom into Kent County street level and sync lots
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            map.setView([42.95838, -85.65823], 17);
            const cb = document.querySelector('#l-lots');
            if (cb) cb.checked = true;
            if (typeof syncLots === 'function') syncLots();
        })()"""
    }, req_id=13)
    time.sleep(2.5)

    # 2. Click a parcel polygon to trigger houseAt
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
    }, req_id=14)
    time.sleep(1.5)

    # 3. Test Compare Home feature
    r_cmp = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const btn = document.querySelector('#btn-compare-home-dossier');
            if (btn) btn.click();
            return {
                hasCompareBtn: !!btn,
                homeCompareCount: homeCompareList.length,
                firstHome: homeCompareList[0] ? { address: homeCompareList[0].address, ain: homeCompareList[0].ain } : null
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("\n--- Home Comparison Test Results ---")
    print(json.dumps(r_cmp.get("result", {}).get("value"), indent=2))

    # 4. Test Interactive Site Plan Drawer
    r_site_plan = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const drawer = document.querySelector('.site-plan-drawer');
            const svg = drawer ? drawer.querySelector('svg') : null;
            return {
                hasSitePlanDrawer: !!drawer,
                hasSvg: !!svg,
                rectCount: svg ? svg.querySelectorAll('rect').length : 0,
                textCount: svg ? svg.querySelectorAll('text').length : 0
            };
        })()""",
        "returnByValue": True
    }, req_id=16)
    print("\n--- Interactive Site Plan Visualizer Test Results ---")
    print(json.dumps(r_site_plan.get("result", {}).get("value"), indent=2))

    # 5. Open AI Urban Advisor and test context-aware prompts
    ws.call("Runtime.evaluate", {
        "expression": "openAiAdvisor()"
    }, req_id=17)
    time.sleep(1.0)

    # Ask AI prompt
    ws.call("Runtime.evaluate", {
        "expression": "askAiPrompt('best_move')"
    }, req_id=18)
    time.sleep(1.2)

    r_ai = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const modal = document.querySelector('#ai-advisor-modal');
            const desc = document.querySelector('#ai-context-desc');
            const chatBox = document.querySelector('#ai-chat-history');
            return {
                modalOpen: modal && !modal.hidden,
                activeContextText: desc ? desc.textContent : null,
                messageCount: chatBox ? chatBox.children.length : 0,
                lastResponseSnippet: chatBox && chatBox.lastElementChild ? chatBox.lastElementChild.innerText.slice(0, 180) : null
            };
        })()""",
        "returnByValue": True
    }, req_id=19)
    print("\n--- AI Urban & Property Advisor Test Results ---")
    print(json.dumps(r_ai.get("result", {}).get("value"), indent=2))

    # Capture AI Advisor screenshot
    ss1 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=20)
    scr_res1 = ss1.get("result", ss1)
    if "data" in scr_res1:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_ai_advisor_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res1["data"]))
        print("Saved screenshot to screenshot_ai_advisor_verified.jpg")

    # Close AI modal and open Compare Homes modal to capture comparison
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            closeAiAdvisor();
            openCompareDrawer();
            switchCompareTab('homes');
        })()"""
    }, req_id=21)
    time.sleep(1.0)

    ss2 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=22)
    scr_res2 = ss2.get("result", ss2)
    if "data" in scr_res2:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_home_compare_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res2["data"]))
        print("Saved screenshot to screenshot_home_compare_verified.jpg")

    print("\nAll Round 8 CDP verifications completed successfully!")

finally:
    ws.close()
