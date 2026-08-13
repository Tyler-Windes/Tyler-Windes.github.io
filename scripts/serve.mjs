import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const root = resolve(valueAfter("--root", "dist"));
const port = Number(valueAfter("--port", "4173"));
const host = "127.0.0.1";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(root)) throw new Error(`Preview root does not exist: ${root}`);

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const relative = normalize(requested).replace(/^([/\\])+/, "");
  let filePath = resolve(join(root, relative));
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  let status = 200;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(root, "404.html");
    status = 404;
  }

  response.writeHead(status, {
    "content-type": mime[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Local URL: http://${host}:${port}/\n`);
});
