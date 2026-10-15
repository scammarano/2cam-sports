import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { SportsError, validateFormat, initialState, replay, pointLabels, isDecidingPoint } from './engine.js';

const token = () => randomBytes(32).toString('hex');
const hash = v => createHash('sha256').update(String(v)).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
function label(v, field) { if (typeof v !== 'string' || !v.trim() || v.trim().length > 100) throw new SportsError(`${field}: entre 1 y 100 caracteres.`); return v.trim(); }
function entity(list, id) { const item = list.find(i => i.id === id); if (!item) throw new SportsError('Registro no encontrado.', 404); return item; }

export class Store {
  constructor(file, adminToken) {
    if (typeof adminToken !== 'string' || adminToken.length < 24) throw new Error('SPORTS_ADMIN_TOKEN debe tener al menos 24 caracteres.');
    this.file = file; this.adminToken = adminToken;
    this.data = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { schema: 1, courts: [], matches: [], screens: [], events: [], requests: {} };
    if (this.data.schema !== 1) throw new Error('Versión de datos incompatible.');
  }
  // Una sola instancia/escritor. Cada mutación y evento se persisten antes del ACK.
  transaction(fn) {
    const before = structuredClone(this.data);
    try {
      const result = fn();
      if (this.file) {
        mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
        const tmp = `${this.file}.tmp`, fd = openSync(tmp, 'w', 0o600);
        try { writeFileSync(fd, JSON.stringify(this.data)); fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(tmp, this.file);
      }
      return structuredClone(result);
    } catch (err) { this.data = before; throw err; }
  }
  isAdmin(t) { return equal(t, this.adminToken); }
  requireAdmin(t) { if (!this.isAdmin(t)) throw new SportsError('Se requiere acceso de administrador local.', 401); }
  emit(type, matchId, payload = {}) {
    const event = { schema: '2cam.events.v1', event_id: randomUUID(), sequence: this.data.events.length + 1, occurred_at: new Date().toISOString(), source: 'sports', type, scope: { match_id: matchId }, payload };
    this.data.events.push(event); return event;
  }
  matchView(m) {
    const s = replay(m.format, m.points, m.firstServer);
    return { id: m.id, courtId: m.courtId, names: m.names, scheduledAt: m.scheduledAt, format: m.format, status: s.winner !== null ? 'finished' : m.status, version: m.version, state: s, labels: pointLabels(s, m.format), decidingPoint: isDecidingPoint(s, m.format) };
  }
  adminView(t) {
    this.requireAdmin(t);
    return { courts: this.data.courts, matches: this.data.matches.map(m => this.matchView(m)), screens: this.data.screens.map(s => ({ id: s.id, name: s.name, mode: s.mode, matchId: s.matchId, controls: s.controls.map(c => ({ id: c.id, name: c.name, role: c.role })) })) };
  }
  createCourt(t, body) {
    this.requireAdmin(t); const name = label(body.name, 'Nombre de pista');
    if (this.data.courts.some(c => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new SportsError('Ya existe una pista con ese nombre.', 409);
    return this.transaction(() => { const c = { id: randomUUID(), name }; this.data.courts.push(c); return c; });
  }
  createMatch(t, body) {
    this.requireAdmin(t); entity(this.data.courts, body.courtId);
    const format = validateFormat(body.format);
    if (!Array.isArray(body.names) || body.names.length !== 2) throw new SportsError('Indica dos jugadores o parejas.');
    const names = body.names.map(n => label(n, 'Jugador/pareja'));
    if (body.scheduledAt && !Number.isFinite(Date.parse(body.scheduledAt))) throw new SportsError('Fecha inválida.');
    const firstServer = body.firstServer ?? 0; initialState(format, firstServer);
    return this.transaction(() => {
      const m = { id: randomUUID(), courtId: body.courtId, names, scheduledAt: body.scheduledAt || null, format, firstServer, points: [], history: [], version: 0, status: 'scheduled' };
      this.data.matches.push(m); this.emit('sports.match_created', m.id); return this.matchView(m);
    });
  }
  startMatch(t, id) {
    this.requireAdmin(t); const m = entity(this.data.matches, id);
    if (m.status === 'live') return this.matchView(m);
    if (m.status !== 'scheduled') throw new SportsError('El encuentro no puede iniciarse.', 409);
    if (this.data.matches.some(x => x.courtId === m.courtId && x.status === 'live')) throw new SportsError('La pista ya tiene un encuentro en juego.', 409);
    return this.transaction(() => { m.status = 'live'; m.version++; this.emit('sports.match_started', id); return this.matchView(m); });
  }
  createScreen(t, body) {
    this.requireAdmin(t); const m = entity(this.data.matches, body.matchId), name = label(body.name, 'Pantalla');
    if (this.data.screens.some(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new SportsError('Ya existe una pantalla con ese nombre.', 409);
    return this.transaction(() => {
      const displayToken = token(), s = { id: randomUUID(), name, matchId: m.id, mode: 'sports', tokenHash: hash(displayToken), controls: [], pairing: null };
      this.data.screens.push(s); return { id: s.id, displayToken };
    });
  }
  discover() { return this.data.screens.filter(s => s.mode === 'sports').map(s => ({ id: s.id, name: s.name, mode: s.mode, slotsUsed: s.controls.length, slotsMax: 3 })); }
  openPairing(t, id, role = 'home') {
    this.requireAdmin(t); const s = entity(this.data.screens, id);
    if (!['official', 'home', 'away'].includes(role)) throw new SportsError('Rol inválido.');
    if (s.controls.length >= 3) throw new SportsError('La pantalla ya tiene tres controles. Desvincula uno.', 409);
    return this.transaction(() => { const code = String(randomBytes(4).readUInt32BE() % 1000000).padStart(6, '0'); s.pairing = { code, expiresAt: Date.now() + 120000, attempts: 0, role }; return { code, expiresAt: s.pairing.expiresAt }; });
  }
  pair(id, body) {
    const s = entity(this.data.screens, id);
    if (s.controls.length >= 3) throw new SportsError('Máximo tres controles enlazados por pantalla.', 409);
    if (!s.pairing || s.pairing.expiresAt < Date.now() || s.pairing.attempts >= 5) throw new SportsError('Enlace cerrado o vencido. Solicita otro código.', 403);
    if (!equal(body.code, s.pairing.code)) { this.transaction(() => { s.pairing.attempts++; return {}; }); throw new SportsError('Código incorrecto.', 403); }
    const name = label(body.name, 'Control'), role = s.pairing.role;
    // Un anotador oficial por encuentro, aunque haya varias pantallas.
    if (role === 'official' && this.data.screens.some(x => x.matchId === s.matchId && x.controls.some(c => c.role === 'official'))) throw new SportsError('El encuentro ya tiene anotador oficial.', 409);
    return this.transaction(() => {
      const controlToken = token(), c = { id: randomUUID(), name, role, tokenHash: hash(controlToken) };
      s.controls.push(c); s.pairing = null;
      this.emit('sports.control_paired', s.matchId, { screen_id: id, control_id: c.id });
      return { controlToken, controlId: c.id, screenId: id, role: c.role };
    });
  }
  revoke(t, screenId, controlId) {
    this.requireAdmin(t); const s = entity(this.data.screens, screenId); entity(s.controls, controlId);
    return this.transaction(() => { s.controls = s.controls.filter(c => c.id !== controlId); this.emit('sports.control_revoked', s.matchId, { control_id: controlId }); return { ok: true }; });
  }
  access(t, screenId) {
    const s = entity(this.data.screens, screenId);
    if (this.isAdmin(t)) return { screen: s, role: 'official', actor: 'admin', admin: true };
    if (typeof t !== 'string') throw new SportsError('Acceso no autorizado.', 401);
    if (equal(hash(t), s.tokenHash)) return { screen: s, role: 'display', actor: s.id };
    const c = s.controls.find(c => equal(hash(t), c.tokenHash));
    if (!c) throw new SportsError('Acceso no autorizado para esta pantalla.', 401);
    return { screen: s, role: c.role, actor: c.id };
  }
  snapshot(t, id) {
    const a = this.access(t, id), s = a.screen;
    return { schema: '2cam.sports.snapshot.v1', screen: { id, name: s.name, mode: s.mode }, match: this.matchView(entity(this.data.matches, s.matchId)), role: a.role, lastSequence: this.data.events.length, pairing: a.role === 'display' || a.admin ? (s.pairing && s.pairing.expiresAt > Date.now() && s.pairing.attempts < 5 ? { code: s.pairing.code, expiresAt: s.pairing.expiresAt } : null) : null };
  }
  events(t, id, after) {
    const a = this.access(t, id);
    if (!Number.isSafeInteger(after) || after < 0 || after > this.data.events.length) throw new SportsError('Secuencia inválida; solicita snapshot.');
    return { events: this.data.events.filter(e => e.sequence > after && e.scope.match_id === a.screen.matchId), lastSequence: this.data.events.length };
  }
  command(t, screenId, key, body) {
    const a = this.access(t, screenId), m = entity(this.data.matches, a.screen.matchId);
    if (a.role === 'display') throw new SportsError('La pantalla es de solo lectura.', 403);
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new SportsError('Falta Idempotency-Key válida.');
    if (!['point', 'undo'].includes(body.type)) throw new SportsError('Comando no soportado.');
    if (body.type === 'point' && ![0, 1].includes(body.side)) throw new SportsError('Lado inválido.');
    if (a.role !== 'official' && (body.type !== 'point' || body.side !== (a.role === 'home' ? 0 : 1))) throw new SportsError('Este control no tiene permiso para esa acción.', 403);
    const requestKey = `${a.actor}:${key}`, fingerprint = hash(JSON.stringify([screenId, body]));
    const prior = this.data.requests[requestKey];
    if (prior) { if (prior.fingerprint !== fingerprint) throw new SportsError('La clave ya se usó para otra operación.', 409); return structuredClone(prior.response); }
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion !== m.version) throw new SportsError('El marcador cambió. Actualiza antes de confirmar otro punto.', 409);
    if (m.status !== 'live' && !(m.status === 'finished' && body.type === 'undo')) throw new SportsError('El encuentro no está en juego.', 409);
    if (body.type === 'undo' && !m.points.length) throw new SportsError('No hay puntos que deshacer.', 409);
    if (m.points.length >= 20000 && body.type === 'point') throw new SportsError('Límite técnico de puntos alcanzado.', 409);
    return this.transaction(() => {
      if (body.type === 'point') m.points.push(body.side); else m.points.pop();
      const state = replay(m.format, m.points, m.firstServer);
      m.status = state.winner === null ? 'live' : 'finished'; m.version++;
      m.history.push({ actor: a.actor, action: body.type, side: body.side ?? null, version: m.version, at: new Date().toISOString() });
      const event = this.emit(body.type === 'undo' ? 'sports.point_undone' : 'sports.point_awarded', m.id, { match_version: m.version });
      const response = { event_id: event.event_id, sequence: event.sequence, match: this.matchView(m) };
      this.data.requests[requestKey] = { fingerprint, response }; return response;
    });
  }
}
