import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"
TARGET_URL = "http://localhost:8088/index.html"

def test_round13():
    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    ws_url = None
    target_id = None
    for t in tabs:
        if t.get("type") == "page":
            ws_url = t.get("webSocketDebuggerUrl")
            target_id = t.get("id")
            break
    if not ws_url:
        raise RuntimeError("No active CDP page target found")
    print(f"Connecting to page target: {target_id}")

    ws = websocket.create_connection(ws_url, timeout=30)
    msg_id = 0

    def call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        ws.send(json.dumps(payload))
        while True:
            res = ws.recv()
            data = json.loads(res)
            if data.get("id") == msg_id:
                return data.get("result", {})

    def eval_js(expr):
        r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in r:
            print("JS EXCEPTION:", r["exceptionDetails"])
        return r.get("result", {}).get("value")

    call("Page.enable")
    call("Runtime.enable")
    call("Page.setDeviceMetricsOverride", {
        "width": 1400, "height": 900, "deviceScaleFactor": 1, "mobile": False
    })

    print(f"Navigating to {TARGET_URL}...")
    call("Page.navigate", {"url": TARGET_URL})

    print("Waiting 6s for page and map hydration...")
    time.sleep(6)

    # Test 1: Check ROI Mode toggle & function
    val_roi = eval_js("""
        (() => {
            const sel = document.getElementById("roi-mode");
            const initialMode = typeof roiMode !== "undefined" ? roiMode : null;
            setRoiMode("adj");
            const modeAfterAdj = roiMode;
            const selValAfterAdj = sel ? sel.value : null;
            setRoiMode("base");
            const modeAfterBase = roiMode;
            return {
                hasSelector: !!sel,
                initialMode,
                modeAfterAdj,
                selValAfterAdj,
                modeAfterBase
            };
        })()
    """)
    print("Test 1 (ROI Mode):", json.dumps(val_roi, indent=2))

    # Test 2: Select block group in Beverly Hills and test Crime Reporting Gap disclaimer
    val_bh = eval_js("""
        (() => {
            let bhId = null;
            for (const [id, feat] of byId.entries()) {
                if (feat.properties && feat.properties.c === "Beverly Hills") {
                    bhId = id;
                    break;
                }
            }
            if (bhId) {
                select(bhId, false);
                const panelText = document.getElementById("panel").innerHTML;
                const hasCrimeGapWarning = panelText.includes("Municipal Crime Reporting Gap") && panelText.includes("Beverly Hills");
                return { foundBh: true, bhId, hasCrimeGapWarning };
            }
            return { foundBh: false };
        })()
    """)
    print("Test 2 (Crime Reporting Gap):", json.dumps(val_bh, indent=2))

    # Test 3: Select a high-renter block group and test Gentrification Risk alert
    val_gent = eval_js("""
        (() => {
            let foundBg = null;
            for (const [id, feat] of byId.entries()) {
                const d = D.details[id] || {};
                const m = d.m || {};
                const renterShare = Math.max(0, 100 - (m.sf != null ? +m.sf : 50));
                const lowInc = (m.inc != null && m.inc < 58000);
                const rentBurdened = (m.rent != null && m.inc != null && (m.rent * 12 / m.inc) > 0.32);
                const top = feat.properties;
                const highLift = (top && top.v >= 2.0);
                if (renterShare >= 55 && (lowInc || rentBurdened) && highLift) {
                    foundBg = id;
                    break;
                }
            }
            if (foundBg) {
                select(foundBg, false);
                const panelText = document.getElementById("panel").innerHTML;
                const hasGentAlert = panelText.includes("Tenant Displacement") && panelText.includes("Gentrification Risk Indicator");
                const hasMitigations = panelText.includes("Community Land Trusts (CLT)");
                return { foundBg, hasGentAlert, hasMitigations };
            }
            return { foundBg: null };
        })()
    """)
    print("Test 3 (Gentrification Displacement Indicator):", json.dumps(val_gent, indent=2))

    # Test 4: EIFD Turnover & Bond Yield interactive buttons
    val_eifd = eval_js("""
        (() => {
            const turnoverBtn = document.querySelector(".eifd-turnover-btn[data-rate='2.0']");
            const rateBtn = document.querySelector(".eifd-rate-btn[data-rate='4.25']");
            if (turnoverBtn) turnoverBtn.click();
            const egVal = document.getElementById("e-g") ? document.getElementById("e-g").value : null;
            if (rateBtn) rateBtn.click();
            const erateVal = document.getElementById("e-rate") ? document.getElementById("e-rate").value : null;
            return {
                hasTurnoverButtons: !!turnoverBtn,
                egValAfterClick: egVal,
                hasRateButtons: !!rateBtn,
                erateValAfterClick: erateVal
            };
        })()
    """)
    print("Test 4 (EIFD Interactive Toggles):", json.dumps(val_eifd, indent=2))

    # Test 5: Verify Accuracy Modal scientific text
    val_acc = eval_js("""
        (() => {
            const modal = document.getElementById("accuracy-modal");
            if (!modal) return { exists: false };
            const text = modal.innerText;
            const hasEconometricHeading = text.includes("Econometric Hedonic Model Provenance");
            const hasMethodologicalComp = text.includes("Methodological Comparison: Civic Open Data");
            return {
                exists: true,
                hasEconometricHeading,
                hasMethodologicalComp
            };
        })()
    """)
    print("Test 5 (Scientific Accuracy Modal):", json.dumps(val_acc, indent=2))

    # Test 6: Verify Orange County Dashed Distinction
    val_oc_style = eval_js("""
        (() => {
            const dummyOcFeature = { properties: { oc: true }, id: "06059010001" };
            const styleObj = styleBg(dummyOcFeature);
            return {
                dashArray: styleObj.dashArray,
                color: styleObj.color,
                isAmber: styleObj.color === "#f59e0b",
                hasDash: styleObj.dashArray === "3, 3"
            };
        })()
    """)
    print("Test 6 (Orange County Visual Distinction):", json.dumps(val_oc_style, indent=2))

    # Test 7: Verify exportNeighborhoodBrief
    val_brief = eval_js("""
        (() => {
            return {
                hasBriefFn: typeof exportNeighborhoodBrief === "function",
                hasSyncHash: typeof syncHash === "function"
            };
        })()
    """)
    print("Test 7 (Neighborhood Brief & Hash):", json.dumps(val_brief, indent=2))

    # Test 8: Verify Methods Modal text updates
    val_methods = eval_js("""
        (() => {
            const mm = document.getElementById("methods-modal");
            if (!mm) return { exists: false };
            const text = mm.innerText;
            const hasConfidenceInterval = text.includes("Econometric Confidence Intervals");
            const hasDynamicRoi = text.includes("Dynamic ROI Mode");
            const has2026Sales = text.includes("2022–2026 Secured Roll sales window");
            const has6thCycle = text.includes("6th Cycle Housing Element");
            return {
                hasConfidenceInterval,
                hasDynamicRoi,
                has2026Sales,
                has6thCycle
            };
        })()
    """)
    print("Test 8 (Methods Modal Provenance):", json.dumps(val_methods, indent=2))

    # Test 9: Verify dynamic getActiveCountyName()
    val_county_name = eval_js("""
        (() => {
            const currentCountyName = typeof getActiveCountyName === "function" ? getActiveCountyName() : null;
            return { currentCountyName };
        })()
    """)
    print("Test 9 (Active County Name):", json.dumps(val_county_name, indent=2))

    # Capture verified screenshot of the active UI
    scr = call("Page.captureScreenshot", {"format": "jpeg", "quality": 85})
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_round13_verified.jpg", "wb") as f:
        f.write(base64.b64decode(scr["data"]))
    print("Screenshot successfully written to screenshot_round13_verified.jpg")

    ws.close()
    print("CDP session completed cleanly.")

test_round13()
