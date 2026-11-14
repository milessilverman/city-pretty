// Serves the site the way GitHub Pages does (under /city-pretty/), for local use and the browser tests.
//   node scripts/serve.mjs [port]      then open http://127.0.0.1:8080/city-pretty/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PREFIX = "/city-pretty/";
const port = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".gz": "application/gzip", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" || url.pathname === "/city-pretty") { res.writeHead(302, { Location: PREFIX }); return res.end(); }
  if (!url.pathname.startsWith(PREFIX)) { res.writeHead(404); return res.end("Not found"); }
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname.slice(PREFIX.length))));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`City Pretty at http://127.0.0.1:${port}${PREFIX}`));
