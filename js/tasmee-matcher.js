/* AUTO-GENERATED from tasmee-matcher.ts — do not edit directly. Regenerate: node scripts/transpile-tasmee.cjs */
"use strict";
/* TasmeeMatcher — DOM-free, engine-agnostic word-by-word alignment brain.
 *
 * Extracted from TasmeeEngine (js/tasmee-engine.js) so the same proven matching
 * logic (Arabic normalisation, tajweed variants, idgham fusion, fuzzy match) can
 * be driven by the OFFLINE ONNX recogniser's transcript instead of the browser
 * Web-Speech API, and can render to the Mushaf image instead of DOM text spans.
 *
 * It is streaming-safe: the recogniser emits OVERLAPPING ~8s transcript windows
 * every ~1.8s, so feedTranscript() re-anchors at the current position each tick
 * and only ever advances forward — overlapping words are not double-counted.
 *
 * Usage (classic script — defines global TasmeeMatcher; also CommonJS for tests):
 *   const m = new TasmeeMatcher({ onWord, onExtra, onAyahComplete });
 *   m.buildFromAyahs([{ surah, ayah, text }, ...]);   // text = uthmani
 *   m.feedTranscript("الحمد لله رب");                 // call per recognition tick
 *   m.score();                                         // {correct,fuzzy,missed,total,pct}
 */
(function (global) {
    'use strict';
    const TASHKEEL_RE = /[\u064B-\u065F\u0610-\u061A\u06D6-\u06DC\u06DF-\u06EA\u06E4\u06E7\u06E8-\u06ED]/g; // diacritics ONLY — \u escapes because an RTL-edited literal class once corrupted the ranges to eat all letters
    const ZEROWIDTH_RE = /[​‌‍﻿]/g;
    const NUM_MARK_RE = /[٠-٩۰-۹۝࣢]/g;
    const WAQF_RE = /[ۖ-ۭ]/g;
    class TasmeeMatcher {
        constructor({ onWord, onExtra, onAyahComplete } = {}) {
            this.onWord = onWord;
            this.onExtra = onExtra;
            this.onAyahComplete = onAyahComplete;
            this._tokens = [];
            this._expectedIdx = 0;
            this._extras = [];
            this._completedAyahs = new Set();
        }
        normArabic(str) {
            if (!str)
                return '';
            return str
                .replace(/ٰ/g, 'ا')
                .replace(WAQF_RE, '')
                .replace(TASHKEEL_RE, '')
                .replace(ZEROWIDTH_RE, '')
                .replace(NUM_MARK_RE, '')
                .replace(/[أإآٱ]/g, 'ا')
                .replace(/[ىئ]/g, 'ي')
                .replace(/ة/g, 'ه')
                .replace(/ؤ/g, 'و')
                .replace(/ـ/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
        _tokenizeText(str) {
            if (!str)
                return [];
            return String(str)
                .replace(ZEROWIDTH_RE, ' ')
                .replace(NUM_MARK_RE, ' ')
                .replace(WAQF_RE, '')
                .split(/\s+/)
                .map(w => w.trim())
                .filter(Boolean);
        }
        _tajweedVariants(norm, nextNorm) {
            const variants = new Set([norm]);
            if (!norm)
                return variants;
            const last = norm[norm.length - 1];
            const nextFirst = nextNorm ? nextNorm[0] : '';
            if (last === 'ن' && nextFirst === 'ب')
                variants.add(norm.slice(0, -1) + 'م');
            if (last === 'ن' && 'ينمو'.includes(nextFirst) && nextFirst)
                variants.add(norm.slice(0, -1));
            if (last === 'ن' && 'لر'.includes(nextFirst) && nextFirst)
                variants.add(norm.slice(0, -1));
            if (last === 'ن' && 'تثجدذزسشصضطظفقك'.includes(nextFirst) && nextFirst)
                variants.add(norm.slice(0, -1));
            variants.delete('');
            return variants;
        }
        /* Public variant builder: tajweed variants + dagger-alif alternative.
         * Uthmani dagger alif (\u0670) is normalised to a full alif so that
         * سُبْحَٰنَ matches ASR "سبحان" — but words like ذَٰلِكَ then
         * normalise to "ذالك" while ASR says "ذلك". Accept the dagger-DELETED
         * form as a variant so both spellings match exactly. */
        variantsFor(raw, norm, nextNorm) {
            const v = this._tajweedVariants(norm, nextNorm);
            if (raw && String(raw).indexOf('\u0670') >= 0) {
                const alt = this.normArabic(String(raw).replace(/\u0670/g, ''));
                if (alt)
                    v.add(alt);
            }
            return v;
        }
        buildFromAyahs(ayahDataArray) {
            const tokens = [];
            (ayahDataArray || []).forEach(a => {
                const words = this._tokenizeText(a.text);
                const cleanWords = a.textClean ? this._tokenizeText(a.textClean) : null;
                const aligned = cleanWords && cleanWords.length === words.length;
                words.forEach((raw, wordIdx) => {
                    const norm = this.normArabic(raw);
                    if (!norm)
                        return;
                    tokens.push({
                        idx: tokens.length,
                        surah: a.surah, ayah: a.ayah,
                        wordIdxInAyah: wordIdx,
                        raw, norm,
                        altNorm: aligned ? this.normArabic(cleanWords[wordIdx]) : null,
                        state: 'pending',
                        variants: null
                    });
                });
            });
            for (let i = 0; i < tokens.length; i++) {
                const v = this.variantsFor(tokens[i].raw, tokens[i].norm, tokens[i + 1] ? tokens[i + 1].norm : '');
                if (tokens[i].altNorm && tokens[i].altNorm !== tokens[i].norm)
                    v.add(tokens[i].altNorm);
                tokens[i].variants = v;
            }
            this.setTokens(tokens);
            return tokens;
        }
        setTokens(tokens) {
            this._tokens = tokens || [];
            this._expectedIdx = 0;
            this._extras = [];
            this._completedAyahs = new Set();
            if (this._tokens.length)
                this._setActive(0);
        }
        reset() { this.setTokens(this._tokens.map(t => (t.state = 'pending', t.variants && t, t))); }
        get tokens() { return this._tokens; }
        get position() { return this._expectedIdx; }
        get extras() { return this._extras.slice(); }
        firstTokenIndexOfAyah(surah, ayah) {
            return this._tokens.findIndex(t => t.surah === surah && t.ayah === ayah);
        }
        tokensOfAyah(surah, ayah) {
            return this._tokens.filter(t => t.surah === surah && t.ayah === ayah);
        }
        seekToAyah(surah, ayah) {
            const i = this.firstTokenIndexOfAyah(surah, ayah);
            if (i >= 0 && i > this._expectedIdx) {
                this._expectedIdx = i;
                this._setActive(i);
            }
            return i;
        }
        _isMatch(spokenNorm, token) {
            if (!spokenNorm || !token)
                return false;
            return spokenNorm === token.norm ||
                (token.variants && token.variants.has(spokenNorm)) ||
                this._fuzzy(spokenNorm, token.norm);
        }
        _matchMergedAt(spokenNorm, idx) {
            const T = this._tokens;
            if (idx + 1 >= T.length)
                return false;
            const a = T[idx].norm, b = T[idx + 1].norm;
            if (!a || !b)
                return false;
            const lastA = a[a.length - 1], firstB = b[0];
            if (lastA === 'ن' && 'ينمولر'.includes(firstB)) {
                const merged = a.slice(0, -1) + b;
                if (spokenNorm === merged || this._fuzzy(spokenNorm, merged))
                    return true;
            }
            return false;
        }
        _fuzzy(a, b) {
            if (Math.abs(a.length - b.length) > 2)
                return false;
            if (a === b)
                return true;
            const m = a.length, n = b.length;
            let prev = Array.from({ length: n + 1 }, (_, j) => j);
            for (let i = 1; i <= m; i++) {
                const curr = [i];
                for (let j = 1; j <= n; j++) {
                    curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
                }
                prev = curr;
            }
            return prev[n] <= 1;
        }
        _mark(idx, state) {
            const t = this._tokens[idx];
            if (!t || t.state === state)
                return;
            if ((t.state === 'correct' || t.state === 'fuzzy') && state === 'missed')
                return;
            t.state = state;
            if (this.onWord)
                this.onWord(t, state);
        }
        _setActive(idx) {
            const t = this._tokens[idx];
            if (t && t.state === 'pending') {
                t.state = 'active';
                if (this.onWord)
                    this.onWord(t, 'active');
            }
        }
        _applyMissedUpTo(targetIdx) {
            for (let i = this._expectedIdx; i <= targetIdx && i < this._tokens.length; i++) {
                const s = this._tokens[i].state;
                if (s === 'pending' || s === 'active')
                    this._mark(i, 'missed');
            }
        }
        _emitExtra(word) {
            this._extras.push(word);
            if (this.onExtra)
                this.onExtra(word);
        }
        _flushAyahCompletions() {
            const T = this._tokens;
            let i = 0;
            while (i < T.length) {
                const surah = T[i].surah, ayah = T[i].ayah;
                let j = i;
                while (j < T.length && T[j].surah === surah && T[j].ayah === ayah)
                    j++;
                const lastIdx = j - 1;
                const key = surah + ':' + ayah;
                if (this._expectedIdx > lastIdx && !this._completedAyahs.has(key)) {
                    this._completedAyahs.add(key);
                    const stats = this._ayahStats(surah, ayah);
                    if ((stats.correct + stats.fuzzy + stats.missed) > 0 && this.onAyahComplete) {
                        this.onAyahComplete(surah, ayah, stats);
                    }
                }
                i = j;
            }
        }
        _ayahStats(surah, ayah) {
            let correct = 0, fuzzy = 0, missed = 0, total = 0;
            for (const t of this._tokens) {
                if (t.surah !== surah || t.ayah !== ayah)
                    continue;
                total++;
                if (t.state === 'correct')
                    correct++;
                else if (t.state === 'fuzzy')
                    fuzzy++;
                else if (t.state === 'missed')
                    missed++;
            }
            const pct = total ? ((correct + fuzzy) / total) * 100 : 0;
            return { surah, ayah, correct, fuzzy, missed, total, pct };
        }
        feedTranscript(transcript) {
            const spoken = this._tokenizeText(transcript).map(w => this.normArabic(w)).filter(Boolean);
            if (!spoken.length)
                return;
            const T = this._tokens, N = T.length;
            if (this._expectedIdx >= N)
                return;
            const FW = 8;
            const lo = this._expectedIdx;
            const hi = Math.min(N - 1, this._expectedIdx + FW);
            let aS = -1, aE = -1;
            for (let s = 0; s < spoken.length && aS < 0; s++) {
                for (let e = lo; e <= hi; e++) {
                    // merged check too: a fused pair (مِن رَّبهم → مربهم) must anchor at
                    // its FIRST token, or the pair's first word is falsely marked missed
                    if (this._isMatch(spoken[s], T[e]) || this._matchMergedAt(spoken[s], e)) {
                        aS = s;
                        aE = e;
                        break;
                    }
                }
            }
            if (aS < 0)
                return;
            if (aE > this._expectedIdx)
                this._applyMissedUpTo(aE - 1);
            this._expectedIdx = aE;
            const startS = aS;
            for (let s = startS; s < spoken.length; s++) {
                if (this._expectedIdx >= N)
                    break;
                const word = spoken[s];
                const exp = T[this._expectedIdx];
                if (word === exp.norm || (exp.variants && exp.variants.has(word))) {
                    this._mark(this._expectedIdx, 'correct');
                    this._expectedIdx++;
                }
                else if (this._fuzzy(word, exp.norm)) {
                    this._mark(this._expectedIdx, 'fuzzy');
                    this._expectedIdx++;
                }
                else if (this._matchMergedAt(word, this._expectedIdx)) {
                    this._mark(this._expectedIdx, 'correct');
                    this._mark(this._expectedIdx + 1, 'correct');
                    this._expectedIdx += 2;
                }
                else {
                    let found = false;
                    for (let ahead = 1; ahead <= 3 && (this._expectedIdx + ahead) < N; ahead++) {
                        const t = T[this._expectedIdx + ahead];
                        if (this._isMatch(word, t)) {
                            this._applyMissedUpTo(this._expectedIdx + ahead - 1);
                            const st = (word === t.norm || (t.variants && t.variants.has(word))) ? 'correct' : 'fuzzy';
                            this._mark(this._expectedIdx + ahead, st);
                            this._expectedIdx += ahead + 1;
                            found = true;
                            break;
                        }
                    }
                    if (!found && word.length >= 2)
                        this._emitExtra(word);
                }
            }
            if (this._expectedIdx < N)
                this._setActive(this._expectedIdx);
            this._flushAyahCompletions();
        }
        score() {
            let correct = 0, fuzzy = 0, missed = 0;
            const total = this._tokens.length;
            for (const t of this._tokens) {
                if (t.state === 'correct')
                    correct++;
                else if (t.state === 'fuzzy')
                    fuzzy++;
                else if (t.state === 'missed')
                    missed++;
            }
            const pct = total ? ((correct + fuzzy) / total) * 100 : 0;
            return { correct, fuzzy, missed, total, pct };
        }
        mistakes() {
            const out = [];
            for (const t of this._tokens) {
                if (t.state === 'missed')
                    out.push({ surah: t.surah, ayah: t.ayah, word: t.raw, type: 'missing' });
                else if (t.state === 'fuzzy')
                    out.push({ surah: t.surah, ayah: t.ayah, word: t.raw, type: 'wrong' });
            }
            this._extras.forEach(w => out.push({ surah: null, ayah: null, word: w, type: 'extra' }));
            return out;
        }
    }
    global.TasmeeMatcher = TasmeeMatcher;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = TasmeeMatcher;
})(typeof globalThis !== 'undefined' ? globalThis : this);
