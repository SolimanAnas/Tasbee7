    // ============================================================
    //  TASMEE' CONTROLLER (quran.html — mushaf image mode)
    //  Enhanced: error recovery, polished pause/resume,
    //  multi-ayah flow, word-level accuracy tracking
    // ============================================================
    let tasmeeEngine = null;
    let tasmeeLastPage = null;
    let tasmeeCurrentAyahHighlight = -1;
    let tasmeeSessionWords = [];
    let tasmeeErrorBackoff = 1000;
    let tasmeeMaxBackoff = 30000;
    let tasmeeAutoRestartTimer = null;

    // --- Surah names for session tracking ---
    const TASMEE_SURAH_NAMES = [
      '', 'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة',
      'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم',
      'طه', 'ال الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'القصص', 'العنكبوت', 'الروم',
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

    // --- Session start time ---
    let tasmeeSessionStart = 0;

    // ============================================================
    //  ERROR RECOVERY — exponential backoff with user feedback
    // ============================================================
    function _tasmeeHandleError(err, context) {
      const errMsg = (err && err.message) ? err.message : String(err);

      // Classify error
      let userMsg = '';
      let recoverable = true;
      let retryDelay = tasmeeErrorBackoff;

      if (errMsg.includes('not-allowed') || errMsg.includes('Permission')) {
        userMsg = 'يرجى السماح بالوصول للمايكروفون من إعدادات المتصفح';
        recoverable = false;
      } else if (errMsg.includes('network') || errMsg.includes('Network')) {
        userMsg = 'خطأ في الشبكة — إعادة المحاولة تلقائياً...';
        retryDelay = Math.min(tasmeeErrorBackoff * 2, tasmeeMaxBackoff);
      } else if (errMsg.includes('no-speech') || errMsg.includes('No speech')) {
        userMsg = 'لم يتم اكتشاف صوت — تحدث بوضوح';
        retryDelay = 1500;
      } else if (errMsg.includes('audio-capture') || errMsg.includes('Audio')) {
        userMsg = 'تعذر الوصول للمايكروفون — تحقق من الاتصال';
        recoverable = false;
      } else if (context === 'start') {
        userMsg = 'تعذر بدء التسميع: ' + errMsg;
        recoverable = false;
      } else {
        userMsg = 'حدث خطأ — إعادة المحاولة...';
      }

      if (userMsg) showCustomToast(userMsg);

      // Auto-restart with backoff if recoverable
      if (recoverable && tasmeeEngine && tasmeeEngine.isActive && !tasmeeEngine.isPaused) {
        tasmeeErrorBackoff = retryDelay;
        clearTimeout(tasmeeAutoRestartTimer);
        tasmeeAutoRestartTimer = setTimeout(() => {
          if (tasmeeEngine && tasmeeEngine.isActive && !tasmeeEngine.isPaused) {
            try {
              const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
              if (SpeechRec && tasmeeEngine._recognition) {
                tasmeeEngine._recognition.start();
              }
            } catch (e) {
              console.warn('Auto-restart recognition failed:', e);
            }
          }
        }, retryDelay);
      }

      return recoverable;
    }

    function _tasmeeResetBackoff() {
      tasmeeErrorBackoff = 1000;
      clearTimeout(tasmeeAutoRestartTimer);
    }

    // ============================================================
    //  OPEN / CLOSE SETUP SHEET
    // ============================================================
    function openTasmeeSetup() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        showCustomToast('التعرف على الكلام غير مدعوم — استخدم Chrome أو Edge');
        return;
      }
      document.getElementById('tasmeeHideText').checked = localStorage.getItem('tasmee_hide_text') === '1';
      document.getElementById('tasmeeShowAyahEnd').checked = localStorage.getItem('tasmee_show_ayah_end') === '1';
      document.getElementById('tasmeeAutoFlip').checked = localStorage.getItem('tasmee_auto_flip') !== '0';
      document.getElementById('tasmeeAudioFeedback').checked = localStorage.getItem('tasmee_audio_feedback') !== '0';
      document.getElementById('tasmeeSheetBackdrop').style.display = 'block';
      document.getElementById('tasmeeSetupSheet').classList.add('visible');
    }

    function closeTasmeeSetup() {
      document.getElementById('tasmeeSheetBackdrop').style.display = 'none';
      document.getElementById('tasmeeSetupSheet').classList.remove('visible');
    }

    // ============================================================
    //  FETCH AYAH TEXT (with retry)
    // ============================================================
    async function fetchTasmeeTextForPage(page, retries) {
      retries = retries || 2;
      const cacheKey = `tasmee_text_v1_${page}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`);
          const data = await res.json();
          if (!data || data.code !== 200) throw new Error('فشل تحميل نص الصفحة');
          const ayahData = data.data.ayahs.map(a => ({
            number: a.number,
            numberInSurah: a.numberInSurah,
            surah: a.surah.number,
            surahName: a.surah.name,
            text: a.text
          }));
          sessionStorage.setItem(cacheKey, JSON.stringify(ayahData));
          return ayahData;
        } catch (e) {
          if (attempt === retries) throw e;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    // ============================================================
    //  RENDER TEXT PANEL
    // ============================================================
    function renderTasmeeTextPanel(ayahData) {
      const container = document.getElementById('tasmeeTextContent');
      if (!container) return;
      let html = '';
      ayahData.forEach((a, i) => {
        const numAr = a.numberInSurah.toLocaleString('ar-EG');
        html += `<span class="ayah-text" data-tasmee-ayah="${i}">${a.text}</span>`;
        html += `<span class="tasmee-ayah-end">﴾${numAr}﴿</span> `;
      });
      container.innerHTML = html;
    }

    function _tasmeeHighlightPanelAyah(ayahIdx) {
      if (tasmeeCurrentAyahHighlight === ayahIdx) return;
      if (tasmeeCurrentAyahHighlight >= 0) {
        const prev = document.querySelector(`#tasmeeTextContent .ayah-text[data-tasmee-ayah="${tasmeeCurrentAyahHighlight}"]`);
        if (prev) prev.style.background = '';
      }
      tasmeeCurrentAyahHighlight = ayahIdx;
      if (ayahIdx >= 0) {
        const curr = document.querySelector(`#tasmeeTextContent .ayah-text[data-tasmee-ayah="${ayahIdx}"]`);
        if (curr) {
          curr.style.background = 'rgba(16,185,129,0.12)';
          curr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }

    // ============================================================
    //  PAUSE / RESUME UI
    // ============================================================
    function _tasmeeUpdatePauseUI(paused) {
      const bar = document.getElementById('tasmeeActiveBar');
      const mic = document.getElementById('tasmeeMicIndicator');
      const pauseBtn = document.getElementById('tasmeePauseBtn');
      const progressText = document.getElementById('tasmeeProgressText');

      if (paused) {
        if (bar) bar.classList.add('paused');
        if (mic) mic.classList.add('paused');
        if (pauseBtn) {
          pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>';
          pauseBtn.title = 'استئناف';
        }
        if (progressText) {
          progressText.dataset.original = progressText.textContent;
          progressText.textContent = '⏸️ متوقف مؤقتاً';
        }
      } else {
        if (bar) bar.classList.remove('paused');
        if (mic) mic.classList.remove('paused');
        if (pauseBtn) {
          pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
          pauseBtn.title = 'إيقاف مؤقت';
        }
        if (progressText && progressText.dataset.original) {
          progressText.textContent = progressText.dataset.original;
        }
      }
    }

    // ============================================================
    //  PROGRESS BAR + COUNT CHIP
    // ============================================================
    function _tasmeeUpdateProgress(done, total) {
      const fill = document.getElementById('tasmeePanelProgressFill');
      const chip = document.getElementById('tasmeePanelCount');
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if (fill) fill.style.width = pct + '%';
      if (chip) chip.textContent = `${done.toLocaleString('ar-EG')} / ${total.toLocaleString('ar-EG')}`;
    }

    // ============================================================
    //  WORD-LEVEL ACCURACY TRACKING
    // ============================================================
    function _tasmeeTrackWordAccuracy(engine) {
      if (!engine || !engine._wordTokens) return [];
      return engine._wordTokens.map(t => ({
        word: t.raw,
        norm: t.norm,
        state: t.state,
        ayahIdx: t.ayahIdx,
        wordIdx: t.wordIdxInAyah
      }));
    }

    function _tasmeeSaveSessionResult(summary, wordResults, page) {
      const now = Date.now();
      const durationSec = tasmeeSessionStart ? Math.round((now - tasmeeSessionStart) / 1000) : 0;

      // Determine surah from first ayah data
      const firstAyah = wordResults.length > 0 ? wordResults[0] : null;
      const surahNum = tasmeeEngine && tasmeeEngine._ayahOffset !== undefined
        ? (window._tasmeeCurrentSurah || 0)
        : 0;

      const sessionRecord = {
        surah: surahNum,
        fromAyah: 1,
        toAyah: wordResults.length > 0 ? Math.max(...wordResults.map(w => w.ayahIdx)) + 1 : 0,
        page: page || currentPage,
        correct: summary.correct,
        fuzzy: summary.fuzzy,
        missed: summary.missed,
        total: summary.total,
        accuracy: summary.pct,
        durationSec: durationSec,
        wordResults: wordResults
      };

      // Save via TasmeeStore if available
      if (typeof TasmeeStore !== 'undefined' && TasmeeStore.addSession) {
        TasmeeStore.addSession(sessionRecord).catch(e => {
          console.error('Session save failed:', e);
          showCustomToast('تعذر حفظ النتيجة — قد تفقد بيانات الجلسة');
        });
      }
    }

    // ============================================================
    //  START TASMEE SESSION
    // ============================================================
    function _tasmeeStartWithData(ayahData, hideText, audioFb, autoFlip) {
      if (autoFlip === undefined) autoFlip = localStorage.getItem('tasmee_auto_flip') !== '0';
      const showAyahEnd = localStorage.getItem('tasmee_show_ayah_end') === '1';
      const contentEl = document.getElementById('tasmeeTextContent');
      if (contentEl) contentEl.classList.toggle('show-ayah-end', showAyahEnd);
      const btn = document.getElementById('tasmeeBtn');
      tasmeeCurrentAyahHighlight = -1;
      tasmeeSessionStart = Date.now();
      _tasmeeResetBackoff();

      tasmeeEngine = new TasmeeEngine({
        audioFeedback: audioFb,
        onWordMatch: (_idx, _state, progress) => {
          const el = document.getElementById('tasmeeProgressText');
          if (el) el.textContent = `${progress.done} / ${progress.total} كلمة`;
          _tasmeeUpdateProgress(progress.done, progress.total);
          if (progress.currentAyahIdx >= 0) _tasmeeHighlightPanelAyah(progress.currentAyahIdx);
        },
        onSessionEnd: (summary) => {
          document.getElementById('tasmeeActiveBar').classList.remove('active', 'paused');
          document.getElementById('tasmeeTextPanel').classList.remove('active');
          _tasmeeHighlightPanelAyah(-1);
          _tasmeeUpdatePauseUI(false);
          if (btn) btn.disabled = false;
          _tasmeeResetBackoff();

          // Track word-level results
          const wordResults = _tasmeeTrackWordAccuracy(tasmeeEngine);

          // Save session with word-level data
          _tasmeeSaveSessionResult(summary, wordResults, tasmeeLastPage);

          const engRef = tasmeeEngine;
          tasmeeEngine = null;

          // Auto-advance to next page when the whole page is completed
          if (summary.completed && autoFlip && currentPage < 604) {
            const nextPage = currentPage + 1;
            if (btn) btn.disabled = true;
            navigateTo(nextPage, 'next');
            fetchTasmeeTextForPage(nextPage).then(newData => {
              showCustomToast('انتهت الصفحة! جاري الانتقال للصفحة التالية...');
              renderTasmeeTextPanel(newData);
              document.getElementById('tasmeeTextPanel').classList.add('active');
              _tasmeeStartWithData(newData, hideText, audioFb, autoFlip);
            }).catch(e => {
              console.error('Auto-advance fetch failed:', e);
              if (btn) btn.disabled = false;
              showCustomToast('تعذر تحميل الصفحة التالية');
            });
            return;
          }
          engRef._showResultModal(summary);
        }
      });

      tasmeeEngine.startSession(ayahData, { hideText })
        .then(() => {
          document.getElementById('tasmeeProgressText').textContent = `0 / ${tasmeeEngine._wordTokens.length} كلمة`;
          _tasmeeUpdateProgress(0, tasmeeEngine._wordTokens.length);
          document.getElementById('tasmeeMicIndicator').classList.remove('paused');
          document.getElementById('tasmeePauseBtn').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
          document.getElementById('tasmeeActiveBar').classList.add('active');
        })
        .catch(err => {
          if (btn) btn.disabled = false;
          document.getElementById('tasmeeTextPanel').classList.remove('active');
          tasmeeEngine = null;
          _tasmeeHandleError(err, 'start');
        });
    }

    // ============================================================
    //  PUBLIC: START SESSION
    // ============================================================
    async function startTasmeeSession() {
      closeTasmeeSetup();
      stopAudio();

      const hideText = document.getElementById('tasmeeHideText').checked;
      const showAyahEnd = document.getElementById('tasmeeShowAyahEnd').checked;
      const audioFlip = document.getElementById('tasmeeAutoFlip').checked;
      const audioFb = document.getElementById('tasmeeAudioFeedback').checked;
      localStorage.setItem('tasmee_hide_text', hideText ? '1' : '0');
      localStorage.setItem('tasmee_show_ayah_end', showAyahEnd ? '1' : '0');
      localStorage.setItem('tasmee_auto_flip', audioFlip ? '1' : '0');
      localStorage.setItem('tasmee_audio_feedback', audioFb ? '1' : '0');

      const btn = document.getElementById('tasmeeBtn');
      if (btn) btn.disabled = true;

      let ayahData;
      try {
        ayahData = await fetchTasmeeTextForPage(currentPage);
      } catch (e) {
        if (btn) btn.disabled = false;
        showCustomToast('تعذر تحميل النص: ' + e.message);
        return;
      }

      tasmeeLastPage = currentPage;
      renderTasmeeTextPanel(ayahData);
      document.getElementById('tasmeeTextPanel').classList.add('active');
      _tasmeeStartWithData(ayahData, hideText, audioFb, audioFlip);
    }

    // ============================================================
    //  PUBLIC: PAUSE / RESUME (with polished UI)
    // ============================================================
    function pauseOrResumeTasmee() {
      if (!tasmeeEngine) return;
      if (tasmeeEngine.isPaused) {
        tasmeeEngine.resumeSession();
        _tasmeeUpdatePauseUI(false);
        showCustomToast('استئناف التسميع');
      } else {
        tasmeeEngine.pauseSession();
        _tasmeeUpdatePauseUI(true);
        showCustomToast('إيقاف مؤقت');
      }
    }

    // ============================================================
    //  PUBLIC: END SESSION
    // ============================================================
    function endTasmeeSession() {
      if (!tasmeeEngine) return;
      tasmeeEngine.endSession();
    }

    // ============================================================
    //  PUBLIC: TOGGLE TEXT VISIBILITY
    // ============================================================
    function tasmeeToggleText() {
      const panel = document.getElementById('tasmeeTextContent');
      const btn = document.getElementById('tasmeeEyeBtn');
      if (!panel || !btn) return;
      const show = panel.classList.toggle('show-hidden');
      btn.classList.toggle('active', show);
      btn.innerHTML = show
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }

    // ============================================================
    //  PUBLIC: RETRY SESSION
    // ============================================================
    function retryTasmeeSession() {
      closeModal('tasmeeResultsModal');
      if (tasmeeLastPage !== null && typeof _v2Open === 'function') _v2Open(currentPage);
    }

    // ============================================================
    //  END TASMEE' ON MANUAL PAGE NAVIGATION
    // ============================================================
    const _origNavigateTo = navigateTo;
    navigateTo = function(newPage, dir) {
      if (tasmeeEngine && tasmeeEngine.isActive) {
        tasmeeEngine.endSession();
      }
      _origNavigateTo(newPage, dir);
    };
