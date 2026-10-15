// Motor determinista. Los formatos se congelan al crear el encuentro.
export class SportsError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
export function validateFormat(input) {
  const f = structuredClone(input);
  if (!f || !['tennis', 'padel'].includes(f.discipline)) throw new SportsError('Disciplina no soportada.');
  if (![1, 3, 5].includes(f.bestOf)) throw new SportsError('El formato debe ser al mejor de 1, 3 o 5 sets.');
  if (!['advantage', 'golden', 'star'].includes(f.deuce)) throw new SportsError('Regla de iguales inválida.');
  if (f.discipline === 'tennis' && f.deuce === 'star') throw new SportsError('Star Point está habilitado para pádel.');
  for (const rule of [f.set, f.decidingSet]) {
    if (!rule) throw new SportsError('Falta la regla del set normal o decisivo.');
    if (rule.kind === 'match_tiebreak') {
      if (rule !== f.decidingSet || f.bestOf === 1 || !integer(rule.points, 2, 50)) throw new SportsError('Supertiebreak decisivo inválido.');
    } else if (rule.kind === 'games') {
      if (!integer(rule.games, 2, 20)) throw new SportsError('Games por set: entre 2 y 20.');
      if (rule.tiebreakAt !== null && (!integer(rule.tiebreakAt, rule.games - 1, 30))) throw new SportsError('Umbral de tiebreak inválido.');
      // Un umbral superior al objetivo es inalcanzable con margen de dos games.
      if (rule.tiebreakAt !== null && rule.tiebreakAt > rule.games) throw new SportsError('El tiebreak debe comenzar en el objetivo o un game antes.');
      if (!integer(rule.tiebreakPoints, 2, 50)) throw new SportsError('Puntos de tiebreak inválidos.');
    } else throw new SportsError('Tipo de set inválido.');
  }
  return f;
}
const normalSet = () => ({ kind: 'games', games: 6, tiebreakAt: 6, tiebreakPoints: 7 });
export function presets() {
  const make = (id, name, discipline, bestOf, deuce, set = normalSet(), decidingSet = set) => ({ id, name, format: { discipline, bestOf, deuce, set: structuredClone(set), decidingSet: structuredClone(decidingSet) } });
  const pro = { kind: 'games', games: 8, tiebreakAt: 8, tiebreakPoints: 7 };
  return [
    make('tennis-3', 'Tenis · mejor de 3 sets', 'tennis', 3, 'advantage'),
    make('tennis-5', 'Tenis · mejor de 5 sets', 'tennis', 5, 'advantage'),
    make('tennis-super', 'Tenis · 2 sets + supertiebreak a 10', 'tennis', 3, 'advantage', normalSet(), { kind: 'match_tiebreak', points: 10 }),
    make('tennis-pro8', 'Tenis · proset a 8, TB en 8–8 (variante)', 'tennis', 1, 'advantage', pro),
    make('padel-adv', 'Pádel · mejor de 3, ventaja', 'padel', 3, 'advantage'),
    make('padel-golden', 'Pádel · mejor de 3, punto de oro', 'padel', 3, 'golden'),
    make('padel-star', 'Pádel · mejor de 3, Star Point', 'padel', 3, 'star'),
    make('padel-super', 'Pádel · 2 sets + supertiebreak a 10', 'padel', 3, 'golden', normalSet(), { kind: 'match_tiebreak', points: 10 })
  ];
}
export function initialState(format, firstServer = 0) {
  validateFormat(format);
  if (![0, 1].includes(firstServer)) throw new SportsError('Servidor inicial inválido.');
  return { points: [0, 0], games: [0, 0], setsWon: [0, 0], completedSets: [], phase: 'game', server: firstServer, tiebreakFirstServer: null, winner: null };
}
function currentRule(s, f) { return s.completedSets.length === f.bestOf - 1 ? f.decidingSet : f.set; }
function completeSet(s, f, side, kind, tiePoints = null) {
  s.completedSets.push({ games: [...s.games], kind, tiePoints: tiePoints && [...tiePoints], winner: side });
  s.setsWon[side]++;
  s.points = [0, 0]; s.games = [0, 0]; s.tiebreakFirstServer = null;
  if (s.setsWon[side] >= Math.floor(f.bestOf / 2) + 1) { s.phase = 'finished'; s.winner = side; return; }
  const rule = currentRule(s, f);
  s.phase = rule.kind === 'match_tiebreak' ? 'match_tiebreak' : 'game';
  if (s.phase === 'match_tiebreak') s.tiebreakFirstServer = s.server;
}
function winGame(s, f, side) {
  s.games[side]++; s.points = [0, 0]; s.server = 1 - s.server;
  const rule = currentRule(s, f);
  if (s.games[side] >= rule.games && s.games[side] - s.games[1 - side] >= 2) { completeSet(s, f, side, 'games'); return; }
  if (rule.tiebreakAt !== null && s.games.every(n => n === rule.tiebreakAt)) { s.phase = 'tiebreak'; s.tiebreakFirstServer = s.server; }
}
export function awardPoint(state, format, side) {
  if (![0, 1].includes(side)) throw new SportsError('Lado inválido.');
  if (state.phase === 'finished') throw new SportsError('El encuentro ya terminó.', 409);
  const s = structuredClone(state), other = 1 - side;
  s.points[side]++;
  if (s.phase === 'game') {
    const p = s.points;
    const deciding = (format.deuce === 'golden' && p[other] >= 3) || (format.deuce === 'star' && p[other] >= 5);
    if (p[side] >= 4 && (p[side] - p[other] >= 2 || (deciding && p[side] > p[other]))) winGame(s, format, side);
  } else {
    const rule = currentRule(s, format), target = s.phase === 'match_tiebreak' ? rule.points : rule.tiebreakPoints;
    if (s.points[side] >= target && s.points[side] - s.points[other] >= 2) {
      const kind = s.phase, tiePoints = [...s.points];
      s.server = 1 - s.tiebreakFirstServer;
      if (kind === 'tiebreak') s.games[side]++;
      completeSet(s, format, side, kind, tiePoints);
    } else {
      const played = s.points[0] + s.points[1];
      s.server = (Math.floor((played + 1) / 2) % 2 === 0) ? s.tiebreakFirstServer : 1 - s.tiebreakFirstServer;
    }
  }
  return s;
}
export function replay(format, points, firstServer = 0) {
  return points.reduce((s, side) => awardPoint(s, format, side), initialState(format, firstServer));
}
export function pointLabels(s, f) {
  if (s.phase !== 'game') return s.points.map(String);
  const [a, b] = s.points;
  if (a >= 3 && b >= 3) return a === b ? ['40', '40'] : (a > b ? ['AD', '40'] : ['40', 'AD']);
  return s.points.map(p => ['0', '15', '30', '40'][p]);
}
export function isDecidingPoint(s, f) {
  return s.phase === 'game' && s.points[0] === s.points[1] && ((f.deuce === 'golden' && s.points[0] === 3) || (f.deuce === 'star' && s.points[0] === 5));
}
