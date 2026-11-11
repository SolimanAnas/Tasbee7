/* quran-text-source.js — where the text mushaf gets a page from.
 *
 * The page is laid out from the app's own verified Quran text
 * (data/quran.json, checksum-gated in CI) and its own page map
 * (data/quran-pages.json). The network is an enhancement, not the source:
 *
 *   • which ayahs are on a page, their numbers, order and surah names always
 *     come from the local files — never from the position of an item in an
 *     API response;
 *   • text fetched for a particular font (the Madinah font needs its own
 *     encoding of the same words) is shown only when, ayah by ayah, its
 *     letters are exactly the letters of the local text and it contains
 *     nothing but Arabic script. If any ayah on the page differs or is
 *     missing, the whole page is shown from the local text;
 *   • with no connection the page is the local text. Only the recitation
 *     (audio URLs) needs the network.
 *
 * This file never changes the Quran text: it selects which copy to show and
 * removes the basmala that data/quran.json prefixes to the first ayah of a
 * surah (the page draws the basmala as its own line).
 *
 * Classic script, no dependencies. Also loadable from Node for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuranTextSource = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAGGER_ALEF = 0x0670;
  const HAMZA = 0x0621;
  const TATWEEL = 0x0640;
  const ALEF = 0x0627;
  const YEH = 0x064A;
  const ALEF_MAQSURA = 0x0649;
  // Carrier forms folded to the letter they are written on, so that two
  // spellings of the same word in different Unicode encodings compare equal.
  const FOLD = {
    0x0622: ALEF, 0x0623: ALEF, 0x0625: ALEF, 0x0671: ALEF, // آ أ إ ٱ
    0x0649: YEH, 0x0626: YEH,                               // ى ئ
    0x0624: 0x0648,                                         // ؤ
    0x0629: 0x0647                                          // ة
  };

  /**
   * The consonantal skeleton of a piece of Quran text: its letters in order,
   * without vowel marks, pause signs, numbers or spaces.
   *
   * Two encodings of the same ayah (Tanzil Uthmani, Quran.com Uthmani and the
   * King Fahd Complex "QPC Hafs" text) all reduce to the same string — checked
   * for all 6,236 ayahs. A wrong, shifted, truncated or altered ayah does not.
   *
   * Encoding differences absorbed here, and nothing else:
   *   – hamza written on its own (ء) or on a carrier, and the tatweel some
   *     encodings put under a floating hamza or dagger alef;
   *   – a "tooth" yeh that only carries a dagger alef (يَٰصَىٰحِبَىِ in 12:39
   *     and 12:41), which other encodings write without the carrier.
   */
  function letters(text) {
    const s = String(text == null ? '' : text);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === HAMZA || c === TATWEEL) continue;
      if (c === ALEF_MAQSURA && s.charCodeAt(i + 1) === DAGGER_ALEF) continue;
      if ((c >= 0x0621 && c <= 0x064A) || c === 0x0671) out += String.fromCharCode(FOLD[c] || c);
    }
    return out;
  }

  /**
   * True when a string contains nothing but Arabic-script characters and
   * spaces — all that any encoding of the Quran text uses (checked against
   * every ayah of both remote encodings). Anything else in fetched text
   * (Latin letters, markup, control characters) is not Quran text.
   */
  function isQuranScript(text) {
    if (typeof text !== 'string' || !text) return false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (!((c >= 0x0600 && c <= 0x06FF) || c === 0x0020 || c === 0x00A0)) return false;
    }
    return true;
  }

  const BASMALA_WORDS = 4;

  /** data/quran.json text of an ayah, without the prefixed basmala. */
  function ayahOwnText(entry) {
    const text = String(entry.text_uthmani || '').trim();
    if (entry.ayah !== 1 || entry.surah === 1 || entry.surah === 9) return text;
    const words = text.split(/\s+/);
    return words.length > BASMALA_WORDS ? words.slice(BASMALA_WORDS).join(' ') : text;
  }

  /**
   * Index the two local files.
   * @param {Array} quran  data/quran.json
   * @param {{pages:number[][], medinan:number[]}} pageMap  data/quran-pages.json
   */
  function createIndex(quran, pageMap) {
    if (!Array.isArray(quran) || quran.length !== 6236) throw new Error('quran.json: unexpected content');
    if (!pageMap || !Array.isArray(pageMap.pages) || pageMap.pages.length !== 604) throw new Error('quran-pages.json: unexpected content');

    const indexOf = new Map(); // "surah:ayah" → position in quran[]
    const surahAyahs = {};
    for (let i = 0; i < quran.length; i++) {
      const v = quran[i];
      indexOf.set(v.surah + ':' + v.ayah, i);
      surahAyahs[v.surah] = v.ayah; // entries are in order, so the last one wins
    }
    const medinan = new Set(pageMap.medinan || []);
    const starts = pageMap.pages.map(([s, a]) => {
      const i = indexOf.get(s + ':' + a);
      if (i === undefined) throw new Error('quran-pages.json: unknown ayah ' + s + ':' + a);
      return i;
    });

    /** Every ayah that begins on a page, in mushaf order. */
    function pageAyahs(page) {
      if (!(page >= 1 && page <= 604)) return [];
      const from = starts[page - 1];
      const to = page < 604 ? starts[page] : quran.length;
      const list = [];
      for (let i = from; i < to; i++) {
        const v = quran[i];
        list.push({
          key: v.surah + ':' + v.ayah,
          number: i + 1,                 // position in the whole mushaf, 1…6236
          surah: v.surah,
          numberInSurah: v.ayah,
          surahName: v.surah_name,
          numberOfAyahs: surahAyahs[v.surah],
          meccan: !medinan.has(v.surah),
          text: ayahOwnText(v)
        });
      }
      return list;
    }

    return { pageAyahs: pageAyahs };
  }

  /**
   * Decide what a page shows.
   *
   * @param {Array}  localAyahs  pageAyahs(page)
   * @param {Object|null} remote  { textByKey: {"2:255": "…"}, audioByKey: {"2:255": "https://…"} }
   * @returns {{ayahs:Array, audio:Array, source:'remote'|'local', rejected:string|null}}
   *   source 'remote': every ayah's fetched text passed the letter check and is used;
   *   source 'local' : the local text is used for the whole page. `rejected`
   *   names the first ayah whose fetched text was missing or different (null
   *   when there simply was nothing fetched).
   */
  function composePage(localAyahs, remote) {
    const textByKey = (remote && remote.textByKey) || null;
    const audioByKey = (remote && remote.audioByKey) || {};
    let rejected = null;
    let useRemote = !!textByKey;

    if (useRemote) {
      for (const a of localAyahs) {
        const candidate = textByKey[a.key];
        if (!isQuranScript(candidate) || letters(candidate) !== letters(a.text)) {
          useRemote = false;
          rejected = a.key;
          break;
        }
      }
    }

    return {
      ayahs: localAyahs.map(a => Object.assign({}, a, { text: useRemote ? textByKey[a.key] : a.text })),
      audio: localAyahs.map(a => (typeof audioByKey[a.key] === 'string' ? audioByKey[a.key] : null)),
      source: useRemote ? 'remote' : 'local',
      rejected: rejected
    };
  }

  // ---- browser side: loading -------------------------------------------------

  let indexPromise = null;

  /** Loads and indexes the local files once. Rejects if they can't be read. */
  function loadIndex(base) {
    if (!indexPromise) {
      const get = name => fetch((base || '../') + 'data/' + name).then(r => {
        if (!r.ok) throw new Error(name + ': HTTP ' + r.status);
        return r.json();
      });
      indexPromise = Promise.all([get('quran.json'), get('quran-pages.json')])
        .then(([quran, pageMap]) => createIndex(quran, pageMap));
      indexPromise.catch(() => { indexPromise = null; }); // allow a later retry
    }
    return indexPromise;
  }

  function fetchJson(url, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 12000) : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(r => r.json())
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  /**
   * Fetch the optional network parts of a page. Never rejects: whatever is
   * unavailable is simply absent.
   * @param {'qpc'|'uthmani'} encoding  which text the chosen font needs
   */
  function fetchRemote(page, reciter, encoding) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);

    const text = fetchJson('https://api.quran.com/api/v4/verses/by_page/' + page +
      '?words=false&fields=text_qpc_hafs,text_uthmani&per_page=50').then(data => {
      if (!data || !Array.isArray(data.verses)) return null;
      const byKey = {};
      for (const v of data.verses) {
        const t = encoding === 'qpc' ? (v.text_qpc_hafs || v.text_uthmani) : v.text_uthmani;
        if (v && typeof v.verse_key === 'string' && typeof t === 'string') byKey[v.verse_key] = t;
      }
      return byKey;
    }).catch(() => null);

    const audio = fetchJson('https://api.alquran.cloud/v1/page/' + page + '/' + encodeURIComponent(reciter)).then(data => {
      if (!data || data.code !== 200 || !data.data || !Array.isArray(data.data.ayahs)) return null;
      const byKey = {};
      for (const a of data.data.ayahs) {
        if (a && a.surah && typeof a.audio === 'string' && /^https:\/\//.test(a.audio)) {
          byKey[a.surah.number + ':' + a.numberInSurah] = a.audio;
        }
      }
      return byKey;
    }).catch(() => null);

    return Promise.all([text, audio]).then(([textByKey, audioByKey]) =>
      (textByKey || audioByKey) ? { textByKey: textByKey, audioByKey: audioByKey || {} } : null);
  }

  /** A page ready to render: local layout, verified text, audio when available. */
  function getPage(page, reciter, encoding, base) {
    return Promise.all([loadIndex(base), fetchRemote(page, reciter, encoding)]).then(([index, remote]) => {
      const result = composePage(index.pageAyahs(page), remote);
      if (result.rejected && typeof console !== 'undefined') {
        console.warn('Quran text: fetched text for ' + result.rejected + ' did not match the local text — page ' + page + ' shown from the local copy.');
      }
      return result;
    });
  }

  return {
    letters: letters,
    isQuranScript: isQuranScript,
    ayahOwnText: ayahOwnText,
    createIndex: createIndex,
    composePage: composePage,
    loadIndex: loadIndex,
    getPage: getPage
  };
});
