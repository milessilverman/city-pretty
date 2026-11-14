#!/usr/bin/env python3
import json
import urllib.request
import websocket
import time
import base64

CDP_HTTP = "http://127.0.0.1:9444"

def verify_avm():
    print("Connecting to Chrome on port 9444...")
    req = urllib.request.urlopen(f"{CDP_HTTP}/json")
    tabs = json.loads(req.read().decode())
    ws_url = tabs[0]["webSocketDebuggerUrl"]

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
            return None
        return r.get("result", {}).get("value")

    call("Page.enable")
    call("Runtime.enable")

    # Navigate to Kent County Heritage Hill
    print("Navigating to Kent County #bg=260810021001...")
    call("Page.navigate", {"url": "http://127.0.0.1:8088/index.html#bg=260810021001"})
    call("Page.reload", {"ignoreCache": True})
    time.sleep(4)

    # Test parcel normalization and AVM estimation
    test_result = eval_js("""
    (() => {
        // Mock a real Grand Rapids Heritage Hill parcel
        const mockFeat = {
            attributes: {
                OBJECTID: 4091,
                PPN_TEXT: "41-14-30-205-012",
                PROPERTYADDRESS: "318 MORRIS AVE SE",
                LND_SQFOOT: 7200,
                LIVING_AREA: 1950,
                CONST_YEAR: 1925,
                SEV: 175000,
                STORIES: 2,
                BEDROOMS: 3,
                BATHROOMS: 2
            },
            geometry: {
                rings: [[[-85.6582, 42.9583], [-85.6578, 42.9583], [-85.6578, 42.9581], [-85.6582, 42.9581], [-85.6582, 42.9583]]]
            }
        };

        const norm = normalizeParcelFeature(mockFeat, { lat: 42.9582, lng: -85.6580 }, { name: "Kent County GIS", apn: "PPN_TEXT", addr: "PROPERTYADDRESS" });
        
        // Set selected to Kent County Heritage Hill
        selected = "260810021001";
        const m = (typeof D !== "undefined" && D.details && D.details["260810021001"]) ? D.details["260810021001"].m : { hv: 330800 };
        
        const val = estimatePropertyMarketValue({
            attributes: norm.attributes,
            lotSqft: 7200,
            neighborhood: m,
            stateCode: "MI",
            facts: { bldg: 1950, beds: 3, baths: 2, yb: 1925, stories: 2 }
        });

        // Set activeHouse so UI updates
        const a = norm.attributes;
        const box = document.createElement("div");
        box.id = "house";
        const st = { osmDone: true, rDone: true, osm: null, R: null };
        activeHouse = { box, a, lot: 7200, ll: { lat: 42.9582, lng: -85.6580 }, st, houseHv: val.estimatedValue, houseVpsf: val.vpsf, F: { bldg: 1950, beds: 3, baths: 2, yb: 1925, stories: 2 } };
        
        renderHouse(box, a, 7200, { lat: 42.9582, lng: -85.6580 }, st);
        const panel = document.getElementById("panel");
        const v = panel.querySelector(".verdict") || panel.querySelector("h2");
        if (v && v.after) v.after(box);

        // Test AI Advisor
        const aiAnswer = generateAiAnswer("What is this home worth and why does it match Zillow?");

        return {
            situs: norm.attributes.SitusFullAddress,
            livingSqft: norm.attributes.SQFTmain1,
            lotSqft: norm.attributes.LotSqft,
            sev: norm.attributes.SEV,
            estimatedValue: val.estimatedValue,
            valueLow: val.valueLow,
            valueHigh: val.valueHigh,
            vpsf: val.vpsf,
            method: val.valuationMethod,
            aiAnswerSnippet: aiAnswer.slice(0, 300)
        };
    })()
    """)

    print("AVM Runtime Test Result:", json.dumps(test_result, indent=2))
    assert test_result["livingSqft"] == 1950
    assert test_result["lotSqft"] == 7200
    assert "Michigan 2x SEV" in test_result["method"]
    assert 350000 <= test_result["estimatedValue"] <= 420000
    assert "Automated Valuation Model (AVM) Breakdown" in test_result["aiAnswerSnippet"]

    # Close any overlays and take screenshot of panel
    eval_js('document.querySelectorAll(".overlay-modal").forEach(m => { m.hidden = true; m.style.display = "none"; });')
    time.sleep(1)

    shot = call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
    with open("/Users/milessilverman/.gemini/antigravity/brain/3dbfc1b4-d048-42a4-a233-55e6e56fcc18/screenshot_avm_verified.jpg", "wb") as f:
        f.write(base64.b64decode(shot["data"]))

    ws.close()
    print("✓ Saved screenshot_avm_verified.jpg")
    print("✓ All AVM runtime verifications passed!")

if __name__ == "__main__":
    verify_avm()
