import subprocess
import urllib.request
import json
import time
import sys
import base64

# 1. Start HTTP server if needed
try:
    urllib.request.urlopen("http://127.0.0.1:8088/index.html", timeout=1)
except Exception:
    subprocess.Popen(["python3", "-m", "http.server", "8088"],
                     cwd="/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline",
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)

# 2. Start Chrome if needed
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
    
    # 1. Navigate to fresh page
    ws.call("Page.navigate", {"url": "http://localhost:8088/index.html"}, req_id=12)
    time.sleep(3.5)

    # 2. Type "pleasant valley" into #q and trigger addressSearch
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const q = document.querySelector('#q');
            q.focus();
            q.value = 'pleasant valley';
            if (typeof addressSearch === 'function') addressSearch('pleasant valley', false);
        })()"""
    }, req_id=13)
    time.sleep(1.2)

    r_search = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const results = document.querySelector('#addr-results');
            if (!results) return null;
            const stationHeader = Array.from(results.querySelectorAll('div')).find(d => d.textContent.includes('Planned P3 Rail & Transit Stations'));
            const stationButtons = Array.from(results.querySelectorAll('button[data-type="station"]'));
            return {
                hasStationHeader: !!stationHeader,
                stationBtnCount: stationButtons.length,
                firstStationText: stationButtons.length ? stationButtons[0].innerText : null
            };
        })()""",
        "returnByValue": True
    }, req_id=14)
    print("\n--- Interactive Station Search Test ---")
    print(json.dumps(r_search.get("result", {}).get("value"), indent=2))

    # 3. Test ArrowDown keyboard navigation
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const q = document.querySelector('#q');
            const downEvt = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            q.dispatchEvent(downEvt);
        })()"""
    }, req_id=15)
    time.sleep(0.3)

    r_arrow = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const results = document.querySelector('#addr-results');
            if (!results) return null;
            const activeItem = results.querySelector('.active-search-item');
            return {
                hasActiveItem: !!activeItem,
                activeBg: activeItem ? activeItem.style.background : null,
                activeText: activeItem ? activeItem.innerText : null
            };
        })()""",
        "returnByValue": True
    }, req_id=16)
    print("\n--- ArrowDown Keyboard Navigation Test ---")
    print(json.dumps(r_arrow.get("result", {}).get("value"), indent=2))

    # 4. Capture screenshot of search dropdown
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=17)
    scr_res = ss.get("result", ss)
    if "data" in scr_res:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_search_stations.jpg", "wb") as f:
            f.write(base64.b64decode(scr_res["data"]))
        print("Saved screenshot to screenshot_search_stations.jpg")

finally:
    ws.close()
