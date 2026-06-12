/* TasmeeStore — offline IndexedDB persistence for Tasmee' Pro (F6, F7, F9).
 *
 * Stores:
 *   sessions  {id, date, surah, fromAyah, toAyah, correct, fuzzy, missed, total,
 *              accuracy, mistakes, durationSec}
 *   mistakes  {id, date, surah, ayah, word, type: 'missing'|'wrong'|'extra', key}
 *   revisions {key:"surah:ayah", surah, ayah, level, dueDate, ease, lapses, lastReviewed}
 *
 * No audio is ever stored. Classic script → global `TasmeeStore` (+ CommonJS).
 */
(function (global: typeof globalThis) {
  'use strict';

  const DB_NAME = 'tasmeePro';
  const DB_VER = 1;
  let _dbPromise: Promise<IDBDatabase> | null = null;

  interface SessionRecord {
    id?: number;
    date: number;
    surah?: number;
    fromAyah?: number;
    toAyah?: number;
    correct?: number;
    fuzzy?: number;
    missed?: number;
    total?: number;
    accuracy?: number;
    mistakes?: MistakeRecord[];
    durationSec?: number;
  }

  interface MistakeRecord {
    id?: number;
    date?: number;
    surah: number | null;
    ayah: number | null;
    word: string;
    type: 'missing' | 'wrong' | 'extra';
    key?: string | null;
  }

  interface RevisionRecord {
    key: string;
    surah: number;
    ayah: number;
    level: number;
    dueDate: number;
    ease: number;
    lapses: number;
    lastReviewed: number;
  }

  interface AggregateResult {
    totalSessions: number;
    totalTimeSec: number;
    avgAccuracy: number;
    streak: number;
    weekly: { day: string; count: number }[];
    weakWords: { word: string; count: number }[];
    totalMistakes: number;
  }

  function _open(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
          s.createIndex('surah', 'surah');
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          const m = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
          m.createIndex('type', 'type');
          m.createIndex('surah', 'surah');
          m.createIndex('key', 'key');
        }
        if (!db.objectStoreNames.contains('revisions')) {
          const r = db.createObjectStore('revisions', { keyPath: 'key' });
          r.createIndex('dueDate', 'dueDate');
        }
      };
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function _reqP<T>(r: IDBRequest<T>): Promise<T> {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  async function _store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await _open();
    return db.transaction(name, mode).objectStore(name);
  }
  function _dayKey(ts: number): string {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const TasmeeStore = {
    available(): boolean { return !!global.indexedDB; },

    async addSession(rec: Omit<SessionRecord, 'date'>): Promise<number> {
      const os = await _store('sessions', 'readwrite');
      return _reqP(os.add(Object.assign({ date: Date.now() }, rec)) as IDBRequest<number>);
    },

    async addMistakes(arr: MistakeRecord[]): Promise<void> {
      if (!arr || !arr.length) return;
      const db = await _open();
      return new Promise((res, rej) => {
        const t = db.transaction('mistakes', 'readwrite');
        const os = t.objectStore('mistakes');
        arr.forEach(m => os.add(Object.assign({
          date: Date.now(),
          key: (m.surah != null && m.ayah != null) ? (m.surah + ':' + m.ayah) : null
        }, m)));
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
    },

    async getAllSessions(): Promise<SessionRecord[]> { return _reqP((await _store('sessions', 'readonly')).getAll()); },
    async getAllMistakes(): Promise<MistakeRecord[]> { return _reqP((await _store('mistakes', 'readonly')).getAll()); },

    async getRevision(key: string): Promise<RevisionRecord | undefined> { return _reqP((await _store('revisions', 'readonly')).get(key)); },
    async putRevision(rec: RevisionRecord): Promise<void> { await _reqP((await _store('revisions', 'readwrite')).put(rec)); },
    async getAllRevisions(): Promise<RevisionRecord[]> { return _reqP((await _store('revisions', 'readonly')).getAll()); },
    async getDueRevisions(now?: number): Promise<RevisionRecord[]> {
      const all = await this.getAllRevisions();
      const t = now || Date.now();
      return all.filter(r => r.dueDate <= t).sort((a, b) => a.dueDate - b.dueDate);
    },

    async aggregate(): Promise<AggregateResult> {
      let sessions: SessionRecord[] = [], mistakes: MistakeRecord[] = [];
      try { sessions = await this.getAllSessions(); } catch (_) {}
      try { mistakes = await this.getAllMistakes(); } catch (_) {}

      const totalSessions = sessions.length;
      const totalTimeSec = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
      const accs = sessions.map(s => s.accuracy).filter((a): a is number => typeof a === 'number');
      const avgAccuracy = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;

      const days = new Set(sessions.map(s => _dayKey(s.date)));
      let streak = 0; const d = new Date();
      while (days.has(_dayKey(d.getTime()))) { streak++; d.setDate(d.getDate() - 1); }

      const weekly: { day: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(); dt.setDate(dt.getDate() - i);
        const k = _dayKey(dt.getTime());
        weekly.push({ day: k, count: sessions.filter(s => _dayKey(s.date) === k).length });
      }

      const freq: Record<string, number> = {};
      mistakes.forEach(m => { if (m.word) freq[m.word] = (freq[m.word] || 0) + 1; });
      const weakWords = Object.keys(freq).map(w => ({ word: w, count: freq[w] }))
        .sort((a, b) => b.count - a.count).slice(0, 10);

      return { totalSessions, totalTimeSec, avgAccuracy, streak, weekly, weakWords, totalMistakes: mistakes.length };
    },

    async clearAll(): Promise<void> {
      const db = await _open();
      return new Promise((res, rej) => {
        const t = db.transaction(['sessions', 'mistakes', 'revisions'], 'readwrite');
        t.objectStore('sessions').clear();
        t.objectStore('mistakes').clear();
        t.objectStore('revisions').clear();
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
    }
  };

  (global as any).TasmeeStore = TasmeeStore;
  if (typeof module !== 'undefined' && (module as any).exports) (module as any).exports = TasmeeStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
