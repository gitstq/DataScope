#!/usr/bin/env node
/**
 * DataScope - Zero-dependency static file server.
 * Serves the project directory so the app can be used offline from any browser.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);
const PORT = Number(process.argv.find((a, i) => a === '--port' && process.argv[i + 1] ? process.argv[i + 1] : 0)) || Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  let filePath = normalize(join(ROOT, urlPath));

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    let stat;
    try {
      stat = await readFile(filePath);
    } catch {
      // try index.html fallback for directory / SPA-ish
      if (urlPath.endsWith('/') || extname(urlPath) === '') {
        filePath = join(filePath, 'index.html');
        stat = await readFile(filePath);
      } else {
        throw new Error('not found');
      }
    }
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(stat);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found\n');
  }
});

server.listen(PORT, () => {
  console.log(`\n  DataScope server running at  http://localhost:${PORT}\n  Press Ctrl+C to stop.\n`);
});