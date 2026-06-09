/* TasmeeEngine — Quran recitation assessment engine */

interface WordToken {
  idx: number;
  raw: string;
  norm: string;
  ayahIdx: number;
  wordIdxInAyah: number;
  spanId: string;
  state: 'pending' | 'active' | 'correct' | 'fuzzy' | 'missed';
  variants: Set<string> | null;
}

interface EngineOptions {
  onWordMatch?: (idx: number, state: string | undefined, info: { done: number; total: number; currentAyahIdx: number }) => void;
  onSessionEnd?: (summary: ScoreSummary) => void;
  audioFeedback?: boolean;
}

interface ScoreSummary {
  correct: number;
  fuzzy: number;
  missed: number;
  total: number;
  pct: number;
  completed?: boolean;
}

interface AyahData {
  surah: number;
  ayah: number;
  text: string;
}

class TasmeeEngine {
  private _options: Required<EngineOptions>;
  private _wordTokens: WordToken[];
  private _expectedIdx: number;
  private _snapshots: { el: HTMLElement; html: string }[];
  private _recognition: any;
  private _ended: boolean;
  private _restartAttempts: number;
  private _lastRestartTime: number;
  private _audioCtx: AudioContext | null;
  private _ayahOffset: number;
  isPaused: boolean;
  isActive: boolean;

  constructor({ onWordMatch, onSessionEnd, audioFeedback = true }: EngineOptions = {}) {
    this._options = { onWordMatch: onWordMatch || (() => {}), onSessionEnd: onSessionEnd || (() => {}), audioFeedback };
    this._wordTokens = [];
    this._expectedIdx = 0;
    this._snapshots = [];
    this._recognition = null;
    this._ended = false;
    this._restartAttempts = 0;
    this._lastRestartTime = 0;
    this._audioCtx = null;
    this._ayahOffset = 0;
    this.isPaused = false;
    this.isActive = false;
  }

  async startSession(ayahDataArray: AyahData[], { hideText = false, ayahOffset = 0 } = {}): Promise<void> {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) throw new Error('المتصفح لا يدعم التعرف على الكلام. استخدم Chrome أو Edge.');

    this._wordTokens = this._buildWordIndex(ayahDataArray);
    if (this._wordTokens.length === 0) throw new Error('لا توجد كلمات للتسميع في هذه الصفحة.');
    this._expectedIdx = 0;
    this._ended = false;
    this.isPaused = false;
    this.isActive = true;
    this._restartAttempts = 0;
    this._ayahOffset = ayahOffset;

    // Explicitly request microphone permission on the user gesture so the
    // browser prompt appears reliably and we can give a clear message if denied.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        this.isActive = false;
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          throw new Error('تم رفض إذن المايكروفون. يرجى السماح بالوصول للمايكروفون من إعدادات المتصفح ثم إعادة المحاولة. (not-allowed)');
        }
        if (name === 'NotFoundError' || name === 'NotReadableError') {
          throw new Error('تعذر الوصول للمايكروفون — تحقق من توصيل المايكروفون. (audio-capture)');
        }
        // Other (transient) errors: fall through and let SpeechRecognition request its own permission.
      }
    }

    this._injectWordSpans(hideText);
    this._highlightWord(0, 'active');

    this._recognition = new SpeechRec();
    this._recognition.lang = 'ar-SA';
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.maxAlternatives = 3;

    this._recognition.onresult = (e: any) => this._onSpeechResult(e);
    this._recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        this._ended = true;
        this.isActive = false;
        this._restoreDom();
        this._options.onSessionEnd(this._computeScore());
      }
    };
    this._recognition.onend = () => {
      if (this._ended || this.isPaused) return;
      const now = Date.now();
      if (now - this._lastRestartTime < 5000) {
        this._restartAttempts++;
      } else {
        this._restartAttempts = 0;
      }
      this._lastRestartTime = now;
      if (this._restartAttempts >= 3) {
        this._ended = true;
        this.isActive = false;
        this._restoreDom();
        this._options.onSessionEnd(this._computeScore());
        return;
      }
      try { this._recognition.start(); } catch (_) {}
    };

    this._recognition.start();
  }

  pauseSession(): void {
    if (!this.isActive || this.isPaused) return;
    this.isPaused = true;
    try { this._recognition.stop(); } catch (_) {}
    const dot = document.getElementById('tasmeeMicIndicator');
    if (dot) dot.classList.add('paused');
  }

  resumeSession(): void {
    if (!this.isActive || !this.isPaused) return;
    this.isPaused = false;
    this._restartAttempts = 0;
    try { this._recognition.start(); } catch (_) {}
    const dot = document.getElementById('tasmeeMicIndicator');
    if (dot) dot.classList.remove('paused');
  }

  endSession(): void {
    if (this._ended) return;
    this._ended = true;
    this.isActive = false;
    this.isPaused = false;
    try { this._recognition.abort(); } catch (_) {}
    this._applyMissedUpTo(this._wordTokens.length - 1);
    const summary = this._computeScore();
    this._restoreDom();
    this._options.onSessionEnd(summary);
  }

  private _normArabic(str: string): string {
    if (!str) return '';
    return str
      .replace(/[ً-ٟؐ-ؚۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ـ/g, '')
      .replace(/[‌‍]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private _tokenize(htmlStr: string): string[] {
    if (!htmlStr) return [];
    const plain = htmlStr
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/[ۖ-ۭ۰-۹٠-٩۝]/g, '');
    return plain.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);
  }

  private _buildWordIndex(ayahDataArray: AyahData[]): WordToken[] {
    const tokens: WordToken[] = [];
    ayahDataArray.forEach((ayah, ayahIdx) => {
      const words = this._tokenize(ayah.text);
      words.forEach((raw, wordIdx) => {
        const norm = this._normArabic(raw);
        if (norm.length === 0) return;
        tokens.push({
          idx: tokens.length,
          raw,
          norm,
          ayahIdx,
          wordIdxInAyah: wordIdx,
          spanId: `tw-${ayahIdx}-${wordIdx}`,
          state: 'pending',
          variants: null
        });
      });
    });
    for (let i = 0; i < tokens.length; i++) {
      tokens[i].variants = this._getTajweedVariants(tokens[i].norm, tokens[i + 1]?.norm ?? '');
    }
    return tokens;
  }

  private _getTajweedVariants(norm: string, nextNorm: string): Set<string> {
    const variants = new Set([norm]);
    if (!norm) return variants;
    const last = norm[norm.length - 1];
    const nextFirst = nextNorm ? nextNorm[0] : '';

    if (last === 'ن' && nextFirst === 'ب') {
      variants.add(norm.slice(0, -1) + 'م');
    }
    if (last === 'ن' && 'ينمو'.includes(nextFirst) && nextFirst) {
      variants.add(norm.slice(0, -1));
    }
    if (last === 'ن' && 'لر'.includes(nextFirst) && nextFirst) {
      variants.add(norm.slice(0, -1));
    }
    if (last === 'ن' && 'تثجدذزسشصضطظفقك'.includes(nextFirst) && nextFirst) {
      variants.add(norm.slice(0, -1));
    }

    variants.delete('');
    return variants;
  }

  private _isMatch(spokenNorm: string, token: WordToken): boolean {
    if (!spokenNorm || !token) return false;
    return spokenNorm === token.norm ||
           (token.variants && token.variants.has(spokenNorm)) ||
           this._fuzzyMatch(spokenNorm, token.norm);
  }

  private _matchMergedAt(spokenNorm: string, idx: number): boolean {
    if (idx + 1 >= this._wordTokens.length) return false;
    const a = this._wordTokens[idx].norm;
    const b = this._wordTokens[idx + 1].norm;
    if (!a || !b) return false;
    const lastA = a[a.length - 1];
    const firstB = b[0];
    if (lastA === 'ن' && 'ينمولر'.includes(firstB)) {
      const merged = a.slice(0, -1) + b;
      if (spokenNorm === merged || this._fuzzyMatch(spokenNorm, merged)) return true;
    }
    return false;
  }

  private _injectWordSpans(hideText: boolean): void {
    this._snapshots = [];
    const ayahTexts = document.querySelectorAll('.ayah-text');
    const tokensByAyah: Record<number, WordToken[]> = {};
    this._wordTokens.forEach(t => {
      if (!tokensByAyah[t.ayahIdx]) tokensByAyah[t.ayahIdx] = [];
      tokensByAyah[t.ayahIdx].push(t);
    });

    ayahTexts.forEach((el, domIdx) => {
      const ayahIdx = domIdx - this._ayahOffset;
      if (ayahIdx >= 0 && tokensByAyah[ayahIdx] && tokensByAyah[ayahIdx].length > 0) {
        this._snapshots.push({ el: el as HTMLElement, html: (el as HTMLElement).innerHTML });
      }
      const tokens = tokensByAyah[ayahIdx];
      if (!tokens || tokens.length === 0) return;

      const raw = (el as HTMLElement).innerHTML;
      const stopMarkRe = /(&nbsp;<span class="stop-mark">[^<]*<\/span>|<span class="stop-mark">[^<]*<\/span>)/g;
      const parts = raw.split(stopMarkRe);

      const endingStartIdx = Math.max(0, tokens.length - 2);
      let wordCounter = 0;
      let newHtml = '';
      parts.forEach(part => {
        if (stopMarkRe.test(part) || part.includes('stop-mark')) {
          newHtml += part;
          stopMarkRe.lastIndex = 0;
          return;
        }
        stopMarkRe.lastIndex = 0;
        const words = part.split(/(\s+)/);
        words.forEach(chunk => {
          if (/^\s+$/.test(chunk)) { newHtml += chunk; return; }
          const stripped = chunk.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, '').trim();
          if (stripped.length === 0) { newHtml += chunk; return; }
          const tok = tokens[wordCounter];
          if (tok) {
            const hiddenClass = hideText ? ' q-word--hidden' : '';
            const endingClass = wordCounter >= endingStartIdx ? ' q-word--ayah-ending' : '';
            newHtml += `<span class="q-word${hiddenClass}${endingClass}" id="${tok.spanId}">${chunk}</span>`;
            wordCounter++;
          } else {
            newHtml += chunk;
          }
        });
      });
      (el as HTMLElement).innerHTML = newHtml;
    });
  }

  private _restoreDom(): void {
    this._snapshots.forEach(({ el, html }) => {
      if (el && el.parentNode) el.innerHTML = html;
    });
    this._snapshots = [];
  }

  private _highlightWord(idx: number, state: string): void {
    if (idx < 0 || idx >= this._wordTokens.length) return;
    const tok = this._wordTokens[idx];
    tok.state = state as WordToken['state'];
    const span = document.getElementById(tok.spanId);
    if (!span) return;
    span.className = 'q-word';
    if (state !== 'pending') span.classList.add(`q-word--${state}`);
    if (state === 'correct' || state === 'fuzzy') span.classList.remove('q-word--hidden');
  }

  private _applyMissedUpTo(targetIdx: number): void {
    for (let i = this._expectedIdx; i <= targetIdx && i < this._wordTokens.length; i++) {
      if (this._wordTokens[i].state === 'pending' || this._wordTokens[i].state === 'active') {
        this._highlightWord(i, 'missed');
      }
    }
  }

  private _dryRunMatch(transcript: string): number {
    const spoken = this._tokenize(transcript).map(w => this._normArabic(w)).filter(w => w.length > 0);
    let idx = this._expectedIdx;
    let advances = 0;
    for (const word of spoken) {
      if (idx >= this._wordTokens.length) break;
      if (this._isMatch(word, this._wordTokens[idx])) {
        idx++;
        advances++;
      } else if (idx + 1 < this._wordTokens.length && this._matchMergedAt(word, idx)) {
        idx += 2;
        advances += 2;
      } else {
        let found = false;
        for (let ahead = 1; ahead <= 3 && (idx + ahead) < this._wordTokens.length; ahead++) {
          if (this._isMatch(word, this._wordTokens[idx + ahead])) {
            idx += ahead + 1;
            advances += ahead + 1;
            found = true;
            break;
          }
        }
        if (!found) { /* no advance */ }
      }
    }
    return advances;
  }

  private _onSpeechResult(event: any): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      let bestTranscript = event.results[i][0].transcript;
      let bestAdvance = this._dryRunMatch(bestTranscript);
      for (let alt = 1; alt < event.results[i].length; alt++) {
        const t = event.results[i][alt].transcript;
        const adv = this._dryRunMatch(t);
        if (adv > bestAdvance) { bestAdvance = adv; bestTranscript = t; }
      }
      this._matchWords(bestTranscript);
    }
  }

  private _matchWords(transcript: string): void {
    const spoken = this._tokenize(transcript).map(w => this._normArabic(w)).filter(w => w.length > 0);
    for (const word of spoken) {
      if (this._expectedIdx >= this._wordTokens.length) {
        this._finishSession();
        return;
      }
      const exp = this._wordTokens[this._expectedIdx];
      let matched = false;

      if (word === exp.norm || (exp.variants && exp.variants.has(word))) {
        this._highlightWord(this._expectedIdx, 'correct');
        this._playTone(880, 80);
        this._expectedIdx++;
        matched = true;
      } else if (this._fuzzyMatch(word, exp.norm)) {
        this._highlightWord(this._expectedIdx, 'fuzzy');
        this._expectedIdx++;
        matched = true;
      } else if (this._matchMergedAt(word, this._expectedIdx)) {
        this._highlightWord(this._expectedIdx, 'correct');
        this._highlightWord(this._expectedIdx + 1, 'correct');
        this._expectedIdx += 2;
        matched = true;
      } else {
        for (let ahead = 1; ahead <= 3 && (this._expectedIdx + ahead) < this._wordTokens.length; ahead++) {
          const aheadTok = this._wordTokens[this._expectedIdx + ahead];
          if (this._isMatch(word, aheadTok)) {
            this._applyMissedUpTo(this._expectedIdx + ahead - 1);
            const state = (word === aheadTok.norm || (aheadTok.variants && aheadTok.variants.has(word))) ? 'correct' : 'fuzzy';
            this._highlightWord(this._expectedIdx + ahead, state);
            this._expectedIdx = this._expectedIdx + ahead + 1;
            matched = true;
            break;
          }
        }
      }

      if (!matched) continue;

      const matchedTok = this._wordTokens[this._expectedIdx - 1];
      const done = this._wordTokens.filter(t => t.state === 'correct' || t.state === 'fuzzy').length;
      this._options.onWordMatch(this._expectedIdx - 1, matchedTok?.state, {
        done,
        total: this._wordTokens.length,
        currentAyahIdx: matchedTok?.ayahIdx ?? -1
      });

      if (this._expectedIdx < this._wordTokens.length) {
        this._highlightWord(this._expectedIdx, 'active');
        const nextSpan = document.getElementById(this._wordTokens[this._expectedIdx].spanId);
        if (nextSpan) nextSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        this._finishSession();
        return;
      }
    }
  }

  private _finishSession(): void {
    if (this._ended) return;
    this._ended = true;
    this.isActive = false;
    try { this._recognition.abort(); } catch (_) {}
    const summary = this._computeScore();
    summary.completed = true;
    this._restoreDom();
    if (summary.pct >= 95) this._playAscendingArpeggio();
    this._options.onSessionEnd(summary);
  }

  private _fuzzyMatch(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 2) return false;
    if (a === b) return true;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const curr = [i];
      for (let j = 1; j <= n; j++) {
        curr[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
      prev = curr;
    }
    return prev[n] <= 1;
  }

  private _computeScore(): ScoreSummary {
    const correct = this._wordTokens.filter(t => t.state === 'correct').length;
    const fuzzy   = this._wordTokens.filter(t => t.state === 'fuzzy').length;
    const missed  = this._wordTokens.filter(t => t.state === 'missed').length;
    const total   = this._wordTokens.length;
    const pct     = total > 0 ? ((correct + fuzzy) / total) * 100 : 0;
    return { correct, fuzzy, missed, total, pct };
  }

  private _showResultModal(summary: ScoreSummary): void {
    const { correct, fuzzy, missed, total, pct } = summary;
    const pctRounded = Math.round(pct);
    const emoji = pct >= 95 ? '🌟' : pct >= 80 ? '✅' : pct >= 60 ? '⚠️' : '❌';

    const missedWords = this._wordTokens.filter(t => t.state === 'missed').map(t => t.raw).join(' ');
    const missedHtml = missed > 0
      ? `<div style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary);">الكلمات المفقودة:</div>
         <div class="tasmee-missed-list" dir="rtl">${missedWords}</div>`
      : '';

    const bodyEl = document.getElementById('tasmeeResultsBody');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="tasmee-score-ring">
          <div class="tasmee-score-number">${pctRounded}%</div>
          <div class="tasmee-score-label">${emoji} نتيجتك في التسميع</div>
        </div>
        <div class="tasmee-stat-row">
          <div class="tasmee-stat">
            <div class="tasmee-stat-val" style="color:var(--accent);">${correct}</div>
            <div class="tasmee-stat-lbl">صحيح</div>
          </div>
          <div class="tasmee-stat">
            <div class="tasmee-stat-val" style="color:#D47A00;">${fuzzy}</div>
            <div class="tasmee-stat-lbl">قريب</div>
          </div>
          <div class="tasmee-stat">
            <div class="tasmee-stat-val" style="color:var(--danger);">${missed}</div>
            <div class="tasmee-stat-lbl">مفقود</div>
          </div>
          <div class="tasmee-stat">
            <div class="tasmee-stat-val" style="color:var(--text-secondary);">${total}</div>
            <div class="tasmee-stat-lbl">المجموع</div>
          </div>
        </div>
        ${missedHtml}`;
    }
    if (typeof (window as any).openModal === 'function') (window as any).openModal('tasmeeResultsModal');
  }

  private _getAudioCtx(): AudioContext | null {
    try {
      if (!this._audioCtx || this._audioCtx.state === 'closed') {
        this._audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return this._audioCtx;
    } catch (_) { return null; }
  }

  private _playTone(freq: number, duration: number): void {
    if (!this._options.audioFeedback) return;
    const ctx = this._getAudioCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (_) {}
  }

  private _playAscendingArpeggio(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 120), i * 120);
    });
  }
}
