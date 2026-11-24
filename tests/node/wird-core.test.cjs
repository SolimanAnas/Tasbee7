// Unit tests for js/wird-core.js — the Qur'an wird shared by ثبات and the text
// mushaf. Run: node tests/node/wird-core.test.cjs
'use strict';
const path = require('path');
const assert = require('assert');
const W = require(path.join(__dirname, '..', '..', 'js', 'wird-core.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
const wird = (q) => ({ id: 'j1', kind: 'quran', name: 'w', streaks: [{ start: 0 }], quran: Object.assign({ daily: 4, pos: 1, start: 1, khatmat: 0, log: {} }, q) });
const T0 = '2026-03-10';

test('without a goal the daily amount is the set one, and any reading completes the day', () => {
  const j = wird({ daily: 4, pos: 10 });
  assert.deepStrictEqual([W.dailyFor(j, T0), W.today(j, T0).from, W.today(j, T0).to], [4, 10, 13]);
  j.quran.log[T0] = 2; j.quran.pos = 12;
  const t = W.today(j, T0);
  assert.strictEqual(t.from, 10);            // where the day began
  assert.strictEqual(t.done, true);
});

test('a goal spreads the pages left over the days left, counted from the start of the day', () => {
  const j = wird({ pos: 1 });
  W.setGoal(j, 30, T0);                       // a khatma in 30 days
  assert.strictEqual(j.quran.goal.end, '2026-04-08');
  assert.strictEqual(W.dailyFor(j, T0), Math.ceil(604 / 30));   // 21
  // reading during the day does not move today's target
  W.record(j, 10, T0); j.quran.log = { [T0]: 10 };
  assert.strictEqual(W.dailyFor(j, T0), 21);
  assert.strictEqual(W.today(j, T0).done, false);
  assert.strictEqual(W.today(j, T0).left, 11);
});

test('a missed day raises the following targets; extra reading lowers them', () => {
  const j = wird({ pos: 1 });
  W.setGoal(j, 30, T0);
  const next = W.addDays(T0, 2);              // two days later, nothing read
  assert.strictEqual(W.dailyFor(j, next), Math.ceil(604 / 28));
  j.quran.pos = 301;                          // read half already
  assert.strictEqual(W.dailyFor(j, next), Math.ceil(304 / 28));
});

test('past the end date the target is everything left, and it says so', () => {
  const j = wird({ pos: 500 });
  j.quran.goal = { days: 10, end: '2026-03-01' };
  const t = W.today(j, T0);
  assert.strictEqual(t.target, 105);
  assert.strictEqual(t.overdue, true);
});

test('completing a khatma counts it, wraps to page 1 and renews the goal', () => {
  const j = wird({ pos: 600 });
  W.setGoal(j, 30, T0);
  const today = W.dayKey();
  const r = W.record(j, 10);
  assert.strictEqual(r.khatma, true);
  assert.strictEqual(j.quran.khatmat, 1);
  assert.strictEqual(j.quran.pos, 6);
  assert.strictEqual(j.quran.goal.days, 30);
  assert.strictEqual(j.quran.goal.end, W.addDays(today, 30));
});

test('undo restores the day, the place, the khatma count and the goal', () => {
  const j = wird({ pos: 600 });
  W.setGoal(j, 30, T0);
  const before = JSON.parse(JSON.stringify(j.quran));
  W.record(j, 10);
  assert.strictEqual(W.undo(j), true);
  delete before.undo;
  assert.deepStrictEqual(j.quran, before);
  assert.strictEqual(W.undo(j), false);       // only once
});

test('a make-up for yesterday is recorded on yesterday', () => {
  const j = wird({ pos: 20 });
  const y = W.addDays(W.dayKey(), -1);
  W.record(j, 4, y);
  assert.deepStrictEqual(j.quran.log, { [y]: 4 });
  assert.strictEqual(j.quran.pos, 24);
});

test('the wird is found among other journeys; storage round-trips', () => {
  const mem = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  assert.strictEqual(W.load(mem), null);
  const S = { journeys: [{ id: 'a', kind: 'quit', streaks: [{ start: 0 }] }, wird({ pos: 77 })], settings: {} };
  W.save(S, mem);
  const back = W.load(mem);
  assert.strictEqual(W.wirdOf(back).quran.pos, 77);
  assert.strictEqual(W.wirdOf({ journeys: [] }), null);
});

console.log(process.exitCode ? 'some tests failed' : passed + ' tests passed');
