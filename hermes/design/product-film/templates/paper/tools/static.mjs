// Tiny static server for the film folder. film.html loads timeline.json and the kit manifest with fetch(),
// which fails on file:// – always open the film over http. startStatic() → { base, close }.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export const FILM = fileURLToPath(new URL('..', import.meta.url));   // fileURLToPath, not .pathname: paths may contain spaces
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
export function startStatic(port = 0) {
  return new Promise((res) => {
    const srv = http.createServer(async (req, rsp) => {
      const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)); const file = join(FILM, p);
      if (!file.startsWith(FILM.endsWith(sep) ? FILM : FILM + sep)) { rsp.writeHead(403); return rsp.end(); }
      try { const body = await readFile(file); rsp.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); rsp.end(body); }
      catch { rsp.writeHead(404); rsp.end(); }
    });
    srv.listen(port, '127.0.0.1', () => res({ base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}
