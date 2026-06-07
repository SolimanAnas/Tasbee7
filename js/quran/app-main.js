  <script>
    // --- Daily Tracking Function for Stats (Quran Pages/Juz) ---
    function checkDailyResetKhatma() {
        const today = new Date().toDateString();
        const lastDate = localStorage.getItem("khatma_last_date");
        if (lastDate !== today) {
            localStorage.setItem("khatma_today", "0");
            localStorage.setItem("khatma_last_date", today);
        }
    }
    function trackQuranReading() {
        checkDailyResetKhatma();
        let pagesReadToday = parseInt(localStorage.getItem("khatma_today") || "0");
        localStorage.setItem("khatma_today", pagesReadToday + 1);
        let totalPagesRead = parseInt(localStorage.getItem("total_khatma_pages") || "0");
        localStorage.setItem("total_khatma_pages", totalPagesRead + 1);
    }

    // ========== PAGE CACHING ==========
    function determineInitialPage() {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      if (pageParam) return parseInt(pageParam) >= 1 && parseInt(pageParam) <= 604 ? parseInt(pageParam) : 1;
      const savedPage = localStorage.getItem('lastPage');
      if (savedPage) return parseInt(savedPage) >= 1 && parseInt(savedPage) <= 604 ? parseInt(savedPage) : 1;
      return 1;
    }
    window.currentPage = determineInitialPage();

    // ========== LEGACY SQLITE DATABASE (for colored & tajweed) ==========
    let db = null;
    let dbReady = false;
    let ayahCountMap = {};
    const AYAH_COUNTS_FALLBACK = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

    async function initDatabase() {
      try {
        const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
        window.SQL = SQL;
        let view;
        if (window.__SQLITE_DATA_B64__) {
          const binaryStr = atob(window.__SQLITE_DATA_B64__);
          view = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) view[i] = binaryStr.charCodeAt(i);
        } else {
          const response = await fetch('../db/quranpages.sqlite');
          if(!response.ok) throw new Error("Main DB not found");
          const buffer = await response.arrayBuffer();
          view = new Uint8Array(buffer);
        }
        if(view[0] !== 83 || view[1] !== 81 || view[2] !== 76 || view[3] !== 105) throw new Error("Invalid SQLite format");
        db = new SQL.Database(view);
        dbReady = true;
        buildAyahCountMap();
        console.log('Legacy DB loaded');
      } catch(e) {
        console.error("DB error:", e);
      }
    }

    function buildAyahCountMap() {
      try {
        const stmt = db.prepare("SELECT soraid, MAX(ayaid) as cnt FROM ayarects GROUP BY soraid ORDER BY soraid");
        while(stmt.step()) {
          const row = stmt.getAsObject();
          ayahCountMap[row.soraid] = row.cnt;
        }
        stmt.free();
      } catch(e) { console.error("Ayah count map error:", e); }
    }

    let windowCurrentAyahGlobal = null;
    let medinaCoordsByAyah = null;

    async function initMedinaCoords() {
      try {
        let data;
        if (window.__MEDINA2_COORDS__) {
          data = window.__MEDINA2_COORDS__;
        } else {
          const res = await fetch('../json/medina2_coords.json');
          data = await res.json();
        }
        medinaCoordsByAyah = {};
        data.forEach(item => {
          const parts = item.id.replace('v', '').split('_');
          const surah = parseInt(parts[0]);
          const ayah = parseInt(parts[1]);
          const key = `${surah}_${ayah}`;
          if (!medinaCoordsByAyah[key]) medinaCoordsByAyah[key] = [];
          medinaCoordsByAyah[key].push({ top: item.top, left: item.left, width: item.width, height: item.height });
        });
      } catch(e) {
        console.error('medina2_coords load error:', e);
      }
    }

    /* Per-page Y offsets for medina2 coord misalignment (pages with surah headers) */
    const MEDINA_PAGE_Y_OFFSETS = { 1: -63, 2: -65, 50: -38 };

    function getMedinaCoordsForPage(pageNumber) {
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
      const rects = [];
      const yOff = MEDINA_PAGE_Y_OFFSETS[pageNumber] || 0;
      ayahs.forEach(({surah, ayah}) => {
        const key = `${surah}_${ayah}`;
        const segments = medinaCoordsByAyah[key];
        if (!segments || segments.length === 0) return;
        segments.sort((a, b) => a.top - b.top);
        let lines = [];
        let currentLine = [];
        segments.forEach(s => {
          if (currentLine.length === 0) currentLine.push(s);
          else if (Math.abs(s.top - currentLine[currentLine.length - 1].top) < 10) currentLine.push(s);
          else { lines.push(currentLine); currentLine = [s]; }
        });
        if (currentLine.length > 0) lines.push(currentLine);
        lines.forEach(line => {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          line.forEach(s => {
            minX = Math.min(minX, s.left); maxX = Math.max(maxX, s.left + s.width);
            minY = Math.min(minY, s.top + yOff); maxY = Math.max(maxY, s.top + s.height + yOff);
          });
          rects.push({ surah, ayah, x: minX, y: minY, w: maxX - minX, h: maxY - minY });
        });
      });
      return rects;
    }

    // ========== LEGACY COORDINATE FETCH (SQLITE) ==========
    function groupWordsIntoAyahLines(words) {
      const ayahs = {};
      words.forEach(w => {
        const key = `${w.surah}-${w.ayah}`;
        if (!ayahs[key]) ayahs[key] = [];
        ayahs[key].push(w);
      });
      const mergedRects = [];
      for (const key in ayahs) {
        const ayahWords = ayahs[key];
        ayahWords.sort((a, b) => a.y - b.y);
        let lines = [];
        let currentLine = [];
        ayahWords.forEach(w => {
          if (currentLine.length === 0) currentLine.push(w);
          else {
            if (Math.abs(w.y - currentLine[currentLine.length - 1].y) < 50) currentLine.push(w);
            else { lines.push(currentLine); currentLine = [w]; }
          }
        });
        if (currentLine.length > 0) lines.push(currentLine);
        lines.forEach(line => {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          line.forEach(w => {
            minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x + w.w);
            minY = Math.min(minY, w.y); maxY = Math.max(maxY, w.y + w.h);
          });
          mergedRects.push({ surah: line[0].surah, ayah: line[0].ayah, x: minX, y: minY, w: maxX - minX, h: maxY - minY });
        });
      }
      return mergedRects;
    }

    function getLegacyCoordsForPage(pageNumber) {
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
      const rects = groupWordsIntoAyahLines(words);
      const cal = getVariantHighlightCal();
      const LEGACY_REF_W = 1024, LEGACY_REF_H = 1636;
      const sx = cal.refW / LEGACY_REF_W;
      const sy = cal.refH / LEGACY_REF_H;
      rects.forEach(r => { r.x *= sx; r.y *= sy; r.w *= sx; r.h *= sy; });
      return rects;
    }

    function toggleTafsirFullscreen() {
      const modal = document.getElementById('tafsirModal');
      if (modal.style.height === '100vh') {
        modal.style.height = '';
        modal.style.maxHeight = '85vh';
        modal.style.borderRadius = '26px 26px 0 0';
      } else {
        modal.style.height = '100vh';
        modal.style.maxHeight = '100vh';
        modal.style.borderRadius = '0';
      }
    }

    async function getPageAyahsForTafsir(page) {
      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(page);
      } else {
        rects = getLegacyCoordsForPage(page);
      }
      if (!rects || rects.length === 0) return null;
      return { surah: rects[0].surah, ayah: rects[0].ayah };
    }

    async function findAdjacentAyah(surah, ayah, direction) {
      const step = direction === 'next' ? 1 : -1;
      let targetSurah = surah;
      let targetAyah = ayah + step;
      const maxAyah = ayahCountMap[targetSurah] || AYAH_COUNTS_FALLBACK[targetSurah] || 286;
      if (targetAyah < 1) { targetSurah--; targetAyah = ayahCountMap[targetSurah] || AYAH_COUNTS_FALLBACK[targetSurah] || 286; }
      if (targetAyah > maxAyah) { targetSurah++; targetAyah = 1; }
      if (targetSurah < 1) return null;
      if (targetSurah > 114) return null;
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${targetSurah}:${targetAyah}`);
        const data = await res.json();
        if (data.code === 200) {
          return { surah: data.data.surah.number, ayah: data.data.numberInSurah, page: data.data.page };
        }
      } catch(e) {}
      return { surah: targetSurah, ayah: targetAyah, page: null };
    }

    async function getFirstAyahOfPage(page) {
      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(page);
      } else {
        rects = getLegacyCoordsForPage(page);
      }
      if (!rects || rects.length === 0) return null;
      return { surah: rects[0].surah, ayah: rects[0].ayah, page: page };
    }

    async function getNextAyahDb(surah, ayah) {
      return findAdjacentAyah(surah, ayah, 'next');
    }

    async function getPrevAyahDb(surah, ayah) {
      return findAdjacentAyah(surah, ayah, 'prev');
    }

    async function nextTafsirAyah() {
      if(!windowCurrentAyahGlobal) {
          const first = await getPageAyahsForTafsir(currentPage);
          if(first) windowCurrentAyahGlobal = first; else return;
      }
      const next = await findAdjacentAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, 'next');
      if (next) {
          windowCurrentAyahGlobal = { surah: next.surah, ayah: next.ayah };
          if (next.page && next.page !== currentPage) window.goToPage(next.page);
          await contextShowTafsir(true);
      } else {
          showCustomToast("ØªÙ… Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ù…ØµØ­Ù");
      }
    }

    async function prevTafsirAyah() {
      if(!windowCurrentAyahGlobal) {
          const first = await getPageAyahsForTafsir(currentPage);
          if(first) windowCurrentAyahGlobal = first; else return;
      }
      const prev = await findAdjacentAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, 'prev');
      if (prev) {
          windowCurrentAyahGlobal = { surah: prev.surah, ayah: prev.ayah };
          if (prev.page && prev.page !== currentPage) window.goToPage(prev.page);
          await contextShowTafsir(true);
      } else {
          showCustomToast("ØªÙ… Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ù…ØµØ­Ù");
      }
    }

    let tafsirTouchStartX = 0;
    const tafsirModalEl = document.getElementById('tafsirModal');
    tafsirModalEl.addEventListener('touchstart', e => { tafsirTouchStartX = e.changedTouches[0].screenX; }, {passive: true});
    tafsirModalEl.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].screenX - tafsirTouchStartX;
      if (diff > 60) nextTafsirAyah();
      else if (diff < -60) prevTafsirAyah();
    }, {passive: true});

    function closeTafsirModal() {
      document.getElementById('tafsirModal').classList.remove('visible');
      document.getElementById('tafsirSheetBackdrop').classList.remove('visible');
    }

    async function contextShowTafsir(isNavigation = false) {
      if(!isNavigation) closeContextMenu();
      if(!windowCurrentAyahGlobal) { showCustomToast("Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ­Ø¯ÙŠØ¯ Ø¢ÙŠØ© Ø£ÙˆÙ„Ø§Ù‹"); return; }
      const { surah, ayah } = windowCurrentAyahGlobal;
      const contentDiv = document.getElementById('tafsirContent');
      document.getElementById('tafsirModal').classList.add('visible');
      document.getElementById('tafsirSheetBackdrop').classList.add('visible');
      try {
        tafsirSelectedDB = document.getElementById('tafsirBookSelect')?.value || tafsirSelectedDB;
        localStorage.setItem('tafsirSelectedBook', tafsirSelectedDB);
        contentDiv.innerHTML = typeof tafsirDropdownHTML === 'function'
          ? tafsirDropdownHTML(tafsirSelectedDB) + '<div style="text-align:center; padding:30px; color:var(--accent);">Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...</div>'
          : '<div style="text-align:center; padding:30px; color:var(--accent);">Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...</div>';
        const [ayaTextRes, tafText] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-simple`),
          getTafsirText(tafsirSelectedDB, surah, ayah)
        ]);
        const ayaData = await ayaTextRes.json();
        const ayahText = (ayaData.code === 200) ? ayaData.data.text : '';
        const tafsirText = tafText || 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ ØªÙØ³ÙŠØ± Ù„Ù‡Ø°Ù‡ Ø§Ù„Ø¢ÙŠØ©.';
        let html = typeof tafsirDropdownHTML === 'function' ? tafsirDropdownHTML(tafsirSelectedDB) : '';
        html += `<div style="font-weight:700; margin-bottom:12px; color:var(--text-secondary); text-align:center; font-size:0.95rem; font-family:'Tajawal',sans-serif;">Ø§Ù„Ø¢ÙŠØ© ${ayah}</div>`;
        html += `<div class="imlaei-text">ï´¿ ${ayahText} ï´¾</div>`;
        html += `<div style="text-align:justify; font-size:1.1rem; line-height:2; border-top:1px dashed var(--glass-border); padding-top:16px;">${tafsirText.replace(/\n/g, '<br>')}</div>`;
        contentDiv.innerHTML = html;
        highlightAyah(surah, ayah);
      } catch(e) {
        console.error(e);
        contentDiv.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙØ³ÙŠØ± Ø£Ùˆ Ø§Ù„Ø¢ÙŠØ© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©</div><button onclick="contextShowTafsir()" class="action-btn" style="margin-top:10px; justify-content:center;">Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©</button>`;
      }
    }

    async function changeTafsir() {
       const sel = document.getElementById('tafsirBookSelect');
       if (sel) {
         tafsirSelectedDB = sel.value;
         localStorage.setItem('tafsirSelectedBook', tafsirSelectedDB);
       }
       if (document.getElementById('tafsirModal').classList.contains('visible') && windowCurrentAyahGlobal) {
           await contextShowTafsir(true);
       }
    }

    // ========== PAGE TRANSITION ==========
    window.goToPage = function (page) {
        page = Math.max(1, Math.min(604, page));
        currentPage = page;
        updateContent();
        updateDesktopNavButtons();
    };

    function updateContent() {
      // Dual-page (desktop): the RIGHT page is always odd and the LEFT even, so the
      // spread reads like a real mushaf. Snap an even currentPage back to its odd
      // partner so navigating/searching to an even page still keeps odd on the right.
      if (dualPage && window.innerWidth >= 700 && currentPage % 2 === 0 && currentPage > 1) currentPage--;
      const formattedPage = currentPage.toString().padStart(3, '0');
      const img = document.getElementById('pageImg');
      const v = getVariantInfo(currentMushafVariant);
      const cal = getVariantHighlightCal();
      const container = document.getElementById('mushafContainer');
      img.style.opacity = '0';
      const _ov = document.getElementById('highlightOverlay');
      _ov.innerHTML = '';
      _ov.style.width  = '';
      _ov.style.height = '';
      img.src = getImagePath(currentMushafVariant, formattedPage, v.ext);
      let sx = cal.imgScaleX, sy = cal.imgScaleY;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-green') {
        sx = borderZoomState ? 1.0 : 1.2;
        sy = borderZoomState ? 1.3 : 1.4;
      }
      const container2 = document.getElementById('mushafContainer2');
      const img2 = document.getElementById('pageImg2');
      const sep = document.getElementById('dualPageSep');
      const label1 = document.getElementById('dualPageLabel1');
      const label2 = document.getElementById('dualPageLabel2');
      const isDual = dualPage && window.innerWidth >= 700;
      const isFitW = fitWidth && window.innerWidth >= 700;
      if (isDual) {
        container.style.transform = 'none';
        img.style.maxHeight = '';
        img.style.width = '';
        const nextPage = Math.min(currentPage + 1, 604);
        const showSecond = nextPage !== currentPage;
        if (container2) container2.classList.toggle('dual-active', showSecond);
        if (sep) sep.style.display = showSecond ? '' : 'none';
        if (label1) { label1.style.display = ''; label1.textContent = currentPage; }
        if (label2) { if (showSecond) { label2.style.display = ''; label2.textContent = nextPage; } else { label2.style.display = 'none'; } }
        const formattedNext = nextPage.toString().padStart(3, '0');
        img2.style.opacity = '0';
        img2.src = getImagePath(currentMushafVariant, formattedNext, v.ext);
        img2.onload = () => { img2.style.opacity = '1'; };
        img2.onerror = () => { img2.style.opacity = '1'; };
        img2.style.maxHeight = '';
        img2.style.width = '';
        if (container2) container2.style.transform = 'none';
      } else {
        if (container2) container2.classList.remove('dual-active');
        if (sep) sep.style.display = 'none';
        if (label1) label1.style.display = 'none';
        if (label2) label2.style.display = 'none';
      }
      if (!isDual && isFitW) {
        container.style.transform = 'none';
        img.style.maxHeight = '';
        img.style.width = '';
      } else if (!isDual && window.innerWidth >= 700) {
        container.style.transform = `scale(${sx}, ${sy})`;
        const headerEl = document.getElementById('appHeader');
        const availH = window.innerHeight - (headerEl ? headerEl.offsetHeight : 44) - 90;
        img.style.maxHeight = Math.floor(availH / sy) + 'px';
        img.style.width = 'auto';
      } else if (!isDual) {
        container.style.transform = `scale(${sx}, ${sy}) translate(${cal.imgshiftX * 100}%, ${cal.imgshiftY * 100}%)`;
        img.style.maxHeight = '';
        img.style.width = '';
      }
      img.onload = () => {
        img.style.opacity = '1';
        const overlay = document.getElementById('highlightOverlay');
        overlay.style.width  = img.offsetWidth  + 'px';
        overlay.style.height = img.offsetHeight + 'px';
        loadAyahHighlights(currentPage);
        if (pendingSearchJump) {
          const { surah, ayah } = pendingSearchJump;
          pendingSearchJump = null;
          const targetHighlights = document.querySelectorAll(`.ayah-highlight[data-surah="${surah}"][data-ayah="${ayah}"]`);
          if (targetHighlights.length > 0) {
            targetHighlights.forEach(el => el.classList.add('active'));
            windowCurrentAyahGlobal = { surah, ayah };
            setTimeout(() => {
              targetHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        } else if (windowCurrentAyahGlobal && isPlaying) {
          highlightAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
        }
      };
      img.onerror = () => { img.style.opacity = '1'; };
      if(typeof updateMeta === 'function') updateMeta();
      localStorage.setItem('lastPage', currentPage);
      updateBookmarkStar();
      updatePageLabels();
      trackQuranReading();
    }

    // ========== AYAH HIGHLIGHT RENDERING (uses SQLite coords) ==========

    function getVariantImageDims() {
      switch (currentMushafVariant) {
        case 'mushaf-madina1441': return { w: 1024, h: 1656 };
        case 'mushaf-colored': return { w: 900, h: 1440 };
        case 'mushaf-tajweed': return { w: 600, h: 933 };
        case 'mushaf-borderd': return { w: 682, h: 959 };
        case 'mushaf-green':  return { w: 682, h: 959 };
        default: return { w: 900, h: 1440 };
      }
    }

    function loadAyahHighlights(pageNumber) {
      const overlay = document.getElementById('highlightOverlay');
      const img = document.getElementById('pageImg');
      overlay.innerHTML = '';

      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(pageNumber);
      } else {
        rects = getLegacyCoordsForPage(pageNumber);
      }
      if (!rects || rects.length === 0) return;
      drawAyahHighlights(rects, img, overlay);
    }

    const HL_PAD_X = 0.03;

function getVariantHighlightCal() {
      switch (currentMushafVariant) {
        case 'mushaf-madina1441':
          return {
           refW: 415, refH: 650,
            scaleX: 1.069968, scaleY: 0.949994,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.139991, shiftY: 0.015000,
            imgScaleX: 1.03, imgScaleY: 1.09,
            imgshiftX: 0.0, imgshiftY: -0.060
          };
        case 'mushaf-tajweed':
          return {
            refW: 415, refH: 650,
            scaleX: 1.049968, scaleY: 0.919878,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.129993, shiftY: 0.029069,
            imgScaleX: 1.02, imgScaleY: 1.1,
            imgshiftX: 0.0, imgshiftY: -0.065
          };
        case 'mushaf-borderd':
          return {
            refW: 415, refH: 650,
             scaleX: 0.959980, scaleY: 1.001,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.0, pageBotY: 1.00,
            shiftX: -0.089997, shiftY: -0.013969,
            imgScaleX: 1.2, imgScaleY: 1.4,
            imgshiftX: 0.0, imgshiftY: -0.005
          };
        case 'mushaf-green':
          return {
            refW: 415, refH: 650,
             scaleX: 0.979976, scaleY: 0.890,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.0, pageBotY: 1.00,
            shiftX: -0.089997, shiftY: 0.045083,
            imgScaleX: 1.2, imgScaleY: 1.3,
            imgshiftX: 0.0, imgshiftY: -0.055
          };
        case 'mushaf-colored':
        default:
          return {
            refW: 1024, refH: 1636,
             scaleX: 1.089985, scaleY: 1.00,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.070002, shiftY: 0.001038,
            imgScaleX: 0.99, imgScaleY: 1.15,
            imgshiftX: 0.0, imgshiftY: 0.010
          };
      }
    }


    function drawAyahHighlights(rects, img, overlay) {
      overlay.style.direction = 'ltr';
      const cal = getVariantHighlightCal();

      for (let rect of rects) {
        const div = document.createElement('div');
        div.className = 'ayah-highlight';
        div.setAttribute('data-surah', rect.surah);
        div.setAttribute('data-ayah', rect.ayah);

        const yRange = cal.pageBotY - cal.pageTopY;

        const leftPct   = (rect.x / cal.refW) * cal.scaleX * 100 + HL_PAD_X * 100 + cal.shiftX * 100;
        const widthPct  = (rect.w / cal.refW) * cal.scaleX * 100;
        const topPct    = (cal.pageTopY + (rect.y / cal.refH) * yRange) * cal.scaleY * 100 + (cal.padTop + cal.shiftY) * 100;
        const heightPct = (rect.h / cal.refH) * yRange * cal.scaleY * 100;

        div.style.left = leftPct + '%';
        div.style.top = topPct + '%';
        div.style.width = widthPct + '%';
        div.style.height = heightPct + '%';

        let clickCount = 0;
        let singleClickTimer;
        div.onclick = (e) => {
          e.stopPropagation();
          clickCount++;
          if (clickCount === 1) {
            singleClickTimer = setTimeout(() => {
              clickCount = 0;
              toggleHeaderUI();
            }, 300);
          } else if (clickCount === 2) {
            clearTimeout(singleClickTimer);
            clickCount = 0;
            highlightAyah(rect.surah, rect.ayah);
            showMiniPlayerForAyah(rect.surah, rect.ayah, false);
          }
        };

        let pressTimer;
        div.addEventListener('touchstart', (e) => {
          pressTimer = setTimeout(() => { highlightAyah(rect.surah, rect.ayah); showContextMenu(rect.surah, rect.ayah); }, 500);
        });
        div.addEventListener('touchend', () => clearTimeout(pressTimer));
        div.addEventListener('touchmove', () => clearTimeout(pressTimer));
        div.addEventListener('contextmenu', (e) => { e.preventDefault(); highlightAyah(rect.surah, rect.ayah); showContextMenu(rect.surah, rect.ayah); });

        if (windowCurrentAyahGlobal && windowCurrentAyahGlobal.surah == rect.surah && windowCurrentAyahGlobal.ayah == rect.ayah) {
          div.classList.add('active');
        }
        overlay.appendChild(div);
      }
    }

    function highlightAyah(surah, ayah) {
      if(!surah || !ayah) return;
      document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
      const targetHighlights = document.querySelectorAll(`.ayah-highlight[data-surah="${surah}"][data-ayah="${ayah}"]`);
      if (targetHighlights.length > 0) targetHighlights.forEach(el => el.classList.add('active'));
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
    }

    document.getElementById('mushafContainer').addEventListener('click', (e) => {
      if(e.target.id === 'pageImg' || e.target.id === 'highlightOverlay') {
        toggleHeaderUI();
      }
    });

    // ========== AUDIO PLAYER ==========
    const svgPlay = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="padding:13%"><path d="M8 5v14l11-7z"/></svg>`;
    const svgPause = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="padding:13%"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    let audioPlayer = new Audio();
    const preloaderAudio = new Audio();

    let currentReciter = localStorage.getItem('quranReciter') || 'ar.minshawi';
    let isPlaying = false;
    let currentPlaylist = [];
    let currentIndex = 0;
    let currentVerseRepeat = 0;
    let currentRangeRepeat = 0;

    const miniPlayer = document.getElementById('audioMiniPlayer');
    const expandedSheet = document.getElementById('audioExpandedSheet');
    const miniReciterName = document.getElementById('miniReciterName');
    const miniPlayPause = document.getElementById('miniPlayPauseBtn');
    const expandedPlayPause = document.getElementById('expandedPlayPauseBtn');
    const prevBtn = document.getElementById('prevAyahBtn');
    const nextBtn = document.getElementById('nextAyahBtn');
    const expandedReciterSelect = document.getElementById('expandedReciterSelect');

    const verseRepeatToggle = document.getElementById('verseRepeatToggle');
    const verseRepeatGroup = document.getElementById('verseRepeatGroup');
    const verseRepeatInput = document.getElementById('verseRepeatCount');
    const rangeRepeatToggle = document.getElementById('rangeRepeatToggle');
    const rangeRepeatGroup = document.getElementById('rangeRepeatGroup');
    const rangeRepeatInput = document.getElementById('rangeRepeatCount');
    const rangeFromInput = document.getElementById('rangeFromInput');
    const rangeToInput = document.getElementById('rangeToInput');
    const speedSelect = document.getElementById('playbackSpeed');

    miniPlayPause.innerHTML = svgPlay;
    expandedPlayPause.innerHTML = svgPlay;

    verseRepeatToggle.addEventListener('change', (e) => {
        if(e.target.checked) verseRepeatGroup.classList.add('active');
        else verseRepeatGroup.classList.remove('active');
    });
    rangeRepeatToggle.addEventListener('change', (e) => {
        if(e.target.checked) rangeRepeatGroup.classList.add('active');
        else rangeRepeatGroup.classList.remove('active');
    });

    function updateReciterUI() {
      if(expandedReciterSelect) {
          let exists = Array.from(expandedReciterSelect.options).some(opt => opt.value === currentReciter);
          if (!exists && expandedReciterSelect.options.length > 0) {
              currentReciter = expandedReciterSelect.options[0].value;
          }
          expandedReciterSelect.value = currentReciter;
          if(expandedReciterSelect.selectedIndex >= 0) {
              const opt = expandedReciterSelect.options[expandedReciterSelect.selectedIndex];
              if(miniReciterName) miniReciterName.textContent = opt.dataset.short || opt.text;
              const tn = document.getElementById('reciterTriggerName');
              if(tn) tn.textContent = opt.text;
          }
      }
      localStorage.setItem('quranReciter', currentReciter);
    }

    function toggleReciterPicker() {
      const wrap = document.querySelector('.reciter-wrapper');
      if (!wrap) return;
      const opening = !wrap.classList.contains('rp-open');
      wrap.classList.toggle('rp-open', opening);
      if (opening) {
        buildReciterPicker();
        setTimeout(() => {
          document.addEventListener('click', closeReciterPickerOutside, { once: true });
        }, 0);
      }
    }
    function closeReciterPickerOutside(e) {
      if (!e.target.closest('.reciter-wrapper')) {
        document.querySelector('.reciter-wrapper')?.classList.remove('rp-open');
      }
    }
    function buildReciterPicker() {
      const panel = document.getElementById('reciterPickerEl');
      if (!panel) return;
      panel.innerHTML = '';
      const sel = document.getElementById('expandedReciterSelect');
      [...sel.children].forEach(child => {
        if (child.tagName === 'OPTGROUP') {
          const lbl = document.createElement('div');
          lbl.className = 'rp-group-lbl';
          lbl.textContent = child.label;
          panel.appendChild(lbl);
          [...child.children].forEach(opt => panel.appendChild(makeRpItem(opt, sel)));
        } else if (child.tagName === 'OPTION') {
          panel.appendChild(makeRpItem(child, sel));
        }
      });
    }
    function makeRpItem(opt, sel) {
      const item = document.createElement('div');
      item.className = 'rp-item' + (opt.value === sel.value ? ' rp-active' : '');
      item.innerHTML = `<div class="rp-dot"></div><div class="rp-name">${opt.text}</div>`;
      item.onclick = (e) => {
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change'));
        document.querySelector('.reciter-wrapper')?.classList.remove('rp-open');
      };
      return item;
    }

    async function fetchAudioData(surah, ayah) {
      const reference = `${surah}:${ayah}`;
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${reference}/${currentReciter}`);
        const data = await res.json();
        if(data.code === 200 && data.data) return data.data;
      } catch(e) { console.error(e); }
      return null;
    }

    async function preloadNext() {
       if(!windowCurrentAyahGlobal) return;
       let nextSurah = windowCurrentAyahGlobal.surah;
       let nextAyahNum = windowCurrentAyahGlobal.ayah + 1;
       const rTo = parseInt(rangeToInput.value);
       const rFrom = parseInt(rangeFromInput.value) || 1;
       const rCount = parseInt(rangeRepeatInput.value) || 1;
       const vRepeat = parseInt(verseRepeatInput.value) || 1;
       if (verseRepeatToggle.checked && currentVerseRepeat < vRepeat - 1) {
           nextAyahNum = windowCurrentAyahGlobal.ayah;
       } else if (rangeRepeatToggle.checked && rTo > 0 && windowCurrentAyahGlobal.ayah >= rTo) {
           if (currentRangeRepeat < rCount - 1) nextAyahNum = rFrom;
           else return;
       } else {
         const maxAyah = ayahCountMap[nextSurah] || AYAH_COUNTS_FALLBACK[nextSurah] || 286;
         if (nextAyahNum > maxAyah) { nextSurah++; nextAyahNum = 1; }
         if (nextSurah > 114) return;
       }
       const nextData = await fetchAudioData(nextSurah, nextAyahNum);
       if (nextData && nextData.audio) {
           preloaderAudio.src = nextData.audio;
           preloaderAudio.preload = 'auto';
           preloaderAudio.load();
       }
    }

    async function startPlayback(surah, ayah) {
      if(!surah || !ayah) return;
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      const data = await fetchAudioData(surah, ayah);
      if(!data) {
          const next = await getNextAyahDb(surah, ayah);
          if (next) { startPlayback(next.surah, next.ayah); }
          else { stopAudio(); showCustomToast("ØªÙ… Ø®ØªÙ… Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…"); }
          return;
      }
      currentPlaylist = [{ surah, ayah, audioUrl: data.audio, page: data.page }];
      currentIndex = 0;
      playCurrent();
    }

    function playCurrent() {
      if(currentIndex >= currentPlaylist.length) { stopAudio(); return; }
      const item = currentPlaylist[currentIndex];
      windowCurrentAyahGlobal = { surah: item.surah, ayah: item.ayah };
      if (item.page && item.page !== currentPage) { window.goToPage(item.page); }
      audioPlayer.src = item.audioUrl;
      audioPlayer.playbackRate = parseFloat(speedSelect.value);
      audioPlayer.play().catch(e => showCustomToast("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„ØªØ´ØºÙŠÙ„"));
      isPlaying = true; updatePlayButtons(true);
      highlightAyah(item.surah, item.ayah);
      preloadNext();
      if ('mediaSession' in navigator) {
        const surahName = document.getElementById('surahLabel')?.textContent || `Ø³ÙˆØ±Ø© ${item.surah}`;
        const recOpt = expandedReciterSelect.options[expandedReciterSelect.selectedIndex];
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  `${surahName} â€” Ø§Ù„Ø¢ÙŠØ© ${item.ayah}`,
          artist: recOpt ? recOpt.text : '',
          album:  'Ø§Ù„Ù…ØµØ­Ù Ø§Ù„Ø´Ø±ÙŠÙ',
          artwork: [
            { src: '../icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '../icons/icon_512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.setActionHandler('play',          () => { audioPlayer.play(); isPlaying = true;  updatePlayButtons(true); });
        navigator.mediaSession.setActionHandler('pause',         () => { audioPlayer.pause(); isPlaying = false; updatePlayButtons(false); });
        navigator.mediaSession.setActionHandler('nexttrack',     () => nextAyah());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevAyah());
      }
    }

    async function nextAyah() {
       if(!windowCurrentAyahGlobal) {
           const first = await getFirstAyahOfPage(currentPage);
           if (first) { windowCurrentAyahGlobal = first; } else return;
       }
       const rTo = parseInt(rangeToInput.value);
       const rFrom = parseInt(rangeFromInput.value) || 1;
       const rCount = parseInt(rangeRepeatInput.value) || 1;
       if (rangeRepeatToggle.checked && rTo > 0 && windowCurrentAyahGlobal.ayah >= rTo) {
           if (currentRangeRepeat < rCount - 1) {
               currentRangeRepeat++;
               startPlayback(windowCurrentAyahGlobal.surah, rFrom);
           } else {
               stopAudio(); currentRangeRepeat = 0;
           }
       } else {
           const next = await getNextAyahDb(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
           if (next) {
               startPlayback(next.surah, next.ayah);
           } else {
               stopAudio(); showCustomToast("ØªÙ… Ø®ØªÙ… Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…");
           }
       }
    }

    async function prevAyah() {
       if(!windowCurrentAyahGlobal) {
           const first = await getFirstAyahOfPage(currentPage);
           if (first) { windowCurrentAyahGlobal = first; } else return;
       }
       const prev = await getPrevAyahDb(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
       if (prev) {
           startPlayback(prev.surah, prev.ayah);
       } else {
           showCustomToast("Ù‡Ø°Ù‡ Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ù…ØµØ­Ù");
       }
    }

    async function togglePlayPause(e) {
      if(e) e.stopPropagation();
      if(isPlaying) { audioPlayer.pause(); isPlaying = false; updatePlayButtons(false); }
      else {
        if(audioPlayer.src && currentPlaylist.length && currentPlaylist[0].surah === windowCurrentAyahGlobal?.surah && currentPlaylist[0].ayah === windowCurrentAyahGlobal?.ayah) {
            audioPlayer.play(); isPlaying = true; updatePlayButtons(true);
        } else if(windowCurrentAyahGlobal) {
            startPlayback(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
        } else {
            const first = await getFirstAyahOfPage(currentPage);
            if (first) {
                windowCurrentAyahGlobal = first;
                startPlayback(first.surah, first.ayah);
            } else {
                showCustomToast("Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ­Ø¯ÙŠØ¯ Ø¢ÙŠØ© Ø£ÙˆÙ„Ø§Ù‹");
            }
        }
      }
    }

    function updatePlayButtons(playing) {
      miniPlayPause.innerHTML = playing ? svgPause : svgPlay;
      expandedPlayPause.innerHTML = playing ? svgPause : svgPlay;
    }

    function stopAudio() {
      audioPlayer.pause(); audioPlayer.currentTime = 0; isPlaying = false; updatePlayButtons(false);
      document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
    }

    audioPlayer.onended = () => {
      if (verseRepeatToggle.checked) {
          const vRepeat = parseInt(verseRepeatInput.value) || 1;
          if(currentVerseRepeat < vRepeat - 1) { currentVerseRepeat++; playCurrent(); return; }
      }
      currentVerseRepeat = 0;
      nextAyah();
    };

    speedSelect.onchange = () => { if(audioPlayer) audioPlayer.playbackRate = parseFloat(speedSelect.value); };

    // â”€â”€ Desktop page nav â”€â”€
    function updateDesktopNavButtons() {
      const prev = document.getElementById('desktopPrevBtn');
      const next = document.getElementById('desktopNextBtn');
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (prev) prev.classList.toggle('disabled', currentPage <= 1);
      if (next) next.classList.toggle('disabled', currentPage >= 604);
    }
    window.desktopNavPrev = function() {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (currentPage > 1) goToPage(currentPage - step);
    };
    window.desktopNavNext = function() {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (currentPage < 604) goToPage(currentPage + step);
    };

    /* â”€â”€ Fit-width & dual-page modes (desktop only) â”€â”€ */
    let fitWidth = localStorage.getItem('quranFitWidth') === '1';
    let dualPage = localStorage.getItem('quranDualPage') === '1';

    window.toggleFitWidth = function() {
      if (window.innerWidth < 700) return;
      fitWidth = !fitWidth;
      dualPage = false;
      localStorage.setItem('quranFitWidth', fitWidth ? '1' : '0');
      localStorage.setItem('quranDualPage', '0');
      document.body.classList.toggle('fit-width', fitWidth);
      document.body.classList.remove('dual-page');
      document.getElementById('fitWidthBtn')?.classList.toggle('mode-active', fitWidth);
      document.getElementById('dualPageBtn')?.classList.remove('mode-active');
      updateContent();
    };
    window.toggleDualPage = function() {
      if (window.innerWidth < 700) return;
      dualPage = !dualPage;
      fitWidth = false;
      localStorage.setItem('quranDualPage', dualPage ? '1' : '0');
      localStorage.setItem('quranFitWidth', '0');
      document.body.classList.toggle('dual-page', dualPage);
      document.body.classList.remove('fit-width');
      document.getElementById('dualPageBtn')?.classList.toggle('mode-active', dualPage);
      document.getElementById('fitWidthBtn')?.classList.remove('mode-active');
      if (dualPage && currentPage % 2 === 0 && currentPage > 1) currentPage--;
      updateContent();
    };
    function initDesktopModes() {
      if (window.innerWidth >= 700) {
        const fb = document.getElementById('fitWidthBtn');
        const db = document.getElementById('dualPageBtn');
        if (fb) { fb.style.display = ''; fb.classList.toggle('mode-active', fitWidth); }
        if (db) { db.style.display = ''; db.classList.toggle('mode-active', dualPage); }
      }
      document.body.classList.toggle('fit-width', fitWidth && window.innerWidth >= 700);
      document.body.classList.toggle('dual-page', dualPage && window.innerWidth >= 700);
    }
    initDesktopModes();
    window.addEventListener('resize', initDesktopModes);

    // â”€â”€ Sync audio player width to mushaf image â”€â”€
    function syncPlayerWidth() {
      const player = document.getElementById('audioMiniPlayer');
      if (!player) return;
      if (window.innerWidth < 700) { player.style.left = ''; player.style.right = ''; return; }
      const img = document.getElementById('pageImg');
      if (!img || !img.offsetWidth) return;
      const rect = img.getBoundingClientRect();
      const pad = 4;
      player.style.left  = Math.max(8, Math.round(rect.left  + pad)) + 'px';
      player.style.right = Math.max(8, Math.round(window.innerWidth - rect.right + pad)) + 'px';
    }

    // â”€â”€ Header/UI show-hide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let _headerHidden     = false;
    let _headerToggleLock = false;
    let _headerLastShown  = Date.now();

    function setHeaderVisible(show) {
      if (window.innerWidth >= 700) return; // pinned on desktop via CSS
      if (_headerHidden === !show) return;
      if (!show && Date.now() - _headerLastShown < 1500) return;
      if (show) _headerLastShown = Date.now();
      _headerHidden = !show;
      const header = document.getElementById('appHeader');
      header.classList.toggle('hidden-ui', !show);
      if (!show) {
        miniPlayer.classList.add('hidden-ui');
        miniPlayer.classList.remove('visible');
        if (!isPlaying) {
          document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
          windowCurrentAyahGlobal = null;
        }
      }
    }

    function toggleHeaderUI() {
      if (window.innerWidth >= 700) return;
      if (_headerToggleLock) return;
      _headerToggleLock = true;
      setTimeout(() => { _headerToggleLock = false; }, 420);
      setHeaderVisible(_headerHidden);
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    function showMiniPlayerForAyah(surah, ayah, autoplay = false) {
      setHeaderVisible(true); // ensure header is visible when mini-player appears
      miniPlayer.classList.remove('hidden-ui');
      miniPlayer.classList.add('visible');
      rangeFromInput.value = ayah; rangeToInput.value = ''; currentRangeRepeat = 0;
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      if(autoplay) {
         startPlayback(surah, ayah);
      } else {
         if(audioPlayer.src && isPlaying) stopAudio();
         updatePlayButtons(false);
         highlightAyah(surah, ayah);
      }
    }

    function toggleExpandPlayer() {
      expandedSheet.classList.add('visible');
      document.getElementById('audioSheetBackdrop').classList.add('visible');
    }
    function openRepeatSettings() { closeContextMenu(); toggleExpandPlayer(); }

    expandedPlayPause.onclick = () => togglePlayPause();
    prevBtn.onclick = prevAyah; nextBtn.onclick = nextAyah;
    expandedReciterSelect.onchange = () => {
      currentReciter = expandedReciterSelect.value;
      updateReciterUI();
      if(currentPlaylist.length) startPlayback(currentPlaylist[0].surah, currentPlaylist[0].ayah);
    };
    function closeAudioExpanded() {
      expandedSheet.classList.remove('visible');
      document.getElementById('audioSheetBackdrop').classList.remove('visible');
    }

    // ========== CONTEXT MENU ==========
    const contextSheet = document.getElementById('contextMenuSheet');

    function setupSheetDragClose(sheet) {
      if(!sheet) return;
      let touchStartY = 0, touchCurrentY = 0, isDragging = false;
      const backdropMap = {
        audioExpandedSheet: 'audioSheetBackdrop',
        contextMenuSheet: 'contextSheetBackdrop',
        tafsirModal: 'tafsirSheetBackdrop'
      };
      const onStart = (e) => {
        if (e.target.closest('.reciter-selector') || e.target.closest('.reciter-trigger') || e.target.closest('.reciter-picker') || e.target.closest('input') || e.target.closest('button')) return;
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDragging = true;
      };
      const onMove = (e) => {
        if (!isDragging) return;
        touchCurrentY = e.touches[0].clientY;
        const diff = touchCurrentY - touchStartY;
        if (diff > 0) {
          sheet.style.transform = `translateY(${Math.min(diff, 250)}px)`;
          sheet.style.transition = 'none';
        }
      };
      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const diff = touchCurrentY - touchStartY;
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (diff > 80) {
          sheet.classList.remove('visible');
          const backdropId = backdropMap[sheet.id];
          if (backdropId) document.getElementById(backdropId).classList.remove('visible');
        }
      };
      sheet.addEventListener('touchstart', onStart, {passive:true});
      sheet.addEventListener('touchmove', onMove, {passive:true});
      sheet.addEventListener('touchend', onEnd, {passive:true});
    }

    function showContextMenu(surah, ayah) {
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      document.getElementById('contextPlayBtn').style.display = 'flex';
      document.getElementById('contextCopyBtn').style.display = 'flex';
      document.getElementById('contextTafsirBtn').style.display = 'flex';
      document.getElementById('contextTasmeeBtn').style.display = 'flex';
      updateContextMushafLabel();
      contextSheet.classList.add('visible');
      document.getElementById('contextSheetBackdrop').classList.add('visible');
    }

    function showGeneralMenu() {
        document.getElementById('contextPlayBtn').style.display = 'none';
        document.getElementById('contextCopyBtn').style.display = 'none';
        document.getElementById('contextTafsirBtn').style.display = 'none';
        document.getElementById('contextTasmeeBtn').style.display = 'none';
        updateContextMushafLabel();
        contextSheet.classList.add('visible');
        document.getElementById('contextSheetBackdrop').classList.add('visible');
    }

    function updateContextMushafLabel() {
      const label = document.getElementById('contextMushafLabel');
      if (label) label.textContent = getVariantInfo(currentMushafVariant).nameAr;
    }

    function closeContextMenu() {
      contextSheet.classList.remove('visible');
      document.getElementById('contextSheetBackdrop').classList.remove('visible');
    }
    function navigateToJuz()   { closeContextMenu(); openJuzSelector(); }
    function navigateToSurah() { closeContextMenu(); openSurahSelector(); }
    function navigateToPage()  { closeContextMenu(); openPageSelector(); }

    function contextPlayAyah() {
      closeContextMenu();
      if(windowCurrentAyahGlobal) showMiniPlayerForAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, true);
    }

    async function contextCopyAyah() {
      closeContextMenu();
      if(!windowCurrentAyahGlobal) return;
      const reference = `${windowCurrentAyahGlobal.surah}:${windowCurrentAyahGlobal.ayah}`;
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${reference}`);
        const data = await res.json();
        if(data.code === 200) { navigator.clipboard.writeText(data.data.text); showCustomToast("ØªÙ… Ù†Ø³Ø® Ø§Ù„Ø¢ÙŠØ©"); }
      } catch(e) { showCustomToast("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ù†Ø³Ø®"); }
    }

    // ========== V3 MUSHAF VARIANT MANAGEMENT ==========
    const MUSHAF_VARIANTS = [
      { id: 'mushaf-colored',    nameAr: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©',       desc: 'Ø§Ù„Ù…ØµØ­Ù Ø§Ù„Ù…Ù„ÙˆÙ† - Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ©',        ext: 'webp' },
      { id: 'mushaf-madina1441', nameAr: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© 1441', desc: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù†Ø¨ÙˆÙŠØ© - Ø·Ø¨Ø¹Ø© 1441',            ext: 'webp' },
      { id: 'mushaf-tajweed',    nameAr: 'Ù…ØµØ­Ù Ø§Ù„ØªØ¬ÙˆÙŠØ¯',       desc: 'Ù…ØµØ­Ù Ø§Ù„ØªØ¬ÙˆÙŠØ¯ Ø§Ù„Ù…Ù„ÙˆÙ†',                    ext: 'webp' },
      { id: 'mushaf-borderd',    nameAr: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© 1421', desc: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù†Ø¨ÙˆÙŠØ© - Ø·Ø¨Ø¹Ø© 1421',                 ext: 'png' },
      { id: 'mushaf-green',    nameAr: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø£Ø®Ø¶Ø±', desc: 'Ù…ØµØ­Ù Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø£Ø®Ø¶Ø± - Ù…Ø¬Ù…Ø¹ Ø§Ù„Ù…Ù„Ùƒ ÙÙ‡Ø¯',      ext: 'webp' },
      { id: 'mushaf-text',       nameAr: 'Ø§Ù„Ù…ØµØ­Ù Ø§Ù„Ù†ØµÙŠ',        desc: 'Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù†ØµÙŠØ© Ù„Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…',               ext: '' }
    ];

    let currentMushafVariant = localStorage.getItem('quranV3Variant') || 'mushaf-colored';
    document.body.setAttribute('data-variant', currentMushafVariant);

    let borderZoomState = false; // false=OUT (1.2,1.4), true=IN (1.0,1.3)
    let zoomHintTimeout = null;

    const THEME_NAMES = { golden:'Ø°Ù‡Ø¨ÙŠ',teal:'ÙÙŠØ±ÙˆØ²ÙŠ',crimson:'Ù‚Ø±Ù…Ø²ÙŠ',camel:'Ø¹Ø³Ù„ÙŠ',olive:'Ø²ÙŠØªÙˆÙ†ÙŠ',royal:'Ù…Ù„ÙƒÙŠ' };

    function setColorTheme(themeId) {
      if (!THEME_NAMES[themeId]) return;
      localStorage.setItem('quranColorTheme', themeId);
      document.body.setAttribute('data-color-theme', themeId);
      document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === themeId));
      const label = document.getElementById('colorThemeLabel');
      if (label) label.textContent = THEME_NAMES[themeId];
    }

    function setMushafVariant(variantId) {
      if (variantId === 'mushaf-text') {
        window.location.href = 'quran-text.html';
        return;
      }
      if (variantId !== currentMushafVariant) {
        currentMushafVariant = variantId;
        localStorage.setItem('quranV3Variant', variantId);
        document.body.setAttribute('data-variant', variantId);
        updateVariantUI();
        updateContent();
        const v = getVariantInfo(variantId);
        showCustomToast(`ØªÙ… Ø§Ù„ØªØ¨Ø¯ÙŠÙ„ Ø¥Ù„Ù‰ ${v.nameAr}`);
        if (variantId === 'mushaf-borderd' || variantId === 'mushaf-green') showZoomHint();
      }
    }

    function getVariantInfo(variantId) {
      return MUSHAF_VARIANTS.find(v => v.id === variantId) || MUSHAF_VARIANTS[0];
    }
    function getImagePath(variantId, page, ext) {
      const dir = variantId === 'mushaf-green' ? '../mushaf pages/madina-green'
                : variantId === 'mushaf-borderd' ? '../mushaf-2'
                : variantId === 'mushaf-tajweed' ? '../mushaf pages/tajweed'
                : variantId === 'mushaf-colored' ? '../mushaf pages/madina-1421'
                : '../mushaf pages/mushaf-madina-1441';
      return `${dir}/${page}.${ext}`;
    }

    function updateVariantUI() {
      const label = document.getElementById('currentMushafLabel');
      if (label) label.textContent = getVariantInfo(currentMushafVariant).nameAr;

      document.querySelectorAll('.mushaf-card').forEach(card => {
        card.classList.toggle('active', card.dataset.variant === currentMushafVariant);
      });
    }

    // ========== V3 MUSHAF SELECTOR MODAL ==========
    function openMushafSelectorModal() {
      const grid = document.getElementById('mushafGrid');
      grid.innerHTML = '';
      MUSHAF_VARIANTS.forEach(v => {
        const card = document.createElement('div');
        card.className = 'mushaf-card' + (v.id === currentMushafVariant ? ' active' : '');
        card.dataset.variant = v.id;
        card.onclick = () => { setMushafVariant(v.id); closeModal('mushafSelectorModal'); };

        const thumb = document.createElement('div');
        thumb.className = 'mushaf-card-thumb';
        const img = document.createElement('img');
        const thumbPage = v.id === 'mushaf-tajweed' ? '003' : '001';
        img.src = v.id === 'mushaf-text' ? '../img/txt.png' : getImagePath(v.id, thumbPage, v.ext);
        img.alt = v.nameAr;
        img.loading = 'lazy';
        img.onerror = function() { this.style.display = 'none'; };
        thumb.appendChild(img);

        const name = document.createElement('div');
        name.className = 'mushaf-card-name';
        name.textContent = v.nameAr;

        const desc = document.createElement('div');
        desc.className = 'mushaf-card-desc';
        desc.textContent = v.desc;

        if (v.id === 'mushaf-madina1441') {
          const badge = document.createElement('span');
          badge.className = 'mushaf-card-badge';
          badge.textContent = 'Ø§ÙØªØ±Ø§Ø¶ÙŠ';
          card.appendChild(badge);
        }

        card.appendChild(thumb);
        card.appendChild(name);
        card.appendChild(desc);
        grid.appendChild(card);
      });
      document.getElementById('mushafSelectorModal').classList.add('active');
    }

    // ========== CORE FUNCTIONALITY ==========
    function showCustomToast(message) {
      const toast = document.getElementById('customToast');
      if (!toast) return;
      toast.innerHTML = message; toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function openSettingsModal() {
      updateVariantUI();
      const theme = localStorage.getItem('quranColorTheme') || 'golden';
      const label = document.getElementById('colorThemeLabel');
      if (label) label.textContent = THEME_NAMES[theme] || 'Ø°Ù‡Ø¨ÙŠ';
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
      if (typeof getCurrentJuz === 'function') { const j = getCurrentJuz(); if(j) jName = `Ø§Ù„Ø¬Ø²Ø¡ ${j.number}`; }
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
          topPageName.textContent = `ØµÙØ­Ø© ${currentPage}-${currentPage + 1}`;
        } else {
          topPageName.textContent = `ØµÙØ­Ø© ${currentPage}`;
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
      else showCustomToast('Ø±Ù‚Ù… Ø§Ù„ØµÙØ­Ø© ØºÙŠØ± ØµØ­ÙŠØ­');
    }

    function toggleBookmark() {
      const surah = getCurrentSurah();
      if (!surah) return;
      let bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
      const key = `page_${currentPage}`;
      const exists = bookmarks.find(b => b.key === key);
      if (exists) { bookmarks = bookmarks.filter(b => b.key !== key); showCustomToast('ØªÙ…Øª Ø¥Ø²Ø§Ù„Ø© Ø§Ù„Ø¹Ù„Ø§Ù…Ø©'); }
      else { bookmarks.push({ key, surah: surah.name, page: currentPage }); showCustomToast('ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø¹Ù„Ø§Ù…Ø©'); }
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
        list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-hint); font-size:0.95rem;">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¹Ù„Ø§Ù…Ø§Øª Ù…Ø­ÙÙˆØ¸Ø©</div>';
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
      const ordinals = ['Ø§Ù„Ø£ÙˆÙ„','Ø§Ù„Ø«Ø§Ù†ÙŠ','Ø§Ù„Ø«Ø§Ù„Ø«','Ø§Ù„Ø±Ø§Ø¨Ø¹','Ø§Ù„Ø®Ø§Ù…Ø³','Ø§Ù„Ø³Ø§Ø¯Ø³','Ø§Ù„Ø³Ø§Ø¨Ø¹','Ø§Ù„Ø«Ø§Ù…Ù†','Ø§Ù„ØªØ§Ø³Ø¹','Ø§Ù„Ø¹Ø§Ø´Ø±','Ø§Ù„Ø­Ø§Ø¯ÙŠ Ø¹Ø´Ø±','Ø§Ù„Ø«Ø§Ù†ÙŠ Ø¹Ø´Ø±','Ø§Ù„Ø«Ø§Ù„Ø« Ø¹Ø´Ø±','Ø§Ù„Ø±Ø§Ø¨Ø¹ Ø¹Ø´Ø±','Ø§Ù„Ø®Ø§Ù…Ø³ Ø¹Ø´Ø±','Ø§Ù„Ø³Ø§Ø¯Ø³ Ø¹Ø´Ø±','Ø§Ù„Ø³Ø§Ø¨Ø¹ Ø¹Ø´Ø±','Ø§Ù„Ø«Ø§Ù…Ù† Ø¹Ø´Ø±','Ø§Ù„ØªØ§Ø³Ø¹ Ø¹Ø´Ø±','Ø§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø­Ø§Ø¯ÙŠ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø«Ø§Ù†ÙŠ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø«Ø§Ù„Ø« ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø±Ø§Ø¨Ø¹ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø®Ø§Ù…Ø³ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø³Ø§Ø¯Ø³ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø³Ø§Ø¨Ø¹ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø«Ø§Ù…Ù† ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„ØªØ§Ø³Ø¹ ÙˆØ§Ù„Ø¹Ø´Ø±ÙˆÙ†','Ø§Ù„Ø«Ù„Ø§Ø«ÙˆÙ†'];
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
            <span class="juz-card-ordinal">Ø§Ù„Ø¬Ø²Ø¡ ${ordinals[i]}</span>
            <span class="juz-card-surah">${surah ? surah.name : ''}</span>
          </div>
          <span class="juz-card-pages">${j.page}â€“${nextPage}</span>`;
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
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...`;
      let count = 0; const total = 604; const cacheName = `quran-pages-${currentMushafVariant}`;
      const v = getVariantInfo(currentMushafVariant);
      caches.open(cacheName).then(cache => {
        for (let i = 1; i <= total; i++) {
          const page = i.toString().padStart(3, '0'); const url = getImagePath(currentMushafVariant, page, v.ext);
          fetch(url).then(res => { if(res.ok) cache.put(url, res.clone()); count++; if(count===total) finish(); }).catch(()=>{ count++; if(count===total) finish(); });
        }
        function finish() {
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> ØªÙ… Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø¨Ù†Ø¬Ø§Ø­`;
          setTimeout(()=> {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ØªØ­Ù…ÙŠÙ„ Ø¬Ù…ÙŠØ¹ Ø§Ù„ØµÙØ­Ø§Øª Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¨Ø¯ÙˆÙ† Ø¥Ù†ØªØ±Ù†Øª`;
          }, 3000);
        }
      });
    }

    // ========== SEARCH ENGINE ==========
    let searchTimeout = null;

    function normalizeArabic(text) {
      return text.replace(/[Ø£Ø¥Ø¢Ø§]/g, 'Ø§')
                 .replace(/[Ø¤]/g, 'Ùˆ')
                 .replace(/[Ø¦Ù‰ÙŠ]/g, 'ÙŠ')
                 .replace(/[Ø©]/g, 'Ù‡')
                 .replace(/[Ù‹ÙŒÙÙŽÙÙÙ‘Ù’Ù“Ù”ï¹°ï¹±ï¹²ï¹³ï¹´ï¹¶ï¹·ï¹¸ï¹¹ï¹ºï¹»ï¹¼ï¹½ï¹¾ï¹¿]/g, '')
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
          '<div class="search-hint"><div class="search-hint-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>Ø§ÙƒØªØ¨ ÙƒÙ„Ù…Ø© Ù„Ù„Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…<br><span style="font-size:0.8rem;opacity:0.6;">ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø¢ÙŠØ§Øª ÙˆØ£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø³ÙˆØ±</span></div>';
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

      resultsDiv.innerHTML = '<div class="search-loading"><div class="spinner"></div>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¨Ø­Ø«...</div>';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const normalizedQuery = normalizeArabic(query);
        const surahResults = SURAH_MAP.filter(s => normalizeArabic(s.name).includes(normalizedQuery));
        Promise.all([
          fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/quran-simple-clean`)
            .then(r => r.json()).catch(() => null),
        ]).then(([apiData]) => {
          let html = '';
          // Surah results
          if (surahResults.length > 0) {
            html += '<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Ø§Ù„Ø³ÙˆØ±</div>';
            surahResults.forEach(s => {
              html += `<div class="search-result-item" onclick="goToPage(${s.page}); toggleSearchOverlay('close');">
                <div class="search-result-surah">
                  <div class="search-result-surah-num">${s.number}</div>
                  <div class="search-result-surah-name">${s.name.replace(new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="search-highlight">${m}</span>`)}</div>
                  <div class="search-result-surah-page">ØµÙØ­Ø© ${s.page}</div>
                </div>
              </div>`;
            });
          }
          // Ayah results
          if (apiData && apiData.code === 200 && apiData.data.count > 0) {
            const queryPattern = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const exactMatches = apiData.data.matches.filter(m => {
              const normText = normalizeArabic(m.text);
              return normText.includes(normalizedQuery);
            });
            if (exactMatches.length > 0) {
              const label = surahResults.length > 0 ? 'Ø§Ù„Ø¢ÙŠØ§Øª' : `${exactMatches.length} Ù†ØªÙŠØ¬Ø©`;
              html += `<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${label}</div>`;
              const display = exactMatches.slice(0, 25);
              html += display.map(m => {
                const normText = normalizeArabic(m.text);
                const idx = normText.indexOf(normalizedQuery);
                let displayText = m.text;
                if (idx !== -1) {
                  const re = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('').join('[Ù‹ÙŒÙÙŽÙÙÙ‘Ù’Ù“Ù”]*?'), 'gi');
                  displayText = m.text.replace(re, match => `<span class="search-highlight">${match}</span>`);
                }
                return `<div class="search-result-item" onclick="jumpToSearchResult(${m.number})">
                  <div class="res-meta">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    ${(SURAH_MAP.find(s => s.number === m.surah.number)?.name) || m.surah.name.replace(/Ø³ÙˆØ±Ø©|Ø³ÙÙˆØ±ÙŽØ©Ù|Ø³ÙÙˆØ±ÙŽØ©Ù/g, '').trim()} â€” Ø¢ÙŠØ© ${m.numberInSurah}
                  </div>
                  <div class="res-text">${displayText}</div>
                </div>`;
              }).join('');
              if (exactMatches.length > 25) {
                html += `<div style="text-align:center;padding:10px;color:var(--text-hint);font-size:0.85rem;">Ùˆ ${exactMatches.length - 25} Ù†ØªÙŠØ¬Ø© Ø£Ø®Ø±Ù‰...</div>`;
              }
            } else if (surahResults.length === 0) {
              html = `<div class="search-empty">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù„Ù€ "<strong>${query}</strong>"<br><span style="font-size:0.8rem;opacity:0.6;">Ø­Ø§ÙˆÙ„ Ø¨ÙƒÙ„Ù…Ø© Ù…Ø®ØªÙ„ÙØ©</span></div>`;
            }
          } else if (surahResults.length === 0) {
            html = `<div class="search-empty">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù„Ù€ "<strong>${query}</strong>"<br><span style="font-size:0.8rem;opacity:0.6;">Ø­Ø§ÙˆÙ„ Ø¨ÙƒÙ„Ù…Ø© Ù…Ø®ØªÙ„ÙØ©</span></div>`;
          }
          resultsDiv.innerHTML = html;
        }).catch(() => {
          if (surahResults.length > 0) {
            let html = '<div class="search-section-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Ø§Ù„Ø³ÙˆØ±</div>';
            surahResults.forEach(s => {
              html += `<div class="search-result-item" onclick="goToPage(${s.page}); toggleSearchOverlay('close');">
                <div class="search-result-surah">
                  <div class="search-result-surah-num">${s.number}</div>
                  <div class="search-result-surah-name">${s.name}</div>
                  <div class="search-result-surah-page">ØµÙØ­Ø© ${s.page}</div>
                </div>
              </div>`;
            });
            resultsDiv.innerHTML = html;
          } else {
            resultsDiv.innerHTML = '<div class="search-error">ØªØ¹Ø°Ø± Ø§Ù„Ø¨Ø­Ø«ØŒ ØªØ£ÙƒØ¯ Ù…Ù† Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª</div>';
          }
        });
      }, 400);
    }

    function jumpToSearchResult(ayahNumber) {
      const resultsDiv = document.getElementById('searchResults');
      resultsDiv.innerHTML = '<div style="text-align:center; padding:30px; color:var(--accent);">Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ù„Ù„ØµÙØ­Ø©...</div>';
      let cachedPage = localStorage.getItem('ayah_page_v1_' + ayahNumber);
      if (cachedPage) {
        executeJump(parseInt(cachedPage), ayahNumber);
      } else {
        fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 200) {
              const targetPage = data.data.page;
              localStorage.setItem('ayah_page_v1_' + ayahNumber, targetPage);
              executeJump(targetPage, ayahNumber);
            }
          })
          .catch(() => {
            resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger);">Ø­Ø¯Ø« Ø®Ø·Ø£ ÙÙŠ Ø¬Ù„Ø¨ Ø§Ù„ØµÙØ­Ø©.</div>';
          });
      }
    }

    let pendingSearchJump = null;

    function executeJump(targetPage, globalAyahNumber) {
      toggleSearchOverlay('close');
      fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNumber}`)
        .then(res => res.json())
        .then(data => {
          if (data.code === 200) {
            const surah = data.data.surah.number;
            const ayah = data.data.numberInSurah;
            pendingSearchJump = { surah, ayah };
            goToPage(targetPage);
            showCustomToast(`ØªÙ… Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ ØµÙØ­Ø© ${targetPage}`);
          }
        }).catch(e => {
          console.error(e);
          goToPage(targetPage);
          showCustomToast(`ØªÙ… Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ ØµÙØ­Ø© ${targetPage}`);
        });
    }

    // ========== ZOOM HINT ==========
    function dismissZoomHint() {
      const hint = document.getElementById('zoomHint');
      if (!hint) return;
      hint.classList.remove('show');
      hint.classList.add('hiding');
      clearTimeout(zoomHintTimeout);
    }
    function dismissZoomHintForever() {
      localStorage.setItem('zoom_hint_dismissed', '1');
      dismissZoomHint();
    }
    function showZoomHint() {
      if (localStorage.getItem('zoom_hint_dismissed') === '1') return;
      const hint = document.getElementById('zoomHint');
      if (!hint) return;
      hint.classList.remove('hiding');
      hint.classList.add('show');
      clearTimeout(zoomHintTimeout);
      zoomHintTimeout = setTimeout(() => {
        hint.classList.remove('show');
        hint.classList.add('hiding');
      }, 5000);
    }

    // ========== DOWNLOAD MODAL ==========
    const DL_KEY   = 'quranV3DlDone';
    const DL_CACHE = 'quran-mushaf-images-v1';
    const DL_SIZES = {
      'mushaf-colored':    '~65 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª',
      'mushaf-madina1441': '~70 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª',
      'mushaf-tajweed':    '~75 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª',
      'mushaf-borderd':    '~120 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª',
      'mushaf-green':      '~65 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª',
    };
    let dlSelected  = new Set(['mushaf-colored']);
    let dlRunning   = false;

    function dlInit() {
      if (localStorage.getItem(DL_KEY)) return;
      dlBuildCards();
      setTimeout(() => document.getElementById('dlModal')?.classList.add('active'), 800);
    }

    function dlBuildCards() {
      const wrap = document.getElementById('dlVariants');
      if (!wrap) return;
      wrap.innerHTML = '';
      MUSHAF_VARIANTS.filter(v => v.ext).forEach(v => {
        const sel  = dlSelected.has(v.id);
        const thumb = v.id === 'mushaf-tajweed' ? '003' : '001';
        const src   = getImagePath(v.id, thumb, v.ext);
        const div   = document.createElement('div');
        div.className = 'dl-vcard' + (sel ? ' dl-selected' : '');
        div.dataset.vid = v.id;
        div.innerHTML = `
          <div class="dl-thumb">
            <img src="${src}" alt="${v.nameAr}" loading="eager" onerror="this.style.opacity=0">
            <div class="dl-thumb-ov">
              <div class="dl-chk">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          </div>
          <div class="dl-vbody">
            <div class="dl-vname">${v.nameAr}</div>
            <div class="dl-vsize">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${DL_SIZES[v.id] || '~70 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª'}
            </div>
          </div>`;
        div.onclick = () => {
          if (dlSelected.has(v.id)) dlSelected.delete(v.id);
          else                       dlSelected.add(v.id);
          div.classList.toggle('dl-selected', dlSelected.has(v.id));
          document.getElementById('dlGoBtn').disabled = (dlSelected.size === 0);
        };
        wrap.appendChild(div);
      });
    }

    function dlSkip() {
      document.getElementById('dlModal')?.classList.remove('active');
      localStorage.setItem(DL_KEY, '1');
    }
    function dlClose() {
      document.getElementById('dlModal')?.classList.remove('active');
    }

    // â”€â”€ Minimize / restore â”€â”€
    function dlMinimize() {
      document.getElementById('dlModal').classList.remove('active');
      document.getElementById('dlMiniPill').classList.add('active');
    }
    function dlRestore() {
      document.getElementById('dlMiniPill').classList.remove('active');
      document.getElementById('dlModal').classList.add('active');
    }
    function dlSyncMiniPill(pct, variantName) {
      const fill = document.getElementById('dlMiniRingFill');
      if (fill) fill.style.strokeDashoffset = (94.25 * (1 - pct / 100)).toFixed(2);
      const pctEl = document.getElementById('dlMiniPct');
      if (pctEl) pctEl.textContent = pct + '%';
      const lbl = document.getElementById('dlMiniLabel');
      if (lbl) lbl.textContent = variantName;
    }
    let _dlToastTimer = null;
    function showDlCompleteToast(variantNames) {
      document.getElementById('dlMiniPill').classList.remove('active');
      const sub = document.getElementById('dlToastSub');
      if (sub) sub.textContent = variantNames.join(' Â· ');
      const bar = document.getElementById('dlToastBarFill');
      if (bar) { bar.style.animation = 'none'; bar.offsetWidth; bar.style.animation = ''; }
      document.getElementById('dlCompleteToast').classList.add('show');
      clearTimeout(_dlToastTimer);
      _dlToastTimer = setTimeout(hideDlCompleteToast, 5500);
    }
    function hideDlCompleteToast() {
      document.getElementById('dlCompleteToast')?.classList.remove('show');
    }

    function dlOpenFromSettings() {
      closeModal('settingsModal');
      // Reset modal to selection view
      document.getElementById('dlSelectSection').style.display   = 'block';
      document.getElementById('dlProgressSection').style.display = 'none';
      document.getElementById('dlDoneSection').style.display     = 'none';
      // Pre-select current variant
      dlSelected = new Set([currentMushafVariant]);
      dlBuildCards();
      document.getElementById('dlModal')?.classList.add('active');
    }

    async function dlStart() {
      if (dlRunning || dlSelected.size === 0) return;
      dlRunning = true;
      document.getElementById('dlSelectSection').style.display  = 'none';
      document.getElementById('dlProgressSection').style.display = 'block';

      const variants   = [...dlSelected];
      const totalPages = variants.length * 604;
      let   done       = 0;
      const BATCH      = 6;
      let   cache      = null;
      try { cache = 'caches' in window ? await caches.open(DL_CACHE) : null; } catch {}

      for (const vid of variants) {
        const v = MUSHAF_VARIANTS.find(m => m.id === vid);
        if (!v?.ext) continue;
        document.getElementById('dlProgName').textContent = v.nameAr;

        for (let p = 1; p <= 604; p += BATCH) {
          const batch = [];
          for (let i = p; i < Math.min(p + BATCH, 605); i++) {
            const pad  = i.toString().padStart(3, '0');
            const path = getImagePath(vid, pad, v.ext);
            batch.push(
              fetch(path).then(r => { if (r.ok && cache) cache.put(path, r); }).catch(() => {})
            );
          }
          await Promise.all(batch);
          done += batch.length;
          const pct = Math.round((done / totalPages) * 100);
          const pageNum = Math.min(p + BATCH - 1, 604);
          document.getElementById('dlPct').textContent      = pct + '%';
          document.getElementById('dlBarFill').style.width  = pct + '%';
          document.getElementById('dlProgPages').textContent = `ØµÙØ­Ø© ${pageNum} Ù…Ù† Ù¦Ù Ù¤`;
          document.getElementById('dlStatusMsg').textContent = `Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„â€¦  ${done} / ${totalPages}`;
          document.getElementById('dlRingFill').style.strokeDashoffset =
            (307.88 * (1 - pct / 100)).toFixed(2);
          dlSyncMiniPill(pct, v.nameAr);
        }
      }

      dlRunning = false;
      localStorage.setItem(DL_KEY, '1');

      // Switch to a downloaded variant: keep current if it was downloaded, else use first downloaded
      const downloadedList = variants;
      const targetVariant  = downloadedList.includes(currentMushafVariant)
                             ? currentMushafVariant
                             : downloadedList[0];
      if (targetVariant && targetVariant !== currentMushafVariant) {
        setMushafVariant(targetVariant);
      }

      document.getElementById('dlProgressSection').style.display = 'none';
      document.getElementById('dlDoneSection').style.display     = 'block';
      document.getElementById('dlModal').classList.remove('active');
      showDlCompleteToast(variants.map(vid => {
        const v = MUSHAF_VARIANTS.find(m => m.id === vid);
        return v ? v.nameAr : vid;
      }));
    }

    // ========== SWIPE LOGIC ==========
    // Robust horizontal swipe: use clientX (screenX is unreliable in some Android
    // browsers/webviews, giving diff~0 = no turn), fire as soon as the horizontal
    // threshold is crossed during touchmove (so it still works when the browser ends
    // the gesture with touchcancel), and ignore mostly-vertical moves so scrolling works.
    let pageSwipeStartX = 0, pageSwipeStartY = 0, pageSwipeActive = false, pageSwipeFired = false;
    function _pageSwipeBlocked(t) {
      return !t || !t.closest || t.closest('.modal-content') || t.closest('.audio-expanded-sheet') ||
             t.closest('.audio-mini-player') || t.closest('input');
    }
    function _pageSwipeGo(diff) {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (diff > 0) { if (currentPage < 604) goToPage(currentPage + step); }
      else { if (currentPage > 1) goToPage(currentPage - step); }
    }
    document.addEventListener('touchstart', e => {
      pageSwipeActive = false; pageSwipeFired = false;
      if (fitWidth && window.innerWidth >= 700) return;
      if (_pageSwipeBlocked(e.target)) return;
      const t = e.changedTouches[0];
      pageSwipeStartX = t.clientX; pageSwipeStartY = t.clientY;
      pageSwipeActive = true;
    }, {passive: true});
    document.addEventListener('touchmove', e => {
      if (!pageSwipeActive || pageSwipeFired) return;
      if (e.touches && e.touches.length > 1) { pageSwipeActive = false; return; } // pinch, not swipe
      const t = e.changedTouches[0];
      const dx = t.clientX - pageSwipeStartX, dy = t.clientY - pageSwipeStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        pageSwipeFired = true;
        _pageSwipeGo(dx);
      }
    }, {passive: true});
    function _pageSwipeEnd(e) {
      if (pageSwipeActive && !pageSwipeFired && e.changedTouches && e.changedTouches[0]) {
        const dx = e.changedTouches[0].clientX - pageSwipeStartX;
        const dy = e.changedTouches[0].clientY - pageSwipeStartY;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) _pageSwipeGo(dx);
      }
      pageSwipeActive = false; pageSwipeFired = false;
    }
    document.addEventListener('touchend', _pageSwipeEnd, {passive: true});
    document.addEventListener('touchcancel', _pageSwipeEnd, {passive: true});

    // ========== KEYBOARD NAV (desktop) ==========
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goToPage(currentPage - step); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); goToPage(currentPage + step); }
    });

    // ========== WINDOW INITIALIZATION ==========
    window.onload = function () {
      const imgCont = document.getElementById('mushafContainer');
      let pressTimerCont = null;
      imgCont.addEventListener('touchstart', (e) => {
        if(e.target.classList.contains('ayah-highlight')) return;
        pressTimerCont = setTimeout(() => { showGeneralMenu(); e.preventDefault(); }, 600);
      });
      imgCont.addEventListener('touchend', () => clearTimeout(pressTimerCont));
      imgCont.addEventListener('touchmove', () => clearTimeout(pressTimerCont));

      // Pinch zoom for borderd variant
      let pinchStartDist = 0;
      imgCont.addEventListener('touchstart', e => {
        if (currentMushafVariant !== 'mushaf-borderd' && currentMushafVariant !== 'mushaf-green') return;
        if (e.touches.length === 2) {
          pinchStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
      }, {passive: true});
      imgCont.addEventListener('touchmove', e => {
        if (currentMushafVariant !== 'mushaf-borderd' && currentMushafVariant !== 'mushaf-green') return;
        if (e.touches.length === 2 && pinchStartDist > 0) {
          const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
          const threshold = 30;
          if (Math.abs(dist - pinchStartDist) > threshold) {
            borderZoomState = !borderZoomState;
            pinchStartDist = 0;
            updateContent();
          }
        }
      }, {passive: true});
      imgCont.addEventListener('touchend', e => {
        if (e.touches.length < 2) pinchStartDist = 0;
      }, {passive: true});
      imgCont.addEventListener('contextmenu', (e) => {
        if(e.target.classList.contains('ayah-highlight')) return;
        e.preventDefault(); showGeneralMenu();
      });

      if (typeof totalPages === 'undefined') window.totalPages = 604;
      if (typeof SURAH_MAP === 'undefined') window.SURAH_MAP = [];
      if (typeof JUZ_START_PAGES === 'undefined') window.JUZ_START_PAGES = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
      if (typeof getCurrentSurah === 'undefined') window.getCurrentSurah = function () { return null; };
      if (typeof getCurrentJuz === 'undefined') window.getCurrentJuz = function () { return null; };
      if (typeof updateMeta === 'undefined') window.updateMeta = function () { };

      const savedColorTheme = localStorage.getItem('quranColorTheme') || 'golden';
      document.body.setAttribute('data-color-theme', savedColorTheme);
      if (typeof commonInit === 'function') commonInit();

      updateVariantUI();
      checkDailyResetKhatma();

      // Load coordinate sources, then render
      Promise.all([
        initDatabase(),
        initMedinaCoords()
      ]).then(() => {
        updateContent();
      }).catch(() => {
        updateContent();
      });

      // Sync overlay size with image on any layout/viewport change
      const syncOverlay = () => {
        const img = document.getElementById('pageImg');
        const overlay = document.getElementById('highlightOverlay');
        if (img && overlay && img.offsetHeight > 0) {
          overlay.style.width  = img.offsetWidth  + 'px';
          overlay.style.height = img.offsetHeight + 'px';
        }
        syncPlayerWidth();
      };
      const ro = new ResizeObserver(syncOverlay);
      const imgEl = document.getElementById('pageImg');
      if (imgEl) ro.observe(imgEl);
      window.addEventListener('resize', syncOverlay);
      document.addEventListener('orientationchange', () => setTimeout(syncOverlay, 300));

      expandedReciterSelect.value = currentReciter;
      updateReciterUI();
      updateDesktopNavButtons();
      dlInit();

      // Backdrop click closes sheets
      document.getElementById('contextSheetBackdrop').addEventListener('click', closeContextMenu);
      document.getElementById('audioSheetBackdrop').addEventListener('click', closeAudioExpanded);
      document.getElementById('tafsirSheetBackdrop').addEventListener('click', closeTafsirModal);

      setupSheetDragClose(contextSheet);
      setupSheetDragClose(document.getElementById('tafsirModal'));
      setupSheetDragClose(expandedSheet);
    };

    function goHome() { window.location.href = '/Tasbee7/index.html'; }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(console.warn);

    // ============================================================
    //  TASMEE' CONTROLLER (quran.html â€” mushaf image mode)
    // ============================================================
    let tasmeeEngine = null;
    let tasmeeLastPage = null;
    let tasmeeCurrentAyahHighlight = -1;

    function openTasmeeSetup() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        showCustomToast('ÙˆØ¶Ø¹ Ø§Ù„ØªØ³Ù…ÙŠØ¹ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ… Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­ â€” Ø¬Ø±Ø¨ Chrome Ø£Ùˆ Edge');
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

    async function fetchTasmeeTextForPage(page) {
      const cacheKey = `tasmee_text_v1_${page}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
      const res = await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`);
      const data = await res.json();
      if (!data || data.code !== 200) throw new Error('ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ù†Øµ Ø§Ù„ØµÙØ­Ø©');
      const ayahData = data.data.ayahs.map(a => ({
        number: a.number,
        numberInSurah: a.numberInSurah,
        surahName: a.surah.name,
        text: a.text
      }));
      sessionStorage.setItem(cacheKey, JSON.stringify(ayahData));
      return ayahData;
    }

    function renderTasmeeTextPanel(ayahData) {
      const container = document.getElementById('tasmeeTextContent');
      if (!container) return;
      let html = '';
      ayahData.forEach((a, i) => {
        const numAr = a.numberInSurah.toLocaleString('ar-EG');
        html += `<span class="ayah-text" data-tasmee-ayah="${i}">${a.text}</span>`;
        html += `<span class="tasmee-ayah-end" style="color:var(--accent);font-size:0.85em;margin:0 4px;">ï´¿${numAr}ï´¾</span> `;
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

    function _tasmeeStartWithData(ayahData, hideText, audioFb, autoFlip) {
      if (autoFlip === undefined) autoFlip = localStorage.getItem('tasmee_auto_flip') !== '0';
      const showAyahEnd = localStorage.getItem('tasmee_show_ayah_end') === '1';
      const contentEl = document.getElementById('tasmeeTextContent');
      if (contentEl) contentEl.classList.toggle('show-ayah-end', showAyahEnd);
      const btn = document.getElementById('tasmeeBtn');
      tasmeeCurrentAyahHighlight = -1;
      tasmeeEngine = new TasmeeEngine({
        audioFeedback: audioFb,
        onWordMatch: (_idx, _state, progress) => {
          const el = document.getElementById('tasmeeProgressText');
          if (el) el.textContent = `${progress.done} / ${progress.total} ÙƒÙ„Ù…Ø©`;
          if (progress.currentAyahIdx >= 0) _tasmeeHighlightPanelAyah(progress.currentAyahIdx);
        },
        onSessionEnd: (summary) => {
          document.getElementById('tasmeeActiveBar').classList.remove('active');
          document.getElementById('tasmeeTextPanel').classList.remove('active');
          _tasmeeHighlightPanelAyah(-1);
          if (btn) btn.disabled = false;
          const engRef = tasmeeEngine;
          tasmeeEngine = null;
          // Auto-advance to next page when the whole page is completed
          if (summary.completed && autoFlip && currentPage < 604) {
            const nextPage = currentPage + 1;
            if (btn) btn.disabled = true;
            navigateTo(nextPage, 'next');
            showCustomToast('Ø§Ù†ØªÙ‡Øª Ø§Ù„ØµÙØ­Ø©! Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ù„Ù„ØµÙØ­Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©...');
            fetchTasmeeTextForPage(nextPage).then(newData => {
              renderTasmeeTextPanel(newData);
              document.getElementById('tasmeeTextPanel').classList.add('active');
              _tasmeeStartWithData(newData, hideText, audioFb, autoFlip);
            }).catch(() => { if (btn) btn.disabled = false; });
            return;
          }
          engRef._showResultModal(summary);
        }
      });
      tasmeeEngine.startSession(ayahData, { hideText })
        .then(() => {
          document.getElementById('tasmeeProgressText').textContent = `Ù  / ${tasmeeEngine._wordTokens.length} ÙƒÙ„Ù…Ø©`;
          document.getElementById('tasmeeMicIndicator').classList.remove('paused');
          document.getElementById('tasmeePauseBtn').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
          document.getElementById('tasmeeActiveBar').classList.add('active');
        })
        .catch(err => {
          if (btn) btn.disabled = false;
          document.getElementById('tasmeeTextPanel').classList.remove('active');
          tasmeeEngine = null;
          showCustomToast('ØªØ¹Ø°Ø± Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù„Ù…ÙŠÙƒØ±ÙˆÙÙˆÙ†: ' + (err.message || err));
        });
    }

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
        showCustomToast('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù†Øµ: ' + e.message);
        return;
      }

      tasmeeLastPage = currentPage;
      renderTasmeeTextPanel(ayahData);
      document.getElementById('tasmeeTextPanel').classList.add('active');
      _tasmeeStartWithData(ayahData, hideText, audioFb, audioFlip);
    }

    function pauseOrResumeTasmee() {
      if (!tasmeeEngine) return;
      const btn = document.getElementById('tasmeePauseBtn');
      if (tasmeeEngine.isPaused) {
        tasmeeEngine.resumeSession();
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      } else {
        tasmeeEngine.pauseSession();
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>';
      }
    }

    function endTasmeeSession() {
      if (!tasmeeEngine) return;
      tasmeeEngine.endSession();
    }

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

    function retryTasmeeSession() {
      closeModal('tasmeeResultsModal');
      if (tasmeeLastPage !== null) openTasmeeSetup();
    }

    // End Tasmee' on manual page navigation (not auto-advance)
    const _origNavigateTo = navigateTo;
    navigateTo = function(newPage, dir) {
      if (tasmeeEngine && tasmeeEngine.isActive) {
        tasmeeEngine.endSession();
      }
      _origNavigateTo(newPage, dir);
    };

