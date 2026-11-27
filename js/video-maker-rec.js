// The recorder (pages/video-maker.html, «سجّل الآن»): the user recites straight into the
// app. A teleprompter shows the ayah to read and the next one; the reader taps «التالي»
// (or the text, or Space) as they start each next ayah. Those taps become the sync of
// the range — snapped to the real pauses by js/own-recitation.js — so the video is ready
// without splitting anything afterwards. The take is saved like an uploaded recording
// (js/video-maker-own.js): on the device only, then shown in the timing sheet for a last
// check by ear.
(function () {
  'use strict';

  const MAX_SECONDS = 30 * 60;

  window.VMRec = function (api) {
    const $ = api.$;
    const tr = api.tr;
    let st = 'idle';          // idle | countdown | recording | saving
    let segs = [];
    let idx = 0;              // ayah being read
    let taps = [];
    let stream = null, recorder = null, chunks = [], mime = '';
    let t0 = 0, raf = 0, countdownTimer = 0, wakeLock = null;
    let analyser = null, meterSrc = null, buf = null;
    let loudUntil = 0;

    const num = n => (api.arabicNames() ? api.arDigits(n) : String(n));
    const now = () => (performance.now() - t0) / 1000;
    function fmt(t) {
      const s = Math.floor(t), txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      return api.arabicNames() ? api.arDigits(txt) : txt;
    }
    function pickMime() {
      if (!window.MediaRecorder) return null;
      return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
        .find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
    }

    // ---------- screen ----------
    function render() {
      const n = segs.length;
      const seg = segs[Math.min(idx, n - 1)];
      const next = segs[idx + 1];
      $('vmRecCount').textContent = seg && seg.num == null ? tr('vm_rec_basmala') : tr('vm_rec_count', { i: num(Math.min(idx + 1, n)), n: num(n) });
      const ayah = $('vmRecAyah');
      ayah.style.fontFamily = api.qfont() + ', QuranFallback, serif';
      ayah.textContent = seg ? api.ayahWords(seg).join(' ') : '';
      const nx = $('vmRecNext');
      nx.style.fontFamily = ayah.style.fontFamily;
      nx.textContent = next ? api.ayahWords(next).join(' ') : '';
      nx.hidden = !next;
      const rec = st === 'recording';
      $('vmRecMain').classList.toggle('on', rec);
      $('vmRecMainLabel').textContent = rec ? tr('vm_rec_finish') : tr('vm_rec_start');
      $('vmRecMain').disabled = st === 'countdown' || st === 'saving';
      const last = idx >= n - 1;
      $('vmRecNextBtn').disabled = !rec;
      $('vmRecNextLabel').textContent = last ? tr('vm_rec_finish') : tr('vm_rec_next');
      $('vmRecBack').disabled = !rec || !taps.length;
      $('vmRecCancel').hidden = !rec;
      $('vmRecPrompt').classList.toggle('live', rec);
      $('vmRecDots').innerHTML = segs.map((_, i) => '<i class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"></i>').join('');
    }
    function setMsg(text, warn) {
      const el = $('vmRecStatus');
      el.textContent = text || '';
      el.classList.toggle('warn', !!warn);
    }

    function meter() {
      if (st !== 'recording' && st !== 'countdown') return;
      if (analyser) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0, peak = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
        const dbv = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
        const pct = Math.max(0, Math.min(100, (dbv + 60) / 60 * 100));
        const bar = $('vmRecLevel');
        bar.style.width = pct.toFixed(1) + '%';
        bar.classList.toggle('hot', peak > 0.97);
        if (peak > 0.97 && st === 'recording') loudUntil = performance.now() + 2500;
      }
      if (st === 'recording') {
        const t = now();
        $('vmRecTime').textContent = fmt(t);
        if (performance.now() < loudUntil) setMsg(tr('vm_rec_loud'), true);
        else if ($('vmRecStatus').classList.contains('warn')) setMsg('');
        if (t >= MAX_SECONDS) { finish(); return; }
      }
      raf = requestAnimationFrame(meter);
    }

    // ---------- recording ----------
    async function start() {
      if (st !== 'idle') return;
      mime = pickMime();
      if (mime === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(tr('vm_rec_unsupported'), true); return; }
      const ac = api.audioCtx();
      ac.resume();
      try {
        // the raw voice: the polish effects do this better and can be undone
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      } catch (e) {
        setMsg(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? tr('vm_rec_mic_denied') : tr('vm_rec_mic_none'), true);
        return;
      }
      setMsg('');
      try {
        meterSrc = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 2048;
        buf = new Float32Array(analyser.fftSize);
        meterSrc.connect(analyser);          // only measured, never played back (no feedback)
      } catch (e) { analyser = null; }
      // 3, 2, 1 — time to take a breath before the first ayah
      st = 'countdown';
      render();
      raf = requestAnimationFrame(meter);
      let n = 3;
      const cd = $('vmRecCountdown');
      cd.hidden = false;
      cd.textContent = num(n);
      await new Promise(resolve => {
        countdownTimer = setInterval(() => {
          n--;
          if (n <= 0 || st !== 'countdown') { clearInterval(countdownTimer); resolve(); return; }
          cd.textContent = num(n);
        }, 800);
      });
      cd.hidden = true;
      if (st !== 'countdown') return;      // closed during the countdown
      chunks = [];
      try {
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const started = new Promise(res => { recorder.onstart = res; });
      recorder.start(1000);
      await started;
      t0 = performance.now();
      idx = 0; taps = [];
      st = 'recording';
      try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }
      render();
    }

    function next() {
      if (st !== 'recording') return;
      if (idx >= segs.length - 1) { finish(); return; }
      taps.push(now());
      idx++;
      render();
      const p = $('vmRecPrompt');
      p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
    }
    function back() {
      if (st !== 'recording' || !taps.length) return;
      taps.pop();
      idx--;
      render();
    }

    function release() {
      cancelAnimationFrame(raf);
      clearInterval(countdownTimer);
      if (meterSrc) { try { meterSrc.disconnect(); } catch (e) { /* gone */ } meterSrc = null; }
      analyser = null;
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      $('vmRecCountdown').hidden = true;
    }

    // Stops and keeps the take: it becomes the recitation, synced from the taps.
    async function finish() {
      if (st !== 'recording') return;
      st = 'saving';
      render();
      const stopped = new Promise(res => { recorder.onstop = res; });
      try { recorder.stop(); } catch (e) { /* already stopped */ }
      await stopped;
      const type = (recorder.mimeType || mime || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      const t = taps.slice();
      release();
      recorder = null; chunks = [];
      st = 'idle';
      api.closeSheet();                    // the timing sheet opens next
      if (blob.size < 2000) { api.setStatus(tr('vm_own_bad'), true); return; }
      await api.own.addRecorded(blob, t);
      api.recorded();
    }

    function cancel() {
      if (st !== 'recording') return;
      if (!window.confirm(tr('vm_rec_discard'))) return;
      try { recorder.onstop = null; recorder.stop(); } catch (e) { /* stopped */ }
      recorder = null; chunks = [];
      release();
      st = 'idle';
      idx = 0; taps = [];
      setMsg('');
      $('vmRecTime').textContent = fmt(0);
      $('vmRecLevel').style.width = '0%';
      render();
    }

    // ---------- sheet ----------
    function open() {
      segs = api.segments();
      idx = 0; taps = []; st = 'idle';
      setMsg('');
      $('vmRecTime').textContent = fmt(0);
      $('vmRecLevel').style.width = '0%';
      render();
    }
    // Closing the sheet while recording keeps what was recorded (nothing is lost by a
    // stray back gesture); during the countdown it just stops.
    function close() {
      if (st === 'recording') { finish(); return; }
      if (st === 'countdown') { st = 'idle'; release(); }
    }

    function bindUi() {
      $('vmOwnRec').onclick = () => api.openSheet();
      $('vmRecMain').onclick = () => { if (st === 'idle') start(); else if (st === 'recording') finish(); };
      $('vmRecNextBtn').onclick = next;
      $('vmRecBack').onclick = back;
      $('vmRecCancel').onclick = cancel;
      $('vmRecPrompt').onclick = next;          // the whole teleprompter is a big «التالي»
      document.addEventListener('keydown', e => {
        if (!$('vmRecSheet').classList.contains('active') || st !== 'recording') return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowLeft' || e.key === 'PageDown') { e.preventDefault(); next(); }
        else if (e.key === 'Backspace' || e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); back(); }
      });
    }

    return { open, close, bindUi, get busy() { return st !== 'idle'; } };
  };
})();
