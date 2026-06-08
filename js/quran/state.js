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
        if (typeof showCustomToast === 'function') {
          showCustomToast("تعذر تحميل قاعدة البيانات — بعض الميزات قد لا تعمل");
        }
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
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const res = await fetch('../json/medina2_coords.json', { signal: controller.signal });
          clearTimeout(timer);
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
