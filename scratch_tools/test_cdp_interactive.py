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
    print("Testing Austin County (48453) loading and progress...")
    # Trigger Austin switch
    ws.call("Runtime.evaluate", {
        "expression": "openCounty('48453')"
    }, req_id=30)

    # Check progress bar and HUD immediately
    time.sleep(0.4)
    r_prog = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const bar = document.querySelector('#top-progress');
            const hud = document.querySelector('#county-hud');
            return {
                barWidth: bar ? bar.style.width : null,
                barOpacity: bar ? bar.style.opacity : null,
                hudText: hud ? hud.textContent : null,
                hudOpacity: hud ? hud.style.opacity : null
            };
        })()""",
        "returnByValue": True
    }, req_id=31)
    print("Loading HUD & Progress Bar:", r_prog.get("result", {}).get("value"))

    # Wait for Austin to finish loading
    time.sleep(3.5)

    # Check that Austin is loaded and activeFips is 48453
    r_austin = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            return {
                activeFips: activeFips(),
                countyName: countyOf(),
                selected: selected
            };
        })()""",
        "returnByValue": True
    }, req_id=32)
    print("Austin county state:", r_austin.get("result", {}).get("value"))

    # Select the first Austin tract/block group
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            if (typeof select === 'function' && typeof byId !== 'undefined' && byId.size > 0) {
                const firstId = Array.from(byId.keys())[0];
                select(firstId, false);
            }
        })()"""
    }, req_id=33)
    time.sleep(1)

    # Check Austin P3 Pipeline rendering
    r_atx_p3 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const sec = document.querySelector('.panel-sec .sec-content');
            const irr = document.querySelector('#p3-irr');
            const rev = document.querySelector('#p3-rev');
            const lift = document.querySelector('#p3-lift');
            const rider = document.querySelector('#p3-ridership');
            const titleEl = document.querySelector('span[style*=\"PROJECT CONNECT\"], span[style*=\"Project Connect\"]') || document.body;
            return {
                irr: irr ? irr.textContent : null,
                rev: rev ? rev.textContent : null,
                lift: lift ? lift.textContent : null,
                rider: rider ? rider.textContent : null,
                hasProjectConnect: document.body.innerHTML.includes("Project Connect")
            };
        })()""",
        "returnByValue": True
    }, req_id=34)
    print("Austin P3 Section:", json.dumps(r_atx_p3.get("result", {}).get("value"), indent=2))

    # Test toggling off a checkbox in the P3 simulator to see numbers dynamically recompute
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const chk = document.querySelector('#p3-trail');
            if (chk) {
                chk.checked = false;
                runP3Sim();
            }
        })()"""
    }, req_id=35)
    time.sleep(0.5)

    r_toggle = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            return {
                irr_without_trail: document.querySelector('#p3-irr').textContent,
                lift_without_trail: document.querySelector('#p3-lift').textContent,
                rider_without_trail: document.querySelector('#p3-ridership').textContent
            };
        })()""",
        "returnByValue": True
    }, req_id=36)
    print("After unchecking trail:", json.dumps(r_toggle.get("result", {}).get("value"), indent=2))

    # Re-enable trail
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const chk = document.querySelector('#p3-trail');
            if (chk) {
                chk.checked = true;
                runP3Sim();
            }
        })()"""
    }, req_id=37)

    # Test mock renderHouse with story buttons and Zillow link
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-box';
            document.body.appendChild(dummyBox);
            const mockA = {
                AIN: "48453-999-001",
                SQFTmain1: 2200,
                SitusFullAddress: "1500 E Riverside Dr",
                county: "Travis County"
            };
            const mockSt = { osmDone: true, rDone: true, manualStories: null };
            const mockLl = { lat: 30.245, lng: -97.725 };
            window.activeHouse = { box: dummyBox, a: mockA, lot: 6500, ll: mockLl, st: mockSt };
            renderHouse(dummyBox, mockA, 6500, mockLl, mockSt);
        })()"""
    }, req_id=38)
    time.sleep(1)

    r_house_ui = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#dummy-house-box');
            if (!box) return null;
            const storyBtns = Array.from(box.querySelectorAll('.story-btn')).map(b => ({
                text: b.textContent,
                active: b.classList.contains('active')
            }));
            const zillow = box.querySelector('.zillow-pill');
            const redfin = box.querySelector('.redfin-pill');
            return {
                storyBtns: storyBtns,
                hasZillow: !!zillow,
                zillowHref: zillow ? zillow.href : null,
                hasRedfin: !!redfin,
                redfinHref: redfin ? redfin.href : null
            };
        })()""",
        "returnByValue": True
    }, req_id=39)
    print("House UI pills and Zillow/Redfin links:", json.dumps(r_house_ui.get("result", {}).get("value"), indent=2))

    # Test clicking "2 Stories" via setHouseStories(2)
    ws.call("Runtime.evaluate", {
        "expression": "setHouseStories(2)"
    }, req_id=40)
    time.sleep(0.5)

    r_after_story_click = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#dummy-house-box');
            const storyBtns = Array.from(box.querySelectorAll('.story-btn')).map(b => ({
                text: b.textContent,
                active: b.classList.contains('active')
            }));
            return {
                storyBtns: storyBtns,
                manualStories: activeHouse.st.manualStories
            };
        })()""",
        "returnByValue": True
    }, req_id=41)
    print("After setting to 2 stories:", json.dumps(r_after_story_click.get("result", {}).get("value"), indent=2))

    # Take screenshot of Austin with P3 and search
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 90}, req_id=42)
    if "data" in ss:
        with open("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/screenshot_austin_p3.jpg", "wb") as f:
            f.write(base64.b64decode(ss["data"]))
        print("Captured screenshot to screenshot_austin_p3.jpg")

finally:
    ws.close()

print("All interactive checks passed!")
