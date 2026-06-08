    // ========== CORE FUNCTIONALITY ==========
    function haptic(pattern) {
      if (navigator.vibrate) {
        navigator.vibrate(pattern || 10);
      }
    }

    function showCustomToast(message) {
      const toast = document.getElementById('customToast');
      if (!toast) return;
      toast.innerHTML = message;
      toast.classList.add('show');
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function openSettingsModal() {
      updateVariantUI();
      const theme = localStorage.getItem('quranColorTheme') || 'golden';
      const label = document.getElementById('colorThemeLabel');
      if (label) label.textContent = THEME_NAMES[theme] || 'ذهبي';
      document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === theme));
      document.getElementById('settingsModal').classList.add('active');
      if (typeof tarteelUpdateSettingsRow === 'function') tarteelUpdateSettingsRow();
    }
    function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
    function handleOverlayClick(event, modalId) { if (event.target === document.getElementById(modalId)) closeModal(modalId); }

    function openHowToUse() {
      document.getElementById('howToUseBackdrop').style.display = 'block';
      requestAnimationFrame(() => document.getElementById('howToUseSheet').classList.add('visible'));
    }
    function closeHowToUse() {
      document.getElementById('howToUseSheet').classList.remove('visible');
      setTimeout(() => { document.getElementById('howToUseBackdrop').style.display = 'none'; }, 420);
    }

    function updatePageLabels() {
      const juzLabel = document.getElementById('juzLabel');
      const surahLabel = document.getElementById('surahLabel');
      const pageLabel = document.getElementById('pageLabel');
      const topSurahName = document.getElementById('surahName');
      const topJuzName = document.getElementById('juzName');
      const topPageName = document.getElementById('pageName');
      let sName = ""; let jName = "";
      if (typeof getCurrentJuz === 'function') { const j = getCurrentJuz(); if(j) jName = `الجزء ${j.number}`; }
      if (typeof getCurrentSurah === 'function') { const s = getCurrentSurah(); if(s) sName = s.name; }
      if (juzLabel && jName) juzLabel.textContent = jName;
      if (surahLabel && sName) surahLabel.textContent = sName;
      if (pageLabel) {
        if (dualPage && window.innerWidth >= 700 && currentPage < 604) {
          pageLabel.textContent = `${currentPage}-${currentPage + 1}`;
        } else {
          pageLabel.textContent = currentPage;
        }
      }
      if (topJuzName && jName) topJuzName.textContent = jName;
      if (topSurahName && sName) topSurahName.textContent = sName;
      if (topPageName) {
        if (dualPage && window.innerWidth >= 700 && currentPage < 604) {
          topPageName.textContent = `صفحة ${currentPage}-${currentPage + 1}`;
        } else {
          topPageName.textContent = `صفحة ${currentPage}`;
        }
      }
    }

    function toggleSearchOverlay(action = 'toggle') {
      const overlay = document.getElementById('searchOverlay');
      if (action === 'close') {
          overlay.classList.remove('active');
          document.getElementById('searchBackdrop').classList.remove('active');
      } else {
          overlay.classList.toggle('active');
          document.getElementById('searchBackdrop').classList.toggle('active');
      }
      if (overlay.classList.contains('active')) document.getElementById('searchInput').focus();
    }

    function updatePickerInput() {
      const scroll = document.getElementById('pagePickerScroll');
      const center = scroll.clientHeight / 2;
      document.getElementById('gotoPageInput').value = Math.round((scroll.scrollTop + center) / 50);
    }
    function syncPickerWithInput() {
      const val = parseInt(document.getElementById('gotoPageInput').value);
      if (!isNaN(val) && val >= 1 && val <= 604) {
        const scroll = document.getElementById('pagePickerScroll');
        const center = scroll.clientHeight / 2;
        scroll.scrollTop = (val - 1) * 50 - center + 25;
      }
    }
    function confirmPageSelection() {
      const page = parseInt(document.getElementById('gotoPageInput').value);
      if (page >= 1 && page <= 604) { goToPage(page); closeModal('pageSelectorModal'); }
      else showCustomToast('رقم الصفحة غير صحيح');
    }

    function toggleBookmark() {
      const surah = getCurrentSurah();
      if (!surah) return;
      let bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
      const key = `page_${currentPage}`;
      const exists = bookmarks.find(b => b.key === key);
      if (exists) { bookmarks = bookmarks.filter(b => b.key !== key); showCustomToast('تمت إزالة العلامة'); }
      else { bookmarks.push({ key, surah: surah.name, page: currentPage }); showCustomToast('تمت إضافة العلامة'); }
      localStorage.setItem('quranBookmarks', JSON.stringify(bookmarks));
      updateBookmarkStar();
    }
    function updateBookmarkStar() {
      const btn = document.getElementById('bookmarkBtn');
      const bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
      btn.classList.toggle('active', bookmarks.some(b => b.key === `page_${currentPage}`));
    }
    function openBookmarksModal() {
      const list = document.getElementById('bookmarksList');
      const bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
      if (!bookmarks.length) {
        list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-hint); font-size:0.95rem;">لا توجد علامات محفوظة</div>';
      } else {
        list.innerHTML = '';
        bookmarks.forEach(b => {
          const div = document.createElement('div');
          div.className = 'selection-item';
          div.innerHTML = `<span class="item-num">${b.page}</span><span>${b.surah}</span>`;
          div.onclick = () => { goToPage(b.page); closeModal('bookmarksModal'); };
          list.appendChild(div);
        });
      }
      document.getElementById('bookmarksModal').classList.add('active');
    }

    function openSurahSelector() {
      const list = document.getElementById('surahList');
      list.innerHTML = '';
      SURAH_MAP.forEach(s => {
        const div = document.createElement('div');
        div.className = 'selection-item';
        div.innerHTML = `<span class="item-num">${s.number}</span><span>${s.name}</span>`;
        div.onclick = () => { goToPage(s.page); closeModal('surahSelectorModal'); };
        list.appendChild(div);
      });
      document.getElementById('surahSelectorModal').classList.add('active');
    }
    function openJuzSelector() {
      const list = document.getElementById('juzList');
      list.innerHTML = '';
      const ordinals = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];
      for (let i = 0; i < JUZ_MAP.length; i++) {
        const j = JUZ_MAP[i];
        const nextPage = i < JUZ_MAP.length - 1 ? JUZ_MAP[i+1].page - 1 : 604;
        const surah = [...SURAH_MAP].reverse().find(s => j.page >= s.page);
        const active = currentPage >= j.page && currentPage <= nextPage;
        const div = document.createElement('div');
        div.className = 'juz-card' + (active ? ' juz-card-active' : '');
        div.innerHTML = `
          <div class="juz-card-badge juz-card-badge-${j.number}">${j.number}</div>
          <div class="juz-card-body">
            <span class="juz-card-ordinal">الجزء ${ordinals[i]}</span>
            <span class="juz-card-surah">${surah ? surah.name : ''}</span>
          </div>
          <span class="juz-card-pages">${j.page}–${nextPage}</span>`;
        div.onclick = () => { goToPage(j.page); closeModal('juzSelectorModal'); };
        list.appendChild(div);
      }
      document.getElementById('juzSelectorModal').classList.add('active');
    }
    function openPageSelector() {
      const scroll = document.getElementById('pagePickerScroll');
      scroll.innerHTML = '';
      for (let i = 1; i <= 604; i++) {
        const div = document.createElement('div');
        div.textContent = i;
        div.onclick = () => { goToPage(i); closeModal('pageSelectorModal'); };
        scroll.appendChild(div);
      }
      document.getElementById('pageSelectorModal').classList.add('active');
      requestAnimationFrame(() => {
        const center = scroll.clientHeight / 2;
        scroll.scrollTop = (currentPage - 1) * 50 - center + 25;
      });
    }
    function filterSurahs(query) {
      const list = document.getElementById('surahList');
      const filtered = query ? SURAH_MAP.filter(s => s.name.includes(query)) : SURAH_MAP;
      list.innerHTML = '';
      filtered.forEach(s => {
        const div = document.createElement('div');
        div.className = 'selection-item';
        div.innerHTML = `<span class="item-num">${s.number}</span><span>${s.name}</span>`;
        div.onclick = () => { goToPage(s.page); closeModal('surahSelectorModal'); };
        list.appendChild(div);
      });
    }

    function cacheAllPages() {
      const btn = document.getElementById('offlineDownloadBtn');
      btn.disabled = true;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> جاري التحميل...`;
      let count = 0; const total = 604; const cacheName = `quran-pages-${currentMushafVariant}`;
      const v = getVariantInfo(currentMushafVariant);
      caches.open(cacheName).then(cache => {
        for (let i = 1; i <= total; i++) {
          const page = i.toString().padStart(3, '0'); const url = getImagePath(currentMushafVariant, page, v.ext);
          fetch(url).then(res => { if(res.ok) cache.put(url, res.clone()); count++; if(count===total) finish(); }).catch(()=>{ count++; if(count===total) finish(); });
        }
        function finish() {
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> تم التحميل بنجاح`;
          setTimeout(()=> {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> تحميل جميع الصفحات للقراءة بدون إنترنت`;
          }, 3000);
        }
      });
    }

    // ===== Audio Cache Management =====
    function updateAudioCacheStatus() {
      const el = document.getElementById('audioCacheStatus');
      if (!el || typeof AudioCache === 'undefined') {
        if (el) el.textContent = 'غير متوفر';
        return;
      }
      const stats = AudioCache.getStats();
      el.textContent = stats.count > 0
        ? `${stats.count} ملف صوتي — ${stats.totalMB} MB`
        : 'لا توجد ملفات محفوظة';
    }

    async function prefetchCurrentSurahAudio() {
      if (typeof AudioCache === 'undefined') {
        showCustomToast('تخزين الصوت غير متوفر');
        return;
      }
      if (!windowCurrentAyahGlobal) {
        showCustomToast('حدد آية أولاً');
        return;
      }

      const surah = windowCurrentAyahGlobal.surah;
      const maxAyah = ayahCountMap[surah] || AYAH_COUNTS_FALLBACK[surah] || 286;
      const reciter = currentReciter;
      let cached = 0;

      showCustomToast(`جاري تحميل سورة ${surah}...`);

      for (let ayah = 1; ayah <= maxAyah; ayah++) {
        try {
          const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/${reciter}`);
          const data = await res.json();
          if (data.code === 200 && data.data && data.data.audio) {
            const audioRes = await fetch(data.data.audio);
            if (audioRes.ok) {
              await AudioCache.put(data.data.audio, audioRes);
              cached++;
            }
          }
        } catch (_) {}
      }

      showCustomToast(`تم تحميل ${cached} آية من سورة ${surah}`);
      updateAudioCacheStatus();
    }

    async function clearAudioCache() {
      if (typeof AudioCache === 'undefined') return;
      if (!confirm('مسح جميع ملفات الصوت المحفوظة؟')) return;
      await AudioCache.clearAll();
      showCustomToast('تم مسح التخزين');
      updateAudioCacheStatus();
    }

    // Update cache status on settings open
    const _origOpenSettings = window.openSettingsModal;
    if (typeof _origOpenSettings === 'function') {
      window.openSettingsModal = function() {
        _origOpenSettings();
        updateAudioCacheStatus();
      };
    }
