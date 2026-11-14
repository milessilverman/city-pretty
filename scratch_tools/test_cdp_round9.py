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

    # 1. Verify RESEARCH_CORPUS_500 in memory
    r_corpus = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const c = window.RESEARCH_CORPUS_500 || RESEARCH_CORPUS_500;
            if (!c) return null;
            const cats = {};
            c.forEach(s => { cats[s.category] = (cats[s.category] || 0) + 1; });
            return {
                totalStudies: c.length,
                categories: cats,
                sampleFirst: c[0],
                sampleHighLine: c.find(s => s.title.includes("High Line"))
            };
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("\n--- Research Corpus In-Memory Validation ---")
    print(json.dumps(r_corpus.get("result", {}).get("value"), indent=2))

    # 2. Open Research Modal and test category filters & search
    ws.call("Runtime.evaluate", {
        "expression": "openResearchModal()"
    }, req_id=14)
    time.sleep(1.0)

    # Search for "High Line"
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const inp = document.querySelector('#research-search-input');
            if (inp) {
                inp.value = "High Line";
                onResearchSearchChange("High Line");
            }
        })()"""
    }, req_id=15)
    time.sleep(0.8)

    r_search = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const list = document.querySelector('#research-list');
            const countLabel = document.querySelector('#research-count-label');
            return {
                modalVisible: !document.querySelector('#research-modal').hidden,
                countText: countLabel ? countLabel.innerText : null,
                renderedCount: list ? list.children.length : 0,
                firstResultSnippet: list && list.firstElementChild ? list.firstElementChild.innerText.slice(0, 160) : null
            };
        })()""",
        "returnByValue": True
    }, req_id=16)
    print("\n--- Research Modal Search Test ('High Line') ---")
    print(json.dumps(r_search.get("result", {}).get("value"), indent=2))

    # Capture Research Modal screenshot
    ss1 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=17)
    scr_res1 = ss1.get("result", ss1)
    if "data" in scr_res1:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_research_modal_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res1["data"]))
        print("Saved screenshot to screenshot_research_modal_verified.jpg")

    # 3. Test AI Advisor with Public Art & Satellite Tree Canopy Questions
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            closeResearchModal();
            openAiAdvisor();
        })()"""
    }, req_id=18)
    time.sleep(0.8)

    # Ask: "What value does adding in public art increase?"
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const input = document.querySelector('#ai-user-input');
            if (input) input.value = "What value does adding in public art increase?";
            handleAiSubmit(new Event('submit'));
        })()"""
    }, req_id=19)
    time.sleep(1.0)

    # Ask: "How do satellite images of tree canopies correlate to property values?"
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const input = document.querySelector('#ai-user-input');
            if (input) input.value = "How do satellite images of tree canopies correlate to property values?";
            handleAiSubmit(new Event('submit'));
        })()"""
    }, req_id=20)
    time.sleep(1.2)

    r_ai_answers = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#ai-chat-history');
            if (!box) return null;
            const messages = Array.from(box.children).map(c => c.innerText);
            return {
                totalMessages: messages.length,
                artAnswer: messages.find(m => m.includes("Public Art & Creative Placemaking")),
                treeAnswer: messages.find(m => m.includes("Satellite Tree Canopy"))
            };
        })()""",
        "returnByValue": True
    }, req_id=21)
    print("\n--- AI Advisor Empirical Research Responses ---")
    val_ai = r_ai_answers.get("result", {}).get("value") or {}
    print(f"Total AI Messages: {val_ai.get('totalMessages')}")
    print("\n[AI Public Art Answer Preview]:\n", (val_ai.get("artAnswer") or "")[:280], "...\n")
    print("[AI Satellite Tree Canopy Answer Preview]:\n", (val_ai.get("treeAnswer") or "")[:280], "...\n")

    # Capture AI Advisor screenshot with empirical research citations
    ss2 = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=22)
    scr_res2 = ss2.get("result", ss2)
    if "data" in scr_res2:
        with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_ai_research_verified.jpg", "wb") as f_img:
            f_img.write(base64.b64decode(scr_res2["data"]))
        print("Saved screenshot to screenshot_ai_research_verified.jpg")

    print("\nAll Round 9 CDP verifications completed successfully!")

finally:
    ws.close()
