const $ = s => document.querySelector(s);
let adminToken = '', catalog = [], data, session = null, lastSnapshot, timer, online = false, busy = false;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(s = '') { $('#notice').textContent = s; }
async function api(path, { method = 'GET', body, token = adminToken, key } = {}) {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json'; if (key) headers['Idempotency-Key'] = key;
  const r = await fetch(`/api/v1${path}`, { method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const value = await r.json(); if (!r.ok) { const err = new Error(value.error || 'Error'); err.status = r.status; throw err; } return value;
}
function run(fn) { return async e => { e?.preventDefault(); try { notice(); await fn(e); } catch (err) { notice(err.message); const dialog = e?.target?.closest?.('dialog'); if (dialog) { let msg = dialog.querySelector('[data-error]'); if (!msg) { msg = document.createElement('p'); msg.dataset.error=''; msg.setAttribute('role','alert'); dialog.append(msg); } msg.textContent=err.message; } } }; }
function tab(name) { clearTimeout(timer); session = null; for (const s of ['admin','control','live']) $(`#${s}`).hidden = s !== name; }
function formatText(f) { return `${f.discipline === 'tennis' ? 'Tenis' : 'Pádel'} · ${f.bestOf === 1 ? '1 set' : `mejor de ${f.bestOf}`} · a ${f.set.games} games · ${f.deuce}${f.decidingSet.kind === 'match_tiebreak' ? ` · STB ${f.decidingSet.points}` : ''}`; }
async function refreshAdmin() {
  data = await api('/admin'); $('#management').hidden = false;
  $('#courts').innerHTML = data.courts.map(c => `<li class="badge">${esc(c.name)}</li>`).join('') || '<li>No hay pistas.</li>';
  $('#matches').innerHTML = data.matches.map(m => `<tr><td>${esc(data.courts.find(c => c.id === m.courtId)?.name)}</td><td>${m.names.map(esc).join(' / ')}</td><td>${esc(formatText(m.format))}</td><td>${esc({scheduled:'Programado',live:'En juego',finished:'Finalizado'}[m.status])}</td><td>${m.status === 'scheduled' ? `<button data-start="${m.id}">Iniciar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5">Crea tu primer encuentro.</td></tr>';
  $('#screens').innerHTML = data.screens.map(s => `<div class="card"><strong>${esc(s.name)}</strong> · ${s.controls.length}/3 controles<br><select aria-label="Rol del nuevo control" id="role-${s.id}"><option value="official">Anotador oficial</option><option value="home">Auxiliar A</option><option value="away">Auxiliar B</option></select><button data-pairing="${s.id}">Abrir enlace (2 min)</button><button data-operate="${s.id}">Consola administrador</button>${s.controls.map(c => `<p>${esc(c.name)} · ${esc(c.role)} <button data-revoke="${s.id}" data-control="${c.id}">Desvincular</button></p>`).join('')}<p id="code-${s.id}"></p></div>`).join('') || '<p>No hay pantallas de prueba.</p>';
}
$('#adminTab').onclick = () => tab('admin'); $('#controlTab').onclick = run(async () => { tab('control'); await discover(); });
$('#login').onsubmit = run(async () => { adminToken = $('#adminToken').value; await refreshAdmin(); $('#adminToken').value = ''; });
document.querySelectorAll('.cancel').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#newCourt').onclick = () => $('#courtDialog').showModal();
$('#courtForm').onsubmit = run(async e => { await api('/courts', { method:'POST', body:{ name: new FormData(e.target).get('name') } }); $('#courtDialog').close(); e.target.reset(); await refreshAdmin(); });
function fillPreset() {
  const f = catalog.find(p => p.id === $('#preset').value).format, form = $('#matchForm').elements;
  for (const k of ['discipline','bestOf','deuce']) form[k].value = f[k];
  form.games.value = f.set.games; form.tiebreakAt.value = f.set.tiebreakAt ?? f.set.games; form.advantageSet.checked = f.set.tiebreakAt === null; form.tiebreakPoints.value = f.set.tiebreakPoints;
  form.decidingKind.value = f.decidingSet.kind === 'match_tiebreak' ? 'match_tiebreak' : 'same'; form.finalPoints.value = f.decidingSet.points || f.decidingSet.tiebreakPoints; $('#decidingCustom').hidden = true;
}
$('#preset').onchange = fillPreset;
$('#matchForm').elements.decidingKind.onchange = e => { $('#decidingCustom').hidden = e.target.value !== 'custom'; };
$('#newMatch').onclick = run(async () => {
  if (!data.courts.length) throw new Error('Crea una pista primero.');
  $('#matchForm').elements.courtId.innerHTML = data.courts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  catalog = await api('/presets'); $('#preset').innerHTML = catalog.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join(''); fillPreset(); $('#matchDialog').showModal();
});
$('#matchForm').onsubmit = run(async e => {
  const f = new FormData(e.target), n = k => Number(f.get(k));
  const set = { kind:'games', games:n('games'), tiebreakAt:f.has('advantageSet') ? null : n('tiebreakAt'), tiebreakPoints:n('tiebreakPoints') };
  const kind = f.get('decidingKind'), decidingSet = kind === 'same' ? structuredClone(set) : kind === 'match_tiebreak' ? { kind, points:n('finalPoints') } : { kind:'games', games:n('finalGames'), tiebreakAt:f.has('finalAdvantage') ? null : n('finalAt'), tiebreakPoints:n('finalPoints') };
  await api('/matches', { method:'POST', body:{ courtId:f.get('courtId'), names:[f.get('home'),f.get('away')], firstServer:n('firstServer'), scheduledAt:f.get('scheduledAt') ? new Date(f.get('scheduledAt')).toISOString() : null, format:{ discipline:f.get('discipline'), bestOf:n('bestOf'), deuce:f.get('deuce'), set, decidingSet } } });
  $('#matchDialog').close(); await refreshAdmin();
});
$('#newScreen').onclick = run(async () => { if (!data.matches.length) throw new Error('Crea un encuentro primero.'); $('#screenForm').elements.matchId.innerHTML = data.matches.map(m => `<option value="${m.id}">${m.names.map(esc).join(' / ')}</option>`).join(''); $('#screenDialog').showModal(); });
$('#screenForm').onsubmit = run(async e => {
  const f = new FormData(e.target), s = await api('/screens', { method:'POST', body:{ name:f.get('name'), matchId:f.get('matchId') } }); $('#screenDialog').close(); await refreshAdmin();
  const link = document.createElement('a'); link.href = `/#screen=${encodeURIComponent(s.id)}&token=${encodeURIComponent(s.displayToken)}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Abrir visor (guarda este enlace privado para volver a abrirlo)';
  const p = document.createElement('p'); p.append(link); $(`#code-${s.id}`).append(p);
});
$('#management').onclick = run(async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.start) { await api(`/matches/${b.dataset.start}/start`, { method:'POST', body:{} }); await refreshAdmin(); }
  if (b.dataset.pairing) { const id = b.dataset.pairing, result = await api(`/screens/${id}/pairing`, { method:'POST', body:{ role:$(`#role-${id}`).value } }); $(`#code-${id}`).textContent = `Código: ${result.code} · vence en 2 minutos · visible también en el visor`; }
  if (b.dataset.operate) await openLive({ screenId:b.dataset.operate, token:adminToken });
  if (b.dataset.revoke) { await api(`/screens/${b.dataset.revoke}/revoke`, { method:'POST', body:{ controlId:b.dataset.control } }); await refreshAdmin(); }
});
async function discover() { const list = await api('/discovery', { token:'' }); $('#discovered').innerHTML = list.map(s => `<div class="card"><strong>${esc(s.name)}</strong><p>Sports · ${s.slotsUsed}/3 controles</p><button data-connect="${s.id}" ${s.slotsUsed >= 3 ? 'disabled' : ''}>Enlazar</button></div>`).join('') || '<p>No hay pantallas Sports registradas.</p>'; }
$('#discover').onclick = run(discover);
$('#discovered').onclick = e => { const id = e.target.dataset.connect; if (id) { $('#pairForm').elements.screenId.value = id; $('#pairDialog').showModal(); } };
$('#pairForm').onsubmit = run(async e => { const f = new FormData(e.target), id = f.get('screenId'); const r = await api(`/screens/${id}/pair`, { method:'POST', token:'', body:{ name:f.get('name'), code:f.get('code') } }); $('#pairDialog').close(); sessionStorage.setItem('sports-control', JSON.stringify({screenId:id,token:r.controlToken})); await openLive({screenId:id,token:r.controlToken}); });
async function openLive(s) { tab('live'); session = s; lastSnapshot = null; await poll(); }
function render(snapshot) {
  lastSnapshot = snapshot; const m = snapshot.match, state = m.state, readOnly = snapshot.role === 'display';
  $('#screenName').textContent = snapshot.screen.name; $('#liveTitle').textContent = state.winner === null ? (m.status === 'scheduled' ? 'Encuentro programado' : 'En juego') : `Ganador: ${m.names[state.winner]}`;
  $('#scoreboard').innerHTML = [0,1].map(side => `<div class="score" ><strong>${state.server === side && state.winner === null ? '● ' : ''}${esc(m.names[side])}</strong>${(state.completedSets.length ? state.completedSets : [null]).map(s => s ? `<span class="set">${s.kind === 'match_tiebreak' ? `[${s.tiePoints[side]}]` : s.games[side]}${s.kind === 'tiebreak' ? `<small>(${s.tiePoints[side]})</small>` : ''}</span>` : '<span class="set">—</span>').join('')}<span class="games">${state.games[side]}</span><span class="points">${m.labels[side]}</span></div>`).join('');
  document.querySelectorAll('.score').forEach(row => row.style.setProperty('--sets', Math.max(1, state.completedSets.length)));
  $('#pairCode').textContent = snapshot.pairing ? `Enlace: ${snapshot.pairing.code}` : '';
  $('#buttons').innerHTML = readOnly ? '' : [0,1].filter(side => snapshot.role === 'official' || (snapshot.role === 'home' ? side === 0 : side === 1)).map(side => `<button data-point="${side}">Punto ${esc(m.names[side])}</button>`).join('');
  $('#undo').hidden = snapshot.role !== 'official';
  $('#rules').textContent = `${formatText(m.format)} · ${state.phase === 'match_tiebreak' ? 'Supertiebreak' : state.phase === 'tiebreak' ? 'Tiebreak' : 'Puntos por game'}${m.decidingPoint ? ' · PUNTO DECISIVO' : ''} · versión ${m.version}`;
  toggleButtons();
}
function toggleButtons() { const disabled = !online || busy || !lastSnapshot || lastSnapshot.match.status !== 'live'; $('#buttons').querySelectorAll('button').forEach(b => b.disabled = disabled); $('#undo').disabled = !online || busy || !lastSnapshot || lastSnapshot.match.version < 2; }
async function poll() {
  if (!session) return; const active = session;
  try { const result = await api(`/screens/${active.screenId}/snapshot`, { token:active.token }); if (session !== active) return; online = true; $('#live').classList.remove('offline'); $('#connection').textContent = `Conectado al servicio local · ${new Date().toLocaleTimeString()}`; render(result); }
  catch { if (session !== active) return; online = false; $('#live').classList.add('offline'); $('#connection').textContent = 'Desconectado · último estado recibido, sin confirmar cambios'; toggleButtons(); }
  if (session === active) timer = setTimeout(poll, online ? 500 : 1500);
}
async function command(type, side) {
  if (!online || busy) return; busy = true; toggleButtons(); const active = session;
  try { await api(`/screens/${active.screenId}/commands`, { method:'POST', token:active.token, key:Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join(''), body:{ type, ...(side === undefined ? {} : { side }), expectedVersion:lastSnapshot.match.version } }); notice(); }
  catch (err) { notice(err.status === 409 ? `${err.message} No se aplicó esta pulsación.` : 'No se confirmó la operación. Revisa el marcador antes de volver a pulsar.'); }
  finally { busy = false; clearTimeout(timer); if (session === active) await poll(); }
}
$('#buttons').onclick = e => { if (e.target.dataset.point !== undefined) command('point', Number(e.target.dataset.point)); };
$('#undo').onclick = () => command('undo'); $('#leave').onclick = () => tab('control');
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('screen') && fragment.has('token')) { const s = {screenId:fragment.get('screen'),token:fragment.get('token')}; sessionStorage.setItem('sports-display', JSON.stringify(s)); history.replaceState(null,'',location.pathname); openLive(s); }
else { const saved = sessionStorage.getItem('sports-display') || sessionStorage.getItem('sports-control'); if (saved) { try { openLive(JSON.parse(saved)); } catch { sessionStorage.clear(); } } }
