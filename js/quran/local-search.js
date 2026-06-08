/* local-search.js — Offline Quran search using quran.json */
const LocalSearch = (function () {
  'use strict';

  let _data = null;
  let _loaded = false;
  let _loading = false;

  function normalizeArabic(text) {
    if (!text) return '';
    return text
      .replace(/[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
      .replace(/[\u0623\u0621\u0622\u0671]/g, '\u0627')
      .replace(/[\u0649\u064A]/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      .replace(/[\u0640\u200C\u200D]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function load() {
    if (_loaded || _loading) return;
    _loading = true;
    try {
      const res = await fetch('./data/quran.json');
      if (res.ok) {
        _data = await res.json();
        _loaded = true;
      }
    } catch (_) {}
    _loading = false;
  }

  function search(query, maxResults) {
    maxResults = maxResults || 25;
    if (!_data || !query || query.length < 2) return [];

    const normalized = normalizeArabic(query);
    if (normalized.length < 2) return [];

    const results = [];
    for (let i = 0; i < _data.length; i++) {
      const entry = _data[i];
      const cleanText = normalizeArabic(entry.text_clean || '');
      if (cleanText.includes(normalized)) {
        results.push({
          surah: entry.surah,
          ayah: entry.ayah,
          text: entry.text_uthmani || entry.text_clean,
          surahName: entry.surah_name_en || ('سورة ' + entry.surah),
          number: ((entry.surah - 1) * 1000) + entry.ayah // approximate global ayah number
        });
        if (results.length >= maxResults) break;
      }
    }
    return results;
  }

  function isAvailable() {
    return _loaded && _data && _data.length > 0;
  }

  function getAyahCount() {
    return _data ? _data.length : 0;
  }

  return { load, search, isAvailable, getAyahCount, normalizeArabic };
})();
