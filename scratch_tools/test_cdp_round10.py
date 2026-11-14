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

    # 1. Open Historical Trends Modal and inspect case studies
    ws.call("Runtime.evaluate", {
        "expression": "openHistoricalTrendsModal()"
    }, req_id=13)
    time.sleep(1.0)

    r_trends = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const m = document.querySelector('#trends-modal');
            const cards = document.querySelectorAll('#trends-cards-container > div');
            return {
                modalOpen: m && !m.hidden,
                renderedCount: cards.length,
                firstCardText: cards[0] ? cards[0].innerText.slice(0, 220) : null,
                caseStudyIds: HISTORICAL_TRENDS_DATA.map(t => t.id)
            };
        })()""",
        "returnByValue": True
    }, req_id=14)
    print("\n--- Historical Trends Modal Results ---")
    print(json.dumps(r_trends.get("result", {}).get("value"), indent=2))

    # Capture Trends Modal screenshot
    ss1 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=15)
    scr_res1 = ss1.get("result", ss1)
    if "data" in scr_res1:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_trends_modal_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res1["data"]))
        print("Saved screenshot to screenshot_trends_modal_verified.jpg")

    # 2. Test filter tab in trends modal (e.g. trails)
    ws.call("Runtime.evaluate", {
        "expression": "filterTrends('trails')"
    }, req_id=16)
    time.sleep(0.5)

    r_filter = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const cards = document.querySelectorAll('#trends-cards-container > div');
            return {
                filteredCount: cards.length,
                trailNames: Array.from(cards).map(c => c.querySelector('div:nth-child(2)').innerText)
            };
        })()""",
        "returnByValue": True
    }, req_id=17)
    print("\n--- Filtered Trends Test (Trails) ---")
    print(json.dumps(r_filter.get("result", {}).get("value"), indent=2))

    # 3. Test clicking from recommendation card directly to Research Library
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            closeHistoricalTrendsModal();
            // Trigger openResearchModal with 'Parks, Trails & Green Infrastructure'
            openResearchModal('Parks, Trails & Green Infrastructure');
        })()"""
    }, req_id=18)
    time.sleep(1.0)

    r_rec_link = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const m = document.querySelector('#research-modal');
            const countLabel = document.querySelector('#research-count-label');
            const list = document.querySelector('#research-list');
            return {
                researchModalOpen: m && !m.hidden,
                countText: countLabel ? countLabel.innerText : null,
                renderedCount: list ? list.children.length : 0,
                firstItemTitle: list && list.firstElementChild ? list.firstElementChild.querySelector('div:nth-child(2)').innerText : null
            };
        })()""",
        "returnByValue": True
    }, req_id=19)
    print("\n--- Recommendation to Research Link Test ---")
    print(json.dumps(r_rec_link.get("result", {}).get("value"), indent=2))

    # Capture Linked Research Screenshot
    ss2 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=20)
    scr_res2 = ss2.get("result", ss2)
    if "data" in scr_res2:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_linked_research_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res2["data"]))
        print("Saved screenshot to screenshot_linked_research_verified.jpg")

    print("\nAll Round 10 CDP verifications completed successfully!")

finally:
    ws.close()
