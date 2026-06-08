    // ========== SEARCH ENGINE ==========
    let searchTimeout = null;
    const SEARCH_FETCH_TIMEOUT = 8000;

    function _searchEscapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function _searchSafeRegex(pattern, flags) {
      try {
        return new RegExp(pattern, flags);
      } catch (_) {
        return null;
      }
    }

    function normalizeArabic(text) {
      return text.replace(/[\u0623\u0621\u0622\u0627]/g, '\u0627')
                 .replace(/[\u0624]/g, '\u0648')
                 .replace(/[\u0626\u0649\u064A]/g, '\u064A')
                 .replace(/[\u0629]/g, '\u0647')
                 .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0610-\u061A]/g, '')
                 .replace(/\u0652|\u064e|\u064f|\u0650|\u064b|\u064c|\u064d|\u0651/g, '')
                 .trim();
    }

    function onSearchInput(value) {
      const clearBtn = document.getElementById('searchClearBtn');
      clearBtn.classList.toggle('visible', value.length > 0);
      if (value.trim().length >= 2) {
        handleGlobalSearch(value);
      } else {
        document.getElementById('searchResults').innerHTML =
          '<div class="search-hint"><div class="search-hint-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>اكتب كلمة للبحث في القرآن الكريم<br><span style="font-size:0.8rem;opacity:0.6;">يمكنك البحث في الآيات وأسماء السور</span></div>';
      }
    }

    function clearSearch() {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchInput').focus();
      onSearchInput('');
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
      if (overlay.classList.contains('active')) {
        document.getElementById('searchInput').focus();
        onSearchInput(document.getElementById('searchInput').value);
      }
    }

    function handleGlobalSearch(query) {
      query = query.trim();
      const resultsDiv = document.getElementById('searchResults');
      if (!query || query.length < 2) return;

      resultsDiv.innerHTML = '<div class="search-loading"><div class="spinner"></div>جاري البحث...</div>';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const normalizedQuery = normalizeArabic(query);
        const surahResults = SURAH_MAP.filter(s => normalizeArabic(s.name).includes(normalizedQuery));

        // Try API first, fall back to local search
        const apiPromise = (function() {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), SEARCH_FETCH_TIMEOUT);
          return fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/quran-simple-clean`, { signal: controller.signal })
            .then(r => { clearTimeout(timer); return r.json(); })
            .catch(() => { clearTimeout(timer); return null; });
        })();

        const localPromise = (typeof LocalSearch !== 'undefined' && LocalSearch.isAvailable())
          ? Promise.resolve(LocalSearch.search(query, 50))
          : Promise.resolve(null);

        Promise.all([apiPromise, localPromise]).then(([apiData, localResults]) => {
          let html = '';
          // Surah results
          if (surahResults.length > 0) {
            html += '<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>السور</div>';
            surahResults.forEach(s => {
              html += `<div class="search-result-item" onclick="goToPage(${s.page}); toggleSearchOverlay('close');">
                <div class="search-result-surah">
                  <div class="search-result-surah-num">${s.number}</div>
                  <div class="search-result-surah-name">${s.name.replace(_searchSafeRegex(_searchEscapeRegex(normalizedQuery), 'gi'), m => `<span class="search-highlight">${m}</span>`) || s.name}</div>
                  <div class="search-result-surah-page">صفحة ${s.page}</div>
                </div>
              </div>`;
            });
          }

          // Ayah results — prefer API, fallback to local
          let ayahMatches = [];
          if (apiData && apiData.code === 200 && apiData.data.count > 0) {
            ayahMatches = apiData.data.matches.filter(m => {
              const normText = normalizeArabic(m.text);
              return normText.includes(normalizedQuery);
            });
          } else if (localResults && localResults.length > 0) {
            ayahMatches = localResults;
          }

          if (ayahMatches.length > 0) {
            const label = surahResults.length > 0 ? 'الآيات' : `${ayahMatches.length} نتيجة`;
            html += `<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${label}</div>`;
            const display = ayahMatches.slice(0, 25);

            if (apiData && apiData.code === 200) {
              // API results format
              html += display.map(m => {
                const normText = normalizeArabic(m.text);
                const idx = normText.indexOf(normalizedQuery);
                let displayText = m.text;
                if (idx !== -1) {
                  const re = _searchSafeRegex(_searchEscapeRegex(normalizedQuery).split('').join('[ً-ٟ]*?'), 'gi');
                  if (re) displayText = m.text.replace(re, match => `<span class="search-highlight">${match}</span>`);
                }
                return `<div class="search-result-item" onclick="jumpToSearchResult(${m.number})">
                  <div class="res-meta">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    ${(SURAH_MAP.find(s => s.number === m.surah.number)?.name) || m.surah.name.replace(/سورة|سُورَةُ/g, '').trim()} — آية ${m.numberInSurah}
                  </div>
                  <div class="res-text">${displayText}</div>
                </div>`;
              }).join('');
            } else {
              // Local results format
              html += display.map(m => {
                const surahInfo = SURAH_MAP.find(s => s.number === m.surah);
                const surahName = surahInfo ? surahInfo.name : ('سورة ' + m.surah);
                const page = surahInfo ? surahInfo.page : 1;
                let displayText = m.text;
                const re = _searchSafeRegex(_searchEscapeRegex(normalizedQuery).split('').join('[ً-ٟ]*?'), 'gi');
                if (re) displayText = displayText.replace(re, match => `<span class="search-highlight">${match}</span>`);
                return `<div class="search-result-item" onclick="goToPage(${page}); toggleSearchOverlay('close');">
                  <div class="res-meta">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    ${surahName} — آية ${m.ayah}
                  </div>
                  <div class="res-text">${displayText}</div>
                </div>`;
              }).join('');
            }

            if (ayahMatches.length > 25) {
              html += `<div style="text-align:center;padding:10px;color:var(--text-hint);font-size:0.85rem;">و ${ayahMatches.length - 25} نتيجة أخرى...</div>`;
            }
          } else if (surahResults.length === 0) {
            html = `<div class="search-empty">لا توجد نتائج لـ "<strong>${query}</strong>"<br><span style="font-size:0.8rem;opacity:0.6;">حاول بكلمة مختلفة</span></div>`;
          }
          resultsDiv.innerHTML = html;
        }).catch(() => {
          if (surahResults.length > 0) {
            let html = '<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>السور</div>';
            surahResults.forEach(s => {
              html += `<div class="search-result-item" onclick="goToPage(${s.page}); toggleSearchOverlay('close');">
                <div class="search-result-surah">
                  <div class="search-result-surah-num">${s.number}</div>
                  <div class="search-result-surah-name">${s.name}</div>
                  <div class="search-result-surah-page">صفحة ${s.page}</div>
                </div>
              </div>`;
            });
            resultsDiv.innerHTML = html;
          } else {
            resultsDiv.innerHTML = '<div class="search-error">تعذر البحث، تأكد من الاتصال</div>';
          }
        });
      }, 400);
    }

    function jumpToSearchResult(ayahNumber) {
      const resultsDiv = document.getElementById('searchResults');
      resultsDiv.innerHTML = '<div style="text-align:center; padding:30px; color:var(--accent);">جاري الانتقال للصفحة...</div>';
      let cachedPage = localStorage.getItem('ayah_page_v1_' + ayahNumber);
      if (cachedPage) {
        executeJump(parseInt(cachedPage), ayahNumber);
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SEARCH_FETCH_TIMEOUT);
        fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}`, { signal: controller.signal })
          .then(res => { clearTimeout(timer); return res.json(); })
          .then(data => {
            if (data.code === 200) {
              const targetPage = data.data.page;
              localStorage.setItem('ayah_page_v1_' + ayahNumber, targetPage);
              executeJump(targetPage, ayahNumber);
            }
          })
          .catch(() => {
            clearTimeout(timer);
            resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger);">حدث خطأ في جلب الصفحة.</div>';
          });
      }
    }

    let pendingSearchJump = null;

    function executeJump(targetPage, globalAyahNumber) {
      toggleSearchOverlay('close');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEARCH_FETCH_TIMEOUT);
      fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNumber}`, { signal: controller.signal })
        .then(res => { clearTimeout(timer); return res.json(); })
        .then(data => {
          if (data.code === 200) {
            const surah = data.data.surah.number;
            const ayah = data.data.numberInSurah;
            pendingSearchJump = { surah, ayah };
            goToPage(targetPage);
            showCustomToast(`تم الانتقال إلى صفحة ${targetPage}`);
          }
        }).catch(e => {
          clearTimeout(timer);
          console.error(e);
          goToPage(targetPage);
          showCustomToast(`تم الانتقال إلى صفحة ${targetPage}`);
        });
    }
