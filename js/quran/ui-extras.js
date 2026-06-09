  // ── Tarteel integration ───────────────────────────────────────────────────
  let _tarteelWorker = null;
  let _tarteelReady = false;
  let _tarteelRecording = false;
  let _tarteelProcessing = false;
  let _tarteelResult = null;
  let _tarteelStream = null;
  let _tarteelRecorder = null;

  function openTarteelSheet() {
    document.getElementById('tarteelSheet').classList.add('visible');
    document.getElementById('tarteelBackdrop').classList.add('visible');
    if (!_tarteelWorker) _tarteelInitWorker();
  }

  function closeTarteelSheet() {
    document.getElementById('tarteelSheet').classList.remove('visible');
    document.getElementById('tarteelBackdrop').classList.remove('visible');
    if (_tarteelRecording) _tarteelStopCapture();
  }

  function _tarteelInitWorker() {
    _tarteelWorker = new Worker('../js/tarteel-worker.js', { type: 'module' });
    _tarteelWorker.onmessage = _tarteelOnMsg;
    _tarteelWorker.onerror = e => {
      e.preventDefault();
      const msg = e.message || (e.error && e.error.message) || ('سطر ' + e.lineno + ' في ' + e.filename);
      _tarteelShowError(msg);
    };
  }

  function _tarteelOnMsg(e) {
    const { type, progress, status, result, message } = e.data;
    if (type === 'loading') _tarteelSetLoading(progress, status);
    else if (type === 'ready') _tarteelSetReady();
    else if (type === 'processing') {
      if (_tarteelTasmeeMode) _aiSetProcessing();
      else _tarteelSetProcessing();
    }
    else if (type === 'result') {
      if (_tarteelTasmeeMode) { _tarteelTasmeeMode = false; _aiHandleResult(result); }
      else _tarteelShowResult(result);
    }
    else if (type === 'stream_result') {
      if (typeof _tpHandleStreamResult === 'function') _tpHandleStreamResult(e.data);
    }
    else if (type === 'error') {
      if (_tarteelTasmeeMode) { _tarteelTasmeeMode = false; _tpShowError(message); }
      else _tarteelShowError(message);
    }
  }

  function tarteelDownload() {
    document.getElementById('tarteelDownloadBtn').disabled = true;
    document.getElementById('tarteelProgressBar').style.display = 'block';
    _tarteelWorker.postMessage({ type: 'init' });
  }

  function _tarteelSetLoading(pct, status) {
    const dot = document.getElementById('tarteelDot');
    dot.className = 'tarteel-status-dot loading';
    document.getElementById('tarteelStatusText').textContent = status || 'جاري التحميل...';
    document.getElementById('tarteelProgressBar').style.display = 'block';
    document.getElementById('tarteelProgressFill').style.width = pct + '%';
  }

  function _tarteelSetReady() {
    document.getElementById('tarteelDot').className = 'tarteel-status-dot ready';
    document.getElementById('tarteelStatusText').textContent = 'النموذج جاهز';
    document.getElementById('tarteelProgressBar').style.display = 'none';
    document.getElementById('tarteelDownloadRow').style.display = 'none';
    document.getElementById('tarteelRecordArea').style.display = 'block';
    document.getElementById('tarteelStartTasmeeRow').style.display = 'flex';
    _tarteelReady = true;
  }

  function _tarteelSetProcessing() {
    _tarteelProcessing = true;
    document.getElementById('tarteelDot').className = 'tarteel-status-dot loading';
    document.getElementById('tarteelStatusText').textContent = 'جاري التحليل...';
    document.getElementById('tarteelRecordCircle').classList.add('processing');
    document.getElementById('tarteelRecordLabel').textContent = 'جاري المعالجة...';
    document.getElementById('tarteelRecordCircle').disabled = true;
  }

  function _tarteelShowResult(result) {
    _tarteelProcessing = false;
    _tarteelResult = result;

    document.getElementById('tarteelDot').className = 'tarteel-status-dot ready';
    document.getElementById('tarteelStatusText').textContent = 'النموذج جاهز';
    document.getElementById('tarteelRecordCircle').classList.remove('processing');
    document.getElementById('tarteelRecordCircle').disabled = false;
    document.getElementById('tarteelRecordLabel').textContent = 'اضغط للتسجيل';

    if (result && result.surah) {
      const surahEntry = typeof SURAH_MAP !== 'undefined'
        ? SURAH_MAP.find(s => s.number === result.surah) : null;
      const surahName = result.surahName || (surahEntry ? surahEntry.name : 'سورة ' + result.surah);
      document.getElementById('tarteelResultSurah').textContent =
        surahName + ' — الآية ' + result.ayah;
      document.getElementById('tarteelResultText').textContent = result.text || '';
      const pct = Math.round((result.score || 0) * 100);
      document.getElementById('tarteelConfidence').textContent = 'دقة: ' + pct + '%';
      document.getElementById('tarteelResultCard').classList.add('visible');
    } else {
      document.getElementById('tarteelResultSurah').textContent = 'لم يتم التعرف على الآية';
      document.getElementById('tarteelResultText').textContent = result?.transcript || '';
      document.getElementById('tarteelConfidence').textContent = '';
      document.getElementById('tarteelResultCard').classList.add('visible');
    }
    document.getElementById('tarteelRetryRow').style.display = 'flex';
  }

  function _tarteelShowError(msg) {
    _tarteelProcessing = false;
    _tarteelRecording = false;
    document.getElementById('tarteelDot').className = 'tarteel-status-dot';
    document.getElementById('tarteelStatusText').textContent = 'خطأ: ' + (msg || 'غير معروف');
    document.getElementById('tarteelRecordCircle').classList.remove('processing', 'recording');
    document.getElementById('tarteelRecordCircle').disabled = false;
    document.getElementById('tarteelMicIcon').style.display = '';
    document.getElementById('tarteelStopIcon').style.display = 'none';
    document.getElementById('tarteelRecordLabel').textContent = 'اضغط للتسجيل';
    if (_tarteelStream) { _tarteelStream.getTracks().forEach(t => t.stop()); _tarteelStream = null; }
    if (_tarteelRecorder && _tarteelRecorder.state !== 'inactive') { _tarteelRecorder.stop(); }
    _tarteelRecorder = null;
    if (!_tarteelReady) {
      document.getElementById('tarteelDownloadBtn').disabled = false;
    }
  }

  async function tarteelToggleRecord() {
    if (!_tarteelReady || _tarteelProcessing) return;
    if (_tarteelRecording) {
      _tarteelStopCapture();
    } else {
      await _tarteelStartCapture();
    }
  }

  async function _tarteelStartCapture() {
    try {
      _tarteelStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const chunks = [];
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      _tarteelRecorder = mimeType
        ? new MediaRecorder(_tarteelStream, { mimeType })
        : new MediaRecorder(_tarteelStream);
      const recorderRef = _tarteelRecorder;
      _tarteelRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      _tarteelRecorder.onstop = async () => {
        _tarteelStream.getTracks().forEach(t => t.stop());
        _tarteelStream = null;
        if (chunks.length === 0) return;
        try {
          const blobType = recorderRef.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: blobType });
          const arrayBuf = await blob.arrayBuffer();
          const decoded = await new AudioContext().decodeAudioData(arrayBuf);
          // Resample to 16 kHz using OfflineAudioContext
          const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const src = offline.createBufferSource();
          src.buffer = decoded;
          src.connect(offline.destination);
          src.start(0);
          const resampled = await offline.startRendering();
          const audio = new Float32Array(resampled.getChannelData(0));
          _tarteelWorker.postMessage({ type: 'recognize', audio }, [audio.buffer]);
        } catch (err) {
          _tarteelShowError('خطأ في معالجة الصوت: ' + err.message);
        }
      };
      _tarteelRecorder.start();

      _tarteelRecording = true;
      document.getElementById('tarteelRecordCircle').classList.add('recording');
      document.getElementById('tarteelMicIcon').style.display = 'none';
      document.getElementById('tarteelStopIcon').style.display = '';
      document.getElementById('tarteelRecordLabel').textContent = 'جاري التسجيل... اضغط للإيقاف';
      document.getElementById('tarteelDot').className = 'tarteel-status-dot recording';
      document.getElementById('tarteelStatusText').textContent = 'جاري التسجيل...';
      document.getElementById('tarteelResultCard').classList.remove('visible');
      document.getElementById('tarteelRetryRow').style.display = 'none';
    } catch (err) {
      _tarteelShowError('تعذر الوصول للميكروفون: ' + err.message);
    }
  }

  function _tarteelStopCapture() {
    _tarteelRecording = false;
    document.getElementById('tarteelRecordCircle').classList.remove('recording');
    document.getElementById('tarteelMicIcon').style.display = '';
    document.getElementById('tarteelStopIcon').style.display = 'none';
    document.getElementById('tarteelRecordLabel').textContent = 'اضغط للتسجيل';
    if (_tarteelRecorder && _tarteelRecorder.state !== 'inactive') {
      _tarteelRecorder.stop(); // triggers onstop → decodes → sends to worker
    }
    _tarteelRecorder = null;
  }

  function tarteelReset() {
    document.getElementById('tarteelResultCard').classList.remove('visible');
    document.getElementById('tarteelRetryRow').style.display = 'none';
    _tarteelResult = null;
  }

  function tarteelNavigate() {
    if (!_tarteelResult || !_tarteelResult.surah) return;
    const surahNum = _tarteelResult.surah;
    const surahEntry = typeof SURAH_MAP !== 'undefined'
      ? SURAH_MAP.find(s => s.number === surahNum) : null;
    if (surahEntry && typeof goToPage === 'function') {
      closeTarteelSheet();
      setTimeout(() => goToPage(surahEntry.page), 400);
    }
  }

  // ── Settings row: check model cache status and update label ──────────────
  const _TARTEEL_MODEL_URL = './models/fastconformer_ar_ctc_q8.onnx';
  const _TARTEEL_CACHE_NAME = 'tarteel-model-v1';

  async function tarteelUpdateSettingsRow() {
    const statusEl = document.getElementById('tarteelEngineStatus');
    const chevronEl = document.getElementById('tarteelEngineChevron');
    if (!statusEl) return;
    try {
      const cache = await caches.open(_TARTEEL_CACHE_NAME);
      const cached = await cache.match(_TARTEEL_MODEL_URL);
      if (cached) {
        statusEl.textContent = 'جاهز — النموذج مدمج في التطبيق';
        statusEl.style.color = 'var(--accent)';
        chevronEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else {
        statusEl.textContent = 'جاهز — اضغط للإعداد';
        statusEl.style.color = '';
        chevronEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
      }
    } catch (e) {
      statusEl.textContent = 'اضغط للإعداد';
    }
  }

  function tarteelSettingsAction() {
    closeModal('settingsModal');
    setTimeout(() => openTarteelSheet(), 250);
  }

  // Update status label on page load
  tarteelUpdateSettingsRow();

  // ════════════════════════════════════════════════════════════════════
  //  Tasmee' Pro — full-screen immersive memorisation mode
  // ════════════════════════════════════════════════════════════════════
  let _tarteelTasmeeMode = false;

  // ── shared audio capture helper ───────────────────────────────────────
  async function _doCapture(onAudio, onError) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (!chunks.length) return;
      try {
        const buf = await new Blob(chunks, { type: rec.mimeType || mime }).arrayBuffer();
        const decoded = await new AudioContext().decodeAudioData(buf);
        const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
        const src = off.createBufferSource();
        src.buffer = decoded; src.connect(off.destination); src.start(0);
        const rendered = await off.startRendering();
        onAudio(new Float32Array(rendered.getChannelData(0)));
      } catch (err) { onError && onError(err.message); }
    };
    rec.start();
    return { stream, rec };
  }

  // ── Tasmee' Pro state ─────────────────────────────────────────────────
  let _tp = {
    ayahs: [],          // [{surah, ayah, text, surahName}, ...]
    revealed: new Set(), // indices of revealed ayahs
    errors: 0,
    expectedIdx: null,  // null = free (first recitation), number = expected next
    showText: false,
    recording: false,
    stream: null,
    recorder: null,
    timerInterval: null,
    timerStart: 0,
    masksByAyah: {},    // {surah_ayah: [maskDiv, ...]} — word-level masks
    revealedMasks: new Set(), // mask divs that have been revealed
    peekMode: false,
    maskContainer: null,
  };

  function _tpArabicNum(n) {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  }

  async function startAITasmee() {
    if (!_tarteelReady) return;
    closeTarteelSheet();

    showCustomToast('جاري تحميل آيات الصفحة...');
    let ayahs;
    try {
      const r = await fetch(`https://api.alquran.cloud/v1/page/${currentPage}/ar.uthmani`);
      const d = await r.json();
      ayahs = d.data.ayahs.map(a => ({
        surah: a.surah.number, ayah: a.numberInSurah,
        text: a.text, surahName: a.surah.name
      }));
    } catch (_) {
      showCustomToast('تعذر تحميل آيات الصفحة'); return;
    }

    _tp.ayahs = ayahs;
    _tp.revealed = new Set();
    _tp.errors = 0;
    _tp.expectedIdx = null;
    _tp.showText = false;
    _tp.recording = false;
    _tp.masksByAyah = {};
    _tp.revealedMasks = new Set();
    _tp.peekMode = false;

    document.getElementById('tpPageLabel').textContent = `صفحة ${_tpArabicNum(currentPage)}`;
    document.getElementById('tpErrorBadge').textContent = '٠ أخطاء';
    document.getElementById('tpErrorPill').textContent = 'أخطاء ٠';

    const mb = document.getElementById('tpMicBtn');
    mb.className = 'tp-mic-btn';
    document.getElementById('tpMicIcon').style.display = '';
    document.getElementById('tpStopIcon').style.display = 'none';
    document.getElementById('tpEyeBtn').classList.remove('active');

    document.getElementById('tasmeeProPanel').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Render word-level masks AFTER the panel is visible so the cloned image
    // has real layout dimensions to position the masks against.
    requestAnimationFrame(() => _tpRenderImageMasks(currentPage));
  }

  // ── Word-level coordinate extraction ──────────────────────────────────
  function getWordLevelLegacyCoords(pageNumber) {
    if (!db || !dbReady) return [];
    const query = `SELECT soraid, ayaid, minx, maxx, miny, maxy FROM ayarects WHERE page = ${pageNumber}`;
    const words = [];
    try {
      const stmt = db.prepare(query);
      while(stmt.step()) {
        const row = stmt.getAsObject();
        words.push({ surah: row.soraid, ayah: row.ayaid, x: row.minx, y: row.miny, w: row.maxx - row.minx, h: row.maxy - row.miny });
      }
      stmt.free();
    } catch(e) { return []; }
    if (words.length === 0) return [];
    const cal = getVariantHighlightCal();
    const LEGACY_REF_W = 1024, LEGACY_REF_H = 1636;
    const sx = cal.refW / LEGACY_REF_W;
    const sy = cal.refH / LEGACY_REF_H;
    words.forEach(r => { r.x *= sx; r.y *= sy; r.w *= sx; r.h *= sy; });
    // Detect markers: last word of each ayah that is roughly square and small
    const ayahGroups = {};
    words.forEach(w => {
      const key = `${w.surah}_${w.ayah}`;
      if (!ayahGroups[key]) ayahGroups[key] = [];
      ayahGroups[key].push(w);
    });
    for (const key in ayahGroups) {
      const group = ayahGroups[key];
      if (group.length === 0) continue;
      const last = group[group.length - 1];
      const area = last.w * last.h;
      const ratio = last.w / last.h;
      last.isMarker = (ratio > 0.6 && ratio < 1.6 && area < 3000);
      last.wordIndex = group.length - 1;
      group.forEach((w, i) => { if (w !== last) { w.wordIndex = i; w.isMarker = false; } });
    }
    return words;
  }

  function getWordLevelMedinaCoords(pageNumber) {
    if (!db || !dbReady || !medinaCoordsByAyah) return [];
    const query = `SELECT DISTINCT soraid, ayaid FROM ayarects WHERE page = ${pageNumber} ORDER BY soraid, ayaid`;
    const ayahs = [];
    try {
      const stmt = db.prepare(query);
      while(stmt.step()) {
        const row = stmt.getAsObject();
        ayahs.push({ surah: row.soraid, ayah: row.ayaid });
      }
      stmt.free();
    } catch(e) { return []; }
    const words = [];
    ayahs.forEach(({surah, ayah}) => {
      const key = `${surah}_${ayah}`;
      const segments = medinaCoordsByAyah[key];
      if (!segments || segments.length === 0) return;
      segments.sort((a, b) => a.top - b.top);
      segments.forEach((s, i) => {
        words.push({ surah, ayah, x: s.left, y: s.top, w: s.width, h: s.height, wordIndex: i });
      });
      if (words.length > 0) {
        const last = words[words.length - 1];
        const area = last.w * last.h;
        const ratio = last.w / last.h;
        last.isMarker = (ratio > 0.6 && ratio < 1.6 && area < 2000);
        words.slice(0, -1).forEach(w => { w.isMarker = false; });
      }
    });
    return words;
  }

  function _tpGetWordCoords(pageNumber) {
    const variant = currentMushafVariant || 'mushaf-colored';
    if (variant === 'mushaf-borderd' || variant === 'mushaf-madina1441' || variant === 'mushaf-tajweed' || variant === 'mushaf-green') {
      return getWordLevelMedinaCoords(pageNumber);
    }
    return getWordLevelLegacyCoords(pageNumber);
  }

  function _tpRenderImageMasks(pageNumber) {
    const container = document.getElementById('tpImageContainer');
    container.innerHTML = '';
    const img = document.getElementById('pageImg');
    const cal = getVariantHighlightCal();
    // Clone the page image
    const maskImg = document.createElement('img');
    maskImg.src = img.src;
    maskImg.style.maxWidth = '100%';
    maskImg.style.maxHeight = '100%';
    maskImg.style.objectFit = 'contain';
    maskImg.draggable = false;
    container.appendChild(maskImg);
    _tp.maskContainer = container;
    // Get word-level coords
    const words = _tpGetWordCoords(pageNumber);
    if (!words || words.length === 0) return;
    // Wait for image to load then render masks
    let _maskTries = 0;
    const renderMasks = () => {
      const imgW = maskImg.offsetWidth;
      const imgH = maskImg.offsetHeight;
      if (!imgW || !imgH) {
        // Layout not ready yet — retry on the next frame (capped) instead of bailing.
        if (_maskTries++ < 30) requestAnimationFrame(renderMasks);
        return;
      }
      const yRange = cal.pageBotY - cal.pageTopY;
      words.forEach(w => {
        if (w.isMarker) return;
        const mask = document.createElement('div');
        mask.className = 'tasmee-mask';
        const rightPct = ((1 - (w.x + w.w) / cal.refW) * cal.scaleX) * 100 + 3;
        const widthPct = (w.w / cal.refW) * cal.scaleX * 100;
        const topPct = (cal.pageTopY + (w.y / cal.refH) * yRange) * cal.scaleY * 100 + (cal.padTop + cal.shiftY) * 100;
        const heightPct = (w.h / cal.refH) * yRange * cal.scaleY * 100;
        mask.style.right = rightPct + '%';
        mask.style.width = widthPct + '%';
        mask.style.top = topPct + '%';
        mask.style.height = heightPct + '%';
        mask.dataset.surah = w.surah;
        mask.dataset.ayah = w.ayah;
        mask.dataset.wordIndex = w.wordIndex;
        container.appendChild(mask);
        const ayahKey = `${w.surah}_${w.ayah}`;
        if (!_tp.masksByAyah[ayahKey]) _tp.masksByAyah[ayahKey] = [];
        _tp.masksByAyah[ayahKey].push(mask);
      });
    };
    maskImg.onload = renderMasks;
    if (maskImg.complete) renderMasks();
  }

  function _tpRevealAyahMasks(surah, ayah) {
    const key = `${surah}_${ayah}`;
    const masks = _tp.masksByAyah[key];
    if (!masks) return;
    masks.forEach((m, i) => {
      if (m.classList.contains('revealed')) return;
      setTimeout(() => {
        m.classList.add('revealed');
        _tp.revealedMasks.add(m);
      }, i * 80);
    });
  }

  function _tpFlashErrorMask(surah, ayah) {
    const key = `${surah}_${ayah}`;
    const masks = _tp.masksByAyah[key];
    if (!masks || masks.length === 0) return;
    const firstUnrevealed = masks.find(m => !m.classList.contains('revealed'));
    if (firstUnrevealed) {
      firstUnrevealed.classList.add('flash-error');
      setTimeout(() => firstUnrevealed.classList.remove('flash-error'), 600);
    }
  }

  function _tpUpdateErrorPill() {
    document.getElementById('tpErrorPill').textContent = 'أخطاء ' + _tpArabicNum(_tp.errors);
    document.getElementById('tpErrorBadge').textContent = _tpArabicNum(_tp.errors) + ' أخطاء';
  }

  function _tpSelectAyah(idx) {
    document.querySelectorAll('.tp-ayah.selected-target').forEach(el => el.classList.remove('selected-target'));
    _tp.expectedIdx = idx;
    const el = document.getElementById('tp-a-' + idx);
    if (el) { el.classList.add('selected-target', 'current-expected'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    showCustomToast('اختيرت: ' + _tp.ayahs[idx].surahName + ' — الآية ' + _tp.ayahs[idx].ayah);
  }

  function _tpSetExpected(idx) {
    document.querySelectorAll('.tp-ayah.current-expected, .tp-ayah.selected-target')
      .forEach(el => el.classList.remove('current-expected', 'selected-target'));
    _tp.expectedIdx = idx;
    if (idx !== null && idx < _tp.ayahs.length) {
      const el = document.getElementById('tp-a-' + idx);
      if (el) { el.classList.add('current-expected'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  }

  let _tpAudioCtx = null;
  let _tpScriptProc = null;
  let _tpAllSamples = [];
  let _tpStreamTimer = null;

  async function tpToggleRecord() {
    if (!_tarteelReady) return;
    if (_tp.recording) {
      _tp.recording = false;
      clearInterval(_tp.timerInterval);
      clearInterval(_tpStreamTimer);
      document.getElementById('tpLiveStrip').classList.remove('active');
      if (_tp.stream) { _tp.stream.getTracks().forEach(t => t.stop()); _tp.stream = null; }
      if (_tpScriptProc) { _tpScriptProc.disconnect(); _tpScriptProc = null; }
      if (_tpAudioCtx) { _tpAudioCtx.close().catch(()=>{}); _tpAudioCtx = null; }
      if (_tpAllSamples.length > 0) {
        const total = _tpAllSamples.reduce((s,c) => s + c.length, 0);
        const merged = new Float32Array(total);
        let pos = 0;
        _tpAllSamples.forEach(c => { merged.set(c, pos); pos += c.length; });
        _tpAllSamples = [];
        _tarteelTasmeeMode = true;
        document.getElementById('tpMicBtn').className = 'tp-mic-btn processing';
        document.getElementById('tpMicIcon').style.display = '';
        document.getElementById('tpStopIcon').style.display = 'none';
        document.getElementById('tpRecDot').className = 'tp-rec-dot';
        _tarteelWorker.postMessage({ type: 'recognize', audio: merged }, [merged.buffer]);
      } else {
        document.getElementById('tpMicBtn').className = 'tp-mic-btn';
        document.getElementById('tpMicIcon').style.display = '';
        document.getElementById('tpStopIcon').style.display = 'none';
        document.getElementById('tpRecDot').className = 'tp-rec-dot';
        document.getElementById('tpRecTimer').textContent = '00:00';
      }
    } else {
      try {
        _tp.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _tpAudioCtx = new AudioContext({ sampleRate: 16000 });
        const src = _tpAudioCtx.createMediaStreamSource(_tp.stream);
        _tpScriptProc = _tpAudioCtx.createScriptProcessor(4096, 1, 1);
        _tpAllSamples = [];
        _tpScriptProc.onaudioprocess = ev => {
          if (!_tp.recording) return;
          _tpAllSamples.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        };
        src.connect(_tpScriptProc);
        _tpScriptProc.connect(_tpAudioCtx.destination);
        _tp.recording = true;
        _tp.timerStart = Date.now();
        _tp.timerInterval = setInterval(() => {
          const s = Math.floor((Date.now() - _tp.timerStart) / 1000);
          document.getElementById('tpRecTimer').textContent =
            String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
        }, 1000);
        _tpStreamTimer = setInterval(() => {
          if (!_tp.recording || _tpAllSamples.length === 0) return;
          const total = _tpAllSamples.reduce((s,c) => s+c.length, 0);
          if (total < 16000 * 1.2) return;
          const merged = new Float32Array(total);
          let pos = 0;
          _tpAllSamples.forEach(c => { merged.set(c, pos); pos += c.length; });
          _tarteelWorker.postMessage({ type: 'stream', audio: merged.slice() });
        }, 1800);
        document.getElementById('tpLiveStrip').classList.add('active');
        document.getElementById('tpLiveStrip').innerHTML =
          '<span class="tp-live-word" style="opacity:0.6;animation:none">جاري الاستماع...</span>';
        document.getElementById('tpMicBtn').className = 'tp-mic-btn recording';
        document.getElementById('tpMicIcon').style.display = 'none';
        document.getElementById('tpStopIcon').style.display = '';
        document.getElementById('tpRecDot').className = 'tp-rec-dot recording';
      } catch (err) { _tpShowError(err.message); }
    }
  }

  function _tpHandleStreamResult(data) {
    if (!data.transcript) return;
    const strip = document.getElementById('tpLiveStrip');
    strip.innerHTML = '';
    data.transcript.split(' ').forEach((w, i) => {
      const sp = document.createElement('span');
      sp.className = 'tp-live-word';
      sp.textContent = w;
      sp.style.animationDelay = (i * 0.04) + 's';
      strip.appendChild(sp);
    });
    if (data.match && data.match.score > 0.55) {
      const idx = _tp.ayahs.findIndex(a => a.surah === data.match.surah && a.ayah === data.match.ayah);
      if (idx >= 0 && !_tp.revealed.has(idx)) {
        document.querySelectorAll('.tp-ayah.current-expected').forEach(el => el.classList.remove('current-expected'));
        const el = document.getElementById('tp-a-' + idx);
        if (el) el.classList.add('current-expected');
      }
    }
  }

  function _aiHandleResult(result) {
    _tarteelProcessing = false;
    document.getElementById('tpMicBtn').className = 'tp-mic-btn';
    document.getElementById('tpRecTimer').textContent = '00:00';
    document.getElementById('tpLiveStrip').classList.remove('active');
    if (!result || !result.surah) {
      showCustomToast('لم يُتعرَّف على الآية — حاول مجدداً');
      _tp.errors++; _tpUpdateErrorPill(); return;
    }
    const matchIdx = _tp.ayahs.findIndex(a => a.surah === result.surah && a.ayah === result.ayah);
    if (matchIdx < 0) {
      showCustomToast((result.surahName || 'سورة') + ' — الآية ' + result.ayah + ' (ليست في هذه الصفحة)');
      _tp.errors++; _tpUpdateErrorPill(); return;
    }
    const isCorrect = _tp.expectedIdx === null || matchIdx === _tp.expectedIdx;
    _tp.revealed.add(matchIdx);
    if (!isCorrect) { _tp.errors++; _tpUpdateErrorPill(); _tpFlashErrorMask(result.surah, result.ayah); }
    else { _tpRevealAyahMasks(result.surah, result.ayah); }
    const a = _tp.ayahs[matchIdx];
    showCustomToast((isCorrect ? '✓ ' : '✗ ') + a.surahName + ' — الآية ' + a.ayah);
    _tpSetExpected(matchIdx + 1 < _tp.ayahs.length ? matchIdx + 1 : null);
  }

  function _aiSetProcessing() { _tarteelProcessing = true; document.getElementById('tpMicBtn').className = 'tp-mic-btn processing'; }

  function _tpShowError(msg) {
    _tarteelProcessing = false; _tp.recording = false;
    clearInterval(_tp.timerInterval); clearInterval(_tpStreamTimer);
    if (_tp.stream) { _tp.stream.getTracks().forEach(t => t.stop()); _tp.stream = null; }
    if (_tpScriptProc) { _tpScriptProc.disconnect(); _tpScriptProc = null; }
    if (_tpAudioCtx) { _tpAudioCtx.close().catch(()=>{}); _tpAudioCtx = null; }
    document.getElementById('tpMicBtn').className = 'tp-mic-btn';
    document.getElementById('tpMicIcon').style.display = '';
    document.getElementById('tpStopIcon').style.display = 'none';
    document.getElementById('tpRecDot').className = 'tp-rec-dot';
    document.getElementById('tpRecTimer').textContent = '00:00';
    document.getElementById('tpLiveStrip').classList.remove('active');
    showCustomToast(msg || 'خطأ في التسجيل');
  }

  function _tpUpdateErrors() { _tpUpdateErrorPill(); }
  function tpPrev() { const c = _tp.expectedIdx !== null ? _tp.expectedIdx : _tp.ayahs.length; _tpSetExpected(Math.max(0, c-1)); }
  function tpSkipBack() { const c = _tp.expectedIdx !== null ? _tp.expectedIdx : _tp.ayahs.length; _tpSetExpected(Math.max(0, c-3)); }
  function tpToggleText() {
    _tp.peekMode = !_tp.peekMode;
    document.getElementById('tpEyeBtn').classList.toggle('active', _tp.peekMode);
    document.querySelectorAll('.tasmee-mask:not(.revealed)').forEach(m => m.classList.toggle('peek-mode', _tp.peekMode));
  }

  function closeTasmeePro() {
    _tarteelTasmeeMode = false; _tp.recording = false;
    clearInterval(_tp.timerInterval); clearInterval(_tpStreamTimer);
    if (_tp.stream) { _tp.stream.getTracks().forEach(t => t.stop()); _tp.stream = null; }
    if (_tpScriptProc) { _tpScriptProc.disconnect(); _tpScriptProc = null; }
    if (_tpAudioCtx) { _tpAudioCtx.close().catch(()=>{}); _tpAudioCtx = null; }
    _tpAllSamples = [];
    _tp.masksByAyah = {};
    _tp.revealedMasks = new Set();
    const container = document.getElementById('tpImageContainer');
    if (container) container.innerHTML = '';
    document.getElementById('tpLiveStrip').classList.remove('active');
    document.getElementById('tasmeeProPanel').style.display = 'none';
    document.body.style.overflow = '';
  }
