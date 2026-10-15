import test from 'node:test';
import assert from 'node:assert/strict';
import { presets, validateFormat, initialState, awardPoint, pointLabels, isDecidingPoint } from '../src/engine.js';
const fmt = id => structuredClone(presets().find(p => p.id === id).format);
function harness(f) {
  let s = initialState(f);
  return { get s() { return s; }, point(side) { s = awardPoint(s,f,side); }, game(side) { for (let i=0;i<4;i++) this.point(side); }, set(side) { for(let i=0;i<f.set.games;i++) this.game(side); } };
}
test('0/15/30/40, ventaja, iguales y game', () => {
  const f=fmt('tennis-3'), h=harness(f);
  for (const expected of ['15','30','40']) { h.point(0); assert.equal(pointLabels(h.s,f)[0],expected); }
  for(let i=0;i<3;i++) h.point(1);
  h.point(0); assert.deepEqual(pointLabels(h.s,f),['AD','40']); h.point(1);
  assert.deepEqual(pointLabels(h.s,f),['40','40']); h.point(1); h.point(1);
  assert.deepEqual(h.s.games,[0,1]); assert.deepEqual(h.s.points,[0,0]); assert.equal(h.s.server,1);
});
test('6–4, 7–5 y victoria al mejor de tres', () => {
  const h=harness(fmt('tennis-3'));
  for(let i=0;i<4;i++){h.game(0);h.game(1);} h.game(0);h.game(0);
  assert.deepEqual(h.s.completedSets[0].games,[6,4]);
  for(let i=0;i<5;i++){h.game(0);h.game(1);} h.game(0);h.game(0);
  assert.equal(h.s.winner,0); assert.deepEqual(h.s.completedSets[1].games,[7,5]);
  assert.throws(()=>h.point(1), /terminó/);
});
test('tiebreak en 6–6, 7–6 no cierra hasta 8–6; saque 1/2/2', () => {
  const h=harness(fmt('tennis-3'));
  for(let i=0;i<6;i++){h.game(0);h.game(1);}
  assert.equal(h.s.phase,'tiebreak'); assert.equal(h.s.server,0);
  h.point(0); assert.equal(h.s.server,1); h.point(1); assert.equal(h.s.server,1); h.point(0); assert.equal(h.s.server,0); h.point(1);
  for(let i=0;i<4;i++){h.point(0);h.point(1);} // 6–6
  h.point(0); assert.equal(h.s.phase,'tiebreak'); h.point(0);
  assert.deepEqual(h.s.completedSets[0].games,[7,6]); assert.deepEqual(h.s.completedSets[0].tiePoints,[8,6]); assert.equal(h.s.server,1);
});
test('2 sets + supertiebreak solo si quedan 1–1; 10–9 continúa', () => {
  const h=harness(fmt('tennis-super')); h.set(0); h.set(1);
  assert.equal(h.s.phase,'match_tiebreak'); for(let i=0;i<9;i++){h.point(0);h.point(1);} h.point(0);
  assert.equal(h.s.winner,null); h.point(0); assert.equal(h.s.winner,0);
  assert.equal(h.s.completedSets[2].kind,'match_tiebreak'); assert.deepEqual(h.s.completedSets[2].tiePoints,[11,9]);
  const straight=harness(fmt('tennis-super')); straight.set(0);straight.set(0); assert.equal(straight.s.winner,0); assert.equal(straight.s.completedSets.length,2);
});
test('mejor de cinco necesita tres sets; decisivo configurable', () => {
  const f=fmt('tennis-5'); f.decidingSet.tiebreakPoints=10; const h=harness(f); h.set(0);h.set(0);assert.equal(h.s.winner,null);h.set(1);h.set(1);h.set(0);assert.equal(h.s.winner,0);
});
test('proset configurable a 8 y tiebreak en 8–8', () => {
  const h=harness(fmt('tennis-pro8')); for(let i=0;i<8;i++){h.game(0);h.game(1);} assert.equal(h.s.phase,'tiebreak'); for(let i=0;i<7;i++)h.point(1);
  assert.equal(h.s.winner,1);assert.deepEqual(h.s.completedSets[0].games,[8,9]);
});
test('proset puede definir tiebreak en 7–7', () => {
  const f=fmt('tennis-pro8');f.set.tiebreakAt=7;f.decidingSet=structuredClone(f.set);const h=harness(f);
  for(let i=0;i<7;i++){h.game(0);h.game(1);} for(let i=0;i<7;i++)h.point(0);
  assert.deepEqual(h.s.completedSets[0].games,[8,7]);assert.equal(h.s.winner,0);
});
test('punto de oro decide después de 40–40', () => {
  const f=fmt('padel-golden'),h=harness(f);for(let i=0;i<3;i++){h.point(0);h.point(1);}assert.ok(isDecidingPoint(h.s,f));h.point(1);assert.deepEqual(h.s.games,[0,1]);
});
test('Star Point permite dos ventajas y decide al tercer iguales', () => {
  const f=fmt('padel-star'),h=harness(f);for(let i=0;i<3;i++){h.point(0);h.point(1);}assert.equal(isDecidingPoint(h.s,f),false);
  for(let i=0;i<2;i++){h.point(0);h.point(1);}assert.ok(isDecidingPoint(h.s,f));h.point(1);assert.deepEqual(h.s.games,[0,1]);
  const early=harness(f);for(let i=0;i<3;i++){early.point(0);early.point(1);}early.point(0);early.point(0);assert.deepEqual(early.s.games,[1,0]);
});
test('set sin tiebreak continúa en 6–6 y cierra con dos games', () => {
  const f=fmt('tennis-3'); f.set.tiebreakAt=null; f.decidingSet=structuredClone(f.set); const h=harness(f);for(let i=0;i<6;i++){h.game(0);h.game(1);}assert.equal(h.s.phase,'game');h.game(1);h.game(1);assert.deepEqual(h.s.completedSets[0].games,[6,8]);
});
test('set corto a 3 games, tiebreak a 3–3', () => {
  const f=fmt('tennis-3');f.set.games=3;f.set.tiebreakAt=3;f.decidingSet=structuredClone(f.set);const h=harness(f);h.set(0);assert.deepEqual(h.s.completedSets[0].games,[3,0]);
});
test('motor no muta entrada y rechaza formatos incoherentes', () => {
  const f=fmt('tennis-3'),s=initialState(f);awardPoint(s,f,0);assert.deepEqual(s.points,[0,0]);
  for(const mutate of [x=>x.bestOf=2,x=>x.discipline='football',x=>x.deuce='star',x=>x.set.tiebreakAt=10,x=>x.set.games=0,x=>x.decidingSet={kind:'match_tiebreak',points:0}]){const x=fmt('tennis-3');mutate(x);assert.throws(()=>validateFormat(x));}
});
test('set decisivo puede tener tiebreak a 10 sin alterar los demás', () => {
  const f=fmt('tennis-3'); f.decidingSet.tiebreakPoints=10; assert.equal(f.set.tiebreakPoints,7); const h=harness(f);h.set(0);h.set(1);
  for(let i=0;i<6;i++){h.game(0);h.game(1);}for(let i=0;i<7;i++)h.point(0);assert.equal(h.s.winner,null);for(let i=0;i<3;i++)h.point(0);assert.equal(h.s.winner,0);
});
