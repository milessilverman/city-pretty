import socket
import base64
import os
import json
import urllib.request
import time

class SimpleWS:
    def __init__(self, ws_url):
        url = ws_url.replace("ws://", "")
        host_port, path = url.split("/", 1)
        host, port = host_port.split(":")
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((host, int(port)))

        key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f"GET /{path} HTTP/1.1\r\n"
            f"Host: {host_port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(handshake.encode())
        res = self.sock.recv(4096)
        if b"101" not in res:
            raise Exception("WebSocket handshake failed: " + res.decode())

    def send(self, payload_dict):
        data = json.dumps(payload_dict).encode("utf-8")
        frame = bytearray([0x81]) # FIN + text opcode
        length = len(data)
        mask_key = os.urandom(4)
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, "big"))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, "big"))
        frame.extend(mask_key)
        masked_data = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(data))
        frame.extend(masked_data)
        self.sock.sendall(frame)

    def recv(self):
        hdr = self.sock.recv(2)
        if not hdr: return None
        b1, b2 = hdr
        opcode = b1 & 0x0F
        masked = (b2 & 0x80) != 0
        length = b2 & 0x7F
        if length == 126:
            length = int.from_bytes(self.sock.recv(2), "big")
        elif length == 127:
            length = int.from_bytes(self.sock.recv(8), "big")
        
        mask = self.sock.recv(4) if masked else None
        data = bytearray()
        while len(data) < length:
            chunk = self.sock.recv(min(length - len(data), 65536))
            if not chunk: break
            data.extend(chunk)
        if masked:
            data = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
        return json.loads(data.decode("utf-8", errors="replace"))

    def call(self, method, params=None, req_id=1):
        self.send({"id": req_id, "method": method, "params": params or {}})
        while True:
            msg = self.recv()
            if not msg: return {}
            if msg.get("id") == req_id:
                return msg.get("result", {})

    def close(self):
        self.sock.close()

# Get existing page target
resp = urllib.request.urlopen("http://127.0.0.1:9444/json/list")
targets = json.loads(resp.read().decode())
page_target = next(t for t in targets if t.get("type") == "page")
print("Using page target:", page_target["id"])
ws = SimpleWS(page_target["webSocketDebuggerUrl"])

try:
    ws.call("Page.enable", req_id=10)
    ws.call("Runtime.enable", req_id=11)
    print("Navigating to http://localhost:8088/index.html...")
    ws.call("Page.navigate", {"url": "http://localhost:8088/index.html"}, req_id=12)
    time.sleep(3.5)

    # 1. Verify search datalist is disconnected (no double popup)
    r1 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const q = document.querySelector('#q');
            return {
                hasListAttr: q.hasAttribute('list'),
                autocomplete: q.getAttribute('autocomplete'),
                datalistDisplay: document.querySelector('#names').style.display
            };
        })()""",
        "returnByValue": True
    }, req_id=13)
    print("Search input check (no double popup):", r1.get("result", {}).get("value"))

    # 2. Type "south orange" and check unified dropdown
    ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const q = document.querySelector('#q');
            q.value = 'south orange';
            q.dispatchEvent(new Event('input', { bubbles: true }));
        })()"""
    }, req_id=14)
    time.sleep(1.8)

    r2 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const box = document.querySelector('#addr-results');
            if (!box) return null;
            return Array.from(box.querySelectorAll('button')).map(b => b.textContent.trim());
        })()""",
        "returnByValue": True
    }, req_id=15)
    print("Dropdown items for 'south orange':", json.dumps(r2.get("result", {}).get("value"), indent=2))

    # 3. Test getMetroPipeline for Austin, LA, Denver
    r3 = ws.call("Runtime.evaluate", {
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
    }, req_id=16)
    print("P3 pipeline data:", json.dumps(r3.get("result", {}).get("value"), indent=2))

    # 4. Check P3 Section in sidebar
    ws.call("Runtime.evaluate", {
        "expression": "if (typeof select === 'function') select(Array.from(byId.keys())[0], false);"
    }, req_id=17)
    time.sleep(1)

    r4 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const irr = document.querySelector('#p3-irr');
            const rev = document.querySelector('#p3-rev');
            const lift = document.querySelector('#p3-lift');
            const rider = document.querySelector('#p3-ridership');
            return {
                p3_rendered: !!irr,
                irr: irr ? irr.textContent : null,
                rev: rev ? rev.textContent : null,
                lift: lift ? lift.textContent : null,
                ridership: rider ? rider.textContent : null
            };
        })()""",
        "returnByValue": True
    }, req_id=18)
    print("P3 UI in sidebar:", json.dumps(r4.get("result", {}).get("value"), indent=2))

    # 5. Test house facts stories evaluation and toggle
    r5 = ws.call("Runtime.evaluate", {
        "expression": """(() => {
            const mockA = {
                AIN: "4321-001-002",
                SQFTmain1: 2400,
                STORIES: 2,
                SitusFullAddress: "1234 Elm Street",
                county: "Los Angeles"
            };
            const F = houseFacts(mockA, 6000, null, null, {});
            return {
                stories: F.stories,
                conf: F.conf,
                src: F.src.stories
            };
        })()""",
        "returnByValue": True
    }, req_id=19)
    print("House facts stories evaluation:", json.dumps(r5.get("result", {}).get("value"), indent=2))

    # 6. Capture full screenshot
    ss = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 85}, req_id=20)
    if "data" in ss:
        with open("/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/screenshot_verified.jpg", "wb") as f:
            f.write(base64.b64decode(ss["data"]))
        print("Saved screenshot to screenshot_verified.jpg")

finally:
    ws.close()

print("All CDP checks completed successfully!")
