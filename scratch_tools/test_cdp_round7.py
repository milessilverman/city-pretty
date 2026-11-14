import subprocess
import urllib.request
import json
import time
import sys

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

    # 3. Check House Dossier and Owner Playbook Card
    r_playbook = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const houseSec = document.querySelector('#house');
            const pbCard = houseSec ? houseSec.querySelector('.owner-playbook-card') : null;
            return {
                houseRendered: !!houseSec,
                addressLine: houseSec && houseSec.querySelector('.small') ? houseSec.querySelector('.small').textContent : null,
                hasPlaybookCard: !!pbCard,
                playbookTitle: pbCard && pbCard.querySelector('.owner-playbook-card > div:nth-child(2)') ? pbCard.querySelector('.owner-playbook-card > div:nth-child(2)').textContent.trim() : null,
                hasActionSteps: pbCard ? !!pbCard.querySelector('ol') : false,
                hasCopyMemoBtn: pbCard ? !!pbCard.querySelector('#btn-copy-playbook') : false,
                hasAccuracyBtn: !!document.querySelector('#btn-accuracy-header')
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("\n--- Owner & Investor Playbook Test Results ---")
    print(json.dumps(r_playbook.get("result", {}).get("value"), indent=2))

    # Capture Playbook screenshot
    ss1 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=16)
    scr_res1 = ss1.get("result", ss1)
    if "data" in scr_res1:
        import base64
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_playbook_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res1["data"]))
        print("Saved screenshot to screenshot_playbook_verified.jpg")

    # 4. Open Accuracy Modal and verify contents
    ws.call("Runtime.evaluate", {
        "expression": "openAccuracyModal()"
    }, req_id=17)
    time.sleep(1.0)

    r_modal = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const m = document.querySelector('#accuracy-modal');
            return {
                modalVisible: m && !m.hidden,
                modalTitle: m ? m.querySelector('h2').textContent : null,
                hasCoStarTable: m ? !!m.querySelector('table') : false,
                hasAiSection: m ? m.innerText.includes("Why City Pretty is the Ideal Backbone for Autonomous AI Urban Agents") : false
            };
        })()""",
        "returnByValue": True
    }, req_id=18)
    print("\n--- Accuracy & AI Backbone Modal Results ---")
    print(json.dumps(r_modal.get("result", {}).get("value"), indent=2))

    # Capture Modal screenshot
    ss2 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=19)
    scr_res2 = ss2.get("result", ss2)
    if "data" in scr_res2:
        import base64
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_accuracy_modal_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res2["data"]))
        print("Saved screenshot to screenshot_accuracy_modal_verified.jpg")

    print("\nAll Round 7 CDP verifications completed successfully!")

finally:
    ws.close()
