// Madar backend as a regular Node server (for Docker / VPS), no Lambda needed.
// Wraps the existing Lambda-style handler in a plain HTTP server.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { handler } from "./handler.mjs";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
// Comma-separated exact origins of your frontend, e.g. https://maadar.vercel.app
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin) {
  if (!allowed.length) return {};
  if (!allowed.includes("*") && !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": allowed.includes("*") ? "*" : origin,
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "300",
    vary: "Origin",
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "";
  const cors = corsHeaders(origin);
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors).end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    res
      .writeHead(200, { "content-type": "application/json; charset=utf-8", ...cors })
      .end(JSON.stringify({ ok: true }));
    return;
  }

  const chunks = [];
  let size = 0;
  req.on("data", (c) => {
    size += c.length;
    if (size > 2_000_000) {
      res.writeHead(413, cors).end();
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", async () => {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers))
      headers[k] = Array.isArray(v) ? v.join(",") : v;
    const event = {
      version: "2.0",
      rawPath: url.pathname,
      rawQueryString: url.search ? url.search.slice(1) : "",
      headers,
      body: Buffer.concat(chunks).toString("utf8"),
      isBase64Encoded: false,
      requestContext: {
        requestId: randomUUID(),
        http: { method: req.method, path: url.pathname },
        timeEpoch: Date.now(),
      },
    };
    try {
      const result = await handler(event);
      res
        .writeHead(result.statusCode || 200, { ...result.headers, ...cors })
        .end(result.body || "");
    } catch (e) {
      console.error(JSON.stringify({ error: e.name, message: e.message }));
      res
        .writeHead(500, { "content-type": "application/json; charset=utf-8", ...cors })
        .end(JSON.stringify({ message: "Server error." }));
    }
  });
  req.on("error", () => res.destroy());
});

server.listen(port, host, () => {
  console.log(`Madar API listening on http://${host}:${port}`);
  if (!allowed.length)
    console.warn("ALLOWED_ORIGINS is empty: browser calls will be blocked by CORS.");
});

for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => server.close(() => process.exit(0)));
