import json
import urllib.request
import asyncio
import websockets
import time

async def test_page():
    # 1. Get WebSocket URL from CDP
    resp = urllib.request.urlopen("http://127.0.0.1:9444/json/new?http://localhost:8088/index.html")
    page_info = json.loads(resp.read().decode())
    ws_url = page_info["webSocketDebuggerUrl"]
    target_id = page_info["id"]
    print("Attached to target:", target_id)

    async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
        msg_id = 1

        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                if data.get("id") == payload["id"]:
                    return data.get("result", {})

        # Enable runtime and page
        await send("Page.enable")
        await send("Runtime.enable")
        await send("DOM.enable")

        print("Waiting for page initialization...")
        await asyncio.sleep(4)

        # Check console / runtime errors
        res = await send("Runtime.evaluate", {
            "expression": "typeof map !== 'undefined' && typeof openCounty === 'function' && typeof addressSearch === 'function' && typeof getMetroPipeline === 'function'"
        })
        print("Core functions defined:", res.get("result", {}).get("value"))

        # Test 1: Verify search box attributes and type "south orange"
        eval_q = await send("Runtime.evaluate", {
            "expression": """(() => {
                const q = document.querySelector('#q');
                const listAttr = q.getAttribute('list');
                const dl = document.querySelector('#names');
                return {
                    hasListAttr: !!listAttr,
                    listAttrVal: listAttr,
                    datalistHidden: dl ? dl.style.display : null
                };
            })()""",
            "returnByValue": True
        })
        print("Search box attributes (no datalist conflict):", eval_q.get("result", {}).get("value"))

        # Trigger search for "south orange"
        await send("Runtime.evaluate", {
            "expression": """(() => {
                const q = document.querySelector('#q');
                q.value = 'south orange';
                q.dispatchEvent(new Event('input', { bubbles: true }));
            })()"""
        })
        print("Typed 'south orange' in search input, waiting for results...")
        await asyncio.sleep(1.5)

        eval_results = await send("Runtime.evaluate", {
            "expression": """(() => {
                const box = document.querySelector('#addr-results');
                if (!box) return { found: false };
                const buttons = Array.from(box.querySelectorAll('button'));
                return {
                    found: true,
                    count: buttons.length,
                    items: buttons.slice(0, 5).map(b => b.textContent.trim())
                };
            })()""",
            "returnByValue": True
        })
        print("Search results dropdown:", json.dumps(eval_results.get("result", {}).get("value"), indent=2))

        # Test 2: Test P3 pipeline function for Austin, LA, Denver
        eval_p3 = await send("Runtime.evaluate", {
            "expression": """(() => {
                const atx = getMetroPipeline('48453', 'Austin');
                const la = getMetroPipeline('06037', 'Los Angeles');
                const den = getMetroPipeline('08031', 'Denver');
                return {
                    atx_title: atx.title,
                    atx_agency: atx.agency,
                    atx_irr: atx.baseIRR,
                    atx_lease: atx.baseGroundLease,
                    atx_trail: atx.bikewayName,
                    la_title: la.title,
                    den_title: den.title
                };
            })()""",
            "returnByValue": True
        })
        print("P3 pipeline data:", json.dumps(eval_p3.get("result", {}).get("value"), indent=2))

        # Test 3: Select a block group to inspect P3 section in UI
        await send("Runtime.evaluate", {
            "expression": """(() => {
                if (typeof select === 'function') {
                    const firstId = Array.from(byId.keys())[0];
                    if (firstId) select(firstId, false);
                }
            })()"""
        })
        await asyncio.sleep(1)

        eval_panel = await send("Runtime.evaluate", {
            "expression": """(() => {
                const irr = document.querySelector('#p3-irr');
                const rev = document.querySelector('#p3-rev');
                const lift = document.querySelector('#p3-lift');
                const notes = document.querySelector('#p3-notes');
                return {
                    p3_rendered: !!irr,
                    irr_text: irr ? irr.textContent : null,
                    rev_text: rev ? rev.textContent : null,
                    lift_text: lift ? lift.textContent : null
                };
            })()""",
            "returnByValue": True
        })
        print("P3 Section UI:", json.dumps(eval_panel.get("result", {}).get("value"), indent=2))

        # Test 4: Open Austin County (FIPS 48453) to verify progress bar, HUD, and Austin P3 pipeline
        print("Opening Austin (Travis County 48453)...")
        await send("Runtime.evaluate", {
            "expression": "openCounty('48453')"
        })
        # Check HUD during load
        await asyncio.sleep(0.5)
        eval_hud = await send("Runtime.evaluate", {
            "expression": """(() => {
                const hud = document.querySelector('#county-hud');
                const prog = document.querySelector('#top-progress');
                return {
                    hud_exists: !!hud,
                    hud_text: hud ? hud.textContent : null,
                    prog_width: prog ? prog.style.width : null
                };
            })()""",
            "returnByValue": True
        })
        print("HUD and Progress during county switch:", eval_hud.get("result", {}).get("value"))

        await asyncio.sleep(4)

        eval_austin_p3 = await send("Runtime.evaluate", {
            "expression": """(() => {
                const title = document.querySelector('.panel-sec .sec-content');
                const irr = document.querySelector('#p3-irr');
                const rev = document.querySelector('#p3-rev');
                const lift = document.querySelector('#p3-lift');
                return {
                    activeFips: activeFips(),
                    irr: irr ? irr.textContent : null,
                    rev: rev ? rev.textContent : null,
                    lift: lift ? lift.textContent : null
                };
            })()""",
            "returnByValue": True
        })
        print("Austin County Loaded:", eval_austin_p3.get("result", {}).get("value"))

        # Test 5: Story verification and Zillow link test in mock house facts
        eval_house = await send("Runtime.evaluate", {
            "expression": """(() => {
                // Mock attributes for houseFacts
                const mockA = {
                    AIN: "1234-567-890",
                    SQFTmain1: 2800,
                    STORIES: 2,
                    SitusFullAddress: "1200 S Congress Ave",
                    county: "Travis County"
                };
                const F = houseFacts(mockA, 7500, null, null, {});
                return {
                    stories: F.stories,
                    conf: F.conf,
                    src: F.src.stories
                };
            })()""",
            "returnByValue": True
        })
        print("Assessor story extraction:", eval_house.get("result", {}).get("value"))

        # Close target
        urllib.request.urlopen(f"http://127.0.0.1:9444/json/close/{target_id}")

asyncio.run(test_page())
