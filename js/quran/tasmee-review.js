/* tasmee-review.js — Spaced Repetition Review Mode (self-contained) */
(function () {
  'use strict';

  /* ===== IndexedDB ===== */
  var DB_NAME = 'tasmeePro';
  var DB_VER = 1;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          var s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
          s.createIndex('surah', 'surah');
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          var m = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
          m.createIndex('type', 'type');
          m.createIndex('surah', 'surah');
          m.createIndex('key', 'key');
        }
        if (!db.objectStoreNames.contains('revisions')) {
          var r = db.createObjectStore('revisions', { keyPath: 'key' });
          r.createIndex('dueDate', 'dueDate');
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function reqP(r) {
    return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
  }

  async function getAll(storeName) {
    var db = await openDB();
    return reqP(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  }

  async function getRevision(key) {
    var db = await openDB();
    return reqP(db.transaction('revisions', 'readonly').objectStore('revisions').get(key));
  }

  async function putRevision(rec) {
    var db = await openDB();
    return reqP(db.transaction('revisions', 'readwrite').objectStore('revisions').put(rec));
  }

  async function addSession(rec) {
    var db = await openDB();
    var os = db.transaction('sessions', 'readwrite').objectStore('sessions');
    rec.date = Date.now();
    return reqP(os.add(rec));
  }

  async function addMistakes(arr) {
    if (!arr || !arr.length) return;
    var db = await openDB();
    return new Promise(function (res, rej) {
      var t = db.transaction('mistakes', 'readwrite');
      var os = t.objectStore('mistakes');
      arr.forEach(function (m) {
        os.add(Object.assign({
          date: Date.now(),
          key: (m.surah != null && m.ayah != null) ? (m.surah + ':' + m.ayah) : null
        }, m));
      });
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
    });
  }

  /* ===== Surah names ===== */
  var SURAH_NAMES = [
    '', 'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة',
    'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم',
    'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'القصص', 'العنكبوت', 'الروم',
    'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
    'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
    'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
    'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
    'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
    'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
    'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
    'القارعة', 'التكاثر', 'العون', 'الحشر', 'الصرصر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون',
    'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'
  ];
  function getSurahName(n) { return SURAH_NAMES[n] || 'سورة ' + n; }

  /* ===== Helpers ===== */
  function $(id) { return document.getElementById(id); }
  function showToast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  /* ===== Arabic normalization (mirrors TasmeeEngine) ===== */
  function normArabic(str) {
    if (!str) return '';
    return str
      .replace(/[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
      .replace(/[\u0623\u0621\u0622\u0671]/g, '\u0627')
      .replace(/[\u0649\u064A]/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      .replace(/\u0624/g, '\u0648')
      .replace(/[\u0640\u200C\u200D]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(str) {
    if (!str) return [];
    return str
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/[\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9]/g, '')
      .split(/\s+/)
      .map(function (w) { return w.trim(); })
      .filter(function (w) { return w.length > 0; });
  }

  function fuzzyMatch(a, b) {
    if (Math.abs(a.length - b.length) > 2) return false;
    if (a === b) return true;
    var m = a.length, n = b.length;
    var prev = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var curr = [i];
      for (var j2 = 1; j2 <= n; j2++) {
        curr[j2] = a[i - 1] === b[j2 - 1]
          ? prev[j2 - 1]
          : 1 + Math.min(prev[j2], curr[j2 - 1], prev[j2 - 1]);
      }
      prev = curr;
    }
    return prev[n] <= 1;
  }

  function isMatch(spoken, expected) {
    if (!spoken || !expected) return false;
    return spoken === expected || fuzzyMatch(spoken, expected);
  }

  /* ===== SM-2 Scheduling ===== */
  function sm2Update(revision, quality) {
    // quality: 0-5 (0=blackout, 5=perfect)
    var r = Object.assign({}, revision);
    if (quality >= 3) {
      // Correct response
      if (r.level === 0) {
        r.level = 1;
      } else if (r.level === 1) {
        r.level = 2;
      } else {
        r.level = r.level + 1;
      }
      r.lapses = 0;
    } else {
      // Incorrect response
      r.level = 0;
      r.lapses = (r.lapses || 0) + 1;
    }

    // Update ease factor
    r.ease = Math.max(1.3, r.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Calculate next interval
    var intervals = [0, 1, 3, 7, 14, 30]; // days for levels 0-5
    var days;
    if (r.level <= 0) {
      days = 0; // review again immediately (same session)
    } else if (r.level <= 5) {
      days = Math.round(intervals[r.level] * r.ease);
    } else {
      days = Math.round(30 * r.ease * Math.pow(1.5, r.level - 5));
    }

    r.dueDate = Date.now() + days * 86400000;
    r.lastReviewed = Date.now();
    return r;
  }

  function qualityFromAccuracy(pct) {
    if (pct >= 95) return 5;
    if (pct >= 85) return 4;
    if (pct >= 70) return 3;
    if (pct >= 50) return 2;
    if (pct >= 25) return 1;
    return 0;
  }

  /* ===== Fetch ayah text from API ===== */
  var ayahCache = {};
  async function fetchAyahText(surah, ayah) {
    var key = surah + ':' + ayah;
    if (ayahCache[key]) return ayahCache[key];
    try {
      var res = await fetch('https://api.alquran.cloud/v1/ayah/' + ayah + '/quran-uthmani');
      var data = await res.json();
      if (data && data.code === 200) {
        ayahCache[key] = data.data.text;
        return data.data.text;
      }
    } catch (_) {}
    return null;
  }

  /* ===== Speech Recognition ===== */
  var recognition = null;
  var isListening = false;
  var isPaused = false;

  function startListening(onResult, onEnd) {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('التعرف على الكلام غير مدعوم — استخدم Chrome أو Edge');
      return;
    }
    if (recognition) { try { recognition.abort(); } catch (_) { /* ignore */ } }

    recognition = new SpeechRec();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = function (e) {
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        var best = e.results[i][0].transcript;
        var bestScore = 0;
        for (var alt = 0; alt < e.results[i].length; alt++) {
          var t = e.results[i][alt].transcript;
          var tokens = tokenize(t).map(normArabic).filter(function (w) { return w.length > 0; });
          if (tokens.length > bestScore) {
            bestScore = tokens.length;
            best = t;
          }
        }
        onResult(best);
      }
    };

    recognition.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        showToast('يرجى السماح بالوصول للمايكروفون');
        stopListening();
      } else if (e.error === 'network') {
        showToast('خطأ في الشبكة — تحقق من الاتصال');
      } else if (e.error === 'audio-capture') {
        showToast('تعذر الوصول للمايكروفون');
        stopListening();
      } else {
        console.warn('Speech recognition error:', e.error);
      }
    };

    recognition.onend = function () {
      if (isListening && !isPaused) {
        try { recognition.start(); } catch (e) { console.warn('Recognition restart failed:', e); }
      }
      if (onEnd && !isListening) onEnd();
    };

    try {
      recognition.start();
      isListening = true;
      isPaused = false;
    } catch (e) {
      console.warn('Recognition start failed:', e);
    }
  }

  function stopListening() {
    isListening = false;
    isPaused = false;
    if (recognition) { try { recognition.abort(); } catch (_) { /* ignore */ } recognition = null; }
  }

  function pauseListening() {
    isPaused = true;
    if (recognition) { try { recognition.stop(); } catch (_) { /* ignore */ } }
  }

  function resumeListening() {
    if (!isListening) return;
    isPaused = false;
    if (recognition) { try { recognition.start(); } catch (_) { /* ignore */ } }
  }

  /* ===== Audio feedback ===== */
  var audioCtx = null;
  function playTone(freq, dur) {
    try {
      if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur / 1000);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + dur / 1000);
    } catch (e) { console.warn('Audio tone error:', e); }
  }

  function playCorrect() { playTone(880, 80); }
  function playWrong() { playTone(220, 200); }
  function playComplete() {
    [523, 659, 784, 1047].forEach(function (f, i) {
      setTimeout(function () { playTone(f, 120); }, i * 120);
    });
  }

  /* ===== Play ayah audio ===== */
  window.playAyahAudio = async function () {
    if (!window._currentAyah) return;
    var ayah = window._currentAyah;
    try {
      var res = await fetch('https://api.alquran.cloud//audio/ayah/' + ayah.number + '/ar.alafasy');
      var data = await res.json();
      if (data && data.code === 200 && data.data.audio) {
        var audio = new Audio(data.data.audio);
        audio.play().catch(function () {});
      }
    } catch (_) {
      showToast('تعذر تحميل الصوت');
    }
  };

  /* ===== State ===== */
  window._dueRevisions = [];
  window._currentIndex = 0;
  window._currentAyah = null;
  window._currentWords = [];
  window._expectedIdx = 0;
  window._correctCount = 0;
  window._fuzzyCount = 0;
  window._missedCount = 0;
  window._sessionResults = [];
  window._hideText = false;
  window._audioFeedback = true;

  /* ===== Theme ===== */
  window.toggleTheme = function () {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'dark';
    var next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  };

  function updateThemeIcon(theme) {
    var sun = $('themeSun');
    var moon = $('themeMoon');
    if (!sun || !moon) return;
    sun.style.display = theme === 'light' ? 'none' : 'block';
    moon.style.display = theme === 'light' ? 'block' : 'none';
  }

  /* ===== UI updates ===== */
  function updateProgress() {
    var total = window._dueRevisions.length;
    var current = window._currentIndex + 1;
    $('progressCurrent').textContent = current;
    $('progressTotal').textContent = 'من ' + total;
    var pct = total > 0 ? (current / total * 100) : 0;
    $('progressFill').style.width = pct + '%';
  }

  function renderAyah(text, surah, ayahNum) {
    var textEl = $('ayahText');
    textEl.textContent = text;
    textEl.classList.toggle('hidden-text', window._hideText);
    $('ayahSurah').textContent = getSurahName(surah);
    $('ayahNumber').textContent = 'آية ' + ayahNum;
  }

  function updateMicUI(listening) {
    var pulse = $('micPulse');
    var status = $('micStatus');
    if (listening) {
      pulse.classList.add('listening');
      pulse.classList.remove('paused');
      status.textContent = 'جاري الاستماع...';
      status.classList.add('active');
    } else {
      pulse.classList.remove('listening');
      status.textContent = 'اضغط للبدء';
      status.classList.remove('active');
    }
  }

  function setButtons(listening, completed) {
    $('nextBtn').disabled = !completed;
    $('skipBtn').disabled = false;
    var mic = $('micPulse');
    if (listening) {
      mic.classList.remove('paused');
    } else {
      mic.classList.add('paused');
    }
  }

  /* ===== Hide text toggle ===== */
  window.toggleHideText = function () {
    window._hideText = !window._hideText;
    var btn = $('hideTextBtn');
    btn.classList.toggle('active', window._hideText);
    var textEl = $('ayahText');
    textEl.classList.toggle('hidden-text', window._hideText);
    localStorage.setItem('review_hide_text', window._hideText ? '1' : '0');
  };

  /* ===== Mic toggle ===== */
  window.toggleMic = function () {
    if (isListening) {
      stopListening();
      updateMicUI(false);
      setButtons(false, false);
    } else {
      startReviewing();
    }
  };

  /* ===== Start reviewing current ayah ===== */
  function startReviewing() {
    if (!window._currentWords.length) return;
    window._expectedIdx = 0;
    window._correctCount = 0;
    window._fuzzyCount = 0;
    window._missedCount = 0;

    updateMicUI(true);
    setButtons(true, false);

    startListening(
      function onResult(transcript) {
        var spoken = tokenize(transcript).map(normArabic).filter(function (w) { return w.length > 0; });
        for (var i = 0; i < spoken.length; i++) {
          if (window._expectedIdx >= window._currentWords.length) break;
          var exp = window._currentWords[window._expectedIdx];
          if (isMatch(spoken[i], exp)) {
            window._correctCount++;
            window._expectedIdx++;
            playCorrect();
          } else {
            // Look ahead for match
            var found = false;
            for (var ahead = 1; ahead <= 3 && (window._expectedIdx + ahead) < window._currentWords.length; ahead++) {
              if (isMatch(spoken[i], window._currentWords[window._expectedIdx + ahead])) {
                // Mark skipped words as missed
                for (var skip = 0; skip < ahead; skip++) {
                  window._missedCount++;
                }
                window._expectedIdx += ahead + 1;
                window._correctCount++;
                found = true;
                playCorrect();
                break;
              }
            }
            if (!found) {
              window._missedCount++;
              playWrong();
            }
          }
        }

        // Check if all words processed
        if (window._expectedIdx >= window._currentWords.length) {
          finishAyah();
        }
      },
      function onEnd() {
        // Speech ended naturally
        if (window._expectedIdx < window._currentWords.length && isListening) {
          // Mark remaining as missed
          window._missedCount += (window._currentWords.length - window._expectedIdx);
          finishAyah();
        }
      }
    );
  }

  function finishAyah() {
    stopListening();
    updateMicUI(false);
    setButtons(false, true);

    // Recalculate correct (some may have been counted as missed during look-ahead)
    var total = window._currentWords.length;
    var actualMissed = Math.max(0, total - window._correctCount - window._fuzzyCount);
    window._missedCount = actualMissed;

    var pct = total > 0 ? ((window._correctCount + window._fuzzyCount) / total * 100) : 0;
    window._currentAccuracy = pct;

    // Show result feedback
    if (pct >= 80) {
      showToast('أحسنت! ' + Math.round(pct) + '%');
    } else if (pct >= 50) {
      showToast('جيد، يمكنك تحسين ذلك');
    } else {
      showToast('حاول مرة أخرى لاحقاً');
    }
  }

  /* ===== Skip ayah ===== */
  window.skipAyah = function () {
    if (isListening) stopListening();
    updateMicUI(false);

    // Record as missed
    window._sessionResults.push({
      surah: window._currentAyah.surah,
      ayah: window._currentAyah.ayah,
      accuracy: 0,
      quality: 0
    });

    advanceToNext();
  };

  /* ===== Next ayah ===== */
  window.nextAyah = function () {
    // Save SM-2 update for current ayah
    if (window._currentAyah) {
      var quality = qualityFromAccuracy(window._currentAccuracy || 0);
      window._sessionResults.push({
        surah: window._currentAyah.surah,
        ayah: window._currentAyah.ayah,
        accuracy: window._currentAccuracy || 0,
        quality: quality
      });
    }

    advanceToNext();
  };

  async function advanceToNext() {
    window._currentIndex++;

    if (window._currentIndex >= window._dueRevisions.length) {
      await finishSession();
      return;
    }

    await loadCurrentAyah();
  }

  /* ===== Load current ayah ===== */
  async function loadCurrentAyah() {
    var rev = window._dueRevisions[window._currentIndex];
    if (!rev) return;

    updateProgress();

    $('ayahText').textContent = 'جاري التحميل...';
    $('ayahText').classList.remove('hidden-text');
    $('nextBtn').disabled = true;

    var text = await fetchAyahText(rev.surah, rev.ayah);
    if (!text) {
      showToast('تعذر تحميل الآية — تخطي');
      advanceToNext();
      return;
    }

    window._currentAyah = { surah: rev.surah, ayah: rev.ayah, text: text };
    window._currentWords = tokenize(text).map(normArabic).filter(function (w) { return w.length > 0; });
    window._expectedIdx = 0;
    window._correctCount = 0;
    window._fuzzyCount = 0;
    window._missedCount = 0;
    window._currentAccuracy = 0;

    renderAyah(text, rev.surah, rev.ayah);
    setButtons(false, false);
  }

  /* ===== Finish session ===== */
  async function finishSession() {
    // Apply SM-2 updates
    var updatePromises = window._sessionResults.map(async function (result) {
      var key = result.surah + ':' + result.ayah;
      var rev = await getRevision(key);
      if (!rev) {
        rev = { key: key, surah: result.surah, ayah: result.ayah, level: 0, dueDate: Date.now(), ease: 2.5, lapses: 0, lastReviewed: 0 };
      }
      var updated = sm2Update(rev, result.quality);
      await putRevision(updated);
    });
    await Promise.all(updatePromises);

    // Save session
    var totalCorrect = window._sessionResults.reduce(function (s, r) { return s + (r.accuracy >= 80 ? 1 : 0); }, 0);
    var avgAcc = window._sessionResults.length
      ? window._sessionResults.reduce(function (s, r) { return s + r.accuracy; }, 0) / window._sessionResults.length
      : 0;

    await addSession({
      surah: window._dueRevisions[0] ? window._dueRevisions[0].surah : 0,
      fromAyah: window._dueRevisions[0] ? window._dueRevisions[0].ayah : 0,
      toAyah: window._dueRevisions[window._dueRevisions.length - 1] ? window._dueRevisions[window._dueRevisions.length - 1].ayah : 0,
      correct: totalCorrect,
      fuzzy: 0,
      missed: window._sessionResults.length - totalCorrect,
      total: window._sessionResults.length,
      accuracy: avgAcc,
      durationSec: Math.round((Date.now() - window._sessionStart) / 1000)
    });

    // Show results
    showResults();
  }

  function showResults() {
    var total = window._sessionResults.length;
    var correct = window._sessionResults.filter(function (r) { return r.accuracy >= 80; }).length;
    var fuzzy = window._sessionResults.filter(function (r) { return r.accuracy >= 50 && r.accuracy < 80; }).length;
    var missed = total - correct - fuzzy;
    var avg = total > 0 ? window._sessionResults.reduce(function (s, r) { return s + r.accuracy; }, 0) / total : 0;

    $('rsCorrect').textContent = correct;
    $('rsFuzzy').textContent = fuzzy;
    $('rsMissed').textContent = missed;
    $('rsTotal').textContent = total;

    var emoji = avg >= 95 ? '🌟' : avg >= 80 ? '✅' : avg >= 60 ? '⚠️' : '💪';
    $('resultsEmoji').textContent = emoji;
    $('resultsTitle').textContent = 'انتهت المراجعة!';
    $('resultsSub').textContent = 'متوسط الدقة: ' + Math.round(avg) + '% — ' + total + ' آية';

    if (avg >= 80) playComplete();

    $('resultsOverlay').classList.add('active');
  }

  window.closeResults = function () {
    $('resultsOverlay').classList.remove('active');
    // Navigate back to dashboard
    window.location.href = 'tasmee-dashboard.html';
  };

  /* ===== Mastery grid ===== */
  async function renderMasteryGrid() {
    var grid = $('masteryGrid');
    if (!grid) return;

    var allRevisions = await getAll('revisions');
    grid.innerHTML = '';

    // Build 114 surah cells (each cell = average level of that surah's revisions)
    for (var s = 1; s <= 114; s++) {
      var surahRevisions = allRevisions.filter(function (r) { return r.surah === s; });
      var avgLevel = 0;
      if (surahRevisions.length > 0) {
        avgLevel = surahRevisions.reduce(function (sum, r) { return sum + r.level; }, 0) / surahRevisions.length;
      }
      var cell = document.createElement('div');
      cell.className = 'mastery-cell l' + Math.min(5, Math.round(avgLevel));
      cell.title = getSurahName(s) + ' (مستوى ' + Math.round(avgLevel) + ')';
      grid.appendChild(cell);
    }
  }

  /* ===== INIT ===== */
  async function init() {
    var savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    window._hideText = localStorage.getItem('review_hide_text') === '1';
    if (window._hideText) {
      var btn = $('hideTextBtn');
      if (btn) btn.classList.add('active');
    }

    if (!window.indexedDB) {
      $('loadingSkeleton').innerHTML =
        '<div class="empty-review" style="padding:60px 20px">' +
          '<p>التلمييع غير مدعوم في هذا المتصفح</p>' +
          '<span>استخدم Chrome أو Edge</span>' +
        '</div>';
      return;
    }

    try {
      var due = await getAll('revisions');
      var t = Date.now();
      window._dueRevisions = due.filter(function (r) { return r.dueDate <= t; }).sort(function (a, b) { return a.dueDate - b.dueDate; });

      $('loadingSkeleton').style.display = 'none';

      if (!window._dueRevisions.length) {
        $('emptyState').style.display = '';
        renderMasteryGrid();
        return;
      }

      $('reviewContent').style.display = '';
      $('reviewSub').textContent = window._dueRevisions.length + ' آية تحتاج مراجعة';

      window._sessionStart = Date.now();
      await loadCurrentAyah();
      renderMasteryGrid();

    } catch (err) {
      console.error('Review init error:', err);
      $('loadingSkeleton').innerHTML =
        '<div class="empty-review" style="padding:60px 20px">' +
          '<p>حدث خطأ أثناء تحميل البيانات</p>' +
          '<span>' + (err.message || err) + '</span>' +
        '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }
})();
