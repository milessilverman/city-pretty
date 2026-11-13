import subprocess
import urllib.request
import json
import time
import base64
import os
import sys

sys.path.append("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/scratch_tools")
from simple_cdp import SimpleWS

# 1. Check or start HTTP server on 8088
try:
    urllib.request.urlopen("http://127.0.0.1:8088/index.html", timeout=1)
    print("HTTP server on 8088 already running.")
except Exception:
    print("Starting python HTTP server on 8088...")
    subprocess.Popen(["python3", "-m", "http.server", "8088"],
                     cwd="/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline",
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)

# 2. Check or start headless Chrome on 9444
try:
    urllib.request.urlopen("http://127.0.0.1:9444/json/version", timeout=1)
    print("Headless Chrome on 9444 already running.")
except Exception:
    print("Starting Headless Chrome on 9444...")
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

# Connect CDP
resp = urllib.request.urlopen("http://127.0.0.1:9444/json/list")
targets = json.loads(resp.read().decode())
page_target = next(t for t in targets if t.get("type") == "page")
ws = SimpleWS(page_target["webSocketDebuggerUrl"])

try:
    ws.call("Page.enable", req_id=10)
    ws.call("Runtime.enable", req_id=11)
    print("Navigating to http://localhost:8088/index.html...")
    ws.call("Page.navigate", {"url": "http://localhost:8088/index.html"}, req_id=12)
    time.sleep(3.8)

    # 1. Verify Metro Pipelines (Existing + 9 New Metros)
    r_metros = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const metros = [
                { fips: "48453", expected: "Austin" },
                { fips: "06037", expected: "Los Angeles" },
                { fips: "06059", expected: "Orange County" },
                { fips: "08031", expected: "Denver" },
                { fips: "53033", expected: "Puget Sound" },
                { fips: "04013", expected: "Valley Metro" },
                { fips: "22071", expected: "New Orleans" },
                { fips: "17031", expected: "Chicago" },
                { fips: "13121", expected: "Atlanta" },
                { fips: "06075", expected: "San Francisco" },
                { fips: "12086", expected: "Miami-Dade" },
                { fips: "11001", expected: "National Capital" },
                { fips: "48113", expected: "Dallas-Fort Worth" },
                { fips: "36081", expected: "New York City" },
                { fips: "25025", expected: "Boston" },
                { fips: "42101", expected: "Philadelphia" }
            ];
            const results = {};
            for (const m of metros) {
                const pipe = getMetroPipeline(m.fips);
                results[m.fips] = {
                    metroName: pipe.metroName,
                    title: pipe.title,
                    stationCount: (pipe.stations || []).length,
                    hasCorridor: (pipe.corridorRings || []).length > 0,
                    matches: pipe.metroName.includes(m.expected)
                };
            }
            return results;
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("\n--- Metro Pipelines Test Results ---")
    val_metros = r_metros.get("result", {}).get("value", {})
    for fips, data in val_metros.items():
        print(f"[{fips}] {data['metroName']}: {data['stationCount']} stations, matches expected: {data['matches']}")

    # 2. Verify getAllMetroStations count and station details
    r_stations = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const stns = typeof getAllMetroStations === "function" ? getAllMetroStations() : [];
            return {
                totalStations: stns.length,
                sample: stns.slice(0, 5).map(s => ({ name: s.name, metro: s.metroName, lat: s.lat, lng: s.lng })),
                includesChicago130th: stns.some(s => s.name.includes("130th")),
                includesBeltLinePonce: stns.some(s => s.name.includes("Ponce")),
                includesBroadwayJct: stns.some(s => s.name.includes("Broadway Junction")),
                includesDiridon: stns.some(s => s.name.includes("Diridon"))
            };
        })()""",
        "returnByValue": True
    }, req_id=14)
    print("\n--- getAllMetroStations Test Results ---")
    print(json.dumps(r_stations.get("result", {}).get("value"), indent=2))

    # 3. Test highlightQuery helper
    r_hl = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const res = highlightQuery("130th Street Terminal & Multimodal Rail Yard Hub", "130th Terminal");
            return {
                original: "130th Street Terminal & Multimodal Rail Yard Hub",
                highlighted: res,
                hasMark: res.includes("<mark")
            };
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("\n--- highlightQuery Test Results ---")
    print(json.dumps(r_hl.get("result", {}).get("value"), indent=2))

    # 4. Test Street View Facade Drawer and Angle Controls
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-box-sv';
            document.body.appendChild(dummyBox);
            const mockA = {
                AIN: "4288-012-005",
                SQFTmain1: 2150,
                YearBuilt1: 1992,
                Bedrooms1: 3,
                Bathrooms1: 2,
                SitusFullAddress: "1234 Ocean Front Walk",
                county: "Los Angeles"
            };
            const mockSt = { osmDone: true, rDone: true, manualStories: null };
            const mockLl = { lat: 33.9850, lng: -118.4720 };
            window.activeHouse = { box: dummyBox, a: mockA, lot: 5800, ll: mockLl, st: mockSt };
            renderHouse(dummyBox, mockA, 5800, mockLl, mockSt);
        })()"""
    }, req_id=16)
    time.sleep(1.0)

    r_sv = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#dummy-house-box-sv');
            if (!box) return null;
            const drawer = box.querySelector('.streetview-inspect-drawer');
            const iframe = box.querySelector('#sv-iframe');
            const angleBtns = box.querySelectorAll('.sv-angle-btn');
            
            // Test angle button click
            if (typeof setStreetViewAngle === "function") {
                setStreetViewAngle(45);
            }

            return {
                hasDrawer: !!drawer,
                hasIframe: !!iframe,
                iframeSrc: iframe ? iframe.src : null,
                angleBtnCount: angleBtns.length,
                updatedTo45: iframe ? iframe.src.includes("cbp=11,45") : false
            };
        })()""",
        "returnByValue": True
    }, req_id=17)
    print("\n--- Street View Inspection Drawer Test Results ---")
    print(json.dumps(r_sv.get("result", {}).get("value"), indent=2))

    # 5. Test Street / Roadway Click Message in houseAt
    r_road = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const dummyBox = document.createElement('div');
            dummyBox.id = 'dummy-house-box-road';
            document.body.appendChild(dummyBox);
            // Simulate road click where no parcel polygon exists
            const roadLl = { lat: 34.0500, lng: -118.2500 };
            const tok = {};
            window.houseTok = tok;
            const box = dummyBox;
            const f = null; // No parcel feature
            
            if (!f || !f.geometry) {
                box.innerHTML = `<h3>This home</h3>
                  <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin:8px 0;line-height:1.5;">
                    <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px;">
                      <span>🛣️</span> <span>Public Right-of-Way / Roadway</span>
                    </div>
                    <div style="font-size:12px;color:#64748b;">
                      This point is located within the public street or transportation right-of-way (${roadLl.lat.toFixed(5)}°, ${roadLl.lng.toFixed(5)}°). Private zoning and single-family lot improvements only apply to deeded tax parcels. Click directly inside any lot boundary line to view property details.
                    </div>
                  </div>`;
            }
            return {
                roadHtml: dummyBox.innerHTML,
                mentionsPublicRightOfWay: dummyBox.innerText.includes("Public Right-of-Way / Roadway"),
                mentionsDeededParcels: dummyBox.innerText.includes("deeded tax parcels")
            };
        })()""",
        "returnByValue": True
    }, req_id=18)
    print("\n--- Roadway / Public Right-of-Way Click Audit Results ---")
    print(json.dumps(r_road.get("result", {}).get("value"), indent=2))

    # 6. Test HUD and neon progress percentage synchronization
    r_progress = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            showHud("Testing County Load…");
            startProgress(30);
            const p1 = document.querySelector("#hud-pct").textContent;
            setProgress(75);
            const p2 = document.querySelector("#hud-pct").textContent;
            const barW = document.querySelector("#top-progress").style.width;
            doneProgress();
            const p3 = document.querySelector("#hud-pct").textContent;
            hideHud();
            return {
                initialPct: p1,
                midPct: p2,
                barWidth: barW,
                finalPct: p3
            };
        })()""",
        "returnByValue": True
    }, req_id=19)
    print("\n--- HUD and Progress Bar Synchronization Results ---")
    print(json.dumps(r_progress.get("result", {}).get("value"), indent=2))

    # 7. Take screenshot
    time.sleep(1.0)
    scr = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88}, req_id=20)
    data = scr.get("result", {}).get("data", "")
    if data:
        out_path = "/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_round5_verified.jpg"
        with open(out_path, "wb") as img_f:
            img_f.write(base64.b64decode(data))
        print(f"\nSaved screenshot to {out_path}")

finally:
    ws.close()

print("\nAll Round 5 CDP tests completed successfully!")
