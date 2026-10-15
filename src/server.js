import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { SportsError, presets } from './engine.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
export function createServer(store) {
  const rate = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new SportsError('Origen no permitido.', 403);
      const url = new URL(req.url, 'http://local'), path = url.pathname;
      const t = req.headers.authorization?.replace(/^Bearer /, '');
      if (req.method === 'GET' && ['/','/app.js','/style.css'].includes(path)) {
        const name = path === '/' ? 'index.html' : path.slice(1);
        res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' });
        return res.end(readFileSync(resolve(publicDir, name)));
      }
      if (req.method === 'GET' && path === '/api/v1/health') return json(200, { version: '0.1.0', status: 'ok', stage: 'local-prototype' });
      if (req.method === 'GET' && path === '/api/v1/presets') return json(200, presets());
      if (req.method === 'GET' && path === '/api/v1/discovery') return json(200, store.discover());
      if (req.method === 'GET' && path === '/api/v1/admin') return json(200, store.adminView(t));
      let m = path.match(/^\/api\/v1\/screens\/([^/]+)\/(snapshot|events)$/);
      if (req.method === 'GET' && m) return json(200, m[2] === 'snapshot' ? store.snapshot(t, m[1]) : store.events(t, m[1], Number(url.searchParams.get('after_sequence') ?? 0)));
      if (req.method !== 'POST') throw new SportsError('Ruta no encontrada.', 404);
      if (!req.headers['content-type']?.startsWith('application/json')) throw new SportsError('Se requiere JSON.', 415);
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) throw new SportsError('Solicitud demasiado grande.', 413); }
      let body; try { body = JSON.parse(raw); } catch { throw new SportsError('JSON inválido.', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SportsError('Objeto JSON inválido.', 400);
      if (path === '/api/v1/courts') return json(201, store.createCourt(t, body));
      if (path === '/api/v1/matches') return json(201, store.createMatch(t, body));
      if (path === '/api/v1/screens') return json(201, store.createScreen(t, body));
      m = path.match(/^\/api\/v1\/matches\/([^/]+)\/start$/);
      if (m) return json(200, store.startMatch(t, m[1]));
      m = path.match(/^\/api\/v1\/screens\/([^/]+)\/(pairing|pair|commands|revoke)$/);
      if (m) {
        if (m[2] === 'pairing') return json(200, store.openPairing(t, m[1], body.role));
        if (m[2] === 'pair') {
          const ip = req.socket.remoteAddress, now = Date.now();
          const entry = rate.get(ip);
          if (!entry || now - entry.start > 60000) rate.set(ip, { start: now, count: 1 }); else if (++entry.count > 15) throw new SportsError('Demasiados intentos; espera un minuto.', 429);
          if (rate.size > 10000) for (const [key, value] of rate) if (now - value.start > 60000) rate.delete(key);
          return json(201, store.pair(m[1], body));
        }
        if (m[2] === 'revoke') return json(200, store.revoke(t, m[1], body.controlId));
        return json(200, store.command(t, m[1], req.headers['idempotency-key'], body));
      }
      throw new SportsError('Ruta no encontrada.', 404);
    } catch (err) { json(err instanceof SportsError ? err.status : 500, { error: err instanceof SportsError ? err.message : 'Error interno. Revisa el servicio local.' }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const store = new Store(process.env.SPORTS_DATA_FILE || 'data/sports.json', process.env.SPORTS_ADMIN_TOKEN);
    const host = process.env.SPORTS_HOST || '127.0.0.1', port = Number(process.env.PORT || 8787);
    const server = createServer(store);
    server.on('error', err => { console.error(`No se pudo iniciar Sports: ${err.code || 'error'}`); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`2Cam Sports 0.1.0 · http://${host}:${port} · una sede local · prototipo`));
  } catch (err) { console.error(err.message); process.exitCode = 1; }
}
