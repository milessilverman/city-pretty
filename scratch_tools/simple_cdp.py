import socket
import ssl
import base64
import hashlib
import os
import json
import urllib.parse

class SimpleWS:
    def __init__(self, ws_url):
        u = urllib.parse.urlparse(ws_url)
        self.host = u.hostname
        self.port = u.port or (443 if u.scheme == "wss" else 80)
        self.path = u.path + ("?" + u.query if u.query else "")
        self.sock = socket.create_connection((self.host, self.port), timeout=10)
        if u.scheme == "wss":
            ctx = ssl.create_default_context()
            self.sock = ctx.wrap_socket(self.sock, server_hostname=self.host)
        
        # Handshake
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode('utf-8'))
        res = self.sock.recv(4096)
        if b"101" not in res:
            raise Exception("WebSocket handshake failed: " + res.decode('utf-8', errors='ignore'))

    def send(self, data):
        if isinstance(data, dict):
            data = json.dumps(data)
        payload = data.encode('utf-8')
        length = len(payload)
        mask_key = os.urandom(4)
        masked = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        
        frame = bytearray([0x81]) # FIN + text opcode
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, 'big'))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, 'big'))
        frame.extend(mask_key)
        frame.extend(masked)
        self.sock.sendall(frame)

    def recv(self):
        head = self.sock.recv(2)
        if not head: return None
        length = head[1] & 0x7F
        if length == 126:
            length = int.from_bytes(self.sock.recv(2), 'big')
        elif length == 127:
            length = int.from_bytes(self.sock.recv(8), 'big')
        data = bytearray()
        while len(data) < length:
            chunk = self.sock.recv(min(4096, length - len(data)))
            if not chunk: break
            data.extend(chunk)
        return json.loads(data.decode('utf-8'))

    def call(self, method, params=None, req_id=1):
        self.send({"id": req_id, "method": method, "params": params or {}})
        while True:
            msg = self.recv()
            if not msg: return {}
            if msg.get("id") == req_id:
                return msg.get("result", {})

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass
