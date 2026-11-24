/* wird-core.js — the Qur'an wird of «ثبات», shared by pages/thabat.html (where it
   is set up and followed) and pages/quran-text.html (where it is read).

   The wird lives in the ثبات journeys (localStorage thabat_v1, kind 'quran'):
     quran: { daily, pos, start, khatmat, log: { 'YYYY-MM-DD': pages }, undo?, goal? }
   pos is the next page to read (1…604), log the pages recorded per day.

   A khatma goal (optional) — goal: { days, end: 'YYYY-MM-DD' } — sets today's
   target from where the reader stood at the start of the day: the pages left in
   this khatma spread over the days left up to and including the end date. A day
   missed or a day of extra reading simply moves the target; nothing is lost.
   When a khatma is completed the goal starts over for the next one, same length.

   Classic script, no dependencies; also loadable from Node for tests. */
/* global module */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WirdCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'thabat_v1';
  const PAGES = 604;
  const DAY = 864e5;
  const two = n => String(n).padStart(2, '0');

  const dayKey = t => { const d = new Date(t == null ? Date.now() : t); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };
  const noonOf = k => new Date(k + 'T12:00').getTime();
  const noon = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); };
  // whole days from day a to day b (both 'YYYY-MM-DD'); DST-safe through noon times
  const daysBetween = (a, b) => Math.round((noonOf(b) - noonOf(a)) / DAY);
  const addDays = (k, n) => dayKey(noonOf(k) + n * DAY);

  function load(storage) {
    const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    try {
      const d = st && JSON.parse(st.getItem(KEY) || 'null');
      if (d && Array.isArray(d.journeys)) return d;
    } catch { /* private mode or bad data */ }
    return null;
  }
  function save(S, storage) {
    const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    st.setItem(KEY, JSON.stringify(S));
  }
  const isWird = j => !!j && j.kind === 'quran' && !!j.quran;
  // The reader's wird: the first Qur'an journey (the app makes one at a time).
  const wirdOf = S => (S && S.journeys ? S.journeys.find(isWird) || null : null);

  // Where the reader stood when today began: today's recorded pages taken back.
  function posAtDayStart(Q, today) {
    let p = Q.pos - (Q.log[today] || 0);
    while (p < 1) p += PAGES;          // today's reading crossed into a new khatma
    return p;
  }
  function goalDaysLeft(Q, today) {
    if (!Q.goal || !Q.goal.end) return 0;
    return daysBetween(today, Q.goal.end) + 1;   // today included
  }
  // Pages to read today: the goal's share when there is a goal, else the set daily amount.
  function dailyFor(j, today) {
    const Q = j.quran;
    today = today || dayKey();
    if (!Q.goal || !Q.goal.end) return Math.max(1, Q.daily | 0);
    const left = PAGES - posAtDayStart(Q, today) + 1;
    const days = Math.max(1, goalDaysLeft(Q, today));
    return Math.max(1, Math.ceil(left / days));
  }
  // Today's wird: its pages, how much of it is recorded, and the goal's state.
  function today(j, k) {
    const Q = j.quran;
    k = k || dayKey();
    const target = dailyFor(j, k);
    const from = posAtDayStart(Q, k);
    const read = Q.log[k] || 0;
    return {
      from, to: Math.min(PAGES, from + target - 1), target, read,
      // without a goal any reading recorded today completes the day (as before goals existed)
      done: Q.goal ? read >= target : read > 0,
      left: Math.max(0, target - read),     // what is left of today's target (it may run into the next khatma)
      daysLeft: Q.goal ? goalDaysLeft(Q, k) : null,
      overdue: !!(Q.goal && goalDaysLeft(Q, k) < 1),
    };
  }
  // A goal of `days` days from today (1–3650), or none.
  function setGoal(j, days, k) {
    days = Math.round(+days);
    if (!(days >= 1)) { delete j.quran.goal; return; }
    days = Math.min(3650, days);
    k = k || dayKey();
    j.quran.goal = { days, end: addDays(k, days - 1) };
    j.quran.daily = dailyFor(j, k);      // the plain amount follows the goal's first day
  }
  // Record n pages on day k (today, or yesterday as a make-up). Returns
  // { khatma: true } when this completes the Qur'an. Keeps one undo per day.
  function record(j, n, k) {
    const Q = j.quran;
    n = Math.max(1, Math.min(PAGES, Math.round(+n) || 1));
    const t = dayKey();
    k = k || t;
    Q.undo = { k: t, day: k, pos: Q.pos, khatmat: Q.khatmat, prev: Q.log[k] || 0, goal: Q.goal ? Object.assign({}, Q.goal) : null };
    Q.log[k] = (Q.log[k] || 0) + n;
    Q.pos += n;
    let khatma = false;
    if (Q.pos > PAGES) {
      Q.khatmat++;
      Q.pos = ((Q.pos - 1) % PAGES) + 1;
      khatma = true;
      if (Q.goal && Q.goal.days) Q.goal = { days: Q.goal.days, end: addDays(t, Q.goal.days) };   // the next khatma starts tomorrow
    }
    return { khatma };
  }
  function undo(j) {
    const Q = j.quran, u = Q.undo;
    if (!u || u.k !== dayKey()) return false;
    if (u.prev) Q.log[u.day] = u.prev; else delete Q.log[u.day];
    Q.pos = u.pos; Q.khatmat = u.khatmat;
    if (u.goal) Q.goal = u.goal; else if ('goal' in u) delete Q.goal;
    delete Q.undo;
    return true;
  }

  return { KEY, PAGES, dayKey, noon, daysBetween, addDays, load, save, isWird, wirdOf, posAtDayStart, dailyFor, today, setGoal, record, undo };
});
